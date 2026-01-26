/**
 * LoginInitializationService
 * 
 * Handles post-login initialization tasks such as:
 * - Processing complaints through NLP
 * - Queueing low-confidence items for HITL review
 * - Running clustering (DBSCAN) analysis
 * 
 * These tasks run asynchronously after login to populate
 * the analytics and training queues.
 */

const AdvancedDecisionEngine = require('./AdvancedDecisionEngine');
const database = require('../config/database');

// Roles that trigger full analytics initialization
const ANALYTICS_ROLES = ['super-admin', 'lgu-admin', 'complaint-coordinator'];

// Throttle initialization - only run once per hour per server instance
let lastInitTime = 0;
const INIT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

class LoginInitializationService {
    constructor() {
        this.isProcessing = false;
        this.supabase = database.getClient();
    }

    /**
     * Main entry point - called after successful login
     * @param {Object} user - The logged in user
     */
    async onUserLogin(user) {
        const userRole = user?.role || user?.user_metadata?.role;
        
        console.log(`[LOGIN-INIT] User logged in: ${user?.email} (role: ${userRole})`);

        // Only trigger for analytics-capable roles
        if (!ANALYTICS_ROLES.includes(userRole)) {
            console.log(`[LOGIN-INIT] Skipping initialization for role: ${userRole}`);
            return;
        }

        // Check cooldown to prevent repeated processing
        const now = Date.now();
        if (now - lastInitTime < INIT_COOLDOWN_MS) {
            const minutesRemaining = Math.ceil((INIT_COOLDOWN_MS - (now - lastInitTime)) / 60000);
            console.log(`[LOGIN-INIT] Skipping - cooldown active (${minutesRemaining} min remaining)`);
            return;
        }

        // Don't run if already processing
        if (this.isProcessing) {
            console.log('[LOGIN-INIT] Skipping - already processing');
            return;
        }

        // Run initialization asynchronously (don't block login response)
        this.runInitialization().catch(err => {
            console.error('[LOGIN-INIT] ❌ Initialization failed:', err.message);
        });
    }

    /**
     * Run all initialization tasks
     */
    async runInitialization() {
        this.isProcessing = true;
        lastInitTime = Date.now();
        
        console.log('[LOGIN-INIT] 🚀 Starting post-login initialization...');

        try {
            // 1. Fetch all complaints
            const complaints = await this.fetchComplaints();
            console.log(`[LOGIN-INIT] Fetched ${complaints.length} complaints`);

            if (complaints.length === 0) {
                console.log('[LOGIN-INIT] No complaints to process');
                return;
            }

            // 2. Process complaints through NLP and queue low-confidence for HITL
            await this.processComplaintsForHITL(complaints);

            // 3. Could add DBSCAN clustering here if needed
            // await this.runClustering(complaints);

            console.log('[LOGIN-INIT] ✅ Initialization complete');

        } catch (error) {
            console.error('[LOGIN-INIT] ❌ Error during initialization:', error.message);
            throw error;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Fetch complaints from database
     */
    async fetchComplaints() {
        const { data, error } = await this.supabase
            .from('complaints')
            .select('id, description, original_text, category, subcategory, status, created_at')
            .order('created_at', { ascending: false })
            .limit(500); // Process most recent 500

        if (error) {
            console.error('[LOGIN-INIT] Error fetching complaints:', error.message);
            return [];
        }

        return data || [];
    }

    /**
     * Process complaints through NLP and queue low-confidence items for HITL
     */
    async processComplaintsForHITL(complaints) {
        const CONFIDENCE_THRESHOLD = 0.7;
        const itemsToQueue = [];

        console.log(`[LOGIN-INIT] Processing ${complaints.length} complaints through NLP...`);

        for (const complaint of complaints) {
            try {
                const text = complaint.description || complaint.original_text;
                if (!text) continue;

                // Run NLP classification
                const result = await AdvancedDecisionEngine.classify(text);
                
                const confidence = result?.confidence || 0.5;
                const isOthers = result?.category === 'Others' || complaint.category === 'Others';
                const hasKeywords = result?.keywords?.length > 0;
                const isLowConfidence = confidence < CONFIDENCE_THRESHOLD;

                // Queue if: low confidence, Others category, or no keywords detected
                const shouldQueue = isLowConfidence || isOthers || !hasKeywords;

                if (shouldQueue) {
                    itemsToQueue.push({
                        complaint_id: complaint.id,
                        text: text.substring(0, 1000), // Limit text length
                        detected_category: result?.category || complaint.category || 'Others',
                        detected_subcategory: result?.subcategory || complaint.subcategory || null,
                        confidence: confidence,
                        method: result?.method || 'RULE_BASED',
                        matched_term: result?.keywords?.[0] || null
                    });
                }
            } catch (err) {
                // Skip individual failures
                console.warn(`[LOGIN-INIT] Failed to process complaint ${complaint.id}:`, err.message);
            }
        }

        console.log(`[LOGIN-INIT] Found ${itemsToQueue.length} items for HITL review`);

        if (itemsToQueue.length > 0) {
            // Batch queue to database
            const result = await AdvancedDecisionEngine.batchQueueForReview(itemsToQueue);
            console.log(`[LOGIN-INIT] ✅ Queued ${result.queued} items (${result.skipped} duplicates skipped)`);
        }
    }
}

module.exports = new LoginInitializationService();
