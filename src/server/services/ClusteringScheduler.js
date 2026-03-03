const SimilarityCalculatorService = require("./SimilarityCalculatorService");
const BrainService = require("./BrainService"); // New Brain Integration
const Database = require("../config/database");

/**
 * ClusteringScheduler
 * Handles automatic scheduling of DBSCAN clustering operations
 * Integrated with BrainService for Advanced Logic (DBSCAN++)
 */
class ClusteringScheduler {
  constructor() {
    this.similarityService = new SimilarityCalculatorService();
    this.db = Database.getInstance();
    this.supabase = this.db.getClient();
    this.intervalId = null;
    this.isRunning = false;
    this.lastClusteringTime = null;

    // Default configuration (can be overridden)
    this.config = {
      intervalHours: 5 / 60, // Run every 5 minutes
      radiusKm: 0.5,
      minComplaintsPerCluster: 3,
      onlyIfNewComplaints: true, // Smart trigger: only cluster if new complaints exist
      enabled: true
    };
  }

  /**
   * Start the clustering scheduler
   * @param {Object} options - Configuration options
   */
  start(options = {}) {
    // Merge with provided options
    this.config = { ...this.config, ...options };

    if (!this.config.enabled) {
      console.log("[CLUSTERING_SCHEDULER] Automatic clustering is disabled");
      return;
    }

    console.log(`[CLUSTERING_SCHEDULER] Starting automatic clustering scheduler (Powered by BrainService)`);
    const intervalMinutes = this.config.intervalHours * 60;
    console.log(`[CLUSTERING_SCHEDULER] Interval: ${intervalMinutes} minutes`);

    // Run immediately on startup
    setTimeout(() => {
      this.runClustering();
    }, 30000);

    // Schedule periodic runs
    const intervalMs = this.config.intervalHours * 60 * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.runClustering();
    }, intervalMs);

    console.log(`[CLUSTERING_SCHEDULER] Next clustering will run in ${intervalMinutes} minutes`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[CLUSTERING_SCHEDULER] Scheduler stopped");
    }
  }

  async hasNewComplaints() {
    // ... (Existing logic kept same? or simplified?)
    // Reusing existing logic for safety
    try {
      if (!this.supabase) return true;

      // Simple count check for recent complaints
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await this.supabase
        .from("complaints")
        .select("id", { count: "exact", head: true })
        .gte("submitted_at", oneHourAgo);

      return error ? true : (count > 0);
    } catch (e) {
      return true;
    }
  }

  /**
   * Run clustering operation via BrainService
   */
  async runClustering() {
    if (this.isRunning) {
      console.log("[CLUSTERING_SCHEDULER] Clustering already in progress, skipping...");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log("[CLUSTERING_SCHEDULER] Starting intelligence cycle...");

      // 1. Fetch Active Complaints
      // We generally want "open" complaints or recent ones
      const { data: complaints, error } = await this.supabase
        .from("complaints")
        .select("*")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        // .eq('workflow_status', 'submitted') // Optional: filter by status
        .order("submitted_at", { ascending: false })
        .limit(500); // Analyze last 500 complaints

      if (error) throw error;
      if (!complaints || complaints.length === 0) {
        console.log("[CLUSTERING] No complaints to analyze.");
        this.isRunning = false;
        return;
      }

      // 2. Run BrainService
      const intelligence = BrainService.runIntelligenceCycle(complaints);

      // 3. Map Clusters to Database Format
      // BrainService returns internal format, we need to match DB schema for 'complaint_clusters'
      const mappedClusters = intelligence.clusters.map((c, index) => ({
        cluster_name: `Cluster ${index + 1} - ${c.category}`,
        center_lat: c.latitude,
        center_lng: c.longitude,
        radius_meters: c.radius || 100,
        complaint_ids: c.reports.map(r => r.id),
        pattern_type: "brain_detected", // New pattern type
        status: "active",
        urgency_score: parseFloat(c.urgency_score) || 0,
        confidence: parseFloat(c.confidence) || 0.5,
        created_at: new Date().toISOString()
      }));

      // 4. Save Clusters (Using SimilarityService to handle DB ops)
      const saveResult = await this.similarityService.saveClusters(mappedClusters);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.lastClusteringTime = new Date().toISOString();

      console.log(`[CLUSTERING] Completed in ${duration}s. Clusters: ${mappedClusters.length}`);

      return {
        success: true,
        clustersFound: mappedClusters.length,
        duration,
        timestamp: this.lastClusteringTime
      };

    } catch (error) {
      console.error(`[CLUSTERING_SCHEDULER] Failed: ${error.message}`);
      return { success: false, error: error.message };
    } finally {
      this.isRunning = false;
    }
  }

  getStatus() {
    return {
      enabled: this.config.enabled, // Fixed: usage of this.config
      isRunning: this.isRunning,
      lastClusteringTime: this.lastClusteringTime
    };
  }

  async triggerManual() {
    console.log("[CLUSTERING_SCHEDULER] Manual trigger");
    return await this.runClustering();
  }
}

module.exports = ClusteringScheduler;

