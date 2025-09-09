import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting deployment process...\n');

// Step 1: Install dependencies
console.log('📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit', cwd: __dirname });
  console.log('✅ Dependencies installed successfully\n');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Step 2: Run pre-compression build
console.log('🗜️  Running pre-compression build...');
try {
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  console.log('✅ Pre-compression build completed successfully\n');
} catch (error) {
  console.error('❌ Failed to run pre-compression build:', error.message);
  process.exit(1);
}

// Step 3: Verify compressed files exist
console.log('🔍 Verifying compressed files...');
const filesToCheck = [
  'index.html.gz',
  'css/styles.css.gz',
  'js/main.js.gz',
  'citizen/dashboard.html.gz',
  'lgu/dashboard.html.gz'
];

let verifiedCount = 0;
for (const file of filesToCheck) {
  const filePath = join(__dirname, file);
  if (existsSync(filePath)) {
    console.log(`✅ Found: ${file}`);
    verifiedCount++;
  } else {
    console.log(`⚠️  Missing: ${file}`);
  }
}

console.log(`\n📊 Verification complete: ${verifiedCount}/${filesToCheck.length} expected files found`);

// Step 4: Start server
console.log('\n🌐 Starting server...');
console.log('💡 The server will now serve pre-compressed files for better performance!');
console.log('🔗 Server will be available at: http://localhost:3000\n');

try {
  execSync('npm start', { stdio: 'inherit', cwd: __dirname });
} catch (error) {
  console.error('❌ Failed to start server:', error.message);
  process.exit(1);
}
