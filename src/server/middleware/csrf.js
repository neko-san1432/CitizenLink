const crypto = require('crypto');

// In-memory store for CSRF tokens (in production, use Redis or database)
const tokenStore = new Map();

// Generate a secure CSRF token
const generateToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// CSRF middleware
const csrfProtection = (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const token = req.headers['x-csrf-token'] || req.body._csrf;

  if (!token) {
    return res.status(403).json({
      success: false,
      error: 'CSRF token missing'
    });
  }

  // Verify token exists and is valid
  if (!tokenStore.has(token)) {
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token'
    });
  }

  // Remove token after use (single use)
  tokenStore.delete(token);

  next();
};

// Generate and store CSRF token for the session
const generateCsrfToken = (req, res, next) => {
  const token = generateToken();
  tokenStore.set(token, Date.now());

  // Clean up expired tokens (older than 1 hour)
  const expiryTime = Date.now() - (60 * 60 * 1000);
  for (const [key, timestamp] of tokenStore.entries()) {
    if (timestamp < expiryTime) {
      tokenStore.delete(key);
    }
  }

  // Add token to response locals for templates
  res.locals.csrfToken = token;
  next();
};

// Middleware to add CSRF token to API responses
const addCsrfToken = (req, res, next) => {
  const token = generateToken();
  tokenStore.set(token, Date.now());

  // Add to response headers for API clients
  res.setHeader('X-CSRF-Token', token);
  next();
};

module.exports = {
  csrfProtection,
  generateCsrfToken,
  addCsrfToken,
  generateToken
};
