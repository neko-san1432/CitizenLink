const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function checkRecoverySources() {
  const results = {};

  const { data: nlp } = await supabase.from("nlp_proposals").select("complaint_id, proposed_category, proposed_subcategory").limit(3);
  results.nlp_proposals = nlp;

  const { data: history } = await supabase.from("complaint_history").select("complaint_id, action, details").ilike("details", "%category%").limit(3);
  results.complaint_history = history;

  const { data: audit } = await supabase.from("audit_logs").select("old_data, new_data").eq("target_type", "complaints").limit(3);
  results.audit_logs = audit;

  fs.writeFileSync("tmp/recovery_audit.json", JSON.stringify(results, null, 2));
  console.log("Recovery audit complete.");
}

checkRecoverySources();
