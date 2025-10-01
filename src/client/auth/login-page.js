// Login page specific functionality
import { supabase } from '../config/config.js';

// Check if user is already logged in and redirect to dashboard
const checkAuthentication = async () => {
  try {
    console.log('🔍 Checking if user is already logged in...');

    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (session && !error) {
      console.log('✅ User is already logged in, redirecting to dashboard...');

      // Get user metadata
      const user = session.user;
      const role = user?.user_metadata?.role || '';
      const name = user?.user_metadata?.name || '';

      // Check if user has completed registration
      if (role && name) {
        console.log('🎯 Profile complete, redirecting to dashboard for role:', role);
        window.location.href = '/dashboard';
        return;
      } else {
        console.log('❌ User profile incomplete, redirecting to OAuth continuation');
        window.location.href = '/oauth-continuation';
        return;
      }
    } else {
      console.log('❌ No active session found, user can proceed with login');
    }
  } catch (error) {
    console.error('💥 Authentication check failed:', error);
    // If there's an error, let the user proceed with login
  }
};

// Check for URL parameters and show toast messages
const handleUrlMessages = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const message = urlParams.get('message');
  const type = urlParams.get('type');

  if (message && type) {
    // Import and show toast message
    import('../components/toast.js').then(({ default: showMessage }) => {
      showMessage(type, message);
      // Clean up URL parameters
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }).catch(error => {
      console.error('Failed to load toast module:', error);
      // Fallback to alert if toast fails
      alert(message);
    });
  }
};

// Initialize login page
const initializeLoginPage = () => {
  // Run authentication check when page loads
  checkAuthentication();

  // Handle URL messages
  handleUrlMessages();

  // Listen for auth state changes to update UI dynamically
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔄 Auth state changed on login page:', event);
    if (event === 'SIGNED_IN' && session) {
      checkAuthentication();
    }
  });
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeLoginPage);
} else {
  initializeLoginPage();
}
