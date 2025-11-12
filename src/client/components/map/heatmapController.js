/**
 * Heatmap Controller - Main controller for complaint heatmap functionality
 * Integrates map, visualization, and controls
 */
class HeatmapController {

  constructor() {
    this.map = null;
    this.heatmapViz = null;
    this.controls = null;
    this.isInitialized = false;
    this.zoomThreshold = 14; // Show markers only when zoomed in
  }
  /**
   * Initialize the heatmap controller
   * @param {string} mapContainerId - ID of the map container element
   */
  async initialize(mapContainerId = 'map') {
    try {
      // console.log removed for security
      // Initialize map
      this.map = await initializeSimpleMap(mapContainerId, {
        center: [6.7492, 125.3571], // Digos City, Philippines
        zoom: 12
      });
      if (!this.map) {
        throw new Error('Failed to initialize map');
      }
      // Initialize heatmap visualization
      this.heatmapViz = new HeatmapVisualization(this.map);
      // Initialize controls (skip if enhanced controls exist on the page)
      const existingControls = document.getElementById('heatmap-controls');
      const hasEnhancedControls = existingControls && existingControls.classList.contains('enhanced-controls');
      if (!hasEnhancedControls && !window.enhancedHeatmapController) {
        this.controls = new HeatmapControls(this);
      } else {
        // Use existing enhanced controls panel; do not create legacy controls
        this.controls = null;
      }
      // Load initial data
      await this.loadData();
      // Set up event listeners
      this.setupEventListeners();
      this.isInitialized = true;
      // console.log removed for security
    } catch (error) {
      console.error('[HEATMAP-CONTROLLER] Initialization failed:', error);
      throw error;
    }
  }
  /**
   * Load complaint data with current filters
   */
  async loadData() {
    try {
      const filters = this.controls ? this.controls.getCurrentFilters() : {};
      await this.heatmapViz.loadComplaintData(filters);
      this.refreshVisualization();
    } catch (error) {
      console.error('[HEATMAP-CONTROLLER] Failed to load data:', error);
      this.showError('Failed to load complaint data');
    }
  }
  /**
   * Refresh the visualization based on current view
   */
  refreshVisualization() {
    if (!this.heatmapViz) return;
    // Clear all layers first
    this.heatmapViz.clearAllLayers();
    // Show heatmap always, markers only when zoomed in
    this.heatmapViz.createHeatmapLayer();
    this.heatmapViz.showHeatmap();
    const zoom = this.map ? this.map.getZoom() : 0;
    if (zoom >= this.zoomThreshold) {
      this.heatmapViz.createMarkerLayer();
      this.heatmapViz.showMarkers();
    }
    // Update statistics
    this.updateStatistics();
  }
  /**
   * Toggle clustering on/off
   * @param {boolean} enabled - Whether clustering should be enabled
   */
  toggleClustering(enabled) {

    if (this.heatmapViz) {
      this.heatmapViz.toggleClustering(enabled);
      this.updateStatistics();
    }
  }
  /**
   * Update clustering parameters
   * @param {number} eps - Epsilon parameter
   * @param {number} minPts - Minimum points parameter
   */
  updateClusteringParameters(eps, minPts) {

    if (this.heatmapViz) {
      this.heatmapViz.updateClusteringParameters(eps, minPts);
      this.updateStatistics();
    }
  }
  /**
   * Apply filters and reload data
   * @param {Object} filters - Filter options
   */
  async applyFilters(filters) {
    try {
      await this.heatmapViz.loadComplaintData(filters);
      this.refreshVisualization();
    } catch (error) {
      console.error('[HEATMAP-CONTROLLER] Failed to apply filters:', error);
      this.showError('Failed to apply filters');
    }
  }
  /**
   * Update statistics display
   */
  updateStatistics() {
    if (!this.heatmapViz || !this.controls) return;
    const stats = {
      totalComplaints: this.heatmapViz.complaintData.length,
      clusteringStats: this.heatmapViz.getClusteringStatistics()
    };
    this.controls.updateStatistics(stats);
  }
  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {

    if (this.controls) {
      this.controls.showError(message);
    } else {
      console.error('[HEATMAP-CONTROLLER] Error:', message);
    }
  }
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Map events
    if (this.map) {
      this.map.on('zoomend', () => {
        this.updateHeatmapIntensity();
        this.updateViewBasedOnZoom();
      });
      this.map.on('zoomstart', () => {
        this.handleZoomStart();
      });
    }
  }
  /**
   * Update heatmap intensity based on zoom level
   */
  updateHeatmapIntensity() {
    if (!this.heatmapViz || !this.map) return;
    const zoom = this.map.getZoom();
    const baseRadius = 25;
    const baseBlur = 15;
    // Scale down when zoomed out, scale up when zoomed in
    const radius = Math.max(10, baseRadius - (zoom - 10) * 2);
    const blur = Math.max(5, baseBlur - (zoom - 10) * 1.5);
    this.heatmapViz.heatmapConfig.radius = radius;
    this.heatmapViz.heatmapConfig.blur = blur;
    // Refresh heatmap
    this.heatmapViz.hideHeatmap();
    this.heatmapViz.createHeatmapLayer();
    this.heatmapViz.showHeatmap();
  }
  /**
   * Handle zoom start event
   */
  handleZoomStart() {
    // Store current state before zoom changes
    this.preZoomView = this.map.getZoom() >= this.zoomThreshold ? 'markers' : 'heatmap';
  }
  /**
   * Update view based on zoom level
   */
  updateViewBasedOnZoom() {
    if (!this.map || !this.heatmapViz) return;
    const zoom = this.map.getZoom();
    // console.log removed for security
    if (zoom >= this.zoomThreshold) {
      // Zoomed in - show markers
      // console.log removed for security
      this.heatmapViz.createMarkerLayer();
      this.heatmapViz.showMarkers();
      this.showZoomNotification('📍 Markers visible (zoomed in)');
    } else {
      // Zoomed out - hide markers, show only heatmap
      // console.log removed for security
      this.heatmapViz.hideMarkers();
      this.showZoomNotification('🗺️ Heatmap only (zoomed out)');
    }
  }
  /**
   * Show zoom notification
   */
  showZoomNotification(message) {
    // Create or update notification element
    let notification = document.getElementById('zoom-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'zoom-notification';
      notification.className = 'zoom-notification';
      // Insert after the map container
      const mapContainer = document.getElementById('map');
      if (mapContainer && mapContainer.parentNode) {
        mapContainer.parentNode.appendChild(notification);
      }
    }
    notification.textContent = message;
    notification.style.display = 'block';
    // Auto-hide after 2 seconds
    setTimeout(() => {
      if (notification) {
        notification.style.display = 'none';
      }
    }, 2000);
  }
  /**
   * Get current map bounds
   * @returns {L.LatLngBounds} Current map bounds
   */
  getMapBounds() {
    return this.map ? this.map.getBounds() : null;
  }
  /**
   * Fit map to show all complaints
   */
  fitToComplaints() {

    if (!this.heatmapViz || !this.map || this.heatmapViz.complaintData.length === 0) {
      return;
    }
    const group = new L.featureGroup();
    this.heatmapViz.complaintData.forEach(complaint => {
      group.addLayer(L.marker([complaint.lat, complaint.lng]));
    });
    this.map.fitBounds(group.getBounds().pad(0.1));
  }
  /**
   * Export current view as image
   * @returns {Promise<string>} Data URL of the exported image
   */
  async exportMap() {
    if (!this.map) return null;
    return new Promise((resolve) => {
      // Use leaflet-image plugin if available, otherwise fallback
      if (typeof L.Util.extend === 'function' && this.map.getContainer) {
        // Simple canvas export (basic implementation)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const container = this.map.getContainer();
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
        // This is a basic implementation - in production, use a proper map export library
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#333';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Map Export', canvas.width / 2, canvas.height / 2);
        resolve(canvas.toDataURL());
      } else {
        resolve(null);
      }
    });
  }
  /**
   * Set zoom threshold for marker visibility
   * @param {number} threshold - Zoom level threshold
   */
  setZoomThreshold(threshold) {
    this.zoomThreshold = threshold;
    // console.log removed for security
    // Refresh view to apply new threshold
    this.refreshVisualization();
  }
  /**
   * Set heatmap intensity
   * @param {number} intensity - Heatmap intensity multiplier
   */
  setHeatmapIntensity(intensity) {

    if (this.heatmapViz) {
      this.heatmapViz.heatmapConfig.intensity = intensity;
      // Refresh heatmap with new intensity
      this.heatmapViz.hideHeatmap();
      this.heatmapViz.createHeatmapLayer();
      this.heatmapViz.showHeatmap();
    }
  }
  /**
   * Get current state for debugging
   * @returns {Object} Current state
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      complaintCount: this.heatmapViz ? this.heatmapViz.complaintData.length : 0,
      clusteringEnabled: this.heatmapViz ? this.heatmapViz.isClusteringEnabled : false,
      mapCenter: this.map ? this.map.getCenter() : null,
      mapZoom: this.map ? this.map.getZoom() : null,
      zoomThreshold: this.zoomThreshold
    };
  }
}
// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {

  module.exports = HeatmapController;
} else {
  window.HeatmapController = HeatmapController;
}
