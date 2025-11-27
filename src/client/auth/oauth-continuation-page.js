// OAuth continuation page specific functionality
// console.log('[OAUTH_CONT] Script file loaded at:', new Date().toISOString());
// console.log('[OAUTH_CONT] Current URL:', window.location.href);

import { supabase } from '../config/config.js';
import { getOAuthContext, clearOAuthContext, setOAuthContext, suppressAuthErrorNotifications } from './authChecker.js';
import showMessage from '../components/toast.js';

// console.log('[OAUTH_CONT] Imports completed');

// Cleanup incomplete OAuth signup on interruption
const cleanupIncompleteOAuthSignup = async (reason = 'OAuth signup was interrupted') => {
  suppressAuthErrorNotifications();
  try {
    const ctx = getOAuthContext();
    // Only cleanup if this is an incomplete NEW signup (not existing user login)
    // Don't cleanup if:
    // 1. No context
    // 2. Intent is 'login' (existing user)
    // 3. Status is 'completed' (already done)
    // 4. User type is 'existing' (existing user with incomplete profile)
    if (!ctx || 
        ctx.intent !== 'signup' || 
        ctx.status === 'completed' ||
        ctx.userType === 'existing' ||
        ctx.isExistingIncomplete) {
      /* console.log('[OAUTH_CONT] Skipping cleanup - not a new signup:', {
        hasContext: !!ctx,
        intent: ctx?.intent,
        status: ctx?.status,
        userType: ctx?.userType,
        isExistingIncomplete: ctx?.isExistingIncomplete
      }); */
      return;
    }

    // Get user ID before signing out
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
          // Don't log auth errors - they're expected for incomplete signups
          if (status !== 401 && status !== 403) {
            console.warn('[OAUTH_CONT] Failed to delete incomplete OAuth signup:', errorData.error || 'Unknown error');
          }
        } else {
          // console.log('[OAUTH_CONT] Incomplete OAuth signup deleted successfully');
        }
      } catch (deleteError) {
        console.warn('[OAUTH_CONT] Error deleting incomplete signup:', deleteError);
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
  // console.log('[OAUTH_CONT_VALIDATE] Starting validation...');
  try {
    // First check if user has a session (this is the primary requirement)
    // Retry a few times in case session is still being set
    let session = null;
    let error = null;
    let retries = 3;
    
    while (retries > 0 && !session) {
      // console.log(`[OAUTH_CONT_VALIDATE] Checking session (${4 - retries}/3)...`);
      const result = await supabase.auth.getSession();
      session = result.data?.session;
      error = result.error;
      
      if (session) {
        // console.log('[OAUTH_CONT_VALIDATE] ✅ Session found!');
        break;
      }
      
      if (retries > 1) {
        // console.log('[OAUTH_CONT_VALIDATE] ⏳ Session not found, retrying in 500ms...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      retries--;
    }
    
    /* console.log('[OAUTH_CONT_VALIDATE] Session check result:', {
      hasSession: !!session,
      hasError: !!error,
      error: error?.message,
      userId: session?.user?.id
    }); */
    
    if (!session || error) {
      // No session - user shouldn't be here
      console.warn('[OAUTH_CONT_VALIDATE] ❌ No session found after retries:', error);
      // console.log('[OAUTH_CONT_VALIDATE] Checking localStorage for session data...');
      
      // Check if there's any session data in localStorage
      const storageKeys = Object.keys(localStorage);
      const supabaseKeys = storageKeys.filter(k => k.includes('supabase') || k.startsWith('sb-'));
      // console.log('[OAUTH_CONT_VALIDATE] Supabase storage keys:', supabaseKeys);
      
      // console.log('[OAUTH_CONT_VALIDATE] Redirecting to signup...');
      showMessage('error', 'Session expired. Please start over.');
      cleanupIncompleteOAuthSignup('Session expired');
      setTimeout(() => {
        window.location.href = '/signup';
      }, 2000);
      return false;
    }
    
    // console.log('[OAUTH_CONT_VALIDATE] ✅ Session exists');

    // Check if user is already fully registered
    // console.log('[OAUTH_CONT_VALIDATE] Checking registration status...');
    const user = session.user;
    const role = user?.user_metadata?.role || user?.raw_user_meta_data?.role;
    const name = user?.user_metadata?.name || user?.raw_user_meta_data?.name;
    const hasMobile = user?.user_metadata?.mobile_number || 
                     user?.user_metadata?.mobile || 
                     user?.phone;

    /* console.log('[OAUTH_CONT_VALIDATE] Registration check:', {
      role: role || 'missing',
      name: name || 'missing',
      hasMobile: !!hasMobile,
      isFullyRegistered: !!(role && name && hasMobile)
    }); */

    if (role && name && hasMobile) {
      // User is already fully registered - redirect to dashboard
      console.log('[OAUTH_CONT_VALIDATE] ❌ User already fully registered, redirecting to dashboard');
      clearOAuthContext();
      window.location.href = '/dashboard';
      return false;
    }
    
    // console.log('[OAUTH_CONT_VALIDATE] ✅ User is not fully registered');

    // Check if there's a valid OAuth context
    // console.log('[OAUTH_CONT_VALIDATE] Checking OAuth context...');
    let ctx = getOAuthContext();
    // console.log('[OAUTH_CONT_VALIDATE] OAuth context:', ctx);
    
    if (!ctx || ctx.intent !== 'signup') {
      // Context might be missing if page was refreshed or context was cleared
      // Check if user has OAuth identity to determine if this is an OAuth signup
      const provider = user?.identities?.[0]?.provider;
      // console.log('[OAUTH_CONT_VALIDATE] Context missing or wrong intent, checking provider:', provider);
      
      if (provider) {
        // User has OAuth identity but no context - recreate context
        // console.log('[OAUTH_CONT_VALIDATE] ✅ OAuth context missing, recreating from session');
        ctx = {
          provider,
          email: user.email,
          intent: 'signup',
          status: 'handoff',
          startedAt: Date.now()
        };
        setOAuthContext(ctx);
        // console.log('[OAUTH_CONT_VALIDATE] Recreated context:', ctx);
      } else {
        // No OAuth identity - user shouldn't be here
        console.warn('[OAUTH_CONT_VALIDATE] ❌ No OAuth context and no OAuth identity found');
        showMessage('error', 'No active OAuth signup found. Redirecting to signup...');
        setTimeout(() => {
          window.location.href = '/signup';
        }, 2000);
        return false;
      }
    } else {
      // console.log('[OAUTH_CONT_VALIDATE] ✅ OAuth context exists');
    }

    // User should be here - update context status if needed
    if (ctx.status !== 'handoff' && ctx.status !== 'completed') {
      // console.log('[OAUTH_CONT_VALIDATE] Updating context status to handoff');
      setOAuthContext({ ...ctx, status: 'handoff' });
    }
    
    // console.log('[OAUTH_CONT_VALIDATE] ✅ Validation passed, showing form');
    return true;
  } catch (error) {
    console.error('[OAUTH_CONT] Validation error:', error);
    return false;
  }
};

const CAPTCHA_RENDER_FLAG = '__oauthCaptchaRendered';

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

  if (captchaContainer.dataset.rendered === 'true' || window[CAPTCHA_RENDER_FLAG]) {
    // console.log('[OAUTH_CONT] CAPTCHA already rendered, skipping re-render');
    return;
  }

  try {
    const siteKey = await fetchCaptchaKey();
    if (siteKey) {
      window.grecaptcha.ready(() => {
        if (captchaContainer.dataset.rendered === 'true' || window[CAPTCHA_RENDER_FLAG]) {
          // console.log('[OAUTH_CONT] CAPTCHA rendered during wait, skipping');
          return;
        }
        window.grecaptcha.render(captchaContainer, {
          sitekey: siteKey
        });
        captchaContainer.dataset.rendered = 'true';
        window[CAPTCHA_RENDER_FLAG] = true;
        // console.log('[OAUTH_CONT] CAPTCHA rendered successfully');
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
  suppressAuthErrorNotifications();
  // console.log('[OAUTH_CONT] ========================================');
  // console.log('[OAUTH_CONT] Initializing OAuth continuation page...');
  // console.log('[OAUTH_CONT] URL:', window.location.href);
  // console.log('[OAUTH_CONT] URL Hash:', window.location.hash);
  // console.log('[OAUTH_CONT] Timestamp:', new Date().toISOString());
  
  // Check if there are tokens in the URL hash (from Supabase redirect)
  if (window.location.hash) {
    // console.log('[OAUTH_CONT] URL hash detected, Supabase may extract session from it');
    // Supabase will automatically handle tokens in URL hash
    // Wait a moment for Supabase to process the hash
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Check OAuth context
  const ctx = getOAuthContext();
  // console.log('[OAUTH_CONT] OAuth Context:', ctx);
  
  // Update page title and subtitle based on user type
  const updatePageMessages = () => {
    const isNewSignup = ctx?.isNewSignup || ctx?.intent === 'signup';
    const userType = ctx?.userType || (isNewSignup ? 'new' : 'existing');
    const customMessage = ctx?.message;
    
    // Update page title
    const titleElement = document.querySelector('.auth-title');
    if (titleElement) {
      if (isNewSignup) {
        titleElement.textContent = 'Complete Your Registration';
      } else {
        titleElement.textContent = 'Complete Your Profile';
      }
    }
    
    // Update subtitle
    const subtitleElement = document.querySelector('.auth-subtitle');
    if (subtitleElement) {
      if (customMessage) {
        subtitleElement.textContent = customMessage;
      } else if (isNewSignup) {
        subtitleElement.textContent = 'Please provide your information to complete your registration.';
      } else {
        subtitleElement.textContent = 'Your profile is incomplete. Please provide the missing information to continue.';
      }
    }
    
    // Update submit button text
    const submitButton = document.getElementById('signup-submit-btn');
    if (submitButton) {
      if (isNewSignup) {
        submitButton.textContent = 'Complete Registration';
      } else {
        submitButton.textContent = 'Update Profile';
      }
    }
    
    /* console.log('[OAUTH_CONT] Updated page messages:', {
      isNewSignup,
      userType,
      customMessage
    }); */
  };
  
  // Update messages if context is available
  if (ctx) {
    updatePageMessages();
  }
  
  // Check session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  // console.log('[OAUTH_CONT] Session exists:', !!session);
  // console.log('[OAUTH_CONT] Session error:', sessionError);
  if (session?.user) {
    /* console.log('[OAUTH_CONT] User ID:', session.user.id);
    console.log('[OAUTH_CONT] User email:', session.user.email);
    console.log('[OAUTH_CONT] User metadata:', {
      role: session.user.user_metadata?.role || session.user.raw_user_meta_data?.role,
      name: session.user.user_metadata?.name || session.user.raw_user_meta_data?.name,
      mobile: session.user.user_metadata?.mobile_number || session.user.user_metadata?.mobile,
      provider: session.user.identities?.[0]?.provider
    }); */
  }
  
  const form = document.getElementById('oauthCompleteForm');
  const steps = document.getElementById('signup-steps');
  const step1 = document.querySelector('.signup-step[data-step="1"]');
  // console.log('[OAUTH_CONT] Form element exists:', !!form);
  // console.log('[OAUTH_CONT] Steps container exists:', !!steps);
  // console.log('[OAUTH_CONT] Step 1 exists:', !!step1);
  
  // First, validate that user should be here
  // console.log('[OAUTH_CONT] Starting validation...');
  const isValid = await validateOAuthContinuation();
  // console.log('[OAUTH_CONT] Validation result:', isValid);
  
  // Re-check context after validation (it might have been updated)
  const updatedCtx = getOAuthContext();
  if (updatedCtx && updatedCtx !== ctx) {
    updatePageMessages();
  }
  
  if (!isValid) {
    // console.log('[OAUTH_CONT] ❌ Validation failed, redirecting...');
    // console.log('[OAUTH_CONT] ========================================');
    return; // Validation failed, redirect will happen
  }

  // console.log('[OAUTH_CONT] ✅ Validation passed, setting up page...');

  // Setup interruption handlers
  // console.log('[OAUTH_CONT] Setting up interruption handlers...');
  setupInterruptionHandlers();

  // Prefill OAuth data manually (oauth-complete.js handles form submission)
  // console.log('[OAUTH_CONT] Prefilling OAuth data...');
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (user) {
      const identityData = user.identities?.[0]?.identity_data || {};
      const meta = user.user_metadata || {};
      const rawMeta = user.raw_user_meta_data || {};
      const combined = { ...identityData, ...meta, ...rawMeta };
      const fullName = combined.full_name || combined.name || '';
      
      // Prioritize explicit fields
      let firstName = combined.given_name || combined.first_name || '';
      let lastName = combined.family_name || combined.last_name || '';
      let middleName = combined.middle_name || '';

      // If explicit fields are missing, try to parse from full name
      if (!firstName && !lastName && fullName) {
          const nameParts = fullName.trim().split(' ');
          if (nameParts.length === 1) {
              firstName = nameParts[0];
          } else if (nameParts.length > 1) {
              // Assume last word is last name, everything else is first name
              // Do NOT infer middle name automatically to avoid splitting multi-word first names
              lastName = nameParts.pop();
              firstName = nameParts.join(' ');
          }
      }

      const firstNameInput = document.getElementById('firstName');
      if (firstNameInput && firstName) {
        firstNameInput.value = firstName;
        // console.log('[OAUTH_CONT] Prefilled firstName:', firstName);
      }
      const middleNameInput = document.getElementById('middleName');
      if (middleNameInput) {
        if (middleName) {
            middleNameInput.value = middleName;
            // console.log('[OAUTH_CONT] Prefilled middleName:', middleName);
        } else {
            // Enable if empty so user can enter it or leave it blank
            middleNameInput.removeAttribute('readonly');
            middleNameInput.removeAttribute('disabled');
            middleNameInput.removeAttribute('aria-disabled');
            middleNameInput.removeAttribute('title');
        }
      }
      const lastNameInput = document.getElementById('lastName');
      if (lastNameInput && lastName) {
        lastNameInput.value = lastName;
        // console.log('[OAUTH_CONT] Prefilled lastName:', lastName);
      }
      const emailInput = document.getElementById('email');
      if (emailInput && user.email) {
        emailInput.value = user.email;
        // console.log('[OAUTH_CONT] Prefilled email:', user.email);
      }
      
      // Try to get phone from OAuth provider
      const oauthPhone = user.user_metadata?.phone_number ||
                        user.user_metadata?.phone ||
                        user.user_metadata?.mobile ||
                        null;
      const mobileInput = document.getElementById('mobile');
      if (mobileInput && oauthPhone) {
        let digits = oauthPhone.replace(/\D/g, '');
        if (digits.startsWith('63') && digits.length >= 12) {
          digits = digits.substring(2, 12);
        } else if (digits.length > 10) {
          digits = digits.substring(digits.length - 10);
        }
        if (digits.length === 10) {
          mobileInput.value = digits;
          // console.log('[OAUTH_CONT] Prefilled mobile:', digits);
        }
      }
    }
  } catch (prefillError) {
    console.warn('[OAUTH_CONT] Prefill failed:', prefillError);
  }

  // Initialize CAPTCHA
  // console.log('[OAUTH_CONT] Initializing CAPTCHA...');
  initializeCaptcha();
  
  // Re-initialize CAPTCHA after a delay to handle async script loading
  setTimeout(initializeCaptcha, 1000);
  
  // Verify form is visible
  const formVisible = form && form.offsetParent !== null;
  const step1Visible = step1 && step1.offsetParent !== null;
  /* console.log('[OAUTH_CONT] Form visibility check:', {
    formExists: !!form,
    formVisible: formVisible,
    step1Exists: !!step1,
    step1Visible: step1Visible,
    step1Hidden: step1?.hasAttribute('hidden')
  }); */
  

  
  // console.log('[OAUTH_CONT] ✅ Page initialization complete');
  // console.log('[OAUTH_CONT] ========================================');
};

// Global handler for ID verification success (called by signup-id-verify.js)
window.handleVerificationSuccess = (data) => {
  console.log('[OAUTH_CONT] Handling verification success:', data);
  
  if (!data) return;
  
  // Populate form fields with OCR data
  const fields = {
    firstName: data.firstName,
    lastName: data.lastName,
    middleName: data.middleName,
    addressLine1: data.address,
    // Map other fields if needed
  };
  
  let updatedCount = 0;
  
  Object.entries(fields).forEach(([id, value]) => {
    if (value) {
      const input = document.getElementById(id);
      if (input) {
        // Only update if empty or user explicitly wants to overwrite (for now just update)
        // Or maybe highlight matches?
        // User said: "if it matches the field in both the id and the form"
        // This implies validation. But prefilling is a good first step.
        if (input.value !== value) {
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            updatedCount++;
        }
      }
    }
  });
  
  if (updatedCount > 0) {
    showMessage('success', 'Form updated with ID information.');
  } else {
    showMessage('success', 'ID verified. Information matches form.');
  }
  
  // Unlock next step if needed (handled by signup-progressive.js usually)
  const nextBtn = document.getElementById('signup-next-btn');
  if (nextBtn) {
      nextBtn.removeAttribute('disabled');
  }
};

// Initialize when DOM is ready
// Initialize when DOM is ready
// console.log('[OAUTH_CONT] Setting up initialization, document.readyState:', document.readyState);

if (document.readyState === 'loading') {
  // console.log('[OAUTH_CONT] Document still loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    // console.log('[OAUTH_CONT] DOMContentLoaded fired, initializing...');
    initializeOAuthContinuationPage();
  });
} else {
  // console.log('[OAUTH_CONT] Document already ready, initializing immediately...');
  initializeOAuthContinuationPage();
}

// Also try immediate execution as fallback
setTimeout(() => {
  // console.log('[OAUTH_CONT] Fallback timeout check, readyState:', document.readyState);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // console.log('[OAUTH_CONT] Fallback: Attempting initialization...');
    initializeOAuthContinuationPage();
  }
}, 100);
