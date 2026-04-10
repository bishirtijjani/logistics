/**
 * Role-based access control middleware.
 *
 * Restricts route access to specific user roles.
 * Must be used AFTER authenticate middleware.
 *
 * USAGE:
 *   const { authorize } = require('../middlewares/role.middleware');
 *   router.post('/approve', authenticate, authorize('ADMIN'), controller.approve);
 *   router.get('/orders', authenticate, authorize('CUSTOMER', 'ADMIN'), controller.list);
 */

const { AppError } = require('../utils/api-error');

/**
 * Creates a middleware that checks if req.user.role is in the allowed roles.
 * @param  {...string} allowedRoles - One or more roles: 'CUSTOMER', 'RIDER', 'ADMIN'
 * @returns {Function} Express middleware
 */
const authorize = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`
        )
      );
    }

    next();
  };
};

module.exports = { authorize };
