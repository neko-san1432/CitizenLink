import { apiClient } from '../../config/apiClient.js';
import { showToast } from '../../components/toast.js';

async function fetchComplaintStats() {
  try {
    const { data } = await apiClient.get('/api/complaints/stats');
    return data && data.success ? data : null;
  } catch (e) {
    showToast('Failed to load complaint stats', 'error');
    return null;
  }
}

function renderStats(stats) {
  const countEl = document.getElementById('dept-complaint-count');
  const resEl = document.getElementById('resolution-info');
  if (!countEl || !resEl) return;

  if (!stats) {
    countEl.textContent = '—';
    resEl.textContent = '';
    return;
  }

  const totalReceived = (stats.data && stats.data.byDepartment && stats.data.byDepartment.totalReceived) || stats.total || 0;
  countEl.textContent = String(totalReceived);

  // Determine resolution timing info
  const slaEnabled = Boolean(stats.data && (stats.data.avgResolutionHours || stats.data.slaHours));
  if (slaEnabled) {
    const avgHrs = stats.data.avgResolutionHours || null;
    const slaHrs = stats.data.slaHours || null;
    const parts = [];
    if (avgHrs != null) parts.push(`Avg resolution: ${avgHrs}h`);
    if (slaHrs != null) parts.push(`SLA: ${slaHrs}h`);
    resEl.textContent = parts.join(' • ');
  } else {
    resEl.textContent = 'No resolution time configured';
  }
}

async function init() {
  const stats = await fetchComplaintStats();
  renderStats(stats);
}

document.addEventListener('DOMContentLoaded', init);


