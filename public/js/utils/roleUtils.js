/**
 * Role normalization utilities for client-side
 * Matches server-side normalization logic
 */

/**
 * Normalize role to simplified form
 * Handles variations like:
 * - lgu-officer → lgu
 * - Any role ending with -officer → base role without -officer
 * @param {string} role - User role to normalize
 * @returns {string} Normalized role
 */
function normalizeRole(role) {
  if (!role || typeof role !== "string") return "citizen";

  const roleLower = role.toLowerCase().trim();

  // Standard roles that don't need normalization
  if (["citizen", "super-admin", "complaint-coordinator"].includes(roleLower)) {
    return roleLower;
  }

  // Handle simplified LGU roles
  if (roleLower === "lgu-admin") return "lgu-admin";
  if (roleLower === "lgu-hr") return "lgu-hr";
  if (roleLower === "lgu") return "lgu";

  // Normalize any role ending with -officer to base role
  // e.g., lgu-officer → lgu, anyrole-officer → anyrole
  if (roleLower.endsWith("-officer")) {
    const baseRole = roleLower.replace(/-officer$/, "");
    // If base role is valid, return it; otherwise keep original
    if (["lgu", "lgu-admin", "lgu-hr"].includes(baseRole)) {
      return baseRole;
    }
    // For other roles ending in -officer, remove the suffix
    return baseRole || "citizen";
  }

  // Default: return as-is or citizen
  return roleLower || "citizen";
}

export { normalizeRole };
