/**
 * Delivery queue worker — rider matching, settlement, auto-cancellation.
 */

const { Worker } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, DELIVERY_JOBS } = require('../jobs');
const { logger } = require('../../utils/logger');
const deliveryService = require('../../modules/delivery/delivery.service');

const startDeliveryWorker = () => {
  const worker = new Worker(
    QUEUES.DELIVERY,
    async (job) => {
      switch (job.name) {
        case DELIVERY_JOBS.BROADCAST_TO_RIDERS:
          return handleBroadcast(job.data);

        case DELIVERY_JOBS.SETTLE_DELIVERY:
          return deliveryService.settleDelivery(job.data.orderId);

        case DELIVERY_JOBS.AUTO_CANCEL_UNMATCHED:
          return handleAutoCancel(job.data);

        default:
          logger.warn(`Unknown delivery job: ${job.name}`);
      }
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, error) => {
    logger.error(`Delivery job failed: ${job.name}`, {
      jobId: job.id,
      error: error.message,
    });
  });

  return worker;
};

/**
 * Broadcast delivery to nearby available riders via Socket.io.
 */
const handleBroadcast = async ({ orderId, pickupLat, pickupLng, fare, distanceKm }) => {
  // TODO: Find nearby riders from Redis
  // TODO: Emit rider:job:new to available riders via Socket.io
  // TODO: Set timeout — if no rider accepts within 60s, re-broadcast or cancel
  logger.info('Broadcasting to riders', { orderId });
};

/**
 * Auto-cancel an unmatched order after timeout.
 */
const handleAutoCancel = async ({ orderId }) => {
  try {
    await deliveryService.updateStatus(orderId, 'CANCELLED', 'system', 'No rider available');
    logger.info('Order auto-cancelled', { orderId });
  } catch (error) {
    logger.error('Auto-cancel failed', { orderId, error: error.message });
  }
};

module.exports = { startDeliveryWorker };
