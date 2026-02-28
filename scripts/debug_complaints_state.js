require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugComplaints() {
  console.log("--- Debugging Complaints Table ---");

  // 1. Count Total
  const { count, error: countError } = await supabase
    .from("complaints")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("Error counting:", countError);
    return;
  }
  console.log(`Total Complaints: ${count}`);

  // 2. Group by Workflow Status
  // Supabase doesn't support GROUP BY easily in JS client without .rpc or fetching all.
  // We'll fetch a sample.

  console.log("\n--- Sample of Recent Complaints (Top 20) ---");
  const { data, error } = await supabase
    .from("complaints")
    .select("id, workflow_status, status, department_r, submitted_at")
    .order("submitted_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching data:", error);
    return;
  }

  if (data.length === 0) {
    console.log("No complaints found.");
  } else {
    console.table(data);
  }

  console.log('\n--- Checking "Pending Review" Query Logic ---');
  const activeStatuses = ["submitted", "assigned", "verified", "under_review", "action_taken", "in_progress", "pending_approval"];

  const { count: matchCount, error: matchError } = await supabase
    .from("complaints")
    .select("*", { count: "exact", head: true })
    .in("workflow_status", activeStatuses);

  if (matchError) console.error("Error testing logic:", matchError);
  else console.log(`Complaints matching the 'active' filter: ${matchCount}`);

  console.log("\n--- Analysis ---");
  if (count > 0 && matchCount === 0) {
    console.log("ISSUE FOUND: You have complaints, but NONE match the active statuses.");
    console.log(`Your complaints likely have workflow_status set to null, 'new', 'pending', or other values not in the list: ${activeStatuses.join(", ")}`);
  } else if (matchCount > 0) {
    console.log("Data exists that SHOULD show up. If it is not showing in the UI, it might be due to RLS policies or other filters (department, etc.).");
  }
}

debugComplaints();
