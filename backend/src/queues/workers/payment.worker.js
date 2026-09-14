const { Worker } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, PAYMENT_JOBS, STUCK_WEBHOOK_GRACE_MS } = require('../jobs');
const { logger } = require('../../utils/logger');
const { prisma } = require('../../config/database');
const walletService = require('../../modules/wallet/wallet.service');
const katpayService = require('../../services/katpay.service');
const notifyService = require('../../services/notify.service');
const reconciliationService = require('../../services/reconciliation.service');
const { refundFailedWithdrawal } = require('../../services/withdrawal-refund.service');

const startPaymentWorker = () => {
  const worker = new Worker(
    QUEUES.PAYMENT,
    async (job) => {
      logger.info(`Processing payment job: ${job.name}`, { jobId: job.id });

      switch (job.name) {
        case PAYMENT_JOBS.PROCESS_KATPAY_WEBHOOK:
          return handleKatpayVirtualAccountPayment(job.data);

        case PAYMENT_JOBS.PROCESS_TRANSFER_PAYMENT_WEBHOOK:
          return handleKatpayTransferPayment(job.data);

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

        case PAYMENT_JOBS.RECONCILE_STUCK_WEBHOOKS:
          return reconcileStuckWebhooks();

        default:
          logger.warn(`Unknown payment job type: ${job.name}`);
      }
    },
    {
      connection: redis,
      concurrency: 5,
      // Must exceed normal DB/notification latency so a legitimate-but-slow job
      // is never declared stalled and reprocessed - see handleKatpayVirtualAccountPayment's
      // claim comment for why a stalled double-dispatch used to silently drop funding.
      lockDuration: 120_000,
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
 * Credit wallet from a KatPay virtual account payment.
 */
const handleKatpayVirtualAccountPayment = async ({ transactionRef, accountNumber, amount, ref, eventData }) => {
  // Atomic claim: flip unprocessed→processed up front so only ONE of two
  // concurrent runs of this job (a BullMQ stalled-job reclaim, or any other
  // duplicate dispatch) actually credits the wallet. The previous read-then-
  // write-later version had the exact same TOCTOU gap already found and fixed
  // in the settle/refund/payout workers (see commit deb450c) - the loser of the
  // race saw `processed: false`, called fundWallet fine, but its own trailing
  // `processed: true` write was harmless... UNLESS the two runs interleaved so
  // that a claim/read read stale unprocessed state after a stall+reclaim, in
  // which case the reclaimed run's `webhookEvent.findUnique` could return the
  // row before the original run's update landed, and BOTH proceed - one wins
  // fundWallet's own reference-uniqueness check and throws inside the *other*
  // run trying to report back to a job/lock BullMQ had already reassigned,
  // silently dropping that run's result. Claiming atomically here closes that
  // gap the same way PROCESSING→SENT and DELIVERED→SETTLED do.
  const claim = await prisma.webhookEvent.updateMany({
    where: { transactionRef, processed: false },
    data: { processed: true, processedAt: new Date() },
  });
  if (claim.count !== 1) {
    logger.info('KatPay virtual account webhook already processed or missing', { transactionRef });
    return;
  }

  try {
    await walletService.fundWallet({
      accountNumber,
      amount,
      reference: ref || transactionRef,
      metadata: eventData,
    });
  } catch (error) {
    // Funding failed after we'd already claimed the event - release the claim
    // so the reconciliation sweep (or a manual retry) can pick it back up
    // instead of it being permanently marked processed with no credit.
    await prisma.webhookEvent.update({
      where: { transactionRef },
      data: { processed: false, error: error.message },
    });
    throw error;
  }
};

/**
 * Credit wallet from a KatPay transfer_payment.completed event.
 * Uses metauserId to find the right wallet.
 */
const handleKatpayTransferPayment = async ({ transactionRef, amount, ref, metadata, eventData }) => {
  // Atomic claim - see handleKatpayVirtualAccountPayment for why a plain
  // read-then-check let a stalled-job reclaim silently swallow the credit.
  const claim = await prisma.webhookEvent.updateMany({
    where: { transactionRef, processed: false },
    data: { processed: true, processedAt: new Date() },
  });
  if (claim.count !== 1) {
    logger.info('Transfer payment webhook already processed or missing', { transactionRef });
    return;
  }

  try {
    // For transfer payments, find wallet by userId stored in metadata
    const userId = metadata?.userId;
    if (!userId) {
      logger.warn('Transfer payment webhook missing userId in metadata', { transactionRef });
      await prisma.webhookEvent.update({
        where: { transactionRef },
        data: { processed: false, error: 'missing userId in metadata' },
      });
      return;
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      logger.warn('Wallet not found for transfer payment', { userId, transactionRef });
      await prisma.webhookEvent.update({
        where: { transactionRef },
        data: { processed: false, error: 'wallet not found for userId' },
      });
      return;
    }

    await walletService.fundWallet({
      accountNumber: wallet.virtualAccountNumber,
      amount,
      reference: ref || transactionRef,
      metadata: { ...eventData, source: 'TRANSFER_PAYMENT' },
    });
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { transactionRef },
      data: { processed: false, error: error.message },
    });
    throw error;
  }
};

// Event types this sweep knows how to replay (wallet-funding only - payout.*
// events touch merchant withdrawals and are left for manual review since a
// blind replay there is a higher-stakes guess than re-crediting a customer).
const REPLAYABLE_EVENT_TYPES = new Set([
  'virtual_account.payment_received',
  'transaction.completed',
  'transfer_payment.completed',
]);

/**
 * Safety-net sweep: replay KatPay webhook_events that never got marked
 * processed after sitting past the grace window. Exists because the atomic
 * claim in handleKatpayVirtualAccountPayment/handleKatpayTransferPayment only
 * protects against double-crediting - it doesn't guarantee a job runs at all
 * (a job lost to a Redis restart, a worker crash mid-flight, or any other gap
 * we haven't found yet). Runs every 5 minutes (see queues/index.js); replay is
 * idempotent via the same atomic claim + fundWallet's reference uniqueness, so
 * running this on a row that's mid-flight elsewhere is safe - the claim will
 * just find `processed` already flipped and no-op.
 */
const reconcileStuckWebhooks = async () => {
  const cutoff = new Date(Date.now() - STUCK_WEBHOOK_GRACE_MS);
  const stuck = await prisma.webhookEvent.findMany({
    where: { provider: 'katpay', processed: false, createdAt: { lt: cutoff } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  if (stuck.length === 0) {
    logger.info('Reconcile sweep: no stuck KatPay webhook events');
    return { scanned: 0, replayed: 0 };
  }

  logger.warn('Reconcile sweep: replaying stuck KatPay webhook events', { count: stuck.length });
  let replayed = 0;
  for (const event of stuck) {
    if (!REPLAYABLE_EVENT_TYPES.has(event.eventType)) {
      logger.warn('Reconcile sweep: stuck webhook event needs manual review (not auto-replayable)', {
        transactionRef: event.transactionRef,
        eventType: event.eventType,
        ageMs: Date.now() - new Date(event.createdAt).getTime(),
      });
      continue;
    }

    try {
      const payload = event.payload;
      const data = payload.data || payload;

      if (event.eventType === 'transfer_payment.completed') {
        const amount = Number(data.amount_received ?? data.amount ?? 0);
        const metadata = data.metadata || {};
        const ref = data.merchant_reference || event.transactionRef;
        await handleKatpayTransferPayment({
          transactionRef: event.transactionRef, amount, ref, metadata, eventData: payload,
        });
      } else {
        const accountNumber = data.virtual_account?.account_number;
        const amount = Number(data.transaction?.order_amount ?? 0);
        const ref = data.transaction?.order_no || event.transactionRef;
        await handleKatpayVirtualAccountPayment({
          transactionRef: event.transactionRef, accountNumber, amount, ref, eventData: payload,
        });
      }
      replayed += 1;
    } catch (err) {
      logger.error('Reconcile sweep: stuck webhook replay errored', {
        transactionRef: event.transactionRef, error: err.message,
      });
    }
  }
  logger.info('Reconcile sweep complete', { scanned: stuck.length, replayed });
  return { scanned: stuck.length, replayed };
};

/**
 * Process withdrawal - call KatPay payout API.
 *
 * Money-safety rules (a payout moves real cash and can't be un-sent):
 *   - Terminal states (COMPLETED/FAILED/REVERSED) never re-run.
 *   - We CLAIM the row (PROCESSING→SENT) BEFORE calling the payout, so a duplicate
 *     job, a retry, or the enqueue-failure compensation can never dispatch the
 *     same payout twice. A row already SENT is treated as "dispatched, outcome
 *     unknown" - we NEVER re-pay it; reconciliation surfaces it.
 *   - Refund ONLY on a DEFINITIVE provider rejection (the money did not leave).
 *   - On an AMBIGUOUS error (timeout/network/5xx) the payout may have settled -
 *     do NOT refund; leave it SENT and re-throw to retry. Retries see SENT and
 *     return without re-paying; if they exhaust, reconciliation flags it.
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
    // A prior attempt already dispatched this payout and we can't confirm its
    // outcome (KatPay has no payout-status endpoint). NEVER re-pay - leave it for
    // the reconciliation scan / manual resolution.
    logger.warn('Withdrawal already dispatched (SENT) - not re-paying; needs reconciliation', { transactionId });
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
    payout = await katpayService.initiatePayout({
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
    await refundFailedWithdrawal({ transactionId, reason: error.providerMessage });
    return; // terminal - do NOT re-throw (no retry, no re-pay)
  }

  // Success → SENT→COMPLETED (compare-and-set).
  const completed = await prisma.transaction.updateMany({
    where: { reference: transactionId, status: 'SENT' },
    data: { status: 'COMPLETED', providerRef: payout?.reference || payout?.id || transactionId },
  });

  if (completed.count === 1) {
    logger.info('Withdrawal payout completed', { transactionId, amount });
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
};

/**
 * Provision KatPay virtual account for a newly verified user.
 */
const handleProvisionVirtualAccount = async ({ userId, email, name, phoneNumber }) => {
  const existingWallet = await prisma.wallet.findUnique({ where: { userId } });
  if (existingWallet?.virtualAccountNumber) {
    logger.info('Virtual account already provisioned', { userId });
    return;
  }

  const va = await katpayService.createVirtualAccount({
    email,
    name,
    phoneNumber: phoneNumber || '',
    bankCodes: ['PALMPAY', 'OPAY'],
  });

  await prisma.wallet.update({
    where: { userId },
    data: {
      virtualAccountNumber: va.accountNumber,
      virtualAccountBank: va.bankName,
      virtualAccountName: va.accountName,
    },
  });

  logger.info('KatPay virtual account provisioned', { userId, accountNumber: va.accountNumber });
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
