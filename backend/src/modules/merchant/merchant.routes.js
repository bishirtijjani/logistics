/**
 * Merchant routes — /merchants
 * Merchant management endpoints
 */

const { Router } = require('express');
const merchantController = require('./merchant.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const {
  createMerchantSchema,
  updateMerchantSchema,
  listMerchantsSchema,
  toggleMerchantStatusSchema,
  updateCommissionSchema,
  // Merchant dashboard schemas
  updateMerchantProfileSchema,
  merchantOrdersSchema,
  rejectOrderSchema,
  updateOrderStatusSchema,
  requestWithdrawalSchema,
  saveBankAccountSchema,
  merchantProductsSchema,
  createProductSchema,
  updateProductSchema,
  toggleProductAvailabilitySchema,
  merchantAnalyticsSchema,
  merchantOrderHistorySchema,
  variantInputSchema,
  updateVariantSchema,
  optionGroupInputSchema,
  optionGroupUpdateSchema,
  optionItemInputSchema,
  optionItemUpdateSchema,
} = require('./merchant.validator');

const router = Router();

// All merchant routes require authentication
router.use(authenticate);

// ============================================================
// Public endpoints (any authenticated user)
// ============================================================

// Browse merchants (with filters)
router.get('/', validate(listMerchantsSchema, 'query'), merchantController.getMerchants);

// Get merchant details
router.get('/:merchantId', merchantController.getMerchantById);

// ============================================================
// Merchant endpoints
// ============================================================

// Update merchant profile
router.patch('/:merchantId', authorize('MERCHANT', 'ADMIN'), validate(updateMerchantSchema), merchantController.updateMerchant);

// Toggle open/closed status
router.patch('/:merchantId/status', authorize('MERCHANT', 'ADMIN'), validate(toggleMerchantStatusSchema), merchantController.toggleMerchantStatus);

// Get merchant wallet
router.get('/:merchantId/wallet', authorize('MERCHANT', 'ADMIN'), merchantController.getMerchantWallet);

// Get merchant orders
router.get('/:merchantId/orders', authorize('MERCHANT', 'ADMIN'), merchantController.getMerchantOrders);

// ============================================================
// Admin endpoints
// ============================================================

// Create merchant (admin only)
router.post('/', authorize('ADMIN'), validate(createMerchantSchema), merchantController.createMerchant);

// Update merchant commission (admin only)
router.patch('/:merchantId/commission', authorize('ADMIN'), validate(updateCommissionSchema), merchantController.updateMerchantCommission);

// Get pending merchants (admin only)
router.get('/admin/pending', authorize('ADMIN'), merchantController.getPendingMerchants);

// Approve merchant (admin only)
router.patch('/:merchantId/approve', authorize('ADMIN'), merchantController.approveMerchant);

// Reject merchant (admin only)
router.patch('/:merchantId/reject', authorize('ADMIN'), merchantController.rejectMerchant);

// Suspend merchant (admin only)
router.patch('/:merchantId/suspend', authorize('ADMIN'), merchantController.suspendMerchant);

// Unsuspend merchant (admin only)
router.patch('/:merchantId/unsuspend', authorize('ADMIN'), merchantController.unsuspendMerchant);

// Delete merchant (admin only)
router.delete('/:merchantId', authorize('ADMIN'), merchantController.deleteMerchant);

// ============================================================
// Merchant Dashboard Endpoints
// ============================================================

// Merchant profile
router.get('/merchant/:merchantId/profile', authorize('MERCHANT'), merchantController.getMerchantProfile);
router.patch('/merchant/:merchantId/profile', authorize('MERCHANT'), validate(updateMerchantProfileSchema), merchantController.updateMerchant);

// Merchant orders
router.get('/merchant/:merchantId/orders', authorize('MERCHANT'), validate(merchantOrdersSchema, 'query'), merchantController.getMerchantOrders);
router.patch('/merchant/:merchantId/orders/:requestId/accept', authorize('MERCHANT'), merchantController.acceptMerchantOrder);
router.patch('/merchant/:merchantId/orders/:requestId/reject', authorize('MERCHANT'), validate(rejectOrderSchema), merchantController.rejectMerchantOrder);
router.patch('/merchant/:merchantId/orders/:requestId/status', authorize('MERCHANT'), validate(updateOrderStatusSchema), merchantController.updateMerchantOrderStatus);

// Merchant wallet
router.get('/merchant/:merchantId/wallet', authorize('MERCHANT'), merchantController.getMerchantWallet);
router.post('/merchant/:merchantId/wallet/withdraw', authorize('MERCHANT'), validate(requestWithdrawalSchema), merchantController.requestMerchantWithdrawal);

// Merchant payout bank account (saved once, reused for every withdrawal)
router.get('/merchant/:merchantId/bank-account', authorize('MERCHANT'), merchantController.getMerchantBankAccount);
router.put('/merchant/:merchantId/bank-account', authorize('MERCHANT'), validate(saveBankAccountSchema), merchantController.saveMerchantBankAccount);

// Merchant products
// Admins share these routes (not a separate /admin namespace) because the service
// layer is already role-aware: the ownership guard is skipped when role === 'ADMIN',
// so admins can manage any merchant's catalogue from the admin dashboard.
router.get('/merchant/:merchantId/products', authorize('MERCHANT', 'ADMIN'), validate(merchantProductsSchema, 'query'), merchantController.getMerchantProducts);
router.get('/merchant/:merchantId/products/:productId', authorize('MERCHANT', 'ADMIN'), merchantController.getMerchantProductById);
router.post('/merchant/:merchantId/products', authorize('MERCHANT', 'ADMIN'), validate(createProductSchema), merchantController.createMerchantProduct);
router.put('/merchant/:merchantId/products/:productId', authorize('MERCHANT', 'ADMIN'), validate(updateProductSchema), merchantController.updateMerchantProduct);
router.delete('/merchant/:merchantId/products/:productId', authorize('MERCHANT', 'ADMIN'), merchantController.deleteMerchantProduct);
router.patch('/merchant/:merchantId/products/:productId/availability', authorize('MERCHANT', 'ADMIN'), validate(toggleProductAvailabilitySchema), merchantController.toggleMerchantProductAvailability);

// Product variants (nested)
router.post('/merchant/:merchantId/products/:productId/variants', authorize('MERCHANT', 'ADMIN'), validate(variantInputSchema), merchantController.createProductVariant);
router.patch('/merchant/:merchantId/products/:productId/variants/:variantId', authorize('MERCHANT', 'ADMIN'), validate(updateVariantSchema), merchantController.updateProductVariant);
router.delete('/merchant/:merchantId/products/:productId/variants/:variantId', authorize('MERCHANT', 'ADMIN'), merchantController.deleteProductVariant);

// Product option groups (food customization)
router.post('/merchant/:merchantId/products/:productId/option-groups', authorize('MERCHANT', 'ADMIN'), validate(optionGroupInputSchema), merchantController.createOptionGroup);
router.patch('/merchant/:merchantId/products/:productId/option-groups/:groupId', authorize('MERCHANT', 'ADMIN'), validate(optionGroupUpdateSchema), merchantController.updateOptionGroup);
router.delete('/merchant/:merchantId/products/:productId/option-groups/:groupId', authorize('MERCHANT', 'ADMIN'), merchantController.deleteOptionGroup);

// Bulk-upsert all option groups + items in one shot (menu import / template apply).
// Body: { groups: [{ id?, name, selectionRule, minSelect, maxSelect, sortOrder?, items: [{ id?, name, priceDelta?, isDefault?, isAvailable?, sortOrder? }] }] }
router.put('/merchant/:merchantId/products/:productId/option-groups', authorize('MERCHANT', 'ADMIN'), merchantController.bulkUpsertOptionGroups);

// Option items within a group
router.post('/merchant/:merchantId/products/:productId/option-groups/:groupId/items', authorize('MERCHANT', 'ADMIN'), validate(optionItemInputSchema), merchantController.createOptionItem);
router.patch('/merchant/:merchantId/products/:productId/option-groups/:groupId/items/:itemId', authorize('MERCHANT', 'ADMIN'), validate(optionItemUpdateSchema), merchantController.updateOptionItem);
router.delete('/merchant/:merchantId/products/:productId/option-groups/:groupId/items/:itemId', authorize('MERCHANT', 'ADMIN'), merchantController.deleteOptionItem);

// Merchant analytics
router.get('/merchant/:merchantId/analytics/sales', authorize('MERCHANT'), validate(merchantAnalyticsSchema, 'query'), merchantController.getMerchantSalesSummary);
router.get('/merchant/:merchantId/analytics/orders', authorize('MERCHANT'), validate(merchantOrderHistorySchema, 'query'), merchantController.getMerchantOrderHistory);
router.get('/merchant/:merchantId/analytics/earnings', authorize('MERCHANT'), validate(merchantAnalyticsSchema, 'query'), merchantController.getMerchantEarningsBreakdown);

module.exports = router;
