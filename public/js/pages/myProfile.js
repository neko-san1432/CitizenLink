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
  const mobile = profile?.mobile_number || profile?.mobile || '—'
  
  // Update header
  const nameEl = document.getElementById('profile-name')
  const emailEl = document.getElementById('profile-email')
  if (nameEl) nameEl.textContent = name
  if (emailEl) emailEl.textContent = email
  
  // Update avatar initial
  const initialEl = document.getElementById('profile-initial')
  if (initialEl && name !== '—') {
    initialEl.textContent = name.charAt(0).toUpperCase()
  }
  
  // Update mobile in card
  const mobileEl = document.getElementById('profile-mobile')
  if (mobileEl) mobileEl.textContent = mobile
}

function renderComplaints(list) {
  const container = document.getElementById('my-complaints')
  const empty = document.getElementById('complaints-empty')
  if (!container || !empty) return
  container.innerHTML = ''
  if (!list.length) {
    empty.classList.remove('hidden')
    updateStatistics(list)
    return
  }
  empty.classList.add('hidden')
  
  // Calculate statistics
  updateStatistics(list)
  
  for (const c of list) {
    const item = document.createElement('div')
    item.className = 'complaint-card'
    const submittedAt = c.submitted_at ? new Date(c.submitted_at).toLocaleString() : ''
    const status = (c.workflow_status || 'unknown').toLowerCase().replace(/\s+/g, '_')
    const statusLabel = formatStatus(c.workflow_status)
    
    item.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div style="flex: 1;">
          <div style="font-weight: 600; margin-bottom: 0.5rem; color: #1f2937;">
            ${c.title || 'Complaint'}
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span class="status-badge status-${status}">${statusLabel}</span>
            <span style="color: #6b7280; font-size: 0.875rem;">${submittedAt}</span>
          </div>
        </div>
        <a class="btn-secondary" href="/complaint-details/${c.id}" style="text-decoration: none;">View</a>
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
  const total = complaints.length
  const active = complaints.filter(c => {
    const status = (c.workflow_status || '').toLowerCase()
    return status === 'in_progress' || status === 'assigned'
  }).length
  const resolved = complaints.filter(c => {
    const status = (c.workflow_status || '').toLowerCase()
    return status === 'completed'
  }).length
  
  document.getElementById('total-complaints').textContent = total
  document.getElementById('active-complaints').textContent = active
  document.getElementById('resolved-complaints').textContent = resolved
}

function wireChangePassword() {
  const form = document.getElementById('change-password-form')
  if (!form) return
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const currentPassword = document.getElementById('current-password')?.value || ''
    const newPassword = document.getElementById('new-password')?.value || ''
    const confirmNewPassword = document.getElementById('confirm-new-password')?.value || ''
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to change password')
      showMessage('success', 'Password updated successfully! Redirecting to dashboard...', 3000)
      form.reset()
      // Redirect to dashboard after showing success message
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err) {
      showMessage('error', err.message || 'Failed to change password', 4000)
    }
  })
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!(await enforceCitizenOnly())) return
  try {
    // Initialize statistics to 0
    updateStatistics([])
    
    const [profile, complaints] = await Promise.all([
      fetchProfile(),
      fetchMyComplaints()
    ])
    renderProfile(profile)
    renderComplaints(complaints)
  } catch (err) {
    showMessage('error', err.message || 'Failed to load profile', 4000)
  }
  wireChangePassword()
})


