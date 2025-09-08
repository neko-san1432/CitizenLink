document.addEventListener('DOMContentLoaded', async () => {
  // Get user and complaints scoped to LGU department
  const user = checkAuth();
  if (!user) return;

  // Update header with user's name
  updateHeaderWithUserName(user);

  const role = String(user.role || user.type || '').toLowerCase();
  const isLgu = role.startsWith('lgu-') || role.startsWith('lgu_admin') || role.startsWith('lgu-admin') || role === 'lgu' || role === 'admin';
  const deptFromRole = role.startsWith('lgu-admin-') ? role.replace('lgu-admin-', '')
                      : role.startsWith('lgu-') ? role.replace('lgu-', '')
                      : null;

  let complaints = [];
  try {
    // Fetch all complaints and filter by assigned_unit
    console.log('[LGU] Fetching all complaints from /api/complaints');
    const res = await fetch('/api/complaints');
    console.log('[LGU] /api/complaints status:', res.status);
    if (res.ok) {
      const response = await res.json();
      console.log('[LGU] /api/complaints response:', response);
      // Handle the response format: { complaints: [...], page, limit }
      let allComplaints = response.complaints || response.data || response;
      console.log('[LGU] /api/complaints count:', Array.isArray(allComplaints) ? allComplaints.length : 0);
      
      // Filter by assigned_unit if user has a department
      if (isLgu && deptFromRole && Array.isArray(allComplaints)) {
        console.log('[LGU] Filtering complaints by assigned_unit:', deptFromRole);
        const filteredComplaints = allComplaints.filter(complaint => 
          complaint.assigned_unit === deptFromRole
        );
        console.log('[LGU] Total complaints:', allComplaints.length);
        console.log('[LGU] Filtered complaints for department:', filteredComplaints.length);
        complaints = normalizeComplaints(filteredComplaints);
      } else {
        console.log('[LGU] First few complaints:', allComplaints.slice(0, 3));
        complaints = normalizeComplaints(allComplaints);
      }
    }
  } catch (error) {
    console.error('[LGU] Error fetching complaints:', error);
  }

  // Fallback to window.getComplaints if API fails
  if (!complaints.length) {
    console.log('[LGU] Falling back to window.getComplaints()');
    const complaintsRaw = await (window.getComplaints ? window.getComplaints() : []);
    console.log('[LGU] getComplaints count:', Array.isArray(complaintsRaw) ? complaintsRaw.length : 0);
    complaints = normalizeComplaints(complaintsRaw);
  }

  // Update stats
  updateStats(complaints);

  // Initialize charts
  await initializeCharts(complaints);

  // Load recent complaints
  loadRecentComplaints(complaints);

  // Setup tab switching
  setupTabs();

  // Setup refresh button
  setupRefreshButton();

  // Setup Add Article functionality
  setupAddArticle();

  // Setup Add Notice functionality
  setupAddNotice();

  // Setup Add Event functionality
  setupAddEvent();
});

// Normalize complaint records from database into consistent shape
function normalizeComplaints(records) {
  if (!Array.isArray(records)) return [];
  return records.map(r => ({
    // Preserve original
    ...r,
    // Normalized fields
    id: r.id,
    title: r.title || r.subject || 'Untitled',
    status: normalizeStatus(r.status),
    type: r.type || r.category || 'General',
    createdAt: r.createdAt || r.created_at,
    updatedAt: r.updatedAt || r.updated_at || r.resolved_at || r.closed_at || r.created_at,
    assignedUnit: r.assignedUnit || r.assigned_unit || r.department || null,
  }));
}

function normalizeStatus(status) {
  const s = (status || '').toString().toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
  if (s === 'inprogress') return 'in_progress';
  if (['pending', 'in_progress', 'resolved'].includes(s)) return s;
  // Default unknown statuses to pending for grouping
  return 'pending';
}

// Setup refresh button
function setupRefreshButton() {
  const refreshButton = document.getElementById('refresh-complaints');
  if (refreshButton) {
    refreshButton.addEventListener('click', async () => {
      // Debug log
      const refreshedRaw = await (window.getComplaints ? window.getComplaints() : []);
      const refreshedComplaints = normalizeComplaints(refreshedRaw);
      // Debug log
      
      // Update dashboard with refreshed data
      updateStats(refreshedComplaints);
      initializeCharts(refreshedComplaints);
      loadRecentComplaints(refreshedComplaints);
      
      // Show success message
      showToast('Complaints data refreshed successfully!', 'success');
    });
  }
}

// Safe no-op: Add Notice setup (UI not present yet)
function setupAddNotice() {
  const addNoticeBtn = document.getElementById('add-notice-btn');
  if (!addNoticeBtn) return; // No UI, exit quietly
  addNoticeBtn.addEventListener('click', () => {
    
    showToast('Add Notice UI not implemented yet.', 'info');
  });
}

// Safe no-op: Add Event setup (UI not present yet)
function setupAddEvent() {
  const addEventBtn = document.getElementById('add-event-btn');
  if (!addEventBtn) return; // No UI, exit quietly
  addEventBtn.addEventListener('click', () => {
    
    showToast('Add Event UI not implemented yet.', 'info');
  });
}

// Setup Add Article functionality
function setupAddArticle() {
  const addArticleBtn = document.getElementById('add-article-btn');
  const addArticleModal = document.getElementById('addArticleModal');
  const publishArticleBtn = document.getElementById('publish-article');
  const addArticleForm = document.getElementById('add-article-form');

  if (addArticleBtn) {
    addArticleBtn.addEventListener('click', () => {
      // Show the modal
      const modal = new bootstrap.Modal(addArticleModal);
      modal.show();
    });
  }

  if (publishArticleBtn) {
    publishArticleBtn.addEventListener('click', () => {
      publishArticle();
    });
  }

  // Auto-fill author field with current user
  const authorField = document.getElementById('article-author');
  if (authorField) {
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (user && user.name) {
      authorField.value = user.name;
    }
  }
}

// Publish new article
function publishArticle() {
  const title = document.getElementById('article-title').value;
  const category = document.getElementById('article-category').value;
  const excerpt = document.getElementById('article-excerpt').value;
  const content = document.getElementById('article-content').value;
  const author = document.getElementById('article-author').value;
  const readTime = document.getElementById('article-read-time').value || '5 min read';

  // Validate required fields
  if (!title || !category || !excerpt || !content || !author) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  // Create new article object
  const newArticle = {
    id: Date.now(), // Generate unique ID
    title: title,
    excerpt: excerpt,
    content: formatArticleContent(content, category),
    date: new Date().toISOString().split('T')[0],
    category: category,
    icon: getCategoryIcon(category),
    author: author,
    readTime: readTime
  };

  // Add to news data (you would typically save this to a database)
  addNewsArticle(newArticle);

  // Show success message
  showToast('Article published successfully!', 'success');

  // Close modal and reset form
  const modal = bootstrap.Modal.getInstance(document.getElementById('addArticleModal'));
  modal.hide();
  addArticleForm.reset();

  // Auto-fill author again
  const authorField = document.getElementById('article-author');
  if (authorField) {
    const user = JSON.parse(sessionStorage.getItem('user'));
    if (user && user.name) {
      authorField.value = user.name;
    }
  }
}

// Format article content for display
function formatArticleContent(content, category) {
  return `
    <div class="news-article">
      <div class="article-header mb-4">
        <div class="article-meta">
          <span class="badge bg-primary">${category}</span>
          <span class="text-muted ms-2">${new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</span>
        </div>
      </div>
      
      <p class="lead">${content.split('\n')[0]}</p>
      
      ${content.split('\n').slice(1).map(paragraph => 
        paragraph.trim() ? `<p>${paragraph}</p>` : ''
      ).join('')}
      
      <div class="article-footer mt-4 pt-3 border-top">
        <small class="text-muted">For more information, contact the ${category} Department</small>
      </div>
    </div>
  `;
}

// Get category icon
function getCategoryIcon(category) {
  const iconMap = {
    'Public Safety': 'fas fa-shield-alt',
    'Infrastructure': 'fas fa-road',
    'Environment': 'fas fa-leaf',
    'Health': 'fas fa-heartbeat',
    'Technology': 'fas fa-laptop',
    'Education': 'fas fa-graduation-cap'
  };
  return iconMap[category] || 'fas fa-newspaper';
}

// Add news article to data (mock function - replace with actual API call)
function addNewsArticle(article) {
  
  
  // In a real application, you would:
  // 1. Send this to your backend API
  // 2. Save to database
  // 3. Update the news feed
  
  // For now, we'll just log it and show a success message
  showToast(`Article "${article.title}" has been published!`, 'success');
}

// Update dashboard stats
function updateStats(complaints) {
  const totalComplaints = complaints.length;
  const pendingComplaints = complaints.filter(c => c.status === 'pending').length;
  const inProgressComplaints = complaints.filter(c => c.status === 'in_progress' || c.status === 'inprogress' || c.status === 'in-progress').length;
  const resolvedComplaints = complaints.filter(c => c.status === 'resolved').length;
  
  // Update DOM elements
  document.getElementById('total-complaints').textContent = totalComplaints;
  document.getElementById('pending-complaints').textContent = pendingComplaints;
  document.getElementById('in-progress-complaints').textContent = inProgressComplaints;
  document.getElementById('resolved-complaints').textContent = resolvedComplaints;
  
  // Calculate performance metrics for bar chart
  const avgResponseTime = calculateAverageResponseTime(complaints);
  const resolutionRate = totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0;
  const avgResolutionTime = calculateAverageResolutionTime(complaints);
  const responseRate = totalComplaints > 0 ? Math.round(((totalComplaints - pendingComplaints) / totalComplaints) * 100) : 0;
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

// Calculate average resolution time
function calculateAverageResolutionTime(complaints) {
  const resolutionTimes = complaints
      .filter(c => c.status === 'resolved')
      .map(c => {
          const created = new Date(c.createdAt);
          const updated = new Date(c.updatedAt || c.createdAt);
          return Math.round((updated - created) / (1000 * 60 * 60)); // Convert to hours
      });
  
  return resolutionTimes.length > 0 
      ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
      : 0;
}

// Initialize charts
async function initializeCharts(complaints) {
  // Complaint status chart
  const statusCtx = document.getElementById('complaints-chart').getContext('2d');
  const pendingCount = complaints.filter(c => c.status === 'pending').length;
  const inProgressCount = complaints.filter(c => c.status === 'in_progress' || c.status === 'inprogress' || c.status === 'in-progress').length;
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
                  position: 'bottom',
                  display: true,
                  labels: {
                      padding: 15,
                      usePointStyle: true,
                      font: {
                          size: 11
                      }
                  }
              }
          },
          layout: {
              padding: {
                  bottom: 30,
                  top: 10,
                  left: 10,
                  right: 10
              }
          }
      }
  });
  
  // Complaint types chart
  const typesCtx = document.getElementById('complaint-types-chart').getContext('2d');
  const complaintTypes = {};
  complaints.forEach(complaint => {
      const key = (complaint.type || 'General').toString();
      complaintTypes[key] = (complaintTypes[key] || 0) + 1;
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
  
  // Department performance chart - comparing all departments (use ALL complaints)
  const deptCtx = document.getElementById('department-performance-chart').getContext('2d');
  const allComplaintsForComparison = await fetchAllComplaintsForComparison();
  console.log('[LGU] All complaints for department comparison:', allComplaintsForComparison.length);
  console.log('[LGU] Sample complaint assigned_unit values:', allComplaintsForComparison.slice(0, 5).map(c => c.assigned_unit));
  const departmentStats = calculateDepartmentPerformanceStats(allComplaintsForComparison);
  console.log('[LGU] Department stats calculated:', departmentStats);
  
  new Chart(deptCtx, {
      type: 'bar',
      data: {
          labels: Object.keys(departmentStats),
          datasets: [
              {
                  label: 'Complaints Received',
                  data: Object.values(departmentStats).map(dept => dept.totalComplaints),
                  backgroundColor: '#8b5cf6',
                  yAxisID: 'y2'
              },
              {
                  label: 'Resolution Rate (%)',
                  data: Object.values(departmentStats).map(dept => dept.resolutionRate),
                  backgroundColor: '#10b981',
                  yAxisID: 'y'
              },
              {
                  label: 'Response Rate (%)',
                  data: Object.values(departmentStats).map(dept => dept.responseRate),
                  backgroundColor: '#3b82f6',
                  yAxisID: 'y'
              },
              {
                  label: 'Avg Response Time (hrs)',
                  data: Object.values(departmentStats).map(dept => dept.avgResponseTime),
                  backgroundColor: '#f59e0b',
                  yAxisID: 'y1'
              },
              {
                  label: 'Avg Resolution Time (hrs)',
                  data: Object.values(departmentStats).map(dept => dept.avgResolutionTime),
                  backgroundColor: '#ef4444',
                  yAxisID: 'y1'
              }
          ]
      },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
              y: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  beginAtZero: true,
                  max: 100,
                  ticks: {
                      callback: value => `${value}%`
                  },
                  title: {
                      display: true,
                      text: 'Percentage (%)'
                  }
              },
              y1: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  beginAtZero: true,
                  ticks: {
                      callback: value => `${value} hrs`
                  },
                  title: {
                      display: true,
                      text: 'Time (hours)'
                  },
                  grid: {
                      drawOnChartArea: false,
                  },
              },
              y2: {
                  type: 'linear',
                  display: false,
                  beginAtZero: true,
                  ticks: {
                      callback: value => `${value}`
                  }
              }
          },
          plugins: {
              legend: {
                  position: 'top'
              }
          }
      }
  });

  // Performance metrics bar chart
  const performanceCtx = document.getElementById('performance-metrics-chart').getContext('2d');
  const avgResponseTime = calculateAverageResponseTime(complaints);
  const resolutionRate = complaints.length > 0 ? Math.round((complaints.filter(c => c.status === 'resolved').length / complaints.length) * 100) : 0;
  const avgResolutionTime = calculateAverageResolutionTime(complaints);
  const responseRate = complaints.length > 0 ? Math.round(((complaints.length - complaints.filter(c => c.status === 'pending').length) / complaints.length) * 100) : 0;
  
  new Chart(performanceCtx, {
      type: 'bar',
      data: {
          labels: ['Response Rate (%)', 'Resolution Rate (%)', 'Avg Response Time (hrs)', 'Avg Resolution Time (hrs)'],
          datasets: [{
              label: 'Performance Metrics',
              data: [responseRate, resolutionRate, avgResponseTime, avgResolutionTime],
              backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
          }]
      },
      options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
              y: {
                  beginAtZero: true,
                  ticks: {
                      callback: function(value, index, values) {
                          // For percentage metrics, add % symbol
                          if (index < 2) {
                              return value + '%';
                          }
                          // For time metrics, add hours
                          return value + ' hrs';
                      }
                  }
              }
          },
          plugins: {
              legend: {
                  display: false
              }
          },
          layout: {
              padding: {
                  bottom: 30,
                  top: 10,
                  left: 10,
                  right: 10
              }
          }
      }
  });
}

// Fetch all complaints for department performance comparison
async function fetchAllComplaintsForComparison() {
  try {
    console.log('[LGU] Fetching ALL complaints for department comparison');
    const res = await fetch('/api/complaints');
    if (res.ok) {
      const response = await res.json();
      const allComplaints = response.complaints || response.data || response;
      console.log('[LGU] All complaints for comparison:', allComplaints.length);
      console.log('[LGU] First few complaints structure:', allComplaints.slice(0, 2));
      
      // Don't normalize - use raw data to preserve all fields
      return allComplaints;
    }
  } catch (error) {
    console.error('[LGU] Error fetching all complaints for comparison:', error);
  }
  return [];
}

// Calculate department performance statistics
function calculateDepartmentPerformanceStats(complaints) {
  const stats = {};
  // Define all LGU departments (including those with 0 complaints)
  const allLguDepartments = ['wst', 'bfp', 'pnp', 'health', 'public_works', 'traffic', 'environment'];
  console.log('[LGU] Calculating department stats for', complaints.length, 'complaints');
  console.log('[LGU] All LGU departments:', allLguDepartments);
  
  allLguDepartments.forEach(dept => {
      const deptComplaints = complaints.filter(c => c.assigned_unit === dept);
      console.log(`[LGU] ${dept.toUpperCase()} department complaints:`, deptComplaints.length);
      
      if (deptComplaints.length > 0) {
          const resolved = deptComplaints.filter(c => c.status === 'resolved').length;
          const responded = deptComplaints.filter(c => c.status !== 'pending').length;
          
          // Calculate resolution rate
          const resolutionRate = Math.round((resolved / deptComplaints.length) * 100);
          
          // Calculate response rate
          const responseRate = Math.round((responded / deptComplaints.length) * 100);
          
          // Calculate average response time
          const responseTimes = deptComplaints
              .filter(c => c.status !== 'pending')
              .map(c => {
                  const created = new Date(c.created_at);
                  const updated = new Date(c.updated_at || c.created_at);
                  return Math.round((updated - created) / (1000 * 60 * 60));
              });
          const avgResponseTime = responseTimes.length > 0 
              ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
              : 0;
          
          // Calculate average resolution time
          const resolutionTimes = deptComplaints
              .filter(c => c.status === 'resolved')
              .map(c => {
                  const created = new Date(c.created_at);
                  const updated = new Date(c.updated_at || c.created_at);
                  return Math.round((updated - created) / (1000 * 60 * 60));
              });
          const avgResolutionTime = resolutionTimes.length > 0 
              ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
              : 0;
          
          stats[dept.toUpperCase()] = {
              resolutionRate,
              responseRate,
              avgResponseTime,
              avgResolutionTime,
              totalComplaints: deptComplaints.length
          };
      } else {
          stats[dept.toUpperCase()] = {
              resolutionRate: 0,
              responseRate: 0,
              avgResponseTime: 0,
              avgResolutionTime: 0,
              totalComplaints: 0
          };
      }
  });
  
  return stats;
}

// Load recent complaints
function loadRecentComplaints(complaints) {
  // Sort complaints by date (newest first)
  const sortedComplaints = [...complaints].sort((a, b) => 
      new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)
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

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
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

// Show toast message
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
}
