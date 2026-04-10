/**
 * Custom application error class.
 *
 * Extends Error with HTTP status codes and operational flag.
 * Only operational errors are sent to the client.
 * Programming errors trigger a generic 500 response.
 *
 * USAGE:
 *   const { AppError } = require('../utils/api-error');
 *   throw new AppError('Insufficient balance', 400);
 *   throw AppError.notFound('User not found');
 */

class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code
   * @param {boolean} [isOperational=true] - Whether this is a trusted, expected error
   * @param {any} [errors=null] - Additional error details (validation errors, etc.)
   */
  constructor(message, statusCode, isOperational = true, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }

  // --- Factory methods for common error types ---

  static badRequest(message = 'Bad request', errors = null) {
    return new AppError(message, 400, true, errors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new AppError(message, 401);
  }

  static forbidden(message = 'Forbidden') {
    return new AppError(message, 403);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, 404);
  }

  static conflict(message = 'Conflict') {
    return new AppError(message, 409);
  }

  static tooManyRequests(message = 'Too many requests') {
    return new AppError(message, 429);
  }

  static internal(message = 'Internal server error') {
    return new AppError(message, 500, false);
  }

  static insufficientBalance(message = 'Insufficient wallet balance') {
    return new AppError(message, 400);
  }

  static invalidPin(message = 'Invalid transaction PIN') {
    return new AppError(message, 401);
  }

  static duplicateTransaction(message = 'Duplicate transaction detected') {
    return new AppError(message, 409);
  }
}

module.exports = { AppError };
