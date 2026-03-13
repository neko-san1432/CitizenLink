/**
 * LGU Dashboard JavaScript
 * For LGU Admins
 */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Wait for all data and widgets to load
    await Promise.all([
      loadDashboardData(),
      loadPublicationWidgets()
    ]);

    // Load data and widgets
    await Promise.all([
      loadDashboardData(),
      loadPublicationWidgets()
    ]);

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
    const response = await fetch("/api/lgu-admin/dashboard-stats");
    if (!response.ok) throw new Error("API Error");

    const result = await response.json();
    if (result.success) {
      updateStats(result.data);
      // Initialize or update charts with real data
      initCharts(result.data.charts);
    }
  } catch (error) {
    console.error("[LGU-ADMIN] Load dashboard error:", error);
    updateStats({});
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

    renderFeed("news-feed", newsData.success ? newsData.data : [], "news");
    renderFeed("urgent-notices-feed", noticesData.success ? noticesData.data : [], "notices");
    renderFeed("events-feed", eventsData.success ? eventsData.data : [], "events");
  } catch (err) {
    console.error("[LGU-ADMIN] Failed to load publication widgets:", err);
  }
}

function renderFeed(containerId, items, type) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `<div class="text-center py-4 text-gray-500 text-sm">No recent ${type}</div>`;
    return;
  }

  container.innerHTML = items.map(item => {
    const title = item.title || "Untitled";
    const dateStr = item.published_at || item.created_at || item.event_date;
    const date = dateStr ? new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" }) : "";

    if (type === "notices") {
      const priorityColor = item.priority === "urgent" || item.priority === "high" ? "text-red-700 font-bold" : "text-gray-800 font-semibold";
      return `
          <div class="p-3 bg-white rounded-lg border border-red-100 shadow-sm hover:shadow-md transition">
            <div class="flex justify-between items-start mb-1">
              <h4 class="text-sm ${priorityColor}">${title}</h4>
              <span class="text-xs text-red-500 whitespace-nowrap ml-2">${date}</span>
            </div>
            <p class="text-xs text-gray-600 line-clamp-2">${item.content}</p>
          </div>
        `;
    } else if (type === "news") {
      const categoryTag = item.category ? `<span class="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium mb-1">${item.category}</span>` : "";
      return `
          <div class="p-3 bg-white rounded-lg border border-blue-100 shadow-sm hover:shadow-md transition">
            ${categoryTag}
            <div class="flex justify-between items-start mb-1">
              <h4 class="text-sm font-semibold text-gray-800">${title}</h4>
              <span class="text-xs text-blue-500 whitespace-nowrap ml-2">${date}</span>
            </div>
            <p class="text-xs text-gray-600 line-clamp-2">${item.excerpt || item.content}</p>
          </div>
        `;
    } else if (type === "events") {
      const eventDate = new Date(dateStr);
      return `
          <div class="p-3 bg-white rounded-lg border border-emerald-100 shadow-sm hover:shadow-md transition">
            <div class="flex items-center gap-3">
              <div class="flex flex-col items-center justify-center pt-1 pb-1 px-2 bg-emerald-50 rounded text-emerald-700 min-w-[32px] flex-shrink-0 border border-emerald-100">
                <span class="text-[9px] font-bold leading-none mb-0.5">${eventDate.toLocaleDateString([], { month: "short" }).toUpperCase()}</span>
                <span class="text-sm font-black leading-none">${eventDate.getDate()}</span>
              </div>
              <div class="flex-1">
                <h4 class="text-sm font-semibold text-gray-800 leading-tight mb-1">${title}</h4>
                <div class="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span class="line-clamp-1">${item.location || "TBA"}</span>
                </div>
              </div>
            </div>
          </div>
        `;
    }
  }).join("");
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
              <p class="text-sm font-medium text-gray-800">${item.descriptive_su || item.title || "Activity"
}</p>
              <p class="text-xs text-gray-500">${new Date(
    item.submitted_at || item.created_at
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

function initCharts(chartData = {}) {
  const trendCtx = document.getElementById("trendChart");
  if (trendCtx) {
    // Destroy existing chart if it exists (for refresh)
    const existing = Chart.getChart(trendCtx);
    if (existing) existing.destroy();

    const trend = chartData.trend || {};
    const labels = Object.keys(trend).sort();
    const dataPoints = labels.map(l => trend[l]);

    // Fallback if no data
    const finalLabels = labels.length > 0 ? labels : ["No Data"];
    const finalData = dataPoints.length > 0 ? dataPoints : [0];

    new Chart(trendCtx, {
      type: "line",
      data: {
        labels: finalLabels,
        datasets: [
          {
            label: "complaints",
            data: finalData,
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
          y: {
            beginAtZero: true,
            grid: { display: false },
            ticks: { precision: 0 }
          },
          x: { grid: { display: false } },
        },
      },
    });
  }

  const distCtx = document.getElementById("distributionChart");
  if (distCtx) {
    const existing = Chart.getChart(distCtx);
    if (existing) existing.destroy();

    const dist = chartData.category_distribution || {};
    const labels = Object.keys(dist);
    const dataPoints = labels.map(l => dist[l]);

    // Fallback if no data
    const finalLabels = labels.length > 0 ? labels : ["No complaints"];
    const finalData = dataPoints.length > 0 ? dataPoints : [0];

    new Chart(distCtx, {
      type: "doughnut",
      data: {
        labels: finalLabels,
        datasets: [
          {
            data: finalData,
            backgroundColor: [
              "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
              "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6"
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: {
              boxWidth: 12,
              font: { size: 10 }
            }
          }
        },
      },
    });
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
