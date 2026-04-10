/**
 * Payment queue worker — processes Monnify webhooks and withdrawals.
 *
 * CRITICAL: This worker handles real money. Every job must be:
 * - Idempotent (safe to retry)
 * - Atomic (uses Prisma transactions)
 * - Logged (for audit trail)
 */

const { Worker } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, PAYMENT_JOBS } = require('../jobs');
const { logger } = require('../../utils/logger');
const { prisma } = require('../../config/database');
const walletService = require('../../modules/wallet/wallet.service');

const startPaymentWorker = () => {
  const worker = new Worker(
    QUEUES.PAYMENT,
    async (job) => {
      logger.info(`Processing payment job: ${job.name}`, { jobId: job.id });

      switch (job.name) {
        case PAYMENT_JOBS.PROCESS_MONNIFY_WEBHOOK:
          return handleMonnifyWebhook(job.data);

        case PAYMENT_JOBS.PROCESS_WITHDRAWAL:
          return handleWithdrawal(job.data);

        case PAYMENT_JOBS.RETRY_FAILED_TRANSACTION:
          return handleRetry(job.data);

        default:
          logger.warn(`Unknown payment job type: ${job.name}`);
      }
    },
    {
      connection: redis,
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1000, // Max 10 jobs per second
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
  });

  return worker;
};

/**
 * Process Monnify webhook — credit user wallet.
 */
const handleMonnifyWebhook = async ({ transactionRef, eventData }) => {
  // Mark webhook event as processed
  const webhookEvent = await prisma.webhookEvent.findUnique({
    where: { transactionRef },
  });

  if (!webhookEvent) {
    logger.warn('Webhook event not found', { transactionRef });
    return;
  }

  if (webhookEvent.processed) {
    logger.info('Webhook already processed', { transactionRef });
    return;
  }

  try {
    await walletService.fundWallet({
      accountNumber: eventData.accountNumber,
      amount: eventData.amountPaid || eventData.amount,
      reference: transactionRef,
      metadata: eventData,
    });

    await prisma.webhookEvent.update({
      where: { transactionRef },
      data: { processed: true, processedAt: new Date() },
    });

    // TODO: Send push notification to user
    // TODO: Emit socket wallet:balance:updated
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { transactionRef },
      data: { error: error.message },
    });
    throw error; // Re-throw for BullMQ retry
  }
};

/**
 * Process withdrawal — call Monnify disbursement.
 */
const handleWithdrawal = async ({ transactionId, bankCode, accountNumber, accountName, amount }) => {
  // TODO: Call monnify.service.initiateDisbursement
  // TODO: Update transaction status based on result
  logger.info('Processing withdrawal', { transactionId, amount });
};

/**
 * Retry a failed transaction.
 */
const handleRetry = async ({ transactionId }) => {
  // TODO: Re-attempt the original operation based on transaction type
  logger.info('Retrying transaction', { transactionId });
};

module.exports = { startPaymentWorker };
