require("dotenv").config();
const Database = require("../config/database");

async function debugColumn() {
  const client = Database.getClient();

  console.log("🔍 Checking 'upvote_count' column...");
  const { data, error } = await client
    .from("complaints")
    .select("upvote_count")
    .limit(1);

  if (error) {
    console.error("❌ Column check failed:", error.message);
    console.error("Error Code:", error.code);
    if (error.code === "42703" || error.message.includes("does not exist")) {
      console.log(
        "\n⚠️ IMPORTANT: You need to add 'upvote_count' column to 'complaints' table."
      );
      console.log(
        "SQL: ALTER TABLE complaints ADD COLUMN upvote_count INTEGER DEFAULT 0;"
      );
    }
  } else {
    console.log("✅ Column 'upvote_count' exists!");
  }
  process.exit(0);
}

debugColumn();
