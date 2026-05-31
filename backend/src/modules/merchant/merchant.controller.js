/**
 * Merchant controller — handles HTTP requests for merchant operations
 */

const merchantService = require('./merchant.service');
const { ApiResponse } = require('../../utils/api-response');

// ============================================================
// Create Merchant (Admin only)
// ============================================================

const createMerchant = async (req, res, next) => {
  try {
    const merchantData = req.body;
    
    const merchant = await merchantService.createMerchant(merchantData);
    
    res.status(201).json(
      ApiResponse.success('Merchant created successfully', merchant)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Get Merchants (List)
// ============================================================

const getMerchants = async (req, res, next) => {
  try {
    const { categoryId, categorySlug, status, lat, lng, radius, openNow, page, limit } = req.query;

    const result = await merchantService.getMerchants({
      categoryId,
      categorySlug,
      status,
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      radius: radius ? parseFloat(radius) : undefined,
      openNow: openNow === 'true',
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    
    res.json(
      ApiResponse.success('Merchants retrieved', result.merchants, {
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
// Get Merchant by ID
// ============================================================

const getMerchantById = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    
    const merchant = await merchantService.getMerchantById(merchantId);
    
    res.json(
      ApiResponse.success('Merchant retrieved', merchant)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Update Merchant
// ============================================================

const updateMerchant = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const updateData = req.body;
    
    const merchant = await merchantService.updateMerchant(
      merchantId,
      userId,
      role,
      updateData
    );
    
    res.json(
      ApiResponse.success('Merchant updated', merchant)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Toggle Merchant Open/Closed Status
// ============================================================

const toggleMerchantStatus = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { isOpen } = req.body;
    
    const merchant = await merchantService.toggleMerchantStatus(
      merchantId,
      userId,
      role,
      { isOpen }
    );
    
    res.json(
      ApiResponse.success('Merchant status updated', merchant)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Get Merchant Wallet
// ============================================================

const getMerchantWallet = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    
    const wallet = await merchantService.getMerchantWallet(merchantId, userId, role);
    
    res.json(
      ApiResponse.success('Merchant wallet retrieved', wallet)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Get Merchant Orders
// ============================================================

const getMerchantOrders = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { status, page, limit } = req.query;
    
    const result = await merchantService.getMerchantOrders(
      merchantId,
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

// ============================================================
// Update Merchant Commission (Admin only)
// ============================================================

const updateMerchantCommission = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const { commissionRate } = req.body;

    const merchant = await merchantService.updateMerchantCommission(
      merchantId,
      { commissionRate }
    );

    res.json(
      ApiResponse.success('Merchant commission updated', merchant)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Admin Merchant Controllers
// ============================================================

const getPendingMerchants = async (req, res, next) => {
  try {
    const { page, limit } = req.query;

    const result = await merchantService.getPendingMerchants({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });

    res.json(
      ApiResponse.success('Pending merchants retrieved', result.merchants, {
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

const approveMerchant = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const adminId = req.user.id;

    const merchant = await merchantService.approveMerchant(merchantId, adminId);

    res.json(
      ApiResponse.success('Merchant approved', merchant)
    );
  } catch (error) {
    next(error);
  }
};

const rejectMerchant = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const merchant = await merchantService.rejectMerchant(merchantId, reason, adminId);

    res.json(
      ApiResponse.success('Merchant rejected', merchant)
    );
  } catch (error) {
    next(error);
  }
};

const suspendMerchant = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const merchant = await merchantService.suspendMerchant(merchantId, reason, adminId);

    res.json(
      ApiResponse.success('Merchant suspended', merchant)
    );
  } catch (error) {
    next(error);
  }
};

const unsuspendMerchant = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const adminId = req.user.id;

    const merchant = await merchantService.unsuspendMerchant(merchantId, adminId);

    res.json(
      ApiResponse.success('Merchant unsuspended', merchant)
    );
  } catch (error) {
    next(error);
  }
};

const deleteMerchant = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const adminId = req.user.id;

    await merchantService.deleteMerchant(merchantId, adminId);

    res.json(
      ApiResponse.success('Merchant deleted successfully', { success: true })
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
    const { merchantId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const merchant = await merchantService.getMerchantProfile(merchantId, userId, role);

    res.json(
      ApiResponse.success('Merchant profile retrieved', merchant)
    );
  } catch (error) {
    next(error);
  }
};

const acceptMerchantOrder = async (req, res, next) => {
  try {
    const { merchantId, requestId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const request = await merchantService.acceptMerchantOrder(merchantId, userId, role, requestId);

    res.json(
      ApiResponse.success('Order accepted', request)
    );
  } catch (error) {
    next(error);
  }
};

const rejectMerchantOrder = async (req, res, next) => {
  try {
    const { merchantId, requestId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { reason } = req.body;

    const request = await merchantService.rejectMerchantOrder(merchantId, userId, role, requestId, reason);

    res.json(
      ApiResponse.success('Order rejected', request)
    );
  } catch (error) {
    next(error);
  }
};

const updateMerchantOrderStatus = async (req, res, next) => {
  try {
    const { merchantId, requestId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { status } = req.body;

    const request = await merchantService.updateMerchantOrderStatus(merchantId, userId, role, requestId, status);

    res.json(
      ApiResponse.success('Order status updated', request)
    );
  } catch (error) {
    next(error);
  }
};

const requestMerchantWithdrawal = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { amount } = req.body;

    const withdrawal = await merchantService.requestMerchantWithdrawal(merchantId, userId, role, { amount });

    res.json(
      ApiResponse.success('Withdrawal requested', withdrawal)
    );
  } catch (error) {
    next(error);
  }
};

const getMerchantBankAccount = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const account = await merchantService.getMerchantBankAccount(merchantId, req.user.id, req.user.role);

    res.json(
      ApiResponse.success('Bank account retrieved', account)
    );
  } catch (error) {
    next(error);
  }
};

const saveMerchantBankAccount = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const { bankCode, accountNumber, accountName } = req.body;
    const account = await merchantService.saveMerchantBankAccount(merchantId, req.user.id, req.user.role, {
      bankCode,
      accountNumber,
      accountName,
    });

    res.json(
      ApiResponse.success('Bank account saved', account)
    );
  } catch (error) {
    next(error);
  }
};

const getMerchantProducts = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { page, limit } = req.query;

    const result = await merchantService.getMerchantProducts(
      merchantId,
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
    const { merchantId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const productData = req.body;

    const product = await merchantService.createMerchantProduct(merchantId, userId, role, productData);

    res.status(201).json(
      ApiResponse.success('Product created', product)
    );
  } catch (error) {
    next(error);
  }
};

const updateMerchantProduct = async (req, res, next) => {
  try {
    const { merchantId, productId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const productData = req.body;

    const product = await merchantService.updateMerchantProduct(merchantId, userId, role, productId, productData);

    res.json(
      ApiResponse.success('Product updated', product)
    );
  } catch (error) {
    next(error);
  }
};

const deleteMerchantProduct = async (req, res, next) => {
  try {
    const { merchantId, productId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    await merchantService.deleteMerchantProduct(merchantId, userId, role, productId);

    res.json(
      ApiResponse.success('Product deleted', { success: true })
    );
  } catch (error) {
    next(error);
  }
};

const toggleMerchantProductAvailability = async (req, res, next) => {
  try {
    const { merchantId, productId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { isAvailable } = req.body;

    const product = await merchantService.toggleMerchantProductAvailability(merchantId, userId, role, productId, isAvailable);

    res.json(
      ApiResponse.success('Product availability updated', product)
    );
  } catch (error) {
    next(error);
  }
};

const getMerchantSalesSummary = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { period = '7d' } = req.query;

    const summary = await merchantService.getMerchantSalesSummary(merchantId, userId, role, { period });

    res.json(
      ApiResponse.success('Sales summary retrieved', summary)
    );
  } catch (error) {
    next(error);
  }
};

const getMerchantOrderHistory = async (req, res, next) => {
  try {
    const { merchantId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { page, limit, startDate, endDate } = req.query;

    const result = await merchantService.getMerchantOrderHistory(
      merchantId,
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
    const { merchantId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    const { period = '7d' } = req.query;

    const breakdown = await merchantService.getMerchantEarningsBreakdown(merchantId, userId, role, { period });

    res.json(
      ApiResponse.success('Earnings breakdown retrieved', breakdown)
    );
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Variant + Option-group Controllers
// ============================================================

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};

const getMerchantProductById = wrap(async (req, res) => {
  const { merchantId, productId } = req.params;
  const product = await merchantService.getMerchantProductById(merchantId, req.user.id, req.user.role, productId);
  res.json(ApiResponse.success('Product retrieved', product));
});

const createProductVariant = wrap(async (req, res) => {
  const { merchantId, productId } = req.params;
  const variant = await merchantService.createProductVariant(merchantId, req.user.id, req.user.role, productId, req.body);
  res.status(201).json(ApiResponse.success('Variant created', variant));
});

const updateProductVariant = wrap(async (req, res) => {
  const { merchantId, productId, variantId } = req.params;
  const variant = await merchantService.updateProductVariant(merchantId, req.user.id, req.user.role, productId, variantId, req.body);
  res.json(ApiResponse.success('Variant updated', variant));
});

const deleteProductVariant = wrap(async (req, res) => {
  const { merchantId, productId, variantId } = req.params;
  await merchantService.deleteProductVariant(merchantId, req.user.id, req.user.role, productId, variantId);
  res.json(ApiResponse.success('Variant deleted', { success: true }));
});

const createOptionGroup = wrap(async (req, res) => {
  const { merchantId, productId } = req.params;
  const group = await merchantService.createOptionGroup(merchantId, req.user.id, req.user.role, productId, req.body);
  res.status(201).json(ApiResponse.success('Option group created', group));
});

const updateOptionGroup = wrap(async (req, res) => {
  const { merchantId, productId, groupId } = req.params;
  const group = await merchantService.updateOptionGroup(merchantId, req.user.id, req.user.role, productId, groupId, req.body);
  res.json(ApiResponse.success('Option group updated', group));
});

const deleteOptionGroup = wrap(async (req, res) => {
  const { merchantId, productId, groupId } = req.params;
  await merchantService.deleteOptionGroup(merchantId, req.user.id, req.user.role, productId, groupId);
  res.json(ApiResponse.success('Option group deleted', { success: true }));
});

const createOptionItem = wrap(async (req, res) => {
  const { merchantId, productId, groupId } = req.params;
  const item = await merchantService.createOptionItem(merchantId, req.user.id, req.user.role, productId, groupId, req.body);
  res.status(201).json(ApiResponse.success('Option item created', item));
});

const updateOptionItem = wrap(async (req, res) => {
  const { merchantId, productId, groupId, itemId } = req.params;
  const item = await merchantService.updateOptionItem(merchantId, req.user.id, req.user.role, productId, groupId, itemId, req.body);
  res.json(ApiResponse.success('Option item updated', item));
});

const deleteOptionItem = wrap(async (req, res) => {
  const { merchantId, productId, groupId, itemId } = req.params;
  await merchantService.deleteOptionItem(merchantId, req.user.id, req.user.role, productId, groupId, itemId);
  res.json(ApiResponse.success('Option item deleted', { success: true }));
});

const bulkUpsertOptionGroups = wrap(async (req, res) => {
  const { merchantId, productId } = req.params;
  const groups = await merchantService.bulkUpsertOptionGroups(
    merchantId,
    req.user.id,
    req.user.role,
    productId,
    req.body.groups || [],
  );
  res.json(ApiResponse.success('Option groups synced', groups));
});

module.exports = {
  createMerchant,
  getMerchants,
  getMerchantById,
  updateMerchant,
  toggleMerchantStatus,
  getMerchantWallet,
  getMerchantOrders,
  updateMerchantCommission,
  // Admin controllers
  getPendingMerchants,
  approveMerchant,
  rejectMerchant,
  suspendMerchant,
  unsuspendMerchant,
  deleteMerchant,
  // Merchant dashboard controllers
  getMerchantProfile,
  acceptMerchantOrder,
  rejectMerchantOrder,
  updateMerchantOrderStatus,
  requestMerchantWithdrawal,
  getMerchantBankAccount,
  saveMerchantBankAccount,
  getMerchantProducts,
  createMerchantProduct,
  updateMerchantProduct,
  deleteMerchantProduct,
  toggleMerchantProductAvailability,
  getMerchantSalesSummary,
  getMerchantOrderHistory,
  getMerchantEarningsBreakdown,
  // variants + option groups
  getMerchantProductById,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
  createOptionGroup,
  updateOptionGroup,
  deleteOptionGroup,
  createOptionItem,
  updateOptionItem,
  deleteOptionItem,
  bulkUpsertOptionGroups,
};
