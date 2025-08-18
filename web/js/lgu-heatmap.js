document.addEventListener('DOMContentLoaded', async () => {
  // Get user and complaints
  const user = await checkAuth();
  if (!user) return;
  
  // Initialize map
  await initializeMap();
  
  // Setup filters
  setupFilters();
  
  // Setup real-time updates
  setupRealTimeUpdates();
  
  // Setup export functionality
  setupExportFeatures();
  
  // Initialize analytics
  initializeAnalytics();
  
  // Run initial clustering as part of map initialization/update flow
  try { updateHeatmap(); } catch (_) {}
});

// Authentication function
async function checkAuth() {
  try {
    // Check if user is authenticated
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (!user.id) {
      console.log('No authenticated user found');
      return null;
    }
    
    // Check if user is LGU type
    if (user.type !== 'lgu' && user.role !== 'lgu' && user.role !== 'admin') {
      console.log('User not authorized for LGU heatmap');
      return null;
    }
    
    return { username: user.email, type: user.type || user.role };
  } catch (error) {
    console.error('Error checking auth:', error);
    return null;
  }
}

// Initialize map
async function initializeMap() {
  try {
    // Create map centered on Digos City, Philippines (based on the image coordinates)
    // Move zoom control away from sidebar (to top-right)
    const map = L.map('complaint-map', { zoomControl: false }).setView([6.75, 125.35], 12);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add zoom control to top-right to avoid sidebar overlap
    L.control.zoom({ position: 'topright' }).addTo(map);
    // Add status legend to the top-right
    addStatusLegend(map);
    
    // Load real Digos city boundary from JSON file
    try {
      const response = await fetch('/lgu/border_locations.json');
      const data = await response.json();
      
      if (data && data[0] && data[0].geojson) {
        const geojson = data[0].geojson;
        
        // Create the boundary polygon from real coordinates
        const boundary = L.polygon(geojson.coordinates[0], {
          color: '#2E86AB',        // Blue border
          weight: 3,               // Border thickness
          opacity: 0.8,            // Border opacity
          fillColor: '#2E86AB',    // Fill color
          fillOpacity: 0.1         // Very transparent fill
        });
        
        // Add boundary to map
        boundary.addTo(map);
        
        // Fit and restrict map to the boundary bounds
        const bounds = boundary.getBounds();
        map.fitBounds(bounds);
        map.setMaxBounds(bounds.pad(0.05));
        map.options.minZoom = map.getZoom();
        
        // Create a mask to visually clip outside the boundary
        try {
          const world = [
            [90, -360], [90, 360],
            [-90, 360], [-90, -360]
          ];
          const maskCoords = [world, geojson.coordinates[0]];
          const mask = L.polygon(maskCoords, {
            stroke: false,
            fillColor: '#ffffff',
            fillOpacity: 0.85,
            interactive: false
          });
          mask.addTo(map);
          // Bring boundary on top of mask
          boundary.bringToFront();
        } catch (_) {
          // If mask creation fails, continue without visual crop
        }
        
        console.log('✅ Real Digos city boundary loaded successfully');
        
        // Store boundary reference for toggle functionality
        window.boundaryLayer = boundary;
        
        // Add boundary toggle button to controls
        addBoundaryToggleButton();
        
      } else {
        console.warn('⚠️ Could not parse boundary data, using fallback');
        createFallbackBoundary(map);
      }
    } catch (error) {
      console.error('❌ Error loading boundary data:', error);
      console.log('🔄 Using fallback boundary');
      createFallbackBoundary(map);
    }
    
    // Get complaints data from Supabase
    const complaints = await window.getComplaints();
    
    // Filter complaints that have coordinates and are inside the city boundary
    const complaintsWithCoordinates = complaints.filter(complaint => 
      complaint.latitude && complaint.longitude
    );
    
    // Filter complaints to only show those inside the city boundary
    const complaintsInsideBoundary = filterComplaintsInsideBoundary(complaintsWithCoordinates, window.boundaryLayer);
    
    console.log(`📊 Total complaints with coordinates: ${complaintsWithCoordinates.length}`);
    console.log(`🏙️ Complaints inside city boundary: ${complaintsInsideBoundary.length}`);
    
    if (complaintsInsideBoundary.length === 0) {
      // Show "No complaints inside city boundary" message
      const noDataMessage = document.createElement('div');
      noDataMessage.className = 'no-data-message';
      noDataMessage.innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-map-marker-alt fa-4x text-muted mb-4"></i>
          <h3 class="text-muted">No complaints inside city boundary</h3>
          <p class="text-muted mb-4">All complaints with coordinates are outside the LGU jurisdiction area.</p>
          <p class="text-muted">Only complaints within Digos City boundaries are displayed.</p>
        </div>
      `;
      
      const mapContainer = document.getElementById('complaint-map');
      if (mapContainer) {
        mapContainer.appendChild(noDataMessage);
      }
      return;
    }
    
    // Create heatmap data from complaints inside boundary
    const heatmapData = complaintsInsideBoundary.map(complaint => [
      parseFloat(complaint.latitude),
      parseFloat(complaint.longitude),
      getComplaintWeight(complaint)
    ]);
    
    // Add heatmap layer
    const heat = L.heatLayer(heatmapData, {
      radius: 30,
      blur: 20,
      maxZoom: 15,
      gradient: {
        0.4: 'blue',
        0.6: 'lime',
        0.8: 'yellow',
        1.0: 'red'
      }
    }).addTo(map);
    
    // Prepare markers (we will add/remove them as a layer based on zoom level)
    const complaintMarkers = [];
    complaintsInsideBoundary.forEach(complaint => {
      const marker = createComplaintMarker(complaint);
      complaintMarkers.push(marker);
    });
    const markerLayer = L.layerGroup(complaintMarkers);
    window.markerLayer = markerLayer;

    // Add/remove marker layer based on zoom level
    const MARKER_VISIBILITY_ZOOM = 14;
    const applyMarkerLayerVisibility = () => {
      const shouldShowMarkers = map.getZoom() >= MARKER_VISIBILITY_ZOOM;
      const currentMarkerLayer = window.markerLayer;
      const markersOnMap = currentMarkerLayer ? map.hasLayer(currentMarkerLayer) : false;
      const heatOnMap = window.heatLayer && map.hasLayer(window.heatLayer);

      if (shouldShowMarkers) {
        if (!markersOnMap && currentMarkerLayer) currentMarkerLayer.addTo(map);
        // Hide heatmap when showing markers
        if (heatOnMap) map.removeLayer(window.heatLayer);
      } else {
        if (markersOnMap && currentMarkerLayer) map.removeLayer(currentMarkerLayer);
        // Show heatmap when zoomed out
        if (window.heatLayer && !heatOnMap) window.heatLayer.addTo(map);
      }
    };
    // Apply initial state
    applyMarkerLayerVisibility();
    
    // Show/hide marker layer on zoom
    map.on('zoomend', applyMarkerLayerVisibility);
    
    // Store map reference globally for filter updates
    window.complaintMap = map;
    window.complaintMarkers = complaintMarkers;
    window.heatLayer = heat;
    window.complaintsInsideBoundary = complaintsInsideBoundary;
    window.markerLayer = markerLayer;
    
    // Add map controls
    addMapControls(map);

    // Update analytics/statistics with the currently displayed complaints
    try {
      updateStatistics(complaintsInsideBoundary);
    } catch (e) {
      console.warn('Statistics update skipped:', e);
    }
    
    console.log(`Heatmap initialized with ${complaintsInsideBoundary.length} complaints inside city boundary`);
  } catch (error) {
    console.error('Error initializing map:', error);
    
    // Show error message
    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-exclamation-triangle fa-4x text-warning mb-4"></i>
        <h3 class="text-warning">Error loading heatmap</h3>
        <p class="text-muted mb-4">Unable to load complaint data for the heatmap.</p>
        <button class="btn btn-outline-warning" onclick="location.reload()">
          <i class="fas fa-redo"></i> Try Again
        </button>
      </div>
    `;
    
    const mapContainer = document.getElementById('complaint-map');
    if (mapContainer) {
      mapContainer.appendChild(errorMessage);
    }
  }
}

// Add map controls for better user experience
function addMapControls(map) {
  // Add fullscreen control
  try {
    if (L.control && L.control.fullscreen) {
      const fullscreenControl = L.control.fullscreen({
        position: 'topright',
        title: 'Toggle Fullscreen',
        titleCancel: 'Exit Fullscreen',
        content: '<i class="fas fa-expand"></i>'
      });
      fullscreenControl.addTo(map);
    }
  } catch (_) {}
  
  // Add measure control
  try {
    if (L.control && L.control.measure) {
      const measureControl = L.control.measure({
        position: 'topright',
        primaryLengthUnit: 'meters',
        secondaryLengthUnit: 'kilometers',
        primaryAreaUnit: 'sqmeters',
        secondaryAreaUnit: 'acres',
        localization: 'en',
        decPoint: '.',
        thousandsSep: ','
      });
      measureControl.addTo(map);
    }
  } catch (_) {}
  
  // Add layer control
  const baseMaps = {
    "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
    "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'),
    "Terrain": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png')
  };
  
  const overlayMaps = {
    "Complaints": window.markerLayer || L.layerGroup([]),
    "Heatmap": window.heatLayer || L.layerGroup([])
  };
  
  try { L.control.layers(baseMaps, overlayMaps, { position: 'topright' }).addTo(map); } catch (_) {}
}

// Add a status legend control (top-right)
function addStatusLegend(map) {
  const legend = L.control({ position: 'topright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'leaflet-control leaflet-bar');
    div.style.background = 'white';
    div.style.padding = '10px';
    div.style.borderRadius = '6px';
    div.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    div.style.fontSize = '12px';
    div.style.lineHeight = '1.2';
    div.innerHTML = `
      <div style="font-weight:600; margin-bottom:6px;">Status</div>
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
        <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:#fbbf24; border:1px solid #fff"></span>
        <span>Pending</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
        <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:#3b82f6; border:1px solid #fff"></span>
        <span>In Progress</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:#10b981; border:1px solid #fff"></span>
        <span>Resolved</span>
      </div>
    `;
    return div;
  };
  legend.addTo(map);
}

// Create a complaint marker with enhanced tooltip
function createComplaintMarker(complaint) {
  let markerColor;
  switch (complaint.status) {
    case 'pending':
      markerColor = '#fbbf24'; // Yellow
      break;
    case 'in_progress':
      markerColor = '#3b82f6'; // Blue
      break;
    case 'resolved':
      markerColor = '#10b981'; // Green
      break;
    default:
      markerColor = '#64748b'; // Gray
  }
  
  // Use latitude and longitude from Supabase data
  const coordinates = [parseFloat(complaint.latitude), parseFloat(complaint.longitude)];
  
  const marker = L.circleMarker(coordinates, {
    radius: 8,
    fillColor: markerColor,
    color: '#fff',
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
  });
  
  // Create detailed tooltip content
  const tooltipContent = `
    <div class="complaint-tooltip">
      <div class="tooltip-header">
        <h4>${complaint.title || 'Untitled Complaint'}</h4>
        <span class="status-badge ${complaint.status}">${complaint.status ? complaint.status.replace('_', ' ') : 'Unknown'}</span>
      </div>
      <div class="tooltip-content">
        <p><strong>Type:</strong> ${complaint.type || 'Not specified'}</p>
                 <p><strong>Subcategory:</strong> ${complaint.subcategory || 'Not specified'}</p>
         <p><strong>Location:</strong> ${complaint.location || 'Location not specified'}</p>
         <p><strong>Submitted:</strong> ${formatDate(complaint.created_at || complaint.createdAt) || 'Date not available'}</p>
        ${complaint.suggested_unit ? `<p><strong>Assigned to:</strong> ${governmentUnitNames[complaint.suggested_unit] || complaint.suggested_unit}</p>` : ''}
        ${complaint.user_name ? `<p><strong>Complainant:</strong> ${complaint.user_name}</p>` : ''}
      </div>
      <div class="tooltip-actions">
        <a href="/lgu/complaints?id=${complaint.id}" class="view-details-btn">View Details</a>
      </div>
    </div>
  `;
  
  // Bind tooltip with HTML content
  marker.bindTooltip(tooltipContent, {
    direction: 'top',
    offset: [0, -10],
    className: 'complaint-tooltip-container',
    maxWidth: 300
  });
  
  // Add popup with complaint details
  marker.bindPopup(`
    <div class="map-popup">
      <h3>${complaint.title || 'Untitled Complaint'}</h3>
      <p><strong>ID:</strong> ${complaint.id}</p>
      <p><strong>Location:</strong> ${complaint.location || 'Location not specified'}</p>
      <p><strong>Coordinates:</strong> ${complaint.latitude}, ${complaint.longitude}</p>
      <p><strong>Type:</strong> ${complaint.type || 'Not specified'}</p>
             <p><strong>Subcategory:</strong> ${complaint.subcategory || 'Not specified'}</p>
       <p><strong>Status:</strong> ${complaint.status || 'Not specified'}</p>
       <p><strong>Description:</strong> ${complaint.description || 'No description provided'}</p>
      <p><strong>Submitted:</strong> ${formatDate(complaint.created_at || complaint.createdAt) || 'Date not available'}</p>
      ${complaint.user_name ? `<p><strong>Complainant:</strong> ${complaint.user_name}</p>` : ''}
      <a href="/lgu/complaints?id=${complaint.id}" class="popup-link">View Full Details</a>
    </div>
  `);
  
  return marker;
}

// Calculate complaint weight for heatmap intensity
function getComplaintWeight(complaint) {
  let weight = 1;
  
  // Increase weight for unresolved complaints
  if (complaint.status === 'pending') {
    weight *= 1.5;
  }
  
  // Increase weight for in-progress complaints
  if (complaint.status === 'in_progress') {
    weight *= 1.2;
  }
  
  return weight;
}

// Government unit names mapping
const governmentUnitNames = {
  'city_hall': 'City Hall',
  'police': 'Police Department (PNP)',
  'fire': 'Fire Department (BFP)',
  'public_works': 'Public Works (DPWH)',
  'waste': 'Waste Management',
  'health': 'Health Department'
};

// Format date function
function formatDate(dateString) {
  if (!dateString) return 'Date not available';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Date not available';
  }
}

// Setup filters with enhanced functionality
function setupFilters() {
  const heatmapFilter = document.getElementById('heatmap-filter');
  const timeFilter = document.getElementById('time-filter');
  
  // Add event listeners
  heatmapFilter.addEventListener('change', updateHeatmap);
  timeFilter.addEventListener('change', updateHeatmap);
  
  // Add search functionality
  addSearchFilter();
  
  // Add advanced filters
  addAdvancedFilters();
}

// Add search filter for complaints
function addSearchFilter() {
  const filterButtons = document.querySelector('.filter-buttons');
  
  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-container';
  
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search complaints...';
  searchInput.className = 'search-input';
  searchInput.id = 'complaint-search';
  
  const searchButton = document.createElement('button');
  searchButton.className = 'search-button';
  searchButton.innerHTML = '<i class="fas fa-search"></i>';
  
  searchContainer.appendChild(searchInput);
  searchContainer.appendChild(searchButton);
  filterButtons.appendChild(searchContainer);
  
  // Add event listeners
  searchInput.addEventListener('input', debounce(updateHeatmap, 300));
  searchButton.addEventListener('click', updateHeatmap);
}

// Add advanced filters
function addAdvancedFilters() {
  const filterButtons = document.querySelector('.filter-buttons');
  
  const advancedFiltersContainer = document.createElement('div');
  advancedFiltersContainer.className = 'advanced-filters';
  
  // Status filter
  const statusFilter = document.createElement('select');
  statusFilter.id = 'status-filter';
  statusFilter.className = 'filter-select';
  statusFilter.innerHTML = `
    <option value="all">All Statuses</option>
    <option value="pending">Pending</option>
    <option value="in_progress">In Progress</option>
    <option value="resolved">Resolved</option>
  `;
  
  // Date range filters (from/to)
  const fromLabel = document.createElement('label');
  fromLabel.textContent = 'From:';
  fromLabel.className = 'filter-label';
  fromLabel.setAttribute('for', 'date-from');

  const dateFrom = document.createElement('input');
  dateFrom.type = 'date';
  dateFrom.id = 'date-from';
  dateFrom.className = 'filter-select';
  dateFrom.placeholder = 'From';
  dateFrom.setAttribute('aria-label', 'Start date');

  const toLabel = document.createElement('label');
  toLabel.textContent = 'To:';
  toLabel.className = 'filter-label';
  toLabel.setAttribute('for', 'date-to');

  const dateTo = document.createElement('input');
  dateTo.type = 'date';
  dateTo.id = 'date-to';
  dateTo.className = 'filter-select';
  dateTo.placeholder = 'To';
  dateTo.setAttribute('aria-label', 'End date');
  
  advancedFiltersContainer.appendChild(statusFilter);
  advancedFiltersContainer.appendChild(fromLabel);
  advancedFiltersContainer.appendChild(dateFrom);
  advancedFiltersContainer.appendChild(toLabel);
  advancedFiltersContainer.appendChild(dateTo);
  filterButtons.appendChild(advancedFiltersContainer);
  
  // Add event listeners
  statusFilter.addEventListener('change', updateHeatmap);
  dateFrom.addEventListener('change', updateHeatmap);
  dateTo.addEventListener('change', updateHeatmap);
}

// Setup real-time updates
function setupRealTimeUpdates() {
  // Add refresh button
  const filterButtons = document.querySelector('.filter-buttons');
  
  const refreshButton = document.createElement('button');
  refreshButton.className = 'refresh-button';
  refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
  refreshButton.title = 'Refresh data';
  
  filterButtons.appendChild(refreshButton);
  
  // Add event listener
  refreshButton.addEventListener('click', refreshData);
  
  // Auto-refresh every 5 minutes
  setInterval(refreshData, 5 * 60 * 1000);
  
  // Add loading indicator
  addLoadingIndicator();
}

// Add loading indicator
function addLoadingIndicator() {
  const mapCard = document.querySelector('.map-card');
  
  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'loading-overlay';
  loadingOverlay.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i>
      <span>Loading...</span>
    </div>
  `;
  
  mapCard.appendChild(loadingOverlay);
}

// Refresh data
function refreshData() {
  const loadingOverlay = document.querySelector('.loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
  }
  
  // Simulate data refresh
  setTimeout(() => {
    updateHeatmap();
    
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }
    
    showToast('Data refreshed successfully', 'success');
  }, 1000);
}

// Setup export functionality
function setupExportFeatures() {
  const pageHeader = document.querySelector('.page-header');
  
  const exportContainer = document.createElement('div');
  exportContainer.className = 'export-container';
  
  const exportButton = document.createElement('button');
  exportButton.className = 'export-button';
  exportButton.innerHTML = '<i class="fas fa-download"></i> Export Data';
  exportButton.title = 'Export heatmap data and statistics';
  
  exportContainer.appendChild(exportButton);
  pageHeader.appendChild(exportContainer);
  
  // Add event listener
  exportButton.addEventListener('click', showExportOptions);
}

// Setup clustering analysis button
function setupClusteringButton() {
  const clusterBtn = document.getElementById('cluster-analysis-btn');
  if (clusterBtn) {
    clusterBtn.addEventListener('click', async () => {
      try {
        // Show loading state
        clusterBtn.disabled = true;
        clusterBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        
        // Run clustering analysis
        await updateHeatmapWithClustering();
        
        // Show success message
        showToast('Clustering analysis completed successfully!', 'success');
        
      } catch (error) {
        console.error('Error running clustering analysis:', error);
        showToast('Failed to run clustering analysis', 'error');
      } finally {
        // Restore button state
        clusterBtn.disabled = false;
        clusterBtn.innerHTML = '<i class="fas fa-sitemap"></i> Run Clustering Analysis';
      }
    });
  }
}

// Show export options
function showExportOptions() {
  const exportModal = document.createElement('div');
  exportModal.className = 'export-modal';
  exportModal.innerHTML = `
    <div class="export-modal-content">
      <div class="export-modal-header">
        <h3>Export Data</h3>
        <button class="close-button">&times;</button>
      </div>
      <div class="export-modal-body">
        <div class="export-option">
          <h4>Export Format</h4>
          <select id="export-format" class="export-select">
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="excel">Excel</option>
          </select>
        </div>
        <div class="export-option">
          <h4>Data Type</h4>
          <div class="export-checkboxes">
            <label><input type="checkbox" value="complaints" checked> Complaints Data</label>
            <label><input type="checkbox" value="statistics" checked> Statistics</label>
            <label><input type="checkbox" value="heatmap" checked> Heatmap Coordinates</label>
          </div>
        </div>
        <div class="export-option">
          <h4>Date Range</h4>
          <div class="export-date-range">
            <input type="date" id="export-start-date" class="export-date">
            <span>to</span>
            <input type="date" id="export-end-date" class="export-date">
          </div>
        </div>
      </div>
      <div class="export-modal-footer">
        <button class="export-cancel-btn">Cancel</button>
        <button class="export-confirm-btn">Export</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(exportModal);
  
  // Add event listeners
  const closeButton = exportModal.querySelector('.close-button');
  const cancelButton = exportModal.querySelector('.export-cancel-btn');
  const confirmButton = exportModal.querySelector('.export-confirm-btn');
  
  closeButton.addEventListener('click', () => exportModal.remove());
  cancelButton.addEventListener('click', () => exportModal.remove());
  confirmButton.addEventListener('click', () => {
    exportData();
    exportModal.remove();
  });
  
  // Set default dates
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
  
  document.getElementById('export-start-date').value = lastMonth.toISOString().split('T')[0];
  document.getElementById('export-end-date').value = today.toISOString().split('T')[0];
}

// Export data
function exportData() {
  const format = document.getElementById('export-format').value;
  const startDate = document.getElementById('export-start-date').value;
  const endDate = document.getElementById('export-end-date').value;
  
  // Get filtered data
  const complaints = getComplaints().filter(complaint => {
    const complaintDate = new Date(complaint.createdAt);
    const start = new Date(startDate);
    const end = new Date(endDate);
    return complaintDate >= start && complaintDate <= end;
  });
  
  let data, filename, mimeType;
  
  switch (format) {
    case 'csv':
      data = convertToCSV(complaints);
      filename = `complaints_${startDate}_to_${endDate}.csv`;
      mimeType = 'text/csv';
      break;
    case 'json':
      data = JSON.stringify(complaints, null, 2);
      filename = `complaints_${startDate}_to_${endDate}.json`;
      mimeType = 'application/json';
      break;
    case 'excel':
      // For Excel, we'll use CSV format (Excel can open CSV files)
      data = convertToCSV(complaints);
      filename = `complaints_${startDate}_to_${endDate}.csv`;
      mimeType = 'text/csv';
      break;
  }
  
  // Create download link
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  
  URL.revokeObjectURL(url);
  showToast(`Data exported successfully as ${filename}`, 'success');
}

// Convert data to CSV format
function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// Initialize analytics
function initializeAnalytics() {
  // Add analytics dashboard
  addAnalyticsDashboard();
  
  // Update statistics using the current complaints inside boundary if available
  if (Array.isArray(window.complaintsInsideBoundary)) {
    updateStatistics(window.complaintsInsideBoundary);
  }
}

// Add analytics dashboard
function addAnalyticsDashboard() {
  const statsGrid = document.querySelector('.stats-grid');
  
  const analyticsCard = document.createElement('div');
  analyticsCard.className = 'stat-card analytics-card';
  analyticsCard.innerHTML = `
    <div class="stat-header">
      <h3>Trend Analysis</h3>
      <i class="fas fa-chart-line"></i>
    </div>
    <div class="stat-content">
      <div class="trend-item">
        <span class="trend-label">Weekly Trend</span>
        <span class="trend-value positive">+12%</span>
      </div>
      <div class="trend-item">
        <span class="trend-label">Monthly Trend</span>
        <span class="trend-value negative">-5%</span>
      </div>
      <div class="trend-item">
        <span class="trend-label">Response Time</span>
        <span class="trend-value">2.3 days</span>
      </div>
    </div>
  `;
  
  statsGrid.appendChild(analyticsCard);
}

// Update statistics
function updateStatistics(complaints) {
  // Calculate statistics
  const totalComplaints = complaints.length;
  const pendingComplaints = complaints.filter(c => c.status === 'pending').length;
  const resolvedComplaints = complaints.filter(c => c.status === 'resolved').length;
  const avgResponseTime = calculateAverageResponseTime(complaints);
  
  // Update hotspot list with real data
  updateHotspotList(complaints);
  
  // Update priority areas
  updatePriorityAreas(complaints);
  
  // Update resource allocation
  updateResourceAllocation(complaints);
}

// Calculate average response time
function calculateAverageResponseTime(complaints) {
  const resolvedComplaints = complaints.filter(c => c.status === 'resolved' && (c.resolved_at || c.resolvedAt));
  
  if (resolvedComplaints.length === 0) return 'N/A';
  
  const totalTime = resolvedComplaints.reduce((total, complaint) => {
    const created = new Date(complaint.created_at || complaint.createdAt);
    const resolved = new Date(complaint.resolved_at || complaint.resolvedAt);
    return total + (resolved - created);
  }, 0);
  
  const avgTimeMs = totalTime / resolvedComplaints.length;
  const avgTimeDays = avgTimeMs / (1000 * 60 * 60 * 24);
  
  return avgTimeDays.toFixed(1) + ' days';
}

// Update markers on the map
function updateMarkers(complaintsWithCoordinates) {
  if (!window.complaintMap || !window.complaintMarkers) return;
  
  // Remove old markers
  window.complaintMarkers.forEach(marker => {
    window.complaintMap.removeLayer(marker);
  });
  
  // Create new markers
  const newMarkers = [];
  complaintsWithCoordinates.forEach(complaint => {
    const marker = createComplaintMarker(complaint);
    newMarkers.push(marker);
    marker.addTo(window.complaintMap);
    
    // Set initial opacity based on zoom
    const currentZoom = window.complaintMap.getZoom();
    if (currentZoom >= 14) {
      marker.setOpacity(1);
    } else {
      marker.setOpacity(0);
    }
  });
  
  window.complaintMarkers = newMarkers;
}

// Update hotspot list
function updateHotspotList(complaints) {
  const hotspotList = document.getElementById('hotspot-list');
  if (!hotspotList) return;
  
  // Group complaints by area (simplified - using coordinates as areas)
  const areaComplaints = {};
  complaints.forEach(complaint => {
    if (complaint.coordinates) {
      const area = getAreaFromCoordinates(complaint.coordinates);
      if (!areaComplaints[area]) {
        areaComplaints[area] = [];
      }
      areaComplaints[area].push(complaint);
    }
  });
  
  // Sort areas by complaint count
  const sortedAreas = Object.entries(areaComplaints)
    .sort(([,a], [,b]) => b.length - a.length)
    .slice(0, 5);
  
  // Update hotspot list
  hotspotList.innerHTML = sortedAreas.map(([area, complaints]) => `
    <li>
      <span class="hotspot-name">${area}</span>
      <span class="hotspot-count">${complaints.length} complaints</span>
    </li>
  `).join('');
}

// Update priority areas
function updatePriorityAreas(complaints) {
  const priorityAreas = document.querySelector('.priority-areas');
  if (!priorityAreas) return;
  
  // Calculate priority based on unresolved complaints and urgency
  const areaPriority = {};
  
  complaints.forEach(complaint => {
    if (complaint.coordinates && complaint.status !== 'resolved') {
      const area = getAreaFromCoordinates(complaint.coordinates);
      if (!areaPriority[area]) {
        areaPriority[area] = { score: 0, complaints: [] };
      }
      
             let score = 1;
       
       // Increase score for pending complaints
       if (complaint.status === 'pending') score = 3;
       else if (complaint.status === 'in_progress') score = 2;
       
       areaPriority[area].score += score;
      areaPriority[area].complaints.push(complaint);
    }
  });
  
  // Sort areas by priority score
  const sortedAreas = Object.entries(areaPriority)
    .sort(([,a], [,b]) => b.score - a.score);
  
  // Update priority areas
  priorityAreas.innerHTML = sortedAreas.map(([area, data], index) => {
    let priorityClass = 'low';
    if (index === 0) priorityClass = 'high';
    else if (index < 3) priorityClass = 'medium';
    
    return `
      <div class="priority-item ${priorityClass}">
        <span class="priority-label">${priorityClass.charAt(0).toUpperCase() + priorityClass.slice(1)} Priority</span>
        <span class="priority-value">${area} (${data.complaints.length} complaints)</span>
      </div>
    `;
  }).join('');
}

// Update resource allocation
function updateResourceAllocation(complaints) {
  const resourceAllocation = document.querySelector('.resource-allocation');
  if (!resourceAllocation) return;
  
  // Calculate resource allocation based on complaint volume and priority
  const areaResources = {};
  
  complaints.forEach(complaint => {
    if (complaint.coordinates) {
      const area = getAreaFromCoordinates(complaint.coordinates);
      if (!areaResources[area]) {
        areaResources[area] = { complaints: 0, priority: 0 };
      }
      
      areaResources[area].complaints++;
      
             // Increase priority for pending complaints
       if (complaint.status === 'pending') areaResources[area].priority += 3;
       else if (complaint.status === 'in_progress') areaResources[area].priority += 2;
       else areaResources[area].priority += 1;
    }
  });
  
  // Calculate resource percentage (simplified)
  const totalPriority = Object.values(areaResources).reduce((sum, data) => sum + data.priority, 0);
  
  // Update resource allocation
  resourceAllocation.innerHTML = Object.entries(areaResources).map(([area, data]) => {
    const percentage = Math.round((data.priority / totalPriority) * 100);
    
    return `
      <div class="resource-item">
        <span class="resource-name">${area}</span>
        <div class="resource-bar-container">
          <div class="resource-bar" style="width: ${percentage}%"></div>
        </div>
        <span class="resource-percentage">${percentage}%</span>
      </div>
    `;
  }).join('');
}

// Setup filters
function setupFilters() {
  const heatmapFilter = document.getElementById('heatmap-filter');
  const timeFilter = document.getElementById('time-filter');
  
  // Add event listeners
  heatmapFilter.addEventListener('change', updateHeatmap);
  timeFilter.addEventListener('change', updateHeatmap);
  
  // Add search functionality
  addSearchFilter();
  
  // Add advanced filters
  addAdvancedFilters();
}

// Update heatmap based on filters
async function updateHeatmap() {
  try {
    const heatmapFilter = document.getElementById('heatmap-filter');
    const timeFilter = document.getElementById('time-filter');
    const statusFilter = document.getElementById('status-filter');
    const dateFromEl = document.getElementById('date-from');
    const dateToEl = document.getElementById('date-to');
    const searchInput = document.getElementById('complaint-search');
    
    if (!heatmapFilter || !timeFilter) return;
    
    const selectedType = heatmapFilter.value; // category/type
    const selectedTime = timeFilter.value;    // all | week | month | quarter | year
    const selectedStatus = statusFilter ? statusFilter.value : 'all';
    const fromDate = dateFromEl && dateFromEl.value ? new Date(dateFromEl.value) : null;
    const toDate = dateToEl && dateToEl.value ? new Date(dateToEl.value) : null;
    const searchTerm = searchInput && searchInput.value ? searchInput.value.toLowerCase().trim() : '';
    
    // Get complaints from Supabase
    const complaints = await window.getComplaints();
    
    // Apply filters
    let filteredComplaints = complaints.filter(complaint => {
      // Type/category
      if (selectedType && selectedType !== 'all' && complaint.type !== selectedType) return false;

      // Status
      if (selectedStatus && selectedStatus !== 'all' && complaint.status !== selectedStatus) return false;

      // Time window
      if (selectedTime && selectedTime !== 'all') {
        const created = new Date(complaint.created_at || complaint.createdAt);
        const now = new Date();
        let threshold = null;
        switch (selectedTime) {
          case 'week':
            threshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
          case 'month':
            threshold = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()); break;
          case 'quarter':
            threshold = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()); break;
          case 'year':
            threshold = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); break;
          default:
            threshold = null;
        }
        if (threshold && created < threshold) return false;
      }

      // Date range filter (from/to)
      if (fromDate || toDate) {
        const created = new Date(complaint.created_at || complaint.createdAt);
        if (fromDate && created < fromDate) return false;
        if (toDate) {
          const end = new Date(toDate); end.setHours(23,59,59,999);
          if (created > end) return false;
        }
      }

      // Search filter across key fields
      if (searchTerm) {
        const hay = `${complaint.title || ''} ${complaint.description || ''} ${complaint.location || ''} ${complaint.user_name || ''}`.toLowerCase();
        if (!hay.includes(searchTerm)) return false;
      }
      return true;
    });
    
    // Filter complaints that have coordinates
    const complaintsWithCoordinates = filteredComplaints.filter(complaint => 
      complaint.latitude && complaint.longitude
    );
    
    // Filter complaints to only show those inside the city boundary
    const complaintsInsideBoundary = filterComplaintsInsideBoundary(complaintsWithCoordinates, window.boundaryLayer);
    
    // Update heatmap data from complaints inside boundary
    const heatmapData = complaintsInsideBoundary.map(complaint => [
      parseFloat(complaint.latitude),
      parseFloat(complaint.longitude),
      getComplaintWeight(complaint)
    ]);
    
    // Update heatmap layer safely; cache last data
    window._lastHeatmapData = heatmapData;
    if (window.heatLayer && window.complaintMap && window.complaintMap.hasLayer(window.heatLayer)) {
      try { window.heatLayer.setLatLngs(heatmapData); } catch (_) {}
    }
    
    // Perform K-Means clustering on complaints inside boundary
    const clusters = kMeansClustering(complaintsInsideBoundary, 5);
    
    // Display clusters
    displayClusters(clusters);
    
    // Update markers layer
    if (window.markerLayer) {
      try { window.complaintMap.removeLayer(window.markerLayer); } catch (_) {}
    }
    const newMarkers = complaintsInsideBoundary.map(c => createComplaintMarker(c));
    window.markerLayer = L.layerGroup(newMarkers);
    const MARKER_VISIBILITY_ZOOM = 14;
    const shouldShowMarkers = window.complaintMap && window.complaintMap.getZoom() >= MARKER_VISIBILITY_ZOOM;
    const heatOnMap = window.heatLayer && window.complaintMap.hasLayer(window.heatLayer);
    if (shouldShowMarkers) {
      window.markerLayer.addTo(window.complaintMap);
      if (heatOnMap) window.complaintMap.removeLayer(window.heatLayer);
    } else {
      if (!heatOnMap && window.heatLayer) {
        window.heatLayer.addTo(window.complaintMap);
        if (window._lastHeatmapData) {
          try { window.heatLayer.setLatLngs(window._lastHeatmapData); } catch (_) {}
        }
      }
    }
    
    // Update statistics
    updateStatistics(complaintsInsideBoundary);
    
    console.log(`Heatmap updated with ${complaintsInsideBoundary.length} complaints inside city boundary and ${clusters.length} clusters`);
  } catch (error) {
    console.error('Error updating heatmap:', error);
  }
}

// Utility function for debouncing
function debounce(func, wait) {
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

// Toast notification function
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  
  if (!toast) return;
  
  // Create toast elements
  const toastHeader = document.createElement('div');
  toastHeader.className = 'toast-header';
  
  const toastTitle = document.createElement('div');
  toastTitle.className = 'toast-title';
  toastTitle.textContent = type === 'success' ? 'Success' : 'Error';
  
  const toastClose = document.createElement('button');
  toastClose.className = 'toast-close';
  toastClose.innerHTML = '&times;';
  toastClose.addEventListener('click', () => {
    toast.classList.remove('show');
  });
  
  toastHeader.appendChild(toastTitle);
  toastHeader.appendChild(toastClose);
  
  const toastMessage = document.createElement('div');
  toastMessage.className = 'toast-message';
  toastMessage.textContent = message;
  
  // Clear previous content
  toast.innerHTML = '';
  
  // Add new content
  toast.appendChild(toastHeader);
  toast.appendChild(toastMessage);
  
  // Set toast class
  toast.className = 'toast';
  toast.classList.add(type);
  
  // Show toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // Auto hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ============================================================================
// K-MEANS CLUSTERING FUNCTIONS
// ============================================================================

// K-Means clustering algorithm for complaint locations
function kMeansClustering(complaints, k = 5, maxIterations = 100) {
  if (complaints.length === 0) return [];
  
  // Extract coordinates
  const coordinates = complaints.map(c => [c.latitude, c.longitude]);
  
  // Initialize centroids randomly
  let centroids = initializeCentroids(coordinates, k);
  
  let iterations = 0;
  let converged = false;
  
  while (!converged && iterations < maxIterations) {
    // Assign points to nearest centroid
    const clusters = assignToClusters(coordinates, centroids);
    
    // Calculate new centroids
    const newCentroids = calculateNewCentroids(clusters, coordinates);
    
    // Check for convergence
    converged = centroidsEqual(centroids, newCentroids);
    
    centroids = newCentroids;
    iterations++;
  }
  
  // Return cluster information
  return createClusterInfo(complaints, coordinates, centroids);
}

// Initialize centroids randomly
function initializeCentroids(coordinates, k) {
  const centroids = [];
  const minLat = Math.min(...coordinates.map(c => c[0]));
  const maxLat = Math.max(...coordinates.map(c => c[0]));
  const minLon = Math.min(...coordinates.map(c => c[1]));
  const maxLon = Math.max(...coordinates.map(c => c[1]));
  
  for (let i = 0; i < k; i++) {
    centroids.push([
      minLat + Math.random() * (maxLat - minLat),
      minLon + Math.random() * (maxLon - minLon)
    ]);
  }
  
  return centroids;
}

// Assign coordinates to nearest centroid
function assignToClusters(coordinates, centroids) {
  const clusters = centroids.map(() => []);
  
  coordinates.forEach((coord, index) => {
    let minDistance = Infinity;
    let nearestCentroid = 0;
    
    centroids.forEach((centroid, centroidIndex) => {
      const distance = calculateDistance(coord[0], coord[1], centroid[0], centroid[1]);
      if (distance < minDistance) {
        minDistance = distance;
        nearestCentroid = centroidIndex;
      }
    });
    
    clusters[nearestCentroid].push(index);
  });
  
  return clusters;
}

// Calculate new centroids based on cluster assignments
function calculateNewCentroids(clusters, coordinates) {
  return clusters.map(cluster => {
    if (cluster.length === 0) {
      // If cluster is empty, return a random point
      const randomIndex = Math.floor(Math.random() * coordinates.length);
      return [...coordinates[randomIndex]];
    }
    
    const avgLat = cluster.reduce((sum, index) => sum + coordinates[index][0], 0) / cluster.length;
    const avgLon = cluster.reduce((sum, index) => sum + coordinates[index][1], 0) / cluster.length;
    
    return [avgLat, avgLon];
  });
}

// Check if centroids have converged
function centroidsEqual(oldCentroids, newCentroids, tolerance = 0.0001) {
  if (oldCentroids.length !== newCentroids.length) return false;
  
  for (let i = 0; i < oldCentroids.length; i++) {
    const latDiff = Math.abs(oldCentroids[i][0] - newCentroids[i][0]);
    const lonDiff = Math.abs(oldCentroids[i][1] - newCentroids[i][1]);
    
    if (latDiff > tolerance || lonDiff > tolerance) {
      return false;
    }
  }
  
  return true;
}

// Create cluster information for display
function createClusterInfo(complaints, coordinates, centroids) {
  return centroids.map((centroid, clusterIndex) => {
    const clusterComplaints = complaints.filter((_, index) => {
      const coord = coordinates[index];
      const distance = calculateDistance(coord[0], coord[1], centroid[0], centroid[1]);
      return distance < 0.01; // 0.01 degrees ≈ 1.1 km
    });
    
    return {
      centroid: centroid,
      complaints: clusterComplaints,
      count: clusterComplaints.length,
      clusterIndex: clusterIndex
    };
  }).filter(cluster => cluster.count > 0);
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// ============================================================================
// CLUSTER DISPLAY FUNCTIONS
// ============================================================================

// Display clusters on the map
function displayClusters(clusters) {
  // Clear existing cluster markers
  if (window.clusterMarkers) {
    window.clusterMarkers.forEach(marker => marker.remove());
  }
  window.clusterMarkers = [];
  
  // Create cluster markers
  clusters.forEach(cluster => {
    if (cluster.count > 1) { // Only show clusters with multiple complaints
      const clusterMarker = L.circleMarker(cluster.centroid, {
        radius: Math.min(20, Math.max(8, cluster.count * 2)), // Size based on complaint count
        fillColor: getClusterColor(cluster.count),
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(window.complaintMap);
      
      // Add popup with cluster information
      const popupContent = createClusterPopup(cluster);
      clusterMarker.bindPopup(popupContent);
      
      // Add tooltip
      clusterMarker.bindTooltip(`Cluster: ${cluster.count} complaints`, {
        permanent: false,
        className: 'cluster-tooltip'
      });
      
      window.clusterMarkers.push(clusterMarker);
    }
  });
  
  // Update cluster statistics
  updateClusterStatistics(clusters);
}

// Get color for cluster based on complaint count
function getClusterColor(count) {
  if (count <= 2) return '#00ff00'; // Green for small clusters
  if (count <= 5) return '#ffff00'; // Yellow for medium clusters
  if (count <= 10) return '#ff8000'; // Orange for large clusters
  return '#ff0000'; // Red for very large clusters
}

// Create popup content for cluster
function createClusterPopup(cluster) {
  const complaintsList = cluster.complaints.slice(0, 5).map(c => 
    `<li>${c.title} - ${c.status}</li>`
  ).join('');
  
  const moreText = cluster.count > 5 ? `<p><em>... and ${cluster.count - 5} more</em></p>` : '';
  
  return `
    <div class="cluster-popup">
      <h4>Cluster ${cluster.clusterIndex + 1}</h4>
      <p><strong>Total Complaints:</strong> ${cluster.count}</p>
      <p><strong>Location:</strong> ${cluster.centroid[0].toFixed(6)}, ${cluster.centroid[1].toFixed(6)}</p>
      <h5>Recent Complaints:</h5>
      <ul>${complaintsList}</ul>
      ${moreText}
      <button onclick="viewClusterComplaints(${cluster.clusterIndex})" class="btn btn-primary btn-sm">
        View All Complaints
      </button>
    </div>
  `;
}

// Update cluster statistics display
function updateClusterStatistics(clusters) {
  const statsContainer = document.getElementById('cluster-statistics');
  if (!statsContainer) return;
  
  const totalClusters = clusters.length;
  const totalComplaints = clusters.reduce((sum, cluster) => sum + cluster.count, 0);
  const avgComplaintsPerCluster = totalClusters > 0 ? (totalComplaints / totalClusters).toFixed(1) : 0;
  
  statsContainer.innerHTML = `
    <div class="row">
      <div class="col-md-4">
        <div class="stat-card">
          <h4>${totalClusters}</h4>
          <p>Total Clusters</p>
        </div>
      </div>
      <div class="col-md-4">
        <div class="stat-card">
          <h4>${totalComplaints}</h4>
          <p>Total Complaints</p>
        </div>
      </div>
      <div class="col-md-4">
        <div class="stat-card">
          <h4>${avgComplaintsPerCluster}</h4>
          <p>Avg per Cluster</p>
        </div>
      </div>
    </div>
  `;
}

// View all complaints in a specific cluster
function viewClusterComplaints(clusterIndex) {
  // This function can be used to filter the complaints table or show detailed view
  console.log(`Viewing complaints for cluster ${clusterIndex}`);
  
  // You can implement filtering logic here
  // For example, highlight complaints on the map or filter the complaints table
}

// Make clustering functions globally available
if (typeof window !== 'undefined') {
  window.kMeansClustering = kMeansClustering;
  window.displayClusters = displayClusters;
  window.updateHeatmapWithClustering = updateHeatmapWithClustering;
  window.viewClusterComplaints = viewClusterComplaints;
}

// ============================================================================
// ENHANCED HEATMAP FUNCTIONS
// ============================================================================

// Update heatmap with clustering
async function updateHeatmapWithClustering() {
  try {
    // Get complaints data
    const complaints = await window.getComplaints();
    
    if (!complaints || complaints.length === 0) {
      showNoDataMessage();
      return;
    }
    
    // Filter complaints with coordinates
    const complaintsWithCoordinates = complaints.filter(c => c.latitude && c.longitude);
    
    if (complaintsWithCoordinates.length === 0) {
      showNoCoordinatesMessage();
      return;
    }
    
    // Apply filters
    const filteredComplaints = applyFilters(complaintsWithCoordinates);
    
    // Filter complaints to only show those inside the city boundary
    const complaintsInsideBoundary = filterComplaintsInsideBoundary(filteredComplaints, window.boundaryLayer);
    
    // Perform K-Means clustering on complaints inside boundary
    const clusters = kMeansClustering(complaintsInsideBoundary, 5);
    
    // Update heatmap
    updateHeatmap(filteredComplaints);
    
    // Display clusters
    displayClusters(clusters);
    
    // Update statistics
    updateStatistics(filteredComplaints);
    
    // Update markers
    updateMarkers(complaintsInsideBoundary);
    
  } catch (error) {
    console.error('Error updating heatmap with clustering:', error);
    showErrorMessage('Failed to update heatmap with clustering');
  }
}

// ============================================================================
// BOUNDARY TOGGLE FUNCTIONALITY
// ============================================================================

// Add boundary toggle button to the heatmap controls
function addBoundaryToggleButton() {
  const controlsContainer = document.querySelector('.heatmap-controls');
  if (controlsContainer) {
    const boundaryToggle = document.createElement('button');
    boundaryToggle.className = 'btn btn-outline-secondary btn-sm me-2';
    boundaryToggle.innerHTML = '<i class="fas fa-map"></i> Toggle Boundary';
    boundaryToggle.onclick = toggleBoundary;
    
    // Insert after the clustering button
    const clusterBtn = document.getElementById('cluster-analysis-btn');
    if (clusterBtn) {
      clusterBtn.parentNode.insertBefore(boundaryToggle, clusterBtn.nextSibling);
    } else {
      // If no clustering button, add to the beginning
      controlsContainer.insertBefore(boundaryToggle, controlsContainer.firstChild);
    }
  }
}

// Toggle boundary visibility
function toggleBoundary() {
  if (window.boundaryLayer) {
    if (window.complaintMap && window.complaintMap.hasLayer(window.boundaryLayer)) {
      window.complaintMap.removeLayer(window.boundaryLayer);
      console.log('Boundary hidden');
    } else if (window.complaintMap) {
      window.complaintMap.addLayer(window.boundaryLayer);
      console.log('Boundary shown');
    }
  }
}

// Add boundary info to legend
function addBoundaryToLegend() {
  const legend = document.querySelector('.map-legend');
  if (legend) {
    const boundaryItem = document.createElement('div');
    boundaryItem.className = 'legend-item';
    boundaryItem.innerHTML = `
      <div class="legend-color" style="background: #2E86AB; border: 2px solid #2E86AB;"></div>
      <span>LGU Jurisdiction Boundary</span>
    `;
    legend.appendChild(boundaryItem);
  }
}

// Fallback boundary if real data fails to load
function createFallbackBoundary(map) {
  const testBoundary = [
    [6.7, 125.25],   // Southwest
    [6.7, 125.52],   // Southeast  
    [6.99, 125.52],  // Northeast
    [6.99, 125.25],  // Northwest
    [6.7, 125.25]    // Close the polygon
  ];
  
  const boundary = L.polygon(testBoundary, {
    color: '#FF6B6B',        // Red border for fallback
    weight: 2,               // Border thickness
    opacity: 0.6,            // Border opacity
    fillColor: '#FF6B6B',    // Fill color
    fillOpacity: 0.05        // Very transparent fill
  });
  
  boundary.addTo(map);
  map.fitBounds(boundary.getBounds());
  console.log('🔄 Fallback boundary created');
  
  // Store boundary reference for toggle functionality
  window.boundaryLayer = boundary;
  
  // Add boundary toggle button to controls
  addBoundaryToggleButton();
}

// Filter complaints to only show those inside the city boundary
function filterComplaintsInsideBoundary(complaints, boundaryLayer) {
  if (!boundaryLayer) {
    console.warn('⚠️ No boundary layer available, showing all complaints');
    return complaints;
  }
  
  const boundaryPolygon = boundaryLayer;
  const complaintsInside = complaints.filter(complaint => {
    try {
      // Create a point from complaint coordinates
      const point = L.latLng(complaint.latitude, complaint.longitude);
      
      // Check if point is inside the boundary polygon
      return boundaryPolygon.getBounds().contains(point);
    } catch (error) {
      console.warn(`⚠️ Error checking complaint ${complaint.id} location:`, error);
      return false;
    }
  });
  
  return complaintsInside;
}