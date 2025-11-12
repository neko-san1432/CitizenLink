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
async function initializeComplaintLocationPicker(containerId = 'complaint-map', options = {}) {
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
    // Default map options - much more permissive than map-generator
    const defaultOptions = {
      center: [7.1975, 125.3481], // Digos City, Philippines
      zoom: 13,
      zoomControl: true,
      preferCanvas: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
      worldCopyJump: false,
      minZoom: 3, // Much lower minimum zoom - allows global view
      maxZoom: 18, // Same maximum zoom
      // No maxBounds restriction - users can navigate anywhere
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
    });
    // Set initial view
    map.setView(mapOptions.center, mapOptions.zoom);
    // Add OpenStreetMap tile layer
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    });
    osmLayer.addTo(map);
    // Add satellite layer option
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 18
    });
    // Add layer control
    const baseLayers = {
      'Street Map': osmLayer,
      'Satellite': satelliteLayer
    };
    const layerControl = L.control.layers(baseLayers, {}, {
      position: 'topright'
    }).addTo(map);
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
    console.error('Failed to initialize complaint location picker:', error);
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
  const latInput = document.getElementById('latitude');
  const lngInput = document.getElementById('longitude');
  const locationInput = document.getElementById('location');
  if (!latInput || !lngInput) {
    console.error('Latitude/longitude input fields not found');
    return;
  }
  let marker = null;
  let isUserInteracting = false;
  // Create initial marker at map center
  const initialCenter = map.getCenter();
  marker = L.marker([initialCenter.lat, initialCenter.lng], {
    draggable: true
  }).addTo(map);
  // Update coordinates function
  function updateCoordinates(lat, lng) {
    latInput.value = lat.toFixed(6);
    lngInput.value = lng.toFixed(6);
    // console.log removed for security
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
  // Set initial coordinates
  updateCoordinates(initialCenter.lat, initialCenter.lng);
  updateLocationText(initialCenter.lat, initialCenter.lng);
  // Marker drag events
  marker.on('drag', (e) => {
    const latlng = e.target.getLatLng();
    // console.log removed for security
    updateCoordinates(latlng.lat, latlng.lng);
  });
  marker.on('dragend', (e) => {
    const latlng = e.target.getLatLng();
    // console.log removed for security
    updateCoordinates(latlng.lat, latlng.lng);
    updateLocationText(latlng.lat, latlng.lng);
  });
  // Map click events
  map.on('click', (e) => {
    if (isUserInteracting) return;
    const { lat, lng } = e.latlng;
    // console.log removed for security
    marker.setLatLng([lat, lng]);
    updateCoordinates(lat, lng);
    updateLocationText(lat, lng);
  });
  // Map move events (when user drags the map)
  map.on('movestart', () => {
    isUserInteracting = true;
    // console.log removed for security
  });
  map.on('moveend', () => {
    if (!isUserInteracting) return;
    const center = map.getCenter();
    // console.log removed for security
    marker.setLatLng([center.lat, center.lng]);
    updateCoordinates(center.lat, center.lng);
    updateLocationText(center.lat, center.lng);
    isUserInteracting = false;
  });
  // Geolocation button
  const geolocationButton = L.control({ position: 'topleft' });
  geolocationButton.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'geolocation-control');
    div.innerHTML = '<button type="button" title="Use my location">📍</button>';
    div.style.cssText = 'background: white; border: 2px solid rgba(0,0,0,0.2); border-radius: 4px; padding: 2px;';
    div.onclick = function() {
      // console.log removed for security
      if (navigator.geolocation) {
        // console.log removed for security
        // Check geolocation permissions
        if (navigator.permissions) {
          navigator.permissions.query({ name: 'geolocation' }).then((result) => {
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
          (position) => {
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
            // console.log removed for security
            map.setView([lat, lng], 16);
            marker.setLatLng([lat, lng]);
            updateCoordinates(lat, lng);
            updateLocationText(lat, lng);
            // console.log removed for security
          },
          (error) => {
            console.error('❌ Geolocation error:', error);
            // console.log removed for security
            switch(error.code) {
              case error.PERMISSION_DENIED:
              // console.log removed for security
                alert('Location access denied. Please allow location access or select manually on the map.');
                break;
              case error.POSITION_UNAVAILABLE:
              // console.log removed for security
                alert('Location information unavailable. Please select manually on the map.');
                break;
              case error.TIMEOUT:
              // console.log removed for security
                alert('Location request timed out. Please try again or select manually on the map.');
                break;
              default:
              // console.log removed for security
                alert('Unable to get your location. Please select manually on the map.');
                break;
            }
          },
          options
        );
      } else {
        console.error('❌ Geolocation is not supported by this browser');
        alert('Geolocation is not supported by this browser. Please select manually on the map.');
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
    console.error('Failed to initialize complaint location picker:', error);
  }
}
// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeComplaintLocationPickerComplete);
// Export functions for manual use
window.initializeComplaintLocationPicker = initializeComplaintLocationPicker;
window.setupLocationPicker = setupLocationPicker;
