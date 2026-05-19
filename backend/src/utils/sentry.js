/**
 * Sentry wrapper — thin façade over `@sentry/node` so the rest of the codebase
 * imports a single helper instead of the SDK directly. Lets us:
 *   - No-op cleanly when SENTRY_DSN is missing (dev + CI never need an account)
 *   - Swap the SDK or add wrapping logic in exactly one place
 *   - Strip / mask PII consistently
 *
 * USAGE:
 *   const { initSentry, captureError, requestHandler, errorHandler, withScope }
 *     = require('./utils/sentry');
 *
 *   initSentry();              // once at boot, before app.listen()
 *   captureError(err, { ... }); // anywhere — survives no-op when disabled
 *
 * Why this exists separate from the Winston `logger`:
 *   - Winston handles WHAT happened (structured local + file logs)
 *   - Sentry handles WHO is affected (real users, real stack traces, alerts)
 *   - They overlap, but Sentry's grouping + alerting are not something Winston
 *     can replace. Both stay.
 */

const Sentry = require('@sentry/node');
const { config } = require('../config');

let _initialized = false;

/**
 * Initialize Sentry. Safe to call multiple times (subsequent calls no-op).
 * Returns true when the SDK was actually wired up, false in dev-without-DSN
 * mode (so callers can branch on "is Sentry live?" when needed).
 */
const initSentry = () => {
  if (_initialized) return Boolean(config.SENTRY_DSN);
  _initialized = true;

  if (!config.SENTRY_DSN) {
    // Dev / CI / first-time setup before a DSN is provisioned — leave the
    // SDK uninitialised. captureError() below routes to logger.warn() so
    // we don't lose the signal entirely.
    return false;
  }

  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.SENTRY_ENVIRONMENT || config.NODE_ENV,
    release: config.SENTRY_RELEASE || undefined,
    tracesSampleRate: config.SENTRY_TRACES_SAMPLE_RATE,
    // The body of an Express request can carry passwords, PINs, BVNs. Strip
    // request bodies entirely; the path + status + user id are what we need
    // to triage. Stack traces still come through.
    sendDefaultPii: false,
    beforeSend(event) {
      // Defensive: even with sendDefaultPii=false, scrub anything that might
      // have been attached deliberately (we set user.id and request below).
      if (event.request?.data) delete event.request.data;
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
  return true;
};

/**
 * Capture an exception. When Sentry isn't initialised, falls back to the
 * Winston logger so we don't lose the error.
 *
 * @param {Error|string} err
 * @param {object} [context] - Extra context attached to the event.
 *   - userId / requestId / route are promoted to first-class fields.
 *   - Everything else lands under `extra`.
 */
const captureError = (err, context = {}) => {
  const { logger } = require('./logger');
  if (!_initialized || !config.SENTRY_DSN) {
    logger.error('captured error (sentry disabled)', {
      message: err?.message || String(err),
      stack: err?.stack,
      ...context,
    });
    return;
  }
  Sentry.withScope((scope) => {
    if (context.userId) scope.setUser({ id: String(context.userId) });
    if (context.requestId) scope.setTag('requestId', context.requestId);
    if (context.route) scope.setTag('route', context.route);
    if (context.statusCode) scope.setTag('statusCode', String(context.statusCode));
    // AppError codes — let us alert on e.g. INSUFFICIENT_BALANCE spikes
    if (err?.code) scope.setTag('errorCode', err.code);
    const { userId, requestId, route, statusCode, ...rest } = context;
    if (Object.keys(rest).length) scope.setContext('extra', rest);
    Sentry.captureException(err);
  });
};

/**
 * Express request handler — must be the FIRST middleware so it can attach
 * the transaction to every downstream handler. No-ops when DSN is missing.
 */
const requestHandler = () => {
  if (!_initialized || !config.SENTRY_DSN) return (_req, _res, next) => next();
  return Sentry.Handlers.requestHandler({
    user: ['id', 'role'], // attach req.user.id + role if our auth middleware set them
    ip: false,
    request: ['method', 'url', 'query_string', 'headers'],
  });
};

/**
 * Express tracing handler — wraps each route in a transaction for the
 * Performance UI. Cheap to leave on at the configured sample rate.
 */
const tracingHandler = () => {
  if (!_initialized || !config.SENTRY_DSN) return (_req, _res, next) => next();
  return Sentry.Handlers.tracingHandler();
};

/**
 * Express error handler — must be mounted AFTER routes and BEFORE the app's
 * own errorHandler. It captures the error and re-throws so our existing
 * middleware still formats the response.
 */
const errorHandler = () => {
  if (!_initialized || !config.SENTRY_DSN) return (err, _req, _res, next) => next(err);
  return Sentry.Handlers.errorHandler({
    // Only forward 5xx and unexpected (non-operational) errors. Operational
    // 4xx errors (validation, INSUFFICIENT_BALANCE, etc.) are expected and
    // would otherwise bury real signal under noise.
    shouldHandleError(err) {
      const status = err.statusCode || err.status || 500;
      const isOperational = err.isOperational === true;
      if (status >= 500) return true;
      if (!isOperational) return true;
      return false;
    },
  });
};

/**
 * Run a callback within a Sentry scope so its tags / extras attach to any
 * error captured inside. Always invokes the callback, even when Sentry is
 * disabled, so callers don't have to guard.
 */
const withScope = (tags, fn) => {
  if (!_initialized || !config.SENTRY_DSN) return fn();
  return Sentry.withScope((scope) => {
    for (const k of Object.keys(tags || {})) scope.setTag(k, String(tags[k]));
    return fn();
  });
};

/**
 * Flush queued events before process exit. BullMQ workers should call this
 * on SIGTERM so in-flight Sentry events aren't lost during a deploy.
 */
const flush = async (timeoutMs = 2000) => {
  if (!_initialized || !config.SENTRY_DSN) return true;
  try {
    return await Sentry.close(timeoutMs);
  } catch {
    return false;
  }
};

module.exports = {
  initSentry,
  captureError,
  requestHandler,
  tracingHandler,
  errorHandler,
  withScope,
  flush,
  // Exposed for tests
  __isInitialized: () => _initialized && Boolean(config.SENTRY_DSN),
};
