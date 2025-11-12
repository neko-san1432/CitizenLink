// Citizen File Complaint Access Check
import { getActiveRole, isInCitizenMode, canSwitchToCitizen } from '../auth/roleToggle.js';
import { getUserRole } from '../auth/authChecker.js';
import showMessage from '../components/toast.js';

// Check access on page load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Try to get role from authChecker first (same as sidebar)
    let activeRole = null;
    try {
      activeRole = await getUserRole({ refresh: true });
    } catch (error) {
      console.warn('[FILE_COMPLAINT] Failed to get role from authChecker, trying roleToggle:', error);
      activeRole = getActiveRole();
    }
    const inCitizenMode = isInCitizenMode();
    // Allow access only if citizen or in citizen mode
    if (activeRole !== 'citizen' && !inCitizenMode) {
      const canSwitch = await canSwitchToCitizen();
      if (canSwitch) {
        // Show message and redirect to dashboard
        showMessage('warning', 'Please switch to Citizen mode to file a complaint', 5000);
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      } else {
        // Not allowed at all
        showMessage('error', 'Access denied: Only citizens can file complaints', 5000);
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      }
    }
  } catch (error) {
    console.error('[FILE_COMPLAINT] Access check error:', error);
  }
});
