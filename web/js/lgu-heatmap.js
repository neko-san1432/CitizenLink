document.addEventListener('DOMContentLoaded', () => {
  // Get user and complaints
  const user = checkAuth();
  if (!user) return;
  
  // Initialize map
  initializeMap();
  
  // Setup filters
  setupFilters();
  
  // Setup real-time updates
  setupRealTimeUpdates();
  
  // Setup export functionality
  setupExportFeatures();
  
  // Initialize analytics
  initializeAnalytics();
});

// Mock functions for demonstration purposes
function checkAuth() {
  // Replace with actual authentication check logic
  return { username: 'admin-user', type: 'lgu' };
}

// Initialize map
function initializeMap() {
  // Create map centered on Digos City, Philippines (based on the image coordinates)
  const map = L.map('complaint-map').setView([6.75, 125.35], 12);
  
  // Add OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  
  // Add red dashed boundary (similar to the image)
  const boundaryCoordinates = [
    [6.78, 125.32], // Top-left (KAPATAGAN area)
    [6.78, 125.38], // Top-right (coastal area)
    [6.72, 125.38], // Bottom-right (Digos area)
    [6.70, 125.35], // Bottom-center (MATTI/TRES DE MAYO area)
    [6.72, 125.32], // Bottom-left
    [6.78, 125.32]  // Back to start
  ];
  
  const boundary = L.polygon(boundaryCoordinates, {
    color: 'red',
    weight: 2,
    fillColor: 'transparent',
    fillOpacity: 0,
    dashArray: '10, 5'
  }).addTo(map);
  
  // Add boundary label
  L.marker([6.74, 125.35]).addTo(map)
    .bindTooltip('LGU Jurisdiction Boundary', { permanent: true, className: 'boundary-label' });
  
  // Get complaints data
  const complaints = getComplaints();
  
  // Filter complaints that have coordinates
  const complaintsWithCoordinates = complaints.filter(complaint => complaint.coordinates);
  
  // Create heatmap data from complaints
  const heatmapData = complaintsWithCoordinates.map(complaint => [
    complaint.coordinates[0],
    complaint.coordinates[1],
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
  
  // Add markers for each complaint (initially hidden, shown on zoom)
  const complaintMarkers = [];
  
  complaintsWithCoordinates.forEach(complaint => {
    const marker = createComplaintMarker(complaint);
    complaintMarkers.push(marker);
    
    // Initially hide markers
    marker.addTo(map);
    marker.setOpacity(0);
  });
  
  // Show/hide individual markers based on zoom level
  map.on('zoomend', () => {
    const currentZoom = map.getZoom();
    const shouldShowMarkers = currentZoom >= 14; // Show markers when zoomed in
    
    complaintMarkers.forEach(marker => {
      if (shouldShowMarkers) {
        marker.setOpacity(1);
      } else {
        marker.setOpacity(0);
      }
    });
  });
  
  // Store map reference globally for filter updates
  window.complaintMap = map;
  window.complaintMarkers = complaintMarkers;
  window.heatLayer = heat;
  
  // Add map controls
  addMapControls(map);
}

// Add map controls for better user experience
function addMapControls(map) {
  // Add fullscreen control
  const fullscreenControl = L.control.fullscreen({
    position: 'topright',
    title: 'Toggle Fullscreen',
    titleCancel: 'Exit Fullscreen',
    content: '<i class="fas fa-expand"></i>'
  });
  fullscreenControl.addTo(map);
  
  // Add measure control
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
  
  // Add layer control
  const baseMaps = {
    "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
    "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'),
    "Terrain": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png')
  };
  
  const overlayMaps = {
    "Complaints": window.complaintMarkers || [],
    "Heatmap": window.heatLayer || []
  };
  
  L.control.layers(baseMaps, overlayMaps, { position: 'topright' }).addTo(map);
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
  
  const marker = L.circleMarker(complaint.coordinates, {
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
        <h4>${complaint.title}</h4>
        <span class="status-badge ${complaint.status}">${complaint.status.replace('_', ' ')}</span>
      </div>
      <div class="tooltip-content">
        <p><strong>Type:</strong> ${complaint.type}</p>
        <p><strong>Subcategory:</strong> ${complaint.subcategory}</p>
        <p><strong>Location:</strong> ${complaint.location}</p>
        <p><strong>Urgency:</strong> ${complaint.urgency}</p>
        <p><strong>Submitted:</strong> ${formatDate(complaint.createdAt)}</p>
        ${complaint.assignedUnit ? `<p><strong>Assigned to:</strong> ${governmentUnitNames[complaint.assignedUnit]}</p>` : ''}
      </div>
      <div class="tooltip-actions">
        <a href="/admin-complaints?id=${complaint.id}" class="view-details-btn">View Details</a>
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
      <h3>${complaint.title}</h3>
      <p><strong>ID:</strong> ${complaint.id}</p>
      <p><strong>Location:</strong> ${complaint.location}</p>
      <p><strong>Type:</strong> ${complaint.type}</p>
      <p><strong>Subcategory:</strong> ${complaint.subcategory}</p>
      <p><strong>Status:</strong> ${complaint.status}</p>
      <p><strong>Urgency:</strong> ${complaint.urgency}</p>
      <p><strong>Description:</strong> ${complaint.description}</p>
      <a href="/admin-complaints?id=${complaint.id}" class="popup-link">View Full Details</a>
    </div>
  `);
  
  return marker;
}

// Calculate complaint weight for heatmap intensity
function getComplaintWeight(complaint) {
  let weight = 1;
  
  // Increase weight based on urgency
  switch (complaint.urgency) {
    case 'emergency':
      weight = 5;
      break;
    case 'high':
      weight = 3;
      break;
    case 'medium':
      weight = 2;
      break;
    case 'low':
      weight = 1;
      break;
  }
  
  // Increase weight for unresolved complaints
  if (complaint.status === 'pending') {
    weight *= 1.5;
  }
  
  return weight;
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
  
  // Urgency filter
  const urgencyFilter = document.createElement('select');
  urgencyFilter.id = 'urgency-filter';
  urgencyFilter.className = 'filter-select';
  urgencyFilter.innerHTML = `
    <option value="all">All Urgency Levels</option>
    <option value="emergency">Emergency</option>
    <option value="high">High</option>
    <option value="medium">Medium</option>
    <option value="low">Low</option>
  `;
  
  // Date range filter
  const dateRangeFilter = document.createElement('input');
  dateRangeFilter.type = 'date';
  dateRangeFilter.id = 'date-filter';
  dateRangeFilter.className = 'filter-select';
  
  advancedFiltersContainer.appendChild(statusFilter);
  advancedFiltersContainer.appendChild(urgencyFilter);
  advancedFiltersContainer.appendChild(dateRangeFilter);
  filterButtons.appendChild(advancedFiltersContainer);
  
  // Add event listeners
  statusFilter.addEventListener('change', updateHeatmap);
  urgencyFilter.addEventListener('change', updateHeatmap);
  dateRangeFilter.addEventListener('change', updateHeatmap);
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
  
  // Update statistics in real-time
  updateStatistics();
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
function updateStatistics() {
  const complaints = getComplaints();
  
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
  const resolvedComplaints = complaints.filter(c => c.status === 'resolved' && c.resolvedAt);
  
  if (resolvedComplaints.length === 0) return 'N/A';
  
  const totalTime = resolvedComplaints.reduce((total, complaint) => {
    const created = new Date(complaint.createdAt);
    const resolved = new Date(complaint.resolvedAt);
    return total + (resolved - created);
  }, 0);
  
  const avgTimeMs = totalTime / resolvedComplaints.length;
  const avgTimeDays = avgTimeMs / (1000 * 60 * 60 * 24);
  
  return avgTimeDays.toFixed(1) + ' days';
}

// Update hotspot list with real data
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

// Get area name from coordinates (simplified)
function getAreaFromCoordinates(coordinates) {
  const [lat, lng] = coordinates;
  
  // Simple area mapping based on coordinates
  if (lat > 6.76 && lng > 125.36) return 'Downtown Area';
  if (lat > 6.76 && lng <= 125.36) return 'North District';
  if (lat <= 6.76 && lng > 125.36) return 'West Commercial Zone';
  if (lat <= 6.76 && lng <= 125.36) return 'East Residential Area';
  return 'South Industrial Park';
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
      if (complaint.urgency === 'emergency') score = 5;
      else if (complaint.urgency === 'high') score = 3;
      else if (complaint.urgency === 'medium') score = 2;
      
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
      
      if (complaint.urgency === 'emergency') areaResources[area].priority += 5;
      else if (complaint.urgency === 'high') areaResources[area].priority += 3;
      else if (complaint.urgency === 'medium') areaResources[area].priority += 2;
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
function updateHeatmap() {
  const heatmapFilter = document.getElementById('heatmap-filter').value;
  const timeFilter = document.getElementById('time-filter').value;
  const statusFilter = document.getElementById('status-filter')?.value || 'all';
  const urgencyFilter = document.getElementById('urgency-filter')?.value || 'all';
  const dateFilter = document.getElementById('date-filter')?.value || '';
  const searchQuery = document.getElementById('complaint-search')?.value || '';
  
  // Get filtered complaints
  let filteredComplaints = getComplaints();
  
  // Apply type filter
  if (heatmapFilter !== 'all') {
    filteredComplaints = filteredComplaints.filter(complaint => 
      complaint.type === heatmapFilter
    );
  }
  
  // Apply status filter
  if (statusFilter !== 'all') {
    filteredComplaints = filteredComplaints.filter(complaint => 
      complaint.status === statusFilter
    );
  }
  
  // Apply urgency filter
  if (urgencyFilter !== 'all') {
    filteredComplaints = filteredComplaints.filter(complaint => 
      complaint.urgency === urgencyFilter
    );
  }
  
  // Apply date filter
  if (dateFilter) {
    const filterDate = new Date(dateFilter);
    filteredComplaints = filteredComplaints.filter(complaint => 
      new Date(complaint.createdAt).toDateString() === filterDate.toDateString()
    );
  }
  
  // Apply time filter
  if (timeFilter !== 'all') {
    const now = new Date();
    const filterDate = new Date();
    
    switch (timeFilter) {
      case 'week':
        filterDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        filterDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        filterDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        filterDate.setFullYear(now.getFullYear() - 1);
        break;
    }
    
    filteredComplaints = filteredComplaints.filter(complaint => 
      new Date(complaint.createdAt) >= filterDate
    );
  }
  
  // Apply search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filteredComplaints = filteredComplaints.filter(complaint => 
      complaint.title.toLowerCase().includes(query) ||
      complaint.description.toLowerCase().includes(query) ||
      complaint.location.toLowerCase().includes(query) ||
      complaint.type.toLowerCase().includes(query)
    );
  }
  
  // Filter complaints with coordinates
  const filteredComplaintsWithCoordinates = filteredComplaints.filter(complaint => complaint.coordinates);
  
  // Update heatmap data
  const newHeatmapData = filteredComplaintsWithCoordinates.map(complaint => [
    complaint.coordinates[0],
    complaint.coordinates[1],
    getComplaintWeight(complaint)
  ]);
  
  // Update heatmap layer
  if (window.heatLayer) {
    window.heatLayer.setLatLngs(newHeatmapData);
  }
  
  // Update markers
  if (window.complaintMarkers) {
    // Remove old markers
    window.complaintMarkers.forEach(marker => {
      window.complaintMap.removeLayer(marker);
    });
    
    // Create new markers
    const newMarkers = [];
    filteredComplaintsWithCoordinates.forEach(complaint => {
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
  
  // Update statistics
  updateStatistics();
  
  showToast(`Heatmap updated: ${filteredComplaintsWithCoordinates.length} complaints shown`, 'success');
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