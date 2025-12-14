// Database utility functions for Neon connection
const { neon } = require('@neondatabase/serverless');

let sql;

function getDb() {
    if (!sql) {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is not set');
        }
        sql = neon(process.env.DATABASE_URL);
    }
    return sql;
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
    applyLocationPrivacy,
    corsHeaders,
    createResponse
};
