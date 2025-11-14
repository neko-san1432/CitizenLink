/**
 * ClusteringManager
 * Singleton to manage clustering scheduler instance
 * Allows routes and controllers to access the scheduler
 */
let clusteringSchedulerInstance = null;

module.exports = {
  /**
   * Set the clustering scheduler instance
   * @param {ClusteringScheduler} scheduler - Scheduler instance
   */
  setScheduler(scheduler) {
    clusteringSchedulerInstance = scheduler;
  },

  /**
   * Get the clustering scheduler instance
   * @returns {ClusteringScheduler|null} Scheduler instance or null
   */
  getScheduler() {
    return clusteringSchedulerInstance;
  }
};

<<<<<<< HEAD




=======
>>>>>>> 55de51f3fa3db603cdb3e11f736f1c90f3a780b3
