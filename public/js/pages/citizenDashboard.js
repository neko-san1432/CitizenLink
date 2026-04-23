/**
 * Citizen Dashboard JavaScript
 */
import showMessage from "../components/toast.js";
import { initializeRoleToggle } from "../auth/roleToggle.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Load initial data (stats first for charts)
    await loadDashboardData();

    // Initialize role toggle
    try {
      await initializeRoleToggle();
    } catch (e) {
      console.error("Role toggle error", e);
    }

    // Timeframe filter listener
    const timeframeSelect = document.getElementById("activityTimeframe");
    if (timeframeSelect) {
      timeframeSelect.addEventListener("change", () => {
        loadDashboardData();
      });
    }
  } catch (error) {
    console.error("Dashboard initialization failed:", error);
  } finally {
    // Reveal the dashboard only when everything is ready
    hideDashboardLoader();
  }

  // Refresh interval (non-blocking)
  setInterval(loadDashboardData, 30000);
});

async function loadDashboardData() {
  try {
    // Fetch ongoing resolution complaints for carousel
    const ongoingRes = await fetch("/api/complaints/my?status=in_progress&limit=10");
    if (ongoingRes.ok) {
      const ongoingJson = await ongoingRes.json();
      if (ongoingJson.success) {
        updateOngoingResolution(ongoingJson.data.complaints || ongoingJson.data || []);
      }
    }

    // Fetch statistics for recent activity
    const statsRes = await fetch("/api/complaints/my-statistics");

    if (statsRes.ok) {
      const statsJson = await statsRes.json();
      if (statsJson.success) {
        // Update Desktop Metrics
        const stats = statsJson.data;
        if (document.getElementById("desktop-metric-total")) {
          document.getElementById("desktop-metric-total").textContent = stats.total || 0;
        }
        if (document.getElementById("desktop-metric-pending")) {
          const byStatus = stats.byStatus || {};
          document.getElementById("desktop-metric-pending").textContent = (byStatus.in_progress || 0) + (byStatus.assigned || 0) + (byStatus.submitted || 0) + (byStatus.new || 0);
        }
        if (document.getElementById("desktop-metric-resolved")) {
          const byStatus = stats.byStatus || {};
          document.getElementById("desktop-metric-resolved").textContent = (byStatus.resolved || 0) + (byStatus.completed || 0);
        }

        // Filter activity by timeframe
        const filteredActivity = filterActivityByTimeframe(statsJson.data.recentActivity || [], "all");
        updateActivity(filteredActivity);
      }
    }

    await Promise.all([
      loadNews().catch(err => console.error("loadNews error:", err)),
      loadNotices().catch(err => console.error("loadNotices error:", err)),
      loadEvents().catch(err => console.error("loadEvents error:", err))
    ]);
  } catch (error) {
    console.error("[CITIZEN] Load dashboard error:", error);
  }
}

function filterActivityByTimeframe(activities, timeframe) {
  if (timeframe === "all") return activities;

  const now = new Date();
  let startDate;

  switch (timeframe) {
    case "7days":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30days":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90days":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      return activities;
  }

  return activities.filter(a => new Date(a.submitted_at) >= startDate);
}

function hideDashboardLoader() {
  const loader = document.getElementById("dashboard-loading");
  const content = document.getElementById("dashboard-main-content");

  if (loader) {
    loader.classList.add("skeleton-fade-out");
    // Remove from DOM after animation completes
    setTimeout(() => {
      loader.style.display = "none";
    }, 400);
  }

  if (content) {
    content.style.display = "block";
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
    const bgClass = type === "notices" ? "bg-orange-50" : (type === "events" ? "bg-green-50" : "bg-gray-50");
    const borderClass = type === "notices" ? "border-orange-200" : (type === "events" ? "border-green-200" : "border-gray-200");
    container.innerHTML = `<div class="text-center py-8 text-gray-500 ${bgClass} rounded-lg border border-dashed ${borderClass}"><p>No recent ${type}</p></div>`;
    return;
  }

  container.innerHTML = items.map(item => {
    const title = item.title || "Untitled";
    const dateStr = item.published_at || item.created_at || item.event_date;
    const date = dateStr ? new Date(dateStr).toLocaleDateString() : "";
    let meta = "";

    if (type === "events") {
      meta = `<span class="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">Event</span>`;
    } else if (type === "notices") {
      const colorClass = item.priority === "urgent" ? "text-red-600 bg-red-50 border-red-200" : "text-orange-600 bg-orange-50 border-orange-200";
      meta = `<span class="text-xs font-semibold px-2 py-0.5 rounded border ${colorClass} capitalize">${item.priority || "Normal"}</span>`;
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

  if (!complaints || complaints.length === 0) {
    container.innerHTML = `<p>No recent activity</p>`;
    return;
  }

  container.innerHTML = complaints
    .map(
      (c) => {
        const status = c.status || c.workflow_status || "Submitted";
        let statusClass = "bg-gray-100 text-gray-800";
        if (["submitted", "new"].includes(status.toLowerCase())) statusClass = "bg-blue-100 text-blue-800";
        else if (["in_progress", "assigned"].includes(status.toLowerCase())) statusClass = "bg-orange-100 text-orange-800";
        else if (["resolved", "completed"].includes(status.toLowerCase())) statusClass = "bg-green-100 text-green-800";

        const statusLabel = String(status).replace(/_/g, " ").toUpperCase();

        return `
       <div class="recent-update-item flex items-center gap-4 p-4 rounded-xl border border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm transition-all">
         <div class="recent-update-icon w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
           <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
           </svg>
         </div>
         <div class="recent-update-body flex-1 min-w-0">
           <p class="recent-update-title text-base font-semibold text-gray-900">${c.description ? escapeHtml(c.description) : (c.category || "General").replace(/\b\w/g, l => l.toUpperCase())}</p>
           <p class="text-sm text-gray-500 mt-1">${new Date(c.submitted_at || c.created_at).toLocaleDateString()} • <span class="capitalize">${c.category || "General"}</span></p>
         </div>
         <div class="recent-update-status-wrap flex-shrink-0">
           <span class="recent-update-status items-center px-3 py-1 rounded-full text-xs font-medium border ${statusClass}">
             ${statusLabel}
           </span>
         </div>
       </div>
    `;
      }
    )
    .join("");
}

function updateOngoingResolution(complaints) {
  const container = document.getElementById("ongoing-resolution-carousel");
  if (!container) return;

  if (!complaints || complaints.length === 0) {
    container.innerHTML = `<p>No ongoing resolutions</p>`;
    return;
  }

  container.innerHTML = complaints
    .map((c) => {
      const status = c.status || c.workflow_status || "In Progress";
      const desc = c.description || c.category || "Complaint";

      return `
        <div class="flex-shrink-0 w-[280px] p-4 rounded-xl border border-gray-200 bg-white hover:border-blue-300 hover:shadow-md transition-all cursor-pointer" onclick="window.location.href='/complaint/${c.id}'">
          <div class="flex items-start justify-between mb-2">
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              ${status.replace("_", " ").toUpperCase()}
            </span>
            <span class="text-xs text-gray-400">${c.category_name || c.category || "General"}</span>
          </div>
          <p class="text-sm font-medium text-gray-900 truncate">${escapeHtml(desc.substring(0, 50))}${desc.length > 50 ? "..." : ""}</p>
          <p class="text-xs text-gray-500 mt-1">Submitted: ${new Date(c.submitted_at || c.created_at).toLocaleDateString()}</p>
        </div>
      `;
    })
    .join("");
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// Window functions for quick actions
window.fileNewcomplaint = function () {
  window.location.href = "/filecomplaint";
};

window.viewMyprofile = function () {
  window.location.href = "/profile";
};

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
