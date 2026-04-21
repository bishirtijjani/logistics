/**
 * Delivery queue worker — rider matching, settlement, auto-cancellation.
 */

const { Worker } = require('bullmq');
const { redis } = require('../../config/redis');
const { QUEUES, DELIVERY_JOBS } = require('../jobs');
const { logger } = require('../../utils/logger');
const deliveryService = require('../../modules/delivery/delivery.service');
const { getIO } = require('../../sockets');
const { RIDER, getRiderPoolRoom } = require('../../sockets/events');
const notificationService = require('../../services/notification.service');
const { prisma } = require('../../config/database');

const startDeliveryWorker = () => {
  const worker = new Worker(
    QUEUES.DELIVERY,
    async (job) => {
      switch (job.name) {
        case DELIVERY_JOBS.BROADCAST_TO_RIDERS:
          return handleBroadcast(job.data);

        case DELIVERY_JOBS.SETTLE_DELIVERY:
          return deliveryService.settleDelivery(job.data.orderId);

        case DELIVERY_JOBS.AUTO_CANCEL_UNMATCHED:
          return handleAutoCancel(job.data);

        default:
          logger.warn(`Unknown delivery job: ${job.name}`);
      }
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on('failed', (job, error) => {
    logger.error(`Delivery job failed: ${job.name}`, {
      jobId: job.id,
      error: error.message,
    });
  });

  return worker;
};

/**
 * Broadcast delivery to nearby available riders via Socket.io.
 */
const handleBroadcast = async ({ orderId, pickupLat, pickupLng, fare, distanceKm }) => {
  try {
    // Get the order details
    const order = await prisma.deliveryOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    });

    if (!order || order.status !== 'REQUESTED') {
      logger.info('Skipping broadcast — order not in REQUESTED state', { orderId, status: order?.status });
      return;
    }

    const io = getIO();
    const riderPoolRoom = getRiderPoolRoom();

    // Get all sockets in the rider pool room
    const riderSockets = await io.in(riderPoolRoom).fetchSockets();

    if (riderSockets.length === 0) {
      logger.warn('No available riders in pool', { orderId });
      return;
    }

    logger.info('Broadcasting to riders', { orderId, riderCount: riderSockets.length });

    // Calculate distance from each rider to pickup (if location available in Redis)
    const riderDistances = [];
    for (const socket of riderSockets) {
      const riderLocation = await redis.get(`rider:location:${socket.user.id}`);
      if (riderLocation) {
        const { lat, lng } = JSON.parse(riderLocation);
        const distance = calculateDistance(lat, lng, pickupLat, pickupLng);
        riderDistances.push({ socket, distance });
      } else {
        // No location data, add with large distance
        riderDistances.push({ socket, distance: 999999 });
      }
    }

    // Sort by distance and take top 10
    riderDistances.sort((a, b) => a.distance - b.distance);
    const nearestRiders = riderDistances.slice(0, 10);

    // Emit job to nearest riders
    const jobData = {
      orderId,
      pickup: {
        lat: pickupLat,
        lng: pickupLng,
        address: order.pickupAddress,
      },
      dropoff: {
        lat: order.dropoffLat,
        lng: order.dropoffLng,
        address: order.dropoffAddress,
      },
      fare,
      distanceKm,
      packageSize: order.packageSize,
      itemDescription: order.itemDescription,
      customer: {
        name: `${order.customer.firstName} ${order.customer.lastName}`,
        phone: order.customer.phone,
      },
      expiresAt: Date.now() + 60000, // 60 seconds to accept
    };

    for (const { socket } of nearestRiders) {
      socket.emit(RIDER.NEW_JOB, jobData);
    }

    // Also send push notifications to riders (if we have their FCM tokens)
    const riderUserIds = nearestRiders.map(({ socket }) => socket.user.id);
    const riders = await prisma.rider.findMany({
      where: { userId: { in: riderUserIds } },
      include: { user: { select: { fcmToken: true } } },
    });

    const fcmTokens = riders.map(r => r.user.fcmToken).filter(Boolean);
    if (fcmTokens.length > 0) {
      await notificationService.sendToMultiple(fcmTokens, {
        title: 'New Delivery Job 📦',
        body: `₦${fare.toLocaleString()} • ${distanceKm}km away`,
        data: { type: 'NEW_JOB', orderId },
      });
    }

    logger.info('Job broadcasted to riders', { orderId, riderCount: nearestRiders.length });
  } catch (error) {
    logger.error('Broadcast failed', { orderId, error: error.message });
    throw error;
  }
};

/**
 * Calculate distance between two points using Haversine formula.
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Auto-cancel an unmatched order after timeout.
 */
const handleAutoCancel = async ({ orderId }) => {
  try {
    await deliveryService.updateStatus(orderId, 'CANCELLED', 'system', 'No rider available');
    logger.info('Order auto-cancelled', { orderId });
  } catch (error) {
    logger.error('Auto-cancel failed', { orderId, error: error.message });
  }
};

module.exports = { startDeliveryWorker };
