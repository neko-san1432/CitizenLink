/**
 * Script to fix user metadata for gopyrrhus@g.cjc.edu.ph
 * Adds missing fields to match the expected schema
 */
require('dotenv').config();
const Database = require('../src/server/config/database');

async function fixUserMetadata() {
  try {
    console.log('🔧 Fixing user metadata for gopyrrhus@g.cjc.edu.ph...\n');
    const db = Database.getInstance();
    const supabase = db.getClient();
    if (!supabase) {
      console.error('❌ Database not configured');
      return;
    }
    const email = 'gopyrrhus@g.cjc.edu.ph';
    // First, get the current user
    console.log('📋 Fetching current user data...');
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('❌ Error listing users:', listError.message);
      console.log('\n💡 Admin API not available. Please use the SQL script instead.');
      console.log('   Run this SQL in Supabase Dashboard → SQL Editor:');
      console.log('   File: database/migrations/update_user_gopyrrhus.sql');
      console.log('\n   Or manually update via Supabase Dashboard → Authentication → Users');
      return;
    }
    const user = users.users.find(u => u.email === email);
    if (!user) {
      console.error('❌ User not found');
      return;
    }
    console.log('✅ User found');
    console.log('📝 Current metadata:', JSON.stringify(user.user_metadata, null, 2));
    // Update metadata
    const currentMeta = user.user_metadata || {};
    const updatedMeta = {
      ...currentMeta,
      // Add missing fields
      normalized_role: currentMeta.normalized_role || currentMeta.role || 'citizen',
      status: currentMeta.status || (user.email_confirmed_at ? 'active' : 'pending_verification'),
      email_verified: currentMeta.email_verified !== undefined ? currentMeta.email_verified : Boolean(user.email_confirmed_at),
      mobile_verified: currentMeta.mobile_verified || false,
      phone_verified: currentMeta.phone_verified || false,
      is_oauth: currentMeta.is_oauth || false,
      preferred_language: currentMeta.preferred_language || 'en',
      timezone: currentMeta.timezone || 'Asia/Manila',
      email_notifications: currentMeta.email_notifications !== undefined ? currentMeta.email_notifications : true,
      sms_notifications: currentMeta.sms_notifications || false,
      push_notifications: currentMeta.push_notifications !== undefined ? currentMeta.push_notifications : true,
      banStrike: currentMeta.banStrike || 0,
      banStarted: currentMeta.banStarted || null,
      banDuration: currentMeta.banDuration || null,
      permanentBan: currentMeta.permanentBan || false,
      mobile: currentMeta.mobile || currentMeta.mobile_number || '09171234567',
      updated_at: new Date().toISOString()
    };
    console.log('\n📝 Updated metadata:', JSON.stringify(updatedMeta, null, 2));
    // Update using admin API
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        user_metadata: updatedMeta
      }
    );
    if (updateError) {
      console.error('❌ Error updating user:', updateError.message);
      console.log('\n💡 You may need to run the SQL script directly in Supabase SQL Editor');
      console.log('   File: database/migrations/update_user_gopyrrhus.sql');
      return;
    }
    console.log('\n✅ User metadata updated successfully!');
    console.log('📧 Email:', updatedUser.user.email);
    console.log('📝 Metadata keys:', Object.keys(updatedUser.user.user_metadata || {}).join(', '));

    console.log('\n✨ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}
// Run the script
fixUserMetadata();
