const Database = require("../config/database");

/**
 * SimilarityCalculatorService
 * Advanced similarity calculations and pattern detection
 */
class SimilarityCalculatorService {
  constructor() {
    this.db = new Database();
    this.supabase = this.db.getClient();
  }
  /**
   * Find all similar complaints within a radius
   * @param {number} latitude
   * @param {number} longitude
   * @param {number} radiusKm
   * @param {object} filters - Additional filters (type, dateRange, etc.)
   */
  async findSimilarInRadius(latitude, longitude, radiusKm = 0.5, filters = {}) {
    try {
      let query = this.supabase
        .from("complaints")
        .select("*")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      // Apply filters
      if (filters.type) {
        query = query.eq("type", filters.type);
      }
      if (filters.status) {
        query = query.eq("workflow_status", filters.status);
      }
      if (filters.dateFrom) {
        query = query.gte("submitted_at", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("submitted_at", filters.dateTo);
      }
      const { data: complaints, error } = await query.limit(200);
      if (error) {
        // Check if error message contains HTML (indicates server/infrastructure error)
        const errorMessage = error.message || "";
        const isHtmlError =
          errorMessage.trim().startsWith("<!DOCTYPE html>") ||
          errorMessage.includes("<html") ||
          errorMessage.includes("Cloudflare") ||
          errorMessage.includes("Internal server error");

        // Check if it's a network error
        const isNetworkError =
          errorMessage.includes("fetch failed") || error instanceof TypeError;

        if (isHtmlError) {
          const errorCodeMatch = errorMessage.match(/Error code (\d+)/);
          const errorCode = errorCodeMatch ? errorCodeMatch[1] : "500";
          console.error(
            "[SIMILARITY] Infrastructure error in radius search (Supabase/Cloudflare server error):",
            {
              errorCode,
              type: "HTML_ERROR_RESPONSE",
              operation: "findSimilarInRadius",
            }
          );
          throw new Error(
            `Database infrastructure error: Supabase/Cloudflare server returned error ${errorCode}. Please try again later.`
          );
        } else if (isNetworkError) {
          console.warn(
            "[SIMILARITY] Network error in radius search (database may be unreachable):",
            {
              message: errorMessage,
              operation: "findSimilarInRadius",
            }
          );
          throw new Error(
            `Database network error: Unable to connect to database. Please check your network connection.`
          );
        } else {
          console.error("[SIMILARITY] Radius search error:", {
            message: errorMessage,
            code: error.code,
            operation: "findSimilarInRadius",
          });
          throw error;
        }
      }
      // Filter by distance
      const nearby = complaints
        .filter((complaint) => {
          const distance = this.calculateDistance(
            latitude,
            longitude,
            complaint.latitude,
            complaint.longitude
          );
          return distance <= radiusKm;
        })
        .map((complaint) => ({
          ...complaint,
          distance: this.calculateDistance(
            latitude,
            longitude,
            complaint.latitude,
            complaint.longitude
          ),
        }));
      return nearby.sort((a, b) => a.distance - b.distance);
    } catch (error) {
      console.error("[SIMILARITY] Radius search error:", error);
      throw error;
    }
  }
  /**
   * Detect geographic clusters of complaints
   * Uses DBSCAN-like algorithm
   */
  async detectClusters(options = {}) {
    const {
      radiusKm = 0.1,
      minComplaintsPerCluster = 5,
      type = null,
      dateFrom = null,
      dateTo = null,
    } = options;
    try {
      // Validate inputs
      if (radiusKm <= 0) {
        throw new Error("Radius must be greater than 0");
      }
      if (minComplaintsPerCluster < 2) {
        throw new Error("Minimum complaints per cluster must be at least 2");
      }

      // Validate date range if both dates provided
      if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
        throw new Error("Start date cannot be after end date");
      }

      let query = this.supabase
        .from("complaints")
        .select("*")
        .not("latitude", "is", null)
        .not("longitude", "is", null);
      if (type) query = query.eq("type", type);
      if (dateFrom) query = query.gte("submitted_at", dateFrom);
      if (dateTo) query = query.lte("submitted_at", dateTo);

      const { data: complaints, error } = await query;
      if (error) {
        // Check if error message contains HTML (indicates server/infrastructure error)
        const errorMessage = error.message || "";
        const isHtmlError =
          errorMessage.trim().startsWith("<!DOCTYPE html>") ||
          errorMessage.includes("<html") ||
          errorMessage.includes("Cloudflare") ||
          errorMessage.includes("Internal server error");

        // Check if it's a network error
        const isNetworkError =
          errorMessage.includes("fetch failed") || error instanceof TypeError;

        if (isHtmlError) {
          // Extract error code from HTML if possible
          const errorCodeMatch = errorMessage.match(/Error code (\d+)/);
          const errorCode = errorCodeMatch ? errorCodeMatch[1] : "500";
          console.error(
            "[SIMILARITY] Infrastructure error in database query (Supabase/Cloudflare server error):",
            {
              errorCode,
              type: "HTML_ERROR_RESPONSE",
              message:
                "Received HTML error page instead of JSON response. This indicates a server/infrastructure issue.",
              operation: "detectClusters",
            }
          );
          throw new Error(
            `Database infrastructure error: Supabase/Cloudflare server returned error ${errorCode}. Please try again later.`
          );
        } else if (isNetworkError) {
          console.warn(
            "[SIMILARITY] Network error in database query (database may be unreachable):",
            {
              message: errorMessage,
              code: error.code,
              operation: "detectClusters",
            }
          );
          throw new Error(
            `Database network error: Unable to connect to database. Please check your network connection and Supabase configuration.`
          );
        } else {
          // Standard Supabase error
          console.error("[SIMILARITY] Database query error:", {
            message: errorMessage,
            code: error.code,
            details: error.details || "",
            hint: error.hint || "",
            operation: "detectClusters",
          });
          throw new Error(`Database query failed: ${errorMessage}`);
        }
      }

      if (!complaints || complaints.length === 0) {
        console.log("[SIMILARITY] No complaints found for clustering");
        // Deactivate existing clusters if no complaints
        await this.saveClusters([]);
        return [];
      }

      if (complaints.length < minComplaintsPerCluster) {
        console.log(
          `[SIMILARITY] Not enough complaints (${complaints.length}) for clustering (min: ${minComplaintsPerCluster})`
        );
        await this.saveClusters([]);
        return [];
      }

      const clusters = this.clusterComplaints(
        complaints,
        radiusKm,
        minComplaintsPerCluster
      );

      // Save clusters to database
      await this.saveClusters(clusters);
      return clusters;
    } catch (error) {
      // Handle network errors gracefully
      const errorMessage = error.message || "";
      const isHtmlError =
        errorMessage.trim().startsWith("<!DOCTYPE html>") ||
        errorMessage.includes("<html") ||
        errorMessage.includes("Cloudflare") ||
        errorMessage.includes("Internal server error");
      const isNetworkError =
        errorMessage.includes("fetch failed") || error instanceof TypeError;

      if (isHtmlError || isNetworkError) {
        // Already logged in the query error handler above
        console.error(
          "[SIMILARITY] Cluster detection failed due to infrastructure/network error"
        );
      } else {
        console.error("[SIMILARITY] Cluster detection error:", {
          message: errorMessage,
          stack: error.stack,
        });
      }
      throw error;
    }
  }
  /**
   * DBSCAN-like clustering algorithm
   */
  clusterComplaints(complaints, radiusKm, minPoints) {
    const clusters = [];
    const visited = new Set();
    const clustered = new Set();
    complaints.forEach((complaint, index) => {
      if (visited.has(complaint.id)) return;
      visited.add(complaint.id);
      // Find neighbors
      const neighbors = this.findNeighbors(complaint, complaints, radiusKm);
      if (neighbors.length < minPoints) {
        return; // Noise point
      }
      // Create new cluster
      const cluster = {
        complaints: [complaint],
        center: {
          lat: complaint.latitude,
          lng: complaint.longitude,
        },
        radius: radiusKm,
      };
      clustered.add(complaint.id);
      // Expand cluster
      let i = 0;
      while (i < neighbors.length) {
        const neighbor = neighbors[i];
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          const neighborNeighbors = this.findNeighbors(
            neighbor,
            complaints,
            radiusKm
          );
          if (neighborNeighbors.length >= minPoints) {
            neighbors.push(...neighborNeighbors);
          }
        }
        if (!clustered.has(neighbor.id)) {
          cluster.complaints.push(neighbor);
          clustered.add(neighbor.id);
        }
        i++;
      }
      // Calculate cluster center
      cluster.center = this.calculateClusterCenter(cluster.complaints);
      cluster.actualRadius = this.calculateClusterRadius(
        cluster.center,
        cluster.complaints
      );
      clusters.push(cluster);
    });
    return clusters
      .map((cluster, index) => {
        // Safety check: ensure cluster has complaints
        if (!cluster.complaints || cluster.complaints.length === 0) {
          console.warn("[SIMILARITY] Skipping empty cluster");
          return null;
        }

        // Get type from first complaint, default to 'unknown' if not available
        const clusterType = cluster.complaints[0]?.type || "unknown";

        return {
          cluster_name: `Cluster ${index + 1} - ${clusterType}`,
          center_lat: cluster.center.lat,
          center_lng: cluster.center.lng,
          radius_meters: cluster.actualRadius * 1000, // Convert to meters
          complaint_ids: cluster.complaints.map((c) => c.id),
          pattern_type: this.detectPatternType(cluster.complaints),
          status: "active",
        };
      })
      .filter((cluster) => cluster !== null); // Remove null entries
  }
  /**
   * Find neighboring complaints within radius
   */
  findNeighbors(complaint, allComplaints, radiusKm) {
    return allComplaints.filter((other) => {
      if (other.id === complaint.id) return false;
      const distance = this.calculateDistance(
        complaint.latitude,
        complaint.longitude,
        other.latitude,
        other.longitude
      );
      return distance <= radiusKm;
    });
  }
  /**
   * Calculate geometric center of cluster
   */
  calculateClusterCenter(complaints) {
    const sum = complaints.reduce(
      (acc, c) => ({
        lat: acc.lat + c.latitude,
        lng: acc.lng + c.longitude,
      }),
      { lat: 0, lng: 0 }
    );
    return {
      lat: sum.lat / complaints.length,
      lng: sum.lng / complaints.length,
    };
  }
  /**
   * Calculate maximum radius of cluster
   */
  calculateClusterRadius(center, complaints) {
    return Math.max(
      ...complaints.map((c) =>
        this.calculateDistance(center.lat, center.lng, c.latitude, c.longitude)
      )
    );
  }
  /**
   * Detect pattern type based on temporal distribution
   */
  detectPatternType(complaints) {
    if (complaints.length < 3) return "normal";
    // Sort by date
    const sorted = [...complaints].sort(
      (a, b) => new Date(a.submitted_at) - new Date(b.submitted_at)
    );
    // Calculate time differences
    const timeDiffs = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff =
        (new Date(sorted[i].submitted_at) -
          new Date(sorted[i - 1].submitted_at)) /
        (1000 * 60 * 60 * 24); // Days
      timeDiffs.push(diff);
    }
    const avgDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
    // Outbreak: Many complaints in short time
    if (avgDiff < 2 && complaints.length >= 5) {
      return "outbreak";
    }
    // Recurring: Regular intervals
    const variance =
      timeDiffs.reduce((acc, diff) => acc + Math.pow(diff - avgDiff, 2), 0) /
      timeDiffs.length;
    if (variance < 10 && avgDiff < 14) {
      return "recurring";
    }
    return "normal";
  }
  /**
   * Save clusters to database
   */
  async saveClusters(clusters) {
    if (!clusters || clusters.length === 0) {
      console.log("[SIMILARITY] No clusters to save");
      return { success: true, saved: 0 };
    }

    try {
      // First, deactivate existing clusters
      const { error: deactivateError } = await this.supabase
        .from("complaint_clusters")
        .update({ status: "inactive" })
        .eq("status", "active");

      if (deactivateError) {
        const deactivateMsg = deactivateError.message || "";
        const isNetworkError =
          deactivateMsg.includes("fetch failed") ||
          deactivateError instanceof TypeError;
        if (isNetworkError) {
          console.warn(
            "[SIMILARITY] Network error deactivating old clusters (database may be unreachable):",
            deactivateMsg
          );
        } else {
          console.warn(
            "[SIMILARITY] Failed to deactivate old clusters:",
            deactivateMsg
          );
        }
        // Continue anyway - might be first run
      }

      // Insert new clusters
      const { data, error } = await this.supabase
        .from("complaint_clusters")
        .insert(clusters)
        .select();

      if (error) {
        const errorMessage = error.message || "";
        const isHtmlError =
          errorMessage.trim().startsWith("<!DOCTYPE html>") ||
          errorMessage.includes("<html") ||
          errorMessage.includes("Cloudflare");
        const isNetworkError =
          errorMessage.includes("fetch failed") || error instanceof TypeError;

        if (isHtmlError) {
          const errorCodeMatch = errorMessage.match(/Error code (\d+)/);
          const errorCode = errorCodeMatch ? errorCodeMatch[1] : "500";
          console.error(
            "[SIMILARITY] Infrastructure error saving clusters (Supabase/Cloudflare server error):",
            {
              errorCode,
              type: "HTML_ERROR_RESPONSE",
              operation: "saveClusters",
            }
          );
          throw new Error(
            `Database infrastructure error: Failed to save clusters. Supabase/Cloudflare server returned error ${errorCode}.`
          );
        } else if (isNetworkError) {
          console.error(
            "[SIMILARITY] Network error saving clusters (database may be unreachable):",
            {
              message: errorMessage,
              operation: "saveClusters",
            }
          );
          throw new Error(
            `Database network error: Failed to save clusters. Unable to connect to database.`
          );
        } else {
          console.error("[SIMILARITY] Save clusters error:", {
            message: errorMessage,
            code: error.code,
            operation: "saveClusters",
          });
          throw new Error(`Failed to save clusters: ${errorMessage}`);
        }
      }

      console.log(
        `[SIMILARITY] Successfully saved ${clusters.length} cluster(s) to database`
      );
      if (data && data.length > 0) {
        const totalComplaints = clusters.reduce(
          (sum, cluster) => sum + (cluster.complaint_ids?.length || 0),
          0
        );
        console.log(
          `[SIMILARITY] Total complaints in clusters: ${totalComplaints}`
        );
      }
      return { success: true, saved: clusters.length, data };
    } catch (error) {
      console.error("[SIMILARITY] Save clusters exception:", error);
      throw error;
    }
  }
  /**
   * Get nearest similar complaints
   */
  async getNearestSimilar(complaintId, limit = 10) {
    try {
      const complaint = await this.getComplaint(complaintId);
      if (!complaint) throw new Error("Complaint not found");
      // Get pre-calculated similarities
      const { data: similarities, error } = await this.supabase
        .from("complaint_similarities")
        .select(
          `
          *,
          similar_complaint:similar_complaint_id (*)
        `
        )
        .eq("complaint_id", complaintId)
        .order("similarity_score", { ascending: false })
        .limit(limit);
      if (error) {
        const errorMessage = error.message || "";
        const isHtmlError =
          errorMessage.trim().startsWith("<!DOCTYPE html>") ||
          errorMessage.includes("<html") ||
          errorMessage.includes("Cloudflare");
        const isNetworkError =
          errorMessage.includes("fetch failed") || error instanceof TypeError;

        if (isHtmlError || isNetworkError) {
          console.warn(
            "[SIMILARITY] Network/infrastructure error getting nearest similar:",
            {
              message: errorMessage,
              operation: "getNearestSimilar",
            }
          );
          throw new Error(
            `Database connection error: Unable to retrieve similar complaints. Please try again later.`
          );
        }
        throw error;
      }
      return similarities || [];
    } catch (error) {
      const errorMessage = error.message || "";
      if (
        !errorMessage.includes("Database connection error") &&
        !errorMessage.includes("Database infrastructure error")
      ) {
        console.error("[SIMILARITY] Get nearest error:", {
          message: errorMessage,
          stack: error.stack,
        });
      }
      throw error;
    }
  }
  /**
   * Calculate distance between two points
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get complaint by ID
   */
  async getComplaint(complaintId) {
    const { data, error } = await this.supabase
      .from("complaints")
      .select("*")
      .eq("id", complaintId)
      .single();
    if (error) {
      const errorMessage = error.message || "";
      const isHtmlError =
        errorMessage.trim().startsWith("<!DOCTYPE html>") ||
        errorMessage.includes("<html") ||
        errorMessage.includes("Cloudflare");
      const isNetworkError =
        errorMessage.includes("fetch failed") || error instanceof TypeError;

      if (isHtmlError || isNetworkError) {
        console.warn(
          "[SIMILARITY] Network/infrastructure error getting complaint:",
          {
            message: errorMessage,
            complaintId,
            operation: "getComplaint",
          }
        );
        throw new Error(
          `Database connection error: Unable to retrieve complaint. Please try again later.`
        );
      }
      throw error;
    }
    return data;
  }
}

module.exports = SimilarityCalculatorService;
