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
      updateActivity(complaints);
    }
    await loadPublicationWidgets();
  } catch (error) {
    console.error("[CITIZEN] Load dashboard error:", error);
    updateStats([], 0);
  } finally {
    hideDashboardLoader();
  }
}

function hideDashboardLoader() {
  const loader = document.getElementById("dashboard-loading");
  const content = document.getElementById("dashboard-main-content");

  if (loader) {
    loader.style.setProperty("display", "none", "important");
  }

  if (content) {
    content.style.setProperty("display", "block", "important");
    // Small delay to allow display:block to apply before changing opacity for transition
    setTimeout(() => {
      content.style.opacity = "1";
    }, 50);
  }
}

async function loadPublicationWidgets() {
  try {
    const [newsRes, noticesRes, eventsRes] = await Promise.all([
      fetch("/api/content/news?limit=5&status=published"),
      fetch("/api/content/notices?limit=5&status=active"),
      fetch("/api/content/events?limit=5&status=upcoming")
    ]);

    const [newsData, noticesData, eventsData] = await Promise.all([
      newsRes.json(),
      noticesRes.json(),
      eventsRes.json()
    ]);

    renderWidgetList("widget-news-list", newsData.success ? newsData.data : [], "news");
    renderWidgetList("widget-notices-list", noticesData.success ? noticesData.data : [], "notices");
    renderWidgetList("widget-events-list", eventsData.success ? eventsData.data : [], "events");
  } catch (err) {
    console.error("[CITIZEN] Failed to load publication widgets:", err);
  }
}

function renderWidgetList(containerId, items, type) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items || items.length === 0) {
    const bgClass = type === 'notices' ? 'bg-orange-50' : (type === 'events' ? 'bg-green-50' : 'bg-gray-50');
    const borderClass = type === 'notices' ? 'border-orange-200' : (type === 'events' ? 'border-green-200' : 'border-gray-200');
    container.innerHTML = `<div class="text-center py-8 text-gray-500 ${bgClass} rounded-lg border border-dashed ${borderClass}"><p>No recent ${type}</p></div>`;
    return;
  }

  container.innerHTML = items.map(item => {
    let title = item.title || "Untitled";
    let dateStr = item.published_at || item.created_at || item.event_date;
    let date = dateStr ? new Date(dateStr).toLocaleDateString() : "";
    let meta = "";

    if (type === 'events') {
      meta = `<span class="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">Event</span>`;
    } else if (type === 'notices') {
      let colorClass = item.priority === 'urgent' ? 'text-red-600 bg-red-50 border-red-200' : 'text-orange-600 bg-orange-50 border-orange-200';
      meta = `<span class="text-xs font-semibold px-2 py-0.5 rounded border ${colorClass} capitalize">${item.priority || 'Normal'}</span>`;
    }

    return `
      <a href="/publication#${type}" class="block p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-colors">
        <h4 class="font-semibold text-gray-800 text-sm mb-1 leading-tight">${escapeHtml(title)}</h4>
        <div class="flex items-center justify-between mt-2">
          <span class="text-xs text-gray-500">${date}</span>
          ${meta}
        </div>
      </a>
    `;
  }).join("");
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
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
       <div class="flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm transition-all">
         <div class="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
           </svg>
         </div>
         <div class="flex-1 min-w-0">
           <p class="text-base font-semibold text-gray-900 truncate">${c.descriptive_su || c.description || c.title || "Untitled Complaint"}</p>
           <p class="text-sm text-gray-500 mt-1">${new Date(c.submitted_at || c.created_at).toLocaleDateString()} • <span class="capitalize">${c.category || "General"}</span></p>
         </div>
         <div class="flex-shrink-0">
           <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${statusClass.replace("bg-", "bg-opacity-10 border-")} ${statusClass.replace("bg-", "text-")}">
             ${status.toUpperCase()}
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
  window.location.href = "/profile";
};
