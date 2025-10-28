/**
 * Role Validation Utilities
 * Validates user roles against department codes from database
 */

const Database = require('../config/database');
const db = new Database();
const supabase = db.getClient();

// Cache for department codes
let departmentCodesCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get all valid department codes from database
 */
async function getValidDepartmentCodes() {
  const now = Date.now();

  // Return cached data if still valid
  if (departmentCodesCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return departmentCodesCache;
  }

  try {
    const { data, error } = await supabase
      .from('departments')
      .select('code, name, is_active')
      .eq('is_active', true);

    if (error) throw error;

    const codes = data ? data.map(dept => dept.code) : [];

    // Cache the result
    departmentCodesCache = codes;
    cacheTimestamp = now;

    return codes;
  } catch (error) {
    console.error('Error fetching department codes:', error);
    // Return empty array on error
    return [];
  }
}

/**
 * Validate if a department code exists and is active
 * @param {string} code - Department code to validate
 * @returns {Promise<boolean>} True if valid
 */
async function isValidDepartmentCode(code) {
  if (!code || typeof code !== 'string') return false;

  const validCodes = await getValidDepartmentCodes();
  return validCodes.includes(code.toUpperCase());
}

/**
 * Validate user role format and department code
 * @param {string} role - User role to validate
 * @returns {Promise<{isValid: boolean, roleType: string|null, departmentCode: string|null, error: string|null}>}
 */
async function validateUserRole(role) {
  if (!role || typeof role !== 'string') {
    return {
      isValid: false,
      roleType: null,
      departmentCode: null,
      error: 'Role is required and must be a string'
    };
  }

  const roleLower = role.toLowerCase().trim();

  // Check for valid role patterns
  let roleType = null;
  let departmentCode = null;

  // Simplified LGU roles
  if (roleLower === 'lgu-admin') {
    roleType = 'lgu-admin';
    departmentCode = null; // Department stored separately in metadata
  }
  else if (roleLower === 'lgu-hr') {
    roleType = 'lgu-hr';
    departmentCode = null; // Department stored separately in metadata
  }
  else if (roleLower === 'lgu') {
    roleType = 'lgu-officer';
    departmentCode = null; // Department stored separately in metadata
  }
  // Other valid roles (citizen, complaint-coordinator, super-admin)
  else if (['citizen', 'complaint-coordinator', 'super-admin'].includes(roleLower)) {
    return {
      isValid: true,
      roleType: roleLower,
      departmentCode: null,
      error: null
    };
  }
  else {
    return {
      isValid: false,
      roleType: null,
      departmentCode: null,
      error: 'Invalid role format. Must be lgu-admin-{dept}, lgu-hr-{dept}, lgu-{dept}, or system role'
    };
  }

  // Validate department code for LGU roles
  if (departmentCode) {
    const isValidDept = await isValidDepartmentCode(departmentCode);
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
 * Extract department code from role
 * @param {string} role - User role
 * @returns {string|null} Department code or null
 */
function extractDepartmentCode(role) {
  if (!role || typeof role !== 'string') return null;

  const roleLower = role.toLowerCase().trim();

  // With simplified roles, department is stored separately in metadata
  // This function now returns null as department is not extracted from role
  return null;
}

/**
 * Get department info by code
 * @param {string} code - Department code
 * @returns {Promise<Object|null>} Department info or null
 */
async function getDepartmentByCode(code) {
  if (!code) return null;

  try {
    const { data, error } = await supabase
      .from('departments')
      .select('id, name, code, description, level, is_active')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching department by code:', error);
    return null;
  }
}

/**
 * Clear the department codes cache
 */
function clearDepartmentCodesCache() {
  departmentCodesCache = null;
  cacheTimestamp = null;
}

/**
 * Get all valid department codes with names
 * @returns {Promise<Array>} Array of {code, name} objects
 */
async function getValidDepartments() {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('code, name, level')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching valid departments:', error);
    return [];
  }
}

module.exports = {
  getValidDepartmentCodes,
  isValidDepartmentCode,
  validateUserRole,
  extractDepartmentCode,
  getDepartmentByCode,
  clearDepartmentCodesCache,
  getValidDepartments
};

