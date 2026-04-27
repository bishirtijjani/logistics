/**
 * Provider controller — handles HTTP requests for provider operations
 */

const providerService = require('./provider.service');
const { ApiResponse } = require('../../utils/api-response');

// ============================================================
// Create Provider (Admin only)
// ============================================================

const createProvider = async (req, res, next) => {
  try {
    const providerData = req.body;
    
    const provider = await providerService.createProvider(providerData);
    
    res.status(201).json(
      ApiResponse.success('Provider created successfully', provider)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Get Providers (List)
// ============================================================

const getProviders = async (req, res, next) => {
  try {
    const { type, status, lat, lng, radius, openNow, page, limit } = req.query;
    
    const result = await providerService.getProviders({
      type,
      status,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      radius: radius ? parseFloat(radius) : undefined,
      openNow: openNow === 'true',
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    
    res.json(
      ApiResponse.success('Providers retrieved', result.providers, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Get Provider by ID
// ============================================================

const getProviderById = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    
    const provider = await providerService.getProviderById(providerId);
    
    res.json(
      ApiResponse.success('Provider retrieved', provider)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Update Provider
// ============================================================

const updateProvider = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const updateData = req.body;
    
    const provider = await providerService.updateProvider(
      providerId,
      userId,
      role,
      updateData
    );
    
    res.json(
      ApiResponse.success('Provider updated', provider)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Toggle Provider Open/Closed Status
// ============================================================

const toggleProviderStatus = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { isOpen } = req.body;
    
    const provider = await providerService.toggleProviderStatus(
      providerId,
      userId,
      role,
      { isOpen }
    );
    
    res.json(
      ApiResponse.success('Provider status updated', provider)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Get Provider Wallet
// ============================================================

const getProviderWallet = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    
    const wallet = await providerService.getProviderWallet(providerId, userId, role);
    
    res.json(
      ApiResponse.success('Provider wallet retrieved', wallet)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Get Provider Orders
// ============================================================

const getProviderOrders = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { status, page, limit } = req.query;
    
    const result = await providerService.getProviderOrders(
      providerId,
      userId,
      role,
      {
        status,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
      }
    );
    
    res.json(
      ApiResponse.success('Provider orders retrieved', result.requests, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Update Provider Commission (Admin only)
// ============================================================

const updateProviderCommission = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const { commissionRate } = req.body;

    const provider = await providerService.updateProviderCommission(
      providerId,
      { commissionRate }
    );

    res.json(
      ApiResponse.success('Provider commission updated', provider)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Admin Provider Controllers
// ============================================================

const getPendingProviders = async (req, res, next) => {
  try {
    const { page, limit } = req.query;

    const result = await providerService.getPendingProviders({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    res.json(
      ApiResponse.success('Pending providers retrieved', result.providers, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

const approveProvider = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const adminId = req.user.id;

    const provider = await providerService.approveProvider(providerId, adminId);

    res.json(
      ApiResponse.success('Provider approved', provider)
    );
  } catch (error) {
    next(error);
  }
};

const rejectProvider = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const provider = await providerService.rejectProvider(providerId, reason, adminId);

    res.json(
      ApiResponse.success('Provider rejected', provider)
    );
  } catch (error) {
    next(error);
  }
};

const suspendProvider = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const provider = await providerService.suspendProvider(providerId, reason, adminId);

    res.json(
      ApiResponse.success('Provider suspended', provider)
    );
  } catch (error) {
    next(error);
  }
};

const unsuspendProvider = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const adminId = req.user.id;

    const provider = await providerService.unsuspendProvider(providerId, adminId);

    res.json(
      ApiResponse.success('Provider unsuspended', provider)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Merchant Dashboard Controllers
// ============================================================

const getMerchantProfile = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const provider = await providerService.getMerchantProfile(providerId, userId, role);

    res.json(
      ApiResponse.success('Merchant profile retrieved', provider)
    );
  } catch (error) {
    next(error);
  }
};

const updateMerchantProfile = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const updateData = req.body;

    const provider = await providerService.updateMerchantProfile(providerId, userId, role, updateData);

    res.json(
      ApiResponse.success('Merchant profile updated', provider)
    );
  } catch (error) {
    next(error);
  }
};

const getMerchantOrders = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { status, page, limit } = req.query;

    const result = await providerService.getMerchantOrders(
      providerId,
      userId,
      role,
      {
        status,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
      }
    );

    res.json(
      ApiResponse.success('Merchant orders retrieved', result.requests, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

const acceptMerchantOrder = async (req, res, next) => {
  try {
    const { providerId, requestId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const request = await providerService.acceptMerchantOrder(providerId, userId, role, requestId);

    res.json(
      ApiResponse.success('Order accepted', request)
    );
  } catch (error) {
    next(error);
  }
};

const rejectMerchantOrder = async (req, res, next) => {
  try {
    const { providerId, requestId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { reason } = req.body;

    const request = await providerService.rejectMerchantOrder(providerId, userId, role, requestId, reason);

    res.json(
      ApiResponse.success('Order rejected', request)
    );
  } catch (error) {
    next(error);
  }
};

const updateMerchantOrderStatus = async (req, res, next) => {
  try {
    const { providerId, requestId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { status } = req.body;

    const request = await providerService.updateMerchantOrderStatus(providerId, userId, role, requestId, status);

    res.json(
      ApiResponse.success('Order status updated', request)
    );
  } catch (error) {
    next(error);
  }
};

const getMerchantWallet = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const wallet = await providerService.getMerchantWallet(providerId, userId, role);

    res.json(
      ApiResponse.success('Merchant wallet retrieved', wallet)
    );
  } catch (error) {
    next(error);
  }
};

const requestMerchantWithdrawal = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { amount, bankAccount } = req.body;

    const withdrawal = await providerService.requestMerchantWithdrawal(providerId, userId, role, { amount, bankAccount });

    res.json(
      ApiResponse.success('Withdrawal requested', withdrawal)
    );
  } catch (error) {
    next(error);
  }
};

const getMerchantProducts = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { page, limit } = req.query;

    const result = await providerService.getMerchantProducts(
      providerId,
      userId,
      role,
      {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
      }
    );

    res.json(
      ApiResponse.success('Merchant products retrieved', result.products, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

const createMerchantProduct = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const productData = req.body;

    const product = await providerService.createMerchantProduct(providerId, userId, role, productData);

    res.status(201).json(
      ApiResponse.success('Product created', product)
    );
  } catch (error) {
    next(error);
  }
};

const updateMerchantProduct = async (req, res, next) => {
  try {
    const { providerId, productId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const productData = req.body;

    const product = await providerService.updateMerchantProduct(providerId, userId, role, productId, productData);

    res.json(
      ApiResponse.success('Product updated', product)
    );
  } catch (error) {
    next(error);
  }
};

const deleteMerchantProduct = async (req, res, next) => {
  try {
    const { providerId, productId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    await providerService.deleteMerchantProduct(providerId, userId, role, productId);

    res.json(
      ApiResponse.success('Product deleted', { success: true })
    );
  } catch (error) {
    next(error);
  }
};

const toggleMerchantProductAvailability = async (req, res, next) => {
  try {
    const { providerId, productId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { isAvailable } = req.body;

    const product = await providerService.toggleMerchantProductAvailability(providerId, userId, role, productId, isAvailable);

    res.json(
      ApiResponse.success('Product availability updated', product)
    );
  } catch (error) {
    next(error);
  }
};

const getMerchantSalesSummary = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { period = '7d' } = req.query;

    const summary = await providerService.getMerchantSalesSummary(providerId, userId, role, { period });

    res.json(
      ApiResponse.success('Sales summary retrieved', summary)
    );
  } catch (error) {
    next(error);
  }
};

const getMerchantOrderHistory = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { page, limit, startDate, endDate } = req.query;

    const result = await providerService.getMerchantOrderHistory(
      providerId,
      userId,
      role,
      {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        startDate,
        endDate,
      }
    );

    res.json(
      ApiResponse.success('Order history retrieved', result.requests, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

const getMerchantEarningsBreakdown = async (req, res, next) => {
  try {
    const { providerId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { period = '7d' } = req.query;

    const breakdown = await providerService.getMerchantEarningsBreakdown(providerId, userId, role, { period });

    res.json(
      ApiResponse.success('Earnings breakdown retrieved', breakdown)
    );
  } catch (error) {
    next(error);
  }
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
  // Admin controllers
  getPendingProviders,
  approveProvider,
  rejectProvider,
  suspendProvider,
  unsuspendProvider,
  // Merchant dashboard controllers
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
