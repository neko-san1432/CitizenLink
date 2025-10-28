console.log('Node.js is working!');
console.log('Current directory:', process.cwd());
console.log('Testing basic functionality...');

// Check if files exist
const fs = require('fs');
const path = require('path');

console.log('\nChecking files:');
const testFiles = [
  'package.json',
  'src/client/components/comprehensive-violations.js',
  '.eslintrc.js'
];

testFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`  ${file}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
});

console.log('\nTest completed!');
