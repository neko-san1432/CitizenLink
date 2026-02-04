
require("dotenv").config();
const Database = require("../src/server/config/database");

// LGU Account Details
const NEW_USER = {
    email: "lgu_officer@example.com",
    password: "Password123!",
    role: "lgu", // Unified role for LGU/Coordinator functions
    metadata: {
        first_name: "Juan",
        last_name: "Dela Cruz",
        name: "Juan Dela Cruz", // Unified name field
        employee_id: "LGU-2024-001",
        department: null, // Will be filled dynamically
        mobile_number: "09123456789",
        gender: "male",
        status: "active",
        email_verified: true, // Auto-verify
        phone_verified: true
    }
};

async function main() {
    console.log("🚀 Creating LGU Account...");

    const db = Database.getInstance();
    const supabase = db.getClient();

    // 1. Fetch a valid department
    console.log("   ➤ Fetching departments...");
    const { data: depts, error: deptError } = await supabase.from("departments").select("code, name").limit(1);

    if (deptError || !depts || depts.length === 0) {
        console.error("   ❌ No departments found! Cannot create LGU account.");
        process.exit(1);
    }

    const targetDept = depts[0];
    NEW_USER.metadata.department = targetDept.code;
    console.log(`   ✅ Selected Department: ${targetDept.name} (${targetDept.code})`);

    // 2. Create the User via Supabase Admin API
    console.log("   ➤ Creating user in Supabase...");

    const { data: createdUser, error: createError } = await supabase.auth.admin.createUser({
        email: NEW_USER.email,
        password: NEW_USER.password,
        email_confirm: true,
        user_metadata: NEW_USER.metadata
    });

    if (createError) {
        console.error(`   ❌ Failed to create user: ${createError.message}`);
        process.exit(1);
    }

    console.log(`   ✅ User created successfully!`);
    console.log(`      ID: ${createdUser.user.id}`);
    console.log(`      Email: ${createdUser.user.email}`);
    console.log(`      Role: ${createdUser.user.user_metadata.role}`);
    console.log(`      Department: ${createdUser.user.user_metadata.department}`);

    console.log("\n✨ Account creation finished.");
    process.exit(0);
}

main().catch((err) => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
