/**
 * Admin service — rider approvals, user management, transaction oversight.
 */

const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');

/**
 * List all riders pending approval.
 */
const getPendingRiders = async ({ page = 1, limit = 20 }) => {
  const where = { status: 'PENDING_APPROVAL' };

  const [riders, total] = await Promise.all([
    prisma.rider.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, phone: true, firstName: true, lastName: true } },
      },
    }),
    prisma.rider.count({ where }),
  ]);

  return { riders, total, page, limit };
};

/**
 * Approve or reject a rider.
 */
const reviewRider = async (riderId, decision) => {
  const rider = await prisma.rider.findUnique({ where: { id: riderId } });
  if (!rider) throw AppError.notFound('Rider not found');
  if (rider.status !== 'PENDING_APPROVAL') {
    throw AppError.badRequest('Rider already reviewed');
  }

  const newStatus = decision === 'approve' ? 'APPROVED' : 'REJECTED';

  const updated = await prisma.rider.update({
    where: { id: riderId },
    data: { status: newStatus },
  });

  logger.info('Rider reviewed', { riderId, decision: newStatus });

  // TODO: Send push notification to rider

  return updated;
};

/**
 * Suspend or activate a user.
 */
const updateUserStatus = async (userId, status) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound('User not found');

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status },
  });

  // If suspending, also lock their wallet
  if (status === 'SUSPENDED') {
    await prisma.wallet.updateMany({
      where: { userId },
      data: { isLocked: true },
    });
  }

  logger.info('User status updated', { userId, status });

  return updated;
};

/**
 * Get platform-wide transaction overview.
 */
const getTransactionOverview = async ({ page = 1, limit = 50, type, status }) => {
  const where = {
    ...(type && { type }),
    ...(status && { status }),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { transactions, total, page, limit };
};

/**
 * Get platform dashboard stats.
 */
const getDashboardStats = async () => {
  const [
    totalUsers,
    totalRiders,
    activeDeliveries,
    totalTransactionVolume,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'CUSTOMER', deletedAt: null } }),
    prisma.rider.count({ where: { status: 'APPROVED' } }),
    prisma.deliveryOrder.count({
      where: { status: { in: ['REQUESTED', 'MATCHED', 'RIDER_EN_ROUTE', 'PICKED_UP', 'IN_TRANSIT'] } },
    }),
    prisma.transaction.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalUsers,
    totalRiders,
    activeDeliveries,
    totalTransactionVolume: totalTransactionVolume._sum.amount || 0,
  };
};

module.exports = {
  getPendingRiders,
  reviewRider,
  updateUserStatus,
  getTransactionOverview,
  getDashboardStats,
};
