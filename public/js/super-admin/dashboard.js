/**
 * Super Admin Dashboard
 * System-wide management interface
 */
import showMessage from "../components/toast.js";

// Initialize dashboard
document.addEventListener("DOMContentLoaded", async () => {
  await loadDashboardData();
  await loadRoleCounts();
  await loadApiHealth();
  await loadLogs();

  // Charts are initialized after data is fetched
  await loadGrowthTrends();

  // Auto refresh
  setInterval(() => {
    loadDashboardData();
    loadRoleCounts();
    loadApiHealth();
    loadLogs();
  }, 30000);
});

let charts = {
  trend: null,
  distribution: null,
};

/**
 * Load dashboard stats
 */
async function loadDashboardData() {
  try {
    const statsResponse = await fetch("/api/superadmin/statistics");
    const statsResult = await statsResponse.json();

    if (statsResult.success) {
      updateStatistics(statsResult.statistics);
    }
  } catch (error) {
    console.error("[SUPERADMIN] Load dashboard error:", error);
  }
}

function updateStatistics(stats) {
  // Map data to new IDs
  setText("stat-total-reports", stats.total_complaints || 0);

  // Active LGUs - might need to fetch if not in statistics object
  // For now use a simplified metric or mock
  if (stats.active_lgus !== undefined) {
    setText("stat-active-lgus", stats.active_lgus);
  } else {
    // If API doesn't return it, we can fetch from department API or leave as '-'
    // Attempt to calculate from total departments if available
    setText("stat-active-lgus", stats.total_departments || "-");
  }
}

async function loadRoleCounts() {
  try {
    const res = await fetch("/api/superadmin/role-distribution");
    const result = await res.json();

    if (result.success && result.distribution) {
      // Calculate total users from distribution
      const total = Object.values(result.distribution).reduce(
        (a, b) => a + b,
        0
      );
      setText("stat-total-users", total);

      // Update distribution chart if it exists
      updateDistributionChart(result.distribution);
    }
  } catch (error) {
    console.error("[SUPERADMIN] Load users error:", error);
  }
}

async function loadGrowthTrends() {
  try {
    const res = await fetch("/api/superadmin/growth-trends");
    const result = await res.json();

    if (result.success && result.trends) {
      initTrendChart(result.trends);
    }
  } catch (error) {
    console.error("[SUPERADMIN] Load growth trends error:", error);
  }
}

async function loadApiHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    const el = document.getElementById("stat-health");
    if (el) {
      if (data && data.success) {
        el.textContent = "Good"; // Healthy
        el.className = "text-2xl font-bold text-green-600";
        el.parentElement.nextElementSibling.className =
          "p-3 bg-green-50 text-green-600 rounded-lg";
      } else {
        el.textContent = "Issues";
        el.className = "text-2xl font-bold text-red-600";
        el.parentElement.nextElementSibling.className =
          "p-3 bg-red-50 text-red-600 rounded-lg";
      }
    }
  } catch (e) {
    const el = document.getElementById("stat-health");
    if (el) {
      el.textContent = "Offline";
      el.className = "text-2xl font-bold text-gray-600";
    }
  }
}

async function loadLogs() {
  try {
    const response = await fetch("/api/superadmin/logs?limit=5");
    const result = await response.json();
    const container = document.getElementById("recent-activity-list");

    if (container && result.success && result.logs) {
      const logs = [];
      // Flatten logs structure if needed (depends on API struct)
      if (result.logs.role_changes)
        logs.push(
          ...result.logs.role_changes.map((l) => ({
            ...l,
            type: "Role Change",
          }))
        );
      if (result.logs.department_transfers)
        logs.push(
          ...result.logs.department_transfers.map((l) => ({
            ...l,
            type: "Transfer",
          }))
        );
      if (result.logs.complaint_workflow)
        logs.push(
          ...result.logs.complaint_workflow.map((l) => ({
            ...l,
            type: "Complaint",
          }))
        );

      logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      if (logs.length > 0) {
        container.innerHTML = logs
          .slice(0, 5)
          .map(
            (log) => `
          <div class="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
             <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-800">${log.type}</p>
              <p class="text-xs text-gray-500">${new Date(
                log.created_at
              ).toLocaleString()}</p>
            </div>
          </div>
        `
          )
          .join("");
      } else {
        container.innerHTML = `<div class="text-center py-4 text-gray-500">No logs found</div>`;
      }
    }
  } catch (error) {
    console.error("[SUPERADMIN] logs error", error);
  }
}

function initTrendChart(trends) {
  const trendCtx = document.getElementById("trendChart");
  if (!trendCtx) return;

  if (charts.trend) {
    charts.trend.destroy();
  }

  charts.trend = new Chart(trendCtx, {
    type: "line",
    data: {
      labels: trends.labels,
      datasets: [
        {
          label: "New Reports",
          data: trends.datasets.complaints,
          borderColor: "#3b82f6",
          tension: 0.4,
          fill: true,
          backgroundColor: "rgba(59, 130, 246, 0.1)",
        },
        {
          label: "New Users",
          data: trends.datasets.users,
          borderColor: "#10b981",
          tension: 0.4,
          fill: false,
          borderDash: [5, 5],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: { display: true, position: "top" },
        tooltip: {
          mode: "index",
          intersect: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { display: true, color: "rgba(0,0,0,0.05)" },
          ticks: { precision: 0 },
        },
        x: { grid: { display: false } },
      },
    },
  });
}

function updateDistributionChart(distribution) {
  const distCtx = document.getElementById("distributionChart");
  if (!distCtx) return;

  if (charts.distribution) {
    charts.distribution.destroy();
  }

  charts.distribution = new Chart(distCtx, {
    type: "doughnut",
    data: {
      labels: ["Citizens", "Officers", "Admins", "HR"],
      datasets: [
        {
          data: [
            distribution.citizens || 0,
            distribution.officers || 0,
            distribution.admins || 0,
            distribution.hr || 0,
          ],
          backgroundColor: ["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "right" },
      },
    },
  });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
