// Supabase Bridge - Client-side access to server credentials
// This file provides a bridge between browser and server-side db.js
// Expected Supabase URL format: https://*.supabase.co

console.log('�� Script starting...');

class SupabaseBridge {
    constructor() {
        console.log('🔧 SupabaseBridge constructor called');
        this.supabaseClient = null;
        this.credentials = null;
        this._ready = false;
        console.log('🔧 Bridge instance created, _ready:', this._ready);
    }

    // Initialize the bridge by fetching credentials from server
    async initialize() {
        console.log('🚀 Starting bridge initialization...');
        try {
            // Fetch credentials from server endpoint
            console.log('📡 Fetching credentials from /api/supabase-bridge...');
            const response = await fetch('/api/supabase-bridge');
            console.log('�� Response status:', response.status);
            
            if (!response.ok) {
                throw new Error('Failed to fetch Supabase configuration');
            }
            
            this.credentials = await response.json();
            console.log('✅ Supabase credentials loaded from server:', {
                url: this.credentials.url ? 'URL exists' : 'URL missing',
                anonKey: this.credentials.anonKey ? 'Key exists' : 'Key missing'
            });
            
            // Initialize Supabase client
            console.log('🔑 Initializing Supabase client...');
            await this.initializeSupabaseClient();
            
        } catch (error) {
            console.error('❌ Error initializing Supabase bridge:', error);
            throw error;
        }
    }

    // Initialize Supabase client with fetched credentials
    async initializeSupabaseClient() {
        console.log('🔑 Starting Supabase client initialization...');
        try {
            if (typeof window.supabase !== 'undefined') {
                console.log('✅ Supabase already available, creating client...');
                this.supabaseClient = window.supabase.createClient(
                    this.credentials.url, 
                    this.credentials.anonKey
                );
                console.log('✅ Supabase client initialized');
                this._ready = true;
                console.log('✅ Bridge _ready set to:', this._ready);
                return this.supabaseClient;
            }
            
            console.log('📦 Loading Supabase from CDN...');
            // Load Supabase from CDN if not available
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js';
            
            return new Promise((resolve, reject) => {
                script.onload = () => {
                    console.log('✅ Supabase CDN script loaded');
                    this.supabaseClient = window.supabase.createClient(
                        this.credentials.url, 
                        this.credentials.anonKey
                    );
                    console.log('✅ Supabase loaded from CDN and initialized');
                    this._ready = true;
                    console.log('✅ Bridge _ready set to:', this._ready);
                    
                    // Trigger ready event
                    console.log('🎉 Dispatching supabaseReady event');
                    window.dispatchEvent(new CustomEvent('supabaseReady'));
                    resolve(this.supabaseClient);
                };
                
                script.onerror = () => {
                    console.error('❌ Failed to load Supabase from CDN');
                    reject(new Error('Failed to load Supabase from CDN'));
                };
                
                document.head.appendChild(script);
            });
            
        } catch (error) {
            console.error('❌ Error initializing Supabase client:', error);
            throw error;
        }
    }

    // Get the Supabase client
    getClient() {
        console.log('🔧 getClient called, _ready:', this._ready);
        if (!this._ready) {
            throw new Error('Supabase bridge not initialized. Call initialize() first.');
        }
        return this.supabaseClient;
    }

    // Check if bridge is ready
    isReady() {
        console.log('🔧 isReady() called, returning:', this._ready);
        return this._ready;
    }

    // Get credentials (for debugging)
    getCredentials() {
        return this.credentials;
    }
}

console.log('🔧 Class defined, about to create instance...');

// Create global instance
console.log('🔧 About to create global bridge instance...');
try {
    window.supabaseBridge = new SupabaseBridge();
    console.log('✅ Global bridge instance created:', window.supabaseBridge);
    console.log('🔧 Bridge methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(window.supabaseBridge)));
} catch (error) {
    console.error('❌ Error creating bridge instance:', error);
}

console.log('🔧 About to start auto-initialization...');

// Auto-initialize when this script loads
if (typeof document !== 'undefined') {
    console.log('🚀 Starting auto-initialization...');
    if (window.supabaseBridge) {
        console.log('🔧 Bridge exists, calling initialize...');
        window.supabaseBridge.initialize().catch(error => {
            console.error('❌ Auto-initialization failed:', error);
        });
    } else {
        console.error('❌ Bridge instance not found for auto-initialization');
    }
} else {
    console.log('�� Document not ready, skipping auto-initialization');
}

console.log('🚀 Script finished loading');