const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function checkUuidComplaints() {
  console.log("--- Scanning for UUID-based Complaints ---");
  const { data: complaints, error } = await supabase
    .from("complaints")
    .select("id, category, subcategory");

  if (error) {
    console.error("Error fetching complaints:", error);
    return;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const affected = complaints.filter(c => 
    uuidRegex.test(c.category || "") || uuidRegex.test(c.subcategory || "")
  );

  console.log(`Total complaints: ${complaints.length}`);
  console.log(`Complaints with UUID instead of title: ${affected.length}`);
  
  if (affected.length > 0) {
    console.log("\nSample of affected records (IDs):");
    affected.slice(0, 5).forEach(c => console.log(`- ID: ${c.id} | Cat: ${c.category} | Sub: ${c.subcategory}`));
  }
}

checkUuidComplaints();
