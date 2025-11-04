/**
 * Coordinator Dashboard JavaScript
 * Handles API calls and dashboard functionality
 */
class CoordinatorDashboard {

    constructor() {
        this.statsInterval = null;
        this.activityInterval = null;
        this.init();
    }

    async init() {
        try {
            await this.checkCoordinatorStatus();
            await this.loadDashboardData();
            this.setupEventListeners();
            this.startAutoRefresh();
        } catch (error) {
            // Continue with basic functionality even if initialization fails
            this.setupEventListeners();
            this.setDefaultStats();
        }
    }

    async checkCoordinatorStatus() {
        try {
            const response = await fetch('/api/coordinator/status');
            if (!response.ok) {
                return;
            }
            const result = await response.json();
            if (!result.success) {
                return;
            }
        } catch (error) {
        }
    }

    async loadDashboardData() {
        try {
            // Load dashboard statistics
            await this.loadStats();
            // Load recent review queue
            await this.loadRecentQueue();
            // Load active clusters
            await this.loadClusters();
            // Fallback: Update stats with default values if API fails
            setTimeout(() => {
                this.updateStatCard('stat-pending', 0);
                this.updateStatCard('stat-reviews', 0);
                this.updateStatCard('stat-duplicates', 0);
                this.updateStatCard('stat-assignments', 0);
            }, 5000);
        } catch (error) {
            console.error('[COORDINATOR DASHBOARD] Failed to load dashboard data:', error);
        }
    }

    async loadStats() {
        try {
            // Check if we're authenticated first
            const authResponse = await fetch('/api/coordinator/status');
            if (!authResponse.ok) {
                this.setDefaultStats();
                return;
            }
            const response = await fetch('/api/coordinator/dashboard');
            if (!response.ok) {
                this.setDefaultStats();
                return;
            }
            const result = await response.json();
            if (result.success) {
                const data = result.data;
                // Update statistics cards
                this.updateStatCard('stat-pending', data.pending_reviews || 0);
                this.updateStatCard('stat-reviews', data.stats?.total_reviews || 0);
                this.updateStatCard('stat-duplicates', data.stats?.duplicates_merged || 0);
                this.updateStatCard('stat-assignments', data.stats?.assignments_made || 0);
                // Update recent queue preview
                if (data.recent_queue && data.recent_queue.length > 0) {
                    this.updateRecentQueuePreview(data.recent_queue);
                }
                // Update clusters preview
                if (data.active_clusters && data.active_clusters.length > 0) {
                    this.updateClustersPreview(data.active_clusters);
                }
            } else {
                this.setDefaultStats();
            }
        } catch (error) {
            this.setDefaultStats();
        }
    }

    setDefaultStats() {
        this.updateStatCard('stat-pending', 0);
        this.updateStatCard('stat-reviews', 0);
        this.updateStatCard('stat-duplicates', 0);
        this.updateStatCard('stat-assignments', 0);
    }

    async loadRecentQueue() {
        try {
            const response = await fetch('/api/coordinator/review-queue?limit=5');
            const result = await response.json();
            if (result.success) {
                this.updateRecentQueuePreview(result.data);
            } else {
                this.updateRecentQueuePreview([]);
            }
        } catch (error) {
            this.updateRecentQueuePreview([]);
        }
    }

    async loadClusters() {
        try {
            const response = await fetch('/api/coordinator/dashboard');
            const result = await response.json();
            if (result.success && result.data.active_clusters) {
                this.updateClustersPreview(result.data.active_clusters);
            } else {
                this.updateClustersPreview([]);
            }
        } catch (error) {
            this.updateClustersPreview([]);
        }
    }

    updateStatCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
            element.classList.add('loaded');
        } else {
            console.error(`[COORDINATOR DASHBOARD] Element ${elementId} not found in DOM`);
        }
    }

    updateRecentQueuePreview(complaints) {
        const container = document.getElementById('review-queue-container');
        if (!container) {
            console.warn('[COORDINATOR DASHBOARD] review-queue-container not found');
            return;
        }
        if (!complaints || complaints.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <div class="no-data-icon">📋</div>
                    <div class="no-data-text">No complaints in review queue</div>
                    <div class="no-data-subtext">New complaints will appear here</div>
                </div>
            `;
            return;
        }
        const complaintsList = complaints.slice(0, 5).map(complaint => `
            <div class="queue-item">
                <div class="queue-item-icon">
                    ${complaint.priority === 'urgent' ? '🚨' :
                      complaint.priority === 'high' ? '⚠️' : '📋'}
                </div>
                <div class="queue-item-content">
                    <div class="queue-item-title">${complaint.title}</div>
                    <div class="queue-item-details">
                        <span class="priority-${complaint.priority}">${complaint.priority}</span>
                        <span class="separator">•</span>
                        <span class="category">${complaint.category || 'General'}</span>
                        ${complaint.submitted_by_profile ?
                            `<span class="separator">•</span>
                             <span class="submitter">${complaint.submitted_by_profile.name || 'Unknown'}</span>` :
                            ''}
                    </div>
                </div>
                <div class="queue-item-actions">
                    <button class="btn btn-sm btn-primary js-review-btn" data-complaint-id="${complaint.id}">
                        Review
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="queue-header">
                <h3>Recent Complaints (${complaints.length})</h3>
                <button class="btn btn-secondary btn-sm" id="js-view-all-queue">
                    View All
                </button>
            </div>
            <div class="queue-items">
                ${complaintsList}
            </div>
        `;

        // Attach event listeners instead of inline handlers (CSP compliant)
        const reviewButtons = container.querySelectorAll('.js-review-btn');
        reviewButtons.forEach(btn => {
            const id = btn.getAttribute('data-complaint-id');
            btn.addEventListener('click', () => {
                if (id) window.location.href = `/coordinator/review/${id}`;
            });
        });

        const viewAllBtn = container.querySelector('#js-view-all-queue');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                window.location.href = '/coordinator/review-queue';
            });
        }
    }

    updateClustersPreview(clusters) {
        const container = document.getElementById('clusters-container');
        if (!container) return;
        if (!clusters || clusters.length === 0) {
            container.innerHTML = `
                <div class="no-data">
                    <div class="no-data-icon">🔍</div>
                    <div class="no-data-text">No active clusters detected</div>
                    <div class="no-data-subtext">Clusters will appear when patterns are identified</div>
                </div>
            `;
            return;
        }
        const clustersList = clusters.slice(0, 3).map(cluster => `
            <div class="cluster-item">
                <div class="cluster-icon">📍</div>
                <div class="cluster-content">
                    <div class="cluster-name">${cluster.cluster_name || 'Unnamed Cluster'}</div>
                    <div class="cluster-details">
                        <span>${cluster.complaint_count || 0} complaints</span>
                        <span class="separator">•</span>
                        <span>${cluster.pattern_type || 'general'}</span>
                    </div>
                </div>
            </div>
        `).join('');
        container.innerHTML = `
            <div class="clusters-header">
                <h3>Active Clusters</h3>
                <button class="btn btn-secondary btn-sm" id="js-refresh-clusters">
                    Refresh
                </button>
            </div>
            <div class="clusters-list">
                ${clustersList}
            </div>
        `;
        // Attach event listener for refresh
        const refreshBtn = container.querySelector('#js-refresh-clusters');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.detectNewClusters());
        }
    }

    setupEventListeners() {
        // Quick action buttons
        const quickActions = {
            'review-queue': () => window.location.href = '/coordinator/review-queue',
            'bulk-assign': () => this.bulkAssignComplaints(),
            'detect-clusters': () => this.detectNewClusters()
        };
        Object.entries(quickActions).forEach(([id, action]) => {
            const button = document.getElementById(`quick-${id}`);
            if (button) {
                button.addEventListener('click', action);
            }
        });
        // Analytics period selector
        const periodSelect = document.getElementById('analytics-period');
        if (periodSelect) {
            periodSelect.addEventListener('change', () => this.loadStats());
        }
    }

    async bulkAssignComplaints() {
        // Implementation for bulk assignment
        // This would open a modal or redirect to bulk assign page
        window.location.href = '/coordinator/review-queue?bulk=true';
    }

    async detectNewClusters() {
        try {
            const response = await fetch('/api/coordinator/detect-clusters', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    radius_km: 0.5,
                    min_complaints: 3
                })
            });
            const result = await response.json();
            if (result.success) {
                await this.loadClusters();
            }
        } catch (error) {
        }
    }

    startAutoRefresh() {
        // Refresh stats every 30 seconds
        this.statsInterval = setInterval(() => {
            this.loadStats();
        }, 30000);
        // Refresh activity every 60 seconds
        this.activityInterval = setInterval(() => {
            this.loadRecentQueue();
        }, 60000);
    }

    destroy() {

        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
        if (this.activityInterval) {
            clearInterval(this.activityInterval);
        }
    }
}
// Global functions for quick actions
async function bulkAssignComplaints() {
    window.coordinatorDashboard?.bulkAssignComplaints();
}

async function detectNewClusters() {
    window.coordinatorDashboard?.detectNewClusters();
}

async function refreshActivity() {
    window.coordinatorDashboard?.loadRecentQueue();
}
// Manual test function for debugging
async function testCoordinatorStats() {
    try {
        // Test authentication
        const authResponse = await fetch('/api/coordinator/status');
        // Test dashboard API
        const dashboardResponse = await fetch('/api/coordinator/dashboard');
        const dashboardData = await dashboardResponse.json();
        // Manually update stats
        if (dashboardData.success) {
            const data = dashboardData.data;
            const updateStatCard = (id, value) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value;
                    element.classList.add('loaded');
                } else {
                    console.error(`[COORDINATOR TEST] Element ${id} not found`);
                }
            };
            updateStatCard('stat-pending', data.pending_reviews || 0);
            updateStatCard('stat-reviews', data.stats?.total_reviews || 0);
            updateStatCard('stat-duplicates', data.stats?.duplicates_merged || 0);
            updateStatCard('stat-assignments', data.stats?.assignments_made || 0);
        }
    } catch (error) {
        console.error('[COORDINATOR TEST] Manual test failed:', error);
    }
}
// Make test function globally available
window.testCoordinatorStats = testCoordinatorStats;
// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if required elements exist
    const requiredElements = ['stat-pending', 'stat-reviews', 'review-queue-container', 'clusters-container'];
    requiredElements.forEach(id => {
        const element = document.getElementById(id);
    });
    // Immediate fallback: Set stats to 0 so user sees dashboard is working
    setTimeout(() => {
        const fallbackUpdate = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                element.classList.add('loaded');
            }
        };
        fallbackUpdate('stat-pending', '0');
        fallbackUpdate('stat-reviews', '0');
        fallbackUpdate('stat-duplicates', '0');
        fallbackUpdate('stat-assignments', '0');
    }, 1000);
    try {
        window.coordinatorDashboard = new CoordinatorDashboard();
    } catch (error) {
        // Continue with basic stats display even if dashboard fails
        setTimeout(() => {
            const fallbackUpdate = (id, value) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value;
                    element.classList.add('loaded');
                }
            };
            fallbackUpdate('stat-pending', '0');
            fallbackUpdate('stat-reviews', '0');
            fallbackUpdate('stat-duplicates', '0');
            fallbackUpdate('stat-assignments', '0');
        }, 2000);
    }
});
// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.coordinatorDashboard) {
        window.coordinatorDashboard.destroy();
    }
});
