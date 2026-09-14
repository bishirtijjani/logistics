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
redis.on('error', (err) => {
  const msg = err.message || '';
  if (/WRONGPASS|invalid username|NOAUTH|AUTH.*fail/i.test(msg)) {
    // The 2026-09-13 incident: a wrong Redis password went unnoticed for hours
    // while BullMQ silently failed to enqueue payouts (customers debited then
    // auto-refunded, no alert fired). An AUTH failure is a config bug, not a
    // blip - scream so it cannot go dark again.
    logger.error('REDIS AUTH FAILURE: wrong username/password. Payment-queue jobs will fail to enqueue and withdrawals will be debited then refunded. Verify REDIS_PASSWORD/REDIS_URL in the app .env against the shared stack (redis starts with --requirepass).', { error: msg });
  } else {
    logger.error('Redis error', { error: msg });
  }
});

module.exports = { redis };
