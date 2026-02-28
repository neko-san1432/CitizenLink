require("dotenv").config();
const Database = require("../src/server/config/database");

async function main() {
  const db = Database.getInstance();
  const supabase = db.getClient();

  console.log("🔍 Checking for users with legacy roles...");

  // We want users who are NOT citizen, lgu, or super-admin
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (error) {
    console.error("Error fetching users:", error);
    return;
  }

  const legacyUsers = users.filter(u => {
    const role = u.user_metadata?.role || "citizen"; // Default to citizen if missing
    return !["citizen", "lgu", "super-admin"].includes(role);
  });

  if (legacyUsers.length === 0) {
    console.log("✅ No users found with legacy roles (everyone is citizen, lgu, or super-admin).");
  } else {
    console.log(`⚠️  Found ${legacyUsers.length} users with legacy roles:`);
    legacyUsers.forEach(u => {
      console.log(`   - ID: ${u.id}`);
      console.log(`     Email: ${u.email}`);
      console.log(`     Role: ${u.user_metadata?.role}`);
      console.log("     -------------------");
    });
  }
}

main().catch(console.error);
