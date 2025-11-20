import { supabase } from '../config/config.js';
import { saveUserMeta, setOAuthContext, clearOAuthContext, getOAuthContext } from '../auth/authChecker.js';

const run = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const isPopupFlow = urlParams.get('popup') === '1' || Boolean(window.opener);
  const oauthContext = getOAuthContext() || {};

  const notifyExistingUser = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      await fetch('/auth/session', { method: 'DELETE' });
    } catch {}
    clearOAuthContext();
    if (window.opener) {
      window.opener.postMessage({ type: 'oauth-user-exists' }, window.location.origin);
      setTimeout(() => {
        try { window.close(); } catch {}
      }, 200);
    } else {
      window.location.href = '/login?err=user_exists';
    }
  };
  try {
    // Check for error or success messages in URL hash
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const error = hashParams.get('error');
      const errorCode = hashParams.get('error_code');
      const errorDescription = hashParams.get('error_description');
      const message = hashParams.get('message');
      const type = hashParams.get('type') || (error || errorCode ? 'error' : 'success');

      // Import toast module
      const { default: showMessage } = await import('./toast.js');

      // Handle error messages
      if (error || errorCode) {
        // Determine error message based on error code
        let errorMessage = 'An error occurred';
        if (errorCode === 'otp_expired') {
          errorMessage = 'The email link has expired. Please request a new one.';
        } else if (errorCode === 'access_denied') {
          errorMessage = 'Access denied. The link may be invalid or expired.';
        } else if (errorDescription) {
          // Decode URL-encoded description
          errorMessage = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
        } else if (error) {
          errorMessage = `Authentication error: ${error}`;
        }

        // Show error toast
        showMessage('error', errorMessage, 8000);

        // Clean up URL hash
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

        // Redirect to appropriate page based on error
        if (errorCode === 'otp_expired') {
          // For expired OTP, redirect to login or appropriate page
          setTimeout(() => {
            window.location.href = '/login';
          }, 3000);
        } else {
          // For other errors, redirect to login
          setTimeout(() => {
            window.location.href = '/login';
          }, 3000);
        }
        return; // Exit early, don't process success flow
      }

      // Handle success messages
      if (message) {
        // Decode URL-encoded message (handle both + and %20 for spaces)
        let decodedMessage = decodeURIComponent(message.replace(/\+/g, ' '));
        
        // Clean up any trailing delimiters (pipe, semicolon, etc.)
        decodedMessage = decodedMessage.replace(/[|;]$/, '').trim();
        
        // Determine toast type (success, info, warning, error)
        const toastType = type === 'error' ? 'error' : 
                         type === 'warning' ? 'warning' : 
                         type === 'info' ? 'info' : 'success';

        // Show success/info toast
        showMessage(toastType, decodedMessage, 8000);

        // Clean up URL hash
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        
        // Don't return here - continue with normal flow to process session
      }
    }

    // After OAuth or email confirmation, Supabase sets a session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    // console.log removed for security
    const user = session?.user;
    const accessToken = session?.access_token || null;
    const role = user?.user_metadata?.role || null;
    const name = user?.user_metadata?.name || null;
    const email = user?.email || null;
    // console.log removed for security
    if (role || name) saveUserMeta({ role, name });
    // Track provider
    const provider = user?.identities?.[0]?.provider || null;
    // console.log removed for security
    if (provider) {
      setOAuthContext({ provider, email });
      // merge into oauth_providers array
      try {
        const currentProviders = Array.isArray(user?.user_metadata?.oauth_providers)
          ? user.user_metadata.oauth_providers
          : [];
        const nextProviders = Array.from(new Set([...currentProviders, provider]));
        await supabase.auth.updateUser({ data: { oauth_providers: nextProviders } });
      } catch (error) {
        console.error('[SUCCESS] Error updating OAuth providers:', error);
      }
    }
    const userMetadata = user?.user_metadata || {};
    const hasFullProfile = Boolean(
      (userMetadata.mobile_number || userMetadata.mobile || user?.phone) &&
      (role || userMetadata.role)
    );
    const cameFromSignup = oauthContext.intent === 'signup';
    
    // Check if user has completed registration
    const hasMobile = user?.user_metadata?.mobile ||
                     user?.user_metadata?.phone ||
                     user?.user_metadata?.phone_number ||
                     user?.phone;
    const isFullyRegistered = role && name && hasMobile;
    
    // CRITICAL: Only set session cookie if user has completed registration
    // For incomplete OAuth signups, NEVER set the cookie - this prevents marking as logged in
    if (isFullyRegistered && accessToken) {
      try {
        const resp = await fetch('/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken })
        });
        // Verify cookie by hitting a protected endpoint before redirecting
        if (resp.ok) {
          let ok = false;
          try {
            const check1 = await fetch('/api/user/role', { method: 'GET' });
            ok = check1.ok;
          } catch (error) {
            console.error('[SUCCESS] First role check error:', error);
          }
          if (!ok) {
            await new Promise(r => setTimeout(r, 300));
            try {
              const check2 = await fetch('/api/user/role', { method: 'GET' });
              ok = check2.ok;
            } catch (error) {
              console.error('[SUCCESS] Second role check error:', error);
            }
          }
          if (!ok) {
            // If cannot verify, stay on page and let user refresh
            return;
          }
        }
      } catch (error) {
        console.error('[SUCCESS] Session persistence error:', error);
      }
    } else {
      // For incomplete OAuth signups, explicitly clear any existing session cookie
      // to prevent being marked as logged in
      try {
        await fetch('/auth/session', { method: 'DELETE' });
      } catch (error) {
        // Silently fail - cookie might not exist
      }
      
      // Also clear Supabase session to prevent auto-login
      try {
        await supabase.auth.signOut();
      } catch (error) {
        // Silently fail
      }
    }

    // Check if user already exists (has full profile but came from signup)
    if (cameFromSignup && hasFullProfile) {
      await notifyExistingUser();
      return;
    }

    // For incomplete OAuth signups, set context to 'handoff' (not 'pending')
    // This allows continuation page to load but prevents auth checks
    if (cameFromSignup && !isFullyRegistered) {
      setOAuthContext({ 
        provider, 
        email, 
        intent: 'signup', 
        status: 'handoff', // Changed from 'pending' to allow continuation page
        startedAt: Date.now()
      });
    } else {
      clearOAuthContext();
    }

    if (isPopupFlow) {
      const identityData = user?.identities?.[0]?.identity_data || {};
      const userMeta = user?.user_metadata || {};
      const rawMeta = user?.raw_user_meta_data || {};
      const combined = {
        ...rawMeta,
        ...userMeta,
        ...identityData
      };
      const fullName = combined.full_name || combined.name || '';
      const splitName = fullName ? fullName.trim().split(' ') : [];
      const firstName = combined.given_name || combined.first_name || splitName[0] || '';
      const lastName = combined.family_name || combined.last_name || splitName.slice(1).join(' ') || '';
      const middleName = combined.middle_name || splitName.slice(1, -1).join(' ') || '';
      const payload = { provider, email, firstName, middleName, lastName };
      if (window.opener) {
        try {
          window.opener.postMessage({ type: 'oauth-signup-success', payload }, window.location.origin);
        } catch (postError) {
          console.error('[SUCCESS] Failed to notify opener:', postError);
        }
      }
      setTimeout(() => {
        try {
          window.close();
        } catch {
          // If popup can't close, redirect to continuation
          window.location.href = '/oauth-continuation';
        }
      }, 200);
      return;
    }

    // Redirect based on registration status
    if (provider && !isFullyRegistered) {
      // Incomplete OAuth signup - redirect to continuation
      window.location.href = '/oauth-continuation';
    } else if (isFullyRegistered) {
      // Complete registration - redirect to dashboard
      clearOAuthContext();
      window.location.href = '/dashboard';
    } else {
      // Fallback - should not happen
      clearOAuthContext();
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('[SUCCESS] Main error:', error);
    // Fallback: redirect to dashboard anyway
    window.location.href = '/dashboard';
  }
};
run();
