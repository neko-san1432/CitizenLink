const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { createClient } = require("@supabase/supabase-js");

async function run() {
  console.log("🔄 Starting priority backfill block...");

  // Initialize Supabase client
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase URL or Service Key");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log("✅ Connected to database");

  try {
    // 1. Fetch NLP configurations to get urgency scores for categories
    const { data: configs, error: configError } = await supabase
      .from("nlp_category_config")
      .select("category, urgency_rating");

    if (configError) throw configError;

    // Build mapping
    const urgencyMap = {};
    if (configs) {
      configs.forEach(c => {
        urgencyMap[Math.trunc(c.category)] = c.urgency_rating;
        // also store by name just in case
        urgencyMap[c.category] = c.urgency_rating;
      });
    }

    // 2. Fallbacks
    const getDefaultUrgency = (categoryStr) => {
      if (!categoryStr) return 30; // default low

      // Check if exact match exists
      if (urgencyMap[categoryStr]) return urgencyMap[categoryStr];

      // Fallbacks for known names
      // (used if config table is empty or we only have names)
      const map = {
        "Infrastructure": 60,
        "Sanitation": 50,
        "Utilities": 55,
        "Public Safety": 80,
        "Environment": 45,
        "Traffic": 50,
        "Others": 30
      };

      return map[categoryStr] || 30;
    };

    // 3. Helper to determine priority string from numerical score
    const getPriorityFromScore = (score) => {
      if (score >= 80) return "urgent";
      if (score >= 60) return "high";
      if (score >= 40) return "medium";
      return "low";
    };

    // 4. Fetch all complaints
    console.log("📊 Fetching all complaints...");
    let allcomplaints = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;

    while (hasMore) {
      const { data, error } = await supabase
        .from("complaints")
        .select("id, category, priority, urgency_level")
      // .eq('priority', 'low') // Optionally only fix 'low' ones, but let's recalculate all to be safe
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allcomplaints = allcomplaints.concat(data);
        page++;
        console.log(`   Fetched ${allcomplaints.length} complaints...`);
      } else {
        hasMore = false;
      }

      // Safety limit
      if (page > 50) break;
    }

    console.log(`📋 Found ${allcomplaints.length} total complaints to process.`);

    // 5. Update complaints
    let updatedCount = 0;
    let skippedCount = 0;

    for (const complaint of allcomplaints) {
      // we need to resolve the category name if it's a UUID to get proper urgency score
      // Let's do a quick DB check if the category string is a UUID
      let catName = complaint.category;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (catName && uuidRegex.test(catName)) {
        // Fetch name from DB
        const { data: catData } = await supabase
          .from("categories")
          .select("name")
          .eq("id", catName)
          .single();

        if (catData) catName = catData.name;
      }

      // Calculate correct score and priority
      const score = getDefaultUrgency(catName);
      const correctPriority = getPriorityFromScore(score);

      // Check if update is needed
      if (complaint.priority !== correctPriority || complaint.urgency_level !== correctPriority) {
        const { error: updateError } = await supabase
          .from("complaints")
          .update({
            priority: correctPriority,
            urgency_level: correctPriority
          })
          .eq("id", complaint.id);

        if (updateError) {
          console.error(`❌ Failed to update complaint ${complaint.id}:`, updateError.message);
        } else {
          updatedCount++;
          // console.log(`   Updated ${complaint.id}: ${complaint.priority} -> ${correctPriority} (${catName})`);
        }
      } else {
        skippedCount++;
      }
    }

    console.log(`\n🎉 Done!`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped (already correct): ${skippedCount}`);

  } catch (err) {
    console.error("❌ Fatal error:", err);
  }
}

run();
