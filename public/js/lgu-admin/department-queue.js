// LGU Admin Department Queue JavaScript
import showToast from '../components/toast.js';

class DepartmentQueue {

  constructor() {
    this.complaints = [];
    this.department = null;
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.filters = {
      status: '',
      priority: '',
      search: ''
    };
    this.statusPalette = [
      { key: 'approved', label: 'Approved', color: '#3b82f6' },
      { key: 'assigned', label: 'Assigned', color: '#6366f1' },
      { key: 'assigned to officer', label: 'With Officer', color: '#f97316' },
      { key: 'in progress', label: 'In Progress', color: '#facc15' },
      { key: 'resolved', label: 'Resolved', color: '#22c55e' },
      { key: 'closed', label: 'Closed', color: '#0ea5e9' },
      { key: 'other', label: 'Other', color: '#94a3b8' }
    ];
    this.priorityPalette = [
      { key: 'urgent', label: 'Urgent', color: '#dc2626', track: '#fee2e2' },
      { key: 'high', label: 'High', color: '#ea580c', track: '#ffedd5' },
      { key: 'medium', label: 'Medium', color: '#d97706', track: '#fef3c7' },
      { key: 'low', label: 'Low', color: '#059669', track: '#d1fae5' },
      { key: 'other', label: 'Unlabeled', color: '#64748b', track: '#e5e7eb' }
    ];
    this.init();
  }
  init() {
    this.setupEventListeners();
    this.loadComplaints();
  }
  setupEventListeners() {
    // Filter controls
    const statusFilter = document.getElementById('status-filter');
    const priorityFilter = document.getElementById('priority-filter');
    const searchInput = document.getElementById('search-input');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.filters.status = e.target.value;
        this.loadComplaints();
      });
    }
    if (priorityFilter) {
      priorityFilter.addEventListener('change', (e) => {
        this.filters.priority = e.target.value;
        this.loadComplaints();
      });
    }
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.debounce(() => this.loadComplaints(), 300)();
      });
    }
    // Modal controls
    this.setupModalEventListeners();
  }
  setupModalEventListeners() {
    const modal = document.getElementById('officer-assignment-modal');
    const closeBtn = modal?.querySelector('.modal-close');
    const cancelBtn = document.getElementById('cancel-assignment');
    const confirmBtn = document.getElementById('confirm-assignment');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hideModal());
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.hideModal());
    }
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.confirmAssignment());
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
  async loadComplaints() {
    try {
      this.showLoading();
      const queryParams = new URLSearchParams();
      if (this.filters.status) queryParams.append('status', this.filters.status);
      if (this.filters.priority) queryParams.append('priority', this.filters.priority);
      if (this.filters.search) queryParams.append('search', this.filters.search);
      queryParams.append('limit', this.itemsPerPage);
      const response = await fetch(`/api/lgu-admin/department-queue?${queryParams}`, {
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
        throw new Error(data.error || 'Failed to load complaints');
      }
      this.complaints = data.data || [];
      this.department = data.department;
      this.renderComplaints();
      this.updateStats();
      this.updateDepartmentName();
    } catch (error) {
      console.error('Error loading complaints:', error);
      this.showError(`Failed to load complaints: ${  error.message}`);
    } finally {
      this.hideLoading();
    }
  }
  renderComplaints() {
    const complaintsList = document.getElementById('complaints-list');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('empty-state');
    if (!complaintsList) return;
    const filteredComplaints = this.getFilteredComplaints();
    const paginatedComplaints = this.getPaginatedComplaints(filteredComplaints);
    // Hide loading state
    if (loading) loading.style.display = 'none';
    if (paginatedComplaints.length === 0) {
      complaintsList.style.display = 'none';
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
                    <h2>No complaints found</h2>
                    <p>No complaints match your current filters.</p>
                `;
      }
      return;
    }
    // Show complaint list and hide empty state
    complaintsList.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    complaintsList.innerHTML = paginatedComplaints.map(complaint => `
            <div class="complaint-card">
                <div class="complaint-header">
                    <div class="complaint-title-section">
                        <h3 class="complaint-title">${complaint.title || 'Untitled Complaint'}</h3>
                        <div class="complaint-meta">
                            <span class="complaint-id">#${complaint.id}</span>
                            <span class="complaint-status status-${complaint.status?.toLowerCase().replace(' ', '-') || 'pending'}">
                                ${complaint.status || 'Pending'}
                            </span>
                            <span class="complaint-priority priority-${complaint.priority?.toLowerCase() || 'medium'}">
                                ${complaint.priority || 'Medium'}
                            </span>
                        </div>
                    </div>
                    <div class="complaint-actions">
                        ${this.getActionButtons(complaint)}
                    </div>
                </div>
                
                <div class="complaint-content">
                    <p class="complaint-description">${complaint.descriptive_su || complaint.description || 'No description provided'}</p>
                    ${!complaint.is_assigned_to_department ? `
                        <div class="info-banner" style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 0.5rem; border-radius: 0.25rem; margin-top: 0.5rem; font-size: 0.875rem; color: #856404;">
                            ⚠️ This complaint is not assigned to your department. Limited information only.
                        </div>
                    ` : ''}
                    <div class="complaint-details">
                        <div class="complaint-detail">
                            <span>📅</span>
                            <span>${this.formatDate(complaint.submitted_at || complaint.created_at)}</span>
                        </div>
                        <div class="complaint-detail">
                            <span>📍</span>
                            <span>${complaint.location_text || 'No location'}</span>
                        </div>
                        <div class="complaint-detail">
                            <span>🏷️</span>
                            <span>${complaint.type || 'General'}</span>
                        </div>
                    </div>
                </div>

                ${this.renderDepartmentsInfo(complaint)}
                ${this.renderAssignmentInfo(complaint)}
            </div>
        `).join('');
    this.attachActionEventListeners();
  }
  getActionButtons(complaint) {
    const buttons = [];
    // View details button - ONLY show if complaint is assigned to this admin's department
    if (complaint.is_assigned_to_department) {
      buttons.push(`
                <button class="btn btn-primary" data-action="view" data-complaint-id="${complaint.id}">
                    View Assigned Complaint
                </button>
            `);
    }
    // Assign to officer button (if not already assigned)
    if (complaint.status === 'approved' || complaint.status === 'assigned') {
      buttons.push(`
                <button class="btn btn-outline" data-action="assign" data-complaint-id="${complaint.id}">
                    Assign to Officer
                </button>
            `);
    }
    return buttons.join('');
  }
  renderDepartmentsInfo(complaint) {
    const departments = complaint.assigned_departments || complaint.primary_department || [];
    const preferredDepartments = complaint.preferred_departments || [];
    if (!departments || departments.length === 0) {
      return '';
    }
    const departmentArray = Array.isArray(departments) ? departments : [departments];
    return `
            <div class="departments-info">
                <strong>Assigned Departments:</strong>
                <div class="departments-list">
                    ${departmentArray.map(dept => `
                        <div class="department-badge ${preferredDepartments.includes(dept) ? 'preferred' : ''}">
                            ${dept}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
  }

  renderAssignmentInfo(complaint) {
    if (!complaint.assignments || complaint.assignments.length === 0) {
      return `
                <div class="assignment-info pending">
                    <strong>Status:</strong> Pending assignment to officer
                </div>
            `;
    }

    const assignment = complaint.assignments[0];
    return `
            <div class="assignment-info assigned">
                <strong>Assigned to Officer:</strong> ${assignment.assigned_to || 'Unknown'}
                <br>
                <strong>Status:</strong> ${assignment.status || 'Unknown'}
                <br>
                <strong>Assigned:</strong> ${this.formatDate(assignment.assigned_at)}
            </div>
        `;
  }

  attachActionEventListeners() {
    // View details buttons
    document.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const complaintId = e.target.getAttribute('data-complaint-id');
        this.viewComplaint(complaintId);
      });
    });

    // Assign to officer buttons
    document.querySelectorAll('[data-action="assign"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const complaintId = e.target.getAttribute('data-complaint-id');
        this.showAssignmentModal(complaintId);
      });
    });
  }

  async viewComplaint(complaintId) {
    // Redirect to complaint details page
    window.location.href = `/complaint-details?id=${complaintId}`;
  }
  async showAssignmentModal(complaintId) {
    try {
      // Load officers for this department
      await this.loadOfficers();
      // Set complaint ID
      document.getElementById('assignment-complaint-id').value = complaintId;
      // Show modal
      const modal = document.getElementById('officer-assignment-modal');
      if (modal) {
        modal.style.display = 'flex';
      }
    } catch (error) {
      console.error('Error showing assignment modal:', error);
      showToast(`Failed to load officers: ${  error.message}`, 'error');
    }
  }
  async loadOfficers() {
    try {
      const response = await fetch('/api/lgu-admin/department-officers', {
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
        throw new Error(data.error || 'Failed to load officers');
      }
      const officerSelect = document.getElementById('officer-select');
      if (officerSelect) {
        officerSelect.innerHTML = `<option value="">Choose an officer...</option>${
          (data.data || []).map(officer => `
                        <option value="${officer.id}">${officer.name || officer.email}</option>
                    `).join('')}`;
      }
    } catch (error) {
      console.error('Error loading officers:', error);
      throw error;
    }
  }
  async confirmAssignment() {
    const complaintId = document.getElementById('assignment-complaint-id').value;
    const officerId = document.getElementById('officer-select').value;
    const priority = document.getElementById('assignment-priority').value;
    const deadline = document.getElementById('assignment-deadline').value;
    const notes = document.getElementById('assignment-notes').value;
    if (!officerId) {
      showToast('Please select an officer', 'error');
      return;
    }
    try {
      const response = await fetch(`/api/lgu-admin/complaints/${complaintId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          officerId,
          priority,
          deadline: deadline || null,
          notes: notes || null
        })
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        showToast('Complaint assigned to officer successfully', 'success');
        this.hideModal();
        this.loadComplaints(); // Refresh the list
      } else {
        throw new Error(result.error || 'Failed to assign complaint');
      }
    } catch (error) {
      console.error('Error assigning complaint:', error);
      showToast(`Failed to assign complaint: ${  error.message}`, 'error');
    }
  }
  hideModal() {
    const modal = document.getElementById('officer-assignment-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    // Reset form
    const form = document.getElementById('officer-assignment-form');
    if (form) {
      form.reset();
    }
  }
  getFilteredComplaints() {
    let filtered = [...this.complaints];
    if (this.filters.search) {
      const searchTerm = this.filters.search.toLowerCase();
      filtered = filtered.filter(complaint =>
        complaint.title?.toLowerCase().includes(searchTerm) ||
                complaint.description?.toLowerCase().includes(searchTerm) ||
                complaint.id?.toString().includes(searchTerm)
      );
    }
    return filtered;
  }
  getPaginatedComplaints(complaints) {

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return complaints.slice(startIndex, endIndex);
  }
  updateStats() {
    const total = this.complaints.length;
    const pendingAssignment = this.complaints.filter(c =>
      c.status === 'approved' || c.status === 'assigned'
    ).length;
    const inProgress = this.complaints.filter(c =>
      c.status === 'assigned to officer' || c.status === 'in progress'
    ).length;
    const resolved = this.complaints.filter(c =>
      c.status === 'resolved' || c.status === 'closed'
    ).length;
    document.getElementById('total-complaints').textContent = total;
    document.getElementById('pending-assignment').textContent = pendingAssignment;
    document.getElementById('in-progress').textContent = inProgress;
    document.getElementById('resolved').textContent = resolved;
    this.updateVisualizations();
  }
  updateVisualizations() {
    this.renderStatusVisualization();
    this.renderPriorityBars();
    this.updateInsightsTimestamp();
  }
  renderStatusVisualization() {
    const svg = document.getElementById('complaint-status-chart');
    const legend = document.getElementById('complaint-status-legend');
    const donutTotal = document.getElementById('donut-total');
    if (!svg || !legend || !donutTotal) return;
    const total = this.complaints.length;
    donutTotal.textContent = total;
    svg.innerHTML = '';
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const statusCounts = this.getStatusCounts();
    const visibleStatuses = this.statusPalette
      .map(item => ({ ...item, count: statusCounts[item.key] || 0 }))
      .filter(item => item.count > 0);
    const track = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    track.setAttribute('cx', '80');
    track.setAttribute('cy', '80');
    track.setAttribute('r', radius);
    track.classList.add('donut-track');
    svg.appendChild(track);
    if (total === 0 || visibleStatuses.length === 0) {
      legend.innerHTML = '<p class="legend-empty">No complaints to visualize.</p>';
      return;
    }
    let offset = 0;
    visibleStatuses.forEach(item => {
      const slice = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      slice.setAttribute('cx', '80');
      slice.setAttribute('cy', '80');
      slice.setAttribute('r', radius);
      slice.classList.add('donut-slice');
      slice.setAttribute('stroke', item.color);
      const dash = (item.count / total) * circumference;
      slice.setAttribute('stroke-dasharray', `${dash} ${circumference}`);
      slice.setAttribute('stroke-dashoffset', `${-offset}`);
      offset += dash;
      svg.appendChild(slice);
    });
    legend.innerHTML = visibleStatuses.map(item => {
      const percent = Math.round((item.count / total) * 100);
      return `
        <div class="legend-row">
          <div class="legend-row-info">
            <span class="legend-swatch" style="background:${item.color};"></span>
            <div>
              <div class="legend-label">${item.label}</div>
              <div class="legend-percent">${percent}% of queue</div>
            </div>
          </div>
          <div class="legend-count">${item.count}</div>
        </div>
      `;
    }).join('');
  }
  renderPriorityBars() {
    const container = document.getElementById('priority-bars');
    const totalLabel = document.getElementById('priority-total-label');
    if (!container || !totalLabel) return;
    const total = this.complaints.length;
    totalLabel.textContent = `${total} complaint${total === 1 ? '' : 's'}`;
    const priorityCounts = this.getPriorityCounts();
    if (total === 0) {
      container.innerHTML = '<p class="legend-empty">No priority data available yet.</p>';
      return;
    }
    container.innerHTML = this.priorityPalette.map(item => {
      const count = priorityCounts[item.key] || 0;
      const percent = total ? Math.round((count / total) * 100) : 0;
      return `
        <div class="priority-row">
          <div class="priority-row-head">
            <div class="priority-label">
              <span class="priority-dot" style="background:${item.color};"></span>
              ${item.label}
            </div>
            <div class="priority-value">
              ${count} <span>${percent}%</span>
            </div>
          </div>
          <div class="priority-progress">
            <span style="width:${percent}%; background:${item.color};"></span>
          </div>
        </div>
      `;
    }).join('');
  }
  updateInsightsTimestamp() {
    const element = document.getElementById('insights-updated-text');
    if (!element) return;
    const now = new Date();
    element.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  getStatusCounts() {
    const counts = this.statusPalette.reduce((acc, item) => {
      acc[item.key] = 0;
      return acc;
    }, {});
    this.complaints.forEach(complaint => {
      const status = (complaint.status || 'other').toLowerCase();
      if (counts.hasOwnProperty(status)) {
        counts[status] += 1;
      } else {
        counts.other += 1;
      }
    });
    return counts;
  }
  getPriorityCounts() {
    const counts = this.priorityPalette.reduce((acc, item) => {
      acc[item.key] = 0;
      return acc;
    }, {});
    this.complaints.forEach(complaint => {
      const priority = (complaint.priority || 'other').toLowerCase();
      if (counts.hasOwnProperty(priority)) {
        counts[priority] += 1;
      } else {
        counts.other += 1;
      }
    });
    return counts;
  }
  updateDepartmentName() {
    const departmentNameElement = document.getElementById('department-name');
    if (departmentNameElement && this.department) {
      departmentNameElement.textContent = `${this.department.name} (${this.department.code})`;
    }
  }
  showLoading() {
    const loading = document.getElementById('loading');
    const complaintsList = document.getElementById('complaints-list');
    const emptyState = document.getElementById('empty-state');
    if (loading) loading.style.display = 'block';
    if (complaintsList) complaintsList.style.display = 'none';
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
                <h2>Error Loading Complaints</h2>
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
  new DepartmentQueue();
});
