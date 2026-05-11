const crypto = require('crypto');
const { prisma } = require('../../config/database');
const { config } = require('../../config');
const { ApiResponse } = require('../../utils/api-response');
const { logger } = require('../../utils/logger');
const katpayService = require('../../services/katpay.service');
const { Queue } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, PAYMENT_JOBS, DEFAULT_JOB_OPTIONS } = require('../../queues/jobs');

const paymentQueue = new Queue(QUEUES.PAYMENT, { connection: redis });

/**
 * Handle KatPay webhook — wallet funding and payout confirmations.
 *
 * Security:
 * - HMAC-SHA256 signature verified against raw request body
 * - Timestamp freshness checked (5-minute window)
 * - Idempotency via X-KatPay-Delivery-Id
 */
const handleKatpay = async (req, res, next) => {
  try {
    const signature = req.headers['x-katpay-signature'];
    const timestamp = req.headers['x-katpay-timestamp'];
    const eventType = req.headers['x-katpay-event'];
    const deliveryId = req.headers['x-katpay-delivery-id'];

    // Raw body is available because this route uses express.raw()
    const rawBody = req.body.toString('utf8');

    // 1. Verify timestamp freshness
    if (!katpayService.isTimestampFresh(timestamp)) {
      logger.warn('KatPay webhook timestamp too old or missing', { timestamp, ip: req.ip });
      return res.status(401).json(ApiResponse.error('Stale webhook'));
    }

    // 2. Verify HMAC signature
    if (!katpayService.verifyWebhookSignature(timestamp, rawBody, signature)) {
      logger.warn('Invalid KatPay webhook signature', { ip: req.ip, deliveryId });
      return res.status(401).json(ApiResponse.error('Invalid signature'));
    }

    const payload = JSON.parse(rawBody);
    const transactionRef = deliveryId || payload?.uuid || payload?.merchant_reference || `katpay-${Date.now()}`;

    // 3. Idempotency check
    const existing = await prisma.webhookEvent.findUnique({
      where: { transactionRef },
    });

    if (existing) {
      logger.info('Duplicate KatPay webhook ignored', { transactionRef });
      return res.json(ApiResponse.success('Already processed'));
    }

    // 4. Log event
    await prisma.webhookEvent.create({
      data: {
        merchant: 'katpay',
        eventType: eventType || 'UNKNOWN',
        transactionRef,
        payload,
        processed: false,
      },
    });

    // 5. Respond immediately — KatPay retries on non-2xx
    res.json(ApiResponse.success('Webhook received'));

    // 6. Queue processing asynchronously after response is sent
    setImmediate(async () => {
      try {
        switch (eventType) {
          case 'virtual_account.payment_received':
          case 'transaction.completed': {
            const accountNumber = payload.virtual_account?.account_number || payload.accountNumber;
            const amount = Number(payload.amount_received ?? payload.amount ?? 0);
            const ref = payload.reference || transactionRef;
            await paymentQueue.add(
              PAYMENT_JOBS.PROCESS_KATPAY_WEBHOOK,
              { transactionRef, accountNumber, amount, ref, eventData: payload },
              DEFAULT_JOB_OPTIONS
            );
            break;
          }

          case 'transfer_payment.completed': {
            const amount = Number(payload.amount_received ?? payload.amount ?? 0);
            const metadata = payload.metadata || {};
            const ref = payload.merchant_reference || transactionRef;
            await paymentQueue.add(
              PAYMENT_JOBS.PROCESS_TRANSFER_PAYMENT_WEBHOOK,
              { transactionRef, amount, ref, metadata, eventData: payload },
              DEFAULT_JOB_OPTIONS
            );
            break;
          }

          case 'payout.processed': {
            const katpayRef = payload.reference;
            if (katpayRef) {
              await prisma.merchantWalletTransaction.updateMany({
                where: { katpayReference: katpayRef },
                data: { status: 'COMPLETED', processedAt: new Date() },
              });
              // Also release pending balance from merchant wallet
              const mwt = await prisma.merchantWalletTransaction.findFirst({
                where: { katpayReference: katpayRef },
              });
              if (mwt) {
                await prisma.merchantWallet.update({
                  where: { id: mwt.merchantWalletId },
                  data: { pendingBalance: { decrement: mwt.amount } },
                });
              }
            }
            await prisma.webhookEvent.update({
              where: { transactionRef },
              data: { processed: true, processedAt: new Date() },
            });
            break;
          }

          default:
            logger.info('KatPay webhook event type not handled', { eventType, transactionRef });
            await prisma.webhookEvent.update({
              where: { transactionRef },
              data: { processed: true, processedAt: new Date() },
            });
        }
      } catch (err) {
        logger.error('KatPay webhook async processing failed', { transactionRef, error: err.message });
        await prisma.webhookEvent.update({
          where: { transactionRef },
          data: { error: err.message },
        }).catch(() => {});
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleKatpay,
};
