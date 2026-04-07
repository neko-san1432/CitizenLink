const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function auditLookupTables() {
  const { data: cats, error: cErr } = await supabase.from("categories").select("id, name");
  const { data: subs, error: sErr } = await supabase.from("subcategories").select("id, name");

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const badCats = cats?cats.filter(c => uuidRegex.test(c.name)):[];
  const badSubs = subs?subs.filter(s => uuidRegex.test(s.name)):[];

  let linkedComplaints = 0;
  if (badCats.length > 0 || badSubs.length > 0) {
    const badCatIds = badCats.map(c => c.id);
    const badSubIds = badSubs.map(s => s.id);

    const { data: linked, error: lErr } = await supabase.from("complaints")
      .select("id")
      .or(`category.in.(${badCatIds.join(",")}),subcategory.in.(${badSubIds.join(",")})`);
    if (linked) linkedComplaints = linked.length;
  }

  const report = {
    badCategories: badCats.length,
    badSubcategories: badSubs.length,
    linkedComplaints,
    samples: {
      cats: badCats.slice(0, 3),
      subs: badSubs.slice(0, 3)
    }
  };

  fs.writeFileSync("tmp/lookup_audit_report.json", JSON.stringify(report, null, 2));
}

auditLookupTables();
