/**
 * Delete Complaints Outside Boundary
 * Deletes complaints that are located outside the Digos City boundary
 * Usage: node scripts/delete-complaints-outside-boundary.js [--dry-run]
 */

// Load environment variables
require("dotenv").config();

const {
  isWithinDigosBoundary,
  getDigosBounds,
} = require("../src/shared/boundaryValidator");
const Database = require("../src/server/config/database");
const fs = require("fs");
const path = require("path");

async function deleteComplaintsOutsideBoundary() {
  const isDryRun = process.argv.includes("--dry-run");
  const mode = isDryRun ? "DRY RUN" : "LIVE EXECUTION";

  console.log(
    `[DELETE] Starting deletion process for complaints outside Digos City boundary...`
  );
  console.log(`[DELETE] Mode: ${mode}\n`);

  // Initialize database
  const db = new Database();
  const supabase = db.getClient();

  if (!supabase) {
    console.error("[DELETE] Failed to initialize database connection");
    process.exit(1);
  }

  try {
    // Fetch all complaints with coordinates
    console.log("[DELETE] Fetching all complaints with coordinates...");
    const { data: complaints, error } = await supabase
      .from("complaints")
      .select(
        "id, title, latitude, longitude, location_text, submitted_at, workflow_status"
      )
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (error) {
      console.error("[DELETE] Database error:", error);
      process.exit(1);
    }

    if (!complaints || complaints.length === 0) {
      console.log("[DELETE] No complaints found with coordinates");
      process.exit(0);
    }

    console.log(
      `[DELETE] Found ${complaints.length} complaint(s) with coordinates\n`
    );

    // Find complaints outside boundary
    const complaintsToDelete = [];
    let checked = 0;

    for (const complaint of complaints) {
      checked++;
      const lat = parseFloat(complaint.latitude);
      const lng = parseFloat(complaint.longitude);

      // Validate coordinates (if invalid, we should probably delete too, but let's stick to boundary for now)
      if (isNaN(lat) || isNaN(lng)) {
        continue;
      }

      // Check if within boundary
      const withinBoundary = isWithinDigosBoundary(lat, lng);

      if (!withinBoundary) {
        complaintsToDelete.push({
          id: complaint.id,
          title: complaint.title || "Untitled",
          latitude: lat,
          longitude: lng,
          location_text: complaint.location_text || "N/A",
          workflow_status: complaint.workflow_status,
        });
      }

      // Progress indicator
      if (checked % 100 === 0) {
        process.stdout.write(
          `[DELETE] Checked ${checked}/${complaints.length} complaints...\r`
        );
      }
    }
    console.log(""); // New line after progress

    console.log(
      `\n[DELETE] Found ${complaintsToDelete.length} complaint(s) outside boundary to delete\n`
    );

    if (complaintsToDelete.length === 0) {
      console.log("✓ All complaints are within Digos City boundary!\n");
      process.exit(0);
    }

    // Backup/Report before deletion
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(
      __dirname,
      `../output/backup-deleted-complaints-${timestamp}.csv`
    );

    // Ensure output dir exists
    const outputDir = path.join(__dirname, "../output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const csvHeader = "ID,Title,Latitude,Longitude,Location,Status\n";
    const csvContent = complaintsToDelete
      .map(
        (c) =>
          `"${c.id}","${(c.title || "").replace(/"/g, '""')}",${c.latitude},${
            c.longitude
          },"${(c.location_text || "").replace(/"/g, '""')}","${
            c.workflow_status
          }"`
      )
      .join("\n");

    fs.writeFileSync(backupPath, csvHeader + csvContent, "utf8");
    console.log(`[DELETE] Backup of candidates saved to: ${backupPath}\n`);

    // Preview
    console.log("Preview of items to delete (first 5):");
    complaintsToDelete.slice(0, 5).forEach((c) => {
      console.log(
        ` - ID: ${c.id} | Loc: (${c.latitude}, ${c.longitude}) | Title: ${c.title}`
      );
    });
    if (complaintsToDelete.length > 5)
      console.log(`   ... and ${complaintsToDelete.length - 5} more.`);
    console.log("");

    if (isDryRun) {
      console.log("[DELETE] DRY RUN COMPLETE. No data was modified.");
      console.log(
        "To actually delete these records, run the script without --dry-run"
      );
      process.exit(0);
    }

    // Perform Deletion
    console.log("[DELETE] Proceeding with deletion...");
    const idsToDelete = complaintsToDelete.map((c) => c.id);

    const { error: deleteError, count } = await supabase
      .from("complaints")
      .delete({ count: "exact" })
      .in("id", idsToDelete);

    if (deleteError) {
      console.error("[DELETE] Failed to delete complaints:", deleteError);
      process.exit(1);
    }

    console.log(
      `[DELETE] Successfully deleted ${
        count !== null ? count : "unknown number of"
      } complaints.`
    );
    console.log(`[DELETE] Operation complete.`);
  } catch (error) {
    console.error("[DELETE] Unexpected error:", error);
    process.exit(1);
  }
}

// Run the script
deleteComplaintsOutsideBoundary().catch((error) => {
  console.error("[DELETE] Fatal error:", error);
  process.exit(1);
});
