document.addEventListener('DOMContentLoaded', () => {
  // Get user
  const user = checkAuth();
  if (!user) return;
  
  // Get complaints
  const complaints = getComplaintsByUserId(user.username);
  
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
});

// Load complaints list
function loadComplaints(complaints, filters = {}) {
  const complaintsContainer = document.getElementById('complaints-list');
  const noComplaintsContainer = document.getElementById('no-complaints');
  
  // Clear current list
  complaintsContainer.innerHTML = '';
  
  // Filter complaints
  let filteredComplaints = [...complaints];
  
  if (filters.status && filters.status !== 'all') {
    filteredComplaints = filteredComplaints.filter(c => c.status === filters.status);
  }
  
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    filteredComplaints = filteredComplaints.filter(c => 
      c.title.toLowerCase().includes(searchTerm) || 
      c.description.toLowerCase().includes(searchTerm) ||
      c.location.toLowerCase().includes(searchTerm)
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
    complaintsContainer.style.display = 'none';
    noComplaintsContainer.style.display = 'flex';
    return;
  } else {
    complaintsContainer.style.display = 'flex';
    noComplaintsContainer.style.display = 'none';
  }
  
  // Apply pagination
  const page = filters.page || 1;
  const perPage = 10;
  const start = (page - 1) * perPage;
  const end = start + perPage;
  const paginatedComplaints = filteredComplaints.slice(start, end);
  
  // Create complaint items
  paginatedComplaints.forEach(complaint => {
    const complaintItem = document.createElement('div');
    complaintItem.className = 'complaint-item';
    
    let statusClass;
    switch (complaint.status) {
      case ComplaintStatus.PENDING:
        statusClass = 'status-pending';
        break;
      case ComplaintStatus.IN_PROGRESS:
        statusClass = 'status-in-progress';
        break;
      case ComplaintStatus.RESOLVED:
        statusClass = 'status-resolved';
        break;
    }
    
    complaintItem.innerHTML = `
      <div class="complaint-info">
        <div class="complaint-title">${complaint.title}</div>
        <div class="complaint-date">${formatDate(complaint.createdAt)}</div>
      </div>
      <div class="complaint-actions">
        <span class="status-badge ${statusClass}">${complaint.status}</span>
        <button class="btn btn-outline view-complaint-btn" data-id="${complaint.id}">
          View Details
        </button>
      </div>
    `;
    
    complaintsContainer.appendChild(complaintItem);
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
  const dateFilter = document.getElementById('date-filter');
  
  // Current filters
  const filters = {
    search: '',
    status: 'all',
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
      const dateFilter = document.getElementById('date-filter');
      
      const filters = {
        search: searchInput.value,
        status: statusFilter.value,
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
    case ComplaintStatus.PENDING:
      statusClass = 'status-pending';
      break;
    case ComplaintStatus.IN_PROGRESS:
      statusClass = 'status-in-progress';
      break;
    case ComplaintStatus.RESOLVED:
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
  document.getElementById('detail-assigned').textContent = complaint.assignedUnit ? 
    governmentUnitNames[complaint.assignedUnit] : 'Not yet assigned';
  document.getElementById('detail-description').textContent = complaint.description;
  
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
  
  // Show modal
  const modal = document.getElementById('complaint-modal');
  modal.classList.add('open');
  
  // If viewing from URL, add back button
  if (window.location.search.includes('id=')) {
    const modalFooter = document.querySelector('.modal-footer');
    
    // Check if back button already exists
    if (!document.querySelector('.back-btn')) {
      const backBtn = document.createElement('button');
      backBtn.className = 'btn btn-primary back-btn';
      backBtn.textContent = 'Back to List';
      backBtn.addEventListener('click', () => {
        window.location.href = 'my-complaints.html';
      });
      
      modalFooter.prepend(backBtn);
    }
  }
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
        window.location.href = 'my-complaints.html';
      }
    });
  });
  
  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open');
      
      // If viewing from URL, go back to list
      if (window.location.search.includes('id=')) {
        window.location.href = 'my-complaints.html';
      }
    }
  });
}

// Mock functions for demonstration purposes.  Replace with actual implementations.
function checkAuth() {
    // Replace with actual authentication check logic
    return { username: 'testuser' };
}

function getComplaintsByUserId(userId) {
    // Replace with actual data fetching logic
    return [
        { id: '1', title: 'Pothole Complaint', description: 'Large pothole on Main St', location: 'Main St', status: 'pending', createdAt: '2024-01-20', type: 'Road Maintenance', subcategory: 'Pothole', urgency: 'High', assignedUnit: 'roads', timeline: [{ action: 'Complaint submitted', date: '2024-01-20T10:00:00', actor: 'testuser' }] },
        { id: '2', title: 'Noise Complaint', description: 'Loud music at night', location: 'Apartment Building', status: 'in_progress', createdAt: '2024-02-15', type: 'Noise Violation', subcategory: 'Loud Music', urgency: 'Medium', assignedUnit: 'police', timeline: [{ action: 'Complaint submitted', date: '2024-02-15T22:00:00', actor: 'testuser' }, { action: 'Assigned to officer', date: '2024-02-16T08:00:00', actor: 'admin' }] },
        { id: '3', title: 'Trash Complaint', description: 'Uncollected trash', location: 'Residential Area', status: 'resolved', createdAt: '2023-12-01', type: 'Sanitation', subcategory: 'Trash Collection', urgency: 'Low', assignedUnit: 'sanitation', timeline: [{ action: 'Complaint submitted', date: '2023-12-01T14:00:00', actor: 'testuser' }, { action: 'Trash collected', date: '2023-12-02T12:00:00', actor: 'worker' }, { action: 'Complaint resolved', date: '2023-12-02T12:30:00', actor: 'admin' }] }
    ];
}

const ComplaintStatus = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    RESOLVED: 'resolved'
};

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

function getComplaintById(id) {
    const complaints = getComplaintsByUserId('testuser'); // Assuming complaints are user-specific
    return complaints.find(complaint => complaint.id === id);
}

const governmentUnitNames = {
    roads: 'Roads Department',
    police: 'Police Department',
    sanitation: 'Sanitation Department'
};

function showToast(message, type) {
    alert(message); // Replace with a proper toast notification
}