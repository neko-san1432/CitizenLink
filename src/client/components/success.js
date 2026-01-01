// IMMEDIATE LOGGING - Should run before any imports
console.log("========================================");
console.log("[SUCCESS] ✅ MODULE FILE LOADED");
console.log("[SUCCESS] Script file loaded at:", new Date().toISOString());
console.log("[SUCCESS] Current URL:", window.location.href);
console.log("[SUCCESS] Pathname:", window.location.pathname);
console.log("[SUCCESS] Search:", window.location.search);
console.log("[SUCCESS] Hash:", window.location.hash);
console.log("========================================");

import { supabase } from "../config/config.js";
import { saveUserMeta, setOAuthContext, clearOAuthContext, getOAuthContext } from "../auth/authChecker.js";

console.log("[SUCCESS] ✅ Imports completed successfully");

const run = async () => {
  console.log("[SUCCESS] ========================================");
  console.log("[SUCCESS] Success page loaded");
  console.log("[SUCCESS] URL:", window.location.href);
  console.log("[SUCCESS] Timestamp:", new Date().toISOString());

  const urlParams = new URLSearchParams(window.location.search);
  const isPopupFlow = urlParams.get("popup") === "1" || Boolean(window.opener);
  const oauthContext = getOAuthContext() || {};

  console.log("[SUCCESS] Flow check:", {
    isPopupFlow,
    hasOpener: Boolean(window.opener),
    oauthContext,
    localStorageOAuth: localStorage.getItem("cl_oauth_context")
  });

  const notifyExistingUser = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      await fetch("/auth/session", { method: "DELETE" });
    } catch {}
    clearOAuthContext();
    if (window.opener) {
      window.opener.postMessage({ type: "oauth-user-exists" }, window.location.origin);
      setTimeout(() => {
        try { window.close(); } catch {}
      }, 200);
    } else {
      window.location.href = "/login?err=user_exists";
    }
  };
  try {
    // Check for error or success messages in URL hash
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const error = hashParams.get("error");
      const errorCode = hashParams.get("error_code");
      const errorDescription = hashParams.get("error_description");
      const message = hashParams.get("message");
      const type = hashParams.get("type") || (error || errorCode ? "error" : "success");

      // Import toast module
      const { default: showMessage } = await import("./toast.js");

      // Handle error messages
      if (error || errorCode) {
        // Determine error message based on error code
        let errorMessage = "An error occurred";
        if (errorCode === "otp_expired") {
          errorMessage = "The email link has expired. Please request a new one.";
        } else if (errorCode === "access_denied") {
          errorMessage = "Access denied. The link may be invalid or expired.";
        } else if (errorDescription) {
          // Decode URL-encoded description
          errorMessage = decodeURIComponent(errorDescription.replace(/\+/g, " "));
        } else if (error) {
          errorMessage = `Authentication error: ${error}`;
        }

        // Show error toast
        showMessage("error", errorMessage, 8000);

        // Clean up URL hash
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

        // Redirect to appropriate page based on error
        if (errorCode === "otp_expired") {
          // For expired OTP, redirect to login or appropriate page
          setTimeout(() => {
            window.location.href = "/login";
          }, 3000);
        } else {
          // For other errors, redirect to login
          setTimeout(() => {
            window.location.href = "/login";
          }, 3000);
        }
        return; // Exit early, don't process success flow
      }

      // Handle success messages
      if (message) {
        // Decode URL-encoded message (handle both + and %20 for spaces)
        let decodedMessage = decodeURIComponent(message.replace(/\+/g, " "));

        // Clean up any trailing delimiters (pipe, semicolon, etc.)
        decodedMessage = decodedMessage.replace(/[|;]$/, "").trim();

        // Determine toast type (success, info, warning, error)
        const toastType = type === "error" ? "error" :
          type === "warning" ? "warning" :
            type === "info" ? "info" : "success";

        // Show success/info toast
        showMessage(toastType, decodedMessage, 8000);

        // Clean up URL hash
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

        // Don't return here - continue with normal flow to process session
      }
    }

    // After OAuth or email confirmation, Supabase sets a session
    console.log("[SUCCESS] Checking session...");

    // CRITICAL: Check OAuth context BEFORE processing - it might be lost during redirect
    let oauthContext = getOAuthContext() || {};
    console.log("[SUCCESS] Initial OAuth context check (before session):", oauthContext);
    console.log("[SUCCESS] localStorage OAuth context:", localStorage.getItem("cl_oauth_context"));

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    console.log("[SUCCESS] Session check:", {
      hasSession: Boolean(session),
      hasError: Boolean(sessionError),
      error: sessionError?.message
    });

    const user = session?.user;
    const accessToken = session?.access_token || null;
    const role = user?.user_metadata?.role || user?.raw_user_meta_data?.role || null;
    const name = user?.user_metadata?.name || user?.raw_user_meta_data?.name || null;
    const email = user?.email || null;

    console.log("[SUCCESS] User data:", {
      userId: user?.id,
      email,
      role: role || "missing",
      name: name || "missing",
      hasAccessToken: Boolean(accessToken)
    });

    if (role || name) saveUserMeta({ role, name });
    // Track provider
    const provider = user?.identities?.[0]?.provider || null;
    console.log("[SUCCESS] OAuth provider:", provider);

    if (provider) {
      console.log("[SUCCESS] Updating OAuth context with provider:", provider);
      // Preserve existing OAuth context (especially intent) if it exists
      const existingContext = getOAuthContext() || {};
      const updatedContext = {
        ...existingContext,
        provider,
        email: email || existingContext.email,
        // Preserve intent if it exists, otherwise we'll infer it later
        intent: existingContext.intent,
        status: existingContext.status || "pending"
      };
      console.log("[SUCCESS] Updated OAuth context:", updatedContext);
      setOAuthContext(updatedContext);

      // merge into oauth_providers array
      try {
        const currentProviders = Array.isArray(user?.user_metadata?.oauth_providers)
          ? user.user_metadata.oauth_providers
          : [];
        const nextProviders = Array.from(new Set([...currentProviders, provider]));
        await supabase.auth.updateUser({ data: { oauth_providers: nextProviders } });
        console.log("[SUCCESS] Updated OAuth providers:", nextProviders);
      } catch (error) {
        console.error("[SUCCESS] Error updating OAuth providers:", error);
      }
    }
    const userMetadata = user?.user_metadata || {};
    const rawMetadata = user?.raw_user_meta_data || {};
    const combinedMetadata = { ...userMetadata, ...rawMetadata };

    const hasFullProfile = Boolean(
      (combinedMetadata.mobile_number || combinedMetadata.mobile || user?.phone) &&
      (role || combinedMetadata.role)
    );

    // Check if user has completed registration
    const hasMobile = combinedMetadata.mobile_number ||
                     combinedMetadata.mobile ||
                     userMetadata.mobile ||
                     userMetadata.phone ||
                     userMetadata.phone_number ||
                     user?.phone;
    const isFullyRegistered = role && name && hasMobile;

    // Re-read OAuth context after potential updates
    oauthContext = getOAuthContext() || {};

    // CRITICAL: If OAuth context is missing intent but we have a provider,
    // we need to determine if this is a signup or login
    // Heuristic: If user is NOT fully registered AND has OAuth provider, it's likely a signup
    if (!oauthContext.intent && provider) {
      if (!isFullyRegistered) {
        // Incomplete registration + OAuth = new signup
        console.log("[SUCCESS] OAuth context missing intent, inferring SIGNUP from incomplete registration");
        oauthContext = {
          ...oauthContext,
          provider: provider || oauthContext.provider,
          email: email || oauthContext.email,
          intent: "signup",
          status: "pending"
        };
        setOAuthContext(oauthContext);
      } else {
        // Fully registered + OAuth = login
        console.log("[SUCCESS] OAuth context missing intent, inferring LOGIN from complete registration");
        oauthContext = {
          ...oauthContext,
          provider: provider || oauthContext.provider,
          email: email || oauthContext.email,
          intent: "login",
          status: "completed"
        };
        setOAuthContext(oauthContext);
      }
    }

    const cameFromSignup = oauthContext.intent === "signup";

    console.log("[SUCCESS] ========================================");
    console.log("[SUCCESS] FINAL DECISION POINT:");
    console.log("[SUCCESS] OAuth context:", oauthContext);
    console.log("[SUCCESS] Provider:", provider);
    console.log("[SUCCESS] isFullyRegistered:", isFullyRegistered);
    console.log("[SUCCESS] cameFromSignup:", cameFromSignup);
    console.log("[SUCCESS] Registration details:", {
      role: role || "MISSING",
      name: name || "MISSING",
      hasMobile: Boolean(hasMobile),
      mobile: hasMobile || "MISSING"
    });
    console.log("[SUCCESS] ========================================");

    console.log("[SUCCESS] Registration status check:", {
      hasFullProfile,
      cameFromSignup,
      hasMobile: Boolean(hasMobile),
      isFullyRegistered,
      role: role || "missing",
      name: name || "missing",
      mobile: hasMobile || "missing"
    });

    // CRITICAL: Only set session cookie if user has completed registration
    // For incomplete OAuth signups, NEVER set the cookie - this prevents marking as logged in
    // IMPORTANT: OAuth login users (intent === 'login') are always fully registered and should always get session cookie
    const isOAuthLogin = !cameFromSignup; // OAuth login has intent === 'login'

    if (isFullyRegistered && accessToken) {
      // User is fully registered - set session cookie (applies to both login and completed signup)
      try {
        const resp = await fetch("/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: accessToken })
        });
        // Verify cookie by hitting a protected endpoint before redirecting
        if (resp.ok) {
          let ok = false;
          try {
            const check1 = await fetch("/api/user/role", { method: "GET" });
            ok = check1.ok;
          } catch (error) {
            console.error("[SUCCESS] First role check error:", error);
          }
          if (!ok) {
            await new Promise(r => setTimeout(r, 300));
            try {
              const check2 = await fetch("/api/user/role", { method: "GET" });
              ok = check2.ok;
            } catch (error) {
              console.error("[SUCCESS] Second role check error:", error);
            }
          }
          if (!ok) {
            // If cannot verify, stay on page and let user refresh
            return;
          }
        }
      } catch (error) {
        console.error("[SUCCESS] Session persistence error:", error);
      }
    } else if (!isOAuthLogin && cameFromSignup) {
      // ONLY for incomplete OAuth signups (not login), explicitly clear any existing session cookie
      // to prevent being marked as logged in
      // OAuth login users are always fully registered, so this branch never executes for them
      // CRITICAL: DO NOT clear Supabase session - we need it for the continuation page!
      // Only clear the server-side cookie to prevent being marked as logged in
      console.log("[SUCCESS] Clearing server-side session cookie (but keeping Supabase session for continuation)");
      try {
        await fetch("/auth/session", { method: "DELETE" });
        console.log("[SUCCESS] Server session cookie cleared");
      } catch (error) {
        console.warn("[SUCCESS] Error clearing server session cookie:", error);
        // Silently fail - cookie might not exist
      }

      // DO NOT sign out from Supabase - we need the session for the continuation page!
      // The continuation page will validate the session and complete the registration
      console.log("[SUCCESS] Keeping Supabase session for OAuth continuation page");
    }
    // If isOAuthLogin but !isFullyRegistered, this is an edge case (shouldn't happen)
    // But we don't clear session to be safe - let the user proceed

    // Check if user already exists (has full profile but came from signup)
    if (cameFromSignup && hasFullProfile) {
      await notifyExistingUser();
      return;
    }

    // For incomplete OAuth signups, set context to 'handoff' (not 'pending')
    // This allows continuation page to load but prevents auth checks
    console.log("[SUCCESS] Final OAuth context decision...");
    console.log("[SUCCESS] Context decision:", {
      cameFromSignup,
      isFullyRegistered,
      hasProvider: Boolean(provider),
      willSetContext: cameFromSignup && !isFullyRegistered && provider
    });

    if (cameFromSignup && !isFullyRegistered && provider) {
      const newContext = {
        provider,
        email: email || oauthContext.email,
        intent: "signup",
        status: "handoff", // Changed from 'pending' to allow continuation page
        startedAt: oauthContext.startedAt || Date.now()
      };
      console.log("[SUCCESS] ✅ Setting OAuth context to handoff:", newContext);
      setOAuthContext(newContext);
      console.log("[SUCCESS] OAuth context after setting:", getOAuthContext());
    } else if (isFullyRegistered) {
      console.log("[SUCCESS] User fully registered, clearing OAuth context");
      clearOAuthContext();
    } else {
      console.log("[SUCCESS] Keeping existing OAuth context:", oauthContext);
    }

    if (isPopupFlow) {
      console.log("[SUCCESS] 🔵 POPUP FLOW DETECTED");
      console.log("[SUCCESS] Popup flow - checking registration status...");
      console.log("[SUCCESS] isFullyRegistered:", isFullyRegistered);
      console.log("[SUCCESS] cameFromSignup:", cameFromSignup);

      const identityData = user?.identities?.[0]?.identity_data || {};
      const userMeta = user?.user_metadata || {};
      const rawMeta = user?.raw_user_meta_data || {};
      const combined = {
        ...rawMeta,
        ...userMeta,
        ...identityData
      };
      const fullName = combined.full_name || combined.name || "";
      const splitName = fullName ? fullName.trim().split(" ") : [];
      const firstName = combined.given_name || combined.first_name || splitName[0] || "";
      const lastName = combined.family_name || combined.last_name || splitName.slice(1).join(" ") || "";
      const middleName = combined.middle_name || splitName.slice(1, -1).join(" ") || "";
      const payload = { provider, email, firstName, middleName, lastName };

      // CRITICAL: Always send message for OAuth signups (both complete and incomplete)
      // The signup page will handle the redirect
      console.log("[SUCCESS] 🔵 Sending message to opener window");
      console.log("[SUCCESS] Registration status:", {
        isFullyRegistered,
        role: role || "missing",
        name: name || "missing",
        hasMobile: Boolean(hasMobile)
      });

      if (window.opener) {
        try {
          // CRITICAL: Get the session token to pass to main window
          // Supabase stores sessions in localStorage which is window-specific
          // We need to pass the token so main window can set it
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          const accessToken = currentSession?.access_token;
          const refreshToken = currentSession?.refresh_token;

          console.log("[SUCCESS] Session token available:", Boolean(accessToken));

          // Always send message with redirectTo for OAuth signups
          // If incomplete, mark it explicitly
          const message = {
            type: "oauth-signup-success",
            payload,
            redirectTo: "/oauth-continuation",
            incomplete: !isFullyRegistered,
            // CRITICAL: Pass session tokens so main window can set them
            accessToken,
            refreshToken
          };
          console.log("[SUCCESS] Sending message to opener:", JSON.stringify({
            ...message,
            accessToken: accessToken ? "***" : null,
            refreshToken: refreshToken ? "***" : null
          }, null, 2));
          window.opener.postMessage(message, window.location.origin);
          console.log("[SUCCESS] ✅ Message sent to opener");

          // Wait a bit to ensure message is received, then close
          setTimeout(() => {
            try {
              console.log("[SUCCESS] Closing popup...");
              window.close();
            } catch (closeError) {
              console.warn("[SUCCESS] Could not close popup:", closeError);
              // If popup can't close, redirect in popup itself
              window.location.href = "/oauth-continuation";
            }
          }, 800); // Increased delay to ensure message is received and processed
        } catch (postError) {
          console.error("[SUCCESS] ❌ Failed to notify opener:", postError);
          // Fallback: redirect in popup
          window.location.href = "/oauth-continuation";
        }
      } else {
        console.warn("[SUCCESS] No opener window found, redirecting in popup...");
        window.location.href = "/oauth-continuation";
      }
      return;

      // Fully registered - normal popup flow
      if (window.opener) {
        try {
          window.opener.postMessage({ type: "oauth-signup-success", payload }, window.location.origin);
        } catch (postError) {
          console.error("[SUCCESS] Failed to notify opener:", postError);
        }
      }
      setTimeout(() => {
        try {
          window.close();
        } catch {
          // If popup can't close, redirect to continuation
          window.location.href = "/oauth-continuation";
        }
      }, 200);
      return;
    }

    // Redirect based on registration status
    console.log("[SUCCESS] Determining redirect destination...");
    console.log("[SUCCESS] Redirect check:", {
      hasProvider: Boolean(provider),
      isFullyRegistered,
      cameFromSignup,
      provider
    });

    // CRITICAL: Redirect logic - must check all conditions
    // If user has OAuth provider but is NOT fully registered, they need to complete signup
    // Even if cameFromSignup is false (context lost), we should still redirect if incomplete
    // SIMPLIFIED: If provider exists and user is incomplete, redirect (regardless of context)
    const shouldRedirectToContinuation = provider && !isFullyRegistered;

    console.log("[SUCCESS] ========================================");
    console.log("[SUCCESS] REDIRECT DECISION:");
    console.log("[SUCCESS] shouldRedirectToContinuation:", shouldRedirectToContinuation);
    console.log("[SUCCESS] Conditions:", {
      hasProvider: Boolean(provider),
      notFullyRegistered: !isFullyRegistered,
      cameFromSignup,
      // Fallback: if incomplete and has provider, assume signup
      fallbackCheck: !isFullyRegistered && Boolean(provider)
    });
    console.log("[SUCCESS] ========================================");

    if (shouldRedirectToContinuation) {
      // Incomplete OAuth signup - redirect to continuation
      console.log("[SUCCESS] ✅ REDIRECTING TO OAUTH CONTINUATION");
      const finalContext = getOAuthContext();
      console.log("[SUCCESS] OAuth context before redirect:", finalContext);
      console.log("[SUCCESS] Session exists:", Boolean(session));
      console.log("[SUCCESS] About to set window.location.href...");

      // Force redirect immediately (no setTimeout)
      console.log("[SUCCESS] EXECUTING REDIRECT NOW...");
      window.location.href = "/oauth-continuation";
      // Add a fallback in case redirect fails
      setTimeout(() => {
        if (window.location.pathname !== "/oauth-continuation") {
          console.error("[SUCCESS] Redirect failed! Trying again...");
          window.location.replace("/oauth-continuation");
        }
      }, 500);
      // Exit early to prevent any other redirects
    } else if (isFullyRegistered) {
      // Complete registration - redirect to dashboard
      console.log("[SUCCESS] ✅ Redirecting to dashboard (fully registered)");
      clearOAuthContext();
      window.location.href = "/dashboard";
    } else {
      // Fallback - should not happen
      console.log("[SUCCESS] ⚠️ Fallback redirect to login");
      clearOAuthContext();
      window.location.href = "/login";
    }
  } catch (error) {
    console.error("[SUCCESS] Main error:", error);
    console.error("[SUCCESS] Error stack:", error.stack);
    // Fallback: redirect to dashboard anyway
    window.location.href = "/dashboard";
  }
};

console.log("[SUCCESS] About to call run() function");
console.log("[SUCCESS] run function type:", typeof run);

// Wrap in try-catch with detailed error logging
try {
  const result = run();
  if (result && typeof result.then === "function") {
    // It's a promise
    result.catch((error) => {
      console.error("[SUCCESS] ❌ Promise rejection in run():", error);
      console.error("[SUCCESS] Error stack:", error.stack);
      if (window.location.search.includes("debug")) {
        alert(`ERROR in success.js run(): ${  error.message}`);
      }
    });
  }
} catch (error) {
  console.error("[SUCCESS] ❌ Error calling run():", error);
  console.error("[SUCCESS] Error stack:", error.stack);
  if (window.location.search.includes("debug")) {
    alert(`ERROR calling run(): ${  error.message}`);
  }
}
