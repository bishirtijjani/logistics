/**
 * Request socket handler — unified request architecture.
 *
 * ROOMS:
 * - request:{requestId} — customer, provider, and rider join this room
 * - provider:{providerId} — provider-specific room for new orders
 * - Events in request room: status changes, rider location, completion
 */

const { REQUEST, getRequestRoom, getProviderRoom, getUserRoom } = require('../events');
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
   * Join provider room to receive new order notifications.
   * Payload: { providerId: string }
   */
  socket.on(REQUEST.JOIN_PROVIDER_ROOM, (data) => {
    const { providerId } = data;
    if (!providerId) return;

    const room = getProviderRoom(providerId);
    socket.join(room);

    logger.debug('Joined provider room', {
      userId: socket.user.id,
      role: socket.user.role,
      room,
    });
  });

  /**
   * Leave provider room.
   * Payload: { providerId: string }
   */
  socket.on(REQUEST.LEAVE_PROVIDER_ROOM, (data) => {
    const { providerId } = data;
    if (!providerId) return;

    const room = getProviderRoom(providerId);
    socket.leave(room);

    logger.debug('Left provider room', {
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
 * Sends to provider room if has provider, or rider pool if no provider.
 */
const emitRequestCreated = (io, request) => {
  if (request.providerId) {
    // Send to provider room for provider acceptance
    const providerRoom = getProviderRoom(request.providerId);
    io.to(providerRoom).emit(REQUEST.CREATED, {
      requestId: request.id,
      type: request.type,
      customerId: request.customerId,
      providerId: request.providerId,
      items: request.items,
      total: Number(request.total),
      pickupAddress: request.pickupAddress,
      dropoffAddress: request.dropoffAddress,
      createdAt: request.createdAt,
    });
    logger.info('REQUEST.CREATED emitted to provider', { requestId: request.id, providerId: request.providerId });
  } else {
    // Send to rider pool for direct matching (package delivery)
    logger.info('REQUEST.CREATED - no provider, rider matching via queue', { requestId: request.id });
  }
};

/**
 * Emit REQUEST.STATUS_CHANGED on status updates.
 * Sends to request room (customer, provider, rider).
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
 * Emit REQUEST.PROVIDER_ACCEPTED when provider accepts order.
 * Sends to customer's personal room.
 */
const emitProviderAccepted = (io, requestId, customerId, providerInfo) => {
  io.to(getUserRoom(customerId)).emit(REQUEST.PROVIDER_ACCEPTED, {
    requestId,
    provider: providerInfo,
    timestamp: Date.now(),
  });
  logger.info('REQUEST.PROVIDER_ACCEPTED emitted', { requestId, customerId });
};

/**
 * Emit REQUEST.PROVIDER_READY when provider marks order ready.
 * Sends to request room and customer.
 */
const emitProviderReady = (io, requestId, customerId) => {
  const room = getRequestRoom(requestId);
  io.to(room).emit(REQUEST.PROVIDER_READY, {
    requestId,
    timestamp: Date.now(),
  });
  io.to(getUserRoom(customerId)).emit(REQUEST.PROVIDER_READY, {
    requestId,
    timestamp: Date.now(),
  });
  logger.info('REQUEST.PROVIDER_READY emitted', { requestId });
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
  emitProviderAccepted,
  emitProviderReady,
  emitRiderAssigned,
  emitCompleted,
  emitCancelled,
};
