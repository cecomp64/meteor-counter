// Get full session details including observations
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
        const sessionId = params.sessionId;

        if (!sessionId) {
            return createResponse(400, { error: 'sessionId parameter is required' });
        }

        // Get session
        const sessions = await sql`
            SELECT
                id, start_time, end_time, duration, total_observations, notes,
                location_latitude, location_longitude, location_accuracy,
                location_privacy, device_id, created_at, updated_at
            FROM sessions
            WHERE id = ${sessionId}
        `;

        if (sessions.length === 0) {
            return createResponse(404, { error: 'Session not found' });
        }

        const session = sessions[0];

        // Get observations for this session
        const observations = await sql`
            SELECT
                id, timestamp, duration, intensity,
                location_latitude, location_longitude, created_at
            FROM observations
            WHERE session_id = ${sessionId}
            ORDER BY timestamp ASC
        `;

        return createResponse(200, {
            success: true,
            session: {
                ...session,
                observations: observations
            }
        });

    } catch (error) {
        console.error('Get session details error:', error);
        return createResponse(500, {
            error: 'Failed to get session details',
            message: error.message
        });
    }
};
