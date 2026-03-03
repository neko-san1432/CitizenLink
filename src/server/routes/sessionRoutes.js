const express = require("express");
const Database = require("../config/database");
const { authLimiter } = require("../middleware/rateLimiting");
const { getCookieOptions, extractUserMetadata } = require("../utils/authUtils");

const router = express.Router();
const supabase = Database.getClient();

// Session cookie helpers for client — SEC-06 FIX: validate token before storing
router.post("/session", authLimiter, async (req, res) => {
  try {
    const token = req.body?.access_token;
    const remember = Boolean(req.body?.remember);

    if (!token) {
      return res.status(400).json({ success: false, error: "access_token is required" });
    }

    // SEC-06 FIX: Validate the token with Supabase before setting cookie
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ success: false, error: "Invalid access token" });
    }

    const cookieOptions = getCookieOptions(remember);
    res.cookie("sb_access_token", token, cookieOptions);

    return res.json({ success: true });
  } catch (e) {
    console.error("[SERVER SESSION] Error setting session cookie:", e.message);
    return res.status(500).json({ success: false, error: "Failed to set session" });
  }
});

router.delete("/session", authLimiter, (req, res) => {
  try {
    res.clearCookie("sb_access_token");
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Failed to clear session" });
  }
});

// Get session token for client-side Supabase sync (requires valid cookie)
router.get("/session/token", authLimiter, async (req, res) => {
  try {
    const token = req.cookies?.sb_access_token;
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "No session token found"
      });
    }
    // Validate token and get user info
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: "Invalid session token"
      });
    }
    // Return access token for client-side Supabase use
    return res.json({
      success: true,
      data: {
        access_token: token,
        token_type: "bearer",
        user: {
          id: user.id,
          email: user.email
        }
      }
    });
  } catch (error) {
    console.error("[SESSION TOKEN] Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to get session token"
    });
  }
});

// SEC-22 FIX: Session health endpoint — reduced PII output
router.get("/session/health", async (req, res) => {
  try {
    const token = req.cookies?.sb_access_token;
    if (!token) {
      return res.status(401).json({
        success: false,
        data: { authenticated: false, timestamp: new Date().toISOString() }
      });
    }
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({
        success: false,
        data: { authenticated: false, timestamp: new Date().toISOString() }
      });
    }
    // SEC-22 FIX: Only return authenticated status — no PII
    res.json({
      success: true,
      data: {
        authenticated: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      data: { authenticated: false, timestamp: new Date().toISOString() }
    });
  }
});

// Session refresh endpoint (public - no auth required)
// BE-13 FIX: Use getUser(token) instead of getSession() which has no server-side context
router.post("/session/refresh", async (req, res) => {
  try {
    // Check if user has existing session cookie
    const existingToken = req.cookies?.sb_access_token;

    if (!existingToken) {
      return res.status(401).json({
        success: false,
        error: "No existing session to refresh",
        data: {
          refreshed: false,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate the existing token against Supabase
    const { data: { user }, error } = await supabase.auth.getUser(existingToken);

    if (error || !user) {
      // Token expired or invalid — clear the cookie
      res.clearCookie("sb_access_token");
      return res.status(401).json({
        success: false,
        error: "Session expired or invalid. Please log in again."
      });
    }

    // Token is still valid — refresh the cookie expiry
    const cookieOptions = getCookieOptions(false);
    res.cookie("sb_access_token", existingToken, cookieOptions);

    // Extract user info
    const combinedMetadata = extractUserMetadata(user);
    const role = combinedMetadata.role || "citizen";
    const name = combinedMetadata.name || user.email?.split("@")[0] || "Unknown";

    res.json({
      success: true,
      data: {
        refreshed: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("[SESSION REFRESH] Error:", error);
    res.status(500).json({
      success: false,
      error: "Session refresh failed"
    });
  }
});

// Simple authentication test endpoint (public)
router.get("/test", (req, res) => {
  try {
    const token = req.cookies?.sb_access_token;

    if (!token) {
      return res.json({
        success: false,
        authenticated: false,
        message: "No session token found",
        timestamp: new Date().toISOString()
      });
    }

    // Try to validate token
    supabase.auth.getUser(token).then(({ data: { user }, error }) => {
      if (error || !user) {
        return res.json({
          success: false,
          authenticated: false,
          message: "Invalid session token",
          error: error?.message,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        authenticated: true,
        message: "Session is valid",
        userId: user.id,
        email: user.email,
        timestamp: new Date().toISOString()
      });
    }).catch(error => {
      res.json({
        success: false,
        authenticated: false,
        message: "Token validation failed",
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    res.json({
      success: false,
      authenticated: false,
      message: "Authentication test failed",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
