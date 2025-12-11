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
          <div class="brand-icon"></div>
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
            <div id="notification-content" class="dropdown-content">
              <div class="no-notifications">No notifications yet</div>
            </div>
          </div>
        </div>

        <div class="profile-container">
          <button id="profile-btn" class="header-action profile-btn" title="Profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </button>
          <div id="profile-panel" class="header-dropdown profile-panel">
            <div class="dropdown-header">
              <h3 class="dropdown-title">Profile</h3>
            </div>
            <div class="dropdown-content">
              <a href="/myProfile" class="dropdown-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                My Profile
              </a>
              <a href="/fileComplaint" class="dropdown-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14,2 14,8 20,8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10,9 9,9 8,9"></polyline>
                </svg>
                File Complaint
              </a>
              <button id="logout-btn" class="dropdown-item logout-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16,17 21,12 16,7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
// Initialize global click handler to close dropdowns
function initializeGlobalClickHandler() {

  document.addEventListener('click', (e) => {
    const notificationPanel = document.getElementById('notification-panel');
    const profilePanel = document.getElementById('profile-panel');
    const notificationBtn = document.getElementById('notification-btn');
    const profileBtn = document.getElementById('profile-btn');
    // Close notification panel if clicking outside
    if (notificationPanel && notificationPanel.classList.contains('show')) {
      if (!notificationPanel.contains(e.target) && !notificationBtn.contains(e.target)) {
        notificationPanel.classList.remove('show');
        setTimeout(() => {
          notificationPanel.style.display = 'none';
        }, 300);
      }
    }
    // Close profile panel if clicking outside
    if (profilePanel && profilePanel.classList.contains('show')) {
      if (!profilePanel.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePanel.classList.remove('show');
        setTimeout(() => {
          profilePanel.style.display = 'none';
        }, 300);
      }
    }
  });
}
// Initialize notification button - using imported function from notification.js
// Initialize profile button
function initializeProfileButton() {
  const profileBtn = document.getElementById('profile-btn');
  if (!profileBtn) {
    console.warn('[HEADER] Profile button not found');
    return;
  }
  
  const updateProfilePanelPosition = () => {
    const profilePanel = document.getElementById('profile-panel');
    if (!profilePanel) return;
    
    const profileBtnRect = profileBtn.getBoundingClientRect();
    const headerHeight = 64; // Approximate header height
    
    // Position panel below the profile button, aligned to the right
    profilePanel.style.top = `${profileBtnRect.bottom + 8}px`;
    profilePanel.style.right = `${window.innerWidth - profileBtnRect.right}px`;
    profilePanel.style.left = 'auto';
  };
  
  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const notificationPanel = document.getElementById('notification-panel');
    if (notificationPanel && notificationPanel.classList.contains('show')) {
      notificationPanel.classList.remove('show');
      setTimeout(() => { notificationPanel.style.display = 'none'; }, 300);
    }
    const profilePanel = document.getElementById('profile-panel');
    if (profilePanel.classList.contains('show')) {
      profilePanel.classList.remove('show');
      setTimeout(() => { profilePanel.style.display = 'none'; }, 300);
    } else {
      // Update position before showing
      updateProfilePanelPosition();
      profilePanel.style.display = 'block';
      // Force reflow to ensure display is set before adding show class
      profilePanel.offsetHeight;
      setTimeout(() => {
        profilePanel.classList.add('show');
      }, 10);
    }
  });
  
  // Update position on window resize
  window.addEventListener('resize', updateProfilePanelPosition);
}
// Initialize menu toggle
function initializeMenuToggle() {
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', async () => {
      // Import sidebar functions dynamically
      try {
        const { openSidebar, closeSidebar } = await import('./sidebar.js');
        const isOpen = sidebar.classList.contains('open');
        if (isOpen) {
          closeSidebar();
        } else {
          openSidebar();
        }
        menuToggle.classList.toggle('active');
        // Update aria-expanded on menu toggle after a brief delay to ensure state is updated
        setTimeout(() => {
          menuToggle.setAttribute('aria-expanded', sidebar.classList.contains('open') ? 'true' : 'false');
        }, 50);
      } catch (error) {
        // Fallback to direct class toggle if import fails
        console.warn('Failed to import sidebar functions, using fallback:', error);
        sidebar.classList.toggle('open');
        menuToggle.classList.toggle('active');
        menuToggle.setAttribute('aria-expanded', sidebar.classList.contains('open') ? 'true' : 'false');
      }
    });
    // Set initial aria-expanded state
    menuToggle.setAttribute('aria-expanded', 'false');
  } else {
    console.warn('⚠️ Menu toggle or sidebar not found:', { menuToggle: Boolean(menuToggle), sidebar: Boolean(sidebar) });
  }
}
// Initialize theme toggle
function initializeThemeToggle() {
  const themeToggleBtn = document.getElementById('theme-toggle');
  if (!themeToggleBtn) {
    console.warn('[HEADER] Theme toggle button not found');
    return;
  }
  // Load saved theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);
  
  // Update sidebar toggle if it exists
  const sidebarToggleSwitch = document.getElementById('sidebar-toggle-switch');
  if (sidebarToggleSwitch) {
    sidebarToggleSwitch.classList.toggle('active', savedTheme === 'dark');
  }
  
  themeToggleBtn.addEventListener('click', () => {
    const rootElement = document.documentElement;
    const isDark = rootElement.classList.contains('dark');
    const newTheme = isDark ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update button appearance
    themeToggleBtn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    themeToggleBtn.textContent = isDark ? '🌙' : '☀️';
    
    // Sync sidebar toggle switch
    if (sidebarToggleSwitch) {
      sidebarToggleSwitch.classList.toggle('active', newTheme === 'dark');
    }
  });
  
  function applyTheme(theme) {
    const rootElement = document.documentElement;
    if (theme === 'dark') {
      rootElement.classList.add('dark');
    } else {
      rootElement.classList.remove('dark');
    }
  }
}
// Initialize header scroll behavior
// DISABLED: Header should always remain visible
function initializeHeaderScroll() {
  // Scroll behavior disabled - header should always be visible
  // This prevents the header from hiding when scrolling down
  
  // Reset any existing transform styles that might have been applied
  const header = document.querySelector('.header-content');
  if (header) {
    header.style.transform = 'translateY(0)';
    header.style.transition = 'transform 0.3s ease';
  }
  
  // Old code (disabled):
  // let lastScrollY = window.scrollY;
  // window.addEventListener('scroll', () => {
  //   const currentScrollY = window.scrollY;
  //   const header = document.querySelector('.header-content');
  //   if (header) {
  //     if (currentScrollY > lastScrollY && currentScrollY > 100) {
  //       // Scrolling down
  //       header.style.transform = 'translateY(-100%)';
  //     } else {
  //       // Scrolling up
  //       header.style.transform = 'translateY(0)';
  //     }
  //   }
  //   lastScrollY = currentScrollY;
  // });
}
// Initialize dropdowns
function initializeDropdowns() {
  // Move dropdowns to body to avoid container issues
  const notificationPanel = document.getElementById('notification-panel');
  const profilePanel = document.getElementById('profile-panel');
  if (notificationPanel) {
    notificationPanel.remove();
    document.body.appendChild(notificationPanel);
    // CSS classes will handle the styling now
  }
  if (profilePanel) {
    profilePanel.remove();
    document.body.appendChild(profilePanel);
    // CSS classes will handle the styling now
  }
}
// Initialize header when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Add a small delay to ensure all elements are ready
  setTimeout(() => {
    const headerContainer = document.querySelector('.header-container');
    const headerElement = document.querySelector('#header');
    // Try .header-container first, then fall back to #header
    if (headerContainer) {
      const headerHTML = createHeader();
      headerContainer.innerHTML = headerHTML;
    } else if (headerElement) {
      const headerHTML = createHeader();
      headerElement.innerHTML = headerHTML;
    } else {
      console.warn('[HEADER] No header container or header element found!');
      // Try to create a header container as a fallback
      const {body} = document;
      if (body) {
        const fallbackHeader = document.createElement('div');
        fallbackHeader.className = 'header-container';
        fallbackHeader.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; z-index: 1000;';
        body.insertBefore(fallbackHeader, body.firstChild);
        const headerHTML = createHeader();
        fallbackHeader.innerHTML = headerHTML;
      } else {
        console.error('[HEADER] Cannot create fallback header - body not found');
        return;
      }
    }
    // Test if buttons were created
    const testNotificationBtn = document.getElementById('notification-btn');
    // Initialize header components
    // Fix dropdown positioning by ensuring parent containers have relative positioning
    const notificationContainer = document.querySelector('.notification-container');
    const profileContainer = document.querySelector('.profile-container');
    if (notificationContainer) {
      notificationContainer.style.position = 'relative';
    }
    if (profileContainer) {
      profileContainer.style.position = 'relative';
    }
    // Move dashboard clock into header-right to align with buttons (put it first)
    try {
      const headerRight = document.querySelector('.header-right');
      const clockEl = document.getElementById('dashboard-clock');
      if (headerRight && clockEl) {
        headerRight.insertBefore(clockEl, headerRight.firstChild);
      }
    } catch (e) {
      console.warn('[HEADER] Clock positioning failed:', e);
    }
    // Add a small delay to ensure DOM is fully updated
    setTimeout(() => {
      initializeNotificationButton();
      initializeProfileButton();
      initializeMenuToggle(); // Initialize menu toggle after header HTML is created
      initializeThemeToggle();
      initializeHeaderScroll();
      initializeDropdowns();
      initializeGlobalClickHandler();
    }, 50);
  }, 100); // Close setTimeout
}); // Close DOMContentLoaded
