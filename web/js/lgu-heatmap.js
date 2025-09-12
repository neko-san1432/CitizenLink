document.addEventListener("DOMContentLoaded", async () => {
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

  // Setup button event listeners
  setupButtonEventListeners();

  // Initialize analytics
  initializeAnalytics();

  // Wire UI controls for panels and fullscreen
  initializeLayoutControls();

  // Run initial clustering as part of map initialization/update flow
  updateHeatmap();
});

function initializeLayoutControls() {
  const leftPanel = document.getElementById("left-panel");
  const insightsPanel = document.getElementById("insights-panel");
  const mapCard = document.getElementById("map-card");
  const toggleFilters = document.getElementById("toggle-filters");
  const toggleInsights = document.getElementById("toggle-insights");
  const toggleFullscreen = document.getElementById("toggle-fullscreen");
  const closeLeft = document.getElementById("close-left-panel");
  const closeInsights = document.getElementById("close-insights");

  // Debounced layout refresh helper
  let _layoutRefreshTimer = null;
  function scheduleHeatmapLayoutRefresh(delay = 300) {
    const invalidateMapSize = () => {
      if (window.complaintMap) {
        window.complaintMap.invalidateSize();
        setTimeout(() => {
          window.complaintMap.invalidateSize();
        }, 60);

        if (typeof updateHeatmap === "function") updateHeatmap();
      }
    };
    if (_layoutRefreshTimer) clearTimeout(_layoutRefreshTimer);
    _layoutRefreshTimer = setTimeout(invalidateMapSize, delay);
  }

  const setButtonActive = (btn, isActive) => {
    if (!btn) return;

    btn.classList.toggle("active", !!isActive);
    btn.setAttribute("aria-pressed", !!isActive);
  };

  const isFs = () =>
    !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement
    );

  const syncActiveButtons = () => {
    setButtonActive(
      toggleFilters,
      !!(leftPanel && leftPanel.classList.contains("open"))
    );
    setButtonActive(
      toggleInsights,
      !!(insightsPanel && insightsPanel.classList.contains("open"))
    );
    setButtonActive(toggleFullscreen, isFs());
  };

  if (toggleFilters && leftPanel) {
    toggleFilters.addEventListener("click", (e) => {
      e.preventDefault();
      leftPanel.classList.toggle("open");
      if (insightsPanel) insightsPanel.classList.remove("open");
      setButtonActive(toggleFilters, leftPanel.classList.contains("open"));
      setButtonActive(toggleInsights, false);
      scheduleHeatmapLayoutRefresh();
    });
  }
  if (toggleInsights && insightsPanel) {
    toggleInsights.addEventListener("click", (e) => {
      e.preventDefault();
      insightsPanel.classList.toggle("open");
      if (leftPanel) leftPanel.classList.remove("open");
      setButtonActive(toggleInsights, insightsPanel.classList.contains("open"));
      setButtonActive(toggleFilters, false);
      scheduleHeatmapLayoutRefresh();
    });
  }
  if (closeLeft && leftPanel) {
    closeLeft.addEventListener("click", () => {
      leftPanel.classList.remove("open");
      setButtonActive(toggleFilters, false);
      scheduleHeatmapLayoutRefresh();
    });
  }
  if (closeInsights && insightsPanel) {
    closeInsights.addEventListener("click", () => {
      insightsPanel.classList.remove("open");
      setButtonActive(toggleInsights, false);
      scheduleHeatmapLayoutRefresh();
    });
  }
  // Fullscreen helpers using the Fullscreen API
  const enterFullscreen = (element) => {
    if (element.requestFullscreen) return element.requestFullscreen();
    if (element.webkitRequestFullscreen)
      return element.webkitRequestFullscreen();
    if (element.msRequestFullscreen) return element.msRequestFullscreen();
  };
  const exitFullscreen = () => {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (document.msExitFullscreen) return document.msExitFullscreen();
  };

  if (toggleFullscreen && mapCard) {
    toggleFullscreen.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!isFs()) {
        mapCard.classList.add("map-fullscreen");
        await enterFullscreen(mapCard);
      } else {
        await exitFullscreen();
        mapCard.classList.remove("map-fullscreen");
      }
      const i = toggleFullscreen.querySelector("i");
      if (i) i.className = isFs() ? "fas fa-compress" : "fas fa-expand";
      setButtonActive(toggleFullscreen, isFs());
      scheduleHeatmapLayoutRefresh(80);
    });

    // Sync UI when user exits via Esc
    document.addEventListener("fullscreenchange", () => {
      if (!isFs()) mapCard.classList.remove("map-fullscreen");
      const i = toggleFullscreen.querySelector("i");
      if (i) i.className = isFs() ? "fas fa-compress" : "fas fa-expand";
      setButtonActive(toggleFullscreen, isFs());
      scheduleHeatmapLayoutRefresh(80);
    });
  }

  // Close panels and clear active state when clicking outside
  document.addEventListener("click", (evt) => {
    const fc = document.querySelector(".floating-controls");
    const clickedInsideControls = fc && fc.contains(evt.target);
    const clickedInsidePanels =
      (leftPanel && leftPanel.contains(evt.target)) ||
      (insightsPanel && insightsPanel.contains(evt.target));
    if (!clickedInsideControls && !clickedInsidePanels) {
      if (leftPanel) leftPanel.classList.remove("open");
      if (insightsPanel) insightsPanel.classList.remove("open");
      setButtonActive(toggleFilters, false);
      setButtonActive(toggleInsights, false);
    }
  });
  syncActiveButtons();
}
async function checkAuth() {
  try {
    if (window.checkAuth && window.checkAuth !== checkAuth) {
      return await window.checkAuth();
    }
    const stored = sessionStorage.getItem("user");
    if (!stored) return null;
    const user = JSON.parse(stored);
    if (!user || !user.id) return null;
    const role = String(user.role || user.type || "").toLowerCase();
    const isLgu =
      role === "lgu" ||
      role === "admin" ||
      role.startsWith("lgu-") ||
      role.startsWith("lgu_admin") ||
      role.startsWith("lgu-admin");
    if (!isLgu) return null;
    return { username: user.email, role, type: user.type || user.role };
  } catch (error) {
    console.error("Error checking auth:", error);
    return null;
  }
}

// Initialize map (idempotent)
async function initializeMap() {
  try {
    if (window.complaintMap) {
      window.complaintMap.invalidateSize();

      return;
    }
    // Ensure map container exists and has dimensions
    const mapContainer = document.getElementById("complaint-map");
    if (!mapContainer) {
      console.error("Map container not found");
      return;
    }

    // Check if container has dimensions
    const rect = mapContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setTimeout(() => initializeMap(), 100);
      return;
    }

    // Ensure container is visible and has proper dimensions
    if (rect.width < 100 || rect.height < 100) {
      setTimeout(() => initializeMap(), 200);
      return;
    }

    // Create map centered on Digos City, Philippines (based on the image coordinates)
    // Move zoom control away from sidebar (to top-right)
    const map = L.map("complaint-map", {
      zoomControl: false,
      preferCanvas: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
      worldCopyJump: false, // Prevent map from jumping to other world copies
      minZoom: 11.5, // Set reasonable minimum zoom
      maxZoom: 18,
    }).setView([6.75, 125.35], 11.5); // Start with a reasonable zoom level
    console.log("🗺️ Map initialized with zoom:", map.getZoom());
    console.log("📍 Initial map center:", map.getCenter());
    console.log("📏 Initial map bounds:", map.getBounds());
    // Expose globally
    window.complaintMap = map;

    // Define panes to enforce layer order

    // Map tiles use default tile pane (~200)
    if (!map.getPane("heatmap-pane")) {
      map.createPane("heatmap-pane");
      map.getPane("heatmap-pane").style.zIndex = 400; // above boundaries (350)
      map.getPane("heatmap-pane").style.pointerEvents = "none";
      console.log(
        "Heatmap pane created with z-index:",
        map.getPane("heatmap-pane").style.zIndex
      );
    }
    if (!map.getPane("brgy-pane")) {
      map.createPane("brgy-pane");
      map.getPane("brgy-pane").style.zIndex = 201; // align with boundary-pane
      map.getPane("brgy-pane").style.pointerEvents = "none";
    }
    if (!map.getPane("boundary-pane")) {
      map.createPane("boundary-pane");
      map.getPane("boundary-pane").style.zIndex = 200; // above heatmap, below markers
      map.getPane("boundary-pane").style.pointerEvents = "none";
    }
    if (!map.getPane("markers-pane")) {
      map.createPane("markers-pane");
      map.getPane("markers-pane").style.zIndex = 700; // above boundaries and mask
    }
    // Controls/popups/tooltips are Leaflet panes; ensure CSS z-index

    // Ensure proper map sizing on initialization (multiple passes)
    const safeInvalidate = () => {
      map.invalidateSize();
    };
    setTimeout(safeInvalidate, 50);
    setTimeout(safeInvalidate, 150);
    setTimeout(safeInvalidate, 300);

    // Observe container size changes to keep Leaflet in sync

    const containerEl = document.getElementById("complaint-map");
    if (containerEl && window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        safeInvalidate();
      });
      ro.observe(containerEl);
      // keep reference to prevent GC
      window._heatmapResizeObserver = ro;
    }

    // Base layers (themes)
    const baseLayers = {
      Standard: L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: "© OpenStreetMap",
        }
      ),
      "Standard Dark": L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: "© OpenStreetMap © CARTO",
        }
      ),
      Terrain: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenTopoMap",
      }),
      Satellite: L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "© Esri",
        }
      ),
    };
    baseLayers["Standard"].addTo(map);

    // Add zoom control to top-left
    L.control.zoom({ position: "topleft" }).addTo(map);
    // Add combined legend and intensity controls to the top-right
    addCombinedControls(map);

    // Mount our custom floating controls as a Leaflet control so it stacks with others
    const controlsEl = document.querySelector(
      "#complaint-map .floating-controls"
    );
    if (controlsEl) {
      const FloatingControls = L.Control.extend({
        options: { position: "bottomright" },
        onAdd: function () {
          return controlsEl;
        },
      });
      new FloatingControls().addTo(map);
    }

    // One-time cached load of barangay data
    if (!window._brgyData) {
      const respOnce = await fetch("/lgu/brgy_boundaries_locatlon.json");
      if (respOnce.ok) {
        window._brgyData = await respOnce.json();
      }
    }

    if (!map.getPane("brgy-pane")) {
      map.createPane("brgy-pane");
      const bp = map.getPane("brgy-pane");
      bp.style.zIndex = 401; // above overlays(400) so hover is reliable
      bp.style.pointerEvents = "auto";
    }

    // A) If a global GeoJSON variable is provided elsewhere
    if (typeof window.json_BarangayClassification_4 !== "undefined") {
      // Store brgyLayer for data processing but don't add to map (we'll use combinedBoundary instead)
      const brgyLayer = L.geoJSON(window.json_BarangayClassification_4);
      window.brgyLayer = brgyLayer;

      window._brgyPolygons = window._brgyPolygons || [];
      brgyLayer.eachLayer((layer) => {
        const name =
          (layer &&
            layer.feature &&
            (layer.feature.properties?.name ||
              layer.feature.properties?.barangay ||
              layer.feature.properties?.Name)) ||
          "Barangay";
        const latlngs = layer.getLatLngs();
        window._brgyPolygons.push({ name, latlngs });
      });
    } else {
      // B) Load from cached barangay boundaries JSON (array of { name, geojson })

      const data = window._brgyData;
      if (Array.isArray(data)) {
        const polygons = [];
        // Process barangay data for location name lookup (not for display)
        window._brgyPolygons = window._brgyPolygons || [];
        data.forEach((entry) => {
          if (!entry || !entry.geojson || !entry.geojson.coordinates) return;
          const name = entry.name || "Barangay";
          const gj = entry.geojson;

          // Coordinates in our files are [lat, lon]; build Leaflet polygons for data only
          if (gj.type === "Polygon") {
            const rings = gj.coordinates.map((ring) =>
              ring.map((coord) => [coord[0], coord[1]])
            );
            const poly = L.polygon(rings);

            window._brgyPolygons.push({
              name,
              latlngs: poly.getLatLngs(),
            });
          } else if (gj.type === "MultiPolygon") {
            const multi = gj.coordinates.map((polygon) =>
              polygon.map((ring) => ring.map((coord) => [coord[0], coord[1]]))
            );
            const poly = L.polygon(multi);

            window._brgyPolygons.push({
              name,
              latlngs: poly.getLatLngs(),
            });
          }
        });
      }
    }

    const data = window._brgyData || [];

    if (data && Array.isArray(data) && data.length > 0) {
      // Create a combined boundary from all barangay boundaries
      const allCoordinates = [];
      data.forEach((entry) => {
        if (entry.geojson && entry.geojson.coordinates) {
          if (entry.geojson.type === "Polygon") {
            allCoordinates.push(entry.geojson.coordinates[0]);
          } else if (entry.geojson.type === "MultiPolygon") {
            entry.geojson.coordinates.forEach((polygon) => {
              allCoordinates.push(polygon[0]);
            });
          }
        }
      });

      if (allCoordinates.length > 0) {
        // Create a combined boundary polygon from all barangay coordinates
        const combinedBoundary = L.polygon(allCoordinates, {
          color: "#2563eb", // Blue border
          weight: 1, // Border thickness
          opacity: 0.8, // Border opacity
          fillColor: "#2563eb", // Fill color
          fillOpacity: 0, // Very transparent fill
          zIndex: 200,
        }).setStyle({ pane: "boundary-pane" });

        // Add boundary to map
        combinedBoundary.addTo(map);

        // Fit and restrict map to the combined boundary bounds
        const bounds = combinedBoundary.getBounds();
        console.log("Boundary bounds:", bounds);
        
        // Fit as tightly as possible after layout stabilizes
        const applyTightFit = () => {
          try {
            map.invalidateSize();
            // Fit bounds with some padding for better view
            map.fitBounds(bounds, { 
              padding: [20, 20], // Add some padding around the boundary
              animate: false 
            });
            
            // Set max bounds to prevent panning outside the city area
            const paddedBounds = bounds.pad(0.05); // 5% padding
            map.setMaxBounds(paddedBounds);
            
            // Set minimum zoom based on the boundary size
            const currentZoom = map.getZoom();
            const minZoomForBoundary = Math.max(10, currentZoom - 2); // Don't go too far out
            map.options.minZoom = minZoomForBoundary;
            
            console.log("🎯 Map fitted to bounds:");
            console.log(`   Current zoom: ${currentZoom}`);
            console.log(`   Min zoom set to: ${minZoomForBoundary}`);
            console.log(`   Max bounds: ${paddedBounds}`);
            console.log(`   Map center: ${map.getCenter()}`);
          } catch (error) {
            console.error("Error fitting map to bounds:", error);
          }
        };
        
        // Run now and after a tick
        applyTightFit();
        setTimeout(applyTightFit, 50);
        // Also refit on resize
        map.on("resize", applyTightFit);

        // Create a clean mask to hide everything outside the boundary
        // Use a dedicated pane to avoid tile seam artifacts
        try {
          // Boundary pane already created in initializeMap
          if (!map.getPane("mask-pane")) {
            map.createPane("mask-pane");
            const mp = map.getPane("mask-pane");
            mp.style.zIndex = 202; // keep mask below heatmap/boundaries/markers
            mp.style.pointerEvents = "none"; // don't block map interactions
          }
          const world = [
            [90, -360],
            [90, 360],
            [-90, 360],
            [-90, -360],
          ];
          const maskCoords = [world, ...allCoordinates];
          const mask = L.polygon(maskCoords, {
            pane: "mask-pane",
            stroke: false,
            fillColor: "#ffffff",
            fillOpacity: 1,
            interactive: false,
            zIndex: 200,
          });
          mask.addTo(map);
          // Keep boundary on top
          // combinedBoundary.bringToFront();
        } catch (_) {}
        // Store boundary reference for toggle functionality
        window.boundaryLayer = combinedBoundary;
        
        // Set fallback bounds if boundary loading fails
        const fallbackBounds = L.latLngBounds(
          L.latLng(6.5, 125.0),
          L.latLng(7.0, 125.7)
        );
        
        // Ensure map has reasonable bounds even if boundary fails
        setTimeout(() => {
          if (!map.getBounds().isValid() || map.getBounds().getNorthEast().equals(map.getBounds().getSouthWest())) {
            console.log("Setting fallback bounds for map");
            map.fitBounds(fallbackBounds, { padding: [20, 20] });
            map.setMaxBounds(fallbackBounds.pad(0.1));
            map.options.minZoom = 10;
          }
        }, 2000);

      }
    }

    // Get complaints data from backend API
    const complaints = await fetchComplaints();

    // Filter complaints that have coordinates and are inside the city boundary
    const complaintsWithCoordinates = complaints.filter(
      (complaint) => complaint.latitude && complaint.longitude
    );

    // Filter complaints to only show those inside the city boundary
    const complaintsInsideBoundary = filterComplaintsInsideBoundary(
      complaintsWithCoordinates,
      window.boundaryLayer
    );

    if (complaintsInsideBoundary.length === 0) {
      // Show "No complaints inside city boundary" message
      const noDataMessage = document.createElement("div");
      noDataMessage.className = "no-data-message";
      noDataMessage.innerHTML = `
        <div class="text-center py-5">
          <i class="fas fa-map-marker-alt fa-4x text-muted mb-4"></i>
          <h3 class="text-muted">No complaints inside city boundary</h3>
          <p class="text-muted mb-4">All complaints with coordinates are outside the LGU jurisdiction area.</p>
          <p class="text-muted">Only complaints within Digos City boundaries are displayed.</p>
        </div>
      `;

      const mapContainer = document.getElementById("complaint-map");
      if (mapContainer) {
        mapContainer.appendChild(noDataMessage);
      }
      return;
    }

    // Create heatmap data from complaints inside boundary
    const heatmapData = complaintsInsideBoundary.map((complaint) => [
      parseFloat(complaint.latitude),
      parseFloat(complaint.longitude),
      getComplaintWeight(complaint),
    ]);

    // Add heatmap layer with enhanced visualization
    // Ensure map is properly initialized before creating heatmap
    if (map.getSize && map.getSize().x > 0) {
      const heat = L.heatLayer(heatmapData, {
        pane: "heatmap-pane",
        radius: 40, // Increased radius for better coverage
        blur: 25, // Increased blur for smoother gradients
        maxZoom: 16, // Increased max zoom for better detail
        minOpacity: 0.1, // Minimum opacity for subtle areas
        max: 1.0, // Maximum intensity
        gradient: {
          0.0: "rgba(0, 0, 255, 0)", // Transparent blue for low intensity
          0.2: "rgba(0, 255, 255, 0.3)", // Cyan for low-medium
          0.4: "rgba(0, 255, 0, 0.5)", // Green for medium
          0.6: "rgba(255, 255, 0, 0.7)", // Yellow for medium-high
          0.8: "rgba(255, 165, 0, 0.8)", // Orange for high
          1.0: "rgba(255, 0, 0, 1.0)", // Red for very high
        },
      });

      // Add heatmap to map with error handling
      try {
        heat.addTo(map);
        window.heatLayer = heat;
      } catch (error) {
        console.warn("Failed to add heatmap layer:", error);
        setTimeout(() => {
          try {
            heat.addTo(map);
            window.heatLayer = heat;
          } catch (retryError) {
            console.error("Failed to add heatmap layer on retry:", retryError);
          }
        }, 100);
      }
    } else {
      console.warn("Map not properly sized, delaying heatmap creation");
      // Retry heatmap creation after map is properly sized
      setTimeout(() => {
        try {
          map.invalidateSize();
          if (map.getSize && map.getSize().x > 0) {
            const heat = L.heatLayer(heatmapData, {
              pane: "heatmap-pane",
              radius: 40,
              blur: 25,
              maxZoom: 16,
              minOpacity: 0.1,
              max: 1.0,
              gradient: {
                0.0: "rgba(0, 0, 255, 0)",
                0.2: "rgba(0, 255, 255, 0.3)",
                0.4: "rgba(0, 255, 0, 0.5)",
                0.6: "rgba(255, 255, 0, 0.7)",
                0.8: "rgba(255, 165, 0, 0.8)",
                1.0: "rgba(255, 0, 0, 1.0)",
              },
            });
            heat.addTo(map);
            window.heatLayer = heat;
          }
        } catch (error) {
          console.error("Failed to create heatmap layer on retry:", error);
        }
      }, 200);
    }
    // Ensure map size is correct after load
    setTimeout(() => {
      map.invalidateSize();
      // Additional size validation
      setTimeout(() => {
        map.invalidateSize();
        // Force map to use full container height
        const mapContainer = document.getElementById("complaint-map");
        if (mapContainer) {
          mapContainer.style.height = "100%";
        }
      }, 200);
    }, 100);

    // Prepare markers (we will add/remove them as a layer based on zoom level)
    const complaintMarkers = [];
    complaintsInsideBoundary.forEach((complaint) => {
      const marker = createComplaintMarker(complaint);
      complaintMarkers.push(marker);
    });
    const markerLayer = L.layerGroup(complaintMarkers);
    window.markerLayer = markerLayer;

    // Add/remove marker layer based on zoom level
    const MARKER_VISIBILITY_ZOOM = 14; // Set above default zoom level to show heatmap by default
    const applyMarkerLayerVisibility = () => {
      const currentZoom = map.getZoom();
      const shouldShowMarkers = currentZoom >= MARKER_VISIBILITY_ZOOM;
      const currentMarkerLayer = window.markerLayer;
      const markersOnMap = currentMarkerLayer
        ? map.hasLayer(currentMarkerLayer)
        : false;
      const heatOnMap = window.heatLayer && map.hasLayer(window.heatLayer);

      console.log("🎯 Marker visibility check:");
      console.log(`   Current zoom: ${currentZoom}`);
      console.log(`   Marker visibility threshold: ${MARKER_VISIBILITY_ZOOM}`);
      console.log(`   Should show markers: ${shouldShowMarkers}`);
      console.log(`   Markers currently on map: ${markersOnMap}`);
      console.log(`   Heatmap exists: ${!!window.heatLayer}`);
      console.log(`   Heatmap on map: ${heatOnMap}`);

      if (shouldShowMarkers) {
        if (!markersOnMap && currentMarkerLayer) {
          console.log("➕ Adding markers to map (zoom level reached threshold)");
          currentMarkerLayer.addTo(map);
        }
        // Hide heatmap when showing markers
        if (heatOnMap) {
          console.log("🔥 Hiding heatmap (showing markers instead)");
          map.removeLayer(window.heatLayer);
        }
      } else {
        if (markersOnMap && currentMarkerLayer) {
          console.log("➖ Removing markers from map (zoom level below threshold)");
          map.removeLayer(currentMarkerLayer);
        }
        // Show heatmap when zoomed out
        if (window.heatLayer && !heatOnMap) {
          console.log("🔥 Adding heatmap to map (zoom level below threshold)");
          window.heatLayer.addTo(map);
        } else if (!window.heatLayer) {
          console.log("⚠️ No heatmap layer available");
        }
      }
    };
    // Apply initial state
    applyMarkerLayerVisibility();

    // Show/hide marker layer on zoom
    map.on("zoomend", applyMarkerLayerVisibility);
    
    // Add zoom debugging
    map.on("zoomstart", () => {
      console.log("🔄 Zoom started - Current zoom:", map.getZoom());
    });
    
    map.on("zoomend", () => {
      const currentZoom = map.getZoom();
      const bounds = map.getBounds();
      console.log("✅ Zoom ended - Current zoom:", currentZoom);
      console.log("📍 Map bounds:", {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      });
      console.log("🎯 Map center:", map.getCenter());
    });
    
    map.on("zoom", () => {
      console.log("🔍 Zooming - Current zoom:", map.getZoom());
    });

    // Add window resize listener to handle size changes
    window.addEventListener("resize", () => {
      setTimeout(() => {
        map.invalidateSize();
        // Force map container to full height
        const mapContainer = document.getElementById("complaint-map");
        const mapCard = document.querySelector(".map-card");
        const dashboardMain = document.querySelector(".dashboard-main");
        
        if (mapContainer && dashboardMain) {
          const availableHeight = window.innerHeight - 80; // Subtract header height
          mapContainer.style.height = `${availableHeight}px`;
          mapCard.style.height = `${availableHeight}px`;
          dashboardMain.style.height = `${availableHeight}px`;
          map.invalidateSize();
        }
      }, 100);
    });

    // Force resize on page load
    window.addEventListener("load", () => {
      setTimeout(() => {
        map.invalidateSize();
        const mapContainer = document.getElementById("complaint-map");
        if (mapContainer) {
          mapContainer.style.height = "100%";
          console.log("Map container height set to 100%");
          console.log("Map container computed height:", window.getComputedStyle(mapContainer).height);
          console.log("Map container offset height:", mapContainer.offsetHeight);
          console.log("Map container client height:", mapContainer.clientHeight);
        }
      }, 500);
    });

    // Debug map dimensions and force height
    setTimeout(() => {
      const mapContainer = document.getElementById("complaint-map");
      const mapCard = document.querySelector(".map-card");
      const dashboardMain = document.querySelector(".dashboard-main");
      
      console.log("=== MAP DIMENSION DEBUG ===");
      console.log("Dashboard main height:", dashboardMain?.offsetHeight);
      console.log("Map card height:", mapCard?.offsetHeight);
      console.log("Map container height:", mapContainer?.offsetHeight);
      console.log("Map container computed height:", mapContainer ? window.getComputedStyle(mapContainer).height : "N/A");
      console.log("Viewport height:", window.innerHeight);
      console.log("Document height:", document.documentElement.scrollHeight);
      
      // Force map to use viewport height minus header
      if (mapContainer && dashboardMain) {
        const availableHeight = window.innerHeight - 80; // Subtract header height
        mapContainer.style.height = `${availableHeight}px`;
        mapCard.style.height = `${availableHeight}px`;
        dashboardMain.style.height = `${availableHeight}px`;
        console.log("Forced map height to:", availableHeight + "px");
        map.invalidateSize();
      }
    }, 1000);

    // Store map reference globally for filter updates
    window.complaintMap = map;
    window.complaintMarkers = complaintMarkers;
    window.heatLayer = window.heatLayer || null; // Keep existing heatLayer if it exists
    window.complaintsInsideBoundary = complaintsInsideBoundary;
    window.markerLayer = markerLayer;

    // Update layer control with the newly created marker layer
    if (window.layersControl && markerLayer) {
      // Remove existing Complaints layer if it exists
      if (window.layersControl._overlays && window.layersControl._overlays.Complaints) {
        try {
          window.layersControl.removeLayer(window.layersControl._overlays.Complaints);
          console.log("🗑️ Removed existing Complaints layer from control");
        } catch (error) {
          console.log("⚠️ Error removing existing Complaints layer:", error);
        }
      }
      
      // Add the new Complaints layer
      window.layersControl.addOverlay(markerLayer, "Complaints");
      console.log("➕ Added Complaints layer to control");
    }

    // Ensure map is properly initialized
    setTimeout(() => {
      if (window.complaintMap && window.complaintMap.getSize) {
        const size = window.complaintMap.getSize();
        if (size.x === 0 || size.y === 0) {
          console.warn("Map size is zero, invalidating...");
          window.complaintMap.invalidateSize();
        }
      }
    }, 500);

    // Add map controls
    addMapControls(map);

    // Update analytics/statistics with the currently displayed complaints

    updateStatistics(complaintsInsideBoundary);
  } catch (error) {
    console.error("Error initializing map:", error);

    // Show error message
    const errorMessage = document.createElement("div");
    errorMessage.className = "error-message";
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

    const mapContainer = document.getElementById("complaint-map");
    if (mapContainer) {
      mapContainer.appendChild(errorMessage);
    }
  }
}

// Add map controls for better user experience
function addMapControls(map) {
  // Add fullscreen control

  if (L.control && L.control.fullscreen) {
    const fullscreenControl = L.control.fullscreen({
      position: "topright",
      title: "Toggle Fullscreen",
      titleCancel: "Exit Fullscreen",
      content: '<i class="fas fa-expand"></i>',
    });
    fullscreenControl.addTo(map);
  }

  // Add measure control

  if (L.control && L.control.measure) {
    const measureControl = L.control.measure({
      position: "topright",
      primaryLengthUnit: "meters",
      secondaryLengthUnit: "kilometers",
      primaryAreaUnit: "sqmeters",
      secondaryAreaUnit: "acres",
      localization: "en",
      decPoint: ".",
      thousandsSep: ",",
    });
    measureControl.addTo(map);
  }

  // Add layer control
  const mapboxToken = (
    window.MAPBOX_TOKEN ||
    localStorage.getItem("MAPBOX_TOKEN") ||
    ""
  ).trim();
  const baseMaps = {
    "Standard Light": mapboxToken
      ? L.tileLayer(
          `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}?access_token=${mapboxToken}`,
          {
            attribution: "© Mapbox © OpenStreetMap",
            tileSize: 256,
          }
        )
      : L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
          { attribution: "© OpenStreetMap © CARTO" }
        ),
    "Standard Dark": mapboxToken
      ? L.tileLayer(
          `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}?access_token=${mapboxToken}`,
          {
            attribution: "© Mapbox © OpenStreetMap",
            tileSize: 256,
          }
        )
      : L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          { attribution: "© OpenStreetMap © CARTO" }
        ),
    OpenStreetMap: L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    ),
    Satellite: L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
    ),
    Terrain: L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"),
  };

  const overlayMaps = {
    Heatmap: window.heatLayer || L.layerGroup([]),
  };
  // Add boundary overlay if available
  if (window.boundaryLayer) {
    overlayMaps["Boundary"] = window.boundaryLayer;
  }

  const layersControl = L.control
    .layers(baseMaps, overlayMaps, { position: "topleft" })
    .addTo(map);
  
  // Store layer control reference globally for later updates
  window.layersControl = layersControl;
  const setMapThemeBackground = (layerOrName) => {
    let isDark = false;
    if (
      layerOrName &&
      typeof layerOrName === "object" &&
      layerOrName.getAttribution
    ) {
      isDark = layerOrName === baseMaps["Standard Dark"];
    } else {
      const name = String(layerOrName || "").toLowerCase();
      isDark = name.includes("dark");
    }
    document.body.classList.toggle("map-dark", !!isDark);
  };
  // Initialize based on which base layer is currently on the map
  const currentBaseKey = Object.keys(baseMaps).find((k) =>
    map.hasLayer(baseMaps[k])
  );
  setMapThemeBackground(currentBaseKey || "");
  map.on("baselayerchange", (e) =>
    setMapThemeBackground(e && (e.layer || e.name))
  );
}

// Add combined legend and intensity controls horizontally
function addCombinedControls(map) {
  const combinedControl = L.control({ position: "topright" });

  combinedControl.onAdd = function () {
    const div = L.DomUtil.create("div", "heatmap-controls-group");
    div.style.display = "flex";
    div.style.flexDirection = "row";
    div.style.gap = "15px";
    div.style.alignItems = "flex-start";

    // Add status legend
    const legendDiv = L.DomUtil.create("div", "heatmap-legend");
    legendDiv.innerHTML = `
      <div class="legend-title">Complaint Status</div>
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
        <div style="width:12px; height:12px; background:#ffc107; border-radius:50%;"></div>
        <span>Pending</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
        <div style="width:12px; height:12px; background:#007bff; border-radius:50%;"></div>
        <span>In Progress</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
        <div style="width:12px; height:12px; background:#28a745; border-radius:50%;"></div>
        <span>Resolved</span>
      </div>
      <div class="legend-title">Heatmap Intensity</div>
      <div class="legend-gradient"></div>
      <div class="legend-labels">
        <span>Low</span>
        <span>High</span>
      </div>
    `;

    // Add intensity control
    const intensityDiv = L.DomUtil.create("div", "heatmap-intensity-control");
    intensityDiv.style.background = "white";
    intensityDiv.style.padding = "10px";
    intensityDiv.style.borderRadius = "6px";
    intensityDiv.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    intensityDiv.style.fontSize = "12px";
    intensityDiv.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; color: #333;">Heatmap Intensity</div>
      <div style="margin-bottom: 8px;">
        <label>Radius: <span id="radius-value">40</span>px</label>
        <input type="range" id="radius-slider" min="10" max="100" value="40" style="width: 100%; margin-top: 4px;">
      </div>
      <div style="margin-bottom: 8px;">
        <label>Blur: <span id="blur-value">25</span>px</label>
        <input type="range" id="blur-slider" min="5" max="50" value="25" style="width: 100%; margin-top: 4px;">
      </div>
      <div style="margin-bottom: 8px;">
        <label>Opacity: <span id="opacity-value">0.8</span></label>
        <input type="range" id="opacity-slider" min="0.1" max="1" step="0.1" value="0.8" style="width: 100%; margin-top: 4px;">
      </div>
      <div>
        <input type="number" id="intensity-input" placeholder="Custom intensity" style="width: 100%; padding: 4px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px;">
      </div>
    `;

    // Add event listeners for intensity control
    const radiusSlider = intensityDiv.querySelector("#radius-slider");
    const blurSlider = intensityDiv.querySelector("#blur-slider");
    const opacitySlider = intensityDiv.querySelector("#opacity-slider");
    const intensityInput = intensityDiv.querySelector("#intensity-input");

    const updateHeatmapSettings = () => {
      if (window.heatLayer && window.complaintMap) {
        if (
          window.complaintMap.getSize &&
          window.complaintMap.getSize().x > 0
        ) {
          const radius = parseInt(radiusSlider.value);
          const blur = parseInt(blurSlider.value);
          const opacity = parseFloat(opacitySlider.value);

          const gradient = {
            0.0: `rgba(0, 0, 255, ${opacity * 0.1})`,
            0.2: `rgba(0, 255, 255, ${opacity * 0.3})`,
            0.4: `rgba(0, 255, 0, ${opacity * 0.5})`,
            0.6: `rgba(255, 255, 0, ${opacity * 0.7})`,
            0.8: `rgba(255, 165, 0, ${opacity * 0.9})`,
            1.0: `rgba(255, 0, 0, ${opacity})`,
          };

          window.heatLayer.setOptions({
            radius: radius,
            blur: blur,
            gradient: gradient,
          });
        } else {
          setTimeout(() => {
            const radius = parseInt(radiusSlider.value);
            const blur = parseInt(blurSlider.value);
            const opacity = parseFloat(opacitySlider.value);

            const gradient = {
              0.0: `rgba(0, 0, 255, ${opacity * 0.1})`,
              0.2: `rgba(0, 255, 255, ${opacity * 0.3})`,
              0.4: `rgba(0, 255, 0, ${opacity * 0.5})`,
              0.6: `rgba(255, 255, 0, ${opacity * 0.7})`,
              0.8: `rgba(255, 165, 0, ${opacity * 0.9})`,
              1.0: `rgba(255, 0, 0, ${opacity})`,
            };

            window.heatLayer.setOptions({
              radius: radius,
              blur: blur,
              gradient: gradient,
            });
          }, 100);
        }
      }
    };

    radiusSlider.addEventListener("input", () => {
      intensityDiv.querySelector("#radius-value").textContent =
        radiusSlider.value;
      updateHeatmapSettings();
    });

    blurSlider.addEventListener("input", () => {
      intensityDiv.querySelector("#blur-value").textContent = blurSlider.value;
      updateHeatmapSettings();
    });

    opacitySlider.addEventListener("input", () => {
      intensityDiv.querySelector("#opacity-value").textContent =
        opacitySlider.value;
      updateHeatmapSettings();
    });

    intensityInput.addEventListener("change", () => {
      const value = parseFloat(intensityInput.value);
      if (!isNaN(value) && value > 0) {
        radiusSlider.value = Math.min(100, Math.max(10, value));
        intensityDiv.querySelector("#radius-value").textContent =
          radiusSlider.value;
        updateHeatmapSettings();
      }
    });

    div.appendChild(legendDiv);
    div.appendChild(intensityDiv);

    return div;
  };

  combinedControl.addTo(map);
}

// Add heatmap intensity control
function addHeatmapIntensityControl(map) {
  const intensityControl = L.control({ position: "topright" });

  intensityControl.onAdd = function () {
    const div = L.DomUtil.create("div", "heatmap-intensity-control");
    div.style.background = "white";
    div.style.padding = "10px";
    div.style.borderRadius = "6px";
    div.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    div.style.fontSize = "12px";
    div.style.lineHeight = "1.2";
    div.style.minWidth = "200px";

    div.innerHTML = `
      <div style="font-weight:600; margin-bottom:8px;">Heatmap Intensity</div>
      <div style="margin-bottom:8px;">
        <label for="intensity-slider" style="display:block; margin-bottom:4px;">Radius: <span id="radius-value">40</span>px</label>
        <input type="range" id="intensity-slider" min="10" max="80" value="40" style="width:100%;">
      </div>
      <div style="margin-bottom:8px;">
        <label for="blur-slider" style="display:block; margin-bottom:4px;">Blur: <span id="blur-value">25</span>px</label>
        <input type="range" id="blur-slider" min="5" max="50" value="25" style="width:100%;">
      </div>
      <div style="margin-bottom:8px;">
        <label for="opacity-slider" style="display:block; margin-bottom:4px;">Opacity: <span id="opacity-value">0.8</span></label>
        <input type="range" id="opacity-slider" min="0.1" max="1.0" step="0.1" value="0.8" style="width:100%;">
      </div>
      <button id="reset-intensity" class="btn btn-sm btn-outline-secondary" style="width:100%; font-size:11px;">Reset to Default</button>
    `;

    // Add event listeners
    const radiusSlider = div.querySelector("#intensity-slider");
    const blurSlider = div.querySelector("#blur-slider");
    const opacitySlider = div.querySelector("#opacity-slider");
    const resetBtn = div.querySelector("#reset-intensity");

    const updateHeatmapSettings = () => {
      if (window.heatLayer && window.complaintMap) {
        try {
          // Ensure map is properly sized before updating
          if (
            window.complaintMap.getSize &&
            window.complaintMap.getSize().x > 0
          ) {
            const radius = parseInt(radiusSlider.value);
            const blur = parseInt(blurSlider.value);
            const opacity = parseFloat(opacitySlider.value);

            // Update gradient with new opacity
            const gradient = {
              0.0: `rgba(0, 0, 255, ${opacity * 0})`,
              0.2: `rgba(0, 255, 255, ${opacity * 0.3})`,
              0.4: `rgba(0, 255, 0, ${opacity * 0.5})`,
              0.6: `rgba(255, 255, 0, ${opacity * 0.7})`,
              0.8: `rgba(255, 165, 0, ${opacity * 0.8})`,
              1.0: `rgba(255, 0, 0, ${opacity})`,
            };

            window.heatLayer.setOptions({
              radius: radius,
              blur: blur,
              gradient: gradient,
            });
          } else {
            // If map is not properly sized, invalidate and retry
            window.complaintMap.invalidateSize();
            setTimeout(() => {
              try {
                if (
                  window.complaintMap.getSize &&
                  window.complaintMap.getSize().x > 0
                ) {
                  const radius = parseInt(radiusSlider.value);
                  const blur = parseInt(blurSlider.value);
                  const opacity = parseFloat(opacitySlider.value);

                  const gradient = {
                    0.0: `rgba(0, 0, 255, ${opacity * 0})`,
                    0.2: `rgba(0, 255, 255, ${opacity * 0.3})`,
                    0.4: `rgba(0, 255, 0, ${opacity * 0.5})`,
                    0.6: `rgba(255, 255, 0, ${opacity * 0.7})`,
                    0.8: `rgba(255, 165, 0, ${opacity * 0.8})`,
                    1.0: `rgba(255, 0, 0, ${opacity})`,
                  };

                  window.heatLayer.setOptions({
                    radius: radius,
                    blur: blur,
                    gradient: gradient,
                  });
                }
              } catch (e) {
                console.warn("Heatmap settings update retry failed:", e);
              }
            }, 100);
          }
        } catch (e) {
          console.warn("Failed to update heatmap settings:", e);
        }
      }
    };

    radiusSlider.addEventListener("input", (e) => {
      div.querySelector("#radius-value").textContent = e.target.value;
      updateHeatmapSettings();
    });

    blurSlider.addEventListener("input", (e) => {
      div.querySelector("#blur-value").textContent = e.target.value;
      updateHeatmapSettings();
    });

    opacitySlider.addEventListener("input", (e) => {
      div.querySelector("#opacity-value").textContent = e.target.value;
      updateHeatmapSettings();
    });

    resetBtn.addEventListener("click", () => {
      radiusSlider.value = 40;
      blurSlider.value = 25;
      opacitySlider.value = 0.8;
      div.querySelector("#radius-value").textContent = "40";
      div.querySelector("#blur-value").textContent = "25";
      div.querySelector("#opacity-value").textContent = "0.8";
      updateHeatmapSettings();
    });

    return div;
  };

  intensityControl.addTo(map);
}

// Add a status legend control (top-right)
function addStatusLegend(map) {
  const legend = L.control({ position: "topright" });
  legend.onAdd = function () {
    const div = L.DomUtil.create("div", "heatmap-legend");
    div.innerHTML = `
      <div class="legend-title">Complaint Status</div>
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
      <div class="legend-title" style="margin:12px 0 6px;">Heatmap Intensity</div>
      <div class="legend-gradient"></div>
      <div class="legend-labels">
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
    case "pending":
      markerColor = "#fbbf24"; // Yellow
      break;
    case "in_progress":
      markerColor = "#3b82f6"; // Blue
      break;
    case "resolved":
      markerColor = "#10b981"; // Green
      break;
    default:
      markerColor = "#64748b"; // Gray
  }

  // Use latitude and longitude from Supabase data
  const coordinates = [
    parseFloat(complaint.latitude),
    parseFloat(complaint.longitude),
  ];

  // Ensure markers pane exists

  const marker = L.circleMarker(coordinates, {
    pane: "markers-pane",
    radius: 8,
    fillColor: markerColor,
    color: "#000",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.9,
  });

  // Get current user's department for access control
  const user = window.currentUser || null;
  const userDept =
    user?.type?.replace("lgu-admin-", "").replace("lgu-", "") || null;
  const complaintAssignedUnit =
    complaint.assigned_unit || complaint.assignedUnit;
  const isAssignedToUserDept =
    userDept &&
    complaintAssignedUnit &&
    (complaintAssignedUnit === userDept ||
      complaintAssignedUnit.includes(userDept));

  // Create detailed tooltip content
  const tooltipActionsHtml = isAssignedToUserDept
    ? `<div class="tooltip-actions">
      <a href="/lgu/complaints?id=${complaint.id}" class="view-details-btn">View Details</a>
    </div>`
    : `<div class="tooltip-actions">
      <span class="text-muted">Not assigned to your department</span>
    </div>`;

  const tooltipContent = `
    <div class="complaint-tooltip">
      <div class="tooltip-header">
        <h4>${complaint.title || "Untitled Complaint"}</h4>
        <span class="status-badge ${complaint.status}">${
    complaint.status ? complaint.status.replace("_", " ") : "Unknown"
  }</span>
      </div>
      <div class="tooltip-content">
        <p><strong>Type:</strong> ${complaint.type || "Not specified"}</p>
                 <p><strong>Subcategory:</strong> ${
                   complaint.subcategory || "Not specified"
                 }</p>
         <p><strong>Location:</strong> ${
           complaint.location || "Location not specified"
         }</p>
         <p><strong>Submitted:</strong> ${
           formatDate(complaint.created_at || complaint.createdAt) ||
           "Date not available"
         }</p>
        ${
          complaint.suggested_unit
            ? `<p><strong>Assigned to:</strong> ${
                governmentUnitNames[complaint.suggested_unit] ||
                complaint.suggested_unit
              }</p>`
            : ""
        }
        ${
          complaint.user_name
            ? `<p><strong>Complainant:</strong> ${complaint.user_name}</p>`
            : ""
        }
      </div>
      ${tooltipActionsHtml}
    </div>
  `;

  // Bind tooltip with HTML content; ensure it renders above boundaries by using high-z class
  marker.bindTooltip(tooltipContent, {
    pane: "markers-pane",
    direction: "top",
    offset: [0, -10],
    className: "complaint-tooltip-container complaint-popup-high-z",
    maxWidth: 300,
  });

  // Create popup content with conditional access
  const popupActionsHtml = isAssignedToUserDept
    ? `<a href="/lgu/complaints?id=${complaint.id}" class="popup-link">View Full Details</a>`
    : `<span class="text-muted">Not assigned to your department</span>`;

  // Add popup with complaint details - ensure it appears above all layers
  marker.bindPopup(
    `
    <div class="map-popup">
      <h3>${complaint.title || "Untitled Complaint"}</h3>
      <p><strong>ID:</strong> ${complaint.id}</p>
      <p><strong>Location:</strong> ${
        complaint.location || "Location not specified"
      }</p>
      <p><strong>Coordinates:</strong> ${complaint.latitude}, ${
      complaint.longitude
    }</p>
      <p><strong>Type:</strong> ${complaint.type || "Not specified"}</p>
             <p><strong>Subcategory:</strong> ${
               complaint.subcategory || "Not specified"
             }</p>
       <p><strong>Status:</strong> ${complaint.status || "Not specified"}</p>
       <p><strong>Description:</strong> ${
         complaint.description || "No description provided"
       }</p>
      <p><strong>Submitted:</strong> ${
        formatDate(complaint.created_at || complaint.createdAt) ||
        "Date not available"
      }</p>
      ${
        complaint.user_name
          ? `<p><strong>Complainant:</strong> ${complaint.user_name}</p>`
          : ""
      }
      ${popupActionsHtml}
    </div>
  `,
    {
      className: "complaint-popup-high-z",
      maxWidth: 300,
      autoPan: false,
      keepInView: true,
      // Lift popup visually above the marker
      offset: [0, -14],
    }
  );

  // Ensure tooltip hides when popup opens or on click

  marker.on("click", () => {
    marker.closeTooltip();
  });
  marker.on("popupopen", (e) => {
    marker.closeTooltip();
    // Extra safeguard: force popup container above all
    const el =
      e && e.popup && e.popup.getElement
        ? e.popup.getElement()
        : e.popup && e.popup._container;
    if (el) el.style.zIndex = "10002";
    // Force correct stack: boundary behind, marker in front
    try {
      if (
        window.boundaryLayer &&
        window.complaintMap?.hasLayer(window.boundaryLayer)
      ) {
        window.boundaryLayer.bringToBack();
      }
    } catch (_) {}
    try {
      marker.bringToFront();
    } catch (_) {}
  });
  marker.on("mouseover", () => {
    if (marker.isPopupOpen && marker.isPopupOpen()) marker.closeTooltip();
  });

  // Remove hover-based popup behavior; popups will open by click only

  return marker;
}

// Check if a point lies inside a Leaflet polygon/multipolygon latlngs structure
function pointInPolygonLeaflet(point, latlngs) {
  // latlngs can be Array of LatLngs (Polygon rings) or Array of Arrays (MultiPolygon)
  const containsPointInRing = (ring) => {
    try {
      const poly = L.polygon(ring);
      return poly.getBounds().contains(point) && L.Polyline.prototype.isInside
        ? L.Polyline.prototype.isInside.call(poly, point)
        : rayCasting(point, ring);
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
  const x = point.lat,
    y = point.lng;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lat,
      yi = ring[i].lng;
    const xj = ring[j].lat,
      yj = ring[j].lng;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Calculate complaint weight for heatmap intensity
function getComplaintWeight(complaint) {
  let weight = 1;

  // Base weight by status
  switch (complaint.status) {
    case "pending":
      weight = 2.0; // Highest priority - urgent attention needed
      break;
    case "in_progress":
      weight = 1.5; // Medium priority - being addressed
      break;
    case "resolved":
      weight = 0.3; // Low weight - already resolved
      break;
    default:
      weight = 1.0; // Default weight
  }

  // Increase weight based on complaint type/urgency
  const urgentTypes = ["public_safety", "utilities", "sanitation"];
  if (urgentTypes.includes(complaint.type)) {
    weight *= 1.3;
  }

  // Increase weight for recent complaints (within last 7 days)
  const complaintDate = new Date(complaint.created_at || complaint.createdAt);
  const daysSinceCreated =
    (Date.now() - complaintDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated <= 7) {
    weight *= 1.2;
  }

  // Increase weight for complaints with media attachments
  if (complaint.media_urls && complaint.media_urls.length > 0) {
    weight *= 1.1;
  }

  // Normalize weight to reasonable range (0.1 to 3.0)
  return Math.min(3.0, Math.max(0.1, weight));
}

// Normalize statuses to canonical values for consistent analytics
function normalizeStatus(status) {
  const s = (status || "")
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
  if (s === "inprogress") return "in_progress";
  if (["pending", "in_progress", "resolved"].includes(s)) return s;
  return "pending";
}

// Compute a stable area key from latitude/longitude using a simple grid
// This lets us bucket nearby complaints into the same "hotspot area"
function getAreaKey(lat, lon, gridSizeDegrees = 0.01) {
  // ≈1.1km at equator
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);
  if (Number.isNaN(latNum) || Number.isNaN(lonNum)) return "Unknown Area";
  // Prefer barangay name if point lies inside any barangay polygon

  if (Array.isArray(window._brgyPolygons) && window._brgyPolygons.length) {
    const point = L.latLng(latNum, lonNum);
    for (const poly of window._brgyPolygons) {
      if (pointInPolygonLeaflet(point, poly.latlngs)) {
        return poly.name;
      }
    }
  }

  // Fallback to grid-based zone label
  const latCell = Math.floor(latNum / gridSizeDegrees) * gridSizeDegrees;
  const lonCell = Math.floor(lonNum / gridSizeDegrees) * gridSizeDegrees;
  return `Zone ${latCell.toFixed(2)}, ${lonCell.toFixed(2)}`;
}

// Government unit names mapping
const governmentUnitNames = {
  city_hall: "City Hall",
  police: "Police Department (PNP)",
  fire: "Fire Department (BFP)",
  public_works: "Public Works (DPWH)",
  waste: "Waste Management",
  health: "Health Department",
};

// Format date function
function formatDate(dateString) {
  if (!dateString) return "Date not available";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Date not available";
  }
}

// Setup filters with enhanced functionality
function setupFilters() {
  const heatmapFilter = document.getElementById("heatmap-filter");
  const timeFilter = document.getElementById("time-filter");
  const priorityFilter = document.getElementById("priority-filter");
  const urgencyFilter = document.getElementById("urgency-filter");

  // Add event listeners with debouncing for better performance
  const debouncedUpdate = debounce(updateHeatmap, 300);

  if (heatmapFilter) heatmapFilter.addEventListener("change", debouncedUpdate);
  if (timeFilter) timeFilter.addEventListener("change", debouncedUpdate);
  if (priorityFilter)
    priorityFilter.addEventListener("change", debouncedUpdate);
  if (urgencyFilter) urgencyFilter.addEventListener("change", debouncedUpdate);

  // Add search functionality
  addSearchFilter();

  // Add advanced filters
  addAdvancedFilters();

  // Add filter reset functionality
  addFilterReset();

  // Add real-time filter indicators
  addFilterIndicators();
}

// Add search filter for complaints
function addSearchFilter() {
  const filterButtons = document.querySelector(".filter-buttons");

  const searchContainer = document.createElement("div");
  searchContainer.className = "search-container";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search complaints...";
  searchInput.className = "search-input";
  searchInput.id = "complaint-search";

  const searchButton = document.createElement("button");
  searchButton.className = "search-button";
  searchButton.innerHTML = '<i class="fas fa-search"></i>';

  searchContainer.appendChild(searchInput);
  searchContainer.appendChild(searchButton);
  filterButtons.appendChild(searchContainer);

  // Add event listeners
  searchInput.addEventListener("input", debounce(updateHeatmap, 300));
  searchButton.addEventListener("click", updateHeatmap);
}

// Add advanced filters to the left panel container
function addAdvancedFilters() {
  const container = document.getElementById("advanced-filters-container");
  if (!container) return;

  const advancedFiltersContainer = document.createElement("div");
  advancedFiltersContainer.className = "advanced-filters";

  // Status filter
  const statusFilter = document.createElement("select");
  statusFilter.id = "status-filter";
  statusFilter.className = "filter-select";
  statusFilter.innerHTML = `
    <option value="all">All Statuses</option>
    <option value="pending">Pending</option>
    <option value="in_progress">In Progress</option>
    <option value="resolved">Resolved</option>
  `;

  // Date range filters (from/to)
  const fromLabel = document.createElement("label");
  fromLabel.textContent = "From:";
  fromLabel.className = "filter-label";
  fromLabel.setAttribute("for", "date-from");

  const dateFrom = document.createElement("input");
  dateFrom.type = "date";
  dateFrom.id = "date-from";
  dateFrom.className = "filter-select";
  dateFrom.placeholder = "From";
  dateFrom.setAttribute("aria-label", "Start date");

  const toLabel = document.createElement("label");
  toLabel.textContent = "To:";
  toLabel.className = "filter-label";
  toLabel.setAttribute("for", "date-to");

  const dateTo = document.createElement("input");
  dateTo.type = "date";
  dateTo.id = "date-to";
  dateTo.className = "filter-select";
  dateTo.placeholder = "To";
  dateTo.setAttribute("aria-label", "End date");

  advancedFiltersContainer.appendChild(statusFilter);
  advancedFiltersContainer.appendChild(fromLabel);
  advancedFiltersContainer.appendChild(dateFrom);
  advancedFiltersContainer.appendChild(toLabel);
  advancedFiltersContainer.appendChild(dateTo);
  container.appendChild(advancedFiltersContainer);

  // Add event listeners
  statusFilter.addEventListener("change", updateHeatmap);
  dateFrom.addEventListener("change", updateHeatmap);
  dateTo.addEventListener("change", updateHeatmap);
}

// Add filter reset functionality
function addFilterReset() {
  const filterButtons = document.querySelector(".filter-buttons");
  if (!filterButtons) return;

  const resetButton = document.createElement("button");
  resetButton.className = "filter-reset";
  resetButton.innerHTML = '<i class="fas fa-undo"></i> Reset All Filters';
  resetButton.addEventListener("click", resetAllFilters);

  filterButtons.appendChild(resetButton);
}

// Reset all filters to default values
function resetAllFilters() {
  const filters = [
    "heatmap-filter",
    "time-filter",
    "status-filter",
    "priority-filter",
    "urgency-filter",
    "date-from",
    "date-to",
    "complaint-search",
  ];

  filters.forEach((filterId) => {
    const element = document.getElementById(filterId);
    if (element) {
      if (element.type === "text" || element.type === "search") {
        element.value = "";
      } else {
        element.selectedIndex = 0;
      }
    }
  });

  // Update heatmap with reset filters
  updateHeatmap();
  showToast("All filters reset to default", "info");
}

// Add real-time filter indicators
function addFilterIndicators() {
  const filterSelects = document.querySelectorAll(".filter-select");

  filterSelects.forEach((select) => {
    select.addEventListener("change", () => {
      // Add active indicator
      select.classList.add("filter-active");

      // Remove indicator after 3 seconds
      setTimeout(() => {
        select.classList.remove("filter-active");
      }, 3000);
    });
  });
}

// Setup real-time updates
function setupRealTimeUpdates() {
  // Add refresh button
  const filterButtons = document.querySelector(".filter-buttons");

  const refreshButton = document.createElement("button");
  refreshButton.className = "refresh-button";
  refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
  refreshButton.title = "Refresh data";

  filterButtons.appendChild(refreshButton);

  // Add event listener
  refreshButton.addEventListener("click", refreshData);

  // Auto-refresh every 5 minutes
  setInterval(refreshData, 5 * 60 * 1000);

  // Optional: loading indicator (disabled per UX feedback)
  // addLoadingIndicator();
}

// Add loading indicator
function addLoadingIndicator() {
  const mapCard = document.querySelector(".map-card");

  const loadingOverlay = document.createElement("div");
  loadingOverlay.className = "loading-overlay";
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
  const loadingOverlay = document.querySelector(".loading-overlay");
  if (loadingOverlay) {
    loadingOverlay.style.display = "flex";
  }

  // Simulate data refresh
  setTimeout(() => {
    updateHeatmap();

    if (loadingOverlay) {
      loadingOverlay.style.display = "none";
    }

    showToast("Data refreshed successfully", "success");
  }, 1000);
}


// Setup clustering analysis button
function setupClusteringButton() {
  // Clustering feature disabled per request
}





// Prepare export data based on selected types

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
  const quickStats = document.querySelector(".quick-stats");

  if (!quickStats) {
    console.warn(
      "Quick stats container not found, skipping analytics dashboard"
    );
    return;
  }

  const analyticsCard = document.createElement("div");
  analyticsCard.className = "stat-item analytics-item";
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
  const pendingComplaints = complaints.filter(
    (c) => c.status === "pending"
  ).length;
  const resolvedComplaints = complaints.filter(
    (c) => c.status === "resolved"
  ).length;
  const inProgressComplaints = complaints.filter(
    (c) => c.status === "in_progress"
  ).length;
  const avgResponseTime =
    typeof calculateAverageResponseTime === "function"
      ? calculateAverageResponseTime(complaints)
      : 0;

  // Update overlay statistics
  updateOverlayStatistics(
    totalComplaints,
    pendingComplaints,
    inProgressComplaints,
    resolvedComplaints
  );

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
  const totalEl = document.getElementById("total-complaints");
  const pendingEl = document.getElementById("pending-complaints");
  const inProgressEl = document.getElementById("in-progress-complaints");
  const resolvedEl = document.getElementById("resolved-complaints");

  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (inProgressEl) inProgressEl.textContent = inProgress;
  if (resolvedEl) resolvedEl.textContent = resolved;
}

// Add CSS styles for overlay panels
function addOverlayStyles() {
  const style = document.createElement("style");
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
  window.complaintMarkers.forEach((marker) => {
    window.complaintMap.removeLayer(marker);
  });

  // Create new markers
  const newMarkers = [];
  complaintsWithCoordinates.forEach((complaint) => {
    const marker = createComplaintMarker(complaint);
    newMarkers.push(marker);
    marker.addTo(window.complaintMap);

    // Set initial opacity based on zoom
    const currentZoom = window.complaintMap.getZoom();
    if (currentZoom >= 14) {
      // Match MARKER_VISIBILITY_ZOOM
      marker.setOpacity(1);
    } else {
      marker.setOpacity(0);
    }
  });

  window.complaintMarkers = newMarkers;
  
  // Update marker layer group and layer control
  if (window.markerLayer) {
    try {
      window.complaintMap.removeLayer(window.markerLayer);
    } catch (_) {}
  }
  window.markerLayer = L.layerGroup(newMarkers);
  
  // Update layer control with the newly created marker layer
  if (window.layersControl && window.markerLayer) {
    // Remove existing Complaints layer if it exists
    if (window.layersControl._overlays && window.layersControl._overlays.Complaints) {
      try {
        window.layersControl.removeLayer(window.layersControl._overlays.Complaints);
        console.log("🗑️ Removed existing Complaints layer from control (updateMarkers)");
      } catch (error) {
        console.log("⚠️ Error removing existing Complaints layer (updateMarkers):", error);
      }
    }
    
    // Add the new Complaints layer
    window.layersControl.addOverlay(window.markerLayer, "Complaints");
    console.log("➕ Added Complaints layer to control (updateMarkers)");
  }
}

// Update hotspot list
function updateHotspotList(complaints) {
  const hotspotList = document.getElementById("hotspot-list");
  if (!hotspotList) return;

  // Group complaints by grid area using latitude/longitude
  const areaComplaints = {};
  complaints.forEach((complaint) => {
    const { latitude, longitude } = complaint;
    if (latitude && longitude) {
      const area = getAreaKey(latitude, longitude);
      if (!areaComplaints[area]) areaComplaints[area] = [];
      areaComplaints[area].push(complaint);
    }
  });

  // Sort areas by complaint count
  const sortedAreas = Object.entries(areaComplaints)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 5);

  // Update hotspot list
  hotspotList.innerHTML = sortedAreas
    .map(
      ([area, complaints]) => `
    <li>
      <span class="hotspot-name">${area}</span>
      <span class="hotspot-count">${complaints.length} complaints</span>
    </li>
  `
    )
    .join("");
}

// Update priority areas
function updatePriorityAreas(complaints) {
  const priorityAreas = document.querySelector(".priority-areas");
  if (!priorityAreas) return;

  // Calculate priority based on unresolved complaints and urgency
  const areaPriority = {};

  complaints.forEach((complaint) => {
    const status = normalizeStatus(complaint.status);
    const { latitude, longitude } = complaint;
    if (latitude && longitude && status !== "resolved") {
      const area = getAreaKey(latitude, longitude);
      if (!areaPriority[area])
        areaPriority[area] = { score: 0, complaints: [] };
      let score = status === "pending" ? 3 : status === "in_progress" ? 2 : 1;
      areaPriority[area].score += score;
      areaPriority[area].complaints.push(complaint);
    }
  });

  // Sort areas by priority score
  const sortedAreas = Object.entries(areaPriority).sort(
    ([, a], [, b]) => b.score - a.score
  );

  // Update priority areas
  priorityAreas.innerHTML = sortedAreas
    .map(([area, data], index) => {
      let priorityClass = "low";
      if (index === 0) priorityClass = "high";
      else if (index < 3) priorityClass = "medium";

      return `
      <div class="priority-item ${priorityClass}">
        <span class="priority-label">${
          priorityClass.charAt(0).toUpperCase() + priorityClass.slice(1)
        } Priority</span>
        <span class="priority-value">${area} (${
        data.complaints.length
      } complaints)</span>
      </div>
    `;
    })
    .join("");
}

// Enhanced insights panel updates
function updateEnhancedInsights(complaints) {
  console.log(
    "Updating enhanced insights with",
    complaints.length,
    "complaints"
  );

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

  const resolvedComplaints = complaints.filter(
    (c) => c.status === "resolved" && c.created_at && c.resolved_at
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
  const activeAreas = new Set(complaints.map((c) => c.location || "Unknown"))
    .size;
  const avgResponseTime = calculateAverageResponseTime(complaints);
  const dataDensity = calculateDataDensity(complaints);

  const totalEl = document.getElementById("total-complaints-count");
  const areasEl = document.getElementById("active-areas-count");
  const responseEl = document.getElementById("avg-response-time");
  const densityEl = document.getElementById("data-density");

  if (totalEl) totalEl.textContent = totalComplaints;
  if (areasEl) areasEl.textContent = activeAreas;
  if (responseEl)
    responseEl.textContent =
      avgResponseTime > 0 ? `${avgResponseTime.toFixed(1)}d` : "N/A";
  if (densityEl) densityEl.textContent = dataDensity;
}

// Calculate data density indicator
function calculateDataDensity(complaints) {
  if (complaints.length === 0) return "None";

  const coverageArea = calculateCoverageArea(complaints);
  const density = coverageArea > 0 ? complaints.length / coverageArea : 0;

  if (density > 10) return "Very High";
  if (density > 5) return "High";
  if (density > 2) return "Medium";
  if (density > 0.5) return "Low";
  return "Very Low";
}

// Calculate complaint priority based on status and type
function getComplaintPriority(complaint) {
  // High priority: pending complaints of urgent types
  if (complaint.status === "pending") {
    const urgentTypes = ["public_safety", "utilities", "sanitation"];
    if (urgentTypes.includes(complaint.type)) {
      return "high";
    }
    return "medium";
  }

  // Medium priority: in-progress complaints
  if (complaint.status === "in_progress") {
    return "medium";
  }

  // Low priority: resolved complaints
  if (complaint.status === "resolved") {
    return "low";
  }

  return "medium"; // default
}

// Calculate complaint urgency based on age and type
function getComplaintUrgency(complaint) {
  const created = new Date(complaint.created_at || complaint.createdAt);
  const now = new Date();
  const hoursSinceCreated = (now - created) / (1000 * 60 * 60);

  // Urgent types get urgent status for first 24 hours
  const urgentTypes = ["public_safety", "utilities"];
  if (urgentTypes.includes(complaint.type) && hoursSinceCreated <= 24) {
    return "urgent";
  }

  // High urgency for first 3 days
  if (hoursSinceCreated <= 72) {
    return "high";
  }

  // Normal urgency for older complaints
  return "normal";
}

// Utility function to check if map is ready for heatmap operations
function isMapReadyForHeatmap() {
  try {
    if (!window.complaintMap) return false;
    if (!window.complaintMap.getSize) return false;

    const size = window.complaintMap.getSize();
    return size && size.x > 0 && size.y > 0;
  } catch (e) {
    console.warn("Map readiness check failed:", e);
    return false;
  }
}

// Safe heatmap update function
function safeHeatmapUpdate(heatmapData) {
  if (!isMapReadyForHeatmap()) {
    console.warn("Map not ready for heatmap update, invalidating size...");
    if (window.complaintMap) {
      window.complaintMap.invalidateSize();
    }

    // Retry after a short delay
    setTimeout(() => {
      if (isMapReadyForHeatmap()) {
        safeHeatmapUpdate(heatmapData);
      } else {
        console.warn(
          "Map still not ready after retry, skipping heatmap update"
        );
      }
    }, 200);
    return;
  }

  try {
    if (window.heatLayer && window.complaintMap.hasLayer(window.heatLayer)) {
      window.heatLayer.setLatLngs(heatmapData);
    }
  } catch (e) {
    console.warn("Safe heatmap update failed:", e);
  }
}

// Update hotspot analysis with visual bars
function updateHotspotAnalysis(complaints) {
  const hotspotData = calculateHotspotData(complaints);
  const hotspotFill = document.querySelector(".hotspot-fill");
  const hotspotLabel = document.querySelector(".hotspot-label");

  if (hotspotFill && hotspotLabel && hotspotData.length > 0) {
    const maxComplaints = Math.max(...hotspotData.map((h) => h.count));
    const totalComplaints = hotspotData.reduce((sum, h) => sum + h.count, 0);

    // Update the main hotspot bar
    const intensity = Math.min(100, (totalComplaints / maxComplaints) * 100);
    hotspotFill.style.width = `${intensity}%`;
    hotspotLabel.textContent = `${hotspotData.length} hotspot areas identified`;

    // Update hotspot metrics
    updateHotspotMetrics(complaints, hotspotData);
  } else if (hotspotFill && hotspotLabel) {
    hotspotFill.style.width = "0%";
    hotspotLabel.textContent = "No hotspots identified";

    // Clear metrics
    const peakIntensityEl = document.getElementById("peak-intensity");
    const coverageAreaEl = document.getElementById("coverage-area");
    if (peakIntensityEl) peakIntensityEl.textContent = "-";
    if (coverageAreaEl) coverageAreaEl.textContent = "-";
  }
}

// Update hotspot metrics
function updateHotspotMetrics(complaints, hotspotData) {
  // Calculate peak intensity (highest concentration of complaints)
  const peakIntensity =
    hotspotData.length > 0 ? Math.max(...hotspotData.map((h) => h.count)) : 0;

  // Calculate coverage area (approximate area covered by complaints)
  const coverageArea = calculateCoverageArea(complaints);

  // Update UI elements
  const peakIntensityEl = document.getElementById("peak-intensity");
  const coverageAreaEl = document.getElementById("coverage-area");

  if (peakIntensityEl) {
    peakIntensityEl.textContent = `${peakIntensity} complaints`;
  }

  if (coverageAreaEl) {
    coverageAreaEl.textContent =
      coverageArea > 0 ? `${coverageArea.toFixed(1)} km²` : "N/A";
  }
}

// Calculate approximate coverage area of complaints
function calculateCoverageArea(complaints) {
  if (complaints.length < 2) return 0;

  const coordinates = complaints
    .filter((c) => c.latitude && c.longitude)
    .map((c) => [parseFloat(c.latitude), parseFloat(c.longitude)]);

  if (coordinates.length < 2) return 0;

  // Calculate bounding box
  const lats = coordinates.map((c) => c[0]);
  const lons = coordinates.map((c) => c[1]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // Convert to approximate area in km²
  const latDiff = maxLat - minLat;
  const lonDiff = maxLon - minLon;

  // Rough conversion: 1 degree ≈ 111 km
  const areaKm2 = latDiff * lonDiff * 111 * 111;

  return areaKm2;
}

// Update priority analysis with visual bars
function updatePriorityAnalysis(complaints) {
  const highPriority = complaints.filter(
    (c) => c.priority === "high" || c.status === "pending"
  ).length;
  const mediumPriority = complaints.filter(
    (c) => c.priority === "medium" || c.status === "in_progress"
  ).length;
  const lowPriority = complaints.filter(
    (c) => c.priority === "low" || c.status === "resolved"
  ).length;

  const total = highPriority + mediumPriority + lowPriority;

  // Update counts
  const highCountEl = document.getElementById("high-priority-count");
  const mediumCountEl = document.getElementById("medium-priority-count");
  const lowCountEl = document.getElementById("low-priority-count");

  if (highCountEl) highCountEl.textContent = highPriority;
  if (mediumCountEl) mediumCountEl.textContent = mediumPriority;
  if (lowCountEl) lowCountEl.textContent = lowPriority;

  // Update bars
  const highBar = document.querySelector(".priority-fill.high");
  const mediumBar = document.querySelector(".priority-fill.medium");
  const lowBar = document.querySelector(".priority-fill.low");

  if (total > 0) {
    if (highBar) highBar.style.width = `${(highPriority / total) * 100}%`;
    if (mediumBar) mediumBar.style.width = `${(mediumPriority / total) * 100}%`;
    if (lowBar) lowBar.style.width = `${(lowPriority / total) * 100}%`;
  } else {
    if (highBar) highBar.style.width = "0%";
    if (mediumBar) mediumBar.style.width = "0%";
    if (lowBar) lowBar.style.width = "0%";
  }
}

// Update trend analysis
function updateTrendAnalysis(complaints) {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weeklyComplaints = complaints.filter((c) => {
    const complaintDate = new Date(c.created_at || c.timestamp);
    return complaintDate >= oneWeekAgo;
  }).length;

  const avgResolutionTime = calculateAverageResolutionTime(complaints);

  const weeklyEl = document.getElementById("weekly-trend");
  const resolutionEl = document.getElementById("resolution-trend");

  if (weeklyEl) weeklyEl.textContent = weeklyComplaints;
  if (resolutionEl)
    resolutionEl.textContent =
      avgResolutionTime > 0 ? `${avgResolutionTime.toFixed(1)}h` : "N/A";
}

// Update department performance
function updateDepartmentPerformance(complaints) {
  const resolvedComplaints = complaints.filter(
    (c) => c.status === "resolved"
  ).length;
  const totalComplaints = complaints.length;
  const performancePercentage =
    totalComplaints > 0 ? (resolvedComplaints / totalComplaints) * 100 : 0;

  const deptBar = document.getElementById("dept-performance-bar");
  const deptValue = document.getElementById("dept-performance-value");

  if (deptBar) deptBar.style.width = `${performancePercentage}%`;
  if (deptValue) deptValue.textContent = `${performancePercentage.toFixed(1)}%`;
}

// Calculate hotspot data
function calculateHotspotData(complaints) {
  const locationCounts = {};

  complaints.forEach((complaint) => {
    const location = complaint.location || "Unknown";
    locationCounts[location] = (locationCounts[location] || 0) + 1;
  });

  return Object.entries(locationCounts)
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count);
}

// Calculate average resolution time
function calculateAverageResolutionTime(complaints) {
  const resolutionTimes = complaints
    .filter((c) => c.status === "resolved" && c.resolved_at)
    .map((c) => {
      const resolved = new Date(c.resolved_at);
      const created = new Date(c.created_at || c.timestamp);
      return (resolved - created) / (1000 * 60 * 60); // hours
    })
    .filter((time) => time > 0);

  return resolutionTimes.length > 0
    ? resolutionTimes.reduce((sum, time) => sum + time, 0) /
        resolutionTimes.length
    : 0;
}

// Update resource allocation
function updateResourceAllocation(complaints) {
  // Feature removed per request
}

// Setup filters
function setupFilters() {
  const heatmapFilter = document.getElementById("heatmap-filter");
  const timeFilter = document.getElementById("time-filter");

  if (!heatmapFilter || !timeFilter) {
    console.warn("Filter elements not found");
    return;
  }

  // Add event listeners
  heatmapFilter.addEventListener("change", updateHeatmap);
  timeFilter.addEventListener("change", updateHeatmap);

  // Add search functionality
  addSearchFilter();

  // Add advanced filters
  addAdvancedFilters();
}

// Update heatmap based on filters
async function updateHeatmap() {
  try {
    const heatmapFilter = document.getElementById("heatmap-filter");
    const timeFilter = document.getElementById("time-filter");
    const statusFilter = document.getElementById("status-filter");
    const dateFromEl = document.getElementById("date-from");
    const dateToEl = document.getElementById("date-to");
    const searchInput = document.getElementById("complaint-search");

    if (!heatmapFilter || !timeFilter) return;

    const selectedType = heatmapFilter.value; // category/type
    const selectedTime = timeFilter.value; // all | week | month | quarter | year
    const selectedStatus = statusFilter ? statusFilter.value : "all";
    const selectedPriority = document.getElementById("priority-filter")
      ? document.getElementById("priority-filter").value
      : "all";
    const selectedUrgency = document.getElementById("urgency-filter")
      ? document.getElementById("urgency-filter").value
      : "all";
    const fromDate =
      dateFromEl && dateFromEl.value ? new Date(dateFromEl.value) : null;
    const toDate = dateToEl && dateToEl.value ? new Date(dateToEl.value) : null;
    const searchTerm =
      searchInput && searchInput.value
        ? searchInput.value.toLowerCase().trim()
        : "";

    // Show loading indicator for large datasets
    const startTime = performance.now();
    const loadingIndicator = showLoadingIndicator("Updating heatmap...");

    // Get complaints from backend API with performance optimization
    const complaints = await fetchComplaintsWithCache();

    // Apply filters
    let filteredComplaints = complaints.filter((complaint) => {
      // Type/category
      if (
        selectedType &&
        selectedType !== "all" &&
        complaint.type !== selectedType
      )
        return false;

      // Status
      if (
        selectedStatus &&
        selectedStatus !== "all" &&
        complaint.status !== selectedStatus
      )
        return false;

      // Priority filter
      if (selectedPriority && selectedPriority !== "all") {
        const complaintPriority = getComplaintPriority(complaint);
        if (complaintPriority !== selectedPriority) return false;
      }

      // Urgency filter
      if (selectedUrgency && selectedUrgency !== "all") {
        const complaintUrgency = getComplaintUrgency(complaint);
        if (complaintUrgency !== selectedUrgency) return false;
      }

      // Time window
      if (selectedTime && selectedTime !== "all") {
        const created = new Date(complaint.created_at || complaint.createdAt);
        const now = new Date();
        let threshold = null;
        switch (selectedTime) {
          case "week":
            threshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case "month":
            threshold = new Date(
              now.getFullYear(),
              now.getMonth() - 1,
              now.getDate()
            );
            break;
          case "quarter":
            threshold = new Date(
              now.getFullYear(),
              now.getMonth() - 3,
              now.getDate()
            );
            break;
          case "year":
            threshold = new Date(
              now.getFullYear() - 1,
              now.getMonth(),
              now.getDate()
            );
            break;
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
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          if (created > end) return false;
        }
      }

      // Search filter across key fields
      if (searchTerm) {
        const hay = `${complaint.title || ""} ${complaint.description || ""} ${
          complaint.location || ""
        } ${complaint.user_name || ""}`.toLowerCase();
        if (!hay.includes(searchTerm)) return false;
      }
      return true;
    });

    // Filter complaints that have coordinates
    const complaintsWithCoordinates = filteredComplaints.filter(
      (complaint) => complaint.latitude && complaint.longitude
    );

    // Optimize data for large datasets
    const optimizedComplaints = optimizeHeatmapData(complaintsWithCoordinates);

    // Filter complaints to only show those inside the city boundary
    const complaintsInsideBoundary = filterComplaintsInsideBoundary(
      optimizedComplaints,
      window.boundaryLayer
    );

    // Update heatmap data from complaints inside boundary
    const heatmapData = complaintsInsideBoundary.map((complaint) => [
      parseFloat(complaint.latitude),
      parseFloat(complaint.longitude),
      getComplaintWeight(complaint),
    ]);

    // Update heatmap layer safely; cache last data
    window._lastHeatmapData = heatmapData;

    // Use safe heatmap update function
    safeHeatmapUpdate(heatmapData);

    // K-Means clustering and cluster display removed per request

    // Update markers layer
    if (window.markerLayer) {
      try {
        window.complaintMap.removeLayer(window.markerLayer);
      } catch (_) {}
    }
    const newMarkers = complaintsInsideBoundary.map((c) =>
      createComplaintMarker(c)
    );
    window.markerLayer = L.layerGroup(newMarkers);
    
    // Update layer control with the newly created marker layer
    if (window.layersControl && window.markerLayer) {
      // Remove existing Complaints layer if it exists
      if (window.layersControl._overlays && window.layersControl._overlays.Complaints) {
        try {
          window.layersControl.removeLayer(window.layersControl._overlays.Complaints);
          console.log("🗑️ Removed existing Complaints layer from control (updateHeatmap)");
        } catch (error) {
          console.log("⚠️ Error removing existing Complaints layer (updateHeatmap):", error);
        }
      }
      
      // Add the new Complaints layer
      window.layersControl.addOverlay(window.markerLayer, "Complaints");
      console.log("➕ Added Complaints layer to control (updateHeatmap)");
    }
    
    const shouldShowMarkers =
      window.complaintMap && window.complaintMap.getZoom() >= 14; // Use same threshold as main function
    const heatOnMap =
      window.heatLayer && window.complaintMap.hasLayer(window.heatLayer);
    if (shouldShowMarkers) {
      window.markerLayer.addTo(window.complaintMap);
      if (heatOnMap) window.complaintMap.removeLayer(window.heatLayer);
    } else {
      if (!heatOnMap && window.heatLayer) {
        window.heatLayer.addTo(window.complaintMap);
        if (window._lastHeatmapData) {
          try {
            window.heatLayer.setLatLngs(window._lastHeatmapData);
          } catch (_) {}
        }
      }
    }

    // Update statistics
    updateStatistics(complaintsInsideBoundary);

    // Performance monitoring
    const endTime = performance.now();
    const processingTime = endTime - startTime;
    console.log(
      `📊 Heatmap update completed in ${processingTime.toFixed(2)}ms`
    );

    // Hide loading indicator
    hideLoadingIndicator();

    // Show performance info for large datasets
    if (complaints.length > 500) {
      showToast(
        `Heatmap updated: ${
          complaintsInsideBoundary.length
        } complaints displayed (${processingTime.toFixed(0)}ms)`,
        "info"
      );
    }
  } catch (error) {
    console.error("Error updating heatmap:", error);
    hideLoadingIndicator();
    showToast("Error updating heatmap. Please try again.", "error");
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
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");

  if (!toast) return;

  // Create toast elements
  const toastHeader = document.createElement("div");
  toastHeader.className = "toast-header";

  const toastTitle = document.createElement("div");
  toastTitle.className = "toast-title";
  toastTitle.textContent = type === "success" ? "Success" : "Error";

  const toastClose = document.createElement("button");
  toastClose.className = "toast-close";
  toastClose.innerHTML = "&times;";
  toastClose.addEventListener("click", () => {
    toast.classList.remove("show");
  });

  toastHeader.appendChild(toastTitle);
  toastHeader.appendChild(toastClose);

  const toastMessage = document.createElement("div");
  toastMessage.className = "toast-message";
  toastMessage.textContent = message;

  // Clear previous content
  toast.innerHTML = "";

  // Add new content
  toast.appendChild(toastHeader);
  toast.appendChild(toastMessage);

  // Set toast class
  toast.className = "toast";
  toast.classList.add(type);

  // Show toast
  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  // Auto hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

// ============================================================================
// K-MEANS CLUSTERING FUNCTIONS
// ============================================================================

// K-Means clustering algorithm for complaint locations
function kMeansClustering(complaints, k = 5, maxIterations = 100) {
  if (complaints.length === 0) return [];

  // Extract coordinates
  const coordinates = complaints.map((c) => [c.latitude, c.longitude]);

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
  const minLat = Math.min(...coordinates.map((c) => c[0]));
  const maxLat = Math.max(...coordinates.map((c) => c[0]));
  const minLon = Math.min(...coordinates.map((c) => c[1]));
  const maxLon = Math.max(...coordinates.map((c) => c[1]));

  for (let i = 0; i < k; i++) {
    centroids.push([
      minLat + Math.random() * (maxLat - minLat),
      minLon + Math.random() * (maxLon - minLon),
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
      const distance = calculateDistance(
        coord[0],
        coord[1],
        centroid[0],
        centroid[1]
      );
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
  return clusters.map((cluster) => {
    if (cluster.length === 0) {
      // If cluster is empty, return a random point
      const randomIndex = Math.floor(Math.random() * coordinates.length);
      return [...coordinates[randomIndex]];
    }

    const avgLat =
      cluster.reduce((sum, index) => sum + coordinates[index][0], 0) /
      cluster.length;
    const avgLon =
      cluster.reduce((sum, index) => sum + coordinates[index][1], 0) /
      cluster.length;

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
  return centroids
    .map((centroid, clusterIndex) => {
      const clusterComplaints = complaints.filter((_, index) => {
        const coord = coordinates[index];
        const distance = calculateDistance(
          coord[0],
          coord[1],
          centroid[0],
          centroid[1]
        );
        return distance < 0.01; // 0.01 degrees ≈ 1.1 km
      });

      return {
        centroid: centroid,
        complaints: clusterComplaints,
        count: clusterComplaints.length,
        clusterIndex: clusterIndex,
      };
    })
    .filter((cluster) => cluster.count > 0);
}

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// CLUSTER DISPLAY FUNCTIONS
// ============================================================================

// Display clusters on the map
function displayClusters(clusters) {
  // Clear existing cluster markers
  if (window.clusterMarkers) {
    window.clusterMarkers.forEach((marker) => marker.remove());
  }
  window.clusterMarkers = [];

  // Create cluster markers
  clusters.forEach((cluster) => {
    if (cluster.count > 1) {
      // Only show clusters with multiple complaints
      const clusterMarker = L.circleMarker(cluster.centroid, {
        radius: Math.min(20, Math.max(8, cluster.count * 2)), // Size based on complaint count
        fillColor: getClusterColor(cluster.count),
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      }).addTo(window.complaintMap);

      // Add popup with cluster information
      const popupContent = createClusterPopup(cluster);
      clusterMarker.bindPopup(popupContent);

      // Add tooltip
      clusterMarker.bindTooltip(`Cluster: ${cluster.count} complaints`, {
        permanent: false,
        className: "cluster-tooltip",
      });

      window.clusterMarkers.push(clusterMarker);
    }
  });

  // Cluster statistics removed per request
}

// Get color for cluster based on complaint count
function getClusterColor(count) {
  if (count <= 2) return "#00ff00"; // Green for small clusters
  if (count <= 5) return "#ffff00"; // Yellow for medium clusters
  if (count <= 10) return "#ff8000"; // Orange for large clusters
  return "#ff0000"; // Red for very large clusters
}

// Create popup content for cluster
function createClusterPopup(cluster) {
  const complaintsList = cluster.complaints
    .slice(0, 5)
    .map((c) => `<li>${c.title} - ${c.status}</li>`)
    .join("");

  const moreText =
    cluster.count > 5
      ? `<p><em>... and ${cluster.count - 5} more</em></p>`
      : "";

  return `
    <div class="cluster-popup">
      <h4>Cluster ${cluster.clusterIndex + 1}</h4>
      <p><strong>Total Complaints:</strong> ${cluster.count}</p>
      <p><strong>Location:</strong> ${cluster.centroid[0].toFixed(
        6
      )}, ${cluster.centroid[1].toFixed(6)}</p>
      <h5>Recent Complaints:</h5>
      <ul>${complaintsList}</ul>
      ${moreText}
      <button data-action="view-cluster-complaints" data-cluster-index="${
        cluster.clusterIndex
      }" class="btn btn-primary btn-sm">
        View All Complaints
      </button>
    </div>
  `;
}

// Update cluster statistics display
function updateClusterStatistics(clusters) {
  const statsContainer = document.getElementById("cluster-statistics");
  if (!statsContainer) return;

  const totalClusters = clusters.length;
  const totalComplaints = clusters.reduce(
    (sum, cluster) => sum + cluster.count,
    0
  );
  const avgComplaintsPerCluster =
    totalClusters > 0 ? (totalComplaints / totalClusters).toFixed(1) : 0;

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

// Make clustering functions globally available
if (typeof window !== "undefined") {
  window.kMeansClustering = kMeansClustering;
  window.displayClusters = displayClusters;
  window.updateHeatmapWithClustering = updateHeatmapWithClustering;
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
    const complaintsWithCoordinates = complaints.filter(
      (c) => c.latitude && c.longitude
    );

    if (complaintsWithCoordinates.length === 0) {
      showNoCoordinatesMessage();
      return;
    }

    // Apply filters
    const filteredComplaints = applyFilters(complaintsWithCoordinates);

    // Filter complaints to only show those inside the city boundary
    const complaintsInsideBoundary = filterComplaintsInsideBoundary(
      filteredComplaints,
      window.boundaryLayer
    );

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
    console.error("Error updating heatmap with clustering:", error);
    showErrorMessage("Failed to update heatmap with clustering");
  }
}


// Add boundary info to legend
function addBoundaryToLegend() {
  const legend = document.querySelector(".map-legend");
  if (legend) {
    const boundaryItem = document.createElement("div");
    boundaryItem.className = "legend-item";
    boundaryItem.innerHTML = `
      <div class="legend-color" style="background: #2563eb; border: 2px solid #2563eb;"></div>
      <span>LGU Jurisdiction Boundary</span>
    `;
    legend.appendChild(boundaryItem);
  }
}
function filterComplaintsInsideBoundary(complaints, boundaryLayer) {
  if (!boundaryLayer) {
    return complaints;
  }

  const boundaryPolygon = boundaryLayer;
  const complaintsInside = complaints.filter((complaint) => {
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

// Performance optimization: Cache for complaints data
const complaintsCache = {
  data: null,
  timestamp: 0,
  ttl: 5 * 60 * 1000, // 5 minutes cache
};

// Enhanced fetch with caching and performance monitoring
async function fetchComplaintsWithCache(params = {}) {
  const now = Date.now();

  // Return cached data if still valid
  if (
    complaintsCache.data &&
    now - complaintsCache.timestamp < complaintsCache.ttl
  ) {
    console.log("📊 Using cached complaints data");
    return complaintsCache.data;
  }

  console.log("📊 Fetching fresh complaints data");
  const complaints = await fetchComplaints(params);

  // Cache the results
  complaintsCache.data = complaints;
  complaintsCache.timestamp = now;

  return complaints;
}

// Show loading indicator with performance monitoring
function showLoadingIndicator(message = "Loading...") {
  const existing = document.querySelector(".heatmap-loading");
  if (existing) existing.remove();

  const indicator = document.createElement("div");
  indicator.className = "heatmap-loading";
  indicator.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 20px 30px;
    border-radius: 8px;
    z-index: 9999;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  `;
  indicator.innerHTML = `
    <div class="spinner-border spinner-border-sm" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
    ${message}
  `;

  document.body.appendChild(indicator);
  return indicator;
}

// Hide loading indicator
function hideLoadingIndicator() {
  const indicator = document.querySelector(".heatmap-loading");
  if (indicator) indicator.remove();
}

// Optimize heatmap data processing for large datasets
function optimizeHeatmapData(complaints, maxPoints = 1000) {
  if (complaints.length <= maxPoints) {
    return complaints;
  }

  console.log(
    `📊 Optimizing heatmap data: ${complaints.length} -> ${maxPoints} points`
  );

  // Sort by weight (priority) and take the most important complaints
  const sortedComplaints = complaints
    .map((complaint) => ({
      ...complaint,
      weight: getComplaintWeight(complaint),
    }))
    .sort((a, b) => b.weight - a.weight);

  // Take top complaints and add some random sampling for coverage
  const topComplaints = sortedComplaints.slice(0, Math.floor(maxPoints * 0.7));
  const remainingComplaints = sortedComplaints.slice(
    Math.floor(maxPoints * 0.7)
  );

  // Random sample from remaining complaints for geographic coverage
  const sampledComplaints = remainingComplaints
    .sort(() => Math.random() - 0.5)
    .slice(0, maxPoints - topComplaints.length);

  return [...topComplaints, ...sampledComplaints];
}

// Helper: fetch complaints via backend API (uses service key on server)
async function fetchComplaints(params = {}) {
  try {
    // Get user's department for filtering
    const user = checkAuth();
    let departmentFilter = null;
    if (user) {
      const role = String(user.role || user.type || "").toLowerCase();
      if (role.startsWith("lgu-admin-")) {
        departmentFilter = role.replace("lgu-admin-", "");
      } else if (role.startsWith("lgu-")) {
        departmentFilter = role.replace("lgu-", "");
      }
    }

    // Fetch all complaints and filter by assigned_unit
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/complaints${qs ? `?${qs}` : ""}`);
    if (!res.ok) {
      console.error("fetchComplaints: API returned non-OK", res.status);
      return [];
    }
    const body = await res.json();
    // Support different shapes: array or { complaints | data }
    let allComplaints = Array.isArray(body)
      ? body
      : body.complaints || body.data || [];

    // Filter by assigned_unit if user has a department
    if (departmentFilter && allComplaints.length > 0) {
      console.log(
        "🔍 Filtering complaints by assigned_unit:",
        departmentFilter
      );
      const filteredComplaints = allComplaints.filter(
        (complaint) => complaint.assigned_unit === departmentFilter
      );
      console.log("📊 Total complaints:", allComplaints.length);
      console.log(
        "📊 Filtered complaints for department:",
        filteredComplaints.length
      );
      return filteredComplaints;
    }

    console.log("📊 All complaints count:", allComplaints.length);
    return allComplaints;
  } catch (err) {
    console.error("fetchComplaints error:", err);
    return [];
  }
}

// Setup button event listeners
function setupButtonEventListeners() {
  // Use event delegation for dynamically created buttons
  document.addEventListener("click", (e) => {
    // Handle reload page button
    if (
      e.target.matches('[data-action="reload-page"]') ||
      e.target.closest('[data-action="reload-page"]')
    ) {
      location.reload();
    }

    // Handle view cluster complaints button
    if (
      e.target.matches('[data-action="view-cluster-complaints"]') ||
      e.target.closest('[data-action="view-cluster-complaints"]')
    ) {
      const button = e.target.closest(
        '[data-action="view-cluster-complaints"]'
      );
    }
  });
}
