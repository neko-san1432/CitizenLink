const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectValues() {
  console.log("Inspecting DB values...");

  // Check distinct workflow_status
  const { data: statuses, error: statusError } = await supabase
    .from("complaints")
    .select("workflow_status");

  if (statusError) {
    console.error("Error fetching statuses:", statusError);
  } else {
    const uniqueStatuses = [...new Set(statuses.map((s) => s.workflow_status))];
    console.log("Distinct workflow_status:", uniqueStatuses);
  }

  // Check distinct priority
  const { data: priorities, error: prioError } = await supabase
    .from("complaints")
    .select("priority");

  if (prioError) {
    console.error("Error fetching priorities:", prioError);
  } else {
    const uniquePriorities = [...new Set(priorities.map((p) => p.priority))];
    console.log("Distinct priority:", uniquePriorities);
  }

  // Check department_r format
  const { data: depts, error: deptError } = await supabase
    .from("complaints")
    .select("department_r")
    .limit(5);

  if (deptError) {
    console.error("Error fetching depts:", deptError);
  } else {
    console.log("Sample department_r:", JSON.stringify(depts, null, 2));
  }
}

inspectValues();
