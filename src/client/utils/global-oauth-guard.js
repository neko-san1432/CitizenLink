import { supabase } from '../config/config.js';

// Configuration
const OAUTH_FLOW_PAGES = [
  '/oauth-continuation',
  '/oauthcontinuation',
  '/complete-position-signup',
  '/oauth-callback',
  '/oauthcallback'
];

const STORAGE_KEYS = {
  CONTEXT: 'cl_oauth_context',
  USER_META: 'cl_user_meta'
};

/**
 * Global guard to ensure clean state when navigating outside OAuth flow
 * This runs on every page load where this script is included
 */
export const initGlobalOAuthGuard = async () => {
  try {
    const path = window.location.pathname.toLowerCase();

    // 1. Check if we are on a valid OAuth flow page
    // Using explicit loop for clarity and safety
    const isOAuthPage = OAUTH_FLOW_PAGES.some(allowedPath => {
      // Exact match or starts with (for nested routes if any, though not expected here)
      return path === allowedPath || path.startsWith(`${allowedPath  }/`);
    });

    if (isOAuthPage) {
      // We are in the flow, everything is fine
      return;
    }

    // 2. We are NOT on an OAuth page (e.g. Landing, Login, Dashboard, etc.)
    // Check if we have stale OAuth context hanging around
    const rawContext = localStorage.getItem(STORAGE_KEYS.CONTEXT);
    if (!rawContext) {
      return; // No context, nothing to clean
    }

    let ctx;
    try {
      ctx = JSON.parse(rawContext);
    } catch {
      // Invalid JSON, just clean it up
      localStorage.removeItem(STORAGE_KEYS.CONTEXT);
      return;
    }

    // 3. Check for 'pending' or 'handoff' status
    // If status is 'pending', the user abandoned the flow
    if (ctx && (ctx.status === 'pending' || ctx.status === 'handoff')) {
      console.log('[OAUTH GUARD] Detected abandoned OAuth flow on non-OAuth page:', path);
      console.log('[OAUTH GUARD] running cleanup...');

      // Prevent auto-redirect loops by clearing immediate triggers

      // A. Clear LocalStorage Context & Form Data
      const keysToClear = [
        STORAGE_KEYS.CONTEXT,
        STORAGE_KEYS.USER_META,
        'cl_oauth_form_data',
        'cl_reg_form_data',
        'cl_signup_form_data',
        'cl_signup_method',
        'cl_signup_step_index'
      ];

      keysToClear.forEach(key => localStorage.removeItem(key));

      // Clear SessionStorage temporary markers
      const sessionKeysToClear = [
        'cl_pending_deletion_user_id',
        'cl_oauth_cleanup',
        'oauth_success_message',
        'authErrorSuppressKey'
      ];
      sessionKeysToClear.forEach(key => sessionStorage.removeItem(key));

      // C. Clear Session (Supabase)
      // We do this aggressively to ensure next auth check fails and doesn't redirect
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Ignore error, we just want to try
      }

      // D. Clear Server Session Cookie
      try {
        await fetch('/auth/session', { method: 'DELETE' });
      } catch (e) {
        // Ignore network errors
      }

      console.log('[OAUTH GUARD] Cleanup complete. User reset to guest state.');
    }

  } catch (error) {
    console.warn('[OAUTH GUARD] Error during guard check:', error);
  }
};
