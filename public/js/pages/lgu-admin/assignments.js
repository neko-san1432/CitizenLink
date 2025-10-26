/**
 * LGU Admin Assignments Page
 * Handles viewing and managing complaint assignments for LGU admins
 */

import apiClient from '../../config/apiClient.js';
import showMessage from '../../components/toast.js';

class LguAdminAssignments {
  constructor() {
    this.assignments = [];
    this.officers = [];
    this.currentComplaintId = null;
    this.filters = {
      status: 'all',
      priority: 'all',
      sub_type: 'all'
    };
    this.currentPage = 1;
    this.itemsPerPage = 10;
  }

  async init() {
    console.log('[LGU_ADMIN_ASSIGNMENTS] Initializing...');
    console.log('[LGU_ADMIN_ASSIGNMENTS] Document ready state:', document.readyState);
    console.log('[LGU_ADMIN_ASSIGNMENTS] Current URL:', window.location.href);
    
    // Show loading state initially
    this.showLoadingState();
    
    try {
      console.log('[LGU_ADMIN_ASSIGNMENTS] Step 1: Loading assignments...');
      await this.loadAssignments();
      
      console.log('[LGU_ADMIN_ASSIGNMENTS] Step 2: Loading officers...');
      await this.loadOfficers();
      
      console.log('[LGU_ADMIN_ASSIGNMENTS] Step 3: Setting up event listeners...');
      this.setupEventListeners();
      
      console.log('[LGU_ADMIN_ASSIGNMENTS] Step 4: Rendering assignments...');
      this.renderAssignments();
      
      console.log('[LGU_ADMIN_ASSIGNMENTS] Initialization complete!');
    } catch (error) {
      console.error('[LGU_ADMIN_ASSIGNMENTS] Initialization error:', error);
      this.hideLoadingState();
      showMessage('error', 'Failed to initialize assignments page');
    }
  }

  showLoadingState() {
    const loadingState = document.getElementById('loading-state');
    const assignmentsList = document.getElementById('assignments-list');
    const emptyState = document.getElementById('empty-state');
    
    if (loadingState) loadingState.style.display = 'block';
    if (assignmentsList) assignmentsList.style.display = 'none';
    if (emptyState) emptyState.style.display = 'none';
  }

  hideLoadingState() {
    const loadingState = document.getElementById('loading-state');
    if (loadingState) loadingState.style.display = 'none';
  }

  async loadAssignments() {
    try {
      console.log('[LGU_ADMIN_ASSIGNMENTS] Loading assignments...');
      
      const queryParams = new URLSearchParams();
      if (this.filters.status !== 'all') queryParams.append('status', this.filters.status);
      if (this.filters.priority !== 'all') queryParams.append('priority', this.filters.priority);
      if (this.filters.sub_type !== 'all') queryParams.append('sub_type', this.filters.sub_type);

      const url = `/api/lgu-admin/department-assignments?${queryParams}`;
      console.log('[LGU_ADMIN_ASSIGNMENTS] Requesting URL:', url);
      
      const response = await apiClient.get(url);
      console.log('[LGU_ADMIN_ASSIGNMENTS] Response received:', response);
      console.log('[LGU_ADMIN_ASSIGNMENTS] Response data:', response?.data);
      console.log('[LGU_ADMIN_ASSIGNMENTS] Response success:', response?.success);
      
      if (response && response.success) {
        this.assignments = response.data || [];
        console.log('[LGU_ADMIN_ASSIGNMENTS] Loaded assignments:', this.assignments.length);
        console.log('[LGU_ADMIN_ASSIGNMENTS] Assignments data:', this.assignments);
      } else {
        throw new Error(response?.error || 'Failed to load assignments');
      }
    } catch (error) {
      console.error('[LGU_ADMIN_ASSIGNMENTS] Load assignments error:', error);
      this.hideLoadingState();
      showMessage('error', 'Failed to load assignments');
      this.assignments = [];
    }
  }

  async loadOfficers() {
    try {
      console.log('[LGU_ADMIN_ASSIGNMENTS] Loading officers...');
      
      const response = await apiClient.get('/api/lgu-admin/department-officers');
      console.log('[LGU_ADMIN_ASSIGNMENTS] Officers response received:', response);
      console.log('[LGU_ADMIN_ASSIGNMENTS] Officers response data:', response?.data);
      console.log('[LGU_ADMIN_ASSIGNMENTS] Officers response success:', response?.success);
      
      if (response && response.success) {
        this.officers = response.data || [];
        console.log('[LGU_ADMIN_ASSIGNMENTS] Loaded officers:', this.officers.length);
        console.log('[LGU_ADMIN_ASSIGNMENTS] Officers data:', this.officers);
      } else {
        throw new Error(response?.error || 'Failed to load officers');
      }
    } catch (error) {
      console.error('[LGU_ADMIN_ASSIGNMENTS] Load officers error:', error);
      this.hideLoadingState();
      showMessage('error', 'Failed to load officers');
      this.officers = [];
    }
  }

  setupEventListeners() {
    // Filter controls
    const statusFilter = document.getElementById('status-filter');
    const priorityFilter = document.getElementById('priority-filter');
    const subTypeFilter = document.getElementById('sub-type-filter');
    const refreshBtn = document.getElementById('refresh-btn');

    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.filters.status = e.target.value;
        this.applyFilters();
      });
    }

    if (priorityFilter) {
      priorityFilter.addEventListener('change', (e) => {
        this.filters.priority = e.target.value;
        this.applyFilters();
      });
    }

    if (subTypeFilter) {
      subTypeFilter.addEventListener('change', (e) => {
        this.filters.sub_type = e.target.value;
        this.applyFilters();
      });
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshData();
      });
    }

    // Assignment modal
    this.setupAssignmentModal();
  }

  setupAssignmentModal() {
    const assignmentModal = document.getElementById('assignment-modal');
    const assignmentForm = document.getElementById('assignment-form');
    const closeModal = document.getElementById('close-assignment-modal');
    const cancelBtn = document.getElementById('cancel-assignment');

    if (closeModal) {
      closeModal.addEventListener('click', () => {
        this.closeAssignmentModal();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.closeAssignmentModal();
      });
    }

    if (assignmentForm) {
      assignmentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleAssignment();
      });
    }

    // Close modal when clicking outside
    if (assignmentModal) {
      assignmentModal.addEventListener('click', (e) => {
        if (e.target === assignmentModal) {
          this.closeAssignmentModal();
        }
      });
    }
  }

  async applyFilters() {
    console.log('[LGU_ADMIN_ASSIGNMENTS] Applying filters:', this.filters);
    await this.loadAssignments();
    this.renderAssignments();
  }

  async refreshData() {
    console.log('[LGU_ADMIN_ASSIGNMENTS] Refreshing data...');
    showMessage('info', 'Refreshing assignments...');
    await this.loadAssignments();
    await this.loadOfficers();
    this.renderAssignments();
    showMessage('success', 'Assignments refreshed');
  }

  renderAssignments() {
    console.log('[LGU_ADMIN_ASSIGNMENTS] Rendering assignments...');
    console.log('[LGU_ADMIN_ASSIGNMENTS] Assignments count:', this.assignments.length);
    console.log('[LGU_ADMIN_ASSIGNMENTS] Assignments data:', this.assignments);
    
    // Hide loading state
    const loadingState = document.getElementById('loading-state');
    if (loadingState) {
      loadingState.style.display = 'none';
    }

    // Get the assignments list container (not the entire container)
    const assignmentsList = document.getElementById('assignments-list');
    const emptyState = document.getElementById('empty-state');
    
    if (!assignmentsList) {
      console.error('[LGU_ADMIN_ASSIGNMENTS] Assignments list container not found!');
      return;
    }

    if (this.assignments.length === 0) {
      console.log('[LGU_ADMIN_ASSIGNMENTS] No assignments, showing empty state');
      assignmentsList.style.display = 'none';
      if (emptyState) {
        emptyState.style.display = 'block';
      }
      this.updateStats();
      return;
    }

    console.log('[LGU_ADMIN_ASSIGNMENTS] Rendering assignment cards...');
    const paginatedAssignments = this.getPaginatedAssignments();
    
    assignmentsList.innerHTML = paginatedAssignments.map(assignment => this.renderAssignmentCard(assignment)).join('');
    assignmentsList.style.display = 'block';
    
    if (emptyState) {
      emptyState.style.display = 'none';
    }

    // Update stats
    this.updateStats();

    // Add event listeners to assignment cards
    this.setupAssignmentCardListeners();
  }

  getPaginatedAssignments() {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.assignments.slice(startIndex, endIndex);
  }

  updateStats() {
    console.log('[LGU_ADMIN_ASSIGNMENTS] Updating stats...');
    
    // Calculate stats
    const unassigned = this.assignments.filter(a => a.status === 'unassigned').length;
    const urgent = this.assignments.filter(a => a.priority === 'urgent').length;
    const high = this.assignments.filter(a => a.priority === 'high').length;
    
    console.log('[LGU_ADMIN_ASSIGNMENTS] Stats calculated:', { unassigned, urgent, high });
    
    // Update stat elements
    const unassignedEl = document.getElementById('stat-unassigned');
    const urgentEl = document.getElementById('stat-urgent');
    const highEl = document.getElementById('stat-high');
    
    if (unassignedEl) unassignedEl.textContent = unassigned;
    if (urgentEl) urgentEl.textContent = urgent;
    if (highEl) highEl.textContent = high;
  }

  renderAssignmentCard(assignment) {
    const statusClass = this.getStatusClass(assignment.status);
    const priorityClass = this.getPriorityClass(assignment.priority);
    const assignedDate = new Date(assignment.assigned_at).toLocaleDateString();
    const submittedDate = new Date(assignment.submitted_at).toLocaleDateString();

    return `
      <div class="assignment-card" data-assignment-id="${assignment.id}" data-complaint-id="${assignment.complaint_id}">
        <div class="assignment-header">
          <div class="assignment-title">
            <h4>${this.escapeHtml(assignment.title || 'Untitled Complaint')}</h4>
            <div class="assignment-meta">
              <span class="assignment-id">#${assignment.complaint_id.slice(-8)}</span>
              <span class="assignment-date">Submitted: ${submittedDate}</span>
            </div>
          </div>
          <div class="assignment-status">
            <span class="status-badge ${statusClass}">${this.getStatusText(assignment.status)}</span>
            <span class="priority-badge ${priorityClass}">${assignment.priority}</span>
          </div>
        </div>
        
        <div class="assignment-content">
          <div class="assignment-description">
            <p>${this.escapeHtml(assignment.description || 'No description available')}</p>
          </div>
          
          <div class="assignment-details">
            <div class="detail-item">
              <span class="detail-label">Location:</span>
              <span class="detail-value">${this.escapeHtml(assignment.location_text || 'Not specified')}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">Citizen:</span>
              <span class="detail-value">${this.escapeHtml(assignment.citizen_name || 'Unknown')}</span>
            </div>
            ${assignment.officer_name ? `
              <div class="detail-item">
                <span class="detail-label">Assigned Officer:</span>
                <span class="detail-value">${this.escapeHtml(assignment.officer_name)}</span>
              </div>
            ` : ''}
            ${assignment.deadline ? `
              <div class="detail-item">
                <span class="detail-label">Deadline:</span>
                <span class="detail-value">${new Date(assignment.deadline).toLocaleDateString()}</span>
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="assignment-actions">
          <button class="btn btn-outline view-details-btn" data-complaint-id="${assignment.complaint_id}">
            View Details
          </button>
          ${assignment.status === 'unassigned' ? `
            <button class="btn btn-primary assign-btn" data-complaint-id="${assignment.complaint_id}">
              Assign to Officer
            </button>
          ` : `
            <button class="btn btn-secondary view-btn" data-complaint-id="${assignment.complaint_id}">
              View Assignment
            </button>
            <button class="btn btn-outline reassign-btn" data-complaint-id="${assignment.complaint_id}">
              Reassign
            </button>
          `}
        </div>
      </div>
    `;
  }

  setupAssignmentCardListeners() {
         // View Details buttons (for all complaints)
         document.querySelectorAll('.view-details-btn').forEach(btn => {
           btn.addEventListener('click', (e) => {
             const complaintId = e.target.dataset.complaintId;
             this.openComplaintDetailsPanel(complaintId);
           });
         });

    // Assign buttons
    document.querySelectorAll('.assign-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        console.log('[LGU_ADMIN_ASSIGNMENTS] Assign button clicked:', e.target);
        const complaintId = e.target.dataset.complaintId;
        console.log('[LGU_ADMIN_ASSIGNMENTS] Complaint ID from button:', complaintId);
        this.openAssignmentModal(complaintId);
      });
    });

    // Reassign buttons
    document.querySelectorAll('.reassign-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const complaintId = e.target.dataset.complaintId;
        this.openAssignmentModal(complaintId, true);
      });
    });

    // View Assignment buttons (for assigned complaints)
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const complaintId = e.target.dataset.complaintId;
        this.viewComplaintDetails(complaintId);
      });
    });
  }

  openAssignmentModal(complaintId, isReassign = false) {
    console.log('[LGU_ADMIN_ASSIGNMENTS] Opening assignment modal for complaint:', complaintId);
    
    const modal = document.getElementById('assignment-modal');
    const form = document.getElementById('assignment-form');
    const modalTitle = modal?.querySelector('h2');
    const officerCheckboxes = document.getElementById('officer-checkboxes');
    const complaintSummary = document.getElementById('complaint-summary');

    console.log('[LGU_ADMIN_ASSIGNMENTS] Modal elements found:', {
      modal: !!modal,
      form: !!form,
      modalTitle: !!modalTitle,
      officerCheckboxes: !!officerCheckboxes,
      complaintSummary: !!complaintSummary
    });

    if (!modal || !form || !officerCheckboxes) {
      console.error('[LGU_ADMIN_ASSIGNMENTS] Modal elements not found:', {
        modal: !!modal,
        form: !!form,
        officerCheckboxes: !!officerCheckboxes
      });
      return;
    }

    // Set modal title
    if (modalTitle) {
      modalTitle.textContent = isReassign ? 'Reassign Complaint' : 'Assign to Officer';
    }

    // Set current complaint ID
    this.currentComplaintId = complaintId;

    // Find the complaint data
    const complaint = this.assignments.find(a => a.complaint_id === complaintId);
    if (complaint && complaintSummary) {
      complaintSummary.dataset.complaintId = complaintId;
      complaintSummary.innerHTML = `
        <div class="complaint-summary-title">${this.escapeHtml(complaint.title || 'Untitled Complaint')}</div>
        <div class="complaint-summary-detail"><strong>ID:</strong> #${complaint.complaint_id.slice(-8)}</div>
        <div class="complaint-summary-detail"><strong>Description:</strong> ${this.escapeHtml(complaint.description || 'No description')}</div>
        <div class="complaint-summary-detail"><strong>Location:</strong> ${this.escapeHtml(complaint.location_text || 'Not specified')}</div>
        <div class="complaint-summary-detail"><strong>Citizen:</strong> ${this.escapeHtml(complaint.citizen_name || 'Unknown')}</div>
      `;
    }

    // Populate officer checkboxes
    // officerCheckboxes already declared above
    if (officerCheckboxes) {
      officerCheckboxes.innerHTML = '';
      
      if (this.officers.length === 0) {
        officerCheckboxes.innerHTML = '<div class="no-officers">No officers available</div>';
      } else {
        this.officers.forEach(officer => {
          const checkboxItem = document.createElement('div');
          checkboxItem.className = 'officer-checkbox-item';
          checkboxItem.innerHTML = `
            <input type="checkbox" id="officer-${officer.id}" value="${officer.id}" name="officers">
            <label for="officer-${officer.id}">
              <div class="officer-info">
                <div class="officer-name">${this.escapeHtml(officer.name)}</div>
                <div class="officer-details">${this.escapeHtml(officer.email)} • ${officer.employee_id || 'No ID'}</div>
              </div>
            </label>
          `;
          officerCheckboxes.appendChild(checkboxItem);
        });
      }
    }

    // Show modal
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    modal.style.zIndex = '9999';
    document.body.style.overflow = 'hidden';
  }

  closeAssignmentModal() {
    const modal = document.getElementById('assignment-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  openComplaintDetailsPanel(complaintId) {
    console.log('[LGU_ADMIN_ASSIGNMENTS] Opening complaint details panel for:', complaintId);
    
    // Find the complaint data
    const complaint = this.assignments.find(a => a.complaint_id === complaintId);
    if (!complaint) {
      console.error('[LGU_ADMIN_ASSIGNMENTS] Complaint not found:', complaintId);
      showMessage('error', 'Complaint not found');
      return;
    }

    // Create details panel if it doesn't exist
    let panel = document.getElementById('complaint-details-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'complaint-details-panel';
      panel.className = 'complaint-details-panel';
      panel.innerHTML = `
        <div class="details-panel-header">
          <h3>Complaint Details</h3>
          <button class="close-details-panel" id="close-details-panel">&times;</button>
        </div>
        <div class="details-panel-content" id="complaint-details-content">
          <!-- Content will be populated here -->
        </div>
        <div class="details-panel-footer" id="complaint-details-footer">
          <!-- Action buttons will be populated here -->
        </div>
      `;
      document.body.appendChild(panel);
      
      // Add event listeners
      document.getElementById('close-details-panel').addEventListener('click', () => {
        this.closeComplaintDetailsPanel();
      });
    }

    // Populate panel content
    const content = document.getElementById('complaint-details-content');
    const footer = document.getElementById('complaint-details-footer');
    
    content.innerHTML = this.generateComplaintDetailsHTML(complaint);
    footer.innerHTML = this.generateComplaintDetailsFooter(complaint);

    // Add event listeners for action buttons
    const assignBtn = document.getElementById('assign-from-details');
    if (assignBtn) {
      assignBtn.addEventListener('click', () => {
        this.closeComplaintDetailsPanel();
        this.openAssignmentModal(complaintId);
      });
    }

    // Show panel
    panel.classList.add('active');
    document.body.classList.add('details-panel-open');
    
    // Load evidence after a short delay to ensure the panel is visible
    setTimeout(() => {
      this.loadComplaintEvidence(complaintId);
    }, 100);
  }

  generateComplaintDetailsHTML(complaint) {
    const submittedDate = new Date(complaint.submitted_at).toLocaleString();
    const priorityClass = this.getPriorityClass(complaint.priority);
    
    return `
      <div class="complaint-details">
        <!-- Header Section -->
        <div class="details-header">
          <div class="complaint-title-section">
            <h4>${this.escapeHtml(complaint.title || 'Untitled Complaint')}</h4>
            <span class="priority-badge ${priorityClass}">${complaint.priority || 'Medium'}</span>
          </div>
          <div class="complaint-meta">
            <span class="complaint-id">ID: #${complaint.complaint_id.slice(-8)}</span>
            <span class="submission-date">Submitted: ${submittedDate}</span>
          </div>
        </div>

        <!-- Main Content Sections -->
        <div class="details-sections">
          <!-- Description Section -->
          <div class="details-section">
            <div class="section-header">
              <h5>📝 Description</h5>
            </div>
            <div class="section-content">
              <p>${this.escapeHtml(complaint.description || 'No description provided')}</p>
            </div>
          </div>

          <!-- Location Section -->
          <div class="details-section">
            <div class="section-header">
              <h5>📍 Location</h5>
            </div>
            <div class="section-content">
              <p>${this.escapeHtml(complaint.location_text || 'Location not specified')}</p>
              ${complaint.latitude && complaint.longitude ? `
                <div class="map-container">
                  <div id="complaint-map-${complaint.complaint_id}" class="complaint-map"></div>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Complainant Section -->
          <div class="details-section">
            <div class="section-header">
              <h5>👤 Complainant</h5>
            </div>
            <div class="section-content">
              <div class="complainant-info">
                <p><strong>Name:</strong> ${this.escapeHtml(complaint.citizen_name || 'Unknown')}</p>
                ${complaint.citizen_email ? `<p><strong>Email:</strong> ${this.escapeHtml(complaint.citizen_email)}</p>` : ''}
                ${complaint.citizen_mobile ? `<p><strong>Mobile:</strong> ${this.escapeHtml(complaint.citizen_mobile)}</p>` : ''}
              </div>
            </div>
          </div>

          <!-- Evidence Section -->
          <div class="details-section">
            <div class="section-header">
              <h5>📎 Evidence</h5>
            </div>
            <div class="section-content">
              <div class="evidence-container" id="evidence-container-${complaint.complaint_id}">
                <div class="evidence-loading">Loading evidence...</div>
              </div>
            </div>
          </div>

          <!-- Assignment Status Section -->
          <div class="details-section">
            <div class="section-header">
              <h5>📋 Assignment Status</h5>
            </div>
            <div class="section-content">
              <div class="status-info">
                <div class="status-item">
                  <span class="status-label">Status:</span>
                  <span class="status-value ${complaint.status === 'unassigned' ? 'unassigned' : 'assigned'}">
                    ${complaint.status === 'unassigned' ? '⏳ Unassigned' : '✅ Assigned'}
                  </span>
                </div>
                ${complaint.officer_name ? `
                  <div class="status-item">
                    <span class="status-label">Assigned to:</span>
                    <span class="status-value">${this.escapeHtml(complaint.officer_name)}</span>
                  </div>
                ` : ''}
                ${complaint.assigned_at ? `
                  <div class="status-item">
                    <span class="status-label">Assigned:</span>
                    <span class="status-value">${new Date(complaint.assigned_at).toLocaleString()}</span>
                  </div>
                ` : ''}
                ${complaint.deadline ? `
                  <div class="status-item">
                    <span class="status-label">Deadline:</span>
                    <span class="status-value deadline">${new Date(complaint.deadline).toLocaleString()}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>

          ${complaint.notes ? `
            <!-- Notes Section -->
            <div class="details-section">
              <div class="section-header">
                <h5>📝 Notes</h5>
              </div>
              <div class="section-content">
                <p>${this.escapeHtml(complaint.notes)}</p>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  generateComplaintDetailsFooter(complaint) {
    return `
      <div class="details-footer-actions">
        <button type="button" class="btn-secondary" id="close-details-panel">Close</button>
        ${complaint.status === 'unassigned' ? `
          <button type="button" class="btn-primary" id="assign-from-details">
            Assign to Officer
          </button>
        ` : `
          <button type="button" class="btn-secondary" id="view-assignment">
            View Assignment
          </button>
          <button type="button" class="btn-outline" id="reassign-from-details">
            Reassign
          </button>
        `}
      </div>
    `;
  }

  async loadComplaintEvidence(complaintId) {
    try {
      console.log('[LGU_ADMIN_ASSIGNMENTS] Loading evidence for complaint:', complaintId);
      
      const evidenceContainer = document.getElementById(`evidence-container-${complaintId}`);
      if (!evidenceContainer) {
        console.error('[LGU_ADMIN_ASSIGNMENTS] Evidence container not found for complaint:', complaintId);
        return;
      }

      // Show loading state
      evidenceContainer.innerHTML = `
        <div class="evidence-loading">
          <div class="loading-spinner"></div>
          <p>Loading evidence files...</p>
        </div>
      `;

      // Make API call to get evidence files from Supabase bucket
      const response = await fetch(`/api/complaints/${complaintId}/evidence`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load evidence: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load evidence');
      }

      const evidenceFiles = result.data || [];
      
      if (evidenceFiles.length === 0) {
        evidenceContainer.innerHTML = `
          <div class="evidence-empty">
            <p>No evidence files uploaded for this complaint</p>
          </div>
        `;
        return;
      }

      // Render evidence files
      const evidenceHTML = evidenceFiles.map(file => {
        const fileIcon = this.getFileIcon(file.name);
        const fileSize = this.formatFileSize(file.size);
        const isImage = this.isImageFile(file.name);
        
        return `
          <div class="evidence-item" data-file-name="${file.name}">
            <div class="evidence-icon">${fileIcon}</div>
            <div class="evidence-info">
              <div class="evidence-name" title="${file.name}">${file.name}</div>
              <div class="evidence-size">${fileSize}</div>
            </div>
            <div class="evidence-actions">
              ${isImage ? `
                <button class="btn-sm btn-outline" onclick="this.previewEvidence('${file.name}', '${file.url}')">
                  Preview
                </button>
              ` : ''}
              <button class="btn-sm btn-primary" onclick="this.downloadEvidence('${file.name}', '${file.url}')">
                Download
              </button>
            </div>
          </div>
        `;
      }).join('');

      evidenceContainer.innerHTML = `
        <div class="evidence-list">
          ${evidenceHTML}
        </div>
      `;

      // Add event listeners for evidence actions
      this.setupEvidenceActionListeners(complaintId);

    } catch (error) {
      console.error('[LGU_ADMIN_ASSIGNMENTS] Error loading evidence:', error);
      const evidenceContainer = document.getElementById(`evidence-container-${complaintId}`);
      if (evidenceContainer) {
        evidenceContainer.innerHTML = `
          <div class="evidence-error">
            <p>Unable to load evidence files</p>
            <p class="error-details">${error.message}</p>
          </div>
        `;
      }
    }
  }

  setupEvidenceActionListeners(complaintId) {
    // Preview buttons
    document.querySelectorAll(`#evidence-container-${complaintId} .btn-outline`).forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fileName = e.target.closest('.evidence-item').dataset.fileName;
        const fileUrl = e.target.onclick.toString().match(/'([^']+)'/)[1];
        this.previewEvidence(fileName, fileUrl);
      });
    });

    // Download buttons
    document.querySelectorAll(`#evidence-container-${complaintId} .btn-primary`).forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fileName = e.target.closest('.evidence-item').dataset.fileName;
        const fileUrl = e.target.onclick.toString().match(/'([^']+)'/)[1];
        this.downloadEvidence(fileName, fileUrl);
      });
    });
  }

  getFileIcon(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    const iconMap = {
      'pdf': '📄',
      'doc': '📄',
      'docx': '📄',
      'jpg': '📷',
      'jpeg': '📷',
      'png': '📷',
      'gif': '📷',
      'mp4': '🎥',
      'avi': '🎥',
      'mov': '🎥',
      'mp3': '🎵',
      'wav': '🎵',
      'txt': '📝',
      'zip': '📦',
      'rar': '📦'
    };
    return iconMap[extension] || '📎';
  }

  formatFileSize(bytes) {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  isImageFile(fileName) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    const extension = fileName.split('.').pop().toLowerCase();
    return imageExtensions.includes(extension);
  }

  previewEvidence(fileName, fileUrl) {
    console.log('[LGU_ADMIN_ASSIGNMENTS] Previewing evidence:', fileName);
    
    if (this.isImageFile(fileName)) {
      // Open image in new tab
      window.open(fileUrl, '_blank');
    } else {
      // For non-images, try to open in new tab
      window.open(fileUrl, '_blank');
    }
  }

  downloadEvidence(fileName, fileUrl) {
    console.log('[LGU_ADMIN_ASSIGNMENTS] Downloading evidence:', fileName);
    
    // Create a temporary link element to trigger download
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  closeComplaintDetailsPanel() {
    const panel = document.getElementById('complaint-details-panel');
    if (panel) {
      panel.classList.remove('active');
      document.body.classList.remove('details-panel-open');
    }
  }

  getPriorityClass(priority) {
    const priorityClasses = {
      'low': 'priority-low',
      'medium': 'priority-medium', 
      'high': 'priority-high',
      'urgent': 'priority-urgent'
    };
    return priorityClasses[priority] || 'priority-medium';
  }


  async handleAssignment() {
    const form = document.getElementById('assignment-form');
    if (!form) return;

    // Get selected officers from checkboxes
    const selectedOfficers = Array.from(document.querySelectorAll('input[name="officers"]:checked'))
      .map(checkbox => checkbox.value);
    
    const prioritySelect = document.getElementById('priority-select');
    const deadlineInput = document.getElementById('deadline-input');
    const notesInput = document.getElementById('notes-input');
    
    const priority = prioritySelect?.value;
    const deadline = deadlineInput?.value;
    const notes = notesInput?.value;
    
    // Get complaint ID from the complaint summary or find it from current assignment
    const complaintSummary = document.getElementById('complaint-summary');
    const complaintId = complaintSummary?.dataset?.complaintId || this.currentComplaintId;

    if (!complaintId || selectedOfficers.length === 0) {
      showMessage('error', 'Please select at least one officer');
      return;
    }

    try {
      console.log('[LGU_ADMIN_ASSIGNMENTS] Assigning complaint:', { 
        complaintId, 
        officerIds: selectedOfficers, 
        priority, 
        deadline, 
        notes 
      });
      
      // Send all officer IDs in a single request
      const response = await apiClient.post(`/api/lgu-admin/complaints/${complaintId}/assign`, {
        officerIds: selectedOfficers,
        priority,
        deadline: deadline || null,
        notes: notes || null
      });

      if (response && response.success) {
        const message = response.total_officers > 1 
          ? `Complaint assigned to ${response.total_officers} officers successfully`
          : 'Complaint assigned successfully';
        
        showMessage('success', message);
        this.closeAssignmentModal();
        await this.refreshData();
      } else {
        throw new Error(response?.error || 'Failed to assign complaint');
      }
    } catch (error) {
      console.error('[LGU_ADMIN_ASSIGNMENTS] Assignment error:', error);
      showMessage('error', 'Failed to assign complaint');
    }
  }

  viewComplaintDetails(complaintId) {
    // Navigate to complaint details page
    window.location.href = `/complaint-details?id=${complaintId}`;
  }

  renderPagination() {
    const totalPages = Math.ceil(this.assignments.length / this.itemsPerPage);
    if (totalPages <= 1) return '';

    return `
      <div class="pagination">
        <button class="btn btn-outline" ${this.currentPage === 1 ? 'disabled' : ''} onclick="assignmentsPage.previousPage()">
          Previous
        </button>
        <span class="pagination-info">
          Page ${this.currentPage} of ${totalPages}
        </span>
        <button class="btn btn-outline" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="assignmentsPage.nextPage()">
          Next
        </button>
      </div>
    `;
  }

  nextPage() {
    const totalPages = Math.ceil(this.assignments.length / this.itemsPerPage);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.renderAssignments();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderAssignments();
    }
  }

  getStatusClass(status) {
    const statusClasses = {
      'unassigned': 'status-unassigned',
      'assigned': 'status-assigned',
      'active': 'status-active',
      'in_progress': 'status-in-progress',
      'completed': 'status-completed',
      'cancelled': 'status-cancelled'
    };
    return statusClasses[status] || 'status-unknown';
  }

  getStatusText(status) {
    const statusTexts = {
      'unassigned': 'Unassigned',
      'assigned': 'Assigned',
      'active': 'Active',
      'in_progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };
    return statusTexts[status] || status;
  }

  getPriorityClass(priority) {
    const priorityClasses = {
      'low': 'priority-low',
      'medium': 'priority-medium',
      'high': 'priority-high',
      'urgent': 'priority-urgent'
    };
    return priorityClasses[priority] || 'priority-medium';
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the assignments page
const assignmentsPage = new LguAdminAssignments();

// Make methods available globally for pagination
window.assignmentsPage = assignmentsPage;

document.addEventListener('DOMContentLoaded', () => {
  assignmentsPage.init();
});
