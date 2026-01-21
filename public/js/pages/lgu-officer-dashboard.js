/**
 * LGU Officer Dashboard JavaScript
 * Handles API calls and dashboard functionality
 */
class OfficerDashboard {
  constructor() {
    this.statsInterval = null;
    this.activityInterval = null;
    this.trendChart = null;
    this.distributionChart = null;
    this.init();
  }

  async init() {
    try {
      await this.loadDashboardData();
      this.initCharts();
      this.startAutoRefresh();
    } catch (error) {
      console.error("[OFFICER] Init error:", error);
      this.setDefaultStats();
    }
  }

  async loadDashboardData() {
    try {
      await this.loadStats();
      await this.loadActivity();
    } catch (error) {
      console.error("[OFFICER] Load data error:", error);
      this.setDefaultStats();
    }
  }

  async loadStats() {
    try {
      const response = await fetch("/api/lgu/statistics");
      if (!response.ok) throw new Error("Failed to fetch stats");

      const result = await response.json();
      if (result.success) {
        const { data } = result;

        // Map API data to new HTML IDs
        this.updateStatCard("stat-assigned", data.total_tasks || 0);
        this.updateStatCard("stat-in-progress", data.in_progress_tasks || 0);
        this.updateStatCard("stat-completed", data.completed_tasks || 0);
        this.updateStatCard("stat-overdue", data.overdue_tasks || 0);

        // Update charts if API provides data
        this.updateCharts(data);
      } else {
        this.setDefaultStats();
      }
    } catch (error) {
      this.setDefaultStats();
    }
  }

  setDefaultStats() {
    this.updateStatCard("stat-assigned", 0);
    this.updateStatCard("stat-in-progress", 0);
    this.updateStatCard("stat-completed", 0);
    this.updateStatCard("stat-overdue", 0);
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
      const response = await fetch("/api/lgu/tasks?limit=5"); // Using tasks as activity for officer
      const result = await response.json();

      const container = document.getElementById("recent-activity-list");
      if (!container) return;

      if (result.success && result.data && result.data.length > 0) {
        container.innerHTML = result.data
          .map(
            (task) => `
          <div class="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
            <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p class="text-sm font-medium text-gray-800">${
  task.complaint?.title || "Assigned Task"
}</p>
              <p class="text-xs text-gray-500">
                Status: ${task.status || "Pending"} • Due: ${new Date(
  task.deadline
).toLocaleDateString()}
              </p>
            </div>
          </div>
        `
          )
          .join("");
      } else {
        container.innerHTML = `
          <div class="text-center py-4 text-gray-500 text-sm">
            No recent tasks
          </div>
        `;
      }
    } catch (error) {
      console.error("[OFFICER] Activity load error:", error);
    }
  }

  initCharts() {
    // Trend Chart
    const trendCtx = document.getElementById("trendChart");
    if (trendCtx) {
      this.trendChart = new Chart(trendCtx, {
        type: "bar",
        data: {
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          datasets: [
            {
              label: "Tasks Completed",
              data: [5, 8, 3, 12, 6, 4, 7], // Mock
              backgroundColor: "#3b82f6",
              borderRadius: 4,
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
          labels: ["Pending", "In Progress", "Completed", "Review"],
          datasets: [
            {
              data: [10, 25, 45, 20], // Mock
              backgroundColor: ["#f59e0b", "#eab308", "#10b981", "#6366f1"],
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
  }

  updateCharts(data) {
    // Implement chart update
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
  window.officerDashboard = new OfficerDashboard();
});

window.addEventListener("beforeunload", () => {
  if (window.officerDashboard) {
    window.officerDashboard.destroy();
  }
});
