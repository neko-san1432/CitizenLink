// Complaint Details Page JavaScript

import showToast from '../components/toast.js';

class ComplaintDetails {
    constructor() {
        this.complaintId = null;
        this.complaint = null;
        this.userRole = null;
        this.map = null;
        this.routingControl = null;
        this.userLocation = null;
        this.init();
        
        // Cleanup map when page is unloaded
        window.addEventListener('beforeunload', () => {
            if (this.map) {
                this.map.remove();
            }
        });
    }

    async init() {
        try {
            // Get complaint ID from URL - try both path parameter and query parameter
            const pathParts = window.location.pathname.split('/');
            let complaintId = pathParts[pathParts.length - 1];
            
            // If the last part is 'complaint-details', try query parameter
            if (!complaintId || complaintId === 'complaint-details') {
                const urlParams = new URLSearchParams(window.location.search);
                complaintId = urlParams.get('id');
            }
            
            if (!complaintId || complaintId === 'complaint-details') {
                throw new Error('Invalid complaint ID');
            }
            
            this.complaintId = complaintId;

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
            
            // Load evidence/attachments separately
            await this.loadComplaintEvidence();
            
            this.renderComplaintDetails();
            
        } catch (error) {
            console.error('Error loading complaint details:', error);
            this.showError('Failed to load complaint details: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async loadComplaintEvidence() {
        try {
            const response = await fetch(`/api/complaints/${this.complaintId}/evidence`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.complaint.attachments = data.data || [];
                } else {
                    this.complaint.attachments = [];
                }
            } else {
                this.complaint.attachments = [];
            }
        } catch (error) {
            console.error('Error loading complaint evidence:', error);
            this.complaint.attachments = [];
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
        document.getElementById('complaint-description').textContent = this.complaint.descriptive_su || 'No description provided';

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

        if (this.complaint.location_text) {
            locationContainer.innerHTML = `
                <div class="location-address">${this.complaint.location_text}</div>
                ${this.complaint.latitude && this.complaint.longitude ? 
                    `<div class="location-coordinates">${this.complaint.latitude}, ${this.complaint.longitude}</div>
                     <div id="complaint-map" class="complaint-map"></div>` : 
                    ''
                }
            `;
            
            // Initialize map if coordinates are available
            if (this.complaint.latitude && this.complaint.longitude) {
                this.initializeMap();
            }
        } else {
            locationContainer.innerHTML = '<p>No location information provided</p>';
        }
    }

    initializeMap() {
        // Wait a bit for the DOM to be ready
        setTimeout(() => {
            const mapContainer = document.getElementById('complaint-map');
            if (!mapContainer) return;

            try {
                // Initialize the map
                const map = L.map('complaint-map').setView(
                    [this.complaint.latitude, this.complaint.longitude], 
                    15
                );

                // Add OpenStreetMap tiles
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                    maxZoom: 19
                }).addTo(map);

                // Add a marker for the complaint location
                const complaintMarker = L.marker([this.complaint.latitude, this.complaint.longitude]).addTo(map);
                
                // Add popup with complaint information
                complaintMarker.bindPopup(`
                    <div class="map-popup">
                        <h4>${this.complaint.title || 'Complaint Location'}</h4>
                        <p><strong>Address:</strong> ${this.complaint.location_text}</p>
                        <p><strong>Coordinates:</strong> ${this.complaint.latitude}, ${this.complaint.longitude}</p>
                    </div>
                `).openPopup();

                // Store map reference for potential cleanup
                this.map = map;

                // Add route controls for LGU users
                this.addRouteControls(map);

                // Try to get user location and show route (non-blocking)
                // If geolocation fails, the map will still show the complaint location
                setTimeout(() => {
                    this.getUserLocationAndShowRoute(map);
                }, 500);

            } catch (error) {
                console.error('Error initializing map:', error);
                mapContainer.innerHTML = '<p>Unable to load map. Coordinates: ' + 
                    this.complaint.latitude + ', ' + this.complaint.longitude + '</p>';
            }
        }, 100);
    }

    addRouteControls(map) {
        // Only show route controls for LGU users
        if (this.userRole !== 'lgu' && this.userRole !== 'lgu-admin') {
            return;
        }

        // Create control container
        const routeControlContainer = L.control({ position: 'topright' });
        
        routeControlContainer.onAdd = function(map) {
            const div = L.DomUtil.create('div', 'route-controls');
            div.innerHTML = `
                <div class="route-control-panel">
                    <h4>Route Options</h4>
                    <button id="get-route-btn" class="route-btn">
                        <i class="icon-navigation"></i> Get Route
                    </button>
                    <button id="clear-route-btn" class="route-btn" style="display: none;">
                        <i class="icon-close"></i> Clear Route
                    </button>
                    <div id="route-info" class="route-info" style="display: none;">
                        <p id="route-distance"></p>
                        <p id="route-duration"></p>
                    </div>
                </div>
            `;
            return div;
        };

        routeControlContainer.addTo(map);

        // Add event listeners
        document.getElementById('get-route-btn').addEventListener('click', () => {
            this.getUserLocationAndShowRoute(map);
        });

        document.getElementById('clear-route-btn').addEventListener('click', () => {
            this.clearRoute();
        });
    }

    getUserLocationAndShowRoute(map) {
        if (!navigator.geolocation) {
            showToast('Geolocation is not supported by this browser.', 'error');
            return;
        }

        const getRouteBtn = document.getElementById('get-route-btn');
        const clearRouteBtn = document.getElementById('clear-route-btn');
        const routeInfo = document.getElementById('route-info');

        if (getRouteBtn) {
            getRouteBtn.textContent = 'Getting Location...';
            getRouteBtn.disabled = true;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };

                this.showRoute(map);
                
                if (getRouteBtn) {
                    getRouteBtn.textContent = 'Update Route';
                    getRouteBtn.disabled = false;
                }
                if (clearRouteBtn) clearRouteBtn.style.display = 'inline-block';
                if (routeInfo) routeInfo.style.display = 'block';

            },
            (error) => {
                console.error('Error getting location:', error);
                
                let errorMessage = 'Unable to get your location. ';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += 'Location access was denied. Please enable location permissions in your browser settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage += 'Location request timed out. Please try again.';
                        break;
                    default:
                        errorMessage += 'An unknown error occurred.';
                        break;
                }
                
                showToast(errorMessage, 'error');
                
                if (getRouteBtn) {
                    getRouteBtn.textContent = 'Get Route';
                    getRouteBtn.disabled = false;
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 15000, // Increased timeout
                maximumAge: 300000 // 5 minutes
            }
        );
    }

    showRoute(map) {
        if (!this.userLocation || !this.complaint.latitude || !this.complaint.longitude) {
            return;
        }

        // Clear existing route
        this.clearRoute();

        try {
            // Create routing control
            this.routingControl = L.Routing.control({
                waypoints: [
                    L.latLng(this.userLocation.lat, this.userLocation.lng),
                    L.latLng(this.complaint.latitude, this.complaint.longitude)
                ],
                routeWhileDragging: false,
                addWaypoints: false,
                createMarker: function(i, waypoint, n) {
                    // Custom markers
                    if (i === 0) {
                        // User location marker
                        return L.marker(waypoint.latLng, {
                            icon: L.divIcon({
                                className: 'user-location-marker',
                                html: '<div class="marker-icon user-marker">📍</div>',
                                iconSize: [30, 30],
                                iconAnchor: [15, 15]
                            })
                        }).bindPopup('Your Location');
                    } else {
                        // Complaint location marker
                        return L.marker(waypoint.latLng, {
                            icon: L.divIcon({
                                className: 'complaint-location-marker',
                                html: '<div class="marker-icon complaint-marker">🚨</div>',
                                iconSize: [30, 30],
                                iconAnchor: [15, 15]
                            })
                        }).bindPopup(`
                            <div class="map-popup">
                                <h4>${this.complaint.title || 'Complaint Location'}</h4>
                                <p><strong>Address:</strong> ${this.complaint.location_text}</p>
                            </div>
                        `);
                    }
                }.bind(this),
                lineOptions: {
                    styles: [
                        {
                            color: '#3b82f6',
                            weight: 6,
                            opacity: 0.8
                        }
                    ]
                }
            }).addTo(map);

            // Listen for route calculation
            this.routingControl.on('routesfound', (e) => {
                const routes = e.routes;
                const summary = routes[0].summary;
                
                // Update route info
                const distanceEl = document.getElementById('route-distance');
                const durationEl = document.getElementById('route-duration');
                
                if (distanceEl) {
                    distanceEl.textContent = `Distance: ${(summary.totalDistance / 1000).toFixed(2)} km`;
                }
                if (durationEl) {
                    durationEl.textContent = `Duration: ${Math.round(summary.totalTime / 60)} minutes`;
                }

                showToast('Route calculated successfully!', 'success');
            });

            this.routingControl.on('routingerror', (e) => {
                console.error('Routing error:', e);
                showToast('Unable to calculate route. Please try again.', 'error');
            });

        } catch (error) {
            console.error('Error creating route:', error);
            showToast('Error creating route. Please try again.', 'error');
        }
    }

    clearRoute() {
        if (this.routingControl) {
            this.map.removeControl(this.routingControl);
            this.routingControl = null;
        }

        const clearRouteBtn = document.getElementById('clear-route-btn');
        const routeInfo = document.getElementById('route-info');
        
        if (clearRouteBtn) clearRouteBtn.style.display = 'none';
        if (routeInfo) routeInfo.style.display = 'none';
    }

    renderDepartments() {
        const departmentsContainer = document.getElementById('assigned-departments');
        if (!departmentsContainer) return;

        // Hide departments section for LGU officers
        if (this.userRole === 'lgu') {
            departmentsContainer.style.display = 'none';
            return;
        }

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
            case 'lgu':
            case 'lgu-officer':
                returnLink.href = '/lgu-officer/assigned-tasks';
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

            case 'lgu':
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
            const response = await fetch(`/api/lgu/complaints/${this.complaintId}/resolve`, {
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
