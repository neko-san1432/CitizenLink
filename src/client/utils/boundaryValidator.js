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
      // Try to fetch from API endpoint first (if it exists)
      let response;
      try {
        response = await fetch('/api/digos-boundary');
        if (response.ok) {
          const boundary = await response.json();
          boundaryCache = boundary;
          return boundary;
        }
        // If 404, silently fall back (don't log - this is expected if server not restarted)
      } catch (err) {
        // Network error - continue to fallback
      }
      
      // Fallback: try to use barangay boundaries from /api/boundaries
      // and construct city boundary from them
      try {
        response = await fetch('/api/boundaries');
        if (response.ok) {
          const brgyData = await response.json();
          if (Array.isArray(brgyData) && brgyData.length > 0) {
            // Store barangay data for point-in-polygon checks
            boundaryCache = { 
              type: 'barangay_boundaries',
              barangays: brgyData,
              // Create a simple bounding box from all barangays
              bounds: calculateBoundsFromBarangays(brgyData)
            };
            // Log that we're using barangay boundaries fallback (only once)
            if (!boundaryCache._logged) {
              console.log('[BOUNDARY_VALIDATOR] Using barangay boundaries for validation');
              boundaryCache._logged = true;
            }
            return boundaryCache;
          }
        }
      } catch (err) {
        // Barangay boundaries API failed, continue to final fallback
      }
      
      // Final fallback: try direct file path (may not work in production)
      try {
        response = await fetch('/src/client/assets/digos-city-boundary.json');
        if (response.ok) {
          const boundary = await response.json();
          boundaryCache = boundary;
          return boundary;
        }
      } catch (err) {
        // Direct file path also failed
      }
      
      // If all methods failed, return null (will use bounding box fallback in validation)
      return null;
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
 * Calculate bounding box from barangay boundaries
 * @param {Array} brgyData - Array of barangay data with geojson
 * @returns {Object} {minLng, maxLng, minLat, maxLat}
 */
function calculateBoundsFromBarangays(brgyData) {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  
  brgyData.forEach(barangay => {
    if (barangay.geojson && barangay.geojson.geometry) {
      const coords = barangay.geojson.geometry.coordinates;
      if (barangay.geojson.geometry.type === 'Polygon') {
        coords[0].forEach(([lng, lat]) => {
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        });
      } else if (barangay.geojson.geometry.type === 'MultiPolygon') {
        coords.forEach(polygon => {
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
  if (!boundary) {
    // Use bounding box fallback if boundary not available
    const minLat = 6.723539;
    const maxLat = 6.985025;
    const minLng = 125.245633;
    const maxLng = 125.391290;
    return (
      latitude >= minLat &&
      latitude <= maxLat &&
      longitude >= minLng &&
      longitude <= maxLng
    );
  }

  const point = [longitude, latitude]; // GeoJSON uses [lng, lat] order

  // Handle barangay boundaries format (from /api/boundaries)
  if (boundary.type === 'barangay_boundaries' && boundary.barangays) {
    // Check if point is within any barangay boundary
    for (const barangay of boundary.barangays) {
      if (barangay.geojson && barangay.geojson.geometry) {
        const coords = barangay.geojson.geometry.coordinates;
        if (barangay.geojson.geometry.type === 'Polygon') {
          if (isPointInPolygon(point, coords)) {
            return true;
          }
        } else if (barangay.geojson.geometry.type === 'MultiPolygon') {
          for (const polygon of coords) {
            if (isPointInPolygon(point, polygon)) {
              return true;
            }
          }
        }
      }
    }
    // If not in any barangay, check bounding box as fallback
    if (boundary.bounds) {
      return (
        latitude >= boundary.bounds.minLat &&
        latitude <= boundary.bounds.maxLat &&
        longitude >= boundary.bounds.minLng &&
        longitude <= boundary.bounds.maxLng
      );
    }
    return false;
  }

  // Handle standard GeoJSON boundary format
  if (boundary.geometry && boundary.geometry.coordinates) {
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

  console.warn('[BOUNDARY_VALIDATOR] Invalid boundary format');
  return true; // Fail open if boundary format invalid
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

