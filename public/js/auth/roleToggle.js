/**
 * Simple Role Toggle for Staff Members
 * Allows staff members to switch between their staff role and citizen view
 */
// Role toggle script loaded
// Simple role detection - all roles except citizen
const STAFF_ROLES = ['lgu', 'lgu-admin', 'lgu-hr', 'coordinator', 'hr', 'super-admin', 'admin'];
// Cache for role info
let roleInfoCache = null;
let roleInfoCacheTime = 0;
const ROLE_INFO_CACHE_DURATION = 30000; // 30 seconds
let isInitialized = false;
/**
 * Check if current user is a staff member
 */
async function isStaffMember() {
  try {
    // Check if user is staff member
    const response = await fetch('/api/user/role-info', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    if (!result.success) {
      return false;
    }
    const userRole = result.data.role;
    const baseRole = result.data.base_role || result.data.actual_role;
    const isStaff = userRole !== 'citizen' || (userRole === 'citizen' && baseRole);
    return isStaff;
  } catch (error) {
    console.error('[ROLE_TOGGLE] Error checking staff status:', error);
    return false;
  }
}
/**
 * Create the role toggle button
 */
function createRoleButton(currentRole = 'lgu', baseRole = null) {
  // Remove existing button if any
  const existingBtn = document.getElementById('role-toggle-btn');
  if (existingBtn) {
    existingBtn.remove();
  }
  // Determine button text and action based on current role
  const isInCitizenMode = currentRole === 'citizen';
  const targetRole = isInCitizenMode ? (baseRole || 'lgu') : 'citizen';
  // Create more descriptive button text
  let buttonText;
  if (isInCitizenMode) {

    if (baseRole && baseRole !== 'citizen') {
      const roleName = baseRole.toUpperCase();
      buttonText = `👤 Switch to ${roleName} View`;
    } else {
      // Pure citizen - show a generic staff switch option
      buttonText = '👤 Switch to Staff View';
    }
  } else {
    buttonText = '👤 Switch to Citizen View';
  }
  // Create new button
  const button = document.createElement('button');
  button.id = 'role-toggle-btn';
  button.className = 'role-toggle-btn';
  button.innerHTML = buttonText;
  button.style.cssText = `
    background: ${isInCitizenMode ? '#28a745' : '#007bff'};
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    margin-left: 10px;
    transition: background-color 0.2s;
  `;
  // Add hover effect
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = isInCitizenMode ? '#218838' : '#0056b3';
  });
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = isInCitizenMode ? '#28a745' : '#007bff';
  });
  // Add click handler
  button.addEventListener('click', async () => {
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
    const roleResponse = await fetch('/api/user/role-info', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    const roleResult = await roleResponse.json();
    const currentRole = roleResult.data?.role || 'citizen';
    const response = await fetch('/api/user/switch-role', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetRole: targetRole,
        previousRole: currentRole
      })
    });
    const result = await response.json();
    if (result.success) {
      window.location.reload();
    } else {
      alert('Failed to switch role: ' + (result.message || 'Unknown error'));
    }
  } catch (error) {
    console.error('[ROLE_TOGGLE] Error switching role:', error);
    alert('Error switching role: ' + error.message);
  }
}
/**
 * Add button to header
 */
function addButtonToHeader(currentRole = 'lgu', baseRole = null) {

  // Find header right section
  let headerRight = document.querySelector('.header-right');
  if (!headerRight) {
    // Try alternative selectors
    const header = document.querySelector('.header') || document.querySelector('header');
    if (header) {
      const rightSection = document.createElement('div');
      rightSection.className = 'header-right';
      rightSection.style.cssText = 'display: flex; align-items: center; gap: 10px;';
      header.appendChild(rightSection);
      headerRight = rightSection;
    } else {
    return false;
  }
}
  // Create and add button with current role and base role
  const button = createRoleButton(currentRole, baseRole);
  headerRight.appendChild(button);
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
    // Get user role info
      const response = await fetch('/api/user/role-info', {
        credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    if (!result.success) {
      return;
    }
    const userRole = result.data.role;
    const baseRole = result.data.base_role || result.data.actual_role;
    const isInCitizenMode = userRole === 'citizen';
    const isStaff = userRole !== 'citizen'; // Any role that is not citizen is considered staff
    // Hide role switcher for pure citizens (base_role is 'citizen')
    if (userRole === 'citizen' && (!baseRole || baseRole === 'citizen')) {
      return;
    }
    // Add button to header with current role and base role
    addButtonToHeader(userRole, baseRole);
  } catch (error) {
    console.error('[ROLE_TOGGLE] Error initializing role toggle:', error);
  }
}
/**
 * Check if user can switch to citizen mode
 */

export async function canSwitchToCitizen() {
  try {
    // Check cache first
    const now = Date.now();
    if (roleInfoCache && (now - roleInfoCacheTime) < ROLE_INFO_CACHE_DURATION) {
      const baseRole = roleInfoCache.data.base_role;
      return baseRole && baseRole !== 'citizen';
    }
      const response = await fetch('/api/user/role-info', {
        credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    if (!result.success) {
      return false;
    }
      // Cache the result
      roleInfoCache = result;
      roleInfoCacheTime = now;
    const baseRole = result.data.base_role;
    return baseRole && baseRole !== 'citizen';
  } catch (error) {
    console.error('[ROLE_TOGGLE] Error checking citizen switch:', error);
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
    if (roleInfoCache && (now - roleInfoCacheTime) < ROLE_INFO_CACHE_DURATION) {
      return roleInfoCache.data.role;
    }
    const response = await fetch('/api/user/role-info', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    if (!result.success) {
      return 'citizen';
    }
    // Cache the result
    roleInfoCache = result;
    roleInfoCacheTime = now;
    return result.data.role;
  } catch (error) {
    console.error('[ROLE_TOGGLE] Error getting active role:', error);
    return 'citizen';
  }
}
/**
 * Check if user is in citizen mode
 */

export async function isInCitizenMode() {
  try {
    const activeRole = await getActiveRole();
    return activeRole === 'citizen';
  } catch (error) {
    console.error('[ROLE_TOGGLE] Error checking citizen mode:', error);
    return true;
  }
}
/**
 * Switch to citizen mode
 */

export async function switchToCitizenMode() {
  try {
    const response = await fetch('/api/user/switch-role', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetRole: 'citizen'
      })
    });
    const result = await response.json();
    if (result.success) {
      window.location.reload();
  } else {
      console.error('Failed to switch to citizen mode:', result.message);
    }
  } catch (error) {
    console.error('[ROLE_TOGGLE] Error switching to citizen mode:', error);
  }
}
/**
 * Switch to actual role
 */

export async function switchToActualRole() {
  try {
    // Get current role info to determine actual role
    const roleResponse = await fetch('/api/user/role-info', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    const roleResult = await roleResponse.json();
    const actualRole = roleResult.data?.base_role || roleResult.data?.actual_role || 'lgu';
    const response = await fetch('/api/user/switch-role', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetRole: actualRole
      })
    });
    const result = await response.json();
    if (result.success) {
      window.location.reload();
    } else {
      console.error('Failed to switch to actual role:', result.message);
    }
  } catch (error) {
    console.error('[ROLE_TOGGLE] Error switching to actual role:', error);
  }
}
/**
 * Get actual role (base role)
 */

export async function getActualRole() {
  try {
    // Check cache first
    const now = Date.now();
    if (roleInfoCache && (now - roleInfoCacheTime) < ROLE_INFO_CACHE_DURATION) {
      return roleInfoCache.data.base_role || roleInfoCache.data.actual_role;
    }
    const response = await fetch('/api/user/role-info', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
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
    console.error('[ROLE_TOGGLE] Error getting actual role:', error);
    return null;
  }
}
// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeRoleToggle);
} else {
    initializeRoleToggle();
}
// Default export

export default {
  canSwitchToCitizen,
  getActiveRole,
  switchToCitizenMode,
  switchToActualRole,
  isInCitizenMode,
  getActualRole,
  initializeRoleToggle
};
