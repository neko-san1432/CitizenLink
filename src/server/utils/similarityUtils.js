/**
 * Similarity Utilities for Duplicate Detection
 * Implements the 3-Layer Filter Architecture
 * 
 * v4.2: ADAPTIVE DBSCAN PARAMETERS
 * @thesis-feature Ported from DRIMS_Simulated_System
 * 
 * Key Enhancements:
 * - Category-specific epsilon (clustering radius)
 * - Category-specific minPts (minimum points for cluster)
 * - Critical events (Fire, Crime) use minPts=1 for immediate visibility
 */

const { calculateDistance } = require("./locationUtils");

// ==================== ADAPTIVE EPSILON CONFIGURATION ====================
/**
 * Category-specific clustering radius (in meters)
 * 
 * TIER 1: Critical Events (ε = 25-30m)
 * - Fire, Accident, Crime: Need tight clustering to pinpoint exact location
 * - Medical emergencies need precise location for responders
 * 
 * TIER 2: Infrastructure Issues (ε = 30-40m)
 * - Pothole, Streetlight: Localized problems, moderate radius
 * - Trash, Illegal Dumping: Small area accumulation
 * 
 * TIER 3: Area-Wide Events (ε = 50-60m)
 * - Flooding, Blackout: Affects larger geographic areas
 * - No Water: Neighborhood-level issue
 * 
 * @thesis-parameter Justified in THESIS_PARAMETER_PLACEMENT_GUIDE.md
 */
const ADAPTIVE_EPSILON = {
  // TIER 1: Critical/Emergency (ε = 25-30m)
  "Fire": 25,
  "Accident": 25,
  "Crime": 25,
  "Medical": 25,
  "Explosion": 25,
  "Gunshot": 25,
  "Robbery": 30,
  "Assault": 30,
  "Public Safety": 30,

  // TIER 2: Infrastructure (ε = 30-40m)
  "Pothole": 30,
  "Road Damage": 35,
  "Broken Streetlight": 35,
  "Streetlight": 35,
  "Fallen Tree": 35,
  "Road Obstruction": 35,
  "Clogged Drainage": 40,
  "Clogged Canal": 40,
  "Infrastructure": 40,

  // TIER 3: Sanitation (ε = 40m)
  "Trash": 40,
  "Overflowing Trash": 40,
  "Illegal Dumping": 40,
  "Dead Animal": 35,
  "Bad Odor": 45,
  "Sewage Leak": 40,
  "Sanitation": 40,

  // TIER 4: Area-Wide Events (ε = 50-60m)
  "Flooding": 60,
  "Flood": 60,
  "Flash Flood": 60,
  "Blackout": 60,
  "No Water": 55,
  "Pipe Leak": 50,
  "Landslide": 50,
  "Evacuation": 60,
  "Environment": 55,
  "Utilities": 50,

  // TIER 5: Quality of Life (ε = 40-50m)
  "Noise Complaint": 40,
  "Stray Dog": 45,
  "Stray Animal": 45,
  "Traffic": 50,
  "Traffic Congestion": 50,
  "Vehicle Breakdown": 45,

  // Default fallback
  "Others": 50,
  "default": 50
};

// ==================== ADAPTIVE MINPTS CONFIGURATION ====================
/**
 * Category-specific minimum points for cluster formation
 * 
 * CRITICAL EVENTS (minPts = 1):
 * - Fire, Crime, Medical: A SINGLE report should be visible
 * - These are life-threatening and cannot wait for corroboration
 * 
 * STANDARD ISSUES (minPts = 2-3):
 * - Infrastructure, Accidents: Need some corroboration but low threshold
 * 
 * ROUTINE COMPLAINTS (minPts = 4-5):
 * - Trash, Noise: Require multiple reports to filter noise
 * 
 * @thesis-parameter Justified in DEFENSE_PARAMETER_JUSTIFICATION.md
 */
const ADAPTIVE_MINPTS = {
  // CRITICAL: Single report visible (minPts = 1)
  "Fire": 1,
  "Crime": 1,
  "Medical": 1,
  "Explosion": 1,
  "Gunshot": 1,
  "Accident": 1,
  "Robbery": 1,
  "Assault": 1,
  "Landslide": 1,
  "Flash Flood": 1,

  // HIGH PRIORITY: Low threshold (minPts = 2)
  "Flooding": 2,
  "Flood": 2,
  "Blackout": 2,
  "No Water": 2,
  "Power Line Down": 1,
  "Transformer Explosion": 1,
  "Pipe Leak": 2,
  "Public Safety": 2,
  "Evacuation": 1,

  // INFRASTRUCTURE: Moderate threshold (minPts = 2-3)
  "Pothole": 2,
  "Road Damage": 2,
  "Broken Streetlight": 3,
  "Streetlight": 3,
  "Fallen Tree": 2,
  "Road Obstruction": 2,
  "Clogged Drainage": 3,
  "Clogged Canal": 3,
  "Infrastructure": 2,

  // ROUTINE: Higher threshold (minPts = 4-5)
  "Trash": 4,
  "Overflowing Trash": 3,
  "Illegal Dumping": 3,
  "Bad Odor": 4,
  "Noise Complaint": 4,
  "Stray Dog": 4,
  "Stray Animal": 4,
  "Sanitation": 3,

  // QUALITY OF LIFE (minPts = 3-4)
  "Traffic": 3,
  "Traffic Congestion": 3,
  "Vehicle Breakdown": 3,

  // Default fallback
  "Others": 3,
  "default": 3
};

// Legacy constants for backward compatibility
const DEFAULT_EPSILON = 50;
const LARGE_EPSILON = 500;
const SMALL_EPSILON = 20;

/**
 * Get dynamic Epsilon (radius) based on category
 * v4.2: Uses ADAPTIVE_EPSILON lookup with fallback chain
 * 
 * @param {string} categoryId - The category UUID (ignored in v4.2)
 * @param {string} [categoryName] - Category name for adaptive lookup
 * @param {string} [subcategoryName] - Subcategory name for more specific lookup
 * @returns {number} Epsilon value in meters
 */
function getDynamicEpsilon(categoryId, categoryName = "", subcategoryName = "") {
  // v4.2: Try subcategory first (most specific), then category, then fallback
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

  // Legacy heuristic fallback (for backward compatibility)
  const lowerName = catLower.toLowerCase();
  if (
    lowerName.includes("flood") ||
    lowerName.includes("blackout") ||
    lowerName.includes("outage")
  ) {
    return ADAPTIVE_EPSILON["Flooding"] || LARGE_EPSILON;
  }
  if (
    lowerName.includes("pothole") ||
    lowerName.includes("parking") ||
    lowerName.includes("trash")
  ) {
    return ADAPTIVE_EPSILON["Pothole"] || SMALL_EPSILON;
  }
  if (
    lowerName.includes("fire") ||
    lowerName.includes("crime") ||
    lowerName.includes("accident")
  ) {
    return ADAPTIVE_EPSILON["Fire"] || 25;
  }

  return ADAPTIVE_EPSILON["default"] || DEFAULT_EPSILON;
}

/**
 * v4.2: Get dynamic MinPts based on category
 * Critical events return minPts=1 so single reports are visible
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
  const lowerName = (catLower + " " + subLower).toLowerCase();
  if (
    lowerName.includes("fire") ||
    lowerName.includes("crime") ||
    lowerName.includes("medical") ||
    lowerName.includes("accident") ||
    lowerName.includes("explosion")
  ) {
    return 1; // Critical: single report visible
  }
  if (
    lowerName.includes("flood") ||
    lowerName.includes("blackout") ||
    lowerName.includes("water")
  ) {
    return 2; // High priority
  }

  return ADAPTIVE_MINPTS["default"] || 3;
}

// LAYER 3: Semantic Filter (Incident Relationship Matrix)
// Defining distinct sets of related categories.
// Since we might only have UUIDs, this matrix would normally map UUID <-> UUID.
// We will implement the Logic structure assuming we can check relationship.
const INCIDENT_RELATIONSHIP_MATRIX = {
  // Example structure:
  // "uuid-1": ["uuid-2", "uuid-3"], // uuid-1 is related to 2 and 3
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
 * v4.2: Uses adaptive epsilon based on category/subcategory
 */
function isPotentialDuplicate(newComplaint, existingComplaint) {
  // Layer 1: Spatial (v4.2: Adaptive epsilon)
  const epsilon = getDynamicEpsilon(
    newComplaint.category,
    newComplaint.categoryName || newComplaint.category_name || "",
    newComplaint.subcategoryName || newComplaint.subcategory || ""
  );
  const distance = calculateDistance(
    newComplaint.latitude,
    newComplaint.longitude,
    existingComplaint.latitude,
    existingComplaint.longitude
  );

  if (distance > epsilon) return { isMatch: false, reason: "spatial", distance, epsilon };

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

  return { isMatch: true, distance, score: 1.0 };
}

module.exports = {
  // v4.2: Adaptive DBSCAN exports
  ADAPTIVE_EPSILON,
  ADAPTIVE_MINPTS,
  getDynamicEpsilon,
  getDynamicMinPts,
  // Legacy exports
  checkTemporalProximity,
  areCategoriesRelated,
  isPotentialDuplicate,
  // Constants
  DEFAULT_EPSILON,
  LARGE_EPSILON,
  SMALL_EPSILON
};
