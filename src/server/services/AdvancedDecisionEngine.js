const Database = require('../config/database');
const TensorFlowService = require('./TensorFlowService');

/**
 * AdvancedDecisionEngine
 * Core intelligence service for CitizenLink.
 * Implements the hybrid classification logic: Rule-Based (Fast) -> AI Fallback (Slow).
 * 
 * HITL Feature: Automatically queues low-confidence results for human review.
 */
class AdvancedDecisionEngine {
    constructor() {
        this.supabase = Database.getClient();
        this.keywords = [];
        this.metaphors = [];
        this.anchors = {};
        this.categoryConfig = {};
        this.initialized = false;
        
        // HITL Configuration
        this.CONFIDENCE_THRESHOLD = 0.7;  // Below this, add to pending reviews
        this.enableAutoQueue = true;      // Set false to disable HITL queueing
    }

    /**
     * Load all NLP data from the database.
     * Should be called on server startup.
     */
    async initialize() {
        if (this.initialized) return;

        try {
            console.log('[NLP] 🔄 Initializing Advanced Decision Engine...');

            // 1. Load Keywords (graceful fallback if table doesn't exist)
            try {
                const { data: keywords, error: kwError } = await this.supabase
                    .from('nlp_keywords')
                    .select('*');
                if (kwError) {
                    console.warn('[NLP] ⚠️ nlp_keywords table not found or error, using empty list:', kwError.message);
                    this.keywords = [];
                } else {
                    this.keywords = keywords || [];
                }
            } catch (e) {
                console.warn('[NLP] ⚠️ Failed to load keywords:', e.message);
                this.keywords = [];
            }

            // 2. Load Metaphors (graceful fallback if table doesn't exist)
            try {
                const { data: metaphors, error: mtError } = await this.supabase
                    .from('nlp_metaphors')
                    .select('*');
                if (mtError) {
                    console.warn('[NLP] ⚠️ nlp_metaphors table not found or error, using empty list:', mtError.message);
                    this.metaphors = [];
                } else {
                    this.metaphors = metaphors || [];
                }
            } catch (e) {
                console.warn('[NLP] ⚠️ Failed to load metaphors:', e.message);
                this.metaphors = [];
            }

            // 3. Load Category Config (graceful fallback if table doesn't exist)
            try {
                const { data: configs, error: cfError } = await this.supabase
                    .from('nlp_category_config')
                    .select('*');
                if (cfError) {
                    console.warn('[NLP] ⚠️ nlp_category_config table not found or error, using defaults:', cfError.message);
                    // Use default urgency ratings
                    this.categoryConfig = {
                        'Infrastructure': { category: 'Infrastructure', urgency_rating: 60 },
                        'Sanitation': { category: 'Sanitation', urgency_rating: 50 },
                        'Utilities': { category: 'Utilities', urgency_rating: 55 },
                        'Public Safety': { category: 'Public Safety', urgency_rating: 80 },
                        'Environment': { category: 'Environment', urgency_rating: 45 },
                        'Traffic': { category: 'Traffic', urgency_rating: 50 },
                        'Others': { category: 'Others', urgency_rating: 30 }
                    };
                } else {
                    this.categoryConfig = {};
                    (configs || []).forEach(c => {
                        this.categoryConfig[c.category] = c;
                    });
                }
            } catch (e) {
                console.warn('[NLP] ⚠️ Failed to load category config:', e.message);
                this.categoryConfig = {};
            }

            // 4. Load Anchors (graceful fallback if table doesn't exist)
            try {
                const { data: anchors, error: anError } = await this.supabase
                    .from('nlp_anchors')
                    .select('*');
                if (anError) {
                    console.warn('[NLP] ⚠️ nlp_anchors table not found or error, using empty list:', anError.message);
                    this.anchors = {};
                } else {
                    // Group anchors by category
                    const groupedAnchors = {};
                    (anchors || []).forEach(a => {
                        if (!groupedAnchors[a.category]) groupedAnchors[a.category] = [];
                        groupedAnchors[a.category].push(a.anchor_text);
                    });
                    this.anchors = groupedAnchors;
                }
            } catch (e) {
                console.warn('[NLP] ⚠️ Failed to load anchors:', e.message);
                this.anchors = {};
            }

            // Initialize AI Service (background) - only if we have anchors
            if (Object.keys(this.anchors).length > 0) {
                TensorFlowService.initialize().then(() => {
                    TensorFlowService.precomputeAnchors(this.anchors);
                });
            }

            this.initialized = true;
            console.log(`[NLP] ✅ Initialized with ${this.keywords.length} keywords, ${this.metaphors.length} metaphors, ${Object.keys(this.anchors).length} anchor categories.`);

        } catch (error) {
            console.error('[NLP] ❌ Initialization failed:', error.message);
            // Mark as initialized anyway to prevent infinite retries
            this.initialized = true;
        }
    }

    /**
     * Main classification method.
     * @param {string} text - User complaint description.
     * @param {string} complaintId - Optional complaint ID for HITL tracking.
     * @returns {Object} { category, subcategory, urgency, method, confidence }
     */
    async classify(text, complaintId = null) {
        if (!this.initialized) await this.initialize();

        const normalizedText = text.toLowerCase();

        // 1. Check Metaphor Filters (False Positive Prevention)
        for (const meta of this.metaphors) {
            const regex = new RegExp(meta.pattern, 'i');
            if (regex.test(normalizedText)) {
                console.log(`[NLP] Metaphor detected: "${meta.pattern}" -> Ignoring figurative language`);
                return {
                    category: 'Others',
                    subcategory: 'Metaphor Filtered',
                    urgency: 30,
                    method: 'METAPHOR_FILTER',
                    confidence: 1.0
                };
            }
        }

        // 2. Rule-Based Matching (Fast Path)
        // Sort keywords by length (longest match first) to handle "power line down" vs "power"
        const sortedKeywords = [...this.keywords].sort((a, b) => b.term.length - a.term.length);

        let bestMatch = null;

        for (const kw of sortedKeywords) {
            // Check for exact word/phrase match in text
            // We use word boundary check \b unless distinct content
            // Simple includes for now to match multiple words
            if (normalizedText.includes(kw.term)) {
                if (!bestMatch || kw.confidence > bestMatch.confidence) {
                    bestMatch = kw;
                }
            }
        }

        // Decide if Rule-Based is good enough
        if (bestMatch && bestMatch.confidence >= 0.8) {
            const result = {
                category: bestMatch.category,
                subcategory: bestMatch.subcategory,
                urgency: this.getUrgency(bestMatch.category),
                method: 'RULE_BASED',
                confidence: bestMatch.confidence,
                matched_term: bestMatch.term
            };
            
            // HITL: Queue if below threshold (even rule-based can have low confidence)
            if (result.confidence < this.CONFIDENCE_THRESHOLD) {
                this.addToPendingReviews(text, result, complaintId);
            }
            
            return result;
        }

        // 3. AI Fallback (Slow Path)
        try {
            const aiResult = await TensorFlowService.classify(normalizedText);

            if (aiResult && aiResult.category && aiResult.confidence > 0.6) {
                const result = {
                    category: aiResult.category,
                    subcategory: aiResult.category, // AI maps to broad categories usually
                    urgency: this.getUrgency(aiResult.category),
                    method: 'AI_TENSORFLOW',
                    confidence: aiResult.confidence
                };
                
                // HITL: Queue AI results below threshold for human verification
                if (result.confidence < this.CONFIDENCE_THRESHOLD) {
                    this.addToPendingReviews(text, result, complaintId);
                }
                
                return result;
            }
        } catch (err) {
            console.warn('[NLP] AI classification failed, falling back to Others:', err.message);
        }

        // 4. Default Fallback - ALWAYS queue these for training
        const fallbackResult = {
            category: 'Others',
            subcategory: null,
            urgency: 30,
            method: 'FALLBACK',
            confidence: 0.0
        };
        
        // HITL: Always queue fallback results - these need human training
        this.addToPendingReviews(text, fallbackResult, complaintId);
        
        return fallbackResult;
    }

    getUrgency(category) {
        return this.categoryConfig[category]?.urgency_rating || 30;
    }

    /**
     * HITL: Add low-confidence classification to pending reviews queue
     * @param {string} text - Original complaint text
     * @param {Object} result - Classification result
     * @param {string} complaintId - Optional complaint ID
     */
    async addToPendingReviews(text, result, complaintId = null) {
        if (!this.enableAutoQueue) return;
        
        try {
            // Check for duplicate (same text already pending)
            const { data: existing } = await this.supabase
                .from('nlp_pending_reviews')
                .select('id')
                .eq('text', text)
                .eq('status', 'pending')
                .limit(1);
            
            if (existing && existing.length > 0) {
                console.log('[NLP-HITL] Duplicate pending review, skipping');
                return;
            }

            const { error } = await this.supabase
                .from('nlp_pending_reviews')
                .insert({
                    complaint_id: complaintId,
                    text: text,
                    detected_category: result.category,
                    detected_subcategory: result.subcategory,
                    confidence: result.confidence,
                    method: result.method,
                    matched_term: result.matched_term || null,
                    status: 'pending'
                });

            if (error) {
                // Table might not exist yet - log warning but don't crash
                if (error.code === '42P01') {
                    console.warn('[NLP-HITL] nlp_pending_reviews table not found. Run migration to enable HITL.');
                } else {
                    console.warn('[NLP-HITL] Failed to queue for review:', error.message);
                }
            } else {
                console.log(`[NLP-HITL] ✅ Queued for review: "${text.substring(0, 50)}..." (confidence: ${(result.confidence * 100).toFixed(0)}%)`);
            }
        } catch (err) {
            console.warn('[NLP-HITL] Error adding to queue:', err.message);
        }
    }

    /**
     * Batch queue multiple items for review (used by analytics scan)
     * Handles deduplication by checking existing pending items
     */
    async batchQueueForReview(items) {
        let queued = 0;
        let skipped = 0;
        let invalid = 0;
        const errors = [];

        if (!Array.isArray(items) || items.length === 0) {
            console.log('[NLP-HITL] Batch queue called with empty array');
            return { queued: 0, skipped: 0, errors: [] };
        }

        console.log(`[NLP-HITL] Batch queue received ${items.length} items`);
        
        // Log first item for debugging
        if (items[0]) {
            console.log('[NLP-HITL] First item sample:', JSON.stringify(items[0], null, 2));
        }

        try {
            // Get existing pending complaint IDs to avoid duplicates
            const complaintIds = items.map(i => i.complaint_id).filter(Boolean);
            
            if (complaintIds.length === 0) {
                console.log('[NLP-HITL] No valid complaint IDs found in items');
                console.log('[NLP-HITL] Item IDs received:', items.map(i => i.complaint_id));
                return { queued: 0, skipped: items.length, errors: ['No valid complaint IDs'] };
            }
            
            console.log(`[NLP-HITL] Valid complaint IDs: ${complaintIds.length}`);
            
            const { data: existing, error: selectError } = await this.supabase
                .from('nlp_pending_reviews')
                .select('complaint_id')
                .in('complaint_id', complaintIds);  // Check all statuses, not just pending
            
            if (selectError) {
                console.warn('[NLP-HITL] Error checking existing:', selectError.message);
            }
            
            const existingIds = new Set((existing || []).map(e => e.complaint_id));
            console.log(`[NLP-HITL] Already in database (any status): ${existingIds.size}`);

            // Get all existing keyword terms to check if text already has a trained term
            const allKeywordTerms = this.keywords.map(kw => kw.term?.toLowerCase()).filter(Boolean);
            console.log(`[NLP-HITL] Known keywords in cache: ${allKeywordTerms.length}`);

            // Filter out duplicates and items with already-trained keywords
            const toInsert = items.filter(item => {
                if (!item.complaint_id || !item.text) {
                    invalid++;
                    console.log(`[NLP-HITL] Invalid item - missing complaint_id or text:`, { 
                        complaint_id: item.complaint_id, 
                        hasText: !!item.text 
                    });
                    return false;
                }
                if (existingIds.has(item.complaint_id)) {
                    skipped++;
                    return false;
                }
                
                // Check if text contains any known keyword - but still queue if it's Others category
                // (Others items need training even if they have keywords that map elsewhere)
                const textLower = item.text.toLowerCase();
                const hasKnownKeyword = allKeywordTerms.some(kw => textLower.includes(kw));
                if (hasKnownKeyword && item.detected_category !== 'Others') {
                    skipped++;
                    console.log(`[NLP-HITL] Skipped (has known keyword, not Others): ${item.complaint_id?.substring(0,8)}`);
                    return false;
                }
                
                return true;
            }).map(item => ({
                complaint_id: item.complaint_id,
                text: item.text,
                detected_category: item.detected_category || 'Others',
                detected_subcategory: item.detected_subcategory || null,
                confidence: item.confidence || 0.5,
                method: item.method || 'UNKNOWN',
                matched_term: item.matched_term || null,
                status: 'pending'
            }));

            console.log(`[NLP-HITL] Filtered to ${toInsert.length} items to insert (${skipped} duplicates)`);

            if (toInsert.length > 0) {
                console.log('[NLP-HITL] Inserting first item sample:', JSON.stringify(toInsert[0], null, 2));
                
                const { error } = await this.supabase
                    .from('nlp_pending_reviews')
                    .insert(toInsert);

                if (error) {
                    errors.push(error.message);
                    console.error('[NLP-HITL] ❌ Batch insert error:', error.message, error.details, error.hint);
                } else {
                    queued = toInsert.length;
                    console.log(`[NLP-HITL] ✅ Batch queued ${queued} items for review`);
                }
            } else {
                console.log('[NLP-HITL] No items to insert after filtering');
            }
        } catch (err) {
            errors.push(err.message);
            console.error('[NLP-HITL] ❌ Batch queue exception:', err.message, err.stack);
        }

        return { queued, skipped, errors };
    }

    /**
     * Cleanup: Check pending reviews against known keywords and auto-resolve matches
     * This cleans up items that were queued before their keywords were trained
     */
    async cleanupPendingReviews() {
        try {
            // Get all pending reviews
            const { data: pending, error: fetchError } = await this.supabase
                .from('nlp_pending_reviews')
                .select('id, text, detected_category')
                .eq('status', 'pending');
            
            if (fetchError || !pending?.length) {
                return { cleaned: 0, remaining: 0 };
            }

            // Get all keyword terms from the keywords array
            const allKeywordTerms = this.keywords.map(kw => kw.term?.toLowerCase()).filter(Boolean);
            console.log(`[NLP-HITL] Cleanup: Checking ${pending.length} pending items against ${allKeywordTerms.length} keywords`);

            if (allKeywordTerms.length === 0) {
                console.log('[NLP-HITL] Cleanup: No keywords loaded, skipping');
                return { cleaned: 0, remaining: pending.length };
            }

            // Find items that now have matching keywords
            const toClean = [];
            for (const item of pending) {
                if (!item.text) continue;
                const textLower = item.text.toLowerCase();
                
                // Check if any keyword exists in the text
                for (const kwTerm of allKeywordTerms) {
                    if (textLower.includes(kwTerm)) {
                        // Find the keyword data
                        const kwData = this.keywords.find(k => k.term?.toLowerCase() === kwTerm);
                        toClean.push({
                            id: item.id,
                            matchedKeyword: kwTerm,
                            matchedCategory: kwData?.category || item.detected_category
                        });
                        break; // One match is enough
                    }
                }
            }

            if (toClean.length === 0) {
                console.log('[NLP-HITL] Cleanup: No items matched existing keywords');
                return { cleaned: 0, remaining: pending.length };
            }

            // Auto-resolve these items
            const ids = toClean.map(item => item.id);
            const { error: updateError } = await this.supabase
                .from('nlp_pending_reviews')
                .update({
                    status: 'resolved',
                    trained_keyword: '[auto-cleanup] keyword exists',
                    resolved_at: new Date().toISOString()
                })
                .in('id', ids);

            if (updateError) {
                console.warn('[NLP-HITL] Cleanup update error:', updateError.message);
                return { cleaned: 0, remaining: pending.length, error: updateError.message };
            }

            console.log(`[NLP-HITL] ✅ Cleanup: Auto-resolved ${toClean.length} items with existing keywords`);
            return { cleaned: toClean.length, remaining: pending.length - toClean.length };
        } catch (err) {
            console.error('[NLP-HITL] Cleanup exception:', err.message);
            return { cleaned: 0, error: err.message };
        }
    }

    /**
     * Get pending reviews count
     */
    async getPendingReviewsCount() {
        try {
            const { count, error } = await this.supabase
                .from('nlp_pending_reviews')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');
            
            return error ? 0 : count;
        } catch {
            return 0;
        }
    }

    /**
     * Get all pending reviews (runs cleanup first)
     */
    async getPendingReviews(limit = 50) {
        try {
            // Run cleanup before fetching
            await this.cleanupPendingReviews();
            
            const { data, error } = await this.supabase
                .from('nlp_pending_reviews')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(limit);
            
            return error ? [] : data;
        } catch {
            return [];
        }
    }

    /**
     * Resolve a pending review by training the keyword
     */
    async resolvePendingReview(reviewId, keyword, category, subcategory, userId) {
        try {
            // 1. Add keyword to nlp_keywords
            const { error: kwError } = await this.supabase
                .from('nlp_keywords')
                .insert({
                    term: keyword.toLowerCase().trim(),
                    category: category,
                    subcategory: subcategory || null,
                    confidence: 0.85,
                    language: 'all'
                });
            
            if (kwError && kwError.code !== '23505') {  // Ignore duplicate key error
                throw new Error(`Failed to add keyword: ${kwError.message}`);
            }

            // 2. Update pending review status
            const { error: updateError } = await this.supabase
                .from('nlp_pending_reviews')
                .update({
                    status: 'resolved',
                    trained_keyword: keyword,
                    trained_category: category,
                    trained_subcategory: subcategory,
                    resolved_at: new Date().toISOString(),
                    resolved_by: userId
                })
                .eq('id', reviewId);

            if (updateError) {
                throw new Error(`Failed to update review: ${updateError.message}`);
            }

            // 3. Auto-resolve other pending reviews containing the same keyword
            const keywordLower = keyword.toLowerCase().trim();
            const { data: similarPending, error: searchError } = await this.supabase
                .from('nlp_pending_reviews')
                .select('id, text')
                .eq('status', 'pending')
                .neq('id', reviewId);
            
            let autoResolved = 0;
            if (!searchError && similarPending?.length > 0) {
                const toAutoResolve = similarPending.filter(item => 
                    item.text && item.text.toLowerCase().includes(keywordLower)
                );
                
                if (toAutoResolve.length > 0) {
                    const ids = toAutoResolve.map(item => item.id);
                    const { error: batchError } = await this.supabase
                        .from('nlp_pending_reviews')
                        .update({
                            status: 'resolved',
                            trained_keyword: `[auto] ${keyword}`,
                            trained_category: category,
                            trained_subcategory: subcategory,
                            resolved_at: new Date().toISOString(),
                            resolved_by: userId
                        })
                        .in('id', ids);
                    
                    if (!batchError) {
                        autoResolved = ids.length;
                        console.log(`[NLP-HITL] 🔄 Auto-resolved ${autoResolved} similar pending reviews containing "${keyword}"`);
                    }
                }
            }

            // 4. Reload keywords cache
            await this.reloadKeywords();

            console.log(`[NLP-HITL] ✅ Resolved: "${keyword}" → ${category}/${subcategory || 'N/A'}${autoResolved > 0 ? ` (+${autoResolved} auto-resolved)` : ''}`);
            return { success: true, autoResolved };
        } catch (err) {
            console.error('[NLP-HITL] Resolution failed:', err.message);
            return { success: false, error: err.message };
        }
    }

    /**
     * Dismiss a pending review without training
     */
    async dismissPendingReview(reviewId, userId) {
        try {
            const { error } = await this.supabase
                .from('nlp_pending_reviews')
                .update({
                    status: 'dismissed',
                    resolved_at: new Date().toISOString(),
                    resolved_by: userId
                })
                .eq('id', reviewId);

            if (error) throw error;
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Reload keywords from database (after training)
     */
    async reloadKeywords() {
        try {
            const { data: keywords } = await this.supabase
                .from('nlp_keywords')
                .select('*');
            this.keywords = keywords || [];
            console.log(`[NLP] 🔄 Reloaded ${this.keywords.length} keywords`);
        } catch (err) {
            console.warn('[NLP] Failed to reload keywords:', err.message);
        }
    }
}

module.exports = new AdvancedDecisionEngine();
