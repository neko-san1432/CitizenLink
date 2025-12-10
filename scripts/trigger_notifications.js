require('dotenv').config();
const Database = require('../src/server/config/database');
const ComplaintService = require('../src/server/services/ComplaintService');
const CoordinatorService = require('../src/server/services/CoordinatorService');
const NotificationService = require('../src/server/services/NotificationService');

async function main() {
  console.log('🚀 Starting Notification Trigger Script...');

  // Initialize Database
  const db = new Database();
  const supabase = db.getClient();

  // Services
  const complaintService = new ComplaintService();
  const coordinatorService = new CoordinatorService();
  const notificationService = new NotificationService();

  try {
    // 1. Find Test Users
    console.log('🔍 Finding test users...');
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) throw userError;

    const citizen = users.find(u => u.user_metadata.role === 'citizen');
    const admin = users.find(u => u.user_metadata.role === 'lgu-admin' || u.user_metadata.role === 'super-admin');
    const coordinator = users.find(u => u.user_metadata.role === 'complaint-coordinator');

    if (!citizen) throw new Error('No citizen user found');
    if (!admin) throw new Error('No admin user found');

    console.log(`👤 Citizen: ${citizen.email} (${citizen.id})`);
    console.log(`👤 Admin: ${admin.email} (${admin.id})`);

    console.log('\n⏳ Waiting 30 seconds for you to login to the browser...');
    await new Promise(r => setTimeout(r, 30000));

    // 2. Trigger: Complaint Submission
    console.log('\n--- Trigger 1: Complaint Submission ---');
    const complaintData = {
      title: `Test Notification ${Date.now()}`,
      description: 'This is a test complaint to verify real-time notifications.',
      category: 'Infrastructure',
      subcategory: 'Roads',
      location_text: 'Test Location',
      latitude: 14.5995,
      longitude: 120.9842,
      department_r: ['ENG'] // Engineering
    };

    const newComplaint = await complaintService.createComplaint(
      citizen.id,
      complaintData,
      [] // No files
    );
    console.log(`✅ Complaint Created: ${newComplaint.id}`);
    console.log('👉 Check Citizen Dashboard for "Complaint Submitted" notification');

    // Wait a bit
    await new Promise(r => setTimeout(r, 2000));

    // 3. Trigger: Assignment (by Coordinator/Admin)
    console.log('\n--- Trigger 2: Assignment ---');
    // Assign to a department (simulating coordinator action)
    if (coordinator) {
      await coordinatorService.assignToDepartment(
        'ENG', // Department code
        newComplaint.id,
        { assigned_by: coordinator.id }
      );
      console.log('✅ Assigned to Engineering Department');
      console.log('👉 Check Department Admin Dashboard for "New Assignment"');
    } else {
      console.log('⚠️ No coordinator found, skipping assignment trigger');
    }

    // Wait a bit
    await new Promise(r => setTimeout(r, 2000));

    // 4. Trigger: Status Change (In Progress)
    console.log('\n--- Trigger 3: Status Change (In Progress) ---');
    await complaintService.updateComplaintStatus(
      newComplaint.id,
      'in_progress',
      'We are working on it.',
      admin.id
    );
    console.log('✅ Status updated to In Progress');
    console.log('👉 Check Citizen Dashboard for "Status Changed" notification');

    // Wait a bit
    await new Promise(r => setTimeout(r, 2000));

    // 5. Trigger: Resolution
    console.log('\n--- Trigger 4: Resolution ---');
    await complaintService.updateComplaintStatus(
      newComplaint.id,
      'resolved',
      'Fixed the issue.',
      admin.id
    );
    console.log('✅ Status updated to Resolved');
    console.log('👉 Check Citizen Dashboard for "Complaint Resolved" notification');

    console.log('\n✨ All triggers executed successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();
