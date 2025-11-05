const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('../../config/app');
const Database = require('./config/database');
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
    // Additional static file serving for coordinator review system
    this.app.use('/components', express.static(path.join(config.rootDir, 'public', 'components')));
    this.app.use('/styles', express.static(path.join(config.rootDir, 'public', 'styles')));
    // Serve favicon
    this.app.get('/favicon.ico', (req, res) => {
      res.sendFile(path.join(config.rootDir, 'public', 'favicon.ico'));
    });
    // Serve node_modules for browser imports
    this.app.use('/node_modules', express.static(path.join(config.rootDir, 'node_modules')));
  }
  initializeRoutes() {
    // API Routes
    this.app.use('/api', routes);
    // Session cookie helpers for client
    this.app.post('/auth/session', authLimiter, (req, res) => {
      try {
        // console.log removed for security
        // console.log removed for security
        const token = req.body?.access_token;
        const remember = Boolean(req.body?.remember);
        // console.log removed for security
        if (!token) {
          // console.log removed for security
          // console.log removed for security
          return res.status(400).json({ success: false, error: 'access_token is required' });
        }
        const cookieOptions = {
          httpOnly: true, // Set back to true for security
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 315360000000 // 10 years for development (permanent)
        };
        // console.log removed for security
        // console.log removed for security
        res.cookie('sb_access_token', token, cookieOptions);
        // console.log removed for security
        // console.log removed for security
        return res.json({ success: true });
      } catch (e) {
        console.error('[SERVER SESSION] 💥 Error setting session cookie:', e);
        console.error('[SERVER SESSION] Error stack:', e.stack);
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
    // Debug endpoint (development only)
    if (process.env.NODE_ENV === 'development') {
      this.app.get('/debug/auth', async (req, res) => {
        try {
          const diagnostics = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
            hasSupabaseServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
          };
          res.json({ success: true, diagnostics });
        } catch (error) {
          res.status(500).json({ success: false, error: error.message });
        }
      });
    }
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
    // Redirects from role-prefixed URLs to simplified URLs (backward compatibility)
    this.app.get('/citizen/fileComplaint', authenticateUser, (req, res) => {
      res.redirect('/fileComplaint');
    });
    this.app.get('/citizen/departments', authenticateUser, (req, res) => {
      res.redirect('/departments');
    });
    this.app.get('/admin/appoint-admins', authenticateUser, (req, res) => {
      res.redirect('/appoint-admins');
    });
    this.app.get('/admin/departments', authenticateUser, (req, res) => {
      res.redirect('/departments');
    });
    this.app.get('/admin/role-changer', authenticateUser, (req, res) => {
      res.redirect('/role-changer');
    });
    this.app.get('/admin/settings', authenticateUser, (req, res) => {
      res.redirect('/settings');
    });
    this.app.get('/hr/link-generator', authenticateUser, (req, res) => {
      res.redirect('/link-generator');
    });
    this.app.get('/hr/role-changer', authenticateUser, (req, res) => {
      res.redirect('/role-changer');
    });
    this.app.get('/coordinator/review-queue', authenticateUser, (req, res) => {
      res.redirect('/review-queue');
    });
    this.app.get('/coordinator/assignments', authenticateUser, (req, res) => {
      res.redirect('/assignments');
    });
    this.app.get('/coordinator/heatmap', authenticateUser, (req, res) => {
      res.redirect('/heatmap');
    });
    this.app.get('/lgu-admin/dashboard', authenticateUser, (req, res) => {
      res.redirect('/dashboard');
    });
    this.app.get('/lgu-admin/assignments', authenticateUser, (req, res) => {
      res.redirect('/assignments');
    });
    this.app.get('/lgu-admin/heatmap', authenticateUser, (req, res) => {
      res.redirect('/heatmap');
    });
    this.app.get('/lgu-admin/publish', authenticateUser, (req, res) => {
      res.redirect('/publish');
    });
    this.app.get('/lgu-officer/task-assigned', authenticateUser, (req, res) => {
      res.redirect('/task-assigned');
    });
    // Dashboard route - protected and routed by role
    this.app.get('/dashboard', authenticateUser, (req, res) => {
      const userRole = req.user?.role || 'citizen';
      const dashboardPath = this.getDashboardPath(userRole);
      res.sendFile(dashboardPath);
    });
    // General protected pages (simplified URLs)
    this.app.get('/myProfile', authenticateUser, (req, res) => {
      res.sendFile(path.join(config.rootDir, 'views', 'pages', 'myProfile.html'));
    });
    // Publication page (all authenticated roles)
    this.app.get('/publication', authenticateUser, (req, res) => {
      res.sendFile(path.join(config.rootDir, 'views', 'pages', 'publication.html'));
    });
    // File Complaint page (citizen only or staff in citizen mode)
    this.app.get('/fileComplaint', authenticateUser, (req, res) => {
      res.sendFile(path.join(config.rootDir, 'views', 'pages', 'citizen', 'fileComplaint.html'));
    });
    // Departments page (role-aware)
    this.app.get('/departments', authenticateUser, (req, res) => {
      const userRole = req.user?.role || 'citizen';
      if (userRole === 'super-admin') {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'admin', 'departments', 'index.html'));
      } else {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'citizen', 'departments.html'));
      }
    });
    // Digos City Map (citizen only)
    this.app.get('/digos-map',
      authenticateUser,
      requireRole(['citizen']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'citizen', 'digosMap.html'));
      }
    );
    // Complaint Details page (authenticated users only)
    this.app.get('/complaint-details', authenticateUser, (req, res) => {
      res.sendFile(path.join(config.rootDir, 'views', 'pages', 'complaint-details.html'));
    });
    // Complaint Details page with ID parameter
    this.app.get('/complaint-details/:id', authenticateUser, (req, res) => {
      res.sendFile(path.join(config.rootDir, 'views', 'pages', 'complaint-details.html'));
    });
    // Admin pages (simplified URLs)
    this.app.get('/appoint-admins',
      authenticateUser,
      requireRole(['super-admin']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'super-admin', 'appointAdmins.html'));
      }
    );
    this.app.get('/settings',
      authenticateUser,
      requireRole(['lgu-admin', 'super-admin']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'admin', 'settings', 'index.html'));
      }
    );
    this.app.get('/role-changer',
      authenticateUser,
      requireRole(['super-admin', 'lgu-hr']),
      (req, res) => {
        const userRole = req.user?.role || 'citizen';
        if (userRole === 'super-admin') {
          res.sendFile(path.join(config.rootDir, 'views', 'pages', 'super-admin', 'role-changer.html'));
        } else {
          res.sendFile(path.join(config.rootDir, 'views', 'pages', 'hr', 'role-changer.html'));
        }
      }
    );
    // LGU-specific pages (simplified URLs)
    this.app.get('/task-assigned',
      authenticateUser,
      requireRole(['lgu']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'lgu-officer', 'assigned-tasks.html'));
      }
    );
    // LGU Admin specific pages (simplified URLs)
    this.app.get('/assignments',
      authenticateUser,
      requireRole(['lgu-admin', 'complaint-coordinator']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'lgu-admin', 'assignments.html'));
      }
    );
    this.app.get('/heatmap',
      authenticateUser,
      requireRole(['lgu-admin', 'complaint-coordinator']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'lgu-admin', 'heatmap.html'));
      }
    );
    this.app.get('/publish',
      authenticateUser,
      requireRole(['lgu-admin']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'lgu-admin', 'publish.html'));
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
    this.app.get('/lgu', authenticateUser, requireRole(['lgu']), (req, res) => {
      res.redirect('/dashboard');
    });
    this.app.get('/coordinator', authenticateUser, requireRole(['complaint-coordinator']), (req, res) => {
      res.redirect('/dashboard');
    });
    // HR specific pages (simplified URLs)
    this.app.get('/link-generator',
      authenticateUser,
      requireRole(['lgu-hr']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'hr', 'link-generator.html'));
      }
    );
    // Coordinator review queue list page (simplified URLs)
    this.app.get('/review-queue',
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
    // Complete Position Signup page (public - no auth required)
    this.app.get('/complete-position-signup', (req, res) => {
      res.sendFile(path.join(config.rootDir, 'views', 'pages', 'auth', 'complete-position-signup.html'));
    });
    this.app.get('/lgu-admin', authenticateUser, requireRole(['lgu-admin']), (req, res) => {
      res.redirect('/dashboard');
    });
    // LGU Officer routes (simplified URLs)
    this.app.get('/lgu-officer/dashboard',
      authenticateUser,
      requireRole(['lgu']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'lgu-officer', 'dashboard.html'));
      }
    );
    // LGU Officer tasks page (alias for task-assigned)
    this.app.get('/lgu-officer/tasks',
      authenticateUser,
      requireRole(['lgu']),
      (req, res) => {
        res.sendFile(path.join(config.rootDir, 'views', 'pages', 'lgu-officer', 'assigned-tasks.html'));
      }
    );
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
        // Prepare new metadata to write via Admin API
        const newMetadata = {
          ...(user.raw_user_meta_data || {}),
          role: targetRole
        };
        if (targetRole === 'citizen' && previousRole) {
          newMetadata.base_role = previousRole;
        } else if (targetRole !== 'citizen') {
          // Leaving citizen mode: clear base_role for clarity
          delete newMetadata.base_role;
        }

        // Use Supabase Admin API to update auth user metadata (reliable and supported)
        const supabase = Database.getClient();
        const { error: adminUpdateError } = await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: newMetadata,
          raw_user_meta_data: newMetadata
        });
        if (adminUpdateError) {
          console.error('Error updating user role via admin API:', adminUpdateError);
          return res.status(500).json({ success: false, error: 'Failed to update role' });
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
      const metaBase = user.raw_user_meta_data?.base_role || null;
      // If no meta base_role is stored, assume staff's base role equals their current role (not citizen)
      const baseRole = metaBase || (role !== 'citizen' ? role : null);
      // Debug logging
      // console.log removed for security
      // console.log removed for security
      res.json({
        success: true,
        data: {
          role,
          name: user.name || 'Unknown',
          email: user.email,
          metadata: user.raw_user_meta_data,
          base_role: baseRole,
          actual_role: baseRole  // Add this for compatibility with frontend
        }
      });
    });
    // Debug endpoint for role switcher
    this.app.get('/debug-role-switcher', authenticateUser, (req, res) => {
      const { user } = req;
      const role = user.role || 'citizen';
      const metaBase = user.raw_user_meta_data?.base_role || null;
      const baseRole = metaBase || (role !== 'citizen' ? role : null);
      const isInCitizen = role === 'citizen' && baseRole && baseRole !== 'citizen';
      const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Debug Role Switcher</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .info { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
        .button:hover { background: #0056b3; }
    </style>
</head>
<body>
    <h1>Role Switcher Debug</h1>
    
    <div class="info">
        <h3>API Response:</h3>
        <pre>${JSON.stringify({
    success: true,
    data: {
      role,
      name: user.name || 'Unknown',
      email: user.email,
      metadata: user.raw_user_meta_data,
      base_role: baseRole,
      actual_role: baseRole
    }
  }, null, 2)}</pre>
    </div>
    
    <div class="info">
        <h3>Role Analysis:</h3>
        <p><strong>Current Role:</strong> ${role}</p>
        <p><strong>Base Role:</strong> ${baseRole}</p>
        <p><strong>Is in Citizen Mode:</strong> ${isInCitizen}</p>
        <p><strong>Should Show Button:</strong> ${isInCitizen}</p>
    </div>
    
    <div class="info">
        <h3>Role Switcher Button:</h3>
        ${isInCitizen ?
    `<button class="button" onclick="switchRole()">Switch to ${baseRole.toUpperCase()}</button>` :
    '<p>No button should appear - user is not in citizen mode with base role</p>'
}
    </div>
    <script>
        async function switchRole() {
            try {
                const response = await fetch('/api/user/switch-role', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        targetRole: '${baseRole}',
                        previousRole: 'citizen'
                    })
                });
                if (response.ok) {
                    alert('Role switched successfully! Page will reload...');
                    window.location.reload();
                } else {
                    alert('Failed to switch role');
                }
            } catch (error) {
                alert('Error switching role: ' + error.message);
            }
        }
    </script>
</body>
</html>`;

      res.send(html);
    });

    // Session health endpoint for monitoring (public - no auth required)
    this.app.get('/auth/session/health', async (req, res) => {
      try {
        // console.log removed for security

        // Check if user has valid session cookie
        const token = req.cookies?.sb_access_token;

        if (!token) {
          // console.log removed for security
          return res.status(401).json({
            success: false,
            error: 'No session token found',
            data: {
              authenticated: false,
              timestamp: new Date().toISOString()
            }
          });
        }

        // console.log removed for security

        // Try to validate token with Supabase using the correct method
        const { data: { user }, error } = await Database.getClient().auth.getUser(token);

        if (error || !user) {
          // console.log removed for security
          return res.status(401).json({
            success: false,
            error: 'Invalid session token',
            data: {
              authenticated: false,
              timestamp: new Date().toISOString()
            }
          });
        }

        // console.log removed for security

        // Extract role from user metadata
        const userMetadata = user.user_metadata || {};
        const rawUserMetaData = user.raw_user_meta_data || {};
        const combinedMetadata = { ...userMetadata, ...rawUserMetaData };
        const role = combinedMetadata.role || 'citizen';
        const name = combinedMetadata.name || user.email?.split('@')[0] || 'Unknown';

        // console.log removed for security

        res.json({
          success: true,
          data: {
            authenticated: true,
            userId: user.id,
            email: user.email,
            role,
            name,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('[SESSION HEALTH] Error:', error);
        res.status(500).json({
          success: false,
          error: 'Session health check failed',
          data: {
            authenticated: false,
            timestamp: new Date().toISOString()
          }
        });
      }
    });

    // Session refresh endpoint (public - no auth required)
    this.app.post('/auth/session/refresh', async (req, res) => {
      try {
        // Check if user has existing session cookie
        const existingToken = req.cookies?.sb_access_token;

        if (!existingToken) {
          return res.status(401).json({
            success: false,
            error: 'No existing session to refresh',
            data: {
              refreshed: false,
              timestamp: new Date().toISOString()
            }
          });
        }

        // Try to get fresh session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          return res.status(401).json({
            success: false,
            error: 'No valid Supabase session found',
            debug: {
              error: error?.message,
              hasSession: Boolean(session)
            }
          });
        }

        // Update server cookie with fresh session
        const cookieOptions = {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 4 * 60 * 60 * 1000 // 4 hours
        };

        res.cookie('sb_access_token', session.access_token, cookieOptions);

        // Extract user info from session
        const {user} = session;
        const userMetadata = user.user_metadata || {};
        const rawUserMetaData = user.raw_user_meta_data || {};
        const combinedMetadata = { ...userMetadata, ...rawUserMetaData };
        const role = combinedMetadata.role || 'citizen';
        const name = combinedMetadata.name || user.email?.split('@')[0] || 'Unknown';

        res.json({
          success: true,
          data: {
            userId: user.id,
            email: user.email,
            role,
            name,
            refreshed: true,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('[SESSION REFRESH] Error:', error);
        res.status(500).json({
          success: false,
          error: 'Session refresh failed',
          debug: {
            error: error.message
          }
        });
      }
    });

    // Simple authentication test endpoint (public)
    this.app.get('/auth/test', (req, res) => {
      try {
        const token = req.cookies?.sb_access_token;

        if (!token) {
          return res.json({
            success: false,
            authenticated: false,
            message: 'No session token found',
            timestamp: new Date().toISOString()
          });
        }

        // Try to validate token
        supabase.auth.getUser(token).then(({ data: { user }, error }) => {
          if (error || !user) {
            return res.json({
              success: false,
              authenticated: false,
              message: 'Invalid session token',
              error: error?.message,
              timestamp: new Date().toISOString()
            });
          }

          res.json({
            success: true,
            authenticated: true,
            message: 'Session is valid',
            userId: user.id,
            email: user.email,
            timestamp: new Date().toISOString()
          });
        }).catch(error => {
          res.json({
            success: false,
            authenticated: false,
            message: 'Token validation failed',
            error: error.message,
            timestamp: new Date().toISOString()
          });
        });
      } catch (error) {
        res.json({
          success: false,
          authenticated: false,
          message: 'Authentication test failed',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  setupPublicRoutes() {
    // Root route
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(config.rootDir, 'views', 'pages', 'index.html'));
    });

    // Public pages
    const publicPages = ['login', 'signup', 'resetPass', 'reset-password', 'OAuthContinuation', 'success', 'email-verification-success'];
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
    // Check for simplified LGU roles
    if (userRole === 'lgu-hr') {
      return path.join(config.rootDir, 'views', 'pages', 'hr', 'dashboard.html');
    }
    if (userRole === 'lgu-admin') {
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
      const isConnected = await Database.getInstance().testConnection();
      if (!isConnected) {
        throw new Error('Database connection failed');
      }
      // Initialize reminder service
      const ReminderService = require('./services/ReminderService');

      const reminderService = new ReminderService();
      reminderService.startScheduler();
      // console.log removed for security
      this.app.listen(port, () => {
        // console.log removed for security
        // console.log removed for security
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

module.exports = CitizenLinkApp;
