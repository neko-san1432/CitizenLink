const SimilarityCalculatorService = require('./SimilarityCalculatorService');
const Database = require('../config/database');

/**
 * ClusteringScheduler
 * Handles automatic scheduling of DBSCAN clustering operations
 */
class ClusteringScheduler {
  constructor() {
    this.similarityService = new SimilarityCalculatorService();
    this.db = new Database();
    this.supabase = this.db.getClient();
    this.intervalId = null;
    this.isRunning = false;
    this.lastClusteringTime = null;
    
    // Default configuration (can be overridden)
    this.config = {
      intervalHours: 6, // Run every 6 hours
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
      console.log('[CLUSTERING_SCHEDULER] Automatic clustering is disabled');
      return;
    }

    console.log(`[CLUSTERING_SCHEDULER] Starting automatic clustering scheduler`);
    console.log(`[CLUSTERING_SCHEDULER] Interval: ${this.config.intervalHours} hours`);
    console.log(`[CLUSTERING_SCHEDULER] Smart trigger: ${this.config.onlyIfNewComplaints ? 'enabled' : 'disabled'}`);

    // Run immediately on startup (after a short delay to let server initialize)
    setTimeout(() => {
      this.runClustering();
    }, 30000); // Wait 30 seconds after server start

    // Schedule periodic runs
    const intervalMs = this.config.intervalHours * 60 * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.runClustering();
    }, intervalMs);

    console.log(`[CLUSTERING_SCHEDULER] Next clustering will run in ${this.config.intervalHours} hours`);
  }

  /**
   * Stop the clustering scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[CLUSTERING_SCHEDULER] Scheduler stopped');
    }
  }

  /**
   * Check if new complaints exist since last clustering
   * @returns {Promise<boolean>} True if new complaints exist
   */
  async hasNewComplaints() {
    try {
      // Get the timestamp of the most recent active cluster
      const { data: latestCluster, error: clusterError } = await this.supabase
        .from('complaint_clusters')
        .select('created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let sinceDate = null;
      if (!clusterError && latestCluster) {
        sinceDate = latestCluster.created_at;
      } else if (this.lastClusteringTime) {
        // Fallback to in-memory timestamp
        sinceDate = this.lastClusteringTime;
      }

      // If no previous clustering, check all complaints
      let query = this.supabase
        .from('complaints')
        .select('id', { count: 'exact', head: true })
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (sinceDate) {
        query = query.gt('submitted_at', sinceDate);
      }

      const { count, error } = await query;

      if (error) {
        console.warn('[CLUSTERING_SCHEDULER] Error checking for new complaints:', error.message);
        // If check fails, assume there might be new complaints (safer to run)
        return true;
      }

      const hasNew = (count || 0) > 0;
      if (hasNew) {
        console.log(`[CLUSTERING_SCHEDULER] Found ${count} new complaint(s) since last clustering`);
      }
      return hasNew;
    } catch (error) {
      console.error('[CLUSTERING_SCHEDULER] Error in hasNewComplaints:', error);
      // On error, assume there might be new complaints (safer to run)
      return true;
    }
  }

  /**
   * Run clustering operation
   */
  async runClustering() {
    // Prevent concurrent runs
    if (this.isRunning) {
      console.log('[CLUSTERING_SCHEDULER] Clustering already in progress, skipping...');
      return;
    }

    // Smart trigger: check if new complaints exist
    if (this.config.onlyIfNewComplaints) {
      const hasNew = await this.hasNewComplaints();
      if (!hasNew) {
        console.log('[CLUSTERING_SCHEDULER] No new complaints detected, skipping clustering');
        return;
      }
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('[CLUSTERING_SCHEDULER] Starting automatic clustering...');
      
      const options = {
        radiusKm: this.config.radiusKm,
        minComplaintsPerCluster: this.config.minComplaintsPerCluster
      };

      const clusters = await this.similarityService.detectClusters(options);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.lastClusteringTime = new Date().toISOString();
      
      console.log(`[CLUSTERING_SCHEDULER] Clustering completed successfully`);
      console.log(`[CLUSTERING_SCHEDULER] Found ${clusters.length} cluster(s) in ${duration}s`);
      
      return {
        success: true,
        clustersFound: clusters.length,
        duration: duration,
        timestamp: this.lastClusteringTime
      };
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.error(`[CLUSTERING_SCHEDULER] Clustering failed after ${duration}s:`, error.message);
      
      return {
        success: false,
        error: error.message,
        duration: duration
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get scheduler status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      intervalHours: this.config.intervalHours,
      isRunning: this.isRunning,
      lastClusteringTime: this.lastClusteringTime,
      nextRunTime: this.intervalId ? 
        new Date(Date.now() + (this.config.intervalHours * 60 * 60 * 1000)).toISOString() : 
        null
    };
  }

  /**
   * Manually trigger clustering (for testing or admin use)
   * @returns {Promise<Object>} Clustering result
   */
  async triggerManual() {
    console.log('[CLUSTERING_SCHEDULER] Manual clustering triggered');
    return await this.runClustering();
  }
}

module.exports = ClusteringScheduler;




