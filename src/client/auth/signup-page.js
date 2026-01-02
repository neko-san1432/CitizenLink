// Signup page specific functionality
import { supabase } from "../config/config.js";
import showMessage from "../components/toast.js";
import { renderPrivacyNotice } from "../utils/privacyContent.js";
import {
  getOAuthContext,
  setOAuthContext,
  clearOAuthContext,
} from "../auth/authChecker.js";

// Check if user is already logged in and redirect to dashboard
const shouldDeferAuthRedirect = () => {
  try {
    const ctx = getOAuthContext();
    return ctx?.intent === "signup" && ctx?.status === "pending";
  } catch {
    return false;
  }
};

const getOauthCleanupFlag = () => {
  try {
    const flag = sessionStorage.getItem("cl_oauth_cleanup") === "true";
    if (flag) {
      sessionStorage.removeItem("cl_oauth_cleanup");
    }
    return flag;
  } catch {
    return false;
  }
};

const shouldSkipRedirectForPendingOauth = () => {
  const oauthCtx = getOAuthContext();
  if (oauthCtx?.status === "pending") {
    const urlParams = new URLSearchParams(globalThis.location.search);
    const isOAuthRedirect =
      urlParams.get("code") ||
      urlParams.get("error") ||
      urlParams.get("popup") === "1";
    // If user explicitly navigated (not from OAuth redirect), don't redirect
    return !isOAuthRedirect;
  }
  return false;
};

const handleAuthenticatedSession = async (session) => {
  const { user } = session;
  const role = user?.user_metadata?.role || "";
  const name = user?.user_metadata?.name || "";

  // Check if user has completed registration
  if (role && name) {
    if (shouldDeferAuthRedirect()) return;
    globalThis.location.href = "/dashboard";
  } else {
    // User has incomplete registration - redirect to continuation
    if (shouldDeferAuthRedirect()) {
      const urlParams = new URLSearchParams(globalThis.location.search);
      const isOAuthRedirect =
        urlParams.get("code") ||
        urlParams.get("error") ||
        urlParams.get("popup") === "1";
      // If not from OAuth redirect, don't redirect to continuation
      if (!isOAuthRedirect) {
        return;
      }
    }
    globalThis.location.href = "/oauth-continuation";
  }
};

const checkAuthentication = async () => {
  try {
    if (getOauthCleanupFlag()) return;
    if (shouldSkipRedirectForPendingOauth()) return;

    // Get current session
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (session && !error) {
      await handleAuthenticatedSession(session);
    }
  } catch (error) {
    console.error("💥 Authentication check failed:", error);
  }
};

let resetSignupStateHandler = null;
let oauthAbortWatcherInstalled = false;

// Initialize signup page
const initializeSignupPage = async () => {
  // CRITICAL: Run Global OAuth Guard FIRST to wipe stale state
  const { initGlobalOAuthGuard } = await import(
    "../utils/global-oauth-guard.js"
  );
  await initGlobalOAuthGuard();

  // Setup navigation cleanup for login/signup buttons and brand logo
  const { setupNavigationCleanup } = await import("../utils/navigation.js");
  setupNavigationCleanup();

  // Run authentication check when page loads
  checkAuthentication();

  // Wire password strength meter
  attachPasswordStrengthMeter();

  // Listen for auth state changes to update UI dynamically
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session) {
      checkAuthentication();
    }
  });

  // Terms & Privacy Modals
  document.addEventListener("termsAccepted", () => {
    const termsCheckbox = document.getElementById("terms-checkbox");
    if (termsCheckbox) termsCheckbox.checked = true;
  });
  document.addEventListener("privacyAccepted", () => {
    const termsCheckbox = document.getElementById("terms-checkbox");
    if (termsCheckbox) termsCheckbox.checked = true;
  });
  renderPrivacyNotice("#privacyModalContent", { headingTag: "h4" });

  setupSignupMethodSelector();
  setupOAuthPopupBridge();
  setupOAuthAbortWatcher();
};

// --- Live password strength meter wiring ---
function attachPasswordStrengthMeter() {
  try {
    const passwordInput = document.getElementById("regPassword");
    const strengthFill = document.getElementById("strength-fill");
    const strengthText = document.getElementById("strength-text");

    if (!passwordInput || !strengthFill || !strengthText) return;

    const calcScore = (pwd) => {
      let score = 0;
      if (!pwd) return 0;
      if (pwd.length >= 8) score++;
      if (pwd.length >= 12) score++;
      if (/[a-z]/.test(pwd)) score++;
      if (/[A-Z]/.test(pwd)) score++;
      if (/\d/.test(pwd)) score++;
      if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) score++;
      // penalties
      if (/(.)\1{2,}/.test(pwd)) score -= 1;
      if (/123456|abcdef|qwerty|asdfgh|zxcvbn/i.test(pwd)) score -= 2;
      return Math.max(0, Math.min(4, score));
    };

    const labelFor = (score) => {
      switch (score) {
        case 0:
        case 1:
          return "Weak";
        case 2:
          return "Fair";
        case 3:
          return "Good";
        default:
          return "Strong";
      }
    };

    const classFor = (score) => {
      if (score <= 1) return "weak";
      if (score === 2) return "fair";
      if (score === 3) return "good";
      return "strong";
    };

    const update = () => {
      const pwd = passwordInput.value || "";
      if (pwd.length < 8) {
        strengthFill.classList.remove("weak", "fair", "good", "strong");
        strengthText.classList.remove("weak", "fair", "good", "strong");
        strengthFill.style.width = "0%";
        strengthText.textContent = "Password strength";
        return;
      }
      const score = calcScore(pwd);
      const cls = classFor(score);
      strengthFill.classList.remove("weak", "fair", "good", "strong");
      strengthText.classList.remove("weak", "fair", "good", "strong");
      strengthFill.style.width = "0%";
      strengthFill.classList.add(cls);
      strengthText.classList.add(cls);
      const widthMap = {
        weak: "25%",
        fair: "50%",
        good: "75%",
        strong: "100%",
      };
      strengthFill.style.width = widthMap[cls];
      strengthText.textContent = `Password strength: ${labelFor(score)}`;
    };

    passwordInput.addEventListener("input", update);
    update();
  } catch (err) {
    console.debug("Password strength meter error:", err);
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeSignupPage);
} else {
  initializeSignupPage();
}

// --- Signup method selector ---
const METHOD_STORAGE_KEY = "cl_signup_method";

function setupSignupMethodSelector() {
  const regForm = document.getElementById("regForm");
  const emailFlow = document.getElementById("signup-email-flow");
  const placeholder = document.getElementById("signup-flow-placeholder");
  const methodSection = document.getElementById("signup-method-section");
  const methodBackBtn = document.getElementById("signup-method-back");
  const buttons = document.querySelectorAll("[data-signup-method]");

  if (!regForm || !emailFlow) return;

  const selectMethod = (method, { persist = false } = {}) => {
    regForm.dataset.method = method;
    buttons.forEach((btn) => {
      const isActive = btn.dataset.signupMethod === method;
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
    if (method === "email") {
      methodSection?.setAttribute("hidden", "");
      methodBackBtn?.removeAttribute("hidden");
      emailFlow.hidden = false;
      placeholder?.setAttribute("hidden", "");
    } else {
      methodSection?.removeAttribute("hidden");
      methodBackBtn?.setAttribute("hidden", "");
      emailFlow.hidden = true;
      if (method === "none") {
        placeholder?.removeAttribute("hidden");
      } else {
        placeholder?.setAttribute("hidden", "");
      }
    }
    if (persist) {
      try {
        if (method === "email") {
          localStorage.setItem(METHOD_STORAGE_KEY, "email");
        } else {
          localStorage.removeItem(METHOD_STORAGE_KEY);
        }
      } catch {
        // Ignore storage errors
      }
    }
  };

  const resetSignupState = ({ persist = true } = {}) => {
    if (regForm) {
      regForm.reset();
      regForm.dataset.method = "none";
    }
    selectMethod("none", { persist });
    clearOAuthContext();
    try {
      localStorage.removeItem("cl_signup_step_index");
    } catch {
      // Ignore storage errors
    }
    document.dispatchEvent(new Event("signup-reset"));
  };
  resetSignupStateHandler = resetSignupState;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const method = btn.dataset.signupMethod || "email";
      selectMethod(method, { persist: true });
    });
  });

  // Restore last method
  let cachedMethod = null;
  try {
    cachedMethod = localStorage.getItem(METHOD_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
  if (cachedMethod === "email") {
    selectMethod("email");
  } else {
    selectMethod("none");
  }

  methodBackBtn?.addEventListener("click", () => {
    resetSignupState({ persist: true });
    const methodTop = methodSection?.offsetTop || 0;
    globalThis.scrollTo({ top: methodTop - 40, behavior: "smooth" });
  });
}

const syncSupabaseSession = async (accessToken, refreshToken) => {
  if (!accessToken || !refreshToken) return false;
  try {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) {
      console.error("[SIGNUP] ❌ Error setting session:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[SIGNUP] ❌ Session sync error:", err);
    return false;
  }
};

const handleOAuthPopupMessage = async (event) => {
  if (event.origin !== globalThis.location.origin) return;

  const { type, payload, redirectTo, accessToken, refreshToken } =
    event.data || {};

  if (type === "oauth-signup-success") {
    const provider = (payload?.provider || "OAuth").replace(/^\w/, (c) =>
      c.toUpperCase()
    );
    try {
      const ctx = getOAuthContext() || {};
      setOAuthContext({ ...ctx, status: "handoff" });
    } catch (e) {
      console.error("[SIGNUP] Error updating OAuth context:", e);
    }

    await syncSupabaseSession(accessToken, refreshToken);

    // Set server-side cookie
    if (accessToken) {
      try {
        await fetch("/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: accessToken }),
        });
      } catch (cookieError) {
        console.warn("[SIGNUP] ⚠️ Error setting server cookie:", cookieError);
      }
    }

    showMessage("success", `${provider} connected. Finishing setup...`);

    const actualRedirectTo = redirectTo || "/oauth-continuation";
    let redirectUrl = actualRedirectTo;
    if (accessToken && refreshToken) {
      const hashParams = new URLSearchParams();
      hashParams.set("access_token", accessToken);
      hashParams.set("refresh_token", refreshToken);
      hashParams.set("type", "recovery");
      redirectUrl = `${actualRedirectTo}#${hashParams.toString()}`;
    }

    setTimeout(async () => {
      const {
        data: { session: finalCheck },
      } = await supabase.auth.getSession();
      if (finalCheck) {
        globalThis.location.href = redirectUrl;
      } else {
        globalThis.location.href = redirectUrl;
      }
    }, 800);
  } else if (type === "oauth-user-exists") {
    cleanupPendingOAuth("User already exist");
  } else if (type === "oauth-signup-error" && payload?.message) {
    cleanupPendingOAuth(payload.message);
  }
};

function setupOAuthPopupBridge() {
  globalThis.addEventListener("message", handleOAuthPopupMessage);
}

const OAUTH_STALE_TIMEOUT_MS = 3000;

async function cleanupPendingOAuth(
  message = "OAuth signup was cancelled. Please try again."
) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    if (userId && session?.access_token) {
      try {
        const token = session.access_token;
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
        await fetch("/api/compliance/delete", {
          method: "DELETE",
          headers,
          credentials: "include",
          body: JSON.stringify({
            userId,
            confirm: true,
            reason: "Incomplete OAuth signup cancelled by user",
          }),
        });
      } catch (deleteError) {
        console.debug("Failed to delete incomplete user:", deleteError);
      }
    }
    await supabase.auth.signOut();
  } catch (err) {
    console.debug("OAuth cleanup error:", err);
  }

  try {
    await fetch("/auth/session", { method: "DELETE" });
  } catch (err) {
    console.debug("Session cleanup error:", err);
  }
  clearOAuthContext();
  resetSignupStateHandler?.({ persist: true });
  if (message) {
    showMessage("error", message);
  }
}

function setupOAuthAbortWatcher() {
  if (oauthAbortWatcherInstalled) return;
  oauthAbortWatcherInstalled = true;

  const checkPendingOAuth = async () => {
    try {
      const ctx = getOAuthContext();
      if (ctx?.intent === "signup" && ctx?.status === "pending") {
        const startedAt = Number(ctx?.startedAt) || 0;
        const elapsed = Date.now() - startedAt;
        if (elapsed > OAUTH_STALE_TIMEOUT_MS) {
          await cleanupPendingOAuth(
            "OAuth signup did not finish. Please try again."
          );
        }
      }
    } catch (error) {
      console.warn("[SIGNUP] OAuth abort watcher error:", error);
    }
  };

  const handlePageAbandonment = async () => {
    const ctx = getOAuthContext();
    if (ctx?.intent === "signup" && ctx?.status === "pending") {
      await cleanupPendingOAuth(null);
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      checkPendingOAuth();
    } else if (document.visibilityState === "hidden") {
      const ctx = getOAuthContext();
      if (ctx?.intent === "signup" && ctx?.status === "pending") {
        setOAuthContext({ ...ctx, lastActivity: Date.now() });
      }
    }
  };

  globalThis.addEventListener("focus", checkPendingOAuth, true);
  globalThis.addEventListener("beforeunload", handlePageAbandonment);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  globalThis.addEventListener("pagehide", handlePageAbandonment);
}
