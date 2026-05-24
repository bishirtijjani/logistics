/**
 * Notification queue worker — sends push notifications and SMS.
 */

const { Worker } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, NOTIFICATION_JOBS } = require('../jobs');
const { logger } = require('../../utils/logger');
const notificationService = require('../../services/notification.service');
const messagingService = require('../../services/messaging.service');

const startNotificationWorker = () => {
  const worker = new Worker(
    QUEUES.NOTIFICATION,
    async (job) => {
      switch (job.name) {
        case NOTIFICATION_JOBS.SEND_PUSH:
          return notificationService.sendToDevice(
            job.data.fcmToken,
            {
              title: job.data.title,
              body: job.data.body,
              data: job.data.data,
            }
          );

        case NOTIFICATION_JOBS.SEND_SMS:
          return messagingService.sendSms(job.data.phone, job.data.message);

        case NOTIFICATION_JOBS.SEND_OTP:
          return messagingService.sendOtp(job.data.phone, job.data.code);

        default:
          logger.warn(`Unknown notification job: ${job.name}`);
      }
    },
    {
      connection: redis,
      concurrency: 10,
    }
  );

  worker.on('failed', (job, error) => {
    logger.error(`Notification job failed: ${job.name}`, {
      jobId: job.id,
      error: error.message,
    });
    const { captureError } = require('../../utils/sentry');
    captureError(error, {
      queue: 'notification-queue',
      jobName: job?.name,
      jobId: job?.id,
    });
  });

  return worker;
};

module.exports = { startNotificationWorker };
