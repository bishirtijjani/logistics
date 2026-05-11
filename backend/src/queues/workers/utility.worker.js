/**
 * Utility queue worker — calls AlRahuz Data API for utility purchases.
 *
 * FLOW:
 * 1. Wallet already deducted by utility.service
 * 2. Check payment status for idempotency (skip if already settled)
 * 3. Call AlRahuz API
 * 4a. Definitive failure (AlRahuz returned failure status): mark FAILED + refund inline, do NOT throw
 * 4b. Network/transient error: let error propagate so BullMQ retries
 * 5. On success: mark COMPLETED
 *
 * This ensures AlRahuz is never called twice for the same settled payment,
 * and refunds happen immediately on definitive failures without exhausting retries.
 */

const { Worker } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, UTILITY_JOBS } = require('../jobs');
const { logger } = require('../../utils/logger');
const { prisma } = require('../../config/database');
const alrahuzService = require('../../services/alrahuz.service');

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
        case UTILITY_JOBS.REFUND_FAILED:       return processRefund(job.data);
        default: logger.warn(`Unknown utility job: ${job.name}`);
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
  });

  return worker;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getPayment = (paymentId) =>
  prisma.utilityPayment.findUnique({ where: { id: paymentId } });

const markPayment = (paymentId, reference, status, extra = {}) =>
  prisma.$transaction([
    prisma.utilityPayment.update({ where: { id: paymentId }, data: { status, ...extra } }),
    prisma.transaction.updateMany({ where: { reference }, data: { status } }),
  ]);

const refundPayment = async ({ paymentId, userId, amount, reference }) => {
  try {
    await prisma.$transaction(async (tx) => {
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
  } catch (err) {
    logger.error('Utility refund failed', { paymentId, error: err.message });
    // Don't throw — log and continue; a human should resolve manually
  }
};

const handleResult = async (result, { paymentId, userId, amount, reference }, extraOnSuccess = {}) => {
  const success = alrahuzService.isSuccess(result);

  if (success) {
    await markPayment(paymentId, reference, 'COMPLETED', {
      providerRef: String(result?.id || result?.ident || ''),
      ...(result?.token || result?.purchased_token
        ? { token: result.token || result.purchased_token }
        : {}),
      ...extraOnSuccess,
    });
    logger.info('Utility payment completed', { paymentId, reference });
  } else {
    // Definitive failure from AlRahuz — mark failed and refund immediately
    await markPayment(paymentId, reference, 'FAILED', {
      providerRef: String(result?.id || ''),
    });
    logger.warn('AlRahuz returned failure, refunding', { paymentId, result });
    await refundPayment({ paymentId, userId, amount, reference });
    // Do NOT throw — BullMQ should not retry a definitive failure
  }
};

// ─── Job processors ───────────────────────────────────────────────────────────

const processAirtime = async ({ paymentId, userId, reference, networkId, phone, amount }) => {
  const payment = await getPayment(paymentId);
  if (!payment || SETTLED_STATUSES.includes(payment.status)) return;

  const result = await alrahuzService.buyAirtime({ networkId, phone, amount });
  await handleResult(result, { paymentId, userId, amount, reference });
};

const processData = async ({ paymentId, userId, reference, networkId, providerPlanId, phone, amount }) => {
  const payment = await getPayment(paymentId);
  if (!payment || SETTLED_STATUSES.includes(payment.status)) return;

  const result = await alrahuzService.buyData({ networkId, phone, planId: providerPlanId });
  await handleResult(result, { paymentId, userId, amount, reference });
};

const processCable = async ({ paymentId, userId, reference, cableNameId, cablePlanId, smartCardNumber, amount }) => {
  const payment = await getPayment(paymentId);
  if (!payment || SETTLED_STATUSES.includes(payment.status)) return;

  const result = await alrahuzService.buyCable({ cableNameId, cablePlanId, smartCardNumber });
  await handleResult(result, { paymentId, userId, amount, reference });
};

const processElectricity = async ({ paymentId, userId, reference, discoId, meterNumber, meterType, amount }) => {
  const payment = await getPayment(paymentId);
  if (!payment || SETTLED_STATUSES.includes(payment.status)) return;

  const result = await alrahuzService.payElectricity({ discoId, meterNumber, meterType, amount });
  await handleResult(result, { paymentId, userId, amount, reference });
};

const processRefund = async (data) => refundPayment(data);

module.exports = { startUtilityWorker };
