/**
 * LGU Admin Assignments Page
 * Handles viewing and managing complaint assignments for LGU admins
 */
import apiClient from "../../config/apiClient.js";
import showMessage from "../../components/toast.js";

class LguAdminAssignments {

  constructor() {
    this.assignments = [];
    this.officers = [];
    this.filters = {
      status: "all",
      priority: "all",
      sub_type: "all"
    };
    this.currentPage = 1;
    this.itemsPerPage = 10;
  }
  async init() {
    try {
      await this.loadAssignments();
      await this.loadOfficers();
      this.setupEventListeners();
      this.renderAssignments();
    } catch (error) {
      console.error("[LGU_ADMIN_ASSIGNMENTS] Initialization error:", error);
      showMessage("error", "Failed to initialize assignments page");
    }
  }
  async loadAssignments() {
    try {
      const queryParams = new URLSearchParams();
      if (this.filters.status !== "all") queryParams.append("status", this.filters.status);
      if (this.filters.priority !== "all") queryParams.append("priority", this.filters.priority);
      if (this.filters.sub_type !== "all") queryParams.append("sub_type", this.filters.sub_type);
      const { data } = await apiClient.get(`/api/lgu-admin/department-assignments?${queryParams}`);
      if (data && data.success) {
        this.assignments = data.data || [];
      } else {
        throw new Error(data?.error || "Failed to load assignments");
      }
    } catch (error) {
      console.error("[LGU_ADMIN_ASSIGNMENTS] Load assignments error:", error);
      showMessage("error", "Failed to load assignments");
      this.assignments = [];
    }
  }
  async loadOfficers() {
    try {
      const { data } = await apiClient.get("/api/lgu-admin/department-officers");
      if (data && data.success) {
        this.officers = data.data || [];
      } else {
        throw new Error(data?.error || "Failed to load officers");
      }
    } catch (error) {
      console.error("[LGU_ADMIN_ASSIGNMENTS] Load officers error:", error);
      showMessage("error", "Failed to load officers");
      this.officers = [];
    }
  }
  setupEventListeners() {
    // Filter controls
    const statusFilter = document.getElementById("status-filter");
    const priorityFilter = document.getElementById("priority-filter");
    const subTypeFilter = document.getElementById("sub-type-filter");
    const refreshBtn = document.getElementById("refresh-btn");
    if (statusFilter) {
      statusFilter.addEventListener("change", (e) => {
        this.filters.status = e.target.value;
        this.applyFilters();
      });
    }
    if (priorityFilter) {
      priorityFilter.addEventListener("change", (e) => {
        this.filters.priority = e.target.value;
        this.applyFilters();
      });
    }
    if (subTypeFilter) {
      subTypeFilter.addEventListener("change", (e) => {
        this.filters.sub_type = e.target.value;
        this.applyFilters();
      });
    }
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        this.refreshData();
      });
    }
    // Assignment modal
    this.setupAssignmentModal();
  }
  setupAssignmentModal() {
    const assignModal = document.getElementById("assign-modal");
    const assignForm = document.getElementById("assign-form");
    const closeModal = document.getElementById("close-assign-modal");
    if (closeModal) {
      closeModal.addEventListener("click", () => {
        this.closeAssignmentModal();
      });
    }
    if (assignForm) {
      assignForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleAssignment();
      });
    }
    // Close modal when clicking outside
    if (assignModal) {
      assignModal.addEventListener("click", (e) => {
        if (e.target === assignModal) {
          this.closeAssignmentModal();
        }
      });
    }
  }
  async applyFilters() {
    await this.loadAssignments();
    this.renderAssignments();
  }
  async refreshData() {
    showMessage("info", "Refreshing assignments...");
    await this.loadAssignments();
    await this.loadOfficers();
    this.renderAssignments();
    showMessage("success", "Assignments refreshed");
  }
  renderAssignments() {
    const container = document.getElementById("assignments-container");
    if (!container) return;
    if (this.assignments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>No Assignments Found</h3>
          <p>No complaint assignments match your current filters.</p>
        </div>
      `;
      return;
    }
    const paginatedAssignments = this.getPaginatedAssignments();
    container.innerHTML = `
      <div class="assignments-list">
        ${paginatedAssignments.map(assignment => this.renderAssignmentCard(assignment)).join("")}
      </div>
      ${this.renderPagination()}
    `;
    // Add event listeners to assignment cards
    this.setupAssignmentCardListeners();
  }
  getPaginatedAssignments() {

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.assignments.slice(startIndex, endIndex);
  }
  renderAssignmentCard(assignment) {
    const statusClass = this.getStatusClass(assignment.status);
    const priorityClass = this.getPriorityClass(assignment.priority);
    const assignedDate = new Date(assignment.assigned_at).toLocaleDateString();
    const submittedDate = new Date(assignment.submitted_at).toLocaleDateString();
    return `
      <div class="assignment-card" data-assignment-id="${assignment.id}" data-complaint-id="${assignment.complaint_id}">
        <div class="assignment-header">
          <div class="assignment-title">
            <h4>${this.escapeHtml(assignment.title || "Untitled Complaint")}</h4>
            <div class="assignment-meta">
              <span class="assignment-id">#${assignment.complaint_id.slice(-8)}</span>
              <span class="assignment-date">Submitted: ${submittedDate}</span>
            </div>
          </div>
          <div class="assignment-status">
            <span class="status-badge ${statusClass}">${this.getStatusText(assignment.status)}</span>
            <span class="priority-badge ${priorityClass}">${assignment.priority}</span>
          </div>
        </div>
        
        <div class="assignment-content">
          <div class="assignment-description">
            <p>${this.escapeHtml(assignment.description || "No description available")}</p>
          </div>
          
          <div class="assignment-details">
            <div class="detail-item">
              <span class="detail-label">Location:</span>
              <span class="detail-value">${this.escapeHtml(assignment.location_text || "Not specified")}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Citizen:</span>
              <span class="detail-value">${this.escapeHtml(assignment.citizen_name || "Unknown")}</span>
            </div>
            ${assignment.officer_name ? `
              <div class="detail-item">
                <span class="detail-label">Assigned Officer:</span>
                <span class="detail-value">${this.escapeHtml(assignment.officer_name)}</span>
              </div>
            ` : ""}
            ${assignment.deadline ? `
              <div class="detail-item">
                <span class="detail-label">Deadline:</span>
                <span class="detail-value">${new Date(assignment.deadline).toLocaleDateString()}</span>
              </div>
            ` : ""}
          </div>
        </div>
        <div class="assignment-actions">
          ${assignment.status === "unassigned" ? `
            <button class="btn btn-primary assign-btn" data-complaint-id="${assignment.complaint_id}">
              Assign to Officer
            </button>
          ` : `
            <button class="btn btn-secondary view-btn" data-complaint-id="${assignment.complaint_id}">
              View Details
            </button>
            <button class="btn btn-outline reassign-btn" data-complaint-id="${assignment.complaint_id}">
              Reassign
            </button>
          `}
        </div>
      </div>
    `;
  }

  setupAssignmentCardListeners() {
    // Assign buttons
    document.querySelectorAll(".assign-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const {complaintId} = e.target.dataset;
        this.openAssignmentModal(complaintId);
      });
    });
    // Reassign buttons
    document.querySelectorAll(".reassign-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const {complaintId} = e.target.dataset;
        this.openAssignmentModal(complaintId, true);
      });
    });
    // View buttons
    document.querySelectorAll(".view-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const {complaintId} = e.target.dataset;
        this.viewComplaintDetails(complaintId);
      });
    });
  }
  openAssignmentModal(complaintId, isReassign = false) {
    const modal = document.getElementById("assign-modal");
    const form = document.getElementById("assign-form");
    const modalTitle = document.getElementById("assign-modal-title");
    const officerSelect = document.getElementById("officer-select");
    const complaintIdInput = document.getElementById("complaint-id");
    if (!modal || !form || !officerSelect) return;
    // Set modal title
    if (modalTitle) {
      modalTitle.textContent = isReassign ? "Reassign Complaint" : "Assign Complaint to Officer";
    }
    // Set complaint ID
    if (complaintIdInput) {
      complaintIdInput.value = complaintId;
    }
    // Populate officer select
    officerSelect.innerHTML = '<option value="">Select an officer...</option>';
    this.officers.forEach(officer => {
      const option = document.createElement("option");
      option.value = officer.id;
      option.textContent = `${officer.name} (${officer.email})`;
      officerSelect.appendChild(option);
    });
    // Show modal
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }
  closeAssignmentModal() {
    const modal = document.getElementById("assign-modal");
    if (modal) {
      modal.style.display = "none";
      document.body.style.overflow = "";
    }
  }
  async handleAssignment() {
    const form = document.getElementById("assign-form");
    if (!form) return;
    const formData = new FormData(form);
    const complaintId = formData.get("complaint_id");
    const officerId = formData.get("officer_id");
    const priority = formData.get("priority");
    const deadline = formData.get("deadline");
    const notes = formData.get("notes");
    if (!complaintId || !officerId) {
      showMessage("error", "Please select an officer");
      return;
    }
    try {
      const { data } = await apiClient.post(`/api/lgu-admin/complaints/${complaintId}/assign`, {
        officerId,
        priority,
        deadline: deadline || null,
        notes: notes || null
      });
      if (data && data.success) {
        showMessage("success", "Complaint assigned successfully");
        this.closeAssignmentModal();
        await this.refreshData();
      } else {
        throw new Error(data?.error || "Failed to assign complaint");
      }
    } catch (error) {
      console.error("[LGU_ADMIN_ASSIGNMENTS] Assignment error:", error);
      showMessage("error", "Failed to assign complaint");
    }
  }
  viewComplaintDetails(complaintId) {
    // Navigate to complaint details page
    window.location.href = `/complaint-details?id=${complaintId}`;
  }
  renderPagination() {
    const totalPages = Math.ceil(this.assignments.length / this.itemsPerPage);
    if (totalPages <= 1) return "";
    return `
      <div class="pagination">
        <button class="btn btn-outline" ${this.currentPage === 1 ? "disabled" : ""} onclick="assignmentsPage.previousPage()">
          Previous
        </button>
        <span class="pagination-info">
          Page ${this.currentPage} of ${totalPages}
        </span>
        <button class="btn btn-outline" ${this.currentPage === totalPages ? "disabled" : ""} onclick="assignmentsPage.nextPage()">
          Next
        </button>
      </div>
    `;
  }
  nextPage() {
    const totalPages = Math.ceil(this.assignments.length / this.itemsPerPage);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.renderAssignments();
    }
  }
  previousPage() {

    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderAssignments();
    }
  }
  getStatusClass(status) {
    const statusClasses = {
      "unassigned": "status-unassigned",
      "assigned": "status-assigned",
      "active": "status-active",
      "in_progress": "status-in-progress",
      "completed": "status-completed",
      "cancelled": "status-cancelled"
    };
    return statusClasses[status] || "status-unknown";
  }
  getStatusText(status) {
    const statusTexts = {
      "unassigned": "Unassigned",
      "assigned": "Assigned",
      "active": "Active",
      "in_progress": "In Progress",
      "completed": "Completed",
      "cancelled": "Cancelled"
    };
    return statusTexts[status] || status;
  }
  getPriorityClass(priority) {
    const priorityClasses = {
      "low": "priority-low",
      "medium": "priority-medium",
      "high": "priority-high",
      "urgent": "priority-urgent"
    };
    return priorityClasses[priority] || "priority-medium";
  }
  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
// Initialize the assignments page
const assignmentsPage = new LguAdminAssignments();
// Make methods available globally for pagination
window.assignmentsPage = assignmentsPage;
document.addEventListener("DOMContentLoaded", () => {
  assignmentsPage.init();
});
