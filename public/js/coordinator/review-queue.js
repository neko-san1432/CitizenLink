import showToast from "../components/toast.js";
import DepartmentSelectionModal from "./department-selection-modal.js";

class ReviewQueueController {
  constructor() {
    // UI Elements
    this.container = document.getElementById("complaint-list");
    this.loading = document.getElementById("loading");
    this.emptyState = document.getElementById("empty-state");
    this.searchInput = document.getElementById("search-input");
    this.priorityFilter = document.getElementById("filter-priority");
    this.typeFilter = document.getElementById("filter-type");
    this.similarFilter = document.getElementById("filter-similar");
    this.sortFilter = document.getElementById("filter-prioritization");

    // Badges
    this.countBadge = document.getElementById("queue-count-badge");
    this.urgentBadge = document.getElementById("queue-urgent-badge");

    // Pagination Elements
    this.paginationContainer = document.getElementById("pagination-container");
    this.prevBtn = document.getElementById("prev-page");
    this.nextBtn = document.getElementById("next-page");
    this.pageInfo = document.getElementById("page-info");
    this.itemsInfo = document.getElementById("items-info");

    // State
    this.complaints = [];
    this.filteredComplaints = [];
    this.currentPage = 1;
    this.itemsPerPage = 9;

    console.log("[REVIEW_QUEUE] Initializing v3 (Feature Restoration)");
    this.init();
  }

  async init() {
    if (!this.container) {
      console.error("[REVIEW_QUEUE] Fatal: Container not found");
      return;
    }

    // Initialize modal
    this.deptModal = new DepartmentSelectionModal();

    // Bind events
    this.attachEventListeners();

    // Load data
    await this.loadComplaints();
  }

  attachEventListeners() {
    // Filters
    [this.searchInput, this.priorityFilter, this.typeFilter, this.similarFilter, this.sortFilter]
      .forEach(el => {
        if (el) el.addEventListener("input", () => this.applyFilters());
      });

    // Pagination
    if (this.prevBtn) this.prevBtn.addEventListener("click", () => this.changePage(-1));
    if (this.nextBtn) this.nextBtn.addEventListener("click", () => this.changePage(1));
  }

  async loadComplaints() {
    try {
      if (this.loading) this.loading.style.display = "block";

      const response = await fetch("/api/coordinator/review-queue", {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();
      this.complaints = json.data || json.complaints || [];

      console.log(`[REVIEW_QUEUE] Loaded ${this.complaints.length} items`);
      this.updateStats();
      this.applyFilters(); // This triggers render

    } catch (error) {
      console.error("[REVIEW_QUEUE] Error:", error);
      showToast("Failed to load complaints: " + error.message, "error");
      if (this.loading) this.loading.style.display = "none";
    }
  }

  updateStats() {
    if (this.countBadge) this.countBadge.textContent = this.complaints.length;

    const urgentCount = this.complaints.filter(c =>
      (c.priority || "").toLowerCase() === "urgent" ||
      (c.priority || "").toLowerCase() === "critical"
    ).length;

    if (this.urgentBadge) {
      this.urgentBadge.textContent = `${urgentCount} Urgent`;
      this.urgentBadge.classList.toggle("hidden", urgentCount === 0);
    }
  }

  applyFilters() {
    const query = (this.searchInput?.value || "").toLowerCase();
    const priority = this.priorityFilter?.value || "";
    const category = this.typeFilter?.value || "";
    const sort = this.sortFilter?.value || "";

    this.filteredComplaints = this.complaints.filter(c => {
      const matchesQuery = !query ||
        (JSON.stringify(c).toLowerCase().includes(query));

      const matchesPriority = !priority || (c.priority || "").toLowerCase() === priority;
      const matchesCategory = !category || (c.category || "").includes(category);

      return matchesQuery && matchesPriority && matchesCategory;
    });

    // Sorting
    if (sort === "desc") {
      // Priority desc (High to Low)
      const pMap = { urgent: 4, critical: 4, high: 3, medium: 2, low: 1 };
      this.filteredComplaints.sort((a, b) => (pMap[b.priority?.toLowerCase()] || 0) - (pMap[a.priority?.toLowerCase()] || 0));
    } else if (sort === "asc") {
      const pMap = { urgent: 4, critical: 4, high: 3, medium: 2, low: 1 };
      this.filteredComplaints.sort((a, b) => (pMap[a.priority?.toLowerCase()] || 0) - (pMap[b.priority?.toLowerCase()] || 0));
    } else {
      // Default: Date desc
      this.filteredComplaints.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    this.currentPage = 1;
    this.render();
  }

  changePage(delta) {
    const totalPages = Math.ceil(this.filteredComplaints.length / this.itemsPerPage);
    const newPage = this.currentPage + delta;

    if (newPage >= 1 && newPage <= totalPages) {
      this.currentPage = newPage;
      this.render();
    }
  }

  render() {
    // Hide loading
    if (this.loading) this.loading.style.display = "none";

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    const pageItems = this.filteredComplaints.slice(start, end);

    // Update pagination UI
    if (this.paginationContainer) {
      this.paginationContainer.classList.remove("hidden");
      this.paginationContainer.style.display = this.filteredComplaints.length > 0 ? "flex" : "none";
    }

    if (this.pageInfo) {
      const totalPages = Math.ceil(this.filteredComplaints.length / this.itemsPerPage) || 1;
      this.pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
    }

    if (this.itemsInfo) {
      this.itemsInfo.textContent = `Showing ${pageItems.length} of ${this.filteredComplaints.length} complaints`;
    }

    if (this.prevBtn) this.prevBtn.disabled = this.currentPage === 1;
    if (this.nextBtn) this.nextBtn.disabled = this.currentPage >= Math.ceil(this.filteredComplaints.length / this.itemsPerPage);

    // Handle Empty State
    if (pageItems.length === 0) {
      this.container.style.display = "none"; // Hide grid
      if (this.emptyState) {
        this.emptyState.classList.remove("hidden");
        this.emptyState.style.display = "block";
      }
      return;
    }

    // Render Table
    if (this.emptyState) {
      this.emptyState.classList.add("hidden");
      this.emptyState.style.display = "none";
    }

    this.container.classList.remove("hidden");
    // this.container.style.display = "grid"; // Removed grid style

    this.container.innerHTML = pageItems.map(c => this.createRow(c)).join("");

    // Re-attach card events
    this.container.querySelectorAll(".btn-verify").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const id = e.currentTarget.getAttribute("data-id");
        this.deptModal.open(id);
      });
    });
  }

  createRow(c) {
    // No Title Usage
    const desc = c.description || c.descriptive_su || "No Description";
    const brgy = c.barangay || "Unknown Area";
    const category = c.category || "Uncategorized";
    const date = this.timeAgo(new Date(c.submitted_at || c.created_at));
    const priority = (c.priority || "low").toLowerCase();

    const badgeClass = {
      urgent: "bg-red-100 text-red-800",
      critical: "bg-red-100 text-red-800",
      high: "bg-orange-100 text-orange-800",
      medium: "bg-yellow-100 text-yellow-800",
      low: "bg-blue-100 text-blue-800"
    }[priority] || "bg-gray-100 text-gray-800";

    // Determine if AI suggestion exists
    const hasAi = c.ai_analysis && c.ai_analysis.suggested_department;
    const aiBadge = hasAi ?
      `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
          AI
       </span>` : "";

    return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass} uppercase">
                        ${priority}
                    </span>
                    ${aiBadge}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${this.escape(category)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${this.escape(brgy)}
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-900 line-clamp-2 max-w-md" title="${this.escape(desc)}">
                        ${this.escape(desc)}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${date}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div class="flex justify-end gap-2">
                         <a href="/coordinator/review/${c.id}" class="text-gray-400 hover:text-blue-600 transition-colors" title="View Details">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </a>
                        <button class="text-blue-600 hover:text-blue-900 btn-verify flex items-center gap-1" data-id="${c.id}" title="Assign">
                            Assign
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
  }

  escape(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + "m ago";
    return Math.floor(seconds) + "s ago";
  }
}

// Auto-start
document.addEventListener("DOMContentLoaded", () => {
  window.reviewQueue = new ReviewQueueController();
});
