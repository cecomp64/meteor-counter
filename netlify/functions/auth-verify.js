// Token Verification Function
const jwt = require('jsonwebtoken');
const { getDbClient } = require('./db-utils');

// JWT secret - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'meteor-observer-secret-change-in-production';

exports.handler = async (event) => {
  // Only allow GET or POST
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let client;

  try {
    // Get token from Authorization header
    const authHeader = event.headers.authorization || event.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'No token provided' })
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid or expired token' })
      };
    }

    // Get database client
    client = await getDbClient();

    // Fetch user data from database
    const result = await client.query(
      'SELECT id, email, email_verified, created_at, last_login FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'User not found' })
      };
    }

    const user = result.rows[0];

    return {
      statusCode: 200,
      body: JSON.stringify({
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.email_verified,
          createdAt: user.created_at,
          lastLogin: user.last_login
        }
      })
    };

  } catch (error) {
    console.error('Token verification error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Verification failed', details: error.message })
    };
  } finally {
    // Close database connection
    if (client && client.end) {
      await client.end();
    }
  }
};
