// OAuth callback handler - processes OAuth redirect and determines next step
import { supabase } from "../config/config.js";
import { setOAuthContext, clearOAuthContext, getOAuthContext, suppressAuthErrorNotifications } from "./authChecker.js";

console.log("[OAUTH_CALLBACK] OAuth callback page loaded");

const processOAuthCallback = async () => {
  // Suppress auth error notifications while OAuth flow settles
  suppressAuthErrorNotifications();
  try {
    console.log("[OAUTH_CALLBACK] Processing OAuth callback...");
    console.log("[OAUTH_CALLBACK] URL:", window.location.href);
    console.log("[OAUTH_CALLBACK] Hash:", window.location.hash);

    // Wait for Supabase to process the OAuth callback
    // Supabase automatically handles tokens in URL hash
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get the session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.error("[OAUTH_CALLBACK] No session found:", sessionError);
      window.location.href = "/login?err=oauth_failed";
      return;
    }

    console.log("[OAUTH_CALLBACK] Session found, user ID:", session.user?.id);

    // Set server-side session cookie
    try {
      const cookieResponse = await fetch("/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: session.access_token })
      });

      if (!cookieResponse.ok) {
        console.warn("[OAUTH_CALLBACK] Failed to set server cookie");
      }
    } catch (cookieError) {
      console.warn("[OAUTH_CALLBACK] Error setting server cookie:", cookieError);
    }

    // Get OAuth intent from context (set when user clicked OAuth button)
    const oauthContext = getOAuthContext();
    const intent = oauthContext?.intent || "login"; // Default to login for safety

    console.log("[OAUTH_CALLBACK] OAuth intent:", intent);
    console.log("[OAUTH_CALLBACK] OAuth context:", oauthContext);

    // Check user status on server (pass intent to help determine new vs existing)
    try {
      const statusResponse = await fetch(`/api/auth/oauth-status?intent=${intent}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "X-OAuth-Intent": intent
        }
      });

      if (!statusResponse.ok) {
        throw new Error("Failed to check user status");
      }

      const statusData = await statusResponse.json();
      console.log("[OAUTH_CALLBACK] User status:", statusData);

      if (statusData.complete) {
        // User is fully registered - go to dashboard
        console.log("[OAUTH_CALLBACK] User is complete, redirecting to dashboard");
        console.log("[OAUTH_CALLBACK] User type:", statusData.userType);
        console.log("[OAUTH_CALLBACK] Message:", statusData.message);

        // Clear OAuth context since we're done
        clearOAuthContext();

        // Store a success message if available
        if (statusData.message) {
          sessionStorage.setItem("oauth_success_message", statusData.message);
        }

        window.location.href = "/dashboard";
      } else {
        // User needs to complete profile - go to continuation
        const isNewSignup = statusData.isNewSignup || intent === "signup";
        const isExistingIncomplete = statusData.isExistingIncomplete || (intent === "login" && !statusData.isNewSignup);

        console.log("[OAUTH_CALLBACK] User is incomplete, redirecting to continuation");
        console.log("[OAUTH_CALLBACK] Is new signup:", isNewSignup);
        console.log("[OAUTH_CALLBACK] Is existing incomplete:", isExistingIncomplete);
        console.log("[OAUTH_CALLBACK] User type:", statusData.userType);

        // Set OAuth context for continuation page
        const provider = session.user?.identities?.[0]?.provider || "oauth";
        setOAuthContext({
          provider,
          email: session.user?.email,
          intent,
          status: "handoff",
          startedAt: Date.now(),
          userType: statusData.userType,
          isNewSignup,
          message: statusData.message
        });

        window.location.href = "/oauth-continuation";
      }
    } catch (statusError) {
      console.error("[OAUTH_CALLBACK] Error checking user status:", statusError);
      // Fallback: redirect to continuation with default signup intent
      const provider = session.user?.identities?.[0]?.provider || "oauth";
      setOAuthContext({
        provider,
        email: session.user?.email,
        intent: intent || "signup",
        status: "handoff",
        startedAt: Date.now()
      });
      window.location.href = "/oauth-continuation";
    }
  } catch (error) {
    console.error("[OAUTH_CALLBACK] Error processing callback:", error);
    window.location.href = "/login?err=oauth_failed";
  }
};

// Process callback when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", processOAuthCallback);
} else {
  processOAuthCallback();
}

