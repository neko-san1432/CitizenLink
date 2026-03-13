/**
 * Super Admin Dashboard
 * System-wide management interface
 */
import showMessage from "../components/toast.js";

// Initialize dashboard
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadDashboardData();
    await loadRoleCounts();
    await loadApiHealth();
    await loadLogs();

    // Load Content Feeds
    await Promise.all([
      loadNotices(),
      loadNews(),
      loadEvents()
    ]);

    // Charts are initialized after data is fetched
    await loadGrowthTrends();
  } catch (error) {
    console.error("Dashboard initialization error:", error);
  } finally {
    // Reveal the dashboard only when everything is ready
    hideDashboardLoader();
  }

  // Auto refresh
  setInterval(() => {
    loadDashboardData();
    loadRoleCounts();
    loadApiHealth();
    loadLogs();
    loadNotices();
    loadNews();
    loadEvents();
  }, 30000);
});

function hideDashboardLoader() {
  const loader = document.getElementById("dashboard-loading");
  const content = document.getElementById("dashboard-main-content");

  if (loader) {
    loader.style.setProperty("display", "none", "important");
  }

  if (content) {
    content.style.setProperty("display", "block", "important");
    setTimeout(() => {
      content.style.opacity = "1";
    }, 50);
  }
}

const charts = {
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
            type: "complaint",
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

// --- CONTENT FETCHING --- //

async function loadNotices() {
  const container = document.getElementById("urgent-notices-feed");
  if (!container) return;

  try {
    const response = await fetch("/api/content/notices?limit=5&status=active");
    const result = await response.json();

    if (result.success && result.data && result.data.length > 0) {
      container.innerHTML = result.data.map(notice => {
        const priorityColor = notice.priority === "urgent" || notice.priority === "high" ? "text-red-700 font-bold" : "text-gray-800 font-semibold";
        const dateStr = new Date(notice.valid_from).toLocaleDateString([], { month: "short", day: "numeric" });

        return `
          <div class="p-3 bg-white rounded-lg border border-red-100 shadow-sm hover:shadow-md transition">
            <div class="flex justify-between items-start mb-1">
              <h4 class="text-sm ${priorityColor}">${notice.title}</h4>
              <span class="text-xs text-red-500 whitespace-nowrap ml-2">${dateStr}</span>
            </div>
            <p class="text-xs text-gray-600 line-clamp-2">${notice.content}</p>
          </div>
        `;
      }).join("");
    } else {
      container.innerHTML = `<div class="text-center py-4 text-gray-500 text-sm">No active notices</div>`;
    }
  } catch (error) {
    console.error("Failed to load notices:", error);
    container.innerHTML = `<div class="text-center py-4 text-red-400 text-sm">Failed to load</div>`;
  }
}

async function loadNews() {
  const container = document.getElementById("news-feed");
  if (!container) return;

  try {
    const response = await fetch("/api/content/news?limit=5&status=published");
    const result = await response.json();

    if (result.success && result.data && result.data.length > 0) {
      container.innerHTML = result.data.map(item => {
        const dateStr = new Date(item.published_at).toLocaleDateString([], { month: "short", day: "numeric" });
        const categoryTag = item.category ? `<span class="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium mb-1">${item.category}</span>` : "";

        return `
          <div class="p-3 bg-white rounded-lg border border-blue-100 shadow-sm hover:shadow-md transition">
            ${categoryTag}
            <div class="flex justify-between items-start mb-1">
              <h4 class="text-sm font-semibold text-gray-800">${item.title}</h4>
              <span class="text-xs text-blue-500 whitespace-nowrap ml-2">${dateStr}</span>
            </div>
            <p class="text-xs text-gray-600 line-clamp-2">${item.excerpt || item.content}</p>
          </div>
        `;
      }).join("");
    } else {
      container.innerHTML = `<div class="text-center py-4 text-gray-500 text-sm">No recent news</div>`;
    }
  } catch (error) {
    console.error("Failed to load news:", error);
    container.innerHTML = `<div class="text-center py-4 text-red-400 text-sm">Failed to load</div>`;
  }
}

async function loadEvents() {
  const container = document.getElementById("events-feed");
  if (!container) return;

  try {
    const response = await fetch("/api/content/events?limit=5&status=upcoming");
    const result = await response.json();

    if (result.success && result.data && result.data.length > 0) {
      container.innerHTML = result.data.map(event => {
        const dateStr = new Date(event.event_date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });

        return `
          <div class="p-3 bg-white rounded-lg border border-emerald-100 shadow-sm hover:shadow-md transition">
            <div class="flex items-center gap-3">
              <div class="flex flex-col items-center justify-center pt-1 pb-1 px-2 bg-emerald-50 rounded text-emerald-700 min-w-[32px] flex-shrink-0 border border-emerald-100">
                <span class="text-[9px] font-bold leading-none mb-0.5">${new Date(event.event_date).toLocaleDateString([], { month: "short" }).toUpperCase()}</span>
                <span class="text-sm font-black leading-none">${new Date(event.event_date).getDate()}</span>
              </div>
              <div class="flex-1">
                <h4 class="text-sm font-semibold text-gray-800 leading-tight mb-1">${event.title}</h4>
                <div class="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <svg xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px; min-width: 14px;" class="flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span class="line-clamp-1">${event.location || "TBA"}</span>
                </div>
              </div>
            </div>
            <p class="text-xs text-gray-600 mt-2 line-clamp-1">${event.description}</p>
          </div>
        `;
      }).join("");
    } else {
      container.innerHTML = `<div class="text-center py-4 text-gray-500 text-sm">No upcoming events</div>`;
    }
  } catch (error) {
    console.error("Failed to load events:", error);
    container.innerHTML = `<div class="text-center py-4 text-red-400 text-sm">Failed to load</div>`;
  }
}

