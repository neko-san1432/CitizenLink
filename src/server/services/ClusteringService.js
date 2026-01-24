const Database = require('../config/database');
const Complaint = require('../models/Complaint');

/**
 * ClusteringService
 * Implements Adaptive DBSCAN clustering for complaint analytics.
 * Ported from Simulation Engine v3.9
 */
class ClusteringService {
    constructor() {
        this.db = Database.getInstance();
        this.supabase = this.db.getClient();

        // Configuration from Simulation Engine (Aligned to 5-Tier Schema)
        this.CLUSTERING_TIERS = {
            TIER_1_CRITICAL: { epsilon: 20.0, minPts: 1 }, // Life-Threatening (Fire, Crime) - "Lone Wolf" valid
            TIER_2_HIGH: { epsilon: 30.0, minPts: 2 },     // High Priority (Accident)
            TIER_3_INFRA: { epsilon: 40.0, minPts: 3 },    // Infrastructure (Pothole, Broken Light)
            TIER_4_QOL: { epsilon: 50.0, minPts: 4 },      // Quality of Life (Noise, Trash)
            TIER_5_MINOR: { epsilon: 60.0, minPts: 5 }     // Minor Issues
        };

        // Categories mapping to Tiers (Default if urgency_score missing)
        this.CATEGORY_CONFIG = {
            'Fire': 'TIER_1_CRITICAL',
            'Crime': 'TIER_1_CRITICAL',
            'Accident': 'TIER_2_HIGH',
            'Flood': 'TIER_2_HIGH',
            'Flooding': 'TIER_2_HIGH',
            'Blackout': 'TIER_3_INFRA',
            'Pothole': 'TIER_3_INFRA',
            'Road Damage': 'TIER_3_INFRA',
            'Traffic': 'TIER_4_QOL',
            'Trash': 'TIER_4_QOL',
            'Noise': 'TIER_4_QOL',
            'Others': 'TIER_5_MINOR'
        };

        // Semantic Relationship Matrix (for semantic clustering)
        // Which categories can form a cluster together?
        this.RELATIONSHIP_MATRIX = {
            'Fire': ['Smoke', 'Explosion'],
            'Flood': ['Flooding', 'Traffic', 'Stranded'],
            'Accident': ['Traffic', 'Medical'],
            'Pothole': ['Road Damage'],
            'Traffic': ['Road Obstruction', 'Accident']
        };
    }

    /**
     * Main function to generate clusters from active complaints.
     * @returns {Object} { clusters: [], noise: [] }
     */
    async generateClusters() {
        try {
            console.log('[CLUSTERING] 🔄 Starting DBSCAN analysis...');

            // 1. Fetch active complaints (last 7 days)
            // We focus on active/recent issues for the dashboard
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

            const { data: complaints, error } = await this.supabase
                .from('complaints')
                .select('id, latitude, longitude, category, subcategory, created_at, title, urgency_score, location, descriptive_su')
                .gte('created_at', sevenDaysAgo)
                .neq('workflow_status', 'closed')
                .neq('workflow_status', 'rejected');

            if (error) throw error;
            if (!complaints || complaints.length === 0) return { clusters: [], noise: [] };

            console.log(`[CLUSTERING] Processing ${complaints.length} datapoints...`);

            // 2. Prepare points
            const points = complaints.map(c => ({
                ...c,
                visited: false,
                clusterId: null,
                lat: parseFloat(c.latitude),
                lng: parseFloat(c.longitude)
            })).filter(p => !isNaN(p.lat) && !isNaN(p.lng));

            // 3. DBSCAN Algorithm
            let clusterId = 0;
            const clusters = [];

            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                if (point.visited) continue;

                point.visited = true;
                const neighbors = this._regionQuery(point, points);

                // Check minPts (Adaptive)
                const config = this._getConfig(point.category);

                if (neighbors.length < config.minPts) {
                    point.type = 'NOISE';
                } else {
                    clusterId++;
                    const newCluster = this._expandCluster(point, neighbors, points, clusterId);
                    clusters.push(newCluster);
                }
            }

            console.log(`[CLUSTERING] ✅ Generated ${clusters.length} clusters.`);
            return { clusters, noise: points.filter(p => p.type === 'NOISE') };

        } catch (error) {
            console.error('[CLUSTERING] Error:', error.message);
            return { clusters: [], noise: [] };
        }
    }

    /**
     * Expand the cluster recursively
     */
    _expandCluster(point, neighbors, allPoints, clusterId) {
        const clusterPoints = [point];
        point.clusterId = clusterId;

        // Queue for BFS
        // Simulation engine uses DFS but BFS is safer for stack depth in Node
        let queue = [...neighbors];

        while (queue.length > 0) {
            const neighbor = queue.shift();

            if (!neighbor.visited) {
                neighbor.visited = true;
                const newNeighbors = this._regionQuery(neighbor, allPoints);

                const config = this._getConfig(neighbor.category);
                if (newNeighbors.length >= config.minPts) {
                    // Add new neighbors to queue if they are semantically related
                    // Only expand if semantic link OK (e.g. dont merge Pothole into Fire cluster)
                    // ... actually standard DBSCAN expands based on density, 
                    // but we apply "Semantic Filtering" inside the region query or here?
                    // Simulation engine applies it in `getSemanticallyRelatedNeighbors`.
                    // Here we applied it in _regionQuery.
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
     */
    _regionQuery(point, allPoints) {
        const config = this._getConfig(point.category);
        const epsilon = config.epsilon;

        return allPoints.filter(other => {
            if (point.id === other.id) return false;

            // 1. Spatial Check
            const dist = this._haversineDistance(point.lat, point.lng, other.lat, other.lng);
            if (dist > epsilon) return false;

            // 2. Semantic Check (Mixed Category Logic)
            // If categories match exactly -> OK
            // If related in matrix -> OK (e.g. Fire & Smoke)
            // Otherwise -> Skip (Don't cluster "Pothole" with "Fire" even if 5 meters apart)
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

    _getConfig(category) {
        const tierKey = this.CATEGORY_CONFIG[category] || 'TIER_3_INFRA';
        return this.CLUSTERING_TIERS[tierKey];
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
        let dominantCat = 'Others';
        points.forEach(p => {
            catCounts[p.category] = (catCounts[p.category] || 0) + 1;
            if (catCounts[p.category] > maxCount) {
                maxCount = catCounts[p.category];
                dominantCat = p.category;
            }
        });

        // Urgency Sum
        const urgencyAvg = points.reduce((acc, p) => acc + (p.urgency_score || 0), 0) / points.length;

        return {
            id: `cluster_${id}`,
            center: { lat: latSum / points.length, lng: lngSum / points.length },
            points: points,
            size: points.length,
            category: dominantCat,
            urgency_avg: Math.round(urgencyAvg),
            radius: this._calculateRadius(points, { lat: latSum / points.length, lng: lngSum / points.length })
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
