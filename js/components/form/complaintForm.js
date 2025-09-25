// Complaint Form JavaScript functionality
import showMessage from '../toast.js';

export function initializeComplaintForm() {
  const form = document.getElementById('complaintForm');
  const complaintTypeSelect = document.getElementById('complaintType');
  const complaintSubtypeSelect = document.getElementById('complaintSubtype');
  const fileDropZone = document.getElementById('fileDropZone');
  const fileInput = document.getElementById('evidenceFiles');
  const filePreview = document.getElementById('filePreview');
  
  let selectedFiles = [];

  // Complaint type and subtype mapping
  const complaintSubtypes = {
    'infrastructure': [
      'Roads & Bridges',
      'Street Lighting',
      'Water Supply',
      'Drainage System',
      'Public Buildings',
      'Sidewalks'
    ],
    'public-safety': [
      'Crime Report',
      'Emergency Response',
      'Traffic Violations',
      'Public Disturbance',
      'Safety Hazards',
      'Missing Person'
    ],
    'environmental': [
      'Air Pollution',
      'Water Pollution',
      'Waste Management',
      'Noise Pollution',
      'Deforestation',
      'Wildlife Protection'
    ],
    'health': [
      'Sanitation Issues',
      'Disease Outbreak',
      'Food Safety',
      'Public Health',
      'Medical Emergency',
      'Health Facility'
    ],
    'traffic': [
      'Traffic Congestion',
      'Road Accidents',
      'Public Transportation',
      'Parking Issues',
      'Traffic Signals',
      'Road Construction'
    ],
    'noise': [
      'Construction Noise',
      'Vehicle Noise',
      'Music/Entertainment',
      'Industrial Noise',
      'Neighborhood Disturbance',
      'Commercial Noise'
    ],
    'other': [
      'General Complaint',
      'Administrative Issue',
      'Service Request',
      'Feedback',
      'Suggestion',
      'Other'
    ]
  };

  // Update complaint subtype options based on selected type
  function updateComplaintSubtypes() {
    const selectedType = complaintTypeSelect.value;
    complaintSubtypeSelect.innerHTML = '<option value="">Select complaint subtype (optional)</option>';
    
    if (selectedType && complaintSubtypes[selectedType]) {
      complaintSubtypes[selectedType].forEach(subtype => {
        const option = document.createElement('option');
        option.value = subtype.toLowerCase().replace(/\s+/g, '-');
        option.textContent = subtype;
        complaintSubtypeSelect.appendChild(option);
      });
    }
  }

  // File upload functionality
  function handleFileSelect(files) {
    const newFiles = Array.from(files);
    
    // Check file count limit
    if (selectedFiles.length + newFiles.length > 5) {
      showMessage('error', 'Maximum 5 files allowed');
      return;
    }

    // Validate file types
    const allowedTypes = ['image/', 'audio/', 'video/'];
    const invalidFiles = newFiles.filter(file => 
      !allowedTypes.some(type => file.type.startsWith(type))
    );

    if (invalidFiles.length > 0) {
      showMessage('error', 'Only images, audio, and video files are allowed');
      return;
    }

    // Add valid files
    newFiles.forEach(file => {
      if (selectedFiles.length < 5) {
        selectedFiles.push(file);
        displayFilePreview(file);
      }
    });

    // Update file input
    updateFileInput();
  }

  function displayFilePreview(file) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.dataset.fileName = file.name;

    const fileIcon = getFileIcon(file.type);
    const fileSize = formatFileSize(file.size);

    fileItem.innerHTML = `
      <div class="file-icon">${fileIcon}</div>
      <div class="file-name">${file.name}</div>
      <div class="file-size">${fileSize}</div>
      <button type="button" class="remove-file" onclick="removeFile('${file.name}')">×</button>
    `;

    // Add media preview if it's an image or video
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      fileItem.insertBefore(img, fileItem.firstChild);
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.controls = true;
      fileItem.insertBefore(video, fileItem.firstChild);
    } else if (file.type.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.src = URL.createObjectURL(file);
      audio.controls = true;
      fileItem.insertBefore(audio, fileItem.firstChild);
    }

    filePreview.appendChild(fileItem);
  }

  function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType.startsWith('video/')) return '🎥';
    if (fileType.startsWith('audio/')) return '🎵';
    return '📄';
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function removeFile(fileName) {
    selectedFiles = selectedFiles.filter(file => file.name !== fileName);
    const fileItem = filePreview.querySelector(`[data-file-name="${fileName}"]`);
    if (fileItem) {
      fileItem.remove();
    }
    updateFileInput();
  }

  function updateFileInput() {
    // Create a new FileList-like object
    const dt = new DataTransfer();
    selectedFiles.forEach(file => dt.items.add(file));
    fileInput.files = dt.files;
  }

  // Event listeners
  complaintTypeSelect.addEventListener('change', updateComplaintSubtypes);

  // File drop zone events
  fileDropZone.addEventListener('click', () => fileInput.click());
  fileDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropZone.classList.add('dragover');
  });
  fileDropZone.addEventListener('dragleave', () => {
    fileDropZone.classList.remove('dragover');
  });
  fileDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropZone.classList.remove('dragover');
    handleFileSelect(e.dataTransfer.files);
  });

  // File input change
  fileInput.addEventListener('change', (e) => {
    handleFileSelect(e.target.files);
  });

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Show loading state
    const submitBtn = form.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;

    try {
      // Collect form data
      const formData = new FormData();
      formData.append('complaintTitle', form.complaintTitle.value);
      formData.append('complaintType', form.complaintType.value);
      formData.append('complaintSubtype', form.complaintSubtype.value);
      // Coordinates (if provided)
      formData.append('latitude', form.latitude ? form.latitude.value : '');
      formData.append('longitude', form.longitude ? form.longitude.value : '');
      
      // Collect selected departments
      const selectedDepartments = Array.from(form.querySelectorAll('input[name="department"]:checked'))
        .map(checkbox => checkbox.value);
      formData.append('departments', JSON.stringify(selectedDepartments));
      
      formData.append('description', form.description.value);
      formData.append('location', form.location.value);
      
      // Add files
      selectedFiles.forEach((file, index) => {
        formData.append(`evidence_${index}`, file);
      });

      // Submit to server
      const response = await fetch('/api/complaints', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        showMessage('success', 'Complaint submitted successfully!');
        form.reset();
        selectedFiles = [];
        filePreview.innerHTML = '';
        complaintSubtypeSelect.innerHTML = '<option value="">Select complaint subtype (optional)</option>';
      } else {
        const error = await response.json();
        showMessage('error', error.message || 'Failed to submit complaint');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      showMessage('error', 'Failed to submit complaint. Please try again.');
    } finally {
      // Reset button state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });

  // Make removeFile globally available
  window.removeFile = removeFile;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeComplaintForm);
