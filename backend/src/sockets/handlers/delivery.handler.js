/**
 * Delivery socket handler — room management and status events.
 *
 * ROOMS:
 * - delivery:{orderId} — both customer and rider join this room
 * - Events in this room: status changes, rider location, completion
 */

const { DELIVERY, getDeliveryRoom, getUserRoom, WALLET } = require('../events');
const { logger } = require('../../utils/logger');

const registerDeliveryHandlers = (io, socket) => {
  /**
   * Join a delivery tracking room.
   * Payload: { orderId: string }
   */
  socket.on(DELIVERY.JOIN_ROOM, (data) => {
    const { orderId } = data;
    if (!orderId) return;

    const room = getDeliveryRoom(orderId);
    socket.join(room);

    logger.debug('Joined delivery room', {
      userId: socket.user.id,
      room,
    });
  });

  /**
   * Leave a delivery tracking room.
   * Payload: { orderId: string }
   */
  socket.on(DELIVERY.LEAVE_ROOM, (data) => {
    const { orderId } = data;
    if (!orderId) return;

    const room = getDeliveryRoom(orderId);
    socket.leave(room);

    logger.debug('Left delivery room', {
      userId: socket.user.id,
      room,
    });
  });
};

// --- Server-side emit helpers (used by services/workers) ---

/**
 * Emit delivery status change to everyone in the delivery room.
 */
const emitStatusChange = (io, orderId, status, metadata = {}) => {
  const room = getDeliveryRoom(orderId);
  io.to(room).emit(DELIVERY.STATUS_CHANGED, {
    orderId,
    status,
    timestamp: Date.now(),
    ...metadata,
  });
};

/**
 * Emit rider assigned event to customer.
 */
const emitRiderAssigned = (io, orderId, customerId, riderInfo) => {
  io.to(getUserRoom(customerId)).emit(DELIVERY.RIDER_ASSIGNED, {
    orderId,
    rider: riderInfo,
    timestamp: Date.now(),
  });
};

/**
 * Emit wallet balance update to a user.
 */
const emitBalanceUpdate = (io, userId, newBalance, transaction) => {
  io.to(getUserRoom(userId)).emit(WALLET.BALANCE_UPDATED, {
    balance: newBalance,
    transaction: {
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
    },
    timestamp: Date.now(),
  });
};

module.exports = {
  registerDeliveryHandlers,
  emitStatusChange,
  emitRiderAssigned,
  emitBalanceUpdate,
};
