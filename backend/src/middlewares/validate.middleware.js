/**
 * Zod validation middleware factory.
 *
 * Validates request body, query, or params against a Zod schema.
 * Returns standardized 400 error with field-level details on failure.
 *
 * USAGE:
 *   const { validate } = require('../middlewares/validate.middleware');
 *   const { createRequestSchema } = require('../modules/request/request.validator');
 *   router.post('/requests', authenticate, validate(createRequestSchema), controller.create);
 *
 *   // Validate query params:
 *   router.get('/orders', authenticate, validate(listSchema, 'query'), controller.list);
 */

const { AppError } = require('../utils/api-error');

/**
 * Creates a validation middleware for the given Zod schema.
 * @param {import('zod').ZodSchema} schema - Zod schema to validate against
 * @param {'body' | 'query' | 'params'} source - Which part of the request to validate
 * @returns {Function} Express middleware
 */
const validate = (schema, source = 'body') => {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      // Tag as VALIDATION_FAILED so mobile shows form-level copy ("Please
      // check the highlighted fields") instead of the generic BAD_REQUEST.
      return next(AppError.badRequest('Validation failed', { code: 'VALIDATION_FAILED', errors }));
    }

    // Replace source with parsed (and transformed) data
    req[source] = result.data;
    next();
  };
};

module.exports = { validate };
