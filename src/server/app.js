const express = require("express");
const routes = require("./routes");
const sessionRoutes = require("./routes/sessionRoutes");
const pageRoutes = require("./routes/pages");
const { setupMiddleware, setupErrorHandling } = require("./config/middleware");

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

  async start(port) {
    return new Promise((resolve, reject) => {
      this.server = this.app
        .listen(port, () => {
          console.log(`Server running on port ${port}`);
          resolve();
        })
        .on("error", reject);
    });
  }
}

module.exports = DRIMSApp;
