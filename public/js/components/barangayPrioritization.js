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
      <div class="bp-empty-container">
        <div class="bp-empty-card">
          <div class="bp-empty-icon-wrapper">
            <svg class="bp-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <h3 class="bp-empty-title">Queue Intelligence Empty</h3>
          <p class="bp-empty-text">No prioritization data available for current reports. Insights will populate as new complaints are analyzed.</p>
        </div>
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
