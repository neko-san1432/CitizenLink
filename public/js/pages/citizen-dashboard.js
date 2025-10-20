import { apiClient } from '../../src/client/config/apiClient.js';
import { showToast } from '../../src/client/components/toast.js';

function formatElapsed(fromIso) {
  const from = new Date(fromIso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - from);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function fetchOngoingComplaint() {
  try {
    // We consider statuses: 'in progress' or 'in_progress' as ongoing
    const { data } = await apiClient.get('/api/complaints/my?status=in%20progress&limit=1');
    let complaint = (data && data.data && data.data[0]) || null;

    // fallback for alternate status naming
    if (!complaint) {
      const { data: alt } = await apiClient.get('/api/complaints/my?status=in_progress&limit=1');
      complaint = (alt && alt.data && alt.data[0]) || null;
    }
    return complaint;
  } catch (e) {
    showToast('Failed to load ongoing complaint', 'error');
    return null;
  }
}

async function fetchNews() {
  try {
    const { data } = await apiClient.get('/api/content/news?limit=5');
    return data && data.data ? data.data : [];
  } catch {
    showToast('Failed to load news', 'error');
    return [];
  }
}

async function fetchNotices() {
  try {
    const { data } = await apiClient.get('/api/content/notices?limit=5');
    return data && data.data ? data.data : [];
  } catch {
    showToast('Failed to load notices', 'error');
    return [];
  }
}

async function fetchEvents() {
  try {
    const { data } = await apiClient.get('/api/content/events?limit=5&status=upcoming');
    return data && data.data ? data.data : [];
  } catch {
    showToast('Failed to load events', 'error');
    return [];
  }
}

function renderOngoing(complaint) {
  const el = document.getElementById('ongoing-complaint');
  if (!el) return;
  if (!complaint) {
    el.innerHTML = `
      <div class="card">
        <div class="card-body">
          <h3>No ongoing complaints</h3>
          <p>You have no complaints in progress.</p>
        </div>
      </div>`;
    return;
  }

  const startedAt = complaint.submitted_at || complaint.created_at;
  el.innerHTML = `
    <div class="card">
      <div class="card-body">
        <h3>Ongoing Complaint</h3>
        <p><strong>${complaint.title || 'Untitled'}</strong></p>
        <p>Status: ${complaint.status}</p>
        <p>Started ${formatElapsed(startedAt)}</p>
      </div>
    </div>`;
}

function renderList(containerId, items, mapItem) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<p class="text-muted">No items available.</p>';
    return;
  }
  el.innerHTML = items.map(mapItem).join('');
}

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function init() {
  const [ongoing, news, notices, events] = await Promise.all([
    fetchOngoingComplaint(),
    fetchNews(),
    fetchNotices(),
    fetchEvents()
  ]);

  renderOngoing(ongoing);

  renderList('news-list', news, (n) => `
    <article class="card">
      <div class="card-body">
        <h3>${escapeHtml(n.title)}</h3>
        <p>${escapeHtml(n.excerpt || '')}</p>
        <small>Published ${n.published_at ? formatElapsed(n.published_at) : ''}</small>
      </div>
    </article>`);

  renderList('notices-list', notices, (n) => `
    <article class="card">
      <div class="card-body">
        <div><strong>[${escapeHtml(n.priority || 'normal')}]</strong> ${escapeHtml(n.title || '')}</div>
        <p>${escapeHtml(n.content || '')}</p>
        <small>Active since ${n.valid_from ? formatElapsed(n.valid_from) : ''}</small>
      </div>
    </article>`);

  renderList('events-list', events, (e) => `
    <article class="card">
      <div class="card-body">
        <h3>${escapeHtml(e.title)}</h3>
        <p>${escapeHtml(e.location || '')}</p>
        <small>Starts ${e.event_date ? formatElapsed(e.event_date) : ''}</small>
      </div>
    </article>`);
}

document.addEventListener('DOMContentLoaded', init);


