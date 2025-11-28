require('dotenv').config();
const Database = require('../src/server/config/database');

async function run() {
  const db = new Database();
  const supabase = db.getClient();
  
  console.log('Creating stale complaint...');
  
  // 1. Create a user (if not exists) - assume existing citizen
  // We'll just use a random UUID for submitted_by if we can't find one, 
  // but better to find one.
  const { data: users } = await supabase.auth.admin.listUsers();
  const citizen = users.users.find(u => u.email === 'citizen_test@example.com');
  
  if (!citizen) {
    console.error('Citizen user not found. Run test-scenarios.js first.');
    return;
  }

  // 2. Create complaint
  const { data: complaint, error } = await supabase
    .from('complaints')
    .insert({
      submitted_by: citizen.id,
      title: 'Stale Complaint for Reminder Test 3',
      descriptive_su: 'This complaint should trigger a reminder.',
      location_text: 'Test Location',
      workflow_status: 'assigned', // Needs reminder
      submitted_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
      last_activity_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() // 48 hours ago
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating complaint:', error);
    return;
  }

  console.log('Created stale complaint:', complaint.id);
}

run().catch(console.error);
