/**
 * Utility routes — /api/v1/utilities
 */

const { Router } = require('express');
const utilityController = require('./utility.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const {
  buyAirtimeSchema,
  buyDataSchema,
  payElectricitySchema,
  billHistorySchema,
} = require('./utility.validator');

const router = Router();

router.use(authenticate);
router.use(authorize('CUSTOMER'));

router.post('/airtime', validate(buyAirtimeSchema), utilityController.buyAirtime);
router.post('/data', validate(buyDataSchema), utilityController.buyData);
router.post('/electricity', validate(payElectricitySchema), utilityController.payElectricity);
router.get('/history', validate(billHistorySchema, 'query'), utilityController.getBillHistory);

module.exports = router;
