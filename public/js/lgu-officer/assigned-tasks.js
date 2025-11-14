// LGU Officer Assigned Tasks JavaScript
import showToast from '../components/toast.js';
import BarangayPrioritization from '../components/barangay-prioritization.js';

class AssignedTasks {

  constructor() {
    this.tasks = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.filters = {
      status: '',
      priority: '',
      urgency: '',
      prioritization: '',
      search: ''
    };
    this.barangayPrioritization = null;
    this.barangayPrioritizationComponent = null;
    this.init();
  }
  init() {
    this.setupEventListeners();
    this.loadTasks();
    this.initBarangayPrioritization();
  }

  async initBarangayPrioritization() {
    this.barangayPrioritizationComponent = new BarangayPrioritization('barangay-prioritization-container');
    await this.barangayPrioritizationComponent.loadInsights();
    // Build barangay prioritization map for sorting
    if (this.barangayPrioritizationComponent.insightsData) {
      this.barangayPrioritization = this.buildBarangayMap(this.barangayPrioritizationComponent.insightsData.barangays);
      this.enhanceTasksWithPrioritization();
    }
  }

  buildBarangayMap(barangays) {
    const map = new Map();
    barangays.forEach(barangay => {
      map.set(barangay.barangay, barangay.prioritizationScore);
    });
    return map;
  }

  enhanceTasksWithPrioritization() {
    if (!this.barangayPrioritization) return;

    // Enhance each task with its barangay prioritization score
    this.tasks.forEach(task => {
      // Get barangay from complaint location or use a default
      const barangay = task.complaint?.barangay || this.getBarangayFromLocation(task.complaint?.location_text);
      if (barangay && this.barangayPrioritization.has(barangay)) {
        task.prioritizationScore = this.barangayPrioritization.get(barangay);
      } else {
        task.prioritizationScore = 0;
      }
    });
  }

  getBarangayFromLocation(locationText) {
    // Try to extract barangay from location text
    if (!locationText) return null;
    const barangays = [
      'Aplaya', 'Balabag', 'Binaton', 'Cogon', 'Colorado', 'Dawis', 'Dulangan',
      'Goma', 'Igpit', 'Kiagot', 'Lungag', 'Mahayahay', 'Matti', 'Kapatagan (Rizal)',
      'Ruparan', 'San Agustin', 'San Jose (Balutakay)', 'San Miguel (Odaca)',
      'San Roque', 'Sinawilan', 'Soong', 'Tiguman', 'Tres de Mayo',
      'Zone 1 (Pob.)', 'Zone 2 (Pob.)', 'Zone 3 (Pob.)'
    ];
    for (const barangay of barangays) {
      if (locationText.toLowerCase().includes(barangay.toLowerCase())) {
        return barangay;
      }
    }
    return null;
  }
  setupEventListeners() {
    // Filter controls
    const statusFilter = document.getElementById('status-filter');
    const priorityFilter = document.getElementById('priority-filter');
    const urgencyFilter = document.getElementById('urgency-filter');
    const prioritizationFilter = document.getElementById('prioritization-filter');
    const searchInput = document.getElementById('search-input');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.filters.status = e.target.value;
        this.currentPage = 1;
        this.renderTasks();
      });
    }
    if (priorityFilter) {
      priorityFilter.addEventListener('change', (e) => {
        this.filters.priority = e.target.value;
        this.currentPage = 1;
        this.renderTasks();
      });
    }
    if (urgencyFilter) {
      urgencyFilter.addEventListener('change', (e) => {
        this.filters.urgency = e.target.value;
        this.currentPage = 1;
        this.renderTasks();
      });
    }
    if (prioritizationFilter) {
      prioritizationFilter.addEventListener('change', (e) => {
        this.filters.prioritization = e.target.value;
        this.currentPage = 1;
        this.renderTasks();
      });
    }
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.currentPage = 1;
        this.debounce(() => this.renderTasks(), 300)();
      });
    }
    // Modal controls
    this.setupModalEventListeners();
  }
  setupModalEventListeners() {
    const modal = document.getElementById('resolution-modal');
    const closeBtn = modal?.querySelector('.modal-close');
    const cancelBtn = document.getElementById('cancel-resolution');
    const confirmBtn = document.getElementById('confirm-resolution');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideModal());
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.hideModal());
    }
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.confirmResolution());
    }
    // Close modal on overlay click
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hideModal();
        }
      });
    }
  }
  async loadTasks() {
    try {
      this.showLoading();
      const queryParams = new URLSearchParams();
      if (this.filters.status) queryParams.append('status', this.filters.status);
      if (this.filters.priority) queryParams.append('priority', this.filters.priority);
      if (this.filters.search) queryParams.append('search', this.filters.search);
      queryParams.append('limit', this.itemsPerPage);
      const response = await fetch(`/api/lgu/assigned-tasks?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load tasks');
      }
      this.tasks = data.data || [];

      // Enhance tasks with prioritization if available
      if (this.barangayPrioritization) {
        this.enhanceTasksWithPrioritization();
      }

      this.renderTasks();
      await this.loadStatistics();
    } catch (error) {
      console.error('Error loading tasks:', error);
      this.showError(`Failed to load tasks: ${  error.message}`);
    } finally {
      this.hideLoading();
    }
  }
  renderTasks() {
    const tasksList = document.getElementById('tasks-list');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('empty-state');
    if (!tasksList) return;
    const filteredTasks = this.getFilteredTasks();
    const paginatedTasks = this.getPaginatedTasks(filteredTasks);
    // Hide loading state
    if (loading) loading.style.display = 'none';
    if (paginatedTasks.length === 0) {
      tasksList.style.display = 'none';
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
                    <h2>No tasks found</h2>
                    <p>No tasks match your current filters.</p>
                `;
      }
      return;
    }
    // Show task list and hide empty state
    tasksList.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    tasksList.innerHTML = paginatedTasks.map(task => `
            <div class="task-card">
                <div class="task-header">
                    <div class="task-title-section">
                        <h3 class="task-title">${task.complaint?.title || 'Untitled Complaint'}</h3>
                        <div class="task-meta">
                            <span class="task-id">#${task.complaint_id}</span>
                            <span class="task-status status-${task.status?.toLowerCase().replace(' ', '_') || 'assigned'}">
                                ${task.status || 'Assigned'}
                            </span>
                            <span class="task-priority priority-${task.priority?.toLowerCase() || 'medium'}">
                                ${task.priority || 'Medium'}
                            </span>
                        </div>
                    </div>
                    <div class="task-actions">
                        ${this.getActionButtons(task)}
                    </div>
                </div>
                
                <div class="task-content">
                    <p class="task-description">${task.complaint?.description || 'No description provided'}</p>
                    <div class="task-details">
                        <div class="task-detail">
                            <span>📅</span>
                            <span>Assigned: ${this.formatDate(task.assigned_at)}</span>
                        </div>
                        <div class="task-detail">
                            <span>📍</span>
                            <span>${task.complaint?.location_text || 'No location'}</span>
                        </div>
                        <div class="task-detail">
                            <span>🏷️</span>
                            <span>${task.complaint?.category || 'General'}</span>
                        </div>
                        ${task.deadline ? `
                            <div class="task-detail">
                                <span>⏰</span>
                                <span>Deadline: ${this.formatDate(task.deadline)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                ${this.renderAssignmentInfo(task)}
                ${this.renderDeadlineWarning(task)}
            </div>
        `).join('');
    this.attachActionEventListeners();
  }
  getActionButtons(task) {
    const buttons = [];
    // View details button
    buttons.push(`
            <button class="btn btn-outline" data-action="view" data-complaint-id="${task.complaint_id}">
                View Details
            </button>
        `);
    // Mark as resolved button (if not completed)
    if (task.status !== 'completed') {
      buttons.push(`
                <button class="btn btn-success" data-action="resolve" data-complaint-id="${task.complaint_id}" data-assignment-id="${task.id}">
                    Mark as Resolved
                </button>
            `);
    }
    return buttons.join('');
  }
  renderAssignmentInfo(task) {
    const statusClass = task.status?.toLowerCase().replace(' ', '_') || 'assigned';
    const statusText = task.status || 'Assigned';
    const completedText = task.completed_at ? `Completed: ${this.formatDate(task.completed_at)}` : '';
    return `
            <div class="assignment-info ${statusClass}">
                <strong>Assignment Status:</strong> ${statusText}
                ${task.notes ? `<br><strong>Notes:</strong> ${task.notes}` : ''}
                ${completedText ? `<br>${completedText}` : ''}
            </div>
        `;
  }

  renderDeadlineWarning(task) {
    if (!task.deadline) return '';

    const deadline = new Date(task.deadline);
    const now = new Date();
    const hoursUntilDeadline = (deadline - now) / (1000 * 60 * 60);

    if (hoursUntilDeadline < 0) {
      return `
                <div class="deadline-warning overdue">
                    ⚠️ This task is overdue! Deadline was ${this.formatDate(task.deadline)}
                </div>
            `;
    } else if (hoursUntilDeadline < 24) {
      return `
                <div class="deadline-warning">
                    ⏰ Deadline approaching: ${this.formatDate(task.deadline)}
                </div>
            `;
    }

    return '';
  }

  attachActionEventListeners() {


    // View details buttons
    const viewButtons = document.querySelectorAll('[data-action="view"]');

    viewButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const complaintId = e.target.getAttribute('data-complaint-id');
        this.viewComplaint(complaintId);
      });
    });

    // Mark as resolved buttons
    const resolveButtons = document.querySelectorAll('[data-action="resolve"]');


    if (resolveButtons.length === 0) {
      console.error('[LGU_OFFICER] No resolve buttons found in DOM!');
    }

    resolveButtons.forEach((btn, index) => {


      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const complaintId = e.target.getAttribute('data-complaint-id') || btn.getAttribute('data-complaint-id');
        const assignmentId = e.target.getAttribute('data-assignment-id') || btn.getAttribute('data-assignment-id');
        if (!complaintId) {
          console.error('[LGU_OFFICER] No complaint ID found!');
          return;
        }
        // Always use complaint ID for the modal - the API expects complaint IDs
        const id = complaintId;
        const type = assignmentId ? 'assignment' : 'complaint';
        this.showResolutionModal(id, type);
      });
    });
  }

  async viewComplaint(complaintId) {
    // Redirect to complaint details page
    window.location.href = `/complaint-details/${complaintId}`;
  }
  showResolutionModal(id, type = 'complaint') {

    // Set complaint/assignment ID
    const complaintIdInput = document.getElementById('resolution-complaint-id');
    if (!complaintIdInput) {
      console.error('[LGU_OFFICER] resolution-complaint-id input not found!');
      return;
    }
    complaintIdInput.value = id;
    // Store type for later use
    complaintIdInput.dataset.idType = type;
    // Show modal by adding 'active' class (required by modal.css)
    const modal = document.getElementById('resolution-modal');
    if (!modal) {
      console.error('[LGU_OFFICER] resolution-modal not found!');
      return;
    }
    modal.classList.add('active');
  }
  async confirmResolution() {
    const complaintIdInput = document.getElementById('resolution-complaint-id');
    const id = complaintIdInput.value;
    const idType = complaintIdInput.dataset.idType || 'complaint';
    const resolutionNotes = document.getElementById('resolution-notes').value;
    const evidenceInput = document.getElementById('resolution-evidence');
    if (!resolutionNotes.trim()) {
      showToast('Please provide resolution notes', 'error');
      return;
    }
    try {
      // Create FormData to handle files
      const formData = new FormData();
      formData.append('notes', resolutionNotes.trim());
      // Add files if selected
      if (evidenceInput && evidenceInput.files && evidenceInput.files.length > 0) {
        Array.from(evidenceInput.files).forEach((file, index) => {
          formData.append(`completionEvidence`, file);
        });
      }
      const response = await fetch(`/api/complaints/${id}/mark-complete`, {
        method: 'POST',
        credentials: 'include',
        body: formData  // Don't set Content-Type header - browser will set it with boundary
      });


      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LGU_OFFICER] API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }
      const result = await response.json();
      if (result.success) {
        showToast('Assignment marked as complete successfully', 'success');
        this.hideModal();
        this.loadTasks(); // Refresh the list
      } else {
        throw new Error(result.error || 'Failed to mark assignment as complete');
      }
    } catch (error) {
      console.error('[LGU_OFFICER] Error marking assignment as complete:', error);
      showToast(`Failed to mark assignment as complete: ${  error.message}`, 'error');
    }
  }
  hideModal() {
    const modal = document.getElementById('resolution-modal');
    if (modal) {
      modal.classList.remove('active');
    }
    // Reset form
    const form = document.getElementById('resolution-form');
    if (form) {
      form.reset();
    }
  }
  getFilteredTasks() {
    let filtered = [...this.tasks];

    // Status filter
    if (this.filters.status) {
      filtered = filtered.filter(task => task.status === this.filters.status);
    }

    // Priority filter
    if (this.filters.priority) {
      filtered = filtered.filter(task => task.priority === this.filters.priority);
    }

    // Urgency filter (urgent and high priority)
    if (this.filters.urgency) {
      if (this.filters.urgency === 'urgent') {
        filtered = filtered.filter(task => task.priority === 'urgent');
      } else if (this.filters.urgency === 'high') {
        filtered = filtered.filter(task => task.priority === 'urgent' || task.priority === 'high');
      }
    }

    // Search filter
    if (this.filters.search) {
      const searchTerm = this.filters.search.toLowerCase();
      filtered = filtered.filter(task =>
        task.complaint?.title?.toLowerCase().includes(searchTerm) ||
                task.complaint?.description?.toLowerCase().includes(searchTerm) ||
                task.complaint_id?.toString().includes(searchTerm)
      );
    }

    // Sort by prioritization if filter is set
    if (this.filters.prioritization && this.barangayPrioritization) {
      filtered = filtered.sort((a, b) => {
        const scoreA = a.prioritizationScore || 0;
        const scoreB = b.prioritizationScore || 0;
        return this.filters.prioritization === 'desc' ? scoreB - scoreA : scoreA - scoreB;
      });
    }

    return filtered;
  }
  getPaginatedTasks(tasks) {

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return tasks.slice(startIndex, endIndex);
  }
  async loadStatistics() {
    try {
      const response = await fetch('/api/lgu/statistics', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        this.updateStats(data.data);
      } else {
        throw new Error(data.error || 'Failed to load statistics');
      }
    } catch (error) {
      console.error('[LGU_OFFICER_TASKS] Error loading statistics:', error);
      // Fallback to local calculation
      this.updateStatsFromTasks();
    }
  }
  updateStats(stats) {

    document.getElementById('total-tasks').textContent = stats.total_tasks || 0;
    document.getElementById('pending-tasks').textContent = stats.pending_tasks || 0;
    document.getElementById('in-progress-tasks').textContent = stats.in_progress_tasks || 0;
    document.getElementById('completed-tasks').textContent = stats.completed_tasks || 0;
  }
  updateStatsFromTasks() {
    const total = this.tasks.length;
    const pending = this.tasks.filter(t => t.status === 'assigned').length;
    const inProgress = this.tasks.filter(t => t.status === 'in_progress').length;
    const completed = this.tasks.filter(t => t.status === 'completed').length;
    document.getElementById('total-tasks').textContent = total;
    document.getElementById('pending-tasks').textContent = pending;
    document.getElementById('in-progress-tasks').textContent = inProgress;
    document.getElementById('completed-tasks').textContent = completed;
  }
  showLoading() {
    const loading = document.getElementById('loading');
    const tasksList = document.getElementById('tasks-list');
    const emptyState = document.getElementById('empty-state');
    if (loading) loading.style.display = 'block';
    if (tasksList) tasksList.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
  }
  hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
  }
  showError(message) {
    const emptyState = document.getElementById('empty-state');
    if (emptyState) {
      emptyState.style.display = 'block';
      emptyState.innerHTML = `
                <h2>Error Loading Tasks</h2>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Retry</button>
            `;
    }
  }
  formatDate(dateString) {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      return `${date.toLocaleDateString()  } ${  date.toLocaleTimeString()}`;
    } catch (error) {
      return 'Invalid date';
    }
  }
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}
// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AssignedTasks();
});
