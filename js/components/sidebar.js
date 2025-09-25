import { getUserRole } from '../auth/authChecker.js'
import { brandConfig, apiClient } from '../config/index.js'

const root = ''
const _sidebarEl = document.getElementById("sidebar");

// Sidebar toggle functionality
function initializeSidebarToggle() {
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const app = document.getElementById('app');
  const sidebarClose = document.getElementById('sidebar-close');
  
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', function() {
      sidebar.classList.toggle('open');
      // App stays in place - no need to toggle classes
    });
  }
  
  if (sidebarClose && sidebar) {
    sidebarClose.addEventListener('click', function() {
      sidebar.classList.remove('open');
      // App stays in place - no need to toggle classes
    });
  }
}

if (_sidebarEl) _sidebarEl.innerHTML=`
<div class="sidebar-brand">
  <a href="${brandConfig.dashboardUrl}" class="brand-link">${brandConfig.name}</a>
  <button id="sidebar-close" class="sidebar-close">×</button>
</div>
<a href="${root}/dashboard">Dashboard</a>
<a href="${root}/fileComplaint">File Complaint</a>
<a href="${root}/myProfile">My Profile</a>
`

async function setSidebarRole() {
  try {
    const roleRaw = await getUserRole()
    const role = (roleRaw == null ? '' : String(roleRaw)).trim().toLowerCase()
    const isLguPrefixed = /^lgu-/.test(role || '')
    const afterPrefix = isLguPrefixed ? role.replace(/^lgu-/, '') : ''
    const firstSegment = isLguPrefixed ? (afterPrefix.split('-')[0] || '') : ''
    const isLguAdmin = role === 'lgu-admin' || (isLguPrefixed && firstSegment === 'admin')
    const isLguDept = role === 'lgu' || (isLguPrefixed && firstSegment !== 'admin')
    const links = []
    if (role === 'super-admin') {
      links.push({ href: `${root}/appointAdmins`, label: 'Appoint Admins' })
    } else if (isLguAdmin) {
      links.push({ href: `${root}/heatmap`, label: 'Heatmap' })
      links.push({ href: `${root}/publish`, label: 'Publish Content' })
      links.push({ href: `${root}/appointMembers`, label: 'Appoint Members' })
    } else if (isLguDept) {
      links.push({ href: `${root}/taskAssigned`, label: 'Task Assigned' })
    } else if (role === 'citizen') {
      // Dashboard already added manually above
    }
    // Sign out link
    links.push({ href: `${root}/__signout__`, label: 'Sign out', action: 'signout' })
    const html = links.map(l => `<a href="${l.href}" data-action="${l.action || ''}">${l.label}</a>`).join('\n')
    if (_sidebarEl) _sidebarEl.innerHTML = `
<div class="sidebar-brand">
  <a href="${brandConfig.dashboardUrl}" class="brand-link">${brandConfig.name}</a>
  <button id="sidebar-close" class="sidebar-close">×</button>
</div>
<a href="${root}/dashboard">Dashboard</a>
<a href="${root}/fileComplaint">File Complaint</a>
${html}
<a href="${root}/myProfile">My Profile</a>
`
    // Wire sign out
    try {
      const signoutLink = _sidebarEl.querySelector('a[data-action="signout"]')
      if (signoutLink) {
        signoutLink.addEventListener('click', async (e) => {
          e.preventDefault()
          try {
            // Client-side sign out
            await apiClient.supabase.auth.signOut()
          } catch {}
          try { await fetch('/auth/session', { method: 'DELETE' }) } catch {}
          window.location.href = '/login'
        })
      }
    } catch {}
  } catch {}
}

setSidebarRole()

// Initialize sidebar toggle when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeSidebarToggle)