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
  const department = departments.find(dept => dept.code === code);
  return department ? department.name : code;
}

/**
 * Get department name by ID or code (handles both numeric IDs and codes)
 */
export async function getDepartmentNameByIdOrCode(idOrCode) {
  const departments = await getDepartments();
  // Try to find by ID (if numeric) or by code
  const department = departments.find(dept =>
    String(dept.id) === String(idOrCode) || dept.code === idOrCode
  );
  return department ? department.name : (typeof idOrCode === 'number' ? `Department ${idOrCode}` : idOrCode);
}

/**
 * Get all departments as a simple array (for dropdowns, etc.)
 * Uses /api/departments/active endpoint for better performance
 */
let activeDepartmentsCache = null;
let activeDepartmentsCacheTimestamp = null;

export async function getActiveDepartments() {
  const now = Date.now();
  // Return cached data if still valid
  if (activeDepartmentsCache && activeDepartmentsCacheTimestamp && (now - activeDepartmentsCacheTimestamp) < CACHE_DURATION) {
    return activeDepartmentsCache;
  }
  try {
    const response = await fetch('/api/departments/active');
    const result = await response.json();
    if (result.success && result.data) {
      activeDepartmentsCache = result.data;
      activeDepartmentsCacheTimestamp = now;
      return result.data;
    }
    return [];
  } catch (error) {
    console.error('Error fetching active departments:', error);
    return [];
  }
}