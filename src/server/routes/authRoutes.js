const express = require('express');
const AuthController = require('../controllers/AuthController');
const OAuthController = require('../controllers/OAuthController');
const { authenticateUser } = require('../middleware/auth');
const { ErrorHandler } = require('../middleware/errorHandler');
const { csrfProtection, generateCsrfToken } = require('../middleware/csrf');
const Database = require('../config/database');

const supabase = Database.getClient();
const { createClient } = require('@supabase/supabase-js');
const config = require('../../../config/app');
const { loginLimiter, passwordResetLimiter, authLimiter } = require('../middleware/rateLimiting');

const router = express.Router();
// ============================================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================================
/**
 * @route   POST /api/auth/signup
 * @desc    Register a new user
 * @access  Public
 */
router.post('/signup', authLimiter, ErrorHandler.asyncWrapper(AuthController.signup));
/**
 * @route   POST /api/auth/signup-with-code
 * @desc    Register a new user with HR signup code
 * @access  Public
 */
router.post('/signup-with-code', authLimiter, ErrorHandler.asyncWrapper(AuthController.signupWithCode));
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
router.get('/verify-email', authLimiter, ErrorHandler.asyncWrapper(AuthController.verifyEmail));
/**
 * @route   POST /api/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
// CSRF disabled for forgot-password to allow public POST from reset page
router.post('/forgot-password', passwordResetLimiter, ErrorHandler.asyncWrapper(async (req, res) => {
  try {
    const { email, logoutOption } = req.body; // logoutOption: 'all', 'others', or 'none' (handled client-side)
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectTo = `${frontendUrl}/reset-password`;
    // resetPasswordForEmail requires the anon key, not the service role key
    // Create a client with the anon key for this operation
    const anonKey = config.supabase?.anonKey || process.env.SUPABASE_ANON_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!anonKey || !supabaseUrl) {
      console.error('[FORGOT_PASSWORD] Missing SUPABASE_ANON_KEY or SUPABASE_URL');
      console.error('[FORGOT_PASSWORD] Config check:', {
        hasConfig: Boolean(config),
        hasSupabaseConfig: Boolean(config.supabase),
        hasAnonKey: Boolean(config.supabase?.anonKey),
        hasEnvAnonKey: Boolean(process.env.SUPABASE_ANON_KEY),
        hasSupabaseUrl: Boolean(process.env.SUPABASE_URL)
      });
      return res.status(500).json({
        success: false,
        error: 'Server configuration error. Please contact support.',
        details: process.env.NODE_ENV === 'development' ? 'Missing SUPABASE_ANON_KEY or SUPABASE_URL' : null
      });
    }
    // Create a client with anon key for client-side operations
    let anonClient;
    try {
      anonClient = createClient(supabaseUrl, anonKey);
    } catch (clientError) {
      console.error('[FORGOT_PASSWORD] Failed to create Supabase client:', clientError);
      return res.status(500).json({
        success: false,
        error: 'Failed to initialize authentication service',
        details: process.env.NODE_ENV === 'development' ? clientError.message : null
      });
    }
    const { data, error } = await anonClient.auth.resetPasswordForEmail(email, {
      redirectTo
    });
    if (error) {
      console.error('[FORGOT_PASSWORD] Supabase error:', error);
      console.error('[FORGOT_PASSWORD] Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
        redirectTo,
        supabaseUrl: process.env.SUPABASE_URL
      });
      // Check if it's a redirectTo URL issue
      if (error.code === 'unexpected_failure' && error.status === 500) {
        console.error('[FORGOT_PASSWORD] Possible causes:');
        console.error('  1. Email sending is disabled in Supabase Dashboard → Authentication → Email');
        console.error('  2. RedirectTo URL not whitelisted in Supabase Dashboard → Authentication → URL Configuration');
        console.error('  3. SMTP/SES not configured in Supabase Dashboard → Settings → Auth');
        console.error('  4. Supabase project email service issue');
        // Development workaround: Try to generate link manually if email sending fails
        if (process.env.NODE_ENV === 'development') {

          // Try using admin API as fallback (only in development)
          try {
            const { data: adminData, error: adminError } = await supabase.auth.admin.generateLink({
              type: 'recovery',
              email,
              options: { redirectTo }
            });
            if (!adminError && adminData?.action_link) {

              // In development, return the link so user can test
              return res.json({
                success: true,
                message: 'Recovery link generated (development mode)',
                note: 'Email not sent - Supabase email service not configured. Check server logs for the reset link.',
                link: adminData.action_link,
                development: true
              });
            }
            console.error('[FORGOT_PASSWORD] Admin API also failed:', adminError?.message || 'Unknown error');
            console.error('[FORGOT_PASSWORD] This suggests the service role key may not have proper permissions');

          } catch (adminErr) {
            console.error('[FORGOT_PASSWORD] Admin API exception:', adminErr.message);
          }
        }
      }
      // Return more specific error messages
      let errorMessage = 'Failed to send password reset email';
      if (error.code === 'unexpected_failure' && error.status === 500) {
        errorMessage = 'Email service is not configured. Please contact your administrator or check Supabase email settings.';
      } else if (error.message) {
        // Supabase returns user-friendly messages for common cases
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
          errorMessage = 'No account found with this email address';
        } else if (error.message.includes('email')) {
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }
      return res.status(400).json({
        success: false,
        error: errorMessage,
        errorCode: error.code || null,
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          code: error.code,
          status: error.status,
          note: 'This error usually means email sending is disabled in Supabase Dashboard → Authentication → Email'
        } : null
      });
    }
    // Even if there's no error, Supabase might not send an email if email sending is disabled
    // but it will still return success for security reasons (to prevent email enumeration)
    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent. Please check your inbox.'
    });
  } catch (error) {
    console.error('[FORGOT_PASSWORD] Exception:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process password reset request',
      details: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
}));
// Debug endpoints removed for security - use proper admin tools instead
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
    // Verify reset token
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'recovery'
    });
    if (verifyError || !verifyData?.user) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    // Validate password strength
    const { validatePasswordStrength } = require('../../shared/passwordValidation');
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet security requirements',
        details: passwordValidation.errors
      });
    }

    // Update password using Supabase's updateUser (requires session)
    // Since we verified the OTP, we need to create a session first
    // Use admin API to update password directly
    const { error: updateError } = await supabase.auth.admin.updateUserById(verifyData.user.id, {
      password
    });

    if (updateError) {
      console.error('[PASSWORD RESET] Failed to update password:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to reset password. Please try again.'
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
 * @route   POST /api/auth/request-password-change
 * @desc    Request password change with email confirmation
 * @access  Private
 */
router.post('/request-password-change', authenticateUser, authLimiter, csrfProtection, ErrorHandler.asyncWrapper(AuthController.requestPasswordChange));
/**
 * @route   GET /api/auth/confirm-password-change
 * @desc    Redirect to client-side confirmation page
 * @access  Public
 */
router.get('/confirm-password-change', ErrorHandler.asyncWrapper(AuthController.confirmPasswordChange));
/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password (legacy - direct change)
 * @access  Private
 */
router.post('/change-password', authenticateUser, authLimiter, csrfProtection, ErrorHandler.asyncWrapper(AuthController.changePassword));
/**
 * @route   POST /api/auth/request-email-change
 * @desc    Request email change with email confirmation
 * @access  Private
 */
router.post('/request-email-change', authenticateUser, authLimiter, csrfProtection, ErrorHandler.asyncWrapper(AuthController.requestEmailChange));
/**
 * @route   POST /api/auth/invalidate-all-sessions
 * @desc    Invalidate all active sessions for the current user
 * @access  Private
 */
router.post('/invalidate-all-sessions', authenticateUser, authLimiter, csrfProtection, ErrorHandler.asyncWrapper(AuthController.invalidateAllSessions));
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
router.post('/complete-oauth', authenticateUser, authLimiter, ErrorHandler.asyncWrapper(AuthController.completeOAuth));
/**
 * @route   POST /api/auth/complete-oauth-hr
 * @desc    Complete OAuth registration with HR signup code
 * @access  Private
 */
router.post('/complete-oauth-hr', authenticateUser, authLimiter, ErrorHandler.asyncWrapper(AuthController.completeOAuthHR));
/**
 * @route   GET /api/auth/oauth-status
 * @desc    Check OAuth user status and determine redirect
 * @access  Protected
 */
router.get('/oauth-status', authenticateUser, authLimiter, ErrorHandler.asyncWrapper(OAuthController.checkOAuthStatus));
/**
 * @route   DELETE /api/auth/oauth-incomplete
 * @desc    Delete incomplete OAuth signup
 * @access  Protected
 */
router.delete('/oauth-incomplete', authenticateUser, authLimiter, ErrorHandler.asyncWrapper(OAuthController.deleteIncompleteSignup));
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
router.post('/refresh', authLimiter, ErrorHandler.asyncWrapper(async (req, res) => {
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
    // Update session cookie with proper expiration
    const { getCookieOptions } = require('../utils/authUtils');
    res.cookie('sb_access_token', data.session.access_token, getCookieOptions(false));
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
router.get('/csrf-token', authLimiter, generateCsrfToken, (req, res) => {
  res.json({
    success: true,
    csrfToken: res.locals.csrfToken
  });
});

module.exports = router;
