// Navigation utilities for clearing OAuth context on explicit navigation
import { getOAuthContext, clearOAuthContext } from '../auth/authChecker.js';
import { supabase } from '../config/config.js';

/**
 * Clears incomplete OAuth signup context when user explicitly navigates
 * This should be called when user clicks login/signup buttons or brand logo
 */
export const clearOAuthOnNavigation = async () => {
  try {
    const ctx = getOAuthContext();
    // Only cleanup if there's a pending OAuth attempt
    // Only delete users for incomplete signups, not logins
    if (ctx && ctx.status === 'pending') {
      // Get user ID before signing out (only for signups)
      const shouldDeleteUser = ctx.intent === 'signup';
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      // Store user ID temporarily in case cleanup is interrupted
      if (shouldDeleteUser && userId) {
        try {
          sessionStorage.setItem('cl_pending_deletion_user_id', userId);
        } catch {}
      }

      // Delete user from database if it's a signup and user exists
      if (shouldDeleteUser && userId) {
        let deletionSuccessful = false;

        // Try deletion with access token if available
        if (session?.access_token) {
          try {
            const token = session.access_token;
            const headers = { 'Content-Type': 'application/json' };
            headers['Authorization'] = `Bearer ${token}`;

            const deleteResponse = await fetch('/api/compliance/delete', {
              method: 'DELETE',
              headers,
              credentials: 'include',
              body: JSON.stringify({
                userId,
                confirm: true,
                reason: 'Incomplete OAuth signup cancelled - user navigated away'
              })
            });

            if (deleteResponse.ok) {
              deletionSuccessful = true;
            } else {
              const errorData = await deleteResponse.json().catch(() => ({}));
              const {status} = deleteResponse;
              // Don't log auth errors - they're expected for incomplete signups
              if (status !== 401 && status !== 403) {
                console.warn('[NAV] Failed to delete incomplete OAuth user:', {
                  status,
                  error: errorData.error || 'Unknown error',
                  userId
                });
              }
            }
          } catch (deleteError) {
            console.warn('[NAV] Error during user deletion:', deleteError.message);
          }
        }

        // Retry deletion after a short delay if first attempt failed
        // This handles race conditions where session might be cleared
        if (!deletionSuccessful) {
          try {
            await new Promise(resolve => setTimeout(resolve, 150));

            // Check if we still have a session for retry
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession?.access_token) {
              const token = retrySession.access_token;
              const headers = { 'Content-Type': 'application/json' };
              headers['Authorization'] = `Bearer ${token}`;

              const retryResponse = await fetch('/api/compliance/delete', {
                method: 'DELETE',
                headers,
                credentials: 'include',
                body: JSON.stringify({
                  userId,
                  confirm: true,
                  reason: 'Incomplete OAuth signup cancelled - retry deletion'
                })
              });

              if (retryResponse.ok) {
                deletionSuccessful = true;
              }
            }
          } catch (retryError) {
            // Silently fail - we'll proceed with cleanup anyway
          }
        }

        // Clear stored user ID on successful deletion
        if (deletionSuccessful) {
          try {
            sessionStorage.removeItem('cl_pending_deletion_user_id');
          } catch {}
        }
      }

      // Clear OAuth context first
      clearOAuthContext();

      // Aggressively clear session - multiple attempts
      try {
        await supabase.auth.signOut();
      } catch {}

      try {
        await fetch('/auth/session', { method: 'DELETE', credentials: 'include' });
      } catch {}

      // Force clear all Supabase storage
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            localStorage.removeItem(key);
          }
        });
      } catch {}

      // Verify and force clear again if needed
      const { data: { session: verifySession } } = await supabase.auth.getSession();
      if (verifySession) {
        // Force another sign out
        try {
          await supabase.auth.signOut();
        } catch {}
        // Clear storage again
        try {
          const keys = Object.keys(localStorage);
          keys.forEach(key => {
            if (key.startsWith('sb-') || key.includes('supabase')) {
              localStorage.removeItem(key);
            }
          });
        } catch {}
        // Wait a bit more
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    console.warn('[NAV] Error clearing OAuth context:', error);
  }
};

/**
 * Sets up click handlers for navigation elements (login/signup buttons, brand logo)
 * to clear OAuth context when clicked
 */
export const setupNavigationCleanup = () => {
  const handleNavigationClick = async (e) => {
    const target = e.currentTarget;
    const href = target.getAttribute('href');

    // Only handle login/signup links
    if (!href || (!href.includes('/login') && !href.includes('/signup'))) {
      return;
    }

    // Check if we need to cleanup OAuth (both login and signup)
    const ctx = getOAuthContext();
    if (ctx && ctx.status === 'pending') {
      // Prevent default navigation
      e.preventDefault();
      e.stopPropagation();

      // Set flag to prevent redirects on destination page
      try {
        sessionStorage.setItem('cl_oauth_cleanup', 'true');
      } catch {}

      // Clear OAuth context, delete user, and sign out
      await clearOAuthOnNavigation();

      // Wait a bit to ensure user deletion and session clearing completes
      await new Promise(resolve => setTimeout(resolve, 500));

      // Final check - clear session one more time before navigation
      try {
        await supabase.auth.signOut();
        await fetch('/auth/session', { method: 'DELETE', credentials: 'include' });
      } catch {}

      // Navigate manually with a cache-busting parameter to force fresh load
      if (href) {
        const separator = href.includes('?') ? '&' : '?';
        window.location.href = `${href}${separator}_t=${Date.now()}`;
      }
    }
    // If no OAuth cleanup needed, let default navigation proceed
  };

  // Setup click handlers for login/signup buttons by ID
  const loginBtn = document.getElementById('login-btn');
  const signupBtn = document.getElementById('signup-btn');

  if (loginBtn) {
    loginBtn.addEventListener('click', handleNavigationClick);
  }
  if (signupBtn) {
    signupBtn.addEventListener('click', handleNavigationClick);
  }

  // Setup click handlers for auth links in footer (class="auth-link")
  const authLinks = document.querySelectorAll('a.auth-link[href*="/login"], a.auth-link[href*="/signup"]');
  authLinks.forEach(link => {
    link.addEventListener('click', handleNavigationClick);
  });

  // Setup click handler for brand logo
  const brandLogo = document.querySelector('.brand-logo');
  if (brandLogo) {
    brandLogo.addEventListener('click', async (e) => {
      const ctx = getOAuthContext();
      if (ctx && ctx.status === 'pending') {
        e.preventDefault();
        e.stopPropagation();
        await clearOAuthOnNavigation();
        await new Promise(resolve => setTimeout(resolve, 500));
        // Final check - clear session one more time before navigation
        try {
          await supabase.auth.signOut();
          await fetch('/auth/session', { method: 'DELETE', credentials: 'include' });
        } catch {}
        window.location.href = `/?_t=${Date.now()}`;
      }
    });
  }

  // Setup click handlers for any other login/signup links (like "Get Started" buttons)
  const allLoginSignupLinks = document.querySelectorAll('a[href*="/login"], a[href*="/signup"]');
  allLoginSignupLinks.forEach(link => {
    // Skip if already handled above
    if (link.id === 'login-btn' || link.id === 'signup-btn' || link.classList.contains('auth-link')) {
      return;
    }
    link.addEventListener('click', handleNavigationClick);
  });
};

