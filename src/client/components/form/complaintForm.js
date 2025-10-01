/**
 * Complaint Form Controller
 * Main form initialization and event handling
 */

import { handleComplaintSubmit, resetComplaintForm } from './formSubmission.js';
import { setupRealtimeValidation } from '../../utils/validation.js';
import { createComplaintFileHandler, setupDragAndDrop } from '../../utils/fileHandler.js';
import showMessage from '../toast.js';
import apiClient from '../../config/apiClient.js';

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
export function initializeComplaintForm() {
  const form = document.getElementById('complaintForm');
  if (!form) {
    console.error('[COMPLAINT FORM] Form element not found');
    return;
  }

  console.log('[COMPLAINT FORM] Initializing...');

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

  // Initialize file handler
  const fileHandler = createComplaintFileHandler({
    previewContainer: elements.filePreview,
    onFilesChange: (files) => {
      console.log(`[COMPLAINT FORM] Files updated: ${files.length} files`);
    }
  });

  // Setup form functionality
  setupSubtypeSelection(elements.typeSelect, elements.subtypeSelect);
  setupFileHandling(elements.fileDropZone, elements.fileInput, fileHandler);
  setupFormValidation(elements.form);
  setupFormSubmission(elements.form, fileHandler);
  loadDepartments();

  console.log('[COMPLAINT FORM] Initialization complete');
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
  subtypeSelect.innerHTML = '<option value="">Select complaint subtype (optional)</option>';
  
  if (!selectedType || !COMPLAINT_SUBTYPES[selectedType]) return;

  // Add new options
  COMPLAINT_SUBTYPES[selectedType].forEach(subtype => {
    const option = document.createElement('option');
    option.value = subtype.toLowerCase().replace(/\s+/g, '-');
    option.textContent = subtype;
    subtypeSelect.appendChild(option);
  });

  console.log(`[COMPLAINT FORM] Populated ${COMPLAINT_SUBTYPES[selectedType].length} subtypes for ${selectedType}`);
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

  console.log('[COMPLAINT FORM] File handling setup complete');
}

/**
 * Setup form validation
 */
function setupFormValidation(form) {
  if (!form) return;

  // Setup real-time validation
  setupRealtimeValidation(form);

  console.log('[COMPLAINT FORM] Validation setup complete');
}

/**
 * Setup form submission handling
 */
function setupFormSubmission(form, fileHandler) {
  if (!form || !fileHandler) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    console.log('[COMPLAINT FORM] Form submission started');

    try {
      // Get current files
      const selectedFiles = fileHandler.getFiles();
      
      // Submit the complaint
      const result = await handleComplaintSubmit(form, selectedFiles);
      
      console.log('[COMPLAINT FORM] Submission successful:', result);
      
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

  console.log('[COMPLAINT FORM] Form submission setup complete');
}

/**
 * Load and render departments dynamically
 */
async function loadDepartments() {
  const container = document.getElementById('departmentCheckboxes');
  if (!container) return;

  try {
    console.log('[DEPARTMENTS] Loading departments...');
    const response = await apiClient.getActiveDepartments();
    
    if (response.success && response.data) {
      const departments = response.data;
      console.log(`[DEPARTMENTS] Loaded ${departments.length} departments`);
      
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