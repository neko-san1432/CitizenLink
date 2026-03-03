const express = require("express");

const router = express.Router();
/**
 * Health check endpoint
 * GET /api/health
 */
router.get("/", (req, res) => {
  try {
    // SEC-26 FIX: Only expose status + timestamp; no uptime/memory/version info
    res.json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
