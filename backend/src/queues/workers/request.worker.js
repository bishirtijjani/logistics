/**
 * Request worker - handles unified request queue jobs
 * 
 * Jobs:
 * - BROADCAST_TO_RIDERS: Broadcast new request to nearby riders
 * - SETTLE_REQUEST: Process financial settlement after delivery
 * - REFUND_REQUEST: Refund customer for cancelled request
 * - AUTO_CANCEL_UNMATCHED: Auto-cancel requests without rider after timeout
 */

const { Worker } = require('bullmq');
const { prisma } = require('../../config/database');
const { redis } = require('../../config/redis');
const { logger } = require('../../utils/logger');
const { getIO } = require('../../sockets');
const { RIDER, REQUEST, getUserRoom, getRequestRoom } = require('../../sockets/events');
const { emitCompleted, emitCancelled } = require('../../sockets/handlers/request.handler');
const { REQUEST_JOBS } = require('../jobs');
const notifyService = require('../../services/notify.service');
const { getSetting } = require('../../services/settings.service');
const { REDIS_KEYS, RIDER_MATCHING } = require('../../utils/constants');

// ============================================================
// Expanding-radius rider matching
//
// Spec:
//   - Read settings: rings [5,10,15] km, ringTimeoutSec 60, max attempts = rings.length.
//   - Per ring: GEOSEARCH the rider GEO index, take up to 10 nearest available
//     riders within the ring, emit rider:job:new to each (in the rider's
//     personal room), wait ringTimeout.
//   - If still unaccepted at end of ring, expand to next ring. If all rings
//     exhausted, enqueue AUTO_CANCEL_UNMATCHED.
//   - Increment Request.searchAttempts each ring and emit
//     request:matching:status to the customer.
//
// A rider "accepts" by hitting the accept endpoint (existing flow). That
// endpoint sets Request.riderId + status=RIDER_ASSIGNED. We poll the request
// row at the end of each ring window - if it has been claimed, we exit
// cleanly without queueing more.
// ============================================================

// We track every rider that has been offered this request across rings so that
// when the request is claimed (or cancelled) we can notify exactly those
// riders, not the entire socket server.
const offeredKey = (requestId) => `request:offered:${requestId}`;

const notifyJobTaken = async (io, requestId, takenByRiderId = null) => {
  try {
    const ids = await redis.smembers(offeredKey(requestId));
    for (const riderId of ids) {
      if (riderId === takenByRiderId) continue;
      io.to(getUserRoom(riderId)).emit(RIDER.JOB_TAKEN, { requestId });
    }
    await redis.del(offeredKey(requestId));
  } catch (err) {
    logger.warn('notifyJobTaken failed', { requestId, error: err.message });
  }

  // Phase 7 - settle the persistent offer log. Two distinct terminal states
  // depending on what just happened:
  //   - takenByRiderId set     → another rider claimed it. Other OFFERED
  //                              rows become TAKEN.
  //   - takenByRiderId null    → no rider claimed it (auto-cancel,
  //                              customer cancellation mid-ring, etc.).
  //                              Any still-OFFERED rows become EXPIRED.
  // The accepting rider's own row is already ACCEPTED via acceptJob's
  // transaction so we exclude that rider here.
  try {
    if (takenByRiderId) {
      await prisma.riderOfferLog.updateMany({
        where: {
          requestId,
          outcome: 'OFFERED',
          riderId: { not: takenByRiderId },
        },
        data: { outcome: 'TAKEN', respondedAt: new Date() },
      });
    } else {
      await prisma.riderOfferLog.updateMany({
        where: { requestId, outcome: 'OFFERED' },
        data: { outcome: 'EXPIRED', respondedAt: new Date() },
      });
    }
  } catch (err) {
    logger.warn('Failed to settle rider offer logs', { requestId, error: err.message });
  }
};

/**
 * Pre-load matching config from settings exactly once per ring round.
 */
const loadMatchingConfig = async () => {
  const rings = await getSetting('delivery.broadcastRadiusRings', RIDER_MATCHING.RADIUS_RINGS_KM);
  const ringTimeoutSec = Number(
    await getSetting('delivery.broadcastRingTimeoutSec', RIDER_MATCHING.RING_TIMEOUT_SECONDS),
  );
  const enabled = await getSetting('delivery.matchingEnabled', true);
  const ringList = Array.isArray(rings) && rings.length > 0 ? rings : RIDER_MATCHING.RADIUS_RINGS_KM;
  return {
    enabled: enabled === true || enabled === 'true', // settings can JSON-serialize either way
    ringList,
    ringTimeoutSec,
    maxPerRing: RIDER_MATCHING.MAX_RIDERS_PER_RING,
  };
};

/**
 * Emit a single ring: GEOSEARCH for candidates, push per-rider offers,
 * record the offer set, and emit matching-status to the customer.
 */
const emitRing = async (io, { request, attempt, ringList, ringTimeoutSec, maxPerRing }) => {
  const radiusKm = Number(ringList[attempt]);
  const { id: requestId, pickupLat, pickupLng } = request;

  let geoResults = [];
  try {
    geoResults = await redis.geosearch(
      REDIS_KEYS.RIDER_GEO_INDEX,
      'FROMLONLAT', pickupLng, pickupLat,
      'BYRADIUS', radiusKm, 'km',
      'ASC',
      'COUNT', maxPerRing,
      'WITHCOORD', 'WITHDIST',
    );
  } catch (err) {
    logger.error('GEOSEARCH failed', { requestId, error: err.message });
  }

  const candidates = geoResults
    .map((entry) => ({ riderId: entry[0], distanceKm: Number(entry[1]) }))
    .filter((c) => c.riderId);

  const updated = await prisma.request.update({
    where: { id: requestId },
    data: {
      searchAttempts: { increment: 1 },
      lastBroadcastAt: new Date(),
    },
    select: { customerId: true, searchAttempts: true },
  });

  io.to(getUserRoom(updated.customerId)).emit(REQUEST.MATCHING_STATUS, {
    requestId,
    attempt: attempt + 1,
    totalAttempts: ringList.length,
    radiusKm,
    candidates: candidates.length,
  });

  for (const c of candidates) {
    io.to(getUserRoom(c.riderId)).emit(RIDER.NEW_JOB, {
      requestId,
      pickupLat,
      pickupLng,
      fare: request.fare,
      distanceKm: request.distanceKm,
      riderDistanceKm: Math.round(c.distanceKm * 10) / 10,
      ringRadiusKm: radiusKm,
      expiresInSeconds: ringTimeoutSec,
    });
  }

  if (candidates.length > 0) {
    try {
      await redis.sadd(offeredKey(requestId), ...candidates.map((c) => c.riderId));
      await redis.expire(offeredKey(requestId), 1800);
    } catch (err) {
      logger.warn('Failed to record offer set', { requestId, error: err.message });
    }

    // Phase 7 - persist an OFFERED row per candidate rider so the rider's
    // performance screen can compute acceptance rate. Skip riders that
    // already have a row for this request (re-ring with overlap) to avoid
    // resetting an EXPIRED/DECLINED outcome.
    try {
      const candidateIds = candidates.map((c) => c.riderId);
      const existing = await prisma.riderOfferLog.findMany({
        where: { requestId, riderId: { in: candidateIds } },
        select: { riderId: true },
      });
      const existingSet = new Set(existing.map((e) => e.riderId));
      const newRows = candidates
        .filter((c) => !existingSet.has(c.riderId))
        .map((c) => ({
          riderId: c.riderId,
          requestId,
          outcome: 'OFFERED',
          ringAttempt: attempt,
          distanceKm: Math.round(c.distanceKm * 10) / 10,
        }));
      if (newRows.length > 0) {
        await prisma.riderOfferLog.createMany({ data: newRows, skipDuplicates: true });
      }
    } catch (err) {
      logger.warn('Failed to persist rider offer logs', { requestId, error: err.message });
    }
  }

  logger.info('Ring broadcast complete', {
    requestId, attempt: attempt + 1, radiusKm, candidates: candidates.length,
  });
};

/**
 * BROADCAST_TO_RIDERS - entry point. Emits the FIRST ring and schedules
 * the next CHECK_RING_PROGRESS job. Returns immediately so the worker slot
 * is free; the next ring check arrives via a delayed BullMQ job rather than
 * an in-process sleep.
 */
const broadcastToRiders = async (job) => {
  const { requestId, pickupLat, pickupLng, fare, distanceKm } = job.data;
  const io = getIO();

  const initial = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, status: true, customerId: true, riderId: true },
  });
  if (!initial) {
    logger.warn('broadcastToRiders: request not found', { requestId });
    return;
  }
  if (!['REQUESTED', 'READY_FOR_PICKUP'].includes(initial.status) || initial.riderId) {
    logger.info('broadcastToRiders: request not eligible', {
      requestId, status: initial.status, riderId: initial.riderId,
    });
    return;
  }

  const cfg = await loadMatchingConfig();
  if (!cfg.enabled) {
    // Rider-app workstream not yet shipped → don't waste rings; auto-cancel
    // immediately so the customer gets refunded promptly instead of after
    // 3 × ringTimeout of phantom searching.
    logger.warn('Rider matching disabled; skipping rings and auto-cancelling', { requestId });
    const { requestQueue } = require('../index');
    await requestQueue.add(
      REQUEST_JOBS.AUTO_CANCEL_UNMATCHED,
      { requestId, reason: 'Rider matching is currently unavailable.' },
      { delay: 1000 },
    );
    return;
  }

  await emitRing(io, {
    request: { id: requestId, pickupLat, pickupLng, fare, distanceKm },
    attempt: 0,
    ringList: cfg.ringList,
    ringTimeoutSec: cfg.ringTimeoutSec,
    maxPerRing: cfg.maxPerRing,
  });

  const { requestQueue } = require('../index');
  await requestQueue.add(
    REQUEST_JOBS.CHECK_RING_PROGRESS,
    {
      requestId, pickupLat, pickupLng, fare, distanceKm,
      nextAttempt: 1,
    },
    { delay: cfg.ringTimeoutSec * 1000 },
  );
};

/**
 * CHECK_RING_PROGRESS - fires `ringTimeoutSec` after the previous ring.
 * If the request was claimed → notify the offered riders the job is gone.
 * Else emit the next ring and schedule the next check; or, on the final
 * ring, schedule AUTO_CANCEL_UNMATCHED.
 */
const checkRingProgress = async (job) => {
  const { requestId, pickupLat, pickupLng, fare, distanceKm, nextAttempt } = job.data;
  const io = getIO();

  const after = await prisma.request.findUnique({
    where: { id: requestId },
    select: { status: true, riderId: true },
  });
  if (!after) return;

  if (after.riderId || !['REQUESTED', 'READY_FOR_PICKUP'].includes(after.status)) {
    logger.info('checkRingProgress: claimed/changed - stopping', { requestId, status: after.status });
    await notifyJobTaken(io, requestId, after.riderId);
    return;
  }

  const cfg = await loadMatchingConfig();

  // Re-honour the feature flag in case it flipped between rings.
  if (!cfg.enabled) {
    const { requestQueue } = require('../index');
    await requestQueue.add(
      REQUEST_JOBS.AUTO_CANCEL_UNMATCHED,
      { requestId, reason: 'Rider matching is currently unavailable.' },
      { delay: 1000 },
    );
    return;
  }

  if (nextAttempt >= cfg.ringList.length) {
    // All rings exhausted - auto-cancel + refund.
    const { requestQueue } = require('../index');
    await requestQueue.add(
      REQUEST_JOBS.AUTO_CANCEL_UNMATCHED,
      { requestId, reason: 'No rider available within search radius' },
      { delay: RIDER_MATCHING.AUTO_CANCEL_BUFFER_MS },
    );
    logger.info('All rings exhausted - auto-cancel queued', { requestId });
    return;
  }

  await emitRing(io, {
    request: { id: requestId, pickupLat, pickupLng, fare, distanceKm },
    attempt: nextAttempt,
    ringList: cfg.ringList,
    ringTimeoutSec: cfg.ringTimeoutSec,
    maxPerRing: cfg.maxPerRing,
  });

  const { requestQueue } = require('../index');
  await requestQueue.add(
    REQUEST_JOBS.CHECK_RING_PROGRESS,
    { requestId, pickupLat, pickupLng, fare, distanceKm, nextAttempt: nextAttempt + 1 },
    { delay: cfg.ringTimeoutSec * 1000 },
  );
};

// ============================================================
// Settle Request
// ============================================================

const settleRequest = async (job) => {
  const { requestId } = job.data;

  logger.info('Settling request', { requestId });

  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.request.findUnique({
      where: { id: requestId },
      include: {
        customer: { include: { wallet: true } },
        merchant: { include: { user: { include: { wallet: true } }, merchantWallet: true } },
        rider: { include: { user: { include: { wallet: true } } } },
      },
    });

    if (!request) throw new Error('Request not found');
    if (request.status !== 'DELIVERED') throw new Error('Request not in DELIVERED state');

    const merchantEarning = Number(request.merchantEarning);
    const riderEarning = Number(request.riderEarning);
    const platformEarning = Number(request.platformEarning);
    const customerPaid = Number(request.customerPaid);
    const totalRelease = merchantEarning + riderEarning + platformEarning;
    const reference = `SETTLE-${requestId}-${Date.now()}`;

    // Drain PLATFORM_ESCROW by the amount we are about to disburse.
    // Ledger invariant: every ESCROW_HOLD has exactly one ESCROW_RELEASE or
    // ESCROW_REFUND of equal amount. Reconciliation worker relies on this.
    if (totalRelease > 0) {
      await tx.systemWallet.update({
        where: { id: 'PLATFORM_ESCROW' },
        data: { balance: { decrement: totalRelease } },
      });
      await tx.transaction.create({
        data: {
          reference: `${reference}-ESCROW-RELEASE`,
          type: 'ESCROW_RELEASE',
          status: 'COMPLETED',
          amount: totalRelease,
          fee: 0,
          description: `Escrow release for request ${requestId}`,
          metadata: {
            requestId,
            merchantEarning,
            riderEarning,
            platformEarning,
            customerPaid,
            originalEscrowRef: request.escrowTransactionId,
          },
        },
      });
    }

    // Credit merchant earnings into the merchant's User wallet - the single
    // wallet a merchant spends (VTU), tops up, and withdraws from, exactly like
    // riders below. `merchantWallet.totalEarnings` is still bumped as a
    // lifetime-earnings stat (it no longer holds spendable money).
    if (request.merchant && request.merchant.user?.wallet && merchantEarning > 0) {
      const merchantWallet = request.merchant.user.wallet;
      await tx.wallet.update({
        where: { id: merchantWallet.id },
        data: { balance: { increment: merchantEarning } },
      });
      await tx.transaction.create({
        data: {
          reference: `${reference}-MERCHANT`,
          type: 'MERCHANT_EARNING',
          status: 'COMPLETED',
          amount: merchantEarning,
          fee: 0,
          description: `Earning for request ${requestId}`,
          creditWalletId: merchantWallet.id,
          balanceBefore: Number(merchantWallet.balance),
          balanceAfter: Number(merchantWallet.balance) + merchantEarning,
          metadata: { requestId, merchantId: request.merchantId },
        },
      });
      // Lifetime-earnings stat only (not spendable balance).
      if (request.merchant.merchantWallet) {
        await tx.merchantWallet.update({
          where: { merchantId: request.merchantId },
          data: { totalEarnings: { increment: merchantEarning } },
        });
      }
    }

    // Credit rider wallet (if applicable)
    if (request.rider && request.rider.user?.wallet && riderEarning > 0) {
      const riderWallet = request.rider.user.wallet;
      await tx.wallet.update({
        where: { id: riderWallet.id },
        data: { balance: { increment: riderEarning } },
      });
      await tx.transaction.create({
        data: {
          reference: `${reference}-RIDER`,
          type: 'RIDER_EARNING',
          status: 'COMPLETED',
          amount: riderEarning,
          fee: 0,
          description: `Earning for request ${requestId}`,
          creditWalletId: riderWallet.id,
          balanceBefore: Number(riderWallet.balance),
          balanceAfter: Number(riderWallet.balance) + riderEarning,
          metadata: { requestId, riderId: request.riderId },
        },
      });
      await tx.rider.update({
        where: { id: request.riderId },
        data: {
          totalDeliveries: { increment: 1 },
          totalEarnings: { increment: riderEarning },
        },
      });

      // Notify rider of earnings - live balance nudge + Notification Center row + push.
      // Include reference + createdAt + requestId so the rider client can
      // dedupe the socket-pushed bump against a fetched canonical row,
      // preventing the same earning being counted twice if a dashboard
      // fetch and this settlement land in overlapping windows.
      notifyService.balanceUpdated(request.rider.user.id, {
        balance: Number(riderWallet.balance) + riderEarning,
        transaction: {
          reference: `${reference}-RIDER`,
          type: 'RIDER_EARNING',
          status: 'COMPLETED',
          amount: riderEarning,
          description: `Delivery earning`,
          requestId,
          createdAt: new Date().toISOString(),
        },
      });
      notifyService.onWalletEvent(request.rider.user.id, {
        kind: 'RIDER_EARNING',
        amount: riderEarning,
        transactionId: `${reference}-RIDER`,
        route: '/wallet',
        description: `You earned ₦${Number(riderEarning).toLocaleString('en-NG')} on a delivery.`,
      }).catch((err) => logger.warn('RIDER_EARNING notification failed', { error: err.message }));
    }

    // Credit platform earnings system wallet - closes the escrow loop so the
    // platform fee actually lands somewhere accountable rather than sitting in
    // escrow forever.
    if (platformEarning > 0) {
      await tx.systemWallet.update({
        where: { id: 'PLATFORM_EARNINGS' },
        data: { balance: { increment: platformEarning } },
      });
      await tx.transaction.create({
        data: {
          reference: `${reference}-PLATFORM`,
          type: 'PLATFORM_EARNING',
          status: 'COMPLETED',
          amount: platformEarning,
          fee: 0,
          description: `Platform earning for request ${requestId}`,
          metadata: { requestId },
        },
      });
    }

    // Update request to SETTLED
    await tx.request.update({
      where: { id: requestId },
      data: { status: 'SETTLED', settledAt: new Date() },
    });

    if (request.merchant) {
      await tx.merchant.update({
        where: { id: request.merchantId },
        data: { totalOrders: { increment: 1 } },
      });
    }

    // Phase 4 - release the rider back into the pool. The acceptJob path
    // flips them to ON_DELIVERY; without this they'd stay ON_DELIVERY until
    // the next manual toggle, and the matcher would skip them.
    if (request.rider) {
      await tx.rider.update({
        where: { id: request.riderId },
        data: { availability: 'ONLINE' },
      });
    }

    return { merchantEarning, riderEarning, platformEarning, riderUserId: request.rider?.userId || null };
  });

  logger.info('Request settled', { requestId, ...result });

  const io = getIO();
  emitCompleted(io, requestId);

  return result;
};

// ============================================================
// Refund Request
// ============================================================

const refundRequest = async (job) => {
  const { requestId } = job.data;
  
  logger.info('Refunding request', { requestId });
  
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.request.findUnique({
      where: { id: requestId },
      include: {
        customer: { include: { wallet: true } },
        items: true,
        rider: { select: { id: true, availability: true } },
      },
    });

    if (!request) throw new Error('Request not found');
    if (request.status !== 'CANCELLED') throw new Error('Request not in CANCELLED state');

    // Idempotency guard. settleRequest is protected by the status transition
    // (DELIVERED → SETTLED) - once SETTLED, the status check rejects the retry.
    // Refund leaves the request in CANCELLED forever, so retries would re-enter
    // the body and double-credit. refundTransactionId is the contract: set
    // exactly once, on the first successful refund.
    if (request.refundTransactionId) {
      logger.info('Refund already processed, skipping', {
        requestId,
        existingRefund: request.refundTransactionId,
      });
      return { refundAmount: 0, alreadyRefunded: true };
    }

    // Phase 4 - release the rider back into the matcher pool. Rider's own
    // cancel already handles this inline, but admin force-cancel and
    // customer-cancel paths don't; doing it here covers all three.
    // Only flip ON_DELIVERY → ONLINE - don't disturb a rider who explicitly
    // went OFFLINE after the cancellation.
    if (request.rider?.id && request.rider.availability === 'ON_DELIVERY') {
      await tx.rider.update({
        where: { id: request.rider.id },
        data: { availability: 'ONLINE' },
      });
    }

    const customerPaid = Number(request.customerPaid);
    const cancellationFee = Number(request.cancellationFee || 0);
    // Refund is net of any cancellation fee. Fee can't exceed customerPaid.
    const feeApplied = Math.min(Math.max(0, cancellationFee), customerPaid);
    const refundAmount = Math.max(0, customerPaid - feeApplied);
    const reference = `REFUND-${requestId}-${Date.now()}`;

    // Drain PLATFORM_ESCROW by the full original customerPaid - closes the
    // escrow loop. The fee is then re-credited to PLATFORM_EARNINGS below so
    // accounting still balances: ESCROW_HOLD = ESCROW_REFUND (held -> released).
    if (customerPaid > 0) {
      await tx.systemWallet.update({
        where: { id: 'PLATFORM_ESCROW' },
        data: { balance: { decrement: customerPaid } },
      });
      await tx.transaction.create({
        data: {
          reference: `${reference}-ESCROW-REFUND`,
          type: 'ESCROW_REFUND',
          status: 'COMPLETED',
          amount: customerPaid,
          fee: feeApplied,
          description: `Escrow refund for cancelled request ${requestId}`,
          metadata: {
            requestId: request.id,
            originalEscrowRef: request.escrowTransactionId,
            cancellationFee: feeApplied,
            refundAmount,
          },
        },
      });
    }

    // Credit customer wallet by the net refund (paid - fee).
    if (refundAmount > 0) {
      await tx.wallet.update({
        where: { id: request.customer.wallet.id },
        data: { balance: { increment: refundAmount } },
      });
    }

    // Customer-facing refund row - separate from ESCROW_REFUND so the
    // customer sees a normal REFUND in their history.
    const customerRefundTx = await tx.transaction.create({
      data: {
        reference,
        type: 'REFUND',
        status: 'COMPLETED',
        amount: refundAmount,
        fee: feeApplied,
        description: feeApplied > 0
          ? `Refund for cancelled request ${requestId} (₦${feeApplied} cancellation fee)`
          : `Refund for cancelled request ${requestId}`,
        creditWalletId: request.customer.wallet.id,
        balanceBefore: Number(request.customer.wallet.balance),
        balanceAfter: Number(request.customer.wallet.balance) + refundAmount,
        metadata: { requestId: request.id, cancellationFee: feeApplied },
      },
    });

    // Park the cancellation fee in PLATFORM_EARNINGS so it doesn't sit
    // orphaned in escrow.
    if (feeApplied > 0) {
      await tx.systemWallet.update({
        where: { id: 'PLATFORM_EARNINGS' },
        data: { balance: { increment: feeApplied } },
      });
      await tx.transaction.create({
        data: {
          reference: `${reference}-CANCELLATION-FEE`,
          type: 'PLATFORM_EARNING',
          status: 'COMPLETED',
          amount: feeApplied,
          fee: 0,
          description: `Cancellation fee on request ${requestId}`,
          metadata: { requestId: request.id, kind: 'cancellation_fee' },
        },
      });
    }

    await tx.request.update({
      where: { id: request.id },
      data: { refundTransactionId: customerRefundTx.reference },
    });

    // Restore stock on the resolved variant - Phase 2 variants own stock, not
    // the parent Product. Mirrors forceCancelRequest.
    if (request.items && request.items.length > 0) {
      for (const item of request.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            where: { id: item.variantId },
            data: {
              stock: { increment: item.quantity },
              isAvailable: true,
            },
          });
        }
      }
    }

    return { refundAmount, cancellationFee: feeApplied, customerPaid };
  });
  
  logger.info('Request refunded', { requestId, ...result });

  // Skip the notify on a no-op retry - the customer already got their toast
  // on the first refund.
  if (result.alreadyRefunded) return result;

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { customer: { include: { wallet: true } } },
  });
  if (request?.customer) {
    notifyService.balanceUpdated(request.customer.id, {
      balance: Number(request.customer.wallet?.balance || 0),
      transaction: {
        type: 'REFUND',
        amount: result.refundAmount,
        description: result.cancellationFee > 0
          ? `Order refund (₦${result.cancellationFee} cancellation fee deducted)`
          : 'Order refund',
      },
    });
    // Notification Center row + push for the refund itself.
    notifyService.onWalletEvent(request.customer.id, {
      kind: 'REFUND',
      amount: result.refundAmount,
      route: '/wallet',
      description: result.cancellationFee > 0
        ? `₦${Number(result.refundAmount).toLocaleString('en-NG')} refunded - ₦${result.cancellationFee} cancellation fee deducted.`
        : `₦${Number(result.refundAmount).toLocaleString('en-NG')} refunded for cancelled order.`,
    }).catch((err) => logger.warn('REFUND notification failed', { error: err.message }));
  }

  return result;
};

// ============================================================
// Auto Cancel Unmatched
// ============================================================

const autoCancelUnmatched = async (job) => {
  const { requestId, reason } = job.data;

  logger.info('Auto-cancelling unmatched request', { requestId });

  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    logger.warn('Request not found for auto-cancel', { requestId });
    return;
  }

  // Only cancel if still in REQUESTED or READY_FOR_PICKUP (no rider assigned).
  // Idempotent against retries: if status already CANCELLED, do nothing.
  if (!['REQUESTED', 'READY_FOR_PICKUP'].includes(request.status)) {
    logger.info('Request already progressed, skipping auto-cancel', { requestId, status: request.status });
    return;
  }

  if (request.riderId) {
    logger.info('Rider already assigned, skipping auto-cancel', { requestId });
    return;
  }

  const cancellationReason = reason || 'No rider available within timeout';

  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: 'system',
      cancellationReason,
    },
  });

  // Emit the cancellation socket event so the customer's tracking screen
  // updates immediately (previously only the refund worker ran here and the
  // UI sat on "Searching..." until a manual refresh).
  const io = getIO();
  emitCancelled(io, requestId, request.customerId, cancellationReason);

  // Also tell any riders we previously offered this request that it's gone.
  // notifyJobTaken handles the offer-log EXPIRED state transition when
  // called with `null` (no claiming rider).
  await notifyJobTaken(io, requestId, null);

  // Notification Center row + push for the customer (consistent with the
  // customer-initiated cancel path).
  try {
    await notifyService.onRequestStatusChanged(
      { id: requestId, status: 'CANCELLED', customerId: request.customerId },
      request.status,
    );
  } catch (err) {
    logger.warn('onRequestStatusChanged failed (auto-cancel)', { requestId, error: err.message });
  }

  // Trigger refund - refund worker is idempotent via refundTransactionId.
  const { requestQueue } = require('../index');
  await requestQueue.add(REQUEST_JOBS.REFUND_REQUEST, { requestId });

  logger.info('Request auto-cancelled', { requestId });
};

// ============================================================
// Worker Setup
// ============================================================

const startRequestWorker = () => {
  const worker = new Worker(
    'request-queue',
    async (job) => {
      const { name } = job;
      
      switch (name) {
        case REQUEST_JOBS.BROADCAST_TO_RIDERS:
          return await broadcastToRiders(job);
        case REQUEST_JOBS.CHECK_RING_PROGRESS:
          return await checkRingProgress(job);
        case REQUEST_JOBS.SETTLE_REQUEST:
          return await settleRequest(job);
        case REQUEST_JOBS.REFUND_REQUEST:
          return await refundRequest(job);
        case REQUEST_JOBS.AUTO_CANCEL_UNMATCHED:
          return await autoCancelUnmatched(job);
        default:
          throw new Error(`Unknown job type: ${name}`);
      }
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );
  
  worker.on('completed', (job) => {
    logger.info('Request job completed', { id: job.id, name: job.name });
  });
  
  worker.on('failed', (job, err) => {
    logger.error('Request job failed', { id: job?.id, name: job?.name, error: err.message });
    // Forward to Sentry so failed background jobs aren't invisible to ops.
    // Includes the job name + id so we can group errors by handler and find
    // the corresponding BullMQ row when reproducing.
    const { captureError } = require('../../utils/sentry');
    captureError(err, {
      queue: 'request-queue',
      jobName: job?.name,
      jobId: job?.id,
      requestId: job?.data?.requestId,
    });
  });
  
  logger.info('Request worker started');
};

module.exports = {
  startRequestWorker,
  // Internal handlers exposed for unit tests of the auto-cancel + refund
  // contract. Not part of the public worker surface; do not import these
  // outside of tests.
  __test: { refundRequest, autoCancelUnmatched },
};
