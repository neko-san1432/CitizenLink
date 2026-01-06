// Coordinator Review Queue JavaScript
import showToast from "../components/toast.js";
// import BarangayPrioritization from "../components/barangay-prioritization.js";

class ReviewQueue {
  constructor() {
    this.complaints = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.filters = {
      priority: "",
      category: "",
      duplicates: "",
      search: "",
      prioritization: "",
    };
    this.barangayPrioritization = null;
    this.barangayPrioritizationComponent = null;
    this.init();
  }
  async init() {
    this.setupEventListeners();
    this.setupRejectedSection();
    // await this.initBarangayPrioritization();
    await this.loadComplaints();
  }

  /*
  async initBarangayPrioritization() {
    try {
      this.barangayPrioritizationComponent = new BarangayPrioritization("barangay-prioritization-container");
      await this.barangayPrioritizationComponent.loadInsights();
      // Update prioritization map for filtering
      if (this.barangayPrioritizationComponent.insightsData) {
        this.barangayPrioritization = this.buildBarangayMap(this.barangayPrioritizationComponent.insightsData.barangays);
        console.log("[REVIEW_QUEUE] Barangay prioritization loaded:", this.barangayPrioritization.size, "barangays");
        // Enhance complaints if they're already loaded
        if (this.complaints.length > 0) {
          this.enhanceComplaintsWithPrioritization();
          this.renderComplaints();
        }
      }
    } catch (error) {
      console.error("[REVIEW_QUEUE] Error initializing prioritization:", error);
    }
  }
  */

  setupRejectedSection() {
    const toggleBtn = document.getElementById("toggle-rejected-btn");
    const rejectedContainer = document.getElementById("rejected-container");
    let isExpanded = false;
    let rejectedComplaints = [];

    if (toggleBtn && rejectedContainer) {
      toggleBtn.addEventListener("click", async () => {
        if (!isExpanded) {
          // Load rejected complaints
          const loading = document.getElementById("rejected-loading");
          const rejectedList = document.getElementById("rejected-list");

          if (loading) loading.style.display = "block";
          if (rejectedList) rejectedList.innerHTML = "";

          try {
            const response = await fetch("/api/coordinator/rejected", {
              method: "GET",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
            });

            if (!response.ok)
              throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.json();
            rejectedComplaints = data.data || [];

            if (rejectedList) {
              if (rejectedComplaints.length === 0) {
                rejectedList.innerHTML =
                  '<div class="empty-state"><p>No rejected complaints</p></div>';
              } else {
                rejectedList.innerHTML = rejectedComplaints
                  .map((complaint) => this.createComplaintCard(complaint, true))
                  .join("");
                this.attachRejectedEventListeners();
              }
            }

            toggleBtn.textContent = "Hide Rejected";
            rejectedContainer.style.display = "block";
            isExpanded = true;
          } catch (error) {
            console.error("Error loading rejected complaints:", error);
            showToast("Failed to load rejected complaints", "error");
            if (rejectedList) {
              rejectedList.innerHTML =
                '<div class="empty-state"><p>Error loading rejected complaints</p></div>';
            }
          } finally {
            if (loading) loading.style.display = "none";
          }
        } else {
          toggleBtn.textContent = "Show Rejected";
          rejectedContainer.style.display = "none";
          isExpanded = false;
        }
      });
    }
  }

  attachRejectedEventListeners() {
    document.querySelectorAll("#rejected-list .view-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const complaintId = e.target.getAttribute("data-complaint-id");
        this.viewComplaint(complaintId);
      });
    });
  }
  setupEventListeners() {
    // Filter controls
    const priorityFilter = document.getElementById("filter-priority");
    const categoryFilter = document.getElementById("filter-type");
    const duplicateFilter = document.getElementById("filter-similar");
    const searchInput = document.getElementById("search-input");
    if (priorityFilter) {
      priorityFilter.addEventListener("change", (e) => {
        this.filters.priority = e.target.value;
        this.applyFilters();
      });
    }
    if (categoryFilter) {
      categoryFilter.addEventListener("change", (e) => {
        this.filters.category = e.target.value;
        this.applyFilters();
      });
    }
    if (duplicateFilter) {
      duplicateFilter.addEventListener("change", (e) => {
        this.filters.duplicates = e.target.value;
        this.applyFilters();
      });
    }

    const prioritizationFilter = document.getElementById(
      "filter-prioritization"
    );
    if (prioritizationFilter) {
      prioritizationFilter.addEventListener("change", (e) => {
        this.filters.prioritization = e.target.value;
        this.applyFilters();
      });
    }
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.filters.search = e.target.value;
        this.debounce(() => this.applyFilters(), 300)();
      });
    }
    // Pagination
    const prevBtn = document.getElementById("prev-page");
    const nextBtn = document.getElementById("next-page");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => this.previousPage());
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => this.nextPage());
    }
  }
  applyFilters() {
    this.currentPage = 1; // Reset to first page when filtering
    this.renderComplaints();
  }
  async loadComplaints() {
    try {
      this.showLoading();

      const complaintsResponse = await fetch("/api/coordinator/review-queue", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!complaintsResponse.ok) {
        throw new Error(`HTTP error! status: ${complaintsResponse.status}`);
      }

      const complaintsData = await complaintsResponse.json();
      this.complaints = complaintsData.data || complaintsData.complaints || [];

      console.log(`[REVIEW_QUEUE] Loaded ${this.complaints.length} complaints`);
      if (this.complaints.length > 0) {
        const sample = this.complaints[0];
        console.log("[REVIEW_QUEUE] Sample complaint:", {
          id: sample.id,
          barangay: sample.barangay,
          hasBarangay: Boolean(sample.barangay),
          latitude: sample.latitude,
          longitude: sample.longitude,
        });
      }

      // Enhance complaints with prioritization if available
      if (this.barangayPrioritization) {
        this.enhanceComplaintsWithPrioritization();
      } else if (
        this.barangayPrioritizationComponent &&
        this.barangayPrioritizationComponent.insightsData
      ) {
        // Build map if not already built
        this.barangayPrioritization = this.buildBarangayMap(
          this.barangayPrioritizationComponent.insightsData.barangays
        );
        this.enhanceComplaintsWithPrioritization();
      } else {
        console.warn(
          "[REVIEW_QUEUE] Prioritization not available yet, complaints will be enhanced when prioritization loads"
        );
      }

      this.renderComplaints();
    } catch (error) {
      console.error("Error loading complaints:", error);
      this.showError("Failed to load complaints. Please try again.");
    }
  }

  buildBarangayMap(barangays) {
    const map = new Map();
    barangays.forEach((barangay) => {
      map.set(barangay.barangay, barangay.prioritizationScore);
    });
    return map;
  }

  enhanceComplaintsWithPrioritization() {
    if (!this.barangayPrioritization) {
      console.warn(
        "[REVIEW_QUEUE] Cannot enhance complaints: prioritization map not available"
      );
      return;
    }

    let enhancedCount = 0;
    // Enhance each complaint with its barangay prioritization score
    this.complaints.forEach((complaint) => {
      if (
        complaint.barangay &&
        this.barangayPrioritization.has(complaint.barangay)
      ) {
        complaint.prioritizationScore = this.barangayPrioritization.get(
          complaint.barangay
        );
        complaint.priorityLevel = this.getPriorityLevelFromScore(
          complaint.prioritizationScore
        );
        enhancedCount++;
      } else {
        complaint.prioritizationScore = 0;
        complaint.priorityLevel = "low";
        if (complaint.barangay) {
          console.warn(
            `[REVIEW_QUEUE] Barangay "${complaint.barangay}" not found in prioritization map`
          );
        }
      }
    });
    console.log(
      `[REVIEW_QUEUE] Enhanced ${enhancedCount} out of ${this.complaints.length} complaints with prioritization scores`
    );
  }

  getPriorityLevelFromScore(score) {
    if (score >= 50) return "critical";
    if (score >= 30) return "high";
    if (score >= 15) return "medium";
    return "low";
  }
  renderComplaints() {
    const complaintList = document.getElementById("complaint-list");
    const loading = document.getElementById("loading");
    const emptyState = document.getElementById("empty-state");
    if (!complaintList) {
      console.error("complaint-list element not found");
      return;
    }
    console.log("Rendering complaints, total count:", this.complaints.length);
    const filteredComplaints = this.getFilteredComplaints();
    console.log("Filtered complaints:", filteredComplaints.length);
    const paginatedComplaints = this.getPaginatedComplaints(filteredComplaints);
    console.log("Paginated complaints:", paginatedComplaints.length);
    // Hide loading state
    if (loading) loading.style.display = "none";
    if (paginatedComplaints.length === 0) {
      complaintList.style.display = "none";
      if (emptyState) {
        emptyState.style.display = "block";
        emptyState.innerHTML = `
                    <h2>No complaints found</h2>
                    <p>No complaints match your current filters.</p>
                `;
      }
      return;
    }
    // Show complaint list and hide empty state
    complaintList.style.display = "block";
    if (emptyState) emptyState.style.display = "none";
    // Reset debug flag for this render
    this._lastLoggedCardId = null;
    complaintList.innerHTML = paginatedComplaints
      .map((complaint) => this.createComplaintCard(complaint))
      .join("");
    this.updatePagination(filteredComplaints.length);
    this.attachEventListeners();
  }
  attachEventListeners() {
    // View buttons
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const complaintId = e.target.getAttribute("data-complaint-id");
        this.viewComplaint(complaintId);
      });
    });
    // Reject buttons
    document.querySelectorAll(".reject-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const complaintId = e.target.getAttribute("data-complaint-id");
        this.rejectComplaint(complaintId);
      });
    });
  }
  createComplaintCard(complaint, isRejected = false) {
    const priorityBadge = this.getPriorityBadgeClass(complaint.priority);
    const algorithmFlags = complaint.algorithm_flags || {};
    const prioritizationScore = complaint.prioritizationScore || 0;
    const priorityLevel = complaint.priorityLevel || "low";
    const barangay = complaint.barangay || null;

    // Debug: Log first complaint being rendered
    const isFirstCard = !this._lastLoggedCardId;
    if (isFirstCard) {
      this._lastLoggedCardId = complaint.id;
      console.log("[REVIEW_QUEUE] Creating card for complaint:", {
        id: complaint.id.substring(0, 8),
        barangay,
        prioritizationScore,
        priorityLevel,
        hasBarangay: Boolean(barangay),
      });
    }

    let flagHTML = "";
    if (algorithmFlags.high_confidence_duplicate) {
      flagHTML = `
                <div class="algorithm-flag high-confidence">
                    <span class="flag-icon">⚠️</span>
                    <span class="flag-text">
                        <strong>HIGH CONFIDENCE DUPLICATE DETECTED</strong>
                        <span class="flag-subtext">Similarity score ≥85% - Review required</span>
                    </span>
                </div>
            `;
    } else if (algorithmFlags.has_duplicates) {
      flagHTML = `
                <div class="algorithm-flag">
                    <span class="flag-icon">🔍</span>
                    <span class="flag-text">
                        ${algorithmFlags.similarity_count} potential duplicate(s) found
                    </span>
                </div>
            `;
    }

    // Add prioritization suggestion badge
    let prioritizationSuggestionHTML = "";

    // Show suggestion for any complaint with a barangay
    if (barangay) {
      const suggestionClass = `prioritization-suggestion ${priorityLevel}`;
      let suggestionText = "";

      // Determine suggestion text based on priority level
      if (priorityLevel === "critical") {
        suggestionText = "🚨 Critical Priority Barangay - Assign First!";
      } else if (priorityLevel === "high") {
        suggestionText = "⚡ High Priority Barangay - Recommended";
      } else if (priorityLevel === "medium") {
        suggestionText = "📊 Medium Priority Barangay";
      } else {
        // Show for all barangays, even low priority
        suggestionText = "📍 Barangay Prioritization";
      }

      // Always show suggestion if barangay exists
      prioritizationSuggestionHTML = `
                <div class="${suggestionClass}">
                    ${suggestionText}
                    <span class="barangay-name">${this.escapeHtml(
                      barangay
                    )}</span>
                    ${
                      prioritizationScore > 0
                        ? `<span class="priority-score">Score: ${prioritizationScore}</span>`
                        : ""
                    }
                </div>
            `;

      // Debug: Log when suggestion is added (for first card only)
      if (isFirstCard) {
        console.log("[REVIEW_QUEUE] ✓ Added suggestion badge:", {
          barangay,
          priorityLevel,
          score: prioritizationScore,
          htmlLength: prioritizationSuggestionHTML.length,
          htmlPreview: prioritizationSuggestionHTML.substring(0, 100),
        });
      }
    } else {
      // Debug: Log when no suggestion (for first card only)
      if (isFirstCard) {
        console.log("[REVIEW_QUEUE] ✗ No suggestion - no barangay:", {
          id: complaint.id.substring(0, 8),
          hasBarangay: Boolean(complaint.barangay),
        });
      }
    }

    return `
            <div class="complaint-card ${
              complaint.priority?.toLowerCase() || "medium"
            } ${
      priorityLevel === "critical" || priorityLevel === "high"
        ? "high-priority-barangay"
        : ""
    }" data-complaint-id="${
      complaint.id
    }" data-priority-score="${prioritizationScore}">
                ${prioritizationSuggestionHTML}
                <div class="complaint-header">
                    <div>
                        <div class="complaint-id">#${complaint.id}</div>
                        <h3 class="complaint-title">${
                          complaint.title || "Untitled Complaint"
                        }</h3>
                    </div>
                    <div class="complaint-status status-${
                      complaint.workflow_status?.toLowerCase() ||
                      complaint.status?.toLowerCase() ||
                      "pending"
                    }">
                        ${
                          complaint.workflow_status ||
                          complaint.status ||
                          "Pending"
                        }
                    </div>
                </div>
                <div class="complaint-content">
                    <p class="complaint-description">${
                      complaint.descriptive_su ||
                      complaint.description ||
                      "No description provided"
                    }</p>
                    <div class="complaint-meta">
                        <span class="badge ${priorityBadge}">${
      complaint.priority || "Medium"
    }</span>
                        <span class="badge badge-medium">${
                          complaint.category || "General"
                        }</span>
                        ${
                          barangay
                            ? `<span class="badge badge-info">📍 ${barangay}</span>`
                            : ""
                        }
                        <span class="complaint-date">${this.formatTimeAgo(
                          complaint.submitted_at || complaint.created_at
                        )}</span>
                    </div>
                    ${flagHTML}
                </div>
                <div class="complaint-actions">
                    <button class="btn btn-primary view-btn" data-complaint-id="${
                      complaint.id
                    }">
                        View Details
                    </button>
                    ${
                      !isRejected
                        ? `<button class="btn btn-danger reject-btn" data-complaint-id="${complaint.id}">
                        Reject
                    </button>`
                        : `<span class="badge badge-danger" style="padding: 8px 12px;">Rejected</span>`
                    }
                    ${
                      isRejected && complaint.coordinator_notes
                        ? `<div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 4px;">
                        <strong>Rejection Reason:</strong> ${complaint.coordinator_notes}
                    </div>`
                        : ""
                    }
                </div>
            </div>
        `;
  }
  getFilteredComplaints() {
    let filtered = this.complaints.filter((complaint) => {
      // Priority filter
      const matchesPriority =
        !this.filters.priority ||
        this.filters.priority === "" ||
        complaint.priority?.toLowerCase() ===
          this.filters.priority.toLowerCase();
      // Category filter
      const matchesCategory =
        !this.filters.category ||
        this.filters.category === "" ||
        complaint.category?.toLowerCase() ===
          this.filters.category.toLowerCase();
      // Duplicate filter
      const matchesDuplicates =
        !this.filters.duplicates ||
        this.filters.duplicates === "" ||
        (this.filters.duplicates === "yes" &&
          complaint.algorithm_flags?.has_duplicates) ||
        (this.filters.duplicates === "no" &&
          !complaint.algorithm_flags?.has_duplicates);
      // Search filter
      const matchesSearch =
        !this.filters.search ||
        this.filters.search === "" ||
        complaint.title
          ?.toLowerCase()
          .includes(this.filters.search.toLowerCase()) ||
        (complaint.descriptive_su || complaint.description)
          ?.toLowerCase()
          .includes(this.filters.search.toLowerCase());
      return (
        matchesPriority && matchesCategory && matchesDuplicates && matchesSearch
      );
    });

    // Sort by prioritization if filter is set, otherwise default to highest priority first
    if (this.barangayPrioritization) {
      filtered = filtered.sort((a, b) => {
        const scoreA =
          a.prioritizationScore ||
          this.barangayPrioritization.get(a.barangay || "") ||
          0;
        const scoreB =
          b.prioritizationScore ||
          this.barangayPrioritization.get(b.barangay || "") ||
          0;

        if (this.filters.prioritization) {
          // Use filter setting
          return this.filters.prioritization === "desc"
            ? scoreB - scoreA
            : scoreA - scoreB;
        }
        // Default: highest priority first
        return scoreB - scoreA;
      });
    }

    return filtered;
  }
  getPaginatedComplaints(complaints) {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return complaints.slice(startIndex, endIndex);
  }
  updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / this.itemsPerPage);
    const paginationContainer = document.getElementById("pagination-container");
    const pageInfo = document.getElementById("page-info");
    const itemsInfo = document.getElementById("items-info");
    const prevBtn = document.getElementById("prev-page");
    const nextBtn = document.getElementById("next-page");
    const pageNumbers = document.getElementById("page-numbers");

    // Show/hide pagination container
    if (totalPages > 1) {
      if (paginationContainer) paginationContainer.style.display = "flex";
    } else {
      if (paginationContainer) paginationContainer.style.display = "none";
      return;
    }

    // Update page info
    if (pageInfo) {
      pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
    }

    // Update items info
    if (itemsInfo) {
      const startItem =
        totalItems === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
      const endItem = Math.min(
        this.currentPage * this.itemsPerPage,
        totalItems
      );
      itemsInfo.textContent = `Showing ${startItem}-${endItem} of ${totalItems} complaints`;
    }

    // Update prev/next buttons
    if (prevBtn) {
      prevBtn.disabled = this.currentPage === 1;
    }
    if (nextBtn) {
      nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
    }

    // Generate page numbers
    if (pageNumbers) {
      pageNumbers.innerHTML = "";
      const maxVisiblePages = 7;
      let startPage = Math.max(
        1,
        this.currentPage - Math.floor(maxVisiblePages / 2)
      );
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      // Adjust start page if we're near the end
      if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      // First page
      if (startPage > 1) {
        const firstBtn = document.createElement("button");
        firstBtn.className = "page-number";
        firstBtn.textContent = "1";
        firstBtn.addEventListener("click", () => this.goToPage(1));
        pageNumbers.appendChild(firstBtn);

        if (startPage > 2) {
          const ellipsis = document.createElement("span");
          ellipsis.className = "page-number ellipsis";
          ellipsis.textContent = "...";
          pageNumbers.appendChild(ellipsis);
        }
      }

      // Page numbers
      for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement("button");
        pageBtn.className = "page-number";
        if (i === this.currentPage) {
          pageBtn.classList.add("active");
        }
        pageBtn.textContent = i.toString();
        pageBtn.addEventListener("click", () => this.goToPage(i));
        pageNumbers.appendChild(pageBtn);
      }

      // Last page
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          const ellipsis = document.createElement("span");
          ellipsis.className = "page-number ellipsis";
          ellipsis.textContent = "...";
          pageNumbers.appendChild(ellipsis);
        }

        const lastBtn = document.createElement("button");
        lastBtn.className = "page-number";
        lastBtn.textContent = totalPages.toString();
        lastBtn.addEventListener("click", () => this.goToPage(totalPages));
        pageNumbers.appendChild(lastBtn);
      }
    }
  }

  goToPage(page) {
    const totalPages = Math.ceil(
      this.getFilteredComplaints().length / this.itemsPerPage
    );
    if (page >= 1 && page <= totalPages) {
      this.currentPage = page;
      this.renderComplaints();
      // Scroll to top of complaint list
      const complaintList = document.getElementById("complaint-list");
      if (complaintList) {
        complaintList.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }
  previousPage() {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }
  nextPage() {
    const totalPages = Math.ceil(
      this.getFilteredComplaints().length / this.itemsPerPage
    );
    if (this.currentPage < totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }
  async viewComplaint(complaintId) {
    try {
      // Redirect to the dedicated complaint review page
      window.location.href = `/coordinator/review/${complaintId}`;
    } catch (error) {
      console.error("Error redirecting to complaint details:", error);
      this.showError("Failed to navigate to complaint details.");
    }
  }
  async rejectComplaint(complaintId) {
    const reason = prompt("Please provide a reason for rejection:");
    if (!reason) return;
    try {
      const response = await fetch(
        `/api/coordinator/review-queue/${complaintId}/decide`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            decision: "reject",
            data: { reason },
          }),
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      showToast("Complaint rejected successfully", "success");
      this.loadComplaints();
    } catch (error) {
      console.error("Error rejecting complaint:", error);
      this.showError("Failed to reject complaint.");
    }
  }
  showLoading() {
    const loading = document.getElementById("loading");
    const complaintList = document.getElementById("complaint-list");
    const emptyState = document.getElementById("empty-state");
    if (loading) loading.style.display = "block";
    if (complaintList) complaintList.style.display = "none";
    if (emptyState) emptyState.style.display = "none";
  }
  showError(message) {
    showToast(message, "error");
  }
  getPriorityBadgeClass(priority) {
    const map = {
      urgent: "badge-urgent",
      high: "badge-high",
      medium: "badge-medium",
      low: "badge-low",
    };
    return map[priority] || "badge-medium";
  }
  formatTimeAgo(dateString) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  }
  formatDate(dateString) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.reviewQueue = new ReviewQueue();
});
