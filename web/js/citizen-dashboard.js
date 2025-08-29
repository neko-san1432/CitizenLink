console.log('📁 citizen-dashboard.js file loaded');

// Enable debug logging for troubleshooting
if (typeof window.enableDebugLogging === 'function') {
  window.enableDebugLogging();
  console.log('🔧 Debug logging enabled');
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 DOMContentLoaded event fired');
  
  try {
    // Initialize user data using shared utilities
    console.log('📋 Initializing user data...');
    const user = await window.userUtils.initializeUserData();
    console.log('👤 User data:', user);
    
    if (!user) {
      console.log('❌ No user data available, exiting');
      return;
    }
    
    console.log('✅ User data initialized successfully');
    
    // Update dashboard with user-specific data
    console.log('🔄 Updating dashboard with user data...');
    updateDashboardWithUserData(user);
    
    // Setup other dashboard functionality
    console.log('⚙️ Setting up dashboard functionality...');
    await setupDashboard();
    console.log('✅ Dashboard setup completed');
    
  } catch (error) {
    console.error('💥 Error in DOMContentLoaded:', error);
  }
});

// Update dashboard with user-specific data
function updateDashboardWithUserData(user) {
  // Update welcome message
  const welcomeElement = document.querySelector('.welcome-text');
  if (welcomeElement) {
    welcomeElement.innerHTML = `Welcome, <span id="header-user-name">${user.name}</span>`;
  }
  
  // Update page title or other user-specific elements
  const pageTitle = document.querySelector('.page-header h1');
  if (pageTitle) {
    pageTitle.textContent = `Welcome back, ${user.name}!`;
  }
  

}

// Setup dashboard functionality
async function setupDashboard() {
  try {
    // Get user data
    const user = await window.userUtils.initializeUserData();
    if (!user) return;
    
    // Check database setup first
    const dbResults = await checkDatabaseSetup();
    
    // Load user-specific data with better error handling
    try {
      await loadRecentComplaints(user);
    } catch (error) {
      // Error loading complaints
    }
    
    try {
      await loadNews();
    } catch (error) {
      // Error loading news
    }
    
    try {
      await loadCommunityUpdates();
    } catch (error) {
      // Error loading community updates
    }
    
    try {
      await loadImportantNotices();
    } catch (error) {
      // Error loading important notices
    }
    
    // Setup refresh button
    setupRefreshButton();
    
    // Setup retry buttons
    setupRetryButtons();
    
  } catch (error) {
    // Critical error in dashboard setup
  }
}

// Check if required database tables exist and are accessible
async function checkDatabaseSetup() {
  try {
    const supabase = await window.supabaseManager.initialize();
    
    // Test each table individually
    const tableTests = [
      { name: 'news_data', test: () => supabase.from('news_data').select('id').limit(1) },
      { name: 'upcoming_events_data', test: () => supabase.from('upcoming_events_data').select('id').limit(1) },
      { name: 'important_notice_data', test: () => supabase.from('important_notice_data').select('id').limit(1) }
    ];
    
    const results = {};
    
    for (const tableTest of tableTests) {
      try {
        const { data, error } = await tableTest.test();
        if (error) {
          results[tableTest.name] = { accessible: false, error: error.message, code: error.code };
        } else {
          results[tableTest.name] = { accessible: true, count: data?.length || 0 };
        }
      } catch (err) {
        results[tableTest.name] = { accessible: false, error: err.message };
      }
    }
    
    // Check summary
    const accessibleTables = Object.values(results).filter(r => r.accessible).length;
    const totalTables = tableTests.length;
    
    if (accessibleTables === 0) {
      showDatabaseSetupWarning();
    } else if (accessibleTables < totalTables) {
      // Some tables not accessible
    }
    
    return results;
    
  } catch (error) {
    showDatabaseSetupWarning();
    return null;
  }
}

// Show warning about database setup
function showDatabaseSetupWarning() {
  // Create a warning banner at the top of the dashboard
  const dashboardMain = document.querySelector('.dashboard-main');
  if (!dashboardMain) return;
  
  // Check if warning already exists
  if (document.getElementById('db-setup-warning')) return;
  
  const warningBanner = document.createElement('div');
  warningBanner.id = 'db-setup-warning';
  warningBanner.className = 'alert alert-warning alert-dismissible fade show';
  warningBanner.style.cssText = 'margin-bottom: 1rem;';
  warningBanner.innerHTML = `
    <i class="fas fa-exclamation-triangle me-2"></i>
    <strong>Database Setup Required:</strong> Some data tables are not accessible. 
    The dashboard is showing sample data. 
    <a href="SUPABASE_PERMISSIONS_FIX.md" target="_blank" class="alert-link">Click here for setup instructions</a>.
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  // Insert at the beginning of dashboard main
  dashboardMain.insertBefore(warningBanner, dashboardMain.firstChild);
  
  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (warningBanner.parentNode) {
      warningBanner.remove();
    }
  }, 10000);
}

// Setup retry buttons for events and notices
function setupRetryButtons() {
  const retryEventsBtn = document.getElementById('retry-events');
  const retryNoticesBtn = document.getElementById('retry-notices');
  
  if (retryEventsBtn) {
    retryEventsBtn.addEventListener('click', async () => {

      retryEventsBtn.style.display = 'none';
      await loadCommunityUpdates();
    });
  }
  
  if (retryNoticesBtn) {
    retryNoticesBtn.addEventListener('click', async () => {

      retryNoticesBtn.style.display = 'none';
      await loadImportantNotices();
    });
  }
}

// Setup refresh button functionality
function setupRefreshButton() {
  const refreshButton = document.getElementById('refresh-complaints');
  if (refreshButton) {
    refreshButton.addEventListener('click', async () => {
      try {
        // Get user data
        const user = await window.userUtils.initializeUserData();
        if (!user) {
          return;
        }
        
        // Show loading state
        refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        refreshButton.disabled = true;
        
        // Reload all data
        await loadRecentComplaints(user);
        await loadNews();
        await loadCommunityUpdates();
        await loadImportantNotices();
        
        // Show success message
        showToast('All data refreshed successfully!', 'success');
        
      } catch (error) {
        showToast('Error refreshing data. Please try again.', 'error');
      } finally {
        // Reset button state
        refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh All';
        refreshButton.disabled = false;
      }
    });
    
  }
}

// Show refresh message
function showRefreshMessage() {
  const refreshButton = document.getElementById('refresh-complaints');
  if (refreshButton) {
    const originalText = refreshButton.innerHTML;
    refreshButton.innerHTML = '<i class="fas fa-check"></i> Refreshed';
    refreshButton.classList.add('btn-success');
    refreshButton.classList.remove('btn-outline-secondary');
    
    setTimeout(() => {
      refreshButton.innerHTML = originalText;
      refreshButton.classList.remove('btn-success');
      refreshButton.classList.add('btn-outline-secondary');
    }, 2000);
  }
}

// Load recent complaints for the citizen
async function loadRecentComplaints(user) {
  const complaintsGrid = document.getElementById('recent-complaints-grid');
  if (!complaintsGrid) {
    console.log('❌ complaintsGrid element not found');
    return;
  }
  
  try {
    console.log('🔍 Starting loadRecentComplaints for user:', user);
    
    // Get complaints for this user from Supabase
    let userComplaints = [];
    
    if (typeof window.getComplaints !== 'function') {
      console.log('❌ getComplaints function not available');
      return;
    }
    
    const allComplaints = await window.getComplaints();
    console.log('📋 All complaints from database:', allComplaints);
    
    // Debug: Show the structure of the first complaint
    if (allComplaints && allComplaints.length > 0) {
      console.log('🔍 First complaint structure:', Object.keys(allComplaints[0]));
      console.log('🔍 First complaint data:', allComplaints[0]);
    }
    
    // Filter by user ID - try different user ID fields
    const userId = user.id || user.user_id || user.username;
    console.log('👤 Current user ID:', userId);
    
    if (allComplaints && allComplaints.length > 0) {
      // Try different field names for user identification
      userComplaints = allComplaints.filter(complaint => {
        const complaintUserId = complaint.user_id || complaint.userId || complaint.user_id;
        const matches = complaintUserId === userId;
        console.log(`🔍 Complaint ${complaint.id}: complaintUserId=${complaintUserId}, userId=${userId}, matches=${matches}`);
        return matches;
      });
      
      console.log('✅ Filtered complaints for current user:', userComplaints);
    }
    
    // TEMPORARY: For debugging, show all complaints if user is citizen
    if (user.role === 'citizen' && allComplaints && allComplaints.length > 0) {
      console.log('🔧 TEMPORARY: Showing all complaints for citizen user');
      userComplaints = allComplaints;
    }
    
    // Sort by date (newest first) and take the first 3
    const recentComplaints = userComplaints
      .sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt))
      .slice(0, 3);
    
    console.log('📅 Recent complaints (sorted):', recentComplaints);
    
    // Clear existing content
    complaintsGrid.innerHTML = '';
    
    if (recentComplaints.length === 0) {
      console.log('📭 No complaints to display, showing empty state');
      // Show empty state
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-complaints-state';
      emptyState.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-file-alt fa-3x text-muted mb-3"></i>
          <h5 class="text-muted">No complaints yet</h5>
          <p class="text-muted mb-3">You haven't submitted any complaints yet.</p>
          <a href="/submit-complaint" class="btn btn-primary">
            <i class="fas fa-plus"></i>
            Submit Your First Complaint
          </a>
        </div>
      `;
      complaintsGrid.appendChild(emptyState);
      return;
    }
    
    console.log('🎴 Creating complaint cards for:', recentComplaints.length, 'complaints');
    
    // Create complaint cards
    recentComplaints.forEach((complaint, index) => {
      const complaintCard = createComplaintCard(complaint);
      complaintsGrid.appendChild(complaintCard);
    });
    
    // Add "View All" link if there are more complaints
    if (userComplaints.length > 3) {
      const viewAllLink = document.createElement('div');
      viewAllLink.className = 'text-center mt-3';
      viewAllLink.innerHTML = `
        <a href="/complaints" class="btn btn-outline-primary">
          <i class="fas fa-list"></i>
          View All ${userComplaints.length} Complaints
        </a>
      `;
      complaintsGrid.appendChild(viewAllLink);
    }
    
  } catch (error) {
    console.error('💥 Error in loadRecentComplaints:', error);
    
    // Show error state
    const errorState = document.createElement('div');
    errorState.className = 'error-complaints-state';
    errorState.innerHTML = `
      <div class="text-center py-4">
        <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
        <h5 class="text-warning">Error loading complaints</h5>
        <p class="text-muted mb-3">Unable to load your complaints. Please try again later.</p>
        <button class="btn btn-sm btn-outline-warning" onclick="loadRecentComplaints(window.userUtils.initializeUserData())">
          <i class="fas fa-redo"></i>
          Retry
        </button>
      </div>
    `;
    complaintsGrid.innerHTML = '';
    complaintsGrid.appendChild(errorState);
  }
}

// Create a complaint card element
function createComplaintCard(complaint) {
  const card = document.createElement('div');
  card.className = 'complaint-card';
  
  // Handle missing status field - default to pending
  let statusClass = 'status-pending';
  let statusText = 'Pending';
  if (complaint.status) {
    switch (complaint.status) {
      case 'pending':
        statusClass = 'status-pending';
        statusText = 'Pending';
        break;
      case 'in_progress':
        statusClass = 'status-in-progress';
        statusText = 'In Progress';
        break;
      case 'resolved':
        statusClass = 'status-resolved';
        statusText = 'Resolved';
        break;
      default:
        statusClass = 'status-pending';
        statusText = 'Pending';
    }
  }
  
  // Handle missing date field - use current date if not available
  const dateField = complaint.created_at || complaint.createdAt;
  const formattedDate = dateField ? formatDate(dateField) : 'Date not specified';
  
  // Handle missing location field - use subcategory as fallback
  const location = complaint.location || complaint.subcategory || 'Location not specified';
  
  // Handle type field - use subcategory as fallback if type is missing
  const type = complaint.type || complaint.subcategory || 'General';
  
  // Handle missing title - use a default
  const title = complaint.title || 'Untitled Complaint';
  
  card.innerHTML = `
    <div class="complaint-header">
      <div class="complaint-title">${title}</div>
      <span class="status-badge ${statusClass}">${statusText}</span>
    </div>
    <div class="complaint-details">
      <div class="complaint-location">
        <i class="fas fa-map-marker-alt"></i>
        ${location}
      </div>
      <div class="complaint-date">
        <i class="fas fa-calendar"></i>
        ${formattedDate}
      </div>
      <div class="complaint-type">
        <i class="fas fa-tag"></i>
        ${type}
      </div>
      ${complaint.user_name ? `
        <div class="complaint-user">
          <i class="fas fa-user"></i>
          ${complaint.user_name}
        </div>
      ` : ''}
    </div>
  `;
  
  return card;
}

// Load news content
async function loadNews() {
  console.log('📰 loadNews function called');
  
  const newsGrid = document.getElementById('news-grid');
  if (!newsGrid) {
    console.error('❌ News grid element not found');
    return;
  }
  
  console.log('✅ News grid element found');
  
  try {
    console.log('🔍 Checking getNews function availability...');
    if (typeof window.getNews !== 'function') {
      console.error('❌ getNews function not available on window object');
      return;
    }
    
    console.log('✅ getNews function available');
    
    
    // Get live news data from Supabase
    const newsData = await window.getNews();
    // Removed console.log
    
    // Clear existing content
    newsGrid.innerHTML = '';
    
    if (!newsData || newsData.length === 0) {
      // Removed console.log
      // Show "No data available yet" message
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-news-state';
      emptyState.innerHTML = `
        <div class="text-center py-4">
          <i class="fas fa-newspaper fa-3x text-muted mb-3"></i>
          <h5 class="text-muted">No news available yet</h5>
          <p class="text-muted mb-3">There are no news articles published at the moment.</p>
        </div>
      `;
      newsGrid.appendChild(emptyState);
      return;
    }
    
    // Removed console.log
    // Create news cards
    newsData.forEach((news, index) => {
      // Removed console.log
      const newsCard = createNewsCard(news);
      newsGrid.appendChild(newsCard);
    });
    
    // Removed console.log
  } catch (error) {
    console.error('❌ Error loading news:', error);
    
    // Show error state
    const errorState = document.createElement('div');
    errorState.className = 'error-news-state';
    errorState.innerHTML = `
      <div class="text-center py-4">
        <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3"></i>
        <h5 class="text-warning">Error loading news</h5>
        <p class="text-muted mb-3">Unable to load news articles. Please try again later.</p>
        <button class="btn btn-sm btn-outline-warning" onclick="loadNews()">
          <i class="fas fa-redo"></i>
          Retry
        </button>
      </div>
    `;
    newsGrid.innerHTML = '';
    newsGrid.appendChild(errorState);
  }
}

// Load community updates (events) from Supabase
async function loadCommunityUpdates() {
  
  try {
    // Show loading state
    showCommunityUpdatesLoading();
    
    // Check if the function is available
    // Removed console.log
    if (!window.getUpcomingEvents) {
      console.error('❌ getUpcomingEvents function not available');
      showCommunityUpdatesError('Function not available');
      return;
    }
    
    
    // Get upcoming events from Supabase
    const eventsData = await window.getUpcomingEvents();
    // Removed console.log
    
    // Find the community updates section using the CSS class
    const communityUpdatesSection = document.querySelector('.community-updates-section');
    if (!communityUpdatesSection) {
      console.error('❌ Community updates section not found');
      return;
    }
    
    // Removed console.log
    await updateCommunityUpdatesContent(communityUpdatesSection, eventsData);
    // Removed console.log
  } catch (error) {
    console.error('❌ Error loading community updates:', error);
    
    // Check if it's a permission error
    if (error.code === '42501' || error.message?.includes('permission denied')) {
      // Removed console.log
      await showFallbackCommunityUpdates();
    } else {
      // Show error state in the community updates section
      // Removed console.log
      showCommunityUpdatesError('Error loading events');
    }
  }
}

// Load important notices from Supabase
async function loadImportantNotices() {
  
  try {
    // Show loading state
    showImportantNoticesLoading();
    
    // Check if the function is available
    // Removed console.log
    if (!window.getActiveNotices) {
      console.error('❌ getActiveNotices function not available');
      showImportantNoticesError('Function not available');
      return;
    }
    
    
    // Get active notices from Supabase
    const noticesData = await window.getActiveNotices();
    // Removed console.log
    
    // Find the important notices section using the CSS class
    const importantNoticesSection = document.querySelector('.important-notices-section');
    if (!importantNoticesSection) {
      console.error('❌ Important notices section not found');
      return;
    }
    
    // Removed console.log
    await updateImportantNoticesContent(importantNoticesSection, noticesData);
    // Removed console.log
  } catch (error) {
    console.error('❌ Error loading important notices:', error);
    
    // Check if it's a permission error
    if (error.code === '42501' || error.message?.includes('permission denied')) {
      // Removed console.log
      await showFallbackImportantNotices();
    } else {
      // Show error state in the important notices section
      // Removed console.log
      showImportantNoticesError('Error loading notices');
    }
  }
}

// Update community updates content with data from Supabase
async function updateCommunityUpdatesContent(container, eventsData) {
  // Removed console.log
  
  // Find the upcoming events list
  const eventsList = container.querySelector('ul');
  if (!eventsList) {
    console.error('❌ Events list not found in community updates section');
    return;
  }
  
  // Removed console.log
  // Clear existing events
  eventsList.innerHTML = '';
  
  if (!eventsData || eventsData.length === 0) {
    // Removed console.log
    // Show empty state
    const emptyState = document.createElement('li');
    emptyState.style.cssText = 'margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #f3f4f6;';
    emptyState.innerHTML = `
      <div class="text-center py-2">
        <i class="fas fa-calendar-alt text-muted"></i>
        <p class="text-muted mb-0">No upcoming events scheduled</p>
      </div>
    `;
    eventsList.appendChild(emptyState);
    return;
  }
  
  // Removed console.log
  
  // Filter again to ensure no past events sneak in and tag today's events as happening now
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const upcomingEvents = (eventsData || [])
    .filter(e => {
      const d = new Date(e.event_date);
      return d >= startOfToday; // hide past events
    })
    .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
    .slice(0, 5); // show up to 5
  
  // Removed console.log
  
  if (upcomingEvents.length === 0) {
    // Removed console.log
    const emptyState = document.createElement('li');
    emptyState.style.cssText = 'margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid #f3f4f6;';
    emptyState.innerHTML = `
      <div class="text-center py-2">
        <i class="fas fa-calendar-alt text-muted"></i>
        <p class="text-muted mb-0">No upcoming events scheduled</p>
      </div>
    `;
    eventsList.appendChild(emptyState);
    return;
  }
  
  // Removed console.log
  
  // Create event list items
  upcomingEvents.forEach((event, index) => {
    // Removed console.log
    
    const eventItem = document.createElement('li');
    const isLast = index === upcomingEvents.length - 1;
    
    eventItem.style.cssText = `
      margin-bottom: ${isLast ? '0' : '1rem'}; 
      padding-bottom: ${isLast ? '0' : '1rem'}; 
      border-bottom: ${isLast ? 'none' : '1px solid #f3f4f6'};
    `;
    
    const eventDate = new Date(event.event_date);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const eventTime = event.event_time || 'Time TBD';
    const isToday = eventDate >= startOfToday && eventDate <= endOfToday;
    
    eventItem.innerHTML = `
      <strong style="color: #111827; display: block; margin-bottom: 0.25rem;">${event.title || 'Untitled Event'} ${isToday ? '<span style=\"color:#059669; font-size:0.875rem; margin-left:0.5rem;\">• Happening now</span>' : ''}</strong>
      <small style="color: #6b7280;">${formattedDate} at ${eventTime}</small>
      ${event.description ? `<br><small style="color: #6b7280;">${event.description}</small>` : ''}
    `;
    
    eventsList.appendChild(eventItem);
    // Removed console.log
  });
  
  // Removed console.log
}

// Update important notices content with data from Supabase
async function updateImportantNoticesContent(container, noticesData) {
  // Removed console.log
  
  // Find the notices container (the second direct child div after the header)
  const noticesContainer = container.querySelector(':scope > div:nth-of-type(2)') || container.querySelectorAll('div')[1];
  if (!noticesContainer) {
    console.error('❌ Notices container not found in important notices section');
    return;
  }
  
  // Removed console.log
  // Clear existing notices
  noticesContainer.innerHTML = '';
  
  if (!noticesData || noticesData.length === 0) {
    // Removed console.log
    // Show empty state
    const emptyState = document.createElement('div');
    emptyState.style.cssText = 'padding: 1rem; border-radius: 0.5rem; background-color: #f9fafb; border: 1px solid #d1d5db; color: #6b7280; text-align: center;';
    emptyState.innerHTML = `
      <i class="fas fa-info-circle"></i>
      <p class="mb-0">No important notices at this time</p>
    `;
    noticesContainer.appendChild(emptyState);
    return;
  }
  
  // Removed console.log
  
  // Sort notices by priority and take the first 4 (increased from 2)
  const priorityNotices = noticesData
    .sort((a, b) => {
      const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      const aPriority = priorityOrder[a.priority] || 0;
      const bPriority = priorityOrder[b.priority] || 0;
      const result = bPriority - aPriority;
      
      return result;
    })
    .slice(0, 4); // Increased from 2 to 4
  
  // Removed console.log
  
  if (priorityNotices.length === 0) {
    // Removed console.log
    const emptyState = document.createElement('div');
    emptyState.style.cssText = 'padding: 1rem; border-radius: 0.5rem; background-color: #f9fafb; border: 1px solid #d1d5db; color: #6b7280; text-align: center;';
    emptyState.innerHTML = `
      <i class="fas fa-info-circle"></i>
      <p class="mb-0">No important notices at this time</p>
    `;
    noticesContainer.appendChild(emptyState);
    return;
  }
  
  // Removed console.log
  
  // Create notice items
  priorityNotices.forEach((notice, index) => {
    // Removed console.log
    
    const noticeItem = document.createElement('div');
    const isLast = index === priorityNotices.length - 1;
    
    // Get priority-based styling
    const { backgroundColor, borderColor, textColor } = getNoticePriorityColors(notice.priority);
    
    noticeItem.style.cssText = `
      padding: 1rem; 
      border-radius: 0.5rem; 
      margin-bottom: ${isLast ? '0' : '1rem'}; 
      background-color: ${backgroundColor}; 
      border: 1px solid ${borderColor}; 
      color: ${textColor};
    `;
    
    noticeItem.innerHTML = `
      <strong>${notice.title || 'Untitled Notice'}</strong><br>
      ${notice.content || 'No content available'}
      ${notice.contact_info ? `<br><small>Contact: ${notice.contact_info}</small>` : ''}
    `;
    
    noticesContainer.appendChild(noticeItem);
    // Removed console.log
  });
  
  // Removed console.log
}

// Get priority-based colors for notices
function getNoticePriorityColors(priority) {
  switch (priority) {
    case 'critical':
      return {
        backgroundColor: '#fef2f2',
        borderColor: '#dc2626',
        textColor: '#991b1b'
      };
    case 'high':
      return {
        backgroundColor: '#fef3c7',
        borderColor: '#f59e0b',
        textColor: '#92400e'
      };
    case 'medium':
      return {
        backgroundColor: '#e0f2fe',
        borderColor: '#0284c7',
        textColor: '#0c4a6e'
      };
    case 'low':
    default:
      return {
        backgroundColor: '#f0f9ff',
        borderColor: '#0ea5e9',
        textColor: '#0c4a6e'
      };
  }
}

// Show loading state for community updates
function showCommunityUpdatesLoading() {
  const communitySection = document.querySelector('.community-updates-section');
  if (communitySection) {
    const eventsList = communitySection.querySelector('ul');
    if (eventsList) {
      eventsList.innerHTML = `
        <li style="margin-bottom: 0; padding-bottom: 0; border-bottom: none;">
          <div class="text-center py-2">
            <i class="fas fa-spinner fa-spin text-primary"></i>
            <p class="text-primary mb-0">Loading events...</p>
          </div>
        </li>
      `;
    }
  }
}

// Show loading state for important notices
function showImportantNoticesLoading() {
  const section = document.querySelector('.important-notices-section');
  if (section) {
    const noticesDiv = section.querySelector(':scope > div:nth-of-type(2)') || section.querySelectorAll('div')[1];
    if (noticesDiv) {
      noticesDiv.innerHTML = `
        <div style="padding: 1rem; border-radius: 0.5rem; background-color: #f0f9ff; border: 1px solid #0ea5e9; color: #0c4a6e; text-align: center;">
          <i class="fas fa-spinner fa-spin"></i>
          <p class="mb-0">Loading notices...</p>
        </div>
      `;
    }
  }
}

// Show error state for community updates
function showCommunityUpdatesError(message = 'Unable to load events') {
  const communitySection = document.querySelector('.community-updates-section');
  if (communitySection) {
    const eventsList = communitySection.querySelector('ul');
    if (eventsList) {
      eventsList.innerHTML = `
        <li style="margin-bottom: 0; padding-bottom: 0; border-bottom: none;">
          <div class="text-center py-2">
            <i class="fas fa-exclamation-triangle text-warning"></i>
            <p class="text-warning mb-0">${message}</p>
            <button class="btn btn-sm btn-outline-warning mt-2" onclick="retryDataLoad(loadCommunityUpdates)">
              <i class="fas fa-redo"></i>
              Retry
            </button>
          </div>
        </li>
      `;
    }
  }
  
  // Show retry button in header
  const retryEventsBtn = document.getElementById('retry-events');
  if (retryEventsBtn) {
    retryEventsBtn.style.display = 'block';
  }
}

// Show error state for important notices
function showImportantNoticesError(message = 'Unable to load notices') {
  const section = document.querySelector('.important-notices-section');
  if (section) {
    const noticesDiv = section.querySelector(':scope > div:nth-of-type(2)') || section.querySelectorAll('div')[1];
    if (noticesDiv) {
      noticesDiv.innerHTML = `
        <div style="padding: 1rem; border-radius: 0.5rem; background-color: #fef2f2; border: 1px solid #dc2626; color: #991b1b; text-align: center;">
          <i class="fas fa-exclamation-triangle"></i>
          <p class="mb-0">${message}</p>
          <button class="btn btn-sm btn-outline-danger mt-2" onclick="retryDataLoad(loadImportantNotices)">
            <i class="fas fa-redo"></i>
            Retry
          </button>
        </div>
      `;
    }
  }
  
  // Show retry button in header
  const retryNoticesBtn = document.getElementById('retry-notices');
  if (retryNoticesBtn) {
    retryNoticesBtn.style.display = 'block';
  }
}

// Create a news card element
function createNewsCard(news) {
  console.log('🎴 createNewsCard called with news:', news);
  
  const card = document.createElement('div');
  card.className = 'news-card';
  
  // Handle different date field names and format date
  const dateField = news.date || news.created_at || news.published_at;
  const formattedDate = dateField ? formatDate(dateField) : 'No date';
  
  // Handle different category field names
  const category = news.category || 'General';
  
  // Handle different icon field names
  const icon = news.icon || 'fas fa-newspaper';
  
  card.innerHTML = `
    <div class="news-image">
      <i class="${icon}"></i>
    </div>
    <div class="news-content">
      <div class="news-date">${formattedDate}</div>
      <div class="news-tag">${category}</div>
      <h4 class="news-title">${news.title || 'Untitled'}</h4>
      <p class="news-excerpt">${news.excerpt || 'No excerpt available'}</p>
      <button class="news-read-more" onclick="showNewsDetails('${news.id}')">
        Read Full Article
        <i class="fas fa-arrow-right"></i>
      </button>
    </div>
  `;
  
  return card;
}

// Show news details with Supabase integration
async function showNewsDetails(newsId) {
  console.log('📰 showNewsDetails called with ID:', newsId);
  
  try {
    console.log('🔧 Checking Supabase manager availability...');
    // Initialize Supabase client
    if (!window.supabaseManager || !window.supabaseManager.initialize) {
      console.log('❌ Supabase manager not available');
      showToast('News system not available. Please try again later.', 'error');
      return;
    }

    console.log('✅ Supabase manager available, initializing...');
    const supabase = await window.supabaseManager.initialize();
    console.log('✅ Supabase client initialized');
    
    // Fetch the specific news article from Supabase
    const { data: newsItem, error } = await supabase
      .from('news_data')
      .select('*')
      .eq('id', newsId)
      .single();

    if (error) {
      showToast('Error loading news article: ' + error.message, 'error');
      return;
    }

    if (!newsItem) {
      showToast('News article not found.', 'error');
      return;
    }

    // Create the news content HTML
    const newsContent = `
      <div class="news-article">
        <div class="article-header mb-4">
          <div class="article-meta">
            <span class="badge bg-primary">${newsItem.category || 'General'}</span>
            <span class="text-muted ms-2">${formatDate(newsItem.date || newsItem.created_at || newsItem.published_at)}</span>
          </div>
        </div>
        
        <h3 class="article-title mb-3">${newsItem.title || 'Untitled'}</h3>
        
        ${newsItem.excerpt ? `<p class="lead mb-4">${newsItem.excerpt}</p>` : ''}
        
        <div class="article-content">
          ${newsItem.content || newsItem.body || newsItem.description || 'No content available'}
        </div>
        
        ${newsItem.author ? `
          <div class="article-author mt-4 pt-3 border-top">
            <small class="text-muted">By ${newsItem.author}</small>
          </div>
        ` : ''}
        
        ${newsItem.source_url ? `
          <div class="article-source mt-2">
            <small class="text-muted">
              <a href="${newsItem.source_url}" target="_blank" rel="noopener noreferrer">
                Read more at source
              </a>
            </small>
          </div>
        ` : ''}
        
        <div class="article-footer mt-4 pt-3 border-top">
          <small class="text-muted">
            Published on ${formatDate(newsItem.date || newsItem.created_at || newsItem.published_at)}
            ${newsItem.updated_at ? ` • Last updated: ${formatDate(newsItem.updated_at)}` : ''}
          </small>
        </div>
      </div>
    `;

    // Get modal elements
    const modal = document.getElementById('newsModal');
    const modalTitle = document.getElementById('newsModalLabel');
    const modalBody = document.getElementById('newsModalBody');
    
    if (!modal || !modalTitle || !modalBody) {
      showToast('News modal not found. Please refresh the page.', 'error');
      return;
    }
    
    // Update modal content
    modalTitle.textContent = newsItem.title || 'News Article';
    modalBody.innerHTML = newsContent;
    
    // Show modal using Bootstrap
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
    
    // Setup share button functionality
    const shareButton = document.getElementById('share-news');
    if (shareButton) {
      shareButton.addEventListener('click', () => {
        // Simple share functionality
        if (navigator.share) {
          navigator.share({
            title: 'City News Article',
            text: `Check out this interesting article: ${newsItem.title}`,
            url: window.location.href
          });
        } else {
          // Fallback: copy to clipboard
          navigator.clipboard.writeText(window.location.href);
          showToast('Link copied to clipboard!', 'success');
        }
      });
    }
    
  } catch (error) {
    console.error('Error showing news details:', error);
    showToast('Error loading news article. Please try again.', 'error');
  }
}

// Update user information
function updateUserInfo(user) {
  const headerUserName = document.getElementById('header-user-name');
  if (headerUserName && user.name) {
    headerUserName.textContent = user.name;
  }
}

// Format date helper function
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('en-US', options);
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

// Show fallback community updates when database is not accessible
async function showFallbackCommunityUpdates() {
  const communitySection = document.querySelector('.community-updates-section');
  if (!communitySection) return;
  
  const eventsList = communitySection.querySelector('ul');
  if (!eventsList) return;
  
  // Show fallback events data
  const fallbackEvents = [
    {
      title: 'City Council Meeting',
      description: 'Monthly city council meeting open to the public',
      event_date: '2025-01-06',
      event_time: '6:00 PM'
    },
    {
      title: 'Community Clean-up Day',
      description: 'Annual community clean-up event',
      event_date: '2025-01-18',
      event_time: '8:00 AM'
    },
    {
      title: 'Public Safety Forum',
      description: 'Community safety discussion and Q&A session',
      event_date: '2025-01-25',
      event_time: '7:00 PM'
    }
  ];
  
  // Clear existing content
  eventsList.innerHTML = '';
  
  // Add fallback events
  fallbackEvents.forEach((event, index) => {
    const eventItem = document.createElement('li');
    const isLast = index === fallbackEvents.length - 1;
    
    eventItem.style.cssText = `
      margin-bottom: ${isLast ? '0' : '1rem'}; 
      padding-bottom: ${isLast ? '0' : '1rem'}; 
      border-bottom: ${isLast ? 'none' : '1px solid #f3f4f6'};
    `;
    
    const eventDate = new Date(event.event_date);
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    eventItem.innerHTML = `
      <strong style="color: #111827; display: block; margin-bottom: 0.25rem;">${event.title}</strong>
      <small style="color: #6b7280;">${formattedDate} at ${event.event_time}</small>
      ${event.description ? `<br><small style="color: #6b7280;">${event.description}</small>` : ''}
      <br><small style="color: #dc2626; font-style: italic;">(Sample data - Database access required)</small>
    `;
    
    eventsList.appendChild(eventItem);
  });
  
  // Show retry button in header
  const retryEventsBtn = document.getElementById('retry-events');
  if (retryEventsBtn) {
    retryEventsBtn.style.display = 'block';
  }
}

// Show fallback important notices when database is not accessible
async function showFallbackImportantNotices() {
  const section = document.querySelector('.important-notices-section');
  if (!section) return;
  
  const noticesDiv = section.querySelector(':scope > div:nth-of-type(2)') || section.querySelectorAll('div')[1];
  if (!noticesDiv) return;
  
  // Show fallback notices data
  const fallbackNotices = [
    {
      title: 'Water Maintenance',
      content: 'Scheduled maintenance on January 10-12, 2025. Expect temporary water interruptions.',
      priority: 'medium',
      contact_info: 'Contact Public Works at (555) 123-4567'
    },
    {
      title: 'Road Construction',
      content: 'Main Street construction project starting February 2025. Plan alternate routes.',
      priority: 'high',
      contact_info: 'Contact Traffic Department at (555) 987-6543'
    }
  ];
  
  // Clear existing notices
  noticesDiv.innerHTML = '';
  
  // Add fallback notices
  fallbackNotices.forEach((notice, index) => {
    const noticeItem = document.createElement('div');
    const isLast = index === fallbackNotices.length - 1;
    
    // Get priority-based styling
    const { backgroundColor, borderColor, textColor } = getNoticePriorityColors(notice.priority);
    
    noticeItem.style.cssText = `
      padding: 1rem; 
      border-radius: 0.5rem; 
      margin-bottom: ${isLast ? '0' : '1rem'}; 
      background-color: ${backgroundColor}; 
      border: 1px solid ${borderColor}; 
      color: ${textColor};
    `;
    
    noticeItem.innerHTML = `
      <strong>${notice.title}</strong><br>
      ${notice.content}
      ${notice.contact_info ? `<br><small>Contact: ${notice.contact_info}</small>` : ''}
      <br><small style="color: #dc2626; font-style: italic;">(Sample data - Database access required)</small>
    `;
    
    noticesDiv.appendChild(noticeItem);
  });
  
  // Show retry button in header
  const retryNoticesBtn = document.getElementById('retry-notices');
  if (retryNoticesBtn) {
    retryNoticesBtn.style.display = 'block';
  }
}

// Add retry functionality for failed data loads
async function retryDataLoad(loadFunction, maxRetries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await loadFunction();
      return; // Success, exit retry loop
    } catch (error) {
      // Removed console.log
      
      if (attempt === maxRetries) {
        // Removed console.log
        // Show fallback data on final failure
        if (loadFunction === loadCommunityUpdates) {
          await showFallbackCommunityUpdates();
        } else if (loadFunction === loadImportantNotices) {
          await showFallbackImportantNotices();
        }
        return;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// ============================================================================
// MANUAL DATA LOADING FUNCTIONS FOR TESTING
// ============================================================================

// Function to manually load all data (for testing)
async function manualLoadAllData() {
  // Removed console.log
  
  try {
    const user = await window.userUtils.initializeUserData();
    if (!user) {
      console.error('❌ No user data available');
      return;
    }
    
    // Removed console.log
    
    // Load complaints
    await loadRecentComplaints(user);
    
    // Load news
    await loadNews();
    
    // Load community updates
    await loadCommunityUpdates();
    
    // Load important notices
    await loadImportantNotices();
    
    // Removed console.log
  } catch (error) {
    console.error('❌ Error in manual data loading:', error);
  }
}

// Function to check function availability
function checkFunctionAvailability() {
  const functions = [
    'getNews',
    'getUpcomingEvents', 
    'getActiveNotices',
    'getComplaints'
  ];
  
  functions.forEach(funcName => {
    const func = window[funcName];
    if (typeof func === 'function') {
      // Function is available
    } else {
      // Function is not available
    }
  });
}

// Make functions available globally for testing
if (typeof window !== 'undefined') {
  console.log('🌍 Window object available, setting up global functions...');
  window.manualLoadAllData = manualLoadAllData;
  window.checkFunctionAvailability = checkFunctionAvailability;
  window.showNewsDetails = showNewsDetails;
  console.log('✅ Global functions set up successfully');
}

console.log('📁 citizen-dashboard.js file execution completed');
