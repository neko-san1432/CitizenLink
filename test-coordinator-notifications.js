const NotificationService = require('./src/server/services/NotificationService');
const ComplaintRepository = require('./src/server/repositories/ComplaintRepository');

async function testCoordinatorNotifications() {
  try {
    console.log('🧪 Testing Coordinator Notification System...\n');

    // Test 1: Check if coordinators can be found
    console.log('📋 Test 1: Finding coordinators...');
    const complaintRepo = new ComplaintRepository();
    const coordinator = await complaintRepo.findActiveCoordinator('GENERAL');

    if (coordinator) {
      console.log('✅ Coordinator found:', {
        id: coordinator.user_id,
        email: coordinator.email,
        name: coordinator.name
      });
    } else {
      console.log('❌ No coordinator found');
    }

    // Test 2: Check notification service coordinator finding
    console.log('\n📋 Test 2: Testing NotificationService coordinator finding...');
    const notificationService = new NotificationService();
    const result = await notificationService.notifyAllCoordinators(
      'test-complaint-id',
      'Test Complaint for Coordinator Notification'
    );

    console.log('Notification result:', result);

    // Test 3: List all users to see coordinator roles
    console.log('\n📋 Test 3: Checking all users for coordinator roles...');
    try {
      const { data: authUsers, error: authError } = await complaintRepo.supabase.auth.admin.listUsers();

      if (authError) {
        console.error('❌ Auth API error:', authError);
        return;
      }

      const coordinators = authUsers.users.filter(user => {
        const metadata = user.user_metadata || {};
        const rawMetadata = user.raw_user_meta_data || {};

        const baseRole = metadata.base_role || rawMetadata.base_role;
        return baseRole === 'complaint-coordinator';
      });

      console.log(`Found ${coordinators.length} coordinators in the system:`);
      coordinators.forEach((coord, index) => {
        console.log(`  ${index + 1}. ${coord.email} (ID: ${coord.id})`);
        console.log(`     Metadata:`, {
          user_metadata: coord.user_metadata,
          raw_user_meta_data: coord.raw_user_meta_data
        });
      });

      if (coordinators.length === 0) {
        console.log('❌ No users found with base_role = "complaint-coordinator"');
        console.log('💡 Make sure users have "base_role": "complaint-coordinator" in their user_metadata or raw_user_meta_data');
      }

    } catch (error) {
      console.error('❌ Error testing coordinator system:', error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testCoordinatorNotifications();
