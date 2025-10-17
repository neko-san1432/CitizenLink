// Index/landing page specific functionality
import { supabase } from '../config/config.js';
import { logout } from './authChecker.js';

// Track if logout event listener has been added
let logoutListenerAdded = false;

// Check authentication status and update UI
const checkAuthenticationAndUpdateUI = async () => {
  try {
    console.log('🔍 Checking authentication status on landing page...');

    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();

    const unauthenticatedButtons = document.getElementById('unauthenticated-buttons');
    const authenticatedButtons = document.getElementById('authenticated-buttons');
    const logoutBtn = document.getElementById('logout-btn');

    if (session && !error) {
      console.log('✅ User is authenticated, showing dashboard button');

      // Get user metadata
      const user = session.user;
      const role = user?.user_metadata?.role || '';
      const name = user?.user_metadata?.name || '';

      // Check if user has completed registration
      if (role && name) {
        console.log('🎯 Profile complete, showing dashboard access for role:', role);

        // Hide login/signup buttons, show dashboard button
        if (unauthenticatedButtons) unauthenticatedButtons.style.display = 'none';
        if (authenticatedButtons) authenticatedButtons.style.display = 'block';

        // Add logout functionality (only once)
        if (logoutBtn && !logoutListenerAdded) {
          logoutBtn.addEventListener('click', async () => {
            console.log('🚪 Logging out user...');
            await logout();
          });
          logoutListenerAdded = true;
        }
      } else {
        console.log('❌ User profile incomplete, keeping login/signup buttons visible');
        // Profile incomplete, keep showing login/signup for profile completion
        if (unauthenticatedButtons) unauthenticatedButtons.style.display = 'block';
        if (authenticatedButtons) authenticatedButtons.style.display = 'none';
      }
    } else {
      console.log('❌ User not authenticated, showing login/signup buttons');

      // Show login/signup buttons, hide dashboard button
      if (unauthenticatedButtons) unauthenticatedButtons.style.display = 'block';
      if (authenticatedButtons) authenticatedButtons.style.display = 'none';
    }
  } catch (error) {
    console.error('💥 Authentication check failed:', error);

    // On error, default to showing login/signup buttons
    const unauthenticatedButtons = document.getElementById('unauthenticated-buttons');
    const authenticatedButtons = document.getElementById('authenticated-buttons');

    if (unauthenticatedButtons) unauthenticatedButtons.style.display = 'block';
    if (authenticatedButtons) authenticatedButtons.style.display = 'none';
  }
};

// Initialize index page
const initializeIndexPage = () => {
  // Run authentication check when page loads
  checkAuthenticationAndUpdateUI();

  // Also run immediately in case DOMContentLoaded already fired
  checkAuthenticationAndUpdateUI();
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeIndexPage);
} else {
  initializeIndexPage();
}
