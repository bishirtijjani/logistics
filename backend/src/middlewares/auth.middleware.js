/**
 * JWT authentication middleware.
 *
 * Verifies the Bearer token from the Authorization header.
 * Attaches the decoded user payload to req.user.
 *
 * USAGE in routes:
 *   const { authenticate } = require('../middlewares/auth.middleware');
 *   router.get('/profile', authenticate, controller.getProfile);
 */

const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { AppError } = require('../utils/api-error');

/**
 * Extracts and verifies JWT access token.
 * Sets req.user = { id, role, phone }
 */
const authenticate = (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];

    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);

    req.user = {
      id: decoded.id,
      role: decoded.role,
      phone: decoded.phone,
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    if (error.name === 'TokenExpiredError') {
      return next(AppError.unauthorized('Token expired'));
    }
    if (error.name === 'JsonWebTokenError') {
      return next(AppError.unauthorized('Invalid token'));
    }
    next(AppError.unauthorized('Authentication failed'));
  }
};

module.exports = { authenticate };
