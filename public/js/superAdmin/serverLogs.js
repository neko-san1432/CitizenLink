/**
 * Server Logs Page - Command Center Logic
 */
// import showMessage from "../components/toast.js"; // Kept for future use if needed, but commenting out to fix lint

// State management
let isTerminalPaused = false;
let activeLogFilter = "all";

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  await refreshAllData();

  // Auto-refresh loops
  // Feed refreshes slower implies historical data
  setInterval(() => {
    if (!document.hidden) loadVisualFeed();
  }, 15000);

  // Terminal refreshes faster for "live" feel
  setInterval(() => {
    if (!document.hidden && !isTerminalPaused) loadTerminalMatrix();
  }, 5000);

  // Filter Event Listeners
  const feedFilter = document.getElementById("log-type-filter");
  if (feedFilter) {
    feedFilter.addEventListener("change", (e) => {
      activeLogFilter = e.target.value;
      loadVisualFeed();
    });
  }
});

// Global controls for HTML access
window.loadLogs = refreshAllData;
window.toggleTerminalPause = toggleTerminalPause;
window.clearTerminal = clearTerminal;
window.toggleFeedFilters = toggleFeedFilters;
window.openInsightPanel = openInsightPanel;
window.closeInsightPanel = closeInsightPanel;

async function refreshAllData() {
  await Promise.all([loadVisualFeed(), loadTerminalMatrix()]);
  updateHealthKPIs();
}

/**
 * 1. VISUAL FEED LOGIC
 */
async function loadVisualFeed() {
  const container = document.getElementById("logs-container");
  if (!container) return;

  try {
    // Determine filter query
    const queryType = activeLogFilter;

    const response = await fetch(
      `/api/superadmin/logs?log_type=${queryType}&limit=50`
    );
    const result = await response.json();

    if (result.success) {
      renderVisualFeed(normalizeLogs(result.logs));
    }
  } catch (error) {
    console.warn("[Feed] Failed to load visual logs", error);
    // Don't wipe container on minor network blips, just log warning
  }
}

function normalizeLogs(logs) {
  const allLogs = [];
  // Helper to flatten various log formats into a unified structure
  if (logs.role_changes)
    logs.role_changes.forEach((l) => allLogs.push({ ...l, _category: "role" }));
  if (logs.department_transfers)
    logs.department_transfers.forEach((l) =>
      allLogs.push({ ...l, _category: "dept" })
    );
  if (logs.complaint_workflow)
    logs.complaint_workflow.forEach((l) =>
      allLogs.push({ ...l, _category: "workflow" })
    );
  if (logs.security_events)
    logs.security_events.forEach((l) =>
      allLogs.push({ ...l, _category: "security" })
    );

  return allLogs.sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

function renderVisualFeed(logs) {
  const container = document.getElementById("logs-container");
  if (logs.length === 0) {
    container.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--gray-400);">
        <p>No recent activity found</p>
      </div>`;
    return;
  }

  container.innerHTML = logs
    .map((log) => {
      const meta = getLogMetadata(log);
      // Serialize for click handler
      const safeLogData = encodeURIComponent(JSON.stringify(log));

      return `
      <div class="feed-item" onclick="openInsightPanel('${safeLogData}')">
        <div class="feed-icon ${meta.class}">
           ${meta.icon}
        </div>
        <div class="feed-content">
           <div class="feed-header">
              <span class="feed-title">${meta.title}</span>
              <span class="feed-time">${timeAgo(log.created_at)}</span>
           </div>
           <div class="feed-desc">
              ${meta.desc}
           </div>
           <div class="feed-meta">
              <span class="mini-badge">${meta.badge}</span>
           </div>
        </div>
      </div>
    `;
    })
    .join("");
}

function getLogMetadata(log) {
  // Returns title, desc, icon, class based on log content
  const actors = {
    user: log.user?.email || log.user_id || "Unknown User",
    admin: log.performer?.email || log.changed_by || "System",
  };

  if (log._category === "role") {
    return {
      class: "role",
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
      title: "Role Modified",
      desc: `<strong>${displayEmail(
        actors.user
      )}</strong> promoted to <span style="color:var(--primary-600)">${
        log.new_role
      }</span> by ${displayEmail(actors.admin)}`,
      badge: log.new_role,
    };
  }
  if (log._category === "dept") {
    return {
      class: "workflow",
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>`,
      title: "Office Transfer",
      desc: `<strong>${displayEmail(actors.user)}</strong> moved to ${
        log.to_department
      }`,
      badge: log.to_department,
    };
  }
  if (log._category === "security") {
    return {
      class: "security",
      icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
      title: "Security Alert",
      desc: log.description || "Suspicious activity detected via firewall",
      badge: "Critical",
    };
  }

  // Default
  return {
    class: "system",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    title: "System Event",
    desc:
      log.description ||
      JSON.stringify(log.details) ||
      "System background task",
    badge: "Info",
  };
}

/**
 * 2. TERMINAL MATRIX LOGIC
 */
async function loadTerminalMatrix() {
  if (isTerminalPaused) return;

  // const container = document.getElementById("terminal-logs-container"); // Removed unused var
  try {
    const response = await fetch(`/api/superadmin/terminal-logs?limit=50`); // Fetch fewer, high freq
    const data = await response.json();

    if (data.success) {
      renderMatrix(data.logs);
    }
  } catch (e) {
    // Silent fail in terminal is realistic
  }
}

function renderMatrix(logs) {
  const container = document.getElementById("terminal-logs-container");
  if (!container) return;

  // Simple diff: if valid new logs, prepend them or replace
  // For this demo, we'll replace but ideally we'd stream-append
  const html = logs
    .map((l) => {
      let lvlClass = "info";
      if (l.level === "error") lvlClass = "error";
      if (l.level === "warn") lvlClass = "warn";
      if (l.level === "debug") lvlClass = "debug";

      return `
      <div class="matrix-line">
        <span class="matrix-ts">${new Date(l.timestamp)
    .toISOString()
    .split("T")[1]
    .slice(0, 8)}</span>
        <span class="matrix-lvl ${lvlClass}">[${l.level.toUpperCase()}]</span>
        <span class="matrix-msg">${escapeHtml(l.message)}</span>
      </div>`;
    })
    .join("");

  container.innerHTML = html;
}

function toggleTerminalPause() {
  isTerminalPaused = !isTerminalPaused;
  const btn = document.getElementById("term-pause-btn");
  if (btn) {
    btn.textContent = isTerminalPaused ? "Resume" : "Pause";
    btn.classList.toggle("active", isTerminalPaused);
  }
}

function clearTerminal() {
  const container = document.getElementById("terminal-logs-container");
  if (container)
    container.innerHTML = `<div style="color:#666; padding:1rem;">Terminal cleared. Waiting for new signals...</div>`;
}

/**
 * 3. DRILL DOWN PANELS
 */
function openInsightPanel(encodedData) {
  const data = JSON.parse(decodeURIComponent(encodedData));
  const panel = document.getElementById("log-insight-panel");
  const content = document.getElementById("insight-content");

  if (!panel || !content) return;

  // Render Key-Value pairs nicely
  let detailsHtml = `
      <div class="insight-row">
        <div class="insight-label">Timestamp</div>
        <div class="insight-value">${new Date(
    data.created_at
  ).toLocaleString()}</div>
      </div>
      <div class="insight-row">
        <div class="insight-label">Event Type</div>
        <div class="insight-value" style="font-family:monospace">${
  data._category?.toUpperCase() || "GENERIC"
}</div>
      </div>
  `;

  // Add unique fields
  Object.keys(data).forEach((key) => {
    if (["created_at", "_category", "id", "user", "performer"].includes(key))
      return;

    const val = data[key];
    if (typeof val === "object" && val !== null) {
      detailsHtml += `
      <div class="insight-row">
        <div class="insight-label">${key.replaceAll("_", " ")}</div>
        <div class="insight-json">${escapeHtml(
    JSON.stringify(val, null, 2)
  )}</div>
      </div>`;
    } else {
      detailsHtml += `
      <div class="insight-row">
        <div class="insight-label">${key.replaceAll("_", " ")}</div>
        <div class="insight-value">${escapeHtml(String(val))}</div>
      </div>`;
    }
  });

  content.innerHTML = detailsHtml;
  panel.classList.add("open");
}

function closeInsightPanel() {
  const panel = document.getElementById("log-insight-panel");
  if (panel) panel.classList.remove("open");
}

/**
 * 4. KPIs & UTILS
 */
function updateHealthKPIs() {
  // This would ideally come from a real health check endpoint
  // For now, we simulate based on error log count
  const terminalLogs = document.querySelectorAll(".matrix-lvl.error");
  const errorCount = terminalLogs.length || 0;

  const errEl = document.getElementById("error-count");
  if (errEl) errEl.textContent = errorCount;

  const statusEl = document.getElementById("system-status-text");
  const statusIcon = document.getElementById("status-icon");
  const statusSubtext = document.querySelector(
    "#system-status-text + .stat-subtext"
  );

  if (statusEl && statusIcon) {
    if (errorCount > 5) {
      statusEl.textContent = "Unstable";
      statusEl.style.color = "#b91c1c";
      statusIcon.className = "stat-icon-wrapper error";
      if (statusSubtext) statusSubtext.textContent = "High error rate detected";
    } else {
      statusEl.textContent = "Healthy";
      statusEl.style.color = "#15803d";
      statusIcon.className = "stat-icon-wrapper healthy";
      if (statusSubtext) statusSubtext.textContent = "All services operational";
    }
  }

  // Mock active users for visual completeness (replace with API if available)
  const usersEl = document.getElementById("active-users-count");
  if (usersEl && usersEl.textContent === "-") {
    usersEl.textContent = Math.floor(Math.random() * 20) + 5;
  }
}

function displayEmail(email) {
  if (!email) return "Unknown";
  return email.includes("@") ? email.split("@")[0] : email;
}

function timeAgo(dateString) {
  const date = new Date(dateString);
  const seconds = Math.floor((new Date() - date) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return `${Math.floor(interval)}y ago`;
  interval = seconds / 2592000;
  if (interval > 1) return `${Math.floor(interval)}mo ago`;
  interval = seconds / 86400;
  if (interval > 1) return `${Math.floor(interval)}d ago`;
  interval = seconds / 3600;
  if (interval > 1) return `${Math.floor(interval)}h ago`;
  interval = seconds / 60;
  if (interval > 1) return `${Math.floor(interval)}m ago`;
  return `${Math.floor(seconds)}s ago`;
}

function toggleFeedFilters() {
  const filters = document.getElementById("feed-filters");
  if (filters) filters.classList.toggle("hidden");
}

function escapeHtml(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
