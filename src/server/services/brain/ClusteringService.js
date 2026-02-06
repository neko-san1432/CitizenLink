/**
 * CLUSTERING SERVICE
 * ==================
 * Ported from simulation-engine.js
 * Implements DBSCAN++ (Density-Based Spatial Clustering of Applications with Noise)
 * Optimized for Geospatial Incident Clustering
 */

const CAUSALITY_MANAGER = require('./CausalityService');

class ClusteringService {
    constructor() {
        // System Constants
        this.EPSILON_METERS = 300;     // Max distance for neighborhood
        this.MIN_PTS = 2;              // Min points to form a cluster
        this.TIME_WINDOW_MINUTES = 45; // Max time difference for clustering
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

        let clusters = [];
        let visited = new Set();
        let noise = new Set();

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
            const effectiveMinPts = isLoneWolf ? 1 : this.MIN_PTS;

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
        return allPoints.filter(otherPoint => {
            // 1. Self Check
            if (corePoint.id === otherPoint.id) return true;

            // 2. Category Check (Strict Matching)
            if (corePoint.category !== otherPoint.category) return false;

            // 3. Temporal Check (Time Window)
            const timeDiff = Math.abs(this.getTimestamp(corePoint) - this.getTimestamp(otherPoint));
            const minutesDiff = timeDiff / (1000 * 60);
            if (minutesDiff > this.TIME_WINDOW_MINUTES) return false;

            // 4. Spatial Check (Distance)
            const distance = this.getDistance(
                corePoint.latitude, corePoint.longitude,
                otherPoint.latitude, otherPoint.longitude
            );

            return distance <= this.EPSILON_METERS;
        });
    }

    expandCluster(corePoint, neighbors, visited, allPoints) {
        const clusterPoints = [corePoint]; // Start with core

        // Use a queue for neighbors to process
        let queue = [...neighbors];

        while (queue.length > 0) {
            const point = queue.shift();

            // If not visited, mark and potential expand neighbors
            if (!visited.has(point.id)) {
                visited.add(point.id);

                const pointNeighbors = this.regionQuery(point, allPoints);
                if (pointNeighbors.length >= this.MIN_PTS) {
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

    calculateRadius(points) {
        if (points.length <= 1) return 50; // Minimum radius
        // Find max distance from centroid
        // Simplified: just max distance between any two points / 2
        // Or actual radius from centroid
        // Let's do max distance from first point for speed
        return 100; // placeholder for visualization
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
        // Run Causal Analysis if needed (Optional here, can be done in Orchestrator)
        // For now, we just return the raw clusters
        return clusters;
    }
}

module.exports = new ClusteringService();
