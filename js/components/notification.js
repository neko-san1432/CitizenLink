// Notification component with lazy loading functionality
import { brandConfig } from '../config/index.js';

// Notification state management
let notificationState = {
  page: 0,
  limit: 10,
  hasMore: true,
  loading: false,
  notifications: []
};

// Initialize notification button functionality
export function initializeNotificationButton() {
  const notificationBtn = document.getElementById('notification-btn');
  const notificationPanel = document.getElementById('notification-panel');
  const closeBtn = document.getElementById('close-notifications');
  const markAllReadBtn = document.getElementById('mark-all-read');
  const showMoreBtn = document.getElementById('show-more-notifications');
  const retryBtn = document.getElementById('retry-notifications');
  
  if (notificationBtn && notificationPanel) {
    // Toggle notification panel
    notificationBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      notificationPanel.classList.toggle('hidden');
      
      // Load notifications when panel is opened
      if (!notificationPanel.classList.contains('hidden')) {
        loadNotifications(true);
      }
    });
    
    // Close panel when close button is clicked
    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        notificationPanel.classList.add('hidden');
      });
    }
    
    // Mark all as read functionality
    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', function() {
        markAllNotificationsAsRead();
      });
    }
    
    // Show more notifications
    if (showMoreBtn) {
      showMoreBtn.addEventListener('click', function() {
        loadNotifications(false);
      });
    }
    
    // Retry loading notifications
    if (retryBtn) {
      retryBtn.addEventListener('click', function() {
        loadNotifications(true);
      });
    }
    
    // Close panel when clicking outside
    document.addEventListener('click', function(e) {
      if (!notificationPanel.contains(e.target) && !notificationBtn.contains(e.target)) {
        notificationPanel.classList.add('hidden');
      }
    });
    
    // Initial notification count
    updateNotificationCount(0);
  }
}

// Close notification panel (exported for use by other components)
export function closeNotificationPanel() {
  const notificationPanel = document.getElementById('notification-panel');
  if (notificationPanel && !notificationPanel.classList.contains('hidden')) {
    notificationPanel.classList.add('hidden');
  }
}

// Load notifications with lazy loading
async function loadNotifications(reset = false) {
  if (notificationState.loading) return;
  
  if (reset) {
    notificationState.page = 0;
    notificationState.notifications = [];
    notificationState.hasMore = true;
  }
  
  if (!notificationState.hasMore) return;
  
  notificationState.loading = true;
  showLoadingState(true);
  hideErrorState();
  
  try {
    // Simulate API call - replace with actual API endpoint
    const response = await fetchNotifications(notificationState.page, notificationState.limit);
    
    if (response.success) {
      const newNotifications = response.data.notifications;
      const hasMore = response.data.hasMore;
      
      notificationState.notifications = reset ? newNotifications : [...notificationState.notifications, ...newNotifications];
      notificationState.hasMore = hasMore;
      notificationState.page++;
      
      renderNotifications();
      updateShowMoreButton();
      updateNotificationCount(notificationState.notifications.filter(n => !n.read).length);
    } else {
      showErrorState();
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
    showErrorState();
  } finally {
    notificationState.loading = false;
    showLoadingState(false);
  }
}

// Simulate API call - replace with actual implementation
async function fetchNotifications(page, limit) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Mock data - replace with actual API call
  const allNotifications = [
    { id: 1, title: 'Welcome to CitizenLink', message: 'Welcome to our platform!', time: 'Just now', icon: '📢', read: false },
    { id: 2, title: 'Complaint Received', message: 'Your complaint has been received and is being reviewed', time: '2 minutes ago', icon: '✅', read: false },
    { id: 3, title: 'Status Update', message: 'Your complaint status has been updated', time: '1 hour ago', icon: '🔄', read: false },
    { id: 4, title: 'New Message', message: 'You have a new message from support', time: '2 hours ago', icon: '💬', read: true },
    { id: 5, title: 'System Maintenance', message: 'Scheduled maintenance will occur tonight', time: '3 hours ago', icon: '🔧', read: true },
    { id: 6, title: 'Profile Update', message: 'Your profile has been successfully updated', time: '1 day ago', icon: '👤', read: true },
    { id: 7, title: 'Security Alert', message: 'New login detected from different location', time: '2 days ago', icon: '🔒', read: true },
    { id: 8, title: 'Feature Update', message: 'New features are now available', time: '3 days ago', icon: '✨', read: true },
    { id: 9, title: 'Reminder', message: 'Don\'t forget to complete your profile', time: '1 week ago', icon: '⏰', read: true },
    { id: 10, title: 'Welcome Back', message: 'Welcome back to CitizenLink', time: '1 week ago', icon: '👋', read: true },
    { id: 11, title: 'Account Verified', message: 'Your account has been verified', time: '2 weeks ago', icon: '✓', read: true },
    { id: 12, title: 'Password Changed', message: 'Your password has been successfully changed', time: '2 weeks ago', icon: '🔑', read: true }
  ];
  
  const startIndex = page * limit;
  const endIndex = startIndex + limit;
  const notifications = allNotifications.slice(startIndex, endIndex);
  const hasMore = endIndex < allNotifications.length;
  
  return {
    success: true,
    data: {
      notifications,
      hasMore
    }
  };
}

// Render notifications in the UI
function renderNotifications() {
  const content = document.getElementById('notification-content');
  if (!content) return;
  
  if (notificationState.notifications.length === 0) {
    content.innerHTML = '<div class="no-notifications">No notifications yet</div>';
    return;
  }
  
  const html = notificationState.notifications.map(notification => `
    <div class="notification-item ${notification.read ? 'read' : ''}" data-id="${notification.id}">
      <div class="notification-icon">${notification.icon}</div>
      <div class="notification-text">
        <div class="notification-title">${notification.title}</div>
        <div class="notification-message">${notification.message}</div>
        <div class="notification-time">${notification.time}</div>
      </div>
    </div>
  `).join('');
  
  content.innerHTML = html;
}

// Update show more button state
function updateShowMoreButton() {
  const showMoreBtn = document.getElementById('show-more-notifications');
  if (!showMoreBtn) return;
  
  if (!notificationState.hasMore) {
    showMoreBtn.style.display = 'none';
  } else {
    showMoreBtn.style.display = 'block';
    showMoreBtn.textContent = notificationState.loading ? 'Loading...' : 'Show More';
    showMoreBtn.disabled = notificationState.loading;
  }
}

// Show/hide loading state
function showLoadingState(show) {
  const loading = document.getElementById('notification-loading');
  if (loading) {
    loading.classList.toggle('hidden', !show);
  }
}

// Show/hide error state
function showErrorState() {
  const error = document.getElementById('notification-error');
  if (error) {
    error.classList.remove('hidden');
  }
}

function hideErrorState() {
  const error = document.getElementById('notification-error');
  if (error) {
    error.classList.add('hidden');
  }
}

// Mark all notifications as read
function markAllNotificationsAsRead() {
  notificationState.notifications.forEach(notification => {
    notification.read = true;
  });
  
  renderNotifications();
  updateNotificationCount(0);
  
  // Close panel
  const notificationPanel = document.getElementById('notification-panel');
  if (notificationPanel) {
    notificationPanel.classList.add('hidden');
  }
}

// Function to update notification count
export function updateNotificationCount(count) {
  const notificationBadge = document.getElementById('notification-badge');
  if (notificationBadge) {
    if (count > 0) {
      notificationBadge.textContent = count > 99 ? '99+' : count;
      notificationBadge.classList.remove('hidden');
    } else {
      notificationBadge.classList.add('hidden');
    }
  }
}
