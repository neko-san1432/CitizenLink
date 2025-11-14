const LguOfficerService = require('../services/LguOfficerService');
const { ErrorHandler } = require('../middleware/errorHandler');

class LguOfficerController {
  constructor() {
    this.officerService = new LguOfficerService();
  }

  /**
   * Get assigned tasks for officer
   */
  async getAssignedTasks(req, res) {
    try {
      const userId = req.user.id;
      const { status, priority, limit } = req.query;

      const tasks = await this.officerService.getAssignedTasks(userId, { status, priority, limit });

      return res.json({
        success: true,
        data: tasks
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Get assigned tasks error:', error);
      return ErrorHandler.handleApiError(error, req, res, 'LGU_OFFICER');
    }
  }
  /**
   * Mark complaint as resolved
   */
  async markAsResolved(req, res) {
    try {
      const { complaintId } = req.params;
      const { resolution_notes } = req.body;
      const userId = req.user.id;

      const complaint = await this.officerService.markAsResolved(complaintId, userId, resolution_notes);

      return res.json({
        success: true,
        message: 'Complaint marked as resolved successfully',
        complaint
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Mark as resolved error:', error);
      return ErrorHandler.handleApiError(error, req, res, 'LGU_OFFICER');
    }
  }
  /**
   * Get all tasks assigned to the current officer
   */
  async getMyTasks(req, res) {
    try {
      const userId = req.user.id;
      const tasks = await this.officerService.getMyTasks(userId);

      return res.json({
        success: true,
        data: tasks
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Get tasks error:', error);
      return ErrorHandler.handleApiError(error, req, res, 'LGU_OFFICER');
    }
  }
  /**
   * Update task status (accept, start, complete, etc.)
   */
  async updateTaskStatus(req, res) {
    try {
      const { assignmentId } = req.params;
      const { status, notes } = req.body;
      const userId = req.user.id;

      await this.officerService.updateTaskStatus(assignmentId, userId, status, notes);

      return res.json({
        success: true,
        message: 'Task status updated successfully'
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Update task status error:', error);
      return ErrorHandler.handleApiError(error, req, res, 'LGU_OFFICER');
    }
  }
  /**
   * Add progress update/note to a task
   */
  async addProgressUpdate(req, res) {
    try {
      const { assignmentId } = req.params;
      const { message, isPublic } = req.body;
      const userId = req.user.id;

      await this.officerService.addProgressUpdate(assignmentId, userId, message, isPublic);

      return res.json({
        success: true,
        message: 'Progress update added successfully'
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Add progress update error:', error);
      return ErrorHandler.handleApiError(error, req, res, 'LGU_OFFICER');
    }
  }
  /**
   * Get officer statistics
   */
  async getStatistics(req, res) {
    try {
      const userId = req.user.id;
      const statistics = await this.officerService.getStatistics(userId);

      return res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Get statistics error:', error);
      return ErrorHandler.handleApiError(error, req, res, 'LGU_OFFICER');
    }
  }
  /**
   * Get officer activities
   */
  async getActivities(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 10 } = req.query;

      const activities = await this.officerService.getActivities(userId, limit);

      return res.json({
        success: true,
        data: activities
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Get activities error:', error);
      return ErrorHandler.handleApiError(error, req, res, 'LGU_OFFICER');
    }
  }
  /**
   * Get department updates
   */
  async getUpdates(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 10 } = req.query;

      const updates = await this.officerService.getUpdates(userId, limit);

      return res.json({
        success: true,
        data: updates
      });
    } catch (error) {
      console.error('[LGU_OFFICER] Get updates error:', error);
      return ErrorHandler.handleApiError(error, req, res, 'LGU_OFFICER');
    }
  }
}

module.exports = LguOfficerController;
