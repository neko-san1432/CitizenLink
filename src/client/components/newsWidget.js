// News Widget Component
class NewsWidget {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      limit: options.limit || 5,
      showImages: options.showImages !== false,
      showExcerpt: options.showExcerpt !== false,
      ...options
    };
    this.news = [];
  }

  async fetchNews() {
    try {
      const response = await fetch(`/api/content/news?limit=${this.options.limit}`);
      const result = await response.json();

      if (result.success) {
        this.news = result.data;
        this.render();
      } else {
        this.renderError('Failed to load news');
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      this.renderError('Failed to load news');
    }
  }

  render() {
    if (!this.container) return;

    if (this.news.length === 0) {
      this.container.innerHTML = `
        <div class="news-widget-empty">
          <p>No news available at the moment.</p>
        </div>
      `;
      return;
    }

    const newsHTML = this.news.map(item => this.renderNewsItem(item)).join('');

    this.container.innerHTML = `
      <div class="news-widget">
        <div class="news-widget-header">
          <h3>📰 Latest News</h3>
          <a href="/news" class="view-all-link">View All →</a>
        </div>
        <div class="news-widget-list">
          ${newsHTML}
        </div>
      </div>
    `;
  }

  renderNewsItem(item) {
    const date = new Date(item.published_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    const imageHTML = this.options.showImages && item.image_url
      ? `<div class="news-item-image" style="background-image: url('${item.image_url}')"></div>`
      : '';

    const excerptHTML = this.options.showExcerpt && item.excerpt
      ? `<p class="news-item-excerpt">${item.excerpt}</p>`
      : '';

    const categoryHTML = item.category
      ? `<span class="news-item-category">${item.category}</span>`
      : '';

    return `
      <div class="news-item" data-id="${item.id}">
        ${imageHTML}
        <div class="news-item-content">
          <div class="news-item-meta">
            ${categoryHTML}
            <span class="news-item-date">${date}</span>
          </div>
          <h4 class="news-item-title">${item.title}</h4>
          ${excerptHTML}
          <a href="/news/${item.id}" class="news-item-link">Read more →</a>
        </div>
      </div>
    `;
  }

  renderError(message) {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="news-widget-error">
        <p>⚠️ ${message}</p>
      </div>
    `;
  }

  async init() {
    await this.fetchNews();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NewsWidget;
}
