/**
 * CLUSTERING SERVICE
 * ==================
 * Ported from simulation-engine.js
 * Implements DBSCAN++ (Density-Based Spatial Clustering of Applications with Noise)
 * Optimized for Geospatial Incident Clustering
 *
 * [FC-04] Now uses thesis-validated adaptive parameters from similarityUtils.js
 * instead of fixed 300m radius / minPts=2 constants.
 */

const {
  getEpsilonForCategory,
  getMinPtsForCategory,
  epsilonToMeters,
} = require("../../utils/similarityUtils");

class ClusteringService {
  constructor() {
    // Fallback constants (used only when category is missing)
    this.EPSILON_METERS_FALLBACK = 33;  // ~0.00030 degrees default from thesis
    this.MIN_PTS_FALLBACK = 3;          // Default minPts from thesis
    this.TIME_WINDOW_MINUTES = 45;      // Max time difference for clustering
    this.CLUSTER_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour expiration

    // Severity Weights
    this.SEVERITY_WEIGHTS = {
      "Critical": 3,
      "High": 2,
      "Medium": 1,
      "Low": 0.5
    };
  }

  // ==================== HELPERS ====================

  toRadians(degrees) {
    return degrees * Math.PI / 180;
  }

  // Harversine Distance (Meters)
  getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = this.toRadians(lat1);
    const φ2 = this.toRadians(lat2);
    const Δφ = this.toRadians(lat2 - lat1);
    const Δλ = this.toRadians(lon2 - lon1);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  getTimestamp(incident) {
    // Handle various date formats
    if (incident.timestamp) return new Date(incident.timestamp).getTime();
    if (incident.created_at) return new Date(incident.created_at).getTime();
    return Date.now();
  }

  // ==================== DBSCAN++ ENGINE ====================

  /**
     * Main Clustering Function
     * @param {Array} incidents - List of raw incident objects
     * @returns {Array} List of formed clusters
     */
  clusterIncidents(incidents) {
    if (!incidents || incidents.length === 0) return [];

    const clusters = [];
    const visited = new Set();
    const noise = new Set();

    // 1. Sort by time (newest first) to prioritize recent active clusters
    const sortedIncidents = [...incidents].sort((a, b) =>
      this.getTimestamp(b) - this.getTimestamp(a)
    );

    for (let i = 0; i < sortedIncidents.length; i++) {
      const point = sortedIncidents[i];

      if (visited.has(point.id)) continue;
      visited.add(point.id);

      // Find neighbors (Spatial + Temporal + Category Constraint)
      const neighbors = this.regionQuery(point, sortedIncidents);

      // Special handling for "Lone Wolf" high-priority incidents (Fire, Accident, Crime)
      const isLoneWolf = this.isLoneWolfCategory(point.category);
      // [FC-04] Use thesis-validated adaptive minPts per category
      const categoryMinPts = getMinPtsForCategory(point.category);
      const effectiveMinPts = isLoneWolf ? 1 : categoryMinPts;

      if (neighbors.length < effectiveMinPts) {
        noise.add(point.id);
      } else {
        // Expand Cluster
        const newCluster = this.expandCluster(point, neighbors, visited, sortedIncidents);
        if (newCluster) {
          clusters.push(newCluster);
        }
      }
    }

    return this.postProcessClusters(clusters);
  }

  regionQuery(corePoint, allPoints) {
    // [FC-04] Use thesis-validated adaptive epsilon for this category
    const epsilonDeg = getEpsilonForCategory(corePoint.category);
    const epsilonMeters = epsilonToMeters(epsilonDeg);

    return allPoints.filter(otherPoint => {
      // 1. Self Check
      if (corePoint.id === otherPoint.id) return true;

      // 2. Category Check (Strict Matching)
      if (corePoint.category !== otherPoint.category) return false;

      // 3. Temporal Check (Time Window)
      const timeDiff = Math.abs(this.getTimestamp(corePoint) - this.getTimestamp(otherPoint));
      const minutesDiff = timeDiff / (1000 * 60);
      if (minutesDiff > this.TIME_WINDOW_MINUTES) return false;

      // 4. Spatial Check (Distance) — adaptive per category
      const distance = this.getDistance(
        corePoint.latitude, corePoint.longitude,
        otherPoint.latitude, otherPoint.longitude
      );

      return distance <= epsilonMeters;
    });
  }

  expandCluster(corePoint, neighbors, visited, allPoints) {
    const clusterPoints = [corePoint]; // Start with core

    // Use a queue for neighbors to process
    const queue = [...neighbors];

    while (queue.length > 0) {
      const point = queue.shift();

      // If not visited, mark and potential expand neighbors
      if (!visited.has(point.id)) {
        visited.add(point.id);

        const pointNeighbors = this.regionQuery(point, allPoints);
        // [FC-04] Use adaptive minPts for cluster expansion too
        const ptMinPts = getMinPtsForCategory(point.category);
        if (pointNeighbors.length >= ptMinPts) {
          // Add new neighbors to queue if they aren't already there or visited
          for (const n of pointNeighbors) {
            if (!visited.has(n.id)) {
              queue.push(n);
            }
          }
        }
      }

      // Add to cluster if not already added (simple check by ID)
      if (!clusterPoints.find(p => p.id === point.id)) {
        clusterPoints.push(point);
      }
    }

    return this.createClusterObject(clusterPoints);
  }

  createClusterObject(points) {
    if (points.length === 0) return null;

    // Calculate Centroid
    const totalLat = points.reduce((sum, p) => sum + parseFloat(p.latitude), 0);
    const totalLng = points.reduce((sum, p) => sum + parseFloat(p.longitude), 0);

    // Calculate Severity Score
    const urgencyScore = points.reduce((sum, p) => sum + (this.SEVERITY_WEIGHTS[p.priority] || 1), 0);

    // Determine Confidence (Simple linear check based on support)
    let confidence = 0.5 + (points.length * 0.1);
    if (confidence > 0.95) confidence = 0.95;

    const core = points[0]; // Representative

    return {
      id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      category: core.category,
      count: points.length,
      urgency_score: urgencyScore.toFixed(1),
      confidence: confidence.toFixed(2),
      timestamp: new Date().toISOString(),
      latitude: totalLat / points.length,
      longitude: totalLng / points.length,
      radius: this.calculateRadius(points),
      reports: points, // Metadata
      status: "active"
    };
  }

  // FC-13 FIX: Calculate actual cluster radius from centroid using Haversine
  calculateRadius(points) {
    if (points.length <= 1) return 50; // Minimum radius in meters
    // Calculate centroid
    const centLat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
    const centLng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
    // Find max distance from centroid (Haversine approximation)
    let maxDist = 0;
    for (const p of points) {
      const dLat = (p.latitude - centLat) * Math.PI / 180;
      const dLng = (p.longitude - centLng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(centLat * Math.PI / 180) * Math.cos(p.latitude * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
      const dist = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // meters
      if (dist > maxDist) maxDist = dist;
    }
    return Math.max(50, Math.round(maxDist)); // Minimum 50m
  }

  isLoneWolfCategory(category) {
    // Categories that should form a cluster even with just 1 report
    const LONE_WOLVES = [
      "Fire", "Smoke", "Explosion", "Gas Leak",
      "Accident", "Vehicle Breakdown", "Crime", "Robbery", "Gunshot"
    ];
    return LONE_WOLVES.includes(category);
  }

  postProcessClusters(clusters) {
    return clusters;
  }
}

module.exports = new ClusteringService();
