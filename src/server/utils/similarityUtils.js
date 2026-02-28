/**
 * Similarity Utilities for Duplicate Detection
 * Implements the 3-Layer Filter Architecture
 *
 * v5.0: THESIS-VALIDATED ADAPTIVE DBSCAN PARAMETERS
 * @thesis-feature Synchronized with CitizenLink_Simulated_System
 *
 * CRITICAL: Parameters derived from Thesis K-Distance Graphs
 *
 * Key Values:
 * - Infrastructure (Roads, Pipelines): 0.001125 ≈ 125 meters
 * - Public Safety (Events): 0.00045 ≈ 50 meters
 * - Sanitation (Specific Piles): 0.000144 ≈ 16 meters
 *
 * Unit Conversion: 1 degree ≈ 111km, so 0.001 degrees ≈ 111 meters
 */

const { calculateDistance } = require("./locationUtils");

// ==================== ADAPTIVE EPSILON CONFIGURATION ====================
/**
 * [THESIS-VALIDATED] Adaptive Epsilon Parameters (Aligned with Simulation Engine)
 *
 * Unit: Degrees (approximately 1 degree = 111km)
 * - 0.001125 ≈ 125 meters (Infrastructure)
 * - 0.00045 ≈ 50 meters (Public Safety)
 * - 0.000144 ≈ 16 meters (Sanitation/Specific)
 *
 * @thesis-parameter Derived from K-Distance Elbow Method Analysis
 */
const ADAPTIVE_EPSILON = {
  // =====================================================================
  // TIER 1: MACRO INFRASTRUCTURE (Roads, Pipelines) - 125m Radius
  // Rationale: Road issues like potholes and drainage problems span
  // larger stretches of road and require wider clustering radius.
  // =====================================================================
  "Pothole": 0.001125,
  "Road Damage": 0.001125,
  "Street Light": 0.001125,
  "Streetlight": 0.001125,
  "Broken Streetlight": 0.001125,
  "Drainage": 0.001125,
  "Clogged Drainage": 0.001125,
  "Clogged Canal": 0.001125,
  "Infrastructure": 0.001125,
  "Pipe Leak": 0.001125,
  "Road Obstruction": 0.001125,
  "Fallen Tree": 0.001125,

  // =====================================================================
  // TIER 2: STANDARD PUBLIC SAFETY (Events) - 50m Radius
  // Rationale: Emergency events need moderate radius for responder
  // coordination while maintaining location precision.
  // =====================================================================
  "Fire": 0.00045,
  "Accident": 0.00045,
  "Crime": 0.00045,
  "Flooding": 0.00045,
  "Flood": 0.00045,
  "Flash Flood": 0.00045,
  "Blackout": 0.00045,
  "No Water": 0.00045,
  "Traffic": 0.00045,
  "Traffic Congestion": 0.00045,
  "Medical": 0.00045,
  "Explosion": 0.00045,
  "Gunshot": 0.00045,
  "Robbery": 0.00045,
  "Assault": 0.00045,
  "Public Safety": 0.00045,
  "Landslide": 0.00045,
  "Evacuation": 0.00045,
  "Environment": 0.00045,
  "Utilities": 0.00045,

  // =====================================================================
  // TIER 3: MICRO SANITATION (Specific Piles) - 16m Radius
  // Rationale: Garbage piles and sanitation issues are localized.
  // Tight clustering prevents merging distinct dumping sites.
  // =====================================================================
  "Garbage": 0.000144,
  "Trash": 0.000144,
  "Overflowing Trash": 0.000144,
  "Illegal Dumping": 0.000144,
  "Sanitation": 0.000144,
  "Bad Odor": 0.000144,
  "Dead Animal": 0.000144,
  "Sewage Leak": 0.000144,
  "Obstruction": 0.000144,
  "Stray Dog": 0.000144,
  "Stray Animal": 0.000144,
  "Noise Complaint": 0.000144,

  // =====================================================================
  // DEFAULT FALLBACK - ~33 meters
  // =====================================================================
  "Others": 0.00030,
  "default": 0.00030
};

// ==================== ADAPTIVE MINPTS CONFIGURATION ====================
/**
 * [THESIS-VALIDATED] Adaptive MinPts Parameters
 *
 * Defines minimum reports required to form a cluster.
 * Critical incidents need fewer reports to trigger immediate attention.
 *
 * @thesis-parameter Derived from operational response requirements
 */
const ADAPTIVE_MINPTS = {
  // CRITICAL: 2 reports trigger a cluster (immediate response needed)
  "Fire": 2,
  "Explosion": 2,
  "Gunshot": 2,
  "Medical": 2,
  "Landslide": 2,
  "Flash Flood": 2,
  "Evacuation": 2,

  // HIGH PRIORITY: 3 reports for validation
  "Crime": 3,
  "Accident": 3,
  "Robbery": 3,
  "Assault": 3,
  "Flooding": 3,
  "Flood": 3,
  "Blackout": 3,
  "No Water": 3,
  "Public Safety": 3,

  // INFRASTRUCTURE: Needs more validation (5 reports)
  "Pothole": 5,
  "Road Damage": 5,
  "Street Light": 5,
  "Streetlight": 5,
  "Broken Streetlight": 5,
  "Drainage": 5,
  "Clogged Drainage": 5,
  "Clogged Canal": 5,
  "Infrastructure": 5,
  "Pipe Leak": 5,
  "Road Obstruction": 5,
  "Fallen Tree": 5,

  // SANITATION: 4 reports required
  "Garbage": 4,
  "Trash": 4,
  "Overflowing Trash": 4,
  "Illegal Dumping": 4,
  "Sanitation": 4,
  "Bad Odor": 4,
  "Dead Animal": 4,
  "Sewage Leak": 4,

  // QUALITY OF LIFE: Standard threshold
  "Traffic": 4,
  "Traffic Congestion": 4,
  "Noise Complaint": 4,
  "Stray Dog": 4,
  "Stray Animal": 4,

  // DEFAULT FALLBACK
  "Others": 3,
  "default": 3
};

// Legacy constants for backward compatibility (in meters)
const DEFAULT_EPSILON = 0.00030; // ~33 meters
const LARGE_EPSILON = 0.0045;   // ~500 meters
const SMALL_EPSILON = 0.00018;  // ~20 meters

/**
 * Get epsilon for a specific category.
 * Primary lookup function for DBSCAN clustering.
 *
 * @param {string} category - Category name
 * @returns {number} Epsilon value in degrees
 */
function getEpsilonForCategory(category) {
  if (!category) return ADAPTIVE_EPSILON["default"];
  const normalized = category.trim();
  return ADAPTIVE_EPSILON[normalized] !== undefined
    ? ADAPTIVE_EPSILON[normalized]
    : ADAPTIVE_EPSILON["default"];
}

/**
 * Get minPts for a specific category.
 *
 * @param {string} category - Category name
 * @returns {number} MinPts value
 */
function getMinPtsForCategory(category) {
  if (!category) return ADAPTIVE_MINPTS["default"];
  const normalized = category.trim();
  return ADAPTIVE_MINPTS[normalized] !== undefined
    ? ADAPTIVE_MINPTS[normalized]
    : ADAPTIVE_MINPTS["default"];
}

/**
 * Get dynamic Epsilon (radius) based on category
 * v5.0: Uses ADAPTIVE_EPSILON lookup with fallback chain
 *
 * @param {string} categoryId - The category UUID (ignored in v5.0)
 * @param {string} [categoryName] - Category name for adaptive lookup
 * @param {string} [subcategoryName] - Subcategory name for more specific lookup
 * @returns {number} Epsilon value in degrees
 */
function getDynamicEpsilon(categoryId, categoryName = "", subcategoryName = "") {
  // v5.0: Try subcategory first (most specific), then category, then fallback
  const subLower = (subcategoryName || "").trim();
  const catLower = (categoryName || "").trim();

  // Exact subcategory match
  if (subLower && ADAPTIVE_EPSILON[subLower] !== undefined) {
    return ADAPTIVE_EPSILON[subLower];
  }

  // Exact category match
  if (catLower && ADAPTIVE_EPSILON[catLower] !== undefined) {
    return ADAPTIVE_EPSILON[catLower];
  }

  // Heuristic fallback for infrastructure keywords
  const lowerName = catLower.toLowerCase();
  if (
    lowerName.includes("pothole") ||
    lowerName.includes("road") ||
    lowerName.includes("streetlight") ||
    lowerName.includes("drainage")
  ) {
    return ADAPTIVE_EPSILON["Infrastructure"]; // 125m
  }
  if (
    lowerName.includes("fire") ||
    lowerName.includes("crime") ||
    lowerName.includes("accident") ||
    lowerName.includes("flood")
  ) {
    return ADAPTIVE_EPSILON["Fire"]; // 50m
  }
  if (
    lowerName.includes("garbage") ||
    lowerName.includes("trash") ||
    lowerName.includes("sanitation")
  ) {
    return ADAPTIVE_EPSILON["Sanitation"]; // 16m
  }

  return ADAPTIVE_EPSILON["default"];
}

/**
 * v5.0: Get dynamic MinPts based on category
 *
 * @param {string} categoryName - Category name
 * @param {string} [subcategoryName] - Subcategory name for more specific lookup
 * @returns {number} MinPts value
 */
function getDynamicMinPts(categoryName = "", subcategoryName = "") {
  // Try subcategory first (most specific), then category
  const subLower = (subcategoryName || "").trim();
  const catLower = (categoryName || "").trim();

  // Exact subcategory match
  if (subLower && ADAPTIVE_MINPTS[subLower] !== undefined) {
    return ADAPTIVE_MINPTS[subLower];
  }

  // Exact category match
  if (catLower && ADAPTIVE_MINPTS[catLower] !== undefined) {
    return ADAPTIVE_MINPTS[catLower];
  }

  // Heuristic fallback for critical keywords
  const lowerName = (`${catLower  } ${  subLower}`).toLowerCase();
  if (
    lowerName.includes("fire") ||
    lowerName.includes("explosion") ||
    lowerName.includes("medical")
  ) {
    return 2; // Critical: needs only 2 reports
  }
  if (
    lowerName.includes("crime") ||
    lowerName.includes("accident") ||
    lowerName.includes("flood")
  ) {
    return 3; // High priority
  }

  return ADAPTIVE_MINPTS["default"];
}

// LAYER 3: Semantic Filter (Incident Relationship Matrix)
const INCIDENT_RELATIONSHIP_MATRIX = {
  // Example structure for semantic clustering
  // "Fire": ["Smoke", "Explosion"],
};

/**
 * Check if two categories are semantically related
 * @param {string} cat1 - Category 1 ID
 * @param {string} cat2 - Category 2 ID
 * @returns {boolean}
 */
function areCategoriesRelated(cat1, cat2) {
  if (!cat1 || !cat2) return false;
  if (cat1 === cat2) return true; // Exact match is always related

  // Check Matrix
  const relatedTo1 = INCIDENT_RELATIONSHIP_MATRIX[cat1];
  if (relatedTo1 && relatedTo1.includes(cat2)) return true;

  const relatedTo2 = INCIDENT_RELATIONSHIP_MATRIX[cat2];
  if (relatedTo2 && relatedTo2.includes(cat1)) return true;

  return false;
}

/**
 * Layer 2: Temporal Filter
 * Check if reports are within 48 hours
 * @param {Date|string} date1
 * @param {Date|string} date2
 * @returns {boolean}
 */
function checkTemporalProximity(date1, date2) {
  if (!date1 || !date2) return false;

  const d1 = new Date(date1);
  const d2 = new Date(date2);

  const diffMs = Math.abs(d1 - d2);
  const diffHours = diffMs / (1000 * 60 * 60);

  return diffHours <= 48;
}

/**
 * The Master Filter Function
 * Runs the 3-Layer Check
 *
 * v5.0: Uses thesis-validated adaptive epsilon (in degrees)
 */
function isPotentialDuplicate(newComplaint, existingComplaint) {
  // Layer 1: Spatial (v5.0: Adaptive epsilon in degrees)
  const epsilon = getDynamicEpsilon(
    newComplaint.category,
    newComplaint.categoryName || newComplaint.category_name || "",
    newComplaint.subcategoryName || newComplaint.subcategory || ""
  );

  // Calculate distance using Haversine (returns meters)
  const distanceMeters = calculateDistance(
    newComplaint.latitude,
    newComplaint.longitude,
    existingComplaint.latitude,
    existingComplaint.longitude
  );

  // Convert epsilon from degrees to meters for comparison (1 degree ≈ 111km)
  const epsilonMeters = epsilon * 111000;

  if (distanceMeters > epsilonMeters) {
    return { isMatch: false, reason: "spatial", distance: distanceMeters, epsilon: epsilonMeters };
  }

  // Layer 2: Temporal
  if (
    !checkTemporalProximity(
      newComplaint.submitted_at || new Date(),
      existingComplaint.submitted_at
    )
  ) {
    return { isMatch: false, reason: "temporal" };
  }

  // Layer 3: Semantic
  if (
    !areCategoriesRelated(newComplaint.category, existingComplaint.category)
  ) {
    return { isMatch: false, reason: "semantic" };
  }

  return { isMatch: true, distance: distanceMeters, score: 1.0 };
}

/**
 * Convert epsilon (degrees) to meters for display/logging
 * @param {number} epsilonDegrees - Epsilon in degrees
 * @returns {number} Epsilon in meters
 */
function epsilonToMeters(epsilonDegrees) {
  return Math.round(epsilonDegrees * 111000);
}

/**
 * Verification function for thesis parameter validation
 * Run this to confirm parameters match thesis claims
 */
function verifyThesisParameters() {
  console.log("=== THESIS PARAMETER VERIFICATION ===");
  console.log(`Testing Infrastructure Radius: ${ADAPTIVE_EPSILON["Infrastructure"]} (Should be 0.001125 ≈ 125m)`);
  console.log(`  → In meters: ${epsilonToMeters(ADAPTIVE_EPSILON["Infrastructure"])}m`);
  console.log(`Testing Sanitation Radius: ${ADAPTIVE_EPSILON["Sanitation"]} (Should be 0.000144 ≈ 16m)`);
  console.log(`  → In meters: ${epsilonToMeters(ADAPTIVE_EPSILON["Sanitation"])}m`);
  console.log(`Testing Fire Radius: ${ADAPTIVE_EPSILON["Fire"]} (Should be 0.00045 ≈ 50m)`);
  console.log(`  → In meters: ${epsilonToMeters(ADAPTIVE_EPSILON["Fire"])}m`);
  console.log(`Testing Default Radius: ${ADAPTIVE_EPSILON["default"]} (Should be 0.00030 ≈ 33m)`);
  console.log(`  → In meters: ${epsilonToMeters(ADAPTIVE_EPSILON["default"])}m`);
  console.log("=====================================");

  // Validation checks
  const passed =
    ADAPTIVE_EPSILON["Infrastructure"] === 0.001125 &&
    ADAPTIVE_EPSILON["Sanitation"] === 0.000144 &&
    ADAPTIVE_EPSILON["Fire"] === 0.00045 &&
    ADAPTIVE_EPSILON["default"] === 0.00030;

  console.log(`\n✅ VERIFICATION ${passed ? "PASSED" : "❌ FAILED"}`);
  return passed;
}

module.exports = {
  // v5.0: Thesis-validated DBSCAN exports
  ADAPTIVE_EPSILON,
  ADAPTIVE_MINPTS,

  // Primary lookup functions
  getEpsilonForCategory,
  getMinPtsForCategory,

  // Legacy-compatible functions
  getDynamicEpsilon,
  getDynamicMinPts,

  // Utility functions
  epsilonToMeters,
  verifyThesisParameters,

  // Legacy exports
  checkTemporalProximity,
  areCategoriesRelated,
  isPotentialDuplicate,

  // Constants
  DEFAULT_EPSILON,
  LARGE_EPSILON,
  SMALL_EPSILON
};
