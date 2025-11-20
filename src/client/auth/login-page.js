// Login page specific functionality
import { supabase } from '../config/config.js';
import { shouldSkipAuthCheck } from '../utils/oauth-cleanup.js';
import { getOAuthContext } from './authChecker.js';

// Clear OAuth context and session when landing on login page (without deleting users)
// This prevents redirects when user explicitly navigated here
const clearOAuthContextOnLanding = async () => {
  try {
    const ctx = getOAuthContext();
    // Only clear if there's a pending OAuth AND user explicitly navigated (not from OAuth redirect)
    if (ctx && ctx.status === 'pending') {
      // Check if this is coming from an OAuth redirect (don't clear if it is)
      const urlParams = new URLSearchParams(window.location.search);
      const isOAuthRedirect = urlParams.get('code') || urlParams.get('error') || urlParams.get('popup') === '1';
      
      // Only clear if user explicitly navigated here (not from OAuth redirect)
      if (!isOAuthRedirect) {
        // User explicitly navigated to login - clear OAuth context and session to prevent redirects
        // But don't delete the user - that only happens on explicit button clicks
        const { clearOAuthContext } = await import('./authChecker.js');
        clearOAuthContext();
        
        // Clear session to prevent redirects to oauth-continuation
        try {
          await supabase.auth.signOut();
        } catch {}
        try {
          await fetch('/auth/session', { method: 'DELETE' });
        } catch {}
        
        // Clear Supabase storage
        try {
          const keys = Object.keys(localStorage);
          keys.forEach(key => {
            if (key.startsWith('sb-') || key.includes('supabase')) {
              localStorage.removeItem(key);
            }
          });
        } catch {}
      }
    }
  } catch (error) {
    console.warn('[LOGIN] Error clearing OAuth context on landing:', error);
  }
};

// Check if user is already logged in and redirect to dashboard
const checkAuthentication = async () => {
  try {
    // Clear OAuth context if user explicitly navigated here (prevents redirects)
    await clearOAuthContextOnLanding();
    
    // Check if we just cleaned up OAuth - skip redirects
    let oauthCleanupFlag = false;
    try {
      oauthCleanupFlag = sessionStorage.getItem('cl_oauth_cleanup') === 'true';
      if (oauthCleanupFlag) {
        sessionStorage.removeItem('cl_oauth_cleanup');
      }
    } catch {}
    
    // If we just cleaned up, don't redirect - let user proceed with login
    if (oauthCleanupFlag) {
      return;
    }
    
    // Check if redirected due to session expiration - don't auto-login
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('session_expired') === 'true') {
      // Session expired - clear any stale session and don't auto-login
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error('[LOGIN] Error clearing expired session:', error);
      }
      // Remove the parameter from URL
      window.history.replaceState({}, document.title, '/login');
      return; // Don't proceed with auto-login check
    }

    // console.log removed for security
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session && !error) {
      // console.log removed for security
      // Get user metadata
      const {user} = session;
      const role = user?.user_metadata?.role || '';
      const name = user?.user_metadata?.name || '';
      // Check if user has completed registration
      if (role && name) {
        // console.log removed for security
        window.location.href = '/dashboard';
      } else {
        // User has incomplete registration - redirect to continuation
        // This is the normal flow after OAuth signup
        // console.log removed for security
        window.location.href = '/oauth-continuation';
      }
    } else {
      // console.log removed for security
    }
  } catch (error) {
    console.error('💥 Authentication check failed:', error);
    // If there's an error, let the user proceed with login
  }
};

// Check for URL parameters and show toast messages
const handleUrlMessages = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const message = urlParams.get('message');
  const type = urlParams.get('type');
  if (message && type) {
    // Import and show toast message
    import('../components/toast.js').then(({ default: showMessage }) => {
      showMessage(type, message);
      // Clean up URL parameters
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }).catch(error => {
      console.error('Failed to load toast module:', error);
      // Fallback to alert if toast fails
      alert(message);
    });
  }
};
// Initialize login page
const initializeLoginPage = async () => {
  // Setup navigation cleanup for login/signup buttons and brand logo
  const { setupNavigationCleanup } = await import('../utils/navigation.js');
  setupNavigationCleanup();
  
  // Run authentication check when page loads
  checkAuthentication();
  // Handle URL messages
  handleUrlMessages();
  // Listen for auth state changes to update UI dynamically
  supabase.auth.onAuthStateChange((event, session) => {
    // console.log removed for security
    if (event === 'SIGNED_IN' && session) {
      checkAuthentication();
    }
  });
};
// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLoginPage);
} else {
  initializeLoginPage();
}
