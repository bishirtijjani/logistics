/**
 * Audit log helper - shared between admin and support modules so neither
 * has to import the other (which would create a circular dependency).
 */

const { prisma } = require('../config/database');

const createAuditLog = async (
  adminUserId,
  action,
  entityType,
  entityId,
  details,
  ipAddress,
  userAgent,
) => {
  await prisma.auditLog.create({
    data: {
      adminUserId,
      action,
      entityType,
      entityId,
      details,
      ipAddress,
      userAgent,
    },
  });
};

module.exports = { createAuditLog };
