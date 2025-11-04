// Simple in-memory rate limiting implementation
// Since express-rate-limit package installation is failing, we'll use a basic implementation

const rateLimitStore = new Map();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.resetTime > 0) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Skip rate limiting entirely for localhost/development
function createRateLimiter(maxRequests, windowMs, _skipSuccessfulRequests = false) {
  return (req, res, next) => {
    // Skip rate limiting for localhost/development
    const hostname = req.hostname || req.get('host')?.split(':')[0] || '';
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0';
    // Always skip rate limiting in development mode or localhost
    if (process.env.NODE_ENV === 'development' || isLocalhost) {
      // console.log removed for security
      return next();
    }
    // Debug logging for non-localhost requests
    // console.log removed for security
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const windowStart = now - windowMs;
    // Get or create rate limit data for this IP
    let rateLimitData = rateLimitStore.get(key);
    if (!rateLimitData) {
      rateLimitData = {
        requests: [],
        resetTime: now + windowMs
      };
      rateLimitStore.set(key, rateLimitData);
    }
    // Clean old requests outside the window
    rateLimitData.requests = rateLimitData.requests.filter(timestamp => timestamp > windowStart);
    // Check if limit exceeded
    if (rateLimitData.requests.length >= maxRequests) {
      // console.log removed for security
      return res.status(429).json({
        success: false,
        error: 'Too many requests from this IP, please try again later.'
      });
    }
    // Add current request timestamp
    rateLimitData.requests.push(now);
    // Update reset time if needed
    if (rateLimitData.requests.length === 1) {
      rateLimitData.resetTime = now + windowMs;
    }
    // Debug logging for development
    if (process.env.NODE_ENV === 'development') {
      // console.log removed for security
    }
    // Add headers for rate limit info
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - rateLimitData.requests.length),
      'X-RateLimit-Reset': Math.ceil(rateLimitData.resetTime / 1000)
    });
    next();
  };
}
// Check if rate limiting should be disabled entirely
const DISABLE_RATE_LIMITING = process.env.DISABLE_RATE_LIMITING === 'true' || process.env.NODE_ENV === 'development';
// Create a no-op rate limiter for when rate limiting is disabled
const noOpLimiter = (req, res, next) => {
  // console.log removed for security
  next();
};
// General API rate limiting - very permissive for development
const apiLimiter = DISABLE_RATE_LIMITING ? noOpLimiter : createRateLimiter(1000, 15 * 60 * 1000); // 1000 requests per 15 minutes
// Stricter rate limiting for authentication endpoints - more permissive for dev
const authLimiter = DISABLE_RATE_LIMITING ? noOpLimiter : createRateLimiter(100, 15 * 60 * 1000); // 100 requests per 15 minutes
// Very strict rate limiting for login attempts
const loginLimiter = DISABLE_RATE_LIMITING ? noOpLimiter : createRateLimiter(20, 15 * 60 * 1000); // 20 requests per 15 minutes
// Rate limiting for password reset requests
const passwordResetLimiter = DISABLE_RATE_LIMITING ? noOpLimiter : createRateLimiter(5, 60 * 60 * 1000); // 5 requests per hour
// Rate limiting for file uploads
const uploadLimiter = DISABLE_RATE_LIMITING ? noOpLimiter : createRateLimiter(20, 15 * 60 * 1000); // 20 uploads per 15 minutes
// Rate limiting for complaint submissions
const complaintLimiter = DISABLE_RATE_LIMITING ? noOpLimiter : createRateLimiter(10, 60 * 60 * 1000); // 10 complaints per hour
// Utility function to clear rate limits for a specific IP or all IPs
function clearRateLimit(ip = null) {

  if (ip) {
    rateLimitStore.delete(ip);
    // console.log removed for security
  } else {
    rateLimitStore.clear();
    // console.log removed for security
  }
}
// Utility function to get rate limit status for an IP
function getRateLimitStatus(ip) {
  const data = rateLimitStore.get(ip);
  if (!data) {
    return { requests: 0, remaining: 1000, resetTime: null };
  }
  const now = Date.now();
  const windowStart = now - (15 * 60 * 1000); // 15 minutes
  const validRequests = data.requests.filter(timestamp => timestamp > windowStart);
  return {
    requests: validRequests.length,
    remaining: Math.max(0, 1000 - validRequests.length),
    resetTime: data.resetTime
  };
}

module.exports = {
  apiLimiter,
  authLimiter,
  loginLimiter,
  passwordResetLimiter,
  uploadLimiter,
  complaintLimiter,
  clearRateLimit,
  getRateLimitStatus,
  DISABLE_RATE_LIMITING
};
