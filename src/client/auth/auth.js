// login, register, change pass, and additional social media
import { supabase } from '../config/config.js';
import showMessage from '../components/toast.js';
import { saveUserMeta, getOAuthContext } from './authChecker.js';
import { addCsrfTokenToForm } from '../utils/csrf.js';
import { validateAndSanitizeForm, isValidPhilippineMobile, validatePassword, isValidEmail } from '../utils/validation.js';
// Show toast on login page if redirected due to missing auth
try {
  const isLoginPage = /\/login(?:$|\?)/.test(window.location.pathname + window.location.search);
  if (isLoginPage) {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('err');
    if (err === 'not_authenticated') {
      showMessage('error', 'Please log in to continue');
    }
  }
} catch {}

export const retrieveUserRole = async () => {};

// reCAPTCHA setup
let loginCaptchaWidgetId = null;
let registerCaptchaWidgetId = null;
let siteKey = '';

// Fetch CAPTCHA key securely from server
async function getCaptchaKey() {
  try {
    const response = await fetch('/api/captcha/key');
    const data = await response.json();
    return data.key || '';
  } catch (error) {
    console.error('Failed to fetch CAPTCHA key:', error);
    return '';
  }
}

async function renderCaptchaWidgetsIfAny() {
  // Skip reCAPTCHA in development mode
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // console.log removed for security
    return;
  }

  if (!window.grecaptcha) return;

  // Fetch CAPTCHA key if not already loaded
  if (!siteKey) {
    siteKey = await getCaptchaKey();
  }

  if (!siteKey) return;

  window.grecaptcha.ready(() => {
    const loginEl = document.getElementById('login-captcha');
    if (loginEl && loginCaptchaWidgetId === null) {
      loginCaptchaWidgetId = window.grecaptcha.render(loginEl, { sitekey: siteKey });
    }
    const regEl = document.getElementById('register-captcha');
    if (regEl && registerCaptchaWidgetId === null) {
      registerCaptchaWidgetId = window.grecaptcha.render(regEl, { sitekey: siteKey });
    }
  });
}

// Try render on load and after a short delay to cover async script load
renderCaptchaWidgetsIfAny();
setTimeout(renderCaptchaWidgetsIfAny, 500);

async function verifyCaptchaOrFail(widgetId) {
  // Skip reCAPTCHA verification in development mode
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // console.log removed for security
    return { ok: true };
  }

  if (!widgetId && widgetId !== 0) {
    showMessage('error', 'Captcha not ready. Please wait and try again.');
    return { ok: false };
  }
  const token = window.grecaptcha ? window.grecaptcha.getResponse(widgetId) : '';
  if (!token) {
    showMessage('error', 'Please complete the captcha.');
    return { ok: false };
  }
  try {
    const res = await fetch('/api/captcha/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const json = await res.json();
    if (json && json.success) {
      return { ok: true };
    }
    showMessage('error', 'Captcha verification failed. Please try again.');
    return { ok: false };
  } catch (_err) {
    showMessage('error', 'Captcha verification error. Please try again.');
    return { ok: false };
  } finally {
    if (window.grecaptcha) {
      try { window.grecaptcha.reset(widgetId); } catch (_e) {}
    }
  }
}

const regFormEl = document.getElementById('regForm');
if (regFormEl) regFormEl.addEventListener('submit', async (e) => {
  e.preventDefault(); // prevent page refresh

  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const mobile = document.getElementById('mobile').value.trim();
  const regPass = document.getElementById('regPassword').value;
  const reRegPass = document.getElementById('reRegPassword').value;

  // Early password length checks
  if (!regPass || regPass.length < 8) {
    showMessage('error', 'Password must be at least 8 characters long');
    return;
  }

  // Validate form data
  const validationRules = {
    name: { required: true, minLength: 2, maxLength: 100 },
    email: { required: true, type: 'email' },
    mobile: { required: true, type: 'mobile' },
    regPassword: { required: true, type: 'password' }
  };

  const formData = { name, email, mobile, regPassword };
  const validation = validateAndSanitizeForm(formData, validationRules);

  if (!validation.isValid) {
    showMessage('error', validation.errors.join(', '));
    return;
  }

  // Additional password confirmation check
  if (reRegPass !== regPass) {
    showMessage('error', 'Passwords don\'t match');
    return;
  }

  // verify captcha
  const captchaResult = await verifyCaptchaOrFail(registerCaptchaWidgetId);
  if (!captchaResult.ok) return;

  try {
    // Build JSON payload (role defaults to 'citizen' on backend)
    const payload = {
      email: validation.sanitizedData.email,
      password: regPass,
      confirmPassword: reRegPass,
      name: validation.sanitizedData.name, // Single name field
      mobileNumber: `+63${validation.sanitizedData.mobile}`,
      // role: 'citizen', // ❌ Removed - Backend defaults to citizen
      agreedToTerms: true,
      isOAuth: false // Regular signup
    };

    // Submit via API instead of direct Supabase call
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.success) {
      // Ensure browser Supabase client has the session to prevent auto-logout
      try {
        const accessToken = result.data?.session?.accessToken || null;
        const refreshToken = result.data?.session?.refreshToken || null;
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        }
      } catch (e) {
        console.warn('Failed to set Supabase client session:', e);
      }
      showMessage('success', 'Successfully registered. Please confirm via the email we sent.');
      setTimeout(()=>{window.location.href = '/login';},3000);
    } else {
      showMessage('error', result.error || 'Registration failed');
    }
  } catch (error) {
    console.error('Registration error:', error);
    showMessage('error', 'Registration failed. Please try again.');
  }
});

const loginFormEl = document.getElementById('login');
if (loginFormEl) loginFormEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const pass = document.getElementById('password').value;
  const remember = document.getElementById('remember-me')?.checked || false;

  // Get login button elements
  const loginBtn = document.getElementById('login-submit-btn');
  const loginBtnIcon = document.getElementById('login-btn-icon');
  const loginBtnText = document.getElementById('login-btn-text');

  // Function to show loading state
  const showLoading = () => {
    if (!loginBtn || !loginBtnIcon) return;
    
    // Store original icon HTML
    const originalIcon = loginBtnIcon.outerHTML;
    loginBtn.dataset.originalIcon = originalIcon;
    
    // Replace icon with loading spinner (CSS animation will handle rotation)
    loginBtnIcon.innerHTML = `
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/>
      <path d="M12 2 A10 10 0 0 1 22 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-dasharray="15 10"/>
    `;
    loginBtnIcon.classList.add('spinning');
    
    // Disable button
    loginBtn.disabled = true;
    loginBtnText.textContent = 'Signing in...';
  };

  // Function to hide loading state
  const hideLoading = () => {
    if (!loginBtn || !loginBtnIcon) return;
    
    // Restore original icon if stored
    if (loginBtn.dataset.originalIcon) {
      const originalIconHtml = loginBtn.dataset.originalIcon;
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = originalIconHtml;
      const restoredIcon = tempDiv.firstElementChild;
      loginBtnIcon.parentNode.replaceChild(restoredIcon, loginBtnIcon);
    }
    
    // Re-enable button
    loginBtn.disabled = false;
    loginBtnText.textContent = 'Sign in';
  };

  // Basic validation
  if (!email || !pass) {
    showMessage('error', 'Email and password are required');
    return;
  }

  if (!isValidEmail(email)) {
    showMessage('error', 'Please enter a valid email address');
    return;
  }

  // Show loading state
  showLoading();

  // verify captcha
  const captchaResult = await verifyCaptchaOrFail(loginCaptchaWidgetId);
  if (!captchaResult.ok) {
    hideLoading();
    return;
  }

  try {
    // Submit via API with JSON body
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, remember })
    });

    const result = await response.json();

    if (result.success) {
      // Persist access token to HttpOnly cookie for server-protected pages
      try {
        const accessToken = result.data?.session?.accessToken || null;
        // console.log removed for security
        // console.log removed for security

        if (accessToken) {
          // console.log removed for security
          // console.log removed for security

          const ok = await setServerSessionCookie(accessToken, remember);
          // console.log removed for security
          if (!ok) {
            console.error('[CLIENT AUTH] ❌ Failed to establish session');
            showMessage('error', 'Failed to establish session. Please try again.');
            return;
          }

          // console.log removed for security
          // Wait a moment for cookie to be set
          await new Promise(r => setTimeout(r, 100));

          // console.log removed for security
          // console.log removed for security

          // Verify cookie by hitting a protected endpoint before redirecting
          // console.log removed for security
          const resp = await fetch('/api/user/role', {
            method: 'GET',
            credentials: 'include', // Ensure cookies are sent
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });

          // console.log removed for security

          if (!resp.ok) {
            // console.log removed for security
            const errorData = await resp.json().catch(() => ({}));
            // console.log removed for security

            // Try one more time with a longer wait
            // console.log removed for security
            await new Promise(r => setTimeout(r, 1000));

            const retryResp = await fetch('/api/user/role', {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            });

            // console.log removed for security

            if (retryResp.ok) {
              // console.log removed for security
            } else {
              const retryErrorData = await retryResp.json().catch(() => ({}));
              console.error('[CLIENT AUTH] ❌ Retry also failed:', retryErrorData);

              // Enhanced error message based on specific error
              let errorMessage = 'Session verification failed. ';
              if (retryResp.status === 401) {
                errorMessage += 'Your session has expired. Please log in again.';
              } else if (retryResp.status === 403) {
                errorMessage += 'Access denied. Please contact support.';
              } else if (retryResp.status >= 500) {
                errorMessage += 'Server error. Please try again later.';
              } else {
                errorMessage += 'Please try logging in again.';
              }

              showMessage('error', errorMessage);
              hideLoading();
              return;
            }
          }

          // console.log removed for security
        }
      } catch (error) {
        console.error('[CLIENT AUTH] Error in session setup:', error);
        hideLoading();
        throw error; // Re-throw to be caught by outer catch
      }

      showMessage('success', 'Logged in successfully');
      // Get role from multiple sources
      const sessionUserMetadata = result.data?.session?.user?.user_metadata || {};
      const sessionRawUserMetadata = result.data?.session?.user?.raw_user_meta_data || {};

      // console.log removed for security

      const combinedSessionMetadata = { ...sessionRawUserMetadata, ...sessionUserMetadata };

      const role = result.data?.user?.role
        || combinedSessionMetadata.role
        || combinedSessionMetadata.normalized_role
        || sessionUserMetadata.role
        || sessionRawUserMetadata.role
        || null;

      const name = result.data?.user?.fullName
        || (result.data?.user?.firstName && result.data?.user?.lastName ? `${result.data.user.firstName} ${result.data.user.lastName}` : null)
        || combinedSessionMetadata.name
        || sessionUserMetadata.name
        || sessionRawUserMetadata.name
        || null;

      // console.log removed for security

      if (role || name) {
        saveUserMeta({ role, name });
        // console.log removed for security
      }

      // Check if user has completed registration
      if (!role || !name) {
        // console.log removed for security
        showMessage('error', 'Please complete your profile first');
        setTimeout(() => {
          // console.log removed for security
          window.location.href = '/OAuthContinuation';
        }, 2000);
        return;
      }

      // Redirect to dashboard based on role
      // console.log removed for security
      setTimeout(() => {
        // console.log removed for security
        window.location.href = '/dashboard';
      }, 1500);
    } else {
      showMessage('error', result.error || 'Login failed');
      // If OAuth context suggests provider was intended but failed, route to signup
      const ctx = getOAuthContext();
      if (ctx && ctx.provider) {
        window.location.href = '/signup';

      }
    }
  } catch (error) {
    console.error('Login error:', error);
    showMessage('error', 'Login failed. Please try again.');
  }
});

// OAuth sign-in buttons
const googleBtn = document.getElementById('login-google');
if (googleBtn) {
  googleBtn.addEventListener('click', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/success`,
        // Request additional scopes to get phone number
        scopes: 'email profile https://www.googleapis.com/auth/user.phonenumbers.read'
      }
    });
    if (error) {
      showMessage('error', error.message || 'Google sign-in failed');
      window.location.href = '/signup';
    }
  });
}

const fbBtn = document.getElementById('login-facebook');
if (fbBtn) {
  fbBtn.addEventListener('click', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${window.location.origin}/success`,
        // Request phone number permission from Facebook
        scopes: 'email public_profile user_mobile_phone'
      }
    });
    if (error) {
      showMessage('error', error.message || 'Facebook sign-in failed');
      window.location.href = '/signup';
    }
  });
}

// Email field remains empty and editable for both login and register

// Utility to post session cookie with remember flag
async function setServerSessionCookie(accessToken, remember) {
  try {
    // console.log removed for security
    // console.log removed for security

    const resp = await fetch('/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ access_token: accessToken, remember: Boolean(remember) })
    });

    // console.log removed for security

    const responseData = await resp.json();
    // console.log removed for security

    if (!resp.ok) {
      console.error('[CLIENT AUTH] ❌ Failed to set session cookie:', responseData);
      return false;
    }

    return responseData.success === true;
  } catch (error) {
    console.error('[CLIENT AUTH] 💥 Server session cookie error:', error);
    return false;
  }
}

// If not remembered, clear cookie on unload (best-effort for session cleanup)
(function setupEphemeralSessionCleanup(){
  try {
    const rememberCheckbox = document.getElementById('remember-me');
    if (!rememberCheckbox) return;
    if (rememberCheckbox.checked) return; // user wants persistent
    window.addEventListener('beforeunload', async () => {
      try { await fetch('/auth/session', { method: 'DELETE' }); } catch {}
    });
  } catch {}
})();