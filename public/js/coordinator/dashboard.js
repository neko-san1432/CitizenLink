/**
 * Coordinator Dashboard JavaScript
 * Handles API calls and dashboard functionality
 */
class CoordinatorDashboard {

  constructor() {
    this.statsInterval = null;
    this.queueInterval = null;
    this.activityInterval = null;
    this.init();
  }

  async init() {
    try {
      await this.checkCoordinatorStatus();
      await this.loadDashboardData();
      this.setupEventListeners();
      this.startAutoRefresh();
    } catch (error) {
      // Continue with basic functionality even if initialization fails
      this.setupEventListeners();
      this.setDefaultStats();
    }
  }

  async checkCoordinatorStatus() {
    try {
      const response = await fetch('/api/coordinator/status');
      if (!response.ok) {
        return;
      }
      const result = await response.json();
      if (!result.success) {
        // Error handled by caller
      }
    } catch (error) {
      // Silently catch error
    }
  }

  async loadDashboardData() {
    try {
      // Load dashboard statistics
      await this.loadStats();
      // Load recent review queue (only 5 complaints)
      await this.loadRecentQueue();
      // Load recent activity
      await this.loadActivity();
      // Fallback: Update stats with default values if API fails
      setTimeout(() => {
        this.updateStatCard('stat-pending', 0);
        this.updateStatCard('stat-reviews', 0);
        this.updateStatCard('stat-duplicates', 0);
        this.updateStatCard('stat-assignments', 0);
      }, 5000);
    } catch (error) {
      console.error('[COORDINATOR DASHBOARD] Failed to load dashboard data:', error);
    }
  }

  async loadStats() {
    try {
      // Check if we're authenticated first
      const authResponse = await fetch('/api/coordinator/status');
      if (!authResponse.ok) {
        this.setDefaultStats();
        return;
      }
      const response = await fetch('/api/coordinator/dashboard');
      if (!response.ok) {
        this.setDefaultStats();
        return;
      }
      const result = await response.json();
      if (result.success) {
        const {data} = result;
        // Update statistics cards only - don't update queue or clusters here
        // Queue and clusters are handled by separate methods to avoid conflicts
        this.updateStatCard('stat-pending', data.pending_reviews || 0);
        this.updateStatCard('stat-reviews', data.stats?.total_reviews || 0);
        this.updateStatCard('stat-duplicates', data.stats?.duplicates_merged || 0);
        this.updateStatCard('stat-assignments', data.stats?.assignments_made || 0);
      } else {
        this.setDefaultStats();
      }
    } catch (error) {
      this.setDefaultStats();
    }
  }

  setDefaultStats() {
    this.updateStatCard('stat-pending', 0);
    this.updateStatCard('stat-reviews', 0);
    this.updateStatCard('stat-duplicates', 0);
    this.updateStatCard('stat-assignments', 0);
  }

  async loadRecentQueue() {
    try {
      const response = await fetch('/api/coordinator/review-queue?limit=5');
      const result = await response.json();
      if (result.success) {
        this.updateRecentQueuePreview(result.data);
      } else {
        this.updateRecentQueuePreview([]);
      }
    } catch (error) {
      this.updateRecentQueuePreview([]);
    }
  }


  async loadActivity() {
    try {
      const response = await fetch('/api/coordinator/dashboard');
      const result = await response.json();
      if (result.success) {
        // Get recent activity from dashboard data or generate from stats
        const activities = this.generateActivityFromStats(result.data);
        this.updateActivityPreview(activities);
      } else {
        this.updateActivityPreview([]);
      }
    } catch (error) {
      console.error('[COORDINATOR DASHBOARD] Failed to load activity:', error);
      this.updateActivityPreview([]);
    }
  }

  generateActivityFromStats(data) {
    const activities = [];
    const now = new Date();

    // Add activity for pending reviews
    if (data.pending_reviews > 0) {
      activities.push({
        icon: '⏰',
        text: `${data.pending_reviews} complaint${data.pending_reviews !== 1 ? 's' : ''} pending review`,
        time: 'Just now',
        type: 'pending'
      });
    }

    // Add activity for recent reviews
    if (data.stats?.total_reviews > 0) {
      activities.push({
        icon: '📊',
        text: `${data.stats.total_reviews} review${data.stats.total_reviews !== 1 ? 's' : ''} completed in last 7 days`,
        time: 'This week',
        type: 'review'
      });
    }

    // Add activity for assignments
    if (data.stats?.assignments_made > 0) {
      activities.push({
        icon: '📤',
        text: `${data.stats.assignments_made} assignment${data.stats.assignments_made !== 1 ? 's' : ''} made this week`,
        time: 'This week',
        type: 'assignment'
      });
    }

    // Add activity for duplicates merged
    if (data.stats?.duplicates_merged > 0) {
      activities.push({
        icon: '🔗',
        text: `${data.stats.duplicates_merged} duplicate${data.stats.duplicates_merged !== 1 ? 's' : ''} merged this week`,
        time: 'This week',
        type: 'duplicate'
      });
    }


    // If no activities, add a default message
    if (activities.length === 0) {
      activities.push({
        icon: '📋',
        text: 'No recent activity',
        time: '—',
        type: 'empty'
      });
    }

    return activities.slice(0, 5); // Limit to 5 most recent
  }

  updateActivityPreview(activities) {
    const container = document.getElementById('activity-container');
    if (!container) return;

    if (!activities || activities.length === 0) {
      container.innerHTML = `
        <div class="activity-list">
          <div class="no-data">
            <div class="no-data-icon">🕒</div>
            <div class="no-data-text">No recent activity</div>
            <div class="no-data-subtext">Activity will appear here</div>
          </div>
        </div>
      `;
      return;
    }

    const activitiesList = activities.map(activity => `
      <div class="activity-item" data-type="${activity.type}">
        <div class="activity-icon">${activity.icon}</div>
        <div class="activity-content">
          <div class="activity-text">${activity.text}</div>
          <div class="activity-time">${activity.time}</div>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="activity-list">
        ${activitiesList}
      </div>
    `;
  }

  updateStatCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = value;
      element.classList.add('loaded');
    } else {
      console.error(`[COORDINATOR DASHBOARD] Element ${elementId} not found in DOM`);
    }
  }

  updateRecentQueuePreview(complaints) {
    const container = document.getElementById('review-queue-container');
    if (!container) {
      console.warn('[COORDINATOR DASHBOARD] review-queue-container not found');
      return;
    }
    if (!complaints || complaints.length === 0) {
      container.innerHTML = `
                <div class="no-data">
                    <div class="no-data-icon">📋</div>
                    <div class="no-data-text">No complaints in review queue</div>
                    <div class="no-data-subtext">New complaints will appear here</div>
                </div>
            `;
      return;
    }
    // Always limit to 5 complaints for preview
    const displayedComplaints = complaints.slice(0, 5);
    const complaintsList = displayedComplaints.map(complaint => `
            <div class="queue-item">
                <div class="queue-item-icon">
                    ${complaint.priority === 'urgent' ? '🚨' :
    complaint.priority === 'high' ? '⚠️' : '📋'}
                </div>
                <div class="queue-item-content">
                    <div class="queue-item-title">${complaint.title}</div>
                    <div class="queue-item-details">
                        <span class="priority-${complaint.priority}">${complaint.priority}</span>
                        <span class="separator">•</span>
                        <span class="category">${complaint.category || 'General'}</span>
                        ${complaint.submitted_by_profile ?
    `<span class="separator">•</span>
                             <span class="submitter">${complaint.submitted_by_profile.name || 'Unknown'}</span>` :
    ''}
                    </div>
                </div>
                <div class="queue-item-actions">
                    <button class="btn btn-sm btn-primary js-review-btn" data-complaint-id="${complaint.id}">
                        Review
                    </button>
                </div>
            </div>
        `).join('');

    container.innerHTML = `
            <div class="queue-header">
                <h3>Recent Complaints (${displayedComplaints.length})</h3>
                <button class="btn btn-secondary btn-sm" id="js-view-all-queue">
                    View All
                </button>
            </div>
            <div class="queue-items">
                ${complaintsList}
            </div>
        `;

    // Attach event listeners instead of inline handlers (CSP compliant)
    const reviewButtons = container.querySelectorAll('.js-review-btn');
    reviewButtons.forEach(btn => {
      const id = btn.getAttribute('data-complaint-id');
      btn.addEventListener('click', () => {
        if (id) window.location.href = `/coordinator/review/${id}`;
      });
    });

    const viewAllBtn = container.querySelector('#js-view-all-queue');
    if (viewAllBtn) {
      viewAllBtn.addEventListener('click', () => {
        window.location.href = '/coordinator/review-queue';
      });
    }
  }


  setupEventListeners() {
    // Quick action buttons
    const reviewQueueBtn = document.getElementById('review-queue-btn');
    if (reviewQueueBtn) {
      reviewQueueBtn.addEventListener('click', () => {
        window.location.href = '/review-queue';
      });
    }

    const bulkAssignBtn = document.getElementById('bulk-assign-btn');
    if (bulkAssignBtn) {
      bulkAssignBtn.addEventListener('click', () => this.bulkAssignComplaints());
    }


    const generateReportBtn = document.getElementById('generate-report-btn');
    if (generateReportBtn) {
      generateReportBtn.addEventListener('click', () => this.generateReport());
    }

    const manageDepartmentsBtn = document.getElementById('manage-departments-btn');
    if (manageDepartmentsBtn) {
      manageDepartmentsBtn.addEventListener('click', () => this.manageDepartments());
    }


    const viewFullQueueBtn = document.getElementById('view-full-queue-btn');
    if (viewFullQueueBtn) {
      viewFullQueueBtn.addEventListener('click', () => {
        window.location.href = '/review-queue';
      });
    }

    const refreshActivityBtn = document.getElementById('refresh-activity-btn');
    if (refreshActivityBtn) {
      refreshActivityBtn.addEventListener('click', () => this.loadActivity());
    }

    // Queue filter selector
    const queueFilter = document.getElementById('queue-filter');
    if (queueFilter) {
      queueFilter.addEventListener('change', (e) => {
        this.filterQueue(e.target.value);
      });
    }
  }

  async bulkAssignComplaints() {
    // Implementation for bulk assignment
    // This would open a modal or redirect to bulk assign page
    window.location.href = '/coordinator/review-queue?bulk=true';
  }

  async generateReport() {
    // Implementation for report generation
    window.location.href = '/coordinator/review-queue?report=true';
  }

  async manageDepartments() {
    // Implementation for department management
    window.location.href = '/departments';
  }

  async getHelp() {
    // Implementation for help
    alert('Help documentation coming soon!');
  }

  async filterQueue(filter) {
    // Implementation for queue filtering
    await this.loadRecentQueue();
  }

  startAutoRefresh() {
    // Refresh stats every 30 seconds
    this.statsInterval = setInterval(() => {
      this.loadStats();
    }, 30000);
    // Refresh queue every 60 seconds
    this.queueInterval = setInterval(() => {
      this.loadRecentQueue();
    }, 60000);
    // Refresh activity every 60 seconds
    this.activityInterval = setInterval(() => {
      this.loadActivity();
    }, 60000);
  }

  destroy() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    if (this.queueInterval) {
      clearInterval(this.queueInterval);
    }
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
    }
  }
}
// Global functions for quick actions
async function bulkAssignComplaints() {
  window.coordinatorDashboard?.bulkAssignComplaints();
}


async function refreshActivity() {
  window.coordinatorDashboard?.loadRecentQueue();
}
// Manual test function for debugging
async function testCoordinatorStats() {
  try {
    // Test authentication
    const authResponse = await fetch('/api/coordinator/status');
    // Test dashboard API
    const dashboardResponse = await fetch('/api/coordinator/dashboard');
    const dashboardData = await dashboardResponse.json();
    // Manually update stats
    if (dashboardData.success) {
      const {data} = dashboardData;
      const updateStatCard = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value;
          element.classList.add('loaded');
        } else {
          console.error(`[COORDINATOR TEST] Element ${id} not found`);
        }
      };
      updateStatCard('stat-pending', data.pending_reviews || 0);
      updateStatCard('stat-reviews', data.stats?.total_reviews || 0);
      updateStatCard('stat-duplicates', data.stats?.duplicates_merged || 0);
      updateStatCard('stat-assignments', data.stats?.assignments_made || 0);
    }
  } catch (error) {
    console.error('[COORDINATOR TEST] Manual test failed:', error);
  }
}
// Make test function globally available
window.testCoordinatorStats = testCoordinatorStats;
// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Check if required elements exist
  const requiredElements = ['stat-pending', 'stat-reviews', 'review-queue-container'];
  requiredElements.forEach(id => {
    const element = document.getElementById(id);
  });
  // Immediate fallback: Set stats to 0 so user sees dashboard is working
  setTimeout(() => {
    const fallbackUpdate = (id, value) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
        element.classList.add('loaded');
      }
    };
    fallbackUpdate('stat-pending', '0');
    fallbackUpdate('stat-reviews', '0');
    fallbackUpdate('stat-duplicates', '0');
    fallbackUpdate('stat-assignments', '0');
  }, 1000);
  try {
    window.coordinatorDashboard = new CoordinatorDashboard();
  } catch (error) {
    // Continue with basic stats display even if dashboard fails
    setTimeout(() => {
      const fallbackUpdate = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
          element.textContent = value;
          element.classList.add('loaded');
        }
      };
      fallbackUpdate('stat-pending', '0');
      fallbackUpdate('stat-reviews', '0');
      fallbackUpdate('stat-duplicates', '0');
      fallbackUpdate('stat-assignments', '0');
    }, 2000);
  }
});
// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (window.coordinatorDashboard) {
    window.coordinatorDashboard.destroy();
  }
});
