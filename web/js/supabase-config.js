// Client-side Supabase configuration
// Temporary working version

const SUPABASE_URL = 'https://paowdorwtcoramkitlrn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhb3dkb3J3dGNvcmFta2l0bHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMTM4NTAsImV4cCI6MjA3MDU4OTg1MH0.Y2hbqElbKN9cCvVCFjqNWasV7PLxd-Rf7PLb5Wkuav0';

// Global Supabase client for browser use
let supabaseClient = null;

// Function to initialize Supabase client
async function initializeSupabaseClient() {
  try {
    // Check if Supabase is already loaded
    if (typeof window.supabase !== 'undefined') {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('Supabase client initialized');
      return supabaseClient;
    }
    
    // Load Supabase from CDN if not available
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js';
    script.onload = () => {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('Supabase loaded from CDN and initialized');
      
      // Trigger a custom event to notify that Supabase is ready
      window.dispatchEvent(new CustomEvent('supabaseReady'));
    };
    script.onerror = () => {
      console.error('Failed to load Supabase from CDN');
    };
    document.head.appendChild(script);
  } catch (error) {
    console.error('Error initializing Supabase client:', error);
  }
}

// Function to get the Supabase client
function getSupabaseClient() {
  return supabaseClient;
}

// Make functions globally available
window.initializeSupabaseClient = initializeSupabaseClient;
window.getSupabaseClient = getSupabaseClient;
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

// Initialize when this script loads
if (typeof document !== 'undefined') {
  initializeSupabaseClient();
}

