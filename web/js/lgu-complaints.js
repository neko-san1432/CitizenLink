document.addEventListener('DOMContentLoaded', async () => {
  // Get user and complaints
  const user = await checkAuth();
  if (!user) return;

  // Update header with user's name
  updateHeaderWithUserName(user);
  
  // Preload officers for the admin's department (if admin)
  let officersForDept = [];
  try {
    const role = String((user.role || user.type || '')).toLowerCase();
    const deptFromRole = role.startsWith('lgu-admin-') ? role.replace('lgu-admin-', '')
                        : role.startsWith('lgu-') ? role.replace('lgu-', '')
                        : null;
    if (deptFromRole) {
      const res = await fetch(`/api/officers?department=${encodeURIComponent(deptFromRole)}`);
      const json = await res.json();
      if (res.ok && Array.isArray(json.officers)) {
        officersForDept = json.officers;
      }
    }
  } catch (_) {}

  const complaints = await getComplaintsForLGU();
  
  // Check if viewing a specific complaint
  const urlParams = new URLSearchParams(window.location.search);
  const complaintId = urlParams.get('id');
  
  if (complaintId) {
    // Show complaint details
    await showComplaintDetails(complaintId);
  } else {
    // Load complaints list
    await loadComplaints(complaints);
    
    // Setup filters
    await setupFilters(complaints);
    
    // Setup pagination
    await setupPagination(complaints);
  }
  
  // Setup modal close
  setupModalClose();
  
  // Setup save button
  setupSaveButton();
  
  // Setup dispatch functionality
  setupDispatchFunctionality();
  
  // Setup media preview event listeners
  setupMediaPreviewEventListeners();
  
  // Setup button event listeners
  setupButtonEventListeners();

  // Load departments into help section
  setupHelpRequests();

  // Populate officer dropdown in the modal when it opens (if present)
  const assignedOfficerSelect = document.getElementById('assigned-officer');
  if (assignedOfficerSelect) {
    assignedOfficerSelect.innerHTML = '<option value="">Select Officer</option>';
    officersForDept.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.email || o.id;
      assignedOfficerSelect.appendChild(opt);
    });
  }
});

// Use real authentication and data management functions
async function checkAuth() {
  // Use the real auth check from auth-check.js
  return window.userUtils ? await window.userUtils.initializeUserData() : { username: 'admin-user', type: 'lgu' };
}

async function getComplaintsForLGU() {
  try {
    // Use the real data management function from data-management.js
    if (window.getComplaints) {
      console.log('Using real getComplaints function from data-management.js');
      return await window.getComplaints();
    }
    // Fallback to mock data if function not available
    console.log('Using mock data fallback - getComplaints function not found');
    return [
      { id: 'CP001', title: 'Pothole on Main Street', type: 'infrastructure', subcategory: 'Road Damage', location: '123 Main Street', status: 'resolved', created_at: '2025-01-05T10:30:00', userId: 'citizen-user', userName: 'John Citizen', description: 'Large pothole causing damage to vehicles', assignedUnit: 'public_works' },
      { id: 'CP002', title: 'Streetlight Out', type: 'infrastructure', subcategory: 'Street Lighting', location: 'Corner of Pine St and Oak Ave', status: 'in_progress', created_at: '2025-01-10T18:45:00', userId: 'citizen-user', userName: 'John Citizen', description: 'Streetlight has been out for a week', assignedUnit: 'public_works' },
      { id: 'CP003', title: 'Missed Garbage Collection', type: 'sanitation', subcategory: 'Garbage Collection', location: '456 Cedar Avenue', status: 'resolved', created_at: '2025-01-15T08:20:00', userId: 'citizen-user', userName: 'John Citizen', description: 'Garbage not collected for two weeks', assignedUnit: 'waste' },
      { id: 'CP004', title: 'Noise Complaint - Construction', type: 'noise', subcategory: 'Construction Noise', location: '789 Maple Drive', status: 'pending', created_at: '2025-01-20T06:15:00', userId: 'citizen-user', userName: 'John Citizen', description: 'Construction starting too early in the morning' },
      { id: 'CP005', title: 'Water Main Break', type: 'utilities', subcategory: 'Water Supply', location: '200 Block of Birch Street', status: 'in_progress', created_at: '2025-01-22T15:30:00', userId: 'other-user', userName: 'Jane Smith', description: 'Major water main break flooding the street', assignedUnit: 'public_works' },
      { id: 'CP006', title: 'Suspicious Activity', type: 'public_safety', subcategory: 'Suspicious Activity', location: 'Oak Elementary School', status: 'resolved', created_at: '2025-01-18T22:10:00', userId: 'other-user', userName: 'Jane Smith', description: 'Suspicious individuals loitering around school', assignedUnit: 'police' },
      { id: 'CP007', title: 'Illegal Dumping', type: 'sanitation', subcategory: 'Illegal Dumping', location: 'Vacant lot at end of Willow Lane', status: 'in_progress', created_at: '2025-01-25T14:20:00', userId: 'citizen-user', userName: 'John Citizen', description: 'Construction waste being dumped in vacant lot', assignedUnit: 'waste' },
      { id: 'CP008', title: 'Broken Sidewalk', type: 'infrastructure', subcategory: 'Sidewalk Problems', location: 'Cherry Street between 5th and 6th Ave', status: 'pending', created_at: '2025-01-28T16:45:00', userId: 'other-user', userName: 'Jane Smith', description: 'Sidewalk is severely cracked and uneven' }
    ];
  } catch (error) {
    console.error('Error fetching complaints:', error);
    return [];
  }
}

// Load complaints into table
async function loadComplaints(complaints, filters = {}) {
  const tableBody = document.getElementById('complaints-table-body');
  const noComplaintsContainer = document.getElementById('no-complaints');
  
  // Clear current list
  tableBody.innerHTML = '';
  
  // Filter complaints
  let filteredComplaints = [...complaints];
  
  if (filters.status && filters.status !== 'all') {
    filteredComplaints = filteredComplaints.filter(c => normalizeStatus(c.status) === normalizeStatus(filters.status));
  }
  
  if (filters.type && filters.type !== 'all') {
    filteredComplaints = filteredComplaints.filter(c => (c.type || '').toString() === filters.type);
  }
  

  
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    filteredComplaints = filteredComplaints.filter(c => 
      c.title.toLowerCase().includes(searchTerm) || 
      c.description.toLowerCase().includes(searchTerm) ||
      c.location.toLowerCase().includes(searchTerm) ||
      c.id.toLowerCase().includes(searchTerm)
    );
  }
  
  if (filters.date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const yearAgo = new Date(today);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    
    filteredComplaints = filteredComplaints.filter(c => {
      const complaintDate = new Date(c.created_at || c.createdAt);
      
      switch (filters.date) {
        case 'today':
          return complaintDate >= today;
        case 'week':
          return complaintDate >= weekAgo;
        case 'month':
          return complaintDate >= monthAgo;
        case 'year':
          return complaintDate >= yearAgo;
        default:
          return true;
      }
    });
  }
  
  // Sorting
  const sortMode = filters.sort || 'newest';
  const getDate = c => new Date(c.created_at || c.createdAt || c.created_at);
  const statusOrder = { pending: 0, in_progress: 1, resolved: 2 };
  filteredComplaints.sort((a, b) => {
    switch (sortMode) {
      case 'oldest':
        return getDate(a) - getDate(b);
      case 'status':
        return (statusOrder[normalizeStatus(a.status)] ?? 99) - (statusOrder[normalizeStatus(b.status)] ?? 99);
      case 'type':
        return (a.type || '').localeCompare(b.type || '');
      case 'title-asc':
        return (a.title || '').localeCompare(b.title || '');
      case 'title-desc':
        return (b.title || '').localeCompare(a.title || '');
      case 'newest':
      default:
        return getDate(b) - getDate(a);
    }
  });
  
  // Show/hide empty state
  if (filteredComplaints.length === 0) {
    tableBody.innerHTML = '';
    noComplaintsContainer.style.display = 'flex';
    return;
  } else {
    noComplaintsContainer.style.display = 'none';
  }
  
  // Apply pagination
  const page = filters.page || 1;
  const perPage = 10;
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const paginatedComplaints = filteredComplaints.slice(start, end);
  
  // Get current user's department
  const user = await checkAuth();
  const userDept = user?.type?.replace('lgu-admin-', '').replace('lgu-', '') || null;
  console.log('Current user department:', userDept);

  // Create table rows
  paginatedComplaints.forEach(complaint => {
    const row = document.createElement('tr');
    
    let statusClass;
    switch (normalizeStatus(complaint.status)) {
      case 'pending':
        statusClass = 'status-pending';
        break;
      case 'in_progress':
        statusClass = 'status-in-progress';
        break;
      case 'resolved':
        statusClass = 'status-resolved';
        break;
    }
    
    // Check if complaint is assigned to user's department
    const complaintAssignedUnit = complaint.assigned_unit || complaint.assignedUnit;
    const isAssignedToUserDept = userDept && complaintAssignedUnit && 
      (complaintAssignedUnit === userDept || complaintAssignedUnit.includes(userDept));
    
    // Only show View Details button if complaint is assigned to user's department
    const viewButtonHtml = isAssignedToUserDept ? 
      `<button class="btn btn-sm view-complaint-btn" data-id="${complaint.id}">
        <i class="fas fa-eye"></i> View
      </button>` : 
      `<span class="text-muted">Not assigned to your department</span>`;
    
    row.innerHTML = `
      <td>${complaint.id}</td>
      <td>${complaint.title}</td>
      <td>${(complaint.type || '').replace(/_/g, ' ')}</td>
      <td>${complaint.location}</td>
      <td>${formatDate(complaint.created_at || complaint.createdAt)}</td>
      
      <td><span class="status-badge ${statusClass}">${normalizeStatus(complaint.status).replace('_',' ').toUpperCase()}</span></td>
      <td>${viewButtonHtml}</td>
    `;
    
    tableBody.appendChild(row);
  });
  
  // Add event listeners to view buttons
  document.querySelectorAll('.view-complaint-btn').forEach(button => {
    button.addEventListener('click', async () => {
      const complaintId = button.getAttribute('data-id');
      console.log('View button clicked for complaint ID:', complaintId);
      try {
        await showComplaintDetails(complaintId);
      } catch (error) {
        console.error('Error showing complaint details:', error);
      }
    });
  });
  
  // Update pagination
  updatePagination(filteredComplaints.length, page, perPage);
}

// Normalize statuses to canonical keys (pending, in_progress, resolved)
function normalizeStatus(status) {
  const s = (status || '').toString().toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
  if (s === 'inprogress') return 'in_progress';
  if (['pending', 'in_progress', 'resolved'].includes(s)) return s;
  return 'pending';
}

// Setup filters
async function setupFilters(complaints) {
  const searchInput = document.getElementById('search-complaints');
  const statusFilter = document.getElementById('status-filter');
  const typeFilter = document.getElementById('type-filter');
  const sortFilter = document.getElementById('sort-filter');
  const urgencyFilter = document.getElementById('urgency-filter');
  const dateFilter = document.getElementById('date-filter');
  
  // Current filters
  const filters = {
    search: '',
    status: 'all',
    type: 'all',
    sort: 'newest',

    date: 'all',
    page: 1
  };
  
  // Search input
  searchInput.addEventListener('input', () => {
    filters.search = searchInput.value;
    filters.page = 1; // Reset to first page
    loadComplaints(complaints, filters);
  });
  
  // Status filter
  statusFilter.addEventListener('change', () => {
    filters.status = statusFilter.value;
    filters.page = 1; // Reset to first page
    loadComplaints(complaints, filters);
  });
  
  // Type filter
  typeFilter.addEventListener('change', () => {
    filters.type = typeFilter.value;
    filters.page = 1; // Reset to first page
    loadComplaints(complaints, filters);
  });
  
  // Sort filter
  sortFilter.addEventListener('change', () => {
    filters.sort = sortFilter.value;
    filters.page = 1;
    loadComplaints(complaints, filters);
  });
  

  
  // Date filter
  dateFilter.addEventListener('change', () => {
    filters.date = dateFilter.value;
    filters.page = 1; // Reset to first page
    loadComplaints(complaints, filters);
  });
}

// Setup pagination
async function setupPagination(complaints) {
  const paginationContainer = document.getElementById('pagination');
  
  paginationContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('pagination-btn')) {
      const page = parseInt(e.target.getAttribute('data-page'));
      
      // Get current filters
      const searchInput = document.getElementById('search-complaints');
      const statusFilter = document.getElementById('status-filter');
      const typeFilter = document.getElementById('type-filter');
      const sortFilter = document.getElementById('sort-filter');
      const urgencyFilter = document.getElementById('urgency-filter');
      const dateFilter = document.getElementById('date-filter');
      
      const filters = {
        search: searchInput.value,
        status: statusFilter.value,
        type: typeFilter.value,
        sort: sortFilter ? sortFilter.value : 'newest',
    
        date: dateFilter.value,
        page: page
      };
      
      loadComplaints(complaints, filters);
      
      // Scroll to top
      window.scrollTo(0, 0);
    }
  });
}

// Update pagination
function updatePagination(totalItems, currentPage, perPage) {
  const paginationContainer = document.getElementById('pagination');
  paginationContainer.innerHTML = '';
  
  const totalPages = Math.ceil(totalItems / perPage);
  
  if (totalPages <= 1) {
    return;
  }
  
  // Previous button
  if (currentPage > 1) {
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.setAttribute('data-page', currentPage - 1);
    prevBtn.innerHTML = '&laquo;';
    paginationContainer.appendChild(prevBtn);
  }
  
  // Page buttons
  for (let i = 1; i <= totalPages; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = 'pagination-btn';
    if (i === currentPage) {
      pageBtn.classList.add('active');
    }
    pageBtn.setAttribute('data-page', i);
    pageBtn.textContent = i;
    paginationContainer.appendChild(pageBtn);
  }
  
  // Next button
  if (currentPage < totalPages) {
    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.setAttribute('data-page', currentPage + 1);
    nextBtn.innerHTML = '&raquo;';
    paginationContainer.appendChild(nextBtn);
  }
}

// ===== MEDIA DISPLAY FUNCTIONS =====

// Display media files in the complaint details modal
function displayMediaFiles(mediaFiles) {
  const mediaSection = document.getElementById('media-section');
  const noMediaMessage = document.getElementById('no-media-message');
  const mediaGrid = document.getElementById('media-grid');
  
  if (!mediaFiles || mediaFiles.length === 0) {
    mediaSection.style.display = 'block';
    noMediaMessage.style.display = 'block';
    mediaGrid.innerHTML = '';
    return;
  }
  
  mediaSection.style.display = 'block';
  noMediaMessage.style.display = 'none';
  mediaGrid.innerHTML = '';
  
  mediaFiles.forEach((file, index) => {
    const mediaItem = createMediaItem(file, index);
    mediaGrid.appendChild(mediaItem);
  });
}

// Create individual media item for display
function createMediaItem(file, index) {
  const mediaItem = document.createElement('div');
  mediaItem.className = 'media-item';
  mediaItem.dataset.index = index;
  
  let thumbnailContent = '';
  let playOverlay = '';
  
  if (file.type === 'image') {
    // Use URL if available, otherwise fall back to data
    const imageSrc = file.url || file.data;
    thumbnailContent = `<img src="${imageSrc}" alt="${file.name}" class="media-thumbnail">`;
  } else if (file.type === 'video') {
    thumbnailContent = `<div class="media-thumbnail"><i class="fas fa-video"></i></div>`;
    playOverlay = '<div class="media-play-overlay"><i class="fas fa-play"></i></div>';
  } else if (file.type === 'audio') {
    thumbnailContent = `<div class="media-thumbnail"><i class="fas fa-music"></i></div>`;
    playOverlay = '<div class="media-play-overlay"><i class="fas fa-play"></i></div>';
  }
  
  mediaItem.innerHTML = `
    <div class="media-thumbnail-container">
      ${thumbnailContent}
      ${playOverlay}
    </div>
    <div class="media-type-badge ${file.type}">
      ${file.type.toUpperCase()}
    </div>
    <div class="media-info">
      <div class="media-name" title="${file.name}">${file.name}</div>
      <div class="media-meta">
        <span>${formatFileSize(file.size)}</span>
        <span>${formatDate(file.uploadedAt)}</span>
      </div>
    </div>
  `;
  
  // Add click handler for media preview
  mediaItem.addEventListener('click', () => {
    openMediaPreview(file, index);
  });
  
  return mediaItem;
}

// Open media preview modal
function openMediaPreview(file, index) {
  // Create preview modal
  const previewModal = document.createElement('div');
  previewModal.className = 'media-preview-modal';
  previewModal.innerHTML = `
    <div class="media-preview-backdrop" data-action="close-media-preview"></div>
    <div class="media-preview-content">
      <div class="media-preview-header">
        <h4>${file.name}</h4>
        <button class="media-preview-close" data-action="close-media-preview">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="media-preview-body">
        ${getMediaPreviewContent(file)}
      </div>
      <div class="media-preview-footer">
        <div class="media-preview-info">
          <span><strong>Type:</strong> ${file.type.toUpperCase()}</span>
          <span><strong>Size:</strong> ${formatFileSize(file.size)}</span>
          <span><strong>Uploaded:</strong> ${formatDate(file.uploadedAt)}</span>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(previewModal);
  document.body.style.overflow = 'hidden';
  
  // Make closeMediaPreview globally accessible
  window.closeMediaPreview = () => {
    document.body.removeChild(previewModal);
    document.body.style.overflow = '';
    delete window.closeMediaPreview;
  };
}

// Get media preview content based on file type
function getMediaPreviewContent(file) {
  // Use URL if available, otherwise fall back to data
  const mediaSrc = file.url || file.data;
  
  if (file.type === 'image') {
    return `<img src="${mediaSrc}" alt="${file.name}" style="max-width: 100%; max-height: 70vh; object-fit: contain;">`;
  } else if (file.type === 'video') {
    return `<video controls style="max-width: 100%; max-height: 70vh;">
      <source src="${mediaSrc}" type="${file.mimeType}">
      Your browser does not support the video tag.
    </video>`;
  } else if (file.type === 'audio') {
    return `<audio controls style="width: 100%;">
      <source src="${mediaSrc}" type="${file.mimeType}">
      Your browser does not support the audio tag.
    </audio>`;
  }
  return `<p>Preview not available for this file type.</p>`;
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

// ===== DISPATCH FUNCTIONALITY =====

// Setup button event listeners
function setupButtonEventListeners() {
  // Clear filters button
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', clearAllFilters);
  }
  
  // Refresh complaints button
  const refreshComplaintsBtn = document.getElementById('refresh-complaints-btn');
  if (refreshComplaintsBtn) {
    refreshComplaintsBtn.addEventListener('click', refreshComplaints);
  }
  
  // Debug buttons
  const testSidebarBtn = document.getElementById('test-sidebar-btn');
  if (testSidebarBtn) {
    testSidebarBtn.addEventListener('click', testSidebar);
  }
  
  const manualLoadSidebarBtn = document.getElementById('manual-load-sidebar-btn');
  if (manualLoadSidebarBtn) {
    manualLoadSidebarBtn.addEventListener('click', manualLoadSidebar);
  }
  
  const checkUserDataBtn = document.getElementById('check-user-data-btn');
  if (checkUserDataBtn) {
    checkUserDataBtn.addEventListener('click', checkUserData);
  }
}

// Setup media preview event listeners
function setupMediaPreviewEventListeners() {
  // Use event delegation for media preview modal
  document.addEventListener('click', (e) => {
    // Handle media preview close button and backdrop
    if (e.target.matches('[data-action="close-media-preview"]') || e.target.closest('[data-action="close-media-preview"]')) {
      closeMediaPreview();
    }
  });
}

// Setup dispatch functionality
function setupDispatchFunctionality() {
  const dispatchCheckbox = document.getElementById('dispatch-personnel');
  const dispatchOptions = document.getElementById('dispatch-options');
  
  if (dispatchCheckbox && dispatchOptions) {
    dispatchCheckbox.addEventListener('change', function() {
      if (this.checked) {
        dispatchOptions.style.display = 'block';
        // Load available personnel
        loadAvailablePersonnel();
      } else {
        dispatchOptions.style.display = 'none';
        // Clear selected personnel
        clearSelectedPersonnel();
      }
    });
  }
}

// Load available personnel for dispatch
async function loadAvailablePersonnel() {
  const personnelGrid = document.querySelector('.dispatch-personnel-grid');
  if (!personnelGrid) return;
  
  try {
    // Get current user's department
    const user = await checkAuth();
    const role = String((user.role || user.type || '')).toLowerCase();
    const deptFromRole = role.startsWith('lgu-admin-') ? role.replace('lgu-admin-', '')
                        : role.startsWith('lgu-') ? role.replace('lgu-', '')
                        : null;
    
    if (deptFromRole) {
      const res = await fetch(`/api/officers?department=${encodeURIComponent(deptFromRole)}`);
      const json = await res.json();
      
      if (res.ok && Array.isArray(json.officers)) {
        personnelGrid.innerHTML = '';
        
        json.officers.forEach((officer, index) => {
          const personnelItem = document.createElement('div');
          personnelItem.className = 'personnel-item';
          personnelItem.innerHTML = `
            <input type="checkbox" id="dispatch-officer-${index}" class="personnel-checkbox" value="${officer.id}">
            <label for="dispatch-officer-${index}">
              <i class="fas fa-user-shield"></i>
              <span>${officer.email}</span>
            </label>
          `;
          personnelGrid.appendChild(personnelItem);
        });
      }
    }
  } catch (error) {
    console.error('Error loading personnel:', error);
    // Fallback to default personnel
    loadDefaultPersonnel();
  }
}

// Load default personnel if API fails
function loadDefaultPersonnel() {
  const personnelGrid = document.querySelector('.dispatch-personnel-grid');
  if (!personnelGrid) return;
  
  const defaultPersonnel = [
    { id: 'officer-1', name: 'Officer 1' },
    { id: 'officer-2', name: 'Officer 2' },
    { id: 'officer-3', name: 'Officer 3' },
    { id: 'officer-4', name: 'Officer 4' }
  ];
  
  personnelGrid.innerHTML = '';
  defaultPersonnel.forEach((officer, index) => {
    const personnelItem = document.createElement('div');
    personnelItem.className = 'personnel-item';
    personnelItem.innerHTML = `
      <input type="checkbox" id="dispatch-officer-${index}" class="personnel-checkbox" value="${officer.id}">
      <label for="dispatch-officer-${index}">
        <i class="fas fa-user-shield"></i>
        <span>${officer.name}</span>
      </label>
    `;
    personnelGrid.appendChild(personnelItem);
  });
}

// Clear selected personnel
function clearSelectedPersonnel() {
  const checkboxes = document.querySelectorAll('.personnel-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  
  const instructions = document.getElementById('dispatch-instructions');
  if (instructions) {
    instructions.value = '';
  }
}

// Get selected personnel
function getSelectedPersonnel() {
  const selectedPersonnel = [];
  const checkboxes = document.querySelectorAll('.personnel-checkbox:checked');
  
  checkboxes.forEach(checkbox => {
    selectedPersonnel.push({
      id: checkbox.value,
      name: checkbox.nextElementSibling.textContent.trim()
    });
  });
  
  return selectedPersonnel;
}

// Handle dispatch notification
async function handleDispatchNotification(complaintId, personnel, instructions) {
  try {
    // In a real implementation, this would send notifications to the dispatched personnel
    // For now, we'll just log the dispatch information
    console.log('Dispatching personnel:', {
      complaintId,
      personnel,
      instructions,
      timestamp: new Date().toISOString()
    });
    
    // You could add API calls here to:
    // 1. Send push notifications to mobile apps
    // 2. Send SMS messages
    // 3. Send email notifications
    // 4. Update a dispatch tracking system
    
    // Example API call (uncomment when backend is ready):
    /*
    const response = await fetch('/api/dispatch-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        complaintId,
        personnel,
        instructions
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to send dispatch notifications');
    }
    */
    
  } catch (error) {
    console.error('Error handling dispatch notification:', error);
    // Don't throw error here as it would prevent the main save operation
    showToast('Complaint updated but dispatch notifications failed to send', 'warning');
  }
}

// Show complaint details
async function showComplaintDetails(complaintId) {
  console.log('showComplaintDetails called with ID:', complaintId);
  
  const complaint = await getComplaintByIdForLGU(complaintId);
  console.log('Retrieved complaint:', complaint);
  
  if (!complaint) {
    console.error('Complaint not found for ID:', complaintId);
    showToast('Complaint not found.', 'error');
    return;
  }
  
  // Populate modal with complaint details
  console.log('Populating modal with complaint data...');
  
  const modalTitle = document.getElementById('modal-title');
  if (modalTitle) {
    modalTitle.textContent = complaint.title;
  } else {
    console.error('Modal title element not found');
  }
  
  let statusClass;
  switch (complaint.status) {
    case 'pending':
      statusClass = 'status-pending';
      break;
    case 'in_progress':
      statusClass = 'status-in-progress';
      break;
    case 'resolved':
      statusClass = 'status-resolved';
      break;
  }
  
  const statusElement = document.getElementById('detail-status');
  if (statusElement) {
    statusElement.textContent = complaint.status;
    statusElement.className = `status-badge ${statusClass}`;
  } else {
    console.error('Status element not found');
  }
  
  const detailId = document.getElementById('detail-id');
  if (detailId) detailId.textContent = complaint.id;
  
  const detailDate = document.getElementById('detail-date');
  if (detailDate) detailDate.textContent = formatDateTime(complaint.created_at || complaint.createdAt);
  
  const detailType = document.getElementById('detail-type');
  if (detailType) detailType.textContent = complaint.type;
  
  const detailSubcategory = document.getElementById('detail-subcategory');
  if (detailSubcategory) detailSubcategory.textContent = complaint.subcategory;
  
  const detailLocation = document.getElementById('detail-location');
  if (detailLocation) detailLocation.textContent = complaint.location;
  
  const detailSubmitter = document.getElementById('detail-submitter');
  if (detailSubmitter) detailSubmitter.textContent = complaint.userName;
  
  const detailDescription = document.getElementById('detail-description');
  if (detailDescription) detailDescription.textContent = complaint.description;
  
  // Set current values in form
  const assignedUnitSelect = document.getElementById('assigned-unit');
  const statusSelect = document.getElementById('complaint-status');
  
  if (assignedUnitSelect) {
    if (complaint.assignedUnit) {
      assignedUnitSelect.value = complaint.assignedUnit;
    } else {
      assignedUnitSelect.value = '';
    }
  }
  
  if (statusSelect) {
    statusSelect.value = complaint.status;
  }
  
  // Handle media files
  displayMediaFiles(complaint.media_files || []);
  
  // Populate timeline
  const timelineContainer = document.getElementById('complaint-timeline');
  timelineContainer.innerHTML = '';
  
  if (complaint.timeline) {
    complaint.timeline.forEach(entry => {
      const timelineItem = document.createElement('div');
      timelineItem.className = 'timeline-item';
      
      let iconClass = '';
      if (entry.action.includes('submitted')) {
        iconClass = 'primary';
      } else if (entry.action.includes('resolved')) {
        iconClass = 'success';
      }
      
      timelineItem.innerHTML = `
        <div class="timeline-icon ${iconClass}">
          <i class="fas fa-${entry.action.includes('submitted') ? 'file-alt' : 
                            entry.action.includes('assigned') ? 'user-check' : 
                            entry.action.includes('resolved') ? 'check-circle' : 'spinner'}"></i>
        </div>
        <div class="timeline-content">
          <div class="timeline-title">${entry.action}</div>
          <div class="timeline-date">${formatDateTime(entry.date)}</div>
          <div class="timeline-actor">By: ${entry.actor}</div>
        </div>
      `;
      
      timelineContainer.appendChild(timelineItem);
    });
  }
  
  // Store complaint ID for save button
  document.getElementById('save-complaint-btn').setAttribute('data-id', complaint.id);
  // Store also CD row id if available via query param (optional enhancement)
  
  // Initialize map with complaint location
  initializeComplaintMap(complaint);
  
  // Show modal
  const modal = document.getElementById('complaint-modal');
  if (modal) {
    console.log('Modal found, showing modal');
    modal.style.display = 'block';
    
    // Small delay to ensure modal is fully rendered before initializing map
    setTimeout(() => {
      console.log('Modal displayed successfully, map should initialize now');
    }, 200);
    
  } else {
    console.error('Modal element not found!');
  }
  
  // If viewing from URL, add back button
  if (window.location.search.includes('id=')) {
    const modalFooter = document.querySelector('.modal-footer');
    
    // Check if back button already exists
    if (!document.querySelector('.back-btn')) {
      const backBtn = document.createElement('button');
      backBtn.className = 'btn btn-outline back-btn';
      backBtn.textContent = 'Back to List';
      backBtn.addEventListener('click', () => {
        window.location.href = '/lgu/complaints';
      });
      
      modalFooter.prepend(backBtn);
    }
  }
}

// Setup save button
function setupSaveButton() {
  const saveBtn = document.getElementById('save-complaint-btn');
  
  saveBtn.addEventListener('click', async () => {
    const complaintId = saveBtn.getAttribute('data-id');
    const assignedUnitEl = document.getElementById('assigned-unit');
    const assignedUnit = assignedUnitEl ? assignedUnitEl.value : '';
    const assignedOfficer = document.getElementById('assigned-officer') ? document.getElementById('assigned-officer').value : '';
    const status = document.getElementById('complaint-status').value;
    const notes = document.getElementById('admin-notes').value;
    
    // Get dispatch data
    const dispatchCheckbox = document.getElementById('dispatch-personnel');
    const isDispatchEnabled = dispatchCheckbox ? dispatchCheckbox.checked : false;
    const selectedPersonnel = isDispatchEnabled ? getSelectedPersonnel() : [];
    const dispatchInstructions = document.getElementById('dispatch-instructions') ? document.getElementById('dispatch-instructions').value : '';
    
    try {
      // Update complaint basic fields if API available
      if (window.updateComplaint) {
        await window.updateComplaint(complaintId, {
          assignedUnit,
          status,
          adminNotes: notes,
          dispatchEnabled: isDispatchEnabled,
          dispatchedPersonnel: selectedPersonnel,
          dispatchInstructions: dispatchInstructions
        });
      }

      // Handle dispatch notifications
      if (isDispatchEnabled && selectedPersonnel.length > 0) {
        await handleDispatchNotification(complaintId, selectedPersonnel, dispatchInstructions);
      }

      // If an officer was selected and there is a department involvement row, try to assign via backend API
      // Note: Without the complaint_department row id, we cannot target a specific row here.
      // This UI focuses on selecting officer; assignment per row happens in admin dashboard queue.
      // We simply notify success for the metadata update.
      const dispatchMessage = isDispatchEnabled && selectedPersonnel.length > 0 
        ? `Complaint ${complaintId} updated and ${selectedPersonnel.length} personnel dispatched!`
        : `Complaint ${complaintId} updated successfully!`;
      
      showToast(dispatchMessage, 'success');
      
      // Close modal
      document.getElementById('complaint-modal').style.display = 'none';
      
      // If viewing from URL, go back to list
      if (window.location.search.includes('id=')) {
        window.location.href = '/lgu/complaints';
      }
    } catch (error) {
      console.error('Error updating complaint:', error);
      showToast(`Error updating complaint: ${error.message}`, 'error');
    }
  });
}

// Load departments and wire help requests sender
async function setupHelpRequests() {
  try {
    const container = document.getElementById('help-departments');
    const sendBtn = document.getElementById('send-help-requests');
    const result = document.getElementById('help-request-result');
    if (!container || !sendBtn) return;

    // Determine current admin's department to exclude it from the list
    let deptFromRole = null;
    try {
      const sb = await window.supabaseManager.initialize();
      const { data: { user } } = await sb.auth.getUser();
      const role = (user?.user_metadata?.role || '').toLowerCase();
      deptFromRole = role.startsWith('lgu-admin-') ? role.replace('lgu-admin-', '')
                   : role.startsWith('lgu-') ? role.replace('lgu-', '')
                   : null;
    } catch (_) {}

    // Fetch departments
    const res = await fetch('/api/departments');
    const json = await res.json();
    const depts = Array.isArray(json.departments) ? json.departments : [];
    container.innerHTML = '';
    depts.forEach(d => {
      // Exclude current admin's own department (match by code or name)
      const codeLc = String(d.code || '').toLowerCase();
      const nameLc = String(d.name || '').toLowerCase();
      if (deptFromRole && (codeLc === deptFromRole || nameLc === deptFromRole)) return;
      const id = `help-dept-${(d.code || d.name).toLowerCase()}`;
      const wrap = document.createElement('label');
      wrap.style.display = 'flex';
      wrap.style.alignItems = 'center';
      wrap.style.gap = '6px';
      wrap.innerHTML = `<input type="checkbox" value="${d.code || d.name}" id="${id}"><span>${d.name} (${d.code})</span>`;
      container.appendChild(wrap);
    });

    // Wire send button
    sendBtn.addEventListener('click', async () => {
      try {
        result.textContent = 'Sending...';
        // Determine active complaint from modal
        const complaintId = document.getElementById('save-complaint-btn').getAttribute('data-id');
        if (!complaintId) { result.textContent = 'Open a complaint first'; return; }
        const selected = Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(i => i.value);
        if (!selected.length) { result.textContent = 'Select at least one department'; return; }
        const r = await fetch(`/api/complaints/${encodeURIComponent(complaintId)}/request_help`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ departments: selected })
        });
        const j = await r.json();
        result.textContent = r.ok ? `Requests sent: ${(j.items||[]).length}` : (j.error || 'Failed');
      } catch (e) {
        result.textContent = 'Failed to send requests';
      }
    });
  } catch (_) {}
}

// Setup modal close
function setupModalClose() {
  const modal = document.getElementById('complaint-modal');
  const closeButtons = document.querySelectorAll('.modal-close, .modal-close-btn');
  
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Clean up map before closing modal
      if (currentMap) {
        console.log('Cleaning up map on modal close');
        currentMap.remove();
        currentMap = null;
      }
      
      modal.style.display = 'none';
      
      // If viewing from URL, go back to list
      if (window.location.search.includes('id=')) {
        window.location.href = '/lgu/complaints';
      }
    });
  });
  
  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      // Clean up map before closing modal
      if (currentMap) {
        console.log('Cleaning up map on modal close');
        currentMap.remove();
        currentMap = null;
      }
      
      modal.style.display = 'none';
      
      // If viewing from URL, go back to list
      if (window.location.search.includes('id=')) {
        window.location.href = '/lgu/complaints';
      }
    }
  });
}

// Helper functions
async function getComplaintByIdForLGU(id) {
  console.log('getComplaintByIdForLGU called with ID:', id);
  try {
    // Use the real data management function from data-management.js
    if (window.getComplaintById) {
      console.log('Using real getComplaintById function from data-management.js');
      return await window.getComplaintById(id);
    }
    // Fallback to local search if function not available
    console.log('Using local mock data fallback - getComplaintById function not found');
    // Get complaints directly from the mock data to avoid recursion
    const mockComplaints = [
      { id: 'CP001', title: 'Pothole on Main Street', type: 'infrastructure', subcategory: 'Road Damage', location: '123 Main Street', status: 'resolved', created_at: '2025-01-05T10:30:00', userId: 'citizen-user', userName: 'John Citizen', description: 'Large pothole causing damage to vehicles', assignedUnit: 'public_works' },
      { id: 'CP002', title: 'Streetlight Out', type: 'infrastructure', subcategory: 'Street Lighting', location: 'Corner of Pine St and Oak Ave', status: 'in_progress', created_at: '2025-01-10T18:45:00', userId: 'citizen-user', userName: 'John Citizen', description: 'Streetlight has been out for a week', assignedUnit: 'public_works' },
      { id: 'CP003', title: 'Missed Garbage Collection', type: 'sanitation', subcategory: 'Garbage Collection', location: '456 Cedar Avenue', status: 'resolved', created_at: '2025-01-15T08:20:00', userId: 'citizen-user', userName: 'John Citizen', description: 'Garbage not collected for two weeks', assignedUnit: 'waste' },
      { id: 'CP004', title: 'Noise Complaint - Construction', type: 'noise', subcategory: 'Construction Noise', location: '789 Maple Drive', status: 'pending', created_at: '2025-01-20T06:15:00', userId: 'citizen-user', userName: 'John Citizen', description: 'Construction starting too early in the morning' },
      { id: 'CP005', title: 'Water Main Break', type: 'utilities', subcategory: 'Water Supply', location: '200 Block of Birch Street', status: 'in_progress', created_at: '2025-01-22T15:30:00', userId: 'other-user', userName: 'Jane Smith', description: 'Major water main break flooding the street', assignedUnit: 'public_works' },
      { id: 'CP006', title: 'Suspicious Activity', type: 'public_safety', subcategory: 'Suspicious Activity', location: 'Oak Elementary School', status: 'resolved', created_at: '2025-01-18T22:10:00', userId: 'other-user', userName: 'Jane Smith', description: 'Suspicious individuals loitering around school', assignedUnit: 'police' },
      { id: 'CP007', title: 'Illegal Dumping', type: 'sanitation', subcategory: 'Illegal Dumping', location: 'Vacant lot at end of Willow Lane', status: 'in_progress', created_at: '2025-01-25T14:20:00', userId: 'citizen-user', userName: 'John Citizen', description: 'Construction waste being dumped in vacant lot', assignedUnit: 'waste' },
      { id: 'CP008', title: 'Broken Sidewalk', type: 'infrastructure', subcategory: 'Sidewalk Problems', location: 'Cherry Street between 5th and 6th Ave', status: 'pending', created_at: '2025-01-28T16:45:00', userId: 'other-user', userName: 'Jane Smith', description: 'Sidewalk is severely cracked and uneven' }
    ];
    const foundComplaint = mockComplaints.find(complaint => complaint.id === id);
    console.log('Found complaint:', foundComplaint);
    return foundComplaint;
  } catch (error) {
    console.error('Error getting complaint by ID:', error);
    return null;
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Toast notification function
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  
  if (!toast) return;
  
  // Create toast elements
  const toastHeader = document.createElement('div');
  toastHeader.className = 'toast-header';
  
  const toastTitle = document.createElement('div');
  toastTitle.className = 'toast-title';
  toastTitle.textContent = type === 'success' ? 'Success' : 'Error';
  
  const toastClose = document.createElement('button');
  toastClose.className = 'toast-close';
  toastClose.innerHTML = '&times;';
  toastClose.addEventListener('click', () => {
    toast.classList.remove('show');
  });
  
  toastHeader.appendChild(toastTitle);
  toastHeader.appendChild(toastClose);
  
  const toastMessage = document.createElement('div');
  toastMessage.className = 'toast-message';
  toastMessage.textContent = message;
  
  // Clear previous content
  toast.innerHTML = '';
  
  // Add new content
  toast.appendChild(toastHeader);
  toast.appendChild(toastMessage);
  
  // Set toast class
  toast.className = 'toast';
  toast.classList.add(type);
  
  // Show toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 100);
  
  // Auto hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Global variable to store the current map instance
let currentMap = null;

// Initialize complaint location map
function initializeComplaintMap(complaint) {
  console.log('Initializing map for complaint:', complaint);
  
  const mapContainer = document.getElementById('complaint-map');
  const mapLoading = document.getElementById('map-loading');
  const coordinatesSpan = document.getElementById('map-coordinates');
  const boundarySpan = document.getElementById('boundary-scope');
  
  if (!mapContainer) {
    console.error('Map container not found');
    return;
  }
  
  // Destroy previous map if it exists
  if (currentMap) {
    console.log('Destroying previous map');
    currentMap.remove();
    currentMap = null;
  }
  
  // Clear previous map and add loading message back
  mapContainer.innerHTML = '<div id="map-loading" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #666; font-size: 14px; z-index: 1000;">Initializing map...</div>';
  
  // Check if complaint has coordinates
  if (complaint.latitude && complaint.longitude) {
    const lat = parseFloat(complaint.latitude);
    const lng = parseFloat(complaint.longitude);
    
    // Update coordinates display
    coordinatesSpan.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      try {
        // Create map
        const map = L.map('complaint-map', {
          zoomControl: true,
          attributionControl: false
        }).setView([lat, lng], 14);
        
        // Store the map instance globally
        currentMap = map;
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        // Add complaint marker
        const marker = L.marker([lat, lng]).addTo(map);
        marker.bindPopup(`<b>Complaint Location</b><br>${complaint.location || 'Location not specified'}`);
        
        // Force map refresh
        map.invalidateSize();
        
        // Remove the loading message since map is now visible
        const loadingMessage = mapContainer.querySelector('#map-loading');
        if (loadingMessage) {
          loadingMessage.remove();
        }
        
        // Try to fetch barangay boundary data
        fetchBarangayBoundary(lat, lng, map, complaint, boundarySpan);
        
        console.log('Map initialized successfully');
        
      } catch (error) {
        console.error('Error creating map:', error);
        mapContainer.innerHTML = `
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #666;">
            <div>Error loading map</div>
            <div style="font-size: 12px; margin-top: 5px;">${error.message}</div>
          </div>
        `;
      }
    }, 100);
    
  } else {
    // No coordinates available
    mapContainer.innerHTML = `
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: #666;">
        <i class="fas fa-map-marker-alt" style="font-size: 2rem; margin-bottom: 10px; color: #ccc;"></i>
        <div>No location coordinates available</div>
        <div style="font-size: 12px; margin-top: 5px;">This complaint was submitted without GPS coordinates</div>
      </div>
    `;
    
    coordinatesSpan.textContent = 'Not available';
    boundarySpan.textContent = 'Cannot determine without coordinates';
    
    console.log('No coordinates available for map');
  }
}

// Fetch barangay boundary data
async function fetchBarangayBoundary(lat, lng, map, complaint, boundarySpan) {
  try {
    console.log('Fetching barangay boundary for coordinates:', lat, lng);
    
    // Try to get barangay name from complaint location or use reverse geocoding
    let barangayName = extractBarangayFromLocation(complaint.location);
    
    if (!barangayName) {
      // Try reverse geocoding to get barangay name
      barangayName = await getBarangayFromCoordinates(lat, lng);
    }
    
    if (barangayName) {
      // Try to fetch boundary from OpenStreetMap Nominatim or other sources
      const boundaryData = await getBarangayBoundaryData(barangayName);
      
              if (boundaryData) {
          // Draw the actual barangay boundary
          const boundaryPolygon = L.polygon(boundaryData.coordinates, {
            color: '#0d6efd',
            fillColor: '#0d6efd',
            fillOpacity: 0.1,
            weight: 2
          }).addTo(map);
          
          // Add barangay boundary label
          const boundaryLabel = L.tooltip({
            permanent: true,
            direction: 'center',
            className: 'barangay-boundary-label'
          })
          .setContent(`Barangay ${boundaryData.name}`)
          .setLatLng(boundaryData.center);
          
          boundaryPolygon.bindTooltip(boundaryLabel);
          
          // Update boundary scope display
          boundarySpan.textContent = `Barangay ${boundaryData.name} administrative boundary`;
          
          // Fit map to show both marker and boundary
          map.fitBounds(boundaryPolygon.getBounds(), { padding: [20, 20] });
          
          console.log('Barangay boundary displayed successfully');
        } else {
          // Fallback: show approximate barangay area
          showApproximateBarangayArea(lat, lng, map, barangayName, boundarySpan);
          
          // Ensure map is properly sized after adding boundary
          map.invalidateSize();
        }
    } else {
      // No barangay info available, show default view
      showDefaultMapView(lat, lng, map, boundarySpan);
    }
    
  } catch (error) {
    console.error('Error fetching barangay boundary:', error);
    // Fallback to default view
    showDefaultMapView(lat, lng, map, boundarySpan);
  }
}

// Extract barangay name from location string
function extractBarangayFromLocation(location) {
  if (!location) return null;
  
  // Common barangay patterns in Philippine addresses
  const barangayPatterns = [
    /barangay\s+(\w+)/i,
    /brgy\.?\s*(\w+)/i,
    /zone\s+(\d+)/i,
    /purok\s+(\w+)/i
  ];
  
  for (const pattern of barangayPatterns) {
    const match = location.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

// Get barangay name from coordinates using reverse geocoding
async function getBarangayFromCoordinates(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`);
    const data = await response.json();
    
    if (data.address) {
      // Look for barangay in address components
      return data.address.suburb || data.address.neighbourhood || data.address.city_district;
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error);
  }
  
  return null;
}

// Get barangay boundary data (placeholder - you'll need to implement this)
async function getBarangayBoundaryData(barangayName) {
  // This is where you would fetch actual barangay boundary data
  // Options:
  // 1. From your Supabase database if you have GIS data
  // 2. From a government GIS service
  // 3. From OpenStreetMap if the data exists
  
  console.log('Attempting to fetch boundary data for:', barangayName);
  
  // For now, return null to trigger fallback
  // You can implement this based on your data source
  return null;
}

// Show approximate barangay area when exact boundary isn't available
function showApproximateBarangayArea(lat, lng, map, barangayName, boundarySpan) {
  // Create an approximate circular area representing barangay
  const approximateArea = L.circle([lat, lng], {
    color: '#0d6efd',
    fillColor: '#0d6efd',
    fillOpacity: 0.1,
    radius: 1000 // 1km radius as approximation
  }).addTo(map);
  
  // Add label
  const areaLabel = L.tooltip({
    permanent: true,
    direction: 'center',
    className: 'barangay-approximate-label'
  })
  .setContent(`Approximate Barangay ${barangayName} Area`)
  .setLatLng([lat, lng]);
  
  approximateArea.bindTooltip(areaLabel);
  
  // Update boundary scope display
  boundarySpan.textContent = `Approximate Barangay ${barangayName} area (1km radius)`;
  
  // Fit map to show area
  map.fitBounds(approximateArea.getBounds(), { padding: [20, 20] });
}

// Show default map view when no boundary data is available
function showDefaultMapView(lat, lng, map, boundarySpan) {
  // Show a simple marker with location info
  boundarySpan.textContent = 'Location coordinates available, but barangay boundary data not accessible';
  
  // Fit map to show marker
  map.setView([lat, lng], 16);
}

// Clear all filters function
function clearAllFilters() {
  console.log('Clearing all filters');
  
  // Clear search input
  const searchInput = document.querySelector('input[type="search"]');
  if (searchInput) {
    searchInput.value = '';
  }
  
  // Reset status filter
  const statusFilter = document.querySelector('select[name="status"]');
  if (statusFilter) {
    statusFilter.value = 'all';
  }
  
  // Reset type filter
  const typeFilter = document.querySelector('select[name="type"]');
  if (typeFilter) {
    typeFilter.value = 'all';
  }
  
  // Reset time filter
  const timeFilter = document.querySelector('select[name="time"]');
  if (timeFilter) {
    timeFilter.value = 'all';
  }
  
  // Refresh complaints with cleared filters
  refreshComplaints();
  
  // Show success message
  showToast('All filters cleared successfully!', 'success');
}

// Refresh complaints function
function refreshComplaints() {
  console.log('Refreshing complaints');
  
  // Reload the page to refresh complaints
  window.location.reload();
}

// Debug functions for sidebar testing
function testSidebar() {
  const debugOutput = document.getElementById('debug-output');
  debugOutput.innerHTML = '<strong>Testing Sidebar Loader...</strong><br>';
  
  if (window.sidebarLoader) {
    debugOutput.innerHTML += '✅ SidebarLoader instance found<br>';
    debugOutput.innerHTML += `User type: ${window.sidebarLoader.userType}<br>`;
    debugOutput.innerHTML += `Sidebar loaded: ${window.sidebarLoader.sidebarLoaded}<br>`;
  } else {
    debugOutput.innerHTML += '❌ SidebarLoader instance not found<br>';
  }
  
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    debugOutput.innerHTML += '✅ Sidebar element found in DOM<br>';
    debugOutput.innerHTML += `Sidebar classes: ${sidebar.className}<br>`;
  } else {
    debugOutput.innerHTML += '❌ Sidebar element not found in DOM<br>';
  }
  
  const sidebarToggle = document.getElementById('sidebar-toggle');
  if (sidebarToggle) {
    debugOutput.innerHTML += '✅ Sidebar toggle button found<br>';
  } else {
    debugOutput.innerHTML += '❌ Sidebar toggle button not found<br>';
  }
}

function manualLoadSidebar() {
  const debugOutput = document.getElementById('debug-output');
  debugOutput.innerHTML = '<strong>Manually loading sidebar...</strong><br>';
  
  if (window.sidebarLoader) {
    try {
      window.sidebarLoader.init();
      debugOutput.innerHTML += '✅ Manual sidebar initialization completed<br>';
    } catch (error) {
      debugOutput.innerHTML += `❌ Error: ${error.message}<br>`;
    }
  } else {
    debugOutput.innerHTML += '❌ SidebarLoader not available<br>';
  }
}

// Update header with user's name
function updateHeaderWithUserName(user) {
  const headerUserName = document.getElementById('header-user-name');
  if (headerUserName && user) {
    // Use the same name extraction logic as user-utils.js
    const name = user.user_metadata?.full_name || 
                 user.user_metadata?.name || 
                 user.email?.split('@')[0] || 
                 'User';
    headerUserName.textContent = name;
  }
}

function checkUserData() {
  const debugOutput = document.getElementById('debug-output');
  debugOutput.innerHTML = '<strong>Checking user data...</strong><br>';
  
  const userData = sessionStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      debugOutput.innerHTML += '✅ User data found in sessionStorage<br>';
      debugOutput.innerHTML += `User ID: ${user.id}<br>`;
      debugOutput.innerHTML += `User Role: ${user.role}<br>`;
      debugOutput.innerHTML += `User Type: ${user.type}<br>`;
      debugOutput.innerHTML += `User Name: ${user.name}<br>`;
    } catch (error) {
      debugOutput.innerHTML += `❌ Error parsing user data: ${error.message}<br>`;
    }
  } else {
    debugOutput.innerHTML += '❌ No user data in sessionStorage<br>';
  }
  
  // Check current path
  debugOutput.innerHTML += `Current path: ${window.location.pathname}<br>`;
}
