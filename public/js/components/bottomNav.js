import { getUserRole } from "../auth/authChecker.js";
import { getIcon } from "../utils/icons.js";
import { normalizeRole } from "../utils/roleUtils.js";

/**
 * Bottom Navigation Component for Mobile View
 * Synchronizes with sidebar menu items for the citizen role.
 */

export function initializeBottomNav() {
  // Only initialize if we're on a mobile/tablet view
  if (window.innerWidth > 1024) return;

  const userMeta = JSON.parse(localStorage.getItem("cl_user_meta") || "{}");
  const role = normalizeRole(userMeta.role || "citizen");

  // Only show for citizen role (or when overridden to citizen mode)
  const isCitizenMode = role === "citizen" || 
                        localStorage.getItem("cl_role_override") === "citizen" ||
                        document.cookie.match(/(^|;)\s*app_mode=citizen_mode/);

  if (!isCitizenMode) return;

  renderBottomNav();
}

function renderBottomNav() {
  // Check if it already exists
  if (document.querySelector(".dash-bottom-nav")) {
    // If it exists, just update active state
    updateActiveNavItem();
    return;
  }

  const nav = document.createElement("nav");
  nav.className = "dash-bottom-nav";

  // Define navigation items for citizen
  const navItems = [
    { url: "/dashboard", icon: "dashboard", label: "Dashboard" },
    { url: "/filecomplaint", icon: "filecomplaint", label: "File Complaint" },
    { url: "/digos-map", icon: "map", label: "Map" }
  ];

  const currentPath = window.location.pathname;

  nav.innerHTML = navItems.map(item => {
    const isActive = currentPath === item.url || (item.url === "/dashboard" && currentPath === "/");
    return `
      <a href="${item.url}" class="nav-item ${isActive ? 'active' : ''}" data-path="${item.url}">
        ${getIcon(item.icon, { size: 24, className: "nav-icon" })}
      </a>
    `;
  }).join("");

  // Append to app-container if it exists, otherwise to body
  const appContainer = document.querySelector(".app-container");
  if (appContainer) {
    appContainer.appendChild(nav);
  } else {
    document.body.appendChild(nav);
  }
}

function updateActiveNavItem() {
  const currentPath = window.location.pathname;
  const navItems = document.querySelectorAll(".dash-bottom-nav .nav-item");
  
  navItems.forEach(item => {
    const path = item.getAttribute("data-path");
    if (currentPath === path || (path === "/dashboard" && currentPath === "/")) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}

// Auto-initialize if loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeBottomNav);
} else {
  initializeBottomNav();
}
