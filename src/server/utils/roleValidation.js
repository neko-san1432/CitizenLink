/**
 * Role Validation Utilities
 * Validates user roles against department codes from database
 */
const Database = require("../config/database");

// Lazy initialization of Supabase client
let supabaseInstance = null;
function getSupabase() {
  if (!supabaseInstance) {
    const db = Database.getInstance();
    supabaseInstance = db.getClient();
  }
  return supabaseInstance;
}

// Cache for department codes
let departmentCodesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
/**
 * Get all valid department codes from database
 */
async function getValiddepartmentCodes() {
  const now = Date.now();
  // Return cached data if still valid
  if (departmentCodesCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return departmentCodesCache;
  }
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("departments")
      .select("code, name, is_active")
      .eq("is_active", true);
    if (error) throw error;
    const codes = data ? data.map(dept => dept.code) : [];
    // Cache the result
    departmentCodesCache = codes;
    cacheTimestamp = now;
    return codes;
  } catch (error) {
    console.error("Error fetching department codes:", error);
    // Return empty array on error
    return [];
  }
}
/**
 * Validate if a department code exists and is active
 * @param {string} code - department code to validate
 * @returns {Promise<boolean>} True if valid
 */
async function isValiddepartmentCode(code) {
  if (!code || typeof code !== "string") return false;
  const validCodes = await getValiddepartmentCodes();
  return validCodes.includes(code.toUpperCase());
}
/**
 * Validate user role format and department code
 * @param {string} role - User role to validate
 * @returns {Promise<{isValid: boolean, roleType: string|null, departmentCode: string|null, error: string|null}>}
 */
async function validateUserRole(role) {

  if (!role || typeof role !== "string") {
    return {
      isValid: false,
      roleType: null,
      departmentCode: null,
      error: "Role is required and must be a string"
    };
  }
  const roleLower = role.toLowerCase().trim();
  // Check for valid role patterns
  let roleType = null;
  let departmentCode = null;

  // Simple Workflow Mode Check
  const isSimpleMode = process.env.SIMPLE_WORKFLOW_MODE === "true";

    const allowedRoles = ["citizen", "lgu", "super-admin"];
    if (!allowedRoles.includes(roleLower)) {
      return {
        isValid: false,
        roleType: null,
        departmentCode: null,
        error: "Invalid role. Only Citizen, LGU, and Super Admin are supported."
      };
    }

    return {
      isValid: true,
      roleType: roleLower,
      departmentCode: null,
      error: null
    };

  // Validate department code for LGU roles
  if (departmentCode) {
    const isValidDept = await isValiddepartmentCode(departmentCode);
    if (!isValidDept) {
      return {
        isValid: false,
        roleType,
        departmentCode,
        error: `Invalid department code: ${departmentCode}. Must be one of the active departments.`
      };
    }
  }
  return {
    isValid: true,
    roleType,
    departmentCode,
    error: null
  };
}
/**
 * Normalize role to simplified form
 * Handles variations like:
 * - lgu-officer → lgu
 * - lgu-admin-{dept} → lgu-admin (if needed)
 * - Any role ending with -officer → base role without -officer
 * @param {string} role - User role to normalize
 * @returns {string} Normalized role
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

/**
 * Extract department code from role
 * @param {string} role - User role
 * @returns {string|null} department code or null
 */
function extractdepartmentCode(role) {
  if (!role || typeof role !== "string") return null;
  // With simplified roles, department is stored separately in metadata
  // This function now returns null as department is not extracted from role
  return null;
}
/**
 * Get department info by code
 * @param {string} code - department code
 * @returns {Promise<Object|null>} department info or null
 */
async function getdepartmentByCode(code) {
  if (!code) return null;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, code, description, level, is_active")
      .eq("code", code.toUpperCase())
      .eq("is_active", true)
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching department by code:", error);
    return null;
  }
}
/**
 * Clear the department codes cache
 */
function cleardepartmentCodesCache() {
  departmentCodesCache = null;
  cacheTimestamp = null;
}
/**
 * Get all valid department codes with names
 * @returns {Promise<Array>} Array of {code, name} objects
 */
async function getValiddepartments() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("departments")
      .select("code, name, level")
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching valid departments:", error);
    return [];
  }
}

module.exports = {
  getValiddepartmentCodes,
  isValiddepartmentCode,
  validateUserRole,
  normalizeRole,
  extractdepartmentCode,
  getdepartmentByCode,
  cleardepartmentCodesCache,
  getValiddepartments
};
