const { Worker } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, PAYMENT_JOBS } = require('../jobs');
const { logger } = require('../../utils/logger');
const { prisma } = require('../../config/database');
const walletService = require('../../modules/wallet/wallet.service');
const paystackService = require('../../services/paystack.service');
const notifyService = require('../../services/notify.service');
const reconciliationService = require('../../services/reconciliation.service');

const startPaymentWorker = () => {
  const worker = new Worker(
    QUEUES.PAYMENT,
    async (job) => {
      logger.info(`Processing payment job: ${job.name}`, { jobId: job.id });

      switch (job.name) {
        case PAYMENT_JOBS.PROCESS_PAYSTACK_CHARGE:
          return handlePaystackCharge(job.data);

        case PAYMENT_JOBS.PROCESS_PAYSTACK_TRANSFER:
          return handlePaystackTransfer(job.data);

        case PAYMENT_JOBS.PROCESS_KATPAY_WEBHOOK:
          return handleKatpayVirtualAccountPayment(job.data);

        case PAYMENT_JOBS.PROCESS_WITHDRAWAL:
          return handleWithdrawal(job.data);

        case PAYMENT_JOBS.PROVISION_VIRTUAL_ACCOUNT:
          return handleProvisionVirtualAccount(job.data);

        case PAYMENT_JOBS.RETRY_FAILED_TRANSACTION:
          return handleRetry(job.data);

        case PAYMENT_JOBS.CLEANUP_EXPIRED_IDEMPOTENCY:
          return handleCleanupExpiredIdempotency();

        case PAYMENT_JOBS.RUN_RECONCILIATION:
          return handleRunReconciliation();

        default:
          logger.warn(`Unknown payment job type: ${job.name}`);
      }
    },
    {
      connection: redis,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Payment job completed: ${job.name}`, { jobId: job.id });
  });

  worker.on('failed', (job, error) => {
    logger.error(`Payment job failed: ${job.name}`, {
      jobId: job.id,
      error: error.message,
      attemptsMade: job.attemptsMade,
    });
    const { captureError } = require('../../utils/sentry');
    captureError(error, {
      queue: 'payment-queue',
      jobName: job?.name,
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
    });
  });

  return worker;
};

/**
 * Delete expired idempotency-key reservations.
 * Runs nightly (scheduled in queues/index.js) to keep the table from growing
 * unbounded. Each row has a 24h TTL set by the middleware; once expired, the
 * row is dead weight.
 */
const handleCleanupExpiredIdempotency = async () => {
  const result = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  logger.info('Idempotency cleanup completed', { deleted: result.count });
  return result.count;
};

/**
 * Nightly ledger reconciliation.
 *
 * Runs the wallet-parity + escrow-conservation invariants, persists the report
 * as an AuditLog row, and surfaces failures via logger.error (which Sentry
 * picks up). Phase 10 will plug an admin email alert into the failure branch.
 */
const handleRunReconciliation = async () => {
  const report = await reconciliationService.runReconciliation();
  await reconciliationService.persistReport(report);
  return report;
};

/**
 * Credit a wallet from a Paystack charge.success event (Dedicated Virtual
 * Account funding, or a hosted top-up). The webhook resolved either the DVA
 * account number or the wallet's userId; we fund idempotently by Paystack's
 * transaction reference.
 */
const handlePaystackCharge = async ({ transactionRef, accountNumber, userId, amount, reference, eventData }) => {
  const webhookEvent = await prisma.webhookEvent.findUnique({ where: { transactionRef } });
  if (!webhookEvent || webhookEvent.processed) {
    logger.info('Paystack charge webhook already processed or missing', { transactionRef });
    return;
  }

  try {
    // Resolve the funding account number. DVA payments carry the receiver
    // account; top-ups carry only the userId, so map that to the wallet's NUBAN.
    let acct = accountNumber;
    if (!acct && userId) {
      const wallet = await prisma.wallet.findUnique({ where: { userId }, select: { virtualAccountNumber: true } });
      acct = wallet?.virtualAccountNumber;
    }

    if (!acct) {
      logger.warn('Paystack charge webhook: could not resolve funding account', { transactionRef, reference });
    } else {
      await walletService.fundWallet({
        accountNumber: acct,
        amount,
        reference: reference || transactionRef,
        metadata: eventData,
        provider: 'PAYSTACK',
      });
    }

    await prisma.webhookEvent.update({
      where: { transactionRef },
      data: { processed: true, processedAt: new Date() },
    });
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { transactionRef },
      data: { error: error.message },
    });
    throw error;
  }
};

/**
 * Complete a user/rider withdrawal Transaction (SENT→COMPLETED) and notify.
 */
const completeUserWithdrawal = async (txn) => {
  const completed = await prisma.transaction.updateMany({
    where: { reference: txn.reference, status: 'SENT' },
    data: { status: 'COMPLETED' },
  });
  if (completed.count !== 1) return; // already settled / refunded - no-op
  logger.info('Withdrawal payout completed (webhook)', { transactionId: txn.reference });

  const userId = txn.debitWalletId
    ? (await prisma.wallet.findUnique({ where: { id: txn.debitWalletId }, select: { userId: true } }))?.userId
    : null;
  if (userId) {
    const freshWallet = await prisma.wallet.findUnique({ where: { userId }, select: { balance: true } });
    if (freshWallet) notifyService.balanceUpdated(userId, { balance: Number(freshWallet.balance) });
    notifyService.onWalletEvent(userId, {
      kind: 'WITHDRAWAL',
      amount: Number(txn.amount),
      transactionId: txn.reference,
      route: '/wallet',
    }).catch((err) => logger.warn('WITHDRAWAL notification failed', { error: err.message }));
  }
};

/**
 * Complete a merchant withdrawal (MerchantWalletTransaction) + mirror the ledger.
 * Ported from the old KatPay payout.processed branch; matches by our reference.
 */
const completeMerchantWithdrawal = async (mwt) => {
  await prisma.$transaction(async (tx) => {
    const completed = await tx.merchantWalletTransaction.updateMany({
      where: { id: mwt.id, status: { in: ['PENDING', 'PROCESSING'] } },
      data: { status: 'COMPLETED', processedAt: new Date() },
    });
    if (completed.count === 1) {
      // New unified withdrawals carry a mirror Transaction on the merchant's User
      // wallet (funds already debited at request time) → complete it. Legacy rows
      // reserved funds in merchantWallet.pendingBalance → release that.
      const ledger = await tx.transaction.findFirst({ where: { reference: mwt.reference } });
      if (ledger) {
        await tx.transaction.updateMany({
          where: { id: ledger.id, status: { in: ['PENDING', 'PROCESSING'] } },
          data: { status: 'COMPLETED' },
        });
      } else {
        await tx.merchantWallet.update({
          where: { id: mwt.merchantWalletId },
          data: { pendingBalance: { decrement: mwt.amount } },
        });
      }
    } else {
      const fresh = await tx.merchantWalletTransaction.findUnique({ where: { id: mwt.id } });
      if (fresh && fresh.status === 'FAILED') {
        logger.error('Payout reported success AFTER being failed/refunded - manual reconciliation needed', {
          withdrawalId: mwt.id, reference: mwt.reference,
        });
      }
    }
  });
};

/**
 * Settle a withdrawal from a Paystack transfer webhook. Matches the withdrawal
 * by our own `reference` (set when initiating the transfer):
 *   - transfer.success         → COMPLETED (+ ledger mirror, + notify)
 *   - transfer.failed/reversed → refund (user) / failWithdrawal (merchant)
 * Every state change is a compare-and-set, so duplicate deliveries are safe.
 */
const handlePaystackTransfer = async ({ transactionRef, reference, status, reason }) => {
  const webhookEvent = await prisma.webhookEvent.findUnique({ where: { transactionRef } });
  if (!webhookEvent || webhookEvent.processed) {
    logger.info('Paystack transfer webhook already processed or missing', { transactionRef });
    return;
  }

  const isSuccess = status === 'success';
  const isFailure = status === 'failed' || status === 'reversed';

  try {
    // 1. User / rider withdrawal (Transaction, type WITHDRAWAL).
    const txn = await prisma.transaction.findUnique({ where: { reference } });
    if (txn && txn.type === 'WITHDRAWAL') {
      if (isSuccess) {
        await completeUserWithdrawal(txn);
      } else if (isFailure) {
        const userId = txn.debitWalletId
          ? (await prisma.wallet.findUnique({ where: { id: txn.debitWalletId }, select: { userId: true } }))?.userId
          : null;
        await refundFailedWithdrawal({
          transactionId: reference,
          amount: Number(txn.amount),
          userId,
          debitWalletId: txn.debitWalletId,
          reason: reason || `transfer ${status}`,
        });
      }
      await prisma.webhookEvent.update({ where: { transactionRef }, data: { processed: true, processedAt: new Date() } });
      return;
    }

    // 2. Merchant withdrawal (MerchantWalletTransaction).
    const mwt = await prisma.merchantWalletTransaction.findUnique({ where: { reference } });
    if (mwt) {
      if (isSuccess) {
        await completeMerchantWithdrawal(mwt);
      } else if (isFailure) {
        const adminService = require('../../modules/admin/admin.service');
        await adminService.failWithdrawal(mwt.id, reason || `transfer ${status}`, { adminUserId: 'SYSTEM' });
      }
      await prisma.webhookEvent.update({ where: { transactionRef }, data: { processed: true, processedAt: new Date() } });
      return;
    }

    logger.warn('Paystack transfer webhook: no matching withdrawal', { reference, status });
    await prisma.webhookEvent.update({ where: { transactionRef }, data: { processed: true, processedAt: new Date() } });
  } catch (error) {
    await prisma.webhookEvent.update({ where: { transactionRef }, data: { error: error.message } });
    throw error;
  }
};

/**
 * Credit a wallet from a STRAGGLER KatPay virtual-account payment - someone who
 * saved their old NUBAN and funded it after the Paystack cutover. fundWallet
 * resolves the wallet via legacyKatpayAccountNumber and tags the row KATPAY.
 */
const handleKatpayVirtualAccountPayment = async ({ transactionRef, accountNumber, amount, ref, eventData }) => {
  const webhookEvent = await prisma.webhookEvent.findUnique({ where: { transactionRef } });
  if (!webhookEvent || webhookEvent.processed) {
    logger.info('KatPay virtual account webhook already processed or missing', { transactionRef });
    return;
  }

  try {
    await walletService.fundWallet({
      accountNumber,
      amount,
      reference: ref || transactionRef,
      metadata: eventData,
      provider: 'KATPAY',
    });

    await prisma.webhookEvent.update({
      where: { transactionRef },
      data: { processed: true, processedAt: new Date() },
    });

    // Nudge the funder to switch to their Paystack account. We look the wallet up
    // by the OLD KatPay number (stored in legacyKatpayAccountNumber on migrated
    // users), so this only emails users who actually have a new Paystack NUBAN to
    // move to. Best-effort - never fail the job over an email.
    try {
      const wallet = await prisma.wallet.findUnique({
        where: { legacyKatpayAccountNumber: accountNumber },
        select: {
          virtualAccountNumber: true,
          virtualAccountBank: true,
          user: { select: { email: true, firstName: true } },
        },
      });
      if (wallet?.user?.email && wallet.virtualAccountNumber) {
        const emailService = require('../../services/email.service');
        await emailService.sendLegacyAccountFundingWarningEmail(
          wallet.user.email,
          wallet.user.firstName,
          { amount, newAccountNumber: wallet.virtualAccountNumber, newBankName: wallet.virtualAccountBank },
        );
      }
    } catch (mailErr) {
      logger.warn('Legacy-funding warning email failed', { transactionRef, error: mailErr.message });
    }
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { transactionRef },
      data: { error: error.message },
    });
    throw error;
  }
};

/**
 * Refund a withdrawal whose payout was DEFINITIVELY rejected. Idempotent +
 * race-safe: the REF-<id> existence check + the PROCESSING→FAILED compare-and-set
 * ensure the wallet is credited back exactly once even under duplicate jobs.
 */
const refundFailedWithdrawal = async ({ transactionId, amount, userId, debitWalletId, reason }) => {
  const refRef = `REF-${transactionId}`;
  const already = await prisma.transaction.findUnique({ where: { reference: refRef } });
  if (already) {
    logger.info('Withdrawal already refunded - skipping', { transactionId });
    return;
  }

  const refunded = await prisma.$transaction(async (tx) => {
    // Only the caller that flips PROCESSING/SENT→FAILED performs the credit.
    // (PROCESSING = never dispatched; SENT = dispatched-but-definitively-rejected,
    // i.e. the money did not leave, so a refund is still safe.)
    const claim = await tx.transaction.updateMany({
      where: { reference: transactionId, status: { in: ['PROCESSING', 'SENT'] } },
      data: { status: 'FAILED' },
    });
    if (claim.count !== 1) return false;

    const wallet = debitWalletId ? await tx.wallet.findUnique({ where: { id: debitWalletId } }) : null;
    if (!wallet) return false;
    const currentBalance = Number(wallet.balance);
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount } } });
    await tx.transaction.create({
      data: {
        reference: refRef,
        type: 'REFUND',
        status: 'COMPLETED',
        amount,
        description: `Withdrawal refund - payout rejected${reason ? ` (${reason})` : ''}`,
        creditWalletId: wallet.id,
        provider: 'PAYSTACK',
        balanceBefore: currentBalance,
        balanceAfter: currentBalance + amount,
      },
    });
    return true;
  });

  if (refunded && userId) {
    const refundedWallet = await prisma.wallet.findUnique({ where: { userId }, select: { balance: true } });
    if (refundedWallet) notifyService.balanceUpdated(userId, { balance: Number(refundedWallet.balance) });
    notifyService.onWalletEvent(userId, {
      kind: 'REFUND',
      amount,
      transactionId: `REF-${transactionId}`,
      route: '/wallet',
      description: 'Your withdrawal failed - funds returned to your wallet.',
    }).catch((err) => logger.warn('Withdrawal-refund notification failed', { error: err.message }));
  }
};

/**
 * Process withdrawal - dispatch a Paystack transfer.
 *
 * Money-safety rules (a payout moves real cash and can't be un-sent):
 *   - Terminal states (COMPLETED/FAILED/REVERSED) never re-run.
 *   - We CLAIM the row (PROCESSING→SENT) BEFORE calling the payout, so a duplicate
 *     job, a retry, or the enqueue-failure compensation can never dispatch the
 *     same payout twice. A row already SENT is treated as "dispatched, outcome
 *     unknown" - we NEVER re-pay it.
 *   - Paystack transfers are ASYNC: a successful initiate only means QUEUED
 *     (status `pending`). The terminal outcome arrives via the transfer.success /
 *     transfer.failed / transfer.reversed webhook, which flips SENT→COMPLETED or
 *     refunds. We only complete here when Paystack returns `success` outright
 *     (test mode / instant settlement); the webhook completion is idempotent so
 *     a later event simply no-ops. The shared `reference` makes the transfer
 *     idempotent, so a retry can't double-send.
 *   - Refund ONLY on a DEFINITIVE provider rejection (the money did not leave).
 *   - On an AMBIGUOUS error (timeout/network/5xx) the payout may have settled -
 *     do NOT refund; leave it SENT and re-throw to retry. Reconciliation can now
 *     confirm via Paystack's GET /transfer/verify and settle a stuck SENT.
 */
const handleWithdrawal = async ({ transactionId, bankCode, accountNumber, accountName, amount, userId }) => {
  const transaction = await prisma.transaction.findUnique({ where: { reference: transactionId } });

  if (!transaction) {
    logger.warn('Withdrawal transaction not found', { transactionId });
    return;
  }

  if (['COMPLETED', 'FAILED', 'REVERSED'].includes(transaction.status)) {
    logger.info('Withdrawal already settled - skipping', { transactionId, status: transaction.status });
    return;
  }

  if (transaction.status === 'SENT') {
    // A prior attempt already dispatched this payout. NEVER re-pay - the
    // transfer.success/failed webhook (or reconciliation via GET /transfer/verify)
    // will settle it. Re-dispatching with the same reference would be rejected by
    // Paystack anyway, but bowing out here keeps the flow clean.
    logger.warn('Withdrawal already dispatched (SENT) - not re-paying; awaiting webhook', { transactionId });
    return;
  }

  // Claim the dispatch atomically. Only the worker that flips PROCESSING→SENT may
  // call the payout; a concurrent job or the enqueue-compensation gets count 0
  // and bows out, so the cash is sent at most once.
  const claim = await prisma.transaction.updateMany({
    where: { reference: transactionId, status: 'PROCESSING' },
    data: { status: 'SENT' },
  });
  if (claim.count !== 1) {
    logger.info('Withdrawal already claimed elsewhere - skipping', { transactionId });
    return;
  }

  let payout;
  try {
    payout = await paystackService.initiatePayout({
      amount,
      bank_code: bankCode,
      account_number: accountNumber,
      account_name: accountName,
      reference: transactionId,
      description: 'Wallet withdrawal',
    });
  } catch (error) {
    if (!error.definitive) {
      // Ambiguous - the payout may have gone out. Leave it SENT and retry; the
      // retry will see SENT and NOT re-pay. Never refund here.
      logger.warn('Withdrawal payout ambiguous - left SENT for retry/reconcile', {
        transactionId, providerStatus: error.providerStatus,
      });
      throw error; // BullMQ retries
    }
    logger.error('Withdrawal payout rejected - refunding', { transactionId, reason: error.providerMessage });
    await refundFailedWithdrawal({ transactionId, amount, userId, debitWalletId: transaction.debitWalletId, reason: error.providerMessage });
    return; // terminal - do NOT re-throw (no retry, no re-pay)
  }

  // Stamp the Paystack transfer_code on the row for traceability while it's in
  // flight (kept on SENT; the webhook flips status).
  await prisma.transaction.updateMany({
    where: { reference: transactionId, status: 'SENT' },
    data: { providerRef: payout?.transferCode || transactionId },
  });

  if (String(payout?.status).toLowerCase() === 'success') {
    // Instant settlement (Paystack test mode / immediate success). Complete now;
    // if a transfer.success webhook arrives later its compare-and-set no-ops.
    const completed = await prisma.transaction.updateMany({
      where: { reference: transactionId, status: 'SENT' },
      data: { status: 'COMPLETED' },
    });
    if (completed.count === 1) {
      logger.info('Withdrawal payout completed (sync)', { transactionId, amount });
      if (userId) {
        const freshWallet = await prisma.wallet.findUnique({ where: { userId }, select: { balance: true } });
        if (freshWallet) notifyService.balanceUpdated(userId, { balance: Number(freshWallet.balance) });
        notifyService.onWalletEvent(userId, {
          kind: 'WITHDRAWAL',
          amount,
          transactionId,
          route: '/wallet',
        }).catch((err) => logger.warn('WITHDRAWAL notification failed', { error: err.message }));
      }
    }
    return;
  }

  // pending (the normal case): leave the row SENT. transfer.success →
  // SENT→COMPLETED + notify; transfer.failed/reversed → refund. Both handled in
  // the Paystack webhook (handlePaystack).
  logger.info('Withdrawal dispatched - awaiting Paystack transfer webhook', { transactionId, status: payout?.status });
};

/**
 * Provision a Paystack Dedicated Virtual Account for a newly verified user.
 */
const handleProvisionVirtualAccount = async ({ userId, email, firstName, lastName, phone, customerCode }) => {
  const existingWallet = await prisma.wallet.findUnique({ where: { userId } });
  if (existingWallet?.virtualAccountNumber) {
    logger.info('Virtual account already provisioned', { userId });
    return;
  }

  const va = await paystackService.createVirtualAccount({
    email,
    firstName,
    lastName,
    phone: phone || '',
    // Reuse the wallet's existing Paystack customer if it already has one.
    customerCode: customerCode || existingWallet?.paystackCustomerCode || undefined,
  });

  await prisma.wallet.update({
    where: { userId },
    data: {
      virtualAccountNumber: va.accountNumber,
      virtualAccountBank: va.bankName,
      virtualAccountName: va.accountName,
      paystackCustomerCode: va.customerCode,
      dedicatedAccountId: va.dedicatedAccountId,
    },
  });

  logger.info('Paystack virtual account provisioned', { userId, accountNumber: va.accountNumber });
};

/**
 * Retry a failed transaction based on its original type.
 */
const handleRetry = async ({ transactionId }) => {
  const transaction = await prisma.transaction.findUnique({ where: { reference: transactionId } });
  if (!transaction) {
    logger.warn('Retry: transaction not found', { transactionId });
    return;
  }

  if (transaction.type === 'WITHDRAWAL' && transaction.status === 'FAILED') {
    const { bankCode, accountNumber, accountName } = transaction.metadata || {};
    await handleWithdrawal({
      transactionId,
      bankCode,
      accountNumber,
      accountName,
      amount: Number(transaction.amount),
    });
  } else {
    logger.warn('Retry: unhandled transaction type', { transactionId, type: transaction.type });
  }
};

module.exports = { startPaymentWorker };
