const Database = require('../config/database');
const ClusteringService = require('./ClusteringService');

/**
 * AlertService
 * Generates high-level system alerts based on Clusters and Trends.
 */
class AlertService {
    constructor() {
        this.db = Database.getInstance();
        this.supabase = this.db.getClient();
    }

    /**
     * Generate current system alerts.
     * @returns {Promise<Array>} List of alert objects
     */
    async generateAlerts() {
        try {
            const alerts = [];
            const result = await ClusteringService.generateClusters();
            const { clusters } = result;

            if (!clusters || clusters.length === 0) return [];

            // 1. Cluster-Based Alerts
            clusters.forEach(cluster => {
                const alert = this._analyzeClusterForAlert(cluster);
                if (alert) alerts.push(alert);
            });

            // 2. Trend-Based Alerts (TODO: Implement with InsightService)
            // e.g. "Sudden spike in Flood reports"

            return alerts.sort((a, b) => b.severity - a.severity);
        } catch (error) {
            console.error('[ALERT] Generation failed:', error);
            return [];
        }
    }

    _analyzeClusterForAlert(cluster) {
        // Only alert on significant clusters
        if (cluster.size < 3 && cluster.urgency_avg < 70) return null;

        let severity = 1; // Info
        let title = '';
        let message = '';

        const points = cluster.points || [];
        const uniqueBarangays = [...new Set(points.map(p => this._extractBarangay(p)))];
        const locationStr = uniqueBarangays.join(', ') || 'Unknown Location';

        // HIGH SEVERITY: Life-threatening categories
        if (['Fire', 'Accident', 'Crime'].includes(cluster.category)) {
            severity = 3; // Critical
            title = `CRITICAL: ${cluster.category} Outbreak`;
            message = `${cluster.points.length} confirmed reports of ${cluster.category} in ${locationStr}. Immediate attention required.`;
        }
        // MEDIUM SEVERITY: Infrastructure/Environment
        else if (['Flood', 'Flooding', 'Blackout', 'Landslide'].includes(cluster.category)) {
            severity = 2; // Warning
            title = `WARNING: ${cluster.category} Cluster`;
            message = `Significant clustering of ${cluster.category} reports in ${locationStr} (${cluster.points.length} reports).`;
        }
        // LOW SEVERITY: Maintenance
        else {
            if (cluster.size >= 5) {
                severity = 1; // Notice
                title = `NOTICE: High Volume of ${cluster.category}`;
                message = `${cluster.points.length} reports of ${cluster.category} in ${locationStr}.`;
            } else {
                return null; // Ignore small routine clusters
            }
        }

        return {
            id: `alert_${cluster.id}`,
            type: 'CLUSTER',
            severity, // 1=Info, 2=Warning, 3=Critical
            title,
            message,
            timestamp: new Date(),
            cluster_id: cluster.id,
            coordinates: cluster.center
        };
    }

    _extractBarangay(point) {
        // Try to verify barangay from location string or lat/lng reverse geocode cache
        // For now, simple extraction if available in location text
        if (point.location && typeof point.location === 'string') {
            const match = point.location.match(/Brgy\.?\s*([A-Za-z\s]+)/i);
            if (match) return match[1].trim();
        }
        return 'Vicinity';
    }
}

module.exports = new AlertService();
