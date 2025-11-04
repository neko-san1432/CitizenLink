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

  let token = null;

  // Check for token in headers first
  if (req.headers['x-csrf-token']) {
    token = req.headers['x-csrf-token'];
  }
  // Check for token in body (for JSON requests and FormData)
  else if (req.body && req.body._csrf) {
    token = req.body._csrf;
  }

  if (!token) {
    // console.log removed for security
    return res.status(403).json({
      success: false,
      error: 'CSRF token missing'
    });
  }

  // Verify token exists and is valid
  if (!tokenStore.has(token)) {
    // console.log removed for security
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token'
    });
  }

  // For form submissions (POST requests), don't delete the token immediately
  // to allow for potential retries or multiple submissions
  if (req.method !== 'POST') {
    tokenStore.delete(token);
  }

  // console.log removed for security
  next();
};

// Generate and store CSRF token for the session
const generateCsrfToken = (req, res, next) => {
  const token = generateToken();
  tokenStore.set(token, Date.now());

  // Clean up expired tokens (older than 30 minutes for form submissions)
  const expiryTime = Date.now() - (30 * 60 * 1000);
  for (const [key, timestamp] of tokenStore.entries()) {
    if (timestamp < expiryTime) {
      tokenStore.delete(key);
    }
  }

  // Add token to response locals for templates
  res.locals.csrfToken = token;

  // Also add to response headers for API clients
  res.setHeader('X-CSRF-Token', token);
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

