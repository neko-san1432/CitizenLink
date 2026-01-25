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
  if (!config.isDevelopment) {
    app.use(securityHeaders);
    app.use(customSecurityHeaders);
  } else {
    // console.log("⚠️  Security headers disabled in development mode");
  }

  // Body parsing middleware (before rate limiting to allow proper request inspection)
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(cookieParser());

  // Rate limiting (applied early to protect against abuse)
  app.use("/api/", apiLimiter);

  // Enhanced input sanitization and validation
  app.use(InputSanitizer.validateRequestSize);
  app.use(InputSanitizer.preventSQLInjection);
  app.use(InputSanitizer.preventXSS);
  app.use(InputSanitizer.sanitize);

  // ===== STATIC FILE SERVING (MUST BE BEFORE ROUTES) =====
  // Serve favicon first (most requested)
  app.get("/favicon.ico", (req, res) => {
    res.sendFile(path.join(config.rootDir, "public", "favicon.ico"));
  });
  app.get("/favicon.png", (req, res) => {
    res.sendFile(path.join(config.rootDir, "public", "favicon.png"));
  });
  app.get("/digos-city-boundary.json", (req, res) => {
    res.sendFile(
      path.join(config.rootDir, "public", "assets", "json", "digos-city-boundary.json")
    );
  });
  app.get("/data/geographic/digos-city-boundary.json", (req, res) => {
    res.sendFile(
      path.join(config.rootDir, "public", "assets", "json", "digos-city-boundary.json")
    );
  });
  app.get("/data/geographic/brgy_boundaries_location.json", (req, res) => {
    res.sendFile(
      path.join(
        config.rootDir,
        "public",
        "assets",
        "json",
        "brgy_boundaries_location.json"
      )
    );
  });

  // Serve static files with proper paths
  // Root public directory (for files like favicon, robots.txt, etc.)
  app.use(express.static(path.join(config.rootDir, "public")));

  // Specific directories (more specific routes first)
  app.use("/js", express.static(path.join(config.rootDir, "public", "js")));
  app.use("/css", express.static(path.join(config.rootDir, "public", "css")));
  app.use(
    "/assets",
    express.static(path.join(config.rootDir, "public", "assets"))
  );
  app.use("/uploads", express.static(path.join(config.rootDir, "uploads")));
  app.use("/public", express.static(path.join(config.rootDir, "public")));

  // Fallback to src/client for legacy paths
  app.use("/js", express.static(path.join(config.rootDir, "src", "client")));
  app.use(
    "/css",
    express.static(path.join(config.rootDir, "src", "client", "styles"))
  );
  app.use(
    "/assets",
    express.static(path.join(config.rootDir, "src", "client", "assets"))
  );

  // Additional static file serving for coordinator review system
  app.use(
    "/components",
    express.static(path.join(config.rootDir, "public", "components"))
  );
  app.use(
    "/styles",
    express.static(path.join(config.rootDir, "public", "styles"))
  );

  // Serve node_modules for browser imports (ESM modules)
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
