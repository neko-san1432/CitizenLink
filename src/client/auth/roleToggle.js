/**
 * Role Toggle System
 * Allows staff roles to switch to citizen mode temporarily
 */

console.log('[ROLE_TOGGLE] Script loaded successfully');

// Test: Add a simple alert to see if script is running
console.log('[ROLE_TOGGLE] Testing basic functionality...');
alert('Role toggle script is running!');

import { supabase } from '../config/config.js';
import { getUserRole, saveUserMeta } from './authChecker.js';
import showMessage from '../components/toast.js';

// Local storage keys
const ROLE_MODE_KEY = 'cl_role_mode';
const ACTUAL_ROLE_KEY = 'cl_actual_role';

// Roles that can switch
const SWITCHABLE_ROLES = [
  'complaint-coordinator',
  'lgu',           // LGU Officers
  'lgu-admin',      // LGU Admins  
  'lgu-hr',         // LGU HR
  'super-admin'
];

// Cache for role info API calls
let roleInfoCache = null;
let roleInfoCacheTime = 0;
const ROLE_INFO_CACHE_DURATION = 5000; // 5 seconds cache

// Prevent multiple initializations
let isInitialized = false;

/**
 * Check if current user can switch to citizen mode
 * Logic: Check the actual_role (not current role) to determine if user is staff
 * If actual_role is a staff role → show toggle button
 * If actual_role is citizen or doesn't exist → hide button
 */
export async function canSwitchToCitizen() {
  try {
    // Check cache first
    const now = Date.now();
    if (roleInfoCache && (now - roleInfoCacheTime) < ROLE_INFO_CACHE_DURATION) {
      // console.log removed for security
      const baseRole = roleInfoCache.data.base_role;
      const currentRole = roleInfoCache.data.role;

      // If no base_role exists, user is a real citizen
      if (!baseRole) {
        // console.log removed for security
        return false;
      }

      // Check if base_role is a switchable staff role
      const canSwitch = SWITCHABLE_ROLES.includes(baseRole);

      return canSwitch;
    }

    // Get role info from API - we need base_role to determine if user is really staff
    const response = await fetch('/api/user/role-info', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const result = await response.json();

    if (!result.success) {
      console.error('[ROLE_TOGGLE] Failed to get role info:', result);
      return false;
    }

    // Cache the result
    roleInfoCache = result;
    roleInfoCacheTime = now;

    // IMPORTANT: Check base_role, not current role
    // base_role tells us what the user's real role is
    // If they're in citizen mode, base_role will still be their staff role
    const baseRole = result.data.base_role;
    const currentRole = result.data.role;

    // If no base_role exists, user is a real citizen
    if (!baseRole) {
      // console.log removed for security
      return false;
    }

    // Check if base_role is a switchable staff role
    const canSwitch = SWITCHABLE_ROLES.includes(baseRole);

    return canSwitch;
  } catch (error) {
    console.error('[ROLE_TOGGLE] Check switch error:', error);
    return false;
  }
}

/**
 * Get current active role (considering toggle state)
 */
export function getActiveRole() {
  try {
    const roleMode = localStorage.getItem(ROLE_MODE_KEY);
    const actualRole = localStorage.getItem(ACTUAL_ROLE_KEY);

    if (roleMode === 'citizen' && actualRole) {
      return 'citizen'; // Currently in citizen mode
    }

    return actualRole; // Normal mode
  } catch (error) {
    return null;
  }
}

/**
 * Switch to citizen mode (updates database)
 */
export async function switchToCitizenMode() {
  try {
    const actualRole = await getUserRole({ refresh: true });

    // Check if role is switchable
    const canSwitch = SWITCHABLE_ROLES.includes(actualRole);

    if (!canSwitch) {
      showMessage('error', 'Your role cannot switch to citizen mode');
      return false;
    }

    // console.log removed for security

    // Update database via API
    const response = await fetch('/api/user/switch-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetRole: 'citizen',
        previousRole: actualRole
      })
    });

    const result = await response.json();

    if (!result.success) {
      showMessage('error', result.error || 'Failed to switch role');
      return false;
    }

    // Store base role in localStorage for UI reference
    localStorage.setItem(ACTUAL_ROLE_KEY, actualRole);
    localStorage.setItem(ROLE_MODE_KEY, 'citizen');

    // Update user meta to reflect citizen mode
    saveUserMeta({ role: 'citizen', base_role: actualRole, mode: 'citizen_mode' });
    showMessage('success', 'Switched to Citizen mode. Refreshing...');

    // Refresh page to reload with new role
    setTimeout(() => window.location.reload(), 1000);

    return true;
  } catch (error) {
    console.error('[ROLE_TOGGLE] Switch to citizen error:', error);
    showMessage('error', 'Failed to switch to citizen mode');
    return false;
  }
}

/**
 * Switch back to actual role (updates database)
 */
export async function switchToActualRole() {
  try {
    const actualRole = localStorage.getItem(ACTUAL_ROLE_KEY);

    if (!actualRole) {
      showMessage('error', 'No actual role found');
      console.error('[ROLE_TOGGLE] No actual role in localStorage');
      return false;
    }

    // console.log removed for security

    // Update database via API
    const response = await fetch('/api/user/switch-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetRole: actualRole,
        previousRole: 'citizen'
      })
    });

    const result = await response.json();

    // console.log removed for security

    if (!result.success) {
      showMessage('error', result.error || 'Failed to switch role');
      return false;
    }

    // Clear mode
    localStorage.removeItem(ROLE_MODE_KEY);

    // Update user meta to reflect base role
    saveUserMeta({ role: actualRole });

    // console.log removed for security
    showMessage('success', `Switched back to ${actualRole} mode. Refreshing...`);

    // Refresh page to reload with new role
    setTimeout(() => window.location.reload(), 1000);

    return true;
  } catch (error) {
    console.error('[ROLE_TOGGLE] Switch to actual role error:', error);
    showMessage('error', 'Failed to switch back');
    return false;
  }
}

/**
 * Check if currently in citizen mode
 */
export function isInCitizenMode() {
  try {
    const roleMode = localStorage.getItem(ROLE_MODE_KEY);
    return roleMode === 'citizen';
  } catch (error) {
    return false;
  }
}

/**
 * Get actual role (not considering toggle)
 */
export function getActualRole() {
  try {
    const actualRole = localStorage.getItem(ACTUAL_ROLE_KEY);
    return actualRole || null;
  } catch (error) {
    return null;
  }
}

/**
 * Initialize role toggle UI
 * Should be called on every page that needs the toggle
 */
export async function initializeRoleToggle() {
  console.log('[ROLE_TOGGLE] Initializing role toggle...');
  
  // Prevent multiple initializations
  if (isInitialized) {
    console.log('[ROLE_TOGGLE] Already initialized, skipping...');
    return;
  }
  isInitialized = true;

  // Show button immediately with loading state
  createRoleToggleButton('lgu', false, true);

  try {
    // Check if user has a base role (meaning they're staff who can switch)
    const response = await fetch('/api/user/role-info', {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    const result = await response.json();
    
    const baseRole = result?.data?.base_role;
    const currentRole = result?.data?.role || 'citizen';
    
    // Show button if user has a base role (staff member) OR if they're currently in citizen mode with a base role
    const hasBaseRole = baseRole && baseRole !== 'citizen';
    const isInCitizenMode = currentRole === 'citizen' && baseRole;
    
    if (!hasBaseRole && !isInCitizenMode) {
      // Remove the button if user is a real citizen (no base role)
      const btn = document.getElementById('role-toggle-btn');
      if (btn) {
        console.log('[ROLE_TOGGLE] Removing button - user is real citizen');
        btn.remove();
      }
      isInitialized = false; // Reset initialization flag
      return;
    }

    console.log('[ROLE_TOGGLE] User has base role or is in citizen mode:', { hasBaseRole, isInCitizenMode, baseRole, currentRole });

    // Cache the result for future use
    roleInfoCache = result;
    roleInfoCacheTime = Date.now();

    // Update localStorage to keep in sync
    if (isInCitizenMode) {
      localStorage.setItem(ACTUAL_ROLE_KEY, baseRole);
      localStorage.setItem(ROLE_MODE_KEY, 'citizen');
    } else {
      localStorage.removeItem(ROLE_MODE_KEY);
    }

    // Update button with base role
    updateRoleToggleButton(baseRole, isInCitizenMode);

    // Watch for header changes and re-add button if needed
    watchForHeaderChanges(baseRole, isInCitizenMode);

  } catch (error) {
    console.error('[ROLE_TOGGLE] Initialize error:', error);
    // Remove button on error
    const btn = document.getElementById('role-toggle-btn');
    if (btn) btn.remove();
  }
}

/**
 * Watch for header changes and re-add button if needed
 */
function watchForHeaderChanges(baseRole, isInCitizenMode) {
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) return;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        // Check if our button was removed
        const existingBtn = document.getElementById('role-toggle-btn');
        if (!existingBtn && (baseRole || isInCitizenMode)) {
          console.log('[ROLE_TOGGLE] Button was removed, re-adding...');
          createRoleToggleButton(baseRole, isInCitizenMode, false);
        }
      }
    });
  });

  observer.observe(headerRight, {
    childList: true,
    subtree: true
  });

  // Store observer for cleanup if needed
  window.roleToggleObserver = observer;
}

/**
 * Create role toggle button in header (simple button matching existing style)
 */
function createRoleToggleButton(actualRole = null, isInCitizen = false, isLoading = false) {
  // Check if button already exists
  const existingBtn = document.getElementById('role-toggle-btn');
  if (existingBtn) {
    console.log('[ROLE_TOGGLE] Button already exists, updating...');
    updateRoleToggleButton(actualRole, isInCitizen);
    return;
  }

  // Find header-right container (where notification and profile buttons are)
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) {
    console.warn('[ROLE_TOGGLE] Header-right not found, retrying...');
    // Retry with multiple attempts and longer delays
    setTimeout(() => {
      const retryHeaderRight = document.querySelector('.header-right');
      if (retryHeaderRight) {
        console.log('[ROLE_TOGGLE] Header-right found on first retry');
        createRoleToggleButton(actualRole, isInCitizen, isLoading);
      } else {
        // Try again after header initialization
        setTimeout(() => {
          const secondRetry = document.querySelector('.header-right');
          if (secondRetry) {
            console.log('[ROLE_TOGGLE] Header-right found on second retry');
            createRoleToggleButton(actualRole, isInCitizen, isLoading);
          } else {
            // Final attempt after everything should be loaded
            setTimeout(() => {
              const finalRetry = document.querySelector('.header-right');
              if (finalRetry) {
                console.log('[ROLE_TOGGLE] Header-right found on final retry');
                createRoleToggleButton(actualRole, isInCitizen, isLoading);
              } else {
                console.warn('[ROLE_TOGGLE] Header-right not found after multiple retries - header may not be initialized');
              }
            }, 2000); // Wait 2 seconds for full initialization
          }
        }, 1000); // Wait 1 second for header to be created
      }
    }, 500); // Initial retry after 500ms
    return;
  }

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'role-toggle-btn';
  toggleBtn.className = 'role-toggle-btn';

  if (isLoading) {
    toggleBtn.title = 'Loading...';
    toggleBtn.innerHTML = '⏳';
    toggleBtn.disabled = true;
  } else if (actualRole) {
    toggleBtn.title = isInCitizen ? `Switch back to ${formatRoleName(actualRole)}` : 'Switch to Citizen Mode';
    toggleBtn.innerHTML = isInCitizen ? '👔' : '👤';
    toggleBtn.disabled = false;

    toggleBtn.addEventListener('click', async () => {
      if (isInCitizenMode()) {
        const success = await switchToActualRole();
        if (success) {
          setTimeout(() => window.location.reload(), 500);
        }
      } else {
        const success = await switchToCitizenMode();
        if (success) {
          setTimeout(() => window.location.reload(), 500);
        }
      }
    });
  } else {
    toggleBtn.title = 'Role Toggle';
    toggleBtn.innerHTML = '👤';
    toggleBtn.disabled = true;
  }

  // Add simple styles that match notification button
  addToggleStyles();

  // Insert before notification button
  const notificationContainer = headerRight.querySelector('.notification-container');
  if (notificationContainer) {
    headerRight.insertBefore(toggleBtn, notificationContainer);
  } else {
    headerRight.prepend(toggleBtn);
  }

  // console.log removed for security
}

/**
 * Update existing role toggle button
 */
function updateRoleToggleButton(actualRole, isInCitizen) {
  console.log('[ROLE_TOGGLE] Updating button:', { actualRole, isInCitizen });
  const toggleBtn = document.getElementById('role-toggle-btn');
  if (!toggleBtn) {
    console.warn('[ROLE_TOGGLE] Button not found for update, creating new one');
    createRoleToggleButton(actualRole, isInCitizen, false);
    return;
  }

  toggleBtn.disabled = false;
  toggleBtn.title = isInCitizen ? `Switch back to ${formatRoleName(actualRole)}` : 'Switch to Citizen Mode';
  toggleBtn.innerHTML = isInCitizen ? '👔' : '👤';
  
  console.log('[ROLE_TOGGLE] Button updated successfully:', { actualRole, isInCitizen });

  // console.log removed for security

  // Remove old listener and add new one
  const newBtn = toggleBtn.cloneNode(true);
  toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);

  newBtn.addEventListener('click', async () => {
    const inCitizenMode = isInCitizenMode();
    // console.log removed for security

    if (inCitizenMode) {
      // console.log removed for security
      const success = await switchToActualRole();
      if (success) {
        setTimeout(() => window.location.reload(), 500);
      }
    } else {
      // console.log removed for security
      const success = await switchToCitizenMode();
      if (success) {
        setTimeout(() => window.location.reload(), 500);
      }
    }
  });

  // console.log removed for security
}

/**
 * Format role name for display
 */
function formatRoleName(role) {
  // Handle LGU officer roles with department codes
  if (/^lgu-(?!admin|hr)/.test(role)) {
    const dept = role.replace(/^lgu-/, '').toUpperCase();
    return `LGU Officer (${dept})`;
  }

  // Handle LGU admin roles with department codes
  if (/^lgu-admin-/.test(role)) {
    const dept = role.replace(/^lgu-admin-/, '').toUpperCase();
    return `LGU Admin (${dept})`;
  }

  // Handle LGU HR roles with department codes
  if (/^lgu-hr-/.test(role)) {
    const dept = role.replace(/^lgu-hr-/, '').toUpperCase();
    return `HR (${dept})`;
  }

  const names = {
    'complaint-coordinator': 'Coordinator',
    'lgu-admin': 'LGU Admin',
    'lgu-hr': 'HR',
    'super-admin': 'Super Admin'
  };
  return names[role] || role;
}

/**
 * Add CSS styles for toggle button (matches notification button style)
 */
function addToggleStyles() {
  if (document.getElementById('role-toggle-styles')) {
    return;
  }

  const styles = document.createElement('style');
  styles.id = 'role-toggle-styles';
  styles.textContent = `
    .role-toggle-btn {
      position: relative;
      background: none;
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 6px;
      border-radius: 50%;
      transition: background-color 0.2s ease;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .role-toggle-btn:hover {
      background-color: rgba(0, 0, 0, 0.1);
    }

    .role-toggle-btn:active {
      background-color: rgba(0, 0, 0, 0.15);
    }

    @media (max-width: 768px) {
      .role-toggle-btn {
        width: 28px;
        height: 28px;
        font-size: 14px;
      }
    }
  `;
  document.head.appendChild(styles);
}

// Auto-initialize on page load
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeRoleToggle();
  });
}

export default {
  canSwitchToCitizen,
  getActiveRole,
  switchToCitizenMode,
  switchToActualRole,
  isInCitizenMode,
  getActualRole,
  initializeRoleToggle
};
