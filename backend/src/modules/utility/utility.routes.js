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
} = require('./utility.validator');

const router = Router();

router.use(authenticate);
router.use(authorize('CUSTOMER'));

router.get('/plans', validate(getPlansSchema, 'query'), utilityController.getPlans);
router.post('/airtime', idempotency, validate(buyAirtimeSchema), utilityController.buyAirtime);
router.post('/data', idempotency, validate(buyDataSchema), utilityController.buyData);
router.post('/cable', idempotency, validate(buyCableSchema), utilityController.buyCable);
router.post('/electricity', idempotency, validate(payElectricitySchema), utilityController.payElectricity);
router.get('/validate-iuc', validate(validateIucSchema, 'query'), utilityController.validateIuc);
router.get('/validate-meter', validate(validateMeterSchema, 'query'), utilityController.validateMeter);
router.get('/history', validate(billHistorySchema, 'query'), utilityController.getBillHistory);

module.exports = router;
