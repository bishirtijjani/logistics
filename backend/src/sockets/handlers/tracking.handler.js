/**
 * Tracking socket handler — rider GPS location streaming.
 *
 * FLOW:
 * 1. Rider emits rider:location:update every ~3 seconds with { lat, lng }
 * 2. Server stores in Redis (fast read for other services)
 * 3. Server broadcasts to the delivery room so customer sees live movement
 *
 * PERFORMANCE:
 * - Redis write per update (not DB — too frequent)
 * - DB is updated less often via a periodic flush or on status change
 */

const { redis } = require('../../config/redis');
const { RIDER, getDeliveryRoom } = require('../events');
const { REDIS_KEYS, REDIS_TTL } = require('../../utils/constants');
const { logger } = require('../../utils/logger');

const registerTrackingHandlers = (io, socket) => {
  // Only riders send location updates
  if (socket.user.role !== 'RIDER') return;

  /**
   * Handle rider:location:update
   * Payload: { lat: number, lng: number, orderId?: string }
   */
  socket.on(RIDER.LOCATION_UPDATE, async (data) => {
    try {
      const { lat, lng, orderId } = data;
      const riderId = socket.user.id;

      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return; // Silently ignore invalid payloads
      }

      // Store latest position in Redis
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

      // If rider is on an active delivery, broadcast to delivery room
      if (orderId) {
        const room = getDeliveryRoom(orderId);
        socket.to(room).emit(RIDER.LOCATION_BROADCAST, {
          riderId,
          lat,
          lng,
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      logger.error('Location update failed', {
        riderId: socket.user.id,
        error: error.message,
      });
    }
  });
};

module.exports = { registerTrackingHandlers };
