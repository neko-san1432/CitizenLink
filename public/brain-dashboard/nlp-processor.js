/**
 * ============================================================================
 * NLP PROCESSOR - Hybrid Edge-AI Semantic Scoring Engine v4.0
 * ============================================================================
 * 
 * VERSION 4.0: HYBRID EDGE-AI ARCHITECTURE
 * =========================================
 * This version augments the rule-based system with TensorFlow.js fallback
 * to achieve high recall while maintaining <100ms latency on low-end devices.
 * 
 * KEY UPGRADES:
 * - Part 1: Dictionary expansion with missing dialects (Tagalog/Bisaya)
 * - Part 2: TF.js Universal Sentence Encoder fallback for unknown words
 * - Part 3: Multi-label detection + clause-based context analysis
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  INPUT: Raw complaint text (multilingual: English/Tagalog/Bisaya)       │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  LAYER 1: TOKENIZATION + CLAUSE SEGMENTATION                            │
 * │  - Lowercase normalization                                              │
 * │  - Split by punctuation/conjunctions into clauses                       │
 * │  - Whitespace splitting within clauses                                  │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  LAYER 2: DICTIONARY MATCHING (FAST PATH)                               │
 * │  - Single token + N-gram matching                                       │
 * │  - Hierarchy mapping (specific → parent category)                       │
 * │  - Confidence scoring                                                   │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  LAYER 3: AI FALLBACK (SLOW PATH - Only if confidence < 0.6)            │
 * │  - TensorFlow.js Universal Sentence Encoder                             │
 * │  - Cosine similarity against category anchor vectors                    │
 * │  - Override if similarity > 0.75                                        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  LAYER 4: CLAUSE-BASED MODIFIER DETECTION                               │
 * │  - Intensifiers applied per-clause only                                 │
 * │  - Negations applied per-clause only                                    │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  LAYER 5: MULTI-LABEL RESOLUTION                                        │
 * │  - Return ALL categories with urgency > 50 (normalized)                 │
 * │  - Primary category = highest urgency                                   │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    │
 *                                    ▼
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  OUTPUT: {category, detectedCategories[], urgencyScore, confidence,     │
 * │           isNegated, isIntensified, aiUsed, processingTimeMs}           │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * PERFORMANCE NOTES:
 * - Rule-based path: <10ms on low-end devices
 * - AI fallback path: ~50-100ms (async, non-blocking)
 * - TF.js loads in background, doesn't block page load
 * 
 * @author CitizenLink Development Team
 * @version 4.0.0 - Hybrid Edge-AI Architecture
 * @module NLPProcessor
 */

(function (global) {
    'use strict';

    // ==================== VERSION 4.0 CONFIGURATION ====================

    /**
     * v4.0: EXPANDED NLP KEYWORDS
     * Hardcoded critical terms for immediate accuracy boost.
     * Maps specific keywords to their parent database categories.
     */
    const NLP_KEYWORDS = {
        // ========== UTILITIES ==========
        Utilities: {
            keywords: [
                // Water-related (Tagalog)
                "tubig", "walang tubig", "wala tubig", "walay tubig", "way tubig",
                "mahina", "mahinang tubig", "low pressure", "weak water",
                "nawalan", "nawalan ng tubig", "naputol ang tubig", "putol tubig",
                // Electricity-related (Tagalog/Bisaya)
                "kuryente", "walang kuryente", "wala kuryente", "walay kuryente",
                "brownout", "blackout", "brown out", "black out",
                "naponder", "nag ponder", "ponder", "pundido",
                "dilim", "madilim", "ngitngit", "walay suga",
                // English variants
                "no water", "no electricity", "power outage", "no power",
                "water outage", "electricity cut", "power cut"
            ],
            urgency: 55,
            confidence: 0.9
        },

        // ========== SANITATION ==========
        Sanitation: {
            keywords: [
                // Odor-related (Tagalog/Bisaya)
                "baho", "mabaho", "amoy", "maamoy", "maasim",
                "mabahong basura", "amoy patay", "amoy bulok",
                // Garbage-related (Tagalog)
                "basura", "kalat", "makalat", "dumi", "marumi",
                "di nakuha", "hindi nakuha", "di kinolekta",
                "tambak", "nakatambak", "puno ng basura",
                // English variants
                "garbage", "trash", "dumping", "illegal dumping",
                "waste", "litter", "rubbish", "stink", "stench", "smelly",
                "uncollected garbage", "overflowing trash"
            ],
            urgency: 42,
            confidence: 0.88
        },

        // ========== INFRASTRUCTURE ==========
        Infrastructure: {
            keywords: [
                // Pothole-related (Tagalog/Bisaya)
                "lubak", "malubak", "butas", "butas sa daan", "butas sa kalsada",
                "sira", "sirang daan", "sirang kalsada", "wasak",
                "daan", "kalsada", "lansangan",
                "crack", "cracks", "bitak", "bali-bali",
                "bako", "bako-bako", "bakobako",
                // Bisaya specific
                "guba", "guba nga dalan", "naguba", "nangaguba",
                "dalan", "kalsada", "bungag",
                // English variants
                "pothole", "potholes", "unsafe", "unsafe road",
                "road damage", "damaged road", "broken road",
                "bridge", "tulay", "taytay"
            ],
            urgency: 50,
            confidence: 0.9
        },

        // ========== ENVIRONMENT ==========
        Environment: {
            keywords: [
                // Flood-related (Tagalog)
                "baha", "bumabaha", "binabaha", "bahain",
                "taas ng tubig", "mataas ang tubig", "tubig sa kalsada",
                "lunod", "nalulunod", "lumubog",
                // Bisaya specific
                "lunop", "nalunop", "gilunop",
                "apaw", "miapaw", "nag-apaw", "nagaapaw",
                "baha kaayo", "grabe ang baha",
                // English variants
                "flood", "flooding", "flooded", "flash flood",
                "overflow", "overflowing", "water level",
                "landslide", "erosion"
            ],
            urgency: 75,
            confidence: 0.92
        },

        // ========== PUBLIC SAFETY ==========
        "Public Safety": {
            keywords: [
                "sunog", "nasusunog", "nasunog", "apoy", "usok",
                "aksidente", "nasagasaan", "nabangga", "carambola",
                "krimen", "holdap", "nakawan", "magnanakaw",
                "away", "saksak", "barilan", "putukan",
                "patay", "namatay", "bangkay", "sugatan",
                "fire", "accident", "crime", "robbery", "assault",
                "emergency", "danger", "dangerous"
            ],
            urgency: 88,
            confidence: 0.95
        },

        // ========== TRAFFIC CONGESTION ==========
        "Traffic Congestion": {
            keywords: [
                "trapik", "traffic", "siksikan", "congestion",
                "hindi makalusot", "di makalusot", "stuck",
                "mabagal", "matraffic", "matrapik",
                "bottleneck", "gridlock", "jam"
            ],
            urgency: 45,
            confidence: 0.85
        },

        // ========== STRAY ANIMALS ==========
        "Stray Animals": {
            keywords: [
                "aso", "gala", "asong gala", "stray dog",
                "hayop", "ligaw na hayop", "stray animal",
                "ahas", "snake", "iro", "irong buang",
                "rabid", "loko", "mabangis"
            ],
            urgency: 45,
            confidence: 0.85
        },

        // ========== PEST INFESTATION ==========
        "Pest Infestation": {
            keywords: [
                "lamok", "mosquito", "dengue", "breeding",
                "daga", "rats", "mice", "ipis", "cockroach",
                "peste", "infestation", "kuto", "insekto"
            ],
            urgency: 40,
            confidence: 0.82
        },

        // ========== NOISE COMPLAINT ==========
        "Noise Complaint": {
            keywords: [
                "ingay", "maingay", "noise", "noisy",
                "karaoke", "videoke", "loud music",
                "sigaw", "tahol", "barking dog",
                "construction noise", "maingay na konstruksyon"
            ],
            urgency: 30,
            confidence: 0.8
        }
    };

    /**
     * v4.0: CATEGORY ANCHOR PHRASES for AI Fallback
     * Used with Universal Sentence Encoder for semantic similarity.
     * Each category has 3-5 representative phrases.
     */
    const CATEGORY_ANCHORS = {
        Infrastructure: [
            "broken road with potholes",
            "damaged street needs repair",
            "guba ang kalsada dili na magamit",
            "bridge is collapsing dangerous",
            "sirang daan malubak napakadelikado"
        ],
        Utilities: [
            "no water supply for days",
            "walang tubig matagal na",
            "power outage blackout kuryente",
            "brownout electricity problem",
            "weak water pressure mahina ang tubig"
        ],
        Sanitation: [
            "garbage not collected mabaho",
            "overflowing trash tambak na basura",
            "illegal dumping site marumi",
            "bad smell from sewage baho",
            "uncollected waste di nakuha basura"
        ],
        Environment: [
            "flooding in the streets bumabaha",
            "flash flood dangerous water level",
            "baha sa aming lugar lunop",
            "overflow river apaw ang tubig",
            "landslide erosion gumuho"
        ],
        "Public Safety": [
            "fire emergency sunog nasusunog",
            "crime robbery holdap nakawan",
            "accident injury aksidente sugatan",
            "violence fight away barilan",
            "medical emergency patay namatay"
        ],
        "Traffic Congestion": [
            "heavy traffic congestion trapik",
            "road blocked stuck di makalusot",
            "vehicle accident traffic jam",
            "gridlock bottleneck siksikan",
            "slow moving traffic mabagal"
        ],
        "Stray Animals": [
            "stray dog attacking asong gala",
            "dangerous animal snake ahas",
            "rabid dog loose loko aso",
            "wild animal in neighborhood",
            "stray cats dogs roaming"
        ],
        "Pest Infestation": [
            "mosquito breeding dengue lamok",
            "rat infestation daga problema",
            "cockroach infestation ipis marami",
            "pest control needed peste",
            "insect problem health hazard"
        ],
        "Noise Complaint": [
            "loud karaoke noise ingay",
            "noisy neighbors maingay kapitbahay",
            "construction noise disturbance",
            "barking dogs all night tahol",
            "loud music party videoke"
        ],
        Others: [
            "general complaint concern",
            "issue problem report",
            "request for assistance",
            "inquiry question concern",
            "feedback suggestion"
        ]
    };

    /**
     * CATEGORY HIERARCHY - Maps specific subcategories to parent categories
     */
    const CATEGORY_HIERARCHY = {
        // Infrastructure subcategories
        'Pothole': 'Infrastructure',
        'Road Damage': 'Infrastructure',
        'Broken Streetlight': 'Infrastructure',
        'Streetlight': 'Infrastructure',
        'Road Obstruction': 'Traffic',
        'Fallen Tree': 'Infrastructure',
        'Bridge Collapse': 'Infrastructure',

        // Utilities subcategories
        'No Water': 'Utilities',
        'Low Pressure': 'Utilities',
        'Pipe Leak': 'Utilities',
        'Blackout': 'Utilities',
        'Power Line Down': 'Utilities',
        'Transformer Explosion': 'Utilities',
        'Gas Leak': 'Emergency',

        // Sanitation subcategories
        'Trash': 'Sanitation',
        'Overflowing Trash': 'Sanitation',
        'Illegal Dumping': 'Sanitation',
        'Bad Odor': 'Sanitation',
        'Dead Animal': 'Sanitation',
        'Sewage Leak': 'Sanitation',
        'Garbage': 'Sanitation',
        'Clogged Drainage': 'Sanitation',
        'Clogged Canal': 'Sanitation',

        // Environment subcategories
        'Flood': 'Environment',
        'Flooding': 'Environment',
        'Flash Flood': 'Environment',
        'Landslide': 'Environment',
        'Earthquake': 'Emergency',

        // Public Safety subcategories
        'Fire': 'Emergency',
        'Smoke': 'Health Hazard',
        'Explosion': 'Emergency',
        'Building Collapse': 'Infrastructure',
        'Crime': 'Public Safety',
        'Robbery': 'Public Safety',
        'Assault': 'Public Safety',
        'Gunshot': 'Public Safety',
        'Vandalism': 'Public Safety',
        'Accident': 'Public Safety',
        'Medical': 'Public Safety',
        'Casualty': 'Public Safety',
        'Stranded': 'Public Safety',
        'Evacuation': 'Public Safety',
        'Drug Activity': 'Public Safety',
        'Gang Activity': 'Public Safety',
        'Trespassing': 'Public Safety',

        // Traffic subcategories
        'Traffic': 'Traffic Congestion',
        'Vehicle Breakdown': 'Traffic Congestion',
        'Traffic Congestion': 'Traffic Congestion',

        // Stray Animals
        'Stray Dog': 'Stray Animals',
        'Stray Animal': 'Stray Animals',
        'Snake Sighting': 'Stray Animals',
        'Stray Animals': 'Stray Animals',

        // Pest/Health
        'Pest Infestation': 'Pest Infestation',
        'Mosquito Breeding': 'Pest Infestation',
        'Health Hazard': 'Pest Infestation',

        // Noise
        'Noise Complaint': 'Noise Complaint',
        'Noise': 'Noise Complaint',
        'Loud Music': 'Noise Complaint',
        'Karaoke': 'Noise Complaint',
        'Barking Dog': 'Noise Complaint',

        // Trapped/Rescue
        'Trapped': 'Public Safety',
        'Rescue': 'Public Safety',

        // Parent categories
        'Infrastructure': 'Infrastructure',
        'Utilities': 'Utilities',
        'Sanitation': 'Sanitation',
        'Environment': 'Environment',
        'Public Safety': 'Public Safety',
        'Others': 'Others'
    };

    /**
     * Base Urgency Ratings by Category (0-100 scale)
     */
    const CATEGORY_URGENCY_RATINGS = {
        // TIER 1: Life-threatening (90-100)
        "Fire": 100,
        "Explosion": 100,
        "Gas Leak": 98,
        "Building Collapse": 98,
        "Medical": 95,
        "Casualty": 95,
        "Earthquake": 95,
        "Accident": 90,
        "Crime": 88,
        "Gunshot": 95,
        "Assault": 88,
        "Robbery": 85,

        // TIER 2: High Priority (70-89)
        "Flooding": 85,
        "Flood": 85,
        "Flash Flood": 90,
        "Landslide": 88,
        "Power Line Down": 82,
        "Transformer Explosion": 80,
        "Stranded": 78,
        "Evacuation": 85,
        "Blackout": 75,
        "Smoke": 75,
        "Drug Activity": 72,
        "Gang Activity": 75,
        "Trespassing": 65,

        // TIER 3: Infrastructure (50-69)
        "Pipe Leak": 65,
        "No Water": 60,
        "Road Damage": 55,
        "Pothole": 50,
        "Broken Streetlight": 55,
        "Streetlight": 55,
        "Fallen Tree": 60,
        "Road Obstruction": 58,
        "Bridge Collapse": 85,
        "Clogged Drainage": 55,
        "Clogged Canal": 55,

        // TIER 4: Quality of Life (30-49)
        "Trash": 40,
        "Overflowing Trash": 45,
        "Illegal Dumping": 42,
        "Bad Odor": 35,
        "Stray Dog": 45,
        "Stray Animal": 40,
        "Snake Sighting": 55,
        "Noise Complaint": 35,
        "Noise": 35,
        "Loud Music": 30,
        "Karaoke": 30,
        "Barking Dog": 25,
        "Traffic": 45,
        "Vehicle Breakdown": 40,

        // TIER 5: Minor (10-29)
        "Low Pressure": 30,
        "Pest Infestation": 35,
        "Mosquito Breeding": 40,
        "Health Hazard": 50,
        "Vandalism": 35,
        "Loitering": 20,
        "Others": 30,
        "Infrastructure": 45,
        "Utilities": 50,
        "Sanitation": 40,
        "Environment": 50,
        "Public Safety": 70,
        "Dead Animal": 35,
        "Sewage Leak": 55
    };

    /**
     * Intensifier words (English/Tagalog/Bisaya)
     */
    const INTENSIFIER_WORDS = [
        // English
        "extreme", "extremely", "very", "severe", "severely", "massive", "huge",
        "critical", "urgent", "emergency", "dangerous", "deadly", "serious",
        "major", "terrible", "awful", "horrible", "worst", "intense",
        // Tagalog
        "sobra", "sobrang", "grabe", "grabeng", "malala", "malalang",
        "matindi", "matinding", "napaka", "lubha", "lubhang", "todo",
        "husto", "hustong", "labis", "labis na", "sukdulan",
        // Bisaya
        "pirti", "pirting", "dako", "dakong", "grabe kaayo", "perte",
        "hilabihan", "lawom", "kusog", "kusog kaayo", "bangis"
    ];

    /**
     * Negation words (English/Tagalog/Bisaya)
     */
    const NEGATION_WORDS = [
        // English
        "no", "not", "none", "never", "nothing", "false", "fake",
        "isn't", "isnt", "wasn't", "wasnt", "aren't", "arent",
        "doesn't", "doesnt", "didn't", "didnt", "don't", "dont",
        "won't", "wont", "wouldn't", "wouldnt", "shouldn't", "shouldnt",
        "cannot", "can't", "cant", "without",
        // Tagalog
        "wala", "walang", "hindi", "di", "huwag", "ayaw",
        "hindi naman", "di naman", "walang problema",
        "hindi totoo", "di totoo", "wala namang",
        // Bisaya
        "walay", "dili", "ayaw", "way", "wa"
    ];

    /**
     * Clause separators for clause-based context analysis
     */
    const CLAUSE_SEPARATORS = /[.!?;]|\bpero\b|\bbut\b|\bkaso\b|\bhowever\b|\bkaya\b|\bso\b|\bthen\b|\bpagkatapos\b|\bundangan\b/gi;

    /**
     * Uncertainty words
     */
    const UNCERTAINTY_WORDS = [
        "maybe", "perhaps", "possibly", "might", "likely", "unsure", "think", "guess",
        "baka", "siguro", "tila", "yata", "parang", "marahil", "ata",
        "tingali", "basi", "murag", "daw", "basin"
    ];

    /**
     * Configuration constants
     */
    const CONTEXT_WINDOW = 3;
    const INTENSIFIER_MULTIPLIER = 1.5;
    const UNCERTAINTY_PENALTY = 0.2;
    const MAX_URGENCY_SCORE = 100;
    const AI_CONFIDENCE_THRESHOLD = 0.6;  // Trigger AI if below this
    const AI_SIMILARITY_THRESHOLD = 0.75; // Accept AI result if above this
    const MULTI_LABEL_URGENCY_THRESHOLD = 50; // Include categories above this

    // ==================== AI FALLBACK STATE ====================

    /**
     * TensorFlow.js + USE state
     */
    let tfReady = false;
    let useModel = null;
    let anchorEmbeddings = null;
    let aiLoadingPromise = null;
    let aiLoadError = null;

    // ==================== DEBUG/THESIS MODE ====================

    /**
     * v4.1: Debug/Thesis Mode for performance visualization
     * When enabled, shows detailed timing and reasoning traces
     */
    let debugModeEnabled = false;
    let lastProcessingMetrics = {
        totalTime: 0,
        ruleBasedTime: 0,
        aiTime: 0,
        aiSkipped: true,
        memoryUsage: 0
    };

    /**
     * Enable or disable debug/thesis mode
     */
    function setDebugMode(enabled) {
        debugModeEnabled = enabled;
        console.log(`[NLP-v4] 🔧 Debug/Thesis Mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
        if (enabled) {
            console.log('[NLP-v4] Performance metrics will now be logged with each classification');
        }
    }

    /**
     * Get current debug mode status and last metrics
     */
    function getDebugStatus() {
        return {
            enabled: debugModeEnabled,
            metrics: { ...lastProcessingMetrics }
        };
    }

    // ==================== INDEXEDDB CACHING FOR USE MODEL ====================

    const IDB_NAME = 'CitizenLinkNLP';
    const IDB_STORE = 'modelCache';
    const IDB_VERSION = 1;
    const ANCHOR_CACHE_KEY = 'use_anchor_embeddings_v1';

    /**
     * Open IndexedDB connection
     */
    function openCacheDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(IDB_NAME, IDB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE, { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Get cached data from IndexedDB
     */
    async function getFromCache(key) {
        try {
            const db = await openCacheDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(IDB_STORE, 'readonly');
                const store = tx.objectStore(IDB_STORE);
                const request = store.get(key);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result?.data || null);
            });
        } catch (error) {
            console.warn('[NLP-AI] IndexedDB read error:', error);
            return null;
        }
    }

    /**
     * Save data to IndexedDB cache
     */
    async function saveToCache(key, data) {
        try {
            const db = await openCacheDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(IDB_STORE, 'readwrite');
                const store = tx.objectStore(IDB_STORE);
                const request = store.put({ key, data, timestamp: Date.now() });

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(true);
            });
        } catch (error) {
            console.warn('[NLP-AI] IndexedDB write error:', error);
            return false;
        }
    }

    /**
     * v4.0: Asynchronously load TensorFlow.js and Universal Sentence Encoder
     * Non-blocking - page works without AI if loading fails
     * v4.1: Added IndexedDB caching for anchor embeddings
     */
    async function initAIFallback() {
        if (aiLoadingPromise) return aiLoadingPromise;

        aiLoadingPromise = (async () => {
            try {
                console.log('[NLP-AI] 🚀 Starting TensorFlow.js initialization...');

                // Check if TensorFlow.js is available
                if (typeof tf === 'undefined') {
                    // Try to load from CDN
                    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js');
                    console.log('[NLP-AI] ✅ TensorFlow.js loaded from CDN');
                }

                // Enable IndexedDB storage backend for TensorFlow.js model caching
                if (tf && tf.io && tf.io.browserFiles) {
                    console.log('[NLP-AI] 📦 TensorFlow.js will use IndexedDB for model caching');
                }

                // Check if USE is available
                if (typeof use === 'undefined') {
                    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/universal-sentence-encoder@1.3.3/dist/universal-sentence-encoder.min.js');
                    console.log('[NLP-AI] ✅ Universal Sentence Encoder loaded from CDN');
                }

                // Load the USE model - TensorFlow.js automatically caches in IndexedDB
                console.log('[NLP-AI] 📦 Loading USE model (cached after first load)...');
                const modelLoadStart = performance.now();
                useModel = await use.load();
                const modelLoadTime = performance.now() - modelLoadStart;
                console.log(`[NLP-AI] ✅ USE model loaded in ${modelLoadTime.toFixed(0)}ms ${modelLoadTime < 1000 ? '(from cache!)' : ''}`);

                // Try to load cached anchor embeddings first
                console.log('[NLP-AI] 🔍 Checking IndexedDB for cached anchor embeddings...');
                const cachedAnchors = await getFromCache(ANCHOR_CACHE_KEY);

                if (cachedAnchors) {
                    anchorEmbeddings = cachedAnchors;
                    console.log('[NLP-AI] ✅ Anchor embeddings loaded from IndexedDB cache (instant)');
                } else {
                    // Pre-compute anchor embeddings for faster inference
                    console.log('[NLP-AI] 🧮 Pre-computing category anchor embeddings (first time only)...');
                    const anchorStart = performance.now();
                    anchorEmbeddings = await precomputeAnchorEmbeddings();
                    const anchorTime = performance.now() - anchorStart;
                    console.log(`[NLP-AI] ✅ Anchor embeddings computed in ${anchorTime.toFixed(0)}ms`);

                    // Cache for future use
                    await saveToCache(ANCHOR_CACHE_KEY, anchorEmbeddings);
                    console.log('[NLP-AI] 💾 Anchor embeddings saved to IndexedDB for future sessions');
                }

                tfReady = true;
                const totalTime = performance.now() - modelLoadStart;
                console.log(`[NLP-AI] 🎉 AI Fallback fully initialized in ${totalTime.toFixed(0)}ms - Ready for inference`);

                return true;
            } catch (error) {
                aiLoadError = error;
                console.warn('[NLP-AI] ⚠️ AI Fallback initialization failed:', error.message);
                console.warn('[NLP-AI] System will operate in Rule-Only mode');
                return false;
            }
        })();

        return aiLoadingPromise;
    }

    /**
     * Helper to dynamically load external scripts
     */
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load: ${src}`));
            document.head.appendChild(script);
        });
    }

    /**
     * Pre-compute embeddings for all category anchors
     * Caches the result for fast cosine similarity lookup
     */
    async function precomputeAnchorEmbeddings() {
        if (!useModel) return null;

        const embeddings = {};

        for (const [category, phrases] of Object.entries(CATEGORY_ANCHORS)) {
            // Encode all phrases for this category
            const phraseEmbeddings = await useModel.embed(phrases);
            const embeddingArray = await phraseEmbeddings.array();

            // Store the mean embedding for the category
            embeddings[category] = {
                vectors: embeddingArray,
                meanVector: computeMeanVector(embeddingArray)
            };

            // Dispose tensor to free memory
            phraseEmbeddings.dispose();
        }

        return embeddings;
    }

    /**
     * Compute mean vector from array of vectors
     */
    function computeMeanVector(vectors) {
        if (!vectors || vectors.length === 0) return null;

        const dim = vectors[0].length;
        const mean = new Array(dim).fill(0);

        for (const vec of vectors) {
            for (let i = 0; i < dim; i++) {
                mean[i] += vec[i];
            }
        }

        for (let i = 0; i < dim; i++) {
            mean[i] /= vectors.length;
        }

        return mean;
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    function cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
    }

    /**
     * v4.0: AI Fallback Classification using USE
     * Called when rule-based confidence is low or category is "Others"
     * 
     * @param {string} text - Input text to classify
     * @returns {Object|null} { category, confidence, similarity } or null if AI unavailable
     */
    async function classifyWithAI(text) {
        if (!tfReady || !useModel || !anchorEmbeddings) {
            console.log('[NLP-AI] ⚠️ AI not ready, skipping fallback');
            return null;
        }

        try {
            const startTime = performance.now();

            // Encode the input text
            const inputEmbedding = await useModel.embed([text]);
            const inputVector = (await inputEmbedding.array())[0];
            inputEmbedding.dispose();

            // Calculate similarity with each category
            const similarities = {};
            let bestCategory = 'Others';
            let bestSimilarity = 0;

            for (const [category, data] of Object.entries(anchorEmbeddings)) {
                // Compare against mean vector for speed
                const similarity = cosineSimilarity(inputVector, data.meanVector);
                similarities[category] = similarity;

                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                    bestCategory = category;
                }
            }

            const processingTime = performance.now() - startTime;

            console.log(`[NLP-AI] 🧠 AI classification in ${processingTime.toFixed(2)}ms:`, {
                input: text.substring(0, 40) + '...',
                bestCategory,
                similarity: bestSimilarity.toFixed(3),
                allSimilarities: Object.fromEntries(
                    Object.entries(similarities)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([k, v]) => [k, v.toFixed(3)])
                )
            });

            return {
                category: bestCategory,
                similarity: bestSimilarity,
                confidence: bestSimilarity,
                allSimilarities: similarities,
                processingTimeMs: processingTime
            };

        } catch (error) {
            console.error('[NLP-AI] ❌ Classification error:', error);
            return null;
        }
    }

    // ==================== INTERNAL STATE ====================

    let _cachedKeywordIndex = null;
    let _cachedDictionaryHash = null;
    let _hardcodedKeywordsIndex = null;
    let taxonomyCache = null;

    if (typeof CitizenLinkTaxonomy !== 'undefined') {
        CitizenLinkTaxonomy.loadTaxonomy().then(t => {
            taxonomyCache = t;
        }).catch(() => {
            taxonomyCache = null;
        });
    }

    // ==================== CORE FUNCTIONS ====================

    /**
     * v4.0: Tokenize with clause segmentation
     * Splits text into clauses first, then tokenizes each clause
     * 
     * @param {string} text - Raw input text
     * @returns {Object} { clauses: [{ text, tokens, startIdx }], allTokens: [] }
     */
    function tokenizeWithClauses(text) {
        if (!text || typeof text !== 'string') {
            return { clauses: [], allTokens: [] };
        }

        // Split by clause separators
        const clauseTexts = text.split(CLAUSE_SEPARATORS).filter(c => c.trim().length > 0);

        const clauses = [];
        const allTokens = [];
        let tokenOffset = 0;

        clauseTexts.forEach((clauseText, clauseIdx) => {
            const tokens = clauseText
                .toLowerCase()
                .replace(/[^\w\s-]/g, ' ')
                .split(/\s+/)
                .filter(token => token.length > 0);

            clauses.push({
                text: clauseText.trim(),
                tokens: tokens,
                startIdx: tokenOffset,
                clauseIndex: clauseIdx
            });

            // Track which clause each token belongs to
            tokens.forEach((token, idx) => {
                allTokens.push({
                    token,
                    globalIdx: tokenOffset + idx,
                    clauseIdx: clauseIdx
                });
            });

            tokenOffset += tokens.length;
        });

        return { clauses, allTokens };
    }

    /**
     * Simple tokenization (backward compatible)
     */
    function tokenizeForNLP(text) {
        if (!text || typeof text !== 'string') return [];
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 0);
    }

    /**
     * Build hardcoded keywords index from NLP_KEYWORDS constant
     */
    function buildHardcodedKeywordsIndex() {
        if (_hardcodedKeywordsIndex) return _hardcodedKeywordsIndex;

        const index = new Map();

        for (const [category, data] of Object.entries(NLP_KEYWORDS)) {
            for (const keyword of data.keywords) {
                const normalizedKeyword = keyword.toLowerCase();
                const canonicalLabel = (typeof CitizenLinkTaxonomy !== 'undefined' && taxonomyCache)
                    ? CitizenLinkTaxonomy.normalizeLabel(category, taxonomyCache)
                    : category;
                const parentCategory = getParentCategory(canonicalLabel);
                const specificCategory = (typeof CitizenLinkTaxonomy !== 'undefined' && taxonomyCache && CitizenLinkTaxonomy.isValidSubcategory(canonicalLabel, taxonomyCache))
                    ? canonicalLabel
                    : null;

                // Only add if not exists or if higher urgency
                if (!index.has(normalizedKeyword) || index.get(normalizedKeyword).urgency < data.urgency) {
                    index.set(normalizedKeyword, {
                        category: parentCategory,
                        specificCategory: specificCategory,
                        confidence: data.confidence,
                        urgency: data.urgency,
                        source: 'hardcoded-v4'
                    });
                }
            }
        }

        _hardcodedKeywordsIndex = index;
        console.log(`[NLP-PROCESSOR] 📚 Hardcoded keywords indexed: ${index.size} terms`);

        return index;
    }

    /**
     * Hash dictionary for cache invalidation
     */
    function _hashDictionary(dictionary) {
        if (!dictionary) return null;
        try {
            const meta = dictionary._metadata || {};
            return `${meta.version || 'unknown'}_${meta.total_entries || 0}`;
        } catch (e) {
            return null;
        }
    }

    /**
     * Build keyword index from dictionary JSON + hardcoded keywords
     */
    function buildKeywordIndex(dictionary) {
        const currentHash = _hashDictionary(dictionary);
        if (_cachedKeywordIndex && _cachedDictionaryHash === currentHash) {
            return _cachedKeywordIndex;
        }

        // Start with hardcoded keywords (highest priority)
        const hardcodedIndex = buildHardcodedKeywordsIndex();
        const index = new Map(hardcodedIndex);

        if (!dictionary) {
            console.warn('[NLP-PROCESSOR] No dictionary provided, using hardcoded only');
            _cachedKeywordIndex = index;
            return index;
        }

        // Helper to process keywords from JSON dictionary
        const processKeywords = (keywords, defaultCategory) => {
            if (!Array.isArray(keywords)) return;

            keywords.forEach(entry => {
                if (entry.term) {
                    const term = entry.term.toLowerCase();
                    const specificCategory = entry.category || defaultCategory;
                    // v4.0: Map to parent category for database consistency
                    const parentCategory = getParentCategory(specificCategory);
                    const confidence = entry.confidence || 0.7;
                    const urgency = CATEGORY_URGENCY_RATINGS[specificCategory] ||
                        CATEGORY_URGENCY_RATINGS[parentCategory] || 30;

                    // Only add if not already in hardcoded (hardcoded has priority)
                    if (!index.has(term)) {
                        index.set(term, {
                            category: parentCategory,  // v4.0: Use parent category
                            specificCategory: specificCategory,
                            confidence,
                            urgency,
                            translation: entry.translation || null,
                            source: 'dictionary'
                        });
                    }
                }
            });
        };

        // Process filipino_keywords section
        if (dictionary.filipino_keywords) {
            Object.keys(dictionary.filipino_keywords).forEach(group => {
                const groupData = dictionary.filipino_keywords[group];
                if (typeof groupData === 'object') {
                    Object.keys(groupData).forEach(subgroup => {
                        processKeywords(groupData[subgroup], subgroup);
                    });
                }
            });
        }

        // Process english_keywords section
        if (dictionary.english_keywords) {
            Object.keys(dictionary.english_keywords).forEach(group => {
                processKeywords(dictionary.english_keywords[group], group);
            });
        }

        _cachedKeywordIndex = index;
        _cachedDictionaryHash = currentHash;

        console.log(`[NLP-PROCESSOR] 📚 Keyword index built: ${index.size} terms (hardcoded + dictionary)`);

        return index;
    }

    /**
     * Clear cached keyword index
     */
    function clearKeywordCache() {
        _cachedKeywordIndex = null;
        _cachedDictionaryHash = null;
        _hardcodedKeywordsIndex = null;
        console.log('[NLP-PROCESSOR] Keyword cache cleared');
    }

    /**
     * Get parent category from hierarchy
     */
    function getParentCategory(specificCategory) {
        if (!specificCategory) return 'Others';
        const normalized = String(specificCategory).trim();
        if (typeof CitizenLinkTaxonomy !== 'undefined' && taxonomyCache) {
            return CitizenLinkTaxonomy.getParentForLabel(normalized, taxonomyCache);
        }
        return CATEGORY_HIERARCHY[normalized] || normalized;
    }

    /**
     * v4.0: Clause-based negation detection
     * Only applies negation if found within the SAME clause as the keyword
     */
    function hasNegationInClause(clause, keywordIdx) {
        const tokens = clause.tokens;
        const startIdx = Math.max(0, keywordIdx - CONTEXT_WINDOW);
        const endIdx = Math.min(tokens.length - 1, keywordIdx + CONTEXT_WINDOW);

        for (let i = startIdx; i <= endIdx; i++) {
            if (i !== keywordIdx && NEGATION_WORDS.includes(tokens[i])) {
                return { found: true, word: tokens[i] };
            }
        }
        return { found: false, word: null };
    }

    /**
     * v4.0: Clause-based intensifier detection
     */
    function hasIntensifierInClause(clause, keywordIdx) {
        const tokens = clause.tokens;
        const startIdx = Math.max(0, keywordIdx - CONTEXT_WINDOW);
        const endIdx = Math.min(tokens.length - 1, keywordIdx + CONTEXT_WINDOW);

        for (let i = startIdx; i <= endIdx; i++) {
            if (i !== keywordIdx && INTENSIFIER_WORDS.includes(tokens[i])) {
                return { found: true, word: tokens[i] };
            }
        }
        return { found: false, word: null };
    }

    /**
     * v4.0: Clause-based uncertainty detection
     */
    function hasUncertaintyInClause(clause, keywordIdx) {
        const tokens = clause.tokens;
        const startIdx = Math.max(0, keywordIdx - CONTEXT_WINDOW);
        const endIdx = Math.min(tokens.length - 1, keywordIdx + CONTEXT_WINDOW);

        for (let i = startIdx; i <= endIdx; i++) {
            if (i !== keywordIdx && UNCERTAINTY_WORDS.includes(tokens[i])) {
                return { found: true, word: tokens[i] };
            }
        }
        return { found: false, word: null };
    }

    // Legacy functions for backward compatibility
    function hasNegationNearby(tokens, keywordIndex) {
        const startIdx = Math.max(0, keywordIndex - CONTEXT_WINDOW);
        const endIdx = Math.min(tokens.length - 1, keywordIndex + CONTEXT_WINDOW);

        for (let i = startIdx; i <= endIdx; i++) {
            if (i !== keywordIndex && NEGATION_WORDS.includes(tokens[i])) {
                return { found: true, word: tokens[i] };
            }
        }
        return { found: false, word: null };
    }

    function hasIntensifierNearby(tokens, keywordIndex) {
        const startIdx = Math.max(0, keywordIndex - CONTEXT_WINDOW);
        const endIdx = Math.min(tokens.length - 1, keywordIndex + CONTEXT_WINDOW);

        for (let i = startIdx; i <= endIdx; i++) {
            if (i !== keywordIndex && INTENSIFIER_WORDS.includes(tokens[i])) {
                return { found: true, word: tokens[i] };
            }
        }
        return { found: false, word: null };
    }

    function hasUncertaintyNearby(tokens, keywordIndex) {
        const startIdx = Math.max(0, keywordIndex - CONTEXT_WINDOW);
        const endIdx = Math.min(tokens.length - 1, keywordIndex + CONTEXT_WINDOW);

        for (let i = startIdx; i <= endIdx; i++) {
            if (i !== keywordIndex && UNCERTAINTY_WORDS.includes(tokens[i])) {
                return { found: true, word: tokens[i] };
            }
        }
        return { found: false, word: null };
    }

    /**
     * ============================================================================
     * v4.0: HYBRID SEMANTIC SCORING ENGINE
     * ============================================================================
     * 
     * Main NLP Analysis Function with AI Fallback
     * 
     * Algorithm:
     * 1. Tokenize with clause segmentation
     * 2. Match tokens against dictionary (fast path)
     * 3. For low-confidence/Others: trigger AI fallback (slow path)
     * 4. Apply clause-based modifiers
     * 5. Multi-label resolution (return ALL categories > 50 urgency)
     * 
     * @param {string} rawInput - The raw complaint/report text
     * @param {Object} dictionary - The NLP dictionary object
     * @param {Object} options - { useAI: true, async: false }
     * @returns {Object} Analysis result with detectedCategories array
     */
    function analyzeText(rawInput, dictionary, options = {}) {
        const useAI = options.useAI !== false; // Default: true
        const startTime = performance.now();

        const result = {
            category: null,
            specificCategory: null,
            subcategory: null,
            detectedCategories: [],  // v4.0: Multi-label support
            urgencyScore: 0,
            confidence: 0,
            matchedKeywords: [],
            isNegated: false,
            isIntensified: false,
            isUncertain: false,
            negationWord: null,
            intensifierWord: null,
            uncertaintyWord: null,
            rawInput: rawInput,
            tokenCount: 0,
            clauseCount: 0,
            processingLog: [],
            processingTimeMs: 0,
            aiUsed: false,
            aiResult: null
        };

        if (!rawInput || typeof rawInput !== 'string') {
            result.processingLog.push('Empty or invalid input');
            result.processingTimeMs = performance.now() - startTime;
            return result;
        }

        // Step 1: Tokenize with clause segmentation
        const { clauses, allTokens } = tokenizeWithClauses(rawInput);
        result.tokenCount = allTokens.length;
        result.clauseCount = clauses.length;
        result.processingLog.push(`Tokenized: ${allTokens.length} tokens in ${clauses.length} clauses`);

        if (allTokens.length === 0) {
            result.processingLog.push('No tokens extracted');
            result.processingTimeMs = performance.now() - startTime;
            return result;
        }

        // Step 2: Build keyword index
        const keywordIndex = buildKeywordIndex(dictionary);
        result.processingLog.push(`Dictionary indexed: ${keywordIndex.size} terms`);

        // Step 3: Match tokens against dictionary (clause-aware)
        const matches = [];

        clauses.forEach((clause, clauseIdx) => {
            const tokens = clause.tokens;

            // Single token matching
            tokens.forEach((token, localIdx) => {
                if (keywordIndex.has(token)) {
                    const entry = keywordIndex.get(token);
                    matches.push({
                        keyword: token,
                        localIndex: localIdx,
                        clauseIndex: clauseIdx,
                        clause: clause,
                        ...entry
                    });
                }
            });

            // Multi-word matching (2-gram and 3-gram)
            for (let i = 0; i < tokens.length - 1; i++) {
                const bigram = `${tokens[i]} ${tokens[i + 1]}`;
                if (keywordIndex.has(bigram)) {
                    const entry = keywordIndex.get(bigram);
                    matches.push({
                        keyword: bigram,
                        localIndex: i,
                        clauseIndex: clauseIdx,
                        clause: clause,
                        ...entry
                    });
                }

                if (i < tokens.length - 2) {
                    const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
                    if (keywordIndex.has(trigram)) {
                        const entry = keywordIndex.get(trigram);
                        matches.push({
                            keyword: trigram,
                            localIndex: i,
                            clauseIndex: clauseIdx,
                            clause: clause,
                            ...entry
                        });
                    }
                }
            }
        });

        result.processingLog.push(`Dictionary matches found: ${matches.length}`);

        // Step 4: Process matches with clause-based modifiers
        const processedMatches = matches.map(match => {
            let urgency = match.urgency;
            let negated = false;
            let intensified = false;
            let uncertain = false;
            let negationWord = null;
            let intensifierWord = null;
            let uncertaintyWord = null;

            // v4.0: CLAUSE-BASED modifier detection
            const negationCheck = hasNegationInClause(match.clause, match.localIndex);
            if (negationCheck.found) {
                urgency = 0;
                negated = true;
                negationWord = negationCheck.word;
                result.processingLog.push(`"${match.keyword}" NEGATED by "${negationWord}" in clause ${match.clauseIndex} → urgency = 0`);
            } else {
                const intensifierCheck = hasIntensifierInClause(match.clause, match.localIndex);
                if (intensifierCheck.found) {
                    urgency = Math.min(urgency * INTENSIFIER_MULTIPLIER, MAX_URGENCY_SCORE);
                    intensified = true;
                    intensifierWord = intensifierCheck.word;
                    result.processingLog.push(`"${match.keyword}" INTENSIFIED by "${intensifierWord}" in clause ${match.clauseIndex} → urgency = ${urgency}`);
                }

                const uncertaintyCheck = hasUncertaintyInClause(match.clause, match.localIndex);
                if (uncertaintyCheck.found) {
                    uncertain = true;
                    uncertaintyWord = uncertaintyCheck.word;
                    match.confidence = Math.max(match.confidence - UNCERTAINTY_PENALTY, 0.1);
                    result.processingLog.push(`"${match.keyword}" UNCERTAINTY detected in clause ${match.clauseIndex} → confidence reduced`);
                }
            }

            return {
                ...match,
                finalUrgency: urgency,
                negated,
                intensified,
                uncertain,
                negationWord,
                intensifierWord,
                uncertaintyWord
            };
        });

        // Step 5: v4.0 MULTI-LABEL RESOLUTION
        // Group by category and find max urgency per category
        const categoryScores = {};

        processedMatches.forEach(match => {
            const cat = match.category;
            if (!categoryScores[cat] || match.finalUrgency > categoryScores[cat].urgency) {
                categoryScores[cat] = {
                    category: cat,
                    specificCategory: match.specificCategory || cat,
                    urgency: match.finalUrgency,
                    confidence: match.confidence,
                    keyword: match.keyword,
                    negated: match.negated,
                    intensified: match.intensified
                };
            }
        });

        // Get all categories with urgency > threshold (multi-label)
        const detectedCategories = Object.values(categoryScores)
            .filter(cs => cs.urgency >= MULTI_LABEL_URGENCY_THRESHOLD)
            .sort((a, b) => b.urgency - a.urgency);

        result.detectedCategories = detectedCategories;

        // Determine primary category (highest urgency)
        if (detectedCategories.length > 0) {
            const primary = detectedCategories[0];
            result.category = primary.category;
            result.specificCategory = primary.specificCategory;
            result.urgencyScore = Math.round(primary.urgency);
            result.confidence = primary.confidence;
            result.isNegated = primary.negated;
            result.isIntensified = primary.intensified;
        } else if (processedMatches.length > 0) {
            // Fallback to best match even if below threshold
            processedMatches.sort((a, b) => b.finalUrgency - a.finalUrgency || b.confidence - a.confidence);
            const winner = processedMatches[0];
            result.category = winner.category;
            result.specificCategory = winner.specificCategory || winner.category;
            result.urgencyScore = Math.round(winner.finalUrgency);
            result.confidence = winner.confidence;
            result.isNegated = winner.negated;
            result.isIntensified = winner.intensified;
            result.negationWord = winner.negationWord;
            result.intensifierWord = winner.intensifierWord;
        }

        if (typeof CitizenLinkTaxonomy !== 'undefined' && taxonomyCache) {
            result.detectedCategories = result.detectedCategories.map(dc => {
                const pair = CitizenLinkTaxonomy.normalizeCategoryPair(dc.category, dc.specificCategory, taxonomyCache);
                return {
                    ...dc,
                    category: pair.category,
                    specificCategory: pair.subcategory || dc.specificCategory
                };
            });

            const pair = CitizenLinkTaxonomy.normalizeCategoryPair(result.category, result.specificCategory, taxonomyCache);
            result.category = pair.category;
            result.subcategory = pair.subcategory;
            result.specificCategory = pair.subcategory;
        } else {
            result.subcategory = result.specificCategory;
        }

        // Step 6: v4.0 AI FALLBACK TRIGGER
        // If category is "Others" OR confidence < threshold, queue AI classification
        const needsAIFallback = useAI && tfReady && (
            !result.category ||
            result.category === 'Others' ||
            result.confidence < AI_CONFIDENCE_THRESHOLD
        );

        if (needsAIFallback) {
            result.processingLog.push(`🤖 AI fallback triggered (category: ${result.category || 'null'}, confidence: ${result.confidence})`);
            result._needsAIFallback = true;
            result._aiInput = rawInput;
        }

        // Store all matched keywords for debugging
        result.matchedKeywords = processedMatches.map(m => ({
            keyword: m.keyword,
            category: m.category,
            parentCategory: getParentCategory(m.specificCategory || m.category),
            baseUrgency: m.urgency,
            finalUrgency: m.finalUrgency,
            confidence: m.confidence,
            negated: m.negated,
            intensified: m.intensified,
            uncertain: m.uncertain,
            clauseIndex: m.clauseIndex,
            translation: m.translation
        }));

        result.processingTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

        // v4.1: Update metrics for debug mode
        lastProcessingMetrics.ruleBasedTime = result.processingTimeMs;
        lastProcessingMetrics.totalTime = result.processingTimeMs;
        lastProcessingMetrics.aiTime = 0;
        lastProcessingMetrics.aiSkipped = true;

        // Estimate memory usage if available
        if (performance.memory) {
            lastProcessingMetrics.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024 * 100) / 100;
        }

        // Log summary
        const primaryCat = result.category || 'Others';
        const multiLabel = result.detectedCategories.length > 1
            ? ` (+${result.detectedCategories.length - 1} more)`
            : '';

        // v4.1: DETAILED REASONING TRACE (Debug/Thesis Mode)
        if (debugModeEnabled) {
            console.group(`[NLP-v4] 🔬 REASONING TRACE for: "${rawInput.substring(0, 60)}..."`);
            console.log('%c📝 INPUT', 'color: #6366f1; font-weight: bold', rawInput);
            console.log('%c🔤 TOKENIZATION', 'color: #8b5cf6; font-weight: bold', {
                totalTokens: allTokens.length,
                clauseCount: clauses.length,
                clauses: clauses.map((c, i) => `[${i}] "${c.tokens.join(' ')}"`)
            });

            // Log each match with full reasoning
            console.log('%c🎯 KEYWORD MATCHES', 'color: #10b981; font-weight: bold');
            processedMatches.forEach((m, i) => {
                const status = m.negated ? '❌ NEGATED' : m.intensified ? '⚡ INTENSIFIED' : '✅ ACTIVE';
                console.log(
                    `  [${i + 1}] Matched "${m.keyword}" in Clause ${m.clauseIndex} → ${m.category} ` +
                    `(Base: ${m.urgency}, Final: ${m.finalUrgency}) ${status}` +
                    (m.negationWord ? ` [negated by "${m.negationWord}"]` : '') +
                    (m.intensifierWord ? ` [boosted by "${m.intensifierWord}"]` : '')
                );
            });

            console.log('%c📊 MULTI-LABEL RESOLUTION', 'color: #f59e0b; font-weight: bold', {
                categoriesAboveThreshold: detectedCategories.length,
                threshold: MULTI_LABEL_URGENCY_THRESHOLD,
                categories: detectedCategories.map(c => `${c.category}: ${c.urgency}`)
            });

            console.log('%c🏆 FINAL RESULT', 'color: #ef4444; font-weight: bold', {
                primaryCategory: primaryCat,
                urgency: result.urgencyScore,
                confidence: result.confidence?.toFixed(3),
                multiLabel: result.detectedCategories.length > 1,
                aiNeeded: !!result._needsAIFallback
            });

            console.log('%c⏱️ PERFORMANCE', 'color: #06b6d4; font-weight: bold', {
                ruleBasedTime: `${result.processingTimeMs}ms`,
                aiTime: result._needsAIFallback ? 'pending...' : 'skipped'
            });
            console.groupEnd();
        } else {
            // Standard log when debug mode is off
            console.log(`[NLP-PROCESSOR] 🧠 Analysis complete in ${result.processingTimeMs}ms:`, {
                input: rawInput.substring(0, 50) + (rawInput.length > 50 ? '...' : ''),
                category: primaryCat + multiLabel,
                urgency: result.urgencyScore,
                confidence: result.confidence?.toFixed(2),
                negated: result.isNegated,
                intensified: result.isIntensified,
                clauseCount: result.clauseCount,
                matchCount: matches.length,
                aiNeeded: !!result._needsAIFallback
            });
        }

        return result;
    }

    /**
     * v4.0: Async version of analyzeText with AI fallback
     * Use this for complete hybrid analysis
     * 
     * @param {string} rawInput - The raw complaint text
     * @param {Object} dictionary - The NLP dictionary
     * @param {Object} options - { useAI: true }
     * @returns {Promise<Object>} Analysis result
     */
    async function analyzeTextAsync(rawInput, dictionary, options = {}) {
        const asyncStartTime = performance.now();

        // First, run synchronous rule-based analysis
        const result = analyzeText(rawInput, dictionary, options);

        // If AI fallback is needed and available, run it
        if (result._needsAIFallback && tfReady) {
            try {
                const aiStartTime = performance.now();
                const aiResult = await classifyWithAI(result._aiInput);
                const aiTime = performance.now() - aiStartTime;

                // v4.1: Update metrics
                lastProcessingMetrics.aiTime = Math.round(aiTime * 100) / 100;
                lastProcessingMetrics.aiSkipped = false;

                if (aiResult && aiResult.similarity >= AI_SIMILARITY_THRESHOLD) {
                    // AI override
                    const previousCategory = result.category;
                    const pair = (typeof CitizenLinkTaxonomy !== 'undefined' && taxonomyCache)
                        ? CitizenLinkTaxonomy.normalizeCategoryPair(aiResult.category, null, taxonomyCache)
                        : { category: aiResult.category, subcategory: null };
                    const urgencyKey = pair.subcategory || pair.category;
                    result.category = pair.category;
                    result.subcategory = pair.subcategory;
                    result.specificCategory = pair.subcategory;
                    result.confidence = aiResult.confidence;
                    result.urgencyScore = CATEGORY_URGENCY_RATINGS[urgencyKey] ||
                        CATEGORY_URGENCY_RATINGS[pair.category] ||
                        NLP_KEYWORDS[urgencyKey]?.urgency ||
                        NLP_KEYWORDS[pair.category]?.urgency ||
                        40;
                    result.aiUsed = true;
                    result.aiResult = aiResult;

                    // Add to detected categories if not already present
                    if (!result.detectedCategories.some(dc => dc.category === pair.category && (dc.specificCategory || null) === (pair.subcategory || null))) {
                        result.detectedCategories.unshift({
                            category: pair.category,
                            specificCategory: pair.subcategory || pair.category,
                            urgency: result.urgencyScore,
                            confidence: aiResult.confidence,
                            source: 'AI-USE'
                        });
                    }

                    result.processingLog.push(`🤖 AI override: ${previousCategory} → ${pair.subcategory || pair.category} (similarity: ${aiResult.similarity.toFixed(3)})`);

                    // v4.1: Debug mode detailed AI logging
                    if (debugModeEnabled) {
                        console.group('[NLP-v4] 🤖 AI FALLBACK TRACE');
                        console.log('%c⚡ TRIGGER', 'color: #8b5cf6; font-weight: bold', {
                            reason: previousCategory === 'Others' ? 'Category was Others' : `Low confidence (${result.confidence})`,
                            inputPreview: rawInput.substring(0, 60) + '...'
                        });
                        console.log('%c🧠 AI ANALYSIS', 'color: #6366f1; font-weight: bold', {
                            selectedCategory: aiResult.category,
                            similarity: aiResult.similarity.toFixed(4),
                            threshold: AI_SIMILARITY_THRESHOLD,
                            topCategories: Object.entries(aiResult.allSimilarities || {})
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 3)
                                .map(([cat, sim]) => `${cat}: ${sim.toFixed(3)}`)
                        });
                        console.log('%c✅ OVERRIDE APPLIED', 'color: #10b981; font-weight: bold', {
                            from: previousCategory,
                            to: aiResult.category,
                            newUrgency: result.urgencyScore,
                            aiTime: `${aiTime.toFixed(1)}ms`
                        });
                        console.groupEnd();
                    } else {
                        console.log(`[NLP-PROCESSOR] 🤖 AI Override: "${previousCategory}" → "${aiResult.category}" (similarity: ${aiResult.similarity.toFixed(3)})`);
                    }
                } else if (aiResult) {
                    // AI ran but didn't meet threshold
                    result.processingLog.push(`🤖 AI considered but rejected: ${aiResult.category} (similarity: ${aiResult.similarity.toFixed(3)} < ${AI_SIMILARITY_THRESHOLD})`);
                    result.aiResult = aiResult;

                    if (debugModeEnabled) {
                        console.log(`[NLP-v4] 🤖 AI ran but rejected: ${aiResult.category} (sim: ${aiResult.similarity.toFixed(3)} < threshold ${AI_SIMILARITY_THRESHOLD})`);
                    }
                }
            } catch (error) {
                console.error('[NLP-PROCESSOR] AI fallback error:', error);
                result.processingLog.push(`🤖 AI fallback error: ${error.message}`);
            }
        }

        // Clean up internal flags
        delete result._needsAIFallback;
        delete result._aiInput;

        // Update processing time
        const totalTime = performance.now() - asyncStartTime;
        result.processingTimeMs = Math.round(totalTime * 100) / 100;

        // v4.1: Update total metrics
        lastProcessingMetrics.totalTime = result.processingTimeMs;

        return result;
    }

    /**
     * Batch analyze multiple texts
     */
    function analyzeTextBatch(texts, dictionary) {
        if (!Array.isArray(texts)) return [];
        buildKeywordIndex(dictionary);
        return texts.map(text => analyzeText(text, dictionary));
    }

    /**
     * Async batch analyze with AI fallback
     */
    async function analyzeTextBatchAsync(texts, dictionary) {
        if (!Array.isArray(texts)) return [];
        buildKeywordIndex(dictionary);
        return Promise.all(texts.map(text => analyzeTextAsync(text, dictionary)));
    }

    /**
     * Get urgency rating for a category
     */
    function getUrgencyRating(category) {
        return CATEGORY_URGENCY_RATINGS[category] ||
            NLP_KEYWORDS[category]?.urgency || 30;
    }

    /**
     * Check if a category is life-threatening (TIER 1)
     */
    function isLifeThreatening(category) {
        return (CATEGORY_URGENCY_RATINGS[category] || 0) >= 90;
    }

    /**
     * Get all categories in a specific urgency tier
     */
    function getCategoriesByUrgencyTier(minUrgency, maxUrgency) {
        return Object.entries(CATEGORY_URGENCY_RATINGS)
            .filter(([_, urgency]) => urgency >= minUrgency && urgency <= maxUrgency)
            .map(([category]) => category);
    }

    /**
     * Get AI status
     */
    function getAIStatus() {
        return {
            ready: tfReady,
            modelLoaded: !!useModel,
            anchorsComputed: !!anchorEmbeddings,
            error: aiLoadError?.message || null
        };
    }

    // ==================== MODULE EXPORT ====================

    const NLPProcessor = {
        // Main analysis functions
        analyzeText,
        analyzeTextAsync,  // v4.0: Async with AI fallback
        analyzeTextBatch,
        analyzeTextBatchAsync,  // v4.0: Async batch

        // AI functions
        initAIFallback,
        classifyWithAI,
        getAIStatus,

        // Utility functions
        tokenizeForNLP,
        tokenizeWithClauses,  // v4.0: Clause-aware tokenization
        buildKeywordIndex,
        clearKeywordCache,
        hasNegationNearby,
        hasIntensifierNearby,
        hasUncertaintyNearby,

        // v4.0: Clause-based detection
        hasNegationInClause,
        hasIntensifierInClause,
        hasUncertaintyInClause,

        // Category utilities
        getParentCategory,
        getUrgencyRating,
        isLifeThreatening,
        getCategoriesByUrgencyTier,

        // v4.1: Debug/Thesis Mode
        setDebugMode,
        getDebugStatus,

        // Configuration (read-only)
        config: Object.freeze({
            CATEGORY_URGENCY_RATINGS: Object.freeze({ ...CATEGORY_URGENCY_RATINGS }),
            CATEGORY_HIERARCHY: Object.freeze({ ...CATEGORY_HIERARCHY }),
            NLP_KEYWORDS: Object.freeze({ ...NLP_KEYWORDS }),  // v4.0
            CATEGORY_ANCHORS: Object.freeze({ ...CATEGORY_ANCHORS }),  // v4.0
            INTENSIFIER_WORDS: Object.freeze([...INTENSIFIER_WORDS]),
            NEGATION_WORDS: Object.freeze([...NEGATION_WORDS]),
            UNCERTAINTY_WORDS: Object.freeze([...UNCERTAINTY_WORDS]),
            CONTEXT_WINDOW,
            INTENSIFIER_MULTIPLIER,
            MAX_URGENCY_SCORE,
            AI_CONFIDENCE_THRESHOLD,  // v4.0
            AI_SIMILARITY_THRESHOLD,  // v4.0
            MULTI_LABEL_URGENCY_THRESHOLD  // v4.0
        }),

        // Version info
        version: '4.1.0',
        name: 'NLPProcessor',
        architecture: 'Hybrid Edge-AI'
    };

    // Export for different module systems
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = NLPProcessor;
    }

    if (typeof define === 'function' && define.amd) {
        define([], function () { return NLPProcessor; });
    }

    // Browser global
    global.NLPProcessor = NLPProcessor;

    // Backward compatibility exports
    global.analyzeText = analyzeText;
    global.analyzeTextAsync = analyzeTextAsync;
    global.tokenizeForNLP = tokenizeForNLP;
    global.buildKeywordIndex = buildKeywordIndex;
    global.getParentCategory = getParentCategory;
    global.hasNegationNearby = function (tokens, idx) {
        return hasNegationNearby(tokens, idx).found;
    };
    global.hasIntensifierNearby = function (tokens, idx) {
        return hasIntensifierNearby(tokens, idx).found;
    };
    global.CATEGORY_URGENCY_RATINGS = CATEGORY_URGENCY_RATINGS;
    global.CATEGORY_HIERARCHY = CATEGORY_HIERARCHY;
    global.NLP_KEYWORDS = NLP_KEYWORDS;  // v4.0
    global.CATEGORY_ANCHORS = CATEGORY_ANCHORS;  // v4.0
    global.INTENSIFIER_WORDS = INTENSIFIER_WORDS;
    global.NEGATION_WORDS = NEGATION_WORDS;
    global.INTENSIFIER_MULTIPLIER = INTENSIFIER_MULTIPLIER;

    // v4.1: Debug Mode exports
    global.setDebugMode = setDebugMode;
    global.getDebugStatus = getDebugStatus;

    // v4.0: Auto-initialize AI in background (non-blocking)
    if (typeof window !== 'undefined') {
        // Wait for page load, then init AI in background
        if (document.readyState === 'complete') {
            setTimeout(() => initAIFallback(), 1000);
        } else {
            window.addEventListener('load', () => {
                setTimeout(() => initAIFallback(), 1000);
            });
        }
    }

    console.log('╔════════════════════════════════════════════════════════════════════╗');
    console.log('║  🧠 NLP PROCESSOR v4.1 - HYBRID EDGE-AI ARCHITECTURE               ║');
    console.log('╠════════════════════════════════════════════════════════════════════╣');
    console.log('║  ✅ Rule-based engine loaded (immediate)                           ║');
    console.log('║  ✅ Expanded dictionaries: Utilities, Sanitation, Infrastructure   ║');
    console.log('║  ✅ Clause-based context analysis enabled                          ║');
    console.log('║  ✅ Multi-label detection enabled (urgency > 50)                   ║');
    console.log('║  ✅ Debug/Thesis mode available: setDebugMode(true)                ║');
    console.log('║  ⏳ TensorFlow.js + USE loading in background (IndexedDB cached)...║');
    console.log('╚════════════════════════════════════════════════════════════════════╝');

})(typeof window !== 'undefined' ? window : global);
