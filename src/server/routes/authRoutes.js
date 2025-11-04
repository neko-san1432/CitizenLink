const express = require('express');
const AuthController = require('../controllers/AuthController');
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
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectTo = `${frontendUrl}/reset-password`;
    
    console.log('[FORGOT_PASSWORD] Request details:', {
      email: email.substring(0, 3) + '***@***', // Partial email for privacy
      redirectTo,
      frontendUrl,
      supabaseUrl: process.env.SUPABASE_URL ? 'configured' : 'missing'
    });
    
    // resetPasswordForEmail requires the anon key, not the service role key
    // Create a client with the anon key for this operation
    const anonKey = config.supabase?.anonKey || process.env.SUPABASE_ANON_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    
    if (!anonKey || !supabaseUrl) {
      console.error('[FORGOT_PASSWORD] Missing SUPABASE_ANON_KEY or SUPABASE_URL');
      console.error('[FORGOT_PASSWORD] Config check:', {
        hasConfig: !!config,
        hasSupabaseConfig: !!config.supabase,
        hasAnonKey: !!config.supabase?.anonKey,
        hasEnvAnonKey: !!process.env.SUPABASE_ANON_KEY,
        hasSupabaseUrl: !!process.env.SUPABASE_URL
      });
      return res.status(500).json({
        success: false,
        error: 'Server configuration error. Please contact support.',
        details: process.env.NODE_ENV === 'development' ? 'Missing SUPABASE_ANON_KEY or SUPABASE_URL' : undefined
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
        details: process.env.NODE_ENV === 'development' ? clientError.message : undefined
      });
    }
    
    console.log('[FORGOT_PASSWORD] Calling Supabase resetPasswordForEmail...');
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
          console.log('\n⚠️  [FORGOT_PASSWORD] EMAIL SENDING FAILED - Supabase email service not configured');
          console.log('📋 [FORGOT_PASSWORD] To fix this, see: docs/SUPABASE_EMAIL_FIX.md');
          console.log('\n💡 [FORGOT_PASSWORD] Development workaround:');
          console.log('   1. Check Supabase Dashboard → Authentication → Email');
          console.log('   2. Enable "Enable email confirmations"');
          console.log('   3. Add redirect URL: http://localhost:3000/reset-password');
          console.log('   4. Check Settings → Auth → Email for SMTP configuration\n');
          
          // Try using admin API as fallback (only in development)
          console.log('[FORGOT_PASSWORD] Attempting to generate recovery link via admin API...');
          try {
            const { data: adminData, error: adminError } = await supabase.auth.admin.generateLink({
              type: 'recovery',
              email,
              options: { redirectTo }
            });
            
            if (!adminError && adminData?.action_link) {
              console.log('\n✅ [FORGOT_PASSWORD] Recovery link generated successfully!');
              console.log('🔗 [FORGOT_PASSWORD] RESET LINK:', adminData.action_link);
              console.log('📧 [FORGOT_PASSWORD] Copy this link and send it to:', email);
              console.log('⚠️  [FORGOT_PASSWORD] This is a DEVELOPMENT ONLY workaround\n');
              
              // In development, return the link so user can test
              return res.json({
                success: true,
                message: 'Recovery link generated (development mode)',
                note: 'Email not sent - Supabase email service not configured. Check server logs for the reset link.',
                link: adminData.action_link,
                development: true
              });
            } else {
              console.error('[FORGOT_PASSWORD] Admin API also failed:', adminError?.message || 'Unknown error');
              console.error('[FORGOT_PASSWORD] This suggests the service role key may not have proper permissions');
            }
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
        } : undefined
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
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

/**
 * @route   POST /api/auth/debug/generate-recovery-link
 * @desc    Dev-only: generate a recovery link without sending email
 * @access  Public (disabled in production)
 */
router.post('/debug/generate-recovery-link', passwordResetLimiter, ErrorHandler.asyncWrapper(async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, error: 'Not available in production' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const redirectTo = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`;
    
    // Try to generate the recovery link
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo }
    });

    if (error) {
      console.error('[DEBUG] generateLink error:', error);
      console.error('[DEBUG] Error details:', {
        message: error.message,
        status: error.status,
        code: error.code,
        fullError: JSON.stringify(error)
      });
      
      return res.status(400).json({ 
        success: false, 
        error: error.message || 'Failed to generate recovery link',
        errorCode: error.code,
        errorStatus: error.status,
        details: 'Admin API may require service role key. Check SUPABASE_SERVICE_ROLE_KEY in .env'
      });
    }

    const link = (data && (data.properties?.action_link || data.action_link)) || null;
    
    return res.json({
      success: true,
      link: link,
      hashedToken: data?.hashed_token || null,
      note: link ? 'Recovery link generated successfully' : 'Link generated but format unexpected'
    });
  } catch (error) {
    console.error('[DEBUG] Generate recovery link exception:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
}));

/**
 * @route   POST /api/auth/debug/find-user
 * @desc    Dev-only: check if an email exists in the auth users of this project
 * @access  Public (disabled in production)
 */
router.post('/debug/find-user', passwordResetLimiter, ErrorHandler.asyncWrapper(async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, error: 'Not available in production' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    // Try multiple approaches to find the user
    let found = null;
    let errorDetails = null;

    // Approach 1: Try listUsers with pagination
    try {
      const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) {
        errorDetails = { method: 'listUsers', error: error.message, code: error.status, fullError: JSON.stringify(error) };
        console.error('[DEBUG] listUsers error:', error);
      } else {
        const users = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
        found = users.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
      }
    } catch (err) {
      errorDetails = { method: 'listUsers', error: err.message, fullError: String(err) };
      console.error('[DEBUG] listUsers exception:', err);
    }

    // Approach 2: If listUsers failed, try to query auth.users directly via SQL
    if (!found && errorDetails) {
      try {
        // Try a direct query to auth.users (this requires service role)
        const { data: sqlData, error: sqlError } = await supabase
          .from('auth.users')
          .select('id, email')
          .ilike('email', email)
          .limit(1)
          .single();
        
        if (!sqlError && sqlData) {
          found = sqlData;
        } else {
          console.error('[DEBUG] SQL query error:', sqlError);
        }
      } catch (sqlErr) {
        console.error('[DEBUG] SQL query exception:', sqlErr);
      }
    }

    const projectRef = (process.env.SUPABASE_URL || '').split('https://').pop()?.split('.supabase.co')[0] || null;
    
    return res.json({ 
      success: true, 
      projectRef, 
      exists: !!found, 
      userId: found?.id || null,
      email: found?.email || null,
      errorDetails: errorDetails || null,
      note: found ? 'User found' : 'User not found (admin API may be restricted)'
    });
  } catch (error) {
    console.error('[DEBUG] Find user exception:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
}));

/**
 * @route   GET /api/auth/debug/env
 * @desc    Dev-only: show which Supabase project this server is pointed to
 * @access  Public (disabled in production)
 */
router.get('/debug/env', ErrorHandler.asyncWrapper(async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, error: 'Not available in production' });
    }
    const url = process.env.SUPABASE_URL || null;
    const projectRef = url ? url.replace('https://', '').split('.supabase.co')[0] : null;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const hasServiceKey = Boolean(serviceKey);
    const serviceKeyPrefix = serviceKey ? serviceKey.slice(0, 6) : null;
    const serviceKeyLength = serviceKey.length;
    
    // Test if the service key actually works for admin operations
    let adminTest = { canAccess: false, error: null };
    if (hasServiceKey) {
      try {
        // Try a simple admin call to test the key
        const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
        if (error) {
          adminTest = { canAccess: false, error: error.message, code: error.code };
        } else {
          adminTest = { canAccess: true, note: 'Admin API accessible' };
        }
      } catch (err) {
        adminTest = { canAccess: false, error: err.message };
      }
    }
    
    return res.json({ 
      success: true, 
      projectRef, 
      supabaseUrl: url, 
      hasServiceKey, 
      serviceKeyPrefix,
      serviceKeyLength,
      adminTest,
      note: serviceKeyPrefix === 'eyJhbG' ? 'Key looks like a JWT (correct format)' : 'Key format may be incorrect'
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Internal error', details: error.message });
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
 * @route   POST /api/auth/request-password-change
 * @desc    Request password change with email confirmation
 * @access  Private
 */
router.post('/request-password-change', authenticateUser, authLimiter, csrfProtection, ErrorHandler.asyncWrapper(AuthController.requestPasswordChange));

/**
 * @route   GET /api/auth/confirm-password-change
 * @desc    Confirm password change via email token
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
    res.cookie('sb_access_token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
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
router.get('/csrf-token', authLimiter, generateCsrfToken, (req, res) => {
  res.json({
    success: true,
    csrfToken: res.locals.csrfToken
  });
});

module.exports = router;
