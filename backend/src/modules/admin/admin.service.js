/**
 * Admin service - rider approvals, user management, transaction oversight, request management, merchant management.
 */

const { prisma } = require('../../config/database');
const { Prisma } = require('@prisma/client');
const { redis } = require('../../config/redis');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const { REDIS_KEYS } = require('../../utils/constants');
const katpayService = require('../../services/katpay.service');
const emailService = require('../../services/email.service');
const { createAuditLog } = require('../../utils/audit');

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
const reviewRider = async (riderId, decision, adminUserId, ipAddress, userAgent, reason) => {
  const rider = await prisma.rider.findUnique({ where: { id: riderId } });
  if (!rider) throw AppError.notFound('Rider not found');
  if (rider.status !== 'PENDING_APPROVAL') {
    throw AppError.badRequest('Rider already reviewed');
  }

  const approved = decision === 'approve';
  const newStatus = approved ? 'APPROVED' : 'REJECTED';

  const updated = await prisma.rider.update({
    where: { id: riderId },
    data: {
      status: newStatus,
      // Persist the reviewer's note on reject so the rider sees why in-app;
      // always clear it on approve.
      rejectionReason: approved ? null : (reason || null),
    },
  });

  await createAuditLog(
    adminUserId,
    approved ? 'APPROVE_RIDER' : 'REJECT_RIDER',
    'RIDER',
    riderId,
    { decision: newStatus, ...(reason && !approved ? { reason } : {}) },
    ipAddress,
    userAgent
  );

  logger.info('Rider reviewed', { riderId, decision: newStatus });

  // Notify the rider so their app reflects the outcome without waiting for a
  // manual refresh (the mobile notificationsBus refetches the rider profile on
  // RIDER_APPROVED / RIDER_REJECTED, which drives the OnboardingHero stage).
  try {
    const notifyService = require('../../services/notify.service');
    await notifyService.pushAndSocket(rider.userId, {
      type: approved ? 'RIDER_APPROVED' : 'RIDER_REJECTED',
      title: approved ? "You're approved!" : 'Application update',
      body: approved
        ? 'Welcome aboard. You can go online and start receiving offers now.'
        : (reason
            ? `Your application needs changes: ${reason}`
            : "Your application wasn't approved. Open the app to update your documents."),
      data: { route: '/home', kind: 'rider-status', status: newStatus },
    });
  } catch (err) {
    logger.warn('Failed to notify rider of review outcome', { riderId, error: err.message });
  }

  return updated;
};

/**
 * List all customers with optional search + status/kyc filters.
 */
const getAllCustomers = async ({ page = 1, limit = 20, search, status, kycStatus }) => {
  const where = {
    role: 'CUSTOMER',
    ...(status && { status }),
    ...(kycStatus && { kycStatus }),
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
        kycStatus: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { customers, total, page, limit };
};

/**
 * Invalidate the socket-auth cache for a user, and force-disconnect any of
 * their currently-open sockets when their access has been revoked. The user
 * sits in the `user:{userId}` room; we ask every connection in that room to
 * terminate so the next reconnect re-runs the handshake auth check.
 */
const invalidateCustomerSockets = (userId, { forceDisconnect = false } = {}) => {
  try {
    const { invalidateUserAuthCache, getIO } = require('../../sockets');
    invalidateUserAuthCache(userId);
    if (forceDisconnect) {
      try {
        const io = getIO();
        io.in(`user:${userId}`).disconnectSockets();
      } catch (_) {}
    }
  } catch (_) {}
};

/**
 * Suspend, deactivate, or reactivate a customer. Refuses to act on non-CUSTOMER
 * users - merchants/riders have their own status endpoints. Locks the wallet
 * on suspension/deactivation and unlocks it on reactivation.
 */
const updateCustomerStatus = async (customerId, status, reason, adminUserId, ipAddress, userAgent) => {
  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: { id: true, role: true, status: true, firstName: true, lastName: true, email: true },
  });
  if (!user) throw AppError.notFound('Customer not found');
  if (user.role !== 'CUSTOMER') throw AppError.badRequest('Not a customer account');
  if (user.status === status) throw AppError.badRequest(`Customer is already ${status}`);

  const userId = customerId;
  const revoking = status === 'SUSPENDED' || status === 'DEACTIVATED';
  const reactivating = status === 'ACTIVE' && (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED');

  const [updated] = await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status } }),
    ...(revoking
      ? [prisma.wallet.updateMany({ where: { userId }, data: { isLocked: true } })]
      : reactivating
        ? [prisma.wallet.updateMany({ where: { userId }, data: { isLocked: false } })]
        : []),
  ]);

  await createAuditLog(
    adminUserId,
    'UPDATE_CUSTOMER_STATUS',
    'CUSTOMER',
    userId,
    {
      from: user.status,
      to: status,
      reason: reason || null,
      walletAction: revoking ? 'LOCKED' : reactivating ? 'UNLOCKED' : null,
    },
    ipAddress,
    userAgent,
  );

  logger.info('Customer status updated', { customerId, from: user.status, to: status, reason });

  invalidateCustomerSockets(userId, { forceDisconnect: revoking });

  return updated;
};

/**
 * Granular customer edit - any subset of profile fields, KYC status, account
 * status, and wallet lock. Records a diff in the audit log so each field
 * change is independently traceable. Mirrors the merchant-profile update
 * pattern but is field-level granular.
 */
const updateCustomer = async (customerId, data, adminUserId, ipAddress, userAgent) => {
  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      role: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      kycStatus: true,
      status: true,
      wallet: { select: { id: true, isLocked: true } },
    },
  });
  if (!user) throw AppError.notFound('Customer not found');
  if (user.role !== 'CUSTOMER') throw AppError.badRequest('Not a customer account');

  const { reason, walletLocked, ...rest } = data;

  const profileFields = ['firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'kycStatus', 'status'];
  const updateData = {};
  const changes = {};

  for (const key of profileFields) {
    if (rest[key] === undefined) continue;
    const before = user[key];
    const after = rest[key];
    const beforeISO = before instanceof Date ? before.toISOString() : before;
    const afterISO = after instanceof Date ? after.toISOString() : after;
    if (beforeISO !== afterISO) {
      updateData[key] = after;
      changes[key] = { from: beforeISO ?? null, to: afterISO ?? null };
    }
  }

  // Status transitions trigger wallet side-effects unless the caller explicitly
  // sets walletLocked, in which case the caller's choice wins (lets admins
  // unlock a wallet for an unsuspended-but-still-frozen account, or force-lock
  // an ACTIVE customer's wallet without changing status).
  let walletAction = null;
  if (updateData.status) {
    const revoking = updateData.status === 'SUSPENDED' || updateData.status === 'DEACTIVATED';
    const reactivating =
      updateData.status === 'ACTIVE' && (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED');
    if (walletLocked === undefined) {
      if (revoking) walletAction = 'LOCK';
      else if (reactivating) walletAction = 'UNLOCK';
    }
  }
  if (walletLocked !== undefined && user.wallet && walletLocked !== user.wallet.isLocked) {
    walletAction = walletLocked ? 'LOCK' : 'UNLOCK';
    changes.walletLocked = { from: user.wallet.isLocked, to: walletLocked };
  }

  if (Object.keys(changes).length === 0) {
    throw AppError.badRequest('No changes detected');
  }

  let updated;
  try {
    const ops = [
      prisma.user.update({
        where: { id: customerId },
        data: updateData,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          dateOfBirth: true,
          kycStatus: true,
          status: true,
          createdAt: true,
        },
      }),
    ];
    if (walletAction && user.wallet) {
      ops.push(
        prisma.wallet.updateMany({
          where: { userId: customerId },
          data: { isLocked: walletAction === 'LOCK' },
        }),
      );
    }
    [updated] = await prisma.$transaction(ops);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : err.meta?.target;
      throw AppError.conflict(`Field already in use: ${target || 'unique constraint'}`);
    }
    throw err;
  }

  await createAuditLog(
    adminUserId,
    'UPDATE_CUSTOMER',
    'CUSTOMER',
    customerId,
    { changes, reason: reason || null },
    ipAddress,
    userAgent,
  );

  logger.info('Customer updated by admin', { customerId, fields: Object.keys(changes), reason });

  // Revoke active sessions when access-relevant fields change.
  const accessChanged =
    'status' in changes || 'email' in changes || 'phone' in changes || changes.walletLocked;
  if (accessChanged) {
    const forceDisconnect =
      changes.status?.to === 'SUSPENDED' || changes.status?.to === 'DEACTIVATED';
    invalidateCustomerSockets(customerId, { forceDisconnect });
  }

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
      bvnHash: true,
      role: true,
      status: true,
      transactionPin: true,
      transactionPinSetByUser: true,
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

  // Never leak the PIN hash; expose only whether one is set and who set it.
  // The plaintext lives behind the dedicated, audited reveal endpoint.
  const { bvnHash, transactionPin, transactionPinSetByUser, ...safeUser } = user;
  return {
    ...safeUser,
    hasBvn: !!bvnHash,
    hasPinSet: !!transactionPin,
    pinSetByUser: !!transactionPinSetByUser,
    counts: { requests: requestCount, addresses: addressCount, transactions: transactionCount },
  };
};

/**
 * Roster-level customer counts for the management dashboard KPI cards.
 */
const getCustomerStats = async () => {
  const base = { role: 'CUSTOMER', deletedAt: null };
  const [total, active, suspended, kycVerified, kycPending] = await Promise.all([
    prisma.user.count({ where: base }),
    prisma.user.count({ where: { ...base, status: 'ACTIVE' } }),
    prisma.user.count({ where: { ...base, status: 'SUSPENDED' } }),
    prisma.user.count({ where: { ...base, kycStatus: 'VERIFIED' } }),
    prisma.user.count({ where: { ...base, kycStatus: 'PENDING' } }),
  ]);
  return { total, active, suspended, kycVerified, kycPending };
};

/**
 * Reset (clear) a user's transaction PIN back to unset, the same state as a
 * freshly created account. Use this to resolve PIN complaints: the user is then
 * prompted to set a brand-new PIN themselves in-app (the PIN sheet detects
 * PIN_NOT_SET and runs its inline setup). Admins never see or choose the PIN.
 *
 * PINs are user-level, so the same clear works for any role - the role-specific
 * wrappers below just resolve the right userId and tag the audit entity.
 * Audit-logged. Idempotent - clearing an already-unset PIN is a no-op success.
 */
const _clearUserTransactionPin = async (userId, { entityType, entityId, reason, adminUserId, ipAddress, userAgent }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, transactionPin: true },
  });
  if (!user) throw AppError.notFound('User not found');

  const hadPin = !!user.transactionPin;
  if (hadPin) {
    await prisma.user.update({
      where: { id: userId },
      data: { transactionPin: null, transactionPinSetByUser: false },
    });
  }

  await createAuditLog(
    adminUserId,
    `RESET_${entityType}_PIN`,
    entityType,
    entityId,
    { hadPin, reason: reason || null },
    ipAddress,
    userAgent,
  );

  logger.warn('Transaction PIN reset (cleared) by admin', { userId, entityType, entityId, adminUserId, reason });

  return { hasPinSet: false, pinSetByUser: false, cleared: hadPin };
};

const resetCustomerPin = async (customerId, reason, adminUserId, ipAddress, userAgent) => {
  const user = await prisma.user.findFirst({
    where: { id: customerId, role: 'CUSTOMER' },
    select: { id: true },
  });
  if (!user) throw AppError.notFound('Customer not found');
  return _clearUserTransactionPin(customerId, {
    entityType: 'CUSTOMER', entityId: customerId, reason, adminUserId, ipAddress, userAgent,
  });
};

const resetRiderPin = async (riderId, reason, adminUserId, ipAddress, userAgent) => {
  const rider = await prisma.rider.findUnique({ where: { id: riderId }, select: { userId: true } });
  if (!rider) throw AppError.notFound('Rider not found');
  return _clearUserTransactionPin(rider.userId, {
    entityType: 'RIDER', entityId: riderId, reason, adminUserId, ipAddress, userAgent,
  });
};

const resetMerchantPin = async (merchantId, reason, adminUserId, ipAddress, userAgent) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { userId: true } });
  if (!merchant) throw AppError.notFound('Merchant not found');
  return _clearUserTransactionPin(merchant.userId, {
    entityType: 'MERCHANT', entityId: merchantId, reason, adminUserId, ipAddress, userAgent,
  });
};

/**
 * Wipe a customer's KYC binding so they can re-verify from scratch. Clears the
 * stored bvnHash and resets kycStatus to NONE. The append-only BvnVerificationLog
 * is intentionally preserved - regulators require the full attempt history.
 */
const wipeCustomerKyc = async (customerId, reason, adminUserId, ipAddress, userAgent) => {
  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: { id: true, role: true, kycStatus: true, bvnHash: true },
  });
  if (!user) throw AppError.notFound('Customer not found');
  if (user.role !== 'CUSTOMER') throw AppError.badRequest('Not a customer account');
  if (!user.bvnHash && user.kycStatus === 'NONE') {
    throw AppError.badRequest('No KYC data to wipe');
  }

  const updated = await prisma.user.update({
    where: { id: customerId },
    data: { bvnHash: null, kycStatus: 'NONE' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      kycStatus: true,
      status: true,
    },
  });

  await createAuditLog(
    adminUserId,
    'WIPE_CUSTOMER_KYC',
    'CUSTOMER',
    customerId,
    { previousKycStatus: user.kycStatus, hadBvn: !!user.bvnHash, reason },
    ipAddress,
    userAgent,
  );

  logger.info('Customer KYC wiped by admin', { customerId, reason });

  // Drop session caches - old JWTs may carry stale kyc-derived claims, and
  // the user's verification screen needs a fresh load.
  invalidateCustomerSockets(customerId);

  return { ...updated, hasBvn: false };
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
    platformRevenue,
    customerWalletBalance,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
    prisma.rider.count({ where: { status: 'APPROVED' } }),
    prisma.merchant.count({ where: { status: 'APPROVED' } }),
    prisma.request.count(),
    prisma.request.count({
      where: { status: { in: ['REQUESTED', 'ACCEPTED', 'PROCESSING', 'READY_FOR_PICKUP', 'RIDER_ASSIGNED', 'RIDER_EN_ROUTE', 'PICKED_UP', 'IN_TRANSIT'] } },
    }),
    // Platform revenue = the commission the platform actually earns, recorded as
    // PLATFORM_EARNING ledger rows (one per settled request + cancellation fees).
    // Summing every COMPLETED transaction instead double-counts the whole ledger
    // (fundings, P2P both legs, escrow hold/release, earnings, withdrawals).
    prisma.transaction.aggregate({
      where: { status: 'COMPLETED', type: 'PLATFORM_EARNING' },
      _sum: { amount: true },
    }),
    // Money customers are holding. Scoped to CUSTOMER wallets: riders and
    // merchants share the same unified wallet table but carry their accumulated
    // earnings, which would dwarf the customer float. System/escrow balances live
    // in a separate `systemWallet` table and are correctly excluded here.
    prisma.wallet.aggregate({
      where: { user: { role: 'CUSTOMER', deletedAt: null } },
      _sum: { balance: true },
    }),
  ]);

  return {
    totalUsers,
    totalRiders,
    totalMerchants,
    totalRequests,
    activeRequests,
    totalRevenue: Number(platformRevenue._sum.amount || 0),
    totalUserWalletBalance: Number(customerWalletBalance._sum.balance || 0),
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
const getAllMerchants = async ({ page = 1, limit = 20, categoryId, categorySlug, status, search }) => {
  // Each search term must match somewhere on the merchant (business name/contact)
  // or its owning user, so multi-word queries like "john bakery" match across fields.
  const terms = (search || '').split(/\s+/).filter(Boolean);
  const where = {
    ...(categoryId && { categoryId }),
    ...(categorySlug && { category: { is: { slug: categorySlug } } }),
    ...(status && { status }),
    ...(terms.length > 0 && {
      AND: terms.map((t) => ({
        OR: [
          { name: { contains: t, mode: 'insensitive' } },
          { email: { contains: t, mode: 'insensitive' } },
          { phone: { contains: t, mode: 'insensitive' } },
          { user: { is: { firstName: { contains: t, mode: 'insensitive' } } } },
          { user: { is: { lastName: { contains: t, mode: 'insensitive' } } } },
          { user: { is: { email: { contains: t, mode: 'insensitive' } } } },
        ],
      })),
    }),
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
            // Unified spendable wallet - what the merchant actually holds.
            wallet: { select: { balance: true, isLocked: true } },
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
      // `user.wallet` is the unified spendable wallet (earnings + top-ups);
      // `wallet` (merchantWallet) is now just payout config + lifetime stat.
      user: {
        select: {
          id: true, firstName: true, lastName: true, email: true, phone: true,
          wallet: { select: { balance: true, isLocked: true, virtualAccountNumber: true } },
        },
      },
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
    'openingTime', 'closingTime', 'openingDays', 'logoUrl', 'coverImageUrl', 'adminActiveOverride',
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
 * Admin sets / updates a merchant's payout bank account on their behalf
 * (support flows). Reuses the merchant-side save, which resolves and verifies
 * the account name against the bank before storing it.
 */
const setMerchantBankAccount = async (merchantId, { bankCode, accountNumber, accountName }, adminUserId, ipAddress, userAgent) => {
  const merchantService = require('../merchant/merchant.service');
  const saved = await merchantService.saveMerchantBankAccount(merchantId, adminUserId, 'ADMIN', {
    bankCode,
    accountNumber,
    accountName,
  });

  await createAuditLog(
    adminUserId,
    'UPDATE_MERCHANT_BANK_ACCOUNT',
    'MERCHANT',
    merchantId,
    { bankCode, accountNumber },
    ipAddress,
    userAgent,
  );

  logger.info('Admin updated merchant bank account', { merchantId });
  return saved;
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
 * List all categories (admin view - includes inactive + merchant counts).
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
const getAllRiders = async ({ page = 1, limit = 20, status, availability, search }) => {
  // Each search term must match somewhere on the rider's user (name or phone),
  // so multi-word queries like "john doe" match across firstName + lastName.
  const terms = (search || '').split(/\s+/).filter(Boolean);
  const where = {
    ...(status && { status }),
    ...(availability && { availability }),
    ...(terms.length > 0 && {
      user: {
        AND: terms.map((t) => ({
          OR: [
            { firstName: { contains: t, mode: 'insensitive' } },
            { lastName: { contains: t, mode: 'insensitive' } },
            { phone: { contains: t, mode: 'insensitive' } },
          ],
        })),
      },
    }),
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
 * Aggregate rider counts for the admin Riders console KPI cards.
 * One groupBy per dimension keeps it cheap; missing buckets default to 0.
 */
const getRiderStats = async () => {
  const [byStatus, byAvailability, total] = await Promise.all([
    prisma.rider.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.rider.groupBy({ by: ['availability'], _count: { _all: true } }),
    prisma.rider.count(),
  ]);
  const statusCount = (s) => byStatus.find((r) => r.status === s)?._count._all || 0;
  const availCount = (a) => byAvailability.find((r) => r.availability === a)?._count._all || 0;
  return {
    total,
    pending: statusCount('PENDING_APPROVAL'),
    approved: statusCount('APPROVED'),
    suspended: statusCount('SUSPENDED'),
    rejected: statusCount('REJECTED'),
    online: availCount('ONLINE'),
    offline: availCount('OFFLINE'),
    onDelivery: availCount('ON_DELIVERY'),
  };
};

/**
 * Suspend a rider. Mirrors merchant suspension: flips status to SUSPENDED,
 * records the reason, and locks the rider's wallet so payouts pause. Riders
 * share the generic Wallet (keyed by userId) - there is no RiderWallet.
 */
const suspendRider = async (riderId, reason, adminUserId, ipAddress, userAgent) => {
  const rider = await prisma.rider.findUnique({
    where: { id: riderId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!rider) throw AppError.notFound('Rider not found');
  if (rider.status === 'SUSPENDED') throw AppError.badRequest('Rider is already suspended');

  const [updated] = await prisma.$transaction([
    prisma.rider.update({
      where: { id: riderId },
      data: { status: 'SUSPENDED', suspensionReason: reason },
    }),
    prisma.wallet.updateMany({
      where: { userId: rider.userId },
      data: { isLocked: true },
    }),
  ]);

  await createAuditLog(
    adminUserId,
    'SUSPEND_RIDER',
    'RIDER',
    riderId,
    { riderName: `${rider.user?.firstName || ''} ${rider.user?.lastName || ''}`.trim(), reason },
    ipAddress,
    userAgent
  );

  logger.info('Rider suspended', { riderId, reason });
  return updated;
};

/**
 * Lift a rider suspension: restore APPROVED, clear the reason, unlock wallet.
 */
const unsuspendRider = async (riderId, adminUserId, ipAddress, userAgent) => {
  const rider = await prisma.rider.findUnique({
    where: { id: riderId },
    include: { user: { select: { firstName: true, lastName: true } } },
  });
  if (!rider) throw AppError.notFound('Rider not found');
  if (rider.status !== 'SUSPENDED') throw AppError.badRequest('Rider is not suspended');

  const [updated] = await prisma.$transaction([
    prisma.rider.update({
      where: { id: riderId },
      data: { status: 'APPROVED', suspensionReason: null },
    }),
    prisma.wallet.updateMany({
      where: { userId: rider.userId },
      data: { isLocked: false },
    }),
  ]);

  await createAuditLog(
    adminUserId,
    'UNSUSPEND_RIDER',
    'RIDER',
    riderId,
    { riderName: `${rider.user?.firstName || ''} ${rider.user?.lastName || ''}`.trim() },
    ipAddress,
    userAgent
  );

  logger.info('Rider unsuspended', { riderId });
  return updated;
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
    platformName: 'iPrime',
    defaultCurrency: 'NGN',
    timezone: 'Africa/Lagos',
    defaultMerchantCommission: 15,
    defaultRiderCommission: 10,
    minDeliveryFee: 500,
    maxDeliveryFee: 5000,
    supportEmail: 'support@iprime.ng',
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
 * Approve withdrawal request - triggers KatPay payout.
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
    description: `Merchant payout - ${withdrawal.merchantWallet.merchantId}`,
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

  // Unified wallet: advance the merchant's wallet ledger entry too (the funds
  // were already debited at request time). COMPLETED arrives via payout webhook.
  await prisma.transaction.updateMany({
    where: { reference: withdrawal.reference },
    data: { status: 'PROCESSING', providerRef: updatedWithdrawal.katpayReference },
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
 * Reject withdrawal request - refunds to merchant wallet.
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
  if (withdrawal.status === 'REJECTED') return withdrawal; // idempotent
  if (withdrawal.status !== 'PENDING') throw AppError.badRequest('Withdrawal is not in pending status');

  const claimed = await prisma.$transaction(async (tx) => {
    // Atomic compare-and-set: only ONE caller can flip PENDING → REJECTED, so two
    // concurrent rejects (or a reject racing a fail) can't both credit the wallet.
    const claim = await tx.merchantWalletTransaction.updateMany({
      where: { id: withdrawalId, status: 'PENDING' },
      data: { status: 'REJECTED', rejectionReason: reason, processedAt: new Date() },
    });
    if (claim.count === 0) return false;

    // Unified wallet: return the reserved funds to the merchant's User wallet.
    // The ledger Transaction created at request time tells us which wallet was
    // debited; reverse it under the same guard so the credit fires exactly once.
    const ledger = await tx.transaction.findUnique({ where: { reference: withdrawal.reference } });
    if (ledger?.debitWalletId) {
      const rev = await tx.transaction.updateMany({
        where: { id: ledger.id, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { status: 'REVERSED' },
      });
      if (rev.count === 1) {
        await tx.wallet.update({
          where: { id: ledger.debitWalletId },
          data: { balance: { increment: withdrawal.amount } },
        });
      }
    }
    return true;
  });

  // Lost the race - another caller already rejected it. Return the row without
  // duplicating the audit log / email.
  if (!claimed) {
    return prisma.merchantWalletTransaction.findUnique({ where: { id: withdrawalId } });
  }

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

  return prisma.merchantWalletTransaction.findUnique({ where: { id: withdrawalId } });
};

/**
 * Fail a withdrawal whose payout did NOT go through, returning the reserved
 * funds to the merchant. This is the safety net for the post-approval window:
 * a payout that KatPay bounces (bad/closed account, provider error) would
 * otherwise leave the withdrawal stuck on PROCESSING with the merchant's money
 * stranded (already debited at request time).
 *
 * Callable from three places, so it must be IDEMPOTENT and race-safe:
 *   - a KatPay payout.failed / payout.reversed webhook (adminUserId: 'SYSTEM')
 *   - an admin "mark failed & refund" action
 *   - (potentially) a reconciliation job
 *
 * Only acts on PROCESSING (the post-approval window - a PENDING withdrawal was
 * never sent to KatPay, so its refund path is rejectWithdrawal → REJECTED).
 * Already-FAILED is an idempotent no-op. Returns the row augmented with
 * `refunded` (was the wallet credited back) and `conflict` (marked FAILED but
 * the ledger had already settled - needs manual reconciliation).
 */
const failWithdrawal = async (withdrawalId, reason, { adminUserId = 'SYSTEM', ipAddress, userAgent } = {}) => {
  const existing = await prisma.merchantWalletTransaction.findUnique({
    where: { id: withdrawalId },
    include: { merchantWallet: { include: { merchant: { include: { user: { select: { email: true } } } } } } },
  });
  if (!existing) throw AppError.notFound('Withdrawal not found');
  if (existing.status === 'FAILED') {
    return { ...existing, refunded: false, alreadyHandled: true };
  }
  if (existing.status !== 'PROCESSING') {
    throw AppError.badRequest(`Cannot fail a withdrawal that is ${existing.status}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    // Atomic compare-and-set: only matches while still PROCESSING, so exactly ONE
    // concurrent caller (duplicate webhook / webhook racing an admin click) wins.
    const claim = await tx.merchantWalletTransaction.updateMany({
      where: { id: withdrawalId, status: 'PROCESSING' },
      data: { status: 'FAILED', rejectionReason: reason, processedAt: new Date() },
    });
    if (claim.count === 0) return { refunded: false, conflict: false, alreadyHandled: true };

    const ledger = await tx.transaction.findUnique({ where: { reference: existing.reference } });

    if (!ledger) {
      // Legacy (pre-unification) row: funds were reserved in pendingBalance, not
      // debited from the User wallet. Return them to availableBalance.
      await tx.merchantWallet.update({
        where: { id: existing.merchantWalletId },
        data: {
          pendingBalance: { decrement: existing.amount },
          availableBalance: { increment: existing.amount },
        },
      });
      return { refunded: true, conflict: false, alreadyHandled: false };
    }

    if (['PENDING', 'PROCESSING'].includes(ledger.status)) {
      const rev = await tx.transaction.updateMany({
        where: { id: ledger.id, status: { in: ['PENDING', 'PROCESSING'] } },
        data: { status: 'REVERSED' },
      });
      if (rev.count === 1) {
        await tx.wallet.update({
          where: { id: ledger.debitWalletId },
          data: { balance: { increment: existing.amount } },
        });
        return { refunded: true, conflict: false, alreadyHandled: false };
      }
    }

    // Ledger already COMPLETED or REVERSED - the payout may actually have gone
    // out (a half-applied success). Mark FAILED but DON'T credit; this is a hard
    // conflict that needs a human, not a silent refund.
    return { refunded: false, conflict: true, alreadyHandled: false };
  });

  if (result.alreadyHandled) {
    const row = await prisma.merchantWalletTransaction.findUnique({ where: { id: withdrawalId } });
    return { ...row, refunded: false, alreadyHandled: true };
  }

  if (result.conflict) {
    logger.error('failWithdrawal: ledger already settled - marked FAILED WITHOUT refund; manual reconciliation needed', {
      withdrawalId, reference: existing.reference, amount: existing.amount,
    });
  }

  await createAuditLog(
    adminUserId, 'FAIL_WITHDRAWAL', 'MerchantWalletTransaction', withdrawalId,
    { amount: existing.amount, reason, refunded: result.refunded, conflict: result.conflict, merchantId: existing.merchantWallet.merchantId },
    ipAddress, userAgent
  );

  logger.info('Merchant withdrawal failed', {
    withdrawalId, reference: existing.reference, amount: existing.amount, refunded: result.refunded,
  });

  // Only reassure the merchant their money is back when it actually is.
  const merchant = existing.merchantWallet.merchant;
  const recipientEmail = merchant.email || merchant.user?.email;
  if (recipientEmail && result.refunded) {
    emailService.sendWithdrawalRejectedEmail(
      recipientEmail, merchant.name, existing.amount,
      `Your payout could not be completed (${reason}). The amount has been returned to your wallet.`
    ).catch((err) => logger.error('Failed to send withdrawal failed email', { withdrawalId, err: err.message }));
  }

  const row = await prisma.merchantWalletTransaction.findUnique({ where: { id: withdrawalId } });
  return { ...row, refunded: result.refunded, conflict: result.conflict };
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
// Dispute Resolution & Support Tickets
// ----------------------------------------------------------------
// Backed by the `support` module (modules/support/support.service.js).
// The admin namespace keeps these paths for backward compatibility with
// admin-dashboard URLs; the actual logic - including the atomic refund on
// dispute resolution - lives in the support service.
// ============================================================

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

const approveDiscountCode = async (discountId, adminUserId, ipAddress, userAgent) => {
  const discount = await prisma.discountCode.update({
    where: { id: discountId },
    data: { status: 'APPROVED' },
  });

  await createAuditLog(
    adminUserId,
    'APPROVE_DISCOUNT',
    'DiscountCode',
    discountId,
    { code: discount.code },
    ipAddress,
    userAgent
  );

  return discount;
};

const rejectDiscountCode = async (discountId, reason, adminUserId, ipAddress, userAgent) => {
  const discount = await prisma.discountCode.update({
    where: { id: discountId },
    data: {
      status: 'REJECTED',
      rejectionReason: reason,
    },
  });

  await createAuditLog(
    adminUserId,
    'REJECT_DISCOUNT',
    'DiscountCode',
    discountId,
    { code: discount.code, reason },
    ipAddress,
    userAgent
  );

  return discount;
};

// ============================================================
// Rider Operations
// ============================================================

const getRiderPerformance = async ({ page = 1, limit = 20 }) => {
  const skip = (page - 1) * limit;
  const where = { status: 'APPROVED' };

  // Rank by the persisted performance counters on the Rider row. The previous
  // implementation tried `_count: { deliveries: true }` but the relation is
  // named `requests` (Prisma threw at runtime), and built a createdAt date
  // filter it never applied - both removed in favour of the real metrics.
  const [riders, total] = await Promise.all([
    prisma.rider.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      skip,
      take: limit,
      orderBy: [{ totalDeliveries: 'desc' }, { averageRating: 'desc' }],
    }),
    prisma.rider.count({ where }),
  ]);

  return { riders, total, page, limit };
};

const getRiderRealtimeLocation = async () => {
  // Riders currently online/on a delivery with a known last position. The
  // previous query referenced non-existent columns (isAvailable/currentLat/
  // currentLng) and threw; the real fields are availability + lastLat/lastLng.
  const riders = await prisma.rider.findMany({
    where: {
      status: 'APPROVED',
      availability: { in: ['ONLINE', 'ON_DELIVERY'] },
      lastLat: { not: null },
      lastLng: { not: null },
    },
    include: {
      user: { select: { firstName: true, lastName: true } },
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

// ─── Phase 8 - Rider force-offline (used by admin + Maestro `05-force-offline`)
//
// Flips the rider from ONLINE/ON_DELIVERY to OFFLINE, clears the Redis
// presence cache so the dispatcher won't broadcast offers to them, and
// fires SYSTEM_FORCE_OFFLINE via the notification bus. The rider app's
// `notificationsBus.js` listens for that type and dispatches
// `riderSlice.goOffline({ reason: "force-offline" })`.
const forceOfflineRider = async (riderId, reason, adminUserId, ipAddress, userAgent) => {
  const rider = await prisma.rider.findUnique({
    where: { id: riderId },
    select: { id: true, userId: true, availability: true },
  });
  if (!rider) throw AppError.notFound('Rider not found');

  await prisma.rider.update({
    where: { id: riderId },
    data: { availability: 'OFFLINE' },
  });

  // Clear presence cache + geo index so the next ring won't include them.
  try {
    await redis.del(`${REDIS_KEYS.RIDER_AVAILABILITY}${riderId}`);
    await redis.del(`${REDIS_KEYS.RIDER_LOCATION}${riderId}`);
    await redis.zrem(REDIS_KEYS.RIDER_GEO_INDEX, riderId);
  } catch (err) {
    logger.warn('force-offline cache clear failed (non-fatal)', { riderId, error: err.message });
  }

  // Push the rider's app to flip itself OFFLINE in-UI within ~3s.
  try {
    const notifyService = require('../../services/notify.service');
    await notifyService.pushAndSocket(rider.userId, {
      type: 'SYSTEM_FORCE_OFFLINE',
      title: 'You\'ve been taken offline',
      body: reason || 'An admin has flipped your status to offline. Contact support to reactivate.',
      data: { route: '/home', kind: 'force-offline', reason: reason || null },
    });
  } catch (err) {
    logger.warn('force-offline notify failed (non-fatal)', { riderId, error: err.message });
  }

  await createAuditLog(
    adminUserId,
    'FORCE_OFFLINE_RIDER',
    'Rider',
    riderId,
    { previousAvailability: rider.availability, reason: reason || null },
    ipAddress,
    userAgent,
  );

  return { riderId, availability: 'OFFLINE' };
};

// ─── Phase 8 - Staging-only test offer seeder (Maestro `08-offer-race-lost`)
//
// Creates a minimal PACKAGE request + immediately enqueues a broadcast
// targeted at the test rider population. Gated behind NODE_ENV !== production
// so it can never run on a live prod cluster.
//
// `target` arg can be 'both' (seed offer is broadcast wide to attract both
// test riders) or a specific rider's userId. Returns the requestId so
// the helper script can immediately call /rider/accept as the sibling
// rider for the race scenario.
const seedTestOffer = async ({ target = 'both', pickupLat, pickupLng, fare = 1500 }) => {
  if (process.env.NODE_ENV === 'production') {
    throw AppError.forbidden('seedTestOffer is staging-only', { code: 'STAGING_ONLY' });
  }

  // Need a customer + at least one approved test rider in the area for
  // the dispatcher to find candidates via GEOSEARCH.
  const customer = await prisma.user.findFirst({
    where: { role: 'CUSTOMER', email: { contains: '+staging' }, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!customer) {
    throw AppError.badRequest('No staging customer found - seed one first.', { code: 'NO_STAGING_CUSTOMER' });
  }

  // Defaults: a pickup in Katsina town centre so the broadcast lands on
  // any test rider with a sensible location fix.
  const lat = typeof pickupLat === 'number' ? pickupLat : 12.9908;
  const lng = typeof pickupLng === 'number' ? pickupLng : 7.6018;

  const request = await prisma.request.create({
    data: {
      type: 'PACKAGE',
      status: 'REQUESTED',
      customerId: customer.id,
      pickupAddress: 'Maestro test pickup',
      pickupLat: lat,
      pickupLng: lng,
      pickupName: 'Test sender',
      dropoffAddress: 'Maestro test dropoff',
      dropoffLat: lat + 0.005,
      dropoffLng: lng + 0.005,
      dropoffName: 'Test recipient',
      subtotal: 0,
      deliveryFee: fare,
      platformFee: 0,
      tax: 0,
      total: fare,
      customerPaid: fare,
      riderEarning: Math.round(fare * 0.8),
      platformEarning: Math.round(fare * 0.2),
      distanceKm: 1.0,
      estimatedMinutes: 10,
    },
    select: { id: true, customerId: true, pickupLat: true, pickupLng: true, deliveryFee: true, distanceKm: true },
  });

  // Enqueue the broadcast directly via the request queue so this seeder
  // doesn't depend on the standard request.service flow (which validates
  // payment, locks the customer wallet, etc. - overkill for staging).
  const { requestQueue } = require('../../queues');
  const { REQUEST_JOBS } = require('../../queues/jobs');
  await requestQueue.add(REQUEST_JOBS.BROADCAST_TO_RIDERS, {
    requestId: request.id,
    pickupLat: request.pickupLat,
    pickupLng: request.pickupLng,
    fare: Number(request.deliveryFee),
    distanceKm: request.distanceKm,
  });

  logger.info('Test offer seeded', { requestId: request.id, target });

  return { requestId: request.id, target };
};

// ─── Shared wallet transaction + utility payment helpers ─────────────────────
// Used by customer / merchant / rider detail endpoints. All three roles share
// a single User-level Wallet keyed by userId.

const _getWalletTransactions = async (walletId, { page = 1, limit = 20, type, status } = {}) => {
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

const _getWalletTransactionById = async (walletId, transactionId) => {
  if (!walletId) throw AppError.notFound('Wallet not found');
  const tx = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      OR: [{ debitWalletId: walletId }, { creditWalletId: walletId }],
    },
  });
  if (!tx) throw AppError.notFound('Transaction not found');
  return { ...tx, direction: tx.debitWalletId === walletId ? 'DEBIT' : 'CREDIT' };
};

const _getUserUtilityPayments = async (userId, { page = 1, limit = 20, type, status } = {}) => {
  const where = {
    userId,
    ...(type && { type }),
    ...(status && { status }),
  };
  const [payments, total] = await Promise.all([
    prisma.utilityPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.utilityPayment.count({ where }),
  ]);
  return { payments, total, page, limit };
};

const _getUserUtilityPaymentById = async (userId, paymentId) => {
  const payment = await prisma.utilityPayment.findFirst({
    where: { id: paymentId, userId },
  });
  if (!payment) throw AppError.notFound('Utility payment not found');
  return payment;
};

// ─── Customer transaction detail + utility payments ───────────────────────────

const getCustomerTransactionById = async (customerId, transactionId) => {
  const user = await prisma.user.findFirst({
    where: { id: customerId, role: 'CUSTOMER' },
    select: { id: true, wallet: { select: { id: true } } },
  });
  if (!user) throw AppError.notFound('Customer not found');
  return _getWalletTransactionById(user.wallet?.id, transactionId);
};

const getCustomerUtilityPayments = async (customerId, options) => {
  const user = await prisma.user.findFirst({
    where: { id: customerId, role: 'CUSTOMER' },
    select: { id: true },
  });
  if (!user) throw AppError.notFound('Customer not found');
  return _getUserUtilityPayments(customerId, options);
};

const getCustomerUtilityPaymentById = async (customerId, paymentId) => {
  const user = await prisma.user.findFirst({
    where: { id: customerId, role: 'CUSTOMER' },
    select: { id: true },
  });
  if (!user) throw AppError.notFound('Customer not found');
  return _getUserUtilityPaymentById(customerId, paymentId);
};

// ─── Rider detail + transactions + utility payments ───────────────────────────

const getRiderById = async (riderId) => {
  const rider = await prisma.rider.findUnique({
    where: { id: riderId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          profilePicture: true,
          status: true,
          createdAt: true,
          wallet: {
            select: {
              id: true,
              balance: true,
              isLocked: true,
              virtualAccountNumber: true,
              virtualAccountBank: true,
              virtualAccountName: true,
            },
          },
        },
      },
    },
  });
  if (!rider) throw AppError.notFound('Rider not found');

  const walletId = rider.user?.wallet?.id;
  const [deliveryCount, transactionCount] = await Promise.all([
    prisma.request.count({ where: { riderId, status: 'DELIVERED' } }),
    walletId
      ? prisma.transaction.count({
          where: { OR: [{ debitWalletId: walletId }, { creditWalletId: walletId }] },
        })
      : Promise.resolve(0),
  ]);

  return { ...rider, counts: { deliveries: deliveryCount, transactions: transactionCount } };
};

const getRiderTransactions = async (riderId, options) => {
  const rider = await prisma.rider.findUnique({
    where: { id: riderId },
    select: { userId: true, user: { select: { wallet: { select: { id: true } } } } },
  });
  if (!rider) throw AppError.notFound('Rider not found');
  return _getWalletTransactions(rider.user?.wallet?.id, options);
};

const getRiderTransactionById = async (riderId, transactionId) => {
  const rider = await prisma.rider.findUnique({
    where: { id: riderId },
    select: { userId: true, user: { select: { wallet: { select: { id: true } } } } },
  });
  if (!rider) throw AppError.notFound('Rider not found');
  return _getWalletTransactionById(rider.user?.wallet?.id, transactionId);
};

const getRiderUtilityPayments = async (riderId, options) => {
  const rider = await prisma.rider.findUnique({ where: { id: riderId }, select: { userId: true } });
  if (!rider) throw AppError.notFound('Rider not found');
  return _getUserUtilityPayments(rider.userId, options);
};

const getRiderUtilityPaymentById = async (riderId, paymentId) => {
  const rider = await prisma.rider.findUnique({ where: { id: riderId }, select: { userId: true } });
  if (!rider) throw AppError.notFound('Rider not found');
  return _getUserUtilityPaymentById(rider.userId, paymentId);
};

// ─── Merchant transactions + utility payments ─────────────────────────────────

const getMerchantTransactions = async (merchantId, options) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { userId: true, user: { select: { wallet: { select: { id: true } } } } },
  });
  if (!merchant) throw AppError.notFound('Merchant not found');
  return _getWalletTransactions(merchant.user?.wallet?.id, options);
};

const getMerchantTransactionById = async (merchantId, transactionId) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { userId: true, user: { select: { wallet: { select: { id: true } } } } },
  });
  if (!merchant) throw AppError.notFound('Merchant not found');
  return _getWalletTransactionById(merchant.user?.wallet?.id, transactionId);
};

const getMerchantUtilityPayments = async (merchantId, options) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { userId: true } });
  if (!merchant) throw AppError.notFound('Merchant not found');
  return _getUserUtilityPayments(merchant.userId, options);
};

const getMerchantUtilityPaymentById = async (merchantId, paymentId) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { userId: true } });
  if (!merchant) throw AppError.notFound('Merchant not found');
  return _getUserUtilityPaymentById(merchant.userId, paymentId);
};

// ── Admin manual refund ──────────────────────────────────────────────────────
// Types an admin may NOT refund through this generic action:
//  - credits to the user (nothing was taken to give back)
//  - flows with their own reversal path (withdrawals) or an internal/external
//    counterparty (P2P sent, deliveries, escrow) where a naive credit would
//    mint money or break order accounting.
// Everything else that is a wallet DEBIT (today: UTILITY_PAYMENT) is refundable.
const REFUND_BLOCKED_TYPES = new Set([
  'WALLET_FUNDING', 'P2P_TRANSFER_RECEIVED', 'DELIVERY_EARNING', 'AIRTIME_TO_CASH',
  'REFUND', 'ESCROW_RELEASE', 'ESCROW_REFUND', 'PLATFORM_EARNING', 'RIDER_EARNING',
  'MERCHANT_EARNING', 'WITHDRAWAL', 'P2P_TRANSFER_SENT', 'DELIVERY_PAYMENT', 'ESCROW_HOLD',
]);

/**
 * Admin-initiated full refund of a single wallet transaction.
 *
 * - VTU (UTILITY_PAYMENT): re-queries AlRahuz via the worker reconciler first,
 *   so a purchase that actually delivered is completed (NOT refunded); only a
 *   genuinely failed/stuck one is refunded. Keeps both the UtilityPayment row
 *   and the wallet ledger consistent.
 * - Other eligible debits: credits the debited wallet, writes a REFUND ledger
 *   entry, and marks the original REFUNDED, atomically.
 *
 * Guardrails: blocks credits, counterparty/own-flow types, and anything already
 * REFUNDED. Full amount only. Every call is audit-logged with the reason.
 */
const adminRefundTransaction = async (adminUserId, transactionId, reason, ipAddress, userAgent) => {
  const txn = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!txn) throw AppError.notFound('Transaction not found');
  if (txn.status === 'REFUNDED') {
    throw AppError.conflict('This transaction has already been refunded.', { code: 'ALREADY_REFUNDED' });
  }
  if (!txn.debitWalletId) {
    throw AppError.badRequest('Only a wallet debit can be refunded.', { code: 'NOT_A_DEBIT' });
  }
  if (REFUND_BLOCKED_TYPES.has(txn.type)) {
    throw AppError.badRequest(
      `${txn.type.replace(/_/g, ' ').toLowerCase()} can't be refunded here - use the dispute or withdrawal flow.`,
      { code: 'TYPE_NOT_REFUNDABLE' },
    );
  }

  // ── VTU: reconcile (re-query provider → complete or refund) ──────────────
  if (txn.type === 'UTILITY_PAYMENT') {
    const payment = await prisma.utilityPayment.findFirst({
      where: { OR: [{ transactionId: txn.reference }, { providerRequestId: txn.reference }] },
      select: { id: true },
    });
    if (payment) {
      const { reconcileOnePayment } = require('../../queues/workers/utility.worker');
      await reconcileOnePayment(payment.id);
      const [freshTxn, freshPayment] = await Promise.all([
        prisma.transaction.findUnique({ where: { id: transactionId } }),
        prisma.utilityPayment.findUnique({ where: { id: payment.id } }),
      ]);
      await createAuditLog(
        adminUserId, 'REFUND_TRANSACTION', 'TRANSACTION', transactionId,
        { type: txn.type, amount: Number(txn.amount), reason, mode: 'vtu-reconcile', resultStatus: freshPayment?.status },
        ipAddress, userAgent,
      );
      const delivered = freshPayment?.status === 'COMPLETED';
      return {
        transaction: freshTxn,
        utilityPayment: freshPayment,
        mode: 'vtu-reconcile',
        refunded: freshPayment?.status === 'REFUNDED',
        message: delivered
          ? 'Provider confirms this purchase was delivered, so it was NOT refunded.'
          : freshPayment?.status === 'REFUNDED'
            ? 'Purchase failed at the provider - customer refunded.'
            : 'Purchase is still pending at the provider; a re-check was scheduled.',
      };
    }
    // No UtilityPayment row (shouldn't happen) - fall through to a direct refund.
  }

  // ── Generic full refund ──────────────────────────────────────────────────
  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { id: txn.debitWalletId } });
    if (!wallet) throw AppError.notFound('Wallet not found for refund');
    const amount = Number(txn.amount);
    const balance = Number(wallet.balance);

    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount } } });
    const refundTxn = await tx.transaction.create({
      data: {
        reference: `ADMIN-REFUND-${txn.reference}`,
        type: 'REFUND',
        status: 'COMPLETED',
        amount,
        description: `Admin refund: ${reason}`.slice(0, 250),
        creditWalletId: wallet.id,
        balanceBefore: balance,
        balanceAfter: balance + amount,
      },
    });
    await tx.transaction.update({ where: { id: txn.id }, data: { status: 'REFUNDED' } });
    return { userId: wallet.userId, amount, refundTxn };
  });

  await createAuditLog(
    adminUserId, 'REFUND_TRANSACTION', 'TRANSACTION', transactionId,
    { type: txn.type, amount: result.amount, reason, mode: 'direct' },
    ipAddress, userAgent,
  );

  try {
    const notifyService = require('../../services/notify.service');
    await notifyService.onWalletEvent(result.userId, {
      kind: 'REFUND',
      amount: result.amount,
      transactionId: txn.reference,
      route: '/wallet',
      description: `₦${Number(result.amount).toLocaleString('en-NG')} refunded to your wallet.`,
    });
  } catch (err) {
    logger.warn('Admin refund notify failed (non-fatal)', { transactionId, error: err.message });
  }

  const freshTxn = await prisma.transaction.findUnique({ where: { id: transactionId } });
  return { transaction: freshTxn, refundTransaction: result.refundTxn, mode: 'direct', refunded: true, message: 'Refund completed.' };
};

module.exports = {
  getPendingRiders,
  reviewRider,
  adminRefundTransaction,
  getAllCustomers,
  updateCustomerStatus,
  updateCustomer,
  wipeCustomerKyc,
  getCustomerById,
  getCustomerStats,
  resetCustomerPin,
  resetRiderPin,
  resetMerchantPin,
  getCustomerRequests,
  getCustomerTransactions,
  getCustomerTransactionById,
  getCustomerAddresses,
  getCustomerUtilityPayments,
  getCustomerUtilityPaymentById,
  getTransactionOverview,
  getDashboardStats,
  getAllRequests,
  reassignRider,
  forceCancelRequest,
  adminUpdateRequestStatus,
  getAllMerchants,
  getMerchantById,
  getMerchantTransactions,
  getMerchantTransactionById,
  getMerchantUtilityPayments,
  getMerchantUtilityPaymentById,
  approveMerchant,
  rejectMerchant,
  suspendMerchant,
  unsuspendMerchant,
  updateMerchantCommission,
  updateMerchantProfile,
  getMerchantCommissionHistory,
  setWithdrawalHold,
  setMerchantBankAccount,
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
  getRiderById,
  getRiderStats,
  suspendRider,
  unsuspendRider,
  getRiderEarnings,
  getRiderDeliveryHistory,
  getRiderTransactions,
  getRiderTransactionById,
  getRiderUtilityPayments,
  getRiderUtilityPaymentById,
  // Rider operations + safety/compliance (were defined but never exported,
  // so these endpoints 500'd with "is not a function").
  getRiderPerformance,
  getRiderRealtimeLocation,
  getSafetyIncidents,
  getComplianceReport,
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
  failWithdrawal,
  getWithdrawalHistory,
  listVtuPlans,
  createVtuPlan,
  updateVtuPlan,
  deleteVtuPlan,
  bulkCreateVtuPlans,
  listVtuNetworks,
  createVtuNetwork,
  updateVtuNetwork,
  deleteVtuNetwork,
  // Phase 8 - Maestro support
  forceOfflineRider,
  seedTestOffer,
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

// ─── VTU Network Management ───────────────────────────────────────────────────
// Networks (and discos / cable names - same shape, different `type`) are the
// catalogue admins edit when a provider renumbers IDs. Edits sweep all
// VtuPlan rows that reference the old (type, providerNetworkId) pair.

const _invalidateVtuCaches = async () => {
  // The utility-service cache keys for networks are derived from `type` so we
  // wipe by scan; cheap because the set is tiny (under a dozen keys).
  try {
    const patterns = [
      `${REDIS_KEYS.VTU_NETWORKS}*`,
      REDIS_KEYS.VTU_DISCOS,
      `${REDIS_KEYS.VTU_DATA_PLANS}*`,
    ];
    for (const pattern of patterns) {
      if (pattern.endsWith('*')) {
        const keys = await redis.keys(pattern);
        if (keys.length) await redis.del(...keys);
      } else {
        await redis.del(pattern);
      }
    }
  } catch (err) {
    logger.warn('VTU cache invalidation failed', { error: err.message });
  }
};

async function listVtuNetworks({ type, isActive } = {}) {
  const where = {
    ...(type && { type }),
    ...(isActive !== undefined && {
      isActive: isActive === 'true' || isActive === true,
    }),
  };
  return prisma.vtuNetwork.findMany({
    where,
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  });
}

async function createVtuNetwork(data) {
  const payload = {
    type: data.type,
    providerNetworkId: Number(data.providerNetworkId),
    name: String(data.name).trim(),
    isActive: data.isActive !== false,
    sortOrder: Number(data.sortOrder || 0),
  };
  if (!payload.type) throw AppError.badRequest('type is required');
  if (!Number.isFinite(payload.providerNetworkId)) throw AppError.badRequest('providerNetworkId must be a number');
  if (!payload.name) throw AppError.badRequest('name is required');

  let network;
  try {
    network = await prisma.vtuNetwork.create({ data: payload });
  } catch (err) {
    if (err.code === 'P2002') {
      throw AppError.badRequest(`A network with provider ID ${payload.providerNetworkId} already exists for ${payload.type}`);
    }
    throw err;
  }
  await _invalidateVtuCaches();
  return network;
}

async function updateVtuNetwork(id, data) {
  const existing = await prisma.vtuNetwork.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Network not found');

  const next = {
    ...(data.name !== undefined && { name: String(data.name).trim() }),
    ...(data.providerNetworkId !== undefined && {
      providerNetworkId: Number(data.providerNetworkId),
    }),
    ...(data.isActive !== undefined && { isActive: !!data.isActive }),
    ...(data.sortOrder !== undefined && { sortOrder: Number(data.sortOrder) }),
  };

  // Detect whether the sweep is needed. Type is intentionally immutable - a
  // network is fundamentally one of AIRTIME/DATA/CABLE/ELECTRICITY; deleting
  // and recreating is the safer path if admin truly needs to change it.
  const idChanged = next.providerNetworkId !== undefined && next.providerNetworkId !== existing.providerNetworkId;
  const nameChanged = next.name !== undefined && next.name !== existing.name;

  const updated = await prisma.$transaction(async (tx) => {
    if (idChanged) {
      // Guard against collision with another network row.
      const collision = await tx.vtuNetwork.findFirst({
        where: {
          type: existing.type,
          providerNetworkId: next.providerNetworkId,
          NOT: { id },
        },
      });
      if (collision) {
        throw AppError.badRequest(`Provider ID ${next.providerNetworkId} is already used by "${collision.name}"`);
      }
    }

    const network = await tx.vtuNetwork.update({ where: { id }, data: next });

    if (idChanged || nameChanged) {
      await tx.vtuPlan.updateMany({
        where: {
          type: existing.type,
          providerNetworkId: existing.providerNetworkId,
        },
        data: {
          ...(idChanged && { providerNetworkId: next.providerNetworkId }),
          ...(nameChanged && { networkName: next.name }),
        },
      });
    }

    return network;
  });

  await _invalidateVtuCaches();
  return updated;
}

async function deleteVtuNetwork(id) {
  const existing = await prisma.vtuNetwork.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound('Network not found');

  const planCount = await prisma.vtuPlan.count({
    where: { type: existing.type, providerNetworkId: existing.providerNetworkId },
  });
  if (planCount > 0) {
    throw AppError.badRequest(
      `Cannot delete: ${planCount} plan${planCount === 1 ? '' : 's'} still reference this network. Delete or reassign them first.`,
    );
  }

  await prisma.vtuNetwork.delete({ where: { id } });
  await _invalidateVtuCaches();
}
