/**
 * Webhook controller — processes external provider callbacks.
 *
 * SECURITY:
 * - Monnify webhooks are verified via hash signature
 * - All webhook events are logged to WebhookEvent table for audit
 * - Idempotent: duplicate events are safely ignored
 */

const crypto = require('crypto');
const { prisma } = require('../../config/database');
const { config } = require('../../config');
const { ApiResponse } = require('../../utils/api-response');
const { logger } = require('../../utils/logger');

/**
 * Handle Monnify webhook — wallet funding confirmation.
 */
const handleMonnify = async (req, res, next) => {
  try {
    // 1. Verify webhook signature
    const signature = req.headers['monnify-signature'];
    const computedHash = crypto
      .createHmac('sha512', config.MONNIFY_WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== computedHash) {
      logger.warn('Invalid Monnify webhook signature', { ip: req.ip });
      return res.status(401).json(ApiResponse.error('Invalid signature'));
    }

    const { eventType, eventData } = req.body;
    const transactionRef = eventData?.transactionReference || eventData?.paymentReference;

    // 2. Idempotency — check if already processed
    const existing = await prisma.webhookEvent.findUnique({
      where: { transactionRef: transactionRef || `unknown-${Date.now()}` },
    });

    if (existing) {
      logger.info('Duplicate webhook ignored', { transactionRef });
      return res.json(ApiResponse.success('Already processed'));
    }

    // 3. Log the event
    await prisma.webhookEvent.create({
      data: {
        provider: 'monnify',
        eventType: eventType || 'UNKNOWN',
        transactionRef: transactionRef || `unknown-${Date.now()}`,
        payload: req.body,
        processed: false,
      },
    });

    // 4. Queue processing (don't block the webhook response)
    // TODO: Add to payment processing queue
    // paymentQueue.add('process-monnify-webhook', { transactionRef, eventData });

    logger.info('Monnify webhook received', { eventType, transactionRef });

    // 5. Respond immediately (Monnify expects 200)
    res.json(ApiResponse.success('Webhook received'));
  } catch (error) {
    next(error);
  }
};

/**
 * Handle VTPass webhook — utility payment status updates.
 */
const handleVtpass = async (req, res, next) => {
  try {
    const transactionRef = req.body?.requestId || `vtpass-${Date.now()}`;

    await prisma.webhookEvent.create({
      data: {
        provider: 'vtpass',
        eventType: 'STATUS_UPDATE',
        transactionRef,
        payload: req.body,
        processed: false,
      },
    });

    // TODO: Queue processing

    logger.info('VTPass webhook received', { transactionRef });

    res.json(ApiResponse.success('Webhook received'));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  handleMonnify,
  handleVtpass,
};
