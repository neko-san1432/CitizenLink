/**
 * Server-side Department Mapping Utilities
 * Provides dynamic department mapping for server-side services
 */
const Database = require('../config/database');

const db = new Database();
const supabase = db.getClient();
// Cache for department data
let departmentCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
/**
 * Get all departments with their codes and names
 */
async function getDepartments() {
  const now = Date.now();
  // Return cached data if still valid
  if (departmentCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return departmentCache;
  }
  try {
    const { data, error } = await supabase
      .from('departments')
      .select(`
        id,
        name,
        code,
        level
      `)
      .eq('is_active', true);
    if (error) {
      console.error('[DEPARTMENT_MAPPING] Database error:', error);
      throw error;
    }
    // console.log removed for security
    // Process the departments data directly
    const departments = [];
    if (data) {
      data.forEach(dept => {
        departments.push({
          id: dept.id,
          code: dept.code,
          name: dept.name,
          level: dept.level
        });
      });
    }
    // console.log removed for security
    // Cache the result
    departmentCache = departments;
    cacheTimestamp = now;
    return departments;
  } catch (error) {
    console.error('Error fetching departments:', error);
    // Return empty array on error
    return [];
  }
}
/**
 * Get department name by code
 */
async function getDepartmentNameByCode(code) {
  const departments = await getDepartments();
  const dept = departments.find(d => d.code === code);
  return dept ? dept.name : code;
}
/**
 * Get department code by name (case insensitive)
 */
async function getDepartmentCodeByName(name) {
  const departments = await getDepartments();
  const dept = departments.find(d =>
    d.name.toLowerCase() === name.toLowerCase() ||
    d.code.toLowerCase() === name.toLowerCase()
  );
  return dept ? dept.code : name;
}
/**
 * Get departments by category
 */
async function getDepartmentsByCategory(categoryName) {
  const departments = await getDepartments();
  return departments.filter(d => d.category === categoryName);
}
/**
 * Get departments by subcategory
 */
async function getDepartmentsBySubcategory(subcategoryName) {
  const departments = await getDepartments();
  return departments.filter(d => d.subcategory === subcategoryName);
}
/**
 * Get legacy department name mapping (for backward compatibility)
 */
async function getLegacyDepartmentMapping() {
  const departments = await getDepartments();
  const mapping = {};
  departments.forEach(dept => {
    // Map common legacy codes to new names
    const legacyCode = dept.code.toLowerCase();
    // Validate input to prevent object injection
    if (legacyCode && typeof legacyCode === 'string' && legacyCode.length < 100) {
      // eslint-disable-next-line security/detect-object-injection
      mapping[legacyCode] = dept.name;
    }
    // Also map by partial name matching for common patterns
    if (legacyCode.includes('wst') || dept.name.toLowerCase().includes('water')) {
      mapping['wst'] = dept.name;
    }
    if (legacyCode.includes('eng') || dept.name.toLowerCase().includes('engineering')) {
      mapping['engineering'] = dept.name;
    }
    if (legacyCode.includes('health') || dept.name.toLowerCase().includes('health')) {
      mapping['health'] = dept.name;
    }
    if (legacyCode.includes('social') || dept.name.toLowerCase().includes('social')) {
      mapping['social-welfare'] = dept.name;
    }
    if (legacyCode.includes('safety') || dept.name.toLowerCase().includes('safety')) {
      mapping['public-safety'] = dept.name;
    }
    if (legacyCode.includes('env') || dept.name.toLowerCase().includes('environment')) {
      mapping['environmental'] = dept.name;
    }
    if (legacyCode.includes('transport') || dept.name.toLowerCase().includes('transport')) {
      mapping['transportation'] = dept.name;
    }
    if (legacyCode.includes('works') || dept.name.toLowerCase().includes('works')) {
      mapping['public-works'] = dept.name;
    }
  });
  return mapping;
}
/**
 * Get dynamic category to department mapping
 */
async function getCategoryToDepartmentMapping() {
  const departments = await getDepartments();
  const mapping = {};
  // Group departments by category
  departments.forEach(dept => {
    if (!mapping[dept.category]) {
      mapping[dept.category] = [];
    }
    mapping[dept.category].push(dept.code);
  });
  return mapping;
}
/**
 * Get dynamic keyword-based department suggestions
 */
async function getKeywordBasedSuggestions() {
  const departments = await getDepartments();
  const suggestions = [];
  // Create keyword rules based on actual department names and codes
  departments.forEach(dept => {
    const keywords = [];
    // Add department name keywords
    const nameWords = dept.name.toLowerCase().split(/\s+/);
    keywords.push(...nameWords);
    // Add department code keywords
    keywords.push(dept.code.toLowerCase());
    // Add category-based keywords
    if (dept.category) {
      const categoryWords = dept.category.toLowerCase().split(/\s+/);
      keywords.push(...categoryWords);
    }
    // Add subcategory-based keywords
    if (dept.subcategory) {
      const subcategoryWords = dept.subcategory.toLowerCase().split(/\s+/);
      keywords.push(...subcategoryWords);
    }
    // Create regex patterns for common keywords
    keywords.forEach(keyword => {
      if (keyword.length > 2 && keyword.length < 50) { // Only meaningful keywords with length limit
        // Escape special regex characters to prevent ReDoS
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Use a whitelist approach: only create regex for safe keywords
        // eslint-disable-next-line security/detect-non-literal-regexp
        const pattern = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
        suggestions.push({
          pattern,
          departments: [dept.code],
          reason: `keyword: ${keyword}`
        });
      }
    });
  });
  return suggestions;
}
/**
 * Clear the department cache (useful for testing or when data changes)
 */
function clearDepartmentCache() {
  departmentCache = null;
  cacheTimestamp = null;
}

module.exports = {
  getDepartments,
  getDepartmentNameByCode,
  getDepartmentCodeByName,
  getDepartmentsByCategory,
  getDepartmentsBySubcategory,
  getLegacyDepartmentMapping,
  getCategoryToDepartmentMapping,
  getKeywordBasedSuggestions,
  clearDepartmentCache,
  /**
   * Check if a single department code exists (case-sensitive by code)
   * @param {string} code
   * @returns {Promise<boolean>}
   */
  async isValidDepartmentCode(code) {
    if (!code) return false;
    const departments = await getDepartments();
    return departments.some(d => d.code === code);
  },
  /**
   * Validate a list of department codes. Returns { validCodes, invalidCodes }
   * @param {string[]} codes
   * @returns {Promise<{validCodes: string[], invalidCodes: string[]}>}
   */
  async validateDepartmentCodes(codes) {
    const input = Array.from(new Set((codes || []).filter(Boolean)));
    if (input.length === 0) return { validCodes: [], invalidCodes: [] };
    const departments = await getDepartments();
    // Debug logging
    // console.log removed for security
    // console.log removed for security
    // If no departments found in database, return empty valid codes
    // This ensures we only validate against actual database records
    const validSet = new Set(departments.map(d => d.code));
    if (validSet.size === 0) {
      // console.log removed for security
      // No departments in database - return all as invalid to prompt database setup
      return { validCodes: [], invalidCodes: input };
    }
    const validCodes = [];
    const invalidCodes = [];
    for (const c of input) {
      if (validSet.has(c)) validCodes.push(c); else invalidCodes.push(c);
    }
    // console.log removed for security
    // console.log removed for security
    return { validCodes, invalidCodes };
  }
};
