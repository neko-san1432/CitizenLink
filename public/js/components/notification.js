import apiClient from "../config/apiClient.js";
import { getNotificationIcon } from "../utils/icons.js";
import showMessage from "./toast.js";

class NotificationService {
  async fetchNotifications(page, limit) {
    const response = await apiClient.get(`/api/notifications?limit=${limit}&offset=${page * limit}`);
    if (!response.success) {
      throw new Error("Failed to fetch notifications");
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
    return apiClient.get("/api/notifications/count");
  }

  async markAsRead(notificationId) {
    return apiClient.post(`/api/notifications/${notificationId}/mark-read`, {});
  }

  async markAllRead() {
    return apiClient.post("/api/notifications/mark-all-read", {});
  }
}

class NotificationManager {
  constructor(service) {
    this.service = service;
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 30000; // 30 seconds max delay
    this.state = {
      page: 0,
      limit: 10,
      hasMore: true,
      loading: false,
      notifications: [],
      isFirstLoad: true,
      lastNotificationId: null,
      connected: false
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
    this.connectStream();
  }

  cacheDom() {
    this.dom.button = document.getElementById("notification-btn");
    this.dom.panel = document.getElementById("notification-panel");
    this.dom.close = document.getElementById("close-notifications");
    this.dom.markAll = document.getElementById("mark-all-read");
    this.dom.showMore = document.getElementById("show-more-notifications");
    this.dom.retry = document.getElementById("retry-notifications");
    this.dom.content = document.getElementById("notification-content");
    this.dom.loading = document.getElementById("notification-loading");
    this.dom.error = document.getElementById("notification-error");
    this.dom.badge = document.getElementById("notification-badge");
  }

  bindEvents() {
    this.dom.button?.addEventListener("click", this.handleButtonClick);
    this.dom.close?.addEventListener("click", this.handleCloseClick);
    this.dom.showMore?.addEventListener("click", this.handleShowMoreClick);
    this.dom.retry?.addEventListener("click", this.handleRetryClick);
    this.dom.markAll?.addEventListener("click", this.handleMarkAllClick);
    document.addEventListener("click", this.handleDocumentClick);
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
    const profilePanel = document.getElementById("profile-panel");
    if (profilePanel?.classList.contains("show")) {
      profilePanel.classList.remove("show");
      setTimeout(() => {
        profilePanel.style.display = "none";
      }, 300);
    }
    if (this.dom.panel.classList.contains("show")) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  openPanel() {
    if (!this.dom.panel) return;
    this.dom.panel.style.display = "block";
    this.dom.panel.offsetHeight; // force reflow
    setTimeout(() => {
      this.dom.panel?.classList.add("show");
      // Always reload on open to ensure sync, but don't show full loading spinner if we have data
      const showLoading = this.state.notifications.length === 0;
      this.loadNotifications({ reset: true, showLoading });
    }, 10);
  }

  closePanel() {
    if (!this.dom.panel?.classList.contains("show")) return;
    this.dom.panel.classList.remove("show");
    setTimeout(() => {
      if (this.dom.panel) {
        this.dom.panel.style.display = "none";
      }
    }, 300);
  }

  connectStream() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    // Use relative URL - browser handles cookie automatically
    this.eventSource = new EventSource("/api/notifications/stream");

    this.eventSource.onopen = () => {
      console.log("[NOTIFICATION] Connected to real-time stream");
      this.state.connected = true;
      this.reconnectAttempts = 0;
      this.updateConnectionStatus(true);
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle heartbeat/connection messages
        if (data.type === "connected" || data.type === "ping") {
          return;
        }

        // Handle new notification
        this.handleNewNotification(data);
      } catch (error) {
        console.error("[NOTIFICATION] Error parsing event data:", error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.warn("[NOTIFICATION] Stream connection lost:", error);
      this.state.connected = false;
      this.updateConnectionStatus(false);
      this.eventSource.close();
      this.eventSource = null;
      this.scheduleReconnect();
    };
  }

  scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    console.log(`[NOTIFICATION] Reconnecting in ${delay}ms...`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connectStream();
    }, delay);
  }

  updateConnectionStatus(connected) {
    // Optional: Add visual indicator for connection status
    if (this.dom.button) {
      this.dom.button.style.opacity = connected ? "1" : "0.7";
    }
  }

  handleNewNotification(notification) {
    // Format notification data
    const formatted = {
      ...notification,
      time: formatRelativeTime(notification.created_at),
      read: false
    };

    // Add to local state
    this.state.notifications.unshift(formatted);

    // Update UI
    this.renderNotifications();

    // Update badge count
    const currentCount = parseInt(this.dom.badge?.textContent || "0") || 0;
    this.updateBadge(currentCount + 1);

    // Show toast if panel is closed
    if (!this.dom.panel?.classList.contains("show")) {
      showMessage("info", `New Notification: ${notification.title}`);
      this.showNewNotificationIndicator();
    }
  }

  showNewNotificationIndicator() {
    if (!this.dom.button) return;

    // Add a pulse animation or shake effect
    this.dom.button.classList.add("notification-pulse");
    setTimeout(() => {
      this.dom.button.classList.remove("notification-pulse");
    }, 1000);
  }

  async loadUnreadCount() {
    try {
      const response = await this.service.getUnreadCount();
      if (response?.success) {
        this.updateBadge(response.count);
      }
    } catch (error) {
      console.error("[NOTIFICATION] Failed to load unread count:", error);
    }
  }

  async loadNotifications({ reset = false, showLoading = true } = {}) {
    if (this.state.loading) return;

    if (reset) {
      this.state.page = 0;
      // Don't clear notifications immediately to avoid flash, unless it's first load
      if (this.state.isFirstLoad) {
        this.state.notifications = [];
      }
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

      if (reset) {
        this.state.notifications = notifications;
      } else {
        this.mergeNotifications(notifications);
      }

      this.state.hasMore = hasMore;
      this.state.page += 1;

      if (notifications.length > 0) {
        this.state.lastNotificationId = notifications[0].id;
      }

      this.renderNotifications();
      this.updateShowMoreButton();

      // Update badge based on unread count in fetched items (approximation)
      // Better to rely on loadUnreadCount for accuracy
      this.loadUnreadCount();

      this.state.isFirstLoad = false;
    } catch (error) {
      console.error("[NOTIFICATION] Error loading notifications:", error);
      this.showErrorState();
    } finally {
      this.state.loading = false;
      if (showLoading) {
        this.showLoadingState(false);
      }
    }
  }

  mergeNotifications(newNotifications) {
    const existingMap = new Map(this.state.notifications.map(n => [n.id, n]));

    for (const notification of newNotifications) {
      if (!existingMap.has(notification.id)) {
        this.state.notifications.push(notification);
      }
    }

    // Re-sort by date
    this.state.notifications.sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );
  }

  renderNotifications() {
    if (!this.dom.content) return;

    if (this.state.notifications.length === 0) {
      this.dom.content.innerHTML = '<div class="no-notifications">No notifications yet</div>';
      return;
    }

    this.dom.content.innerHTML = this.state.notifications
      .map((notification, index) => this.renderNotificationItem(notification, index))
      .join("");

    this.attachItemHandlers();
  }

  renderNotificationItem(notification, index) {
    const priorityClass = notification.priority === "urgent"
      ? "notification-urgent"
      : notification.priority === "warning"
        ? "notification-warning"
        : "";

    // Highlight first few if unread
    const isNew = !notification.read && index < 3;
    const linkAttr = notification.link ? `data-link="${notification.link}"` : "";
    const readClass = notification.read ? "read" : "unread";
    const clickableClass = notification.read ? "" : "clickable";
    const readIndicator = notification.read ? '<div class="read-indicator" title="Read">✓</div>' : "";
    const newIndicator = isNew ? '<div class="new-indicator">NEW</div>' : "";

    return `
      <div class="notification-item ${readClass} ${priorityClass} ${isNew ? "new-notification" : ""} ${clickableClass}"
           data-id="${notification.id}"
           ${linkAttr}
           style="cursor: pointer;"
           title="${notification.read ? "Read notification" : "Click to mark as read"}">
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
    this.dom.content?.querySelectorAll(".notification-item").forEach(item => {
      item.addEventListener("click", (event) => this.handleNotificationClick(event, item));
    });
  }

  async handleNotificationClick(event, element) {
    event.preventDefault();
    event.stopPropagation();

    const notificationId = element.dataset.id;
    if (!notificationId) return;

    const {link} = element.dataset;
    const isRead = element.classList.contains("read");

    if (!isRead) {
      try {
        // Optimistic update
        element.classList.remove("unread", "clickable");
        element.classList.add("read");
        element.querySelector(".notification-mark-read")?.remove();

        // Add read indicator
        if (!element.querySelector(".read-indicator")) {
          const readIndicator = document.createElement("div");
          readIndicator.className = "read-indicator";
          readIndicator.title = "Read";
          readIndicator.textContent = "✓";
          element.appendChild(readIndicator);
        }

        // Update local state
        const notification = this.state.notifications.find(n => n.id === notificationId);
        if (notification) {
          notification.read = true;
        }

        // Update badge
        const currentCount = parseInt(this.dom.badge?.textContent || "0") || 0;
        this.updateBadge(Math.max(0, currentCount - 1));

        // API call
        await this.service.markAsRead(notificationId);

        if (link) {
          this.closePanel();
          setTimeout(() => {
            window.location.href = link;
          }, 100);
        }
      } catch (error) {
        console.error("[NOTIFICATION] Failed to mark as read:", error);
        // Revert on error would go here
      }
    } else if (link) {
      this.closePanel();
      window.location.href = link;
    }
  }

  updateShowMoreButton() {
    if (!this.dom.showMore) return;

    if (!this.state.hasMore) {
      this.dom.showMore.style.display = "none";
    } else {
      this.dom.showMore.style.display = "block";
      this.dom.showMore.textContent = this.state.loading ? "Loading..." : "Show More";
      this.dom.showMore.disabled = this.state.loading;
    }
  }

  showLoadingState(show) {
    this.dom.loading?.classList.toggle("hidden", !show);
  }

  showErrorState() {
    this.dom.error?.classList.remove("hidden");
  }

  hideErrorState() {
    this.dom.error?.classList.add("hidden");
  }

  async markAllAsRead() {
    if (!this.dom.markAll) return;

    this.dom.markAll.disabled = true;
    this.dom.markAll.style.opacity = "0.5";

    try {
      const response = await this.service.markAllRead();
      if (response?.success) {
        this.state.notifications.forEach(n => n.read = true);
        this.renderNotifications();
        this.updateBadge(0);

        const originalText = this.dom.markAll.innerHTML;
        this.dom.markAll.innerHTML = '<span style="color: #10b981;">✓ All Read</span>';

        setTimeout(() => {
          if (this.dom.markAll) {
            this.dom.markAll.innerHTML = originalText;
            this.dom.markAll.disabled = false;
            this.dom.markAll.style.opacity = "1";
          }
        }, 2000);
      }
    } catch (error) {
      console.error("[NOTIFICATION] Failed to mark all as read:", error);
      this.dom.markAll.disabled = false;
      this.dom.markAll.style.opacity = "1";
    }
  }

  updateBadge(count = 0) {
    if (!this.dom.badge) {
      this.dom.badge = document.getElementById("notification-badge");
    }
    if (!this.dom.badge) return;

    if (count > 0) {
      this.dom.badge.textContent = count > 99 ? "99+" : count;
      this.dom.badge.classList.remove("hidden");
    } else {
      this.dom.badge.classList.add("hidden");
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

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? "s" : ""} ago`;

  return time.toLocaleDateString();
}

function escapeHtml(text = "") {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

