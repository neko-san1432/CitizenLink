import apiClient from "../../config/apiClient.js";
import showMessage from "../../components/toast.js";

class LguAdminDashboard {
  constructor() {
    this.charts = {
      trend: null,
      distribution: null,
    };
  }

  async init() {
    try {
      this.setupEventListeners();
      await this.loadDashboardData();
    } catch (error) {
      console.error("[LGU_ADMIN_DASHBOARD] Init error:", error);
      showMessage("error", "Failed to load dashboard data");
    }
  }

  setupEventListeners() {
    // Quick Actions
    const btnAssignments = document.getElementById("btn-quick-assignments");
    if (btnAssignments) {
      btnAssignments.addEventListener("click", () => {
        window.location.href = "/lgu-admin/assignments";
      });
    }

    const btnHeatmap = document.getElementById("btn-quick-heatmap");
    if (btnHeatmap) {
      btnHeatmap.addEventListener("click", () => {
        window.location.href = "/lgu-admin/heatmap";
      });
    }

    // List Item Delegation
    const listContainer = document.getElementById("recent-unassigned-list");
    if (listContainer) {
      listContainer.addEventListener("click", (e) => {
        const item = e.target.closest(".complaint-item");
        if (item && item.dataset.id) {
          window.location.href = `/complaint-details/${item.dataset.id}`;
        }
      });
    }
  }

  async loadDashboardData() {
    try {
      const response = await apiClient.get("/api/lgu-admin/dashboard-stats");
      if (response && response.success) {
        this.renderStats(response.stats);
        this.renderCharts(response.stats, response.charts);
        this.renderLists(response.lists);
      } else {
        throw new Error(response?.error || "Failed to fetch stats");
      }
    } catch (error) {
      console.error("Dashboard load error:", error);
      showMessage("error", "Error loading dashboard metrics");
    }
  }

  renderStats(stats) {
    if (!stats) return;
    document.getElementById("stat-total-active").textContent =
      stats.total_active || 0;
    document.getElementById("stat-unassigned").textContent =
      stats.unassigned || 0;
    document.getElementById("stat-urgent").textContent =
      stats.priority?.urgent || 0;
    document.getElementById("stat-high").textContent =
      stats.priority?.high || 0;
  }

  renderCharts(stats, chartsData) {
    // Helper to check if data is empty
    const isAllZeros = (arr) => arr.every((v) => v === 0);

    // 1. Trend Chart
    const trendContainer = document.getElementById("trendChart")?.parentElement;
    const trendCtx = document.getElementById("trendChart")?.getContext("2d");

    if (trendCtx && trendContainer) {
      if (this.charts.trend) this.charts.trend.destroy();

      const labels = Object.keys(chartsData.trend || {}).sort();
      const data = labels.map((date) => chartsData.trend[date] || 0);

      if (labels.length === 0 || isAllZeros(data)) {
        this.showNoData(trendContainer, "No trend data available");
      } else {
        this.removeNoData(trendContainer);
        this.charts.trend = new Chart(trendCtx, {
          type: "line",
          data: {
            labels: labels.map((d) => new Date(d).toLocaleDateString()),
            datasets: [
              {
                label: "New Complaints",
                data,
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                borderWidth: 2,
                fill: true,
                tension: 0.4,
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
              y: { beginAtZero: true, ticks: { precision: 0 } },
            },
          },
        });
      }
    }

    // 2. Distribution Chart
    const distContainer =
      document.getElementById("distributionChart")?.parentElement;
    const distCtx = document
      .getElementById("distributionChart")
      ?.getContext("2d");

    if (distCtx && distContainer) {
      if (this.charts.distribution) this.charts.distribution.destroy();

      const priorityData = [
        stats.priority?.urgent || 0,
        stats.priority?.high || 0,
        stats.priority?.medium || 0,
        stats.priority?.low || 0,
      ];

      if (isAllZeros(priorityData)) {
        this.showNoData(distContainer, "No data available");
      } else {
        this.removeNoData(distContainer);
        this.charts.distribution = new Chart(distCtx, {
          type: "doughnut",
          data: {
            labels: ["Urgent", "High", "Medium", "Low"],
            datasets: [
              {
                data: priorityData,
                backgroundColor: [
                  "#ea580c", // Orange (Urgent)
                  "#ca8a04", // Yellow (High)
                  "#3b82f6", // Blue (Medium)
                  "#6b7280", // Gray (Low)
                ],
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "bottom" },
            },
          },
        });
      }
    }
  }

  showNoData(container, message) {
    // Remove existing overlay
    this.removeNoData(container);

    const overlay = document.createElement("div");
    overlay.className = "no-data-overlay";

    // Use explicit styles to guarantee centering regardless of Tailwind availability
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(2px);
        z-index: 10;
        border-radius: 0.5rem;
    `;

    overlay.innerHTML = `
        <div class="text-center p-4">
            <svg class="w-8 h-8 mx-auto text-gray-400 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin: 0 auto;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p class="text-gray-500 dark:text-gray-400 font-medium text-sm">${message}</p>
        </div>
    `;

    container.appendChild(overlay);
  }

  removeNoData(container) {
    const overlay = container.querySelector(".no-data-overlay");
    if (overlay) overlay.remove();
  }

  renderLists(lists) {
    const container = document.getElementById("recent-unassigned-list");
    if (!container) return;

    if (!lists.recent_unassigned || lists.recent_unassigned.length === 0) {
      container.innerHTML = `
              <div class="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                  <p>No recent unassigned complaints</p>
              </div>
          `;
      return;
    }

    container.innerHTML = lists.recent_unassigned
      .map((item) => {
        const title = this.escapeHtml(item.title || "Untitled");
        const location = item.location_text || "No location";
        const priorityClass = this.getPriorityBadgeClass(item.priority);
        const date = new Date(item.submitted_at).toLocaleDateString();
        return `
        <div class="complaint-item flex justify-between items-start p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100 cursor-pointer" data-id="${item.id}">
          <div>
            <h4 class="font-medium text-gray-900">${title}</h4>
            <p class="text-sm text-gray-500 mt-1">${location}</p>
          </div>
          <div class="text-right">
            <span class="inline-block px-2 py-1 text-xs font-semibold rounded ${priorityClass}">
              ${item.priority}
            </span>
            <p class="text-xs text-gray-400 mt-2">${date}</p>
          </div>
        </div>`;
      })
      .join("");
  }

  getPriorityBadgeClass(priority) {
    switch ((priority || "").toLowerCase()) {
      case "urgent":
        return "bg-orange-100 text-orange-800";
      case "high":
        return "bg-yellow-100 text-yellow-800";
      case "medium":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

const dashboard = new LguAdminDashboard();
document.addEventListener("DOMContentLoaded", () => dashboard.init());
