
const http = require('http');

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

const checkEndpoint = (path, name) => {
  return new Promise((resolve, reject) => {
    http.get(`${BASE_URL}${path}`, (res) => {
      const { statusCode } = res;
      if (statusCode >= 200 && statusCode < 400) {
        console.log(`✅ [PASS] ${name} (${path}): Status ${statusCode}`);
        resolve(true);
      } else {
        console.error(`❌ [FAIL] ${name} (${path}): Status ${statusCode}`);
        resolve(false);
      }
    }).on('error', (e) => {
      console.error(`❌ [FAIL] ${name} (${path}): Connection Error: ${e.code} - ${e.message}`);
      resolve(false);
    });
  });
};

const runHealthCheck = async () => {
  console.log(`Starting Health Check against ${BASE_URL}...\n`);
  
  const results = await Promise.all([
    checkEndpoint('/', 'Home Page'),
    checkEndpoint('/api/health', 'API Health'), // Assuming this exists, or we check a known static asset
    checkEndpoint('/login', 'Login Page'),
    checkEndpoint('/signup', 'Signup Page')
  ]);

  const allPassed = results.every(r => r);
  console.log('\n--------------------------------------------------');
  if (allPassed) {
    console.log('🚀 SYSTEM STATUS: OPERATIONAL');
    process.exit(0);
  } else {
    console.log('⚠️ SYSTEM STATUS: ISSUES DETECTED');
    process.exit(1);
  }
};

runHealthCheck();
