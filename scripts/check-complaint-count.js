#!/usr/bin/env node

/**
 * Quick script to check how many complaints have coordinates in the database
 */

require('dotenv').config();
const Database = require('../src/server/config/database');

async function checkComplaintCount() {
  try {
    console.log('🔍 Checking complaint counts in database...\n');
    
    const supabase = Database.getClient();
    
    // Count total complaints
    const { count: totalComplaints } = await supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true });
    
    console.log(`📊 Total complaints in database: ${totalComplaints}`);
    
    // Count complaints with coordinates
    const { count: withCoords } = await supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    
    console.log(`📍 Complaints with coordinates: ${withCoords}`);
    
    // Get all complaints with coordinates to see their IDs
    const { data: complaints, error } = await supabase
      .from('complaints')
      .select('id, title, latitude, longitude, workflow_status')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .limit(100);
    
    if (error) {
      console.error('❌ Error fetching complaints:', error);
      return;
    }
    
    console.log(`\n📋 Sample complaints (first 10):`);
    complaints.slice(0, 10).forEach((c, i) => {
      console.log(`  ${i + 1}. ID: ${c.id.substring(0, 8)}... | Title: ${c.title} | Status: ${c.workflow_status} | Coords: ${c.latitude}, ${c.longitude}`);
    });
    
    if (complaints.length > 10) {
      console.log(`  ... and ${complaints.length - 10} more`);
    }
    
    console.log(`\n✅ Check complete!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkComplaintCount();
