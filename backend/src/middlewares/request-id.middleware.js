/**
 * Request-ID middleware.
 *
 * Attaches a unique `requestId` to every request so:
 *   - Every log line emitted for one request shares the same id
 *   - Sentry events tag `requestId` and can be cross-referenced with logs
 *   - The client gets `X-Request-Id` in the response, which we can ask them
 *     to quote when reporting bugs
 *
 * Honors an inbound `X-Request-Id` header so callers (e.g. an upstream
 * gateway or another service) can propagate their own correlation id —
 * lightly validated to prevent header-injection / log-injection abuse.
 */

const crypto = require('crypto');

// Only allow safe identifier characters in inbound ids (UUIDs, ULIDs, short
// alnum tokens). Anything else is silently replaced with a fresh server id.
const SAFE_ID = /^[A-Za-z0-9_-]{8,128}$/;

const newRequestId = () => crypto.randomBytes(8).toString('hex');

const requestId = (req, res, next) => {
  const inbound = req.headers['x-request-id'];
  const id = typeof inbound === 'string' && SAFE_ID.test(inbound) ? inbound : newRequestId();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};

module.exports = { requestId, newRequestId };
