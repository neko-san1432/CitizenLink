const CoordinatorService = require('../services/CoordinatorService');

/**
 * CoordinatorController
 * Handles HTTP requests for coordinator operations
 */
class CoordinatorController {
  constructor() {
    this.coordinatorService = new CoordinatorService();
  }

  /**
   * GET /api/coordinator/review-queue
   * Get complaints awaiting coordinator review
   */
  async getReviewQueue(req, res) {
    try {
      console.log(`[COORDINATOR_CONTROLLER] ${new Date().toISOString()} Getting review queue for user:`, req.user?.id);
      console.log(`[COORDINATOR_CONTROLLER] ${new Date().toISOString()} User role:`, req.user?.role);

      const { user } = req;
      const filters = {
        priority: req.query.priority,
        type: req.query.type,
        limit: req.query.limit ? parseInt(req.query.limit) : 50
      };

      console.log(`[COORDINATOR_CONTROLLER] ${new Date().toISOString()} Filters:`, filters);

      const queue = await this.coordinatorService.getReviewQueue(user.id, filters);

      console.log(`[COORDINATOR_CONTROLLER] ${new Date().toISOString()} Retrieved ${queue.length} complaints`);

      res.json({
        success: true,
        data: queue,
        count: queue.length
      });
    } catch (error) {
      console.error(`[COORDINATOR_CONTROLLER] ${new Date().toISOString()} Get review queue error:`, error);
      console.error(`[COORDINATOR_CONTROLLER] ${new Date().toISOString()} Error stack:`, error.stack);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch review queue',
        details: error.message
      });
    }
  }

  /**
   * GET /api/coordinator/review-queue/:id
   * Get specific complaint for review with full analysis
   */
  async getComplaintForReview(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;

      const result = await this.coordinatorService.getComplaintForReview(id, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[COORDINATOR_CONTROLLER] Get complaint for review error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch complaint details'
      });
    }
  }

  /**
   * POST /api/coordinator/review-queue/:id/decide
   * Process coordinator decision on a complaint
   */
  async processDecision(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const { decision, data } = req.body;

      if (!decision) {
        return res.status(400).json({
          success: false,
          error: 'Decision type is required'
        });
      }

      const result = await this.coordinatorService.processDecision(
        id,
        decision,
        user.id,
        data || {}
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[COORDINATOR_CONTROLLER] Process decision error:', error);
      const status = error.message.includes('required') ? 400 : 500;
      res.status(status).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/coordinator/bulk-assign
   * Bulk assign complaints to department
   */
  async bulkAssign(req, res) {
    try {
      const { user } = req;
      const { complaint_ids, department } = req.body;

      if (!complaint_ids || !Array.isArray(complaint_ids) || complaint_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Complaint IDs array is required'
        });
      }

      if (!department) {
        return res.status(400).json({
          success: false,
          error: 'Department is required'
        });
      }

      const result = await this.coordinatorService.bulkAssign(
        complaint_ids,
        department,
        user.id
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[COORDINATOR_CONTROLLER] Bulk assign error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk assign complaints'
      });
    }
  }

  /**
   * GET /api/coordinator/dashboard
   * Get coordinator dashboard data
   */
  async getDashboard(req, res) {
    try {
      const { user } = req;
      console.log('[COORDINATOR_CONTROLLER] Getting dashboard for user:', user.id);

      const data = await this.coordinatorService.getDashboardData(user.id);
      console.log('[COORDINATOR_CONTROLLER] Dashboard data retrieved successfully');

      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('[COORDINATOR_CONTROLLER] Get dashboard error:', error);
      console.error('[COORDINATOR_CONTROLLER] Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code
      });

      // Return a basic dashboard structure if there's an error
      res.json({
        success: true,
        data: {
          pending_reviews: 0,
          stats: {
            total_reviews: 0,
            duplicates_merged: 0,
            assignments_made: 0,
            period: 'last_7_days'
          },
          recent_queue: [],
          active_clusters: []
        }
      });
    }
  }

  /**
   * POST /api/coordinator/detect-clusters
   * Detect complaint clusters
   */
  async detectClusters(req, res) {
    try {
      const options = {
        radiusKm: req.body.radius_km || 0.5,
        minComplaintsPerCluster: req.body.min_complaints || 3,
        type: req.body.type,
        dateFrom: req.body.date_from,
        dateTo: req.body.date_to
      };

      const result = await this.coordinatorService.detectClusters(options);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('[COORDINATOR_CONTROLLER] Detect clusters error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to detect clusters'
      });
    }
  }

  /**
   * GET /api/coordinator/status
   * Check if current user is a coordinator
   */
  async checkStatus(req, res) {
    try {
      const { user } = req;

      const status = await this.coordinatorService.checkCoordinatorStatus(user.id);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('[COORDINATOR_CONTROLLER] Check status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check coordinator status'
      });
    }
  }
}

module.exports = CoordinatorController;
