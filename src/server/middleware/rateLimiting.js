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

// Simple rate limiting middleware factory
function createRateLimiter(maxRequests, windowMs, skipSuccessfulRequests = false) {
  return (req, res, next) => {
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

    // Add headers for rate limit info
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - rateLimitData.requests.length),
      'X-RateLimit-Reset': Math.ceil(rateLimitData.resetTime / 1000)
    });

    next();
  };
}

// General API rate limiting
const apiLimiter = createRateLimiter(100, 15 * 60 * 1000); // 100 requests per 15 minutes

// Stricter rate limiting for authentication endpoints
const authLimiter = createRateLimiter(5, 15 * 60 * 1000); // 5 requests per 15 minutes

// Very strict rate limiting for login attempts
const loginLimiter = createRateLimiter(3, 15 * 60 * 1000); // 3 requests per 15 minutes

// Rate limiting for password reset requests
const passwordResetLimiter = createRateLimiter(3, 60 * 60 * 1000); // 3 requests per hour

// Rate limiting for file uploads
const uploadLimiter = createRateLimiter(10, 15 * 60 * 1000); // 10 uploads per 15 minutes

// Rate limiting for complaint submissions
const complaintLimiter = createRateLimiter(5, 60 * 60 * 1000); // 5 complaints per hour

module.exports = {
  apiLimiter,
  authLimiter,
  loginLimiter,
  passwordResetLimiter,
  uploadLimiter,
  complaintLimiter,
};
