/**
 * Utility functions for complaint data manipulation
 * Helps reduce redundancy by providing consistent ways to derive data
 */
/**
 * Get the primary department from department_r array
 * @param {Array} departmentR - Array of department codes
 * @returns {string|null} Primary department code or null
 */
function getPrimaryDepartment(departmentR) {
  if (!Array.isArray(departmentR) || departmentR.length === 0) {
    return null;
  }
  return departmentR[0];
}
/**
 * Get secondary departments from department_r array
 * @param {Array} departmentR - Array of department codes
 * @returns {Array} Array of secondary department codes
 */
function getSecondaryDepartments(departmentR) {
  if (!Array.isArray(departmentR) || departmentR.length <= 1) {
    return [];
  }
  return departmentR.slice(1);
}
/**
 * Get status from workflow_status for backward compatibility
 * @param {string} workflowStatus - Current workflow status
 * @returns {string} Legacy status format
 */
function getStatusFromWorkflow(workflowStatus) {
  // Use Map to prevent object injection vulnerabilities
  const statusMap = new Map([
    ['new', 'pending review'],
    ['assigned', 'in progress'],
    ['in_progress', 'in progress'],
    ['pending_approval', 'in progress'],
    ['completed', 'resolved'],
    ['cancelled', 'rejected']
  ]);
  // Safe lookup with Map
  if (workflowStatus && typeof workflowStatus === 'string') {
    return statusMap.get(workflowStatus) || 'pending review';
  }
  return 'pending review';
}
/**
 * Get workflow status from legacy status
 * @param {string} status - Legacy status or workflow status
 * @returns {string} Workflow status
 */
function getWorkflowFromStatus(status) {
  if (!status) return null;

  const statusLower = status.toLowerCase();

  // If it's already a workflow status, return it as-is
  const validWorkflowStatuses = ['new', 'assigned', 'in_progress', 'pending_approval', 'completed', 'cancelled'];
  if (validWorkflowStatuses.includes(statusLower)) {
    return statusLower;
  }

  // Map legacy status values to workflow_status
  const workflowMap = {
    'pending review': 'new',
    'pending': 'new',
    'in progress': 'in_progress',
    'resolved': 'completed',
    'completed': 'completed', // Also handle "completed" as a legacy status
    'rejected': 'cancelled',
    'closed': 'cancelled',
    'cancelled': 'cancelled'
  };

  // Check if it's a confirmation status - these don't map to workflow_status directly
  // but we can return undefined to indicate they need special handling
  const confirmationStatuses = ['waiting_for_responders', 'waiting_for_complainant', 'confirmed', 'disputed'];
  if (confirmationStatuses.includes(statusLower)) {
    // Confirmation statuses are stored in a different field
    // Return a special marker that the controller can handle
    return statusLower; // Return as-is, controller will need to handle this
  }

  // Otherwise, try to map from legacy status
  // Validate input to prevent object injection
  if (statusLower && typeof statusLower === 'string' && statusLower.length < 100) {
    // eslint-disable-next-line security/detect-object-injection
    return workflowMap[statusLower] || null;
  }
  return null;
}
/**
 * Normalize complaint data to reduce redundancy
 * @param {Object} complaint - Raw complaint data
 * @returns {Object} Normalized complaint data
 */
function normalizeComplaintData(complaint) {
  if (!complaint) return null;
  const normalized = { ...complaint };
  // Derive primary and secondary departments from department_r
  normalized.primary_department = getPrimaryDepartment(complaint.department_r);
  // normalized.secondary_departments = getSecondaryDepartments(complaint.department_r); // Removed - derived from department_r
  // Derive status from workflow_status for frontend compatibility
  normalized.status = getStatusFromWorkflow(complaint.workflow_status);
  // Include confirmation status for proper workflow display
  normalized.confirmation_status = complaint.confirmation_status || 'pending';
  // Add assignment progress information
  const progressInfo = getAssignmentProgress(complaint);
  normalized.assignment_progress = progressInfo;
  // Ensure department_r is properly formatted
  if (!Array.isArray(normalized.department_r)) {
    normalized.department_r = [];
  }
  // If we have primary_department but no department_r, populate it
  if (complaint.primary_department && normalized.department_r.length === 0) {
    normalized.department_r = [complaint.primary_department];
    // if (complaint.secondary_departments && Array.isArray(complaint.secondary_departments)) {
    //   normalized.department_r.push(...complaint.secondary_departments);
    // }
  }
  return normalized;
}
/**
 * Get assignment progress information for a complaint
 * @param {Object} complaint - Complaint data with assignments
 * @returns {Object} Progress information
 */
function getAssignmentProgress(complaint) {
  if (!complaint.assignments || !Array.isArray(complaint.assignments)) {
    return {
      totalAssignments: 0,
      completedAssignments: 0,
      progressPercentage: 0,
      progressText: 'No assignments'
    };
  }
  const totalAssignments = complaint.assignments.length;
  const completedAssignments = complaint.assignments.filter(a => a.status === 'completed').length;
  const progressPercentage = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;
  let progressText = '';
  if (totalAssignments === 0) {
    progressText = 'No assignments';
  } else if (completedAssignments === 0) {
    progressText = 'No officers have completed yet';
  } else if (completedAssignments === totalAssignments) {
    progressText = 'All officers completed';
  } else {
    progressText = `${completedAssignments}/${totalAssignments} officers completed`;
  }
  return {
    totalAssignments,
    completedAssignments,
    progressPercentage,
    progressText
  };
}
/**
 * Prepare complaint data for database insertion
 * @param {Object} complaintData - Complaint data from form
 * @returns {Object} Data ready for database insertion
 */
function prepareComplaintForInsert(complaintData) {
  const prepared = { ...complaintData };
  // Ensure workflow_status is set based on status if provided
  if (complaintData.status && !complaintData.workflow_status) {
    prepared.workflow_status = getWorkflowFromStatus(complaintData.status);
  }
  // Ensure department_r is populated from primary_department and secondary_departments
  if (complaintData.primary_department && (!complaintData.department_r || complaintData.department_r.length === 0)) {
    prepared.department_r = [complaintData.primary_department];
    // if (complaintData.secondary_departments && Array.isArray(complaintData.secondary_departments)) {
    //   prepared.department_r.push(...complaintData.secondary_departments);
    // }
  }
  // Remove redundant fields that will be derived
  delete prepared.primary_department;
  delete prepared.secondary_departments;
  delete prepared.status;
  delete prepared.type; // Remove type field - not in current schema
  delete prepared.subtype; // Remove subtype field - not in current schema
  delete prepared.evidence; // Remove evidence field - handled separately
  // Keep category and subcategory fields - they are now part of the schema
  // Note: category and subcategory should be UUIDs referencing categories and subcategories tables
  return prepared;
}
/**
 * Get complaint statistics with normalized data
 * @param {Array} complaints - Array of complaint objects
 * @returns {Object} Statistics object
 */
function getComplaintStatistics(complaints) {
  const stats = {
    total: complaints.length,
    byStatus: {},
    byWorkflowStatus: {},
    byPriority: {},
    byCategory: {}, // Changed from byType to byCategory
    byDepartment: {}
  };
  complaints.forEach(complaint => {
    const normalized = normalizeComplaintData(complaint);
    // Count by status - validate input to prevent injection
    const {status} = normalized;
    if (status && typeof status === 'string' && status.length < 100) {
      // eslint-disable-next-line security/detect-object-injection
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    }
    // Count by workflow status
    const workflowStatus = complaint.workflow_status;
    if (workflowStatus && typeof workflowStatus === 'string' && workflowStatus.length < 100) {
      // eslint-disable-next-line security/detect-object-injection
      stats.byWorkflowStatus[workflowStatus] = (stats.byWorkflowStatus[workflowStatus] || 0) + 1;
    }
    // Count by priority
    const {priority} = complaint;
    if (priority && typeof priority === 'string' && priority.length < 100) {
      // eslint-disable-next-line security/detect-object-injection
      stats.byPriority[priority] = (stats.byPriority[priority] || 0) + 1;
    }
    // Count by category (more meaningful than type)
    const category = complaint.category || 'Uncategorized';
    if (typeof category === 'string' && category.length < 100) {
      stats.byCategory = stats.byCategory || {};
      // eslint-disable-next-line security/detect-object-injection
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    }
    // Count by primary department
    const primaryDept = normalized.primary_department;
    if (primaryDept && typeof primaryDept === 'string' && primaryDept.length < 100) {
      // eslint-disable-next-line security/detect-object-injection
      stats.byDepartment[primaryDept] = (stats.byDepartment[primaryDept] || 0) + 1;
    }
  });
  return stats;
}
/**
 * Validate complaint data consistency
 * @param {Object} complaint - Complaint data to validate
 * @returns {Object} Validation result with errors array
 */
function validateComplaintConsistency(complaint) {
  const errors = [];
  // Check if status and workflow_status are consistent
  if (complaint.status && complaint.workflow_status) {
    const derivedStatus = getStatusFromWorkflow(complaint.workflow_status);
    if (complaint.status !== derivedStatus) {
      errors.push(`Status '${complaint.status}' doesn't match workflow_status '${complaint.workflow_status}' (should be '${derivedStatus}')`);
    }
  }

  // Check if primary_department matches department_r[0]
  if (complaint.primary_department && complaint.department_r && Array.isArray(complaint.department_r)) {
    if (complaint.department_r.length > 0 && complaint.primary_department !== complaint.department_r[0]) {
      errors.push(`Primary department '${complaint.primary_department}' doesn't match department_r[0] '${complaint.department_r[0]}'`);
    }
  }
  // Check if secondary_departments match department_r[1:]
  // if (complaint.secondary_departments && complaint.department_r && Array.isArray(complaint.department_r)) {
  //   const expectedSecondary = complaint.department_r.slice(1);
  //   const actualSecondary = Array.isArray(complaint.secondary_departments) ? complaint.secondary_departments : [];
  //
  //   if (JSON.stringify(expectedSecondary.sort()) !== JSON.stringify(actualSecondary.sort())) {
  //     errors.push(`Secondary departments don't match department_r[1:]`);
  //   }
  // }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  getPrimaryDepartment,
  getSecondaryDepartments,
  getStatusFromWorkflow,
  getWorkflowFromStatus,
  normalizeComplaintData,
  prepareComplaintForInsert,
  getComplaintStatistics,
  validateComplaintConsistency,
  getAssignmentProgress
};
