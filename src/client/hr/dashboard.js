/**
 * HR Dashboard
 * Role management interface for HR personnel
 */

import showMessage from '../components/toast.js';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboardData();
  setupFormHandlers();
  setupUserSearch();
});

/**
 * Load dashboard data
 */
async function loadDashboardData() {
  try {
    const response = await fetch('/api/hr/dashboard');
    const result = await response.json();

    if (result.success) {
      updateStatistics(result.data.statistics);
    }
  } catch (error) {
    console.error('[HR] Load dashboard error:', error);
  }
}

/**
 * Update statistics display
 */
function updateStatistics(stats) {
  document.getElementById('stat-officers').textContent = stats.total_officers || 0;
  document.getElementById('stat-admins').textContent = stats.total_admins || 0;
  document.getElementById('stat-promotions').textContent = stats.promotions_this_month || 0;
  document.getElementById('stat-demotions').textContent = stats.demotions_this_month || 0;
}

/**
 * Setup form handlers
 */
function setupFormHandlers() {
  // Promote to Officer
  document.getElementById('promote-officer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('promote-officer-user').value;
    const department = document.getElementById('promote-officer-dept').value;
    const reason = document.getElementById('promote-officer-reason').value;

    await promoteToOfficer(userId, department, reason);
  });

  // Promote to Admin
  document.getElementById('promote-admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('promote-admin-user').value;
    const department = document.getElementById('promote-admin-dept').value;
    const reason = document.getElementById('promote-admin-reason').value;

    await promoteToAdmin(userId, department, reason);
  });

  // Demote to Officer
  document.getElementById('demote-officer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('demote-officer-user').value;
    const reason = document.getElementById('demote-officer-reason').value;

    await demoteToOfficer(userId, reason);
  });

  // Strip Titles
  document.getElementById('strip-titles-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('strip-titles-user').value;
    const reason = document.getElementById('strip-titles-reason').value;

    if (!confirm('Are you sure you want to strip all titles from this user? This will revert them to citizen status.')) {
      return;
    }

    await stripTitles(userId, reason);
  });

  // Assign Department
  document.getElementById('assign-dept-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('assign-dept-user').value;
    const departmentId = document.getElementById('assign-dept-id').value;

    await assignDepartment(userId, departmentId);
  });

  // View Role History
  document.getElementById('role-history-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('role-history-user').value;

    await viewRoleHistory(userId);
  });
}

/**
 * User search & detail wiring
 */
function setupUserSearch() {
  const searchBtn = document.getElementById('user-search-btn');
  const searchInput = document.getElementById('user-search-input');
  const barangayInput = document.getElementById('user-filter-barangay');

  async function runSearch() {
    const q = encodeURIComponent(searchInput.value || '');
    const brgy = encodeURIComponent(barangayInput.value || '');
    const url = `/api/hr/users?search=${q}${brgy ? `&barangay=${brgy}` : ''}`;
    try {
      const res = await fetch(url);
      const result = await res.json();
      if (result.success) {
        renderUserList(result.data || []);
      } else {
        renderUserList([]);
      }
    } catch (err) {
      console.error('[HR] user search error:', err);
      renderUserList([]);
    }
  }

  if (searchBtn) searchBtn.addEventListener('click', runSearch);
  if (searchInput) searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') runSearch();
  });
}

function renderUserList(users) {
  const list = document.getElementById('user-list');
  if (!list) return;
  if (!users.length) {
    list.innerHTML = '<p style="color:#7f8c8d; padding:8px;">No users found.</p>';
    return;
  }
  list.innerHTML = users.map(u => (
    `<div class="user-item" data-user-id="${u.id}">
      <div><strong>${escapeHtml(u.fullName || u.name || u.email)}</strong></div>
      <div class="user-meta">${escapeHtml(u.email || '')}</div>
      <div class="user-meta">Role: ${escapeHtml(u.role || '')} | Brgy: ${escapeHtml(u.address?.barangay || '-')}</div>
    </div>`
  )).join('');

  // Click to load details
  list.querySelectorAll('.user-item').forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.getAttribute('data-user-id');
      await loadUserDetails(id);
      await loadUserComplaints(id);
    });
  });
}

async function loadUserDetails(userId) {
  try {
    const res = await fetch(`/api/hr/users/${userId}`);
    const result = await res.json();
    const container = document.getElementById('user-details');
    if (!container) return;
    if (result.success && result.data) {
      const u = result.data;
      container.innerHTML = `
        <div style="display:flex; gap:16px; align-items:center;">
          <div style="width:48px; height:48px; border-radius:50%; background:#eee;"></div>
          <div>
            <div style="font-weight:700; font-size:1.1rem;">${escapeHtml(u.fullName || u.name || u.email)}</div>
            <div class="user-meta">${escapeHtml(u.email || '')}</div>
          </div>
        </div>
        <div style="margin-top:12px; display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
          <div><strong>Role:</strong> ${escapeHtml(u.role || '')}</div>
          <div><strong>Department:</strong> ${escapeHtml(u.department || '-')}</div>
          <div><strong>Barangay:</strong> ${escapeHtml(u.address?.barangay || '-')}</div>
          <div><strong>City:</strong> ${escapeHtml(u.address?.city || '-')}</div>
          <div><strong>Mobile:</strong> ${escapeHtml(u.mobileNumber || '-')}</div>
        </div>
      `;
    } else {
      container.innerHTML = '<p style="color:#e74c3c;">Failed to load user.</p>';
    }
  } catch (err) {
    console.error('[HR] load user details error:', err);
  }
}

async function loadUserComplaints(userId) {
  try {
    const res = await fetch(`/api/hr/users/${userId}/complaints?limit=10`);
    const result = await res.json();
    const container = document.getElementById('user-complaints');
    if (!container) return;
    if (result.success) {
      const complaints = result.data || [];
      if (!complaints.length) {
        container.innerHTML = '<p style="color:#7f8c8d;">No complaints found.</p>';
        return;
      }
      container.innerHTML = complaints.map(c => `
        <div style="padding:12px; border:1px solid #eee; border-radius:6px; margin-bottom:8px; background:#fafafa;">
          <div style="display:flex; justify-content:space-between;">
            <strong>${escapeHtml(c.title || 'Untitled')}</strong>
            <span class="user-meta">${escapeHtml(c.status || '')}</span>
          </div>
          <div class="user-meta">Type: ${escapeHtml(c.type || '-')}</div>
          ${c.location_text ? `<div class="user-meta">${escapeHtml(c.location_text)}</div>` : ''}
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p style="color:#e74c3c;">Failed to load complaints.</p>';
    }
  } catch (err) {
    console.error('[HR] load user complaints error:', err);
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Promote to Officer
 */
async function promoteToOfficer(userId, department, reason) {
  try {
    const response = await fetch('/api/hr/promote-to-officer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        department,
        reason
      })
    });

    const result = await response.json();

    if (result.success) {
      showMessage('success', result.message);
      document.getElementById('promote-officer-form').reset();
      await loadDashboardData();
    } else {
      showMessage('error', result.error);
    }
  } catch (error) {
    console.error('[HR] Promote to officer error:', error);
    showMessage('error', 'Failed to promote user');
  }
}

/**
 * Promote to Admin
 */
async function promoteToAdmin(userId, department, reason) {
  try {
    const response = await fetch('/api/hr/promote-to-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        department,
        reason
      })
    });

    const result = await response.json();

    if (result.success) {
      showMessage('success', result.message);
      document.getElementById('promote-admin-form').reset();
      await loadDashboardData();
    } else {
      showMessage('error', result.error);
    }
  } catch (error) {
    console.error('[HR] Promote to admin error:', error);
    showMessage('error', 'Failed to promote user');
  }
}

/**
 * Demote to Officer
 */
async function demoteToOfficer(userId, reason) {
  try {
    const response = await fetch('/api/hr/demote-to-officer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        reason
      })
    });

    const result = await response.json();

    if (result.success) {
      showMessage('success', result.message);
      document.getElementById('demote-officer-form').reset();
      await loadDashboardData();
    } else {
      showMessage('error', result.error);
    }
  } catch (error) {
    console.error('[HR] Demote to officer error:', error);
    showMessage('error', 'Failed to demote user');
  }
}

/**
 * Strip Titles
 */
async function stripTitles(userId, reason) {
  try {
    const response = await fetch('/api/hr/strip-titles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        reason
      })
    });

    const result = await response.json();

    if (result.success) {
      showMessage('success', result.message);
      document.getElementById('strip-titles-form').reset();
      await loadDashboardData();
    } else {
      showMessage('error', result.error);
    }
  } catch (error) {
    console.error('[HR] Strip titles error:', error);
    showMessage('error', 'Failed to strip titles');
  }
}

/**
 * Assign Department
 */
async function assignDepartment(userId, departmentId) {
  try {
    const response = await fetch('/api/hr/assign-department', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        department_id: departmentId
      })
    });

    const result = await response.json();

    if (result.success) {
      showMessage('success', result.message);
      document.getElementById('assign-dept-form').reset();
    } else {
      showMessage('error', result.error);
    }
  } catch (error) {
    console.error('[HR] Assign department error:', error);
    showMessage('error', 'Failed to assign department');
  }
}

/**
 * View Role History
 */
async function viewRoleHistory(userId) {
  try {
    const response = await fetch(`/api/hr/role-history/${userId}`);
    const result = await response.json();

    const container = document.getElementById('role-history-results');

    if (result.success && result.history) {
      if (result.history.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d;">No role history found for this user.</p>';
        return;
      }

      const html = `
        <div style="margin-top: 20px;">
          <h4>Role Change History</h4>
          <div style="max-height: 400px; overflow-y: auto;">
            ${result.history.map(entry => `
              <div style="padding: 15px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px; background: #f9f9f9;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <strong>${entry.old_role} → ${entry.new_role}</strong>
                  <span style="color: #7f8c8d; font-size: 0.9rem;">${new Date(entry.created_at).toLocaleString()}</span>
                </div>
                ${entry.metadata && entry.metadata.reason ? `<div style="color: #555;">Reason: ${entry.metadata.reason}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
      container.innerHTML = html;
    } else {
      container.innerHTML = '<p style="color: #e74c3c;">Failed to load role history.</p>';
    }
  } catch (error) {
    console.error('[HR] View role history error:', error);
    showMessage('error', 'Failed to load role history');
  }
}
