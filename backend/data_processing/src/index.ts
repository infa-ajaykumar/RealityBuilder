import amqp from 'amqplib';
import { Client as PgClient } from 'pg';
import { Client as EsClient } from '@elastic/elasticsearch';
import { URL } from 'url';
import NodeGeocoder from 'node-geocoder';
import * as PropertyUtils from './utils'; // Import utilities

// --- Configuration (from Environment Variables or Defaults) ---
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq_server';
const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE || 'property_listings_raw';

const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://user:password@postgres_db:5432/real_estate_db';
const pgUrl = new URL(POSTGRES_URL);

const ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE || 'http://elasticsearch_db:9200';
const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'properties';
const GEOCODER_PROVIDER = (process.env.GEOCODER_PROVIDER || 'openstreetmap') as NodeGeocoder.Providers;

const LAT_DEG_THRESHOLD = parseFloat(process.env.DEDUPE_LAT_DEG_THRESHOLD || '0.0001'); // Approx 11 meters
const LON_DEG_THRESHOLD = parseFloat(process.env.DEDUPE_LON_DEG_THRESHOLD || '0.0001'); // Approx 11 meters at equator
const TITLE_SIMILARITY_THRESHOLD = parseFloat(process.env.DEDUPE_TITLE_SIMILARITY_THRESHOLD || '0.6'); // pg_trgm similarity

// --- Elasticsearch Client Setup ---
const esClient = new EsClient({ node: ELASTICSEARCH_NODE, requestTimeout: 60000 });

async function ensureIndexExists() {
    try {
        const { body: indexExists } = await esClient.indices.exists({ index: ELASTICSEARCH_INDEX });

        if (!indexExists) {
            console.log(`Elasticsearch index '${ELASTICSEARCH_INDEX}' not found. Creating...`);
            await esClient.indices.create({
                index: ELASTICSEARCH_INDEX,
                body: {
                    mappings: {
                        properties: {
                            title: { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } }, // For fuzzy and exact match
                            price_original_numeric: { type: 'float' },
                            price_original_textual_display: { type: 'keyword' },
                            currency_original: { type: 'keyword' },
                            normalized_price_usd: { type: 'float' },

                            location_text: { type: 'text' },
                            address_raw: { type: 'text' },
                            location_coordinates: { type: 'geo_point' },

                            bedrooms: { type: 'integer' },
                            bathrooms: { type: 'half_float' },

                            area_original_value: { type: 'float' },
                            area_unit_original: { type: 'keyword' },
                            normalized_area_sqft: { type: 'float' },

                            images: { type: 'keyword' },
                            description: { type: 'text' },

                            source_url: { type: 'keyword' },
                            date_posted: { type: 'date' },
                            source_name: { type: 'keyword' },
                            scrape_timestamp: { type: 'date' },

                            status: { type: 'keyword' }, // New field for deduplication
                            duplicate_of_property_id: { type: 'integer' }, // New field

                            created_at: { type: 'date' },
                            updated_at: { type: 'date' },
                        },
                    },
                },
            });
            console.log(`Elasticsearch index '${ELASTICSEARCH_INDEX}' created successfully.`);
        } else {
            console.log(`Elasticsearch index '${ELASTICSEARCH_INDEX}' already exists. Verifying/updating mapping...`);
            // Optionally update mapping if it has changed. Be careful with existing data.
            // Example: await esClient.indices.putMapping({ index: ELASTICSEARCH_INDEX, body: { properties: { ... } } });
        }
    } catch (error) {
        console.error('Error ensuring Elasticsearch index exists/updated:', error);
        throw error;
    }
}

// --- PostgreSQL Client Setup ---
const pgClient = new PgClient({
    user: pgUrl.username,
    password: pgUrl.password,
    host: pgUrl.hostname,
    port: parseInt(pgUrl.port, 10),
    database: pgUrl.pathname.slice(1),
});

async function connectPg() {
    try {
        await pgClient.connect();
        console.log('Successfully connected to PostgreSQL.');
    } catch (error) {
        console.error('Error connecting to PostgreSQL:', error);
        throw error;
    }
}

// --- Geocoder Setup ---
const geocoderOptions: NodeGeocoder.Options = {
    provider: GEOCODER_PROVIDER,
};
const geocoder = NodeGeocoder(geocoderOptions);


// --- Deduplication Logic ---
async function findPotentialDuplicates(property: any): Promise<any[]> {
    if (property.latitude == null || property.longitude == null) {
        console.log('Skipping duplicate check: missing coordinates for new property', property.source_url);
        return [];
    }

    // Query for properties within a lat/lon bounding box, from a different source, and active
    // Uses pg_trgm similarity for title matching.
    const query = `
        SELECT
            id, title, source_name, latitude, longitude, status,
            similarity(title, $1) as title_similarity
        FROM properties
        WHERE
            status = 'active' AND
            source_name != $2 AND
            latitude BETWEEN $3 - ${LAT_DEG_THRESHOLD} AND $3 + ${LAT_DEG_THRESHOLD} AND
            longitude BETWEEN $4 - ${LON_DEG_THRESHOLD} AND $4 + ${LON_DEG_THRESHOLD} AND
            similarity(title, $1) >= ${TITLE_SIMILARITY_THRESHOLD}
        ORDER BY title_similarity DESC, scrape_timestamp DESC;
    `;
    // Note: A spatial index (GIST on ST_MakePoint(longitude, latitude)) and ST_DWithin would be more accurate and performant for geo-proximity.
    // This query is a simplified version using simple range checks.

    try {
        const { rows } = await pgClient.query(query, [
            property.title,
            property.source_name,
            property.latitude,
            property.longitude,
        ]);
        if (rows.length > 0) {
            console.log(`Found ${rows.length} potential duplicate(s) for property title "${property.title}" from source "${property.source_name}"`);
        }
        return rows;
    } catch (err) {
        console.error('Error querying for duplicates:', err);
        return [];
    }
}


// --- Data Normalization & Processing ---
async function normalizeAndProcessData(rawData: any): Promise<any> {
    const processedData: any = { ...rawData };

    const parsedPrice = PropertyUtils.parsePrice(rawData.price_text || rawData.price);
    processedData.price_original_numeric = parsedPrice.amount;
    processedData.currency_original = parsedPrice.currency;
    processedData.price_original_textual_display = rawData.price_text || rawData.price;
    if (parsedPrice.amount && parsedPrice.currency) {
        processedData.normalized_price_usd = PropertyUtils.convertToUSD(parsedPrice.amount, parsedPrice.currency);
    } else {
        processedData.normalized_price_usd = null;
    }

    const parsedArea = PropertyUtils.parseArea(rawData.area_text || rawData.area);
    processedData.area_original_value = parsedArea.value;
    processedData.area_unit_original = parsedArea.unit;
    if (parsedArea.value && parsedArea.unit) {
        processedData.normalized_area_sqft = PropertyUtils.convertToSqft(parsedArea.value, parsedArea.unit);
    } else {
        processedData.normalized_area_sqft = null;
    }

    processedData.bedrooms = PropertyUtils.parseBedrooms(rawData.bedrooms_text || rawData.bedrooms);
    processedData.bathrooms = PropertyUtils.parseBathrooms(rawData.bathrooms_text || rawData.bathrooms);

    processedData.location_text = rawData.location || rawData.location_text || null;
    processedData.address_raw = processedData.location_text;

    processedData.latitude = null;
    processedData.longitude = null;
    processedData.geocoded_data_raw = null;

    if (processedData.address_raw) {
        try {
            const geoResult = await geocoder.geocode(processedData.address_raw);
            if (geoResult && geoResult.length > 0) {
                processedData.latitude = geoResult[0].latitude;
                processedData.longitude = geoResult[0].longitude;
                processedData.geocoded_data_raw = geoResult[0];
            }
        } catch (geoErr: any) {
            console.error(`Geocoding error for "${processedData.address_raw}":`, geoErr.message || geoErr);
        }
    }

    processedData.source_name = rawData.source_name || 'UnknownScraper';
    processedData.scrape_timestamp = new Date().toISOString();
    if (rawData.date_posted && !(rawData.date_posted instanceof Date)) {
        try { processedData.date_posted = new Date(rawData.date_posted).toISOString(); }
        catch (e) { processedData.date_posted = null; }
    } else if (rawData.date_posted instanceof Date) {
        processedData.date_posted = rawData.date_posted.toISOString();
    } else {
        processedData.date_posted = null;
    }

    if (!processedData.source_url) {
      processedData.source_url = `missing_url_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
    if (!processedData.title) {
      processedData.title = "Untitled Listing";
    }
    if (!Array.isArray(processedData.images)) {
        processedData.images = processedData.images ? [processedData.images] : [];
    }

    // Initialize deduplication fields
    processedData.status = 'active';
    processedData.duplicate_of_property_id = null;

    // Perform deduplication check
    const duplicates = await findPotentialDuplicates(processedData);
    if (duplicates.length > 0) {
        // Basic strategy: mark as duplicate of the first found active record
        // More advanced: scoring, merging logic, etc.
        const primaryDuplicate = duplicates[0];
        console.log(`Marking property ${processedData.source_url} as potential duplicate of property ID ${primaryDuplicate.id} (Title: "${primaryDuplicate.title}", Similarity: ${primaryDuplicate.title_similarity.toFixed(2)})`);
        processedData.status = 'potential_duplicate';
        processedData.duplicate_of_property_id = primaryDuplicate.id;
    }

    return processedData;
}


// --- RabbitMQ Consumer Logic ---
async function startConsumer() {
    console.log(`Attempting to connect to RabbitMQ at ${RABBITMQ_URL}`);
    let connection: amqp.Connection | null = null;
    try {
        connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        console.log('Successfully connected to RabbitMQ.');

        await channel.assertQueue(RABBITMQ_QUEUE, { durable: true });
        console.log(`Waiting for messages in queue: ${RABBITMQ_QUEUE}`);

        channel.consume(RABBITMQ_QUEUE, async (msg) => {
            if (msg !== null) {
                let processingSuccess = false;
                let dataToStore: any = null;

                try {
                    const rawData = JSON.parse(msg.content.toString());
                    dataToStore = await normalizeAndProcessData(rawData);

                    // Store in PostgreSQL
                    const insertQuery = `
                        INSERT INTO properties (
                            title, price_original_numeric, price_original_textual_display, currency_original, normalized_price_usd,
                            location_text, address_raw, latitude, longitude, geocoded_data_raw,
                            bedrooms, bathrooms, area_original_value, area_unit_original, normalized_area_sqft,
                            images, description, source_url, date_posted, source_name, scrape_timestamp,
                            status, duplicate_of_property_id
                        )
                        VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21,
                            $22, $23
                        )
                        ON CONFLICT (source_url) DO UPDATE SET
                            title = EXCLUDED.title,
                            price_original_numeric = EXCLUDED.price_original_numeric,
                            price_original_textual_display = EXCLUDED.price_original_textual_display,
                            currency_original = EXCLUDED.currency_original,
                            normalized_price_usd = EXCLUDED.normalized_price_usd,
                            location_text = EXCLUDED.location_text,
                            address_raw = EXCLUDED.address_raw,
                            latitude = EXCLUDED.latitude,
                            longitude = EXCLUDED.longitude,
                            geocoded_data_raw = EXCLUDED.geocoded_data_raw,
                            bedrooms = EXCLUDED.bedrooms,
                            bathrooms = EXCLUDED.bathrooms,
                            area_original_value = EXCLUDED.area_original_value,
                            area_unit_original = EXCLUDED.area_unit_original,
                            normalized_area_sqft = EXCLUDED.normalized_area_sqft,
                            images = EXCLUDED.images,
                            description = EXCLUDED.description,
                            date_posted = EXCLUDED.date_posted,
                            source_name = EXCLUDED.source_name,
                            scrape_timestamp = EXCLUDED.scrape_timestamp,
                            status = EXCLUDED.status, -- Allow status update on conflict
                            duplicate_of_property_id = EXCLUDED.duplicate_of_property_id, -- Allow update
                            updated_at = CURRENT_TIMESTAMP
                        RETURNING id;
                    `;
                    const pgRes = await pgClient.query(insertQuery, [
                        dataToStore.title, dataToStore.price_original_numeric, dataToStore.price_original_textual_display, dataToStore.currency_original, dataToStore.normalized_price_usd,
                        dataToStore.location_text, dataToStore.address_raw, dataToStore.latitude, dataToStore.longitude, dataToStore.geocoded_data_raw,
                        dataToStore.bedrooms, dataToStore.bathrooms, dataToStore.area_original_value, dataToStore.area_unit_original, dataToStore.normalized_area_sqft,
                        dataToStore.images, dataToStore.description, dataToStore.source_url, dataToStore.date_posted, dataToStore.source_name, dataToStore.scrape_timestamp,
                        dataToStore.status, dataToStore.duplicate_of_property_id
                    ]);

                    const propertyId = pgRes.rows[0]?.id;

                    // Index in Elasticsearch
                    const esId = dataToStore.source_url;
                    const esDocument: any = { ...dataToStore };
                    if (dataToStore.latitude !== null && dataToStore.longitude !== null) {
                        esDocument.location_coordinates = { lat: dataToStore.latitude, lon: dataToStore.longitude };
                    }

                    await esClient.index({ index: ELASTICSEARCH_INDEX, id: esId, body: esDocument });
                    if (propertyId) console.log(`Data for ID ${propertyId} (source_url: ${esId}) processed, status: ${dataToStore.status}.`);

                    processingSuccess = true;

                } catch (error: any) {
                    console.error('Error processing message:', error.message || error);
                } finally {
                    if (processingSuccess) {
                        channel.ack(msg);
                    } else {
                        channel.nack(msg, false, false);
                        console.log("Message nacked (not requeued).");
                    }
                }
            }
        }, { noAck: false });

    } catch (error) {
        console.error('Failed to connect or setup RabbitMQ consumer:', error);
        if (connection) await connection.close();
        throw error;
    }
}

// --- Main Application Logic ---
async function main() {
    console.log('Starting data processing service (deduplication enhanced)...');
    try {
        await connectPg();
        await ensureIndexExists();
        await startConsumer();
        console.log('Data processing service is running and waiting for messages.');
    } catch (error) {
        console.error('Failed to initialize or run the data processing service:', error);
        process.exit(1);
    }
}

main();

const signals = ['SIGINT', 'SIGTERM'];
signals.forEach(signal => {
    process.on(signal, async () => {
        console.log(`${signal} received. Shutting down gracefully...`);
        try {
            if (pgClient) await pgClient.end();
            console.log('PostgreSQL client disconnected.');
        } catch (error) {
            console.error('Error during graceful shutdown:', error);
        }
        process.exit(0);
    });
});
