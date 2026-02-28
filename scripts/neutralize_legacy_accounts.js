require("dotenv").config();
const Database = require("../src/server/config/database");

const ACCOUNTS_TO_FIX = [
  "6fda128c-3438-47aa-a5a5-40462aa66971", // coordinator@gmail.com
  "40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c", // pnpadmin@gmail.com
];

async function main() {
  console.log("🚀 Starting Neutralization of Stubborn Accounts...");

  const db = Database.getInstance();
  const supabase = db.getClient();

  for (const userId of ACCOUNTS_TO_FIX) {
    try {
      console.log(`\n🔧 Processing User ID: ${userId}...`);

      const { data: user, error: fetchError } = await supabase.auth.admin.getUserById(userId);
      if (fetchError || !user) {
        console.log(`   ⚠️ User not found or read error. Skipping.`);
        continue;
      }
      console.log(`   Found user: ${user.user.email} (${user.user.user_metadata.role})`);

      // Update to citizen and remove department/title info
      const updates = {
        user_metadata: {
          ...user.user.user_metadata,
          role: "citizen",
          department: null,
          title: null,
          position: null,
          is_legacy_migrated: true
        }
      };

      const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(userId, updates);

      if (updateError) {
        console.error(`   ❌ Failed to update user: ${updateError.message}`);
      } else {
        console.log(`   ✅ Successfully changed role to 'citizen'.`);
      }

    } catch (error) {
      console.error(`   ❌ Error processing user ${userId}:`, error.message);
    }
  }

  console.log("\n✨ Neutralization finished.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
