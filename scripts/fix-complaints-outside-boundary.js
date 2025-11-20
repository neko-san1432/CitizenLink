/**
 * Fix Complaints Outside Boundary
 * Updates coordinates for complaints outside Digos City boundary to valid points within the boundary
 */

// Load environment variables
require('dotenv').config();

const { isWithinDigosBoundary, getDigosBounds } = require('../src/shared/boundaryValidator');
const Database = require('../src/server/config/database');

/**
 * Clamp coordinate to boundary bounds
 * Moves coordinate to nearest point within the bounding box
 */
function clampToBounds(lat, lng, bounds) {
  let newLat = lat;
  let newLng = lng;

  // Clamp latitude
  if (newLat < bounds.minLat) {
    newLat = bounds.minLat;
  } else if (newLat > bounds.maxLat) {
    newLat = bounds.maxLat;
  }

  // Clamp longitude
  if (newLng < bounds.minLng) {
    newLng = bounds.minLng;
  } else if (newLng > bounds.maxLng) {
    newLng = bounds.maxLng;
  }

  return { lat: newLat, lng: newLng };
}

/**
 * Find a valid coordinate within boundary
 * Strategy: Try clamping to bounds first, then try center point if still outside
 */
function findValidCoordinate(lat, lng, bounds) {
  // First, clamp to bounding box
  let { lat: clampedLat, lng: clampedLng } = clampToBounds(lat, lng, bounds);

  // Check if clamped coordinate is within boundary
  if (isWithinDigosBoundary(clampedLat, clampedLng)) {
    return { lat: clampedLat, lng: clampedLng };
  }

  // If still outside, try center of boundary
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const centerLng = (bounds.minLng + bounds.maxLng) / 2;

  if (isWithinDigosBoundary(centerLat, centerLng)) {
    return { lat: centerLat, lng: centerLng };
  }

  // Fallback: use a known point within Digos City (approximate center)
  // This is a safe fallback point
  return { lat: 6.85, lng: 125.35 };
}

async function fixComplaintsOutsideBoundary() {
  console.log('[FIX] Starting fix for complaints outside Digos City boundary...\n');

  // Get boundary bounds
  const bounds = getDigosBounds();
  if (!bounds) {
    console.error('[FIX] Failed to load Digos City boundary');
    process.exit(1);
  }

  console.log('[FIX] Digos City Bounds:');
  console.log(`  Latitude: ${bounds.minLat.toFixed(6)} to ${bounds.maxLat.toFixed(6)}`);
  console.log(`  Longitude: ${bounds.minLng.toFixed(6)} to ${bounds.maxLng.toFixed(6)}\n`);

  // Initialize database
  const db = new Database();
  const supabase = db.getClient();

  if (!supabase) {
    console.error('[FIX] Failed to initialize database connection');
    process.exit(1);
  }

  try {
    // Fetch all complaints with coordinates
    console.log('[FIX] Fetching all complaints with coordinates...');
    const { data: complaints, error } = await supabase
      .from('complaints')
      .select('id, title, latitude, longitude, location_text')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) {
      console.error('[FIX] Database error:', error);
      process.exit(1);
    }

    if (!complaints || complaints.length === 0) {
      console.log('[FIX] No complaints found with coordinates');
      process.exit(0);
    }

    console.log(`[FIX] Found ${complaints.length} complaint(s) with coordinates\n`);

    // Find complaints outside boundary
    const complaintsToFix = [];
    let checked = 0;

    for (const complaint of complaints) {
      checked++;
      const lat = parseFloat(complaint.latitude);
      const lng = parseFloat(complaint.longitude);

      // Validate coordinates
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        continue;
      }

      // Check if within boundary
      const withinBoundary = isWithinDigosBoundary(lat, lng);

      if (!withinBoundary) {
        const newCoords = findValidCoordinate(lat, lng, bounds);
        complaintsToFix.push({
          id: complaint.id,
          title: complaint.title || 'Untitled',
          oldLat: lat,
          oldLng: lng,
          newLat: newCoords.lat,
          newLng: newCoords.lng,
          location_text: complaint.location_text || 'N/A'
        });
      }

      // Progress indicator
      if (checked % 100 === 0) {
        console.log(`[FIX] Checked ${checked}/${complaints.length} complaints...`);
      }
    }

    console.log(`\n[FIX] Found ${complaintsToFix.length} complaint(s) outside boundary to fix\n`);

    if (complaintsToFix.length === 0) {
      console.log('✓ All complaints are within Digos City boundary!\n');
      process.exit(0);
    }

    // Show preview of changes
    console.log('Preview of changes (first 10):');
    console.log('-'.repeat(100));
    complaintsToFix.slice(0, 10).forEach((complaint, index) => {
      console.log(`${index + 1}. ID: ${complaint.id}`);
      console.log(`   Title: ${complaint.title}`);
      console.log(`   Old: (${complaint.oldLat.toFixed(6)}, ${complaint.oldLng.toFixed(6)})`);
      console.log(`   New: (${complaint.newLat.toFixed(6)}, ${complaint.newLng.toFixed(6)})`);
      console.log(`   Location: ${complaint.location_text}`);
      console.log('');
    });

    if (complaintsToFix.length > 10) {
      console.log(`... and ${complaintsToFix.length - 10} more\n`);
    }

    // Update complaints in batches
    console.log('[FIX] Updating complaints in database...\n');
    let updated = 0;
    let failed = 0;
    const batchSize = 50;

    for (let i = 0; i < complaintsToFix.length; i += batchSize) {
      const batch = complaintsToFix.slice(i, i + batchSize);
      
      for (const complaint of batch) {
        try {
          const { error: updateError } = await supabase
            .from('complaints')
            .update({
              latitude: complaint.newLat,
              longitude: complaint.newLng
            })
            .eq('id', complaint.id);

          if (updateError) {
            console.error(`[FIX] Failed to update complaint ${complaint.id}:`, updateError.message);
            failed++;
          } else {
            updated++;
          }
        } catch (error) {
          console.error(`[FIX] Error updating complaint ${complaint.id}:`, error.message);
          failed++;
        }
      }

      // Progress indicator
      if ((i + batchSize) % 100 === 0 || i + batchSize >= complaintsToFix.length) {
        console.log(`[FIX] Updated ${updated}/${complaintsToFix.length} complaints...`);
      }
    }

    // Report results
    console.log('\n' + '='.repeat(80));
    console.log('FIX RESULTS');
    console.log('='.repeat(80));
    console.log(`Total complaints to fix: ${complaintsToFix.length}`);
    console.log(`Successfully updated: ${updated}`);
    console.log(`Failed: ${failed}`);
    console.log('='.repeat(80) + '\n');

    // Verify fixes
    console.log('[FIX] Verifying fixes...');
    let stillOutside = 0;
    for (const complaint of complaintsToFix) {
      if (!isWithinDigosBoundary(complaint.newLat, complaint.newLng)) {
        stillOutside++;
        console.warn(`[FIX] Warning: Complaint ${complaint.id} still outside boundary after fix`);
      }
    }

    if (stillOutside === 0) {
      console.log('✓ All fixed complaints are now within the boundary!\n');
    } else {
      console.warn(`⚠️  ${stillOutside} complaint(s) still outside boundary after fix\n`);
    }

    // Generate report
    const fs = require('fs');
    const path = require('path');
    const csv = [
      'ID,Title,Old Latitude,Old Longitude,New Latitude,New Longitude,Location',
      ...complaintsToFix.map(c => 
        `"${c.id}","${c.title.replace(/"/g, '""')}",${c.oldLat},${c.oldLng},${c.newLat},${c.newLng},"${(c.location_text || '').replace(/"/g, '""')}"`
      )
    ].join('\n');

    const outputPath = path.join(__dirname, '../output/complaints-fixed-coordinates.csv');
    fs.writeFileSync(outputPath, csv, 'utf8');
    console.log(`[FIX] Report saved to: ${outputPath}\n`);

    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('[FIX] Error fixing complaints:', error);
    process.exit(1);
  }
}

// Run the fix
fixComplaintsOutsideBoundary().catch(error => {
  console.error('[FIX] Fatal error:', error);
  process.exit(1);
});

