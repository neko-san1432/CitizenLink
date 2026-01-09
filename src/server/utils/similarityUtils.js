/**
 * Similarity Utilities for Duplicate Detection
 * Implements the 3-Layer Filter Architecture
 */

const { calculateDistance } = require("./locationUtils");

// LAYER 1: Spatial Filter Configuration
// Epsilon (Radius) constants in meters
const DEFAULT_EPSILON = 50; // Default radius
const LARGE_EPSILON = 500; // For area-wide issues (Flood, Blackout)
const SMALL_EPSILON = 20; // For localized issues (Pothole)

/**
 * Get dynamic Epsilon (radius) based on category
 * Note: Since categories are UUIDs, this should ideally look up the category type.
 * For now, we will use a default unless we can identify the category type.
 * @param {string} categoryId - The category UUID
 * @param {string} [categoryName] - Optional category name if available for heuristic
 */
function getDynamicEpsilon(categoryId, categoryName = "") {
  const lowerName = categoryName.toLowerCase();

  // Heuristic based on name if available
  if (
    lowerName.includes("flood") ||
    lowerName.includes("blackout") ||
    lowerName.includes("outage")
  ) {
    return LARGE_EPSILON;
  }
  if (
    lowerName.includes("pothole") ||
    lowerName.includes("parking") ||
    lowerName.includes("trash")
  ) {
    return SMALL_EPSILON;
  }

  return DEFAULT_EPSILON;
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
 */
function isPotentialDuplicate(newComplaint, existingComplaint) {
  // Layer 1: Spatial
  const epsilon = getDynamicEpsilon(
    newComplaint.category,
    newComplaint.categoryName
  );
  const distance = calculateDistance(
    newComplaint.latitude,
    newComplaint.longitude,
    existingComplaint.latitude,
    existingComplaint.longitude
  );

  if (distance > epsilon) return { isMatch: false, reason: "spatial" };

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
  getDynamicEpsilon,
  checkTemporalProximity,
  areCategoriesRelated,
  isPotentialDuplicate,
};
