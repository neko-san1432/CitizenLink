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
  const nameEl = document.getElementById('profile-name')
  const emailEl = document.getElementById('profile-email')
  const mobileEl = document.getElementById('profile-mobile')
  if (nameEl) nameEl.textContent = profile?.name || profile?.full_name || '—'
  if (emailEl) emailEl.textContent = profile?.email || '—'
  if (mobileEl) mobileEl.textContent = profile?.mobile_number || profile?.mobile || '—'
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
    item.className = 'card p-3'
    const submittedAt = c.submitted_at ? new Date(c.submitted_at).toLocaleString() : ''
    item.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div class="font-semibold">${c.title || c.type || 'Complaint'}</div>
          <div class="text-sm text-gray-600">Status: ${c.status || '—'} • ${submittedAt}</div>
        </div>
        <a class="btn-secondary" href="/citizen/dashboard#complaint-${c.id}">View</a>
      </div>
    `
    container.appendChild(item)
  }
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
      showMessage('success', 'Password updated successfully', 3000)
      form.reset()
    } catch (err) {
      showMessage('error', err.message || 'Failed to change password', 4000)
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
  } catch (err) {
    showMessage('error', err.message || 'Failed to load profile', 4000)
  }
  wireChangePassword()
})


