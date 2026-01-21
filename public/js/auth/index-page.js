// Index/landing page specific functionality
import { supabase } from "../config/config.js";
import { logout, getOAuthContext, clearOAuthContext, suppressAuthErrorNotifications } from "./authChecker.js";
import { shouldSkipAuthCheck } from "../utils/oauth-cleanup.js";

// Track if logout event listener has been added
let logoutListenerAdded = false;

// Global Guard handles all cleanup now - redundant code removed

// Check authentication status and update UI
const checkAuthenticationAndUpdateUI = async () => {
  try {
    // Global Guard already ran at init
    // await clearOAuthContextOnLanding();

    // Check for incomplete OAuth signup - if pending or handoff, don't show authenticated UI
    const ctx = getOAuthContext();
    const hasIncompleteOAuth = ctx && ctx.intent === "signup" && (ctx.status === "pending" || ctx.status === "handoff");
    const hasPendingOAuth = shouldSkipAuthCheck() || hasIncompleteOAuth;

    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    const unauthenticatedButtons = document.getElementById("unauthenticated-buttons");
    const authenticatedButtons = document.getElementById("authenticated-buttons");
    const logoutBtn = document.getElementById("logout-btn");

    // If there's an incomplete OAuth signup, always show unauthenticated buttons
    if (hasPendingOAuth || hasIncompleteOAuth) {
      if (unauthenticatedButtons) unauthenticatedButtons.classList.remove("hidden");
      if (authenticatedButtons) authenticatedButtons.classList.add("hidden");
      return;
    }

    if (session && !error) {
      // Get user metadata
      const {user} = session;
      const role = user?.user_metadata?.role || user?.raw_user_meta_data?.role || "";
      const name = user?.user_metadata?.name || user?.raw_user_meta_data?.name || "";
      const hasMobile = user?.user_metadata?.mobile_number ||
                       user?.user_metadata?.mobile ||
                       user?.phone;

      // Check if user has completed registration (must have role, name, AND mobile)
      if (role && name && hasMobile) {
        // Hide login/signup buttons, show dashboard button
        if (unauthenticatedButtons) unauthenticatedButtons.classList.add("hidden");
        if (authenticatedButtons) authenticatedButtons.classList.remove("hidden");
        // Add logout functionality (only once)
        if (logoutBtn && !logoutListenerAdded) {
          logoutBtn.addEventListener("click", async () => {
            await logout();
          });
          logoutListenerAdded = true;
        }
      } else {
        // Profile incomplete, keep showing login/signup for profile completion
        if (unauthenticatedButtons) unauthenticatedButtons.classList.remove("hidden");
        if (authenticatedButtons) authenticatedButtons.classList.add("hidden");
      }
    } else {
      // Show login/signup buttons, hide dashboard button
      if (unauthenticatedButtons) unauthenticatedButtons.classList.remove("hidden");
      if (authenticatedButtons) authenticatedButtons.classList.add("hidden");
    }
  } catch (error) {
    console.error("💥 Authentication check failed:", error);
    // On error, default to showing login/signup buttons
    const unauthenticatedButtons = document.getElementById("unauthenticated-buttons");
    const authenticatedButtons = document.getElementById("authenticated-buttons");
    if (unauthenticatedButtons) unauthenticatedButtons.classList.remove("hidden");
    if (authenticatedButtons) authenticatedButtons.classList.add("hidden");
  }
};
// Initialize index page
const initializeIndexPage = async () => {
  // CRITICAL: Run Global OAuth Guard FIRST to wipe stale state
  const { initGlobalOAuthGuard } = await import("../utils/global-oauth-guard.js");
  await initGlobalOAuthGuard();

  // Setup navigation cleanup for login/signup buttons and brand logo
  const { setupNavigationCleanup } = await import("../utils/navigation.js");
  setupNavigationCleanup();

  // Run authentication check when page loads
  checkAuthenticationAndUpdateUI();
  // Also run immediately in case DOMContentLoaded already fired
  checkAuthenticationAndUpdateUI();
};
// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeIndexPage);
} else {
  initializeIndexPage();
}
