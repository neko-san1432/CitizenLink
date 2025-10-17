import { supabase } from '../config/config.js'

const storageKey = 'cl_user_meta'
const oauthKey = 'cl_oauth_context'

export const saveUserMeta = (meta) => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(meta))
  } catch {}
}

export const getUserMeta = () => {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export const requireRole = (allowedRoles) => {
  const meta = getUserMeta()
  if (!meta || !meta.role || (allowedRoles && !allowedRoles.includes(meta.role))) {
    window.location.href = '/login'
  }
}

export const refreshMetaFromSession = async () => {
  const { data: { session } } = await supabase.auth.getSession()

  // Check both raw_user_meta_data and user_metadata
  const rawUserMetaData = session?.user?.raw_user_meta_data || {}
  const userMetadata = session?.user?.user_metadata || {}

  // Combine metadata sources, prioritizing raw_user_meta_data (single source of truth)
  const combinedMetadata = { ...userMetadata, ...rawUserMetaData }

  // Prioritize original role, but fall back to normalized role for backward compatibility
  const role = combinedMetadata.role || combinedMetadata.normalized_role || null
  const name = combinedMetadata.name || rawUserMetaData.name || userMetadata.name || null

  if (role || name) {
    saveUserMeta({ role, name })
  }
  return { role, name }
}

export const setOAuthContext = (ctx) => {
  try { localStorage.setItem(oauthKey, JSON.stringify(ctx || {})) } catch {}
}

export const getOAuthContext = () => {
  try {
    const raw = localStorage.getItem(oauthKey)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export const clearOAuthContext = () => {
  try { localStorage.removeItem(oauthKey) } catch {}
}

// Global role getter
export const getUserRole = async (options = {}) => {
  const { refresh = false } = options
  if (!refresh) {
    const cached = getUserMeta()
    if (cached && cached.role) return cached.role
  }

  try {
    // Try to get role from API first (server has complete metadata)
    const response = await fetch('/api/user/role')
    if (response.ok) {
      const data = await response.json()
      if (data.success && data.data.role) {
        console.log('🔍 Got role from API:', data.data.role)
        saveUserMeta({ role: data.data.role, name: data.data.name })
        return data.data.role
      }
    }
  } catch (error) {
    console.warn('Failed to get role from API:', error)
  }

  // Fallback to session metadata
  const { data: { session } } = await supabase.auth.getSession()

  // Check both raw_user_meta_data (priority) and user_metadata (fallback)
  const rawUserMetaData = session?.user?.raw_user_meta_data || {}
  const userMetadata = session?.user?.user_metadata || {}

  // Debug: Log what we find in metadata
  console.log('🔍 Session metadata debug:', {
    rawUserMetaData,
    userMetadata,
    hasRawUserMetaData: Object.keys(rawUserMetaData).length > 0,
    hasUserMetadata: Object.keys(userMetadata).length > 0
  })

  // Combine metadata sources, prioritizing raw_user_meta_data (single source of truth)
  const combinedMetadata = { ...userMetadata, ...rawUserMetaData }

  // Prioritize original role, but fall back to normalized role for backward compatibility
  const role = combinedMetadata.role || combinedMetadata.normalized_role || null
  const name = combinedMetadata.name || rawUserMetaData.name || userMetadata.name || null

  console.log('🔍 Role detection result:', {
    combinedMetadata,
    role,
    name,
    willSaveToLocalStorage: !!(role || name)
  })

  if (role || name) saveUserMeta({ role, name })
  return role
}

// Check if token is valid and refresh if needed
export const validateAndRefreshToken = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.log('No valid session found');
      return false;
    }
    
    // Check if token is close to expiring (within 5 minutes)
    // Supabase expires_at is a Unix timestamp in seconds, not milliseconds
    const expiresAt = new Date((session.expires_at || session.expiresAt) * 1000);
    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const fiveMinutes = 5 * 60 * 1000;
    
    console.log('🔄 Token validation:', {
      rawExpiresAt: session.expires_at || session.expiresAt,
      expiresAt: expiresAt.toISOString(),
      now: now.toISOString(),
      timeUntilExpiry: timeUntilExpiry,
      isValidDate: !isNaN(expiresAt.getTime())
    });
    
    if (timeUntilExpiry < fiveMinutes) {
      console.log('Token expiring soon, refreshing...');
      const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !newSession) {
        console.log('Token refresh failed');
        return false;
      }
      
      // Update server cookie with new token
      try {
        await fetch('/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: newSession.access_token })
        });
        console.log('Token refreshed and server cookie updated');
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
    console.log('Auth state changed:', event, session ? 'session exists' : 'no session');
    
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
      console.log('Token refreshed, updating server cookie');
      try {
        // Update server-side cookie with new token
        await fetch('/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: session.access_token })
        });
        console.log('Server cookie updated with refreshed token');
      } catch (error) {
        console.error('Failed to update server cookie:', error);
      }
    }
    
    if (event === 'SIGNED_OUT') {
      console.log('User signed out, clearing local data');
      localStorage.removeItem(storageKey);
      localStorage.removeItem(oauthKey);
    }
  });
};

// Global token expiry monitoring
let tokenExpiryTimer = null;

const isAuthPage = () => {
  try {
    const p = (window.location.pathname || '').toLowerCase()
    return p === '/login' || p === '/signup' || p === '/resetpassword' || p === '/success' || p === '/oauth-continuation' || p === '/oauthcontinuation'
  } catch { return false }
}

export const startTokenExpiryMonitoring = () => {
  // Do not monitor on auth pages
  if (isAuthPage()) return
  // Clear existing timer
  if (tokenExpiryTimer) {
    clearTimeout(tokenExpiryTimer);
  }

  const checkTokenExpiry = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        // No session yet; recheck soon instead of immediate logout
        tokenExpiryTimer = setTimeout(checkTokenExpiry, 3000);
        return;
      }

      // Debug: Log session structure to see available properties
      console.log('🔍 Session object structure:', {
        expires_at: session.expires_at,
        expiresAt: session.expiresAt,
        expires_in: session.expires_in,
        token_type: session.token_type,
        access_token: session.access_token ? 'present' : 'missing',
        refresh_token: session.refresh_token ? 'present' : 'missing',
        user: session.user ? 'present' : 'missing'
      });

      // Check if token is expired or about to expire (within 1 minute)
      // Supabase expires_at is a Unix timestamp in seconds, not milliseconds
      const expiresAt = new Date((session.expires_at || session.expiresAt) * 1000);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      const oneMinute = 60 * 1000;
      
      console.log('⏰ Token expiry check:', {
        rawExpiresAt: session.expires_at || session.expiresAt,
        expiresAt: expiresAt.toISOString(),
        now: now.toISOString(),
        timeUntilExpiry: timeUntilExpiry,
        isValidDate: !isNaN(expiresAt.getTime())
      });

      if (timeUntilExpiry <= 0) {
        console.log('Token has expired, attempting refresh');
        try { await supabase.auth.refreshSession(); } catch {}
        tokenExpiryTimer = setTimeout(checkTokenExpiry, 2000);
        return;
      }

      if (timeUntilExpiry <= oneMinute) {
        console.log('Token expiring soon, attempting refresh...');
        try {
          const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError || !newSession) {
            console.log('Token refresh failed, logging out');
            handleSessionExpired();
            return;
          }

          // Update server cookie with new token
          await fetch('/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: newSession.access_token })
          });

          console.log('Token refreshed successfully');
          // Restart monitoring with new token
          startTokenExpiryMonitoring();
          return;
        } catch (refreshError) {
          console.error('Token refresh error:', refreshError);
          handleSessionExpired();
          return;
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
  if (isAuthPage()) return
  
  // Prevent multiple redirects
  if (window.location.pathname === '/login') return
  
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
    showMessage('error', 'Session expired. Please log in again.', 5000);
  }).catch(async () => {
    // Fallback if toast module fails - try to import and use toast
    try {
      const { default: showMessage } = await import('../components/toast.js');
      showMessage('error', 'Session expired. Please log in again.');
    } catch (toastError) {
      // Final fallback - use console.error if toast also fails
      console.error('Session expired. Please log in again.');
    }
  });
};

// Logout function
export const logout = async () => {
  try {
    // Clear Supabase session
    await supabase.auth.signOut()
    
    // Clear server session
    await fetch('/auth/session', { method: 'DELETE' })
    
    // Clear local storage
    localStorage.removeItem(storageKey)
    clearOAuthContext()
    
    // Redirect to login
    window.location.href = '/login'
  } catch (error) {
    console.error('Logout error:', error)
    // Force redirect even if logout fails
    window.location.href = '/login'
  }
}

try {
  // expose globally for anywhere in the app
  window.getUserRole = (opts) => getUserRole(opts)
  // Initialize auth listener
  initializeAuthListener();
  // Start token expiry monitoring
  startTokenExpiryMonitoring();
} catch {}

