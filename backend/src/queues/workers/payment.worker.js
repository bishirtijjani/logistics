const { Worker } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, PAYMENT_JOBS } = require('../jobs');
const { logger } = require('../../utils/logger');
const { prisma } = require('../../config/database');
const walletService = require('../../modules/wallet/wallet.service');
const katpayService = require('../../services/katpay.service');

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
  });

  return worker;
};

/**
 * Credit wallet from a KatPay virtual account payment.
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
    });

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
 * Credit wallet from a KatPay transfer_payment.completed event.
 * Uses metadata.userId to find the right wallet.
 */
const handleKatpayTransferPayment = async ({ transactionRef, amount, ref, metadata, eventData }) => {
  const webhookEvent = await prisma.webhookEvent.findUnique({ where: { transactionRef } });
  if (!webhookEvent || webhookEvent.processed) {
    logger.info('Transfer payment webhook already processed or missing', { transactionRef });
    return;
  }

  try {
    // For transfer payments, find wallet by userId stored in metadata
    const userId = metadata?.userId;
    if (!userId) {
      logger.warn('Transfer payment webhook missing userId in metadata', { transactionRef });
      return;
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      logger.warn('Wallet not found for transfer payment', { userId, transactionRef });
      return;
    }

    await walletService.fundWallet({
      accountNumber: wallet.virtualAccountNumber,
      amount,
      reference: ref || transactionRef,
      metadata: { ...eventData, source: 'TRANSFER_PAYMENT' },
    });

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
 * Process withdrawal — call KatPay payout API.
 */
const handleWithdrawal = async ({ transactionId, bankCode, accountNumber, accountName, amount }) => {
  const transaction = await prisma.transaction.findUnique({ where: { reference: transactionId } });

  if (!transaction) {
    logger.warn('Withdrawal transaction not found', { transactionId });
    return;
  }

  if (transaction.status === 'COMPLETED') {
    logger.info('Withdrawal already completed', { transactionId });
    return;
  }

  try {
    const payout = await katpayService.initiatePayout({
      amount,
      bank_code: bankCode,
      account_number: accountNumber,
      account_name: accountName,
      reference: transactionId,
      description: 'Wallet withdrawal',
    });

    await prisma.transaction.update({
      where: { reference: transactionId },
      data: {
        status: 'COMPLETED',
        merchantRef: payout?.reference || payout?.id || transactionId,
      },
    });

    logger.info('Withdrawal payout completed', { transactionId, amount });
  } catch (error) {
    logger.error('Withdrawal payout failed', { transactionId, error: error.message });

    // Refund wallet on payout failure
    const wallet = await prisma.wallet.findUnique({ where: { id: transaction.debitWalletId } });
    if (wallet) {
      const currentBalance = Number(wallet.balance);
      await prisma.$transaction([
        prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } },
        }),
        prisma.transaction.create({
          data: {
            reference: `REF-${transactionId}`,
            type: 'REFUND',
            status: 'COMPLETED',
            amount,
            description: 'Withdrawal refund — payout failed',
            creditWalletId: wallet.id,
            merchant: 'KATPAY',
            balanceBefore: currentBalance,
            balanceAfter: currentBalance + amount,
          },
        }),
        prisma.transaction.update({
          where: { reference: transactionId },
          data: { status: 'FAILED' },
        }),
      ]);
    }

    throw error; // Re-throw so BullMQ retries
  }
};

/**
 * Legacy Monnify webhook handler (kept for in-flight events).
 */
const handleMonnifyWebhook = async ({ transactionRef, eventData }) => {
  const webhookEvent = await prisma.webhookEvent.findUnique({ where: { transactionRef } });
  if (!webhookEvent || webhookEvent.processed) return;

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
  } catch (error) {
    await prisma.webhookEvent.update({
      where: { transactionRef },
      data: { error: error.message },
    });
    throw error;
  }
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
