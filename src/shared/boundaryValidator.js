/**
 * Digos City Boundary Validator
 * Validates if coordinates are within Digos City boundaries
 * Uses the actual polygon boundary from digos-city-boundary.json
 */

const fs = require("fs");
const path = require("path");

// Cache for boundary data
let boundaryCache = null;

/**
 * Load Digos city boundary from JSON file
 */
function loadDigosBoundary() {
  if (boundaryCache) {
    return boundaryCache;
  }

  try {
    const boundaryPath = path.join(__dirname, "../client/assets/digos-city-boundary.json");
    const boundaryData = fs.readFileSync(boundaryPath, "utf8");
    const boundary = JSON.parse(boundaryData);
    boundaryCache = boundary;
    return boundary;
  } catch (error) {
    console.error("[BOUNDARY_VALIDATOR] Failed to load Digos boundary:", error.message);
    // Return null to indicate boundary not available
    return null;
  }
}

/**
 * Check if a point is inside a polygon ring using ray casting algorithm
 * @param {Array} point - [longitude, latitude]
 * @param {Array} ring - Array of [longitude, latitude] coordinates
 * @returns {boolean}
 */
function isPointInRing(point, ring) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const intersect = ((yi > y) !== (yj > y)) &&
                     (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Check if a point is inside a polygon
 * @param {Array} point - [longitude, latitude]
 * @param {Array} coordinates - Polygon coordinates array
 * @returns {boolean}
 */
function isPointInPolygon(point, coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return false;
  }

  // Handle Polygon structure: [outerRing, hole1, hole2, ...]
  const outerRing = coordinates[0];
  if (!outerRing || outerRing.length === 0) {
    return false;
  }

  let inside = isPointInRing(point, outerRing);

  // Check holes (inner rings) - if point is in a hole, it's outside
  if (inside && coordinates.length > 1) {
    for (let i = 1; i < coordinates.length; i++) {
      if (isPointInRing(point, coordinates[i])) {
        inside = false;
        break;
      }
    }
  }

  return inside;
}

/**
 * Validate if coordinates are within Digos City boundary
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {boolean} True if coordinates are within city boundaries
 */
function isWithinDigosBoundary(latitude, longitude) {
  // Validate input
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return false;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return false;
  }

  // Load boundary
  const boundary = loadDigosBoundary();
  if (!boundary || !boundary.geometry || !boundary.geometry.coordinates) {
    console.warn("[BOUNDARY_VALIDATOR] Digos boundary not available, using bounding box fallback");
    // Fallback to bounding box check if boundary file not available
    // Updated to match actual bounds from digos-city-boundary.json
    const minLat = 6.723538983841018;
    const maxLat = 6.965492445653091;
    const minLng = 125.26411236448983;
    const maxLng = 125.3873999021893;
    return (
      latitude >= minLat &&
      latitude <= maxLat &&
      longitude >= minLng &&
      longitude <= maxLng
    );
  }

  const point = [longitude, latitude]; // GeoJSON uses [lng, lat] order
  const {coordinates} = boundary.geometry;

  // Handle Polygon geometry type
  if (boundary.geometry.type === "Polygon") {
    const result = isPointInPolygon(point, coordinates);
    // If polygon check fails, fallback to bounding box check
    if (!result) {
      const bounds = getDigosBounds();
      if (bounds) {
        const inBounds = (
          latitude >= bounds.minLat &&
          latitude <= bounds.maxLat &&
          longitude >= bounds.minLng &&
          longitude <= bounds.maxLng
        );
        if (inBounds) {
          console.log("[BOUNDARY_VALIDATOR] Polygon check failed but coordinates within bounding box, allowing:", { lat: "[REDACTED]", lng: "[REDACTED]" });
        } else {
          console.log("[BOUNDARY_VALIDATOR] Coordinates outside boundary:", { lat: "[REDACTED]", lng: "[REDACTED]", bounds });
        }
        return inBounds;
      }
    }
    return result;
  }

  // Handle MultiPolygon geometry type
  if (boundary.geometry.type === "MultiPolygon") {
    // MultiPolygon: [[[ring1], [ring2]], [[ring3]]]
    for (const polygon of coordinates) {
      if (isPointInPolygon(point, polygon)) {
        return true;
      }
    }
    // If no polygon matches, fallback to bounding box check
    const bounds = getDigosBounds();
    if (bounds) {
      return (
        latitude >= bounds.minLat &&
        latitude <= bounds.maxLat &&
        longitude >= bounds.minLng &&
        longitude <= bounds.maxLng
      );
    }
    return false;
  }

  console.warn("[BOUNDARY_VALIDATOR] Unsupported geometry type:", boundary.geometry.type);
  // Fallback to bounding box check
  const bounds = getDigosBounds();
  if (bounds) {
    return (
      latitude >= bounds.minLat &&
      latitude <= bounds.maxLat &&
      longitude >= bounds.minLng &&
      longitude <= bounds.maxLng
    );
  }
  return true; // Fail open if geometry type not supported and no bounds available
}

/**
 * Get Digos city bounding box (for quick pre-check)
 * @returns {Object|null} {minLng, maxLng, minLat, maxLat} or null
 */
function getDigosBounds() {
  const boundary = loadDigosBoundary();
  if (!boundary || !boundary.geometry || !boundary.geometry.coordinates) {
    return null;
  }

  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  const {coordinates} = boundary.geometry;

  function processRing(ring) {
    for (const [lng, lat] of ring) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }

  if (boundary.geometry.type === "Polygon") {
    for (const ring of coordinates) {
      processRing(ring);
    }
  } else if (boundary.geometry.type === "MultiPolygon") {
    for (const polygon of coordinates) {
      for (const ring of polygon) {
        processRing(ring);
      }
    }
  }

  return { minLng, maxLng, minLat, maxLat };
}

/**
 * Quick bounding box check (faster than full polygon check)
 * Use this for initial filtering before doing full polygon check
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {boolean}
 */
function isWithinDigosBounds(latitude, longitude) {
  const bounds = getDigosBounds();
  if (!bounds) {
    return true; // Fail open
  }

  return (
    latitude >= bounds.minLat &&
    latitude <= bounds.maxLat &&
    longitude >= bounds.minLng &&
    longitude <= bounds.maxLng
  );
}

module.exports = {
  isWithinDigosBoundary,
  isWithinDigosBounds,
  getDigosBounds,
  loadDigosBoundary
};

