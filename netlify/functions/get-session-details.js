// Get full session details including observations
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
        const sessionId = params.sessionId;
        const deviceId = params.deviceId; // For anonymous access

        if (!sessionId) {
            return createResponse(400, { error: 'sessionId parameter is required' });
        }

        // Check if user is authenticated
        const userId = getAuthenticatedUserId(event);

        // Get session with ownership check
        let sessions;
        if (userId) {
            // Authenticated user - check user_id
            sessions = await sql`
                SELECT
                    id, start_time, end_time, duration, total_observations, notes,
                    location_latitude, location_longitude, location_accuracy,
                    location_privacy, device_id, user_id, created_at, updated_at
                FROM sessions
                WHERE id = ${sessionId} AND user_id = ${userId}
            `;
        } else if (deviceId) {
            // Anonymous user - check device_id
            sessions = await sql`
                SELECT
                    id, start_time, end_time, duration, total_observations, notes,
                    location_latitude, location_longitude, location_accuracy,
                    location_privacy, device_id, created_at, updated_at
                FROM sessions
                WHERE id = ${sessionId} AND device_id = ${deviceId} AND user_id IS NULL
            `;
        } else {
            return createResponse(400, {
                error: 'Either authentication or deviceId parameter is required'
            });
        }

        if (sessions.length === 0) {
            return createResponse(404, { error: 'Session not found or access denied' });
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

        // Transform observations to match client-expected format
        const transformedObservations = observations.map(obs => ({
            id: obs.id,
            timestamp: obs.timestamp,
            duration: obs.duration,
            intensity: obs.intensity,
            location: (obs.location_latitude !== null && obs.location_longitude !== null) ? {
                latitude: obs.location_latitude,
                longitude: obs.location_longitude
            } : null,
            created_at: obs.created_at
        }));

        return createResponse(200, {
            success: true,
            session: {
                ...session,
                observations: transformedObservations
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
