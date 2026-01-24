const cron = require('node-cron');
const ReportService = require('./ReportService');
const EmailService = require('./EmailService');
const Database = require('../config/database');

/**
 * SchedulerService
 * Automates daily/weekly/monthly reporting tasks.
 */
class SchedulerService {
    constructor() {
        this.db = Database.getInstance();
        this.supabase = this.db.getClient();
        this.task = null;
    }

    start() {
        console.log('[SCHEDULER] Starting 11:59 PM Daily Job...');

        // Schedule: 11:59 PM every day
        // 59 23 * * *
        this.task = cron.schedule('59 23 * * *', async () => {
            console.log('[SCHEDULER] ⏰ Triggering Daily Reporting Job');
            await this._runReportingJob();
        });
    }

    async _runReportingJob() {
        const today = new Date();
        const isSunday = today.getDay() === 0; // 0 = Sunday
        const isEndOfMonth = this._isEndOfMonth(today);

        // 1. Identify Recipients (Mock: In real app, fetch from settings or user table)
        // We'll send to a configured admin email for now
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

        if (!adminEmail) {
            console.warn('[SCHEDULER] No recipient email configured. Skipping report.');
            return;
        }

        try {
            const reportsToSend = [];

            // A. Daily Report (Always)
            const dailyPDF = await ReportService.generatePDF(
                'executive', 'coordinator',
                this._formatDate(today), this._formatDate(today)
            );
            reportsToSend.push({ filename: `Daily_Report_${this._formatDate(today)}.pdf`, content: dailyPDF });

            // B. Weekly Report (If Sunday)
            if (isSunday) {
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - 6);
                const weeklyPDF = await ReportService.generatePDF(
                    'executive', 'coordinator',
                    this._formatDate(weekStart), this._formatDate(today)
                );
                reportsToSend.push({ filename: `Weekly_Report_${this._formatDate(today)}.pdf`, content: weeklyPDF });
            }

            // C. Monthly Report (If End of Month)
            if (isEndOfMonth) {
                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                const monthlyPDF = await ReportService.generatePDF(
                    'executive', 'coordinator',
                    this._formatDate(monthStart), this._formatDate(today)
                );
                reportsToSend.push({ filename: `Monthly_Report_${this._formatDate(today)}.pdf`, content: monthlyPDF });
            }

            // 2. Send Email
            if (reportsToSend.length > 0) {
                const subject = `CitizenLink Automated Reports - ${this._formatDate(today)}`;
                const html = `
                    <h3>CitizenLink Analytics Report</h3>
                    <p>Attached are the automated reports for ${today.toDateString()}.</p>
                    <ul>
                        ${reportsToSend.map(r => `<li>${r.filename}</li>`).join('')}
                    </ul>
                    <p><em>Generated automatically by CitizenLink Analytics Node.</em></p>
                `;

                await EmailService.sendEmail(adminEmail, subject, html, reportsToSend);
                console.log(`[SCHEDULER] ✅ Sent ${reportsToSend.length} reports to ${adminEmail}`);
            }

        } catch (error) {
            console.error('[SCHEDULER] Job Failed:', error);
        }
    }

    _isEndOfMonth(date) {
        // Check if tomorrow is the 1st of next month
        const tomorrow = new Date(date);
        tomorrow.setDate(date.getDate() + 1);
        return tomorrow.getDate() === 1;
    }

    _formatDate(date) {
        return date.toISOString().split('T')[0];
    }
}

module.exports = new SchedulerService();
