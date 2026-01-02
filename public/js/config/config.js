// SECURITY: Environment variables are now handled securely
// Auth operations use a limited client, database operations go through server API
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Fetch Supabase configuration securely from server
let _supabaseConfig = null;
let supabase = null;
let initPromise = null;
async function initializeSupabase() {
  if (supabase) return supabase;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const response = await fetch("/api/supabase/config");
      const config = await response.json();
      if (!config || !config.url || !config.anonKey) {
        throw new Error("Missing Supabase client configuration");
      }

      // Ensure Supabase library is loaded
      // Wait for it up to 5 seconds
      let attempts = 0;
      while (
        (!window.supabase || !window.supabase.createClient) &&
        attempts < 20
      ) {
        // Check for alternative global name
        if (window.Supabase && window.Supabase.createClient) {
          window.supabase = window.Supabase;
          break;
        }
        if (window.exports && window.exports.supabase)
          window.supabase = window.exports.supabase;
        if (window.supabase && window.supabase.createClient) break;

        await new Promise((resolve) => {
          setTimeout(resolve, 250);
        }); // Wait 250ms
        attempts++;
        console.log(
          `[Config] Waiting for Supabase library... (${attempts}/20). Globals: sup=${Boolean(
            window.supabase
          )}, Sup=${Boolean(window.Supabase)}`
        );
      }

      console.log(
        "[Config] Checking for window.supabase...",
        typeof window.supabase
      );

      if (!window.supabase || !window.supabase.createClient) {
        // Final check for Capitalized version
        if (window.Supabase) window.supabase = window.Supabase;
        if (window.exports && window.exports.supabase)
          window.supabase = window.exports.supabase;

        if (!window.supabase) {
          console.error(
            "[Config] FATAL: window.supabase is missing after waiting."
          );
          console.log(
            "[Config] Available globals (approx):",
            Object.keys(window).filter((k) =>
              k.toLowerCase().includes("supabase")
            )
          );
          throw new Error(
            "Supabase library not loaded. Check script inclusion."
          );
        }
      }
      const { createClient } = window.supabase;

      _supabaseConfig = config;
      supabase = createClient(config.url, config.anonKey);
      return supabase;
    } catch (error) {
      console.error("Failed to initialize Supabase:", error);
      throw error;
    } finally {
      // Keep initPromise so late callers can await the same promise
    }
  })();
  return initPromise;
}
// Create a proxy object that initializes Supabase on first use
const supabaseProxy = new Proxy(
  {},
  {
    get(target, prop) {
      // Validate property access to prevent prototype pollution
      if (
        typeof prop === "symbol" ||
        prop === "__proto__" ||
        prop === "constructor" ||
        prop === "prototype"
      ) {
        return;
      }
      if (supabase) {
        return supabase[prop];
      }
      // Kick off initialization (single flight)
      initializeSupabase().catch(() => {});
      // Return a promise-based method for async operations
      if (prop === "auth") {
        return new Proxy(
          {},
          {
            get(authTarget, authProp) {
              // Validate auth property access
              if (
                typeof authProp === "symbol" ||
                authProp === "__proto__" ||
                authProp === "constructor" ||
                authProp === "prototype"
              ) {
                return;
              }
              return (...args) => {
                if (supabase) {
                  return supabase.auth[authProp](...args);
                }
                // Defer until client initialized
                return initializeSupabase().then(() =>
                  supabase.auth[authProp](...args)
                );
              };
            },
          }
        );
      }
      return target[prop];
    },
  }
);
// Export both the proxy and the initialization function

export { supabaseProxy as supabase, initializeSupabase };
// Database operations class for secure server-side operations
class SecureDatabaseClient {
  async select(table, filters = {}) {
    const response = await fetch("/api/supabase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "select", table, filters }),
    });
    return response.json();
  }
  async insert(table, data) {
    const response = await fetch("/api/supabase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "insert", table, data }),
    });
    return response.json();
  }
  async update(table, data, filters = {}) {
    const response = await fetch("/api/supabase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "update", table, data, filters }),
    });
    return response.json();
  }
  async delete(table, filters = {}) {
    const response = await fetch("/api/supabase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "delete", table, filters }),
    });
    return response.json();
  }
}

export const db = new SecureDatabaseClient();

export const brandConfig = {
  name: "CitizenLink",
  dashboardUrl: "/dashboard",
};
