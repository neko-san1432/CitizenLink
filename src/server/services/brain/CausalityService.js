/**
 * CAUSALITY SERVICE
 * =================
 * Ported from causality-manager.js
 * Handles Spatio-Temporal Heuristics for Disaster Chain Detection.
 */

const CAUSAL_MAX_TIME_HOURS = 24;
const DEFAULT_CAUSAL_PROXIMITY = 50;

// Helper: Haversine Distance (duplicated to avoid external dependency issues)
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

class CausalityService {
  constructor() {
    /**
         * CAUSAL MATRIX - Physics of Disaster Propagation
         * Defines which categories can CAUSE other categories.
         */
    this.CAUSAL_MATRIX = {
      // FLOOD CHAIN
      "Flooding": ["Traffic", "Stranded", "Blackout", "Road Damage", "Accident", "Evacuation", "Health Hazard"],
      "Flood": ["Traffic", "Stranded", "Blackout", "Road Damage", "Accident", "Evacuation", "Health Hazard"],
      "Flash Flood": ["Traffic", "Stranded", "Blackout", "Accident", "Evacuation", "Building Collapse"],
      "Heavy Rain": ["Flooding", "Flood", "Traffic", "Landslide", "Accident"],
      "Pipe Leak": ["Flooding", "Flood", "No Water", "Road Damage"],
      "Clogged Drainage": ["Flooding", "Flood"],
      "Clogged Canal": ["Flooding", "Flood"],

      // FIRE CHAIN
      "Fire": ["Traffic", "Smoke", "Evacuation", "Blackout", "Road Obstruction", "Medical", "Panic"],
      "Explosion": ["Fire", "Traffic", "Evacuation", "Medical", "Building Collapse", "Blackout"],
      "Gas Leak": ["Fire", "Explosion", "Evacuation"],
      "Transformer Explosion": ["Fire", "Blackout"],
      "Power Line Down": ["Fire", "Blackout"],

      // ACCIDENT CHAIN
      "Accident": ["Traffic", "Road Obstruction", "Medical"],
      "Vehicle Breakdown": ["Traffic", "Road Obstruction"],
      "Reckless Driving": ["Accident"],
      "Drunk Driving": ["Accident"],

      // TRAFFIC CHAIN
      "Traffic": ["Noise", "Air Pollution"],
      "Road Obstruction": ["Traffic"],

      // INFRASTRUCTURE CHAIN
      "Landslide": ["Road Obstruction", "Traffic", "Stranded", "Evacuation"],
      "Bridge Collapse": ["Traffic", "Stranded"],
      "Fallen Tree": ["Road Obstruction", "Traffic", "Blackout"],
      "Building Collapse": ["Traffic", "Evacuation", "Medical"],
      "Pothole": ["Accident"],
      "Road Damage": ["Accident", "Traffic"],

      // UTILITIES CHAIN
      "Blackout": ["Traffic", "Accident", "Crime"],
      "No Water": ["Health Hazard"],

      // CRIME CHAIN
      "Crime": ["Traffic", "Panic"],
      "Robbery": ["Traffic", "Panic"],
      "Gang Activity": ["Panic"],
      "Gunshot": ["Panic"],

      // HEALTH CHAIN
      "Sewage Leak": ["Health Hazard", "Bad Odor"],
      "Mosquito Breeding": ["Health Hazard"],
      "Pest Infestation": ["Health Hazard"],
      "Trash": ["Pest Infestation", "Bad Odor", "Clogged Drainage"],
      "Overflowing Trash": ["Pest Infestation", "Bad Odor", "Clogged Drainage"],

      // ENVIRONMENT CHAIN
      "Earthquake": ["Building Collapse", "Fire", "Landslide", "Panic"]
    };

    this.CAUSAL_DISTANCE_OVERRIDE = {
      "Flooding": 200, "Flood": 200, "Flash Flood": 300,
      "Fire": 150, "Explosion": 250, "Smoke": 300,
      "Blackout": 500, "Earthquake": 1000, "Landslide": 200, "Heavy Rain": 500
    };

    this.CAUSAL_STRENGTH = {
      "Flooding->Traffic": 0.85, "Flood->Traffic": 0.85,
      "Fire->Smoke": 0.95, "Fire->Evacuation": 0.90, "Fire->Traffic": 0.80,
      "Accident->Traffic": 0.90, "Accident->Medical": 0.70,
      "Pipe Leak->Flooding": 0.92, "Clogged Drainage->Flooding": 0.88,
      "Explosion->Fire": 0.85, "Gas Leak->Fire": 0.75,
      "Heavy Rain->Flooding": 0.90, "Landslide->Road Obstruction": 0.95,
      "Blackout->Crime": 0.65, "Earthquake->Building Collapse": 0.75
    };
  }

  // ==================== HELPERS ====================

  getClusterTimestamp(cluster) {
    if (!cluster) return null;
    const timestamp = cluster.timestamp || cluster.created_at || cluster.date || cluster.reported_at || cluster.averageTime || cluster.time;
    if (!timestamp) return null;
    if (typeof timestamp === "number") return new Date(timestamp);
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  }

  getClusterCenter(cluster) {
    if (!cluster) return null;
    if (typeof cluster.latitude === "number" && typeof cluster.longitude === "number") return { lat: cluster.latitude, lng: cluster.longitude };
    if (typeof cluster.lat === "number" && typeof cluster.lng === "number") return { lat: cluster.lat, lng: cluster.lng };
    if (cluster.center) {
      if (typeof cluster.center.lat === "number") return { lat: cluster.center.lat, lng: cluster.center.lng || cluster.center.lon };
      if (typeof cluster.center.latitude === "number") return { lat: cluster.center.latitude, lng: cluster.center.longitude };
    }
    if (cluster.centroid && typeof cluster.centroid.lat === "number") return { lat: cluster.centroid.lat, lng: cluster.centroid.lng || cluster.centroid.lon };
    return null;
  }

  getClusterCategory(cluster) {
    if (!cluster) return "Others";
    return cluster.category || cluster.dominantCategory || cluster.type || cluster.subcategory || "Others";
  }

  getCausalStrength(categoryA, categoryB) {
    const key = `${categoryA}->${categoryB}`;
    return this.CAUSAL_STRENGTH[key] || 0.5;
  }

  // ==================== CORE FUNCTIONS ====================

  canCause(categoryA, categoryB) {
    const possibleEffects = this.CAUSAL_MATRIX[categoryA] || [];
    return possibleEffects.includes(categoryB);
  }

  /**
     * CAUSAL REASONING ENGINE - Main Verification Function
     */
  verifyCausality(clusterA, clusterB) {
    const startTime = Date.now();

    const result = {
      isLinked: false,
      reason: null,
      strength: 0,
      checks: { direction: false, temporal: false, spatial: false },
      details: { categoryA: null, categoryB: null, timeDiffHours: null, distanceMeters: null },
      processingTimeMs: 0
    };

    if (!clusterA || !clusterB) {
      result.reason = "Invalid cluster input (null)";
      result.processingTimeMs = Date.now() - startTime;
      return result;
    }

    const categoryA = this.getClusterCategory(clusterA);
    const categoryB = this.getClusterCategory(clusterB);
    result.details.categoryA = categoryA;
    result.details.categoryB = categoryB;

    // CHECK 1: DIRECTION
    const possibleEffects = this.CAUSAL_MATRIX[categoryA] || [];
    const directionValid = possibleEffects.includes(categoryB);
    result.checks.direction = directionValid;

    if (!directionValid) {
      result.reason = `Causal matrix rejects: "${categoryA}" cannot cause "${categoryB}"`;
      result.processingTimeMs = Date.now() - startTime;
      return result;
    }

    // CHECK 2: TEMPORAL
    const timestampA = this.getClusterTimestamp(clusterA);
    const timestampB = this.getClusterTimestamp(clusterB);

    if (!timestampA || !timestampB) {
      result.checks.temporal = true; // Assume valid if missing
    } else {
      const timeDiffMs = timestampB.getTime() - timestampA.getTime();
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
      result.details.timeDiffHours = Math.round(timeDiffHours * 100) / 100;

      const temporalValid = timeDiffHours > 0 && timeDiffHours <= CAUSAL_MAX_TIME_HOURS;
      result.checks.temporal = temporalValid;

      if (!temporalValid) {
        result.reason = timeDiffHours <= 0
          ? `Effect precedes Cause`
          : `Time diff ${timeDiffHours.toFixed(1)}h exceeds ${CAUSAL_MAX_TIME_HOURS}h`;
        result.processingTimeMs = Date.now() - startTime;
        return result;
      }
    }

    // CHECK 3: SPATIAL
    const centerA = this.getClusterCenter(clusterA);
    const centerB = this.getClusterCenter(clusterB);

    if (!centerA || !centerB) {
      result.checks.spatial = true;
    } else {
      const distance = haversineDistance(centerA.lat, centerA.lng, centerB.lat, centerB.lng);
      result.details.distanceMeters = Math.round(distance);

      const threshold = this.CAUSAL_DISTANCE_OVERRIDE[categoryA] || DEFAULT_CAUSAL_PROXIMITY;
      const spatialValid = distance <= threshold;
      result.checks.spatial = spatialValid;

      if (!spatialValid) {
        result.reason = `Distance ${Math.round(distance)}m exceeds ${threshold}m`;
        result.processingTimeMs = Date.now() - startTime;
        return result;
      }
    }

    // ALL PASS
    result.isLinked = true;
    result.reason = `Causal link verified: ${categoryA} → ${categoryB}`;
    result.strength = this.getCausalStrength(categoryA, categoryB);
    result.processingTimeMs = Date.now() - startTime;

    return result;
  }

  findAllCausalLinks(clusters) {
    const links = [];
    if (!clusters || clusters.length < 2) return links;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = 0; j < clusters.length; j++) {
        if (i === j) continue;
        const result = this.verifyCausality(clusters[i], clusters[j]);
        if (result.isLinked) {
          links.push({
            causeIndex: i,
            effectIndex: j,
            cause: clusters[i],
            effect: clusters[j],
            verification: result
          });
        }
      }
    }
    return links;
  }
}

module.exports = new CausalityService();
