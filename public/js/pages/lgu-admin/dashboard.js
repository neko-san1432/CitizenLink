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
    // 1. Trend Chart
    const trendCtx = document.getElementById("trendChart")?.getContext("2d");
    if (trendCtx) {
      if (this.charts.trend) this.charts.trend.destroy();

      const labels = Object.keys(chartsData.trend || {}).sort();
      const data = labels.map((date) => chartsData.trend[date] || 0);

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

    // 2. Distribution Chart
    const distCtx = document
      .getElementById("distributionChart")
      ?.getContext("2d");
    if (distCtx) {
      if (this.charts.distribution) this.charts.distribution.destroy();

      this.charts.distribution = new Chart(distCtx, {
        type: "doughnut",
        data: {
          labels: ["Urgent", "High", "Medium", "Low"],
          datasets: [
            {
              data: [
                stats.priority?.urgent || 0,
                stats.priority?.high || 0,
                stats.priority?.medium || 0,
                stats.priority?.low || 0,
              ],
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
      .map(
        (item) => `
          <div class="complaint-item flex justify-between items-start p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-100 cursor-pointer" 
               data-id="${item.id}">
              <div>
                  <h4 class="font-medium text-gray-900">${this.escapeHtml(
    item.title || "Untitled"
  )}</h4>
                  <p class="text-sm text-gray-500 mt-1">${
  item.location_text || "No location"
}</p>
              </div>
              <div class="text-right">
                   <span class="inline-block px-2 py-1 text-xs font-semibold rounded ${this.getPriorityBadgeClass(
    item.priority
  )}">
                      ${item.priority}
                  </span>
                  <p class="text-xs text-gray-400 mt-2">${new Date(
    item.submitted_at
  ).toLocaleDateString()}</p>
              </div>
          </div>
      `
      )
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
