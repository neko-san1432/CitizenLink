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
      console.log('[CLUSTERING_SCHEDULER] Automatic clustering is disabled');
      return;
    }

    console.log(`[CLUSTERING_SCHEDULER] Starting automatic clustering scheduler`);
    const intervalMinutes = this.config.intervalHours * 60;
    console.log(`[CLUSTERING_SCHEDULER] Interval: ${intervalMinutes} minutes`);
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

    console.log(`[CLUSTERING_SCHEDULER] Next clustering will run in ${intervalMinutes} minutes`);
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
      if (!this.supabase) {
        console.warn('[CLUSTERING_SCHEDULER] Supabase client not available');
        // Assume there might be new complaints (safer to run)
        return true;
      }

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
        // Check if it's a network error
        if (error.message && error.message.includes('fetch failed')) {
          console.warn('[CLUSTERING_SCHEDULER] Network error checking for new complaints (database may be unreachable):', error.message);
        } else {
          console.warn('[CLUSTERING_SCHEDULER] Error checking for new complaints:', {
            message: error.message || 'Unknown error',
            code: error.code,
            details: error.details || ''
          });
        }
        // If check fails, assume there might be new complaints (safer to run)
        return true;
      }

      const hasNew = (count || 0) > 0;
      if (hasNew) {
        console.log(`[CLUSTERING_SCHEDULER] Found ${count} new complaint(s) since last clustering`);
      }
      return hasNew;
    } catch (error) {
      // Handle network errors gracefully
      if (error instanceof TypeError && error.message.includes('fetch failed')) {
        console.warn('[CLUSTERING_SCHEDULER] Network error in hasNewComplaints (database may be unreachable):', error.message);
      } else {
        console.error('[CLUSTERING_SCHEDULER] Error in hasNewComplaints:', {
          message: error.message || 'Unknown error',
          stack: error.stack
        });
      }
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
      
      // Log detailed information about each cluster
      if (clusters.length > 0) {
        console.log(`[CLUSTERING_SCHEDULER] Cluster details:`);
        clusters.forEach((cluster, index) => {
          const complaintCount = cluster.complaint_ids?.length || 0;
          console.log(`  [CLUSTERING_SCHEDULER] Cluster ${index + 1}: "${cluster.cluster_name}"`);
          console.log(`    - Complaints: ${complaintCount}`);
          console.log(`    - Location: (${cluster.center_lat?.toFixed(6)}, ${cluster.center_lng?.toFixed(6)})`);
          console.log(`    - Radius: ${cluster.radius_meters?.toFixed(0)}m`);
          console.log(`    - Pattern: ${cluster.pattern_type || 'normal'}`);
        });
      } else {
        console.log(`[CLUSTERING_SCHEDULER] No clusters detected (insufficient complaints or no geographic proximity)`);
      }

      return {
        success: true,
        clustersFound: clusters.length,
        duration,
        timestamp: this.lastClusteringTime
      };
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      // Handle network errors gracefully
      if (error instanceof TypeError && error.message.includes('fetch failed')) {
        console.error(`[CLUSTERING_SCHEDULER] Clustering failed after ${duration}s: Database query failed: ${error.message}`);
        console.warn('[CLUSTERING_SCHEDULER] This may indicate the database is unreachable. Check your Supabase configuration and network connectivity.');
      } else {
        console.error(`[CLUSTERING_SCHEDULER] Clustering failed after ${duration}s:`, {
          message: error.message || 'Unknown error',
          stack: error.stack
        });
      }

      return {
        success: false,
        error: error.message || 'Unknown error',
        duration
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


