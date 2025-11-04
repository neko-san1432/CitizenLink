/**
 * Heatmap Controls - UI controls for heatmap functionality
 * Handles filters, clustering parameters, and view switching
 */
class HeatmapControls {

  constructor(controller) {
    this.controller = controller;
    this.currentFilters = {
      status: '',
      category: '',
      subcategory: '',
      department: '',
      timeRange: '',
      startDate: '',
      endDate: '',
      includeResolved: true
    };
    this.clusteringParams = {
      eps: 0.01,
      minPts: 3
    };
    this.isVisible = true;
    this.createControls();
  }
  /**
   * Create the controls UI
   */
  createControls() {
    const controlsContainer = document.createElement('div');
    controlsContainer.id = 'heatmap-controls';
    controlsContainer.className = 'map-controls';
    controlsContainer.innerHTML = this.getControlsHTML();
    // Insert after the map container
    const mapContainer = document.getElementById('map');
    if (mapContainer && mapContainer.parentNode) {
      mapContainer.parentNode.insertBefore(controlsContainer, mapContainer.nextSibling);
    }
    this.setupEventListeners();
    this.loadCategories();
    this.loadDepartments();
  }
  /**
   * Get HTML for controls
   * @returns {string} HTML content
   */
  getControlsHTML() {
    return `
      <div class="control-section">
        <h3>🗺️ Heatmap Controls</h3>

        <!-- Filters -->
        <div class="control-group">
          <label>Status Filter:</label>
          <select id="status-filter">
            <option value="">All Statuses</option>
            <option value="pending review">Pending Review</option>
            <option value="in progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div class="control-group">
          <label>Category Filter:</label>
          <select id="category-filter">
            <option value="">All Categories</option>
            <div id="category-options-loading">Loading categories...</div>
          </select>
        </div>

        <div class="control-group">
          <label>Subcategory Filter:</label>
          <select id="subcategory-filter" disabled>
            <option value="">Select a category first</option>
          </select>
        </div>

        <div class="control-group">
          <label>Department Filter:</label>
          <select id="department-filter">
            <option value="">All Departments</option>
            <div id="department-options-loading">Loading departments...</div>
          </select>
        </div>

        <div class="control-group">
          <label>Time Range:</label>
          <select id="time-range-filter">
            <option value="">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
            <option value="last90days">Last 90 Days</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        <div class="control-group" id="custom-date-range" style="display: none;">
          <label>Custom Date Range:</label>
          <input type="date" id="start-date" placeholder="Start Date">
          <input type="date" id="end-date" placeholder="End Date">
        </div>

        <div class="control-group">
          <label>
            <input type="checkbox" id="include-resolved" checked>
            Include Resolved Complaints
          </label>
        </div>

        <!-- Clustering Controls -->
        <div class="control-group clustering-controls">
          <label>Clustering:</label>
          <div class="clustering-toggle">
            <label>
              <input type="checkbox" id="enable-clustering">
              Enable DBSCAN Clustering
            </label>
          </div>

          <div class="clustering-params" id="clustering-params" style="display: none;">
            <label>Epsilon (km):</label>
            <input type="range" id="eps-slider" min="0.005" max="0.05" step="0.005" value="0.01">
            <span id="eps-value">0.01</span>

            <label>Min Points:</label>
            <input type="range" id="minpts-slider" min="2" max="10" step="1" value="3">
            <span id="minpts-value">3</span>

            <button id="suggest-params" class="btn-small">Suggest Parameters</button>
          </div>
        </div>

        <!-- Zoom Controls -->
        <div class="control-group">
          <label>Zoom Threshold:</label>
          <input type="range" id="zoom-threshold" min="10" max="18" step="1" value="14">
          <span id="zoom-threshold-value">14</span>
          <small>Show markers at this zoom level</small>
        </div>

        <!-- Heatmap Intensity -->
        <div class="control-group">
          <label>Heatmap Intensity:</label>
          <input type="range" id="heatmap-intensity" min="0.1" max="2.0" step="0.1" value="1.0">
          <span id="heatmap-intensity-value">1.0</span>
          <small>Adjust heatmap visibility</small>
        </div>

        <!-- Action Buttons -->
        <div class="control-group">
          <button id="apply-filters" class="btn-primary">Apply Filters</button>
          <button id="reset-filters" class="btn-secondary">Reset</button>
          <button id="fit-to-complaints" class="btn-secondary">Fit to Complaints</button>
        </div>

        <!-- Statistics -->
        <div class="control-group stats-section">
          <h4>Statistics</h4>
          <div id="stats-display">
            <p>Total Complaints: <span id="total-complaints">0</span></p>
            <p>Clusters: <span id="cluster-count">0</span></p>
            <p>Noise Points: <span id="noise-count">0</span></p>
          </div>
        </div>

        <!-- Error Display -->
        <div id="error-display" class="error" style="display: none;"></div>
      </div>
    `;
  }
  /**
   * Set up event listeners
   */
  setupEventListeners() {

    // Filter controls
    document.getElementById('apply-filters')?.addEventListener('click', () => {
      this.applyFilters();
    });
    document.getElementById('reset-filters')?.addEventListener('click', () => {
      this.resetFilters();
    });
    document.getElementById('fit-to-complaints')?.addEventListener('click', () => {
      this.controller.fitToComplaints();
    });
    // Clustering controls
    document.getElementById('enable-clustering')?.addEventListener('change', (e) => {
      this.toggleClustering(e.target.checked);
    });
    // Auto-switch toggle
    document.getElementById('eps-slider')?.addEventListener('input', (e) => {
      this.updateEpsValue(e.target.value);
    });
    document.getElementById('minpts-slider')?.addEventListener('input', (e) => {
      this.updateMinPtsValue(e.target.value);
    });
    document.getElementById('suggest-params')?.addEventListener('click', () => {
      this.suggestParameters();
    });
    // Real-time updates for sliders
    document.getElementById('eps-slider')?.addEventListener('input', (e) => {
      this.updateClusteringParams();
    });
    document.getElementById('minpts-slider')?.addEventListener('input', (e) => {
      this.updateClusteringParams();
    });
    // Zoom threshold slider
    document.getElementById('zoom-threshold')?.addEventListener('input', (e) => {
      const threshold = parseInt(e.target.value);
      this.updateZoomThresholdValue(threshold);
      this.controller.setZoomThreshold(threshold);
    });
    // Heatmap intensity slider
    document.getElementById('heatmap-intensity')?.addEventListener('input', (e) => {
      const intensity = parseFloat(e.target.value);
      this.updateHeatmapIntensityValue(intensity);
      this.controller.setHeatmapIntensity(intensity);
    });
    // Filter change listeners
    document.getElementById('status-filter')?.addEventListener('change', () => {
      this.applyFilters();
    });
    document.getElementById('category-filter')?.addEventListener('change', async (e) => {
      const categoryId = e.target.value;
      await this.loadSubcategories(categoryId);
      this.currentFilters.category = categoryId;
      this.currentFilters.subcategory = ''; // Reset subcategory when category changes
      this.applyFilters();
    });
    document.getElementById('subcategory-filter')?.addEventListener('change', (e) => {
      this.currentFilters.subcategory = e.target.value;
      this.applyFilters();
    });
    document.getElementById('department-filter')?.addEventListener('change', () => {
      this.applyFilters();
    });
    document.getElementById('time-range-filter')?.addEventListener('change', (e) => {
      const timeRange = e.target.value;
      this.currentFilters.timeRange = timeRange;
      // Show/hide custom date range
      const customDateRange = document.getElementById('custom-date-range');
      if (timeRange === 'custom') {
        customDateRange.style.display = 'block';
      } else {
        customDateRange.style.display = 'none';
        // Set date range based on selection
        this.setDateRangeFromTimeRange(timeRange);
      }
      this.applyFilters();
    });
    document.getElementById('start-date')?.addEventListener('change', () => {
      this.applyFilters();
    });
    document.getElementById('end-date')?.addEventListener('change', () => {
      this.applyFilters();
    });
    document.getElementById('include-resolved')?.addEventListener('change', () => {
      this.applyFilters();
    });
  }
  /**
   * Apply current filters
   */
  async applyFilters() {
    const filters = this.getCurrentFilters();
    await this.controller.applyFilters(filters);
  }
  /**
   * Reset all filters
   */
  resetFilters() {
    // Reset form values
    document.getElementById('status-filter').value = '';
    document.getElementById('type-filter').value = '';
    document.getElementById('department-filter').value = '';
    document.getElementById('start-date').value = '';
    document.getElementById('end-date').value = '';
    document.getElementById('include-resolved').checked = true;
    // Reset clustering
    document.getElementById('enable-clustering').checked = false;
    this.toggleClustering(false);
    // Apply reset filters
    this.currentFilters = {
      status: '',
      type: '',
      department: '',
      startDate: '',
      endDate: '',
      includeResolved: true
    };
    this.applyFilters();
  }
  /**
   * Set date range based on time range selection
   * @param {string} timeRange - Selected time range
   */
  setDateRangeFromTimeRange(timeRange) {
    const now = new Date();
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    if (!startDateInput || !endDateInput) return;
    let startDate, endDate;
    switch (timeRange) {
      case 'today':
        startDate = endDate = now;
        break;
      case 'yesterday':
        startDate = endDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'last7days':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case 'last30days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      case 'last90days':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        endDate = now;
        break;
      default:
        return;
    }
    startDateInput.value = startDate.toISOString().split('T')[0];
    endDateInput.value = endDate.toISOString().split('T')[0];
  }
  /**
   * Get current filter values
   * @returns {Object} Current filters
   */
  getCurrentFilters() {
    return {
      status: document.getElementById('status-filter')?.value || '',
      category: this.currentFilters.category || '',
      subcategory: this.currentFilters.subcategory || '',
      department: document.getElementById('department-filter')?.value || '',
      timeRange: this.currentFilters.timeRange || '',
      startDate: document.getElementById('start-date')?.value || '',
      endDate: document.getElementById('end-date')?.value || '',
      includeResolved: document.getElementById('include-resolved')?.checked || true
    };
  }
  /**
   * Toggle clustering on/off
   * @param {boolean} enabled - Whether clustering is enabled
   */
  toggleClustering(enabled) {
    const paramsDiv = document.getElementById('clustering-params');
    if (paramsDiv) {
      paramsDiv.style.display = enabled ? 'block' : 'none';
    }
    this.controller.toggleClustering(enabled);
  }
  /**
   * Update epsilon value display
   * @param {string} value - Epsilon value
   */
  updateEpsValue(value) {
    const display = document.getElementById('eps-value');
    if (display) {
      display.textContent = value;
    }
    this.clusteringParams.eps = parseFloat(value);
  }
  /**
   * Update min points value display
   * @param {string} value - Min points value
   */
  updateMinPtsValue(value) {
    const display = document.getElementById('minpts-value');
    if (display) {
      display.textContent = value;
    }
    this.clusteringParams.minPts = parseInt(value);
  }
  /**
   * Update clustering parameters
   */
  updateClusteringParams() {
    const eps = parseFloat(document.getElementById('eps-slider')?.value || 0.01);
    const minPts = parseInt(document.getElementById('minpts-slider')?.value || 3);
    this.clusteringParams.eps = eps;
    this.clusteringParams.minPts = minPts;
    this.controller.updateClusteringParameters(eps, minPts);
  }
  /**
   * Suggest optimal clustering parameters
   */
  suggestParameters() {

    if (!this.controller.heatmapViz || this.controller.heatmapViz.complaintData.length === 0) {
      this.showError('No complaint data available for parameter suggestion');
      return;
    }
    const points = this.controller.heatmapViz.complaintData.map(c => ({ lat: c.lat, lng: c.lng }));
    const suggested = this.controller.heatmapViz.dbscan.suggestParameters(points);
    // Update sliders
    const epsSlider = document.getElementById('eps-slider');
    const minPtsSlider = document.getElementById('minpts-slider');
    if (epsSlider) {
      epsSlider.value = suggested.eps;
      this.updateEpsValue(suggested.eps);
    }
    if (minPtsSlider) {
      minPtsSlider.value = suggested.minPts;
      this.updateMinPtsValue(suggested.minPts);
    }
    // Update clustering
    this.updateClusteringParams();
  }
  /**
   * Update zoom threshold value display
   * @param {number} value - Zoom threshold value
   */
  updateZoomThresholdValue(value) {
    const thresholdValue = document.getElementById('zoom-threshold-value');
    if (thresholdValue) {
      thresholdValue.textContent = value;
    }
  }
  /**
   * Update heatmap intensity value display
   * @param {number} value - Heatmap intensity value
   */
  updateHeatmapIntensityValue(value) {
    const intensityValue = document.getElementById('heatmap-intensity-value');
    if (intensityValue) {
      intensityValue.textContent = value.toFixed(1);
    }
  }
  /**
   * Update statistics display
   * @param {Object} stats - Statistics object
   */
  updateStatistics(stats) {
    const totalComplaints = document.getElementById('total-complaints');
    const clusterCount = document.getElementById('cluster-count');
    const noiseCount = document.getElementById('noise-count');
    if (totalComplaints) {
      totalComplaints.textContent = stats.totalComplaints || 0;
    }
    if (stats.clusteringStats) {

      if (clusterCount) {
        clusterCount.textContent = stats.clusteringStats.numClusters || 0;
      }
      if (noiseCount) {
        noiseCount.textContent = stats.clusteringStats.numNoise || 0;
      }
    } else {
      if (clusterCount) clusterCount.textContent = '0';
      if (noiseCount) noiseCount.textContent = '0';
    }
  }
  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    const errorDiv = document.getElementById('error-display');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      // Hide after 5 seconds
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 5000);
    }
  }
  /**
   * Toggle controls visibility
   */
  toggleVisibility() {
    const controls = document.getElementById('heatmap-controls');
    if (controls) {
      this.isVisible = !this.isVisible;
      controls.style.display = this.isVisible ? 'block' : 'none';
    }
  }
  /**
   * Load categories dynamically
   */
  async loadCategories() {
    try {
      const apiClientModule = await import('../../config/apiClient.js');
      const apiClient = apiClientModule.default;
      const { data, error } = await apiClient.get('/api/department-structure/categories');
      if (error) throw error;
      const categorySelect = document.getElementById('category-filter');
      if (categorySelect) {
        // Remove loading placeholder
        const loadingEl = document.getElementById('category-options-loading');
        if (loadingEl) {
          loadingEl.remove();
        }
        // Add category options
        if (data && data.length > 0) {
          data.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = `${category.icon} ${category.name}`;
            categorySelect.appendChild(option);
          });
        }
      }
    } catch (error) {
      console.error('Error loading categories for heatmap:', error);
      const categorySelect = document.getElementById('category-filter');
      if (categorySelect) {
        const loadingEl = document.getElementById('category-options-loading');
        if (loadingEl) {
          loadingEl.innerHTML = '<option value="">Error loading categories</option>';
        }
      }
    }
  }
  /**
   * Load subcategories for selected category
   */
  async loadSubcategories(categoryId) {
    const subcategorySelect = document.getElementById('subcategory-filter');
    if (!subcategorySelect) return;
    try {
      if (!categoryId) {
        subcategorySelect.innerHTML = '<option value="">Select a category first</option>';
        subcategorySelect.disabled = true;
        return;
      }
      subcategorySelect.innerHTML = '<option value="">Loading subcategories...</option>';
      subcategorySelect.disabled = true;
      const apiClientModule = await import('../../config/apiClient.js');
      const apiClient = apiClientModule.default;
      const { data, error } = await apiClient.get(`/api/department-structure/categories/${categoryId}/subcategories`);
      if (error) throw error;
      subcategorySelect.innerHTML = '<option value="">All Subcategories</option>';
      if (data && data.length > 0) {
        data.forEach(subcategory => {
          const option = document.createElement('option');
          option.value = subcategory.id;
          option.textContent = subcategory.name;
          subcategorySelect.appendChild(option);
        });
        subcategorySelect.disabled = false;
      } else {
        subcategorySelect.innerHTML = '<option value="">No subcategories available</option>';
      }
    } catch (error) {
      console.error('Error loading subcategories:', error);
      subcategorySelect.innerHTML = '<option value="">Error loading subcategories</option>';
    }
  }
  /**
   * Load departments dynamically
   */
  async loadDepartments() {
    try {
      const { getDepartments } = await import('../../utils/departmentUtils.js');
      const departments = await getDepartments();
      const departmentSelect = document.getElementById('department-filter');
      if (departmentSelect) {
        // Remove loading placeholder
        const loadingEl = document.getElementById('department-options-loading');
        if (loadingEl) {
          loadingEl.remove();
        }
        // Add department options
        departments.forEach(dept => {
          const option = document.createElement('option');
          option.value = dept.code;
          option.textContent = `${dept.name} (${dept.code})`;
          departmentSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Error loading departments for heatmap:', error);
      // Fallback to basic options
      const departmentSelect = document.getElementById('department-filter');
      if (departmentSelect) {
        const loadingEl = document.getElementById('department-options-loading');
        if (loadingEl) {
          loadingEl.innerHTML = '<option value="">Error loading departments</option>';
        }
      }
    }
  }
  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return {
      filters: this.getCurrentFilters(),
      clusteringParams: this.clusteringParams,
      isVisible: this.isVisible
    };
  }
}
// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {

  module.exports = HeatmapControls;
} else {
  window.HeatmapControls = HeatmapControls;
}
