/**
 * BullMQ queue initialization.
 *
 * Creates all queues and starts all workers.
 * This file is called once at server startup.
 */

const { Queue } = require('bullmq');
const { redis } = require('../config/redis');
const { QUEUES } = require('./jobs');
const { logger } = require('../utils/logger');
const { startPaymentWorker } = require('./workers/payment.worker');
const { startNotificationWorker } = require('./workers/notification.worker');
const { startDeliveryWorker } = require('./workers/delivery.worker');
const { startUtilityWorker } = require('./workers/utility.worker');

// Queue instances — import these in services to add jobs
const paymentQueue = new Queue(QUEUES.PAYMENT, { connection: redis });
const notificationQueue = new Queue(QUEUES.NOTIFICATION, { connection: redis });
const deliveryQueue = new Queue(QUEUES.DELIVERY, { connection: redis });
const utilityQueue = new Queue(QUEUES.UTILITY, { connection: redis });

/**
 * Initialize all queues and start workers.
 */
const initializeQueues = () => {
  startPaymentWorker();
  startNotificationWorker();
  startDeliveryWorker();
  startUtilityWorker();

  logger.info('All queue workers started', {
    queues: Object.values(QUEUES),
  });
};

module.exports = {
  initializeQueues,
  paymentQueue,
  notificationQueue,
  deliveryQueue,
  utilityQueue,
};
