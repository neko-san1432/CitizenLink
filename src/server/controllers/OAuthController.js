const Database = require('../config/database');
const { extractUserMetadata } = require('../utils/authUtils');

const supabase = Database.getClient();

class OAuthController {
  /**
   * Check OAuth user status and determine redirect
   * This is called after OAuth authentication to check if user needs to complete profile
   * Distinguishes between new signups and existing user logins
   */
  async checkOAuthStatus(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          redirectTo: '/login'
        });
      }

      // Get OAuth intent from query parameter or header (set by client)
      const intent = req.query.intent || req.headers['x-oauth-intent'] || 'login'; // Default to login for safety

      // Get user from Supabase
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

      if (userError || !userData?.user) {
        console.error('[OAUTH_CHECK] Error fetching user:', userError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch user data',
          redirectTo: '/login'
        });
      }

      const {user} = userData;
      const metadata = extractUserMetadata(user);

      // Check if user has complete metadata
      const hasRole = Boolean(metadata.role);
      const hasName = Boolean(metadata.name || metadata.first_name || metadata.last_name);
      const hasMobile = Boolean(metadata.mobile_number || metadata.mobile || user.phone);

      const isComplete = hasRole && hasName && hasMobile;

      // Detect if user is new (just created) or existing
      // New users: created within last 5 minutes and no previous logins
      const createdAt = new Date(user.created_at);
      const now = new Date();
      const minutesSinceCreation = (now - createdAt) / (1000 * 60);
      const isNewUser = minutesSinceCreation < 5 && !user.last_sign_in_at;

      // Check if user has any previous sign-ins (indicates existing account)
      const hasPreviousSignIns = Boolean(user.last_sign_in_at) &&
                                 user.last_sign_in_at !== user.created_at;

      // Determine user type
      let userType = 'existing';
      if (isNewUser && !hasPreviousSignIns) {
        userType = 'new';
      } else if (hasPreviousSignIns) {
        userType = 'existing';
      } else if (isComplete) {
        // Complete profile but no previous sign-ins - likely existing but first OAuth login
        userType = 'existing';
      }

      console.log('[OAUTH_CHECK] User status:', {
        userId,
        email: '[REDACTED]',
        intent,
        userType,
        hasRole,
        hasName,
        hasMobile,
        isComplete,
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at,
        minutesSinceCreation: Math.round(minutesSinceCreation),
        hasPreviousSignIns
      });

      if (isComplete) {
        // User is fully registered - redirect to dashboard
        // This applies to both new signups (completed) and existing logins
        return res.json({
          success: true,
          complete: true,
          userType,
          intent,
          redirectTo: '/dashboard',
          message: userType === 'new'
            ? 'Registration completed successfully!'
            : 'Welcome back!'
        });
      }
      // User needs to complete profile
      // Determine if this is a new signup or existing user with incomplete profile
      const isNewSignup = userType === 'new' || intent === 'signup';
      const isExistingIncomplete = userType === 'existing' && intent === 'login';

      return res.json({
        success: true,
        complete: false,
        userType,
        intent,
        isNewSignup,
        isExistingIncomplete,
        redirectTo: '/oauth-continuation',
        missingFields: {
          role: !hasRole,
          name: !hasName,
          mobile: !hasMobile
        },
        message: isNewSignup
          ? 'Please complete your registration to continue.'
          : 'Your profile is incomplete. Please complete it to continue.'
      });

    } catch (error) {
      console.error('[OAUTH_CHECK] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        redirectTo: '/login'
      });
    }
  }

  /**
   * Delete incomplete OAuth signup
   * Called when user navigates away from OAuth continuation
   */
  async deleteIncompleteSignup(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized'
        });
      }

      // Check if user is incomplete
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

      if (userError || !userData?.user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      const {user} = userData;
      const metadata = extractUserMetadata(user);

      const hasRole = Boolean(metadata.role);
      const hasName = Boolean(metadata.name || metadata.first_name || metadata.last_name);
      const hasMobile = Boolean(metadata.mobile_number || metadata.mobile || user.phone);

      const isComplete = hasRole && hasName && hasMobile;

      // Only delete if incomplete
      if (!isComplete) {
        console.log('[OAUTH_CLEANUP] Deleting incomplete OAuth signup:', {
          userId,
          email: '[REDACTED]'
        });

        // Delete user from Supabase
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

        if (deleteError) {
          if (deleteError.code === 'user_not_found' || deleteError.status === 404) {
            console.warn('[OAUTH_CLEANUP] User already deleted, treating as success');
          } else {
            console.error('[OAUTH_CLEANUP] Error deleting user:', deleteError);
            return res.status(500).json({
              success: false,
              error: 'Failed to delete user'
            });
          }
        }

        return res.json({
          success: true,
          message: 'Incomplete signup deleted'
        });
      }
      // User is complete, don't delete
      return res.json({
        success: true,
        message: 'User is complete, not deleted'
      });

    } catch (error) {
      console.error('[OAUTH_CLEANUP] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = new OAuthController();

