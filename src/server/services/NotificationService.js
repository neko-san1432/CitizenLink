const Database = require("../config/database");

const {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_ICONS
} = require("../../shared/constants");

const NotificationCreateService = require("./notification/NotificationCreateService");
const NotificationReadService = require("./notification/NotificationReadService");

class NotificationService {
  constructor() {
    this.db = Database.getInstance();
    this.supabase = this.db.getClient();

    this.createService = new NotificationCreateService(this.supabase);
    this.readService = new NotificationReadService(this.supabase);
  }

  // ==================== CREATE METHODS ====================
  async createNotification(userIdOrOptions, type, title, message, options = {}) {
    return await this.createService.createNotification(userIdOrOptions, type, title, message, options);
  }

  async createBulkNotifications(notifications, deduplicate = true) {
    return await this.createService.createBulkNotifications(notifications, deduplicate);
  }

  async notifydepartmentAdminsByCode(departmentCode, complaintId, complaintTitle) {
    try {
      const { data: admins, error } = await this.supabase.rpc("get_users_by_role", {
        p_role: "lgu",
        p_department: departmentCode
      });

      if (error || !admins?.length) {
        return { success: true, count: 0 };
      }

      const notifications = admins.map((admin) => ({
        userId: admin.id,
        type: NOTIFICATION_TYPES.APPROVAL_REQUIRED,
        title: "New Complaint Assigned to Your Department",
        message: `"${complaintTitle}" has been assigned to ${departmentCode}. Please review and assign to an officer.`,
        priority: NOTIFICATION_PRIORITY.INFO,
        link: `/assignments`,
        metadata: { complaint_id: complaintId, department: departmentCode, assigned_at: new Date().toISOString() }
      }));

      return await this.createBulkNotifications(notifications);
    } catch (error) {
      console.error("[NOTIFICATION] notifydepartmentAdminsByCode error:", error);
      return { success: false, error: error.message };
    }
  }

  async checkDuplicateNotification(userId, type, title, metadata = {}) {
    return await this.createService.checkDuplicateNotification(userId, type, title, metadata);
  }

  async notifyMultipleUsers(userIds, type, title, message, options = {}) {
    const notifications = userIds.map(userId => ({ userId, type, title, message, ...options }));
    return await this.createBulkNotifications(notifications, true);
  }

  async notifycomplaintSubmitted(citizenId, complaintId, complaintTitle) {
    return this.createNotification({
      userId: citizenId,
      type: NOTIFICATION_TYPES.COMPLAINT_SUBMITTED,
      title: "Complaint Submitted",
      message: `Your complaint "${complaintTitle}" has been received and is being reviewed.`,
      priority: NOTIFICATION_PRIORITY.INFO,
      link: `/citizen/complaints/${complaintId}`,
      metadata: { complaint_id: complaintId }
    });
  }

  async notifycomplaintStatusChanged(citizenId, complaintId, complaintTitle, newStatus, oldStatus) {
    const statusMessages = {
      "submitted": "has been submitted and is awaiting review",
      "verified": "has been verified by a coordinator",
      "assigned": "has been assigned to a department officer",
      "under_review": "is now under review",
      "in_progress": "is now being worked on",
      "action_taken": "has had action taken",
      "pending_approval": "is pending approval",
      "completed": "work has been completed, awaiting your confirmation",
      "resolved": "has been resolved",
      "rejected": "has been rejected",
      "cancelled": "has been cancelled",
      "closed": "has been closed"
    };

    const priority = newStatus === "resolved" ? NOTIFICATION_PRIORITY.INFO :
      newStatus === "rejected" ? NOTIFICATION_PRIORITY.WARNING :
        NOTIFICATION_PRIORITY.INFO;

    return this.createNotification({
      userId: citizenId,
      type: NOTIFICATION_TYPES.COMPLAINT_STATUS_CHANGED,
      title: "Complaint Status Updated",
      message: `Your complaint "${complaintTitle}" ${statusMessages[newStatus] || `status changed to ${newStatus}`}.`,
      priority,
      link: `/citizen/complaints/${complaintId}`,
      metadata: { complaint_id: complaintId, old_status: oldStatus, new_status: newStatus }
    });
  }

  async notifyTaskAssigned(officerId, complaintId, complaintTitle, priority, deadline) {
    const notifPriority = priority === "urgent" ? NOTIFICATION_PRIORITY.URGENT :
      priority === "high" ? NOTIFICATION_PRIORITY.WARNING :
        NOTIFICATION_PRIORITY.INFO;

    return this.createNotification({
      userId: officerId,
      type: NOTIFICATION_TYPES.TASK_ASSIGNED,
      title: "New Task Assigned",
      message: `You've been assigned: "${complaintTitle}"${deadline ? ` - Due: ${new Date(deadline).toLocaleDateString()}` : ""}`,
      priority: notifPriority,
      link: `/lgu/tasks/${complaintId}`,
      metadata: { complaint_id: complaintId, priority, deadline }
    });
  }

  async notifyDeadlineApproaching(officerId, complaintId, complaintTitle, hoursRemaining) {
    return this.createNotification({
      userId: officerId,
      type: NOTIFICATION_TYPES.TASK_DEADLINE_APPROACHING,
      title: "Deadline Approaching",
      message: `"${complaintTitle}" is due in ${hoursRemaining} hours!`,
      priority: hoursRemaining <= 12 ? NOTIFICATION_PRIORITY.URGENT : NOTIFICATION_PRIORITY.WARNING,
      link: `/lgu/tasks/${complaintId}`,
      metadata: { complaint_id: complaintId, hours_remaining: hoursRemaining }
    });
  }

  async notifyTaskOverdue(officerId, complaintId, complaintTitle) {
    return this.createNotification({
      userId: officerId,
      type: NOTIFICATION_TYPES.TASK_OVERDUE,
      title: "Task Overdue",
      message: `"${complaintTitle}" is now overdue! Please update status immediately.`,
      priority: NOTIFICATION_PRIORITY.URGENT,
      link: `/lgu/tasks/${complaintId}`,
      metadata: { complaint_id: complaintId }
    });
  }

  async notifyNewcomplaintReview(coordinatorId, complaintId, complaintTitle) {
    return this.createNotification({
      userId: coordinatorId,
      type: NOTIFICATION_TYPES.NEW_COMPLAINT_REVIEW,
      title: "New Complaint for Review",
      message: `"${complaintTitle}" needs your review and assignment.`,
      priority: NOTIFICATION_PRIORITY.INFO,
      link: `/coordinator/review/${complaintId}`,
      metadata: { complaint_id: complaintId }
    });
  }

  async notifycomplaintDuplicate(citizenId, complaintId, complaintTitle, mastercomplaintId) {
    return this.createNotification({
      userId: citizenId,
      type: NOTIFICATION_TYPES.COMPLAINT_DUPLICATE,
      title: "Complaint Linked to Existing Issue",
      message: `Your complaint "${complaintTitle}" has been linked to an existing similar complaint. Updates will be shared.`,
      priority: NOTIFICATION_PRIORITY.INFO,
      link: `/citizen/complaints/${mastercomplaintId}`,
      metadata: { complaint_id: complaintId, master_complaint_id: mastercomplaintId }
    });
  }

  async notifyAssignmentCompleted(officerId, complaintId, complaintTitle) {
    return this.createNotification({
      userId: officerId,
      type: NOTIFICATION_TYPES.ASSIGNMENT_COMPLETED,
      title: "Assignment Completed",
      message: `Your assignment for "${complaintTitle}" has been completed by another officer.`,
      priority: NOTIFICATION_PRIORITY.INFO,
      link: `/lgu/tasks/${complaintId}`,
      metadata: { complaint_id: complaintId }
    });
  }

  async notifyAdminReminder(officerId, complaintId, complaintTitle, reminderMessage) {
    return this.createNotification({
      userId: officerId,
      type: NOTIFICATION_TYPES.ADMIN_REMINDER,
      title: "Reminder from Admin",
      message: `Admin reminder: ${reminderMessage} - "${complaintTitle}"`,
      priority: NOTIFICATION_PRIORITY.WARNING,
      link: `/lgu/tasks/${complaintId}`,
      metadata: { complaint_id: complaintId, reminder_type: "admin_reminder" }
    });
  }

  async notifyWorkflowStepCompleted(citizenId, complaintId, complaintTitle, stepDescription) {
    return this.createNotification({
      userId: citizenId,
      type: NOTIFICATION_TYPES.WORKFLOW_STEP_COMPLETED,
      title: "Progress Update",
      message: `Progress on "${complaintTitle}": ${stepDescription}`,
      priority: NOTIFICATION_PRIORITY.INFO,
      link: `/citizen/complaints/${complaintId}`,
      metadata: { complaint_id: complaintId, step: stepDescription }
    });
  }

  async notifyLguWorkCompleted(citizenId, complaintId, complaintTitle) {
    return this.createNotification({
      userId: citizenId,
      type: NOTIFICATION_TYPES.LGU_WORK_COMPLETED,
      title: "Work Completed - Please Review",
      message: `The assigned LGU departments have completed their work on "${complaintTitle}". Please review and confirm resolution.`,
      priority: NOTIFICATION_PRIORITY.INFO,
      link: `/citizen/complaints/${complaintId}`,
      metadata: { complaint_id: complaintId, action_required: "review_resolution" }
    });
  }

  async notifyResolutionReviewNeeded(citizenId, complaintId, complaintTitle) {
    return this.createNotification({
      userId: citizenId,
      type: NOTIFICATION_TYPES.RESOLUTION_REVIEW_NEEDED,
      title: "Review Required",
      message: `Please review the completed work for "${complaintTitle}" and mark as resolved if satisfied.`,
      priority: NOTIFICATION_PRIORITY.INFO,
      link: `/citizen/complaints/${complaintId}`,
      metadata: { complaint_id: complaintId, action_required: "mark_resolved" }
    });
  }

  async notifyOfficerReminder(adminId, officerName, complaintId, complaintTitle, reminderType) {
    const reminderMessages = {
      pending_task: `${officerName} has a pending task that needs attention`,
      complete_assignment: `${officerName} needs to mark their assignment as complete`,
      overdue_task: `${officerName} has an overdue task that requires immediate action`
    };

    return this.createNotification({
      userId: adminId,
      type: NOTIFICATION_TYPES.OFFICER_REMINDER,
      title: "Officer Reminder Needed",
      message: reminderMessages[reminderType] || `Action needed from ${officerName}`,
      priority: NOTIFICATION_PRIORITY.WARNING,
      link: `/assignments`,
      metadata: { complaint_id: complaintId, officer_name: officerName, reminder_type: reminderType }
    });
  }

  async notifyPendingTaskReminder(officerId, complaintId, complaintTitle, adminMessage) {
    return this.createNotification({
      userId: officerId,
      type: NOTIFICATION_TYPES.PENDING_TASK_REMINDER,
      title: "Task Reminder",
      message: `Admin reminder: ${adminMessage} - "${complaintTitle}"`,
      priority: NOTIFICATION_PRIORITY.WARNING,
      link: `/lgu/tasks/${complaintId}`,
      metadata: { complaint_id: complaintId, admin_message: adminMessage }
    });
  }

  async notifycomplaintAssignedToOfficer(citizenId, complaintId, complaintTitle, officerInfo) {
    return this.createNotification({
      userId: citizenId,
      type: NOTIFICATION_TYPES.COMPLAINT_ASSIGNED,
      title: "Complaint Assigned to Officer",
      message: `Your complaint "${complaintTitle}" has been assigned to an officer and work will begin soon.`,
      priority: NOTIFICATION_PRIORITY.INFO,
      link: `/citizen/complaints/${complaintId}`,
      metadata: { complaint_id: complaintId, officer_info: officerInfo }
    });
  }

  async notifyAllCoordinators(complaintId, complaintTitle) {
    try {
      const { data: coordinators, error } = await this.supabase.rpc("get_users_by_role", {
        p_role: "lgu"
      });

      if (error || !coordinators?.length) {
        return { success: true, count: 0 };
      }

      const notifications = coordinators.map((coordinator) => ({
        userId: coordinator.id,
        type: NOTIFICATION_TYPES.NEW_COMPLAINT_REVIEW,
        title: "New Complaint for Review",
        message: `"${complaintTitle}" needs your review and assignment.`,
        priority: NOTIFICATION_PRIORITY.INFO,
        link: `/coordinator/review/${complaintId}`,
        metadata: { complaint_id: complaintId, assigned_at: new Date().toISOString() }
      }));

      return await this.createBulkNotifications(notifications);
    } catch (error) {
      console.error("[NOTIFICATION] notifyAllCoordinators error:", error);
      return { success: false, error: error.message };
    }
  }

  async notifycomplaintUpdate(citizenId, complaintId, complaintTitle, message) {
    return this.createNotification({
      userId: citizenId,
      type: NOTIFICATION_TYPES.COMPLAINT_UPDATE,
      title: "Update on Your Complaint",
      message: `A new update was added to "${complaintTitle}": ${message.substring(0, 50)}${message.length > 50 ? "..." : ""}`,
      priority: NOTIFICATION_PRIORITY.INFO,
      link: `/citizen/complaints/${complaintId}`,
      metadata: { complaint_id: complaintId }
    });
  }

  // ==================== READ METHODS ====================
  async getUserNotifications(userId, page = 0, limit = 10) {
    return await this.readService.getUserNotifications(userId, page, limit);
  }

  async getUnreadCount(userId) {
    return await this.readService.getUnreadCount(userId);
  }

  async markAsRead(notificationId, userId) {
    return await this.readService.markAsRead(notificationId, userId);
  }

  async markAllAsRead(userId) {
    return await this.readService.markAllAsRead(userId);
  }

  async deleteNotification(notificationId, userId) {
    return await this.readService.deleteNotification(notificationId, userId);
  }

  async getNotificationSummary(userId) {
    return await this.readService.getNotificationSummary(userId);
  }

  async deleteExpiredNotifications() {
    try {
      const { data, error } = await this.supabase
        .from("notification")
        .delete()
        .lt("expires_at", new Date().toISOString())
        .select();

      if (error) throw error;
      return { success: true, deleted: data?.length || 0 };
    } catch (error) {
      console.error("[NOTIFICATION] Delete expired error:", error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = NotificationService;
