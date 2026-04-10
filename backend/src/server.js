/**
 * Server entry point.
 *
 * - Creates HTTP server from Express app
 * - Attaches Socket.io
 * - Initializes Redis connection
 * - Starts BullMQ workers
 * - Listens on configured port
 *
 * This is the ONLY file that calls listen().
 */

const http = require('http');
const { createApp } = require('./app');
const { config } = require('./config');
const { logger } = require('./utils/logger');
const { initializeSocket } = require('./sockets');
const { initializeQueues } = require('./queues');
const { prisma } = require('./config/database');

const start = async () => {
  try {
    // Verify database connection
    await prisma.$connect();
    logger.info('✅ Database connected');

    // Create Express app and HTTP server
    const app = createApp();
    const server = http.createServer(app);

    // Initialize Socket.io
    initializeSocket(server);
    logger.info('✅ Socket.io initialized');

    // Initialize BullMQ workers
    initializeQueues();
    logger.info('✅ Queue workers started');

    // Start listening
    server.listen(config.PORT, () => {
      logger.info(`🚀 ${config.APP_NAME} running on port ${config.PORT}`);
      logger.info(`📍 Environment: ${config.NODE_ENV}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Server closed. Database disconnected.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('❌ Failed to start server', { error: error.message });
    process.exit(1);
  }
};

start();
