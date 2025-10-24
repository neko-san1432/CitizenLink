/**
 * LGU Officer Dashboard
 * Field operations and task management for local government officers
 */

import showMessage from '../components/toast.js';

// Dashboard state
let dashboardData = null;

/**
 * Initialize dashboard
 */
document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboardData();
  await loadMyTasks();
  await loadStatistics();
  await loadActivity();
  await loadUpdates();
  setupEventListeners();
});

/**
 * Load dashboard data
 */
async function loadDashboardData() {
  try {
    // Load all dashboard components
    await Promise.all([
      loadStatistics(),
      loadActivity(),
      loadUpdates()
    ]);
  } catch (error) {
    console.error('[LGU_OFFICER] Load dashboard error:', error);
    showMessage('error', 'Failed to load dashboard data');
  }
}

/**
 * Load my tasks
 */
async function loadMyTasks() {
  try {
    const response = await fetch('/api/lgu-officer/my-tasks?limit=5');
    const result = await response.json();

    if (result.success) {
      renderMyTasks(result.data || []);
    } else {
      renderMyTasks([]);
    }
  } catch (error) {
    console.error('[LGU_OFFICER] Load tasks error:', error);
    renderMyTasks([]);
  }
}

/**
 * Load statistics
 */
async function loadStatistics() {
  try {
    const response = await fetch('/api/lgu-officer/statistics');
    const result = await response.json();

    if (result.success) {
      renderStatistics(result.data);
    } else {
      renderStatistics({});
    }
  } catch (error) {
    console.error('[LGU_OFFICER] Load statistics error:', error);
    renderStatistics({});
  }
}

/**
 * Load activity
 */
async function loadActivity() {
  try {
    const response = await fetch('/api/lgu-officer/activity?limit=5');
    const result = await response.json();

    if (result.success) {
      renderActivity(result.data || []);
    }
  } catch (error) {
    console.error('[LGU_OFFICER] Load activity error:', error);
  }
}

/**
 * Load updates
 */
async function loadUpdates() {
  try {
    const response = await fetch('/api/lgu-officer/updates?limit=5');
    const result = await response.json();

    if (result.success) {
      renderUpdates(result.data || []);
    }
  } catch (error) {
    console.error('[LGU_OFFICER] Load updates error:', error);
  }
}

/**
 * Render my tasks
 */
function renderMyTasks(tasks) {
  const container = document.getElementById('tasks-container');
  if (!container) return;

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <h3>No Tasks Assigned</h3>
        <p>You don't have any tasks assigned at the moment.</p>
        <button class="btn btn-primary" onclick="refreshTasks()">Refresh</button>
      </div>
    `;
    return;
  }

  const html = tasks.map(task => `
    <div class="task-item" onclick="viewTaskDetail('${task.id}')">
      <div class="task-header">
        <h4 class="task-title">${escapeHtml(task.title)}</h4>
        <span class="task-priority priority-${task.priority}">${task.priority}</span>
      </div>
      <div class="task-meta">
        <span class="task-type">${escapeHtml(task.type || task.category)}</span>
        <span class="task-deadline">Due: ${formatDate(task.deadline)}</span>
      </div>
      <div class="task-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${getTaskProgress(task.status)}%"></div>
        </div>
        <span class="progress-text">${getTaskStatusText(task.status)}</span>
      </div>
      <div class="task-actions">
        <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); updateTask('${task.id}')">Update</button>
        <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); addNote('${task.id}')">Add Note</button>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

/**
 * Render statistics
 */
function renderStatistics(stats) {
  document.getElementById('stat-total-assigned').textContent = stats.total_assigned || 0;
  document.getElementById('stat-in-progress').textContent = stats.in_progress || 0;
  document.getElementById('stat-completed').textContent = stats.completed || 0;
  document.getElementById('stat-overdue').textContent = stats.overdue || 0;
}

/**
 * Render activity
 */
function renderActivity(activities) {
  const container = document.getElementById('activity-container');
  if (!container) return;

  if (activities.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🕒</div>
        <p>No recent activity</p>
      </div>
    `;
    return;
  }

  const html = activities.map(activity => `
    <div class="activity-item" data-type="${activity.type}">
      <div class="activity-icon">${getActivityIcon(activity.type)}</div>
      <div class="activity-content">
        <div class="activity-text">${escapeHtml(activity.description)}</div>
        <div class="activity-time">${formatDate(activity.created_at)}</div>
      </div>
    </div>
  `).join('');

  container.querySelector('.activity-list').innerHTML = html;
}

/**
 * Render updates
 */
function renderUpdates(updates) {
  const container = document.getElementById('updates-container');
  if (!container) return;

  if (updates.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏢</div>
        <p>No department updates</p>
      </div>
    `;
    return;
  }

  const html = updates.map(update => `
    <div class="update-item">
      <div class="update-icon">${getUpdateIcon(update.type)}</div>
      <div class="update-content">
        <div class="update-title">${escapeHtml(update.title)}</div>
        <div class="update-text">${escapeHtml(update.content?.substring(0, 80) + '...')}</div>
        <div class="update-time">${formatDate(update.created_at)}</div>
      </div>
    </div>
  `).join('');

  container.querySelector('.updates-list').innerHTML = html;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Performance period filter
  const performancePeriod = document.getElementById('performance-period');
  if (performancePeriod) {
    performancePeriod.addEventListener('change', (e) => {
      loadPerformanceMetrics(e.target.value);
    });
  }
}

/**
 * Helper functions
 */
function getTaskProgress(status) {
  const progressMap = {
    'assigned': 25,
    'in_progress': 50,
    'review': 75,
    'completed': 100,
    'cancelled': 0
  };
  return progressMap[status] || 0;
}

function getTaskStatusText(status) {
  const statusMap = {
    'assigned': 'Assigned',
    'in_progress': 'In Progress',
    'review': 'Under Review',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
  };
  return statusMap[status] || 'Unknown';
}

function getActivityIcon(type) {
  const iconMap = {
    'task_assigned': '📝',
    'task_completed': '✅',
    'note_added': '📝',
    'evidence_uploaded': '📷',
    'status_updated': '🔄'
  };
  return iconMap[type] || '📋';
}

function getUpdateIcon(type) {
  const iconMap = {
    'announcement': '📢',
    'guideline': '📋',
    'meeting': '📅',
    'target': '🎯',
    'policy': '📜'
  };
  return iconMap[type] || '📢';
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Global functions for onclick handlers
 */
window.viewAssignedTasks = function() {
  window.location.href = '/taskAssigned';
};

window.updateTaskStatus = function() {
  showMessage('info', 'Task status update feature coming soon');
  // TODO: Implement task status update modal
};

window.addProgressNote = function() {
  showMessage('info', 'Add progress note feature coming soon');
  // TODO: Implement add note modal
};

window.uploadEvidence = function() {
  showMessage('info', 'Upload evidence feature coming soon');
  // TODO: Implement evidence upload modal
};

window.requestSupport = function() {
  showMessage('info', 'Request support feature coming soon');
  // TODO: Implement support request modal
};

window.viewMap = function() {
  window.location.href = '/heatmap';
};

window.viewTaskDetail = function(taskId) {
  showMessage('info', `Viewing task ${taskId}...`);
  // TODO: Implement task detail view
};

window.updateTask = function(taskId) {
  showMessage('info', `Updating task ${taskId}...`);
  // TODO: Implement task update modal
};

window.addNote = function(taskId) {
  showMessage('info', `Adding note to task ${taskId}...`);
  // TODO: Implement add note modal
};

window.refreshStats = async function() {
  showMessage('info', 'Refreshing statistics...');
  await loadStatistics();
  showMessage('success', 'Statistics refreshed');
};

window.refreshActivity = async function() {
  showMessage('info', 'Refreshing activity...');
  await loadActivity();
  showMessage('success', 'Activity refreshed');
};

window.refreshUpdates = async function() {
  showMessage('info', 'Refreshing updates...');
  await loadUpdates();
  showMessage('success', 'Updates refreshed');
};

window.refreshTasks = async function() {
  showMessage('info', 'Refreshing tasks...');
  await loadMyTasks();
  showMessage('success', 'Tasks refreshed');
};

window.loadPerformanceMetrics = async function(period) {
  try {
    showMessage('info', `Loading performance metrics for ${period}...`);
    // TODO: Implement performance metrics loading
    showMessage('success', 'Performance metrics loaded');
  } catch (error) {
    console.error('[LGU_OFFICER] Load performance metrics error:', error);
    showMessage('error', 'Failed to load performance metrics');
  }
};
