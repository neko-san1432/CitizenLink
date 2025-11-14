/**
 * Barangay Classifier
 * Classifies complaint coordinates into barangays based on boundary data
 */
const fs = require('fs');
const path = require('path');

// Cache for barangay boundaries
let barangayBoundariesCache = null;

/**
 * Load barangay boundaries from JSON file
 */
function loadBarangayBoundaries() {
  if (barangayBoundariesCache) {
    return barangayBoundariesCache;
  }

  try {
    const boundariesPath = path.join(__dirname, '../../client/assets/brgy_boundaries_location.json');
    const boundariesData = fs.readFileSync(boundariesPath, 'utf8');
    const boundaries = JSON.parse(boundariesData);
    barangayBoundariesCache = boundaries;
    return boundaries;
  } catch (error) {
    console.error('[BARANGAY_CLASSIFIER] Failed to load barangay boundaries:', error.message);
    return [];
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
 * Normalize barangay name to match expected format
 * @param {string} name - Barangay name from JSON
 * @returns {string} Normalized barangay name
 */
function normalizeBarangayName(name) {
  if (!name) return name;

  // Map variations to standard names used in the system
  const nameMap = {
    'Kapatagan': 'Kapatagan (Rizal)',
    'Kapatagan (Rizal)': 'Kapatagan (Rizal)',
    'Zone I': 'Zone 1 (Pob.)',
    'Zone II': 'Zone 2 (Pob.)',
    'Zone III': 'Zone 3 (Pob.)',
    'Zone 1': 'Zone 1 (Pob.)',
    'Zone 2': 'Zone 2 (Pob.)',
    'Zone 3': 'Zone 3 (Pob.)',
    'Zone 1 (Pob.)': 'Zone 1 (Pob.)',
    'Zone 2 (Pob.)': 'Zone 2 (Pob.)',
    'Zone 3 (Pob.)': 'Zone 3 (Pob.)',
    'San Jose': 'San Jose (Balutakay)',
    'San Miguel': 'San Miguel (Odaca)'
  };

  return nameMap[name] || name;
}

/**
 * Classify complaint coordinates into a barangay
 * @param {number} latitude - Complaint latitude
 * @param {number} longitude - Complaint longitude
 * @returns {string|null} Barangay name or null if not found
 */
function classifyBarangay(latitude, longitude) {
  // Validate input
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }

  if (isNaN(latitude) || isNaN(longitude)) {
    return null;
  }

  const boundaries = loadBarangayBoundaries();
  if (!boundaries || boundaries.length === 0) {
    console.warn('[BARANGAY_CLASSIFIER] No barangay boundaries loaded');
    return null;
  }

  const point = [longitude, latitude]; // GeoJSON uses [lng, lat] order

  // Iterate through each barangay boundary
  for (const barangay of boundaries) {
    if (!barangay.name || !barangay.geojson) {
      continue;
    }

    const {geojson} = barangay;

    // Handle Polygon geometry type
    if (geojson.type === 'Polygon' && geojson.coordinates) {
      if (isPointInPolygon(point, geojson.coordinates)) {
        // Normalize barangay name to match expected format
        return normalizeBarangayName(barangay.name);
      }
    }

    // Handle MultiPolygon geometry type
    if (geojson.type === 'MultiPolygon' && geojson.coordinates) {
      // MultiPolygon: [[[ring1], [ring2]], [[ring3]]]
      for (const polygon of geojson.coordinates) {
        if (isPointInPolygon(point, polygon)) {
          // Normalize barangay name to match expected format
          return normalizeBarangayName(barangay.name);
        }
      }
    }
  }

  // No barangay found
  return null;
}

/**
 * Classify multiple complaints into barangays
 * @param {Array} complaints - Array of complaint objects with latitude and longitude
 * @returns {Map} Map of complaint ID to barangay name
 */
function classifyComplaints(complaints) {
  const classificationMap = new Map();

  for (const complaint of complaints) {
    const lat = parseFloat(complaint.latitude);
    const lng = parseFloat(complaint.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      continue;
    }

    const barangay = classifyBarangay(lat, lng);
    if (barangay) {
      classificationMap.set(complaint.id, barangay);
    }
  }

  return classificationMap;
}

module.exports = {
  classifyBarangay,
  classifyComplaints,
  loadBarangayBoundaries
};

