/**
 * Utility queue worker — processes VTPass API calls for airtime, data, electricity.
 *
 * FLOW:
 * 1. Wallet is already deducted (by utility.service)
 * 2. This worker calls VTPass API
 * 3. On success: mark payment COMPLETED
 * 4. On failure: mark payment FAILED, queue refund
 */

const { Worker } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, UTILITY_JOBS } = require('../jobs');
const { logger } = require('../../utils/logger');
const { prisma } = require('../../config/database');
const vtpassService = require('../../services/vtpass.service');

const startUtilityWorker = () => {
  const worker = new Worker(
    QUEUES.UTILITY,
    async (job) => {
      switch (job.name) {
        case UTILITY_JOBS.PROCESS_AIRTIME:
          return processAirtime(job.data);

        case UTILITY_JOBS.PROCESS_DATA:
          return processData(job.data);

        case UTILITY_JOBS.PROCESS_ELECTRICITY:
          return processElectricity(job.data);

        case UTILITY_JOBS.REFUND_FAILED:
          return processRefund(job.data);

        default:
          logger.warn(`Unknown utility job: ${job.name}`);
      }
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, error) => {
    logger.error(`Utility job failed: ${job.name}`, {
      jobId: job.id,
      error: error.message,
      attemptsMade: job.attemptsMade,
    });

    // If all retries exhausted, queue a refund
    if (job.attemptsMade >= job.opts.attempts) {
      // TODO: Add refund job to queue
      logger.info('All retries exhausted, refund needed', { paymentId: job.data.paymentId });
    }
  });

  return worker;
};

const processAirtime = async ({ paymentId, requestId, phone, amount, serviceID }) => {
  try {
    const result = await vtpassService.buyAirtime({ requestId, phone, amount, serviceID });

    await prisma.utilityPayment.update({
      where: { id: paymentId },
      data: {
        status: result.status === 'delivered' ? 'COMPLETED' : 'FAILED',
        vtpassRef: result.transactionId,
      },
    });

    // Update the wallet transaction status too
    await prisma.transaction.updateMany({
      where: { reference: requestId },
      data: { status: result.status === 'delivered' ? 'COMPLETED' : 'FAILED' },
    });
  } catch (error) {
    logger.error('Airtime processing failed', { paymentId, error: error.message });
    throw error; // Re-throw for retry
  }
};

const processData = async ({ paymentId, requestId, phone, serviceID, variationCode, amount }) => {
  try {
    const result = await vtpassService.buyData({
      requestId, phone, serviceID, variationCode, amount,
    });

    await prisma.utilityPayment.update({
      where: { id: paymentId },
      data: {
        status: result.status === 'delivered' ? 'COMPLETED' : 'FAILED',
        vtpassRef: result.transactionId,
      },
    });

    await prisma.transaction.updateMany({
      where: { reference: requestId },
      data: { status: result.status === 'delivered' ? 'COMPLETED' : 'FAILED' },
    });
  } catch (error) {
    logger.error('Data processing failed', { paymentId, error: error.message });
    throw error;
  }
};

const processElectricity = async ({ paymentId, requestId, serviceID, meterNumber, meterType, amount, phone }) => {
  try {
    const result = await vtpassService.payElectricity({
      requestId, serviceID, meterNumber, meterType, amount, phone,
    });

    await prisma.utilityPayment.update({
      where: { id: paymentId },
      data: {
        status: result.status === 'delivered' ? 'COMPLETED' : 'FAILED',
        vtpassRef: result.transactionId,
        token: result.token,
      },
    });

    await prisma.transaction.updateMany({
      where: { reference: requestId },
      data: { status: result.status === 'delivered' ? 'COMPLETED' : 'FAILED' },
    });
  } catch (error) {
    logger.error('Electricity processing failed', { paymentId, error: error.message });
    throw error;
  }
};

const processRefund = async ({ paymentId, userId, amount, reference }) => {
  try {
    await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      const balance = Number(wallet.balance);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      });

      await tx.transaction.create({
        data: {
          reference: `REFUND-${reference}`,
          type: 'REFUND',
          status: 'COMPLETED',
          amount,
          description: `Refund for failed payment ${reference}`,
          creditWalletId: wallet.id,
          balanceBefore: balance,
          balanceAfter: balance + amount,
        },
      });

      await tx.utilityPayment.update({
        where: { id: paymentId },
        data: { status: 'REFUNDED' },
      });
    });

    logger.info('Refund processed', { paymentId, userId, amount });
  } catch (error) {
    logger.error('Refund failed', { paymentId, error: error.message });
    throw error;
  }
};

module.exports = { startUtilityWorker };
