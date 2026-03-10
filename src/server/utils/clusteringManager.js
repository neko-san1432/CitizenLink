/**
 * ClusteringManager
 * Singleton to manage clustering scheduler instance
 * Allows routes and controllers to access the scheduler
 */
let clusteringSchedulerInstance = null;

module.exports = {
  /**
   * Set the clustering scheduler instance
   * @param {clusteringScheduler} scheduler - Scheduler instance
   */
  setScheduler(scheduler) {
    clusteringSchedulerInstance = scheduler;
  },

  /**
   * Get the clustering scheduler instance
   * @returns {clusteringScheduler|null} Scheduler instance or null
   */
  getScheduler() {
    return clusteringSchedulerInstance;
  }
};

