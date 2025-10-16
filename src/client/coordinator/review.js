/**
 * Coordinator Complaint Review Page
 * Handles loading and reviewing individual complaints
 */

import { Toast } from '../components/toast.js';

let currentComplaint = null;
let complaintId = null;

/**
 * Initialize the review page
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Get complaint ID from URL
  const pathParts = window.location.pathname.split('/');
  complaintId = pathParts[pathParts.length - 1];

  if (!complaintId || complaintId === 'review') {
    showError('No complaint ID provided');
    return;
  }

  await loadComplaint();
});

/**
 * Load complaint details
 */
async function loadComplaint() {
  try {
    const response = await fetch(`/api/coordinator/review-queue/${complaintId}`);
    
    if (!response.ok) {
      throw new Error('Failed to load complaint');
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to load complaint');
    }

    currentComplaint = result.data;
    renderComplaint();
  } catch (error) {
    console.error('[REVIEW] Load error:', error);
    showError(error.message);
  }
}

/**
 * Render complaint details
 */
async function renderComplaint() {
  const complaint = currentComplaint.complaint;
  const similarities = currentComplaint.similarities || [];
  
  // Hide loading, show content
  document.getElementById('loading').style.display = 'none';
  document.getElementById('complaint-content').style.display = 'block';

  // Header
  document.getElementById('complaint-title').textContent = complaint.title;
  document.getElementById('complaint-id').textContent = complaint.id;
  document.getElementById('submitted-date').textContent = formatDate(complaint.submitted_at);
  document.getElementById('submitter-name').textContent = 
    complaint.submitted_by_profile?.name || complaint.submitted_by_profile?.email || 'Unknown';

  // Status badge
  const statusEl = document.getElementById('complaint-status');
  statusEl.innerHTML = `<span class="badge status-${complaint.status.replace(' ', '-')}">${complaint.status}</span>`;

  // Priority badge
  const priorityEl = document.getElementById('complaint-priority');
  priorityEl.innerHTML = `<span class="badge priority-${complaint.priority}">${complaint.priority}</span>`;

  // Details
  document.getElementById('complaint-type').textContent = complaint.type;
  const subtypeEl = document.getElementById('complaint-subtype');
  if (complaint.subtype) {
    subtypeEl.textContent = ` - ${complaint.subtype}`;
  }

  document.getElementById('complaint-description').textContent = complaint.descriptive_su;
  document.getElementById('complaint-location').textContent = complaint.location_text;

  // Show complainant's department preference
  const preferenceEl = document.getElementById('complainant-preference');
  if (preferenceEl) {
    const departments = complaint.department_r || [];
    if (departments.length > 0) {
      const deptNames = {
        'wst': 'Water, Sanitation & Treatment',
        'engineering': 'Engineering',
        'health': 'Health',
        'social-welfare': 'Social Welfare',
        'public-safety': 'Public Safety',
        'environmental': 'Environmental Services',
        'transportation': 'Transportation',
        'public-works': 'Public Works'
      };
      const displayNames = departments.map(dept => deptNames[dept] || dept);
      preferenceEl.textContent = displayNames.join(', ');
    } else {
      preferenceEl.textContent = 'No preference specified';
    }
  }

  // Map preview (read-only)
  try {
    const mapEl = document.getElementById('location-map');
    const hasLat = complaint.latitude !== null && complaint.latitude !== undefined;
    const hasLng = complaint.longitude !== null && complaint.longitude !== undefined;
    if (mapEl && (hasLat || hasLng)) {
      const ensureLeaflet = () => typeof L !== 'undefined' ? Promise.resolve() : new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        s.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
        s.crossOrigin = '';
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });

      await ensureLeaflet();
      const lat = Number(complaint.latitude);
      const lng = Number(complaint.longitude);
      const valid = !Number.isNaN(lat) && !Number.isNaN(lng);
      const center = valid ? [lat, lng] : [6.75, 125.35];
      const map = L.map('location-map', { zoomControl: true }).setView(center, valid ? 15 : 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);
      if (valid) {
        L.marker(center).addTo(map);
      }
      setTimeout(() => map.invalidateSize(), 200);
    }
  } catch (e) {
    console.warn('[REVIEW] Map init failed:', e);
  }

  // Evidence (always show section with fallback)
  const evidenceSection = document.getElementById('evidence-section');
  const evidenceEmpty = document.getElementById('evidence-empty');
  const evidenceList = complaint.evidence && Array.isArray(complaint.evidence) ? complaint.evidence : [];
  if (evidenceList.length > 0) {
    if (evidenceSection) evidenceSection.style.display = 'block';
    if (evidenceEmpty) evidenceEmpty.style.display = 'none';
    renderEvidence(evidenceList);
  } else {
    if (evidenceSection) evidenceSection.style.display = 'block';
    if (evidenceEmpty) evidenceEmpty.style.display = 'block';
    const grid = document.getElementById('evidence-grid');
    if (grid) grid.innerHTML = '';
  }

  // Similar complaints
  if (similarities.length > 0) {
    document.getElementById('similar-section').style.display = 'block';
    document.getElementById('duplicate-btn').style.display = 'block';
    document.getElementById('related-btn').style.display = 'block';
    document.getElementById('unique-btn').style.display = 'block';
    renderSimilarComplaints(similarities);
  }
}

/**
 * Render evidence images
 */
function renderEvidence(evidence) {
  const grid = document.getElementById('evidence-grid');

  const normalize = (item) => {
    // Support both DB_FORMAT.sql (snake_case) and existing code (camelCase)
    const url = item.publicUrl || item.url || item.public_url || null;
    const fileName = item.fileName || item.file_name || item.name || 'file';
    const filePath = item.filePath || item.file_path || item.path || null;
    const fileType = item.fileType || item.file_type || item.type || '';
    const fileSize = item.fileSize || item.file_size || item.size || null;
    return { url, fileName, filePath, fileType, fileSize };
  };

  const isImage = (type, name) => {
    if (type && type.startsWith('image/')) return true;
    const n = (name || '').toLowerCase();
    return n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.png') || n.endsWith('.webp');
  };

  const isVideo = (type, name) => {
    if (type && type.startsWith('video/')) return true;
    const n = (name || '').toLowerCase();
    return n.endsWith('.mp4') || n.endsWith('.mov') || n.endsWith('.webm');
  };

  const isPdf = (type, name) => {
    return (type === 'application/pdf') || (name || '').toLowerCase().endsWith('.pdf');
  };

  const formatSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '';
    const units = ['B','KB','MB','GB'];
    let i = 0; let n = Number(bytes);
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  };

  grid.innerHTML = evidence.map(raw => {
    const item = normalize(raw);
    const href = item.url || (item.filePath ? item.filePath : '#');
    const sizeText = item.fileSize ? ` · ${formatSize(item.fileSize)}` : '';
    const typeText = item.fileType ? item.fileType : '';

    if (isImage(item.fileType, item.fileName) && item.url) {
      return `
    <a class="evidence-item" href="${href}" target="_blank" rel="noopener noreferrer" title="${item.fileName}">
      <img src="${item.url}" alt="${item.fileName}">
    </a>`;
    }

    if (isVideo(item.fileType, item.fileName) && item.url) {
      return `
    <a class="evidence-item" href="${href}" target="_blank" rel="noopener noreferrer" title="${item.fileName}" style="display:flex;align-items:center;justify-content:center;">
      🎥 ${item.fileName}
    </a>`;
    }

    if (isPdf(item.fileType, item.fileName)) {
      return `
    <a class="evidence-item" href="${href}" target="_blank" rel="noopener noreferrer" title="${item.fileName}" style="display:flex;align-items:center;justify-content:center;">
      📄 ${item.fileName}
    </a>`;
    }

    return `
    <a class="evidence-item" href="${href}" target="_blank" rel="noopener noreferrer" title="${item.fileName}" style="display:flex;align-items:center;justify-content:center;">
      📎 ${item.fileName}${typeText || sizeText ? `<div style='position:absolute;left:8px;bottom:8px;font-size:12px;color:#333;background:#fff;padding:2px 6px;border-radius:4px;'>${[typeText, sizeText].filter(Boolean).join(' ')}</div>` : ''}
    </a>`;
  }).join('');
}

/**
 * Render similar complaints
 */
function renderSimilarComplaints(similarities) {
  const list = document.getElementById('similar-list');
  const masterSelect = document.getElementById('master-complaint');
  
  list.innerHTML = similarities.map(sim => `
    <div class="similar-item">
      <h4>${sim.similar_complaint?.title || 'Unknown'}</h4>
      <div class="similar-meta">
        ${sim.similar_complaint?.type || ''} | 
        ${sim.similar_complaint?.status || ''} | 
        ${formatDate(sim.similar_complaint?.submitted_at)}
        <span class="similarity-score">${Math.round(sim.similarity_score * 100)}% match</span>
      </div>
    </div>
  `).join('');

  // Populate master complaint dropdown
  masterSelect.innerHTML = '<option value="">Select master complaint...</option>' +
    similarities.map(sim => `
      <option value="${sim.similar_complaint_id}">
        ${sim.similar_complaint?.title} (${Math.round(sim.similarity_score * 100)}% match)
      </option>
    `).join('');
}

/**
 * Modal functions
 */
window.openAssignModal = function() {
  document.getElementById('assign-modal').classList.add('active');
  // Pre-fill priority from complaint
  document.getElementById('assign-priority').value = currentComplaint.complaint.priority || 'medium';
};

window.openDuplicateModal = function() {
  document.getElementById('duplicate-modal').classList.add('active');
};

window.openRelatedModal = function() {
  Toast.info('Link related complaints feature coming soon');
};

window.openRejectModal = function() {
  document.getElementById('reject-modal').classList.add('active');
};

window.closeModal = function(modalId) {
  document.getElementById(modalId).classList.remove('active');
};

/**
 * Handle assign to department
 */
window.handleAssign = async function(event) {
  event.preventDefault();

  const selectedDepartments = Array.from(document.querySelectorAll('.dept-check:checked')).map(el => el.value);
  const priority = document.getElementById('assign-priority').value;
  const deadline = document.getElementById('deadline').value;
  const notes = document.getElementById('notes').value;

  try {
    const response = await fetch(`/api/coordinator/review-queue/${complaintId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'assign_department',
        data: {
          departments: selectedDepartments,
          options: {
            priority,
            deadline: deadline || null,
            notes: notes || null
          }
        }
      })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to assign complaint');
    }

    Toast.success('Complaint assigned successfully!');
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1500);
  } catch (error) {
    console.error('[REVIEW] Assign error:', error);
    Toast.error(error.message);
  }
};

/**
 * Handle mark as duplicate
 */
window.handleDuplicate = async function(event) {
  event.preventDefault();

  const masterComplaintId = document.getElementById('master-complaint').value;
  const reason = document.getElementById('duplicate-reason').value;

  try {
    const response = await fetch(`/api/coordinator/review-queue/${complaintId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'mark_duplicate',
        data: {
          masterComplaintId,
          reason
        }
      })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to mark as duplicate');
    }

    Toast.success('Complaint marked as duplicate');
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1500);
  } catch (error) {
    console.error('[REVIEW] Duplicate error:', error);
    Toast.error(error.message);
  }
};

/**
 * Handle reject complaint
 */
window.handleReject = async function(event) {
  event.preventDefault();

  const reason = document.getElementById('reject-reason').value;

  try {
    const response = await fetch(`/api/coordinator/review-queue/${complaintId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'reject',
        data: {
          reason
        }
      })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to reject complaint');
    }

    Toast.success('Complaint rejected');
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1500);
  } catch (error) {
    console.error('[REVIEW] Reject error:', error);
    Toast.error(error.message);
  }
};

/**
 * Mark complaint as unique (no duplicates)
 */
window.markAsUnique = async function() {
  try {
    const response = await fetch(`/api/coordinator/review-queue/${complaintId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'mark_unique',
        data: {}
      })
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to mark as unique');
    }

    Toast.success('Complaint marked as unique');
    
    // Hide similar complaints section
    document.getElementById('similar-section').style.display = 'none';
    document.getElementById('duplicate-btn').style.display = 'none';
    document.getElementById('related-btn').style.display = 'none';
    document.getElementById('unique-btn').style.display = 'none';
  } catch (error) {
    console.error('[REVIEW] Unique error:', error);
    Toast.error(error.message);
  }
};

/**
 * Show error message
 */
function showError(message) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error-message').style.display = 'block';
  document.getElementById('error-text').textContent = message;
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
  
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

