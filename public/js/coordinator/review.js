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
  // The service returns complaint in nested structure
  const complaint = currentComplaint.complaint;
  const similarities = currentComplaint.analysis?.duplicate_candidates || 
                     currentComplaint.analysis?.similar_complaints || 
                     currentComplaint.similarities || [];

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
  const status = complaint.workflow_status || complaint.status || 'unknown';
  statusEl.innerHTML = `<span class="badge status-${status.replace(' ', '-')}">${status}</span>`;

  // Priority badge
  const priorityEl = document.getElementById('complaint-priority');
  priorityEl.innerHTML = `<span class="badge priority-${complaint.priority}">${complaint.priority}</span>`;

  // Details - Handle both old and new hierarchical form structure
  const typeText = complaint.type || complaint.category || 'Not specified';
  const subcategoryText = complaint.subcategory || '';
  
  document.getElementById('complaint-type').textContent = typeText;
  const subtypeEl = document.getElementById('complaint-subtype');
  if (subcategoryText) {
    subtypeEl.textContent = ` - ${subcategoryText}`;
  } else {
    subtypeEl.textContent = '';
  }

  document.getElementById('complaint-description').textContent = complaint.descriptive_su;
  document.getElementById('complaint-location').textContent = complaint.location_text;

  // Show complainant's department preference
  const preferenceEl = document.getElementById('complainant-preference');
  if (preferenceEl) {
    const departments = complaint.department_r || [];
    if (departments.length > 0) {
      // Handle both numeric IDs and department codes
      const displayNames = departments.map(dept => {
        // Check if it's a numeric ID (like "79") or a department code (like "CEO")
        if (typeof dept === 'number' || /^\d+$/.test(dept)) {
          // Numeric department ID mapping
          const numericDeptNames = {
            '69': 'City Engineering Office',
            '70': 'City General Services Office',
            '71': 'City Planning and Development Coordinator',
            '72': 'Digos City Health Office',
            '73': 'City Social Welfare and Development Office',
            '74': 'City Disaster Risk Reduction and Management Office',
            '75': 'City Environment and Natural Resources Office',
            '76': 'City Treasurer\'s Office',
            '77': 'City Economic Enterprise Office',
            '78': 'Human Resource Management Office',
            '79': 'Philippine National Police - Digos City Station',
            '80': 'City Legal Office',
            '81': 'Office of the City Mayor',
            '82': 'Public Assistance Desk',
            '83': 'Office of the City Administrator',
            '84': 'City Information Office',
            '85': 'City Accountant\'s Office'
          };
          return numericDeptNames[dept.toString()] || `Department ${dept}`;
        } else {
          // Department code mapping (fallback for existing codes)
          const deptNames = {
            'CEO': 'City Engineering Office',
            'GSO': 'City General Services Office', 
            'CPDC': 'City Planning and Development Coordinator',
            'CHO': 'Digos City Health Office',
            'CSWDO': 'City Social Welfare and Development Office',
            'CDRRMO': 'City Disaster Risk Reduction and Management Office',
            'ENRO': 'City Environment and Natural Resources Office'
          };
          return deptNames[dept] || dept;
        }
      });
      preferenceEl.textContent = displayNames.join(', ');
    } else {
      preferenceEl.textContent = 'No preference specified';
    }
  }

  // Map preview using ComplaintMap component
  try {
    const mapEl = document.getElementById('location-map');
    const hasLat = complaint.latitude !== null && complaint.latitude !== undefined;
    const hasLng = complaint.longitude !== null && complaint.longitude !== undefined;
    
    console.log('[REVIEW] Map setup:', { 
      mapEl: !!mapEl, 
      hasLat, 
      hasLng, 
      lat: complaint.latitude, 
      lng: complaint.longitude,
      latType: typeof complaint.latitude,
      lngType: typeof complaint.longitude
    });
    
    if (mapEl && (hasLat || hasLng)) {
      // Use ComplaintMap component
      if (window.ComplaintMap) {
        console.log('[REVIEW] Creating ComplaintMap...');
        const complaintMap = new window.ComplaintMap('location-map');
        
        if (hasLat && hasLng) {
          console.log('[REVIEW] Setting location:', complaint.latitude, complaint.longitude);
          // Add a small delay to ensure map is fully initialized
          setTimeout(() => {
            complaintMap.setLocation(
              complaint.latitude,
              complaint.longitude,
              complaint.title || 'Complaint Location',
              complaint.location_text || ''
            );
            console.log('[REVIEW] Location set on map');
          }, 500);
        }
      } else {
        console.warn('[REVIEW] ComplaintMap component not loaded, trying fallback...');
        // Fallback to basic Leaflet map
        try {
          if (typeof L !== 'undefined') {
            const lat = Number(complaint.latitude);
            const lng = Number(complaint.longitude);
            const center = [lat, lng];
            const map = L.map('location-map').setView(center, 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '© OpenStreetMap contributors'
            }).addTo(map);
            const marker = L.marker(center).addTo(map);
            marker.bindPopup(`<b>${complaint.title || 'Complaint Location'}</b><br>${complaint.location_text || ''}`);
            console.log('[REVIEW] Fallback map created with marker');
          } else {
            console.warn('[REVIEW] Leaflet not available for fallback');
          }
        } catch (fallbackError) {
          console.error('[REVIEW] Fallback map failed:', fallbackError);
        }
      }
    } else {
      console.log('[REVIEW] Map not created - missing coordinates or element');
      if (mapEl) {
        mapEl.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No location coordinates available</div>';
      }
    }
  } catch (e) {
    console.warn('[REVIEW] Map init failed:', e);
  }

  // Evidence (always show section with fallback)
  const evidenceSection = document.getElementById('evidence-section');
  const evidenceEmpty = document.getElementById('evidence-empty');
  
  // Handle different evidence field structures
  let evidenceList = [];
  if (complaint.evidence && Array.isArray(complaint.evidence)) {
    evidenceList = complaint.evidence;
  } else if (complaint.evidence_files && Array.isArray(complaint.evidence_files)) {
    evidenceList = complaint.evidence_files;
  } else if (complaint.files && Array.isArray(complaint.files)) {
    evidenceList = complaint.files;
  }
  
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
  if (similarities && similarities.length > 0) {
    document.getElementById('similar-section').style.display = 'block';
    document.getElementById('duplicate-btn').style.display = 'block';
    document.getElementById('related-btn').style.display = 'block';
    document.getElementById('unique-btn').style.display = 'block';
    renderSimilarComplaints(similarities);
  } else {
    // Hide similar complaints section if no similarities
    document.getElementById('similar-section').style.display = 'none';
    document.getElementById('duplicate-btn').style.display = 'none';
    document.getElementById('related-btn').style.display = 'none';
    document.getElementById('unique-btn').style.display = 'none';
  }
}

/**
 * Render evidence images with preview functionality
 */
function renderEvidence(evidence) {
  const grid = document.getElementById('evidence-grid');

  const normalize = (item) => {
    // Support both DB_FORMAT.sql (snake_case) and existing code (camelCase)
    // Also support signedUrl from coordinator repository
    const url = item.publicUrl || item.signedUrl || item.url || item.public_url || null;
    const fileName = item.fileName || item.file_name || item.name || 'file';
    const filePath = item.filePath || item.file_path || item.path || null;
    const fileType = item.fileType || item.file_type || item.type || '';
    const fileSize = item.fileSize || item.file_size || item.size || null;
    const mimeType = item.mimeType || item.mime_type || item.fileType || '';
    return { url, fileName, filePath, fileType, fileSize, mimeType };
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

  const getFileIcon = (type, name) => {
    if (isImage(type, name)) return '🖼️';
    if (isVideo(type, name)) return '🎥';
    if (isPdf(type, name)) return '📄';
    if (type && type.startsWith('audio/')) return '🎵';
    return '📎';
  };

  grid.innerHTML = evidence.map((raw, index) => {
    const item = normalize(raw);
    const sizeText = item.fileSize ? ` · ${formatSize(item.fileSize)}` : '';
    const icon = getFileIcon(item.fileType, item.fileName);

    return `
      <div class="evidence-item" onclick="openEvidencePreview(${index})" style="cursor: pointer;">
        <div class="evidence-preview">
          ${isImage(item.fileType, item.fileName) && item.url ? 
            `<img src="${item.url}" alt="${item.fileName}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px;">` :
            `<div class="evidence-icon" style="display: flex; align-items: center; justify-content: center; height: 120px; font-size: 48px; background: #f3f4f6; border-radius: 8px;">${icon}</div>`
          }
          <div class="evidence-info" style="padding: 8px;">
            <div class="evidence-name" style="font-weight: 500; font-size: 14px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.fileName}">${item.fileName}</div>
            <div class="evidence-meta" style="font-size: 12px; color: #6b7280;">${item.fileType || 'Unknown type'}${sizeText}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Store evidence data globally for preview
  window.evidenceData = evidence.map(normalize);
  console.log('[REVIEW] Evidence data stored:', window.evidenceData);
  
  // Test evidence preview functionality
  console.log('[REVIEW] Evidence preview available:', !!window.evidencePreview);
  console.log('[REVIEW] Evidence data length:', window.evidenceData.length);
}

/**
 * Open evidence preview modal
 */
window.openEvidencePreview = function(index) {
  console.log('[REVIEW] Opening evidence preview:', { 
    index, 
    hasPreview: !!window.evidencePreview, 
    hasData: !!window.evidenceData, 
    dataLength: window.evidenceData?.length,
    evidence: window.evidenceData?.[index]
  });
  
  if (window.evidencePreview && window.evidenceData && window.evidenceData[index]) {
    window.evidencePreview.show(window.evidenceData[index]);
  } else {
    console.error('[REVIEW] Cannot open evidence preview - missing components or data');
  }
};

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
        ${sim.similar_complaint?.category || sim.similar_complaint?.type || ''} | 
        ${sim.similar_complaint?.workflow_status || sim.similar_complaint?.status || ''} | 
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
  const complaint = currentComplaint.complaint;
  document.getElementById('assign-priority').value = complaint.priority || 'medium';
  
  // Load departments dynamically
  loadDepartmentsForAssignment();
};

window.showDuplicateModal = function() {
  document.getElementById('duplicate-modal').classList.add('active');
};

window.linkRelatedComplaints = function() {
  Toast.info('Link related complaints feature coming soon');
};

window.showRejectModal = function() {
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
 * Load departments for assignment modal
 */
async function loadDepartmentsForAssignment() {
  try {
    const response = await fetch('/api/departments/active');
    const result = await response.json();
    
    if (result.success && result.data) {
      const departmentsList = document.getElementById('departments-list');
      departmentsList.innerHTML = result.data.map(dept => `
        <label>
          <input type="checkbox" class="dept-check" value="${dept.code}">
          ${dept.name} (${dept.code})
        </label>
      `).join('');
    } else {
      throw new Error(result.error || 'Failed to load departments');
    }
  } catch (error) {
    console.error('Error loading departments:', error);
    // Fallback to hardcoded list if API fails - Updated with new department codes
    const departmentsList = document.getElementById('departments-list');
    departmentsList.innerHTML = `
      <label><input type="checkbox" class="dept-check" value="CEO"> City Engineering Office</label>
      <label><input type="checkbox" class="dept-check" value="GSO"> City General Services Office</label>
      <label><input type="checkbox" class="dept-check" value="CPDC"> City Planning and Development Coordinator</label>
      <label><input type="checkbox" class="dept-check" value="CHO"> Digos City Health Office</label>
      <label><input type="checkbox" class="dept-check" value="CSWDO"> City Social Welfare and Development Office</label>
      <label><input type="checkbox" class="dept-check" value="CDRRMO"> City Disaster Risk Reduction and Management Office</label>
      <label><input type="checkbox" class="dept-check" value="ENRO"> City Environment and Natural Resources Office</label>
    `;
  }
}

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
