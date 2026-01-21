require("dotenv").config();
const Database = require("../config/database");
const path = require("path");

// Test Config
const SEED_CONFIG = {
  CLUSTER_LAT: 6.7578, // Digos City example
  CLUSTER_LNG: 125.3572,
  COUNT: 6, // 6 duplicates to trigger BLOCKING mode
  CATEGORY_NAME: "Infrastructure", // We'll try to find this or similar
  DESCRIPTION: "Seed Test: Dangerous Pothole at Main St corner 5th Ave",
  TITLE: "Deep Pothole",
};

async function seed() {
  console.log("🌱 Starting Duplicate Seed...");

  try {
    const client = Database.getClient();

    // 1. Get a valid user (any user)
    const {
      data: { users },
      error: userError,
    } = await client.auth.admin.listUsers();
    if (userError || !users || users.length === 0)
      throw new Error("No users found. Please create a user first.");

    const userId = users[0].id; // Use first user
    console.log(`👤 Using User ID: ${userId}`);

    // 2. Get a valid category
    const { data: categories } = await client
      .from("categories")
      .select("id, name");
    if (!categories || categories.length === 0)
      throw new Error("No categories found.");

    const category = categories[0];
    console.log(`📂 Using Category: ${category.name} (${category.id})`);

    // 3. Get a valid subcategory
    const { data: subcategories } = await client
      .from("subcategories")
      .select("id, name")
      .eq("category_id", category.id);
    const subcategory =
      subcategories && subcategories.length > 0 ? subcategories[0] : null;
    console.log(
      `📂 Using Subcategory: ${subcategory ? subcategory.name : "None"}`
    );

    // 4. Create Cluster
    console.log(`🚀 creating ${SEED_CONFIG.COUNT} duplicate complaints...`);

    const timestamp = new Date();

    for (let i = 0; i < SEED_CONFIG.COUNT; i++) {
      // Jitter location slightly (0.0001 deg ~ 11 meters)
      const lat = SEED_CONFIG.CLUSTER_LAT + (Math.random() * 0.0001 - 0.00005);
      const lng = SEED_CONFIG.CLUSTER_LNG + (Math.random() * 0.0001 - 0.00005);

      const complaint = {
        submitted_by: userId,
        title: `${SEED_CONFIG.TITLE} #${i + 1}`,
        descriptive_su: SEED_CONFIG.DESCRIPTION,
        category: category.id,
        subcategory: subcategory ? subcategory.id : null,
        latitude: lat,
        longitude: lng,
        location_text: "Seed Location, Digos City",
        workflow_status: "new",
        submitted_at: new Date(timestamp.getTime() - i * 60000).toISOString(), // 1 min apart
        upvote_count: 0,
      };

      const { data, error } = await client
        .from("complaints")
        .insert(complaint)
        .select("id")
        .single();

      if (error) console.error(`Failed to create #${i + 1}:`, error.message);
      else console.log(`✅ Created Complaint #${i + 1}: ${data.id}`);
    }

    console.log("\n✨ Seeding Complete!");
    console.log(
      `📍 Location: ${SEED_CONFIG.CLUSTER_LAT}, ${SEED_CONFIG.CLUSTER_LNG}`
    );
    process.exit(0);
  } catch (err) {
    console.error("❌ Seed Failed:", err);
    process.exit(1);
  }
}

seed();
