/**
 * Socket.io client for the mobile app.
 *
 * Manages connection lifecycle and exposes event listeners.
 * Import this in screens that need real-time updates.
 */

// const { io } = require('socket.io-client');

const SOCKET_URL = 'http://localhost:3000';

let socket = null;

/**
 * Connect to Socket.io server with JWT token.
 */
const connect = (token) => {
  // TODO: Uncomment when socket.io-client is installed
  // socket = io(SOCKET_URL, {
  //   auth: { token },
  //   reconnection: true,
  //   reconnectionAttempts: 10,
  //   reconnectionDelay: 1000,
  //   reconnectionDelayMax: 30000,
  //   transports: ['websocket'],
  // });

  // socket.on('connect', () => {
  //   console.log('Socket connected:', socket.id);
  // });

  // socket.on('disconnect', (reason) => {
  //   console.log('Socket disconnected:', reason);
  // });

  // socket.on('connect_error', (error) => {
  //   console.error('Socket connection error:', error.message);
  // });

  return socket;
};

/**
 * Disconnect from Socket.io server.
 */
const disconnect = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Get the active socket instance.
 */
const getSocket = () => socket;

/**
 * Join a delivery tracking room.
 */
const joinDeliveryRoom = (orderId) => {
  if (socket) {
    socket.emit('delivery:room:join', { orderId });
  }
};

/**
 * Leave a delivery tracking room.
 */
const leaveDeliveryRoom = (orderId) => {
  if (socket) {
    socket.emit('delivery:room:leave', { orderId });
  }
};

/**
 * Listen for rider location broadcasts.
 */
const onRiderLocation = (callback) => {
  if (socket) {
    socket.on('rider:location:broadcast', callback);
  }
};

/**
 * Listen for delivery status changes.
 */
const onDeliveryStatusChanged = (callback) => {
  if (socket) {
    socket.on('delivery:status:changed', callback);
  }
};

/**
 * Listen for wallet balance updates.
 */
const onBalanceUpdated = (callback) => {
  if (socket) {
    socket.on('wallet:balance:updated', callback);
  }
};

module.exports = {
  connect,
  disconnect,
  getSocket,
  joinDeliveryRoom,
  leaveDeliveryRoom,
  onRiderLocation,
  onDeliveryStatusChanged,
  onBalanceUpdated,
};
