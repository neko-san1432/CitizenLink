// HR Role Changer Page Script
async function loadBarangays() {
  try {
    const res = await fetch('/api/boundaries');
    const data = await res.json();
    const sel = document.getElementById('rc-brgy');
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
  const q = encodeURIComponent(document.getElementById('rc-search').value || '');
  const b = encodeURIComponent(document.getElementById('rc-brgy').value || '');
  const url = `/api/hr/users?search=${q}${b ? `&barangay=${b}` : ''}`;
  try {
    const res = await fetch(url);
    const result = await res.json();
    const list = document.getElementById('rc-list');
    if (!result.success || !Array.isArray(result.data) || result.data.length === 0) {
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
  } catch (e) {
    console.error(e);
  }
}

async function selectUser(id) {
  try {
    const [ud, cd] = await Promise.all([
      fetch(`/api/hr/users/${id}`).then(r => r.json()),
      fetch(`/api/hr/users/${id}/complaints?limit=10`).then(r => r.json())
    ]);
    const det = document.getElementById('rc-details');
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
        <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn secondary" onclick="promote('${id}','officer')">Promote to Officer</button>
          <button class="btn" onclick="promote('${id}','admin')">Promote to Admin</button>
        </div>
      `;
    }
    const comp = document.getElementById('rc-complaints');
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
  } catch (e) { 
    console.error(e); 
  }
}

async function promote(id, level) {
  try {
    if (level === 'officer') {
      await fetch('/api/hr/promote-to-officer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: id })
      });
    } else if (level === 'admin') {
      await fetch('/api/hr/promote-to-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: id })
      });
    }
    await selectUser(id);
  } catch (e) { 
    console.error(e); 
  }
}

// Initialize event listeners
document.getElementById('rc-search-btn').addEventListener('click', search);
document.getElementById('rc-search').addEventListener('keypress', (e) => { 
  if (e.key === 'Enter') search(); 
});
loadBarangays();
