// Database-backed rate limiting using Supabase
// Falls back to in-memory store if database is unavailable

const Database = require("../config/database");
let supabase = null;

// Initialize Supabase connection
try {
  supabase = Database.getClient();
} catch (error) {
  console.warn("[RATE LIMIT] Database not available, using in-memory fallback");
}


// In-memory fallback store
const rateLimitStore = new Map();

// Clean up expired entries every 5 minutes (in-memory only)
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now - data.resetTime > 0) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Database-backed rate limit operations (Fallback)
async function getRateLimitFromDB(key, windowMs) {
  if (!supabase) return null;

  try {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create rate limit record
    const { data: existing, error: fetchError } = await supabase
      .from("rate_limits")
      .select("*")
      .eq("key", key)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") { // PGRST116 = not found
      console.warn("[RATE LIMIT] Database fetch error:", fetchError.message);
      return null;
    }

    if (existing) {
      // Clean old requests outside the window
      const requests = JSON.parse(existing.requests || "[]").filter(ts => ts > windowStart);
      return {
        requests,
        resetTime: existing.reset_time ? new Date(existing.reset_time).getTime() : now + windowMs
      };
    }

    return null;
  } catch (error) {
    console.warn("[RATE LIMIT] Database operation failed:", error.message);
    return null;
  }
}

async function saveRateLimitToDB(key, data, windowMs) {
  if (!supabase) return false;

  try {
    const _now = Date.now();
    const resetTime = new Date(data.resetTime).toISOString();

    const { error } = await supabase
      .from("rate_limits")
      .upsert({
        key,
        requests: JSON.stringify(data.requests),
        reset_time: resetTime,
        window_ms: windowMs,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "key"
      });

    if (error) {
      console.warn("[RATE LIMIT] Database save error:", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn("[RATE LIMIT] Database save failed:", error.message);
    return false;
  }
}

// Create rate limiter with database backing
function createRateLimiter(maxRequests, windowMs, _skipSuccessfulRequests = false) {
  return async (req, res, next) => {
    // Use higher limits in development but still enforce rate limiting
    const hostname = req.hostname || req.get("host")?.split(":")[0] || "";
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0";
    const isDevelopment = process.env.NODE_ENV === "development";

    // In development/localhost, use more permissive limits (5x) but still enforce rate limiting
    const effectiveMaxRequests = (isDevelopment || isLocalhost) ? maxRequests * 5 : maxRequests;

    const key = req.ip || req.connection.remoteAddress || "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;

    // Try to get from database first, fallback to in-memory
    let rateLimitData = null;

    // Skip DB for development/localhost to prevent shared rate limit buckets
    if (!isDevelopment && !isLocalhost) {
      rateLimitData = await getRateLimitFromDB(key, windowMs);
    }

    if (!rateLimitData) {
      // Fallback to in-memory store
      rateLimitData = rateLimitStore.get(key);
      if (!rateLimitData) {
        rateLimitData = {
          requests: [],
          resetTime: now + windowMs
        };
        rateLimitStore.set(key, rateLimitData);
      }
    }

    // Clean old requests outside the window
    rateLimitData.requests = rateLimitData.requests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (rateLimitData.requests.length >= effectiveMaxRequests) {
      return res.status(429).json({
        success: false,
        error: "Too many requests from this IP, please try again later."
      });
    }

    // Add current request timestamp
    rateLimitData.requests.push(now);

    // Update reset time if needed
    if (rateLimitData.requests.length === 1) {
      rateLimitData.resetTime = now + windowMs;
    }

    // Save to database (async, don't wait) - Optimized to only sync periodically or on critical thresholds
    // For high-volume traffic (200k users), we shouldn't hit DB on every request
    // Only sync if it's a new window or significant change
    // Skip DB for development/localhost
    if ((!isDevelopment && !isLocalhost) && (rateLimitData.requests.length % 10 === 0 || rateLimitData.requests.length >= effectiveMaxRequests)) {
      saveRateLimitToDB(key, rateLimitData, windowMs).catch(() => {
        // If DB save fails, keep in-memory copy
        rateLimitStore.set(key, rateLimitData);
      });
    } else {
      // Just update in-memory
      rateLimitStore.set(key, rateLimitData);
    }

    // Add headers for rate limit info
    res.set({
      "X-RateLimit-Limit": effectiveMaxRequests,
      "X-RateLimit-Remaining": Math.max(0, effectiveMaxRequests - rateLimitData.requests.length),
      "X-RateLimit-Reset": Math.ceil(rateLimitData.resetTime / 1000)
    });
    next();
  };
}
// Check if rate limiting should be disabled entirely (only via explicit env var)
const DISABLE_RATE_LIMITING = process.env.DISABLE_RATE_LIMITING === "true";
// Create a no-op rate limiter for when rate limiting is explicitly disabled
const noOpLimiter = (req, res, next) => {
  next();
};
// General API rate limiting - 5x limits in development (5000 vs 1000)
const apiLimiter = DISABLE_RATE_LIMITING ? noOpLimiter : createRateLimiter(1000, 15 * 60 * 1000); // 1000 requests per 15 minutes (5000 in dev)
// Stricter rate limiting for authentication endpoints - 5x limits in development (500 vs 100)
const authLimiter = DISABLE_RATE_LIMITING ? noOpLimiter : createRateLimiter(100, 15 * 60 * 1000); // 100 requests per 15 minutes (500 in dev)
// Very strict rate limiting for login attempts - 5x limits in development (100 vs 20)
const loginLimiter = DISABLE_RATE_LIMITING ? noOpLimiter : createRateLimiter(20, 15 * 60 * 1000); // 20 requests per 15 minutes (100 in dev)
// Rate limiting for password reset requests - 5x limits in development (25 vs 5)
const passwordResetLimiter = DISABLE_RATE_LIMITING ? noOpLimiter : createRateLimiter(5, 60 * 60 * 1000); // 5 requests per hour (25 in dev)
// Rate limiting for file uploads - 5x limits in development (100 vs 20)
const uploadLimiter = DISABLE_RATE_LIMITING ? noOpLimiter : createRateLimiter(20, 15 * 60 * 1000); // 20 uploads per 15 minutes (100 in dev)
// Rate limiting for complaint submissions - 5x limits in development (50 vs 10)
const complaintLimiter = DISABLE_RATE_LIMITING ? noOpLimiter : createRateLimiter(100, 15 * 60 * 1000); // 100 complaints per 15 mins
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
  createRateLimiter,
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
