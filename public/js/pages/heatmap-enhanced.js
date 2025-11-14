/**
 * Enhanced Heatmap Controller
 * Advanced heatmap functionality with modern UI and additional features
 */
class EnhancedHeatmapController {

  constructor() {
    this.map = null;
    this.heatmapViz = null;
    this.controls = null;
    this.isInitialized = false;
    this.zoomThreshold = 11; // Lower threshold to show markers at default zoom
    this.markersAlwaysVisible = true; // Show markers by default
    this.isFullscreen = false;
    this.isControlsVisible = true;
    this.autoRefreshInterval = null;
    this.exportFormats = ['PNG', 'SVG', 'PDF', 'CSV'];
    // Enhanced statistics
    this.statistics = {
      totalComplaints: 0,
      clusters: 0,
      noisePoints: 0,
      densityScore: 0,
      avgResponseTime: 0,
      resolutionRate: 0
    };
  }
  /**
   * Initialize the enhanced heatmap controller
   */
  async initialize() {
    try {
      // Show loading indicator
      this.showLoading(true);
      // Initialize map
      this.map = await this.initializeMap();
      if (!this.map) {
        throw new Error('Failed to initialize map');
      }
      // Initialize heatmap visualization
      this.heatmapViz = new HeatmapVisualization(this.map);
      // Initialize enhanced controls (optional)
      try {
        if (typeof window.EnhancedHeatmapControls === 'function') {
          this.controls = new window.EnhancedHeatmapControls(this);
          if (this.controls && typeof this.controls.attach === 'function') {
            this.controls.attach();
          }
        } else {
          console.warn('[ENHANCED-HEATMAP] Controls not found; continuing without controls');
        }
      } catch (e) {
        console.warn('[ENHANCED-HEATMAP] Controls failed to initialize; continuing without controls', e);
      }
      // Load initial data
      await this.loadData();
      // Setup event listeners
      this.setupEventListeners();
      // Setup auto-refresh
      this.setupAutoRefresh();
      this.isInitialized = true;
      this.showLoading(false);
    } catch (error) {
      console.error('[ENHANCED-HEATMAP] Initialization failed:', error);
      this.showError('Failed to initialize heatmap');
      this.showLoading(false);
    }
  }
  /**
   * Initialize the map with enhanced configuration
   */
  async initializeMap() {
    try {
      const map = L.map('map', {
        center: [6.7492, 125.3571], // Digos City, Philippines
        zoom: 12,
        zoomControl: false, // We'll add custom controls
        attributionControl: true
      });

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);
      // Add custom zoom controls
      this.addCustomZoomControls(map);
      // Add map event listeners
      this.addMapEventListeners(map);
      return map;
    } catch (error) {
      console.error('[ENHANCED-HEATMAP] Map initialization failed:', error);
      throw error;
    }
  }
  /**
   * Add custom zoom controls
   */
  addCustomZoomControls(map) {
    // Zoom in
    document.getElementById('zoom-in')?.addEventListener('click', () => {
      map.zoomIn();
    });
    // Zoom out
    document.getElementById('zoom-out')?.addEventListener('click', () => {
      map.zoomOut();
    });
    // Fit to bounds
    document.getElementById('fit-bounds')?.addEventListener('click', () => {
      this.fitToComplaints();
    });
    // Reset view to Digos City
    document.getElementById('reset-view')?.addEventListener('click', () => {
      this.resetToDigosCity();
    });
  }
  /**
   * Add map event listeners
   */
  addMapEventListeners(map) {
    // Update statistics and markers on zoom change
    map.on('zoomend', () => {
      this.updateStatistics();
      // Refresh markers visibility based on new zoom level
      if (this.heatmapViz && this.heatmapViz.markerLayer) {
        const zoom = map.getZoom();
        if (this.markersAlwaysVisible || zoom >= this.zoomThreshold) {
          if (!map.hasLayer(this.heatmapViz.markerLayer)) {
            this.heatmapViz.showMarkers();
          }
        } else if (map.hasLayer(this.heatmapViz.markerLayer)) {
          this.heatmapViz.hideMarkers();
        }
      }
      this.refreshVisualization();
    });
    // Update statistics on move
    map.on('moveend', () => {
      this.updateStatistics();
    });
  }
  /**
   * Setup event listeners for enhanced features
   */
  setupEventListeners() {
    // Toggle controls visibility
    document.getElementById('toggle-controls')?.addEventListener('click', () => {
      this.toggleControls();
    });
    // Close controls
    document.getElementById('close-controls')?.addEventListener('click', () => {
      this.toggleControls();
    });
    // Fullscreen toggle
    document.getElementById('fullscreen-toggle')?.addEventListener('click', () => {
      this.toggleFullscreen();
    });
    // Export heatmap
    document.getElementById('export-heatmap')?.addEventListener('click', () => {
      this.showExportModal();
    });
    // Recreate/rebuild map and layers (if a button exists in the UI)
    document.getElementById('recreate-map')?.addEventListener('click', async () => {
      await this.rebuildMap();
    });
    // Reset view button in controls
    document.getElementById('reset-view-btn')?.addEventListener('click', () => {
      this.resetToDigosCity();
    });
    // Layer toggles
    document.getElementById('toggle-heatmap')?.addEventListener('click', () => {
      this.toggleHeatmap();
    });
    document.getElementById('toggle-markers')?.addEventListener('click', () => {
      this.toggleMarkers();
    });
    document.getElementById('toggle-clusters')?.addEventListener('click', () => {
      this.toggleClusters();
    });
    // Quick filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        this.handleQuickFilter(e.target.dataset.filter);
      });
    });
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      this.handleKeyboardShortcuts(e);
    });
  }
  /**
   * Fully rebuild the map and all visualization layers
   * - Clears layers
   * - Destroys Leaflet map instance
   * - Reinitializes map
   * - Reloads data and recreates layers
   */
  async rebuildMap() {
    try {
      this.showLoading(true);
      // Clear layers if visualization exists
      try {
        this.heatmapViz?.clearAllLayers();
      } catch (_) {}
      // Destroy existing map instance safely
      if (this.map) {
        try { this.map.off(); } catch (_) {}
        try { this.map.remove(); } catch (_) {}
        this.map = null;
      }
      // Recreate map
      this.map = await this.initializeMap();
      // Recreate visualization
      this.heatmapViz = new HeatmapVisualization(this.map);
      // Reload data and refresh layers
      await this.loadData();
      this.refreshVisualization();
      this.showMessage('success', 'Map and layers recreated');
    } catch (error) {
      console.error('[ENHANCED-HEATMAP] Rebuild failed:', error);
      this.showError('Failed to recreate map');
    } finally {
      this.showLoading(false);
    }
  }
  /**
   * Setup auto-refresh functionality
   */
  setupAutoRefresh() {
    // Auto-refresh every 5 minutes
    this.autoRefreshInterval = setInterval(() => {
      if (this.isInitialized) {
        this.loadData();
      }
    }, 5 * 60 * 1000);
  }
  /**
   * Load complaint data with enhanced error handling
   */
  async loadData() {
    try {
      const filters = this.controls ? this.controls.getCurrentFilters() : {};
      await this.heatmapViz.loadComplaintData(filters);
      this.refreshVisualization();
      this.updateStatistics();
      this.updateHeaderStats();
      if (this.heatmapViz.complaintData && this.heatmapViz.complaintData.length > 0) {
        this.fitToComplaints();
      }
    } catch (error) {
      console.error('[ENHANCED-HEATMAP] Failed to load data:', error);
      this.showError('Failed to load complaint data');
    }
  }
  /**
   * Refresh visualization with enhanced features
   */
  refreshVisualization() {
    if (!this.heatmapViz) return;
    // Clear all layers first
    this.heatmapViz.clearAllLayers();
    // Only create layers if we have data
    if (!this.heatmapViz.complaintData || this.heatmapViz.complaintData.length === 0) {
      console.warn('[ENHANCED-HEATMAP] No complaint data available for visualization');
      this.updateLayerButtonStates();
      return;
    }
    // Show heatmap always
    this.heatmapViz.createHeatmapLayer();
    this.heatmapViz.showHeatmap();
    // Create markers layer (always create when data exists, show conditionally)
    this.heatmapViz.createMarkerLayer();
    // Show markers based on visibility preference and zoom level
    const zoom = this.map ? this.map.getZoom() : 0;
    const shouldShowMarkers = this.markersAlwaysVisible || zoom >= this.zoomThreshold;
    if (shouldShowMarkers && this.heatmapViz.markerLayer) {
      this.heatmapViz.showMarkers();
    } else {
      // Markers not shown
    }
    // Show clusters if enabled
    if (this.heatmapViz.isClusteringEnabled) {
      this.heatmapViz.performClustering();
      this.heatmapViz.createClusterLayer();
      this.heatmapViz.showClusters();
    }
    // Update layer button states
    this.updateLayerButtonStates();
  }
  /**
   * Update layer button states
   */
  updateLayerButtonStates() {
    const heatmapBtn = document.getElementById('toggle-heatmap');
    const markersBtn = document.getElementById('toggle-markers');
    const clustersBtn = document.getElementById('toggle-clusters');
    if (heatmapBtn) {
      heatmapBtn.classList.toggle('active', this.heatmapViz.heatmapLayer !== null);
    }
    if (markersBtn) {
      markersBtn.classList.toggle('active', this.heatmapViz.markerLayer !== null);
    }
    if (clustersBtn) {
      clustersBtn.classList.toggle('active', this.heatmapViz.clusterLayer !== null);
    }
  }
  /**
   * Toggle controls visibility
   */
  toggleControls() {
    const controls = document.getElementById('heatmap-controls');
    if (controls) {
      this.isControlsVisible = !this.isControlsVisible;
      controls.classList.toggle('collapsed', !this.isControlsVisible);
    }
  }
  /**
   * Toggle fullscreen mode
   */
  toggleFullscreen() {

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      this.isFullscreen = true;
    } else {
      document.exitFullscreen();
      this.isFullscreen = false;
    }
  }
  /**
   * Toggle heatmap layer
   */
  toggleHeatmap() {

    if (this.heatmapViz.heatmapLayer) {
      this.heatmapViz.hideHeatmap();
    } else {
      this.heatmapViz.createHeatmapLayer();
      this.heatmapViz.showHeatmap();
    }
    this.updateLayerButtonStates();
  }
  /**
   * Toggle markers layer
   */
  toggleMarkers() {
    if (this.heatmapViz.markerLayer && this.map.hasLayer(this.heatmapViz.markerLayer)) {
      // Hide markers
      this.heatmapViz.hideMarkers();
      this.markersAlwaysVisible = false;
    } else {
      // Show markers - ensure layer exists first
      if (!this.heatmapViz.markerLayer) {
        this.heatmapViz.createMarkerLayer();
      }
      this.heatmapViz.showMarkers();
      this.markersAlwaysVisible = true;
    }
    this.updateLayerButtonStates();
  }
  /**
   * Toggle clusters layer
   */
  toggleClusters() {

    if (this.heatmapViz.clusterLayer) {
      this.heatmapViz.hideClusters();
    } else {
      this.heatmapViz.performClustering();
      this.heatmapViz.createClusterLayer();
      this.heatmapViz.showClusters();
    }
    this.updateLayerButtonStates();
  }
  /**
   * Handle quick filter selection
   */
  handleQuickFilter(filter) {
    // Update active chip
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.classList.remove('active');
    });
    document.querySelector(`[data-filter="${filter}"]`)?.classList.add('active');
    // Apply filter
    this.applyQuickFilter(filter);
  }
  /**
   * Apply quick filter
   */
  applyQuickFilter(filter) {
    const filters = this.controls ? this.controls.getCurrentFilters() : {};
    switch (filter) {
      case 'urgent':
        filters.status = 'urgent';
        break;
      case 'pending':
        filters.status = 'pending review';
        break;
      case 'resolved':
        filters.status = 'resolved';
        break;
      case 'today':
        filters.timeRange = 'today';
        break;
      case 'week':
        filters.timeRange = 'last7days';
        break;
      case 'all':
      default:
        // Reset all filters
        Object.keys(filters).forEach(key => {
          filters[key] = '';
        });
        break;
    }
    this.controls?.setFilters(filters);
    this.loadData();
  }
  /**
   * Handle keyboard shortcuts
   */
  handleKeyboardShortcuts(e) {

    if (e.ctrlKey || e.metaKey) {

      switch (e.key) {
        case 'h':
          e.preventDefault();
          this.toggleControls();
          break;
        case 'f':
          e.preventDefault();
          this.toggleFullscreen();
          break;
        case 'r':
          e.preventDefault();
          this.loadData();
          break;
        case 'e':
          e.preventDefault();
          this.showExportModal();
          break;
        case 'd':
          e.preventDefault();
          this.resetToDigosCity();
          break;
      }
    }
  }
  /**
   * Show export modal
   */
  showExportModal() {
    // Create export modal
    const modal = document.createElement('div');
    modal.className = 'export-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>📊 Export Heatmap</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="export-options">
            <h4>Export Format:</h4>
            <div class="format-options">
              ${this.exportFormats.map(format => `
                <label class="format-option">
                  <input type="radio" name="export-format" value="${format.toLowerCase()}" ${format === 'PNG' ? 'checked' : ''}>
                  <span>${format}</span>
                </label>
              `).join('')}
            </div>
            <h4>Export Options:</h4>
            <div class="export-settings">
              <label class="checkbox-label">
                <input type="checkbox" id="include-legend" checked>
                <span class="checkmark"></span>
                Include Legend
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="include-stats" checked>
                <span class="checkmark"></span>
                Include Statistics
              </label>
              <label class="checkbox-label">
                <input type="checkbox" id="high-quality">
                <span class="checkmark"></span>
                High Quality
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary modal-cancel">Cancel</button>
          <button class="btn-primary modal-export">Export</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    modal.querySelector('.modal-cancel').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    modal.querySelector('.modal-export').addEventListener('click', () => {
      this.performExport(modal);
      document.body.removeChild(modal);
    });
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }
  /**
   * Perform export
   */
  performExport(modal) {
    const format = modal.querySelector('input[name="export-format"]:checked').value;
    const includeLegend = modal.querySelector('#include-legend').checked;
    const includeStats = modal.querySelector('#include-stats').checked;
    const highQuality = modal.querySelector('#high-quality').checked;
    // Implement export functionality based on format
    switch (format) {
      case 'png':
        this.exportAsPNG(includeLegend, includeStats, highQuality);
        break;
      case 'svg':
        this.exportAsSVG(includeLegend, includeStats);
        break;
      case 'pdf':
        this.exportAsPDF(includeLegend, includeStats);
        break;
      case 'csv':
        this.exportAsCSV();
        break;
    }
  }
  /**
   * Export as PNG
   */
  exportAsPNG(includeLegend, includeStats, highQuality) {
    // Implementation for PNG export
    this.showMessage('info', 'PNG export feature coming soon');
  }
  /**
   * Export as SVG
   */
  exportAsSVG(includeLegend, includeStats) {
    // Implementation for SVG export
    this.showMessage('info', 'SVG export feature coming soon');
  }
  /**
   * Export as PDF
   */
  exportAsPDF(includeLegend, includeStats) {
    // Implementation for PDF export
    this.showMessage('info', 'PDF export feature coming soon');
  }
  /**
   * Export as CSV
   */
  exportAsCSV() {
    try {
      if (!this.heatmapViz.complaintData || this.heatmapViz.complaintData.length === 0) {
        this.showMessage('warning', 'No data to export');
        return;
      }
      const csvData = this.heatmapViz.complaintData.map(complaint => ({
        id: complaint.id,
        title: complaint.title,
        status: complaint.status,
        category: complaint.category || complaint.type,
        subcategory: complaint.subcategory || complaint.subtype,
        latitude: complaint.lat,
        longitude: complaint.lng,
        submitted_at: complaint.submitted_at,
        priority: complaint.priority
      }));
      const csv = this.convertToCSV(csvData);
      this.downloadFile(csv, 'complaints-export.csv', 'text/csv');
      this.showMessage('success', 'CSV exported successfully');
    } catch (error) {
      console.error('[ENHANCED-HEATMAP] CSV export failed:', error);
      this.showMessage('error', 'Failed to export CSV');
    }
  }
  /**
   * Convert data to CSV format
   */
  convertToCSV(data) {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      });
      csvRows.push(values.join(','));
    });
    return csvRows.join('\n');
  }
  /**
   * Download file
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  /**
   * Fit map to complaints bounds
   */
  fitToComplaints() {

    if (!this.heatmapViz.complaintData || this.heatmapViz.complaintData.length === 0) {
      this.showMessage('warning', 'No complaint data to fit to');
      return;
    }
    const bounds = L.latLngBounds();
    this.heatmapViz.complaintData.forEach(complaint => {
      bounds.extend([complaint.lat, complaint.lng]);
    });
    this.map.fitBounds(bounds, { padding: [20, 20] });
  }
  /**
   * Reset map view to Digos City center
   */
  resetToDigosCity() {
    if (!this.map) return;
    // Digos City coordinates and optimal zoom level
    const digosCityCenter = [6.7492, 125.3571];
    const optimalZoom = 12;
    // Add a temporary marker to show the center point
    this.addTemporaryCenterMarker(digosCityCenter);
    // Smooth transition to Digos City
    this.map.setView(digosCityCenter, optimalZoom, {
      animate: true,
      duration: 1.0, // 1 second animation
      easeLinearity: 0.25
    });
    // Show confirmation message
    this.showMessage('success', 'Map reset to Digos City center');
    // Update statistics after reset
    setTimeout(() => {
      this.updateStatistics();
    }, 1000);
  }
  /**
   * Add temporary center marker for visual feedback
   */
  addTemporaryCenterMarker(center) {
    // Remove existing temporary marker if any
    if (this.tempCenterMarker) {
      this.map.removeLayer(this.tempCenterMarker);
    }
    // Create a pulsing marker at the center
    const centerIcon = L.divIcon({
      className: 'temp-center-marker',
      html: '<div class="center-pulse"></div>',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    this.tempCenterMarker = L.marker(center, { icon: centerIcon }).addTo(this.map);
    // Remove the temporary marker after 3 seconds
    setTimeout(() => {
      if (this.tempCenterMarker) {
        this.map.removeLayer(this.tempCenterMarker);
        this.tempCenterMarker = null;
      }
    }, 3000);
  }
  /**
   * Update statistics
   */
  updateStatistics() {
    if (!this.heatmapViz) return;
    const data = this.heatmapViz.complaintData || [];
    const clusters = this.heatmapViz.clusters || [];
    this.statistics = {
      totalComplaints: data.length,
      clusters: clusters.length,
      noisePoints: this.heatmapViz.dbscan?.noisePoints?.length || 0,
      densityScore: this.calculateDensityScore(data),
      avgResponseTime: this.calculateAvgResponseTime(data),
      resolutionRate: this.calculateResolutionRate(data)
    };
    // Update controls statistics
    if (this.controls) {
      this.controls.updateStatistics(this.statistics);
    }
  }
  /**
   * Calculate density score
   */
  calculateDensityScore(data) {
    if (data.length === 0) return 0;
    // Simple density calculation based on area and point count
    const bounds = this.map.getBounds();
    const area = bounds.getNorthEast().distanceTo(bounds.getSouthWest()) *
                 bounds.getNorthEast().distanceTo(bounds.getNorthWest());
    return Math.round((data.length / area) * 1000) / 1000;
  }
  /**
   * Calculate average response time
   */
  calculateAvgResponseTime(data) {
    const resolvedComplaints = data.filter(c => c.status === 'resolved' && c.resolved_at);
    if (resolvedComplaints.length === 0) return 0;
    const totalTime = resolvedComplaints.reduce((sum, complaint) => {
      const submitted = new Date(complaint.submitted_at);
      const resolved = new Date(complaint.resolved_at);
      return sum + (resolved - submitted);
    }, 0);
    return Math.round(totalTime / resolvedComplaints.length / (1000 * 60 * 60 * 24) * 10) / 10; // Days
  }
  /**
   * Calculate resolution rate
   */
  calculateResolutionRate(data) {
    if (data.length === 0) return 0;
    const resolved = data.filter(c => c.status === 'resolved').length;
    return Math.round((resolved / data.length) * 100);
  }
  /**
   * Update header statistics
   */
  updateHeaderStats() {
    document.getElementById('header-total-complaints').textContent = this.statistics.totalComplaints;
    document.getElementById('header-clusters').textContent = this.statistics.clusters;
    document.getElementById('header-density').textContent = this.statistics.densityScore;
  }
  /**
   * Show/hide loading indicator
   */
  showLoading(show) {
    const loading = document.getElementById('map-loading');
    if (loading) {
      loading.style.display = show ? 'block' : 'none';
    }
  }
  /**
   * Show error message
   */
  showError(message) {
    this.showMessage('error', message);
  }
  /**
   * Show message
   */
  showMessage(type, message) {
    // Use existing toast system if available
    if (window.showMessage) {
      window.showMessage(type, message);
    } else {
      // No message handler available
    }
  }
  /**
   * Cleanup resources
   */
  destroy() {

    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }
    if (this.map) {
      this.map.remove();
    }
  }
}
// Initialize enhanced heatmap when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const enhancedController = new EnhancedHeatmapController();
    await enhancedController.initialize();
    // Make controller globally available
    window.enhancedHeatmapController = enhancedController;
    // Expose a simple global command to rebuild
    window.recreateHeatmap = async () => {
      if (window.enhancedHeatmapController) {
        await window.enhancedHeatmapController.rebuildMap();
      }
    };
  } catch (error) {
    console.error('[ENHANCED-HEATMAP] Failed to initialize:', error);
  }
});
