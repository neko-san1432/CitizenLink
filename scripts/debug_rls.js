require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

async function debugRLS() {
  console.log("[DEBUG] Starting RLS Debugger...");

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ Missing Supabase credentials in .env");
    return;
  }

  // 1. Initialize Service Role Client
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  console.log("[DEBUG] Client initialized with Service Role Key.");

  try {
    // 2. Test Direct Query on user_profiles (Should bypass RLS)
    console.log("\n[TEST 1] Querying user_profiles with Service Role...");
    const { data: profiles, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, role")
      .limit(5);

    if (profileError) {
      console.error("❌ Service Role user_profiles query FAILED:", profileError);
    } else {
      console.log("✅ Service Role user_profiles query SUCCESS. Count:", profiles.length);
    }

    // 3. Inspect Policies (Requires direct SQL access or pg_policies view)
    // We can try to query pg_policies using RPC if available, or just guess.
    // Standard Supabase doesn't expose pg_policies to API usually.
    // But we can check if standard queries work.

    // 4. Test Recursion Trigger (Simulate the failing query)
    // The error happens accessing /api/complaints/my
    // This calls ComplaintRepository.findByUserId -> select * from complaints where submitted_by = ...

    console.log("\n[TEST 2] Querying complaints (Simulating Repository Call)...");
    // Just pick a random ID or use a dummy one, we just want to see if checking ANY complaint triggers it.
    // If recursion is in `complaints` policy, even an empty result might trigger it if RLS runs.

    const { data: complaints, error: complaintError } = await supabase
      .from("complaints")
      .select("id")
      .limit(1);

    if (complaintError) {
      console.error("❌ Service Role complaints query FAILED:", complaintError);
    } else {
      console.log("✅ Service Role complaints query SUCCESS.");
    }

  } catch (err) {
    console.error("❌ Unexpected Error:", err);
  }
}

debugRLS();
