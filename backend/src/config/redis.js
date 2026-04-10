/**
 * Redis client singleton.
 *
 * NEVER instantiate Redis anywhere else.
 * Always import from this file:
 *   const { redis } = require('../config/redis');
 */

const Redis = require('ioredis');
const { config } = require('./index');
const { logger } = require('../utils/logger');

const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  retryStrategy: (times) => {
    if (times > 3) {
      logger.error('Redis connection failed after 3 retries');
      return null; // Stop retrying
    }
    return Math.min(times * 200, 2000);
  },
});

redis.on('connect', () => logger.info('✅ Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { error: err.message }));

module.exports = { redis };
