// Index/landing page specific functionality
import { supabase } from '../config/config.js';
import { logout, getOAuthContext, clearOAuthContext, suppressAuthErrorNotifications } from './authChecker.js';
import { shouldSkipAuthCheck } from '../utils/oauth-cleanup.js';

// Track if logout event listener has been added
let logoutListenerAdded = false;

// Clear OAuth context and session when landing on index page (for incomplete signups)
// This prevents marking incomplete OAuth signups as logged in
const clearOAuthContextOnLanding = async () => {
  try {
    const ctx = getOAuthContext();
    // Only clear if there's an incomplete OAuth signup (pending or handoff)
    if (ctx && ctx.intent === 'signup' && (ctx.status === 'pending' || ctx.status === 'handoff')) {
      // Check if this is coming from an OAuth redirect (don't clear if it is)
      const urlParams = new URLSearchParams(window.location.search);
      const isOAuthRedirect = urlParams.get('code') || urlParams.get('error') || urlParams.get('popup') === '1';
      
      // Only clear if user explicitly navigated here (not from OAuth redirect)
      if (!isOAuthRedirect) {
        console.log('[INDEX] Clearing incomplete OAuth signup context on landing page');
        suppressAuthErrorNotifications();
        
        // Get user ID before signing out (for deletion)
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        
        // Delete incomplete OAuth signup from database
        if (userId && session?.access_token) {
          try {
            const token = session.access_token;
            const headers = { 
              'Authorization': `Bearer ${token}`
            };
            
            const deleteResponse = await fetch('/api/auth/oauth-incomplete', {
              method: 'DELETE',
              headers,
              credentials: 'include'
            });
            
            if (!deleteResponse.ok) {
              const errorData = await deleteResponse.json().catch(() => ({}));
              const status = deleteResponse.status;
              if (status !== 401 && status !== 403) {
                console.warn('[INDEX] Failed to delete incomplete OAuth user:', errorData.error || 'Unknown error');
              }
            }
          } catch (deleteError) {
            console.warn('[INDEX] Error during user deletion:', deleteError.message);
          }
        }
        
        // Clear OAuth context
        clearOAuthContext();
        
        // Clear session to prevent marking as logged in
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
    console.warn('[INDEX] Error clearing OAuth context on landing:', error);
  }
};

// Check authentication status and update UI
const checkAuthenticationAndUpdateUI = async () => {
  try {
    // Clear OAuth context if user explicitly navigated here (prevents marking as logged in)
    await clearOAuthContextOnLanding();
    
    // Check for incomplete OAuth signup - if pending or handoff, don't show authenticated UI
    const ctx = getOAuthContext();
    const hasIncompleteOAuth = ctx && ctx.intent === 'signup' && (ctx.status === 'pending' || ctx.status === 'handoff');
    const hasPendingOAuth = shouldSkipAuthCheck() || hasIncompleteOAuth;
    
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    const unauthenticatedButtons = document.getElementById('unauthenticated-buttons');
    const authenticatedButtons = document.getElementById('authenticated-buttons');
    const logoutBtn = document.getElementById('logout-btn');
    
    // If there's an incomplete OAuth signup, always show unauthenticated buttons
    if (hasPendingOAuth || hasIncompleteOAuth) {
      if (unauthenticatedButtons) unauthenticatedButtons.classList.remove('hidden');
      if (authenticatedButtons) authenticatedButtons.classList.add('hidden');
      return;
    }
    
    if (session && !error) {
      // Get user metadata
      const {user} = session;
      const role = user?.user_metadata?.role || user?.raw_user_meta_data?.role || '';
      const name = user?.user_metadata?.name || user?.raw_user_meta_data?.name || '';
      const hasMobile = user?.user_metadata?.mobile_number || 
                       user?.user_metadata?.mobile || 
                       user?.phone;
      
      // Check if user has completed registration (must have role, name, AND mobile)
      if (role && name && hasMobile) {
        // Hide login/signup buttons, show dashboard button
        if (unauthenticatedButtons) unauthenticatedButtons.classList.add('hidden');
        if (authenticatedButtons) authenticatedButtons.classList.remove('hidden');
        // Add logout functionality (only once)
        if (logoutBtn && !logoutListenerAdded) {
          logoutBtn.addEventListener('click', async () => {
            await logout();
          });
          logoutListenerAdded = true;
        }
      } else {
        // Profile incomplete, keep showing login/signup for profile completion
        if (unauthenticatedButtons) unauthenticatedButtons.classList.remove('hidden');
        if (authenticatedButtons) authenticatedButtons.classList.add('hidden');
      }
    } else {
      // Show login/signup buttons, hide dashboard button
      if (unauthenticatedButtons) unauthenticatedButtons.classList.remove('hidden');
      if (authenticatedButtons) authenticatedButtons.classList.add('hidden');
    }
  } catch (error) {
    console.error('💥 Authentication check failed:', error);
    // On error, default to showing login/signup buttons
    const unauthenticatedButtons = document.getElementById('unauthenticated-buttons');
    const authenticatedButtons = document.getElementById('authenticated-buttons');
    if (unauthenticatedButtons) unauthenticatedButtons.classList.remove('hidden');
    if (authenticatedButtons) authenticatedButtons.classList.add('hidden');
  }
};
// Initialize index page
const initializeIndexPage = async () => {
  // Setup navigation cleanup for login/signup buttons and brand logo
  const { setupNavigationCleanup } = await import('../utils/navigation.js');
  setupNavigationCleanup();
  
  // Run authentication check when page loads
  checkAuthenticationAndUpdateUI();
  // Also run immediately in case DOMContentLoaded already fired
  checkAuthenticationAndUpdateUI();
};
// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeIndexPage);
} else {
  initializeIndexPage();
}
