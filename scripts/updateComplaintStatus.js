require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updatecomplaintStatus() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log("Usage: node scripts/updatecomplaintStatus.js <complaint_id> <status> [message] [user_id_for_log]");
    console.log("Valid statuses: submitted, verified, under_review, action_taken, resolved, cancelled");
    process.exit(1);
  }

  const complaintId = args[0];
  const newStatus = args[1].toLowerCase();
  const message = args[2] || `Status updated to ${newStatus}`;
  // optional user id to attribute the log to (defaults to system/null if not provided)
  const userId = args[3] || null;

  // Validate status
  const validStatuses = ["new", "submitted", "verified", "under_review", "action_taken", "resolved", "completed", "cancelled"];
  if (!validStatuses.includes(newStatus)) {
    console.error(`Invalid status: ${newStatus}. Must be one of: ${validStatuses.join(", ")}`);
    process.exit(1);
  }

  console.log(`Updating complaint ${complaintId} to status '${newStatus}'...`);

  try {
    // 1. Update the complaint table
    const { error: updateError } = await supabase
      .from("complaints")
      .update({
        workflow_status: newStatus,
        status: newStatus === "resolved" ? "resolved" : "pending", // Sync legacy status
        updated_at: new Date().toISOString()
      })
      .eq("id", complaintId);

    if (updateError) {
      throw new Error(`Failed to update complaint: ${updateError.message}`);
    }

    console.log("complaint status updated.");

    // 2. Add entry to complaint_history
    // We use 'STATUS_CHANGE' as action type usually
    const { error: logError } = await supabase
      .from("complaint_history")
      .insert({
        complaint_id: complaintId,
        action_type: newStatus.toUpperCase(), // Or STATUS_CHANGE
        performed_by: userId,
        details: {
          notes: message,
          from_status: "unknown", // Simplified, we didn't fetch previous
          to_status: newStatus
        },
        created_at: new Date().toISOString()
      });

    if (logError) {
      console.warn(`Warning: Failed to create history log: ${logError.message}`);
    } else {
      console.log("History log added.");
    }

    console.log("Done!");

  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

updatecomplaintStatus();
