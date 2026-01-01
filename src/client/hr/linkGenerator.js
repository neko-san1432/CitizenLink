/**
 * HR Link Generator
 * Handles signup link generation and management
 */
import apiClient from "../config/apiClient.js";
import showMessage from "../components/toast.js";

class LinkGenerator {

  constructor() {
    this.links = [];
    this.departments = [];
    this.init();
  }
  async init() {
    await this.loadDepartments();
    await this.loadLinks();
    this.setupEventListeners();
  }
  setupEventListeners() {
    const form = document.getElementById("linkForm");
    if (form) {
      form.addEventListener("submit", (e) => this.handleSubmit(e));
    }

    // Generate New Link button
    const generateBtn = document.getElementById("generateNewLinkBtn");
    if (generateBtn) {
      generateBtn.addEventListener("click", () => this.generateLink());
    }

    // Cancel button
    const cancelBtn = document.getElementById("cancelGenerateBtn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => this.cancelGenerate());
    }

    // Copy link button
    const copyBtn = document.getElementById("copyLinkBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => this.copyLink());
    }

    // Filter selects
    const roleFilter = document.getElementById("roleFilter");
    if (roleFilter) {
      roleFilter.addEventListener("change", () => this.filterLinks());
    }

    const statusFilter = document.getElementById("statusFilter");
    if (statusFilter) {
      statusFilter.addEventListener("change", () => this.filterLinks());
    }
  }
  async loadDepartments() {
    try {
      const response = await apiClient.getActiveDepartments();
      if (response.success) {
        this.departments = response.data;
        // Get user role to determine department restrictions
        const userRole = await this.getUserRole();
        await this.filterDepartmentsByRole(userRole);
        this.populateDepartmentSelect();
        await this.setupRoleRestrictions(userRole);
      }
    } catch (error) {
      console.error("Failed to load departments:", error);
    }
  }
  async getUserRole() {
    try {
      const response = await apiClient.get("/api/user/role-info");
      return response.data?.role || "citizen";
    } catch (error) {
      console.error("Failed to get user role:", error);
      return "citizen";
    }
  }
  async getHRDepartment(userRole) {
    if (userRole && userRole === "lgu-hr") {
      // Get department from API endpoint which has complete metadata
      try {
        const response = await apiClient.get("/api/user/role-info");
        if (response.success && response.data) {
          // First try direct department field from API response
          if (response.data.department) {
            return response.data.department.toUpperCase();
          }
          // Then try metadata fields
          const metadata = response.data.metadata || response.data;
          const department = metadata.department ||
                             metadata.dpt ||
                             metadata.raw_user_meta_data?.department ||
                             metadata.raw_user_meta_data?.dpt ||
                             metadata.user_metadata?.department ||
                             metadata.user_metadata?.dpt;
          if (department) {
            return department.toUpperCase();
          }
        }
      } catch (error) {
        console.warn("Failed to get department from API:", error);
      }
      // Fallback: try Supabase session metadata
      try {
        const { supabase } = await import("../../config/config.js");
        const { data: { session } } = await supabase.auth.getSession();
        const metadata = session?.user?.raw_user_meta_data || session?.user?.user_metadata || {};
        const department = metadata.department || metadata.dpt;
        if (department) {
          return department.toUpperCase();
        }
      } catch (error) {
        console.warn("Failed to get department from session:", error);
      }
      // Last resort: return null instead of hardcoded 'WST'
      console.warn("No department found in user metadata");
      return null;
    }
    return null;
  }
  async filterDepartmentsByRole(userRole) {
    // If user is LGU-HR, filter to only their department
    if (userRole === "lgu-hr") {
      const userDepartment = await this.getHRDepartment(userRole);
      this.departments = this.departments.filter(dept =>
        dept.code === userDepartment.toUpperCase()
      );
    }
    // Coordinators and super-admin can see all departments
  }
  async setupRoleRestrictions(userRole) {
    // console.log removed for security
    const roleSelect = document.getElementById("role");
    const roleInfo = document.getElementById("role-info");
    const roleDescription = document.getElementById("role-description");
    if (userRole === "lgu-hr") {
      // LGU-HR can only create officer or admin roles
      const options = roleSelect.querySelectorAll("option");
      options.forEach(option => {
        if (!["lgu-officer", "lgu-admin"].includes(option.value)) {
          option.style.display = "none";
        }
      });
      // Get HR user's department dynamically from metadata
      const hrDepartment = await this.getHRDepartment(userRole);
      if (!hrDepartment) {
        // If no department found, show a generic message
        if (roleInfo && roleDescription) {
          roleDescription.textContent = "As an LGU-HR, you can only create signup links for your assigned department with officer or admin roles. Please contact your administrator if your department is not set.";
          roleInfo.style.display = "block";
        }
        return;
      }
      const departmentName = this.getDepartmentName(hrDepartment);
      // console.log removed for security
      // Hide the department field completely for LGU-HR
      const departmentField = document.querySelector(".form-group:has(#department)");
      if (departmentField) {
        departmentField.style.display = "none";
      }
      // Show role info with dynamic department
      if (roleInfo && roleDescription) {
        // Only show department code if name lookup failed
        const displayText = departmentName && departmentName !== hrDepartment
          ? `${departmentName} (${hrDepartment})`
          : hrDepartment;
        roleDescription.textContent = `As an LGU-HR, you can only create signup links for ${displayText} department with officer or admin roles.`;
        roleInfo.style.display = "block";
      }
    } else if (userRole === "complaint-coordinator") {
      // Show coordinator info
      if (roleInfo && roleDescription) {
        roleDescription.textContent = "As a Complaint Coordinator, you can create signup links for any department and any position.";
        roleInfo.style.display = "block";
      }
    } else if (userRole === "super-admin") {
      // Show super admin info
      if (roleInfo && roleDescription) {
        roleDescription.textContent = "As a Super Admin, you have full access to create signup links for any department and any position.";
        roleInfo.style.display = "block";
      }
    }
  }
  getDepartmentName(departmentCode) {
    if (!departmentCode) return null;
    // Try to find department name from loaded departments
    const dept = this.departments.find(d =>
      d.code === departmentCode ||
      d.code === departmentCode.toUpperCase() ||
      d.code?.toUpperCase() === departmentCode.toUpperCase()
    );
    if (dept && dept.name) {
      return dept.name;
    }
    // Return null if not found (not the code itself)
    return null;
  }
  populateDepartmentSelect() {
    const select = document.getElementById("department");
    if (!select) return;
    select.innerHTML = '<option value="">Select Department (Optional)</option>';
    this.departments.forEach(dept => {
      const option = document.createElement("option");
      option.value = dept.code;
      option.textContent = `${dept.name} (${dept.code})`;
      select.appendChild(option);
    });
  }
  async loadLinks() {
    try {
      const response = await apiClient.getSignupLinks();
      if (response.success) {
        // console.log removed for security
        this.links = response.data;
        this.renderLinks();
        this.updateStats();
      }
    } catch (error) {
      console.error("Failed to load links:", error);
      showMessage("error", "Failed to load signup links");
    }
  }
  renderLinks() {
    const container = document.getElementById("linksList");
    if (!container) return;
    if (this.links.length === 0) {
      container.innerHTML = '<div class="no-links">No signup links generated yet</div>';
      return;
    }
    container.innerHTML = this.links.map((link, _index) => {
      // console.log removed for security
      return `
      <div class="link-item ${link.is_expired ? "expired" : ""} ${link.is_used ? "used" : ""}" data-link-id="${link.id}">
        <div class="link-item-header">
          <span class="link-role">${this.getRoleDisplayName(link.role)}</span>
          <span class="link-status ${this.getStatusClass(link)}">${this.getStatusText(link)}</span>
        </div>
        <div class="link-details">
          <div><strong>Department:</strong> ${link.department_code || "Any"}</div>
          <div><strong>Created:</strong> ${this.formatDate(link.created_at)}</div>
          <div><strong>Expires:</strong> ${link.expires_at ? this.formatDate(link.expires_at) : "Never"}</div>
        </div>
        <div class="link-details">
          <div><strong>Code:</strong> ${link.code}</div>
          <div><strong>Used:</strong> ${link.used_at ? this.formatDate(link.used_at) : "Not used"}</div>
          <div><strong>URL:</strong> ${!link.is_used ? `<a href="${link.url}" target="_blank">Open Link</a>` : '<span style="color: #9ca3af; font-style: italic;">Link used</span>'}</div>
        </div>
        <div class="link-actions">
          ${!link.is_used ? `
          <button class="btn btn-sm btn-primary copy-link-url-btn" data-link-url="${encodeURIComponent(link.url)}">
            Copy URL
          </button>
          ` : ""}
          ${!link.is_used && !link.is_expired ? `
            <button class="btn btn-sm btn-warning deactivate-link-btn" data-link-id="${link.id}">
              Deactivate
            </button>
          ` : ""}
        </div>
      </div>
    `;
    }).join("");

    // Attach event listeners to dynamically generated buttons
    this.attachLinkEventListeners(container);
  }
  attachLinkEventListeners(container) {
    // Copy URL buttons
    container.querySelectorAll(".copy-link-url-btn").forEach(btn => {
      btn.addEventListener("click", (_e) => {
        const url = btn.getAttribute("data-link-url");
        if (url) {
          this.copyLinkUrl(decodeURIComponent(url));
        }
      });
    });

    // Deactivate buttons
    container.querySelectorAll(".deactivate-link-btn").forEach(btn => {
      btn.addEventListener("click", (_e) => {
        const linkId = btn.getAttribute("data-link-id");
        if (linkId) {
          this.deactivateLink(linkId);
        }
      });
    });
  }
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
  updateStats() {
    const totalElement = document.getElementById("totalLinks");
    const activeElement = document.getElementById("activeLinks");
    const usedElement = document.getElementById("usedLinks");
    if (totalElement) totalElement.textContent = this.links.length;
    if (activeElement) activeElement.textContent = this.links.filter(l => !l.is_used && !l.is_expired).length;
    if (usedElement) usedElement.textContent = this.links.filter(l => l.is_used).length;
  }
  getRoleDisplayName(role) {
    const roleMap = {
      "lgu-officer": "LGU Officer",
      "lgu-admin": "LGU Admin",
      "lgu-hr": "LGU HR"
    };
    return roleMap[role] || role;
  }
  getStatusClass(link) {
    if (link.is_used) return "status-used";
    if (link.is_expired) return "status-expired";
    return "status-active";
  }
  getStatusText(link) {
    if (link.is_used) return "Used";
    if (link.is_expired) return "Expired";
    return "Active";
  }
  formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()  } ${  date.toLocaleTimeString()}`;
  }
  generateLink() {
    const form = document.getElementById("generatorForm");
    if (form) {
      form.style.display = "block";
      form.scrollIntoView({ behavior: "smooth" });
    }
  }
  cancelGenerate() {
    const form = document.getElementById("generatorForm");
    const generatedLink = document.getElementById("generatedLink");
    if (form) form.style.display = "none";
    if (generatedLink) generatedLink.style.display = "none";
    document.getElementById("linkForm").reset();
  }
  async handleSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const userRole = await this.getUserRole();
    // Automatically get department based on user role
    let departmentCode = null;
    if (userRole === "lgu-hr") {
      departmentCode = await this.getHRDepartment(userRole);
      // console.log removed for security
    } else {
      // For coordinators and super-admin, use form data
      departmentCode = formData.get("department_code") || null;
    }
    const data = {
      role: formData.get("role"),
      department_code: departmentCode,
      expires_in_hours: parseInt(formData.get("expires_in_hours")) || 1
    };
    // console.log removed for security
    try {
      const response = await apiClient.generateSignupLink(data);
      if (response.success) {
        this.showGeneratedLink(response.data);
        await this.loadLinks(); // Refresh the list
        this.cancelGenerate();
        showMessage("success", "Signup link generated successfully");
      }
    } catch (error) {
      console.error("Failed to generate link:", error);
      showMessage("error", error.message || "Failed to generate signup link");
    }
  }
  showGeneratedLink(linkData) {
    const generatedLink = document.getElementById("generatedLink");
    const linkInput = document.getElementById("linkInput");
    const expiryTime = document.getElementById("expiryTime");
    if (linkInput) linkInput.value = linkData.url;
    if (expiryTime) {
      const expiryDate = new Date(linkData.expires_at);
      expiryTime.textContent = expiryDate.toLocaleString();
    }
    if (generatedLink) generatedLink.style.display = "block";
  }
  copyLink() {
    const linkInput = document.getElementById("linkInput");
    if (linkInput) {
      linkInput.select();
      document.execCommand("copy");
      showMessage("success", "Link copied to clipboard");
    }
  }
  copyLinkUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
      showMessage("success", "URL copied to clipboard");
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showMessage("success", "URL copied to clipboard");
    });
  }
  async deactivateLink(linkId) {
    // console.log removed for security
    if (!confirm("Are you sure you want to deactivate this link?")) {
      return;
    }
    try {
      // console.log removed for security
      const response = await apiClient.deactivateSignupLink(linkId);
      // console.log removed for security
      if (response.success) {
        showMessage("success", "Link deactivated successfully");
        await this.loadLinks();
      } else {
        showMessage("error", response.error || "Failed to deactivate link");
      }
    } catch (error) {
      console.error("[LINK-GENERATOR] Failed to deactivate link:", error);
      showMessage("error", error.message || "Failed to deactivate link");
    }
  }
  filterLinks() {
    const roleFilter = document.getElementById("roleFilter")?.value;
    const statusFilter = document.getElementById("statusFilter")?.value;
    let filteredLinks = this.links;
    if (roleFilter) {
      filteredLinks = filteredLinks.filter(link => link.role === roleFilter);
    }
    if (statusFilter) {

      if (statusFilter === "active") {
        filteredLinks = filteredLinks.filter(link => !link.is_used && !link.is_expired);
      } else if (statusFilter === "expired") {
        filteredLinks = filteredLinks.filter(link => link.is_expired);
      } else if (statusFilter === "used") {
        filteredLinks = filteredLinks.filter(link => link.is_used);
      }
    }
    // Temporarily replace links array for rendering
    const originalLinks = this.links;
    this.links = filteredLinks;
    this.renderLinks();
    this.links = originalLinks;
  }
}
// Global functions for onclick handlers
window.generateLink = () => {
  if (window.linkGenerator) {
    window.linkGenerator.generateLink();
  }
};
window.copyLink = () => {
  if (window.linkGenerator) {
    window.linkGenerator.copyLink();
  }
};
window.copyLinkUrl = (url) => {
  if (window.linkGenerator) {
    window.linkGenerator.copyLinkUrl(url);
  }
};
window.deactivateLink = (linkId) => {
  if (window.linkGenerator) {
    window.linkGenerator.deactivateLink(linkId);
  }
};
window.filterLinks = () => {
  if (window.linkGenerator) {
    window.linkGenerator.filterLinks();
  }
};
// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.linkGenerator = new LinkGenerator();
});
