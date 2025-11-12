/**
 * Complaint Form Controller
 * Main form initialization and event handling
 */
import { handleComplaintSubmit, resetComplaintForm } from './formSubmission.js';
import { setupRealtimeValidation } from '../../utils/validation.js';
import { createComplaintFileHandler, setupDragAndDrop } from '../../utils/fileHandler.js';
import showMessage from '../toast.js';
import apiClient from '../../config/apiClient.js';
import { getActiveRole, isInCitizenMode, canSwitchToCitizen } from '../../auth/roleToggle.js';
import { getUserRole } from '../../auth/authChecker.js';

// Complaint type and subtype mapping
const COMPLAINT_SUBTYPES = {
  'infrastructure': [
    'Roads & Bridges',
    'Street Lighting',
    'Water Supply',
    'Drainage System',
    'Public Buildings',
    'Other'
  ],
  'public-safety': [
    'Crime & Security',
    'Emergency Services',
    'Fire Safety',
    'Traffic Safety',
    'Other'
  ],
  'environmental': [
    'Waste Management',
    'Air Quality',
    'Water Pollution',
    'Noise Pollution',
    'Green Spaces',
    'Other'
  ],
  'health': [
    'Sanitation',
    'Public Health',
    'Medical Services',
    'Food Safety',
    'Other'
  ],
  'traffic': [
    'Road Conditions',
    'Traffic Flow',
    'Parking Issues',
    'Public Transportation',
    'Other'
  ],
  'noise': [
    'Construction Noise',
    'Vehicle Noise',
    'Commercial Noise',
    'Residential Noise',
    'Other'
  ],
  'other': [
    'General Complaint',
    'Other'
  ]
};
/**
 * Initialize complaint form
 */

export async function initializeComplaintForm() {
  const form = document.getElementById('complaintForm');
  if (!form) {
    console.error('[COMPLAINT FORM] Form element not found');
    return;
  }
  // console.log removed for security
  // Check if user is citizen or in citizen mode
  // Try to get role from authChecker first (same as sidebar)
  let activeRole = null;
  try {
    activeRole = await getUserRole({ refresh: true });
  } catch (error) {
    console.warn('[COMPLAINT FORM] Failed to get role from authChecker, trying roleToggle:', error);
    activeRole = getActiveRole();
  }
  const inCitizenMode = isInCitizenMode();
  // console.log removed for security
  if (activeRole !== 'citizen' && !inCitizenMode) {
    // User is not a citizen and not in citizen mode
    const canSwitch = await canSwitchToCitizen();
    if (canSwitch) {
      // Show message to switch to citizen mode
      showRoleSwitchRequired(form);
      return;
    }
    // Shouldn't happen, but handle it
    showMessage('error', 'Only citizens can file complaints');
    form.style.display = 'none';
    return;
  }
  // Get form elements
  const elements = {
    form,
    typeSelect: form.querySelector('#complaintType'),
    subtypeSelect: form.querySelector('#complaintSubtype'),
    fileDropZone: form.querySelector('#fileDropZone'),
    fileInput: form.querySelector('#evidenceFiles'),
    filePreview: form.querySelector('#filePreview')
  };
  // Validate required elements
  const missingElements = Object.entries(elements)
    .filter(([key, element]) => !element && key !== 'filePreview')
    .map(([key]) => key);
  if (missingElements.length > 0) {
    console.error('[COMPLAINT FORM] Missing required elements:', missingElements);
    return;
  }
  // Initialize file handler with upload state callback
  const fileHandler = createComplaintFileHandler({
    previewContainer: elements.filePreview,
    onFilesChange: (files) => {
      // console.log removed for security
    },
    onUploadStateChange: (isUploading) => {
      // Disable/enable buttons based on upload state
      const submitBtn = elements.form.querySelector('.submit-btn');
      const cancelBtn = elements.form.querySelector('.cancel-btn') || document.querySelector('.cancel-btn');
      if (submitBtn) {
        submitBtn.disabled = isUploading;
      }
      if (cancelBtn) {
        cancelBtn.disabled = isUploading;
      }
    }
  });
  // Setup form functionality
  setupSubtypeSelection(elements.typeSelect, elements.subtypeSelect);
  setupFileHandling(elements.fileDropZone, elements.fileInput, fileHandler);
  setupFormValidation(elements.form);
  setupFormSubmission(elements.form, fileHandler);
  loadDepartments();
  // Prevent any auto-focus behavior (browser default or otherwise)
  setTimeout(() => {
    // Remove focus from any form field
    if (document.activeElement && document.activeElement.tagName !== 'BODY') {
      document.activeElement.blur();
      // console.log removed for security
    }
  }, 50);
  // console.log removed for security
}
/**
 * Setup complaint type and subtype selection
 */
function setupSubtypeSelection(typeSelect, subtypeSelect) {
  if (!typeSelect || !subtypeSelect) return;
  typeSelect.addEventListener('change', (e) => {
    populateSubtypes(e.target.value, subtypeSelect);
  });
}
/**
 * Populate complaint subtypes based on selected type
 */
function populateSubtypes(selectedType, subtypeSelect) {
  if (!subtypeSelect) return;
  // Clear existing options
  subtypeSelect.innerHTML = '<option value="">Select complaint subtype</option>';
  if (!selectedType || !COMPLAINT_SUBTYPES[selectedType]) return;
  // Add new options
  COMPLAINT_SUBTYPES[selectedType].forEach(subtype => {
    const option = document.createElement('option');
    option.value = subtype.toLowerCase().replace(/\s+/g, '-');
    option.textContent = subtype;
    subtypeSelect.appendChild(option);
  });
  // console.log removed for security
}
/**
 * Setup file handling functionality
 */
function setupFileHandling(dropZone, fileInput, fileHandler) {
  if (!dropZone || !fileHandler) return;
  // Setup drag and drop
  setupDragAndDrop(dropZone, fileHandler, fileInput);
  // Make file handler globally available for cleanup
  window.complaintFileHandler = fileHandler;
  // console.log removed for security
}
/**
 * Show role switch required message
 */
function showRoleSwitchRequired(form) {
  const message = document.createElement('div');
  message.className = 'role-switch-required';
  message.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);
      margin: 40px auto;
      max-width: 500px;
    ">
      <div style="font-size: 3rem; margin-bottom: 20px;">🔄</div>
      <h2 style="margin: 0 0 15px 0; font-size: 1.5rem;">Switch to Citizen Mode Required</h2>
      <p style="margin: 0 0 25px 0; opacity: 0.9; font-size: 1rem;">
        To file a complaint, please switch to Citizen mode using the toggle button in the header.
      </p>
      <div style="font-size: 2rem; margin-bottom: 10px;">↗️</div>
      <p style="margin: 0; font-size: 0.9rem; opacity: 0.8;">
        Look for the toggle button at the top right corner
      </p>
    </div>
  `;
  form.style.display = 'none';
  form.parentNode.insertBefore(message, form);
}
/**
 * Setup form validation
 */
function setupFormValidation(form) {
  if (!form) return;
  // Setup real-time validation
  setupRealtimeValidation(form);
  // console.log removed for security
}
/**
 * Setup form submission handling
 */
function setupFormSubmission(form, fileHandler) {
  if (!form || !fileHandler) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // console.log removed for security
    try {
      // Get current files
      const selectedFiles = fileHandler.getFiles();
      // Submit the complaint with fileHandler for progress tracking
      const result = await handleComplaintSubmit(form, selectedFiles, fileHandler);
      // console.log removed for security
      // Reset form on success
      resetComplaintForm(form, () => fileHandler.clearAll());
      // Redirect to dashboard after delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (error) {
      console.error('[COMPLAINT FORM] Submission failed:', error);
      // Error is already handled in handleComplaintSubmit
    }
  });
  // console.log removed for security
}
/**
 * Load and render departments dynamically
 */
async function loadDepartments() {
  const container = document.getElementById('departmentCheckboxes');
  if (!container) return;
  try {
    // console.log removed for security
    const response = await apiClient.getActiveDepartments();
    if (response.success && response.data) {
      const departments = response.data;
      // console.log removed for security
      container.innerHTML = departments.map(dept => `
        <div class="checkbox-item">
          <input
            type="checkbox"
            id="dept-${dept.code.toLowerCase()}"
            name="department"
            value="${dept.code}"
          />
          <label for="dept-${dept.code.toLowerCase()}">${dept.name}</label>
        </div>
      `).join('');
    } else {
      throw new Error('Failed to load departments');
    }
  } catch (error) {
    console.error('[DEPARTMENTS] Failed to load departments:', error);
    container.innerHTML = `
      <div class="error-placeholder">
        <p>Failed to load departments. You can still submit your complaint.</p>
        <button type="button" onclick="window.retryLoadDepartments()" class="btn btn-sm btn-secondary">
          Retry
        </button>
      </div>
    `;
  }
}
// Make retry function globally available
window.retryLoadDepartments = loadDepartments;
// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeComplaintForm);
// Export for manual initialization

export { COMPLAINT_SUBTYPES };
