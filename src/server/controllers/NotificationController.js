/**
 * Notification Controller
 * Handles notification-related HTTP requests
 */

const Database = require('../config/database');
const supabase = Database.getClient();

class NotificationController {
  /**
   * Get unread notifications for user
   */
  async getUnreadNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;

      const { data: notifications, error } = await supabase
        .from('notification')
        .select('*')
        .eq('user_id', userId)
        .eq('read', false)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('[NOTIFICATION] Error fetching unread notifications:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch notifications'
        });
      }

      res.json({
        success: true,
        notifications: notifications || [],
        count: notifications?.length || 0
      });

    } catch (error) {
      console.error('[NOTIFICATION] Get unread notifications error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notifications'
      });
    }
  }

  /**
   * Get all notifications for user (paginated)
   */
  async getAllNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 20, offset = 0 } = req.query;

      const { data: notifications, error } = await supabase
        .from('notification')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('[NOTIFICATION] Error fetching all notifications:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch notifications'
        });
      }

      res.json({
        success: true,
        notifications: notifications || [],
        count: notifications?.length || 0
      });

    } catch (error) {
      console.error('[NOTIFICATION] Get all notifications error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notifications'
      });
    }
  }

  /**
   * Get notification count for user
   */
  async getNotificationCount(req, res) {
    try {
      const userId = req.user.id;
      console.log('[NOTIFICATION] Getting notification count for user:', userId);

      const { count, error } = await supabase
        .from('notification')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('[NOTIFICATION] Error fetching notification count:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch notification count'
        });
      }

      res.json({
        success: true,
        count: count || 0
      });

    } catch (error) {
      console.error('[NOTIFICATION] Get notification count error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch notification count'
      });
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const { data, error } = await supabase
        .from('notification')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('[NOTIFICATION] Error marking notification as read:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to mark notification as read'
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification marked as read'
      });

    } catch (error) {
      console.error('[NOTIFICATION] Mark as read error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark notification as read'
      });
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;

      const { error } = await supabase
        .from('notification')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('[NOTIFICATION] Error marking all notifications as read:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to mark all notifications as read'
        });
      }

      res.json({
        success: true,
        message: 'All notifications marked as read'
      });

    } catch (error) {
      console.error('[NOTIFICATION] Mark all as read error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mark all notifications as read'
      });
    }
  }

  /**
   * Get notification stream (Server-Sent Events)
   */
  async getNotificationStream(req, res) {
    try {
      const userId = req.user.id;

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial connection message
      res.write(`data: ${JSON.stringify({
        type: 'connected',
        message: 'Connected to notification stream',
        timestamp: new Date().toISOString()
      })}\n\n`);

      // Set up real-time subscription to notifications
      const subscription = supabase
        .channel('notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notification',
          filter: `user_id=eq.${userId}`
        }, (payload) => {
          console.log('[NOTIFICATION] Real-time notification received:', payload);

          const notification = payload.new;
          const notificationData = {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            priority: notification.priority,
            metadata: notification.metadata,
            created_at: notification.created_at
          };

          // Send notification to client
          res.write(`data: ${JSON.stringify(notificationData)}\n\n`);
        })
        .subscribe();

      // Handle client disconnect
      req.on('close', () => {
        // Only log in development mode to reduce production noise
        if (process.env.NODE_ENV === 'development') {
          console.log('[NOTIFICATION] Client disconnected from stream');
        }
        subscription.unsubscribe();
        res.end();
      });

      // Keep connection alive with periodic ping
      const keepAlive = setInterval(() => {
        if (res.destroyed) {
          clearInterval(keepAlive);
          return;
        }
        res.write(`data: ${JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString()
        })}\n\n`);
      }, 30000); // Ping every 30 seconds

      // Clean up on error
      req.on('error', (error) => {
        // Only log non-connection errors to reduce noise
        if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
          console.error('[NOTIFICATION] Stream error:', error);
        }
        clearInterval(keepAlive);
        subscription.unsubscribe();
        res.end();
      });

    } catch (error) {
      console.error('[NOTIFICATION] Get notification stream error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to establish notification stream'
      });
    }
  }
}

module.exports = NotificationController;