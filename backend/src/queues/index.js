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
const { startUtilityWorker } = require('./workers/utility.worker');
const { startRequestWorker } = require('./workers/request.worker');

// Queue instances — import these in services to add jobs
const paymentQueue = new Queue(QUEUES.PAYMENT, { connection: redis });
const notificationQueue = new Queue(QUEUES.NOTIFICATION, { connection: redis });
const utilityQueue = new Queue(QUEUES.UTILITY, { connection: redis });
const requestQueue = new Queue(QUEUES.REQUEST, { connection: redis });

/**
 * Initialize all queues and start workers.
 */
const initializeQueues = () => {
  startPaymentWorker();
  startNotificationWorker();
  startUtilityWorker();
  startRequestWorker();

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
    // Reconciliation runs after the idempotency cleanup so the audit log
    // tail isn't interleaved with deletes that briefly hold row locks.
    await paymentQueue.add(
      PAYMENT_JOBS.RUN_RECONCILIATION,
      {},
      {
        jobId: 'cron:run-reconciliation',
        repeat: { pattern: '15 3 * * *' }, // 03:15 daily
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 90 },
      },
    );
    logger.info('Recurring jobs scheduled');
  } catch (err) {
    logger.error('Failed to schedule recurring jobs', { error: err.message });
  }
};

const addUtilityJob = (jobName, data) => utilityQueue.add(jobName, data, DEFAULT_JOB_OPTIONS);

/**
 * Schedule a delayed POLL_PENDING job. Used by the utility worker when AlRahuz
 * returns `pending` — we re-query the same providerRef after `delayMs`.
 * Single-attempt: if the poll itself fails infra-wise, the *next* scheduled
 * poll will catch the eventual state. We don't compound retries onto delays.
 */
const schedulePollPending = (data, delayMs) =>
  utilityQueue.add('poll-pending', data, {
    delay: delayMs,
    attempts: 1,
    removeOnComplete: { age: 3600, count: 500 },
    removeOnFail: { age: 86400 },
  });

module.exports = {
  initializeQueues,
  paymentQueue,
  notificationQueue,
  utilityQueue,
  requestQueue,
  addUtilityJob,
  schedulePollPending,
};
