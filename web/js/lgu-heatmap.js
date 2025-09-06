document.addEventListener('DOMContentLoaded', async () => {
  // Get user and complaints
  const user = await checkAuth();
  if (!user) return;
  
  // Store user globally for access in marker creation
  window.currentUser = user;
  
  // Initialize map
  await initializeMap();
  
  // Setup filters
  setupFilters();
  
  // Setup real-time updates
  setupRealTimeUpdates();
  
  // Setup export functionality
  setupExportFeatures();
  
  // Setup button event listeners
  setupButtonEventListeners();
  
  // Initialize analytics
  initializeAnalytics();
  
  // Wire UI controls for panels and fullscreen
  initializeLayoutControls();
  
  // Run initial clustering as part of map initialization/update flow
  try { updateHeatmap(); } catch (_) {}
});

function initializeLayoutControls() {
  const leftPanel = document.getElementById('left-panel');
  const insightsPanel = document.getElementById('insights-panel');
  const mapCard = document.getElementById('map-card');
  const toggleFilters = document.getElementById('toggle-filters');
  const toggleInsights = document.getElementById('toggle-insights');
  const toggleFullscreen = document.getElementById('toggle-fullscreen');
  const closeLeft = document.getElementById('close-left-panel');
  const closeInsights = document.getElementById('close-insights');

  const invalidateMapSize = () => { 
    try { 
      if (window.complaintMap) {
        window.complaintMap.invalidateSize();
        // Force a resize event to ensure proper sizing
        setTimeout(() => {
          try {
            window.complaintMap.invalidateSize();
          } catch (_) {}
        }, 50);
      }
    } catch (_) {} 
  };

  const setButtonActive = (btn, isActive) => {
    if (!btn) return;
    try {
      btn.classList.toggle('active', !!isActive);
      btn.setAttribute('aria-pressed', !!isActive);
    } catch (_) {}
  };

  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);

  const syncActiveButtons = () => {
    setButtonActive(toggleFilters, !!(leftPanel && leftPanel.classList.contains('open')));
    setButtonActive(toggleInsights, !!(insightsPanel && insightsPanel.classList.contains('open')));
    setButtonActive(toggleFullscreen, isFs());
  };

  if (toggleFilters && leftPanel) {
    toggleFilters.addEventListener('click', (e) => {
      e.preventDefault();
      leftPanel.classList.toggle('open');
      if (insightsPanel) insightsPanel.classList.remove('open');
      setButtonActive(toggleFilters, leftPanel.classList.contains('open'));
      setButtonActive(toggleInsights, false);
      setTimeout(invalidateMapSize, 300);
    });
  }
  if (toggleInsights && insightsPanel) {
    console.log('✅ Insights button and panel found, setting up event listener');
    toggleInsights.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('🔍 Insights button clicked!');
      console.log('🔍 Panel element:', insightsPanel);
      console.log('🔍 Current classes:', insightsPanel.className);
      insightsPanel.classList.toggle('open');
      console.log('🔍 After toggle, classes:', insightsPanel.className);
      console.log('🔍 Panel computed style height:', window.getComputedStyle(insightsPanel).height);
      console.log('🔍 Panel computed style max-height:', window.getComputedStyle(insightsPanel).maxHeight);
      if (leftPanel) leftPanel.classList.remove('open');
      setButtonActive(toggleInsights, insightsPanel.classList.contains('open'));
      setButtonActive(toggleFilters, false);
      setTimeout(invalidateMapSize, 300);
    });
  } else {
    console.log('❌ Missing elements:');
    console.log('❌ toggleInsights:', toggleInsights);
    console.log('❌ insightsPanel:', insightsPanel);
  }
  if (closeLeft && leftPanel) {
    closeLeft.addEventListener('click', () => { leftPanel.classList.remove('open'); setButtonActive(toggleFilters, false); setTimeout(invalidateMapSize, 300); });
  }
  if (closeInsights && insightsPanel) {
    closeInsights.addEventListener('click', () => { insightsPanel.classList.remove('open'); setButtonActive(toggleInsights, false); setTimeout(invalidateMapSize, 300); });
  }
  // Fullscreen helpers using the Fullscreen API
  const enterFullscreen = (element) => {
    try {
      if (element.requestFullscreen) return element.requestFullscreen();
      if (element.webkitRequestFullscreen) return element.webkitRequestFullscreen();
      if (element.msRequestFullscreen) return element.msRequestFullscreen();
    } catch (_) {}
  };
  const exitFullscreen = () => {
    try {
      if (document.exitFullscreen) return document.exitFullscreen();
      if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
      if (document.msExitFullscreen) return document.msExitFullscreen();
    } catch (_) {}
  };

  if (toggleFullscreen && mapCard) {
    toggleFullscreen.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!isFs()) {
        mapCard.classList.add('map-fullscreen');
        await enterFullscreen(mapCard);
      } else {
        await exitFullscreen();
        mapCard.classList.remove('map-fullscreen');
      }
      try {
        const i = toggleFullscreen.querySelector('i');
        if (i) i.className = isFs() ? 'fas fa-compress' : 'fas fa-expand';
      } catch (_) {}
      setButtonActive(toggleFullscreen, isFs());
      setTimeout(invalidateMapSize, 50);
    });

    // Sync UI when user exits via Esc
    document.addEventListener('fullscreenchange', () => {
      try {
        if (!isFs()) mapCard.classList.remove('map-fullscreen');
        const i = toggleFullscreen.querySelector('i');
        if (i) i.className = isFs() ? 'fas fa-compress' : 'fas fa-expand';
      } catch (_) {}
      setButtonActive(toggleFullscreen, isFs());
      setTimeout(invalidateMapSize, 50);
    });
  }

  // Close panels and clear active state when clicking outside
  document.addEventListener('click', (evt) => {
    const fc = document.querySelector('.floating-controls');
    const clickedInsideControls = fc && fc.contains(evt.target);
    const clickedInsidePanels = (leftPanel && leftPanel.contains(evt.target)) || (insightsPanel && insightsPanel.contains(evt.target));
    if (!clickedInsideControls && !clickedInsidePanels) {
      if (leftPanel) leftPanel.classList.remove('open');
      if (insightsPanel) insightsPanel.classList.remove('open');
      setButtonActive(toggleFilters, false);
      setButtonActive(toggleInsights, false);
    }
  });

  // Initialize button states on load
  syncActiveButtons();
}

// Advanced filters are now handled in the main setupFilters function

// Authentication function (delegate to global if available; accept lgu-* roles)
async function checkAuth() {
  try {
    if (window.checkAuth && window.checkAuth !== checkAuth) {
      return await window.checkAuth();
    }
    const stored = sessionStorage.getItem('user');
    if (!stored) return null;
    const user = JSON.parse(stored);
    if (!user || !user.id) return null;
    const role = String(user.role || user.type || '').toLowerCase();
    const isLgu = role === 'lgu' || role === 'admin' || role.startsWith('lgu-') || role.startsWith('lgu_admin') || role.startsWith('lgu-admin');
    if (!isLgu) return null;
    return { username: user.email, role, type: user.type || user.role };
  } catch (error) {
    console.error('Error checking auth:', error);
    return null;
  }
}

// Initialize map
async function initializeMap() {
  try {
    // Ensure map container exists and has dimensions
    const mapContainer = document.getElementById('complaint-map');
    if (!mapContainer) {
      console.error('Map container not found');
      return;
    }
    
    // Check if container has dimensions
    const rect = mapContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn('Map container has no dimensions, waiting...');
      setTimeout(() => initializeMap(), 100);
      return;
    }
    
    // Create map centered on Digos City, Philippines (based on the image coordinates)
    // Move zoom control away from sidebar (to top-right)
    const map = L.map('complaint-map', {
      zoomControl: false,
      preferCanvas: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
      worldCopyJump: false,  // Prevent map from jumping to other world copies
      maxBounds: [[6.5, 125.0], [7.0, 125.7]], // Constrain to Digos City area
      minZoom: 10,
      maxZoom: 18
    }).setView([6.75, 125.35], 12);
    // Expose globally
    window.complaintMap = map;
    
    // Ensure proper map sizing on initialization (multiple passes)
    const safeInvalidate = () => { try { map.invalidateSize(); } catch (_) {} };
    setTimeout(safeInvalidate, 50);
    setTimeout(safeInvalidate, 150);
    setTimeout(safeInvalidate, 300);

    // Observe container size changes to keep Leaflet in sync
    try {
      const containerEl = document.getElementById('complaint-map');
      if (containerEl && window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
          safeInvalidate();
        });
        ro.observe(containerEl);
        // keep reference to prevent GC
        window._heatmapResizeObserver = ro;
      }
    } catch (_) {}

    // Base layers (themes)
    const baseLayers = {
      'Standard': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }),
      'Standard Dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO'
      }),
      'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap'
      }),
      'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri'
      })
    };
    baseLayers['Standard'].addTo(map);

    // Add zoom control to top-left
    L.control.zoom({ position: 'topleft' }).addTo(map);
    // Add status legend to the top-right
    addStatusLegend(map);
    
    // Mount our custom floating controls as a Leaflet control so it stacks with others
    try {
      const controlsEl = document.querySelector('#complaint-map .floating-controls');
      if (controlsEl) {
        const FloatingControls = L.Control.extend({
          options: { position: 'bottomright' },
          onAdd: function() {
            return controlsEl;
          }
        });
        new FloatingControls().addTo(map);
      }
    } catch (_) {}
    
    // Try to load barangay boundaries overlay from optional sources
    try {
      // Ensure an interactive pane for barangays exists (above tiles/markers)
      try {
        if (!map.getPane('brgy-pane')) {
          map.createPane('brgy-pane');
          const bp = map.getPane('brgy-pane');
          bp.style.zIndex = 401; // above overlays(400) so hover is reliable
          bp.style.pointerEvents = 'auto';
        }
      } catch (_) {}
      // A) If a global GeoJSON variable is provided elsewhere
      if (typeof window.json_BarangayClassification_4 !== 'undefined') {
        const defaultBrgyStyle = { pane: 'brgy-pane', color: '#666', weight: 1, opacity: 0.8, fillOpacity: 0, interactive: true };
        const hoverBrgyStyle = { pane: 'brgy-pane', color: '#2563eb', weight: 3, opacity: 1, fillOpacity: 0.08, interactive: true };
        const brgyLayer = L.geoJSON(window.json_BarangayClassification_4, {
          style: defaultBrgyStyle
        }).addTo(map);
        window.brgyLayer = brgyLayer;
        try {
          window._brgyPolygons = window._brgyPolygons || [];
          brgyLayer.eachLayer(layer => {
            try {
              const name = (layer && layer.feature && (layer.feature.properties?.name || layer.feature.properties?.barangay || layer.feature.properties?.Name)) || 'Barangay';
              const latlngs = layer.getLatLngs();
              // Hover functionality disabled
              // try {
              //   layer.bindTooltip(name, { sticky: true, direction: 'center', className: 'brgy-label' });
              //   layer.on('mouseover', () => { try { layer.setStyle(hoverBrgyStyle); layer.bringToFront(); layer.openTooltip(); } catch(_){} });
              //   layer.on('mouseout', () => { try { brgyLayer.resetStyle(layer); layer.closeTooltip(); } catch(_){} });
              // } catch(_) {}
              window._brgyPolygons.push({ name, latlngs });
            } catch (_) {}
          });
        } catch (_) {}
      } else {
        // B) Load from our barangay boundaries JSON (array of { name, geojson })
        try {
          const resp = await fetch('/lgu/brgy_boundaries_locatlon.json');
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data)) {
              const polygons = [];
              const defaultBrgyStyle = { pane: 'brgy-pane', color: '#666', weight: 1, opacity: 0.8, fillOpacity: 0, interactive: true };
              const hoverBrgyStyle = { pane: 'brgy-pane', color: '#2563eb', weight: 3, opacity: 1, fillOpacity: 0.08, interactive: true };
              window._brgyPolygons = window._brgyPolygons || [];
              data.forEach(entry => {
                try {
                  if (!entry || !entry.geojson || !entry.geojson.coordinates) return;
                  const name = entry.name || 'Barangay';
                  const gj = entry.geojson;
                  const style = defaultBrgyStyle;

                  // Coordinates in our files are [lat, lon]; build Leaflet polygons directly
                  if (gj.type === 'Polygon') {
                    const rings = gj.coordinates.map(ring => ring.map(coord => [coord[0], coord[1]]));
                    const poly = L.polygon(rings, style);
                    // Hover functionality disabled
                    // try {
                    //   poly.bindTooltip(name, { sticky: true, direction: 'center', className: 'brgy-label' });
                    //   poly.on('mouseover', () => { try { poly.setStyle(hoverBrgyStyle); poly.bringToFront(); poly.openTooltip(); } catch(_){} });
                    //   poly.on('mouseout', () => { try { poly.setStyle(defaultBrgyStyle); poly.closeTooltip(); } catch(_){} });
                    // } catch(_) {}
                    polygons.push(poly);
                    try { window._brgyPolygons.push({ name, latlngs: poly.getLatLngs() }); } catch (_) {}
                  } else if (gj.type === 'MultiPolygon') {
                    const multi = gj.coordinates.map(polygon => polygon.map(ring => ring.map(coord => [coord[0], coord[1]])));
                    const poly = L.polygon(multi, style);
                    // Hover functionality disabled
                    // try {
                    //   poly.bindTooltip(name, { sticky: true, direction: 'center', className: 'brgy-label' });
                    //   poly.on('mouseover', () => { try { poly.setStyle(hoverBrgyStyle); poly.bringToFront(); poly.openTooltip(); } catch(_){} });
                    //   poly.on('mouseout', () => { try { poly.setStyle(defaultBrgyStyle); poly.closeTooltip(); } catch(_){} });
                    // } catch(_) {}
                    polygons.push(poly);
                    try { window._brgyPolygons.push({ name, latlngs: poly.getLatLngs() }); } catch (_) {}
                  }
                } catch (_) { /* skip problematic entry */ }
              });
              if (polygons.length) {
                const brgyLayer = L.layerGroup(polygons).addTo(map);
                window.brgyLayer = brgyLayer;
              }
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
    
    // Load barangay boundaries and use them to define the municipal area
    try {
      const response = await fetch('/lgu/brgy_boundaries_locatlon.json');
      const data = await response.json();
      
      if (data && Array.isArray(data) && data.length > 0) {
        // Create a combined boundary from all barangay boundaries
        const allCoordinates = [];
        data.forEach(entry => {
          if (entry.geojson && entry.geojson.coordinates) {
            if (entry.geojson.type === 'Polygon') {
              allCoordinates.push(entry.geojson.coordinates[0]);
            } else if (entry.geojson.type === 'MultiPolygon') {
              entry.geojson.coordinates.forEach(polygon => {
                allCoordinates.push(polygon[0]);
              });
            }
          }
        });
        
        if (allCoordinates.length > 0) {
          // Create a combined boundary polygon from all barangay coordinates
          const combinedBoundary = L.polygon(allCoordinates, {
            color: '#2E86AB',        // Blue border
            weight: 3,               // Border thickness
            opacity: 0.8,            // Border opacity
            fillColor: '#2E86AB',    // Fill color
            fillOpacity: 0.1         // Very transparent fill
          });
          
          // Add boundary to map
          combinedBoundary.addTo(map);
          
          // Fit and restrict map to the combined boundary bounds
          const bounds = combinedBoundary.getBounds();
          // Fit as tightly as possible after layout stabilizes
          const applyTightFit = () => {
            try {
              map.invalidateSize();
              map.fitBounds(bounds, { padding: [0, 0], animate: false });
              map.setMaxBounds(bounds.pad(0.02));
              map.options.minZoom = Math.max(map.getZoom(), 12);
            } catch (_) {}
          };
          // Run now and after a tick
          applyTightFit();
          setTimeout(applyTightFit, 50);
          // Also refit on resize
          map.on('resize', applyTightFit);

          // Create a clean mask to hide everything outside the boundary
          // Use a dedicated pane to avoid tile seam artifacts
          try {
            if (!map.getPane('mask-pane')) {
              map.createPane('mask-pane');
              const mp = map.getPane('mask-pane');
              mp.style.zIndex = 399; // above tiles(200), below overlays(400)
              mp.style.pointerEvents = 'none'; // don't block map interactions
            }
            const world = [
              [90, -360], [90, 360],
              [-90, 360], [-90, -360]
            ];
            const maskCoords = [world, ...allCoordinates];
            const mask = L.polygon(maskCoords, {
              pane: 'mask-pane',
              stroke: false,
              fillColor: '#ffffff',
              fillOpacity: 1,
              interactive: false
            });
            mask.addTo(map);
            // Keep boundary on top
            combinedBoundary.bringToFront();
          } catch (_) {}
          
          
          
          // Store boundary reference for toggle functionality
          window.boundaryLayer = combinedBoundary;
          
          // Add boundary toggle button to controls
          addBoundaryToggleButton();
        } else {
          
          createFallbackBoundary(map);
        }
      } else {
        
        createFallbackBoundary(map);
      }
    } catch (error) {
      console.error('❌ Error loading barangay boundary data:', error);
      
      createFallbackBoundary(map);
    }
    
    // Get complaints data from backend API
    const complaints = await fetchComplaints();
    
    // Filter complaints that have coordinates and are inside the city boundary
    const complaintsWithCoordinates = complaints.filter(complaint => 
      complaint.latitude && complaint.longitude
    );
    
    // Filter complaints to only show those inside the city boundary
    const complaintsInsideBoundary = filterComplaintsInsideBoundary(complaintsWithCoordinates, window.boundaryLayer);
    
    
    
    
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
    // Ensure map size is correct after load
    setTimeout(() => { 
      try { 
        map.invalidateSize(); 
        // Additional size validation
        setTimeout(() => {
          try {
            map.invalidateSize();
          } catch(_) {}
        }, 200);
      } catch(_){} 
    }, 100);
    
    // Prepare markers (we will add/remove them as a layer based on zoom level)
    const complaintMarkers = [];
    complaintsInsideBoundary.forEach(complaint => {
      const marker = createComplaintMarker(complaint);
      complaintMarkers.push(marker);
    });
    const markerLayer = L.layerGroup(complaintMarkers);
    window.markerLayer = markerLayer;

    // Add/remove marker layer based on zoom level
    const MARKER_VISIBILITY_ZOOM = 10; // Lowered from 14 to make markers visible at lower zoom levels
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
    
    // Add window resize listener to handle size changes
    window.addEventListener('resize', () => {
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch (_) {}
      }, 100);
    });
    
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
      
    }
    
    
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
        <button class="btn btn-outline-warning" data-action="reload-page">
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
  const mapboxToken = (window.MAPBOX_TOKEN || localStorage.getItem('MAPBOX_TOKEN') || '').trim();
  const baseMaps = {
    "Standard Light": mapboxToken
      ? L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}?access_token=${mapboxToken}`, {
          attribution: '© Mapbox © OpenStreetMap',
          tileSize: 256,
        })
      : L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap © CARTO' }),
    "Standard Dark": mapboxToken
      ? L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}?access_token=${mapboxToken}`, {
          attribution: '© Mapbox © OpenStreetMap',
          tileSize: 256,
        })
      : L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap © CARTO' }),
    "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
    "Satellite": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'),
    "Terrain": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png')
  };
  
  const overlayMaps = {
    "Complaints": window.markerLayer || L.layerGroup([]),
    "Heatmap": window.heatLayer || L.layerGroup([])
  };
  // Add barangay boundaries overlay if available
  if (window.brgyLayer) {
    overlayMaps["Barangay Boundaries"] = window.brgyLayer;
  }
  
  try {
    const layersControl = L.control.layers(baseMaps, overlayMaps, { position: 'topright' }).addTo(map);
    const setMapThemeBackground = (layerOrName) => {
      try {
        let isDark = false;
        if (layerOrName && typeof layerOrName === 'object' && layerOrName.getAttribution) {
          isDark = layerOrName === baseMaps['Standard Dark'];
        } else {
          const name = String(layerOrName || '').toLowerCase();
          isDark = name.includes('dark');
        }
        document.body.classList.toggle('map-dark', !!isDark);
      } catch (_) {}
    };
    // Initialize based on which base layer is currently on the map
    const currentBaseKey = Object.keys(baseMaps).find(k => map.hasLayer(baseMaps[k]));
    setMapThemeBackground(currentBaseKey || '');
    map.on('baselayerchange', (e) => setMapThemeBackground(e && (e.layer || e.name)));
  } catch (_) {}
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
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:#10b981; border:1px solid #fff"></span>
        <span>Resolved</span>
      </div>
      <div style="font-weight:600; margin:6px 0 4px;">Complaint Density</div>
      <div style="width:160px; height:10px; background: linear-gradient(90deg, blue 0%, lime 40%, yellow 70%, red 100%); border-radius:4px; border:1px solid #eee;"></div>
      <div style="display:flex; justify-content:space-between; color:#666; margin-top:4px;">
        <span>Low</span>
        <span>High</span>
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
  
  // Get current user's department for access control
  const user = window.currentUser || null;
  const userDept = user?.type?.replace('lgu-admin-', '').replace('lgu-', '') || null;
  const complaintAssignedUnit = complaint.assigned_unit || complaint.assignedUnit;
  const isAssignedToUserDept = userDept && complaintAssignedUnit && 
    (complaintAssignedUnit === userDept || complaintAssignedUnit.includes(userDept));
  
  // Create detailed tooltip content
  const tooltipActionsHtml = isAssignedToUserDept ? 
    `<div class="tooltip-actions">
      <a href="/lgu/complaints?id=${complaint.id}" class="view-details-btn">View Details</a>
    </div>` : 
    `<div class="tooltip-actions">
      <span class="text-muted">Not assigned to your department</span>
    </div>`;
  
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
      ${tooltipActionsHtml}
    </div>
  `;
  
  // Bind tooltip with HTML content
  marker.bindTooltip(tooltipContent, {
    direction: 'top',
    offset: [0, -10],
    className: 'complaint-tooltip-container',
    maxWidth: 300
  });
  
  // Create popup content with conditional access
  const popupActionsHtml = isAssignedToUserDept ? 
    `<a href="/lgu/complaints?id=${complaint.id}" class="popup-link">View Full Details</a>` : 
    `<span class="text-muted">Not assigned to your department</span>`;
  
  // Add popup with complaint details - ensure it appears above all layers
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
      ${popupActionsHtml}
    </div>
  `, {
    className: 'complaint-popup-high-z',
    maxWidth: 300,
    autoPan: true,
    keepInView: true
  });
  
  // Open/close popup on hover
  try {
    marker.on('mouseover', () => { try { marker.openPopup(); } catch (_) {} });
    marker.on('mouseout', () => { try { marker.closePopup(); } catch (_) {} });
  } catch (_) {}
  
  return marker;
}

// Check if a point lies inside a Leaflet polygon/multipolygon latlngs structure
function pointInPolygonLeaflet(point, latlngs) {
  // latlngs can be Array of LatLngs (Polygon rings) or Array of Arrays (MultiPolygon)
  const containsPointInRing = (ring) => {
    try {
      const poly = L.polygon(ring);
      return poly.getBounds().contains(point) && L.Polyline.prototype.isInside ? L.Polyline.prototype.isInside.call(poly, point) : rayCasting(point, ring);
    } catch (_) {
      return rayCasting(point, ring);
    }
  };
  if (!Array.isArray(latlngs) || latlngs.length === 0) return false;
  // MultiPolygon: array of polygons (each polygon can have holes: array of rings)
  if (Array.isArray(latlngs[0])) {
    for (const geom of latlngs) {
      // geom may be polygon (array of rings) or a ring itself
      if (Array.isArray(geom[0])) {
        // First ring is outer boundary
        if (containsPointInRing(geom[0])) return true;
      } else if (containsPointInRing(geom)) {
        return true;
      }
    }
    return false;
  }
  return containsPointInRing(latlngs);
}

// Simple ray-casting point-in-polygon for array of LatLngs
function rayCasting(point, ring) {
  const x = point.lat, y = point.lng;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lat, yi = ring[i].lng;
    const xj = ring[j].lat, yj = ring[j].lng;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
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

// Normalize statuses to canonical values for consistent analytics
function normalizeStatus(status) {
  const s = (status || '').toString().toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
  if (s === 'inprogress') return 'in_progress';
  if (['pending', 'in_progress', 'resolved'].includes(s)) return s;
  return 'pending';
}

// Compute a stable area key from latitude/longitude using a simple grid
// This lets us bucket nearby complaints into the same "hotspot area"
function getAreaKey(lat, lon, gridSizeDegrees = 0.01) { // ≈1.1km at equator
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (Number.isNaN(latNum) || Number.isNaN(lonNum)) return 'Unknown Area';
  // Prefer barangay name if point lies inside any barangay polygon
  try {
    if (Array.isArray(window._brgyPolygons) && window._brgyPolygons.length) {
      const point = L.latLng(latNum, lonNum);
      for (const poly of window._brgyPolygons) {
        try {
          if (pointInPolygonLeaflet(point, poly.latlngs)) {
            return poly.name;
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
  // Fallback to grid-based zone label
  const latCell = Math.floor(latNum / gridSizeDegrees) * gridSizeDegrees;
  const lonCell = Math.floor(lonNum / gridSizeDegrees) * gridSizeDegrees;
  return `Zone ${latCell.toFixed(2)}, ${lonCell.toFixed(2)}`;
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

// Add advanced filters to the left panel container
function addAdvancedFilters() {
  const container = document.getElementById('advanced-filters-container');
  if (!container) return;
  
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
  container.appendChild(advancedFiltersContainer);
  
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
  
  // Optional: loading indicator (disabled per UX feedback)
  // addLoadingIndicator();
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
  const mountPoint = document.querySelector('.page-header') || document.querySelector('.floating-controls');
  if (!mountPoint) return;
  
  const exportContainer = document.createElement('div');
  exportContainer.className = 'export-container';
  
  const exportButton = document.createElement('button');
  exportButton.className = 'export-button';
  exportButton.innerHTML = '<i class="fas fa-download"></i> Export Data';
  exportButton.title = 'Export heatmap data and statistics';
  
  exportContainer.appendChild(exportButton);
  mountPoint.appendChild(exportContainer);
  
  // Add event listener
  exportButton.addEventListener('click', showExportOptions);
}

// Setup clustering analysis button
function setupClusteringButton() {
  // Clustering feature disabled per request
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
async function exportData() {
  const format = document.getElementById('export-format').value;
  const startDate = document.getElementById('export-start-date').value;
  const endDate = document.getElementById('export-end-date').value;
  
  // Get filtered data
  const allComplaints = await fetchComplaints();
  const complaints = allComplaints.filter(complaint => {
    const complaintDate = new Date(complaint.created_at || complaint.createdAt);
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
  const quickStats = document.querySelector('.quick-stats');
  
  if (!quickStats) {
    console.warn('Quick stats container not found, skipping analytics dashboard');
    return;
  }
  
  const analyticsCard = document.createElement('div');
  analyticsCard.className = 'stat-item analytics-item';
  analyticsCard.innerHTML = `
    <span class="stat-label">Trend Analysis</span>
    <span class="stat-value">
      <div class="trend-item">
        <span class="trend-label">Weekly</span>
        <span class="trend-value positive">+12%</span>
      </div>
      <div class="trend-item">
        <span class="trend-label">Monthly</span>
        <span class="trend-value negative">-5%</span>
      </div>
    </span>
  `;
  
  quickStats.appendChild(analyticsCard);
}

// Update statistics
function updateStatistics(complaints) {
  // Calculate statistics
  const totalComplaints = complaints.length;
  const pendingComplaints = complaints.filter(c => c.status === 'pending').length;
  const resolvedComplaints = complaints.filter(c => c.status === 'resolved').length;
  const inProgressComplaints = complaints.filter(c => c.status === 'in_progress').length;
  const avgResponseTime = (typeof calculateAverageResponseTime === 'function') ? calculateAverageResponseTime(complaints) : 0;
  
  // Update overlay statistics
  updateOverlayStatistics(totalComplaints, pendingComplaints, inProgressComplaints, resolvedComplaints);
  
  // Update hotspot list with real data
  updateHotspotList(complaints);
  
  // Update priority areas
  updatePriorityAreas(complaints);
  
  // Update enhanced insights panel
  updateEnhancedInsights(complaints);
  
  // Remove resource allocation per request
}

// Update overlay statistics
function updateOverlayStatistics(total, pending, inProgress, resolved) {
  const totalEl = document.getElementById('total-complaints');
  const pendingEl = document.getElementById('pending-complaints');
  const inProgressEl = document.getElementById('in-progress-complaints');
  const resolvedEl = document.getElementById('resolved-complaints');
  
  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (inProgressEl) inProgressEl.textContent = inProgress;
  if (resolvedEl) resolvedEl.textContent = resolved;
}

// Add CSS styles for overlay panels
function addOverlayStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .overlay-container {
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 1500;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    
    .overlay-panel {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      min-width: 250px;
      max-width: 300px;
    }
    
    .overlay-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      background: rgba(0, 0, 0, 0.05);
      border-radius: 8px 8px 0 0;
    }
    
    .overlay-header h6 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }
    
    .overlay-toggle {
      background: none;
      border: none;
      color: #666;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s ease;
    }
    
    .overlay-toggle:hover {
      background: rgba(0, 0, 0, 0.1);
      color: #333;
    }
    
    .overlay-content {
      padding: 16px;
      display: block;
    }
    
    .filter-group {
      margin-bottom: 12px;
    }
    
    .filter-group label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #555;
      margin-bottom: 4px;
    }
    
    .overlay-select, .overlay-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 12px;
      background: white;
    }
    
    .overlay-select:focus, .overlay-input:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }
    
    .overlay-btn {
      width: 100%;
      padding: 8px 12px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    
    .overlay-btn:hover {
      background: #0056b3;
    }
    
    .overlay-btn:disabled {
      background: #6c757d;
      cursor: not-allowed;
    }
    
    .stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding: 8px 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }
    
    .stat-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
    }
    
    .stat-label {
      font-size: 12px;
      color: #666;
      font-weight: 500;
    }
    
    .stat-value {
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }
    
    .fullscreen-toggle-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2000;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      border: none;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      font-size: 18px;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    
    .fullscreen-toggle-btn:hover {
      background: rgba(0, 0, 0, 0.9);
      transform: scale(1.1);
    }
    
    .no-data-message {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      background: rgba(255, 255, 255, 0.9);
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      max-width: 400px;
    }
    
    .no-data-message i {
      color: #6c757d;
      margin-bottom: 20px;
    }
    
    .no-data-message h3 {
      color: #495057;
      margin-bottom: 16px;
    }
    
    .no-data-message p {
      color: #6c757d;
      margin-bottom: 8px;
    }
  `;
  
  document.head.appendChild(style);
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
    if (currentZoom >= 10) { // Lowered from 14 to match MARKER_VISIBILITY_ZOOM
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
  
  // Group complaints by grid area using latitude/longitude
  const areaComplaints = {};
  complaints.forEach(complaint => {
    const { latitude, longitude } = complaint;
    if (latitude && longitude) {
      const area = getAreaKey(latitude, longitude);
      if (!areaComplaints[area]) areaComplaints[area] = [];
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
    const status = normalizeStatus(complaint.status);
    const { latitude, longitude } = complaint;
    if (latitude && longitude && status !== 'resolved') {
      const area = getAreaKey(latitude, longitude);
      if (!areaPriority[area]) areaPriority[area] = { score: 0, complaints: [] };
      let score = status === 'pending' ? 3 : status === 'in_progress' ? 2 : 1;
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

// Enhanced insights panel updates
function updateEnhancedInsights(complaints) {
  console.log('Updating enhanced insights with', complaints.length, 'complaints');
  
  // Update quick stats
  updateQuickStats(complaints);
  
  // Update hotspot analysis
  updateHotspotAnalysis(complaints);
  
  // Update priority analysis
  updatePriorityAnalysis(complaints);
  
  // Update trend analysis
  updateTrendAnalysis(complaints);
  
  // Update department performance
  updateDepartmentPerformance(complaints);
}

// Calculate average response time for complaints
function calculateAverageResponseTime(complaints) {
  if (!complaints || complaints.length === 0) return 0;
  
  const resolvedComplaints = complaints.filter(c => 
    c.status === 'resolved' && 
    c.created_at && 
    c.resolved_at
  );
  
  if (resolvedComplaints.length === 0) return 0;
  
  const totalResponseTime = resolvedComplaints.reduce((total, complaint) => {
    const createdDate = new Date(complaint.created_at);
    const resolvedDate = new Date(complaint.resolved_at);
    const responseTime = resolvedDate.getTime() - createdDate.getTime();
    return total + responseTime;
  }, 0);
  
  const avgResponseTimeMs = totalResponseTime / resolvedComplaints.length;
  const avgResponseTimeDays = avgResponseTimeMs / (1000 * 60 * 60 * 24);
  
  return Math.round(avgResponseTimeDays * 10) / 10; // Round to 1 decimal place
}

// Update quick stats section
function updateQuickStats(complaints) {
  const totalComplaints = complaints.length;
  const activeAreas = new Set(complaints.map(c => c.location || 'Unknown')).size;
  const avgResponseTime = calculateAverageResponseTime(complaints);
  
  const totalEl = document.getElementById('total-complaints-count');
  const areasEl = document.getElementById('active-areas-count');
  const responseEl = document.getElementById('avg-response-time');
  
  if (totalEl) totalEl.textContent = totalComplaints;
  if (areasEl) areasEl.textContent = activeAreas;
  if (responseEl) responseEl.textContent = avgResponseTime > 0 ? `${avgResponseTime.toFixed(1)}d` : 'N/A';
}

// Update hotspot analysis with visual bars
function updateHotspotAnalysis(complaints) {
  const hotspotData = calculateHotspotData(complaints);
  const hotspotFill = document.querySelector('.hotspot-fill');
  const hotspotLabel = document.querySelector('.hotspot-label');
  
  if (hotspotFill && hotspotLabel && hotspotData.length > 0) {
    const maxComplaints = Math.max(...hotspotData.map(h => h.count));
    const totalComplaints = hotspotData.reduce((sum, h) => sum + h.count, 0);
    
    // Update the main hotspot bar
    const intensity = Math.min(100, (totalComplaints / maxComplaints) * 100);
    hotspotFill.style.width = `${intensity}%`;
    hotspotLabel.textContent = `${hotspotData.length} hotspot areas identified`;
  } else if (hotspotFill && hotspotLabel) {
    hotspotFill.style.width = '0%';
    hotspotLabel.textContent = 'No hotspots identified';
  }
}

// Update priority analysis with visual bars
function updatePriorityAnalysis(complaints) {
  const highPriority = complaints.filter(c => c.priority === 'high' || c.status === 'pending').length;
  const mediumPriority = complaints.filter(c => c.priority === 'medium' || c.status === 'in_progress').length;
  const lowPriority = complaints.filter(c => c.priority === 'low' || c.status === 'resolved').length;
  
  const total = highPriority + mediumPriority + lowPriority;
  
  // Update counts
  const highCountEl = document.getElementById('high-priority-count');
  const mediumCountEl = document.getElementById('medium-priority-count');
  const lowCountEl = document.getElementById('low-priority-count');
  
  if (highCountEl) highCountEl.textContent = highPriority;
  if (mediumCountEl) mediumCountEl.textContent = mediumPriority;
  if (lowCountEl) lowCountEl.textContent = lowPriority;
  
  // Update bars
  const highBar = document.querySelector('.priority-fill.high');
  const mediumBar = document.querySelector('.priority-fill.medium');
  const lowBar = document.querySelector('.priority-fill.low');
  
  if (total > 0) {
    if (highBar) highBar.style.width = `${(highPriority / total) * 100}%`;
    if (mediumBar) mediumBar.style.width = `${(mediumPriority / total) * 100}%`;
    if (lowBar) lowBar.style.width = `${(lowPriority / total) * 100}%`;
  } else {
    if (highBar) highBar.style.width = '0%';
    if (mediumBar) mediumBar.style.width = '0%';
    if (lowBar) lowBar.style.width = '0%';
  }
}

// Update trend analysis
function updateTrendAnalysis(complaints) {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const weeklyComplaints = complaints.filter(c => {
    const complaintDate = new Date(c.created_at || c.timestamp);
    return complaintDate >= oneWeekAgo;
  }).length;
  
  const avgResolutionTime = calculateAverageResolutionTime(complaints);
  
  const weeklyEl = document.getElementById('weekly-trend');
  const resolutionEl = document.getElementById('resolution-trend');
  
  if (weeklyEl) weeklyEl.textContent = weeklyComplaints;
  if (resolutionEl) resolutionEl.textContent = avgResolutionTime > 0 ? `${avgResolutionTime.toFixed(1)}h` : 'N/A';
}

// Update department performance
function updateDepartmentPerformance(complaints) {
  const resolvedComplaints = complaints.filter(c => c.status === 'resolved').length;
  const totalComplaints = complaints.length;
  const performancePercentage = totalComplaints > 0 ? (resolvedComplaints / totalComplaints) * 100 : 0;
  
  const deptBar = document.getElementById('dept-performance-bar');
  const deptValue = document.getElementById('dept-performance-value');
  
  if (deptBar) deptBar.style.width = `${performancePercentage}%`;
  if (deptValue) deptValue.textContent = `${performancePercentage.toFixed(1)}%`;
}

// Calculate hotspot data
function calculateHotspotData(complaints) {
  const locationCounts = {};
  
  complaints.forEach(complaint => {
    const location = complaint.location || 'Unknown';
    locationCounts[location] = (locationCounts[location] || 0) + 1;
  });
  
  return Object.entries(locationCounts)
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count);
}

// Calculate average resolution time
function calculateAverageResolutionTime(complaints) {
  const resolutionTimes = complaints
    .filter(c => c.status === 'resolved' && c.resolved_at)
    .map(c => {
      const resolved = new Date(c.resolved_at);
      const created = new Date(c.created_at || c.timestamp);
      return (resolved - created) / (1000 * 60 * 60); // hours
    })
    .filter(time => time > 0);
  
  return resolutionTimes.length > 0 ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length : 0;
}

// Update resource allocation
function updateResourceAllocation(complaints) {
  // Feature removed per request
}

// Setup filters
function setupFilters() {
  const heatmapFilter = document.getElementById('heatmap-filter');
  const timeFilter = document.getElementById('time-filter');
  
  if (!heatmapFilter || !timeFilter) {
    console.warn('Filter elements not found');
    return;
  }
  
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
    
    // Get complaints from backend API
    const complaints = await fetchComplaints();
    
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
    
    // K-Means clustering and cluster display removed per request
    
    // Update markers layer
    if (window.markerLayer) {
      try { window.complaintMap.removeLayer(window.markerLayer); } catch (_) {}
    }
    const newMarkers = complaintsInsideBoundary.map(c => createComplaintMarker(c));
    window.markerLayer = L.layerGroup(newMarkers);
    const MARKER_VISIBILITY_ZOOM = 10; // Lowered from 14 to make markers visible at lower zoom levels
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
  
  // Cluster statistics removed per request
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
      <button data-action="view-cluster-complaints" data-cluster-index="${cluster.clusterIndex}" class="btn btn-primary btn-sm">
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
    // Get complaints data via backend API
    const complaints = await fetchComplaints();
    
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
      
    } else if (window.complaintMap) {
      window.complaintMap.addLayer(window.boundaryLayer);
      
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
  
  
  // Store boundary reference for toggle functionality
  window.boundaryLayer = boundary;
  
  // Add boundary toggle button to controls
  addBoundaryToggleButton();
}

// Filter complaints to only show those inside the city boundary
function filterComplaintsInsideBoundary(complaints, boundaryLayer) {
  if (!boundaryLayer) {
    
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
      
      return false;
    }
  });
  
  return complaintsInside;
}

// Helper: fetch complaints via backend API (uses service key on server)
async function fetchComplaints(params = {}) {
	try {
		// Get user's department for filtering
		const user = checkAuth();
		let departmentFilter = null;
		if (user) {
			const role = String(user.role || user.type || '').toLowerCase();
			if (role.startsWith('lgu-admin-')) {
				departmentFilter = role.replace('lgu-admin-', '');
			} else if (role.startsWith('lgu-')) {
				departmentFilter = role.replace('lgu-', '');
			}
		}

		// Fetch all complaints and filter by assigned_unit
		const qs = new URLSearchParams(params).toString();
		const res = await fetch(`/api/complaints${qs ? `?${qs}` : ''}`);
		if (!res.ok) {
			console.error('fetchComplaints: API returned non-OK', res.status);
			return [];
		}
		const body = await res.json();
		// Support different shapes: array or { complaints | data }
		let allComplaints = Array.isArray(body) ? body : (body.complaints || body.data || []);
		
		// Filter by assigned_unit if user has a department
		if (departmentFilter && allComplaints.length > 0) {
			console.log('🔍 Filtering complaints by assigned_unit:', departmentFilter);
			const filteredComplaints = allComplaints.filter(complaint => 
				complaint.assigned_unit === departmentFilter
			);
			console.log('📊 Total complaints:', allComplaints.length);
			console.log('📊 Filtered complaints for department:', filteredComplaints.length);
			return filteredComplaints;
		}
		
		console.log('📊 All complaints count:', allComplaints.length);
		return allComplaints;
	} catch (err) {
		console.error('fetchComplaints error:', err);
		return [];
	}
}

// Setup button event listeners
function setupButtonEventListeners() {
  // Use event delegation for dynamically created buttons
  document.addEventListener('click', (e) => {
    // Handle reload page button
    if (e.target.matches('[data-action="reload-page"]') || e.target.closest('[data-action="reload-page"]')) {
      location.reload();
    }
    
    // Handle view cluster complaints button
    if (e.target.matches('[data-action="view-cluster-complaints"]') || e.target.closest('[data-action="view-cluster-complaints"]')) {
      const button = e.target.closest('[data-action="view-cluster-complaints"]');
      const clusterIndex = button.getAttribute('data-cluster-index');
      viewClusterComplaints(clusterIndex);
    }
  });
}
