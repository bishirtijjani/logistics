/**
 * Provider service — manages providers (restaurants, grocery stores, pharmacies)
 */

const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');

// ============================================================
// Create Provider
// ============================================================

const createProvider = async (providerData) => {
  const { userId, ...data } = providerData;
  
  // Check if user exists if userId provided
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound('User not found');
  }
  
  const provider = await prisma.provider.create({
    data: {
      ...data,
      userId: userId || null,
    },
  });
  
  // Create provider wallet
  await prisma.providerWallet.create({
    data: {
      providerId: provider.id,
    },
  });
  
  logger.info('Provider created', { providerId: provider.id, type: provider.type });
  
  return provider;
};

// ============================================================
// Get Providers (List)
// ============================================================

const getProviders = async (filters) => {
  const { type, status, lat, lng, radius, openNow, page, limit } = filters;
  
  const where = {
    ...(type && { type }),
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
  
  const [providers, total] = await Promise.all([
    prisma.provider.findMany({
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
      },
    }),
    prisma.provider.count({ where }),
  ]);
  
  return { providers, total, page, limit };
};

// ============================================================
// Get Provider by ID
// ============================================================

const getProviderById = async (providerId) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    include: {
      wallet: true,
      products: {
        where: { isAvailable: true },
        orderBy: { name: 'asc' },
      },
    },
  });
  
  if (!provider) throw AppError.notFound('Provider not found');
  
  return provider;
};

// ============================================================
// Update Provider
// ============================================================

const updateProvider = async (providerId, userId, role, updateData) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });
  
  if (!provider) throw AppError.notFound('Provider not found');
  
  // Authorization: only provider owner or admin can update
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }
  
  const updated = await prisma.provider.update({
    where: { id: providerId },
    data: updateData,
  });
  
  logger.info('Provider updated', { providerId });
  
  return updated;
};

// ============================================================
// Toggle Provider Open/Closed Status
// ============================================================

const toggleProviderStatus = async (providerId, userId, role, { isOpen }) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });
  
  if (!provider) throw AppError.notFound('Provider not found');
  
  // Authorization: only provider owner or admin can toggle
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }
  
  const updated = await prisma.provider.update({
    where: { id: providerId },
    data: { isOpen },
  });
  
  logger.info('Provider status toggled', { providerId, isOpen });
  
  return updated;
};

// ============================================================
// Get Provider Wallet
// ============================================================

const getProviderWallet = async (providerId, userId, role) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });
  
  if (!provider) throw AppError.notFound('Provider not found');
  
  // Authorization: only provider owner or admin can view wallet
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }
  
  const wallet = await prisma.providerWallet.findUnique({
    where: { providerId },
  });
  
  if (!wallet) throw AppError.notFound('Provider wallet not found');
  
  return wallet;
};

// ============================================================
// Get Provider Orders
// ============================================================

const getProviderOrders = async (providerId, userId, role, { status, page, limit }) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });
  
  if (!provider) throw AppError.notFound('Provider not found');
  
  // Authorization: only provider owner or admin can view orders
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }
  
  const where = {
    providerId,
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
// Update Provider Commission (Admin only)
// ============================================================

const updateProviderCommission = async (providerId, { commissionRate }) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });
  
  if (!provider) throw AppError.notFound('Provider not found');
  
  const updated = await prisma.provider.update({
    where: { id: providerId },
    data: { commissionRate },
  });
  
  logger.info('Provider commission updated', { providerId, commissionRate });

  return updated;
};

// ============================================================
// Admin Provider Management Functions
// ============================================================

const getPendingProviders = async ({ page, limit }) => {
  const [providers, total] = await Promise.all([
    prisma.provider.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        wallet: { select: { balance: true } },
      },
    }),
    prisma.provider.count({ where: { status: 'PENDING' } }),
  ]);

  return { providers, total, page, limit };
};

const approveProvider = async (providerId, adminId) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');
  if (provider.status !== 'PENDING') {
    throw AppError.badRequest('Provider is not in pending status');
  }

  const updated = await prisma.provider.update({
    where: { id: providerId },
    data: { status: 'ACTIVE' },
  });

  logger.info('Provider approved', { providerId, adminId });

  return updated;
};

const rejectProvider = async (providerId, reason, adminId) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');
  if (provider.status !== 'PENDING') {
    throw AppError.badRequest('Provider is not in pending status');
  }

  const updated = await prisma.provider.update({
    where: { id: providerId },
    data: { status: 'REJECTED', rejectionReason: reason },
  });

  logger.info('Provider rejected', { providerId, reason, adminId });

  return updated;
};

const suspendProvider = async (providerId, reason, adminId) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');
  if (provider.status === 'SUSPENDED') {
    throw AppError.badRequest('Provider is already suspended');
  }

  const updated = await prisma.provider.update({
    where: { id: providerId },
    data: { status: 'SUSPENDED', suspensionReason: reason },
  });

  logger.info('Provider suspended', { providerId, reason, adminId });

  return updated;
};

const unsuspendProvider = async (providerId, adminId) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');
  if (provider.status !== 'SUSPENDED') {
    throw AppError.badRequest('Provider is not suspended');
  }

  const updated = await prisma.provider.update({
    where: { id: providerId },
    data: { status: 'ACTIVE', suspensionReason: null },
  });

  logger.info('Provider unsuspended', { providerId, adminId });

  return updated;
};

// ============================================================
// Merchant Dashboard Functions
// ============================================================

const getMerchantProfile = async (providerId, userId, role) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
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

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can view their profile
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }

  return provider;
};

const updateMerchantProfile = async (providerId, userId, role, updateData) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can update their profile
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }

  const updated = await prisma.provider.update({
    where: { id: providerId },
    data: updateData,
  });

  logger.info('Merchant profile updated', { providerId });

  return updated;
};

const getMerchantOrders = async (providerId, userId, role, { status, page, limit }) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can view their orders
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }

  const where = {
    providerId,
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

const acceptMerchantOrder = async (providerId, userId, role, requestId) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can accept orders
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request) throw AppError.notFound('Request not found');
  if (request.providerId !== providerId) {
    throw AppError.badRequest('This order is not for your provider');
  }
  if (request.status !== 'REQUESTED') {
    throw AppError.badRequest('Order cannot be accepted in current status');
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { status: 'ACCEPTED' },
  });

  logger.info('Merchant order accepted', { providerId, requestId });

  return updated;
};

const rejectMerchantOrder = async (providerId, userId, role, requestId, reason) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can reject orders
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request) throw AppError.notFound('Request not found');
  if (request.providerId !== providerId) {
    throw AppError.badRequest('This order is not for your provider');
  }
  if (request.status !== 'REQUESTED') {
    throw AppError.badRequest('Order cannot be rejected in current status');
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { status: 'CANCELLED', cancellationReason: reason },
  });

  logger.info('Merchant order rejected', { providerId, requestId, reason });

  return updated;
};

const updateMerchantOrderStatus = async (providerId, userId, role, requestId, status) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can update order status
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request) throw AppError.notFound('Request not found');
  if (request.providerId !== providerId) {
    throw AppError.badRequest('This order is not for your provider');
  }

  const validStatuses = ['PROCESSING', 'READY_FOR_PICKUP'];
  if (!validStatuses.includes(status)) {
    throw AppError.badRequest('Invalid status update');
  }

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: { status },
  });

  logger.info('Merchant order status updated', { providerId, requestId, status });

  return updated;
};

const getMerchantWallet = async (providerId, userId, role) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can view their wallet
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }

  const wallet = await prisma.providerWallet.findUnique({
    where: { providerId },
    include: {
      transactions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!wallet) throw AppError.notFound('Provider wallet not found');

  return wallet;
};

const requestMerchantWithdrawal = async (providerId, userId, role, { amount, bankAccount }) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can request withdrawal
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }

  const wallet = await prisma.providerWallet.findUnique({
    where: { providerId },
  });

  if (!wallet) throw AppError.notFound('Provider wallet not found');
  if (wallet.availableBalance < amount) {
    throw AppError.badRequest('Insufficient available balance');
  }

  // Create withdrawal transaction
  const transaction = await prisma.$transaction(async (tx) => {
    // Deduct from available balance
    await tx.providerWallet.update({
      where: { providerId },
      data: {
        availableBalance: { decrement: amount },
        pendingBalance: { increment: amount },
      },
    });

    // Create transaction record
    const withdrawal = await tx.transaction.create({
      data: {
        type: 'WITHDRAWAL',
        amount,
        status: 'PENDING',
        providerId,
        metadata: { bankAccount },
      },
    });

    return withdrawal;
  });

  logger.info('Merchant withdrawal requested', { providerId, amount });

  return transaction;
};

const getMerchantProducts = async (providerId, userId, role, { page, limit }) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can view their products
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: { providerId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where: { providerId } }),
  ]);

  return { products, total, page, limit };
};

const createMerchantProduct = async (providerId, userId, role, productData) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can create products
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }

  const product = await prisma.product.create({
    data: {
      ...productData,
      providerId,
    },
  });

  logger.info('Merchant product created', { providerId, productId: product.id });

  return product;
};

const updateMerchantProduct = async (providerId, userId, role, productId, productData) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can update products
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) throw AppError.notFound('Product not found');
  if (product.providerId !== providerId) {
    throw AppError.badRequest('This product is not yours');
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: productData,
  });

  logger.info('Merchant product updated', { providerId, productId });

  return updated;
};

const deleteMerchantProduct = async (providerId, userId, role, productId) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can delete products
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) throw AppError.notFound('Product not found');
  if (product.providerId !== providerId) {
    throw AppError.badRequest('This product is not yours');
  }

  await prisma.product.delete({
    where: { id: productId },
  });

  logger.info('Merchant product deleted', { providerId, productId });

  return { success: true };
};

const toggleMerchantProductAvailability = async (providerId, userId, role, productId, isAvailable) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can toggle product availability
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) throw AppError.notFound('Product not found');
  if (product.providerId !== providerId) {
    throw AppError.badRequest('This product is not yours');
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { isAvailable },
  });

  logger.info('Merchant product availability toggled', { providerId, productId, isAvailable });

  return updated;
};

const getMerchantSalesSummary = async (providerId, userId, role, { period = '7d' }) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can view their sales
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
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
      where: { providerId, createdAt: { gte: startDate } },
    }),
    prisma.transaction.aggregate({
      where: {
        providerId,
        type: 'ORDER_EARNING',
        createdAt: { gte: startDate },
      },
      _sum: { amount: true },
    }),
    prisma.request.count({
      where: { providerId, status: 'DELIVERED', createdAt: { gte: startDate } },
    }),
  ]);

  return {
    totalOrders,
    totalRevenue: totalRevenue._sum.amount || 0,
    completedOrders,
    period,
  };
};

const getMerchantOrderHistory = async (providerId, userId, role, { page, limit, startDate, endDate }) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can view their order history
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
  }

  const where = {
    providerId,
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

const getMerchantEarningsBreakdown = async (providerId, userId, role, { period = '7d' }) => {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
  });

  if (!provider) throw AppError.notFound('Provider not found');

  // Authorization: only provider owner can view their earnings
  if (role === 'PROVIDER' && provider.userId !== userId) {
    throw AppError.forbidden('Not your provider profile');
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
        providerId,
        type: 'ORDER_EARNING',
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.transaction.findMany({
      where: {
        providerId,
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
  createProvider,
  getProviders,
  getProviderById,
  updateProvider,
  toggleProviderStatus,
  getProviderWallet,
  getProviderOrders,
  updateProviderCommission,
  getPendingProviders,
  approveProvider,
  rejectProvider,
  suspendProvider,
  unsuspendProvider,
  // Merchant dashboard functions
  getMerchantProfile,
  updateMerchantProfile,
  getMerchantOrders,
  acceptMerchantOrder,
  rejectMerchantOrder,
  updateMerchantOrderStatus,
  getMerchantWallet,
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
