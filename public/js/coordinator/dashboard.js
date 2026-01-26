/**
 * Coordinator Dashboard JavaScript
 * Handles API calls and dashboard functionality
 */
class CoordinatorDashboard {
  constructor() {
    this.statsInterval = null;
    this.queueInterval = null;
    this.activityInterval = null;
    this.trendChart = null;
    this.distributionChart = null;
    this.lastDashboardData = null;
    this.init();
  }

  async init() {
    try {
      await this.checkCoordinatorStatus();
      await this.loadDashboardData();
      this.initCharts();
      this.setupEventListeners();
      this.startAutoRefresh();
    } catch (error) {
      console.error("[COORDINATOR] Init error:", error);
      this.setDefaultStats();
    }
  }

  async checkCoordinatorStatus() {
    try {
      const response = await fetch("/api/coordinator/status");
      if (!response.ok) throw new Error("Not authenticated");
    } catch (error) {
      console.warn("Coordinator status check failed");
    }
  }

  async loadDashboardData() {
    try {
      await this.loadStats();
      await this.loadActivity();
    } catch (error) {
      console.error("[COORDINATOR] Load data error:", error);
      this.setDefaultStats();
    }
  }

  async loadStats() {
    try {
      const response = await fetch("/api/coordinator/dashboard");
      if (!response.ok) throw new Error("Failed to fetch stats");

      const result = await response.json();
      if (result.success) {
        const { data } = result;
        this.lastDashboardData = data;

        // Map API data to new HTML IDs
        // Incoming Reports -> Pending Reviews
        this.updateStatCard("stat-incoming", data.pending_reviews || 0);

        // Unverified -> Duplicate/Pending mix or just 0 for now if no specific metric
        // For now using pending reviews as proxy or 0
        this.updateStatCard("stat-unverified", data.pending_reviews || 0);

        // Assigned -> Assignments made
        this.updateStatCard("stat-assigned", data.stats?.assignments_made || 0);

        // Escalated -> No direct metric, using 0 or mock
        this.updateStatCard("stat-escalated", 0);

        // Update charts if they exist
        this.updateCharts(data);
      } else {
        this.setDefaultStats();
      }
    } catch (error) {
      this.setDefaultStats();
    }
  }

  setDefaultStats() {
    this.updateStatCard("stat-incoming", 0);
    this.updateStatCard("stat-unverified", 0);
    this.updateStatCard("stat-assigned", 0);
    this.updateStatCard("stat-escalated", 0);
  }

  updateStatCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
      element.classList.remove("animate-pulse");
    }
  }

  async loadActivity() {
    try {
      // Use recent review queue or logs for activity
      const response = await fetch("/api/coordinator/review-queue?limit=5");
      const result = await response.json();

      const container = document.getElementById("recent-activity-list");
      if (!container) return;

      if (result.success && result.data && result.data.length > 0) {
        container.innerHTML = result.data
          .map(
            (item) => `
          <div class="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
            <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-800">${
  item.title || "New Report"
}</p>
              <p class="text-xs text-gray-500">
                ${item.category || "General"} • ${
  item.urgency_level || "Medium"
} Priority
              </p>
            </div>
          </div>
        `
          )
          .join("");
      } else {
        container.innerHTML = `
          <div class="text-center py-4 text-gray-500 text-sm">
            No recent activity
          </div>
        `;
      }
    } catch (error) {
      console.error("[COORDINATOR] Activity load error:", error);
    }
  }

  initCharts() {
    // Trend Chart
    const trendCtx = document.getElementById("trendChart");
    if (trendCtx) {
      this.trendChart = new Chart(trendCtx, {
        type: "line",
        data: {
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          datasets: [
            {
              label: "Incoming Reports",
              data: [12, 19, 3, 5, 2, 3, 15], // Mock data for now
              borderColor: "#3b82f6",
              tension: 0.4,
              fill: true,
              backgroundColor: "rgba(59, 130, 246, 0.1)",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { display: false } },
            x: { grid: { display: false } },
          },
        },
      });
    }

    // Distribution Chart
    const distCtx = document.getElementById("distributionChart");
    if (distCtx) {
      this.distributionChart = new Chart(distCtx, {
        type: "doughnut",
        data: {
          labels: [],
          datasets: [
            {
              data: [],
              backgroundColor: [],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "right" } },
        },
      });
    }

    if (this.lastDashboardData) {
      this.updateCharts(this.lastDashboardData);
    }
  }

  updateCharts(data) {
    if (!data) return;

    const dist = Array.isArray(data.category_distribution) ? data.category_distribution : [];
    if (this.distributionChart) {
      const entries = dist
        .map((x) => ({ category: x?.category, count: Number(x?.count || 0) }))
        .filter((x) => x.category && Number.isFinite(x.count) && x.count > 0);

      const top = entries.slice(0, 8);
      const rest = entries.slice(8);
      const otherCount = rest.reduce((sum, x) => sum + x.count, 0);

      const labels = top.map((x) => x.category);
      const counts = top.map((x) => x.count);
      if (otherCount > 0) {
        labels.push("Others");
        counts.push(otherCount);
      }

      const palette = [
        "#2563eb",
        "#dc2626",
        "#059669",
        "#d97706",
        "#7c3aed",
        "#0891b2",
        "#4b5563",
        "#db2777",
        "#16a34a",
      ];
      const colors = labels.map((_, idx) => palette[idx % palette.length]);

      this.distributionChart.data.labels = labels;
      this.distributionChart.data.datasets[0].data = counts;
      this.distributionChart.data.datasets[0].backgroundColor = colors;
      this.distributionChart.update();
    }
  }

  setupEventListeners() {
    // Add any button listeners specific to dashboard actions if needed
  }

  startAutoRefresh() {
    this.statsInterval = setInterval(() => this.loadStats(), 30000);
    this.activityInterval = setInterval(() => this.loadActivity(), 60000);
  }

  destroy() {
    if (this.statsInterval) clearInterval(this.statsInterval);
    if (this.activityInterval) clearInterval(this.activityInterval);
    if (this.trendChart) this.trendChart.destroy();
    if (this.distributionChart) this.distributionChart.destroy();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.coordinatorDashboard = new CoordinatorDashboard();
});

window.addEventListener("beforeunload", () => {
  if (window.coordinatorDashboard) {
    window.coordinatorDashboard.destroy();
  }
});
