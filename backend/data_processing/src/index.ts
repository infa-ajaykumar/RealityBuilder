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

const LAT_DEG_THRESHOLD = parseFloat(process.env.DEDUPE_LAT_DEG_THRESHOLD || '0.0001');
const LON_DEG_THRESHOLD = parseFloat(process.env.DEDUPE_LON_DEG_THRESHOLD || '0.0001');
const TITLE_SIMILARITY_THRESHOLD = parseFloat(process.env.DEDUPE_TITLE_SIMILARITY_THRESHOLD || '0.6');

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
                            title: { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } },
                            price_original_numeric: { type: 'float' },
                            price_original_textual_display: { type: 'keyword' },
                            currency_original: { type: 'keyword' },
                            normalized_price_usd: { type: 'float' },

                            location_text: { type: 'text' },
                            address_raw: { type: 'text' },
                            location_coordinates: { type: 'geo_point' },

                            bedrooms: { type: 'integer' },
                            bathrooms: { type: 'half_float' },
                            property_type: { type: 'keyword' }, // Added in previous step

                            area_original_value: { type: 'float' },
                            area_unit_original: { type: 'keyword' },
                            normalized_area_sqft: { type: 'float' },

                            images: { type: 'keyword' },
                            description: { type: 'text' },
                            amenities: { type: 'keyword' }, // Added in previous step

                            source_url: { type: 'keyword' },
                            date_posted: { type: 'date' },
                            source_name: { type: 'keyword' },
                            scrape_timestamp: { type: 'date' },

                            status: { type: 'keyword' },
                            duplicate_of_property_id: { type: 'integer' },

                            created_at: { type: 'date' },
                            updated_at: { type: 'date' },
                        },
                    },
                },
            });
            console.log(`Elasticsearch index '${ELASTICSEARCH_INDEX}' created successfully.`);
        } else {
            console.log(`Elasticsearch index '${ELASTICSEARCH_INDEX}' already exists. Verifying/updating mapping...`);
            // In a real production scenario, you might want to use `putMapping` if you need to update mappings
            // but be very careful as some mapping changes require reindexing.
            // For now, we assume if the index exists, the mapping is compatible or was updated manually/via another process.
        }
    } catch (error) {
        console.error('Error ensuring Elasticsearch index exists/updated:', error);
        throw error;
    }
}

// --- PostgreSQL Client Setup ---
const pgClient = new PgClient({
    user: pgUrl.username, password: pgUrl.password, host: pgUrl.hostname,
    port: parseInt(pgUrl.port, 10), database: pgUrl.pathname.slice(1),
});

async function connectPg() {
    try { await pgClient.connect(); console.log('Successfully connected to PostgreSQL.'); }
    catch (error) { console.error('Error connecting to PostgreSQL:', error); throw error; }
}

// --- Geocoder Setup ---
const geocoderOptions: NodeGeocoder.Options = { provider: GEOCODER_PROVIDER };
const geocoder = NodeGeocoder(geocoderOptions);


// --- Deduplication Logic ---
async function findPotentialDuplicates(property: any): Promise<any[]> {
    if (property.latitude == null || property.longitude == null || !property.title) {
        console.log('Skipping duplicate check: missing coordinates or title for new property', property.source_url);
        return [];
    }
    const query = `
        SELECT id, title, source_name, latitude, longitude, status, similarity(title, $1) as title_similarity
        FROM properties
        WHERE status = 'active' AND source_name != $2
          AND latitude BETWEEN $3 - ${LAT_DEG_THRESHOLD} AND $3 + ${LAT_DEG_THRESHOLD}
          AND longitude BETWEEN $4 - ${LON_DEG_THRESHOLD} AND $4 + ${LON_DEG_THRESHOLD}
          AND similarity(title, $1) >= ${TITLE_SIMILARITY_THRESHOLD}
        ORDER BY title_similarity DESC, scrape_timestamp DESC;`;
    try {
        const { rows } = await pgClient.query(query, [property.title, property.source_name, property.latitude, property.longitude]);
        if (rows.length > 0) console.log(`Found ${rows.length} potential duplicate(s) for "${property.title}" from "${property.source_name}"`);
        return rows;
    } catch (err) { console.error('Error querying for duplicates:', err); return []; }
}


// --- Data Normalization & Processing ---
async function normalizeAndProcessData(rawData: any): Promise<any> {
    const processedData: any = {
        title: rawData.title || "Untitled Listing", // Ensure title has a default
        source_url: rawData.source_url || `missing_url_${Date.now()}_${Math.random().toString(16).slice(2)}`, // Ensure source_url
        source_name: rawData.source_name || 'UnknownScraper',
        scrape_timestamp: new Date().toISOString(),
    };

    // Price
    const parsedPrice = PropertyUtils.parsePrice(rawData.price_text || rawData.price);
    processedData.price_original_numeric = parsedPrice.amount;
    processedData.currency_original = parsedPrice.currency;
    processedData.price_original_textual_display = rawData.price_text || rawData.price;
    if (parsedPrice.amount && parsedPrice.currency) {
        processedData.normalized_price_usd = PropertyUtils.convertToUSD(parsedPrice.amount, parsedPrice.currency);
    } else { processedData.normalized_price_usd = null; }

    // Area
    const parsedArea = PropertyUtils.parseArea(rawData.area_text || rawData.area);
    processedData.area_original_value = parsedArea.value;
    processedData.area_unit_original = parsedArea.unit;
    if (parsedArea.value && parsedArea.unit) {
        processedData.normalized_area_sqft = PropertyUtils.convertToSqft(parsedArea.value, parsedArea.unit);
    } else { processedData.normalized_area_sqft = null; }

    // Bedrooms and Bathrooms (using raw text from scraper for better parsing)
    processedData.bedrooms = PropertyUtils.parseBedrooms(rawData.bedrooms_text);
    processedData.bathrooms = PropertyUtils.parseBathrooms(rawData.bathrooms_text);

    // Location and Geocoding
    processedData.location_text = rawData.location_text || rawData.location || null; // Prefer more specific field from scraper
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
        } catch (geoErr: any) { console.error(`Geocoding error for "${processedData.address_raw}":`, geoErr.message || geoErr); }
    }

    // Date Posted
    if (rawData.date_posted && !(rawData.date_posted instanceof Date)) {
        try { processedData.date_posted = new Date(rawData.date_posted).toISOString(); }
        catch (e) { processedData.date_posted = null; }
    } else if (rawData.date_posted instanceof Date) {
        processedData.date_posted = rawData.date_posted.toISOString();
    } else { processedData.date_posted = null; }

    // Images and Description
    processedData.images = Array.isArray(rawData.images) ? rawData.images.filter(img => typeof img === 'string') : (rawData.images ? [String(rawData.images)] : []);
    processedData.description = typeof rawData.description === 'string' ? rawData.description : null;

    // New Fields: property_type and amenities
    let property_type_raw = rawData.property_type;
    let amenities_raw = rawData.amenities;

    processedData.property_type = typeof property_type_raw === 'string' ? property_type_raw.trim() : null;
    if (processedData.property_type === '') processedData.property_type = null;

    processedData.amenities = [];
    if (Array.isArray(amenities_raw)) {
        processedData.amenities = amenities_raw
            .map(a => typeof a === 'string' ? a.trim() : '')
            .filter(a => a.length > 0);
    } else if (typeof amenities_raw === 'string' && amenities_raw.trim().length > 0) {
        // If amenities come as a comma-separated string, split and trim
        processedData.amenities = amenities_raw.split(',').map(a => a.trim()).filter(a => a.length > 0);
    }


    // Deduplication fields
    processedData.status = 'active';
    processedData.duplicate_of_property_id = null;
    const duplicates = await findPotentialDuplicates(processedData);
    if (duplicates.length > 0) {
        const primaryDuplicate = duplicates[0];
        console.log(`Marking prop ${processedData.source_url} as potential duplicate of ID ${primaryDuplicate.id}`);
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

                    const insertQuery = `
                        INSERT INTO properties (
                            title, price_original_numeric, price_original_textual_display, currency_original, normalized_price_usd,
                            location_text, address_raw, latitude, longitude, geocoded_data_raw,
                            bedrooms, bathrooms, property_type, area_original_value, area_unit_original, normalized_area_sqft,
                            images, description, amenities, source_url, date_posted, source_name, scrape_timestamp,
                            status, duplicate_of_property_id
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                            $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
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
                            property_type = EXCLUDED.property_type,
                            area_original_value = EXCLUDED.area_original_value,
                            area_unit_original = EXCLUDED.area_unit_original,
                            normalized_area_sqft = EXCLUDED.normalized_area_sqft,
                            images = EXCLUDED.images,
                            description = EXCLUDED.description,
                            amenities = EXCLUDED.amenities,
                            date_posted = EXCLUDED.date_posted,
                            source_name = EXCLUDED.source_name,
                            scrape_timestamp = EXCLUDED.scrape_timestamp,
                            status = EXCLUDED.status,
                            duplicate_of_property_id = EXCLUDED.duplicate_of_property_id,
                            updated_at = CURRENT_TIMESTAMP
                        RETURNING id;`;

                    const queryParams = [
                        dataToStore.title, dataToStore.price_original_numeric, dataToStore.price_original_textual_display, dataToStore.currency_original, dataToStore.normalized_price_usd,
                        dataToStore.location_text, dataToStore.address_raw, dataToStore.latitude, dataToStore.longitude, dataToStore.geocoded_data_raw,
                        dataToStore.bedrooms, dataToStore.bathrooms, dataToStore.property_type, dataToStore.area_original_value, dataToStore.area_unit_original, dataToStore.normalized_area_sqft,
                        dataToStore.images, dataToStore.description, dataToStore.amenities, dataToStore.source_url, dataToStore.date_posted, dataToStore.source_name, dataToStore.scrape_timestamp,
                        dataToStore.status, dataToStore.duplicate_of_property_id
                    ];

                    const pgRes = await pgClient.query(insertQuery, queryParams);
                    const propertyId = pgRes.rows[0]?.id;

                    const esId = dataToStore.source_url;
                    const esDocument: any = { ...dataToStore };
                    if (dataToStore.latitude !== null && dataToStore.longitude !== null) {
                        esDocument.location_coordinates = { lat: dataToStore.latitude, lon: dataToStore.longitude };
                    }
                    await esClient.index({ index: ELASTICSEARCH_INDEX, id: esId, body: esDocument });
                    if (propertyId) console.log(`Data for ID ${propertyId} (url: ${esId}) processed. Status: ${dataToStore.status}. Type: ${dataToStore.property_type}. Amenities: ${dataToStore.amenities?.length || 0}`);

                    processingSuccess = true;
                } catch (error: any) {
                    console.error('Error processing message:', error.message || error, dataToStore ? `Data: ${JSON.stringify(Object.keys(dataToStore))}`: '');
                } finally {
                    if (processingSuccess) { channel.ack(msg); }
                    else { channel.nack(msg, false, false); console.log("Message nacked."); }
                }
            }
        }, { noAck: false });
    } catch (error) {
        console.error('Failed to connect/setup RabbitMQ consumer:', error);
        if (connection) await connection.close();
        throw error;
    }
}

// --- Main Application Logic ---
async function main() {
    console.log('Starting data processing service (amenities/type enhanced)...');
    try {
        await connectPg(); await ensureIndexExists(); await startConsumer();
        console.log('Data processing service is running.');
    } catch (error) { console.error('Failed to run data processing service:', error); process.exit(1); }
}
main();

const signals = ['SIGINT', 'SIGTERM'];
signals.forEach(signal => {
    process.on(signal, async () => {
        console.log(`${signal} received. Shutting down...`);
        try { if (pgClient) await pgClient.end(); console.log('PostgreSQL client disconnected.'); }
        catch (error) { console.error('Error during graceful shutdown:', error); }
        process.exit(0);
    });
});
