    // Citizen File Complaint Access Check
import { getActiveRole, isInCitizenMode, canSwitchToCitizen } from '../../src/client/auth/roleToggle.js';
import showMessage from '../../src/client/components/toast.js';

// Check access on page load
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const activeRole = getActiveRole();
    const inCitizenMode = isInCitizenMode();
    
    console.log('[FILE_COMPLAINT] Access check - Role:', activeRole, 'Citizen mode:', inCitizenMode);

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
