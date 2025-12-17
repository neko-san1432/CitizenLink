require("dotenv").config();
const Database = require("../src/server/config/database");

async function checkVerifications() {
  try {
    const supabase = Database.getClient(); // This uses Service Role Key, checking logs is an admin task

    console.log("Querying recent ID verifications...");

    const { data, error } = await supabase
      .from("id_verifications")
      .select(
        "id, user_id, verification_status, created_at, id_type, confidence_score"
      )
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error fetching verifications:", error);
      return;
    }

    if (data.length === 0) {
      console.log("No verification records found.");
    } else {
      console.log("Most recent verifications:");
      const output = JSON.stringify(data, null, 2);
      console.log(output);
      console.log(output);
      // File writing removed to keep directory clean
    }
  } catch (err) {
    console.error("Script failed:", err);
  }
}

checkVerifications();
