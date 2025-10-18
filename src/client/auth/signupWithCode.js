import { supabase } from '../config/config.js';
import showMessage from '../components/toast.js';
import { validateAndSanitizeForm } from '../utils/validation.js';

// Get signup code from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const signupCode = urlParams.get('code');

// Pre-fill the signup code if provided in URL
if (signupCode) {
  const codeInput = document.getElementById('signupCode');
  if (codeInput) {
    codeInput.value = signupCode;
  }
}

// OAuth signup function
async function signupWithOAuth(provider) {
  try {
    const { supabase } = await import('../config/config.js');

    // Get OAuth URL with signup code in state parameter
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${window.location.origin}/complete-position-signup?code=${signupCode}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });

    if (error) {
      console.error('OAuth error:', error);
      showMessage('error', `Failed to sign in with ${provider}`);
      return;
    }

    // Redirect to OAuth provider
    window.location.href = data.url;
  } catch (error) {
    console.error('OAuth signup error:', error);
    showMessage('error', `Failed to sign in with ${provider}`);
  }
}

// Attach OAuth button listeners (no inline handlers for CSP)
document.getElementById('oauth-google')?.addEventListener('click', () => signupWithOAuth('google'));
document.getElementById('oauth-facebook')?.addEventListener('click', () => signupWithOAuth('facebook'));

// Check if signup code is provided in URL
if (!signupCode) {
  showMessage('error', 'No signup code provided in URL');
}

async function validateSignupCode(code) {
  try {
    const response = await fetch(`/api/hr/validate-signup-code/${code}?t=${Date.now()}`);
    const result = await response.json();

    if (result.valid) {
      showMessage('success', `Valid signup code for ${result.data.role} role`);
    } else {
      // Check if it's an expired code
      if (result.error && result.error.toLowerCase().includes('expired')) {
        showMessage('error', 'This signup code has expired. Please contact HR for a new link.');
        // Redirect to landing page after 3 seconds
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      } else {
        showMessage('error', result.error || 'Invalid signup code');
      }

      // Disable form if code is invalid
      const form = document.getElementById('signup-form');
      if (form) {
        form.style.opacity = '0.5';
        form.style.pointerEvents = 'none';
      }
    }
  } catch (error) {
    console.error('Code validation error:', error);
    showMessage('error', 'Failed to validate signup code');
  }
}

// Handle form submission
const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      mobile: formData.get('mobile'),
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword'),
      signupCode: formData.get('signupCode'),
      agreedToTerms: formData.get('agreedToTerms') === 'on'
    };

    // Validation rules
    const validationRules = {
      name: { required: true, minLength: 2, maxLength: 100 },
      email: { required: true, type: 'email' },
      mobile: { required: true, type: 'mobile' },
      password: { required: true, type: 'password' }
    };

    const validation = validateAndSanitizeForm(data, validationRules);

    if (!validation.isValid) {
      showMessage('error', validation.errors.join(', '));
      return;
    }

    // Show loading state
    const submitButton = e.target.querySelector('button[type="submit"]');
    const buttonText = submitButton.querySelector('.button-text');
    const buttonLoading = submitButton.querySelector('.button-loading');

    buttonText.style.display = 'none';
    buttonLoading.style.display = 'flex';
    submitButton.disabled = true;

    try {
      // Submit via API
      const response = await fetch('/api/auth/signup-with-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: validation.sanitizedData.name,
          email: validation.sanitizedData.email,
          mobileNumber: `+63${validation.sanitizedData.mobile}`,
          password: data.password,
          confirmPassword: data.confirmPassword,
          signupCode: data.signupCode,
          agreedToTerms: true,
          isOAuth: false
        })
      });

      const result = await response.json();

      if (result.success) {
        showMessage('success', 'Account created successfully! Please check your email to verify your account.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
      } else {
        // Check if it's an expired code
        if (result.error && result.error.toLowerCase().includes('expired')) {
          showMessage('error', 'This signup code has expired. Please contact HR for a new link.');
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
        } else {
          showMessage('error', result.error || 'Registration failed');
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      showMessage('error', 'Registration failed. Please try again.');
    } finally {
      // Reset button state
      buttonText.style.display = 'block';
      buttonLoading.style.display = 'none';
      submitButton.disabled = false;
    }
  });
}

// Code validation removed - no automatic validation on blur
