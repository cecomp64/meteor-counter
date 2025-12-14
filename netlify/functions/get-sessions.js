// Get sessions for a device
const { getDb, createResponse } = require('./db-utils');

exports.handler = async (event) => {
    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(200, {});
    }

    if (event.httpMethod !== 'GET') {
        return createResponse(405, { error: 'Method not allowed' });
    }

    try {
        const sql = getDb();
        const params = event.queryStringParameters || {};
        const deviceId = params.deviceId;
        const limit = parseInt(params.limit) || 100;
        const offset = parseInt(params.offset) || 0;

        let sessions;

        if (deviceId) {
            // Get sessions for specific device
            sessions = await sql`
                SELECT
                    id, start_time, end_time, duration, total_observations, notes,
                    location_latitude, location_longitude, location_accuracy,
                    location_privacy, created_at, updated_at
                FROM sessions
                WHERE device_id = ${deviceId}
                ORDER BY start_time DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        } else {
            // Get all sessions (for admin/analytics)
            sessions = await sql`
                SELECT
                    id, start_time, end_time, duration, total_observations,
                    location_latitude, location_longitude, location_privacy,
                    created_at, updated_at
                FROM sessions
                ORDER BY start_time DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        }

        return createResponse(200, {
            success: true,
            sessions: sessions,
            count: sessions.length
        });

    } catch (error) {
        console.error('Get sessions error:', error);
        return createResponse(500, {
            error: 'Failed to get sessions',
            message: error.message
        });
    }
};
