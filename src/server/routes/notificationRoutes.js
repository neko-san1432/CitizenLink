const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/NotificationController');
const { authenticateUser } = require('../middleware/auth');

// All notification routes require authentication
router.use(authenticateUser);

// Get unread count (MUST be before '/' to avoid being caught by the generic route)
router.get('/count', NotificationController.getUnreadCount.bind(NotificationController));

// Get notification summary (for email digest)
router.get('/summary', NotificationController.getSummary.bind(NotificationController));

// Get user's notifications (paginated)
router.get('/', NotificationController.getNotifications.bind(NotificationController));

// Mark single notification as read
router.put('/:id/read', NotificationController.markAsRead.bind(NotificationController));

// Mark all notifications as read
router.put('/read-all', NotificationController.markAllAsRead.bind(NotificationController));

// Delete notification
router.delete('/:id', NotificationController.deleteNotification.bind(NotificationController));

module.exports = router;

