#!/usr/bin/env node

/**
 * Test script to check if complaint fetching works
 */

const Database = require('../src/server/config/database');
const ComplaintService = require('../src/server/services/ComplaintService');

async function testComplaintFetch() {
  try {
    console.log('🧪 Testing complaint fetch...');
    
    const db = new Database();
    const supabase = db.getClient();
    
    if (!supabase) {
      console.error('❌ Database not configured');
      return;
    }

    // Test basic complaint query
    console.log('📋 Testing basic complaint query...');
    const { data: complaints, error: complaintError } = await supabase
      .from('complaints')
      .select('id, title, submitted_by')
      .limit(5);

    if (complaintError) {
      console.error('❌ Complaint query failed:', complaintError);
      return;
    }

    console.log('✅ Basic complaint query successful');
    console.log(`📊 Found ${complaints.length} complaints`);

    // Test user complaints query
    console.log('📋 Testing user complaints query...');
    const complaintService = new ComplaintService();
    
    // Use a test user ID
    const testUserId = 'c54cdfb7-4ea6-4e96-bf9d-26989f8e5487'; // From the logs
    
    try {
      const result = await complaintService.getUserComplaints(testUserId, { limit: 5 });
      console.log('✅ User complaints query successful');
      console.log(`📊 Found ${result.complaints.length} user complaints`);
    } catch (error) {
      console.error('❌ User complaints query failed:', error);
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testComplaintFetch()
    .then(() => {
      console.log('🎉 Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testComplaintFetch };
