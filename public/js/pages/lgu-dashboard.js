/**
 * LGU Dashboard JavaScript
 * For LGU Admins
 */
document.addEventListener("DOMContentLoaded", async () => {
  await loadDashboardData();
  initCharts();

  // Refresh interval
  setInterval(loadDashboardData, 30000);
});

async function loadDashboardData() {
  try {
    const response = await fetch("/api/lgu-admin/dashboard-stats");
    if (!response.ok) throw new Error("API Error");

    const result = await response.json();
    if (result.success) {
      updateStats(result.data);
    }
  } catch (error) {
    console.error("[LGU-ADMIN] Load dashboard error:", error);
    updateStats({});
  }
}

function updateStats(data) {
  setText("stat-total", data.total_complaints || 0);
  setText("stat-pending", data.pending_complaints || 0);
  setText("stat-in-progress", data.in_progress_complaints || 0);
  setText("stat-resolved", data.resolved_complaints || 0);

  // Update Recent Activity
  // Note: If API doesn't return recent_activity, this will be empty.
  updateActivity(data.recent_activity || []);
}

function updateActivity(activities) {
  const container = document.getElementById("recent-activity-list");
  if (!container) return;

  if (activities && activities.length > 0) {
    container.innerHTML = activities
      .map(
        (item) => `
         <div class="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
           <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
             </svg>
           </div>
           <div>
             <p class="text-sm font-medium text-gray-800">${
  item.title || "Activity"
}</p>
             <p class="text-xs text-gray-500">${new Date(
    item.created_at
  ).toLocaleDateString()}</p>
           </div>
         </div>
      `
      )
      .join("");
  } else {
    container.innerHTML = `<div class="text-center py-4 text-gray-500">No recent activity</div>`;
  }
}

function initCharts() {
  const trendCtx = document.getElementById("trendChart");
  if (trendCtx) {
    new Chart(trendCtx, {
      type: "line",
      data: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [
          {
            label: "Complaints",
            data: [12, 19, 3, 5, 2, 3, 10], // Mock Data
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

  const distCtx = document.getElementById("distributionChart");
  if (distCtx) {
    new Chart(distCtx, {
      type: "doughnut",
      data: {
        labels: ["Infrastructure", "Health", "Environment", "Other"],
        datasets: [
          {
            data: [40, 30, 20, 10], // Mock Data
            backgroundColor: ["#3b82f6", "#ef4444", "#10b981", "#f59e0b"],
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

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
