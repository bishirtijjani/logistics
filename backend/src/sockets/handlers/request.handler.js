/**
 * Request socket handler — unified request architecture.
 *
 * ROOMS:
 * - request:{requestId} — customer, merchant, and rider join this room
 * - merchant:{merchantId} — merchant-specific room for new orders
 * - Events in request room: status changes, rider location, completion
 */

const { REQUEST, getRequestRoom, getMerchantRoom, getUserRoom } = require('../events');
const { logger } = require('../../utils/logger');

const registerRequestHandlers = (io, socket) => {
  /**
   * Join a request tracking room.
   * Payload: { requestId: string }
   */
  socket.on(REQUEST.JOIN_ROOM, (data) => {
    const { requestId } = data;
    if (!requestId) return;

    const room = getRequestRoom(requestId);
    socket.join(room);

    logger.debug('Joined request room', {
      userId: socket.user.id,
      role: socket.user.role,
      room,
    });
  });

  /**
   * Leave a request tracking room.
   * Payload: { requestId: string }
   */
  socket.on(REQUEST.LEAVE_ROOM, (data) => {
    const { requestId } = data;
    if (!requestId) return;

    const room = getRequestRoom(requestId);
    socket.leave(room);

    logger.debug('Left request room', {
      userId: socket.user.id,
      role: socket.user.role,
      room,
    });
  });

  /**
   * Join merchant room to receive new order notifications.
   * Payload: { merchantId: string }
   */
  socket.on(REQUEST.JOIN_MERCHANT_ROOM, (data) => {
    const { merchantId } = data;
    if (!merchantId) return;

    const room = getMerchantRoom(merchantId);
    socket.join(room);

    logger.debug('Joined merchant room', {
      userId: socket.user.id,
      role: socket.user.role,
      room,
    });
  });

  /**
   * Leave merchant room.
   * Payload: { merchantId: string }
   */
  socket.on(REQUEST.LEAVE_MERCHANT_ROOM, (data) => {
    const { merchantId } = data;
    if (!merchantId) return;

    const room = getMerchantRoom(merchantId);
    socket.leave(room);

    logger.debug('Left merchant room', {
      userId: socket.user.id,
      role: socket.user.role,
      room,
    });
  });

  /**
   * Broadcast rider location during delivery.
   * Payload: { requestId: string, lat: number, lng: number }
   */
  socket.on(REQUEST.RIDER_LOCATION, (data) => {
    const { requestId, lat, lng } = data;
    if (!requestId || !lat || !lng) return;

    const room = getRequestRoom(requestId);
    socket.to(room).emit(REQUEST.RIDER_LOCATION, {
      requestId,
      lat,
      lng,
      timestamp: Date.now(),
    });

    logger.debug('Rider location broadcasted', {
      requestId,
      lat,
      lng,
      riderId: socket.user.id,
    });
  });
};

// --- Server-side emit helpers (used by services/workers) ---

/**
 * Emit REQUEST.CREATED when a new request is created.
 * Sends to merchant room if has merchant, or rider pool if no merchant.
 */
const emitRequestCreated = (io, request) => {
  if (request.merchantId) {
    // Send to merchant room for merchant acceptance
    const merchantRoom = getMerchantRoom(request.merchantId);
    io.to(merchantRoom).emit(REQUEST.CREATED, {
      requestId: request.id,
      type: request.type,
      customerId: request.customerId,
      merchantId: request.merchantId,
      items: request.items,
      total: Number(request.total),
      pickupAddress: request.pickupAddress,
      dropoffAddress: request.dropoffAddress,
      createdAt: request.createdAt,
    });
    logger.info('REQUEST.CREATED emitted to merchant', { requestId: request.id, merchantId: request.merchantId });
  } else {
    // Send to rider pool for direct matching (package delivery)
    logger.info('REQUEST.CREATED - no merchant, rider matching via queue', { requestId: request.id });
  }
};

/**
 * Emit REQUEST.STATUS_CHANGED on status updates.
 * Sends to request room (customer, merchant, rider).
 */
const emitStatusChanged = (io, requestId, status, metadata = {}) => {
  const room = getRequestRoom(requestId);
  io.to(room).emit(REQUEST.STATUS_CHANGED, {
    requestId,
    status,
    timestamp: Date.now(),
    ...metadata,
  });
  logger.info('REQUEST.STATUS_CHANGED emitted', { requestId, status });
};

/**
 * Emit REQUEST.MERCHANT_ACCEPTED when merchant accepts order.
 * Sends to customer's personal room.
 */
const emitMerchantAccepted = (io, requestId, customerId, merchantInfo) => {
  io.to(getUserRoom(customerId)).emit(REQUEST.MERCHANT_ACCEPTED, {
    requestId,
    merchant: merchantInfo,
    timestamp: Date.now(),
  });
  logger.info('REQUEST.MERCHANT_ACCEPTED emitted', { requestId, customerId });
};

/**
 * Emit REQUEST.MERCHANT_READY when merchant marks order ready.
 * Sends to request room and customer.
 */
const emitMerchantReady = (io, requestId, customerId) => {
  const room = getRequestRoom(requestId);
  io.to(room).emit(REQUEST.MERCHANT_READY, {
    requestId,
    timestamp: Date.now(),
  });
  io.to(getUserRoom(customerId)).emit(REQUEST.MERCHANT_READY, {
    requestId,
    timestamp: Date.now(),
  });
  logger.info('REQUEST.MERCHANT_READY emitted', { requestId });
};

/**
 * Emit REQUEST.RIDER_ASSIGNED when rider is assigned.
 * Sends to customer's personal room and request room.
 */
const emitRiderAssigned = (io, requestId, customerId, riderInfo) => {
  const room = getRequestRoom(requestId);
  io.to(room).emit(REQUEST.RIDER_ASSIGNED, {
    requestId,
    rider: riderInfo,
    timestamp: Date.now(),
  });
  io.to(getUserRoom(customerId)).emit(REQUEST.RIDER_ASSIGNED, {
    requestId,
    rider: riderInfo,
    timestamp: Date.now(),
  });
  logger.info('REQUEST.RIDER_ASSIGNED emitted', { requestId, customerId });
};

/**
 * Emit REQUEST.COMPLETED when delivery is complete.
 * Sends to request room (all parties).
 */
const emitCompleted = (io, requestId) => {
  const room = getRequestRoom(requestId);
  io.to(room).emit(REQUEST.COMPLETED, {
    requestId,
    timestamp: Date.now(),
  });
  logger.info('REQUEST.COMPLETED emitted', { requestId });
};

/**
 * Emit REQUEST.CANCELLED when request is cancelled.
 * Sends to request room and customer.
 */
const emitCancelled = (io, requestId, customerId, reason) => {
  const room = getRequestRoom(requestId);
  io.to(room).emit(REQUEST.CANCELLED, {
    requestId,
    reason,
    timestamp: Date.now(),
  });
  io.to(getUserRoom(customerId)).emit(REQUEST.CANCELLED, {
    requestId,
    reason,
    timestamp: Date.now(),
  });
  logger.info('REQUEST.CANCELLED emitted', { requestId, reason });
};

module.exports = {
  registerRequestHandlers,
  emitRequestCreated,
  emitStatusChanged,
  emitMerchantAccepted,
  emitMerchantReady,
  emitRiderAssigned,
  emitCompleted,
  emitCancelled,
};
