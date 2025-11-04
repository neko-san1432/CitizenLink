// Coordinator Review Queue JavaScript
import showToast from '../components/toast.js';

class ReviewQueue {

    constructor() {
        this.complaints = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.filters = {
            priority: '',
            category: '',
            duplicates: '',
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
        const priorityFilter = document.getElementById('filter-priority');
        const categoryFilter = document.getElementById('filter-type');
        const duplicateFilter = document.getElementById('filter-similar');
        const searchInput = document.getElementById('search-input');
        if (priorityFilter) {
            priorityFilter.addEventListener('change', (e) => {
                this.filters.priority = e.target.value;
                this.applyFilters();
            });
        }
        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                this.filters.category = e.target.value;
                this.applyFilters();
            });
        }
        if (duplicateFilter) {
            duplicateFilter.addEventListener('change', (e) => {
                this.filters.duplicates = e.target.value;
                this.applyFilters();
            });
        }
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value;
                this.debounce(() => this.applyFilters(), 300)();
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
    applyFilters() {
        this.currentPage = 1; // Reset to first page when filtering
        this.renderComplaints();
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
        complaintList.innerHTML = paginatedComplaints.map(complaint => this.createComplaintCard(complaint)).join('');
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
        // Reject buttons
        document.querySelectorAll('.reject-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const complaintId = e.target.getAttribute('data-complaint-id');
                this.rejectComplaint(complaintId);
            });
        });
    }
    createComplaintCard(complaint) {
        const priorityBadge = this.getPriorityBadgeClass(complaint.priority);
        const algorithmFlags = complaint.algorithm_flags || {};
        let flagHTML = '';
        if (algorithmFlags.high_confidence_duplicate) {
            flagHTML = `
                <div class="algorithm-flag high-confidence">
                    ⚠️ High confidence duplicate detected
                </div>
            `;
        } else if (algorithmFlags.has_duplicates) {
            flagHTML = `
                <div class="algorithm-flag">
                    🔍 ${algorithmFlags.similarity_count} potential duplicate(s) found
                </div>
            `;
        }
        return `
            <div class="complaint-card" data-complaint-id="${complaint.id}">
                <div class="complaint-header">
                    <div class="complaint-id">#${complaint.id}</div>
                    <div class="complaint-status status-${complaint.workflow_status?.toLowerCase() || complaint.status?.toLowerCase() || 'pending'}">
                        ${complaint.workflow_status || complaint.status || 'Pending'}
                    </div>
                </div>
                <div class="complaint-content">
                    <h3 class="complaint-title">${complaint.title || 'Untitled Complaint'}</h3>
                    <p class="complaint-description">${complaint.descriptive_su || complaint.description || 'No description provided'}</p>
                    <div class="complaint-meta">
                        <span class="badge ${priorityBadge}">${complaint.priority || 'Medium'}</span>
                        <span class="badge badge-medium">${complaint.category || 'General'}</span>
                        <span class="complaint-date">${this.formatTimeAgo(complaint.submitted_at || complaint.created_at)}</span>
                    </div>
                    ${flagHTML}
                </div>
                <div class="complaint-actions">
                    <button class="btn btn-primary view-btn" data-complaint-id="${complaint.id}">
                        View Details
                    </button>
                    <button class="btn btn-danger reject-btn" data-complaint-id="${complaint.id}">
                        Reject
                    </button>
                </div>
            </div>
        `;
    }
    getFilteredComplaints() {
        return this.complaints.filter(complaint => {
            // Priority filter
            const matchesPriority = !this.filters.priority || this.filters.priority === '' || 
                                  complaint.priority?.toLowerCase() === this.filters.priority.toLowerCase();
            // Category filter
            const matchesCategory = !this.filters.category || this.filters.category === '' || 
                                  complaint.category?.toLowerCase() === this.filters.category.toLowerCase();
            // Duplicate filter
            const matchesDuplicates = !this.filters.duplicates || this.filters.duplicates === '' || 
                                    (this.filters.duplicates === 'yes' && complaint.algorithm_flags?.has_duplicates) ||
                                    (this.filters.duplicates === 'no' && !complaint.algorithm_flags?.has_duplicates);
            // Search filter
            const matchesSearch = !this.filters.search || this.filters.search === '' || 
                                complaint.title?.toLowerCase().includes(this.filters.search.toLowerCase()) ||
                                (complaint.descriptive_su || complaint.description)?.toLowerCase().includes(this.filters.search.toLowerCase());
            return matchesPriority && matchesCategory && matchesDuplicates && matchesSearch;
        });
    }
    getPaginatedComplaints(complaints) {

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        return complaints.slice(startIndex, endIndex);
    }
    updateStats() {
        const totalComplaints = this.complaints.length;
        const urgentComplaints = this.complaints.filter(c => c.priority?.toLowerCase() === 'urgent').length;
        const highPriorityComplaints = this.complaints.filter(c => c.priority?.toLowerCase() === 'high').length;
        const duplicateComplaints = this.complaints.filter(c => c.algorithm_flags?.has_duplicates).length;
        this.updateStatCard('stat-total', totalComplaints);
        this.updateStatCard('stat-urgent', urgentComplaints);
        this.updateStatCard('stat-high', highPriorityComplaints);
        this.updateStatCard('stat-similar', duplicateComplaints);
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
            // Redirect to the dedicated complaint review page
            window.location.href = `/coordinator/review/${complaintId}`;
        } catch (error) {
            console.error('Error redirecting to complaint details:', error);
            this.showError('Failed to navigate to complaint details.');
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
    getPriorityBadgeClass(priority) {
        const map = {
            'urgent': 'badge-urgent',
            'high': 'badge-high',
            'medium': 'badge-medium',
            'low': 'badge-low'
        };
        return map[priority] || 'badge-medium';
    }
    formatTimeAgo(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return date.toLocaleDateString();
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
