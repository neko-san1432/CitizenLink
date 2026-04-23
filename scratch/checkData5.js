const Database = require("../src/server/config/database");
const db = Database.getInstance();
const supabase = db.getClient();

async function check() {
  const { data: complaints, error } = await supabase.from("complaints").select("*");
  if (error) {
    console.error(error);
    return;
  }

  const active = complaints.filter(c => c.workflow_status?.toLowerCase() !== "completed");
  console.log(`Total Complaints: ${complaints.length}`);
  console.log(`Active (Not Completed): ${active.length}`);
  
  const catCounts = {};
  complaints.forEach(c => {
    const cid = c.category_id;
    catCounts[cid] = (catCounts[cid] || 0) + 1;
  });

  const { data: categories } = await supabase.from("categories").select("id, name");
  const catMap = {};
  categories.forEach(c => catMap[c.id] = c.name);

  console.log("\nComplaints per category:");
  Object.keys(catCounts).forEach(id => {
    console.log(`${catMap[id] || id}: ${catCounts[id]}`);
  });

  const { data: depts } = await supabase.from("departments").select("code, name");
  console.log("\nValid Dept Codes:", depts.map(d => d.code).join(", "));
}

check();
