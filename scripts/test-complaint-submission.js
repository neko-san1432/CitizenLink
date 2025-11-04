#!/usr/bin/env node

// Test script to verify complaint submission works after auth.admin fixes
require('dotenv').config();

const Database = require('../src/server/config/database');

async function testComplaintSubmission() {
  console.log('🧪 Testing complaint submission after auth.admin fixes...');

  try {
    const db = Database.getInstance();
    const supabase = db.getClient();

    if (!supabase) {
      console.log('❌ Database not configured');
      return;
    }

    console.log('✅ Database connection established');

    // Test 1: Check if we can query auth.users directly
    console.log('\n📋 Test 1: Querying auth.users table...');
    try {
      const { data: users, error } = await supabase
        .from('auth.users')
        .select('id, email, raw_user_meta_data')
        .limit(1);

      if (error) {
        console.log('❌ Auth users query failed:', error.message);
      } else {
        console.log('✅ Auth users query successful, found', users?.length || 0, 'users');
      }
    } catch (err) {
      console.log('❌ Auth users query error:', err.message);
    }

    // Test 2: Check if complaints table exists and is accessible
    console.log('\n📋 Test 2: Checking complaints table...');
    try {
      const { data: complaints, error } = await supabase
        .from('complaints')
        .select('*')
        .limit(1);

      if (error) {
        console.log('❌ Complaints table query failed:', error.message);
      } else {
        console.log('✅ Complaints table accessible, found', complaints?.length || 0, 'complaints');
      }
    } catch (err) {
      console.log('❌ Complaints table error:', err.message);
    }

    // Test 3: Test user role lookup (similar to what happens in markAssignmentComplete)
    console.log('\n📋 Test 3: Testing user role lookup...');
    try {
      // Get first user for testing
      const { data: testUsers } = await supabase
        .from('auth.users')
        .select('id, raw_user_meta_data')
        .limit(1);

      if (testUsers && testUsers.length > 0) {
        const testUserId = testUsers[0].id;

        const { data: userData, error } = await supabase
          .from('auth.users')
          .select('id, email, raw_user_meta_data, user_metadata')
          .eq('id', testUserId)
          .single();

        if (error) {
          console.log('❌ User lookup failed:', error.message);
        } else {
          const userRole = userData?.raw_user_meta_data?.role || userData?.user_metadata?.role;
          console.log('✅ User lookup successful:', {
            userId: userData.id,
            email: userData.email,
            role: userRole
          });
        }
      } else {
        console.log('⚠️  No users found for testing');
      }
    } catch (err) {
      console.log('❌ User lookup error:', err.message);
    }

    console.log('\n✅ Test completed');
    console.log('');
    console.log('💡 If all tests show ✅, the fixes should resolve the permission issues');
    console.log('💡 If any tests show ❌, the database RLS policies may need manual adjustment');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testComplaintSubmission();
