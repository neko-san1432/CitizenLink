// Test file to check if express-rate-limit can be required
try {
  const rateLimit = require('express-rate-limit');
  console.log('✅ express-rate-limit module loaded successfully');
  console.log('Version:', rateLimit.version || 'unknown');
} catch (error) {
  console.error('❌ Error loading express-rate-limit:', error.message);
  process.exit(1);
}
