const Database = require('../config/database');
const TensorFlowService = require('./TensorFlowService');

/**
 * AdvancedDecisionEngine
 * Core intelligence service for CitizenLink.
 * Implements the hybrid classification logic: Rule-Based (Fast) -> AI Fallback (Slow).
 */
class AdvancedDecisionEngine {
    constructor() {
        this.supabase = Database.getClient();
        this.keywords = [];
        this.metaphors = [];
        this.anchors = {};
        this.categoryConfig = {};
        this.initialized = false;
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
     * @returns {Object} { category, subcategory, urgency, method, confidence }
     */
    async classify(text) {
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
            return {
                category: bestMatch.category,
                subcategory: bestMatch.subcategory,
                urgency: this.getUrgency(bestMatch.category),
                method: 'RULE_BASED',
                confidence: bestMatch.confidence,
                matched_term: bestMatch.term
            };
        }

        // 3. AI Fallback (Slow Path)
        try {
            const aiResult = await TensorFlowService.classify(normalizedText);

            if (aiResult && aiResult.category && aiResult.confidence > 0.6) {
                return {
                    category: aiResult.category,
                    subcategory: aiResult.category, // AI maps to broad categories usually
                    urgency: this.getUrgency(aiResult.category),
                    method: 'AI_TENSORFLOW',
                    confidence: aiResult.confidence
                };
            }
        } catch (err) {
            console.warn('[NLP] AI classification failed, falling back to Others:', err.message);
        }

        // 4. Default Fallback
        return {
            category: 'Others',
            subcategory: null,
            urgency: 30,
            method: 'FALLBACK',
            confidence: 0.0
        };
    }

    getUrgency(category) {
        return this.categoryConfig[category]?.urgency_rating || 30;
    }
}

module.exports = new AdvancedDecisionEngine();
