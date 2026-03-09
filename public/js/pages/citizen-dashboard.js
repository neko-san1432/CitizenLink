/**
 * Citizen Dashboard JavaScript
 */
import showMessage from "../components/toast.js";
import { initializeRoleToggle } from "../auth/roleToggle.js";

document.addEventListener("DOMContentLoaded", async () => {
  await Promise.all([
    loadDashboardData(),
    loadNotices(),
    loadNews(),
    loadEvents()
  ]);
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
           <p class="text-base font-semibold text-gray-900 truncate">${c.descriptive_su || c.description || c.title || (c.subcategory ? (c.category + ' - ' + c.subcategory).replace(/\b\w/g, l => l.toUpperCase()) : (c.category || 'General').replace(/\b\w/g, l => l.toUpperCase()))}</p>
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

// --- CONTENT FETCHING --- //

async function loadNotices() {
  const container = document.getElementById("urgent-notices-feed");
  if (!container) return;

  try {
    const response = await fetch("/api/content/notices?limit=5&status=active");
    const result = await response.json();
    
    if (result.success && result.data && result.data.length > 0) {
      container.innerHTML = result.data.map(notice => {
        const priorityColor = notice.priority === 'urgent' || notice.priority === 'high' ? 'text-red-700 font-bold' : 'text-gray-800 font-semibold';
        const dateStr = new Date(notice.valid_from).toLocaleDateString([], { month: 'short', day: 'numeric' });
        
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
        const dateStr = new Date(item.published_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
        const categoryTag = item.category ? `<span class="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium mb-1">${item.category}</span>` : '';
        
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
        const dateStr = new Date(event.event_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        
        return `
          <div class="p-3 bg-white rounded-lg border border-emerald-100 shadow-sm hover:shadow-md transition">
            <div class="flex items-center gap-3">
              <div class="flex flex-col items-center justify-center pt-1 pb-1 px-2 bg-emerald-50 rounded text-emerald-700 min-w-[32px] flex-shrink-0 border border-emerald-100">
                <span class="text-[9px] font-bold leading-none mb-0.5">${new Date(event.event_date).toLocaleDateString([], { month: 'short' }).toUpperCase()}</span>
                <span class="text-sm font-black leading-none">${new Date(event.event_date).getDate()}</span>
              </div>
              <div class="flex-1">
                <h4 class="text-sm font-semibold text-gray-800 leading-tight mb-1">${event.title}</h4>
                <div class="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <svg xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px; min-width: 14px;" class="flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span class="line-clamp-1">${event.location || 'TBA'}</span>
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
