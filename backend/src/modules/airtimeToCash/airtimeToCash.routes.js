const { Router } = require('express');
const controller = require('./airtimeToCash.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { idempotency } = require('../../middlewares/idempotency.middleware');
const {
  initiateSchema,
  verifySchema,
  submitSchema,
  historySchema,
} = require('./airtimeToCash.validator');

const router = Router();

router.use(authenticate);
router.use(authorize('CUSTOMER'));

router.get('/config', controller.getConfig);

router.post('/initiate', idempotency, validate(initiateSchema), controller.initiate);
router.post('/verify', validate(verifySchema), controller.verify);
router.post('/submit', idempotency, validate(submitSchema), controller.submit);

router.get('/history', validate(historySchema, 'query'), controller.getHistory);
router.get('/:id', controller.getTransaction);

module.exports = router;
