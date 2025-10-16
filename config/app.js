const { join } = require('path');

class AppConfig {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.port = process.env.PORT || 3001;
    this.host = process.env.HOST || 'localhost';

    // Paths
    this.rootDir = join(__dirname, '..');
    this.publicDir = join(this.rootDir, 'public');
    this.viewsDir = join(this.rootDir, 'views');
    this.uploadsDir = join(this.rootDir, 'uplaoads');

    // Security (handled by Supabase)
    // Note: JWT and session secrets not needed - using Supabase Auth

    // External Services
    this.supabase = {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
    };

    this.captcha = {
      siteKey: process.env.CAPTCHA_CLIENT_KEY,
      secretKey: process.env.CAPTCHA_SECRET_KEY
    };

    // Application Settings
    this.upload = {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'video/mp4']
    };

    this.pagination = {
      defaultLimit: 20,
      maxLimit: 100
    };

    this.security = {
      bcryptRounds: 12,
      tokenExpiry: '4h',
      cookieMaxAge: 4 * 60 * 60 * 1000 // 4 hours
    };
  }

  get isDevelopment() {
    return this.env === 'development';
  }

  get isProduction() {
    return this.env === 'production';
  }

  get isTest() {
    return this.env === 'test';
  }

  validate() {
    const required = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return true;
  }

  getServerUrl() {
    return `http://${this.host}:${this.port}`;
  }
}

module.exports = new AppConfig();
