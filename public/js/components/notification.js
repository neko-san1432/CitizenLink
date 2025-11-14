// Notification component with lazy loading functionality
import { brandConfig } from '../config/index.js';
import apiClient from '../config/apiClient.js';
import { getNotificationIcon } from '../utils/icons.js';

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
  const notificationBtn = document.getElementById('notification-btn');
  const notificationPanel = document.getElementById('notification-panel');
  const closeBtn = document.getElementById('close-notifications');
  const markAllReadBtn = document.getElementById('mark-all-read');
  const showMoreBtn = document.getElementById('show-more-notifications');
  const retryBtn = document.getElementById('retry-notifications');
  if (notificationBtn && notificationPanel) {
    // Toggle notification panel with smooth animations
    notificationBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close profile panel if open
      const profilePanel = document.getElementById('profile-panel');
      if (profilePanel && profilePanel.classList.contains('show')) {
        profilePanel.classList.remove('show');
        setTimeout(() => {
          profilePanel.style.display = 'none';
        }, 300);
      }
      // Toggle notification panel with smooth animation
      if (notificationPanel.classList.contains('show')) {
        // Close
        notificationPanel.classList.remove('show');
        setTimeout(() => {
          notificationPanel.style.display = 'none';
        }, 300);
      } else {
        // Open
        notificationPanel.style.display = 'block';
        // Force reflow to ensure display is set before adding show class
        notificationPanel.offsetHeight;
        setTimeout(() => {
          notificationPanel.classList.add('show');
          // Load notifications when panel is opened (only show loading on first load)
          loadNotifications(true, notificationState.isFirstLoad);
        }, 10);
      }
      // Debug positioning
      if (notificationPanel.classList.contains('show')) {
        const rect = notificationPanel.getBoundingClientRect();
      }
    });
    // Close panel when close button is clicked
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationPanel.classList.remove('show');
        setTimeout(() => {
          notificationPanel.style.display = 'none';
        }, 300);
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
        if (notificationPanel.classList.contains('show')) {
          notificationPanel.classList.remove('show');
          setTimeout(() => {
            notificationPanel.style.display = 'none';
          }, 300);
        }
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
    setTimeout(() => {
      notificationPanel.style.display = 'none';
    }, 300);
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
          // When resetting, replace all notifications with fresh data from server
          notificationState.notifications = newNotifications;
        } else {
          // Merge new notifications, keeping existing ones and adding new ones to the top
          // But preserve the read status of existing notifications
          const existingNotificationsMap = new Map(notificationState.notifications.map(n => [n.id, n]));
          const mergedNotifications = [];
          
          // Add new notifications first (most recent)
          for (const newNotif of newNotifications) {
            const existing = existingNotificationsMap.get(newNotif.id);
            if (existing) {
              // Keep existing notification with its current read status
              mergedNotifications.push(existing);
              existingNotificationsMap.delete(newNotif.id);
            } else {
              // New notification
              mergedNotifications.push(newNotif);
            }
          }
          
          // Add remaining existing notifications that weren't in the new batch
          mergedNotifications.push(...Array.from(existingNotificationsMap.values()));
          
          notificationState.notifications = mergedNotifications;
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
// Fetch notifications from API - fetch ALL notifications (read and unread)
async function fetchNotifications(page, limit) {
  try {
    // Use /api/notifications endpoint to get all notifications (read and unread)
    const response = await apiClient.get(`/api/notifications?limit=${limit}&offset=${page * limit}`);
    if (!response.success) {
      throw new Error('Failed to fetch notifications');
    }
    // Format created_at to relative time
    const formattedNotifications = (response.notifications || []).map(notif => ({
      ...notif,
      time: formatRelativeTime(notif.created_at),
      read: notif.read || false
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
    const readClass = notification.read ? 'read' : 'unread';
    const clickableClass = !notification.read ? 'clickable' : '';
    const readIndicator = notification.read ? '<div class="read-indicator" title="Read">✓</div>' : '';
    return `
      <div class="notification-item ${readClass} ${priorityClass} ${isNew ? 'new-notification' : ''} ${clickableClass}" 
           data-id="${notification.id}" 
           ${linkAttr}
           style="cursor: pointer;" 
           title="${notification.read ? 'Read notification' : 'Click to mark as read'}">
        <div class="notification-icon">${getNotificationIcon(notification.type, { size: 20 })}</div>
        <div class="notification-text">
          <div class="notification-title">${escapeHtml(notification.title)} ${newIndicator}</div>
          <div class="notification-message">${escapeHtml(notification.message)}</div>
          <div class="notification-time">${notification.time}</div>
        </div>
        ${!notification.read ? '<div class="notification-mark-read" title="Mark as read">✓</div>' : readIndicator}
      </div>
    `;
  }).join('');
  content.innerHTML = html;
  // Add click handlers for all notifications (with or without links)
  content.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', async function(e) {
      e.preventDefault(); // Prevent default behavior (form submission, link navigation, etc.)
      e.stopPropagation(); // Prevent event bubbling
      
      const notifId = this.dataset.id;
      if (!notifId) {
        console.error('[NOTIFICATION] No notification ID found');
        return;
      }
      
      const {link} = this.dataset;
      const isRead = this.classList.contains('read');
      
      console.log('[NOTIFICATION] Clicked notification:', { notifId, isRead, link });
      
      // Mark as read if not already read
      if (!isRead) {
        try {
          console.log('[NOTIFICATION] Marking as read:', notifId);
          const response = await apiClient.post(`/api/notifications/${notifId}/mark-read`, {});
          console.log('[NOTIFICATION] Mark as read response:', response);
          
          if (response && response.success) {
            // Remove unread class and add read class
            this.classList.remove('unread', 'clickable');
            this.classList.add('read');
            
            // Remove the mark-read indicator and add read indicator
            const markReadIndicator = this.querySelector('.notification-mark-read');
            if (markReadIndicator) {
              markReadIndicator.remove();
            }
            
            // Add read indicator
            const readIndicator = document.createElement('div');
            readIndicator.className = 'read-indicator';
            readIndicator.title = 'Read';
            readIndicator.textContent = '✓';
            this.appendChild(readIndicator);
            
            // Update notification state
            const notification = notificationState.notifications.find(n => n.id === notifId);
            if (notification) {
              notification.read = true;
            }
            
            // Update unread count
            await loadUnreadCount();
            
            console.log('[NOTIFICATION] Successfully marked as read');
            
            // Only navigate if there's a link - don't refresh the page
            if (link) {
              closeNotificationPanel();
              // Use setTimeout to ensure state is updated before navigation
              setTimeout(() => {
                window.location.href = link;
              }, 100);
            }
            // If no link, just mark as read and stay on the page (no refresh)
          } else {
            console.error('[NOTIFICATION] Failed to mark as read - invalid response:', response);
          }
        } catch (error) {
          console.error('[NOTIFICATION] Failed to mark as read:', error);
          alert('Failed to mark notification as read. Please try again.');
          return;
        }
      } else {
        // Already read - only navigate if there's a link
        if (link) {
          closeNotificationPanel();
          window.location.href = link;
        }
      }
    });
  });
  
  console.log('[NOTIFICATION] Added click handlers to', content.querySelectorAll('.notification-item').length, 'notifications');
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
  const markAllReadBtn = document.getElementById('mark-all-read');
  if (markAllReadBtn) {
    markAllReadBtn.disabled = true;
    markAllReadBtn.style.opacity = '0.5';
  }
  
  try {
    const response = await apiClient.post('/api/notifications/mark-all-read', {});
    if (response && response.success) {
      // Update local state
      notificationState.notifications.forEach(notification => {
        notification.read = true;
      });
      renderNotifications();
      updateNotificationCount(0);
      
      // Show success feedback
      if (markAllReadBtn) {
        const originalText = markAllReadBtn.innerHTML;
        markAllReadBtn.innerHTML = '<span style="color: #10b981;">✓ All Read</span>';
        setTimeout(() => {
          markAllReadBtn.innerHTML = originalText;
          markAllReadBtn.disabled = false;
          markAllReadBtn.style.opacity = '1';
        }, 2000);
      }
    } else {
      throw new Error('Failed to mark all as read');
    }
  } catch (error) {
    console.error('[NOTIFICATION] Failed to mark all as read:', error);
    alert('Failed to mark all notifications as read. Please try again.');
    if (markAllReadBtn) {
      markAllReadBtn.disabled = false;
      markAllReadBtn.style.opacity = '1';
    }
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
