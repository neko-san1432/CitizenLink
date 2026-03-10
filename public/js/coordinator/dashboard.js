import Chart from "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/+esm";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("/api/coordinator/start-counts");
    const { data } = await response.json();

    if (data) {
      const setStatText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
      };
      setStatText("stat-incoming", data.incoming || 0);
      setStatText("stat-unverified", data.unverified || 0);
      setStatText("stat-assigned", data.assigned || 0);
      setStatText("stat-escalated", data.escalated || 0);
    }

    // Load feeds
    await Promise.all([
      loadNotices(),
      loadNews(),
      loadEvents()
    ]);

    // Initialize Charts (Mock data for now to prevent errors if API lacks chart data)
    const trendCtx = document.getElementById("trendChart")?.getContext("2d");
    if (trendCtx) {
      new Chart(trendCtx, {
        type: "line",
        data: {
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          datasets: [{
            label: "Incoming complaints",
            data: [12, 19, 3, 5, 2, 3, 7],
            borderColor: "rgb(75, 192, 192)",
            tension: 0.1
          }]
        }
      });
    }

  } catch (error) {
    console.error("Failed to load dashboard stats:", error);
  } finally {
    // Reveal the dashboard only when everything is ready
    hideDashboardLoader();
  }
});

function hideDashboardLoader() {
  const loader = document.getElementById("dashboard-loading");
  const content = document.getElementById("dashboard-main-content");

  if (loader) {
    loader.style.setProperty("display", "none", "important");
  }

  if (content) {
    content.style.setProperty("display", "block", "important");
    setTimeout(() => {
      content.style.opacity = "1";
    }, 50);
  }
}

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
