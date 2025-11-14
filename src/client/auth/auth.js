// login, register, change pass, and additional social media
import { supabase } from '../config/config.js';
import showMessage from '../components/toast.js';
import { saveUserMeta, getOAuthContext } from './authChecker.js';
import { setButtonLoading, temporarilyMark } from '../utils/buttonState.js';
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
  const firstName = document.getElementById('firstName')?.value.trim() || '';
  const lastName = document.getElementById('lastName')?.value.trim() || '';
  const email = document.getElementById('email').value.trim();
  const mobile = document.getElementById('mobile').value.trim();
  const addressLine1 = document.getElementById('addressLine1')?.value.trim() || '';
  const addressLine2 = document.getElementById('addressLine2')?.value.trim() || '';
  const barangay = document.getElementById('barangay')?.value.trim() || '';
  const gender = document.getElementById('gender')?.value || '';
  const regPass = document.getElementById('regPassword').value;
  const reRegPass = document.getElementById('reRegPassword').value;
  // Early password length checks
  if (!regPass || regPass.length < 8) {
    showMessage('error', 'Password must be at least 8 characters long');
    return;
  }
  // Validate form data
  const validationRules = {
    firstName: { required: true, minLength: 1, maxLength: 100 },
    lastName: { required: true, minLength: 1, maxLength: 100 },
    email: { required: true, type: 'email' },
    mobile: { required: true, type: 'mobile' },
    regPassword: { required: true, type: 'password' },
    addressLine1: { required: false, minLength: 0, maxLength: 255 },
    addressLine2: { required: false, minLength: 0, maxLength: 255 },
    barangay: { required: false, minLength: 0, maxLength: 100 },
    gender: { required: false }
  };
  const formData = { firstName, lastName, email, mobile, regPassword: regPass, addressLine1, addressLine2, barangay, gender };
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
    const submitBtn = regFormEl.querySelector('button[type="submit"], .btn-primary, .btn');
    const resetBtn = setButtonLoading(submitBtn, 'Creating account...');
    // Build JSON payload (role defaults to 'citizen' on backend)
    const payload = {
      email: validation.sanitizedData.email,
      password: regPass,
      confirmPassword: reRegPass,
      firstName: validation.sanitizedData.firstName,
      lastName: validation.sanitizedData.lastName,
      mobileNumber: `+63${validation.sanitizedData.mobile}`,
      gender: validation.sanitizedData.gender || '',
      address: {
        line1: validation.sanitizedData.addressLine1 || '',
        line2: validation.sanitizedData.addressLine2 || '',
        barangay: validation.sanitizedData.barangay || ''
      },
      // role: 'citizen', // backend defaults to citizen
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
    // Be tolerant of API variations: treat 2xx with clear success message as success
    const successMessage = (result && result.message) ? String(result.message) : '';
    const isHttpSuccess = response.ok; // includes 201
    const isApiSuccess = result && result.success === true;
    const looksLikeSuccess = /account created|verify your email|verification email/i.test(successMessage);
    if (isHttpSuccess && (isApiSuccess || looksLikeSuccess)) {
      // SECURITY: Tokens are no longer in response, Supabase session is managed server-side
      // Server sets HttpOnly cookie, client relies on that for authentication
      // No need to manually set session here as server handles it
      showMessage('success', 'Successfully registered. Please confirm via the email we sent.');
      temporarilyMark(submitBtn, 'Success', 'btn-success');
      resetBtn();
      setTimeout(()=>{window.location.href = '/login';},3000);
    } else {
      const errMsg = (result && result.error ? String(result.error) : '').toLowerCase();
      if (errMsg.includes('already registered') || errMsg.includes('already exists') || errMsg.includes('duplicate') || errMsg.includes('email is used') || errMsg.includes('email taken')) {
        showMessage('error', 'Email is used');
      } else {
        showMessage('error', result.error || successMessage || 'Registration failed');
      }
      temporarilyMark(submitBtn, 'Failed', 'btn-danger');
      resetBtn();
    }
  } catch (error) {
    console.error('Registration error:', error);
    showMessage('error', 'Registration failed. Please try again.');
    try { const submitBtn = regFormEl.querySelector('button[type="submit"], .btn-primary, .btn'); temporarilyMark(submitBtn, 'Failed', 'btn-danger'); } catch {}
    try { const submitBtn = regFormEl.querySelector('button[type="submit"], .btn-primary, .btn'); } catch {}
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
      // SECURITY: Server handles all authentication and sets HttpOnly cookie
      // Client syncs Supabase session state using refresh token from server response
      try {
        // Server already authenticated and set cookie, now sync client-side Supabase session
        const refreshToken = result.data?.refresh_token;
        const expiresAt = result.data?.expires_at;
        
        if (refreshToken) {
          // Use refresh token to get full Supabase session without re-authenticating
          const { data: sessionData, error: refreshError } = await supabase.auth.refreshSession({
            refresh_token: refreshToken
          });
          
          if (refreshError || !sessionData?.session) {
            console.warn('[CLIENT AUTH] ⚠️ Failed to sync Supabase session:', refreshError?.message);
            // Server cookie is still valid, continue with server-side auth only
            // Some client-side Supabase features may not work, but core functionality will
          } else {
            // Successfully synced Supabase session
            // Server cookie is already set, client session is now synced
          }
        } else {
          console.warn('[CLIENT AUTH] ⚠️ No refresh token in response, client-side Supabase features may be limited');
        }
        
        // Verify session by hitting a protected endpoint
        await new Promise(r => setTimeout(r, 100)); // Brief wait for cookie to be set
        const resp = await fetch('/api/user/role', {
          method: 'GET',
          credentials: 'include', // Ensure cookies are sent
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!resp.ok) {
          // Try one more time with a longer wait
          await new Promise(r => setTimeout(r, 1000));
          const retryResp = await fetch('/api/user/role', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (!retryResp.ok) {
            const retryErrorData = await retryResp.json().catch(() => ({}));
            console.error('[CLIENT AUTH] ❌ Session verification failed:', retryErrorData);
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
      } catch (error) {
        console.error('[CLIENT AUTH] Error in session sync:', error);
        // Don't fail login if session sync fails - server cookie is still valid
        // Log error but continue with server-side authentication
      }
      showMessage('success', 'Logged in successfully');
      // SECURITY: Use user data from server response (server is source of truth)
      // Fall back to Supabase session only if server data is incomplete
      const serverUser = result.data?.user;
      let role = serverUser?.role || serverUser?.normalizedRole || null;
      let name = serverUser?.name || serverUser?.fullName || null;
      
      // If server data is incomplete, try to get from Supabase session
      if (!role || !name) {
        const { data: { session: clientSession } } = await supabase.auth.getSession();
        if (clientSession?.user) {
          const userMetadata = clientSession.user.user_metadata || {};
          const rawUserMetaData = clientSession.user.raw_user_meta_data || {};
          const combinedMetadata = { ...userMetadata, ...rawUserMetaData };
          role = role || combinedMetadata.role || combinedMetadata.normalized_role || null;
          name = name || combinedMetadata.name || null;
        }
      }
      
      // Save user metadata for client-side use
      if (role || name) {
        saveUserMeta({ role, name });
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
        // Valid Facebook scopes: email and public_profile
        scopes: 'email public_profile'
      }
    });
    if (error) {
      showMessage('error', error.message || 'Facebook sign-in failed');
      window.location.href = '/signup';
    }
  });
}
// Email field remains empty and editable for both login and register
// Note: Session cookie is now set by server during login - no client-side cookie setting needed
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
