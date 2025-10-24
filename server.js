 require('dotenv').config();

console.log('🚀 Starting CitizenLink Server...');

// Set development mode if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
  console.log('📝 NODE_ENV set to development');
}

console.log('🔧 Loading configuration...');
const config = require('./config/app');

console.log('✅ Configuration loaded');

// Validate configuration
console.log('🔍 Validating configuration...');
try {
  config.validate();
  console.log('✅ Configuration validated successfully');
  console.log('📊 Config details:', {
    env: config.env,
    port: config.port,
    supabaseConfigured: !!(config.supabase.url && config.supabase.anonKey)
  });
} catch (error) {
  console.error('❌ Configuration error:', error.message);
  console.error('🔧 Required environment variables:', [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]);
  process.exit(1);
}

console.log('🏗️  Initializing CitizenLink application...');
const CitizenLinkApp = require('./src/server/app');

const app = new CitizenLinkApp();

console.log('🔄 Starting server on port', config.port);
app.start(config.port).catch(error => {
  console.error('💥 Failed to start server:', error);
  process.exit(1);
});
