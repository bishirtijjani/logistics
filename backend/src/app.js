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
const { logger } = require("./utils/logger");

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
const addressRoutes = require("./modules/address/address.routes");
const bannerRoutes = require("./modules/banner/banner.routes");
const supportRoutes = require("./modules/support/support.routes");

const createApp = () => {
  const app = express();

  // --------------- Security & Parsing ---------------
  app.use(helmet());
  app.use(cors());
  // Webhook payloads need the RAW body for HMAC signature verification.
  // This must be mounted BEFORE express.json() so the raw bytes aren't
  // consumed and re-parsed into an object (which would yield "[object Object]"
  // when stringified for the signature check and always fail with 401).
  app.use("/api/webhooks", express.raw({ type: "*/*" }));
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // --------------- Rate Limiting ---------------
  // General rate limiter on all routes (100 req/min per IP)
  // Specific limiters (auth, OTP, PIN) are applied at route level
  app.use(generalLimiter);

  // --------------- Request Logging ---------------
  app.use(
    morgan("short", {
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
  const API_PREFIX = "/api";

  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/wallet`, walletRoutes);
  app.use(`${API_PREFIX}/utilities`, utilityRoutes);
  app.use(`${API_PREFIX}/airtime-to-cash`, airtimeToCashRoutes);
  app.use(`${API_PREFIX}/rider`, riderRoutes);
  app.use(`${API_PREFIX}/admin`, adminRoutes);
  app.use(`${API_PREFIX}/webhooks`, webhookRoutes);
  app.use(`${API_PREFIX}/maps`, mapsRoutes);
  app.use(`${API_PREFIX}/requests`, requestRoutes);
  app.use(`${API_PREFIX}/merchants`, merchantRoutes);
  app.use(`${API_PREFIX}/settings`, settingsRoutes);
  app.use(`${API_PREFIX}/categories`, categoryRoutes);
  app.use(`${API_PREFIX}/notifications`, notificationRoutes);
  app.use(`${API_PREFIX}/addresses`, addressRoutes);
  app.use(`${API_PREFIX}/banners`, bannerRoutes);
  app.use(`${API_PREFIX}/support`, supportRoutes);
  app.use(`${API_PREFIX}`, searchRoutes);

  // --------------- 404 Handler ---------------
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: "Route not found",
      data: null,
    });
  });

  // --------------- Global Error Handler ---------------
  app.use(errorHandler);

  return app;
};

module.exports = { createApp };
