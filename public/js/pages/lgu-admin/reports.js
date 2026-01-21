import { getUserRole } from "../../auth/authChecker.js";
import showMessage from "../../components/toast.js";

let categoryChart, statusChart, trendChart;

document.addEventListener("DOMContentLoaded", async () => {
  // Auth Check
  const role = await getUserRole();
  if (!["lgu-admin", "super-admin", "complaint-coordinator"].includes(role)) {
    window.location.href = "/login";
    return;
  }

  if (role === "super-admin") {
    const deptContainer = document.getElementById("filter-dept-container");
    if (deptContainer) {
      deptContainer.style.display = "flex";
      loadDepartments();
    }
  }

  // Initialize UI
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const dateFrom = document.getElementById("filter-date-from");
  const dateTo = document.getElementById("filter-date-to");

  if (dateFrom) dateFrom.value = thirtyDaysAgo.toISOString().split("T")[0];
  if (dateTo) dateTo.value = today.toISOString().split("T")[0];

  const generateBtn = document.getElementById("btn-generate");
  if (generateBtn) generateBtn.addEventListener("click", fetchAndRenderData);

  const printBtn = document.getElementById("btn-print");
  if (printBtn) printBtn.addEventListener("click", () => window.print());

  // Initial Load
  fetchAndRenderData();
});

async function loadDepartments() {
  try {
    const res = await fetch("/api/departments/active");
    if (res.ok) {
      const json = await res.json();
      const select = document.getElementById("filter-department");
      if (select && json.data) {
        json.data.forEach((dept) => {
          const opt = document.createElement("option");
          opt.value = dept.code || dept.id;
          opt.textContent = dept.name;
          select.appendChild(opt);
        });
      }
    }
  } catch (e) {
    console.warn("Failed to load departments", e);
  }
}

async function fetchAndRenderData() {
  const fromEl = document.getElementById("filter-date-from");
  const toEl = document.getElementById("filter-date-to");
  const deptEl = document.getElementById("filter-department");

  const from = fromEl ? fromEl.value : "";
  const to = toEl ? toEl.value : "";
  const dept = deptEl ? deptEl.value : "";

  const btn = document.getElementById("btn-generate");
  let originalText = "Generate";
  if (btn) {
    originalText = btn.textContent;
    btn.textContent = "Loading...";
    btn.disabled = true;
  }

  try {
    const query = new URLSearchParams({
      date_from: from,
      date_to: to,
      department: dept,
    });

    const res = await fetch(`/api/complaints/stats?${query.toString()}`);
    const json = await res.json();

    if (!json.success) throw new Error(json.error || "Failed to load stats");

    renderSummaries(json.data);
    renderCharts(json.data);
    showMessage("success", "Report generated successfully");
  } catch (err) {
    console.error(err);
    showMessage("error", "Failed to load report data");
  } finally {
    if (btn) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }
}

function renderSummaries(data) {
  const container = document.getElementById("summary-cards");
  if (!container) return;

  const total = data.total || 0;

  // Calculate resolved/pending based on status counts
  let resolvedCount = 0;
  let pendingCount = 0;

  if (data.by_status) {
    Object.entries(data.by_status).forEach(([status, count]) => {
      const s = status.toLowerCase();
      if (["completed", "resolved", "closed"].includes(s))
        resolvedCount += count;
      else if (
        [
          "new",
          "assigned",
          "in_progress",
          "pending",
          "pending_approval",
          "investigating",
        ].includes(s)
      )
        pendingCount += count;
    });
  }

  container.innerHTML = `
        <div class="stat-card bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <p class="text-sm text-gray-500 font-medium">Total Complaints</p>
            <h3 class="text-2xl font-bold text-gray-800">${total}</h3>
        </div>
        <div class="stat-card bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <p class="text-sm text-gray-500 font-medium">Pending/Active</p>
            <h3 class="text-2xl font-bold text-orange-600">${pendingCount}</h3>
        </div>
        <div class="stat-card bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <p class="text-sm text-gray-500 font-medium">Resolved</p>
            <h3 class="text-2xl font-bold text-green-600">${resolvedCount}</h3>
        </div>
        <div class="stat-card bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <p class="text-sm text-gray-500 font-medium">Filtered Range</p>
            <h3 class="text-sm font-bold text-gray-600 mt-2">${
              document.getElementById("filter-date-from")?.value || "—"
            } <br>to ${
    document.getElementById("filter-date-to")?.value || "—"
  }</h3>
        </div>
    `;
}

function renderCharts(data) {
  // 1. Category Chart
  const categoryCanvas = document.getElementById("chart-category");
  if (categoryCanvas) {
    const categoryCtx = categoryCanvas.getContext("2d");
    if (categoryChart) categoryChart.destroy();

    // Use by_category if available, else fallback to by_subtype
    const catSource =
      data.by_category && Object.keys(data.by_category).length > 0
        ? data.by_category
        : data.by_subtype || {};

    const catLabels = Object.keys(catSource);
    const catData = Object.values(catSource);

    categoryChart = new Chart(categoryCtx, {
      type: "bar",
      data: {
        labels: catLabels,
        datasets: [
          {
            label: "Complaints",
            data: catData,
            backgroundColor: "#3b82f6",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  // 2. Status Chart
  const statusCanvas = document.getElementById("chart-status");
  if (statusCanvas) {
    const statusCtx = statusCanvas.getContext("2d");
    if (statusChart) statusChart.destroy();

    const statusLabels = Object.keys(data.by_status || {}).map((s) =>
      s.replace(/_/g, " ").toUpperCase()
    );
    const statusData = Object.values(data.by_status || {});

    statusChart = new Chart(statusCtx, {
      type: "doughnut",
      data: {
        labels: statusLabels,
        datasets: [
          {
            data: statusData,
            backgroundColor: [
              "#60a5fa",
              "#34d399",
              "#f87171",
              "#fbbf24",
              "#a78bfa",
              "#9ca3af",
            ],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right" },
        },
        cutout: "60%",
      },
    });
  }

  // 3. Trend Chart
  const trendCanvas = document.getElementById("chart-trend");
  if (trendCanvas) {
    const trendCtx = trendCanvas.getContext("2d");
    if (trendChart) trendChart.destroy();

    const monthLabels = Object.keys(data.by_month || {}).sort();
    const monthData = monthLabels.map((m) => data.by_month[m]);

    trendChart = new Chart(trendCtx, {
      type: "line",
      data: {
        labels: monthLabels,
        datasets: [
          {
            label: "Submissions",
            data: monthData,
            borderColor: "#10b981",
            tension: 0.3,
            fill: true,
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            pointBackgroundColor: "#fff",
            pointBorderColor: "#10b981",
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true, grid: { borderDash: [2, 2] } },
          x: { grid: { display: false } },
        },
      },
    });
  }
}
