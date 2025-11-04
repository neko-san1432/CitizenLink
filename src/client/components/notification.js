// Notification component with lazy loading functionality
import { brandConfig } from '../config/index.js';
import apiClient from '../config/apiClient.js';

// Notification state management
const notificationState = {
  page: 0,
  limit: 10,
  hasMore: true,
  loading: false,
  notifications: [],
  isFirstLoad: true,
  lastNotificationId: null
};

// Real-time polling interval (30 seconds)
let pollingInterval = null;
const POLLING_INTERVAL_MS = 30000;

// Initialize notification button functionality
export function initializeNotificationButton() {
  console.log('[NOTIFICATION] Initializing notification button...');
  const notificationBtn = document.getElementById('notification-btn');
  const notificationPanel = document.getElementById('notification-panel');
  const closeBtn = document.getElementById('close-notifications');
  const markAllReadBtn = document.getElementById('mark-all-read');
  const showMoreBtn = document.getElementById('show-more-notifications');
  const retryBtn = document.getElementById('retry-notifications');

  if (notificationBtn && notificationPanel) {
    console.log('[NOTIFICATION] Notification elements found');
    console.log('[NOTIFICATION] Notification button:', notificationBtn);
    console.log('[NOTIFICATION] Notification panel:', notificationPanel);
    // Toggle notification panel with smooth animations
    notificationBtn.addEventListener('click', (e) => {
      console.log('[NOTIFICATION] Notification button clicked!');
      e.stopPropagation();

      // Close profile panel if open
      const profilePanel = document.getElementById('profile-panel');
      if (profilePanel && profilePanel.classList.contains('show')) {
        profilePanel.classList.remove('show');
        profilePanel.style.opacity = '0';
        profilePanel.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          profilePanel.style.display = 'none';
        }, 300);
      }

      // Toggle notification panel with smooth animation
      if (notificationPanel.classList.contains('show')) {
        // Close
        notificationPanel.classList.remove('show');
        notificationPanel.style.opacity = '0';
        notificationPanel.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          notificationPanel.style.display = 'none';
        }, 300);
      } else {
        // Open
        notificationPanel.classList.add('show');
        notificationPanel.style.display = 'block';
        setTimeout(() => {
          notificationPanel.style.opacity = '1';
          notificationPanel.style.transform = 'translateY(0)';
        }, 10);
      }

      console.log('[NOTIFICATION] Notification panel classes after toggle:', notificationPanel.className);
      console.log('[NOTIFICATION] Notification panel has show class:', notificationPanel.classList.contains('show'));

      // Debug positioning
      if (notificationPanel.classList.contains('show')) {
        const rect = notificationPanel.getBoundingClientRect();
        console.log('[NOTIFICATION] Notification panel position:', {
          top: notificationPanel.style.top,
          left: notificationPanel.style.left,
          right: notificationPanel.style.right,
          zIndex: notificationPanel.style.zIndex,
          display: getComputedStyle(notificationPanel).display,
          visibility: getComputedStyle(notificationPanel).visibility,
          opacity: getComputedStyle(notificationPanel).opacity,
          boundingRect: {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
          }
        });
      }

      // Load notifications when panel is opened (only show loading on first load)
      if (notificationPanel.classList.contains('show')) {
        loadNotifications(true, notificationState.isFirstLoad);
      }
    });

    // Close panel when close button is clicked
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationPanel.classList.remove('show');
      });
    }

    // Mark all as read functionality
    if (markAllReadBtn) {
      markAllReadBtn.addEventListener('click', () => {
        markAllNotificationsAsRead();
      });
    }

    // Show more notifications
    if (showMoreBtn) {
      showMoreBtn.addEventListener('click', () => {
        loadNotifications(false, false); // Don't show loading for "Show More"
      });
    }

    // Retry loading notifications
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        loadNotifications(true, true); // Show loading for retry
      });
    }

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
      if (!notificationPanel.contains(e.target) && !notificationBtn.contains(e.target)) {
        notificationPanel.classList.remove('show');
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
  if (notificationPanel && notificationPanel.classList.contains('show')) {
    notificationPanel.classList.remove('show');
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
    checkForNewNotifications();
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

// Check for new notifications and add them to the top
async function checkForNewNotifications() {
  try {
    // Only check if we have notifications loaded and a last notification ID
    if (notificationState.notifications.length === 0 || !notificationState.lastNotificationId) {
      return;
    }

    // Fetch only the latest notification to check if there are new ones
    const response = await apiClient.get('/api/notifications/latest?limit=1');

    if (response.success && response.notifications && response.notifications.length > 0) {
      const latestNotification = response.notifications[0];

      // If this is a new notification (different ID than our last one)
      if (latestNotification.id !== notificationState.lastNotificationId) {
        console.log('[NOTIFICATION] New notification detected, adding to top of list');

        // Add the new notification to the top of the list
        notificationState.notifications.unshift(latestNotification);

        // Update the last notification ID
        notificationState.lastNotificationId = latestNotification.id;

        // Re-render notifications
        renderNotifications();
        updateNotificationCount(notificationState.notifications.filter(n => !n.read).length);

        // Show a subtle indicator that new notifications were added
        showNewNotificationIndicator();
      }
    }
  } catch (error) {
    console.error('[NOTIFICATION] Failed to check for new notifications:', error);
  }
}

// Show a subtle indicator that new notifications were added
function showNewNotificationIndicator() {
  const notificationPanel = document.getElementById('notification-panel');
  if (!notificationPanel) return;

  // Add a subtle animation to indicate new content
  notificationPanel.style.transform = 'scale(1.02)';
  setTimeout(() => {
    notificationPanel.style.transform = 'scale(1)';
  }, 200);
}

// Load notifications with lazy loading
async function loadNotifications(reset = false, showLoading = true) {
  if (notificationState.loading) return;

  if (reset) {
    notificationState.page = 0;
    notificationState.notifications = [];
    notificationState.hasMore = true;
  }

  if (!notificationState.hasMore) return;

  notificationState.loading = true;

  // Only show loading indicator on first load or when explicitly requested
  if (showLoading) {
    showLoadingState(true);
  }
  hideErrorState();

  try {
    // Simulate API call - replace with actual API endpoint
    const response = await fetchNotifications(notificationState.page, notificationState.limit);

    if (response.success) {
      const newNotifications = response.data.notifications;
      const {hasMore} = response.data;

      // Add new notifications to the top of the list
      if (reset) {
        notificationState.notifications = newNotifications;
      } else {
        // Merge new notifications, keeping existing ones and adding new ones to the top
        const existingIds = new Set(notificationState.notifications.map(n => n.id));
        const trulyNewNotifications = newNotifications.filter(n => !existingIds.has(n.id));
        notificationState.notifications = [...trulyNewNotifications, ...notificationState.notifications];
      }

      notificationState.hasMore = hasMore;
      notificationState.page++;

      // Update last notification ID for future checks
      if (newNotifications.length > 0) {
        notificationState.lastNotificationId = newNotifications[0].id;
      }

      renderNotifications();
      updateShowMoreButton();
      updateNotificationCount(notificationState.notifications.filter(n => !n.read).length);

      // Mark first load as complete
      notificationState.isFirstLoad = false;
    } else {
      showErrorState();
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
    showErrorState();
  } finally {
    notificationState.loading = false;
    if (showLoading) {
      showLoadingState(false);
    }
  }
}

// Fetch notifications from API
async function fetchNotifications(page, limit) {
  try {
    const response = await apiClient.get(`/api/notifications/unread?limit=${limit}&offset=${page * limit}`);

    if (!response.success) {
      throw new Error('Failed to fetch notifications');
    }

    // Format created_at to relative time
    const formattedNotifications = response.notifications.map(notif => ({
      ...notif,
      time: formatRelativeTime(notif.created_at),
      read: notif.read
    }));

    return {
      success: true,
      data: {
        notifications: formattedNotifications,
        hasMore: formattedNotifications.length === limit
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

  const html = notificationState.notifications.map((notification, index) => {
    const priorityClass = notification.priority === 'urgent' ? 'notification-urgent' :
      notification.priority === 'warning' ? 'notification-warning' : '';

    const linkAttr = notification.link ? `data-link="${notification.link}"` : '';

    // Add "new" indicator for recent notifications (first 3 items)
    const isNew = index < 3 && !notification.read;
    const newIndicator = isNew ? '<div class="new-indicator">NEW</div>' : '';

    return `
      <div class="notification-item ${notification.read ? 'read' : ''} ${priorityClass} ${isNew ? 'new-notification' : ''}" 
           data-id="${notification.id}" 
           ${linkAttr}
           style="cursor: ${notification.link ? 'pointer' : 'default'}">
        <div class="notification-icon">${notification.icon}</div>
        <div class="notification-text">
          <div class="notification-title">${escapeHtml(notification.title)} ${newIndicator}</div>
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
      const {link} = this.dataset;

      // Mark as read
      try {
        await apiClient.post(`/api/notifications/${notifId}/mark-read`);
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
    const response = await apiClient.post('/api/notifications/mark-all-read');

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
        notificationPanel.classList.remove('show');
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
