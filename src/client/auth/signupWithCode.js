import { supabase } from '../config/config.js';
import showMessage from '../components/toast.js';
import { validateAndSanitizeForm } from '../utils/validation.js';
import { renderPrivacyNotice } from '../utils/privacyContent.js';

// Add spinner animation if not present
if (!document.getElementById('spinner-animation')) {
  const style = document.createElement('style');
  style.id = 'spinner-animation';
  style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);
}

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
    const options = {
      redirectTo: `${window.location.origin}/complete-position-signup?code=${signupCode}`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      }
    };
    
    // Set valid scopes for Facebook (avoid invalid user_mobile_phone scope)
    if (provider === 'facebook') {
      options.scopes = 'email public_profile';
    }
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options
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
// Function to initialize signup code validation
function initializeSignupCodeValidation() {
  // Check if signup code is provided in URL
  if (!signupCode) {
    showMessage('error', 'No signup code provided in URL');
    // Disable form if no code
    const form = document.getElementById('signup-form');
    if (form) {
      form.style.opacity = '0.5';
      form.style.pointerEvents = 'none';
    }
  } else {
    // Validate signup code automatically on page load
    validateSignupCode(signupCode);
  }
}

// Attach OAuth button listeners (no inline handlers for CSP)
document.getElementById('oauth-google')?.addEventListener('click', () => signupWithOAuth('google'));
document.getElementById('oauth-facebook')?.addEventListener('click', () => signupWithOAuth('facebook'));

// Initialize validation when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeSignupCodeValidation();
    renderPrivacyNotice('#privacyModalContent', { headingTag: 'h4' });
  });
} else {
  // DOM is already loaded, run immediately
  initializeSignupCodeValidation();
  renderPrivacyNotice('#privacyModalContent', { headingTag: 'h4' });
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
      addressLine1: formData.get('addressLine1') || '',
      addressLine2: formData.get('addressLine2') || '',
      barangay: formData.get('barangay') || '',
      gender: formData.get('gender'),
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
    const originalHTML = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner" style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:white;border-radius:50%;vertical-align:middle;margin-right:8px;animation:spin 0.8s linear infinite"></span>Creating Account...';
    try {
      // Submit via API
      const response = await fetch('/api/auth/signup-with-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: validation.sanitizedData.name,
          address: {
            line1: data.addressLine1 || '',
            line2: data.addressLine2 || '',
            barangay: data.barangay || ''
          },
          gender: data.gender || '',
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
        showMessage('success', 'Account created successfully! Redirecting to dashboard...');
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 3000);
      } else {
        // Check if it's an expired code
        if (result.error && result.error.toLowerCase().includes('expired')) {
          showMessage('error', 'This signup code has expired. Please contact HR for a new link.');
          setTimeout(() => {
            window.location.href = '/';
          }, 3000);
        } else {
          const errMsg = (result && result.error ? String(result.error) : '').toLowerCase();
          if (errMsg.includes('already registered') || errMsg.includes('already exists') || errMsg.includes('duplicate') || errMsg.includes('email is used') || errMsg.includes('email taken')) {
            showMessage('error', 'Email is used');
          } else {
            showMessage('error', result.error || 'Registration failed');
          }
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      showMessage('error', 'Registration failed. Please try again.');
    } finally {
      // Reset button state
      submitButton.innerHTML = originalHTML;
      submitButton.disabled = false;
    }
  });
}
// Code validation removed - no automatic validation on blur
