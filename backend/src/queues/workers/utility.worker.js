/**
 * Utility queue worker - vends airtime/data/cable/electricity via the active VTU
 * provider(s). Adapters are interchangeable (see services/vtu/router): BilalSada
 * is the synchronous primary, AlRahuz the asynchronous secondary/failover.
 *
 * FLOW:
 * 1. Wallet already deducted by utility.service; job carries a `providers` map
 *    of each provider's numeric IDs.
 * 2. Check payment status for idempotency (skip if already settled)
 * 3. Call the active provider (with the unique request-id = our reference)
 * 4a. SUCCESS → mark COMPLETED, emit token (electricity) via push + SMS, fan-out
 * 4b. PENDING → mark PENDING, schedule POLL_PENDING (30s, ≤10 attempts ≈ 5 min)
 * 4c. DEFINITIVE FAILURE → ESCALATE: if a secondary provider is configured and
 *     mapped for this plan, re-attempt the purchase on it (so we don't lose the
 *     sale); only when there's no usable secondary do we mark FAILED + refund.
 * 4d. INFRA error (network/5xx) on the *primary* → propagate so BullMQ retries
 *     (the shared request-id makes the retry idempotent on BilalSada's side).
 *     The same error on a *failover* attempt is treated as a failure → refund.
 *
 * Reconciliation: BilalSada has no query endpoint (queryTransaction → null), so
 * any payment stuck on it is refunded once the window expires; a payment on
 * AlRahuz is polled by its provider txn id until it resolves.
 */

const { Worker } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, UTILITY_JOBS, POLL_CONFIG, STUCK_PAYMENT_GRACE_MS } = require('../jobs');
const { logger } = require('../../utils/logger');
const { prisma } = require('../../config/database');
const vtuRouter = require('../../services/vtu/router');
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

// `extra` may carry a `provider` (the adapter that actually served the payment)
// which we mirror onto the paired wallet Transaction so its label stays accurate
// after a failover.
const markPayment = (paymentId, reference, status, extra = {}) =>
  prisma.$transaction([
    prisma.utilityPayment.update({ where: { id: paymentId }, data: { status, ...extra } }),
    prisma.transaction.updateMany({
      where: { reference },
      data: { status: _txStatus(status), ...(extra.provider ? { provider: extra.provider } : {}) },
    }),
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

// Per-type purchase dispatch. `ids` is the chosen provider's numeric IDs
// ({ networkId } or { networkId, planId }); `ctx` carries the common fields.
const PURCHASE = {
  AIRTIME: (adapter, ids, ctx) =>
    adapter.buyAirtime({ networkId: ids.networkId, phone: ctx.phone, amount: ctx.amount, requestId: ctx.reference }),
  DATA: (adapter, ids, ctx) =>
    adapter.buyData({ networkId: ids.networkId, phone: ctx.phone, planId: ids.planId, requestId: ctx.reference }),
  CABLE: (adapter, ids, ctx) =>
    adapter.buyCable({ cableNameId: ids.networkId, cablePlanId: ids.planId, smartCardNumber: ctx.smartCardNumber, requestId: ctx.reference }),
  ELECTRICITY: (adapter, ids, ctx) =>
    adapter.payElectricity({ discoId: ids.networkId, meterNumber: ctx.meterNumber, meterType: ctx.meterType, amount: ctx.amount, requestId: ctx.reference }),
};

/**
 * Attempt a purchase on `ctx.provider`. On the primary (live) attempt an infra
 * error propagates so BullMQ retries idempotently; on a failover attempt the
 * same error is treated as a failure (we then refund, since the secondary is
 * the last resort). A provider with no mapped IDs for this plan can't vend, so
 * we escalate straight away.
 */
const attemptPurchase = async (ctx, { isFailover = false } = {}) => {
  const { paymentId, type, provider, providers } = ctx;
  const payment = await getPayment(paymentId);
  if (!payment || SETTLED_STATUSES.includes(payment.status)) return;

  const ids = providers?.[provider];
  if (!ids) {
    logger.warn('No provider IDs mapped, escalating', { paymentId, provider, type });
    return escalate(ctx, { result: null });
  }

  const adapter = vtuRouter.getAdapter(provider);
  let result;
  try {
    result = await PURCHASE[type](adapter, ids, ctx);
  } catch (err) {
    if (!isFailover) throw err; // primary: let BullMQ retry (idempotent request-id)
    logger.warn('Failover provider buy errored, treating as failure', {
      paymentId, provider, error: err.message,
    });
    return escalate(ctx, { result: null });
  }
  return handleResult(result, ctx);
};

/**
 * A purchase on `ctx.provider` didn't succeed. If a secondary provider is
 * configured, differs from the one that just failed, and has IDs mapped for this
 * plan, re-attempt the sale on it. Otherwise mark FAILED and refund the wallet.
 */
// Refill purchase params (phone/meter/etc.) + the provider-ID map from the
// persisted payment row. The live path already has these on the job; the
// reconcile/poll path does not, so a failover from there needs them rehydrated.
const _enrichCtx = async (ctx) => {
  const payment = await getPayment(ctx.paymentId);
  if (!payment) return ctx;
  return {
    ...ctx,
    type: ctx.type || payment.type,
    amount: ctx.amount ?? Number(payment.amount),
    phone: ctx.phone ?? payment.phoneNumber,
    meterNumber: ctx.meterNumber ?? payment.meterNumber,
    // Cable stores the smart-card number in meterNumber; electricity stores the
    // meter type in `plan`.
    smartCardNumber: ctx.smartCardNumber ?? payment.meterNumber,
    meterType: ctx.meterType ?? payment.plan,
    providers: ctx.providers || payment.providerIds || undefined,
  };
};

const escalate = async (ctx, { result }) => {
  const provider = ctx.provider || 'BILALSADASUB';
  const { paymentId, userId, amount, reference } = ctx;
  const { secondary } = await vtuRouter.resolveProviders();
  const providers = ctx.providers || (await getPayment(paymentId))?.providerIds || undefined;

  if (secondary && provider !== secondary && providers?.[secondary]) {
    logger.warn('Primary VTU provider failed, failing over to secondary', {
      paymentId, from: provider, to: secondary,
    });
    // Stay PROCESSING; reset the poll counter so the secondary gets its own window.
    await prisma.utilityPayment.update({
      where: { id: paymentId },
      data: { provider: secondary, pollAttempts: 0, providerRef: null },
    });
    const enriched = await _enrichCtx({ ...ctx, providers });
    return attemptPurchase({ ...enriched, provider: secondary }, { isFailover: true });
  }

  await markPayment(paymentId, reference, 'FAILED', { providerRef: String(result?.id || '') });
  logger.warn('VTU purchase failed with no failover available, refunding', { paymentId, provider });
  const fresh = await getPayment(paymentId);
  await _notifyOutcome({ payment: fresh, status: 'FAILED' });
  await refundPayment({ paymentId, userId, amount, reference });
};

const handleResult = async (result, ctx, { isPoll = false } = {}) => {
  // Null provider == the (default) primary, BilalSada - mirrors the schema's
  // nullable `provider` column and keeps direct callers (tests) simple.
  const provider = ctx.provider || 'BILALSADASUB';
  ctx = { ...ctx, provider };
  const { paymentId, amount, reference, type } = ctx;
  const adapter = vtuRouter.getAdapter(provider);

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
  if (adapter.isSuccess(result)) {
    const { token, beneficiaryName } = type === 'ELECTRICITY'
      ? _extractElectricityMeta(result)
      : { token: null, beneficiaryName: null };

    await markPayment(paymentId, reference, 'COMPLETED', {
      provider,
      providerRef: String(result?.id || result?.ident || ''),
      ...(token ? { token } : {}),
      ...(beneficiaryName ? { beneficiaryName } : {}),
    });
    logger.info('Utility payment completed', { paymentId, reference, provider, isPoll });

    const fresh = await getPayment(paymentId);
    await _notifyOutcome({ payment: fresh, status: 'COMPLETED', token });
    if (type === 'ELECTRICITY' && token) {
      await _smsElectricityToken({ payment: fresh, token });
    }
    return;
  }

  // ── Provider says still pending → schedule a poll ─────────────────────────
  if (adapter.isPending(result)) {
    const payment = await getPayment(paymentId);
    const attempts = (payment?.pollAttempts || 0) + 1;

    if (attempts > POLL_CONFIG.MAX_ATTEMPTS) {
      // Exhausted the window. There's no second async provider to fall over to
      // (only AlRahuz is pending-capable), so escalate → refund.
      logger.warn('Provider pending window exhausted', { paymentId, attempts, provider });
      return escalate(ctx, { result });
    }

    // AlRahuz is polled by its own txn id (the `id` it returned), not our ref.
    const providerRef = String(result?.id || payment?.providerRef || '');
    await prisma.utilityPayment.update({
      where: { id: paymentId },
      data: {
        status: 'PENDING',
        provider,
        pollAttempts: attempts,
        lastPolledAt: new Date(),
        ...(providerRef ? { providerRef } : {}),
      },
    });

    await _schedulePollPending(
      { paymentId, userId: ctx.userId, amount, reference, type, provider, providers: ctx.providers, providerRequestId: providerRef || reference },
      POLL_CONFIG.INTERVAL_MS,
    );
    logger.info('Utility payment pending, scheduled poll', { paymentId, attempts, provider });
    return;
  }

  // ── Definitive failure → escalate (failover, else refund) ─────────────────
  logger.warn('Provider returned failure', { paymentId, provider, result });
  return escalate(ctx, { result });
};

// ─── Job processors ───────────────────────────────────────────────────────────
// Each entry-point resolves the live primary, then hands off to attemptPurchase
// which handles success / pending / failover. `providers` is the per-provider ID
// map attached at enqueue time by utility.service.

const _startPurchase = async (type, { paymentId, userId, reference, providers, ...rest }) => {
  const payment = await getPayment(paymentId);
  if (!payment || SETTLED_STATUSES.includes(payment.status)) return;
  const { primary } = await vtuRouter.resolveProviders();
  await attemptPurchase({ paymentId, userId, reference, providers, provider: primary, type, ...rest });
};

const processAirtime = (data) => _startPurchase('AIRTIME', data);
const processData = (data) => _startPurchase('DATA', data);
const processCable = (data) => _startPurchase('CABLE', data);
const processElectricity = (data) => _startPurchase('ELECTRICITY', data);

/**
 * POLL_PENDING - re-query the provider that holds the payment by its txn id and
 * route to the same SUCCESS / PENDING / FAILURE branches. The provider is read
 * from the row (set when the payment landed PENDING) so the right adapter is
 * used after a failover. NB: BilalSada's queryTransaction is a no-op (null), so
 * for it this path advances the counter until the window closes; AlRahuz is
 * polled for real.
 */
const processPoll = async ({ paymentId, userId, reference, provider, providers, providerRequestId }) => {
  const payment = await getPayment(paymentId);
  if (!payment || SETTLED_STATUSES.includes(payment.status)) {
    logger.info('Poll skipped (already settled)', { paymentId, status: payment?.status });
    return;
  }

  const activeProvider = payment.provider || provider || 'BILALSADASUB';
  const adapter = vtuRouter.getAdapter(activeProvider);
  const queryId = providerRequestId || payment.providerRef || reference;

  let result;
  try {
    result = await adapter.queryTransaction(queryId);
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
    provider: activeProvider,
    providers,
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
  // Poll the provider that holds it by its own txn id (providerRef for AlRahuz).
  const providerRequestId = payment.providerRef || payment.providerRequestId || reference;

  logger.info('Reconciling stuck utility payment', {
    paymentId, status: payment.status, provider: payment.provider,
    ageMs: Date.now() - new Date(payment.createdAt).getTime(),
  });

  await processPoll({
    paymentId,
    userId: payment.userId,
    reference,
    provider: payment.provider,
    providers: payment.providerIds || undefined,
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
    attemptPurchase,
    escalate,
    refundPayment,
    processPoll,
    processAirtime,
    reconcileOnePayment,
    reconcileStuckPayments,
  },
};
