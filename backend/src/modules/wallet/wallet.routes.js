const { Router } = require('express');
const walletController = require('./wallet.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { pinLimiter } = require('../../middlewares/rate-limit.middleware');
const {
  transferSchema,
  withdrawSchema,
  transactionHistorySchema,
} = require('./wallet.validator');

const router = Router();

// Public — no auth needed for bank list (used pre-login in some flows)
router.get('/banks', walletController.getBanks);

// All routes below require authentication
router.use(authenticate);

router.get('/', walletController.getWallet);
router.post('/transfer', authorize('CUSTOMER', 'RIDER'), pinLimiter, validate(transferSchema), walletController.transfer);
router.post('/withdraw', authorize('CUSTOMER', 'RIDER'), pinLimiter, validate(withdrawSchema), walletController.withdraw);
router.get('/transactions', validate(transactionHistorySchema, 'query'), walletController.getTransactionHistory);

// KatPay transfer payment (ad-hoc top-up)
router.post('/fund', walletController.initiateFunding);
router.get('/fund/:uuid', walletController.getTransferPaymentStatus);

module.exports = router;
