// SECURITY: Environment variables are now handled securely
// Auth operations use a limited client, database operations go through server API
// import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { supabaseReady } from "../lib/supabase-boot.js";

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

      // Ensure Supabase library is loaded using the robust bootloader
      const supabaseLib = await supabaseReady;

      if (!supabaseLib || !supabaseLib.createClient) {
        console.error(
          "[Config] FATAL: Supabase library failed to load via bootloader."
        );
        throw new Error("Supabase library not loaded. Check script inclusion.");
      }

      // Ensure global is set (should be done by bootloader, but safety first)
      if (!window.supabase) window.supabase = supabaseLib;
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
