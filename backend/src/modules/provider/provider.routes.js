/**
 * Provider routes — /api/providers
 * Provider management endpoints
 */

const { Router } = require('express');
const providerController = require('./provider.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const {
  createProviderSchema,
  updateProviderSchema,
  listProvidersSchema,
  toggleProviderStatusSchema,
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
} = require('./provider.validator');

const router = Router();

// All provider routes require authentication
router.use(authenticate);

// ============================================================
// Public endpoints (any authenticated user)
// ============================================================

// Browse providers (with filters)
router.get('/', validate(listProvidersSchema, 'query'), providerController.getProviders);

// Get provider details
router.get('/:providerId', providerController.getProviderById);

// ============================================================
// Provider endpoints
// ============================================================

// Update provider profile
router.patch('/:providerId', authorize('PROVIDER', 'ADMIN'), validate(updateProviderSchema), providerController.updateProvider);

// Toggle open/closed status
router.patch('/:providerId/status', authorize('PROVIDER', 'ADMIN'), validate(toggleProviderStatusSchema), providerController.toggleProviderStatus);

// Get provider wallet
router.get('/:providerId/wallet', authorize('PROVIDER', 'ADMIN'), providerController.getProviderWallet);

// Get provider orders
router.get('/:providerId/orders', authorize('PROVIDER', 'ADMIN'), providerController.getProviderOrders);

// ============================================================
// Admin endpoints
// ============================================================

// Create provider (admin only)
router.post('/', authorize('ADMIN'), validate(createProviderSchema), providerController.createProvider);

// Update provider commission (admin only)
router.patch('/:providerId/commission', authorize('ADMIN'), validate(updateCommissionSchema), providerController.updateProviderCommission);

// Get pending providers (admin only)
router.get('/admin/pending', authorize('ADMIN'), providerController.getPendingProviders);

// Approve provider (admin only)
router.patch('/:providerId/approve', authorize('ADMIN'), providerController.approveProvider);

// Reject provider (admin only)
router.patch('/:providerId/reject', authorize('ADMIN'), providerController.rejectProvider);

// Suspend provider (admin only)
router.patch('/:providerId/suspend', authorize('ADMIN'), providerController.suspendProvider);

// Unsuspend provider (admin only)
router.patch('/:providerId/unsuspend', authorize('ADMIN'), providerController.unsuspendProvider);

// ============================================================
// Merchant Dashboard Endpoints
// ============================================================

// Merchant profile
router.get('/merchant/:providerId/profile', authorize('PROVIDER'), providerController.getMerchantProfile);
router.patch('/merchant/:providerId/profile', authorize('PROVIDER'), validate(updateMerchantProfileSchema), providerController.updateMerchantProfile);

// Merchant orders
router.get('/merchant/:providerId/orders', authorize('PROVIDER'), validate(merchantOrdersSchema, 'query'), providerController.getMerchantOrders);
router.patch('/merchant/:providerId/orders/:requestId/accept', authorize('PROVIDER'), providerController.acceptMerchantOrder);
router.patch('/merchant/:providerId/orders/:requestId/reject', authorize('PROVIDER'), validate(rejectOrderSchema), providerController.rejectMerchantOrder);
router.patch('/merchant/:providerId/orders/:requestId/status', authorize('PROVIDER'), validate(updateOrderStatusSchema), providerController.updateMerchantOrderStatus);

// Merchant wallet
router.get('/merchant/:providerId/wallet', authorize('PROVIDER'), providerController.getMerchantWallet);
router.post('/merchant/:providerId/wallet/withdraw', authorize('PROVIDER'), validate(requestWithdrawalSchema), providerController.requestMerchantWithdrawal);

// Merchant products
router.get('/merchant/:providerId/products', authorize('PROVIDER'), validate(merchantProductsSchema, 'query'), providerController.getMerchantProducts);
router.post('/merchant/:providerId/products', authorize('PROVIDER'), validate(createProductSchema), providerController.createMerchantProduct);
router.put('/merchant/:providerId/products/:productId', authorize('PROVIDER'), validate(updateProductSchema), providerController.updateMerchantProduct);
router.delete('/merchant/:providerId/products/:productId', authorize('PROVIDER'), providerController.deleteMerchantProduct);
router.patch('/merchant/:providerId/products/:productId/availability', authorize('PROVIDER'), validate(toggleProductAvailabilitySchema), providerController.toggleMerchantProductAvailability);

// Merchant analytics
router.get('/merchant/:providerId/analytics/sales', authorize('PROVIDER'), validate(merchantAnalyticsSchema, 'query'), providerController.getMerchantSalesSummary);
router.get('/merchant/:providerId/analytics/orders', authorize('PROVIDER'), validate(merchantOrderHistorySchema, 'query'), providerController.getMerchantOrderHistory);
router.get('/merchant/:providerId/analytics/earnings', authorize('PROVIDER'), validate(merchantAnalyticsSchema, 'query'), providerController.getMerchantEarningsBreakdown);

module.exports = router;
