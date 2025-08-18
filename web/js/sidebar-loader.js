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

    console.log("SidebarLoader initialized");
    this.init();
  }

  async init() {
    try {
      console.log("Starting sidebar initialization...");

      // Check if user is authenticated
      const user = this.getUserFromStorage();
      if (!user) {
        console.log("No user found in sidebar loader");
        // Don't redirect immediately, let the page handle it
        return;
      }

      this.userType = user.role || user.type || "citizen";
      console.log("User type detected:", this.userType);

      // Load sidebar HTML
      await this.loadSidebar();

      // Setup functionality after sidebar is loaded
      this.setupSidebarFunctionality();
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
      console.log("Loading sidebar for user type:", this.userType);

      // Determine sidebar file based on user type
      let sidebarFile = "citizen-sidebar.html";
      if (
        this.userType === "lgu" ||
        this.userType === "lgu_admin" ||
        this.userType === "admin"
      ) {
        sidebarFile = "lgu-sidebar.html";
      }

      console.log("Loading sidebar file:", sidebarFile);

      // Fetch sidebar HTML
      const response = await fetch(`/components/${sidebarFile}`);
      if (!response.ok) {
        throw new Error(
          `Failed to load sidebar: ${response.status} ${response.statusText}`
        );
      }

      const sidebarHTML = await response.text();
      console.log("Sidebar HTML loaded, length:", sidebarHTML.length);

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
      console.log("Sidebar inserted into DOM");

      // Mark sidebar as loaded
      this.sidebarLoaded = true;

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
    console.log("Setting up sidebar functionality...");

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

      // Sidebar toggle functionality
      if (sidebarToggle) {
        sidebarToggle.addEventListener("click", () => {
          console.log("Sidebar toggle clicked");
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

      console.log("Sidebar functionality setup complete");
    });
  }

  waitForSidebar(callback) {
    const checkSidebar = () => {
      const sidebar = document.getElementById("sidebar");
      if (sidebar) {
        console.log("Sidebar found, executing callback");
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
    console.log("Setting active page...");
    const currentPath = window.location.pathname;
    console.log("Current path:", currentPath);

    const sidebarLinks = document.querySelectorAll(".sidebar-nav a");
    console.log("Found sidebar links:", sidebarLinks.length);

    sidebarLinks.forEach((link) => {
      const href = link.getAttribute("href");
      console.log("Checking link:", href, "against current path:", currentPath);

      // Remove any existing active class
      link.classList.remove("active");

      // Check if this link matches the current page
      if (href === currentPath) {
        console.log("Setting active for:", href);
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
    console.log("Updating sidebar user name...");
    const user = this.getUserFromStorage();
    if (!user) {
      console.log("No user found for sidebar name update");
      return;
    }

    // Update user name in sidebar
    const userNameElement = document.getElementById("user-name");
    if (userNameElement) {
      const displayName = user.name || user.userName || user.email || "User";
      userNameElement.textContent = displayName;
      console.log("Updated sidebar user name to:", displayName);
    }

    // Setup logout functionality
    this.setupLogoutFunctionality();
  }

  setupLogoutFunctionality() {
    console.log("Setting up logout functionality...");
    const logoutBtn = document.getElementById("logout-btn");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        console.log("Logout button clicked");

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

      console.log("Logout functionality setup complete");
    } else {
      console.log("Logout button not found in sidebar");
    }

    // Make this method available globally for other scripts to call
    if (typeof window !== "undefined") {
      window.refreshSidebarUserName = () => {
        this.updateSidebarUserName();
      };
    }
  }
}

// Auto-initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing SidebarLoader");
  window.sidebarLoader = new SidebarLoader();
});

// Listen for user data updates
window.addEventListener("storage", (e) => {
  if (e.key === "user" && window.sidebarLoader) {
    console.log("User data updated, refreshing sidebar user name");
    window.sidebarLoader.updateSidebarUserName();
  }
});

// Also try to initialize if DOM is already loaded
if (document.readyState === "loading") {
  console.log("DOM still loading, waiting for DOMContentLoaded");
} else {
  console.log("DOM already loaded, initializing SidebarLoader immediately");
  new SidebarLoader();
}
