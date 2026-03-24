const Database = require("../../config/database");
const Complaint = require("../../models/Complaint");
const {
  ADAPTIVE_EPSILON,
  ADAPTIVE_MINPTS,
  getEpsilonForCategory,
  getMinPtsForCategory,
  epsilonToMeters
} = require("../../utils/similarityUtils");

/**
 * clusteringService v5.0
 * Implements Thesis-Validated Adaptive DBSCAN clustering for complaint analytics.
 *
 * SYNCHRONIZED with D.R.I.M.S._Simulated_System
 *
 * Key Changes in v5.0:
 * - Imports ADAPTIVE_EPSILON/ADAPTIVE_MINPTS from similarityUtils.js
 * - Uses degrees-based epsilon (0.001125 ≈ 125m for Infrastructure)
 * - Removed hardcoded CLUSTERING_TIERS in favor of centralized lookup
 */
class ClusteringService {
  constructor() {
    this.db = Database.getInstance();
    this.supabase = this.db.getClient();

    // Semantic Relationship Matrix (for semantic clustering)
    // Which categories can form a cluster together?
    this.RELATIONSHIP_MATRIX = {
      "Fire": ["Smoke", "Explosion"],
      "Flood": ["Flooding", "Traffic", "Stranded"],
      "Flooding": ["Flood", "Traffic", "Stranded", "Clogged Drainage"],
      "Accident": ["Traffic", "Medical"],
      "Pothole": ["Road Damage", "Infrastructure"],
      "Road Damage": ["Pothole", "Infrastructure"],
      "Traffic": ["Road Obstruction", "Accident"],
      "Trash": ["Garbage", "Illegal Dumping", "Sanitation"],
      "Garbage": ["Trash", "Illegal Dumping", "Sanitation"],
      "Infrastructure": ["Pothole", "Road Damage", "Streetlight", "Drainage"]
    };
  }

  /**
     * Get epsilon for a category (thesis-validated lookup)
     * Uses centralized ADAPTIVE_EPSILON from similarityUtils.js
     *
     * @param {string} category - Category name
     * @returns {number} Epsilon in degrees
     */
  _getEpsilonForCategory(category) {
    return getEpsilonForCategory(category);
  }

  /**
     * Get minPts for a category (thesis-validated lookup)
     * Uses centralized ADAPTIVE_MINPTS from similarityUtils.js
     *
     * @param {string} category - Category name
     * @returns {number} MinPts value
     */
  _getMinPtsForCategory(category) {
    return getMinPtsForCategory(category);
  }

  /**
     * Main function to generate clusters from active complaints.
     * @returns {Object} { clusters: [], noise: [] }
     */
  async generateClusters() {
    try {
      console.log("[CLUSTERING v5.0] 🔄 Starting Thesis-Validated DBSCAN analysis...");
      console.log("[CLUSTERING v5.0] Using ADAPTIVE_EPSILON from similarityUtils.js");

      // 1. Fetch active complaints (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: complaints, error } = await this.supabase
        .from("complaints")
        // FC-10 FIX: Use correct column names (submitted_at not created_at, no title column)
        .select("id, latitude, longitude, category, subcategory, submitted_at, urgency_score, location, description")
        .gte("submitted_at", sevenDaysAgo)
        .neq("workflow_status", "closed")
        .neq("workflow_status", "rejected");

      if (error) throw error;
      if (!complaints || complaints.length === 0) return { clusters: [], noise: [] };

      console.log(`[CLUSTERING v5.0] Processing ${complaints.length} datapoints...`);

      // 2. Prepare points
      const points = complaints.map(c => ({
        ...c,
        visited: false,
        clusterId: null,
        lat: parseFloat(c.latitude),
        lng: parseFloat(c.longitude)
      })).filter(p => !isNaN(p.lat) && !isNaN(p.lng));

      // 3. DBSCAN Algorithm with Thesis-Validated Parameters
      let clusterId = 0;
      const clusters = [];

      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        if (point.visited) continue;

        point.visited = true;
        const neighbors = this._regionQuery(point, points);

        // Get adaptive minPts from centralized config
        const minPts = this._getMinPtsForCategory(point.category || point.subcategory);
        const epsilon = this._getEpsilonForCategory(point.category || point.subcategory);

        console.log(`[CLUSTERING v5.0] Point ${point.id} [${point.category}]: ε=${epsilon} (${epsilonToMeters(epsilon)}m), minPts=${minPts}`);

        if (neighbors.length < minPts) {
          point.type = "NOISE";
        } else {
          clusterId++;
          const newCluster = this._expandCluster(point, neighbors, points, clusterId);
          clusters.push(newCluster);
        }
      }

      console.log(`[CLUSTERING v5.0] ✅ Generated ${clusters.length} clusters.`);
      return { clusters, noise: points.filter(p => p.type === "NOISE") };

    } catch (error) {
      console.error("[CLUSTERING v5.0] Error:", error.message);
      return { clusters: [], noise: [] };
    }
  }

  /**
     * Expand the cluster recursively (BFS implementation)
     */
  _expandCluster(point, neighbors, allPoints, clusterId) {
    const clusterPoints = [point];
    point.clusterId = clusterId;

    // Queue for BFS
    let queue = [...neighbors];

    while (queue.length > 0) {
      const neighbor = queue.shift();

      if (!neighbor.visited) {
        neighbor.visited = true;
        const newNeighbors = this._regionQuery(neighbor, allPoints);

        const minPts = this._getMinPtsForCategory(neighbor.category || neighbor.subcategory);
        if (newNeighbors.length >= minPts) {
          queue = [...queue, ...newNeighbors];
        }
      }

      if (neighbor.clusterId === null) {
        neighbor.clusterId = clusterId;
        clusterPoints.push(neighbor);
      }
    }

    // Calculate Cluster Properties
    return this._SynthesizeClusterProps(clusterPoints, clusterId);
  }

  /**
     * Find neighbors within Epsilon AND Semantic Match
     * v5.0: Uses thesis-validated epsilon from ADAPTIVE_EPSILON
     */
  _regionQuery(point, allPoints) {
    // Get epsilon from centralized thesis-validated config
    const epsilonDegrees = this._getEpsilonForCategory(point.category || point.subcategory);

    // Convert to meters for haversine comparison
    const epsilonMeters = epsilonToMeters(epsilonDegrees);

    return allPoints.filter(other => {
      if (point.id === other.id) return false;

      // 1. Spatial Check (Haversine returns meters)
      const dist = this._haversineDistance(point.lat, point.lng, other.lat, other.lng);
      if (dist > epsilonMeters) return false;

      // 2. Semantic Check (Mixed Category Logic)
      return this._isSemanticallyRelated(point.category, other.category);
    });
  }

  _isSemanticallyRelated(catA, catB) {
    if (!catA || !catB) return true; // Fallback
    if (catA === catB) return true;

    // Check Matrix A->B
    if (this.RELATIONSHIP_MATRIX[catA]?.includes(catB)) return true;
    // Check Matrix B->A
    if (this.RELATIONSHIP_MATRIX[catB]?.includes(catA)) return true;

    return false;
  }

  _haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
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

  _SynthesizeClusterProps(points, id) {
    // Calculate Center
    const latSum = points.reduce((abc, p) => abc + p.lat, 0);
    const lngSum = points.reduce((abc, p) => abc + p.lng, 0);

    // Identify dominant category
    const catCounts = {};
    let maxCount = 0;
    let dominantCat = "Others";
    points.forEach(p => {
      catCounts[p.category] = (catCounts[p.category] || 0) + 1;
      if (catCounts[p.category] > maxCount) {
        maxCount = catCounts[p.category];
        dominantCat = p.category;
      }
    });

    // Urgency Sum
    const urgencyAvg = points.reduce((acc, p) => acc + (p.urgency_score || 0), 0) / points.length;

    // Get thesis-validated radius
    const radiusFromPoints = this._calculateRadius(points, { lat: latSum / points.length, lng: lngSum / points.length });

    return {
      id: `cluster_${id}`,
      center: { lat: latSum / points.length, lng: lngSum / points.length },
      points,
      size: points.length,
      category: dominantCat,
      urgency_avg: Math.round(urgencyAvg),
      radius: radiusFromPoints,
      epsilon_used: epsilonToMeters(this._getEpsilonForCategory(dominantCat)) // For debugging
    };
  }

  _calculateRadius(points, center) {
    let maxDist = 0;
    for (const p of points) {
      const d = this._haversineDistance(center.lat, center.lng, p.lat, p.lng);
      if (d > maxDist) maxDist = d;
    }
    return Math.max(maxDist, 10); // Minimum 10m radius
  }
}

module.exports = new ClusteringService();
