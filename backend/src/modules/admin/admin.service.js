/**
 * Admin service — rider approvals, user management, transaction oversight, request management, merchant management.
 */

const { prisma } = require('../../config/database');
const { Prisma } = require('@prisma/client');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const katpayService = require('../../services/katpay.service');
const emailService = require('../../services/email.service');

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
 * List all customers with optional search.
 */
const getAllCustomers = async ({ page = 1, limit = 20, search }) => {
  const where = {
    role: 'CUSTOMER',
    ...(search && {
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [customers, total] = await Promise.all([
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

  return { customers, total, page, limit };
};

/**
 * Suspend or activate a customer. Refuses to act on non-CUSTOMER users —
 * merchants/riders have their own status endpoints.
 */
const updateCustomerStatus = async (customerId, status) => {
  const user = await prisma.user.findUnique({ where: { id: customerId } });
  if (!user) throw AppError.notFound('Customer not found');
  if (user.role !== 'CUSTOMER') throw AppError.badRequest('Not a customer account');

  const userId = customerId; // alias used by the socket-auth invalidation below
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status },
  });

  if (status === 'SUSPENDED') {
    await prisma.wallet.updateMany({
      where: { userId },
      data: { isLocked: true },
    });
  }

  logger.info('Customer status updated', { customerId, status });

  // Drop the socket-auth cache so the user's existing socket connections are
  // refused on their next reconnect (within seconds via Socket.IO retry).
  try {
    const { invalidateUserAuthCache, getIO } = require('../../sockets');
    invalidateUserAuthCache(userId);
    // Also force-disconnect any currently-open socket from this user — they
    // are in the `user:{userId}` room, so we ask every connection in that
    // room to terminate. They'll attempt to reconnect and be rejected at
    // handshake by the auth middleware.
    if (status === 'SUSPENDED' || status === 'DEACTIVATED') {
      try {
        const io = getIO();
        io.in(`user:${userId}`).disconnectSockets();
      } catch (_) {}
    }
  } catch (_) {}

  return updated;
};

/**
 * Get a single customer with profile, wallet, and lightweight activity counts.
 * Rejects non-CUSTOMER roles so admins can't accidentally use customer-only
 * endpoints to peek at merchant/rider records.
 */
const getCustomerById = async (customerId) => {
  const user = await prisma.user.findFirst({
    where: { id: customerId, role: 'CUSTOMER' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      profilePicture: true,
      dateOfBirth: true,
      kycStatus: true,
      role: true,
      status: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
      wallet: {
        select: {
          id: true,
          balance: true,
          isLocked: true,
          virtualAccountNumber: true,
          virtualAccountBank: true,
          virtualAccountName: true,
          createdAt: true,
        },
      },
    },
  });
  if (!user) throw AppError.notFound('Customer not found');

  const walletId = user.wallet?.id;
  const [requestCount, addressCount, transactionCount] = await Promise.all([
    prisma.request.count({ where: { customerId } }),
    prisma.savedAddress.count({ where: { userId: customerId } }),
    walletId
      ? prisma.transaction.count({
          where: { OR: [{ debitWalletId: walletId }, { creditWalletId: walletId }] },
        })
      : Promise.resolve(0),
  ]);

  return { ...user, counts: { requests: requestCount, addresses: addressCount, transactions: transactionCount } };
};

/**
 * Paginated request history for a customer.
 */
const getCustomerRequests = async ({ customerId, page = 1, limit = 20, status }) => {
  const customer = await prisma.user.findFirst({
    where: { id: customerId, role: 'CUSTOMER' },
    select: { id: true },
  });
  if (!customer) throw AppError.notFound('Customer not found');

  const where = { customerId, ...(status && { status }) };

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        type: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        total: true,
        createdAt: true,
        merchant: { select: { id: true, name: true } },
        rider: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      },
    }),
    prisma.request.count({ where }),
  ]);

  return { requests, total, page, limit };
};

/**
 * Paginated wallet-transaction history for a customer.
 * Looks at both debit and credit sides of the ledger.
 */
const getCustomerTransactions = async ({ customerId, page = 1, limit = 20, type, status }) => {
  const customer = await prisma.user.findFirst({
    where: { id: customerId, role: 'CUSTOMER' },
    select: { id: true, wallet: { select: { id: true } } },
  });
  if (!customer) throw AppError.notFound('Customer not found');

  const walletId = customer.wallet?.id;
  if (!walletId) return { transactions: [], total: 0, page, limit };

  const where = {
    OR: [{ debitWalletId: walletId }, { creditWalletId: walletId }],
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

  return {
    transactions: transactions.map((t) => ({
      ...t,
      direction: t.debitWalletId === walletId ? 'DEBIT' : 'CREDIT',
    })),
    total,
    page,
    limit,
  };
};

/**
 * Saved addresses for a customer.
 */
const getCustomerAddresses = async (customerId) => {
  const customer = await prisma.user.findFirst({
    where: { id: customerId, role: 'CUSTOMER' },
    select: { id: true },
  });
  if (!customer) throw AppError.notFound('Customer not found');

  return prisma.savedAddress.findMany({
    where: { userId: customerId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
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
    prisma.merchant.count({ where: { status: 'APPROVED' } }),
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
const getAllRequests = async ({ page = 1, limit = 20, type, status, categoryId, categorySlug, startDate, endDate }) => {
  const where = {
    ...(type && { type }),
    ...(status && { status }),
    ...(categoryId && { merchant: { is: { categoryId } } }),
    ...(categorySlug && { merchant: { is: { category: { is: { slug: categorySlug } } } } }),
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
        merchant: { select: { id: true, name: true, category: { select: { id: true, name: true, slug: true, color: true, icon: true } } } },
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
const getAllMerchants = async ({ page = 1, limit = 20, categoryId, categorySlug, status }) => {
  const where = {
    ...(categoryId && { categoryId }),
    ...(categorySlug && { category: { is: { slug: categorySlug } } }),
    ...(status && { status }),
  };

  const [merchants, total] = await Promise.all([
    prisma.merchant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: { select: { id: true, name: true, slug: true, color: true, icon: true } },
        wallet: {
          select: {
            availableBalance: true,
            pendingBalance: true,
            totalEarnings: true,
            isLocked: true,
            withdrawalHeld: true,
            withdrawalHoldReason: true,
            accountNumber: true,
            bankCode: true,
            accountName: true,
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
 * Get single merchant by ID with full detail.
 */
const getMerchantById = async (merchantId) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      wallet: true,
      tags: { include: { tag: true } },
      commissionHistory: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });
  if (!merchant) throw AppError.notFound('Merchant not found');
  return merchant;
};

/**
 * Approve a pending merchant.
 */
const approveMerchant = async (merchantId, adminUserId, ipAddress, userAgent) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: { user: { select: { email: true, firstName: true } } },
  });
  if (!merchant) throw AppError.notFound('Merchant not found');
  if (merchant.status !== 'PENDING_APPROVAL') throw AppError.badRequest('Merchant is not pending approval');

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { status: 'APPROVED' },
  });

  await createAuditLog(adminUserId, 'APPROVE_MERCHANT', 'MERCHANT', merchantId, { merchantName: merchant.name }, ipAddress, userAgent);

  logger.info('Merchant approved', { merchantId });

  const recipientEmail = merchant.email || merchant.user?.email;
  if (recipientEmail) {
    emailService.sendMerchantApprovedEmail(recipientEmail, merchant.name).catch((err) =>
      logger.error('Failed to send merchant approved email', { merchantId, err: err.message })
    );
  }

  return updated;
};

/**
 * Reject a pending merchant.
 */
const rejectMerchant = async (merchantId, reason, adminUserId, ipAddress, userAgent) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: { user: { select: { email: true } } },
  });
  if (!merchant) throw AppError.notFound('Merchant not found');
  if (merchant.status !== 'PENDING_APPROVAL') throw AppError.badRequest('Merchant is not pending approval');

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { status: 'REJECTED', rejectionReason: reason },
  });

  await createAuditLog(adminUserId, 'REJECT_MERCHANT', 'MERCHANT', merchantId, { merchantName: merchant.name, reason }, ipAddress, userAgent);

  logger.info('Merchant rejected', { merchantId, reason });

  const recipientEmail = merchant.email || merchant.user?.email;
  if (recipientEmail) {
    emailService.sendMerchantRejectedEmail(recipientEmail, merchant.name, reason).catch((err) =>
      logger.error('Failed to send merchant rejected email', { merchantId, err: err.message })
    );
  }

  return updated;
};

/**
 * Suspend a merchant.
 */
const suspendMerchant = async (merchantId, reason, adminUserId, ipAddress, userAgent) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: { user: { select: { email: true } } },
  });
  if (!merchant) throw AppError.notFound('Merchant not found');
  if (merchant.status === 'SUSPENDED') throw AppError.badRequest('Merchant is already suspended');

  const [updated] = await prisma.$transaction([
    prisma.merchant.update({
      where: { id: merchantId },
      data: { status: 'SUSPENDED', suspensionReason: reason },
    }),
    prisma.merchantWallet.updateMany({
      where: { merchantId },
      data: { isLocked: true },
    }),
  ]);

  await createAuditLog(adminUserId, 'SUSPEND_MERCHANT', 'MERCHANT', merchantId, { merchantName: merchant.name, reason }, ipAddress, userAgent);

  logger.info('Merchant suspended', { merchantId, reason });

  const recipientEmail = merchant.email || merchant.user?.email;
  if (recipientEmail) {
    emailService.sendMerchantSuspendedEmail(recipientEmail, merchant.name, reason).catch((err) =>
      logger.error('Failed to send merchant suspended email', { merchantId, err: err.message })
    );
  }

  return updated;
};

/**
 * Unsuspend a merchant.
 */
const unsuspendMerchant = async (merchantId, adminUserId, ipAddress, userAgent) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: { user: { select: { email: true } } },
  });
  if (!merchant) throw AppError.notFound('Merchant not found');
  if (merchant.status !== 'SUSPENDED') throw AppError.badRequest('Merchant is not suspended');

  const [updated] = await prisma.$transaction([
    prisma.merchant.update({
      where: { id: merchantId },
      data: { status: 'APPROVED', suspensionReason: null },
    }),
    prisma.merchantWallet.updateMany({
      where: { merchantId },
      data: { isLocked: false },
    }),
  ]);

  await createAuditLog(adminUserId, 'UNSUSPEND_MERCHANT', 'MERCHANT', merchantId, { merchantName: merchant.name }, ipAddress, userAgent);

  logger.info('Merchant unsuspended', { merchantId });

  const recipientEmail = merchant.email || merchant.user?.email;
  if (recipientEmail) {
    emailService.sendMerchantUnsuspendedEmail(recipientEmail, merchant.name).catch((err) =>
      logger.error('Failed to send merchant unsuspended email', { merchantId, err: err.message })
    );
  }

  return updated;
};

/**
 * Update merchant commission rate with audit trail + email notification.
 */
const updateMerchantCommission = async (merchantId, commissionRate, reason, adminUserId, ipAddress, userAgent) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: { user: { select: { email: true } } },
  });
  if (!merchant) throw AppError.notFound('Merchant not found');

  const previousRate = merchant.commissionRate;

  const [updated] = await prisma.$transaction([
    prisma.merchant.update({
      where: { id: merchantId },
      data: { commissionRate },
    }),
    prisma.commissionHistory.create({
      data: {
        merchantId,
        previousRate,
        newRate: commissionRate,
        changedBy: adminUserId || 'SYSTEM',
        reason: reason || null,
      },
    }),
  ]);

  await createAuditLog(adminUserId, 'UPDATE_COMMISSION', 'MERCHANT', merchantId, { merchantName: merchant.name, previousRate, newRate: commissionRate, reason }, ipAddress, userAgent);

  logger.info('Merchant commission updated', { merchantId, previousRate, commissionRate });

  const recipientEmail = merchant.email || merchant.user?.email;
  if (recipientEmail && previousRate !== commissionRate) {
    emailService.sendCommissionChangedEmail(recipientEmail, merchant.name, previousRate, commissionRate).catch((err) =>
      logger.error('Failed to send commission changed email', { merchantId, err: err.message })
    );
  }

  return updated;
};

/**
 * Update merchant core profile (admin override).
 */
const updateMerchantProfile = async (merchantId, data, adminUserId, ipAddress, userAgent) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw AppError.notFound('Merchant not found');

  const allowedFields = [
    'name', 'description', 'phone', 'email', 'address', 'lat', 'lng',
    'openingTime', 'closingTime', 'logoUrl', 'coverImageUrl', 'adminActiveOverride',
  ];
  const updateData = {};
  for (const key of allowedFields) {
    if (data[key] !== undefined) updateData[key] = data[key];
  }

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: updateData,
    include: {
      wallet: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      tags: { include: { tag: true } },
    },
  });

  await createAuditLog(adminUserId, 'UPDATE_MERCHANT_PROFILE', 'MERCHANT', merchantId, { fields: Object.keys(updateData) }, ipAddress, userAgent);

  logger.info('Merchant profile updated by admin', { merchantId, fields: Object.keys(updateData) });

  return updated;
};

/**
 * Get commission history for a merchant.
 */
const getMerchantCommissionHistory = async (merchantId, { page = 1, limit = 20 }) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw AppError.notFound('Merchant not found');

  const [history, total] = await Promise.all([
    prisma.commissionHistory.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.commissionHistory.count({ where: { merchantId } }),
  ]);

  return { history, total, page, limit };
};

/**
 * Set or release withdrawal hold on a merchant (freeze payouts without suspension).
 */
const setWithdrawalHold = async (merchantId, held, holdReason, adminUserId, ipAddress, userAgent) => {
  const wallet = await prisma.merchantWallet.findUnique({ where: { merchantId } });
  if (!wallet) throw AppError.notFound('Merchant wallet not found');

  const updated = await prisma.merchantWallet.update({
    where: { merchantId },
    data: {
      withdrawalHeld: held,
      withdrawalHoldReason: held ? (holdReason || null) : null,
    },
  });

  const action = held ? 'HOLD_MERCHANT_WITHDRAWALS' : 'RELEASE_MERCHANT_WITHDRAWALS';
  await createAuditLog(adminUserId, action, 'MERCHANT', merchantId, { held, holdReason }, ipAddress, userAgent);

  logger.info(`Merchant withdrawal hold ${held ? 'set' : 'released'}`, { merchantId });

  return updated;
};

/**
 * Bulk approve multiple pending withdrawals.
 */
const bulkApproveWithdrawals = async (withdrawalIds, adminUserId, ipAddress, userAgent) => {
  const results = { approved: [], failed: [] };

  for (const withdrawalId of withdrawalIds) {
    try {
      const result = await approveWithdrawal(withdrawalId, adminUserId, ipAddress, userAgent);
      results.approved.push(withdrawalId);
    } catch (err) {
      results.failed.push({ id: withdrawalId, error: err.message });
      logger.error('Bulk approval failed for withdrawal', { withdrawalId, error: err.message });
    }
  }

  return results;
};

/**
 * Get per-merchant analytics.
 */
const getMerchantAnalytics = async (merchantId, { startDate, endDate, period = 'daily' }) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: { category: { select: { id: true, name: true, slug: true, color: true, icon: true } } },
  });
  if (!merchant) throw AppError.notFound('Merchant not found');

  const dateFilter = {
    ...(startDate && { gte: new Date(startDate) }),
    ...(endDate && { lte: new Date(endDate) }),
  };
  const requestWhere = {
    merchantId,
    ...(Object.keys(dateFilter).length && { createdAt: dateFilter }),
  };

  const [
    totalOrders,
    completedOrders,
    cancelledOrders,
    revenueStats,
    ratingStats,
    commissionEarned,
    recentOrders,
  ] = await Promise.all([
    prisma.request.count({ where: requestWhere }),
    prisma.request.count({ where: { ...requestWhere, status: 'DELIVERED' } }),
    prisma.request.count({ where: { ...requestWhere, status: 'CANCELLED' } }),
    prisma.request.aggregate({
      where: { ...requestWhere, status: { in: ['DELIVERED', 'SETTLED'] } },
      _sum: { subtotal: true, merchantEarning: true, platformEarning: true },
      _avg: { subtotal: true },
      _count: true,
    }),
    prisma.rating.aggregate({
      where: {
        request: { merchantId },
        merchantScore: { not: null },
      },
      _avg: { merchantScore: true },
      _count: { merchantScore: true },
    }),
    prisma.request.aggregate({
      where: { ...requestWhere, status: { in: ['DELIVERED', 'SETTLED'] } },
      _sum: { platformEarning: true },
    }),
    prisma.request.findMany({
      where: requestWhere,
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, status: true, subtotal: true, total: true, createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  // Revenue trend (daily or weekly grouped)
  const startFilter = startDate ? Prisma.sql`AND "createdAt" >= ${new Date(startDate)}` : Prisma.empty;
  const endFilter = endDate ? Prisma.sql`AND "createdAt" <= ${new Date(endDate)}` : Prisma.empty;

  const trends = period === 'weekly'
    ? await prisma.$queryRaw`
        SELECT
          DATE_TRUNC('week', "createdAt") as period,
          COUNT(*) as orders,
          COALESCE(SUM("subtotal"), 0) as revenue,
          COALESCE(SUM("platformEarning"), 0) as commission
        FROM requests
        WHERE "merchantId" = ${merchantId}
          AND status IN ('DELIVERED', 'SETTLED')
          ${startFilter}
          ${endFilter}
        GROUP BY DATE_TRUNC('week', "createdAt")
        ORDER BY period DESC
        LIMIT 12`
    : await prisma.$queryRaw`
        SELECT
          DATE("createdAt") as period,
          COUNT(*) as orders,
          COALESCE(SUM("subtotal"), 0) as revenue,
          COALESCE(SUM("platformEarning"), 0) as commission
        FROM requests
        WHERE "merchantId" = ${merchantId}
          AND status IN ('DELIVERED', 'SETTLED')
          ${startFilter}
          ${endFilter}
        GROUP BY DATE("createdAt")
        ORDER BY period DESC
        LIMIT 30`;

  const acceptanceRate = totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) : 0;
  const cancellationRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) : 0;

  return {
    merchant: { id: merchant.id, name: merchant.name, category: merchant.category, status: merchant.status, commissionRate: merchant.commissionRate, averageRating: merchant.averageRating },
    summary: {
      totalOrders,
      completedOrders,
      cancelledOrders,
      acceptanceRate: parseFloat(acceptanceRate),
      cancellationRate: parseFloat(cancellationRate),
      totalRevenue: revenueStats._sum.subtotal || 0,
      merchantEarnings: revenueStats._sum.merchantEarning || 0,
      platformCommission: commissionEarned._sum.platformEarning || 0,
      averageOrderValue: revenueStats._avg.subtotal || 0,
      averageRating: ratingStats._avg.merchantScore || merchant.averageRating,
      totalRatings: ratingStats._count.merchantScore || 0,
    },
    trends,
    recentOrders,
  };
};

// ============================================================
// Tag Management
// ============================================================

/**
 * List all tags.
 */
const getAllTags = async ({ page = 1, limit = 50, category, isActive }) => {
  const where = {
    ...(category && { category }),
    ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true }),
  };

  const [tags, total] = await Promise.all([
    prisma.tag.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { merchants: true } },
      },
    }),
    prisma.tag.count({ where }),
  ]);

  return { tags, total, page, limit };
};

/**
 * Create a new global tag.
 */
const createTag = async ({ name, category, color, icon }, adminUserId, ipAddress, userAgent) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const existing = await prisma.tag.findUnique({ where: { slug } });
  if (existing) throw AppError.conflict(`Tag with slug "${slug}" already exists`);

  const tag = await prisma.tag.create({
    data: { name, slug, category: category || null, color: color || null, icon: icon || null },
  });

  await createAuditLog(adminUserId, 'CREATE_TAG', 'TAG', tag.id, { name, category }, ipAddress, userAgent);

  return tag;
};

/**
 * Update a tag.
 */
const updateTag = async (tagId, data, adminUserId, ipAddress, userAgent) => {
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) throw AppError.notFound('Tag not found');

  const updated = await prisma.tag.update({
    where: { id: tagId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  await createAuditLog(adminUserId, 'UPDATE_TAG', 'TAG', tagId, data, ipAddress, userAgent);

  return updated;
};

/**
 * Delete a tag.
 */
const deleteTag = async (tagId, adminUserId, ipAddress, userAgent) => {
  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag) throw AppError.notFound('Tag not found');

  await prisma.tag.delete({ where: { id: tagId } });

  await createAuditLog(adminUserId, 'DELETE_TAG', 'TAG', tagId, { name: tag.name }, ipAddress, userAgent);
};

/**
 * Assign/replace tags on a merchant.
 */
const setMerchantTags = async (merchantId, tagIds, adminUserId, ipAddress, userAgent) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw AppError.notFound('Merchant not found');

  // Validate all tagIds exist
  const tags = await prisma.tag.findMany({ where: { id: { in: tagIds } } });
  if (tags.length !== tagIds.length) throw AppError.badRequest('One or more tag IDs are invalid');

  await prisma.$transaction([
    prisma.merchantTag.deleteMany({ where: { merchantId } }),
    ...tagIds.map((tagId) =>
      prisma.merchantTag.create({ data: { merchantId, tagId } })
    ),
  ]);

  await createAuditLog(adminUserId, 'SET_MERCHANT_TAGS', 'MERCHANT', merchantId, { tagIds }, ipAddress, userAgent);

  return prisma.merchantTag.findMany({
    where: { merchantId },
    include: { tag: true },
  });
};

// ============================================================
// Merchant Category Management
// ============================================================

const categoryService = require('../category/category.service');

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * List all categories (admin view — includes inactive + merchant counts).
 */
const getAllCategories = async ({ page = 1, limit = 50, isActive } = {}) => {
  const where = {
    ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true }),
  };

  const [categories, total] = await Promise.all([
    prisma.merchantCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: { select: { merchants: true } },
      },
    }),
    prisma.merchantCategory.count({ where }),
  ]);

  return { categories, total, page, limit };
};

/**
 * Create a merchant category.
 */
const createCategory = async (
  { name, slug, description, icon, color, sortOrder, hasPreparation, attributeSchema },
  adminUserId,
  ipAddress,
  userAgent,
) => {
  const finalSlug = (slug && slugify(slug)) || slugify(name);
  if (!finalSlug) throw AppError.badRequest('Category name produces an empty slug');

  const existing = await prisma.merchantCategory.findFirst({
    where: { OR: [{ slug: finalSlug }, { name }] },
  });
  if (existing) {
    throw AppError.conflict(
      existing.slug === finalSlug
        ? `Category with slug "${finalSlug}" already exists`
        : `Category with name "${name}" already exists`,
    );
  }

  const category = await prisma.merchantCategory.create({
    data: {
      name,
      slug: finalSlug,
      description: description || null,
      icon: icon || null,
      color: color || null,
      sortOrder: sortOrder ?? 0,
      hasPreparation: hasPreparation ?? true,
      attributeSchema: attributeSchema || null,
    },
  });

  await createAuditLog(
    adminUserId,
    'CREATE_CATEGORY',
    'MERCHANT_CATEGORY',
    category.id,
    { name, slug: finalSlug },
    ipAddress,
    userAgent,
  );

  categoryService.invalidateCache();
  return category;
};

/**
 * Update a merchant category.
 */
const updateCategory = async (categoryId, data, adminUserId, ipAddress, userAgent) => {
  const category = await prisma.merchantCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw AppError.notFound('Category not found');

  // Slug uniqueness check if it's changing
  if (data.slug && data.slug !== category.slug) {
    const slug = slugify(data.slug);
    const clash = await prisma.merchantCategory.findFirst({
      where: { slug, NOT: { id: categoryId } },
    });
    if (clash) throw AppError.conflict(`Category with slug "${slug}" already exists`);
    data.slug = slug;
  }

  // Name uniqueness check if it's changing
  if (data.name && data.name !== category.name) {
    const clash = await prisma.merchantCategory.findFirst({
      where: { name: data.name, NOT: { id: categoryId } },
    });
    if (clash) throw AppError.conflict(`Category with name "${data.name}" already exists`);
  }

  const updated = await prisma.merchantCategory.update({
    where: { id: categoryId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.hasPreparation !== undefined && { hasPreparation: data.hasPreparation }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.attributeSchema !== undefined && { attributeSchema: data.attributeSchema }),
    },
  });

  await createAuditLog(
    adminUserId,
    'UPDATE_CATEGORY',
    'MERCHANT_CATEGORY',
    categoryId,
    data,
    ipAddress,
    userAgent,
  );

  categoryService.invalidateCache();
  return updated;
};

/**
 * Replace a category's attributeSchema in one call.
 * Passing `null` clears the schema; passing an object replaces it.
 */
const updateCategoryAttributeSchema = async (categoryId, attributeSchema, adminUserId, ipAddress, userAgent) => {
  const category = await prisma.merchantCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw AppError.notFound('Category not found');

  const updated = await prisma.merchantCategory.update({
    where: { id: categoryId },
    data: { attributeSchema: attributeSchema ?? null },
  });

  await createAuditLog(
    adminUserId,
    'UPDATE_CATEGORY_ATTRIBUTE_SCHEMA',
    'MERCHANT_CATEGORY',
    categoryId,
    { attributeSchema },
    ipAddress,
    userAgent,
  );

  categoryService.invalidateCache();
  return updated;
};

/**
 * Delete a merchant category.
 *
 * - Soft-delete (isActive=false) when merchants are still attached.
 * - Hard-delete only when zero merchants reference it.
 * - Never breaks the FK; this protects historical request data that joins through merchant.category.
 */
const deleteCategory = async (categoryId, adminUserId, ipAddress, userAgent) => {
  const category = await prisma.merchantCategory.findUnique({
    where: { id: categoryId },
    include: { _count: { select: { merchants: true } } },
  });
  if (!category) throw AppError.notFound('Category not found');

  if (category._count.merchants > 0) {
    const updated = await prisma.merchantCategory.update({
      where: { id: categoryId },
      data: { isActive: false },
    });

    await createAuditLog(
      adminUserId,
      'DEACTIVATE_CATEGORY',
      'MERCHANT_CATEGORY',
      categoryId,
      { name: category.name, merchantCount: category._count.merchants },
      ipAddress,
      userAgent,
    );

    categoryService.invalidateCache();
    return { soft: true, category: updated };
  }

  await prisma.merchantCategory.delete({ where: { id: categoryId } });

  await createAuditLog(
    adminUserId,
    'DELETE_CATEGORY',
    'MERCHANT_CATEGORY',
    categoryId,
    { name: category.name },
    ipAddress,
    userAgent,
  );

  categoryService.invalidateCache();
  return { soft: false };
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
      where: { ...where, type: 'RIDER_EARNING' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.request.count({
      where: { riderId, status: 'DELIVERED' },
    }),
    prisma.transaction.aggregate({
      where: { ...where, type: 'RIDER_EARNING' },
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
    (() => {
      const sFilter = startDate ? Prisma.sql`AND "createdAt" >= ${new Date(startDate)}` : Prisma.empty;
      const eFilter = endDate ? Prisma.sql`AND "createdAt" <= ${new Date(endDate)}` : Prisma.empty;
      return prisma.$queryRaw`
        SELECT
          DATE("createdAt") as date,
          SUM(amount) as revenue,
          COUNT(*) as transactions
        FROM "Transaction"
        WHERE status = 'COMPLETED'
          ${sFilter}
          ${eFilter}
        GROUP BY DATE("createdAt")
        ORDER BY date DESC
        LIMIT 30
      `;
    })(),
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
    (() => {
      const sFilter = startDate ? Prisma.sql`AND "createdAt" >= ${new Date(startDate)}` : Prisma.empty;
      const eFilter = endDate ? Prisma.sql`AND "createdAt" <= ${new Date(endDate)}` : Prisma.empty;
      return prisma.$queryRaw`
        SELECT
          ROUND("dropoffLat"::numeric, 2) as lat,
          ROUND("dropoffLng"::numeric, 2) as lng,
          COUNT(*) as "orderCount"
        FROM "requests"
        WHERE "dropoffLat" IS NOT NULL AND "dropoffLng" IS NOT NULL
          ${sFilter}
          ${eFilter}
        GROUP BY ROUND("dropoffLat"::numeric, 2), ROUND("dropoffLng"::numeric, 2)
        ORDER BY "orderCount" DESC
        LIMIT 20
      `;
    })(),
    (() => {
      const sFilter = startDate ? Prisma.sql`AND r."createdAt" >= ${new Date(startDate)}` : Prisma.empty;
      const eFilter = endDate ? Prisma.sql`AND r."createdAt" <= ${new Date(endDate)}` : Prisma.empty;
      return prisma.$queryRaw`
        SELECT
          m.type,
          m.name,
          COUNT(r.id) as "orderCount",
          SUM(t.amount) as "totalRevenue"
        FROM "merchants" m
        LEFT JOIN "requests" r ON m.id = r."merchantId"
        LEFT JOIN "transactions" t ON r.id = t."requestId"
        WHERE m.status = 'APPROVED'
          ${sFilter}
          ${eFilter}
        GROUP BY m.id, m.type, m.name
        ORDER BY "totalRevenue" DESC
      `;
    })(),
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
      activeMerchants: await prisma.merchant.count({ where: { status: 'APPROVED', isOpen: true } }),
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
const approveWithdrawal = async (withdrawalId, adminUserId, ipAddress, userAgent) => {
  const withdrawal = await prisma.merchantWalletTransaction.findUnique({
    where: { id: withdrawalId },
    include: {
      merchantWallet: {
        include: {
          merchant: {
            include: { user: { select: { email: true } } },
          },
        },
      },
    },
  });

  if (!withdrawal) throw AppError.notFound('Withdrawal not found');
  if (withdrawal.status !== 'PENDING') throw AppError.badRequest('Withdrawal is not in pending status');

  // Check if merchant wallet is under withdrawal hold
  if (withdrawal.merchantWallet.withdrawalHeld) {
    throw AppError.badRequest('This merchant\'s withdrawals are currently on hold');
  }

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

  await createAuditLog(
    adminUserId, 'APPROVE_WITHDRAWAL', 'MerchantWalletTransaction', withdrawalId,
    { amount: withdrawal.amount, merchantId: withdrawal.merchantWallet.merchantId, katpayReference: updatedWithdrawal.katpayReference },
    ipAddress, userAgent
  );

  logger.info('Merchant withdrawal approved and payout initiated', {
    withdrawalId,
    reference: withdrawal.reference,
    amount: withdrawal.amount,
  });

  const merchant = withdrawal.merchantWallet.merchant;
  const recipientEmail = merchant.email || merchant.user?.email;
  if (recipientEmail) {
    emailService.sendWithdrawalApprovedEmail(
      recipientEmail,
      merchant.name,
      withdrawal.amount,
      updatedWithdrawal.katpayReference || withdrawal.reference
    ).catch((err) => logger.error('Failed to send withdrawal approved email', { withdrawalId, err: err.message }));
  }

  return updatedWithdrawal;
};

/**
 * Reject withdrawal request — refunds to merchant wallet.
 */
const rejectWithdrawal = async (withdrawalId, reason, adminUserId, ipAddress, userAgent) => {
  const withdrawal = await prisma.merchantWalletTransaction.findUnique({
    where: { id: withdrawalId },
    include: {
      merchantWallet: {
        include: {
          merchant: {
            include: { user: { select: { email: true } } },
          },
        },
      },
    },
  });

  if (!withdrawal) throw AppError.notFound('Withdrawal not found');
  if (withdrawal.status !== 'PENDING') throw AppError.badRequest('Withdrawal is not in pending status');

  const [updatedWithdrawal] = await prisma.$transaction([
    prisma.merchantWalletTransaction.update({
      where: { id: withdrawalId },
      data: { status: 'REJECTED', rejectionReason: reason, processedAt: new Date() },
    }),
    prisma.merchantWallet.update({
      where: { id: withdrawal.merchantWalletId },
      data: {
        availableBalance: { increment: withdrawal.amount },
        pendingBalance: { decrement: withdrawal.amount },
      },
    }),
  ]);

  await createAuditLog(
    adminUserId, 'REJECT_WITHDRAWAL', 'MerchantWalletTransaction', withdrawalId,
    { amount: withdrawal.amount, reason, merchantId: withdrawal.merchantWallet.merchantId },
    ipAddress, userAgent
  );

  const merchant = withdrawal.merchantWallet.merchant;
  const recipientEmail = merchant.email || merchant.user?.email;
  if (recipientEmail) {
    emailService.sendWithdrawalRejectedEmail(
      recipientEmail, merchant.name, withdrawal.amount, reason
    ).catch((err) => logger.error('Failed to send withdrawal rejected email', { withdrawalId, err: err.message }));
  }

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
    prisma.merchant.count({ where: { status: 'APPROVED' } }),
    prisma.merchant.count({ where: { status: 'APPROVED', isCompliant: true } }),
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
  getAllCustomers,
  updateCustomerStatus,
  getCustomerById,
  getCustomerRequests,
  getCustomerTransactions,
  getCustomerAddresses,
  getTransactionOverview,
  getDashboardStats,
  getAllRequests,
  reassignRider,
  forceCancelRequest,
  adminUpdateRequestStatus,
  getAllMerchants,
  getMerchantById,
  approveMerchant,
  rejectMerchant,
  suspendMerchant,
  unsuspendMerchant,
  updateMerchantCommission,
  updateMerchantProfile,
  getMerchantCommissionHistory,
  setWithdrawalHold,
  bulkApproveWithdrawals,
  getMerchantAnalytics,
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
  setMerchantTags,
  getAllCategories,
  createCategory,
  updateCategory,
  updateCategoryAttributeSchema,
  deleteCategory,
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
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  getWithdrawalHistory,
  listVtuPlans,
  createVtuPlan,
  updateVtuPlan,
  deleteVtuPlan,
  bulkCreateVtuPlans,
};

// ─── VTU Plan Management ──────────────────────────────────────────────────────

async function listVtuPlans({ type, networkId, isActive, page = 1, limit = 100 }) {
  const p = Number(page);
  const l = Number(limit);
  const where = {
    ...(type && { type }),
    ...(networkId !== undefined && { providerNetworkId: Number(networkId) }),
    ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true }),
  };
  const [plans, total] = await Promise.all([
    prisma.vtuPlan.findMany({
      where,
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { sellingPrice: 'asc' }],
      skip: (p - 1) * l,
      take: l,
    }),
    prisma.vtuPlan.count({ where }),
  ]);
  return { plans, total, page: p, limit: l };
}

async function createVtuPlan(data) {
  return prisma.vtuPlan.create({ data });
}

async function updateVtuPlan(id, data) {
  const plan = await prisma.vtuPlan.findUnique({ where: { id } });
  if (!plan) throw AppError.notFound('VTU plan not found');
  return prisma.vtuPlan.update({ where: { id }, data });
}

async function deleteVtuPlan(id) {
  const plan = await prisma.vtuPlan.findUnique({ where: { id } });
  if (!plan) throw AppError.notFound('VTU plan not found');
  await prisma.vtuPlan.delete({ where: { id } });
}

async function bulkCreateVtuPlans(plans) {
  return prisma.vtuPlan.createMany({ data: plans, skipDuplicates: true });
}
