#!/usr/bin/env node

/**
 * Test script to check how many complaints exist for a user
 * Usage: node scripts/test-user-complaints.js <userId>
 */

require('dotenv').config();
const Database = require('../src/server/config/database');

async function testUserComplaints(userId) {
  if (!userId) {
    console.error('❌ Please provide a userId as an argument');
    console.log('Usage: node scripts/test-user-complaints.js <userId>');
    process.exit(1);
  }

  console.log(`\n🔍 Testing complaints for user: ${userId}\n`);

  try {
    const supabase = Database.getClient();

    // Get total count
    const { count, error: countError } = await supabase
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('submitted_by', userId);

    if (countError) {
      console.error('❌ Count query error:', countError);
      return;
    }

    console.log(`📊 Total complaints for user: ${count || 0}\n`);

    // Get all complaints (up to 100)
    const { data, error } = await supabase
      .from('complaints')
      .select('id, title, workflow_status, submitted_at, submitted_by')
      .eq('submitted_by', userId)
      .order('submitted_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('❌ Query error:', error);
      return;
    }

    console.log(`📋 Complaints returned: ${data?.length || 0}`);
    console.log('\n📝 Complaint details:');
    data?.forEach((complaint, index) => {
      console.log(`  ${index + 1}. [${complaint.id}] ${complaint.title || 'No title'} - ${complaint.workflow_status || 'No status'} - ${complaint.submitted_at || 'No date'}`);
    });

    console.log('\n✅ Test completed\n');
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

// Get userId from command line arguments
const userId = process.argv[2];
testUserComplaints(userId).then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});



