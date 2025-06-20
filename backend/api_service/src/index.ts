import express, { Request, Response, NextFunction } from 'express';
import { Client as PgClient } from 'pg';
import { Client as EsClient } from '@elastic/elasticsearch';
import Redis from 'ioredis';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { URL } from 'url';
import { generateCacheKey } from './utils/cacheUtils'; // Import from new location

// --- Configuration (from Environment Variables or Defaults) ---
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://user:password@postgres_db:5432/real_estate_db';
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis_cache_service:6379';

const ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE || 'http://elasticsearch_db:9200';
const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'properties';

const CACHE_TTL_PROPERTIES = parseInt(process.env.CACHE_TTL_PROPERTIES || '300', 10);
const CACHE_TTL_METADATA = parseInt(process.env.CACHE_TTL_METADATA || '600', 10);

// Rate Limiter Configuration
const RATE_LIMIT_POINTS = parseInt(process.env.RATE_LIMIT_POINTS || '100', 10); // Max points
const RATE_LIMIT_DURATION = parseInt(process.env.RATE_LIMIT_DURATION || '60', 10); // Per N seconds
// Optional: const RATE_LIMIT_BLOCK_DURATION = parseInt(process.env.RATE_LIMIT_BLOCK_DURATION || '3600', 10); // Block for 1 hour

const pgUrl = new URL(POSTGRES_URL);

// --- PostgreSQL Client Setup ---
const pgClient = new PgClient({
    user: pgUrl.username, password: pgUrl.password, host: pgUrl.hostname,
    port: parseInt(pgUrl.port, 10), database: pgUrl.pathname.slice(1),
});

// --- Elasticsearch Client Setup ---
const esClient = new EsClient({ node: ELASTICSEARCH_NODE, requestTimeout: 5000 });

// --- Redis Client Setup ---
const redisClient = new Redis(REDIS_URL);
redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => {
    console.log('Successfully connected to Redis for API service.');
    // Initialize Rate Limiter once Redis is connected
    initializeRateLimiter();
});

// --- Rate Limiter Setup ---
let rateLimiter: RateLimiterRedis;

function initializeRateLimiter() {
    if (!redisClient.status || redisClient.status !== 'ready' && redisClient.status !== 'connect') {
        console.warn('Redis client not ready for Rate Limiter. Will attempt re-init or fail on request.');
        // Optionally, retry initialization or handle this state appropriately.
        // For now, middleware will throw error if rateLimiter is not initialized.
        return;
    }
    rateLimiter = new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'rate_limit_api',
        points: RATE_LIMIT_POINTS,
        duration: RATE_LIMIT_DURATION,
        // blockDuration: RATE_LIMIT_BLOCK_DURATION, // Optional: block for N seconds if points consumed
        // inmemoryBlockOnConsumed: RATE_LIMIT_POINTS * 2, // If IP consumes > points * 2, block it in memory
        // inmemoryBlockDuration: RATE_LIMIT_BLOCK_DURATION,
    });
    console.log(`Rate limiter initialized: ${RATE_LIMIT_POINTS} points per ${RATE_LIMIT_DURATION}s.`);
}


async function connectDependencies() {
    try {
        await pgClient.connect();
        console.log('Successfully connected to PostgreSQL for API service.');
        await esClient.ping();
        console.log('Successfully connected to Elasticsearch for API service.');
        // Redis connection is event-driven and logged by its own event handlers.
        // Rate limiter initialization depends on Redis connection.
    } catch (error) {
        console.error('Error connecting to dependencies for API service:', error);
        throw error;
    }
}

// --- Cache Key Generation ---
const generateCacheKey = (prefix: string, queryParams: object): string => {
    const sortedQuery = Object.keys(queryParams).sort().reduce((obj: { [key: string]: any }, key) => {
        obj[key] = queryParams[key as keyof typeof queryParams]; return obj;
    }, {});
    const queryString = JSON.stringify(sortedQuery);
    const hash = crypto.createHash('md5').update(queryString).digest('hex');
    return `${prefix}:${hash}`;
};

// --- Express App Setup ---
const app = express();
// IMPORTANT: If your app is behind a proxy (e.g., Nginx, Heroku, AWS ELB),
// set 'trust proxy' so req.ip returns the actual client IP.
// The value '1' means it trusts the first proxy hop. Adjust if more hops.
app.set('trust proxy', 1);

// --- Rate Limiting Middleware ---
const rateLimiterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    if (!rateLimiter) { // Check if rateLimiter was initialized (Redis might have been down at start)
        console.error('Rate limiter not initialized. Allowing request without limiting.');
        // Attempt to re-initialize if Redis is now available
        if (redisClient.status === 'ready' || redisClient.status === 'connect') initializeRateLimiter();
        if (!rateLimiter) return next(); // Still not initialized, pass through for now
    }

    try {
        await rateLimiter.consume(req.ip); // Consume 1 point per request for the IP
        next();
    } catch (rlRejected: any) { // Catch RateLimiterRes object or Error
        if (rlRejected instanceof Error) {
            console.error('Rate Limiter internal error:', rlRejected);
            // Fallback: allow request or send a generic server error
            return res.status(500).send('Internal server error related to rate limiting.');
        } else {
            // rlRejected is an instance of RateLimiterRes, meaning rate limit exceeded
            const secs = Math.ceil(rlRejected.msBeforeNext / 1000);
            res.setHeader('Retry-After', String(secs));
            res.status(429).send(`Too Many Requests. Try again in ${secs} seconds.`);
        }
    }
};

// Apply rate limiting middleware to all routes
app.use(rateLimiterMiddleware);


// --- API Endpoints ---
app.get('/', (req: Request, res: Response) => {
    res.send('Hello from the Real Estate API Service! Rate limiting is active.');
});

app.get('/properties/filters/metadata', async (req: Request, res: Response) => {
    const cacheKey = 'filters_metadata:all';
    try {
        const cachedResult = await redisClient.get(cacheKey);
        if (cachedResult) { return res.status(200).json(JSON.parse(cachedResult)); }
        const esQuery = { /* ... */ }; // Condensed for brevity
        // ... (rest of metadata endpoint logic from previous step)
        const { body } = await esClient.search({
            index: ELASTICSEARCH_INDEX,
            body: {
                size: 0, query: { term: { status: 'active' } },
                aggs: {
                    min_price: { min: { field: 'normalized_price_usd' } }, max_price: { max: { field: 'normalized_price_usd' } },
                    property_types: { terms: { field: 'source_name.keyword', size: 50, order: { _count: 'desc' } } },
                    min_bedrooms: { min: { field: 'bedrooms' } }, max_bedrooms: { max: { field: 'bedrooms' } },
                    min_bathrooms: { min: { field: 'bathrooms' } }, max_bathrooms: { max: { field: 'bathrooms' } },
                    min_area: { min: { field: 'normalized_area_sqft' } }, max_area: { max: { field: 'normalized_area_sqft' } },
                    locations: { terms: { field: 'address_raw.keyword', size: 100, order: { _key: 'asc' } } }
                }
            }
        });
        const aggs = body.aggregations;
        const metadata = {
            price_range: { min: aggs.min_price?.value, max: aggs.max_price?.value },
            property_types: aggs.property_types?.buckets || [],
            bedrooms_range: { min: aggs.min_bedrooms?.value, max: aggs.max_bedrooms?.value },
            bathrooms_range: { min: aggs.min_bathrooms?.value, max: aggs.max_bathrooms?.value },
            area_sqft_range: { min: aggs.min_area?.value, max: aggs.max_area?.value },
            locations: aggs.locations?.buckets || []
        };
        await redisClient.set(cacheKey, JSON.stringify(metadata), 'EX', CACHE_TTL_METADATA);
        res.status(200).json(metadata);
    } catch (error: any) {
        console.error('Error fetching filter metadata:', error.meta?.body?.error || error.message || error);
        res.status(500).json({ error: 'Failed to fetch filter metadata.'});
    }
});

app.get('/properties', async (req: Request, res: Response) => {
    const cacheKey = generateCacheKey('properties', req.query);
    try {
        const cachedResult = await redisClient.get(cacheKey);
        if (cachedResult) { return res.status(200).json(JSON.parse(cachedResult)); }
        // ... (rest of /properties endpoint logic from previous step, condensed for brevity)
        const { q, lat, lon, radius_km, min_price, max_price, property_type, min_beds, max_beds, min_baths, max_baths, min_area_sqft, max_area_sqft, amenities, sort_by: sortByQuery, order: orderQuery, page: pageQuery, limit: limitQuery } = req.query;
        const page = parseInt(pageQuery as string) || 1; const limit = parseInt(limitQuery as string) || 10; const from = (page - 1) * limit;
        if (page < 1 || limit < 1) { return res.status(400).json({ error: 'Page and limit must be positive integers.' });}
        const esQueryBody: any = { query: { bool: { must: [], filter: [] } }, from: from, size: limit,};
        if (q && typeof q === 'string') { esQueryBody.query.bool.must.push({ multi_match: { query: q, fields: ['title^3', 'location_text^2', 'address_raw^2', 'description', 'source_name'], fuzziness: "AUTO", operator: "OR" },});}
        let isGeoSearchActive = false; let parsedLatitude: number | null = null; let parsedLongitude: number | null = null;
        if (lat && lon && radius_km) { parsedLatitude = parseFloat(lat as string); parsedLongitude = parseFloat(lon as string); const radius = parseFloat(radius_km as string); if (!isNaN(parsedLatitude) && !isNaN(parsedLongitude) && !isNaN(radius) && radius > 0) { isGeoSearchActive = true; esQueryBody.query.bool.filter.push({ geo_distance: { distance: `${radius}km`, location_coordinates: { lat: parsedLatitude, lon: parsedLongitude }, distance_type: 'arc', validation_method: 'STRICT' },}); } else { return res.status(400).json({ error: 'Invalid geo parameters.' }); }}
        const priceRangeQuery: { range: { normalized_price_usd: any } } = { range: { normalized_price_usd: {} } }; if (min_price) priceRangeQuery.range.normalized_price_usd.gte = parseFloat(min_price as string); if (max_price) priceRangeQuery.range.normalized_price_usd.lte = parseFloat(max_price as string); if (min_price || max_price) esQueryBody.query.bool.filter.push(priceRangeQuery);
        if (property_type && typeof property_type === 'string') { const types = property_type.split(',').map(t => t.trim()).filter(t => t); if (types.length > 0) esQueryBody.query.bool.filter.push({ terms: { "source_name.keyword": types } });}
        const bedsRangeQuery: { range: { bedrooms: any } } = { range: { bedrooms: {} } }; if (min_beds) bedsRangeQuery.range.bedrooms.gte = parseInt(min_beds as string); if (max_beds) bedsRangeQuery.range.bedrooms.lte = parseInt(max_beds as string); if (min_beds || max_beds) esQueryBody.query.bool.filter.push(bedsRangeQuery);
        const bathsRangeQuery: { range: { bathrooms: any } } = { range: { bathrooms: {} } }; if (min_baths) bathsRangeQuery.range.bathrooms.gte = parseFloat(min_baths as string); if (max_baths) bathsRangeQuery.range.bathrooms.lte = parseFloat(max_baths as string); if (min_baths || max_baths) esQueryBody.query.bool.filter.push(bathsRangeQuery);
        const areaRangeQuery: { range: { normalized_area_sqft: any } } = { range: { normalized_area_sqft: {} } }; if (min_area_sqft) areaRangeQuery.range.normalized_area_sqft.gte = parseFloat(min_area_sqft as string); if (max_area_sqft) areaRangeQuery.range.normalized_area_sqft.lte = parseFloat(max_area_sqft as string); if (min_area_sqft || max_area_sqft) esQueryBody.query.bool.filter.push(areaRangeQuery);
        if (amenities && typeof amenities === 'string') { const amenityQueryString = amenities.split(',').map(a => a.trim()).filter(a => a).join(' '); if (amenityQueryString) esQueryBody.query.bool.filter.push({ match: { description: { query: amenityQueryString, operator: 'and' } } });}
        if (esQueryBody.query.bool.must.length === 0) esQueryBody.query.bool.must.push({ match_all: {} }); esQueryBody.query.bool.filter.push({ term: { status: 'active' } });
        const sortBy = sortByQuery || (q ? 'relevance' : (isGeoSearchActive ? 'distance' : 'date')); const order = (orderQuery as string === 'asc' || orderQuery as string === 'desc') ? orderQuery as string : 'desc'; const sortOptions: any[] = [];
        switch (sortBy) { case 'price': sortOptions.push({ 'normalized_price_usd': { order: order, missing: '_last' } }); break; case 'date': sortOptions.push({ 'date_posted': { order: order, missing: '_last' } }); break; case 'area': sortOptions.push({ 'normalized_area_sqft': { order: order, missing: '_last' } }); break; case 'relevance': if (q) sortOptions.push({ '_score': { order: 'desc' } }); else if (isGeoSearchActive && parsedLatitude && parsedLongitude) sortOptions.push({'_geo_distance': {location_coordinates: { lat: parsedLatitude, lon: parsedLongitude }, order: 'asc', unit: 'km'}}); break; case 'distance': if (isGeoSearchActive && parsedLatitude && parsedLongitude) sortOptions.push({'_geo_distance': {location_coordinates: { lat: parsedLatitude, lon: parsedLongitude }, order: (order === 'asc' ? 'asc' : 'desc'), unit: 'km'}}); else sortOptions.push({ 'date_posted': { order: 'desc', missing: '_last' } }); break; default: sortOptions.push({ 'date_posted': { order: 'desc', missing: '_last' } });}
        if (sortBy !== 'relevance' && sortBy !== 'distance') { sortOptions.push({ 'date_posted': { order: 'desc', missing: '_last' } }); sortOptions.push({ '_score': { order: 'desc' } }); } else if (sortBy === 'relevance' && !q && !isGeoSearchActive) { sortOptions.push({ '_score': { order: 'desc' } });}
        if(sortOptions.length === 0) { sortOptions.push({ 'date_posted': { order: 'desc', missing: '_last' } }, { 'scrape_timestamp': { order: 'desc', missing: '_last' } }, { '_score': { order: 'desc' } });}
        esQueryBody.sort = sortOptions;
        const { body } = await esClient.search({ index: ELASTICSEARCH_INDEX, body: esQueryBody });
        const properties = body.hits.hits.map((hit: any) => hit._source); const totalItems = typeof body.hits.total === 'number' ? body.hits.total : body.hits.total?.value || 0; const totalPages = Math.ceil(totalItems / limit);
        const responseData = { data: properties, pagination: { currentPage: page, totalPages: totalPages, totalItems: totalItems, limit: limit, nextPage: page < totalPages ? page + 1 : null, prevPage: page > 1 ? page - 1 : null, },};
        await redisClient.set(cacheKey, JSON.stringify(responseData), 'EX', CACHE_TTL_PROPERTIES);
        res.status(200).json(responseData);
    } catch (error: any) {
        console.error('Error in /properties endpoint:', error.meta?.body?.error || error.message || error);
        res.status(500).json({ error: 'Failed to fetch properties.'});
    }
});

// --- Start Server ---
async function startServer() {
    try {
        await connectDependencies();
        const server = app.listen(PORT, () => {
            console.log(`API Server is running on port ${PORT}. Rate limiting active.`);
        });

        const shutdown = async (signal: string) => {
            console.log(`${signal} received. Shutting down API server gracefully...`);
            server.close(async () => {
                console.log('HTTP server closed.');
                try {
                    if (pgClient) await pgClient.end();
                    if (redisClient) await redisClient.quit();
                } catch (dbError) { console.error('Error disconnecting databases:', dbError); }
                process.exit(0);
            });
        };
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
    } catch (error) {
        console.error('Failed to start API server:', error);
        process.exit(1);
    }
}

startServer();
