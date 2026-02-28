require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log("============ CITIZENLINK ROBUST DIAGNOSTIC ============");

  // 1. ANALYZE STATUSES
  console.log("\n[1] ANALYZING WORKFLOW STATUSES");
  const { data: allComplaints, error: err1 } = await supabase
    .from("complaints")
    .select("workflow_status");

  if (err1) { console.error("DB Error:", err1); return; }

  const statusCounts = {};
  allComplaints.forEach(c => {
    const s = c.workflow_status || "NULL";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  console.table(statusCounts);

  // 2. SIMULATE REPO QUERY
  console.log("\n[2] SIMULATING REPOSITORY QUERY (Active Statuses)");
  const activeStatuses = ["submitted", "assigned", "verified", "under_review", "action_taken", "in_progress", "pending_approval"];
  console.log("Target Statuses:", activeStatuses);

  const { data: repoResults, error: err2, count } = await supabase
    .from("complaints")
    .select("id, workflow_status, descriptive_su", { count: "exact" })
    .in("workflow_status", activeStatuses)
    .order("submitted_at", { ascending: false })
    .range(0, 9);

  if (err2) {
    console.error("Query Failed:", err2);
  } else {
    console.log(`Query returned ${count} total matches.`);
    if (repoResults.length === 0) {
      console.log("⚠️  Returned array is EMPTY.");
    } else {
      console.log("Sample Row:", repoResults[0]);
    }
  }

  // 3. CHECK DEPARTMENT FILTER POTENTIAL
  console.log("\n[3] CHECKING DEPARTMENT DATA");
  const { data: deptData } = await supabase
    .from("complaints")
    .select("department_r")
    .limit(5);
  console.log("Department Sample:", deptData.map(d => d.department_r));

  // 4. CHECK USER PROFILE (Mock)
  // We can't check the specific logged-in user without their ID, but we can verify if policies exist.
  // Since we use Service Role, RLS is moot, but business logic might use it.

  console.log("\n======================================================");
  console.log("CONCLUSION:");
  if (repoResults && repoResults.length > 0) {
    console.log("✅ The database HAS matching data.");
    console.log("❓ If LGU/Coordinator View is empty, check:");
    console.log('   - Is the frontend actually hitting "/api/coordinator/review-queue"?');
    console.log('   - Is "page" or "limit" param causing offset issues?');
    console.log('   - Does the Controller accidentally inject a "department" filter?');
  } else {
    console.log("❌ The database has NO matching data for the active statuses.");
    console.log('   Action: Use manual_complaint_updates.sql to set a complaint to "verified"');
  }
}

diagnose();
