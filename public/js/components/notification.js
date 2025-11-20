import apiClient from '../config/apiClient.js';
import { getNotificationIcon } from '../utils/icons.js';
import showMessage from './toast.js';

const POLLING_INTERVAL_MS = 30000;

class NotificationService {
  async fetchNotifications(page, limit) {
    const response = await apiClient.get(`/api/notifications?limit=${limit}&offset=${page * limit}`);
    if (!response.success) {
      throw new Error('Failed to fetch notifications');
    }
    const notifications = (response.notifications || []).map(notification => ({
      ...notification,
      time: formatRelativeTime(notification.created_at),
      read: Boolean(notification.read)
    }));
    return {
      notifications,
      hasMore: notifications.length === limit
    };
  }

  async getUnreadCount() {
    return apiClient.get('/api/notifications/count');
  }

  async getLatest(limit = 1) {
    return apiClient.get(`/api/notifications/latest?limit=${limit}`);
  }

  async markAsRead(notificationId) {
    return apiClient.post(`/api/notifications/${notificationId}/mark-read`, {});
  }

  async markAllRead() {
    return apiClient.post('/api/notifications/mark-all-read', {});
  }
}

class NotificationManager {
  constructor(service) {
    this.service = service;
    this.connectionErrorCount = 0; // Track consecutive connection errors
    this.state = {
      page: 0,
      limit: 10,
      hasMore: true,
      loading: false,
      notifications: [],
      isFirstLoad: true,
      lastNotificationId: null
    };
    this.dom = {
      button: null,
      panel: null,
      close: null,
      markAll: null,
      showMore: null,
      retry: null,
      content: null,
      loading: null,
      error: null,
      badge: null
    };
    this.pollingInterval = null;

    this.handleButtonClick = this.handleButtonClick.bind(this);
    this.handleCloseClick = this.handleCloseClick.bind(this);
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    this.handleShowMoreClick = this.handleShowMoreClick.bind(this);
    this.handleRetryClick = this.handleRetryClick.bind(this);
    this.handleMarkAllClick = this.handleMarkAllClick.bind(this);
  }

  initialize() {
    this.cacheDom();
    if (!this.dom.button || !this.dom.panel) {
      return;
    }
    this.bindEvents();
    this.loadUnreadCount();
    this.startPolling();
  }

  cacheDom() {
    this.dom.button = document.getElementById('notification-btn');
    this.dom.panel = document.getElementById('notification-panel');
    this.dom.close = document.getElementById('close-notifications');
    this.dom.markAll = document.getElementById('mark-all-read');
    this.dom.showMore = document.getElementById('show-more-notifications');
    this.dom.retry = document.getElementById('retry-notifications');
    this.dom.content = document.getElementById('notification-content');
    this.dom.loading = document.getElementById('notification-loading');
    this.dom.error = document.getElementById('notification-error');
    this.dom.badge = document.getElementById('notification-badge');
  }

  bindEvents() {
    this.dom.button?.addEventListener('click', this.handleButtonClick);
    this.dom.close?.addEventListener('click', this.handleCloseClick);
    this.dom.showMore?.addEventListener('click', this.handleShowMoreClick);
    this.dom.retry?.addEventListener('click', this.handleRetryClick);
    this.dom.markAll?.addEventListener('click', this.handleMarkAllClick);
    document.addEventListener('click', this.handleDocumentClick);
  }

  handleButtonClick(event) {
    event.stopPropagation();
    this.togglePanel();
  }

  handleCloseClick(event) {
    event.stopPropagation();
    this.closePanel();
  }

  handleDocumentClick(event) {
    if (!this.dom.panel || !this.dom.button) return;
    if (!this.dom.panel.contains(event.target) && !this.dom.button.contains(event.target)) {
      this.closePanel();
    }
  }

  handleShowMoreClick() {
    this.loadNotifications({ reset: false, showLoading: false });
  }

  handleRetryClick() {
    this.loadNotifications({ reset: true, showLoading: true });
  }

  handleMarkAllClick() {
    this.markAllAsRead();
  }

  togglePanel() {
    if (!this.dom.panel) return;
    const profilePanel = document.getElementById('profile-panel');
    if (profilePanel?.classList.contains('show')) {
      profilePanel.classList.remove('show');
      setTimeout(() => {
        profilePanel.style.display = 'none';
      }, 300);
    }
    if (this.dom.panel.classList.contains('show')) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  openPanel() {
    if (!this.dom.panel) return;
    this.dom.panel.style.display = 'block';
    this.dom.panel.offsetHeight; // force reflow
    setTimeout(() => {
      this.dom.panel?.classList.add('show');
      this.loadNotifications({ reset: this.state.isFirstLoad, showLoading: this.state.isFirstLoad });
    }, 10);
  }

  closePanel() {
    if (!this.dom.panel?.classList.contains('show')) return;
    this.dom.panel.classList.remove('show');
    setTimeout(() => {
      if (this.dom.panel) {
        this.dom.panel.style.display = 'none';
      }
    }, 300);
  }

  startPolling() {
    this.stopPolling();
    this.pollingInterval = setInterval(() => {
      this.loadUnreadCount();
      this.checkForNewNotifications();
    }, POLLING_INTERVAL_MS);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async loadUnreadCount() {
    try {
      const response = await this.service.getUnreadCount();
      if (response?.success) {
        this.updateBadge(response.count);
        // Reset connection error state on success
        this.connectionErrorCount = 0;
      } else if (response?.connectionError) {
        // Handle connection errors gracefully
        this.connectionErrorCount = (this.connectionErrorCount || 0) + 1;
        // If we've had multiple connection errors, stop polling temporarily
        if (this.connectionErrorCount >= 3) {
          console.warn('[NOTIFICATION] Multiple connection errors detected. Stopping polling.');
          this.stopPolling();
          // Try to restart polling after a longer delay (5 minutes)
          setTimeout(() => {
            console.log('[NOTIFICATION] Attempting to restart polling...');
            this.connectionErrorCount = 0;
            this.startPolling();
          }, 5 * 60 * 1000);
        }
      }
    } catch (error) {
      // Only log non-connection errors
      if (!error.message?.includes('Failed to fetch') && 
          !error.message?.includes('ERR_CONNECTION_REFUSED')) {
        console.error('[NOTIFICATION] Failed to load unread count:', error);
      }
    }
  }

  async checkForNewNotifications() {
    try {
      if (this.state.notifications.length === 0 || !this.state.lastNotificationId) {
        return;
      }
      const response = await this.service.getLatest();
      if (response.success && response.notifications?.length) {
        const latest = response.notifications[0];
        if (latest.id !== this.state.lastNotificationId) {
          this.state.notifications.unshift({
            ...latest,
            time: formatRelativeTime(latest.created_at),
            read: Boolean(latest.read)
          });
          this.state.lastNotificationId = latest.id;
          this.renderNotifications();
          this.updateBadge(this.state.notifications.filter(n => !n.read).length);
          this.showNewNotificationIndicator();
        }
      }
    } catch (error) {
      console.error('[NOTIFICATION] Failed to check for new notifications:', error);
    }
  }

  showNewNotificationIndicator() {
    if (!this.dom.panel) return;
    this.dom.panel.style.transform = 'scale(1.02)';
    setTimeout(() => {
      if (this.dom.panel) {
        this.dom.panel.style.transform = 'scale(1)';
      }
    }, 200);
  }

  async loadNotifications({ reset = false, showLoading = true } = {}) {
    if (this.state.loading) return;
    if (reset) {
      this.state.page = 0;
      this.state.notifications = [];
      this.state.hasMore = true;
    }
    if (!this.state.hasMore) return;
    this.state.loading = true;
    if (showLoading) {
      this.showLoadingState(true);
    }
    this.hideErrorState();
    try {
      const { notifications, hasMore } = await this.service.fetchNotifications(this.state.page, this.state.limit);
      this.mergeNotifications(notifications, reset);
      this.state.hasMore = hasMore;
      this.state.page += 1;
      if (notifications.length > 0) {
        this.state.lastNotificationId = notifications[0].id;
      }
      this.renderNotifications();
      this.updateShowMoreButton();
      this.updateBadge(this.state.notifications.filter(n => !n.read).length);
      this.state.isFirstLoad = false;
    } catch (error) {
      console.error('[NOTIFICATION] Error loading notifications:', error);
      this.showErrorState();
    } finally {
      this.state.loading = false;
      if (showLoading) {
        this.showLoadingState(false);
      }
    }
  }

  mergeNotifications(newNotifications, reset) {
    if (reset) {
      this.state.notifications = newNotifications;
      return;
    }
    const existingMap = new Map(this.state.notifications.map(n => [n.id, n]));
    const merged = [];
    for (const notification of newNotifications) {
      if (existingMap.has(notification.id)) {
        merged.push(existingMap.get(notification.id));
        existingMap.delete(notification.id);
      } else {
        merged.push(notification);
      }
    }
    merged.push(...existingMap.values());
    this.state.notifications = merged;
  }

  renderNotifications() {
    if (!this.dom.content) return;
    if (this.state.notifications.length === 0) {
      this.dom.content.innerHTML = '<div class="no-notifications">No notifications yet</div>';
      return;
    }
    this.dom.content.innerHTML = this.state.notifications.map((notification, index) => this.renderNotificationItem(notification, index)).join('');
    this.attachItemHandlers();
  }

  renderNotificationItem(notification, index) {
    const priorityClass = notification.priority === 'urgent'
      ? 'notification-urgent'
      : notification.priority === 'warning'
        ? 'notification-warning'
        : '';
    const isNew = index < 3 && !notification.read;
    const linkAttr = notification.link ? `data-link="${notification.link}"` : '';
    const readClass = notification.read ? 'read' : 'unread';
    const clickableClass = notification.read ? '' : 'clickable';
    const readIndicator = notification.read ? '<div class="read-indicator" title="Read">✓</div>' : '';
    const newIndicator = isNew ? '<div class="new-indicator">NEW</div>' : '';
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
        ${notification.read ? readIndicator : '<div class="notification-mark-read" title="Mark as read">✓</div>'}
      </div>
    `;
  }

  attachItemHandlers() {
    this.dom.content?.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', (event) => this.handleNotificationClick(event, item));
    });
  }

  async handleNotificationClick(event, element) {
    event.preventDefault();
    event.stopPropagation();
    const notificationId = element.dataset.id;
    if (!notificationId) {
      console.error('[NOTIFICATION] No notification ID found');
      return;
    }
    const link = element.dataset.link;
    const isRead = element.classList.contains('read');
    if (!isRead) {
      try {
        const response = await this.service.markAsRead(notificationId);
        if (response?.success) {
          element.classList.remove('unread', 'clickable');
          element.classList.add('read');
          element.querySelector('.notification-mark-read')?.remove();
          const readIndicator = document.createElement('div');
          readIndicator.className = 'read-indicator';
          readIndicator.title = 'Read';
          readIndicator.textContent = '✓';
          element.appendChild(readIndicator);
          const notification = this.state.notifications.find(n => n.id === notificationId);
          if (notification) {
            notification.read = true;
          }
          await this.loadUnreadCount();
          if (link) {
            this.closePanel();
            setTimeout(() => {
              window.location.href = link;
            }, 100);
          }
        } else {
          console.error('[NOTIFICATION] Failed to mark as read:', response);
        }
      } catch (error) {
        console.error('[NOTIFICATION] Failed to mark as read:', error);
        showMessage('error', 'Failed to mark notification as read. Please try again.');
      }
    } else if (link) {
      this.closePanel();
      window.location.href = link;
    }
  }

  updateShowMoreButton() {
    if (!this.dom.showMore) return;
    if (!this.state.hasMore) {
      this.dom.showMore.style.display = 'none';
    } else {
      this.dom.showMore.style.display = 'block';
      this.dom.showMore.textContent = this.state.loading ? 'Loading...' : 'Show More';
      this.dom.showMore.disabled = this.state.loading;
    }
  }

  showLoadingState(show) {
    this.dom.loading?.classList.toggle('hidden', !show);
  }

  showErrorState() {
    this.dom.error?.classList.remove('hidden');
  }

  hideErrorState() {
    this.dom.error?.classList.add('hidden');
  }

  async markAllAsRead() {
    if (!this.dom.markAll) return;
    this.dom.markAll.disabled = true;
    this.dom.markAll.style.opacity = '0.5';
    const resetButtonState = () => {
      this.dom.markAll.disabled = false;
      this.dom.markAll.style.opacity = '1';
    };
    try {
      const response = await this.service.markAllRead();
      if (response?.success) {
        this.state.notifications = this.state.notifications.map(notification => ({ ...notification, read: true }));
        this.renderNotifications();
        this.updateBadge(0);
        const originalText = this.dom.markAll.innerHTML;
        this.dom.markAll.innerHTML = '<span style="color: #10b981;">✓ All Read</span>';
        setTimeout(() => {
          if (this.dom.markAll) {
            this.dom.markAll.innerHTML = originalText;
            resetButtonState();
          }
        }, 2000);
      } else {
        throw new Error('Failed to mark all as read');
      }
    } catch (error) {
      console.error('[NOTIFICATION] Failed to mark all as read:', error);
      alert('Failed to mark all notifications as read. Please try again.');
      resetButtonState();
    }
  }

  updateBadge(count = 0) {
    if (!this.dom.badge) {
      this.dom.badge = document.getElementById('notification-badge');
    }
    if (!this.dom.badge) return;
    if (count > 0) {
      this.dom.badge.textContent = count > 99 ? '99+' : count;
      this.dom.badge.classList.remove('hidden');
    } else {
      this.dom.badge.classList.add('hidden');
    }
  }
}

const notificationManager = new NotificationManager(new NotificationService());

export function initializeNotificationButton() {
  notificationManager.initialize();
}

export function closeNotificationPanel() {
  notificationManager.closePanel();
}

export function stopPolling() {
  notificationManager.stopPolling();
}

export function updateNotificationCount(count) {
  notificationManager.updateBadge(count);
}

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

function escapeHtml(text = '') {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

