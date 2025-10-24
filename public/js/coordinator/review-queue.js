// Coordinator Review Queue JavaScript

import showToast from '../components/toast.js';

class ReviewQueue {
    constructor() {
        this.complaints = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.filters = {
            status: 'all',
            category: 'all',
            search: ''
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadComplaints();
    }

    setupEventListeners() {
        // Filter controls
        const statusFilter = document.getElementById('status-filter');
        const categoryFilter = document.getElementById('category-filter');
        const searchInput = document.getElementById('search-input');

        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.loadComplaints();
            });
        }

        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.filters.category = e.target.value;
                this.loadComplaints();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.debounce(() => this.loadComplaints(), 300)();
            });
        }

        // Pagination
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.previousPage());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextPage());
        }
    }

    async loadComplaints() {
        try {
            this.showLoading();
            
            const response = await fetch('/api/coordinator/review-queue', {
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
            console.log('Review queue API response:', data);
            this.complaints = data.data || data.complaints || [];
            console.log('Complaints array:', this.complaints);
            this.renderComplaints();
            this.updateStats();
            
        } catch (error) {
            console.error('Error loading complaints:', error);
            this.showError('Failed to load complaints. Please try again.');
        }
    }

    renderComplaints() {
        const complaintList = document.getElementById('complaint-list');
        const loading = document.getElementById('loading');
        const emptyState = document.getElementById('empty-state');
        
        if (!complaintList) {
            console.error('complaint-list element not found');
            return;
        }

        console.log('Rendering complaints, total count:', this.complaints.length);
        const filteredComplaints = this.getFilteredComplaints();
        console.log('Filtered complaints:', filteredComplaints.length);
        const paginatedComplaints = this.getPaginatedComplaints(filteredComplaints);
        console.log('Paginated complaints:', paginatedComplaints.length);

        // Hide loading state
        if (loading) loading.style.display = 'none';

        if (paginatedComplaints.length === 0) {
            complaintList.style.display = 'none';
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
        complaintList.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';

        complaintList.innerHTML = paginatedComplaints.map(complaint => `
            <div class="complaint-card">
                <div class="complaint-header">
                    <div class="complaint-id">#${complaint.id}</div>
                    <div class="complaint-status status-${complaint.status?.toLowerCase() || 'pending'}">
                        ${complaint.status || 'Pending'}
                    </div>
                </div>
                <div class="complaint-content">
                    <h3 class="complaint-title">${complaint.title || 'Untitled Complaint'}</h3>
                    <p class="complaint-description">${complaint.description || 'No description provided'}</p>
                    <div class="complaint-meta">
                        <span class="complaint-category category-${complaint.priority?.toLowerCase() || 'medium'}">
                            ${complaint.category || 'General'}
                        </span>
                        <span class="complaint-date">${this.formatDate(complaint.created_at)}</span>
                    </div>
                </div>
                <div class="complaint-actions">
                    <button class="btn btn-primary view-btn" data-complaint-id="${complaint.id}">
                        View Details
                    </button>
                    <button class="btn btn-success approve-btn" data-complaint-id="${complaint.id}">
                        Approve
                    </button>
                    <button class="btn btn-danger reject-btn" data-complaint-id="${complaint.id}">
                        Reject
                    </button>
                </div>
            </div>
        `).join('');

        this.updatePagination(filteredComplaints.length);
        this.attachEventListeners();
    }

    attachEventListeners() {
        // View buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const complaintId = e.target.getAttribute('data-complaint-id');
                this.viewComplaint(complaintId);
            });
        });

        // Approve buttons
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const complaintId = e.target.getAttribute('data-complaint-id');
                this.approveComplaint(complaintId);
            });
        });

        // Reject buttons
        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const complaintId = e.target.getAttribute('data-complaint-id');
                this.rejectComplaint(complaintId);
            });
        });
    }

    getFilteredComplaints() {
        return this.complaints.filter(complaint => {
            const matchesStatus = this.filters.status === 'all' || 
                                complaint.status?.toLowerCase() === this.filters.status.toLowerCase();
            const matchesCategory = this.filters.category === 'all' || 
                                  complaint.category?.toLowerCase() === this.filters.category.toLowerCase();
            const matchesSearch = this.filters.search === '' || 
                                complaint.title?.toLowerCase().includes(this.filters.search.toLowerCase()) ||
                                complaint.description?.toLowerCase().includes(this.filters.search.toLowerCase());

            return matchesStatus && matchesCategory && matchesSearch;
        });
    }

    getPaginatedComplaints(complaints) {
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return complaints.slice(startIndex, endIndex);
    }

    updateStats() {
        const totalComplaints = this.complaints.length;
        const pendingComplaints = this.complaints.filter(c => c.status?.toLowerCase() === 'pending').length;
        const approvedComplaints = this.complaints.filter(c => c.status?.toLowerCase() === 'approved').length;
        const rejectedComplaints = this.complaints.filter(c => c.status?.toLowerCase() === 'rejected').length;

        this.updateStatCard('total-complaints', totalComplaints);
        this.updateStatCard('pending-complaints', pendingComplaints);
        this.updateStatCard('approved-complaints', approvedComplaints);
        this.updateStatCard('rejected-complaints', rejectedComplaints);
    }

    updateStatCard(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    updatePagination(totalItems) {
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const pageInfo = document.getElementById('page-info');

        if (prevBtn) {
            prevBtn.disabled = this.currentPage === 1;
        }

        if (nextBtn) {
            nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
        }

        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderComplaints();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.getFilteredComplaints().length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderComplaints();
        }
    }

    async viewComplaint(complaintId) {
        try {
            const response = await fetch(`/api/coordinator/review-queue/${complaintId}`, {
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
            this.showComplaintModal(data.complaint);
            
        } catch (error) {
            console.error('Error viewing complaint:', error);
            this.showError('Failed to load complaint details.');
        }
    }

    async approveComplaint(complaintId) {
        try {
            // Get complaint details to show preferred departments
            const complaint = this.complaints.find(c => c.id === complaintId);
            const preferredDepartments = complaint?.preferred_departments || complaint?.department_r || [];
            
            // Show department selection modal
            const modal = new DepartmentSelectionModal();
            await modal.show(complaintId, preferredDepartments, () => {
                this.loadComplaints(); // Refresh the list after approval
            });
        } catch (error) {
            console.error('Error showing approval modal:', error);
            showToast('Failed to load approval options: ' + error.message, 'error');
        }
    }

    async rejectComplaint(complaintId) {
        const reason = prompt('Please provide a reason for rejection:');
        if (!reason) return;

        try {
            const response = await fetch(`/api/coordinator/review-queue/${complaintId}/decide`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ 
                    decision: 'reject',
                    data: { reason }
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            showToast('Complaint rejected successfully', 'success');
            this.loadComplaints();
            
        } catch (error) {
            console.error('Error rejecting complaint:', error);
            this.showError('Failed to reject complaint.');
        }
    }

    showComplaintModal(complaint) {
        // Create modal HTML
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Complaint #${complaint.id}</h2>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="complaint-details">
                        <h3>${complaint.title}</h3>
                        <p><strong>Description:</strong> ${complaint.description}</p>
                        <p><strong>Category:</strong> ${complaint.category || 'General'}</p>
                        <p><strong>Status:</strong> ${complaint.status || 'Pending'}</p>
                        <p><strong>Priority:</strong> ${complaint.priority || 'Medium'}</p>
                        <p><strong>Created:</strong> ${this.formatDate(complaint.created_at)}</p>
                        ${complaint.location ? `<p><strong>Location:</strong> ${complaint.location}</p>` : ''}
                        ${complaint.attachments ? `<p><strong>Attachments:</strong> ${complaint.attachments.length} files</p>` : ''}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-success" onclick="reviewQueue.approveComplaint(${complaint.id}); this.closest('.modal').remove();">
                        Approve
                    </button>
                    <button class="btn btn-danger" onclick="reviewQueue.rejectComplaint(${complaint.id}); this.closest('.modal').remove();">
                        Reject
                    </button>
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove();">
                        Close
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close modal handlers
        modal.querySelector('.close').onclick = () => modal.remove();
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }

    showLoading() {
        const loading = document.getElementById('loading');
        const complaintList = document.getElementById('complaint-list');
        const emptyState = document.getElementById('empty-state');
        
        if (loading) loading.style.display = 'block';
        if (complaintList) complaintList.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
    }

    showError(message) {
        showToast(message, 'error');
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
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
    window.reviewQueue = new ReviewQueue();
});
