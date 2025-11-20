import { supabase } from '../config/config.js';

const storageKey = 'cl_user_meta';
const oauthKey = 'cl_oauth_context';

export const saveUserMeta = (meta) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(meta));
  } catch {}
};

export const getUserMeta = () => {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const requireRole = (allowedRoles) => {
  const meta = getUserMeta();
  if (!meta || !meta.role || (allowedRoles && !allowedRoles.includes(meta.role))) {
    window.location.href = '/login';
  }
};

export const refreshMetaFromSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  // Check both raw_user_meta_data and user_metadata
  const rawUserMetaData = session?.user?.raw_user_meta_data || {};
  const userMetadata = session?.user?.user_metadata || {};
  // Combine metadata sources, prioritizing raw_user_meta_data (single source of truth)
  const combinedMetadata = { ...userMetadata, ...rawUserMetaData };
  // Prioritize original role, but fall back to normalized role for backward compatibility
  const role = combinedMetadata.role || combinedMetadata.normalized_role || null;
  const name = combinedMetadata.name || rawUserMetaData.name || userMetadata.name || null;
  if (role || name) {
    saveUserMeta({ role, name });
  }
  return { role, name };
};

export const setOAuthContext = (ctx) => {
  try { localStorage.setItem(oauthKey, JSON.stringify(ctx || {})); } catch {}
};

export const getOAuthContext = () => {
  try {
    const raw = localStorage.getItem(oauthKey);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const clearOAuthContext = () => {
  try { localStorage.removeItem(oauthKey); } catch {}
};
// Cache for API calls to prevent excessive requests
let roleApiCache = null;
let roleApiCacheTime = 0;
const CACHE_DURATION = 5000; // 5 seconds cache
// Flag to prevent multiple role change checks
let isCheckingRoleChange = false;
// Global role getter

export const getUserRole = async (options = {}) => {
  const { refresh = false } = options;
  if (!refresh) {
    const cached = getUserMeta();
    if (cached && cached.role) return cached.role;
  }
  // Check API cache to prevent excessive calls
  const now = Date.now();
  if (!refresh && roleApiCache && (now - roleApiCacheTime) < CACHE_DURATION) {
    // console.log removed for security
    return roleApiCache;
  }
  try {
    // Try to get role from API first (server has complete metadata)
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch('/api/user/role', {
      method: 'GET',
      headers,
      credentials: 'include'
    });
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data.role) {
        // console.log removed for security
        saveUserMeta({ role: data.data.role, name: data.data.name });
        // Cache the result
        roleApiCache = data.data.role;
        roleApiCacheTime = now;
        return data.data.role;
      }
    } else if (response.status === 401) {
      try { localStorage.removeItem('cl_user_meta'); } catch {}
      throw new Error('Unauthorized');
    }
  } catch (error) {
    console.warn('Failed to get role from API:', error);
  }
  // Fallback to session metadata
  const { data: { session } } = await supabase.auth.getSession();
  // Check both raw_user_meta_data (priority) and user_metadata (fallback)
  const rawUserMetaData = session?.user?.raw_user_meta_data || {};
  const userMetadata = session?.user?.user_metadata || {};
  // Debug: Log what we find in metadata
  // console.log removed for security
  // Combine metadata sources, prioritizing raw_user_meta_data (single source of truth)
  const combinedMetadata = { ...userMetadata, ...rawUserMetaData };
  // Prioritize original role, but fall back to normalized role for backward compatibility
  const role = combinedMetadata.role || combinedMetadata.normalized_role || null;
  const name = combinedMetadata.name || rawUserMetaData.name || userMetadata.name || null;
  // console.log removed for security
  if (role || name) saveUserMeta({ role, name });
  return role;
};
// Check if device is trusted (allows auto-refresh)
const isDeviceTrusted = () => {
  try {
    const trusted = localStorage.getItem('device_trusted');
    return trusted === 'true';
  } catch {
    return false;
  }
};

// Store device trust preference
export const setDeviceTrusted = (trusted) => {
  try {
    if (trusted) {
      localStorage.setItem('device_trusted', 'true');
    } else {
      localStorage.removeItem('device_trusted');
    }
  } catch (error) {
    console.error('[AUTH] Failed to store device trust preference:', error);
  }
};

// Check if token is valid and refresh if needed
export const validateAndRefreshToken = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      console.log('No valid session found:', error?.message || 'No session');
      return false;
    }
    // Check if session is expired
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at;
    if (expiresAt && now >= expiresAt) {
      // Check if device is trusted - if not, don't auto-refresh
      if (!isDeviceTrusted()) {
        console.log('[AUTH] Session expired and device is not trusted. Requiring re-authentication.');
        return false;
      }
      console.log('Session expired, attempting refresh...');
      // Try to refresh the session (only if device is trusted)
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        console.log('Session refresh failed:', refreshError?.message);
        return false;
      }
      // Update server cookie with new token
      try {
        await fetch('/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: refreshData.session.access_token })
        });
        console.log('Session refreshed successfully');
      } catch (cookieError) {
        console.error('Failed to update server cookie:', cookieError);
      }
    }
    return true;
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
};
// Set up automatic token refresh listener

export const initializeAuthListener = () => {
  supabase.auth.onAuthStateChange(async (event, session) => {
    // console.log removed for security
    // Ensure server cookie is set when we get a valid session
    if (event === 'SIGNED_IN' && session) {
      try {
        await fetch('/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: session.access_token })
        });
      } catch {}
      // Restart monitoring on fresh session
      stopTokenExpiryMonitoring();
      startTokenExpiryMonitoring();
    }
    if (event === 'TOKEN_REFRESHED' && session) {
      // Check if device is trusted before allowing auto-refresh
      if (!isDeviceTrusted()) {
        console.log('[AUTH] Token refresh attempted but device is not trusted. Signing out.');
        await supabase.auth.signOut();
        handleSessionExpired();
        return;
      }
      // console.log removed for security
      try {
        // Update server-side cookie with new token
        await fetch('/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: session.access_token })
        });
        // Check for role changes when token refreshes (e.g., user was promoted)
        await checkAndUpdateRoleChange();
        // console.log removed for security
      } catch (error) {
        console.error('Failed to update server cookie:', error);
      }
    }
    if (event === 'SIGNED_OUT') {
      // console.log removed for security
      localStorage.removeItem(storageKey);
      localStorage.removeItem(oauthKey);
      // Note: We keep device_trusted preference even after logout
      // so it persists for the next login
    }
  });
};
// Global token expiry monitoring
let tokenExpiryTimer = null;
let noSessionAttempts = 0;
const MAX_NO_SESSION_ATTEMPTS = 3;
const isAuthPage = () => {
  try {
    const p = (window.location.pathname || '').toLowerCase();
    return p === '/login' || p === '/signup' || p === '/signup-with-code' || p === '/resetpassword' || p === '/reset-password' || p === '/success' || p === '/oauth-continuation' || p === '/oauthcontinuation' || p === '/complete-position-signup';
  } catch { return false; }
};

export const startTokenExpiryMonitoring = () => {
  // Do not monitor on auth pages
  if (isAuthPage()) return;
  // Clear existing timer
  if (tokenExpiryTimer) {
    clearTimeout(tokenExpiryTimer);
  }
  // Reset attempts counter
  noSessionAttempts = 0;
  const checkTokenExpiry = async () => {
    try {
      // Check if we're on an auth page - if so, stop monitoring
      if (isAuthPage()) {
        // On auth page, stopping token monitoring silently
        tokenExpiryTimer = null;
        return;
      }
      // Check if user has a Supabase session first before making API call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // No session, stop monitoring silently
        tokenExpiryTimer = null;
        return;
      }

      // Check if user is authenticated via API instead of Supabase session
      const response = await fetch('/api/user/role', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        // If 401, check if device is trusted before attempting refresh
        if (response.status === 401) {
          // If device is not trusted, don't try to refresh - require re-login
          if (!isDeviceTrusted()) {
            console.log('[AUTH] Session expired and device is not trusted. Requiring re-authentication.');
            tokenExpiryTimer = null;
            handleSessionExpired();
            return;
          }
          // Try to refresh session - if it fails, session is definitely invalid
          try {
            const { data: { session: refreshData }, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError || !refreshData?.session) {
              // Session is invalid (likely password changed), immediately redirect
              tokenExpiryTimer = null;
              handleSessionExpired();
              return;
            }
            // Session refreshed successfully, but API still returns 401
            // This means server-side session is invalid - redirect immediately
            tokenExpiryTimer = null;
            handleSessionExpired();
            return;
          } catch (refreshErr) {
            // Refresh failed, session is invalid
            tokenExpiryTimer = null;
            handleSessionExpired();
            return;
          }
        }
        // For other errors, retry a few times
        noSessionAttempts++;
        if (noSessionAttempts < MAX_NO_SESSION_ATTEMPTS) {
          tokenExpiryTimer = setTimeout(checkTokenExpiry, 30000); // Wait 30 seconds instead of 5
        } else {
          tokenExpiryTimer = null;
          // Don't redirect if we're on a page that might be loading
          if (!window.location.pathname.includes('/review-queue')) {
            handleSessionExpired();
          }
        }
        return;
      }
      // Reset attempts counter when session is found
      noSessionAttempts = 0;
      // If we reach here, the user is authenticated via API
      // Schedule next check in 5 minutes
      tokenExpiryTimer = setTimeout(checkTokenExpiry, 5 * 60 * 1000);
    } catch (error) {
      // Silently handle errors - don't spam console with expected errors
      if (error.name !== 'TypeError' && error.name !== 'AbortError') {
        // Only handle unexpected errors
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Only handle as session expired if we had a session
          handleSessionExpired();
        } else {
          // No session, just stop monitoring
          tokenExpiryTimer = null;
        }
      } else {
        // Network errors or aborted requests - just stop monitoring
        tokenExpiryTimer = null;
      }
    }
  };
  // Start monitoring
  checkTokenExpiry();
};

export const stopTokenExpiryMonitoring = () => {

  if (tokenExpiryTimer) {
    clearTimeout(tokenExpiryTimer);
    tokenExpiryTimer = null;
  }
};
// Handle session expired - show toast and logout
const handleSessionExpired = async () => {
  if (isAuthPage()) return;
  // Prevent multiple redirects
  if (window.location.pathname === '/login') return;
  // Stop monitoring
  stopTokenExpiryMonitoring();
  // Show session expired toast
  showSessionExpiredToast();

  // Clear Supabase session to prevent auto-login
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error('[AUTH] Error signing out from Supabase:', error);
  }

  // Clear server session cookie
  try {
    await fetch('/auth/session', { method: 'DELETE' });
  } catch (error) {
    console.error('[AUTH] Error clearing server session:', error);
  }

  // Clear local data
  localStorage.removeItem(storageKey);
  localStorage.removeItem(oauthKey);

  // Clear any stored credentials (prevent browser autofill)
  const loginForm = document.querySelector('#loginForm, form[action*="login"]');
  if (loginForm) {
    const emailInput = loginForm.querySelector('input[type="email"], input[name="email"]');
    const passwordInput = loginForm.querySelector('input[type="password"], input[name="password"]');
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
  }

  // Redirect with a parameter to prevent auto-login
  setTimeout(() => {
    window.location.href = '/login?session_expired=true';
  }, 3000);
};
// Show session expired toast
const showSessionExpiredToast = () => {
  // Import toast functionality
  import('../components/toast.js').then(({ showMessage }) => {
    showMessage('error', 'Authentication failed. Please log in again.', 5000);
  }).catch(async () => {
    // Fallback if toast module fails - try to import and use toast
    try {
      const { default: showMessage } = await import('../components/toast.js');
      showMessage('error', 'Authentication failed. Please log in again.');
    } catch (toastError) {
      // Final fallback - use console.error if toast also fails
      console.error('Authentication failed. Please log in again.');
    }
  });
};
// Logout function

export const logout = async () => {
  try {
    // Clear Supabase session
    await supabase.auth.signOut();
    // Clear server session
    await fetch('/auth/session', { method: 'DELETE' });
    // Clear local storage
    localStorage.removeItem(storageKey);
    clearOAuthContext();
    // Redirect to login
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout error:', error);
    // Force redirect even if logout fails
    window.location.href = '/login';
  }
};
/**
 * Check for role changes and update UI accordingly
 * Called when token refreshes to detect promotions/demotions
 */
const checkAndUpdateRoleChange = async () => {
  // Prevent multiple simultaneous checks
  if (isCheckingRoleChange) {
    return;
  }

  // Don't check on auth pages
  if (isAuthPage()) {
    return;
  }

  isCheckingRoleChange = true;

  try {
    // Get current cached role
    const cachedMeta = getUserMeta();
    const oldRole = cachedMeta?.role;

    // If no cached role, this might be first load - skip check
    if (!oldRole) {
      isCheckingRoleChange = false;
      return;
    }

    // Fetch fresh role from API (bypasses cache)
    const newRole = await getUserRole({ refresh: true });

    // Check if role changed
    if (newRole && oldRole !== newRole) {
      console.log(`[ROLE_CHANGE] Role changed from ${oldRole} to ${newRole}`);

      // Refresh metadata from session
      await refreshMetaFromSession();

      // Clear API cache to force fresh data
      roleApiCache = null;
      roleApiCacheTime = 0;

      // Dispatch custom event to notify components
      window.dispatchEvent(new CustomEvent('userRoleChanged', {
        detail: { oldRole, newRole }
      }));

      // Show notification to user
      try {
        const { default: showMessage } = await import('../components/toast.js');
        const roleDisplayName = formatRoleNameForDisplay(newRole);
        showMessage('info', `Your role has been updated to ${roleDisplayName}. Refreshing page...`, 5000);
      } catch (toastError) {
        console.error('[ROLE_CHANGE] Failed to show toast:', toastError);
      }

      // Reload page to ensure all components update with new role
      // This ensures sidebar, header, permissions, etc. all reflect the new role
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  } catch (error) {
    console.error('[ROLE_CHANGE] Error checking role change:', error);
  } finally {
    isCheckingRoleChange = false;
  }
};

/**
 * Format role name for display in notifications
 */
const formatRoleNameForDisplay = (role) => {
  if (!role) return 'Unknown';

  const roleNames = {
    'citizen': 'Citizen',
    'lgu': 'LGU Officer',
    'lgu-admin': 'LGU Admin',
    'complaint-coordinator': 'Complaint Coordinator',
    'super-admin': 'Super Admin',
    'hr': 'HR',
    'lgu-hr': 'LGU HR'
  };

  // Handle LGU officer roles with department codes
  if (/^lgu-(?!admin|hr)/.test(role)) {
    const dept = role.replace(/^lgu-/, '').toUpperCase();
    return `LGU Officer (${dept})`;
  }

  // Handle LGU admin roles with department codes
  if (/^lgu-admin-/.test(role)) {
    const dept = role.replace(/^lgu-admin-/, '').toUpperCase();
    return `LGU Admin (${dept})`;
  }

  // Handle LGU HR roles with department codes
  if (/^lgu-hr-/.test(role)) {
    const dept = role.replace(/^lgu-hr-/, '').toUpperCase();
    return `HR (${dept})`;
  }

  return roleNames[role] || role;
};
try {
  // expose globally for anywhere in the app
  window.getUserRole = (opts) => getUserRole(opts);
  // Initialize auth listener
  initializeAuthListener();
  // Start token expiry monitoring
  startTokenExpiryMonitoring();
  // Initialize header auth UI on all pages
  const initializeHeaderAuthUI = () => {
    try {
      const path = (window.location && window.location.pathname || '').toLowerCase();
      const unauthEl = document.getElementById('unauthenticated-buttons');
      const authEl = document.getElementById('authenticated-buttons');
      const dashboardBtn = document.getElementById('dashboard-btn');
      const logoutBtn = document.getElementById('logout-btn');
      const onAuthPage = (path === '/login' || path === '/signup' || path === '/signup-with-code' || path === '/complete-position-signup');

      // Hide unauthenticated buttons on auth pages themselves
      if (onAuthPage) {
        if (unauthEl) unauthEl.classList.add('hidden');
      }
      // Resolve role and set dashboard target + toggle buttons
      (async () => {
        try {
          // Skip API call on auth pages to avoid 401 errors
          if (onAuthPage) {
            // On auth pages, keep unauth buttons hidden, auth buttons hidden
            if (unauthEl) unauthEl.classList.add('hidden');
            if (authEl) authEl.classList.add('hidden');
            return;
          }

          // Check if user has a session before making API call
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            // No session, show unauthenticated buttons
            if (unauthEl) unauthEl.classList.remove('hidden');
            if (authEl) authEl.classList.add('hidden');
            return;
          }

          // User has session, check role via API
          const res = await fetch('/api/user/role', { credentials: 'include' });
          const authed = res.ok ? (await res.clone().json())?.success : false;
          if (authed) {
            if (unauthEl) unauthEl.classList.add('hidden');
            if (authEl) authEl.classList.remove('hidden');
            try {
              const data = await res.json();
              const role = data?.data?.role?.toLowerCase?.();
              // Unified dashboard route for all roles
              const href = '/dashboard';
              if (dashboardBtn) dashboardBtn.setAttribute('href', href);
            } catch {}
          } else {
            // Not authenticated, show unauthenticated buttons
            if (unauthEl) unauthEl.classList.remove('hidden');
            if (authEl) authEl.classList.add('hidden');
          }
        } catch (error) {
          // Silently handle errors - don't show 401 errors in console
          if (onAuthPage) {
            // On auth pages, ensure buttons are hidden
            if (unauthEl) unauthEl.classList.add('hidden');
            if (authEl) authEl.classList.add('hidden');
          } else {
            // On other pages, show unauthenticated buttons on error
            if (unauthEl) unauthEl.classList.remove('hidden');
            if (authEl) authEl.classList.add('hidden');
          }
        }
        // Bind logout
        if (logoutBtn) {
          try {
            logoutBtn.addEventListener('click', async () => {
              await logout();
            }, { once: true });
          } catch {}
        }
      })();
    } catch {}
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHeaderAuthUI);
  } else {
    initializeHeaderAuthUI();
  }
} catch {}
