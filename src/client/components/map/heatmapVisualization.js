/**
 * Heatmap Visualization Component for Complaint Locations
 * Integrates with Leaflet maps and DBSCAN clustering
 */

class HeatmapVisualization {
  constructor(map) {
    this.map = map;
    this.complaintData = [];
    this.clusters = [];
    this.heatmapLayer = null;
    this.markerLayer = null;
    this.clusterLayer = null;
    this.dbscan = new DBSCAN();
    this.isClusteringEnabled = false;
    this.currentFilters = {};

    // Heatmap configuration
    this.heatmapConfig = {
      radius: 25,
      blur: 15,
      maxZoom: 18,
      max: 1.0,
      gradient: {
        0.4: 'blue',
        0.6: 'cyan',
        0.7: 'lime',
        0.8: 'yellow',
        1.0: 'red'
      }
    };

    // Cluster configuration
    this.clusterConfig = {
      eps: 0.01, // ~1km
      minPts: 3,
      clusterColors: [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
      ]
    };
  }

  /**
   * Load complaint data from API
   * @param {Object} filters - Filter options
   */
  async loadComplaintData(filters = {}) {
    try {
      // console.log removed for security
      this.currentFilters = filters;

      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          queryParams.append(key, value);
        }
      });

      // Use apiClient for authenticated requests
      const apiClientModule = await import('../../config/apiClient.js');
      const apiClient = apiClientModule.default;
      // console.log removed for security

      const result = await apiClient.get(`/api/complaints/locations?${queryParams}`);
      // console.log removed for security
      // console.log removed for security
      // console.log removed for security

      this.complaintData = result.data || [];

      // console.log removed for security
      // console.log removed for security
      return this.complaintData;
    } catch (error) {
      console.error('[HEATMAP] Error loading complaint data:', error);
      throw error;
    }
  }

  /**
   * Create heatmap layer from complaint data
   */
  createHeatmapLayer() {
    if (!this.complaintData || this.complaintData.length === 0) {
      console.warn('[HEATMAP] No complaint data available for heatmap');
      return null;
    }

    // Convert complaint data to heatmap format
    const heatmapData = this.complaintData.map(complaint => [
      complaint.lat,
      complaint.lng,
      this.getIntensityValue(complaint)
    ]);

    // Create heatmap layer using Leaflet.heat
    this.heatmapLayer = L.heatLayer(heatmapData, this.heatmapConfig);

    // console.log removed for security
    return this.heatmapLayer;
  }

  /**
   * Calculate intensity value for heatmap based on complaint properties
   * @param {Object} complaint - Complaint data
   * @returns {number} Intensity value (0-1)
   */
  getIntensityValue(complaint) {
    let intensity = 0.5; // Base intensity

    // Adjust based on priority
    const priorityWeights = {
      'low': 0.3,
      'medium': 0.6,
      'high': 0.9,
      'urgent': 1.0
    };
    intensity = priorityWeights[complaint.priority] || 0.5;

    // Adjust based on status
    const statusWeights = {
      'pending review': 1.0,
      'in progress': 0.8,
      'resolved': 0.3,
      'closed': 0.1,
      'rejected': 0.2
    };
    intensity *= statusWeights[complaint.status] || 0.5;

    // Adjust based on recency (more recent = higher intensity)
    const daysSinceSubmission = (Date.now() - new Date(complaint.submittedAt).getTime()) / (1000 * 60 * 60 * 24);
    const recencyFactor = Math.max(0.1, 1 - (daysSinceSubmission / 30)); // Decay over 30 days
    intensity *= recencyFactor;

    return Math.min(1.0, Math.max(0.1, intensity));
  }

  /**
   * Create individual complaint markers
   */
  createMarkerLayer() {
    if (!this.complaintData || this.complaintData.length === 0) {
      return null;
    }

    this.markerLayer = L.layerGroup();

    // console.log removed for security

    this.complaintData.forEach((complaint, index) => {
      // console.log removed for security
      const marker = this.createComplaintMarker(complaint);
      this.markerLayer.addLayer(marker);
    });

    // console.log removed for security
    return this.markerLayer;
  }

  /**
   * Create clickable circles for complaints
   */
  createCircleLayer() {
    if (!this.complaintData || this.complaintData.length === 0) {
      return null;
    }

    this.circleLayer = L.layerGroup();

    // console.log removed for security

    this.complaintData.forEach((complaint, index) => {
      // console.log removed for security
      const circle = this.createComplaintCircle(complaint);
      this.circleLayer.addLayer(circle);
    });

    // console.log removed for security
    return this.circleLayer;
  }

  /**
   * Create individual complaint marker
   * @param {Object} complaint - Complaint data
   * @returns {L.Marker} Leaflet marker
   */
  createComplaintMarker(complaint) {
    const icon = this.getComplaintIcon(complaint);
    const marker = L.marker([complaint.lat, complaint.lng], { icon });

    // Create popup content
    const popupContent = this.createComplaintPopup(complaint);
    marker.bindPopup(popupContent, {
      maxWidth: 300,
      className: 'complaint-popup'
    });

    return marker;
  }

  /**
   * Create clickable circle for complaint
   * @param {Object} complaint - Complaint data
   * @returns {L.Circle} Leaflet circle
   */
  createComplaintCircle(complaint) {
    const priorityColors = {
      'low': '#28a745',
      'medium': '#ffc107',
      'high': '#fd7e14',
      'urgent': '#dc3545'
    };

    const statusColors = {
      'pending review': '#6c757d',
      'in progress': '#17a2b8',
      'resolved': '#28a745',
      'closed': '#6c757d',
      'rejected': '#dc3545'
    };

    // Use priority color for fill, status color for border
    const fillColor = priorityColors[complaint.priority] || '#6c757d';
    const borderColor = statusColors[complaint.status] || '#6c757d';

    // Circle size based on priority
    const radiusSizes = {
      'low': 50,
      'medium': 75,
      'high': 100,
      'urgent': 125
    };

    const radius = radiusSizes[complaint.priority] || 75;

    const circle = L.circle([complaint.lat, complaint.lng], {
      radius,
      color: borderColor,
      weight: 3,
      opacity: 0.8,
      fillColor,
      fillOpacity: 0.4,
      className: 'complaint-circle'
    });

    // Add hover effects
    circle.on('mouseover', function(e) {
      this.setStyle({
        weight: 5,
        fillOpacity: 0.6
      });
    });

    circle.on('mouseout', function(e) {
      this.setStyle({
        weight: 3,
        fillOpacity: 0.4
      });
    });

    // Create detailed popup content (async)
    circle.bindPopup(async () => {
      return await this.createDetailedComplaintPopup(complaint);
    }, {
      maxWidth: 400,
      className: 'complaint-circle-popup',
      closeButton: true,
      autoClose: false,
      keepInView: true
    });

    // Add click event for additional actions
    circle.on('click', (e) => {
      // console.log removed for security
      // You can add additional click actions here
    });

    return circle;
  }

  /**
   * Get appropriate icon for complaint
   * @param {Object} complaint - Complaint data
   * @returns {L.Icon} Leaflet icon
   */
  getComplaintIcon(complaint) {
    const priorityColors = {
      'low': '#28a745',
      'medium': '#ffc107',
      'high': '#fd7e14',
      'urgent': '#dc3545'
    };

    const statusIcons = {
      'pending review': '⏳',
      'in progress': '🔄',
      'resolved': '✅',
      'closed': '🔒',
      'rejected': '❌'
    };

    const color = priorityColors[complaint.priority] || '#6c757d';
    const icon = statusIcons[complaint.status] || '📍';

    return L.divIcon({
      html: `<div style="
        background-color: ${color};
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        border: 1px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      ">${icon}</div>`,
      className: 'complaint-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }

  /**
   * Create popup content for complaint
   * @param {Object} complaint - Complaint data
   * @returns {string} HTML content
   */
  createComplaintPopup(complaint) {
    const submittedDate = new Date(complaint.submittedAt).toLocaleDateString();
    const priorityClass = complaint.priority.replace(' ', '-').toLowerCase();

    return `
      <div class="complaint-popup-content">
        <h4>${complaint.title}</h4>
        <div class="complaint-details">
          <p><strong>Type:</strong> ${complaint.type}</p>
          <p><strong>Status:</strong> <span class="status-${complaint.status.replace(' ', '-')}">${complaint.status}</span></p>
          <p><strong>Priority:</strong> <span class="priority-${priorityClass}">${complaint.priority}</span></p>
          <p><strong>Location:</strong> ${complaint.location}</p>
          <p><strong>Submitted:</strong> ${submittedDate}</p>
          ${complaint.department ? `<p><strong>Department:</strong> ${complaint.department}</p>` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Create detailed popup content for complaint circles
   * @param {Object} complaint - Complaint data
   * @returns {string} HTML content
   */
  async createDetailedComplaintPopup(complaint) {
    const submittedDate = new Date(complaint.submittedAt).toLocaleDateString();
    const submittedTime = new Date(complaint.submittedAt).toLocaleTimeString();
    const priorityClass = complaint.priority.replace(' ', '-').toLowerCase();
    const statusClass = complaint.status.replace(' ', '-').toLowerCase();

    // Calculate days since submission
    const daysSinceSubmission = Math.floor((Date.now() - new Date(complaint.submittedAt).getTime()) / (1000 * 60 * 60 * 24));

    // Check if user has access to this complaint
    const hasAccess = await this.checkComplaintAccess(complaint);

    if (!hasAccess) {
      return `
        <div class="complaint-detail-popup">
          <div class="popup-header">
            <h3>${complaint.title}</h3>
            <div class="complaint-badges">
              <span class="badge priority-${priorityClass}">${complaint.priority.toUpperCase()}</span>
              <span class="badge status-${statusClass}">${complaint.status.toUpperCase()}</span>
            </div>
          </div>

          <div class="popup-content">
            <div class="complaint-info">
              <div class="info-row">
                <span class="label">Type:</span>
                <span class="value">${complaint.type}</span>
              </div>

              <div class="info-row">
                <span class="label">Location:</span>
                <span class="value">${complaint.location}</span>
              </div>

              <div class="info-row">
                <span class="label">Department:</span>
                <span class="value">${complaint.department || 'Not assigned'}</span>
              </div>

              <div class="info-row">
                <span class="label">Submitted:</span>
                <span class="value">${submittedDate} at ${submittedTime}</span>
              </div>

              <div class="info-row">
                <span class="label">Days Open:</span>
                <span class="value">${daysSinceSubmission} day${daysSinceSubmission !== 1 ? 's' : ''}</span>
              </div>
            </div>

            <div class="popup-actions">
              <div class="access-denied">
                <p>🔒 Access restricted to assigned department</p>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="complaint-detail-popup">
        <div class="popup-header">
          <h3>${complaint.title}</h3>
          <div class="complaint-badges">
            <span class="badge priority-${priorityClass}">${complaint.priority.toUpperCase()}</span>
            <span class="badge status-${statusClass}">${complaint.status.toUpperCase()}</span>
          </div>
        </div>

        <div class="popup-content">
          <div class="complaint-info">
            <div class="info-row">
              <span class="label">Type:</span>
              <span class="value">${complaint.type}</span>
            </div>

            <div class="info-row">
              <span class="label">Location:</span>
              <span class="value">${complaint.location}</span>
            </div>

            <div class="info-row">
              <span class="label">Department:</span>
              <span class="value">${complaint.department || 'Not assigned'}</span>
            </div>

            <div class="info-row">
              <span class="label">Submitted:</span>
              <span class="value">${submittedDate} at ${submittedTime}</span>
            </div>

            <div class="info-row">
              <span class="label">Days Open:</span>
              <span class="value">${daysSinceSubmission} day${daysSinceSubmission !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div class="popup-actions">
            <button class="btn-details" onclick="viewComplaintDetails('${complaint.id}')">
              📋 View Full Details
            </button>
            <button class="btn-location" onclick="centerOnComplaint(${complaint.lat}, ${complaint.lng})">
              📍 Center on Map
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Check if user has access to view full details of a complaint
   * @param {Object} complaint - Complaint data
   * @returns {boolean} True if user has access
   */
  async checkComplaintAccess(complaint) {
    try {
      // Import getUserRole function
      const { getUserRole } = await import('../../auth/authChecker.js');
      const userRole = await getUserRole();

      // console.log removed for security
      // console.log removed for security
      // console.log removed for security

      // Super admin has access to everything
      if (userRole === 'super-admin') {
        // console.log removed for security
        return true;
      }

      // Complaint coordinator has access to everything
      if (userRole === 'complaint-coordinator') {
        // console.log removed for security
        return true;
      }

      // With simplified roles, department is stored separately in metadata
      let userDepartment = null;
      if (userRole && ['lgu', 'lgu-admin', 'lgu-hr'].includes(userRole)) {
        // Get department from user metadata
        try {
          const { supabase } = await import('../../config/config.js');
          const { data: { session } } = await supabase.auth.getSession();
          const metadata = session?.user?.raw_user_meta_data || session?.user?.user_metadata || {};
          userDepartment = metadata.dpt || metadata.department;
        } catch (error) {
          console.warn('Failed to get department from metadata:', error);
        }
      }

      // console.log removed for security

      if (!userDepartment) {
        // console.log removed for security
        return false;
      }

      // Check if complaint is assigned to user's department
      const complaintDepartment = complaint.department?.toUpperCase();
      const complaintDepartments = complaint.departments || [];
      const secondaryDepartments = complaint.secondaryDepartments || [];

      // Check primary department
      if (complaintDepartment === userDepartment) {
        // console.log removed for security
        return true;
      }

      // Check if user's department is in the departments array
      if (complaintDepartments.includes(userDepartment)) {
        // console.log removed for security
        return true;
      }

      // Check if user's department is in secondary departments
      if (secondaryDepartments.includes(userDepartment)) {
        // console.log removed for security
        return true;
      }

      // Check if it's a joint/forced complaint (multiple departments)
      if (complaintDepartment && complaintDepartment.includes(',')) {
        const assignedDepartments = complaintDepartment.split(',').map(dept => dept.trim().toUpperCase());
        if (assignedDepartments.includes(userDepartment)) {
          // console.log removed for security
          return true;
        }
      }

      // console.log removed for security
      return false;

    } catch (error) {
      console.error('[HEATMAP] Error checking complaint access:', error);
      return false;
    }
  }

  /**
   * Perform DBSCAN clustering on complaint data
   */
  performClustering() {
    if (!this.complaintData || this.complaintData.length === 0) {
      console.warn('[HEATMAP] No complaint data available for clustering');
      return { clusters: [], noise: [] };
    }

    // Update DBSCAN parameters
    this.dbscan.eps = this.clusterConfig.eps;
    this.dbscan.minPts = this.clusterConfig.minPts;

    // Prepare points for clustering
    const points = this.complaintData.map(complaint => ({
      lat: complaint.lat,
      lng: complaint.lng,
      data: complaint
    }));

    // Perform clustering
    const clusteringResult = this.dbscan.cluster(points);
    this.clusters = clusteringResult.clusters;

    // console.log removed for security

    return clusteringResult;
  }

  /**
   * Create cluster visualization layer
   */
  createClusterLayer() {
    if (!this.clusters || this.clusters.length === 0) {
      return null;
    }

    this.clusterLayer = L.layerGroup();

    this.clusters.forEach((cluster, index) => {
      const clusterPoints = cluster.map(i => this.complaintData[i]);
      const clusterCenter = this.calculateClusterCenter(clusterPoints);
      const clusterRadius = this.calculateClusterRadius(clusterPoints, clusterCenter);

      // Create cluster circle
      const clusterCircle = L.circle(clusterCenter, {
        radius: clusterRadius * 1000, // Convert km to meters
        color: this.clusterConfig.clusterColors[index % this.clusterConfig.clusterColors.length],
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.2
      });

      // Create cluster marker
      const clusterMarker = L.marker(clusterCenter, {
        icon: L.divIcon({
          html: `<div style="
            background-color: ${this.clusterConfig.clusterColors[index % this.clusterConfig.clusterColors.length]};
            color: white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 16px;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          ">${cluster.length}</div>`,
          className: 'cluster-marker',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        })
      });

      // Create cluster popup
      const popupContent = this.createClusterPopup(clusterPoints, index);
      clusterMarker.bindPopup(popupContent, {
        maxWidth: 400,
        className: 'cluster-popup'
      });

      this.clusterLayer.addLayer(clusterCircle);
      this.clusterLayer.addLayer(clusterMarker);
    });

    // console.log removed for security
    return this.clusterLayer;
  }

  /**
   * Calculate cluster center (centroid)
   * @param {Array} points - Array of complaint points
   * @returns {Object} Center coordinates
   */
  calculateClusterCenter(points) {
    const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    return { lat, lng };
  }

  /**
   * Calculate cluster radius
   * @param {Array} points - Array of complaint points
   * @param {Object} center - Cluster center
   * @returns {number} Radius in kilometers
   */
  calculateClusterRadius(points, center) {
    let maxDistance = 0;
    points.forEach(point => {
      const distance = this.dbscan.calculateDistance(center, point);
      maxDistance = Math.max(maxDistance, distance);
    });
    return maxDistance;
  }

  /**
   * Create cluster popup content
   * @param {Array} clusterPoints - Points in the cluster
   * @param {number} clusterIndex - Cluster index
   * @returns {string} HTML content
   */
  createClusterPopup(clusterPoints, clusterIndex) {
    const statusCounts = {};
    const typeCounts = {};
    const priorityCounts = {};

    clusterPoints.forEach(complaint => {
      statusCounts[complaint.status] = (statusCounts[complaint.status] || 0) + 1;
      typeCounts[complaint.type] = (typeCounts[complaint.type] || 0) + 1;
      priorityCounts[complaint.priority] = (priorityCounts[complaint.priority] || 0) + 1;
    });

    return `
      <div class="cluster-popup-content">
        <h4>Cluster ${clusterIndex + 1} (${clusterPoints.length} complaints)</h4>
        <div class="cluster-stats">
          <h5>Status Distribution:</h5>
          <ul>
            ${Object.entries(statusCounts).map(([status, count]) =>
    `<li>${status}: ${count}</li>`
  ).join('')}
          </ul>
          <h5>Type Distribution:</h5>
          <ul>
            ${Object.entries(typeCounts).map(([type, count]) =>
    `<li>${type}: ${count}</li>`
  ).join('')}
          </ul>
          <h5>Priority Distribution:</h5>
          <ul>
            ${Object.entries(priorityCounts).map(([priority, count]) =>
    `<li>${priority}: ${count}</li>`
  ).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * Show heatmap on map
   */
  showHeatmap() {
    if (this.heatmapLayer) {
      this.heatmapLayer.addTo(this.map);
    }
  }

  /**
   * Hide heatmap from map
   */
  hideHeatmap() {
    if (this.heatmapLayer && this.map.hasLayer(this.heatmapLayer)) {
      this.map.removeLayer(this.heatmapLayer);
    }
  }

  /**
   * Show markers on map
   */
  showMarkers() {
    if (this.markerLayer) {
      this.markerLayer.addTo(this.map);
    }
  }

  /**
   * Hide markers from map
   */
  hideMarkers() {
    if (this.markerLayer && this.map.hasLayer(this.markerLayer)) {
      this.map.removeLayer(this.markerLayer);
    }
  }

  /**
   * Show circles on map
   */
  showCircles() {
    if (this.circleLayer) {
      this.circleLayer.addTo(this.map);
    }
  }

  /**
   * Hide circles from map
   */
  hideCircles() {
    if (this.circleLayer && this.map.hasLayer(this.circleLayer)) {
      this.map.removeLayer(this.circleLayer);
    }
  }

  /**
   * Show clusters on map
   */
  showClusters() {
    if (this.clusterLayer) {
      this.clusterLayer.addTo(this.map);
    }
  }

  /**
   * Hide clusters from map
   */
  hideClusters() {
    if (this.clusterLayer && this.map.hasLayer(this.clusterLayer)) {
      this.map.removeLayer(this.clusterLayer);
    }
  }

  /**
   * Update clustering parameters
   * @param {number} eps - Epsilon parameter
   * @param {number} minPts - Minimum points parameter
   */
  updateClusteringParameters(eps, minPts) {
    this.clusterConfig.eps = eps;
    this.clusterConfig.minPts = minPts;

    // Re-cluster if clustering is enabled
    if (this.isClusteringEnabled) {
      this.performClustering();
      this.hideClusters();
      this.createClusterLayer();
      this.showClusters();
    }
  }

  /**
   * Toggle clustering on/off
   * @param {boolean} enabled - Whether clustering should be enabled
   */
  toggleClustering(enabled) {
    this.isClusteringEnabled = enabled;

    if (enabled) {
      this.performClustering();
      this.createClusterLayer();
      this.showClusters();
    } else {
      this.hideClusters();
    }
  }

  /**
   * Get clustering statistics
   * @returns {Object} Statistics about current clustering
   */
  getClusteringStatistics() {
    if (!this.clusters || this.clusters.length === 0) {
      return null;
    }

    return this.dbscan.calculateStatistics(
      this.complaintData.map(c => ({ lat: c.lat, lng: c.lng })),
      { clusters: this.clusters, noise: [] }
    );
  }

  /**
   * Clear all layers from map
   */
  clearAllLayers() {
    this.hideHeatmap();
    this.hideMarkers();
    this.hideCircles();
    this.hideClusters();
  }

  /**
   * Refresh visualization with current data
   */
  refresh() {
    this.clearAllLayers();

    if (this.complaintData.length > 0) {
      this.createHeatmapLayer();
      this.createMarkerLayer();

      if (this.isClusteringEnabled) {
        this.performClustering();
        this.createClusterLayer();
        this.showClusters();
      }
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HeatmapVisualization;
} else {
  window.HeatmapVisualization = HeatmapVisualization;
}
