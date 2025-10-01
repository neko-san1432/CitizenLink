import { brandConfig } from '../config/index.js';
import { initializeNotificationButton, closeNotificationPanel } from './notification.js';

// Header component for easy modification
export function createHeader() {
  return `
    <div class="header-left">
      <div id="menu-toggle">☰</div>
      <a href="${brandConfig.dashboardUrl}" class="brand-logo">${brandConfig.name}</a>
    </div>
    <div class="header-right">
      <div class="notification-container">
        <button id="notification-btn" class="notification-btn" title="Notifications">
          🔔
          <span id="notification-badge" class="notification-badge">0</span>
        </button>
        <div id="notification-panel" class="notification-panel hidden">
          <div class="notification-header">
            <h3>Notifications</h3>
            <button id="close-notifications" class="close-btn">×</button>
          </div>
          <div class="notification-content" id="notification-content">
            <!-- Notifications will be loaded here -->
          </div>
          <div class="notification-footer">
            <button id="mark-all-read" class="mark-read-btn">Mark all as read</button>
            <button id="show-more-notifications" class="show-more-btn">Show More</button>
          </div>
          <div id="notification-loading" class="notification-loading hidden">
            <div class="loading-spinner"></div>
            <span>Loading notifications...</span>
          </div>
          <div id="notification-error" class="notification-error hidden">
            <div class="error-icon">⚠️</div>
            <span>Failed to load notifications</span>
            <button id="retry-notifications" class="retry-btn">Retry</button>
          </div>
        </div>
      </div>
      
      <div class="profile-container">
        <button id="profile-btn" class="profile-btn" title="Profile">
          <div class="profile-avatar">👤</div>
        </button>
        <div id="profile-panel" class="profile-panel hidden">
          <div class="profile-header">
            <h3>Profile</h3>
            <button id="close-profile" class="close-btn">×</button>
          </div>
          <div class="profile-content">
            <div class="profile-item" id="my-profile-item">
              <div class="profile-icon">👤</div>
              <div class="profile-text">
                <div class="profile-title">My Profile</div>
              </div>
            </div>
            <div class="profile-item" id="logout-item">
              <div class="profile-icon">🚪</div>
              <div class="profile-text">
                <div class="profile-title">Logout</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Initialize header when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  const headerContainer = document.querySelector('.header-container');
  if (headerContainer) {
    headerContainer.innerHTML = createHeader();
    initializeNotificationButton();
    initializeProfileButton();
  }
});

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
      profilePanel.classList.toggle('hidden');
      
      // Close notification panel when profile is opened
      closeNotificationPanel();
    });
    
    // Close panel when close button is clicked
    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        profilePanel.classList.add('hidden');
      });
    }
    
    // My Profile functionality
    if (myProfileItem) {
      myProfileItem.addEventListener('click', function() {
        window.location.href = '/myProfile';
        profilePanel.classList.add('hidden');
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
        profilePanel.classList.add('hidden');
      });
    }
    
    // Close panel when clicking outside
    document.addEventListener('click', function(e) {
      if (!profilePanel.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePanel.classList.add('hidden');
      }
    });
  }
}