const express = require("express");
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const routes = require("./routes");
const sessionRoutes = require("./routes/sessionRoutes");
const pageRoutes = require("./routes/pages");
const { setupMiddleware, setupErrorHandling } = require("./config/middleware");
const config = require("../../config/app");

let devAuthRoutes;
if (config.env === "development") {
  devAuthRoutes = require("./routes/devAuth");
}

class DRIMSApp {
  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  initializeMiddleware() {
    setupMiddleware(this.app);


    // Silently handle browser tool discovery requests to prevent log noise
    this.app.get(
      "/.well-known/appspecific/com.chrome.devtools.json",
      (req, res) => {
        res.status(204).end(); // No content, success (or use 404 if preferred, but 204 is cleaner for "empty")
      }
    );
  }

  initializeRoutes() {
    // Dev Auth Routes (only in development)
    if (config.env === "development" && devAuthRoutes) {
      this.app.use("/api/dev", devAuthRoutes);
    }

    // API Routes
    this.app.use("/api", routes);

    // Session Routes (for client-side auth sync)
    // Mounted at /auth to match original paths: /auth/session, /auth/session/token, etc.
    this.app.use("/auth", sessionRoutes);

    // Page Routes (Protected & Public HTML pages)
    this.app.use("/", pageRoutes);
  }

  initializeErrorHandling() {
    setupErrorHandling(this.app);
  }

  async start(port, host) {
    return new Promise((resolve, reject) => {
      const useHttps =
        process.env.USE_HTTPS === "true" || process.env.USE_HTTPS === "1";

      const scheme = useHttps ? "https" : "http";
      const onListen = () => {
        const resolvedHost = host || "localhost";
        console.log(`Server running on ${scheme}://${resolvedHost}:${port}`);
        resolve();
      };

      try {
        if (useHttps) {
          const defaultKeyPath = path.join(config.rootDir, "certs", "dev-key.pem");
          const defaultCertPath = path.join(config.rootDir, "certs", "dev-cert.pem");

          const keyPath = process.env.SSL_KEY_FILE || defaultKeyPath;
          const certPath = process.env.SSL_CERT_FILE || defaultCertPath;
          const caPath = process.env.SSL_CA_FILE;

          if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
            const missing = [
              !fs.existsSync(keyPath) ? `SSL key not found: ${keyPath}` : null,
              !fs.existsSync(certPath) ? `SSL cert not found: ${certPath}` : null,
            ].filter(Boolean);

            const err = new Error(
              `HTTPS is enabled (USE_HTTPS=1) but certificate files are missing.\n${missing.join("\n")}\n\nProvide SSL_KEY_FILE and SSL_CERT_FILE env vars (or create certs/dev-key.pem + certs/dev-cert.pem).`
            );
            err.code = "HTTPS_CERT_MISSING";
            return reject(err);
          }

          const httpsOptions = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
          };

          if (caPath && fs.existsSync(caPath)) {
            httpsOptions.ca = fs.readFileSync(caPath);
          }

          this.server = https.createServer(httpsOptions, this.app);
          if (host) {
            this.server.listen(port, host, onListen);
          } else {
            this.server.listen(port, onListen);
          }
          this.server.on("error", reject);
          return;
        }

        this.server = (host
          ? this.app.listen(port, host, onListen)
          : this.app.listen(port, onListen)
        ).on("error", reject);
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = DRIMSApp;
