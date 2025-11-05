import showMessage from '../components/toast.js'
import { supabase as supabaseProxy } from '../config/config.js'
import { setButtonLoading, temporarilyMark } from '../utils/buttonState.js'

async function ensureSessionFromLink() {
  try {
    const supabase = await supabaseProxy
    // Supabase sends access_token in the URL hash for recovery
    // SECURITY: Extract hash immediately and clear from URL to prevent token exposure
    if (window.location.hash && window.location.hash.includes('access_token')) {
      const hashFragment = window.location.hash
      
      // Parse hash fragment to extract tokens
      const hashParams = new URLSearchParams(hashFragment.substring(1)) // Remove # prefix
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const type = hashParams.get('type')
      
      // For password reset links, use setSession with access_token
      // For OAuth flows, use exchangeCodeForSession with code
      if (accessToken && (type === 'recovery' || hashFragment.includes('type=recovery'))) {
        // Password reset flow: use setSession
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        })
        if (error) {
          console.error('[RESET PASSWORD] Failed to set session:', error)
          return false
        }
      } else if (hashFragment.includes('code=')) {
        // OAuth flow: use exchangeCodeForSession
        await supabase.auth.exchangeCodeForSession(hashFragment)
      } else if (accessToken) {
        // Fallback: try setSession if we have access_token
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        })
        if (error) {
          console.error('[RESET PASSWORD] Failed to set session:', error)
          return false
        }
      }
      
      // SECURITY: Clear hash from URL immediately after processing to prevent token exposure
      // Use replaceState to remove hash without triggering page reload
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      } else {
        // Fallback: redirect to clean URL
        window.location.hash = ''
      }
    }
    return true
  } catch (error) {
    console.error('[RESET PASSWORD] Error processing reset link:', error)
    return false
  }
}
document.addEventListener('DOMContentLoaded', async () => {
  // SECURITY: Process token immediately and clear from URL
  const hadToken = window.location.hash && window.location.hash.includes('access_token')
  const hadRecoveryToken = hadToken && (window.location.hash.includes('type=recovery') || window.location.hash.includes('type%3Drecovery'))
  await ensureSessionFromLink()
  const supabase = await supabaseProxy
  const { data: sessionData } = await supabase.auth.getSession()
  
  // Check if user came from password reset link (recovery type)
  // This takes priority even if they have a session, because reset links create temporary sessions
  const isRecoveryFlow = hadRecoveryToken && Boolean(sessionData?.session)
  
  // Check if user is logged in normally (not from reset link)
  // Only consider logged in if they didn't just come from a reset link
  const isLoggedIn = Boolean(sessionData?.session) && !hadRecoveryToken
  
  const modeRecovery = document.getElementById('mode-recovery')
  const modeLoggedIn = document.getElementById('mode-logged-in')
  const modeRequest = document.getElementById('mode-request')
  const msg = document.getElementById('message')
  
  // SECURITY: Hide all modes first, then show only the correct one
  if (modeRecovery) modeRecovery.style.display = 'none'
  if (modeLoggedIn) modeLoggedIn.style.display = 'none'
  if (modeRequest) modeRequest.style.display = 'none'
  
  // Choose mode based on context
  // Priority: Recovery flow (from reset link) > Logged in > Request reset link
  if (isRecoveryFlow) {
    // User came from password reset email link - NO current password needed!
    if (modeRecovery) modeRecovery.style.display = 'block'
    if (msg) msg.textContent = 'Enter your new password below to finish resetting it.'
  } else if (isLoggedIn) {
    // User is already logged in normally (not from reset link), allow password change
    // This requires current password for security
    if (modeLoggedIn) modeLoggedIn.style.display = 'block'
    if (msg) msg.textContent = 'You\'re signed in. Change your password securely by confirming your current password.'
  } else {
    // User needs to request a password reset link
    if (modeRequest) modeRequest.style.display = 'block'
    if (msg) msg.textContent = ''
  }
  // Mode A: finalize recovery (token link)
  const resetForm = document.getElementById('reset-form')
  if (resetForm) {
    const newInput = document.getElementById('new-password')
    const confirmInput = document.getElementById('confirm-password')
    const btn = document.getElementById('reset-btn')
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const password = newInput.value.trim()
      const confirm = confirmInput.value.trim()
      if (!password || !confirm) return showMessage('error', 'Both fields are required', 3000)
      if (password !== confirm) return showMessage('error', 'Passwords do not match', 3000)
      const resetBtn = setButtonLoading(btn, 'Updating...')
      try {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        msg.textContent = 'Password updated successfully. You can close this page and sign in with your new password.'
        showMessage('success', 'Password updated successfully', 4000)
        newInput.value = ''
        confirmInput.value = ''
        temporarilyMark(btn, 'Updated', 'btn-success')
      } catch (err) {
        showMessage('error', err.message || 'Failed to reset password', 4000)
        temporarilyMark(btn, 'Failed', 'btn-danger')
      } finally {
        resetBtn()
      }
    })
  }
  // Mode B: logged-in change (require current password)
  const changeForm = document.getElementById('change-form')
  if (changeForm) {
    const currentInput = document.getElementById('current-password')
    const newInputLi = document.getElementById('new-password-li')
    const confirmInputLi = document.getElementById('confirm-password-li')
    const changeBtn = document.getElementById('change-btn')
    changeForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const current = currentInput.value.trim()
      const password = newInputLi.value.trim()
      const confirm = confirmInputLi.value.trim()
      if (!current || !password || !confirm) return showMessage('error', 'All fields are required', 3000)
      if (password !== confirm) return showMessage('error', 'Passwords do not match', 3000)
      const resetBtn = setButtonLoading(changeBtn, 'Changing...')
      try {
        // Reauthenticate with current password
        const { data: userData } = await supabase.auth.getUser()
        const email = userData?.user?.email
        if (!email) throw new Error('Cannot retrieve user email')
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: current })
        if (signInError) throw new Error('Current password is incorrect')
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        showMessage('success', 'Password updated successfully', 4000)
        msg.textContent = 'Password updated successfully.'
        currentInput.value = ''
        newInputLi.value = ''
        confirmInputLi.value = ''
        temporarilyMark(changeBtn, 'Changed', 'btn-success')
      } catch (err) {
        showMessage('error', err.message || 'Failed to update password', 4000)
        temporarilyMark(changeBtn, 'Failed', 'btn-danger')
      } finally {
        resetBtn()
      }
    })
  }
  // Mode C: request reset link via email
  const requestForm = document.getElementById('request-form')
  if (requestForm) {
    const emailInput = document.getElementById('request-email')
    const requestBtn = document.getElementById('request-btn')
    requestForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = emailInput.value.trim()
      if (!email) return showMessage('error', 'Email is required', 3000)
      const resetBtn = setButtonLoading(requestBtn, 'Sending...')
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to send reset email')
        showMessage('success', 'Reset link sent. Check your inbox.', 4000)
        msg.textContent = 'Reset link sent. Please check your inbox and follow the instructions.'
        emailInput.value = ''
        temporarilyMark(requestBtn, 'Sent', 'btn-success')
      } catch (err) {
        showMessage('error', err.message || 'Failed to send reset email', 4000)
        msg.textContent = err.message || 'Failed to send reset email'
        temporarilyMark(requestBtn, 'Failed', 'btn-danger')
      } finally {
        resetBtn()
      }
    })
  }
})
