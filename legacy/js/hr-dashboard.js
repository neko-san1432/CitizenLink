/**
 * HR Dashboard JavaScript
 */
document.addEventListener("DOMContentLoaded", async () => {
  await loadDashboardData();
  initCharts();

  // Refresh interval
  setInterval(loadDashboardData, 30000);
});

async function loadDashboardData() {
  try {
    const response = await fetch("/api/hr/dashboard");
    // Fallback if API missing or failing
    if (!response.ok) throw new Error("API Error");

    const result = await response.json();
    if (result.success) {
      updateStats(result.data);
      updateActivity(result.data);
    }
  } catch (error) {
    console.error("[HR] Load dashboard error:", error);
    // Set zeros on error
    updateStats({});
  }
}

function updateStats(data) {
  setText("stat-staff-complaints", data.staff_complaints || 0);
  setText("stat-internal", data.internal_cases || 0);
  setText("stat-pending", data.pending_reviews || 0);
  setText("stat-resolved", data.resolved_cases || 0);
}

function updateActivity(data) {
  const container = document.getElementById("recent-activity-list");
  if (!container) return;

  // Assuming data.recent_activity exists or we use a subset of complaints
  const activities = data.recent_activity || [];

  if (activities.length > 0) {
    container.innerHTML = activities
      .map(
        (item) => `
       <div class="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
         <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
           </svg>
         </div>
         <div>
           <p class="text-sm font-medium text-gray-800">${
  item.description || "Activity"
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
            label: "Internal Cases",
            data: [2, 4, 1, 3, 2, 5, 2],
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
        labels: ["Harassment", "Misconduct", "Disputes", "Other"],
        datasets: [
          {
            data: [5, 10, 8, 4],
            backgroundColor: ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"],
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
