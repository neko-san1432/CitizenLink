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
    const response = await fetch('/api/user/role');
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
      console.log('Session expired, attempting refresh...');
      
      // Try to refresh the session
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
      // console.log removed for security
      try {
        // Update server-side cookie with new token
        await fetch('/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: session.access_token })
        });
        // console.log removed for security
      } catch (error) {
        console.error('Failed to update server cookie:', error);
      }
    }

    if (event === 'SIGNED_OUT') {
      // console.log removed for security
      localStorage.removeItem(storageKey);
      localStorage.removeItem(oauthKey);
    }
  });
};

// Global token expiry monitoring
let tokenExpiryTimer = null;

const isAuthPage = () => {
  try {
    const p = (window.location.pathname || '').toLowerCase();
    return p === '/login' || p === '/signup' || p === '/resetpassword' || p === '/success' || p === '/oauth-continuation' || p === '/oauthcontinuation';
  } catch { return false; }
};

export const startTokenExpiryMonitoring = () => {
  // Do not monitor on auth pages
  if (isAuthPage()) return;
  // Clear existing timer
  if (tokenExpiryTimer) {
    clearTimeout(tokenExpiryTimer);
  }

  const checkTokenExpiry = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        console.log('No session found during monitoring, checking again in 5 seconds...');
        tokenExpiryTimer = setTimeout(checkTokenExpiry, 5000);
        return;
      }

      // Check if session is expired
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at;
      
      if (expiresAt && now >= expiresAt) {
        console.log('Session expired during monitoring, attempting refresh...');
        
        // Try to refresh the session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          console.log('Session refresh failed during monitoring:', refreshError?.message);
          handleSessionExpired();
          return;
        }
        
        // Update server cookie with new token
        try {
          await fetch('/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: refreshData.session.access_token })
          });
          console.log('Session refreshed successfully during monitoring');
        } catch (cookieError) {
          console.error('Failed to update server cookie during monitoring:', cookieError);
        }
      }

      // Set timer for next check (check every 30 seconds)
      tokenExpiryTimer = setTimeout(checkTokenExpiry, 30000);
    } catch (error) {
      console.error('Token monitoring error:', error);
      handleSessionExpired();
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
const handleSessionExpired = () => {
  if (isAuthPage()) return;

  // Prevent multiple redirects
  if (window.location.pathname === '/login') return;

  // Stop monitoring
  stopTokenExpiryMonitoring();

  // Show session expired toast
  showSessionExpiredToast();

  // Clear local data
  localStorage.removeItem(storageKey);
  localStorage.removeItem(oauthKey);

  // Redirect to login after a short delay
  setTimeout(() => {
    window.location.href = '/login';
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

try {
  // expose globally for anywhere in the app
  window.getUserRole = (opts) => getUserRole(opts);
  // Initialize auth listener
  initializeAuthListener();
  // Start token expiry monitoring
  startTokenExpiryMonitoring();
} catch {}
