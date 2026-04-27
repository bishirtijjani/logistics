/**
 * Socket.io initialization and connection management.
 *
 * ARCHITECTURE:
 * - Auth: JWT token verified on connection handshake
 * - Rooms: Each user joins their personal room (user:{userId})
 * - Rooms: Riders join rider pool room when online
 * - Rooms: Both parties join delivery room during active delivery
 * - Handlers: Separate files for tracking and delivery events
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { CONNECTION, getUserRoom, getRiderPoolRoom } = require('./events');
const { registerTrackingHandlers } = require('./handlers/tracking.handler');
const { registerDeliveryHandlers } = require('./handlers/delivery.handler');
const { registerRequestHandlers } = require('./handlers/request.handler');

let io = null;

/**
 * Initialize Socket.io on the HTTP server.
 */
const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Restrict in production
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // --- Authentication middleware ---
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);
      socket.user = {
        id: decoded.id,
        role: decoded.role,
        phone: decoded.phone,
      };

      next();
    } catch (error) {
      logger.warn('Socket auth failed', { error: error.message });
      next(new Error('Invalid token'));
    }
  });

  // --- Connection handler ---
  io.on(CONNECTION.CONNECT, (socket) => {
    const { id, role } = socket.user;

    logger.info('Socket connected', { userId: id, role, socketId: socket.id });

    // Join personal room (for wallet updates, notifications)
    socket.join(getUserRoom(id));

    // If rider, join the available riders pool
    if (role === 'RIDER') {
      socket.join(getRiderPoolRoom());
    }

    // Register event handlers
    registerTrackingHandlers(io, socket);
    registerDeliveryHandlers(io, socket);
    registerRequestHandlers(io, socket);

    // --- Disconnect ---
    socket.on(CONNECTION.DISCONNECT, (reason) => {
      logger.info('Socket disconnected', { userId: id, reason });
    });

    // --- Error ---
    socket.on('error', (error) => {
      logger.error('Socket error', { userId: id, error: error.message });
    });
  });

  logger.info('Socket.io server initialized');

  return io;
};

/**
 * Get the Socket.io server instance.
 * Use this in services/controllers to emit events.
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = { initializeSocket, getIO };
