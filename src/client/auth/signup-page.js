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

  // Wire Terms & Privacy Modals
  try {
    const termsCheckbox = document.getElementById('terms-checkbox');
    const openers = document.querySelectorAll('[data-open-modal]');
    const closeButtons = document.querySelectorAll('[data-close-modal]');

    openers.forEach(opener => {
      opener.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = opener.getAttribute('data-open-modal');
        const modal = document.getElementById(targetId);
        if (modal) modal.classList.add('open');
      });
    });

    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        if (modal) modal.classList.remove('open');
      });
    });

    // Accept buttons
    const acceptTerms = document.querySelector('[data-accept-terms]');
    if (acceptTerms) {
      acceptTerms.addEventListener('click', () => {
        const modal = acceptTerms.closest('.modal');
        if (modal) modal.classList.remove('open');
        if (termsCheckbox) termsCheckbox.checked = true;
      });
    }

    const acceptPrivacy = document.querySelector('[data-accept-privacy]');
    if (acceptPrivacy) {
      acceptPrivacy.addEventListener('click', () => {
        const modal = acceptPrivacy.closest('.modal');
        if (modal) modal.classList.remove('open');
        if (termsCheckbox) termsCheckbox.checked = true; // consent covers both
      });
    }
  } catch (err) {
    // console.log removed for security
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSignupPage);
} else {
  initializeSignupPage();
}
