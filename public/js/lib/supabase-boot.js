// Load Supabase using UMD bundle (more compatible than ESM)
console.log("[Supabase-Boot] Starting initialization...");

(function () {
  // Check if already loaded
  if (window.supabase && window.supabase.createClient) {
    console.log("[Supabase-Boot] ✅ Already loaded");
    return;
  }

  console.log("[Supabase-Boot] Loading UMD bundle from CDN...");

  // Create script tag for UMD bundle
  const script = document.createElement("script");
  script.src =
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.js";
  script.crossOrigin = "anonymous";

  script.onload = function () {
    console.log("[Supabase-Boot] ✅ UMD bundle loaded");

    // The UMD bundle exposes window.supabase directly
    if (window.supabase && window.supabase.createClient) {
      console.log("[Supabase-Boot] ✅ window.supabase available");

      // Also set capitalized version for compatibility
      window.Supabase = window.supabase;

      // Dispatch ready event
      window.dispatchEvent(
        new CustomEvent("supabase-loaded", {
          detail: window.supabase,
        })
      );

      console.log("[Supabase-Boot] ✅ Ready!");
    } else {
      console.error(
        "[Supabase-Boot] ❌ UMD loaded but window.supabase not found"
      );
    }
  };

  script.onerror = function (error) {
    console.error("[Supabase-Boot] ❌ Failed to load UMD bundle:", error);
    console.error("[Supabase-Boot] Trying fallback CDN...");

    // Try unpkg as fallback
    const fallback = document.createElement("script");
    fallback.src =
      "https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js";
    fallback.crossOrigin = "anonymous";

    fallback.onload = function () {
      console.log("[Supabase-Boot] ✅ Loaded from fallback CDN");
      if (window.supabase) {
        window.Supabase = window.supabase;
        window.dispatchEvent(
          new CustomEvent("supabase-loaded", { detail: window.supabase })
        );
      }
    };

    fallback.onerror = function () {
      console.error("[Supabase-Boot] ❌ FATAL: All CDN attempts failed");
      console.error(
        "[Supabase-Boot] Check your internet connection and CSP settings"
      );
    };

    document.head.appendChild(fallback);
  };

  document.head.appendChild(script);
  console.log("[Supabase-Boot] Script tag injected, waiting for load...");
})();

// Export a promise for module consumers
export const supabaseReady = new Promise((resolve) => {
  if (window.supabase && window.supabase.createClient) {
    resolve(window.supabase);
  } else {
    window.addEventListener(
      "supabase-loaded",
      (event) => {
        resolve(event.detail);
      },
      { once: true }
    );

    setTimeout(() => {
      if (!window.supabase) {
        console.error("[Supabase-Boot] ❌ Timeout after 15s");
        resolve(null);
      }
    }, 15000);
  }
});

export default supabaseReady;
