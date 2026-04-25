const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from("complaints").select("priority, workflow_status");
  if (error) {
    console.error(error);
    return;
  }

  const unassigned = data.filter(c =>
    ["new", "pending", "unassigned"].includes(c.workflow_status?.toLowerCase())
  );

  const highUnassigned = unassigned.filter(c => c.priority === "high").length;
  const highActive = data.filter(c => c.workflow_status !== "completed" && c.priority === "high").length;

  console.log("High Priority (Unassigned):", highUnassigned);
  console.log("High Priority (Active/Total):", highActive);
}

check();
