/**
 * Adaptive DBSCAN++ Clustering Engine
 * Ported from simulation-engine.js for Production Use
 *
 * Features:
 * - Adaptive Epsilon/MinPts based on Category Tiers
 * - Semantic Relationship Clustering
 * - Temporal Awareness (Time Decay)
 * - Keyword-based Similarity Boosting
 * - Transitive Chain Discovery (Pipe -> Flood -> Traffic)
 */

// ==================== CONFIGURATION CONSTANTS ====================

const CLUSTERING_TIERS = {
  HIGH_PRIORITY: {
    epsilon: 25.0,    // meters
    minPts: 3,
    description: "High Priority / Semantic Conflict",
    categories: ["Fire", "Accident", "Crime", "Public Safety"]
  },
  STANDARD_INFRASTRUCTURE: {
    epsilon: 40.0,    // meters
    minPts: 4,
    description: "Standard Infrastructure",
    categories: ["Pothole", "Trash", "Streetlight", "Road Damage", "Infrastructure", "Sanitation"]
  },
  LARGE_AREA: {
    epsilon: 60.0,    // meters
    minPts: 5,
    description: "Large Area Events",
    categories: ["Flooding", "No Water", "Blackout", "Utilities", "Environment", "Flood"]
  }
};

const SUBCATEGORY_MAP = {
  "Pothole": "Infrastructure",
  "Road Damage": "Infrastructure",
  "Broken Streetlight": "Infrastructure",
  "Streetlight": "Infrastructure",
  "Trash": "Sanitation",
  "Illegal Dumping": "Sanitation",
  "Overflowing Trash": "Sanitation",
  "Bad Odor": "Sanitation",
  "No Water": "Utilities",
  "Pipe Leak": "Utilities",
  "Blackout": "Utilities",
  "Flooding": "Environment",
  "Flood": "Environment",
  "Fire": "Public Safety",
  "Accident": "Public Safety",
  "Crime": "Public Safety",
  "Stray Dog": "Public Safety",
  "Road Obstruction": "Traffic",
  "Traffic Jam": "Traffic",
  "Noise complaint": "Public Safety"
};

const ADAPTIVE_EPSILON = {
  "Fire": 25.0,
  "Accident": 25.0,
  "Crime": 25.0,
  "Public Safety": 25.0,
  "Pothole": 30.0,
  "Trash": 40.0,
  "Streetlight": 40.0,
  "Broken Streetlight": 40.0,
  "Road Damage": 40.0,
  "Infrastructure": 40.0,
  "Sanitation": 40.0,
  "Illegal Dumping": 40.0,
  "Overflowing Trash": 40.0,
  "Bad Odor": 40.0,
  "Flooding": 60.0,
  "Flood": 60.0,
  "No Water": 60.0,
  "Blackout": 60.0,
  "Utilities": 60.0,
  "Environment": 60.0,
  "Pipe Leak": 60.0,
  "Traffic": 40.0,
  "Road Obstruction": 40.0,
  "Noise complaint": 25.0,
  "Stray Dog": 40.0,
  "Others": 40.0
};

const ADAPTIVE_MINPTS = {
  "Fire": 3,
  "Accident": 3,
  "Crime": 3,
  "Public Safety": 3,
  "Pothole": 2,
  "Trash": 4,
  "Streetlight": 4,
  "Broken Streetlight": 4,
  "Road Damage": 4,
  "Infrastructure": 4,
  "Sanitation": 4,
  "Illegal Dumping": 4,
  "Overflowing Trash": 4,
  "Bad Odor": 4,
  "Flooding": 5,
  "Flood": 5,
  "No Water": 5,
  "Blackout": 5,
  "Utilities": 5,
  "Environment": 5,
  "Pipe Leak": 5,
  "Traffic": 4,
  "Road Obstruction": 4,
  "Noise complaint": 3,
  "Stray Dog": 4,
  "Others": 4
};

const RELATIONSHIP_MATRIX = {
  "Pipe Leak": ["Flooding", "Flood", "No Water", "Road Damage", "Environment", "Utilities"],
  "Flooding": ["Pipe Leak", "Road Damage", "Trash", "Traffic", "Environment", "Flood"],
  "Flood": ["Pipe Leak", "Road Damage", "Trash", "Traffic", "Environment", "Flooding"],
  "No Water": ["Pipe Leak", "Utilities"],
  "Blackout": ["Utilities"],
  "Pothole": ["Road Damage", "Infrastructure"],
  "Road Damage": ["Pothole", "Flooding", "Flood", "Traffic", "Infrastructure"],
  "Broken Streetlight": ["Broken Streetlight", "Streetlight", "Infrastructure"],
  "Streetlight": ["Broken Streetlight", "Streetlight", "Infrastructure"],
  "Infrastructure": ["Pothole", "Road Damage", "Broken Streetlight", "Infrastructure"],
  "Trash": ["Illegal Dumping", "Stray Dog", "Overflowing Trash", "Bad Odor", "Sanitation"],
  "Illegal Dumping": ["Trash", "Stray Dog", "Sanitation"],
  "Overflowing Trash": ["Trash", "Illegal Dumping", "Sanitation"],
  "Bad Odor": ["Trash", "Overflowing Trash", "Sanitation"],
  "Sanitation": ["Trash", "Illegal Dumping", "Overflowing Trash", "Bad Odor", "Sanitation"],
  "Environment": ["Flooding", "Flood", "Pipe Leak", "Environment"],
  "Utilities": ["No Water", "Pipe Leak", "Blackout", "Utilities"],
  "Traffic": ["Flooding", "Flood", "Road Damage", "Fire", "Road Obstruction"],
  "Road Obstruction": ["Traffic", "Flooding", "Flood"],
  "Fire": ["Fire", "Traffic", "Public Safety"],
  "Accident": ["Traffic", "Public Safety"],
  "Crime": ["Public Safety"],
  "Stray Dog": ["Stray Dog", "Trash", "Public Safety"],
  "Public Safety": ["Fire", "Accident", "Crime", "Stray Dog", "Noise complaint", "Public Safety"],
  "Noise complaint": ["Noise complaint", "Public Safety"],
  "Others": ["Others"]
};

const CORRELATION_SCORES = {
  "Pipe Leak->Flooding": 0.92,
  "Pipe Leak->No Water": 0.85,
  "Pipe Leak->Road Damage": 0.45,
  "Flooding->Pipe Leak": 0.88,
  "Flooding->Road Damage": 0.60,
  "Flooding->Trash": 0.30,
  "Flooding->Traffic": 0.85,
  "Pothole->Road Damage": 0.75,
  "Road Damage->Pothole": 0.75,
  "Road Damage->Flooding": 0.40,
  "Road Damage->Traffic": 0.70,
  "No Water->Pipe Leak": 0.80,
  "Trash->Illegal Dumping": 0.70,
  "Trash->Stray Dog": 0.25,
  "Illegal Dumping->Trash": 0.70,
  "Illegal Dumping->Stray Dog": 0.35,
  "Pothole->Pothole": 1.0,
  "Flooding->Flooding": 1.0,
  "Fire->Fire": 1.0,
  "Stray Dog->Stray Dog": 1.0,
  "Broken Streetlight->Broken Streetlight": 1.0,
  "Trash->Trash": 1.0,
  "No Water->No Water": 1.0,
  "Traffic->Traffic": 1.0,
  "Pipe Leak->Pipe Leak": 1.0,
  "Road Damage->Road Damage": 1.0,
  "Illegal Dumping->Illegal Dumping": 1.0,
  "Noise complaint->Noise complaint": 1.0,
  "Traffic->Flooding": 0.75,
  "Traffic->Road Damage": 0.65,
  "Traffic->Fire": 0.60,
  "Fire->Traffic": 0.70
};

const KEYWORD_DICTIONARY = {
  "pothole": ["Pothole", "Road Damage", "Infrastructure"],
  "potholes": ["Pothole", "Road Damage", "Infrastructure"],
  "road": ["Pothole", "Road Damage", "Infrastructure", "Traffic"],
  "daan": ["Pothole", "Road Damage", "Infrastructure", "Traffic"],
  "kalsada": ["Pothole", "Road Damage", "Infrastructure"],
  "lubak": ["Pothole", "Road Damage", "Infrastructure"],
  "sira": ["Road Damage", "Infrastructure", "Pothole"],
  "flooding": ["Flooding", "Flood", "Pipe Leak", "Environment", "Utilities"],
  "flood": ["Flooding", "Flood", "Pipe Leak", "Environment", "Utilities"],
  "water": ["No Water", "Pipe Leak", "Flooding", "Utilities"],
  "tubig": ["No Water", "Pipe Leak", "Flooding", "Utilities"],
  "walang": ["No Water", "Utilities"],
  "baha": ["Flooding", "Flood", "Pipe Leak", "Environment"],
  "rain": ["Flooding", "Flood", "Environment"],
  "heavy": ["Flooding", "Flood", "Environment"],
  "trash": ["Trash", "Sanitation", "Illegal Dumping", "Overflowing Trash"],
  "garbage": ["Trash", "Sanitation", "Illegal Dumping", "Overflowing Trash"],
  "basura": ["Trash", "Sanitation", "Illegal Dumping", "Overflowing Trash"],
  "baho": ["Bad Odor", "Trash", "Sanitation", "Overflowing Trash"],
  "overflowing": ["Overflowing Trash", "Trash", "Sanitation"],
  "traffic": ["Traffic", "Road Obstruction", "Road Damage", "Flooding"],
  "dito": ["location_marker"],
  "rito": ["location_marker"],
  "amin": ["location_marker"],
  "aming": ["location_marker"],
  "bahay": ["location_marker"],
  "house": ["location_marker"],
  "home": ["location_marker"],
  "may": ["intensity_marker"],
  "mga": ["intensity_marker"],
  "maraming": ["intensity_marker"],
  "lot": ["intensity_marker"],
  "ang": ["intensity_marker"],
  "yung": ["intensity_marker"],
  "nang": ["intensity_marker"],
  "please": ["action_request"],
  "fix": ["action_request"],
  "paki": ["action_request"],
  "job": ["action_request"],
  "cant": ["problem_marker"],
  "hindi": ["problem_marker"],
  "why": ["problem_marker"],
  "school": ["location_marker", "Public Safety"],
  "due": ["related_marker"]
};

// ==================== HELPER FUNCTIONS ====================

// ==================== SEMANTIC RELATION CACHE ====================
/**
 * Memoization cache for checkSemanticRelation results
 * Key format: "categoryA|categoryB" (alphabetically sorted for order-independence)
 * This prevents redundant computation when the same category pairs are checked repeatedly
 */
const semanticCache = new Map();

/**
 * Generate an order-independent cache key for a category pair
 * @param {string} categoryA - First category
 * @param {string} categoryB - Second category
 * @returns {string} Normalized cache key
 */
function getSemanticCacheKey(categoryA, categoryB) {
  // Sort alphabetically to ensure order-independence
  // "Pothole|Road" and "Road|Pothole" both become "Pothole|Road"
  return categoryA < categoryB
    ? `${categoryA}|${categoryB}`
    : `${categoryB}|${categoryA}`;
}

/**
 * Clear the semantic cache (call when category relationships are updated)
 */
function clearSemanticCache() {
  semanticCache.clear();
  console.log("[AdaptiveDBSCAN] Semantic cache cleared");
}

/**
 * Get semantic cache statistics for debugging
 * @returns {Object} Cache statistics
 */
function getSemanticCacheStats() {
  return {
    size: semanticCache.size,
    entries: Array.from(semanticCache.keys()).slice(0, 10) // First 10 for preview
  };
}

function normalizeTimestamp(timestamp) {
  if (!timestamp) {
    return new Date().toISOString();
  }
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function getTimeDifferenceHours(timestamp1, timestamp2) {
  const t1 = new Date(timestamp1);
  const t2 = new Date(timestamp2);
  if (isNaN(t1.getTime()) || isNaN(t2.getTime())) {
    return 0;
  }
  return Math.abs(t2 - t1) / (1000 * 60 * 60);
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function extractKeywordsFromDescription(description) {
  if (!description || typeof description !== "string") return [];

  const text = description.toLowerCase();
  const words = text.split(/\s+/);
  const detectedCategories = new Set();

  words.forEach(word => {
    const cleaned = word.replace(/[^a-z]/g, "");
    if (KEYWORD_DICTIONARY[cleaned]) {
      KEYWORD_DICTIONARY[cleaned].forEach(cat => {
        if (!cat.includes("_marker") && !cat.includes("_request")) {
          detectedCategories.add(cat);
        }
      });
    }
  });

  return Array.from(detectedCategories);
}

function checkKeywordSimilarity(pointA, pointB) {
  const keywordsA = extractKeywordsFromDescription(pointA.description || "");
  const keywordsB = extractKeywordsFromDescription(pointB.description || "");

  if (keywordsA.length === 0 || keywordsB.length === 0) {
    return {
      similarity: 0.5,
      sharedKeywords: [],
      verdict: "NEUTRAL",
      description: "Insufficient keyword data"
    };
  }

  const setA = new Set(keywordsA);
  const setB = new Set(keywordsB);
  const intersection = [...setA].filter(kw => setB.has(kw));
  const union = new Set([...setA, ...setB]);

  const similarity = intersection.length / union.size;

  let verdict = "WEAK";
  let resultDescription = "Low keyword overlap";

  if (similarity >= 0.6) {
    verdict = "STRONG";
    resultDescription = `High similarity (${intersection.length} shared)`;
  } else if (similarity >= 0.3) {
    verdict = "MODERATE";
    resultDescription = `Moderate overlap (${intersection.length} shared)`;
  }

  return {
    similarity: Math.round(similarity * 100) / 100,
    sharedKeywords: intersection,
    verdict,
    description: resultDescription
  };
}

function getNormalizedCategory(point) {
  if (point.subcategory && ADAPTIVE_EPSILON[point.subcategory] !== undefined) {
    return point.subcategory;
  }
  if (point.category && ADAPTIVE_EPSILON[point.category] !== undefined) {
    return point.category;
  }
  return point.category || point.subcategory || "Others";
}

function getAdaptiveEpsilon(categoryOrPoint) {
  let category;
  if (typeof categoryOrPoint === "object") {
    category = getNormalizedCategory(categoryOrPoint);
  } else {
    category = categoryOrPoint;
  }
  const epsilon = ADAPTIVE_EPSILON[category];
  return epsilon !== undefined ? epsilon : 40.0;
}

function getAdaptiveMinPts(categoryOrPoint) {
  // As per the thesis methodology, enforcing a fixed threshold of minPts = 2
  // rather than using the variable ADAPTIVE_MINPTS dictionary.
  return 2;
}

function checkSemanticRelation(categoryA, categoryB) {
  // Fast path: handle null/undefined inputs
  if (!categoryA || !categoryB) return { isRelated: false, score: 0.0, relationship: "NONE" };

  // Fast path: identical categories (no cache needed)
  if (categoryA === categoryB) return { isRelated: true, score: 1.0, relationship: "IDENTICAL" };

  // ==================== CACHE LOOKUP ====================
  // Check cache first to avoid redundant computation
  const cacheKey = getSemanticCacheKey(categoryA, categoryB);
  if (semanticCache.has(cacheKey)) {
    return semanticCache.get(cacheKey);
  }

  // ==================== COMPUTE RELATION ====================
  const relatedFromA = RELATIONSHIP_MATRIX[categoryA] || [];
  const isRelatedAtoB = relatedFromA.includes(categoryB);

  const relatedFromB = RELATIONSHIP_MATRIX[categoryB] || [];
  const isRelatedBtoA = relatedFromB.includes(categoryA);

  const parentA = SUBCATEGORY_MAP[categoryA];
  const parentB = SUBCATEGORY_MAP[categoryB];
  const sameParent = parentA && parentB && parentA === parentB;

  const isRelated = isRelatedAtoB || isRelatedBtoA || sameParent;

  const keyAB = `${categoryA}->${categoryB}`;
  const keyBA = `${categoryB}->${categoryA}`;
  let score = CORRELATION_SCORES[keyAB] || CORRELATION_SCORES[keyBA] || 0.0;

  if (isRelated && score === 0.0) {
    score = sameParent ? 0.85 : 0.55;
  }

  let relationship = "NONE";
  const CORRELATION_THRESHOLD = 0.50;

  if (isRelated && score >= CORRELATION_THRESHOLD) {
    relationship = sameParent ? "SIBLING" : "RELATED";
  } else if (isRelated) {
    relationship = "WEAK";
  }

  const result = {
    isRelated: isRelated && score >= CORRELATION_THRESHOLD,
    score,
    relationship
  };

  // ==================== CACHE STORAGE ====================
  // Store result for future lookups
  semanticCache.set(cacheKey, result);

  return result;
}

function checkLogic(pointA, pointB) {
  const result = {
    shouldMerge: false,
    distance: 0,
    epsilon: 0,
    timeDiff: 0,
    semantic: null,
    keywordAnalysis: null,
    reasons: [],
    verdict: "REJECTED"
  };

  // Support both lat/lng and latitude/longitude property names
  const latA = pointA.latitude != null ? pointA.latitude : pointA.lat;
  const lngA = pointA.longitude != null ? pointA.longitude : pointA.lng;
  const latB = pointB.latitude != null ? pointB.latitude : pointB.lat;
  const lngB = pointB.longitude != null ? pointB.longitude : pointB.lng;

  result.distance = haversineDistance(latA, lngA, latB, lngB);

  const epsilonA = getAdaptiveEpsilon(pointA);
  const epsilonB = getAdaptiveEpsilon(pointB);
  result.epsilon = Math.max(epsilonA, epsilonB);

  const semanticCheckA = pointA.subcategory || pointA.category;
  const semanticCheckB = pointB.subcategory || pointB.category;
  result.semantic = checkSemanticRelation(semanticCheckA, semanticCheckB);

  if (!result.semantic.isRelated && pointA.category && pointB.category) {
    const mainCategorySemantic = checkSemanticRelation(pointA.category, pointB.category);
    if (mainCategorySemantic.isRelated) {
      result.semantic = mainCategorySemantic;
    }
  }

  result.keywordAnalysis = checkKeywordSimilarity(pointA, pointB);
  result.timeDiff = getTimeDifferenceHours(pointA.timestamp, pointB.timestamp);

  const MAX_TIME_DIFF_HOURS = 48;
  const distanceOk = result.distance <= result.epsilon;
  const semanticOk = result.semantic.isRelated;
  const temporalOk = result.timeDiff <= MAX_TIME_DIFF_HOURS;

  const baseDecision = distanceOk && semanticOk && temporalOk;
  result.shouldMerge = baseDecision;
  result.verdict = result.shouldMerge ? "MERGED" : "REJECTED";

  return result;
}

function getSemanticallyRelatedNeighbors(point, allPoints, visited = new Set()) {
  const neighbors = [];

  for (const candidate of allPoints) {
    if (candidate.id === point.id) continue;
    if (visited.has(candidate.id)) continue;
    // Support both lat/lng and latitude/longitude property names
    const candidateLat = candidate.latitude != null ? candidate.latitude : candidate.lat;
    const candidateLng = candidate.longitude != null ? candidate.longitude : candidate.lng;
    if (candidateLat == null || candidateLng == null) continue;

    const logicResult = checkLogic(point, candidate);

    if (logicResult.shouldMerge) {
      neighbors.push({
        neighbor: candidate,
        logicResult
      });
    }
  }
  return neighbors;
}

function expandCluster(point, neighbors, clusterId, allPoints, visited, cluster, depth = 0, chainLog = []) {
  const MAX_CHAIN_DEPTH = 10;
  const MIN_PTS = 1;

  if (depth > MAX_CHAIN_DEPTH) return { cluster, chainLog };

  visited.add(point.id);

  if (!cluster.find(p => p.id === point.id)) {
    cluster.push({
      ...point,
      _clusterId: clusterId,
      _clusterRole: neighbors.length >= MIN_PTS ? "CORE" : "BORDER",
      _chainDepth: depth
    });
  }

  if (chainLog.length === 0 || chainLog[chainLog.length - 1].id !== point.id) {
    chainLog.push({
      id: point.id,
      category: point.category,
      depth
    });
  }

  if (neighbors.length < MIN_PTS) return { cluster, chainLog };

  for (const { neighbor } of neighbors) {
    if (visited.has(neighbor.id)) continue;

    const neighborNeighbors = getSemanticallyRelatedNeighbors(neighbor, allPoints, visited);

    expandCluster(
      neighbor,
      neighborNeighbors,
      clusterId,
      allPoints,
      visited,
      cluster,
      depth + 1,
      chainLog
    );
  }

  return { cluster, chainLog };
}

// ==================== MAIN CLASS ====================

class AdaptiveDBSCAN {
  constructor() {
    this.version = "2.0";
    console.log("AdaptiveDBSCAN initialized");
  }

  cluster(data, options = {}) {
    if (!data || data.length === 0) {
      return { clusters: [], noise: [], metadata: {} };
    }

    // Support both lat/lng and latitude/longitude property names
    const validData = data.filter(p => {
      const hasLat = p.latitude != null || p.lat != null;
      const hasLng = p.longitude != null || p.lng != null;
      return hasLat && hasLng && (p.category || p.subcategory);
    });

    // Normalize: ensure both latitude/longitude AND lat/lng exist on each point
    validData.forEach(p => {
      if (p.latitude == null && p.lat != null) p.latitude = p.lat;
      if (p.longitude == null && p.lng != null) p.longitude = p.lng;
      if (p.lat == null && p.latitude != null) p.lat = p.latitude;
      if (p.lng == null && p.longitude != null) p.lng = p.longitude;
      if (!p.timestamp) p.timestamp = normalizeTimestamp(p.submittedAt || p.submitted_at || p.timestamp);
    });

    const visited = new Set();
    const clusters = [];
    const clusterChains = [];
    let clusterId = 0;

    for (const point of validData) {
      if (visited.has(point.id)) continue;

      const neighbors = getSemanticallyRelatedNeighbors(point, validData, visited);
      const adaptiveMinPts = getAdaptiveMinPts(point);

      if (neighbors.length >= adaptiveMinPts) {
        const cluster = [];
        const chainLog = [];

        expandCluster(
          point,
          neighbors,
          clusterId,
          validData,
          visited,
          cluster,
          0,
          chainLog
        );

        if (cluster.length > 0) {
          clusters.push(cluster);
          clusterChains.push(chainLog);
          clusterId++;
        }
      } else {
        visited.add(point.id);
      }
    }

    // Identify noise
    const clusteredIds = new Set(clusters.flat().map(p => p.id));
    const noise = validData.filter(p => !clusteredIds.has(p.id));

    // Calculate metadata
    const metadata = {
      totalPoints: validData.length,
      totalClusters: clusters.length,
      noisePoints: noise.length,
      averageClusterSize: clusters.length > 0 ?
        clusters.reduce((sum, c) => sum + c.length, 0) / clusters.length : 0
    };

    return {
      clusters,
      noise,
      clusterChains,
      metadata
    };
  }

  /**
   * Calculate distance between two points using Haversine formula
   * (API-compatible with standard DBSCAN class)
   * @param {Object} point1 - {lat, lng}
   * @param {Object} point2 - {lat, lng}
   * @returns {number} Distance in kilometers
   */
  calculateDistance(point1, point2) {
    const lat1 = point1.latitude || point1.lat;
    const lng1 = point1.longitude || point1.lng;
    const lat2 = point2.latitude || point2.lat;
    const lng2 = point2.longitude || point2.lng;
    return haversineDistance(lat1, lng1, lat2, lng2) / 1000; // Convert meters to km
  }

  /**
   * Calculate cluster statistics
   * (API-compatible with standard DBSCAN class)
   * @param {Array} points - Original points array
   * @param {Object} clusteringResult - Result from cluster() method
   * @returns {Object} Statistics about the clustering
   */
  calculateStatistics(points, clusteringResult) {
    const clusters = clusteringResult.clusters || [];
    const noise = clusteringResult.noise || [];

    const stats = {
      totalPoints: points.length,
      numClusters: clusters.length,
      numNoise: noise.length,
      clusterDetails: []
    };

    clusters.forEach((cluster, index) => {
      // Handle both object-based and index-based clusters
      const clusterPoints = cluster.map(item => {
        if (typeof item === "number") return points[item];
        return item;
      }).filter(Boolean);

      if (clusterPoints.length === 0) return;

      const centerLat = clusterPoints.reduce((sum, p) => sum + (p.lat || p.latitude || 0), 0) / clusterPoints.length;
      const centerLng = clusterPoints.reduce((sum, p) => sum + (p.lng || p.longitude || 0), 0) / clusterPoints.length;

      let maxRadius = 0;
      clusterPoints.forEach(point => {
        const pLat = point.lat || point.latitude || 0;
        const pLng = point.lng || point.longitude || 0;
        const distance = haversineDistance(centerLat, centerLng, pLat, pLng) / 1000;
        maxRadius = Math.max(maxRadius, distance);
      });

      const area = Math.PI * maxRadius * maxRadius;
      const density = clusterPoints.length / Math.max(area, 0.01);

      stats.clusterDetails.push({
        id: index,
        size: clusterPoints.length,
        center: { lat: centerLat, lng: centerLng },
        radius: maxRadius,
        density,
        points: clusterPoints
      });
    });

    return stats;
  }
}

// Expose to global scope for HeatmapVisualization
window.AdaptiveDBSCAN = AdaptiveDBSCAN;
