const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from("complaints").select("priority, workflow_status");
  if (error) {
    console.error(error);
    return;
  }

  const counts = {};
  data.forEach(c => {
    const p = c.priority || "NULL";
    counts[p] = (counts[p] || 0) + 1;
  });

  console.log("Priority Counts (Total):", counts);

  const active = data.filter(c => c.workflow_status?.toLowerCase() !== "completed" && c.workflow_status?.toLowerCase() !== "cancelled");
  const activeCounts = {};
  active.forEach(c => {
    const p = c.priority || "NULL";
    activeCounts[p] = (activeCounts[p] || 0) + 1;
  });
  console.log("Priority Counts (Active):", activeCounts);
}

check();
