// Application-wide constants
// User Roles - Simple Workflow Mode (3 roles only)
// Legacy roles (lgu-admin, lgu-hr, complaint-coordinator) are normalized to 'lgu'
const USER_ROLES = {
  CITIZEN: "citizen",
  LGU: "lgu", // All LGU staff - includes legacy lgu-admin, lgu-hr, complaint-coordinator
  SUPER_ADMIN: "super-admin"
};

// Strict Mode: Allowed Roles
// Only these roles are permitted when ENABLE_LEGACY_ROLES=false
const ALLOWED_ROLES = ["citizen", "lgu", "super-admin"];
// Role Hierarchy (for permission checks)
// Simple Workflow Mode: Only 3 levels
const ROLE_HIERARCHY = {
  "citizen": 0,
  "lgu": 1,
  "super-admin": 2
};

// Roles that can file complaints (or switch to citizen mode)
const COMPLAINT_ROLES = ["citizen"];

// Roles that can switch to citizen mode
// Note: Use pattern matching for LGU roles (e.g., role.startsWith('lgu-'))
// Roles that can switch to citizen mode
// Note: Use pattern matching for LGU roles (e.g., role.startsWith('lgu-'))
const SWITCHABLE_ROLES = [
  "lgu", // Unified LGU role
  "super-admin"
];
// Complaint Statuses
const COMPLAINT_STATUS = {
  PENDING_REVIEW: "pending review",
  IN_PROGRESS: "in progress",
  RESOLVED: "resolved",
  REJECTED: "rejected",
  CLOSED: "closed"
};
// Workflow Statuses
const WORKFLOW_STATUS = {
  NEW: "new",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  PENDING_APPROVAL: "pending_approval",
  COMPLETED: "completed",
  CANCELLED: "cancelled"
};
// Priority Levels
const PRIORITY_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent"
};
// Complaint Types
const COMPLAINT_TYPES = {
  INFRASTRUCTURE: "infrastructure",
  PUBLIC_SAFETY: "public-safety",
  ENVIRONMENTAL: "environmental",
  HEALTH: "health",
  TRAFFIC: "traffic",
  NOISE: "noise",
  UTILITIES: "utilities",
  SERVICES: "services",
  OTHER: "other"
};
// File Upload Constants
const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES: 5,
  ALLOWED_TYPES: ["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4"],
  ALLOWED_EXTENSIONS: [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".mp4"]
};
// Pagination Constants
const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  DEFAULT_PAGE: 1
};
// API Response Messages
const MESSAGES = {
  SUCCESS: {
    COMPLAINT_SUBMITTED: "Complaint submitted successfully",
    COMPLAINT_UPDATED: "Complaint updated successfully",
    DEPARTMENT_CREATED: "Department created successfully",
    DEPARTMENT_UPDATED: "Department updated successfully",
    SETTING_UPDATED: "Setting updated successfully"
  },
  ERROR: {
    INVALID_INPUT: "Invalid input provided",
    UNAUTHORIZED: "Unauthorized access",
    FORBIDDEN: "Access denied",
    NOT_FOUND: "Resource not found",
    INTERNAL_ERROR: "Internal server error",
    VALIDATION_FAILED: "Validation failed"
  }
};
// Validation Rules
const VALIDATION = {
  MIN_TITLE_LENGTH: 5,
  MIN_DESCRIPTION_LENGTH: 10,
  MIN_LOCATION_LENGTH: 5,
  MIN_DEPARTMENT_NAME_LENGTH: 2,
  MIN_DEPARTMENT_CODE_LENGTH: 2,
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_LOCATION_LENGTH: 500
};
// Notification Types
const NOTIFICATION_TYPES = {
  // Citizen notifications
  COMPLAINT_SUBMITTED: "complaint_submitted",
  COMPLAINT_STATUS_CHANGED: "complaint_status_changed",
  COMPLAINT_ASSIGNED: "complaint_assigned_to_officer",
  COMPLAINT_DUPLICATE: "complaint_marked_duplicate",
  COMPLAINT_RESOLVED: "complaint_resolved",
  COMPLAINT_REJECTED: "complaint_rejected",
  OFFICER_UPDATE: "officer_added_update",
  WORKFLOW_STEP_COMPLETED: "workflow_step_completed",
  LGU_WORK_COMPLETED: "lgu_work_completed",
  RESOLUTION_REVIEW_NEEDED: "resolution_review_needed",
  // Officer notifications
  TASK_ASSIGNED: "task_assigned",
  TASK_DEADLINE_APPROACHING: "task_deadline_approaching",
  TASK_OVERDUE: "task_overdue",
  TASK_PRIORITY_CHANGED: "task_priority_changed",
  COORDINATOR_NOTE: "coordinator_added_note",
  ASSIGNMENT_COMPLETED: "assignment_completed",
  ADMIN_REMINDER: "admin_reminder_to_complete",
  // Coordinator notifications
  NEW_COMPLAINT_REVIEW: "new_complaint_needs_review",
  DUPLICATE_DETECTED: "duplicate_detected",
  SIMILAR_COMPLAINTS: "similar_complaints_found",
  RESOLUTION_PENDING_APPROVAL: "resolution_pending_approval",
  // Admin notifications
  APPROVAL_REQUIRED: "approval_required",
  OFFICER_ASSIGNED_DEPARTMENT: "officer_assigned_to_department",
  COMPLAINT_ESCALATED: "complaint_escalated",
  OFFICER_REMINDER: "officer_reminder",
  PENDING_TASK_REMINDER: "pending_task_reminder",
  // HR notifications
  STAFF_ADDED: "staff_member_added",
  ROLE_CHANGE_COMPLETED: "role_change_completed",
  DEPARTMENT_TRANSFER_COMPLETED: "department_transfer_completed",
  // System notifications
  SYSTEM_ALERT: "system_alert",
  WELCOME: "welcome"
};
// Notification Priorities
const NOTIFICATION_PRIORITY = {
  INFO: "info",
  WARNING: "warning",
  URGENT: "urgent"
};
// Notification Icons (by type)
const NOTIFICATION_ICONS = {
  [NOTIFICATION_TYPES.COMPLAINT_SUBMITTED]: "✅",
  [NOTIFICATION_TYPES.COMPLAINT_STATUS_CHANGED]: "🔄",
  [NOTIFICATION_TYPES.COMPLAINT_ASSIGNED]: "👷",
  [NOTIFICATION_TYPES.COMPLAINT_DUPLICATE]: "🔗",
  [NOTIFICATION_TYPES.COMPLAINT_RESOLVED]: "✔️",
  [NOTIFICATION_TYPES.COMPLAINT_REJECTED]: "❌",
  [NOTIFICATION_TYPES.OFFICER_UPDATE]: "💬",
  [NOTIFICATION_TYPES.WORKFLOW_STEP_COMPLETED]: "📈",
  [NOTIFICATION_TYPES.LGU_WORK_COMPLETED]: "🎯",
  [NOTIFICATION_TYPES.RESOLUTION_REVIEW_NEEDED]: "🔍",
  [NOTIFICATION_TYPES.TASK_ASSIGNED]: "📋",
  [NOTIFICATION_TYPES.TASK_DEADLINE_APPROACHING]: "⏰",
  [NOTIFICATION_TYPES.TASK_OVERDUE]: "🚨",
  [NOTIFICATION_TYPES.TASK_PRIORITY_CHANGED]: "⚠️",
  [NOTIFICATION_TYPES.COORDINATOR_NOTE]: "📝",
  [NOTIFICATION_TYPES.ASSIGNMENT_COMPLETED]: "✅",
  [NOTIFICATION_TYPES.ADMIN_REMINDER]: "🔔",
  [NOTIFICATION_TYPES.NEW_COMPLAINT_REVIEW]: "🔍",
  [NOTIFICATION_TYPES.DUPLICATE_DETECTED]: "🔗",
  [NOTIFICATION_TYPES.SIMILAR_COMPLAINTS]: "📊",
  [NOTIFICATION_TYPES.RESOLUTION_PENDING_APPROVAL]: "✋",
  [NOTIFICATION_TYPES.APPROVAL_REQUIRED]: "🔐",
  [NOTIFICATION_TYPES.OFFICER_ASSIGNED_DEPARTMENT]: "👔",
  [NOTIFICATION_TYPES.COMPLAINT_ESCALATED]: "⬆️",
  [NOTIFICATION_TYPES.OFFICER_REMINDER]: "💬",
  [NOTIFICATION_TYPES.PENDING_TASK_REMINDER]: "⏰",
  [NOTIFICATION_TYPES.STAFF_ADDED]: "👥",
  [NOTIFICATION_TYPES.ROLE_CHANGE_COMPLETED]: "🔄",
  [NOTIFICATION_TYPES.DEPARTMENT_TRANSFER_COMPLETED]: "🏢",
  [NOTIFICATION_TYPES.SYSTEM_ALERT]: "🔔",
  [NOTIFICATION_TYPES.WELCOME]: "👋"
};

module.exports = {
  USER_ROLES,
  ROLE_HIERARCHY,
  COMPLAINT_ROLES,
  SWITCHABLE_ROLES,
  COMPLAINT_STATUS,
  WORKFLOW_STATUS,
  PRIORITY_LEVELS,
  COMPLAINT_TYPES,
  FILE_UPLOAD,
  PAGINATION,
  MESSAGES,
  VALIDATION,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_ICONS,
  ALLOWED_ROLES
};
