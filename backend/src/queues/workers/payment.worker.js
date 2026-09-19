const { Worker } = require('bullmq');
const { redis } = require('../../config/redis');
const { config } = require('../../config');
const { QUEUES, PAYMENT_JOBS, STUCK_WEBHOOK_GRACE_MS } = require('../jobs');
const { logger } = require('../../utils/logger');
const { prisma } = require('../../config/database');
const walletService = require('../../modules/wallet/wallet.service');
const katpayService = require('../../services/katpay.service');
const paystackService = require('../../services/paystack.service');
const emailService = require('../../services/email.service');
const { provisionVirtualAccount } = require('../../services/payments/provisioning');
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

        case PAYMENT_JOBS.PROCESS_PAYSTACK_WEBHOOK:
          return handlePaystackWebhook(job.data);

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

        case PAYMENT_JOBS.RECONCILE_PAYSTACK:
          return reconcilePaystack();

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
      userId,
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
 * Alert admins that a Paystack payout is held and needs manual review (e.g.
 * a transfer that FAILED - Paystack only returns the debit on reversal, so
 * refunding the wallet automatically on `failed` could double-pay). Best-effort
 * and de-duped via a Redis NX marker so retries/webhook re-deliveries don't
 * spam the inbox. Recipient is ALERT_EMAIL, or SMTP_FROM_EMAIL as a fallback.
 */
const alertPaystackPayoutHold = async ({ transactionId, reference, reason }) => {
  const to = config.ALERT_EMAIL || config.SMTP_FROM_EMAIL;
  if (!to) return;

  const marker = `paystack:payout-hold-alerted:${reference}`;
  try {
    const first = await redis.set(marker, '1', 'EX', 24 * 60 * 60, 'NX');
    if (first === null) return; // already alerted for this reference
  } catch (err) {
    logger.warn('Paystack payout-hold alert marker failed (non-fatal)', { reference, error: err.message });
  }

  try {
    await emailService.sendEmail({
      to,
      subject: `⚠️ Paystack payout needs review — ${transactionId}`,
      text: [
        'A Paystack payout could NOT be settled conclusively and needs manual review.',
        '',
        `Transaction:  ${transactionId}`,
        `Paystack ref: ${reference}`,
        `Reason:       ${reason}`,
        '',
        'ACTION: open the Paystack dashboard → Transfers, check the transfer status and whether',
        'the Paystack balance was debited/returned, then refund the wallet if due or retry the payout.',
      ].join('\n'),
    });
    logger.info('Admin alerted: Paystack payout needs review', { transactionId, reference, to });
  } catch (err) {
    logger.warn('Paystack payout-hold alert failed (non-fatal)', { transactionId, error: err.message });
  }
};

/**
 * Process withdrawal - call payout API.
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
 *   - Paystack: a 200 from POST /transfer only means the transfer was QUEUED
 *     (`status: pending` in live; `success` only in test mode). Only a status of
 *     `success` is conclusive - mark COMPLETED. Anything else stays SENT and is
 *     completed by the transfer.success webhook or the reconcile sweep, and a
 *     later failure is caught (and held/refunded) instead of being refused as
 *     "already COMPLETED".
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
    if ((transaction.provider || 'KATPAY') === 'PAYSTACK') {
      const recipientCode = await resolvePaystackRecipient({ userId, bankCode, accountNumber, accountName });
      payout = await paystackService.initiatePayout({
        amount,
        recipientCode,
        reference: transactionId,
        reason: 'Wallet withdrawal',
      });
    } else {
      payout = await katpayService.initiatePayout({
        amount,
        bank_code: bankCode,
        account_number: accountNumber,
        account_name: accountName,
        reference: transactionId,
        description: 'Wallet withdrawal',
      });
    }
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

  // Paystack: only a `success` status is conclusive that money left. In live
  // mode POST /transfer returns `pending` (or `otp` if OTP approval is on); the
  // money has NOT left, so leave the row SENT - the transfer.success webhook or
  // reconcile sweep will complete it, and a later failure stays refundable.
  if (payout && (transaction.provider || 'KATPAY') === 'PAYSTACK') {
    const payoutStatus = String(payout.status || '').toLowerCase();
    if (payoutStatus !== 'success') {
      if (payoutStatus === 'otp') {
        logger.error('PAYSTACK_PAYOUT_HOLD transfer requires OTP - disable "Confirm transfers before sending" in Paystack', {
          transactionId, status: payout.status,
        });
        await alertPaystackPayoutHold({
          transactionId,
          reference: payout.reference || transactionId,
          reason: 'transfer requires OTP - disable "Confirm transfers before sending" in the Paystack dashboard',
        });
      } else {
        logger.info('Paystack payout queued - awaiting transfer.success webhook / reconcile sweep', {
          transactionId, status: payout.status,
        });
      }
      return; // leave SENT
    }
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
 * Resolve (or create + cache) a Paystack transfer recipient for a bank account.
 * The dashboards/saved beneficiaries store KATPAY bank codes, so mapping to the
 * Paystack code happens inside `createRecipientFromKatpayBank`. The recipient
 * code is cached on the matching saved beneficiary when one exists.
 */
const resolvePaystackRecipient = async ({ userId, bankCode, accountNumber, accountName }) => {
  const beneficiary = userId && bankCode && accountNumber
    ? await prisma.savedBeneficiary.findUnique({
      where: { userId_accountNumber_bankCode: { userId, accountNumber, bankCode } },
    }).catch(() => null)
    : null;

  if (beneficiary?.paystackRecipientCode) return beneficiary.paystackRecipientCode;

  const recipient = await paystackService.createRecipientFromKatpayBank({
    name: accountName || beneficiary?.name || accountNumber,
    accountNumber,
    katpayBankCode: bankCode,
  });

  if (beneficiary) {
    await prisma.savedBeneficiary.update({
      where: { id: beneficiary.id },
      data: { provider: 'PAYSTACK', paystackRecipientCode: recipient.recipientCode },
    }).catch((err) => logger.warn('Failed to cache Paystack recipient on beneficiary', {
      beneficiaryId: beneficiary.id, error: err.message,
    }));
  }

  return recipient.recipientCode;
};

/**
 * Ensure the wallet has BOTH provider accounts (idempotent per provider).
 */
const handleProvisionVirtualAccount = async ({ userId, email, name, phoneNumber }) => {
  const existingWallet = await prisma.wallet.findUnique({ where: { userId } });
  if (existingWallet?.paystackAccountNumber && existingWallet?.katpayAccountNumber) {
    logger.info('Both provider accounts already provisioned', { userId });
    return;
  }

  await provisionVirtualAccount({ userId, email, name, phoneNumber });
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

// ─── Paystack webhook processing ──────────────────────────────────────────────

/**
 * Find a withdrawal/transfer ledger row by the reference Paystack knows it by.
 * Paystack transfer references are lowercased; the ledger keeps the original in
 * `reference` and the sent form in `providerRef`, so match either.
 */
const findTransactionByProviderRef = async (providerRef) => {
  if (!providerRef) return null;
  return prisma.transaction.findFirst({
    where: { OR: [{ providerRef }, { reference: providerRef }] },
  });
};

/**
 * Resolve the funding wallet for a Paystack dedicated-NUBAN charge:
 * receiver NUBAN → customer code → customer email. Returns null if unroutable.
 */
const resolveDvaAccountNumber = async (data) => {
  const authorization = data.authorization || {};
  if (authorization.receiver_bank_account_number) return authorization.receiver_bank_account_number;

  const customerCode = data.customer?.customer_code || null;
  if (customerCode) {
    const wallet = await prisma.wallet.findUnique({ where: { paystackCustomerCode: customerCode } });
    if (wallet?.paystackAccountNumber) return wallet.paystackAccountNumber;
  }

  const email = data.customer?.email || null;
  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
      if (wallet?.paystackAccountNumber) return wallet.paystackAccountNumber;
    }
  }
  return null;
};

const handlePaystackChargeSuccess = async (data) => {
  const reference = data.reference;
  const amount = Number(data.amount || 0) / 100;
  // DVA funding is signalled by the authorization channel (and mirrored at the
  // top level) being `dedicated_nuban`.
  const isDva = data.channel === 'dedicated_nuban' || data.authorization?.channel === 'dedicated_nuban';
  // metadata is a plain object when passed to initialize; Paystack echoes it as
  // an object, but tolerate a stringified form defensively.
  const metadata = typeof data.metadata === 'string'
    ? (() => { try { return JSON.parse(data.metadata); } catch { return {}; } })()
    : (data.metadata || {});

  const userId = metadata.userId ? String(metadata.userId) : null;
  const accountNumber = isDva ? await resolveDvaAccountNumber(data) : null;

  if (!userId && !accountNumber) {
    throw new Error(`unroutable paystack charge (reference=${reference}, channel=${data.channel || data.authorization?.channel})`);
  }

  await walletService.fundWallet({
    accountNumber,
    userId,
    amount,
    reference,
    metadata,
    provider: 'PAYSTACK',
  });
  logger.info('Paystack funding settled', { reference, amount, userId, accountNumber });
};

const handlePaystackTransferSuccess = async (data) => {
  const reference = data.reference || data.transfer_code;
  const transaction = await findTransactionByProviderRef(reference);
  if (!transaction) {
    logger.warn('Paystack transfer.success for unknown reference', { reference });
    return;
  }
  if (transaction.status === 'COMPLETED') return;

  const completed = await prisma.transaction.updateMany({
    where: { reference: transaction.reference, status: 'SENT' },
    data: { status: 'COMPLETED', providerRef: reference },
  });
  if (completed.count !== 1) return;

  logger.info('Paystack payout completed', { reference, transactionId: transaction.reference });
  if (transaction.debitWalletId) {
    const wallet = await prisma.wallet.findUnique({ where: { id: transaction.debitWalletId }, select: { userId: true, balance: true } });
    if (wallet?.userId) {
      notifyService.balanceUpdated(wallet.userId, { balance: Number(wallet.balance) });
      notifyService.onWalletEvent(wallet.userId, {
        kind: 'WITHDRAWAL', amount: Number(transaction.amount), transactionId: transaction.reference, route: '/wallet',
      }).catch((err) => logger.warn('WITHDRAWAL notification failed', { error: err.message }));
    }
  }
};

const handlePaystackTransferFailure = async (data) => {
  const reference = data.reference || data.transfer_code;
  const transaction = await findTransactionByProviderRef(reference);
  if (!transaction) {
    logger.warn('Paystack transfer failure for unknown reference', { reference });
    return;
  }
  if (['COMPLETED', 'FAILED', 'REVERSED'].includes(transaction.status)) return;

  // The failure webhook is authoritative, but re-verify before moving money: a
  // spurious or replayed event must never reverse a payout that actually settled.
  let status = data.status;
  try {
    const verified = await paystackService.verifyTransfer(reference);
    status = verified.status || status;
  } catch (err) {
    logger.warn('Paystack transfer-failure verify failed - leaving for reconcile', { reference, error: err.message });
    throw err;
  }

  const s = String(status || '').toLowerCase();
  if (s === 'reversed') {
    // Paystack credits the transfer amount back to the balance on reversal, so
    // the wallet debit is safe to reverse too.
    logger.error('PAYSTACK_PAYOUT_REVERSED - refunding wallet', { reference, transactionId: transaction.reference });
    await refundFailedWithdrawal({ transactionId: transaction.reference, reason: 'paystack transfer reversed' });
  } else if (s === 'failed') {
    // Paystack does NOT return the debit on `failed` - only `reversed` credits
    // the balance back. Auto-refunding the wallet here could double-pay if the
    // balance still holds the debit: hold + alert for manual review instead.
    logger.error('PAYSTACK_PAYOUT_HOLD transfer failed - funds NOT auto-returned, manual review required', {
      reference, transactionId: transaction.reference, status,
    });
    await alertPaystackPayoutHold({
      transactionId: transaction.reference,
      reference,
      reason: 'transfer failed - verify the Paystack balance before refunding the wallet',
    });
  } else {
    logger.warn('Paystack transfer failure webhook but verify shows non-terminal - left for reconcile', { reference, status });
  }
};

/**
 * Claim + settle one Paystack webhook event. The webhookEvent row is the
 * idempotency lock; a claim miss means it was already processed (or missing).
 */
const handlePaystackWebhook = async ({ transactionRef, payload }) => {
  const claim = await prisma.webhookEvent.updateMany({
    where: { transactionRef, processed: false },
    data: { processed: true, processedAt: new Date() },
  });
  if (claim.count !== 1) {
    logger.info('Paystack webhook already processed or missing', { transactionRef });
    return;
  }

  const event = payload?.event || 'UNKNOWN';
  const data = payload?.data || {};

  try {
    switch (event) {
      case 'charge.success':
        return await handlePaystackChargeSuccess(data);
      case 'transfer.success':
        return await handlePaystackTransferSuccess(data);
      case 'transfer.failed':
      case 'transfer.reversed':
        return await handlePaystackTransferFailure(data);
      default:
        logger.info('Paystack webhook event ignored', { event, transactionRef });
    }
  } catch (error) {
    // Release the claim so a provider retry (or the reconcile sweep) re-enters.
    await prisma.webhookEvent.update({ where: { transactionRef }, data: { processed: false, error: error.message } });
    throw error;
  }
};

/**
 * Safety-net sweep for Paystack. Verifies transactions that never got a webhook:
 *   - WALLET_FUNDING PENDING past the grace window → success settles, definitive
 *     failure marks FAILED, still-pending is left alone;
 *   - WITHDRAWAL SENT past the grace window → success completes, reversed refunds
 *     (balance credited back), failed holds + alerts (debit not auto-returned).
 */
const reconcilePaystack = async () => {
  const cutoff = new Date(Date.now() - STUCK_WEBHOOK_GRACE_MS);
  let settled = 0;
  let failed = 0;
  let refunded = 0;

  const pendingFunding = await prisma.transaction.findMany({
    where: { provider: 'PAYSTACK', type: 'WALLET_FUNDING', status: 'PENDING', createdAt: { lt: cutoff } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  for (const tx of pendingFunding) {
    try {
      const verified = await paystackService.verifyTransaction(tx.reference);
      if (verified.status === 'success') {
        await walletService.fundWallet({
          reference: tx.reference,
          amount: verified.amount,
          userId: tx.metadata?.userId ? String(tx.metadata.userId) : null,
          metadata: tx.metadata || {},
          provider: 'PAYSTACK',
        });
        settled += 1;
      } else if (['failed', 'abandoned', 'reversed'].includes(String(verified.status))) {
        const claim = await prisma.transaction.updateMany({
          where: { reference: tx.reference, status: 'PENDING' },
          data: { status: 'FAILED', description: `Wallet top-up ${verified.status}` },
        });
        if (claim.count === 1) failed += 1;
      }
    } catch (err) {
      logger.warn('Paystack funding reconcile errored', { reference: tx.reference, error: err.message });
    }
  }

  const sentPayouts = await prisma.transaction.findMany({
    where: { provider: 'PAYSTACK', type: 'WITHDRAWAL', status: 'SENT', createdAt: { lt: cutoff } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  for (const tx of sentPayouts) {
    const reference = tx.providerRef || tx.reference;
    try {
      const verified = await paystackService.verifyTransfer(reference);
      if (verified.status === 'success') {
        const claim = await prisma.transaction.updateMany({
          where: { reference: tx.reference, status: 'SENT' },
          data: { status: 'COMPLETED', providerRef: reference },
        });
        if (claim.count === 1) settled += 1;
      } else if (String(verified.status).toLowerCase() === 'reversed') {
        // Reversal credits the Paystack balance back - safe to refund the wallet.
        const res = await refundFailedWithdrawal({ transactionId: tx.reference, reason: 'paystack transfer reversed (verified)' });
        if (res.refunded) refunded += 1;
      } else if (String(verified.status).toLowerCase() === 'failed') {
        // `failed` does NOT return the debit to the balance (only `reversed`
        // does) - hold + alert, never auto-refund.
        logger.error('PAYSTACK_PAYOUT_HOLD transfer failed (verified) - funds NOT auto-returned, manual review required', { reference });
        await alertPaystackPayoutHold({
          transactionId: tx.reference,
          reference,
          reason: 'transfer failed - verify the Paystack balance before refunding the wallet',
        });
      } else {
        logger.warn('Paystack payout still pending after grace window', { reference, status: verified.status });
      }
    } catch (err) {
      logger.warn('Paystack payout reconcile errored', { reference, error: err.message });
    }
  }

  logger.info('Paystack reconcile sweep complete', {
    scannedFunding: pendingFunding.length, scannedPayouts: sentPayouts.length, settled, failed, refunded,
  });
  return { settled, failed, refunded };
};

module.exports = {
  startPaymentWorker,
  __test: { handlePaystackWebhook, reconcilePaystack, handleWithdrawal, handleProvisionVirtualAccount },
};
