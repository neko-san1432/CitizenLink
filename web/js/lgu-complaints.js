document.addEventListener('DOMContentLoaded', () => {
  // Get user and complaints
  const user = checkAuth();
  if (!user) return;
  
  const complaints = getComplaints();
  
  // Check if viewing a specific complaint
  const urlParams = new URLSearchParams(window.location.search);
  const complaintId = urlParams.get('id');
  
  if (complaintId) {
    // Show complaint details
    showComplaintDetails(complaintId);
  } else {
    // Load complaints list
    loadComplaints(complaints);
    
    // Setup filters
    setupFilters(complaints);
    
    // Setup pagination
    setupPagination(complaints);
  }
  
  // Setup modal close
  setupModalClose();
  
  // Setup save button
  setupSaveButton();
});

// Mock functions for demonstration purposes
function checkAuth() {
  // Replace with actual authentication check logic
  return { username: 'admin-user', type: 'lgu' };
}

function getComplaints() {
  // Replace with actual data fetching logic
  return [
    { id: 'CP001', title: 'Pothole on Main Street', type: 'infrastructure', subcategory: 'Road Damage', location: '123 Main Street', urgency: 'high', status: 'resolved', createdAt: '2025-01-05T10:30:00', userId: 'citizen-user', userName: 'John Citizen', description: 'Large pothole causing damage to vehicles', assignedUnit: 'public_works' },
    { id: 'CP002', title: 'Streetlight Out', type: 'infrastructure', subcategory: 'Street Lighting', location: 'Corner of Pine St and Oak Ave', urgency: 'medium', status: 'in_progress', createdAt: '2025-01-10T18:45:00', userId: 'citizen-user', userName: 'John Citizen', description: 'Streetlight has been out for a week', assignedUnit: 'public_works' },
    { id: 'CP003', title: 'Missed Garbage Collection', type: 'sanitation', subcategory: 'Garbage Collection', location: '456 Cedar Avenue', urgency: 'high', status: 'resolved', createdAt: '2025-01-15T08:20:00', userId: 'citizen-user', userName: 'John Citizen', description: 'Garbage not collected for two weeks', assignedUnit: 'waste' },
    { id: 'CP004', title: 'Noise Complaint - Construction', type: 'noise', subcategory: 'Construction Noise', location: '789 Maple Drive', urgency: 'medium', status: 'pending', createdAt: '2025-01-20T06:15:00', userId: 'citizen-user', userName: 'John Citizen', description: 'Construction starting too early in the morning' },
    { id: 'CP005', title: 'Water Main Break', type: 'utilities', subcategory: 'Water Supply', location: '200 Block of Birch Street', urgency: 'emergency', status: 'in_progress', createdAt: '2025-01-22T15:30:00', userId: 'other-user', userName: 'Jane Smith', description: 'Major water main break flooding the street', assignedUnit: 'public_works' },
    { id: 'CP006', title: 'Suspicious Activity', type: 'public_safety', subcategory: 'Suspicious Activity', location: 'Oak Elementary School', urgency: 'high', status: 'resolved', createdAt: '2025-01-18T22:10:00', userId: 'other-user', userName: 'Jane Smith', description: 'Suspicious individuals loitering around school', assignedUnit: 'police' },
    { id: 'CP007', title: 'Illegal Dumping', type: 'sanitation', subcategory: 'Illegal Dumping', location: 'Vacant lot at end of Willow Lane', urgency: 'medium', status: 'in_progress', createdAt: '2025-01-25T14:20:00', userId: 'citizen-user', userName: 'John Citizen', description: 'Construction waste being dumped in vacant lot', assignedUnit: 'waste' },
    { id: 'CP008', title: 'Broken Sidewalk', type: 'infrastructure', subcategory: 'Sidewalk Problems', location: 'Cherry Street between 5th and 6th Ave', urgency: 'medium', status: 'pending', createdAt: '2025-01-28T16:45:00', userId: 'other-user', userName: 'Jane Smith', description: 'Sidewalk is severely cracked and uneven' }
  ];
}

// Load complaints into table
function loadComplaints(complaints, filters = {}) {
  const tableBody = document.getElementById('complaints-table-body');
  const noComplaintsContainer = document.getElementById('no-complaints');
  
  // Clear current list
  tableBody.innerHTML = '';
  
  // Filter complaints
  let filteredComplaints = [...complaints];
  
  if (filters.status && filters.status !== 'all') {
    filteredComplaints = filteredComplaints.filter(c => c.status === filters.status);
  }
  
  if (filters.type && filters.type !== 'all') {
    filteredComplaints = filteredComplaints.filter(c => c.type === filters.type);
  }
  
  if (filters.urgency && filters.urgency !== 'all') {
    filteredComplaints = filteredComplaints.filter(c => c.urgency === filters.urgency);
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
      const complaintDate = new Date(c.createdAt);
      
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
  
  // Sort complaints by date (newest first)
  filteredComplaints.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
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
  
  // Create table rows
  paginatedComplaints.forEach(complaint => {
    const row = document.createElement('tr');
    
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
    
    let urgencyClass;
    switch (complaint.urgency) {
      case 'low':
        urgencyClass = 'urgency-low';
        break;
      case 'medium':
        urgencyClass = 'urgency-medium';
        break;
      case 'high':
        urgencyClass = 'urgency-high';
        break;
      case 'emergency':
        urgencyClass = 'urgency-emergency';
        break;
    }
    
    row.innerHTML = `
      <td>${complaint.id}</td>
      <td>${complaint.title}</td>
      <td>${complaint.type.replace('_', ' ')}</td>
      <td>${complaint.location}</td>
      <td>${formatDate(complaint.createdAt)}</td>
      <td><span class="urgency-badge ${urgencyClass}">${complaint.urgency}</span></td>
      <td><span class="status-badge ${statusClass}">${complaint.status}</span></td>
      <td>
        <button class="btn btn-sm view-complaint-btn" data-id="${complaint.id}">
          <i class="fas fa-eye"></i> View
        </button>
      </td>
    `;
    
    tableBody.appendChild(row);
  });
  
  // Add event listeners to view buttons
  document.querySelectorAll('.view-complaint-btn').forEach(button => {
    button.addEventListener('click', () => {
      const complaintId = button.getAttribute('data-id');
      showComplaintDetails(complaintId);
    });
  });
  
  // Update pagination
  updatePagination(filteredComplaints.length, page, perPage);
}

// Setup filters
function setupFilters(complaints) {
  const searchInput = document.getElementById('search-complaints');
  const statusFilter = document.getElementById('status-filter');
  const typeFilter = document.getElementById('type-filter');
  const urgencyFilter = document.getElementById('urgency-filter');
  const dateFilter = document.getElementById('date-filter');
  
  // Current filters
  const filters = {
    search: '',
    status: 'all',
    type: 'all',
    urgency: 'all',
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
  
  // Urgency filter
  urgencyFilter.addEventListener('change', () => {
    filters.urgency = urgencyFilter.value;
    filters.page = 1; // Reset to first page
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
function setupPagination(complaints) {
  const paginationContainer = document.getElementById('pagination');
  
  paginationContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('pagination-btn')) {
      const page = parseInt(e.target.getAttribute('data-page'));
      
      // Get current filters
      const searchInput = document.getElementById('search-complaints');
      const statusFilter = document.getElementById('status-filter');
      const typeFilter = document.getElementById('type-filter');
      const urgencyFilter = document.getElementById('urgency-filter');
      const dateFilter = document.getElementById('date-filter');
      
      const filters = {
        search: searchInput.value,
        status: statusFilter.value,
        type: typeFilter.value,
        urgency: urgencyFilter.value,
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

// Show complaint details
function showComplaintDetails(complaintId) {
  const complaint = getComplaintById(complaintId);
  
  if (!complaint) {
    showToast('Complaint not found.', 'error');
    return;
  }
  
  // Populate modal with complaint details
  document.getElementById('modal-title').textContent = complaint.title;
  
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
  statusElement.textContent = complaint.status;
  statusElement.className = `status-badge ${statusClass}`;
  
  document.getElementById('detail-id').textContent = complaint.id;
  document.getElementById('detail-date').textContent = formatDate(complaint.createdAt);
  document.getElementById('detail-type').textContent = complaint.type;
  document.getElementById('detail-subcategory').textContent = complaint.subcategory;
  document.getElementById('detail-urgency').textContent = complaint.urgency;
  document.getElementById('detail-location').textContent = complaint.location;
  document.getElementById('detail-submitter').textContent = complaint.userName;
  document.getElementById('detail-description').textContent = complaint.description;
  
  // Set current values in form
  const assignedUnitSelect = document.getElementById('assigned-unit');
  const statusSelect = document.getElementById('complaint-status');
  
  if (complaint.assignedUnit) {
    assignedUnitSelect.value = complaint.assignedUnit;
  } else {
    assignedUnitSelect.value = '';
  }
  
  statusSelect.value = complaint.status;
  
  // Handle photo
  const photoSection = document.getElementById('photo-section');
  const photoElement = document.getElementById('detail-photo');
  
  if (complaint.photo) {
    photoSection.style.display = 'block';
    photoElement.style.backgroundImage = `url(${complaint.photo})`;
  } else {
    photoSection.style.display = 'none';
  }
  
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
  
  // Show modal
  const modal = document.getElementById('complaint-modal');
  modal.classList.add('open');
  
  // If viewing from URL, add back button
  if (window.location.search.includes('id=')) {
    const modalFooter = document.querySelector('.modal-footer');
    
    // Check if back button already exists
    if (!document.querySelector('.back-btn')) {
      const backBtn = document.createElement('button');
      backBtn.className = 'btn btn-outline back-btn';
      backBtn.textContent = 'Back to List';
      backBtn.addEventListener('click', () => {
        window.location.href = 'complaints.html';
      });
      
      modalFooter.prepend(backBtn);
    }
  }
}

// Setup save button
function setupSaveButton() {
  const saveBtn = document.getElementById('save-complaint-btn');
  
  saveBtn.addEventListener('click', () => {
    const complaintId = saveBtn.getAttribute('data-id');
    const assignedUnit = document.getElementById('assigned-unit').value;
    const status = document.getElementById('complaint-status').value;
    const notes = document.getElementById('admin-notes').value;
    
    // This would normally update the complaint in the database
    // For demo purposes, we'll just show a toast notification
    
    showToast(`Complaint ${complaintId} updated successfully!`);
    
    // Close modal
    document.getElementById('complaint-modal').classList.remove('open');
    
    // If viewing from URL, go back to list
    if (window.location.search.includes('id=')) {
      window.location.href = 'complaints.html';
    }
  });
}

// Setup modal close
function setupModalClose() {
  const modal = document.getElementById('complaint-modal');
  const closeButtons = document.querySelectorAll('.modal-close, .modal-close-btn');
  
  closeButtons.forEach(button => {
    button.addEventListener('click', () => {
      modal.classList.remove('open');
      
      // If viewing from URL, go back to list
      if (window.location.search.includes('id=')) {
        window.location.href = 'complaints.html';
      }
    });
  });
  
  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open');
      
      // If viewing from URL, go back to list
      if (window.location.search.includes('id=')) {
        window.location.href = 'complaints.html';
      }
    }
  });
}

// Helper functions
function getComplaintById(id) {
  const complaints = getComplaints();
  return complaints.find(complaint => complaint.id === id);
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