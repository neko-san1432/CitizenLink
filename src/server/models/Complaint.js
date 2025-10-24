class Complaint {
  constructor(data = {}) {
    this.id = data.id;
    this.submitted_by = data.submitted_by;
    this.title = data.title;
    this.descriptive_su = data.descriptive_su;
    this.location_text = data.location_text;
    this.latitude = data.latitude;
    this.longitude = data.longitude;
    this.department_r = data.department_r || [];
    this.workflow_status = data.workflow_status || 'new';
    this.priority = data.priority || 'low';
    // Evidence is now handled separately - not stored in complaints table
    // this.evidence = data.evidence || [];
    // this.primary_department = data.primary_department; // Removed - derived from department_r
    // this.secondary_departments = data.secondary_departments || []; // Removed - derived from department_r
    this.assigned_coordinator_id = data.assigned_coordinator_id;
    this.response_deadline = data.response_deadline;
    this.citizen_satisfaction_rating = data.citizen_satisfaction_rating;
    this.is_duplicate = data.is_duplicate || false;
    this.master_complaint_id = data.master_complaint_id;
    this.task_force_id = data.task_force_id;
    this.coordinator_notes = data.coordinator_notes;
    this.estimated_resolution_date = data.estimated_resolution_date;
    this.submitted_at = data.submitted_at;
    this.updated_at = data.updated_at;
  }

  static validate(data) {
    const errors = [];

    if (!data.title || data.title.trim().length < 5) {
      errors.push('Title must be at least 5 characters');
    }

    if (!data.descriptive_su || data.descriptive_su.trim().length < 10) {
      errors.push('Description must be at least 10 characters');
    }

    if (!data.location_text || data.location_text.trim().length < 5) {
      errors.push('Location must be at least 5 characters');
    }

    if (data.latitude && (data.latitude < -90 || data.latitude > 90)) {
      errors.push('Invalid latitude value');
    }

    if (data.longitude && (data.longitude < -180 || data.longitude > 180)) {
      errors.push('Invalid longitude value');
    }

    const validStatuses = ['pending review', 'in progress', 'resolved', 'closed', 'rejected'];
    if (data.status && !validStatuses.includes(data.status)) {
      errors.push('Invalid status');
    }

    const validWorkflowStatuses = ['new', 'assigned', 'in_progress', 'pending_approval', 'completed', 'cancelled'];
    if (data.workflow_status && !validWorkflowStatuses.includes(data.workflow_status)) {
      errors.push('Invalid workflow status');
    }

    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (data.priority && !validPriorities.includes(data.priority)) {
      errors.push('Invalid priority');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  sanitizeForInsert() {
    return {
      submitted_by: this.submitted_by,
      title: this.title?.trim(),
      descriptive_su: this.descriptive_su?.trim(),
      location_text: this.location_text?.trim(),
      latitude: this.latitude ? parseFloat(this.latitude) : null,
      longitude: this.longitude ? parseFloat(this.longitude) : null,
      department_r: Array.isArray(this.department_r) ? this.department_r : [],
      workflow_status: this.workflow_status || 'new',
      priority: this.priority || 'low',
      // evidence: this.evidence || [], // Evidence handled separately
      // primary_department: this.primary_department || null, // Removed - derived from department_r
      // secondary_departments: this.secondary_departments || [], // Removed - derived from department_r
      assigned_coordinator_id: this.assigned_coordinator_id || null,
      response_deadline: this.response_deadline || null,
      submitted_at: this.submitted_at || new Date().toISOString()
    };
  }

  toJSON() {
    return {
      id: this.id,
      submitted_by: this.submitted_by,
      title: this.title,
      descriptive_su: this.descriptive_su,
      location_text: this.location_text,
      latitude: this.latitude,
      longitude: this.longitude,
      department_r: this.department_r,
      workflow_status: this.workflow_status,
      priority: this.priority,
      // evidence: this.evidence, // Evidence handled separately
      // primary_department: this.primary_department, // Removed - derived from department_r
      // secondary_departments: this.secondary_departments, // Removed - derived from department_r
      assigned_coordinator_id: this.assigned_coordinator_id,
      response_deadline: this.response_deadline,
      citizen_satisfaction_rating: this.citizen_satisfaction_rating,
      is_duplicate: this.is_duplicate,
      master_complaint_id: this.master_complaint_id,
      task_force_id: this.task_force_id,
      coordinator_notes: this.coordinator_notes,
      estimated_resolution_date: this.estimated_resolution_date,
      submitted_at: this.submitted_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = Complaint;

