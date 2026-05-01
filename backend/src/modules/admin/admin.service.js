/**
 * Admin service — rider approvals, user management, transaction oversight, request management, merchant management.
 */

const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');

/**
 * Create an audit log entry.
 */
const createAuditLog = async (adminUserId, action, entityType, entityId, details, ipAddress, userAgent) => {
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

/**
 * List all riders pending approval.
 */
const getPendingRiders = async ({ page = 1, limit = 20 }) => {
  const where = { status: 'PENDING_APPROVAL' };

  const [riders, total] = await Promise.all([
    prisma.rider.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, phone: true, firstName: true, lastName: true } },
      },
    }),
    prisma.rider.count({ where }),
  ]);

  return { riders, total, page, limit };
};

/**
 * Approve or reject a rider.
 */
const reviewRider = async (riderId, decision) => {
  const rider = await prisma.rider.findUnique({ where: { id: riderId } });
  if (!rider) throw AppError.notFound('Rider not found');
  if (rider.status !== 'PENDING_APPROVAL') {
    throw AppError.badRequest('Rider already reviewed');
  }

  const newStatus = decision === 'approve' ? 'APPROVED' : 'REJECTED';

  const updated = await prisma.rider.update({
    where: { id: riderId },
    data: { status: newStatus },
  });

  logger.info('Rider reviewed', { riderId, decision: newStatus });

  // TODO: Send push notification to rider

  return updated;
};

/**
 * List all users with filtering.
 */
const getAllUsers = async ({ page = 1, limit = 20, role, search }) => {
  const where = {
    ...(role && { role }),
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, limit };
};

/**
 * Suspend or activate a user.
 */
const updateUserStatus = async (userId, status) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User not found');

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status },
  });

  // If suspending, also lock their wallet
  if (status === 'SUSPENDED') {
    await prisma.wallet.updateMany({
      where: { userId },
      data: { isLocked: true },
    });
  }

  logger.info('User status updated', { userId, status });

  return updated;
};

/**
 * Get platform-wide transaction overview.
 */
const getTransactionOverview = async ({ page = 1, limit = 50, type, status }) => {
  const where = {
    ...(type && { type }),
    ...(status && { status }),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total, page, limit };
};

/**
 * Get platform dashboard stats.
 */
const getDashboardStats = async () => {
  const [
    totalUsers,
    totalRiders,
    totalMerchants,
    totalRequests,
    activeRequests,
    totalTransactionVolume,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
    prisma.rider.count({ where: { status: 'APPROVED' } }),
    prisma.merchant.count({ where: { status: 'ACTIVE' } }),
    prisma.request.count(),
    prisma.request.count({
      where: { status: { in: ['REQUESTED', 'ACCEPTED', 'PROCESSING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'RIDER_EN_ROUTE', 'PICKED_UP', 'IN_TRANSIT'] } },
    }),
    prisma.transaction.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalUsers,
    totalRiders,
    totalMerchants,
    totalRequests,
    activeRequests,
    totalRevenue: totalTransactionVolume._sum.amount || 0,
  };
};

// ============================================================
// Admin Request Management
// ============================================================

/**
 * List all requests with advanced filtering.
 */
const getAllRequests = async ({ page = 1, limit = 20, type, status, startDate, endDate }) => {
  const where = {
    ...(type && { type }),
    ...(status && { status }),
    ...(startDate && { createdAt: { gte: new Date(startDate) } }),
    ...(endDate && { createdAt: { lte: new Date(endDate) } }),
  };

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        merchant: { select: { id: true, name: true, type: true } },
        rider: { select: { id: true, user: { select: { firstName: true, lastName: true, phone: true } } } },
        items: true,
      },
    }),
    prisma.request.count({ where }),
  ]);

  return { requests, total, page, limit };
};

/**
 * Reassign rider to a request.
 */
const reassignRider = async (requestId, newRiderId) => {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) throw AppError.notFound('Request not found');

  const rider = await prisma.rider.findUnique({ where: { id: newRiderId } });
  if (!rider) throw AppError.notFound('Rider not found');
  if (rider.status !== 'APPROVED') throw AppError.badRequest('Rider is not approved');

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { riderId: newRiderId },
  });

  logger.info('Rider reassigned', { requestId, newRiderId });

  // TODO: Emit socket event to notify new rider

  return updated;
};

/**
 * Force cancel a request with reason.
 */
const forceCancelRequest = async (requestId, reason) => {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) throw AppError.notFound('Request not found');
  if (request.status === 'CANCELLED' || request.status === 'DELIVERED' || request.status === 'SETTLED') {
    throw AppError.badRequest('Cannot cancel request in current status');
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { status: 'CANCELLED' },
  });

  // Create cancellation record
  await prisma.requestHistory.create({
    data: {
      requestId,
      status: 'CANCELLED',
      changedBy: 'ADMIN',
      reason,
    },
  });

  logger.info('Request force cancelled by admin', { requestId, reason });

  // TODO: Emit socket event, process refund if applicable

  return updated;
};

/**
 * Admin override to update request status.
 */
const adminUpdateRequestStatus = async (requestId, status, reason) => {
  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) throw AppError.notFound('Request not found');

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { status },
  });

  // Create history record
  await prisma.requestHistory.create({
    data: {
      requestId,
      status,
      changedBy: 'ADMIN',
      reason,
    },
  });

  logger.info('Request status updated by admin', { requestId, status, reason });

  // TODO: Emit socket event

  return updated;
};

// ============================================================
// Admin Merchant Management
// ============================================================

/**
 * List all merchants with filtering.
 */
const getAllMerchants = async ({ page = 1, limit = 20, type, status }) => {
  const where = {
    ...(type && { type }),
    ...(status && { status }),
  };

  const [merchants, total] = await Promise.all([
    prisma.merchant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        wallet: {
          select: {
            availableBalance: true,
            pendingBalance: true,
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    }),
    prisma.merchant.count({ where }),
  ]);

  return { merchants, total, page, limit };
};

/**
 * Approve a pending merchant.
 */
const approveMerchant = async (merchantId) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw AppError.notFound('Merchant not found');
  if (merchant.status !== 'PENDING') throw AppError.badRequest('Merchant is not pending');

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { status: 'ACTIVE' },
  });

  logger.info('Merchant approved', { merchantId });

  // TODO: Send notification to merchant

  return updated;
};

/**
 * Reject a pending merchant.
 */
const rejectMerchant = async (merchantId, reason) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw AppError.notFound('Merchant not found');
  if (merchant.status !== 'PENDING') throw AppError.badRequest('Merchant is not pending');

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { status: 'REJECTED' },
  });

  logger.info('Merchant rejected', { merchantId, reason });

  // TODO: Send notification to merchant

  return updated;
};

/**
 * Suspend a merchant.
 */
const suspendMerchant = async (merchantId, reason) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw AppError.notFound('Merchant not found');
  if (merchant.status === 'SUSPENDED') throw AppError.badRequest('Merchant is already suspended');

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { status: 'SUSPENDED' },
  });

  // Lock merchant wallet
  await prisma.merchantWallet.update({
    where: { merchantId },
    data: { isLocked: true },
  });

  logger.info('Merchant suspended', { merchantId, reason });

  // TODO: Send notification to merchant

  return updated;
};

/**
 * Unsuspend a merchant.
 */
const unsuspendMerchant = async (merchantId) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw AppError.notFound('Merchant not found');
  if (merchant.status !== 'SUSPENDED') throw AppError.badRequest('Merchant is not suspended');

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { status: 'ACTIVE' },
  });

  // Unlock merchant wallet
  await prisma.merchantWallet.update({
    where: { merchantId },
    data: { isLocked: false },
  });

  logger.info('Merchant unsuspended', { merchantId });

  // TODO: Send notification to merchant

  return updated;
};

/**
 * Update merchant commission rate.
 */
const updateMerchantCommission = async (merchantId, commissionRate) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw AppError.notFound('Merchant not found');

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { commissionRate },
  });

  logger.info('Merchant commission updated', { merchantId, commissionRate });

  return updated;
};

// ============================================================
// Admin Rider Management
// ============================================================

/**
 * List all riders with filtering.
 */
const getAllRiders = async ({ page = 1, limit = 20, status, availability }) => {
  const where = {
    ...(status && { status }),
    ...(availability && { availability }),
  };

  const [riders, total] = await Promise.all([
    prisma.rider.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    }),
    prisma.rider.count({ where }),
  ]);

  return { riders, total, page, limit };
};

/**
 * Get rider earnings.
 */
const getRiderEarnings = async (riderId, { startDate, endDate }) => {
  const rider = await prisma.rider.findUnique({ where: { id: riderId } });
  if (!rider) throw AppError.notFound('Rider not found');

  const where = {
    riderId,
    ...(startDate && { createdAt: { gte: new Date(startDate) } }),
    ...(endDate && { createdAt: { lte: new Date(endDate) } }),
  };

  const [earnings, completedDeliveries, totalEarnings] = await Promise.all([
    prisma.transaction.findMany({
      where: { ...where, type: 'DELIVERY_EARNING' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.request.count({
      where: { riderId, status: 'DELIVERED' },
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: 'DELIVERY_EARNING' },
      _sum: { amount: true },
    }),
  ]);

  return {
    earnings,
    completedDeliveries,
    totalEarnings: totalEarnings._sum.amount || 0,
  };
};

/**
 * Get rider delivery history.
 */
const getRiderDeliveryHistory = async (riderId, { page = 1, limit = 20 }) => {
  const rider = await prisma.rider.findUnique({ where: { id: riderId } });
  if (!rider) throw AppError.notFound('Rider not found');

  const [deliveries, total] = await Promise.all([
    prisma.request.findMany({
      where: { riderId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
      },
    }),
    prisma.request.count({ where: { riderId } }),
  ]);

  return { deliveries, total, page, limit };
};

// ============================================================
// Platform Settings
// ============================================================

/**
 * Get platform settings.
 */
const getPlatformSettings = async () => {
  // In a real implementation, these would be fetched from a settings table or environment variables
  // For now, return default settings
  return {
    platformName: 'VTU Logistics',
    defaultCurrency: 'NGN',
    timezone: 'Africa/Lagos',
    defaultMerchantCommission: 15,
    defaultRiderCommission: 10,
    minDeliveryFee: 500,
    maxDeliveryFee: 5000,
    supportEmail: 'support@vtulogistics.com',
    supportPhone: '+2348000000000',
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    newOrderAlerts: true,
    riderStatusAlerts: true,
    paymentAlerts: true,
  };
};

/**
 * Update platform settings.
 */
const updatePlatformSettings = async (settings) => {
  // In a real implementation, these would be stored in a settings table or environment variables
  // For now, we'll just log the change
  logger.info('Platform settings updated', { settings });

  return { success: true, settings };
};

// ============================================================
// Audit Log
// ============================================================

/**
 * Get audit logs with filters.
 */
const getAuditLogs = async ({ page = 1, limit = 20, action, entityType, startDate, endDate }) => {
  const where = {};

  if (action) {
    where.action = { contains: action, mode: 'insensitive' };
  }

  if (entityType) {
    where.entityType = entityType;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      where.createdAt.lte = new Date(endDate);
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        adminUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page, limit };
};

module.exports = {
  getPendingRiders,
  reviewRider,
  getAllUsers,
  updateUserStatus,
  getTransactionOverview,
  getDashboardStats,
  getAllRequests,
  reassignRider,
  forceCancelRequest,
  adminUpdateRequestStatus,
  getAllMerchants,
  approveMerchant,
  rejectMerchant,
  suspendMerchant,
  unsuspendMerchant,
  updateMerchantCommission,
  getAllRiders,
  getRiderEarnings,
  getRiderDeliveryHistory,
  getPlatformSettings,
  updatePlatformSettings,
  createAuditLog,
  getAuditLogs,
};
