// Migrate Device Sessions to User Account
// This endpoint migrates all anonymous sessions from a device to a user account
const { getDbClient } = require('./db-utils');
const { getAuthenticatedUserId } = require('./auth-utils');

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get authenticated user ID
    const userId = getAuthenticatedUserId(event);

    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Authentication required' })
      };
    }

    // Parse request body
    const { deviceId } = JSON.parse(event.body);

    if (!deviceId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'deviceId is required' })
      };
    }

    // Get database client
    const client = await getDbClient();

    // Migrate all anonymous sessions from this device to the user
    // Only migrate sessions that:
    // 1. Have this device_id
    // 2. Have NULL user_id (anonymous)
    const result = await client.query(
      `UPDATE sessions
       SET user_id = $1, updated_at = NOW()
       WHERE device_id = $2 AND user_id IS NULL
       RETURNING id`,
      [userId, deviceId]
    );

    const migratedCount = result.rows.length;

    console.log(`Migrated ${migratedCount} anonymous sessions from device ${deviceId} to user ${userId}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        migratedCount,
        message: `${migratedCount} session(s) linked to your account`
      })
    };

  } catch (error) {
    console.error('Migration error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Migration failed', details: error.message })
    };
  }
  // Note: Pool connections are reused, not closed after each request
};
