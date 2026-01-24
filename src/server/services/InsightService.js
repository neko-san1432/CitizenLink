const Database = require('../config/database');
const ClusteringService = require('./ClusteringService');
const AlertService = require('./AlertService');

/**
 * InsightService
 * Aggregates data for dashboard visualizations and role-based analytics.
 */
class InsightService {
    constructor() {
        this.db = Database.getInstance();
        this.supabase = this.db.getClient();
    }

    /**
     * Get aggregated insights for a specific role.
     * @param {string} role - 'coordinator' | 'lgu-admin'
     * @param {string} [deptId] - Required for lgu-admin
     * @returns {Object} Dashboard data payload
     */
    async getDashboardInsights(role, deptId = null) {
        try {
            console.log(`[INSIGHTS] Generating for ${role} ${deptId ? `(${deptId})` : ''}`);

            // 1. Fetch relevant complaints
            const { data: complaints, error } = await this._fetchComplaints(role, deptId);
            if (error) throw error;

            // 2. Fetch Clusters & Alerts (Global for Coordinator, Scoped for LGU?)
            // Clusters are geographic, so they are useful context even for Depts
            const clusterResult = await ClusteringService.generateClusters();
            const alerts = await AlertService.generateAlerts();

            // 3. Generate Statistics
            const stats = this._calculateStatistics(complaints);

            // 4. Generate Descriptive Analysis
            const narrative = this._generateNarrative(stats, clusters, alerts);

            return {
                meta: { generated_at: new Date(), role, deptId },
                narrative,
                stats,
                charts: {
                    trend: this._generateTrendChart(complaints),
                    category: this._generateCategoryChart(complaints),
                    barangay: this._generateBarangayChart(complaints)
                },
                clusters: clusterResult.clusters,
                alerts: alerts
            };

        } catch (error) {
            console.error('[INSIGHTS] Generation failed:', error);
            throw new Error('Failed to generate insights: ' + error.message);
        }
    }

    async _fetchComplaints(role, deptId) {
        let query = this.supabase
            .from('complaints')
            .select('*')
            .neq('workflow_status', 'cancelled'); // Exclude cancelled

        if (role === 'lgu-admin' && deptId) {
            // Join with assignments to filter by department
            // This assumes a relationship or we filter by assigned dept
            // For now, let's assume we filter by assignments table
            // This is complex in Supabase simple query, so we might need two steps
            // Or use the `complaint_assignments` table
            const { data: assignments } = await this.supabase
                .from('complaint_assignments')
                .select('complaint_id')
                .eq('department_id', deptId);

            const ids = assignments?.map(a => a.complaint_id) || [];
            if (ids.length > 0) {
                query = query.in('id', ids);
            } else {
                return { data: [], error: null };
            }
        }

        // Time window: Last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', thirtyDaysAgo);

        return await query;
    }

    _calculateStatistics(complaints) {
        if (!complaints) return {};

        const total = complaints.length;
        const resolved = complaints.filter(c => c.workflow_status === 'closed' || c.workflow_status === 'resolved').length;

        // 5-Tier Breakdown
        const tiers = {
            tier1: complaints.filter(c => c.urgency_score >= 90).length,
            tier2: complaints.filter(c => c.urgency_score >= 70 && c.urgency_score < 90).length,
            tier3: complaints.filter(c => c.urgency_score >= 50 && c.urgency_score < 70).length,
            tier4: complaints.filter(c => c.urgency_score >= 30 && c.urgency_score < 50).length,
            tier5: complaints.filter(c => c.urgency_score < 30).length
        };

        const critical = tiers.tier1 + tiers.tier2; // Life-Threatening + High Priority

        return {
            volume: total,
            critical_count: critical,
            critical_percent: total > 0 ? Math.round((critical / total) * 100) : 0,
            resolution_rate: total > 0 ? Math.round((resolved / total) * 100) : 0,
            tiers // Return raw counts for dashboard
        };
    }

    _generateTrendChart(complaints) {
        // Group by Date (YYYY-MM-DD)
        const counts = {};
        complaints.forEach(c => {
            const date = new Date(c.created_at).toISOString().split('T')[0];
            counts[date] = (counts[date] || 0) + 1;
        });

        // Sort keys
        const labels = Object.keys(counts).sort();
        const data = labels.map(d => counts[d]);

        return { labels, data };
    }

    _generateCategoryChart(complaints) {
        const counts = {};
        complaints.forEach(c => {
            const cat = c.category || 'Others';
            counts[cat] = (counts[cat] || 0) + 1;
        });

        // Sort descending
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5); // Top 5
        return {
            labels: sorted.map(s => s[0]),
            data: sorted.map(s => s[1])
        };
    }

    _generateBarangayChart(complaints) {
        // Simple regex extraction if barangay field is missing
        const counts = {};
        complaints.forEach(c => {
            let brgy = 'Unknown';
            if (typeof c.location === 'string') {
                const match = c.location.match(/Brgy\.?\s*([A-Za-z\s]+)/i);
                if (match) brgy = match[1].trim();
            }
            counts[brgy] = (counts[brgy] || 0) + 1;
        });

        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        return {
            labels: sorted.map(s => s[0]),
            data: sorted.map(s => s[1])
        };
    }

    _generateNarrative(stats, clusters, alerts) {
        // Simple Template-Based Narrative Generation
        const parts = [];

        // 1. Volume
        parts.push(`In the last 30 days, we received **${stats.volume} complaints**, with a **${stats.resolution_rate}% resolution rate**.`);

        // 2. Criticality
        if (stats.critical_percent > 20) {
            parts.push(`⚠️ **High Criticality Detected**: ${stats.critical_percent}% of reports are flagged as critical emergencies.`);
        }

        // 3. Clusters
        if (clusters && clusters.length > 0) {
            const topCluster = clusters[0];
            parts.push(`📍 **Hotspot Alert**: Significant clustering of **${topCluster.category}** reports detected in the vicinity of **Digos City** (${topCluster.size} reports).`);
        } else {
            parts.push(`✅ No major geographic clusters detected at this time.`);
        }

        return parts.join(' ');
    }
}

module.exports = new InsightService();
