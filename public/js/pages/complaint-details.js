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
      // Hide complaint details container initially to prevent showing dummy content
      const detailsContainer = document.getElementById('complaint-details');
      if (detailsContainer) {
        detailsContainer.style.display = 'none';
      }
      
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
      this.showError(`Failed to load complaint details: ${  error.message}`);
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
      this.showError(`Failed to load complaint details: ${  error.message}`);
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
    // Populate complainant info (only for admin, officers, coordinators)
    this.renderComplainantInfo();
    // Populate attachments
    this.renderAttachments();
    // Populate timeline
    this.renderTimeline();
    // Show the details (ensure grid layout)
    detailsContainer.style.display = 'grid';
  }
  renderComplainantInfo() {
    const complainantSection = document.getElementById('complainant-section');
    const complainantInfo = document.getElementById('complainant-info');
    if (!complainantSection || !complainantInfo) return;
    // Show complainant info only for admin, officers, and complaint coordinator
    const rolesThatCanSeeComplainant = ['complaint-coordinator', 'lgu-admin', 'lgu', 'lgu-officer', 'super-admin', 'hr'];
    const canSeeComplainant = rolesThatCanSeeComplainant.includes(this.userRole);
    if (canSeeComplainant && this.complaint.submitted_by_profile) {
      const profile = this.complaint.submitted_by_profile;
      const name = profile.name || profile.email || 'Unknown';
      const email = profile.email || 'Not provided';
      const firstName = profile.firstName || '';
      const lastName = profile.lastName || '';
      
      // Get phone number from multiple possible fields
      const rawMeta = profile.raw_user_meta_data || {};
      const phoneNumber = profile.mobileNumber || 
                         profile.mobile || 
                         rawMeta.mobile_number || 
                         rawMeta.mobile || 
                         rawMeta.phone_number || 
                         rawMeta.phone || 
                         null;
      
      // Get address from metadata - check multiple formats
      const address = rawMeta.address || {};
      const addressParts = [];
      
      // Check for address_line_1, address_line_2 format
      if (rawMeta.address_line_1) addressParts.push(rawMeta.address_line_1);
      if (rawMeta.address_line_2) addressParts.push(rawMeta.address_line_2);
      
      // Check for nested address object
      if (address.line1) addressParts.push(address.line1);
      if (address.line2) addressParts.push(address.line2);
      
      // Check for old format
      if (rawMeta.addressLine1 && !addressParts.includes(rawMeta.addressLine1)) {
        addressParts.push(rawMeta.addressLine1);
      }
      if (rawMeta.addressLine2 && !addressParts.includes(rawMeta.addressLine2)) {
        addressParts.push(rawMeta.addressLine2);
      }
      
      // Add city, province, barangay, postal code if available
      if (rawMeta.city || address.city) addressParts.push(rawMeta.city || address.city);
      if (rawMeta.barangay || address.barangay) addressParts.push(rawMeta.barangay || address.barangay);
      if (rawMeta.province || address.province) addressParts.push(rawMeta.province || address.province);
      if (rawMeta.postal_code || address.postalCode) addressParts.push(rawMeta.postal_code || address.postalCode);
      
      const fullAddress = addressParts.filter(Boolean).join(', ') || null;

      complainantInfo.innerHTML = `
                <div class="complainant-details">
                    <div class="complainant-field">
                        <span class="field-label">Name:</span>
                        <span class="field-value">${this.escapeHtml(name)}</span>
                    </div>
                    ${firstName || lastName ? `
                    <div class="complainant-field">
                        <span class="field-label">Full Name:</span>
                        <span class="field-value">${this.escapeHtml(`${firstName} ${lastName}`.trim() || name)}</span>
                    </div>
                    ` : ''}
                    <div class="complainant-field">
                        <span class="field-label">Email:</span>
                        <span class="field-value">
                            <a href="mailto:${this.escapeHtml(email)}" class="complainant-link">${this.escapeHtml(email)}</a>
                        </span>
                    </div>
                    <div class="complainant-field">
                        <span class="field-label">Phone Number:</span>
                        <span class="field-value">
                            ${phoneNumber ? `
                            <a href="tel:${this.escapeHtml(phoneNumber)}" class="complainant-link">${this.escapeHtml(phoneNumber)}</a>
                            ` : '<span style="color: #9ca3af;">Not provided</span>'}
                        </span>
                    </div>
                    <div class="complainant-field">
                        <span class="field-label">Address:</span>
                        <span class="field-value">
                            ${fullAddress ? this.escapeHtml(fullAddress) : '<span style="color: #9ca3af;">Not provided</span>'}
                        </span>
                    </div>
                </div>
            `;
      complainantSection.style.display = 'block';
    } else {
      complainantSection.style.display = 'none';
    }
  }
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
      const hasCoordinates = this.complaint.latitude && this.complaint.longitude;
      locationContainer.innerHTML = `
                <div class="location-address">${this.complaint.location_text}</div>
                ${hasCoordinates ?
    `<div class="location-coordinates">${this.complaint.latitude}, ${this.complaint.longitude}</div>
                     <button id="show-map-modal-btn" class="btn btn-secondary" style="margin-top: 10px;">
                         📍 View on Map
                     </button>
                     <div id="complaint-map" class="complaint-map"></div>` :
    ''
}
            `;

      // Initialize map if coordinates are available
      if (hasCoordinates) {
        this.initializeMap();
        // Setup map modal button
        const mapModalBtn = document.getElementById('show-map-modal-btn');
        if (mapModalBtn) {
          mapModalBtn.addEventListener('click', () => {
            this.showMapModal();
          });
        }
      }
    } else {
      locationContainer.innerHTML = '<p>No location information provided</p>';
    }
  }

  showMapModal() {
    if (!this.complaint.latitude || !this.complaint.longitude) {
      alert('No coordinates available for this complaint');
      return;
    }

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'map-modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 90vw; max-height: 90vh; width: 800px;">
        <div class="modal-header">
          <h2>📍 Complaint Location</h2>
          <button class="modal-close" id="close-map-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div id="modal-map" style="width: 100%; height: 500px; border-radius: 8px;"></div>
          <div style="margin-top: 10px;">
            <strong>Address:</strong> ${this.complaint.location_text || 'N/A'}<br>
            <strong>Coordinates:</strong> ${this.complaint.latitude}, ${this.complaint.longitude}
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Close button handler
    const closeBtn = document.getElementById('close-map-modal');
    closeBtn.addEventListener('click', () => {
      modal.remove();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    // Initialize map in modal
    setTimeout(async () => {
      try {
        if (typeof L === 'undefined') {
          await this.loadLeaflet();
        }
        const mapContainer = document.getElementById('modal-map');
        if (!mapContainer) return;

        const lat = parseFloat(this.complaint.latitude);
        const lng = parseFloat(this.complaint.longitude);
        
        if (isNaN(lat) || isNaN(lng)) {
          mapContainer.innerHTML = '<p>Invalid coordinates</p>';
          return;
        }

        const map = L.map('modal-map').setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        // Add marker
        L.marker([lat, lng])
          .addTo(map)
          .bindPopup(`<strong>${this.complaint.title || 'Complaint'}</strong><br>${this.complaint.location_text || ''}`)
          .openPopup();
      } catch (error) {
        console.error('[COMPLAINT_DETAILS] Error initializing modal map:', error);
        const mapContainer = document.getElementById('modal-map');
        if (mapContainer) {
          mapContainer.innerHTML = '<p>Error loading map</p>';
        }
      }
    }, 100);
  }

  async initializeMap() {
    // Wait a bit for the DOM to be ready
    const mapContainer = document.getElementById('complaint-map');
    if (!mapContainer) {
      console.warn('[COMPLAINT_DETAILS] Map container not found');
      return;
    }

    try {
      // Ensure Leaflet is loaded
      if (typeof L === 'undefined') {
        await this.loadLeaflet();
      }

      // Wait for container to have dimensions
      let attempts = 0;
      while ((mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (mapContainer.offsetWidth === 0 || mapContainer.offsetHeight === 0) {
        console.warn('[COMPLAINT_DETAILS] Map container has no dimensions');
        return;
      }

      // Validate coordinates
      const lat = parseFloat(this.complaint.latitude);
      const lng = parseFloat(this.complaint.longitude);
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('[COMPLAINT_DETAILS] Invalid coordinates:', { lat, lng });
        mapContainer.innerHTML = '<p>Invalid coordinates provided</p>';
        return;
      }

      // Initialize the map
      const map = L.map('complaint-map', {
        zoomControl: true,
        preferCanvas: false
      }).setView([lat, lng], 15);

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      // Add a marker for the complaint location
      const complaintMarker = L.marker([lat, lng]).addTo(map);
      
      // Add popup with complaint information
      complaintMarker.bindPopup(`
        <div class="map-popup">
          <h4>${this.escapeHtml(this.complaint.title || 'Complaint Location')}</h4>
          <p><strong>Address:</strong> ${this.escapeHtml(this.complaint.location_text || 'N/A')}</p>
          <p><strong>Coordinates:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
        </div>
      `).openPopup();

      // Store map reference for potential cleanup
      this.map = map;

      // Invalidate size after a short delay to ensure proper rendering
      setTimeout(() => {
        if (map) {
          map.invalidateSize();
        }
      }, 200);
    } catch (error) {
      console.error('[COMPLAINT_DETAILS] Error initializing map:', error);
      const mapContainer = document.getElementById('complaint-map');
      if (mapContainer) {
        mapContainer.innerHTML = `<p>Unable to load map. Error: ${error.message}</p>`;
      }
    }
  }

  async loadLeaflet() {
    return new Promise((resolve, reject) => {
      if (typeof L !== 'undefined') {
        resolve();
        return;
      }

      // Check if Leaflet CSS is loaded
      if (!document.querySelector('link[href*="leaflet"]')) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        cssLink.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        cssLink.crossOrigin = '';
        document.head.appendChild(cssLink);
      }

      // Load Leaflet JS
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Leaflet'));
      document.head.appendChild(script);
    });
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
          }
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
        const {routes} = e;
        const {summary} = routes[0];
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
    return `${Math.round(bytes / Math.pow(k, i) * 100) / 100  } ${  sizes[i]}`;
  }
  renderTimeline() {
    const timelineContainer = document.getElementById('timeline-items');
    if (!timelineContainer) return;
    // Map workflow status to step number (0-4, with 5 as cancelled)
    const workflowStatus = (this.complaint.workflow_status || 'new').toLowerCase();
    const isCancelled = workflowStatus === 'cancelled';
    const statusStepMap = {
      'new': 0,
      'assigned': 1,
      'in_progress': 2,
      'pending_approval': 3,
      'completed': 4
    };
    // For cancelled complaints, don't show any active steps - gray everything out
    // Otherwise, show progress up to the current step
    const currentStep = isCancelled ? -1 : (statusStepMap[workflowStatus] !== undefined ? statusStepMap[workflowStatus] : 0);

    // Step labels
    const stepLabels = [
      'New',
      'Assigned',
      'In Progress',
      'Pending Approval',
      'Completed',
      'Cancelled'
    ];
    // Node color (blue only for all active steps)
    const nodeColors = [
      '#3b82f6',
      '#3b82f6',
      '#3b82f6',
      '#3b82f6',
      '#3b82f6'
    ];
    // Build the stepper HTML
    let stepperHTML = '<div class="stepper-container">';
    for (let i = 0; i < 5; i++) {
      // If cancelled, all steps are inactive (grayed out)
      // Otherwise, active steps are those up to currentStep (0-4)
      // Step 5 is always inactive (grey) - represents unreached final state
      const isActive = isCancelled ? false : (i <= currentStep && i < 5);
      // Get node color - if cancelled, everything is grey
      const nodeColor = isCancelled ? '#9ca3af' : (isActive ? nodeColors[i] : '#9ca3af');
      // Determine connector line style
      let connectorStyle = '';
      if (i < 4) {
        // If cancelled, all connectors are grey
        // Otherwise, color connector through the current step as well (continuous bar effect)
        const isConnectorActive = isCancelled ? false : (i <= currentStep);
        if (isConnectorActive) {
          // Active connector solid blue
          connectorStyle = '#3b82f6';
        } else {
          connectorStyle = '#e5e7eb'; // Inactive grey
        }
      }
      // No glow/box-shadow for nodes
      const boxShadow = 'none';
      stepperHTML += `
                <div class="stepper-step ${isActive ? 'active' : ''}">
                    <div class="stepper-node" style="background-color: ${nodeColor}; box-shadow: ${boxShadow};"></div>
                    ${i < 4 ? `
                    <div class="stepper-connector" style="background: ${connectorStyle};"></div>
                    ` : ''}
                </div>
            `;
    }
    stepperHTML += '</div>';
    // Labels row under the stepper, aligned with nodes
    stepperHTML += '<div class="stepper-labels">';
    for (let i = 0; i < 5; i++) {
      const isActive = !isCancelled && i <= currentStep;
      stepperHTML += `
                <div class="stepper-label-item ${isActive ? 'active' : ''}">${stepLabels[i]}</div>
            `;
    }
    stepperHTML += '</div>';
    const displayLabel = isCancelled ? 'Cancelled' : stepLabels[currentStep] || 'Unknown';
    stepperHTML += `<div class="stepper-current">Current Status: <strong>${displayLabel}</strong></div>`;
    timelineContainer.innerHTML = stepperHTML;
  }
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  }
  getNextColor(currentColor) {
    const colorMap = {
      '#f97316': '#ef4444', // Orange -> Red
      '#ef4444': '#ec4899', // Red -> Pink
      '#ec4899': '#9333ea', // Pink -> Purple
      '#9333ea': '#9ca3af'  // Purple -> Grey
    };
    return colorMap[currentColor] || currentColor;
  }
  setupRoleSpecificUI() {
    this.setupReturnButton();
    this.setupRoleSpecificActions();
  }
  setupReturnButton() {
    const returnLink = document.getElementById('return-link');
    const returnText = document.getElementById('return-text');
    if (!returnLink || !returnText) return;
    
    // Check referrer to determine where user came from
    const referrer = document.referrer;
    const isFromDashboard = referrer.includes('/dashboard') || referrer.includes('/citizen/dashboard');
    const isFromProfile = referrer.includes('/myProfile');
    const isFromReviewQueue = referrer.includes('/coordinator/review-queue') || referrer.includes('/review-queue');
    const isFromAssignments = referrer.includes('/assignments');
    
    // For citizens coming from dashboard or profile previews, always go to profile
    if (this.userRole === 'citizen' && (isFromDashboard || isFromProfile || !referrer)) {
      returnLink.href = '/myProfile';
      returnText.textContent = 'Return to Your Profile';
      return;
    }
    
    // Otherwise use role-based navigation
    switch (this.userRole) {
      case 'complaint-coordinator':
        returnLink.href = isFromReviewQueue ? '/coordinator/review-queue' : '/dashboard';
        returnText.textContent = isFromReviewQueue ? 'Return to Review Queue' : 'Return to Dashboard';
        break;
      case 'lgu-admin':
        returnLink.href = isFromAssignments ? '/lgu-admin/assignments' : '/dashboard';
        returnText.textContent = isFromAssignments ? 'Return to Assigned Complaints' : 'Return to Dashboard';
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
    const actions = [];
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
      showToast(`Failed to reject complaint: ${  error.message}`, 'error');
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
      showToast(`Failed to mark as resolved: ${  error.message}`, 'error');
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
      showToast(`Failed to cancel complaint: ${  error.message}`, 'error');
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
      showToast(`Failed to confirm resolution: ${  error.message}`, 'error');
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
      showToast(`Failed to send reminder: ${  error.message}`, 'error');
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
      return `${date.toLocaleDateString()  } ${  date.toLocaleTimeString()}`;
    } catch (error) {
      return 'Invalid date';
    }
  }
}
// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ComplaintDetails();
});
