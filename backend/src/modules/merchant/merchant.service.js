/**
 * Merchant service — manages merchants (restaurants, grocery stores, pharmacies)
 */

const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');

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
    ...(status && { status }),
    ...(openNow && { isOpen: true }),
    isActive: true,
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
        items: true,
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
    },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  // Authorization: only merchant owner can view their profile
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  return merchant;
};

const acceptMerchantOrder = async (merchantId, userId, role, requestId) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  // Authorization: only merchant owner can accept orders
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request) throw AppError.notFound('Request not found');
  if (request.merchantId !== merchantId) {
    throw AppError.badRequest('This order is not for your merchant');
  }
  if (request.status !== 'REQUESTED') {
    throw AppError.badRequest('Order cannot be accepted in current status');
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { status: 'ACCEPTED' },
  });

  logger.info('Merchant order accepted', { merchantId, requestId });

  return updated;
};

const rejectMerchantOrder = async (merchantId, userId, role, requestId, reason) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  // Authorization: only merchant owner can reject orders
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request) throw AppError.notFound('Request not found');
  if (request.merchantId !== merchantId) {
    throw AppError.badRequest('This order is not for your merchant');
  }
  if (request.status !== 'REQUESTED') {
    throw AppError.badRequest('Order cannot be rejected in current status');
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { status: 'CANCELLED', cancellationReason: reason },
  });

  logger.info('Merchant order rejected', { merchantId, requestId, reason });

  return updated;
};

const updateMerchantOrderStatus = async (merchantId, userId, role, requestId, status) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  // Authorization: only merchant owner can update order status
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request) throw AppError.notFound('Request not found');
  if (request.merchantId !== merchantId) {
    throw AppError.badRequest('This order is not for your merchant');
  }

  const validStatuses = ['PROCESSING', 'READY_FOR_PICKUP'];
  if (!validStatuses.includes(status)) {
    throw AppError.badRequest('Invalid status update');
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { status },
  });

  logger.info('Merchant order status updated', { merchantId, requestId, status });

  return updated;
};

const requestMerchantWithdrawal = async (merchantId, userId, role, { amount, bankCode, accountNumber, accountName }) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  if (!bankCode || !accountNumber || !accountName) {
    throw AppError.badRequest('bankCode, accountNumber, and accountName are required');
  }

  const wallet = await prisma.merchantWallet.findUnique({
    where: { merchantId },
  });

  if (!wallet) throw AppError.notFound('Merchant wallet not found');
  if (Number(wallet.availableBalance) < amount) {
    throw AppError.badRequest('Insufficient available balance');
  }

  const reference = `MWD-${uuidv4()}`;

  const withdrawal = await prisma.$transaction(async (tx) => {
    await tx.merchantWallet.update({
      where: { merchantId },
      data: {
        availableBalance: { decrement: amount },
        pendingBalance: { increment: amount },
      },
    });

    return tx.merchantWalletTransaction.create({
      data: {
        reference,
        merchantWalletId: wallet.id,
        type: 'WITHDRAWAL',
        status: 'PENDING',
        amount,
        bankCode,
        accountNumber,
        accountName,
      },
    });
  });

  logger.info('Merchant withdrawal requested', { merchantId, amount, reference });

  return withdrawal;
};

const getMerchantProducts = async (merchantId, userId, role, { page, limit }) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  // Authorization: only merchant owner can view their products
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where: { merchantId } }),
  ]);

  return { products, total, page, limit };
};

const createMerchantProduct = async (merchantId, userId, role, productData) => {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
  });

  if (!merchant) throw AppError.notFound('Merchant not found');

  // Authorization: only merchant owner can create products
  if (role === 'MERCHANT' && merchant.userId !== userId) {
    throw AppError.forbidden('Not your merchant profile');
  }

  const product = await prisma.product.create({
    data: {
      ...productData,
      merchantId,
    },
  });

  logger.info('Merchant product created', { merchantId, productId: product.id });

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

module.exports = {
  createMerchant,
  getMerchants,
  getMerchantById,
  updateMerchant,
  toggleMerchantStatus,
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
  getMerchantProducts,
  createMerchantProduct,
  updateMerchantProduct,
  deleteMerchantProduct,
  toggleMerchantProductAvailability,
  getMerchantSalesSummary,
  getMerchantOrderHistory,
  getMerchantEarningsBreakdown,
};
