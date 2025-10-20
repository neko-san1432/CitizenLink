import { getUserRole } from '../auth/authChecker.js';
import { brandConfig, apiClient } from '../config/index.js';
import { getActiveRole, isInCitizenMode } from '../auth/roleToggle.js';

const root = '';
const _sidebarEl = document.getElementById('sidebar');

// Sidebar close button functionality (menu-toggle is handled in header.js)
function initializeSidebarClose() {
  const sidebar = document.getElementById('sidebar');
  const sidebarClose = document.getElementById('sidebar-close');

  if (sidebarClose && sidebar) {
    sidebarClose.addEventListener('click', function() {
      sidebar.classList.remove('open');
    });
    // console.log removed for security
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
  'signout': '🚪'
};

if (_sidebarEl) _sidebarEl.innerHTML=`
<div class="sidebar-brand">
  <div class="brand-logo">
    <div class="brand-icon">CL</div>
    <div class="brand-text">
      <a href="${brandConfig.dashboardUrl}" class="brand-link">${brandConfig.name}</a>
      <div class="brand-subtitle">web designer</div>
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
  <a href="${root}/dashboard" data-icon="dashboard">
    <span class="menu-icon">📊</span>
    <span>Dashboard</span>
  </a>
  <a href="${root}/citizen/fileComplaint" data-icon="fileComplaint">
    <span class="menu-icon">📝</span>
    <span>File Complaint</span>
  </a>
  <a href="${root}/myProfile" data-icon="myProfile">
    <span class="menu-icon">👤</span>
    <span>My Profile</span>
  </a>
</div>
<div class="sidebar-bottom">
  <div class="theme-toggle" id="theme-toggle">
    <div class="theme-toggle-label">
      <span class="menu-icon">🌙</span>
      <span>Dark Mode</span>
    </div>
    <div class="toggle-switch" id="toggle-switch"></div>
  </div>
</div>
`;

async function setSidebarRole() {
  try {
    const roleRaw = await getUserRole({ refresh: true });
    const role = (roleRaw == null ? '' : String(roleRaw)).trim().toLowerCase();

    // Check if user can file complaints (citizen or in citizen mode)
    const activeRole = getActiveRole();
    const inCitizenMode = isInCitizenMode();
    const canFileComplaint = activeRole === 'citizen' || inCitizenMode;

    const isLguPrefixed = /^lgu-/.test(role || '');
    const afterPrefix = isLguPrefixed ? role.replace(/^lgu-/, '') : '';
    const firstSegment = isLguPrefixed ? (afterPrefix.split('-')[0] || '') : '';
    const isLguAdmin = role === 'lgu-admin' || /^lgu-admin-/.test(role);
    const isLguOfficer = /^lgu-(?!admin|hr)/.test(role); // Matches lgu-wst, lgu-engineering, etc. but NOT lgu-admin-* or lgu-hr-*
    const isCoordinator = role === 'complaint-coordinator';
    const isHR = role === 'lgu-hr' || /^lgu-hr-/.test(role); // Support lgu-hr-wst, lgu-hr-engineering, etc.
    const isSuperAdmin = role === 'super-admin';

    // Debug logging
    // console.log removed for security

    // Update localStorage with the correct role for future use
    if (roleRaw) {
      const { saveUserMeta } = await import('../auth/authChecker.js');
      saveUserMeta({ role: roleRaw });
    }

    const links = [];

    // Role-specific links (feature-specific pages, not dashboards)
    if (isSuperAdmin) {
      links.push({ href: `${root}/appointAdmins`, label: 'Appoint Admins', icon: 'appointAdmins' });
      links.push({ href: `${root}/admin/departments`, label: 'Departments', icon: 'departments' });
      links.push({ href: `${root}/admin/department-structure`, label: 'Department Structure', icon: 'departments' });
      links.push({ href: `${root}/super-admin/role-changer`, label: 'Role Changer', icon: 'role-changer' });
    } else if (isHR) {
      links.push({ href: `${root}/hr/role-changer`, label: 'Role Changer', icon: 'role-changer' });
      links.push({ href: `${root}/hr/link-generator`, label: 'Link Generator', icon: 'link-generator' });
    } else if (isCoordinator) {
      links.push({ href: `${root}/coordinator/review-queue`, label: 'Review Queue', icon: 'review-queue' });
      links.push({ href: `${root}/hr/link-generator`, label: 'Link Generator', icon: 'link-generator' });
    } else if (isLguAdmin) {
      // console.log removed for security
      links.push({ href: `${root}/lgu-admin/assignments`, label: 'Department Assignments', icon: 'assignments' });
      links.push({ href: `${root}/heatmap`, label: 'Heatmap', icon: 'heatmap' });
      links.push({ href: `${root}/publish`, label: 'Publish Content', icon: 'publish' });
    } else if (isLguOfficer) {
      // console.log removed for security
      links.push({ href: `${root}/taskAssigned`, label: 'Assigned Tasks', icon: 'taskAssigned' });
    }

    // Sign out link
    links.push({ href: `${root}/__signout__`, label: 'Sign out', icon: 'signout', action: 'signout' });

    const html = links.map(l => `
      <a href="${l.href}" data-action="${l.action || ''}" data-icon="${l.icon}">
        <span class="menu-icon">${menuIcons[l.icon] || '📄'}</span>
        <span>${l.label}</span>
      </a>
    `).join('\n');

    // Build sidebar HTML - only show File Complaint if user is citizen or in citizen mode
    const fileComplaintLink = canFileComplaint
      ? `<a href="${root}/citizen/fileComplaint" data-icon="fileComplaint">
           <span class="menu-icon">${menuIcons.fileComplaint}</span>
           <span>File Complaint</span>
         </a>`
      : '';

    if (_sidebarEl) _sidebarEl.innerHTML = `
<div class="sidebar-brand">
  <div class="brand-logo">
    <div class="brand-icon">CL</div>
    <div class="brand-text">
      <a href="${brandConfig.dashboardUrl}" class="brand-link">${brandConfig.name}</a>
      <div class="brand-subtitle">web designer</div>
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
  <a href="${root}/dashboard" data-icon="dashboard">
    <span class="menu-icon">${menuIcons.dashboard}</span>
    <span>Dashboard</span>
  </a>
  ${fileComplaintLink}
  ${html}
  <a href="${root}/myProfile" data-icon="myProfile">
    <span class="menu-icon">${menuIcons.myProfile}</span>
    <span>My Profile</span>
  </a>
</div>
<div class="sidebar-bottom">
  <div class="theme-toggle" id="theme-toggle">
    <div class="theme-toggle-label">
      <span class="menu-icon">🌙</span>
      <span>Dark Mode</span>
    </div>
    <div class="toggle-switch" id="toggle-switch"></div>
  </div>
</div>
`;
    // Wire sign out
    try {
      const signoutLink = _sidebarEl.querySelector('a[data-action="signout"]');
      if (signoutLink) {
        signoutLink.addEventListener('click', async (e) => {
          e.preventDefault();
          try {
            // Client-side sign out
            await apiClient.supabase.auth.signOut();
          } catch {}
          try { await fetch('/auth/session', { method: 'DELETE' }); } catch {}
          window.location.href = '/login';
        });
      }
    } catch {}

    // Re-initialize sidebar close button after HTML is updated
    initializeSidebarClose();
    
    // Initialize search functionality
    initializeSidebarSearch();
    
    // Initialize theme toggle
    initializeThemeToggle();
    
    // Set active menu item
    setActiveMenuItem();
  } catch {}
}

// Search functionality
function initializeSidebarSearch() {
  const searchInput = document.getElementById('sidebar-search-input');
  const menuItems = document.querySelectorAll('#sidebar .sidebar-menu a');
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      
      menuItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        const shouldShow = text.includes(searchTerm);
        
        item.style.display = shouldShow ? 'flex' : 'none';
        item.style.animation = shouldShow ? 'fadeIn 0.3s ease-out' : 'none';
      });
    });
  }
}

// Theme toggle functionality
function initializeThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  const toggleSwitch = document.getElementById('toggle-switch');
  
  if (themeToggle && toggleSwitch) {
    // Check current theme
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      toggleSwitch.classList.add('active');
    }
    
    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('dark');
      
      if (isDark) {
        document.documentElement.classList.remove('dark');
        toggleSwitch.classList.remove('active');
        localStorage.setItem('theme', 'light');
      } else {
        document.documentElement.classList.add('dark');
        toggleSwitch.classList.add('active');
        localStorage.setItem('theme', 'dark');
      }
    });
  }
}

// Set active menu item based on current page
function setActiveMenuItem() {
  const currentPath = window.location.pathname;
  const menuItems = document.querySelectorAll('#sidebar .sidebar-menu a');
  
  menuItems.forEach(item => {
    item.classList.remove('active');
    
    const href = item.getAttribute('href');
    if (href && currentPath.includes(href.replace(root, ''))) {
      item.classList.add('active');
    }
  });
}

// Initialize theme on page load
function initializeTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
}

setSidebarRole();

// Initialize sidebar close button when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeSidebarClose();
  initializeTheme();
});