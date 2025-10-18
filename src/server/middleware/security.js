const helmet = require('helmet');

// Content Security Policy configuration
const cspConfig = {
  directives: {
    defaultSrc: ['\'self\''],
    styleSrc: [
      '\'self\'',
      '\'unsafe-inline\'', // Required for existing inline styles - TODO: Remove when styles are externalized
      'https://fonts.googleapis.com',
      'https://unpkg.com'
    ],
    scriptSrc: [
      '\'self\'',
      '\'unsafe-eval\'', // Required for dynamic imports - TODO: Remove when all scripts are static
      'https://www.google.com',
      'https://www.gstatic.com',
      'https://unpkg.com',
      'https://esm.sh'
    ],
    imgSrc: [
      '\'self\'',
      'data:',
      'blob:',
      'https://*.tile.openstreetmap.org',
      'https://server.arcgisonline.com',
      'https://*.basemaps.cartocdn.com',
      'https://*.tile.opentopomap.org'
    ],
    connectSrc: [
      '\'self\'',
      'https://*.supabase.co',
      'https://nominatim.openstreetmap.org'
    ],
    fontSrc: [
      '\'self\'',
      'data:',
      'https://fonts.gstatic.com'
    ],
    objectSrc: ['\'none\''],
    mediaSrc: ['\'self\''],
    frameSrc: [
      'https://www.google.com'
    ],
    // Additional CSP directives for enhanced security
    baseUri: ['\'self\''],
    formAction: ['\'self\''],
    frameAncestors: ['\'none\''],
  }
};

// Add upgrade-insecure-requests only in production
if (process.env.NODE_ENV === 'production') {
  cspConfig.directives.upgradeInsecureRequests = true;
}

// Enhanced security headers using helmet
const securityHeaders = helmet({
  contentSecurityPolicy: cspConfig,
  crossOriginEmbedderPolicy: false, // Disable for now due to compatibility issues
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  dnsPrefetchControl: { allow: false },
  ieNoOpen: true,
});

// Additional custom security headers
const customSecurityHeaders = (req, res, next) => {
  // Remove server information disclosure
  res.removeHeader('X-Powered-By');

  // Permissions Policy (formerly Feature Policy)
  res.setHeader('Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  next();
};

module.exports = {
  securityHeaders,
  cspConfig,
  customSecurityHeaders
};
