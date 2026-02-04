require("dotenv").config();
const ComplianceService = require("../src/server/services/ComplianceService");
const Database = require("../src/server/config/database");

const ACCOUNTS_TO_DELETE = [
    "6fda128c-3438-47aa-a5a5-40462aa66971",
    "40de27ef-ebf1-46fa-947e-3fc8ee7eaa5c",
];

async function main() {
    console.log("🚀 Starting Aggressive Cleanup V3...");

    const db = Database.getInstance();
    const supabase = db.getClient();

    let performedBy = "00000000-0000-0000-0000-000000000000";
    try {
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const superAdmin = users.find(u => u.user_metadata?.role === 'super-admin');
        if (superAdmin) performedBy = superAdmin.id;
    } catch (e) {
        console.warn("⚠️  Could not fetch admin.");
    }

    const complianceService = new ComplianceService();

    for (const userId of ACCOUNTS_TO_DELETE) {
        try {
            console.log(`\n🗑️  Processing User ID: ${userId}...`);

            // 1. Manual Cleanup of Tables missed by ComplianceService
            const tablesToClean = [
                { table: "nlp_proposals", col: "submitted_by" },
                { table: "nlp_proposals", col: "coordinator_approved_by" },
                { table: "nlp_proposals", col: "super_admin_approved_by" },
                { table: "nlp_proposals", col: "rejected_by" },
                { table: "id_verifications", col: "user_id" },
                { table: "id_verifications", col: "verified_by" },
                { table: "complaint_clusters", col: "created_by" }, // Guessing column
                { table: "user_profiles", col: "user_id" },         // Guessing table
                { table: "profiles", col: "id" }                    // Ensure profile gone
            ];

            for (const t of tablesToClean) {
                try {
                    // console.log(`   ➤ Checking ${t.table}.${t.col}...`);
                    await supabase.from(t.table).delete().eq(t.col, userId);
                } catch (e) {
                    // Ignore errors for non-existent tables/columns
                }
            }

            // Try to nullify department heads?
            try {
                // console.log("   ➤ Nullifying department references...");
                await supabase.from("departments").update({ head_id: null }).eq("head_id", userId); // Guessing column
            } catch (e) { }

            // 2. Compliance Deletion
            const result = await complianceService.deleteUserData(userId, performedBy, {
                reason: "Aggressive legacy account cleanup V3",
                userAgent: "Cleanup Script V3",
            });

            if (result.success) {
                console.log(`✅ Successfully deleted user ${userId}`);
            } else {
                console.error(`❌ Standard deletion failed for user ${userId}:`, result.message);

                console.log("   ➤ Attempting force delete...");
                const { error: forceError } = await supabase.auth.admin.deleteUser(userId);
                if (forceError) console.error(`   ❌ Force delete failed: ${forceError.message}`);
                else console.log(`   ✅ Force delete succeeded!`);
            }
        } catch (error) {
            console.error(`❌ Error processing user ${userId}:`, error.message);
        }
    }

    console.log("\n✨ Cleanup finished.");
    process.exit(0);
}

main().catch((err) => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
