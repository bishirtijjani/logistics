/**
 * Rider worker - periodic maintenance jobs for the rider domain.
 *
 * Phase 7:
 *   - CHECK_DOC_EXPIRY: scans Rider rows whose ID / driver-licence / vehicle
 *     reg / insurance documents fall within the 14-day expiring window or
 *     have already expired, and pushes a DOC_EXPIRING_SOON / DOC_EXPIRED
 *     notification. Throttled by `Rider.lastDocExpiryNoticeAt` so a rider
 *     isn't spammed every night once a doc enters the window.
 */

const { Worker } = require('bullmq');
const { redis } = require('../../config/redis');
const { prisma } = require('../../config/database');
const { logger } = require('../../utils/logger');
const { QUEUES, RIDER_JOBS, DEFAULT_JOB_OPTIONS } = require('../jobs');
const notifyService = require('../../services/notify.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRY_WARNING_DAYS = 14;
// Re-send the warning at most once per 7 days so the rider gets a fresh
// reminder if they ignored the first push.
const NOTICE_THROTTLE_DAYS = 7;

const DOC_FIELDS = [
  { key: 'ID_DOC',        column: 'idDocExpiresAt',         label: 'ID document' },
  { key: 'DRIVER_LICENCE',column: 'driverLicenceExpiresAt', label: 'Driver licence' },
  { key: 'VEHICLE_REG',   column: 'vehicleRegExpiresAt',    label: 'Vehicle registration' },
  { key: 'INSURANCE',     column: 'insuranceExpiresAt',     label: 'Insurance certificate' },
];

/**
 * Returns the earliest doc that's within the warning window or already
 * expired. Riders with no docs at all aren't reminded here - that path is
 * the onboarding flow's job.
 */
const classifyRiderDocs = (rider) => {
  const now = Date.now();
  const warnCutoff = now + EXPIRY_WARNING_DAYS * DAY_MS;
  let earliestWarn = null;
  let earliestExpired = null;
  for (const { column, label } of DOC_FIELDS) {
    const value = rider[column];
    if (!value) continue;
    const ts = new Date(value).getTime();
    if (Number.isNaN(ts)) continue;
    if (ts < now) {
      if (!earliestExpired || ts < earliestExpired.ts) {
        earliestExpired = { ts, label, column };
      }
    } else if (ts <= warnCutoff) {
      if (!earliestWarn || ts < earliestWarn.ts) {
        earliestWarn = { ts, label, column };
      }
    }
  }
  return { earliestWarn, earliestExpired };
};

const checkDocExpiry = async () => {
  const now = new Date();
  const warnCutoff = new Date(now.getTime() + EXPIRY_WARNING_DAYS * DAY_MS);
  const throttleCutoff = new Date(now.getTime() - NOTICE_THROTTLE_DAYS * DAY_MS);

  // Pull APPROVED, non-deleted riders with at least one tracked expiry that
  // falls below the warning cutoff (i.e. expired OR expiring within 14 days),
  // and weren't notified in the last NOTICE_THROTTLE_DAYS.
  const candidates = await prisma.rider.findMany({
    where: {
      status: 'APPROVED',
      deletedAt: null,
      OR: DOC_FIELDS.map((f) => ({ [f.column]: { lte: warnCutoff } })),
      AND: [
        {
          OR: [
            { lastDocExpiryNoticeAt: null },
            { lastDocExpiryNoticeAt: { lt: throttleCutoff } },
          ],
        },
      ],
    },
    select: {
      id: true,
      userId: true,
      lastDocExpiryNoticeAt: true,
      idDocExpiresAt: true,
      driverLicenceExpiresAt: true,
      vehicleRegExpiresAt: true,
      insuranceExpiresAt: true,
    },
    take: 500, // bounded scan per run
  });

  let warned = 0;
  let expired = 0;

  for (const rider of candidates) {
    const { earliestWarn, earliestExpired } = classifyRiderDocs(rider);
    if (!earliestWarn && !earliestExpired) continue;

    const target = earliestExpired || earliestWarn;
    const isExpired = !!earliestExpired;
    const daysOut = Math.max(
      0,
      Math.ceil((target.ts - now.getTime()) / DAY_MS),
    );

    try {
      await notifyService.pushAndSocket(rider.userId, {
        type: isExpired ? 'DOC_EXPIRED' : 'DOC_EXPIRING_SOON',
        title: isExpired ? `${target.label} expired` : `${target.label} expires soon`,
        body: isExpired
          ? `Re-upload your ${target.label.toLowerCase()} to keep working.`
          : `Your ${target.label.toLowerCase()} expires in ${daysOut} day${daysOut === 1 ? '' : 's'}. Re-upload to keep working.`,
        data: { route: '/kyc', kind: 'doc-expiry', column: target.column },
      });
      await prisma.rider.update({
        where: { id: rider.id },
        data: { lastDocExpiryNoticeAt: now },
      });
      if (isExpired) expired += 1; else warned += 1;
    } catch (err) {
      logger.warn('Failed to send doc-expiry notification', {
        riderId: rider.id, error: err.message,
      });
    }
  }

  logger.info('rider.docExpiry.checked', {
    scanned: candidates.length,
    warned,
    expired,
  });

  return { scanned: candidates.length, warned, expired };
};

const startRiderWorker = () => {
  const worker = new Worker(
    QUEUES.RIDER,
    async (job) => {
      switch (job.name) {
        case RIDER_JOBS.CHECK_DOC_EXPIRY:
          return checkDocExpiry();
        default:
          throw new Error(`Unknown rider job: ${job.name}`);
      }
    },
    {
      connection: redis,
      // Doc-expiry is a single big scan; we don't need concurrency here.
      concurrency: 1,
    },
  );

  worker.on('completed', (job, result) => {
    logger.info('Rider worker completed', { jobName: job.name, result });
  });
  worker.on('failed', (job, err) => {
    logger.error('Rider worker failed', { jobName: job?.name, error: err.message });
  });

  return worker;
};

module.exports = {
  startRiderWorker,
  // Exported for unit tests.
  __test: { checkDocExpiry, classifyRiderDocs },
};
