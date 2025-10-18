// Notices Widget Component
class NoticesWidget {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      limit: options.limit || 5,
      showPriority: options.showPriority !== false,
      ...options
    };
    this.notices = [];
  }

  async fetchNotices() {
    try {
      const response = await fetch(`/api/content/notices?limit=${this.options.limit}`);
      const result = await response.json();

      if (result.success) {
        this.notices = result.data;
        this.render();
      } else {
        this.renderError('Failed to load notices');
      }
    } catch (error) {
      console.error('Error fetching notices:', error);
      this.renderError('Failed to load notices');
    }
  }

  render() {
    if (!this.container) return;

    if (this.notices.length === 0) {
      this.container.innerHTML = `
        <div class="notices-widget-empty">
          <p>No active notices at the moment.</p>
        </div>
      `;
      return;
    }

    const noticesHTML = this.notices.map(item => this.renderNoticeItem(item)).join('');

    this.container.innerHTML = `
      <div class="notices-widget">
        <div class="notices-widget-header">
          <h3>📢 Important Notices</h3>
          <a href="/notices" class="view-all-link">View All →</a>
        </div>
        <div class="notices-widget-list">
          ${noticesHTML}
        </div>
      </div>
    `;
  }

  renderNoticeItem(item) {
    const date = new Date(item.valid_from).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const priorityClass = `notice-priority-${item.priority}`;
    const priorityIcon = this.getPriorityIcon(item.priority);

    const priorityHTML = this.options.showPriority
      ? `<span class="notice-item-priority ${priorityClass}">${priorityIcon} ${item.priority.toUpperCase()}</span>`
      : '';

    const typeHTML = item.type
      ? `<span class="notice-item-type">${item.type}</span>`
      : '';

    const validUntilHTML = item.valid_until
      ? `<div class="notice-item-expiry">Valid until: ${new Date(item.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>`
      : '';

    return `
      <div class="notice-item ${priorityClass}" data-id="${item.id}">
        <div class="notice-item-header">
          ${priorityHTML}
          ${typeHTML}
          <span class="notice-item-date">${date}</span>
        </div>
        <h4 class="notice-item-title">${item.title}</h4>
        <p class="notice-item-content">${this.truncateText(item.content, 150)}</p>
        ${validUntilHTML}
        <a href="/notices/${item.id}" class="notice-item-link">Read more →</a>
      </div>
    `;
  }

  getPriorityIcon(priority) {
    const icons = {
      urgent: '🚨',
      high: '⚠️',
      normal: 'ℹ️',
      low: '📝'
    };
    return icons[priority] || 'ℹ️';
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  renderError(message) {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="notices-widget-error">
        <p>⚠️ ${message}</p>
      </div>
    `;
  }

  async init() {
    await this.fetchNotices();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NoticesWidget;
}
