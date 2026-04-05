const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function analyzeCategories() {
  console.log("--- Analyzing Categories in Complaints ---");
  const { data: complaints, error } = await supabase
    .from("complaints")
    .select("category, subcategory");

  if (error) {
    console.error("Error fetching complaints:", error);
    return;
  }

  const categoryCounts = {};
  const subcategoryCounts = {};

  complaints.forEach(c => {
    const cat = c.category || "NULL";
    const sub = c.subcategory || "NULL";
    
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    subcategoryCounts[`${cat} > ${sub}`] = (subcategoryCounts[`${cat} > ${sub}`] || 0) + 1;
  });

  console.log("\nUnique Categories found in Complaints:");
  Object.entries(categoryCounts).forEach(([cat, count]) => {
    console.log(`- ${cat}: ${count}`);
  });

  console.log("\nUnique Subcategory Pairs found in Complaints:");
  Object.entries(subcategoryCounts).forEach(([pair, count]) => {
    console.log(`- ${pair}: ${count}`);
  });

  console.log("\n--- Checking Table Schemas ---");
  const { data: catCols, error: catErr } = await supabase.from("categories").select("*").limit(1);
  if (catErr) console.error("Error checking categories table:", catErr.message);
  else console.log("Categories schema columns:", Object.keys(catCols[0] || {}));

  const { data: subCols, error: subErr } = await supabase.from("subcategories").select("*").limit(1);
  if (subErr) console.error("Error checking subcategories table:", subErr.message);
  else console.log("Subcategories schema columns:", Object.keys(subCols[0] || {}));
}

analyzeCategories();
