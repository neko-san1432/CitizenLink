const Database = require("../config/database");

const {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_ICONS
} = require("../../shared/constants");
/**
* NotificationService
* Handles all notification-related operations
*/
class NotificationService {

  constructor() {
    this.db = Database.getInstance();
    this.supabase = this.db.getClient();
  }
  /**
  * Notify all admins of a department (lgu-admin variants) about a new complaint assignment
  * Department matching by code suffix in role (e.g., lgu-admin-{dept}) and/or profile metadata
  */
  async notifyDepartmentAdminsByCode(departmentCode, complaintId, complaintTitle) {
    try {
      // Use RPC for efficient lookup (O(1) instead of O(N))
      const { data: admins, error } = await this.supabase.rpc("get_users_by_role", {
        p_role: "lgu-admin",
        p_department: departmentCode
      });

      if (error) {
        console.warn("[NOTIFICATION] Failed to fetch admins via RPC:", error.message);
        return { success: false, error: error.message };
      }
      // console.log removed for security
      if (admins.length === 0) {
        console.warn(`[NOTIFICATION] No LGU admins found for department ${departmentCode}`);
        return { success: true, count: 0 };
      }
      const notifications = admins.map((admin) => ({
        userId: admin.id,
        type: NOTIFICATION_TYPES.APPROVAL_REQUIRED,
        title: "New Complaint Assigned to Your Department",
        message: `"${complaintTitle}" has been assigned to ${departmentCode}. Please review and assign to an officer.`,
        priority: NOTIFICATION_PRIORITY.INFO,
        link: `/lgu-admin/assignments`,
        metadata: {
          complaint_id: complaintId,
          department: departmentCode,
          assigned_at: new Date().toISOString()
        }
      }));
      return this.createBulkNotifications(notifications);
    } catch (error) {
      console.error("[NOTIFICATION] notifyDepartmentAdminsByCode error:", error);
      return { success: false, error: error.message };
    }
  }
  /**
  * Create a new notification with deduplication
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
      if (typeof userIdOrOptions === "object" && !type) {
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
          icon: opts.icon,
          deduplicate: opts.deduplicate !== false // Default to true
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
        icon = NOTIFICATION_ICONS[notifType] || "📢",
        deduplicate = true
      } = notifOptions;
      // Check for duplicates if deduplication is enabled
      if (deduplicate) {
        const duplicateCheck = await this.checkDuplicateNotification(
          userId,
          notifType,
          notifTitle,
          metadata
        );
        if (duplicateCheck.exists) {
          // console.log removed for security
          return {
            success: true,
            notification: duplicateCheck.notification,
            duplicate: true
          };
        }
      }
      const { data, error } = await this.supabase
        .from("notification")
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
        notification: data,
        duplicate: false
      };
    } catch (error) {
      console.error("[NOTIFICATION] Create error:", error);
      throw error;
    }
  }
  /**
   * Check for duplicate notifications
   * @param {string} userId - User ID
   * @param {string} type - Notification type
   * @param {string} title - Notification title
   * @param {object} metadata - Notification metadata
   * @returns {object} Duplicate check result
   */
  async checkDuplicateNotification(userId, type, title, metadata = {}) {
    try {
      // console.log removed for security
      const { data, error } = await this.supabase
        .from("notification")
        .select("*")
        .eq("user_id", userId)
        .eq("type", type)
        .eq("title", title)
        .eq("read", false) // Only check unread notifications
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Within last 24 hours
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) {
        console.warn("[NOTIFICATION] Duplicate check error:", error.message);
        return { exists: false };
      }
      const exists = data && data.length > 0;
      // console.log removed for security
      return {
        exists,
        notification: data && data.length > 0 ? data[0] : null
      };
    } catch (error) {
      console.warn("[NOTIFICATION] Duplicate check error:", error.message);
      return { exists: false };
    }
  }
  /**
  * Create multiple notifications (bulk) with deduplication
  * @param {Array} notifications - Array of notification objects
  * @param {boolean} deduplicate - Whether to check for duplicates (default: true)
  */
  async createBulkNotifications(notifications, deduplicate = true) {
    try {
      if (!deduplicate) {
        // Simple bulk insert without deduplication
        const notificationsData = notifications.map(notif => ({
          user_id: notif.userId,
          type: notif.type,
          priority: notif.priority || NOTIFICATION_PRIORITY.INFO,
          title: notif.title,
          message: notif.message,
          icon: notif.icon || NOTIFICATION_ICONS[notif.type] || "📢",
          link: notif.link || null,
          metadata: notif.metadata || {}
        }));
        const { data, error } = await this.supabase
          .from("notification")
          .insert(notificationsData)
          .select();
        if (error) throw error;
        // console.log removed for security
        return {
          success: true,
          notifications: data,
          count: data.length,
          duplicates: 0
        };
      }
      // With deduplication - process each notification individually
      const results = {
        success: true,
        notifications: [],
        duplicates: 0,
        errors: 0
      };
      for (const notif of notifications) {
        try {
          const result = await this.createNotification({
            userId: notif.userId,
            type: notif.type,
            title: notif.title,
            message: notif.message,
            priority: notif.priority,
            link: notif.link,
            metadata: notif.metadata,
            icon: notif.icon,
            deduplicate: true
          });
          if (result.duplicate) {
            results.duplicates++;
          } else {
            results.notifications.push(result.notification);
          }
        } catch (error) {
          console.warn(`[NOTIFICATION] Failed to create notification for user ${notif.userId}:`, error.message);
          results.errors++;
        }
      }
      // console.log removed for security
      return results;
    } catch (error) {
      console.error("[NOTIFICATION] Bulk create error:", error);
      throw error;
    }
  }
  /**
   * Notify multiple users about the same event with deduplication
   * @param {Array} userIds - Array of user IDs
   * @param {string} type - Notification type
   * @param {string} title - Notification title
   * @param {string} message - Notification message
   * @param {object} options - Additional options
   * @returns {object} Notification results
   */
  async notifyMultipleUsers(userIds, type, title, message, options = {}) {
    try {
      // console.log removed for security
      const notifications = userIds.map(userId => ({
        userId,
        type,
        title,
        message,
        ...options
      }));
      return await this.createBulkNotifications(notifications, true);
    } catch (error) {
      console.error("[NOTIFICATION] Notify multiple users error:", error);
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
        .from("notification")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
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
      console.error("[NOTIFICATION] Get notifications error:", error);
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
        .from("notification")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);
      if (error) throw error;
      return {
        success: true,
        count: count || 0
      };
    } catch (error) {
      console.error("[NOTIFICATION] Get unread count error:", error);
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
        .from("notification")
        .update({
          read: true,
          read_at: new Date().toISOString()
        })
        .eq("id", notificationId)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      return {
        success: true,
        notification: data
      };
    } catch (error) {
      console.error("[NOTIFICATION] Mark as read error:", error);
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
        .from("notification")
        .update({
          read: true,
          read_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .eq("read", false)
        .select();
      if (error) throw error;
      // console.log removed for security
      return {
        success: true,
        count: data.length
      };
    } catch (error) {
      console.error("[NOTIFICATION] Mark all as read error:", error);
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
        .from("notification")
        .delete()
        .eq("id", notificationId)
        .eq("user_id", userId);
      if (error) throw error;
      return {
        success: true
      };
    } catch (error) {
      console.error("[NOTIFICATION] Delete error:", error);
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
        .from("notification")
        .delete()
        .lt("expires_at", new Date().toISOString())
        .select();
      if (error) throw error;
      // console.log removed for security
      return {
        success: true,
        deleted: data?.length || 0
      };
    } catch (error) {
      console.error("[NOTIFICATION] Delete expired error:", error);
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
        .from("notification")
        .select("priority, type")
        .eq("user_id", userId)
        .eq("read", false);
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
      console.error("[NOTIFICATION] Get summary error:", error);
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
      "Complaint Submitted",
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
      "in progress": "is now being worked on",
      "resolved": "has been resolved",
      "rejected": "has been rejected",
      "closed": "has been closed"
    };
    const priority = newStatus === "resolved" ? NOTIFICATION_PRIORITY.INFO :
      newStatus === "rejected" ? NOTIFICATION_PRIORITY.WARNING :
        NOTIFICATION_PRIORITY.INFO;
    return this.createNotification(
      citizenId,
      NOTIFICATION_TYPES.COMPLAINT_STATUS_CHANGED,
      "Complaint Status Updated",
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
    // console.log removed for security
    const notifPriority = priority === "urgent" ? NOTIFICATION_PRIORITY.URGENT :
      priority === "high" ? NOTIFICATION_PRIORITY.WARNING :
        NOTIFICATION_PRIORITY.INFO;
    return this.createNotification(
      officerId,
      NOTIFICATION_TYPES.TASK_ASSIGNED,
      "New Task Assigned",
      `You've been assigned: "${complaintTitle}"${deadline ? ` - Due: ${new Date(deadline).toLocaleDateString()}` : ""}`,
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
      "Deadline Approaching",
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
      "⚠️ Task Overdue",
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
      "New Complaint for Review",
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
      "Complaint Linked to Existing Issue",
      `Your complaint "${complaintTitle}" has been linked to an existing similar complaint. Updates will be shared.`,
      {
        priority: NOTIFICATION_PRIORITY.INFO,
        link: `/citizen/complaints/${masterComplaintId}`,
        metadata: { complaint_id: complaintId, master_complaint_id: masterComplaintId }
      }
    );
  }
  /**
   * Notify officer that their assignment has been completed
   */
  async notifyAssignmentCompleted(officerId, complaintId, complaintTitle) {
    return this.createNotification(
      officerId,
      NOTIFICATION_TYPES.ASSIGNMENT_COMPLETED,
      "Assignment Completed",
      `Your assignment for "${complaintTitle}" has been completed by another officer.`,
      {
        priority: NOTIFICATION_PRIORITY.INFO,
        link: `/lgu/tasks/${complaintId}`,
        metadata: { complaint_id: complaintId }
      }
    );
  }
  /**
   * Notify officer of admin reminder to complete task
   */
  async notifyAdminReminder(officerId, complaintId, complaintTitle, reminderMessage) {
    return this.createNotification(
      officerId,
      NOTIFICATION_TYPES.ADMIN_REMINDER,
      "Reminder from Admin",
      `Admin reminder: ${reminderMessage} - "${complaintTitle}"`,
      {
        priority: NOTIFICATION_PRIORITY.WARNING,
        link: `/lgu/tasks/${complaintId}`,
        metadata: { complaint_id: complaintId, reminder_type: "admin_reminder" }
      }
    );
  }
  /**
   * Notify citizen about workflow step completion
   */
  async notifyWorkflowStepCompleted(citizenId, complaintId, complaintTitle, stepDescription) {
    return this.createNotification(
      citizenId,
      NOTIFICATION_TYPES.WORKFLOW_STEP_COMPLETED,
      "Progress Update",
      `Progress on "${complaintTitle}": ${stepDescription}`,
      {
        priority: NOTIFICATION_PRIORITY.INFO,
        link: `/citizen/complaints/${complaintId}`,
        metadata: { complaint_id: complaintId, step: stepDescription }
      }
    );
  }
  /**
   * Notify citizen that LGU work has been completed
   */
  async notifyLguWorkCompleted(citizenId, complaintId, complaintTitle) {
    return this.createNotification(
      citizenId,
      NOTIFICATION_TYPES.LGU_WORK_COMPLETED,
      "Work Completed - Please Review",
      `The assigned LGU departments have completed their work on "${complaintTitle}". Please review and confirm resolution.`,
      {
        priority: NOTIFICATION_PRIORITY.INFO,
        link: `/citizen/complaints/${complaintId}`,
        metadata: { complaint_id: complaintId, action_required: "review_resolution" }
      }
    );
  }
  /**
   * Notify citizen that resolution review is needed
   */
  async notifyResolutionReviewNeeded(citizenId, complaintId, complaintTitle) {
    return this.createNotification(
      citizenId,
      NOTIFICATION_TYPES.RESOLUTION_REVIEW_NEEDED,
      "Review Required",
      `Please review the completed work for "${complaintTitle}" and mark as resolved if satisfied.`,
      {
        priority: NOTIFICATION_PRIORITY.INFO,
        link: `/citizen/complaints/${complaintId}`,
        metadata: { complaint_id: complaintId, action_required: "mark_resolved" }
      }
    );
  }
  /**
   * Notify LGU admin about officer reminder needs
   */
  async notifyOfficerReminder(adminId, officerName, complaintId, complaintTitle, reminderType) {
    const reminderMessages = {
      pending_task: `${officerName} has a pending task that needs attention`,
      complete_assignment: `${officerName} needs to mark their assignment as complete`,
      overdue_task: `${officerName} has an overdue task that requires immediate action`
    };
    return this.createNotification(
      adminId,
      NOTIFICATION_TYPES.OFFICER_REMINDER,
      "Officer Reminder Needed",
      reminderMessages[reminderType] || `Action needed from ${officerName}`,
      {
        priority: NOTIFICATION_PRIORITY.WARNING,
        link: `/lgu-admin/assignments`,
        metadata: {
          complaint_id: complaintId,
          officer_name: officerName,
          reminder_type: reminderType
        }
      }
    );
  }
  /**
   * Notify officer about pending task reminder from admin
   */
  async notifyPendingTaskReminder(officerId, complaintId, complaintTitle, adminMessage) {
    return this.createNotification(
      officerId,
      NOTIFICATION_TYPES.PENDING_TASK_REMINDER,
      "Task Reminder",
      `Admin reminder: ${adminMessage} - "${complaintTitle}"`,
      {
        priority: NOTIFICATION_PRIORITY.WARNING,
        link: `/lgu/tasks/${complaintId}`,
        metadata: { complaint_id: complaintId, admin_message: adminMessage }
      }
    );
  }
  /**
   * Notify citizen that complaint was assigned to officer
   */
  async notifyComplaintAssignedToOfficer(citizenId, complaintId, complaintTitle, officerInfo) {
    return this.createNotification(
      citizenId,
      NOTIFICATION_TYPES.COMPLAINT_ASSIGNED,
      "Complaint Assigned to Officer",
      `Your complaint "${complaintTitle}" has been assigned to an officer and work will begin soon.`,
      {
        priority: NOTIFICATION_PRIORITY.INFO,
        link: `/citizen/complaints/${complaintId}`,
        metadata: {
          complaint_id: complaintId,
          officer_info: officerInfo
        }
      }
    );
  }
  /**
   * Find all complaint coordinators and notify them about new complaint
   * Scans auth.users for users with base_role = complaint-coordinator
   */
  async notifyAllCoordinators(complaintId, complaintTitle) {
    try {
      // Use RPC for efficient lookup
      const { data: coordinators, error } = await this.supabase.rpc("get_users_by_role", {
        p_role: "complaint-coordinator"
      });

      if (error) {
        console.error("[NOTIFICATION] Failed to fetch coordinators via RPC:", error.message);
        return { success: false, error: error.message };
      }
      // console.log removed for security
      if (coordinators.length === 0) {
        console.warn(`[NOTIFICATION] No complaint coordinators found for complaint ${complaintId}`);
        return { success: true, count: 0 };
      }
      // Send notifications to all coordinators
      const notifications = coordinators.map((coordinator) => ({
        userId: coordinator.id,
        type: NOTIFICATION_TYPES.NEW_COMPLAINT_REVIEW,
        title: "New Complaint for Review",
        message: `"${complaintTitle}" needs your review and assignment.`,
        priority: NOTIFICATION_PRIORITY.INFO,
        link: `/coordinator/review/${complaintId}`,
        metadata: {
          complaint_id: complaintId,
          assigned_at: new Date().toISOString()
        }
      }));
      const result = await this.createBulkNotifications(notifications);
      // console.log removed for security
      return result;
    } catch (error) {
      console.error("[NOTIFICATION] notifyAllCoordinators error:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = NotificationService;
