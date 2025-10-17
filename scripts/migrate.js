#!/usr/bin/env node

// Load environment variables from .env file
require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const config = require('../config/app');

async function runMigrations() {
  console.log('🗃️  CitizenLink Database Migration');
  console.log('='.repeat(50));

  try {
    console.log('🔍 Checking database tables...');
    
    // Check if database is connected and tables exist
    try {
      const Database = require('../src/server/config/database');
      const db = new Database();
      const supabase = db.getClient();
      
      if (!supabase) {
        console.log('❌ Database not configured. Please set environment variables.');
        return;
      }
      
      // Check for CitizenLink tables
      const tablesToCheck = [
        'complaints',
        'departments', 
        'settings',
        'complaint_coordinators',
        'complaint_workflow_logs'
      ];
      
      console.log('📊 Checking CitizenLink tables...');
      
      for (const tableName of tablesToCheck) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
            
          if (error) {
            console.log(`❌ Table '${tableName}': Not found or no access`);
          } else {
            console.log(`✅ Table '${tableName}': Exists and accessible`);
          }
        } catch (err) {
          console.log(`❌ Table '${tableName}': Error - ${err.message}`);
        }
      }
      
    } catch (dbError) {
      console.log('❌ Database connection failed:', dbError.message);
    }
    
    console.log('\n📋 Checking migration files...');

    // Read migration files
    const migrationFiles = [
      'DB_FORMAT.sql',                   // Supabase Auth schema (reference only)
      'sql/20251006_core_tables.sql',    // CitizenLink core application tables
      'sql/20251006_schema_delta.sql'    // Additive schema updates for existing DBs
    ];
    
    console.log('📋 Available migration files:');
    console.log('   - DB_FORMAT.sql (Supabase Auth schema - reference only)');
    console.log('   - sql/20251006_core_tables.sql (CitizenLink core tables)');
    console.log('');

    for (const filename of migrationFiles) {
      const filePath = path.join(config.rootDir, filename);
      
      try {
        await fs.access(filePath);
        console.log(`📄 Found migration: ${filename}`);
        
        const sqlContent = await fs.readFile(filePath, 'utf8');
        
        // Note: In a real implementation, you'd want to:
        // 1. Parse SQL statements properly
        // 2. Track which migrations have been run
        // 3. Handle rollbacks
        // 4. Validate schema changes
        
        console.log(`📄 Found: ${filename}`);
        console.log(`📝 Content: ${sqlContent.length} characters`);
        if (filename.includes('DB_FORMAT.sql')) {
          console.log(`⚠️  This file is for REFERENCE ONLY - contains Supabase Auth schema`);
          console.log(`ℹ️  Supabase Auth tables are automatically managed by Supabase`);
        } else {
          console.log(`ℹ️  Apply this SQL in Supabase SQL Editor to create application tables.`);
        }
        
      } catch (error) {
        console.log(`⚠️  Migration file not found: ${filename}`);
      }
    }

    console.log('\n✅ Migration check completed');
    console.log('');
    console.log('💡 SUMMARY:');
    console.log('- If all tables show ✅, your database is ready!');
    console.log('- If any tables show ❌, create them via Supabase Dashboard');
    console.log('- Run "npm run check" to verify full system health');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigrations();
