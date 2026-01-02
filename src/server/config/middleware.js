const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const config = require("../../../config/app");
const {
  securityHeaders,
  customSecurityHeaders,
} = require("../middleware/security");
const { apiLimiter } = require("../middleware/rateLimiting");
const InputSanitizer = require("../middleware/inputSanitizer");
const { enforceHTTPS, trustProxy } = require("../middleware/httpsEnforcement");
const { ErrorHandler } = require("../middleware/errorHandler");

/**
 * Configure application middleware
 * @param {Express.Application} app - Express application instance
 */
const setupMiddleware = (app) => {
  // Trust proxy for accurate IP detection (for HTTPS enforcement)
  trustProxy(app);

  // HTTPS enforcement (must be before other middleware)
  app.use(enforceHTTPS);

  // Enhanced security headers (applied first)
  app.use(securityHeaders);
  app.use(customSecurityHeaders);

  // Rate limiting (applied early to protect against abuse)
  app.use("/api/", apiLimiter);

  // Enhanced input sanitization and validation
  app.use(InputSanitizer.validateRequestSize);
  app.use(InputSanitizer.preventSQLInjection);
  app.use(InputSanitizer.preventXSS);
  app.use(InputSanitizer.sanitize);

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(cookieParser());

  // Serve static files with proper paths
  // Prefer public assets, then fall back to src client assets
  app.use("/js", express.static(path.join(config.rootDir, "public", "js")));
  app.use("/css", express.static(path.join(config.rootDir, "public", "css")));
  app.use("/js", express.static(path.join(config.rootDir, "src", "client")));
  app.use(
    "/css",
    express.static(path.join(config.rootDir, "src", "client", "styles"))
  );
  app.use(
    "/assets",
    express.static(path.join(config.rootDir, "src", "client", "assets"))
  );
  app.use("/public", express.static(path.join(config.rootDir, "public")));
  app.use("/uploads", express.static(path.join(config.rootDir, "uploads")));

  // Additional static file serving for coordinator review system
  app.use(
    "/components",
    express.static(path.join(config.rootDir, "public", "components"))
  );
  app.use(
    "/styles",
    express.static(path.join(config.rootDir, "public", "styles"))
  );

  // Serve favicon
  app.get("/favicon.ico", (req, res) => {
    res.sendFile(path.join(config.rootDir, "public", "favicon.ico"));
  });

  // Serve node_modules for browser imports
  app.use(
    "/node_modules",
    express.static(path.join(config.rootDir, "node_modules"))
  );
};

/**
 * Configure error handling middleware
 * @param {Express.Application} app - Express application instance
 */
const setupErrorHandling = (app) => {
  // 404 handler for unmatched routes
  app.use(ErrorHandler.notFound);

  // Global error handler
  app.use(ErrorHandler.handle);
};

module.exports = {
  setupMiddleware,
  setupErrorHandling,
};
