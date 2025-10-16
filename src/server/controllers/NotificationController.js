const NotificationService = require('../services/NotificationService');

/**
 * NotificationController
 * Handles HTTP requests for notifications
 */
class NotificationController {
  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Get user's notifications (paginated)
   * GET /api/notifications?page=0&limit=10
   */
  async getNotifications(req, res) {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 0;
      const limit = parseInt(req.query.limit) || 10;

      // Validate limits
      if (limit > 50) {
        return res.status(400).json({
          success: false,
          error: 'Limit cannot exceed 50'
        });
      }

      const result = await this.notificationService.getUserNotifications(userId, page, limit);

      res.json(result);
    } catch (error) {
      console.error('[NOTIFICATION_CONTROLLER] Get notifications error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notifications'
      });
    }
  }

  /**
   * Get unread notification count
   * GET /api/notifications/count
   */
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;

      const result = await this.notificationService.getUnreadCount(userId);

      res.json(result);
    } catch (error) {
      console.error('[NOTIFICATION_CONTROLLER] Get unread count error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notification count'
      });
    }
  }

  /**
   * Mark notification as read
   * PUT /api/notifications/:id/read
   */
  async markAsRead(req, res) {
    try {
      const userId = req.user.id;
      const notificationId = req.params.id;

      const result = await this.notificationService.markAsRead(notificationId, userId);

      res.json(result);
    } catch (error) {
      console.error('[NOTIFICATION_CONTROLLER] Mark as read error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark notification as read'
      });
    }
  }

  /**
   * Mark all notifications as read
   * PUT /api/notifications/read-all
   */
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;

      const result = await this.notificationService.markAllAsRead(userId);

      res.json(result);
    } catch (error) {
      console.error('[NOTIFICATION_CONTROLLER] Mark all as read error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark all notifications as read'
      });
    }
  }

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  async deleteNotification(req, res) {
    try {
      const userId = req.user.id;
      const notificationId = req.params.id;

      const result = await this.notificationService.deleteNotification(notificationId, userId);

      res.json(result);
    } catch (error) {
      console.error('[NOTIFICATION_CONTROLLER] Delete notification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete notification'
      });
    }
  }

  /**
   * Get notification summary (for email digest)
   * GET /api/notifications/summary
   */
  async getSummary(req, res) {
    try {
      const userId = req.user.id;

      const result = await this.notificationService.getNotificationSummary(userId);

      res.json(result);
    } catch (error) {
      console.error('[NOTIFICATION_CONTROLLER] Get summary error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notification summary'
      });
    }
  }
}

module.exports = new NotificationController();

