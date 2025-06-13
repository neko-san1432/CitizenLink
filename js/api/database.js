import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { generateCSRFToken } from '../utils/security.js';

let DB_PUB_API =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzcHNjc2NqbWZjeXdvYWtncnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM3NDc5MjcsImV4cCI6MjA1OTMyMzkyN30.2Il7ghBSgOvh5nklss7bgcvrV4WeXbT2FmkR273gPIc";
let DB_PUB_URL = "https://lspscscjmfcywoakgrtf.supabase.co";

// Create Supabase client with security headers
export const supabase = createClient(DB_PUB_URL, DB_PUB_API, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-CSRF-Token': generateCSRFToken(),
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  }
});
