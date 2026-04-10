/**
 * Standardized API response builders.
 *
 * Every API response from this platform follows the same envelope:
 * {
 *   success: boolean,
 *   message: string,
 *   data: any | null,
 *   meta?: { page, limit, total }
 * }
 *
 * USAGE:
 *   const { ApiResponse } = require('../utils/api-response');
 *   res.status(200).json(ApiResponse.success('User created', { user }));
 */

class ApiResponse {
  /**
   * Standard success response.
   * @param {string} message
   * @param {any} data
   * @param {object} [meta] - Pagination metadata
   * @returns {object}
   */
  static success(message, data = null, meta = undefined) {
    return {
      success: true,
      message,
      data,
      ...(meta && { meta }),
    };
  }

  /**
   * Standard error response.
   * @param {string} message
   * @param {any} [errors] - Validation errors or additional context
   * @returns {object}
   */
  static error(message, errors = null) {
    return {
      success: false,
      message,
      data: null,
      ...(errors && { errors }),
    };
  }

  /**
   * Paginated success response.
   * @param {string} message
   * @param {any[]} data
   * @param {number} page
   * @param {number} limit
   * @param {number} total
   * @returns {object}
   */
  static paginated(message, data, page, limit, total) {
    return {
      success: true,
      message,
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

module.exports = { ApiResponse };
