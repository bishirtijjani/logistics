/**
 * Express application factory.
 *
 * Creates and configures the Express app with all middleware and routes.
 * Does NOT call listen() — that happens in server.js.
 *
 * This separation allows the app to be imported for testing
 * without starting an HTTP server.
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { errorHandler } = require("./middlewares/error.middleware");
const { generalLimiter } = require("./middlewares/rate-limit.middleware");
const { requestId: requestIdMiddleware } = require("./middlewares/request-id.middleware");
const { logger } = require("./utils/logger");
const { config } = require("./config");
const sentry = require("./utils/sentry");

// Build the CORS options once at module load. In dev the configured value
// defaults to '*' so we pass that through; in staging/prod we parse the
// comma-separated allowlist and reject everything else.
const buildCorsOptions = () => {
  const raw = (config.CORS_ALLOWED_ORIGINS || "").trim();
  if (raw === "*" || raw === "") {
    return { origin: true, credentials: true };
  }
  const allowList = raw.split(",").map((o) => o.trim()).filter(Boolean);
  return {
    origin(origin, callback) {
      // Non-browser callers (curl, mobile apps, server-to-server) send no
      // Origin header — allow those through; CORS only matters for browsers.
      if (!origin) return callback(null, true);
      if (allowList.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin "${origin}" not in allowlist`));
    },
    credentials: true,
  };
};

// Route imports
const authRoutes = require("./modules/auth/auth.routes");
const walletRoutes = require("./modules/wallet/wallet.routes");
const utilityRoutes = require("./modules/utility/utility.routes");
const airtimeToCashRoutes = require("./modules/airtimeToCash/airtimeToCash.routes");
const riderRoutes = require("./modules/rider/rider.routes");
const adminRoutes = require("./modules/admin/admin.routes");
const webhookRoutes = require("./modules/webhook/webhook.routes");
const mapsRoutes = require("./modules/maps/maps.routes");
const requestRoutes = require("./modules/request/request.routes");
const merchantRoutes = require("./modules/merchant/merchant.routes");
const settingsRoutes = require("./modules/settings/settings.routes");
const categoryRoutes = require("./modules/category/category.routes");
const searchRoutes = require("./modules/search/search.routes");
const notificationRoutes = require("./modules/notification/notification.routes");
const pushRoutes = require("./modules/push/push.routes");
const addressRoutes = require("./modules/address/address.routes");
const bannerRoutes = require("./modules/banner/banner.routes");
const supportRoutes = require("./modules/support/support.routes");
const waitlistRoutes = require("./modules/waitlist/waitlist.routes");
const contactRoutes = require("./modules/contact/contact.routes");

const createApp = () => {
  const app = express();

  // We sit behind nginx in staging/prod — without this, express-rate-limit
  // sees every request as coming from 127.0.0.1 and all visitors share one
  // bucket (e.g. the marketing-site contact form would rate-limit the whole
  // internet, not the person actually spamming). '1' = trust the one proxy
  // hop in front of us; safe for our single-nginx setup. See express docs:
  // https://expressjs.com/en/guide/behind-proxies.html
  app.set('trust proxy', 1);

  // --------------- Observability (must be FIRST) ---------------
  // Sentry handlers must run before everything else so each request gets a
  // transaction; the request-id middleware runs right after so request logs
  // and Sentry events share the same correlation id.
  sentry.initSentry();
  app.use(sentry.requestHandler());
  app.use(sentry.tracingHandler());
  app.use(requestIdMiddleware);

  // --------------- Security & Parsing ---------------
  app.use(helmet());
  app.use(cors(buildCorsOptions()));
  // Webhook payloads need the RAW body for HMAC signature verification.
  // This must be mounted BEFORE express.json() so the raw bytes aren't
  // consumed and re-parsed into an object (which would yield "[object Object]"
  // when stringified for the signature check and always fail with 401).
  app.use("/webhooks", express.raw({ type: "*/*" }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // --------------- Rate Limiting ---------------
  // General rate limiter on all routes (100 req/min per IP)
  // Specific limiters (auth, OTP, PIN) are applied at route level
  app.use(generalLimiter);

  // --------------- Request Logging ---------------
  // Custom morgan token to include the request-id so every access log line
  // can be joined back to an application log or Sentry event.
  morgan.token("reqid", (req) => req.requestId || "-");
  app.use(
    morgan(":method :url :status :res[content-length] - :response-time ms reqid=:reqid", {
      stream: { write: (message) => logger.info(message.trim()) },
    }),
  );

  // --------------- Health Check ---------------
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // --------------- API Routes ---------------
  app.use("/auth", authRoutes);
  app.use("/wallet", walletRoutes);
  app.use("/utilities", utilityRoutes);
  app.use("/airtime-to-cash", airtimeToCashRoutes);
  app.use("/rider", riderRoutes);
  app.use("/admin", adminRoutes);
  app.use("/webhooks", webhookRoutes);
  app.use("/maps", mapsRoutes);
  app.use("/requests", requestRoutes);
  app.use("/merchants", merchantRoutes);
  app.use("/settings", settingsRoutes);
  app.use("/categories", categoryRoutes);
  app.use("/notifications", notificationRoutes);
  app.use("/push", pushRoutes);
  app.use("/addresses", addressRoutes);
  app.use("/banners", bannerRoutes);
  app.use("/support", supportRoutes);
  app.use("/waitlist", waitlistRoutes);
  app.use("/contact", contactRoutes);
  app.use("/", searchRoutes);

  // --------------- 404 Handler ---------------
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: "Route not found",
      data: null,
    });
  });

  // --------------- Error Capture ---------------
  // Sentry's handler captures 5xx + non-operational errors then passes
  // control to our own error handler which formats the response. Order
  // matters: Sentry MUST run before errorHandler.
  app.use(sentry.errorHandler());
  app.use(errorHandler);

  return app;
};

module.exports = { createApp };
