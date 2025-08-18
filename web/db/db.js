// Server-side Supabase configuration
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config({ 
  path: path.join( ".env"),
  override: true,
 });

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_KEY;
// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env file."
  );
}

// Create Supabase client for server-side operations
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Export the configured client
export { supabase };

// Export a function to get the client (useful for testing)
export function getSupabaseClient() {
  return supabase;
}

// Export credentials for client-side use (if needed)
export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
};
