import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';

// ES6 module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // Get the directory of the current file

const app = express();

// Use Helmet to set secure headers - implementing all 7 major security headers
app.use(helmet({
  // 1. Content Security Policy (CSP)
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", // Needed for inline scripts
        "https://cdnjs.cloudflare.com" // Font Awesome CDN
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", // Needed for inline styles
        "https://cdnjs.cloudflare.com" // Font Awesome CDN
      ],
      fontSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com" // Font Awesome fonts
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'self'"], // Prevents clickjacking
      upgradeInsecureRequests: []
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
  
  // 5. Strict-Transport-Security (HSTS)
  hsts: { 
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
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

app.get('/citizen/analytics', (req, res) => {
  res.sendFile(path.join(__dirname, 'citizen', 'analytics.html'));
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

// ===== STATIC ASSET ROUTES =====
// CSS files
app.get('/css/*', (req, res) => {
  const filePath = path.join(__dirname, req.path);
  res.setHeader('Content-Type', 'text/css');
  res.sendFile(filePath);
});

// JavaScript files
app.get('/js/*', (req, res) => {
  const filePath = path.join(__dirname, req.path);
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(filePath);
});

// Bootstrap CSS files
app.get('/css/bootstrap/*', (req, res) => {
  const filePath = path.join(__dirname, req.path);
  res.setHeader('Content-Type', 'text/css');
  res.sendFile(filePath);
});

// Bootstrap JavaScript files
app.get('/js/bootstrap/*', (req, res) => {
  const filePath = path.join(__dirname, req.path);
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(filePath);
});

// Font Awesome CDN (already handled by CSP)
// Images and other assets
app.get('/images/*', (req, res) => {
  const filePath = path.join(__dirname, req.path);
  const ext = path.extname(filePath).toLowerCase();
  
  // Set appropriate MIME type based on file extension
  const mimeTypes = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  
  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  res.sendFile(filePath);
});

// Robots.txt route for SEO
app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.sendFile(path.join(__dirname, 'robots.txt'));
});

// Sitemap route for SEO
app.get('/sitemap.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// Catch-all for other static assets (fonts, etc.)
app.get('/assets/*', (req, res) => {
  const filePath = path.join(__dirname, req.path);
  const ext = path.extname(filePath).toLowerCase();
  
  // Set appropriate MIME type based on file extension
  const mimeTypes = {
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'font/otf',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.txt': 'text/plain'
  };
  
  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  res.sendFile(filePath);
});

// ===== API ROUTES =====
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    security: 'enabled',
    routes: {
      main: ['/', '/login', '/signup'],
      citizen: ['/citizen', '/citizen/dashboard', '/citizen/profile', '/citizen/complaints', '/citizen/submit-complaint', '/citizen/analytics'],
      lgu: ['/lgu', '/lgu/dashboard', '/lgu/complaints', '/lgu/heatmap', '/lgu/insights'],
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

// 404 handler - redirect to home page
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.path}`);
  res.redirect('/');
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
  console.log(`   • API: /api/health`);
});

export default app;
