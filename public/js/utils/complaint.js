// Complaint-related utilities (status/priority mappings)

export function getStatusText(status) {
  const statusTexts = {
    'unassigned': 'Unassigned',
    'assigned': 'Assigned',
    'active': 'Active',
    'in_progress': 'In Progress',
    'review': 'Under Review',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'waiting_for_responders': "Waiting for responders' confirmation",
    'waiting_for_complainant': "Waiting for complainant's confirmation",
    'confirmed': 'Confirmed by both parties',
    'pending': 'Pending'
  };
  return statusTexts[status] || status || 'Unknown';
}

export function getStatusClass(status) {
  const statusClasses = {
    'unassigned': 'status-unassigned',
    'assigned': 'status-assigned',
    'active': 'status-active',
    'in_progress': 'status-in-progress',
    'review': 'status-review',
    'completed': 'status-completed',
    'cancelled': 'status-cancelled',
    'waiting_for_responders': 'status-waiting',
    'waiting_for_complainant': 'status-waiting',
    'confirmed': 'status-confirmed'
  };
  return statusClasses[status] || 'status-unknown';
}

export function getPriorityClass(priority) {
  const priorityClasses = {
    'low': 'priority-low',
    'medium': 'priority-medium',
    'high': 'priority-high',
    'urgent': 'priority-urgent'
  };
  return priorityClasses[priority] || 'priority-medium';
}




