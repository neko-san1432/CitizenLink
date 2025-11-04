import { getUserRole, refreshMetaFromSession } from '../auth/authChecker.js'
import showMessage from '../components/toast.js'

async function enforceCitizenOnly() {
  try {
    // Prefer server-derived cached role
    let role = await getUserRole({ refresh: false })
    if (!role) {
      const refreshed = await refreshMetaFromSession()
      role = refreshed?.role || null
    }
    if (role !== 'citizen') {
      window.location.href = '/'
      return false
    }
    return true
  } catch {
    window.location.href = '/login'
    return false
  }
}
async function fetchProfile() {
  const res = await fetch('/api/auth/profile')
  if (!res.ok) throw new Error('Failed to load profile')
  const json = await res.json()
  return json?.data || {}
}
async function fetchMyComplaints() {
  const res = await fetch('/api/complaints/my?limit=20')
  if (!res.ok) throw new Error('Failed to load complaints')
  const json = await res.json()
  return Array.isArray(json?.data) ? json.data : []
}
function renderProfile(profile) {
  const name = profile?.name || profile?.full_name || 'User'
  const email = profile?.email || '—'
  // Mobile number from raw_user_meta_data (already extracted in backend)
  const mobile = profile?.mobileNumber || profile?.mobile_number || profile?.mobile || '—'
  // Update profile name
  const nameEl = document.getElementById('profile-name')
  if (nameEl) {
    const spanEl = nameEl.querySelector('span') || nameEl
    if (spanEl.tagName === 'SPAN') {
      spanEl.textContent = name
    } else {
      nameEl.textContent = name
    }
  }
  // Update email
  const emailEl = document.getElementById('profile-email')
  if (emailEl) {
    const spanEl = emailEl.querySelector('span') || emailEl
    if (spanEl.tagName === 'SPAN') {
      spanEl.textContent = email
    } else {
      emailEl.textContent = email
    }
  }
  // Update avatar initial
  const initialEl = document.getElementById('profile-initial')
  if (initialEl && name !== '—') {
    initialEl.textContent = name.charAt(0).toUpperCase()
  }
  // Update mobile in card
  const mobileEl = document.getElementById('profile-mobile')
  if (mobileEl) mobileEl.textContent = mobile || '—'
  // Update member since date from auth.users.created_at
  const memberSinceEl = document.getElementById('member-since')
  // Check both created_at (root level) and timestamps.created (nested)
  const createdDate = profile?.created_at || profile?.timestamps?.created
  if (memberSinceEl && createdDate) {
    const date = new Date(createdDate)
    // Check if date is valid
    if (!isNaN(date.getTime())) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      memberSinceEl.textContent = `${monthNames[date.getMonth()]} ${date.getFullYear()}`
    } else {
      memberSinceEl.textContent = '—'
    }
  } else if (memberSinceEl) {
    memberSinceEl.textContent = '—'
  }
}
function renderComplaints(list) {
  const container = document.getElementById('my-complaints')
  const empty = document.getElementById('complaints-empty')
  if (!container || !empty) return
  container.innerHTML = ''
  if (!list.length) {
    empty.classList.remove('hidden')
    return
  }
  empty.classList.add('hidden')
  for (const c of list) {
    const item = document.createElement('div')
    item.className = 'complaint-card'
    const submittedAt = c.submitted_at ? new Date(c.submitted_at).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }) : ''
    const status = (c.workflow_status || 'unknown').toLowerCase().replace(/\s+/g, '_')
    const statusLabel = formatStatus(c.workflow_status)
    item.innerHTML = `
      <div class="complaint-card-header">
        <div class="complaint-title">${c.title || 'Complaint'}</div>
        <a class="btn-secondary" href="/complaint-details/${c.id}" style="text-decoration: none; flex-shrink: 0;">View</a>
      </div>
      <div class="complaint-meta">
        <span class="status-badge status-${status}">${statusLabel}</span>
        <span class="complaint-date">${submittedAt}</span>
      </div>
    `
    container.appendChild(item)
  }
}
function formatStatus(status) {
  if (!status) return 'Unknown'
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
function updateStatistics(complaints) {
  // Statistics are no longer displayed in the compact layout
  // This function is kept for backward compatibility but does nothing
}
function scrollToAnchorIfNeeded() {
  // Anchor scrolling no longer needed with new layout
  // This function is kept for backward compatibility but does nothing
}
function wireChangePassword() {
  const form = document.getElementById('change-password-form')
  const messageEl = document.getElementById('email-confirmation-message')
  if (!form) return
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const currentPassword = document.getElementById('current-password')?.value || ''
    const newPassword = document.getElementById('new-password')?.value || ''
    const confirmNewPassword = document.getElementById('confirm-new-password')?.value || ''
    // Validate inputs
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      showMessage('error', 'All password fields are required', 4000)
      return
    }
    if (newPassword !== confirmNewPassword) {
      showMessage('error', 'New passwords do not match', 4000)
      return
    }
    try {
      const res = await fetch('/api/auth/request-password-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to request password change')
      // Show success message with email confirmation info
      if (messageEl) {
        messageEl.textContent = json.message || 'A confirmation email has been sent to your email address. Please check your inbox and click the confirmation link to complete the password change.'
        messageEl.classList.remove('hidden')
      }
      showMessage('success', 'Password change request sent! Please check your email for confirmation.', 5000)
      form.reset()
      // Hide message after 10 seconds
      setTimeout(() => {
        if (messageEl) messageEl.classList.add('hidden')
      }, 10000)
    } catch (err) {
      showMessage('error', err.message || 'Failed to request password change', 4000)
      if (messageEl) messageEl.classList.add('hidden')
    }
  })
}
document.addEventListener('DOMContentLoaded', async () => {
  if (!(await enforceCitizenOnly())) return
  try {
    const [profile, complaints] = await Promise.all([
      fetchProfile(),
      fetchMyComplaints()
    ])
    renderProfile(profile)
    renderComplaints(complaints)
    // Prefill edit form
    const nameInput = document.getElementById('edit-name')
    const mobileInput = document.getElementById('edit-mobile')
    if (nameInput) nameInput.value = profile?.name || profile?.full_name || ''
    if (mobileInput) mobileInput.value = profile?.mobileNumber || profile?.mobile_number || profile?.mobile || ''
  } catch (err) {
    showMessage('error', err.message || 'Failed to load profile', 4000)
  }
  wireChangePassword()
})
// Wire up profile edit (name and mobile)
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('profile-edit-form')
  if (!form) return
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const name = (document.getElementById('edit-name')?.value || '').trim()

    const mobile = (document.getElementById('edit-mobile')?.value || '').trim()

    if (!name && !mobile) {
      showMessage('error', 'Enter a name or mobile number to update', 3000)
      return
    }
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mobileNumber: mobile })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to update profile')
      // Re-render with updated data
      renderProfile(json.data)
      showMessage('success', 'Profile updated successfully', 3000)
    } catch (err) {
      showMessage('error', err.message || 'Update failed', 4000)
    }
  })
})
