// Application-wide constants

// User Roles
const USER_ROLES = {
  CITIZEN: 'citizen',
  LGU: 'lgu',
  LGU_ADMIN: 'lgu-admin',
  SUPER_ADMIN: 'super-admin'
};

// Complaint Statuses
const COMPLAINT_STATUS = {
  PENDING_REVIEW: 'pending review',
  IN_PROGRESS: 'in progress',
  RESOLVED: 'resolved',
  REJECTED: 'rejected',
  CLOSED: 'closed'
};

// Workflow Statuses
const WORKFLOW_STATUS = {
  NEW: 'new',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  PENDING_APPROVAL: 'pending_approval',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Priority Levels
const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

// Complaint Types
const COMPLAINT_TYPES = {
  INFRASTRUCTURE: 'infrastructure',
  PUBLIC_SAFETY: 'public-safety',
  ENVIRONMENTAL: 'environmental',
  HEALTH: 'health',
  TRAFFIC: 'traffic',
  NOISE: 'noise',
  UTILITIES: 'utilities',
  SERVICES: 'services',
  OTHER: 'other'
};

// File Upload Constants
const FILE_UPLOAD = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_FILES: 5,
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.mp4']
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
    COMPLAINT_SUBMITTED: 'Complaint submitted successfully',
    COMPLAINT_UPDATED: 'Complaint updated successfully',
    DEPARTMENT_CREATED: 'Department created successfully',
    DEPARTMENT_UPDATED: 'Department updated successfully',
    SETTING_UPDATED: 'Setting updated successfully'
  },
  ERROR: {
    INVALID_INPUT: 'Invalid input provided',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access denied',
    NOT_FOUND: 'Resource not found',
    INTERNAL_ERROR: 'Internal server error',
    VALIDATION_FAILED: 'Validation failed'
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

module.exports = {
  USER_ROLES,
  COMPLAINT_STATUS,
  WORKFLOW_STATUS,
  PRIORITY_LEVELS,
  COMPLAINT_TYPES,
  FILE_UPLOAD,
  PAGINATION,
  MESSAGES,
  VALIDATION
};
