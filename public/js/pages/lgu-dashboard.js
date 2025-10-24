/**
 * LGU Dashboard
 * Comprehensive dashboard for LGU officers with task management and statistics
 */

import showMessage from '../components/toast.js';
import { initializeRoleToggle } from '../auth/roleToggle.js';

// Dashboard state
let dashboardData = null;

/**
 * Initialize dashboard
 */
document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboardData();
  await loadMyTasks();
  await loadStatistics();
  await loadActivities();
  await loadUpdates();
  setupEventListeners();
  
  // Initialize role switcher for staff members
  try {
    await initializeRoleToggle();
  } catch (error) {
    console.error('[LGU_DASHBOARD] Error initializing role toggle:', error);
  }
});

/**
 * Load dashboard data
 */
async function loadDashboardData() {
  try {
    // Load all dashboard components
    await Promise.all([
      loadStatistics(),
      loadActivities(),
      loadUpdates()
    ]);
  } catch (error) {
    console.error('[LGU_DASHBOARD] Load dashboard error:', error);
    showMessage('error', 'Failed to load dashboard data');
  }
}

/**
 * Load my tasks
 */
async function loadMyTasks() {
  try {
    const response = await fetch('/api/lgu/tasks?limit=5');
    const result = await response.json();

    if (result.success) {
      renderMyTasks(result.data || []);
    } else {
      renderMyTasks([]);
    }
  } catch (error) {
    console.error('[LGU_DASHBOARD] Load tasks error:', error);
    renderMyTasks([]);
  }
}

/**
 * Load statistics
 */
async function loadStatistics() {
  try {
    const response = await fetch('/api/lgu/statistics');
    const result = await response.json();

    if (result.success) {
      renderStatistics(result.data);
    } else {
      renderStatistics({});
    }
  } catch (error) {
    console.error('[LGU_DASHBOARD] Load statistics error:', error);
    renderStatistics({});
  }
}

/**
 * Load activities
 */
async function loadActivities() {
  try {
    const response = await fetch('/api/lgu/activities?limit=5');
    const result = await response.json();

    if (result.success) {
      renderActivities(result.data || []);
    } else {
      renderActivities([]);
    }
  } catch (error) {
    console.error('[LGU_DASHBOARD] Load activities error:', error);
    renderActivities([]);
  }
}

/**
 * Load updates
 */
async function loadUpdates() {
  try {
    const response = await fetch('/api/lgu/updates?limit=5');
    const result = await response.json();

    if (result.success) {
      renderUpdates(result.data || []);
    } else {
      renderUpdates([]);
    }
  } catch (error) {
    console.error('[LGU_DASHBOARD] Load updates error:', error);
    renderUpdates([]);
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
  document.getElementById('stat-total-tasks').textContent = stats.total_tasks || 0;
  document.getElementById('stat-pending-tasks').textContent = stats.pending_tasks || 0;
  document.getElementById('stat-completed-tasks').textContent = stats.completed_tasks || 0;
  document.getElementById('stat-efficiency').textContent = stats.efficiency_rate || '0%';
}

/**
 * Render activities
 */
function renderActivities(activities) {
  const container = document.getElementById('activities-container');
  if (!container) return;

  if (activities.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <p>No recent activities</p>
      </div>
    `;
    return;
  }

  const html = activities.map(activity => `
    <div class="activity-item">
      <div class="activity-icon">${getActivityIcon(activity.type)}</div>
      <div class="activity-content">
        <div class="activity-text">${escapeHtml(activity.description)}</div>
        <div class="activity-time">${formatDate(activity.created_at)}</div>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
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
        <div class="empty-state-icon">📢</div>
        <p>No department updates</p>
      </div>
    `;
    return;
  }

  const html = updates.map(update => `
    <div class="update-item">
      <div class="update-header">
        <h4 class="update-title">${escapeHtml(update.title)}</h4>
        <span class="update-priority priority-${update.priority}">${update.priority}</span>
      </div>
      <div class="update-content">
        <p>${escapeHtml(update.content)}</p>
        <div class="update-meta">
          <span class="update-author">By: ${escapeHtml(update.author)}</span>
          <span class="update-date">${formatDate(update.created_at)}</span>
        </div>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Add any additional event listeners here
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
  const textMap = {
    'assigned': 'Assigned',
    'in_progress': 'In Progress',
    'review': 'Under Review',
    'completed': 'Completed',
    'cancelled': 'Cancelled'
  };
  return textMap[status] || 'Unknown';
}

function getActivityIcon(type) {
  const iconMap = {
    'task_assigned': '📋',
    'task_completed': '✅',
    'task_updated': '📝',
    'note_added': '📄',
    'status_changed': '🔄',
    'deadline_approaching': '⏰',
    'general': '📢'
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
window.refreshDashboard = async function() {
  showMessage('info', 'Refreshing dashboard...');
  await loadDashboardData();
  await loadMyTasks();
  showMessage('success', 'Dashboard refreshed');
};

window.viewAllTasks = function() {
  window.location.href = '/lgu-officer/task-assigned';
};

window.refreshTasks = async function() {
  showMessage('info', 'Refreshing tasks...');
  await loadMyTasks();
  showMessage('success', 'Tasks refreshed');
};

window.refreshActivities = async function() {
  showMessage('info', 'Refreshing activities...');
  await loadActivities();
  showMessage('success', 'Activities refreshed');
};

window.refreshUpdates = async function() {
  showMessage('info', 'Refreshing updates...');
  await loadUpdates();
  showMessage('success', 'Updates refreshed');
};

window.viewTaskDetail = function(taskId) {
  window.location.href = `/lgu-officer/task-detail?id=${taskId}`;
};

window.updateTask = function(taskId) {
  showMessage('info', 'Opening task update form...');
  // TODO: Implement task update modal
};

window.addNote = function(taskId) {
  showMessage('info', 'Opening note form...');
  // TODO: Implement note addition modal
};

window.updateTaskStatus = function() {
  showMessage('info', 'Task status update feature coming soon');
};

window.addTaskNote = function() {
  showMessage('info', 'Add note feature coming soon');
};

window.viewReports = function() {
  showMessage('info', 'Reports feature coming soon');
};

window.contactSupervisor = function() {
  showMessage('info', 'Contact supervisor feature coming soon');
};
