const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function findAudit() {
  // Look for any update on the complaints table in the last hour
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('target_type', 'complaints')
    .gte('created_at', oneHourAgo)
    .limit(10);

  if (error) {
    fs.writeFileSync("tmp/audit_fail.txt", error.message);
  } else {
    fs.writeFileSync("tmp/audit_recovery.json", JSON.stringify(data, null, 2));
  }
}
findAudit();
