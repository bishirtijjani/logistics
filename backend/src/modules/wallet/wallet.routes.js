/**
 * Wallet routes — /api/v1/wallet
 */

const { Router } = require('express');
const walletController = require('./wallet.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { pinLimiter } = require('../../middlewares/rate-limit.middleware');
const {
  transferSchema,
  withdrawSchema,
  verifyAccountSchema,
  transactionHistorySchema,
} = require('./wallet.validator');

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

router.get('/', walletController.getWallet);
router.post('/transfer', authorize('CUSTOMER', 'RIDER'), pinLimiter, validate(transferSchema), walletController.transfer);
router.post('/withdraw', authorize('CUSTOMER', 'RIDER'), pinLimiter, validate(withdrawSchema), walletController.withdraw);
router.get('/verify-account', validate(verifyAccountSchema, 'query'), walletController.verifyAccount);
router.get('/transactions', validate(transactionHistorySchema, 'query'), walletController.getTransactionHistory);

module.exports = router;
