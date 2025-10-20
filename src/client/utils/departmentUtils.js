/**
 * Department Utilities
 * Provides dynamic department name mapping and lookup functions
 */

import { apiClient } from '../config/apiClient.js';

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
 * Clear the department cache (useful for testing or when data changes)
 */
export function clearDepartmentCache() {
  departmentCache = null;
  cacheTimestamp = null;
}
