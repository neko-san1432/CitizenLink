document.addEventListener('DOMContentLoaded', () => {
  // Get user and complaints
  const user = checkAuth();
  if (!user) return;
  
  const complaints = getComplaintsByUserId(user.username);
  
  // Initialize charts
  initializeCharts(complaints);
  
  // Setup date range filter
  setupDateRangeFilter(complaints);
});

// Mock functions for demonstration purposes
function checkAuth() {
  // Replace with actual authentication check logic
  return { username: 'citizen-user', name: 'John Citizen' };
}

function getComplaintsByUserId(userId) {
  // Replace with actual data fetching logic
  return [
    { id: 'CP001', title: 'Pothole on Main Street', type: 'infrastructure', status: 'resolved', createdAt: '2025-01-05T10:30:00', resolvedAt: '2025-01-15T09:45:00' },
    { id: 'CP002', title: 'Streetlight Out', type: 'infrastructure', status: 'in_progress', createdAt: '2025-01-10T18:45:00' },
    { id: 'CP003', title: 'Missed Garbage Collection', type: 'sanitation', status: 'resolved', createdAt: '2025-01-15T08:20:00', resolvedAt: '2025-01-16T14:30:00' },
    { id: 'CP004', title: 'Noise Complaint - Construction', type: 'noise', status: 'pending', createdAt: '2025-01-20T06:15:00' },
    { id: 'CP007', title: 'Illegal Dumping', type: 'sanitation', status: 'in_progress', createdAt: '2025-01-25T14:20:00' }
  ];
}

// Initialize charts
function initializeCharts(complaints) {
  // Complaint history chart
  const historyCtx = document.getElementById('history-chart').getContext('2d');
  
  // Group complaints by month
  const complaintsByMonth = {};
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Initialize all months with 0
  months.forEach(month => {
    complaintsByMonth[month] = 0;
  });
  
  // Count complaints by month
  complaints.forEach(complaint => {
    const date = new Date(complaint.createdAt);
    const month = months[date.getMonth()];
    complaintsByMonth[month]++;
  });
  
  new Chart(historyCtx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [{
        label: 'Complaints Submitted',
        data: months.map(month => complaintsByMonth[month]),
        fill: false,
        borderColor: '#3b82f6',
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
  
  // Resolution time chart
  const resolutionTimeCtx = document.getElementById('resolution-time-chart').getContext('2d');
  
  // Calculate average resolution time by type
  const resolutionTimeByType = {
    'infrastructure': 7.5,
    'sanitation': 2.3,
    'noise': 1.8,
    'utilities': 4.2,
    'public_safety': 3.1
  };
  
  new Chart(resolutionTimeCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(resolutionTimeByType).map(type => type.replace('_', ' ')),
      datasets: [{
        label: 'Average Days to Resolve',
        data: Object.values(resolutionTimeByType),
        backgroundColor: '#10b981'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Days'
          }
        }
      }
    }
  });
  
  // Categories chart
  const categoriesCtx = document.getElementById('categories-chart').getContext('2d');
  
  // Count complaints by type
  const complaintsByType = {};
  complaints.forEach(complaint => {
    if (!complaintsByType[complaint.type]) {
      complaintsByType[complaint.type] = 0;
    }
    complaintsByType[complaint.type]++;
  });
  
  new Chart(categoriesCtx, {
    type: 'pie',
    data: {
      labels: Object.keys(complaintsByType).map(type => type.replace('_', ' ')),
      datasets: [{
        data: Object.values(complaintsByType),
        backgroundColor: [
          '#3b82f6', // Blue
          '#ef4444', // Red
          '#10b981', // Green
          '#f59e0b', // Amber
          '#8b5cf6'  // Purple
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right'
        }
      }
    }
  });
  
  // Status chart
  const statusCtx = document.getElementById('status-chart').getContext('2d');
  
  // Count complaints by status
  const pendingCount = complaints.filter(c => c.status === 'pending').length;
  const inProgressCount = complaints.filter(c => c.status === 'in_progress').length;
  const resolvedCount = complaints.filter(c => c.status === 'resolved').length;
  
  new Chart(statusCtx, {
    type: 'doughnut',
    data: {
      labels: ['Pending', 'In Progress', 'Resolved'],
      datasets: [{
        data: [pendingCount, inProgressCount, resolvedCount],
        backgroundColor: [
          '#fbbf24', // Yellow
          '#3b82f6', // Blue
          '#10b981'  // Green
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right'
        }
      }
    }
  });
}

// Setup date range filter
function setupDateRangeFilter(complaints) {
  const dateRangeSelect = document.getElementById('date-range');
  
  dateRangeSelect.addEventListener('change', () => {
    const selectedRange = dateRangeSelect.value;
    
    // This would normally filter the data based on the selected date range
    // For demo purposes, we'll just show a toast notification
    
    showToast(`Analytics updated for date range: ${selectedRange}`);
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