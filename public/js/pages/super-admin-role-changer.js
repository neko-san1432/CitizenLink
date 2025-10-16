// Super Admin Role Changer Page Script
async function loadBarangays() {
  try {
    const res = await fetch('/api/boundaries');
    const data = await res.json();
    const sel = document.getElementById('sa-rc-brgy');
    if (!Array.isArray(data)) return;
    const names = data.map(b => b.name || b.properties?.name).filter(Boolean).sort();
    names.forEach(n => { 
      const opt = document.createElement('option'); 
      opt.value = n; 
      opt.textContent = n; 
      sel.appendChild(opt); 
    });
  } catch (e) { 
    console.warn('Failed to load barangays', e); 
  }
}

function escapeHtml(s) {
  return (s == null ? '' : String(s))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function search() {
  const q = encodeURIComponent(document.getElementById('sa-rc-search').value || '');
  const b = encodeURIComponent(document.getElementById('sa-rc-brgy').value || '');
  const url = `/api/superadmin/users?search=${q}${b ? `&barangay=${b}` : ''}`;
  const res = await fetch(url); 
  const result = await res.json();
  const list = document.getElementById('sa-rc-list');
  if (!result.success || !Array.isArray(result.data) || !result.data.length) {
    list.innerHTML = '<p class="muted" style="padding:8px;">No users found.</p>'; 
    return;
  }
  list.innerHTML = result.data.map(u => `
    <div class="item" data-id="${u.id}">
      <div><strong>${escapeHtml(u.fullName || u.name || u.email)}</strong></div>
      <div class="muted">${escapeHtml(u.email || '')}</div>
      <div class="muted">Role: ${escapeHtml(u.role || '')} | Brgy: ${escapeHtml(u.address?.barangay || '-')}</div>
    </div>
  `).join('');
  list.querySelectorAll('.item').forEach(el => el.addEventListener('click', () => selectUser(el.getAttribute('data-id'))));
}

async function selectUser(id) {
  const [ud, cd] = await Promise.all([
    fetch(`/api/superadmin/users/${id}`).then(r => r.json()),
    fetch(`/api/superadmin/users/${id}/complaints?limit=10`).then(r => r.json())
  ]);
  const det = document.getElementById('sa-rc-details');
  if (ud.success) {
    const u = ud.data;
    det.innerHTML = `
      <div style="display:flex; gap:12px; align-items:center;">
        <div style="width:48px;height:48px;border-radius:50%;background:#eee;"></div>
        <div>
          <div style="font-weight:700">${escapeHtml(u.fullName || u.name || u.email)}</div>
          <div class="muted">${escapeHtml(u.email || '')}</div>
        </div>
      </div>
      <div class="row" style="margin-top:10px;">
        <div><strong>Role:</strong> ${escapeHtml(u.role || '')}</div>
        <div><strong>Department:</strong> ${escapeHtml(u.department || '-')}</div>
        <div><strong>Barangay:</strong> ${escapeHtml(u.address?.barangay || '-')}</div>
        <div><strong>City:</strong> ${escapeHtml(u.address?.city || '-')}</div>
      </div>
    `;
    det.setAttribute('data-user-id', id);
  }
  const comp = document.getElementById('sa-rc-complaints');
  if (cd.success) {
    const list = cd.data || [];
    comp.innerHTML = list.length ? list.map(c => `
      <div style="padding:10px;border:1px solid #eee;border-radius:6px;margin-bottom:8px;background:#fafafa;">
        <div style="display:flex;justify-content:space-between;">
          <strong>${escapeHtml(c.title || 'Untitled')}</strong>
          <span class="muted">${escapeHtml(c.status || '')}</span>
        </div>
        <div class="muted">Type: ${escapeHtml(c.type || '-')}</div>
      </div>
    `).join('') : '<p class="muted">No complaints.</p>';
  }
}

async function assignRole() {
  const id = document.getElementById('sa-rc-details').getAttribute('data-user-id');
  if (!id) return;
  const role = document.getElementById('sa-rc-role').value;
  const dept = document.getElementById('sa-rc-dept').value;
  if (!role) return;
  try {
    const res = await fetch('/api/superadmin/role-swap', {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ 
        user_id: id, 
        new_role: role, 
        reason: dept ? `Assigned via role changer (${dept})` : 'Assigned via role changer' 
      })
    });
    await selectUser(id);
  } catch (e) { 
    console.error(e); 
  }
}

// Initialize event listeners
document.getElementById('sa-rc-search-btn').addEventListener('click', search);
document.getElementById('sa-rc-search').addEventListener('keypress', (e) => { 
  if (e.key === 'Enter') search(); 
});
document.getElementById('sa-rc-assign').addEventListener('click', assignRole);
loadBarangays();
