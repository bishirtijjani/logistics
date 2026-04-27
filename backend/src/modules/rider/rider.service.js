/**
 * Rider service — rider profile, availability, and job management.
 */

const { prisma } = require('../../config/database');
const { redis } = require('../../config/redis');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const { REDIS_KEYS, REDIS_TTL } = require('../../utils/constants');

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
 * Get rider profile with earnings.
 */
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

  return rider;
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
 * Accept a delivery job.
 */
const acceptJob = async (userId, orderId) => {
  const rider = await prisma.rider.findUnique({ where: { userId } });
  if (!rider) throw AppError.notFound('Rider not found');
  if (rider.status !== 'APPROVED') throw AppError.forbidden('Rider not approved');
  if (rider.availability !== 'ONLINE') throw AppError.badRequest('Rider is not online');

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.deliveryOrder.findUnique({ where: { id: orderId } });

    if (!order) throw AppError.notFound('Order not found');
    if (order.status !== 'REQUESTED') throw AppError.conflict('Order already taken');

    // Assign rider and update status
    const updated = await tx.deliveryOrder.update({
      where: { id: orderId },
      data: {
        riderId: rider.id,
        status: 'MATCHED',
        matchedAt: new Date(),
      },
    });

    // Set rider to ON_DELIVERY
    await tx.rider.update({
      where: { id: rider.id },
      data: { availability: 'ON_DELIVERY' },
    });

    return updated;
  });

  logger.info('Rider accepted job', { riderId: rider.id, orderId });

  // TODO: Emit socket event to customer
  // TODO: Send push notification to customer

  return result;
};

/**
 * Get rider earnings summary.
 */
const getEarnings = async (userId) => {
  const rider = await prisma.rider.findUnique({ where: { userId } });
  if (!rider) throw AppError.notFound('Rider not found');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const [todayEarnings, weekEarnings] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        creditWalletId: (await prisma.wallet.findUnique({ where: { userId } }))?.id,
        type: 'DELIVERY_EARNING',
        status: 'COMPLETED',
        createdAt: { gte: today },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: {
        creditWalletId: (await prisma.wallet.findUnique({ where: { userId } }))?.id,
        type: 'DELIVERY_EARNING',
        status: 'COMPLETED',
        createdAt: { gte: weekStart },
      },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return {
    today: {
      earnings: todayEarnings._sum.amount || 0,
      deliveries: todayEarnings._count,
    },
    thisWeek: {
      earnings: weekEarnings._sum.amount || 0,
      deliveries: weekEarnings._count,
    },
    allTime: {
      earnings: rider.totalEarnings,
      deliveries: rider.totalDeliveries,
    },
    averageRating: rider.averageRating,
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
        type: 'DELIVERY_EARNING',
        status: 'COMPLETED',
        createdAt: { gte: today },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: {
        creditWalletId: rider.wallet.id,
        type: 'DELIVERY_EARNING',
        status: 'COMPLETED',
        createdAt: { gte: weekStart },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: {
        creditWalletId: rider.wallet.id,
        type: 'DELIVERY_EARNING',
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
