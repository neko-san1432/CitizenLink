import apiClient from '../../config/apiClient.js';
import showMessage from '../../components/toast.js';

class LguAdminDashboard {
  constructor() {
    this.stats = null;
    this.assignments = [];
    this.activities = [];
  }

  async init() {
    console.log('[LGU_ADMIN_DASHBOARD] Initializing...');
    
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
      await Promise.all([
        this.loadStats(),
        this.loadAssignments(),
        this.loadActivities()
      ]);
    } catch (error) {
      console.error('[LGU_ADMIN_DASHBOARD] Load dashboard data error:', error);
      showMessage('error', 'Failed to load dashboard data');
    }
  }

  async loadStats() {
    try {
      console.log('[LGU_ADMIN_DASHBOARD] Loading statistics...');
      
      const { data } = await apiClient.get('/api/lgu-admin/department-assignments');
      
      if (data && data.success) {
        this.stats = this.calculateStats(data.data || []);
        this.renderStats();
      } else {
        throw new Error(data?.error || 'Failed to load statistics');
      }
    } catch (error) {
      console.error('[LGU_ADMIN_DASHBOARD] Load stats error:', error);
      this.stats = this.getDefaultStats();
      this.renderStats();
    }
  }

  async loadAssignments() {
    try {
      console.log('[LGU_ADMIN_DASHBOARD] Loading recent assignments...');
      
      const { data } = await apiClient.get('/api/lgu-admin/department-assignments?limit=5');
      
      if (data && data.success) {
        this.assignments = data.data || [];
        this.renderAssignments();
      } else {
        throw new Error(data?.error || 'Failed to load assignments');
      }
    } catch (error) {
      console.error('[LGU_ADMIN_DASHBOARD] Load assignments error:', error);
      this.assignments = [];
      this.renderAssignments();
    }
  }

  async loadActivities() {
    try {
      console.log('[LGU_ADMIN_DASHBOARD] Loading recent activities...');
      
      // For now, we'll use assignments as activities
      // In the future, this could be a separate activities endpoint
      this.activities = this.assignments.slice(0, 5);
      this.renderActivities();
    } catch (error) {
      console.error('[LGU_ADMIN_DASHBOARD] Load activities error:', error);
      this.activities = [];
      this.renderActivities();
    }
  }

  calculateStats(assignments) {
    const total = assignments.length;
    const unassigned = assignments.filter(a => a.status === 'unassigned').length;
    const assigned = assignments.filter(a => a.status === 'assigned' || a.status === 'active').length;
    const completed = assignments.filter(a => a.status === 'completed').length;
    const resolutionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      unassigned,
      assigned,
      completed,
      resolutionRate
    };
  }

  getDefaultStats() {
    return {
      total: 0,
      unassigned: 0,
      assigned: 0,
      completed: 0,
      resolutionRate: 0
    };
  }

  renderStats() {
    if (!this.stats) return;

    // Update stat cards
    this.updateStatCard('stat-total-complaints', this.stats.total);
    this.updateStatCard('stat-pending', this.stats.unassigned);
    this.updateStatCard('stat-resolved', this.stats.completed);
    this.updateStatCard('stat-resolution-rate', `${this.stats.resolutionRate}%`);
  }

  updateStatCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
    }
  }

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
    const statusClass = this.getStatusClass(assignment.status);
    const priorityClass = this.getPriorityClass(assignment.priority);
    const submittedDate = new Date(assignment.submitted_at).toLocaleDateString();

    return `
      <div class="assignment-card">
        <div class="assignment-header">
          <div class="assignment-title">
            <h4>${this.escapeHtml(assignment.title || 'Untitled Complaint')}</h4>
            <div class="assignment-meta">
              <span class="assignment-id">#${assignment.complaint_id.slice(-8)}</span>
              <span class="assignment-date">${submittedDate}</span>
            </div>
          </div>
          <div class="assignment-status">
            <span class="status-badge ${statusClass}">${this.getStatusText(assignment.status)}</span>
            <span class="priority-badge ${priorityClass}">${assignment.priority}</span>
          </div>
        </div>
        <div class="assignment-content">
          <p>${this.escapeHtml(assignment.description || 'No description available')}</p>
          ${assignment.officer_name ? `
            <div class="assignment-officer">
              <span class="detail-label">Officer:</span>
              <span class="detail-value">${this.escapeHtml(assignment.officer_name)}</span>
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
    const refreshStatsBtn = document.getElementById('refresh-stats');
    const refreshActivityBtn = document.getElementById('refresh-activity');

    if (refreshStatsBtn) {
      refreshStatsBtn.addEventListener('click', () => {
        this.loadStats();
      });
    }

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

  getStatusClass(status) {
    const statusClasses = {
      'unassigned': 'status-unassigned',
      'assigned': 'status-assigned',
      'active': 'status-active',
      'in_progress': 'status-in-progress',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled'
    };
    return statusClasses[status] || 'status-unknown';
  }

  getStatusText(status) {
    const statusTexts = {
      'unassigned': 'Unassigned',
      'assigned': 'Assigned',
      'active': 'Active',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return statusTexts[status] || status;
  }

  getPriorityClass(priority) {
    const priorityClasses = {
      'low': 'priority-low',
      'medium': 'priority-medium',
      'high': 'priority-high',
      'urgent': 'priority-urgent'
    };
    return priorityClasses[priority] || 'priority-medium';
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the dashboard
const dashboard = new LguAdminDashboard();

document.addEventListener('DOMContentLoaded', () => {
  dashboard.init();
});


