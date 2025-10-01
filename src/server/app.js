const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('../../config/app');
const Database = require('./config/database');
const database = new Database();
const routes = require('./routes');
const { authenticateUser, requireRole } = require('./middleware/auth');
const { ErrorHandler } = require('./middleware/errorHandler');
const { securityHeaders, cspConfig } = require('./middleware/security');

class CitizenLinkApp {
  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  initializeMiddleware() {
    // Security middleware (applied first)
    this.app.use(securityHeaders);

    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    this.app.use(cookieParser());
    
    // Serve static files with proper paths
    this.app.use('/js', express.static(path.join(config.rootDir, 'src', 'client')));
    this.app.use('/css', express.static(path.join(config.rootDir, 'src', 'client', 'styles')));
    this.app.use('/assets', express.static(path.join(config.rootDir, 'src', 'client', 'assets')));
    this.app.use('/uploads', express.static(path.join(config.rootDir, 'uploads')));
    
    // Serve node_modules for browser imports
    this.app.use('/node_modules', express.static(path.join(config.rootDir, 'node_modules')));
  }

  initializeRoutes() {
    // API Routes
    this.app.use('/api', routes);

    // Protected Pages
    this.setupProtectedRoutes();

    // Public Pages
    this.setupPublicRoutes();

    // 404 Handler
    this.app.use('*', (req, res) => {
      res.status(404).sendFile(path.join(__dirname, '..', '..', 'views', 'pages', '404.html'));
    });
  }

  setupProtectedRoutes() {
    // Dashboard route - protected and routed by role
    this.app.get("/dashboard", authenticateUser, (req, res) => {
      const userRole = req.user?.user_metadata?.role || "citizen";
      const dashboardPath = this.getDashboardPath(userRole);
      console.log(`[DASHBOARD] Role: ${userRole}, Path: ${dashboardPath}, User ID: ${req.user?.id}`);
      res.sendFile(dashboardPath);
    });

    // General protected pages
    this.app.get("/myProfile", authenticateUser, (req, res) => {
      res.sendFile(path.join(config.rootDir, "views", "pages", "myProfile.html"));
    });

    this.app.get("/fileComplaint", authenticateUser, (req, res) => {
      res.sendFile(path.join(config.rootDir, "views", "pages", "fileComplaint.html"));
    });

    // Admin pages
    this.app.get("/admin/departments", 
      authenticateUser, 
      requireRole(["lgu-admin", "super-admin"]), 
      (req, res) => {
        res.sendFile(path.join(config.rootDir, "views", "pages", "admin", "departments", "index.html"));
      }
    );

    this.app.get("/admin/settings", 
      authenticateUser, 
      requireRole(["lgu-admin", "super-admin"]), 
      (req, res) => {
        res.sendFile(path.join(config.rootDir, "views", "pages", "admin", "settings", "index.html"));
      }
    );

    // LGU-specific pages
    this.app.get("/taskAssigned", 
      authenticateUser, 
      requireRole(["lgu", /^lgu-/]), 
      (req, res) => {
        res.sendFile(path.join(config.rootDir, "views", "pages", "lgu", "taskAssigned.html"));
      }
    );

    // LGU Admin specific pages
    this.app.get("/heatmap", 
      authenticateUser, 
      requireRole([/^lgu-admin(?:-|$)/]), 
      (req, res) => {
        res.sendFile(path.join(config.rootDir, "views", "pages", "lgu-admin", "heatmap.html"));
      }
    );

    this.app.get("/publish", 
      authenticateUser, 
      requireRole([/^lgu-admin(?:-|$)/]), 
      (req, res) => {
        res.sendFile(path.join(config.rootDir, "views", "pages", "lgu-admin", "publish.html"));
      }
    );

    this.app.get("/appointMembers", 
      authenticateUser, 
      requireRole([/^lgu-admin(?:-|$)/]), 
      (req, res) => {
        res.sendFile(path.join(config.rootDir, "views", "pages", "lgu-admin", "appointMembers.html"));
      }
    );

    // Super Admin specific pages
    this.app.get("/appointAdmins", 
      authenticateUser, 
      requireRole(["super-admin"]), 
      (req, res) => {
        res.sendFile(path.join(config.rootDir, "views", "pages", "super-admin", "appointAdmins.html"));
      }
    );

    // Role-based dashboard shortcuts
    this.app.get("/citizen", authenticateUser, requireRole(["citizen"]), (req, res) => {
      res.redirect("/dashboard");
    });

    this.app.get("/lgu", authenticateUser, requireRole(["lgu", /^lgu-/]), (req, res) => {
      res.redirect("/dashboard");
    });

    this.app.get("/lgu-admin", authenticateUser, requireRole(["lgu-admin"]), (req, res) => {
      res.redirect("/dashboard");
    });

    this.app.get("/super-admin", authenticateUser, requireRole(["super-admin"]), (req, res) => {
      res.redirect("/dashboard");
    });

    // Legacy API endpoints for user info
    this.app.get("/api/user/profile", authenticateUser, (req, res) => {
      const { user } = req;
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.name,
          role: user.user_metadata?.role,
          mobile: user.user_metadata?.mobile,
        },
      });
    });

    this.app.get("/api/user/role", authenticateUser, (req, res) => {
      const { user } = req;
      res.json({
        success: true,
        data: {
          role: user.user_metadata?.role || "citizen",
        },
      });
    });
  }

  setupPublicRoutes() {
    // Root route
    this.app.get("/", (req, res) => {
      res.sendFile(path.join(config.rootDir, "views", "pages", "index.html"));
    });

    // Public pages
    const publicPages = ['login', 'signup', 'resetPass', 'OAuthContinuation', 'success'];
    publicPages.forEach(page => {
      this.app.get(`/${page}`, (req, res) => {
        res.sendFile(path.join(config.rootDir, "views", "pages", `${page}.html`));
      });
    });

    // Public API endpoints
    this.app.get("/api/boundaries", async (req, res) => {
      try {
        const filePath = path.join(config.rootDir, "src", "client", "assets", "brgy_boundaries_location.json");
        const fs = require('fs').promises;
        const jsonData = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(jsonData));
      } catch (error) {
        res.status(500).json({ error: 'Failed to load boundaries data' });
      }
    });

    this.app.get("/api/reverse-geocode", async (req, res) => {
      try {
        const { lat, lng } = req.query;
        
        if (!lat || !lng) {
          return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        
        const response = await fetch(nominatimUrl, {
          headers: {
            'User-Agent': 'CitizenLink/1.0 (https://citizenlink.local)'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Nominatim API error: ${response.status}`);
        }
        
        const data = await response.json();
        res.json(data);
      } catch (error) {
        console.error('Reverse geocoding error:', error);
        res.status(500).json({ error: 'Failed to get address information' });
      }
    });
  }

  getDashboardPath(userRole) {
    const roleDashboards = {
      citizen: path.join(config.rootDir, "views", "pages", "citizen", "dashboard.html"),
      lgu: path.join(config.rootDir, "views", "pages", "lgu", "dashboard.html"),
      "lgu-admin": path.join(config.rootDir, "views", "pages", "lgu-admin", "dashboard.html"),
      "super-admin": path.join(config.rootDir, "views", "pages", "super-admin", "dashboard.html"),
    };

    return roleDashboards[userRole] || roleDashboards.citizen;
  }

  initializeErrorHandling() {
    // 404 handler for unmatched routes
    this.app.use(ErrorHandler.notFound);
    
    // Global error handler
    this.app.use(ErrorHandler.handle);
  }

  async start(port = 3000) {
    try {
      // Test database connection
      const isConnected = await database.testConnection();
      if (!isConnected) {
        throw new Error('Database connection failed');
      }

      this.app.listen(port, () => {
        console.log(`🚀 CitizenLink server running on port ${port}`);
        console.log(`📊 Database connected successfully`);
        console.log(`🔗 Access the application at http://localhost:${port}`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

module.exports = CitizenLinkApp;
