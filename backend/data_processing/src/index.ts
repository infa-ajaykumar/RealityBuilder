import amqp from 'amqplib';
import { Client as PgClient } from 'pg';
import { Client as EsClient } from '@elastic/elasticsearch';
import { URL } from 'url'; // For parsing database URLs

// --- Configuration (from Environment Variables or Defaults) ---
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq_server';
const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE || 'property_listings_raw';

const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://user:password@postgres_db:5432/real_estate_db';
const pgUrl = new URL(POSTGRES_URL);

const ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE || 'http://elasticsearch_db:9200';
const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'properties';

// --- Elasticsearch Client Setup ---
const esClient = new EsClient({ node: ELASTICSEARCH_NODE });

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
                            title: { type: 'text' },
                            price: { type: 'float' }, // Assuming numeric price after normalization
                            price_text: { type: 'keyword' },
                            location_text: { type: 'text' },
                            source_url: { type: 'keyword' }, // Good for exact matches/IDs
                            date_posted: { type: 'date' },
                            source_name: { type: 'keyword' },
                            scrape_timestamp: { type: 'date' },
                            // coordinates: { type: 'geo_point' } // For PostGIS equivalent
                            created_at: { type: 'date' },
                            updated_at: { type: 'date' },
                        },
                    },
                },
            });
            console.log(`Elasticsearch index '${ELASTICSEARCH_INDEX}' created successfully.`);
        } else {
            console.log(`Elasticsearch index '${ELASTICSEARCH_INDEX}' already exists.`);
        }
    } catch (error) {
        console.error('Error ensuring Elasticsearch index exists:', error);
        throw error; // Propagate error to stop service if ES is critical
    }
}

// --- PostgreSQL Client Setup ---
const pgClient = new PgClient({
    user: pgUrl.username,
    password: pgUrl.password,
    host: pgUrl.hostname,
    port: parseInt(pgUrl.port, 10),
    database: pgUrl.pathname.slice(1), // Remove leading '/'
});

async function connectPg() {
    try {
        await pgClient.connect();
        console.log('Successfully connected to PostgreSQL.');
    } catch (error) {
        console.error('Error connecting to PostgreSQL:', error);
        throw error; // Propagate error
    }
}


// --- Data Normalization ---
function normalizeData(messageContent: any): any {
    const normalized = { ...messageContent };

    // 1. Add/derive source_name
    normalized.source_name = messageContent.source || "MockSiteScraper"; // Default if not present

    // 2. Add scrape_timestamp
    normalized.scrape_timestamp = new Date().toISOString();

    // 3. Convert date_posted to a Date object (ISO string)
    if (messageContent.date_posted && !(messageContent.date_posted instanceof Date)) {
        try {
            normalized.date_posted = new Date(messageContent.date_posted).toISOString();
        } catch (e) {
            console.warn(`Could not parse date_posted: ${messageContent.date_posted}, leaving as is.`);
            normalized.date_posted = null; // Or keep original, or error out
        }
    } else if (messageContent.date_posted instanceof Date) {
        normalized.date_posted = messageContent.date_posted.toISOString();
    }


    // 4. Ensure price is a number
    normalized.price_text = messageContent.price; // Keep original price string
    if (messageContent.price && typeof messageContent.price === 'string') {
        const priceMatch = messageContent.price.match(/[\d,.]+/);
        if (priceMatch) {
            normalized.price = parseFloat(priceMatch[0].replace(/,/g, ''));
        } else {
            normalized.price = null; // Or some default / error
        }
    } else if (typeof messageContent.price === 'number') {
        normalized.price = messageContent.price;
    } else {
        normalized.price = null;
    }

    // Ensure all required fields for DB are present, with defaults if necessary
    normalized.title = normalized.title || "N/A";
    normalized.location_text = normalized.location_text || "N/A";
    normalized.source_url = normalized.source_url || `N/A_${Date.now()}`; // Needs to be unique

    return normalized;
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
                let propertyId: number | null = null;
                let normalizedData: any = null;

                try {
                    console.log(`Received message: ${msg.content.toString().substring(0,100)}...`);
                    const rawData = JSON.parse(msg.content.toString());
                    normalizedData = normalizeData(rawData);

                    // Store in PostgreSQL
                    const insertQuery = `
                        INSERT INTO properties (title, price, price_text, location_text, source_url, date_posted, source_name, scrape_timestamp)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (source_url) DO UPDATE SET
                            title = EXCLUDED.title,
                            price = EXCLUDED.price,
                            price_text = EXCLUDED.price_text,
                            location_text = EXCLUDED.location_text,
                            date_posted = EXCLUDED.date_posted,
                            scrape_timestamp = EXCLUDED.scrape_timestamp,
                            updated_at = CURRENT_TIMESTAMP
                        RETURNING id;
                    `;
                    const pgRes = await pgClient.query(insertQuery, [
                        normalizedData.title,
                        normalizedData.price,
                        normalizedData.price_text,
                        normalizedData.location_text,
                        normalizedData.source_url,
                        normalizedData.date_posted,
                        normalizedData.source_name,
                        normalizedData.scrape_timestamp,
                    ]);

                    propertyId = pgRes.rows[0]?.id;
                    if (propertyId) {
                        console.log(`Data inserted/updated in PostgreSQL with ID: ${propertyId}`);
                    } else {
                         // If ON CONFLICT DO NOTHING and it conflicted, ID might not be returned.
                        // For DO UPDATE, ID should be returned.
                        // If not, we might need to query for it if ES needs it.
                        // For now, assume ID is returned or source_url is a good enough ES ID.
                        console.log(`Data processed for PostgreSQL (source_url: ${normalizedData.source_url}). ID may not be returned if conflict resulted in no action or if RETURNING id is not supported in that specific conflict case.`);
                    }


                    // Index in Elasticsearch
                    // Use source_url as ID for idempotency if propertyId is not reliably fetched on conflict.
                    const esId = normalizedData.source_url; // Using source_url as ES ID

                    await esClient.index({
                        index: ELASTICSEARCH_INDEX,
                        id: esId, // Use source_url as document ID
                        body: {
                            ...normalizedData,
                            // pg_id: propertyId, // Optionally store PG ID
                        },
                    });
                    console.log(`Data indexed in Elasticsearch with ID (source_url): ${esId}`);

                    processingSuccess = true;

                } catch (error) {
                    console.error('Error processing message:', error);
                    if (normalizedData) {
                        console.error('Failed data:', JSON.stringify(normalizedData, null, 2));
                    } else {
                        console.error('Failed raw message content:', msg.content.toString());
                    }
                    // processingSuccess remains false
                } finally {
                    if (processingSuccess) {
                        channel.ack(msg);
                        console.log("Message acknowledged.");
                    } else {
                        // Decide whether to requeue or send to a dead-letter queue
                        // For now, nack without requeue to avoid processing loops for bad messages
                        channel.nack(msg, false, false);
                        console.log("Message nacked (not requeued).");
                    }
                }
            }
        }, { noAck: false }); // Manual acknowledgment

    } catch (error) {
        console.error('Failed to connect or setup RabbitMQ consumer:', error);
        // Implement retry logic or graceful shutdown if needed
        if (connection) await connection.close();
        throw error; // Propagate error to stop service if RabbitMQ is critical
    }
}

// --- Main Application Logic ---
async function main() {
    console.log('Starting data processing service...');
    try {
        await connectPg();
        await ensureIndexExists(); // Ensure ES index is ready before consuming
        await startConsumer();
        console.log('Data processing service is running and waiting for messages.');
    } catch (error) {
        console.error('Failed to initialize or run the data processing service:', error);
        // Consider exiting the process if critical components fail to initialize
        process.exit(1);
    }
}

main();

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down gracefully...');
    try {
        await pgClient.end();
        console.log('PostgreSQL client disconnected.');
        // RabbitMQ connection should be closed by amqp library on process exit or handled in startConsumer's error/finally blocks
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    try {
        await pgClient.end();
        console.log('PostgreSQL client disconnected.');
    } catch (error) {
        console.error('Error during graceful shutdown:', error);
    }
    process.exit(0);
});
