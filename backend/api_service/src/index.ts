import express, { Request, Response } from 'express';
import { Client as PgClient } from 'pg';
import { URL } from 'url'; // For parsing database URLs

// --- Configuration (from Environment Variables or Defaults) ---
const POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://user:password@postgres_db:5432/real_estate_db';
const PORT = process.env.PORT || 3000;

const pgUrl = new URL(POSTGRES_URL);

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
        console.log('Successfully connected to PostgreSQL for API service.');
    } catch (error) {
        console.error('Error connecting to PostgreSQL for API service:', error);
        throw error; // Propagate error to prevent server start if DB is unavailable
    }
}

// --- Express App Setup ---
const app = express();
app.use(express.json()); // Middleware to parse JSON bodies

// --- API Endpoints ---
app.get('/', (req: Request, res: Response) => {
    res.send('Hello from the Real Estate API Service!');
});

app.get('/properties', async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    if (page < 1 || limit < 1) {
        return res.status(400).json({ error: 'Page and limit must be positive integers.' });
    }

    console.log(`Fetching properties: page=${page}, limit=${limit}, offset=${offset}`);

    try {
        // Fetch data for the current page
        const propertiesQuery = 'SELECT * FROM properties ORDER BY date_posted DESC, created_at DESC LIMIT $1 OFFSET $2;';
        const propertiesResult = await pgClient.query(propertiesQuery, [limit, offset]);
        const properties = propertiesResult.rows;

        // Fetch total count of properties
        const countQuery = 'SELECT COUNT(*) AS total_items FROM properties;';
        const countResult = await pgClient.query(countQuery);
        const totalItems = parseInt(countResult.rows[0].total_items, 10);
        const totalPages = Math.ceil(totalItems / limit);

        console.log(`Found ${totalItems} total items. Returning ${properties.length} for page ${page}.`);

        res.status(200).json({
            data: properties,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalItems: totalItems,
                limit: limit,
                nextPage: page < totalPages ? page + 1 : null,
                prevPage: page > 1 ? page - 1 : null,
            },
        });
    } catch (error) {
        console.error('Error fetching properties from PostgreSQL:', error);
        res.status(500).json({ error: 'Failed to fetch properties. Please try again later.' });
    }
});

// --- Start Server ---
async function startServer() {
    try {
        await connectPg(); // Ensure DB is connected before starting server
        const server = app.listen(PORT, () => {
            console.log(`API Server is running on port ${PORT}`);
        });

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            console.log(`${signal} received. Shutting down API server gracefully...`);
            server.close(async () => {
                console.log('HTTP server closed.');
                try {
                    await pgClient.end();
                    console.log('PostgreSQL client for API service disconnected.');
                } catch (pgError) {
                    console.error('Error disconnecting PostgreSQL client for API service:', pgError);
                }
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
