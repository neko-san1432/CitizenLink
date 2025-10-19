const express = require('express');
const router = express.Router();
const { clearRateLimit, getRateLimitStatus, DISABLE_RATE_LIMITING } = require('../middleware/rateLimiting');

// Admin endpoint to clear rate limits
router.post('/clear', (req, res) => {
  try {
    const { ip } = req.body;
    
    if (ip) {
      clearRateLimit(ip);
      res.json({
        success: true,
        message: `Rate limit cleared for IP: ${ip}`,
        cleared: ip
      });
    } else {
      clearRateLimit();
      res.json({
        success: true,
        message: 'All rate limits cleared',
        cleared: 'all'
      });
    }
  } catch (error) {
    console.error('[RATE_LIMIT] Error clearing rate limits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear rate limits'
    });
  }
});

// Admin endpoint to check rate limit status
router.get('/status/:ip?', (req, res) => {
  try {
    const ip = req.params.ip || req.ip || req.connection.remoteAddress;
    const status = getRateLimitStatus(ip);
    
    res.json({
      success: true,
      ip: ip,
      disabled: DISABLE_RATE_LIMITING,
      status: status,
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    console.error('[RATE_LIMIT] Error getting rate limit status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get rate limit status'
    });
  }
});

// Admin endpoint to check if rate limiting is disabled
router.get('/config', (req, res) => {
  res.json({
    success: true,
    disabled: DISABLE_RATE_LIMITING,
    environment: process.env.NODE_ENV,
    disableEnvVar: process.env.DISABLE_RATE_LIMITING
  });
});

module.exports = router;
