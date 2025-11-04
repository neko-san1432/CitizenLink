/**
 * Notification Controller
 * Handles notification-related HTTP requests
 */

const Database = require('../config/database');
const supabase = Database.getClient();

class NotificationController {
  // Build a client link for a notification when applicable
  buildNotificationLink(notification) {
    try {
      const type = (notification.type || '').toLowerCase();
      const title = (notification.title || '').toLowerCase();
      const complaintId = notification.metadata?.complaint_id || notification.metadata?.complaintId || notification.complaint_id;

      if (complaintId) {
        // Progress/completion updates should open complaint details
        if (type.includes('workflow') || type.includes('progress') || title.includes('progress update') || type === 'complaint_assigned_to_officer') {
          return `/complaint-details/${complaintId}`;
        }
      }

      // Default: no link
      return null;
    } catch (_) {
      return null;
    }
  }
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

      // Debug: summarize results and potential duplicates by (type,title,complaint_id)
      const summaries = (notifications || []).map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        complaint_id: n.metadata?.complaint_id,
        created_at: n.created_at
      }));
      const dedupKey = r => `${r.type}|${r.title}|${r.complaint_id || ''}`;
      const dedupMap = new Map();
      for (const r of summaries) {
        const k = dedupKey(r);
        dedupMap.set(k, (dedupMap.get(k) || 0) + 1);
      }
      console.log('[NOTIFICATION][DEBUG] Unread fetch summary:', {
        userId,
        returned: notifications?.length || 0,
        uniqueByTypeTitleComplaint: dedupMap.size,
        buckets: Array.from(dedupMap.entries()).slice(0, 10) // cap log noise
      });

      // Deduplicate notifications by keeping only the most recent one per group
      const deduplicatedNotifications = [];
      const seenKeys = new Set();
      
      // Sort by created_at descending to keep most recent
      const sortedNotifications = (notifications || []).sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      for (const notification of sortedNotifications) {
        const key = dedupKey({
          type: notification.type,
          title: notification.title,
          complaint_id: notification.metadata?.complaint_id
        });
        
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          deduplicatedNotifications.push(notification);
        }
      }

      console.log('[NOTIFICATION][DEBUG] Deduplication result:', {
        userId,
        originalCount: notifications?.length || 0,
        deduplicatedCount: deduplicatedNotifications.length,
        removedDuplicates: (notifications?.length || 0) - deduplicatedNotifications.length
      });

      // Enrich with link for client-side navigation
      const enriched = deduplicatedNotifications.map(n => ({
        ...n,
        link: this.buildNotificationLink(n)
      }));

      res.json({
        success: true,
        notifications: enriched,
        count: enriched.length
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

      // Debug: summarize results and potential duplicates by (type,title,complaint_id)
      const summaries = (notifications || []).map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        complaint_id: n.metadata?.complaint_id,
        created_at: n.created_at
      }));
      const dedupKey = r => `${r.type}|${r.title}|${r.complaint_id || ''}`;
      const dedupMap = new Map();
      for (const r of summaries) {
        const k = dedupKey(r);
        dedupMap.set(k, (dedupMap.get(k) || 0) + 1);
      }
      console.log('[NOTIFICATION][DEBUG] All fetch summary:', {
        userId,
        returned: notifications?.length || 0,
        uniqueByTypeTitleComplaint: dedupMap.size,
        buckets: Array.from(dedupMap.entries()).slice(0, 10)
      });

      // Deduplicate notifications by keeping only the most recent one per group
      const deduplicatedNotifications = [];
      const seenKeys = new Set();
      
      // Sort by created_at descending to keep most recent
      const sortedNotifications = (notifications || []).sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      for (const notification of sortedNotifications) {
        const key = dedupKey({
          type: notification.type,
          title: notification.title,
          complaint_id: notification.metadata?.complaint_id
        });
        
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          deduplicatedNotifications.push(notification);
        }
      }

      console.log('[NOTIFICATION][DEBUG] All deduplication result:', {
        userId,
        originalCount: notifications?.length || 0,
        deduplicatedCount: deduplicatedNotifications.length,
        removedDuplicates: (notifications?.length || 0) - deduplicatedNotifications.length
      });

      // Enrich with link for client-side navigation
      const enriched = deduplicatedNotifications.map(n => ({
        ...n,
        link: this.buildNotificationLink(n)
      }));

      res.json({
        success: true,
        notifications: enriched,
        count: enriched.length
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

      // Get all unread notifications to apply deduplication
      const { data: notifications, error } = await supabase
        .from('notification')
        .select('*')
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('[NOTIFICATION] Error fetching notification count:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch notification count'
        });
      }

      // Apply same deduplication logic as getUnreadNotifications
      const dedupKey = r => `${r.type}|${r.title}|${r.metadata?.complaint_id || ''}`;
      const seenKeys = new Set();
      
      // Sort by created_at descending to keep most recent
      const sortedNotifications = (notifications || []).sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      for (const notification of sortedNotifications) {
        const key = dedupKey({
          type: notification.type,
          title: notification.title,
          complaint_id: notification.metadata?.complaint_id
        });
        
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
        }
      }

      const deduplicatedCount = seenKeys.size;

      res.json({
        success: true,
        count: deduplicatedCount
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