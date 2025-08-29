// Supabase Bridge - Client-side access to server credentials
// This file provides a bridge between browser and server-side db.js
// Expected Supabase URL format: https://*.supabase.co



class SupabaseBridge {
    constructor() {
        
        this.supabaseClient = null;
        this.credentials = null;
        this._ready = false;
        
    }

    // Initialize the bridge by fetching credentials from server
    async initialize() {
        
        try {
            // Fetch credentials from server endpoint
            
            const response = await fetch('/api/supabase-bridge');
            
            
            if (!response.ok) {
                throw new Error('Failed to fetch Supabase configuration');
            }
            
            this.credentials = await response.json();
            
            // Initialize Supabase client
            
            await this.initializeSupabaseClient();
            console.log("Supabase initialized successfully",this.credentials);
        } catch (error) {
            console.error('❌ Error initializing Supabase bridge:', error);
            throw error;
        }
    }

    // Initialize Supabase client with fetched credentials
    async initializeSupabaseClient() {
        
        try {
            if (typeof window.supabase !== 'undefined') {
                
                this.supabaseClient = window.supabase.createClient(
                    this.credentials.url, 
                    this.credentials.anonKey,
                    {
                        auth: {
                            autoRefreshToken: true,
                            persistSession: true,
                            detectSessionInUrl: true
                        }
                    }
                );
                    
                // Set up session change listener
                this.supabaseClient.auth.onAuthStateChange((event, session) => {
                    
                    
                    if (event === 'SIGNED_IN' && session) {
                        
                        // Update sessionStorage with fresh user data
                        const userData = {
                            id: session.user.id,
                            email: session.user.email,
                            type: session.user.user_metadata?.role || "citizen",
                            role: session.user.user_metadata?.role || "citizen",
                            name: session.user.user_metadata?.name || session.user.email
                        };
                        sessionStorage.setItem("user", JSON.stringify(userData));
                    } else if (event === 'SIGNED_OUT') {
                        
                        sessionStorage.removeItem("user");
                    } else if (event === 'TOKEN_REFRESHED' && session) {
                        
                    }
                });
                    
                
                this._ready = true;
                
                return this.supabaseClient;
            }
            
            
            // Load Supabase from CDN if not available
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/dist/umd/supabase.min.js';
            
            return new Promise((resolve, reject) => {
                script.onload = () => {
                    
                    this.supabaseClient = window.supabase.createClient(
                        this.credentials.url, 
                        this.credentials.anonKey,
                        {
                            auth: {
                                autoRefreshToken: true,
                                persistSession: true,
                                detectSessionInUrl: true
                            }
                        }
                    );
                    
                    // Set up session change listener
                    this.supabaseClient.auth.onAuthStateChange((event, session) => {
                        
                        
                        if (event === 'SIGNED_IN' && session) {
                            
                            // Update sessionStorage with fresh user data
                            const userData = {
                                id: session.user.id,
                                email: session.user.email,
                                type: session.user.user_metadata?.role || "citizen",
                                role: session.user.user_metadata?.role || "citizen",
                                name: session.user.user_metadata?.name || session.user.email
                            };
                            sessionStorage.setItem("user", JSON.stringify(userData));
                        } else if (event === 'SIGNED_OUT') {
                            
                            sessionStorage.removeItem("user");
                        } else if (event === 'TOKEN_REFRESHED' && session) {
                            
                        }
                    });
                    
                    
                    this._ready = true;
                    
                    
                    // Trigger ready event
                    
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
        
        if (!this._ready) {
            throw new Error('Supabase bridge not initialized. Call initialize() first.');
        }
        return this.supabaseClient;
    }

    // Check if bridge is ready
    isReady() {
        
        return this._ready;
    }

    // Get credentials (for debugging)
    getCredentials() {
        return this.credentials;
    }
}



// Create global instance

try {
    window.supabaseBridge = new SupabaseBridge();
    
    
} catch (error) {
    console.error('❌ Error creating bridge instance:', error);
}



// Auto-initialize when this script loads
if (typeof document !== 'undefined') {
    
    if (window.supabaseBridge) {
        
        window.supabaseBridge.initialize().catch(error => {
            console.error('❌ Auto-initialization failed:', error);
        });
    } else {
        console.error('❌ Bridge instance not found for auto-initialization');
    }
} else {
    
}


