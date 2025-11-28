/**
 * Complaint Workflow Test Script
 * 
 * This script automates the end-to-end flow of a complaint:
 * 1. Citizen submits a complaint.
 * 2. Coordinator assigns it to an LGU/Task Force.
 * 3. LGU Officer confirms the assignment.
 * 4. LGU Officer resolves the complaint.
 * 5. Citizen confirms the resolution.
 * 
 * USAGE:
 * 1. Update the CONFIG object below with valid credentials for Coordinator and Officer.
 * 2. Run: node test-complaint-workflow.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const CONFIG = {
  baseUrl: 'http://localhost:3001',
  // Citizen can be auto-registered if not found
  citizen: {
    email: `citizen_test_${Date.now()}@example.com`,
    password: 'Password123!',
    firstName: 'Test',
    lastName: 'Citizen',
    mobileNumber: '09171234567'
  },
  // MUST PROVIDE VALID COORDINATOR CREDENTIALS
  coordinator: {
    email: 'coordinator@example.com', 
    password: 'password'
  },
  // MUST PROVIDE VALID OFFICER CREDENTIALS
  officer: {
    email: 'officer@example.com',
    password: 'password'
  }
};

// --- HELPERS ---
const client = axios.create({
  baseURL: CONFIG.baseUrl,
  validateStatus: () => true // Don't throw on error status
});

let citizenToken = '';
let coordinatorToken = '';
let officerToken = '';
let complaintId = '';
let taskForceId = '';

async function login(email, password, role) {
  console.log(`[${role.toUpperCase()}] Logging in as ${email}...`);
  const res = await client.post('/api/auth/login', { email, password });
  if (res.status === 200) {
    console.log(`[${role.toUpperCase()}] Login successful.`);
    const cookie = res.headers['set-cookie']?.find(c => c.startsWith('sb_access_token'));
    if (cookie) {
        return cookie.split(';')[0]; // Extract token from cookie
    } else {
        // Fallback if token is in body (though AuthController sets cookie)
        // For testing, we might need to manually handle the cookie if axios doesn't persist it automatically
        // But we are capturing it here to send in headers if needed, or just use Cookie header.
        return `sb_access_token=${res.data.data.session?.access_token || ''}`; // This might be wrong if structure differs
    }
  } else {
    console.error(`[${role.toUpperCase()}] Login failed: ${res.status} - ${JSON.stringify(res.data)}`);
    return null;
  }
}

async function registerCitizen() {
  console.log('[CITIZEN] Registering new citizen...');
  const res = await client.post('/api/auth/signup', {
    email: CONFIG.citizen.email,
    password: CONFIG.citizen.password,
    confirmPassword: CONFIG.citizen.password,
    firstName: CONFIG.citizen.firstName,
    lastName: CONFIG.citizen.lastName,
    mobileNumber: CONFIG.citizen.mobileNumber,
    agreedToTerms: true,
    role: 'citizen'
  });

  if (res.status === 201) {
    console.log('[CITIZEN] Registration successful.');
    // In a real env, email verification is needed. 
    // If dev env disables it or we can bypass, great. 
    // Otherwise this might fail login.
    // Let's assume for now we can login or the user is auto-verified in dev.
    return true;
  } else {
    console.error(`[CITIZEN] Registration failed: ${res.status} - ${JSON.stringify(res.data)}`);
    return false;
  }
}

async function run() {
  console.log('Starting Complaint Workflow Test...');

  // 1. Citizen Setup
  citizenToken = await login(CONFIG.citizen.email, CONFIG.citizen.password, 'citizen');
  if (!citizenToken) {
    const registered = await registerCitizen();
    if (registered) {
      // Wait a bit for DB propagation if needed
      await new Promise(r => setTimeout(r, 1000));
      citizenToken = await login(CONFIG.citizen.email, CONFIG.citizen.password, 'citizen');
    }
  }
  
  if (!citizenToken) {
    console.error('❌ Could not authenticate Citizen. Aborting.');
    return;
  }

  // 2. Coordinator Setup
  coordinatorToken = await login(CONFIG.coordinator.email, CONFIG.coordinator.password, 'coordinator');
  if (!coordinatorToken) {
    console.error('❌ Could not authenticate Coordinator. Please update CONFIG with valid credentials.');
    return;
  }

  // 3. Officer Setup
  officerToken = await login(CONFIG.officer.email, CONFIG.officer.password, 'officer');
  if (!officerToken) {
    console.error('❌ Could not authenticate Officer. Please update CONFIG with valid credentials.');
    return;
  }

  // 4. Submit Complaint
  console.log('\n--- Step 1: Citizen Submits Complaint ---');
  const complaintData = {
    title: `Test Complaint ${Date.now()}`,
    descriptive_su: 'This is an automated test complaint regarding a pothole.',
    location_text: 'Rizal Avenue, Digos City',
    latitude: 6.7492, // Digos coords
    longitude: 125.3572,
    category: 'Infrastructure',
    subcategory: 'Roads',
    priority: 'medium'
  };

  const submitRes = await client.post('/api/complaints', complaintData, {
    headers: { Cookie: citizenToken }
  });

  if (submitRes.status === 201) {
    complaintId = submitRes.data.data.id;
    console.log(`✅ Complaint submitted. ID: ${complaintId}`);
  } else {
    console.error(`❌ Submission failed: ${submitRes.status} - ${JSON.stringify(submitRes.data)}`);
    return;
  }

  // 5. Coordinator Assigns
  console.log('\n--- Step 2: Coordinator Assigns to Task Force ---');
  // First, get review queue to "see" it
  await client.get('/api/coordinator/review-queue', { headers: { Cookie: coordinatorToken } });
  
  // Assign
  const assignRes = await client.post(`/api/coordinator/review-queue/${complaintId}/decide`, {
    decision: 'assign_to_department',
    data: {
      departments: ['ENG'], // Assuming Engineering department code
      priority: 'high',
      notes: 'Please investigate immediately.'
    }
  }, {
    headers: { Cookie: coordinatorToken }
  });

  if (assignRes.status === 200) {
    console.log('✅ Complaint assigned to department.');
  } else {
    console.error(`❌ Assignment failed: ${assignRes.status} - ${JSON.stringify(assignRes.data)}`);
    // It might fail if 'ENG' dept doesn't exist. We might need to fetch depts first.
    return;
  }

  // 6. Officer Confirms
  console.log('\n--- Step 3: Officer Confirms Assignment ---');
  // Get pending confirmations
  const pendingRes = await client.get('/api/office-confirmation/pending', {
    headers: { Cookie: officerToken }
  });

  if (pendingRes.status === 200 && pendingRes.data.data.length > 0) {
    // Find our complaint in the list
    const task = pendingRes.data.data.find(t => t.complaint_id === complaintId);
    if (task) {
      taskForceId = task.id;
      console.log(`Found pending task force assignment: ${taskForceId}`);
      
      const confirmRes = await client.post(`/api/office-confirmation/${taskForceId}/confirm`, {
        status: 'accepted',
        notes: 'We will handle this.'
      }, {
        headers: { Cookie: officerToken }
      });

      if (confirmRes.status === 200) {
        console.log('✅ Assignment confirmed by officer.');
      } else {
        console.error(`❌ Confirmation failed: ${confirmRes.status} - ${JSON.stringify(confirmRes.data)}`);
        return;
      }
    } else {
      console.warn('⚠️ Complaint not found in officer pending list. Check if officer belongs to the assigned department.');
      return;
    }
  } else {
    console.warn('⚠️ No pending confirmations found for officer.');
    return;
  }

  // 7. Officer Resolves
  console.log('\n--- Step 4: Officer Resolves Complaint ---');
  // Mark as complete
  const completeRes = await client.post(`/api/complaints/${complaintId}/complete`, {
    notes: 'Pothole repaired.'
  }, {
    headers: { Cookie: officerToken }
  });

  if (completeRes.status === 200) {
    console.log('✅ Complaint marked as complete.');
  } else {
    console.error(`❌ Completion failed: ${completeRes.status} - ${JSON.stringify(completeRes.data)}`);
    return;
  }

  // 8. Citizen Confirms Resolution
  console.log('\n--- Step 5: Citizen Confirms Resolution ---');
  const resolveRes = await client.post(`/api/complaints/${complaintId}/confirm-resolution`, {
    confirmed: true,
    feedback: 'Great job, thanks!'
  }, {
    headers: { Cookie: citizenToken }
  });

  if (resolveRes.status === 200) {
    console.log('✅ Resolution confirmed by citizen.');
  } else {
    console.error(`❌ Resolution confirmation failed: ${resolveRes.status} - ${JSON.stringify(resolveRes.data)}`);
    return;
  }

  console.log('\n🎉 Workflow Test Completed Successfully!');
}

run().catch(console.error);
