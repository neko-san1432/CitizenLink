import showMessage from '../components/toast.js'
import { supabase as supabaseProxy } from '../config/config.js'

async function ensureSessionFromLink() {
  try {
    const supabase = await supabaseProxy
    // Supabase sends access_token in the URL hash for recovery
    if (window.location.hash && window.location.hash.includes('access_token')) {
      await supabase.auth.exchangeCodeForSession(window.location.hash)
    }
    return true
  } catch {
    return false
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await ensureSessionFromLink()
  const supabase = await supabaseProxy
  const { data: sessionData } = await supabase.auth.getSession()

  const hasToken = Boolean(window.location.hash && window.location.hash.includes('access_token'))
  const isLoggedIn = Boolean(sessionData?.session)

  const modeRecovery = document.getElementById('mode-recovery')
  const modeLoggedIn = document.getElementById('mode-logged-in')
  const modeRequest = document.getElementById('mode-request')
  const msg = document.getElementById('message')

  // Choose mode
  if (hasToken) {
    modeRecovery.style.display = 'block'
  } else if (isLoggedIn) {
    modeLoggedIn.style.display = 'block'
  } else {
    modeRequest.style.display = 'block'
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
      btn.disabled = true
      try {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        msg.textContent = 'Password updated successfully. You can close this page and sign in with your new password.'
        showMessage('success', 'Password updated successfully', 4000)
        newInput.value = ''
        confirmInput.value = ''
      } catch (err) {
        showMessage('error', err.message || 'Failed to reset password', 4000)
      } finally {
        btn.disabled = false
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
      changeBtn.disabled = true
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
      } catch (err) {
        showMessage('error', err.message || 'Failed to update password', 4000)
      } finally {
        changeBtn.disabled = false
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
      requestBtn.disabled = true
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
      } catch (err) {
        showMessage('error', err.message || 'Failed to send reset email', 4000)
        msg.textContent = err.message || 'Failed to send reset email'
      } finally {
        requestBtn.disabled = false
      }
    })
  }
})


