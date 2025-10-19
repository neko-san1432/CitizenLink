/**
 * Super Admin Dashboard
 * System-wide management interface
 */

import showMessage from '../components/toast.js';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboardData();
  await loadLogs();
  setupFormHandlers();
  setupUserSearchSA();
});

/**
 * Load dashboard data
 */
async function loadDashboardData() {
  try {
    const [statsResponse, dashboardResponse] = await Promise.all([
      fetch('/api/superadmin/statistics'),
      fetch('/api/superadmin/dashboard')
    ]);

    const [statsResult, dashboardResult] = await Promise.all([
      statsResponse.json(),
      dashboardResponse.json()
    ]);

    if (statsResult.success) {
      updateStatistics(statsResult.statistics);
    }

    if (dashboardResult.success) {
      // Additional dashboard data if needed
      // console.log removed for security
    }
  } catch (error) {
    console.error('[SUPERADMIN] Load dashboard error:', error);
  }
}

/**
 * Update statistics display
 */
function updateStatistics(stats) {
  document.getElementById('stat-complaints').textContent = stats.total_complaints || 0;
  document.getElementById('stat-role-changes').textContent = stats.total_role_changes || 0;
  document.getElementById('stat-dept-transfers').textContent = stats.total_department_transfers || 0;
}

/**
 * Load system logs
 */
window.loadLogs = async function() {
  try {
    const logType = document.getElementById('log-type-filter').value;
    const response = await fetch(`/api/superadmin/logs?log_type=${logType}&limit=50`);
    const result = await response.json();

    if (result.success) {
      displayLogs(result.logs);
    }
  } catch (error) {
    console.error('[SUPERADMIN] Load logs error:', error);
    document.getElementById('logs-container').innerHTML = '<p style="color: #e74c3c;">Failed to load logs</p>';
  }
};

/**
 * Display logs
 */
function displayLogs(logs) {
  const container = document.getElementById('logs-container');

  const allLogs = [];

  // Combine all log types
  if (logs.role_changes) {
    logs.role_changes.forEach(log => {
      allLogs.push({ ...log, log_type: 'role_change' });
    });
  }

  if (logs.department_transfers) {
    logs.department_transfers.forEach(log => {
      allLogs.push({ ...log, log_type: 'dept_transfer' });
    });
  }

  if (logs.complaint_workflow) {
    logs.complaint_workflow.forEach(log => {
      allLogs.push({ ...log, log_type: 'complaint' });
    });
  }

  // Sort by date
  allLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (allLogs.length === 0) {
    container.innerHTML = '<p style="color: #7f8c8d;">No logs found</p>';
    return;
  }

  const html = allLogs.slice(0, 50).map(log => formatLogEntry(log)).join('');
  container.innerHTML = html;
}

/**
 * Format log entry
 */
function formatLogEntry(log) {
  const date = new Date(log.created_at).toLocaleString();
  let content = '';
  let typeLabel = '';
  let typeColor = '#667eea';

  if (log.log_type === 'role_change') {
    typeLabel = 'Role Change';
    typeColor = '#3498db';
    const userEmail = log.user?.email || 'Unknown';
    const performerEmail = log.performer?.email || 'System';
    content = `
      <strong>${userEmail}</strong>: ${log.old_role} → ${log.new_role}
      <div style="color: #7f8c8d; font-size: 0.9rem; margin-top: 5px;">By: ${performerEmail}</div>
      ${log.metadata?.reason ? `<div style="margin-top: 5px;">Reason: ${log.metadata.reason}</div>` : ''}
    `;
  } else if (log.log_type === 'dept_transfer') {
    typeLabel = 'Dept Transfer';
    typeColor = '#f39c12';
    const userEmail = log.user?.email || 'Unknown';
    const performerEmail = log.performer?.email || 'System';
    content = `
      <strong>${userEmail}</strong>: ${log.from_department || 'N/A'} → ${log.to_department}
      <div style="color: #7f8c8d; font-size: 0.9rem; margin-top: 5px;">By: ${performerEmail}</div>
      ${log.reason ? `<div style="margin-top: 5px;">Reason: ${log.reason}</div>` : ''}
    `;
  } else if (log.log_type === 'complaint') {
    typeLabel = 'Complaint';
    typeColor = '#27ae60';
    content = `
      <strong>${log.action_type}</strong>: Complaint #${log.complaint_id?.substring(0, 8)}...
      ${log.details ? `<div style="margin-top: 5px;">${JSON.stringify(log.details)}</div>` : ''}
    `;
  }

  return `
    <div class="log-entry">
      <div class="log-entry-header">
        <span class="log-type" style="background: ${typeColor};">${typeLabel}</span>
        <span style="color: #7f8c8d; font-size: 0.9rem;">${date}</span>
      </div>
      <div>${content}</div>
    </div>
  `;
}

/**
 * Setup form handlers
 */
function setupFormHandlers() {
  // Role Swap
  document.getElementById('role-swap-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('role-swap-user').value;
    const newRole = document.getElementById('role-swap-role').value;
    const reason = document.getElementById('role-swap-reason').value;

    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      return;
    }

    await performRoleSwap(userId, newRole, reason);
  });

  // Department Transfer
  document.getElementById('dept-transfer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('dept-transfer-user').value;
    const fromDept = document.getElementById('dept-transfer-from').value;
    const toDept = document.getElementById('dept-transfer-to').value;
    const reason = document.getElementById('dept-transfer-reason').value;

    await transferDepartment(userId, fromDept, toDept, reason);
  });

  // Assign Citizen
  document.getElementById('assign-citizen-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('assign-citizen-user').value;
    const role = document.getElementById('assign-citizen-role').value;
    const department = document.getElementById('assign-citizen-dept').value;
    const reason = document.getElementById('assign-citizen-reason').value;

    await assignCitizen(userId, role, department, reason);
  });

  // Log type filter change
  document.getElementById('log-type-filter').addEventListener('change', () => {
    loadLogs();
  });
}

function setupUserSearchSA() {
  const btn = document.getElementById('sa-user-search-btn');
  const input = document.getElementById('sa-user-search');
  const brgy = document.getElementById('sa-user-barangay');

  async function run() {
    const q = encodeURIComponent(input?.value || '');
    const b = encodeURIComponent(brgy?.value || '');
    const url = `/api/superadmin/users?search=${q}${b ? `&barangay=${b}` : ''}`;
    try {
      const res = await fetch(url);
      const result = await res.json();
      if (result.success) {
        renderUserListSA(result.data || []);
      } else {
        renderUserListSA([]);
      }
    } catch (e) {
      console.error('[SUPERADMIN] user search error:', e);
      renderUserListSA([]);
    }
  }

  if (btn) btn.addEventListener('click', run);
  if (input) input.addEventListener('keypress', (e) => { if (e.key === 'Enter') run(); });
}

function renderUserListSA(users) {
  const list = document.getElementById('sa-user-list');
  if (!list) return;
  if (!users.length) { list.innerHTML = '<p style="color:#7f8c8d;">No users found.</p>'; return; }
  list.innerHTML = users.map(u => `
    <div class="user-item" data-user-id="${u.id}" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
      <div><strong>${escapeHtml(u.fullName || u.name || u.email)}</strong></div>
      <div style="color:#7f8c8d; font-size:0.9rem;">${escapeHtml(u.email || '')}</div>
      <div style="color:#7f8c8d; font-size:0.9rem;">Role: ${escapeHtml(u.role || '')} | Brgy: ${escapeHtml(u.address?.barangay || '-')}</div>
    </div>
  `).join('');

  list.querySelectorAll('.user-item').forEach(el => {
    el.addEventListener('click', async () => {
      const id = el.getAttribute('data-user-id');
      await loadUserDetailsSA(id);
      await loadUserComplaintsSA(id);
    });
  });
}

async function loadUserDetailsSA(userId) {
  try {
    const res = await fetch(`/api/superadmin/users/${userId}`);
    const result = await res.json();
    const container = document.getElementById('sa-user-details');
    if (!container) return;
    if (result.success && result.data) {
      const u = result.data;
      container.innerHTML = `
        <div style="display:flex; gap:16px; align-items:center;">
          <div style="width:48px; height:48px; border-radius:50%; background:#eee;"></div>
          <div>
            <div style="font-weight:700; font-size:1.1rem;">${escapeHtml(u.fullName || u.name || u.email)}</div>
            <div style="color:#7f8c8d;">${escapeHtml(u.email || '')}</div>
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
  } catch (e) {
    console.error('[SUPERADMIN] load user details error:', e);
  }
}

async function loadUserComplaintsSA(userId) {
  try {
    const res = await fetch(`/api/superadmin/users/${userId}/complaints?limit=10`);
    const result = await res.json();
    const container = document.getElementById('sa-user-complaints');
    if (!container) return;
    if (result.success) {
      const complaints = result.data || [];
      if (!complaints.length) { container.innerHTML = '<p style="color:#7f8c8d;">No complaints found.</p>'; return; }
      container.innerHTML = complaints.map(c => `
        <div style="padding:12px; border:1px solid #eee; border-radius:6px; margin-bottom:8px; background:#fafafa;">
          <div style="display:flex; justify-content:space-between;">
            <strong>${escapeHtml(c.title || 'Untitled')}</strong>
            <span style="color:#7f8c8d; font-size:0.9rem;">${escapeHtml(c.status || '')}</span>
          </div>
          <div style="color:#7f8c8d; font-size:0.9rem;">Type: ${escapeHtml(c.type || '-')}</div>
          ${c.location_text ? `<div style=\"color:#7f8c8d; font-size:0.9rem;\">${escapeHtml(c.location_text)}</div>` : ''}
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p style="color:#e74c3c;">Failed to load complaints.</p>';
    }
  } catch (e) {
    console.error('[SUPERADMIN] load user complaints error:', e);
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Perform role swap
 */
async function performRoleSwap(userId, newRole, reason) {
  try {
    const response = await fetch('/api/superadmin/role-swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        new_role: newRole,
        reason
      })
    });

    const result = await response.json();

    if (result.success) {
      showMessage('success', result.message);
      document.getElementById('role-swap-form').reset();
      await loadDashboardData();
      await loadLogs();
    } else {
      showMessage('error', result.error);
    }
  } catch (error) {
    console.error('[SUPERADMIN] Role swap error:', error);
    showMessage('error', 'Failed to perform role swap');
  }
}

/**
 * Transfer department
 */
async function transferDepartment(userId, fromDept, toDept, reason) {
  try {
    const response = await fetch('/api/superadmin/transfer-department', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        from_department: fromDept,
        to_department: toDept,
        reason
      })
    });

    const result = await response.json();

    if (result.success) {
      showMessage('success', result.message);
      document.getElementById('dept-transfer-form').reset();
      await loadDashboardData();
      await loadLogs();
    } else {
      showMessage('error', result.error);
    }
  } catch (error) {
    console.error('[SUPERADMIN] Transfer department error:', error);
    showMessage('error', 'Failed to transfer department');
  }
}

/**
 * Assign citizen
 */
async function assignCitizen(userId, role, department, reason) {
  try {
    const response = await fetch('/api/superadmin/assign-citizen', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        role,
        department_id: department,
        reason
      })
    });

    const result = await response.json();

    if (result.success) {
      showMessage('success', result.message);
      document.getElementById('assign-citizen-form').reset();
      await loadDashboardData();
      await loadLogs();
    } else {
      showMessage('error', result.error);
    }
  } catch (error) {
    console.error('[SUPERADMIN] Assign citizen error:', error);
    showMessage('error', 'Failed to assign citizen');
  }
}
