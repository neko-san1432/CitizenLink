/**
 * Notification Routes
 * Handles notification-related API endpoints
 */
const express = require("express");

const router = express.Router();
const NotificationController = require("../controllers/NotificationController");
const { authenticateUser } = require("../middleware/auth");

// Create controller instance
const notificationController = new NotificationController();
// All routes require authentication
router.use(authenticateUser);
// Get unread notifications
router.get("/unread", notificationController.getUnreadNotifications.bind(notificationController));
// Get all notifications (paginated)
router.get("/", notificationController.getAllNotifications.bind(notificationController));
// Get notification count
router.get("/count", notificationController.getNotificationCount.bind(notificationController));
// Mark notification as read
router.post("/:id/mark-read", notificationController.markAsRead.bind(notificationController));
// Mark all notifications as read
router.post("/mark-all-read", notificationController.markAllAsRead.bind(notificationController));
// Get notification stream (SSE)
router.get("/stream", notificationController.getNotificationStream.bind(notificationController));

module.exports = router;
