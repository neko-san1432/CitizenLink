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
            console.log('getUserRole API response:', data);
            return data.data.role;
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
        // Skip evidence loading if we're getting SSL errors to prevent infinite redirects
        if (window.location.protocol === 'https:' && window.location.hostname === 'localhost') {
            console.log('Skipping evidence loading due to HTTPS redirect issue');
            this.complaint.attachments = [];
            return;
        }

        try {
            // Use absolute HTTP URL to avoid any protocol issues
            const baseUrl = 'http://localhost:3000';
            const response = await fetch(`${baseUrl}/api/complaints/${this.complaintId}/evidence`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                mode: 'cors'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.complaint.attachments = data.data || [];
                    console.log('Evidence loaded successfully:', this.complaint.attachments.length, 'files');
                } else {
                    console.log('Evidence API returned error:', data.message);
                    this.complaint.attachments = [];
                }
            } else {
                console.log('Evidence API request failed with status:', response.status);
                this.complaint.attachments = [];
            }
        } catch (error) {
            console.error('Error loading complaint evidence:', error);
            
            // If the error is due to HTTPS redirect or SSL issues, try with relative URL
            if (error.message.includes('SSL') || error.message.includes('HTTPS') || error.message.includes('ERR_SSL_PROTOCOL_ERROR')) {
                try {
                    console.log('Attempting fallback with relative URL...');
                    const response = await fetch(`/api/complaints/${this.complaintId}/evidence`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        credentials: 'include'
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.success) {
                            this.complaint.attachments = data.data || [];
                            console.log('Fallback request successful');
                        } else {
                            this.complaint.attachments = [];
                        }
                    } else {
                        this.complaint.attachments = [];
                    }
                } catch (fallbackError) {
                    console.error('Fallback request also failed:', fallbackError);
                    this.complaint.attachments = [];
                }
            } else {
                this.complaint.attachments = [];
            }
        }
    }

    async renderComplaintDetails() {
        const detailsContainer = document.getElementById('complaint-details');
        if (!detailsContainer) return;

        // Populate basic complaint info
        document.getElementById('complaint-title').textContent = this.complaint.title || 'Untitled Complaint';
        document.getElementById('complaint-id').textContent = `#${this.complaint.id}`;

        // Prefer workflow_status, then confirmation_status; map to user-friendly text
        const wf = (this.complaint.workflow_status || '').toLowerCase();
        let displayStatus;
        if (this.complaint.confirmation_status && this.complaint.confirmation_status !== 'pending') {
            displayStatus = this.complaint.confirmation_status;
        } else if (wf === 'completed') {
            displayStatus = 'resolved';
        } else if (wf === 'in_progress' || wf === 'pending_approval' || wf === 'assigned') {
            displayStatus = 'in progress';
        } else if (wf === 'cancelled') {
            displayStatus = 'cancelled';
        } else if (wf === 'rejected_false') {
            displayStatus = 'rejected';
        } else if (wf === 'new') {
            displayStatus = 'new';
        } else {
            displayStatus = this.complaint.status || 'Unknown';
        }
        const statusClass = this.getStatusClass(displayStatus);
        document.getElementById('complaint-status').textContent = this.getStatusDisplayText(displayStatus);
        document.getElementById('complaint-status').className = `complaint-status ${statusClass}`;

        document.getElementById('complaint-priority').textContent = this.complaint.priority || 'Medium';
        document.getElementById('complaint-priority').className = `complaint-priority priority-${(this.complaint.priority || 'medium').toLowerCase()}`;
        document.getElementById('complaint-description').textContent = this.complaint.descriptive_su || 'No description provided';

        // Display assignment progress if available
        this.displayAssignmentProgress();

        // Load and display confirmation message
        await this.loadConfirmationMessage();

        // Populate location
        this.renderLocation();

        // Populate attachments
        this.renderAttachments();

        // Populate timeline
        this.renderTimeline();

        // Show the details
        detailsContainer.style.display = 'block';
    }

    getStatusClass(status) {
        const statusMap = {
            'pending': 'status-pending',
            'waiting_for_responders': 'status-warning',
            'waiting_for_complainant': 'status-info',
            'confirmed': 'status-success',
            'disputed': 'status-danger',
            'in progress': 'status-info',
            'resolved': 'status-success',
            'cancelled': 'status-secondary',
            'rejected': 'status-danger'
        };

        return statusMap[status] || 'status-pending';
    }

    getStatusDisplayText(status) {
        const displayMap = {
            'pending': 'Pending',
            'waiting_for_responders': 'Waiting for LGU Responders',
            'waiting_for_complainant': 'Ready for Your Confirmation',
            'confirmed': 'Resolution Confirmed by You',
            'disputed': 'Disputed',
            'in progress': 'In Progress',
            'resolved': 'Resolved',
            'cancelled': 'Cancelled',
            'rejected': 'Rejected',
            'new': 'New Complaint',
            'assigned': 'Assigned to Coordinator',
            'completed': 'Completed - Awaiting Confirmation'
        };

        return displayMap[status] || status || 'Unknown';
    }

    displayAssignmentProgress() {
        const progress = this.complaint.assignment_progress;
        if (!progress || progress.totalAssignments === 0) {
            return; // No assignments to show progress for
        }

        // Find or create assignment progress element
        let progressElement = document.getElementById('assignment-progress');
        if (!progressElement) {
            const statusElement = document.getElementById('complaint-status');
            if (statusElement && statusElement.parentNode) {
                progressElement = document.createElement('div');
                progressElement.id = 'assignment-progress';
                progressElement.className = 'assignment-progress';
                statusElement.parentNode.insertBefore(progressElement, statusElement.nextSibling);
            }
        }

        if (progressElement) {
            const isCompleted = progress.completedAssignments === progress.totalAssignments;
            const progressBar = `
                <div class="progress-container">
                    <div class="progress-info">
                        <span class="progress-text">${progress.progressText}</span>
                        <span class="progress-percentage">${progress.progressPercentage}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill ${isCompleted ? 'completed' : ''}"
                             style="width: ${progress.progressPercentage}%"></div>
                    </div>
                </div>
            `;
            progressElement.innerHTML = progressBar;
        }
    }

    async loadConfirmationMessage() {
        try {
            const response = await fetch(`/api/complaints/${this.complaintId}/confirmation-message`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data.message) {
                    this.displayConfirmationMessage(data.data.message);
                }
            }
        } catch (error) {
            console.error('Error loading confirmation message:', error);
        }
    }

    shouldShowConfirmationButton() {
        // Match backend validation logic closely, but do not block on delayed confirmation_status updates
        // Show confirmation button ONLY after coordinator has assigned to officers

        // 1. Check if citizen already confirmed
        if (this.complaint.confirmed_by_citizen) {
            return false;
        }

        // 2. Check workflow status - show button after coordinator assigns to officers
        const coordinatorAssignedStatuses = ['assigned', 'in_progress', 'pending_approval', 'completed'];
        if (!coordinatorAssignedStatuses.includes(this.complaint.workflow_status)) {
            return false;
        }

        // 3. If assignments exist and all assignments are complete, show the button regardless of confirmation_status
        const progress = this.complaint.assignment_progress;
        if (progress && progress.totalAssignments > 0) {
            if (progress.completedAssignments === progress.totalAssignments) {
                return true;
            }
            // If not all completed, fall through to stricter checks
            return false;
        }

        // 4. Fallback to confirmation_status gate when no assignment info is available
        const validConfirmationStatuses = ['waiting_for_complainant', 'confirmed', 'disputed', 'pending'];
        if (!validConfirmationStatuses.includes(this.complaint.confirmation_status)) {
            return false;
        }

        return true;
    }

    displayConfirmationMessage(message) {
        // Find or create confirmation status element
        let confirmationElement = document.getElementById('confirmation-status');
        if (!confirmationElement) {
            // Create confirmation status element after the complaint status
            const statusElement = document.getElementById('complaint-status');
            if (statusElement && statusElement.parentNode) {
                confirmationElement = document.createElement('div');
                confirmationElement.id = 'confirmation-status';
                confirmationElement.className = 'confirmation-status';
                statusElement.parentNode.insertBefore(confirmationElement, statusElement.nextSibling);
            }
        }

        if (confirmationElement) {
            confirmationElement.textContent = message;

            // Add appropriate styling based on message content and complaint status
            let cssClass = 'confirmation-status';

            if (message.includes('Please confirm') || message.includes('Waiting for your')) {
                cssClass += ' action-required';
            } else if (message.includes('confirmed') || message.includes('Completed')) {
                cssClass += ' confirmed';
            } else if (message.includes('Waiting for')) {
                cssClass += ' waiting';
            } else {
                cssClass += ' info';
            }

            confirmationElement.className = cssClass;
        }
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
                // this.addRouteControls(map);

        // Try to get user location and show route (non-blocking)
        // If geolocation fails, the map will still show the complaint location
        // setTimeout(() => {
        //     this.getUserLocationAndShowRoute(map);
        // }, 1000);

        // Show a helpful message about geolocation after a delay
        // setTimeout(() => {
        //     if (!this.userLocation) {
        //         console.log('Geolocation not available - map will show complaint location only');
        //         // Show a subtle notification that geolocation is not available
        //         const routeBtn = document.getElementById('get-route-btn');
        //         if (routeBtn && routeBtn.textContent === 'Get Route') {
        //             routeBtn.title = 'Click to try getting your location for route calculation';
        //         }
        //     }
        // }, 3000);

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

        // Check if geolocation is supported
        if (!navigator.geolocation) {
            console.log('Geolocation not supported, skipping route controls');
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
                         <div id="manual-location" class="manual-location" style="display: none;">
                             <p>Location not available. You can still view the complaint location on the map.</p>
                         </div>
                </div>
            `;
            return div;
        };

        routeControlContainer.addTo(map);

        // Add event listeners with error handling
        const getRouteBtn = document.getElementById('get-route-btn');
        const clearRouteBtn = document.getElementById('clear-route-btn');
        
        if (getRouteBtn) {
            getRouteBtn.addEventListener('click', () => {
                this.getUserLocationAndShowRoute(map);
            });
        }
        
        if (clearRouteBtn) {
            clearRouteBtn.addEventListener('click', () => {
                this.clearRoute();
            });
        }
    }

    getUserLocationAndShowRoute(map) {
        if (!navigator.geolocation) {
            console.log('Geolocation is not supported by this browser');
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

        // Check if geolocation is available and not blocked
        if (navigator.permissions) {
            navigator.permissions.query({name: 'geolocation'}).then((result) => {
                if (result.state === 'denied') {
                    console.log('Geolocation permission denied');
                    showToast('Location access is denied. Please enable location permissions in your browser settings.', 'error');
                    if (getRouteBtn) {
                        getRouteBtn.textContent = 'Get Route';
                        getRouteBtn.disabled = false;
                    }
                    
                    // Show manual location message
                    const manualLocation = document.getElementById('manual-location');
                    if (manualLocation) {
                        manualLocation.style.display = 'block';
                    }
                    return;
                }
                this.attemptGeolocation(map, getRouteBtn, clearRouteBtn, routeInfo);
            }).catch(() => {
                // Fallback if permissions API is not supported
                this.attemptGeolocation(map, getRouteBtn, clearRouteBtn, routeInfo);
            });
        } else {
            // Fallback if permissions API is not supported
            this.attemptGeolocation(map, getRouteBtn, clearRouteBtn, routeInfo);
        }
    }

    attemptGeolocation(map, getRouteBtn, clearRouteBtn, routeInfo) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('Location obtained successfully');
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

                showToast('Location obtained successfully!', 'success');
            },
            (error) => {
                console.error('Error getting location:', error);
                
                let errorMessage = 'Unable to get your location. ';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += 'Location access was denied. Please enable location permissions in your browser settings and try again.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += 'Location information is unavailable. This might be due to GPS being disabled, poor signal, or browser security policies.';
                        break;
                    case error.TIMEOUT:
                        errorMessage += 'Location request timed out. Please try again.';
                        break;
                    default:
                        errorMessage += 'An unknown error occurred. Please try again.';
                        break;
                }
                
                showToast(errorMessage, 'error');
                
                if (getRouteBtn) {
                    getRouteBtn.textContent = 'Get Route';
                    getRouteBtn.disabled = false;
                }
                
                // Show manual location message
                const manualLocation = document.getElementById('manual-location');
                if (manualLocation) {
                    manualLocation.style.display = 'block';
                }
            },
            {
                enableHighAccuracy: false, // Changed to false for better compatibility
                timeout: 10000, // Reduced timeout
                maximumAge: 60000 // 1 minute
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


    renderAttachments() {
        const attachmentsContainer = document.getElementById('complaint-attachments');
        if (!attachmentsContainer) return;

        const attachments = this.complaint.attachments || [];

        // Separate attachments by type
        const initialEvidence = attachments.filter(att => att.type === 'initial');
        const completionEvidence = attachments.filter(att => att.type === 'completion');

        if (attachments.length === 0) {
            attachmentsContainer.innerHTML = '<p>No attachments</p>';
            return;
        }

        let html = '';

        // Render Initial Evidence section
        if (initialEvidence.length > 0) {
            html += `
                <div class="evidence-section">
                    <h4 class="evidence-type-title">📎 Initial Evidence (Submitted with Complaint)</h4>
                    <div class="evidence-list">
                        ${initialEvidence.map(attachment => `
                            <a href="${attachment.url}" class="attachment-item" target="_blank" rel="noopener noreferrer">
                                <span class="attachment-icon">📎</span>
                                <span class="attachment-name">${attachment.name || 'Attachment'}</span>
                                <span class="attachment-size">${this.formatFileSize(attachment.size || 0)}</span>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Render Completion Evidence section
        if (completionEvidence.length > 0) {
            html += `
                <div class="evidence-section">
                    <h4 class="evidence-type-title">✅ Completion Evidence (Uploaded by Officers/Admins)</h4>
                    <div class="evidence-list">
                        ${completionEvidence.map(attachment => `
                            <a href="${attachment.url}" class="attachment-item completion-evidence" target="_blank" rel="noopener noreferrer">
                                <span class="attachment-icon">✅</span>
                                <span class="attachment-name">${attachment.name || 'Attachment'}</span>
                                <span class="attachment-size">${this.formatFileSize(attachment.size || 0)}</span>
                            </a>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // If no attachments categorized, show all
        if (html === '') {
            html = attachments.map(attachment => `
                <a href="${attachment.url}" class="attachment-item" target="_blank" rel="noopener noreferrer">
                    <span class="attachment-icon">📎</span>
                    <span class="attachment-name">${attachment.name || 'Attachment'}</span>
                    <span class="attachment-size">${this.formatFileSize(attachment.size || 0)}</span>
                </a>
            `).join('');
        }

        attachmentsContainer.innerHTML = html;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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

        if (this.complaint.status === 'assigned' && this.userRole !== 'lgu') {
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
                description: this.userRole === 'lgu' ? 'You are working on this complaint' : 'Department is working on the complaint',
                date: this.formatDate(this.complaint.updated_at)
            });
        }

        if (this.complaint.status === 'resolved') {
            timeline.push({
                icon: '✅',
                title: 'Resolved',
                description: this.userRole === 'lgu' ? 'You have resolved this complaint' : 'Complaint has been resolved by department',
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
                returnLink.href = '/myProfile';
                returnText.textContent = 'Return to Your Profile';
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
                // Show confirmation button when all assignments are complete and citizen hasn't confirmed
                if (this.shouldShowConfirmationButton()) {
                    actions.push(
                        { text: 'Confirm Resolution', class: 'btn btn-success', action: 'confirm-resolution' }
                    );
                }
                if (this.complaint.status !== 'cancelled' && this.complaint.status !== 'closed') {
                    actions.push(
                        { text: 'Set Reminder', class: 'btn btn-info', action: 'remind' }
                    );
                }
                break;
        }

        // Hide Confirm Resolution if already resolved/completed
        const wf = (this.complaint.workflow_status || '').toLowerCase();
        const confirmedByCitizen = Boolean(this.complaint.confirmed_by_citizen);
        const filteredActions = actions.filter(a => {
            if (a.action === 'confirm-resolution') {
                if (wf === 'completed' || confirmedByCitizen) return false;
            }
            if (a.action === 'remind') {
                // Hide reminder when already resolved/completed or cancelled
                if (wf === 'completed' || wf === 'cancelled') return false;
            }
            return true;
        });

        actionsContainer.innerHTML = filteredActions.map(action => `
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
                this.loadComplaintDetails(); // Refresh to update UI
            } else {
                // Show the specific backend validation error to the user
                showToast(result.error || 'Failed to confirm resolution', 'error');
                console.log('Backend validation error:', result.error);

                // Optionally refresh the complaint details to update the UI state
                this.loadComplaintDetails();
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
