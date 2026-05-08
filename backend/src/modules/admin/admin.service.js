/**
 * Admin service — rider approvals, user management, transaction oversight, request management, merchant management.
 */

const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const katpayService = require('../../services/katpay.service');

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

// ============================================================
// Platform Analytics Functions
// ============================================================

/**
 * Get platform revenue analytics
 */
const getRevenueAnalytics = async ({ startDate, endDate, groupBy = 'day' }) => {
  const where = {
    status: 'COMPLETED',
    ...(startDate && { createdAt: { gte: new Date(startDate) } }),
    ...(endDate && { createdAt: { lte: new Date(endDate) } }),
  };

  const [totalRevenue, revenueByMerchant, revenueTrend] = await Promise.all([
    prisma.transaction.aggregate({
      where,
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.groupBy({
      by: ['merchantId'],
      where,
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    }),
    prisma.$queryRaw`
      SELECT 
        DATE(createdAt) as date,
        SUM(amount) as revenue,
        COUNT(*) as transactions
      FROM "Transaction"
      WHERE status = 'COMPLETED'
        ${startDate ? prisma.$queryRaw`AND createdAt >= ${new Date(startDate)}` : prisma.$queryRaw``}
        ${endDate ? prisma.$queryRaw`AND createdAt <= ${new Date(endDate)}` : prisma.$queryRaw``}
      GROUP BY DATE(createdAt)
      ORDER BY date DESC
      LIMIT 30
    `,
  ]);

  return {
    totalRevenue: totalRevenue._sum.amount || 0,
    totalTransactions: totalRevenue._count || 0,
    topMerchants: revenueByMerchant,
    revenueTrend: revenueTrend,
  };
};

/**
 * Get platform order analytics
 */
const getOrderAnalytics = async ({ startDate, endDate }) => {
  const where = {
    ...(startDate && { createdAt: { gte: new Date(startDate) } }),
    ...(endDate && { createdAt: { lte: new Date(endDate) } }),
  };

  const [totalOrders, ordersByStatus, ordersByType, avgDeliveryTime, cancellationRate] = await Promise.all([
    prisma.request.count({ where }),
    prisma.request.groupBy({
      by: ['status'],
      where,
      _count: true,
    }),
    prisma.request.groupBy({
      by: ['type'],
      where,
      _count: true,
    }),
    prisma.request.aggregate({
      where: { ...where, status: 'COMPLETED' },
      _avg: { deliveryTime: true },
    }),
    prisma.request.aggregate({
      where: { ...where, status: 'CANCELLED' },
      _count: true,
    }),
  ]);

  return {
    totalOrders,
    ordersByStatus,
    ordersByType,
    avgDeliveryTime: avgDeliveryTime._avg.deliveryTime || 0,
    cancellationRate: totalOrders > 0 ? (cancellationRate._count / totalOrders) * 100 : 0,
  };
};

/**
 * Get platform customer analytics
 */
const getCustomerAnalytics = async ({ startDate, endDate }) => {
  const where = {
    role: 'CUSTOMER',
    deletedAt: null,
    ...(startDate && { createdAt: { gte: new Date(startDate) } }),
    ...(endDate && { createdAt: { lte: new Date(endDate) } }),
  };

  const [totalCustomers, newCustomers, topCustomersByOrders, customerRetention] = await Promise.all([
    prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
    prisma.user.count({ where }),
    prisma.$queryRaw`
      SELECT 
        u.id,
        u.firstName,
        u.lastName,
        u.email,
        COUNT(r.id) as orderCount,
        SUM(t.amount) as totalSpent
      FROM "User" u
      LEFT JOIN "Request" r ON u.id = r.customerId
      LEFT JOIN "Transaction" t ON r.id = t.requestId
      WHERE u.role = 'CUSTOMER' AND u.deletedAt IS NULL
      GROUP BY u.id, u.firstName, u.lastName, u.email
      ORDER BY orderCount DESC
      LIMIT 10
    `,
    prisma.$queryRaw`
      SELECT 
        COUNT(DISTINCT customer_id) as returningCustomers,
        COUNT(DISTINCT customer_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as newCustomers
      FROM "Request"
    `,
  ]);

  return {
    totalCustomers,
    newCustomers,
    topCustomers: topCustomersByOrders,
    retention: customerRetention[0] || { returningCustomers: 0, newCustomers: 0 },
  };
};

/**
 * Get geographic analytics
 */
const getGeographicAnalytics = async ({ startDate, endDate }) => {
  const where = {
    ...(startDate && { createdAt: { gte: new Date(startDate) } }),
    ...(endDate && { createdAt: { lte: new Date(endDate) } }),
  };

  const [ordersByLocation, merchantDistribution] = await Promise.all([
    prisma.$queryRaw`
      SELECT 
        ROUND(dropoff_lat::numeric, 2) as lat,
        ROUND(dropoff_lng::numeric, 2) as lng,
        COUNT(*) as orderCount
      FROM "Request"
      WHERE dropoff_lat IS NOT NULL AND dropoff_lng IS NOT NULL
        ${startDate ? prisma.$queryRaw`AND created_at >= ${new Date(startDate)}` : prisma.$queryRaw``}
        ${endDate ? prisma.$queryRaw`AND created_at <= ${new Date(endDate)}` : prisma.$queryRaw``}
      GROUP BY ROUND(dropoff_lat::numeric, 2), ROUND(dropoff_lng::numeric, 2)
      ORDER BY orderCount DESC
      LIMIT 20
    `,
    prisma.$queryRaw`
      SELECT 
        m.type,
        m.name,
        COUNT(r.id) as orderCount,
        SUM(t.amount) as totalRevenue
      FROM "Merchant" m
      LEFT JOIN "Request" r ON m.id = r.merchantId
      LEFT JOIN "Transaction" t ON r.id = t.requestId
      WHERE m.status = 'ACTIVE'
        ${startDate ? prisma.$queryRaw`AND r.created_at >= ${new Date(startDate)}` : prisma.$queryRaw``}
        ${endDate ? prisma.$queryRaw`AND r.created_at <= ${new Date(endDate)}` : prisma.$queryRaw``}
      GROUP BY m.id, m.type, m.name
      ORDER BY totalRevenue DESC
    `,
  ]);

  return {
    ordersByLocation,
    merchantDistribution,
  };
};

/**
 * Get real-time platform metrics
 */
const getRealtimeMetrics = async () => {
  const [activeRequests, recentOrders, systemHealth] = await Promise.all([
    prisma.request.count({
      where: { status: { in: ['REQUESTED', 'ACCEPTED', 'PROCESSING', 'RIDER_EN_ROUTE', 'IN_TRANSIT'] } },
    }),
    prisma.request.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { customer: true, merchant: true },
    }),
    {
      activeRiders: await prisma.rider.count({ where: { status: 'APPROVED', isAvailable: true } }),
      activeMerchants: await prisma.merchant.count({ where: { status: 'ACTIVE', isOpen: true } }),
    },
  ]);

  return {
    activeRequests,
    recentOrders,
    systemHealth,
  };
};

// ============================================================
// Financial Operations - Withdrawal Management
// ============================================================

/**
 * Get pending withdrawal requests
 */
const getPendingWithdrawals = async ({ page = 1, limit = 20 }) => {
  const skip = (page - 1) * limit;

  const [withdrawals, total] = await Promise.all([
    prisma.merchantWalletTransaction.findMany({
      where: {
        type: 'WITHDRAWAL',
        status: 'PENDING',
      },
      include: {
        merchantWallet: {
          include: {
            merchant: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.merchantWalletTransaction.count({
      where: {
        type: 'WITHDRAWAL',
        status: 'PENDING',
      },
    }),
  ]);

  return { withdrawals, total, page, limit };
};

/**
 * Approve withdrawal request — triggers KatPay payout.
 */
const approveWithdrawal = async (withdrawalId) => {
  const withdrawal = await prisma.merchantWalletTransaction.findUnique({
    where: { id: withdrawalId },
    include: {
      merchantWallet: {
        include: { merchant: true },
      },
    },
  });

  if (!withdrawal) throw new Error('Withdrawal not found');
  if (withdrawal.status !== 'PENDING') throw new Error('Withdrawal is not in pending status');

  // Initiate KatPay payout
  const payout = await katpayService.initiatePayout({
    amount: Number(withdrawal.amount),
    bank_code: withdrawal.bankCode,
    account_number: withdrawal.accountNumber,
    account_name: withdrawal.accountName,
    reference: withdrawal.reference,
    description: `Merchant payout — ${withdrawal.merchantWallet.merchantId}`,
  });

  // Mark as PROCESSING with KatPay reference; final COMPLETED arrives via webhook
  const updatedWithdrawal = await prisma.merchantWalletTransaction.update({
    where: { id: withdrawalId },
    data: {
      status: 'PROCESSING',
      katpayReference: payout?.reference || payout?.id || withdrawal.reference,
      processedAt: new Date(),
    },
  });

  // Release pending balance — deducted once KatPay confirms via webhook payout.processed
  // (webhook handler handles the final pendingBalance decrement)

  await createAuditLog({
    action: 'APPROVE_WITHDRAWAL',
    entityType: 'MerchantWalletTransaction',
    entityId: withdrawalId,
    details: {
      amount: withdrawal.amount,
      merchantId: withdrawal.merchantWallet.merchantId,
      katpayReference: updatedWithdrawal.katpayReference,
    },
  });

  logger.info('Merchant withdrawal approved and payout initiated', {
    withdrawalId,
    reference: withdrawal.reference,
    amount: withdrawal.amount,
  });

  return updatedWithdrawal;
};

/**
 * Reject withdrawal request
 */
const rejectWithdrawal = async (withdrawalId, reason) => {
  const withdrawal = await prisma.merchantWalletTransaction.findUnique({
    where: { id: withdrawalId },
    include: {
      merchantWallet: true,
    },
  });

  if (!withdrawal) {
    throw new Error('Withdrawal not found');
  }

  if (withdrawal.status !== 'PENDING') {
    throw new Error('Withdrawal is not in pending status');
  }

  // Update withdrawal status and refund atomically
  const [updatedWithdrawal] = await prisma.$transaction([
    prisma.merchantWalletTransaction.update({
      where: { id: withdrawalId },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        processedAt: new Date(),
      },
    }),
    prisma.merchantWallet.update({
      where: { id: withdrawal.merchantWalletId },
      data: {
        availableBalance: { increment: withdrawal.amount },
        pendingBalance: { decrement: withdrawal.amount },
      },
    }),
  ]);

  // Create audit log
  await createAuditLog({
    action: 'REJECT_WITHDRAWAL',
    entityType: 'MerchantWalletTransaction',
    entityId: withdrawalId,
    details: {
      amount: withdrawal.amount,
      reason,
      merchantId: withdrawal.merchantWallet.merchantId,
    },
  });

  return updatedWithdrawal;
};

/**
 * Get withdrawal history
 */
const getWithdrawalHistory = async ({ page = 1, limit = 20, status, startDate, endDate }) => {
  const skip = (page - 1) * limit;
  const where = {
    type: 'WITHDRAWAL',
    ...(status && { status }),
    ...(startDate && { createdAt: { gte: new Date(startDate) } }),
    ...(endDate && { createdAt: { lte: new Date(endDate) } }),
  };

  const [withdrawals, total] = await Promise.all([
    prisma.merchantWalletTransaction.findMany({
      where,
      include: {
        merchantWallet: {
          include: {
            merchant: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.merchantWalletTransaction.count({ where }),
  ]);

  return { withdrawals, total, page, limit };
};

// ============================================================
// Dispute Resolution
// ============================================================

const getDisputes = async ({ page = 1, limit = 20, status }) => {
  const skip = (page - 1) * limit;
  const where = {
    ...(status && { status }),
  };

  const [disputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      include: {
        request: {
          include: {
            customer: true,
            merchant: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dispute.count({ where }),
  ]);

  return { disputes, total, page, limit };
};

const resolveDispute = async (disputeId, resolution, notes) => {
  const dispute = await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: 'RESOLVED',
      resolution,
      notes,
      resolvedAt: new Date(),
    },
  });

  await createAuditLog({
    action: 'RESOLVE_DISPUTE',
    entityType: 'Dispute',
    entityId: disputeId,
    details: { resolution, notes },
  });

  return dispute;
};

// ============================================================
// Support Management
// ============================================================

const getSupportTickets = async ({ page = 1, limit = 20, status }) => {
  const skip = (page - 1) * limit;
  const where = {
    ...(status && { status }),
  };

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return { tickets, total, page, limit };
};

const updateTicketStatus = async (ticketId, status, notes) => {
  const ticket = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status, notes },
  });

  await createAuditLog({
    action: 'UPDATE_TICKET_STATUS',
    entityType: 'SupportTicket',
    entityId: ticketId,
    details: { status, notes },
  });

  return ticket;
};

// ============================================================
// Marketing Oversight
// ============================================================

const getPlatformCampaigns = async ({ page = 1, limit = 20 }) => {
  const skip = (page - 1) * limit;

  const [campaigns, total] = await Promise.all([
    prisma.platformCampaign.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.platformCampaign.count(),
  ]);

  return { campaigns, total, page, limit };
};

const getDiscountCodes = async ({ page = 1, limit = 20, status }) => {
  const skip = (page - 1) * limit;
  const where = {
    ...(status && { status }),
  };

  const [discounts, total] = await Promise.all([
    prisma.discountCode.findMany({
      where,
      include: {
        merchant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.discountCode.count({ where }),
  ]);

  return { discounts, total, page, limit };
};

const approveDiscountCode = async (discountId) => {
  const discount = await prisma.discountCode.update({
    where: { id: discountId },
    data: { status: 'APPROVED' },
  });

  await createAuditLog({
    action: 'APPROVE_DISCOUNT',
    entityType: 'DiscountCode',
    entityId: discountId,
    details: { code: discount.code },
  });

  return discount;
};

const rejectDiscountCode = async (discountId, reason) => {
  const discount = await prisma.discountCode.update({
    where: { id: discountId },
    data: { 
      status: 'REJECTED',
      rejectionReason: reason,
    },
  });

  await createAuditLog({
    action: 'REJECT_DISCOUNT',
    entityType: 'DiscountCode',
    entityId: discountId,
    details: { code: discount.code, reason },
  });

  return discount;
};

// ============================================================
// Rider Operations
// ============================================================

const getRiderPerformance = async ({ page = 1, limit = 20, startDate, endDate }) => {
  const skip = (page - 1) * limit;
  const where = {
    ...(startDate && { createdAt: { gte: new Date(startDate) } }),
    ...(endDate && { createdAt: { lte: new Date(endDate) } }),
  };

  const [riders, total] = await Promise.all([
    prisma.rider.findMany({
      where: { status: 'APPROVED' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: {
          select: {
            deliveries: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.rider.count({ where: { status: 'APPROVED' } }),
  ]);

  return { riders, total, page, limit };
};

const getRiderRealtimeLocation = async () => {
  const riders = await prisma.rider.findMany({
    where: {
      status: 'APPROVED',
      isAvailable: true,
      currentLat: { not: null },
      currentLng: { not: null },
    },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    take: 50,
  });

  return riders;
};

// ============================================================
// Safety & Compliance Monitoring
// ============================================================

const getSafetyIncidents = async ({ page = 1, limit = 20, status }) => {
  const skip = (page - 1) * limit;
  const where = {
    ...(status && { status }),
  };

  const [incidents, total] = await Promise.all([
    prisma.safetyIncident.findMany({
      where,
      include: {
        request: {
          include: {
            customer: true,
            rider: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.safetyIncident.count({ where }),
  ]);

  return { incidents, total, page, limit };
};

const getComplianceReport = async () => {
  const [
    totalRiders,
    compliantRiders,
    totalMerchants,
    compliantMerchants,
    recentIncidents,
  ] = await Promise.all([
    prisma.rider.count({ where: { status: 'APPROVED' } }),
    prisma.rider.count({ where: { status: 'APPROVED', isVerified: true } }),
    prisma.merchant.count({ where: { status: 'ACTIVE' } }),
    prisma.merchant.count({ where: { status: 'ACTIVE', isCompliant: true } }),
    prisma.safetyIncident.count({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  return {
    riderCompliance: totalRiders > 0 ? (compliantRiders / totalRiders) * 100 : 0,
    merchantCompliance: totalMerchants > 0 ? (compliantMerchants / totalMerchants) * 100 : 0,
    recentIncidents,
  };
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
  getRevenueAnalytics,
  getOrderAnalytics,
  getCustomerAnalytics,
  getGeographicAnalytics,
  getRealtimeMetrics,
};
