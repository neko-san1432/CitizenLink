// Index/landing page specific functionality
import { supabase } from '../config/config.js';
import { logout } from './authChecker.js';

// Track if logout event listener has been added
let logoutListenerAdded = false;
// Check authentication status and update UI
const checkAuthenticationAndUpdateUI = async () => {
  try {
    // console.log removed for security
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    const unauthenticatedButtons = document.getElementById('unauthenticated-buttons');
    const authenticatedButtons = document.getElementById('authenticated-buttons');
    const logoutBtn = document.getElementById('logout-btn');
    if (session && !error) {
      // console.log removed for security
      // Get user metadata
      const {user} = session;
      const role = user?.user_metadata?.role || '';
      const name = user?.user_metadata?.name || '';
      // Check if user has completed registration
      if (role && name) {
        // console.log removed for security
        // Hide login/signup buttons, show dashboard button
        if (unauthenticatedButtons) unauthenticatedButtons.classList.add('hidden');
        if (authenticatedButtons) authenticatedButtons.classList.remove('hidden');
        // Add logout functionality (only once)
        if (logoutBtn && !logoutListenerAdded) {
          logoutBtn.addEventListener('click', async () => {
            // console.log removed for security
            await logout();
          });
          logoutListenerAdded = true;
        }
      } else {
        // console.log removed for security
        // Profile incomplete, keep showing login/signup for profile completion
        if (unauthenticatedButtons) unauthenticatedButtons.classList.remove('hidden');
        if (authenticatedButtons) authenticatedButtons.classList.add('hidden');
      }
    } else {
      // console.log removed for security
      // Show login/signup buttons, hide dashboard button
      if (unauthenticatedButtons) unauthenticatedButtons.classList.remove('hidden');
      if (authenticatedButtons) authenticatedButtons.classList.add('hidden');
    }
  } catch (error) {
    console.error('💥 Authentication check failed:', error);
    // On error, default to showing login/signup buttons
    const unauthenticatedButtons = document.getElementById('unauthenticated-buttons');
    const authenticatedButtons = document.getElementById('authenticated-buttons');
    if (unauthenticatedButtons) unauthenticatedButtons.classList.remove('hidden');
    if (authenticatedButtons) authenticatedButtons.classList.add('hidden');
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
