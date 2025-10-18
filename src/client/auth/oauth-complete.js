import { supabase } from '../config/config.js';
import showMessage from '../components/toast.js';

// reCAPTCHA setup - using auto-rendered captcha from HTML
const oauthCompleteCaptchaWidgetId = 0; // Default ID for auto-rendered captchas

// Wait for captcha to be ready
const waitForCaptcha = () => {
  if (window.grecaptcha && window.grecaptcha.getResponse) {
    console.log('Captcha is ready');
    return true;
  }
  return false;
};

// Check if captcha is ready, retry if not
const checkCaptchaReady = () => {
  if (waitForCaptcha()) {
    console.log('Captcha ready, widget ID:', oauthCompleteCaptchaWidgetId);
  } else {
    console.log('Captcha not ready, retrying...');
    setTimeout(checkCaptchaReady, 500);
  }
};

// Start checking for captcha readiness
checkCaptchaReady();

async function verifyCaptchaOrFail(widgetId) {
  console.log('Verifying captcha, widgetId:', widgetId);

  if (widgetId === null || widgetId === undefined) {
    console.log('Widget ID is null/undefined');
    showMessage('error', 'Captcha not ready. Please wait and try again.');
    return { ok: false };
  }

  if (!window.grecaptcha) {
    console.log('grecaptcha not available');
    showMessage('error', 'reCAPTCHA not loaded. Please refresh the page.');
    return { ok: false };
  }

  const token = window.grecaptcha.getResponse(widgetId);
  console.log('Captcha token:', token ? 'present' : 'missing');

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

// Prefill OAuth data from provider
const prefillOAuthData = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (user) {
      // Extract name from various OAuth provider sources
      const name = user.user_metadata?.name ||
                   (user.user_metadata?.first_name && user.user_metadata?.last_name ?
                     `${user.user_metadata.first_name} ${user.user_metadata.last_name}` : '') ||
                   '';

      // Prefill name (read-only)
      const nameInput = document.getElementById('name');
      if (nameInput && name) {
        nameInput.value = name.trim();
      }

      // Prefill email (read-only)
      const emailInput = document.getElementById('email');
      if (emailInput && user.email) {
        emailInput.value = user.email;
      }

      // Try to get phone from OAuth provider (Google, Facebook, etc.)
      // Google provides: user_metadata.phone_number or user_metadata.phone
      // Facebook provides: user_metadata.phone_number
      const oauthPhone = user.user_metadata?.phone_number ||
                        user.user_metadata?.phone ||
                        user.user_metadata?.mobile ||
                        null;

      const mobileInput = document.getElementById('mobile');
      if (mobileInput) {
        if (oauthPhone) {

          // Extract digits only (handle various formats: +63XXX, +1XXX, etc.)
          let digits = oauthPhone.replace(/\D/g, '');

          // If it starts with country code, try to extract Philippines mobile
          if (digits.startsWith('63') && digits.length >= 12) {
            // Remove country code 63 and keep 10 digits
            digits = digits.substring(2, 12);
          } else if (digits.length === 10) {
            // Already 10 digits, use as is
          } else if (digits.length > 10) {
            // Take last 10 digits
            digits = digits.substring(digits.length - 10);
          }

          mobileInput.value = digits;
          mobileInput.readOnly = true;
          mobileInput.style.background = '#f5f5f5';
          mobileInput.style.cursor = 'not-allowed';
          console.log('[OAUTH] Phone field locked with value:', digits);
        } else {
          // No phone from OAuth - keep field editable
          console.log('[OAUTH] No phone from provider - field remains editable');
          mobileInput.readOnly = false;
          mobileInput.style.background = '';
          mobileInput.style.cursor = '';
          mobileInput.required = true;
        }
      }
    }
  } catch (error) {
    console.error('Error prefilling OAuth data:', error);
  }
};

// Handle form submission
const oauthCompleteForm = document.getElementById('oauthCompleteForm');
if (oauthCompleteForm) {
  oauthCompleteForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const mobile = document.getElementById('mobile').value.trim();

    if (!name) {
      showMessage('error', 'Name is required');
      return;
    }

    if (!email) {
      showMessage('error', 'Email is required');
      return;
    }

    if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
      showMessage('error', 'Please enter a valid 10-digit mobile number');
      return;
    }

    // verify captcha (skip if not available)
    if (oauthCompleteCaptchaWidgetId !== null) {
      const captchaResult = await verifyCaptchaOrFail(oauthCompleteCaptchaWidgetId);
      if (!captchaResult.ok) return;
    } else {
      console.log('Captcha not available, skipping verification');
    }

    // Update user metadata with mobile number and complete profile via backend
    try {
      const response = await fetch('/api/auth/complete-oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          mobile
        })
      });

      const result = await response.json();

      if (!result.success) {
        showMessage('error', result.error || 'Failed to complete registration');
        return;
      }

      showMessage('success', 'Profile completed successfully! Redirecting to dashboard...');
      setTimeout(() => {
        // Redirect directly to dashboard (user is already authenticated)
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err) {
      console.error('OAuth completion error:', err);
      showMessage('error', 'Registration failed. Please try again.');
    }
  });
}

// Terms and Privacy handlers
document.getElementById('toc').addEventListener('click', () => {
  document.getElementById('terms').innerHTML = '<h3>Terms and Conditions</h3><p>Your terms content here...</p>';
});

document.getElementById('pc').addEventListener('click', () => {
  document.getElementById('privacy').innerHTML = '<h3>Privacy Policy</h3><p>Your privacy policy content here...</p>';
});

// Prefill data on page load
prefillOAuthData();

