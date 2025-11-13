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
async function loadDigosBoundary() {
  if (boundaryCache) {
    return boundaryCache;
  }

  if (boundaryLoadPromise) {
    return boundaryLoadPromise;
  }

  boundaryLoadPromise = (async () => {
    try {
      const response = await fetch('/src/client/assets/digos-city-boundary.json');
      if (!response.ok) {
        throw new Error(`Failed to load boundary: ${response.statusText}`);
      }
      const boundary = await response.json();
      boundaryCache = boundary;
      return boundary;
    } catch (error) {
      console.error('[BOUNDARY_VALIDATOR] Failed to load Digos boundary:', error.message);
      // Return null to indicate boundary not available
      return null;
    } finally {
      boundaryLoadPromise = null;
    }
  })();

  return boundaryLoadPromise;
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
 * @returns {Promise<boolean>} True if coordinates are within city boundaries
 */
async function isWithinDigosBoundary(latitude, longitude) {
  // Validate input
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return false;
  }

  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return false;
  }

  // Load boundary
  const boundary = await loadDigosBoundary();
  if (!boundary || !boundary.geometry || !boundary.geometry.coordinates) {
    console.warn('[BOUNDARY_VALIDATOR] Digos boundary not available, skipping validation');
    return true; // Allow if boundary not available (fail open)
  }

  const point = [longitude, latitude]; // GeoJSON uses [lng, lat] order
  const coordinates = boundary.geometry.coordinates;

  // Handle Polygon geometry type
  if (boundary.geometry.type === 'Polygon') {
    return isPointInPolygon(point, coordinates);
  }

  // Handle MultiPolygon geometry type
  if (boundary.geometry.type === 'MultiPolygon') {
    // MultiPolygon: [[[ring1], [ring2]], [[ring3]]]
    for (const polygon of coordinates) {
      if (isPointInPolygon(point, polygon)) {
        return true;
      }
    }
    return false;
  }

  console.warn('[BOUNDARY_VALIDATOR] Unsupported geometry type:', boundary.geometry.type);
  return true; // Fail open if geometry type not supported
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

  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  const coordinates = boundary.geometry.coordinates;

  function processRing(ring) {
    for (const [lng, lat] of ring) {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }

  if (boundary.geometry.type === 'Polygon') {
    for (const ring of coordinates) {
      processRing(ring);
    }
  } else if (boundary.geometry.type === 'MultiPolygon') {
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
  loadDigosBoundary
};

