/**
 * Utility queue worker - calls the BilalSadaSub VTU API for utility purchases.
 *
 * FLOW:
 * 1. Wallet already deducted by utility.service
 * 2. Check payment status for idempotency (skip if already settled)
 * 3. Call the provider API (with the unique request-id = our reference)
 * 4a. SUCCESS → mark COMPLETED, emit token (electricity) via push + SMS, fan-out events
 * 4b. PENDING → mark PENDING, schedule POLL_PENDING (30s, ≤10 attempts ≈ 5 min)
 * 4c. DEFINITIVE FAILURE → mark FAILED + refund inline, do NOT throw
 * 4d. INFRA error (network/5xx) → propagate so BullMQ retries (the shared
 *     request-id makes the retry idempotent on the provider side)
 *
 * Reconciliation: BilalSada has no query endpoint, so POLL_PENDING's
 * queryTransaction returns null. A payment that ever lands PENDING (or whose
 * buy we couldn't confirm) is therefore refunded once MAX_ATTEMPTS expires
 * rather than polled to completion.
 */

const { Worker } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, UTILITY_JOBS, POLL_CONFIG, STUCK_PAYMENT_GRACE_MS } = require('../jobs');
const { logger } = require('../../utils/logger');
const { prisma } = require('../../config/database');
const vtuProvider = require('../../services/bilalsada.service');
const messagingService = require('../../services/messaging.service');
const notifyService = require('../../services/notify.service');
// NB: lazy-require `../index` inside the call site below to break the circular
// import (`queues/index.js` requires this worker to start it; if we required
// `../index` at the top of this file it would resolve to a half-initialised
// module and `schedulePollPending` would be `undefined`).
const _schedulePollPending = (...args) => require('../index').schedulePollPending(...args);

const SETTLED_STATUSES = ['COMPLETED', 'FAILED', 'REFUNDED'];

const startUtilityWorker = () => {
  const worker = new Worker(
    QUEUES.UTILITY,
    async (job) => {
      switch (job.name) {
        case UTILITY_JOBS.PROCESS_AIRTIME:     return processAirtime(job.data);
        case UTILITY_JOBS.PROCESS_DATA:        return processData(job.data);
        case UTILITY_JOBS.PROCESS_CABLE:       return processCable(job.data);
        case UTILITY_JOBS.PROCESS_ELECTRICITY: return processElectricity(job.data);
        case UTILITY_JOBS.POLL_PENDING:        return processPoll(job.data);
        case UTILITY_JOBS.REFUND_FAILED:       return processRefund(job.data);
        case UTILITY_JOBS.RECONCILE_STUCK:     return reconcileStuckPayments();
        // Throw on unknown - BullMQ will mark the job as failed and surface
        // it in the failed-jobs list. Returning silently here would leak the
        // payment as PENDING forever (the customer's wallet was already
        // debited at enqueue time). If you see this in logs, the enqueue
        // call site is passing a stale/wrong job name.
        default: throw new Error(`Unknown utility job name: ${job.name}`);
      }
    },
    { connection: redis, concurrency: 5 }
  );

  worker.on('failed', (job, error) => {
    logger.error(`Utility job permanently failed: ${job.name}`, {
      jobId: job.id,
      error: error.message,
      attemptsMade: job.attemptsMade,
    });
    const { captureError } = require('../../utils/sentry');
    captureError(error, {
      queue: 'utility-queue',
      jobName: job?.name,
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
    });

    // SAFETY NET: a permanently-failed processing job (e.g. the provider threw a
    // non-2xx because the reseller wallet was empty) would otherwise leave the
    // payment stranded in PROCESSING with the customer's wallet already
    // debited and no refund. Once BullMQ has exhausted its retries, reconcile
    // the payment immediately: re-query the provider, then complete if it
    // actually delivered, or refund. Idempotent, so it's safe alongside the
    // cron sweep. Only the buy/poll jobs carry a paymentId.
    const paymentId = job?.data?.paymentId;
    const maxAttempts = job?.opts?.attempts ?? 1;
    const isFinalAttempt = (job?.attemptsMade ?? 0) >= maxAttempts;
    if (paymentId && isFinalAttempt) {
      reconcileOnePayment(paymentId).catch((err) => {
        logger.error('Post-failure reconcile errored', { paymentId, error: err.message });
      });
    }
  });

  return worker;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getPayment = (paymentId) =>
  prisma.utilityPayment.findUnique({ where: { id: paymentId } });

const markPayment = (paymentId, reference, status, extra = {}) =>
  prisma.$transaction([
    prisma.utilityPayment.update({ where: { id: paymentId }, data: { status, ...extra } }),
    prisma.transaction.updateMany({ where: { reference }, data: { status: _txStatus(status) } }),
  ]);

// Wallet transaction status mirrors the payment lifecycle but uses the
// transaction-table enum values.
const _txStatus = (paymentStatus) => {
  switch (paymentStatus) {
    case 'COMPLETED': return 'COMPLETED';
    case 'FAILED':    return 'FAILED';
    case 'REFUNDED':  return 'REFUNDED';
    case 'PENDING':   return 'PROCESSING';
    default:          return paymentStatus;
  }
};

const refundPayment = async ({ paymentId, userId, amount, reference }) => {
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.utilityPayment.findUnique({ where: { id: paymentId } });
      // Idempotency: if already refunded (e.g. concurrent poll + initial call),
      // don't credit twice.
      if (!existing || existing.status === 'REFUNDED') return;

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new Error('Wallet not found for refund');
      const balance = Number(wallet.balance);

      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount } } });

      await tx.transaction.create({
        data: {
          reference: `REFUND-${reference}`,
          type: 'REFUND',
          status: 'COMPLETED',
          amount,
          description: `Refund for failed utility payment`,
          creditWalletId: wallet.id,
          balanceBefore: balance,
          balanceAfter: balance + amount,
        },
      });

      await tx.utilityPayment.update({ where: { id: paymentId }, data: { status: 'REFUNDED' } });
    });
    logger.info('Utility refund processed', { paymentId, userId, amount });

    // Notify the user the refund landed.
    try {
      await notifyService.onWalletEvent(userId, {
        kind: 'REFUND',
        amount,
        transactionId: reference,
        route: '/wallet',
        description: `₦${Number(amount).toLocaleString('en-NG')} refunded for failed utility payment.`,
      });
    } catch (err) {
      logger.warn('Refund notify failed (non-fatal)', { paymentId, error: err.message });
    }
  } catch (err) {
    logger.error('Utility refund failed', { paymentId, error: err.message });
    // Don't throw - log and continue; a human should resolve manually
  }
};

// Fan-out: user-facing notification on terminal status.
const _notifyOutcome = async ({ payment, status, token }) => {
  const typeLabel = (payment.type || 'utility').toLowerCase();
  const amount = `₦${Number(payment.amount || 0).toLocaleString('en-NG')}`;

  let title, body;
  if (status === 'COMPLETED') {
    if (payment.type === 'ELECTRICITY' && token) {
      title = 'Electricity token ready';
      body = `Your ${amount} electricity payment is complete. Token: ${token}`;
    } else if (payment.type === 'AIRTIME') {
      title = 'Airtime delivered';
      body = `${amount} airtime credited to ${payment.phoneNumber}.`;
    } else if (payment.type === 'DATA') {
      title = 'Data delivered';
      body = `${payment.plan || 'Data plan'} activated on ${payment.phoneNumber}.`;
    } else if (payment.type === 'CABLE') {
      title = 'Cable subscription active';
      body = `${payment.plan || 'Subscription'} active on smart card ${payment.meterNumber}.`;
    } else {
      title = 'Utility payment complete';
      body = `Your ${typeLabel} payment of ${amount} was successful.`;
    }
  } else if (status === 'FAILED') {
    title = 'Utility payment failed';
    body = `Your ${typeLabel} payment of ${amount} failed. A refund is in progress.`;
  }
  if (!title) return;

  try {
    await notifyService.pushAndSocket(payment.userId, {
      type: status === 'COMPLETED' ? 'WALLET' : 'REFUND',
      title,
      body,
      data: { route: '/utility-history', utilityPaymentId: payment.id, status, token: token || null },
      transactionId: payment.transactionId || null,
    });
  } catch (err) {
    logger.warn('Utility notify failed (non-fatal)', { paymentId: payment.id, error: err.message });
  }
};

// On delivered electricity → SMS the token to the customer's phone for offline
// access (per Phase 7 AC). Best-effort; failures are logged and swallowed.
const _smsElectricityToken = async ({ payment, token }) => {
  if (!token || !payment?.phoneNumber) return;
  const amount = `₦${Number(payment.amount || 0).toLocaleString('en-NG')}`;
  const msg = `Your ${payment.biller} token for meter ${payment.meterNumber} (${amount}): ${token}. - Katsina Logistics`;
  try {
    await messagingService.sendSms(payment.phoneNumber, msg);
  } catch (err) {
    logger.warn('Electricity token SMS failed (non-fatal)', {
      paymentId: payment.id, error: err.message,
    });
  }
};

// Extract a token + optional beneficiary name from a provider electricity response.
const _extractElectricityMeta = (result) => {
  const token = result?.token || result?.purchased_token || result?.Token || null;
  const beneficiaryName = result?.Customer_Name || result?.customer_name || result?.name || null;
  return { token, beneficiaryName };
};

const handleResult = async (result, ctx, { isPoll = false } = {}) => {
  const { paymentId, userId, amount, reference, type } = ctx;

  // ── Replay guard ──────────────────────────────────────────────────────────
  // If the payment is already in a terminal state (COMPLETED/FAILED/REFUNDED),
  // a duplicate handleResult invocation must NOT re-emit notifications or
  // re-credit the wallet. The worker entry-points enforce this too, but we
  // also guard here so the function is idempotent on its own.
  const _current = await getPayment(paymentId);
  if (_current && SETTLED_STATUSES.includes(_current.status)) {
    logger.info('handleResult skipped (already settled)', { paymentId, status: _current.status, isPoll });
    return;
  }

  // ── Definitive success ────────────────────────────────────────────────────
  if (vtuProvider.isSuccess(result)) {
    const { token, beneficiaryName } = type === 'ELECTRICITY'
      ? _extractElectricityMeta(result)
      : { token: null, beneficiaryName: null };

    await markPayment(paymentId, reference, 'COMPLETED', {
      providerRef: String(result?.id || result?.ident || ''),
      ...(token ? { token } : {}),
      ...(beneficiaryName ? { beneficiaryName } : {}),
    });
    logger.info('Utility payment completed', { paymentId, reference, isPoll });

    const fresh = await getPayment(paymentId);
    await _notifyOutcome({ payment: fresh, status: 'COMPLETED', token });
    if (type === 'ELECTRICITY' && token) {
      await _smsElectricityToken({ payment: fresh, token });
    }
    return;
  }

  // ── Provider says still pending → schedule a poll ─────────────────────────
  if (vtuProvider.isPending(result)) {
    const payment = await getPayment(paymentId);
    const attempts = (payment?.pollAttempts || 0) + 1;

    if (attempts > POLL_CONFIG.MAX_ATTEMPTS) {
      // Exhausted the 5-minute window. Treat as failure + refund.
      logger.warn('Provider pending window exhausted, refunding', { paymentId, attempts });
      await markPayment(paymentId, reference, 'FAILED', {
        providerRef: String(result?.id || ''),
      });
      const fresh = await getPayment(paymentId);
      await _notifyOutcome({ payment: fresh, status: 'FAILED' });
      await refundPayment({ paymentId, userId, amount, reference });
      return;
    }

    await prisma.utilityPayment.update({
      where: { id: paymentId },
      data: {
        status: 'PENDING',
        pollAttempts: attempts,
        lastPolledAt: new Date(),
        ...(result?.id ? { providerRef: String(result.id) } : {}),
      },
    });

    await _schedulePollPending(
      { paymentId, userId, amount, reference, type, providerRequestId: reference },
      POLL_CONFIG.INTERVAL_MS,
    );
    logger.info('Utility payment pending, scheduled poll', { paymentId, attempts });
    return;
  }

  // ── Definitive failure → refund ──────────────────────────────────────────
  await markPayment(paymentId, reference, 'FAILED', {
    providerRef: String(result?.id || ''),
  });
  logger.warn('Provider returned failure, refunding', { paymentId, result });
  const fresh = await getPayment(paymentId);
  await _notifyOutcome({ payment: fresh, status: 'FAILED' });
  await refundPayment({ paymentId, userId, amount, reference });
};

// ─── Job processors ───────────────────────────────────────────────────────────

const processAirtime = async ({ paymentId, userId, reference, networkId, phone, amount }) => {
  const payment = await getPayment(paymentId);
  if (!payment || SETTLED_STATUSES.includes(payment.status)) return;

  const result = await vtuProvider.buyAirtime({ networkId, phone, amount, requestId: reference });
  await handleResult(result, { paymentId, userId, amount, reference, type: 'AIRTIME' });
};

const processData = async ({ paymentId, userId, reference, networkId, providerPlanId, phone, amount }) => {
  const payment = await getPayment(paymentId);
  if (!payment || SETTLED_STATUSES.includes(payment.status)) return;

  const result = await vtuProvider.buyData({ networkId, phone, planId: providerPlanId, requestId: reference });
  await handleResult(result, { paymentId, userId, amount, reference, type: 'DATA' });
};

const processCable = async ({ paymentId, userId, reference, cableNameId, cablePlanId, smartCardNumber, amount }) => {
  const payment = await getPayment(paymentId);
  if (!payment || SETTLED_STATUSES.includes(payment.status)) return;

  const result = await vtuProvider.buyCable({ cableNameId, cablePlanId, smartCardNumber, requestId: reference });
  await handleResult(result, { paymentId, userId, amount, reference, type: 'CABLE' });
};

const processElectricity = async ({ paymentId, userId, reference, discoId, meterNumber, meterType, amount }) => {
  const payment = await getPayment(paymentId);
  if (!payment || SETTLED_STATUSES.includes(payment.status)) return;

  const result = await vtuProvider.payElectricity({ discoId, meterNumber, meterType, amount, requestId: reference });
  await handleResult(result, { paymentId, userId, amount, reference, type: 'ELECTRICITY' });
};

/**
 * POLL_PENDING - re-query the provider by providerRequestId and route to the
 * same SUCCESS / PENDING / FAILURE branches. Recomputes ctx.type from the row
 * so the polling path is symmetric with the initial path (token + SMS still
 * fire). NB: BilalSada's queryTransaction is a no-op (null), so in practice
 * this path advances the attempt counter until the window closes and refunds.
 */
const processPoll = async ({ paymentId, userId, reference, providerRequestId }) => {
  const payment = await getPayment(paymentId);
  if (!payment || SETTLED_STATUSES.includes(payment.status)) {
    logger.info('Poll skipped (already settled)', { paymentId, status: payment?.status });
    return;
  }

  let result;
  try {
    result = await vtuProvider.queryTransaction(providerRequestId);
  } catch (err) {
    // Infra-level failure on the query. Treat as still-pending so handleResult
    // increments the attempt counter and schedules the next poll - otherwise
    // a single bad provider response would strand the payment in PENDING
    // forever with no future poll.
    logger.warn('Poll query failed, will be treated as still-pending', { paymentId, error: err.message });
    result = { status: 'pending' };
  }

  // No result yet (provider hasn't materialised the transaction) - treat as
  // pending so the attempt counter advances and we eventually refund.
  const synthetic = result ?? { status: 'pending' };
  await handleResult(synthetic, {
    paymentId,
    userId,
    amount: Number(payment.amount),
    reference,
    type: payment.type,
  }, { isPoll: true });
};

const processRefund = async (data) => refundPayment(data);

/**
 * Resolve a single payment that may be stuck. Re-runs the poll path: re-query
 * the provider by providerRequestId, then route through handleResult, which
 * completes it if the provider actually delivered, reschedules a poll if it's
 * genuinely still pending (within the attempt window), or marks it FAILED and
 * refunds otherwise. A throw-path payment the provider never accepted re-queries
 * to a 404 (null) → definitive failure → refund. Idempotent and safe to call
 * from both the failure handler and the cron sweep.
 */
const reconcileOnePayment = async (paymentId) => {
  const payment = await getPayment(paymentId);
  if (!payment || SETTLED_STATUSES.includes(payment.status)) return;

  // reference == the wallet Transaction.reference; on create both
  // transactionId and providerRequestId are set to the original reference.
  const reference = payment.transactionId || payment.providerRequestId;
  const providerRequestId = payment.providerRequestId || reference;

  logger.info('Reconciling stuck utility payment', {
    paymentId, status: payment.status, ageMs: Date.now() - new Date(payment.createdAt).getTime(),
  });

  await processPoll({
    paymentId,
    userId: payment.userId,
    reference,
    providerRequestId,
  });
};

/**
 * Cron sweep: find every payment still PROCESSING/PENDING past the grace window
 * and reconcile it. This is the backstop that catches anything the live poll
 * chain missed - provider throws that exhausted BullMQ retries, jobs lost on a
 * Redis restart, or worker downtime. Bounded per run.
 */
const reconcileStuckPayments = async () => {
  const cutoff = new Date(Date.now() - STUCK_PAYMENT_GRACE_MS);
  const stuck = await prisma.utilityPayment.findMany({
    where: { status: { in: ['PROCESSING', 'PENDING'] }, createdAt: { lt: cutoff } },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: { id: true },
  });

  if (stuck.length === 0) {
    logger.info('Reconcile sweep: no stuck utility payments');
    return { scanned: 0 };
  }

  logger.warn('Reconcile sweep: resolving stuck utility payments', { count: stuck.length });
  let resolved = 0;
  for (const { id } of stuck) {
    try {
      await reconcileOnePayment(id);
      resolved += 1;
    } catch (err) {
      logger.error('Reconcile sweep: payment errored', { paymentId: id, error: err.message });
    }
  }
  logger.info('Reconcile sweep complete', { scanned: stuck.length, resolved });
  return { scanned: stuck.length, resolved };
};

module.exports = {
  startUtilityWorker,
  reconcileStuckPayments,
  reconcileOnePayment,
  // Exported for tests
  _internal: {
    handleResult,
    refundPayment,
    processPoll,
    reconcileOnePayment,
    reconcileStuckPayments,
  },
};
