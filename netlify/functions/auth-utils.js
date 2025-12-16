// Authentication Utility Functions
const jwt = require('jsonwebtoken');

// JWT secret - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'meteor-observer-secret-change-in-production';

/**
 * Verify JWT token from request headers
 * @param {Object} event - Netlify function event object
 * @returns {Object} - { valid: boolean, userId: string|null, error: string|null }
 */
function verifyToken(event) {
  try {
    // Get token from Authorization header
    const authHeader = event.headers.authorization || event.headers.Authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { valid: false, userId: null, error: 'No token provided' };
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return { valid: true, userId: decoded.userId, error: null };
    } catch (jwtError) {
      return { valid: false, userId: null, error: 'Invalid or expired token' };
    }

  } catch (error) {
    return { valid: false, userId: null, error: error.message };
  }
}

/**
 * Check if request is authenticated (has valid token)
 * Returns user ID if authenticated, null otherwise
 * @param {Object} event - Netlify function event object
 * @returns {string|null} - User ID if authenticated, null otherwise
 */
function getAuthenticatedUserId(event) {
  const result = verifyToken(event);
  return result.valid ? result.userId : null;
}

module.exports = {
  verifyToken,
  getAuthenticatedUserId,
  JWT_SECRET
};
