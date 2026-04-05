const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function finalAudit() {
  console.log("--- FINAL DATA AUDIT ---");
  const { data: complaints, error: cErr } = await supabase.from("complaints").select("id, category, subcategory");
  const { data: cats, error: caErr } = await supabase.from("categories").select("id, name");
  const { data: subs, error: sErr } = await supabase.from("subcategories").select("id, name");

  if (cErr || caErr || sErr) {
    console.error("Fetch Error:", cErr || caErr || sErr);
    return;
  }

  const validCatIds = new Set(cats.map(c => c.id));
  const validSubIds = new Set(subs.map(s => s.id));

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const toDelete = complaints.filter(c => {
    // If it's a UUID, check if it's in the valid set
    if (uuidRegex.test(c.category) && !validCatIds.has(c.category)) return true;
    if (uuidRegex.test(c.subcategory) && !validSubIds.has(c.subcategory)) return true;
    return false;
  });

  const report = {
    total: complaints.length,
    dangling: toDelete.length,
    sample: toDelete.slice(0, 5).map(c => c.id)
  };

  fs.writeFileSync("tmp/audit_report.json", JSON.stringify(report, null, 2));
  console.log("Audit complete. Report saved to tmp/audit_report.json");
  console.log(`Dangling: ${toDelete.length}`);
}

finalAudit();
