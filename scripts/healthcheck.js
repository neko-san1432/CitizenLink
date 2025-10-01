#!/usr/bin/env node

const config = require('../config/app');

async function healthCheck() {
  console.log('🏥 CitizenLink Health Check');
  console.log('='.repeat(50));
  
  let allHealthy = true;

  // Check configuration
  try {
    config.validate();
    console.log('✅ Configuration: Valid');
  } catch (error) {
    console.log('⚠️  Configuration: Missing environment variables (expected for development)');
    console.log('   Missing:', error.message);
    // Don't mark as unhealthy in development
  }

  // Check database connection
  try {
    if (config.supabase.url && config.supabase.anonKey) {
      const database = require('../src/server/config/database');
      const isConnected = await database.testConnection();
      if (isConnected) {
        console.log('✅ Database: Connected');
      } else {
        console.log('❌ Database: Connection failed');
        allHealthy = false;
      }
    } else {
      console.log('⚠️  Database: Environment variables not set (expected for development)');
    }
  } catch (error) {
    console.log('❌ Database: Error -', error.message);
    allHealthy = false;
  }

  // Check file system permissions
  try {
    const fs = require('fs').promises;
    await fs.access(config.rootDir, fs.constants.R_OK | fs.constants.W_OK);
    console.log('✅ File System: Accessible');
  } catch (error) {
    console.log('❌ File System: Access denied');
    allHealthy = false;
  }

  // Check required directories
  const requiredDirs = [
    'src/server',
    'src/client',
    'views/pages',
    'config'
  ];

  for (const dir of requiredDirs) {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      await fs.access(path.join(config.rootDir, dir));
      console.log(`✅ Directory: ${dir} exists`);
    } catch (error) {
      console.log(`❌ Directory: ${dir} missing`);
      allHealthy = false;
    }
  }

  console.log('\n' + '='.repeat(50));
  
  if (allHealthy) {
    console.log('🎉 All systems healthy!');
    process.exit(0);
  } else {
    console.log('⚠️  Some issues detected. Please review.');
    process.exit(1);
  }
}

healthCheck().catch(error => {
  console.error('Health check failed:', error);
  process.exit(1);
});
