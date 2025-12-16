// Sync a session to the remote database
const { getDb, applyLocationPrivacy, createResponse } = require('./db-utils');
const { getAuthenticatedUserId } = require('./auth-utils');

exports.handler = async (event) => {
    // Handle OPTIONS request for CORS
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(200, {});
    }

    if (event.httpMethod !== 'POST') {
        return createResponse(405, { error: 'Method not allowed' });
    }

    try {
        const sql = getDb();
        const body = JSON.parse(event.body);

        // Check if user is authenticated
        const userId = getAuthenticatedUserId(event);

        const {
            localSessionId,
            remoteSessionId, // null if first sync
            startTime,
            endTime,
            duration,
            totalObservations,
            notes,
            location,
            locationPrivacy = 'full',
            deviceId,
            observations = []
        } = body;

        // Apply location privacy
        const privacyLocation = applyLocationPrivacy(location, locationPrivacy);

        let sessionId;
        let isNewSession = false;

        // Check if this is an update or a new session
        if (remoteSessionId) {
            // Update existing session
            const result = await sql`
                UPDATE sessions SET
                    end_time = ${endTime},
                    duration = ${duration},
                    total_observations = ${totalObservations},
                    notes = ${notes},
                    location_latitude = ${privacyLocation.latitude},
                    location_longitude = ${privacyLocation.longitude},
                    location_accuracy = ${location?.accuracy || null},
                    location_privacy = ${locationPrivacy},
                    user_id = ${userId}
                WHERE id = ${remoteSessionId}
                RETURNING id, created_at, updated_at
            `;

            if (result.length === 0) {
                return createResponse(404, { error: 'Session not found' });
            }

            sessionId = remoteSessionId;
        } else {
            // Create new session
            const result = await sql`
                INSERT INTO sessions (
                    start_time, end_time, duration, total_observations, notes,
                    location_latitude, location_longitude, location_accuracy,
                    location_privacy, device_id, user_id
                )
                VALUES (
                    ${startTime}, ${endTime}, ${duration}, ${totalObservations}, ${notes},
                    ${privacyLocation.latitude}, ${privacyLocation.longitude}, ${location?.accuracy || null},
                    ${locationPrivacy}, ${deviceId}, ${userId}
                )
                RETURNING id, created_at, updated_at
            `;

            sessionId = result[0].id;
            isNewSession = true;
        }

        // Sync observations
        const syncedObservations = [];

        for (const obs of observations) {
            if (obs.remoteId) {
                // Update existing observation (shouldn't normally happen, but handle it)
                await sql`
                    UPDATE observations SET
                        timestamp = ${obs.timestamp},
                        duration = ${obs.duration},
                        intensity = ${obs.intensity},
                        location_latitude = ${obs.location?.latitude || null},
                        location_longitude = ${obs.location?.longitude || null}
                    WHERE id = ${obs.remoteId}
                `;
                syncedObservations.push({
                    localId: obs.localId,
                    remoteId: obs.remoteId
                });
            } else {
                // Create new observation
                const obsResult = await sql`
                    INSERT INTO observations (
                        session_id, timestamp, duration, intensity,
                        location_latitude, location_longitude
                    )
                    VALUES (
                        ${sessionId}, ${obs.timestamp}, ${obs.duration}, ${obs.intensity},
                        ${obs.location?.latitude || null}, ${obs.location?.longitude || null}
                    )
                    RETURNING id
                `;
                syncedObservations.push({
                    localId: obs.localId,
                    remoteId: obsResult[0].id
                });
            }
        }

        return createResponse(200, {
            success: true,
            session: {
                localId: localSessionId,
                remoteId: sessionId,
                isNew: isNewSession
            },
            observations: syncedObservations
        });

    } catch (error) {
        console.error('Sync error:', error);
        return createResponse(500, {
            error: 'Failed to sync session',
            message: error.message
        });
    }
};
