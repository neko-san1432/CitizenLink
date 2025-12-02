const express = require('express');
const Database = require('../config/database');
const { authLimiter } = require('../middleware/rateLimiting');
const { getCookieOptions, extractUserMetadata } = require('../utils/authUtils');

const router = express.Router();
const supabase = Database.getClient();

// Session cookie helpers for client
router.post('/session', authLimiter, (req, res) => {
  try {
    const token = req.body?.access_token;
    const remember = Boolean(req.body?.remember);

    if (!token) {
      return res.status(400).json({ success: false, error: 'access_token is required' });
    }

    const cookieOptions = getCookieOptions(remember);
    res.cookie('sb_access_token', token, cookieOptions);

    return res.json({ success: true });
  } catch (e) {
    console.error('[SERVER SESSION] 💥 Error setting session cookie:', e);
    console.error('[SERVER SESSION] Error stack:', e.stack);
    return res.status(500).json({ success: false, error: 'Failed to set session' });
  }
});

router.delete('/session', authLimiter, (req, res) => {
  try {
    res.clearCookie('sb_access_token');
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to clear session' });
  }
});

// Get session token for client-side Supabase sync (requires valid cookie)
router.get('/session/token', authLimiter, async (req, res) => {
  try {
    const token = req.cookies?.sb_access_token;
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No session token found'
      });
    }
    // Validate token and get user info
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session token'
      });
    }
    // Return access token for client-side Supabase use
    return res.json({
      success: true,
      data: {
        access_token: token,
        token_type: 'bearer',
        user: {
          id: user.id,
          email: user.email
        }
      }
    });
  } catch (error) {
    console.error('[SESSION TOKEN] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get session token'
    });
  }
});

// Session health endpoint for monitoring (public - no auth required)
router.get('/session/health', async (req, res) => {
  try {
    // Check if user has valid session cookie
    const token = req.cookies?.sb_access_token;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No session token found',
        data: {
          authenticated: false,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Try to validate token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session token',
        data: {
          authenticated: false,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Extract role from user metadata
    const combinedMetadata = extractUserMetadata(user);
    const role = combinedMetadata.role || 'citizen';
    const name = combinedMetadata.name || user.email?.split('@')[0] || 'Unknown';

    res.json({
      success: true,
      data: {
        authenticated: true,
        userId: user.id,
        email: user.email,
        role,
        name,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[SESSION HEALTH] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Session health check failed',
      data: {
        authenticated: false,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Session refresh endpoint (public - no auth required)
router.post('/session/refresh', async (req, res) => {
  try {
    // Check if user has existing session cookie
    const existingToken = req.cookies?.sb_access_token;

    if (!existingToken) {
      return res.status(401).json({
        success: false,
        error: 'No existing session to refresh',
        data: {
          refreshed: false,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Try to get fresh session from Supabase
    // Note: This might fail if the server doesn't have the refresh token context
    // Usually refresh is done via client sending refresh token
    // But here we try to get session from current context?
    // The original code used supabase.auth.getSession() which relies on the client (if configured)
    // or global state. Since we are on server, getSession() might return nothing unless setSession was called.
    // However, we are just porting existing logic.
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session) {
      return res.status(401).json({
        success: false,
        error: 'No valid Supabase session found',
        debug: {
          error: error?.message,
          hasSession: Boolean(session)
        }
      });
    }

    // Update server cookie with fresh session
    const cookieOptions = getCookieOptions(false); // Regular session, not "remember me"
    res.cookie('sb_access_token', session.access_token, cookieOptions);

    // Extract user info from session
    const { user } = session;
    const combinedMetadata = extractUserMetadata(user);
    const role = combinedMetadata.role || 'citizen';
    const name = combinedMetadata.name || user.email?.split('@')[0] || 'Unknown';

    res.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        role,
        name,
        refreshed: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[SESSION REFRESH] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Session refresh failed',
      debug: {
        error: error.message
      }
    });
  }
});

// Simple authentication test endpoint (public)
router.get('/test', (req, res) => {
  try {
    const token = req.cookies?.sb_access_token;

    if (!token) {
      return res.json({
        success: false,
        authenticated: false,
        message: 'No session token found',
        timestamp: new Date().toISOString()
      });
    }

    // Try to validate token
    supabase.auth.getUser(token).then(({ data: { user }, error }) => {
      if (error || !user) {
        return res.json({
          success: false,
          authenticated: false,
          message: 'Invalid session token',
          error: error?.message,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        authenticated: true,
        message: 'Session is valid',
        userId: user.id,
        email: user.email,
        timestamp: new Date().toISOString()
      });
    }).catch(error => {
      res.json({
        success: false,
        authenticated: false,
        message: 'Token validation failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    res.json({
      success: false,
      authenticated: false,
      message: 'Authentication test failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
