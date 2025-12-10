/**
 * Scan Complaints Outside Boundary
 * Checks all complaints in the database to find those outside Digos City boundary
 */

// Load environment variables
require('dotenv').config();

const { isWithinDigosBoundary, getDigosBounds } = require('../src/shared/boundaryValidator');
const Database = require('../src/server/config/database');

async function scanComplaintsOutsideBoundary() {
  console.log('[SCAN] Starting scan for complaints outside Digos City boundary...\n');

  // Load boundary to get bounds for quick pre-check
  const bounds = getDigosBounds();
  if (bounds) {
    console.log('[SCAN] Digos City Bounds:');
    console.log(`  Latitude: ${bounds.minLat.toFixed(6)} to ${bounds.maxLat.toFixed(6)}`);
    console.log(`  Longitude: ${bounds.minLng.toFixed(6)} to ${bounds.maxLng.toFixed(6)}\n`);
  }

  // Initialize database
  const db = new Database();
  const supabase = db.getClient();

  if (!supabase) {
    console.error('[SCAN] Failed to initialize database connection');
    process.exit(1);
  }

  try {
    // Fetch all complaints with coordinates
    console.log('[SCAN] Fetching all complaints with coordinates...');
    const { data: complaints, error } = await supabase
      .from('complaints')
      .select('id, title, latitude, longitude, submitted_at, location_text, workflow_status')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) {
      console.error('[SCAN] Database error:', error);
      process.exit(1);
    }

    if (!complaints || complaints.length === 0) {
      console.log('[SCAN] No complaints found with coordinates');
      process.exit(0);
    }

    console.log(`[SCAN] Found ${complaints.length} complaint(s) with coordinates\n`);

    // Scan each complaint
    const outsideBoundary = [];
    const invalidCoordinates = [];
    let checked = 0;

    for (const complaint of complaints) {
      checked++;
      const lat = parseFloat(complaint.latitude);
      const lng = parseFloat(complaint.longitude);

      // Validate coordinates
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        invalidCoordinates.push({
          id: complaint.id,
          title: complaint.title,
          latitude: complaint.latitude,
          longitude: complaint.longitude,
          reason: 'Invalid coordinate values'
        });
        continue;
      }

      // Check if within boundary
      const withinBoundary = isWithinDigosBoundary(lat, lng);

      if (!withinBoundary) {
        outsideBoundary.push({
          id: complaint.id,
          title: complaint.title || 'Untitled',
          latitude: lat,
          longitude: lng,
          location_text: complaint.location_text || 'N/A',
          submitted_at: complaint.submitted_at,
          workflow_status: complaint.workflow_status || 'unknown'
        });
      }

      // Progress indicator
      if (checked % 100 === 0) {
        console.log(`[SCAN] Checked ${checked}/${complaints.length} complaints...`);
      }
    }

    // Report results
    console.log(`\n${  '='.repeat(80)}`);
    console.log('SCAN RESULTS');
    console.log('='.repeat(80));
    console.log(`Total complaints scanned: ${complaints.length}`);
    console.log(`Complaints within boundary: ${complaints.length - outsideBoundary.length - invalidCoordinates.length}`);
    console.log(`Complaints outside boundary: ${outsideBoundary.length}`);
    console.log(`Complaints with invalid coordinates: ${invalidCoordinates.length}`);
    console.log(`${'='.repeat(80)  }\n`);

    if (invalidCoordinates.length > 0) {
      console.log('INVALID COORDINATES:');
      console.log('-'.repeat(80));
      invalidCoordinates.forEach((complaint, index) => {
        console.log(`${index + 1}. ID: ${complaint.id}`);
        console.log(`   Title: ${complaint.title}`);
        console.log(`   Coordinates: (${complaint.latitude}, ${complaint.longitude})`);
        console.log(`   Reason: ${complaint.reason}`);
        console.log('');
      });
    }

    if (outsideBoundary.length > 0) {
      console.log('COMPLAINTS OUTSIDE DIGOS CITY BOUNDARY:');
      console.log('-'.repeat(80));
      outsideBoundary.forEach((complaint, index) => {
        console.log(`${index + 1}. ID: ${complaint.id}`);
        console.log(`   Title: ${complaint.title}`);
        console.log(`   Coordinates: (${complaint.latitude.toFixed(6)}, ${complaint.longitude.toFixed(6)})`);
        console.log(`   Location: ${complaint.location_text}`);
        console.log(`   Status: ${complaint.workflow_status}`);
        console.log(`   Submitted: ${complaint.submitted_at ? new Date(complaint.submitted_at).toLocaleString() : 'N/A'}`);
        console.log(`   Google Maps: https://www.google.com/maps?q=${complaint.latitude},${complaint.longitude}`);
        console.log('');
      });

      // Generate summary CSV
      const csv = [
        'ID,Title,Latitude,Longitude,Location,Status,Submitted At,Google Maps Link',
        ...outsideBoundary.map(c =>
          `"${c.id}","${c.title.replace(/"/g, '""')}",${c.latitude},${c.longitude},"${(c.location_text || '').replace(/"/g, '""')}","${c.workflow_status}","${c.submitted_at || ''}","https://www.google.com/maps?q=${c.latitude},${c.longitude}"`
        )
      ].join('\n');

      const fs = require('fs');
      const path = require('path');
      const outputPath = path.join(__dirname, '../output/complaints-outside-boundary.csv');
      fs.writeFileSync(outputPath, csv, 'utf8');
      console.log(`\n[SCAN] CSV report saved to: ${outputPath}`);
    } else {
      console.log('✓ All complaints are within Digos City boundary!\n');
    }

    // Exit with appropriate code
    process.exit(outsideBoundary.length > 0 || invalidCoordinates.length > 0 ? 1 : 0);

  } catch (error) {
    console.error('[SCAN] Error scanning complaints:', error);
    process.exit(1);
  }
}

// Run the scan
scanComplaintsOutsideBoundary().catch(error => {
  console.error('[SCAN] Fatal error:', error);
  process.exit(1);
});

