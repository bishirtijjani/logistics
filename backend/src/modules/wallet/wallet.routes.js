const { Router } = require('express');
const walletController = require('./wallet.controller');
const { validate } = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/role.middleware');
const { pinLimiter } = require('../../middlewares/rate-limit.middleware');
const { idempotency, requireIdempotencyKey } = require('../../middlewares/idempotency.middleware');
const {
  transferSchema,
  withdrawSchema,
  transactionHistorySchema,
} = require('./wallet.validator');

const router = Router();

// Public — bank list (no auth needed for bank picker pre-login)
router.get('/banks', walletController.getBanks);

// All routes below require authentication
router.use(authenticate);

router.get('/', walletController.getWallet);
router.post('/retry-provisioning', walletController.retryProvisioning);
router.post('/transfer', authorize('CUSTOMER', 'RIDER'), pinLimiter, requireIdempotencyKey, idempotency, validate(transferSchema), walletController.transfer);
router.post('/withdraw', authorize('CUSTOMER', 'RIDER'), pinLimiter, requireIdempotencyKey, idempotency, validate(withdrawSchema), walletController.withdraw);
router.get('/transactions', validate(transactionHistorySchema, 'query'), walletController.getTransactionHistory);

// Bank account name lookup
router.post('/banks/lookup', walletController.lookupBankAccount);

// KatPay transfer payment (ad-hoc top-up)
router.post('/fund', walletController.initiateFunding);
router.get('/fund/:uuid', walletController.getTransferPaymentStatus);

// Saved beneficiaries
router.get('/beneficiaries', walletController.getBeneficiaries);
router.post('/beneficiaries', walletController.addBeneficiary);
router.delete('/beneficiaries/:id', walletController.deleteBeneficiary);

// Transaction receipt
router.get('/transactions/:id/receipt', walletController.getReceipt);

module.exports = router;
