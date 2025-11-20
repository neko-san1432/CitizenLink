// Aggressive OAuth cleanup utility
import { supabase } from '../config/config.js';
import { getOAuthContext, clearOAuthContext } from '../auth/authChecker.js';

/**
 * Clears OAuth session and context (without deleting users)
 * This should be called to clear stale sessions, but NOT to delete users
 * User deletion should only happen on explicit navigation clicks
 */
export const aggressiveOAuthCleanup = async () => {
  try {
    const ctx = getOAuthContext();
    
    // Only cleanup if there's a pending OAuth attempt
    if (!ctx || ctx.status !== 'pending') {
      return false;
    }
    
    // Clear OAuth context (DO NOT delete users here - only on explicit navigation)
    clearOAuthContext();
    
    // Aggressively clear session
    try {
      await supabase.auth.signOut();
    } catch {}
    
    // Clear server session cookie
    try {
      await fetch('/auth/session', { method: 'DELETE', credentials: 'include' });
    } catch {}
    
    // Clear all Supabase storage
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
    } catch {}
    
    // Clear sessionStorage
    try {
      sessionStorage.removeItem('cl_oauth_cleanup');
    } catch {}
    
    // Force clear cookies (client-side)
    try {
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
        if (name.startsWith('sb_') || name === 'sb_access_token') {
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
        }
      });
    } catch {}
    
    // Verify session is cleared
    const { data: { session: verifySession } } = await supabase.auth.getSession();
    if (verifySession) {
      // Force another sign out
      try {
        await supabase.auth.signOut();
      } catch {}
    }
    
    return true;
  } catch (error) {
    console.warn('[OAUTH_CLEANUP] Error during cleanup:', error);
    return false;
  }
};

/**
 * Checks if we should skip authentication checks due to pending OAuth cleanup
 */
export const shouldSkipAuthCheck = () => {
  try {
    const ctx = getOAuthContext();
    return ctx && ctx.status === 'pending';
  } catch {
    return false;
  }
};

