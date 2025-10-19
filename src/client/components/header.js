import { brandConfig } from '../config/index.js';
import { initializeNotificationButton, closeNotificationPanel } from './notification.js';

// Header component for easy modification
export function createHeader() {
  return `
    <div class="header-content">
      <div class="header-left">
        <button id="menu-toggle" class="menu-toggle" aria-label="Toggle sidebar" title="Toggle menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <a href="${brandConfig.dashboardUrl}" class="brand-logo">
          <div class="brand-icon">C</div>
          <span class="brand-text">${brandConfig.name}</span>
        </a>
      </div>
      
      <div class="header-right">
        <button id="theme-toggle" class="header-action theme-toggle" aria-label="Toggle dark mode" title="Toggle theme">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        </button>
        
        <div class="notification-container">
          <button id="notification-btn" class="header-action notification-btn" title="Notifications">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            <span id="notification-badge" class="notification-badge hidden">0</span>
          </button>
          <div id="notification-panel" class="header-dropdown notification-panel">
            <div class="dropdown-header">
              <h3 class="dropdown-title">Notifications</h3>
              <button id="close-notifications" class="dropdown-close" aria-label="Close notifications">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="dropdown-content">
              <div id="notification-content">
                <!-- Notifications will be loaded here -->
              </div>
              <div id="notification-loading" class="hidden" style="padding: 2rem; text-align: center; color: var(--gray-500);">
                <div style="width: 24px; height: 24px; border: 2px solid var(--gray-300); border-top: 2px solid var(--primary-500); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
                <span>Loading notifications...</span>
              </div>
              <div id="notification-error" class="hidden" style="padding: 2rem; text-align: center; color: var(--error-600);">
                <div style="font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
                <div style="margin-bottom: 1rem;">Failed to load notifications</div>
                <button id="retry-notifications" class="btn btn-sm btn-outline">Retry</button>
              </div>
            </div>
            <div class="dropdown-footer">
              <button id="mark-all-read" class="btn btn-sm btn-ghost">Mark all as read</button>
              <button id="show-more-notifications" class="btn btn-sm btn-primary">Show More</button>
            </div>
          </div>
        </div>
        
        <div class="profile-container">
          <button id="profile-btn" class="header-action profile-btn" title="Profile">
            <div class="profile-avatar">U</div>
          </button>
          <div id="profile-panel" class="header-dropdown profile-panel">
            <div class="dropdown-header">
              <h3 class="dropdown-title">Profile</h3>
              <button id="close-profile" class="dropdown-close" aria-label="Close profile">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="dropdown-content">
              <div class="profile-item" id="my-profile-item">
                <div class="profile-item-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <div class="profile-item-content">
                  <div class="profile-item-title">My Profile</div>
                  <div class="profile-item-subtitle">View and edit your profile</div>
                </div>
              </div>
              <div class="profile-item" id="logout-item">
                <div class="profile-item-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16,17 21,12 16,7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                </div>
                <div class="profile-item-content">
                  <div class="profile-item-title">Logout</div>
                  <div class="profile-item-subtitle">Sign out of your account</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Initialize menu toggle functionality
function initializeMenuToggle() {
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', function() {
      sidebar.classList.toggle('open');
    });
    console.log('✅ Menu toggle initialized');
  } else {
    console.warn('⚠️ Menu toggle or sidebar not found:', { menuToggle: !!menuToggle, sidebar: !!sidebar });
  }
}

// Initialize header when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  const headerContainer = document.querySelector('.header-container');
  if (headerContainer) {
    headerContainer.innerHTML = createHeader();
    initializeNotificationButton();
    initializeProfileButton();
    initializeMenuToggle(); // Initialize menu toggle after header HTML is created
    initializeThemeToggle();
    initializeHeaderScroll();
    initializeDropdowns();

    // Move dashboard clock into header-right to align with buttons
    try {
      const headerRight = headerContainer.querySelector('.header-right');
      const clockEl = document.getElementById('dashboard-clock');
      if (headerRight && clockEl) {
        headerRight.appendChild(clockEl);
      }
    } catch {}
  }
});

// Initialize header scroll effects
function initializeHeaderScroll() {
  const headerContainer = document.querySelector('.header-container');
  if (!headerContainer) return;

  let lastScrollY = window.scrollY;
  
  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    
    if (currentScrollY > 10) {
      headerContainer.classList.add('scrolled');
    } else {
      headerContainer.classList.remove('scrolled');
    }
    
    lastScrollY = currentScrollY;
  });
}

// Initialize dropdown functionality
function initializeDropdowns() {
  // Close dropdowns when clicking outside
  document.addEventListener('click', function(e) {
    const dropdowns = document.querySelectorAll('.header-dropdown');
    dropdowns.forEach(dropdown => {
      const button = dropdown.previousElementSibling;
      if (!dropdown.contains(e.target) && !button.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });
  });

  // Close dropdowns when pressing Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      const dropdowns = document.querySelectorAll('.header-dropdown');
      dropdowns.forEach(dropdown => {
        dropdown.classList.remove('show');
      });
    }
  });
}

// Initialize profile button functionality
function initializeProfileButton() {
  const profileBtn = document.getElementById('profile-btn');
  const profilePanel = document.getElementById('profile-panel');
  const closeBtn = document.getElementById('close-profile');
  const myProfileItem = document.getElementById('my-profile-item');
  const logoutItem = document.getElementById('logout-item');

  if (profileBtn && profilePanel) {
    // Toggle profile panel
    profileBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      profilePanel.classList.toggle('show');

      // Close notification panel when profile is opened
      closeNotificationPanel();
    });

    // Close panel when close button is clicked
    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        profilePanel.classList.remove('show');
      });
    }

    // My Profile functionality
    if (myProfileItem) {
      myProfileItem.addEventListener('click', function() {
        window.location.href = '/myProfile';
        profilePanel.classList.remove('show');
      });
    }

    // Logout functionality
    if (logoutItem) {
      logoutItem.addEventListener('click', async function() {
        try {
          // Import and use the logout function from authChecker
          const { logout } = await import('../auth/authChecker.js');
          await logout();
        } catch (error) {
          console.error('Logout error:', error);
          // Fallback: redirect to login
          window.location.href = '/login';
        }
        profilePanel.classList.remove('show');
      });
    }
  }
}

// Theme toggle with persisted preference and a11y-friendly approach
function initializeThemeToggle() {
  const THEME_KEY = 'citizenlink_theme';
  const rootElement = document.documentElement; // apply .dark at the html element
  const themeToggleBtn = document.getElementById('theme-toggle');

  // Determine initial theme: localStorage -> system preference -> light
  const stored = (localStorage.getItem(THEME_KEY) || '').toLowerCase();
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialIsDark = stored ? stored === 'dark' : prefersDark;

  applyTheme(initialIsDark ? 'dark' : 'light');

  if (themeToggleBtn) {
    updateThemeToggleLabel();
    themeToggleBtn.addEventListener('click', () => {
      const isDark = rootElement.classList.contains('dark');
      const next = isDark ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);
      updateThemeToggleLabel();
    });
  }

  // Reflect current theme in button label/title for screen readers
  function updateThemeToggleLabel() {
    const isDark = rootElement.classList.contains('dark');
    if (themeToggleBtn) {
      themeToggleBtn.setAttribute('aria-pressed', String(isDark));
      themeToggleBtn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
      themeToggleBtn.textContent = isDark ? '🌙' : '☀️';
    }
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      rootElement.classList.add('dark');
    } else {
      rootElement.classList.remove('dark');
    }
  }
}