import { getUserRole } from '../auth/authChecker.js';
import { brandConfig } from '../config/brand.js';

const _sidebarEl = document.getElementById('sidebar');
const root = window.location.origin;

// Initialize sidebar
if (_sidebarEl) {
  initializeSidebar();
}

function initializeSidebar() {
  initializeSidebarClose();
  initializeSidebarSearch();
  // Theme toggle is handled by header.js
  setTimeout(setSidebarRole, 500); // Wait 500ms for auth to complete
  setActiveMenuItem();
}

function initializeSidebarClose() {
  const closeBtn = document.getElementById('sidebar-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      _sidebarEl.classList.remove('open');
    });
  }
}

// Icon mapping for menu items
const menuIcons = {
  'dashboard': '📊',
  'fileComplaint': '📝',
  'myProfile': '👤',
  'appointAdmins': '🔐',
  'departments': '🏢',
  'role-changer': '🛠️',
  'link-generator': '🔗',
  'review-queue': '📋',
  'assignments': '📋',
  'heatmap': '🗺️',
  'publish': '📢',
  'taskAssigned': '📝',
  'signout': '🚪',
  'settings': '⚙️',
  'hr-dashboard': '👥',
  'coordinator-dashboard': '📊',
  'lgu-admin-dashboard': '🏛️',
  'lgu-officer-dashboard': '👮',
  'super-admin-dashboard': '👑'
};

async function setSidebarRole() {
  try {
    console.log('Setting up sidebar...');
    
    // Get user role with better error handling
    let role = null;
    try {
      role = await getUserRole({ refresh: true });
      console.log('Retrieved role:', role);
    } catch (error) {
      console.error('Failed to get user role:', error);
      // Try to get role from session as fallback
      try {
        const { supabase } = await import('../config/config.js');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Session data:', session);
        if (session?.user) {
          const metadata = session.user.raw_user_meta_data || session.user.user_metadata || {};
          console.log('User metadata:', metadata);
          role = metadata.role || metadata.normalized_role;
          console.log('Fallback role from session:', role);
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
        console.log('Role from localStorage:', role);
      } catch (error) {
        console.error('Failed to get role from localStorage:', error);
      }
    }
    
    if (!role) {
      console.error('No role found, redirecting to login');
      window.location.href = '/login?message=' + encodeURIComponent('Unable to determine user role. Please log in again.') + '&type=error';
      return;
    }
    
    const roleLower = role.toLowerCase();
    console.log('Processing role:', roleLower);
    
    // Define menu items based on role
    const menuItems = getMenuItemsForRole(roleLower);
    console.log('Menu items for role:', menuItems);
    
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
  <button id="sidebar-close" class="sidebar-close">×</button>
</div>
        
<div class="sidebar-search">
  <div class="search-container">
    <div class="search-icon">🔍</div>
    <input type="text" class="search-input" placeholder="Search..." id="sidebar-search-input">
  </div>
</div>
        
<div class="sidebar-menu">
          ${menuItems.map(item => `
            <a href="${root}${item.url}" data-icon="${item.icon}">
              <span class="menu-icon">${menuIcons[item.icon] || '📄'}</span>
              <span>${item.label}</span>
            </a>
          `).join('')}
</div>
        
<div class="sidebar-bottom">
  <div class="theme-toggle" id="theme-toggle">
    <div class="theme-toggle-label">
      <span class="menu-icon">🌙</span>
      <span>Dark Mode</span>
    </div>
    <div class="toggle-switch" id="toggle-switch"></div>
  </div>
          <div class="sidebar-footer">
            <a href="/logout" class="logout-link" data-icon="signout">
              <span class="menu-icon">${menuIcons.signout}</span>
              <span>Sign Out</span>
            </a>
          </div>
        </div>
      `;
      
      // Re-initialize event listeners after HTML update
      initializeSidebarClose();
      initializeSidebarSearch();
      // Theme toggle is handled by header.js
      initializeLogout();
      
      console.log('Sidebar initialized successfully');
    }
  } catch (error) {
    console.error('Failed to set sidebar role:', error);
    // Show error message to user
    if (_sidebarEl) {
      _sidebarEl.innerHTML = `
        <div class="sidebar-error">
          <div class="error-message">
            <h3>⚠️ Error</h3>
            <p>Failed to load sidebar. Please refresh the page.</p>
            <button onclick="window.location.reload()" class="retry-btn">Retry</button>
          </div>
</div>
`;
    }
  }
}


function getMenuItemsForRole(role) {
  console.log('Getting menu items for role:', role);
  
  const menuItems = {
    'citizen': [
      { url: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
      { url: '/fileComplaint', icon: 'fileComplaint', label: 'File Complaint' },
      { url: '/departments', icon: 'departments', label: 'Departments' },
      { url: '/myProfile', icon: 'myProfile', label: 'My Profile' }
    ],
    'super-admin': [
      { url: '/appoint-admins', icon: 'appointAdmins', label: 'Appoint Admins' },
      { url: '/departments', icon: 'departments', label: 'Departments' },
      { url: '/role-changer', icon: 'role-changer', label: 'Role Changer' },
      { url: '/settings', icon: 'settings', label: 'Settings' },
      { url: '/myProfile', icon: 'myProfile', label: 'My Profile' }
    ],
    'lgu-hr': [
      { url: '/link-generator', icon: 'link-generator', label: 'Link Generator' },
      { url: '/role-changer', icon: 'role-changer', label: 'Role Changer' },
      { url: '/myProfile', icon: 'myProfile', label: 'My Profile' }
    ],
    'complaint-coordinator': [
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
      { url: '/task-assigned', icon: 'taskAssigned', label: 'Task Assigned' },
      { url: '/myProfile', icon: 'myProfile', label: 'My Profile' }
    ];
  }
  
  // Return menu items for exact role match
  const items = menuItems[role] || [];
  console.log('Returning menu items:', items);
  return items;
}

function initializeSidebarSearch() {
  const searchInput = document.getElementById('sidebar-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const menuItems = document.querySelectorAll('.sidebar-menu a');
      
      menuItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(query)) {
          item.style.display = 'flex';
        } else {
          item.style.display = query ? 'none' : 'flex';
        }
      });
    });
  }
}

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
  const toggleSwitch = document.getElementById('toggle-switch');
  if (toggleSwitch) {
    if (isDark) {
      toggleSwitch.classList.add('active');
    } else {
      toggleSwitch.classList.remove('active');
    }
  }
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
    } else {
      item.classList.remove('active');
    }
  });
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
  updateToggleSwitch(savedTheme === 'dark');
});

export { initializeSidebar, setActiveMenuItem };