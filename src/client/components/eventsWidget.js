// Events Widget Component
class EventsWidget {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      limit: options.limit || 5,
      showImages: options.showImages !== false,
      ...options
    };
    this.events = [];
  }

  async fetchEvents() {
    try {
      const response = await fetch(`/api/content/events?limit=${this.options.limit}`);
      const result = await response.json();

      if (result.success) {
        this.events = result.data;
        this.render();
      } else {
        this.renderError('Failed to load events');
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      this.renderError('Failed to load events');
    }
  }

  render() {
    if (!this.container) return;

    if (this.events.length === 0) {
      this.container.innerHTML = `
        <div class="events-widget-empty">
          <p>No upcoming events at the moment.</p>
        </div>
      `;
      return;
    }

    const eventsHTML = this.events.map(item => this.renderEventItem(item)).join('');

    this.container.innerHTML = `
      <div class="events-widget">
        <div class="events-widget-header">
          <h3>📅 Upcoming Events</h3>
          <a href="/events" class="view-all-link">View All →</a>
        </div>
        <div class="events-widget-list">
          ${eventsHTML}
        </div>
      </div>
    `;
  }

  renderEventItem(item) {
    const eventDate = new Date(item.event_date);
    const month = eventDate.toLocaleDateString('en-US', { month: 'short' });
    const day = eventDate.getDate();
    const time = eventDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const imageHTML = this.options.showImages && item.image_url
      ? `<div class="event-item-image" style="background-image: url('${item.image_url}')"></div>`
      : '';

    const locationHTML = item.location
      ? `<div class="event-item-location">📍 ${item.location}</div>`
      : '';

    const categoryHTML = item.category
      ? `<span class="event-item-category">${item.category}</span>`
      : '';

    return `
      <div class="event-item" data-id="${item.id}">
        <div class="event-item-date-badge">
          <div class="event-date-month">${month}</div>
          <div class="event-date-day">${day}</div>
        </div>
        ${imageHTML}
        <div class="event-item-content">
          <div class="event-item-meta">
            ${categoryHTML}
            <span class="event-item-time">🕐 ${time}</span>
          </div>
          <h4 class="event-item-title">${item.title}</h4>
          <p class="event-item-description">${this.truncateText(item.description, 100)}</p>
          ${locationHTML}
          <a href="/events/${item.id}" class="event-item-link">View Details →</a>
        </div>
      </div>
    `;
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  }

  renderError(message) {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="events-widget-error">
        <p>⚠️ ${message}</p>
      </div>
    `;
  }

  async init() {
    await this.fetchEvents();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventsWidget;
}
