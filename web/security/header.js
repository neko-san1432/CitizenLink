import express from 'express';
import helmet from 'helmet';
import crypto from 'crypto';

const app = express();

// Middleware to generate a nonce for each request
app.use((req, res, next) => {
  res.locals.scriptNonce = crypto.randomBytes(16).toString('base64');
  res.locals.styleNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Helmet config with strong security headers
app.use((req, res, next) => {
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          `'nonce-${res.locals.scriptNonce}'`, // Nonce for inline scripts
          "https://cdnjs.cloudflare.com", // Font Awesome CDN
          "https://cdn.jsdelivr.net" // Bootstrap CDN
        ],
        styleSrc: [
          "'self'",
          `'nonce-${res.locals.styleNonce}'`, // Nonce for inline styles
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net"
        ],
        fontSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.gstatic.com"
        ],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameAncestors: ["'self'"], // Prevent clickjacking
        upgradeInsecureRequests: []
      }
    },
    frameguard: { action: 'sameorigin' }, // X-Frame-Options
    noSniff: true, // MIME sniffing protection
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    hidePoweredBy: true, // Remove X-Powered-By
    dnsPrefetchControl: { allow: false }
  })(req, res, next);
});

// Custom Permissions-Policy header
app.use((req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(self), camera=(), microphone=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), ambient-light-sensor=(), autoplay=(), encrypted-media=(), fullscreen=(), picture-in-picture=(), sync-xhr=()"
  );
  next();
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
