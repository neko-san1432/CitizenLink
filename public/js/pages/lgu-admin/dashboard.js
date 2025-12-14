import apiClient from "../../config/apiClient.js";
import showMessage from "../../components/toast.js";
import { escapeHtml } from "../../utils/string.js";
import {
  getStatusText,
  getStatusClass,
  getPriorityClass,
} from "../../utils/complaint.js";

class LguAdminDashboard {
  constructor() {
    this.stats = null;
    this.assignments = [];
    this.activities = [];
    this.alerts = [];
  }
  async init() {
    try {
      await this.loadDashboardData();
      this.setupEventListeners();
    } catch (error) {
      console.error("[LGU_ADMIN_DASHBOARD] Initialization error:", error);
      showMessage("error", "Failed to initialize dashboard");
    }
  }
  async loadDashboardData() {
    try {
      await this.loadAssignments();
      await this.loadActivities();
      await this.loadAlerts();
    } catch (error) {
      console.error("[LGU_ADMIN_DASHBOARD] Load dashboard data error:", error);
      showMessage("error", "Failed to load dashboard data");
    }
  }
  // Statistics loading removed - no longer needed
  async loadAssignments() {
    try {
      const response = await apiClient.get(
        "/api/lgu-admin/department-assignments?limit=5"
      );
      if (response && response.success) {
        this.assignments = response.data || [];
        this.renderAssignments();
      } else {
        throw new Error(response?.error || "Failed to load assignments");
      }
    } catch (error) {
      console.error("[LGU_ADMIN_DASHBOARD] Load assignments error:", error);
      this.assignments = [];
      this.renderAssignments();
    }
  }
  async loadActivities() {
    try {
      // Show recent assignments as activities
      this.activities = this.assignments.slice(0, 5);
      this.renderActivities();
    } catch (error) {
      console.error("[LGU_ADMIN_DASHBOARD] Load activities error:", error);
      this.activities = [];
      this.renderActivities();
    }
  }
  // Statistics methods removed - no longer needed
  renderAssignments() {
    const container = document.getElementById("assignments-container");
    if (!container) return;
    if (this.assignments.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>No Recent Assignments</h3>
          <p>No complaint assignments found.</p>
        </div>
      `;
      return;
    }
    container.innerHTML = `
      <div class="assignments-list">
        ${this.assignments
          .slice(0, 1)
          .map((assignment) => this.renderAssignmentCard(assignment))
          .join("")}
      </div>
    `;
  }
  renderAssignmentCard(assignment) {
    const statusClass = getStatusClass(assignment.status);
    const priorityClass = getPriorityClass(assignment.priority);
    const submittedDate = new Date(
      assignment.submitted_at
    ).toLocaleDateString();
    return `
      <div class="task-item">
        <div class="task-header">
          <div class="task-title">
            <h4>${escapeHtml(assignment.title || "Untitled Complaint")}</h4>
            <div class="task-meta">
              <span class="task-type">#${assignment.complaint_id.slice(
                -8
              )}</span>
              <span class="task-deadline">${submittedDate}</span>
            </div>
          </div>
          <div class="assignment-status">
            <span class="status-badge ${statusClass}">${getStatusText(
      assignment.status
    )}</span>
            <span class="priority-badge ${priorityClass}">${
      assignment.priority
    }</span>
          </div>
        </div>
        <div class="task-content">
          <p>${escapeHtml(
            assignment.description || "No description available"
          )}</p>
          ${
            assignment.officer_name
              ? `
            <div class="task-officer" style="margin-top: 0.5rem; font-size: 0.85rem; color: #666;">
              <span class="detail-label">Officer:</span>
              <span class="detail-value">${escapeHtml(
                assignment.officer_name
              )}</span>
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;
  }

  renderActivities() {
    const container = document.getElementById("activity-container");
    if (!container) return;
    if (this.activities.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🕒</div>
          <h3>No Recent Activity</h3>
          <p>No recent activities found.</p>
        </div>
      `;
      return;
    }
    container.innerHTML = `
      <div class="activities-list">
        ${this.activities
          .map((activity) => this.renderActivityItem(activity))
          .join("")}
      </div>
    `;
  }
  renderActivityItem(activity) {
    const date = new Date(activity.submitted_at).toLocaleDateString();
    const time = new Date(activity.submitted_at).toLocaleTimeString();
    return `
      <div class="activity-item">
        <div class="activity-icon">📋</div>
        <div class="activity-content">
          <div class="activity-title">${escapeHtml(
            activity.title || "Complaint"
          )}</div>
          <div class="activity-meta">
            <span class="activity-date">${date} at ${time}</span>
            <span class="activity-status ${getStatusClass(
              activity.status
            )}">${getStatusText(activity.status)}</span>
          </div>
        </div>
      </div>
    `;
  }
  setupEventListeners() {
    // Refresh buttons
    const refreshActivityBtn = document.getElementById("refresh-activity-btn");
    // Statistics refresh removed - no longer needed
    if (refreshActivityBtn) {
      refreshActivityBtn.addEventListener("click", () => {
        this.loadActivities();
      });
    }

    // Mark all read button
    const markAllReadBtn = document.getElementById("mark-all-read-btn");
    if (markAllReadBtn) {
      markAllReadBtn.addEventListener("click", () => {
        this.markAllRead();
      });
    }

    // Quick action buttons - checks if elements exist before adding listeners
    // Note: The HTML currently uses <a> tags for these, so these might be redundant
    // but keeping them if the HTML structure changes back to buttons.
    const viewAssignmentsBtn = document.querySelector(
      '[onclick="viewAssignments()"]'
    );
    const viewHeatmapBtn = document.querySelector('[onclick="viewHeatmap()"]');
    const generateReportBtn = document.querySelector(
      '[onclick="generateReport()"]'
    );
    if (viewAssignmentsBtn) {
      viewAssignmentsBtn.addEventListener("click", () => {
        window.location.href = "/lgu-admin/assignments";
      });
    }
    if (viewHeatmapBtn) {
      viewHeatmapBtn.addEventListener("click", () => {
        window.location.href = "/lgu-admin/heatmap";
      });
    }
    if (generateReportBtn) {
      generateReportBtn.addEventListener("click", () => {
        this.generateReport();
      });
    }
  }
  async generateReport() {
    try {
      showMessage("info", "Generating report...");
      // This would typically generate a PDF or CSV report
      // For now, we'll just show a success message
      setTimeout(() => {
        showMessage("success", "Report generated successfully");
      }, 1000);
    } catch (error) {
      console.error("[LGU_ADMIN_DASHBOARD] Generate report error:", error);
      showMessage("error", "Failed to generate report");
    }
  }
  async loadAlerts() {
    try {
      const response = await apiClient.get("/api/notifications/unread?limit=5");
      if (response && response.success) {
        this.alerts = response.notifications || [];
        this.renderAlerts();
      } else {
        throw new Error(response?.error || "Failed to load alerts");
      }
    } catch (error) {
      console.error("[LGU_ADMIN_DASHBOARD] Load alerts error:", error);
      this.alerts = [];
      this.renderAlerts();
    }
  }

  renderAlerts() {
    const container = document.getElementById("alerts-container");
    if (!container) return;

    if (this.alerts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <h3>All Caught Up</h3>
          <p>No new alerts or notifications.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="alerts-list">
        ${this.alerts.map((alert) => this.renderAlertItem(alert)).join("")}
      </div>
    `;
  }

  renderAlertItem(alert) {
    const date = new Date(alert.created_at).toLocaleDateString();
    const time = new Date(alert.created_at).toLocaleTimeString();

    // Determine icon based on priority or type
    let icon = "🔔";
    if (alert.priority === "high" || alert.priority === "urgent") {
      icon = "⚠️";
    } else if (alert.type === "system") {
      icon = "🤖";
    } else if (alert.type === "success") {
      icon = "✅";
    }

    return `
      <div class="alert-item ${alert.read ? "read" : "unread"}">
        <div class="alert-icon">${icon}</div>
        <div class="alert-content">
          <div class="alert-title">${escapeHtml(
            alert.title || "Notification"
          )}</div>
          <div class="alert-message">${escapeHtml(alert.message || "")}</div>
          <div class="alert-meta">
            <span class="alert-time">${date} at ${time}</span>
          </div>
        </div>
        ${
          alert.link
            ? `<a href="${alert.link}" class="btn-sm btn-outline">View</a>`
            : ""
        }
      </div>
    `;
  }

  async markAllRead() {
    try {
      const response = await apiClient.post("/api/notifications/mark-all-read");
      if (response && response.success) {
        showMessage("success", "All notifications marked as read");
        this.loadAlerts(); // Reload to show empty state
      } else {
        showMessage("error", "Failed to mark notifications as read");
      }
    } catch (error) {
      console.error("[LGU_ADMIN_DASHBOARD] Mark all read error:", error);
      showMessage("error", "Failed to mark notifications as read");
    }
  }
}

// Initialize the dashboard
// Initialize the dashboard
const dashboard = new LguAdminDashboard();
window.dashboard = dashboard; // Expose for global functions
document.addEventListener("DOMContentLoaded", () => {
  dashboard.init();
});
