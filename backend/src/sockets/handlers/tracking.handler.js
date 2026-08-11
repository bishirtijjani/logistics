/**
 * Tracking socket handler - rider GPS location streaming.
 *
 * FLOW:
 * 1. Rider emits rider:location:update every ~3 seconds with { lat, lng }
 * 2. Server stores in Redis (fast read for other services)
 * 3. Server broadcasts to the request room so customer sees live movement
 *
 * PERFORMANCE:
 * - Redis write per update (not DB - too frequent)
 * - DB is updated less often via a periodic flush or on status change
 */

const { redis } = require('../../config/redis');
const { RIDER, REQUEST, getRequestRoom, getUserRoom } = require('../events');
const { REDIS_KEYS, REDIS_TTL } = require('../../utils/constants');
const { logger } = require('../../utils/logger');
const { prisma } = require('../../config/database');
const mapsService = require('../../services/maps.service');
const {
  markRiderAvailable,
  touchRiderHeartbeat,
  removeRiderFromPool,
} = require('../../services/rider-pool.service');

// Phase 4 - push ETA at most every 30s and only when the rider has moved
// >100m since the last push. Cheap on Maps quota, accurate enough for UI.
const ETA_MIN_INTERVAL_MS = 30 * 1000;
const ETA_MIN_DISTANCE_M = 100;

// How often, while a rider's socket is connected AND they intend to be online,
// the server re-stamps their dispatch heartbeat (and re-asserts their geo
// position). This is the load-bearing fix for "went online but got no jobs":
// dispatch presence is driven by the LIVE SOCKET CONNECTION, not by a stream of
// GPS pings. A stationary idle rider - very common on the web build, where the
// browser Geolocation API often fires once and then goes quiet - therefore
// stays in the dispatch pool for as long as their app is open. 30s is well
// under the 180s heartbeat TTL, so a single missed tick can never evict them.
const PRESENCE_REFRESH_MS = 30 * 1000;

const haversineMeters = (lat1, lng1, lat2, lng2) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const maybePushEta = async (io, requestId, riderLat, riderLng) => {
  const lastKey = `${REDIS_KEYS.REQUEST_ETA_LAST}${requestId}`;
  let last;
  try {
    const raw = await redis.get(lastKey);
    if (raw) last = JSON.parse(raw);
  } catch (_) {}

  const now = Date.now();
  if (last) {
    if (now - last.pushedAt < ETA_MIN_INTERVAL_MS) return;
    if (typeof last.lat === 'number' && typeof last.lng === 'number') {
      if (haversineMeters(last.lat, last.lng, riderLat, riderLng) < ETA_MIN_DISTANCE_M) return;
    }
  }

  const req = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      status: true, pickupLat: true, pickupLng: true, dropoffLat: true, dropoffLng: true,
    },
  });
  if (!req) return;

  // Next checkpoint: pickup if not yet picked up, else dropoff.
  const preferPickup = !['PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'SETTLED'].includes(req.status);
  const destLat = preferPickup ? req.pickupLat : req.dropoffLat;
  const destLng = preferPickup ? req.pickupLng : req.dropoffLng;
  if (typeof destLat !== 'number' || typeof destLng !== 'number') return;

  let durationSeconds = null;
  try {
    const dirs = await mapsService.getDirections(riderLat, riderLng, destLat, destLng);
    durationSeconds = dirs.durationSeconds;
  } catch (err) {
    logger.warn('ETA computation failed', { requestId, error: err.message });
    return;
  }

  io.to(getRequestRoom(requestId)).emit(REQUEST.RIDER_ETA, {
    requestId,
    etaSeconds: durationSeconds,
    nextCheckpoint: preferPickup ? 'PICKUP' : 'DROPOFF',
    riderLat,
    riderLng,
    timestamp: now,
  });

  try {
    await redis.set(
      lastKey,
      JSON.stringify({ pushedAt: now, lat: riderLat, lng: riderLng, etaSeconds: durationSeconds }),
      'EX',
      REDIS_TTL.REQUEST_ETA_LAST,
    );
  } catch (_) {}
};

const registerTrackingHandlers = (io, socket) => {
  // Only APPROVED riders send location updates into the dispatch geo index.
  // A fresh, unapproved RIDER signup must never reach the GEOADD below, or the
  // matcher would offer them jobs (pickup address + fare) they can't accept.
  if (socket.user.role !== 'RIDER' || !socket.user.isApprovedRider) return;

  const riderUserId = socket.user.id;

  // Per-connection presence state.
  //   _online  - the rider's intent to receive jobs. Seeded from the DB at
  //              connect, then kept honest by the availability:changed events
  //              and by any incoming location fix. ON_DELIVERY counts as online
  //              intent so presence survives a whole trip (the server flips a
  //              rider ON_DELIVERY -> ONLINE at settle without a client emit).
  //   _lastPos - the freshest position we hold, so the keep-alive can re-assert
  //              their geo location without waiting for a new GPS ping.
  socket._online = false;
  socket._lastPos = null;

  // Presence keep-alive. While the socket is connected and the rider intends to
  // be online, re-stamp the heartbeat (and re-assert the geo position if we
  // have one) on a fixed cadence, independent of GPS pings. This is what keeps
  // a stationary/idle rider dispatchable. Cleared on disconnect. It is strictly
  // less frequent than the per-ping GEOADD, so it adds no new exposure for a
  // busy rider that pings are already re-adding.
  const presenceTimer = setInterval(() => {
    if (!socket._online) return;
    if (socket._lastPos) {
      markRiderAvailable(riderUserId, socket._lastPos).catch((err) =>
        logger.warn('presence refresh (geo) failed', { riderUserId, error: err.message }),
      );
    } else {
      touchRiderHeartbeat(riderUserId).catch((err) =>
        logger.warn('presence refresh (heartbeat) failed', { riderUserId, error: err.message }),
      );
    }
  }, PRESENCE_REFRESH_MS);

  // Seed the dispatch pool on connect. If the rider's DB availability is ONLINE
  // (or ON_DELIVERY) we make them reachable immediately: mark _online so the
  // keep-alive runs, and GEOADD their last-known position right away if we have
  // one - so the matcher can reach them BEFORE their first live ping (critical
  // on web, where that first ping can be slow or, for a stationary rider, the
  // only one). We deliberately DROP the old "recent fix only" gate: being
  // absent from the pool is far worse than a slightly stale position, and the
  // first ping (or the client's one-shot fix on go-online) corrects it within
  // seconds.
  (async () => {
    try {
      const rider = await prisma.rider.findUnique({
        where: { userId: riderUserId },
        select: { availability: true, lastLat: true, lastLng: true },
      });
      if (!rider || (rider.availability !== 'ONLINE' && rider.availability !== 'ON_DELIVERY')) return;
      socket._online = true;
      if (typeof rider.lastLat === 'number' && typeof rider.lastLng === 'number') {
        socket._lastPos = { lat: rider.lastLat, lng: rider.lastLng };
        await markRiderAvailable(riderUserId, socket._lastPos);
      } else {
        // Online but we have never held a fix for them: keep them alive so the
        // reconcile sweep doesn't flip them OFFLINE before the app streams its
        // first position.
        await touchRiderHeartbeat(riderUserId);
      }
    } catch (err) {
      logger.warn('Dispatch-pool seed on connect failed', { riderUserId, error: err.message });
    }
  })();

  /**
   * Handle rider:location:update
   * Payload: { lat: number, lng: number, requestId?: string }
   */
  socket.on(RIDER.LOCATION_UPDATE, async (data) => {
    try {
      const { lat, lng, requestId } = data;
      const riderId = socket.user.id;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return; // Silently ignore invalid payloads
      }

      // Store latest position in Redis (legacy JSON read by other services).
      const locationData = JSON.stringify({
        lat,
        lng,
        riderId,
        updatedAt: Date.now(),
      });

      await redis.set(
        `${REDIS_KEYS.RIDER_LOCATION}${riderId}`,
        locationData,
        'EX',
        REDIS_TTL.RIDER_LOCATION
      );

      // Add/refresh the rider in the dispatch geo index AND stamp a heartbeat.
      // The heartbeat is what keeps them dispatchable and what the reconcile
      // sweep checks to decide whether a sticky DB ONLINE flag is still real.
      await markRiderAvailable(riderId, { lat, lng });

      // Feed the presence keep-alive: cache the freshest position, and treat a
      // live fix as proof of online intent (the app only streams while online /
      // on-delivery - go-offline stops the stream). This also re-arms the
      // keep-alive after a trip, when the server flips ON_DELIVERY -> ONLINE
      // without any client availability emit.
      socket._lastPos = { lat, lng };
      socket._online = true;

      // Persist the last-known position to the DB too, but throttled - the
      // socket path fires ~every 3s and we don't want a write storm. A recent
      // DB fix lets us seed the pool immediately on the next reconnect.
      try {
        const throttleKey = `${REDIS_KEYS.RIDER_LOC_DB_THROTTLE}${riderId}`;
        const fresh = await redis.set(throttleKey, '1', 'EX', REDIS_TTL.RIDER_LOC_DB_THROTTLE, 'NX');
        if (fresh === 'OK') {
          await prisma.rider.update({
            where: { userId: riderId },
            data: { lastLat: lat, lastLng: lng, lastLocationAt: new Date() },
          });
        }
      } catch (err) {
        logger.warn('Rider location DB persist failed', { riderId, error: err.message });
      }

      // If rider is on an active request, broadcast to that request's room
      // and optionally push an updated ETA.
      if (requestId) {
        const room = getRequestRoom(requestId);
        socket.to(room).emit(RIDER.LOCATION_BROADCAST, {
          requestId,
          riderId,
          lat,
          lng,
          timestamp: Date.now(),
        });
        // Fire-and-forget; do not delay rider updates on Maps latency.
        maybePushEta(io, requestId, lat, lng).catch((err) =>
          logger.warn('maybePushEta failed', { requestId, error: err.message }),
        );
      }
    } catch (error) {
      logger.error('Location update failed', {
        riderId: socket.user.id,
        error: error.message,
      });
    }
  });

  // On an *involuntary* disconnect, LEAVE the rider in the GEO index and let
  // the heartbeat lapse on its own TTL. Mobile OSes suspend a backgrounded
  // app's socket immediately - there is no graceful window to react in - so
  // the heartbeat TTL is the only real grace period a minimized app gets. A
  // transient blip / brief minimize + reconnect then re-seeds live presence
  // from the still-ONLINE DB flag without ever being evicted; a rider offered
  // a job while genuinely unreachable simply won't respond within that ring's
  // timeout and the matcher moves on to the next candidate (existing
  // expanding-ring reassign flow), same as any offer race. A rider who is
  // truly gone lets the heartbeat expire and the reconcile sweep (which also
  // prunes stale geo members) settles them. An explicit go-offline is a
  // different path (AVAILABILITY_CHANGED below) and still clears everything
  // immediately via removeRiderFromPool. The JSON RIDER_LOCATION key expires
  // on its own TTL.
  socket.on('disconnect', async () => {
    clearInterval(presenceTimer);
    socket._online = false;
  });

  // Explicit availability:changed channel (client -> server). The rider app
  // emits `{ availability: 'ONLINE' | 'OFFLINE' }` (see rider-app socket.js).
  //   OFFLINE -> leave the dispatch pool immediately and stop the keep-alive.
  //   ONLINE  -> seed the pool right away (coords in the payload if the client
  //              sent a one-shot fix, otherwise the last position we hold) so
  //              the rider is dispatchable the instant they toggle on, without
  //              waiting for the first watch ping.
  // (`available: false` is also accepted for backwards-compatibility with any
  // client still on the old boolean contract.)
  socket.on(RIDER.AVAILABILITY_CHANGED, async (data) => {
    const goingOffline = data?.availability === 'OFFLINE' || data?.available === false;
    const goingOnline = data?.availability === 'ONLINE' || data?.available === true;

    if (goingOffline) {
      socket._online = false;
      await removeRiderFromPool(riderUserId);
      return;
    }

    if (goingOnline) {
      socket._online = true;
      if (typeof data?.lat === 'number' && typeof data?.lng === 'number') {
        socket._lastPos = { lat: data.lat, lng: data.lng };
      }
      if (socket._lastPos) {
        await markRiderAvailable(riderUserId, socket._lastPos);
      } else {
        await touchRiderHeartbeat(riderUserId);
      }
    }
  });
};

module.exports = { registerTrackingHandlers };
