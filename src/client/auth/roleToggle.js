/**
 * Role Toggle System
 * Allows staff roles to switch to citizen mode temporarily
 */

import { supabase } from '../config/config.js';
import { getUserRole, saveUserMeta } from './authChecker.js';
import showMessage from '../components/toast.js';

// Local storage keys
const ROLE_MODE_KEY = 'cl_role_mode';
const ACTUAL_ROLE_KEY = 'cl_actual_role';

// Roles that can switch
const SWITCHABLE_ROLES = [
  'complaint-coordinator',
  'lgu',  // Matches lgu-wst, lgu-engineering, lgu-health, etc. (LGU Officers)
  'lgu-admin',
  'lgu-hr',
  'super-admin'
];

/**
 * Check if current user can switch to citizen mode
 * Logic: Check the actual_role (not current role) to determine if user is staff
 * If actual_role is a staff role → show toggle button
 * If actual_role is citizen or doesn't exist → hide button
 */
export async function canSwitchToCitizen() {
  try {
    // Get role info from API - we need actual_role to determine if user is really staff
    const response = await fetch('/api/user/role-info');
    const result = await response.json();

    if (!result.success) {
      console.error('[ROLE_TOGGLE] Failed to get role info:', result);
      return false;
    }

    // IMPORTANT: Check actual_role, not current role
    // actual_role tells us what the user's real role is
    // If they're in citizen mode, actual_role will still be their staff role
    const actualRole = result.data.actual_role;
    const currentRole = result.data.role;


    // If no actual_role exists, user is a real citizen
    if (!actualRole) {
      console.log('[ROLE_TOGGLE] No actual_role found - user is a real citizen');
      return false;
    }

    // Check if actual_role is a switchable staff role
    const canSwitch = SWITCHABLE_ROLES.some(switchableRole => {
      return actualRole === switchableRole || actualRole?.startsWith(switchableRole + '-');
    });

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

    // Check exact match or if role starts with switchable role prefix
    const canSwitch = SWITCHABLE_ROLES.some(switchableRole => {
      return actualRole === switchableRole || actualRole?.startsWith(switchableRole + '-');
    });

    if (!canSwitch) {
      showMessage('error', 'Your role cannot switch to citizen mode');
      return false;
    }

    console.log(`[ROLE_TOGGLE] Switching from ${actualRole} to citizen mode`);

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

    // Store actual role in localStorage for UI reference
    localStorage.setItem(ACTUAL_ROLE_KEY, actualRole);
    localStorage.setItem(ROLE_MODE_KEY, 'citizen');

    // Update user meta to reflect citizen mode
    saveUserMeta({ role: 'citizen', actual_role: actualRole, mode: 'citizen_mode' });
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

    console.log(`[ROLE_TOGGLE] Switching back from citizen to ${actualRole}`);

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

    console.log('[ROLE_TOGGLE] API response:', result);

    if (!result.success) {
      showMessage('error', result.error || 'Failed to switch role');
      return false;
    }

    // Clear mode
    localStorage.removeItem(ROLE_MODE_KEY);

    // Update user meta to reflect actual role
    saveUserMeta({ role: actualRole });

    console.log(`[ROLE_TOGGLE] ✅ Successfully switched back to ${actualRole}`);
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

  // Show button immediately with loading state
  createRoleToggleButton(null, false, true);

  try {
    const canSwitch = await canSwitchToCitizen();

    if (!canSwitch) {
      console.log('[ROLE_TOGGLE] User cannot switch - removing toggle');
      // Remove the button if user can't switch
      const btn = document.getElementById('role-toggle-btn');
      if (btn) btn.remove();
      return;
    }

    // Get role info from API (includes actual_role)
    const response = await fetch('/api/user/role-info');
    const result = await response.json();

    console.log('[ROLE_TOGGLE] API role-info response:', result);

    const currentRole = result?.data?.role || 'citizen';
    const actualRole = result?.data?.actual_role || currentRole;
    const isInCitizen = currentRole === 'citizen' && actualRole !== 'citizen';

    console.log('[ROLE_TOGGLE] Role state:', {
      currentRole,
      actualRole,
      isInCitizen,
      condition: `currentRole(${currentRole}) === 'citizen' && actualRole(${actualRole}) !== 'citizen'`
    });

    // Update localStorage to keep in sync
    if (isInCitizen) {
      console.log('[ROLE_TOGGLE] Detected citizen mode - storing actual role');
      localStorage.setItem(ACTUAL_ROLE_KEY, actualRole);
      localStorage.setItem(ROLE_MODE_KEY, 'citizen');
    } else {
      console.log('[ROLE_TOGGLE] Not in citizen mode - clearing mode key');
      localStorage.removeItem(ROLE_MODE_KEY);
    }

    // Update button with actual role
    updateRoleToggleButton(actualRole, isInCitizen);

  } catch (error) {
    console.error('[ROLE_TOGGLE] Initialize error:', error);
    // Remove button on error
    const btn = document.getElementById('role-toggle-btn');
    if (btn) btn.remove();
  }
}

/**
 * Create role toggle button in header (simple button matching existing style)
 */
function createRoleToggleButton(actualRole, isInCitizen, isLoading = false) {
  // Check if button already exists
  if (document.getElementById('role-toggle-btn')) {
    console.log('[ROLE_TOGGLE] Button already exists');
    return;
  }

  // Find header-right container (where notification and profile buttons are)
  const headerRight = document.querySelector('.header-right');
  if (!headerRight) {
    console.warn('[ROLE_TOGGLE] Header-right not found');
    return;
  }

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'role-toggle-btn';
  toggleBtn.className = 'role-toggle-btn';

  if (isLoading) {
    toggleBtn.title = 'Loading...';
    toggleBtn.innerHTML = '⏳';
    toggleBtn.disabled = true;
  } else {
    toggleBtn.title = isInCitizen ? `Switch back to ${formatRoleName(actualRole)}` : 'Switch to Citizen Mode';
    toggleBtn.innerHTML = isInCitizen ? '👔' : '👤';

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

  console.log('[ROLE_TOGGLE] Button created successfully');
}

/**
 * Update existing role toggle button
 */
function updateRoleToggleButton(actualRole, isInCitizen) {
  const toggleBtn = document.getElementById('role-toggle-btn');
  if (!toggleBtn) {
    console.warn('[ROLE_TOGGLE] Button not found for update');
    return;
  }

  toggleBtn.disabled = false;
  toggleBtn.title = isInCitizen ? `Switch back to ${formatRoleName(actualRole)}` : 'Switch to Citizen Mode';
  toggleBtn.innerHTML = isInCitizen ? '👔' : '👤';

  console.log('[ROLE_TOGGLE] Button config:', {
    actualRole,
    isInCitizen,
    title: toggleBtn.title,
    icon: toggleBtn.innerHTML
  });

  // Remove old listener and add new one
  const newBtn = toggleBtn.cloneNode(true);
  toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);

  newBtn.addEventListener('click', async () => {
    const inCitizenMode = isInCitizenMode();
    console.log('[ROLE_TOGGLE] Button clicked, isInCitizenMode:', inCitizenMode);

    if (inCitizenMode) {
      console.log('[ROLE_TOGGLE] Attempting to switch back to actual role...');
      const success = await switchToActualRole();
      if (success) {
        setTimeout(() => window.location.reload(), 500);
      }
    } else {
      console.log('[ROLE_TOGGLE] Attempting to switch to citizen mode...');
      const success = await switchToCitizenMode();
      if (success) {
        setTimeout(() => window.location.reload(), 500);
      }
    }
  });

  console.log('[ROLE_TOGGLE] Button updated successfully with mode:', isInCitizen ? 'CITIZEN' : 'STAFF');
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
