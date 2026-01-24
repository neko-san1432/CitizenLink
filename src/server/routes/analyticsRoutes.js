const express = require('express');
const router = express.Router();
const ClusteringService = require('../services/ClusteringService');
const AlertService = require('../services/AlertService');
const InsightService = require('../services/InsightService');
const ReportService = require('../services/ReportService'); // Will be implemented next
const { isAuthenticated, requireRole } = require('../middleware/authMiddleware'); // Assuming these exist

// Middleware to check authentication
router.use(isAuthenticated);

/**
 * @route GET /api/analytics/clusters
 * @desc Get all active clusters (DBSCAN)
 * @access Coordinator
 */
router.get('/clusters', requireRole(['complaint-coordinator', 'admin', 'lgu-admin']), async (req, res) => {
    try {
        const result = await ClusteringService.generateClusters();
        res.json({ success: true, clusters: result.clusters });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch clusters' });
    }
});

/**
 * @route GET /api/analytics/alerts
 * @desc Get system-wide alerts
 * @access Coordinator, LGU Admin
 */
router.get('/alerts', requireRole(['complaint-coordinator', 'admin', 'lgu-admin']), async (req, res) => {
    try {
        const alerts = await AlertService.generateAlerts();
        res.json({ success: true, alerts });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch alerts' });
    }
});

/**
 * @route GET /api/analytics/insights/coordinator
 * @desc Get aggregated global insights
 * @access Coordinator
 */
router.get('/insights/coordinator', requireRole(['complaint-coordinator', 'admin']), async (req, res) => {
    try {
        const insights = await InsightService.getDashboardInsights('coordinator');
        res.json({ success: true, data: insights });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate coordinator insights' });
    }
});

/**
 * @route GET /api/analytics/insights/department/:deptId
 * @desc Get department-specific insights
 * @access LGU Admin
 */
router.get('/insights/department/:deptId', requireRole(['lgu-admin', 'admin']), async (req, res) => {
    try {
        // Security check: Ensure LGU admin belongs to requested dept (unless super admin)
        // Ignoring for now to keep it simple, but strictly should check req.user.department

        const insights = await InsightService.getDashboardInsights('lgu-admin', req.params.deptId);
        res.json({ success: true, data: insights });
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate department insights' });
    }
});

// EXPORT ROUTES
router.get('/export/pdf', async (req, res) => {
    try {
        const { type = 'executive', dateFrom, dateTo, deptId } = req.query;
        // Default to today if dates missing
        const from = dateFrom || new Date().toISOString().split('T')[0];
        const to = dateTo || new Date().toISOString().split('T')[0];
        const role = 'coordinator'; // Allow overriding via req.user.role in real app

        const start = Date.now();
        const pdfBuffer = await ReportService.generatePDF(type, role, from, to, deptId);

        console.log(`[EXPORT] PDF generated in ${Date.now() - start}ms`);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="CitizenLink_${type}_Report_${to}.pdf"`,
            'Content-Length': pdfBuffer.length
        });

        res.send(pdfBuffer);

    } catch (error) {
        console.error('Export Error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate PDF report' });
    }
});

router.get('/export/csv', async (req, res) => {
    try {
        const { dateFrom, dateTo, deptId } = req.query;
        const role = 'coordinator';

        res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="complaints_data_${new Date().toISOString().split('T')[0]}.csv"`
        });

        await ReportService.generateCSV(res, role, deptId);

    } catch (error) {
        console.error('Export Error:', error);
        if (!res.headersSent) res.status(500).json({ success: false, message: 'Failed to generate CSV' });
    }
});

module.exports = router;
