import showMessage from '../components/toast.js';
import { supabase as supabaseProxy } from '../config/config.js';
import { setButtonLoading, temporarilyMark } from '../utils/buttonState.js';

/**
 * Clear all sessions after password change
 * This function invalidates sessions server-side and clears local session data
 * @param {Object} supabase - Supabase client instance
 * @param {string} userId - User ID (optional, will be fetched if not provided)
 * @param {string} scope - 'all' to logout all devices, 'others' to keep current session
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function clearSessionsAfterPasswordChange(supabase, userId = null, scope = 'all') {
  try {
    // Get user ID if not provided
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('[PASSWORD CHANGE] No user found, skipping session invalidation');
        return false;
      }
      userId = user.id;
    }

    // Step 1: Invalidate sessions server-side (including access tokens)
    try {
      const { addCsrfTokenToHeaders } = await import('../utils/csrf.js');
      const headers = await addCsrfTokenToHeaders({ 'Content-Type': 'application/json' });
      const invalidateRes = await fetch('/api/auth/invalidate-all-sessions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ scope })
      });

      if (!invalidateRes.ok) {
        console.warn('[PASSWORD CHANGE] Failed to invalidate sessions server-side:', await invalidateRes.text());
      }
    } catch (invalidateErr) {
      console.warn('[PASSWORD CHANGE] Error invalidating sessions server-side:', invalidateErr);
    }

    // Step 2: Clear server session cookie (only if logging out all sessions)
    if (scope === 'all') {
      try {
        await fetch('/auth/session', {
          method: 'DELETE',
          credentials: 'include'
        });
      } catch (cookieErr) {
        console.warn('[PASSWORD CHANGE] Error clearing server session cookie:', cookieErr);
      }
    }

    // Step 3: Clear Supabase client-side session
    if (scope === 'all') {
      await supabase.auth.signOut();
    } else if (scope === 'others') {
      // Sign out other devices but keep current session
      await supabase.auth.signOut({ scope: 'others' });
    }

    // Step 4: Clear local storage (only if logging out all sessions)
    if (scope === 'all') {
      try {
        const storageKeys = [
          `sb-${  supabase.supabaseUrl?.split('//')[1]?.split('.')[0] || 'default'  }-auth-token`,
          'oauth_context',
          'user_meta'
        ];

        storageKeys.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            // Ignore errors for individual keys
          }
        });

        // Also clear any keys that match the pattern
        Object.keys(localStorage).forEach(key => {
          if (key.includes('supabase') || key.includes('auth') || key.includes('oauth')) {
            try {
              localStorage.removeItem(key);
            } catch (e) {
              // Ignore errors
            }
          }
        });
      } catch (storageErr) {
        console.warn('[PASSWORD CHANGE] Error clearing local storage:', storageErr);
      }
    }

    return true;
  } catch (error) {
    console.error('[PASSWORD CHANGE] Error clearing sessions:', error);
    return false;
  }
}

async function ensureSessionFromLink() {
  try {
    const supabase = await supabaseProxy;
    // Supabase sends access_token in the URL hash for recovery
    // SECURITY: Extract hash immediately and clear from URL to prevent token exposure
    if (window.location.hash && window.location.hash.includes('access_token')) {
      const hashFragment = window.location.hash;

      // Parse hash fragment to extract tokens
      const hashParams = new URLSearchParams(hashFragment.substring(1)); // Remove # prefix
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      // For password reset links, use setSession with access_token
      if (accessToken && (type === 'recovery' || hashFragment.includes('type=recovery'))) {
        // Password reset flow: use setSession
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });
        if (error) {
          console.error('[CONFIRM PASSWORD CHANGE] Failed to set session:', error);
          return false;
        }
      }

      // SECURITY: Clear hash from URL immediately after processing to prevent token exposure
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[CONFIRM PASSWORD CHANGE] Error ensuring session:', error);
    return false;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const passwordFormState = document.getElementById('password-form-state');
  const loadingState = document.getElementById('loading-state');
  const successState = document.getElementById('success-state');
  const errorState = document.getElementById('error-state');
  const successMessage = document.getElementById('success-message');
  const errorMessage = document.getElementById('error-message');
  const setPasswordForm = document.getElementById('set-password-form');
  const newPasswordInput = document.getElementById('new-password');
  const confirmPasswordInput = document.getElementById('confirm-password');
  const setPasswordBtn = document.getElementById('set-password-btn');

  // Check if we have a valid recovery token
  const hasValidToken = await ensureSessionFromLink();
  const supabase = await supabaseProxy;
  const { data: sessionData } = await supabase.auth.getSession();
  const isRecoveryFlow = hasValidToken && Boolean(sessionData?.session);

  if (!isRecoveryFlow) {
    // No valid token - show error
    passwordFormState.style.display = 'none';
    errorState.style.display = 'block';
    errorMessage.textContent = 'Invalid or expired confirmation link. Please request a new password change.';
    return;
  }

  // Check logout option from URL
  const urlParams = new URLSearchParams(window.location.search);
  const logoutAllDevices = urlParams.get('logout_all_devices') === 'true';

  // Handle form submission
  if (setPasswordForm) {
    setPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = newPasswordInput.value.trim();
      const confirm = confirmPasswordInput.value.trim();

      if (!password || !confirm) {
        showMessage('error', 'Both fields are required', 3000);
        return;
      }

      if (password !== confirm) {
        showMessage('error', 'Passwords do not match', 3000);
        return;
      }

      const resetBtn = setButtonLoading(setPasswordBtn, 'Updating...');

      try {
        // Update password using Supabase
        // This automatically invalidates all refresh tokens
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;

        // Get user metadata to check logout preference
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const metadata = user.user_metadata || {};
          const shouldLogoutAll = logoutAllDevices || metadata.logout_all_devices_on_password_change;

          // Immediately mark sessions as invalidated in metadata
          // This ensures tokens issued before password change are rejected
          const updatedMetadata = {
            ...metadata,
            password_changed_at: new Date().toISOString(),
            sessions_invalidated_at: new Date().toISOString()
          };

          // Clear the logout flag if it exists
          if (metadata.logout_all_devices_on_password_change) {
            updatedMetadata.logout_all_devices_on_password_change = null;
          }

          await supabase.auth.updateUser({
            data: updatedMetadata
          });

          // Handle logout based on option
          if (shouldLogoutAll) {
            // Clear all sessions (server-side and client-side)
            await clearSessionsAfterPasswordChange(supabase, user.id, 'all');
            passwordFormState.style.display = 'none';
            loadingState.style.display = 'none';
            successState.style.display = 'block';
            successMessage.textContent = 'Password updated successfully. All sessions have been logged out. Please sign in again with your new password.';
            showMessage('success', 'Password updated and all sessions logged out', 5000);
            setTimeout(() => {
              window.location.href = '/login';
            }, 3000);
          } else {
            // Clear other sessions but keep current session
            await clearSessionsAfterPasswordChange(supabase, user.id, 'others');
            passwordFormState.style.display = 'none';
            loadingState.style.display = 'none';
            successState.style.display = 'block';
            successMessage.textContent = 'Password updated successfully. All other sessions have been logged out.';
            showMessage('success', 'Password updated successfully. Other sessions logged out.', 4000);
          }
        } else {
          passwordFormState.style.display = 'none';
          loadingState.style.display = 'none';
          successState.style.display = 'block';
          successMessage.textContent = 'Password updated successfully.';
          showMessage('success', 'Password updated successfully', 4000);
        }

        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
        temporarilyMark(setPasswordBtn, 'Updated', 'btn-success');
      } catch (err) {
        showMessage('error', err.message || 'Failed to update password', 4000);
        temporarilyMark(setPasswordBtn, 'Failed', 'btn-danger');
      } finally {
        resetBtn();
      }
    });
  }
});

