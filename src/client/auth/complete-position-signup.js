import { supabase } from '../config/config.js';
import showMessage from '../components/toast.js';

// Get signup code from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const signupCode = urlParams.get('code');

// reCAPTCHA setup
let positionSignupCaptchaWidgetId = 0;

// Wait for captcha to be ready
const waitForCaptcha = () => {
  if (window.grecaptcha && window.grecaptcha.getResponse) {
    console.log("Captcha is ready");
    return true;
  }
  return false;
};

// Check if captcha is ready, retry if not
const checkCaptchaReady = () => {
  if (waitForCaptcha()) {
    console.log("Captcha ready, widget ID:", positionSignupCaptchaWidgetId);
  } else {
    console.log("Captcha not ready, retrying...");
    setTimeout(checkCaptchaReady, 500);
  }
};

// Start checking for captcha readiness
checkCaptchaReady();

async function verifyCaptchaOrFail(widgetId) {
  console.log("Verifying captcha, widgetId:", widgetId);
  
  if (widgetId === null || widgetId === undefined) {
    console.log("Widget ID is null/undefined");
    showMessage("error", "Captcha not ready. Please wait and try again.");
    return { ok: false };
  }
  
  if (!window.grecaptcha) {
    console.log("grecaptcha not available");
    showMessage("error", "reCAPTCHA not loaded. Please refresh the page.");
    return { ok: false };
  }
  
  const token = window.grecaptcha.getResponse(widgetId);
  console.log("Captcha token:", token ? "present" : "missing");
  
  if (!token) {
    showMessage("error", "Please complete the captcha.");
    return { ok: false };
  }
  
  try {
    const res = await fetch("/api/captcha/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const json = await res.json();
    if (json && json.success) {
      return { ok: true };
    }
    showMessage("error", "Captcha verification failed. Please try again.");
    return { ok: false };
  } catch (_err) {
    showMessage("error", "Captcha verification error. Please try again.");
    return { ok: false };
  } finally {
    if (window.grecaptcha) {
      try { window.grecaptcha.reset(widgetId); } catch (_e) {}
    }
  }
}

// Validate signup code and get role/department info
const validateSignupCode = async (code) => {
  try {
    const response = await fetch(`/api/hr/validate-signup-code/${code}`);
    const result = await response.json();
    
    if (result && result.valid) {
      return {
        valid: true,
        role: result.data?.role,
        department: result.data?.department_code
      };
    } else {
      showMessage('error', result.error || 'Invalid signup code');
      return { valid: false };
    }
  } catch (error) {
    console.error('Code validation error:', error);
    showMessage('error', 'Failed to validate signup code');
    return { valid: false };
  }
};

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
      const nameInput = document.getElementById("name");
      if (nameInput && name) {
        nameInput.value = name.trim();
      }
      
      // Prefill email (read-only)
      const emailInput = document.getElementById("email");
      if (emailInput && user.email) {
        emailInput.value = user.email;
      }
      
      // Try to get phone from OAuth provider
      const oauthPhone = user.user_metadata?.phone_number || 
                        user.user_metadata?.phone || 
                        user.user_metadata?.mobile ||
                        null;
      
      const mobileInput = document.getElementById("mobile");
      if (mobileInput) {
        if (oauthPhone) {
          // Extract digits only
          let digits = oauthPhone.replace(/\D/g, '');
          
          // Handle Philippines mobile format
          if (digits.startsWith('63') && digits.length >= 12) {
            digits = digits.substring(2, 12);
          } else if (digits.length === 10) {
            // Already 10 digits, use as is
          } else if (digits.length > 10) {
            digits = digits.substring(digits.length - 10);
          }
          
          mobileInput.value = digits;
          mobileInput.readOnly = true;
          mobileInput.style.background = '#f5f5f5';
          mobileInput.style.cursor = 'not-allowed';
        } else {
          // No phone from OAuth - keep field editable
          mobileInput.readOnly = false;
          mobileInput.style.background = '';
          mobileInput.style.cursor = '';
          mobileInput.required = true;
        }
      }
    }
  } catch (error) {
    console.error("Error prefilling OAuth data:", error);
  }
};

// Prefill signup code and role/department info
const prefillSignupInfo = async () => {
  if (!signupCode) {
    showMessage('error', 'No signup code provided');
    return;
  }

  // Prefill signup code
  const codeInput = document.getElementById('signupCode');
  if (codeInput) {
    codeInput.value = signupCode;
  }

  // Validate code and get role/department
  const validation = await validateSignupCode(signupCode);
  if (validation.valid) {
    const roleInput = document.getElementById('role');
    const departmentInput = document.getElementById('department');
    
    if (roleInput) {
      roleInput.value = validation.role;
    }
    if (departmentInput) {
      departmentInput.value = validation.department;
    }
  }
};

// Handle form submission
const positionSignupForm = document.getElementById("positionSignupForm");
if (positionSignupForm) {
  positionSignupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const mobile = document.getElementById("mobile").value.trim();
    const code = document.getElementById("signupCode").value.trim();

    if (!name) {
      showMessage("error", "Name is required");
      return;
    }

    if (!email) {
      showMessage("error", "Email is required");
      return;
    }

    if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
      showMessage("error", "Please enter a valid 10-digit mobile number");
      return;
    }

    if (!code) {
      showMessage("error", "Signup code is required");
      return;
    }

    // Show loading state
    const submitButton = e.target.querySelector('button[type="submit"]');
    const buttonText = submitButton.querySelector('.button-text');
    const buttonLoading = submitButton.querySelector('.button-loading');
    
    buttonText.style.display = 'none';
    buttonLoading.style.display = 'flex';
    submitButton.disabled = true;

    // Verify captcha (skip if not available)
    if (positionSignupCaptchaWidgetId !== null) {
      const captchaResult = await verifyCaptchaOrFail(positionSignupCaptchaWidgetId);
      if (!captchaResult.ok) {
        // Reset button state
        buttonText.style.display = 'block';
        buttonLoading.style.display = 'none';
        submitButton.disabled = false;
        return;
      }
    } else {
      console.log("Captcha not available, skipping verification");
    }

    // Complete OAuth registration with HR signup code
    try {
      const response = await fetch('/api/auth/complete-oauth-hr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          mobile,
          signupCode: code
        })
      });

      const result = await response.json();

      if (!result.success) {
        showMessage("error", result.error || "Failed to complete registration");
        return;
      }

      showMessage("success", "Registration completed successfully! Redirecting to dashboard...");
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 2000);
    } catch (err) {
      console.error('HR OAuth completion error:', err);
      showMessage("error", "Registration failed. Please try again.");
    } finally {
      // Reset button state
      buttonText.style.display = 'block';
      buttonLoading.style.display = 'none';
      submitButton.disabled = false;
    }
  });
}

// Terms and Privacy handlers
document.getElementById("toc")?.addEventListener("click", () => {
  document.getElementById("terms").innerHTML = `<h3>Terms and Conditions</h3><p>Your terms content here...</p>`;
});

document.getElementById("pc")?.addEventListener("click", () => {
  document.getElementById("privacy").innerHTML = `<h3>Privacy Policy</h3><p>Your privacy policy content here...</p>`;
});

// Prefill data on page load
prefillOAuthData();
prefillSignupInfo();
