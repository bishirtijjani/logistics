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
   * Standard error response. `code` is a stable i18n key the mobile client
   * uses to look up the localized copy; `message` is the English fallback
   * served when no translation exists.
   * @param {string} message
   * @param {any} [errors] - Validation errors or additional context
   * @param {string} [code] - Stable error code (e.g. 'INSUFFICIENT_BALANCE')
   * @returns {object}
   */
  static error(message, errors = null, code = null) {
    return {
      success: false,
      message,
      data: null,
      ...(code && { code }),
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
