// Get sessions for a device or user
const { getDb, createResponse } = require('./db-utils');
const { getAuthenticatedUserId } = require('./auth-utils');

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

        // Check if user is authenticated
        const userId = getAuthenticatedUserId(event);

        let sessions;

        if (userId) {
            // Get sessions for authenticated user (across all devices)
            sessions = await sql`
                SELECT
                    id, start_time, end_time, duration, total_observations, notes,
                    location_latitude, location_longitude, location_accuracy,
                    location_privacy, device_id, created_at, updated_at
                FROM sessions
                WHERE user_id = ${userId}
                ORDER BY start_time DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        } else if (deviceId) {
            // Get sessions for specific device (anonymous mode)
            sessions = await sql`
                SELECT
                    id, start_time, end_time, duration, total_observations, notes,
                    location_latitude, location_longitude, location_accuracy,
                    location_privacy, created_at, updated_at
                FROM sessions
                WHERE device_id = ${deviceId} AND user_id IS NULL
                ORDER BY start_time DESC
                LIMIT ${limit} OFFSET ${offset}
            `;
        } else {
            // No auth and no device ID - return error
            return createResponse(400, {
                error: 'Either authentication or deviceId parameter is required'
            });
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
