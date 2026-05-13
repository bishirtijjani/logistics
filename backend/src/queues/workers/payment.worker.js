const { Worker } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, PAYMENT_JOBS } = require('../jobs');
const { logger } = require('../../utils/logger');
const { prisma } = require('../../config/database');
const walletService = require('../../modules/wallet/wallet.service');
const katpayService = require('../../services/katpay.service');
const notifyService = require('../../services/notify.service');
const reconciliationService = require('../../services/reconciliation.service');

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
 * Uses metauserId to find the right wallet.
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
const handleWithdrawal = async ({ transactionId, bankCode, accountNumber, accountName, amount, userId }) => {
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
        providerRef: payout?.reference || payout?.id || transactionId,
      },
    });

    logger.info('Withdrawal payout completed', { transactionId, amount });

    // Notify user their withdrawal completed — live balance + Notification Center row + push.
    if (userId) {
      const freshWallet = await prisma.wallet.findUnique({ where: { userId: userId }, select: { balance: true } });
      if (freshWallet) notifyService.balanceUpdated(userId, { balance: Number(freshWallet.balance) });
      notifyService.onWalletEvent(userId, {
        kind: 'WITHDRAWAL',
        amount,
        transactionId,
        route: '/wallet',
      }).catch((err) => logger.warn('WITHDRAWAL notification failed', { error: err.message }));
    }
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
            provider: 'KATPAY',
            balanceBefore: currentBalance,
            balanceAfter: currentBalance + amount,
          },
        }),
        prisma.transaction.update({
          where: { reference: transactionId },
          data: { status: 'FAILED' },
        }),
      ]);

      // Notify user their money was refunded — live nudge + persisted row + push.
      if (userId) {
        const refundedWallet = await prisma.wallet.findUnique({ where: { userId: userId }, select: { balance: true } });
        if (refundedWallet) notifyService.balanceUpdated(userId, { balance: Number(refundedWallet.balance) });
        notifyService.onWalletEvent(userId, {
          kind: 'REFUND',
          amount,
          transactionId: `REF-${transactionId}`,
          route: '/wallet',
          description: 'Your withdrawal failed — funds returned to your wallet.',
        }).catch((err) => logger.warn('Withdrawal-refund notification failed', { error: err.message }));
      }
    }

    throw error; // Re-throw so BullMQ retries
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
