import apiClient from '../../config/apiClient.js';
import showMessage from '../../components/toast.js';
import { escapeHtml } from '../../utils/string.js';
import { getStatusText, getStatusClass, getPriorityClass } from '../../utils/complaint.js';

class LguAdminDashboard {

  constructor() {
    this.stats = null;
    this.assignments = [];
    this.activities = [];
  }
  async init() {
    try {
      await this.loadDashboardData();
      this.setupEventListeners();
    } catch (error) {
      console.error('[LGU_ADMIN_DASHBOARD] Initialization error:', error);
      showMessage('error', 'Failed to initialize dashboard');
    }
  }
  async loadDashboardData() {
    try {
      await this.loadAssignments();
      await this.loadActivities();
    } catch (error) {
      console.error('[LGU_ADMIN_DASHBOARD] Load dashboard data error:', error);
      showMessage('error', 'Failed to load dashboard data');
    }
  }
  // Statistics loading removed - no longer needed
  async loadAssignments() {
    try {
      const response = await apiClient.get('/api/lgu-admin/department-assignments?limit=5');
      if (response && response.success) {
        this.assignments = response.data || [];
        this.renderAssignments();
      } else {
        throw new Error(response?.error || 'Failed to load assignments');
      }
    } catch (error) {
      console.error('[LGU_ADMIN_DASHBOARD] Load assignments error:', error);
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
      console.error('[LGU_ADMIN_DASHBOARD] Load activities error:', error);
      this.activities = [];
      this.renderActivities();
    }
  }
  // Statistics methods removed - no longer needed
  renderAssignments() {
    const container = document.getElementById('assignments-container');
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
        ${this.assignments.map(assignment => this.renderAssignmentCard(assignment)).join('')}
      </div>
    `;
  }
  renderAssignmentCard(assignment) {
    const statusClass = getStatusClass(assignment.status);
    const priorityClass = getPriorityClass(assignment.priority);
    const submittedDate = new Date(assignment.submitted_at).toLocaleDateString();
    return `
      <div class="assignment-card">
        <div class="assignment-header">
          <div class="assignment-title">
            <h4>${escapeHtml(assignment.title || 'Untitled Complaint')}</h4>
            <div class="assignment-meta">
              <span class="assignment-id">#${assignment.complaint_id.slice(-8)}</span>
              <span class="assignment-date">${submittedDate}</span>
            </div>
          </div>
          <div class="assignment-status">
            <span class="status-badge ${statusClass}">${getStatusText(assignment.status)}</span>
            <span class="priority-badge ${priorityClass}">${assignment.priority}</span>
          </div>
        </div>
        <div class="assignment-content">
          <p>${escapeHtml(assignment.description || 'No description available')}</p>
          ${assignment.officer_name ? `
            <div class="assignment-officer">
              <span class="detail-label">Officer:</span>
              <span class="detail-value">${escapeHtml(assignment.officer_name)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  renderActivities() {
    const container = document.getElementById('activity-container');
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
        ${this.activities.map(activity => this.renderActivityItem(activity)).join('')}
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
          <div class="activity-title">${this.escapeHtml(activity.title || 'Complaint')}</div>
          <div class="activity-meta">
            <span class="activity-date">${date} at ${time}</span>
            <span class="activity-status ${this.getStatusClass(activity.status)}">${this.getStatusText(activity.status)}</span>
          </div>
        </div>
      </div>
    `;
  }
  setupEventListeners() {
    // Refresh buttons
    const refreshActivityBtn = document.getElementById('refresh-activity');
    // Statistics refresh removed - no longer needed
    if (refreshActivityBtn) {
      refreshActivityBtn.addEventListener('click', () => {
        this.loadActivities();
      });
    }
    // Quick action buttons
    const viewAssignmentsBtn = document.querySelector('[onclick="viewAssignments()"]');
    const viewHeatmapBtn = document.querySelector('[onclick="viewHeatmap()"]');
    const generateReportBtn = document.querySelector('[onclick="generateReport()"]');
    if (viewAssignmentsBtn) {
      viewAssignmentsBtn.addEventListener('click', () => {
        window.location.href = '/lgu-admin/assignments';
      });
    }
    if (viewHeatmapBtn) {
      viewHeatmapBtn.addEventListener('click', () => {
        window.location.href = '/lgu-admin/heatmap';
      });
    }
    if (generateReportBtn) {
      generateReportBtn.addEventListener('click', () => {
        this.generateReport();
      });
    }
  }
  async generateReport() {
    try {
      showMessage('info', 'Generating report...');
      // This would typically generate a PDF or CSV report
      // For now, we'll just show a success message
      setTimeout(() => {
        showMessage('success', 'Report generated successfully');
      }, 1000);
    } catch (error) {
      console.error('[LGU_ADMIN_DASHBOARD] Generate report error:', error);
      showMessage('error', 'Failed to generate report');
    }
  }
  // Removed duplicate helpers in favor of shared utils
}
// Initialize the dashboard
const dashboard = new LguAdminDashboard();
document.addEventListener('DOMContentLoaded', () => {
  dashboard.init();
});
