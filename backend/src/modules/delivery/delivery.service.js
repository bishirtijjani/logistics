/**
 * Delivery service — delivery lifecycle, pricing, and settlement.
 *
 * RULES:
 * - Status transitions are enforced via DELIVERY_TRANSITIONS map
 * - Settlement (wallet debit/credit) is atomic
 * - Rider matching is handled via Socket broadcast + queue
 */

const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../../config/database');
const { AppError } = require('../../utils/api-error');
const { logger } = require('../../utils/logger');
const { DELIVERY_TRANSITIONS } = require('../../utils/constants');
const { config } = require('../../config');

/**
 * Calculate fare based on distance.
 */
const calculateFare = (distanceKm) => {
  const baseFare = config.DELIVERY_BASE_FARE;
  const perKmRate = config.DELIVERY_PER_KM_RATE;
  const fare = baseFare + distanceKm * perKmRate;
  return Math.ceil(fare / 10) * 10; // Round up to nearest 10
};

/**
 * Estimate delivery fare without creating an order.
 */
const estimateFare = async ({ pickupLat, pickupLng, dropoffLat, dropoffLng }) => {
  // TODO: Use maps.service to get actual road distance
  // For now, use Haversine formula for straight-line distance
  const distanceKm = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const fare = calculateFare(distanceKm);
  const platformFee = Math.ceil((fare * config.DELIVERY_PLATFORM_FEE_PERCENT) / 100);

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    fare,
    platformFee,
    totalCharge: fare,
    riderEarning: fare - platformFee,
  };
};

/**
 * Create a new delivery order.
 */
const createOrder = async (customerId, orderData) => {
  // Check customer has sufficient balance
  const wallet = await prisma.wallet.findUnique({ where: { userId: customerId } });
  if (!wallet) throw AppError.notFound('Wallet not found');

  const estimate = await estimateFare(orderData);

  if (Number(wallet.balance) < estimate.fare) {
    throw AppError.insufficientBalance(
      `Insufficient balance. Delivery costs ₦${estimate.fare}. Balance: ₦${wallet.balance}`
    );
  }

  const order = await prisma.deliveryOrder.create({
    data: {
      customerId,
      pickupAddress: orderData.pickupAddress,
      pickupLat: orderData.pickupLat,
      pickupLng: orderData.pickupLng,
      dropoffAddress: orderData.dropoffAddress,
      dropoffLat: orderData.dropoffLat,
      dropoffLng: orderData.dropoffLng,
      itemDescription: orderData.itemDescription,
      packageSize: orderData.packageSize,
      distanceKm: estimate.distanceKm,
      fare: estimate.fare,
      platformFee: estimate.platformFee,
      status: 'REQUESTED',
    },
  });

  logger.info('Delivery order created', { orderId: order.id, customerId });

  // TODO: Queue rider matching job
  // TODO: Emit socket event for nearby riders

  return order;
};

/**
 * Update delivery status — enforces state machine transitions.
 */
const updateStatus = async (orderId, newStatus, userId, cancellationReason) => {
  const order = await prisma.deliveryOrder.findUnique({
    where: { id: orderId },
    include: { rider: true },
  });

  if (!order) throw AppError.notFound('Delivery order not found');

  // Enforce valid transitions
  const allowedTransitions = DELIVERY_TRANSITIONS[order.status];
  if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
    throw AppError.badRequest(
      `Invalid status transition: ${order.status} → ${newStatus}`
    );
  }

  const updateData = { status: newStatus };

  // Set lifecycle timestamps
  switch (newStatus) {
    case 'MATCHED':
      updateData.matchedAt = new Date();
      break;
    case 'PICKED_UP':
      updateData.pickedUpAt = new Date();
      break;
    case 'DELIVERED':
      updateData.deliveredAt = new Date();
      break;
    case 'CANCELLED':
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = cancellationReason;
      break;
  }

  const updated = await prisma.deliveryOrder.update({
    where: { id: orderId },
    data: updateData,
  });

  logger.info('Delivery status updated', { orderId, from: order.status, to: newStatus });

  // If delivered, trigger settlement
  if (newStatus === 'DELIVERED') {
    // TODO: Queue settlement job
  }

  // TODO: Emit socket event for status change
  // TODO: Send push notification

  return updated;
};

/**
 * Settle delivery — atomic debit customer + credit rider.
 */
const settleDelivery = async (orderId) => {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.deliveryOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: { include: { wallet: true } },
        rider: { include: { user: { include: { wallet: true } } } },
      },
    });

    if (!order) throw AppError.notFound('Order not found');
    if (order.status !== 'DELIVERED') throw AppError.badRequest('Order not in DELIVERED state');
    if (!order.rider) throw AppError.badRequest('No rider assigned');

    const fare = Number(order.fare);
    const platformFee = Number(order.platformFee);
    const riderEarning = fare - platformFee;
    const customerBalance = Number(order.customer.wallet.balance);
    const riderBalance = Number(order.rider.user.wallet.balance);

    if (customerBalance < fare) {
      throw AppError.insufficientBalance();
    }

    const reference = `DEL-${orderId}-${uuidv4().slice(0, 8)}`;

    // Debit customer
    await tx.wallet.update({
      where: { id: order.customer.wallet.id },
      data: { balance: { decrement: fare } },
    });

    // Credit rider (fare minus platform fee)
    await tx.wallet.update({
      where: { id: order.rider.user.wallet.id },
      data: { balance: { increment: riderEarning } },
    });

    // Customer debit transaction
    await tx.transaction.create({
      data: {
        reference: `${reference}-DEBIT`,
        type: 'DELIVERY_PAYMENT',
        status: 'COMPLETED',
        amount: fare,
        fee: 0,
        description: `Delivery payment for order ${orderId}`,
        debitWalletId: order.customer.wallet.id,
        balanceBefore: customerBalance,
        balanceAfter: customerBalance - fare,
      },
    });

    // Rider credit transaction
    await tx.transaction.create({
      data: {
        reference: `${reference}-CREDIT`,
        type: 'DELIVERY_EARNING',
        status: 'COMPLETED',
        amount: riderEarning,
        fee: platformFee,
        description: `Delivery earning for order ${orderId}`,
        creditWalletId: order.rider.user.wallet.id,
        balanceBefore: riderBalance,
        balanceAfter: riderBalance + riderEarning,
      },
    });

    // Update order to SETTLED
    await tx.deliveryOrder.update({
      where: { id: orderId },
      data: { status: 'SETTLED', settledAt: new Date(), transactionId: reference },
    });

    // Update rider stats
    await tx.rider.update({
      where: { id: order.rider.id },
      data: {
        totalDeliveries: { increment: 1 },
        totalEarnings: { increment: riderEarning },
      },
    });

    return { fare, platformFee, riderEarning, reference };
  });

  logger.info('Delivery settled', { orderId, ...result });

  return result;
};

/**
 * Rate a completed delivery.
 */
const rateDelivery = async (orderId, customerId, { score, comment }) => {
  const order = await prisma.deliveryOrder.findUnique({ where: { id: orderId } });

  if (!order) throw AppError.notFound('Order not found');
  if (order.customerId !== customerId) throw AppError.forbidden('Not your order');
  if (!['DELIVERED', 'SETTLED'].includes(order.status)) {
    throw AppError.badRequest('Can only rate completed deliveries');
  }
  if (!order.riderId) throw AppError.badRequest('No rider to rate');

  const existing = await prisma.rating.findUnique({ where: { deliveryOrderId: orderId } });
  if (existing) throw AppError.conflict('Already rated');

  const rating = await prisma.rating.create({
    data: {
      deliveryOrderId: orderId,
      riderId: order.riderId,
      customerId,
      score,
      comment,
    },
  });

  // Update rider average rating
  const ratings = await prisma.rating.aggregate({
    where: { riderId: order.riderId },
    _avg: { score: true },
  });

  await prisma.rider.update({
    where: { id: order.riderId },
    data: { averageRating: ratings._avg.score || 0 },
  });

  return rating;
};

/**
 * Get delivery orders for a user (customer or rider).
 */
const getOrders = async (userId, role, { page, limit, status }) => {
  const where = {
    ...(role === 'CUSTOMER' ? { customerId: userId } : {}),
    ...(role === 'RIDER'
      ? { rider: { userId } }
      : {}),
    ...(status && { status }),
  };

  const [orders, total] = await Promise.all([
    prisma.deliveryOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        rating: true,
        rider: { select: { id: true, vehicleType: true, plateNumber: true, averageRating: true } },
      },
    }),
    prisma.deliveryOrder.count({ where }),
  ]);

  return { orders, total, page, limit };
};

/**
 * Get a single order by ID with authorization.
 */
const getOrderById = async (orderId, userId, role) => {
  const order = await prisma.deliveryOrder.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { id: true, phone: true, firstName: true, lastName: true } },
      rider: {
        select: {
          id: true,
          vehicleType: true,
          plateNumber: true,
          vehicleColor: true,
          averageRating: true,
          user: { select: { phone: true, firstName: true, lastName: true } },
        },
      },
      rating: true,
    },
  });

  if (!order) throw AppError.notFound('Delivery order not found');

  // Authorization: customers see their own, riders see assigned, admins see all
  if (role === 'CUSTOMER' && order.customerId !== userId) {
    throw AppError.forbidden('Not your order');
  }
  if (role === 'RIDER' && order.rider?.userId !== userId) {
    throw AppError.forbidden('Not your assigned order');
  }

  return order;
};

// --- Haversine helper ---
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

module.exports = {
  estimateFare,
  createOrder,
  updateStatus,
  settleDelivery,
  rateDelivery,
  getOrders,
  getOrderById,
};
