const axios = require('axios');
const fs = require('fs');

// Test configuration
const BASE_URL = 'http://localhost:3000';

// Test users credentials
const TEST_USERS = {
  citizen: {
    email: 'citizen1@email.com',
    password: '12345678'
  },
  admin: {
    email: 'pnpadmin@gmail.com',
    password: 'password123'
  }
};

// Store session tokens
let authTokens = {};

// Helper function to format table output
function formatTable(results) {
  console.log('\n' + '='.repeat(120));
  console.log('TEST EXECUTION REPORT');
  console.log('='.repeat(120));
  console.log(`${'Test Case'.padEnd(15)} | ${'Scenario'.padEnd(30)} | ${'Input'.padEnd(25)} | ${'Expected Result'.padEnd(30)} | ${'Status'.padEnd(10)}`);
  console.log('-'.repeat(120));
  
  results.forEach(test => {
    const scenario = test.scenario || '';
    const input = test.input || '';
    const expected = test.expected || '';
    const status = test.status;
    
    console.log(`${test.id.padEnd(15)} | ${scenario.substring(0, 29).padEnd(30)} | ${input.substring(0, 24).padEnd(25)} | ${expected.substring(0, 29).padEnd(30)} | ${status}`);
  });
  
  console.log('='.repeat(120));
  const passed = results.filter(t => t.status === '✅ Pass').length;
  const failed = results.filter(t => t.status === '❌ Fail').length;
  console.log(`Total Tests: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(120));
}

// Authenticate a user
async function authenticateUser(userType) {
  try {
    const credentials = TEST_USERS[userType];
    
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: credentials.email,
      password: credentials.password
    });
    
    if (response.data.access_token) {
      authTokens[userType] = response.data.access_token;
      return response.data.access_token;
    }
    
    // Try alternative Supabase auth endpoint
    const supabaseResponse = await axios.post(`${BASE_URL}/api/supabase/config`, {});
    
    return null;
  } catch (error) {
    console.error(`Authentication failed for ${userType}:`, error.message);
    return null;
  }
}

// Check if server is running
async function checkServerHealth() {
  try {
    const response = await axios.get(`${BASE_URL}/api/health`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Test runner function
async function runTests() {
  console.log('\n🧪 Starting Test Execution Suite...');
  console.log('📡 Checking server connection...');
  
  const serverRunning = await checkServerHealth();
  
  if (!serverRunning) {
    console.error('❌ Server is not running or not accessible on', BASE_URL);
    console.error('Please start the server with: npm start');
    process.exit(1);
  }
  
  console.log('✅ Server is running\n');
  
  const testResults = [];
  
  try {
    // TC-001: Valid User Login (Citizen)
    console.log('Running TC-001: Valid Citizen Login...');
    try {
      const tc001 = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: TEST_USERS.citizen.email,
        password: TEST_USERS.citizen.password
      });
      
      const isSuccess = tc001.status === 200 || tc001.status === 201;
      const hasToken = tc001.data?.access_token || tc001.data?.token;
      
      testResults.push({
        id: 'TC-001',
        scenario: 'Valid citizen credentials',
        input: `${TEST_USERS.citizen.email} / ${TEST_USERS.citizen.password}`,
        expected: 'Citizen Dashboard loads',
        actual: `Status: ${tc001.status}, Token: ${hasToken ? 'Present' : 'Missing'}`,
        status: (isSuccess && hasToken) ? '✅ Pass' : '❌ Fail'
      });
      
      if (hasToken) authTokens.citizen = tc001.data.access_token || tc001.data.token;
    } catch (error) {
      testResults.push({
        id: 'TC-001',
        scenario: 'Valid citizen credentials',
        input: `${TEST_USERS.citizen.email} / ${TEST_USERS.citizen.password}`,
        expected: 'Citizen Dashboard loads',
        actual: `Error: ${error.message}`,
        status: '❌ Fail'
      });
    }
    
    // TC-002: Invalid Password
    console.log('Running TC-002: Invalid Password...');
    try {
      await axios.post(`${BASE_URL}/api/auth/login`, {
        email: TEST_USERS.citizen.email,
        password: '123456789' // Wrong password
      });
      testResults.push({
        id: 'TC-002',
        scenario: 'Invalid password',
        input: `${TEST_USERS.citizen.email} / 123456789`,
        expected: 'Error message: "Invalid credentials."',
        actual: 'Expected error but got success',
        status: '❌ Fail'
      });
    } catch (error) {
      const hasError = error.response?.status === 401 || 
                       error.message.includes('Invalid') ||
                       error.message.includes('password');
      
      testResults.push({
        id: 'TC-002',
        scenario: 'Invalid password',
        input: `${TEST_USERS.citizen.email} / 123456789`,
        expected: 'Error message: "Invalid credentials."',
        actual: `Status: ${error.response?.status}, Message: ${error.response?.data?.error || error.message}`,
        status: hasError ? '✅ Pass' : '❌ Fail'
      });
    }
    
    // TC-005: Submit Valid Complaint
    console.log('Running TC-005: Submit Complaint...');
    try {
      const tc005 = await axios.post(`${BASE_URL}/api/complaints`, {
        category: 'Waste',
        subcategory: 'Garbage',
        department: 'CEO',
        priority: 'Medium',
        description: 'Garbage pile on Rizal Ave',
        location: 'Rizal Ave',
        coordinates: { lat: 7.19, lng: 125.09 }
      }, {
        headers: { 
          'Content-Type': 'application/json',
          ...(authTokens.citizen ? { 'Authorization': `Bearer ${authTokens.citizen}` } : {})
        }
      });
      
      testResults.push({
        id: 'TC-005',
        scenario: 'Valid complaint submission',
        input: 'Type: Waste, Location: Rizal Ave, Description: Garbage pile',
        expected: 'Success message. User redirected to My Complaints',
        actual: `Status: ${tc005.status}, Message: ${tc005.data?.message || 'Created'}`,
        status: (tc005.status === 201 || tc005.status === 200) ? '✅ Pass' : '❌ Fail'
      });
    } catch (error) {
      testResults.push({
        id: 'TC-005',
        scenario: 'Valid complaint submission',
        input: 'Type: Waste, Location: Rizal Ave, Description: Garbage pile',
        expected: 'Success message. User redirected to My Complaints',
        actual: `Error: ${error.message}`,
        status: '❌ Fail'
      });
    }
    
    // TC-006: Submit Complaint with Missing Required Field
    console.log('Running TC-006: Missing Required Field...');
    try {
      await axios.post(`${BASE_URL}/api/complaints`, {
        category: 'Noise',
        subcategory: 'Loud Noise',
        department: 'CEO',
        priority: 'Medium',
        description: '', // Empty description
        location: 'Magsaysay St'
      }, {
        headers: { 
          'Content-Type': 'application/json',
          ...(authTokens.citizen ? { 'Authorization': `Bearer ${authTokens.citizen}` } : {})
        }
      });
      
      testResults.push({
        id: 'TC-006',
        scenario: 'Missing required field (Description)',
        input: 'Type: Noise, Location: Magsaysay St, Description: (empty)',
        expected: 'Validation error: "Description is required."',
        actual: 'Expected validation error but got success',
        status: '❌ Fail'
      });
    } catch (error) {
      const isValidationError = error.response?.status === 400 && 
                                (error.response?.data?.error?.includes('required') ||
                                 error.response?.data?.error?.includes('Description'));
      
      testResults.push({
        id: 'TC-006',
        scenario: 'Missing required field (Description)',
        input: 'Type: Noise, Location: Magsaysay St, Description: (empty)',
        expected: 'Validation error: "Description is required."',
        actual: `Status: ${error.response?.status}, Error: ${error.response?.data?.error || error.message}`,
        status: isValidationError ? '✅ Pass' : '❌ Fail'
      });
    }
    
    // TC-007: View Complaint History
    console.log('Running TC-007: View History (with existing complaints)...');
    try {
      const tc007 = await axios.get(`${BASE_URL}/api/complaints/my`, {
        headers: authTokens.citizen ? { 'Authorization': `Bearer ${authTokens.citizen}` } : {}
      });
      
      const hasList = Array.isArray(tc007.data) || Array.isArray(tc007.data?.data);
      const count = hasList ? (tc007.data?.length || tc007.data?.data?.length || 0) : 0;
      
      testResults.push({
        id: 'TC-007',
        scenario: 'User has existing complaints',
        input: `Login as ${TEST_USERS.citizen.email}`,
        expected: 'List of complaints displayed correctly',
        actual: `Status: ${tc007.status}, Complaints: ${count}`,
        status: tc007.status === 200 ? '✅ Pass' : '❌ Fail'
      });
    } catch (error) {
      testResults.push({
        id: 'TC-007',
        scenario: 'User has existing complaints',
        input: `Login as ${TEST_USERS.citizen.email}`,
        expected: 'List of complaints displayed correctly',
        actual: `Error: ${error.message}`,
        status: '❌ Fail'
      });
    }
    
    // TC-008: View History (No complaints)
    console.log('Running TC-008: View History (No complaints)...');
    // This test would require creating a new user - skip for now
    
    // TC-009: View Heatmap UI
    console.log('Running TC-009: View Heatmap UI...');
    try {
      const token = authTokens.admin || await authenticateUser('admin');
      const tc009 = await axios.get(`${BASE_URL}/heatmap`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        validateStatus: () => true // Accept any status
      });
      
      testResults.push({
        id: 'TC-009',
        scenario: 'Admin navigates to heatmap page',
        input: `Login as ${TEST_USERS.admin.email}`,
        expected: 'Map interface loads, centered on Digos City',
        actual: `Status: ${tc009.status}`,
        status: tc009.status === 200 ? '✅ Pass' : '❌ Fail'
      });
    } catch (error) {
      testResults.push({
        id: 'TC-009',
        scenario: 'Admin navigates to heatmap page',
        input: `Login as ${TEST_USERS.admin.email}`,
        expected: 'Map interface loads, centered on Digos City',
        actual: `Error: ${error.message}`,
        status: '❌ Fail'
      });
    }
    
    // Generate and display report
    formatTable(testResults);
    
    // Save detailed report to file
    const report = generateDetailedReport(testResults);
    fs.writeFileSync('test-results.md', report);
    console.log('\n📄 Detailed report saved to test-results.md');
    
  } catch (error) {
    console.error('Test runner error:', error.message);
    console.error('Stack:', error.stack);
  }
}

function generateDetailedReport(results) {
  const timestamp = new Date().toISOString();
  const passed = results.filter(t => t.status === '✅ Pass').length;
  const failed = results.filter(t => t.status === '❌ Fail').length;
  
  return `## Test Execution Report
Generated: ${timestamp}

${results.map(t => `### ${t.id}: ${t.scenario || 'N/A'}
- **Input**: ${t.input || 'N/A'}
- **Expected**: ${t.expected || 'N/A'}
- **Actual**: ${t.actual || 'N/A'}
- **Status**: ${t.status}
`).join('\n')}

## Summary
Total Tests: ${results.length}
Passed: ${passed}
Failed: ${failed}
Pass Rate: ${((passed / results.length) * 100).toFixed(1)}%
`;
}

runTests();
