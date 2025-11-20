// Signup page specific functionality
import { supabase } from '../config/config.js';
import showMessage from '../components/toast.js';
import { renderPrivacyNotice } from '../utils/privacyContent.js';
import { getOAuthContext, setOAuthContext, clearOAuthContext } from '../auth/authChecker.js';
import { shouldSkipAuthCheck } from '../utils/oauth-cleanup.js';

// Check if user is already logged in and redirect to dashboard
const shouldDeferAuthRedirect = () => {
  try {
    const ctx = getOAuthContext();
    return ctx && ctx.intent === 'signup' && ctx.status === 'pending';
  } catch {
    return false;
  }
};

// Clear OAuth context and session when landing on signup page (without deleting users)
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
        // User explicitly navigated to signup - clear OAuth context and session to prevent redirects
        // But don't delete the user - that only happens on explicit button clicks
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
    console.warn('[SIGNUP] Error clearing OAuth context on landing:', error);
  }
};

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
    
    // If we just cleaned up, don't redirect - let user proceed with signup
    if (oauthCleanupFlag) {
      return;
    }
    
    // Check for pending OAuth - if exists and user explicitly navigated, don't redirect
    // But allow legitimate OAuth continuation redirects
    const oauthCtx = getOAuthContext();
    const hasPendingOAuth = oauthCtx && oauthCtx.status === 'pending';
    
    // Only skip redirect if user explicitly navigated (not from OAuth redirect)
    if (hasPendingOAuth) {
      const urlParams = new URLSearchParams(window.location.search);
      const isOAuthRedirect = urlParams.get('code') || urlParams.get('error') || urlParams.get('popup') === '1';
      // If user explicitly navigated (not from OAuth), don't redirect
      if (!isOAuthRedirect) {
        return;
      }
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
        if (shouldDeferAuthRedirect()) return;
        window.location.href = '/dashboard';
      } else {
        // User has incomplete registration - redirect to continuation
        // This is the normal flow after OAuth signup
        // Only defer if there's a pending OAuth and user explicitly navigated
        if (shouldDeferAuthRedirect()) {
          const urlParams = new URLSearchParams(window.location.search);
          const isOAuthRedirect = urlParams.get('code') || urlParams.get('error') || urlParams.get('popup') === '1';
          // If not from OAuth redirect, don't redirect to continuation
          if (!isOAuthRedirect) {
            return;
          }
        }
        // console.log removed for security
        window.location.href = '/oauth-continuation';
      }
    } else {
      // console.log removed for security
    }
  } catch (error) {
    console.error('💥 Authentication check failed:', error);
    // If there's an error, let the user proceed with signup
  }
};

let resetSignupStateHandler = null;
let oauthAbortWatcherInstalled = false;

// Initialize signup page
const initializeSignupPage = async () => {
  // Setup navigation cleanup for login/signup buttons and brand logo
  const { setupNavigationCleanup } = await import('../utils/navigation.js');
  setupNavigationCleanup();
  
  // Run authentication check when page loads
  checkAuthentication();

  // Wire password strength meter
  attachPasswordStrengthMeter();

  // Listen for auth state changes to update UI dynamically
  supabase.auth.onAuthStateChange((event, session) => {
    // console.log removed for security
    if (event === 'SIGNED_IN' && session) {
      checkAuthentication();
    }
  });
  // Terms & Privacy Modals are now handled by the SimpleModal component
  // Listen for acceptance events to update the checkbox
  document.addEventListener('termsAccepted', () => {
    const termsCheckbox = document.getElementById('terms-checkbox');
    if (termsCheckbox) termsCheckbox.checked = true;
  });
  document.addEventListener('privacyAccepted', () => {
    const termsCheckbox = document.getElementById('terms-checkbox');
    if (termsCheckbox) termsCheckbox.checked = true;
  });
  renderPrivacyNotice('#privacyModalContent', { headingTag: 'h4' });
  setupSignupMethodSelector();
  setupOAuthPopupBridge();
  setupOAuthAbortWatcher();
};
// --- Live password strength meter wiring ---
function attachPasswordStrengthMeter() {
  try {
    const passwordInput = document.getElementById('regPassword');
    const strengthFill = document.getElementById('strength-fill');
    const strengthText = document.getElementById('strength-text');
    if (!passwordInput || !strengthFill || !strengthText) return;
    const classList = ['weak', 'fair', 'good', 'strong'];
    const calcScore = (pwd) => {
      let score = 0;
      if (!pwd) return 0;
      if (pwd.length >= 8) score++;
      if (pwd.length >= 12) score++;
      if (/[a-z]/.test(pwd)) score++;
      if (/[A-Z]/.test(pwd)) score++;
      if (/\d/.test(pwd)) score++;
      if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) score++;
      // penalties
      if (/(.)\1{2,}/.test(pwd)) score -= 1;
      if (/123456|abcdef|qwerty|asdfgh|zxcvbn/i.test(pwd)) score -= 2;
      return Math.max(0, Math.min(4, score));
    };

    const labelFor = (score) => {
      switch (true) {
        case score <= 1: return 'Weak';
        case score === 2: return 'Fair';
        case score === 3: return 'Good';
        default: return 'Strong';
      }
    };
    const classFor = (score) => {
      if (score <= 1) return 'weak';
      if (score === 2) return 'fair';
      if (score === 3) return 'good';
      return 'strong';
    };
    const update = () => {
      const pwd = passwordInput.value || '';
      // Do not evaluate if empty or less than 8 chars
      if (pwd.length < 8) {
        strengthFill.classList.remove('weak','fair','good','strong');
        strengthText.classList.remove('weak','fair','good','strong');
        strengthFill.style.width = '0%';
        strengthText.textContent = 'Password strength';
        return;
      }
      const score = calcScore(pwd);
      const cls = classFor(score);
      // reset
      strengthFill.classList.remove('weak','fair','good','strong');
      strengthText.classList.remove('weak','fair','good','strong');
      // Apply base width 0 first
      strengthFill.style.width = '0%';
      // apply classes
      strengthFill.classList.add(cls);
      strengthText.classList.add(cls);
      // Map class to width explicitly in case CSS not applied yet
      const widthMap = { weak: '25%', fair: '50%', good: '75%', strong: '100%' };
      strengthFill.style.width = widthMap[cls];
      strengthText.textContent = `Password strength: ${labelFor(score)}`;
    };
    passwordInput.addEventListener('input', update);
    update();
  } catch (_) {}
}
// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSignupPage);
} else {
  initializeSignupPage();
}

// --- Signup method selector ---
const METHOD_STORAGE_KEY = 'cl_signup_method';

function setupSignupMethodSelector() {
  const regForm = document.getElementById('regForm');
  const emailFlow = document.getElementById('signup-email-flow');
  const placeholder = document.getElementById('signup-flow-placeholder');
  const methodSection = document.getElementById('signup-method-section');
  const methodBackBtn = document.getElementById('signup-method-back');
  const buttons = document.querySelectorAll('[data-signup-method]');
  if (!regForm || !emailFlow) return;

  const selectMethod = (method, { persist = false } = {}) => {
    regForm.dataset.method = method;
    buttons.forEach((btn) => {
      const isActive = btn.dataset.signupMethod === method;
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    if (method === 'email') {
      methodSection?.setAttribute('hidden', '');
      methodBackBtn?.removeAttribute('hidden');
      emailFlow.hidden = false;
      placeholder?.setAttribute('hidden', '');
    } else {
      methodSection?.removeAttribute('hidden');
      methodBackBtn?.setAttribute('hidden', '');
      emailFlow.hidden = true;
      if (method === 'none') {
        placeholder?.removeAttribute('hidden');
      } else {
        placeholder?.setAttribute('hidden', '');
      }
    }
    if (persist) {
      try {
        if (method === 'email') {
          localStorage.setItem(METHOD_STORAGE_KEY, 'email');
        } else {
          localStorage.removeItem(METHOD_STORAGE_KEY);
        }
      } catch {}
    }
  };

  const resetSignupState = ({ persist = true } = {}) => {
    if (regForm) {
      regForm.reset();
      regForm.dataset.method = 'none';
    }
    selectMethod('none', { persist });
    clearOAuthContext();
  };
  resetSignupStateHandler = resetSignupState;

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const method = btn.dataset.signupMethod || 'email';
      selectMethod(method, { persist: true });
    });
  });

  // Restore last method if it was email to keep the form open
  let cachedMethod = null;
  try {
    cachedMethod = localStorage.getItem(METHOD_STORAGE_KEY);
  } catch {}
  if (cachedMethod === 'email') {
    selectMethod('email');
  } else {
    selectMethod('none');
  }

  methodBackBtn?.addEventListener('click', () => {
    resetSignupState({ persist: true });
    const methodTop = methodSection?.offsetTop || 0;
    window.scrollTo({ top: methodTop - 40, behavior: 'smooth' });
  });

  const handlePageExit = () => resetSignupState({ persist: true });
  window.addEventListener('pagehide', handlePageExit);
  window.addEventListener('beforeunload', handlePageExit);
}

function setupOAuthPopupBridge() {
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    const { type, payload } = event.data || {};
    if (type === 'oauth-signup-success') {
      const provider = (payload?.provider || 'OAuth').replace(/^\w/, (c) => c.toUpperCase());
      try {
        const ctx = getOAuthContext() || {};
        setOAuthContext({ ...ctx, status: 'handoff' });
      } catch {}
      showMessage('success', `${provider} connected. Finishing setup...`);
      setTimeout(() => {
        window.location.href = '/oauth-continuation';
      }, 900);
    }
    if (type === 'oauth-user-exists') {
      cleanupPendingOAuth('User already exist');
    }
    if (type === 'oauth-signup-error' && payload?.message) {
      cleanupPendingOAuth(payload.message);
    }
  });
}

const OAUTH_STALE_TIMEOUT_MS = 3000;

async function cleanupPendingOAuth(message = 'OAuth signup was cancelled. Please try again.') {
  try {
    // Get user ID before signing out
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    
    // Delete user from database if user exists and has valid session
    if (userId && session?.access_token) {
      try {
        // Get auth token for the delete request
        const token = session.access_token;
        const headers = { 'Content-Type': 'application/json' };
        headers['Authorization'] = `Bearer ${token}`;
        
        // Delete user data (this will also delete from auth.users)
        // If this fails, we'll still proceed with sign out and context clearing
        const deleteResponse = await fetch('/api/compliance/delete', {
          method: 'DELETE',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            userId,
            confirm: true,
            reason: 'Incomplete OAuth signup cancelled by user'
          })
        });
        
        // Only log if it's not a 401/403 (expected for invalid sessions)
        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json().catch(() => ({}));
          const status = deleteResponse.status;
          // Don't log auth errors - they're expected for incomplete signups
          if (status !== 401 && status !== 403) {
            console.warn('[SIGNUP] Failed to delete incomplete OAuth user:', errorData.error || 'Unknown error');
          }
        }
      } catch (deleteError) {
        // Silently fail - incomplete signups may not have valid sessions
        // The sign out below will still clear the session
      }
    }
    
    // Sign out after deletion attempt
    await supabase.auth.signOut();
  } catch {}
  
  try { await fetch('/auth/session', { method: 'DELETE' }); } catch {}
  clearOAuthContext();
  resetSignupStateHandler?.({ persist: true });
  if (message) {
    showMessage('error', message);
  }
}

function setupOAuthAbortWatcher() {
  if (oauthAbortWatcherInstalled) return;
  oauthAbortWatcherInstalled = true;

  const checkPendingOAuth = async () => {
    try {
      const ctx = getOAuthContext();
      if (ctx && ctx.intent === 'signup' && ctx.status === 'pending') {
        const startedAt = Number(ctx.startedAt) || 0;
        const elapsed = Date.now() - startedAt;
        if (elapsed > OAUTH_STALE_TIMEOUT_MS) {
          await cleanupPendingOAuth('OAuth signup did not finish. Please try again.');
        }
      }
    } catch (error) {
      console.warn('[SIGNUP] OAuth abort watcher error:', error);
    }
  };

  // Handle tab close / navigation away
  const handleBeforeUnload = async () => {
    const ctx = getOAuthContext();
    if (ctx && ctx.intent === 'signup' && ctx.status === 'pending') {
      // Cleanup on page unload
      await cleanupPendingOAuth('User closed tab or navigated away');
    }
  };

  // Handle visibility change (user switches tabs)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      checkPendingOAuth();
    } else if (document.visibilityState === 'hidden') {
      // Mark as potentially abandoned
      const ctx = getOAuthContext();
      if (ctx && ctx.intent === 'signup' && ctx.status === 'pending') {
        setOAuthContext({ ...ctx, lastActivity: Date.now() });
      }
    }
  };

  // Handle page hide (navigation away)
  const handlePageHide = async () => {
    const ctx = getOAuthContext();
    if (ctx && ctx.intent === 'signup' && ctx.status === 'pending') {
      await cleanupPendingOAuth('User navigated away');
    }
  };

  window.addEventListener('focus', checkPendingOAuth, true);
  window.addEventListener('beforeunload', handleBeforeUnload);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', handlePageHide);
}
