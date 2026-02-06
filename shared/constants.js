// Shared constants used across the application
// This file defines all the notification types, priorities, and other constants
const NOTIFICATION_TYPES = {
  // Complaint-related notifications
  COMPLAINT_SUBMITTED: "complaint_submitted",
  COMPLAINT_STATUS_CHANGED: "complaint_status_changed",
  COMPLAINT_DUPLICATE: "complaint_duplicate",
  COMPLAINT_ASSIGNED: "complaint_assigned",
  COMPLAINT_RESOLVED: "complaint_resolved",
  // Task/Assignment notifications
  TASK_ASSIGNED: "task_assigned",
  TASK_COMPLETED: "task_completed",
  TASK_OVERDUE: "task_overdue",
  TASK_DEADLINE_APPROACHING: "task_deadline_approaching",
  ASSIGNMENT_COMPLETED: "assignment_completed",
  // Coordinator notifications
  NEW_COMPLAINT_REVIEW: "new_complaint_review",
  APPROVAL_REQUIRED: "approval_required",
  // Admin notifications
  OFFICER_REMINDER: "officer_reminder",
  ADMIN_REMINDER: "admin_reminder",
  PENDING_TASK_REMINDER: "pending_task_reminder",
  // Workflow notifications
  WORKFLOW_STEP_COMPLETED: "workflow_step_completed",
  LGU_WORK_COMPLETED: "lgu_work_completed",
  RESOLUTION_REVIEW_NEEDED: "resolution_review_needed",
  COMPLAINT_UPDATE: "complaint_update"
};
const NOTIFICATION_PRIORITY = {
  INFO: "info",
  WARNING: "warning",
  URGENT: "urgent"
};
const NOTIFICATION_ICONS = {
  [NOTIFICATION_TYPES.COMPLAINT_SUBMITTED]: "📝",
  [NOTIFICATION_TYPES.COMPLAINT_STATUS_CHANGED]: "🔄",
  [NOTIFICATION_TYPES.COMPLAINT_DUPLICATE]: "🔗",
  [NOTIFICATION_TYPES.COMPLAINT_ASSIGNED]: "👤",
  [NOTIFICATION_TYPES.COMPLAINT_RESOLVED]: "✅",
  [NOTIFICATION_TYPES.TASK_ASSIGNED]: "📋",
  [NOTIFICATION_TYPES.TASK_COMPLETED]: "✅",
  [NOTIFICATION_TYPES.TASK_OVERDUE]: "⏰",
  [NOTIFICATION_TYPES.TASK_DEADLINE_APPROACHING]: "⚠️",
  [NOTIFICATION_TYPES.ASSIGNMENT_COMPLETED]: "🎯",
  [NOTIFICATION_TYPES.NEW_COMPLAINT_REVIEW]: "👀",
  [NOTIFICATION_TYPES.APPROVAL_REQUIRED]: "👍",
  [NOTIFICATION_TYPES.OFFICER_REMINDER]: "🔔",
  [NOTIFICATION_TYPES.ADMIN_REMINDER]: "📢",
  [NOTIFICATION_TYPES.PENDING_TASK_REMINDER]: "⏳",
  [NOTIFICATION_TYPES.WORKFLOW_STEP_COMPLETED]: "➡️",
  [NOTIFICATION_TYPES.LGU_WORK_COMPLETED]: "🏗️",
  [NOTIFICATION_TYPES.RESOLUTION_REVIEW_NEEDED]: "👁️",
  [NOTIFICATION_TYPES.COMPLAINT_UPDATE]: "💬"
};

module.exports = {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_ICONS
};
