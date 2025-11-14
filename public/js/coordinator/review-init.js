/**
 * Review Page Initialization
 * Handles initialization of false complaint marker and global variables
 * Moved from inline script to comply with Content Security Policy
 */
import FalseComplaintMarker from '/components/complaint/falseComplaintMarker.js';

// Initialize false complaint marker
const falseComplaintMarker = new FalseComplaintMarker();

// Function to open false complaint modal
window.openFalseComplaintModal = function() {
  const pathParts = window.location.pathname.split('/');
  const complaintId = pathParts[pathParts.length - 1];

  if (complaintId && complaintId !== 'review') {
    falseComplaintMarker.show(complaintId, (result) => {
      // Reload the page after marking as false
      window.location.reload();
    });
  } else {
    // Use toast instead of alert for better UX
    import('/js/components/toast.js').then(({ Toast }) => {
      Toast.error('Unable to open false complaint marker. Invalid complaint ID.');
    }).catch(() => {
      // Fallback to console if toast fails
      console.error('Unable to open false complaint marker. Invalid complaint ID.');
    });
  }
};

// Make complaint ID available globally
document.addEventListener('DOMContentLoaded', () => {
  const pathParts = window.location.pathname.split('/');
  window.complaintId = pathParts[pathParts.length - 1];
});

