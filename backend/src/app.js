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
const deliveryRoutes = require("./modules/delivery/delivery.routes");
const utilityRoutes = require("./modules/utility/utility.routes");
const riderRoutes = require("./modules/rider/rider.routes");
const adminRoutes = require("./modules/admin/admin.routes");
const webhookRoutes = require("./modules/webhook/webhook.routes");
const mapsRoutes = require("./modules/maps/maps.routes");
const requestRoutes = require("./modules/request/request.routes");  // NEW: Unified request routes
const providerRoutes = require("./modules/provider/provider.routes");  // NEW: Provider routes

const createApp = () => {
  const app = express();

  // --------------- Security & Parsing ---------------
  app.use(helmet());
  app.use(cors());
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
  app.use(`${API_PREFIX}/delivery`, deliveryRoutes);
  app.use(`${API_PREFIX}/utilities`, utilityRoutes);
  app.use(`${API_PREFIX}/rider`, riderRoutes);
  app.use(`${API_PREFIX}/admin`, adminRoutes);
  app.use(`${API_PREFIX}/webhooks`, webhookRoutes);
  app.use(`${API_PREFIX}/maps`, mapsRoutes);
  app.use(`${API_PREFIX}/requests`, requestRoutes);
  app.use(`${API_PREFIX}/providers`, providerRoutes);

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
