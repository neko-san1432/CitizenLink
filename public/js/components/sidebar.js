import { getUserRole } from '../auth/authChecker.js';
import { brandConfig } from '../config/brand.js';
import { getMenuIcon, getIcon } from '../utils/icons.js';

const _sidebarEl = document.getElementById('sidebar');
const root = window.location.origin;
let backdropEl = null;

// Initialize sidebar
if (_sidebarEl) {
  initializeSidebar();
}

function initializeSidebar() {
  initializeSidebarClose();
  // Theme toggle is handled by header.js
  setTimeout(setSidebarRole, 500); // Wait 500ms for auth to complete
  setActiveMenuItem();
  // Add accessibility attributes
  if (_sidebarEl) {
    _sidebarEl.setAttribute('role', 'navigation');
    _sidebarEl.setAttribute('aria-label', 'Main navigation');
    _sidebarEl.setAttribute('aria-expanded', 'false');
  }
  // Add Esc key handler
  document.addEventListener('keydown', handleEscKey);
}

function handleEscKey(e) {
  if (e.key === 'Escape' && _sidebarEl && _sidebarEl.classList.contains('open')) {
    closeSidebar();
  }
}

function createBackdrop() {
  if (!backdropEl) {
    backdropEl = document.createElement('div');
    backdropEl.className = 'sidebar-backdrop';
    backdropEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdropEl);

    // Add click handler to close sidebar
    backdropEl.addEventListener('click', () => {
      closeSidebar();
    });
  }
  // Activate backdrop
  backdropEl.classList.add('active');
  backdropEl.setAttribute('aria-hidden', 'false');
}

function removeBackdrop() {
  if (backdropEl) {
    backdropEl.classList.remove('active');
    backdropEl.setAttribute('aria-hidden', 'true');
    // Remove backdrop after transition
    setTimeout(() => {
      if (backdropEl && !backdropEl.classList.contains('active')) {
        backdropEl.remove();
        backdropEl = null;
      }
    }, 300);
  }
}

function openSidebar() {
  if (_sidebarEl) {
    _sidebarEl.classList.add('open');
    _sidebarEl.setAttribute('aria-expanded', 'true');
    createBackdrop();
  }
}

function closeSidebar() {
  if (_sidebarEl) {
    _sidebarEl.classList.remove('open');
    _sidebarEl.setAttribute('aria-expanded', 'false');
    removeBackdrop();
  }
}

function initializeSidebarClose() {
  const closeBtn = document.getElementById('sidebar-close');
  if (closeBtn) {
    closeBtn.setAttribute('aria-label', 'Close sidebar');
    closeBtn.addEventListener('click', () => {
      closeSidebar();
    });
  }
}
// Icon mapping now uses SVG icons from icons.js utility
async function setSidebarRole() {
  try {
    // Get user role with better error handling
    let role = null;
    try {
      role = await getUserRole({ refresh: true });
    } catch (error) {
      console.error('Failed to get user role:', error);
      // Try to get role from session as fallback
      try {
        const { supabase } = await import('../config/config.js');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const metadata = session.user.raw_user_meta_data || session.user.user_metadata || {};
          role = metadata.role || metadata.normalized_role;
        }
      } catch (sessionError) {
        console.error('Failed to get role from session:', sessionError);
      }
    }
    // If still no role, try to get it from localStorage
    if (!role) {
      try {
        const { getUserMeta } = await import('../auth/authChecker.js');
        const userMeta = getUserMeta();
        role = userMeta?.role;
      } catch (error) {
        console.error('Failed to get role from localStorage:', error);
      }
    }
    if (!role) {
      console.error('No role found, redirecting to login');
      window.location.href = `/login?message=${  encodeURIComponent('Unable to determine user role. Please log in again.')  }&type=error`;
      return;
    }
    const roleLower = role.toLowerCase();
    // Define menu items based on role
    const menuItems = getMenuItemsForRole(roleLower);
    // Build sidebar HTML
    if (_sidebarEl) {
      _sidebarEl.innerHTML = `
<div class="sidebar-brand">
  <div class="brand-logo">
    <div class="brand-icon">CL</div>
    <div class="brand-text">
      <a href="${brandConfig.dashboardUrl}" class="brand-link">${brandConfig.name}</a>
              <div class="brand-subtitle">Citizen Link</div>
    </div>
  </div>
  <button id="sidebar-close" class="sidebar-close" aria-label="Close sidebar">×</button>
</div>
        
<div class="sidebar-menu">
          ${menuItems.map(item => `
            <a href="${root}${item.url}" data-icon="${item.icon}" aria-label="${item.label}">
              <span class="menu-icon">${getMenuIcon(item.icon, { size: 20 })}</span>
              <span>${item.label}</span>
            </a>
          `).join('')}
</div>
        
        <div class="sidebar-bottom">
  <div class="theme-toggle" id="sidebar-theme-toggle">
    <div class="theme-toggle-label">
      <span class="menu-icon">${getIcon('darkMode', { size: 20 })}</span>
      <span>Dark Mode</span>
    </div>
    <div class="toggle-switch" id="sidebar-toggle-switch"></div>
  </div>
          <div class="sidebar-footer">
            <a href="/logout" class="logout-link" data-icon="signout" aria-label="Sign out">
              <span class="menu-icon">${getMenuIcon('signout', { size: 20 })}</span>
              <span>Sign Out</span>
            </a>
          </div>
        </div>
      `;

      // Re-initialize event listeners after HTML update
      initializeSidebarClose();
      // Initialize sidebar theme toggle
      initializeSidebarThemeToggle();
      initializeLogout();
      // Update active menu items with aria-current
      setActiveMenuItem();

    }
  } catch (error) {
    console.error('Failed to set sidebar role:', error);
    // Show error message to user
    if (_sidebarEl) {
      _sidebarEl.innerHTML = `
        <div class="sidebar-error">
          <div class="error-message">
            <h3>${getIcon('alert', { size: 24 })} Error</h3>
            <p>Failed to load sidebar. Please refresh the page.</p>
            <button onclick="window.location.reload()" class="retry-btn">Retry</button>
          </div>
</div>
`;
    }
  }
}
function getMenuItemsForRole(role) {
  // Normalize role using general normalization function
  const originalRole = role;
  role = normalizeRoleForClient(role);
  // Role normalization happens silently

  const menuItems = {
    'citizen': [
      { url: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
      { url: '/fileComplaint', icon: 'fileComplaint', label: 'File Complaint' },
      { url: '/digos-map', icon: 'map', label: 'Digos City Map' },
      { url: '/departments', icon: 'departments', label: 'Departments' },
      { url: '/myProfile', icon: 'myProfile', label: 'My Profile' }
    ],
    'super-admin': [
      { url: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
      { url: '/super-admin/pending-signups', icon: 'review-queue', label: 'Pending Signups' },
      { url: '/super-admin/user-manager', icon: 'role-changer', label: 'User Manager' },
      { url: '/super-admin/link-generator', icon: 'link-generator', label: 'Link Generator' },
      { url: '/super-admin/server-logs', icon: 'server-logs', label: 'Server logs' },
      { url: '/departments', icon: 'departments', label: 'Departments' },
      { url: '/myProfile', icon: 'myProfile', label: 'My Profile' }
    ],
    'lgu-hr': [
      { url: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
      { url: '/link-generator', icon: 'link-generator', label: 'Link Generator' },
      { url: '/myProfile', icon: 'myProfile', label: 'My Profile' }
    ],
    'complaint-coordinator': [
      { url: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
      { url: '/review-queue', icon: 'review-queue', label: 'Review Queue' },
      { url: '/heatmap', icon: 'heatmap', label: 'Heatmap' },
      { url: '/myProfile', icon: 'myProfile', label: 'My Profile' }
    ],
    'lgu-admin': [
      { url: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
      { url: '/assignments', icon: 'assignments', label: 'Assignments' },
      { url: '/heatmap', icon: 'heatmap', label: 'Heatmap' },
      { url: '/publish', icon: 'publish', label: 'Publish' },
      { url: '/myProfile', icon: 'myProfile', label: 'My Profile' }
    ]
  };
  // Handle simplified LGU roles
  if (role === 'lgu-hr') {
    return menuItems['lgu-hr'] || [];
  }
  if (role === 'lgu-admin') {
    return menuItems['lgu-admin'] || [];
  }
  if (role === 'lgu') {
    return [
      { url: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
      { url: '/task-assigned', icon: 'taskAssigned', label: 'Task Assigned' },
      { url: '/myProfile', icon: 'myProfile', label: 'My Profile' }
    ];
  }
  // Return menu items for exact role match
  const items = menuItems[role] || [];
  return items;
}

/**
 * Normalize role to simplified form (client-side version)
 * Matches server-side normalization logic
 */
function normalizeRoleForClient(role) {
  if (!role || typeof role !== 'string') return 'citizen';

  const roleLower = role.toLowerCase().trim();

  // Standard roles that don't need normalization
  if (['citizen', 'super-admin', 'complaint-coordinator'].includes(roleLower)) {
    return roleLower;
  }

  // Handle simplified LGU roles
  if (roleLower === 'lgu-admin') return 'lgu-admin';
  if (roleLower === 'lgu-hr') return 'lgu-hr';
  if (roleLower === 'lgu') return 'lgu';

  // Normalize any role ending with -officer to base role
  if (roleLower.endsWith('-officer')) {
    const baseRole = roleLower.replace(/-officer$/, '');
    if (['lgu', 'lgu-admin', 'lgu-hr'].includes(baseRole)) {
      return baseRole;
    }
    return baseRole || 'citizen';
  }

  return roleLower || 'citizen';
}

// Sidebar search removed per requirements
// Theme toggle is handled by header.js - removed duplicate implementation
// But we need applyTheme function for compatibility
function applyTheme(theme) {

  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}
function updateToggleSwitch(isDark) {
  const toggleSwitch = document.getElementById('sidebar-toggle-switch');
  if (toggleSwitch) {
    if (isDark) {
      toggleSwitch.classList.add('active');
    } else {
      toggleSwitch.classList.remove('active');
    }
  }
}

/**
 * Initialize sidebar theme toggle
 */
function initializeSidebarThemeToggle() {
  const sidebarThemeToggle = document.getElementById('sidebar-theme-toggle');
  if (!sidebarThemeToggle) {
    return;
  }
  
  // Load saved theme and update toggle state
  const savedTheme = localStorage.getItem('theme') || 'light';
  const isDark = savedTheme === 'dark';
  updateToggleSwitch(isDark);
  
  // Add click handler
  sidebarThemeToggle.addEventListener('click', () => {
    const rootElement = document.documentElement;
    const currentIsDark = rootElement.classList.contains('dark');
    const newTheme = currentIsDark ? 'light' : 'dark';
    
    // Apply theme
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update toggle switch
    updateToggleSwitch(!currentIsDark);
    
    // Also update header toggle if it exists
    const headerThemeToggle = document.getElementById('theme-toggle');
    if (headerThemeToggle) {
      headerThemeToggle.title = currentIsDark ? 'Switch to light mode' : 'Switch to dark mode';
      // Update header toggle icon/text if it has textContent
      if (headerThemeToggle.textContent) {
        headerThemeToggle.textContent = currentIsDark ? '🌙' : '☀️';
      }
    }
  });
  
  // Listen for theme changes from header toggle (sync both ways)
  const observer = new MutationObserver(() => {
    const isDark = document.documentElement.classList.contains('dark');
    updateToggleSwitch(isDark);
  });
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });
}
function initializeLogout() {
  const logoutLink = document.querySelector('.logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        // Clear server session
        await fetch('/auth/session', { method: 'DELETE' });
        // Clear Supabase session
        const { supabase } = await import('../config/config.js');
        await supabase.auth.signOut();
        // Clear local storage
        localStorage.clear();
        // Redirect to login
        window.location.href = '/login';
      } catch (error) {
        console.error('Logout error:', error);
        // Force redirect even if logout fails
        window.location.href = '/login';
      }
    });
  }
}
// Set active menu item based on current page
function setActiveMenuItem() {
  const currentPath = window.location.pathname;
  const menuItems = document.querySelectorAll('.sidebar-menu a');
  menuItems.forEach(item => {
    const href = item.getAttribute('href');
    if (href && currentPath.includes(href.replace(root, ''))) {
      item.classList.add('active');
      item.setAttribute('aria-current', 'page');
    } else {
      item.classList.remove('active');
      item.removeAttribute('aria-current');
    }
  });
}
// Initialize theme on page load
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
  updateToggleSwitch(savedTheme === 'dark');
});

export { initializeSidebar, setActiveMenuItem, openSidebar, closeSidebar };
