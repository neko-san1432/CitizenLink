const nodemailer = require('nodemailer');

/**
 * EmailService
 * Handles sending emails via Gmail SMTP (Free Tier).
 */
class EmailService {
    constructor() {
        this.transporter = null;
        this.initialized = false;
    }

    _init() {
        if (this.initialized) return;

        const user = process.env.EMAIL_USER;
        const pass = process.env.APP_PASSWORD;

        if (!user || !pass) {
            console.warn('[EMAIL] Missing EMAIL_USER or APP_PASSWORD in .env. Email service disabled.');
            return;
        }

        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass }
        });

        this.initialized = true;
        console.log(`[EMAIL] Service initialized for ${user}`);
    }

    /**
     * Send an email with optional attachments.
     * @param {string} to - Recipient email(s)
     * @param {string} subject - Email subject
     * @param {string} html - HTML Content
     * @param {Array} attachments - [{ filename: 'report.pdf', content: Buffer }]
     */
    async sendEmail(to, subject, html, attachments = []) {
        this._init();
        if (!this.transporter) return { success: false, message: 'Email service not configured' };

        try {
            const info = await this.transporter.sendMail({
                from: `"CitizenLink Analytics" <${process.env.EMAIL_USER}>`,
                to,
                subject,
                html,
                attachments
            });

            console.log(`[EMAIL] Sent to ${to} (ID: ${info.messageId})`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('[EMAIL] Send Failed:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailService();
