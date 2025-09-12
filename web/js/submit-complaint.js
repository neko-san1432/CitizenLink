document.addEventListener('DOMContentLoaded', async () => {
  // Initialize user data using shared utilities
  const user = await window.userUtils.initializeUserData();
  if (!user) return;
  
  // Setup form
  setupComplaintForm();
  
  // Setup cancel button
  document.getElementById('cancel-btn').addEventListener('click', () => {
    window.location.href = '/dashboard';
  });
});

// Authentication function
async function checkAuth() {
  try {
    // Check if user is authenticated
    const user = JSON.parse(sessionStorage.getItem('user') || '{}');
    if (!user.id) {
      
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name
    };
  } catch (error) {
    console.error('Error checking auth:', error);
    return null;
  }
}

const subcategories = {
  "infrastructure": ["Road Damage", "Bridge Issues", "Sidewalk Problems", "Street Lighting", "Public Building", "Traffic Control", "Drainage Problems", "Public Amenities", "Sewer Problems", "Road Safety", "Water Infrastructure"],
  "public_safety": ["Crime Report", "Traffic Violation", "Suspicious Activity", "Abandoned Vehicle", "Public Disturbance", "Animal Control", "Abandoned Property", "Illegal Activity"],
  "sanitation": ["Garbage Collection", "Illegal Dumping", "Sewage Issues", "Public Restroom", "Pest Control"],
  "utilities": ["Water Supply", "Electricity Issues", "Gas Leaks", "Internet/Telecom", "Drainage Problems"],
  "noise": ["Construction Noise", "Traffic Noise", "Loud Music", "Industrial Noise", "Nighttime Disturbance", "Commercial Noise", "Residential Noise"],
  "other": ["General Inquiry", "Feedback", "Suggestion", "Commendation", "Other"]
};

function showToast(message, type = 'success') {
  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-icon">
        ${type === 'success' ? '✓' : '✗'}
      </div>
      <div class="toast-message">${message}</div>
      <button class="toast-close" data-action="close-toast">×</button>
    </div>
  `;
  
  // Add styles if not already present
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      .toast-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        max-width: 400px;
        padding: 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transform: translateX(100%);
        transition: transform 0.3s ease-in-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .toast-notification.show {
        transform: translateX(0);
      }
      
      .toast-success {
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
        border-left: 4px solid #047857;
      }
      
      .toast-error {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: white;
        border-left: 4px solid #b91c1c;
      }
      
      .toast-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .toast-icon {
        font-size: 18px;
        font-weight: bold;
        flex-shrink: 0;
      }
      
      .toast-message {
        flex: 1;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .toast-close {
        background: none;
        border: none;
        color: inherit;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s;
      }
      
      .toast-close:hover {
        background-color: rgba(255, 255, 255, 0.2);
      }
    `;
    document.head.appendChild(style);
  }
  
  // Add to page
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 100);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 5000);
}

// ===== MEDIA HANDLING FUNCTIONS =====

// File validation configuration
const MEDIA_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  allowedTypes: {
    image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/mov', 'video/avi', 'video/quicktime', 'video/webm'],
    audio: ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/ogg']
  }
};

// Validate media files
function validateMediaFiles(files) {
  if (files.length > MEDIA_CONFIG.maxFiles) {
    return {
      valid: false,
      message: `Maximum ${MEDIA_CONFIG.maxFiles} files allowed. You selected ${files.length} files.`
    };
  }

  for (let file of files) {
    // Check file size
    if (file.size > MEDIA_CONFIG.maxFileSize) {
      return {
        valid: false,
        message: `File "${file.name}" exceeds the ${MEDIA_CONFIG.maxFileSize / (1024 * 1024)}MB limit.`
      };
    }

    // Check file type
    const fileType = file.type;
    const isAllowed = Object.values(MEDIA_CONFIG.allowedTypes).flat().includes(fileType);
    
    if (!isAllowed) {
      return {
        valid: false,
        message: `File "${file.name}" has an unsupported format. Please use JPG, PNG, GIF, MP4, MOV, AVI, MP3, WAV, or M4A.`
      };
    }
  }

  return { valid: true };
}

// Get file type category
function getFileTypeCategory(file) {
  if (MEDIA_CONFIG.allowedTypes.image.includes(file.type)) return 'image';
  if (MEDIA_CONFIG.allowedTypes.video.includes(file.type)) return 'video';
  if (MEDIA_CONFIG.allowedTypes.audio.includes(file.type)) return 'audio';
  return 'unknown';
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Create media preview item
function createMediaPreviewItem(file, index) {
  const fileType = getFileTypeCategory(file);
  const previewItem = document.createElement('div');
  previewItem.className = 'media-preview-item';
  previewItem.dataset.index = index;

  let thumbnailContent = '';
  if (fileType === 'image') {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = previewItem.querySelector('.media-preview-thumbnail img');
      if (img) img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    thumbnailContent = '<img src="" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;">';
  } else if (fileType === 'video') {
    thumbnailContent = '<i class="fas fa-video"></i>';
  } else if (fileType === 'audio') {
    thumbnailContent = '<i class="fas fa-music"></i>';
  }

  previewItem.innerHTML = `
    <div class="media-preview-thumbnail">
      ${thumbnailContent}
    </div>
    <div class="media-preview-type-badge ${fileType}">
      ${fileType.toUpperCase()}
    </div>
    <button class="media-preview-remove" data-action="remove-file" data-file-index="${index}" title="Remove file">
      <i class="fas fa-times"></i>
    </button>
    <div class="media-preview-info">
      <div class="media-preview-name" title="${file.name}">${file.name}</div>
      <div class="media-preview-size">${formatFileSize(file.size)}</div>
    </div>
  `;

  return previewItem;
}

// Update media preview
function updateMediaPreview() {
  const files = document.getElementById('media-files').files;
  const previewContainer = document.getElementById('media-preview-container');
  const previewGrid = document.getElementById('media-preview-grid');

  if (files.length === 0) {
    previewContainer.style.display = 'none';
    return;
  }

  previewContainer.style.display = 'block';
  previewGrid.innerHTML = '';

  Array.from(files).forEach((file, index) => {
    const previewItem = createMediaPreviewItem(file, index);
    previewGrid.appendChild(previewItem);
  });
}

// Remove media file
function removeMediaFile(index) {
  const fileInput = document.getElementById('media-files');
  const dt = new DataTransfer();
  
  Array.from(fileInput.files).forEach((file, i) => {
    if (i !== index) {
      dt.items.add(file);
    }
  });
  
  fileInput.files = dt.files;
  updateMediaPreview();
}

// Make removeMediaFile globally accessible
window.removeMediaFile = removeMediaFile;

// Process media files for upload using Supabase Storage
async function processMediaFiles(files, formData) {
  try {
    // Show upload progress
    showUploadProgress(true);
    
    // Initialize storage manager
    if (!window.storageManager) {
      throw new Error('Storage manager not available');
    }

    await window.storageManager.initialize();
    
    // Create a temporary complaint ID for file organization
    const tempComplaintId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // Upload files to Supabase Storage
    const uploadedFiles = await window.storageManager.uploadFiles(
      Array.from(files), 
      tempComplaintId,
      (fileIndex, progress) => {
        updateUploadProgress(fileIndex + 1, files.length);
      }
    );

    // Update form data with uploaded file information
    formData.media_files = uploadedFiles;
    formData.media_file_count = uploadedFiles.length;
    formData.temp_complaint_id = tempComplaintId; // For cleanup if submission fails

    // Hide upload progress
    showUploadProgress(false);
    
    // Submit complaint with file URLs
    await submitComplaint(formData);
    
  } catch (error) {
    console.error('❌ Error processing media files:', error);
    showUploadProgress(false);
    showToast(`Error uploading files: ${error.message}`, 'error');
  }
}

// Show/hide upload progress
function showUploadProgress(show) {
  const progressContainer = document.getElementById('upload-progress-container');
  if (progressContainer) {
    progressContainer.style.display = show ? 'block' : 'none';
  }
}

// Update upload progress
function updateUploadProgress(current, total) {
  const progressBar = document.getElementById('upload-progress-bar');
  const progressText = document.getElementById('upload-progress-text');
  
  if (progressBar) {
    const percentage = (current / total) * 100;
    progressBar.style.width = `${percentage}%`;
  }
  
  if (progressText) {
    progressText.textContent = `Uploading ${current} of ${total} files...`;
  }
}

// Move files from temp folder to real complaint folder
async function moveFilesToRealComplaintFolder(tempComplaintId, realComplaintId, mediaFiles) {
  if (!window.storageManager || !window.storageManager.isReady()) {
    console.warn('Storage manager not available for file moving');
    return;
  }

  try {
    // Update file paths in the database to use real complaint ID
    const updatedMediaFiles = mediaFiles.map(file => ({
      ...file,
      path: file.path.replace(`${tempComplaintId}/`, `${realComplaintId}/`),
      storage_path: file.storage_path?.replace(`${tempComplaintId}/`, `${realComplaintId}/`),
      url: file.url.replace(`${tempComplaintId}/`, `${realComplaintId}/`)
    }));

    // Update the complaint record with new file paths
    const supabase = await window.supabaseManager.initialize();
    const { error } = await supabase
      .from('complaints')
      .update({ media_files: updatedMediaFiles })
      .eq('id', realComplaintId);

    if (error) {
      console.error('Error updating file paths:', error);
      throw error;
    }

    console.log('✅ Files moved to real complaint folder:', realComplaintId);
  } catch (error) {
    console.error('❌ Error moving files:', error);
    throw error;
  }
}

// Setup event listeners for dynamically created elements
function setupDynamicEventListeners() {
  // Use event delegation for dynamically created elements
  document.addEventListener('click', (e) => {
    // Handle toast close button
    if (e.target.matches('[data-action="close-toast"]') || e.target.closest('[data-action="close-toast"]')) {
      const toastElement = e.target.closest('.toast');
      if (toastElement) {
        toastElement.remove();
      }
    }
    
    // Handle media file remove button
    if (e.target.matches('[data-action="remove-file"]') || e.target.closest('[data-action="remove-file"]')) {
      const button = e.target.closest('[data-action="remove-file"]');
      const fileIndex = parseInt(button.getAttribute('data-file-index'));
      removeMediaFile(fileIndex);
    }
  });
}

// Setup media upload functionality
function setupMediaUpload() {
  const dropZone = document.getElementById('media-drop-zone');
  const fileInput = document.getElementById('media-files');

  // Click to browse
  dropZone.addEventListener('click', () => {
    fileInput.click();
  });

  // File input change
  fileInput.addEventListener('change', (e) => {
    updateMediaPreview();
  });

  // Drag and drop events
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      fileInput.files = files;
      updateMediaPreview();
    }
  });

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });
}

// Setup complaint form
function setupComplaintForm() {
  const complaintForm = document.getElementById('complaint-form');
  const complaintType = document.getElementById('complaint-type');
  const complaintSubcategory = document.getElementById('complaint-subcategory');
  const sendAnonymous = document.getElementById('send-anonymous');
  
  // Attempt to capture location automatically in background
  captureGeoLocationInBackground();
  
  // Setup media upload functionality
  setupMediaUpload();
  
  // Setup event listeners for dynamically created elements
  setupDynamicEventListeners();
  
  // The searchable select handles type/subcategory selection automatically
  // No need for manual change event handling
  
  // Handle form submission
  complaintForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Get user data
    const user = await checkAuth();
    if (!user) {
      showToast('Please log in to submit a complaint.', 'error');
      return;
    }
    
    // Get form data
    // Gather selected units (multiple)
    const selectedUnits = Array.from(document.querySelectorAll('#suggested-units input[type="checkbox"]:checked')).map(cb => cb.value);

    // Map suggested units to department codes used by LGU departments table
    const UNIT_TO_DEPT_CODE = {
      city_hall: null,        // Escalation only
      police: 'DPS',          // Public Safety
      fire: 'DPS',            // Fire under Public Safety
      public_works: 'DPWH',   // Public Works and Highways
      transport: 'TRN',       // Transport
      health: 'DHS',          // Health Services
      social_welfare: 'DSW',  // Social Welfare
      sanitation: 'SAN',      // Sanitation
      waste: 'WST',           // Waste Management
      environment: 'DENR'     // Environment and Natural Resources
    };

    function getPrimaryDepartmentCode(units) {
      if (!Array.isArray(units) || units.length === 0) return null;
      // Priority order for department assignment when multiple are selected
      const priority = ['police', 'fire', 'public_works', 'transport', 'health', 'social_welfare', 'sanitation', 'waste', 'environment'];
      for (const key of priority) {
        if (units.includes(key)) return UNIT_TO_DEPT_CODE[key] || null;
      }
      // Fallback: first mapped department found
      for (const u of units) {
        const code = UNIT_TO_DEPT_CODE[u];
        if (code) return code;
      }
      return null;
    }

    const primaryDepartmentCode = getPrimaryDepartmentCode(selectedUnits);

    const formData = {
      user_id: user.id,
      user_name: sendAnonymous && sendAnonymous.checked ? 'Anonymous' : user.name,
      title: document.getElementById('complaint-title').value,
      type: document.getElementById('complaint-type').value,
      subcategory: document.getElementById('complaint-subcategory').value,
      location: document.getElementById('complaint-location').value,
      latitude: window.__geo?.lat ?? null,
      longitude: window.__geo?.lng ?? null,
      location_accuracy: window.__geo?.accuracy ?? null,
      location_timestamp: window.__geo?.ts ?? null,
      location_source: window.__geo?.source ?? 'gps',
      description: document.getElementById('complaint-description').value,
      suggested_unit: selectedUnits,
      department: primaryDepartmentCode,
      status: 'pending'
    };
    
    // Validate coordinates if provided
    if (formData.latitude != null && formData.longitude != null) {
      if (formData.latitude < -90 || formData.latitude > 90) {
        showToast('Invalid latitude value. Must be between -90 and 90.', 'error');
        return;
      }
      if (formData.longitude < -180 || formData.longitude > 180) {
        showToast('Invalid longitude value. Must be between -180 and 180.', 'error');
        return;
      }
    }
    
    // Handle media files if provided
    const mediaFiles = document.getElementById('media-files').files;
    if (mediaFiles.length > 0) {
      const validationResult = validateMediaFiles(mediaFiles);
      if (!validationResult.valid) {
        showToast(validationResult.message, 'error');
        return;
      }
      
      // Process media files
      processMediaFiles(mediaFiles, formData);
    } else {
      submitComplaint(formData);
    }
  });
}

// Setup location coordinates functionality
function captureGeoLocationInBackground() {
  if (!('geolocation' in navigator)) {
    showGeoUnavailableNote('Could not access geolocation in this browser. You can still submit without it.');
    return;
  }
  // Request high-accuracy once, fill hidden fields silently
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      window.__geo = {
        lat: Number(latitude.toFixed(6)),
        lng: Number(longitude.toFixed(6)),
        accuracy: Number((accuracy ?? 0).toFixed(0)),
        ts: new Date().toISOString(),
        source: 'gps'
      };
    },
    (err) => {
      // Silent failure: user denied or unavailable; form can still submit without coords
      if (err && err.code === err.PERMISSION_DENIED) {
        showGeoUnavailableNote('Location permission denied. You can still submit without coordinates.');
      } else {
        showGeoUnavailableNote('Unable to get your location. You can still submit without coordinates.');
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 120000
    }
  );
}

// Show a subtle inline note below the Location field when geo is unavailable
function showGeoUnavailableNote(message) {
  const locationInput = document.getElementById('complaint-location');
  if (!locationInput) return;
  // Avoid duplicates
  const existing = document.getElementById('geo-note');
  if (existing) return;
  const note = document.createElement('small');
  note.id = 'geo-note';
  note.className = 'text-muted';
  note.style.display = 'block';
  note.style.marginTop = '0.25rem';
  note.textContent = message;
  locationInput.insertAdjacentElement('afterend', note);
}

// Submit complaint to Supabase
async function submitComplaint(formData) {
  try {
    // Prefer existing global function if available
    if (window.createComplaint) {
      const newComplaint = await window.createComplaint(formData);
      if (!newComplaint) {
        showToast('Failed to submit complaint. Please try again.', 'error');
        return;
      }
      showToast('Complaint submitted successfully!', 'success');
      setTimeout(() => {
        window.location.href = '/my-complaints?id=' + newComplaint.id;
      }, 1500);
      return;
    }

    // Fallback: Insert directly via Supabase
    if (!window.supabaseManager || !window.supabaseManager.initialize) {
      showToast('Complaint system not available. Please try again later.', 'error');
      return;
    }

    const supabase = await window.supabaseManager.initialize();

    // Only send valid columns
    const payload = {
      user_id: formData.user_id,
      user_name: formData.user_name,
      title: formData.title,
      type: formData.type,
      subcategory: formData.subcategory || null,
      location: formData.location,
      description: formData.description,
      status: formData.status || 'pending',
      assigned_unit: null,
      // Store as JSON array in a text/jsonb column if available; fallback to comma-separated
      suggested_unit: Array.isArray(formData.suggested_unit) ? formData.suggested_unit.join(',') : (formData.suggested_unit || null),
      citizen_feedback: null,
      is_active: true,
      latitude: formData.latitude ?? null,
      longitude: formData.longitude ?? null,
      location_accuracy: formData.location_accuracy ?? null,
      location_timestamp: formData.location_timestamp ?? null,
      location_source: formData.location_source ?? 'gps',
      is_anonymous: !!(sendAnonymous && sendAnonymous.checked),
      // Media files support
      media_files: formData.media_files || [],
      media_file_count: formData.media_file_count || 0,
      department: formData.department || null
    };

    const { data, error } = await supabase
      .from('complaints')
      .insert([payload])
      .select('id')
      .single();

    if (error) {
      showToast('Failed to submit complaint: ' + error.message, 'error');
      return;
    }

    // Move files from temp folder to real complaint folder
    if (formData.temp_complaint_id && formData.media_files && formData.media_files.length > 0) {
      try {
        await moveFilesToRealComplaintFolder(formData.temp_complaint_id, data.id, formData.media_files);
      } catch (moveError) {
        console.warn('Warning: Could not move files to real complaint folder:', moveError);
        // Don't fail the entire operation for this
      }
    }

    showToast('Complaint submitted successfully!', 'success');
    setTimeout(() => {
      window.location.href = '/my-complaints?id=' + data.id;
    }, 1500);
  } catch (error) {
    console.error('Error submitting complaint:', error);
    showToast('Error submitting complaint: ' + error.message, 'error');
  }
}
