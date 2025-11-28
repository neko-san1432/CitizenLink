/**
 * Complaint Workflow Scenario Tests
 * 
 * Usage: node test-scenarios.js
 * 
 * Configuration: Update the USERS object with valid credentials.
 */

const axios = require('axios');
require('dotenv').config();
const Database = require('./src/server/config/database');
const fs = require('fs');
const util = require('util');

// --- LOGGING SETUP ---
const logFile = fs.createWriteStream('test-output.txt', { flags: 'w' });
const logStdout = process.stdout;

console.log = function(...args) {
  const msg = util.format(...args);
  logFile.write(msg + '\n');
  logStdout.write(msg + '\n');
};

console.error = function(...args) {
  const msg = util.format(...args);
  logFile.write(msg + '\n');
  logStdout.write(msg + '\n');
};

// --- CONFIGURATION ---
const BASE_URL = 'http://localhost:3001';

// YOU MUST UPDATE THESE WITH VALID CREDENTIALS FROM YOUR DATABASE
const USERS = {
  citizen: { email: 'citizen_test@example.com', password: 'Password123!', role: 'citizen' },
  coordinator: { email: 'coordinator@example.com', password: 'password', role: 'complaint-coordinator' },
  
  // Department A (e.g., Engineering)
  adminA: { email: 'admin_eng@example.com', password: 'password', role: 'lgu-admin', dept: 'ENG' },
  officerA1: { email: 'officer_eng1@example.com', password: 'password', role: 'lgu', dept: 'ENG' },
  officerA2: { email: 'officer_eng2@example.com', password: 'password', role: 'lgu', dept: 'ENG' },
  
  // Department B (e.g., Health)
  adminB: { email: 'admin_hlt@example.com', password: 'password', role: 'lgu-admin', dept: 'HLT' },
  officerB1: { email: 'officer_hlt1@example.com', password: 'password', role: 'lgu', dept: 'HLT' }
};

// --- DB SETUP ---
const db = new Database();
const supabase = db.getClient();

// --- CLIENT ---
const client = axios.create({
  baseURL: BASE_URL,
  validateStatus: () => true // Don't throw on error status
});

// --- HELPERS ---

async function getCsrfToken(token) {
  const res = await client.get('/api/auth/csrf-token', { headers: { Cookie: token } });
  if (res.status === 200) {
    return res.data.csrfToken;
  }
  console.error('[AUTH] ❌ Failed to get CSRF token:', res.data);
  return null;
}

async function login(userLabel) {
  const user = USERS[userLabel];
  if (!user) throw new Error(`User ${userLabel} not defined`);
  
  console.log(`[AUTH] Logging in ${userLabel} (${user.email})...`);
  const res = await client.post('/api/auth/login', { email: user.email, password: user.password });
  
  if (res.status === 200) {
    const cookie = res.headers['set-cookie']?.find(c => c.startsWith('sb_access_token'));
    const token = cookie ? cookie.split(';')[0] : `sb_access_token=${res.data.data.session?.access_token}`;
    user.token = token;
    user.id = res.data.data.user.id;
    
    // Get CSRF token
    user.csrfToken = await getCsrfToken(token);
    
    console.log(`[AUTH] ✅ ${userLabel} logged in.`);
    return true;
  } else {
    console.error(`[AUTH] ❌ Login failed for ${userLabel}:`, res.data);
    return false;
  }
}

async function submitComplaint(token, csrfToken) {
  console.log('[CITIZEN] Submitting complaint...');
  const res = await client.post('/api/complaints', {
    title: `Scenario Test ${Date.now()}`,
    descriptive_su: 'This is a test complaint for workflow validation.',
    location_text: 'Test Location, Digos City',
    latitude: 6.7492,
    longitude: 125.3572,
    category: 'Infrastructure',
    priority: 'medium'
  }, { 
    headers: { 
      Cookie: token,
      'x-csrf-token': csrfToken,
      'Authorization': `Bearer ${token.replace('sb_access_token=', '')}`
    } 
  });

  if (res.status === 201) {
    console.log(`[CITIZEN] ✅ Complaint submitted: ${res.data.data.id}`);
    return res.data.data.id;
  }
  console.error('[CITIZEN] ❌ Submission failed:', res.data);
  return null;
}

async function coordinatorAssign(token, csrfToken, complaintId, departments) {
  console.log(`[COORDINATOR] Assigning complaint ${complaintId} to ${departments.join(', ')}...`);
  const res = await client.post(`/api/coordinator/review-queue/${complaintId}/decide`, {
    decision: 'assign_department',
    data: {
      departments: departments,
      priority: 'high',
      notes: 'Please handle this.'
    }
  }, { 
    headers: { 
      Cookie: token, 
      'x-csrf-token': csrfToken,
      'Authorization': `Bearer ${token.replace('sb_access_token=', '')}`
    } 
  });

  if (res.status === 200) {
    console.log('[COORDINATOR] ✅ Assignment successful.');
    return true;
  }
  console.error('[COORDINATOR] ❌ Assignment failed:', res.data);
  return false;
}

async function adminAssign(token, csrfToken, complaintId, officerIds) {
  console.log(`[LGU_ADMIN] Assigning complaint ${complaintId} to officers: ${officerIds.join(', ')}...`);
  const res = await client.post(`/api/lgu-admin/complaints/${complaintId}/assign`, {
    officerIds: officerIds,
    priority: 'high',
    notes: 'Assigned via test script'
  }, { 
    headers: { 
      Cookie: token, 
      'x-csrf-token': csrfToken,
      'Authorization': `Bearer ${token.replace('sb_access_token=', '')}`
    } 
  });

  if (res.status === 200) {
    console.log('[LGU_ADMIN] ✅ Assignment successful.');
    return true;
  }
  console.error('[LGU_ADMIN] ❌ Assignment failed:', res.data);
  return false;
}

async function officerResolve(token, csrfToken, complaintId) {
  console.log(`[OFFICE] Resolving complaint ${complaintId}...`);
  const res = await client.post(`/api/lgu/complaints/${complaintId}/resolve`, {
    resolution_notes: 'Issue resolved by officer.'
  }, { 
    headers: { 
      Cookie: token, 
      'x-csrf-token': csrfToken,
      'Authorization': `Bearer ${token.replace('sb_access_token=', '')}`
    } 
  });

  if (res.status === 200) {
    console.log('[OFFICE] ✅ Resolution successful.');
    return true;
  }
  console.error('[OFFICE] ❌ Resolution failed:', res.data);
  return false;
}

async function citizenConfirm(token, csrfToken, complaintId) {
  console.log(`[CITIZEN] Confirming resolution for ${complaintId}...`);
  const res = await client.post(`/api/complaints/${complaintId}/confirm-resolution`, {
    confirmed: true,
    feedback: 'Verified.'
  }, { 
    headers: { 
      Cookie: token, 
      'x-csrf-token': csrfToken,
      'Authorization': `Bearer ${token.replace('sb_access_token=', '')}`
    } 
  });

  if (res.status === 200) {
    console.log('[CITIZEN] ✅ Confirmation successful.');
    return true;
  }
  console.error('[CITIZEN] ❌ Confirmation failed:', res.data);
  return false;
}

// --- SETUP HELPERS ---

async function ensureUser(key, userData) {
  try {
    // Check if user exists
    const { data: users } = await supabase.auth.admin.listUsers();
    const existingUser = users.users.find(u => u.email === userData.email);

    if (existingUser) {
      console.log(`[SETUP] User ${userData.email} already exists. Updating...`);
      // Update password and metadata
      await supabase.auth.admin.updateUserById(existingUser.id, { 
        password: userData.password,
        user_metadata: {
          role: userData.role,
          department: userData.dept || null,
          name: userData.email.split('@')[0]
        }
      });
      return;
    }

    console.log(`[SETUP] Creating user ${userData.email}...`);
    const { data, error } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        role: userData.role,
        department: userData.dept || null,
        name: userData.email.split('@')[0]
      }
    });

    if (error) throw error;
    console.log(`[SETUP] ✅ Created user ${userData.email}`);
  } catch (error) {
    console.error(`[SETUP] ❌ Failed to ensure user ${userData.email}:`, error.message);
  }
}

async function ensureDepartment(code, name) {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('code')
      .eq('code', code)
      .maybeSingle();
      
    if (data) {
      console.log(`[SETUP] Department ${code} already exists.`);
      return;
    }

    console.log(`[SETUP] Creating department ${code}...`);
    const { error: insertError } = await supabase
      .from('departments')
      .insert({
        code,
        name,
        description: `${name} Department`,
        is_active: true,
        level: 'LGU'
      });

    if (insertError) throw insertError;
    console.log(`[SETUP] ✅ Created department ${code}`);
  } catch (error) {
    console.error(`[SETUP] ❌ Failed to ensure department ${code}:`, error.message);
  }
}

async function ensureAllUsers() {
  console.log('--- Listing Existing Departments ---');
  const { data: depts } = await supabase.from('departments').select('*');
  console.log(depts);

  console.log('--- Ensuring Departments Exist ---');
  await ensureDepartment('ENG', 'Engineering');
  await ensureDepartment('HLT', 'Health');

  console.log('--- Testing validateDepartmentCodes ---');
  try {
    const { validateDepartmentCodes, clearDepartmentCache } = require('./src/server/utils/departmentMapping');
    clearDepartmentCache(); // Clear local cache in this process
    const result = await validateDepartmentCodes(['ENG', 'HLT']);
    console.log('[TEST] validateDepartmentCodes result:', result);
  } catch (e) {
    console.error('[TEST] validateDepartmentCodes failed:', e);
  }

  console.log('--- Ensuring Test Users Exist ---');
  for (const [key, user] of Object.entries(USERS)) {
    await ensureUser(key, user);
  }
}

// --- SCENARIOS ---

async function runScenario1() {
  console.log('\n=== SCENARIO 1: Single Dept, Single Officer ===');
  // 1. Citizen submits
  const complaintId = await submitComplaint(USERS.citizen.token, USERS.citizen.csrfToken);
  if (!complaintId) return;

  // 2. Coordinator assigns to Dept A
  if (!await coordinatorAssign(USERS.coordinator.token, USERS.coordinator.csrfToken, complaintId, [USERS.adminA.dept])) return;

  // 3. Admin A assigns to Officer A1
  if (!await adminAssign(USERS.adminA.token, USERS.adminA.csrfToken, complaintId, [USERS.officerA1.id])) return;

  // 4. Officer A1 resolves
  if (!await officerResolve(USERS.officerA1.token, USERS.officerA1.csrfToken, complaintId)) return;

  // 5. Citizen confirms
  await citizenConfirm(USERS.citizen.token, USERS.citizen.csrfToken, complaintId);
}

async function runScenario2() {
  console.log('\n=== SCENARIO 2: Multi Dept, Single Officer per Dept ===');
  // 1. Citizen submits
  const complaintId = await submitComplaint(USERS.citizen.token, USERS.citizen.csrfToken);
  if (!complaintId) return;

  // 2. Coordinator assigns to Dept A AND Dept B
  if (!await coordinatorAssign(USERS.coordinator.token, USERS.coordinator.csrfToken, complaintId, [USERS.adminA.dept, USERS.adminB.dept])) return;

  // 3. Admin A assigns to Officer A1
  if (!await adminAssign(USERS.adminA.token, USERS.adminA.csrfToken, complaintId, [USERS.officerA1.id])) return;

  // 4. Admin B assigns to Officer B1
  if (!await adminAssign(USERS.adminB.token, USERS.adminB.csrfToken, complaintId, [USERS.officerB1.id])) return;

  // 5. Officer A1 resolves
  if (!await officerResolve(USERS.officerA1.token, USERS.officerA1.csrfToken, complaintId)) return;
  
  // 6. Officer B1 resolves
  if (!await officerResolve(USERS.officerB1.token, USERS.officerB1.csrfToken, complaintId)) return;

  // 7. Citizen confirms
  await citizenConfirm(USERS.citizen.token, USERS.citizen.csrfToken, complaintId);
}

async function runScenario3() {
  console.log('\n=== SCENARIO 3: Single Dept, Multi Officers ===');
  // 1. Citizen submits
  const complaintId = await submitComplaint(USERS.citizen.token, USERS.citizen.csrfToken);
  if (!complaintId) return;

  // 2. Coordinator assigns to Dept A
  if (!await coordinatorAssign(USERS.coordinator.token, USERS.coordinator.csrfToken, complaintId, [USERS.adminA.dept])) return;

  // 3. Admin A assigns to Officer A1 AND Officer A2
  if (!await adminAssign(USERS.adminA.token, USERS.adminA.csrfToken, complaintId, [USERS.officerA1.id, USERS.officerA2.id])) return;

  // 4. Officer A1 resolves
  if (!await officerResolve(USERS.officerA1.token, USERS.officerA1.csrfToken, complaintId)) return;
  
  // 5. Officer A2 resolves
  await officerResolve(USERS.officerA2.token, USERS.officerA2.csrfToken, complaintId);

  // 6. Citizen confirms
  await citizenConfirm(USERS.citizen.token, USERS.citizen.csrfToken, complaintId);
}

async function main() {
  try {
    // Setup Users
    await ensureAllUsers();
    
    console.log('--- Logging in Users ---');
    
    // Login all users
    let missingStaff = false;
    for (const [key, user] of Object.entries(USERS)) {
        if (!await login(key)) {
            console.warn(`⚠️ Login failed for ${key}`);
            missingStaff = true;
        }
    }

    if (missingStaff) {
        console.log('\n⚠️ Some users failed to login. Scenarios may fail.');
    }

    // Run Scenarios
    if (USERS.citizen.token && USERS.coordinator.token && USERS.adminA.token && USERS.officerA1.token) {
        await runScenario1();
    }
    
    if (USERS.citizen.token && USERS.coordinator.token && USERS.adminA.token && USERS.officerA1.token && USERS.adminB.token && USERS.officerB1.token) {
        await runScenario2();
    }
    
    if (USERS.citizen.token && USERS.coordinator.token && USERS.adminA.token && USERS.officerA1.token && USERS.officerA2.token) {
        await runScenario3();
    }
  } catch (e) {
    console.error('FATAL ERROR:', e);
  }
}

main().catch(console.error);
