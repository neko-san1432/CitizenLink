import { getUserRole } from "../auth/authChecker.js";
import { brandConfig } from "../config/brand.js";
import { getMenuIcon, getIcon } from "../utils/icons.js";
import { normalizeRole } from "../utils/roleUtils.js";

const _sidebarEl = document.getElementById("sidebar");
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

  // FORCE Z-INDEX to ensure it stays on top
  if (_sidebarEl) {
    _sidebarEl.style.zIndex = "9999";
  }

  // Add accessibility attributes
  if (_sidebarEl) {
    _sidebarEl.setAttribute("role", "navigation");
    _sidebarEl.setAttribute("aria-label", "Main navigation");
    _sidebarEl.setAttribute("aria-expanded", "false");
  }
  // Add Esc key handler
  document.addEventListener("keydown", handleEscKey);
}

function handleEscKey(e) {
  if (
    e.key === "Escape" &&
    _sidebarEl &&
    _sidebarEl.classList.contains("open")
  ) {
    closeSidebar();
  }
}

function createBackdrop() {
  if (!backdropEl) {
    backdropEl = document.createElement("div");
    backdropEl.className = "sidebar-backdrop";
    backdropEl.setAttribute("aria-hidden", "true");
    document.body.appendChild(backdropEl);

    // Add click handler to close sidebar
    backdropEl.addEventListener("click", () => {
      closeSidebar();
    });
  }
  // Activate backdrop
  backdropEl.classList.add("active");
  backdropEl.setAttribute("aria-hidden", "false");
}

function removeBackdrop() {
  if (backdropEl) {
    backdropEl.classList.remove("active");
    backdropEl.setAttribute("aria-hidden", "true");
    // Remove backdrop after transition
    setTimeout(() => {
      if (backdropEl && !backdropEl.classList.contains("active")) {
        backdropEl.remove();
        backdropEl = null;
      }
    }, 300);
  }
}

function openSidebar() {
  if (_sidebarEl) {
    _sidebarEl.classList.add("open");
    _sidebarEl.setAttribute("aria-expanded", "true");
    createBackdrop();
  }
}

function closeSidebar() {
  if (_sidebarEl) {
    _sidebarEl.classList.remove("open");
    _sidebarEl.setAttribute("aria-expanded", "false");
    removeBackdrop();
  }
}

function initializeSidebarClose() {
  const closeBtn = document.getElementById("sidebar-close");
  if (closeBtn) {
    closeBtn.setAttribute("aria-label", "Close sidebar");
    closeBtn.addEventListener("click", () => {
      closeSidebar();
    });
  }
}
// Icon mapping now uses SVG icons from icons.js utility
async function setSidebarRole() {
  try {
    const overrideRole = localStorage.getItem("cl_role_override");
    const isCitizenMode = Boolean(document.cookie.match(/(^|;)\s*app_mode=citizen_mode/));

    let role = overrideRole || (isCitizenMode ? "citizen" : null);

    if (!role) {
      try {
        role = await getUserRole({ refresh: true });
      } catch (error) {
        console.error("Failed to get user role:", error);
      }

      // Try to get role from session as fallback
      if (!role) {
        try {
          const { supabase } = await import("../config/config.js");
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            const metadata = session.user.user_metadata || {};
            role = metadata.role || metadata.normalized_role;
          }
        } catch (sessionError) {
          console.error("Failed to get role from session:", sessionError);
        }
      }
    }
    // If still no role, try to get it from localStorage
    if (!role) {
      try {
        const { getUserMeta } = await import("../auth/authChecker.js");
        const userMeta = getUserMeta();
        role = userMeta?.role;
        // console.log removed for security
      } catch (error) {
        console.error("Failed to get role from localStorage:", error);
      }
    }
    if (!role) {
      console.error("No role found, redirecting to login");
      window.location.href = `/login?message=${encodeURIComponent(
        "Unable to determine user role. Please log in again."
      )}&type=error`;
      return;
    }
    const roleLower = role.toLowerCase();
    // console.log removed for security
    // Define menu items based on role
    const menuItems = getMenuItemsForRole(roleLower);
    // console.log removed for security
    // Build sidebar HTML
    if (_sidebarEl) {
      _sidebarEl.innerHTML = `
<div class="sidebar-brand">
  <div class="brand-logo">
    <img src="${brandConfig.logo.imageUrl}" alt="${brandConfig.name
} Logo" class="brand-icon" style="width: 32px; height: 32px; object-fit: contain;">
    <div class="brand-text">
      <a href="${brandConfig.dashboardUrl}" class="brand-link">${brandConfig.name} <span style="font-size: 8px; opacity: 0.5;">v2.4.5</span></a>
    </div>
  </div>
  <button id="sidebar-close" class="sidebar-close" aria-label="Close sidebar">×</button>
</div>

<div class="sidebar-menu">
          ${menuItems
    .map((item) => {
      if (item.children) {
        return `
              <div class="menu-group">
                <div class="menu-header no-anim">
                  <div class="menu-header-content">
                    <span class="menu-icon">${getMenuIcon(item.icon, {
    size: 20,
  })}</span>
                    <span>${item.label}</span>
                  </div>
                  ${getIcon("chevronDown", { className: "menu-chevron", size: 16 })}
                </div>
                <div class="menu-children">
                  ${item.children
    .map(
      (child) => `
                    <a href="${root}${child.url}" data-icon="${child.icon
}" aria-label="${child.label}">
                      <span class="menu-icon">${getMenuIcon(child.icon, {
    size: 18,
  })}</span>
                      <span>${child.label}</span>
                    </a>
                  `
    )
    .join("")}
                </div>
              </div>
            `;
      }
      return `
            <a href="${root}${item.url}" data-icon="${item.icon}" aria-label="${item.label
}">
              <span class="menu-icon">${getMenuIcon(item.icon, {
    size: 20,
  })}</span>
              <span>${item.label}</span>
            </a>
          `;
    })
    .join("")}
</div>
        
<div class="sidebar-bottom">
  <div class="theme-toggle" id="sidebar-theme-toggle">
    <div class="theme-toggle-label">
      <span class="menu-icon">${getIcon("darkMode", { size: 20 })}</span>
      <span>Dark Mode</span>
    </div>
    <div class="toggle-switch" id="toggle-switch"></div>
  </div>
  


  <div class="sidebar-footer">
    <a href="/logout" class="logout-link" data-icon="signout" aria-label="Sign out">
      <span class="menu-icon">${getMenuIcon("signout", {
    size: 20,
  })}</span>
      <span>Sign Out</span>
    </a>
  </div>
</div>
      `;

      // Re-initialize event listeners after HTML update
      initializeSidebarClose();
      initializeSidebarThemeToggle();
      initializeLogout();
      // Update active menu items with aria-current
      setActiveMenuItem();

      // Attach event listeners to expandable menus to replace inline onclick
      const menuHeaders = _sidebarEl.querySelectorAll(".menu-header");
      menuHeaders.forEach(header => {
        header.addEventListener("click", function() {
          if (this.parentElement) {
            this.parentElement.classList.toggle("expanded");
          }
        });
      });

      // console.log removed for security
    }
  } catch (error) {
    console.error("Failed to set sidebar role:", error);
    // Show error message to user
    if (_sidebarEl) {
      _sidebarEl.innerHTML = `
        <div class="sidebar-error">
          <div class="error-message">
            <h3>${getIcon("alert", { size: 24 })} Error</h3>
            <p>Failed to load sidebar. Please refresh the page.</p>
            <button id="sidebar-retry-btn" class="retry-btn">Retry</button>
          </div>
        </div>
      `;
      // Attach click handler safely
      const retryBtn = document.getElementById("sidebar-retry-btn");
      if (retryBtn) {
        retryBtn.addEventListener("click", () => window.location.reload());
      }
    }
  }
}
function getMenuItemsForRole(role) {
  // Normalize role using general normalization function
  const originalRole = role;
  role = normalizeRole(role);
  if (originalRole !== role) {
    console.log(
      "[SIDEBAR] Normalizing role from",
      originalRole,
      "to",
      role,
      "for menu items"
    );
  }

  // Simple Workflow Mode: Only 3 roles supported
  const menuItems = {
    citizen: [
      { url: "/dashboard", icon: "dashboard", label: "Dashboard" },
      { url: "/filecomplaint", icon: "filecomplaint", label: "File complaint" },
      { url: "/digos-map", icon: "map", label: "Digos City Map" },
      {
        label: "You",
        icon: "user",
        children: [
          { url: "/profile", icon: "user", label: "profile" },
          { url: "/settings", icon: "settings", label: "settings" },
        ]
      },
    ],
    lgu: [
      { url: "/dashboard", icon: "lgu-admin-dashboard", label: "Dashboard" },
      { url: "/review-queue", icon: "review-queue", label: "Review Queue" },

      { url: "/heatmap", icon: "heatmap", label: "Heatmap" },
      { url: "/publish", icon: "publication", label: "Public Bulletins" },
      {
        label: "Analytics",
        icon: "analytics",
        children: [
          {
            url: "/brainAnalytics-page?tab=system-training",
            label: "Training",
            icon: "brain",
          },
          {
            url: "/brainAnalytics-page?tab=temporal",
            label: "Temporal",
            icon: "chart-line",
          },
          {
            url: "/brainAnalytics-page?tab=categories",
            label: "Categories",
            icon: "tags",
          },
          {
            url: "/brainAnalytics-page?tab=edge-cases",
            label: "Smart Detection",
            icon: "microchip",
          },
          {
            url: "/brainAnalytics-page?tab=data-table",
            label: "Dataset",
            icon: "database",
          },
        ],
      },
      {
        url: "/dictionary-manager",
        icon: "dictionary",
        label: "Dictionary Manager",
      },
      {
        label: "You",
        icon: "briefcase",
        children: [
          { url: "/profile", icon: "user", label: "profile" },
          { url: "/settings", icon: "settings", label: "settings" },
        ]
      },
    ],
    "super-admin": [
      { url: "/dashboard", icon: "super-admin-dashboard", label: "Dashboard" },
      {
        url: "/super-admin/user-manager",
        icon: "role-changer",
        label: "User Manager",
      },
      {
        url: "/super-admin/server-logs",
        icon: "server-logs",
        label: "Server logs",
      },
      {
        url: "/super-admin/system-settings",
        icon: "sliders",
        label: "System Settings",
      },
      {
        label: "You",
        icon: "shield",
        children: [
          { url: "/profile", icon: "user", label: "profile" },
          { url: "/settings", icon: "settings", label: "settings" },
        ]
      },
    ],
  };

  // Map any legacy LGU roles to the unified "lgu" role
  if (role.startsWith("lgu-") || role === "complaint-coordinator") {
    role = "lgu";
  }

  // Return menu items for the role
  const items = menuItems[role] || menuItems["citizen"];
  return items;
}
// Sidebar search removed per requirements
// Theme toggle is handled by header.js - removed duplicate implementation
// But we need applyTheme function for compatibility
function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

function updateToggleSwitch(isDark) {
  const toggleSwitch = document.getElementById("toggle-switch");
  if (toggleSwitch) {
    if (isDark) {
      toggleSwitch.classList.add("active");
    } else {
      toggleSwitch.classList.remove("active");
    }
  }
}

function initializeSidebarThemeToggle() {
  const themeToggleBtn = document.getElementById("sidebar-theme-toggle");
  if (themeToggleBtn) {
    const updateSidebarState = () => {
      const stored = localStorage.getItem("theme-preference") || "dark";
      updateToggleSwitch(stored === "dark");
    };

    updateSidebarState();

    themeToggleBtn.addEventListener("click", () => {
      if (window.themeManager) {
        window.themeManager.toggle();
      } else {
        const isDark = document.documentElement.classList.contains("dark");
        const newTheme = isDark ? "light" : "dark";
        if (newTheme === "dark") document.documentElement.classList.add("dark");
        else document.documentElement.classList.remove("dark");
        localStorage.setItem("theme-preference", newTheme);
      }
    });

    window.addEventListener("themeChanged", (e) => {
      updateToggleSwitch(e.detail.theme === "dark");
    });
  }
}

function initializeRoleSwitcher() {
  const roleSwitcherBtn = document.getElementById("sidebar-role-switcher");
  if (roleSwitcherBtn) {
    roleSwitcherBtn.addEventListener("click", () => {
      const userMeta = JSON.parse(localStorage.getItem("cl_user_meta") || "{}");
      const realRole = normalizeRole(userMeta.role || "");
      const isOverridden = Boolean(localStorage.getItem("cl_role_override")) || document.cookie.includes("app_mode=citizen_mode");

      if (isOverridden) {
        // We are in Sim Mode, so we always allow going back
        localStorage.removeItem("cl_role_override");
        document.cookie = "app_mode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
      } else if (realRole === "super-admin" || realRole === "lgu") {
        // Not in Sim Mode, but user has permission to enter it
        localStorage.setItem("cl_role_override", "citizen");
        document.cookie = "app_mode=citizen_mode; path=/; max-age=31536000;";
      }

      // Redirect to dashboard to let the server route to the correct role's page
      window.location.href = "/dashboard";
    });
  }
}
function initializeLogout() {
  const logoutLink = document.querySelector(".logout-link");
  if (logoutLink) {
    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        // Clear server session
        await fetch("/auth/session", { method: "DELETE" });
        // Clear Supabase session
        const { supabase } = await import("../config/config.js");
        await supabase.auth.signOut();
        // Clear local storage
        localStorage.clear();
        // Redirect to login
        window.location.href = "/login";
      } catch (error) {
        console.error("Logout error:", error);
        // Force redirect even if logout fails
        window.location.href = "/login";
      }
    });
  }
}
// Set active menu item based on current page
function setActiveMenuItem() {
  const currentPath = window.location.pathname;
  const currentSearch = window.location.search;
  const fullCurrent = currentPath + currentSearch;

  const menuItems = document.querySelectorAll(".sidebar-menu a");
  const groups = document.querySelectorAll(".menu-group");

  // Clear group active states
  groups.forEach(g => g.classList.remove("child-active"));

  menuItems.forEach((item) => {
    const href = item.getAttribute("href");
    if (!href) return;

    // Normalize href for comparison
    const itemUrl = href.replace(root, "");

    // Exact match check (including search params for tabbed pages)
    let isMatch = false;
    if (itemUrl.includes("?")) {
      // For items with tabs, we need exact or very close match
      isMatch = fullCurrent === itemUrl || fullCurrent.startsWith(`${itemUrl  }&`) || fullCurrent === itemUrl.split("#")[0];
    } else {
      // For standard items
      isMatch = currentPath === itemUrl || (itemUrl !== "/" && currentPath.startsWith(`${itemUrl  }/`));
    }

    if (isMatch) {
      item.classList.add("active");
      item.setAttribute("aria-current", "page");

      // If it's a child, handle the parent group
      const group = item.closest(".menu-group");
      if (group) {
        group.classList.add("child-active");
        group.classList.add("expanded");
      }
    } else {
      item.classList.remove("active");
      item.removeAttribute("aria-current");
    }
  });
}
// Initialize theme and navigation on page load
document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme-preference") || "dark";
  applyTheme(savedTheme);
  updateToggleSwitch(savedTheme === "dark");
});

// Sync with navigation changes
window.addEventListener("popstate", setActiveMenuItem);
window.addEventListener("cl:urlChanged", setActiveMenuItem);
window.setActiveMenuItem = setActiveMenuItem;

export { initializeSidebar, setActiveMenuItem, openSidebar, closeSidebar };

// Expose sidebar controller globally for non-module scripts (like heatmap-init.js)
window.sidebarController = {
  open: openSidebar,
  close: closeSidebar,
};
