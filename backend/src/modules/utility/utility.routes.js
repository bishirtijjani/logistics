const { Router } = require('express');
const utilityController = require('./utility.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { idempotency } = require('../../middlewares/idempotency.middleware');
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
router.use(authorize('CUSTOMER'));

// Catalogue
router.get('/plans', validate(getPlansSchema, 'query'), utilityController.getPlans);
router.get('/data-plans', validate(getPlansSchema, 'query'), utilityController.getDataPlans);
router.get('/networks', utilityController.getNetworks);
router.get('/discos', utilityController.getDiscos);
router.post('/detect-network', validate(detectNetworkSchema), utilityController.detectNetwork);

// Verification (per Phase 7 spec: POST /verify-meter — legacy GET /validate-* kept for back-compat)
router.post('/verify-meter', validate(validateMeterSchema), utilityController.validateMeter);
router.get('/validate-meter', validate(validateMeterSchema, 'query'), utilityController.validateMeter);
router.get('/validate-iuc', validate(validateIucSchema, 'query'), utilityController.validateIuc);

// Purchases
router.post('/airtime', idempotency, validate(buyAirtimeSchema), utilityController.buyAirtime);
router.post('/data', idempotency, validate(buyDataSchema), utilityController.buyData);
router.post('/cable', idempotency, validate(buyCableSchema), utilityController.buyCable);
router.post('/electricity', idempotency, validate(payElectricitySchema), utilityController.payElectricity);

// History
router.get('/history', validate(billHistorySchema, 'query'), utilityController.getBillHistory);
router.get('/payments/:id', utilityController.getPayment);
router.get('/recent-recipients', validate(recentRecipientsSchema, 'query'), utilityController.getRecentRecipients);

module.exports = router;
