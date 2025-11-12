// Heatmap initialization script
// Moved from inline script to comply with CSP

// Global references
let map = null;
let heatmapViz = null;
let currentFilters = {
  status: '',
  category: '',
  department: '',
  includeResolved: true
};

// Simple initialization - map with heatmap and controls
(async function() {
  try {
    // Wait for Leaflet to be available
    while (typeof L === 'undefined') {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Store original center point (origin) - calculated from brgy_boundaries_location.json
    // Center calculated from all barangay boundaries: [6.854282, 125.318462]
    const originCenter = [6.854282, 125.318462]; // Digos City center from JSON file
    const originZoom = 11;

    // Initialize map with increased zoom out level
    map = await initializeSimpleMap('map', {
      center: originCenter,
      zoom: originZoom,
      minZoom: 8 // Allow zooming out further (lower = more zoom out)
    });

    if (!map) {
      throw new Error('Failed to initialize map');
    }

    // Store map globally for boundaryGenerator
    window.simpleMap = map;
    
    // Ensure layer control (tile changer) stays below zoom controls
    // It should remain in its default Leaflet position (.leaflet-top.leaflet-left)
    // No need to move it - it's already positioned correctly below zoom controls

    // Add zoom event listener for heatmap/marker visibility and origin reset
    map.on('zoomend', () => {
      const currentZoom = map.getZoom();
      const minZoom = map.getMinZoom();
      
      // When zoomed out to minimum level, reset to origin
      if (currentZoom <= minZoom) {
        map.setView(originCenter, originZoom, { animate: true });
      }
      
      // Mark initial load as complete only when user zooms IN (zoom > 11)
      // This ensures markers stay hidden until user manually zooms in
      if (isInitialLoad && currentZoom > 11) {
        isInitialLoad = false;
        window.isInitialLoad = false;
      }
      
      // Zoom-based visibility: heatmap at zoom <= 11, markers at zoom > 11
      updateZoomBasedVisibility(currentZoom);
    });
    
    // Also listen to zoom to update immediately
    map.on('zoom', () => {
      const currentZoom = map.getZoom();
      
      // Mark initial load as complete only when user zooms IN (zoom > 11)
      // This ensures markers stay hidden until user manually zooms in
      if (isInitialLoad && currentZoom > 11) {
        isInitialLoad = false;
        window.isInitialLoad = false;
      }
      
      updateZoomBasedVisibility(currentZoom);
    });

    // Initialize heatmap visualization
    heatmapViz = new HeatmapVisualization(map);
    
    // Store globally for boundaryGenerator to access
    window.heatmapViz = heatmapViz;

    // Setup control panel handlers
    setupControlPanel();

    // Setup sidebar toggle
    setupSidebarToggle();

    // Wait a bit for boundaries to load, then load complaint data
    // This ensures boundary filtering works correctly
    let boundaryWaitAttempts = 0;
    const maxBoundaryWait = 20; // Wait up to 4 seconds (20 * 200ms)
    while (!window.cityBoundaries && boundaryWaitAttempts < maxBoundaryWait) {
      await new Promise(resolve => setTimeout(resolve, 200));
      boundaryWaitAttempts++;
    }
    
    if (window.cityBoundaries) {
      console.log('[HEATMAP] Boundaries loaded, filtering complaints by boundary');
    } else {
      console.warn('[HEATMAP] Boundaries not loaded yet, using bounding box fallback');
    }

    // Load complaint data (but keep default Digos City view - don't auto-fit)
    await loadComplaintData();

    // Keep default Digos City view on initial load instead of auto-fitting
    // Users can click "Fit to All Markers" button if they want to see all complaints
    
  } catch (error) {
    console.error('[HEATMAP] Initialization failed:', error);
  }
})();

// Calculate date range from complaint data
function calculateDateRange(complaintData) {
  if (!complaintData || complaintData.length === 0) {
    return { oldest: null, latest: null };
  }

  let oldest = null;
  let latest = null;

  complaintData.forEach(complaint => {
    const complaintDate = new Date(complaint.submittedAt || complaint.submitted_at);
    if (isNaN(complaintDate.getTime())) {
      return; // Skip invalid dates
    }

    if (!oldest || complaintDate < oldest) {
      oldest = new Date(complaintDate);
    }
    if (!latest || complaintDate > latest) {
      latest = new Date(complaintDate);
    }
  });

  return { oldest, latest };
}

// Setup date picker constraints based on complaint data and selected dates
function setupDatePickerConstraints() {
  const dateStart = document.getElementById('date-range-start');
  const dateEnd = document.getElementById('date-range-end');
  
  if (!dateStart || !dateEnd || !heatmapViz || !heatmapViz.allComplaintData) {
    return;
  }

  const { oldest, latest } = calculateDateRange(heatmapViz.allComplaintData);
  
  if (!oldest || !latest) {
    console.warn('[HEATMAP] No valid complaint dates found for date range restriction');
    return;
  }

  // Format dates as YYYY-MM-DD for HTML5 date inputs
  const oldestDateStr = oldest.toISOString().split('T')[0];
  const latestDateStr = latest.toISOString().split('T')[0];

  // Get currently selected dates
  const selectedStartDate = dateStart.value;
  const selectedEndDate = dateEnd.value;

  // Set base min/max for both inputs (oldest to latest complaint dates)
  dateStart.setAttribute('min', oldestDateStr);
  dateStart.setAttribute('max', latestDateStr);
  dateEnd.setAttribute('min', oldestDateStr);
  dateEnd.setAttribute('max', latestDateStr);

  // Apply dynamic constraints based on selected dates
  updateDatePickerConstraints(selectedStartDate, selectedEndDate);
}

// Update date picker constraints dynamically when dates are selected
function updateDatePickerConstraints(selectedStartDate, selectedEndDate) {
  const dateStart = document.getElementById('date-range-start');
  const dateEnd = document.getElementById('date-range-end');
  
  if (!dateStart || !dateEnd || !heatmapViz || !heatmapViz.allComplaintData) {
    return;
  }

  const { oldest, latest } = calculateDateRange(heatmapViz.allComplaintData);
  if (!oldest || !latest) {
    return;
  }

  const oldestDateStr = oldest.toISOString().split('T')[0];
  const latestDateStr = latest.toISOString().split('T')[0];

  // Start date: min = oldest, max = selected end date (or latest if no end date selected)
  if (selectedEndDate) {
    dateStart.setAttribute('max', selectedEndDate);
  } else {
    dateStart.setAttribute('max', latestDateStr);
  }
  dateStart.setAttribute('min', oldestDateStr);

  // End date: min = selected start date (or oldest if no start date selected), max = latest
  if (selectedStartDate) {
    dateEnd.setAttribute('min', selectedStartDate);
  } else {
    dateEnd.setAttribute('min', oldestDateStr);
  }
  dateEnd.setAttribute('max', latestDateStr);

  // Clear invalid selections
  if (selectedStartDate && selectedEndDate) {
    const startDate = new Date(selectedStartDate);
    const endDate = new Date(selectedEndDate);
    
    if (startDate > endDate) {
      // Start date is after end date - clear the one that violates constraint
      const startMax = new Date(dateStart.getAttribute('max'));
      const endMin = new Date(dateEnd.getAttribute('min'));
      
      if (startDate > startMax) {
        dateStart.value = '';
      }
      if (endDate < endMin) {
        dateEnd.value = '';
      }
    }
  }
}

// Load complaint data (only called once on initial load, then filters are applied client-side)
async function loadComplaintData() {
  try {
    // Load ALL complaints (no filters) - we'll filter client-side
    await heatmapViz.loadComplaintData({ includeResolved: true });

    // Get the count of all complaints
    const totalCount = heatmapViz.allComplaintData ? heatmapViz.allComplaintData.length : 0;
    console.log(`[HEATMAP] Loaded ${totalCount} total complaint(s)`);

    // Setup date picker constraints based on loaded complaint data
    setupDatePickerConstraints();

    // Create heatmap layer with all data
    heatmapViz.createHeatmapLayer();
    if (heatmapViz.heatmapLayer) {
      heatmapViz.showHeatmap();
    }

    // IMPORTANT: Do NOT create markers during initial load
    // Markers will be created lazily when user zooms in for the first time
    // This prevents any flash of markers on page load
    // Markers will be created in updateZoomBasedVisibility() when zoom > 11 and isInitialLoad becomes false
    
    // Apply initial filters (markers don't exist yet, so this only affects heatmap)
    applyFiltersAndUpdate();
    
    // Apply initial zoom-based visibility (only heatmap will show)
    const initialZoom = map ? map.getZoom() : 11;
    updateZoomBasedVisibility(initialZoom);

    // Update statistics
    updateStatistics();
  } catch (error) {
    console.error('[HEATMAP] Failed to load data:', error);
  }
}

// Track if this is the initial load (show only heatmap regardless of zoom)
let isInitialLoad = true;
// Make it globally accessible so heatmapVisualization can check it
window.isInitialLoad = true;

// Function to update visibility based on zoom level (must be global for zoom events)
function updateZoomBasedVisibility(zoom) {
  if (!heatmapViz) return;
  
  const zoomThreshold = 11;
  const heatmapToggle = document.getElementById('toggle-heatmap-btn');
  const isHeatmapForced = heatmapToggle && heatmapToggle.classList.contains('forced-on');
  
  // On initial load, show only heatmap regardless of zoom
  // Markers will remain hidden until user manually zooms in (zoom > 11)
  if (isInitialLoad) {
    if (heatmapViz.heatmapLayer) {
      heatmapViz.showHeatmap();
    }
    if (heatmapViz.markerLayer) {
      // Explicitly hide all markers - they won't show until user zooms in
      heatmapViz.hideMarkers();
    }
    return; // Exit early - don't process zoom-based visibility during initial load
  }
  
  if (zoom <= zoomThreshold) {
    // Show heatmap, hide markers (zoom <= 11)
    if (heatmapViz.heatmapLayer) {
      heatmapViz.showHeatmap();
    }
    if (heatmapViz.markerLayer) {
      // Hide all markers when zoom <= 11
      heatmapViz.hideMarkers();
    }
  } else {
    // Zoom > 11: Show markers that pass filters, hide heatmap unless forced
    // Create markers lazily if they don't exist yet (first time user zooms in)
    if (!heatmapViz.markerLayer || heatmapViz.markerLayer.getLayers().length === 0) {
      console.log('[HEATMAP] Creating markers for first time (user zoomed in)');
      heatmapViz.createMarkerLayer();
    }
    
    if (heatmapViz.markerLayer) {
      // First ensure the marker layer is on the map
      if (!heatmapViz.map.hasLayer(heatmapViz.markerLayer)) {
        heatmapViz.markerLayer.addTo(heatmapViz.map);
      }
      
        // Trigger marker visibility update based on current filters
        // This ensures markers respect filter settings when zooming in
      if (heatmapViz.updateMarkerVisibility) {
        heatmapViz.updateMarkerVisibility();
          console.log('[HEATMAP] Marker visibility triggered by zoom change');
      } else {
        // Fallback: show all markers if updateMarkerVisibility doesn't exist
        heatmapViz.showMarkers();
      }
        
        // Update toggle button state
        const toggleMarkersBtn = document.getElementById('toggle-markers-btn');
        if (toggleMarkersBtn) {
          toggleMarkersBtn.textContent = 'Hide Markers';
          toggleMarkersBtn.classList.add('active');
        }
    }
    // Hide heatmap unless forced on
    if (heatmapViz.heatmapLayer) {
      if (isHeatmapForced) {
        heatmapViz.showHeatmap();
      } else {
        heatmapViz.hideHeatmap();
      }
    }
  }
}

// Function to ensure menu toggle and reset view button are in horizontal row
function positionResetViewButton() {
  const customControlsRow = document.querySelector('.map-custom-controls-row');
  const resetViewButton = document.getElementById('reset-view-btn');
  const menuToggle = document.getElementById('menu-toggle');
  
  if (!customControlsRow) return;
  
  // Ensure menu toggle is in the row
  if (menuToggle && menuToggle.parentElement !== customControlsRow) {
    customControlsRow.insertBefore(menuToggle, customControlsRow.firstChild);
  }
  
  // Ensure reset view button is in the row (not positioned elsewhere)
  if (resetViewButton) {
    // Remove any absolute/fixed positioning that might have been set
    resetViewButton.style.position = 'relative';
    resetViewButton.style.top = 'auto';
    resetViewButton.style.left = 'auto';
    resetViewButton.style.bottom = 'auto';
    
    // Ensure it's in the row container
    if (resetViewButton.parentElement !== customControlsRow) {
      customControlsRow.appendChild(resetViewButton);
    }
  }
  
  // Layer control (tile changer) should stay in its default Leaflet position
  // below the zoom controls - don't move it to the row
}

// Function to position gear button below control panel
function positionGearButton(disableTransition = false) {
  const panel = document.getElementById('map-controls-panel');
  const gearButton = document.getElementById('toggle-controls-btn');
  
  if (!panel || !gearButton) return;
  
  // Use position absolute and calculate based on panel position
  // Ensure parent container has position relative
  const mapContainer = document.getElementById('map');
  if (mapContainer && mapContainer.parentElement) {
    const parent = mapContainer.parentElement;
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }
  }
  
  gearButton.style.position = 'absolute';
  gearButton.style.right = '20px';
  
  // Temporarily disable transition if requested (e.g., when panel is closing)
  if (disableTransition) {
    gearButton.style.transition = 'none';
  }
  
  if (panel.classList.contains('hidden')) {
    // Panel is hidden, show gear button at default position
    gearButton.style.top = '20px';
  } else {
    // Panel is visible, position gear button below it
    const panelRect = panel.getBoundingClientRect();
    const panelTop = panelRect.top;
    const panelHeight = panelRect.height;
    const spacing = 10; // 10px spacing below panel
    // Calculate position relative to viewport (panel top + height + spacing)
    gearButton.style.top = `${panelTop + panelHeight + spacing}px`;
  }
  
  // Re-enable transition after a brief delay if it was disabled
  if (disableTransition) {
    setTimeout(() => {
      gearButton.style.transition = 'top 0.3s ease';
    }, 50);
  }
  
  // Also position reset view button
  positionResetViewButton();
}

// Setup control panel event handlers
function setupControlPanel() {
  // Toggle controls visibility
  document.getElementById('toggle-controls-btn').addEventListener('click', () => {
    const panel = document.getElementById('map-controls-panel');
    const isClosing = !panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    
    // Reposition gear button after toggling
    // Disable transition when closing to prevent animation
    setTimeout(() => {
      positionGearButton(isClosing);
    }, 50); // Small delay to ensure panel height is calculated
  });

  document.getElementById('close-controls-btn').addEventListener('click', () => {
    document.getElementById('map-controls-panel').classList.add('hidden');
    // Disable transition when closing to prevent animation
    positionGearButton(true);
  });
  
  // Reposition gear button when panel content changes (e.g., filters loaded)
  const observer = new MutationObserver(() => {
    positionGearButton();
  });
  
  const panel = document.getElementById('map-controls-panel');
  if (panel) {
    observer.observe(panel, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }
  
  // Initial positioning
  positionGearButton();
  
  // Also reposition on window resize
  window.addEventListener('resize', positionGearButton);
  
  // Initialize reset view button positioning
  // Make sure it's positioned correctly on initial load
  setTimeout(() => {
    positionGearButton();
    positionResetViewButton();
  }, 100);
  
  // Ensure layer control is in row after everything loads
  setTimeout(() => {
    positionResetViewButton();
  }, 500);

  // Setup legend toggle (collapsible drawer)
  const legendToggle = document.getElementById('legend-toggle');
  const mapLegend = document.getElementById('map-legend');
  if (legendToggle && mapLegend) {
    legendToggle.addEventListener('click', () => {
      mapLegend.classList.toggle('collapsed');
      mapLegend.classList.toggle('expanded');
    });
  }

  // Helper function to get checked values from checkbox group
  function getCheckedValues(checkboxClass) {
    const checkboxes = document.querySelectorAll(`.${checkboxClass}:checked`);
    return Array.from(checkboxes).map(cb => cb.value);
  }

  // Helper function to reset checkboxes
  function resetCheckboxes(checkboxClass) {
    document.querySelectorAll(`.${checkboxClass}`).forEach(cb => cb.checked = false);
  }

  // Debounce function to limit API calls
  let filterDebounceTimer = null;
  let isUpdating = false; // Prevent concurrent updates
  
  function debounceFilterUpdate(callback, delay = 500) {
    clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(async () => {
      if (!isUpdating) {
        isUpdating = true;
        try {
          await callback();
        } catch (error) {
          console.error('[HEATMAP] Error in debounced update:', error);
        } finally {
          // Always reset the flag after a short delay to allow UI to update
          setTimeout(() => {
            isUpdating = false;
          }, 100);
        }
      } else {
        console.log('[HEATMAP] Update already in progress, will retry after current update completes');
      }
    }, delay);
  }

  // Function to apply filters and update map visibility (client-side, no API call)
  function applyFiltersAndUpdate() {
    const statusValues = getCheckedValues('status-checkbox');
    const categoryValues = getCheckedValues('category-checkbox');
    const departmentValues = getCheckedValues('department-checkbox');
    const startDate = document.getElementById('date-range-start')?.value || '';
    const endDate = document.getElementById('date-range-end')?.value || '';

    // Debug logging for department filter
    console.log('[FILTER] Department checkboxes checked:', departmentValues);
    console.log('[FILTER] All department checkboxes:', document.querySelectorAll('.department-checkbox:checked'));

    currentFilters = {
      status: statusValues.length > 0 ? statusValues : '',
      category: categoryValues.length > 0 ? categoryValues : '',
      department: departmentValues.length > 0 ? departmentValues : '',
      includeResolved: document.getElementById('include-resolved').checked,
      startDate,
      endDate
    };

    console.log('[FILTER] Applied filters:', currentFilters);

    // Update marker visibility without reloading data
    if (heatmapViz) {
      heatmapViz.currentFilters = currentFilters;
      
      // Update heatmap layer with filtered data
      if (heatmapViz.heatmapLayer) {
        heatmapViz.hideHeatmap();
      }
      heatmapViz.createHeatmapLayer();
      
        // Trigger marker visibility update if markers exist and are visible
        if (heatmapViz.markerLayer && map && map.hasLayer(heatmapViz.markerLayer)) {
          // Markers are visible - update their visibility based on filters
          if (heatmapViz.updateMarkerVisibility) {
            heatmapViz.updateMarkerVisibility();
            console.log('[FILTER] Marker visibility updated via filter trigger');
          }
        }
      
      // Apply zoom-based visibility (this will handle both markers and heatmap)
      // Don't call updateMarkerVisibility() directly - let updateZoomBasedVisibility handle it
      const currentZoom = map ? map.getZoom() : 11;
      updateZoomBasedVisibility(currentZoom);
      updateStatistics();
    }
  }

  // Make function and timer globally accessible for dynamically loaded checkboxes
  window.applyFiltersAndUpdate = applyFiltersAndUpdate;
  window.debounceFilterUpdate = debounceFilterUpdate;

  // Apply Filters button removed - filtering is now automatic when checkboxes change

  // Auto-apply filters when checkboxes change
  function setupAutoFiltering() {
    // Status checkboxes (already in HTML, attach listeners)
    document.querySelectorAll('.status-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        debounceFilterUpdate(applyFiltersAndUpdate, 500);
      });
    });

    // Category and Department checkboxes are loaded dynamically, 
    // so listeners are attached in loadCategories() and loadDepartments()

    // Include resolved checkbox
    const includeResolvedCheckbox = document.getElementById('include-resolved');
    if (includeResolvedCheckbox) {
      includeResolvedCheckbox.addEventListener('change', () => {
        debounceFilterUpdate(applyFiltersAndUpdate, 500);
      });
    }

    // Date range filters
    const dateStart = document.getElementById('date-range-start');
    const dateEnd = document.getElementById('date-range-end');
    const clearDateRange = document.getElementById('clear-date-range');
    
    if (dateStart) {
      dateStart.addEventListener('change', () => {
        // Update constraints when start date changes
        const selectedStartDate = dateStart.value;
        const selectedEndDate = dateEnd ? dateEnd.value : '';
        updateDatePickerConstraints(selectedStartDate, selectedEndDate);
        debounceFilterUpdate(applyFiltersAndUpdate, 500);
      });
    }
    
    if (dateEnd) {
      dateEnd.addEventListener('change', () => {
        // Update constraints when end date changes
        const selectedStartDate = dateStart ? dateStart.value : '';
        const selectedEndDate = dateEnd.value;
        updateDatePickerConstraints(selectedStartDate, selectedEndDate);
        debounceFilterUpdate(applyFiltersAndUpdate, 500);
      });
    }
    
    if (clearDateRange) {
      clearDateRange.addEventListener('click', () => {
        if (dateStart) dateStart.value = '';
        if (dateEnd) dateEnd.value = '';
        // Reset constraints to base range
        updateDatePickerConstraints('', '');
        debounceFilterUpdate(applyFiltersAndUpdate, 500);
      });
    }

    // Toggle markers button
    const toggleMarkersBtn = document.getElementById('toggle-markers-btn');
    if (toggleMarkersBtn) {
      toggleMarkersBtn.addEventListener('click', () => {
        if (!heatmapViz) return;
        
        // Check if markers are currently visible
        const markersVisible = heatmapViz.markerLayer && 
                              map && 
                              map.hasLayer(heatmapViz.markerLayer);
        
        if (markersVisible) {
          // Hide markers
          heatmapViz.hideMarkers();
          toggleMarkersBtn.textContent = 'Show Markers';
          toggleMarkersBtn.classList.remove('active');
          console.log('[HEATMAP] Markers hidden via toggle');
        } else {
          // Show markers - ensure layer exists first
          if (!heatmapViz.markerLayer || heatmapViz.markerLayer.getLayers().length === 0) {
            heatmapViz.createMarkerLayer();
          }
          
          // Apply current filters to determine which markers should be visible
          if (heatmapViz.updateMarkerVisibility) {
            heatmapViz.updateMarkerVisibility();
          } else {
            heatmapViz.showMarkers();
          }
          
          toggleMarkersBtn.textContent = 'Hide Markers';
          toggleMarkersBtn.classList.add('active');
          console.log('[HEATMAP] Markers shown via toggle');
        }
      });
    }

    // Toggle heatmap button
    const toggleHeatmapBtn = document.getElementById('toggle-heatmap-btn');
    if (toggleHeatmapBtn) {
      toggleHeatmapBtn.addEventListener('click', () => {
        if (!heatmapViz) return;
        
        const isForced = toggleHeatmapBtn.classList.contains('forced-on');
        const currentZoom = map ? map.getZoom() : 11;
        
        if (isForced) {
          // Turn off forced mode - return to zoom-based visibility
          toggleHeatmapBtn.classList.remove('forced-on');
          toggleHeatmapBtn.textContent = 'Toggle Heatmap';
          updateZoomBasedVisibility(currentZoom);
        } else {
          // Force heatmap on
          toggleHeatmapBtn.classList.add('forced-on');
          toggleHeatmapBtn.textContent = 'Heatmap: ON';
          if (heatmapViz.heatmapLayer) {
            heatmapViz.showHeatmap();
          }
        }
      });
    }
  }


  // Reset filters
  const resetFiltersBtn = document.getElementById('reset-filters-btn');
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', async () => {
    resetCheckboxes('status-checkbox');
    resetCheckboxes('category-checkbox');
    resetCheckboxes('department-checkbox');
    document.getElementById('include-resolved').checked = true;
    
    // Clear date range
    const dateStart = document.getElementById('date-range-start');
    const dateEnd = document.getElementById('date-range-end');
    if (dateStart) dateStart.value = '';
    if (dateEnd) dateEnd.value = '';
    
    // Reset heatmap toggle
    const toggleHeatmapBtn = document.getElementById('toggle-heatmap-btn');
    if (toggleHeatmapBtn) {
      toggleHeatmapBtn.classList.remove('forced-on');
      toggleHeatmapBtn.textContent = 'Toggle Heatmap';
    }

    currentFilters = {
      status: '',
      category: '',
      department: '',
      includeResolved: true,
      startDate: '',
      endDate: ''
    };

    await loadComplaintData();
    fitToAllMarkers();
  });
  }

  // Fit to bounds
  document.getElementById('fit-bounds-btn').addEventListener('click', () => {
    fitToAllMarkers();
  });

  // Reset view button
  const resetViewBtn = document.getElementById('reset-view-btn');
  if (resetViewBtn) {
    resetViewBtn.addEventListener('click', () => {
      resetMapView();
    });
    console.log('[HEATMAP] Reset view button initialized');
  } else {
    console.warn('[HEATMAP] Reset view button not found in DOM');
  }

  // Heatmap intensity slider
  const intensitySlider = document.getElementById('heatmap-intensity');
  const intensityValue = document.getElementById('heatmap-intensity-value');
  intensitySlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    intensityValue.textContent = value.toFixed(1);
    if (heatmapViz) {
      heatmapViz.heatmapConfig.intensity = value;
      heatmapViz.hideHeatmap();
      heatmapViz.createHeatmapLayer();
      heatmapViz.showHeatmap();
    }
  });

  // Zoom threshold slider
  const zoomSlider = document.getElementById('zoom-threshold');
  const zoomValue = document.getElementById('zoom-threshold-value');
  zoomSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    zoomValue.textContent = value;
    // This can be used to control when markers appear
  });

    // Load categories and departments
    loadCategories();
    loadDepartments();
    
    // Setup auto-filtering immediately (checkboxes are already in HTML for status)
    setupAutoFiltering();
}

// Load categories
async function loadCategories() {
  try {
    const apiClientModule = await import('../../js/config/apiClient.js');
    const apiClient = apiClientModule.default;
    const { data } = await apiClient.get('/api/department-structure/categories');
    
    const group = document.getElementById('category-filter-group');
    const loading = document.getElementById('category-loading');
    if (loading) loading.remove();

    if (data && data.length > 0) {
      data.forEach(category => {
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 6px; font-weight: normal; padding: 2px 0;';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'category-checkbox';
        checkbox.value = category.id;
        
        // Add change listener for auto-filtering
        checkbox.addEventListener('change', () => {
          if (window.debounceFilterUpdate && window.applyFiltersAndUpdate) {
            window.debounceFilterUpdate(window.applyFiltersAndUpdate, 500);
          }
        });
        
        const text = document.createTextNode(`${category.icon || ''} ${category.name}`);
        label.appendChild(checkbox);
        label.appendChild(text);
        group.appendChild(label);
      });
    }
  } catch (error) {
    console.error('[HEATMAP] Failed to load categories:', error);
  } finally {
    // Reposition gear button after categories load (panel height might change)
    positionGearButton();
  }
}

// Get user's department code
async function getUserDepartment() {
  try {
    const apiClientModule = await import('../../js/config/apiClient.js');
    const apiClient = apiClientModule.default;
    const response = await apiClient.get('/api/user/role-info');
    if (response.success && response.data) {
      // Try multiple possible field names for department
      const department = response.data.department ||
                        response.data.dpt ||
                        response.data.metadata?.department ||
                        response.data.metadata?.dpt ||
                        response.data.raw_user_meta_data?.department ||
                        response.data.raw_user_meta_data?.dpt;
      if (department) {
        return department.toUpperCase();
      }
    }
  } catch (error) {
    console.warn('[HEATMAP] Failed to get user department:', error);
  }
  // Fallback: try Supabase session
  try {
    const { supabase } = await import('../../js/config/config.js');
    const { data: { session } } = await supabase.auth.getSession();
    const metadata = session?.user?.raw_user_meta_data || session?.user?.user_metadata || {};
    const department = metadata.department || metadata.dpt;
    if (department) {
      return department.toUpperCase();
    }
  } catch (error) {
    console.warn('[HEATMAP] Failed to get department from session:', error);
  }
  return null;
}

// Load departments
async function loadDepartments() {
  try {
    const group = document.getElementById('department-filter-group');
    const loading = document.getElementById('department-loading');
    if (loading) loading.remove();

    // Try using getActiveDepartments first (simpler endpoint)
    let departments = [];
    try {
      const { getActiveDepartments } = await import('../../js/utils/departmentUtils.js');
      departments = await getActiveDepartments();
    } catch (e) {
      console.warn('[HEATMAP] getActiveDepartments failed, trying getDepartments:', e);
      // Fallback to getDepartments
      const { getDepartments } = await import('../../js/utils/departmentUtils.js');
      departments = await getDepartments();
    }

    // If still empty, try direct API call
    if (!departments || departments.length === 0) {
      try {
        const response = await fetch('/api/departments/active');
        const result = await response.json();
        if (result.success && result.data) {
          departments = result.data;
        }
      } catch (e) {
        console.error('[HEATMAP] Direct API call failed:', e);
      }
    }

    // Get user's department and sort departments to put user's office first
    const userDepartmentCode = await getUserDepartment();
    if (userDepartmentCode && departments && departments.length > 0) {
      // Sort: user's department first, then others
      departments.sort((a, b) => {
        const aCode = (a.code || '').toUpperCase();
        const bCode = (b.code || '').toUpperCase();
        const aIsUserDept = aCode === userDepartmentCode;
        const bIsUserDept = bCode === userDepartmentCode;

        if (aIsUserDept && !bIsUserDept) return -1;
        if (!aIsUserDept && bIsUserDept) return 1;
        return 0; // Keep original order for non-matching items
      });
    }

    if (departments && departments.length > 0) {
      departments.forEach(dept => {
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 6px; font-weight: normal; padding: 2px 0;';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'department-checkbox';
        checkbox.value = dept.code || dept.id;
        
        // Add change listener for auto-filtering
        checkbox.addEventListener('change', () => {
          if (window.debounceFilterUpdate && window.applyFiltersAndUpdate) {
            window.debounceFilterUpdate(window.applyFiltersAndUpdate, 500);
          }
        });
        
        const deptName = dept.name || `Department ${dept.code || dept.id}`;
        const deptCode = dept.code ? `(${dept.code})` : '';
        // Highlight user's department with bold text
        const isUserDept = userDepartmentCode && (dept.code || '').toUpperCase() === userDepartmentCode;
        const text = document.createTextNode(`${deptName} ${deptCode}`);
        label.appendChild(checkbox);
        label.appendChild(text);
        if (isUserDept) {
          label.style.fontWeight = 'bold';
        }
        group.appendChild(label);
      });
      console.log(`[HEATMAP] Loaded ${departments.length} department(s) for filtering${userDepartmentCode ? ` (user's office: ${userDepartmentCode} at top)` : ''}`);
    } else {
      const noDeptMsg = document.createElement('div');
      noDeptMsg.textContent = 'No departments available';
      noDeptMsg.style.cssText = 'color: #999; font-style: italic; padding: 8px;';
      group.appendChild(noDeptMsg);
      console.warn('[HEATMAP] No departments loaded');
    }
  } catch (error) {
    console.error('[HEATMAP] Failed to load departments:', error);
    const group = document.getElementById('department-filter-group');
    const errorMsg = document.createElement('div');
    errorMsg.textContent = 'Error loading departments';
    errorMsg.style.cssText = 'color: #dc3545; padding: 8px;';
    group.appendChild(errorMsg);
  } finally {
    // Reposition gear button after departments load (panel height might change)
    positionGearButton();
  }
}

// Update statistics display
function updateStatistics() {
  if (!heatmapViz) return;

  const total = heatmapViz.complaintData ? heatmapViz.complaintData.length : 0;
  const visible = heatmapViz.markerLayer ? heatmapViz.markerLayer.getLayers().length : 0;

  document.getElementById('total-complaints-stat').textContent = total;
  document.getElementById('visible-markers-stat').textContent = visible;
  
  // Reposition gear button after stats update (panel height might change)
  positionGearButton();
}

// Reset map view to original center and zoom
function resetMapView() {
  if (!map) return;
  
  const originCenter = [6.854282, 125.318462]; // Digos City center
  const originZoom = 11;
  
  map.setView(originCenter, originZoom, { animate: true });
}

// Fit map to show all markers
// This adjusts the map view to show all visible complaint markers
function fitToAllMarkers() {
  if (!map || !heatmapViz || !heatmapViz.complaintData || heatmapViz.complaintData.length === 0) {
    return;
  }

  // If only one complaint, don't zoom in too close - just center on it with a reasonable zoom
  if (heatmapViz.complaintData.length === 1) {
    const complaint = heatmapViz.complaintData[0];
    map.setView([complaint.lat, complaint.lng], 14, { animate: false });
    return;
  }

  const bounds = L.latLngBounds();
  heatmapViz.complaintData.forEach(complaint => {
    bounds.extend([complaint.lat, complaint.lng]);
  });

  if (bounds.isValid()) {
    // Calculate the size of the bounds
    const northEast = bounds.getNorthEast();
    const southWest = bounds.getSouthWest();
    const latDiff = Math.abs(northEast.lat - southWest.lat);
    const lngDiff = Math.abs(northEast.lng - southWest.lng);
    
    // If bounds are too small (all complaints very close together), use minimum zoom
    if (latDiff < 0.01 && lngDiff < 0.01) {
      // All complaints are very close - center on them but don't zoom in too much
      const center = bounds.getCenter();
      map.setView([center.lat, center.lng], Math.min(map.getZoom(), 14), { animate: false });
    } else {
      // Multiple complaints spread out - fit to bounds with padding
      map.fitBounds(bounds, { 
        padding: [50, 50],
        maxZoom: 16 // Prevent zooming in too close even if complaints are clustered
      });
    }
  }
}

// Setup sidebar toggle
function setupSidebarToggle() {
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    
    // Ensure button is visible
    menuToggle.style.display = 'flex';
    menuToggle.style.visibility = 'visible';
    menuToggle.style.opacity = '1';
  } else {
    console.error('[SIDEBAR] Menu toggle or sidebar not found!', { menuToggle, sidebar });
  }
}

