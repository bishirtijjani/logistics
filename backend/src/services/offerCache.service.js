/**
 * Live rider-offer cache (Redis-backed).
 *
 * Job offers are only ever emitted once, over the socket, at the moment a
 * ring fires. A rider whose app wasn't connected at that instant (backgrounded,
 * phone locked, socket mid-reconnect) simply never sees it - there is no
 * resend. This cache lets us close that gap without any mobile app change:
 * every offer emitted to a rider is mirrored here with its true `offeredAt` +
 * `timeout`, and `sockets/index.js` replays any still-live entries the moment
 * that rider's socket (re)connects, driving the exact same `rider:job:new`
 * client handler the app already ships with - so the countdown ring resumes
 * from the real remaining time instead of restarting or never appearing.
 *
 * Cleared on every terminal outcome (accepted / taken / expired / cancelled)
 * by request.worker.js's notifyJobTaken, which already knows the full set of
 * riders a request was offered to.
 */

const { redis } = require('../config/redis');
const { logger } = require('../utils/logger');
const { REDIS_KEYS } = require('../utils/constants');

const keyFor = (riderId) => `${REDIS_KEYS.RIDER_OFFER_PENDING}${riderId}`;

const isLive = (entry, now = Date.now()) =>
  typeof entry?.offeredAt === 'number' &&
  typeof entry?.timeout === 'number' &&
  entry.offeredAt + entry.timeout * 1000 > now;

/**
 * Record (or refresh, on re-ring) a live offer for one rider.
 * `entry` = { requestId, offeredAt, timeout, payload } where `payload` is the
 * exact `rider:job:new` body already sent over the socket.
 */
const savePendingOffer = async (riderId, entry) => {
  try {
    const now = Date.now();
    const raw = await redis.get(keyFor(riderId));
    let list = [];
    if (raw) {
      try { list = JSON.parse(raw); } catch (_) { list = []; }
    }
    list = list.filter((o) => o.requestId !== entry.requestId && isLive(o, now));
    list.push(entry);

    const maxExpiry = Math.max(...list.map((o) => o.offeredAt + o.timeout * 1000));
    const ttlSec = Math.max(30, Math.ceil((maxExpiry - now) / 1000) + 15);
    await redis.set(keyFor(riderId), JSON.stringify(list), 'EX', ttlSec);
  } catch (err) {
    logger.warn('savePendingOffer failed', { riderId, requestId: entry?.requestId, error: err.message });
  }
};

/**
 * Drop one request's entry for one rider (terminal outcome for that pairing).
 */
const clearPendingOffer = async (riderId, requestId) => {
  try {
    const raw = await redis.get(keyFor(riderId));
    if (!raw) return;
    let list = [];
    try { list = JSON.parse(raw); } catch (_) { return; }
    const next = list.filter((o) => o.requestId !== requestId);

    if (next.length === 0) {
      await redis.del(keyFor(riderId));
      return;
    }
    const now = Date.now();
    const maxExpiry = Math.max(...next.map((o) => o.offeredAt + o.timeout * 1000));
    const ttlSec = Math.max(30, Math.ceil((maxExpiry - now) / 1000) + 15);
    await redis.set(keyFor(riderId), JSON.stringify(next), 'EX', ttlSec);
  } catch (err) {
    logger.warn('clearPendingOffer failed', { riderId, requestId, error: err.message });
  }
};

/**
 * Every still-live offer for a rider, newest first. Used on socket connect
 * to replay `rider:job:new` so a reconnecting/foregrounding rider sees the
 * real countdown instead of nothing.
 */
const getLivePendingOffers = async (riderId) => {
  try {
    const raw = await redis.get(keyFor(riderId));
    if (!raw) return [];
    let list = [];
    try { list = JSON.parse(raw); } catch (_) { return []; }
    const now = Date.now();
    return list.filter((o) => isLive(o, now));
  } catch (err) {
    logger.warn('getLivePendingOffers failed', { riderId, error: err.message });
    return [];
  }
};

module.exports = { savePendingOffer, clearPendingOffer, getLivePendingOffers };
