/**
 * Barangay Prioritization Component
 * Reusable component for displaying barangay prioritization ranking
 */
class BarangayPrioritization {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.currentSortOrder = options.sortOrder || "desc";
    this.currentPeriod = options.period || "weekly";
    this.insightsData = null;
    this.onBarangayClick = options.onBarangayClick || null;
    this.filters = {
      priority: "",
      frequency: "",
      search: ""
    };
  }

  async loadInsights() {
    try {
      const response = await fetch(`/api/coordinator/insights?period=${this.currentPeriod}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to load insights");
      }

      this.insightsData = result.data;
      this.render();
      return this.insightsData;
    } catch (error) {
      console.error("[BARANGAY_PRIORITIZATION] Load error:", error);
      this.showError(error.message || "Failed to load barangay prioritization");
      return null;
    }
  }

  render() {
    if (!this.insightsData) return;

    const container = document.getElementById(this.containerId);
    if (!container) return;

    let barangays = [...this.insightsData.barangays];

    // Apply filters
    barangays = this.applyFilters(barangays);

    // Sort based on current sort order
    if (this.currentSortOrder === "asc") {
      barangays.sort((a, b) => a.prioritizationScore - b.prioritizationScore);
    } else {
      barangays.sort((a, b) => b.prioritizationScore - a.prioritizationScore);
    }

    const periodLabel = this.getPeriodLabel(this.currentPeriod);
    const startDate = new Date(this.insightsData.startDate).toLocaleDateString();
    const endDate = new Date(this.insightsData.endDate).toLocaleDateString();

    container.innerHTML = `
      <div class="barangay-prioritization-header">
        <div>
          <h3>📊 Barangay Prioritization Ranking</h3>
          <p class="prioritization-period">${periodLabel} (${startDate} - ${endDate})</p>
        </div>
        <div class="prioritization-filters">
          <div class="filter-group">
            <label for="prioritization-search-${this.containerId}">Search:</label>
            <input type="text" id="prioritization-search-${this.containerId}" class="filter-input" 
                   placeholder="Search barangay..." value="${this.escapeHtml(this.filters.search)}">
          </div>
          <div class="filter-group">
            <label for="prioritization-priority-${this.containerId}">Priority:</label>
            <select id="prioritization-priority-${this.containerId}" class="filter-select">
              <option value="">All Priorities</option>
              <option value="critical" ${this.filters.priority === "critical" ? "selected" : ""}>Critical</option>
              <option value="high" ${this.filters.priority === "high" ? "selected" : ""}>High</option>
              <option value="medium" ${this.filters.priority === "medium" ? "selected" : ""}>Medium</option>
              <option value="low" ${this.filters.priority === "low" ? "selected" : ""}>Low</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="prioritization-frequency-${this.containerId}">Frequency:</label>
            <select id="prioritization-frequency-${this.containerId}" class="filter-select">
              <option value="">All Frequencies</option>
              <option value="high" ${this.filters.frequency === "high" ? "selected" : ""}>High</option>
              <option value="medium" ${this.filters.frequency === "medium" ? "selected" : ""}>Medium</option>
              <option value="low" ${this.filters.frequency === "low" ? "selected" : ""}>Low</option>
            </select>
          </div>
          <div class="filter-group">
            <label for="prioritization-sort-${this.containerId}">Sort:</label>
            <select id="prioritization-sort-${this.containerId}" class="filter-select">
              <option value="desc" ${this.currentSortOrder === "desc" ? "selected" : ""}>Highest First</option>
              <option value="asc" ${this.currentSortOrder === "asc" ? "selected" : ""}>Lowest First</option>
            </select>
          </div>
        </div>
      </div>
      <div class="barangay-ranking-list">
        ${barangays.length > 0
    ? barangays.map((barangay, index) => this.renderBarangayCard(barangay, index + 1)).join("")
    : '<div class="no-results">No barangays match the current filters.</div>'
}
      </div>
    `;

    // Attach event listeners
    this.attachListeners();
  }

  applyFilters(barangays) {
    return barangays.filter(barangay => {
      // Search filter
      if (this.filters.search) {
        const searchTerm = this.filters.search.toLowerCase();
        if (!barangay.barangay.toLowerCase().includes(searchTerm)) {
          return false;
        }
      }

      // Priority filter
      if (this.filters.priority) {
        const priorityLevel = this.getPriorityLevel(barangay.prioritizationScore);
        if (priorityLevel !== this.filters.priority) {
          return false;
        }
      }

      // Frequency filter
      if (this.filters.frequency) {
        if (barangay.frequencyLevel !== this.filters.frequency) {
          return false;
        }
      }

      return true;
    });
  }

  attachListeners() {
    // Search filter
    const searchInput = document.getElementById(`prioritization-search-${this.containerId}`);
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.filters.search = e.target.value;
        this.render();
      });
    }

    // Priority filter
    const prioritySelect = document.getElementById(`prioritization-priority-${this.containerId}`);
    if (prioritySelect) {
      prioritySelect.addEventListener("change", (e) => {
        this.filters.priority = e.target.value;
        this.render();
      });
    }

    // Frequency filter
    const frequencySelect = document.getElementById(`prioritization-frequency-${this.containerId}`);
    if (frequencySelect) {
      frequencySelect.addEventListener("change", (e) => {
        this.filters.frequency = e.target.value;
        this.render();
      });
    }

    // Sort order change
    const sortSelect = document.getElementById(`prioritization-sort-${this.containerId}`);
    if (sortSelect) {
      sortSelect.addEventListener("change", (e) => {
        this.currentSortOrder = e.target.value;
        this.render();
      });
    }

    // Collapsible details toggle
    document.querySelectorAll(`#${this.containerId} .barangay-card-toggle`).forEach(toggle => {
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        const card = toggle.closest(".barangay-card");
        const details = card.querySelector(".barangay-card-details");
        const isExpanded = card.classList.contains("expanded");

        if (isExpanded) {
          card.classList.remove("expanded");
          details.style.maxHeight = "0";
        } else {
          card.classList.add("expanded");
          details.style.maxHeight = `${details.scrollHeight  }px`;
        }
      });
    });
  }

  renderBarangayCard(barangay, displayRank) {
    const priorityLevel = this.getPriorityLevel(barangay.prioritizationScore);
    const priorityClass = `priority-${priorityLevel}`;
    const stats = this.insightsData.statistics || {};
    const thresholds = stats.frequencyThresholds || {};

    return `
      <div class="barangay-card ${priorityClass}" data-barangay="${this.escapeHtml(barangay.barangay)}" data-rank="${displayRank}">
        <div class="barangay-card-header">
          <div class="barangay-rank">
            <span class="rank-number">#${displayRank}</span>
          </div>
          <div class="barangay-info">
            <h4 class="barangay-name">${this.escapeHtml(barangay.barangay)}</h4>
            <div class="barangay-metrics">
              <div class="metric">
                <span class="metric-label">Complaints:</span>
                <span class="metric-value">${barangay.complaintCount}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Clusters:</span>
                <span class="metric-value">${barangay.clusterCount}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Urgent:</span>
                <span class="metric-value urgent">${barangay.urgentCount}</span>
              </div>
              <div class="metric">
                <span class="metric-label">High Priority:</span>
                <span class="metric-value high">${barangay.highPriorityCount}</span>
              </div>
            </div>
          </div>
          <div class="barangay-score">
            <div class="score-label">Priority Score</div>
            <div class="score-value">${barangay.prioritizationScore}</div>
            <div class="priority-badge ${priorityClass}">${priorityLevel.toUpperCase()}</div>
          </div>
          <button class="barangay-card-toggle" aria-label="Toggle details">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 9l6 6 6-6"></path>
            </svg>
          </button>
        </div>
        <div class="barangay-card-details">
          <div class="details-section">
            <h5>Prioritization Criteria</h5>
            <div class="criteria-grid">
              <div class="criterion-card">
                <div class="criterion-label">Average Complaints</div>
                <div class="criterion-value">${stats.averageComplaints || 0}</div>
                <div class="criterion-barangay">
                  <span class="barangay-count">${barangay.complaintCount}</span>
                  <span class="barangay-status ${barangay.complaintCount >= stats.averageComplaints ? "above" : "below"}">
                    ${barangay.complaintCount >= stats.averageComplaints ? "Above Average" : "Below Average"}
                  </span>
                </div>
              </div>
              <div class="criterion-card">
                <div class="criterion-label">Low Frequency Threshold</div>
                <div class="criterion-value">${thresholds.low || 0}</div>
                <div class="criterion-barangay">
                  <span class="barangay-count">${barangay.complaintCount}</span>
                  <span class="barangay-status ${barangay.complaintCount <= thresholds.low ? "low-freq" : ""}">
                    ${barangay.complaintCount <= thresholds.low ? "Low Frequency" : "Above Low Threshold"}
                  </span>
                </div>
              </div>
              <div class="criterion-card">
                <div class="criterion-label">Medium Frequency Threshold</div>
                <div class="criterion-value">${thresholds.medium || 0}</div>
                <div class="criterion-barangay">
                  <span class="barangay-count">${barangay.complaintCount}</span>
                  <span class="barangay-status ${barangay.complaintCount > thresholds.low && barangay.complaintCount <= thresholds.medium ? "medium-freq" : ""}">
                    ${barangay.complaintCount > thresholds.low && barangay.complaintCount <= thresholds.medium ? "Medium Frequency" : barangay.complaintCount > thresholds.medium ? "Above Medium" : "Below Medium"}
                  </span>
                </div>
              </div>
              <div class="criterion-card">
                <div class="criterion-label">High Frequency Threshold</div>
                <div class="criterion-value">${thresholds.high || 0}</div>
                <div class="criterion-barangay">
                  <span class="barangay-count">${barangay.complaintCount}</span>
                  <span class="barangay-status ${barangay.complaintCount >= thresholds.high ? "high-freq" : ""}">
                    ${barangay.complaintCount >= thresholds.high ? "High Frequency" : "Below High Threshold"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="details-section">
            <h5>Supporting Data</h5>
            <div class="supporting-data">
              <div class="data-item">
                <span class="data-label">Total Complaints:</span>
                <span class="data-value">${barangay.complaintCount}</span>
              </div>
              <div class="data-item">
                <span class="data-label">Clusters:</span>
                <span class="data-value">${barangay.clusterCount}</span>
              </div>
              <div class="data-item">
                <span class="data-label">Urgent Complaints:</span>
                <span class="data-value urgent">${barangay.urgentCount}</span>
              </div>
              <div class="data-item">
                <span class="data-label">High Priority:</span>
                <span class="data-value high">${barangay.highPriorityCount}</span>
              </div>
              <div class="data-item">
                <span class="data-label">Frequency Level:</span>
                <span class="data-value frequency-${barangay.frequencyLevel || "low"}">${(barangay.frequencyLevel || "low").toUpperCase()}</span>
              </div>
              <div class="data-item">
                <span class="data-label">Prioritization Score:</span>
                <span class="data-value score">${barangay.prioritizationScore}</span>
              </div>
            </div>
          </div>
          <div class="details-section">
            <h5>Average Complaints by Period</h5>
            <div class="supporting-data">
              <div class="data-item">
                <span class="data-label">Daily Average:</span>
                <span class="data-value">${(barangay.averages?.daily || 0).toFixed(2)}</span>
                <span class="data-unit">complaints/day</span>
              </div>
              <div class="data-item">
                <span class="data-label">Weekly Average:</span>
                <span class="data-value">${(barangay.averages?.weekly || 0).toFixed(2)}</span>
                <span class="data-unit">complaints/week</span>
              </div>
              <div class="data-item">
                <span class="data-label">Monthly Average:</span>
                <span class="data-value">${(barangay.averages?.monthly || 0).toFixed(2)}</span>
                <span class="data-unit">complaints/month</span>
              </div>
              <div class="data-item">
                <span class="data-label">Yearly Average:</span>
                <span class="data-value">${(barangay.averages?.yearly || 0).toFixed(2)}</span>
                <span class="data-unit">complaints/year</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  getPriorityLevel(score) {
    if (score >= 50) return "critical";
    if (score >= 30) return "high";
    if (score >= 15) return "medium";
    return "low";
  }

  getPeriodLabel(period) {
    const labels = {
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      yearly: "Yearly"
    };
    return labels[period] || "Weekly";
  }

  showError(message) {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.innerHTML = `
        <div class="error-state">
          <p>❌ ${this.escapeHtml(message)}</p>
        </div>
      `;
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

export default BarangayPrioritization;

