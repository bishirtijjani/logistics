/**
 * Global error handling middleware.
 *
 * This is the LAST middleware in the Express chain.
 * It catches all errors — operational (AppError) and unexpected.
 *
 * - Operational errors: sent to client with original message and status
 * - Prisma errors: translated to user-friendly messages
 * - Unexpected errors: logged, client gets generic 500
 *
 * NEVER send stack traces or internal details to the client in production.
 */

const { AppError } = require('../utils/api-error');
const { ApiResponse } = require('../utils/api-response');
const { logger } = require('../utils/logger');

/**
 * Translates Prisma-specific errors into AppErrors.
 * @param {Error} error
 * @returns {AppError}
 */
const handlePrismaError = (error) => {
  switch (error.code) {
    case 'P2002': {
      // Unique constraint violation
      const field = error.meta?.target?.join(', ') || 'field';
      return AppError.conflict(`A record with this ${field} already exists`);
    }
    case 'P2003':
      // Foreign key constraint failure
      return AppError.badRequest('Related record not found');
    case 'P2025':
      // Record not found
      return AppError.notFound('Record not found');
    case 'P2014':
      // Required relation violation
      return AppError.badRequest('Required relation violation');
    default:
      logger.error('Unhandled Prisma error', { code: error.code, meta: error.meta });
      return AppError.internal('Database operation failed');
  }
};

/**
 * Global error handler — must have 4 parameters for Express to recognize it.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let error = err;

  // Handle Prisma errors
  if (error.code && error.code.startsWith('P')) {
    error = handlePrismaError(error);
  }

  // Handle JWT errors not caught by auth middleware
  if (error.name === 'JsonWebTokenError') {
    error = AppError.unauthorized('Invalid token');
  }
  if (error.name === 'TokenExpiredError') {
    error = AppError.unauthorized('Token expired');
  }

  // Handle Zod validation errors (if thrown directly)
  if (error.name === 'ZodError') {
    const errors = error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    error = AppError.badRequest('Validation failed', errors);
  }

  // Default to 500 for unexpected errors
  const statusCode = error.statusCode || 500;
  const isOperational = error.isOperational || false;

  // Log all errors; full stack for unexpected ones
  if (!isOperational) {
    logger.error('UNEXPECTED ERROR', {
      message: error.message,
      stack: error.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  } else {
    logger.warn('Operational error', {
      message: error.message,
      statusCode,
      url: req.originalUrl,
    });
  }

  // Send response
  res.status(statusCode).json(
    ApiResponse.error(
      isOperational ? error.message : 'Something went wrong',
      error.errors || null
    )
  );
};

module.exports = { errorHandler };
