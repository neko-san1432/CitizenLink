/**
 * Coordinator Dashboard
 * Main dashboard for complaint review and management
 */

import showMessage from '../components/toast.js';
import apiClient from '../config/apiClient.js';

// Dashboard state
let dashboardData = null;

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

    // Render components
    renderStatistics(dashboardData);
    renderReviewQueue(dashboardData.recent_queue);
    renderClusters(dashboardData.active_clusters);

  } catch (error) {
    console.error('[COORDINATOR] Dashboard init error:', error);
    showMessage('error', 'Failed to load dashboard data');
  }
}

/**
 * Render statistics cards
 */
function renderStatistics(data) {
  document.getElementById('stat-pending').textContent = data.pending_reviews || 0;
  document.getElementById('stat-reviews').textContent = data.stats.total_reviews || 0;
  document.getElementById('stat-duplicates').textContent = data.stats.duplicates_merged || 0;
  document.getElementById('stat-assignments').textContent = data.stats.assignments_made || 0;
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', initializeDashboard);
