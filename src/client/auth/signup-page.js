// Signup page specific functionality
import { supabase } from '../config/config.js';

// Check if user is already logged in and redirect to dashboard
const checkAuthentication = async () => {
  try {
    // console.log removed for security

    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (session && !error) {
      // console.log removed for security

      // Get user metadata
      const user = session.user;
      const role = user?.user_metadata?.role || '';
      const name = user?.user_metadata?.name || '';

      // Check if user has completed registration
      if (role && name) {
        // console.log removed for security
        window.location.href = '/dashboard';
        return;
      } else {
        // console.log removed for security
        window.location.href = '/oauth-continuation';
        return;
      }
    } else {
      // console.log removed for security
    }
  } catch (error) {
    console.error('💥 Authentication check failed:', error);
    // If there's an error, let the user proceed with signup
  }
};

// Initialize signup page
const initializeSignupPage = () => {
  // Run authentication check when page loads
  checkAuthentication();

  // Listen for auth state changes to update UI dynamically
  supabase.auth.onAuthStateChange((event, session) => {
    // console.log removed for security
    if (event === 'SIGNED_IN' && session) {
      checkAuthentication();
    }
  });
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSignupPage);
} else {
  initializeSignupPage();
}
