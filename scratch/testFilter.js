require("dotenv").config();
const Database = require("../src/server/config/database");
const db = Database.getInstance();
const supabase = db.getClient();

async function test(deptCode) {
  const dptToCategory = {
    "cdrrmo": "Emergency",
    "cdrrmu": "Emergency",
    "pnp": "Public Safety",
    "eng": "Infrastructure",
    "hlt": "Sanitation",
    "gso": "Utilities"
  };
  const searchCat = dptToCategory[deptCode.toLowerCase()] || deptCode;

  const { data: cat } = await supabase
    .from("categories")
    .select("id, name")
    .or(`code.ilike.${searchCat},name.ilike.%${searchCat}%`)
    .maybeSingle();

  console.log(`\nTesting Dept: ${deptCode}`);
  console.log(`Mapped searchCat: ${searchCat}`);
  console.log(`Found Category:`, cat);

  if (cat) {
    const filter = `departments.cs.{${deptCode}},category_id.eq.${cat.id}`;
    console.log(`Using Filter: ${filter}`);
    const { count, error } = await supabase
      .from("complaints")
      .select("id", { count: "exact", head: true })
      .or(filter);

    if (error) console.error("Filter Error:", error);
    console.log(`Total Active Complaints: ${count}`);
  } else {
    console.log(`No category found for ${searchCat}`);
  }
}

async function run() {
  await test("ENG");
  await test("HLT");
  await test("CDRRMU");
  await test("PNP");
}

run();
