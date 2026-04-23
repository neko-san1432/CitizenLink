/**
 * LGU Dashboard - Premium Performance Variant
 * Optimized for independent chart refreshing and smooth morphing.
 */
import showMessage from "../components/toast.js";

// --- Global State ---
let lastKnownStats = null;
const componentTimeframes = {
  stats: 'yearly',
  activity: 'yearly',
  trend: 'yearly',
  distribution_pie: 'yearly',
  distribution_bar: 'yearly'
};

const charts = {
  categoryBreakdown: null,
  complaintsByCategory: null,
  nlpTrend: null,
  completionPie: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isDark() { return document.documentElement.classList.contains("dark"); }

function chartDefaults() {
  const dark = isDark();
  return {
    gridColor: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    tickColor: dark ? "#94a3b8" : "#6b7280",
    legendColor: dark ? "#e5e7eb" : "#374151",
  };
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "—";
}

function setStatText(key, value) {
  setText(`lgu-stat-${key}`, value);
  setText(`stat-${key}`, value);
}

function buildLabelsAndData(obj) {
  const entries = Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);
  return {
    labels: entries.map(([k]) => k),
    data: entries.map(([, v]) => v),
  };
}

// ─── Skeleton Toggle ─────────────────────────────────────────────────────────
function toggleSkeleton(show) {
  const loading = document.getElementById('dashboard-loading');
  const main = document.getElementById('dashboard-main-content');
  if (!loading || !main) return;

  if (show) {
    loading.style.display = 'flex';
    main.style.display = 'none';
    main.style.opacity = '0';
  } else {
    loading.style.display = 'none';
    main.style.display = 'block';
    setTimeout(() => { main.style.opacity = '1'; }, 50);
  }
}

// ─── Empty State Helpers ─────────────────────────────────────────────────────
function showEmptyChart(canvasId, message) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const parent = canvas.parentElement;
  if (!parent) return;
  canvas.style.display = "none";
  if (parent.querySelector(".empty-chart-msg")) return;
  const msg = document.createElement("div");
  msg.className = "empty-chart-msg";
  msg.style.cssText = "display:flex;align-items:center;justify-content:center;height:100%;color:#64748b;font-size:0.85em;";
  msg.textContent = message;
  parent.appendChild(msg);
}

function clearEmptyChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  canvas.style.display = "block";
  const parent = canvas.parentElement;
  if (parent) {
    const existing = parent.querySelector(".empty-chart-msg");
    if (existing) existing.remove();
  }
}

// ─── Chart Renderers ─────────────────────────────────────────────────────────
function renderCategoryBreakdown(categoryDistribution) {
  const ctx = document.getElementById("categoryBreakdownChart");
  if (!ctx) return;
  const legendDiv = document.getElementById("categoryBreakdownLegend");
  const dataMap = buildLabelsAndData(categoryDistribution);
  
  if (dataMap.labels.length === 0) {
    showEmptyChart("categoryBreakdownChart", "No data to be shown");
    if (legendDiv) legendDiv.innerHTML = "";
    return;
  }
  clearEmptyChart("categoryBreakdownChart");

  const colors = ["#3b82f6", "#9ca3af", "#fb923c", "#22c55e", "#facc15", "#ef4444", "#8b5cf6"];

  if (charts.categoryBreakdown) {
    charts.categoryBreakdown.data.labels = dataMap.labels;
    charts.categoryBreakdown.data.datasets[0].data = dataMap.data;
    charts.categoryBreakdown.update();
  } else {
    charts.categoryBreakdown = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: dataMap.labels,
        datasets: [{ data: dataMap.data, backgroundColor: colors, borderWidth: 2, borderColor: "#1e293b" }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: "70%", animation: { duration: 1200, easing: 'easeOutQuart' }, plugins: { legend: { display: false } } }
    });
  }

  if (legendDiv) {
    legendDiv.innerHTML = dataMap.labels.map((l, i) => `<span style="display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:${colors[i%colors.length]}"></span>${l}</span>`).join("");
  }
}

function renderComplaintsByCategory(categoryDistribution) {
  const ctx = document.getElementById("complaintsByCategoryChart");
  if (!ctx) return;
  const dataMap = buildLabelsAndData(categoryDistribution);

  if (dataMap.labels.length === 0) {
    showEmptyChart("complaintsByCategoryChart", "No data to be shown");
    return;
  }
  clearEmptyChart("complaintsByCategoryChart");

  const { tickColor, gridColor } = chartDefaults();

  if (charts.complaintsByCategory) {
    charts.complaintsByCategory.data.labels = dataMap.labels;
    charts.complaintsByCategory.data.datasets[0].data = dataMap.data;
    charts.complaintsByCategory.update();
  } else {
    charts.complaintsByCategory = new Chart(ctx, {
      type: "bar",
      data: {
        labels: dataMap.labels,
        datasets: [{ data: dataMap.data, backgroundColor: "rgba(59, 130, 246, 0.8)", borderRadius: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { color: tickColor }, grid: { display: false } }, y: { ticks: { color: tickColor, precision: 0 }, grid: { color: gridColor } } }
      }
    });
  }
}

function renderNlpTrend(trendObj) {
  const ctx = document.getElementById("nlpIntelligenceImpactChart");
  if (!ctx) return;
  const entries = Object.entries(trendObj || {}).sort((a,b) => a[0].localeCompare(b[0]));
  
  if (entries.length === 0) {
    showEmptyChart("nlpIntelligenceImpactChart", "No data to be shown");
    return;
  }
  clearEmptyChart("nlpIntelligenceImpactChart");

  const labels = entries.map(e => e[0].split('-').slice(1).join('/'));
  const data = entries.map(e => e[1]);
  const { tickColor, gridColor } = chartDefaults();

  if (charts.nlpTrend) {
    charts.nlpTrend.data.labels = labels;
    charts.nlpTrend.data.datasets[0].data = data;
    charts.nlpTrend.update();
  } else {
    charts.nlpTrend = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{ data, borderColor: "#818cf8", backgroundColor: "rgba(129, 140, 248, 0.1)", fill: true, tension: 0.4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { color: tickColor }, grid: { display: false } }, y: { ticks: { color: tickColor, precision: 0 }, grid: { color: gridColor } } }
      }
    });
  }
}
function renderRecentAlerts(alerts) {
  const list = document.getElementById("recent-alerts-list");
  if (!list) return;
  if (!alerts || alerts.length === 0) {
    list.innerHTML = `<div style="padding: 20px; text-align: center; color: #64748b;">No high-priority alerts for this period.</div>`;
    return;
  }
  
  const getAlertStyle = (priority, category) => {
    const p = (priority || '').toLowerCase();
    const c = (category || '').toLowerCase();
    
    if (p === 'urgent' || p === 'emergency' || c === 'fire' || c === 'disaster') {
      return { icon: 'fa-fire', color: 'var(--accent-red)', bg: 'rgba(239, 68, 68, 0.05)', label: 'EMERGENCY' };
    }
    if (p === 'high' || c === 'crime' || c === 'safety') {
      return { icon: 'fa-shield-alt', color: 'var(--accent-orange)', bg: 'rgba(249, 115, 22, 0.05)', label: 'PUBLIC SAFETY' };
    }
    return { icon: 'fa-leaf', color: 'var(--accent-green)', bg: 'rgba(16, 185, 129, 0.05)', label: 'ENVIRONMENT' };
  };

  list.innerHTML = alerts.slice(0, 4).map(a => {
    const style = getAlertStyle(a.priority, a.category);
    return `
      <div style="padding: 12px; background: ${style.bg}; border-left: 3px solid ${style.color}; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: ${style.color}; font-size: 0.7rem; font-weight: 800; display: flex; align-items: center; gap: 6px;">
            <i class="fas ${style.icon}"></i> ${style.label}
          </span>
          <span style="color: var(--text-secondary); font-size: 0.7rem;">${new Date(a.submitted_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
        </div>
        <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 2px;">${a.category || 'General'}</div>
        <div style="color: var(--text-secondary); font-size: 0.8rem; line-height: 1.4;">${a.description}</div>
      </div>
    `;
  }).join("");
}

function renderSecondaryImpact(trendObj) {
  const ctx = document.getElementById("secondaryImpactChart");
  if (!ctx) return;
  const entries = Object.entries(trendObj || {}).sort((a,b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) return;

  const labels = entries.map(e => e[0].split('-').slice(1).join('/'));
  const data = entries.map(e => e[1]);
  const { tickColor, gridColor } = chartDefaults();

  if (charts.secondaryImpact) {
    charts.secondaryImpact.data.labels = labels;
    charts.secondaryImpact.data.datasets[0].data = data;
    charts.secondaryImpact.update();
  } else {
    charts.secondaryImpact = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{ data, borderColor: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.1)", fill: true, tension: 0.4, pointRadius: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });
  }
}

// --- Content Feeds (from Coordinator) ---
async function loadNotices() {
  const container = document.getElementById("urgent-notices-feed");
  if (!container) return;
  try {
    const response = await fetch("/api/content/notices?limit=5&status=active");
    const result = await response.json();
    if (result.success && result.data?.length > 0) {
      container.innerHTML = result.data.map(notice => `
        <div style="padding: 12px; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.1); border-radius: 12px; transition: all 0.3s ease;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
            <h4 style="margin: 0; font-size: 0.85em; color: #f87171; font-weight: 600;">${notice.title}</h4>
            <span style="font-size: 0.7em; color: #94a3b8;">${new Date(notice.valid_from).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
          </div>
          <p style="margin: 0; font-size: 0.75em; color: #94a3b8; line-height: 1.4;">${notice.content}</p>
        </div>
      `).join("");
    } else {
      container.innerHTML = `<div style="text-align: center; padding: 20px; color: #64748b; font-size: 0.85em;">No active notices</div>`;
    }
  } catch (error) {
    container.innerHTML = `<div style="text-align: center; padding: 20px; color: #ef4444; font-size: 0.85em;">Failed to load</div>`;
  }
}

async function loadNews() {
  const container = document.getElementById("news-feed");
  if (!container) return;
  try {
    const response = await fetch("/api/content/news?limit=5&status=published");
    const result = await response.json();
    if (result.success && result.data?.length > 0) {
      container.innerHTML = result.data.map(item => `
        <div style="padding: 12px; background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.1); border-radius: 12px; transition: all 0.3s ease;">
          ${item.category ? `<span style="display: inline-block; padding: 2px 6px; background: rgba(59, 130, 246, 0.1); color: #60a5fa; border-radius: 4px; font-size: 0.6em; font-weight: 600; margin-bottom: 6px; text-transform: uppercase;">${item.category}</span>` : ""}
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
            <h4 style="margin: 0; font-size: 0.85em; color: #f1f5f9; font-weight: 600;">${item.title}</h4>
            <span style="font-size: 0.7em; color: #94a3b8;">${new Date(item.published_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
          </div>
          <p style="margin: 0; font-size: 0.75em; color: #94a3b8; line-height: 1.4;">${item.excerpt || item.content}</p>
        </div>
      `).join("");
    } else {
      container.innerHTML = `<div style="text-align: center; padding: 20px; color: #64748b; font-size: 0.85em;">No recent news</div>`;
    }
  } catch (error) {
    container.innerHTML = `<div style="text-align: center; padding: 20px; color: #ef4444; font-size: 0.85em;">Failed to load</div>`;
  }
}

async function loadEvents() {
  const container = document.getElementById("events-feed");
  if (!container) return;
  try {
    const response = await fetch("/api/content/events?limit=5&status=upcoming");
    const result = await response.json();
    if (result.success && result.data?.length > 0) {
      container.innerHTML = result.data.map(event => {
        const d = new Date(event.event_date);
        return `
          <div style="padding: 12px; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.1); border-radius: 12px; display: flex; gap: 12px; align-items: center; transition: all 0.3s ease;">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 40px; height: 40px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; color: #10b981; flex-shrink: 0;">
              <span style="font-size: 0.6em; font-weight: 800; text-transform: uppercase; line-height: 1;">${d.toLocaleDateString([], { month: "short" })}</span>
              <span style="font-size: 1.1em; font-weight: 900; line-height: 1;">${d.getDate()}</span>
            </div>
            <div style="flex: 1; min-width: 0;">
              <h4 style="margin: 0 0 2px 0; font-size: 0.85em; color: #f1f5f9; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${event.title}</h4>
              <div style="display: flex; align-items: center; gap: 4px; color: #64748b; font-size: 0.7em;">
                <svg style="width: 12px; height: 12px;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${event.location || "TBA"}</span>
              </div>
            </div>
          </div>
        `;
      }).join("");
    } else {
      container.innerHTML = `<div style="text-align: center; padding: 20px; color: #64748b; font-size: 0.85em;">No upcoming events</div>`;
    }
  } catch (error) {
    container.innerHTML = `<div style="text-align: center; padding: 20px; color: #ef4444; font-size: 0.85em;">Failed to load</div>`;
  }
}

// ─── Main Logic ───────────────────────────────────────────────────────────────
async function loadDashboard(timeframe = null, target = 'all', showSkeleton = false) {
  try {
    if (typeof Chart === "undefined") {
      setTimeout(() => loadDashboard(timeframe, target, showSkeleton), 500);
      return;
    }

    const activeTf = timeframe || (target === 'all' ? 'yearly' : (componentTimeframes[target] || 'yearly'));
    if (timeframe && target !== 'all') componentTimeframes[target] = timeframe;

    if (showSkeleton) toggleSkeleton(true);

    const res = await fetch(`/api/lgu-admin/dashboard-stats?timeframe=${activeTf}&target=${target}`, { credentials: "include" });
    const result = await res.json();

    if (!result || !result.success) { toggleSkeleton(false); return; }

    const { stats, charts: chartData } = result.data || {};

    if ((target === 'all' || target === 'stats') && stats) {
      setText("lgu-stat-total", stats.total_active || stats.total || 0);
      setText("lgu-stat-emergency", stats.priority?.urgent || 0);
      setText("lgu-stat-high-priority", stats.priority?.high || 0);
      setText("lgu-stat-avg-priority", stats.avg_priority_score || 0);
    }

    if ((target === 'all' || target === 'trend') && chartData?.trend) {
      renderNlpTrend(chartData.trend);
      renderSecondaryImpact(chartData.trend);
    }
    if ((target === 'all' || target === 'distribution_pie') && chartData?.distribution_pie) renderCategoryBreakdown(chartData.distribution_pie);
    if ((target === 'all' || target === 'distribution_bar') && chartData?.distribution_bar) renderComplaintsByCategory(chartData.distribution_bar);
    if ((target === 'all' || target === 'activity') && result.data && result.data.recent_activity) renderRecentAlerts(result.data.recent_activity);

    toggleSkeleton(false);
  } catch (err) {
    console.error("[LGU_DASH] Error:", err);
    toggleSkeleton(false);
  }
}

async function loadPersonalTasks() {
  const container = document.getElementById("personal-tasks-list");
  const countBadge = document.getElementById("personal-task-count");
  if (!container) return;

  try {
    const response = await fetch("/api/lgu/tasks?limit=5");
    const result = await response.json();

    if (result.success && result.data?.length > 0) {
      if (countBadge) countBadge.textContent = result.data.length;
      container.innerHTML = result.data.map(task => `
        <div style="padding: 12px; background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.1); border-radius: 12px; transition: all 0.3s ease;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
            <h4 style="margin: 0; font-size: 0.85em; color: #818cf8; font-weight: 600;">${task.complaint?.category || 'Assigned Task'}</h4>
            <span style="font-size: 0.7em; color: #94a3b8; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${task.status || 'Pending'}</span>
          </div>
          <p style="margin: 0 0 8px 0; font-size: 0.8em; color: #f1f5f9; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${task.complaint?.description || 'No description available'}</p>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.7em; color: #64748b;">Due: ${new Date(task.deadline).toLocaleDateString()}</span>
            <a href="/review/${task.complaint_id}" style="font-size: 0.75em; color: #60a5fa; text-decoration: none; font-weight: 500;">View Details →</a>
          </div>
        </div>
      `).join("");
    } else {
      if (countBadge) countBadge.textContent = "0";
      container.innerHTML = `<div style="text-align: center; padding: 40px 20px; color: #64748b; font-size: 0.85em;">No tasks assigned to you.</div>`;
    }
  } catch (error) {
    console.error("[LGU_DASH] Personal tasks error:", error);
    container.innerHTML = `<div style="text-align: center; padding: 40px 20px; color: #ef4444; font-size: 0.85em;">Failed to load tasks.</div>`;
  }
}

function init() {
  const mapping = {
    'timeframe-alerts': 'activity',
    'timeframe-breakdown': 'distribution_pie',
    'timeframe-category': 'distribution_bar',
    'timeframe-trend': 'trend'
  };
  
  Object.entries(mapping).forEach(([id, target]) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = 'yearly';
      el.addEventListener('change', (e) => loadDashboard(e.target.value, target, false));
    }
  });

  const timeEl = document.getElementById("current-lgu-time");
  if (timeEl) timeEl.textContent = new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  loadDashboard('yearly', 'all', true);
  loadNotices();
  loadNews();
  loadEvents();
  loadPersonalTasks();
  
  setInterval(() => {
    Object.keys(componentTimeframes).forEach(t => loadDashboard(null, t, false));
    loadNotices();
    loadNews();
    loadEvents();
    loadPersonalTasks();
  }, 60000);
}

document.addEventListener("DOMContentLoaded", init);
if (document.readyState !== "loading") init();
