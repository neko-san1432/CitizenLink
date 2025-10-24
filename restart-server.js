// Server Restart Helper
// This script helps restart the server to apply CSP changes

const { spawn } = require('child_process');
const path = require('path');

console.log('🔄 Restarting server to apply CSP changes...');

// Kill any existing server processes
if (process.platform === 'win32') {
  spawn('taskkill', ['/f', '/im', 'node.exe'], { stdio: 'inherit' });
} else {
  spawn('pkill', ['-f', 'node'], { stdio: 'inherit' });
}

// Wait a moment for processes to be killed
setTimeout(() => {
  console.log('✅ Server processes killed');
  console.log('🚀 Starting server with new CSP configuration...');
  
  // Start the server
  const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  server.on('error', (err) => {
    console.error('❌ Failed to start server:', err);
  });
  
  server.on('close', (code) => {
    console.log(`📊 Server process exited with code ${code}`);
  });
  
  console.log('✅ Server restarted with CSP fix!');
  console.log('🔧 CSP now allows reCAPTCHA connections');
  console.log('🌐 Visit http://localhost:3000/login to test');
  
}, 2000);
