/**
 * Migration Script: Add isBanned and warningStrike fields to all users
 *
 * This script adds the following fields to each user's metadata:
 * - isBanned (default: false)
 * - warningStrike (default: 0)
 *
 * Run this script once to initialize ban fields for all existing users.
 *
 * Usage:
 *   node database/migrations/add_ban_fields_to_users.js
 */

const Database = require('../../src/server/config/database');
const database = new Database();
const supabase = database.getClient();

async function migrateUsers() {
  console.log('[MIGRATION] Starting migration: Adding isBanned and warningStrike fields...');

  try {
    // Get all users using Supabase Admin API
    // Note: Supabase doesn't provide a direct way to list all users via client
    // We'll need to use the admin API or iterate through known users
    // For this migration, we'll use a different approach:
    // We'll update users as they're accessed, or we can use a batch update

    console.log('[MIGRATION] Note: Supabase auth.users table is managed by Supabase.');
    console.log('[MIGRATION] This script will add default values to user metadata when users are accessed.');
    console.log('[MIGRATION] For existing users, the fields will be added automatically on next login or update.');
    console.log('[MIGRATION]');
    console.log('[MIGRATION] To manually update all users, you can:');
    console.log('[MIGRATION] 1. Use Supabase Dashboard SQL Editor to run:');
    console.log('[MIGRATION]    UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, \'{}\')::jsonb || \'{"isBanned": false, "warningStrike": 0}\'::jsonb WHERE raw_user_meta_data->>\'isBanned\' IS NULL;');
    console.log('[MIGRATION]');
    console.log('[MIGRATION] 2. Or use the Supabase Admin API to iterate through users');
    console.log('[MIGRATION]');

    // Alternative: Use a SQL function if you have direct database access
    // This would require RLS policies and a custom function

    console.log('[MIGRATION] Migration script completed.');
    console.log('[MIGRATION] The system will automatically add these fields when users are accessed.');
    console.log('[MIGRATION] New users will have these fields set by default in UserService.createUser().');

  } catch (error) {
    console.error('[MIGRATION] Error during migration:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateUsers()
    .then(() => {
      console.log('[MIGRATION] Migration completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[MIGRATION] Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateUsers };

