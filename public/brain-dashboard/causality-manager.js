/**
 * ============================================================================
 * CAUSALITY MANAGER - Causal Reasoning Engine v1.0
 * ============================================================================
 * 
 * Spatio-Temporal Heuristics for Disaster Chain Detection
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  INPUT: Two clusters (potential Cause → Effect relationship)            │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CHECK 1: DIRECTION (Causal Matrix)                                     │
 * │  - Does physics allow A to cause B?                                     │
 * │  - Example: Flood → Traffic ✅ | Traffic → Flood ❌                     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CHECK 2: TEMPORAL (Cause Precedes Effect)                              │
 * │  - Is timestamp(A) < timestamp(B)?                                      │
 * │  - Is time difference within causal window?                             │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  CHECK 3: SPATIAL (Within Propagation Distance)                         │
 * │  - Is Haversine distance ≤ threshold?                                   │
 * │  - Threshold varies by category (floods spread further)                 │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  OUTPUT: { isLinked, reason, checks: {direction, temporal, spatial} }   │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * CAUSAL PHYSICS RULES:
 * - FLOOD can cause → Traffic, Stranded, Power Outage
 * - FIRE can cause → Traffic, Injury, Smoke, Panic
 * - ACCIDENT can cause → Traffic, Injury, Fight
 * - TRAFFIC can cause → Noise (Traffic CANNOT cause Flood/Fire!)
 * 
 * PERFORMANCE NOTES:
 * - Single pair verification: O(1)
 * - Find all links in N clusters: O(N²)
 * - Graph building uses adjacency list: O(N + E)
 * 
 * @author DRIMS Development Team
 * @version 1.0.0 - Thesis Defense Implementation
 * @module CausalityManager
 */

(function (global) {
    'use strict';

    // ==================== CONFIGURATION ====================

    /**
     * CAUSAL MATRIX - Physics of Disaster Propagation
     * ================================================
     * 
     * Defines which categories can CAUSE other categories.
     * Direction matters: A -> B doesn't imply B -> A
     * 
     * Rules based on real-world disaster chain reactions.
     */
    const CAUSAL_MATRIX = {
        // FLOOD CHAIN: Water-based cascading effects
        "Flooding": ["Traffic", "Stranded", "Blackout", "Road Damage", "Accident", "Evacuation", "Health Hazard"],
        "Flood": ["Traffic", "Stranded", "Blackout", "Road Damage", "Accident", "Evacuation", "Health Hazard"],
        "Flash Flood": ["Traffic", "Stranded", "Blackout", "Accident", "Evacuation", "Building Collapse"],
        "Heavy Rain": ["Flooding", "Flood", "Traffic", "Landslide", "Accident"],
        "Pipe Leak": ["Flooding", "Flood", "No Water", "Road Damage"],
        "Clogged Drainage": ["Flooding", "Flood"],
        "Clogged Canal": ["Flooding", "Flood"],

        // FIRE CHAIN: Heat/smoke-based cascading effects
        "Fire": ["Traffic", "Smoke", "Evacuation", "Blackout", "Road Obstruction", "Medical", "Panic"],
        "Explosion": ["Fire", "Traffic", "Evacuation", "Medical", "Building Collapse", "Blackout"],
        "Gas Leak": ["Fire", "Explosion", "Evacuation"],
        "Transformer Explosion": ["Fire", "Blackout"],
        "Power Line Down": ["Fire", "Blackout"],

        // ACCIDENT CHAIN: Human behavior cascading effects
        "Accident": ["Traffic", "Road Obstruction", "Medical"],
        "Vehicle Breakdown": ["Traffic", "Road Obstruction"],
        "Reckless Driving": ["Accident"],
        "Drunk Driving": ["Accident"],

        // TRAFFIC CHAIN: Limited downstream effects (CANNOT cause floods/fires)
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

    /**
     * Maximum time difference for causal relationship (in hours)
     * Effects should manifest within this window after the cause
     */
    const CAUSAL_MAX_TIME_HOURS = 24;

    /**
     * Maximum distance for causal relationship (in meters)
     * Based on typical disaster propagation distances
     */
    const CAUSAL_MAX_DISTANCE_METERS = 500;

    /**
     * Default spatial threshold for "nearby" events (in meters)
     */
    const DEFAULT_CAUSAL_PROXIMITY = 50;

    /**
     * Extended spatial thresholds by category (some events affect larger areas)
     */
    const CAUSAL_DISTANCE_OVERRIDE = {
        "Flooding": 200,      // Water spreads
        "Flood": 200,
        "Flash Flood": 300,
        "Fire": 150,          // Heat/smoke spread
        "Explosion": 250,     // Blast radius
        "Smoke": 300,         // Smoke drifts
        "Blackout": 500,      // Grid-wide
        "Earthquake": 1000,   // Seismic waves
        "Landslide": 200,     // Debris flow
        "Heavy Rain": 500     // Weather event
    };

    /**
     * Causal chain strength scores (for weighted analysis)
     */
    const CAUSAL_STRENGTH = {
        "Flooding->Traffic": 0.85,
        "Flood->Traffic": 0.85,
        "Fire->Smoke": 0.95,
        "Fire->Evacuation": 0.90,
        "Fire->Traffic": 0.80,
        "Accident->Traffic": 0.90,
        "Accident->Medical": 0.70,
        "Pipe Leak->Flooding": 0.92,
        "Clogged Drainage->Flooding": 0.88,
        "Explosion->Fire": 0.85,
        "Gas Leak->Fire": 0.75,
        "Heavy Rain->Flooding": 0.90,
        "Landslide->Road Obstruction": 0.95,
        "Blackout->Crime": 0.65,
        "Earthquake->Building Collapse": 0.75
    };

    // ==================== HELPER FUNCTIONS ====================

    /**
     * Calculate Haversine distance between two GPS coordinates.
     * Falls back to global haversineDistance if available.
     * 
     * @param {number} lat1 - Latitude of point 1
     * @param {number} lon1 - Longitude of point 1
     * @param {number} lat2 - Latitude of point 2
     * @param {number} lon2 - Longitude of point 2
     * @returns {number} Distance in meters
     */
    function _haversineDistance(lat1, lon1, lat2, lon2) {
        // Use global haversineDistance if available (from simulation-engine.js)
        if (typeof global.haversineDistance === 'function') {
            return global.haversineDistance(lat1, lon1, lat2, lon2);
        }

        // Fallback implementation
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

    /**
     * Extracts timestamp from a cluster object.
     * Handles various timestamp formats and cluster structures.
     * 
     * @param {Object} cluster - Cluster object
     * @returns {Date|null} Parsed date or null
     */
    function getClusterTimestamp(cluster) {
        if (!cluster) return null;

        // Try common timestamp fields
        const timestamp = cluster.timestamp ||
            cluster.created_at ||
            cluster.date ||
            cluster.reported_at ||
            cluster.averageTime ||
            cluster.time;

        if (!timestamp) return null;

        // Handle numeric timestamps (milliseconds)
        if (typeof timestamp === 'number') {
            return new Date(timestamp);
        }

        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? null : date;
    }

    /**
     * Extracts center coordinates from a cluster object.
     * 
     * @param {Object} cluster - Cluster object
     * @returns {Object|null} { lat, lng } or null
     */
    function getClusterCenter(cluster) {
        if (!cluster) return null;

        // Try direct coordinates
        if (typeof cluster.latitude === 'number' && typeof cluster.longitude === 'number') {
            return { lat: cluster.latitude, lng: cluster.longitude };
        }

        // Try lat/lng shorthand
        if (typeof cluster.lat === 'number' && typeof cluster.lng === 'number') {
            return { lat: cluster.lat, lng: cluster.lng };
        }

        // Try center object
        if (cluster.center) {
            if (typeof cluster.center.lat === 'number') {
                return { lat: cluster.center.lat, lng: cluster.center.lng || cluster.center.lon };
            }
            if (typeof cluster.center.latitude === 'number') {
                return { lat: cluster.center.latitude, lng: cluster.center.longitude };
            }
        }

        // Try centroid
        if (cluster.centroid) {
            if (typeof cluster.centroid.lat === 'number') {
                return { lat: cluster.centroid.lat, lng: cluster.centroid.lng || cluster.centroid.lon };
            }
        }

        // Try averaging points if available
        if (cluster.points && Array.isArray(cluster.points) && cluster.points.length > 0) {
            const validPoints = cluster.points.filter(p =>
                typeof p.latitude === 'number' && typeof p.longitude === 'number'
            );

            if (validPoints.length > 0) {
                const sumLat = validPoints.reduce((sum, p) => sum + p.latitude, 0);
                const sumLng = validPoints.reduce((sum, p) => sum + p.longitude, 0);
                return {
                    lat: sumLat / validPoints.length,
                    lng: sumLng / validPoints.length
                };
            }
        }

        return null;
    }

    /**
     * Extracts category from a cluster object.
     * 
     * @param {Object} cluster - Cluster object
     * @returns {string} Category name
     */
    function getClusterCategory(cluster) {
        if (!cluster) return "Others";

        return cluster.category ||
            cluster.dominantCategory ||
            cluster.type ||
            cluster.subcategory ||
            "Others";
    }

    /**
     * Get the causal strength between two categories.
     * 
     * @param {string} categoryA - Cause category
     * @param {string} categoryB - Effect category
     * @returns {number} Strength score (0-1)
     */
    function getCausalStrength(categoryA, categoryB) {
        const key = `${categoryA}->${categoryB}`;
        return CAUSAL_STRENGTH[key] || 0.5; // Default moderate strength
    }

    // ==================== CORE FUNCTIONS ====================

    /**
     * Check if category A can cause category B according to the causal matrix.
     * 
     * @param {string} categoryA - Potential cause
     * @param {string} categoryB - Potential effect
     * @returns {boolean} True if A can cause B
     */
    function canCause(categoryA, categoryB) {
        const possibleEffects = CAUSAL_MATRIX[categoryA] || [];
        return possibleEffects.includes(categoryB);
    }

    /**
     * Get all possible effects of a category.
     * 
     * @param {string} category - Cause category
     * @returns {string[]} Array of possible effect categories
     */
    function getPossibleEffects(category) {
        return CAUSAL_MATRIX[category] || [];
    }

    /**
     * Get all possible causes of a category.
     * 
     * @param {string} category - Effect category
     * @returns {string[]} Array of possible cause categories
     */
    function getPossibleCauses(category) {
        const causes = [];
        for (const [cause, effects] of Object.entries(CAUSAL_MATRIX)) {
            if (effects.includes(category)) {
                causes.push(cause);
            }
        }
        return causes;
    }

    /**
     * Get the spatial threshold for causal detection.
     * 
     * @param {string} category - Category name
     * @returns {number} Distance threshold in meters
     */
    function getCausalDistanceThreshold(category) {
        return CAUSAL_DISTANCE_OVERRIDE[category] || DEFAULT_CAUSAL_PROXIMITY;
    }

    /**
     * CAUSAL REASONING ENGINE - Main Verification Function
     * =====================================================
     * 
     * Determines if two clusters have a causal relationship.
     * 
     * Three-Part Verification:
     * 1. DIRECTION CHECK: Does the causal matrix allow A → B?
     * 2. TEMPORAL CHECK: Does A's timestamp precede B's?
     * 3. SPATIAL CHECK: Are A and B within propagation distance?
     * 
     * @param {Object} clusterA - Potential CAUSE cluster
     * @param {Object} clusterB - Potential EFFECT cluster
     * @returns {Object} Verification result
     * 
     * @example
     * const flood = { category: "Flooding", timestamp: "2026-01-19T08:00:00", latitude: 7.0, longitude: 125.5 };
     * const traffic = { category: "Traffic", timestamp: "2026-01-19T09:00:00", latitude: 7.001, longitude: 125.501 };
     * 
     * const result = verifyCausality(flood, traffic);
     * // Returns: { isLinked: true, reason: "Causal link verified: Flooding → Traffic", ... }
     */
    function verifyCausality(clusterA, clusterB) {
        const startTime = performance.now();

        const result = {
            isLinked: false,
            reason: null,
            strength: 0,
            checks: {
                direction: false,
                temporal: false,
                spatial: false
            },
            details: {
                categoryA: null,
                categoryB: null,
                timeDiffHours: null,
                distanceMeters: null,
                distanceThreshold: null
            },
            processingTimeMs: 0
        };

        // Validate inputs
        if (!clusterA || !clusterB) {
            result.reason = "Invalid cluster input (null)";
            result.processingTimeMs = performance.now() - startTime;
            return result;
        }

        // Extract categories
        const categoryA = getClusterCategory(clusterA);
        const categoryB = getClusterCategory(clusterB);

        result.details.categoryA = categoryA;
        result.details.categoryB = categoryB;

        // ================================================================
        // CHECK 1: DIRECTION (Causal Matrix Lookup)
        // Does the physics of disaster allow A to cause B?
        // ================================================================
        const possibleEffects = CAUSAL_MATRIX[categoryA] || [];
        const directionValid = possibleEffects.includes(categoryB);
        result.checks.direction = directionValid;

        if (!directionValid) {
            result.reason = `Causal matrix rejects: "${categoryA}" cannot cause "${categoryB}"`;
            console.log(`[CAUSALITY] ❌ Direction FAIL: ${categoryA} ⛔→ ${categoryB}`);
            result.processingTimeMs = performance.now() - startTime;
            return result;
        }

        console.log(`[CAUSALITY] ✅ Direction PASS: ${categoryA} → ${categoryB}`);

        // ================================================================
        // CHECK 2: TEMPORAL (Cause Precedes Effect)
        // Cluster A's timestamp must be BEFORE Cluster B's timestamp
        // ================================================================
        const timestampA = getClusterTimestamp(clusterA);
        const timestampB = getClusterTimestamp(clusterB);

        if (!timestampA || !timestampB) {
            // If timestamps unavailable, allow causality check to pass
            // (assume temporal order is valid if we can't verify)
            result.checks.temporal = true;
            console.log(`[CAUSALITY] ⚠️ Temporal SKIP: Missing timestamps`);
        } else {
            const timeDiffMs = timestampB.getTime() - timestampA.getTime();
            const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
            result.details.timeDiffHours = Math.round(timeDiffHours * 100) / 100;

            // Cause must precede effect (positive time diff)
            // And effect must occur within the causal window
            const temporalValid = timeDiffHours > 0 && timeDiffHours <= CAUSAL_MAX_TIME_HOURS;
            result.checks.temporal = temporalValid;

            if (!temporalValid) {
                if (timeDiffHours <= 0) {
                    result.reason = `Temporal violation: Effect (${categoryB}) precedes Cause (${categoryA})`;
                } else {
                    result.reason = `Temporal violation: ${timeDiffHours.toFixed(1)}h exceeds ${CAUSAL_MAX_TIME_HOURS}h window`;
                }
                console.log(`[CAUSALITY] ❌ Temporal FAIL: ${timeDiffHours.toFixed(1)}h`);
                result.processingTimeMs = performance.now() - startTime;
                return result;
            }

            console.log(`[CAUSALITY] ✅ Temporal PASS: +${timeDiffHours.toFixed(1)}h`);
        }

        // ================================================================
        // CHECK 3: SPATIAL (Within Propagation Distance)
        // Use Haversine distance to verify proximity
        // ================================================================
        const centerA = getClusterCenter(clusterA);
        const centerB = getClusterCenter(clusterB);

        if (!centerA || !centerB) {
            // If coordinates unavailable, skip spatial check
            result.checks.spatial = true;
            console.log(`[CAUSALITY] ⚠️ Spatial SKIP: Missing coordinates`);
        } else {
            // Calculate Haversine distance
            const distance = _haversineDistance(
                centerA.lat, centerA.lng,
                centerB.lat, centerB.lng
            );
            result.details.distanceMeters = Math.round(distance);

            // Get appropriate distance threshold
            const threshold = CAUSAL_DISTANCE_OVERRIDE[categoryA] || DEFAULT_CAUSAL_PROXIMITY;
            result.details.distanceThreshold = threshold;

            const spatialValid = distance <= threshold;
            result.checks.spatial = spatialValid;

            if (!spatialValid) {
                result.reason = `Spatial violation: ${Math.round(distance)}m exceeds ${threshold}m threshold`;
                console.log(`[CAUSALITY] ❌ Spatial FAIL: ${Math.round(distance)}m > ${threshold}m`);
                result.processingTimeMs = performance.now() - startTime;
                return result;
            }

            console.log(`[CAUSALITY] ✅ Spatial PASS: ${Math.round(distance)}m ≤ ${threshold}m`);
        }

        // ================================================================
        // ALL CHECKS PASSED: Causal Link Verified
        // ================================================================
        result.isLinked = true;
        result.reason = `Causal link verified: ${categoryA} → ${categoryB}`;
        result.strength = getCausalStrength(categoryA, categoryB);

        console.log(`[CAUSALITY] 🔗 LINK CONFIRMED: ${categoryA} → ${categoryB} (strength: ${result.strength})`);

        result.processingTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

        return result;
    }

    /**
     * Batch verify causality for multiple cluster pairs.
     * Useful for building causal chain graphs.
     * 
     * @param {Object[]} clusters - Array of cluster objects
     * @returns {Object[]} Array of verified causal links
     */
    function findAllCausalLinks(clusters) {
        const startTime = performance.now();
        const links = [];

        if (!clusters || clusters.length < 2) return links;

        // Compare all pairs (O(n²) but necessary for completeness)
        for (let i = 0; i < clusters.length; i++) {
            for (let j = 0; j < clusters.length; j++) {
                if (i === j) continue;

                const result = verifyCausality(clusters[i], clusters[j]);

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

        const processingTime = Math.round(performance.now() - startTime);
        console.log(`[CAUSALITY] Found ${links.length} causal links among ${clusters.length} clusters in ${processingTime}ms`);

        return links;
    }

    /**
     * Build a causal chain graph from clusters.
     * Returns adjacency list representation.
     * 
     * @param {Object[]} clusters - Array of cluster objects
     * @returns {Object} Graph with adjacency list and metadata
     */
    function buildCausalGraph(clusters) {
        const graph = {
            nodes: [],
            edges: new Map(),
            metadata: {
                totalNodes: 0,
                totalEdges: 0,
                processingTimeMs: 0
            }
        };

        if (!clusters || clusters.length === 0) return graph;

        const startTime = performance.now();

        // Initialize nodes
        clusters.forEach((cluster, idx) => {
            graph.nodes.push({
                index: idx,
                category: getClusterCategory(cluster),
                cluster: cluster
            });
            graph.edges.set(idx, []);
        });

        graph.metadata.totalNodes = clusters.length;

        // Find all links and add edges
        const links = findAllCausalLinks(clusters);

        links.forEach(link => {
            graph.edges.get(link.causeIndex).push({
                target: link.effectIndex,
                strength: link.verification.strength,
                details: link.verification.details
            });
        });

        graph.metadata.totalEdges = links.length;
        graph.metadata.processingTimeMs = Math.round(performance.now() - startTime);

        return graph;
    }

    /**
     * Find the root causes in a causal graph (nodes with no incoming edges).
     * 
     * @param {Object} graph - Causal graph from buildCausalGraph
     * @returns {number[]} Array of root node indices
     */
    function findRootCauses(graph) {
        const hasIncoming = new Set();

        for (const [_, edges] of graph.edges) {
            edges.forEach(edge => hasIncoming.add(edge.target));
        }

        return graph.nodes
            .filter(node => !hasIncoming.has(node.index))
            .map(node => node.index);
    }

    /**
     * Find the terminal effects in a causal graph (nodes with no outgoing edges).
     * 
     * @param {Object} graph - Causal graph from buildCausalGraph
     * @returns {number[]} Array of terminal node indices
     */
    function findTerminalEffects(graph) {
        return graph.nodes
            .filter(node => graph.edges.get(node.index).length === 0)
            .map(node => node.index);
    }

    /**
     * Trace the causal chain from a root cause to all its effects.
     * Uses BFS to find all reachable effects.
     * 
     * @param {Object} graph - Causal graph
     * @param {number} rootIndex - Starting node index
     * @returns {Object[]} Array of chain steps
     */
    function traceCausalChain(graph, rootIndex) {
        const chain = [];
        const visited = new Set();
        const queue = [{ index: rootIndex, depth: 0, path: [rootIndex] }];

        while (queue.length > 0) {
            const { index, depth, path } = queue.shift();

            if (visited.has(index)) continue;
            visited.add(index);

            const node = graph.nodes[index];
            chain.push({
                index,
                category: node.category,
                depth,
                path: [...path]
            });

            const edges = graph.edges.get(index) || [];
            edges.forEach(edge => {
                if (!visited.has(edge.target)) {
                    queue.push({
                        index: edge.target,
                        depth: depth + 1,
                        path: [...path, edge.target]
                    });
                }
            });
        }

        return chain;
    }

    /**
     * Get a human-readable causal chain description.
     * 
     * @param {Object[]} clusters - Array of clusters in causal order
     * @returns {string} Human-readable chain description
     */
    function describeCausalChain(clusters) {
        if (!clusters || clusters.length === 0) return "No causal chain";
        if (clusters.length === 1) return getClusterCategory(clusters[0]);

        return clusters
            .map(c => getClusterCategory(c))
            .join(' → ');
    }

    // ==================== MODULE EXPORT ====================

    /**
     * Causality Manager Module
     * @namespace CausalityManager
     */
    const CausalityManager = {
        // Main verification function
        verifyCausality,

        // Batch operations
        findAllCausalLinks,
        buildCausalGraph,

        // Graph analysis
        findRootCauses,
        findTerminalEffects,
        traceCausalChain,
        describeCausalChain,

        // Utility functions
        canCause,
        getPossibleEffects,
        getPossibleCauses,
        getCausalStrength,
        getCausalDistanceThreshold,

        // Cluster helpers
        getClusterTimestamp,
        getClusterCenter,
        getClusterCategory,

        // Configuration (read-only exposure)
        config: Object.freeze({
            CAUSAL_MATRIX: Object.freeze({ ...CAUSAL_MATRIX }),
            CAUSAL_DISTANCE_OVERRIDE: Object.freeze({ ...CAUSAL_DISTANCE_OVERRIDE }),
            CAUSAL_STRENGTH: Object.freeze({ ...CAUSAL_STRENGTH }),
            CAUSAL_MAX_TIME_HOURS,
            CAUSAL_MAX_DISTANCE_METERS,
            DEFAULT_CAUSAL_PROXIMITY
        }),

        // Version info
        version: '1.0.0',
        name: 'CausalityManager'
    };

    // Export for different module systems
    if (typeof module !== 'undefined' && module.exports) {
        // Node.js / CommonJS
        module.exports = CausalityManager;
    }

    if (typeof define === 'function' && define.amd) {
        // AMD / RequireJS
        define([], function () { return CausalityManager; });
    }

    // Browser global
    global.CausalityManager = CausalityManager;

    // Also expose individual functions for backward compatibility
    global.verifyCausality = verifyCausality;
    global.findAllCausalLinks = findAllCausalLinks;
    global.buildCausalGraph = buildCausalGraph;
    global.getClusterTimestamp = getClusterTimestamp;
    global.getClusterCenter = getClusterCenter;
    global.getClusterCategory = getClusterCategory;
    global.CAUSAL_MATRIX = CAUSAL_MATRIX;
    global.CAUSAL_MAX_TIME_HOURS = CAUSAL_MAX_TIME_HOURS;
    global.CAUSAL_MAX_DISTANCE_METERS = CAUSAL_MAX_DISTANCE_METERS;
    global.CAUSAL_DISTANCE_OVERRIDE = CAUSAL_DISTANCE_OVERRIDE;

    console.log('[CAUSALITY-MANAGER] ✅ Module loaded (v1.0.0)');

})(typeof window !== 'undefined' ? window : global);
