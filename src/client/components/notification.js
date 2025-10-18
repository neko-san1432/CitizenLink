// Notification component with lazy loading functionality
import { brandConfig } from '../config/index.js';
import apiClient from '../config/apiClient.js';

// Notification state management
const notificationState = {
  page: 0,
  limit: 10,
  hasMore: true,
  loading: false,
  notifications: []
};

// Real-time polling interval (30 seconds)
let pollingInterval = null;
const POLLING_INTERVAL_MS = 30000;

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

    // Initial notification count load
    loadUnreadCount();

    // Start real-time polling for unread count
    startPolling();
  }
}

// Close notification panel (exported for use by other components)
export function closeNotificationPanel() {
  const notificationPanel = document.getElementById('notification-panel');
  if (notificationPanel && !notificationPanel.classList.contains('hidden')) {
    notificationPanel.classList.add('hidden');
  }
}

// Start real-time polling
function startPolling() {
  // Clear any existing interval
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  // Poll every 30 seconds
  pollingInterval = setInterval(() => {
    loadUnreadCount();
  }, POLLING_INTERVAL_MS);
}

// Stop polling (cleanup)
export function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// Load unread count
async function loadUnreadCount() {
  try {
    const response = await apiClient.get('/api/notifications/count');

    if (response.success) {
      updateNotificationCount(response.count);
    }
  } catch (error) {
    console.error('[NOTIFICATION] Failed to load unread count:', error);
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

// Fetch notifications from API
async function fetchNotifications(page, limit) {
  try {
    const response = await apiClient.get(`/api/notifications?page=${page}&limit=${limit}`);

    if (!response.success) {
      throw new Error('Failed to fetch notifications');
    }

    // Format created_at to relative time
    const formattedNotifications = response.data.notifications.map(notif => ({
      ...notif,
      time: formatRelativeTime(notif.created_at)
    }));

    return {
      success: true,
      data: {
        notifications: formattedNotifications,
        hasMore: response.data.hasMore
      }
    };
  } catch (error) {
    console.error('[NOTIFICATION] Fetch error:', error);
    throw error;
  }
}

// Format timestamp to relative time (e.g., "2 minutes ago")
function formatRelativeTime(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now - time;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`;
  return time.toLocaleDateString();
}

// Render notifications in the UI
function renderNotifications() {
  const content = document.getElementById('notification-content');
  if (!content) return;

  if (notificationState.notifications.length === 0) {
    content.innerHTML = '<div class="no-notifications">No notifications yet</div>';
    return;
  }

  const html = notificationState.notifications.map(notification => {
    const priorityClass = notification.priority === 'urgent' ? 'notification-urgent' :
      notification.priority === 'warning' ? 'notification-warning' : '';

    const linkAttr = notification.link ? `data-link="${notification.link}"` : '';

    return `
      <div class="notification-item ${notification.read ? 'read' : ''} ${priorityClass}" 
           data-id="${notification.id}" 
           ${linkAttr}
           style="cursor: ${notification.link ? 'pointer' : 'default'}">
        <div class="notification-icon">${notification.icon}</div>
        <div class="notification-text">
          <div class="notification-title">${escapeHtml(notification.title)}</div>
          <div class="notification-message">${escapeHtml(notification.message)}</div>
          <div class="notification-time">${notification.time}</div>
        </div>
      </div>
    `;
  }).join('');

  content.innerHTML = html;

  // Add click handlers for notifications with links
  content.querySelectorAll('.notification-item[data-link]').forEach(item => {
    item.addEventListener('click', async function() {
      const notifId = this.dataset.id;
      const link = this.dataset.link;

      // Mark as read
      try {
        await apiClient.put(`/api/notifications/${notifId}/read`);
        this.classList.add('read');
        loadUnreadCount();
      } catch (error) {
        console.warn('[NOTIFICATION] Failed to mark as read:', error);
      }

      // Navigate to link
      if (link) {
        closeNotificationPanel();
        window.location.href = link;
      }
    });
  });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
async function markAllNotificationsAsRead() {
  try {
    const response = await apiClient.put('/api/notifications/read-all');

    if (response.success) {
      // Update local state
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
  } catch (error) {
    console.error('[NOTIFICATION] Failed to mark all as read:', error);
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
