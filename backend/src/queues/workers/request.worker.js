/**
 * Request worker — handles unified request queue jobs
 * 
 * Jobs:
 * - BROADCAST_TO_RIDERS: Broadcast new request to nearby riders
 * - SETTLE_REQUEST: Process financial settlement after delivery
 * - REFUND_REQUEST: Refund customer for cancelled request
 * - AUTO_CANCEL_UNMATCHED: Auto-cancel requests without rider after timeout
 */

const { Worker } = require('bullmq');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../../config/database');
const { redis } = require('../../config/redis');
const { logger } = require('../../utils/logger');
const { getIO } = require('../../sockets');
const { REQUEST, getRequestRoom, getRiderPoolRoom } = require('../../sockets/events');
const { emitCompleted } = require('../../sockets/handlers/request.handler');
const { REQUEST_JOBS } = require('../jobs');

// ============================================================
// Broadcast to Riders
// ============================================================

const broadcastToRiders = async (job) => {
  const { requestId, pickupLat, pickupLng, fare, distanceKm } = job.data;
  
  logger.info('Broadcasting request to riders', { requestId });
  
  const io = getIO();
  
  // Broadcast to all online riders
  io.to(getRiderPoolRoom()).emit(REQUEST.CREATED, {
    requestId,
    pickupLat,
    pickupLng,
    fare,
    distanceKm,
  });
  
  logger.info('Request broadcasted to riders', { requestId });
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
        provider: { include: { wallet: true } },
        rider: { include: { user: { include: { wallet: true } } } },
      },
    });
    
    if (!request) throw new Error('Request not found');
    if (request.status !== 'DELIVERED') throw new Error('Request not in DELIVERED state');
    
    const providerEarning = Number(request.providerEarning);
    const riderEarning = Number(request.riderEarning);
    const platformEarning = Number(request.platformEarning);
    
    const reference = `SETTLE-${requestId}-${Date.now()}`;
    
    // Credit provider wallet (if applicable)
    if (request.provider && providerEarning > 0) {
      await tx.providerWallet.update({
        where: { providerId: request.providerId },
        data: {
          pendingBalance: { increment: providerEarning },
          totalEarnings: { increment: providerEarning },
        },
      });
      
      // Create provider earning transaction
      await tx.transaction.create({
        data: {
          reference: `${reference}-PROVIDER`,
          type: 'PROVIDER_EARNING',
          status: 'COMPLETED',
          amount: providerEarning,
          fee: 0,
          description: `Earning for request ${requestId}`,
          providerId: request.providerId,
          requestId: request.id,
        },
      });
    }
    
    // Credit rider wallet (if applicable)
    if (request.rider && riderEarning > 0) {
      await tx.wallet.update({
        where: { id: request.rider.user.wallet.id },
        data: {
          balance: { increment: riderEarning },
        },
      });
      
      // Create rider earning transaction
      await tx.transaction.create({
        data: {
          reference: `${reference}-RIDER`,
          type: 'RIDER_EARNING',
          status: 'COMPLETED',
          amount: riderEarning,
          fee: 0,
          description: `Earning for request ${requestId}`,
          creditWalletId: request.rider.user.wallet.id,
          balanceBefore: Number(request.rider.user.wallet.balance),
          balanceAfter: Number(request.rider.user.wallet.balance) + riderEarning,
          requestId: request.id,
        },
      });
      
      // Update rider stats
      await tx.rider.update({
        where: { id: request.riderId },
        data: {
          totalDeliveries: { increment: 1 },
          totalEarnings: { increment: riderEarning },
        },
      });
    }
    
    // Update request to SETTLED
    await tx.request.update({
      where: { id: requestId },
      data: { status: 'SETTLED', settledAt: new Date() },
    });
    
    // Update provider stats (if applicable)
    if (request.provider) {
      await tx.provider.update({
        where: { id: request.providerId },
        data: { totalOrders: { increment: 1 } },
      });
    }
    
    return { providerEarning, riderEarning, platformEarning };
  });
  
  logger.info('Request settled', { requestId, ...result });

  // Emit completion event
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
      },
    });
    
    if (!request) throw new Error('Request not found');
    if (request.status !== 'CANCELLED') throw new Error('Request not in CANCELLED state');
    
    const refundAmount = Number(request.customerPaid);
    
    // Credit customer wallet
    await tx.wallet.update({
      where: { id: request.customer.wallet.id },
      data: { balance: { increment: refundAmount } },
    });
    
    // Create refund transaction
    const reference = `REFUND-${requestId}-${Date.now()}`;
    await tx.transaction.create({
      data: {
        reference,
        type: 'REQUEST_REFUND',
        status: 'COMPLETED',
        amount: refundAmount,
        fee: 0,
        description: `Refund for cancelled request ${requestId}`,
        creditWalletId: request.customer.wallet.id,
        balanceBefore: Number(request.customer.wallet.balance),
        balanceAfter: Number(request.customer.wallet.balance) + refundAmount,
        metadata: { requestId: request.id },
      },
    });
    
    return { refundAmount };
  });
  
  logger.info('Request refunded', { requestId, ...result });
  
  return result;
};

// ============================================================
// Auto Cancel Unmatched
// ============================================================

const autoCancelUnmatched = async (job) => {
  const { requestId } = job.data;
  
  logger.info('Auto-cancelling unmatched request', { requestId });
  
  const request = await prisma.request.findUnique({
    where: { id: requestId },
  });
  
  if (!request) {
    logger.warn('Request not found for auto-cancel', { requestId });
    return;
  }
  
  // Only cancel if still in REQUESTED or READY_FOR_PICKUP (no rider assigned)
  if (!['REQUESTED', 'READY_FOR_PICKUP'].includes(request.status)) {
    logger.info('Request already progressed, skipping auto-cancel', { requestId, status: request.status });
    return;
  }
  
  if (request.riderId) {
    logger.info('Rider already assigned, skipping auto-cancel', { requestId });
    return;
  }
  
  // Cancel the request
  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: 'system',
      cancellationReason: 'No rider available within timeout',
    },
  });
  
  // Trigger refund
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
  });
  
  logger.info('Request worker started');
};

module.exports = { startRequestWorker };
