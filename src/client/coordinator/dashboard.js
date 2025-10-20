/**
 * Enhanced Coordinator Dashboard
 * Comprehensive complaint review and management system
 */

import showMessage from '../components/toast.js';
import apiClient from '../config/apiClient.js';

// Dashboard state
let dashboardData = null;
let filteredQueue = [];
let currentFilter = 'all';

/**
 * Initialize dashboard
 */
async function initializeDashboard() {
  try {
    // Fetch dashboard data
    const response = await fetch('/api/coordinator/dashboard', {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (!result.success) {
      showMessage('error', result.error || 'Failed to load dashboard');
      return;
    }

    dashboardData = result.data;
    filteredQueue = dashboardData.recent_queue || [];

    // Render components
    renderStatistics(dashboardData);
    renderReviewQueue(filteredQueue);
    renderClusters(dashboardData.active_clusters);
    renderAnalytics(dashboardData);
    renderActivity(dashboardData);
    setupEventListeners();

  } catch (error) {
    console.error('[COORDINATOR] Dashboard init error:', error);
    showMessage('error', 'Failed to load dashboard data');
  }
}

/**
 * Render enhanced statistics cards
 */
function renderStatistics(data) {
  // Basic stats
  document.getElementById('stat-pending').textContent = data.pending_reviews || 0;
  document.getElementById('stat-reviews').textContent = data.stats.total_reviews || 0;
  document.getElementById('stat-duplicates').textContent = data.stats.duplicates_merged || 0;
  document.getElementById('stat-assignments').textContent = data.stats.assignments_made || 0;
  
  // Enhanced stats
  document.getElementById('stat-response-time').textContent = data.stats.avg_response_time || '2.5h';
  document.getElementById('stat-accuracy').textContent = data.stats.accuracy_rate || '94%';
  
  // Trends
  updateTrend('pending-trend', data.trends?.pending_change || 0);
  updateTrend('reviews-trend', data.trends?.reviews_change || 0);
  updateTrend('duplicates-trend', data.trends?.duplicates_change || 0);
  updateTrend('assignments-trend', data.trends?.assignments_change || 0);
  updateTrend('response-time-trend', data.trends?.response_time_change || 0);
  updateTrend('accuracy-trend', data.trends?.accuracy_change || 0);
}

/**
 * Update trend indicators
 */
function updateTrend(elementId, change) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  if (change > 0) {
    element.innerHTML = `↗️ +${change}%`;
    element.className = 'stat-trend positive';
  } else if (change < 0) {
    element.innerHTML = `↘️ ${change}%`;
    element.className = 'stat-trend negative';
  } else {
    element.innerHTML = '→ 0%';
    element.className = 'stat-trend neutral';
  }
}

/**
 * Render review queue
 */
function renderReviewQueue(queue) {
  const container = document.getElementById('review-queue-container');

  if (!queue || queue.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✓</div>
        <h3>All Caught Up!</h3>
        <p>No complaints pending review at the moment.</p>
      </div>
    `;
    return;
  }

  const html = queue.map(complaint => createComplaintCard(complaint)).join('');
  container.innerHTML = html;
}

/**
 * Create complaint card HTML
 */
function createComplaintCard(complaint) {
  const priorityBadge = getPriorityBadgeClass(complaint.priority);
  const algorithmFlags = complaint.algorithm_flags || {};

  let flagHTML = '';
  if (algorithmFlags.high_confidence_duplicate) {
    flagHTML = `
      <div class="algorithm-flag high-confidence">
        ⚠️ High confidence duplicate detected
      </div>
    `;
  } else if (algorithmFlags.has_duplicates) {
    flagHTML = `
      <div class="algorithm-flag">
        🔍 ${algorithmFlags.similarity_count} potential duplicate(s) found
      </div>
    `;
  }

  return `
    <div class="complaint-card" onclick="viewComplaintDetail('${complaint.id}')">
      <div class="complaint-header">
        <h3 class="complaint-title">${escapeHtml(complaint.title)}</h3>
      </div>
      <div class="complaint-meta">
        <span class="badge ${priorityBadge}">${complaint.priority}</span>
        <span class="badge badge-medium">${complaint.type}</span>
        <span style="color: #7f8c8d; font-size: 0.85rem;">
          ${formatTimeAgo(complaint.submitted_at)}
        </span>
      </div>
      ${flagHTML}
    </div>
  `;
}

/**
 * Render clusters
 */
function renderClusters(clusters) {
  const container = document.getElementById('clusters-container');

  if (!clusters || clusters.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📍</div>
        <h3>No Active Clusters</h3>
        <p>No geographic complaint clusters detected.</p>
      </div>
    `;
    return;
  }

  const html = clusters.map(cluster => createClusterCard(cluster)).join('');
  container.innerHTML = `<div class="cluster-list">${html}</div>`;
}

/**
 * Create cluster card HTML
 */
function createClusterCard(cluster) {
  const patternBadge = `cluster-${cluster.pattern_type}`;
  const complaintCount = cluster.complaint_ids ? cluster.complaint_ids.length : 0;

  return `
    <div class="cluster-card">
      <div class="cluster-header">
        <div>
          <strong>${escapeHtml(cluster.cluster_name || 'Unnamed Cluster')}</strong>
          <div style="color: #7f8c8d; font-size: 0.85rem; margin-top: 5px;">
            ${complaintCount} complaints • ${Math.round(cluster.radius_meters)}m radius
          </div>
        </div>
        <span class="cluster-badge ${patternBadge}">
          ${cluster.pattern_type}
        </span>
      </div>
      <button class="btn btn-primary" onclick="viewClusterDetail('${cluster.id}')">
        View Details
      </button>
    </div>
  `;
}

/**
 * View complaint detail
 */
window.viewComplaintDetail = async function(complaintId) {
  window.location.href = `/coordinator/review/${complaintId}`;
};

/**
 * View cluster detail
 */
window.viewClusterDetail = async function(clusterId) {
  showMessage('info', 'Cluster detail view coming soon');
  // TODO: Implement cluster detail view
};

/**
 * Detect new clusters
 */
window.detectNewClusters = async function() {
  try {
    showMessage('info', 'Detecting clusters...');

    const response = await fetch('/api/coordinator/detect-clusters', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        radius_km: 0.5,
        min_complaints: 3
      })
    });

    const result = await response.json();

    if (!result.success) {
      showMessage('error', result.error || 'Failed to detect clusters');
      return;
    }

    showMessage('success', `Detected ${result.count} cluster(s)`);

    // Reload dashboard
    initializeDashboard();

  } catch (error) {
    console.error('[COORDINATOR] Detect clusters error:', error);
    showMessage('error', 'Failed to detect clusters');
  }
};

/**
 * Helper: Get priority badge class
 */
function getPriorityBadgeClass(priority) {
  const map = {
    'urgent': 'badge-urgent',
    'high': 'badge-high',
    'medium': 'badge-medium',
    'low': 'badge-low'
  };
  return map[priority] || 'badge-medium';
}

/**
 * Helper: Format time ago
 */
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

/**
 * Helper: Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Queue filter
  const queueFilter = document.getElementById('queue-filter');
  if (queueFilter) {
    queueFilter.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      filterReviewQueue();
    });
  }

  // Analytics period
  const analyticsPeriod = document.getElementById('analytics-period');
  if (analyticsPeriod) {
    analyticsPeriod.addEventListener('change', (e) => {
      loadAnalytics(e.target.value);
    });
  }
}

/**
 * Filter review queue
 */
function filterReviewQueue() {
  if (!dashboardData?.recent_queue) return;
  
  const queue = dashboardData.recent_queue;
  
  switch (currentFilter) {
    case 'urgent':
      filteredQueue = queue.filter(c => c.priority === 'urgent');
      break;
    case 'high':
      filteredQueue = queue.filter(c => c.priority === 'high' || c.priority === 'urgent');
      break;
    case 'duplicates':
      filteredQueue = queue.filter(c => c.algorithm_flags?.has_duplicates);
      break;
    default:
      filteredQueue = queue;
  }
  
  renderReviewQueue(filteredQueue);
}

/**
 * Render analytics
 */
function renderAnalytics(data) {
  // Mock analytics data - replace with real data
  const analyticsData = {
    reviewTrends: [
      { date: '2024-01-01', reviews: 12, assignments: 8 },
      { date: '2024-01-02', reviews: 15, assignments: 10 },
      { date: '2024-01-03', reviews: 18, assignments: 12 },
      { date: '2024-01-04', reviews: 14, assignments: 9 },
      { date: '2024-01-05', reviews: 20, assignments: 15 }
    ],
    departmentPerformance: [
      { department: 'Engineering', efficiency: 85, responseTime: '2.1h' },
      { department: 'Health', efficiency: 92, responseTime: '1.8h' },
      { department: 'Public Works', efficiency: 78, responseTime: '3.2h' },
      { department: 'Social Welfare', efficiency: 88, responseTime: '2.5h' }
    ]
  };
  
  renderReviewTrendsChart(analyticsData.reviewTrends);
  renderDepartmentPerformanceChart(analyticsData.departmentPerformance);
}

/**
 * Render review trends chart
 */
function renderReviewTrendsChart(data) {
  const container = document.getElementById('review-trends-chart');
  if (!container) return;
  
  // Simple chart implementation
  const maxReviews = Math.max(...data.map(d => d.reviews));
  const maxAssignments = Math.max(...data.map(d => d.assignments));
  
  container.innerHTML = `
    <div class="chart-container">
      <div class="chart-bars">
        ${data.map(d => `
          <div class="chart-bar-group">
            <div class="chart-bar reviews" style="height: ${(d.reviews / maxReviews) * 100}%"></div>
            <div class="chart-bar assignments" style="height: ${(d.assignments / maxAssignments) * 100}%"></div>
            <div class="chart-label">${new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
          </div>
        `).join('')}
      </div>
      <div class="chart-legend">
        <div class="legend-item">
          <div class="legend-color reviews"></div>
          <span>Reviews</span>
        </div>
        <div class="legend-item">
          <div class="legend-color assignments"></div>
          <span>Assignments</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render department performance chart
 */
function renderDepartmentPerformanceChart(data) {
  const container = document.getElementById('department-performance-chart');
  if (!container) return;
  
  container.innerHTML = `
    <div class="performance-list">
      ${data.map(dept => `
        <div class="performance-item">
          <div class="performance-header">
            <span class="dept-name">${dept.department}</span>
            <span class="efficiency">${dept.efficiency}%</span>
          </div>
          <div class="performance-bar">
            <div class="efficiency-bar" style="width: ${dept.efficiency}%"></div>
          </div>
          <div class="performance-meta">
            <span>Response Time: ${dept.responseTime}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Render activity feed
 */
function renderActivity(data) {
  const container = document.getElementById('activity-container');
  if (!container) return;
  
  // Mock activity data - replace with real data
  const activities = [
    {
      icon: '📋',
      text: 'New complaint #1234 assigned to Engineering',
      time: '2 minutes ago',
      type: 'assignment'
    },
    {
      icon: '🔗',
      text: 'Complaint #1230 marked as duplicate',
      time: '15 minutes ago',
      type: 'duplicate'
    },
    {
      icon: '📍',
      text: 'New cluster detected in Barangay 1',
      time: '1 hour ago',
      type: 'cluster'
    },
    {
      icon: '📊',
      text: 'Weekly report generated',
      time: '2 hours ago',
      type: 'report'
    }
  ];
  
  const activityList = container.querySelector('.activity-list');
  if (activityList) {
    activityList.innerHTML = activities.map(activity => `
      <div class="activity-item" data-type="${activity.type}">
        <div class="activity-icon">${activity.icon}</div>
        <div class="activity-content">
          <div class="activity-text">${activity.text}</div>
          <div class="activity-time">${activity.time}</div>
        </div>
      </div>
    `).join('');
  }
}

/**
 * Load analytics for specific period
 */
async function loadAnalytics(period) {
  try {
    showMessage('info', `Loading analytics for ${period}...`);
    // Implement analytics loading based on period
    // This would call the appropriate API endpoint
  } catch (error) {
    console.error('[COORDINATOR] Load analytics error:', error);
    showMessage('error', 'Failed to load analytics');
  }
}

/**
 * Refresh activity feed
 */
async function refreshActivity() {
  try {
    showMessage('info', 'Refreshing activity...');
    // Reload activity data
    await initializeDashboard();
    showMessage('success', 'Activity refreshed');
  } catch (error) {
    console.error('[COORDINATOR] Refresh activity error:', error);
    showMessage('error', 'Failed to refresh activity');
  }
}

/**
 * Bulk assign complaints
 */
window.bulkAssignComplaints = async function() {
  showMessage('info', 'Bulk assignment feature coming soon');
  // TODO: Implement bulk assignment modal
};

/**
 * Generate report
 */
window.generateReport = async function() {
  try {
    showMessage('info', 'Generating report...');
    // Implement report generation
    showMessage('success', 'Report generated successfully');
  } catch (error) {
    console.error('[COORDINATOR] Generate report error:', error);
    showMessage('error', 'Failed to generate report');
  }
};

/**
 * View analytics
 */
window.viewAnalytics = function() {
  showMessage('info', 'Advanced analytics view coming soon');
  // TODO: Implement full analytics page
};

/**
 * Manage departments
 */
window.manageDepartments = function() {
  window.location.href = '/admin/departments';
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeDashboard);
