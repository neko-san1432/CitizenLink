document.addEventListener('DOMContentLoaded', () => {
  // Get user and complaints
  const user = checkAuth();
  if (!user) return;
  
  // Initialize charts
  initializeCharts();
  
  // Setup date range filter
  setupDateRangeFilter();
});

// Mock functions for demonstration purposes
function checkAuth() {
  // Replace with actual authentication check logic
  return { username: 'admin-user', type: 'lgu' };
}

// Initialize charts
function initializeCharts() {
  // Complaint trends chart
  const trendsCtx = document.getElementById('trends-chart').getContext('2d');
  
  new Chart(trendsCtx, {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [{
        label: 'Complaints',
        data: [65, 59, 80, 81, 56, 55, 40, 45, 60, 70, 85, 90],
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
  
  new Chart(resolutionTimeCtx, {
    type: 'bar',
    data: {
      labels: ['Public Works', 'Police', 'Fire', 'Waste Management', 'Health', 'City Hall'],
      datasets: [{
        label: 'Average Days to Resolve',
        data: [4.2, 2.5, 1.8, 3.7, 5.1, 6.3],
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
  
  new Chart(categoriesCtx, {
    type: 'pie',
    data: {
      labels: ['Infrastructure', 'Public Safety', 'Sanitation', 'Utilities', 'Noise', 'Other'],
      datasets: [{
        data: [35, 20, 25, 10, 8, 2],
        backgroundColor: [
          '#3b82f6', // Blue
          '#ef4444', // Red
          '#10b981', // Green
          '#f59e0b', // Amber
          '#8b5cf6', // Purple
          '#6b7280'  // Gray
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
  
  // Satisfaction chart
  const satisfactionCtx = document.getElementById('satisfaction-chart').getContext('2d');
  
  new Chart(satisfactionCtx, {
    type: 'radar',
    data: {
      labels: ['Infrastructure', 'Public Safety', 'Sanitation', 'Utilities', 'Noise', 'Other'],
      datasets: [{
        label: 'Citizen Satisfaction (out of 5)',
        data: [3.8, 4.2, 3.5, 3.2, 4.0, 3.9],
        fill: true,
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: '#3b82f6',
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#3b82f6'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          angleLines: {
            display: true
          },
          suggestedMin: 0,
          suggestedMax: 5
        }
      }
    }
  });
}

// Setup date range filter
function setupDateRangeFilter() {
  const dateRangeSelect = document.getElementById('date-range');
  
  dateRangeSelect.addEventListener('change', () => {
    const selectedRange = dateRangeSelect.value;
    
    // This would normally fetch data for the selected date range
    // For demo purposes, we'll just show a toast notification
    
    showToast(`Insights updated for date range: ${selectedRange}`);
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