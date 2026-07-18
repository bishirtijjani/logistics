const { Router } = require('express');
const utilityController = require('./utility.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { idempotency } = require('../../middlewares/idempotency.middleware');
const { utilityPurchaseLimiter, utilityLookupLimiter } = require('../../middlewares/rate-limit.middleware');
const {
  getPlansSchema,
  buyAirtimeSchema,
  buyDataSchema,
  buyCableSchema,
  payElectricitySchema,
  validateIucSchema,
  validateMeterSchema,
  billHistorySchema,
  detectNetworkSchema,
  recentRecipientsSchema,
} = require('./utility.validator');

const router = Router();

router.use(authenticate);
// VTU is available to every wallet-holding role. CUSTOMER/RIDER spend from their
// User wallet; MERCHANT spends from the merchant earnings wallet (funding source
// is resolved per-role in utility.service.deductAndCreate).
router.use(authorize('CUSTOMER', 'RIDER', 'MERCHANT'));

// Catalogue
router.get('/plans', validate(getPlansSchema, 'query'), utilityController.getPlans);
router.get('/data-plans', validate(getPlansSchema, 'query'), utilityController.getDataPlans);
router.get('/networks', utilityController.getNetworks);
router.get('/discos', utilityController.getDiscos);
router.post('/detect-network', utilityLookupLimiter, validate(detectNetworkSchema), utilityController.detectNetwork);

// Verification (per Phase 7 spec: POST /verify-meter - legacy GET /validate-* kept for back-compat)
router.post('/verify-meter', utilityLookupLimiter, validate(validateMeterSchema), utilityController.validateMeter);
router.get('/validate-meter', utilityLookupLimiter, validate(validateMeterSchema, 'query'), utilityController.validateMeter);
router.get('/validate-iuc', utilityLookupLimiter, validate(validateIucSchema, 'query'), utilityController.validateIuc);

// Purchases - rate-limited per user (money leaves the wallet on each call)
router.post('/airtime', utilityPurchaseLimiter, idempotency, validate(buyAirtimeSchema), utilityController.buyAirtime);
router.post('/data', utilityPurchaseLimiter, idempotency, validate(buyDataSchema), utilityController.buyData);
router.post('/cable', utilityPurchaseLimiter, idempotency, validate(buyCableSchema), utilityController.buyCable);
router.post('/electricity', utilityPurchaseLimiter, idempotency, validate(payElectricitySchema), utilityController.payElectricity);

// History
router.get('/history', validate(billHistorySchema, 'query'), utilityController.getBillHistory);
router.get('/payments/:id', utilityController.getPayment);
router.get('/recent-recipients', validate(recentRecipientsSchema, 'query'), utilityController.getRecentRecipients);

module.exports = router;
