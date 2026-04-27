/**
 * Delivery routes — /api/delivery
 */

const { Router } = require('express');
const deliveryController = require('./delivery.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const {
  createOrderSchema,
  estimateFareSchema,
  updateStatusSchema,
  rateDeliverySchema,
  listOrdersSchema,
} = require('./delivery.validator');

const router = Router();

router.use(authenticate);

// Fare estimate (any authenticated user)
router.get('/estimate', validate(estimateFareSchema, 'query'), deliveryController.estimateFare);

// Customer creates order
router.post('/orders', authorize('CUSTOMER'), validate(createOrderSchema), deliveryController.createOrder);

// List orders (customers see theirs, riders see theirs)
router.get('/orders', validate(listOrdersSchema, 'query'), deliveryController.getOrders);

// Get single order
router.get('/orders/:orderId', deliveryController.getOrder);

// Update delivery status (rider or system)
router.patch('/orders/:orderId/status', authorize('RIDER', 'ADMIN'), validate(updateStatusSchema), deliveryController.updateStatus);

// Rate delivery (customer only)
router.post('/orders/:orderId/rate', authorize('CUSTOMER'), validate(rateDeliverySchema), deliveryController.rateDelivery);

module.exports = router;
