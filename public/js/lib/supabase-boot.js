import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("[Supabase-Module] Loading from ESM...");

// Expose to window for the rest of the legacy app
if (typeof window !== "undefined") {
  window.supabase = { createClient };
  // Also set Capitalized version just in case
  window.Supabase = { createClient };

  console.log("[Supabase-Module] Attached to window.supabase");
}

export { createClient };
