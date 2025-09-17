import { supabase } from '../db.js';
import { getUserMeta } from './authChecker.js';

// Check authentication and redirect to appropriate dashboard
const checkAuthAndRedirect = async () => {
  try {
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.log('No session found, redirecting to login');
      window.location.href = '/login';
      return;
    }

    // Get user metadata
    const user = session.user;
    const role = user?.user_metadata?.role || 'citizen';
    const name = user?.user_metadata?.name || '';

    // Check if user has completed registration
    if (!role || !name) {
      console.log('User profile incomplete, redirecting to OAuth continuation');
      window.location.href = '/oauth-continuation';
      return;
    }

    // Save user metadata to localStorage
    const { saveUserMeta } = await import('./authChecker.js');
    saveUserMeta({ role, name });

    // Redirect to appropriate dashboard based on role
    if (role === 'super-admin') {
      window.location.href = '/pages/super-admin/dashboard.html';
    } else if (role === 'lgu-admin') {
      window.location.href = '/pages/lgu-admin/dashboard.html';
    } else if (/^lgu-/.test(role)) {
      const department = role.replace('lgu-', '');
      window.location.href = `/pages/lgu/${department}/dashboard.html`;
    } else if (role === 'lgu') {
      window.location.href = '/pages/lgu/dashboard.html';
    } else {
      // Default to citizen dashboard
      window.location.href = '/pages/citizen/dashboard.html';
    }

  } catch (error) {
    console.error('Authentication check failed:', error);
    window.location.href = '/login';
  }
};

// Run authentication check
checkAuthAndRedirect();
