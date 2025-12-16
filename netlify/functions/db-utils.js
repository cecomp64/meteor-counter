// Database utility functions - supports both Neon (production) and local PostgreSQL (development)

let dbClient;
let isNeon = false;
let pgPool; // For traditional pg client connections

function getDb() {
    if (!dbClient) {
        // Check for DATABASE_URL (local) or NETLIFY_DATABASE_URL (production)
        const dbUrl = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;

        if (!dbUrl) {
            throw new Error('DATABASE_URL or NETLIFY_DATABASE_URL environment variable is not set');
        }

        // Detect if using Neon based on connection string
        isNeon = dbUrl.includes('neon.tech') || dbUrl.includes('pooler.neon');

        if (isNeon) {
            // Use Neon serverless driver for production
            const { neon } = require('@neondatabase/serverless');
            dbClient = neon(dbUrl);
        } else {
            // Use standard PostgreSQL driver for local development
            const { Pool } = require('pg');
            pgPool = new Pool({
                connectionString: dbUrl,
                ssl: false // Local Docker doesn't need SSL
            });

            // Return a query helper that mimics the Neon interface
            dbClient = async (strings, ...values) => {
                const query = strings.reduce((acc, str, i) => {
                    return acc + str + (i < values.length ? `$${i + 1}` : '');
                }, '');

                const result = await pgPool.query(query, values);
                return result.rows;
            };
        }

        console.log(`Database initialized: ${isNeon ? 'Neon serverless' : 'PostgreSQL'}`);
    }

    return dbClient;
}

// Get a traditional PostgreSQL client for direct queries (used by auth functions)
async function getDbClient() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL environment variable is not set');
    }

    const dbUrl = process.env.DATABASE_URL;
    isNeon = dbUrl.includes('neon.tech') || dbUrl.includes('pooler.neon');

    if (isNeon) {
        // For Neon, use the Pool from @neondatabase/serverless
        const { Pool } = require('@neondatabase/serverless');
        const pool = new Pool({ connectionString: dbUrl });
        return pool;
    } else {
        // For local PostgreSQL, use standard pg Pool
        if (!pgPool) {
            const { Pool } = require('pg');
            pgPool = new Pool({
                connectionString: dbUrl,
                ssl: false
            });
        }
        return pgPool;
    }
}

// Apply location privacy settings
function applyLocationPrivacy(location, privacy) {
    if (!location || !location.latitude || !location.longitude) {
        return { latitude: null, longitude: null };
    }

    switch (privacy) {
        case 'hidden':
            return { latitude: null, longitude: null };

        case 'obfuscated':
            // Reduce precision to ~1km (2 decimal places)
            return {
                latitude: Math.round(location.latitude * 100) / 100,
                longitude: Math.round(location.longitude * 100) / 100
            };

        case 'full':
        default:
            return {
                latitude: location.latitude,
                longitude: location.longitude
            };
    }
}

// CORS headers for responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify(body)
    };
}

module.exports = {
    getDb,
    getDbClient,
    applyLocationPrivacy,
    corsHeaders,
    createResponse
};
