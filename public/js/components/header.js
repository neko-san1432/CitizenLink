import { brandConfig } from "../config/index.js";
import { initializeNotificationButton } from "./notification.js";
import themeManager from "../utils/theme.js";

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
        <div class="theme-container">
          <button id="theme-btn" class="header-action theme-btn" aria-label="Toggle Theme" title="Toggle Theme">
             <!-- Icon set by JS -->
          </button>
        </div>

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
            <div class="dropdown-content">
              <a href="/profile" class="dropdown-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                Profile
              </a>
              <a href="/settings" class="dropdown-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                Profile Settings
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
// Initialize global click handler to close dropdowns
function initializeGlobalClickHandler() {
  document.addEventListener("click", (e) => {
    const notificationPanel = document.getElementById("notification-panel");
    const profilePanel = document.getElementById("profile-panel");
    const notificationBtn = document.getElementById("notification-btn");
    const profileBtn = document.getElementById("profile-btn");

    // Close notification panel if clicking outside
    if (notificationPanel && notificationPanel.classList.contains("show")) {
      if (!notificationPanel.contains(e.target) && (!notificationBtn || !notificationBtn.contains(e.target))) {
        notificationPanel.classList.remove("show");
        setTimeout(() => {
          notificationPanel.style.display = "none";
        }, 300);
      }
    }

    // Close profile panel if clicking outside
    if (profilePanel && profilePanel.classList.contains("show")) {
      if (!profilePanel.contains(e.target) && (!profileBtn || !profileBtn.contains(e.target))) {
        profilePanel.classList.remove("show");
        setTimeout(() => {
          profilePanel.style.display = "none";
        }, 300);
      }
    }

    // Close theme panel if clicking outside
    const themePanel = document.getElementById("theme-panel");
    const themeBtn = document.getElementById("theme-btn");
    if (themePanel && themePanel.classList.contains("show")) {
      if (!themePanel.contains(e.target) && (!themeBtn || !themeBtn.contains(e.target))) {
        themePanel.classList.remove("show");
        setTimeout(() => {
          themePanel.style.display = "none";
        }, 300);
      }
    }
  });
}
// Initialize notification button - using imported function from notification.js
// Initialize profile button
// Initialize profile button
function initializeProfileButton() {
  const profileBtn = document.getElementById("profile-btn");
  if (!profileBtn) {
    console.warn("[HEADER] Profile button not found");
    return;
  }

  // Clone button to remove any existing listeners (prevents duplicates)
  const newProfileBtn = profileBtn.cloneNode(true);
  profileBtn.parentNode.replaceChild(newProfileBtn, profileBtn);

  newProfileBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    // Close notification panel first
    const notificationPanel = document.getElementById("notification-panel");
    if (notificationPanel && notificationPanel.classList.contains("show")) {
      notificationPanel.classList.remove("show");
    }

    const profilePanel = document.getElementById("profile-panel");
    if (!profilePanel) return;

    if (profilePanel.classList.contains("show")) {
      profilePanel.classList.remove("show");
      setTimeout(() => {
        profilePanel.style.display = "none";
      }, 300);
    } else {
      // Position the panel
      const rect = newProfileBtn.getBoundingClientRect();
      const panelWidth = 280; // Default width

      // Calculate position (right-aligned to button)
      let left = rect.right - panelWidth;
      // Ensure it doesn't go off-screen
      if (left < 10) left = 10;

      profilePanel.style.position = "fixed";
      profilePanel.style.top = `${rect.bottom + 10}px`;
      profilePanel.style.left = `${left}px`;
      profilePanel.style.right = "auto";

      // Ensure display is block (in case it was hidden by close handler)
      profilePanel.style.display = "block";
      // Small delay to allow display to apply before transition
      requestAnimationFrame(() => {
        profilePanel.classList.add("show");
      });
    }
  });
}

// Initialize logout button
function initializeLogoutButton() {
  const logoutBtn = document.getElementById("logout-btn");
  if (!logoutBtn) {
    console.warn("[HEADER] Logout button not found");
    return;
  }

  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      // Clear server session
      await fetch("/auth/session", { method: "DELETE" });

      // Clear Supabase session
      const { supabase } = await import("../config/config.js");
      await supabase.auth.signOut();

      // Clear local storage
      localStorage.clear();

      // Clear cookies
      document.cookie = "sb_access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "app_mode=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

      // Redirect to login
      window.location.href = "/login";
    } catch (error) {
      console.error("[HEADER] Logout error:", error);
      // Force redirect even if logout fails
      window.location.href = "/login";
    }
  });
}
// Initialize menu toggle
function initializeMenuToggle() {
  // console.log removed for security
  const menuToggle = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", async () => {
      // Import sidebar functions dynamically
      try {
        const { openSidebar, closeSidebar } = await import("./sidebar.js");
        const isOpen = sidebar.classList.contains("open");
        if (isOpen) {
          closeSidebar();
        } else {
          openSidebar();
        }
        menuToggle.classList.toggle("active");
        // Update aria-expanded on menu toggle after a brief delay to ensure state is updated
        setTimeout(() => {
          menuToggle.setAttribute(
            "aria-expanded",
            sidebar.classList.contains("open") ? "true" : "false"
          );
        }, 50);
      } catch (error) {
        // Fallback to direct class toggle if import fails
        console.warn(
          "Failed to import sidebar functions, using fallback:",
          error
        );
        sidebar.classList.toggle("open");
        menuToggle.classList.toggle("active");
        menuToggle.setAttribute(
          "aria-expanded",
          sidebar.classList.contains("open") ? "true" : "false"
        );
      }
    });
    // Set initial aria-expanded state
    menuToggle.setAttribute("aria-expanded", "false");
  } else {
    console.warn("⚠️ Menu toggle or sidebar not found:", {
      menuToggle: Boolean(menuToggle),
      sidebar: Boolean(sidebar),
    });
  }
}
// Initialize theme toggle
function initializeThemeToggle() {
  const themeBtn = document.getElementById("theme-btn");
  if (!themeBtn) return;

  // Import getIcon dynamically if needed, or assume it's available via global or import
  // We'll use innerHTML for simplicity since we want specific SVG content

  const updateIcon = (theme) => {
    // If dark, show Sun (to switch to light). If light, show Moon.
    // OR show current state. Standard is usually "Show what will happen" or "Show current state".
    // Let's show the CURRENT state icon (Moon = Dark Mode is Active).

    // Actually, usually a toggle button shows the icon of the mode you are IN.
    const isDark = theme === 'dark';

    // Using inline SVG for reliability or importing getIcon if we could. 
    // Let's stick to the inline SVGs previously used but simplified.

    if (isDark) {
      // Moon
      themeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
      themeBtn.title = "Current: Dark Mode";
    } else {
      // Sun
      themeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
      themeBtn.title = "Current: Light Mode";
    }
  };

  // Initial state
  updateIcon(themeManager.getStoredTheme());

  // Click Listener: Toggle
  themeBtn.addEventListener("click", () => {
    const newTheme = themeManager.toggle();
    updateIcon(newTheme);
  });

  // Listen for global changes (e.g. from Sidebar)
  window.addEventListener("themeChanged", (e) => {
    updateIcon(e.detail.theme);
  });
}
// Initialize header scroll behavior
function initializeHeaderScroll() {
  // console.log removed for security
  let lastScrollY = window.scrollY;
  window.addEventListener("scroll", () => {
    const currentScrollY = window.scrollY;
    const header = document.querySelector(".header-content");
    if (header) {
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down
        header.style.transform = "translateY(-100%)";
      } else {
        // Scrolling up
        header.style.transform = "translateY(0)";
      }
    }
    lastScrollY = currentScrollY;
  });
}
// Initialize dropdowns
// Initialize dropdowns
function initializeDropdowns() {
  // Move dropdowns to body to avoid container issues (clipping)
  // Only move if not already direct child of body
  const notificationPanel = document.getElementById("notification-panel");
  const profilePanel = document.getElementById("profile-panel");

  if (notificationPanel && notificationPanel.parentNode !== document.body) {
    notificationPanel.parentNode.removeChild(notificationPanel);
    document.body.appendChild(notificationPanel);
  }

  if (profilePanel && profilePanel.parentNode !== document.body) {
    profilePanel.parentNode.removeChild(profilePanel);
    document.body.appendChild(profilePanel);
  }

  const themePanel = document.getElementById("theme-panel");
  if (themePanel && themePanel.parentNode !== document.body) {
    themePanel.parentNode.removeChild(themePanel);
    document.body.appendChild(themePanel);
  }
}
// Initialize header when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Add a small delay to ensure all elements are ready
  setTimeout(() => {
    // console.log removed for security
    const headerContainer = document.querySelector(".header-container");
    const headerElement = document.querySelector("#header");
    // console.log removed for security
    // console.log removed for security
    // Try .header-container first, then fall back to #header
    if (headerContainer) {
      // console.log removed for security
      const headerHTML = createHeader();
      // console.log removed for security
      headerContainer.innerHTML = headerHTML;
    } else if (headerElement) {
      // console.log removed for security
      const headerHTML = createHeader();
      // console.log removed for security
      headerElement.innerHTML = headerHTML;
    } else {
      console.warn("[HEADER] No header container or header element found!");
      // Try to create a header container as a fallback
      const { body } = document;
      if (body) {
        // console.log removed for security
        const fallbackHeader = document.createElement("div");
        fallbackHeader.className = "header-container";
        fallbackHeader.style.cssText =
          "position: fixed; top: 0; left: 0; right: 0; z-index: 1000;";
        body.insertBefore(fallbackHeader, body.firstChild);
        const headerHTML = createHeader();
        fallbackHeader.innerHTML = headerHTML;
        // console.log removed for security
      } else {
        console.error(
          "[HEADER] Cannot create fallback header - body not found"
        );
        return;
      }
    }
    // Test if buttons were created
    const _testNotificationBtn = document.getElementById("notification-btn");
    const _testProfileBtn = document.getElementById("profile-btn");
    // console.log removed for security
    // Fix dropdown positioning by ensuring parent containers have relative positioning
    const notificationContainer = document.querySelector(
      ".notification-container"
    );
    const profileContainer = document.querySelector(".profile-container");
    if (notificationContainer) {
      notificationContainer.style.position = "relative";
    }
    if (profileContainer) {
      profileContainer.style.position = "relative";
    }
    const themeContainer = document.querySelector(".theme-container");
    if (themeContainer) {
      themeContainer.style.position = "relative";
    }
    // Move dashboard clock into header-right to align with buttons (put it first)
    try {
      const headerRight = document.querySelector(".header-right");
      const clockEl = document.getElementById("dashboard-clock");
      if (headerRight && clockEl) {
        headerRight.insertBefore(clockEl, headerRight.firstChild);
      }
    } catch (e) {
      console.warn("[HEADER] Clock positioning failed:", e);
    }
    // Add a small delay to ensure DOM is fully updated
    setTimeout(() => {
      initializeNotificationButton();
      initializeProfileButton();
      initializeLogoutButton();
      initializeMenuToggle(); // Initialize menu toggle after header HTML
      // The following functions are not defined in the provided context,
      // assuming they are meant to be added or are placeholders.
      // setupRoleToggle();
      // setupClickOutside();
      // setupThemeToggle();

      console.log("Header initialized with components");

      /* =========================================================================
         Dynamic Dashboard Layout Wrapper
         =========================================================================
         This logic automatically restructures legacy layouts to merge the header
         inside the #app container and apply flex-column layouts, identical to
         the citizen/coordinator dashboards. It prevents the need to manually
         edit 50+ HTML pages.
      */
      const appContainer = document.getElementById('app');
      const headerContainer = document.querySelector('.header-container');
      const isMapView = window.location.pathname.includes('heatmap') || window.location.pathname.includes('map');

      if (appContainer && headerContainer && appContainer.parentNode && !isMapView) {
        // Check if header is outside app (legacy layout)
        if (headerContainer.parentNode !== appContainer) {
          // 1. Give app flex props
          appContainer.style.display = 'flex';
          appContainer.style.flexDirection = 'column';

          // 2. Move Header into app
          if (appContainer.firstChild) {
            appContainer.insertBefore(headerContainer, appContainer.firstChild);
          } else {
            appContainer.appendChild(headerContainer);
          }

          // 3. Wrap remaining app children in the scrollable wrapper
          const wrapper = document.createElement('div');
          wrapper.className = 'dashboard-main-wrapper';
          wrapper.style.display = 'flex';
          wrapper.style.flexDirection = 'column';
          wrapper.style.flex = '1';
          wrapper.style.overflowY = 'auto';
          // For legacy non-dashboard pages, we supply generic padding to mimic dashboard-common.css margins
          wrapper.style.padding = 'var(--space-6)';

          // Move everything EXCEPT the newly inserted header into the wrapper
          Array.from(appContainer.childNodes).forEach(node => {
            if (node !== headerContainer) {
              wrapper.appendChild(node);
            }
          });
          appContainer.appendChild(wrapper);
          console.log('Dynamically applied flex layout wrapper.');
        }
      }
      initializeThemeToggle();
      initializeHeaderScroll();
      initializeDropdowns();
      initializeGlobalClickHandler();
    }, 50);
  }, 100); // Close setTimeout
}); // Close DOMContentLoaded
