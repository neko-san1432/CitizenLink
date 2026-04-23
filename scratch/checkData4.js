require('dotenv').config();
const Database = require("../src/server/config/database");
const db = Database.getInstance();
const supabase = db.getClient();

async function check() {
  const { data: complaints, error } = await supabase
    .from("complaints")
    .select("id, departments, category_id, priority, workflow_status");

  if (error) {
    console.error(error);
    return;
  }

  const active = complaints.filter(c => c.workflow_status?.toLowerCase() !== "completed");
  console.log(`Total Complaints: ${complaints.length}`);
  console.log(`Active (Not Completed): ${active.length}`);
  complaints.forEach(c => {
    const deps = c.departments || [];
    deps.forEach(d => {
      stats[d] = (stats[d] || 0) + 1;
    });
  });

  console.log("Complaints per department tag:");
  console.log(stats);

  const { data: cats } = await supabase.from("categories").select("id, name, code");
  console.log("\nCategories:");
  console.log(cats);

  const catCounts = {};
  complaints.forEach(c => {
    const catName = cats.find(cat => cat.id === c.category_id)?.name || "Unknown";
    catCounts[catName] = (catCounts[catName] || 0) + 1;
  });
  console.log("\nComplaints per category:");
  console.log(catCounts);
  const noCat = complaints.filter(c => !c.category_id);
  console.log(`Complaints with no Category: ${noCat.length}`);
}

check();
