/**
 * Socket.io initialization and connection management.
 *
 * ARCHITECTURE:
 * - Auth: JWT token verified on connection handshake
 * - Rooms: Each user joins their personal room (user:{userId})
 * - Rooms: Riders join rider pool room when online
 * - Rooms: All parties join request room during active request
 * - Handlers: Separate files for tracking and request events
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { logger } = require('../utils/logger');
const { prisma } = require('../config/database');
const { CONNECTION, RIDER, getUserRoom, getRiderPoolRoom, getMerchantsBroadcastRoom, getAdminRoom } = require('./events');
const { registerTrackingHandlers } = require('./handlers/tracking.handler');
const { registerRequestHandlers } = require('./handlers/request.handler');
const notifyService = require('../services/notify.service');
const offerCacheService = require('../services/offerCache.service');

// ============================================================
// Socket-auth user-status cache
//
// Phase 5 added a DB lookup per socket handshake so SUSPENDED/DEACTIVATED
// users can't keep using a still-valid access token. At scale, with frequent
// background/foreground cycles, that's one Postgres SELECT per reconnect per
// user - hot path. Cache the result for 60s per userId; on suspend/deactivate
// admin paths can `invalidateUserAuthCache(userId)` to force the next
// handshake to re-read.
// ============================================================

const AUTH_CACHE_TTL_MS = 60 * 1000;
const authCache = new Map(); // userId -> { value, expiresAt }

const cacheGet = (userId) => {
  const hit = authCache.get(userId);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    authCache.delete(userId);
    return null;
  }
  return hit.value;
};

const cacheSet = (userId, value) => {
  authCache.set(userId, { value, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
  // Keep the cache bounded - at 10k entries, drop the oldest 1k.
  if (authCache.size > 10_000) {
    const drop = 1000;
    let i = 0;
    for (const k of authCache.keys()) {
      authCache.delete(k);
      if (++i >= drop) break;
    }
  }
};

const invalidateUserAuthCache = (userId) => {
  authCache.delete(userId);
};

let io = null;

/**
 * Initialize Socket.io on the HTTP server.
 */
const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*', // Restrict in production
      methods: ['GET', 'POST'],
    },
    // Keepalive tuned for mobile web-PWA clients (the rider/customer apps run
    // as browser PWAs). The old 10s/5s was brutally tight: any >5s hiccup - a
    // brief tab throttle when backgrounded, or jittery mobile data - missed the
    // pong deadline and the server killed the socket ("ping timeout"). That
    // churn is what silently dropped riders offline and made them re-tap "Go
    // online". 25s ping + 60s timeout lets a socket survive ~60s of silence
    // before being culled, well under the 180s heartbeat TTL grace.
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // --- Authentication middleware ---
  // Verifies the JWT signature/expiry AND re-checks the user's current status
  // (status + soft-delete) against a 60s in-memory cache. Suspend/deactivate
  // admin paths must call `invalidateUserAuthCache(userId)` to force the next
  // handshake to bypass the cache.
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);

      let user = cacheGet(decoded.id);
      if (!user) {
        try {
          const row = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
              id: true, role: true, phone: true, status: true, deletedAt: true,
              rider: { select: { status: true } },
            },
          });
          if (!row) {
            return next(new Error('Account not found'));
          }
          // Resolve approval once at connect so the dispatch-pool join and the
          // location->GEOADD path don't have to hit the DB per message. A fresh
          // RIDER (signed up but not yet applied/approved) has no rider row or a
          // non-APPROVED one, and must stay out of the matcher's geo index.
          row.isApprovedRider = row.rider?.status === 'APPROVED';
          delete row.rider;
          user = row;
          cacheSet(decoded.id, user);
        } catch (dbErr) {
          // Fail closed on DB errors so a transient outage doesn't let a
          // suspended token slip through.
          logger.error('Socket auth DB lookup failed', { userId: decoded.id, error: dbErr.message });
          return next(new Error('Authentication unavailable'));
        }
      }

      if (user.deletedAt) {
        return next(new Error('Account not found'));
      }
      if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
        logger.warn('Socket auth refused: user not active', { userId: user.id, status: user.status });
        return next(new Error('Account is not active'));
      }

      socket.user = {
        id: user.id,
        role: user.role,
        phone: user.phone,
        isApprovedRider: !!user.isApprovedRider,
      };

      next();
    } catch (error) {
      logger.warn('Socket auth failed', { error: error.message });
      next(new Error('Invalid token'));
    }
  });

  // --- Connection handler ---
  io.on(CONNECTION.CONNECT, (socket) => {
    const { id, role } = socket.user;

    logger.info('Socket connected', { userId: id, role, socketId: socket.id });

    // Join personal room (for wallet updates, notifications)
    socket.join(getUserRoom(id));

    // Every socket joins the merchant-status broadcast room so browse
    // screens see open/closed changes live without subscribing per-merchant.
    socket.join(getMerchantsBroadcastRoom());

    // Admins join their own room so the dashboard gets merchant status
    // updates without polling/refreshing.
    if (role === 'ADMIN') {
      socket.join(getAdminRoom());
    }

    // Only APPROVED riders join the dispatch pool. A fresh, unapproved RIDER
    // signup must not enter the job-broadcast pool.
    if (role === 'RIDER' && socket.user.isApprovedRider) {
      socket.join(getRiderPoolRoom());

      // Resync: replay any offer(s) broadcast while this rider wasn't
      // connected (backgrounded, phone locked, socket mid-reconnect) so
      // opening/foregrounding the app shows the real countdown - not a
      // fresh 60s, and not nothing. See offerCache.service.js.
      offerCacheService
        .getLivePendingOffers(id)
        .then((offers) => {
          for (const offer of offers) {
            socket.emit(RIDER.NEW_JOB, offer.payload);
          }
        })
        .catch((err) => logger.warn('Offer resync failed', { userId: id, error: err.message }));
    }

    // Register event handlers
    registerTrackingHandlers(io, socket);
    registerRequestHandlers(io, socket);

    // --- Disconnect ---
    socket.on(CONNECTION.DISCONNECT, (reason) => {
      logger.info('Socket disconnected', { userId: id, reason });
    });

    // --- Error ---
    socket.on('error', (error) => {
      logger.error('Socket error', { userId: id, error: error.message });
    });
  });

  notifyService.setIO(io);
  logger.info('Socket.io server initialized');

  return io;
};

/**
 * Get the Socket.io server instance.
 * Use this in services/controllers to emit events.
 */
const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

module.exports = { initializeSocket, getIO, invalidateUserAuthCache };
