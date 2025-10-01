// SECURITY: Environment variables are now handled securely
// Auth operations use a limited client, database operations go through server API

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Fetch Supabase configuration securely from server
let supabaseConfig = null;
let supabase = null;

async function initializeSupabase() {
  if (supabase) return supabase;
  
  try {
    const response = await fetch('/api/supabase/config');
    const config = await response.json();
    supabase = createClient(config.url, config.anonKey);
    return supabase;
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
    // Fallback - this should not happen in production
    throw new Error('Unable to connect to authentication service');
  }
}

// Create a proxy object that initializes Supabase on first use
const supabaseProxy = new Proxy({}, {
  get(target, prop) {
    if (supabase) {
      return supabase[prop];
    }
    
    // Initialize synchronously for backward compatibility
    // This is not ideal but maintains compatibility
    if (!supabaseConfig) {
      fetch('/api/supabase/config')
        .then(response => response.json())
        .then(config => {
          supabaseConfig = config;
          supabase = createClient(config.url, config.anonKey);
        })
        .catch(error => {
          console.error('Failed to initialize Supabase:', error);
        });
    }
    
    // Return a promise-based method for async operations
    if (prop === 'auth') {
      return new Proxy({}, {
        get(authTarget, authProp) {
          return (...args) => {
            if (supabase) {
              return supabase.auth[authProp](...args);
            }
            // Return a promise that resolves when Supabase is ready
            return new Promise((resolve, reject) => {
              const checkSupabase = () => {
                if (supabase) {
                  resolve(supabase.auth[authProp](...args));
                } else {
                  setTimeout(checkSupabase, 50);
                }
              };
              checkSupabase();
            });
          };
        }
      });
    }
    
    return target[prop];
  }
});

// Export both the proxy and the initialization function
export { supabaseProxy as supabase, initializeSupabase };

// Database operations class for secure server-side operations
class SecureDatabaseClient {
  async select(table, filters = {}) {
    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'select', table, filters })
    });
    return response.json();
  }

  async insert(table, data) {
    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'insert', table, data })
    });
    return response.json();
  }

  async update(table, data, filters = {}) {
    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'update', table, data, filters })
    });
    return response.json();
  }

  async delete(table, filters = {}) {
    const response = await fetch('/api/supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'delete', table, filters })
    });
    return response.json();
  }
}

export const db = new SecureDatabaseClient();