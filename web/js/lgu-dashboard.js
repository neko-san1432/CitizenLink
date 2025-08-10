document.addEventListener('DOMContentLoaded', () => {
  // Get user and complaints
  const user = checkAuth();
  if (!user) return;
  
  const complaints = getComplaints();
  
  // Update stats
  updateStats(complaints);
  
  // Initialize charts
  initializeCharts(complaints);
  
  // Load recent complaints
  loadRecentComplaints(complaints);
  
  // Setup tab switching
  setupTabs();
});

// Update dashboard stats
function updateStats(complaints) {
  const totalComplaints = complaints.length;
  const pendingComplaints = complaints.filter(c => c.status === 'pending').length;
  const inProgressComplaints = complaints.filter(c => c.status === 'in_progress').length;
  const resolvedComplaints = complaints.filter(c => c.status === 'resolved').length;
  
  // Update DOM elements
  document.getElementById('total-complaints').textContent = totalComplaints;
  document.getElementById('pending-complaints').textContent = pendingComplaints;
  document.getElementById('in-progress-complaints').textContent = inProgressComplaints;
  document.getElementById('resolved-complaints').textContent = resolvedComplaints;
  
  // Calculate and update response time
  const avgResponseTime = calculateAverageResponseTime(complaints);
  document.getElementById('avg-response-time').textContent = `${avgResponseTime} hours`;
  document.getElementById('response-time-progress').style.width = `${Math.min(100, (avgResponseTime / 24) * 100)}%`;
  
  // Calculate and update resolution rate
  const resolutionRate = totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0;
  document.getElementById('resolution-rate').textContent = `${resolutionRate}%`;
  document.getElementById('resolution-rate-progress').style.width = `${resolutionRate}%`;
}

// Calculate average response time
function calculateAverageResponseTime(complaints) {
  const responseTimes = complaints
      .filter(c => c.status !== 'pending')
      .map(c => {
          const created = new Date(c.createdAt);
          const updated = new Date(c.updatedAt || c.createdAt);
          return Math.round((updated - created) / (1000 * 60 * 60)); // Convert to hours
      });
  
  return responseTimes.length > 0 
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;
}

// Initialize charts
function initializeCharts(complaints) {
  // Complaint status chart
  const statusCtx = document.getElementById('complaints-chart').getContext('2d');
  const pendingCount = complaints.filter(c => c.status === 'pending').length;
  const inProgressCount = complaints.filter(c => c.status === 'in_progress').length;
  const resolvedCount = complaints.filter(c => c.status === 'resolved').length;
  
  new Chart(statusCtx, {
      type: 'doughnut',
      data: {
          labels: ['Pending', 'In Progress', 'Resolved'],
          datasets: [{
              data: [pendingCount, inProgressCount, resolvedCount],
              backgroundColor: ['#fbbf24', '#3b82f6', '#10b981']
          }]
      },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
              legend: {
                  position: 'bottom'
              }
          }
      }
  });
  
  // Complaint types chart
  const typesCtx = document.getElementById('complaint-types-chart').getContext('2d');
  const complaintTypes = {};
  complaints.forEach(complaint => {
      complaintTypes[complaint.type] = (complaintTypes[complaint.type] || 0) + 1;
  });
  
  new Chart(typesCtx, {
      type: 'bar',
      data: {
          labels: Object.keys(complaintTypes),
          datasets: [{
              label: 'Number of Complaints',
              data: Object.values(complaintTypes),
              backgroundColor: '#3b82f6'
          }]
      },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
              y: {
                  beginAtZero: true,
                  ticks: {
                      stepSize: 1
                  }
              }
          }
      }
  });
  
  // Department performance chart
  const deptCtx = document.getElementById('department-performance-chart').getContext('2d');
  const departmentStats = calculateDepartmentStats(complaints);
  
  new Chart(deptCtx, {
      type: 'bar',
      data: {
          labels: Object.keys(departmentStats),
          datasets: [{
              label: 'Resolution Rate (%)',
              data: Object.values(departmentStats),
              backgroundColor: '#10b981'
          }]
      },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
              y: {
                  beginAtZero: true,
                  max: 100,
                  ticks: {
                      callback: value => `${value}%`
                  }
              }
          }
      }
  });
}

// Calculate department statistics
function calculateDepartmentStats(complaints) {
  const stats = {};
  const departments = ['city_hall', 'police', 'fire', 'public_works', 'waste', 'health'];
  
  departments.forEach(dept => {
      const deptComplaints = complaints.filter(c => c.assignedUnit === dept);
      const resolved = deptComplaints.filter(c => c.status === 'resolved').length;
      stats[dept] = deptComplaints.length > 0 
          ? Math.round((resolved / deptComplaints.length) * 100)
          : 0;
  });
  
  return stats;
}

// Load recent complaints
function loadRecentComplaints(complaints) {
  // Sort complaints by date (newest first)
  const sortedComplaints = [...complaints].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
  );
  
  // Get the first 5 complaints
  const recentComplaints = sortedComplaints.slice(0, 5);
  
  // Load complaints into tabs
  loadComplaintsIntoTab('all-complaints-list', recentComplaints);
  loadComplaintsIntoTab('pending-complaints-list', recentComplaints.filter(c => c.status === 'pending'));
  loadComplaintsIntoTab('in-progress-complaints-list', recentComplaints.filter(c => c.status === 'in_progress'));
  loadComplaintsIntoTab('resolved-complaints-list', recentComplaints.filter(c => c.status === 'resolved'));
}

// Load complaints into a specific tab
function loadComplaintsIntoTab(tabId, complaints) {
  const tabElement = document.getElementById(tabId);
  if (!tabElement) return;
  
  // Clear existing content
  tabElement.innerHTML = '';
  
  if (complaints.length === 0) {
      // Show empty state
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `
          <i class="fas fa-file-alt"></i>
          <h3>No complaints found</h3>
          <p>There are no complaints in this category.</p>
      `;
      tabElement.appendChild(emptyState);
      return;
  }
  
  // Create complaint items
  complaints.forEach(complaint => {
      const complaintItem = document.createElement('div');
      complaintItem.className = 'complaint-item';
      
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
      
      complaintItem.innerHTML = `
          <div class="complaint-info">
              <div class="complaint-title">${complaint.title}</div>
              <div class="complaint-date">${formatDate(complaint.createdAt)}</div>
          </div>
          <div class="complaint-actions">
              <span class="status-badge ${statusClass}">${complaint.status}</span>
              <a href="complaints.html?id=${complaint.id}" class="btn btn-outline">
                  View Details
              </a>
          </div>
      `;
      
      tabElement.appendChild(complaintItem);
  });
}

// Setup tab switching
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
      button.addEventListener('click', () => {
          const tabName = button.getAttribute('data-tab');
          
          // Update active tab button
          tabButtons.forEach(btn => btn.classList.remove('active'));
          button.classList.add('active');
          
          // Show corresponding tab content
          tabContents.forEach(content => {
              content.classList.remove('active');
              if (content.id === `${tabName}-tab`) {
                  content.classList.add('active');
              }
          });
      });
  });
}