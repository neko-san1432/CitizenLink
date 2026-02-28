/**
 * Barangay Prioritization Component
 * Displays 3 bar graphs: Volume, Urgency, Recency
 */
export default class BarangayPrioritization {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.insightsData = null;
  }

  async loadInsights() {
    try {
      const response = await fetch("/api/coordinator/barangay-insights", {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) throw new Error("Failed to load insights");

      const result = await response.json();
      if (result.success && result.data?.barangays) {
        this.insightsData = result.data;
        this.render();
      } else {
        this.renderEmpty();
      }

      return this.insightsData;
    } catch (error) {
      console.error("Error loading barangay insights:", error);
      this.renderError();
      return null;
    }
  }

  render() {
    if (!this.container || !this.insightsData?.barangays?.length) {
      this.renderEmpty();
      return;
    }

    const {barangays} = this.insightsData;

    this.container.innerHTML = `
      <div class="bp-widget">
        ${this.renderGraph("Volume", barangays, "volumeScore", "var(--primary-500, #3b82f6)")}
        ${this.renderGraph("Urgency", barangays, "urgencyScore", "var(--error-500, #ef4444)")}
        ${this.renderGraph("Recency", barangays, "recencyScore", "var(--success-500, #10b981)")}
      </div>
    `;
  }

  renderGraph(title, barangays, scoreKey, color) {
    const topItems = barangays.slice(0, 5);

    return `
      <div class="bp-graph-section">
        <h4 class="bp-graph-title">${title}</h4>
        <div class="bp-bar-list">
          ${topItems.map(b => `
            <div class="bp-bar-item">
              <div class="bp-bar-label">${this.truncateName(b.name)}</div>
              <div class="bp-bar-track">
                <div class="bp-bar-fill" style="width: ${b[scoreKey]}%; background: ${color};"></div>
              </div>
              <div class="bp-bar-value">${b[scoreKey]}%</div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  truncateName(name) {
    // Shorten long barangay names
    if (name.length > 12) {
      return `${name.substring(0, 10)  }…`;
    }
    return name;
  }

  renderEmpty() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="bp-empty">
        <svg class="bp-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
        </svg>
        <p>No prioritization data available</p>
      </div>
    `;
  }

  renderError() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="bp-error">
        <p>Failed to load insights</p>
        <button class="bp-retry-btn" onclick="this.closest('.bp-error').parentElement.__bpInstance?.loadInsights()">
          Retry
        </button>
      </div>
    `;
    this.container.__bpInstance = this;
  }
}
