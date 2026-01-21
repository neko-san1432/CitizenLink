// Supabase loader module - imports from CDN and exposes to window
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

console.log("[Supabase-Loader] ✅ Module loaded successfully");

// Expose to window for legacy code
window.supabase = { createClient };
window.Supabase = { createClient };

// Dispatch event to notify other scripts
window.dispatchEvent(
  new CustomEvent("supabase-loaded", {
    detail: { createClient },
  })
);

console.log("[Supabase-Loader] ✅ Attached to window.supabase");

export { createClient };
