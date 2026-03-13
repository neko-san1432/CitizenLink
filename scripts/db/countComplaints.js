const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function countcomplaints() {
  const { count, error } = await supabase
    .from("complaints")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("Error counting complaints:", error);
  } else {
    console.log(`Total complaints in DB: ${count}`);
  }
}

countcomplaints();
