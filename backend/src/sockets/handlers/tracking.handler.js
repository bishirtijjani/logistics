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

// Phase 4 - push ETA at most every 30s and only when the rider has moved
// >100m since the last push. Cheap on Maps quota, accurate enough for UI.
const ETA_MIN_INTERVAL_MS = 30 * 1000;
const ETA_MIN_DISTANCE_M = 100;

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
  // Only riders send location updates
  if (socket.user.role !== 'RIDER') return;

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

      // Also write to the rider GEO index used by the expanding-radius
      // matcher. ioredis GEOADD signature: GEOADD key longitude latitude member.
      try {
        await redis.geoadd(REDIS_KEYS.RIDER_GEO_INDEX, lng, lat, riderId);
      } catch (err) {
        logger.warn('GEOADD failed', { riderId, error: err.message });
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

  // On disconnect, remove the rider from the GEO index so they don't get
  // offered jobs while offline. The JSON RIDER_LOCATION key is allowed to
  // expire on its own TTL.
  socket.on('disconnect', async () => {
    try {
      await redis.zrem(REDIS_KEYS.RIDER_GEO_INDEX, socket.user.id);
    } catch (err) {
      logger.warn('Failed to remove rider from GEO index on disconnect', {
        riderId: socket.user.id, error: err.message,
      });
    }
  });

  // Explicit availability:changed channel - riders going offline should
  // disappear from the index immediately.
  socket.on(RIDER.AVAILABILITY_CHANGED, async (data) => {
    try {
      if (data?.available === false) {
        await redis.zrem(REDIS_KEYS.RIDER_GEO_INDEX, socket.user.id);
      }
    } catch (err) {
      logger.warn('AVAILABILITY_CHANGED handling failed', { error: err.message });
    }
  });
};

module.exports = { registerTrackingHandlers };
