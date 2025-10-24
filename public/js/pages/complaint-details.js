// Complaint Details Page JavaScript

import showToast from '../components/toast.js';

class ComplaintDetails {
    constructor() {
        this.complaintId = null;
        this.complaint = null;
        this.userRole = null;
        this.init();
    }

    async init() {
        try {
            // Get complaint ID from URL
            const pathParts = window.location.pathname.split('/');
            this.complaintId = pathParts[pathParts.length - 1];
            
            if (!this.complaintId || this.complaintId === 'complaint-details') {
                throw new Error('Invalid complaint ID');
            }

            // Get user role
            this.userRole = await this.getUserRole();
            
            // Load complaint details
            await this.loadComplaintDetails();
            
            // Setup role-specific UI
            this.setupRoleSpecificUI();
            
        } catch (error) {
            console.error('Error initializing complaint details:', error);
            this.showError('Failed to load complaint details: ' + error.message);
        }
    }

    async getUserRole() {
        try {
            const response = await fetch('/api/user/role', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to get user role');
            }

            const data = await response.json();
            return data.role;
        } catch (error) {
            console.error('Error getting user role:', error);
            return 'citizen'; // Default fallback
        }
    }

    async loadComplaintDetails() {
        try {
            this.showLoading();

            const response = await fetch(`/api/complaints/${this.complaintId}`, {
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
                throw new Error(data.error || 'Failed to load complaint');
            }

            this.complaint = data.data;
            this.renderComplaintDetails();
            
        } catch (error) {
            console.error('Error loading complaint details:', error);
            this.showError('Failed to load complaint details: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    renderComplaintDetails() {
        const detailsContainer = document.getElementById('complaint-details');
        if (!detailsContainer) return;

        // Populate basic complaint info
        document.getElementById('complaint-title').textContent = this.complaint.title || 'Untitled Complaint';
        document.getElementById('complaint-id').textContent = `#${this.complaint.id}`;
        document.getElementById('complaint-status').textContent = this.complaint.status || 'Unknown';
        document.getElementById('complaint-status').className = `complaint-status status-${(this.complaint.status || 'pending').toLowerCase().replace(' ', '-')}`;
        document.getElementById('complaint-priority').textContent = this.complaint.priority || 'Medium';
        document.getElementById('complaint-priority').className = `complaint-priority priority-${(this.complaint.priority || 'medium').toLowerCase()}`;
        document.getElementById('complaint-description').textContent = this.complaint.description || 'No description provided';

        // Populate location
        this.renderLocation();

        // Populate departments
        this.renderDepartments();

        // Populate attachments
        this.renderAttachments();

        // Populate timeline
        this.renderTimeline();

        // Show the details
        detailsContainer.style.display = 'block';
    }

    renderLocation() {
        const locationContainer = document.getElementById('complaint-location');
        if (!locationContainer) return;

        if (this.complaint.address) {
            locationContainer.innerHTML = `
                <div class="location-address">${this.complaint.address}</div>
                ${this.complaint.latitude && this.complaint.longitude ? 
                    `<div class="location-coordinates">${this.complaint.latitude}, ${this.complaint.longitude}</div>` : 
                    ''
                }
            `;
        } else {
            locationContainer.innerHTML = '<p>No location information provided</p>';
        }
    }

    renderDepartments() {
        const departmentsContainer = document.getElementById('assigned-departments');
        if (!departmentsContainer) return;

        const departments = this.complaint.assigned_departments || this.complaint.department_r || [];
        const preferredDepartments = this.complaint.preferred_departments || [];

        if (departments.length === 0) {
            departmentsContainer.innerHTML = '<p>No departments assigned</p>';
            return;
        }

        departmentsContainer.innerHTML = departments.map(dept => {
            const isPreferred = preferredDepartments.includes(dept);
            return `
                <div class="department-badge ${isPreferred ? 'preferred' : ''}">
                    ${dept}
                </div>
            `;
        }).join('');
    }

    renderAttachments() {
        const attachmentsContainer = document.getElementById('complaint-attachments');
        if (!attachmentsContainer) return;

        const attachments = this.complaint.attachments || [];

        if (attachments.length === 0) {
            attachmentsContainer.innerHTML = '<p>No attachments</p>';
            return;
        }

        attachmentsContainer.innerHTML = attachments.map(attachment => `
            <a href="${attachment.url}" class="attachment-item" target="_blank">
                <span class="attachment-icon">📎</span>
                <span>${attachment.name || 'Attachment'}</span>
            </a>
        `).join('');
    }

    renderTimeline() {
        const timelineContainer = document.getElementById('timeline-items');
        if (!timelineContainer) return;

        const timeline = this.complaint.timeline || this.generateTimeline();
        
        timelineContainer.innerHTML = timeline.map(item => `
            <div class="timeline-item">
                <div class="timeline-icon">${item.icon}</div>
                <div class="timeline-content">
                    <div class="timeline-title">${item.title}</div>
                    <div class="timeline-description">${item.description}</div>
                    <div class="timeline-date">${item.date}</div>
                </div>
            </div>
        `).join('');
    }

    generateTimeline() {
        const timeline = [];
        const now = new Date();

        // Submitted
        timeline.push({
            icon: '📝',
            title: 'Complaint Submitted',
            description: 'Complaint was submitted by citizen',
            date: this.formatDate(this.complaint.created_at || this.complaint.submitted_at)
        });

        // Status changes
        if (this.complaint.status === 'approved') {
            timeline.push({
                icon: '✅',
                title: 'Complaint Approved',
                description: 'Complaint was approved by coordinator',
                date: this.formatDate(this.complaint.updated_at)
            });
        }

        if (this.complaint.status === 'assigned') {
            timeline.push({
                icon: '🏢',
                title: 'Assigned to Department',
                description: 'Complaint was assigned to department(s)',
                date: this.formatDate(this.complaint.updated_at)
            });
        }

        if (this.complaint.status === 'in progress') {
            timeline.push({
                icon: '👷',
                title: 'Work in Progress',
                description: 'Department is working on the complaint',
                date: this.formatDate(this.complaint.updated_at)
            });
        }

        if (this.complaint.status === 'resolved') {
            timeline.push({
                icon: '✅',
                title: 'Resolved',
                description: 'Complaint has been resolved by department',
                date: this.formatDate(this.complaint.resolved_at || this.complaint.updated_at)
            });
        }

        if (this.complaint.status === 'closed') {
            timeline.push({
                icon: '🔒',
                title: 'Closed',
                description: 'Complaint has been closed',
                date: this.formatDate(this.complaint.updated_at)
            });
        }

        if (this.complaint.status === 'rejected') {
            timeline.push({
                icon: '❌',
                title: 'Rejected',
                description: 'Complaint was rejected by coordinator',
                date: this.formatDate(this.complaint.updated_at)
            });
        }

        if (this.complaint.status === 'cancelled') {
            timeline.push({
                icon: '🚫',
                title: 'Cancelled',
                description: 'Complaint was cancelled by citizen',
                date: this.formatDate(this.complaint.cancelled_at || this.complaint.updated_at)
            });
        }

        return timeline;
    }

    setupRoleSpecificUI() {
        this.setupReturnButton();
        this.setupRoleSpecificActions();
    }

    setupReturnButton() {
        const returnLink = document.getElementById('return-link');
        const returnText = document.getElementById('return-text');
        
        if (!returnLink || !returnText) return;

        switch (this.userRole) {
            case 'complaint-coordinator':
                returnLink.href = '/coordinator/review-queue';
                returnText.textContent = 'Return to Review Queue';
                break;
            case 'lgu-admin':
                returnLink.href = '/lgu-admin/assignments';
                returnText.textContent = 'Return to Assigned Complaints';
                break;
            case 'lgu-officer':
                returnLink.href = '/lgu-officer/tasks';
                returnText.textContent = 'Return to Assigned Tasks';
                break;
            case 'citizen':
            default:
                returnLink.href = '/citizen/dashboard';
                returnText.textContent = 'Return to Your Complaints';
                break;
        }
    }

    setupRoleSpecificActions() {
        const actionsContainer = document.getElementById('complaint-actions');
        if (!actionsContainer) return;

        let actions = [];

        switch (this.userRole) {
            case 'complaint-coordinator':
                if (this.complaint.status === 'pending review') {
                    actions.push(
                        { text: 'Approve', class: 'btn btn-success', action: 'approve' },
                        { text: 'Reject', class: 'btn btn-danger', action: 'reject' }
                    );
                }
                break;

            case 'lgu-admin':
                if (this.complaint.status === 'approved' || this.complaint.status === 'assigned') {
                    actions.push(
                        { text: 'Assign to Officer', class: 'btn btn-primary', action: 'assign-officer' }
                    );
                }
                break;

            case 'lgu-officer':
                if (this.complaint.status === 'assigned' || this.complaint.status === 'in progress') {
                    actions.push(
                        { text: 'Mark as Resolved', class: 'btn btn-success', action: 'mark-resolved' }
                    );
                }
                break;

            case 'citizen':
                if (this.complaint.status === 'pending review' || this.complaint.status === 'approved') {
                    actions.push(
                        { text: 'Cancel Complaint', class: 'btn btn-warning', action: 'cancel' }
                    );
                }
                if (this.complaint.status === 'resolved') {
                    actions.push(
                        { text: 'Confirm Resolution', class: 'btn btn-success', action: 'confirm-resolution' }
                    );
                }
                if (this.complaint.status !== 'cancelled' && this.complaint.status !== 'closed') {
                    actions.push(
                        { text: 'Send Reminder', class: 'btn btn-info', action: 'remind' }
                    );
                }
                break;
        }

        actionsContainer.innerHTML = actions.map(action => `
            <button class="${action.class}" data-action="${action.action}">
                ${action.text}
            </button>
        `).join('');

        // Attach event listeners
        actionsContainer.querySelectorAll('button[data-action]').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action');
                this.handleAction(action);
            });
        });
    }

    async handleAction(action) {
        switch (action) {
            case 'approve':
                await this.approveComplaint();
                break;
            case 'reject':
                await this.rejectComplaint();
                break;
            case 'assign-officer':
                await this.assignToOfficer();
                break;
            case 'mark-resolved':
                await this.markAsResolved();
                break;
            case 'cancel':
                await this.cancelComplaint();
                break;
            case 'confirm-resolution':
                await this.confirmResolution();
                break;
            case 'remind':
                await this.sendReminder();
                break;
        }
    }

    async approveComplaint() {
        // Redirect to coordinator review queue with approval action
        window.location.href = `/coordinator/review-queue?action=approve&id=${this.complaintId}`;
    }

    async rejectComplaint() {
        const reason = prompt('Please provide a reason for rejection:');
        if (!reason) return;

        try {
            const response = await fetch(`/api/coordinator/review-queue/${this.complaintId}/decide`, {
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

            const result = await response.json();
            
            if (result.success) {
                showToast('Complaint rejected successfully', 'success');
                this.loadComplaintDetails(); // Refresh
            } else {
                throw new Error(result.error || 'Failed to reject complaint');
            }
        } catch (error) {
            console.error('Error rejecting complaint:', error);
            showToast('Failed to reject complaint: ' + error.message, 'error');
        }
    }

    async assignToOfficer() {
        // This would open a modal or redirect to assignment page
        showToast('Officer assignment feature coming soon', 'info');
    }

    async markAsResolved() {
        const notes = prompt('Please provide resolution notes:');
        if (!notes) return;

        try {
            const response = await fetch(`/api/lgu-officer/complaints/${this.complaintId}/resolve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    resolution_notes: notes
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                showToast('Complaint marked as resolved', 'success');
                this.loadComplaintDetails(); // Refresh
            } else {
                throw new Error(result.error || 'Failed to mark as resolved');
            }
        } catch (error) {
            console.error('Error marking as resolved:', error);
            showToast('Failed to mark as resolved: ' + error.message, 'error');
        }
    }

    async cancelComplaint() {
        const reason = prompt('Please provide a reason for cancellation:');
        if (!reason) return;

        if (!confirm('Are you sure you want to cancel this complaint?')) {
            return;
        }

        try {
            const response = await fetch(`/api/complaints/${this.complaintId}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    reason
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                showToast('Complaint cancelled successfully', 'success');
                this.loadComplaintDetails(); // Refresh
            } else {
                throw new Error(result.error || 'Failed to cancel complaint');
            }
        } catch (error) {
            console.error('Error cancelling complaint:', error);
            showToast('Failed to cancel complaint: ' + error.message, 'error');
        }
    }

    async confirmResolution() {
        if (!confirm('Are you satisfied with the resolution of this complaint?')) {
            return;
        }

        try {
            const response = await fetch(`/api/complaints/${this.complaintId}/confirm-resolution`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    confirmed: true
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                showToast('Resolution confirmed successfully', 'success');
                this.loadComplaintDetails(); // Refresh
            } else {
                throw new Error(result.error || 'Failed to confirm resolution');
            }
        } catch (error) {
            console.error('Error confirming resolution:', error);
            showToast('Failed to confirm resolution: ' + error.message, 'error');
        }
    }

    async sendReminder() {
        try {
            const response = await fetch(`/api/complaints/${this.complaintId}/remind`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                showToast('Reminder sent successfully', 'success');
            } else {
                throw new Error(result.error || 'Failed to send reminder');
            }
        } catch (error) {
            console.error('Error sending reminder:', error);
            showToast('Failed to send reminder: ' + error.message, 'error');
        }
    }

    showLoading() {
        const loading = document.getElementById('loading');
        const details = document.getElementById('complaint-details');
        const error = document.getElementById('error-state');
        
        if (loading) loading.style.display = 'block';
        if (details) details.style.display = 'none';
        if (error) error.style.display = 'none';
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
    }

    showError(message) {
        const error = document.getElementById('error-state');
        const errorMessage = document.getElementById('error-message');
        const loading = document.getElementById('loading');
        const details = document.getElementById('complaint-details');
        
        if (error) {
            error.style.display = 'block';
            if (errorMessage) errorMessage.textContent = message;
        }
        if (loading) loading.style.display = 'none';
        if (details) details.style.display = 'none';
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ComplaintDetails();
});
