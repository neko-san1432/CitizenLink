const Database = require('../config/database');
const {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_ICONS
} = require('../../shared/constants');

/**
* NotificationService
* Handles all notification-related operations
*/
class NotificationService {
  constructor() {
    this.db = new Database();
    this.supabase = this.db.getClient();
  }

  /**
  * Notify all admins of a department (lgu-admin variants) about a new complaint assignment
  * Department matching by code suffix in role (e.g., lgu-admin-{dept}) and/or profile metadata
  */
  async notifyDepartmentAdminsByCode(departmentCode, complaintId, complaintTitle) {
    // Secure lookup via RPC (SECURITY DEFINER)
    const { data: targets, error } = await this.supabase
      .rpc('get_department_admin_ids', { p_department_code: departmentCode });

    if (error) {
      console.warn('[NOTIFICATION] Admin RPC failed:', error.message);
      return { success: false };
    }
    if (targets.length === 0) return { success: true, count: 0 };

    const notifications = targets.map((userId) => ({
      userId,
      type: NOTIFICATION_TYPES.APPROVAL_REQUIRED,
      title: 'New Complaint Assigned to Your Department',
      message: `"${complaintTitle}" has been assigned to ${departmentCode}.`,
      priority: NOTIFICATION_PRIORITY.INFO,
      link: `/lgu/department/${departmentCode}/complaints/${complaintId}`,
      metadata: { complaint_id: complaintId, department: departmentCode }
    }));

    return this.createBulkNotifications(notifications);
  }

  /**
  * Create a new notification
  * Supports both object and individual parameter syntax
  * @param {string|object} userIdOrOptions - User ID or options object
  * @param {string} type - Notification type from NOTIFICATION_TYPES
  * @param {string} title - Notification title
  * @param {string} message - Notification message
  * @param {object} options - Additional options
  * @returns {object} Created notification
  */
  async createNotification(userIdOrOptions, type, title, message, options = {}) {
    try {
      // Support both calling patterns
      let userId, notifType, notifTitle, notifMessage, notifOptions;

      if (typeof userIdOrOptions === 'object' && !type) {
        // Object syntax: createNotification({ userId, type, title, message, ... })
        const opts = userIdOrOptions;
        userId = opts.userId;
        notifType = opts.type;
        notifTitle = opts.title;
        notifMessage = opts.message;
        notifOptions = {
          priority: opts.priority,
          link: opts.link,
          metadata: opts.metadata,
          icon: opts.icon
        };
      } else {
        // Individual parameter syntax: createNotification(userId, type, title, message, options)
        userId = userIdOrOptions;
        notifType = type;
        notifTitle = title;
        notifMessage = message;
        notifOptions = options;
      }

      const {
        priority = NOTIFICATION_PRIORITY.INFO,
        link = null,
        metadata = {},
        icon = NOTIFICATION_ICONS[notifType] || '📢'
      } = notifOptions;

      const { data, error } = await this.supabase
        .from('notification')
        .insert([{
          user_id: userId,
          type: notifType,
          priority,
          title: notifTitle,
          message: notifMessage,
          icon,
          link,
          metadata
        }])
        .select()
        .single();

      if (error) throw error;

      // console.log removed for security

      return {
        success: true,
        notification: data
      };
    } catch (error) {
      console.error('[NOTIFICATION] Create error:', error);
      throw error;
    }
  }

  /**
  * Create multiple notifications (bulk)
  * @param {Array} notifications - Array of notification objects
  */
  async createBulkNotifications(notifications) {
    try {
      const notificationsData = notifications.map(notif => ({
        user_id: notif.userId,
        type: notif.type,
        priority: notif.priority || NOTIFICATION_PRIORITY.INFO,
        title: notif.title,
        message: notif.message,
        icon: notif.icon || NOTIFICATION_ICONS[notif.type] || '📢',
        link: notif.link || null,
        metadata: notif.metadata || {}
      }));

      const { data, error } = await this.supabase
        .from('notification')
        .insert(notificationsData)
        .select();

      if (error) throw error;

      // console.log removed for security

      return {
        success: true,
        notifications: data
      };
    } catch (error) {
      console.error('[NOTIFICATION] Bulk create error:', error);
      throw error;
    }
  }

  /**
  * Get user notifications (paginated)
  * @param {string} userId - User ID
  * @param {number} page - Page number (0-indexed)
  * @param {number} limit - Items per page
  * @returns {object} Paginated notifications
  */
  async getUserNotifications(userId, page = 0, limit = 10) {
    try {
      const offset = page * limit;

      // Get notifications
      const { data, error, count } = await this.supabase
        .from('notification')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const hasMore = (offset + limit) < count;

      return {
        success: true,
        data: {
          notifications: data || [],
          total: count,
          page,
          limit,
          hasMore
        }
      };
    } catch (error) {
      console.error('[NOTIFICATION] Get notifications error:', error);
      throw error;
    }
  }

  /**
  * Get unread notification count for user
  * @param {string} userId - User ID
  * @returns {number} Unread count
  */
  async getUnreadCount(userId) {
    try {
      const { count, error } = await this.supabase
        .from('notification')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;

      return {
        success: true,
        count: count || 0
      };
    } catch (error) {
      console.error('[NOTIFICATION] Get unread count error:', error);
      throw error;
    }
  }

  /**
  * Mark notification as read
  * @param {string} notificationId - Notification ID
  * @param {string} userId - User ID (for security check)
  * @returns {object} Updated notification
  */
  async markAsRead(notificationId, userId) {
    try {
      const { data, error } = await this.supabase
        .from('notification')
        .update({
          read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        notification: data
      };
    } catch (error) {
      console.error('[NOTIFICATION] Mark as read error:', error);
      throw error;
    }
  }

  /**
  * Mark all user notifications as read
  * @param {string} userId - User ID
  * @returns {object} Update result
  */
  async markAllAsRead(userId) {
    try {
      const { data, error } = await this.supabase
        .from('notification')
        .update({
          read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('read', false)
        .select();

      if (error) throw error;

      // console.log removed for security

      return {
        success: true,
        count: data.length
      };
    } catch (error) {
      console.error('[NOTIFICATION] Mark all as read error:', error);
      throw error;
    }
  }

  /**
  * Delete a notification
  * @param {string} notificationId - Notification ID
  * @param {string} userId - User ID (for security check)
  */
  async deleteNotification(notificationId, userId) {
    try {
      const { error } = await this.supabase
        .from('notification')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;

      return {
        success: true
      };
    } catch (error) {
      console.error('[NOTIFICATION] Delete error:', error);
      throw error;
    }
  }

  /**
  * Delete expired notifications (cleanup job)
  * Removes notifications older than their expires_at date
  */
  async deleteExpiredNotifications() {
    try {
      const { data, error } = await this.supabase
        .from('notification')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select();

      if (error) throw error;

      // console.log removed for security

      return {
        success: true,
        deleted: data?.length || 0
      };
    } catch (error) {
      console.error('[NOTIFICATION] Delete expired error:', error);
      throw error;
    }
  }

  /**
  * Get notification summary for email
  * Groups notifications by priority
  * @param {string} userId - User ID
  * @returns {object} Notification summary
  */
  async getNotificationSummary(userId) {
    try {
      const { data, error } = await this.supabase
        .from('notification')
        .select('priority, type')
        .eq('user_id', userId)
        .eq('read', false);

      if (error) throw error;

      const summary = {
        total: data.length,
        urgent: data.filter(n => n.priority === NOTIFICATION_PRIORITY.URGENT).length,
        warning: data.filter(n => n.priority === NOTIFICATION_PRIORITY.WARNING).length,
        info: data.filter(n => n.priority === NOTIFICATION_PRIORITY.INFO).length
      };

      return {
        success: true,
        summary
      };
    } catch (error) {
      console.error('[NOTIFICATION] Get summary error:', error);
      throw error;
    }
  }

  // ==================== ROLE-SPECIFIC NOTIFICATION HELPERS ====================

  /**
  * Notify citizen about complaint submission
  */
  async notifyComplaintSubmitted(citizenId, complaintId, complaintTitle) {
    return this.createNotification(
      citizenId,
      NOTIFICATION_TYPES.COMPLAINT_SUBMITTED,
      'Complaint Submitted',
      `Your complaint "${complaintTitle}" has been received and is being reviewed.`,
      {
        priority: NOTIFICATION_PRIORITY.INFO,
        link: `/citizen/complaints/${complaintId}`,
        metadata: { complaint_id: complaintId }
      }
    );
  }

  /**
  * Notify citizen about status change
  */
  async notifyComplaintStatusChanged(citizenId, complaintId, complaintTitle, newStatus, oldStatus) {
    const statusMessages = {
      'in progress': 'is now being worked on',
      'resolved': 'has been resolved',
      'rejected': 'has been rejected',
      'closed': 'has been closed'
    };

    const priority = newStatus === 'resolved' ? NOTIFICATION_PRIORITY.INFO :
      newStatus === 'rejected' ? NOTIFICATION_PRIORITY.WARNING :
        NOTIFICATION_PRIORITY.INFO;

    return this.createNotification(
      citizenId,
      NOTIFICATION_TYPES.COMPLAINT_STATUS_CHANGED,
      'Complaint Status Updated',
      `Your complaint "${complaintTitle}" ${statusMessages[newStatus] || `status changed to ${newStatus}`}.`,
      {
        priority,
        link: `/citizen/complaints/${complaintId}`,
        metadata: { complaint_id: complaintId, old_status: oldStatus, new_status: newStatus }
      }
    );
  }

  /**
  * Notify officer about new task assignment
  */
  async notifyTaskAssigned(officerId, complaintId, complaintTitle, priority, deadline) {
    const notifPriority = priority === 'urgent' ? NOTIFICATION_PRIORITY.URGENT :
      priority === 'high' ? NOTIFICATION_PRIORITY.WARNING :
        NOTIFICATION_PRIORITY.INFO;

    return this.createNotification(
      officerId,
      NOTIFICATION_TYPES.TASK_ASSIGNED,
      'New Task Assigned',
      `You've been assigned: "${complaintTitle}"${deadline ? ` - Due: ${new Date(deadline).toLocaleDateString()}` : ''}`,
      {
        priority: notifPriority,
        link: `/lgu/tasks/${complaintId}`,
        metadata: { complaint_id: complaintId, priority, deadline }
      }
    );
  }

  /**
  * Notify officer about approaching deadline
  */
  async notifyDeadlineApproaching(officerId, complaintId, complaintTitle, hoursRemaining) {
    return this.createNotification(
      officerId,
      NOTIFICATION_TYPES.TASK_DEADLINE_APPROACHING,
      'Deadline Approaching',
      `"${complaintTitle}" is due in ${hoursRemaining} hours!`,
      {
        priority: hoursRemaining <= 12 ? NOTIFICATION_PRIORITY.URGENT : NOTIFICATION_PRIORITY.WARNING,
        link: `/lgu/tasks/${complaintId}`,
        metadata: { complaint_id: complaintId, hours_remaining: hoursRemaining }
      }
    );
  }

  /**
  * Notify officer about overdue task
  */
  async notifyTaskOverdue(officerId, complaintId, complaintTitle) {
    return this.createNotification(
      officerId,
      NOTIFICATION_TYPES.TASK_OVERDUE,
      '⚠️ Task Overdue',
      `"${complaintTitle}" is now overdue! Please update status immediately.`,
      {
        priority: NOTIFICATION_PRIORITY.URGENT,
        link: `/lgu/tasks/${complaintId}`,
        metadata: { complaint_id: complaintId }
      }
    );
  }

  /**
  * Notify coordinator about new complaint needing review
  */
  async notifyNewComplaintReview(coordinatorId, complaintId, complaintTitle) {
    return this.createNotification(
      coordinatorId,
      NOTIFICATION_TYPES.NEW_COMPLAINT_REVIEW,
      'New Complaint for Review',
      `"${complaintTitle}" needs your review and assignment.`,
      {
        priority: NOTIFICATION_PRIORITY.INFO,
        link: `/coordinator/review/${complaintId}`,
        metadata: { complaint_id: complaintId }
      }
    );
  }

  /**
  * Notify citizen that their complaint was marked as duplicate
  */
  async notifyComplaintDuplicate(citizenId, complaintId, complaintTitle, masterComplaintId) {
    return this.createNotification(
      citizenId,
      NOTIFICATION_TYPES.COMPLAINT_DUPLICATE,
      'Complaint Linked to Existing Issue',
      `Your complaint "${complaintTitle}" has been linked to an existing similar complaint. Updates will be shared.`,
      {
        priority: NOTIFICATION_PRIORITY.INFO,
        link: `/citizen/complaints/${masterComplaintId}`,
        metadata: { complaint_id: complaintId, master_complaint_id: masterComplaintId }
      }
    );
  }
}

module.exports = NotificationService;

