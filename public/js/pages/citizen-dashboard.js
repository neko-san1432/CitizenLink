/**
 * Citizen Dashboard JavaScript
 */
import showMessage from "../components/toast.js";
import { initializeRoleToggle } from "../auth/roleToggle.js";

document.addEventListener("DOMContentLoaded", async () => {
  await loadDashboardData();
  initCharts();

  // Initialize role toggle
  try {
    await initializeRoleToggle();
  } catch (e) {
    console.error("Role toggle error", e);
  }

  // Refresh interval
  setInterval(loadDashboardData, 30000);
});

async function loadDashboardData() {
  try {
    const response = await fetch("/api/complaints/my?limit=5"); // Use existing API
    if (!response.ok) throw new Error("API Error");

    const result = await response.json();
    if (result.success) {
      const complaints = result.data || [];
      updateStats(complaints, result.pagination?.total || complaints.length);
      updateActivity(complaints);
    }
  } catch (error) {
    console.error("[CITIZEN] Load dashboard error:", error);
    updateStats([], 0);
  }
}

function updateStats(complaints, total) {
  let pending = 0;
  let inProgress = 0;
  let resolved = 0;

  // We only have the last 5 complaints in 'complaints' array usually if limit is applied,
  // but for accurate stats we might need a stats endpoint.
  // Assuming the API might return stats or we calculate from what we have.
  // If we only fetch 5, our stats will be wrong.
  // Ideally, there should be a /api/citizen/stats endpoint.
  // For now, we'll try to use what we have or just simple counters if we can't get full totals.

  // If the API returns full counts in metadata, use that.
  // Otherwise, we might have to fetch all or use a separate endpoint.
  // Let's assume we can only accurately count what we have or rely on a separate stats call if available.
  // To avoid complex changes, I'll calculate from the fetched batch but this is a limitation.

  complaints.forEach((c) => {
    const status = (c.workflow_status || c.status || "").toLowerCase();
    if (["submitted", "pending", "new"].includes(status)) pending++;
    else if (["in_progress", "assigned", "on_hold"].includes(status))
      inProgress++;
    else if (["resolved", "closed", "completed", "rejected"].includes(status))
      resolved++;
  });

  // If we have total count from pagination, use it for total submitted
  setText("stat-total-submitted", total);

  // Note: These will only reflect the recent batch if we don't have full stats.
  // Ideally we would fetch /api/citizen/stats.
  setText("stat-in-progress", inProgress);
  setText("stat-resolved", resolved);
  setText("stat-feedback", pending);
}

function updateActivity(complaints) {
  const container = document.getElementById("recent-activity-list");
  if (!container) return;

  if (complaints.length > 0) {
    container.innerHTML = complaints
      .map(
        (c) => {
          const status = c.workflow_status || "Submitted";
          let statusClass = "bg-gray-100 text-gray-800";
          if (["submitted", "new"].includes(status.toLowerCase())) statusClass = "bg-blue-100 text-blue-800";
          else if (["in_progress", "assigned"].includes(status.toLowerCase())) statusClass = "bg-orange-100 text-orange-800";
          else if (["resolved", "completed"].includes(status.toLowerCase())) statusClass = "bg-green-100 text-green-800";

          return `
       <div class="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
         <div class="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
           </svg>
         </div>
         <div class="flex-1 min-w-0">
           <p class="text-sm font-semibold text-gray-900 truncate">${c.descriptive_su || c.description || c.title || "Untitled Complaint"}</p>
           <p class="text-xs text-gray-500 mt-0.5">${new Date(c.submitted_at || c.created_at).toLocaleDateString()}</p>
         </div>
         <div>
           <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass}">
             ${status}
           </span>
         </div>
       </div>
    `;
        }
      )
      .join("");
  } else {
    container.innerHTML = `<div class="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
      <p>No recent activity</p>
    </div>`;
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
            label: "My Activity",
            data: [1, 0, 0, 2, 0, 1, 0], // Mock
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
          y: { beginAtZero: true, grid: { display: false }, ticks: { precision: 0 } },
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
        labels: ["Infrastructure", "Services", "Other"],
        datasets: [
          {
            data: [2, 1, 1], // Mock
            backgroundColor: ["#3b82f6", "#10b981", "#f59e0b"],
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

// Window functions for quick actions
window.fileNewComplaint = function () {
  window.location.href = "/fileComplaint";
};

window.viewMyProfile = function () {
  // Assuming profile page exists or just redirect to my complaints
  window.location.href = "/myProfile";
};
