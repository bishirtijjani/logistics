/**
 * Merchant routes — /api/merchants
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
  merchantProductsSchema,
  createProductSchema,
  updateProductSchema,
  toggleProductAvailabilitySchema,
  merchantAnalyticsSchema,
  merchantOrderHistorySchema,
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

// Merchant products
router.get('/merchant/:merchantId/products', authorize('MERCHANT'), validate(merchantProductsSchema, 'query'), merchantController.getMerchantProducts);
router.post('/merchant/:merchantId/products', authorize('MERCHANT'), validate(createProductSchema), merchantController.createMerchantProduct);
router.put('/merchant/:merchantId/products/:productId', authorize('MERCHANT'), validate(updateProductSchema), merchantController.updateMerchantProduct);
router.delete('/merchant/:merchantId/products/:productId', authorize('MERCHANT'), merchantController.deleteMerchantProduct);
router.patch('/merchant/:merchantId/products/:productId/availability', authorize('MERCHANT'), validate(toggleProductAvailabilitySchema), merchantController.toggleMerchantProductAvailability);

// Merchant analytics
router.get('/merchant/:merchantId/analytics/sales', authorize('MERCHANT'), validate(merchantAnalyticsSchema, 'query'), merchantController.getMerchantSalesSummary);
router.get('/merchant/:merchantId/analytics/orders', authorize('MERCHANT'), validate(merchantOrderHistorySchema, 'query'), merchantController.getMerchantOrderHistory);
router.get('/merchant/:merchantId/analytics/earnings', authorize('MERCHANT'), validate(merchantAnalyticsSchema, 'query'), merchantController.getMerchantEarningsBreakdown);

module.exports = router;
