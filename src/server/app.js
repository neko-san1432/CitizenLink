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
const { securityHeaders, cspConfig, customSecurityHeaders } = require('./middleware/security');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiting');
const InputSanitizer = require('./middleware/inputSanitizer');

class CitizenLinkApp {
  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  initializeMiddleware() {
    // Enhanced security headers (applied first)
    this.app.use(securityHeaders);
    this.app.use(customSecurityHeaders);

    // Rate limiting (applied early to protect against abuse)
    this.app.use('/api/', apiLimiter);

    // Enhanced input sanitization and validation
    this.app.use(InputSanitizer.validateRequestSize);
    this.app.use(InputSanitizer.preventSQLInjection);
    this.app.use(InputSanitizer.preventXSS);
    this.app.use(InputSanitizer.sanitize);

    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    this.app.use(cookieParser());

    // Serve static files with proper paths
    // Prefer public assets, then fall back to src client assets
    this.app.use('/js', express.static(path.join(config.rootDir, 'public', 'js')));
    this.app.use('/css', express.static(path.join(config.rootDir, 'public', 'css')));
    this.app.use('/js', express.static(path.join(config.rootDir, 'src', 'client')));
    this.app.use('/css', express.static(path.join(config.rootDir, 'src', 'client', 'styles')));
    this.app.use('/assets', express.static(path.join(config.rootDir, 'src', 'client', 'assets')));
    this.app.use('/public', express.static(path.join(config.rootDir, 'public')));
    this.app.use('/uploads', express.static(path.join(config.rootDir, 'uploads')));

    // Serve node_modules for browser imports
    this.app.use('/node_modules', express.static(path.join(config.rootDir, 'node_modules')));
  }

  initializeRoutes() {
    // API Routes
    this.app.use('/api', routes);

    // Session cookie helpers for client
    this.app.post('/auth/session', authLimiter, (req, res) => {
      try {
        const token = req.body?.access_token;
        const remember = Boolean(req.body?.remember);
        if (!token) {
          return res.status(400).json({ success: false, error: 'access_token is required' });
        }
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: remember ? 180 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000 // 180 days if remember, 7 days default
        };
        res.cookie('sb_access_token', token, cookieOptions);
        return res.json({ success: true });
      } catch (e) {
        return res.status(500).json({ success: false, error: 'Failed to set session' });
      }
    });

    this.app.delete('/auth/session', authLimiter, (req, res) => {
      try {
        res.clearCookie('sb_access_token');
        return res.json({ success: true });
      } catch (e) {
        return res.status(500).json({ success: false, error: 'Failed to clear session' });
      }
    });

    // Session health check endpoint
    this.app.get('/auth/session/health', (req, res) => {
      try {
        const token = req.cookies?.sb_access_token;
        if (!token) {
          return res.status(401).json({ 
            success: false, 
            error: 'No session token found',
            timestamp: new Date().toISOString()
          });
        }
        
        return res.json({ 
          success: true, 
          message: 'Session is valid',
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        return res.status(500).json({ 
          success: false, 
          error: 'Session health check failed',
          timestamp: new Date().toISOString()
        });
      }
    });

    // Protected Pages (must come before public routes and 404 handler)
    this.setupProtectedRoutes();

    // Public Pages
    this.setupPublicRoutes();

    // 404 Handler (catch-all for unmatched routes - MUST be last)
    this.app.use('*', (req, res) => {
      res.status(404).sendFile(path.join(config.rootDir, 'views/pages/404.html'));
    });
  }

  setupProtectedRoutes() {
    // Dashboard route - protected and routed by role
    this.app.get('/dashboard', authenticateUser, (req, res) => {
      const userRole = req.user?.role || 'citizen';
      const dashboardPath = this.getDashboardPath(userRole);
      res.sendFile(dashboardPath);
    });

    // General protected pages
    this.app.get('/myProfile', authenticateUser, (req, res) => {
      res.sendFile(path.join(config.rootDir, 'views', 'pages', 'myProfile.html'));
    });

    // File Complaint page (citizen only or staff in citizen mode)
    this.app.get('/citizen/fileComplaint', authenticateUser, (req, res) => {
      res.sendFile(path.join(config.rootDir, 'views', 'pages', 'citizen', 'fileComplaint.html'));
    });

    // Admin pages
    this.app.get('/admin/departments',
      authenticateUser,
      requireRole(['super-admin']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'admin', 'departments', 'index.html'));
      }
    );

    this.app.get('/admin/settings',
      authenticateUser,
      requireRole(['lgu-admin', 'super-admin']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'admin', 'settings', 'index.html'));
      }
    );

    this.app.get('/admin/department-structure',
      authenticateUser,
      requireRole(['super-admin']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'admin', 'department-structure.html'));
      }
    );

    // LGU-specific pages
    this.app.get('/taskAssigned',
      authenticateUser,
      requireRole([/^lgu-(?!admin|hr)/]),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'lgu', 'taskAssigned.html'));
      }
    );

    // LGU Admin specific pages
    this.app.get('/lgu-admin/heatmap',
      authenticateUser,
      requireRole(['lgu-admin', /^lgu-admin/]),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'lgu-admin', 'heatmap.html'));
      }
    );

    // Redirect /heatmap to /lgu-admin/heatmap for convenience
    this.app.get('/heatmap',
      authenticateUser,
      requireRole(['lgu-admin', /^lgu-admin/]),
      (req, res) => {
        res.redirect('/lgu-admin/heatmap');
      }
    );

    this.app.get('/publish',
      authenticateUser,
      requireRole(['lgu-admin', /^lgu-admin/]),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'lgu-admin', 'publish.html'));
      }
    );

    this.app.get('/appointMembers',
      authenticateUser,
      requireRole(['lgu-admin', /^lgu-admin/]),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'lgu-admin', 'appointMembers.html'));
      }
    );

    this.app.get('/lgu-admin/assignments',
      authenticateUser,
      requireRole(['lgu-admin', /^lgu-admin/]),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'lgu-admin', 'assignments.html'));
      }
    );

    // Super Admin specific pages
    this.app.get('/appointAdmins',
      authenticateUser,
      requireRole(['super-admin']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'super-admin', 'appointAdmins.html'));
      }
    );

    // Role-based dashboard shortcuts
    this.app.get('/citizen', authenticateUser, requireRole(['citizen']), (req, res) => {
      res.redirect('/dashboard');
    });

    this.app.get('/lgu', authenticateUser, requireRole(['lgu', /^lgu-/]), (req, res) => {
      res.redirect('/dashboard');
    });

    this.app.get('/coordinator', authenticateUser, requireRole(['complaint-coordinator']), (req, res) => {
      res.redirect('/dashboard');
    });

    // Coordinator review queue list page
    this.app.get('/coordinator/review-queue',
      authenticateUser,
      requireRole(['complaint-coordinator']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'coordinator', 'review-queue.html'));
      }
    );

    // Coordinator complaint review page (individual)
    this.app.get('/coordinator/review/:id',
      authenticateUser,
      requireRole(['complaint-coordinator']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'coordinator', 'review.html'));
      }
    );

    this.app.get('/hr', authenticateUser, requireRole(['lgu-hr', /^lgu-hr/]), (req, res) => {
      res.redirect('/dashboard');
    });

    this.app.get('/hr/link-generator', authenticateUser, requireRole(['lgu-hr', /^lgu-hr/]), (req, res) => {
      res.sendFile(path.join(config.rootDir, 'views', 'pages', 'hr', 'link-generator.html'));
    });

    // HR Role Changer dedicated page
    this.app.get('/hr/role-changer',
      authenticateUser,
      requireRole(['lgu-hr', /^lgu-hr/]),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'hr', 'role-changer.html'));
      }
    );

    // Complete Position Signup page (public - no auth required)
    this.app.get('/complete-position-signup', (req, res) => {
      res.sendFile(path.join(config.rootDir, 'views', 'pages', 'auth', 'complete-position-signup.html'));
    });

    this.app.get('/lgu-admin', authenticateUser, requireRole(['lgu-admin']), (req, res) => {
      res.redirect('/dashboard');
    });

    this.app.get('/super-admin', authenticateUser, requireRole(['super-admin']), (req, res) => {
      res.redirect('/dashboard');
    });

    // Super Admin Role Changer dedicated page
    this.app.get('/super-admin/role-changer',
      authenticateUser,
      requireRole(['super-admin']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'super-admin', 'role-changer.html'));
      }
    );

    // Legacy API endpoints for user info
    this.app.get('/api/user/profile', authenticateUser, authLimiter, (req, res) => {
      const { user } = req;
      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mobile: user.mobile,
          firstName: user.firstName,
          lastName: user.lastName,
          hasCompleteProfile: user.hasCompleteProfile
        },
      });
    });

    this.app.get('/api/user/role', authenticateUser, authLimiter, (req, res) => {
      const { user } = req;
      res.json({
        success: true,
        data: {
          role: user.role || 'citizen',
          name: user.name || 'Unknown',
        },
      });
    });

    // User role switching endpoint
    this.app.post('/api/user/switch-role', authenticateUser, authLimiter, async (req, res) => {
      try {
        const { targetRole, previousRole } = req.body;
        const { user } = req;

        if (!targetRole) {
          return res.status(400).json({
            success: false,
            error: 'targetRole is required'
          });
        }

        // Prepare new metadata
        const newMetadata = {
          ...user.raw_user_meta_data,
          role: targetRole
        };

        // If switching to citizen, store previous role as actual_role for UI logic
        if (targetRole === 'citizen' && previousRole) {
          newMetadata.actual_role = previousRole;
        }

        const { data, error } = await database.supabase.auth.admin.updateUserById(user.id, {
          user_metadata: newMetadata
        });

        if (error) {
          console.error('Error updating user role:', error);
          return res.status(500).json({
            success: false,
            error: 'Failed to update role'
          });
        }

        res.json({
          success: true,
          data: {
            role: targetRole,
            message: 'Role updated successfully'
          }
        });
      } catch (error) {
        console.error('Role switch error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    });

    // User role info endpoint (for role toggle functionality)
    this.app.get('/api/user/role-info', authenticateUser, authLimiter, (req, res) => {
      const { user } = req;
      const role = user.role || 'citizen';
      const metaActual = user.raw_user_meta_data?.actual_role || null;
      // If no meta actual_role is stored, assume staff's actual role equals their current role (not citizen)
      const actualRole = metaActual || (role !== 'citizen' ? role : null);
      res.json({
        success: true,
        data: {
          role: role,
          name: user.name || 'Unknown',
          email: user.email,
          metadata: user.raw_user_meta_data,
          actual_role: actualRole
        }
      });
    });
  }

  setupPublicRoutes() {
    // Root route
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(config.rootDir, 'views', 'pages', 'index.html'));
    });

    // Public pages
    const publicPages = ['login', 'signup', 'resetPass', 'OAuthContinuation', 'success'];
    publicPages.forEach(page => {
      this.app.get(`/${page}`, (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', `${page}.html`));
      });
    });

    // Special signup with code page
    this.app.get('/signup-with-code', (req, res) => {
      const filePath = path.join(config.rootDir, 'views', 'pages', 'auth', 'signup-with-code.html');
      res.sendFile(filePath);
    });

    // Public API endpoints
    this.app.get('/api/boundaries', apiLimiter, async (req, res) => {
      try {
        const filePath = path.join(config.rootDir, 'src', 'client', 'assets', 'brgy_boundaries_location.json');
        const fs = require('fs').promises;
        const jsonData = await fs.readFile(filePath, 'utf8');
        res.json(JSON.parse(jsonData));
      } catch (error) {
        res.status(500).json({ error: 'Failed to load boundaries data' });
      }
    });

    this.app.get('/api/reverse-geocode', apiLimiter, async (req, res) => {
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
      citizen: path.join(config.rootDir, 'views', 'pages', 'citizen', 'dashboard.html'),
      lgu: path.join(config.rootDir, 'views', 'pages', 'lgu', 'dashboard.html'),
      'complaint-coordinator': path.join(config.rootDir, 'views', 'pages', 'coordinator', 'dashboard.html'),
      'lgu-admin': path.join(config.rootDir, 'views', 'pages', 'lgu-admin', 'dashboard.html'),
      'lgu-hr': path.join(config.rootDir, 'views', 'pages', 'hr', 'dashboard.html'),
      'super-admin': path.join(config.rootDir, 'views', 'pages', 'super-admin', 'dashboard.html'),
    };

    // Check for department-specific roles (e.g., lgu-hr-{dept}, lgu-admin-{dept})
    if (userRole.startsWith('lgu-hr-')) {
      return path.join(config.rootDir, 'views', 'pages', 'hr', 'dashboard.html');
    }
    if (userRole.startsWith('lgu-admin-')) {
      return path.join(config.rootDir, 'views', 'pages', 'lgu-admin', 'dashboard.html');
    }

    return roleDashboards[userRole] || roleDashboards.citizen;
  }

  initializeErrorHandling() {
    // 404 handler for unmatched routes
    this.app.use(ErrorHandler.notFound);

    // Global error handler
    this.app.use(ErrorHandler.handle);
  }

  async start(port = 3001) {
    try {
      // Test database connection
      const isConnected = await database.testConnection();
      if (!isConnected) {
        throw new Error('Database connection failed');
      }

      this.app.listen(port, () => {
        // Server started
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

module.exports = CitizenLinkApp;
