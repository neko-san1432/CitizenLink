/**
 * Complaint Location Picker - Simple Map for Location Selection
 * Dedicated map component for complaint form without restrictive zoom limits
 */
// Global map reference for complaint form
window.complaintMap = null;
/**
 * Initialize a simple map for complaint location selection
 * @param {string} containerId - ID of the HTML element to contain the map
 * @param {Object} options - Map configuration options
 * @returns {L.Map} - Leaflet map instance
 */
async function initializeComplaintLocationPicker(containerId = "complaint-map", options = {}) {
  try {
    // Check if map already exists
    if (window.complaintMap) {
      window.complaintMap.invalidateSize();
      return window.complaintMap;
    }
    // Ensure map container exists and has dimensions
    const mapContainer = document.getElementById(containerId);
    if (!mapContainer) {
      console.error(`Map container with ID '${containerId}' not found`);
      return null;
    }
    // Check if container has dimensions
    const rect = mapContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setTimeout(() => initializeComplaintLocationPicker(containerId, options), 100);
      return null;
    }
    // Default map options - restricted to Digos City boundaries
    const defaultOptions = {
      center: [6.7497, 125.3570], // Digos City, Philippines (more accurate center)
      zoom: 13,
      zoomControl: true,
      preferCanvas: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
      worldCopyJump: false,
      minZoom: 11, // Restrict minimum zoom to keep focus on Digos City
      maxZoom: 18,
      // Restrict map bounds to Digos City area
      maxBounds: [
        [6.723539, 125.245633], // Southwest corner
        [6.985025, 125.391290]  // Northeast corner
      ],
      maxBoundsViscosity: 1.0 // Prevent panning outside bounds
    };
    // Merge with provided options
    const mapOptions = { ...defaultOptions, ...options };
    // Create map
    const map = L.map(containerId, {
      zoomControl: mapOptions.zoomControl,
      preferCanvas: mapOptions.preferCanvas,
      scrollWheelZoom: mapOptions.scrollWheelZoom,
      doubleClickZoom: mapOptions.doubleClickZoom,
      boxZoom: mapOptions.boxZoom,
      keyboard: mapOptions.keyboard,
      dragging: mapOptions.dragging,
      worldCopyJump: mapOptions.worldCopyJump,
      minZoom: mapOptions.minZoom,
      maxZoom: mapOptions.maxZoom,
      maxBounds: mapOptions.maxBounds,
      maxBoundsViscosity: mapOptions.maxBoundsViscosity || 1.0
    });
    // Set initial view
    map.setView(mapOptions.center, mapOptions.zoom);
    // Add OpenStreetMap tile layer
    const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18
    });
    osmLayer.addTo(map);
    // Add satellite layer option
    const satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "© Esri",
      maxZoom: 18
    });
    // Add layer control
    const baseLayers = {
      "Street Map": osmLayer,
      "Satellite": satelliteLayer
    };
    const layerControl = L.control.layers(baseLayers, {}, {
      position: "topright"
    }).addTo(map);

    // Load and display Digos City boundaries
    try {
      const boundaryResponse = await fetch("/api/boundaries");
      if (boundaryResponse.ok) {
        const brgyData = await boundaryResponse.json();
        if (Array.isArray(brgyData)) {
          // Store boundaries globally for validation
          window.complaintFormBoundaries = brgyData;

          // Add each barangay boundary to the map
          brgyData.forEach((barangay) => {
            if (barangay.geojson) {
              const geojsonLayer = L.geoJSON(barangay.geojson, {
                style: {
                  color: "#3388ff",
                  weight: 2,
                  opacity: 0.8,
                  fillOpacity: 0.1,
                  fillColor: "#3388ff"
                }
              });
              geojsonLayer.addTo(map);
            }
          });

          // Fit map to boundaries
          if (brgyData.length > 0) {
            const allFeatures = brgyData
              .filter(b => b.geojson)
              .map(b => b.geojson);
            const bounds = L.geoJSON(allFeatures).getBounds();
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [20, 20] });
            }
          }
        }
      }
    } catch (error) {
      console.warn("[COMPLAINT_MAP] Failed to load boundaries:", error);
    }
    // console.log removed for security
    // console.log removed for security
    // console.log removed for security
    // Expose globally
    window.complaintMap = map;
    // Add resize observer to handle container size changes
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        if (map) {
          setTimeout(() => map.invalidateSize(), 100);
        }
      });
      resizeObserver.observe(mapContainer);
    }
    return map;
  } catch (error) {
    console.error("Failed to initialize complaint location picker:", error);
    return null;
  }
}
/**
 * Setup location picker functionality for complaint form
 * @param {L.Map} map - Leaflet map instance
 */
function setupLocationPicker(map) {
  if (!map) return;
  // Get hidden input fields
  const latInput = document.getElementById("latitude");
  const lngInput = document.getElementById("longitude");
  const locationInput = document.getElementById("location");
  if (locationInput) {
    locationInput.readOnly = true;
    locationInput.setAttribute("aria-live", "polite");
    locationInput.setAttribute("title", "Move the map or drag the pin to change the address.");
  }
  if (!latInput || !lngInput) {
    console.error("Latitude/longitude input fields not found");
    return;
  }
  let marker = null;
  let isUserInteracting = false;
  // Create initial marker at map center (using divIcon for CSP compliance)
  const initialCenter = map.getCenter();
  marker = L.marker([initialCenter.lat, initialCenter.lng], {
    draggable: true,
    icon: L.divIcon({
      html: `<div style="
        background-color: #3388ff;
        color: white;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        font-size: 18px;
        font-weight: bold;
      ">📍</div>`,
      className: "valid-location-marker",
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    })
  }).addTo(map);

  // Boundary validation function
  async function validateCoordinates(lat, lng) {
    try {
      // Import boundary validator directly
      const boundaryValidator = await import("../../utils/boundaryValidator.js");
      if (boundaryValidator && boundaryValidator.isWithinDigosBoundary) {
        return await boundaryValidator.isWithinDigosBoundary(lat, lng);
      }
      // Fallback: use validation utility
      const { isWithinCityBoundary } = await import("../../utils/validation.js");
      return await isWithinCityBoundary(lat, lng);
    } catch (error) {
      console.warn("[COMPLAINT_MAP] Boundary validation failed:", error);
      // Fallback to bounding box check
      const minLat = 6.723539;
      const maxLat = 6.985025;
      const minLng = 125.245633;
      const maxLng = 125.391290;
      return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
    }
  }

  // Show boundary warning
  function showBoundaryWarning() {
    const existingWarning = document.getElementById("boundary-warning");
    if (existingWarning) return;

    const warning = document.createElement("div");
    warning.id = "boundary-warning";
    warning.style.cssText = `
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: #ff6b6b;
      color: white;
      padding: 10px 20px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 1000;
      font-size: 14px;
      font-weight: 500;
      max-width: 90%;
      text-align: center;
    `;
    warning.textContent = "⚠️ Location must be within Digos City boundaries. Submission is disabled.";
    const mapContainer = map.getContainer();
    mapContainer.style.position = "relative";
    mapContainer.appendChild(warning);

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (warning.parentNode) {
        warning.style.transition = "opacity 0.3s";
        warning.style.opacity = "0";
        setTimeout(() => warning.remove(), 300);
      }
    }, 5000);
  }

  // Hide boundary warning
  function hideBoundaryWarning() {
    const warning = document.getElementById("boundary-warning");
    if (warning) {
      warning.style.transition = "opacity 0.3s";
      warning.style.opacity = "0";
      setTimeout(() => warning.remove(), 300);
    }
  }


  // Track coordinate validity state
  let coordinatesValid = false;

  // Update coordinates function with boundary validation
  async function updateCoordinates(lat, lng, showWarning = true) {
    // Use higher precision (8 decimal places) for better accuracy
    // This ensures the exact marker position is captured
    latInput.value = parseFloat(lat.toFixed(8)).toString();
    lngInput.value = parseFloat(lng.toFixed(8)).toString();

    // Validate coordinates against boundary
    const isValid = await validateCoordinates(lat, lng);
    coordinatesValid = isValid;

    // Update submit button state based on coordinate validity
    updateSubmitButtonState();

    if (!isValid && showWarning) {
      showBoundaryWarning();
      // Change marker color to red to indicate invalid location (using divIcon for CSP compliance)
      if (marker) {
        marker.setIcon(L.divIcon({
          html: `<div style="
            background-color: #dc3545;
            color: white;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            font-size: 18px;
            font-weight: bold;
          ">⚠️</div>`,
          className: "invalid-location-marker",
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        }));
      }
    } else {
      hideBoundaryWarning();
      // Reset marker to default blue (using divIcon for CSP compliance)
      if (marker) {
        marker.setIcon(L.divIcon({
          html: `<div style="
            background-color: #3388ff;
            color: white;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            font-size: 18px;
            font-weight: bold;
          ">📍</div>`,
          className: "valid-location-marker",
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        }));
      }
    }
  }

  // Update submit button state based on coordinate validity
  function updateSubmitButtonState() {
    const submitBtn = document.querySelector('.submit-btn, button[type="submit"]');
    if (submitBtn) {
      if (!coordinatesValid) {
        submitBtn.disabled = true;
        submitBtn.title = "Please select a location within Digos City boundaries";
        submitBtn.style.opacity = "0.6";
        submitBtn.style.cursor = "not-allowed";
      } else {
        submitBtn.disabled = false;
        submitBtn.title = "";
        submitBtn.style.opacity = "1";
        submitBtn.style.cursor = "pointer";
      }
    }
  }
  // Update location text function
  async function updateLocationText(lat, lng) {
    if (!locationInput) return;
    try {
      // console.log removed for security
      // Use server-side reverse geocoding endpoint to avoid CORS issues
      const response = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // console.log removed for security
      if (data && data.display_name) {
        locationInput.value = data.display_name;
        // console.log removed for security
      } else {
        // Fallback to coordinates
        locationInput.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        // console.log removed for security
      }
    } catch (error) {
      // console.log removed for security
      // Fallback to coordinates
      locationInput.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      // console.log removed for security
      // Ensure location field is not empty for validation
      if (!locationInput.value.trim()) {
        locationInput.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
    }
  }
  // Set initial coordinates with validation (don't show warning on initial load)
  // Validate initial coordinates and update submit button state
  updateCoordinates(initialCenter.lat, initialCenter.lng, false).then(() => {
    updateLocationText(initialCenter.lat, initialCenter.lng);
  });
  // Marker drag events with boundary validation
  // Only update coordinates on dragend to ensure exact final position is captured
  marker.on("drag", async (e) => {
    // Don't update coordinates during drag - wait for dragend to get exact final position
    // This prevents intermediate positions from being saved
  });
  marker.on("dragend", async (e) => {
    // Get the exact final position of the marker
    const latlng = e.target.getLatLng();
    const finalLat = latlng.lat;
    const finalLng = latlng.lng;

    // Ensure marker position matches input values exactly
    await updateCoordinates(finalLat, finalLng, true); // Show warning on drag end
    updateLocationText(finalLat, finalLng);

    // Double-check: ensure marker position matches saved coordinates
    const savedLat = parseFloat(latInput.value);
    const savedLng = parseFloat(lngInput.value);
    const markerLat = marker.getLatLng().lat;
    const markerLng = marker.getLatLng().lng;

    // If there's a mismatch, update marker to match saved coordinates
    if (Math.abs(savedLat - markerLat) > 0.000001 || Math.abs(savedLng - markerLng) > 0.000001) {
      marker.setLatLng([savedLat, savedLng]);
    }
  });
  // Map click events with boundary validation
  map.on("click", async (e) => {
    if (isUserInteracting) return;
    const { lat, lng } = e.latlng;
    // Set marker position first, then get exact position from marker
    marker.setLatLng([lat, lng]);
    // Get exact position from marker to ensure consistency
    const markerPos = marker.getLatLng();
    await updateCoordinates(markerPos.lat, markerPos.lng, true);
    updateLocationText(markerPos.lat, markerPos.lng);
  });
  // Map move events (when user drags the map) with boundary validation
  map.on("movestart", () => {
    isUserInteracting = true;
  });
  map.on("moveend", async () => {
    if (!isUserInteracting) return;
    const center = map.getCenter();
    // Set marker position first, then get exact position from marker
    marker.setLatLng([center.lat, center.lng]);
    // Get exact position from marker to ensure consistency
    const markerPos = marker.getLatLng();
    await updateCoordinates(markerPos.lat, markerPos.lng, true);
    updateLocationText(markerPos.lat, markerPos.lng);
    isUserInteracting = false;
  });
  // Geolocation button
  const geolocationButton = L.control({ position: "topleft" });
  geolocationButton.onAdd = function(map) {
    const div = L.DomUtil.create("div", "geolocation-control");
    div.innerHTML = '<button type="button" title="Use my location">📍</button>';
    div.style.cssText = "background: white; border: 2px solid rgba(0,0,0,0.2); border-radius: 4px; padding: 2px;";
    div.onclick = function() {
      // console.log removed for security
      if (navigator.geolocation) {
        // console.log removed for security
        // Check geolocation permissions
        if (navigator.permissions) {
          navigator.permissions.query({ name: "geolocation" }).then((result) => {
            // console.log removed for security
          });
        }
        // console.log removed for security
        const options = {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        };
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            // console.log removed for security
            // console.log removed for security
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const {accuracy} = position.coords;
            const {altitude} = position.coords;
            const {heading} = position.coords;
            const {speed} = position.coords;
            const timestamp = new Date(position.timestamp);
            // console.log removed for security
            // console.log removed for security
            // console.log removed for security
            // console.log removed for security
            // console.log removed for security
            // console.log removed for security
            // console.log removed for security
            // console.log removed for security
            // Check accuracy
            if (accuracy > 100) {
              console.warn(`⚠️ Low accuracy: ${accuracy}m. Location may not be precise.`);
            } else {
              // console.log removed for security
            }
            // Validate geolocation coordinates against boundary
            const isValid = await validateCoordinates(lat, lng);
            if (!isValid) {
              alert("Your current location is outside Digos City boundaries. Please select a location within the city on the map.");
              return;
            }
            map.setView([lat, lng], 16);
            // Set marker position first, then get exact position from marker
            marker.setLatLng([lat, lng]);
            // Get exact position from marker to ensure consistency
            const markerPos = marker.getLatLng();
            const exactLat = markerPos.lat;
            const exactLng = markerPos.lng;
            await updateCoordinates(exactLat, exactLng, true);
            updateLocationText(exactLat, exactLng);
            // console.log removed for security
          },
          (error) => {
            console.error("❌ Geolocation error:", error);
            // console.log removed for security
            switch(error.code) {
              case error.PERMISSION_DENIED:
              // console.log removed for security
                alert("Location access denied. Please allow location access or select manually on the map.");
                break;
              case error.POSITION_UNAVAILABLE:
              // console.log removed for security
                alert("Location information unavailable. Please select manually on the map.");
                break;
              case error.TIMEOUT:
              // console.log removed for security
                alert("Location request timed out. Please try again or select manually on the map.");
                break;
              default:
              // console.log removed for security
                alert("Unable to get your location. Please select manually on the map.");
                break;
            }
          },
          options
        );
      } else {
        console.error("❌ Geolocation is not supported by this browser");
        alert("Geolocation is not supported by this browser. Please select manually on the map.");
      }
    };
    return div;
  };
  geolocationButton.addTo(map);
  // console.log removed for security
}
/**
 * Initialize the complete complaint location picker
 */
async function initializeComplaintLocationPickerComplete() {
  try {
    const map = await initializeComplaintLocationPicker();
    if (map) {
      setupLocationPicker(map);
    }
  } catch (error) {
    console.error("Failed to initialize complaint location picker:", error);
  }
}
// Auto-initialize when DOM is ready
document.addEventListener("DOMContentLoaded", initializeComplaintLocationPickerComplete);
// Export functions for manual use
window.initializeComplaintLocationPicker = initializeComplaintLocationPicker;
window.setupLocationPicker = setupLocationPicker;
