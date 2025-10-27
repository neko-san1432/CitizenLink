/**
 * Test coordinator API endpoints
 * Run this to verify the coordinator system is working
 */
require('dotenv').config();

async function testCoordinatorAPI() {
  try {
    console.log('=== COORDINATOR API TEST ===');

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Test 1: Check if we can query complaints
    console.log('\n1. Testing complaints query...');
    const { data: complaints, error: complaintsError } = await supabase
      .from('complaints')
      .select('*')
      .limit(3);

    if (complaintsError) {
      console.error('❌ Complaints query failed:', complaintsError.message);
    } else {
      console.log(`✅ Found ${complaints?.length || 0} complaints`);

      if (complaints && complaints.length > 0) {
        console.log('Sample complaint:', {
          title: complaints[0].title,
          workflow_status: complaints[0].workflow_status,
          assigned_coordinator_id: complaints[0].assigned_coordinator_id
        });
      }
    }

    // Test 2: Check coordinators
    console.log('\n2. Testing coordinators...');
    const { data: coordinators, error: coordError } = await supabase
      .from('complaint_coordinators')
      .select('*');

    if (coordError) {
      console.error('❌ Coordinators query failed:', coordError.message);
    } else {
      console.log(`✅ Found ${coordinators?.length || 0} coordinators`);
      coordinators?.forEach(coord => {
        console.log(`   - ${coord.user_id} (${coord.department})`);
      });
    }

    // Test 3: Check departments
    console.log('\n3. Testing departments...');
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('*')
      .limit(5);

    if (deptError) {
      console.error('❌ Departments query failed:', deptError.message);
    } else {
      console.log(`✅ Found ${departments?.length || 0} departments`);
    }

    // Test 4: Create test data if needed
    if ((!complaints || complaints.length === 0) && (!coordinators || coordinators.length === 0)) {
      console.log('\n4. Creating test data...');

      // Get first available user
      const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
      if (usersError) {
        console.error('❌ Users query failed:', usersError.message);
        return;
      }

      if (users.users && users.users.length > 0) {
        const testUser = users.users[0];

        // Create test coordinator
        const { data: newCoordinator, error: newCoordError } = await supabase
          .from('complaint_coordinators')
          .insert({
            user_id: testUser.id,
            department: 'GENERAL',
            is_active: true
          })
          .select()
          .single();

        if (newCoordError) {
          console.error('❌ Coordinator creation failed:', newCoordError.message);
        } else {
          console.log('✅ Test coordinator created');

          // Create test complaint
          const { data: newComplaint, error: newComplaintError } = await supabase
            .from('complaints')
            .insert({
              title: 'Test Complaint for Coordinator Review',
              descriptive_su: 'This is a test complaint to verify the coordinator system works.',
              submitted_by: testUser.id,
              workflow_status: 'new',
              priority: 'medium',
              type: 'complaint',
              location_text: 'Test Location'
            })
            .select()
            .single();

          if (newComplaintError) {
            console.error('❌ Complaint creation failed:', newComplaintError.message);
          } else {
            console.log('✅ Test complaint created:', newComplaint.id);

            // Assign coordinator to complaint
            const { error: assignError } = await supabase
              .from('complaints')
              .update({ assigned_coordinator_id: testUser.id })
              .eq('id', newComplaint.id);

            if (assignError) {
              console.error('❌ Coordinator assignment failed:', assignError.message);
            } else {
              console.log('✅ Coordinator assigned to complaint');
            }
          }
        }
      }
    }

    console.log('\n🎯 Coordinator system test complete!');
    console.log('📋 Check /coordinator/dashboard in your browser');

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testCoordinatorAPI();
