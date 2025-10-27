/**
 * Setup test data for coordinator testing
 * Creates a test coordinator and sample complaints
 */
require('dotenv').config();

async function setupTestData() {
  try {
    console.log('=== SETUP TEST DATA ===');

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Check if we have any users first
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      console.error('Auth error:', authError);
      return;
    }

    if (!authUsers.users || authUsers.users.length === 0) {
      console.log('No users found. Please create some users first.');
      return;
    }

    // Use the first user as a test coordinator
    const testUser = authUsers.users[0];
    console.log(`Using test user: ${testUser.email} (${testUser.id})`);

    // Add user as coordinator
    const { data: coordinator, error: coordError } = await supabase
      .from('complaint_coordinators')
      .upsert({
        user_id: testUser.id,
        department: 'GENERAL',
        is_active: true,
        assigned_at: new Date().toISOString()
      })
      .select()
      .single();

    if (coordError) {
      console.error('Coordinator setup error:', coordError);
    } else {
      console.log('✅ Test coordinator created:', coordinator);
    }

    // Create a sample complaint
    const { data: complaint, error: complaintError } = await supabase
      .from('complaints')
      .insert({
        title: 'Test Complaint for Coordinator Review',
        descriptive_su: 'This is a test complaint to verify the coordinator system works properly. Please review and assign to appropriate department.',
        submitted_by: testUser.id,
        workflow_status: 'new',
        priority: 'medium',
        location_text: 'Test Location, Digos City',
        latitude: 6.7490,
        longitude: 125.3572,
        category: 'Infrastructure',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .select()
      .single();

    if (complaintError) {
      console.error('Complaint creation error:', complaintError);
    } else {
      console.log('✅ Test complaint created:', complaint.id);

      // Assign coordinator to this complaint
      const { error: assignError } = await supabase
        .from('complaints')
        .update({
          assigned_coordinator_id: testUser.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', complaint.id);

      if (assignError) {
        console.error('Coordinator assignment error:', assignError);
      } else {
        console.log('✅ Coordinator assigned to complaint');
      }
    }

    // Check final state
    const { data: finalComplaints, error: finalError } = await supabase
      .from('complaints')
      .select('*')
      .eq('workflow_status', 'new');

    console.log(`\n✅ Complaints with 'new' status: ${finalComplaints?.length || 0}`);

    const { data: coordCheck, error: coordCheckError } = await supabase
      .from('complaint_coordinators')
      .select('*');

    console.log(`✅ Coordinators in system: ${coordCheck?.length || 0}`);

    console.log('\n🎯 Coordinator dashboard should now show complaints!');

  } catch (error) {
    console.error('Setup error:', error);
  }
}

setupTestData();
