/**
 * Review Queue Intelligence - Premium Variant
 * Handles filtering, pagination, and high-fidelity rendering for LGU Reviewers.
 */
import BarangayPrioritization from "../components/barangayPrioritization.js";
import slidingPanel from "../components/slidingPanel.js?v=20260301";

document.addEventListener("DOMContentLoaded", () => {
  initFilters();
  loadReviewQueue(1);

  // Initialize Barangay Prioritization Widget
  const bpWidget = new BarangayPrioritization("barangay-prioritization-container");
  bpWidget.loadInsights();

  // Initialize Perspective Switcher
  const tabs = document.querySelectorAll(".perspective-btn");
  const queueView = document.querySelector(".rq-panel.panel"); // The table panel
  const insightsView = document.getElementById("insights-view");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const target = tab.dataset.tab;
      if (target === "queue") {
        queueView.style.display = "block";
        insightsView.style.display = "none";
      } else {
        queueView.style.display = "none";
        insightsView.style.display = "block";
        bpWidget.loadInsights();
      }
    });
  });
});

function initFilters() {
  const filters = [
    "search-input", "filter-start-date", "filter-end-date",
    "filter-priority", "filter-type", "filter-barangay", "filter-similar", "filter-prioritization",
    "rows-per-page"
  ];

  loadCategories();
  loadBarangays();

  filters.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    // Debounce search input
    if (id === "search-input") {
      let timeout;
      el.addEventListener("input", () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => loadReviewQueue(1), 400);
      });
    } else {
      el.addEventListener("change", () => loadReviewQueue(1));
    }
  });

  const sDate = document.getElementById("filter-start-date");
  const eDate = document.getElementById("filter-end-date");
  // Removed default date assignments to show all historical data by default
}

function escapeHtml(v) {
  const s = v == null ? "" : String(v);
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

async function loadReviewQueue(page = 1) {
  const tableBody = document.getElementById("complaint-list");
  const loading = document.getElementById("loading");
  const tableContainer = document.getElementById("queue-table-container");
  const emptyState = document.getElementById("empty-state");
  const badge = document.getElementById("queue-count-badge");

  // Gather Filters
  const query = {
    page,
    limit: document.getElementById("rows-per-page")?.value || 50,
    search: document.getElementById("search-input")?.value || "",
    startDate: document.getElementById("filter-start-date")?.value || "",
    endDate: document.getElementById("filter-end-date")?.value || "",
    priority: document.getElementById("filter-priority")?.value || "",
    category: document.getElementById("filter-type")?.value || "",
    barangay: document.getElementById("filter-barangay")?.value || "",
    sort: document.getElementById("filter-prioritization")?.value || "desc"
  };

  if (badge) badge.textContent = "Updating...";
  if (page === 1) {
    if (loading) loading.style.display = "block";
    if (tableContainer) tableContainer.style.display = "none";
    if (emptyState) emptyState.classList.add("hidden");
  }

  const params = new URLSearchParams(query);

  try {
    const response = await fetch(`/api/coordinator/review-queue?${params.toString()}`);
    const data = await response.json();

    if (loading) loading.style.display = "none";
    if (badge) badge.textContent = `${data.total || 0} Pending`;

    const complaints = data.complaints || data.data || [];

    if (complaints.length > 0) {
      if (tableContainer) tableContainer.style.display = "block";
      tableBody.innerHTML = complaints.map(c => renderRow(c)).join("");

      // Attach row click listeners
      tableBody.querySelectorAll(".complaint-tr").forEach(tr => {
        tr.addEventListener("click", () => slidingPanel.open(tr.dataset.id));
      });

      renderPagination(data.page || page, data.totalPages || 1, data.total || 0);
    } else {
      if (emptyState) emptyState.classList.remove("hidden");
      if (tableContainer) tableContainer.style.display = "none";
      document.getElementById("pagination-container")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("Queue Load Error:", err);
    if (loading) loading.textContent = "Connection Intelligence Error";
  }
}

function renderRow(c) {
  const id = escapeHtml(c.id);
  const p = (c.priority || "low").toLowerCase();
  const cat = escapeHtml(c.category || "General");
  const sub = c.subcategory ? escapeHtml(c.subcategory) : "";
  const loc = escapeHtml(c.location_text || "Digos City, Davao del Sur");
  const desc = escapeHtml(c.description || "—");
  const date = new Date(c.submitted_at || c.created_at).toLocaleDateString();

  return `
        <tr class="complaint-tr cursor-pointer" data-id="${id}">
            <td title="Priority: ${p}">
                <span class="priority-pill priority-pill-${p}">${p}</span>
            </td>
            <td title="Category: ${cat}${sub ? ` / ${  sub}` : ""}">
                <div class="cell-content">
                  <span class="category-main" style="color: var(--rq-text-primary); font-weight: 600;">${cat}</span>
                  ${sub ? `<span class="category-sub" style="font-size: 0.9em; opacity: 0.7;"> / ${sub}</span>` : ""}
                </div>
            </td>
            <td title="Location: ${loc}">
                <div class="cell-content" style="color: var(--rq-text-secondary);">${loc}</div>
            </td>
            <td title="Description: ${desc}">
                <div class="cell-content" style="color: var(--rq-text-muted); opacity: 0.9;">${desc}</div>
            </td>
            <td title="Submitted: ${date}">
                <div class="cell-content" style="color: var(--rq-text-muted); font-size: 0.9em;">${date}</div>
            </td>
            <td style="text-align: right;">
                <button class="btn-review-premium">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/></svg>
                    Review
                </button>
            </td>
        </tr>
    `;
}

function renderPagination(page, totalPages, totalItems) {
  const container = document.getElementById("pagination-container");
  const pageInfo = document.getElementById("page-info");
  const itemsInfo = document.getElementById("items-info");
  const prevBtn = document.getElementById("prev-page");
  const nextBtn = document.getElementById("next-page");

  if (!container) return;
  container.classList.remove("hidden");

  const startRange = ((page - 1) * 50) + 1; // Assuming 50 per page default, will improve to use actual limit
  const currentLimit = parseInt(document.getElementById("rows-per-page")?.value || 50);
  const sRange = ((page - 1) * currentLimit) + 1;
  const eRange = Math.min(page * currentLimit, totalItems);

  if (pageInfo) pageInfo.textContent = `Showing ${sRange}-${eRange}`;
  if (itemsInfo) itemsInfo.textContent = `of ${totalItems} complaints`;

  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;

  // Refresh listeners
  const nPrev = prevBtn.cloneNode(true);
  const nNext = nextBtn.cloneNode(true);
  prevBtn.parentNode.replaceChild(nPrev, prevBtn);
  nextBtn.parentNode.replaceChild(nNext, nextBtn);

  nPrev.addEventListener("click", () => loadReviewQueue(page - 1));
  nNext.addEventListener("click", () => loadReviewQueue(page + 1));

  // Render numerical page buttons
  const pageNumbers = document.getElementById("page-numbers");
  if (pageNumbers) {
    pageNumbers.innerHTML = "";

    // Simple logic: show all if few, or a window if many
    // For 288 items at 50/page, that's 6 pages — we can show all.
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement("div");
      btn.className = `page-num ${i === page ? "active" : ""}`;
      btn.textContent = i;
      btn.addEventListener("click", () => loadReviewQueue(i));
      pageNumbers.appendChild(btn);
    }
  }
}

async function loadCategories() {
  try {
    const response = await fetch("/api/department-structure/categories");
    const json = await response.json();
    const data = json.data || json;
    const select = document.getElementById("filter-type");
    if (!select || !data) return;

    data.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Load Categories Error:", err);
  }
}

async function loadBarangays() {
  try {
    const response = await fetch("/api/public/boundaries");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const boundaries = await response.json();
    const select = document.getElementById("filter-barangay");
    if (!select || !boundaries || !Array.isArray(boundaries)) return;

    const names = boundaries.map(b => b.name).filter(Boolean).sort();
    names.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Load Barangays Error:", err);
  }
}
