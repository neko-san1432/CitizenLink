import showMessage from '../components/toast.js';
import { supabase as supabaseProxy } from '../config/config.js';
import { setButtonLoading, temporarilyMark } from '../utils/buttonState.js';

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
      // For OAuth flows, use exchangeCodeForSession with code
      if (accessToken && (type === 'recovery' || hashFragment.includes('type=recovery'))) {
        // Password reset flow: use setSession
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });
        if (error) {
          console.error('[RESET PASSWORD] Failed to set session:', error);
          return false;
        }
      } else if (hashFragment.includes('code=')) {
        // OAuth flow: use exchangeCodeForSession
        await supabase.auth.exchangeCodeForSession(hashFragment);
      } else if (accessToken) {
        // Fallback: try setSession if we have access_token
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });
        if (error) {
          console.error('[RESET PASSWORD] Failed to set session:', error);
          return false;
        }
      }

      // SECURITY: Clear hash from URL immediately after processing to prevent token exposure
      // Use replaceState to remove hash without triggering page reload
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      } else {
        // Fallback: redirect to clean URL
        window.location.hash = '';
      }
    }
    return true;
  } catch (error) {
    console.error('[RESET PASSWORD] Error processing reset link:', error);
    return false;
  }
}
document.addEventListener('DOMContentLoaded', async () => {
  // SECURITY: Process token immediately and clear from URL
  const hadToken = window.location.hash && window.location.hash.includes('access_token');
  const hadRecoveryToken = hadToken && (window.location.hash.includes('type=recovery') || window.location.hash.includes('type%3Drecovery'));
  await ensureSessionFromLink();
  const supabase = await supabaseProxy;
  const { data: sessionData } = await supabase.auth.getSession();

  // Check if user came from password reset link (recovery type)
  // This takes priority even if they have a session, because reset links create temporary sessions
  const isRecoveryFlow = hadRecoveryToken && Boolean(sessionData?.session);

  // Check if user is logged in normally (not from reset link)
  // Only consider logged in if they didn't just come from a reset link
  const isLoggedIn = Boolean(sessionData?.session) && !hadRecoveryToken;

  const modeRecovery = document.getElementById('mode-recovery');
  const modeLoggedIn = document.getElementById('mode-logged-in');
  const modeRequest = document.getElementById('mode-request');
  const msg = document.getElementById('message');

  // SECURITY: Hide all modes first, then show only the correct one
  if (modeRecovery) modeRecovery.style.display = 'none';
  if (modeLoggedIn) modeLoggedIn.style.display = 'none';
  if (modeRequest) modeRequest.style.display = 'none';

  // Choose mode based on context
  // Priority: Recovery flow (from reset link) > Logged in > Request reset link
  if (isRecoveryFlow) {
    // User came from password reset email link - NO current password needed!
    if (modeRecovery) modeRecovery.style.display = 'block';
    if (msg) msg.textContent = 'Enter your new password below to finish resetting it.';
  } else if (isLoggedIn) {
    // User is already logged in normally (not from reset link), allow password change
    // This requires current password for security
    if (modeLoggedIn) modeLoggedIn.style.display = 'block';
    if (msg) msg.textContent = 'You\'re signed in. Change your password securely by confirming your current password.';
  } else {
    // User needs to request a password reset link
    if (modeRequest) modeRequest.style.display = 'block';
    if (msg) msg.textContent = '';
  }
  // Mode A: finalize recovery (token link)
  const resetForm = document.getElementById('reset-form');
  if (resetForm) {
    const newInput = document.getElementById('new-password');
    const confirmInput = document.getElementById('confirm-password');
    const btn = document.getElementById('reset-btn');
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = newInput.value.trim();
      const confirm = confirmInput.value.trim();
      if (!password || !confirm) return showMessage('error', 'Both fields are required', 3000);
      if (password !== confirm) return showMessage('error', 'Passwords do not match', 3000);
      const resetBtn = setButtonLoading(btn, 'Updating...');
      try {
        // Check if logout all devices was requested (from URL or localStorage)
        const urlParams = new URLSearchParams(window.location.search);
        const logoutAllDevices = urlParams.get('logout_all_devices') === 'true';
        const logoutOption = localStorage.getItem('password_reset_logout_option');
        
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        
        // Clear logout option from localStorage
        if (logoutOption) {
          localStorage.removeItem('password_reset_logout_option');
        }
        
        // Handle logout based on option
        // Call server endpoint to invalidate all sessions immediately (including access tokens)
        if (logoutAllDevices || logoutOption === 'all') {
          // Invalidate all sessions server-side (including access tokens)
          try {
            const { addCsrfTokenToHeaders } = await import('../utils/csrf.js');
            const headers = await addCsrfTokenToHeaders({ 'Content-Type': 'application/json' });
            const invalidateRes = await fetch('/api/auth/invalidate-all-sessions', {
              method: 'POST',
              headers,
              body: JSON.stringify({ scope: 'all' })
            });
            
            if (invalidateRes.ok) {
              // Also sign out locally
              await supabase.auth.signOut();
              msg.textContent = 'Password updated successfully. All sessions have been invalidated. Please sign in again with your new password.';
              showMessage('success', 'Password updated and all sessions invalidated', 5000);
            } else {
              // Fallback to client-side signOut if server endpoint fails
              await supabase.auth.signOut();
              msg.textContent = 'Password updated successfully. All sessions have been logged out. Please sign in again with your new password.';
              showMessage('success', 'Password updated and all sessions logged out', 5000);
            }
          } catch (invalidateErr) {
            // Fallback to client-side signOut if request fails
            console.warn('[PASSWORD RESET] Failed to invalidate sessions server-side:', invalidateErr);
            await supabase.auth.signOut();
            msg.textContent = 'Password updated successfully. All sessions have been logged out. Please sign in again with your new password.';
            showMessage('success', 'Password updated and all sessions logged out', 5000);
          }
          
          // Redirect to login after 3 seconds
          setTimeout(() => {
            window.location.href = '/login';
          }, 3000);
        } else if (logoutOption === 'others') {
          // Invalidate other sessions server-side
          try {
            const { addCsrfTokenToHeaders } = await import('../utils/csrf.js');
            const headers = await addCsrfTokenToHeaders({ 'Content-Type': 'application/json' });
            const invalidateRes = await fetch('/api/auth/invalidate-all-sessions', {
              method: 'POST',
              headers,
              body: JSON.stringify({ scope: 'others' })
            });
            
            if (invalidateRes.ok) {
              // Also sign out other devices via client API
              await supabase.auth.signOut({ scope: 'others' });
              msg.textContent = 'Password updated successfully. All other sessions have been invalidated.';
              showMessage('success', 'Password updated and other sessions invalidated', 5000);
            } else {
              // Fallback
              await supabase.auth.signOut({ scope: 'others' });
              msg.textContent = 'Password updated successfully. All other sessions have been logged out.';
              showMessage('success', 'Password updated and other sessions logged out', 5000);
            }
          } catch (invalidateErr) {
            console.warn('[PASSWORD RESET] Failed to invalidate other sessions server-side:', invalidateErr);
            await supabase.auth.signOut({ scope: 'others' });
            msg.textContent = 'Password updated successfully. All other sessions have been logged out.';
            showMessage('success', 'Password updated and other sessions logged out', 5000);
          }
        } else {
          // Password change automatically invalidates refresh tokens server-side
          // Access tokens on other devices will expire naturally (~1 hour)
          msg.textContent = 'Password updated successfully. You can close this page and sign in with your new password.';
          showMessage('success', 'Password updated successfully', 4000);
        }
        
        newInput.value = '';
        confirmInput.value = '';
        temporarilyMark(btn, 'Updated', 'btn-success');
      } catch (err) {
        showMessage('error', err.message || 'Failed to reset password', 4000);
        temporarilyMark(btn, 'Failed', 'btn-danger');
      } finally {
        resetBtn();
      }
    });
  }
  // Mode B: logged-in change (require current password)
  const changeForm = document.getElementById('change-form');
  if (changeForm) {
    const currentInput = document.getElementById('current-password');
    const newInputLi = document.getElementById('new-password-li');
    const confirmInputLi = document.getElementById('confirm-password-li');
    const changeBtn = document.getElementById('change-btn');
    changeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const current = currentInput.value.trim();
      const password = newInputLi.value.trim();
      const confirm = confirmInputLi.value.trim();
      if (!current || !password || !confirm) return showMessage('error', 'All fields are required', 3000);
      if (password !== confirm) return showMessage('error', 'Passwords do not match', 3000);
      const resetBtn = setButtonLoading(changeBtn, 'Changing...');
      try {
        // Reauthenticate with current password
        const { data: userData } = await supabase.auth.getUser();
        const email = userData?.user?.email;
        if (!email) throw new Error('Cannot retrieve user email');
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: current });
        if (signInError) throw new Error('Current password is incorrect');
        // Check if logout all devices was requested (from user metadata)
        const logoutAllDevices = userData?.user?.user_metadata?.logout_all_devices_on_password_change === true;
        
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        
        // Clear the logout flag from metadata
        // Invalidate sessions server-side if requested
        if (logoutAllDevices) {
          await supabase.auth.updateUser({
            data: {
              ...userData.user.user_metadata,
              logout_all_devices_on_password_change: null
            }
          });
          
          // Invalidate other sessions server-side (including access tokens)
          try {
            const { addCsrfTokenToHeaders } = await import('../utils/csrf.js');
            const headers = await addCsrfTokenToHeaders({ 'Content-Type': 'application/json' });
            const invalidateRes = await fetch('/api/auth/invalidate-all-sessions', {
              method: 'POST',
              headers,
              body: JSON.stringify({ scope: 'others' })
            });
            
            if (invalidateRes.ok) {
              // Also sign out other devices via client API
              await supabase.auth.signOut({ scope: 'others' });
              showMessage('success', 'Password updated successfully. All other sessions have been invalidated.', 5000);
              msg.textContent = 'Password updated successfully. All other sessions have been invalidated.';
            } else {
              // Fallback
              await supabase.auth.signOut({ scope: 'others' });
              showMessage('success', 'Password updated successfully. All other sessions have been logged out.', 5000);
              msg.textContent = 'Password updated successfully. All other sessions have been logged out.';
            }
          } catch (invalidateErr) {
            console.warn('[PASSWORD CHANGE] Failed to invalidate other sessions server-side:', invalidateErr);
            await supabase.auth.signOut({ scope: 'others' });
            showMessage('success', 'Password updated successfully. All other sessions have been logged out.', 5000);
            msg.textContent = 'Password updated successfully. All other sessions have been logged out.';
          }
        } else {
          // Password change already invalidated refresh tokens server-side
          // Access tokens on other devices will expire naturally
          showMessage('success', 'Password updated successfully', 4000);
          msg.textContent = 'Password updated successfully.';
        }
        
        currentInput.value = '';
        newInputLi.value = '';
        confirmInputLi.value = '';
        temporarilyMark(changeBtn, 'Changed', 'btn-success');
      } catch (err) {
        showMessage('error', err.message || 'Failed to update password', 4000);
        temporarilyMark(changeBtn, 'Failed', 'btn-danger');
      } finally {
        resetBtn();
      }
    });
  }
  // Mode C: request reset link via email with confirmation modal
  const requestForm = document.getElementById('request-form');
  const confirmModal = document.getElementById('forgot-password-confirm-modal');
  const closeConfirmBtn = document.getElementById('close-forgot-confirm-modal');
  const cancelConfirmBtn = document.getElementById('cancel-forgot-confirm');
  const confirmBtn = document.getElementById('confirm-forgot-password');
  let pendingEmail = '';

  if (requestForm) {
    const emailInput = document.getElementById('request-email');
    const requestBtn = document.getElementById('request-btn');
    
    // Open confirmation modal instead of submitting directly
    requestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      if (!email) return showMessage('error', 'Email is required', 3000);
      pendingEmail = email;
      // Show confirmation modal
      if (confirmModal) {
        confirmModal.style.display = 'flex';
        confirmModal.style.visibility = 'visible';
        confirmModal.style.opacity = '1';
      }
    });
  }

  // Close confirmation modal
  const closeConfirmModal = () => {
    if (confirmModal) {
      confirmModal.style.display = 'none';
      confirmModal.style.visibility = 'hidden';
      confirmModal.style.opacity = '0';
      pendingEmail = '';
    }
  };

  if (closeConfirmBtn) closeConfirmBtn.addEventListener('click', closeConfirmModal);
  if (cancelConfirmBtn) cancelConfirmBtn.addEventListener('click', closeConfirmModal);
  if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) closeConfirmModal();
    });
  }

  // Handle confirmation and send reset email
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      if (!pendingEmail) return;
      
      const logoutOption = document.querySelector('input[name="logout-option"]:checked')?.value || 'none';
      const emailInput = document.getElementById('request-email');
      const requestBtn = document.getElementById('request-btn');
      
      closeConfirmModal();
      
      const resetBtn = setButtonLoading(requestBtn, 'Sending...');
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: pendingEmail,
            logoutOption: logoutOption // 'all', 'others', or 'none'
          })
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to send reset email');
        
        // Store logout option in localStorage to check after password reset
        if (logoutOption !== 'none') {
          localStorage.setItem('password_reset_logout_option', logoutOption);
        }
        
        showMessage('success', 'Reset link sent. Check your inbox.', 4000);
        msg.textContent = 'Reset link sent. Please check your inbox and follow the instructions.';
        emailInput.value = '';
        pendingEmail = '';
        temporarilyMark(requestBtn, 'Sent', 'btn-success');
      } catch (err) {
        showMessage('error', err.message || 'Failed to send reset email', 4000);
        msg.textContent = err.message || 'Failed to send reset email';
        temporarilyMark(requestBtn, 'Failed', 'btn-danger');
      } finally {
        resetBtn();
      }
    });
  }
});
