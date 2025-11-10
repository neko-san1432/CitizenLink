// Centralized Icon System - SVG Icons
// Replaces emoji icons with consistent SVG icons across the application

/**
 * Get SVG icon by name
 * @param {string} iconName - Name of the icon
 * @param {object} options - Icon options (size, color, class)
 * @returns {string} SVG icon HTML
 */
export function getIcon(iconName, options = {}) {
  const {
    size = 20,
    color = 'currentColor',
    className = '',
    strokeWidth = 2
  } = options;

  const icons = {
    // Navigation & Menu
    dashboard: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
    </svg>`,
    fileComplaint: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14,2 14,8 20,8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10,9 9,9 8,9"></polyline>
    </svg>`,
    myProfile: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>`,
    appointAdmins: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>`,
    departments: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9,22 9,12 15,12 15,22"></polyline>
    </svg>`,
    roleChanger: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"></path>
    </svg>`,
    linkGenerator: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>`,
    reviewQueue: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14,2 14,8 20,8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10,9 9,9 8,9"></polyline>
    </svg>`,
    assignments: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M9 11l3 3L22 4"></path>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
    </svg>`,
    heatmap: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M1 6v16l7-5 7 5 7-5V2l-7 5-7-5-7 5z"></path>
      <path d="M8 6v16"></path>
      <path d="M15 2v16"></path>
    </svg>`,
    publish: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      <line x1="9" y1="6" x2="15" y2="6"></line>
      <line x1="9" y1="10" x2="15" y2="10"></line>
    </svg>`,
    taskAssigned: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M9 11l3 3L22 4"></path>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
    </svg>`,
    signout: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
      <polyline points="16,17 21,12 16,7"></polyline>
      <line x1="21" y1="12" x2="9" y2="12"></line>
    </svg>`,
    settings: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24"></path>
    </svg>`,
    darkMode: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>`,

    // Dashboard Types
    hrDashboard: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>`,
    coordinatorDashboard: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
    </svg>`,
    lguAdminDashboard: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9,22 9,12 15,12 15,22"></polyline>
    </svg>`,
    lguOfficerDashboard: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    </svg>`,
    superAdminDashboard: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
      <path d="M2 17l10 5 10-5"></path>
      <path d="M2 12l10 5 10-5"></path>
    </svg>`,

    // Notification Icons
    check: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <polyline points="20,6 9,17 4,12"></polyline>
    </svg>`,
    refresh: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <polyline points="23,4 23,10 17,10"></polyline>
      <polyline points="1,20 1,14 7,14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </svg>`,
    worker: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>`,
    link: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>`,
    x: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>`,
    message: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>`,
    trendingUp: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"></polyline>
      <polyline points="17,6 23,6 23,12"></polyline>
    </svg>`,
    target: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <circle cx="12" cy="12" r="10"></circle>
      <circle cx="12" cy="12" r="6"></circle>
      <circle cx="12" cy="12" r="2"></circle>
    </svg>`,
    search: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <circle cx="11" cy="11" r="8"></circle>
      <path d="M21 21l-4.35-4.35"></path>
    </svg>`,
    clock: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <circle cx="12" cy="12" r="10"></circle>
      <polyline points="12,6 12,12 16,14"></polyline>
    </svg>`,
    alert: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>`,
    bell: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
    </svg>`,
    chart: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <line x1="18" y1="20" x2="18" y2="10"></line>
      <line x1="12" y1="20" x2="12" y2="4"></line>
      <line x1="6" y1="20" x2="6" y2="14"></line>
    </svg>`,
    hand: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M18 11v-1a2 2 0 0 0-2-2h-1"></path>
      <path d="M14 10V9a2 2 0 0 0-2-2h-1"></path>
      <path d="M10 9.5V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v7"></path>
      <path d="M18 11a2 2 0 1 1-4 0v-1a2 2 0 0 1-4 0v-1a2 2 0 0 1-4 0v-1a2 2 0 0 1-4 0v8a6 6 0 0 0 6 6h4a4 4 0 0 0 4-4v-5z"></path>
    </svg>`,
    briefcase: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
    </svg>`,
    arrowUp: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <line x1="12" y1="19" x2="12" y2="5"></line>
      <polyline points="5,12 12,5 19,12"></polyline>
    </svg>`,
    users: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>`,
    welcome: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>`,

    // Activity Icons
    note: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14,2 14,8 20,8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
    </svg>`,
    camera: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
      <circle cx="12" cy="13" r="4"></circle>
    </svg>`,
    calendar: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>`,
    scroll: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14,2 14,8 20,8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10,9 9,9 8,9"></polyline>
    </svg>`,
    megaphone: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M3 11c0-1.1.9-2 2-2h2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7z"></path>
      <path d="M7 11h10l4-4v12l-4-4H7z"></path>
      <path d="M7 15v-4"></path>
    </svg>`,
    map: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2 1,6"></polygon>
      <line x1="8" y1="2" x2="8" y2="18"></line>
      <line x1="16" y1="6" x2="16" y2="22"></line>
    </svg>`,
    file: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="${className}">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
      <polyline points="13,2 13,9 20,9"></polyline>
    </svg>`
  };

  return icons[iconName] || icons.file;
}

/**
 * Get icon HTML for menu items (backward compatibility)
 */
export function getMenuIcon(iconName, options = {}) {
  const iconMap = {
    'dashboard': 'dashboard',
    'fileComplaint': 'fileComplaint',
    'myProfile': 'myProfile',
    'appointAdmins': 'appointAdmins',
    'departments': 'departments',
    'role-changer': 'roleChanger',
    'link-generator': 'linkGenerator',
    'review-queue': 'reviewQueue',
    'assignments': 'assignments',
    'heatmap': 'heatmap',
    'publish': 'publish',
    'taskAssigned': 'taskAssigned',
    'signout': 'signout',
    'settings': 'settings',
    'hr-dashboard': 'hrDashboard',
    'coordinator-dashboard': 'coordinatorDashboard',
    'lgu-admin-dashboard': 'lguAdminDashboard',
    'lgu-officer-dashboard': 'lguOfficerDashboard',
    'super-admin-dashboard': 'superAdminDashboard'
  };

  const mappedName = iconMap[iconName] || 'file';
  return getIcon(mappedName, { size: 20, ...options });
}

/**
 * Get notification icon
 */
export function getNotificationIcon(notificationType, options = {}) {
  const iconMap = {
    'complaint_submitted': 'check',
    'complaint_status_changed': 'refresh',
    'complaint_assigned_to_officer': 'worker',
    'complaint_marked_duplicate': 'link',
    'complaint_resolved': 'check',
    'complaint_rejected': 'x',
    'officer_added_update': 'message',
    'workflow_step_completed': 'trendingUp',
    'lgu_work_completed': 'target',
    'resolution_review_needed': 'search',
    'task_assigned': 'file',
    'task_deadline_approaching': 'clock',
    'task_overdue': 'alert',
    'task_priority_changed': 'alert',
    'coordinator_added_note': 'note',
    'assignment_completed': 'check',
    'admin_reminder_to_complete': 'bell',
    'new_complaint_needs_review': 'search',
    'duplicate_detected': 'link',
    'similar_complaints_found': 'chart',
    'resolution_pending_approval': 'hand',
    'approval_required': 'appointAdmins',
    'officer_assigned_to_department': 'briefcase',
    'complaint_escalated': 'arrowUp',
    'officer_reminder': 'message',
    'pending_task_reminder': 'clock',
    'staff_member_added': 'users',
    'role_change_completed': 'refresh',
    'department_transfer_completed': 'departments',
    'system_alert': 'bell',
    'welcome': 'welcome'
  };

  const iconName = iconMap[notificationType] || 'bell';
  return getIcon(iconName, { size: 18, ...options });
}

/**
 * Get activity icon
 */
export function getActivityIcon(activityType, options = {}) {
  const iconMap = {
    'task_assigned': 'file',
    'task_completed': 'check',
    'task_updated': 'note',
    'note_added': 'note',
    'evidence_uploaded': 'camera',
    'status_updated': 'refresh',
    'status_changed': 'refresh',
    'deadline_approaching': 'clock',
    'general': 'megaphone'
  };

  const iconName = iconMap[activityType] || 'file';
  return getIcon(iconName, { size: 18, ...options });
}

/**
 * Get update icon
 */
export function getUpdateIcon(updateType, options = {}) {
  const iconMap = {
    'announcement': 'megaphone',
    'guideline': 'file',
    'meeting': 'calendar',
    'target': 'target',
    'policy': 'scroll'
  };

  const iconName = iconMap[updateType] || 'megaphone';
  return getIcon(iconName, { size: 18, ...options });
}

