
/**
 * General Application Configuration
 */

module.exports = {
    // Feature Flags
    features: {
        duplicateDetection: true,
        nlpClassification: true, // Assuming we want this on too
        emailNotifications: process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true',
    },

    // App Info
    name: 'DRIMS',
    version: '1.0.0',
    env: process.env.NODE_ENV || 'development',

    // Limits
    uploads: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
    }
};
