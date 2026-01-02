/**
 * Map Generator - Simplified Leaflet Map with Tile Changer
 * Extracted from lgu-heatmap.js for reusability
 * Only includes essential map initialization and tile layer switching
 */
// Global map reference
window.simpleMap = null;
/**
 * Initialize a basic Leaflet map with tile layer switching
 * @param {string} containerId - ID of the HTML element to contain the map
 * @param {Object} options - Map configuration options
 * @returns {L.Map} - Leaflet map instance
 */
async function initializeSimpleMap(containerId = "map", options = {}) {
  try {
    // Check if map already exists
    if (window.simpleMap) {
      window.simpleMap.invalidateSize();
      return window.simpleMap;
    }
    // Ensure map container exists and has dimensions
    let mapContainer = document.getElementById(containerId);
    if (!mapContainer) {
      console.error(`Map container with ID '${containerId}' not found`);
      return null;
    }
    // Check if container has dimensions
    const rect = mapContainer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setTimeout(() => initializeSimpleMap(containerId, options), 100);
      return null;
    }
    // Ensure container is visible and has proper dimensions
    if (rect.width < 100 || rect.height < 100) {
      setTimeout(() => initializeSimpleMap(containerId, options), 200);
      return null;
    }
    // Default map options
    const defaultOptions = {
      center: [0,0], // Digos City, Philippines
      zoom: 10,
      zoomControl: true,
      preferCanvas: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true,
      dragging: true,
      worldCopyJump: false,
      minZoom: 11,
      maxBounds: L.latLngBounds([6.0, 125.0], [7.0, 125.7]),
      maxZoom: 18,
    };
    // Merge with provided options
    const mapOptions = { ...defaultOptions, ...options };
    // If container is already bound to a Leaflet map, reuse or force a clean host
    if (mapContainer.classList.contains("leaflet-container") || mapContainer._leaflet_id) {
      if (window.simpleMap) {
        window.simpleMap.invalidateSize();
        return window.simpleMap;
      }
      const fresh = mapContainer.cloneNode(false);
      mapContainer.parentNode.replaceChild(fresh, mapContainer);
      mapContainer = fresh;
    }
    // Create map
    const map = L.map(mapContainer, {
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
    }).setView(mapOptions.center, mapOptions.zoom);
    map.on("zoomend", () => {
      if (map.getZoom() <= mapOptions.minZoom) {
        map.dragging.disable();
      } else {
        map.dragging.enable();
      }
    });
    // console.log removed for security
    // console.log removed for security
    // Expose globally
    window.simpleMap = map;
    // Add tile layers
    const tileLayers = createTileLayers();
    // console.log removed for security
    // Validate tile layers were created
    if (!tileLayers || Object.keys(tileLayers).length === 0) {
      throw new Error("Failed to create tile layers");
    }
    // Add default tile layer
    const defaultLayer = tileLayers["OpenStreetMap"];
    if (!defaultLayer) {
      console.error("Available layers:", Object.keys(tileLayers));
      throw new Error("Default tile layer not found");
    }
    // console.log removed for security
    defaultLayer.addTo(map);
    // Add layer control for tile switching (positioned below other controls)
    const layerControl = L.control.layers(tileLayers, {}, {
      position: "topleft"
    }).addTo(map);
    // Store references globally
    window.simpleMapLayers = tileLayers;
    window.simpleMapLayerControl = layerControl;
    // Add resize observer to handle container size changes
    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainer);
      window._simpleMapResizeObserver = resizeObserver;
    }
    // Ensure map size is correct after load
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
    // console.log removed for security
    return map;
  } catch (error) {
    console.error("Error initializing simple map:", error);
    return null;
  }
}
/**
 * Create tile layers for the map
 * @returns {Object} - Object containing tile layer instances
 */
function createTileLayers() {
  const tileLayers = {
    // Standard OpenStreetMap
    "OpenStreetMap": L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }
    ),
    // Standard Light
    "Standard Light": L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "© OpenStreetMap © CARTO",
        maxZoom: 19,
      }
    ),
    // Standard Dark
    "Standard Dark": L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "© OpenStreetMap © CARTO",
        maxZoom: 19,
      }
    ),
    // Satellite imagery
    "Satellite": L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "© Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
        maxZoom: 19,
      }
    ),
    // Terrain
    "Terrain": L.tileLayer(
      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      {
        attribution: "© OpenTopoMap (CC-BY-SA)",
        maxZoom: 17,
      }
    ),
  };
  return tileLayers;
}
/**
 * Switch to a specific tile layer
 * @param {string} layerName - Name of the layer to switch to
 * @returns {boolean} - Success status
 */
function switchTileLayer(layerName) {

  if (!window.simpleMap || !window.simpleMapLayers) {
    console.error("Map not initialized");
    return false;
  }
  const targetLayer = window.simpleMapLayers[layerName];
  if (!targetLayer) {
    console.error(`Layer '${layerName}' not found`);
    return false;
  }
  // Remove all current tile layers
  Object.values(window.simpleMapLayers).forEach(layer => {
    if (window.simpleMap.hasLayer(layer)) {
      window.simpleMap.removeLayer(layer);
    }
  });
  // Add the target layer
  targetLayer.addTo(window.simpleMap);
  // console.log removed for security
  return true;
}
/**
 * Get current active tile layer name
 * @returns {string|null} - Name of current active layer or null
 */
function getCurrentTileLayer() {

  if (!window.simpleMap || !window.simpleMapLayers) {
    return null;
  }
  for (const [name, layer] of Object.entries(window.simpleMapLayers)) {
    if (window.simpleMap.hasLayer(layer)) {
      return name;
    }
  }
  return null;
}
/**
 * Get list of available tile layers
 * @returns {Array<string>} - Array of layer names
 */
function getAvailableTileLayers() {
  return window.simpleMapLayers ? Object.keys(window.simpleMapLayers) : [];
}
/**
 * Add a custom tile layer
 * @param {string} name - Name for the layer
 * @param {string} url - Tile URL template
 * @param {Object} options - Layer options
 * @returns {boolean} - Success status
 */
function addCustomTileLayer(name, url, options = {}) {

  if (!window.simpleMap || !window.simpleMapLayers) {
    console.error("Map not initialized");
    return false;
  }
  const customLayer = L.tileLayer(url, {
    attribution: "Custom Layer",
    maxZoom: 19,
    ...options
  });
  window.simpleMapLayers[name] = customLayer;
  // Update layer control
  if (window.simpleMapLayerControl) {
    window.simpleMapLayerControl.addOverlay(customLayer, name);
  }
  // console.log removed for security
  return true;
}
/**
 * Remove a tile layer
 * @param {string} name - Name of the layer to remove
 * @returns {boolean} - Success status
 */
function removeTileLayer(name) {

  if (!window.simpleMap || !window.simpleMapLayers || !window.simpleMapLayers[name]) {
    console.error(`Layer '${name}' not found`);
    return false;
  }
  const layer = window.simpleMapLayers[name];
  // Remove from map if active
  if (window.simpleMap.hasLayer(layer)) {
    window.simpleMap.removeLayer(layer);
  }
  // Remove from layer control
  if (window.simpleMapLayerControl) {
    window.simpleMapLayerControl.removeLayer(layer);
  }
  // Remove from layers object
  delete window.simpleMapLayers[name];
  // console.log removed for security
  return true;
}
/**
 * Clean up map resources
 */
function destroySimpleMap() {

  if (window.simpleMap) {
    window.simpleMap.remove();
    window.simpleMap = null;
  }
  if (window.simpleMapLayers) {
    window.simpleMapLayers = null;
  }
  if (window.simpleMapLayerControl) {
    window.simpleMapLayerControl = null;
  }
  if (window._simpleMapResizeObserver) {
    window._simpleMapResizeObserver.disconnect();
    window._simpleMapResizeObserver = null;
  }
  // console.log removed for security
}
// Export functions for use in other modules
if (typeof module !== "undefined" && module.exports) {

  module.exports = {
    initializeSimpleMap,
    switchTileLayer,
    getCurrentTileLayer,
    getAvailableTileLayers,
    addCustomTileLayer,
    removeTileLayer,
    destroySimpleMap
  };
}
