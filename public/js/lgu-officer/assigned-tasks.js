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
            this.renderTasks();
            await this.loadStatistics();
            
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
        console.log('[LGU_OFFICER] Attaching action event listeners...');
        
        // View details buttons
        const viewButtons = document.querySelectorAll('[data-action="view"]');
        console.log('[LGU_OFFICER] Found view buttons:', viewButtons.length);
        viewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const complaintId = e.target.getAttribute('data-complaint-id');
                this.viewComplaint(complaintId);
            });
        });

        // Mark as resolved buttons
        const resolveButtons = document.querySelectorAll('[data-action="resolve"]');
        console.log('[LGU_OFFICER] Found resolve buttons:', resolveButtons.length);
        
        if (resolveButtons.length === 0) {
            console.error('[LGU_OFFICER] No resolve buttons found in DOM!');
        }
        
        resolveButtons.forEach((btn, index) => {
            console.log(`[LGU_OFFICER] Attaching listener to resolve button ${index + 1}`);
            console.log('[LGU_OFFICER] Button element:', btn);
            console.log('[LGU_OFFICER] Button complaint ID:', btn.getAttribute('data-complaint-id'));
            
            btn.addEventListener('click', (e) => {
                console.log('[LGU_OFFICER] Resolve button clicked!');
                e.preventDefault();
                e.stopPropagation();
                const complaintId = e.target.getAttribute('data-complaint-id') || btn.getAttribute('data-complaint-id');
                const assignmentId = e.target.getAttribute('data-assignment-id') || btn.getAttribute('data-assignment-id');
                console.log('[LGU_OFFICER] IDs from button:', { complaintId, assignmentId });
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
        console.log('[LGU_OFFICER] Showing resolution modal for:', { id, type });
        
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
        console.log('[LGU_OFFICER] Modal displayed with active class');
    }

    async confirmResolution() {
        console.log('[LGU_OFFICER] confirmResolution called');
        
        const complaintIdInput = document.getElementById('resolution-complaint-id');
        const id = complaintIdInput.value;
        const idType = complaintIdInput.dataset.idType || 'complaint';
        const resolutionNotes = document.getElementById('resolution-notes').value;
        const evidenceInput = document.getElementById('resolution-evidence');
        
        console.log('[LGU_OFFICER] Resolution details:', { id, idType, hasNotes: !!resolutionNotes, hasFiles: !!evidenceInput?.files?.length });

        if (!resolutionNotes.trim()) {
            showToast('Please provide resolution notes', 'error');
            return;
        }

        try {
            console.log('[LGU_OFFICER] Preparing FormData...');
            
            // Create FormData to handle files
            const formData = new FormData();
            formData.append('notes', resolutionNotes.trim());

            // Add files if selected
            if (evidenceInput && evidenceInput.files && evidenceInput.files.length > 0) {
                Array.from(evidenceInput.files).forEach((file, index) => {
                    formData.append(`completionEvidence`, file);
                });
                console.log('[LGU_OFFICER] Attaching', evidenceInput.files.length, 'evidence file(s)');
            }

            console.log('[LGU_OFFICER] Calling API with ID:', id, 'Type:', idType);
            const response = await fetch(`/api/complaints/${id}/mark-complete`, {
                method: 'POST',
                credentials: 'include',
                body: formData  // Don't set Content-Type header - browser will set it with boundary
            });

            console.log('[LGU_OFFICER] API response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[LGU_OFFICER] API error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }

            const result = await response.json();
            console.log('[LGU_OFFICER] API result:', result);
            
            if (result.success) {
                showToast('Assignment marked as complete successfully', 'success');
                this.hideModal();
                this.loadTasks(); // Refresh the list
            } else {
                throw new Error(result.error || 'Failed to mark assignment as complete');
            }
        } catch (error) {
            console.error('[LGU_OFFICER] Error marking assignment as complete:', error);
            showToast('Failed to mark assignment as complete: ' + error.message, 'error');
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

    async loadStatistics() {
        try {
            console.log('[LGU_OFFICER_TASKS] Loading statistics...');
            const response = await fetch('/api/lgu/statistics', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            console.log('[LGU_OFFICER_TASKS] Statistics response:', response.status, response.statusText);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('[LGU_OFFICER_TASKS] Statistics data:', data);
            
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
        console.log('[LGU_OFFICER_TASKS] Updating stats with:', stats);
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
