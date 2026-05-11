const crypto = require('crypto');
const { prisma } = require('../config/database');
const { logger } = require('../utils/logger');

const TTL_HOURS = 24;

// How long the loser of a concurrent reservation race waits for the winner
// to persist its response before we tell the client to retry.
const CONCURRENT_WAIT_MS = 2000;
const CONCURRENT_POLL_MS = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sendReplay = (res, snapshot) => {
  res.setHeader('Idempotent-Replayed', 'true');
  const { status, body } = snapshot;
  return res.status(status || 200).json(body);
};

/**
 * Idempotency middleware for mutating endpoints.
 *
 * Reads the `Idempotency-Key` header. Money-moving routes (request creation,
 * wallet transfer/withdraw, utility purchases) MUST be wrapped with this so
 * a network retry from the client cannot produce a duplicate side effect.
 *
 * Behaviour:
 *   - No header     → pass through.
 *   - First call    → reserve (PK insert), let the handler run, capture the
 *                     response on res.json so future calls can replay it.
 *   - Replay        → return the cached response with `Idempotent-Replayed:true`.
 *   - Race          → if two concurrent calls share a key, the loser of the
 *                     PK insert briefly waits for the winner's response, then
 *                     replays. If the winner hasn't responded in time, returns
 *                     409 so the client can retry rather than risking a dup.
 *   - Infra failure → fail CLOSED with 503. We never let a money-moving request
 *                     through when the dedup store itself is unhealthy.
 */
const idempotency = async (req, res, next) => {
  const key = req.headers['idempotency-key'];
  if (!key) return next();

  const userId = req.user?.id || 'anon';
  const route = `${req.method}:${req.path}`;
  const bodyHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(req.body || {}))
    .digest('hex');

  // ── 1. Look up existing reservation ─────────────────────────────────────
  let existing;
  try {
    existing = await prisma.idempotencyKey.findUnique({ where: { key } });
  } catch (err) {
    logger.error('Idempotency lookup failed — failing closed', { key, error: err.message });
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable. Please retry.',
    });
  }

  if (existing) {
    // Expired → delete and treat as new.
    if (existing.expiresAt < new Date()) {
      try {
        await prisma.idempotencyKey.delete({ where: { key } });
      } catch (_) {
        // Another process may have deleted it; safe to continue.
      }
    } else if (existing.responseSnapshot) {
      return sendReplay(res, existing.responseSnapshot);
    } else {
      // Reservation exists but response not yet captured → concurrent in-flight
      // request from a duplicate retry. Wait briefly, then replay.
      const deadline = Date.now() + CONCURRENT_WAIT_MS;
      while (Date.now() < deadline) {
        await sleep(CONCURRENT_POLL_MS);
        let row;
        try {
          row = await prisma.idempotencyKey.findUnique({ where: { key } });
        } catch (err) {
          logger.error('Idempotency poll failed — failing closed', { key, error: err.message });
          return res.status(503).json({
            success: false,
            message: 'Service temporarily unavailable. Please retry.',
          });
        }
        if (row?.responseSnapshot) return sendReplay(res, row.responseSnapshot);
      }
      return res.status(409).json({
        success: false,
        message: 'Request already in progress. Retry shortly.',
      });
    }
  }

  // ── 2. Reserve the key (PK insert; loser of a race throws P2002) ────────
  try {
    await prisma.idempotencyKey.create({
      data: {
        key,
        userId,
        route,
        requestHash: bodyHash,
        expiresAt: new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000),
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      // We lost the create race — treat exactly like the concurrent-in-flight
      // branch above: wait briefly, then replay.
      const deadline = Date.now() + CONCURRENT_WAIT_MS;
      while (Date.now() < deadline) {
        await sleep(CONCURRENT_POLL_MS);
        let row;
        try {
          row = await prisma.idempotencyKey.findUnique({ where: { key } });
        } catch (e) {
          logger.error('Idempotency race-poll failed — failing closed', { key, error: e.message });
          return res.status(503).json({
            success: false,
            message: 'Service temporarily unavailable. Please retry.',
          });
        }
        if (row?.responseSnapshot) return sendReplay(res, row.responseSnapshot);
      }
      return res.status(409).json({
        success: false,
        message: 'Request already in progress. Retry shortly.',
      });
    }
    logger.error('Idempotency reserve failed — failing closed', { key, error: err.message });
    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable. Please retry.',
    });
  }

  // ── 3. Intercept res.json to capture the eventual response ──────────────
  // 2xx/4xx responses are cached so retries replay them. 5xx responses
  // indicate a transient failure where we don't know whether the side effect
  // happened — but for our money-moving routes the side effect either ran
  // inside a Prisma transaction (atomic) or didn't run at all, so the safer
  // behavior is to release the reservation and let the client retry with the
  // same key.
  //
  // Capture failures here MUST NOT block the user response — log and continue.
  const originalJson = res.json.bind(res);
  res.json = async (body) => {
    const status = res.statusCode;
    try {
      if (status >= 500) {
        await prisma.idempotencyKey.delete({ where: { key } });
      } else {
        await prisma.idempotencyKey.update({
          where: { key },
          data: { responseSnapshot: { status, body } },
        });
      }
    } catch (err) {
      logger.warn('Idempotency snapshot capture failed', { key, status, error: err.message });
    }
    return originalJson(body);
  };

  return next();
};

module.exports = { idempotency };
