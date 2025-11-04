/**
 * Department Utilities
 * Provides dynamic department name mapping and lookup functions
 */

import apiClient from '../config/apiClient.js';

// Cache for department data
let departmentCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get all departments with their codes and names
 */
export async function getDepartments() {
  const now = Date.now();

  // Return cached data if still valid
  if (departmentCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return departmentCache;
  }

  try {
    const { data, error } = await apiClient.get('/api/department-structure/categories');
    if (error) throw error;

    // Flatten the hierarchical structure into a simple array
    const departments = [];

    if (data) {
      data.forEach(category => {
        if (category.subcategories) {
          category.subcategories.forEach(subcategory => {
            if (subcategory.departments) {
              subcategory.departments.forEach(dept => {
                departments.push({
                  id: dept.id,
                  code: dept.code,
                  name: dept.name,
                  level: dept.level,
                  subcategory: subcategory.name,
                  category: category.name
                });
              });
            }
          });
        }
      });
    }

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
export async function getDepartmentNameByCode(code) {
  const departments = await getDepartments();
  const dept = departments.find(d => d.code === code);
  return dept ? dept.name : code;
}

/**
 * Get department code by name (case insensitive)
 */
export async function getDepartmentCodeByName(name) {
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
export async function getDepartmentsByCategory(categoryName) {
  const departments = await getDepartments();
  return departments.filter(d => d.category === categoryName);
}

/**
 * Get departments by subcategory
 */
export async function getDepartmentsBySubcategory(subcategoryName) {
  const departments = await getDepartments();
  return departments.filter(d => d.subcategory === subcategoryName);
}

/**
 * Get legacy department name mapping (for backward compatibility)
 */
export async function getLegacyDepartmentMapping() {
  const departments = await getDepartments();
  const mapping = {};

  departments.forEach(dept => {
    // Map common legacy codes to new names
    const legacyCode = dept.code.toLowerCase();
    mapping[legacyCode] = dept.name;

    // Also map by partial name matching for common patterns - Updated for new department codes
    if (legacyCode.includes('ceo') || dept.name.toLowerCase().includes('engineering')) {
      mapping['ceo'] = dept.name;
    }
    if (legacyCode.includes('gso') || dept.name.toLowerCase().includes('general services')) {
      mapping['gso'] = dept.name;
    }
    if (legacyCode.includes('cpdc') || dept.name.toLowerCase().includes('planning')) {
      mapping['cpdc'] = dept.name;
    }
    if (legacyCode.includes('cho') || dept.name.toLowerCase().includes('health')) {
      mapping['cho'] = dept.name;
    }
    if (legacyCode.includes('cswdo') || dept.name.toLowerCase().includes('social welfare')) {
      mapping['cswdo'] = dept.name;
    }
    if (legacyCode.includes('cdrrmo') || dept.name.toLowerCase().includes('disaster')) {
      mapping['cdrrmo'] = dept.name;
    }
    if (legacyCode.includes('enro') || dept.name.toLowerCase().includes('environment')) {
      mapping['enro'] = dept.name;
    }
    if (legacyCode.includes('cto') || dept.name.toLowerCase().includes('treasurer')) {
      mapping['cto'] = dept.name;
    }
    if (legacyCode.includes('ceeo') || dept.name.toLowerCase().includes('economic enterprise')) {
      mapping['ceeo'] = dept.name;
    }
    if (legacyCode.includes('hrmo') || dept.name.toLowerCase().includes('human resource')) {
      mapping['hrmo'] = dept.name;
    }
    if (legacyCode.includes('pnp') || dept.name.toLowerCase().includes('police')) {
      mapping['pnp'] = dept.name;
    }
    if (legacyCode.includes('clo') || dept.name.toLowerCase().includes('legal')) {
      mapping['clo'] = dept.name;
    }
    if (legacyCode.includes('ocm') || dept.name.toLowerCase().includes('mayor')) {
      mapping['ocm'] = dept.name;
    }
    if (legacyCode.includes('pad') || dept.name.toLowerCase().includes('assistance desk')) {
      mapping['pad'] = dept.name;
    }
    if (legacyCode.includes('oca') || dept.name.toLowerCase().includes('administrator')) {
      mapping['oca'] = dept.name;
    }
    if (legacyCode.includes('cio') || dept.name.toLowerCase().includes('information')) {
      mapping['cio'] = dept.name;
    }
    if (legacyCode.includes('cao') || dept.name.toLowerCase().includes('accountant')) {
      mapping['cao'] = dept.name;
    }
  });

  return mapping;
}

/**
 * Clear the department cache (useful for testing or when data changes)
 */
export function clearDepartmentCache() {
  departmentCache = null;
  cacheTimestamp = null;
}
