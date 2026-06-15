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
const { PERMISSIONS } = require('../config/permissions');

const VALID_ROLES = ['CUSTOMER', 'RIDER', 'ADMIN', 'MERCHANT'];

/**
 * Creates a middleware that checks if req.user.role is in the allowed roles
 * AND optionally checks for specific permissions if the user is an ADMIN.
 * 
 * USAGE:
 *   authorize('ADMIN') -> Any admin allowed
 *   authorize('ADMIN', 'MANAGE_USERS') -> Admin must have MANAGE_USERS or ALL
 *   authorize('CUSTOMER', 'ADMIN') -> Customer or Any Admin allowed
 * 
 * @param  {...string} args - Roles and/or Permissions
 * @returns {Function} Express middleware
 */
const authorize = (...args) => {
  const allowedRoles = args.filter(a => VALID_ROLES.includes(a));
  const requiredPermissions = args.filter(a => !VALID_ROLES.includes(a));

  return (req, _res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    // 1. Role Check
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Access denied. Required role: ${allowedRoles.join(' or ')}`
        )
      );
    }

    // 2. Permission Check (Only for ADMINs and only if permissions were specified)
    if (req.user.role === 'ADMIN' && requiredPermissions.length > 0) {
      const userPerms = req.user.permissions;
      // null/undefined permissions = legacy super admin (full access). An
      // explicit empty array [] means "no permissions" and is denied below.
      const hasAll = userPerms == null || userPerms.includes(PERMISSIONS.ALL);
      const hasAnyRequired = Array.isArray(userPerms) && requiredPermissions.some(p => userPerms.includes(p));

      if (!hasAll && !hasAnyRequired) {
        return next(
          AppError.forbidden(
            `Access denied. Missing one of the following permissions: ${requiredPermissions.join(', ')}`
          )
        );
      }
    }

    next();
  };
};

module.exports = { authorize };
