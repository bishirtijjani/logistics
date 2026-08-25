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
const { REDIS_KEYS } = require('../../utils/constants');
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

/**
 * Reconcile the dispatch geo index with rider heartbeats.
 *
 * Rider INTENT (`Rider.availability`) is authoritative and is NEVER modified
 * here. A rider is only ever taken offline by their own explicit go-offline,
 * or by an admin kill-switch. Backgrounding the app, losing the network, or
 * the OS suspending the process must never flip the rider offline - otherwise
 * they silently drop out and have to re-tap "Go online" (the recurring rider
 * complaint this worker used to cause).
 *
 * The heartbeat remains the source of truth for REACHABILITY - "can we offer
 * this rider a job RIGHT NOW?". The matcher only offers jobs to riders present
 * in `riders:geo`, whose membership is paired with a short-lived heartbeat
 * (refreshed on every GPS ping / on going ONLINE). This sweep's only job is to
 * prune geo members whose heartbeat has lapsed (backgrounded / killed /
 * offline device), so a dead phone is never offered a job that then times out.
 *
 * Because the DB flag is left intact, the rider is re-seeded into the pool
 * automatically the moment their app reconnects (the tracking handler seeds
 * the geo index straight from `Rider.availability` on socket connect) - no
 * re-tapping "Go online", ever.
 */
const reconcileAvailability = async () => {
  let prunedGeo = 0;

  let members = [];
  try {
    members = await redis.zrange(REDIS_KEYS.RIDER_GEO_INDEX, 0, -1);
  } catch (err) {
    logger.warn('reconcileAvailability: geo read failed', { error: err.message });
  }
  for (const userId of members) {
    try {
      const live = await redis.exists(`${REDIS_KEYS.RIDER_HEARTBEAT}${userId}`);
      if (!live) {
        await redis.zrem(REDIS_KEYS.RIDER_GEO_INDEX, userId);
        prunedGeo += 1;
      }
    } catch (err) {
      logger.warn('reconcileAvailability: geo prune failed', { userId, error: err.message });
    }
  }

  logger.info('rider.availability.reconciled', {
    geoMembers: members.length,
    prunedGeo,
    intentUntouched: true,
  });

  return { prunedGeo, flippedOffline: 0 };
};

const startRiderWorker = () => {
  const worker = new Worker(
    QUEUES.RIDER,
    async (job) => {
      switch (job.name) {
        case RIDER_JOBS.CHECK_DOC_EXPIRY:
          return checkDocExpiry();
        case RIDER_JOBS.RECONCILE_AVAILABILITY:
          return reconcileAvailability();
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
  __test: { checkDocExpiry, classifyRiderDocs, reconcileAvailability },
};
