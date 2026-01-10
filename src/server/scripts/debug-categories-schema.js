const Database = require("../config/database");
const dotenv = require("dotenv");
const path = require("path");

// Load environment variables
const envPath = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: envPath });

console.log("Loading configuration from:", envPath);
console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "FOUND" : "MISSING");

async function debugSchema() {
  try {
    const supabase = Database.getClient(); // Ensure initialized client is used

    console.log("DEBUG: Attempting to refresh Supabase schema cache...");

    // Sometimes a complex query forces a schema reload
    const { data, error } = await supabase
      .from("complaint_categories")
      .select("*")
      .limit(1);

    if (error) {
      console.error("ERROR Querying complaint_categories:", error);

      // Try fallback - maybe the table name is singular?
      console.log('DEBUG: Trying singular name "complaint_category"...');
      const { data: singularData, error: singularError } = await supabase
        .from("complaint_category")
        .select("*")
        .limit(1);

      if (singularError) {
        console.error("ERROR Querying complaint_category:", singularError);
      } else {
        console.log(
          'SUCCESS with "complaint_category"! Table seems to be named singular.'
        );
      }
    } else {
      console.log("SUCCESS! Tables found.");
      console.log("Data sample:", data);
    }
  } catch (e) {
    console.error("Unexpected error:", e);
  }
}

debugSchema();
