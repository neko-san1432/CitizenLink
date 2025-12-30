/**
 * DBSCAN (Density-Based Spatial Clustering of Applications with Noise) Algorithm
 * Implementation for complaint location clustering
 */
class DBSCAN {

  constructor(eps = 0.01, minPts = 3) {
    this.eps = eps; // Maximum distance between two samples for one to be considered in the neighborhood of the other
    this.minPts = minPts; // Minimum number of samples in a neighborhood for a point to be considered a core point
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
   * Find all points within eps distance of a given point
   * @param {Array} points - Array of points
   * @param {number} pointIndex - Index of the point to find neighbors for
   * @returns {Array} Array of neighbor indices
   */
  findNeighbors(points, pointIndex) {
    const neighbors = [];
    const point = points[pointIndex];

    for (let i = 0; i < points.length; i++) {
      if (i !== pointIndex) {
        const distance = this.calculateDistance(point, points[i]);
        if (distance <= this.eps) {
          neighbors.push(i);
        }
      }
    }

    return neighbors;
  }

  /**
   * Perform DBSCAN clustering
   * @param {Array} points - Array of points with lat, lng properties
   * @returns {Object} Clustering result with clusters and noise points
   */
  cluster(points) {
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
if (typeof module !== 'undefined' && module.exports) {

  module.exports = DBSCAN;
} else {
  window.DBSCAN = DBSCAN;
}
