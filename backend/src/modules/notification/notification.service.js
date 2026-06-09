/**
 * Notification feed service - backs the in-app Notification Center.
 */

const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');

const listNotifications = async (userId, { page, limit, unreadOnly }) => {
  const where = {
    userId,
    ...(unreadOnly ? { readAt: null } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return { notifications, total, page, limit, unreadCount };
};

const getUnreadCount = async (userId) => {
  const count = await prisma.notification.count({ where: { userId, readAt: null } });
  return { count };
};

const markRead = async (userId, notificationId) => {
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true, readAt: true },
  });
  if (!existing) throw AppError.notFound('Notification not found');
  if (existing.userId !== userId) throw AppError.forbidden('Not your notification');

  // Idempotent: if already read, just return.
  if (existing.readAt) return existing;

  return prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
};

const markAllRead = async (userId) => {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
};

module.exports = {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
};
