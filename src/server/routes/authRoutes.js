const express = require('express');
const AuthController = require('../controllers/AuthController');
const { authenticateUser } = require('../middleware/auth');
const { ErrorHandler } = require('../middleware/errorHandler');
const { csrfProtection, generateCsrfToken } = require('../middleware/csrf');
const Database = require('../config/database');
const db = new Database();
const supabase = db.getClient();
const { loginLimiter, passwordResetLimiter } = require('../middleware/rateLimiting');

const router = express.Router();

// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================

/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post('/signup', ErrorHandler.asyncWrapper(AuthController.signup));

/**
 * @route   POST /api/auth/signup-with-code
 * @desc    Register a new user with HR signup code
 * @access  Public
 */
router.post('/signup-with-code', ErrorHandler.asyncWrapper(AuthController.signupWithCode));

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', loginLimiter, ErrorHandler.asyncWrapper(AuthController.login));

/**
 * @route   GET /api/auth/verify-email
 * @desc    Verify user email
 * @access  Public
 */
router.get('/verify-email', ErrorHandler.asyncWrapper(AuthController.verifyEmail));

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post('/forgot-password', passwordResetLimiter, csrfProtection, ErrorHandler.asyncWrapper(async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password`
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Failed to send password reset email'
      });
    }

    res.json({
      success: true,
      message: 'Password reset email sent. Please check your inbox.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request'
    });
  }
}));

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset user password
 * @access  Public
 */
router.post('/reset-password', csrfProtection, ErrorHandler.asyncWrapper(async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match'
      });
    }

    if (password.length < 4) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 4 characters'
      });
    }

    // Verify reset token and update password
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'recovery'
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
}));

// ============================================================================
// PROTECTED ROUTES (Authentication required)
// ============================================================================

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateUser, ErrorHandler.asyncWrapper(AuthController.getProfile));

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticateUser, ErrorHandler.asyncWrapper(AuthController.updateProfile));

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', authenticateUser, csrfProtection, ErrorHandler.asyncWrapper(AuthController.changePassword));

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticateUser, ErrorHandler.asyncWrapper(AuthController.logout));

/**
 * @route   POST /api/auth/complete-oauth
 * @desc    Complete OAuth registration with mobile number
 * @access  Private
 */
router.post('/complete-oauth', authenticateUser, ErrorHandler.asyncWrapper(AuthController.completeOAuth));

/**
 * @route   POST /api/auth/complete-oauth-hr
 * @desc    Complete OAuth registration with HR signup code
 * @access  Private
 */
router.post('/complete-oauth-hr', authenticateUser, ErrorHandler.asyncWrapper(AuthController.completeOAuthHR));

/**
 * @route   GET /api/auth/sessions
 * @desc    Get user's active sessions
 * @access  Private
 */
router.get('/sessions', authenticateUser, ErrorHandler.asyncWrapper(async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: sessions, error } = await supabase
      .from('user_sessions')
      .select(`
        id,
        ip_address,
        user_agent,
        device_type,
        browser,
        location_city,
        location_country,
        is_active,
        started_at,
        last_activity_at
      `)
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      data: sessions || []
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions'
    });
  }
}));

/**
 * @route   DELETE /api/auth/sessions/:sessionId
 * @desc    End a specific session
 * @access  Private
 */
router.delete('/sessions/:sessionId', authenticateUser, ErrorHandler.asyncWrapper(async (req, res) => {
  try {
    const userId = req.user.id;
    const { sessionId } = req.params;

    const { error } = await supabase
      .from('user_sessions')
      .update({
        is_active: false,
        ended_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }

    res.json({
      success: true,
      message: 'Session ended successfully'
    });

  } catch (error) {
    console.error('End session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end session'
    });
  }
}));

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public (but requires refresh token)
 */
router.post('/refresh', ErrorHandler.asyncWrapper(async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    // Update session cookie
    res.cookie('sb_access_token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 4 * 60 * 60 * 1000 // 4 hours
    });

    res.json({
      success: true,
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh token'
    });
  }
}));

/**
 * @route   GET /api/auth/csrf-token
 * @desc    Get CSRF token for form submissions
 * @access  Public
 */
router.get('/csrf-token', generateCsrfToken, (req, res) => {
  res.json({
    success: true,
    csrfToken: res.locals.csrfToken
  });
});

module.exports = router;
