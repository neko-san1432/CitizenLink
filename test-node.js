console.log('Testing Node.js execution...');
console.log('Current directory:', process.cwd());
console.log('Node version:', process.version);
try {
  const config = require('./config/app');
  console.log('Config loaded successfully');
} catch (error) {
  console.error('Config load error:', error.message);
}
console.log('Test completed');
