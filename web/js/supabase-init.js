// Shared Supabase initialization module
// This prevents duplicate initialization across multiple files

class SupabaseManager {
  constructor() {
    this.supabase = null;
    this.initialized = false;
    this.initializationPromise = null;
  }

  async initialize() {
    // Return existing promise if already initializing
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Return immediately if already initialized
    if (this.initialized && this.supabase) {
      return this.supabase;
    }

    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  async _performInitialization() {
    try {
      // Check if bridge is already ready
      if (window.supabaseBridge && window.supabaseBridge.isReady()) {
        this.supabase = window.supabaseBridge.getClient();
        this.initialized = true;
        return this.supabase;
      }

      // Wait for bridge to be ready
      return new Promise((resolve) => {
        const handleReady = () => {
          if (window.supabaseBridge && window.supabaseBridge.isReady()) {
            this.supabase = window.supabaseBridge.getClient();
            this.initialized = true;
            window.removeEventListener('supabaseReady', handleReady);
            resolve(this.supabase);
          }
        };

        window.addEventListener('supabaseReady', handleReady);
        
        // Also check periodically in case the event was already fired
        const checkInterval = setInterval(() => {
          if (window.supabaseBridge && window.supabaseBridge.isReady()) {
            clearInterval(checkInterval);
            handleReady();
          }
        }, 100);
      });
    } catch (error) {
      console.error("Error initializing Supabase:", error);
      this.initializationPromise = null;
      throw error;
    }
  }

  getClient() {
    if (!this.initialized) {
      throw new Error("Supabase not initialized. Call initialize() first.");
    }
    return this.supabase;
  }

  isInitialized() {
    return this.initialized && this.supabase !== null;
  }
}

// Create singleton instance
const supabaseManager = new SupabaseManager();

// Export for use in other modules
window.supabaseManager = supabaseManager;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    supabaseManager.initialize();
  });
} else {
  supabaseManager.initialize();
}
