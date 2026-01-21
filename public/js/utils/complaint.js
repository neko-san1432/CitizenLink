// Complaint-related utilities (status/priority mappings)

export function getStatusText(status) {
  const statusTexts = {
    unassigned: "Unassigned",
    assigned: "Assigned",
    active: "Active",
    in_progress: "In Progress",
    review: "Under Review",
    completed: "Completed",
    cancelled: "Cancelled",
    waiting_for_responders: "Waiting for responders' confirmation",
    waiting_for_complainant: "Waiting for complainant's confirmation",
    confirmed: "Confirmed by both parties",
    pending: "Pending",
  };
  return statusTexts[status] || status || "Unknown";
}

export function getStatusClass(status) {
  const statusClasses = {
    unassigned:
      "bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300",
    assigned:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    active:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    in_progress:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    review:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    completed:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    waiting_for_responders:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    waiting_for_complainant:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    confirmed:
      "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  };
  return (
    statusClasses[status] ||
    "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400"
  );
}

export function getPriorityClass(priority) {
  const priorityClasses = {
    low: "bg-teal-50 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
    medium: "bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    high: "bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  return (
    priorityClasses[priority] ||
    "bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
  );
}
