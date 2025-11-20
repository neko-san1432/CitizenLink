// OAuth continuation page specific functionality
import { supabase } from '../config/config.js';
import { getOAuthContext, clearOAuthContext, setOAuthContext } from './authChecker.js';
import showMessage from '../components/toast.js';

// Cleanup incomplete OAuth signup on interruption
const cleanupIncompleteOAuthSignup = async (reason = 'OAuth signup was interrupted') => {
  try {
    const ctx = getOAuthContext();
    // Only cleanup if this is an incomplete signup
    if (!ctx || ctx.intent !== 'signup' || ctx.status === 'completed') {
      return;
    }

    // Get user ID before signing out
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    // Delete user from database if user exists
    if (userId && session?.access_token) {
      try {
        const token = session.access_token;
        const headers = { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        };
        
        const deleteResponse = await fetch('/api/compliance/delete', {
          method: 'DELETE',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            userId,
            confirm: true,
            reason: `Incomplete OAuth signup: ${reason}`
          })
        });
        
        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json().catch(() => ({}));
          const status = deleteResponse.status;
          // Don't log auth errors - they're expected for incomplete signups
          if (status !== 401 && status !== 403) {
            console.warn('[OAUTH_CONT] Failed to delete incomplete OAuth user:', errorData.error || 'Unknown error');
          }
        }
      } catch (deleteError) {
        // Silently fail - incomplete signups may not have valid sessions
      }
    }

    // Sign out and clear session
    try {
      await supabase.auth.signOut();
    } catch {}
    
    try {
      await fetch('/auth/session', { method: 'DELETE' });
    } catch {}

    // Clear OAuth context
    clearOAuthContext();

    // Clear Supabase storage
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
    } catch {}
  } catch (error) {
    console.warn('[OAUTH_CONT] Error cleaning up incomplete OAuth signup:', error);
  }
};

// Validate that user should be on this page
const validateOAuthContinuation = async () => {
  try {
    // Check if there's a valid OAuth context
    const ctx = getOAuthContext();
    if (!ctx || ctx.intent !== 'signup') {
      // No OAuth context - user shouldn't be here
      showMessage('error', 'No active OAuth signup found. Redirecting to signup...');
      setTimeout(() => {
        window.location.href = '/signup';
      }, 2000);
      return false;
    }

    // Check if user has a session
    const { data: { session }, error } = await supabase.auth.getSession();
    if (!session || error) {
      // No session - user shouldn't be here
      showMessage('error', 'Session expired. Please start over.');
      cleanupIncompleteOAuthSignup('Session expired');
      setTimeout(() => {
        window.location.href = '/signup';
      }, 2000);
      return false;
    }

    // Check if user is already fully registered
    const user = session.user;
    const role = user?.user_metadata?.role || user?.raw_user_meta_data?.role;
    const name = user?.user_metadata?.name || user?.raw_user_meta_data?.name;
    const hasMobile = user?.user_metadata?.mobile_number || 
                     user?.user_metadata?.mobile || 
                     user?.phone;

    if (role && name && hasMobile) {
      // User is already fully registered - redirect to dashboard
      clearOAuthContext();
      window.location.href = '/dashboard';
      return false;
    }

    // User should be here - update context status
    setOAuthContext({ ...ctx, status: 'handoff' });
    return true;
  } catch (error) {
    console.error('[OAUTH_CONT] Validation error:', error);
    return false;
  }
};

// Fetch CAPTCHA key for OAuth continuation
const fetchCaptchaKey = async () => {
  try {
    const response = await fetch('/api/captcha/oauth-key');
    const data = await response.json();
    if (data.success && data.key) {
      return data.key;
    }
    console.error('Failed to fetch CAPTCHA key:', data.error);
    return null;
  } catch (error) {
    console.error('Error fetching CAPTCHA key:', error);
    return null;
  }
};

// Initialize CAPTCHA on OAuth continuation page
const initializeCaptcha = async () => {
  const captchaContainer = document.getElementById('oauth-complete-captcha');
  if (!captchaContainer || !window.grecaptcha) {
    console.warn('CAPTCHA not available');
    return;
  }
  try {
    const siteKey = await fetchCaptchaKey();
    if (siteKey) {
      window.grecaptcha.ready(() => {
        window.grecaptcha.render(captchaContainer, {
          sitekey: siteKey
        });
      });
    }
  } catch (error) {
    console.error('Failed to initialize CAPTCHA:', error);
  }
};

// Setup interruption handlers
const setupInterruptionHandlers = () => {
  // Handle tab close / navigation away
  const handleBeforeUnload = (e) => {
    const ctx = getOAuthContext();
    if (ctx && ctx.intent === 'signup' && ctx.status !== 'completed') {
      // Cleanup on page unload (but don't block navigation)
      cleanupIncompleteOAuthSignup('User closed tab or navigated away');
    }
  };

  // Handle visibility change (user switches tabs)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      const ctx = getOAuthContext();
      if (ctx && ctx.intent === 'signup' && ctx.status !== 'completed') {
        // Mark as potentially abandoned
        setOAuthContext({ ...ctx, lastActivity: Date.now() });
      }
    } else if (document.visibilityState === 'visible') {
      // Check if OAuth signup is stale (abandoned for more than 5 minutes)
      const ctx = getOAuthContext();
      if (ctx && ctx.intent === 'signup' && ctx.status !== 'completed') {
        const lastActivity = ctx.lastActivity || ctx.startedAt || 0;
        const elapsed = Date.now() - lastActivity;
        const STALE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
        
        if (elapsed > STALE_TIMEOUT) {
          showMessage('error', 'OAuth signup session expired. Please start over.');
          cleanupIncompleteOAuthSignup('Session expired due to inactivity');
          setTimeout(() => {
            window.location.href = '/signup';
          }, 2000);
        }
      }
    }
  };

  // Handle page hide (navigation away)
  const handlePageHide = () => {
    const ctx = getOAuthContext();
    if (ctx && ctx.intent === 'signup' && ctx.status !== 'completed') {
      cleanupIncompleteOAuthSignup('User navigated away');
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', handlePageHide);

  // Return cleanup function
  return () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', handlePageHide);
  };
};

// Initialize OAuth continuation page
const initializeOAuthContinuationPage = async () => {
  // First, validate that user should be here
  const isValid = await validateOAuthContinuation();
  if (!isValid) {
    return; // Validation failed, redirect will happen
  }

  // Setup interruption handlers
  setupInterruptionHandlers();

  // Initialize CAPTCHA
  initializeCaptcha();
  
  // Re-initialize CAPTCHA after a delay to handle async script loading
  setTimeout(initializeCaptcha, 1000);
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeOAuthContinuationPage);
} else {
  initializeOAuthContinuationPage();
}
