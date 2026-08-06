/**
 * Request socket handler - unified request architecture.
 *
 * ROOMS:
 * - request:{requestId} - customer, merchant, and rider join this room
 * - merchant:{merchantId} - merchant-specific room for new orders
 * - Events in request room: status changes, rider location, completion
 *
 * Chat (request_messages) does NOT use the request room - each message is a
 * private 1:1 thread between one pair of stakeholders, delivered straight to
 * each participant's personal user:{userId} room instead (see postMessage in
 * request.service.js), so the third stakeholder never receives it even at
 * the transport layer.
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

  /**
   * Rider reports physical arrival at pickup/dropoff. Relayed to the request
   * room so the customer can show a transient "Rider has arrived" banner -
   * there is no persisted ARRIVED status, so this never touches the DB.
   * Payload: { requestId: string, phase: 'pickup' | 'dropoff' }
   */
  socket.on(REQUEST.RIDER_ARRIVED, (data) => {
    const { requestId, phase } = data || {};
    if (!requestId) return;

    const room = getRequestRoom(requestId);
    socket.to(room).emit(REQUEST.RIDER_ARRIVED, {
      requestId,
      phase: phase === 'pickup' ? 'pickup' : 'dropoff',
      timestamp: Date.now(),
    });

    logger.debug('Rider arrival broadcasted', { requestId, phase, riderId: socket.user.id });
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
const emitStatusChanged = (io, requestId, status, metadata = {}, merchantId = null) => {
  const payload = {
    requestId,
    status,
    timestamp: Date.now(),
    ...metadata,
  };
  io.to(getRequestRoom(requestId)).emit(REQUEST.STATUS_CHANGED, payload);
  // Also fan out to the merchant's room. The merchant dashboard's socket only
  // joins the merchant room (never per-request rooms), so without this its
  // order list/detail never sees rider-driven progress (PICKED_UP → IN_TRANSIT
  // → DELIVERED) and stays frozen at whatever status the merchant last set.
  if (merchantId) {
    io.to(getMerchantRoom(merchantId)).emit(REQUEST.STATUS_CHANGED, payload);
  }
  logger.info('REQUEST.STATUS_CHANGED emitted', { requestId, status, merchantId: merchantId || undefined });
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
 * Sends to customer's personal room and request room. Always carries `status`
 * so the mobile reducer (which merges socket payloads into currentRequest)
 * doesn't lag behind the canonical status - fixes the "rider found but
 * UI still shows Searching" gap.
 */
const emitRiderAssigned = (io, requestId, customerId, riderInfo) => {
  const room = getRequestRoom(requestId);
  const payload = {
    requestId,
    status: 'RIDER_ASSIGNED',
    rider: riderInfo,
    timestamp: Date.now(),
  };
  io.to(room).emit(REQUEST.RIDER_ASSIGNED, payload);
  io.to(getUserRoom(customerId)).emit(REQUEST.RIDER_ASSIGNED, payload);
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
    status: 'SETTLED',
    timestamp: Date.now(),
  });
  logger.info('REQUEST.COMPLETED emitted', { requestId });
};

/**
 * Emit REQUEST.CANCELLED when request is cancelled.
 * Sends to request room and customer. Includes `status: 'CANCELLED'` and the
 * optional `cancellationFee` so the customer's tracking screen can flip
 * immediately without a round-trip refetch.
 */
const emitCancelled = (io, requestId, customerId, reason, extras = {}) => {
  const room = getRequestRoom(requestId);
  const payload = {
    requestId,
    status: 'CANCELLED',
    reason,
    timestamp: Date.now(),
    ...extras, // e.g. { cancellationFee }
  };
  io.to(room).emit(REQUEST.CANCELLED, payload);
  io.to(getUserRoom(customerId)).emit(REQUEST.CANCELLED, payload);
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
