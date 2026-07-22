/**
 * Rider dispatch-pool helpers.
 *
 * The expanding-radius matcher only ever offers jobs to riders in the Redis
 * geo index `riders:geo` (GEOADD/GEOSEARCH). Membership is keyed by USER id -
 * that is the dispatch identity the matcher emits to (getUserRoom) and that
 * acceptJob() authenticates with.
 *
 * Historically the geo index was fed ONLY by live `rider:location:update`
 * socket pings, while the DB `Rider.availability=ONLINE` flag was sticky and
 * never reconciled. A rider could therefore be "ONLINE" in the DB yet absent
 * from the geo index (app backgrounded / closed, or just between pings), so the
 * matcher had no one to offer jobs to - auto-assign looked broken and admins
 * fell back to manual assignment.
 *
 * These helpers make pool membership explicit and pair every geo entry with a
 * short-lived heartbeat key. The heartbeat is the single source of truth for
 * "this rider is reachable right now"; the reconcile sweep (rider.worker.js)
 * uses it to prune stale geo members and to correct the sticky DB flag.
 */

const { redis } = require('../config/redis');
const { REDIS_KEYS, REDIS_TTL } = require('../utils/constants');
const { logger } = require('../utils/logger');

const heartbeatKey = (userId) => `${REDIS_KEYS.RIDER_HEARTBEAT}${userId}`;

/**
 * Add/refresh a rider in the dispatch geo index and stamp a fresh heartbeat.
 * `userId` MUST be the User id (dispatch identity), not the Rider id.
 */
const markRiderAvailable = async (userId, { lat, lng }) => {
  if (typeof lat !== 'number' || typeof lng !== 'number') return;
  try {
    // ioredis GEOADD signature: GEOADD key longitude latitude member.
    await redis.geoadd(REDIS_KEYS.RIDER_GEO_INDEX, lng, lat, userId);
    await redis.set(heartbeatKey(userId), Date.now().toString(), 'EX', REDIS_TTL.RIDER_HEARTBEAT);
  } catch (err) {
    logger.warn('markRiderAvailable failed', { userId, error: err.message });
  }
};

/**
 * Refresh only the heartbeat (rider is reachable but we have no new position).
 * Used as a grace stamp when a rider toggles ONLINE before their first ping.
 */
const touchRiderHeartbeat = async (userId) => {
  try {
    await redis.set(heartbeatKey(userId), Date.now().toString(), 'EX', REDIS_TTL.RIDER_HEARTBEAT);
  } catch (err) {
    logger.warn('touchRiderHeartbeat failed', { userId, error: err.message });
  }
};

/**
 * Fully remove a rider from the dispatch pool (explicit go-offline / kill
 * switch). Clears BOTH the geo membership and the heartbeat, so the rider is
 * gone immediately and the reconcile sweep will settle the DB flag at once.
 */
const removeRiderFromPool = async (userId) => {
  try {
    await redis.zrem(REDIS_KEYS.RIDER_GEO_INDEX, userId);
    await redis.del(heartbeatKey(userId));
  } catch (err) {
    logger.warn('removeRiderFromPool failed', { userId, error: err.message });
  }
};

/**
 * Remove a rider from the dispatch geo index only, LEAVING the heartbeat to
 * lapse on its own TTL. Used on an *involuntary* socket disconnect: we must
 * stop offering jobs to an unreachable socket right away (geo), but the
 * heartbeat is kept as a grace window so a transient blip + reconnect (common
 * on the web PWA when the tab backgrounds) doesn't instantly evict the rider
 * and trip the reconcile sweep into flipping their DB flag OFFLINE. A truly
 * gone rider's heartbeat simply expires (<=90s) and the sweep settles them.
 */
const removeRiderFromGeo = async (userId) => {
  try {
    await redis.zrem(REDIS_KEYS.RIDER_GEO_INDEX, userId);
  } catch (err) {
    logger.warn('removeRiderFromGeo failed', { userId, error: err.message });
  }
};

/**
 * True when the rider still has a live heartbeat (i.e. is genuinely reachable).
 */
const isRiderHeartbeatLive = async (userId) => {
  try {
    return (await redis.exists(heartbeatKey(userId))) === 1;
  } catch (err) {
    logger.warn('isRiderHeartbeatLive failed', { userId, error: err.message });
    return false;
  }
};

module.exports = {
  markRiderAvailable,
  touchRiderHeartbeat,
  removeRiderFromPool,
  removeRiderFromGeo,
  isRiderHeartbeatLive,
};
