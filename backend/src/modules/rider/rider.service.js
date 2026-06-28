/**
 * Rider service - rider profile, availability, and job management.
 */

const { prisma } = require('../../config/database');
const { redis } = require('../../config/redis');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const { REDIS_KEYS, REDIS_TTL } = require('../../utils/constants');
const { getIO } = require('../../sockets');
const { emitRiderAssigned, emitStatusChanged } = require('../../sockets/handlers/request.handler');

/**
 * Register as a rider - creates Rider profile linked to existing User.
 */
const registerRider = async (userId, riderData) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User not found');

  const existingRider = await prisma.rider.findUnique({ where: { userId } });
  if (existingRider) throw AppError.conflict('Already registered as a rider');

  // The mobile app sends documents with American-spelled keys; the Rider
  // columns use British spelling. Map them here. Expiry/DOB already arrive as
  // Date objects (coerced by the validator). vehicleDocExpiresAt is the earliest
  // of the vehicle-registration / insurance expiries - the sort key the
  // DOC_EXPIRING_SOON cron uses, so we derive it rather than ask for it.
  const vehicleExpiries = [
    riderData.vehicleRegistrationExpiresAt,
    riderData.insuranceExpiresAt,
  ].filter(Boolean);
  const vehicleDocExpiresAt = vehicleExpiries.length
    ? new Date(Math.min(...vehicleExpiries.map((d) => new Date(d).getTime())))
    : undefined;

  const rider = await prisma.$transaction(async (tx) => {
    // Update user role to RIDER, plus the personal details collected during
    // onboarding (these live on User, not Rider).
    await tx.user.update({
      where: { id: userId },
      data: {
        role: 'RIDER',
        ...(riderData.dateOfBirth && { dateOfBirth: riderData.dateOfBirth }),
        ...(riderData.address && { address: riderData.address }),
      },
    });

    const newRider = await tx.rider.create({
      data: {
        userId,
        vehicleType: riderData.vehicleType,
        plateNumber: riderData.plateNumber,
        vehicleColor: riderData.vehicleColor,

        // Identity
        ninNumber: riderData.ninNumber,
        idDocumentUrl: riderData.idDocumentUrl,
        vehiclePhotoUrl: riderData.vehiclePhotoUrl,

        // Driver's licence (American key -> British column)
        driverLicenceNumber: riderData.driverLicenseNumber,
        driverLicenceUrl: riderData.driverLicenseUrl,
        driverLicenceExpiresAt: riderData.driverLicenseExpiresAt,

        // Vehicle registration
        vehicleRegUrl: riderData.vehicleRegistrationUrl,
        vehicleRegExpiresAt: riderData.vehicleRegistrationExpiresAt,

        // Insurance
        insuranceDocUrl: riderData.insuranceCertificateUrl,
        insuranceExpiresAt: riderData.insuranceExpiresAt,

        // Derived sort key for the expiry-reminder cron
        vehicleDocExpiresAt,

        status: 'PENDING_APPROVAL',
      },
    });

    return newRider;
  });

  logger.info('Rider registered', { userId, riderId: rider.id });

  return rider;
};

/**
 * Get rider profile with earnings. The optional `activeRequest` field carries
 * the rider's currently-active delivery (status in the active set) - the
 * mobile app reads this on boot to re-hydrate the trip cockpit after a
 * force-close, so the rider never loses their place in the FSM.
 */
const RIDER_ACTIVE_TRIP_STATUSES = [
  'RIDER_ASSIGNED',
  'RIDER_EN_ROUTE',
  'PICKED_UP',
  'IN_TRANSIT',
];

const getProfile = async (userId) => {
  const rider = await prisma.rider.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          phone: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  if (!rider) throw AppError.notFound('Rider profile not found');

  // Find an active trip - at most one per rider thanks to the FSM.
  const activeRequest = await prisma.request.findFirst({
    where: {
      riderId: rider.id,
      status: { in: RIDER_ACTIVE_TRIP_STATUSES },
    },
    orderBy: { riderAssignedAt: 'desc' },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      merchant: { select: { id: true, name: true, phone: true, userId: true } },
      items: true,
      packageDetails: true,
    },
  });

  return { ...rider, activeRequest: activeRequest || null };
};

/**
 * Toggle rider availability (ONLINE / OFFLINE).
 * Updates both database and Redis cache.
 */
const updateAvailability = async (userId, availability) => {
  const rider = await prisma.rider.findUnique({ where: { userId } });
  if (!rider) throw AppError.notFound('Rider not found');
  if (rider.status !== 'APPROVED') throw AppError.forbidden('Rider not approved');

  if (rider.availability === 'ON_DELIVERY') {
    throw AppError.badRequest('Cannot change availability during active delivery');
  }

  await prisma.rider.update({
    where: { id: rider.id },
    data: { availability },
  });

  // Update Redis cache
  const redisKey = `${REDIS_KEYS.RIDER_AVAILABILITY}${rider.id}`;
  if (availability === 'ONLINE') {
    await redis.set(redisKey, 'ONLINE', 'EX', REDIS_TTL.RIDER_AVAILABILITY);
  } else {
    await redis.del(redisKey);
  }

  logger.info('Rider availability updated', { riderId: rider.id, availability });

  return { availability };
};

/**
 * Update rider GPS location - called frequently (~every 3s during delivery).
 * Writes to Redis for real-time access, DB for persistence.
 */
const updateLocation = async (userId, { lat, lng }) => {
  const rider = await prisma.rider.findUnique({ where: { userId } });
  if (!rider) throw AppError.notFound('Rider not found');

  // Write to Redis (fast, for real-time tracking)
  const redisKey = `${REDIS_KEYS.RIDER_LOCATION}${rider.id}`;
  await redis.set(
    redisKey,
    JSON.stringify({ lat, lng, updatedAt: Date.now() }),
    'EX',
    REDIS_TTL.RIDER_LOCATION
  );

  // Write to DB (less frequent, for persistence)
  await prisma.rider.update({
    where: { id: rider.id },
    data: { lastLat: lat, lastLng: lng, lastLocationAt: new Date() },
  });

  return { lat, lng };
};

/**
 * Accept a request job - rider claims a request that's READY_FOR_PICKUP (or REQUESTED for PACKAGE).
 */
const acceptJob = async (userId, requestId) => {
  const rider = await prisma.rider.findUnique({ where: { userId } });
  if (!rider) throw AppError.notFound('Rider not found');
  if (rider.status !== 'APPROVED') throw AppError.forbidden('Rider not approved');
  if (rider.availability !== 'ONLINE') throw AppError.badRequest('Rider is not online');

  // Cash-on-delivery debt gate. When a rider completes a cash delivery the
  // platform's commission is debited from their wallet, which can push the
  // balance negative (they collected the customer's cash and now owe us our
  // cut). Block new jobs until they clear the debt by topping up - otherwise a
  // rider could run an unbounded cash tab.
  const riderWallet = await prisma.wallet.findUnique({ where: { userId } });
  if (riderWallet && Number(riderWallet.balance) < 0) {
    throw AppError.forbidden(
      `You owe ₦${Math.abs(Number(riderWallet.balance)).toLocaleString('en-NG')} in platform fees from cash deliveries. Top up your wallet to a non-negative balance to accept new jobs.`,
      { code: 'RIDER_OUTSTANDING_FEES' },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.request.findUnique({ where: { id: requestId } });

    if (!request) throw AppError.notFound('Request not found');

    // A request is claimable when no rider is yet assigned and it's in a matchable state.
    const claimable = !request.riderId && ['REQUESTED', 'READY_FOR_PICKUP'].includes(request.status);
    if (!claimable) throw AppError.conflict('Request already taken or not yet ready for pickup');

    const updated = await tx.request.update({
      where: { id: requestId },
      data: {
        riderId: rider.id,
        status: 'RIDER_ASSIGNED',
        riderAssignedAt: new Date(),
      },
      include: {
        rider: {
          select: {
            id: true,
            vehicleType: true,
            plateNumber: true,
            user: { select: { firstName: true, lastName: true, phone: true } },
          },
        },
      },
    });

    // Set rider to ON_DELIVERY (enum kept for backwards compatibility - covers any active request)
    await tx.rider.update({
      where: { id: rider.id },
      data: { availability: 'ON_DELIVERY' },
    });

    // Phase 7 - flip this rider's offer log row to ACCEPTED, and any other
    // riders who were offered to TAKEN, so performance metrics can compute
    // acceptance rate correctly. Upsert handles the rare path where a rider
    // accepts via deep-link without ever having received an OFFERED row
    // (e.g. admin reassignment, or pre-offer accept on a public package).
    const now = new Date();
    await tx.riderOfferLog.upsert({
      where: { riderId_requestId: { riderId: rider.id, requestId } },
      create: {
        riderId: rider.id,
        requestId,
        outcome: 'ACCEPTED',
        ringAttempt: request.searchAttempts || 0,
        respondedAt: now,
      },
      update: { outcome: 'ACCEPTED', respondedAt: now },
    });
    await tx.riderOfferLog.updateMany({
      where: {
        requestId,
        riderId: { not: rider.id },
        outcome: 'OFFERED',
      },
      data: { outcome: 'TAKEN', respondedAt: now },
    });

    return updated;
  });

  logger.info('Rider accepted request', { riderId: rider.id, requestId });

  // Phase 4 - emit status + rider-assigned sockets so the customer's
  // tracking screen flips from "Searching…" to "Rider assigned" immediately.
  // Previously acceptJob bypassed updateStatus and these emits were silently
  // missing, leaving the searching banner stuck until a manual refetch.
  try {
    const io = getIO();
    emitStatusChanged(io, requestId, 'RIDER_ASSIGNED');
    emitRiderAssigned(io, requestId, result.customerId, {
      id: result.rider?.id,
      name: `${result.rider?.user?.firstName || ''} ${result.rider?.user?.lastName || ''}`.trim(),
      phone: result.rider?.user?.phone,
      vehicle: result.rider?.vehicleType,
      plateNumber: result.rider?.plateNumber,
    });
  } catch (err) {
    logger.warn('Rider-assigned socket emit failed (non-fatal)', { error: err.message });
  }

  return result;
};

/**
 * Get rider earnings summary.
 */
/**
 * Phase 6 - full earnings dashboard payload. Single endpoint returns the
 * three things the dashboard renders:
 *   1. `summary` - today / week / month / allTime `{ count, amount }` tallies.
 *   2. `daily`   - trailing-30-day series for the 7-day bar chart + drill-in.
 *   3. `recent`  - paginated list of recent settlements with the request
 *                  context the breakdown screen renders per row.
 *
 * Aggregation is keyed off `Transaction` rows of type=RIDER_EARNING joined
 * back to the originating Request via metadata.requestId. The rider's
 * `totalEarnings`/`totalDeliveries` columns are authoritative for allTime
 * (they're written by the settlement worker), avoiding a giant aggregate
 * scan as the rider's history grows.
 */
const RECENT_LIMIT_DEFAULT = 20;

const getEarnings = async (userId, { page = 1, limit = RECENT_LIMIT_DEFAULT } = {}) => {
  const rider = await prisma.rider.findUnique({ where: { userId } });
  if (!rider) throw AppError.notFound('Rider not found');

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  const walletId = wallet?.id || null;

  // No wallet? Rider hasn't been provisioned yet - return zeros so the
  // client renders cleanly rather than 404-ing.
  if (!walletId) {
    return {
      summary: {
        today: { amount: 0, count: 0 },
        week: { amount: 0, count: 0 },
        month: { amount: 0, count: 0 },
        allTime: { amount: Number(rider.totalEarnings) || 0, count: rider.totalDeliveries || 0 },
      },
      daily: [],
      recent: [],
      pagination: { page, limit, total: 0, hasMore: false },
      averageRating: rider.averageRating || 0,
    };
  }

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const thirtyDaysAgo = new Date(todayStart);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // inclusive 30-day window

  const baseWhere = {
    creditWalletId: walletId,
    type: 'RIDER_EARNING',
    status: 'COMPLETED',
  };

  const [today, week, month, dailyRows, recent, total] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...baseWhere, createdAt: { gte: todayStart } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { ...baseWhere, createdAt: { gte: weekStart } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { ...baseWhere, createdAt: { gte: monthStart } },
      _sum: { amount: true },
      _count: true,
    }),
    // Per-day series for the chart. Prisma doesn't have a native bucket-by-day
    // operator on Postgres without raw SQL, so we use $queryRaw. DATE_TRUNC
    // floors each row to its day; results are sparse - the client fills in
    // missing days with zeros.
    prisma.$queryRaw`
      SELECT DATE_TRUNC('day', "createdAt")::date AS day,
             SUM("amount")::float AS amount,
             COUNT(*)::int AS count
      FROM "transactions"
      WHERE "creditWalletId" = ${walletId}
        AND "type" = 'RIDER_EARNING'
        AND "status" = 'COMPLETED'
        AND "createdAt" >= ${thirtyDaysAgo}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    prisma.transaction.findMany({
      where: baseWhere,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, reference: true, amount: true, createdAt: true,
        description: true, metadata: true, balanceAfter: true,
      },
    }),
    prisma.transaction.count({ where: baseWhere }),
  ]);

  // Hydrate recent rows with the originating Request's display fields.
  // Settlement worker stores `metadata.requestId` on every RIDER_EARNING tx,
  // so we pluck those, batch-load requests, then merge.
  const requestIds = recent
    .map((tx) => (tx.metadata && typeof tx.metadata === 'object' && tx.metadata.requestId) || null)
    .filter(Boolean);
  let requestMap = new Map();
  if (requestIds.length > 0) {
    const requests = await prisma.request.findMany({
      where: { id: { in: requestIds } },
      select: {
        id: true, deliveredAt: true, settledAt: true, distanceKm: true,
        estimatedMinutes: true, dropoffAddress: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    });
    requestMap = new Map(requests.map((r) => [r.id, r]));
  }

  const recentHydrated = recent.map((tx) => {
    const reqId = tx.metadata?.requestId || null;
    const req = reqId ? requestMap.get(reqId) : null;
    return {
      id: tx.id,
      reference: tx.reference,
      requestId: reqId,
      amount: Number(tx.amount),
      balanceAfter: tx.balanceAfter != null ? Number(tx.balanceAfter) : null,
      settledAt: tx.createdAt,
      deliveredAt: req?.deliveredAt || null,
      requestSettledAt: req?.settledAt || null,
      distanceKm: req?.distanceKm || null,
      durationMin: req?.estimatedMinutes || null,
      dropoffAddress: req?.dropoffAddress || null,
      customerName: req?.customer
        ? `${req.customer.firstName || ''} ${req.customer.lastName || ''}`.trim()
        : null,
      description: tx.description || null,
    };
  });

  return {
    summary: {
      today:   { amount: Number(today._sum.amount  || 0), count: today._count   || 0 },
      week:    { amount: Number(week._sum.amount   || 0), count: week._count    || 0 },
      month:   { amount: Number(month._sum.amount  || 0), count: month._count   || 0 },
      allTime: {
        amount: Number(rider.totalEarnings) || 0,
        count: rider.totalDeliveries || 0,
      },
    },
    daily: dailyRows.map((r) => ({
      // r.day is a Date (Postgres date). Stringify yyyy-MM-dd for client.
      date: r.day instanceof Date
        ? r.day.toISOString().slice(0, 10)
        : String(r.day).slice(0, 10),
      amount: Number(r.amount || 0),
      count: Number(r.count || 0),
    })),
    recent: recentHydrated,
    pagination: {
      page, limit, total,
      hasMore: page * limit < total,
    },
    averageRating: rider.averageRating || 0,
  };
};

// ============================================================
// Phase 7 - Performance metrics
// ============================================================

const PERFORMANCE_WINDOW_DAYS = 30;
const ON_TIME_TOLERANCE = 1.2; // delivered within 1.2× of estimatedMinutes counts as on-time

/**
 * Compute the rider's trailing-30-day performance metrics:
 *   - acceptanceRate    : ACCEPTED / (ACCEPTED + DECLINED + EXPIRED)
 *   - cancellationRate  : rider-initiated cancellations / total trips claimed
 *   - onTimeRate        : on-time deliveries / delivered count
 *   - rating { average, count, breakdown }
 *   - currentStreakDays : consecutive trailing days with ≥1 delivery
 *   - totalDeliveries   : authoritative count from Rider.totalDeliveries
 *
 * Computed live from `RiderOfferLog`, `Request`, and `Rating`. We can swap
 * in a materialized table (`RiderMetricsDaily`) later if read load grows;
 * the response shape is stable so the client doesn't have to change.
 */
const getPerformance = async (userId) => {
  const rider = await prisma.rider.findUnique({ where: { userId } });
  if (!rider) throw AppError.notFound('Rider not found');

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - PERFORMANCE_WINDOW_DAYS);
  windowStart.setHours(0, 0, 0, 0);

  // Run everything in parallel - these queries are independent.
  const [offerCounts, claimedCount, riderCancelCount, deliveredRows, ratingAgg, ratingBreakdown, recentDeliveryDays] =
    await Promise.all([
      // (1) Offer outcomes for acceptance rate. Group by outcome.
      prisma.riderOfferLog.groupBy({
        by: ['outcome'],
        where: { riderId: rider.id, offeredAt: { gte: windowStart } },
        _count: { _all: true },
      }),
      // (2) Total requests claimed (assigned) in the window.
      prisma.request.count({
        where: { riderId: rider.id, riderAssignedAt: { gte: windowStart } },
      }),
      // (3) Rider-initiated cancellations in the window.
      prisma.request.count({
        where: {
          riderId: rider.id,
          status: 'CANCELLED',
          cancelledBy: 'rider',
          cancelledAt: { gte: windowStart },
        },
      }),
      // (4) Delivered rows for on-time computation.
      prisma.request.findMany({
        where: {
          riderId: rider.id,
          status: { in: ['DELIVERED', 'SETTLED'] },
          deliveredAt: { gte: windowStart, not: null },
        },
        select: {
          riderAssignedAt: true,
          deliveredAt: true,
          estimatedMinutes: true,
        },
      }),
      // (5) Average rating + count (across all time - rider.averageRating is
      //     authoritative once the worker writes it, but we recompute here
      //     to defend against drift).
      prisma.rating.aggregate({
        where: { riderId: rider.id, riderScore: { not: null } },
        _avg: { riderScore: true },
        _count: { riderScore: true },
      }),
      // (6) Rating breakdown 5..1.
      prisma.rating.groupBy({
        by: ['riderScore'],
        where: { riderId: rider.id, riderScore: { not: null } },
        _count: { _all: true },
      }),
      // (7) For current streak: distinct days with ≥1 delivery, trailing 60 days.
      prisma.$queryRaw`
        SELECT DISTINCT DATE_TRUNC('day', "deliveredAt")::date AS day
        FROM "requests"
        WHERE "riderId" = ${rider.id}
          AND "deliveredAt" IS NOT NULL
          AND "deliveredAt" >= ${new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)}
        ORDER BY day DESC
      `,
    ]);

  // Acceptance rate - ACCEPTED / (ACCEPTED + DECLINED + EXPIRED). TAKEN
  // doesn't count against the rider (another rider claimed it before they
  // could respond).
  const byOutcome = Object.fromEntries(
    offerCounts.map((o) => [o.outcome, o._count._all]),
  );
  const accepted = byOutcome.ACCEPTED || 0;
  const declined = byOutcome.DECLINED || 0;
  const expired = byOutcome.EXPIRED || 0;
  const denom = accepted + declined + expired;
  const acceptanceRate = denom > 0 ? Math.round((accepted / denom) * 1000) / 10 : null;

  // Cancellation rate - rider-initiated cancellations / total claimed jobs.
  const cancellationRate =
    claimedCount > 0 ? Math.round((riderCancelCount / claimedCount) * 1000) / 10 : null;

  // On-time rate.
  let onTimeRate = null;
  if (deliveredRows.length > 0) {
    const withEstimates = deliveredRows.filter(
      (r) => r.estimatedMinutes != null && r.riderAssignedAt && r.deliveredAt,
    );
    if (withEstimates.length > 0) {
      const onTime = withEstimates.filter((r) => {
        const elapsedMin = (new Date(r.deliveredAt) - new Date(r.riderAssignedAt)) / 60000;
        return elapsedMin <= r.estimatedMinutes * ON_TIME_TOLERANCE;
      }).length;
      onTimeRate = Math.round((onTime / withEstimates.length) * 1000) / 10;
    }
  }

  // Rating breakdown - bucket 5/4/3/2/1.
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const row of ratingBreakdown) {
    if (row.riderScore != null && breakdown[row.riderScore] !== undefined) {
      breakdown[row.riderScore] = row._count._all;
    }
  }

  // Current streak - consecutive trailing days ending today (or yesterday).
  // All comparisons live in UTC to match Postgres DATE_TRUNC results.
  const dayStrings = recentDeliveryDays.map((r) =>
    r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day).slice(0, 10),
  );
  const todayUtc = now.toISOString().slice(0, 10);
  const yesterdayUtc = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  let streak = 0;
  if (dayStrings[0] === todayUtc || dayStrings[0] === yesterdayUtc) {
    let cursorDate = dayStrings[0];
    for (const ds of dayStrings) {
      if (ds === cursorDate) {
        streak += 1;
        // Decrement cursor by one UTC day.
        const d = new Date(`${cursorDate}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() - 1);
        cursorDate = d.toISOString().slice(0, 10);
      } else {
        break;
      }
    }
  }

  return {
    windowDays: PERFORMANCE_WINDOW_DAYS,
    acceptanceRate,
    cancellationRate,
    onTimeRate,
    totalDeliveries: rider.totalDeliveries || 0,
    currentStreakDays: streak,
    rating: {
      average: ratingAgg._avg.riderScore != null
        ? Math.round(ratingAgg._avg.riderScore * 10) / 10
        : rider.averageRating || 0,
      count: ratingAgg._count.riderScore || 0,
      breakdown,
    },
    // Surface counts so the UI can show "X offers in 30 days" etc.
    counts: {
      offersAccepted: accepted,
      offersDeclined: declined,
      offersExpired: expired,
      jobsClaimed: claimedCount,
      jobsCancelledByRider: riderCancelCount,
      deliveriesInWindow: deliveredRows.length,
    },
  };
};

// ============================================================
// Phase 7 - Document re-upload
// ============================================================

/// Whitelisted document kinds the rider can re-upload from the KYC screen.
/// `kind` maps to the column on `Rider` that holds the Cloudinary URL.
/// `expiryRequired` distinguishes documents that always have an expiry
/// (driver's licence, vehicle reg, insurance) from those that may not
/// (NIN slip - no expiry; vehicle photo - no expiry).
const DOC_KIND_COLUMN = {
  ID_DOC:         { url: 'idDocumentUrl',   expiry: 'idDocExpiresAt',         expiryRequired: false },
  DRIVER_LICENCE: { url: 'driverLicenceUrl', expiry: 'driverLicenceExpiresAt', expiryRequired: true  },
  VEHICLE_PHOTO:  { url: 'vehiclePhotoUrl',  expiry: null,                     expiryRequired: false },
  VEHICLE_REG:    { url: 'vehicleRegUrl',    expiry: 'vehicleRegExpiresAt',    expiryRequired: true  },
  INSURANCE:      { url: 'insuranceDocUrl',  expiry: 'insuranceExpiresAt',     expiryRequired: true  },
};

/**
 * Re-upload a rider document. Validates the URL came from our Cloudinary
 * cloud (defense-in-depth, mirroring support attachment validation) and
 * writes both the URL and the new expiry. The earliest of vehicleReg /
 * insurance expiry is mirrored into `vehicleDocExpiresAt` so the cron
 * worker has one column to query instead of UNION-ing two.
 */
const reuploadDocument = async (userId, { kind, url, expiresAt }) => {
  const config = require('../../config').config;
  const rider = await prisma.rider.findUnique({ where: { userId } });
  if (!rider) throw AppError.notFound('Rider not found');

  const mapping = DOC_KIND_COLUMN[kind];
  if (!mapping) {
    throw AppError.badRequest('Unsupported document kind', { code: 'INVALID_DOC_KIND' });
  }

  // URL must come from our Cloudinary cloud.
  const cloudName = (config.CLOUDINARY_CLOUD_NAME || '').trim();
  if (cloudName) {
    const expectedPrefix = `https://res.cloudinary.com/${cloudName}/`;
    if (typeof url !== 'string' || !url.startsWith(expectedPrefix)) {
      throw AppError.badRequest('Invalid document URL - upload via the in-app flow.', {
        code: 'INVALID_DOC_URL',
      });
    }
  }

  // Expiry handling: required for documents that always expire (driver's
  // licence, vehicle reg, insurance); optional for ID_DOC (NIN slips don't
  // expire) and VEHICLE_PHOTO (no expiry at all).
  let parsedExpiry = null;
  if (mapping.expiry) {
    if (expiresAt) {
      parsedExpiry = new Date(expiresAt);
      if (Number.isNaN(parsedExpiry.getTime())) {
        throw AppError.badRequest('Invalid expiry date', { code: 'INVALID_EXPIRY' });
      }
      if (parsedExpiry.getTime() < Date.now()) {
        throw AppError.badRequest('Expiry date must be in the future', { code: 'EXPIRY_PAST' });
      }
    } else if (mapping.expiryRequired) {
      throw AppError.badRequest('Document expiry is required for this document type', {
        code: 'EXPIRY_REQUIRED',
      });
    }
  }

  const data = { [mapping.url]: url };
  if (mapping.expiry) {
    // Always write the expiry column - null clears any stale prior value
    // when an ID slip is re-uploaded without an expiry.
    data[mapping.expiry] = parsedExpiry;
  }
  // Reset the throttle marker so a re-upload that pushes the rider out of
  // the 14-day window stops emitting expiry pushes.
  data.lastDocExpiryNoticeAt = null;

  // A REJECTED rider who re-uploads the offending document goes straight back
  // into the review queue, and the stale rejection note is cleared. This is the
  // recovery path (the register endpoint 409s for an existing rider record).
  if (rider.status === 'REJECTED') {
    data.status = 'PENDING_APPROVAL';
    data.rejectionReason = null;
  }

  const updated = await prisma.rider.update({
    where: { id: rider.id },
    data,
  });

  // Recompute vehicleDocExpiresAt = min(vehicleRegExpiresAt, insuranceExpiresAt).
  if (kind === 'VEHICLE_REG' || kind === 'INSURANCE') {
    const reg = updated.vehicleRegExpiresAt ? new Date(updated.vehicleRegExpiresAt).getTime() : null;
    const ins = updated.insuranceExpiresAt ? new Date(updated.insuranceExpiresAt).getTime() : null;
    let earliest = null;
    if (reg && ins) earliest = new Date(Math.min(reg, ins));
    else if (reg) earliest = new Date(reg);
    else if (ins) earliest = new Date(ins);
    await prisma.rider.update({
      where: { id: rider.id },
      data: { vehicleDocExpiresAt: earliest },
    });
  }

  logger.info('rider.document.reuploaded', {
    riderId: rider.id, kind, hasExpiry: !!parsedExpiry,
  });

  return {
    kind,
    url,
    expiresAt: parsedExpiry,
  };
};

// ============================================================
// Admin Rider Management Functions
// ============================================================

const getAllRiders = async ({ page, limit, status, availability }) => {
  const where = {
    ...(status && { status }),
    ...(availability && { availability }),
  };

  const [riders, total] = await Promise.all([
    prisma.rider.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        wallet: { select: { balance: true } },
      },
    }),
    prisma.rider.count({ where }),
  ]);

  return { riders, total, page, limit };
};

const getRiderDetails = async (riderId) => {
  const rider = await prisma.rider.findUnique({
    where: { id: riderId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          createdAt: true,
        },
      },
      wallet: { select: { balance: true } },
    },
  });

  if (!rider) throw AppError.notFound('Rider not found');

  return rider;
};

const updateRiderStatus = async (riderId, status, adminId) => {
  const rider = await prisma.rider.findUnique({
    where: { id: riderId },
  });

  if (!rider) throw AppError.notFound('Rider not found');

  const validStatuses = ['PENDING_APPROVAL', 'APPROVED', 'SUSPENDED', 'REJECTED'];
  if (!validStatuses.includes(status)) {
    throw AppError.badRequest('Invalid rider status');
  }

  const prevStatus = rider.status;
  const updated = await prisma.rider.update({
    where: { id: riderId },
    data: { status },
  });

  logger.info('Rider status updated by admin', { riderId, status, adminId });

  // Phase 7 - push + socket notification so the rider's profile gate flips
  // (PendingApproval → Main, or Main → Suspended) without a re-launch. The
  // mobile bus listens for these types and refetches the rider profile.
  if (prevStatus !== status) {
    try {
      const notifyService = require('../../services/notify.service');
      const TYPE_FOR = {
        APPROVED: prevStatus === 'SUSPENDED' ? 'RIDER_REACTIVATED' : 'RIDER_APPROVED',
        REJECTED: 'RIDER_REJECTED',
        SUSPENDED: 'RIDER_SUSPENDED',
        PENDING_APPROVAL: 'RIDER_PENDING',
      };
      const TITLES = {
        RIDER_APPROVED:    'You\'re approved!',
        RIDER_REACTIVATED: 'Account reactivated',
        RIDER_REJECTED:    'Application rejected',
        RIDER_SUSPENDED:   'Account suspended',
        RIDER_PENDING:     'Account under review',
      };
      const BODIES = {
        RIDER_APPROVED:    'Welcome aboard. You can go online and start receiving offers now.',
        RIDER_REACTIVATED: 'Your rider account has been reactivated. Welcome back.',
        RIDER_REJECTED:    'Your rider application wasn\'t approved. Check the Me tab for details.',
        RIDER_SUSPENDED:   'Your rider account has been suspended. Open a support ticket to appeal.',
        RIDER_PENDING:     'Your account is being reviewed again. We\'ll notify you with the outcome.',
      };
      const type = TYPE_FOR[status];
      if (type) {
        await notifyService.pushAndSocket(rider.userId, {
          type,
          title: TITLES[type],
          body: BODIES[type],
          data: { route: '/home', kind: 'rider-status', status },
        });
      }
    } catch (err) {
      logger.warn('Failed to notify rider of status change', {
        riderId, status, error: err.message,
      });
    }
  }

  return updated;
};

const getRiderEarningsAdmin = async (riderId) => {
  const rider = await prisma.rider.findUnique({
    where: { id: riderId },
    include: { wallet: true },
  });

  if (!rider) throw AppError.notFound('Rider not found');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const monthStart = new Date(today);
  monthStart.setDate(1);

  const [todayEarnings, weekEarnings, monthEarnings] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        creditWalletId: rider.wallet.id,
        type: 'RIDER_EARNING',
        status: 'COMPLETED',
        createdAt: { gte: today },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: {
        creditWalletId: rider.wallet.id,
        type: 'RIDER_EARNING',
        status: 'COMPLETED',
        createdAt: { gte: weekStart },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: {
        creditWalletId: rider.wallet.id,
        type: 'RIDER_EARNING',
        status: 'COMPLETED',
        createdAt: { gte: monthStart },
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    riderId,
    riderName: `${rider.user.firstName} ${rider.user.lastName}`,
    walletBalance: Number(rider.wallet.balance),
    today: {
      earnings: todayEarnings._sum.amount || 0,
      deliveries: todayEarnings._count,
    },
    thisWeek: {
      earnings: weekEarnings._sum.amount || 0,
      deliveries: weekEarnings._count,
    },
    thisMonth: {
      earnings: monthEarnings._sum.amount || 0,
      deliveries: monthEarnings._count,
    },
    allTime: {
      earnings: rider.totalEarnings,
      deliveries: rider.totalDeliveries,
    },
    averageRating: rider.averageRating,
  };
};

module.exports = {
  registerRider,
  getProfile,
  updateAvailability,
  updateLocation,
  acceptJob,
  getEarnings,
  // Phase 7
  getPerformance,
  reuploadDocument,
  // Admin functions
  getAllRiders,
  getRiderDetails,
  updateRiderStatus,
  getRiderEarningsAdmin,
};
