/**
 * BullMQ queue initialization.
 *
 * Creates all queues and starts all workers.
 * This file is called once at server startup.
 */

const { Queue } = require('bullmq');
const { redis } = require('../config/redis');
const { QUEUES, DEFAULT_JOB_OPTIONS, PAYMENT_JOBS } = require('./jobs');
const { logger } = require('../utils/logger');
const { startPaymentWorker } = require('./workers/payment.worker');
const { startNotificationWorker } = require('./workers/notification.worker');
const { startDeliveryWorker } = require('./workers/delivery.worker');
const { startUtilityWorker } = require('./workers/utility.worker');
const { startRequestWorker } = require('./workers/request.worker');  // NEW

// Queue instances — import these in services to add jobs
const paymentQueue = new Queue(QUEUES.PAYMENT, { connection: redis });
const notificationQueue = new Queue(QUEUES.NOTIFICATION, { connection: redis });
const deliveryQueue = new Queue(QUEUES.DELIVERY, { connection: redis });
const utilityQueue = new Queue(QUEUES.UTILITY, { connection: redis });
const requestQueue = new Queue(QUEUES.REQUEST, { connection: redis });  // NEW

/**
 * Initialize all queues and start workers.
 */
const initializeQueues = () => {
  startPaymentWorker();
  startNotificationWorker();
  startDeliveryWorker();
  startUtilityWorker();
  startRequestWorker();  // NEW

  scheduleRecurringJobs();

  logger.info('All queue workers started', {
    queues: Object.values(QUEUES),
  });
};

/**
 * Register cron-style recurring jobs. BullMQ deduplicates by `jobId`, so this
 * is safe to call on every server boot.
 */
const scheduleRecurringJobs = async () => {
  try {
    await paymentQueue.add(
      PAYMENT_JOBS.CLEANUP_EXPIRED_IDEMPOTENCY,
      {},
      {
        jobId: 'cron:cleanup-expired-idempotency',
        repeat: { pattern: '0 3 * * *' }, // 03:00 daily
        removeOnComplete: { count: 7 },
        removeOnFail: { count: 30 },
      },
    );
    logger.info('Recurring jobs scheduled');
  } catch (err) {
    logger.error('Failed to schedule recurring jobs', { error: err.message });
  }
};

const addUtilityJob = (jobName, data) => utilityQueue.add(jobName, data, DEFAULT_JOB_OPTIONS);

module.exports = {
  initializeQueues,
  paymentQueue,
  notificationQueue,
  deliveryQueue,
  utilityQueue,
  requestQueue,
  addUtilityJob,
};
