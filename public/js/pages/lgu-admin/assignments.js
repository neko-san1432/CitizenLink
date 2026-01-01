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
    this.currentComplaintId = null;
    this.selectedComplaint = null;
    this.currentAssignmentFilter = "all"; // For client-side filtering (all, unassigned, assigned)
    this.filters = {
      status: "all",
      priority: "all",
      sub_type: "all",
      date_start: "",
      date_end: "",
    };
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.totalItems = 0;
    this.stats = { unassigned: 0, urgent: 0, high: 0 };
    this.uniqueSubcategories = new Set();
    this.initialize();
  }
  async initialize() {
    this.setupEventListeners();
    // Show loading state initially
    this.showLoadingState();
    try {
      // Load officers and assignments (paginated)
      await this.loadOfficers();
      await this.loadAssignments();
      this.renderAssignments();
    } catch (error) {
      console.error("[LGU_ADMIN_ASSIGNMENTS] Initialization error:", error);
      this.hideLoadingState();
      showMessage("error", "Failed to initialize assignments page");
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
      if (this.filters.date_start)
        queryParams.append("date_start", this.filters.date_start);
      if (this.filters.date_end)
        queryParams.append("date_end", this.filters.date_end);

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

        // Populate dynamic subcategories from metadata if available, or accumulate from data
        if (response.unique_subcategories) {
          this.updateSubcategoryFilter(response.unique_subcategories);
        } else {
          // Fallback: extract from current page (less ideal but functional)
          this.extractSubcategories(newAssignments);
        }

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

  extractSubcategories(assignments) {
    let hasNew = false;
    assignments.forEach((a) => {
      // Assuming 'subcategory' or 'complaint_type' field exists
      const subtype = a.subcategory || a.complaint_type;
      if (subtype && !this.uniqueSubcategories.has(subtype)) {
        this.uniqueSubcategories.add(subtype);
        hasNew = true;
      }
    });

    if (hasNew) {
      this.updateSubcategoryFilter(Array.from(this.uniqueSubcategories));
    }
  }

  updateSubcategoryFilter(subtypes) {
    const select = document.getElementById("subtype-filter");
    if (!select) return;

    // Keep "All" option
    const currentVal = select.value;

    // Clear current options except "All"
    while (select.options.length > 1) {
      select.remove(1);
    }

    subtypes.sort().forEach((subtype) => {
      const option = document.createElement("option");
      option.value = subtype;
      option.textContent = subtype;
      select.appendChild(option);
    });

    // Restore selection if valid
    if (subtypes.includes(currentVal)) {
      select.value = currentVal;
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
    const assignmentsTable = document.getElementById(
      "assignments-table-container"
    );
    const tableBody = document.getElementById("assignments-table-body");
    const emptyState = document.getElementById("empty-state");

    if (loadingState) loadingState.style.display = "block";
    if (assignmentsList) assignmentsList.style.display = "none";
    if (assignmentsTable) assignmentsTable.classList.add("hidden");
    if (tableBody) tableBody.innerHTML = ""; // Clear potential duplicate spinner
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
        const target = e.target.closest(".filter-btn");
        if (!target) return;

        // Remove active class from all filter buttons
        document
          .querySelectorAll(".filter-btn")
          .forEach((b) => b.classList.remove("active"));

        // Add active class to clicked button
        target.classList.add("active");

        // Get filter value
        const filterValue = target.dataset.filter;

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
    const dateStart = document.getElementById("date-start");
    const dateEnd = document.getElementById("date-end");
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
    if (dateStart) {
      dateStart.addEventListener("change", (e) => {
        this.filters.date_start = e.target.value;
        this.applyFilters();
      });
    }
    if (dateEnd) {
      dateEnd.addEventListener("change", (e) => {
        this.filters.date_end = e.target.value;
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
    const _paginationControls = document.getElementById("pagination-controls");

    if (tableContainer) {
      tableContainer.classList.remove("hidden");
    }

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
    const {totalItems} = this;

    if (totalItems === 0 && paginatedData.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-12">
            <div class="flex flex-col items-center gap-4">
                <div class="text-4xl">📋</div>
                <div class="text-gray-600 dark:text-gray-300 font-semibold">No assignments found</div>
                <div class="text-gray-500 dark:text-gray-400 text-sm">Try adjusting your filters</div>
            </div>
          </td>
        </tr>
      `;
      tableContainer.style.display = "block";
      this.updatePaginationControls();
      this.updateStats();
      return;
    }

    // Render rows
    tableBody.innerHTML = paginatedData
      .map((assignment) => this.renderAssignmentRow(assignment))
      .join("");
    tableContainer.style.display = "block";

    // Update controls
    this.updatePaginationControls();

    // Update stats
    this.updateStats();

    // Add event listeners
    this.setupAssignmentActionListeners();
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

  updatePaginationControls() {
    const container = document.getElementById("pagination-controls");
    if (!container) return;

    // Show container if we have items or filters are active (to show 0 results)
    container.classList.remove("hidden");
    container.style.display = "flex";

    const {totalItems} = this;
    const {currentPage} = this;
    const limit = this.itemsPerPage;
    const totalPages = Math.ceil(totalItems / limit);

    // Calculate start and end
    const start = totalItems === 0 ? 0 : (currentPage - 1) * limit + 1;
    const end = Math.min(currentPage * limit, totalItems);

    // Update text
    const pageStartEl = document.getElementById("page-start");
    const pageEndEl = document.getElementById("page-end");
    const totalItemsEl = document.getElementById("total-items");
    const currentPageDisplay = document.getElementById("current-page-display");

    if (pageStartEl) pageStartEl.textContent = start;
    if (pageEndEl) pageEndEl.textContent = end;
    if (totalItemsEl) totalItemsEl.textContent = totalItems;
    if (currentPageDisplay)
      currentPageDisplay.textContent = `Page ${currentPage} of ${
        totalPages || 1
      }`;

    // Update buttons
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const prevBtnMobile = document.getElementById("prev-btn-mobile");
    const nextBtnMobile = document.getElementById("next-btn-mobile");

    this.setupPaginationButton(prevBtn, currentPage > 1, currentPage - 1);
    this.setupPaginationButton(
      nextBtn,
      currentPage < totalPages,
      currentPage + 1
    );
    this.setupPaginationButton(prevBtnMobile, currentPage > 1, currentPage - 1);
    this.setupPaginationButton(
      nextBtnMobile,
      currentPage < totalPages,
      currentPage + 1
    );
  }

  setupPaginationButton(btn, isEnabled, targetPage) {
    if (!btn) return;

    btn.disabled = !isEnabled;
    if (isEnabled) {
      // Remove old listeners to prevent duplicates
      const newBtn = btn.cloneNode(true);
      if (btn.parentNode) {
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.onclick = () => this.changePage(targetPage);
      }
    }
  }

  // Legacy Loop/Load More - Removed
  updateLoadMoreControls() {}

  async changePage(newPage) {
    if (newPage < 1) return;
    this.currentPage = newPage;
    this.assignments = []; // Clear current list

    // Show spinner in table
    const tableBody = document.getElementById("assignments-table-body");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8"><div class="loading-spinner"></div></td></tr>`;
    }

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
    const _dateDisplay = assignment.assigned_at
      ? new Date(assignment.assigned_at).toLocaleDateString()
      : new Date(assignment.submitted_at).toLocaleDateString();

    const isCompleted = ["completed", "cancelled"].includes(
      assignment.status?.toLowerCase()
    );
    const disabledAttr = isCompleted ? "disabled" : "";
    const disabledClass = isCompleted ? "opacity-50 cursor-not-allowed" : "";

    return `
      <tr class="border-b border-gray-100 dark:border-gray-700 transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-700/50">
        <td class="p-4 text-sm text-gray-500 dark:text-gray-400">
          #${
  assignment.display_id ||
            (assignment.complaint_id
              ? assignment.complaint_id.slice(-8)
              : "N/A")
}
        </td>
        <td class="p-4">
          <div class="font-semibold text-gray-800 dark:text-gray-200 mb-1">${escapeHtml(
    assignment.title || "Untitled"
  )}</div>
          <div class="text-gray-500 dark:text-gray-400 text-xs max-w-[250px] truncate">
            ${escapeHtml(assignment.description || "No description")}
          </div>
        </td>
        <td class="p-4">
           <div class="text-gray-700 dark:text-gray-300 text-sm">${escapeHtml(
    assignment.citizen_name || "Unknown"
  )}</div>
           <div class="text-gray-400 dark:text-gray-500 text-xs">${escapeHtml(
    assignment.location_text || "No location"
  )}</div>
        </td>
        <td class="p-4">
           ${
  assignment.officer_name
    ? `<div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xs font-bold ring-2 ring-white dark:ring-gray-700">
                        ${assignment.officer_name.charAt(0)}
                    </div>
                    <div class="text-sm text-gray-700 dark:text-gray-300">${escapeHtml(
    assignment.officer_name
  )}</div>
                  </div>`
    : '<span class="text-gray-400 dark:text-gray-500 italic text-sm">Unassigned</span>'
}
        </td>
        <td class="p-4">
          <span class="px-3 py-1 rounded-full text-xs font-semibold uppercase ${priorityClass}">${
  assignment.priority
}</span>
        </td>
        <td class="p-4">
          <div class="flex flex-col items-start gap-1">
            <span class="px-3 py-1 rounded-full text-xs font-semibold ${statusClass}">${getStatusText(
  assignment.status
)}</span>
            ${
  assignment.has_other_assignments && !assignment.assigned_to
    ? `<span class="text-[10px] text-orange-600 dark:text-orange-400 font-medium bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded border border-orange-100 dark:border-orange-800 whitespace-nowrap">
                     Assigned by others
                   </span>`
    : ""
}
          </div>
        </td>
        <td class="p-4 text-center">
          ${
  assignment.status === "unassigned" || !assignment.assigned_to
    ? `<button class="btn btn-primary btn-sm assign-btn ${disabledClass}" data-complaint-id="${assignment.complaint_id}" ${disabledAttr}>
                   <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                   Assign
                 </button>`
    : `<button class="btn btn-secondary btn-sm reassign-btn ${disabledClass}" data-complaint-id="${assignment.complaint_id}" ${disabledAttr}>
                   <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                   Manage
                 </button>`
}
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
        <div class="complaint-summary-title font-semibold text-gray-900 dark:text-white mb-2">${escapeHtml(
    complaint.title || "Untitled Complaint"
  )}</div>
        <div class="complaint-summary-detail text-sm text-gray-600 dark:text-gray-300 mb-1"><strong>ID:</strong> #${complaint.complaint_id.slice(
    -8
  )}</div>
        <div class="complaint-summary-detail text-sm text-gray-600 dark:text-gray-300 mb-1"><strong>Description:</strong> ${escapeHtml(
    complaint.description || "No description"
  )}</div>
        <div class="complaint-summary-detail text-sm text-gray-600 dark:text-gray-300 mb-1"><strong>Location:</strong> ${escapeHtml(
    complaint.location_text || "Not specified"
  )}</div>
        <div class="complaint-summary-detail text-sm text-gray-600 dark:text-gray-300 mb-1"><strong>Citizen:</strong> ${escapeHtml(
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
          '<div class="no-officers text-center text-gray-400 dark:text-gray-500 italic p-4">No officers available</div>';
      } else {
        this.officers.forEach((officer, _index) => {
          const checkboxItem = document.createElement("div");
          checkboxItem.className =
            "officer-checkbox-item flex items-center p-2 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer";
          checkboxItem.innerHTML = `
            <input type="checkbox" id="officer-${officer.id}" value="${
  officer.id
}" name="officers" class="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600">
            <label for="officer-${
  officer.id
}" class="flex-1 cursor-pointer text-sm font-medium text-gray-900 dark:text-gray-300">
              <div class="officer-info flex flex-col gap-1">
                <div class="officer-name font-medium text-gray-800 dark:text-gray-200">${escapeHtml(
    officer.name
  )}</div>
                <div class="officer-details text-xs text-gray-500 dark:text-gray-400">${escapeHtml(
    officer.email
  )} • ${officer.employee_id || "No ID"}</div>
              </div>
            </label>
          `;
          officerCheckboxes.appendChild(checkboxItem);
        });
      }
    }
    // Show modal
    // Show modal
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    modal.style.display = ""; // cleared
    modal.style.visibility = "";
    modal.style.opacity = "";
    modal.style.zIndex = "";
    document.body.style.overflow = "hidden";
  }
  closeAssignmentModal() {
    const modal = document.getElementById("assignment-modal");
    if (modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      modal.style.display = "";
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
      <div class="flex gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 justify-end">
        <button type="button" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-sm" id="close-details-panel">Close</button>
        ${
  complaint.status === "unassigned"
    ? `
          <button type="button" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium text-sm shadow-sm" id="assign-from-details">
            Assign to Officer
          </button>
        `
    : `
          <button type="button" class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-sm" id="view-assignment">
            View Assignment
          </button>
          <button type="button" class="px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors font-medium text-sm ml-2" id="reassign-from-details">
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
                <button class="px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors" onclick="this.previewEvidence('${file.name}', '${file.url}')">
                  Preview
                </button>
              `
    : ""
}
              <button class="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors ml-1" onclick="this.downloadEvidence('${
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
        _errorMessage = error.response.data.error;
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
