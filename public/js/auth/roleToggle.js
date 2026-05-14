/**
 * Simple Role Toggle for Staff Members
 * Allows staff members to switch between their staff role and citizen view
 */
import showMessage from "../components/toast.js";
import { getCsrfToken } from "../utils/csrf.js";

// SEC-16 FIX: Helper for POST headers with CSRF
async function getMutatingHeaders() {
  const headers = { "Content-Type": "application/json" };
  try { const csrf = await getCsrfToken(); if (csrf) headers["X-CSRF-Token"] = csrf; } catch (_e) { /* proceed */ }
  return headers;
}

// Role toggle script loaded
// Simple role detection - all non-citizen roles
const _STAFF_ROLES = [
  "lgu",
  "super-admin",
];
// Cache for role info
let roleInfoCache = null;
let roleInfoCacheTime = 0;
const ROLE_INFO_CACHE_DURATION = 30000; // 30 seconds
let isInitialized = false;
/**
 * Check if current user is a staff member
 */
async function _isStaffMember() {
  try {
    // Check if user is staff member
    const response = await fetch("/api/user/role-info", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const result = await response.json();
    if (!result.success) {
      return false;
    }
    const userRole = result.data.role;
    const baseRole = result.data.base_role || result.data.actual_role;
    const isStaff =
      userRole !== "citizen" || (userRole === "citizen" && baseRole);
    return isStaff;
  } catch (error) {
    console.error("[ROLE_TOGGLE] Error checking staff status:", error);
    return false;
  }
}
/**
 * Create the role toggle button
 */
function createRoleButton(currentRole = "lgu", baseRole = null) {
  // Remove existing button if any
  const existingBtn = document.getElementById("role-toggle-btn");
  if (existingBtn) {
    existingBtn.remove();
  }
  // Determine button text and action based on current role
  const isInCitizenMode = currentRole === "citizen";
  const targetRole = isInCitizenMode ? baseRole || "lgu" : "citizen";

  // Create button content
  let buttonLabel;
  if (isInCitizenMode) {
    if (baseRole && baseRole !== "citizen") {
      const roleName = baseRole.toUpperCase();
      buttonLabel = `Switch to ${roleName} View`;
    } else {
      buttonLabel = "Switch to Staff View";
    }
  } else {
    buttonLabel = "Switch to Citizen View";
  }

  // Create new button
  const button = document.createElement("button");
  button.id = "role-toggle-btn";
  button.className = `role-toggle-btn ${
    isInCitizenMode ? "btn-citizen-mode" : "btn-staff-mode"
  }`;

  // Use spans for responsive hiding
    const icon = isInCitizenMode ? 
      `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/></svg>` : 
      `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>`;

  button.innerHTML = `
    <span class="role-icon">${icon}</span>
    <span class="role-text">${buttonLabel}</span>
  `;

  // Add click handler
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.innerHTML = `<span class="role-icon animate-spin">⏳</span><span class="role-text">Switching...</span>`;
    await switchRole(targetRole);
  });

  return button;
}
/**
 * Switch role (citizen or staff)
 */
async function switchRole(targetRole) {
  try {
    // Switch to target role
    // Get current role info to determine previous role
    const roleResponse = await fetch("/api/user/role-info", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const roleResult = await roleResponse.json();
    const currentRole = roleResult.data?.role || "citizen";
    const response = await fetch("/api/user/switch-role", {
      method: "POST",
      credentials: "include",
      headers: await getMutatingHeaders(),
      body: JSON.stringify({
        targetRole,
        previousRole: currentRole,
      }),
    });
    const result = await response.json();
    if (result.success) {
      window.location.reload();
    } else {
      showMessage("error", result.message || "Unknown error");
    }
  } catch (error) {
    console.error("[ROLE_TOGGLE] Error switching role:", error);
    showMessage("error", error.message || "Error switching role");
  }
}
/**
 * Add button to header
 */
function addButtonToHeader(currentRole = "lgu", baseRole = null) {
  // 1. Try to find the consolidated container in the header template
  const container = document.getElementById("role-switcher-container");
  if (container) {
    container.style.display = "block";
    container.innerHTML = ""; // Clear existing
    const button = createRoleButton(currentRole, baseRole);
    container.appendChild(button);
    return true;
  }

  // 2. Fallback to finding header right section (legacy support)
  let headerRight = document.querySelector(".header-right");
  if (!headerRight) {
    const header = document.querySelector(".header") || document.querySelector("header");
    if (header) {
      const rightSection = document.createElement("div");
      rightSection.className = "header-right";
      rightSection.style.cssText = "display: flex; align-items: center; gap: 10px;";
      header.appendChild(rightSection);
      headerRight = rightSection;
    } else {
      return false;
    }
  }
  
  const button = createRoleButton(currentRole, baseRole);
  const themeToggle = headerRight.querySelector("#theme-toggle") || headerRight.querySelector(".theme-btn");
  if (themeToggle) {
    headerRight.insertBefore(button, themeToggle);
  } else {
    headerRight.insertBefore(button, headerRight.firstChild);
  }

  return true;
}
/**
 * Initialize role toggle
 */

export async function initializeRoleToggle() {
  if (isInitialized) {
    return;
  }
  isInitialized = true;
  try {
    // Check if user has a session before making API call
    const { supabase } = await import("../config/config.js");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      // No session, stop silently
      isInitialized = false;
      return;
    }

    // Get user role info
    const response = await fetch("/api/user/role-info", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      // Handle 401 gracefully - user not authenticated
      if (response.status === 401) {
        isInitialized = false;
        return;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      isInitialized = false;
      return;
    }
    const userRole = result.data.role;
    const baseRole = result.data.base_role || result.data.actual_role;
    const _isInCitizenMode = userRole === "citizen";
    const _isStaff = userRole !== "citizen"; // Any role that is not citizen is considered staff
    // Hide role switcher for pure citizens (base_role is 'citizen')
    if (userRole === "citizen" && (!baseRole || baseRole === "citizen")) {
      return;
    }
    // Add button to header with current role and base role
    addButtonToHeader(userRole, baseRole);
  } catch (error) {
    // Silently handle errors - don't spam console with expected 401 errors
    if (error.message && !error.message.includes("401")) {
      console.error("[ROLE_TOGGLE] Error initializing role toggle:", error);
    }
    isInitialized = false;
  }
}
/**
 * Check if user can switch to citizen mode
 */

export async function canSwitchToCitizen() {
  try {
    // Check cache first
    const now = Date.now();
    if (roleInfoCache && now - roleInfoCacheTime < ROLE_INFO_CACHE_DURATION) {
      const baseRole = roleInfoCache.data.base_role;
      return baseRole && baseRole !== "citizen";
    }
    const response = await fetch("/api/user/role-info", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const result = await response.json();
    if (!result.success) {
      return false;
    }
    // Cache the result
    roleInfoCache = result;
    roleInfoCacheTime = now;
    const baseRole = result.data.base_role;
    return baseRole && baseRole !== "citizen";
  } catch (error) {
    console.error("[ROLE_TOGGLE] Error checking citizen switch:", error);
    return false;
  }
}
/**
 * Get active role
 */

export async function getActiveRole() {
  try {
    // Check cache first
    const now = Date.now();
    if (roleInfoCache && now - roleInfoCacheTime < ROLE_INFO_CACHE_DURATION) {
      return roleInfoCache.data.role;
    }
    const response = await fetch("/api/user/role-info", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const result = await response.json();
    if (!result.success) {
      return "citizen";
    }
    // Cache the result
    roleInfoCache = result;
    roleInfoCacheTime = now;
    return result.data.role;
  } catch (error) {
    console.error("[ROLE_TOGGLE] Error getting active role:", error);
    return "citizen";
  }
}
/**
 * Check if user is in citizen mode
 */

export async function isInCitizenMode() {
  try {
    const activeRole = await getActiveRole();
    return activeRole === "citizen";
  } catch (error) {
    console.error("[ROLE_TOGGLE] Error checking citizen mode:", error);
    return true;
  }
}
/**
 * Switch to citizen mode
 */

export async function switchToCitizenMode() {
  try {
    const response = await fetch("/api/user/switch-role", {
      method: "POST",
      credentials: "include",
      headers: await getMutatingHeaders(),
      body: JSON.stringify({
        targetRole: "citizen",
      }),
    });
    const result = await response.json();
    if (result.success) {
      window.location.reload();
    } else {
      console.error("Failed to switch to citizen mode:", result.message);
    }
  } catch (error) {
    console.error("[ROLE_TOGGLE] Error switching to citizen mode:", error);
  }
}
/**
 * Switch to actual role
 */

export async function switchToActualRole() {
  try {
    // Get current role info to determine actual role
    const roleResponse = await fetch("/api/user/role-info", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const roleResult = await roleResponse.json();
    const actualRole =
      roleResult.data?.base_role || roleResult.data?.actual_role || "lgu";
    const response = await fetch("/api/user/switch-role", {
      method: "POST",
      credentials: "include",
      headers: await getMutatingHeaders(),
      body: JSON.stringify({
        targetRole: actualRole,
      }),
    });
    const result = await response.json();
    if (result.success) {
      window.location.reload();
    } else {
      console.error("Failed to switch to actual role:", result.message);
    }
  } catch (error) {
    console.error("[ROLE_TOGGLE] Error switching to actual role:", error);
  }
}
/**
 * Get actual role (base role)
 */

export async function getActualRole() {
  try {
    // Check cache first
    const now = Date.now();
    if (roleInfoCache && now - roleInfoCacheTime < ROLE_INFO_CACHE_DURATION) {
      return roleInfoCache.data.base_role || roleInfoCache.data.actual_role;
    }
    const response = await fetch("/api/user/role-info", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const result = await response.json();
    if (!result.success) {
      return null;
    }
    // Cache the result
    roleInfoCache = result;
    roleInfoCacheTime = now;
    return result.data.base_role || result.data.actual_role;
  } catch (error) {
    console.error("[ROLE_TOGGLE] Error getting actual role:", error);
    return null;
  }
}
// Auto-initialization removed - now handled by header.js for consolidation
// Default export

export default {
  canSwitchToCitizen,
  getActiveRole,
  switchToCitizenMode,
  switchToActualRole,
  isInCitizenMode,
  getActualRole,
  initializeRoleToggle,
};
