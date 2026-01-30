/**
 * DBSCAN (Density-Based Spatial Clustering of Applications with Noise) Algorithm
 * Implementation for complaint location clustering
 * 
 * OPTIMIZED: Now uses Grid-Based Spatial Indexing for O(n) neighbor lookup
 * instead of O(n²) brute force approach.
 */

/**
 * SpatialGrid - Grid-based spatial index for efficient neighbor queries
 * Reduces neighbor search from O(n) to O(k) where k = points in adjacent cells
 */
class SpatialGrid {
  /**
   * @param {number} cellSize - Size of each grid cell (in same units as coordinates)
   */
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.grid = new Map();
    this.points = null;
  }

  /**
   * Generate a cell key for a given point
   * @param {Object} point - {lat, lng}
   * @returns {string} Cell key in format "x_y"
   */
  getCellKey(point) {
    const cellX = Math.floor(point.lat / this.cellSize);
    const cellY = Math.floor(point.lng / this.cellSize);
    return `${cellX}_${cellY}`;
  }

  /**
   * Build the spatial grid from an array of points - O(n)
   * @param {Array} points - Array of points with lat, lng properties
   */
  build(points) {
    this.grid.clear();
    this.points = points;

    for (let i = 0; i < points.length; i++) {
      const key = this.getCellKey(points[i]);
      if (!this.grid.has(key)) {
        this.grid.set(key, []);
      }
      this.grid.get(key).push(i);
    }
  }

  /**
   * Get all point indices in a cell and its 8 neighbors
   * @param {Object} point - {lat, lng}
   * @returns {Array} Array of point indices in adjacent cells
   */
  getNearbyCandidates(point) {
    const cellX = Math.floor(point.lat / this.cellSize);
    const cellY = Math.floor(point.lng / this.cellSize);
    const candidates = [];

    // Check the cell and all 8 adjacent cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cellX + dx}_${cellY + dy}`;
        const cellPoints = this.grid.get(key);
        if (cellPoints) {
          candidates.push(...cellPoints);
        }
      }
    }

    return candidates;
  }

  /**
   * Clear the grid
   */
  clear() {
    this.grid.clear();
    this.points = null;
  }
}

class DBSCAN {

  constructor(eps = 0.01, minPts = 3) {
    this.eps = eps; // Maximum distance between two samples (in km)
    this.minPts = minPts; // Minimum samples for core point
    this.spatialGrid = null; // Lazy-initialized spatial index
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param {Object} point1 - {lat, lng}
   * @param {Object} point2 - {lat, lng}
   * @returns {number} Distance in kilometers
   */
  calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);

    const a = (Math.sin(dLat / 2) * Math.sin(dLat / 2)) +
              (Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
               Math.sin(dLng / 2) * Math.sin(dLng / 2));

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Build spatial grid for efficient neighbor lookups
   * Cell size is set to eps converted to approximate degrees
   * @param {Array} points - Array of points with lat, lng properties
   */
  buildSpatialIndex(points) {
    // Convert eps (km) to approximate degrees for grid cell size
    // 1 degree ≈ 111 km at equator, using slightly larger cells to ensure coverage
    const cellSizeDegrees = (this.eps / 111) * 1.1; // 10% buffer for safety
    this.spatialGrid = new SpatialGrid(cellSizeDegrees);
    this.spatialGrid.build(points);
  }

  /**
   * Find all points within eps distance of a given point
   * OPTIMIZED: Uses spatial grid to check only nearby cells - O(k) instead of O(n)
   * @param {Array} points - Array of points
   * @param {number} pointIndex - Index of the point to find neighbors for
   * @returns {Array} Array of neighbor indices
   */
  findNeighbors(points, pointIndex) {
    const neighbors = [];
    const point = points[pointIndex];

    // Use spatial grid if available (optimized path)
    if (this.spatialGrid) {
      const candidates = this.spatialGrid.getNearbyCandidates(point);
      
      for (const i of candidates) {
        if (i !== pointIndex) {
          const distance = this.calculateDistance(point, points[i]);
          if (distance <= this.eps) {
            neighbors.push(i);
          }
        }
      }
    } else {
      // Fallback to brute force if grid not built
      for (let i = 0; i < points.length; i++) {
        if (i !== pointIndex) {
          const distance = this.calculateDistance(point, points[i]);
          if (distance <= this.eps) {
            neighbors.push(i);
          }
        }
      }
    }

    return neighbors;
  }

  /**
   * Perform DBSCAN clustering
   * OPTIMIZED: Builds spatial index before clustering for O(n) neighbor lookups
   * @param {Array} points - Array of points with lat, lng properties
   * @returns {Object} Clustering result with clusters and noise points
   */
  cluster(points) {
    // Build spatial index for O(n) neighbor lookups
    if (points && points.length > 0) {
      this.buildSpatialIndex(points);
    }
    if (!points || points.length === 0) {
      return { clusters: [], noise: [] };
    }

    const visited = new Array(points.length).fill(false);
    const clustered = new Array(points.length).fill(false);
    const clusters = [];
    const noise = [];

    for (let i = 0; i < points.length; i++) {
      if (visited[i]) continue;

      visited[i] = true;
      const neighbors = this.findNeighbors(points, i);

      if (neighbors.length < this.minPts) {
        // Point is noise
        noise.push(i);
      } else {
        // Point is a core point, start a new cluster
        const cluster = [i];
        clustered[i] = true;

        // Expand cluster
        let j = 0;
        while (j < neighbors.length) {
          const neighborIndex = neighbors[j];

          if (!visited[neighborIndex]) {
            visited[neighborIndex] = true;
            const neighborNeighbors = this.findNeighbors(points, neighborIndex);

            if (neighborNeighbors.length >= this.minPts) {
              // Add new neighbors to the list
              neighbors.push(...neighborNeighbors);
            }
          }

          if (!clustered[neighborIndex]) {
            cluster.push(neighborIndex);
            clustered[neighborIndex] = true;
          }

          j++;
        }

        clusters.push(cluster);
      }
    }

    return { clusters, noise };
  }

  /**
   * Calculate cluster statistics
   * @param {Array} points - Original points array
   * @param {Object} clusteringResult - Result from cluster() method
   * @returns {Object} Statistics about the clustering
   */
  calculateStatistics(points, clusteringResult) {
    const { clusters, noise } = clusteringResult;

    const stats = {
      totalPoints: points.length,
      numClusters: clusters.length,
      numNoise: noise.length,
      clusterDetails: []
    };

    clusters.forEach((cluster, index) => {
      const clusterPoints = cluster.map(i => points[i]);

      // Calculate cluster center (centroid)
      const centerLat = clusterPoints.reduce((sum, p) => sum + p.lat, 0) / clusterPoints.length;
      const centerLng = clusterPoints.reduce((sum, p) => sum + p.lng, 0) / clusterPoints.length;

      // Calculate cluster radius (maximum distance from center)
      let maxRadius = 0;
      clusterPoints.forEach(point => {
        const distance = this.calculateDistance(
          { lat: centerLat, lng: centerLng },
          point
        );
        maxRadius = Math.max(maxRadius, distance);
      });

      // Calculate density (points per square km)
      const area = Math.PI * maxRadius * maxRadius;
      const density = clusterPoints.length / Math.max(area, 0.01); // Avoid division by zero

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

  /**
   * Suggest optimal parameters based on data
   * @param {Array} points - Array of points
   * @returns {Object} Suggested eps and minPts values
   */
  suggestParameters(points) {
    if (!points || points.length < 2) {
      return { eps: 0.01, minPts: 3 };
    }

    // Calculate k-distance for k = 4 (common choice)
    const k = Math.min(4, points.length - 1);
    const distances = [];

    for (let i = 0; i < points.length; i++) {
      const pointDistances = [];
      for (let j = 0; j < points.length; j++) {
        if (i !== j) {
          pointDistances.push(this.calculateDistance(points[i], points[j]));
        }
      }
      pointDistances.sort((a, b) => a - b);
      if (pointDistances[k - 1]) {
        distances.push(pointDistances[k - 1]);
      }
    }

    distances.sort((a, b) => a - b);

    // Use 75th percentile as suggested eps
    const epsIndex = Math.floor(distances.length * 0.75);
    const suggestedEps = distances[epsIndex] || 0.01;

    // Suggested minPts based on data size
    const suggestedMinPts = Math.max(3, Math.min(10, Math.floor(points.length / 10)));

    return {
      eps: Math.round(suggestedEps * 1000) / 1000, // Round to 3 decimal places
      minPts: suggestedMinPts
    };
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {

  module.exports = DBSCAN;
} else {
  window.DBSCAN = DBSCAN;
}
