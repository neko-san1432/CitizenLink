const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDashboardData() {
  console.log("Debugging Dashboard Data...");

  // 1. Get PNP Department Code
  const { data: depts } = await supabase
    .from("departments")
    .select("id, name, code")
    .ilike("name", "%police%")
    .limit(1);

  if (!depts || depts.length === 0) {
    console.log("PNP Department not found");
    return;
  }
  const deptCode = depts[0].code;
  console.log(`Analyzing for Department: ${depts[0].name} (${deptCode})`);

  // 2. Priority Distribution
  const { data: priorityStats, error: pError } = await supabase
    .from("complaints")
    .select("priority")
    .contains("department_r", [deptCode]);

  console.log("\n--- Priority Distribution ---");
  if (pError) console.error(pError);
  else {
    const counts = {};
    priorityStats.forEach((c) => {
      const p = c.priority || "null";
      counts[p] = (counts[p] || 0) + 1;
    });
    console.table(counts);
  }

  // 3. Workflow Status Distribution
  const { data: statusStats, error: sError } = await supabase
    .from("complaints")
    .select("workflow_status")
    .contains("department_r", [deptCode]);

  console.log("\n--- Workflow Status Distribution ---");
  if (sError) console.error(sError);
  else {
    const counts = {};
    statusStats.forEach((c) => {
      const p = c.workflow_status || "null";
      counts[p] = (counts[p] || 0) + 1;
    });
    console.table(counts);
  }

  // 4. Submission Dates (Latest 5)
  const { data: latest, error: dError } = await supabase
    .from("complaints")
    .select("submitted_at")
    .contains("department_r", [deptCode])
    .order("submitted_at", { ascending: false })
    .limit(5);

  console.log("\n--- Latest Submissions ---");
  if (dError) console.error(dError);
  else {
    console.log(latest);
  }
}

debugDashboardData();
