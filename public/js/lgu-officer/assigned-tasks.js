// LGU Officer Assigned Tasks JavaScript

import showToast from '../components/toast.js';

class AssignedTasks {
    constructor() {
        this.tasks = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.filters = {
            status: '',
            priority: '',
            search: ''
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadTasks();
    }

    setupEventListeners() {
        // Filter controls
        const statusFilter = document.getElementById('status-filter');
        const priorityFilter = document.getElementById('priority-filter');
        const searchInput = document.getElementById('search-input');

        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.loadTasks();
            });
        }

        if (priorityFilter) {
            priorityFilter.addEventListener('change', (e) => {
                this.filters.priority = e.target.value;
                this.loadTasks();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.debounce(() => this.loadTasks(), 300)();
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

            const response = await fetch(`/api/lgu-officer/assigned-tasks?${queryParams}`, {
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
            this.renderTasks();
            this.updateStats();
            
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.showError('Failed to load tasks: ' + error.message);
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
                            <span>${task.complaint?.type || 'General'}</span>
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
                <button class="btn btn-success" data-action="resolve" data-complaint-id="${task.complaint_id}">
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
        document.querySelectorAll('[data-action="view"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const complaintId = e.target.getAttribute('data-complaint-id');
                this.viewComplaint(complaintId);
            });
        });

        // Mark as resolved buttons
        document.querySelectorAll('[data-action="resolve"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const complaintId = e.target.getAttribute('data-complaint-id');
                this.showResolutionModal(complaintId);
            });
        });
    }

    async viewComplaint(complaintId) {
        // Redirect to complaint details page
        window.location.href = `/complaint-details?id=${complaintId}`;
    }

    showResolutionModal(complaintId) {
        // Set complaint ID
        document.getElementById('resolution-complaint-id').value = complaintId;

        // Show modal
        const modal = document.getElementById('resolution-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    async confirmResolution() {
        const complaintId = document.getElementById('resolution-complaint-id').value;
        const resolutionNotes = document.getElementById('resolution-notes').value;
        const evidence = document.getElementById('resolution-evidence').files;

        if (!resolutionNotes.trim()) {
            showToast('Please provide resolution notes', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/lgu-officer/complaints/${complaintId}/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    resolution_notes: resolutionNotes.trim(),
                    evidence: evidence.length > 0 ? Array.from(evidence).map(f => f.name) : null
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                showToast('Complaint marked as resolved successfully', 'success');
                this.hideModal();
                this.loadTasks(); // Refresh the list
            } else {
                throw new Error(result.error || 'Failed to mark as resolved');
            }
        } catch (error) {
            console.error('Error marking as resolved:', error);
            showToast('Failed to mark as resolved: ' + error.message, 'error');
        }
    }

    hideModal() {
        const modal = document.getElementById('resolution-modal');
        if (modal) {
            modal.style.display = 'none';
        }

        // Reset form
        const form = document.getElementById('resolution-form');
        if (form) {
            form.reset();
        }
    }

    getFilteredTasks() {
        let filtered = [...this.tasks];

        if (this.filters.search) {
            const searchTerm = this.filters.search.toLowerCase();
            filtered = filtered.filter(task => 
                task.complaint?.title?.toLowerCase().includes(searchTerm) ||
                task.complaint?.description?.toLowerCase().includes(searchTerm) ||
                task.complaint_id?.toString().includes(searchTerm)
            );
        }

        return filtered;
    }

    getPaginatedTasks(tasks) {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return tasks.slice(startIndex, endIndex);
    }

    updateStats() {
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
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
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
