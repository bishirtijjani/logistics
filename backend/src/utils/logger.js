/**
 * Winston logger configuration.
 *
 * Structured JSON logs in production, colorized console logs in development.
 * All modules should use this logger instead of console.log.
 *
 * USAGE:
 *   const { logger } = require('../utils/logger');
 *   logger.info('User created', { userId: '123' });
 *   logger.error('Payment failed', { error, transactionId });
 */

const winston = require('winston');

const { combine, timestamp, printf, colorize, json } = winston.format;

// Human-readable format for development
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}]: ${message}${metaStr}`;
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { service: 'logistics' },
  transports: [
    // Console transport - always active
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === 'production'
          ? combine(timestamp(), json())
          : combine(colorize(), timestamp({ format: 'HH:mm:ss' }), devFormat),
    }),

    // File transport - errors only, production and staging
    ...(process.env.NODE_ENV !== 'development'
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: combine(timestamp(), json()),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            format: combine(timestamp(), json()),
            maxsize: 5242880,
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});

module.exports = { logger };
