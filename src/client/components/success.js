// IMMEDIATE LOGGING - Should run before any imports
console.log("========================================");
console.log("[SUCCESS] ✅ MODULE FILE LOADED");
console.log("[SUCCESS] Script file loaded at:", new Date().toISOString());
console.log("[SUCCESS] Current URL:", globalThis.location.href);
console.log("[SUCCESS] Pathname:", globalThis.location.pathname);
console.log("[SUCCESS] Search:", globalThis.location.search);
console.log("[SUCCESS] Hash:", globalThis.location.hash);
console.log("========================================");

import { supabase } from "../config/config.js";
import {
  saveUserMeta,
  setOAuthContext,
  clearOAuthContext,
  getOAuthContext,
} from "../auth/authChecker.js";
import {
  verifySessionPersistence,
  clearServerSession,
} from "./success-helpers.js";

console.log("[SUCCESS] ✅ Imports completed successfully");

/**
 * Handle URL hash parameters (errors and success messages)
 */
async function handleHashParams() {
  if (!globalThis.location.hash) return null;

  const hashParams = new URLSearchParams(globalThis.location.hash.substring(1));
  const error = hashParams.get("error");
  const errorCode = hashParams.get("error_code");
  const errorDescription = hashParams.get("error_description");
  const message = hashParams.get("message");
  const type =
    hashParams.get("type") || (error || errorCode ? "error" : "success");

  // Import toast module
  const { default: showMessage } = await import("./toast.js");

  // Handle error messages
  if (error || errorCode) {
    let errorMessage = "An error occurred";
    if (errorCode === "otp_expired") {
      errorMessage = "The email link has expired. Please request a new one.";
    } else if (errorCode === "access_denied") {
      errorMessage = "Access denied. The link may be invalid or expired.";
    } else if (errorDescription) {
      errorMessage = decodeURIComponent(errorDescription.replaceAll("+", " "));
    } else if (error) {
      errorMessage = `Authentication error: ${error}`;
    }

    showMessage("error", errorMessage, 8000);

    // Clean up URL hash
    globalThis.history.replaceState(
      {},
      document.title,
      globalThis.location.pathname + globalThis.location.search
    );

    setTimeout(() => {
      globalThis.location.href = "/login";
    }, 3000);
    return "error";
  }

  // Handle success messages
  if (message) {
    let decodedMessage = decodeURIComponent(message.replaceAll("+", " "));
    decodedMessage = decodedMessage.replace(/[|;]$/, "").trim();
    const toastType =
      { error: "error", warning: "warning", info: "info" }[type] || "success";

    showMessage(toastType, decodedMessage, 8000);

    // Clean up URL hash
    globalThis.history.replaceState(
      {},
      document.title,
      globalThis.location.pathname + globalThis.location.search
    );
  }
  return null;
}

/**
 * Update OAuth providers in user metadata
 */
async function updateOAuthProviders(user, provider) {
  if (!provider) return;
  try {
    const currentProviders = Array.isArray(user?.user_metadata?.oauth_providers)
      ? user.user_metadata.oauth_providers
      : [];
    const nextProviders = Array.from(new Set([...currentProviders, provider]));
    await supabase.auth.updateUser({
      data: { oauth_providers: nextProviders },
    });
    console.log("[SUCCESS] Updated OAuth providers:", nextProviders);
  } catch (err) {
    console.error("[SUCCESS] Error updating OAuth providers:", err);
  }
}

/**
 * Handle server-side session persistence
 */
async function handleSessionPersistence(
  isFullyRegistered,
  accessToken,
  cameFromSignup
) {
  if (isFullyRegistered && accessToken) {
    try {
      const { ok: respOk } = await fetch("/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
      });

      if (respOk) {
        return await verifySessionPersistence();
      }
    } catch (err) {
      console.error("[SUCCESS] Session persistence error:", err);
    }
  } else if (cameFromSignup) {
    // Incomplete OAuth signup - clear server session to be safe
    await clearServerSession();
  }
  return true;
}

/**
 * Extract identity data from user object
 */
function getIdentityData(user) {
  const userMetadata = user?.user_metadata || {};
  const rawMetadata = user?.raw_user_meta_data || {};
  const identityData = user?.identities?.[0]?.identity_data || {};
  const combined = { ...rawMetadata, ...userMetadata, ...identityData };

  const fullName = combined.full_name || combined.name || "";
  const splitName = fullName ? fullName.trim().split(" ") : [];

  return {
    firstName: combined.given_name || combined.first_name || splitName[0] || "",
    lastName:
      combined.family_name ||
      combined.last_name ||
      splitName.slice(1).join(" ") ||
      "",
    middleName: combined.middle_name || splitName.slice(1, -1).join(" ") || "",
    email: user?.email || null,
    provider: user?.identities?.[0]?.provider || null,
  };
}

/**
 * Handle popup-based OAuth flow signals
 */
async function handlePopupFlow(user, isFullyRegistered) {
  if (!globalThis.opener) return false;

  console.log("[SUCCESS] 🔵 Sending message to opener window");
  const payload = getIdentityData(user);

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    const refreshToken = session?.refresh_token;

    const message = {
      type: "oauth-signup-success",
      payload,
      redirectTo: "/oauth-continuation",
      incomplete: !isFullyRegistered,
      accessToken,
      refreshToken,
    };

    globalThis.opener.postMessage(message, globalThis.location.origin);
    console.log("[SUCCESS] ✅ Message sent to opener");

    setTimeout(() => {
      try {
        globalThis.close();
      } catch {
        globalThis.location.href = "/oauth-continuation";
      }
    }, 800);
    return true;
  } catch (err) {
    console.error("[SUCCESS] ❌ Failed to notify opener:", err);
    globalThis.location.href = "/oauth-continuation";
    return true;
  }
}

const run = async () => {
  console.log("[SUCCESS] ========================================");
  console.log("[SUCCESS] Success page loaded");

  const urlParams = new URLSearchParams(globalThis.location.search);
  const isPopupFlow =
    urlParams.get("popup") === "1" || Boolean(globalThis.opener);

  const notifyExistingUser = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      await fetch("/auth/session", { method: "DELETE" });
    } catch {}
    clearOAuthContext();
    if (globalThis.opener) {
      globalThis.opener.postMessage(
        { type: "oauth-user-exists" },
        globalThis.location.origin
      );
      setTimeout(() => {
        try {
          globalThis.close();
        } catch {}
      }, 200);
    } else {
      globalThis.location.href = "/login?err=user_exists";
    }
  };

  try {
    const hashResult = await handleHashParams();
    if (hashResult === "error") return;

    // After OAuth or email confirmation, Supabase sets a session
    console.log("[SUCCESS] Checking session...");
    let oauthContext = getOAuthContext() || {};

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) console.error("[SUCCESS] Session error:", sessionError);

    const user = session?.user;
    const accessToken = session?.access_token || null;
    const userMetadata = user?.user_metadata || {};
    const rawMetadata = user?.raw_user_meta_data || {};
    const combinedMetadata = { ...userMetadata, ...rawMetadata };

    const role = combinedMetadata.role || null;
    const name = combinedMetadata.name || null;
    const email = user?.email || null;
    const provider = user?.identities?.[0]?.provider || null;

    if (role || name) saveUserMeta({ role, name });

    if (provider) {
      await updateOAuthProviders(user, provider);
      oauthContext = {
        ...oauthContext,
        provider,
        email: email || oauthContext.email,
        intent: oauthContext.intent,
        status: oauthContext.status || "pending",
      };
      setOAuthContext(oauthContext);
    }

    const hasMobile =
      combinedMetadata.mobile_number ||
      combinedMetadata.mobile ||
      combinedMetadata.phone ||
      user?.phone;
    const isFullyRegistered = Boolean(role && name && hasMobile);

    // Infer intent if missing
    if (!oauthContext.intent && provider) {
      oauthContext.intent = isFullyRegistered ? "login" : "signup";
      oauthContext.status = isFullyRegistered ? "completed" : "pending";
      oauthContext.email = email || oauthContext.email;
      oauthContext.provider = provider;
      setOAuthContext(oauthContext);
    }

    const cameFromSignup = oauthContext.intent === "signup";

    // Handle session persistence and handoff
    const persistenceOk = await handleSessionPersistence(
      isFullyRegistered,
      accessToken,
      cameFromSignup
    );
    if (!persistenceOk) return;

    // Check if user already exists
    if (
      cameFromSignup &&
      Boolean(
        combinedMetadata.mobile || combinedMetadata.mobile_number || user?.phone
      )
    ) {
      await notifyExistingUser();
      return;
    }

    // Final context update
    if (cameFromSignup && !isFullyRegistered && provider) {
      oauthContext.status = "handoff";
      setOAuthContext(oauthContext);
    } else if (isFullyRegistered) {
      clearOAuthContext();
    }

    // Handle popup flow
    if (isPopupFlow) {
      const handled = await handlePopupFlow(user, isFullyRegistered);
      if (handled) return;
    }

    // Redirect
    if (provider && !isFullyRegistered) {
      globalThis.location.href = "/oauth-continuation";
    } else if (isFullyRegistered) {
      globalThis.location.href = "/dashboard";
    } else {
      globalThis.location.href = "/login";
    }
  } catch (error) {
    console.error("[SUCCESS] Main error:", error);
    globalThis.location.href = "/dashboard";
  }
};

console.log("[SUCCESS] About to call run() function");
run();
