// Aggressive OAuth cleanup utility
import { supabase } from '../config/config.js';
import { getOAuthContext, clearOAuthContext } from '../auth/authChecker.js';

/**
 * Clears OAuth session and context (without deleting users)
 * This should be called to clear stale sessions, but NOT to delete users
 * User deletion should only happen on explicit navigation clicks
 */
// aggressiveOAuthCleanup removed - replaced by GlobalOAuthGuard
// This file now only contains helper utilities

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

