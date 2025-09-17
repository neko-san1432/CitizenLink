import { supabase } from '../db.js';
import showMessage from '../components/toast.js';

// reCAPTCHA setup - using auto-rendered captcha from HTML
let oauthCompleteCaptchaWidgetId = 0; // Default ID for auto-rendered captchas

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
    console.log("Captcha ready, widget ID:", oauthCompleteCaptchaWidgetId);
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
    const res = await fetch("/captcha/verify", {
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

// Prefill OAuth data from provider
const prefillOAuthData = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    
    if (user) {
      // Extract name from various OAuth provider sources
      const name = user.user_metadata?.full_name || 
                   user.user_metadata?.name ||
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
      
      // Prefill mobile if it exists in user metadata
      const mobileInput = document.getElementById("mobile");
      if (mobileInput && user.user_metadata?.mobile) {
        // Extract the 10 digits from +63XXXXXXXXXX format
        const mobile = user.user_metadata.mobile.replace('+63', '');
        mobileInput.value = mobile;
      }
    }
  } catch (error) {
    console.error("Error prefilling OAuth data:", error);
  }
};

// Handle form submission
const oauthCompleteForm = document.getElementById("oauthCompleteForm");
if (oauthCompleteForm) {
  oauthCompleteForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const mobile = document.getElementById("mobile").value.trim();

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

    // verify captcha (skip if not available)
    if (oauthCompleteCaptchaWidgetId !== null) {
      const captchaResult = await verifyCaptchaOrFail(oauthCompleteCaptchaWidgetId);
      if (!captchaResult.ok) return;
    } else {
      console.log("Captcha not available, skipping verification");
    }

    // Update user metadata with mobile number and default role
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          name,
          role: 'citizen', // Default role for OAuth users
          mobile: `+63${mobile}`,
          registration_completed: true,
          registration_date: new Date().toISOString(),
          oauth_completed: true
        }
      });

      if (error) {
        showMessage("error", error.message || "Failed to complete registration");
        return;
      }

      showMessage("success", "Profile completed successfully! Redirecting to dashboard...");
      setTimeout(() => {
        // Redirect directly to dashboard (user is already authenticated)
        window.location.href = "/dashboard";
      }, 2000);
    } catch (err) {
      showMessage("error", "Registration failed. Please try again.");
    }
  });
}

// Terms and Privacy handlers
document.getElementById("toc").addEventListener("click", () => {
  document.getElementById("terms").innerHTML = `<h3>Terms and Conditions</h3><p>Your terms content here...</p>`;
});

document.getElementById("pc").addEventListener("click", () => {
  document.getElementById("privacy").innerHTML = `<h3>Privacy Policy</h3><p>Your privacy policy content here...</p>`;
});

// Prefill data on page load
prefillOAuthData();

