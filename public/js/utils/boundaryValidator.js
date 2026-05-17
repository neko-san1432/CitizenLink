/**
 * Digos City Boundary Validator (Frontend)
 * Validates if coordinates are within Digos City boundaries
 * Uses the actual polygon boundary from digos-city-boundary.json
 */

// Cache for boundary data
let boundaryCache = null;
let boundaryLoadPromise = null;

/**
 * Load Digos city boundary from JSON file
 */
// Load Digos city boundary from JSON file
// Prioritize barangay boundaries as they are what the user sees on the map
async function loadDigosBoundary() {
  if (boundaryCache) {
    return boundaryCache;
  }

  if (boundaryLoadPromise) {
    return boundaryLoadPromise;
  }

  boundaryLoadPromise = (async () => {
    try {
      let response;

      // 1. Try to use barangay boundaries from /api/public/boundaries (Visual Source)
      // This ensures validation matches exactly what the user sees
      try {
        response = await fetch("/api/public/boundaries");
        if (response.ok) {
          const brgyData = await response.json();
          if (Array.isArray(brgyData) && brgyData.length > 0) {
            // Store barangay data for point-in-polygon checks
            boundaryCache = {
              type: "barangay_boundaries",
              barangays: brgyData,
              // Create a simple bounding box from all barangays
              bounds: calculateBoundsFromBarangays(brgyData),
            };
            return boundaryCache;
          }
        }
      } catch (err) {
        console.debug(
          "[BOUNDARY_VALIDATOR] Error fetching barangay boundaries:",
          err
        );
      }

      // 2. Fallback: try to fetch from simplified API endpoint
      try {
        response = await fetch("/api/digos-boundary");
        if (response.ok) {
          const boundary = await response.json();
          boundaryCache = boundary;
          return boundary;
        }
      } catch (err) {
        console.debug(
          "[BOUNDARY_VALIDATOR] Network error fetching simplified API:",
          err
        );
      }

      // 3. Final fallback: try direct file path (may not work in production)
      try {
        response = await fetch("/assets/json/digosCityBoundary.json");
        if (response.ok) {
          const boundary = await response.json();
          boundaryCache = boundary;
          return boundary;
        }
      } catch (err) {
        console.debug(
          "[BOUNDARY_VALIDATOR] Error fetching static boundary file:",
          err
        );
      }

      // If all methods failed, return null (will use bounding box fallback in validation)
      return null;
    } finally {
      boundaryLoadPromise = null;
    }
  })();

  return boundaryLoadPromise;
}

/**
 * Calculate bounding box from barangay boundaries
 * @param {Array} brgyData - Array of barangay data with geojson
 * @returns {Object} {minLng, maxLng, minLat, maxLat}
 */
function calculateBoundsFromBarangays(brgyData) {
  let minLng = Infinity,
    maxLng = -Infinity;
  let minLat = Infinity,
    maxLat = -Infinity;

  brgyData.forEach((barangay) => {
    if (barangay.geojson && barangay.geojson.geometry) {
      const coords = barangay.geojson.geometry.coordinates;
      if (barangay.geojson.geometry.type === "Polygon") {
        coords[0].forEach(([lng, lat]) => {
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        });
      } else if (barangay.geojson.geometry.type === "MultiPolygon") {
        coords.forEach((polygon) => {
          polygon[0].forEach(([lng, lat]) => {
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
          });
        });
      }
    }
  });

  return { minLng, maxLng, minLat, maxLat };
}

/**
 * Check if a point is inside a polygon ring using ray casting algorithm
 * @param {Array} point - [longitude, latitude]
 * @param {Array} ring - Array of [longitude, latitude] coordinates
 * @returns {boolean}
 */
function isPointInRing(point, ring) {
  const x = Number(point[0]);
  const y = Number(point[1]);
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i][0]);
    const yi = Number(ring[i][1]);
    const xj = Number(ring[j][0]);
    const yj = Number(ring[j][1]);

    const intersectY = yi > y !== yj > y;
    const intersectX = x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    const intersect = intersectY && intersectX;
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
 * Recursively check if a point is inside a GeoJSON object
 * @param {Array} point - [longitude, latitude]
 * @param {Object} geojson - GeoJSON object (FeatureCollection, Feature, MultiPolygon, or Polygon)
 * @returns {boolean}
 */
function isPointInGeoJSON(point, geojson) {
  if (!geojson) return false;

  // Handle FeatureCollection
  if (geojson.type === "FeatureCollection" && Array.isArray(geojson.features)) {
    return geojson.features.some(feature => isPointInGeoJSON(point, feature));
  }

  // Handle Feature
  if (geojson.type === "Feature") {
    return isPointInGeoJSON(point, geojson.geometry);
  }

  // Handle MultiPolygon
  if (geojson.type === "MultiPolygon" && Array.isArray(geojson.coordinates)) {
    return geojson.coordinates.some(polygonCoords => isPointInPolygon(point, polygonCoords));
  }

  // Handle Polygon
  if (geojson.type === "Polygon" && Array.isArray(geojson.coordinates)) {
    return isPointInPolygon(point, geojson.coordinates);
  }

  // Unsupported or empty geometry
  return false;
}

/**
 * Validate if coordinates are within Digos City boundary
 * @param {number} latitude - Latitude coordinate
 * @param {number} longitude - Longitude coordinate
 * @returns {Promise<boolean>} True if coordinates are within city boundaries
 */
async function isWithinDigosBoundary(latitude, longitude) {
  // Validate input
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return false;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return false;
  }

  // 1. Try to use already loaded boundaries from window (fastest & most reliable)
  let boundary = boundaryCache;
  if (!boundary && typeof window !== "undefined" && window.complaintFormBoundaries) {
    boundary = {
      type: "barangay_boundaries",
      barangays: window.complaintFormBoundaries,
    };
    boundaryCache = boundary;
  }

  // 2. Load boundary if not available
  if (!boundary) {
    boundary = await loadDigosBoundary();
  }

  if (!boundary) {
    console.error("[BOUNDARY_VALIDATOR] Critical: Boundary data unavailable.");
    return false;
  }

  const point = [longitude, latitude]; // GeoJSON uses [lng, lat] order

  // Check against barangay boundaries
  if (boundary.type === "barangay_boundaries" && boundary.barangays) {
    return boundary.barangays.some(barangay => isPointInGeoJSON(point, barangay.geojson));
  } 
  
  // Check against standard GeoJSON boundary
  return isPointInGeoJSON(point, boundary);
}

function _checkBarangayBoundaries(boundary, point, latitude, longitude) {
  // This is now handled inside isWithinDigosBoundary using .some()
  return boundary.barangays.some(barangay => isPointInGeoJSON(point, barangay.geojson));
}

function _checkGeoJsonBoundary(boundary, point) {
  // This is now handled inside isWithinDigosBoundary
  return isPointInGeoJSON(point, boundary);
}

/**
 * Get Digos city bounding box (for quick pre-check)
 * @returns {Promise<Object|null>} {minLng, maxLng, minLat, maxLat} or null
 */
async function getDigosBounds() {
  const boundary = await loadDigosBoundary();
  if (!boundary || !boundary.geometry || !boundary.geometry.coordinates) {
    return null;
  }

  let minLng = Infinity,
    maxLng = -Infinity;
  let minLat = Infinity,
    maxLat = -Infinity;

  const { coordinates } = boundary.geometry;

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
 * @returns {Promise<boolean>}
 */
async function isWithinDigosBounds(latitude, longitude) {
  const bounds = await getDigosBounds();
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

export {
  isWithinDigosBoundary,
  isWithinDigosBounds,
  getDigosBounds,
  loadDigosBoundary,
};
