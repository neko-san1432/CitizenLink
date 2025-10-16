import { getUserRole } from '../auth/authChecker.js'
import { brandConfig, apiClient } from '../config/index.js'
import { getActiveRole, isInCitizenMode } from '../auth/roleToggle.js'

const root = ''
const _sidebarEl = document.getElementById("sidebar");

// Sidebar close button functionality (menu-toggle is handled in header.js)
function initializeSidebarClose() {
  const sidebar = document.getElementById('sidebar');
  const sidebarClose = document.getElementById('sidebar-close');
  
  if (sidebarClose && sidebar) {
    sidebarClose.addEventListener('click', function() {
      sidebar.classList.remove('open');
    });
    console.log('✅ Sidebar close button initialized');
  }
}

if (_sidebarEl) _sidebarEl.innerHTML=`
<div class="sidebar-brand">
  <a href="${brandConfig.dashboardUrl}" class="brand-link">${brandConfig.name}</a>
  <button id="sidebar-close" class="sidebar-close">×</button>
</div>
<a href="${root}/dashboard">Dashboard</a>
<a href="${root}/citizen/fileComplaint">File Complaint</a>
<a href="${root}/myProfile">My Profile</a>
`

async function setSidebarRole() {
  try {
    const roleRaw = await getUserRole({ refresh: true })
    const role = (roleRaw == null ? '' : String(roleRaw)).trim().toLowerCase()
    
    // Check if user can file complaints (citizen or in citizen mode)
    const activeRole = getActiveRole()
    const inCitizenMode = isInCitizenMode()
    const canFileComplaint = activeRole === 'citizen' || inCitizenMode
    
    const isLguPrefixed = /^lgu-/.test(role || '')
    const afterPrefix = isLguPrefixed ? role.replace(/^lgu-/, '') : ''
    const firstSegment = isLguPrefixed ? (afterPrefix.split('-')[0] || '') : ''
    const isLguAdmin = role === 'lgu-admin' || /^lgu-admin-/.test(role)
    const isLguOfficer = /^lgu-(?!admin|hr)/.test(role) // Matches lgu-wst, lgu-engineering, etc. but NOT lgu-admin-* or lgu-hr-*
    const isCoordinator = role === 'complaint-coordinator'
    const isHR = role === 'lgu-hr' || /^lgu-hr-/.test(role) // Support lgu-hr-wst, lgu-hr-engineering, etc.
    const isSuperAdmin = role === 'super-admin'

    // Debug logging
    console.log('🔧 Sidebar role detection:', {
      roleRaw,
      role,
      activeRole,
      inCitizenMode,
      canFileComplaint,
      isLguAdmin,
      isLguOfficer,
      isHR,
      isCoordinator,
      isSuperAdmin
    })

    // Update localStorage with the correct role for future use
    if (roleRaw) {
      const { saveUserMeta } = await import('../auth/authChecker.js');
      saveUserMeta({ role: roleRaw });
    }

    const links = []
    
    // Role-specific links (feature-specific pages, not dashboards)
    if (isSuperAdmin) {
      links.push({ href: `${root}/appointAdmins`, label: '🔐 Appoint Admins' })
      links.push({ href: `${root}/admin/departments`, label: '🏢 Departments' })
      links.push({ href: `${root}/super-admin/role-changer`, label: '🛠️ Role Changer' })
    } else if (isHR) {
      links.push({ href: `${root}/hr/role-changer`, label: '🛠️ Role Changer' })
      links.push({ href: `${root}/hr/link-generator`, label: '🔗 Link Generator' })
    } else if (isCoordinator) {
      links.push({ href: `${root}/coordinator/review-queue`, label: '📋 Review Queue' })
      links.push({ href: `${root}/hr/link-generator`, label: '🔗 Link Generator' })
    } else if (isLguAdmin) {
      console.log('✅ LGU Admin detected - adding admin links')
      links.push({ href: `${root}/lgu-admin/assignments`, label: '📋 Department Assignments' })
      links.push({ href: `${root}/heatmap`, label: 'Heatmap' })
      links.push({ href: `${root}/publish`, label: 'Publish Content' })
    } else if (isLguOfficer) {
      console.log('✅ LGU Officer detected - adding officer links')
      links.push({ href: `${root}/taskAssigned`, label: '📝 Assigned Tasks' })
    }
    
    // Sign out link
    links.push({ href: `${root}/__signout__`, label: 'Sign out', action: 'signout' })
    
    const html = links.map(l => `<a href="${l.href}" data-action="${l.action || ''}">${l.label}</a>`).join('\n')
    
    // Build sidebar HTML - only show File Complaint if user is citizen or in citizen mode
    const fileComplaintLink = canFileComplaint 
      ? `<a href="${root}/citizen/fileComplaint">File Complaint</a>` 
      : ''

    // Dashboard label
    const dashboardLabel = 'Dashboard'
    
    if (_sidebarEl) _sidebarEl.innerHTML = `
<div class="sidebar-brand">
  <a href="${brandConfig.dashboardUrl}" class="brand-link">${brandConfig.name}</a>
  <button id="sidebar-close" class="sidebar-close">×</button>
</div>
<a href="${root}/dashboard">${dashboardLabel}</a>
${fileComplaintLink}
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
    
    // Re-initialize sidebar close button after HTML is updated
    initializeSidebarClose();
  } catch {}
}

setSidebarRole()

// Initialize sidebar close button when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeSidebarClose)