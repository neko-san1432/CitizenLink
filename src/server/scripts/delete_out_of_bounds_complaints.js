/**
 * Script to delete complaints that are outside the boundary of Digos City.
 * This script identifies complaints with coordinates outside the Digos boundary
 * and removes them along with their dependent records.
 */

require("dotenv").config();
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { isWithinDigosBoundary } = require("../../shared/boundaryValidator");

// Initialize Supabase client with Service Role Key to bypass RLS
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env");
  process.exit(1);
}

// SET THIS TO FALSE TO ACTUALLY DELETE RECORDS
const DRY_RUN = false;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanOutOfBoundsComplaints() {
  console.log(`🔍 [${DRY_RUN ? "DRY RUN" : "LIVE MODE"}] Fetching all complaints to evaluate coordinates...`);

  // Fetch all complaints with their IDs and coordinates
  const { data: complaints, error } = await supabase
    .from("complaints")
    .select("id, latitude, longitude, description, submitted_at")
    .limit(15000);

  if (error) {
    console.error("❌ Error fetching complaints:", error.message);
    return;
  }

  console.log(`📊 Found ${complaints.length} complaints in total.`);

  // Quiet the boundary validator's own logging during filtering
  const originalLog = console.log;
  console.log = () => {};

  // For STRICT validation: we avoid the fallback to bounding box in the project's validator
  const boundary = require("../../shared/boundaryValidator").loadDigosBoundary();
  const { coordinates, type } = boundary.geometry;

  // Helper functions for point-in-polygon (avoiding dependency on potentially permissive validator)
  function isPointInRing(point, ring) {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointInPolygon(point, polygonCoords) {
    const outerRing = polygonCoords[0];
    let inside = isPointInRing(point, outerRing);
    if (inside && polygonCoords.length > 1) {
      for (let i = 1; i < polygonCoords.length; i++) {
        if (isPointInRing(point, polygonCoords[i])) { inside = false; break; }
      }
    }
    return inside;
  }

  const outOfBounds = complaints.filter(c => {
    if (!c.latitude || !c.longitude) return false;

    const lat = typeof c.latitude === "string" ? parseFloat(c.latitude) : c.latitude;
    const lng = typeof c.longitude === "string" ? parseFloat(c.longitude) : c.longitude;

    if (isNaN(lat) || isNaN(lng)) return false;

    const point = [lng, lat];
    let isInside = false;

    if (type === "Polygon") {
      isInside = pointInPolygon(point, coordinates);
    } else if (type === "MultiPolygon") {
      for (const poly of coordinates) {
        if (pointInPolygon(point, poly)) { isInside = true; break; }
      }
    }

    return !isInside;
  });

  // Restore console.log
  console.log = originalLog;

  if (outOfBounds.length === 0) {
    console.log("✅ No out-of-bounds complaints found.");
    return;
  }

  // Save results to a file for easy reading
  require("fs").writeFileSync("out_of_bounds_results.json", JSON.stringify(outOfBounds, null, 2));
  console.log(`📝 Saved ${outOfBounds.length} out-of-bounds records to out_of_bounds_results.json`);

  console.log(`🧨 Identified ${outOfBounds.length} out-of-bounds complaints to delete.`);

  // Show a few examples
  outOfBounds.slice(0, 5).forEach(c => {
    console.log(`   - ID: ${c.id.substring(0, 8)}..., Loc: [${c.latitude}, ${c.longitude}], Desc: ${c.description?.substring(0, 40).replace(/\n/g, " ")}...`);
  });

  if (outOfBounds.length > 10) {
    console.log(`   ... and ${outOfBounds.length - 10} more.`);
  }

  if (DRY_RUN) {
    console.log("\n⚠️  DRY RUN ENABLED: No records were actually deleted.");
    console.log("👉 Set 'const DRY_RUN = false;' in the script to proceed with deletion.");
    return;
  }

  const outOfBoundsIds = outOfBounds.map(c => c.id);

  try {
    // Tables that need cleanup before deleting the complaint (due to foreign key constraints without CASCADE)
    // Based on dbFormat.sql analysis
    const dependentTables = [
      "complaint_assignments",
      "complaint_history",
      "complaint_upvotes",
      "complaint_workflow_logs",
      "notifications",
      "nlp_pending_reviews",
      "complaint_similarities",
      "complaint_duplicates"
    ];

    console.log("🧹 Cleaning up dependent records...");

    // Process in chunks of 100 to avoid issues with large 'In' clauses
    const chunkSize = 100;
    for (let i = 0; i < outOfBoundsIds.length; i += chunkSize) {
      const chunk = outOfBoundsIds.slice(i, i + chunkSize);

      for (const table of dependentTables) {
        // Handle special cases for column names if necessary
        let idColumn = "complaint_id";
        if (table === "complaint_duplicates") idColumn = "duplicate_complaint_id"; // or master_complaint_id

        const { error: delError } = await supabase
          .from(table)
          .delete()
          .in(idColumn, chunk);

        if (delError) {
          console.warn(`⚠️ Warning: Failed to clean up table ${table} for some records:`, delError.message);
        }

        // Handle master_complaint_id for duplicates separately if it exists
        if (table === "complaint_duplicates") {
          await supabase.from(table).delete().in("master_complaint_id", chunk);
        }

        // Handle similar_complaint_id for similarities
        if (table === "complaint_similarities") {
          await supabase.from(table).delete().in("similar_complaint_id", chunk);
        }
      }
    }

    console.log("🗑️ Deleting complaints from 'complaints' table...");
    for (let i = 0; i < outOfBoundsIds.length; i += chunkSize) {
      const chunk = outOfBoundsIds.slice(i, i + chunkSize);
      const { error: delError } = await supabase
        .from("complaints")
        .delete()
        .in("id", chunk);

      if (delError) {
        throw new Error(`Failed to delete complaints: ${delError.message}`);
      }
    }

    console.log(`✨ Successfully deleted ${outOfBounds.length} out-of-bounds complaints.`);

  } catch (error) {
    console.error("❌ Critical error during deletion process:", error.message);
  }
}

// Run the script
cleanOutOfBoundsComplaints()
  .then(() => {
    console.log("🏁 Process finished.");
  })
  .catch(err => {
    console.error("💥 Unhandled error:", err);
    process.exit(1);
  });
