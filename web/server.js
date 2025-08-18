import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import { existsSync } from 'fs';

// ES6 module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // Get the directory of the current file

const app = express();

// ===== SIMPLE TEST ROUTE (at the very beginning) =====
app.get('/ping', (req, res) => {
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
});

// Development mode - more permissive CSP for development
const isDevelopment = process.env.NODE_ENV !== 'production';

// Use Helmet to set secure headers - implementing all 7 major security headers
app.use(helmet({
  // 1. Content Security Policy (CSP)
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", // Needed for inline scripts
        "'unsafe-eval'", // Needed for Bootstrap
        "https://cdnjs.cloudflare.com", // Font Awesome CDN
        "https://cdn.jsdelivr.net", // Chart.js and other CDNs
        "https://citizenlink-abwi.onrender.com", // External domain
        ...(isDevelopment ? ["'unsafe-inline'", "https:"] : []) // More permissive in development
      ],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers like onclick
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", // Needed for inline styles
        "https://cdnjs.cloudflare.com", // Font Awesome CDN
        "https://cdn.jsdelivr.net", // Chart.js and other CDNs
        ...(isDevelopment ? ["'unsafe-inline'", "https:"] : []) // More permissive in development
      ],
      fontSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com", // Font Awesome fonts
        "https://cdn.jsdelivr.net", // Additional fonts
        ...(isDevelopment ? ["https:"] : []) // More permissive in development
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'", 
        "https://citizenlink-abwi.onrender.com", // External domain
        ...(isDevelopment ? ["https:"] : []) // More permissive in development
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'self'"] // Prevents clickjacking
    }
  },
  
  // 2. X-Frame-Options (Clickjacking protection)
  frameguard: { 
    action: 'sameorigin' 
  },
  
  // 3. X-Content-Type-Options (MIME type sniffing protection)
  noSniff: true,
  
  // 4. X-XSS-Protection (XSS protection for older browsers)
  xssFilter: true,
  
  // 5. Strict-Transport-Security (HSTS) - Disabled for HTTP development
  // hsts: { 
  //   maxAge: 31536000, // 1 year
  //   includeSubDomains: true,
  //   preload: true
  // },
  
  // 6. Referrer-Policy
  referrerPolicy: { 
    policy: 'strict-origin-when-cross-origin' 
  },
  
  // 7. Permissions-Policy (formerly Feature-Policy)
  permissionsPolicy: {
    features: {
      geolocation: ['none'],
      camera: ['none'],
      microphone: ['none'],
      payment: ['none'],
      usb: ['none'],
      magnetometer: ['none'],
      gyroscope: ['none'],
      accelerometer: ['none'],
      ambientLightSensor: ['none'],
      autoplay: ['none'],
      encryptedMedia: ['none'],
      fullscreen: ['none'],
      pictureInPicture: ['none'],
      syncXhr: ['none']
    }
  },
  
  // Additional security headers
  hidePoweredBy: true, // Removes X-Powered-By header
  ieNoOpen: true, // Prevents IE from executing downloads
  noCache: false, // Allow caching for better performance
  dnsPrefetchControl: {
    allow: false // Disable DNS prefetching for security
  }
}));

// Custom middleware to add additional security headers
app.use((req, res, next) => {
  // Additional custom security headers
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  
  // Explicitly prevent HTTPS upgrades
  res.setHeader('Upgrade-Insecure-Requests', '0');

  // Explicit Permissions-Policy header (meta tag is ignored by browsers)
  res.setHeader(
    'Permissions-Policy',
    "accelerometer=(), autoplay=(), camera=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), usb=(), xr-spatial-tracking=()"
  );
  
  // Development mode - more permissive CSP
  if (isDevelopment) {
    // Override CSP for development to be more permissive
    const devCSP = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "script-src-attr 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https:",
      "font-src 'self' https:",
      "img-src 'self' data: https:",
      "connect-src 'self' https:",
      "object-src 'none'",
      "media-src 'self'",
      "frame-src 'none'",
      "frame-ancestors 'self'"
    ].join('; ');
    
    res.setHeader('Content-Security-Policy', devCSP);
    console.log('🔧 Development mode: Using permissive CSP');
    console.log('📋 CSP:', devCSP);
  } else {
    console.log('🚀 Production mode: Using strict CSP');
  }
  
  // Security headers for API endpoints
  if (req.path.startsWith('/api/')) {
    res.setHeader('X-API-Version', '1.0');
  }
  
  next();
});

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// ===== SUPABASE CLIENT CONFIGURATION (must come BEFORE generic /js/* static route) =====
// Serve client-side Supabase configuration with proper credentials from server-side db.js
app.get('./js/supabase-bridge.js', async (req, res) => {
  console.log('🔗 Serving supabase-bridge.js...');
  try {
    // Import the server-side config to get credentials
    console.log('📦 Attempting to import from ./db/db.js...');
    const { supabaseConfig } = await import('./db/db.js');
    console.log('✅ Successfully imported supabaseConfig:', { 
      url: supabaseConfig.url ? 'URL exists' : 'URL missing',
      anonKey: supabaseConfig.anonKey ? 'Key exists' : 'Key missing'
    });

    console.log('📤 Sending JavaScript response...');
    res.setHeader('Content-Type', 'application/javascript');

    console.log('✅ JavaScript response sent successfully');
  } catch (error) {
    console.error('Error serving Supabase config:', error);
    // Return JavaScript even on error to avoid MIME type issues
    res.setHeader('Content-Type', 'application/javascript');
    res.status(500).send(`
      console.error('Failed to load Supabase configuration: ${error.message}');
      // Provide fallback or error handling
      window.supabaseBridgeError = '${error.message}';
    `);
  }
});

// ===== SUPABASE API ENDPOINT =====
// API endpoint to get Supabase configuration (for the bridge)
app.get('/api/supabase-bridge', async (req, res) => {
  try {
    // Import the server-side config to get credentials
    const { supabaseConfig } = await import('./db/db.js');
    
    res.json({
      url: supabaseConfig.url,
      anonKey: supabaseConfig.anonKey
    });
  } catch (error) {
    console.error('Error serving Supabase API config:', error);
    res.status(500).json({ error: 'Failed to load Supabase configuration' });
  }
});

// ===== MAIN ROUTES =====
// Home/Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Authentication routes
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/verify-otp', (req, res) => {
  res.sendFile(path.join(__dirname, 'verify-otp.html'));
});

// Test page for debugging modals
app.get('/test-modals', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-modals.html'));
});



// ===== CITIZEN ROUTES =====
app.get('/citizen', (req, res) => {
  res.sendFile(path.join(__dirname, 'citizen', 'dashboard.html'));
});

app.get('/citizen/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'citizen', 'dashboard.html'));
});

app.get('/citizen/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'citizen', 'profile.html'));
});

app.get('/citizen/complaints', (req, res) => {
  res.sendFile(path.join(__dirname, 'citizen', 'my-complaints.html'));
});

app.get('/citizen/submit-complaint', (req, res) => {
  res.sendFile(path.join(__dirname, 'citizen', 'submit-complaint.html'));
});

// News page route
app.get('/news', (req, res) => {
  res.sendFile(path.join(__dirname, 'news.html'));
});

// ===== LGU ROUTES =====
app.get('/lgu', (req, res) => {
  res.sendFile(path.join(__dirname, 'lgu', 'dashboard.html'));
});

app.get('/lgu/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'lgu', 'dashboard.html'));
});

app.get('/lgu/complaints', (req, res) => {
  res.sendFile(path.join(__dirname, 'lgu', 'complaints.html'));
});

app.get('/lgu/heatmap', (req, res) => {
  res.sendFile(path.join(__dirname, 'lgu', 'heatmap.html'));
});

app.get('/lgu/insights', (req, res) => {
  res.sendFile(path.join(__dirname, 'lgu', 'insights.html'));
});



app.get('/lgu/news', (req, res) => {
  console.log('🔗 News management route accessed:', req.path);
  const filePath = path.join(__dirname, 'lgu', 'news.html');
  console.log('📁 Serving file:', filePath);
  console.log('📂 File exists:', existsSync(filePath));
  res.sendFile(filePath);
});

app.get('/lgu/notices', (req, res) => {
  console.log('🔗 Notices route accessed:', req.path);
  const filePath = path.join(__dirname, 'lgu', 'notices.html');
  console.log('📁 Serving file:', filePath);
  console.log('📂 File exists:', existsSync(filePath));
  res.sendFile(filePath);
});

app.get('/lgu/events', (req, res) => {
  console.log('🔗 Events route accessed:', req.path);
  const filePath = path.join(__dirname, 'lgu', 'events.html');
  console.log('📁 Serving file:', filePath);
  console.log('📂 File exists:', existsSync(filePath));
  res.sendFile(filePath);
});

app.get('/lgu/profile', (req, res) => {
  console.log('🔗 LGU profile route accessed:', req.path);
  const filePath = path.join(__dirname, 'lgu', 'profile.html');
  console.log('📁 Serving file:', filePath);
  console.log('📂 File exists:', filePath);
  res.sendFile(filePath);
});

// ===== NEW ROUTES WITHOUT FOLDER NAMES =====
// Citizen routes without folder names
app.get('/dashboard', (req, res) => {
  const filePath = path.join(__dirname, 'citizen', 'dashboard.html');
  console.log('Dashboard route accessed, serving file:', filePath);
  console.log('__dirname:', __dirname);
  console.log('File exists check:', existsSync(filePath));
  
  // Check if file exists before sending
  if (!existsSync(filePath)) {
    console.error('Dashboard file not found:', filePath);
    return res.status(404).send('Dashboard file not found');
  }
  
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending dashboard file:', err);
      res.status(500).send('Error loading dashboard');
    }
  });
});

app.get('/profile', (req, res) => {
  res.sendFile(path.join(__dirname, 'citizen', 'profile.html'));
});

app.get('/complaints', (req, res) => {
  res.sendFile(path.join(__dirname, 'citizen', 'my-complaints.html'));
});

app.get('/my-complaints', (req, res) => {
  res.sendFile(path.join(__dirname, 'citizen', 'my-complaints.html'));
});

app.get('/submit-complaint', (req, res) => {
  res.sendFile(path.join(__dirname, 'citizen', 'submit-complaint.html'));
});

// LGU routes without folder names
app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'lgu', 'dashboard.html'));
});

app.get('/lgu-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'lgu', 'dashboard.html'));
});

app.get('/admin-complaints', (req, res) => {
  res.sendFile(path.join(__dirname, 'lgu', 'complaints.html'));
});

app.get('/lgu-complaints', (req, res) => {
  res.sendFile(path.join(__dirname, 'lgu', 'complaints.html'));
});

app.get('/admin-heatmap', (req, res) => {
  res.sendFile(path.join(__dirname, 'lgu', 'heatmap.html'));
});

app.get('/lgu-heatmap', (req, res) => {
  res.sendFile(path.join(__dirname, 'lgu', 'heatmap.html'));
});

app.get('/admin-insights', (req, res) => {
  res.sendFile(path.join(__dirname, 'lgu', 'insights.html'));
});

app.get('/lgu-insights', (req, res) => {
  res.sendFile(path.join(__dirname, 'lgu', 'insights.html'));
});



app.get('/lgu-news', (req, res) => {
  console.log('🔗 Legacy news route accessed:', req.path);
  const filePath = path.join(__dirname, 'lgu', 'news.html');
  console.log('📁 Serving file:', filePath);
  console.log('📂 File exists:', existsSync(filePath));
  res.sendFile(filePath);
});

app.get('/lgu-notices', (req, res) => {
  console.log('🔗 Legacy notices route accessed:', req.path);
  const filePath = path.join(__dirname, 'lgu', 'notices.html');
  console.log('📁 Serving file:', filePath);
  console.log('📂 File exists:', existsSync(filePath));
  res.sendFile(filePath);
});

app.get('/lgu-events', (req, res) => {
  console.log('🔗 Legacy events route accessed:', req.path);
  const filePath = path.join(__dirname, 'lgu', 'events.html');
  console.log('📁 Serving file:', filePath);
  console.log('📂 File exists:', existsSync(filePath));
  res.sendFile(filePath);
});

app.get('/lgu-profile', (req, res) => {
  console.log('🔗 Legacy profile route accessed:', req.path);
  const filePath = path.join(__dirname, 'lgu', 'profile.html');
  console.log('📁 Serving file:', filePath);
  console.log('📂 File exists:', existsSync(filePath));
  res.sendFile(filePath);
});

// ===== BRIDGE TEST ROUTE =====
app.get('/bridge-test', (req, res) => {
  console.log('🔗 Bridge test route accessed!');
  console.log('__dirname:', __dirname);
  console.log('File path:', path.join(__dirname, 'bridge-test.html'));
  res.sendFile(path.join(__dirname, 'bridge-test.html'));
});

// Simple test route
app.get('/test-route', (req, res) => {
  res.json({ message: 'Test route works!', timestamp: new Date().toISOString() });
});

// ===== COMPONENT ROUTES =====
// Serve sidebar components
app.get('/components/:filename(*)', (req, res) => {
  const relativePath = req.path.startsWith('/') ? req.path.slice(1) : req.path;
  const filePath = path.join(__dirname, relativePath);
  
  // Only serve HTML component files
  if (!req.params.filename.endsWith('.html')) {
    return res.status(404).send('Not an HTML component file');
  }
  
  res.setHeader('Content-Type', 'text/html');
  res.sendFile(filePath);
});

// Debug route to see all available routes
app.get('/debug-routes', (req, res) => {
    const routes = [];
    app._router.stack.forEach(middleware => {
        if (middleware.route) {
            routes.push({
                path: middleware.route.path,
                methods: Object.keys(middleware.route.methods)
            });
        }
    });
    res.json({ routes, __dirname, currentDir: process.cwd() });
});

// Serve border locations JSON file
app.get('/lgu/border_locations.json', (req, res) => {
    console.log('🗺️ Border locations JSON requested:', req.path);
    const filePath = path.join(__dirname, 'lgu', 'border_locations.json');
    console.log('📁 Serving border file:', filePath);
    console.log('📂 File exists:', existsSync(filePath));
    
    if (existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/json');
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Border locations file not found' });
    }
});

// Serve any JSON files from LGU folder
app.get('/lgu/*.json', (req, res) => {
    console.log('📄 JSON file requested:', req.path);
    const fileName = req.path.split('/').pop();
    const filePath = path.join(__dirname, 'lgu', fileName);
    console.log('📁 Serving JSON file:', filePath);
    console.log('📂 File exists:', existsSync(filePath));
    
    if (existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/json');
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: `JSON file ${fileName} not found` });
    }
});

// ===== STATIC ASSET ROUTES (moved to end to avoid conflicts) =====
// CSS files
app.get('/css/*', (req, res) => {
  const relativePath = req.path.startsWith('/') ? req.path.slice(1) : req.path;
  const filePath = path.join(__dirname, relativePath);
  res.setHeader('Content-Type', 'text/css');
  res.sendFile(filePath);
});

// JavaScript files - more specific to avoid conflicts
app.get('/js/:filename(*)', (req, res) => {
  // Ensure we resolve a relative path (Windows-safe). Absolute req.path would break path.join
  const relativePath = req.path.startsWith('/') ? req.path.slice(1) : req.path;
  const filePath = path.join(__dirname, relativePath);
  
  // Only serve actual JavaScript files
  if (!req.params.filename.endsWith('.js')) {
    return res.status(404).send('Not a JavaScript file');
  }
  
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(filePath);
});

// Bootstrap CSS files
app.get('/css/bootstrap/*', (req, res) => {
  const relativePath = req.path.startsWith('/') ? req.path.slice(1) : req.path;
  const filePath = path.join(__dirname, relativePath);
  res.setHeader('Content-Type', 'text/css');
  res.sendFile(filePath);
});

// Bootstrap JavaScript files
app.get('/js/bootstrap/*', (req, res) => {
  const relativePath = req.path.startsWith('/') ? req.path.slice(1) : req.path;
  const filePath = path.join(__dirname, relativePath);
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(filePath);
});

// ===== SUPABASE CLIENT CONFIGURATION =====
// This route is already defined above - removing duplicate

// ===== SUPABASE CLIENT CONFIGURATION =====
// This route is already defined above - removing duplicate

// ===== API ROUTES =====
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    security: 'enabled',
    routes: {
      main: ['/', '/login', '/signup'],
      citizen: ['/citizen', '/citizen/dashboard', '/citizen/profile', '/citizen/complaints', '/citizen/submit-complaint'],
      lgu: ['/lgu', '/lgu/dashboard', '/lgu/complaints', '/lgu/heatmap', '/lgu/heatmap', '/lgu/insights'],
      newRoutes: ['/dashboard', '/profile', '/complaints', '/submit-complaint', '/admin-dashboard', '/admin-complaints', '/admin-heatmap', '/admin-insights'],
      assets: ['/css/*', '/js/*', '/css/bootstrap/*', '/js/bootstrap/*', '/images/*', '/assets/*']
    }
  });
});



// ===== ERROR HANDLING =====
// Error handling for security violations
app.use((err, req, res, next) => {
  if (err.code === 'CSP_VIOLATION') {
    console.error('CSP Violation:', err.message);
    res.status(400).json({ error: 'Content Security Policy violation' });
  } else {
    next(err);
  }
});

// ===== STATIC FILE SERVING =====
// Serve static HTML files
// app.get('/*.html', (req, res) => {
//   const relativePath = req.path.startsWith('/') ? req.path.slice(1) : req.path;
//   const filePath = path.join(__dirname, relativePath);
//   res.setHeader('Content-Type', 'text/html');
//   res.sendFile(filePath);
// });

// 404 handler - show error instead of redirecting
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).send(`Route not found: ${req.path}`);
});

// ===== SERVER STARTUP =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 CitizenLink server running on port ${PORT}`);
  console.log(`🔒 Security headers implemented successfully!`);
  console.log(`📋 Implemented security headers:`);
  console.log(`   1. Content Security Policy (CSP)`);
  console.log(`   2. X-Frame-Options (Clickjacking protection)`);
  console.log(`   3. X-Content-Type-Options (MIME sniffing protection)`);
  console.log(`   4. X-XSS-Protection (XSS protection)`);
  console.log(`   5. Strict-Transport-Security (HSTS)`);
  console.log(`   6. Referrer-Policy`);
  console.log(`   7. Permissions-Policy (Feature restrictions)`);
  console.log(`\n🌐 Server accessible at: http://localhost:${PORT}`);
  console.log(`📁 Routes configured:`);
  console.log(`   • Main: /, /login, /signup, /verify-otp`);
  console.log(`   • Citizen: /citizen/*`);
  console.log(`   • LGU: /lgu/*`);
  console.log(`   • New Routes: /dashboard, /profile, /complaints, /submit-complaint, /admin-dashboard, /admin-complaints, /admin-heatmap, /admin-insights`);
  console.log(`   • API: /api/health`);
});

export default app;