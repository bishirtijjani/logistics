/**
 * Rider service — rider profile, availability, and job management.
 */

const { prisma } = require('../../config/database');
const { redis } = require('../../config/redis');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const { REDIS_KEYS, REDIS_TTL } = require('../../utils/constants');
const { getIO } = require('../../sockets');
const { emitRiderAssigned, emitStatusChanged } = require('../../sockets/handlers/request.handler');

/**
 * Register as a rider — creates Rider profile linked to existing User.
 */
const registerRider = async (userId, riderData) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User not found');

  const existingRider = await prisma.rider.findUnique({ where: { userId } });
  if (existingRider) throw AppError.conflict('Already registered as a rider');

  const rider = await prisma.$transaction(async (tx) => {
    // Update user role to RIDER
    await tx.user.update({
      where: { id: userId },
      data: { role: 'RIDER' },
    });

    const newRider = await tx.rider.create({
      data: {
        userId,
        vehicleType: riderData.vehicleType,
        plateNumber: riderData.plateNumber,
        vehicleColor: riderData.vehicleColor,
        ninNumber: riderData.ninNumber,
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
 * the rider's currently-active delivery (status in the active set) — the
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

  // Find an active trip — at most one per rider thanks to the FSM.
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
 * Update rider GPS location — called frequently (~every 3s during delivery).
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
 * Accept a request job — rider claims a request that's READY_FOR_PICKUP (or REQUESTED for PACKAGE).
 */
const acceptJob = async (userId, requestId) => {
  const rider = await prisma.rider.findUnique({ where: { userId } });
  if (!rider) throw AppError.notFound('Rider not found');
  if (rider.status !== 'APPROVED') throw AppError.forbidden('Rider not approved');
  if (rider.availability !== 'ONLINE') throw AppError.badRequest('Rider is not online');

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

    // Set rider to ON_DELIVERY (enum kept for backwards compatibility — covers any active request)
    await tx.rider.update({
      where: { id: rider.id },
      data: { availability: 'ON_DELIVERY' },
    });

    return updated;
  });

  logger.info('Rider accepted request', { riderId: rider.id, requestId });

  // Phase 4 — emit status + rider-assigned sockets so the customer's
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
 * Phase 6 — full earnings dashboard payload. Single endpoint returns the
 * three things the dashboard renders:
 *   1. `summary` — today / week / month / allTime `{ count, amount }` tallies.
 *   2. `daily`   — trailing-30-day series for the 7-day bar chart + drill-in.
 *   3. `recent`  — paginated list of recent settlements with the request
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

  // No wallet? Rider hasn't been provisioned yet — return zeros so the
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
    // floors each row to its day; results are sparse — the client fills in
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

  const updated = await prisma.rider.update({
    where: { id: riderId },
    data: { status },
  });

  logger.info('Rider status updated by admin', { riderId, status, adminId });

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
  // Admin functions
  getAllRiders,
  getRiderDetails,
  updateRiderStatus,
  getRiderEarningsAdmin,
};
