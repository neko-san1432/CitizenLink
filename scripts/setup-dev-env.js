#!/usr/bin/env node

/**
 * Development Environment Setup
 * Sets up environment variables for development
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up development environment...\n');

// Create .env file if it doesn't exist
const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), '.env.example');

let envContent = '';

// Check if .env already exists
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
  console.log('📄 Found existing .env file');
} else if (fs.existsSync(envExamplePath)) {
  envContent = fs.readFileSync(envExamplePath, 'utf8');
  console.log('📄 Using .env.example as template');
} else {
  console.log('📄 Creating new .env file');
}

// Add or update development settings
const devSettings = [
  'NODE_ENV=development',
  'DISABLE_RATE_LIMITING=true',
  'PORT=3000'
];

let updated = false;

devSettings.forEach(setting => {
  const [key, value] = setting.split('=');
  const regex = new RegExp(`^${key}=.*$`, 'm');
  
  if (regex.test(envContent)) {
    // Update existing setting
    envContent = envContent.replace(regex, setting);
    console.log(`✅ Updated ${key}=${value}`);
    updated = true;
  } else {
    // Add new setting
    envContent += `\n${setting}`;
    console.log(`✅ Added ${key}=${value}`);
    updated = true;
  }
});

if (updated) {
  fs.writeFileSync(envPath, envContent);
  console.log('\n🎉 Development environment configured!');
  console.log('\nRate limiting is now DISABLED for development.');
  console.log('You can now make unlimited requests without hitting rate limits.');
} else {
  console.log('\n✅ Environment already configured correctly.');
}

console.log('\n📋 Available commands:');
console.log('  npm run dev          - Start development server');
console.log('  node scripts/rate-limit-manager.js - Manage rate limits');
console.log('\n🔗 Rate limit management endpoints:');
console.log('  GET  /api/rate-limit/config     - Check if rate limiting is disabled');
console.log('  GET  /api/rate-limit/status/:ip - Check rate limit status for IP');
console.log('  POST /api/rate-limit/clear      - Clear rate limits');
console.log('\n💡 To re-enable rate limiting, set DISABLE_RATE_LIMITING=false in .env');
