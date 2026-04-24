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

  // 3-Role System Mapping
  if (roleLower === "super-admin") return "super-admin";
  if (roleLower === "citizen") return "citizen";
  
  // Legacy or complex roles map to 'lgu'
  if (
    roleLower === "lgu" || 
    roleLower.startsWith("lgu-") || 
    roleLower === "complaint-coordinator"
  ) {
    return "lgu";
  }

  return "citizen";
}

export { normalizeRole };
