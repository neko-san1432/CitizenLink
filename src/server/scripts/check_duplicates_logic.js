require("dotenv").config();
const Database = require("../config/database");
const ComplaintService = require("../services/ComplaintService");
const ComplaintRepository = require("../repositories/ComplaintRepository");

// Same as seed
const SEED_CONFIG = {
  CLUSTER_LAT: 6.7578,
  CLUSTER_LNG: 125.3572,
};

async function test() {
  try {
    const client = Database.getClient();

    // Setup Service
    const repo = new ComplaintRepository();
    const service = new ComplaintService(repo);

    // Get Category
    const { data: categories } = await client
      .from("categories")
      .select("id")
      .limit(1);
    const categoryId = categories[0].id;

    console.log("🔍 Checking for duplicates at Seed Location...");

    const duplicates = await service.detectDuplicates({
      latitude: SEED_CONFIG.CLUSTER_LAT,
      longitude: SEED_CONFIG.CLUSTER_LNG,
      category: categoryId,
      subcategory: null,
    });

    console.log(`\n📊 Found ${duplicates.length} Duplicates`);

    if (duplicates.length >= 5) {
      console.log("✅ RESULT: BLOCKING UI should trigger (Count >= 5)");
    } else if (duplicates.length > 0) {
      console.log("✅ RESULT: WARNING UI should trigger (0 < Count < 5)");
    } else {
      console.log("❌ RESULT: No duplicates found (Check seed)");
    }

    // Test Bulk Merge Logic (Dry Run)
    if (duplicates.length > 0) {
      console.log("\n🧪 Testing Admin Bulk Merge Logic...");
      const master = duplicates[0];
      const children = duplicates.slice(1).map((d) => d.id);

      console.log(`Master: ${master.id} (${master.title})`);
      console.log(`Children to merge: ${children.length}`);

      // We won't actually execute merge here to keep data for UI testing if needed
      // But we verify we can identify them
      if (children.length > 0) {
        console.log("✅ Merge candidates identified correctly.");
      }
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

test();
