const { createClient } = require("@supabase/supabase-js");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Supabase URL or Service Key missing in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function audit() {
  console.log("--- DRIMS Database Audit (Bypassing RBAC) ---");

  // 1. Count complaints
  const { count: totalComplaints, error: countErr } = await supabase
    .from("complaints")
    .select("*", { count: "exact", head: true });

  if (countErr) {
    console.error("Error counting complaints:", countErr);
  } else {
    console.log(`Total Complaints: ${totalComplaints}`);
  }

  // 2. Sample intelligence data
  const { data: samples, error: sampleErr } = await supabase
    .from("complaints")
    .select("id, category, subcategory, triage_score, intelligence, ai_reclassified, ai_downgraded")
    .limit(10);

  if (sampleErr) {
    console.error("Error fetching samples:", sampleErr);
  } else {
    console.log("\n--- Samples (Intelligence & AI Reclassification) ---");
    samples.forEach(s => {
      console.log(`ID: ${s.id} | Cat: ${s.category} | AI Reclassified: ${s.ai_reclassified} | Intelligence: ${s.intelligence ? "Yes" : "No"}`);
    });
  }

  // 3. Category distribution
  const { data: catDist, error: catErr } = await supabase
    .from("complaints")
    .select("category");

  if (catErr) {
    console.error("Error fetching categories:", catErr);
  } else {
    const counts = {};
    catDist.forEach(c => {
      counts[c.category] = (counts[c.category] || 0) + 1;
    });
    console.log("\n--- Category Distribution ---");
    console.table(counts);
  }

  // 4. Pending Reviews
  const { data: pending, error: pendingErr } = await supabase
    .from("pending_reviews")
    .select("*");

  if (pendingErr) {
    console.log("\nPending Reviews Table Error (Might not exist):", pendingErr.message);
  } else {
    console.log(`\nPending Reviews Count: ${pending.length}`);
    if (pending.length > 0) {
      console.log("First 5 pending reviews:");
      console.table(pending.slice(0, 5).map(p => ({
        id: p.id,
        complaint_id: p.complaint_id,
        status: p.status,
        confidence: p.confidence
      })));
    }
  }

  // 5. Training History / NLP Stats
  // Check if there are any tables related to NLP training
  const { data: tables, error: tableErr } = await supabase
    .rpc("get_tables"); // This might not work depending on permissions, but we can try common names

  console.log("\n--- Checking for Training Tables ---");
  const tableNames = ["nlp_training_history", "nlp_keywords", "nlp_categories"];
  for (const name of tableNames) {
    const { data, error } = await supabase.from(name).select("*").limit(1);
    if (!error) {
      console.log(`Table '${name}' exists and has data.`);
    } else {
      console.log(`Table '${name}' error: ${error.message}`);
    }
  }
}

audit();
