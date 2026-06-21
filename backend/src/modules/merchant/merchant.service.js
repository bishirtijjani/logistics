/**
 * Merchant service - manages merchants (restaurants, grocery stores, pharmacies)
 */

const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const { getIO } = require('../../sockets');
const { MERCHANT, getMerchantRoom, getMerchantsBroadcastRoom, getAdminRoom } = require('../../sockets/events');
// Phase 8 - merchant accept/reject/status routes delegate the actual lifecycle
// transition to request.service.updateStatus so socket emits, push
// notifications, lifecycle timestamps, FSM checks, and rider-matching dispatch
// all flow through a single pipeline. The merchant-side ownership guard runs
// before the delegation for clearer error responses.
const requestService = require('../request/request.service');
// Shared (rule ↔ min/max) consistency check, also used by the zod validator so
// the rule and its bounds can never drift apart on an update.
const { optionGroupRuleError } = require('./merchant.validator');

/**
 * Broadcast a `merchant:menu:updated` event to anyone watching this merchant
 * (customers on MerchantMenuScreen, the merchant's own dashboard).
 *
 * Mobile customer app refetches the menu on receipt, so 86-ing an option item
 * or marking a variant unavailable propagates within socket-roundtrip latency
 * (target: <30s per Phase 2 AC). Wrapped in try/catch so socket failures never
 * block the underlying CRUD.
 */
const broadcastMenuUpdate = (merchantId, payload = {}) => {
  try {
    const io = getIO();
    io.to(getMerchantRoom(merchantId)).emit(MERCHANT.MENU_UPDATED, {
      merchantId,
      timestamp: Date.now(),
      ...payload,
    });
  } catch (err) {
    logger.warn('broadcastMenuUpdate failed (non-fatal)', { merchantId, error: err.message });
  }
};

/**
 * Whether the merchant actually reads as "open" to customers - the
 * merchant's own toggle AND the admin's visibility override both have to
 * agree, since a suspended/hidden merchant shouldn't show as open even if
 * it never flipped its own switch.
 */
const isEffectivelyOpen = (merchant) => merchant.isOpen === true && merchant.adminActiveOverride !== false;

/**
 * Broadcast a merchant open/closed status change to:
 * - the merchant's own room (customers on its menu screen)
 * - the global merchants-broadcast room (browse/list screens)
 * - the admin dashboard room
 *
 * Either the merchant (self-toggle) or an admin (adminActiveOverride) can
 * trigger this, so callers pass the merchant row after the update.
 */
const broadcastMerchantStatus = (merchant) => {
  try {
    const io = getIO();
    const payload = {
      merchantId: merchant.id,
      isOpen: merchant.isOpen,
      adminActiveOverride: merchant.adminActiveOverride,
      effectiveOpen: isEffectivelyOpen(merchant),
      timestamp: Date.now(),
    };
    io.to(getMerchantRoom(merchant.id)).emit(MERCHANT.STATUS_CHANGED, payload);
    io.to(getMerchantsBroadcastRoom()).emit(MERCHANT.STATUS_CHANGED, payload);
    io.to(getAdminRoom()).emit(MERCHANT.STATUS_CHANGED, payload);
  } catch (err) {
    logger.warn('broadcastMerchantStatus failed (non-fatal)', { merchantId: merchant.id, error: err.message });
  }
};

// ============================================================
// Create Merchant
// ============================================================

const createMerchant = async (merchantData) => {
  const { userId, categoryId, ...data } = merchantData;

  if (!categoryId) throw AppError.badRequest('categoryId is required');

  const category = await prisma.merchantCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw AppError.badRequest('Category not found');
  if (!category.isActive) throw AppError.badRequest('Category is no longer accepting merchants');

  // Check if user exists if userId provided
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('User not found');
  }

  const merchant = await prisma.merchant.create({
    data: {
      ...data,
      categoryId,
      userId: userId || null,
    },
    include: { category: true },
  });

  // Create merchant wallet
  await prisma.merchantWallet.create({
    data: {
      merchantId: merchant.id,
    },
  });

  logger.info('Merchant created', { merchantId: merchant.id, categorySlug: category.slug });

  return merchant;
};

// ============================================================
// Get Merchants (List)
// ============================================================

const getMerchants = async (filters) => {
  const { categoryId, categorySlug, status, lat, lng, radius, openNow, page, limit } = filters;

  const where = {
    ...(categoryId && { categoryId }),
    ...(categorySlug && { category: { is: { slug: categorySlug } } }),
    status: status || 'APPROVED',
    ...(openNow && { isOpen: true }),
    isActive: true,
    adminActiveOverride: true,
  };

  // If location provided, filter by radius
  if (lat && lng && radius) {
    // Using raw SQL for distance calculation (Haversine formula)
    // This is a simplified approach - in production, use PostGIS
    where.AND = [
      {
        lat: { gte: lat - (radius / 111), lte: lat + (radius / 111) },
      },
      {
        lng: { gte: lng - (radius / 111), lte: lng + (radius / 111) },
      },
    ];
  }

  const [merchants, total] = await Promise.all([
    prisma.merchant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: true,
        wallet: {
          select: {
            availableBalance: true,
            pendingBalance: true,
          },
        },
      },
    }),
    prisma.merchant.count({ where }),
  ]);

  return { merchants, total, page, limit };
};

// ============================================================
// Get Merchant by ID
// ============================================================

const getMerchantById = async (merchantId) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: {
      category: true,
      wallet: true,
      products: {
        where: { isAvailable: true },
        orderBy: { name: 'asc' },
        include: {
          variants: {
            where: { isAvailable: true },
            orderBy: { price: 'asc' },
          },
          optionGroups: {
            orderBy: { sortOrder: 'asc' },
            include: { items: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      },
    },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  return merchant;
};

// ============================================================
// Update Merchant
// ============================================================

const updateMerchant = async (merchantId, userId, role, updateData) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });
  
  if (!merchant) throw AppError.notFound('Merchant not found');
  
  // Authorization: only merchant owner or admin can update
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }
  
  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: updateData,
  });
  
  logger.info('Merchant updated', { merchantId });

  // Phase 8 - if status or isOpen changed, broadcast to customers so they see
  // real-time store opening/closing.
  if (updateData.isOpen !== undefined) {
    broadcastMenuUpdate(merchantId, { kind: 'STORE_STATUS', isOpen: updated.isOpen });
    broadcastMerchantStatus(updated);
  }

  return updated;
};

// ============================================================
// Resubmit Merchant Application (after rejection)
// ============================================================

/**
 * Let a rejected merchant fix their profile and go straight back into the
 * review queue, mirroring the rider document re-upload recovery path.
 * Without this, REJECTED is a dead end the merchant can never get out of.
 */
const resubmitMerchant = async (merchantId, userId, role, updateData = {}) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  if (merchant.status !== 'REJECTED') {
    throw AppError.badRequest('Only a rejected application can be resubmitted');
  }

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: {
      ...updateData,
      status: 'PENDING_APPROVAL',
      rejectionReason: null,
    },
  });

  logger.info('Merchant resubmitted for review', { merchantId });

  return updated;
};

// ============================================================
// Toggle Merchant Open/Closed Status
// ============================================================

const toggleMerchantStatus = async (merchantId, userId, role, { isOpen }) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });
  
  if (!merchant) throw AppError.notFound('Merchant not found');
  
  // Authorization: only merchant owner or admin can toggle
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }
  
  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { isOpen },
  });
  
  logger.info('Merchant status toggled', { merchantId, isOpen });
  broadcastMenuUpdate(merchantId, { kind: 'STORE_STATUS', isOpen });
  broadcastMerchantStatus(updated);

  return updated;
};

// ============================================================
// Get Merchant Wallet
// ============================================================

const getMerchantWallet = async (merchantId, userId, role) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });
  
  if (!merchant) throw AppError.notFound('Merchant not found');
  
  // Authorization: only merchant owner or admin can view wallet
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }
  
  const wallet = await prisma.merchantWallet.findUnique({
    where: { merchantId },
  });
  
  if (!wallet) throw AppError.notFound('Merchant wallet not found');
  
  return wallet;
};

// ============================================================
// Get Merchant Orders
// ============================================================

const getMerchantOrders = async (merchantId, userId, role, { status, page, limit }) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });
  
  if (!merchant) throw AppError.notFound('Merchant not found');
  
  // Authorization: only merchant owner or admin can view orders
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }
  
  const where = {
    merchantId,
    ...(status && { status }),
  };
  
  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        rider: { select: { vehicleType: true, plateNumber: true } },
        items: {
          // Phase 8 - include product.requiresPrescription / dosage so the
          // merchant kitchen ticket can render the Rx pill per line. The
          // substitution column is on RequestItem itself and comes back by default.
          include: {
            product: {
              select: { id: true, name: true, requiresPrescription: true, dosage: true },
            },
          },
        },
      },
    }),
    prisma.request.count({ where }),
  ]);

  return { requests, total, page, limit };
};

// ============================================================
// Update Merchant Commission (Admin only)
// ============================================================

const updateMerchantCommission = async (merchantId, { commissionRate }) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });
  
  if (!merchant) throw AppError.notFound('Merchant not found');
  
  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { commissionRate },
  });
  
  logger.info('Merchant commission updated', { merchantId, commissionRate });

  return updated;
};

// ============================================================
// Admin Merchant Management Functions
// ============================================================

const getPendingMerchants = async ({ page, limit }) => {
  const [merchants, total] = await Promise.all([
    prisma.merchant.findMany({
      where: { status: 'PENDING_APPROVAL' },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        wallet: { select: { availableBalance: true, pendingBalance: true } },
      },
    }),
    prisma.merchant.count({ where: { status: 'PENDING_APPROVAL' } }),
  ]);

  return { merchants, total, page, limit };
};

const approveMerchant = async (merchantId, adminId) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');
  if (merchant.status !== 'PENDING_APPROVAL') {
    throw AppError.badRequest('Merchant is not in pending status');
  }

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { status: 'APPROVED' },
  });

  logger.info('Merchant approved', { merchantId, adminId });
  broadcastMenuUpdate(merchantId, { kind: 'STORE_STATUS', status: 'APPROVED', isOpen: updated.isOpen });

  return updated;
};

const rejectMerchant = async (merchantId, reason, adminId) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');
  if (merchant.status !== 'PENDING_APPROVAL') {
    throw AppError.badRequest('Merchant is not in pending status');
  }

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { status: 'REJECTED', rejectionReason: reason },
  });

  logger.info('Merchant rejected', { merchantId, reason, adminId });
  broadcastMenuUpdate(merchantId, { kind: 'STORE_STATUS', status: 'REJECTED', isOpen: updated.isOpen });

  return updated;
};

const suspendMerchant = async (merchantId, reason, adminId) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');
  if (merchant.status === 'SUSPENDED') {
    throw AppError.badRequest('Merchant is already suspended');
  }

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { status: 'SUSPENDED', suspensionReason: reason },
  });

  logger.info('Merchant suspended', { merchantId, reason, adminId });
  broadcastMenuUpdate(merchantId, { kind: 'STORE_STATUS', status: 'SUSPENDED', isOpen: updated.isOpen });

  return updated;
};

const unsuspendMerchant = async (merchantId, adminId) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');
  if (merchant.status !== 'SUSPENDED') {
    throw AppError.badRequest('Merchant is not suspended');
  }

  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { status: 'APPROVED', suspensionReason: null },
  });

  logger.info('Merchant unsuspended', { merchantId, adminId });
  broadcastMenuUpdate(merchantId, { kind: 'STORE_STATUS', status: 'APPROVED', isOpen: updated.isOpen });

  return updated;
};

const deleteMerchant = async (merchantId, adminId) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  // Soft delete by setting isActive to false
  const updated = await prisma.merchant.update({
    where: { id: merchantId },
    data: { isActive: false },
  });

  logger.info('Merchant deleted', { merchantId, adminId });
  broadcastMenuUpdate(merchantId, { kind: 'STORE_STATUS', isActive: false, isOpen: updated.isOpen });

  return updated;
};

// ============================================================
// Merchant Dashboard Functions
// ============================================================

const getMerchantProfile = async (merchantId, userId, role) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      wallet: true,
      // The merchant's locked-in business category. Carries attributeSchema /
      // hasPreparation so the dashboard can drive the product form without a
      // second round-trip.
      category: true,
    },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  // Authorization: only merchant owner can view their profile
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  return merchant;
};

/**
 * Verify the caller (acting as a merchant) actually owns the request the
 * client is trying to mutate. Centralizes the ownership guard so accept /
 * reject / status all fail identically when called against the wrong order.
 */
const assertMerchantOwnsRequest = async (merchantId, userId, role, requestId) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw AppError.notFound('Merchant not found');
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  const request = await prisma.request.findUnique({ where: { id: requestId } });
  if (!request) throw AppError.notFound('Request not found');
  if (request.merchantId !== merchantId) {
    throw AppError.badRequest('This order is not for your merchant');
  }
  return { merchant, request };
};

const acceptMerchantOrder = async (merchantId, userId, role, requestId) => {
  await assertMerchantOwnsRequest(merchantId, userId, role, requestId);
  // Delegate. updateStatus enforces FSM (REQUESTED→ACCEPTED), sets
  // `acceptedAt`, emits `request:status:changed` to the customer/merchant
  // rooms, and dispatches the push notification + Notification Center row.
  const updated = await requestService.updateStatus(requestId, 'ACCEPTED', userId, 'MERCHANT');
  logger.info('Merchant order accepted', { merchantId, requestId });
  return updated;
};

const rejectMerchantOrder = async (merchantId, userId, role, requestId, reason) => {
  await assertMerchantOwnsRequest(merchantId, userId, role, requestId);
  // CANCELLED also triggers REFUND_REQUEST via the request worker, ensuring
  // the customer's escrow is released without a separate code path here.
  const updated = await requestService.updateStatus(requestId, 'CANCELLED', userId, 'MERCHANT', { reason });
  logger.info('Merchant order rejected', { merchantId, requestId, reason });
  return updated;
};

const updateMerchantOrderStatus = async (merchantId, userId, role, requestId, status) => {
  const validStatuses = ['PROCESSING', 'READY_FOR_PICKUP'];
  if (!validStatuses.includes(status)) {
    throw AppError.badRequest('Invalid status update');
  }
  await assertMerchantOwnsRequest(merchantId, userId, role, requestId);
  // READY_FOR_PICKUP also queues BROADCAST_TO_RIDERS inside updateStatus,
  // so the rider-matching worker fires without a separate hook here.
  const updated = await requestService.updateStatus(requestId, status, userId, 'MERCHANT');
  logger.info('Merchant order status updated', { merchantId, requestId, status });
  return updated;
};

// Shared ownership guard for the wallet/bank-account endpoints.
const loadOwnedMerchantWallet = async (merchantId, userId, role) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw AppError.notFound('Merchant not found');
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }
  const wallet = await prisma.merchantWallet.findUnique({ where: { merchantId } });
  if (!wallet) throw AppError.notFound('Merchant wallet not found');
  return wallet;
};

// Return the saved payout bank account, or null if none has been set up yet.
const getMerchantBankAccount = async (merchantId, userId, role) => {
  const wallet = await loadOwnedMerchantWallet(merchantId, userId, role);
  if (!wallet.bankCode || !wallet.accountNumber) return null;
  return {
    bankCode: wallet.bankCode,
    accountNumber: wallet.accountNumber,
    accountName: wallet.accountName,
  };
};

// Save / update the merchant's payout bank account. The account name is
// resolved against the bank (so a mistyped account number can't silently
// redirect payouts). If resolution is unavailable, we fall back to a
// caller-supplied name rather than blocking setup entirely.
const saveMerchantBankAccount = async (merchantId, userId, role, { bankCode, accountNumber, accountName }) => {
  await loadOwnedMerchantWallet(merchantId, userId, role);

  // KatPay has no name-enquiry endpoint, so the account name can't be verified
  // server-side - it's collected from the user and stored as given. It is also
  // the name we hand KatPay at payout time (payouts require account_name).
  if (!accountName || accountName.trim().length < 2) {
    throw AppError.badRequest('Account name is required');
  }

  const updated = await prisma.merchantWallet.update({
    where: { merchantId },
    data: { bankCode, accountNumber, accountName: accountName.trim() },
    select: { bankCode: true, accountNumber: true, accountName: true },
  });

  logger.info('Merchant bank account saved', { merchantId, bankCode });
  return updated;
};

const requestMerchantWithdrawal = async (merchantId, userId, role, { amount }) => {
  // `wallet` here is the merchantWallet - it still holds the payout bank account
  // + the admin hold flags. The spendable money now lives in the merchant's
  // User wallet (unified wallet), so that's what we validate + debit.
  const wallet = await loadOwnedMerchantWallet(merchantId, userId, role);

  if (!wallet.bankCode || !wallet.accountNumber || !wallet.accountName) {
    throw AppError.badRequest('Add a bank account before requesting a withdrawal');
  }
  if (wallet.isLocked) {
    throw AppError.badRequest('Your wallet is currently locked');
  }
  if (wallet.withdrawalHeld) {
    throw AppError.badRequest(wallet.withdrawalHoldReason || 'Withdrawals on your account are currently on hold');
  }
  if (!(amount > 0)) {
    throw AppError.badRequest('Amount must be positive');
  }

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId }, select: { userId: true } });
  const userWallet = merchant?.userId
    ? await prisma.wallet.findUnique({ where: { userId: merchant.userId } })
    : null;
  if (!userWallet) throw AppError.notFound('Wallet not found');
  // Fast-fail before the tx for a clean error; the authoritative check happens
  // INSIDE the transaction below to avoid a TOCTOU overdraw under concurrency.
  if (userWallet.isLocked) throw AppError.badRequest('Your wallet is currently locked');
  if (Number(userWallet.balance) < amount) {
    throw AppError.badRequest('Insufficient balance');
  }

  const reference = `MWD-${uuidv4()}`;

  const feeFlat = await settingsService.getSetting('wallet.withdrawalFee', 20);
  const feePayer = await settingsService.getSetting('wallet.withdrawalFeePayer', 'PLATFORM');
  const fee = feePayer === 'USER' ? Number(feeFlat) : 0;
  const totalDebit = amount + fee;

  const withdrawal = await prisma.$transaction(async (tx) => {
    // Reserve the funds by debiting the User wallet NOW; admin approval gates the
    // actual payout (approveWithdrawal). On rejection the funds are credited back
    // (rejectWithdrawal). This mirrors the standard withdraw debit, but starts
    // PENDING instead of PROCESSING because it awaits an admin decision.
    // Re-read + re-check inside the tx so concurrent withdrawals can't overdraw.
    const w = await tx.wallet.findUnique({ where: { id: userWallet.id } });
    if (!w) throw AppError.notFound('Wallet not found');
    if (w.isLocked) throw AppError.badRequest('Your wallet is currently locked');
    const balance = Number(w.balance);
    if (balance < totalDebit) throw AppError.badRequest('Insufficient balance');

    await tx.wallet.update({ where: { id: w.id }, data: { balance: { decrement: totalDebit } } });

    // Ledger entry on the merchant's wallet (shows in their transactions list).
    await tx.transaction.create({
      data: {
        reference,
        type: 'WITHDRAWAL',
        status: 'PENDING',
        amount,
        fee,
        description: `Withdrawal to ${wallet.bankCode} - ${wallet.accountNumber}`,
        debitWalletId: userWallet.id,
        provider: 'KATPAY',
        balanceBefore: balance,
        balanceAfter: balance - totalDebit,
        metadata: { merchantId, requiresApproval: true, fee },
      },
    });

    // Approval record for the admin pipeline (unchanged shape + bank snapshot).
    return tx.merchantWalletTransaction.create({
      data: {
        reference,
        merchantWalletId: wallet.id,
        type: 'WITHDRAWAL',
        status: 'PENDING',
        amount,
        bankCode: wallet.bankCode,
        accountNumber: wallet.accountNumber,
        accountName: wallet.accountName,
      },
    });
  });

  logger.info('Merchant withdrawal requested', { merchantId, amount, reference, fee });

  return withdrawal;
};

const getMerchantProducts = async (merchantId, userId, role, { page, limit }) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        variants: { orderBy: { price: 'asc' } },
        optionGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    }),
    prisma.product.count({ where: { merchantId } }),
  ]);

  return { products, total, page, limit };
};

const getMerchantProductById = async (merchantId, userId, role, productId) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw AppError.notFound('Merchant not found');
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: { orderBy: { price: 'asc' } },
      optionGroups: {
        orderBy: { sortOrder: 'asc' },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
      },
    },
  });

  if (!product || product.merchantId !== merchantId) throw AppError.notFound('Product not found');
  return product;
};

/**
 * Build a human-readable packLabel from packSize + packUnit when caller didn't provide one.
 */
const formatPackLabel = (packSize, packUnit) => {
  if (!packSize || !packUnit) return null;
  const unit = String(packUnit).toLowerCase();
  return `${packSize} ${unit}`;
};

const VARIANT_CAP_PER_PRODUCT = 100;

/**
 * Create a product. Inline `variants` and `optionGroups` are optional;
 * when omitted we synthesize one default variant from basePrice/stock so every
 * Product always has at least one variant (single SKU or many - same code path).
 */
const createMerchantProduct = async (merchantId, userId, role, productData) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw AppError.notFound('Merchant not found');
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  const { variants, optionGroups, ...rest } = productData;

  if (variants && variants.length > VARIANT_CAP_PER_PRODUCT) {
    throw AppError.badRequest(`Variant count exceeds the ${VARIANT_CAP_PER_PRODUCT}-per-product limit`);
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({ data: { ...rest, merchantId } });

    const variantInputs = (variants && variants.length > 0)
      ? variants
      : [{
          attributes: {},
          price: Number(rest.basePrice),
          stock: rest.stock ?? 0,
          isAvailable: rest.isAvailable ?? true,
        }];

    await tx.productVariant.createMany({
      data: variantInputs.map((v) => ({
        productId: created.id,
        sku: v.sku || null,
        attributes: v.attributes || {},
        packSize: v.packSize ?? null,
        packUnit: v.packUnit || null,
        packLabel: v.packLabel || formatPackLabel(v.packSize, v.packUnit),
        price: v.price,
        stock: v.stock ?? 0,
        imageUrl: v.imageUrl || null,
        isAvailable: v.isAvailable ?? true,
      })),
    });

    if (optionGroups && optionGroups.length > 0) {
      for (const group of optionGroups) {
        await tx.productOptionGroup.create({
          data: {
            productId: created.id,
            name: group.name,
            selectionRule: group.selectionRule,
            minSelect: group.minSelect ?? 0,
            maxSelect: group.maxSelect ?? 1,
            sortOrder: group.sortOrder ?? 0,
            items: {
              create: (group.items || []).map((it) => ({
                name: it.name,
                description: it.description || null,
                priceDelta: it.priceDelta ?? 0,
                imageUrl: it.imageUrl || null,
                isDefault: it.isDefault ?? false,
                isAvailable: it.isAvailable ?? true,
                sortOrder: it.sortOrder ?? 0,
              })),
            },
          },
        });
      }
    }

    return tx.product.findUnique({
      where: { id: created.id },
      include: {
        variants: { orderBy: { price: 'asc' } },
        optionGroups: {
          orderBy: { sortOrder: 'asc' },
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
  });

  logger.info('Merchant product created', { merchantId, productId: product.id, variants: product.variants.length });
  broadcastMenuUpdate(merchantId, { kind: 'PRODUCT_CREATED', productId: product.id });

  return product;
};

const updateMerchantProduct = async (merchantId, userId, role, productId, productData) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  // Authorization: only merchant owner can update products
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) throw AppError.notFound('Product not found');
  if (product.merchantId !== merchantId) {
    throw AppError.badRequest('This product is not yours');
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: productData,
  });

  logger.info('Merchant product updated', { merchantId, productId });
  broadcastMenuUpdate(merchantId, { kind: 'PRODUCT_UPDATED', productId });

  return updated;
};

const deleteMerchantProduct = async (merchantId, userId, role, productId) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  // Authorization: only merchant owner can delete products
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) throw AppError.notFound('Product not found');
  if (product.merchantId !== merchantId) {
    throw AppError.badRequest('This product is not yours');
  }

  await prisma.product.delete({
    where: { id: productId },
  });

  logger.info('Merchant product deleted', { merchantId, productId });
  broadcastMenuUpdate(merchantId, { kind: 'PRODUCT_DELETED', productId });

  return { success: true };
};

const toggleMerchantProductAvailability = async (merchantId, userId, role, productId, isAvailable) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  // Authorization: only merchant owner can toggle product availability
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) throw AppError.notFound('Product not found');
  if (product.merchantId !== merchantId) {
    throw AppError.badRequest('This product is not yours');
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { isAvailable },
  });

  logger.info('Merchant product availability toggled', { merchantId, productId, isAvailable });
  broadcastMenuUpdate(merchantId, { kind: 'PRODUCT_AVAILABILITY', productId, isAvailable });

  return updated;
};

const getMerchantSalesSummary = async (merchantId, userId, role, { period = '7d' }) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  // Authorization: only merchant owner can view their sales
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  const startDate = new Date();
  if (period === '7d') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === '30d') {
    startDate.setDate(startDate.getDate() - 30);
  } else if (period === '90d') {
    startDate.setDate(startDate.getDate() - 90);
  }

  const [totalOrders, totalRevenue, completedOrders] = await Promise.all([
    prisma.request.count({
      where: { merchantId, createdAt: { gte: startDate } },
    }),
    prisma.transaction.aggregate({
      where: {
        merchantId,
        type: 'ORDER_EARNING',
        createdAt: { gte: startDate },
      },
      _sum: { amount: true },
    }),
    prisma.request.count({
      where: { merchantId, status: 'DELIVERED', createdAt: { gte: startDate } },
    }),
  ]);

  return {
    totalOrders,
    totalRevenue: totalRevenue._sum.amount || 0,
    completedOrders,
    period,
  };
};

const getMerchantOrderHistory = async (merchantId, userId, role, { page, limit, startDate, endDate }) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  // Authorization: only merchant owner can view their order history
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  const where = {
    merchantId,
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
        customer: { select: { firstName: true, lastName: true, phone: true } },
      },
    }),
    prisma.request.count({ where }),
  ]);

  return { requests, total, page, limit };
};

const getMerchantEarningsBreakdown = async (merchantId, userId, role, { period = '7d' }) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  // Authorization: only merchant owner can view their earnings
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  const startDate = new Date();
  if (period === '7d') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === '30d') {
    startDate.setDate(startDate.getDate() - 30);
  } else if (period === '90d') {
    startDate.setDate(startDate.getDate() - 90);
  }

  const [earnings, withdrawals] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        merchantId,
        type: 'ORDER_EARNING',
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.transaction.findMany({
      where: {
        merchantId,
        type: 'WITHDRAWAL',
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const totalEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);
  const totalWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);

  return {
    earnings,
    withdrawals,
    totalEarnings,
    totalWithdrawals,
    period,
  };
};

// ============================================================
// Variant CRUD (nested under product)
// ============================================================

const assertOwnsProduct = async (merchantId, userId, role, productId) => {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw AppError.notFound('Merchant not found');
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.merchantId !== merchantId) {
    throw AppError.notFound('Product not found');
  }
  return { merchant, product };
};

const createProductVariant = async (merchantId, userId, role, productId, variantData) => {
  await assertOwnsProduct(merchantId, userId, role, productId);

  const count = await prisma.productVariant.count({ where: { productId } });
  if (count >= VARIANT_CAP_PER_PRODUCT) {
    throw AppError.badRequest(`Variant count exceeds the ${VARIANT_CAP_PER_PRODUCT}-per-product limit`);
  }

  const variant = await prisma.productVariant.create({
    data: {
      productId,
      sku: variantData.sku || null,
      attributes: variantData.attributes || {},
      packSize: variantData.packSize ?? null,
      packUnit: variantData.packUnit || null,
      packLabel: variantData.packLabel || formatPackLabel(variantData.packSize, variantData.packUnit),
      price: variantData.price,
      stock: variantData.stock ?? 0,
      imageUrl: variantData.imageUrl || null,
      isAvailable: variantData.isAvailable ?? true,
    },
  });

  logger.info('ProductVariant created', { productId, variantId: variant.id });
  broadcastMenuUpdate(merchantId, { kind: 'VARIANT_CREATED', productId, variantId: variant.id });
  return variant;
};

const updateProductVariant = async (merchantId, userId, role, productId, variantId, patch) => {
  await assertOwnsProduct(merchantId, userId, role, productId);
  const existing = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!existing || existing.productId !== productId) throw AppError.notFound('Variant not found');

  const data = { ...patch };
  if (patch.packSize !== undefined || patch.packUnit !== undefined) {
    if (data.packLabel === undefined) {
      data.packLabel = formatPackLabel(
        patch.packSize ?? existing.packSize,
        patch.packUnit ?? existing.packUnit,
      );
    }
  }

  const updated = await prisma.productVariant.update({ where: { id: variantId }, data });
  broadcastMenuUpdate(merchantId, { kind: 'VARIANT_UPDATED', productId, variantId });
  return updated;
};

const deleteProductVariant = async (merchantId, userId, role, productId, variantId) => {
  await assertOwnsProduct(merchantId, userId, role, productId);
  const existing = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!existing || existing.productId !== productId) throw AppError.notFound('Variant not found');

  const remaining = await prisma.productVariant.count({ where: { productId } });
  if (remaining <= 1) {
    throw AppError.badRequest('Cannot delete the last variant; a product must have at least one variant');
  }

  await prisma.productVariant.delete({ where: { id: variantId } });
  broadcastMenuUpdate(merchantId, { kind: 'VARIANT_DELETED', productId, variantId });
  return { success: true };
};

// ============================================================
// Option-Group CRUD (nested under product) + Item CRUD
// ============================================================

const createOptionGroup = async (merchantId, userId, role, productId, groupData) => {
  await assertOwnsProduct(merchantId, userId, role, productId);
  const group = await prisma.productOptionGroup.create({
    data: {
      productId,
      name: groupData.name,
      selectionRule: groupData.selectionRule,
      minSelect: groupData.minSelect ?? 0,
      maxSelect: groupData.maxSelect ?? 1,
      sortOrder: groupData.sortOrder ?? 0,
      items: {
        create: (groupData.items || []).map((it) => ({
          name: it.name,
          description: it.description || null,
          priceDelta: it.priceDelta ?? 0,
          imageUrl: it.imageUrl || null,
          isDefault: it.isDefault ?? false,
          isAvailable: it.isAvailable ?? true,
          sortOrder: it.sortOrder ?? 0,
        })),
      },
    },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  broadcastMenuUpdate(merchantId, { kind: 'OPTION_GROUP_CREATED', productId, groupId: group.id });
  return group;
};

const updateOptionGroup = async (merchantId, userId, role, productId, groupId, patch) => {
  await assertOwnsProduct(merchantId, userId, role, productId);
  const existing = await prisma.productOptionGroup.findUnique({
    where: { id: groupId },
    include: { _count: { select: { items: true } } },
  });
  if (!existing || existing.productId !== productId) throw AppError.notFound('Option group not found');

  // When the rule or its bounds change, keep the (rule, min, max) triple
  // consistent and never let a populated group require more picks than it has
  // items. Untouched legacy groups can still be renamed/reordered freely.
  const touchesBounds =
    patch.selectionRule !== undefined ||
    patch.minSelect !== undefined ||
    patch.maxSelect !== undefined;
  if (touchesBounds) {
    const merged = {
      selectionRule: patch.selectionRule ?? existing.selectionRule,
      minSelect: patch.minSelect ?? existing.minSelect,
      maxSelect: patch.maxSelect ?? existing.maxSelect,
    };
    const ruleErr = optionGroupRuleError(merged);
    if (ruleErr) throw AppError.badRequest(ruleErr);
    if (existing._count.items > 0 && merged.minSelect > existing._count.items) {
      throw AppError.badRequest(
        `This group asks for ${merged.minSelect} pick(s) but only has ${existing._count.items} item(s)`,
      );
    }
  }

  const updated = await prisma.productOptionGroup.update({ where: { id: groupId }, data: patch });
  broadcastMenuUpdate(merchantId, { kind: 'OPTION_GROUP_UPDATED', productId, groupId });
  return updated;
};

const deleteOptionGroup = async (merchantId, userId, role, productId, groupId) => {
  await assertOwnsProduct(merchantId, userId, role, productId);
  const existing = await prisma.productOptionGroup.findUnique({ where: { id: groupId } });
  if (!existing || existing.productId !== productId) throw AppError.notFound('Option group not found');
  await prisma.productOptionGroup.delete({ where: { id: groupId } });
  broadcastMenuUpdate(merchantId, { kind: 'OPTION_GROUP_DELETED', productId, groupId });
  return { success: true };
};

const createOptionItem = async (merchantId, userId, role, productId, groupId, itemData) => {
  await assertOwnsProduct(merchantId, userId, role, productId);
  const group = await prisma.productOptionGroup.findUnique({ where: { id: groupId } });
  if (!group || group.productId !== productId) throw AppError.notFound('Option group not found');
  const item = await prisma.productOptionItem.create({
    data: {
      groupId,
      name: itemData.name,
      description: itemData.description || null,
      priceDelta: itemData.priceDelta ?? 0,
      imageUrl: itemData.imageUrl || null,
      isDefault: itemData.isDefault ?? false,
      isAvailable: itemData.isAvailable ?? true,
      sortOrder: itemData.sortOrder ?? 0,
    },
  });
  broadcastMenuUpdate(merchantId, { kind: 'OPTION_ITEM_CREATED', productId, groupId, itemId: item.id });
  return item;
};

const updateOptionItem = async (merchantId, userId, role, productId, groupId, itemId, patch) => {
  await assertOwnsProduct(merchantId, userId, role, productId);
  const item = await prisma.productOptionItem.findUnique({ where: { id: itemId } });
  if (!item || item.groupId !== groupId) throw AppError.notFound('Option item not found');
  const updated = await prisma.productOptionItem.update({ where: { id: itemId }, data: patch });
  broadcastMenuUpdate(merchantId, { kind: 'OPTION_ITEM_UPDATED', productId, groupId, itemId });
  return updated;
};

const deleteOptionItem = async (merchantId, userId, role, productId, groupId, itemId) => {
  await assertOwnsProduct(merchantId, userId, role, productId);
  const item = await prisma.productOptionItem.findUnique({
    where: { id: itemId },
    include: { group: { include: { _count: { select: { items: true } } } } },
  });
  if (!item || item.groupId !== groupId) throw AppError.notFound('Option item not found');

  // Don't strand a populated required group below its minimum. Emptying the
  // group entirely is fine (it returns to the "being built" state); only block
  // the in-between case where items remain but fewer than minSelect.
  const remaining = item.group._count.items - 1;
  if (remaining > 0 && remaining < item.group.minSelect) {
    throw AppError.badRequest(
      `This group requires at least ${item.group.minSelect} pick(s). Lower its minimum or delete the whole group instead of leaving too few items.`,
    );
  }

  await prisma.productOptionItem.delete({ where: { id: itemId } });
  broadcastMenuUpdate(merchantId, { kind: 'OPTION_ITEM_DELETED', productId, groupId, itemId });
  return { success: true };
};

/**
 * Replace the full set of option groups + items on a product in one call so the
 * caller doesn't have to coordinate N CRUD requests.
 *
 * NOTE: no client calls this today. It was built to back a "save/apply
 * option-group template" feature that was never shipped; the PUT route stays
 * registered as a ready-made primitive for a future bulk menu-import.
 *
 * Semantics:
 *   - Groups (and items) present by id are updated in place.
 *   - Groups (and items) missing an id are created.
 *   - Groups (and items) present on the product but absent from the payload
 *     are deleted.
 * The whole reconciliation runs in a single transaction so a partial
 * failure leaves the product's menu untouched.
 */
const bulkUpsertOptionGroups = async (merchantId, userId, role, productId, groups) => {
  await assertOwnsProduct(merchantId, userId, role, productId);

  const incoming = Array.isArray(groups) ? groups : [];
  const incomingGroupIds = new Set(incoming.filter((g) => g.id).map((g) => g.id));

  await prisma.$transaction(async (tx) => {
    const existingGroups = await tx.productOptionGroup.findMany({
      where: { productId },
      include: { items: true },
    });

    // Delete groups that are no longer present in the payload.
    const groupsToDelete = existingGroups.filter((g) => !incomingGroupIds.has(g.id));
    if (groupsToDelete.length > 0) {
      await tx.productOptionGroup.deleteMany({
        where: { id: { in: groupsToDelete.map((g) => g.id) } },
      });
    }

    // Upsert each incoming group + reconcile its items.
    for (let gi = 0; gi < incoming.length; gi++) {
      const group = incoming[gi];
      const sortOrder = group.sortOrder ?? gi;

      let groupRow;
      if (group.id && existingGroups.find((eg) => eg.id === group.id)) {
        groupRow = await tx.productOptionGroup.update({
          where: { id: group.id },
          data: {
            name: group.name,
            selectionRule: group.selectionRule,
            minSelect: group.minSelect ?? 0,
            maxSelect: group.maxSelect ?? 1,
            sortOrder,
          },
        });
      } else {
        groupRow = await tx.productOptionGroup.create({
          data: {
            productId,
            name: group.name,
            selectionRule: group.selectionRule,
            minSelect: group.minSelect ?? 0,
            maxSelect: group.maxSelect ?? 1,
            sortOrder,
          },
        });
      }

      const existingItems = existingGroups.find((eg) => eg.id === groupRow.id)?.items || [];
      const incomingItems = Array.isArray(group.items) ? group.items : [];
      const incomingItemIds = new Set(incomingItems.filter((it) => it.id).map((it) => it.id));

      // Delete items removed from the payload.
      const itemsToDelete = existingItems.filter((it) => !incomingItemIds.has(it.id));
      if (itemsToDelete.length > 0) {
        await tx.productOptionItem.deleteMany({
          where: { id: { in: itemsToDelete.map((it) => it.id) } },
        });
      }

      // Upsert each item.
      for (let ii = 0; ii < incomingItems.length; ii++) {
        const item = incomingItems[ii];
        const itemSortOrder = item.sortOrder ?? ii;
        if (item.id && existingItems.find((ei) => ei.id === item.id)) {
          await tx.productOptionItem.update({
            where: { id: item.id },
            data: {
              name: item.name,
              description: item.description || null,
              priceDelta: item.priceDelta ?? 0,
              imageUrl: item.imageUrl || null,
              isDefault: item.isDefault ?? false,
              isAvailable: item.isAvailable ?? true,
              sortOrder: itemSortOrder,
            },
          });
        } else {
          await tx.productOptionItem.create({
            data: {
              groupId: groupRow.id,
              name: item.name,
              description: item.description || null,
              priceDelta: item.priceDelta ?? 0,
              imageUrl: item.imageUrl || null,
              isDefault: item.isDefault ?? false,
              isAvailable: item.isAvailable ?? true,
              sortOrder: itemSortOrder,
            },
          });
        }
      }
    }
  });

  broadcastMenuUpdate(merchantId, { kind: 'OPTION_GROUPS_BULK_UPSERTED', productId });

  return prisma.productOptionGroup.findMany({
    where: { productId },
    orderBy: { sortOrder: 'asc' },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
};

module.exports = {
  createMerchant,
  getMerchants,
  getMerchantById,
  updateMerchant,
  resubmitMerchant,
  toggleMerchantStatus,
  broadcastMerchantStatus,
  isEffectivelyOpen,
  getMerchantWallet,
  getMerchantOrders,
  updateMerchantCommission,
  getPendingMerchants,
  approveMerchant,
  rejectMerchant,
  suspendMerchant,
  unsuspendMerchant,
  deleteMerchant,
  // Merchant dashboard functions
  getMerchantProfile,
  acceptMerchantOrder,
  rejectMerchantOrder,
  updateMerchantOrderStatus,
  requestMerchantWithdrawal,
  getMerchantBankAccount,
  saveMerchantBankAccount,
  getMerchantProducts,
  getMerchantProductById,
  createMerchantProduct,
  updateMerchantProduct,
  deleteMerchantProduct,
  toggleMerchantProductAvailability,
  // Variant CRUD
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
  // Option group + item CRUD
  createOptionGroup,
  updateOptionGroup,
  deleteOptionGroup,
  createOptionItem,
  updateOptionItem,
  deleteOptionItem,
  bulkUpsertOptionGroups,
  getMerchantSalesSummary,
  getMerchantOrderHistory,
  getMerchantEarningsBreakdown,
};
