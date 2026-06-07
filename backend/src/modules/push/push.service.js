const { prisma } = require('../../config/database');

/**
 * Upsert a browser push subscription, keyed by its endpoint. Re-subscribing or
 * a different user logging in on the same browser reassigns the row to the new
 * user (the endpoint is globally unique).
 */
const subscribe = async (userId, { endpoint, keys, userAgent } = {}) => {
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    const err = new Error('Invalid push subscription payload');
    err.statusCode = 400;
    throw err;
  }
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || null,
    },
    update: {
      userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || null,
    },
    select: { id: true },
  });
};

/** Remove a subscription (on logout / permission revoke). Scoped to the user. */
const unsubscribe = async (userId, endpoint) => {
  if (!endpoint) return { count: 0 };
  return prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
};

module.exports = { subscribe, unsubscribe };
