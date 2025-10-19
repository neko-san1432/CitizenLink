/**
 * LGU Admin - Department Assignments Page
 * View and assign complaints to officers
 */

import apiClient from '../../config/apiClient.js';
import showMessage from '../../components/toast.js';

// State
let assignments = [];
let officers = [];
let currentFilter = 'all';
let selectedComplaint = null;
const currentFilters = {
  status: 'all',
  sub_type: 'all',
  priority: 'all'
};

// Initialize page
document.addEventListener('DOMContentLoaded', async () => {
  await loadAssignments();
  await loadOfficers();
  initializeEventListeners();
});

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
  // Filter buttons (assignment status)
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      renderAssignments();
    });
  });

  // Filter selects (complaint status, type, priority)
  document.getElementById('status-filter')?.addEventListener('change', (e) => {
    currentFilters.status = e.target.value;
    loadAssignments();
  });

  document.getElementById('subtype-filter')?.addEventListener('change', (e) => {
    currentFilters.sub_type = e.target.value;
    loadAssignments();
  });

  document.getElementById('priority-filter')?.addEventListener('change', (e) => {
    currentFilters.priority = e.target.value;
    loadAssignments();
  });

  // Modal close buttons
  document.getElementById('close-assignment-modal')?.addEventListener('click', closeAssignmentModal);
  document.getElementById('cancel-assignment')?.addEventListener('click', closeAssignmentModal);

  // Assignment form
  document.getElementById('assignment-form')?.addEventListener('submit', handleAssignmentSubmit);

  // Close modal on outside click
  document.getElementById('assignment-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'assignment-modal') {
      closeAssignmentModal();
    }
  });
}

/**
 * Load department assignments
 */
async function loadAssignments() {
  try {
    showLoadingState();

    // Build query parameters
    const params = new URLSearchParams();
    if (currentFilters.status !== 'all') params.append('status', currentFilters.status);
    if (currentFilters.sub_type !== 'all') params.append('sub_type', currentFilters.sub_type);
    if (currentFilters.priority !== 'all') params.append('priority', currentFilters.priority);

    const queryString = params.toString();
    const url = queryString ? `/api/lgu-admin/department-assignments?${queryString}` : '/api/lgu-admin/department-assignments';

    const response = await apiClient.get(url);

    if (response.success) {
      assignments = response.data;
      // console.log removed for security
      updateStats();
      renderAssignments();
    } else {
      throw new Error(response.error || 'Failed to load assignments');
    }
  } catch (error) {
    console.error('Error loading assignments:', error);
    showMessage('Failed to load assignments', 'error');
    showEmptyState();
  }
}

/**
 * Load department officers
 */
async function loadOfficers() {
  try {
    // console.log removed for security
    const response = await apiClient.get('/api/lgu-admin/department-officers');

    // console.log removed for security

    if (response.success) {
      officers = response.data;
      // console.log removed for security
      populateOfficerSelect();
    } else {
      throw new Error(response.error || 'Failed to load officers');
    }
  } catch (error) {
    console.error('Error loading officers:', error);
    showMessage('Failed to load officers', 'error');
  }
}

/**
 * Update statistics
 */
function updateStats() {
  const unassigned = assignments.filter(a => !a.assigned_to).length;
  const urgent = assignments.filter(a => a.priority === 'urgent').length;
  const high = assignments.filter(a => a.priority === 'high').length;

  document.getElementById('stat-unassigned').textContent = unassigned;
  document.getElementById('stat-urgent').textContent = urgent;
  document.getElementById('stat-high').textContent = high;
}

/**
 * Render assignments list
 */
function renderAssignments() {
  const filteredAssignments = filterAssignments();

  if (filteredAssignments.length === 0) {
    showEmptyState();
    return;
  }

  showAssignmentsList();

  const listEl = document.getElementById('assignments-list');
  listEl.innerHTML = filteredAssignments.map(assignment => createAssignmentHTML(assignment)).join('');

  // Attach event listeners to assign buttons
  filteredAssignments.forEach(assignment => {
    const btn = document.querySelector(`[data-complaint-id="${assignment.complaint_id}"]`);
    if (btn) {
      // console.log removed for security
      btn.addEventListener('click', (e) => {
        // console.log removed for security
        e.preventDefault();
        openAssignmentModal(assignment);
      });
    } else {
      console.warn('[ASSIGNMENTS] Button not found for complaint:', assignment.complaint_id);
    }
  });
}

/**
 * Filter assignments based on current filter
 */
function filterAssignments() {
  switch (currentFilter) {
  case 'unassigned':
    return assignments.filter(a => !a.assigned_to);
  case 'assigned':
    return assignments.filter(a => a.assigned_to);
  default:
    return assignments;
  }
}

/**
 * Create HTML for assignment item
 */
function createAssignmentHTML(assignment) {
  const isAssigned = !!assignment.assigned_to;
  const priorityClass = `priority-${assignment.priority || 'medium'}`;
  const statusClass = isAssigned ? 'status-assigned' : 'status-unassigned';
  const statusText = isAssigned ? 'Assigned' : 'Unassigned';

  const assignedInfo = isAssigned ? `
    <div class="assigned-officer">
      <div class="officer-avatar">${getInitials(assignment.officer_name || 'Unknown')}</div>
      <div>
        <div style="font-weight: 500;">${escapeHtml(assignment.officer_name || 'Unknown Officer')}</div>
        <div style="font-size: 0.75rem; color: #a0aec0;">Assigned ${formatRelativeTime(assignment.assigned_at)}</div>
      </div>
    </div>
  ` : `
    <button class="btn-primary" data-complaint-id="${assignment.complaint_id}">
      Assign to Officer
    </button>
  `;

  return `
    <div class="assignment-item">
      <div class="assignment-header">
        <div class="assignment-title-section">
          <div class="assignment-id">#${assignment.complaint_id.slice(0, 8)}</div>
          <div class="assignment-title">${escapeHtml(assignment.title)}</div>
          <div class="assignment-meta">
            <span>📍 ${escapeHtml(assignment.location_text || 'No location')}</span>
            <span>📅 Submitted ${formatRelativeTime(assignment.submitted_at)}</span>
            <span>👤 ${escapeHtml(assignment.citizen_name || 'Unknown')}</span>
          </div>
        </div>
        <div class="assignment-actions">
          <span class="priority-badge ${priorityClass}">${assignment.priority || 'medium'}</span>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
      </div>

      <div class="assignment-details">
        ${escapeHtml(assignment.description || 'No description provided').substring(0, 200)}${assignment.description?.length > 200 ? '...' : ''}
      </div>

      <div class="assignment-footer">
        ${assignedInfo}
      </div>
    </div>
  `;
}

/**
 * Open assignment modal
 */
function openAssignmentModal(assignment) {
  // console.log removed for security
  selectedComplaint = assignment;

  // Populate complaint summary
  const summaryEl = document.getElementById('complaint-summary');
  if (!summaryEl) {
    console.error('[ASSIGNMENTS] Complaint summary element not found!');
    return;
  }

  summaryEl.innerHTML = `
    <div class="complaint-summary-title">${escapeHtml(assignment.title)}</div>
    <div class="complaint-summary-detail"><strong>ID:</strong> ${assignment.complaint_id.slice(0, 8)}</div>
    <div class="complaint-summary-detail"><strong>Location:</strong> ${escapeHtml(assignment.location_text || 'N/A')}</div>
    <div class="complaint-summary-detail"><strong>Submitted:</strong> ${new Date(assignment.submitted_at).toLocaleString()}</div>
    <div class="complaint-summary-detail"><strong>Priority:</strong> ${assignment.priority || 'medium'}</div>
  `;

  // Set default deadline (3 days from now)
  const defaultDeadline = new Date();
  defaultDeadline.setDate(defaultDeadline.getDate() + 3);
  const deadlineInput = document.getElementById('deadline-input');
  if (deadlineInput) {
    deadlineInput.value = formatDateTimeLocal(defaultDeadline);
  } else {
    console.warn('[ASSIGNMENTS] Deadline input not found');
  }

  // Set priority from complaint
  const prioritySelect = document.getElementById('priority-select');
  if (prioritySelect) {
    prioritySelect.value = assignment.priority || 'medium';
  } else {
    console.warn('[ASSIGNMENTS] Priority select not found');
  }

  // Show modal
  const modal = document.getElementById('assignment-modal');
  if (modal) {
    modal.style.display = 'flex';
    // console.log removed for security
  } else {
    console.error('[ASSIGNMENTS] Assignment modal not found!');
  }
}

/**
 * Close assignment modal
 */
function closeAssignmentModal() {
  document.getElementById('assignment-modal').style.display = 'none';
  document.getElementById('assignment-form').reset();
  selectedComplaint = null;
}

/**
 * Handle assignment form submission
 */
async function handleAssignmentSubmit(e) {
  e.preventDefault();

  if (!selectedComplaint) {
    showMessage('No complaint selected', 'error');
    return;
  }

  const officerId = document.getElementById('officer-select').value;
  const priority = document.getElementById('priority-select').value;
  const deadline = document.getElementById('deadline-input').value;
  const notes = document.getElementById('notes-input').value;

  if (!officerId) {
    showMessage('Please select an officer', 'error');
    return;
  }

  try {
    const response = await apiClient.post('/api/lgu-admin/assign-complaint', {
      complaintId: selectedComplaint.complaint_id,
      officerId,
      priority,
      deadline: new Date(deadline).toISOString(),
      notes
    });

    if (response.success) {
      showMessage('Complaint assigned successfully', 'success');
      closeAssignmentModal();
      await loadAssignments(); // Reload to show updated assignments
    } else {
      throw new Error(response.error || 'Failed to assign complaint');
    }
  } catch (error) {
    console.error('Error assigning complaint:', error);
    showMessage(error.message || 'Failed to assign complaint', 'error');
  }
}

/**
 * Populate officer select dropdown
 */
function populateOfficerSelect() {
  // console.log removed for security
  const select = document.getElementById('officer-select');

  if (!select) {
    console.error('[ASSIGNMENTS] Officer select element not found!');
    return;
  }

  if (!officers || officers.length === 0) {
    console.warn('[ASSIGNMENTS] No officers available');
    select.innerHTML = '<option value="">-- No officers available --</option>';
    return;
  }

  select.innerHTML = '<option value="">-- Select an officer --</option>' +
    officers.map(officer => `
      <option value="${officer.id}">${escapeHtml(officer.name)} ${officer.employee_id ? `(${officer.employee_id})` : ''}</option>
    `).join('');

  // console.log removed for security
}

/**
 * UI State Management
 */
function showLoadingState() {
  document.getElementById('loading-state').style.display = 'block';
  document.getElementById('assignments-list').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';
}

function showAssignmentsList() {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('assignments-list').style.display = 'block';
  document.getElementById('empty-state').style.display = 'none';
}

function showEmptyState() {
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('assignments-list').style.display = 'none';
  document.getElementById('empty-state').style.display = 'block';
}

/**
 * Helper Functions
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getInitials(name) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

function formatRelativeTime(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now - time;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return time.toLocaleDateString();
}

function formatDateTimeLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
