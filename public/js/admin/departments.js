import apiClient from "../config/apiClient.js";
import showMessage from "../components/toast.js";

class DepartmentManager {
  constructor() {
    this.departments = [];
    this.currentDepartment = null;
    this.searchTerm = "";
    this.filterStatus = "all";
    this.filterStatus = "all";
  }
  async init() {
    await this.loadDepartments();
    this.setupEventListeners();
    this.startStatusRefresh();
  }
  setupEventListeners() {
    const form = document.getElementById("departmentForm");
    if (form) {
      form.addEventListener("submit", (e) => this.handleSubmit(e));
    }
    const codeInput = document.getElementById("departmentCode");
    if (codeInput) {
      codeInput.addEventListener("input", (e) => {
        e.target.value = e.target.value
          .toUpperCase()
          .replaceAll(/[^A-Z0-9_]/g, "");
      });
    }

    // Search and Filter Listeners
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.searchTerm = e.target.value.toLowerCase();
        this.renderDepartments();
      });
    }

    if (statusFilter) {
      statusFilter.addEventListener("change", (e) => {
        this.filterStatus = e.target.value;
        this.renderDepartments();
      });
    }
  }
  async loadDepartments() {
    try {
      // Fetch ALL departments to allow management of inactive ones
      const response = await apiClient.get("/api/departments");
      if (response.success) {
        this.departments = response.data;
        // Load officers for each department
        await this.loadOfficersForAllDepartments();
        this.renderDepartments();
        this.updateStats();
      }
    } catch (error) {
      console.error("Failed to load departments:", error);
      showMessage("error", "Failed to load departments");
    }
  }
  async loadOfficersForAllDepartments() {
    const promises = this.departments.map(async (dept) => {
      try {
        const response = await apiClient.getDepartmentOfficers(dept.id);
        if (response.success) {
          dept.officers = response.data.map((officer) => ({
            ...officer,
            lastSeenText: this.getLastSeenText(officer.last_sign_in_at),
            statusClass: this.getStatusClass(
              officer.is_online,
              officer.last_sign_in_at
            ),
          }));
          dept.officersVisible = false; // Initially hidden
        } else {
          dept.officers = [];
          dept.officersVisible = false;
        }
      } catch (error) {
        console.error(
          `Failed to load officers for department ${dept.name}:`,
          error
        );
        dept.officers = [];
        dept.officersVisible = false;
      }
    });
    await Promise.all(promises);
  }
  getFilteredDepartments() {
    return this.departments.filter((dept) => {
      // Status Filter
      if (this.filterStatus === "active" && !dept.is_active) return false;
      if (this.filterStatus === "inactive" && dept.is_active) return false;

      // Search Filter
      if (this.searchTerm) {
        const term = this.searchTerm;
        const name = (dept.name || "").toLowerCase();
        const code = (dept.code || "").toLowerCase();
        const desc = (dept.description || "").toLowerCase();
        return (
          name.includes(term) || code.includes(term) || desc.includes(term)
        );
      }

      return true;
    });
  }

  renderDepartments() {
    const grid = document.getElementById("departmentGrid");
    if (!grid) return;
    grid.innerHTML = "";

    const filteredDepartments = this.getFilteredDepartments();
    const safeHtml = filteredDepartments
      .map((dept) => {
        const statusClass = dept.is_active ? "status-active" : "status-inactive";
        const statusText = dept.is_active ? "Active" : "Inactive";
        const description = dept.description || "No description provided.";
        const officerCount = dept.officers ? dept.officers.length : 0;
        const toggleText = dept.officersVisible ? "Hide" : "Show";
        const officersListDisplay = dept.officersVisible ? "grid" : "none";

        let officersHtml = '<div class="no-officers">No officers assigned</div>';
        if (dept.officers && dept.officers.length > 0) {
          officersHtml = dept.officers
            .map((officer) => {
              const officerInitials = officer.name.charAt(0).toUpperCase();
              const officerStatusClass = officer.statusClass.replaceAll(
                "status-",
                ""
              );
              const officerRole = officer.role || "Officer";

              return `
                <div class="officer-item">
                  <div class="officer-avatar">
                    ${officerInitials}
                    <div class="status-dot dot-${officerStatusClass}"></div>
                  </div>
                  <div class="officer-info">
                    <p class="officer-name" title="${officer.name}">${officer.name}</p>
                    <div class="officer-details">
                      <span class="officer-role text-xs text-gray-500">${officerRole}</span>
                      <span class="detail-dot"></span>
                      <span class="officer-last-seen text-xs text-gray-400">${officer.lastSeenText}</span>
                    </div>
                  </div>
                </div>`;
            })
            .join("");
        }

        const actionBtnClass = dept.is_active
          ? "btn-deactivate"
          : "btn-activate";
        const actionText = dept.is_active ? "Deactivate" : "Activate";
        const actionIcon = dept.is_active
          ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
          : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;

        return `
        <div class="department-card">
          <div class="card-header">
            <div class="header-top">
              <span class="department-code">${dept.code}</span>
              <span class="status-badge ${statusClass}">
                ${statusText}
              </span>
            </div>
            <h3 class="department-name">${dept.name}</h3>
          </div>
          
          <div class="card-body">
            <p class="department-description">${description}</p>
          </div>

          <div class="officers-section" id="officers-${dept.id}">
            <div class="officers-header">
              <span class="officers-count">${officerCount} Officers</span>
              <button class="toggle-officers" onclick="departmentManager.toggleOfficers(${dept.id})" 
                      aria-expanded="${dept.officersVisible}">
                <span class="toggle-text">${toggleText}</span>
                <svg class="toggle-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
            </div>
            
            <div class="officers-list" style="display: ${officersListDisplay}">
              ${officersHtml}
            </div>
          </div>

          <div class="card-actions">
            <button class="action-btn btn-edit" onclick="departmentManager.editDepartment(${dept.id})">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Edit
            </button>
            <button class="action-btn ${actionBtnClass}"
                    onclick="departmentManager.toggleStatus(${dept.id})">
              ${actionIcon}
              ${actionText}
            </button>
          </div>
        </div>
      `;
      })
      .join("");

    const parser = new DOMParser();
    const doc = parser.parseFromString(
      this.sanitizeHtml(safeHtml),
      "text/html"
    );
    const fragment = document.createDocumentFragment();
    Array.from(doc.body.children).forEach((child) =>
      fragment.appendChild(child.cloneNode(true))
    );
    grid.appendChild(fragment);
  }
  // Enhanced HTML sanitization function
  sanitizeHtml(html) {
    if (!html || typeof html !== "string") return "";
    // Use DOMPurify for comprehensive sanitization
    if (typeof DOMPurify !== "undefined") {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          "div",
          "span",
          "p",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "strong",
          "em",
          "b",
          "i",
          "u",
          "br",
          "hr",
          "ul",
          "ol",
          "li",
          "a",
          "img",
        ],
        ALLOWED_ATTR: [
          "class",
          "id",
          "style",
          "href",
          "src",
          "alt",
          "title",
          "data-*",
        ],
        ALLOW_DATA_ATTR: true,
        ALLOW_UNKNOWN_PROTOCOLS: false,
        SANITIZE_DOM: true,
        KEEP_CONTENT: true,
      });
    }
    // Fallback sanitization if DOMPurify is not available
    return (
      html
        // Remove script tags and their content
        // eslint-disable-next-line security/detect-unsafe-regex
        .replaceAll(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        // Remove event handlers
        .replaceAll(/on\w+\s*=\s*["'][^"']*["']/gi, "")
        // Remove javascript: URLs
        .replaceAll(/javascript\s*:/gi, "")
        // Remove vbscript: URLs
        .replaceAll(/vbscript\s*:/gi, "")
        // Remove data: URLs (except safe image types)
        .replaceAll(/data\s*:(?!image\/(png|jpg|jpeg|gif|svg|webp))/gi, "")
        // Remove iframe tags
        .replaceAll(/<iframe\b[^<]*>.*?<\/iframe>/gi, "")
        // Remove object tags
        // eslint-disable-next-line security/detect-unsafe-regex
        .replaceAll(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
        // Remove embed tags
        .replaceAll(/<embed\b[^<]*>/gi, "")
        // Remove form tags
        // eslint-disable-next-line security/detect-unsafe-regex
        .replaceAll(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "")
        // Remove input tags
        .replaceAll(/<input\b[^<]*>/gi, "")
        // Remove button tags with onclick
        .replaceAll(/<button\b[^<]*onclick[^<]*>/gi, "<button>")
        // Remove style attributes with javascript
        .replaceAll(/style\s*=\s*["'][^"']*javascript[^"']*["']/gi, "")
        // Remove href with javascript
        .replaceAll(/href\s*=\s*["']javascript[^"']*["']/gi, 'href="#"')
        // Remove src with javascript
        .replaceAll(/src\s*=\s*["']javascript[^"']*["']/gi, "")
    );
  }
  updateStats() {
    const totalElement = document.getElementById("totalCount");
    const activeElement = document.getElementById("activeCount");
    if (totalElement) totalElement.textContent = this.departments.length;
    if (activeElement) {
      activeElement.textContent = this.departments.filter(
        (d) => d.is_active
      ).length;
    }
  }
  async handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get("name"),
      code: formData.get("code"),
      description: formData.get("description"),
      is_active: formData.has("is_active"),
    };
    try {
      let response;
      if (this.currentDepartment) {
        response = await apiClient.put(
          `/api/departments/${this.currentDepartment.id}`,
          data
        );
      } else {
        response = await apiClient.post("/api/departments", data);
      }
      if (response.success) {
        showMessage("success", response.message);
        this.closeModal();
        await this.loadDepartments();
      }
    } catch (error) {
      console.error("Department operation failed:", error);
      showMessage("error", error.message || "Operation failed");
    }
  }
  openModal(mode = "add", department = null) {
    this.currentDepartment = department;
    const modal = document.getElementById("departmentModal");
    const title = document.getElementById("modalTitle");
    const form = document.getElementById("departmentForm");
    if (mode === "edit" && department) {
      title.textContent = "Edit Department";
      document.getElementById("departmentName").value = department.name;
      document.getElementById("departmentCode").value = department.code;
      document.getElementById("departmentDescription").value =
        department.description || "";
      document.getElementById("departmentActive").checked =
        department.is_active;
    } else {
      title.textContent = "Add Department";
      form.reset();
    }
    modal.style.display = "block";
  }
  closeModal() {
    const modal = document.getElementById("departmentModal");
    modal.style.display = "none";
    this.currentDepartment = null;
  }
  editDepartment(id) {
    const department = this.departments.find((d) => d.id === id);
    if (department) {
      this.openModal("edit", department);
    }
  }
  async toggleStatus(id) {
    const department = this.departments.find((d) => d.id === id);
    if (!department) return;
    const newStatus = !department.is_active;
    const action = newStatus ? "activate" : "deactivate";
    if (!confirm(`Are you sure you want to ${action} "${department.name}"?`)) {
      return;
    }
    try {
      const response = await apiClient.put(`/api/departments/${id}`, {
        is_active: newStatus,
      });
      if (response.success) {
        showMessage("success", `Department ${action}d successfully`);
        await this.loadDepartments();
      }
    } catch (error) {
      console.error("Status toggle failed:", error);
      showMessage("error", error.message || "Operation failed");
    }
  }
  toggleOfficers(departmentId) {
    const department = this.departments.find((d) => d.id === departmentId);
    if (!department) return;
    department.officersVisible = !department.officersVisible;
    this.renderDepartments();
  }
  getLastSeenText(lastSignInAt) {
    if (!lastSignInAt) return "Never";
    const lastSignIn = new Date(lastSignInAt);
    const now = new Date();
    const diffInMinutes = Math.floor((now - lastSignIn) / (1000 * 60));
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return lastSignIn.toLocaleDateString();
  }
  getStatusClass(isOnline, lastSignInAt) {
    if (isOnline) return "status-online";
    if (!lastSignInAt) return "status-offline";
    const lastSignIn = new Date(lastSignInAt);
    const now = new Date();
    const diffInMinutes = (now - lastSignIn) / (1000 * 60);

    // Consider "away" if last seen within 1 hour but not online
    if (diffInMinutes < 60) return "status-away";
    return "status-offline";
  }
  startStatusRefresh() {
    // Refresh status every 2 minutes
    setInterval(() => {
      this.refreshOfficerStatus();
    }, 2 * 60 * 1000);
  }
  async refreshOfficerStatus() {
    // Only refresh if officers are visible
    const hasVisibleOfficers = this.departments.some(
      (dept) => dept.officersVisible
    );
    if (!hasVisibleOfficers) return;
    try {
      // Reload officers for all departments
      await this.loadOfficersForAllDepartments();
      this.renderDepartments();
    } catch (error) {
      console.error("Failed to refresh officer status:", error);
    }
  }
}
// Global functions for onclick handlers
globalThis.openModal = (mode) => {
  if (globalThis.departmentManager) {
    globalThis.departmentManager.openModal(mode);
  }
};
globalThis.closeModal = () => {
  if (globalThis.departmentManager) {
    globalThis.departmentManager.closeModal();
  }
};
globalThis.toggleOfficers = (departmentId) => {
  if (globalThis.departmentManager) {
    globalThis.departmentManager.toggleOfficers(departmentId);
  }
};
// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  globalThis.departmentManager = new DepartmentManager();
  globalThis.departmentManager.init();
});
// Close modal when clicking outside
globalThis.addEventListener("click", (e) => {
  const modal = document.getElementById("departmentModal");
  if (e.target === modal) {
    globalThis.departmentManager?.closeModal();
  }
});
