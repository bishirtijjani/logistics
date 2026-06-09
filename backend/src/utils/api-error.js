/**
 * Custom application error class.
 *
 * Every error carries a stable string `code` alongside the human-readable
 * `message`. Mobile clients use `code` as the i18n key for the localized
 * copy and fall back to the server `message` when no translation exists.
 *
 * Backwards-compatible: legacy call sites that pass `(message, errorsArray)`
 * keep working - the factories auto-detect the shape and apply a sensible
 * default code derived from the HTTP status.
 *
 * USAGE:
 *   throw AppError.badRequest('Quote has expired');                                 // code → BAD_REQUEST
 *   throw AppError.badRequest('Quote has expired', { code: 'QUOTE_EXPIRED' });      // code → QUOTE_EXPIRED
 *   throw AppError.badRequest('Validation failed', { code: 'VALIDATION_FAILED', errors });
 *   throw AppError.insufficientBalance('Need ₦500');                                // code → INSUFFICIENT_BALANCE
 *
 * All defined codes live in `./error-codes.js`. The mobile i18n catalog must
 * have a matching `errors.<CODE>` entry; missing keys fall back to the
 * server-supplied `message`.
 */

const DEFAULT_CODES = Object.freeze({
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
});

/**
 * Normalize the 2nd factory argument so old `(message, errorsArray)` and new
 * `(message, { code, errors })` shapes both work. Anything that's an array
 * or null is treated as legacy errors; an object is the new options bag.
 */
const normalizeOpts = (opts, fallbackCode) => {
  if (opts == null) return { code: fallbackCode, errors: null };
  if (Array.isArray(opts)) return { code: fallbackCode, errors: opts };
  if (typeof opts === 'object') {
    return {
      code: opts.code || fallbackCode,
      errors: opts.errors || null,
    };
  }
  return { code: fallbackCode, errors: null };
};

class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code
   * @param {boolean} [isOperational=true] - Whether this is a trusted, expected error
   * @param {any} [errors=null] - Additional error details (validation errors, etc.)
   * @param {string} [code] - Stable i18n key. Defaults to status-derived code.
   */
  constructor(message, statusCode, isOperational = true, errors = null, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    this.code = code || DEFAULT_CODES[statusCode] || 'UNKNOWN_ERROR';
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Chainable code override. Useful when a factory's default code is too
   * generic for the throw site:
   *
   *   throw AppError.badRequest('Quote expired').withCode('QUOTE_EXPIRED');
   */
  withCode(code) {
    this.code = code;
    return this;
  }

  // --- Factory methods for common error types ---

  static badRequest(message = 'Bad request', opts = null) {
    const { code, errors } = normalizeOpts(opts, 'BAD_REQUEST');
    return new AppError(message, 400, true, errors, code);
  }

  static unauthorized(message = 'Unauthorized', opts = null) {
    const { code, errors } = normalizeOpts(opts, 'UNAUTHORIZED');
    return new AppError(message, 401, true, errors, code);
  }

  static forbidden(message = 'Forbidden', opts = null) {
    const { code, errors } = normalizeOpts(opts, 'FORBIDDEN');
    return new AppError(message, 403, true, errors, code);
  }

  static notFound(message = 'Resource not found', opts = null) {
    const { code, errors } = normalizeOpts(opts, 'NOT_FOUND');
    return new AppError(message, 404, true, errors, code);
  }

  static conflict(message = 'Conflict', opts = null) {
    const { code, errors } = normalizeOpts(opts, 'CONFLICT');
    return new AppError(message, 409, true, errors, code);
  }

  static tooManyRequests(message = 'Too many requests', opts = null) {
    const { code, errors } = normalizeOpts(opts, 'TOO_MANY_REQUESTS');
    return new AppError(message, 429, true, errors, code);
  }

  static internal(message = 'Internal server error', opts = null) {
    const { code, errors } = normalizeOpts(opts, 'INTERNAL_ERROR');
    return new AppError(message, 500, false, errors, code);
  }

  static serviceUnavailable(message = 'Service unavailable', opts = null) {
    const { code, errors } = normalizeOpts(opts, 'SERVICE_UNAVAILABLE');
    return new AppError(message, 503, true, errors, code);
  }

  // --- Domain-specific factories with named codes ---

  static insufficientBalance(message = 'Insufficient wallet balance') {
    return new AppError(message, 400, true, null, 'INSUFFICIENT_BALANCE');
  }

  static invalidPin(message = 'Invalid transaction PIN') {
    return new AppError(message, 401, true, null, 'INVALID_PIN');
  }

  static duplicateTransaction(message = 'Duplicate transaction detected') {
    return new AppError(message, 409, true, null, 'DUPLICATE_TRANSACTION');
  }

  static create(statusCode, message) {
    return new AppError(message, statusCode);
  }
}

module.exports = { AppError, DEFAULT_CODES };
