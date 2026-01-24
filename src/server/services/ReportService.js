const puppeteer = require('puppeteer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const fastCsv = require('fast-csv');
const InsightService = require('./InsightService');

/**
 * ReportService
 * Handles generation of PDF and CSV reports.
 */
class ReportService {
    constructor() {
        this.templateDir = path.join(__dirname, '../../views/reports');
    }

    /**
     * Generate a PDF report.
     * @param {string} type - 'executive' | 'department'
     * @param {string} role - User role
     * @param {string} dateFrom - Start date
     * @param {string} dateTo - End date
     * @param {string} deptId - Department ID (optional)
     * @returns {Promise<Buffer>} PDF Buffer
     */
    async generatePDF(type, role, dateFrom, dateTo, deptId) {
        try {
            console.log(`[REPORT] Generating ${type} PDF...`);

            // 1. Get Data
            // We reuse InsightService to get the stats/charts data
            // In a real app, we might want specific report data fetchers
            const data = await InsightService.getDashboardInsights(role, deptId);

            // Add report metadata
            data.reportDate = new Date().toLocaleDateString();
            data.dateRange = `${dateFrom} to ${dateTo}`;
            data.type = type;

            // 2. Render EJS Template to HTML
            // We need a specific print-friendly template
            const templateName = type === 'executive' ? 'executive-summary.ejs' : 'department-report.ejs';
            const templatePath = path.join(this.templateDir, templateName);

            // Just in case template doesn't exist yet, we'll create it in next step
            // For now, assume it will exist
            const html = await ejs.renderFile(templatePath, data);

            // 3. Launch Puppeteer
            const browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox'] // Safer for server environments
            });
            const page = await browser.newPage();

            // Set content and wait for charts to render (if using Chart.js in the PDF template)
            await page.setContent(html, { waitUntil: 'networkidle0' });

            // Optional: Inject Chart.js logic if the template relies on client-side rendering
            // Converting server-side data to client-side charts in PDF is tricky.
            // Best practice: Render charts on server to images OR use client-side JS in Puppeteer
            // We will use client-side JS in the EJS template which Puppeteer executes.

            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
            });

            await browser.close();
            console.log(`[REPORT] PDF Generated (${pdf.length} bytes)`);
            return pdf;

        } catch (error) {
            console.error('[REPORT] PDF Generation Failed:', error);
            throw error;
        }
    }

    /**
     * Generate CSV Stream.
     * @param {Object} res - Express Response Object to pipe to
     */
    async generateCSV(res, role, deptId) {
        // Fetch raw data (simplified)
        // In real apps, this should stream from DB cursor
        const { data: complaints } = await InsightService._fetchComplaints(role, deptId);

        const csvStream = fastCsv.format({ headers: true });
        csvStream.pipe(res);

        complaints.forEach(c => {
            csvStream.write({
                ID: c.id,
                Date: new Date(c.created_at).toISOString().split('T')[0],
                Category: c.category,
                Subcategory: c.subcategory,
                Barangay: c.location, // simplified
                Status: c.workflow_status,
                Urgency: c.urgency_score
            });
        });

        csvStream.end();
    }
}

module.exports = new ReportService();
