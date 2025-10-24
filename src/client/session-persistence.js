// Session persistence utilities for CitizenLink
// This file handles session management and persistence across page reloads

import { supabase } from './config/config.js';

class SessionManager {
  constructor() {
    this.checkInterval = null;
    this.sessionCheckDelay = 5 * 60 * 1000; // Check every 5 minutes
  }

  // Initialize session management
  init() {
    // Check if user is already logged in
    this.checkExistingSession();

    // Set up periodic session checks
    this.startPeriodicChecks();

    // Listen for storage events (for multi-tab sync)
    window.addEventListener('storage', this.handleStorageChange.bind(this));

    // Listen for visibility changes (tab switching)
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
  }

  // Check if there's an existing session
  async checkExistingSession() {
    try {
      // Check if we have session cookies
      const hasSessionCookie = await this.hasSessionCookie();

      if (hasSessionCookie) {
        // Try to validate the session
        const isValid = await this.validateSession();

        if (isValid) {
          console.log('[SESSION] Valid existing session found');
          // Redirect to dashboard if we're on auth pages
          this.redirectIfOnAuthPage();
        } else {
          console.log('[SESSION] Invalid existing session, clearing');
          await this.clearSession();
        }
      }
    } catch (error) {
      console.error('[SESSION] Error checking existing session:', error);
    }
  }

  // Check if session cookie exists
  async hasSessionCookie() {
    try {
      const response = await fetch('/auth/session/health', {
        method: 'GET',
        credentials: 'include'
      });

      return response.ok;
    } catch (error) {
      console.error('[SESSION] Error checking session cookie:', error);
      return false;
    }
  }

  // Validate current session
  async validateSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/user/role', {
        method: 'GET',
        credentials: 'include',
        headers
      });

      return response.ok;
    } catch (error) {
      console.error('[SESSION] Error validating session:', error);
      return false;
    }
  }

  // Clear session data
  async clearSession() {
    try {
      await fetch('/auth/session', {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (error) {
      console.error('[SESSION] Error clearing session:', error);
    }
  }

  // Redirect if on authentication pages
  redirectIfOnAuthPage() {
    const authPages = ['/login', '/signup', '/resetPass'];
    const currentPath = window.location.pathname;

    if (authPages.includes(currentPath)) {
      window.location.href = '/dashboard';
    }
  }

  // Start periodic session checks
  startPeriodicChecks() {
    this.checkInterval = setInterval(async () => {
      try {
        const isValid = await this.validateSession();
        if (!isValid) {
          console.log('[SESSION] Session expired, redirecting to login');
          await this.clearSession();
          window.location.href = '/login';
        }
      } catch (error) {
        console.error('[SESSION] Error in periodic check:', error);
      }
    }, this.sessionCheckDelay);
  }

  // Handle storage changes (multi-tab sync)
  handleStorageChange(event) {
    if (event.key === 'supabase.auth.token') {
      // Auth state changed in another tab
      this.checkExistingSession();
    }
  }

  // Handle visibility changes (tab switching)
  handleVisibilityChange() {
    if (!document.hidden) {
      // Tab became visible, check session
      this.checkExistingSession();
    }
  }

  // Cleanup
  destroy() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// Initialize session management when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const sessionManager = new SessionManager();
    sessionManager.init();

    // Make available globally for cleanup
    window.sessionManager = sessionManager;
  });
} else {
  const sessionManager = new SessionManager();
  sessionManager.init();
  window.sessionManager = sessionManager;
}
