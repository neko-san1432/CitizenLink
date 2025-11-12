import apiClient from '../../utils/apiClient.js';
import { showToast } from '../../components/toast.js';

// Enhanced URL validation function
function validateAndSanitizeURL(urlString) {

  if (!urlString || typeof urlString !== 'string') {
    return '';
  }
  const trimmedUrl = urlString.trim();
  // Basic URL format validation
  try {
    const url = new URL(trimmedUrl);
    // Whitelist of allowed protocols
    const allowedProtocols = ['http:', 'https:', 'ftp:', 'ftps:'];
    if (!allowedProtocols.includes(url.protocol)) {
      console.warn(`[SECURITY] Disallowed protocol detected: ${url.protocol}`);
      return '';
    }
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /javascript:/i,
      /vbscript:/i,
      /data:/i,
      /file:/i,
      /about:/i,
      /chrome:/i,
      /chrome-extension:/i,
      /moz-extension:/i,
      /ms-appx:/i,
      /ms-appx-web:/i,
      /blob:/i,
      /ws:/i,
      /wss:/i
    ];
    if (suspiciousPatterns.some(pattern => pattern.test(trimmedUrl))) {
      console.warn(`[SECURITY] Suspicious URL pattern detected: ${trimmedUrl.substring(0, 100)}...`);
      return '';
    }
    // Check for protocol confusion attacks
    if (url.protocol !== `${trimmedUrl.split(':')[0]  }:`) {
      console.warn(`[SECURITY] Protocol confusion detected: ${trimmedUrl.substring(0, 100)}...`);
      return '';
    }
    // Validate hostname
    if (!url.hostname || url.hostname.length === 0) {
      return '';
    }
    // Check for private IP ranges
    const privateRanges = [
      /^127\./,
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^localhost$/i,
      /^0\.0\.0\.0$/,
      /^::1$/,
      /^fe80:/i
    ];
    if (privateRanges.some(range => range.test(url.hostname))) {
      console.warn(`[SECURITY] Private/localhost URL detected: ${url.hostname}`);
      return '';
    }
    // Return the validated URL
    return trimmedUrl;
  } catch (error) {
    // If URL constructor fails, the URL is invalid
    console.warn(`[SECURITY] Invalid URL format: ${trimmedUrl.substring(0, 100)}...`);
    return '';
  }
}
// Enhanced HTML sanitization function
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  // Use DOMPurify for comprehensive sanitization
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'b', 'i', 'u', 'br', 'hr', 'ul', 'ol', 'li', 'a', 'img'],
      ALLOWED_ATTR: ['class', 'id', 'style', 'href', 'src', 'alt', 'title', 'data-*'],
      ALLOW_DATA_ATTR: true,
      ALLOW_UNKNOWN_PROTOCOLS: false,
      SANITIZE_DOM: true,
      KEEP_CONTENT: true
    });
  }
  // Fallback sanitization if DOMPurify is not available
  // Fallback sanitization: repeatedly remove dangerous tags to prevent incomplete replacement
  let sanitized = html;
  let previous;
  do {
    previous = sanitized;
    sanitized = sanitized
      // Remove script tags and their content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove object tags
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      // Remove form tags
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
      // Remove iframe tags
      .replace(/<iframe\b[^<]*>.*?<\/iframe>/gi, '');
  } while (sanitized !== previous);
  // Now single-pass removes for other dangerous features
  return sanitized
    // Remove event handlers
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: URLs
    .replace(/javascript\s*:/gi, '')
    // Remove vbscript: URLs
    .replace(/vbscript\s*:/gi, '')
    // Remove data: URLs (except safe image types)
    .replace(/data\s*:(?!image\/(png|jpg|jpeg|gif|svg|webp))/gi, '')
    // Remove embed tags
    .replace(/<embed\b[^<]*>/gi, '')
    // Remove input tags
    .replace(/<input\b[^<]*>/gi, '')
    // Remove button tags with onclick
    .replace(/<button\b[^<]*onclick[^<]*>/gi, '<button>')
    // Remove style attributes with javascript
    .replace(/style\s*=\s*["'][^"']*javascript[^"']*["']/gi, '')
    // Remove href with javascript
    .replace(/href\s*=\s*["']javascript[^"']*["']/gi, 'href="#"')
    // Remove src with javascript
    .replace(/src\s*=\s*["']javascript[^"']*["']/gi, '');
}
// Task state
let allTasks = [];
let filteredTasks = [];
let selectedTask = null;
/**
* Initialize the task assigned page
*/
async function initTaskAssignedPage() {
  // console.log removed for security
  setupEventListeners();
  await loadTasks();
  updateStats();
}
/**
* Setup event listeners
*/
function setupEventListeners() {
  // Filter buttons
  document.getElementById('filter-all')?.addEventListener('click', () => filterTasks('all'));
  document.getElementById('filter-pending')?.addEventListener('click', () => filterTasks('pending'));
  document.getElementById('filter-in-progress')?.addEventListener('click', () => filterTasks('in_progress'));
  document.getElementById('filter-completed')?.addEventListener('click', () => filterTasks('completed'));
  // Sort dropdown
  document.getElementById('sort-by')?.addEventListener('change', (e) => {
    sortTasks(e.target.value);
  });
  // Modal close
  document.querySelector('.modal-close')?.addEventListener('click', closeTaskModal);
  document.querySelector('.modal-overlay')?.addEventListener('click', closeTaskModal);
  // Task actions
  document.getElementById('btn-accept-task')?.addEventListener('click', () => updateTaskStatus('active'));
  document.getElementById('btn-start-task')?.addEventListener('click', () => updateTaskStatus('in_progress'));
  document.getElementById('btn-complete-task')?.addEventListener('click', () => updateTaskStatus('completed'));
  document.getElementById('btn-add-update')?.addEventListener('click', showAddUpdateForm);
  document.getElementById('submit-update')?.addEventListener('click', submitProgressUpdate);
}
/**
* Load all tasks from API
*/
async function loadTasks() {
  try {
    const response = await apiClient.get('/lgu/my-tasks');
    if (response.success) {
      allTasks = response.data || [];
      filteredTasks = [...allTasks];
      renderTasks();
      updateStats();
      // console.log removed for security
    } else {
      showToast(response.error || 'Failed to load tasks', 'error');
    }
  } catch (error) {
    console.error('[TASK_ASSIGNED] Error loading tasks:', error);
    showToast('Error loading tasks', 'error');
  }
}
/**
* Filter tasks by status
*/
function filterTasks(status) {
  // Update active filter button
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`filter-${status}`)?.classList.add('active');
  if (status === 'all') {
    filteredTasks = [...allTasks];
  } else {
    filteredTasks = allTasks.filter(task => task.assignment_status === status);
  }
  renderTasks();
}
/**
* Sort tasks
*/
function sortTasks(sortBy) {

  switch (sortBy) {
    case 'deadline':
      filteredTasks.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
      break;
    case 'priority':
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      filteredTasks.sort((a, b) => {
        return priorityOrder[a.priority || 'medium'] - priorityOrder[b.priority || 'medium'];
      });
      break;
    case 'newest':
      filteredTasks.sort((a, b) => new Date(b.assigned_at) - new Date(a.assigned_at));
      break;
    case 'oldest':
      filteredTasks.sort((a, b) => new Date(a.assigned_at) - new Date(b.assigned_at));
      break;
  }
  renderTasks();
}
/**
* Render tasks to the DOM
*/
function renderTasks() {
  const container = document.getElementById('tasks-container');
  if (!container) return;
  if (filteredTasks.length === 0) {
    container.innerHTML = `
      <div class="no-tasks">
        <p>📋 No tasks found</p>
        <small>You don't have any assigned tasks at the moment.</small>
      </div>
    `;
    return;
  }
  // Use safer DOM manipulation instead of innerHTML
  container.innerHTML = '';
  const safeHtml = filteredTasks.map(task => createTaskCard(task)).join('');
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = sanitizeHtml(safeHtml);
  while (tempDiv.firstChild) {
    container.appendChild(tempDiv.firstChild);
  }
  // Add click listeners to task cards
  document.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', () => {
      const {taskId} = card.dataset;
      const task = allTasks.find(t => t.id === taskId);
      if (task) openTaskModal(task);
    });
  });
}
/**
* Create HTML for a task card
*/
function createTaskCard(task) {
  const priorityClass = `priority-${task.priority || 'medium'}`;
  const statusClass = `status-${task.assignment_status}`;
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.assignment_status !== 'completed';
  return `
    <div class="task-card ${statusClass} ${isOverdue ? 'overdue' : ''}" data-task-id="${task.id}">
      <div class="task-header">
        <div class="task-priority ${priorityClass}">
          ${getPriorityIcon(task.priority)} ${task.priority || 'medium'}
        </div>
        <div class="task-status ${statusClass}">
          ${getStatusIcon(task.assignment_status)} ${formatStatus(task.assignment_status)}
        </div>
      </div>

      <h3 class="task-title">${escapeHtml(task.complaint_title)}</h3>

      <div class="task-meta">
        <div class="task-type">
          <span class="icon">📂</span>
          <span>${formatType(task.complaint_type)}</span>
        </div>
        <div class="task-location">
          <span class="icon">📍</span>
          <span>${escapeHtml(task.complaint_location || 'No location')}</span>
        </div>
      </div>

      ${task.deadline ? `
        <div class="task-deadline ${isOverdue ? 'overdue' : ''}">
          <span class="icon">⏰</span>
          <span>Due: ${formatDate(task.deadline)}</span>
          ${isOverdue ? '<span class="overdue-badge">OVERDUE</span>' : ''}
        </div>
      ` : ''}

      <div class="task-footer">
        <small>Assigned by: ${escapeHtml(task.assigned_by_name)}</small>
        <small>Assigned: ${formatRelativeDate(task.assigned_at)}</small>
      </div>
    </div>
  `;
}

/**
* Open task detail modal
*/
function openTaskModal(task) {
  selectedTask = task;

  const modal = document.getElementById('task-modal');
  if (!modal) return;
  // Populate modal content
  document.getElementById('modal-task-title').textContent = task.complaint_title;
  document.getElementById('modal-task-description').textContent = task.complaint_description || 'No description provided';
  document.getElementById('modal-task-type').textContent = formatType(task.complaint_type);
  document.getElementById('modal-task-location').textContent = task.complaint_location || 'No location';
  document.getElementById('modal-task-priority').textContent = task.priority || 'medium';
  document.getElementById('modal-task-priority').className = `badge priority-${task.priority || 'medium'}`;
  document.getElementById('modal-task-status').textContent = formatStatus(task.assignment_status);
  document.getElementById('modal-task-status').className = `badge status-${task.assignment_status}`;
  document.getElementById('modal-assigned-by').textContent = task.assigned_by_name;
  document.getElementById('modal-assigned-date').textContent = formatDate(task.assigned_at);
  if (task.deadline) {
    document.getElementById('modal-deadline').textContent = formatDate(task.deadline);
    document.getElementById('modal-deadline-row').style.display = 'flex';
  } else {
    document.getElementById('modal-deadline-row').style.display = 'none';
  }
  if (task.notes) {
    document.getElementById('modal-notes').textContent = task.notes;
    document.getElementById('modal-notes-row').style.display = 'flex';
  } else {
    document.getElementById('modal-notes-row').style.display = 'none';
  }
  // Show/hide action buttons based on status
  updateModalActions(task.assignment_status);
  modal.classList.add('show');
}
/**
* Close task modal
*/
function closeTaskModal() {
  const modal = document.getElementById('task-modal');
  modal?.classList.remove('show');
  selectedTask = null;
  hideAddUpdateForm();
}
/**
* Update modal action buttons based on task status
*/
function updateModalActions(status) {
  const acceptBtn = document.getElementById('btn-accept-task');
  const startBtn = document.getElementById('btn-start-task');
  const completeBtn = document.getElementById('btn-complete-task');
  // Hide all by default
  acceptBtn.style.display = 'none';
  startBtn.style.display = 'none';
  completeBtn.style.display = 'none';
  switch (status) {
    case 'pending':
      acceptBtn.style.display = 'inline-block';
      break;
    case 'active':
      startBtn.style.display = 'inline-block';
      break;
    case 'in_progress':
      completeBtn.style.display = 'inline-block';
      break;
  }
}
/**
* Update task status
*/
async function updateTaskStatus(newStatus) {
  if (!selectedTask) return;
  try {
    const response = await apiClient.put(`/lgu/tasks/${selectedTask.id}/status`, {
      status: newStatus
    });
    if (response.success) {
      showToast('Task status updated successfully', 'success');
      closeTaskModal();
      await loadTasks(); // Reload tasks
    } else {
      showToast(response.error || 'Failed to update task status', 'error');
    }
  } catch (error) {
    console.error('[TASK_ASSIGNED] Error updating status:', error);
    showToast('Error updating task status', 'error');
  }
}
/**
* Show add update form
*/
function showAddUpdateForm() {
  document.getElementById('update-form').style.display = 'block';
}
/**
* Hide add update form
*/
function hideAddUpdateForm() {
  document.getElementById('update-form').style.display = 'none';
  document.getElementById('update-message').value = '';
  document.getElementById('update-public').checked = false;
}
/**
* Submit progress update
*/
async function submitProgressUpdate() {
  if (!selectedTask) return;
  const message = document.getElementById('update-message').value.trim();
  const isPublic = document.getElementById('update-public').checked;
  if (!message) {
    showToast('Please enter an update message', 'error');
    return;
  }
  try {
    const response = await apiClient.post(`/lgu/tasks/${selectedTask.id}/update`, {
      message,
      isPublic
    });
    if (response.success) {
      showToast('Progress update added successfully', 'success');
      hideAddUpdateForm();
    } else {
      showToast(response.error || 'Failed to add update', 'error');
    }
  } catch (error) {
    console.error('[TASK_ASSIGNED] Error adding update:', error);
    showToast('Error adding progress update', 'error');
  }
}
/**
* Update stats dashboard
*/
function updateStats() {
  const total = allTasks.length;
  const pending = allTasks.filter(t => t.assignment_status === 'pending').length;
  const inProgress = allTasks.filter(t => t.assignment_status === 'in_progress').length;
  const completed = allTasks.filter(t => t.assignment_status === 'completed').length;
  const overdue = allTasks.filter(t =>
    t.deadline && new Date(t.deadline) < new Date() && t.assignment_status !== 'completed'
  ).length;
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-in-progress').textContent = inProgress;
  document.getElementById('stat-completed').textContent = completed;
  document.getElementById('stat-overdue').textContent = overdue;
}
/**
* Helper functions
*/
function getPriorityIcon(priority) {
  const icons = {
    urgent: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢'
  };
  const safePriority = String(priority || '').toLowerCase();
  return icons[safePriority] || icons.medium;
}
function getStatusIcon(status) {
  const icons = {
    pending: '⏳',
    active: '✅',
    in_progress: '⚙️',
    completed: '✔️',
    cancelled: '❌'
  };
  const safeStatus = String(status || '').toLowerCase();
  return icons[safeStatus] || '📋';
}
function formatStatus(status) {
  const labels = {
    pending: 'Pending',
    active: 'Active',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };
  const safeStatus = String(status || '').toLowerCase();
  return labels[safeStatus] || status;
}
function formatType(type) {
  return type ? type.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'General';
}
function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatRelativeDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(dateString);
}
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initTaskAssignedPage);
