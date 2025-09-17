import { getUserRole } from '../auth/authChecker.js'
const root = ''
const _sidebarEl = document.getElementById("sidebar");
if (_sidebarEl) _sidebarEl.innerHTML=`
<a href="${root}/myProfile">My Profile</a>
<a href="${root}/fileComplaint">File Complaint</a>
`

async function setSidebarRole() {
  try {
    const role = await getUserRole()
    const links = []
    if (role === 'super-admin') {
      links.push({ href: `${root}/dashboard`, label: 'Dashboard' })
    } else if (role === 'lgu-admin') {
      links.push({ href: `${root}/dashboard`, label: 'Dashboard' })
    } else if (role === 'lgu' || /^lgu-/.test(role || '')) {
      links.push({ href: `${root}/dashboard`, label: 'Dashboard' })
      links.push({ href: `${root}/taskAssigned`, label: 'Task Assigned' })
    } else if (role === 'citizen') {
      links.push({ href: `${root}/dashboard`, label: 'Dashboard' })
      links.push({ href: `${root}/myComplaints`, label: 'My Complaints' })
    }
    const html = links.map(l => `<a href="${l.href}">${l.label}</a>`).join('\n')
    if (_sidebarEl) _sidebarEl.innerHTML = `
<a href="${root}/myProfile">My Profile</a>
<a href="${root}/fileComplaint">File Complaint</a>
${html}
`
  } catch {}
}

setSidebarRole()