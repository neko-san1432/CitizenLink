  require('dotenv').config();
const config = require('./config/app');
const CitizenLinkApp = require('./src/server/app');

// Validate configuration
try {
  config.validate();
  console.log('✅ Configuration validated successfully');
} catch (error) {
  console.error('❌ Configuration error:', error.message);
  process.exit(1);
}

const app = new CitizenLinkApp();
app.start(config.port);
