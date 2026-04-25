require("dotenv").config();
const Database = require("../src/server/config/database");

async function check() {
  try {
    const supabase = Database.getServiceClient();

    const departmentCode = "CDRRMO";

    const dptToCategory = {
      "cdrrmo": "Emergency",
      "pnp": "Public Safety",
      "eng": "Infrastructure",
      "hlt": "Sanitation",
      "gso": "Utilities"
    };
    const searchCat = dptToCategory[departmentCode.toLowerCase()] || departmentCode;

    const { data: categoryDataLookup, error: catErr } = await supabase
      .from("categories")
      .select("id")
      .or(`code.ilike.${searchCat},name.ilike.%${searchCat}%`)
      .maybeSingle();

    console.log("Looking up:", searchCat);
    console.log("categoryDataLookup:", categoryDataLookup);
    if(catErr) console.error("Error:", catErr);

    const categoryId = categoryDataLookup ? categoryDataLookup.id : null;
    const deptFilter = categoryId
      ? `departments.cs.{${departmentCode}},category_id.eq.${categoryId}`
      : `departments.cs.{${departmentCode}}`;

    console.log("Final filter:", deptFilter);

    // Now test if any complaints match this filter!
    const { count, error: countErr } = await supabase
      .from("complaints")
      .select("id", { count: "exact", head: true })
      .or(deptFilter)
      .not("workflow_status", "ilike", "completed");

    console.log("Count of active complaints:", count);
    if(countErr) console.error("Count err:", countErr);

  } catch(e) { console.error(e); }
  process.exit(0);
}
check();
