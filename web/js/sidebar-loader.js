/**
 * Sidebar Loader Module
 * Handles loading and managing modular sidebars for Citizen and LGU dashboards
 */

// Sidebar Loader for CitizenLink
// Dynamically loads sidebar based on user type and sets up functionality

class SidebarLoader {
  constructor() {
    this.userType = null;
    this.sidebarLoaded = false;
    this.functionalitySetup = false;
    this.maxRetries = 10;
    this.retryCount = 0;
    this.retryInterval = 100; // 100ms between retries
    this._refreshTimer = null; // debounce timer for refresh

    // Check if sidebar already exists
    if (document.getElementById('sidebar')) {
      console.log("SidebarLoader: Sidebar already exists, skipping initialization");
      this.sidebarLoaded = true;
      this.setupSidebarFunctionality();
      return;
    }
    
    this.init();
  }

  async init() {
    try {
      console.log("SidebarLoader: Initializing...");

      // Check if user is authenticated
      const user = this.getUserFromStorage();
      if (!user) {
        console.log("SidebarLoader: No user found, trying to determine user type from URL");
        // Try to determine user type from current URL
        const currentPath = window.location.pathname;
        if (currentPath.includes('/lgu/')) {
          this.userType = "lgu";
        } else if (currentPath.includes('/citizen/')) {
          this.userType = "citizen";
        } else {
          this.userType = "lgu"; // Default to LGU for complaints page
        }
        console.log("SidebarLoader: Determined user type from URL:", this.userType);
      } else {
        this.userType = user.role || user.type || "lgu";
        console.log("SidebarLoader: User type from storage:", this.userType);
      }

      // Load sidebar HTML
      await this.loadSidebar();

      // Setup functionality after sidebar is loaded
      this.setupSidebarFunctionality();
      
      console.log("SidebarLoader: Initialization complete");
    } catch (error) {
      console.error("Error initializing sidebar:", error);
    }
  }

  getUserFromStorage() {
    try {
      const userData = sessionStorage.getItem("user");
      if (userData) {
        return JSON.parse(userData);
      }
      return null;
    } catch (error) {
      console.error("Error reading user from storage:", error);
      return null;
    }
  }

  async loadSidebar() {
    try {
      console.log("SidebarLoader: Loading sidebar...");

      // Check if sidebar already exists to prevent duplicate loading
      if (document.getElementById('sidebar')) {
        console.log("SidebarLoader: Sidebar already exists, skipping load");
        this.sidebarLoaded = true;
        return;
      }

      // Determine sidebar file based on role/type (supports lgu-admin-<dept> and lgu-<dept>)
      let sidebarFile = "citizen-sidebar.html";
      const roleStr = String(this.userType || "").toLowerCase();
      const isSuperadmin = roleStr === "superadmin";
      const isLguRole = (
        roleStr === "lgu" ||
        roleStr === "lgu_admin" ||
        roleStr === "admin" ||
        roleStr.startsWith("lgu-") ||
        roleStr.startsWith("lgu_admin") ||
        roleStr.startsWith("lgu-admin")
      );
      if (isLguRole && !isSuperadmin) {
        sidebarFile = "lgu-sidebar.html";
      }

      console.log("SidebarLoader: Using sidebar file:", sidebarFile);

      // Fetch sidebar HTML
      const response = await fetch(`../components/${sidebarFile}`);
      if (!response.ok) {
        throw new Error(
          `Failed to load sidebar: ${response.status} ${response.statusText}`
        );
      }

      const sidebarHTML = await response.text();
      

      // Insert sidebar into DOM
      const sidebarContainer = document.createElement("div");
      sidebarContainer.innerHTML = sidebarHTML;
      const sidebar = sidebarContainer.firstElementChild;

      if (!sidebar) {
        throw new Error("No sidebar element found in loaded HTML");
      }

      // Insert sidebar at the beginning of dashboard-container
      const dashboardContainer = document.querySelector(".dashboard-container");
      if (!dashboardContainer) {
        throw new Error("Dashboard container not found");
      }

      dashboardContainer.insertBefore(sidebar, dashboardContainer.firstChild);
      

      // Mark sidebar as loaded
      this.sidebarLoaded = true;

      // Open by default on desktop widths
      if (window.innerWidth > 992) {
        sidebar.classList.add("open");
      }

      // Wait a bit for DOM to settle
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Update user name in sidebar
      this.updateSidebarUserName();
    } catch (error) {
      console.error("Error loading sidebar:", error);
      throw error;
    }
  }

  setupSidebarFunctionality() {
    // Wait for sidebar to be available
    this.waitForSidebar(() => {
      const sidebar = document.getElementById("sidebar");
      const sidebarToggle = document.getElementById("sidebar-toggle");
      const sidebarOverlay = document.getElementById("sidebar-overlay");

      if (!sidebar) {
        console.error("Sidebar element not found in setupSidebarFunctionality");
        return;
      }

      // Ensure sidebar starts closed by default
      sidebar.classList.remove("open");

      // Set active page based on current URL
      this.setActivePage();

      // Remove existing event listeners to prevent duplicates
      if (sidebarToggle) {
        const newToggle = sidebarToggle.cloneNode(true);
        sidebarToggle.parentNode.replaceChild(newToggle, sidebarToggle);
        
        // Add new event listener
        newToggle.addEventListener("click", () => {
          sidebar.classList.toggle("open");
          if (sidebarOverlay) {
            sidebarOverlay.classList.toggle("active");
          }
        });
      }

      // Close sidebar when clicking overlay
      if (sidebarOverlay) {
        sidebarOverlay.addEventListener("click", () => {
          sidebar.classList.remove("open");
          sidebarOverlay.classList.remove("active");
        });
      }

      // Close sidebar when clicking close button
      const sidebarClose = document.getElementById("sidebar-close");
      if (sidebarClose) {
        sidebarClose.addEventListener("click", () => {
          sidebar.classList.remove("open");
          if (sidebarOverlay) {
            sidebarOverlay.classList.remove("active");
          }
        });
      }

      // Close sidebar when clicking outside (for mobile)
      document.addEventListener("click", (e) => {
        if (window.innerWidth <= 768) {
          if (
            !sidebar.contains(e.target) &&
            !sidebarToggle.contains(e.target)
          ) {
            sidebar.classList.remove("open");
            if (sidebarOverlay) {
              sidebarOverlay.classList.remove("active");
            }
          }
        }
      });

      
    });
  }

  // Debounced refresh entry point used by visibility/focus listeners
  requestThrottledRefresh() {
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
    }
    this._refreshTimer = setTimeout(() => {
      try {
        // If sidebar not yet loaded, try load then refresh
        if (!this.sidebarLoaded) {
          this.loadSidebar().then(() => this.refreshSidebarForPage());
        } else {
          this.refreshSidebarForPage();
        }
      } catch (_) {
        // swallow errors to avoid breaking global listeners
      }
    }, 200);
  }

  waitForSidebar(callback) {
    const checkSidebar = () => {
      const sidebar = document.getElementById("sidebar");
      if (sidebar) {
        
        callback();
      } else if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(
          `Sidebar not found, retrying... (${this.retryCount}/${this.maxRetries})`
        );
        setTimeout(checkSidebar, this.retryInterval);
      } else {
        console.error("Sidebar not found after maximum retries");
      }
    };

    checkSidebar();
  }

  setActivePage() {
    
    const currentPath = window.location.pathname;
    

    const sidebarLinks = document.querySelectorAll(".sidebar-nav a");
    

    sidebarLinks.forEach((link) => {
      const href = link.getAttribute("href");
      

      // Remove any existing active class
      link.classList.remove("active");

      // Check if this link matches the current page
      if (href === currentPath) {
        
        link.classList.add("active");
      } else if (
        currentPath.includes("/citizen/") &&
        href.includes("/citizen/")
      ) {
        // Handle citizen pages
        if (currentPath.includes("dashboard") && href.includes("dashboard")) {
          link.classList.add("active");
        } else if (
          currentPath.includes("submit-complaint") &&
          href.includes("submit-complaint")
        ) {
          link.classList.add("active");
        } else if (
          currentPath.includes("my-complaints") &&
          href.includes("my-complaints")
        ) {
          link.classList.add("active");
        } else if (
          currentPath.includes("profile") &&
          href.includes("profile")
        ) {
          link.classList.add("active");
        }
      } else if (currentPath.includes("/lgu/") && href.includes("/lgu/")) {
        // Handle LGU pages
        if (currentPath.includes("dashboard") && href.includes("dashboard")) {
          link.classList.add("active");
        } else if (
          currentPath.includes("complaints") &&
          href.includes("complaints")
        ) {
          link.classList.add("active");
        } else if (
          currentPath.includes("heatmap") &&
          href.includes("heatmap")
        ) {
          link.classList.add("active");
        } else if (
          currentPath.includes("insights") &&
          href.includes("insights")
        ) {
          link.classList.add("active");
        }
      }
    });
  }

  updateSidebarUserName() {
    
    const user = this.getUserFromStorage();
    if (!user) {
      
      return;
    }

    // Update user name in sidebar
    const userNameElement = document.getElementById("user-name");
    if (userNameElement) {
      const displayName = user.name || user.userName || user.email || "User";
      userNameElement.textContent = displayName;
      
    }

    // Setup logout functionality
    this.setupLogoutFunctionality();
  }

  setupLogoutFunctionality() {
    
    const logoutBtn = document.getElementById("logout-btn");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        

        try {
          // Clear session storage
          sessionStorage.removeItem("user");
          sessionStorage.removeItem("signup_email");
          sessionStorage.removeItem("signup_fullName");
          sessionStorage.removeItem("signup_username");
          sessionStorage.removeItem("signup_phone");
          sessionStorage.removeItem("signup_user_id");

          // Redirect to login page
          window.location.href = "/login";
        } catch (error) {
          console.error("Error during logout:", error);
          // Force redirect even if there's an error
          window.location.href = "/login";
        }
      });

      
    } else {
      
    }

    // Make this method available globally for other scripts to call
    if (typeof window !== "undefined") {
      window.refreshSidebarUserName = () => {
        this.updateSidebarUserName();
      };
      
      // Add method to refresh sidebar functionality
      window.refreshSidebar = () => {
        console.log("Refreshing sidebar functionality...");
        this.setupSidebarFunctionality();
      };
    }
  }
  
  // Method to refresh sidebar when navigating back to a page
  refreshSidebarForPage() {
    console.log("Refreshing sidebar for current page...");
    
    // Update active page
    this.setActivePage();
    
    // Update user name
    this.updateSidebarUserName();
    
    // Ensure sidebar is properly closed
    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      sidebar.classList.remove("open");
    }
    
    const overlay = document.getElementById("sidebar-overlay");
    if (overlay) {
      overlay.classList.remove("active");
    }
  }
}

// Auto-initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Only create one instance globally
  if (!window.sidebarLoader) {
    window.sidebarLoader = new SidebarLoader();
  }
});

// Listen for user data updates
window.addEventListener("storage", (e) => {
  if (e.key === "user" && window.sidebarLoader) {
    window.sidebarLoader.updateSidebarUserName();
  }
});

// Listen for page visibility changes (when navigating back to a page)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && window.sidebarLoader) {
    window.sidebarLoader.requestThrottledRefresh();
  }
});

// Listen for page focus (when navigating back to a page)
window.addEventListener("focus", () => {
  if (window.sidebarLoader) {
    window.sidebarLoader.requestThrottledRefresh();
  }
});

// Also try to initialize if DOM is already loaded
if (document.readyState === "loading") {
  // DOM is still loading, wait for DOMContentLoaded
} else {
  // DOM is already loaded, create instance if none exists
  if (!window.sidebarLoader) {
    window.sidebarLoader = new SidebarLoader();
  }
}
