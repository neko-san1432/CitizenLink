/**
 * Role normalization utilities for client-side
 * 3-role system: citizen, lgu, super-admin
 * Legacy roles are normalized to 'lgu' for backward compatibility
 */

/**
 * Normalize role to simplified 3-role form
 * @param {string} role - User role to normalize
 * @returns {string} Normalized role: "citizen" | "lgu" | "super-admin"
 */
function normalizeRole(role) {
  if (!role || typeof role !== "string") return "citizen";

  const roleLower = role.toLowerCase().trim();

  // Standard roles
  if (roleLower === "citizen") return "citizen";
  if (roleLower === "super-admin") return "super-admin";

  // All LGU variants normalize to 'lgu'
  // Covers: lgu, lgu-admin, lgu-hr, lgu-officer, complaint-coordinator,
  //         lgu-admin-{dept}, lgu-hr-{dept}, etc.
  if (
    roleLower === "lgu" ||
    roleLower === "complaint-coordinator" ||
    roleLower.startsWith("lgu-")
  ) {
    return "lgu";
  }

  // Default: citizen
  return "citizen";
}

export { normalizeRole };
