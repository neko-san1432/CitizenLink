const express = require('express');
const router = express.Router();

// In-memory rate limit tracking (in production, use Redis)
let rateLimitData = {
  requests: 0,
  windowStart: Date.now(),
  remaining: 1000, // Default limit
  resetTime: Date.now() + (60 * 1000) // Reset every minute
};

/**
 * Rate limit status endpoint
 * GET /api/rate-limit/status
 */
router.get('/status', (req, res) => {
  try {
    const now = Date.now();
    const windowDuration = 60 * 1000; // 1 minute window
    
    // Reset window if needed
    if (now - rateLimitData.windowStart > windowDuration) {
      rateLimitData = {
        requests: 0,
        windowStart: now,
        remaining: 1000,
        resetTime: now + windowDuration
      };
    }
    
    // Increment request count
    rateLimitData.requests++;
    rateLimitData.remaining = Math.max(0, 1000 - rateLimitData.requests);
    
    res.json({
      success: true,
      status: {
        requests: rateLimitData.requests,
        remaining: rateLimitData.remaining,
        resetTime: rateLimitData.resetTime,
        windowStart: rateLimitData.windowStart
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Reset rate limit (for testing)
 * POST /api/rate-limit/reset
 */
router.post('/reset', (req, res) => {
  try {
    rateLimitData = {
      requests: 0,
      windowStart: Date.now(),
      remaining: 1000,
      resetTime: Date.now() + (60 * 1000)
    };
    
    res.json({
      success: true,
      message: 'Rate limit reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;