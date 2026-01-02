import { supabase } from "../config/config.js";
import showMessage from "../components/toast.js";
import { validateAndSanitizeForm } from "../utils/validation.js";
import { renderPrivacyNotice } from "../utils/privacyContent.js";
import { getOAuthContext } from "./authChecker.js";

// reCAPTCHA setup - using auto-rendered captcha from HTML
const oauthCompleteCaptchaWidgetId = 0; // Default ID for auto-rendered captchas
// Wait for captcha to be ready
const waitForCaptcha = () => {

  if (window.grecaptcha && window.grecaptcha.getResponse) {
    // console.log removed for security
    return true;
  }
  return false;
};
// Check if captcha is ready, retry if not
const checkCaptchaReady = () => {
  if (waitForCaptcha()) {
    // console.log removed for security
  } else {
    // console.log removed for security
    setTimeout(checkCaptchaReady, 500);
  }
};
// Start checking for captcha readiness
checkCaptchaReady();
async function verifyCaptchaOrFail(widgetId) {
  // console.log removed for security
  if (widgetId === null || widgetId === void 0) {
    // console.log removed for security
    showMessage("error", "Captcha not ready. Please wait and try again.");
    return { ok: false };
  }
  if (!window.grecaptcha) {
    // console.log removed for security
    showMessage("error", "reCAPTCHA not loaded. Please refresh the page.");
    return { ok: false };
  }
  const token = window.grecaptcha.getResponse(widgetId);
  // console.log removed for security
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
// Form persistence logic
const OAUTH_FORM_STORAGE_KEY = "cl_oauth_complete_form_data";

function saveOAuthFormData() {
  const form = document.getElementById("oauthCompleteForm");
  if (!form) return;

  const formData = new FormData(form);
  const dataToSave = {};

  for (const [key, value] of formData.entries()) {
    // Don't save sensitive fields
    if (key !== "regPassword" && key !== "reRegPassword") {
      dataToSave[key] = value;
    }
  }

  try {
    localStorage.setItem(OAUTH_FORM_STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (e) {
    console.warn("Failed to save OAuth form data:", e);
  }
}

function loadOAuthFormData() {
  try {
    const savedData = localStorage.getItem(OAUTH_FORM_STORAGE_KEY);
    if (!savedData) return;

    const parsedData = JSON.parse(savedData);
    const form = document.getElementById("oauthCompleteForm");
    if (!form) return;

    Object.keys(parsedData).forEach(key => {
      const input = form.querySelector(`[name="${key}"]`);
      if (input && input.type !== "file") {
        input.value = parsedData[key];
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  } catch (e) {
    console.warn("Failed to load OAuth form data:", e);
  }
}

function clearOAuthFormData() {
  try {
    localStorage.removeItem(OAUTH_FORM_STORAGE_KEY);
    localStorage.removeItem("cl_signup_step_index"); // Also clear step index
  } catch (e) {
    console.warn("Failed to clear OAuth form data:", e);
  }
}

// Prefill OAuth data from provider
const prefillOAuthData = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (user) {
      const identityData = user.identities?.[0]?.identity_data || {};
      const meta = user.user_metadata || {};
      const rawMeta = user.raw_user_meta_data || {};
      const combined = { ...identityData, ...meta, ...rawMeta };
      const fullName = combined.full_name || combined.name || "";

      // Prioritize explicit fields
      let firstName = combined.given_name || combined.first_name || "";
      let lastName = combined.family_name || combined.last_name || "";
      const middleName = combined.middle_name || "";

      // If explicit fields are missing, try to parse from full name
      if (!firstName && !lastName && fullName) {
        const nameParts = fullName.trim().split(" ");
        if (nameParts.length === 1) {
          firstName = nameParts[0];
        } else if (nameParts.length > 1) {
          // Assume last word is last name, everything else is first name
          // Do NOT infer middle name automatically to avoid splitting multi-word first names
          lastName = nameParts.pop();
          firstName = nameParts.join(" ");
        }
      }

      // Prefill firstName
      const firstNameInput = document.getElementById("firstName");
      if (firstNameInput && firstName && !firstNameInput.value) {
        firstNameInput.value = firstName;
      }

      const middleNameInput = document.getElementById("middleName");
      if (middleNameInput) {
        if (middleName && !middleNameInput.value) {
          middleNameInput.value = middleName;
        } else if (!middleName && !middleNameInput.value) {
          // Enable if empty so user can enter it or leave it blank
          middleNameInput.removeAttribute("readonly");
          middleNameInput.removeAttribute("disabled");
          middleNameInput.removeAttribute("aria-disabled");
          middleNameInput.removeAttribute("title");
        }
      }

      // Prefill lastName
      const lastNameInput = document.getElementById("lastName");
      if (lastNameInput && lastName && !lastNameInput.value) {
        lastNameInput.value = lastName;
      }

      // Prefill email (read-only)
      const emailInput = document.getElementById("email");
      if (emailInput && user.email) {
        emailInput.value = user.email;
      }

      // Try to get phone from OAuth provider (Google, Facebook, etc.)
      const oauthPhone = user.user_metadata?.phone_number ||
                        user.user_metadata?.phone ||
                        user.user_metadata?.mobile ||
                        null;
      const mobileInput = document.getElementById("mobile");
      if (mobileInput && !mobileInput.value) {
        if (oauthPhone) {
          // Extract digits only (handle various formats: +63XXX, +1XXX, etc.)
          let digits = oauthPhone.replace(/\D/g, "");
          // If it starts with country code, try to extract Philippines mobile
          if (digits.startsWith("63") && digits.length >= 12) {
            // Remove country code 63 and keep 10 digits
            digits = digits.substring(2, 12);
          } else if (digits.length === 10) {
            // Already 10 digits, use as is
          } else if (digits.length > 10) {
            // Take last 10 digits
            digits = digits.substring(digits.length - 10);
          }
          mobileInput.value = digits;
        }
        // Mobile is always editable for OAuth continuation
        mobileInput.required = true;
      }
    }
  } catch (error) {
    console.error("Error prefilling OAuth data:", error);
  } finally {
    // Load saved data AFTER prefill to ensure user edits are preserved
    loadOAuthFormData();
  }
};

// Handle form submission
const oauthCompleteForm = document.getElementById("oauthCompleteForm");
if (oauthCompleteForm) {
  // Save on input
  oauthCompleteForm.addEventListener("input", (e) => {
    if (e.target.name !== "regPassword" && e.target.name !== "reRegPassword") {
      saveOAuthFormData();
    }
  });

  oauthCompleteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const firstName = document.getElementById("firstName")?.value.trim() || "";
    const middleName = document.getElementById("middleName")?.value.trim() || "";
    const lastName = document.getElementById("lastName")?.value.trim() || "";
    const email = document.getElementById("email").value.trim();
    const mobile = document.getElementById("mobile").value.trim();
    const addressLine1 = document.getElementById("addressLine1")?.value.trim() || "";
    const gender = document.getElementById("gender")?.value || "";
    const passwordInput = document.getElementById("regPassword");
    const confirmPasswordInput = document.getElementById("reRegPassword");
    const regPass = passwordInput ? passwordInput.value : "";
    const reRegPass = confirmPasswordInput ? confirmPasswordInput.value : "";
    const passwordProvided = Boolean(passwordInput && regPass);

    // Early password length checks (only if password field exists)
    if (passwordProvided && regPass.length < 8) {
      showMessage("error", "Password must be at least 8 characters long");
      return;
    }

    // Validate form data
    const validationRules = {
      firstName: { required: true, minLength: 1, maxLength: 100 },
      middleName: { required: false, minLength: 0, maxLength: 100 },
      lastName: { required: true, minLength: 1, maxLength: 100 },
      email: { required: true, type: "email" },
      mobile: { required: true, type: "mobile" },
      addressLine1: { required: false, minLength: 0, maxLength: 255 },
      gender: { required: false }
    };
    if (passwordProvided) {
      validationRules.regPassword = { required: true, type: "password" };
    }
    const formData = { firstName, middleName, lastName, email, mobile, addressLine1, gender };
    if (passwordProvided) {
      formData.regPassword = regPass;
    }
    const validation = validateAndSanitizeForm(formData, validationRules);
    if (!validation.isValid) {
      showMessage("error", validation.errors.join(", "));
      return;
    }

    // Additional password confirmation check (only if password provided)
    if (passwordProvided && reRegPass !== regPass) {
      showMessage("error", "Passwords don't match");
      return;
    }

    // verify captcha (skip if not available)
    if (oauthCompleteCaptchaWidgetId !== null) {
      const captchaResult = await verifyCaptchaOrFail(oauthCompleteCaptchaWidgetId);
      if (!captchaResult.ok) return;
    } else {
      // console.log removed for security
    }

    // Build JSON payload matching signup structure
    const payload = {
      email: validation.sanitizedData.email,
      firstName: validation.sanitizedData.firstName,
      middleName: validation.sanitizedData.middleName || "",
      lastName: validation.sanitizedData.lastName,
      mobileNumber: `+63${validation.sanitizedData.mobile}`,
      gender: validation.sanitizedData.gender || "",
      address: { line1: validation.sanitizedData.addressLine1 || "" },
      agreedToTerms: true,
      isOAuth: true // OAuth continuation
    };
    if (passwordProvided) {
      payload.password = regPass;
      payload.confirmPassword = reRegPass;
    }

    // Update user metadata and complete profile via backend
    try {
      // Get access token from current session
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const headers = {
        "Content-Type": "application/json"
      };

      // Add Authorization header if we have a token
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
        // Also include in body as fallback
        payload.access_token = accessToken;
      }

      const response = await fetch("/api/auth/complete-oauth", {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!result.success) {
        const errMsg = (result && result.error ? String(result.error) : "").toLowerCase();
        if (errMsg.includes("already registered") || errMsg.includes("already exists") || errMsg.includes("duplicate") || errMsg.includes("email is used") || errMsg.includes("email taken") || errMsg.includes("email already exist")) {
          showMessage("error", "Email already exist");
        } else {
          showMessage("error", result.error || "Failed to complete registration");
        }
        return;
      }
      // Mark OAuth signup as completed to prevent cleanup
      try {
        const { setOAuthContext, clearOAuthContext } = await import("./authChecker.js");
        const ctx = getOAuthContext();
        if (ctx) {
          setOAuthContext({ ...ctx, status: "completed" });
        }
        // Clear context after a short delay to allow redirect
        setTimeout(() => {
          clearOAuthContext();
        }, 1000);
      } catch (error) {
        console.warn("[OAUTH_COMPLETE] Error updating OAuth context:", error);
      }

      showMessage("success", "Profile completed successfully! Redirecting to dashboard...");
      clearOAuthFormData(); // Clear saved form data

      // Clear OAuth context since signup is complete
      try {
        const { clearOAuthContext } = await import("./authChecker.js");
        clearOAuthContext();
      } catch {}

      // Redirect immediately to dashboard
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1000);
    } catch (err) {
      console.error("OAuth completion error:", err);
      showMessage("error", "Registration failed. Please try again.");
    }
  });
}
// Terms and Privacy handlers
document.getElementById("toc").addEventListener("click", (event) => {
  event.preventDefault();
  document.getElementById("terms").innerHTML = "<h3>Terms and Conditions</h3><p>Your terms content here...</p>";
});
// Privacy Notice link now opens in new tab - no modal needed
// Privacy content is available at /privacy-notice
// Prefill data on page load
prefillOAuthData();
