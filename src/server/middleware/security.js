const helmet = require('helmet');

// Content Security Policy configuration
const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // Required for existing inline styles - TODO: Remove when styles are externalized
      "https://fonts.googleapis.com",
      "https://unpkg.com"
    ],
    scriptSrc: [
      "'self'",
      "'unsafe-eval'", // Required for dynamic imports - TODO: Remove when all scripts are static
      "https://www.google.com",
      "https://www.gstatic.com",
      "https://unpkg.com",
      "https://esm.sh"
    ],
    imgSrc: [
      "'self'",
      "data:",
      "blob:",
      "https://*.tile.openstreetmap.org",
      "https://server.arcgisonline.com",
      "https://*.basemaps.cartocdn.com",
      "https://*.tile.opentopomap.org"
    ],
    connectSrc: [
      "'self'",
      "https://*.supabase.co",
      "https://nominatim.openstreetmap.org"
    ],
    fontSrc: [
      "'self'",
      "https://fonts.gstatic.com"
    ],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: [
      "https://www.google.com"
    ]
  }
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // HSTS for HTTPS (only in production)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

module.exports = {
  securityHeaders,
  cspConfig
};
