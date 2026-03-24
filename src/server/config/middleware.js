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
  // SEC-24 FIX: Apply security headers in ALL environments
  app.use(securityHeaders);
  app.use(customSecurityHeaders);

  // Body parsing middleware (before rate limiting to allow proper request inspection)
  // SEC-10 FIX: Restrict CORS to known origins
  const allowedOrigins = [
    `http://localhost:${config.port}`,
    `http://127.0.0.1:${config.port}`,
    process.env.PRODUCTION_URL
  ].filter(Boolean);
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, Postman, same-origin)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true
  }));
  // SEC-23 FIX: Reduce default body limit to 1MB (upload routes override per-route)
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
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
  app.get("/data/geographic/brgyBoundariesLocation.json", (req, res) => {
    res.sendFile(
      path.join(
        config.rootDir,
        "public",
        "assets",
        "json",
        "brgyBoundariesLocation.json"
      )
    );
  });
  // Fix for root request 404
  app.get("/brgyBoundariesLocation.json", (req, res) => {
    res.sendFile(
      path.join(
        config.rootDir,
        "public",
        "assets",
        "json",
        "brgyBoundariesLocation.json"
      )
    );
  });

  // Dynamic route for NLP dictionaries (extracted from brainConfig.json)
  app.get(["/nlp_dictionaries.json", "/assets/data/nlp_dictionaries.json"], (req, res) => {
    try {
      const fs = require("fs");
      const configPath = path.join(config.rootDir, "public", "assets", "json", "brainConfig.json");
      const brainConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      res.json(brainConfig.dictionaries || {});
    } catch (e) {
      res.status(404).json({ error: "Dictionary not found" });
    }
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
  // SEC-18 FIX: uploads served through authenticated route instead of public static
  // app.use("/uploads", express.static(path.join(config.rootDir, "uploads")));
  app.use("/public", express.static(path.join(config.rootDir, "public")));

  // Legacy src/client fallback mounts removed — all files consolidated into public/

  // Additional static file serving for coordinator review system
  app.use(
    "/components",
    express.static(path.join(config.rootDir, "public", "components"))
  );
  app.use(
    "/styles",
    express.static(path.join(config.rootDir, "public", "styles"))
  );

  // SEC-03 FIX: node_modules static mount REMOVED for security.
  // Bundle required client-side libraries into public/ instead.
  // app.use("/node_modules", express.static(path.join(config.rootDir, "node_modules")));
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
