/**
 * Insights Service
 * Provides barangay prioritization insights based on complaint volume and clusters
 */
const Database = require("../config/database");
const { classifyComplaints } = require("../utils/barangayClassifier");
const SimilarityCalculatorService = require("./SimilarityCalculatorService");

class InsightsService {
  constructor() {
    this.supabase = Database.getClient();
    this.similarityService = new SimilarityCalculatorService();
  }

  /**
   * Get barangay prioritization data for a given time period
   * @param {string} period - 'daily', 'weekly', 'monthly', 'yearly'
   * @returns {Promise<Array>} Array of barangay prioritization data
   */
  async getBarangayPrioritization(period = "weekly") {
    try {
      // Calculate date range based on period
      const { startDate, endDate } = this.getDateRange(period);

      // Get all complaints within the time period
      const { data: complaints, error: complaintsError } = await this.supabase
        .from("complaints")
        .select(
          `
          id,
          submitted_by,
          submitted_at,
          latitude,
          longitude,
          location_text,
          priority,
          workflow_status
        `
        )
        .gte("submitted_at", startDate.toISOString())
        .lte("submitted_at", endDate.toISOString())
        .neq("workflow_status", "cancelled");

      if (complaintsError) {
        throw complaintsError;
      }

      // Classify complaints by barangay based on coordinates
      const complaintBarangayMap = classifyComplaints(complaints);

      console.log(
        `[INSIGHTS] Classified ${complaintBarangayMap.size} out of ${complaints.length} complaints into barangays`
      );

      // Calculate clusters on-demand for the current period instead of using stale database clusters
      // This ensures prioritization is based on current data, not outdated snapshots
      let clusters = [];
      if (complaints.length >= 3) {
        try {
          // Use DBSCAN clustering with reasonable parameters for prioritization
          const clusterResults = this.similarityService.clusterComplaints(
            complaints,
            0.1, // 0.1 radius (requested)
            5 // minimum 5 complaints per cluster
          );

          // clusterComplaints returns array with complaint_ids property
          clusters = clusterResults
            .map((cluster) => ({
              complaint_ids: cluster.complaint_ids || [],
            }))
            .filter(
              (cluster) =>
                cluster.complaint_ids && cluster.complaint_ids.length > 0
            );

          console.log(
            `[INSIGHTS] Calculated ${clusters.length} clusters on-demand for period ${period}`
          );
        } catch (error) {
          console.warn(
            "[INSIGHTS] Error calculating clusters on-demand:",
            error.message
          );
          // Continue without clusters if calculation fails
          clusters = [];
        }
      }

      // Group complaints by barangay
      const barangayData = new Map();
      const allBarangays = [
        "Aplaya",
        "Balabag",
        "Binaton",
        "Cogon",
        "Colorado",
        "Dawis",
        "Dulangan",
        "Goma",
        "Igpit",
        "Kiagot",
        "Lungag",
        "Mahayahay",
        "Matti",
        "Kapatagan (Rizal)",
        "Ruparan",
        "San Agustin",
        "San Jose (Balutakay)",
        "San Miguel (Odaca)",
        "San Roque",
        "Sinawilan",
        "Soong",
        "Tiguman",
        "Tres de Mayo",
        "Zone 1 (Pob.)",
        "Zone 2 (Pob.)",
        "Zone 3 (Pob.)",
      ];

      // Initialize all barangays
      allBarangays.forEach((barangay) => {
        barangayData.set(barangay, {
          barangay,
          complaintCount: 0,
          clusterCount: 0,
          urgentCount: 0,
          highPriorityCount: 0,
          complaintIds: [],
        });
      });

      // Count complaints per barangay based on coordinate classification
      complaints.forEach((complaint) => {
        const barangay = complaintBarangayMap.get(complaint.id);
        if (barangay && barangayData.has(barangay)) {
          const data = barangayData.get(barangay);
          data.complaintCount++;
          data.complaintIds.push(complaint.id);
          if (complaint.priority === "urgent") {
            data.urgentCount++;
          }
          if (complaint.priority === "high") {
            data.highPriorityCount++;
          }
        } else if (!barangay) {
          // Log unclassified complaints for debugging
          console.warn(
            `[INSIGHTS] Complaint ${complaint.id} could not be classified into a barangay. Coords: (${complaint.latitude}, ${complaint.longitude})`
          );
        }
      });

      // Count clusters per barangay
      // A cluster belongs to a barangay if any complaint in the cluster belongs to that barangay
      // AND the cluster contains at least one complaint from the current period
      if (clusters && clusters.length > 0) {
        const periodComplaintIds = new Set(complaints.map((c) => c.id));

        clusters.forEach((cluster) => {
          if (!cluster.complaint_ids || cluster.complaint_ids.length === 0)
            return;

          // Check if this cluster contains any complaints from the current period
          const hasPeriodComplaints = cluster.complaint_ids.some((id) =>
            periodComplaintIds.has(id)
          );
          if (!hasPeriodComplaints) {
            // Skip clusters that don't contain any complaints from the current period
            return;
          }

          const clusterBarangays = new Set();
          cluster.complaint_ids.forEach((complaintId) => {
            // Only count complaints from the current period
            if (!periodComplaintIds.has(complaintId)) return;

            // Find which barangay this complaint belongs to
            for (const [barangay, data] of barangayData.entries()) {
              if (data.complaintIds.includes(complaintId)) {
                clusterBarangays.add(barangay);
              }
            }
          });

          // Add cluster count to each barangay that has complaints in this cluster
          // Only count the cluster once per barangay, even if it has multiple complaints
          clusterBarangays.forEach((barangay) => {
            const data = barangayData.get(barangay);
            if (data) {
              data.clusterCount++;
            }
          });
        });
      }

      // Calculate statistics for frequency thresholds
      const allComplaintCounts = Array.from(barangayData.values()).map(
        (d) => d.complaintCount
      );
      const avgComplaints =
        allComplaintCounts.length > 0
          ? allComplaintCounts.reduce((a, b) => a + b, 0) /
            allComplaintCounts.length
          : 0;

      // Calculate frequency thresholds (low, medium, high)
      const sortedCounts = [...allComplaintCounts].sort((a, b) => a - b);
      const lowThreshold =
        sortedCounts.length > 0
          ? sortedCounts[Math.floor(sortedCounts.length * 0.33)] || 0
          : 0;
      const mediumThreshold =
        sortedCounts.length > 0
          ? sortedCounts[Math.floor(sortedCounts.length * 0.66)] || 0
          : 0;
      const highThreshold =
        sortedCounts.length > 0
          ? sortedCounts[sortedCounts.length - 1] || 0
          : 0;

      // Get ALL complaints (not just current period) for calculating averages
      // We need historical data to calculate proper averages
      const { data: allHistoricalComplaints, error: allComplaintsError } =
        await this.supabase
          .from("complaints")
          .select("id, submitted_at, latitude, longitude")
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .neq("workflow_status", "cancelled");

      if (allComplaintsError) {
        console.warn(
          "[INSIGHTS] Error fetching historical complaints for averages:",
          allComplaintsError
        );
      }

      // Classify all historical complaints by barangay
      const allComplaintsBarangayMap =
        allHistoricalComplaints && allHistoricalComplaints.length > 0
          ? classifyComplaints(allHistoricalComplaints)
          : new Map();

      // Group all historical complaints by barangay
      const barangayHistoricalComplaints = new Map();
      allComplaintsBarangayMap.forEach((barangayName, complaintId) => {
        if (!barangayHistoricalComplaints.has(barangayName)) {
          barangayHistoricalComplaints.set(barangayName, []);
        }
        const complaint = allHistoricalComplaints.find(
          (c) => c.id === complaintId
        );
        if (complaint) {
          barangayHistoricalComplaints.get(barangayName).push(complaint);
        }
      });

      // Calculate averages for each barangay across different periods
      const calculateAveragesForBarangay = (barangayName) => {
        const averages = {
          daily: 0,
          weekly: 0,
          monthly: 0,
          yearly: 0,
        };

        // Get all historical complaints for this barangay
        const barangayComplaints =
          barangayHistoricalComplaints.get(barangayName) || [];

        if (barangayComplaints.length === 0) {
          return averages;
        }

        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

        // Count complaints in each period
        const _dailyCount = barangayComplaints.filter(
          (c) => new Date(c.submitted_at) >= oneDayAgo
        ).length;
        const weeklyCount = barangayComplaints.filter(
          (c) => new Date(c.submitted_at) >= oneWeekAgo
        ).length;
        const monthlyCount = barangayComplaints.filter(
          (c) => new Date(c.submitted_at) >= oneMonthAgo
        ).length;
        const yearlyCount = barangayComplaints.filter(
          (c) => new Date(c.submitted_at) >= oneYearAgo
        ).length;

        // Calculate averages (complaints per period)
        // Daily: average complaints per day (based on last 7 days)
        averages.daily =
          weeklyCount > 0 ? Math.round((weeklyCount / 7) * 100) / 100 : 0;

        // Weekly: average complaints per week (based on last 30 days)
        averages.weekly =
          monthlyCount > 0
            ? Math.round((monthlyCount / 30) * 7 * 100) / 100
            : 0;

        // Monthly: average complaints per month (based on last 365 days)
        averages.monthly =
          yearlyCount > 0
            ? Math.round((yearlyCount / 365) * 30 * 100) / 100
            : 0;

        // Yearly: total complaints in last year
        averages.yearly = yearlyCount;

        return averages;
      };

      // Calculate prioritization score for each barangay
      // Score = (complaintCount * 1) + (clusterCount * 5) + (urgentCount * 3) + (highPriorityCount * 2)
      const prioritizationData = Array.from(barangayData.entries()).map(
        ([barangayName, data]) => {
          const prioritizationScore =
            Number(data.complaintCount) +
            data.clusterCount * 5 +
            data.urgentCount * 3 +
            data.highPriorityCount * 2;

          // Determine frequency level
          let frequencyLevel = "low";
          if (data.complaintCount >= highThreshold) {
            frequencyLevel = "high";
          } else if (data.complaintCount >= mediumThreshold) {
            frequencyLevel = "medium";
          }

          // Calculate averages for this barangay (using all historical complaints)
          const averages = calculateAveragesForBarangay(barangayName);

          return {
            ...data,
            prioritizationScore,
            frequencyLevel,
            averages,
            rank: 0, // Will be set after sorting
          };
        }
      );

      // Sort by prioritization score (descending) and assign ranks
      prioritizationData.sort(
        (a, b) => b.prioritizationScore - a.prioritizationScore
      );
      prioritizationData.forEach((item, index) => {
        item.rank = index + 1;
      });

      return {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        statistics: {
          averageComplaints: Math.round(avgComplaints * 100) / 100,
          frequencyThresholds: {
            low: lowThreshold,
            medium: mediumThreshold,
            high: highThreshold,
          },
        },
        barangays: prioritizationData,
      };
    } catch (error) {
      console.error(
        "[INSIGHTS_SERVICE] Get barangay prioritization error:",
        error
      );
      throw error;
    }
  }

  /**
   * Get date range for a given period
   * @param {string} period - 'daily', 'weekly', 'monthly', 'yearly'
   * @returns {Object} { startDate, endDate }
   */
  getDateRange(period) {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999); // End of today

    const startDate = new Date();

    switch (period) {
      case "daily":
        startDate.setHours(0, 0, 0, 0); // Start of today
        break;
      case "weekly":
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "monthly":
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yearly":
        startDate.setFullYear(startDate.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
    }

    return { startDate, endDate };
  }
}

module.exports = InsightsService;
