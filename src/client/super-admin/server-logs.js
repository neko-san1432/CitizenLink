/**
 * Server Logs Page
 * Display system logs for super admin
 */
import showMessage from "../components/toast.js";

// Initialize page
document.addEventListener("DOMContentLoaded", async () => {
  await loadLogs();
  await loadTerminalLogs();
  // Auto-refresh every 30 seconds
  setInterval(loadLogs, 30000);
  setInterval(loadTerminalLogs, 10000); // Refresh terminal logs more frequently

  // Add filter change handlers
  const filterSelect = document.getElementById("log-type-filter");
  if (filterSelect) {
    filterSelect.addEventListener("change", loadLogs);
  }

  const terminalLevelFilter = document.getElementById("terminal-level-filter");
  if (terminalLevelFilter) {
    terminalLevelFilter.addEventListener("change", loadTerminalLogs);
  }
});

/**
 * Load system logs
 */
window.loadLogs = async function() {
  try {
    const logType = document.getElementById("log-type-filter").value;
    const container = document.getElementById("logs-container");

    // Show loading state
    container.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading logs...</p>
      </div>
    `;

    const response = await fetch(`/api/superadmin/logs?log_type=${logType}&limit=100`);
    const result = await response.json();

    if (result.success) {
      displayLogs(result.logs);
    } else {
      container.innerHTML = `<p class="empty-state" style="color: #ef4444;">Failed to load logs: ${  result.error || "Unknown error"  }</p>`;
    }
  } catch (error) {
    console.error("[SERVER_LOGS] Load logs error:", error);
    const container = document.getElementById("logs-container");
    if (container) {
      container.innerHTML = '<p class="empty-state" style="color: #ef4444;">Failed to load logs</p>';
    }
    showMessage("Failed to load logs", "error");
  }
};

/**
 * Display logs
 */
function displayLogs(logs) {
  const container = document.getElementById("logs-container");
  const allLogs = [];

  // Combine all log types
  if (logs.role_changes) {
    logs.role_changes.forEach(log => {
      allLogs.push({ ...log, log_type: "role_change" });
    });
  }
  if (logs.department_transfers) {
    logs.department_transfers.forEach(log => {
      allLogs.push({ ...log, log_type: "dept_transfer" });
    });
  }
  if (logs.complaint_workflow) {
    logs.complaint_workflow.forEach(log => {
      allLogs.push({ ...log, log_type: "complaint" });
    });
  }

  // Sort by date (newest first)
  allLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (allLogs.length === 0) {
    container.innerHTML = '<p class="empty-state">No logs found</p>';
    return;
  }

  const html = allLogs.map(log => formatLogEntry(log)).join("");
  container.innerHTML = html;
}

/**
 * Format log entry
 */
function formatLogEntry(log) {
  const date = new Date(log.created_at).toLocaleString();
  let content = "";
  let typeLabel = "";
  let typeColor = "#667eea";

  if (log.log_type === "role_change") {
    typeLabel = "Role Change";
    typeColor = "#3498db";
    const userEmail = log.user?.email || log.user_id || "Unknown";
    const performerEmail = log.performer?.email || log.changed_by || "System";
    content = `
      <strong>${userEmail}</strong>: ${log.old_role || "N/A"} → ${log.new_role || "N/A"}
      <div style="color: #64748b; font-size: 0.875rem; margin-top: 0.5rem;">By: ${performerEmail}</div>
      ${log.metadata?.reason ? `<div style="margin-top: 0.5rem; color: #64748b; font-size: 0.875rem;">Reason: ${log.metadata.reason}</div>` : ""}
      ${log.reason ? `<div style="margin-top: 0.5rem; color: #64748b; font-size: 0.875rem;">Reason: ${log.reason}</div>` : ""}
    `;
  } else if (log.log_type === "dept_transfer") {
    typeLabel = "Dept Transfer";
    typeColor = "#f59e0b";
    const userEmail = log.user?.email || log.user_id || "Unknown";
    const performerEmail = log.performer?.email || log.transferred_by || "System";
    content = `
      <strong>${userEmail}</strong>: ${log.from_department || "N/A"} → ${log.to_department || "N/A"}
      <div style="color: #64748b; font-size: 0.875rem; margin-top: 0.5rem;">By: ${performerEmail}</div>
      ${log.reason ? `<div style="margin-top: 0.5rem; color: #64748b; font-size: 0.875rem;">Reason: ${log.reason}</div>` : ""}
    `;
  } else if (log.log_type === "complaint") {
    typeLabel = "Complaint";
    typeColor = "#10b981";
    content = `
      <strong>${log.action_type || "Action"}</strong>: Complaint #${log.complaint_id?.substring(0, 8) || "N/A"}...
      ${log.details ? `<div style="margin-top: 0.5rem; color: #64748b; font-size: 0.875rem;">${JSON.stringify(log.details)}</div>` : ""}
    `;
  }

  return `
    <div class="log-entry">
      <div class="log-entry-header">
        <span class="log-type" style="background: ${typeColor};">${typeLabel}</span>
        <span class="log-entry-date">${date}</span>
      </div>
      <div class="log-entry-content">${content}</div>
    </div>
  `;
}

/**
 * Load terminal logs
 */
window.loadTerminalLogs = async function() {
  try {
    const level = document.getElementById("terminal-level-filter")?.value || "all";
    const container = document.getElementById("terminal-logs-container");
    if (!container) return;

    const response = await fetch(`/api/superadmin/terminal-logs?level=${level}&limit=500`);
    const result = await response.json();

    if (result.success && result.logs) {
      displayTerminalLogs(result.logs);
    } else {
      container.innerHTML = `<p style="color: #ef4444;">Failed to load terminal logs: ${  result.error || "Unknown error"  }</p>`;
    }
  } catch (error) {
    console.error("[SERVER_LOGS] Load terminal logs error:", error);
    const container = document.getElementById("terminal-logs-container");
    if (container) {
      container.innerHTML = '<p style="color: #ef4444;">Failed to load terminal logs</p>';
    }
    showMessage("Failed to load terminal logs", "error");
  }
};

/**
 * Display terminal logs
 */
function displayTerminalLogs(logs) {
  const container = document.getElementById("terminal-logs-container");
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = '<p style="color: #888;">No terminal logs found</p>';
    return;
  }

  // Sort by timestamp (newest first)
  const sortedLogs = [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const html = sortedLogs.map(log => {
    const level = log.level || "log";
    let levelColor = "#d4d4d4";
    let levelPrefix = "";

    switch(level) {
      case "error":
        levelColor = "#f48771";
        levelPrefix = "❌";
        break;
      case "warn":
        levelColor = "#dcdcaa";
        levelPrefix = "⚠️";
        break;
      case "info":
        levelColor = "#4ec9b0";
        levelPrefix = "ℹ️";
        break;
      case "debug":
        levelColor = "#9cdcfe";
        levelPrefix = "🔍";
        break;
      default:
        levelColor = "#d4d4d4";
        levelPrefix = "📝";
    }

    // Escape HTML but preserve formatting
    const message = escapeHtml(log.message || "");
    const timestamp = log.timestampFormatted || new Date(log.timestamp).toLocaleString();

    return `
      <div style="margin-bottom: 0.5rem; padding: 0.5rem; border-left: 3px solid ${levelColor}; padding-left: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
          <span style="color: ${levelColor};">${levelPrefix}</span>
          <span style="color: #858585; font-size: 0.75rem;">[${timestamp}]</span>
          <span style="color: ${levelColor}; font-weight: bold; text-transform: uppercase; font-size: 0.75rem;">${level}</span>
        </div>
        <div style="color: #d4d4d4; white-space: pre-wrap; word-break: break-word; font-size: 0.875rem; line-height: 1.5;">${message}</div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;

  // Auto-scroll to top (newest logs)
  container.scrollTop = 0;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  if (text == null) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

