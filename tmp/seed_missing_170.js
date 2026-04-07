require("dotenv").config({ path: "../.env" });
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function generateAdditionalComplaints() {
  const userId = "85fb7b44-ad98-4607-a12f-1273f65fb365";
  const catId = "0c453bce-a885-4223-b105-057165e837c3";
  const subId = "cdcb3b0c-d1ab-46a7-b02e-0b12020db2ad";

  console.log("Generating 170 new complaints to reach 288 total...");

  // Bounds for Digos City roughly based on analysis:
  const baseLat = 6.74;
  const baseLng = 125.35;

  const complaints = [];
  for (let i = 0; i < 170; i++) {
    // Randomly scatter around the center
    const lat = baseLat + (Math.random() - 0.5) * 0.05;
    const lng = baseLng + (Math.random() - 0.5) * 0.05;

    complaints.push({
      submitted_by: userId,
      category_id: catId,
      subcategory_id: subId,
      description: `Generated test complaint #${i+1}`,
      location_text: "Digos City, Davao del Sur",
      latitude: lat,
      longitude: lng,
      workflow_status: "submitted",
      priority: ["low", "medium", "high"][Math.floor(Math.random() * 3)],
      status: "pending",
      urgency_level: ["low", "medium", "high"][Math.floor(Math.random() * 3)],
      departments: [],
      phase_comments: { "resolved": [], "verified": [], "submitted": [], "action_taken": [], "under_review": [] }
    });
  }

  const { data, error } = await supabase
    .from("complaints")
    .insert(complaints);

  if (error) {
    console.error("Error inserting complaints:", error);
  } else {
    console.log("Successfully inserted 170 complaints.");

    // verify
    const countRes = await supabase.from("complaints").select("*", { count: "exact", head: true });
    console.log(`Current DB count: ${countRes.count}`);
  }
}

generateAdditionalComplaints();
