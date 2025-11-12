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
        saveUserMeta({ role: data.data.role, name: data.data.name });
        roleApiCache = data.data.role;
        roleApiCacheTime = now;
        return data.data.role;
      }
    } else if (response.status === 401) {
      // Session expired or missing; clear cache and trigger re-login path
      try { localStorage.removeItem('cl_user_meta'); } catch {}
      throw new Error('Unauthorized');
    }
  } catch (error) {
    console.warn('Failed to get role from API:', error);
  }
  // Fallback to session metadata
  const { data: { session } } = await supabase.auth.getSession();
  const rawUserMetaData = session?.user?.raw_user_meta_data || {};
  const userMetadata = session?.user?.user_metadata || {};
  // Combine metadata sources, prioritizing raw_user_meta_data (single source of truth)
  const combinedMetadata = { ...userMetadata, ...rawUserMetaData };
  // Prioritize original role, but fall back to normalized role for backward compatibility
  const role = combinedMetadata.role || combinedMetadata.normalized_role || null;
  const name = combinedMetadata.name || rawUserMetaData.name || userMetadata.name || null;
  if (role || name) saveUserMeta({ role, name });
  return role;
};
// Check if token is valid and refresh if needed

export const validateAndRefreshToken = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      return false;
    }
    // Check if session is expired
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at;
    if (expiresAt && now >= expiresAt) {
      // Try to refresh the session
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        return false;
      }
      // Update server cookie with new token
      try {
        await fetch('/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: refreshData.session.access_token })
        });
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
      try {
        // Update server-side cookie with new token
        await fetch('/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: session.access_token })
        });
        // Check for role changes when token refreshes (e.g., user was promoted)
        await checkAndUpdateRoleChange();
      } catch (error) {
        console.error('Failed to update server cookie:', error);
      }
    }
    if (event === 'SIGNED_OUT') {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(oauthKey);
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
  if (tokenExpiryTimer) {
    clearTimeout(tokenExpiryTimer);
  }
  noSessionAttempts = 0;
  const checkTokenExpiry = async () => {
    try {
      if (isAuthPage()) {
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
        noSessionAttempts++;
        if (noSessionAttempts < MAX_NO_SESSION_ATTEMPTS) {
          tokenExpiryTimer = setTimeout(checkTokenExpiry, 30000);
        } else {
          tokenExpiryTimer = null;
          if (!window.location.pathname.includes('/review-queue')) {
            handleSessionExpired();
          }
        }
        return;
      }
      noSessionAttempts = 0;
      // Schedule next check in 5 minutes
      tokenExpiryTimer = setTimeout(checkTokenExpiry, 5 * 60 * 1000);
    } catch (error) {
      console.error('Token monitoring error:', error);
      if (error.name !== 'TypeError') {
        handleSessionExpired();
      }
    }
  };
  checkTokenExpiry();
};

export const stopTokenExpiryMonitoring = () => {
  if (tokenExpiryTimer) {
    clearTimeout(tokenExpiryTimer);
    tokenExpiryTimer = null;
  }
};
// Handle session expired - show toast and logout
const handleSessionExpired = () => {
  if (isAuthPage()) return;
  if (window.location.pathname === '/login') return;
  stopTokenExpiryMonitoring();
  showSessionExpiredToast();
  localStorage.removeItem(storageKey);
  localStorage.removeItem(oauthKey);
  setTimeout(() => {
    window.location.href = '/login';
  }, 3000);
};
// Show session expired toast
const showSessionExpiredToast = () => {
  import('../components/toast.js').then(({ showMessage }) => {
    showMessage('error', 'Authentication failed. Please log in again.', 5000);
  }).catch(async () => {
    try {
      const { default: showMessage } = await import('../components/toast.js');
      showMessage('error', 'Authentication failed. Please log in again.');
    } catch (toastError) {
      console.error('Authentication failed. Please log in again.');
    }
  });
};
// Logout function
export const logout = async () => {
  try {
    await supabase.auth.signOut();
    await fetch('/auth/session', { method: 'DELETE' });
    localStorage.removeItem(storageKey);
    clearOAuthContext();
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout error:', error);
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
  window.getUserRole = (opts) => getUserRole(opts);
  initializeAuthListener();
  startTokenExpiryMonitoring();
} catch {}
