/**
 * complaint Location Picker - Simple Map for Location Selection
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
async function initializecomplaintLocationPicker(
  containerId = "complaint-map",
  options = {}
) {
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
      // Return a promise that resolves when the map is visible
      return new Promise((resolve) => {
        setTimeout(async () => {
          const map = await initializecomplaintLocationPicker(containerId, options);
          resolve(map);
        }, 500); // Check every 500ms
      });
    }
    // Default map options - restricted to Digos City boundaries
    const defaultOptions = {
      center: [6.7497, 125.357], // Digos City, Philippines (more accurate center)
      zoom: 13,
      zoomControl: true,
      preferCanvas: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
      worldCopyJump: false,
      minZoom: 10, // Restrict minimum zoom to keep focus on Digos City
      maxZoom: 18,
      // Restrict map bounds to Digos City area
      maxBounds: [
        [6.65, 125.2], // Southwest corner
        [7.0, 125.5], // Northeast corner
      ],
      maxBoundsViscosity: 1.0, // Prevent panning outside bounds
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
      maxBoundsViscosity: mapOptions.maxBoundsViscosity || 1.0,
    });

    // Ensure map container handles inputs
    mapContainer.style.zIndex = "1";
    mapContainer.style.pointerEvents = "auto";
    // Set initial view
    map.setView(mapOptions.center, mapOptions.zoom);
    // Add OpenStreetMap tile layer
    const osmLayer = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }
    );
    osmLayer.addTo(map);
    // Add satellite layer option
    const satelliteLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "© Esri",
        maxZoom: 18,
      }
    );
    // Add layer control
    const baseLayers = {
      "Street Map": osmLayer,
      Satellite: satelliteLayer,
    };
    const _layerControl = L.control
      .layers(
        baseLayers,
        {},
        {
          position: "topright",
        }
      )
      .addTo(map);

    // Load and display Digos City boundaries
    try {
      const boundaryResponse = await fetch("/api/public/boundaries");
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
                  fillColor: "#3388ff",
                },
              });
              geojsonLayer.addTo(map);
            }
          });

          // Fit map to boundaries
          if (brgyData.length > 0) {
            const allFeatures = brgyData
              .filter((b) => b.geojson)
              .map((b) => b.geojson);
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

  async function notify(type, message) {
    try {
      const mod = await import("../../components/toast.js");
      const showMessage = mod?.default;
      if (typeof showMessage === "function") {
        showMessage(type, message);
        return;
      }
    } catch {
      // ignore
    }

    // Last resort: make sure user sees *something*
    try {
      // eslint-disable-next-line no-alert -- Fallback only if toast fails
      alert(message);
    } catch {
      // ignore
    }
  }

  // Prevent toast spam/"loop" feeling when users retry quickly on mobile.
  // Keyed by a stable string so the same problem only notifies once per cooldown window.
  const notifyCooldowns = new Map();
  function notifyOnce(key, type, message, cooldownMs = 10000) {
    const now = Date.now();
    const lastShownAt = notifyCooldowns.get(key) || 0;
    if (now - lastShownAt < cooldownMs) return;
    notifyCooldowns.set(key, now);
    notify(type, message);
  }

  function isLocalhostHost(hostname) {
    return hostname === "localhost" || hostname === "127.0.0.1";
  }

  // Get hidden input fields
  const latInput = document.getElementById("latitude");
  const lngInput = document.getElementById("longitude");
  const locationInput = document.getElementById("location");
  if (locationInput) {
    locationInput.readOnly = true;
    locationInput.setAttribute("aria-live", "polite");
    locationInput.setAttribute(
      "title",
      "Tap the map or drag the pin to change the address."
    );
  }
  if (!latInput || !lngInput) {
    console.error("Latitude/longitude input fields not found");
    return;
  }
  let marker = null;

  // Reverse geocode: throttle + cache to avoid Nominatim 429s
  const geocodeCache = new Map();
  const GEOCODE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  const GEOCODE_DEBOUNCE_MS = 650;
  const GEOCODE_MIN_INTERVAL_MS = 1200;
  let geocodeCooldownUntil = 0;
  let lastGeocodeStartedAt = 0;
  let geocodeDebounceTimer = null;
  let geocodeAbortController = null;
  let latestGeocodeKey = null;

  function getGeocodeKey(lat, lng) {
    return `${parseFloat(lat).toFixed(5)},${parseFloat(lng).toFixed(5)}`;
  }

  function getCachedAddress(cacheKey) {
    const entry = geocodeCache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > GEOCODE_CACHE_TTL_MS) {
      geocodeCache.delete(cacheKey);
      return null;
    }
    return entry.value;
  }
  // Create initial marker at map center (using divIcon for CSP compliance)
  const initialCenter = map.getCenter();
  marker = L.marker([initialCenter.lat, initialCenter.lng], {
    draggable: true,
    zIndexOffset: 1000, // Ensure marker is always on top
    icon: L.divIcon({
      html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#3b82f6" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); width: 36px; height: 36px; display: block;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="white"></circle></svg>`,
      className: "valid-location-marker",
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    }),
  }).addTo(map);

  // Boundary validation function
  async function validateCoordinates(lat, lng) {
    try {
      // Import boundary validator directly
      const boundaryValidator = await import(
        "../../utils/boundaryValidator.js"
      );
      if (boundaryValidator && boundaryValidator.isWithinDigosBoundary) {
        return await boundaryValidator.isWithinDigosBoundary(lat, lng);
      }
      // Fallback: use validation utility
      const { isWithinCityBoundary } = await import(
        "../../utils/validation.js"
      );
      return await isWithinCityBoundary(lat, lng);
    } catch (error) {
      console.warn("[COMPLAINT_MAP] Boundary validation failed:", error);
      // Fallback to bounding box check
      const minLat = 6.65;
      const maxLat = 7.0;
      const minLng = 125.2;
      const maxLng = 125.5;
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
    warning.textContent =
      "⚠️ Location must be within Digos City boundaries. Submission is disabled.";
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
    // Re-query inputs to be safe
    const latInput = document.getElementById("latitude");
    const lngInput = document.getElementById("longitude");

    if (latInput) latInput.value = parseFloat(lat.toFixed(8)).toString();
    if (lngInput) lngInput.value = parseFloat(lng.toFixed(8)).toString();

    // Validate coordinates against boundary
    const isValid = await validateCoordinates(lat, lng);
    coordinatesValid = isValid;

    // Update submit button state based on coordinate validity
    updateSubmitButtonState();

    if (!isValid && showWarning) {
      showBoundaryWarning();
      // Change marker color to red to indicate invalid location (using divIcon for CSP compliance)
      if (marker) {
        marker.setIcon(
          L.divIcon({
            html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#ef4444" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); width: 36px; height: 36px; display: block;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>`,
            className: "invalid-location-marker",
            iconSize: [36, 36],
            iconAnchor: [18, 36],
          })
        );
      }
    } else {
      hideBoundaryWarning();
      // Reset marker to default blue (using divIcon for CSP compliance)
      if (marker) {
        marker.setIcon(
          L.divIcon({
            html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#3b82f6" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); width: 36px; height: 36px; display: block;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3" fill="white"></circle></svg>`,
            className: "valid-location-marker",
            iconSize: [36, 36],
            iconAnchor: [18, 36],
          })
        );
      }
    }
  }

  // Update submit button state based on coordinate validity
  function updateSubmitButtonState() {
    const submitBtn = document.querySelector(
      '.submit-btn, button[type="submit"]'
    );
    if (submitBtn) {
      if (!coordinatesValid) {
        submitBtn.disabled = true;
        submitBtn.title =
          "Please select a location within Digos City boundaries";
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
    const locationInput = document.getElementById("location");
    if (!locationInput) return;

    // Set immediate placeholder to ensure field is not empty
    const coordString = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    locationInput.value = coordString;

    const cacheKey = getGeocodeKey(lat, lng);
    latestGeocodeKey = cacheKey;

    const cachedAddress = getCachedAddress(cacheKey);
    if (cachedAddress) {
      locationInput.value = cachedAddress;
      return;
    }

    const now = Date.now();
    if (now < geocodeCooldownUntil) {
      locationInput.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      return;
    }

    if (geocodeDebounceTimer) {
      clearTimeout(geocodeDebounceTimer);
      geocodeDebounceTimer = null;
    }

    geocodeDebounceTimer = setTimeout(async () => {
      // Avoid starting requests too frequently even when user taps quickly
      const sinceLastStart = Date.now() - lastGeocodeStartedAt;
      if (sinceLastStart < GEOCODE_MIN_INTERVAL_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, GEOCODE_MIN_INTERVAL_MS - sinceLastStart)
        );
      }

      // Abort any in-flight request so we don't apply stale addresses
      if (geocodeAbortController) {
        geocodeAbortController.abort();
      }
      geocodeAbortController = new AbortController();
      lastGeocodeStartedAt = Date.now();

      const requestKey = cacheKey;

      try {
        const response = await fetch(
          `/api/reverse-geocode?lat=${lat}&lng=${lng}`,
          { signal: geocodeAbortController.signal }
        );

        if (response.status === 429) {
          let retryAfterSeconds = 10;
          const headerRetry = response.headers.get("retry-after");
          if (headerRetry) {
            const parsed = Number.parseInt(headerRetry, 10);
            if (Number.isFinite(parsed) && parsed > 0) retryAfterSeconds = parsed;
          }

          try {
            const data = await response.json();
            if (
              data &&
              Number.isFinite(data.retryAfterSeconds) &&
              data.retryAfterSeconds > 0
            ) {
              retryAfterSeconds = data.retryAfterSeconds;
            }
          } catch {
            // ignore
          }

          geocodeCooldownUntil = Date.now() + retryAfterSeconds * 1000;
          locationInput.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const address = data && data.display_name ? data.display_name : null;

        if (address) {
          geocodeCache.set(requestKey, {
            value: address,
            timestamp: Date.now()
          });
        }

        // Only apply if this is still the latest requested coordinate set
        if (latestGeocodeKey === requestKey) {
          locationInput.value = address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
      } catch (error) {
        if (error && error.name === "AbortError") return;

        locationInput.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        if (!locationInput.value.trim()) {
          locationInput.value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
      }
    }, GEOCODE_DEBOUNCE_MS);
  }
  // Set initial coordinates with validation (don't show warning on initial load)
  // Validate initial coordinates and update submit button state
  updateCoordinates(initialCenter.lat, initialCenter.lng, false).then(() => {
    updateLocationText(initialCenter.lat, initialCenter.lng);
  });
  // Marker drag events with boundary validation
  // Only update coordinates on dragend to ensure exact final position is captured
  marker.on("drag", async (_e) => {
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
    if (
      Math.abs(savedLat - markerLat) > 0.000001 ||
      Math.abs(savedLng - markerLng) > 0.000001
    ) {
      marker.setLatLng([savedLat, savedLng]);
    }
  });
  // Map click events with boundary validation
  map.on("click", async (e) => {
    // if (isUserInteracting) return; // Removed to prevent stuck state preventing clicks
    const { lat, lng } = e.latlng;
    // Set marker position first, then get exact position from marker
    marker.setLatLng([lat, lng]);
    // Get exact position from marker to ensure consistency
    const markerPos = marker.getLatLng();
    await updateCoordinates(markerPos.lat, markerPos.lng, true);
    updateLocationText(markerPos.lat, markerPos.lng);
  });
  // Auto locate button (placed below the map in the page)
  const autoLocateBtn = document.getElementById("btn-auto-locate");

  let autoLocateInFlight = false;

  function setAutoLocateBusy(isBusy) {
    if (!autoLocateBtn) return;
    autoLocateBtn.disabled = isBusy;
    autoLocateBtn.setAttribute("aria-busy", String(Boolean(isBusy)));
  }

  const runAutoLocate = async () => {
    if (autoLocateInFlight) return;

    // Most mobile browsers block geolocation on plain HTTP for non-localhost pages.
    // If we keep attempting anyway, users get repeated warnings/errors that feel like a loop.
    if (!window.isSecureContext && !isLocalhostHost(window.location.hostname)) {
      notifyOnce(
        "geo_insecure_context",
        "error",
        "Auto locate requires HTTPS on most phones. Open this page over HTTPS (see Dev HTTPS setup) or select manually on the map.",
        15000
      );
      return;
    }

    if (!navigator.geolocation) {
      notifyOnce(
        "geo_unsupported",
        "error",
        "Geolocation is not supported by this browser. Please select manually on the map."
      );
      return;
    }

    autoLocateInFlight = true;
    setAutoLocateBusy(true);

    // Best-effort permission precheck (not supported on all browsers, notably some iOS Safari versions)
    try {
      if (navigator.permissions?.query) {
        const perm = await navigator.permissions.query({ name: "geolocation" });
        if (perm?.state === "denied") {
          notifyOnce(
            "geo_permission_denied_precheck",
            "error",
            "Location access is blocked. Enable location permission for this site, then try again — or select manually on the map.",
            15000
          );
          autoLocateInFlight = false;
          setAutoLocateBusy(false);
          return;
        }
      }
    } catch {
      // ignore
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000, // 5 minutes
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const { accuracy } = position.coords;

          if (accuracy > 100) {
            console.warn(
              `⚠️ Low accuracy: ${accuracy}m. Location may not be precise.`
            );
          }

          const isValid = await validateCoordinates(lat, lng);
          if (!isValid) {
            notifyOnce(
              "geo_out_of_bounds",
              "error",
              "Your current location is outside Digos City boundaries. Please select a location within the city on the map.",
              15000
            );
            return;
          }

          map.setView([lat, lng], 16);
          marker.setLatLng([lat, lng]);
          const markerPos = marker.getLatLng();
          await updateCoordinates(markerPos.lat, markerPos.lng, true);
          updateLocationText(markerPos.lat, markerPos.lng);
        } finally {
          autoLocateInFlight = false;
          setAutoLocateBusy(false);
        }
      },
      (error) => {
        console.error("❌ Geolocation error:", error);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            notifyOnce(
              "geo_permission_denied",
              "error",
              "Location access denied. Allow location access for this site, then try again — or select manually on the map.",
              15000
            );
            break;
          case error.POSITION_UNAVAILABLE:
            notifyOnce(
              "geo_position_unavailable",
              "error",
              "Location information unavailable. Please select manually on the map.",
              12000
            );
            break;
          case error.TIMEOUT:
            notifyOnce(
              "geo_timeout",
              "error",
              "Location request timed out. Please try again or select manually on the map.",
              12000
            );
            break;
          default:
            notifyOnce(
              "geo_unknown",
              "error",
              "Unable to get your location. Please select manually on the map.",
              12000
            );
            break;
        }

        autoLocateInFlight = false;
        setAutoLocateBusy(false);
      },
      options
    );
  };

  if (autoLocateBtn) {
    autoLocateBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      runAutoLocate();
    });
  }
  // console.log removed for security
}
/**
 * Initialize the complete complaint location picker
 */
async function initializecomplaintLocationPickerComplete() {
  try {
    const map = await initializecomplaintLocationPicker();
    if (map) {
      setupLocationPicker(map);
    }
  } catch (error) {
    console.error("Failed to initialize complaint location picker:", error);
  }
}
// Auto-initialize when DOM is ready
document.addEventListener(
  "DOMContentLoaded",
  initializecomplaintLocationPickerComplete
);
// Export functions for manual use
window.initializecomplaintLocationPicker = initializecomplaintLocationPicker;
window.setupLocationPicker = setupLocationPicker;
