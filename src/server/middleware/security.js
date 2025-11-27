const helmet = require('helmet');

// Content Security Policy configuration
const cspConfig = {
  directives: {
    defaultSrc: ['\'self\''],
    styleSrc: [
      '\'self\'',
      '\'unsafe-inline\'', // TODO: remove after moving inline styles
      'https://fonts.googleapis.com',
      'https://unpkg.com'
    ],
    scriptSrc: [
      '\'self\'',
      '\'unsafe-eval\'', // Required for some reCAPTCHA implementations
      // Allow specific inline script hash for dashboard
      '\'sha256-0Dr8sVaJkoiX93UyTTWlbHfCjfIBgNYRC1k4YSi6ZY8=\'',
      'https://www.google.com',
      'https://www.gstatic.com',
      'https://unpkg.com',
      'https://esm.sh'
    ],
    // Disallow inline event handlers (onclick, etc.) — move logic to JS modules
    imgSrc: [
      '\'self\'',
      'data:',
      'blob:',
      'https://*.tile.openstreetmap.org',
      'https://server.arcgisonline.com',
      'https://*.basemaps.cartocdn.com',
      'https://*.tile.opentopomap.org',
      'https://unpkg.com',
      'https://unpkg.com/leaflet@*/dist/images/*',
      'https://*.supabase.co'
    ],
    workerSrc: [
      '\'self\'',
      'blob:',
      'https://www.google.com'
    ],
    connectSrc: [
      '\'self\'',
      'https://*.supabase.co',
      'https://nominatim.openstreetmap.org',
      'https://www.google.com',
      'https://www.gstatic.com',
      'https://www.google.com/recaptcha',
      'https://*.google.com',
      'https://*.gstatic.com',
      'https://esm.sh',
      'https://unpkg.com'
    ],
    fontSrc: [
      '\'self\'',
      'data:',
      'https://fonts.gstatic.com',
      'https://r2cdn.perplexity.ai'
    ],
    objectSrc: ['\'none\''],
    mediaSrc: [
      '\'self\'',
      'data:',
      'blob:',
      'https://*.supabase.co'
    ],
    frameSrc: [
      'https://www.google.com',
      'https://www.google.com/recaptcha'
    ],
    // Additional CSP directives for enhanced security
    baseUri: ['\'self\''],
    formAction: ['\'self\''],
    frameAncestors: ['\'none\''],
  }
};
// Add upgrade-insecure-requests only in production
if (process.env.NODE_ENV === 'production') {
  cspConfig.directives.upgradeInsecureRequests = [];
} else {
  // Explicitly remove upgrade-insecure-requests in development
  delete cspConfig.directives.upgradeInsecureRequests;
}
// Enhanced security headers using helmet
const securityHeaders = helmet({
  contentSecurityPolicy: cspConfig,
  crossOriginEmbedderPolicy: false, // Disable for now due to compatibility issues
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false, // Disable HSTS in development to prevent SSL redirects
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
  // Allow geolocation in development, restrict in production
  const geolocationPolicy = process.env.NODE_ENV === 'production' ? 'geolocation=(self)' : 'geolocation=*';
  // Allow camera for ID verification, deny microphone and payment
  res.setHeader('Permissions-Policy',
    `camera=(self), microphone=(), ${geolocationPolicy}, payment=()`
  );
  next();
};

module.exports = {
  securityHeaders,
  cspConfig,
  customSecurityHeaders
};
