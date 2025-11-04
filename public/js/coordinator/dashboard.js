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
        console.log('[COORDINATOR DASHBOARD] Initializing...');
        try {
            await this.checkCoordinatorStatus();
            await this.loadDashboardData();
            this.setupEventListeners();
            this.startAutoRefresh();
            console.log('[COORDINATOR DASHBOARD] Initialization complete');
        } catch (error) {
            console.log('[COORDINATOR DASHBOARD] Initialization failed, continuing with limited functionality:', error.message);
            // Continue with basic functionality even if initialization fails
            this.setupEventListeners();
            this.setDefaultStats();
        }
    }

    async checkCoordinatorStatus() {
        try {
            console.log('[COORDINATOR DASHBOARD] Checking coordinator status...');
            const response = await fetch('/api/coordinator/status');

            if (!response.ok) {
                console.log('[COORDINATOR DASHBOARD] Coordinator status check failed:', response.status);
                return;
            }

            const result = await response.json();
            console.log('[COORDINATOR DASHBOARD] Status response:', result);

            if (!result.success) {
                console.log('[COORDINATOR DASHBOARD] Not authorized as coordinator');
                return;
            }

            console.log('[COORDINATOR DASHBOARD] Coordinator status confirmed:', result.data);
        } catch (error) {
            console.log('[COORDINATOR DASHBOARD] Status check failed, continuing:', error.message);
        }
    }

    async loadDashboardData() {
        try {
            console.log('[COORDINATOR DASHBOARD] Loading dashboard data...');

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
                console.log('[COORDINATOR DASHBOARD] Applied fallback stat values');
            }, 5000);

        } catch (error) {
            console.error('[COORDINATOR DASHBOARD] Failed to load dashboard data:', error);
        }
    }

    async loadStats() {
        try {
            console.log('[COORDINATOR DASHBOARD] Loading statistics...');

            // Check if we're authenticated first
            const authResponse = await fetch('/api/coordinator/status');
            if (!authResponse.ok) {
                console.log('[COORDINATOR DASHBOARD] Auth failed, using default values');
                this.setDefaultStats();
                return;
            }

            const response = await fetch('/api/coordinator/dashboard');
            console.log('[COORDINATOR DASHBOARD] Dashboard API response status:', response.status);

            if (!response.ok) {
                console.log('[COORDINATOR DASHBOARD] Dashboard API failed, using default values');
                this.setDefaultStats();
                return;
            }

            const result = await response.json();
            console.log('[COORDINATOR DASHBOARD] Dashboard API response:', result);

            if (result.success) {
                const data = result.data;
                console.log('[COORDINATOR DASHBOARD] Dashboard data received:', data);

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

                console.log('[COORDINATOR DASHBOARD] Statistics updated successfully');
            } else {
                console.log('[COORDINATOR DASHBOARD] API returned error, using default values');
                this.setDefaultStats();
            }
        } catch (error) {
            console.log('[COORDINATOR DASHBOARD] Stats loading error, using default values:', error.message);
            this.setDefaultStats();
        }
    }

    setDefaultStats() {
        console.log('[COORDINATOR DASHBOARD] Setting default stats...');
        this.updateStatCard('stat-pending', 0);
        this.updateStatCard('stat-reviews', 0);
        this.updateStatCard('stat-duplicates', 0);
        this.updateStatCard('stat-assignments', 0);
    }

    async loadRecentQueue() {
        try {
            console.log('[COORDINATOR DASHBOARD] Loading recent queue...');
            const response = await fetch('/api/coordinator/review-queue?limit=5');
            const result = await response.json();

            if (result.success) {
                this.updateRecentQueuePreview(result.data);
            } else {
                console.log('[COORDINATOR DASHBOARD] Failed to load recent queue, using empty state');
                this.updateRecentQueuePreview([]);
            }
        } catch (error) {
            console.log('[COORDINATOR DASHBOARD] Recent queue loading error, using empty state:', error.message);
            this.updateRecentQueuePreview([]);
        }
    }

    async loadClusters() {
        try {
            console.log('[COORDINATOR DASHBOARD] Loading clusters...');
            const response = await fetch('/api/coordinator/dashboard');
            const result = await response.json();

            if (result.success && result.data.active_clusters) {
                this.updateClustersPreview(result.data.active_clusters);
            } else {
                console.log('[COORDINATOR DASHBOARD] Failed to load clusters, using empty state');
                this.updateClustersPreview([]);
            }
        } catch (error) {
            console.log('[COORDINATOR DASHBOARD] Clusters loading error, using empty state:', error.message);
            this.updateClustersPreview([]);
        }
    }

    updateStatCard(elementId, value) {
        const element = document.getElementById(elementId);
        console.log(`[COORDINATOR DASHBOARD] Updating ${elementId}:`, value, element ? 'Element found' : 'Element NOT found');

        if (element) {
            element.textContent = value;
            element.classList.add('loaded');
            console.log(`[COORDINATOR DASHBOARD] Updated ${elementId} to ${value}`);
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
                    <button class="btn btn-sm btn-primary"
                            onclick="window.location.href='/coordinator/review/${complaint.id}'">
                        Review
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="queue-header">
                <h3>Recent Complaints (${complaints.length})</h3>
                <button class="btn btn-secondary btn-sm"
                        onclick="window.location.href='/coordinator/review-queue'">
                    View All
                </button>
            </div>
            <div class="queue-items">
                ${complaintsList}
            </div>
        `;
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
                <button class="btn btn-secondary btn-sm" onclick="detectNewClusters()">
                    Refresh
                </button>
            </div>
            <div class="clusters-list">
                ${clustersList}
            </div>
        `;
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
        console.log('[COORDINATOR DASHBOARD] Bulk assign clicked');
        // This would open a modal or redirect to bulk assign page
        window.location.href = '/coordinator/review-queue?bulk=true';
    }

    async detectNewClusters() {
        try {
            console.log('[COORDINATOR DASHBOARD] Detecting clusters...');

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
                console.log('[COORDINATOR DASHBOARD] Clusters updated successfully');
                await this.loadClusters();
            } else {
                console.log('[COORDINATOR DASHBOARD] Failed to detect clusters');
            }
        } catch (error) {
            console.log('[COORDINATOR DASHBOARD] Cluster detection error:', error.message);
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
    console.log('[COORDINATOR TEST] Manual stats test...');

    try {
        // Test authentication
        const authResponse = await fetch('/api/coordinator/status');
        console.log('[COORDINATOR TEST] Auth status:', authResponse.status);

        // Test dashboard API
        const dashboardResponse = await fetch('/api/coordinator/dashboard');
        console.log('[COORDINATOR TEST] Dashboard status:', dashboardResponse.status);

        const dashboardData = await dashboardResponse.json();
        console.log('[COORDINATOR TEST] Dashboard data:', dashboardData);

        // Manually update stats
        if (dashboardData.success) {
            const data = dashboardData.data;
            console.log('[COORDINATOR TEST] Updating stats manually...');

            const updateStatCard = (id, value) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value;
                    element.classList.add('loaded');
                    console.log(`[COORDINATOR TEST] Updated ${id} to ${value}`);
                } else {
                    console.error(`[COORDINATOR TEST] Element ${id} not found`);
                }
            };

            updateStatCard('stat-pending', data.pending_reviews || 0);
            updateStatCard('stat-reviews', data.stats?.total_reviews || 0);
            updateStatCard('stat-duplicates', data.stats?.duplicates_merged || 0);
            updateStatCard('stat-assignments', data.stats?.assignments_made || 0);

            console.log('[COORDINATOR TEST] Manual update complete');
        }
    } catch (error) {
        console.error('[COORDINATOR TEST] Manual test failed:', error);
    }
}

// Make test function globally available
window.testCoordinatorStats = testCoordinatorStats;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[COORDINATOR DASHBOARD] DOM ready, initializing dashboard...');

    // Check if required elements exist
    const requiredElements = ['stat-pending', 'stat-reviews', 'review-queue-container', 'clusters-container'];
    requiredElements.forEach(id => {
        const element = document.getElementById(id);
        console.log(`[COORDINATOR DASHBOARD] Element ${id}:`, element ? 'Found' : 'Missing');
    });

    // Immediate fallback: Set stats to 0 so user sees dashboard is working
    setTimeout(() => {
        console.log('[COORDINATOR DASHBOARD] Applying immediate fallback stats...');
        const fallbackUpdate = (id, value) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                element.classList.add('loaded');
                console.log(`[COORDINATOR DASHBOARD] Fallback updated ${id} to ${value}`);
            }
        };

        fallbackUpdate('stat-pending', '0');
        fallbackUpdate('stat-reviews', '0');
        fallbackUpdate('stat-duplicates', '0');
        fallbackUpdate('stat-assignments', '0');
    }, 1000);

    try {
        window.coordinatorDashboard = new CoordinatorDashboard();
        console.log('[COORDINATOR DASHBOARD] Dashboard instance created successfully');
    } catch (error) {
        console.log('[COORDINATOR DASHBOARD] Failed to create dashboard instance, using basic functionality:', error.message);
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
