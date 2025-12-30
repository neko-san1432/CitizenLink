const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using service role key to bypass RLS recursion
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPnpUnassigned() {
  console.log("Checking PNP Department Code...");

  // 1. Get PNP Department Code
  const { data: depts, error: deptError } = await supabase
    .from("departments")
    .select("id, name, code")
    .ilike("name", "%police%"); // Search for police

  if (deptError) {
    console.error("Error fetching departments:", deptError);
    return;
  }

  if (!depts || depts.length === 0) {
    console.log(
      'No "Police" department found. Listing all departments to manually check:'
    );
    const { data: allDepts } = await supabase
      .from("departments")
      .select("name, code")
      .limit(10);
    console.table(allDepts);
    return;
  }

  console.log("Found Departments:", depts);
  const pnpDept = depts[0]; // Assuming the first one is correct
  const departmentCode = pnpDept.code;

  console.log(
    `\nChecking Unassigned Complaints for ${pnpDept.name} (${departmentCode})...`
  );

  // 2. Fetch Unassigned Complaints
  const {
    data: complaints,
    error: complaintError,
    count,
  } = await supabase
    .from("complaints")
    .select("id, title, workflow_status, submitted_at, priority", {
      count: "exact",
    })
    .contains("department_r", [departmentCode])
    .in("workflow_status", [
      "new",
      "pending",
      "unassigned",
      "New",
      "Pending",
      "Unassigned",
      "NEW",
      "PENDING",
      "UNASSIGNED",
    ])
    .order("submitted_at", { ascending: false });

  if (complaintError) {
    console.error("Error fetching complaints:", complaintError);
  } else {
    console.log(`\nTotal Unassigned found: ${count}`);
    if (complaints.length > 0) {
      console.table(
        complaints.map((c) => ({
          ID: c.id.slice(0, 8),
          Title: c.title.substring(0, 30),
          Status: c.workflow_status,
          Priority: c.priority,
          Submitted: new Date(c.submitted_at).toLocaleDateString(),
        }))
      );
    }
  }
}

checkPnpUnassigned();
