import BarangayPrioritization from "../components/barangayPrioritization.js";

import slidingPanel from "../components/slidingPanel.js?v=20260301";

document.addEventListener("DOMContentLoaded", () => {
  loadReviewQueue(1);

  // Initialize Barangay Prioritization Widget
  const bpWidget = new BarangayPrioritization("barangay-prioritization-container");
  bpWidget.loadInsights();

  // Add size selector listener
  const limitSelect = document.getElementById("rows-per-page");
  if (limitSelect) {
    limitSelect.addEventListener("change", () => {
      loadReviewQueue(1); // Reset to page 1 on size change
    });
  }

  // Add date filter listener
  const startDateInput = document.getElementById("filter-start-date");
  const endDateInput = document.getElementById("filter-end-date");

  // Set default dates to today
  const today = new Date().toISOString().split("T")[0];
  if (startDateInput && !startDateInput.value) startDateInput.value = today;
  if (endDateInput && !endDateInput.value) endDateInput.value = today;

  if (startDateInput) {
    startDateInput.addEventListener("change", () => {
      loadReviewQueue(1);
    });
  }
  if (endDateInput) {
    endDateInput.addEventListener("change", () => {
      loadReviewQueue(1);
    });
  }

  // Auto-open sliding panel if open_complaint_id is in URL
  const urlParams = new URLSearchParams(window.location.search);
  const opencomplaintId = urlParams.get("open_complaint_id");
  if (opencomplaintId) {
    // slight delay to ensure the panel setup completes
    setTimeout(() => slidingPanel.open(opencomplaintId), 300);

    // Remove param from URL without reloading
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }
});

function escapeHtml(value) {
  const str = value == null ? "" : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Update loadReviewQueue to accept page param
async function loadReviewQueue(page = 1) {
  const tableBody = document.getElementById("complaint-list");
  const loading = document.getElementById("loading");
  const limitSelect = document.getElementById("rows-per-page");
  const startDateInput = document.getElementById("filter-start-date");
  const endDateInput = document.getElementById("filter-end-date");
  const limit = limitSelect ? limitSelect.value : 50;
  const startDate = startDateInput ? startDateInput.value : "";
  const endDate = endDateInput ? endDateInput.value : "";

  // Show partial loading state if needed
  if (loading && page === 1) loading.style.display = "block";

  // Update badge to "Loading..." while fetching
  const badge = document.getElementById("queue-count-badge");
  if (badge) badge.textContent = "Loading...";

  // Construct query parameters
  const params = new URLSearchParams({
    page,
    limit
  });

  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);

  try {
    const response = await fetch(`/api/coordinator/review-queue?${params.toString()}`);
    const data = await response.json();

    if (loading) loading.style.display = "none";

    // Update badge with actual count
    if (badge) badge.textContent = `${data.total || 0} Pending`;

    // [FIX] Handle new API response structure { complaints: [...], total: ... }
    // The API returns 'complaints' array directly, not wrapped in 'data'
    const complaints = data.complaints || data.data || [];

    if (complaints.length > 0) {
      tableBody.innerHTML = complaints.map(complaint => {
      const id = escapeHtml(complaint.id);

      const cat = escapeHtml(complaint.category || "General");
      const sub = complaint.subcategory ? escapeHtml(complaint.subcategory) : "";
      const categoryDisplay = sub ? `${cat} <span style="opacity:0.5">/</span> ${sub}` : cat;

      const priorityText = escapeHtml(complaint.priority || "");
      const locationText = escapeHtml(complaint.location_text || "N/A");

      const descRaw = complaint.description || "—";
      const descEscaped = escapeHtml(descRaw);
        return `
          <tr class="complaint-row cursor-pointer hover:bg-gray-50 from-gray-50 to-white transition-colors" data-id="${id}">
                    <td class="px-2 py-3 whitespace-nowrap">
                        <span class="px-2 py-0.5 inline-flex text-[10px] leading-4 font-bold uppercase tracking-wide rounded-full bg-${getPriorityColor(complaint.priority)}-100 text-${getPriorityColor(complaint.priority)}-800 border border-${getPriorityColor(complaint.priority)}-200">
                ${priorityText}
                        </span>
                    </td>
                    <td class="px-3 py-3 whitespace-nowrap text-xs font-medium text-gray-700">
                        ${categoryDisplay}
                    </td>
                    <td class="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
              ${locationText}
                    </td>
                    <td class="px-3 py-3 text-xs text-gray-600">
              <div class="truncate w-64" title="${descEscaped}">${descEscaped}</div>
                    </td>
                    <td class="px-3 py-3 whitespace-nowrap text-xs text-gray-400">
                        ${new Date(complaint.submitted_at || complaint.created_at).toLocaleDateString()}
                    </td>
                    <td class="px-3 py-3 whitespace-nowrap text-right">
              <button class="btn-review inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" data-id="${id}">
                            Review
                        </button>
                    </td>
                </tr>
            `;}).join("");

      // Attach event listeners to rows and buttons
      tableBody.querySelectorAll(".complaint-row").forEach(row => {
        row.addEventListener("click", (e) => {
          const id = row.getAttribute("data-id");
          slidingPanel.open(id);
        });
      });

      tableBody.querySelectorAll(".btn-review").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent row click
          const id = btn.getAttribute("data-id");
          slidingPanel.open(id);
        });
      });

      // [FIX] Render Pagination
      renderPagination(data.page || page, data.totalPages || 1, data.total || 0, complaints.length);
    } else {
      if (tableBody) tableBody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-sm text-gray-500 italic">No complaints pending review</td></tr>';
      document.getElementById("pagination-container").classList.add("hidden");
    }
  } catch (error) {
    console.error("Failed to load review queue:", error);
    if (loading) loading.textContent = "Error loading data";
    if (badge) badge.textContent = "Error";
  }
}

function renderPagination(page, totalPages, totalItems) {
  const paginationContainer = document.getElementById("pagination-container");
  const pageInfo = document.getElementById("page-info");
  const itemsInfo = document.getElementById("items-info");
  const prevBtn = document.getElementById("prev-page");
  const nextBtn = document.getElementById("next-page");

  if (!paginationContainer) return;

  // Show container
  paginationContainer.classList.remove("hidden");

  // Update Text
  pageInfo.textContent = `Page ${page} of ${totalPages}`;
  itemsInfo.textContent = `Total: ${totalItems} complaints`;

  // Handle Buttons
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;

  // Replace buttons to clear event listeners
  const newPrev = prevBtn.cloneNode(true);
  const newNext = nextBtn.cloneNode(true);
  prevBtn.parentNode.replaceChild(newPrev, prevBtn);
  nextBtn.parentNode.replaceChild(newNext, nextBtn);

  newPrev.addEventListener("click", () => {
    if (page > 1) loadReviewQueue(page - 1);
  });
  newNext.addEventListener("click", () => {
    if (page < totalPages) loadReviewQueue(page + 1);
  });
}

function getPriorityColor(priority) {
  switch (priority?.toLowerCase()) {
    case "urgent": return "red";
    case "high": return "orange";
    case "medium": return "blue";
    default: return "gray";
  }
}
