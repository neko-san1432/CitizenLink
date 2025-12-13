/**
 * LGU Admin Assignments Page
 * Handles viewing and managing complaint assignments for LGU admins
 */
import apiClient from "../../config/apiClient.js";
import showMessage from "../../components/toast.js";
import { escapeHtml } from "../../utils/string.js";
import {
  getStatusText,
  getStatusClass,
  getPriorityClass,
} from "../../utils/complaint.js";
import getCurrentUser from "../../utils/authUtils.js";
import { supabase } from "../../config/config.js";

class LguAdminAssignments {
  constructor() {
    this.assignments = [];
    this.officers = [];
    this.complaints = [];
    this.currentComplaintId = null;
    this.selectedComplaint = null;
    this.currentAssignmentFilter = "all"; // For client-side filtering (all, unassigned, assigned)
    this.filters = {
      status: "all",
      priority: "all",
      sub_type: "all",
    };
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.totalItems = 0;
    this.stats = { unassigned: 0, urgent: 0, high: 0 };
    this.initialize();
  }
  async initialize() {
    // Show loading state initially
    this.showLoadingState();
    try {
      await this.loadComplaints();
      await this.loadOfficers();
      await this.loadAssignments();
      this.renderAssignments();
    } catch (error) {
      console.error("[LGU_ADMIN_ASSIGNMENTS] Initialization error:", error);
      this.hideLoadingState();
      showMessage("error", "Failed to initialize assignments page");
    }
  }
  async loadComplaints() {
    try {
      const response = await apiClient.get("/api/lgu-admin/department-queue");
      if (response && response.success) {
        this.complaints = response.data || [];
      } else {
        throw new Error(response?.error || "Failed to load complaints");
      }
    } catch (error) {
      console.error("[LGU_ADMIN_ASSIGNMENTS] Load complaints error:", error);
      this.hideLoadingState();
      showMessage("error", "Failed to load complaints");
      this.complaints = [];
    }
  }
  async loadAssignments() {
    try {
      const queryParams = new URLSearchParams();
      if (this.filters.status !== "all")
        queryParams.append("status", this.filters.status);
      if (this.filters.priority !== "all")
        queryParams.append("priority", this.filters.priority);
      if (this.filters.sub_type !== "all")
        queryParams.append("sub_type", this.filters.sub_type);

      // Add pagination params
      queryParams.append("page", this.currentPage);
      queryParams.append("limit", this.itemsPerPage);

      // Add assignment filter (tabs)
      if (this.currentAssignmentFilter) {
        queryParams.append("assignment_filter", this.currentAssignmentFilter);
      }

      const url = `/api/lgu-admin/department-assignments?${queryParams}`;

      const response = await apiClient.get(url);
      if (response && response.success) {
        const newAssignments = response.data || [];
        this.totalItems = response.pagination?.total || 0;
        this.stats = response.stats || { unassigned: 0, urgent: 0, high: 0 };

        // Append or Replace
        if (this.currentPage === 1) {
          this.assignments = newAssignments;
        } else {
          this.assignments = [...this.assignments, ...newAssignments];
        }
      } else {
        throw new Error(response?.error || "Failed to load assignments");
      }
    } catch (error) {
      console.error("[LGU_ADMIN_ASSIGNMENTS] Load assignments error:", error);
      // Only hide loading state if it was blocking valid content
      if (this.currentPage === 1) {
        this.hideLoadingState();
        this.assignments = [];
        this.totalItems = 0;
        showMessage("error", "Failed to load assignments");
      } else {
        // Partial load failure
        showMessage("error", "Failed to load more assignments");
      }
    }
  }
  async loadOfficers() {
    try {
      const response = await apiClient.get(
        "/api/lgu-admin/department-officers"
      );
      if (response && response.success) {
        this.officers = response.data || [];
      } else {
        throw new Error(response?.error || "Failed to load officers");
      }
    } catch (error) {
      console.error("[LGU_ADMIN_ASSIGNMENTS] Load officers error:", error);
      this.hideLoadingState();
      showMessage("error", "Failed to load officers");
      this.officers = [];
    }
  }
  showLoadingState() {
    const loadingState = document.getElementById("loading-state");
    const assignmentsList = document.getElementById("assignments-list");
    const emptyState = document.getElementById("empty-state");
    if (loadingState) loadingState.style.display = "block";
    if (assignmentsList) assignmentsList.style.display = "none";
    if (emptyState) emptyState.style.display = "none";
  }
  hideLoadingState() {
    const loadingState = document.getElementById("loading-state");
    if (loadingState) loadingState.style.display = "none";
  }
  setupEventListeners() {
    // Event delegation for complaint items - Navigate to complaint details (like coordinator review queue)
    const assignmentsList = document.getElementById("assignments-list");
    if (assignmentsList) {
      assignmentsList.addEventListener("click", (event) => {
        // Don't navigate if clicking on buttons
        if (
          event.target.tagName === "BUTTON" ||
          event.target.closest("button")
        ) {
          return;
        }
        const item = event.target.closest(".assignment-card");
        if (item) {
          const { complaintId } = item.dataset;
          if (complaintId) {
            // Navigate to complaint details page, similar to coordinator review queue
            window.location.href = `/complaint-details/${complaintId}`;
          }
        }
      });
    }

    // Filter button toggles (All, Unassigned, Assigned)
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        // Remove active class from all filter buttons
        document
          .querySelectorAll(".filter-btn")
          .forEach((b) => b.classList.remove("active"));
        // Add active class to clicked button
        e.target.classList.add("active");
        // Get filter value
        const filterValue = e.target.dataset.filter;
        // Apply client-side filter for assignment status
        this.currentAssignmentFilter = filterValue;
        // Reload data from server (reset to page 1)
        this.changePage(1);
      });
    });

    // Filter controls
    const statusFilter = document.getElementById("status-filter");
    const priorityFilter = document.getElementById("priority-filter");
    const subTypeFilter =
      document.getElementById("subtype-filter") ||
      document.getElementById("sub-type-filter");
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
    // Assignment button
    const assignButton = document.getElementById("assign-button");
    if (assignButton !== null) {
      assignButton.addEventListener("click", () => {
        if (!this.selectedComplaint) {
          showMessage("error", "Please select a complaint first");
          return;
        }
        this.handleAssignment();
      });
    }
  }
  setupAssignmentModal() {
    const assignmentModal = document.getElementById("assignment-modal");
    const assignmentForm = document.getElementById("assignment-form");
    const closeModal = document.getElementById("close-assignment-modal");
    const cancelBtn = document.getElementById("cancel-assignment");
    if (closeModal) {
      closeModal.addEventListener("click", () => {
        this.closeAssignmentModal();
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        this.closeAssignmentModal();
      });
    }
    if (assignmentForm) {
      assignmentForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleAssignment();
      });
    }
    // Close modal when clicking outside
    if (assignmentModal) {
      assignmentModal.addEventListener("click", (e) => {
        if (e.target === assignmentModal) {
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
    // Hide loading state
    const loadingState = document.getElementById("loading-state");
    if (loadingState) {
      loadingState.style.display = "none";
    }

    // Get table elements
    const tableContainer = document.getElementById(
      "assignments-table-container"
    );
    const tableBody = document.getElementById("assignments-table-body");
    const paginationControls = document.getElementById("pagination-controls");

    // Legacy support (if elements missing)
    const assignmentsList = document.getElementById("assignments-list");

    if (!tableContainer || !tableBody) {
      // Fallback or error if table not found (during transition)
      if (assignmentsList) {
        assignmentsList.innerHTML =
          '<div class="empty-state">Error: Table not found. Please refresh.</div>';
        assignmentsList.style.display = "block";
      }
      return;
    }

    // Get data directly (already paginated by server)
    const paginatedData = this.assignments;
    const totalItems = this.totalItems;

    if (totalItems === 0 && paginatedData.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3rem;">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                <div style="font-size: 2rem;">📋</div>
                <div style="color: #4a5568; font-weight: 600;">No assignments found</div>
                <div style="color: #718096; font-size: 0.875rem;">Try adjusting your filters</div>
            </div>
          </td>
        </tr>
      `;
      tableContainer.style.display = "block";
      this.updateLoadMoreControls(totalItems);
      this.updateStats();
      return;
    }

    // Render rows
    tableBody.innerHTML = paginatedData
      .map((assignment) => this.renderAssignmentRow(assignment))
      .join("");
    tableContainer.style.display = "block";

    // Update controls
    this.updateLoadMoreControls(totalItems);

    // Update stats
    this.updateStats();

    // Add event listeners
    this.setupAssignmentActionListeners();

    // Setup Infinite Scroll
    this.setupInfiniteScroll();
  }

  getPaginatedData() {
    // Deprecated for slicing, just passes thru data
    return { paginatedData: this.assignments, totalItems: this.totalItems };
  }

  async loadMore() {
    const btn = document.getElementById("load-more-btn");
    const spinner = document.getElementById("load-more-spinner");
    if (btn) btn.disabled = true;
    if (spinner) spinner.style.display = "inline-block";

    this.currentPage++;
    await this.loadAssignments();
    this.renderAssignments();

    if (btn) btn.disabled = false;
    if (spinner) spinner.style.display = "none";
  }

  setupInfiniteScroll() {
    const loadMoreBtn = document.getElementById("load-more-btn");
    if (!loadMoreBtn) return;

    // Disconnect old observer if exists
    if (this.observer) {
      this.observer.disconnect();
    }

    // Only set up observer if there are more items to load
    if (this.assignments.length >= this.totalItems) return;

    const options = {
      root: null, // viewport
      rootMargin: "100px", // trigger 100px before end
      threshold: 0.1,
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !loadMoreBtn.disabled) {
          this.loadMore();
        }
      });
    }, options);

    this.observer.observe(loadMoreBtn);
  }

  updateLoadMoreControls(totalItems) {
    const container = document.getElementById("load-more-container");
    const loadMoreBtn = document.getElementById("load-more-btn");
    const currentCountEl = document.getElementById("current-count");
    const totalItemsEl = document.getElementById("total-items");

    if (!container) return;

    if (currentCountEl) currentCountEl.textContent = this.assignments.length;
    if (totalItemsEl) totalItemsEl.textContent = totalItems;

    // Show container if we have items
    container.style.display = this.assignments.length > 0 ? "flex" : "none";

    // Show/Hide Load More Button
    if (loadMoreBtn) {
      if (this.assignments.length >= totalItems) {
        loadMoreBtn.style.display = "none";
      } else {
        loadMoreBtn.style.display = "flex";
        // Ensure listener is not duplicated
        const newBtn = loadMoreBtn.cloneNode(true);
        loadMoreBtn.parentNode.replaceChild(newBtn, loadMoreBtn);
        newBtn.onclick = () => this.loadMore();
      }
    }
  }

  // Legacy/Deprecated
  updatePaginationControls(totalItems) {}

  async changePage(newPage) {
    // Used for reset filters
    this.currentPage = newPage;
    this.assignments = []; // Clear
    this.showLoadingState();
    await this.loadAssignments();
    this.renderAssignments();
  }

  updateStats() {
    // Use stats from server
    const { unassigned, urgent, high } = this.stats;

    // Update stat elements
    const unassignedEl = document.getElementById("stat-unassigned");
    const urgentEl = document.getElementById("stat-urgent");
    const highEl = document.getElementById("stat-high");
    if (unassignedEl) unassignedEl.textContent = unassigned;
    if (urgentEl) urgentEl.textContent = urgent;
    if (highEl) highEl.textContent = high;
  }

  renderAssignmentRow(assignment) {
    const statusClass = getStatusClass(assignment.status);
    const priorityClass = getPriorityClass(assignment.priority);
    const dateDisplay = assignment.assigned_at
      ? new Date(assignment.assigned_at).toLocaleDateString()
      : new Date(assignment.submitted_at).toLocaleDateString();

    return `
      <tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.2s;" onmouseover="this.style.background='#f7fafc'" onmouseout="this.style.background='white'">
        <td style="padding: 1rem; color: #718096; font-size: 0.875rem;">
          #${
            assignment.complaint_id ? assignment.complaint_id.slice(-8) : "N/A"
          }
        </td>
        <td style="padding: 1rem;">
          <div style="font-weight: 600; color: #2d3748; margin-bottom: 0.25rem;">${escapeHtml(
            assignment.title || "Untitled"
          )}</div>
          <div style="color: #718096; font-size: 0.8rem; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(assignment.description || "No description")}
          </div>
        </td>
        <td style="padding: 1rem;">
           <div style="color: #4a5568;">${escapeHtml(
             assignment.citizen_name || "Unknown"
           )}</div>
           <div style="color: #a0aec0; font-size: 0.8rem;">${escapeHtml(
             assignment.location_text || "No location"
           )}</div>
        </td>
        <td style="padding: 1rem;">
           ${
             assignment.officer_name
               ? `<div style="display:flex;align-items:center;gap:0.5rem;"><div style="width:24px;height:24px;border-radius:50%;background:#3182ce;color:white;display:flex;align-items:center;justify-content:center;font-size:0.7rem;">${assignment.officer_name.charAt(
                   0
                 )}</div><div>${escapeHtml(
                   assignment.officer_name
                 )}</div></div>`
               : '<span style="color: #a0aec0; font-style: italic;">Unassigned</span>'
           }
        </td>
        <td style="padding: 1rem;">
          <span class="priority-badge ${priorityClass}">${
      assignment.priority
    }</span>
        </td>
        <td style="padding: 1rem;">
          <span class="status-badge ${statusClass}">${getStatusText(
      assignment.status
    )}</span>
        </td>
        <td style="padding: 1rem; text-align: center;">
          <div style="display: flex; gap: 0.5rem; justify-content: center;">
            <button class="btn-secondary view-details-btn" data-complaint-id="${
              assignment.complaint_id
            }" title="View Details" style="padding: 0.25rem 0.5rem;">
              👁️
            </button>
            ${
              assignment.status === "unassigned" || !assignment.assigned_to
                ? `<button class="btn-primary assign-btn" data-complaint-id="${assignment.complaint_id}" title="Assign" style="padding: 0.25rem 0.5rem;">
                  👤
                 </button>`
                : `<button class="btn-secondary reassign-btn" data-complaint-id="${assignment.complaint_id}" title="Reassign" style="padding: 0.25rem 0.5rem;">
                  🔄
                 </button>`
            }
          </div>
        </td>
      </tr>
    `;
  }

  setupAssignmentActionListeners() {
    // View Details buttons
    document.querySelectorAll(".view-details-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const { complaintId } = e.target.dataset;
        window.location.href = `/complaint-details/${complaintId}`;
      });
    });
    // Assign buttons
    document.querySelectorAll(".assign-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const { complaintId } = e.target.dataset;
        this.openAssignmentModal(complaintId);
      });
    });
    // Reassign buttons
    document.querySelectorAll(".reassign-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const { complaintId } = e.target.dataset;
        this.openAssignmentModal(complaintId, true);
      });
    });
  }

  openAssignmentModal(complaintId, isReassign = false) {
    const modal = document.getElementById("assignment-modal");
    const form = document.getElementById("assignment-form");
    const modalTitle = modal?.querySelector("h2");
    const officerCheckboxes = document.getElementById("officer-checkboxes");
    const complaintSummary = document.getElementById("complaint-summary");
    if (!modal || !form || !officerCheckboxes) {
      console.error("[LGU_ADMIN_ASSIGNMENTS] Modal elements not found:", {
        modal: Boolean(modal),
        form: Boolean(form),
        officerCheckboxes: Boolean(officerCheckboxes),
      });
      return;
    }
    // Set modal title
    if (modalTitle) {
      modalTitle.textContent = isReassign
        ? "Reassign Complaint"
        : "Assign to Officer";
    }
    // Set current complaint ID
    this.currentComplaintId = complaintId;
    // Find the complaint data
    const complaint = this.assignments.find(
      (a) => a.complaint_id === complaintId
    );
    if (complaint && complaintSummary) {
      complaintSummary.dataset.complaintId = complaintId;
      complaintSummary.innerHTML = `
        <div class="complaint-summary-title">${escapeHtml(
          complaint.title || "Untitled Complaint"
        )}</div>
        <div class="complaint-summary-detail"><strong>ID:</strong> #${complaint.complaint_id.slice(
          -8
        )}</div>
        <div class="complaint-summary-detail"><strong>Description:</strong> ${escapeHtml(
          complaint.description || "No description"
        )}</div>
        <div class="complaint-summary-detail"><strong>Location:</strong> ${escapeHtml(
          complaint.location_text || "Not specified"
        )}</div>
        <div class="complaint-summary-detail"><strong>Citizen:</strong> ${escapeHtml(
          complaint.citizen_name || "Unknown"
        )}</div>
      `;
    }
    // Populate officer checkboxes
    // officerCheckboxes already declared above
    if (officerCheckboxes) {
      officerCheckboxes.innerHTML = "";
      if (this.officers.length === 0) {
        officerCheckboxes.innerHTML =
          '<div class="no-officers">No officers available</div>';
      } else {
        this.officers.forEach((officer, index) => {
          const checkboxItem = document.createElement("div");
          checkboxItem.className = "officer-checkbox-item";
          checkboxItem.innerHTML = `
            <input type="checkbox" id="officer-${officer.id}" value="${
            officer.id
          }" name="officers">
            <label for="officer-${officer.id}">
              <div class="officer-info">
                <div class="officer-name">${escapeHtml(officer.name)}</div>
                <div class="officer-details">${escapeHtml(officer.email)} • ${
            officer.employee_id || "No ID"
          }</div>
              </div>
            </label>
          `;
          officerCheckboxes.appendChild(checkboxItem);
        });
      }
    }
    // Show modal
    modal.style.display = "flex";
    modal.style.visibility = "visible";
    modal.style.opacity = "1";
    modal.style.zIndex = "9999";
    document.body.style.overflow = "hidden";
  }
  closeAssignmentModal() {
    const modal = document.getElementById("assignment-modal");
    if (modal) {
      modal.style.display = "none";
      document.body.style.overflow = "";
    }
  }
  getSelectedOfficers() {
    const checkboxes = document.querySelectorAll(
      '#officer-checkboxes input[type="checkbox"]:checked'
    );
    const selectedIds = Array.from(checkboxes).map(
      (checkbox) => checkbox.value
    );
    return selectedIds;
  }
  openComplaintDetailsPanel(complaintId) {
    // Find the complaint data
    const complaint = this.assignments.find(
      (a) => a.complaint_id === complaintId
    );
    if (!complaint) {
      console.error(
        "[LGU_ADMIN_ASSIGNMENTS] Complaint not found:",
        complaintId
      );
      showMessage("error", "Complaint not found");
      return;
    }
    // Create details panel if it doesn't exist
    let panel = document.getElementById("complaint-details-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "complaint-details-panel";
      panel.className = "complaint-details-panel";
      panel.innerHTML = `
        <div class="details-panel-header">
          <h3>Complaint Details</h3>
          <button class="close-details-panel" id="close-details-panel">&times;</button>
        </div>
        <div class="details-panel-content" id="complaint-details-content">
          <!-- Content will be populated here -->
        </div>
        <div class="details-panel-footer" id="complaint-details-footer">
          <!-- Action buttons will be populated here -->
        </div>
      `;
      document.body.appendChild(panel);
      // Add event listeners
      document
        .getElementById("close-details-panel")
        .addEventListener("click", () => {
          this.closeComplaintDetailsPanel();
        });
    }
    // Populate panel content
    const content = document.getElementById("complaint-details-content");
    const footer = document.getElementById("complaint-details-footer");
    content.innerHTML = this.generateComplaintDetailsHTML(complaint);
    footer.innerHTML = this.generateComplaintDetailsFooter(complaint);
    // Add event listeners for action buttons
    const assignBtn = document.getElementById("assign-from-details");
    if (assignBtn) {
      assignBtn.addEventListener("click", () => {
        this.closeComplaintDetailsPanel();
        this.openAssignmentModal(complaintId);
      });
    }
    // Show panel
    panel.classList.add("active");
    document.body.classList.add("details-panel-open");
    // Load evidence after a short delay to ensure the panel is visible
    setTimeout(() => {
      this.loadComplaintEvidence(complaintId);
    }, 100);
  }
  generateComplaintDetailsHTML(complaint) {
    const submittedDate = new Date(complaint.submitted_at).toLocaleString();
    const priorityClass = getPriorityClass(complaint.priority);
    return `
      <div class="complaint-details">
        <!-- Header Section -->
        <div class="details-header">
          <div class="complaint-title-section">
            <h4>${escapeHtml(complaint.title || "Untitled Complaint")}</h4>
            <div class="complaint-meta">
              <span class="complaint-id">ID: #${complaint.complaint_id.slice(
                -8
              )}</span>
              <span class="submission-date">Submitted: ${submittedDate}</span>
            </div>
          </div>
          <div class="complaint-status">
            <span class="status-badge ${getStatusClass(
              complaint.status
            )}">${getStatusText(complaint.status)}</span>
            <span class="priority-badge ${priorityClass}">${
      complaint.priority
    }</span>
          </div>
        </div>

        <!-- Main Content Sections -->
        <div class="details-sections">
          <!-- Description Section -->
          <div class="details-section">
            <div class="section-header">
              <h5>📝 Description</h5>
            </div>
            <div class="section-content">
              <p>${escapeHtml(
                complaint.description || "No description provided"
              )}</p>
            </div>
          </div>

          <!-- Location Section -->
          <div class="details-section">
            <div class="section-header">
              <h5>📍 Location</h5>
            </div>
            <div class="section-content">
              <p>${escapeHtml(
                complaint.location_text || "Location not specified"
              )}</p>
              ${
                complaint.latitude && complaint.longitude
                  ? `
                <div class="map-container">
                  <div id="complaint-map-${complaint.complaint_id}" class="complaint-map"></div>
                </div>
              `
                  : ""
              }
            </div>
          </div>

          <!-- Complainant Section -->
          <div class="details-section">
            <div class="section-header">
              <h5>👤 Complainant</h5>
            </div>
            <div class="section-content">
              <div class="complainant-info">
                <p><strong>Name:</strong> ${escapeHtml(
                  complaint.citizen_name || "Unknown"
                )}</p>
                ${
                  complaint.citizen_email
                    ? `<p><strong>Email:</strong> ${escapeHtml(
                        complaint.citizen_email
                      )}</p>`
                    : ""
                }
                ${
                  complaint.citizen_mobile
                    ? `<p><strong>Mobile:</strong> ${escapeHtml(
                        complaint.citizen_mobile
                      )}</p>`
                    : ""
                }
              </div>
            </div>
          </div>
          <!-- Evidence Section -->
          <div class="details-section">
            <div class="section-header">
              <h5>📎 Evidence</h5>
            </div>
            <div class="section-content">
              <div class="evidence-container" id="evidence-container-${
                complaint.complaint_id
              }">
                <div class="evidence-loading">Loading evidence...</div>
              </div>
            </div>
          </div>
          <!-- Assignment Status Section -->
          <div class="details-section">
            <div class="section-header">
              <h5>📋 Assignment Status</h5>
            </div>
            <div class="section-content">
              <div class="status-info">
                <div class="status-item">
                  <span class="status-label">Status:</span>
                  <span class="status-value ${
                    complaint.status === "unassigned"
                      ? "unassigned"
                      : "assigned"
                  }">
                    ${
                      complaint.status === "unassigned"
                        ? "⏳ Unassigned"
                        : "✅ Assigned"
                    }
                  </span>
                </div>
                ${
                  complaint.officer_name
                    ? `
                  <div class="status-item">
                    <span class="status-label">Assigned to:</span>
                    <span class="status-value">${escapeHtml(
                      complaint.officer_name
                    )}</span>
                  </div>
                `
                    : ""
                }
                ${
                  complaint.assigned_at
                    ? `
                  <div class="status-item">
                    <span class="status-label">Assigned:</span>
                    <span class="status-value">${new Date(
                      complaint.assigned_at
                    ).toLocaleString()}</span>
                  </div>
                `
                    : ""
                }
                ${
                  complaint.deadline
                    ? `
                  <div class="status-item">
                    <span class="status-label">Deadline:</span>
                    <span class="status-value deadline">${new Date(
                      complaint.deadline
                    ).toLocaleString()}</span>
                  </div>
                `
                    : ""
                }
              </div>
            </div>
          </div>
          ${
            complaint.notes
              ? `
            <!-- Notes Section -->
            <div class="details-section">
              <div class="section-header">
                <h5>📝 Notes</h5>
              </div>
              <div class="section-content">
                <p>${escapeHtml(complaint.notes)}</p>
              </div>
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;
  }

  generateComplaintDetailsFooter(complaint) {
    return `
      <div class="details-footer-actions">
        <button type="button" class="btn-secondary" id="close-details-panel">Close</button>
        ${
          complaint.status === "unassigned"
            ? `
          <button type="button" class="btn-primary" id="assign-from-details">
            Assign to Officer
          </button>
        `
            : `
          <button type="button" class="btn-secondary" id="view-assignment">
            View Assignment
          </button>
          <button type="button" class="btn-outline" id="reassign-from-details">
            Reassign
          </button>
        `
        }
      </div>
    `;
  }

  async loadComplaintEvidence(complaintId) {
    try {
      const evidenceContainer = document.getElementById(
        `evidence-container-${complaintId}`
      );
      if (!evidenceContainer) {
        console.error(
          "[LGU_ADMIN_ASSIGNMENTS] Evidence container not found for complaint:",
          complaintId
        );
        return;
      }
      // Show loading state
      evidenceContainer.innerHTML = `
        <div class="evidence-loading">
          <div class="loading-spinner"></div>
          <p>Loading evidence files...</p>
        </div>
      `;
      // Make API call to get evidence files from Supabase bucket
      // SECURITY: Use Supabase session token, never localStorage
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(`/api/complaints/${complaintId}/evidence`, {
        method: "GET",
        headers,
      });
      if (!response.ok) {
        throw new Error(
          `Failed to load evidence: ${response.status} ${response.statusText}`
        );
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to load evidence");
      }
      const evidenceFiles = result.data || [];
      if (evidenceFiles.length === 0) {
        evidenceContainer.innerHTML = `
          <div class="evidence-empty">
            <p>No evidence files uploaded for this complaint</p>
          </div>
        `;
        return;
      }
      // Render evidence files
      const evidenceHTML = evidenceFiles
        .map((file) => {
          const fileIcon = this.getFileIcon(file.name);
          const fileSize = this.formatFileSize(file.size);
          const isImage = this.isImageFile(file.name);
          return `
          <div class="evidence-item" data-file-name="${file.name}">
            <div class="evidence-icon">${fileIcon}</div>
            <div class="evidence-info">
              <div class="evidence-name" title="${file.name}">${file.name}</div>
              <div class="evidence-size">${fileSize}</div>
            </div>
            <div class="evidence-actions">
              ${
                isImage
                  ? `
                <button class="btn-sm btn-outline" onclick="this.previewEvidence('${file.name}', '${file.url}')">
                  Preview
                </button>
              `
                  : ""
              }
              <button class="btn-sm btn-primary" onclick="this.downloadEvidence('${
                file.name
              }', '${file.url}')">
                Download
              </button>
            </div>
          </div>
        `;
        })
        .join("");

      evidenceContainer.innerHTML = `
        <div class="evidence-list">
          ${evidenceHTML}
        </div>
      `;

      // Add event listeners for evidence actions
      this.setupEvidenceActionListeners(complaintId);
    } catch (error) {
      console.error("[LGU_ADMIN_ASSIGNMENTS] Error loading evidence:", error);

      // Try to extract detailed error message
      let errorMessage = "Failed to load evidence files";
      if (error.response?.data?.details) {
        const { details } = error.response.data;
        if (details.rejectedOfficers && details.rejectedOfficers.length > 0) {
          const reasons = details.rejectedOfficers
            .map(
              (o) =>
                `${o.email || o.id}: ${o.reason}${
                  o.officerDept
                    ? ` (has: ${o.officerDept}, needs: ${o.requiredDept})`
                    : ""
                }`
            )
            .join("; ");
          errorMessage = `Cannot assign: ${reasons}`;
        }
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      const evidenceContainer = document.getElementById(
        `evidence-container-${complaintId}`
      );
      if (evidenceContainer) {
        evidenceContainer.innerHTML = `
          <div class="evidence-error">
            <p>Unable to load evidence files</p>
            <p class="error-details">${error.message}</p>
          </div>
        `;
      }
    }
  }
  setupEvidenceActionListeners(complaintId) {
    // Preview buttons
    document
      .querySelectorAll(`#evidence-container-${complaintId} .btn-outline`)
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const { fileName } = e.target.closest(".evidence-item").dataset;
          const fileUrl = e.target.onclick.toString().match(/'([^']+)'/)[1];
          this.previewEvidence(fileName, fileUrl);
        });
      });

    // Download buttons
    document
      .querySelectorAll(`#evidence-container-${complaintId} .btn-primary`)
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const { fileName } = e.target.closest(".evidence-item").dataset;
          const fileUrl = e.target.onclick.toString().match(/'([^']+)'/)[1];
          this.downloadEvidence(fileName, fileUrl);
        });
      });
  }

  getFileIcon(fileName) {
    const extension = fileName.split(".").pop().toLowerCase();
    const iconMap = {
      pdf: "📄",
      doc: "📄",
      docx: "📄",
      jpg: "📷",
      jpeg: "📷",
      png: "📷",
      gif: "📷",
      mp4: "🎥",
      avi: "🎥",
      mov: "🎥",
      mp3: "🎵",
      wav: "🎵",
      txt: "📝",
      zip: "📦",
      rar: "📦",
    };
    return iconMap[extension] || "📎";
  }
  formatFileSize(bytes) {
    if (!bytes) return "Unknown size";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
  }
  isImageFile(fileName) {
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp"];
    const extension = fileName.split(".").pop().toLowerCase();
    return imageExtensions.includes(extension);
  }
  previewEvidence(fileName, fileUrl) {
    if (this.isImageFile(fileName)) {
      // Open image in new tab
      window.open(fileUrl, "_blank");
    } else {
      // For non-images, try to open in new tab
      window.open(fileUrl, "_blank");
    }
  }
  downloadEvidence(fileName, fileUrl) {
    // Create a temporary link element to trigger download
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  closeComplaintDetailsPanel() {
    const panel = document.getElementById("complaint-details-panel");
    if (panel) {
      panel.classList.remove("active");
      document.body.classList.remove("details-panel-open");
    }
  }
  selectComplaint(complaint) {
    this.selectedComplaint = complaint;
    this.currentComplaintId = complaint.complaint_id;
    // Update UI to show selected complaint - with null checks
    const assignButton = document.getElementById("assign-button");
    const complaintDetailsBtn = document.getElementById(
      "complaint-details-btn"
    );
    if (assignButton) assignButton.disabled = false;
    if (complaintDetailsBtn) complaintDetailsBtn.disabled = false;
  }
  async handleAssignment() {
    const officerIds = this.getSelectedOfficers();
    if (officerIds.length === 0) {
      showMessage("error", "Please select at least one officer");
      return;
    }
    try {
      const requestData = {
        officerIds,
      };
      const response = await apiClient.post(
        `/api/lgu-admin/complaints/${this.currentComplaintId}/assign`,
        requestData
      );
      if (response && response.success) {
        showMessage("success", "Assignment created successfully");
        this.closeAssignmentModal();
        this.refreshData();
      } else {
        const errorMsg = response?.error || "Failed to create assignment";
        console.error("[LGU_ADMIN_ASSIGNMENTS] Assignment error:", errorMsg);
        console.error("[LGU_ADMIN_ASSIGNMENTS] Full response:", response);
        showMessage("error", errorMsg);
      }
    } catch (error) {
      console.error("[LGU_ADMIN_ASSIGNMENTS] Assignment exception:", error);
      showMessage("error", "Failed to create assignment");
    }
  }
  getPriorityClass(priority) {
    const priorityClasses = {
      low: "priority-low",
      medium: "priority-medium",
      high: "priority-high",
      urgent: "priority-urgent",
    };
    return priorityClasses[priority] || "priority-medium";
  }
  getStatusClass(status) {
    const statusClasses = {
      unassigned: "status-unassigned",
      assigned: "status-assigned",
      active: "status-active",
      in_progress: "status-in-progress",
      completed: "status-completed",
      cancelled: "status-cancelled",
    };
    return statusClasses[status] || "status-unknown";
  }
  getStatusText(status) {
    const statusTexts = {
      unassigned: "Unassigned",
      assigned: "Assigned",
      active: "Active",
      in_progress: "In Progress",
      completed: "Completed",
      cancelled: "Cancelled",
    };
    return statusTexts[status] || status;
  }
}
// Initialize the assignments page
const assignmentsPage = new LguAdminAssignments();
// Make methods available globally for pagination
window.assignmentsPage = assignmentsPage;
document.addEventListener("DOMContentLoaded", () => {
  assignmentsPage.initialize();
});
