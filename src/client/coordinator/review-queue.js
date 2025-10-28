/**
 * Coordinator Review Queue List Page
 * Shows all complaints pending review
 */

import { Toast } from '../components/toast.js';

let allComplaints = [];
let filteredComplaints = [];

/**
 * Initialize the review queue page
 */
document.addEventListener('DOMContentLoaded', async () => {
  await loadReviewQueue();
});

/**
 * Load review queue from API
 */
async function loadReviewQueue() {
  try {
    const response = await fetch('/api/coordinator/review-queue');

    if (!response.ok) {
      throw new Error('Failed to load review queue');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to load review queue');
    }

    allComplaints = result.data || [];
    filteredComplaints = [...allComplaints];

    renderQueue();
  } catch (error) {
    console.error('[REVIEW_QUEUE] Load error:', error);
    Toast.error(error.message);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('empty-state').style.display = 'block';
    document.getElementById('empty-state').innerHTML = `
      <h2>⚠️ Error</h2>
      <p>${error.message}</p>
    `;
  }
}

/**
 * Render the queue
 */
function renderQueue() {
  document.getElementById('loading').style.display = 'none';

  if (filteredComplaints.length === 0) {
    document.getElementById('empty-state').style.display = 'block';
    document.getElementById('complaint-list').style.display = 'none';
    updateStats();
    return;
  }

  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('complaint-list').style.display = 'grid';

  renderComplaints();
  updateStats();
}

/**
 * Render complaint cards
 */
function renderComplaints() {
  const list = document.getElementById('complaint-list');

  list.innerHTML = filteredComplaints.map(complaint => {
    const hasSimilar = complaint.similarities && complaint.similarities.length > 0;

    return `
      <div class="complaint-card priority-${complaint.priority}" 
           onclick="viewComplaint('${complaint.id}')">
        <div class="card-header">
          <h3 class="card-title">${complaint.title}</h3>
          <div class="card-badges">
            <span class="badge priority-${complaint.priority}">${complaint.priority}</span>
            ${hasSimilar ? '<span class="badge has-similar">⚠️ Similar</span>' : ''}
          </div>
        </div>
        <div class="card-content">
          ${truncate(complaint.descriptive_su, 150)}
        </div>
        <div class="card-meta">
          <div class="meta-item">
            <span>📍</span>
            ${complaint.location_text}
          </div>
          <div class="meta-item">
            <span>📂</span>
            ${complaint.type}
          </div>
          <div class="meta-item">
            <span>⏱️</span>
            ${formatDate(complaint.submitted_at)}
          </div>
          <div class="meta-item">
            <span>👤</span>
            ${complaint.submitted_by_profile?.name || complaint.submitted_by_profile?.email || 'Unknown'}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Update statistics
 */
function updateStats() {
  const total = allComplaints.length;
  const urgent = allComplaints.filter(c => c.priority === 'urgent').length;
  const high = allComplaints.filter(c => c.priority === 'high').length;
  const withSimilar = allComplaints.filter(c => c.similarities && c.similarities.length > 0).length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-urgent').textContent = urgent;
  document.getElementById('stat-high').textContent = high;
  document.getElementById('stat-similar').textContent = withSimilar;
}

/**
 * Apply filters
 */
window.applyFilters = function() {
  const priority = document.getElementById('filter-priority').value;
  const type = document.getElementById('filter-type').value;
  const similar = document.getElementById('filter-similar').value;

  filteredComplaints = allComplaints.filter(complaint => {
    if (priority && complaint.priority !== priority) return false;
    if (type && complaint.type !== type) return false;
    if (similar === 'yes' && (!complaint.similarities || complaint.similarities.length === 0)) return false;
    if (similar === 'no' && complaint.similarities && complaint.similarities.length > 0) return false;
    return true;
  });

  renderQueue();
};

/**
 * View complaint details
 */
window.viewComplaint = function(complaintId) {
  window.location.href = `/coordinator/review/${complaintId}`;
};

/**
 * Truncate text
 */
function truncate(text, length) {
  if (!text) return '';
  if (text.length <= length) return text;
  return `${text.substring(0, length)  }...`;
}

/**
 * Format date
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}
