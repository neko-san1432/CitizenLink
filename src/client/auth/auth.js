// login, register, change pass, and additional social media
import { supabase } from "../config/config.js";
import showMessage from "../components/toast.js";
import {
  saveUserMeta,
  getOAuthContext,
  setOAuthContext,
} from "./authChecker.js";
import { setButtonLoading, temporarilyMark } from "../utils/buttonState.js";
import { addCsrfTokenToForm } from "../utils/csrf.js";
import {
  validateAndSanitizeForm,
  isValidPhilippineMobile,
  validatePassword,
  isValidEmail,
} from "../utils/validation.js";

// Show toast on login page if redirected due to missing auth
try {
  const isLoginPage = /\/login(?:$|\?)/.test(
    window.location.pathname + window.location.search
  );
  if (isLoginPage) {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("err");
    if (err === "not_authenticated") {
      showMessage("error", "Please log in to continue");
    }
  }
} catch {}

export const retrieveUserRole = async () => {};

// reCAPTCHA setup
let loginCaptchaWidgetId = null;
let registerCaptchaWidgetId = null;
let siteKey = "";
// Fetch CAPTCHA key securely from server
async function getCaptchaKey() {
  try {
    const response = await fetch("/api/captcha/key");
    const data = await response.json();
    return data.key || "";
  } catch (error) {
    console.error("Failed to fetch CAPTCHA key:", error);
    return "";
  }
}
async function renderCaptchaWidgetsIfAny() {
  // Skip reCAPTCHA in development mode
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
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
    const loginEl = document.getElementById("login-captcha");
    if (loginEl && loginCaptchaWidgetId === null) {
      loginCaptchaWidgetId = window.grecaptcha.render(loginEl, {
        sitekey: siteKey,
      });
    }
    const regEl = document.getElementById("register-captcha");
    if (regEl && registerCaptchaWidgetId === null) {
      registerCaptchaWidgetId = window.grecaptcha.render(regEl, {
        sitekey: siteKey,
      });
    }
  });
}
// Try render on load and after a short delay to cover async script load
renderCaptchaWidgetsIfAny();
setTimeout(renderCaptchaWidgetsIfAny, 500);
async function verifyCaptchaOrFail(widgetId) {
  // Skip reCAPTCHA verification in development mode
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    // console.log removed for security
    return { ok: true };
  }
  if (!widgetId && widgetId !== 0) {
    showMessage("error", "Captcha not ready. Please wait and try again.");
    return { ok: false };
  }
  const token = window.grecaptcha
    ? window.grecaptcha.getResponse(widgetId)
    : "";
  if (!token) {
    showMessage("error", "Please complete the captcha.");
    return { ok: false };
  }
  try {
    const res = await fetch("/api/captcha/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
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
      try {
        window.grecaptcha.reset(widgetId);
      } catch (_e) {}
    }
  }
}
const regFormEl = document.getElementById("regForm");

// Form persistence logic for registration
const REG_FORM_STORAGE_KEY = "cl_reg_form_data";

function saveRegFormData() {
  if (!regFormEl) return;

  const formData = new FormData(regFormEl);
  const dataToSave = {};

  for (const [key, value] of formData.entries()) {
    // Don't save sensitive fields
    if (key !== "regPassword" && key !== "reRegPassword") {
      dataToSave[key] = value;
    }
  }

  try {
    sessionStorage.setItem(REG_FORM_STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (e) {
    console.warn("Failed to save registration form data:", e);
  }
}

function loadRegFormData() {
  if (!regFormEl) return;

  try {
    const savedData = sessionStorage.getItem(REG_FORM_STORAGE_KEY);
    if (!savedData) return;

    const parsedData = JSON.parse(savedData);

    Object.keys(parsedData).forEach((key) => {
      const input = regFormEl.querySelector(`[name="${key}"]`);
      if (input && input.type !== "file") {
        // Skip file inputs
        input.value = parsedData[key];
        // Trigger input event to ensure UI updates (like floating labels)
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  } catch (e) {
    console.warn("Failed to load registration form data:", e);
  }
}

function clearRegFormData() {
  try {
    sessionStorage.removeItem(REG_FORM_STORAGE_KEY);
    sessionStorage.removeItem("cl_signup_step_index"); // Clear step index too
  } catch (e) {
    console.warn("Failed to clear registration form data:", e);
  }
}

// Initialize persistence if form exists
if (regFormEl) {
  // Load saved data on init
  loadRegFormData();

  // Save data on input changes
  regFormEl.addEventListener("input", (e) => {
    // Debounce saving if needed, but for now direct save is fine for simple text
    if (e.target.name !== "regPassword" && e.target.name !== "reRegPassword") {
      saveRegFormData();
    }
  });

  regFormEl.addEventListener("submit", async (e) => {
    e.preventDefault(); // prevent page refresh
    regFormEl.classList.add("was-validated");
    const firstName = document.getElementById("firstName")?.value.trim() || "";
    const middleName =
      document.getElementById("middleName")?.value.trim() || "";
    const lastName = document.getElementById("lastName")?.value.trim() || "";
    const email = document.getElementById("email").value.trim();
    const mobile = document.getElementById("mobile").value.trim();
    const addressLine1 =
      document.getElementById("addressLine1")?.value.trim() || "";
    const addressLine2 =
      document.getElementById("addressLine2")?.value.trim() || "";
    const barangay = document.getElementById("barangay")?.value.trim() || "";
    const gender = document.getElementById("gender")?.value || "";
    const regPass = document.getElementById("regPassword").value;
    const reRegPass = document.getElementById("reRegPassword").value;
    // Early password length checks
    if (!regPass || regPass.length < 8) {
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
      regPassword: { required: true, type: "password" },
      addressLine1: { required: false, minLength: 0, maxLength: 255 },
      addressLine2: { required: false, minLength: 0, maxLength: 255 },
      barangay: { required: false, minLength: 0, maxLength: 100 },
      gender: { required: false },
    };
    const formData = {
      firstName,
      middleName,
      lastName,
      email,
      mobile,
      regPassword: regPass,
      addressLine1,
      addressLine2,
      barangay,
      gender,
    };
    const validation = validateAndSanitizeForm(formData, validationRules);
    if (!validation.isValid) {
      showMessage("error", validation.errors.join(", "));
      return;
    }
    // Additional password confirmation check
    if (reRegPass !== regPass) {
      showMessage("error", "Passwords don't match");
      return;
    }

    // verify captcha
    const captchaResult = await verifyCaptchaOrFail(registerCaptchaWidgetId);
    if (!captchaResult.ok) return;

    try {
      const submitBtn = regFormEl.querySelector(
        'button[type="submit"], .btn-primary, .btn'
      );
      const resetBtn = setButtonLoading(submitBtn, "Creating account...");
      // Build JSON payload (role defaults to 'citizen' on backend)
      const payload = {
        email: validation.sanitizedData.email,
        password: regPass,
        confirmPassword: reRegPass,
        firstName: validation.sanitizedData.firstName,
        middleName: validation.sanitizedData.middleName || "",
        lastName: validation.sanitizedData.lastName,
        mobileNumber: `+63${validation.sanitizedData.mobile}`,
        gender: validation.sanitizedData.gender || "",
        address: {
          line1: validation.sanitizedData.addressLine1 || "",
          line2: validation.sanitizedData.addressLine2 || "",
          barangay: validation.sanitizedData.barangay || "",
        },
        // role: 'citizen', // backend defaults to citizen
        agreedToTerms: true,
        isOAuth: false, // Regular signup
        verificationToken: sessionStorage.getItem("cl_verification_token"), // Send proof of ID verification
      };
      // Submit via API instead of direct Supabase call
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      // Be tolerant of API variations: treat 2xx with clear success message as success
      const successMessage =
        result && result.message ? String(result.message) : "";
      const isHttpSuccess = response.ok; // includes 201
      const isApiSuccess = result && result.success === true;
      const looksLikeSuccess =
        /account created|verify your email|verification email/i.test(
          successMessage
        );
      if (isHttpSuccess && (isApiSuccess || looksLikeSuccess)) {
        // SECURITY: Tokens are no longer in response, Supabase session is managed server-side
        // Server sets HttpOnly cookie, client relies on that for authentication
        // No need to manually set session here as server handles it
        showMessage(
          "success",
          "Successfully registered. Please confirm via the email we sent."
        );
        clearRegFormData(); // Clear saved form data
        temporarilyMark(submitBtn, "Success", "btn-success");
        resetBtn();
        setTimeout(() => {
          window.location.href = "/login";
        }, 3000);
      } else {
        const errMsg = (
          result && result.error ? String(result.error) : ""
        ).toLowerCase();
        if (
          errMsg.includes("already registered") ||
          errMsg.includes("already exists") ||
          errMsg.includes("duplicate") ||
          errMsg.includes("email is used") ||
          errMsg.includes("email taken") ||
          errMsg.includes("email already exist")
        ) {
          showMessage("error", "Email already exist");
        } else {
          showMessage(
            "error",
            result.error || successMessage || "Registration failed"
          );
        }
        temporarilyMark(submitBtn, "Failed", "btn-danger");
        resetBtn();
      }
    } catch (error) {
      console.error("Registration error:", error);
      showMessage("error", "Registration failed. Please try again.");
      try {
        const submitBtn = regFormEl.querySelector(
          'button[type="submit"], .btn-primary, .btn'
        );
        temporarilyMark(submitBtn, "Failed", "btn-danger");
      } catch {}
      try {
        const submitBtn = regFormEl.querySelector(
          'button[type="submit"], .btn-primary, .btn'
        );
      } catch {}
    }
  });
}
const loginFormEl = document.getElementById("login");
if (loginFormEl)
  loginFormEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginFormEl.classList.add("was-validated");
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;
    const remember = document.getElementById("remember-me")?.checked || false;

    // Store device trust preference
    try {
      const { setDeviceTrusted } = await import("./authChecker.js");
      setDeviceTrusted(remember);
    } catch (error) {
      console.error("[AUTH] Failed to set device trust preference:", error);
    }
    // Get login button elements
    const loginBtn = document.getElementById("login-submit-btn");
    const loginBtnIcon = document.getElementById("login-btn-icon");
    const loginBtnText = document.getElementById("login-btn-text");
    // Function to show loading state
    const showLoading = () => {
      if (!loginBtn || !loginBtnIcon) return;

      // Store original icon HTML only if not already stored
      // This prevents overwriting with the spinner if called multiple times
      if (!loginBtn.dataset.originalIcon) {
        const originalIcon = loginBtnIcon.outerHTML;
        loginBtn.dataset.originalIcon = originalIcon;
      }

      // Replace icon with loading spinner (CSS animation will handle rotation)
      loginBtnIcon.innerHTML = `
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/>
      <path d="M12 2 A10 10 0 0 1 22 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-dasharray="15 10"/>
    `;
      loginBtnIcon.classList.add("spinning");
      // Disable button
      loginBtn.disabled = true;
      loginBtnText.textContent = "Signing in...";
    };

    // Function to hide loading state
    const hideLoading = () => {
      if (!loginBtn) return;

      // Get current icon element (might have been replaced)
      const currentIcon = document.getElementById("login-btn-icon");
      if (currentIcon && loginBtn.dataset.originalIcon) {
        // Restore original icon
        const originalIconHtml = loginBtn.dataset.originalIcon;
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = originalIconHtml;
        const restoredIcon = tempDiv.firstElementChild;
        if (restoredIcon) {
          currentIcon.parentNode.replaceChild(restoredIcon, currentIcon);
        }
        // Clear the stored icon so we can capture it fresh next time if needed
        // (though keeping it is also fine, clearing is safer for state resets)
        delete loginBtn.dataset.originalIcon;
      }

      // Remove spinning class if it exists
      if (currentIcon) {
        currentIcon.classList.remove("spinning");
      }

      // Re-enable button
      loginBtn.disabled = false;
      if (loginBtnText) {
        loginBtnText.textContent = "Sign in";
      }
    };

    // Basic validation
    if (!email || !pass) {
      showMessage("error", "Email and password are required");
      return;
    }

    if (!isValidEmail(email)) {
      showMessage("error", "Please enter a valid email address");
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
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass, remember }),
      });

      const result = await response.json();

      if (result.success) {
        // SECURITY: Server handles all authentication and sets HttpOnly cookie
        // Client syncs Supabase session state using refresh token from server response
        try {
          // Server already authenticated and set cookie, now sync client-side Supabase session
          const refreshToken = result.data?.refresh_token;

          if (refreshToken) {
            // Use refresh token to get full Supabase session without re-authenticating
            // Wrap in timeout to prevent hanging
            const syncPromise = supabase.auth.refreshSession({
              refresh_token: refreshToken,
            });

            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Session sync timeout")), 3000)
            );

            const { data: sessionData, error: refreshError } =
              await Promise.race([syncPromise, timeoutPromise]).catch(
                (err) => ({ error: err })
              );

            if (refreshError || !sessionData?.session) {
              console.warn(
                "[CLIENT AUTH] ⚠️ Failed to sync Supabase session:",
                refreshError?.message || "Unknown error"
              );
              // Server cookie is still valid, continue with server-side auth only
            }
          } else {
            console.warn(
              "[CLIENT AUTH] ⚠️ No refresh token in response, client-side Supabase features may be limited"
            );
          }

          // Verify session by hitting a protected endpoint
          // Also wrapped in timeout/race to prevent blocking
          const verifyPromise = async () => {
            await new Promise((r) => setTimeout(r, 100)); // Brief wait for cookie
            const resp = await fetch("/api/user/role", {
              method: "GET",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
            });
            if (!resp.ok) throw new Error("Role check failed");
            return resp;
          };

          await Promise.race([
            verifyPromise(),
            new Promise((r) => setTimeout(r, 2000)), // 2s max wait for verification
          ]).catch((err) =>
            console.warn(
              "[CLIENT AUTH] ⚠️ Session verification skipped:",
              err.message
            )
          );
        } catch (error) {
          console.error("[CLIENT AUTH] Error in session sync:", error);
          // Don't fail login if session sync fails - server cookie is still valid
        }

        showMessage("success", "Logged in successfully");

        // SECURITY: Use user data from server response (server is source of truth)
        const serverUser = result.data?.user;
        let role = serverUser?.role || serverUser?.normalizedRole || null;
        let name = serverUser?.name || serverUser?.fullName || null;

        // If server data is incomplete, try to get from Supabase session
        if (!role || !name) {
          try {
            const {
              data: { session: clientSession },
            } = await supabase.auth.getSession();
            if (clientSession?.user) {
              const userMetadata = clientSession.user.user_metadata || {};
              const rawUserMetaData =
                clientSession.user.raw_user_meta_data || {};
              const combinedMetadata = { ...userMetadata, ...rawUserMetaData };
              role =
                role ||
                combinedMetadata.role ||
                combinedMetadata.normalized_role ||
                null;
              name = name || combinedMetadata.name || null;
            }
          } catch (e) {
            console.warn("Failed to fetch client session metadata:", e);
          }
        }

        // Save user metadata for client-side use
        if (role || name) {
          saveUserMeta({ role, name });
        }

        // Check if user has completed registration
        if (!role || !name) {
          showMessage("error", "Please complete your profile first");
          hideLoading(); // Ensure button is reset
          setTimeout(() => {
            window.location.href = "/OAuthContinuation";
          }, 2000);
          return;
        }

        // Redirect to dashboard based on role
        try {
          hideLoading();
        } catch (e) {}

        setTimeout(() => {
          try {
            window.location.href = "/dashboard";
          } catch (e) {
            /* ignore */
          }
        }, 1500);

        // Safety fallback: if navigation hasn't started after 7s, clear loading state
        setTimeout(() => {
          try {
            const stillOnLogin =
              window.location.pathname &&
              window.location.pathname.toLowerCase().includes("/login");
            if (stillOnLogin) {
              try {
                hideLoading();
              } catch (e) {}
              showMessage(
                "info",
                "Login appears to be taking longer than usual. If you are not redirected, please refresh the page."
              );
            }
          } catch (_) {}
        }, 7000);
      } else {
        // Login failed - hide loading state
        hideLoading();
        showMessage("error", result.error || "Login failed");

        // If OAuth context suggests provider was intended but failed, route to signup
        const ctx = getOAuthContext();
        if (ctx && ctx.provider) {
          window.location.href = "/signup";
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      // Hide loading state on error
      hideLoading();
      showMessage("error", "Login failed. Please try again.");
    }
  });
// OAuth sign-in buttons (popup-based)
const oauthButtons = [
  { id: "login-google", provider: "google" },
  { id: "login-facebook", provider: "facebook" },
];

oauthButtons.forEach(({ id, provider }) => {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener("click", () => startOAuthPopup(provider));
});

async function startOAuthPopup(provider) {
  const scopes =
    provider === "google"
      ? "email profile https://www.googleapis.com/auth/user.phonenumbers.read"
      : "email public_profile";
  try {
    // Determine intent based on current page
    const isSignupPage = window.location.pathname.includes("/signup");
    const intent = isSignupPage ? "signup" : "login";

    // Set OAuth context to track the flow
    setOAuthContext({
      provider,
      intent,
      status: "pending",
      startedAt: Date.now(),
    });

    console.log("[OAUTH] Starting OAuth flow:", { provider, intent });

    // Direct redirect (no popup) - simpler and more reliable
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/oauth-callback`,
        scopes,
      },
    });

    if (error) {
      throw error;
    }

    // If URL is returned, redirect to it
    if (data?.url) {
      window.location.href = data.url;
    }
  } catch (error) {
    console.error(`[OAUTH] ${provider} OAuth error:`, error);
    showMessage("error", error.message || `${provider} sign-in failed`);
    // Clear OAuth context on error
    try {
      clearOAuthContext();
    } catch {}
  }
}
