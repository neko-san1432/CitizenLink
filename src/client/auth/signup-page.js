// Signup page specific functionality
import { supabase } from "../config/config.js";
import showMessage from "../components/toast.js";
import { renderPrivacyNotice } from "../utils/privacyContent.js";
import { getOAuthContext, setOAuthContext, clearOAuthContext, suppressAuthErrorNotifications } from "../auth/authChecker.js";
import { shouldSkipAuthCheck } from "../utils/oauth-cleanup.js";

// Check if user is already logged in and redirect to dashboard
const shouldDeferAuthRedirect = () => {
  try {
    const ctx = getOAuthContext();
    return ctx && ctx.intent === "signup" && ctx.status === "pending";
  } catch {
    return false;
  }
};

// Global Guard handles all cleanup now - redundant code removed

const checkAuthentication = async () => {
  try {
    // Global Guard already ran at init
    // await clearOAuthContextOnLanding();

    // Check if we just cleaned up OAuth - skip redirects
    let oauthCleanupFlag = false;
    try {
      oauthCleanupFlag = sessionStorage.getItem("cl_oauth_cleanup") === "true";
      if (oauthCleanupFlag) {
        sessionStorage.removeItem("cl_oauth_cleanup");
      }
    } catch {}

    // If we just cleaned up, don't redirect - let user proceed with signup
    if (oauthCleanupFlag) {
      return;
    }

    // Check for pending OAuth - if exists and user explicitly navigated, don't redirect
    // But allow legitimate OAuth continuation redirects
    const oauthCtx = getOAuthContext();
    const hasPendingOAuth = oauthCtx && oauthCtx.status === "pending";

    // Only skip redirect if user explicitly navigated (not from OAuth redirect)
    if (hasPendingOAuth) {
      const urlParams = new URLSearchParams(window.location.search);
      const isOAuthRedirect = urlParams.get("code") || urlParams.get("error") || urlParams.get("popup") === "1";
      // If user explicitly navigated (not from OAuth), don't redirect
      if (!isOAuthRedirect) {
        return;
      }
    }

    // console.log removed for security
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session && !error) {
      // console.log removed for security
      // Get user metadata
      const {user} = session;
      const role = user?.user_metadata?.role || "";
      const name = user?.user_metadata?.name || "";
      // Check if user has completed registration
      if (role && name) {
        // console.log removed for security
        if (shouldDeferAuthRedirect()) return;
        window.location.href = "/dashboard";
      } else {
        // User has incomplete registration - redirect to continuation
        // This is the normal flow after OAuth signup
        // Only defer if there's a pending OAuth and user explicitly navigated
        if (shouldDeferAuthRedirect()) {
          const urlParams = new URLSearchParams(window.location.search);
          const isOAuthRedirect = urlParams.get("code") || urlParams.get("error") || urlParams.get("popup") === "1";
          // If not from OAuth redirect, don't redirect to continuation
          if (!isOAuthRedirect) {
            return;
          }
        }
        // console.log removed for security
        window.location.href = "/oauth-continuation";
      }
    } else {
      // console.log removed for security
    }
  } catch (error) {
    console.error("💥 Authentication check failed:", error);
    // If there's an error, let the user proceed with signup
  }
};

let resetSignupStateHandler = null;
let oauthAbortWatcherInstalled = false;

// Initialize signup page
const initializeSignupPage = async () => {
  // CRITICAL: Run Global OAuth Guard FIRST to wipe stale state
  const { initGlobalOAuthGuard } = await import("../utils/global-oauth-guard.js");
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
    // console.log removed for security
    if (event === "SIGNED_IN" && session) {
      checkAuthentication();
    }
  });
  // Terms & Privacy Modals are now handled by the SimpleModal component
  // Listen for acceptance events to update the checkbox
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
    const _classList = ["weak", "fair", "good", "strong"];
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
      switch (true) {
        case score <= 1: return "Weak";
        case score === 2: return "Fair";
        case score === 3: return "Good";
        default: return "Strong";
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
      // Do not evaluate if empty or less than 8 chars
      if (pwd.length < 8) {
        strengthFill.classList.remove("weak","fair","good","strong");
        strengthText.classList.remove("weak","fair","good","strong");
        strengthFill.style.width = "0%";
        strengthText.textContent = "Password strength";
        return;
      }
      const score = calcScore(pwd);
      const cls = classFor(score);
      // reset
      strengthFill.classList.remove("weak","fair","good","strong");
      strengthText.classList.remove("weak","fair","good","strong");
      // Apply base width 0 first
      strengthFill.style.width = "0%";
      // apply classes
      strengthFill.classList.add(cls);
      strengthText.classList.add(cls);
      // Map class to width explicitly in case CSS not applied yet
      const widthMap = { weak: "25%", fair: "50%", good: "75%", strong: "100%" };
      strengthFill.style.width = widthMap[cls];
      strengthText.textContent = `Password strength: ${labelFor(score)}`;
    };
    passwordInput.addEventListener("input", update);
    update();
  } catch (_) {}
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
      } catch {}
    }
  };

  const resetSignupState = ({ persist = true } = {}) => {
    if (regForm) {
      regForm.reset();
      regForm.dataset.method = "none";
    }
    selectMethod("none", { persist });
    clearOAuthContext();
    try { localStorage.removeItem("cl_signup_step_index"); } catch {} // Reset step index storage
    document.dispatchEvent(new Event("signup-reset")); // Reset UI step to 0
  };
  resetSignupStateHandler = resetSignupState;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const method = btn.dataset.signupMethod || "email";
      selectMethod(method, { persist: true });
    });
  });

  // Restore last method if it was email to keep the form open
  let cachedMethod = null;
  try {
    cachedMethod = localStorage.getItem(METHOD_STORAGE_KEY);
  } catch {}
  if (cachedMethod === "email") {
    selectMethod("email");
  } else {
    selectMethod("none");
  }

  methodBackBtn?.addEventListener("click", () => {
    resetSignupState({ persist: true });
    const methodTop = methodSection?.offsetTop || 0;
    window.scrollTo({ top: methodTop - 40, behavior: "smooth" });
  });

  // Removed handlePageExit to allow persistence across refreshes
  // window.addEventListener('pagehide', handlePageExit);
  // window.addEventListener('beforeunload', handlePageExit);
}

function setupOAuthPopupBridge() {
  window.addEventListener("message", async (event) => {
    if (event.origin !== window.location.origin) return;

    // Log the full event data to debug
    // console.log('[SIGNUP] Received message from popup:', event.data); // Redacted for security
    console.log("[SIGNUP] Full event:", {
      type: event.data?.type,
      redirectTo: event.data?.redirectTo,
      incomplete: event.data?.incomplete,
      // payload: event.data?.payload, // Redacted for security
      // fullData: event.data // Redacted for security
    });

    const { type, payload, redirectTo, incomplete } = event.data || {};

    if (type === "oauth-signup-success") {
      const provider = (payload?.provider || "OAuth").replace(/^\w/, (c) => c.toUpperCase());
      console.log("[SIGNUP] ✅ OAuth signup success, provider:", provider);
      console.log("[SIGNUP] Message details:", {
        redirectTo,
        incomplete,
        hasPayload: Boolean(payload)
      });

      try {
        const ctx = getOAuthContext() || {};
        setOAuthContext({ ...ctx, status: "handoff" });
        console.log("[SIGNUP] OAuth context updated to handoff");
      } catch (e) {
        console.error("[SIGNUP] Error updating OAuth context:", e);
      }

      // CRITICAL: Set the session in this window before redirecting
      // Supabase sessions are window-specific, so we need to sync it from popup
      const accessToken = event.data?.accessToken;
      const refreshToken = event.data?.refreshToken;

      if (accessToken && refreshToken) {
        try {
          console.log("[SIGNUP] Setting session in main window...");
          console.log("[SIGNUP] Access token length:", accessToken.length);
          console.log("[SIGNUP] Refresh token length:", refreshToken.length);

          // Set the session using setSession
          const { _data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            console.error("[SIGNUP] ❌ Error setting session:", error);
            console.error("[SIGNUP] Error details:", error.message, error.status);
          } else {
            console.log("[SIGNUP] ✅ Session set successfully in main window");

            // Verify session is actually set
            const { data: { session: verifySession }, error: verifyError } = await supabase.auth.getSession();
            if (verifySession) {
              console.log("[SIGNUP] ✅ Session verified - user ID:", verifySession.user?.id);
            } else {
              console.error("[SIGNUP] ❌ Session verification failed:", verifyError);
            }

            // Also set server-side cookie
            try {
              const cookieResponse = await fetch("/auth/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ access_token: accessToken })
              });
              if (cookieResponse.ok) {
                console.log("[SIGNUP] ✅ Server session cookie set");
              } else {
                console.warn("[SIGNUP] ⚠️ Server session cookie not set:", cookieResponse.status);
              }
            } catch (cookieError) {
              console.warn("[SIGNUP] ⚠️ Error setting server cookie:", cookieError);
            }
          }
        } catch (sessionError) {
          console.error("[SIGNUP] ❌ Error setting session:", sessionError);
          console.error("[SIGNUP] Error stack:", sessionError.stack);
        }
      } else {
        console.warn("[SIGNUP] ⚠️ No access/refresh tokens in message");
        console.warn("[SIGNUP] Access token:", Boolean(accessToken), "Refresh token:", Boolean(refreshToken));
      }

      showMessage("success", `${provider} connected. Finishing setup...`);

      // CRITICAL: Always redirect to continuation for OAuth signups
      // Extract redirectTo from event.data if not in destructured variables
      const actualRedirectTo = redirectTo || event.data?.redirectTo || "/oauth-continuation";

      console.log("[SIGNUP] Redirect decision:", {
        willRedirect: true,
        redirectTo: actualRedirectTo,
        incomplete: incomplete !== undefined ? incomplete : event.data?.incomplete,
        eventDataKeys: Object.keys(event.data || {}),
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken)
      });

      console.log("[SIGNUP] ✅ REDIRECTING TO:", actualRedirectTo);

      // CRITICAL: If we have tokens, pass them in URL hash for Supabase to pick up
      // This is how Supabase normally handles OAuth redirects
      let redirectUrl = actualRedirectTo;
      if (accessToken && refreshToken) {
        // Add tokens to URL hash - Supabase will automatically extract and set them
        const hashParams = new URLSearchParams();
        hashParams.set("access_token", accessToken);
        hashParams.set("refresh_token", refreshToken);
        hashParams.set("type", "recovery"); // This tells Supabase to set the session
        redirectUrl = `${actualRedirectTo}#${hashParams.toString()}`;
        console.log("[SIGNUP] Adding session tokens to URL hash for Supabase");
      }

      // Increased delay to ensure session is fully set and persisted before redirect
      setTimeout(async () => {
        // Double-check session before redirect
        const { data: { session: finalCheck }, error: _finalError } = await supabase.auth.getSession();
        if (finalCheck) {
          console.log("[SIGNUP] ✅ Final session check passed - user ID:", finalCheck.user?.id);
          console.log("[SIGNUP] Executing redirect now...");
          window.location.href = redirectUrl;
        } else {
          console.warn("[SIGNUP] ⚠️ Session check failed, but redirecting anyway with tokens in URL");
          console.warn("[SIGNUP] Supabase will extract tokens from URL hash");
          // Redirect anyway - Supabase will extract tokens from URL hash
          window.location.href = redirectUrl;
        }
      }, 800); // Increased delay to ensure session is fully persisted
    }
    if (type === "oauth-user-exists") {
      cleanupPendingOAuth("User already exist");
    }
    if (type === "oauth-signup-error" && payload?.message) {
      cleanupPendingOAuth(payload.message);
    }
  });
}

const OAUTH_STALE_TIMEOUT_MS = 3000;

async function cleanupPendingOAuth(message = "OAuth signup was cancelled. Please try again.") {
  try {
    // Get user ID before signing out
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    // Delete user from database if user exists and has valid session
    if (userId && session?.access_token) {
      try {
        // Get auth token for the delete request
        const token = session.access_token;
        const headers = { "Content-Type": "application/json" };
        headers["Authorization"] = `Bearer ${token}`;

        // Delete user data (this will also delete from auth.users)
        // If this fails, we'll still proceed with sign out and context clearing
        const deleteResponse = await fetch("/api/compliance/delete", {
          method: "DELETE",
          headers,
          credentials: "include",
          body: JSON.stringify({
            userId,
            confirm: true,
            reason: "Incomplete OAuth signup cancelled by user"
          })
        });

        // Only log if it's not a 401/403 (expected for invalid sessions)
        if (!deleteResponse.ok) {
          const errorData = await deleteResponse.json().catch(() => ({}));
          const {status} = deleteResponse;
          // Don't log auth errors - they're expected for incomplete signups
          if (status !== 401 && status !== 403) {
            console.warn("[SIGNUP] Failed to delete incomplete OAuth user:", errorData.error || "Unknown error");
          }
        }
      } catch (deleteError) {
        // Silently fail - incomplete signups may not have valid sessions
        // The sign out below will still clear the session
      }
    }

    // Sign out after deletion attempt
    await supabase.auth.signOut();
  } catch {}

  try { await fetch("/auth/session", { method: "DELETE" }); } catch {}
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
      if (ctx && ctx.intent === "signup" && ctx.status === "pending") {
        const startedAt = Number(ctx.startedAt) || 0;
        const elapsed = Date.now() - startedAt;
        if (elapsed > OAUTH_STALE_TIMEOUT_MS) {
          await cleanupPendingOAuth("OAuth signup did not finish. Please try again.");
        }
      }
    } catch (error) {
      console.warn("[SIGNUP] OAuth abort watcher error:", error);
    }
  };

  // Handle tab close / navigation away
  const handleBeforeUnload = async () => {
    const ctx = getOAuthContext();
    if (ctx && ctx.intent === "signup" && ctx.status === "pending") {
      // Cleanup on page unload (silently)
      await cleanupPendingOAuth(null);
    }
  };

  // Handle visibility change (user switches tabs)
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      checkPendingOAuth();
    } else if (document.visibilityState === "hidden") {
      // Mark as potentially abandoned
      const ctx = getOAuthContext();
      if (ctx && ctx.intent === "signup" && ctx.status === "pending") {
        setOAuthContext({ ...ctx, lastActivity: Date.now() });
      }
    }
  };

  // Handle page hide (navigation away)
  const handlePageHide = async () => {
    const ctx = getOAuthContext();
    if (ctx && ctx.intent === "signup" && ctx.status === "pending") {
      await cleanupPendingOAuth(null);
    }
  };

  window.addEventListener("focus", checkPendingOAuth, true);
  window.addEventListener("beforeunload", handleBeforeUnload);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", handlePageHide);
}
