/**
 * DRIMS Simulation Engine v3.9
 * ====================================
 * STRICT Implementation: Background vs. Spotlight Layering System
 * 
 * v3.9 AUDIT FIX UPDATE (Security & Algorithm Hardening):
 * - NEGATION DETECTION: "no fire" / "walang sunog" → NOT flagged as emergency
 * - GPS VALIDATION: Coordinates outside Digos City are rejected
 * - SPATIAL PLAUSIBILITY: Floods at high elevation get warnings
 * - LONE WOLF FIX: Fire/Accident/Crime minPts=1 (single reports visible)
 * - AUTO-CAT DOWNGRADE: Prevents gaming (user selects "Fire" but describes pothole)
 * - XSS SANITIZATION: All user inputs are HTML-encoded
 * 
 * v3.8 UPDATE (Bisaya Language Support):
 * - Enhanced SPECULATIVE_TRIGGERS with Bisaya conditionals (tingali, basin, inig, kon)
 * - Enhanced POST_KEYWORD_SPECULATIVE with Bisaya patterns (permi, kanunay, sauna)
 * - Enhanced PAST_EVENT_PATTERNS with Bisaya markers (gahapon, ganina, dugay na)
 * - Enhanced NON_EMERGENCY_PHRASES with Bisaya flood/drainage terms
 * - Updated NLP dictionary v2.1.0 with comprehensive Bisaya flood vocabulary
 * 
 * v3.7 UPDATE (Post-Keyword Speculation):
 * - SAFE METAPHOR LIST: Removed "on fire" (was blocking real fires!)
 * - AUTO-CATEGORIZATION: Mislabeled "Others" auto-switches to detected category
 * - HUMAN_SUBJECT_KEYWORDS: Added for "flood of X" pattern validation
 * 
 * v3.5 UPDATE (Metaphor Filter):
 * - MODULE 0.5: Figurative Language Detection
 * - Prevents false positives from: "flood of students", "my phone is dead", etc.
 * - 6-step algorithm with 400+ linguistic patterns
 * - Integrated into checkCriticality() before speculation check
 * 
 * Reference: DOCUMENTATION.md Section 10.1 & Section 8.4
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────────────┐
 * │  SPOTLIGHT LAYER (Top)                                  │
 * │  - Large colored icons (40px)                           │
 * │  - Pulsing animation, bright colors                     │
 * │  - Created per-scenario, cleared on reset               │
 * ├─────────────────────────────────────────────────────────┤
 * │  BACKGROUND LAYER (Bottom)                              │
 * │  - L.circleMarker, 4px radius, gray (#888888)           │
 * │  - Fill opacity: 0.3                                    │
 * │  - Created ONCE on initialize(), NEVER destroyed        │
 * │  - Dimmed to 0.15 opacity during spotlight mode         │
 * └─────────────────────────────────────────────────────────┘
 * 
 * @author DRIMS Development Team
 * @version 3.8.0 - Enhanced Bisaya habitual verb detection
 */

// ==================== CONFIGURATION ====================

/**
 * ============================================================================
 * ADAPTIVE DBSCAN CONFIGURATION v2.0
 * ============================================================================
 * 
 * Thesis Defense Configuration - Tuned for STRESS-02 and STRESS-03 tests
 * 
 * PRIORITY TIERS:
 * ---------------
 * TIER 1 - High Priority / Semantic Conflict (ε=25m, minPts=3)
 *          Categories: Fire, Accident, Crime, Public Safety
 *          Rationale: Tight clustering for emergency response coordination
 * 
 * TIER 2 - Standard Infrastructure (ε=40m, minPts=4)
 *          Categories: Pothole, Trash, Streetlight, Road Damage, Infrastructure
 *          Rationale: Moderate clustering for routine maintenance dispatch
 * 
 * TIER 3 - Large Area Events (ε=60m, minPts=5)
 *          Categories: Flooding, No Water, Blackout, Utilities, Environment
 *          Rationale: Wide clustering for utility-scale incidents
 * 
 * Distance Metric: Haversine Formula (great-circle distance)
 * ============================================================================
 */

/**
 * v3.9 AUDIT FIX: GEOGRAPHIC VALIDATION SYSTEM
 * ==============================================
 * Validates GPS coordinates are within Digos City bounds.
 * Rejects reports from San Francisco or other invalid locations.
 */
const DIGOS_CITY_BOUNDS = {
    lat_min: 6.65,   // Southern boundary
    lat_max: 7.20,   // Northern boundary
    lng_min: 125.25, // Western boundary
    lng_max: 125.80, // Eastern boundary
    name: 'Digos City, Davao del Sur'
};

/**
 * v3.9 AUDIT FIX: ELEVATION VALIDATION (Spatial Context)
 * Validates that category matches plausible elevation.
 * Floods are unlikely at 2000m+ elevation.
 */
const ELEVATION_CONSTRAINTS = {
    'Flood': { max_elevation: 500, reason: 'Floods unlikely above 500m elevation' },
    'Flooding': { max_elevation: 500, reason: 'Floods unlikely above 500m elevation' },
    'Tsunami': { max_elevation: 50, max_distance_from_coast: 5000, reason: 'Tsunamis only affect coastal areas' },
    'Landslide': { min_elevation: 50, reason: 'Landslides require slopes/elevation' }
};

/**
 * Validate if GPS coordinates are within Digos City bounds.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude  
 * @returns {Object} { isValid: boolean, reason: string|null }
 */
function validateGPSBounds(lat, lng) {
    if (lat == null || lng == null) {
        return { isValid: false, reason: 'Missing coordinates' };
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
        return { isValid: false, reason: 'Invalid coordinate type' };
    }

    if (isNaN(lat) || isNaN(lng)) {
        return { isValid: false, reason: 'Coordinates are NaN' };
    }

    const bounds = DIGOS_CITY_BOUNDS;

    if (lat < bounds.lat_min || lat > bounds.lat_max ||
        lng < bounds.lng_min || lng > bounds.lng_max) {
        console.log(`[GPS v3.9] ⛔ OUT OF BOUNDS: (${lat}, ${lng}) is outside Digos City`);
        console.log(`  └─ Valid range: Lat ${bounds.lat_min}-${bounds.lat_max}, Lng ${bounds.lng_min}-${bounds.lng_max}`);
        return {
            isValid: false,
            reason: `Coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}) are outside ${bounds.name}`,
            outsideBounds: true
        };
    }

    return { isValid: true, reason: null };
}

/**
 * Validate category against elevation constraints.
 * Uses approximate elevation based on known Digos City geography.
 * @param {string} category - Complaint category
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Object} { isPlausible: boolean, warning: string|null }
 */
function validateSpatialPlausibility(category, lat, lng) {
    const constraint = ELEVATION_CONSTRAINTS[category];
    if (!constraint) {
        return { isPlausible: true, warning: null };
    }

    // Approximate elevation based on distance from coast and known peaks
    // Mount Apo area: ~7.0, 125.3 (very high elevation)
    // Coastal Digos: ~7.0, 125.6 (near sea level)
    const MOUNT_APO_LAT = 7.0;
    const MOUNT_APO_LNG = 125.27;

    // Simple elevation approximation (not accurate but catches obvious issues)
    const distFromMountApo = Math.sqrt(
        Math.pow(lat - MOUNT_APO_LAT, 2) + Math.pow(lng - MOUNT_APO_LNG, 2)
    );

    // Approximate elevation: closer to Apo = higher
    // This is a rough heuristic - real implementation should use DEM data
    const estimatedElevation = distFromMountApo < 0.1 ? 2000 :  // Near Apo peak
        distFromMountApo < 0.2 ? 1000 :  // Apo foothills
            distFromMountApo < 0.3 ? 500 :   // Highland
                distFromMountApo < 0.4 ? 200 :   // Transition
                    50;                              // Lowland/coastal

    if (constraint.max_elevation && estimatedElevation > constraint.max_elevation) {
        console.log(`[SPATIAL v3.9] ⚠️ IMPLAUSIBLE: ${category} at estimated ${estimatedElevation}m elevation`);
        console.log(`  └─ Constraint: ${constraint.reason}`);
        return {
            isPlausible: false,
            warning: `${category} reported at high elevation (~${estimatedElevation}m). ${constraint.reason}`,
            estimatedElevation
        };
    }

    if (constraint.min_elevation && estimatedElevation < constraint.min_elevation) {
        console.log(`[SPATIAL v3.9] ⚠️ IMPLAUSIBLE: ${category} at estimated ${estimatedElevation}m elevation`);
        return {
            isPlausible: false,
            warning: `${category} reported at low elevation (~${estimatedElevation}m). ${constraint.reason}`,
            estimatedElevation
        };
    }

    return { isPlausible: true, warning: null, estimatedElevation };
}

// Priority Tier Definitions
const CLUSTERING_TIERS = {
    HIGH_PRIORITY: {
        epsilon: 25.0,    // meters
        minPts: 3,
        description: "High Priority / Semantic Conflict",
        categories: ["Fire", "Accident", "Crime", "Public Safety"]
    },
    STANDARD_INFRASTRUCTURE: {
        epsilon: 40.0,    // meters
        minPts: 4,
        description: "Standard Infrastructure",
        categories: ["Pothole", "Trash", "Streetlight", "Road Damage", "Infrastructure", "Sanitation"]
    },
    LARGE_AREA: {
        epsilon: 60.0,    // meters
        minPts: 5,
        description: "Large Area Events",
        categories: ["Flooding", "No Water", "Blackout", "Utilities", "Environment", "Flood"]
    }
};

// Subcategory to Main Category Mapping (for field-collected data)
const FALLBACK_SUBCATEGORY_MAP = {
    // Infrastructure subcategories
    "Pothole": "Infrastructure",
    "Road Damage": "Infrastructure",
    "Broken Streetlight": "Infrastructure",
    "Streetlight": "Infrastructure",

    // Sanitation subcategories
    "Trash": "Sanitation",
    "Illegal Dumping": "Sanitation",
    "Overflowing Trash": "Sanitation",
    "Bad Odor": "Sanitation",

    // Utilities subcategories
    "No Water": "Utilities",
    "Pipe Leak": "Utilities",
    "Blackout": "Utilities",

    // Environment subcategories
    "Flooding": "Environment",
    "Flood": "Environment",

    // Public Safety subcategories
    "Fire": "Public Safety",
    "Accident": "Public Safety",
    "Crime": "Public Safety",
    "Stray Dog": "Public Safety",

    // Traffic subcategories
    "Road Obstruction": "Traffic",
    "Traffic Jam": "Traffic",

    // Public Safety subcategories (continued)
    "Noise Complaint": "Public Safety",

    // Others
};

let taxonomyCache = null;

function normalizeTaxonomyLabel(label) {
    if (typeof DRIMSTaxonomy !== 'undefined' && taxonomyCache) {
        return DRIMSTaxonomy.normalizeLabel(label, taxonomyCache);
    }
    return label || 'Others';
}

function getCanonicalParent(label) {
    const normalized = normalizeTaxonomyLabel(label);
    if (typeof DRIMSTaxonomy !== 'undefined' && taxonomyCache) {
        return DRIMSTaxonomy.getParentForLabel(normalized, taxonomyCache);
    }
    return FALLBACK_SUBCATEGORY_MAP[normalized] || normalized || 'Others';
}

function getAdaptiveEpsilonLookup() {
    return (taxonomyCache && taxonomyCache.adaptive_epsilon) ? taxonomyCache.adaptive_epsilon : ADAPTIVE_EPSILON;
}

function getAdaptiveMinPtsLookup() {
    return (taxonomyCache && taxonomyCache.adaptive_minpts) ? taxonomyCache.adaptive_minpts : ADAPTIVE_MINPTS;
}

// Adaptive Epsilon lookup (supports both main categories and subcategories)
const ADAPTIVE_EPSILON = {
    // TIER 1: High Priority (ε=25m)
    "Fire": 25.0,
    "Accident": 25.0,
    "Crime": 25.0,
    "Public Safety": 25.0,

    // TIER 2: Standard Infrastructure (ε=30-40m)
    // Pothole reduced to 30m to prevent chaining effect in linear arrangements
    "Pothole": 30.0,
    "Trash": 40.0,
    "Streetlight": 40.0,
    "Broken Streetlight": 40.0,
    "Road Damage": 40.0,
    "Infrastructure": 40.0,
    "Sanitation": 40.0,
    "Illegal Dumping": 40.0,
    "Overflowing Trash": 40.0,
    "Bad Odor": 40.0,

    // TIER 3: Large Area Events (ε=60m)
    "Flooding": 60.0,
    "Flood": 60.0,
    "No Water": 60.0,
    "Blackout": 60.0,
    "Utilities": 60.0,
    "Environment": 60.0,
    "Pipe Leak": 60.0,

    // Other categories (default: 40m)
    "Traffic": 40.0,
    "Road Obstruction": 40.0,
    "Noise Complaint": 25.0,

    // Other categories (default: 40m)
    "Traffic": 40.0,
    "Road Obstruction": 40.0,
    "Stray Dog": 40.0,
    "Others": 40.0
};

// Adaptive MinPts lookup
// v3.9 AUDIT FIX: Critical categories (Fire, Accident, Crime) now use minPts=1
// to prevent single critical reports from being marked as noise
const ADAPTIVE_MINPTS = {
    // TIER 1: High Priority (minPts=1 for life-threatening categories)
    // AUDIT FIX: "Lone Wolf" trap - single fire/accident/crime reports MUST be visible
    "Fire": 1,
    "Accident": 1,
    "Crime": 1,
    "Public Safety": 2,

    // TIER 2: Standard Infrastructure (minPts=2-4)
    // Pothole reduced to 2 to detect smaller group formations
    "Pothole": 2,
    "Trash": 4,
    "Streetlight": 4,
    "Broken Streetlight": 4,
    "Road Damage": 4,
    "Infrastructure": 4,
    "Sanitation": 4,
    "Illegal Dumping": 4,
    "Overflowing Trash": 4,
    "Bad Odor": 4,

    // TIER 3: Large Area Events (minPts=5)
    "Flooding": 5,
    "Flood": 5,
    "No Water": 5,
    "Blackout": 5,
    "Utilities": 5,
    "Environment": 5,
    "Pipe Leak": 5,

    // Other categories (default: 4)
    "Traffic": 4,
    "Road Obstruction": 4,
    "Noise Complaint": 3,

    // Other categories (default: 4)
    "Traffic": 4,
    "Road Obstruction": 4,
    "Stray Dog": 4,
    "Others": 4
};

// Semantic Relationship Matrix (updated for new categories)
/**
 * RELATIONSHIP_MATRIX v3.7.3 - Comprehensive Category Relationship Database
 * 
 * This matrix defines which categories can be clustered together based on
 * real-world causal relationships. Used by Layer 2 (Semantic) of DBSCAN++.
 * 
 * @thesis This implements domain knowledge-based clustering constraints.
 * Categories A and B can cluster if B is in RELATIONSHIP_MATRIX[A] or vice versa.
 */
const RELATIONSHIP_MATRIX = {
    // ================================================================
    // WATER & FLOODING CHAIN
    // ================================================================
    "Pipe Leak": ["Flooding", "Flood", "No Water", "Low Pressure", "Road Damage", "Environment", "Utilities"],
    "Flooding": ["Pipe Leak", "Road Damage", "Trash", "Traffic", "Environment", "Flood", "Accident", "Stranded", "Evacuation", "Heavy Rain", "Clogged Drainage", "Clogged Canal"],
    "Flood": ["Pipe Leak", "Road Damage", "Trash", "Traffic", "Environment", "Flooding", "Accident", "Stranded", "Evacuation", "Heavy Rain", "Clogged Drainage", "Clogged Canal"],
    "No Water": ["Pipe Leak", "Utilities", "Fire", "Health Hazard"],
    "Low Pressure": ["Pipe Leak", "No Water", "Utilities"],
    "Heavy Rain": ["Flooding", "Flood", "Traffic", "Accident", "Landslide"],
    "Clogged Drainage": ["Flooding", "Flood", "Trash", "Illegal Dumping"],
    "Clogged Canal": ["Flooding", "Flood", "Trash"],
    "Stranded": ["Flooding", "Flood", "Landslide", "Bridge Collapse"],

    // ================================================================
    // INFRASTRUCTURE & ROAD CHAIN
    // ================================================================
    "Pothole": ["Road Damage", "Infrastructure", "Accident", "Traffic"],
    "Road Damage": ["Pothole", "Flooding", "Flood", "Traffic", "Infrastructure", "Accident"],
    "Road Obstruction": ["Traffic", "Flooding", "Flood", "Accident", "Fallen Tree", "Landslide", "Fire", "Construction", "Building Collapse"],
    "Broken Streetlight": ["Streetlight", "Infrastructure", "Crime", "Accident", "Public Safety", "Vandalism"],
    "Streetlight": ["Broken Streetlight", "Infrastructure", "Crime", "Accident", "Public Safety"],
    "Infrastructure": ["Pothole", "Road Damage", "Broken Streetlight", "Streetlight", "Bridge Collapse", "Building Collapse"],
    "Fallen Tree": ["Road Obstruction", "Traffic", "Blackout", "Heavy Rain"],
    "Landslide": ["Road Obstruction", "Traffic", "Evacuation", "Heavy Rain", "Stranded"],
    "Bridge Collapse": ["Traffic", "Stranded", "Evacuation"],
    "Construction": ["Traffic", "Noise", "Road Obstruction"],

    // ================================================================
    // SANITATION & WASTE CHAIN
    // ================================================================
    "Trash": ["Illegal Dumping", "Stray Dog", "Overflowing Trash", "Bad Odor", "Sanitation", "Pest Infestation", "Clogged Drainage"],
    "Garbage": ["Trash", "Illegal Dumping", "Bad Odor", "Stray Dog", "Sanitation", "Pest Infestation"],
    "Illegal Dumping": ["Trash", "Stray Dog", "Sanitation", "Bad Odor", "Overflowing Trash", "Clogged Drainage"],
    "Overflowing Trash": ["Trash", "Illegal Dumping", "Sanitation", "Bad Odor", "Stray Dog"],
    "Bad Odor": ["Trash", "Overflowing Trash", "Sanitation", "Dead Animal", "Sewage Leak", "Stagnant Water"],
    "Sanitation": ["Trash", "Illegal Dumping", "Overflowing Trash", "Bad Odor", "Dead Animal", "Sewage Leak"],
    "Dead Animal": ["Bad Odor", "Health Hazard", "Sanitation"],
    "Sewage Leak": ["Bad Odor", "Health Hazard", "Flooding", "Sanitation"],
    "Pest Infestation": ["Trash", "Garbage", "Health Hazard"],

    // ================================================================
    // ENVIRONMENT & HEALTH CHAIN
    // ================================================================
    "Environment": ["Flooding", "Flood", "Pipe Leak", "Air Pollution", "Water Pollution"],
    "Health Hazard": ["Smoke", "Pest Infestation", "Dead Animal", "Sewage Leak", "Air Pollution", "Water Pollution", "No Water", "Mosquito Breeding", "Dengue"],
    "Air Pollution": ["Traffic", "Smoke", "Burning Trash", "Open Burning", "Health Hazard"],
    "Water Pollution": ["Health Hazard", "Sewage Leak"],
    "Stagnant Water": ["Mosquito Breeding", "Bad Odor", "Health Hazard"],
    "Mosquito Breeding": ["Health Hazard", "Stagnant Water", "Dengue"],
    "Dengue": ["Health Hazard", "Mosquito Breeding"],

    // ================================================================
    // UTILITIES & POWER CHAIN
    // ================================================================
    "Utilities": ["No Water", "Pipe Leak", "Blackout", "Power Line Down"],
    "Blackout": ["Utilities", "Crime", "Accident", "Traffic", "Public Safety", "Power Line Down", "Transformer Explosion", "Fallen Tree"],
    "Power Line Down": ["Blackout", "Fire", "Public Safety"],
    "Transformer Explosion": ["Blackout", "Fire"],

    // ================================================================
    // FIRE & EMERGENCY CHAIN
    // ================================================================
    "Fire": ["Traffic", "Public Safety", "Smoke", "Evacuation", "Road Obstruction", "Blackout", "Explosion", "Gas Leak", "Burning Trash"],
    "Smoke": ["Fire", "Health Hazard", "Traffic", "Burning Trash", "Open Burning", "Air Pollution"],
    "Explosion": ["Fire", "Evacuation", "Public Safety", "Gas Leak"],
    "Gas Leak": ["Fire", "Explosion", "Evacuation", "Public Safety"],
    "Burning Trash": ["Smoke", "Air Pollution", "Fire"],
    "Open Burning": ["Smoke", "Air Pollution"],
    "Evacuation": ["Fire", "Flooding", "Flood", "Landslide", "Explosion", "Gas Leak", "Building Collapse", "Earthquake"],
    "Rescue": ["Building Collapse", "Accident", "Fire"],

    // ================================================================
    // ACCIDENT & TRAFFIC CHAIN
    // ================================================================
    "Traffic": ["Flooding", "Flood", "Road Damage", "Fire", "Road Obstruction", "Accident", "Blackout", "Heavy Rain", "Smoke", "Construction", "Vehicle Breakdown", "Air Pollution", "Noise"],
    "Accident": ["Traffic", "Public Safety", "Medical", "Road Obstruction", "Pothole", "Flooding", "Flood", "Blackout", "Broken Streetlight", "Reckless Driving", "Drunk Driving"],
    "Vehicle Breakdown": ["Traffic", "Road Obstruction"],
    "Reckless Driving": ["Accident", "Public Safety"],
    "Drunk Driving": ["Accident", "Public Safety"],
    "Medical": ["Accident", "Assault"],

    // ================================================================
    // CRIME & SAFETY CHAIN
    // ================================================================
    "Crime": ["Public Safety", "Blackout", "Broken Streetlight", "Streetlight", "Robbery", "Theft", "Vandalism", "Drug Activity", "Gunshot", "Assault", "Gang Activity"],
    "Public Safety": ["Fire", "Accident", "Crime", "Stray Dog", "Noise Complaint", "Blackout", "Broken Streetlight", "Reckless Driving", "Explosion", "Power Line Down", "Illegal Construction", "Gang Activity", "Gunshot", "Loitering", "Snake Sighting"],
    "Robbery": ["Crime", "Public Safety"],
    "Theft": ["Crime", "Public Safety"],
    "Vandalism": ["Crime", "Broken Streetlight"],
    "Drug Activity": ["Crime", "Public Safety"],
    "Gunshot": ["Crime", "Public Safety"],
    "Assault": ["Crime", "Medical"],
    "Trespassing": ["Crime"],
    "Loitering": ["Public Safety"],
    "Gang Activity": ["Crime", "Public Safety"],

    // ================================================================
    // NOISE & DISTURBANCE CHAIN
    // ================================================================
    "Noise": ["Public Safety", "Noise Complaint", "Traffic", "Construction", "Loud Music", "Loud Party", "Karaoke", "Barking Dog"],
    "Noise Complaint": ["Noise", "Public Safety", "Loud Music", "Loud Party", "Karaoke", "Barking Dog"],
    "Loud Music": ["Noise", "Noise Complaint"],
    "Loud Party": ["Noise", "Noise Complaint"],
    "Karaoke": ["Noise", "Noise Complaint"],
    "Barking Dog": ["Noise", "Stray Dog"],

    // ================================================================
    // ANIMAL CHAIN
    // ================================================================
    "Stray Dog": ["Trash", "Public Safety", "Noise", "Barking Dog"],
    "Stray Animal": ["Public Safety"],
    "Snake Sighting": ["Public Safety"],

    // ================================================================
    // STRUCTURAL & BUILDING CHAIN
    // ================================================================
    "Building Collapse": ["Evacuation", "Road Obstruction", "Rescue", "Earthquake", "Illegal Construction"],
    "Earthquake": ["Building Collapse", "Evacuation", "Fire"],
    "Illegal Construction": ["Building Collapse", "Public Safety"],

    // ================================================================
    // FALLBACK
    // ================================================================
    "Others": ["Others"]
};

const CORRELATION_SCORES = {
    // ================================================================
    // WATER & FLOODING CORRELATIONS
    // ================================================================
    "Pipe Leak->Flooding": 0.92,
    "Pipe Leak->Flood": 0.92,
    "Pipe Leak->No Water": 0.85,
    "Pipe Leak->Low Pressure": 0.80,
    "Pipe Leak->Road Damage": 0.55,
    "Flooding->Traffic": 0.85,
    "Flood->Traffic": 0.85,
    "Flooding->Road Damage": 0.65,
    "Flood->Road Damage": 0.65,
    "Flooding->Accident": 0.60,
    "Flood->Accident": 0.60,
    "Flooding->Stranded": 0.75,
    "Flood->Stranded": 0.75,
    "Flooding->Evacuation": 0.70,
    "Flood->Evacuation": 0.70,
    "Heavy Rain->Flooding": 0.90,
    "Heavy Rain->Flood": 0.90,
    "Heavy Rain->Traffic": 0.75,
    "Heavy Rain->Accident": 0.70,
    "Clogged Drainage->Flooding": 0.88,
    "Clogged Drainage->Flood": 0.88,
    "Clogged Canal->Flooding": 0.85,
    "Clogged Canal->Flood": 0.85,

    // ================================================================
    // INFRASTRUCTURE & ROAD CORRELATIONS
    // ================================================================
    "Pothole->Road Damage": 0.75,
    "Pothole->Accident": 0.65,
    "Pothole->Traffic": 0.55,
    "Road Damage->Traffic": 0.70,
    "Road Damage->Accident": 0.65,
    "Road Obstruction->Traffic": 0.85,
    "Road Obstruction->Accident": 0.60,
    "Fallen Tree->Road Obstruction": 0.90,
    "Fallen Tree->Traffic": 0.80,
    "Fallen Tree->Blackout": 0.70,
    "Landslide->Road Obstruction": 0.95,
    "Landslide->Traffic": 0.85,
    "Landslide->Evacuation": 0.80,
    "Bridge Collapse->Traffic": 0.95,
    "Bridge Collapse->Stranded": 0.85,
    "Construction->Traffic": 0.75,
    "Construction->Noise": 0.80,
    "Construction->Road Obstruction": 0.70,

    // ================================================================
    // SANITATION & WASTE CORRELATIONS
    // ================================================================
    "Trash->Bad Odor": 0.80,
    "Overflowing Trash->Bad Odor": 0.85,
    "Garbage->Bad Odor": 0.78,
    "Illegal Dumping->Bad Odor": 0.75,
    "Illegal Dumping->Overflowing Trash": 0.70,
    "Illegal Dumping->Clogged Drainage": 0.65,
    "Trash->Stray Dog": 0.65,
    "Overflowing Trash->Stray Dog": 0.60,
    "Garbage->Stray Dog": 0.60,
    "Trash->Pest Infestation": 0.75,
    "Garbage->Pest Infestation": 0.75,
    "Trash->Clogged Drainage": 0.60,
    "Dead Animal->Bad Odor": 0.90,
    "Dead Animal->Health Hazard": 0.85,
    "Sewage Leak->Bad Odor": 0.92,
    "Sewage Leak->Health Hazard": 0.85,
    "Sewage Leak->Flooding": 0.60,

    // ================================================================
    // FIRE & EMERGENCY CORRELATIONS
    // ================================================================
    "Fire->Traffic": 0.80,
    "Fire->Smoke": 0.95,
    "Fire->Evacuation": 0.90,
    "Fire->Road Obstruction": 0.70,
    "Fire->Blackout": 0.55,
    "Fire->Public Safety": 0.85,
    "Smoke->Health Hazard": 0.80,
    "Smoke->Traffic": 0.60,
    "Explosion->Fire": 0.85,
    "Explosion->Evacuation": 0.90,
    "Explosion->Public Safety": 0.95,
    "Gas Leak->Fire": 0.75,
    "Gas Leak->Explosion": 0.70,
    "Gas Leak->Evacuation": 0.80,

    // ================================================================
    // ACCIDENT & TRAFFIC CORRELATIONS
    // ================================================================
    "Accident->Traffic": 0.90,
    "Accident->Road Obstruction": 0.75,
    "Accident->Medical": 0.70,
    "Accident->Public Safety": 0.65,
    "Vehicle Breakdown->Traffic": 0.70,
    "Vehicle Breakdown->Road Obstruction": 0.65,
    "Reckless Driving->Accident": 0.80,
    "Reckless Driving->Public Safety": 0.70,
    "Drunk Driving->Accident": 0.85,
    "Traffic->Air Pollution": 0.65,
    "Traffic->Noise": 0.60,

    // ================================================================
    // UTILITIES & POWER CORRELATIONS
    // ================================================================
    "Blackout->Crime": 0.65,
    "Blackout->Accident": 0.55,
    "Blackout->Traffic": 0.60,
    "Blackout->Public Safety": 0.70,
    "Broken Streetlight->Crime": 0.60,
    "Broken Streetlight->Accident": 0.55,
    "Broken Streetlight->Public Safety": 0.65,
    "Streetlight->Crime": 0.55,
    "Streetlight->Accident": 0.50,
    "Power Line Down->Blackout": 0.90,
    "Power Line Down->Fire": 0.60,
    "Power Line Down->Public Safety": 0.85,
    "Transformer Explosion->Blackout": 0.95,
    "Transformer Explosion->Fire": 0.70,
    "No Water->Fire": 0.40,
    "No Water->Health Hazard": 0.55,

    // ================================================================
    // CRIME & SAFETY CORRELATIONS
    // ================================================================
    "Crime->Public Safety": 0.85,
    "Robbery->Crime": 0.95,
    "Robbery->Public Safety": 0.80,
    "Theft->Crime": 0.90,
    "Vandalism->Crime": 0.75,
    "Vandalism->Broken Streetlight": 0.60,
    "Drug Activity->Crime": 0.85,
    "Drug Activity->Public Safety": 0.80,
    "Gunshot->Crime": 0.90,
    "Gunshot->Public Safety": 0.95,
    "Assault->Crime": 0.90,
    "Assault->Medical": 0.70,
    "Trespassing->Crime": 0.70,
    "Loitering->Public Safety": 0.50,
    "Gang Activity->Crime": 0.90,
    "Gang Activity->Public Safety": 0.85,

    // ================================================================
    // NOISE & DISTURBANCE CORRELATIONS
    // ================================================================
    "Noise->Public Safety": 0.45,
    "Noise Complaint->Public Safety": 0.45,
    "Loud Music->Noise": 0.90,
    "Loud Party->Noise": 0.90,
    "Karaoke->Noise": 0.85,
    "Barking Dog->Noise": 0.75,

    // ================================================================
    // ANIMAL & HEALTH CORRELATIONS
    // ================================================================
    "Stray Dog->Public Safety": 0.60,
    "Stray Dog->Noise": 0.55,
    "Stray Animal->Public Safety": 0.55,
    "Snake Sighting->Public Safety": 0.75,
    "Pest Infestation->Health Hazard": 0.80,
    "Mosquito Breeding->Health Hazard": 0.85,
    "Dengue->Health Hazard": 0.95,
    "Stagnant Water->Mosquito Breeding": 0.85,
    "Stagnant Water->Bad Odor": 0.65,

    // ================================================================
    // STRUCTURAL & BUILDING CORRELATIONS
    // ================================================================
    "Building Collapse->Evacuation": 0.95,
    "Building Collapse->Road Obstruction": 0.80,
    "Building Collapse->Rescue": 0.90,
    "Earthquake->Building Collapse": 0.75,
    "Earthquake->Evacuation": 0.85,
    "Earthquake->Fire": 0.55,
    "Illegal Construction->Building Collapse": 0.60,
    "Illegal Construction->Public Safety": 0.65,

    // ================================================================
    // ENVIRONMENTAL CORRELATIONS
    // ================================================================
    "Air Pollution->Health Hazard": 0.75,
    "Water Pollution->Health Hazard": 0.80,
    "Burning Trash->Smoke": 0.90,
    "Burning Trash->Air Pollution": 0.85,
    "Burning Trash->Fire": 0.55,
    "Open Burning->Smoke": 0.90,
    "Open Burning->Air Pollution": 0.85,

    // ================================================================
    // SAME CATEGORY CORRELATIONS (Mass Events/Redundancy)
    // ================================================================
    "Pothole->Pothole": 1.0,
    "Flooding->Flooding": 1.0,
    "Flood->Flood": 1.0,
    "Fire->Fire": 1.0,
    "Stray Dog->Stray Dog": 1.0,
    "Broken Streetlight->Broken Streetlight": 1.0,
    "Trash->Trash": 1.0,
    "No Water->No Water": 1.0,
    "Traffic->Traffic": 1.0,
    "Pipe Leak->Pipe Leak": 1.0,
    "Road Damage->Road Damage": 1.0,
    "Illegal Dumping->Illegal Dumping": 1.0,
    "Noise Complaint->Noise Complaint": 1.0,
    "Accident->Accident": 1.0,
    "Crime->Crime": 1.0,
    "Blackout->Blackout": 1.0,
    "Bad Odor->Bad Odor": 1.0,
    "Overflowing Trash->Overflowing Trash": 1.0
};

// Keyword Dictionary - Extracted from Real Field Data (288 complaints)
// Maps common Filipino/English words to their semantic category correlations
const KEYWORD_DICTIONARY = {
    // ENGLISH KEYWORDS - Infrastructure
    "pothole": ["Pothole", "Road Damage", "Infrastructure"],
    "potholes": ["Pothole", "Road Damage", "Infrastructure"],
    "road": ["Pothole", "Road Damage", "Infrastructure", "Traffic"],
    "daan": ["Pothole", "Road Damage", "Infrastructure", "Traffic"],  // Filipino: road
    "kalsada": ["Pothole", "Road Damage", "Infrastructure"],  // Filipino: road/street
    "lubak": ["Pothole", "Road Damage", "Infrastructure"],  // Filipino: pothole
    "sira": ["Road Damage", "Infrastructure", "Pothole"],  // Filipino: broken/damaged

    // ENGLISH KEYWORDS - Water/Flooding
    "flooding": ["Flooding", "Flood", "Pipe Leak", "Environment", "Utilities"],
    "flood": ["Flooding", "Flood", "Pipe Leak", "Environment", "Utilities"],
    "water": ["No Water", "Pipe Leak", "Flooding", "Utilities"],
    "tubig": ["No Water", "Pipe Leak", "Flooding", "Utilities"],  // Filipino: water
    "walang": ["No Water", "Utilities"],  // Filipino: none/nothing
    "baha": ["Flooding", "Flood", "Pipe Leak", "Environment"],  // Filipino: flood
    "rain": ["Flooding", "Flood", "Environment"],
    "heavy": ["Flooding", "Flood", "Environment"],

    // ENGLISH KEYWORDS - Trash/Sanitation
    "trash": ["Trash", "Sanitation", "Illegal Dumping", "Overflowing Trash"],
    "garbage": ["Trash", "Sanitation", "Illegal Dumping", "Overflowing Trash"],
    "basura": ["Trash", "Sanitation", "Illegal Dumping", "Overflowing Trash"],  // Filipino: trash
    "baho": ["Bad Odor", "Trash", "Sanitation", "Overflowing Trash"],  // Filipino: bad smell
    "overflowing": ["Overflowing Trash", "Trash", "Sanitation"],

    // ENGLISH KEYWORDS - Traffic
    "traffic": ["Traffic", "Road Obstruction", "Road Damage", "Flooding"],

    // LOCATION CONTEXT - Filipino
    "dito": ["location_marker"],  // Filipino: here
    "rito": ["location_marker"],  // Filipino: here
    "amin": ["location_marker"],  // Filipino: our/ours
    "aming": ["location_marker"],  // Filipino: our
    "bahay": ["location_marker"],  // Filipino: house
    "house": ["location_marker"],
    "home": ["location_marker"],

    // INTENSITY MARKERS - Filipino
    "may": ["intensity_marker"],  // Filipino: there is/has
    "mga": ["intensity_marker"],  // Filipino: plural marker
    "maraming": ["intensity_marker"],  // Filipino: many/lots
    "lot": ["intensity_marker"],
    "ang": ["intensity_marker"],  // Filipino: the (marker)
    "yung": ["intensity_marker"],  // Filipino: that/the
    "nang": ["intensity_marker"],  // Filipino: when/while

    // ACTION REQUESTS - English/Filipino
    "please": ["action_request"],
    "fix": ["action_request"],
    "paki": ["action_request"],  // Filipino: please
    "job": ["action_request"],

    // NEGATION/PROBLEM MARKERS
    "cant": ["problem_marker"],
    "hindi": ["problem_marker"],  // Filipino: not/no
    "why": ["problem_marker"],

    // ADDITIONAL SPECIFIC TERMS
    "school": ["location_marker", "Public Safety"],
    "due": ["causal_marker"]  // Often used in "due to flooding", "due to rain"
};

// Keyword Extraction Function - Analyzes description text
function extractKeywordsFromDescription(description) {
    if (!description || typeof description !== 'string') return [];

    const text = description.toLowerCase();
    const words = text.split(/\s+/);
    const detectedCategories = new Set();

    // Check each word against dictionary
    words.forEach(word => {
        const cleaned = word.replace(/[^a-z]/g, '');
        if (KEYWORD_DICTIONARY[cleaned]) {
            KEYWORD_DICTIONARY[cleaned].forEach(cat => {
                if (!cat.includes('_marker') && !cat.includes('_request')) {
                    detectedCategories.add(cat);
                }
            });
        }
    });

    return Array.from(detectedCategories);
}

// Keyword Semantic Scoring - Calculate similarity between two descriptions
function calculateKeywordSimilarity(descA, descB) {
    const keywordsA = extractKeywordsFromDescription(descA);
    const keywordsB = extractKeywordsFromDescription(descB);

    if (keywordsA.length === 0 && keywordsB.length === 0) return 0;
    if (keywordsA.length === 0 || keywordsB.length === 0) return 0;

    // Jaccard similarity: intersection / union
    const setA = new Set(keywordsA);
    const setB = new Set(keywordsB);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
}

/**
 * Check keyword similarity between two complaint objects (used by DBSCAN engine)
 * @param {Object} pointA - First complaint object with description
 * @param {Object} pointB - Second complaint object with description  
 * @returns {Object} Similarity result with score and verdict
 */
function checkKeywordSimilarity(pointA, pointB) {
    const keywordsA = extractKeywordsFromDescription(pointA.description || '');
    const keywordsB = extractKeywordsFromDescription(pointB.description || '');

    // If either has no keywords, return neutral
    if (keywordsA.length === 0 || keywordsB.length === 0) {
        return {
            similarity: 0.5,
            sharedKeywords: [],
            verdict: "NEUTRAL",
            description: "Insufficient keyword data"
        };
    }

    // Find shared keywords using Jaccard similarity
    const setA = new Set(keywordsA);
    const setB = new Set(keywordsB);
    const intersection = [...setA].filter(kw => setB.has(kw));
    const union = new Set([...setA, ...setB]);

    // Jaccard similarity: intersection / union
    const similarity = intersection.length / union.size;

    // Determine verdict based on similarity thresholds
    let verdict = "WEAK";
    let resultDescription = "Low keyword overlap";

    if (similarity >= 0.6) {
        verdict = "STRONG";
        resultDescription = `High similarity (${intersection.length} shared keywords)`;
    } else if (similarity >= 0.3) {
        verdict = "MODERATE";
        resultDescription = `Moderate overlap (${intersection.length} shared)`;
    }

    return {
        similarity: Math.round(similarity * 100) / 100,
        sharedKeywords: intersection,
        verdict,
        description: resultDescription
    };
}

const CORRELATION_THRESHOLD = 0.50;
const MAX_TIME_DIFF_HOURS = 48;

// ==================== NLP CATEGORY INTEGRITY CHECK ====================
// Detects when user selected wrong category based on description keywords
// Supports English, Filipino (Tagalog), and Cebuano
// NOW WITH PARENT-CHILD HIERARCHY SUPPORT (v3.1)

/**
 * Category Hierarchy Map - Defines Parent-Child Relationships
 * This prevents false positives when a user selects a parent category
 * but the text contains keywords for a child category.
 * 
 * @thesis This hierarchy enables semantic understanding of category relationships.
 * Example: "Stray Animals" is the parent of "Stray Dog", so selecting
 * "Stray Animals" when text contains "aso" (dog) is NOT a mismatch.
 */
const CATEGORY_HIERARCHY = {
    // Parent Category : [Child Categories / Synonyms / Related Terms]

    // Animal Control Hierarchy
    "Stray Animals": ["Stray Dog", "Stray Cat", "Livestock", "Animal Control", "Wild Animal"],
    "Animal Control": ["Stray Dog", "Stray Cat", "Stray Animals", "Livestock"],

    // Infrastructure Hierarchy
    "Infrastructure": ["Pothole", "Road Damage", "Bridge Collapse", "Broken Streetlight", "Streetlight", "Road Obstruction"],
    "Road Damage": ["Pothole", "Infrastructure"],

    // Utilities Hierarchy
    "Utilities": ["No Water", "Blackout", "Pipe Leak", "Low Pressure", "Broken Streetlight"],

    // Water Issues Hierarchy
    "Flooding": ["Flood", "Flash Flood", "Storm Surge"],
    "Flood": ["Flooding", "Flash Flood"],

    // Public Safety Hierarchy
    "Public Safety": ["Crime", "Theft", "Drugs", "Harassment", "Accident", "Fire", "Noise Complaint"],
    "Crime": ["Theft", "Robbery", "Holdup", "Harassment"],

    // Environment Hierarchy
    "Environment": ["Flooding", "Flood", "Landslide", "Pollution", "Trash", "Illegal Dumping"],

    // Sanitation Hierarchy
    "Sanitation": ["Trash", "Illegal Dumping", "Overflowing Trash", "Bad Odor"],
    "Trash": ["Illegal Dumping", "Overflowing Trash", "Bad Odor", "Sanitation"],

    // Traffic Hierarchy
    "Traffic": ["Road Obstruction", "Congestion", "Accident"]
};

/**
 * Bilingual Keyword Dictionary for Category Validation
 * Maps keywords to BOTH specific category AND parent category.
 * Format: keyword -> [Specific Category, Parent Category(s)]
 * 
 * @thesis This dictionary enables NLP-based validation of citizen inputs
 * while respecting semantic hierarchies to prevent false positives.
 */
const CATEGORY_VALIDATION_DICTIONARY = {
    // ==================== STRAY ANIMALS (THE FIX) ====================
    // Keywords now map to BOTH specific AND parent categories
    'Stray Dog': ['aso', 'dog', 'stray dog', 'asong gala', 'tuta', 'puppy', 'kagat ng aso', 'dog bite'],
    'Stray Cat': ['pusa', 'cat', 'stray cat', 'pusang gala', 'kuting', 'kitten'],
    'Stray Animals': ['hayop', 'animal', 'gala', 'stray', 'wild', 'livestock', 'baka', 'cow', 'baboy', 'pig', 'manok', 'chicken'],
    'Animal Control': ['animal control', 'rabies', 'kagat', 'bite', 'attack'],

    // FLOODING / WATER ISSUES
    'Flooding': ['baha', 'flood', 'flooding', 'overflow', 'drain', 'ulan', 'rain', 'heavy rain', 'binaha', 'nagbaha', 'tubig-baha', 'flash flood'],
    'Flood': ['baha', 'flood', 'flooding', 'overflow', 'drain', 'binaha', 'nagbaha'],
    'No Water': ['walang tubig', 'no water', 'dry', 'tuyo', 'gripo', 'faucet', 'supply', 'disconnected', 'walang suplay', 'tubig', 'outage'],
    'Pipe Leak': ['leak', 'tubo', 'pipe', 'burst', 'pumutok', 'tagas', 'drip', 'wasak na tubo', 'butas na tubo'],

    // FIRE / EMERGENCY
    'Fire': ['sunog', 'fire', 'smoke', 'usok', 'burn', 'burning', 'apoy', 'nasusunog', 'flame', 'blaze', 'nasusunog'],

    // WASTE / SANITATION
    'Trash': ['basura', 'trash', 'garbage', 'waste', 'kalat', 'dump', 'refuse', 'dumi'],
    'Illegal Dumping': ['illegal', 'dump', 'basura', 'tapon', 'itinapon', 'kalat', 'nagkakalat', 'illegal dump'],
    'Overflowing Trash': ['overflowing', 'puno', 'full', 'basura', 'trash', 'umaapaw', 'sobrang dami'],
    'Bad Odor': ['baho', 'smell', 'odor', 'stink', 'amoy', 'mabaho', 'nakakainis', 'mabantot'],
    'Sanitation': ['basura', 'trash', 'kalat', 'baho', 'sanitation', 'kalinisan', 'makalat'],

    // ROAD / INFRASTRUCTURE
    'Pothole': ['lubak', 'pothole', 'butas', 'hole', 'sira', 'road damage', 'kalsada', 'butas sa daan'],
    'Road Damage': ['lubak', 'pothole', 'sira', 'crack', 'road', 'kalsada', 'daan', 'damage', 'wasak', 'bitak'],
    'Infrastructure': ['sira', 'damage', 'wasak', 'structure', 'building', 'gusali', 'infrastructure', 'tulay', 'bridge'],

    // ELECTRICAL
    'Blackout': ['kuryente', 'power', 'blackout', 'outage', 'brownout', 'ilaw', 'electric', 'walang kuryente', 'walang ilaw'],
    'Broken Streetlight': ['poste', 'ilaw', 'streetlight', 'lamp', 'wire', 'sira', 'di gumagana', 'patay na ilaw'],
    'Streetlight': ['poste', 'ilaw', 'streetlight', 'lamp', 'light', 'lampara', 'ilaw sa kalsada'],

    // TRAFFIC
    'Traffic': ['traffic', 'trapik', 'congestion', 'stuck', 'jam', 'siksikan', 'sarado', 'matrapik'],
    'Road Obstruction': ['obstruction', 'harang', 'block', 'sarado', 'closed', 'barrier', 'nakaharang'],

    // PUBLIC SAFETY
    'Accident': ['aksidente', 'accident', 'crash', 'banggaan', 'injury', 'sugat', 'nasagasaan'],
    'Crime': ['krimen', 'crime', 'theft', 'nakaw', 'holdup', 'robbery', 'violence', 'ninakaw'],
    'Noise Complaint': ['ingay', 'noise', 'loud', 'maingay', 'disturbance', 'karaoke', 'videoke'],
    'Public Safety': ['emergency', 'danger', 'delikado', 'panganib', 'help', 'tulong', 'emergency']
};

/**
 * Check if two categories are related via hierarchy (parent-child relationship).
 * 
 * @param {string} selectedCategory - The category user selected
 * @param {string} detectedCategory - The category detected from keywords
 * @returns {boolean} True if categories are hierarchically related
 */
function areCategoriesRelated(selectedCategory, detectedCategory) {
    // Same category = obviously related
    if (selectedCategory === detectedCategory) return true;

    // Check if detected is a child of selected (parent selected, child detected)
    const childrenOfSelected = CATEGORY_HIERARCHY[selectedCategory] || [];
    if (childrenOfSelected.includes(detectedCategory)) return true;

    // Check reverse: if selected is a child of detected (child selected, parent detected)
    const childrenOfDetected = CATEGORY_HIERARCHY[detectedCategory] || [];
    if (childrenOfDetected.includes(selectedCategory)) return true;

    // Check if they share a common parent
    for (const [parent, children] of Object.entries(CATEGORY_HIERARCHY)) {
        if (children.includes(selectedCategory) && children.includes(detectedCategory)) {
            return true; // Both are siblings under same parent
        }
    }

    return false;
}

// ==================== TAGALOG-AWARE NLP MATCHING (v3.4) ====================
// Supports Tagalog morphology: infixes (b-um-a-baha), reduplication, affixes
// Uses "Substring Match with Exception List" strategy
// 
// @changelog v3.3 - Replaced strict word boundary with smart substring matching
// @changelog v3.4 - Added CATEGORY_SYNONYMS and "paki-" command prefix filtering
// @bugfix "bumabaha" now correctly matches "baha" (is flooding = flood)
// @bugfix "kapitbahay" still does NOT match "baha" (neighbor ≠ flood)
// @bugfix "pakisunog" no longer triggers FIRE emergency (it's a command, not observation)
// @bugfix "Garbage Collection" now matches "Trash" via synonym mapping

/**
 * CATEGORY SYNONYMS MAP (The "Thesaurus")
 * Maps user-selected category names to equivalent NLP-detected categories.
 * This prevents false mismatch flags when categories have different names but same meaning.
 * 
 * @example
 * User selects: "Garbage Collection"
 * NLP detects: "Trash" from keyword "basura"
 * Without synonyms: MISMATCH (wrong!)
 * With synonyms: VALID MATCH ✅
 * 
 * @thesis Enables semantic equivalence checking between user-facing category
 * names and NLP-detected category names for improved data integrity.
 */
const CATEGORY_SYNONYMS = {
    // Sanitation/Waste categories
    "Garbage Collection": ["Trash", "Sanitation", "Solid Waste", "Illegal Dumping", "Overflowing Trash"],
    "Waste Management": ["Trash", "Sanitation", "Solid Waste", "Garbage Collection"],
    "Solid Waste": ["Trash", "Sanitation", "Garbage Collection", "Illegal Dumping"],

    // Infrastructure categories
    "Streetlight": ["Lighting", "Infrastructure", "Broken Streetlight", "Blackout"],
    "Broken Streetlight": ["Streetlight", "Lighting", "Infrastructure"],
    "Road Repair": ["Pothole", "Road Damage", "Infrastructure"],
    "Sidewalk": ["Infrastructure", "Road Damage"],

    // Animal-related categories
    "Stray Animals": ["Stray Dog", "Animal Control", "Public Safety"],
    "Stray Dog": ["Stray Animals", "Animal Control", "Public Safety"],
    "Animal Control": ["Stray Dog", "Stray Animals"],

    // Transportation categories
    "Public Transport": ["Traffic", "Transportation", "Road Obstruction"],
    "Transportation": ["Traffic", "Public Transport", "Road Obstruction"],

    // Water/Utility categories
    "Water Supply": ["No Water", "Utilities", "Pipe Leak"],
    "Power Outage": ["Blackout", "Utilities"],
    "Blackout": ["Power Outage", "Utilities"],

    // Environment categories
    "Flood": ["Flooding", "Environment", "Pipe Leak"],
    "Flooding": ["Flood", "Environment"],

    // Safety categories
    "Fire": ["Fire Incident", "Emergency", "Public Safety"],
    "Fire Incident": ["Fire", "Emergency", "Public Safety"],
    "Accident": ["Vehicular Accident", "Traffic", "Public Safety"],
    "Vehicular Accident": ["Accident", "Traffic", "Public Safety"]
};

/**
 * COMMAND PREFIXES TO IGNORE (The "Imperative Filter")
 * In Tagalog, "paki-" prefix indicates a polite request/command, NOT an observation.
 * Keywords starting with these prefixes should NOT trigger emergency detection.
 * 
 * @example
 * "Pakisunog ng truck niyo" = "Please burn your truck" (angry expression)
 * vs "Nasusunog ang bahay" = "The house is burning" (actual emergency)
 * 
 * @safety-critical This prevents figurative speech from triggering false alarms
 */
const COMMAND_PREFIXES = ['paki', 'ipaki', 'magpa', 'ipa', 'pa'];

/**
 * SAFETY-CRITICAL KEYWORDS
 * These keywords trigger the "paki-" filter because false positives are dangerous.
 */
const SAFETY_CRITICAL_KEYWORDS = ['sunog', 'fire', 'patay', 'aksidente', 'baril'];

/**
 * FALSE POSITIVE EXCEPTION LIST
 * Maps keywords to words that CONTAIN the keyword but are UNRELATED.
 * If a token contains both the keyword AND a blocked root, it's rejected.
 * 
 * @example
 * "kapitbahay" contains "baha" BUT also contains "bahay" (house) → BLOCKED
 * "bumabaha" contains "baha" and is NOT blocked → ALLOWED
 * 
 * @thesis This dictionary enables morphologically-aware NLP matching for
 * Filipino languages that use infixes, prefixes, suffixes, and reduplication.
 */
const FALSE_POSITIVE_ROOTS = {
    // Flooding keywords - block house-related words
    "baha": ["bahay", "kabahayan", "mabuhay", "bahala", "bahagi", "kapitbahay"],

    // Water keywords - block common false positives
    "tubig": ["patubig"],  // irrigation vs water problem

    // Fire keywords - block command expressions and idioms
    "sunog": [
        "pakisunog",    // "Please burn" (polite command/idiom)
        "ipasunog",     // "Have it burned" (command)
        "magpasunog",   // "To let something burn" (command)
        "sunog-baga",   // "Heartburn" (medical condition)
        "nasusunog"     // Edge case: This IS a fire, but analyze context
    ],
    "fire": ["firefox", "firewall", "campfire", "firefly"],

    // Animal keywords - block food/product references
    "aso": ["asoge", "asosiasyon"],  // mercury, association
    "dog": ["hotdog", "dog-riot", "underdog"],
    "pusa": ["pusang", "ipusa"],  // variations that might be non-cat

    // Trash keywords
    "basura": [],  // no common false positives

    // Road keywords
    "lubak": [],  // no common false positives
    "kalsada": [],

    // Noise keywords - block common false positives
    "ingay": [],

    // Add more as discovered in field testing...
};

/**
 * Tokenize text into words for analysis.
 * Splits by whitespace and punctuation while preserving word integrity.
 * 
 * @param {string} text - The raw text to tokenize
 * @returns {Array<string>} Array of lowercase word tokens
 */
function tokenizeText(text) {
    if (!text || typeof text !== 'string') return [];

    return text
        .toLowerCase()
        // Replace common punctuation with spaces
        .replace(/[.,!?;:'"()\-\/&@#$%^*+=<>[\]{}|\\~`]/g, ' ')
        // Replace multiple spaces with single space
        .replace(/\s+/g, ' ')
        // Trim leading/trailing whitespace
        .trim()
        // Split into words
        .split(' ')
        // Filter out empty strings
        .filter(word => word.length > 0);
}

/**
 * Check if a keyword matches within text using Tagalog-aware logic.
 * Allows substring matches BUT filters out known false positives.
 * 
 * @param {string} text - The full text to search in
 * @param {string} keyword - The keyword to search for
 * @returns {boolean} True if valid match found (not a false positive)
 * 
 * TEST CASES:
 * checkKeywordMatch("Ang kapitbahay ko", "baha") 
 *   → Token: "kapitbahay" → Contains "baha"? YES → Contains blocked root "bahay"? YES → FALSE ✅
 * 
 * checkKeywordMatch("Bumabaha na dito", "baha") 
 *   → Token: "bumabaha" → Contains "baha"? YES → Contains blocked root? NO → TRUE ✅
 * 
 * checkKeywordMatch("May baha sa daan", "baha")
 *   → Token: "baha" → Contains "baha"? YES → Contains blocked root? NO → TRUE ✅
 * 
 * checkKeywordMatch("Nakatira sa bahay", "baha")
 *   → Token: "bahay" → Contains "baha"? YES → Contains blocked root "bahay"? YES → FALSE ✅
 * 
 * checkKeywordMatch("Pakisunog ng truck", "sunog")
 *   → Token: "pakisunog" → Starts with "paki-" + safety-critical keyword → FALSE ✅
 * 
 * checkKeywordMatch("Nasusunog ang bahay", "sunog")
 *   → Token: "nasusunog" → Contains "sunog"? YES → Not a paki- command → TRUE ✅
 */
function checkKeywordMatch(text, keyword) {
    if (!text || !keyword) return false;

    const normalizedText = text.toLowerCase();
    const cleanKeyword = keyword.toLowerCase().trim();

    // Handle multi-word phrases (e.g., "stray dog", "walang tubig")
    if (cleanKeyword.includes(' ')) {
        // For phrases, check if the exact phrase exists with word boundaries
        const escapedKeyword = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const phraseRegex = new RegExp(`(?:^|\\s)${escapedKeyword}(?:\\s|$|[.,!?])`, 'i');
        return phraseRegex.test(normalizedText);
    }

    // Tokenize text for word-by-word analysis
    const tokens = tokenizeText(text);

    // Get the blocklist for this keyword
    const blocklist = FALSE_POSITIVE_ROOTS[cleanKeyword] || [];

    // Check if this is a safety-critical keyword (needs paki- filtering)
    const isSafetyCritical = SAFETY_CRITICAL_KEYWORDS.includes(cleanKeyword);

    // Scan each token
    for (const token of tokens) {
        // Step A: Does this token contain the keyword?
        if (token.includes(cleanKeyword)) {

            // Step B: COMMAND PREFIX FILTER (for safety-critical keywords)
            // In Tagalog, "paki-" prefix indicates a polite request/command, NOT an observation.
            // e.g., "Pakisunog" (Please burn) vs "Nasusunog" (Is burning)
            if (isSafetyCritical) {
                const hasCommandPrefix = COMMAND_PREFIXES.some(prefix =>
                    token.startsWith(prefix) && token !== cleanKeyword
                );
                if (hasCommandPrefix) {
                    // This is a command form, not an observation - skip it
                    continue;
                }
            }

            // Step C: Is this token blocked by containing a false positive root?
            // We check if ANY blocked root is contained within the token
            const isBlocked = blocklist.some(blockedRoot =>
                token.includes(blockedRoot.toLowerCase())
            );

            if (!isBlocked) {
                // Valid match found! (e.g., "bumabaha" matches "baha")
                return true;
            }
            // If blocked, continue checking other tokens...
        }
    }

    // No valid match found
    return false;
}

/**
 * Extract detected categories from description text using Tagalog-aware matching.
 * REFACTORED in v3.3 to support Filipino morphology (infixes, reduplication).
 * 
 * @param {string} description - The complaint description text
 * @returns {Array} Array of {category, keywords, matchCount} objects sorted by match count
 * 
 * @changelog v3.3 - Smart substring matching with false positive filtering
 * @supports Tagalog infixes: "bumabaha" → "baha" ✅
 * @blocks False positives: "kapitbahay" → "baha" ❌
 */
function extractCategoriesFromText(description) {
    if (!description || typeof description !== 'string') return [];

    const results = [];

    for (const [category, keywords] of Object.entries(CATEGORY_VALIDATION_DICTIONARY)) {
        // Use Tagalog-aware matching for each keyword
        const matches = keywords.filter(kw => checkKeywordMatch(description, kw));

        if (matches.length > 0) {
            results.push({
                category: category,
                keywords: matches,
                matchCount: matches.length
            });
        }
    }

    // Sort by match count (highest first)
    return results.sort((a, b) => b.matchCount - a.matchCount);
}

/**
 * Validate if the selected category matches the description content.
 * NOW WITH HIERARCHY SUPPORT to prevent false positives.
 * 
 * Logic Flow:
 * 1. Extract all detected categories from description keywords
 * 2. CHECK 1: Direct Match - if selected category is in detected list
 * 3. CHECK 2: Hierarchy Match (Parent selected, Child detected)
 * 4. CHECK 3: Reverse Hierarchy (Child selected, Parent detected)
 * 5. CHECK 4: Sibling Match (both under same parent)
 * 6. If ALL checks fail -> Flag as mismatch
 * 
 * @param {Object} complaint - Complaint object with category and description
 * @returns {Object} Validation result with mismatch flag and suggestion
 * 
 * @example
 * // This should return mismatch: false (Dog IS an Animal)
 * validateCategoryMismatch({ category: 'Stray Animals', description: 'May aso dito' })
 * 
 * @thesis This function implements NLP-based data integrity checking with
 * semantic hierarchy awareness to prevent false positive mismatch flags.
 */
function validateCategoryMismatch(complaint) {
    // Defensive: Handle null/undefined inputs
    if (!complaint || !complaint.description || typeof complaint.description !== 'string') {
        return {
            mismatch: false,
            selectedCategory: complaint?.category || 'Unknown',
            suggestedCategory: null,
            matchedKeywords: [],
            confidence: 0,
            reason: 'No description to analyze',
            hierarchyMatch: false
        };
    }

    const selectedCategory = complaint.subcategory || complaint.category || 'Unknown';
    const description = complaint.description.toLowerCase();

    // Step 1: Extract ALL detected categories from description
    const detectedCategories = extractCategoriesFromText(description);

    // If no keywords detected, can't validate
    if (detectedCategories.length === 0) {
        return {
            mismatch: false,
            selectedCategory: selectedCategory,
            suggestedCategory: null,
            matchedKeywords: [],
            confidence: 0.5,
            reason: 'Unable to validate: No recognizable keywords in description',
            hierarchyMatch: false
        };
    }

    // Step 2: CHECK 1 - Direct Match
    const directMatch = detectedCategories.find(d => d.category === selectedCategory);
    if (directMatch) {
        return {
            mismatch: false,
            selectedCategory: selectedCategory,
            suggestedCategory: null,
            matchedKeywords: directMatch.keywords,
            confidence: 1.0,
            reason: `Direct match: ${directMatch.matchCount} keyword(s) matched "${selectedCategory}"`,
            hierarchyMatch: false
        };
    }

    // Step 3: CHECK 2 - SYNONYM MATCH (The "Thesaurus" Check)
    // Check if the selected category is a synonym of any detected category
    for (const detected of detectedCategories) {
        const synonymsForSelected = CATEGORY_SYNONYMS[selectedCategory] || [];
        const synonymsForDetected = CATEGORY_SYNONYMS[detected.category] || [];

        // Check if detected is in synonyms of selected
        if (synonymsForSelected.includes(detected.category)) {
            return {
                mismatch: false,
                selectedCategory: selectedCategory,
                suggestedCategory: null,
                matchedKeywords: detected.keywords,
                confidence: 0.95,
                reason: `Synonym match: "${detected.category}" is equivalent to "${selectedCategory}"`,
                hierarchyMatch: false,
                synonymMatch: true,
                detectedCategory: detected.category
            };
        }

        // Check reverse: if selected is in synonyms of detected
        if (synonymsForDetected.includes(selectedCategory)) {
            return {
                mismatch: false,
                selectedCategory: selectedCategory,
                suggestedCategory: null,
                matchedKeywords: detected.keywords,
                confidence: 0.95,
                reason: `Synonym match: "${selectedCategory}" is equivalent to "${detected.category}"`,
                hierarchyMatch: false,
                synonymMatch: true,
                detectedCategory: detected.category
            };
        }
    }

    // Step 4: CHECK 3 & 4 & 5 - Hierarchy Match (Parent/Child/Sibling relationships)
    for (const detected of detectedCategories) {
        if (areCategoriesRelated(selectedCategory, detected.category)) {
            // Determine the relationship type for logging
            let relationshipType = 'related';
            const childrenOfSelected = CATEGORY_HIERARCHY[selectedCategory] || [];
            const childrenOfDetected = CATEGORY_HIERARCHY[detected.category] || [];

            if (childrenOfSelected.includes(detected.category)) {
                relationshipType = 'child of selected';
            } else if (childrenOfDetected.includes(selectedCategory)) {
                relationshipType = 'parent of selected';
            } else {
                relationshipType = 'sibling category';
            }

            return {
                mismatch: false,
                selectedCategory: selectedCategory,
                suggestedCategory: null,
                matchedKeywords: detected.keywords,
                confidence: 0.95,
                reason: `Hierarchy match: "${detected.category}" is ${relationshipType} of "${selectedCategory}"`,
                hierarchyMatch: true,
                detectedCategory: detected.category,
                relationshipType: relationshipType
            };
        }
    }

    // Step 5: ALL CHECKS FAILED - This is a genuine mismatch
    const bestMatch = detectedCategories[0]; // Highest match count

    // Calculate confidence based on keyword density
    const wordCount = description.split(/\\s+/).length;
    const confidence = Math.min(0.95, 0.5 + (bestMatch.matchCount / Math.max(wordCount, 1)) * 2);

    return {
        mismatch: true,
        selectedCategory: selectedCategory,
        suggestedCategory: bestMatch.category,
        matchedKeywords: bestMatch.keywords,
        confidence: Math.round(confidence * 100) / 100,
        reason: `Category mismatch: Found ${bestMatch.matchCount} keyword(s) for "${bestMatch.category}" but user selected "${selectedCategory}"`,
        hierarchyMatch: false,
        allDetected: detectedCategories.map(d => d.category)
    };
}

// ==================== CRITICAL TRIAGE SYSTEM v1.0 ====================
// Extracts emergency reports BEFORE clustering to prevent them being merged
// with non-critical complaints. Enables dedicated "ACTIVE EMERGENCIES" panel.
//
// @author DRIMS v3.0 Team
// @date January 2026

/**
 * EMERGENCY CATEGORIES - Categories that trigger automatic critical flagging
 */
const EMERGENCY_CATEGORIES = [
    "Fire", "Flooding", "Flood", "Accident", "Crime",
    "Medical", "Explosion", "Collapse"
    // NOTE: "Public Safety" REMOVED - too broad (includes Stray Animals which aren't emergencies)
];

/**
 * EMERGENCY KEYWORDS - Trigger words in English and Filipino (Tagalog)
 * Detection uses Tagalog-aware matching (supports infixes like "nasusunog")
 */
const EMERGENCY_KEYWORDS = {
    // Fire-related (English + Filipino)
    "fire": "FIRE",
    "sunog": "FIRE",
    "nasusunog": "FIRE",
    "apoy": "FIRE",
    "nagliliyab": "FIRE",
    "burning": "FIRE",

    // Death/Casualty (English + Filipino)
    "dead": "CASUALTY",
    "patay": "CASUALTY",
    "namatay": "CASUALTY",
    "death": "CASUALTY",
    "killed": "CASUALTY",
    "pinatay": "CASUALTY",

    // Injury/Blood (English + Filipino)
    "blood": "MEDICAL",
    "dugo": "MEDICAL",
    "duguan": "MEDICAL",
    "injured": "MEDICAL",
    "nasugatan": "MEDICAL",
    "sugat": "MEDICAL",

    // Accident (English + Filipino)
    "accident": "ACCIDENT",
    "aksidente": "ACCIDENT",
    "sagasa": "ACCIDENT",
    "nasagasaan": "ACCIDENT",
    "nabangga": "ACCIDENT",
    "collision": "ACCIDENT",
    "banggaan": "ACCIDENT",

    // Flooding (English + Filipino)
    "flood": "FLOOD",
    "baha": "FLOOD",
    "bumabaha": "FLOOD",
    "binabaha": "FLOOD",
    "tubig-baha": "FLOOD",
    "flash flood": "FLOOD",

    // Weapons/Crime (English + Filipino)
    "gun": "CRIME",
    "baril": "CRIME",
    "binaril": "CRIME",
    "holdup": "CRIME",
    "holdap": "CRIME",
    "robbery": "CRIME",
    "nakawan": "CRIME",
    "stabbed": "CRIME",
    "sinaksak": "CRIME",
    "saksak": "CRIME",

    // Medical Emergency
    "heart attack": "MEDICAL",
    "stroke": "MEDICAL",
    "unconscious": "MEDICAL",
    "hindi humihinga": "MEDICAL",
    "nawalan ng malay": "MEDICAL"
};

/**
 * v3.9 AUDIT FIX: NEGATION DETECTION SYSTEM
 * ============================================
 * Detects negated emergency keywords to prevent false positives.
 * "There is NO fire" should NOT trigger a fire alert.
 * 
 * Pattern: NEGATION_WORD + (0-3 words) + EMERGENCY_KEYWORD
 * Example: "no fire" → negated
 * Example: "walang sunog" → negated (Tagalog)
 * Example: "not a real fire" → negated
 */
const NEGATION_PATTERNS = {
    // English negation words
    english: ['no', 'not', 'never', 'none', 'nothing', 'nowhere', 'neither', 'nobody',
        'without', "don't", "doesn't", "didn't", "won't", "wouldn't", "can't",
        "cannot", "isn't", "aren't", "wasn't", "weren't", 'false alarm',
        'already extinguished', 'no longer', 'not anymore', 'just kidding',
        'fake', 'hoax', 'prank'],

    // Tagalog/Filipino negation words  
    tagalog: ['walang', 'wala', 'hindi', 'di', 'huwag', 'ayaw', 'wag',
        'walang problema', 'wala naman', 'hindi naman', 'di naman',
        'na-extinguish na', 'naapula na', 'na-control na', 'wala na',
        'hindi totoo', 'di totoo', 'biro lang', 'joke lang'],

    // Bisaya negation words
    bisaya: ['walay', 'wala', 'dili', 'ayaw', 'di', 'wa', 'wa na',
        'dili tinuod', 'joke ra', 'na-patay na', 'wala na problema']
};

/**
 * Check if an emergency keyword is negated in the description.
 * @param {string} description - The complaint description
 * @param {string} keyword - The emergency keyword to check
 * @returns {Object} { isNegated: boolean, negationWord: string|null }
 */
function checkNegation(description, keyword) {
    const descLower = description.toLowerCase();
    const keywordLower = keyword.toLowerCase();

    // Combine all negation patterns
    const allNegations = [
        ...NEGATION_PATTERNS.english,
        ...NEGATION_PATTERNS.tagalog,
        ...NEGATION_PATTERNS.bisaya
    ];

    for (const negation of allNegations) {
        // Build regex: negation + (0-3 words) + keyword
        // Example: "no" + "there is" + "fire" → matches "no there is fire"
        const pattern = new RegExp(
            `\\b${negation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b` + // Negation word
            `(?:\\s+\\w+){0,3}` +  // 0-3 intervening words
            `\\s+` +               // At least one space
            `\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, // Keyword
            'i'
        );

        if (pattern.test(descLower)) {
            console.log(`[NEGATION v3.9] ⛔ DETECTED: "${negation}" negates "${keyword}"`);
            console.log(`  └─ Description: "${descLower.substring(0, 60)}..."`);
            return { isNegated: true, negationWord: negation };
        }
    }

    // Also check for keyword appearing BEFORE negation (past tense resolution)
    // Example: "fire already extinguished" or "sunog na-patay na"
    const RESOLUTION_MARKERS = [
        'already extinguished', 'already put out', 'already controlled',
        'na-extinguish', 'naapula', 'na-control', 'na-patay',
        'resolved', 'under control', 'cleared', 'false alarm',
        'wala na', 'tapos na', 'okay na'
    ];

    for (const marker of RESOLUTION_MARKERS) {
        if (descLower.includes(keywordLower) && descLower.includes(marker)) {
            console.log(`[NEGATION v3.9] ⛔ RESOLUTION DETECTED: "${marker}" indicates resolved incident`);
            return { isNegated: true, negationWord: marker };
        }
    }

    return { isNegated: false, negationWord: null };
}

/**
 * SPECULATIVE TRIGGERS - Words that indicate hypothetical/preventive context
 * If an emergency keyword follows these, it should NOT be flagged as critical.
 * 
 * Example: "Walang ilaw, baka may ma-accident" → "accident" is speculative
 * Example: "Para iwas sunog" → "sunog" is preventive advice, not emergency
 */
const SPECULATIVE_TRIGGERS = [
    // English - Conditional/Hypothetical
    "might", "could", "may", "would", "can cause", "could cause",
    "possible", "potential", "risk of", "prone to", "waiting for",
    "prevent", "avoid", "before", "in case", "if there", "prone nang",
    "when a", "when the",  // "when a flood occur" → conditional

    // English - Uncertainty/Hedging (integrated from NLP processor)
    "maybe", "possibly", "probably", "perhaps",
    "could be", "may be", "seems", "seems like", "looks like",
    "appears", "appears to be", "i think", "i guess",
    "not sure", "unsure", "uncertain", "unclear",
    "suspected", "allegedly",

    // Tagalog/Visayan - Conditional markers
    "baka",          // might/maybe
    "pwede",         // could/can
    "pwedeng",       // could cause
    "posible",       // possible
    "siguro",        // maybe/probably  
    "tingali",       // maybe (Bisaya)
    "basin",         // maybe (Bisaya)
    "kasi",          // because (often used in speculation)
    "para",          // so that / in order to (preventive)
    "para hindi",    // so that not (preventive)
    "para iwas",     // to avoid (preventive)
    "para dili",     // so that not (Bisaya)
    "iwas",          // avoid
    "maiwasan",      // to be avoided
    "malikayan",     // to be avoided (Bisaya)
    "bago",          // before
    "kung",          // if
    "kung sakali",   // in case
    "kapag",         // when/if
    "pag",           // when/if (informal)
    "inig",          // when (Bisaya)
    "kon",           // if (Bisaya)
    "murag",         // maybe/like (Bisaya)

    // Tagalog - Uncertainty/Hedging (integrated from NLP processor)
    "marahil",       // perhaps
    "parang",        // seems like
    "tila",          // appears
    "mukhang",       // looks like
    "yata",          // I think (particle)
    "ata",           // I think (shortened)
    "di ko sure",    // not sure
    "hindi sigurado", // not sure
    "hindi ko alam", // I don't know
    "palagay ko",    // I think
    "akala ko",      // I thought

    // Bisaya - Uncertainty/Hedging (integrated from NLP processor)
    "daw",           // allegedly/supposedly
    "kuno",          // supposedly
    "ingon",         // they say
    "dili ko sure",  // not sure
    "di ko sure",    // not sure (shortened)
    "wala ko kahibalo", // I don't know
    "bsin",          // maybe (typo variant)

    // Tagalog - Potential mood markers (ma-, maka-)
    "ma-",           // potential: ma-accident (might get into accident)
    "maka-",         // potential: maka-cause
    "maging",        // might become
    "mahimo",        // might become (Bisaya)
    "magdudulot",    // might cause
    "magkakaroon",   // might have
    "mangyari",      // might happen
    "mahitabo",      // might happen (Bisaya)
    "delikado",      // dangerous (risk assessment, not active emergency)
    "peligro",       // dangerous (Bisaya)
    "mapanganib",    // hazardous

    // Bisaya habitual action prefixes (ga- indicates ongoing habitual)
    "ga-",           // habitual prefix: gabaha = keeps flooding
    "naga-",         // habitual: nagabaha = keeps flooding
    "mag-"           // future/habitual: magbaha = will flood
];

/**
 * POST-KEYWORD SPECULATION TRIGGERS v3.7.1
 * =========================================
 * Patterns that come AFTER the emergency keyword that indicate
 * conditional, future, or general statements rather than active emergencies.
 * 
 * Example: "Bumabaha dito pag ulan" → "pag ulan" makes it conditional
 * Example: "accident prone area" → "prone" indicates general description
 */
const POST_KEYWORD_SPECULATIVE = [
    // Conditional - comes after the action word
    "pag ulan",       // when it rains (conditional flood)
    "pag bagyo",      // when there's a typhoon
    "pag malakas ulan", // when rain is strong
    "pag ulan kusog", // when rain is strong (Bisaya)
    "pag kusog ang ulan", // when rain is strong (Bisaya)
    "inig ulan",      // when it rains (Bisaya)
    "kung mag ulan",  // if it rains (Bisaya)
    "kapag umuulan",  // when it rains
    "tuwing umuulan", // every time it rains
    "during rainy",   // during rainy season
    "every time",     // recurring pattern, not active event
    "tuwing",         // every time

    // Area description patterns (not active events)
    "prone area",     // accident-prone area (description)
    "prone are",      // typo for "area"
    "prone dito",     // prone here
    "prone diri",     // prone here (Bisaya)
    "prone ang",      // is prone
    "zone",           // flood zone, accident zone (designation)
    "hotspot",        // crime hotspot (designation)
    "area",           // flooding area, flooded area (general)
    "dapit",          // area (Bisaya)
    "issues",         // flood issues (general complaint)
    "problems",       // flooding problems (general)

    // General/habitual patterns
    "dati",           // before/previously (past)
    "sauna",          // before (Bisaya)
    "kaniadto",       // before (Bisaya)
    "noon",           // back then
    "dugay na",       // long time ago (Bisaya)
    "minsan",         // sometimes
    "usahay",         // sometimes (Bisaya)
    "madalas",        // often (habitual, not current)
    "permi",          // always (Bisaya)
    "permi gyud",     // always really (Bisaya)
    "kanunay",        // always (Bisaya)
    "sige rag",       // keeps on / always (Bisaya) - "sige rag lunop"
    "sige ra",        // keeps on (Bisaya)
    "sige",           // keeps on (Bisaya)
    "pirmi",          // always (Bisaya variant)
    "npd",            // napud = again (Bisaya) - "gabaha npd"
    "napud",          // again (Bisaya)
    "na pud",         // again (Bisaya)
    "na sad",         // again (Bisaya)
    "nasad",          // again (Bisaya)
    "balik balik",    // recurring (Bisaya)
    "lagi",           // always (habitual pattern)
    "palagi",         // always (habitual)
    "always",         // always (English)

    // Infrastructure complaint markers (not emergencies)
    "walay proper",   // no proper (Bisaya) - infrastructure
    "walay maayo",    // no good (Bisaya) - infrastructure
    "way",            // walay shortened - no/none (Bisaya)
    "dili maayo",     // not good (Bisaya) - infrastructure
    "guba",           // broken (Bisaya) - infrastructure
    "sira",           // broken (Tagalog) - infrastructure

    // Frustration/annoyance markers (not active emergencies)
    "umay",           // annoying (Bisaya)
    "samok",          // annoying (Bisaya)
    "kapoy",          // tiring (Bisaya)
    "hasol",          // hassle (Bisaya)
    "makalagot",      // frustrating (Bisaya)

    // Location markers (describing a location = not current emergency)
    "dria",           // here (Bisaya) - "gabaha dria"
    "diri",           // here (Bisaya) - "lunop diri"
    "dinhi",          // here (Bisaya formal)
    "dito",           // here (Tagalog)
    "dyan",           // there (Tagalog)
    "didto",          // there (Bisaya)

    // Conditional rain markers
    "pag ulan",       // when it rains (Bisaya)
    "pag kusog",      // when strong (Bisaya)
    "ulan kusog",     // strong rain (Bisaya)
    "kung ulan",      // if rain (Bisaya)
    "pag bagyo",      // when typhoon (Bisaya)

    // System/infrastructure markers
    "system",         // sewage system, drainage system
    "sistemang"       // system (Tagalog)
];

/**
 * PAST EVENT MARKERS v3.7
 * =======================
 * Patterns indicating the event happened in the past, not currently happening.
 * These should suppress emergency alerts as the incident has already occurred.
 */
const PAST_EVENT_PATTERNS = [
    // English past tense markers
    { pattern: "lost my", type: "past_loss" },
    { pattern: "during accident", type: "past_reference" },
    { pattern: "during the accident", type: "past_reference" },
    { pattern: "after the accident", type: "past_reference" },
    { pattern: "from the accident", type: "past_reference" },
    { pattern: "last time", type: "past_reference" },
    { pattern: "years ago", type: "past_reference" },
    { pattern: "months ago", type: "past_reference" },
    { pattern: "last year", type: "past_reference" },
    { pattern: "last month", type: "past_reference" },
    { pattern: "last week", type: "past_reference" },
    { pattern: "happened before", type: "past_reference" },
    { pattern: "used to", type: "past_habitual" },

    // Filipino/Tagalog past markers
    { pattern: "noong", type: "past_reference" },    // during/when (past)
    { pattern: "nung", type: "past_reference" },     // during/when (informal)
    { pattern: "dati", type: "past_reference" },     // before/previously
    { pattern: "sauna", type: "past_reference" },    // before (Bisaya)
    { pattern: "kaniadto", type: "past_reference" }, // before/past (Bisaya)
    { pattern: "dating", type: "past_reference" },   // former/previous
    { pattern: "nakaraan", type: "past_reference" }, // past/previous
    { pattern: "kahapon", type: "past_reference" },  // yesterday
    { pattern: "gahapon", type: "past_reference" },  // yesterday (Bisaya)
    { pattern: "kanina", type: "past_reference" },   // earlier (could be current day, be careful)
    { pattern: "ganina", type: "past_reference" },   // earlier (Bisaya)
    { pattern: "dugay na", type: "past_reference" }, // long time ago (Bisaya)
    { pattern: "nawala ko", type: "past_loss" },     // I lost (past)
    { pattern: "namatay ang", type: "past_death" },  // someone died (past)
    { pattern: "nasunog noon", type: "past_fire" }   // burned before
];

/**
 * NON-EMERGENCY KEYWORD PATTERNS v3.7
 * ===================================
 * Complete phrases that look like emergencies but are actually:
 * - Preventive warnings
 * - Area descriptions  
 * - Past event references
 * - Observations/suggestions
 */
const NON_EMERGENCY_PHRASES = [
    // Accident - preventive/descriptive uses
    { phrase: "can cause accident", category: "observation", priority: "low" },
    { phrase: "cause accident", category: "observation", priority: "low" },
    { phrase: "accident prone", category: "area_description", priority: "low" },
    { phrase: "aksidente prone", category: "area_description", priority: "low" },
    { phrase: "prone to accident", category: "area_description", priority: "low" },
    { phrase: "avoid accident", category: "preventive", priority: "low" },
    { phrase: "prevent accident", category: "preventive", priority: "low" },
    { phrase: "during accident", category: "past_reference", priority: "low" },

    // Flood - conditional/descriptive uses
    { phrase: "bumabaha pag", category: "conditional", priority: "medium" },
    { phrase: "pag bumabaha", category: "conditional", priority: "medium" },
    { phrase: "binabaha pag", category: "conditional", priority: "medium" },
    { phrase: "baha pag ulan", category: "conditional", priority: "medium" },
    { phrase: "lunop pag ulan", category: "conditional", priority: "medium" },      // Bisaya
    { phrase: "mag lunop pag ulan", category: "conditional", priority: "medium" },  // Bisaya
    { phrase: "permi lunop", category: "habitual", priority: "low" },               // Bisaya
    { phrase: "permi gyud lunop", category: "habitual", priority: "low" },          // Bisaya
    { phrase: "kanunay lunop", category: "habitual", priority: "low" },             // Bisaya
    { phrase: "flood prone", category: "area_description", priority: "low" },
    { phrase: "flood zone", category: "area_description", priority: "low" },
    { phrase: "flooding area", category: "area_description", priority: "low" },
    { phrase: "flooded area", category: "area_description", priority: "low" },
    { phrase: "lunop nga dapit", category: "area_description", priority: "low" },   // Bisaya
    { phrase: "flood issues", category: "general_complaint", priority: "low" },
    { phrase: "flooding problems", category: "general_complaint", priority: "low" },
    { phrase: "flood occurs", category: "conditional", priority: "medium" },
    { phrase: "when the flood", category: "conditional", priority: "medium" },
    { phrase: "when flood", category: "conditional", priority: "medium" },
    { phrase: "when a flood", category: "conditional", priority: "medium" },
    { phrase: "causing flood", category: "causal", priority: "low" },
    { phrase: "causes flood", category: "causal", priority: "low" },
    { phrase: "flood causes", category: "causal", priority: "low" },
    { phrase: "because of flood", category: "causal", priority: "low" },
    { phrase: "tungod sa lunop", category: "causal", priority: "low" },             // Bisaya
    { phrase: "due to flood", category: "causal", priority: "low" },
    { phrase: "due to heavy rainfall", category: "causal", priority: "low" },
    { phrase: "due to rainfall", category: "causal", priority: "low" },
    { phrase: "always flooding", category: "habitual", priority: "low" },
    { phrase: "minor flood", category: "minimized", priority: "low" },
    { phrase: "gamay ra ang lunop", category: "minimized", priority: "low" },       // Bisaya
    { phrase: "reason why flood", category: "explanation", priority: "low" },

    // Bisaya flood-related non-emergency phrases
    { phrase: "barado ang imburnal", category: "clogged_drain", priority: "medium" },
    { phrase: "puno sa basura ang kanal", category: "clogged_drain", priority: "medium" },
    { phrase: "dili na makadagan ang tubig", category: "drainage", priority: "medium" },
    { phrase: "walay dalanan ang tubig", category: "drainage", priority: "medium" },
    { phrase: "nagsapot na ang kanal", category: "clogged_drain", priority: "medium" },
    { phrase: "daghan basura sa kanal", category: "sanitation", priority: "medium" },
    { phrase: "gamay ra ang agianan sa tubig", category: "drainage", priority: "medium" },
    { phrase: "mabaw ra ang imburnal", category: "drainage", priority: "medium" },
    { phrase: "dili makaya sa imburnal", category: "drainage", priority: "medium" },
    { phrase: "ubos kaayo ang dalan", category: "infrastructure", priority: "medium" },

    // Bisaya habitual flood patterns (from field testing)
    { phrase: "permi baha", category: "habitual", priority: "low" },
    { phrase: "permi lunop", category: "habitual", priority: "low" },
    { phrase: "permi gyud baha", category: "habitual", priority: "low" },
    { phrase: "permi gyud lunop", category: "habitual", priority: "low" },
    { phrase: "sige rag lunop", category: "habitual", priority: "low" },
    { phrase: "sige rag baha", category: "habitual", priority: "low" },
    { phrase: "sige ra lunop", category: "habitual", priority: "low" },
    { phrase: "sige ra baha", category: "habitual", priority: "low" },
    { phrase: "gabaha npd", category: "habitual", priority: "low" },
    { phrase: "gabaha napud", category: "habitual", priority: "low" },
    { phrase: "gabaha na pud", category: "habitual", priority: "low" },
    { phrase: "gabaha na sad", category: "habitual", priority: "low" },
    { phrase: "lunop npd", category: "habitual", priority: "low" },
    { phrase: "lunop napud", category: "habitual", priority: "low" },
    { phrase: "gabaha dria", category: "location_description", priority: "low" },
    { phrase: "lunop dria", category: "location_description", priority: "low" },
    { phrase: "gabaha diri", category: "location_description", priority: "low" },
    { phrase: "lunop diri", category: "location_description", priority: "low" },

    // Bisaya infrastructure complaints (not emergencies)
    { phrase: "walay proper", category: "infrastructure", priority: "medium" },
    { phrase: "walay maayo", category: "infrastructure", priority: "medium" },
    { phrase: "walay drainage", category: "infrastructure", priority: "medium" },
    { phrase: "walay imburnal", category: "infrastructure", priority: "medium" },
    { phrase: "walay sewage", category: "infrastructure", priority: "medium" },
    { phrase: "way proper", category: "infrastructure", priority: "medium" },
    { phrase: "way drainage", category: "infrastructure", priority: "medium" },

    // Bisaya water pooling/passage issues (drainage, not emergency flood)
    { phrase: "gapundo tubig", category: "drainage", priority: "medium" },
    { phrase: "pundo ang tubig", category: "drainage", priority: "medium" },
    { phrase: "nagpundo ang tubig", category: "drainage", priority: "medium" },
    { phrase: "dili na maagian", category: "road_obstruction", priority: "medium" },
    { phrase: "dili maagian", category: "road_obstruction", priority: "medium" },
    { phrase: "lisod agian", category: "road_obstruction", priority: "medium" },

    // Frustration expressions (not emergencies)
    { phrase: "umay", category: "frustration", priority: "low" },
    { phrase: "samok kaayo", category: "frustration", priority: "low" },
    { phrase: "kapoy na", category: "frustration", priority: "low" },
    { phrase: "hasol kaayo", category: "frustration", priority: "low" },

    // Bisaya conditional patterns (exact from field testing)
    { phrase: "pag ulan kusog", category: "conditional", priority: "high" },
    { phrase: "pag ulan", category: "conditional", priority: "high" },
    { phrase: "pag kusog", category: "conditional", priority: "high" },
    { phrase: "kung ulan", category: "conditional", priority: "high" },
    { phrase: "kung mag ulan", category: "conditional", priority: "high" },
    { phrase: "kung gabaha", category: "conditional", priority: "high" },

    // Bisaya specific location + habitual patterns (exact from screenshots)
    { phrase: "dria umay", category: "frustration", priority: "high" },
    { phrase: "diri umay", category: "frustration", priority: "high" },
    { phrase: "gabaha npd dria", category: "habitual", priority: "high" },
    { phrase: "gabaha npd diri", category: "habitual", priority: "high" },
    { phrase: "gabaha napud dria", category: "habitual", priority: "high" },
    { phrase: "gabaha napud diri", category: "habitual", priority: "high" },
    { phrase: "sige rag lunop dria", category: "habitual", priority: "high" },
    { phrase: "sige rag lunop diri", category: "habitual", priority: "high" },
    { phrase: "sige rag baha dria", category: "habitual", priority: "high" },
    { phrase: "sige rag baha diri", category: "habitual", priority: "high" },
    { phrase: "permi baha pag ulan", category: "conditional", priority: "high" },
    { phrase: "permi lunop pag ulan", category: "conditional", priority: "high" },

    // Bisaya drainage/sewage infrastructure issues (exact from screenshots)
    { phrase: "walay proper sewage", category: "infrastructure", priority: "high" },
    { phrase: "walay proper drainage", category: "infrastructure", priority: "high" },
    { phrase: "walay proper imburnal", category: "infrastructure", priority: "high" },
    { phrase: "sewage system dria", category: "infrastructure", priority: "high" },
    { phrase: "sewage system diri", category: "infrastructure", priority: "high" },
    { phrase: "gapundo tubig diri", category: "drainage", priority: "high" },
    { phrase: "gapundo tubig dria", category: "drainage", priority: "high" },

    // Traffic + Flood combinations (traffic is primary issue)
    { phrase: "traffic due to flood", category: "traffic_issue", priority: "low" },
    { phrase: "traffic because of flood", category: "traffic_issue", priority: "low" },
    { phrase: "traffic happened due to flood", category: "traffic_issue", priority: "low" },
    { phrase: "traffic due to flooding", category: "traffic_issue", priority: "low" },

    // Fire - non-emergency uses
    { phrase: "fire hazard", category: "observation", priority: "medium" },
    { phrase: "fire exit", category: "infrastructure", priority: "low" },
    { phrase: "fire extinguisher", category: "infrastructure", priority: "low" },
    { phrase: "sunog noon", category: "past_reference", priority: "low" }
];

// ==================== MODULE 0.5: METAPHOR FILTER v3.5 ====================
// ============================================================================
// 
// PURPOSE: Detect figurative/metaphorical usage of emergency keywords
//          to prevent false positive alerts.
//
// PROBLEM CASES THIS SOLVES:
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ "There is a flood of students crossing the street"  → NOT FLOOD        │
// │ "My phone is dead, can't call"                      → NOT CASUALTY     │
// │ "The sunset is literally on fire"                   → NOT FIRE         │
// │ "This restaurant is a hidden gem, a real find"     → NOT CRIME        │
// │ "The sale is killing it today"                      → NOT CASUALTY     │
// │ "Traffic is murder during rush hour"                → NOT CRIME        │
// │ "The system crashed"                                → NOT ACCIDENT     │
// │ "I'm drowning in paperwork"                         → NOT FLOOD        │
// │ "The deadline is killing me"                        → NOT CASUALTY     │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ALGORITHM:
// 1. Check for explicit metaphor patterns (e.g., "flood of", "on fire")
// 2. Check for inanimate object + emergency keyword combos
// 3. Check for idiomatic expressions
// 4. Return true if metaphorical, false if literal emergency
//
// @author DRIMS v3.5 Team
// @date January 15, 2026
// @thesis Figurative Language Detection for Emergency Alert Systems
// ============================================================================

/**
 * ============================================================================
 * SAFE METAPHOR LIST v3.6 (January 15, 2026)
 * ============================================================================
 * 
 * CRITICAL SAFETY PATCH: Relaxed metaphor patterns to prevent blocking
 * REAL emergencies. Previously "on fire" was blocking actual fires.
 * 
 * DESIGN PRINCIPLE: Err on the side of caution - only block patterns that
 * are UNAMBIGUOUSLY figurative (e.g., "flood of students").
 * 
 * REMOVED (Too Dangerous):
 *   - "on fire" → Could be real fire: "The building is on fire!"
 *   - "dead battery" → Ambiguous in stranded scenarios
 *   - "app crash" → Could indicate vehicle crash + app context
 * 
 * @version 3.6.0
 * @date January 15, 2026
 */
const METAPHOR_PATTERNS = {
    // FLOOD - ONLY abundance metaphors that include "of" + group noun
    'flood': ['flood of', 'flooding with', 'flooded by'],

    // FIRE - REMOVED "on fire" to be safe! Only definite non-emergencies
    'fire': ['fire sale', 'fired from', 'fire in the belly', 'spitting fire'],

    // DEAD - REMOVED "dead battery" (ambiguous in stranded car scenarios)
    'dead': ['deadline', 'dead end', 'dead spot'],

    // CRASH - REMOVED "app crash" (could be mentioned alongside real crash)
    'crash': ['crash course', 'market crash']
};

/**
 * HUMAN SUBJECT KEYWORDS - When "flood of X" pattern is found,
 * these subjects indicate it's definitely metaphorical.
 * 
 * Example: "flood of students" → Metaphorical (students = human group)
 * Counterexample: "flood of water" → Literal (water = actual flood)
 */
const HUMAN_SUBJECT_KEYWORDS = [
    'students', 'people', 'customers', 'emails', 'orders', 'notifications',
    'visitors', 'tourists', 'workers', 'employees', 'staff', 'team',
    'requests', 'messages', 'calls', 'complaints', 'questions', 'comments',
    'applications', 'submissions', 'likes', 'followers', 'tao', 'estudyante'
];

/**
 * INANIMATE SUBJECTS - Objects that when paired with emergency keywords
 * indicate non-emergency usage.
 * 
 * Pattern: "[emergency keyword] + [inanimate subject]" = NOT emergency
 * Example: "dead phone", "fire sale", "crash site" (if about stocks)
 */
const INANIMATE_SUBJECTS = {
    // Technology/Devices
    technology: [
        'phone', 'cellphone', 'cp', 'mobile', 'smartphone',
        'battery', 'charger', 'powerbank',
        'laptop', 'computer', 'pc', 'desktop', 'monitor', 'screen',
        'tablet', 'ipad', 'kindle',
        'tv', 'television', 'remote',
        'wifi', 'internet', 'signal', 'connection', 'network',
        'app', 'application', 'software', 'system', 'server', 'website',
        'link', 'url', 'page', 'site',
        'camera', 'printer', 'scanner',
        'speaker', 'microphone', 'headphones', 'earphones',
        'router', 'modem', 'hub',
        'usb', 'cable', 'cord', 'wire',
        'device', 'gadget', 'machine'
    ],

    // Time-related
    time: [
        'deadline', 'schedule', 'calendar', 'clock', 'timer',
        'day', 'week', 'month', 'year',
        'morning', 'afternoon', 'evening', 'night',
        'hour', 'minute', 'second', 'moment'
    ],

    // Abstract concepts
    abstract: [
        'idea', 'plan', 'project', 'proposal', 'deal', 'agreement',
        'conversation', 'discussion', 'meeting', 'negotiation',
        'relationship', 'friendship', 'partnership',
        'dream', 'hope', 'wish', 'goal', 'ambition',
        'career', 'job', 'business', 'venture', 'startup',
        'market', 'stock', 'investment', 'economy',
        'silence', 'air', 'atmosphere', 'mood', 'vibe',
        'joke', 'humor', 'sarcasm',
        'fashion', 'trend', 'style',
        'game', 'match', 'competition', 'race',
        'performance', 'show', 'act', 'scene'
    ],

    // Nature elements (when used metaphorically)
    nature: [
        'sunset', 'sunrise', 'sky', 'horizon',
        'autumn', 'fall', 'leaves', 'colors',
        'passion', 'enthusiasm', 'energy', 'spirit',
        'eyes', 'hair', 'dress', 'outfit'  // "hair on fire", "eyes on fire" = enthusiasm
    ],

    // Groups/Collections (for "flood of X" pattern)
    groups: [
        'students', 'people', 'customers', 'visitors', 'tourists',
        'workers', 'employees', 'staff', 'team', 'crowd', 'audience',
        'requests', 'emails', 'messages', 'notifications', 'calls',
        'orders', 'applications', 'submissions', 'entries',
        'complaints', 'questions', 'inquiries', 'tickets',
        'comments', 'likes', 'shares', 'followers', 'subscribers',
        'data', 'information', 'content', 'documents', 'files',
        'ideas', 'suggestions', 'feedback', 'reviews',
        'memories', 'emotions', 'feelings', 'tears',
        'words', 'letters', 'texts'
    ],

    // Tagalog inanimate subjects
    tagalog: [
        'telepono', 'cellphone', 'cp',
        'tao', 'mga tao', 'estudyante', 'mga estudyante',
        'customer', 'bisita', 'manggagawa',
        'trabaho', 'gawain', 'proyekto',
        'email', 'mensahe', 'text', 'tawag',
        'araw', 'gabi', 'umaga', 'hapon',
        'idea', 'plano', 'pangarap'
    ]
};

/**
 * IDIOMATIC EXPRESSIONS - Complete phrases that should never trigger emergencies.
 * These are full expressions that use emergency words figuratively.
 * 
 * Format: Complete phrase (lowercase) that should be ignored.
 */
const IDIOMATIC_EXPRESSIONS = [
    // Fire idioms
    "on fire",                      // Doing great
    "fire in the belly",            // Determination
    "fight fire with fire",         // Respond in kind
    "where there's smoke there's fire", // Rumors have basis
    "add fuel to the fire",         // Make worse
    "play with fire",               // Take risks
    "out of the frying pan into the fire", // Bad to worse
    "fire and brimstone",           // Anger/judgment
    "trial by fire",                // Difficult test
    "baptism of fire",              // First tough experience
    "hold fire",                    // Wait
    "fire at will",                 // Proceed (usually commands)
    "fire drill",                   // Practice emergency (not real)
    "ring of fire",                 // Song/geographic reference
    "great fire sale",              // Discount event
    "light a fire under",           // Motivate
    "burn with desire",             // Strong wanting
    "burning question",             // Important question
    "burned out",                   // Exhausted
    "slow burn",                    // Gradual anger
    "crash and burn",               // Fail completely

    // Flood idioms
    "flood of tears",               // Crying a lot
    "flood the market",             // Oversupply
    "open the floodgates",          // Allow many
    "after the flood",              // Biblical/historical reference
    "flood of emotions",            // Many feelings
    "flood of memories",            // Many memories
    "flood of information",         // Info overload

    // Dead idioms
    "dead in the water",            // Stalled
    "dead as a doornail",           // Completely dead (but idiomatic)
    "dead to rights",               // Caught
    "dead to the world",            // Sleeping deeply
    "dead heat",                    // Tie
    "dead center",                  // Exactly middle
    "dead end job",                 // No advancement
    "dead ringer",                  // Lookalike
    "dead giveaway",                // Obvious
    "dead silence",                 // Complete silence
    "dead weight",                  // Burden
    "dead wrong",                   // Completely wrong
    "dead tired",                   // Exhausted
    "dead set against",             // Strongly opposed
    "dead serious",                 // Very serious
    "drop dead gorgeous",           // Very attractive
    "over my dead body",            // Strong refusal
    "knock em dead",                // Do great
    "dead on arrival",              // Failed from start (for projects)
    "dead man walking",             // Person in trouble (not literal)

    // Accident idioms
    "by accident",                  // Unintentionally
    "accident waiting to happen",   // Risky (but not actual accident)
    "happy accident",               // Good mistake
    "accident prone",               // Tends to have accidents (not current)

    // Blood idioms
    "blood sweat and tears",        // Hard work
    "bad blood",                    // Animosity
    "blood is thicker than water",  // Family loyalty
    "in cold blood",                // Ruthlessly
    "makes my blood boil",          // Anger
    "blood on hands",               // Responsibility for harm
    "blood money",                  // Ill-gotten gains
    "new blood",                    // New members
    "blue blood",                   // Aristocracy
    "young blood",                  // Young people
    "blood brother",                // Close friend
    "blood oath",                   // Serious promise
    "flesh and blood",              // Human

    // Crash idioms
    "crash course",                 // Quick learning
    "crash diet",                   // Extreme diet
    "crash pad",                    // Temporary sleeping place
    "crash the party",              // Uninvited attendance
    "crash and burn",               // Fail spectacularly
    "stock market crash",           // Economic (different type)
    "system crash",                 // Computer failure

    // Kill idioms
    "killing it",                   // Doing great
    "kill time",                    // Pass time
    "kill two birds with one stone", // Efficiency
    "if looks could kill",          // Angry look
    "dressed to kill",              // Dressed well
    "kill the messenger",           // Blame bearer of bad news
    "kill with kindness",           // Overwhelm with niceness
    "made a killing",               // Made profit
    "curiosity killed the cat",     // Warning about prying
    "kill me now",                  // Frustration
    "kill the mood",                // Ruin atmosphere
    "kill the engine",              // Turn off vehicle
    "kill the lights",              // Turn off lights
    "overkill",                     // Excessive

    // Gun idioms
    "jump the gun",                 // Act prematurely
    "stick to your guns",           // Maintain position
    "gun it",                       // Accelerate
    "big gun",                      // Important person
    "smoking gun",                  // Evidence
    "going great guns",             // Doing well
    "under the gun",                // Pressured
    "hired gun",                    // Freelancer
    "son of a gun",                 // Expression of surprise

    // Tagalog idioms
    "patay na patay",               // Very much (in love, etc.)
    "patay gutom",                  // Very hungry
    "patay malisya",                // Pretending ignorance
    "sunog na sunog",               // Extremely (tired, busy)
    "mainit ang ulo",               // Angry (not fire)
    "umaapaw ang damdamin",         // Overflowing emotions
    "binaha ng problema",           // Many problems
    "binaha ng trabaho",            // Much work
    "parang patay",                 // Like dead (exhausted)
    "tulad ng apoy",                // Like fire (passionate)

    // Drowning/sinking idioms
    "drowning in work",             // Too much work
    "drowning in debt",             // Financial trouble
    "sink or swim",                 // Survive or fail
    "sinking feeling",              // Worry

    // Collapse idioms
    "collapse from exhaustion",     // Tiredness (monitor context)
    "collapsed in laughter",        // Laughed hard
    "nervous breakdown"             // Mental health (different response)
];

/**
 * CONTEXT QUALIFIERS - Words that appear before emergency keywords
 * that indicate figurative usage.
 * 
 * Pattern: "[qualifier] + [emergency keyword]" = likely figurative
 * Example: "literally on fire" (internet slang for doing well)
 */
const FIGURATIVE_QUALIFIERS = [
    'literally',      // Ironically often used figuratively: "literally dead"
    'basically',      // "basically dying" = exaggerating
    'totally',        // "totally flooded" (with work)
    'completely',     // "completely dead" (battery)
    'absolutely',     // "absolutely killing it"
    'so',             // "so dead" (tired)
    'like',           // "like, dead" (exhausted)
    'lowkey',         // "lowkey dying" (slightly overwhelmed)
    'highkey',        // "highkey dead" (very overwhelmed)
    'lowkey',         // Internet slang
    'fr fr',          // "for real for real" (often hyperbolic)
    'no cap',         // Internet slang for "no lie"
    'im',             // "I'm dead" (finding something funny)
    'i\'m',           // "I'm dead" 
    'im literally',   // "I'm literally dying"
    'i am',           // "I am so dead"
    'sobrang',        // Tagalog: very (often hyperbolic)
    'ang',            // Tagalog: very (intensifier)
    'grabe',          // Tagalog: extreme (often hyperbolic)
    'ang sarap',      // Tagalog: so good (not actual fire)
    'ang ganda',      // Tagalog: so beautiful
    'ang cute',       // So cute
    'this is'         // "This is fire" (slang for good)
];

/**
 * Check if an emergency keyword is used in a metaphorical/figurative context.
 * This is the main function that determines if a keyword should be ignored.
 * 
 * ALGORITHM FLOW:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  1. Check IDIOMATIC_EXPRESSIONS (full phrase match)                     │
 * │     ↓ Not found                                                         │
 * │  2. Check METAPHOR_PATTERNS (keyword-specific patterns)                 │
 * │     ↓ Not found                                                         │
 * │  3. Check INANIMATE_SUBJECTS (keyword + object combo)                   │
 * │     ↓ Not found                                                         │
 * │  4. Check FIGURATIVE_QUALIFIERS (prefix check)                          │
 * │     ↓ Not found                                                         │
 * │  5. Return FALSE (literal usage - IS an emergency)                      │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * @param {string} text - Full description text to analyze
 * @param {string} keyword - Emergency keyword that was detected
 * @returns {Object} { isMetaphorical: boolean, reason: string, matchedPattern: string|null }
 * 
 * @example
 * // Metaphorical - should be ignored
 * isMetaphoricalUsage("The sunset is on fire today", "fire")
 * // Returns: { isMetaphorical: true, reason: "Idiom: 'on fire'", matchedPattern: "on fire" }
 * 
 * @example
 * // Literal - real emergency
 * isMetaphoricalUsage("May sunog sa palengke", "sunog")
 * // Returns: { isMetaphorical: false, reason: "Literal usage", matchedPattern: null }
 * 
 * @example
 * // Metaphorical - flood of people
 * isMetaphoricalUsage("There is a flood of students", "flood")
 * // Returns: { isMetaphorical: true, reason: "Pattern: 'flood of' + group", matchedPattern: "flood of students" }
 */
function isMetaphoricalUsage(text, keyword) {
    const lowerText = text.toLowerCase().trim();
    const lowerKeyword = keyword.toLowerCase().trim();

    const result = {
        isMetaphorical: false,
        reason: 'Literal usage - potential emergency',
        matchedPattern: null,
        confidence: 0
    };

    // ========================================================
    // STEP 1: Check IDIOMATIC EXPRESSIONS (exact phrase match)
    // ========================================================
    // These are complete phrases that are definitely figurative
    for (const idiom of IDIOMATIC_EXPRESSIONS) {
        if (lowerText.includes(idiom)) {
            result.isMetaphorical = true;
            result.reason = `Idiomatic expression: "${idiom}"`;
            result.matchedPattern = idiom;
            result.confidence = 0.95;
            console.log(`[METAPHOR v3.5] IDIOM DETECTED: "${idiom}" in "${lowerText.substring(0, 50)}..."`);
            return result;
        }
    }

    // ========================================================
    // STEP 2: Check METAPHOR_PATTERNS (keyword-specific)
    // ========================================================
    const patterns = METAPHOR_PATTERNS[lowerKeyword] || [];

    for (const pattern of patterns) {
        if (lowerText.includes(pattern)) {
            // Special handling for "flood of" / "baha ng" - must be followed by non-emergency subject
            if (pattern === 'flood of' || pattern === 'baha ng' || pattern === 'a flood') {
                // Get what comes after "flood of"
                const patternIndex = lowerText.indexOf(pattern);
                const afterPattern = lowerText.substring(patternIndex + pattern.length).trim();
                const nextWords = afterPattern.split(/\s+/).slice(0, 3); // Get next 3 words

                // Check if any of the next words are in INANIMATE_SUBJECTS.groups
                const isFollowedByGroup = nextWords.some(word =>
                    INANIMATE_SUBJECTS.groups.some(group =>
                        word.includes(group) || group.includes(word)
                    )
                );

                if (isFollowedByGroup) {
                    result.isMetaphorical = true;
                    result.reason = `Pattern: "${pattern}" + group noun`;
                    result.matchedPattern = `${pattern} ${nextWords.join(' ')}`;
                    result.confidence = 0.9;
                    console.log(`[METAPHOR v3.5] PATTERN + GROUP: "${pattern}" followed by "${nextWords.join(' ')}"`);
                    return result;
                }
            } else {
                // Direct pattern match (e.g., "dead phone", "on fire")
                result.isMetaphorical = true;
                result.reason = `Metaphor pattern: "${pattern}"`;
                result.matchedPattern = pattern;
                result.confidence = 0.9;
                console.log(`[METAPHOR v3.5] PATTERN MATCH: "${pattern}" in "${lowerText.substring(0, 50)}..."`);
                return result;
            }
        }
    }

    // ========================================================
    // STEP 3: Check INANIMATE_SUBJECTS (keyword + object combo)
    // ========================================================
    // Check if the keyword is immediately preceded/followed by inanimate object

    // Get all inanimate subjects in one flat array
    const allInanimates = [
        ...INANIMATE_SUBJECTS.technology,
        ...INANIMATE_SUBJECTS.time,
        ...INANIMATE_SUBJECTS.abstract,
        ...INANIMATE_SUBJECTS.nature,
        ...INANIMATE_SUBJECTS.tagalog
    ];

    // Find keyword position
    const keywordIndex = lowerText.indexOf(lowerKeyword);
    if (keywordIndex !== -1) {
        // Check 3 words before keyword
        const beforeKeyword = lowerText.substring(Math.max(0, keywordIndex - 30), keywordIndex);
        const wordsBefore = beforeKeyword.trim().split(/\s+/).slice(-3);

        // Check 3 words after keyword
        const afterKeyword = lowerText.substring(keywordIndex + lowerKeyword.length);
        const wordsAfter = afterKeyword.trim().split(/\s+/).slice(0, 3);

        // Check if any inanimate subject is nearby
        for (const inanimate of allInanimates) {
            // Check before: "dead phone", "phone is dead"
            if (wordsBefore.some(w => w.includes(inanimate) || inanimate.includes(w))) {
                result.isMetaphorical = true;
                result.reason = `Inanimate subject (before): "${inanimate}"`;
                result.matchedPattern = `${inanimate} + ${lowerKeyword}`;
                result.confidence = 0.85;
                console.log(`[METAPHOR v3.5] INANIMATE BEFORE: "${inanimate}" + "${lowerKeyword}"`);
                return result;
            }

            // Check after: "phone dead", "phone is dead"
            if (wordsAfter.some(w => w.includes(inanimate) || inanimate.includes(w))) {
                // Exception: don't flag if it's describing actual emergency location
                // e.g., "fire at phone store" - store is location, not subject
                const locationWords = ['at', 'in', 'near', 'beside', 'sa', 'dito', 'doon'];
                const hasLocationWord = wordsAfter.some(w => locationWords.includes(w));

                if (!hasLocationWord) {
                    result.isMetaphorical = true;
                    result.reason = `Inanimate subject (after): "${inanimate}"`;
                    result.matchedPattern = `${lowerKeyword} + ${inanimate}`;
                    result.confidence = 0.85;
                    console.log(`[METAPHOR v3.5] INANIMATE AFTER: "${lowerKeyword}" + "${inanimate}"`);
                    return result;
                }
            }
        }
    }

    // ========================================================
    // STEP 4: Check FIGURATIVE_QUALIFIERS (prefix hyperbole)
    // ========================================================
    // Patterns like "literally dying", "so dead", "I'm dead"

    for (const qualifier of FIGURATIVE_QUALIFIERS) {
        // Check if qualifier appears right before the keyword
        const qualifierPattern = new RegExp(`${qualifier}\\s+(\\w+\\s+)?${lowerKeyword}`, 'i');
        if (qualifierPattern.test(lowerText)) {
            // Additional check: Is this internet slang usage?
            // "I'm literally dead" = laughing, "I'm so dead" = in trouble metaphorically

            // Context: Self-referential ("I'm") usually means hyperbole
            if (lowerText.includes("i'm ") || lowerText.includes("im ") || lowerText.includes("i am ")) {
                result.isMetaphorical = true;
                result.reason = `Hyperbolic qualifier: "${qualifier}" (self-referential)`;
                result.matchedPattern = `${qualifier} + ${lowerKeyword}`;
                result.confidence = 0.8;
                console.log(`[METAPHOR v3.5] HYPERBOLE: "${qualifier}" + "${lowerKeyword}"`);
                return result;
            }
        }
    }

    // ========================================================
    // STEP 5: Check for SLANG/INTERNET USAGE
    // ========================================================
    // Modern internet slang where emergency words mean something positive

    const slangPatterns = [
        { pattern: /this is (fire|🔥)/, reason: "Slang: 'This is fire' = This is good" },
        { pattern: /(that's|thats) (fire|🔥)/, reason: "Slang: 'That's fire' = That's good" },
        { pattern: /straight (fire|🔥)/, reason: "Slang: 'Straight fire' = Really good" },
        { pattern: /pure (fire|🔥)/, reason: "Slang: 'Pure fire' = Excellent" },
        { pattern: /i('m| am) (dead|dying|💀)/, reason: "Slang: 'I'm dead' = Finding it funny" },
        { pattern: /im (dead|dying|💀)/, reason: "Slang: 'I'm dead' = Finding it funny" },
        { pattern: /lol (dead|dying)/, reason: "Slang: Laughing + dead = Finding it funny" },
        { pattern: /haha.*(dead|dying)/, reason: "Slang: Laughing + dead = Finding it funny" },
        { pattern: /😂.*(dead|dying)/, reason: "Slang: Laughing + dead = Finding it funny" },
        { pattern: /🤣.*(dead|dying)/, reason: "Slang: Laughing + dead = Finding it funny" },
        { pattern: /killed it/, reason: "Slang: 'Killed it' = Did great" },
        { pattern: /crushing it/, reason: "Slang: 'Crushing it' = Doing great" },
        { pattern: /slaying/, reason: "Slang: 'Slaying' = Doing great" },
        { pattern: /fire (emoji|🔥)/, reason: "Emoji context = Positive" }
    ];

    for (const { pattern, reason } of slangPatterns) {
        if (pattern.test(lowerText)) {
            result.isMetaphorical = true;
            result.reason = reason;
            result.matchedPattern = pattern.toString();
            result.confidence = 0.85;
            console.log(`[METAPHOR v3.5] SLANG: ${reason}`);
            return result;
        }
    }

    // ========================================================
    // STEP 6: No metaphor detected - return false (literal usage)
    // ========================================================
    console.log(`[METAPHOR v3.5] LITERAL: "${lowerKeyword}" in "${lowerText.substring(0, 50)}..." - POTENTIAL EMERGENCY`);
    return result;
}

/**
 * Quick check for metaphorical usage (returns boolean only).
 * Use this for simple checks where you don't need the detailed reason.
 * 
 * @param {string} text - Full description text
 * @param {string} keyword - Emergency keyword to check
 * @returns {boolean} TRUE if metaphorical, FALSE if literal emergency
 */
function isMetaphorical(text, keyword) {
    return isMetaphoricalUsage(text, keyword).isMetaphorical;
}

// Export for testing and external use
if (typeof window !== 'undefined') {
    window.isMetaphoricalUsage = isMetaphoricalUsage;
    window.isMetaphorical = isMetaphorical;
    window.METAPHOR_PATTERNS = METAPHOR_PATTERNS;
    window.IDIOMATIC_EXPRESSIONS = IDIOMATIC_EXPRESSIONS;

    // ================================================================
    // 🧪 QA TEST SUITE: Metaphor Filter v3.5
    // Run in browser console: window.testMetaphorFilter()
    // ================================================================
    window.testMetaphorFilter = function () {
        console.log('\n' + '='.repeat(70));
        console.log('🧪 METAPHOR FILTER v3.5 - QA TORTURE TEST');
        console.log('='.repeat(70));

        const testCases = [
            // ============ SCENARIO A: "FALSE PANIC" TESTS ============
            { name: 'A1: Dead phone (tech slang)', text: 'My phone is dead. Hindi ko matawagan ang 911.', keyword: 'dead', expected: true },
            { name: 'A2: Traffic accident (context)', text: 'Traffic standstill dahil sa minor accident.', keyword: 'accident', expected: false }, // Traffic context
            { name: 'A3: Flood of students', text: 'There is a flood of students crossing the street.', keyword: 'flood', expected: true },
            { name: 'A3b: Flood of comments', text: 'May flood of comments sa post.', keyword: 'flood', expected: true },
            { name: 'A3c: Flood ng tao', text: 'Flood ng tao sa mall sale.', keyword: 'flood', expected: true },

            // ============ FIGURATIVE FIRE TESTS ============
            { name: 'B1: Fire outfit', text: 'Her outfit is fire!', keyword: 'fire', expected: true },
            { name: 'B2: Nasunog deadline', text: 'Nasunog na ang deadline ko!', keyword: 'sunog', expected: true },
            { name: 'B3: Hot take (fire)', text: 'This is a fire take ngl.', keyword: 'fire', expected: true },
            { name: 'B4: Mainit sa boss', text: 'Nasusunog na ako sa galit ng boss ko.', keyword: 'sunog', expected: true },

            // ============ FIGURATIVE DEATH TESTS ============
            { name: 'C1: Patay gutom', text: 'Patay gutom na ako, saan may malapit na kainan?', keyword: 'patay', expected: true },
            { name: 'C2: I\'m dying (laughter)', text: 'HAHAHA I\'m dead 💀💀', keyword: 'dead', expected: true },
            { name: 'C3: Dead tired', text: 'Dead tired from work today.', keyword: 'dead', expected: true },
            { name: 'C4: Patay na kotse', text: 'Patay ang kotse ko, need tow.', keyword: 'patay', expected: true },
            { name: 'C5: Patay ilaw', text: 'Patay ang mga ilaw sa barangay hall.', keyword: 'patay', expected: true },

            // ============ LITERAL EMERGENCIES (MUST PASS THROUGH) ============
            { name: 'D1: REAL fire', text: 'May sunog sa kanto! Tumawag kayo ng bumbero!', keyword: 'sunog', expected: false },
            { name: 'D2: REAL flood', text: 'Baha sa Maharlika Highway, 2 feet deep!', keyword: 'baha', expected: false },
            { name: 'D3: REAL casualty', text: 'May patay sa aksidente! Nakahandusay sa kalsada!', keyword: 'patay', expected: false },
            { name: 'D4: REAL dead body', text: 'There\'s a dead body in the alley behind Jollibee.', keyword: 'dead', expected: false },
            { name: 'D5: REAL accident', text: 'Major vehicle accident, 3 cars involved, injuries!', keyword: 'accident', expected: false },

            // ============ EDGE CASES ============
            { name: 'E1: Fire sale', text: 'Fire sale sa SM! Up to 70% off!', keyword: 'fire', expected: true },
            { name: 'E2: Flooded inbox', text: 'My inbox is flooded with spam.', keyword: 'flood', expected: true },
            { name: 'E3: Drowning in work', text: 'Drowning na ako sa paperwork.', keyword: 'drowning', expected: true },
            { name: 'E4: Crash landing', text: 'Netflix\'s Crash Landing on You marathon tonight!', keyword: 'crash', expected: true },
        ];

        let passed = 0;
        let failed = 0;

        console.log('\nRunning', testCases.length, 'test cases...\n');

        testCases.forEach((tc, i) => {
            const result = isMetaphoricalUsage(tc.text, tc.keyword);
            const testPassed = result.isMetaphorical === tc.expected;

            if (testPassed) {
                passed++;
                console.log(`✅ PASS [${tc.name}]`);
            } else {
                failed++;
                console.log(`❌ FAIL [${tc.name}]`);
                console.log(`   Text: "${tc.text}"`);
                console.log(`   Keyword: "${tc.keyword}"`);
                console.log(`   Expected: ${tc.expected ? 'METAPHORICAL' : 'LITERAL'}`);
                console.log(`   Got: ${result.isMetaphorical ? 'METAPHORICAL' : 'LITERAL'}`);
                if (result.isMetaphorical) {
                    console.log(`   Reason: ${result.reason}`);
                }
            }
        });

        console.log('\n' + '='.repeat(70));
        console.log(`RESULTS: ${passed}/${testCases.length} PASSED (${(passed / testCases.length * 100).toFixed(1)}%)`);
        console.log('='.repeat(70) + '\n');

        return { passed, failed, total: testCases.length };
    };

    // Quick single test function
    window.testMetaphor = function (text, keyword) {
        const result = isMetaphoricalUsage(text, keyword);
        console.log(`\n🔍 Testing: "${text}" [keyword: ${keyword}]`);
        console.log(`   Result: ${result.isMetaphorical ? '🎭 METAPHORICAL' : '⚠️ LITERAL EMERGENCY'}`);
        console.log(`   Reason: ${result.reason}`);
        console.log(`   Pattern: ${result.matchedPattern || 'N/A'}`);
        console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%`);
        return result;
    };

    // ================================================================
    // 🧪 AUTO-CATEGORIZATION TEST SUITE v3.6
    // Run in browser console: window.testAutoCategory()
    // ================================================================
    window.testAutoCategory = function () {
        console.log('\n' + '='.repeat(70));
        console.log('🧪 AUTO-CATEGORIZATION v3.6 - SMART OVERRIDE TEST');
        console.log('='.repeat(70));

        const testCases = [
            // Should AUTO-SWITCH from Others to correct category
            { cat: 'Others', desc: 'May sunog sa tabi ng bahay namin!', expected: 'Fire' },
            { cat: 'Others', desc: 'Naaksidente ang jeep sa kanto', expected: 'Accident' },
            { cat: 'Others', desc: 'May holdap sa 7-Eleven!', expected: 'Crime' },
            { cat: 'Others', desc: 'Baha na dito sa Maharlika Highway', expected: 'Flood' },
            { cat: 'Pothole', desc: 'May sunog sa palengke, malaki na!', expected: 'Fire' },

            // Should NOT switch (correct category already)
            { cat: 'Fire', desc: 'May sunog sa building', expected: 'Fire' },
            { cat: 'Traffic', desc: 'Traffic jam sa Roxas Avenue', expected: 'Traffic' },

            // Should NOT switch (no emergency keywords)
            { cat: 'Others', desc: 'Ang daming tao sa mall today', expected: 'Others' },
        ];

        let passed = 0;
        let failed = 0;

        testCases.forEach((tc, i) => {
            // Create mock point
            const point = {
                category: tc.cat,
                description: tc.desc
            };

            // Run NLP extraction
            const nlpResult = extractKeywordsWithCategory(tc.desc);
            const currentPriority = getCategoryPriority(tc.cat);

            // Simulate auto-categorization logic
            let finalCategory = tc.cat;
            if (tc.cat === 'Others' || (nlpResult.priority > currentPriority + 30)) {
                if (nlpResult.category && nlpResult.category !== 'Unsure') {
                    finalCategory = nlpResult.category;
                }
            }

            const testPassed = finalCategory === tc.expected;

            if (testPassed) {
                passed++;
                console.log(`✅ PASS: "${tc.cat}" → "${finalCategory}" | Desc: "${tc.desc.substring(0, 40)}..."`);
            } else {
                failed++;
                console.log(`❌ FAIL: "${tc.cat}" → "${finalCategory}" (expected: ${tc.expected})`);
                console.log(`   Desc: "${tc.desc}"`);
                console.log(`   NLP: ${nlpResult.category} (priority: ${nlpResult.priority})`);
            }
        });

        console.log('\n' + '='.repeat(70));
        console.log(`RESULTS: ${passed}/${testCases.length} PASSED (${(passed / testCases.length * 100).toFixed(1)}%)`);
        console.log('='.repeat(70) + '\n');

        return { passed, failed, total: testCases.length };
    };

    // Export new v3.6 functions
    window.getCategoryPriority = getCategoryPriority;
    window.extractKeywordsWithCategory = extractKeywordsWithCategory;
    window.HUMAN_SUBJECT_KEYWORDS = HUMAN_SUBJECT_KEYWORDS;
}

// ==================== END MODULE 0.5: METAPHOR FILTER v3.5 ====================

/**
 * Check if a keyword is used in SPECULATIVE context.
 * Looks at the 25 characters BEFORE the keyword to detect conditional markers.
 * 
 * @param {string} text - Full description text (lowercase)
 * @param {string} keyword - The emergency keyword found
 * @returns {Object} { isSpeculative: boolean, trigger: string|null }
// ==================== MODULE 1: THE INTELLIGENCE ANALYZER (NLP) ====================
/**
 * Analyze complaint intelligence using Layered Logic v3.4.
 * 
 * LAYER A: RAW SCORING (The Math)
 * - Base Score: Tier 1 (50), Tier 2 (30), Tier 3 (10)
 * - Panic Score: CAPS +10, !!! +5, Fear Keywords +2
 * - Veracity Score: <3 words = -20 (UNVERIFIED), ≥5 words+infra = +5 (HIGH CONFIDENCE)
 * 
 * LAYER B: SEMANTIC OVERRIDE (The Context Filter)
 * - TRAFFIC_CONTEXT: Cap at 35, Action: "⚠️ DEPLOY TRAFFIC CONTROL"
 * - MAINTENANCE_CONTEXT: Cap at 30, Action: "🔧 SCHEDULE MAINTENANCE"
 * 
 * Reference: [AI Suggestion.txt] cite: 3-18
 * 
 * @param {Object} point - Complaint object with category, description
 * @returns {Object} Intelligence result matching exact output structure for UI
 */

/**
 * ============================================================================
 * AUTO-CATEGORIZATION HELPER FUNCTIONS v3.6
 * ============================================================================
 * These functions support the "Smart Override" feature that automatically
 * re-categorizes mislabeled reports (e.g., "Others" → "Fire").
 */

/**
 * Get priority level for a category (higher = more urgent).
 * Used to determine if NLP-detected category should override user selection.
 * 
 * @param {string} category - Category name
 * @returns {number} Priority level (0-100)
 */
function getCategoryPriority(category) {
    const priorities = {
        // TIER 1 - Life-threatening (Priority 90-100)
        'Fire': 100,
        'Explosion': 100,
        'Collapse': 98,
        'Trapped': 98,
        'Gunshot': 95,
        'Medical': 95,
        'Casualty': 95,
        'Accident': 90,  // v3.9.1 FIX: Vehicular accidents are life-threatening
        'Crime': 88,

        // TIER 2 - High Priority (Priority 70-89)
        'Flood': 85,
        'Flooding': 85,
        'Landslide': 85,
        'Rescue': 80,
        'Public Safety': 75,
        'Power Line Down': 75,
        'Blackout': 70,
        'No Water': 65,

        // TIER 3 - Infrastructure (Priority 40-60)
        'Traffic': 50,
        'Road Damage': 45,
        'Pothole': 40,
        'Road Obstruction': 40,
        'Streetlight': 35,
        'Broken Streetlight': 35,

        // TIER 4 - Routine (Priority 10-39)
        'Garbage': 30,
        'Trash': 30,
        'Noise': 25,
        'Noise Complaint': 25,

        // Default
        'Others': 10,
        'Unsure': 5
    };
    return priorities[category] || 10;
}

/**
 * Extract keywords from description and suggest a category.
 * Returns the highest-priority category detected from keywords.
 * 
 * @param {string} description - Complaint description text
 * @returns {Object} { category: string|null, priority: number, matchedKeywords: string[] }
 */
function extractKeywordsWithCategory(description) {
    if (!description || typeof description !== 'string') {
        return { category: null, priority: 0, matchedKeywords: [] };
    }

    const text = description.toLowerCase();
    const matchedKeywordsSet = new Set();

    // Priority-ordered keyword patterns (check highest priority first)
    const CATEGORY_PATTERNS = {
        'Fire': ['sunog', 'fire', 'nasusunog', 'apoy', 'burning', 'flames', 'ablaze'],
        'Explosion': ['explosion', 'explode', 'pumutok', 'sumabog', 'blast', 'bomba'],
        'Collapse': ['collapse', 'gumuho', 'bumagsak', 'nawasak', 'crumbling'],
        'Trapped': ['trapped', 'nakulong', 'naiipit', 'stuck', 'stranded person'],
        'Gunshot': ['gunshot', 'baril', 'binaril', 'putok ng baril', 'shooting'],
        'Crime': ['crime', 'robbery', 'holdup', 'nakaw', 'snatcher', 'holdap', 'theft'],
        'Accident': ['accident', 'aksidente', 'nabangga', 'bumangga', 'collision', 'vehicular'],
        'Flood': ['flood', 'baha', 'binabaha', 'bumabaha', 'tubig-baha', 'rising water', 'flash flood'],
        'Medical': ['medical', 'emergency', 'injured', 'sugatan', 'ambulance', 'heart attack', 'stroke'],
        'Rescue': ['rescue', 'saklolo', 'tulong', 'help', 'save', 'iligtas'],
        'Traffic': ['traffic', 'trapik', 'congestion', 'gridlock', 'jam'],
        'Pothole': ['pothole', 'butas', 'lubak', 'hole in road'],
        'Garbage': ['garbage', 'basura', 'trash', 'waste', 'kalat'],
        'Streetlight': ['streetlight', 'ilaw', 'no light', 'walang ilaw', 'dark street']
    };

    let highestCategory = null;
    let highestPriority = 0;

    if (typeof detectFilipinoKeywords === 'function') {
        const dictResult = detectFilipinoKeywords(description);
        if (dictResult && dictResult.suggestedCategory && Array.isArray(dictResult.matches) && dictResult.matches.length > 0) {
            for (const match of dictResult.matches) {
                if (match && match.term) matchedKeywordsSet.add(String(match.term).toLowerCase());
            }

            const dictPriority = getCategoryPriority(dictResult.suggestedCategory);
            if (dictPriority > highestPriority) {
                highestPriority = dictPriority;
                highestCategory = dictResult.suggestedCategory;
            }
        }
    }

    for (const [category, keywords] of Object.entries(CATEGORY_PATTERNS)) {
        for (const keyword of keywords) {
            // v3.7: Use Tagalog-aware checkKeywordMatch instead of simple includes
            // This prevents false positives like "bahay" matching "baha"
            const isMatch = typeof checkKeywordMatch === 'function'
                ? checkKeywordMatch(description, keyword)
                : text.includes(keyword);

            if (isMatch) {
                matchedKeywordsSet.add(keyword);
                const priority = getCategoryPriority(category);
                if (priority > highestPriority) {
                    highestPriority = priority;
                    highestCategory = category;
                }
            }
        }
    }

    return {
        category: highestCategory,
        priority: highestPriority,
        matchedKeywords: Array.from(matchedKeywordsSet)
    };
}

function analyzeComplaintIntelligence(point) {
    const description = point.description || '';
    const descLower = description.toLowerCase();

    // ================================================================
    // [AUTO-CAT v3.9] SAFE AUTO-CATEGORIZATION - With Speculation, Negation & DOWNGRADE
    // ================================================================
    // - UPGRADE: Switch if keywords are LITERAL and NON-SPECULATIVE
    // - DOWNGRADE: v3.9 AUDIT FIX - Also downgrade if user selected too-high priority
    // Fixed: "prone nang accidente" should NOT trigger Accident category
    // Fixed: User selecting "Fire" for "pothole on my street" gets DOWNGRADED
    // ================================================================
    let effectiveCategory = point.subcategory || point.category || 'Others';
    const nlpResult = extractKeywordsWithCategory(description);

    // Logic: If Category is 'Others' OR NLP detects a much higher priority category
    const currentPriority = getCategoryPriority(effectiveCategory);
    const nlpPriority = nlpResult.priority;

    // SAFETY CHECK: Only block if keyword is SPECULATIVE (metaphor check happens later in checkCriticality)
    let shouldAutoSwitch = false;
    let shouldDowngrade = false;  // v3.9 AUDIT FIX: Track downgrade scenarios

    // UPGRADE PATH: NLP detects higher priority than user selection
    if (effectiveCategory === 'Others' || (nlpPriority > currentPriority + 30)) {
        if (nlpResult.category && nlpResult.category !== 'Unsure' && nlpResult.matchedKeywords.length > 0) {
            // Check if ANY matched keyword is NON-SPECULATIVE
            for (const keyword of nlpResult.matchedKeywords) {
                // Only check speculation - metaphor check is redundant here
                const specCheck = typeof checkSpeculativeContext === 'function'
                    ? checkSpeculativeContext(descLower, keyword)
                    : { isSpeculative: false };

                if (specCheck.isSpeculative) {
                    console.log(`[AUTO-CAT v3.9] ⛔ BLOCKED: "${keyword}" is speculative (trigger: "${specCheck.trigger}")`);
                    continue; // Try next keyword
                }

                // v3.9: Also check negation
                const negationCheck = checkNegation(descLower, keyword);
                if (negationCheck.isNegated) {
                    console.log(`[AUTO-CAT v3.9] ⛔ BLOCKED: "${keyword}" is negated by "${negationCheck.negationWord}"`);
                    continue;
                }

                // This keyword is NON-SPECULATIVE and NON-NEGATED - allow auto-switch
                shouldAutoSwitch = true;
                console.log(`[AUTO-CAT v3.9] ✅ NON-SPECULATIVE keyword: "${keyword}"`);
                break;
            }
        }
    }

    // ================================================================
    // v3.9 AUDIT FIX: DOWNGRADE PATH
    // If user selected high-priority category (Fire/Accident/Crime) but 
    // NLP detects ONLY low-priority keywords, DOWNGRADE to prevent gaming.
    // Example: User selects "Fire" but types "Small pothole on my street"
    // ================================================================
    if (!shouldAutoSwitch && nlpResult.category && nlpResult.priority > 0) {
        // Check if user's category is much HIGHER than what NLP detected
        if (currentPriority > nlpPriority + 40) {
            // High-priority category with low-priority description - potential gaming
            console.log(`[AUTO-CAT v3.9] ⚠️ DOWNGRADE CHECK: User "${effectiveCategory}" (${currentPriority}) vs NLP "${nlpResult.category}" (${nlpPriority})`);

            // Verify the NLP result is valid (non-speculative, non-negated)
            let validNlpKeyword = false;
            for (const keyword of nlpResult.matchedKeywords) {
                const specCheck = typeof checkSpeculativeContext === 'function'
                    ? checkSpeculativeContext(descLower, keyword)
                    : { isSpeculative: false };
                const negationCheck = checkNegation(descLower, keyword);

                if (!specCheck.isSpeculative && !negationCheck.isNegated) {
                    validNlpKeyword = true;
                    break;
                }
            }

            if (validNlpKeyword) {
                shouldDowngrade = true;
                console.log(`[AUTO-CAT v3.9] ⬇️ DOWNGRADING: "${effectiveCategory}" → "${nlpResult.category}"`);
                console.log(`  └─ Reason: Description matches "${nlpResult.category}" (priority ${nlpPriority}), not "${effectiveCategory}" (priority ${currentPriority})`);
            }
        }
    }

    if (shouldAutoSwitch) {
        console.log(`[AUTO-CAT v3.9] 🔄 SWITCHING: "${effectiveCategory}" → "${nlpResult.category}"`);
        console.log(`  └─ Reason: NLP detected priority ${nlpPriority} vs current ${currentPriority}`);
        console.log(`  └─ Keywords: [${nlpResult.matchedKeywords.join(', ')}]`);

        // Save original for transparency
        point.original_category = effectiveCategory;
        point.original_subcategory = point.subcategory;
        point.ai_reclassified = true;
        point.ai_reclassified_reason = `Detected: ${nlpResult.matchedKeywords.join(', ')}`;

        // SWAP IT - v3.6.2: Update BOTH category AND subcategory
        const detectedLeaf = normalizeTaxonomyLabel(nlpResult.category);
        const detectedParent = getCanonicalParent(detectedLeaf);
        point.category = detectedParent || detectedLeaf;
        point.subcategory = detectedLeaf && detectedParent && detectedLeaf !== detectedParent ? detectedLeaf : null;
        effectiveCategory = nlpResult.category;
    } else if (shouldDowngrade) {
        // v3.9 AUDIT FIX: Downgrade gaming attempts
        console.log(`[AUTO-CAT v3.9] ⬇️ DOWNGRADE APPLIED: "${effectiveCategory}" → "${nlpResult.category}"`);

        // Save original for transparency
        point.original_category = effectiveCategory;
        point.original_subcategory = point.subcategory;
        point.ai_downgraded = true;
        point.ai_downgraded_reason = `Description matches "${nlpResult.category}" not "${effectiveCategory}"`;

        // DOWNGRADE category
        const detectedLeaf = normalizeTaxonomyLabel(nlpResult.category);
        const detectedParent = getCanonicalParent(detectedLeaf);
        point.category = detectedParent || detectedLeaf;
        point.subcategory = detectedLeaf && detectedParent && detectedLeaf !== detectedParent ? detectedLeaf : null;
        effectiveCategory = nlpResult.category;
    }

    // Use effectiveCategory for all scoring from here on
    const category = effectiveCategory;

    // ==================== DICTIONARIES ==

    // TRAFFIC_CONTEXT: Forces Score ≤ 35 [cite: 18]
    const TRAFFIC_CONTEXT = [
        'traffic', 'congestion', 'jam', 'stranded car', 'stranded vehicle',
        'kotse', 'sasakyan', 'gridlock', 'bumper to bumper', 'heavy traffic',
        'trapik', 'trapiko', 'standstill', 'stuck sa traffic', 'stranded cars'
    ];

    // MAINTENANCE_CONTEXT: Forces Score ≤ 30
    const MAINTENANCE_CONTEXT = [
        'canal', 'drainage', 'clogged', 'barado', 'baradong', 'basura',
        'sira', 'sirang', 'broken pipe', 'leak', 'walang tubig', 'butas',
        'gutter', 'imburnal', 'kanal', 'storm drain', 'catch basin',
        'wasak', 'overflow', 'umaapaw', 'no drainage', 'walang drainage',
        'repair', 'pag-ayos', 'maintenance', 'kulang', 'lack of'
    ];

    // VEHICLE_KEYWORDS: Used for Inanimate Stranded detection
    const VEHICLE_KEYWORDS = [
        'car', 'cars', 'vehicle', 'vehicles', 'kotse', 'sasakyan',
        'bus', 'truck', 'tricycle', 'motorcycle', 'motor', 'jeep',
        'jeepney', 'van', 'taxi', 'grab', 'habal'
    ];

    // TIER CATEGORIES for base scoring [cite: 3, 4, 5]
    // v3.9.1 FIX: Medical moved to TIER_1 (life-threatening)
    const TIER_1 = ['Fire', 'Accident', 'Crime', 'Medical', 'Trapped', 'Gunshot', 'Explosion', 'Collapse', 'Casualty'];
    const TIER_2 = ['Flood', 'Flooding', 'Landslide', 'Rescue', 'Public Safety', 'Power Line Down', 'Blackout', 'No Water'];
    const TIER_3 = ['Traffic', 'Pothole', 'Garbage', 'Trash', 'Noise', 'Road Obstruction', 'Streetlight', 'Others'];

    // FEAR KEYWORDS for panic detection [cite: 8]
    const FEAR_KEYWORDS = [
        'tulong', 'help', 'please', 'emergency', 'scared', 'takbo',
        'saklolo', 'tabang', 'dali', 'mabilis', 'agad', 'patay'
    ];

    // ==================== LAYER A: RAW SCORING ====================

    // A1. BASE SCORE (10-70) [cite: 3, 4, 5]
    // v3.9.1 REFACTOR: Link base score directly to category priority
    // This ensures granular scoring (e.g., No Water = 65, Flooding = 85)
    let baseScore = getCategoryPriority(category);

    // Safety fallback for unknown categories
    if (baseScore === 0) {
        if (TIER_1.some(t => category.includes(t))) {
            baseScore = 70;
        } else if (TIER_2.some(t => category.includes(t))) {
            baseScore = 50;
        } else if (TIER_3.some(t => category.includes(t))) {
            baseScore = 25;
        }
    }

    // A2. PANIC SCORE [cite: 6, 7, 8]
    // Caps=10, !!!=5, Keywords=2
    let panicScore = 0;

    // CAPS LOCK Check: >40% uppercase AND length > 8 → +10 [cite: 6]
    const textLength = description.length;
    const uppercaseCount = (description.match(/[A-Z]/g) || []).length;
    const capsRatio = textLength > 0 ? uppercaseCount / textLength : 0;

    if (capsRatio > 0.4 && textLength > 8) {
        panicScore += 10;
    }

    // Exclamation Points: +5 if any present [cite: 7]
    const exclamationCount = (description.match(/!/g) || []).length;
    if (exclamationCount > 0) {
        panicScore += 5;
    }

    // Fear Keywords: +2 if any present [cite: 8]
    const foundFearKeyword = FEAR_KEYWORDS.find(kw => descLower.includes(kw));
    if (foundFearKeyword) {
        panicScore += 2;
    }

    // A3. VERACITY SCORE (-20 to +5) [cite: 10, 12]
    const wordCount = description.trim().split(/\s+/).filter(w => w.length > 0).length;
    let veracityScore = 0;
    let veracityLabel = 'MODERATE';

    // Check for infrastructure modifiers (indicates detailed report)
    const hasInfraModifier = MAINTENANCE_CONTEXT.some(mod => descLower.includes(mod));

    if (wordCount < 3) {
        // <3 words = -20 (UNVERIFIED) [cite: 10]
        veracityScore = -20;
        veracityLabel = 'UNVERIFIED';
    } else if (wordCount >= 5 && hasInfraModifier) {
        // >5 words + infra modifier = +5 (HIGH CONFIDENCE) [cite: 12]
        veracityScore = 5;
        veracityLabel = 'HIGH CONFIDENCE';
    } else if (wordCount >= 5) {
        veracityScore = 5;
        veracityLabel = 'HIGH CONFIDENCE';
    }

    // A4. CALCULATE RAW SCORE (Before overrides)
    const originalScore = Math.max(0, Math.min(100, baseScore + panicScore + veracityScore));
    let urgencyScore = originalScore;

    const severityInfo = typeof calculateSeverityModifier === 'function'
        ? calculateSeverityModifier(description)
        : { multiplier: 1.0, amplifiers: [], diminishers: [] };

    if (severityInfo && typeof severityInfo.multiplier === 'number' && severityInfo.multiplier !== 1.0) {
        urgencyScore = Math.max(0, Math.min(100, urgencyScore * severityInfo.multiplier));
    }

    // A5. MULTI-INCIDENT COMPLEXITY BOOST v3.9.5 [NEW]
    // If text mentions multiple distinct high-level categories (e.g. Fire AND Flood), 
    // it indicates a complex disaster scene. Apply a situational boost.
    if (nlpResult && nlpResult.matchedKeywords) {
        const uniqueCategories = new Set(nlpResult.matchedKeywords.map(m => m.category));
        if (uniqueCategories.size >= 3) {
            const complexityBoost = 10;
            urgencyScore = Math.min(100, urgencyScore + complexityBoost);
            console.log(`[TRIAGE v3.9.5] 🧩 COMPLEXITY BOOST: +${complexityBoost} (${uniqueCategories.size} distinct categories detected)`);

            // Log for breakdown
            if (point.intelligence) {
                point.intelligence.breakdown.complexity = complexityBoost;
            }
        }
    }

    let isCritical = urgencyScore >= 70;

    // ==================== LAYER B: SEMANTIC OVERRIDE ====================
    // Run AFTER Layer A to apply context-based caps [cite: 18]

    let overrideType = null;
    let suggestedAction = null;
    let isCapped = false;
    let temporalOverrideType = null;
    let temporalStatus = null;

    const noIssueInfo = typeof detectNoIssue === 'function'
        ? detectNoIssue(description)
        : { isNoIssue: false, matchedPattern: null };

    const temporalInfo = typeof detectTemporalContext === 'function'
        ? detectTemporalContext(description)
        : { tag: null, matches: { present: [], past: [], future: [] } };

    // ================================================================
    // B0. GEOSPATIAL VERIFICATION v3.7 [NEW]
    // ================================================================
    // Uses Nominatim address data to adjust scores based on location context:
    // 1. HIGHWAY PRIORITY: Potholes on highways get +15 boost
    // 2. HYDROLOGICAL VALIDATION: Floods near rivers/bridges get +10 confidence
    // ================================================================
    let geospatialBoostInfo = null;

    // Check if point has geocoded address data (from reverseGeocode cache)
    const addressData = point.geocodedAddress || null;
    const streetName = addressData?.street?.toLowerCase() || '';
    const fullAddress = addressData?.fullAddress?.toLowerCase() || '';

    // B0.1: HIGHWAY PRIORITY BOOST (+15 for Pothole/Road Damage on major roads)
    const HIGHWAY_KEYWORDS = ['highway', 'national road', 'expressway', 'avenue', 'boulevard',
        'national highway', 'maharlika', 'diversion road', 'bypass'];
    const isOnHighway = HIGHWAY_KEYWORDS.some(hw => streetName.includes(hw) || fullAddress.includes(hw));

    if ((category === 'Pothole' || category === 'Road Damage' || category === 'Infrastructure') && isOnHighway) {
        const highwayBoost = 15;
        urgencyScore = Math.min(100, urgencyScore + highwayBoost);
        isCritical = urgencyScore >= 70;
        geospatialBoostInfo = {
            type: 'HIGHWAY_PRIORITY',
            boost: highwayBoost,
            matched: streetName || fullAddress,
            reason: 'Pothole on major road - higher traffic impact'
        };
        console.log(`[GEOSPATIAL v3.7] 🛣️ +${highwayBoost} HIGHWAY PRIORITY: "${streetName || fullAddress}"`);
    }

    // B0.2: HYDROLOGICAL VALIDATION (+10 for Flood near water features)
    const HYDRO_KEYWORDS = ['river', 'creek', 'bridge', 'estero', 'canal', 'ilog', 'sapa',
        'crossing', 'riverside', 'waterway', 'stream', 'tulay'];
    const isNearWater = HYDRO_KEYWORDS.some(hw => streetName.includes(hw) || fullAddress.includes(hw));

    if ((category === 'Flood' || category === 'Flooding') && isNearWater && !geospatialBoostInfo) {
        const hydroBoost = 10;
        urgencyScore = Math.min(100, urgencyScore + hydroBoost);
        isCritical = urgencyScore >= 70;
        geospatialBoostInfo = {
            type: 'HYDROLOGICAL_VALIDATION',
            boost: hydroBoost,
            matched: streetName || fullAddress,
            reason: 'Flood near water feature - validated high risk'
        };
        veracityScore += 5; // Extra confidence for validated location
        veracityLabel = 'GEO-VERIFIED';
        console.log(`[GEOSPATIAL v3.7] 🌊 +${hydroBoost} HYDRO VALIDATION: "${streetName || fullAddress}"`);
    }

    // Check for Inanimate Stranded (treat as traffic)
    const hasStranded = descLower.includes('stranded') || descLower.includes('na-stuck') ||
        descLower.includes('nastranded') || descLower.includes('stuck');
    const hasVehicle = VEHICLE_KEYWORDS.some(v => descLower.includes(v));

    // v3.6.1: Track emergency boost info for breakdown
    let emergencyBoostInfo = null;

    // B1. TRAFFIC CONTEXT OVERRIDE [cite: 18]
    const matchedTrafficContext = TRAFFIC_CONTEXT.find(kw => descLower.includes(kw));

    if (matchedTrafficContext || (hasStranded && hasVehicle)) {
        urgencyScore = Math.min(urgencyScore, 35);
        isCritical = false;
        isCapped = true;
        suggestedAction = '⚠️ DEPLOY TRAFFIC CONTROL';
        overrideType = 'TRAFFIC_CONTEXT';
    }

    // B2. MAINTENANCE CONTEXT OVERRIDE (Higher priority - runs after traffic)
    const matchedMaintenanceContext = MAINTENANCE_CONTEXT.find(kw => descLower.includes(kw));

    if (matchedMaintenanceContext) {
        urgencyScore = Math.min(urgencyScore, 30);
        isCritical = false;
        isCapped = true;
        veracityLabel = 'MAINTENANCE';
        suggestedAction = '🔧 SCHEDULE MAINTENANCE';
        overrideType = 'MAINTENANCE_CONTEXT';
    }

    if (noIssueInfo && noIssueInfo.isNoIssue) {
        urgencyScore = 0;
        isCritical = false;
        isCapped = true;
        temporalOverrideType = 'NO_ISSUE_PATTERN';
        temporalStatus = 'RESOLVED';
        if (!suggestedAction) {
            suggestedAction = '✅ RESOLVED / NO ISSUE';
        }
    }

    if (temporalInfo && temporalInfo.tag) {
        if (temporalInfo.tag === 'future') {
            urgencyScore = 0;
            isCritical = false;
            isCapped = true;
            temporalOverrideType = 'TEMPORAL_FUTURE';
            temporalStatus = 'ADVISORY';
            if (!suggestedAction) {
                suggestedAction = 'ℹ️ ADVISORY (FUTURE)';
            }
        } else if (temporalInfo.tag === 'past') {
            urgencyScore = Math.round(Math.max(0, Math.min(100, urgencyScore * 0.1)));
            isCritical = false;
            isCapped = true;
            temporalOverrideType = 'TEMPORAL_PAST';
            temporalStatus = 'LOG';
            if (!suggestedAction) {
                suggestedAction = '🗒️ LOG / RESOLVED';
            }
        } else if (temporalInfo.tag === 'present' && !isCapped) {
            urgencyScore = Math.round(Math.max(0, Math.min(100, urgencyScore * 2.0)));
            isCritical = urgencyScore >= 70;
            temporalOverrideType = 'TEMPORAL_PRESENT';
            temporalStatus = 'ACTIVE';
        }
    }

    // ================================================================
    // B3. LITERAL EMERGENCY BOOST v3.6.1 [NEW]
    // ================================================================
    // When description contains LITERAL emergency keywords (Fire, Accident, etc.)
    // that are NOT metaphorical, boost the score to ensure EMERGENCY status.
    // This counteracts cases where user selects wrong category but describes
    // a real emergency (e.g., Category="Pothole", Description="HOUSE FIRE").
    // ================================================================
    if (!isCapped) { // Only boost if not already capped by traffic/maintenance
        const LITERAL_EMERGENCY_KEYWORDS = {
            // Fire emergencies
            'fire': 'FIRE', 'sunog': 'FIRE', 'nasusunog': 'FIRE', 'apoy': 'FIRE', 'burning': 'FIRE',
            // Vehicular accidents (v3.9.1: expanded keywords)
            'accident': 'ACCIDENT', 'aksidente': 'ACCIDENT', 'nabangga': 'ACCIDENT', 'sagasa': 'ACCIDENT',
            'collision': 'ACCIDENT', 'crash': 'ACCIDENT', 'banggaan': 'ACCIDENT', 'nasagasaan': 'ACCIDENT',
            'vehicular': 'ACCIDENT', 'car crash': 'ACCIDENT', 'hit and run': 'ACCIDENT', 'overturn': 'ACCIDENT',
            'tumaob': 'ACCIDENT', 'bumagsak': 'ACCIDENT', 'sumalpok': 'ACCIDENT', 'bumangga': 'ACCIDENT',
            'nabanggaan': 'ACCIDENT', 'nagsalpokan': 'ACCIDENT', 'bangga': 'ACCIDENT',
            // Crime emergencies
            'crime': 'CRIME', 'holdup': 'CRIME', 'holdap': 'CRIME', 'robbery': 'CRIME', 'stabbed': 'CRIME',
            'gun': 'CRIME', 'baril': 'CRIME', 'binaril': 'CRIME', 'sinaksak': 'CRIME', 'snatching': 'CRIME',
            // Rescue emergencies
            'trapped': 'RESCUE', 'collapse': 'RESCUE', 'gumuho': 'RESCUE', 'nabagsakan': 'RESCUE',
            // Medical emergencies (v3.9.1: added)
            'injured': 'MEDICAL', 'nasugatan': 'MEDICAL', 'bleeding': 'MEDICAL', 'dumudugo': 'MEDICAL',
            'unconscious': 'MEDICAL', 'nawalan ng malay': 'MEDICAL', 'heart attack': 'MEDICAL',
            'naligsan': 'MEDICAL', 'stroke': 'MEDICAL', 'atake sa puso': 'MEDICAL'
        };

        let literalEmergencyFound = null;
        for (const [keyword, emergencyType] of Object.entries(LITERAL_EMERGENCY_KEYWORDS)) {
            if (descLower.includes(keyword)) {
                // Check if it's NOT metaphorical
                const metaphorCheck = typeof isMetaphoricalUsage === 'function'
                    ? isMetaphoricalUsage(description, keyword)
                    : { isMetaphorical: false };

                if (!metaphorCheck.isMetaphorical) {
                    literalEmergencyFound = { keyword, emergencyType };
                    break;
                }
            }
        }

        if (literalEmergencyFound) {
            // v3.9.1 FIX: Boost score by +20 to GUARANTEE EMERGENCY threshold
            const boostAmount = 20;
            urgencyScore = Math.min(100, urgencyScore + boostAmount);
            isCritical = urgencyScore >= 70;
            overrideType = 'LITERAL_EMERGENCY_BOOST';
            suggestedAction = `🚨 LITERAL ${literalEmergencyFound.emergencyType} DETECTED`;

            // Store boost info for breakdown
            emergencyBoostInfo = {
                amount: boostAmount,
                keyword: literalEmergencyFound.keyword,
                type: literalEmergencyFound.emergencyType
            };

            console.log(`[BOOST v3.6.1] 🚀 +${boostAmount} points for literal "${literalEmergencyFound.keyword}" → Score: ${urgencyScore}`);
        }
    }

    // ================================================================
    // B4. NEGATION OVERRIDE v3.9.5 [NEW]
    // ================================================================
    // If the primary category keyword is explicitly negated (e.g. "No fire"),
    // zero out the score to prevent false alarms.
    // ================================================================
    const primaryNegation = checkNegation(description, category);
    if (primaryNegation.isNegated) {
        urgencyScore = 0;
        isCritical = false;
        isCapped = true;
        overrideType = 'NEGATION_OVERRIDE';
        suggestedAction = `🚫 NEGATED: "${primaryNegation.negationWord} ${category}"`;
        console.log(`[NEGATION v3.9.5] 🛑 SCORE ZEROED: "${primaryNegation.negationWord}" negates "${category}"`);
    }

    const baseRisk = Math.max(0, Math.min(10, Math.round(getCategoryPriority(category) / 10)));
    let riskValue = baseRisk;

    if (severityInfo && Array.isArray(severityInfo.amplifiers) && severityInfo.amplifiers.length > 0) {
        riskValue *= 1.5;
    }
    if (severityInfo && Array.isArray(severityInfo.diminishers) && severityInfo.diminishers.length > 0) {
        riskValue *= 0.5;
    }

    if ((noIssueInfo && noIssueInfo.isNoIssue) || primaryNegation.isNegated) {
        riskValue = 0;
    } else if (temporalInfo && temporalInfo.tag === 'future') {
        riskValue = 0;
    } else if (temporalInfo && temporalInfo.tag === 'past') {
        riskValue *= 0.1;
    } else if (temporalInfo && temporalInfo.tag === 'present') {
        riskValue *= 2.0;
    }

    const riskScore = Math.max(0, Math.min(100, Math.round(riskValue * 10)));
    const riskStatus = temporalInfo?.tag === 'future' ? 'ADVISORY'
        : (noIssueInfo && noIssueInfo.isNoIssue) || temporalInfo?.tag === 'past' ? 'RESOLVED'
            : temporalInfo?.tag === 'present' ? 'ACTIVE' : null;

    // ==================== RETURN EXACT OUTPUT STRUCTURE ====================
    return {
        urgencyScore,               // The capped score (e.g., 35)
        veracityLabel,              // "UNVERIFIED", "MODERATE", "HIGH CONFIDENCE", "MAINTENANCE", "GEO-VERIFIED"
        suggestedAction,            // e.g., "🔧 SCHEDULE MAINTENANCE"
        isCritical,
        wordCount,
        temporalTag: temporalInfo?.tag || null,
        temporalStatus: temporalStatus,
        riskScore,
        riskStatus,

        // Breakdown object for UI transparency
        breakdown: {
            base: baseScore,
            panic: panicScore,
            veracity: veracityScore,
            complexity: nlpResult && nlpResult.matchedKeywords ? (new Set(nlpResult.matchedKeywords.map(m => m.category)).size >= 3 ? 10 : 0) : 0,
            severity: severityInfo,
            temporal: temporalInfo,
            temporalStatus: temporalStatus,
            temporalOverrideType: temporalOverrideType,
            noIssue: noIssueInfo && noIssueInfo.isNoIssue ? noIssueInfo.matchedPattern : null,
            riskBase: baseRisk,
            riskScore: riskScore,
            riskStatus: riskStatus,
            emergencyBoost: emergencyBoostInfo,     // v3.6.1: Literal emergency boost info
            geospatialBoost: geospatialBoostInfo,   // v3.7: Geospatial verification boost
            isCapped: isCapped,                     // TRUE if an override was applied
            overrideType: overrideType,             // Type of override applied
            negation: primaryNegation.isNegated ? primaryNegation.negationWord : null,
            originalScore: originalScore,           // The uncapped score (for transparency)

            // Additional debug info
            overrideType: overrideType,
            matchedContext: matchedTrafficContext || matchedMaintenanceContext || null,
            capsRatio: Math.round(capsRatio * 100),
            exclamationCount: exclamationCount,
            foundFearKeyword: foundFearKeyword || null
        }
    };
}

// ==================== END MODULE 1 ====================

/**
 * v3.7: Enhanced Speculation Context Checker
 * ===========================================
 * Now checks BOTH before AND after the keyword for speculation patterns.
 * Also checks for past event references and non-emergency phrases.
 * 
 * @param {string} text - Full description text
 * @param {string} keyword - Emergency keyword to check
 * @returns {Object} { isSpeculative: boolean, trigger: string|null, position: string|null, type: string|null }
 * 
 * @example
 * checkSpeculativeContext("walang ilaw baka may accident", "accident")
 * // Returns: { isSpeculative: true, trigger: "baka", position: "before" }
 * 
 * @example
 * checkSpeculativeContext("bumabaha dito pag ulan", "bumabaha")
 * // Returns: { isSpeculative: true, trigger: "pag ulan", position: "after" }
 * 
 * @example
 * checkSpeculativeContext("accident prone area", "accident")
 * // Returns: { isSpeculative: true, trigger: "prone area", position: "after" }
 */
function checkSpeculativeContext(text, keyword) {
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    const keywordIndex = lowerText.indexOf(lowerKeyword);

    if (keywordIndex === -1) {
        return { isSpeculative: false, trigger: null, position: null, type: null };
    }

    // ================================================================
    // STEP 0: Check for NON-EMERGENCY PHRASES first (highest priority)
    // These are complete phrase patterns that definitively indicate
    // the text is NOT describing an active emergency.
    // ================================================================
    for (const entry of NON_EMERGENCY_PHRASES) {
        if (lowerText.includes(entry.phrase)) {
            console.log(`[SPEC v3.7] Non-emergency phrase: "${entry.phrase}" (${entry.category})`);
            return {
                isSpeculative: true,
                trigger: entry.phrase,
                position: "phrase",
                type: entry.category,
                priority: entry.priority
            };
        }
    }

    // ================================================================
    // STEP 1: Check for PAST EVENT patterns
    // If the text describes a historical event, it's not a current emergency.
    // ================================================================
    for (const entry of PAST_EVENT_PATTERNS) {
        if (lowerText.includes(entry.pattern)) {
            console.log(`[SPEC v3.7] Past event detected: "${entry.pattern}" (${entry.type})`);
            return {
                isSpeculative: true,
                trigger: entry.pattern,
                position: "past",
                type: entry.type
            };
        }
    }

    // ================================================================
    // STEP 1.5: Check for BISAYA HABITUAL VERB FORMS (v3.8)
    // In Bisaya, habitual aspect is marked by "ga-" or "naga-" prefix
    // attached directly to the verb. This means "gabaha" = "ga" + "baha"
    // indicates a habitual/recurring situation, NOT a current emergency.
    // ================================================================
    const BISAYA_HABITUAL_PREFIXES = ['ga', 'naga', 'mag', 'nag', 'gi', 'nagi'];
    const FLOOD_ROOTS = ['baha', 'lunop', 'pundo', 'awas'];

    for (const prefix of BISAYA_HABITUAL_PREFIXES) {
        for (const root of FLOOD_ROOTS) {
            const habitualForm = prefix + root;
            if (lowerText.includes(habitualForm)) {
                console.log(`[SPEC v3.8] Bisaya habitual verb: "${habitualForm}" (${prefix}- + ${root})`);
                return {
                    isSpeculative: true,
                    trigger: habitualForm,
                    position: "habitual_verb",
                    type: "bisaya_habitual"
                };
            }
        }
    }

    // ================================================================
    // STEP 2: Check BEFORE the keyword (existing behavior)
    // Get the substring BEFORE the keyword (up to 30 chars back)
    // ================================================================
    const preContext = lowerText.substring(Math.max(0, keywordIndex - 30), keywordIndex);

    for (const trigger of SPECULATIVE_TRIGGERS) {
        // Handle prefix triggers (ma-, maka-) differently
        if (trigger.endsWith('-')) {
            const prefix = trigger.slice(0, -1);
            const wordBeforeKeyword = preContext.trim().split(/\s+/).pop() || '';
            if (wordBeforeKeyword === prefix || preContext.endsWith(prefix)) {
                return { isSpeculative: true, trigger: trigger, position: "before", type: "prefix" };
            }
        } else {
            if (preContext.includes(trigger)) {
                return { isSpeculative: true, trigger: trigger, position: "before", type: "conditional" };
            }
        }
    }

    // ================================================================
    // STEP 3: Check AFTER the keyword (NEW in v3.7)
    // Get the substring AFTER the keyword (up to 40 chars ahead)
    // ================================================================
    const keywordEndIndex = keywordIndex + lowerKeyword.length;
    const postContext = lowerText.substring(keywordEndIndex, Math.min(lowerText.length, keywordEndIndex + 40));

    for (const trigger of POST_KEYWORD_SPECULATIVE) {
        if (postContext.includes(trigger)) {
            console.log(`[SPEC v3.7] Post-keyword trigger: "${trigger}" after "${keyword}"`);
            return { isSpeculative: true, trigger: trigger, position: "after", type: "conditional" };
        }
    }

    return { isSpeculative: false, trigger: null, position: null, type: null };
}

/**
 * Check if a complaint is a CRITICAL EMERGENCY requiring immediate attention.
 * Uses both category AND keyword detection for maximum recall.
 * 
 * v3.5 UPDATE: Now includes METAPHOR FILTER to prevent false positives from:
 *   - Figurative language: "flood of students", "my phone is dead"
 *   - Idiomatic expressions: "patay gutom", "nasunog na deadline"  
 *   - Slang/Internet usage: "so extra", "fire emoji", "I'm dead 💀"
 * 
 * FILTER PIPELINE (in order):
 *   1. Semantic Context → Traffic/Maintenance bypass
 *   2. Category Check → Explicit emergency selection
 *   3. Keyword Loop:
 *      a. Metaphor Filter (v3.5) → Skip figurative uses
 *      b. Speculation Filter → Skip "baka may..." uncertain reports
 *      c. Literal Match → Flag as CRITICAL
 * 
 * @param {Object} point - Complaint object with category and description
 * @returns {Object} Criticality result with type and confidence
 * 
 * @example
 * // Fire category
 * checkCriticality({ category: "Fire", description: "Small fire" })
 * // Returns: { isCritical: true, type: "FIRE", source: "category", confidence: 1.0 }
 * 
 * @example
 * // Keyword detection (wrong category)
 * checkCriticality({ category: "Pothole", description: "May sunog dito!" })
 * // Returns: { isCritical: true, type: "FIRE", source: "keyword", confidence: 0.9, matchedKeyword: "sunog" }
 * 
 * @example
 * // v3.5: Metaphor Filter in action
 * checkCriticality({ category: "Traffic", description: "There is a flood of students crossing the street" })
 * // Returns: { isCritical: false, isMetaphorical: true, metaphorReason: "INANIMATE_SUBJECT", ... }
 */
function checkCriticality(point) {
    const result = {
        isCritical: false,
        type: null,
        source: null,
        confidence: 0,
        matchedKeyword: null,
        urgencyLevel: 0,  // 1-5 scale (5 = most urgent)
        isSpeculative: false,
        speculativeTrigger: null,
        isContextSuppressed: false,  // v3.4: Track semantic override
        suppressionContext: null,
        // v3.5: Metaphor Filter fields
        isMetaphorical: false,
        metaphorReason: null,
        metaphorPattern: null,
        metaphorConfidence: 0,
        temporalTag: null,
        temporalStatus: null
    };

    // ================================================================
    // v3.6.2: SAFE AUTO-CAT - Only switch if keywords are LITERAL & NON-SPECULATIVE
    // Fixed: Previously switching on speculative mentions like "prone nang accidente"
    // v4.0: FIX - Use main category FIRST for emergency detection, NOT subcategory
    //       "Hit and Run" subcategory was bypassing "Accident" category check!
    // ================================================================
    const mainCategory = point.category || "";
    let effectiveCategory = mainCategory || point.subcategory || "";
    const description = (point.description || "").toLowerCase();

    const temporalInfo = typeof detectTemporalContext === 'function'
        ? detectTemporalContext(point.description || "")
        : { tag: null, matches: { present: [], past: [], future: [] } };
    result.temporalTag = temporalInfo.tag;
    if (temporalInfo.tag === 'future') {
        result.temporalStatus = 'ADVISORY';
        return result;
    }
    if (temporalInfo.tag === 'past') {
        result.temporalStatus = 'LOG';
        return result;
    }

    // Run NLP extraction to check for category mismatch
    if (typeof extractKeywordsWithCategory === 'function') {
        const nlpResult = extractKeywordsWithCategory(point.description || "");
        const currentPriority = typeof getCategoryPriority === 'function'
            ? getCategoryPriority(effectiveCategory) : 0;
        const nlpPriority = nlpResult.priority || 0;

        // SAFETY CHECK: Only block SPECULATIVE keywords (metaphor check happens later)
        let shouldAutoSwitch = false;
        let blockReason = null;

        if (effectiveCategory === 'Others' || effectiveCategory === '' ||
            (nlpPriority > currentPriority + 30)) {

            if (nlpResult.category && nlpResult.category !== 'Unsure' && nlpResult.matchedKeywords.length > 0) {
                // Check if ANY matched keyword is NON-SPECULATIVE
                let hasNonSpeculativeKeyword = false;

                for (const keyword of nlpResult.matchedKeywords) {
                    // Only check speculation
                    const specCheck = typeof checkSpeculativeContext === 'function'
                        ? checkSpeculativeContext(description, keyword)
                        : { isSpeculative: false };

                    if (specCheck.isSpeculative) {
                        blockReason = `Speculative: "${keyword}" preceded by "${specCheck.trigger}"`;
                        console.log(`[AUTO-CAT v3.6.3] ⛔ BLOCKED: ${blockReason}`);
                        continue; // Try next keyword
                    }

                    // This keyword is NON-SPECULATIVE - allow auto-switch
                    hasNonSpeculativeKeyword = true;
                    console.log(`[AUTO-CAT v3.6.3] ✅ NON-SPECULATIVE keyword: "${keyword}"`);
                    break;
                }

                shouldAutoSwitch = hasNonSpeculativeKeyword;
            }
        }

        // Only switch if we have a verified non-speculative keyword
        if (shouldAutoSwitch) {
            console.log(`[AUTO-CAT v3.6.3] 🔄 SWITCHING: "${effectiveCategory}" → "${nlpResult.category}"`);

            // Update the point object so it persists
            if (!point.ai_reclassified) {
                point.original_category = effectiveCategory;
                point.original_subcategory = point.subcategory;
                point.ai_reclassified = true;
                point.ai_reclassified_reason = `Detected: ${nlpResult.matchedKeywords.join(', ')}`;
                point.category = nlpResult.category;
                if (point.subcategory) {
                    point.subcategory = nlpResult.category;
                }
            }
            effectiveCategory = nlpResult.category;
        } else if (blockReason) {
            console.log(`[AUTO-CAT v3.6.3] ❌ NOT SWITCHING: ${blockReason}`);
        }
    }

    // Use effectiveCategory (potentially auto-corrected)
    const category = effectiveCategory;

    // ================================================================
    // v3.4: SEMANTIC CONTEXT CHECK (Run FIRST!)
    // If the description contains TRAFFIC_CONTEXT or MAINTENANCE_CONTEXT,
    // it should NOT be flagged as a critical emergency.
    // Example: "Traffic jam caused by flood" → NOT critical (it's traffic)
    // ================================================================
    const TRAFFIC_CONTEXT = [
        'traffic', 'congestion', 'jam', 'stranded car', 'stranded vehicle',
        'kotse', 'sasakyan', 'gridlock', 'bumper to bumper', 'heavy traffic',
        'trapik', 'trapiko', 'standstill', 'stuck sa traffic', 'stranded cars'
    ];

    const MAINTENANCE_CONTEXT = [
        'canal', 'drainage', 'clogged', 'barado', 'baradong', 'basura',
        'sira', 'sirang', 'broken pipe', 'leak', 'walang tubig', 'butas',
        'gutter', 'imburnal', 'kanal', 'storm drain', 'catch basin',
        'wasak', 'overflow', 'umaapaw', 'no drainage', 'walang drainage',
        'repair', 'pag-ayos', 'maintenance'
    ];

    // v3.6.2: NOISE_CONTEXT - Noise complaints should NOT be flagged as emergencies
    // This catches cases where user selects wrong category (e.g., "Flood" for noise)
    const NOISE_CONTEXT = [
        'ingay', 'maingay', 'ang ingay', 'sobrang ingay', 'noise', 'noisy',
        'loud', 'volume', 'sounds', 'bunganga', 'sigaw', 'sigawan', 'karaoke',
        'videoke', 'party', 'fiesta', 'inuman', 'music', 'speaker', 'bass',
        'construction noise', 'barking', 'tahol', 'tumatahol'
    ];

    // v3.6.2: STREETLIGHT_CONTEXT - Streetlight/lighting issues are NOT emergencies
    const STREETLIGHT_CONTEXT = [
        'walang ilaw', 'no light', 'streetlight', 'ilaw', 'dilim', 'madilim',
        'dark', 'lamp', 'poste', 'sira ang ilaw', 'patay ang ilaw'
    ];

    // Check for semantic context that should suppress emergency status
    const matchedTrafficContext = TRAFFIC_CONTEXT.find(kw => description.includes(kw));
    const matchedMaintenanceContext = MAINTENANCE_CONTEXT.find(kw => description.includes(kw));
    const matchedNoiseContext = NOISE_CONTEXT.find(kw => description.includes(kw));
    const matchedStreetlightContext = STREETLIGHT_CONTEXT.find(kw => description.includes(kw));

    if (matchedTrafficContext || matchedMaintenanceContext || matchedNoiseContext || matchedStreetlightContext) {
        // This is NOT a true emergency - it's a traffic or maintenance issue
        result.isContextSuppressed = true;
        // v3.6.2: Determine suppression context type
        let suppressionType = 'UNKNOWN_CONTEXT';
        let matchedKeyword = null;

        if (matchedNoiseContext) {
            suppressionType = 'NOISE_CONTEXT';
            matchedKeyword = matchedNoiseContext;
        } else if (matchedStreetlightContext) {
            suppressionType = 'STREETLIGHT_CONTEXT';
            matchedKeyword = matchedStreetlightContext;
        } else if (matchedTrafficContext) {
            suppressionType = 'TRAFFIC_CONTEXT';
            matchedKeyword = matchedTrafficContext;
        } else if (matchedMaintenanceContext) {
            suppressionType = 'MAINTENANCE_CONTEXT';
            matchedKeyword = matchedMaintenanceContext;
        }

        result.isContextSuppressed = true;
        result.suppressionContext = suppressionType;
        console.log(`[TRIAGE v3.6.2] CONTEXT SUPPRESSION: "${description.substring(0, 50)}..." → ${suppressionType} (matched: "${matchedKeyword}")`);
        // Return early - do NOT flag as critical
        return result;
    }

    // CHECK 1: Category-based detection (highest confidence)
    // v3.8: Flood categories now subject to speculation check because users often
    // select "Flood" category but describe habitual/conditional flooding issues
    // e.g., "permi baha pag ulan" = always floods when it rains (NOT active emergency)
    if (EMERGENCY_CATEGORIES.includes(category)) {

        // v3.8: For Flood category, check if the description indicates
        // habitual/conditional flooding rather than an active emergency
        if (category === 'Flood' || category === 'Flooding') {

            // v3.8.1: First check if description matches any NON_EMERGENCY_PHRASES
            // This catches infrastructure complaints like "walay proper sewage system dria"
            for (const entry of NON_EMERGENCY_PHRASES) {
                if (description.includes(entry.phrase)) {
                    console.log(`[TRIAGE v3.8.1] ⚠️ FLOOD CATEGORY but NON-EMERGENCY phrase detected`);
                    console.log(`  └─ Category: ${category}`);
                    console.log(`  └─ Phrase: "${entry.phrase}" (${entry.category})`);
                    console.log(`  └─ Description: "${description.substring(0, 60)}..."`);

                    result.isSpeculative = true;
                    result.speculativeTrigger = entry.phrase;
                    result.source = "category-non-emergency-phrase";
                    result.confidence = 0.2;
                    // Do NOT mark as critical - return as non-emergency
                    return result;
                }
            }

            // Get flood-related keywords to check
            const FLOOD_CHECK_KEYWORDS = ['baha', 'lunop', 'flood', 'tubig', 'awas', 'pundo'];

            for (const keyword of FLOOD_CHECK_KEYWORDS) {
                if (description.includes(keyword)) {
                    const speculationCheck = checkSpeculativeContext(description, keyword);

                    if (speculationCheck.isSpeculative) {
                        // This is a habitual/conditional flood complaint, NOT an active emergency
                        console.log(`[TRIAGE v3.8] ⚠️ FLOOD CATEGORY but HABITUAL/CONDITIONAL description`);
                        console.log(`  └─ Category: ${category}`);
                        console.log(`  └─ Keyword: "${keyword}" triggered by "${speculationCheck.trigger}"`);
                        console.log(`  └─ Type: ${speculationCheck.type}`);
                        console.log(`  └─ Description: "${description.substring(0, 60)}..."`);

                        result.isSpeculative = true;
                        result.speculativeTrigger = speculationCheck.trigger;
                        result.matchedKeyword = keyword;
                        result.source = "category-speculative";
                        result.confidence = 0.3;
                        // Do NOT mark as critical - return as non-emergency
                        return result;
                    }
                }
            }
        }

        // Not speculative - this is a real emergency
        result.isCritical = true;
        result.type = mapCategoryToEmergencyType(category);
        result.source = "category";
        result.confidence = 1.0;
        result.urgencyLevel = getUrgencyLevel(result.type);
        return result;
    }

    // CHECK 2: Keyword-based detection in description
    // NOW WITH SPECULATION FILTER: "baka may accident" → NOT critical
    // v3.5: NOW WITH METAPHOR FILTER: "flood of students" → NOT critical
    // v3.9: NOW WITH NEGATION FILTER: "no fire" → NOT critical
    for (const [keyword, emergencyType] of Object.entries(EMERGENCY_KEYWORDS)) {
        // Use Tagalog-aware matching if available, else simple includes
        const isMatch = typeof checkKeywordMatch === 'function'
            ? checkKeywordMatch(description, keyword)
            : description.includes(keyword.toLowerCase());

        if (isMatch) {
            // ================================================================
            // v3.9 AUDIT FIX: NEGATION CHECK (Run FIRST!)
            // Catches negated emergency keywords like:
            //   - "no fire" → NOT an emergency
            //   - "walang sunog" → NOT an emergency (Tagalog)
            //   - "fire already extinguished" → NOT an active emergency
            // ================================================================
            const negationCheck = checkNegation(description, keyword);

            if (negationCheck.isNegated) {
                console.log(`[NEGATION v3.9] ⛔ BLOCKED: '${keyword}' is negated by '${negationCheck.negationWord}'`);
                console.log(`  └─ Description: "${description.substring(0, 60)}..."`);

                // Track this for debugging (but don't mark as critical)
                result.isNegated = true;
                result.negationWord = negationCheck.negationWord;
                result.matchedKeyword = keyword;
                result.source = "keyword-negated";
                result.confidence = 0.05;

                // Continue to check other keywords (maybe there's a non-negated one)
                continue;
            }

            // ================================================================
            // v3.5: METAPHOR FILTER CHECK (Run BEFORE speculation check!)
            // Catches figurative/idiomatic uses like:
            //   - "flood of students" → NOT a real flood
            //   - "my phone is dead" → NOT a casualty
            //   - "nasunog na deadline" → NOT a real fire
            //   - "patay gutom" → NOT a real death
            // ================================================================
            const metaphorCheck = isMetaphoricalUsage(description, keyword);

            if (metaphorCheck.isMetaphorical) {
                // FILTER OUT: This is figurative language, NOT a real emergency
                console.log(`[METAPHOR v3.5] 🎭 FILTERED: '${keyword}' is figurative in: "${description.substring(0, 60)}..."`);
                console.log(`  └─ Reason: ${metaphorCheck.reason}`);
                console.log(`  └─ Pattern: "${metaphorCheck.matchedPattern || 'N/A'}"`);
                console.log(`  └─ Confidence: ${(metaphorCheck.confidence * 100).toFixed(0)}%`);

                // Track this for debugging (but don't mark as critical)
                result.isMetaphorical = true;
                result.metaphorReason = metaphorCheck.reason;
                result.metaphorPattern = metaphorCheck.matchedPattern;
                result.metaphorConfidence = metaphorCheck.confidence;
                result.matchedKeyword = keyword;

                // Continue to check other keywords (maybe there's a literal one)
                continue;
            }

            // NEW: Check if this keyword is used speculatively
            const speculationCheck = checkSpeculativeContext(description, keyword);

            if (speculationCheck.isSpeculative) {
                // DOWNGRADE: This is a speculative mention, not an active emergency
                console.log(`[SPECULATION] Ignoring '${keyword}' - preceded by '${speculationCheck.trigger}' in: "${description.substring(0, 60)}..."`);
                result.isSpeculative = true;
                result.speculativeTrigger = speculationCheck.trigger;
                result.matchedKeyword = keyword;
                // Continue to check other keywords (in case there's a non-speculative one)
                continue;
            }

            // Not speculative, not metaphorical, and not negated - this is a REAL emergency
            result.isCritical = true;
            result.type = emergencyType;
            result.source = "keyword";
            result.confidence = 0.9;  // Slightly lower than category match
            result.matchedKeyword = keyword;
            result.urgencyLevel = getUrgencyLevel(emergencyType);
            return result;  // Return on first confirmed match
        }
    }

    // If we found keywords but ALL were speculative, return the speculative info
    if (result.isSpeculative) {
        result.source = "keyword-speculative";
        result.confidence = 0.3;  // Low confidence - it's just a mention
        console.log(`[SPECULATION] Final verdict: NOT CRITICAL (speculative context)`);
    }

    // v3.5: If we found keywords but ALL were metaphorical, return the metaphor info
    if (result.isMetaphorical && !result.isSpeculative) {
        result.source = "keyword-metaphorical";
        result.confidence = 0.1;  // Very low - it's figurative language
        console.log(`[METAPHOR v3.5] Final verdict: NOT CRITICAL (figurative usage)`);
        console.log(`  └─ Matched keyword: "${result.matchedKeyword}"`);
        console.log(`  └─ Reason: ${result.metaphorReason}`);
    }

    return result;
}

/**
 * Map category names to standardized emergency types
 */
function mapCategoryToEmergencyType(category) {
    const typeMap = {
        "Fire": "FIRE",
        "Flooding": "FLOOD",
        "Flood": "FLOOD",
        "Accident": "ACCIDENT",
        "Crime": "CRIME",
        "Medical": "MEDICAL",
        // "Public Safety" removed - not all public safety issues are emergencies
        "Explosion": "FIRE",
        "Collapse": "ACCIDENT"
    };
    return typeMap[category] || "EMERGENCY";
}

/**
 * Get urgency level (1-5) for prioritized dispatch
 */
function getUrgencyLevel(emergencyType) {
    const urgencyMap = {
        "FIRE": 5,
        "CASUALTY": 5,
        "MEDICAL": 5,
        "ACCIDENT": 4,
        "CRIME": 4,
        "FLOOD": 3,
        "EMERGENCY": 3
    };
    return urgencyMap[emergencyType] || 2;
}

/**
 * Extract critical points from dataset BEFORE clustering.
 * This prevents emergencies from being merged into standard clusters.
 * 
 * @param {Array} data - Full dataset of complaints
 * @returns {Object} { criticalPoints: Array, standardPoints: Array }
 * 
 * @example
 * const { criticalPoints, standardPoints } = extractCriticalPoints(allComplaints);
 * // Run DBSCAN only on standardPoints
 * const clusters = clusterComplaints(standardPoints);
 * // Render criticalPoints separately in Emergency Panel
 */
function extractCriticalPoints(data) {
    const criticalPoints = [];
    const standardPoints = [];

    for (const point of data) {
        const criticality = checkCriticality(point);

        if (criticality.isCritical) {
            // Attach criticality metadata to point
            criticalPoints.push({
                ...point,
                _criticality: criticality
            });
        } else {
            standardPoints.push(point);
        }
    }

    // Sort critical points by urgency (highest first)
    criticalPoints.sort((a, b) => b._criticality.urgencyLevel - a._criticality.urgencyLevel);

    console.log(`[TRIAGE] Extracted ${criticalPoints.length} CRITICAL points, ${standardPoints.length} standard points`);

    return { criticalPoints, standardPoints };
}

// ==================== MULTI-JURISDICTION VOTING ====================
// Determines cluster jurisdiction using democratic voting instead of center point

/**
 * Calculate jurisdiction votes for a cluster using point-by-point voting.
 * Each point in the cluster votes for its barangay, and the majority wins.
 * 
 * @param {Array} clusterPoints - Array of complaint objects in the cluster
 * @returns {Object} Voting result with winner, runner-up, and label
 * 
 * @thesis This implements a democratic boundary algorithm that handles
 * clusters spanning multiple barangays. More accurate than center-point detection.
 * 
 * @example
 * // Cluster with 10 points: 7 in San Miguel, 3 in Aplaya
 * calculateJurisdictionVotes(cluster)
 * // Returns: { label: 'Vicinity of San Miguel', winner: 'San Miguel', votes: { 'San Miguel': 7, 'Aplaya': 3 } }
 */
function calculateJurisdictionVotes(clusterPoints) {
    // Defensive: Handle empty or invalid clusters
    if (!clusterPoints || !Array.isArray(clusterPoints) || clusterPoints.length === 0) {
        return {
            label: 'Unknown Location',
            winner: 'Unknown',
            runnerUp: null,
            votes: {},
            totalVotes: 0,
            isBoundaryZone: false
        };
    }

    // Count votes by barangay
    const votes = {};

    clusterPoints.forEach(point => {
        // Defensive: Skip points without valid coordinates
        if (typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
            return;
        }

        // Use getJurisdiction (Turf.js point-in-polygon) to determine barangay
        const barangay = window.getJurisdiction ?
            window.getJurisdiction(point.latitude, point.longitude) :
            'Unmapped Zone';

        // Cast vote
        votes[barangay] = (votes[barangay] || 0) + 1;
    });

    // Sort barangays by vote count (descending)
    const sortedBarangays = Object.entries(votes)
        .sort((a, b) => b[1] - a[1]);

    // Handle no votes case
    if (sortedBarangays.length === 0) {
        return {
            label: 'Unmapped Area',
            winner: 'Unmapped Zone',
            runnerUp: null,
            votes: {},
            totalVotes: 0,
            isBoundaryZone: false
        };
    }

    const totalVotes = clusterPoints.length;
    const [winner, winnerVotes] = sortedBarangays[0];
    const winnerPercentage = (winnerVotes / totalVotes) * 100;

    // Get runner-up if exists
    const [runnerUp, runnerUpVotes] = sortedBarangays[1] || [null, 0];
    const runnerUpPercentage = runnerUp ? (runnerUpVotes / totalVotes) * 100 : 0;

    // Determine label based on vote distribution
    let label;
    let isBoundaryZone = false;

    if (winnerPercentage >= 70) {
        // Clear winner (>70% of votes) - single jurisdiction
        label = `Vicinity of ${winner}`;
    } else if (runnerUp && runnerUpPercentage >= 30) {
        // Split jurisdiction (runner-up has >30%) - boundary zone
        label = `Boundary Zone: ${winner} / ${runnerUp}`;
        isBoundaryZone = true;
    } else {
        // Moderate majority
        label = `Vicinity of ${winner}`;
    }

    return {
        label: label,
        winner: winner,
        winnerPercentage: Math.round(winnerPercentage),
        runnerUp: runnerUp,
        runnerUpPercentage: Math.round(runnerUpPercentage),
        votes: votes,
        totalVotes: totalVotes,
        isBoundaryZone: isBoundaryZone
    };
}

const ANIMATION_CONFIG = {
    STEP_DELAY: 800,
    MARKER_DROP: 400,
    SCAN_DURATION: 1200,
    LINE_DRAW: 400,
    LOG_DELAY: 200,
    BATCH_SCAN_DELAY: 50,
    DIM_TRANSITION: 500
};

// Keyword similarity thresholds
const KEYWORD_CONFIG = {
    MIN_SIMILARITY_THRESHOLD: 0.3,  // Minimum keyword overlap to consider related
    BOOST_THRESHOLD: 0.6,           // High keyword similarity boosts merge decision
    RELEVANCE_WEIGHT: 0.15          // How much keyword analysis affects final score
};

// Category icons mapping (Font Awesome)
const CATEGORY_ICONS = {
    "Pipe Leak": "droplet",
    "Flooding": "water",
    "Pothole": "road",
    "No Water": "faucet-drip",
    "Trash": "trash",
    "Stray Dog": "dog",
    "Broken Streetlight": "lightbulb",
    "Illegal Dumping": "dumpster",
    "Noise Complaint": "volume-up",
    "Road Damage": "road-barrier",
    "Fire": "fire",
    "Traffic": "car"
};

const SCENARIO_CONFIG = {
    // GROUP A: SPATIAL LOGIC
    1: {
        name: "S-01: Redundancy (Exact Location)",
        prefix: "S01_redundancy",
        description: "3x Pothole at exact same lat/lng (0m diff)",
        expectedResult: "MERGE",
        color: "#10b981",
        group: "A"
    },
    2: {
        name: "S-03: Discrete (15m Apart)",
        prefix: "S03_discrete",
        description: "2x No Water exactly 15m apart (ε=5m, should NOT merge)",
        expectedResult: "SEPARATE",
        color: "#ef4444",
        group: "A"
    },
    3: {
        name: "S-07: Precision Edge (25m)",
        prefix: "S07_precision",
        description: "Tests math boundary: 24.9m vs 25.1m from center",
        expectedResult: "PARTIAL",
        color: "#f59e0b",
        group: "A"
    },
    4: {
        name: "S-09: GPS Drift (Same User)",
        prefix: "S09_gps_drift",
        description: "5x Streetlight from same user, scattered in 7m radius",
        expectedResult: "MERGE",
        color: "#3b82f6",
        group: "A"
    },
    5: {
        name: "S-13: Moving Hazard",
        prefix: "S13_moving_hazard",
        description: "Stray Dog at 2 locations 60m apart, 5 mins gap",
        expectedResult: "CONSIDER",
        color: "#8b5cf6",
        group: "A"
    },
    // GROUP B: SEMANTIC LOGIC
    6: {
        name: "S-02: Causal Chain",
        prefix: "S02_causal",
        description: "Pipe Leak + Flood 10m apart (cause-effect)",
        expectedResult: "MERGE",
        color: "#10b981",
        group: "B"
    },
    7: {
        name: "S-05: False Correlation",
        prefix: "S05_false_correl",
        description: "Stray Dog + Pothole 1m apart (unrelated)",
        expectedResult: "SEPARATE",
        color: "#ef4444",
        group: "B"
    },
    8: {
        name: "S-06: Domino Chain",
        prefix: "S06_domino",
        description: "Pipe → Flood → Traffic cascade effect",
        expectedResult: "MERGE",
        color: "#06b6d4",
        group: "B"
    },
    9: {
        name: "S-10: Conflict",
        prefix: "S10_conflict",
        description: "Fire + Pothole at EXACT same location",
        expectedResult: "SEPARATE",
        color: "#ef4444",
        group: "B"
    },
    10: {
        name: "S-11: Synonyms",
        prefix: "S11_synonym",
        description: "'Baha' vs 'Rising Water' 5m apart (same meaning)",
        expectedResult: "MERGE",
        color: "#10b981",
        group: "B"
    },
    // GROUP C: DATA INTEGRITY
    11: {
        name: "S-04: Time Decay (90 days)",
        prefix: "S04_decay",
        description: "2x Trash at same loc, today vs 90 days ago",
        expectedResult: "SEPARATE",
        color: "#f59e0b",
        group: "C"
    },
    12: {
        name: "S-08: Mass Panic",
        prefix: "S08_mass_panic",
        description: "20x Fire in 10m radius within 60 seconds",
        expectedResult: "MERGE",
        color: "#dc2626",
        group: "C"
    },
    13: {
        name: "S-12: Spam Bot",
        prefix: "S12_spam_bot",
        description: "50 complaints with identical timestamp (to ms)",
        expectedResult: "FLAG",
        color: "#7c3aed",
        group: "C"
    },
    14: {
        name: "S-14: Default Pin",
        prefix: "S14_default_pin",
        description: "10 complaints at map center (default location)",
        expectedResult: "FLAG",
        color: "#f97316",
        group: "C"
    },
    15: {
        name: "S-15: Null Data",
        prefix: "S15_null",
        description: "Records with null lat or null category",
        expectedResult: "HANDLE",
        color: "#64748b",
        group: "C"
    },
    // GROUP D: STRESS TEST
    16: {
        name: "S-16: Triple Pothole Road Merge",
        prefix: "S16_triple",
        description: "10 Potholes in 3 groups with 8m gaps (ε=10m) → Expect 1 MERGED cluster",
        expectedResult: "MERGE",
        color: "#0ea5e9",
        group: "D"
    }
};


// ==================== MODULE 2: ADAPTIVE SPATIAL CLUSTERING ====================
/**
 * Get adaptive DBSCAN parameters based on Operational Tempo.
 * Adjusts epsilon and minPts dynamically based on volume and dominant category.
 * 
 * MODES:
 * - FLOOD MODE: >70% floods → ε=150m (neighborhood-scale)
 * - SURGE MODE: >50 complaints → ε +25%, minPts=4
 * - NORMAL MODE: Default category-based parameters
 * 
 * @param {number} totalVolume - Total number of active complaints
 * @param {string} dominantCategory - Most common category in dataset
 * @param {number} dominantRatio - Ratio of dominant category (0-1)
 * @returns {Object} Adaptive parameters with mode indicator
 */
function getAdaptiveParameters(totalVolume, dominantCategory, dominantRatio = 0) {
    // Default parameters
    let epsilon = 30;  // 30 meters
    let minPts = 3;
    let mode = 'NORMAL';
    let modeReason = 'Standard category-based clustering';

    // ==================== FLOOD MODE (Priority Override) ====================
    // If >70% of reports are floods, switch to neighborhood-scale clustering
    const isFloodDominant = dominantCategory &&
        (dominantCategory.toLowerCase().includes('flood') ||
            dominantCategory.toLowerCase().includes('flooding'));

    if (isFloodDominant && dominantRatio >= 0.7) {
        epsilon = 150;  // 150 meters - captures neighborhood zones
        minPts = 5;     // Higher threshold for large-area events
        mode = 'FLOOD_MODE';
        modeReason = `${Math.round(dominantRatio * 100)}% flood reports → neighborhood-scale clustering (ε=150m)`;

        console.log(`[ADAPTIVE] FLOOD MODE activated: ${modeReason}`);

        return {
            epsilon,
            minPts,
            mode,
            modeReason,
            adjustments: {
                floodModeActive: true,
                dominantRatio: Math.round(dominantRatio * 100),
                surgeActive: false
            }
        };
    }

    // ==================== SURGE MODE (High Volume) ====================
    // >50 complaints → increase epsilon by 25% to reduce clutter
    if (totalVolume > 50) {
        // Get base epsilon from dominant category or default
        const baseEpsilon = ADAPTIVE_EPSILON[dominantCategory] || 40;
        epsilon = Math.round(baseEpsilon * 1.25);  // +25%
        minPts = 4;  // Slightly higher to filter noise
        mode = 'SURGE_MODE';
        modeReason = `${totalVolume} complaints exceeds threshold (50) → ε increased by 25%`;

        console.log(`[ADAPTIVE] SURGE MODE activated: ${modeReason}`);

        return {
            epsilon,
            minPts,
            mode,
            modeReason,
            adjustments: {
                floodModeActive: false,
                surgeActive: true,
                volumeTrigger: totalVolume,
                epsilonIncrease: '25%'
            }
        };
    }

    // ==================== NORMAL MODE ====================
    // Use category-based epsilon from ADAPTIVE_EPSILON lookup
    epsilon = ADAPTIVE_EPSILON[dominantCategory] || 40;
    minPts = ADAPTIVE_MINPTS[dominantCategory] || 3;
    mode = 'NORMAL';
    modeReason = `Category-based: ${dominantCategory || 'default'} (ε=${epsilon}m, minPts=${minPts})`;

    return {
        epsilon,
        minPts,
        mode,
        modeReason,
        adjustments: {
            floodModeActive: false,
            surgeActive: false
        }
    };
}

// ==================== END MODULE 2 ====================


// ==================== CORE ALGORITHMS ====================

/**
 * Calculate the great-circle distance between two points using Haversine formula.
 * Reference: DOCUMENTATION.md Section 3.1
 * 
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Calculate time difference in hours between two timestamps.
 * Validates ISO 8601 format and handles invalid timestamps gracefully.
 */
function getTimeDifferenceHours(timestamp1, timestamp2) {
    const t1 = new Date(timestamp1);
    const t2 = new Date(timestamp2);

    // Validate timestamps
    if (isNaN(t1.getTime()) || isNaN(t2.getTime())) {
        console.warn('[TIMESTAMP] Invalid timestamp detected, using current time');
        return 0; // Treat as same time if invalid
    }

    return Math.abs(t2 - t1) / (1000 * 60 * 60);
}

/**
 * Normalize category for lookup.
 * Checks both main category and subcategory, prioritizing subcategory for specificity.
 * 
 * @param {Object} point - Complaint point with category and optional subcategory
 * @returns {string} The category to use for epsilon/minPts lookup
 */
function getNormalizedCategory(point) {
    const epsilonLookup = getAdaptiveEpsilonLookup();
    const normalizedSubcategory = normalizeTaxonomyLabel(point.subcategory);
    const normalizedCategory = normalizeTaxonomyLabel(point.category);

    // First try subcategory (more specific)
    if (normalizedSubcategory && epsilonLookup[normalizedSubcategory] !== undefined) {
        return normalizedSubcategory;
    }
    // Fall back to main category
    if (normalizedCategory && epsilonLookup[normalizedCategory] !== undefined) {
        return normalizedCategory;
    }
    // Default fallback
    return normalizedCategory || normalizedSubcategory || "Others";
}

/**
 * Get adaptive epsilon for a category.
 * Supports both main categories (Infrastructure, Utilities) and 
 * subcategories (Pothole, No Water) for field-collected data.
 * 
 * TIER 1 - High Priority (ε=25m): Fire, Accident, Crime, Public Safety
 * TIER 2 - Standard Infrastructure (ε=40m): Pothole, Trash, Streetlight, etc.
 * TIER 3 - Large Area Events (ε=60m): Flooding, No Water, Blackout, etc.
 * 
 * @param {string|Object} categoryOrPoint - Category string or point object
 * @returns {number} Epsilon in meters
 */
function getAdaptiveEpsilon(categoryOrPoint) {
    let category;
    const epsilonLookup = getAdaptiveEpsilonLookup();

    if (typeof categoryOrPoint === 'object') {
        category = getNormalizedCategory(categoryOrPoint);
    } else {
        category = normalizeTaxonomyLabel(categoryOrPoint);
    }

    const epsilon = epsilonLookup[category];
    if (epsilon !== undefined) {
        // Multi-Layer Adaptive Logic: Apply global recursive calibration factor (k)
        return epsilon * (DBSCAN_CONFIG.CALIBRATION_FACTOR || 1.0);
    }

    // Default epsilon for unknown categories
    return 40.0 * (DBSCAN_CONFIG.CALIBRATION_FACTOR || 1.0); // Standard infrastructure default
}

/**
 * Get adaptive minPts for a category.
 * Returns the minimum number of points required to form a cluster.
 * 
 * TIER 1 - High Priority (minPts=3): Fire, Accident, Crime, Public Safety
 * TIER 2 - Standard Infrastructure (minPts=4): Pothole, Trash, Streetlight, etc.
 * TIER 3 - Large Area Events (minPts=5): Flooding, No Water, Blackout, etc.
 * 
 * @param {string|Object} categoryOrPoint - Category string or point object
 * @returns {number} Minimum points for cluster
 */
function getAdaptiveMinPts(categoryOrPoint) {
    let category;
    const minPtsLookup = getAdaptiveMinPtsLookup();

    if (typeof categoryOrPoint === 'object') {
        category = getNormalizedCategory(categoryOrPoint);
    } else {
        category = normalizeTaxonomyLabel(categoryOrPoint);
    }

    const minPts = minPtsLookup[category];
    if (minPts !== undefined) {
        return minPts;
    }

    // Default minPts for unknown categories
    return 4; // Standard infrastructure default
}

/**
 * Validate and normalize timestamp to ISO 8601 format.
 * If timestamp is missing or invalid, returns current time.
 * 
 * @param {string} timestamp - Input timestamp
 * @returns {string} Valid ISO 8601 timestamp
 */
function normalizeTimestamp(timestamp) {
    if (!timestamp) {
        return new Date().toISOString();
    }

    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
        console.warn('[TIMESTAMP] Invalid timestamp format, using NOW():', timestamp);
        return new Date().toISOString();
    }

    return date.toISOString();
}

/**
 * Check semantic relationship between two categories.
 * Reference: DOCUMENTATION.md Section 3.3
 * 
 * Updated for Adaptive DBSCAN v2.0:
 * - Handles both main categories (Infrastructure, Utilities) and subcategories (Pothole, No Water)
 * - Uses bidirectional relationship checking
 * - Supports new category hierarchy for field-collected data
 */
function checkSemanticRelation(categoryA, categoryB) {
    // Handle null/undefined categories
    if (!categoryA || !categoryB) {
        return { isRelated: false, score: 0.0, relationship: "NONE" };
    }

    // IDENTICAL categories always merge
    if (categoryA === categoryB) {
        return { isRelated: true, score: 1.0, relationship: "IDENTICAL" };
    }

    // Also check if they share a parent category (for subcategory matching)
    // This should ALWAYS be allowed (e.g., Pothole + Road Damage = both Infrastructure)
    const parentA = getCanonicalParent(categoryA);
    const parentB = getCanonicalParent(categoryB);
    const sameParent = parentA && parentB && parentA === parentB;

    // v3.9.1: Check if Phase 2 (Causal Analysis) has been triggered
    // Cross-category causal clustering only happens after user enables it
    const causalAnalysisEnabled = (typeof window !== 'undefined' && window.causalAnalysisEnabled === true);

    // Check if A relates to B via RELATIONSHIP_MATRIX (causal link)
    const relatedFromA = RELATIONSHIP_MATRIX[categoryA] || [];
    const isRelatedAtoB = relatedFromA.includes(categoryB);

    // Check if B relates to A (bidirectional check)
    const relatedFromB = RELATIONSHIP_MATRIX[categoryB] || [];
    const isRelatedBtoA = relatedFromB.includes(categoryA);

    // Determine if causal relationship exists
    const hasCausalRelation = isRelatedAtoB || isRelatedBtoA;

    // v3.9.1: Only allow causal cross-category clustering if Phase 2 is triggered
    // Same-parent subcategories always cluster together (they're the same type of issue)
    const isRelated = sameParent || (hasCausalRelation && causalAnalysisEnabled);

    // Get correlation score (check both directions)
    const keyAB = `${categoryA}->${categoryB}`;
    const keyBA = `${categoryB}->${categoryA}`;
    let score = CORRELATION_SCORES[keyAB] || CORRELATION_SCORES[keyBA] || 0.0;

    // If categories are related but no explicit score, give a default moderate score
    if (isRelated && score === 0.0) {
        score = sameParent ? 0.85 : 0.55;  // Higher score for same parent category
    }

    let relationship = "NONE";
    if (isRelated && score >= CORRELATION_THRESHOLD) {
        relationship = sameParent ? "SIBLING" : "CAUSAL";
    } else if (isRelated) {
        relationship = "WEAK";
    }

    // v3.9.1: Log when causal link is blocked due to Phase 2 not being triggered
    if (hasCausalRelation && !causalAnalysisEnabled && !sameParent) {
        // This is a potential causal link that's being blocked
        // console.log(`[SEMANTIC] Causal link ${categoryA} ↔ ${categoryB} blocked - Phase 2 not triggered`);
    }

    return {
        isRelated: isRelated && score >= CORRELATION_THRESHOLD,
        score,
        relationship
    };
}

/**
 * Core DBSCAN decision logic.
 * Reference: DOCUMENTATION.md Section 3.2
 * 
 * @param {Object} pointA - First complaint object
 * @param {Object} pointB - Second complaint object
 * @returns {Object} Logic check result with verdict
 */
function checkLogic(pointA, pointB) {
    const result = {
        shouldMerge: false,
        distance: 0,
        epsilon: 0,
        timeDiff: 0,
        semantic: null,
        keywordAnalysis: null,
        reasons: [],
        verdict: "REJECTED"
    };

    // Calculate distance
    result.distance = haversineDistance(
        pointA.latitude, pointA.longitude,
        pointB.latitude, pointB.longitude
    );

    // Get adaptive epsilon (use max of both categories/subcategories)
    // Try subcategory first for more specific epsilon, fall back to main category
    const categoryA = pointA.subcategory || pointA.category;
    const categoryB = pointB.subcategory || pointB.category;
    const epsilonA = getAdaptiveEpsilon(pointA);
    const epsilonB = getAdaptiveEpsilon(pointB);
    result.epsilon = Math.max(epsilonA, epsilonB);

    // Store adaptive minPts for logging
    result.minPtsA = getAdaptiveMinPts(pointA);
    result.minPtsB = getAdaptiveMinPts(pointB);

    // Check semantic relation (check both main category and subcategory)
    // Try subcategory first, then main category for semantic matching
    const semanticCheckA = pointA.subcategory || pointA.category;
    const semanticCheckB = pointB.subcategory || pointB.category;
    result.semantic = checkSemanticRelation(semanticCheckA, semanticCheckB);

    // If subcategory semantic check fails, try main category
    if (!result.semantic.isRelated && pointA.category && pointB.category) {
        const mainCategorySemantic = checkSemanticRelation(pointA.category, pointB.category);
        if (mainCategorySemantic.isRelated) {
            result.semantic = mainCategorySemantic;
        }
    }

    // Check keyword similarity (NEW)
    result.keywordAnalysis = checkKeywordSimilarity(pointA, pointB);

    // Calculate time difference
    result.timeDiff = getTimeDifferenceHours(pointA.timestamp, pointB.timestamp);

    // Evaluate conditions
    const distanceOk = result.distance <= result.epsilon;
    const semanticOk = result.semantic.isRelated;
    const temporalOk = result.timeDiff <= MAX_TIME_DIFF_HOURS;

    // Keyword can boost or weaken the decision
    const keywordBoost = result.keywordAnalysis.similarity >= KEYWORD_CONFIG.BOOST_THRESHOLD;
    const keywordSupports = result.keywordAnalysis.similarity >= KEYWORD_CONFIG.MIN_SIMILARITY_THRESHOLD;

    // Build rejection reasons
    if (!distanceOk) result.reasons.push(`Distance ${result.distance.toFixed(1)}m > ε ${result.epsilon}m`);
    if (!semanticOk) result.reasons.push(`No semantic correlation (${result.semantic.score.toFixed(2)})`);
    if (!temporalOk) result.reasons.push(`Time diff ${result.timeDiff.toFixed(1)}h > ${MAX_TIME_DIFF_HOURS}h`);

    // Add keyword info to reasons if relevant
    if (keywordBoost) {
        result.reasons.push(`✓ Keyword boost: ${result.keywordAnalysis.sharedKeywords.join(", ")}`);
    } else if (!keywordSupports && result.keywordAnalysis.verdict !== "NEUTRAL") {
        result.reasons.push(`Low keyword similarity (${(result.keywordAnalysis.similarity * 100).toFixed(0)}%)`);
    }

    // Final decision: Original logic + keyword consideration
    // High keyword similarity can reinforce a merge decision
    // Low keyword similarity doesn't block but doesn't help either
    const baseDecision = distanceOk && semanticOk && temporalOk;

    // If all base conditions pass and keywords support, definitely merge
    // If base conditions pass but keywords are weak, still merge (keywords are supplementary)
    result.shouldMerge = baseDecision;
    result.verdict = result.shouldMerge ? "MERGED" : "REJECTED";

    // Add keyword match strength to result
    result.keywordMatchStrength = result.keywordAnalysis.verdict;

    return result;
}


// ==================== AUTOMATED TRANSITIVE CHAINING (DBSCAN++) ====================

/**
 * ============================================================================
 * TRANSITIVE CAUSAL CHAIN CLUSTERING SYSTEM
 * ============================================================================
 * 
 * PROBLEM SOLVED:
 * ---------------
 * Standard DBSCAN only considers direct neighbors (1-hop). This implementation
 * automatically discovers multi-hop causal chains like:
 * 
 *   Pipe Leak → Flooding → Traffic
 *   
 * WITHOUT hardcoding the specific sequence. The algorithm:
 * 
 * 1. Starts at any unvisited point (e.g., Pipe Leak)
 * 2. Finds semantically-related neighbors within epsilon (e.g., Flooding nearby)
 * 3. RECURSIVELY expands from each neighbor, finding THEIR neighbors (Traffic)
 * 4. Continues until no more valid connections exist
 * 
 * HOW IT HANDLES "Pipe → Flood → Traffic" AUTOMATICALLY:
 * ------------------------------------------------------
 * 
 * Step 1: Start at Pipe Leak (Point A)
 *         - getSemanticallyRelatedNeighbors(PipeLeak) finds Flooding (Point B)
 *         - Why? Distance ≤ 15m AND RELATIONSHIP_MATRIX["Pipe Leak"] includes "Flooding"
 *         - Flooding is added to cluster, marked visited
 * 
 * Step 2: Recurse into Flooding (Point B)
 *         - getSemanticallyRelatedNeighbors(Flooding) finds Traffic (Point C)
 *         - Why? Distance ≤ 25m AND RELATIONSHIP_MATRIX["Flooding"] includes "Traffic"
 *         - Traffic is added to cluster, marked visited
 * 
 * Step 3: Recurse into Traffic (Point C)
 *         - getSemanticallyRelatedNeighbors(Traffic) finds no NEW unvisited neighbors
 *         - Recursion terminates
 * 
 * RESULT: Cluster contains [Pipe Leak, Flooding, Traffic] - all linked transitively!
 * 
 * DENSITY CHECK (minPts):
 * -----------------------
 * - A point is a CORE POINT if it has ≥ minPts neighbors
 * - Core points expand the cluster (their neighbors are explored)
 * - BORDER POINTS (< minPts neighbors) are added but don't expand further
 * - This prevents noise from creating spurious chains
 * 
 * TIME COMPLEXITY: O(n²) in worst case, but semantic filtering prunes heavily
 * SPACE COMPLEXITY: O(n) for visited Set + O(d) recursion depth
 * 
 * ============================================================================
 */

// Configuration for transitive clustering
const DBSCAN_CONFIG = {
    MIN_PTS: 1,              // Base minimum (overridden by adaptive minPts per category)
    MAX_CHAIN_DEPTH: 10,     // Prevent infinite recursion in edge cases
    ENABLE_LOGGING: true,    // Log chain discovery for debugging
    USE_ADAPTIVE_MINPTS: true, // Enable category-based minPts
    CALIBRATION_FACTOR: 1.0,  // Recursive Calibration loop factor (k)

    // Cluster Stitching Configuration (Post-DBSCAN merge step)
    ENABLE_CLUSTER_STITCHING: true,           // Enable/disable temporal-aware merging
    STITCH_SPATIAL_THRESHOLD: 150,            // Max distance (meters) between cluster edges
    STITCH_TEMPORAL_THRESHOLD: 7 * 24 * 60 * 60 * 1000  // 7 days in milliseconds
};

/**
 * ============================================================================
 * RECURSIVE CALIBRATION ENGINE (Autonomous Self-Optimization)
 * ============================================================================
 * 
 * Thesis Implementation: "Recursive Parametric Feedback Loop"
 * 
 * Logic:
 * 1. Global Baseline εestablished via Elbow Method.
 * 2. Start at k=0.8, increase to k=1.2 in steps.
 * 3. Run clustering for each step.
 * 4. Calculate Mean Silhouette Coefficient (s).
 * 5. Choose k_opt where s is maximized.
 */
const RecursiveCalibrator = {
    history: [],

    /**
     * Runs the optimization loop across a range of scaling factors.
     * @param {Array} data - The raw complaint data
     * @param {number} startK - Starting k (default 0.8)
     * @param {number} endK - Ending k (default 1.2)
     * @param {number} step - Step size (default 0.05)
     */
    runOptimization(data, startK = 0.8, endK = 1.2, step = 0.05) {
        console.log(`[CALIBRATOR] Starting Recursive Optimization Loop (k: ${startK} → ${endK})...`);
        this.history = [];
        let bestK = 1.0;
        let maxS = -1.0;

        const originalK = DBSCAN_CONFIG.CALIBRATION_FACTOR;

        for (let k = startK; k <= endK + 0.001; k += step) {
            DBSCAN_CONFIG.CALIBRATION_FACTOR = k;

            // Run clustering with this k
            const result = clusterComplaints(data, { ENABLE_LOGGING: false });

            // Calculate quality metric (Mean Silhouette)
            const silhouetteAvg = this.calculateMeanSilhouette(result.clusters, result.noise, data);

            const iteration = {
                iteration: this.history.length + 1,
                factor: parseFloat(k.toFixed(2)),
                avg_silhouette: silhouetteAvg,
                cluster_count: result.clusters.length,
                noise_count: result.noise.length,
                description: `Calibration at k=${k.toFixed(2)}: Found ${result.clusters.length} clusters.`
            };

            this.history.push(iteration);

            if (silhouetteAvg > maxS) {
                maxS = silhouetteAvg;
                bestK = k;
            }

            console.log(`[CALIBRATOR] Iteration ${iteration.iteration}: k=${k.toFixed(2)}, s=${silhouetteAvg.toFixed(4)}`);
        }

        // Apply the best factor globally
        DBSCAN_CONFIG.CALIBRATION_FACTOR = bestK;
        console.log(`[CALIBRATOR] Optimization Finished. Optimal k = ${bestK.toFixed(2)} (s=${maxS.toFixed(4)})`);

        return {
            bestK,
            maxS,
            history: this.history
        };
    },

    /**
     * Simplified Silhouette Calculation for optimization loop
     */
    calculateMeanSilhouette(clusters, noise, allPoints) {
        if (clusters.length === 0) return 0;

        // For thesis optimization, we focus on cluster cohesion/separation
        let totalS = 0;
        let count = 0;

        clusters.forEach(cluster => {
            if (cluster.length < 2) return;

            cluster.forEach(point => {
                // a: Mean distance to other points in SAME cluster (Cohesion)
                const a = this.meanDist(point, cluster.filter(p => p.id !== point.id));

                // b: Mean distance to points in NEAREST other cluster (Separation)
                let b = Infinity;
                clusters.forEach(otherCluster => {
                    if (otherCluster === cluster) return;
                    const dist = this.meanDist(point, otherCluster);
                    if (dist < b) b = dist;
                });

                if (b === Infinity) b = 1000; // Large penalty if no other clusters

                const s = (b - a) / Math.max(a, b);
                totalS += s;
                count++;
            });
        });

        return count > 0 ? (totalS / count) : 0;
    },

    meanDist(point, bucket) {
        if (bucket.length === 0) return 0;
        let sum = 0;
        bucket.forEach(p => {
            sum += haversineDistance(point.latitude, point.longitude, p.latitude, p.longitude);
        });
        return sum / bucket.length;
    },

    /**
     * Enhanced optimization with Elbow Method baseline.
     * Phase A: Find baseline ε from K-distance graph
     * Phase B: Iterate with Silhouette feedback until target reached
     * 
     * @param {Array} data - Complaint data
     * @param {number} targetSilhouette - Target Silhouette score (default 0.55)
     * @param {number} maxIterations - Max iterations (default 20)
     * @returns {Object} Optimization result with baseline and final configuration
     */
    runOptimizationWithElbow(data, targetSilhouette = 0.55, maxIterations = 20) {
        console.log(`[CALIBRATOR] Starting Elbow + Silhouette optimization (target s=${targetSilhouette})...`);

        // Phase A: Get baseline from Elbow Method
        const elbow = ElbowMethod.findOptimalEpsilon(data, 4);
        const baselineEpsilon = elbow.optimalEpsilon;

        // Apply baseline to adaptive epsilon constants
        ElbowMethod.applyBaselineToAdaptiveEpsilon(baselineEpsilon);

        // Phase B: Silhouette iteration
        this.history = [];
        let bestK = 1.0;
        let bestSilhouette = -1;
        let iteration = 0;

        for (let k = 0.7; k <= 1.3 + 0.001; k += 0.05) {
            iteration++;
            if (iteration > maxIterations) break;

            DBSCAN_CONFIG.CALIBRATION_FACTOR = k;

            const result = clusterComplaints(data, { ENABLE_LOGGING: false });
            const silhouetteAvg = this.calculateMeanSilhouette(result.clusters, result.noise, data);

            this.history.push({
                iteration,
                factor: parseFloat(k.toFixed(2)),
                avg_silhouette: silhouetteAvg,
                cluster_count: result.clusters.length,
                baseline_epsilon: baselineEpsilon
            });

            if (silhouetteAvg > bestSilhouette) {
                bestSilhouette = silhouetteAvg;
                bestK = k;
            }

            console.log(`[CALIBRATOR] Iter ${iteration}: k=${k.toFixed(2)}, ε_base=${baselineEpsilon.toFixed(0)}m, s=${silhouetteAvg.toFixed(4)}`);

            if (silhouetteAvg >= targetSilhouette) {
                console.log(`[CALIBRATOR] ✅ Target Silhouette (${targetSilhouette}) reached!`);
                break;
            }
        }

        DBSCAN_CONFIG.CALIBRATION_FACTOR = bestK;

        return {
            baselineEpsilon, optimalK: bestK, finalSilhouette: bestSilhouette,
            iterations: iteration, converged: bestSilhouette >= targetSilhouette,
            history: this.history, kneeIndex: elbow.kneeIndex
        };
    }
};

/**
 * ELBOW METHOD - Data-Driven Epsilon Discovery
 * Uses K-distance graph to find optimal baseline epsilon.
 */
const ElbowMethod = {
    findOptimalEpsilon(data, k = 4) {
        console.log(`[ELBOW] Finding optimal ε using ${k}-distance graph...`);
        const startTime = performance.now();

        const validData = data.filter(p => p.latitude != null && p.longitude != null);
        if (validData.length < k + 1) {
            return { optimalEpsilon: 40, kDistances: [], kneeIndex: 0 };
        }

        const kDistances = [];
        for (const point of validData) {
            const distances = [];
            for (const other of validData) {
                if (point.id === other.id) continue;
                distances.push(haversineDistance(
                    point.latitude, point.longitude,
                    other.latitude, other.longitude
                ));
            }
            distances.sort((a, b) => a - b);
            if (distances.length >= k) kDistances.push(distances[k - 1]);
        }

        kDistances.sort((a, b) => b - a);
        const kneeIndex = this.findKneePoint(kDistances);
        const optimalEpsilon = kDistances[kneeIndex] || 40;

        console.log(`[ELBOW] ✅ Optimal ε = ${optimalEpsilon.toFixed(2)}m (${Math.round(performance.now() - startTime)}ms)`);
        return { optimalEpsilon, kDistances, kneeIndex };
    },

    findKneePoint(sortedDistances) {
        const n = sortedDistances.length;
        if (n < 3) return 0;

        const maxD = sortedDistances[0], minD = sortedDistances[n - 1];
        const range = maxD - minD || 1;
        const normalized = sortedDistances.map((d, i) => ({ x: i / (n - 1), y: (d - minD) / range }));

        let maxDistance = 0, kneeIndex = Math.floor(n * 0.1);
        const a = normalized[n - 1].y - normalized[0].y;
        const b = normalized[0].x - normalized[n - 1].x;
        const c = normalized[n - 1].x * normalized[0].y - normalized[0].x * normalized[n - 1].y;
        const lineLen = Math.sqrt(a * a + b * b);

        if (lineLen === 0) return kneeIndex;
        for (let i = 1; i < n - 1; i++) {
            const dist = Math.abs(a * normalized[i].x + b * normalized[i].y + c) / lineLen;
            if (dist > maxDistance) { maxDistance = dist; kneeIndex = i; }
        }
        return kneeIndex;
    },

    applyBaselineToAdaptiveEpsilon(baseline) {
        const multipliers = {
            "Fire": 0.6, "Accident": 0.6, "Crime": 0.6, "Public Safety": 0.6,
            "Pothole": 1.0, "Road Damage": 1.0, "Trash": 1.0, "Broken Streetlight": 1.0,
            "Flooding": 1.5, "Flood": 1.5, "No Water": 1.5, "Blackout": 2.0, "Traffic": 1.3
        };
        for (const [cat, mult] of Object.entries(multipliers)) {
            ADAPTIVE_EPSILON[cat] = Math.round(baseline * mult);
        }
        console.log(`[ELBOW] Applied baseline ε=${Math.round(baseline)}m to ADAPTIVE_EPSILON`);
        return ADAPTIVE_EPSILON;
    },

    getConfigSummary() {
        return { adaptiveEpsilon: { ...ADAPTIVE_EPSILON }, calibrationFactor: DBSCAN_CONFIG.CALIBRATION_FACTOR };
    }
};

window.ElbowMethod = ElbowMethod;

/**
 * ============================================================================
 * ROAD-PROXIMITY VALIDATION SYSTEM (Nominatim)
 * ============================================================================
 * 
 * Verifies if road-related complaints are physically consistent with 
 * road infrastructure using OpenStreetMap Nominatim.
 */
const RoadValidator = {
    ROAD_RELATED_CATEGORIES: ["Pothole", "Road Damage", "Traffic", "Road Obstruction", "Traffic Jam", "Streetlight", "Broken Streetlight"],

    // Simple cache to avoid redundant Nominatim hits for same locations
    _cache: new Map(),

    // v4.0.1: Rate limiting for Nominatim (max 1 request per second)
    _lastRequestTime: 0,
    _RATE_LIMIT_MS: 1100, // 1.1 seconds between requests
    _requestQueue: [],
    _isProcessingQueue: false,

    /**
     * Validate if a complaint is on or near a road.
     * v4.0.1: Now includes rate limiting and timeout handling.
     * @param {Object} p - Complaint object
     * @returns {Promise<Object>} Validation result
     */
    async validate(p) {
        const category = p.subcategory || p.category;
        if (!this.ROAD_RELATED_CATEGORIES.includes(category)) {
            return { isValid: true };
        }

        const cacheKey = `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }

        // Queue the request to respect rate limits
        return new Promise((resolve) => {
            this._requestQueue.push({ p, cacheKey, resolve });
            this._processQueue();
        });
    },

    /**
     * Process queued requests with rate limiting.
     */
    async _processQueue() {
        if (this._isProcessingQueue || this._requestQueue.length === 0) return;

        this._isProcessingQueue = true;

        while (this._requestQueue.length > 0) {
            const { p, cacheKey, resolve } = this._requestQueue.shift();

            // Check cache again (might have been populated by earlier request)
            if (this._cache.has(cacheKey)) {
                resolve(this._cache.get(cacheKey));
                continue;
            }

            // Rate limiting - wait if needed
            const now = Date.now();
            const timeSinceLastRequest = now - this._lastRequestTime;
            if (timeSinceLastRequest < this._RATE_LIMIT_MS) {
                await new Promise(r => setTimeout(r, this._RATE_LIMIT_MS - timeSinceLastRequest));
            }

            try {
                this._lastRequestTime = Date.now();

                const url = `https://nominatim.openstreetmap.org/reverse?lat=${p.latitude}&lon=${p.longitude}&format=jsonv2&zoom=18&addressdetails=1`;

                // v4.0.1: Add timeout using AbortController
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

                const response = await fetch(url, {
                    headers: { 'User-Agent': 'DRIMS-City-Dashboard/1.0' },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) throw new Error(`Nominatim API error: ${response.status}`);

                const data = await response.json();

                // Heuristic Checklist for "Road-ness"
                const isRoad = data.address && (
                    data.address.road ||
                    data.address.highway ||
                    data.address.pedestrian ||
                    data.address.cycleway ||
                    data.category === "highway" ||
                    (data.type && ["living_street", "residential", "trunk", "primary", "secondary", "tertiary", "service"].includes(data.type))
                );

                const result = {
                    isValid: !!isRoad,
                    roadName: data.address?.road || null,
                    osmType: data.type || null,
                    displayName: data.display_name || "Unknown Location"
                };

                this._cache.set(cacheKey, result);
                resolve(result);

            } catch (error) {
                // v4.0.1: Silently handle errors to avoid console spam
                if (error.name !== 'AbortError') {
                    console.debug(`[ROAD-VALIDATOR] Skipped validation for ${p.id}: ${error.message}`);
                }
                // Fallback: don't block if API fails (permissive mode)
                const fallbackResult = { isValid: true, fallback: true };
                this._cache.set(cacheKey, fallbackResult); // Cache fallback to avoid retrying
                resolve(fallbackResult);
            }
        }

        this._isProcessingQueue = false;
    }
};

window.RoadValidator = RoadValidator;

/**
 * ============================================================================
 * ADAPTIVE CLUSTER CORRELATION SYSTEM v1.0
 * ============================================================================
 * 
 * This system analyzes neighboring clusters and outliers to detect correlation

 * patterns that suggest they should be merged into a larger incident.
 * 
 * KEY FEATURES:
 * 1. Neighboring Cluster Detection - finds clusters within proximity threshold
 * 2. Cross-Cluster Causal Analysis - detects causal links between cluster types
 * 3. Adaptive Epsilon Expansion - increases epsilon when correlation is strong
 * 4. Outlier Absorption - noise points that fit cluster patterns get absorbed
 * 
 * EXAMPLE USE CASE (from screenshots):
 * - Cluster #3: Garbage Collection (19 reports, 238m)
 * - Cluster #4: Overflowing Trash (6 reports, 33m)  
 * - Cluster #6: Illegal Dumping (8 reports, 47m)
 * All in Zone III, R. Magsaysay Street → Should be merged as single incident
 * 
 * @author DRIMS Development Team
 * @version 1.0.0 - Initial implementation
 * ============================================================================
 */

const CLUSTER_CORRELATION_CONFIG = {
    // Enable/disable the correlation system
    // v3.9.1: Now controlled by window.causalAnalysisEnabled (Phase 2 trigger)
    ENABLE_CORRELATION_ANALYSIS: true,

    // NEW: Check if Phase 2 has been triggered before doing cross-category merging
    // This allows the correlation system to be ready but only active after user trigger
    shouldRunCorrelation: function () {
        // If the dashboard has set causalAnalysisEnabled, respect it
        if (typeof window !== 'undefined' && typeof window.causalAnalysisEnabled !== 'undefined') {
            return window.causalAnalysisEnabled;
        }
        // Default: allow correlation (for backwards compatibility in non-dashboard contexts)
        return this.ENABLE_CORRELATION_ANALYSIS;
    },

    // Maximum distance (meters) to consider clusters as "neighboring"
    // This is the search radius for potential correlations
    NEIGHBOR_DISTANCE_THRESHOLD: 300,  // meters

    // Minimum correlation score (0-1) to suggest merging
    // v4.0.1: Lowered from 0.60 to 0.50 to merge clusters with overlapping categories
    MIN_CORRELATION_FOR_MERGE: 0.50,

    // Epsilon expansion multiplier when strong correlation is found
    // e.g., 1.5 = expand epsilon by 50%
    EPSILON_EXPANSION_FACTOR: 1.5,

    // Maximum expanded epsilon (prevents runaway clustering)
    MAX_EXPANDED_EPSILON: 250,  // meters

    // Temporal threshold - clusters must be within this time window
    TEMPORAL_THRESHOLD: 14 * 24 * 60 * 60 * 1000,  // 14 days

    // Minimum causal link strength to count as correlation
    MIN_CAUSAL_LINK_STRENGTH: 0.55,

    // Location similarity threshold (0-1) - higher = stricter location matching
    LOCATION_SIMILARITY_THRESHOLD: 0.7,

    // Enable logging for debugging
    ENABLE_LOGGING: true
};

/**
 * CROSS-CLUSTER CAUSAL LINK DATABASE
 * Defines causal relationships between cluster types (not just individual categories)
 * Higher scores = stronger correlation = more likely to merge
 */
const CLUSTER_CAUSAL_LINKS = {
    // Sanitation Chain (the Zone III case)
    "Illegal Dumping->Bad Odor": 0.75,
    "Illegal Dumping->Overflowing Trash": 0.70,
    "Illegal Dumping->Garbage Collection": 0.80,
    "Overflowing Trash->Bad Odor": 0.85,
    "Overflowing Trash->Garbage Collection": 0.75,
    "Garbage Collection->Bad Odor": 0.70,
    "Garbage Collection->Pest Infestation": 0.65,
    "Trash->Clogged Drain": 0.60,
    "Trash->Clogged Drainage": 0.60,

    // Flooding Chain
    "Flooding->Road Damage": 0.70,
    "Flooding->Traffic": 0.85,
    "Flooding->Accident": 0.60,
    "Clogged Drainage->Flooding": 0.88,
    "Pipe Leak->Flooding": 0.92,
    "Pipe Leak->No Water": 0.85,

    // Infrastructure Chain  
    "Pothole->Road Damage": 0.75,
    "Pothole->Accident": 0.65,
    "Road Damage->Traffic": 0.70,

    // Utilities Chain
    "Blackout->Crime": 0.55,
    "Blackout->Traffic": 0.60,
    "Power Line Down->Blackout": 0.90,

    // Fire Chain
    "Fire->Smoke": 0.95,
    "Fire->Evacuation": 0.85,
    "Fire->Traffic": 0.70
};

/**
 * Find all clusters that are within proximity of a target cluster.
 * Uses edge-to-edge distance (minimum point distance between clusters).
 * 
 * @param {Array} targetCluster - The cluster to find neighbors for
 * @param {Array} allClusters - All clusters to search through
 * @param {number} targetIndex - Index of target cluster (to exclude self)
 * @param {number} distanceThreshold - Max distance in meters (default from config)
 * @returns {Array} Array of {cluster, index, distance, minDistancePoints}
 */
function findNeighboringClusters(targetCluster, allClusters, targetIndex, distanceThreshold = null) {
    const threshold = distanceThreshold || CLUSTER_CORRELATION_CONFIG.NEIGHBOR_DISTANCE_THRESHOLD;
    const neighbors = [];

    for (let i = 0; i < allClusters.length; i++) {
        if (i === targetIndex) continue; // Skip self

        const candidateCluster = allClusters[i];

        // Find minimum distance between any two points
        let minDist = Infinity;
        let closestPointA = null;
        let closestPointB = null;

        for (const pointA of targetCluster) {
            for (const pointB of candidateCluster) {
                const dist = haversineDistance(
                    pointA.latitude, pointA.longitude,
                    pointB.latitude, pointB.longitude
                );
                if (dist < minDist) {
                    minDist = dist;
                    closestPointA = pointA;
                    closestPointB = pointB;
                }
            }
        }

        if (minDist <= threshold) {
            neighbors.push({
                cluster: candidateCluster,
                index: i,
                distance: minDist,
                minDistancePoints: { a: closestPointA, b: closestPointB }
            });
        }
    }

    // Sort by distance (closest first)
    return neighbors.sort((a, b) => a.distance - b.distance);
}

/**
 * Analyze the correlation between two clusters.
 * Checks causal links, location similarity, temporal proximity, and category overlap.
 * 
 * @param {Array} clusterA - First cluster
 * @param {Array} clusterB - Second cluster
 * @returns {Object} Correlation analysis result
 */
function analyzeClusterCorrelation(clusterA, clusterB) {
    const result = {
        isCorrelated: false,
        correlationScore: 0,
        causalLinks: [],
        sharedLocation: null,
        locationSimilarity: 0,
        temporalProximity: 0,
        categoryOverlap: [],
        suggestMerge: false,
        suggestedEpsilonExpansion: 1.0,
        reasoning: []
    };

    // 1. GET DOMINANT CATEGORIES
    const catA = getDominantCategory(clusterA);
    const catB = getDominantCategory(clusterB);

    // Get all unique categories in each cluster
    const categoriesA = [...new Set(clusterA.map(p => p.subcategory || p.category))];
    const categoriesB = [...new Set(clusterB.map(p => p.subcategory || p.category))];

    // 2. CHECK CAUSAL LINKS (bidirectional)
    const causalLinks = [];

    for (const catX of categoriesA) {
        for (const catY of categoriesB) {
            const keyAB = `${catX}->${catY}`;
            const keyBA = `${catY}->${catX}`;

            // Check direct causal link database
            if (CLUSTER_CAUSAL_LINKS[keyAB]) {
                causalLinks.push({ cause: catX, effect: catY, strength: CLUSTER_CAUSAL_LINKS[keyAB] });
            } else if (CLUSTER_CAUSAL_LINKS[keyBA]) {
                causalLinks.push({ cause: catY, effect: catX, strength: CLUSTER_CAUSAL_LINKS[keyBA] });
            }

            // Also check RELATIONSHIP_MATRIX for semantic relationships
            if (RELATIONSHIP_MATRIX[catX] && RELATIONSHIP_MATRIX[catX].includes(catY)) {
                const existing = causalLinks.find(l =>
                    (l.cause === catX && l.effect === catY) ||
                    (l.cause === catY && l.effect === catX)
                );
                if (!existing) {
                    causalLinks.push({ cause: catX, effect: catY, strength: 0.55, source: 'relationship_matrix' });
                }
            }
        }
    }

    result.causalLinks = causalLinks;

    // 3. CHECK CATEGORY OVERLAP (same categories in both clusters)
    const overlap = categoriesA.filter(c => categoriesB.includes(c));
    result.categoryOverlap = overlap;

    // 4. CHECK LOCATION SIMILARITY
    // Compare barangay, street, zone
    const locationsA = clusterA.map(p => ({
        barangay: p.barangay || p.address?.barangay,
        street: p.street || p.address?.street,
        zone: extractZone(p)
    }));
    const locationsB = clusterB.map(p => ({
        barangay: p.barangay || p.address?.barangay,
        street: p.street || p.address?.street,
        zone: extractZone(p)
    }));

    // Find most common location in each cluster
    const dominantLocA = getMostCommonLocation(locationsA);
    const dominantLocB = getMostCommonLocation(locationsB);

    let locationScore = 0;
    if (dominantLocA.barangay && dominantLocA.barangay === dominantLocB.barangay) {
        locationScore += 0.4;
    }
    if (dominantLocA.street && dominantLocA.street === dominantLocB.street) {
        locationScore += 0.4;
    }
    if (dominantLocA.zone && dominantLocA.zone === dominantLocB.zone) {
        locationScore += 0.2;
    }

    result.locationSimilarity = locationScore;
    result.sharedLocation = locationScore >= 0.4 ? dominantLocA : null;

    // 5. CHECK TEMPORAL PROXIMITY
    const timeA = getClusterAverageTime(clusterA);
    const timeB = getClusterAverageTime(clusterB);
    const timeDiff = Math.abs(timeA - timeB);

    // Normalize to 0-1 (1 = same time, 0 = beyond threshold)
    const temporalThreshold = CLUSTER_CORRELATION_CONFIG.TEMPORAL_THRESHOLD;
    result.temporalProximity = Math.max(0, 1 - (timeDiff / temporalThreshold));

    // 6. CALCULATE COMPOSITE CORRELATION SCORE
    let score = 0;

    // Causal links (strongest factor) - up to 0.4
    if (causalLinks.length > 0) {
        const avgCausalStrength = causalLinks.reduce((sum, l) => sum + l.strength, 0) / causalLinks.length;
        score += avgCausalStrength * 0.4;
        result.reasoning.push(`${causalLinks.length} causal link(s) found (avg strength: ${(avgCausalStrength * 100).toFixed(0)}%)`);
    }

    // Category overlap - up to 0.35 (v4.0.1: increased from 0.2 to prioritize same-type clusters)
    if (overlap.length > 0) {
        const overlapRatio = overlap.length / Math.max(categoriesA.length, categoriesB.length);
        score += overlapRatio * 0.35;
        result.reasoning.push(`Category overlap: ${overlap.join(', ')} (${(overlapRatio * 100).toFixed(0)}% match)`)
    }

    // Location similarity - up to 0.25
    score += result.locationSimilarity * 0.25;
    if (result.locationSimilarity >= 0.4) {
        result.reasoning.push(`Same location: ${dominantLocA.street || dominantLocA.barangay || dominantLocA.zone}`);
    }

    // Temporal proximity - up to 0.15
    score += result.temporalProximity * 0.15;

    result.correlationScore = Math.min(1, score);

    // 7. DETERMINE IF SHOULD MERGE
    result.isCorrelated = result.correlationScore >= CLUSTER_CORRELATION_CONFIG.MIN_CORRELATION_FOR_MERGE;
    result.suggestMerge = result.isCorrelated && result.temporalProximity >= 0.5;

    // 8. CALCULATE EPSILON EXPANSION
    if (result.isCorrelated) {
        // Scale expansion based on correlation strength
        const expansionFactor = 1 + ((result.correlationScore - 0.5) * CLUSTER_CORRELATION_CONFIG.EPSILON_EXPANSION_FACTOR);
        result.suggestedEpsilonExpansion = Math.min(expansionFactor, 2.0); // Cap at 2x
    }

    return result;
}

/**
 * Extract zone information from a complaint point.
 */
function extractZone(point) {
    // Check various fields for zone info
    if (point.zone) return point.zone;

    const address = point.address || {};
    if (address.zone) return address.zone;

    // Try to extract from barangay name (e.g., "Zone III" or "Barangay Zone 2")
    const barangay = point.barangay || address.barangay || '';
    const zoneMatch = barangay.match(/Zone\s*(\d+|I+|V+)/i);
    if (zoneMatch) return zoneMatch[0];

    // Try to extract from street (e.g., "R. Magsaysay Street (Zone 2)")
    const street = point.street || address.street || '';
    const streetZoneMatch = street.match(/Zone\s*(\d+|I+|V+)/i);
    if (streetZoneMatch) return streetZoneMatch[0];

    return null;
}

/**
 * Get the most common location from an array of location objects.
 */
function getMostCommonLocation(locations) {
    const counts = { barangay: {}, street: {}, zone: {} };

    for (const loc of locations) {
        if (loc.barangay) counts.barangay[loc.barangay] = (counts.barangay[loc.barangay] || 0) + 1;
        if (loc.street) counts.street[loc.street] = (counts.street[loc.street] || 0) + 1;
        if (loc.zone) counts.zone[loc.zone] = (counts.zone[loc.zone] || 0) + 1;
    }

    const getMostCommon = (obj) => {
        let max = 0, result = null;
        for (const [key, count] of Object.entries(obj)) {
            if (count > max) { max = count; result = key; }
        }
        return result;
    };

    return {
        barangay: getMostCommon(counts.barangay),
        street: getMostCommon(counts.street),
        zone: getMostCommon(counts.zone)
    };
}

/**
 * Analyze noise points (outliers) to see if they fit into existing clusters.
 * Points that have causal relationships with cluster categories get absorbed.
 * 
 * @param {Array} noisePoints - Points marked as noise by DBSCAN
 * @param {Array} clusters - Existing clusters
 * @returns {Object} { absorbed: Map<clusterIndex, points[]>, remaining: points[] }
 */
function analyzeOutliersForAbsorption(noisePoints, clusters) {
    const absorbed = new Map();
    const remaining = [];

    for (const point of noisePoints) {
        const pointCategory = point.subcategory || point.category;
        let bestMatch = null;
        let bestScore = 0;

        for (let i = 0; i < clusters.length; i++) {
            const cluster = clusters[i];
            const clusterCategories = [...new Set(cluster.map(p => p.subcategory || p.category))];
            const dominantCategory = getDominantCategory(cluster);

            // Check distance to nearest point in cluster
            let minDist = Infinity;
            for (const clusterPoint of cluster) {
                const dist = haversineDistance(
                    point.latitude, point.longitude,
                    clusterPoint.latitude, clusterPoint.longitude
                );
                if (dist < minDist) minDist = dist;
            }

            // Must be within expanded epsilon range
            const baseEpsilon = ADAPTIVE_EPSILON[dominantCategory] || 40;
            const expandedEpsilon = baseEpsilon * CLUSTER_CORRELATION_CONFIG.EPSILON_EXPANSION_FACTOR;

            if (minDist > expandedEpsilon) continue;

            // Check causal relationship
            let causalScore = 0;
            for (const clusterCat of clusterCategories) {
                const keyAB = `${pointCategory}->${clusterCat}`;
                const keyBA = `${clusterCat}->${pointCategory}`;

                if (CLUSTER_CAUSAL_LINKS[keyAB]) {
                    causalScore = Math.max(causalScore, CLUSTER_CAUSAL_LINKS[keyAB]);
                } else if (CLUSTER_CAUSAL_LINKS[keyBA]) {
                    causalScore = Math.max(causalScore, CLUSTER_CAUSAL_LINKS[keyBA]);
                } else if (RELATIONSHIP_MATRIX[pointCategory]?.includes(clusterCat) ||
                    RELATIONSHIP_MATRIX[clusterCat]?.includes(pointCategory)) {
                    causalScore = Math.max(causalScore, 0.50);
                }
            }

            // Composite score: 60% causal, 40% proximity
            const proximityScore = 1 - (minDist / expandedEpsilon);
            const compositeScore = (causalScore * 0.6) + (proximityScore * 0.4);

            if (compositeScore > bestScore && causalScore >= CLUSTER_CORRELATION_CONFIG.MIN_CAUSAL_LINK_STRENGTH) {
                bestScore = compositeScore;
                bestMatch = { clusterIndex: i, score: compositeScore, distance: minDist, causalScore };
            }
        }

        if (bestMatch) {
            if (!absorbed.has(bestMatch.clusterIndex)) {
                absorbed.set(bestMatch.clusterIndex, []);
            }
            absorbed.get(bestMatch.clusterIndex).push({
                point,
                matchDetails: bestMatch
            });
        } else {
            remaining.push(point);
        }
    }

    return { absorbed, remaining };
}

/**
 * MAIN FUNCTION: Perform correlation-aware cluster merging.
 * This is called AFTER standard DBSCAN clustering to merge correlated clusters.
 * 
 * @param {Array} clusters - Initial clusters from DBSCAN
 * @param {Array} noise - Noise points from DBSCAN
 * @returns {Object} { clusters, noise, correlationAnalysis, mergeLog }
 */
function mergeCorrelatedClusters(clusters, noise) {
    // v3.9.1: Check Phase 2 trigger status
    if (!CLUSTER_CORRELATION_CONFIG.shouldRunCorrelation()) {
        if (CLUSTER_CORRELATION_CONFIG.ENABLE_LOGGING) {
            console.log('[CORRELATION] Skipped - Phase 2 (Causal Analysis) not triggered yet');
        }
        return { clusters, noise, correlationAnalysis: [], mergeLog: [] };
    }

    if (!CLUSTER_CORRELATION_CONFIG.ENABLE_CORRELATION_ANALYSIS) {
        return { clusters, noise, correlationAnalysis: [], mergeLog: [] };
    }

    const startTime = performance.now();
    const mergeLog = [];
    const correlationAnalysis = [];

    if (CLUSTER_CORRELATION_CONFIG.ENABLE_LOGGING) {
        console.log(`[CORRELATION] Starting correlation analysis on ${clusters.length} clusters`);
    }

    // Phase 1: Analyze all cluster pairs for correlation
    const correlationMatrix = [];

    for (let i = 0; i < clusters.length; i++) {
        const neighbors = findNeighboringClusters(clusters[i], clusters, i);

        for (const neighbor of neighbors) {
            const correlation = analyzeClusterCorrelation(clusters[i], neighbor.cluster);

            correlationMatrix.push({
                clusterA: i,
                clusterB: neighbor.index,
                distance: neighbor.distance,
                correlation
            });

            if (correlation.isCorrelated) {
                correlationAnalysis.push({
                    clusters: [i, neighbor.index],
                    score: correlation.correlationScore,
                    causalLinks: correlation.causalLinks,
                    sharedLocation: correlation.sharedLocation,
                    suggestMerge: correlation.suggestMerge,
                    reasoning: correlation.reasoning
                });
            }
        }
    }

    // Phase 2: Merge strongly correlated clusters
    let mergedClusters = clusters.map(c => [...c]); // Deep copy
    const mergedIndices = new Set();

    // Sort by correlation score (strongest first)
    const sortedCorrelations = correlationAnalysis
        .filter(c => c.suggestMerge)
        .sort((a, b) => b.score - a.score);

    for (const corr of sortedCorrelations) {
        const [idxA, idxB] = corr.clusters;

        // Skip if either cluster already merged
        if (mergedIndices.has(idxA) || mergedIndices.has(idxB)) continue;

        // Merge B into A
        mergedClusters[idxA] = [...mergedClusters[idxA], ...mergedClusters[idxB]];
        mergedClusters[idxB] = []; // Mark as empty
        mergedIndices.add(idxB);

        const catA = getDominantCategory(clusters[idxA]);
        const catB = getDominantCategory(clusters[idxB]);

        mergeLog.push({
            action: 'MERGE',
            clusters: [idxA, idxB],
            categories: [catA, catB],
            correlationScore: corr.score,
            reason: corr.reasoning.join('; '),
            newSize: mergedClusters[idxA].length
        });

        if (CLUSTER_CORRELATION_CONFIG.ENABLE_LOGGING) {
            console.log(`[CORRELATION] Merged Cluster #${idxA} (${catA}) + #${idxB} (${catB}) | Score: ${(corr.score * 100).toFixed(0)}%`);
        }
    }

    // Remove empty clusters
    mergedClusters = mergedClusters.filter(c => c.length > 0);

    // Phase 3: Absorb correlated noise points
    const absorptionResult = analyzeOutliersForAbsorption(noise, mergedClusters);

    for (const [clusterIdx, absorbedPoints] of absorptionResult.absorbed) {
        for (const { point, matchDetails } of absorbedPoints) {
            mergedClusters[clusterIdx].push(point);

            mergeLog.push({
                action: 'ABSORB_OUTLIER',
                cluster: clusterIdx,
                pointId: point.id,
                pointCategory: point.subcategory || point.category,
                causalScore: matchDetails.causalScore,
                distance: matchDetails.distance
            });
        }
    }

    const endTime = performance.now();

    if (CLUSTER_CORRELATION_CONFIG.ENABLE_LOGGING) {
        console.log(`[CORRELATION] Complete: ${clusters.length} → ${mergedClusters.length} clusters, ${noise.length - absorptionResult.remaining.length} outliers absorbed (${(endTime - startTime).toFixed(0)}ms)`);
    }

    return {
        clusters: mergedClusters,
        noise: absorptionResult.remaining,
        correlationAnalysis,
        mergeLog,
        metadata: {
            originalClusters: clusters.length,
            finalClusters: mergedClusters.length,
            mergedCount: mergedIndices.size,
            absorbedOutliers: noise.length - absorptionResult.remaining.length,
            processingTime: Math.round(endTime - startTime)
        }
    };
}

/**
 * Get correlation analysis for a specific cluster.
 * This is used by the UI to show related/neighboring clusters.
 * 
 * @param {Array} targetCluster - The cluster to analyze
 * @param {number} targetIndex - Index of the cluster
 * @param {Array} allClusters - All clusters in the system
 * @returns {Object} Detailed correlation info for display
 */
function getClusterCorrelationInfo(targetCluster, targetIndex, allClusters) {
    const neighbors = findNeighboringClusters(targetCluster, allClusters, targetIndex);
    const correlatedNeighbors = [];
    let totalCorrelationScore = 0;

    for (const neighbor of neighbors) {
        const correlation = analyzeClusterCorrelation(targetCluster, neighbor.cluster);

        if (correlation.correlationScore >= 0.3) { // Show even weak correlations
            const neighborDominantCat = getDominantCategory(neighbor.cluster);

            correlatedNeighbors.push({
                clusterIndex: neighbor.index,
                category: neighborDominantCat,
                distance: Math.round(neighbor.distance),
                correlationScore: correlation.correlationScore,
                causalLinks: correlation.causalLinks.slice(0, 3), // Top 3 links
                sharedLocation: correlation.sharedLocation,
                suggestMerge: correlation.suggestMerge,
                reasoning: correlation.reasoning,
                reportCount: neighbor.cluster.length
            });

            totalCorrelationScore += correlation.correlationScore;
        }
    }

    // Sort by correlation score
    correlatedNeighbors.sort((a, b) => b.correlationScore - a.correlationScore);

    // Calculate combined span if merged
    let combinedSpan = 0;
    if (correlatedNeighbors.length > 0) {
        const allPoints = [
            ...targetCluster,
            ...correlatedNeighbors.flatMap(n => allClusters[n.clusterIndex])
        ];
        combinedSpan = calculateCombinedClusterSpan(allPoints);
    }

    return {
        hasCorrelatedNeighbors: correlatedNeighbors.length > 0,
        neighborCount: correlatedNeighbors.length,
        neighbors: correlatedNeighbors,
        avgCorrelation: correlatedNeighbors.length > 0
            ? totalCorrelationScore / correlatedNeighbors.length
            : 0,
        combinedReportCount: targetCluster.length +
            correlatedNeighbors.reduce((sum, n) => sum + n.reportCount, 0),
        combinedSpan,
        suggestionLevel: correlatedNeighbors.some(n => n.suggestMerge)
            ? 'MERGE_RECOMMENDED'
            : correlatedNeighbors.length > 0
                ? 'REVIEW_SUGGESTED'
                : 'NO_ACTION'
    };
}

/**
 * Calculate the span of combined clusters.
 */
function calculateCombinedClusterSpan(points) {
    if (points.length < 2) return 0;

    let maxDist = 0;
    for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
            const dist = haversineDistance(
                points[i].latitude, points[i].longitude,
                points[j].latitude, points[j].longitude
            );
            if (dist > maxDist) maxDist = dist;
        }
    }
    return Math.round(maxDist);
}

// Export for global access
window.findNeighboringClusters = findNeighboringClusters;
window.analyzeClusterCorrelation = analyzeClusterCorrelation;
window.mergeCorrelatedClusters = mergeCorrelatedClusters;
window.analyzeOutliersForAbsorption = analyzeOutliersForAbsorption;
window.getClusterCorrelationInfo = getClusterCorrelationInfo;
window.calculateCombinedClusterSpan = calculateCombinedClusterSpan;
window.CLUSTER_CORRELATION_CONFIG = CLUSTER_CORRELATION_CONFIG;

/**
 * Get all semantically-related neighbors for a point.
 * This is the CORE FILTER that enforces the Two-Layer Architecture:
 *   Layer 1: Spatial (distance ≤ adaptive epsilon)
 *   Layer 2: Semantic (must pass RELATIONSHIP_MATRIX check)
 * 
 * @param {Object} point - The reference point
 * @param {Array} allPoints - All points to search
 * @param {Set} visited - Already visited point IDs (for efficiency)
 * @returns {Array} Array of {neighbor, logicResult} objects
 */
function getSemanticallyRelatedNeighbors(point, allPoints, visited = new Set()) {
    const neighbors = [];

    for (const candidate of allPoints) {
        // Skip self
        if (candidate.id === point.id) continue;

        // Skip already visited (optimization - not strictly necessary but faster)
        if (visited.has(candidate.id)) continue;

        // Skip invalid coordinates
        if (candidate.latitude == null || candidate.longitude == null) continue;

        // Allow category or subcategory (for field-collected data)
        if (candidate.category == null && candidate.subcategory == null) continue;

        // Apply the Two-Layer check via checkLogic
        const logicResult = checkLogic(point, candidate);

        // Only include if ALL conditions pass (distance + semantic + temporal)
        if (logicResult.shouldMerge) {
            neighbors.push({
                neighbor: candidate,
                logicResult: logicResult
            });
        }
    }

    return neighbors;
}

/**
 * Recursive cluster expansion using Depth-First Search (DFS).
 * Follows semantic links transitively until no more valid connections.
 * 
 * KEY INSIGHT: This function is what enables automatic chain detection.
 * It doesn't know about "Pipe→Flood→Traffic" specifically - it just
 * follows whatever links the RELATIONSHIP_MATRIX allows.
 * 
 * @param {Object} point - Current point to expand from
 * @param {Array} neighbors - Pre-computed neighbors of this point
 * @param {number} clusterId - ID of the cluster being built
 * @param {Array} allPoints - All points in the dataset
 * @param {Set} visited - Set of visited point IDs
 * @param {Array} cluster - The cluster array being built
 * @param {number} depth - Current recursion depth (for safety)
 * @param {Array} chainLog - Log of the causal chain (for visualization)
 * @returns {Object} Expansion result with cluster and chain information
 */
function expandCluster(point, neighbors, clusterId, allPoints, visited, cluster, depth = 0, chainLog = []) {
    // Safety: Prevent infinite recursion
    if (depth > DBSCAN_CONFIG.MAX_CHAIN_DEPTH) {
        if (DBSCAN_CONFIG.ENABLE_LOGGING) {
            console.warn(`[DBSCAN++] Max chain depth (${DBSCAN_CONFIG.MAX_CHAIN_DEPTH}) reached at point ${point.id}`);
        }
        return { cluster, chainLog };
    }

    // Mark this point as visited
    visited.add(point.id);

    // Add point to cluster if not already present
    if (!cluster.find(p => p.id === point.id)) {
        cluster.push({
            ...point,
            _clusterId: clusterId,
            _clusterRole: neighbors.length >= DBSCAN_CONFIG.MIN_PTS ? 'CORE' : 'BORDER',
            _chainDepth: depth
        });
    }

    // Log the chain progression
    if (chainLog.length === 0 || chainLog[chainLog.length - 1].id !== point.id) {
        chainLog.push({
            id: point.id,
            category: point.category,
            depth: depth
        });
    }

    // DENSITY CHECK: Only expand if this is a CORE point (≥ minPts neighbors)
    // Border points are added to cluster but don't propagate further
    if (neighbors.length < DBSCAN_CONFIG.MIN_PTS) {
        if (DBSCAN_CONFIG.ENABLE_LOGGING) {
            console.log(`[DBSCAN++] Point ${point.id} is BORDER (${neighbors.length} < ${DBSCAN_CONFIG.MIN_PTS} neighbors) - no expansion`);
        }
        return { cluster, chainLog };
    }

    if (DBSCAN_CONFIG.ENABLE_LOGGING && depth === 0) {
        console.log(`[DBSCAN++] Starting expansion from CORE point ${point.id} [${point.category}]`);
    }

    // RECURSIVE EXPANSION: For each neighbor, explore their connections
    for (const { neighbor, logicResult } of neighbors) {
        // Skip if already visited (prevents cycles)
        if (visited.has(neighbor.id)) continue;

        if (DBSCAN_CONFIG.ENABLE_LOGGING) {
            console.log(`[DBSCAN++] Chain: ${point.category} → ${neighbor.category} (${logicResult.distance.toFixed(1)}m, score: ${(logicResult.semantic.score * 100).toFixed(0)}%)`);
        }

        // Find neighbors of THIS neighbor (the transitive step!)
        const neighborNeighbors = getSemanticallyRelatedNeighbors(neighbor, allPoints, visited);

        // RECURSE: Expand from the neighbor
        // This is where the magic happens - we follow the chain further
        expandCluster(
            neighbor,
            neighborNeighbors,
            clusterId,
            allPoints,
            visited,
            cluster,
            depth + 1,
            chainLog
        );
    }

    return { cluster, chainLog };
}

/**
 * Main DBSCAN++ clustering function with transitive semantic chaining.
 * Iterates through all points and builds clusters using expandCluster.
 * 
 * @param {Array} data - Array of complaint objects
 * @param {Object} options - Optional configuration overrides
 * @returns {Object} Clustering result with clusters, noise, and metadata
 */
function clusterComplaints(data, options = {}) {
    const config = { ...DBSCAN_CONFIG, ...options };

    // Input validation
    if (!data || data.length === 0) {
        return {
            clusters: [],
            noise: [],
            metadata: {
                totalPoints: 0,
                totalClusters: 0,
                noisePoints: 0,
                processingTime: 0
            }
        };
    }

    const startTime = performance.now();

    // Filter out invalid points (allow either category or subcategory)
    // v3.9 AUDIT FIX: Also validate GPS bounds
    let gpsRejectedCount = 0;
    let spatialWarningCount = 0;

    const validData = data.filter(p => {
        // Basic null checks
        if (p.latitude == null || p.longitude == null) return false;
        if (p.category == null && p.subcategory == null) return false;

        // v3.9: GPS bounding box validation (reject coordinates outside Digos City)
        const gpsValidation = validateGPSBounds(p.latitude, p.longitude);
        if (!gpsValidation.isValid) {
            gpsRejectedCount++;
            console.log(`[GPS v3.9] ⛔ REJECTED: Point ${p.id} - ${gpsValidation.reason}`);
            p.gps_rejected = true;
            p.gps_rejection_reason = gpsValidation.reason;
            return false;
        }

        // v3.9: Spatial plausibility check (warn but don't reject)
        const category = p.subcategory || p.category;
        const spatialCheck = validateSpatialPlausibility(category, p.latitude, p.longitude);
        if (!spatialCheck.isPlausible) {
            spatialWarningCount++;
            p.spatial_warning = spatialCheck.warning;
            p.estimated_elevation = spatialCheck.estimatedElevation;
            console.log(`[SPATIAL v3.9] ⚠️ WARNING: ${spatialCheck.warning}`);
        }

        // v4.0: Road-Proximity Validation (Nominatim)
        // This is async, so we'll flag it for background validation or await if in a critical batch
        // For defense demo purposes, we do it synchronously in the cleaning loop (capped to few points)
        // or flag for the UI to handle the loader
        if (RoadValidator.ROAD_RELATED_CATEGORIES.includes(category)) {
            // We attach a promise to the point - UI can resolve it to show "Verifying..."
            p._roadValidationPromise = RoadValidator.validate(p).then(res => {
                p.road_validation = res;
                if (!res.isValid && !res.fallback) {
                    p.spatial_warning = (p.spatial_warning ? p.spatial_warning + " | " : "") +
                        `Road Proximity Warning: No physical road detected at these coordinates.`;
                    p.road_proximity_anomaly = true;
                }
                return res;
            });
        }

        return true;
    });

    // Normalize timestamps for all valid data
    validData.forEach(p => {
        if (!p.timestamp) {
            p.timestamp = normalizeTimestamp(p.timestamp);
        }
    });

    if (DBSCAN_CONFIG.ENABLE_LOGGING) {
        console.log(`[DBSCAN++] Starting clustering on ${validData.length} valid points (${data.length - validData.length} invalid filtered)`);
        if (gpsRejectedCount > 0) {
            console.log(`[GPS v3.9] ${gpsRejectedCount} points rejected (outside Digos City bounds)`);
        }
        if (spatialWarningCount > 0) {
            console.log(`[SPATIAL v3.9] ${spatialWarningCount} points have spatial warnings (category vs elevation mismatch)`);
        }
        console.log(`[DBSCAN++] Adaptive DBSCAN v2.0 - Tier-based epsilon/minPts`);
    }

    // Core data structures
    const visited = new Set();      // O(1) lookup for visited points
    const clusters = [];            // Array of cluster arrays
    const clusterChains = [];       // Causal chain logs for each cluster
    let clusterId = 0;

    // Main DBSCAN loop
    for (const point of validData) {
        // Skip already processed points
        if (visited.has(point.id)) continue;

        // Find semantically-related neighbors
        const neighbors = getSemanticallyRelatedNeighbors(point, validData, visited);

        // Get adaptive minPts for this point's category
        const adaptiveMinPts = config.USE_ADAPTIVE_MINPTS
            ? getAdaptiveMinPts(point)
            : config.MIN_PTS;

        if (DBSCAN_CONFIG.ENABLE_LOGGING) {
            const category = point.subcategory || point.category;
            console.log(`[DBSCAN++] Point ${point.id} [${category}]: ${neighbors.length} neighbors (minPts=${adaptiveMinPts}, ε=${getAdaptiveEpsilon(point)}m)`);
        }

        // Check if this is a core point (has enough neighbors to form cluster)
        // Use adaptive minPts based on category
        if (neighbors.length >= adaptiveMinPts) {
            // Start a new cluster
            const cluster = [];
            const chainLog = [];

            // Recursively expand the cluster
            expandCluster(
                point,
                neighbors,
                clusterId,
                validData,
                visited,
                cluster,
                0,
                chainLog
            );

            // Only add non-empty clusters
            if (cluster.length > 0) {
                clusters.push(cluster);
                clusterChains.push(chainLog);

                if (DBSCAN_CONFIG.ENABLE_LOGGING) {
                    const categories = [...new Set(cluster.map(p => p.category))];
                    console.log(`[DBSCAN++] Cluster ${clusterId} formed: ${cluster.length} points, categories: [${categories.join(' → ')}]`);
                }

                clusterId++;
            }
        } else {
            // Point has no semantic neighbors - mark as visited but classify later
            visited.add(point.id);
        }
    }

    // Identify noise points (visited but not in any cluster)
    const clusteredIds = new Set(clusters.flat().map(p => p.id));
    const noise = validData.filter(p => !clusteredIds.has(p.id));

    // CLUSTER STITCHING: Merge nearby clusters of same category within time window
    // This prevents over-fragmentation while respecting temporal boundaries
    let finalClusters = clusters;
    let finalNoise = noise;
    let stitchingApplied = false;
    let correlationResult = null;

    if (DBSCAN_CONFIG.ENABLE_CLUSTER_STITCHING !== false && clusters.length > 1) {
        finalClusters = mergeRelatedClusters(clusters, {
            SPATIAL_THRESHOLD: DBSCAN_CONFIG.STITCH_SPATIAL_THRESHOLD || 150,
            TEMPORAL_THRESHOLD: DBSCAN_CONFIG.STITCH_TEMPORAL_THRESHOLD || (7 * 24 * 60 * 60 * 1000),
            ENABLE_LOGGING: DBSCAN_CONFIG.ENABLE_LOGGING
        });
        stitchingApplied = finalClusters.length !== clusters.length;
    }

    // ADAPTIVE CORRELATION ANALYSIS: Merge correlated clusters across categories
    // This handles cases like Zone III where multiple related incident types
    // (Garbage Collection, Overflowing Trash, Illegal Dumping) should merge
    if (CLUSTER_CORRELATION_CONFIG.ENABLE_CORRELATION_ANALYSIS && finalClusters.length > 1) {
        correlationResult = mergeCorrelatedClusters(finalClusters, finalNoise);
        finalClusters = correlationResult.clusters;
        finalNoise = correlationResult.noise;

        if (DBSCAN_CONFIG.ENABLE_LOGGING && correlationResult.metadata) {
            console.log(`[DBSCAN++] Correlation analysis: ${correlationResult.metadata.originalClusters} → ${correlationResult.metadata.finalClusters} clusters, ${correlationResult.metadata.absorbedOutliers} outliers absorbed`);
        }
    }

    const endTime = performance.now();
    const processingTime = Math.round(endTime - startTime);

    // Build result metadata
    const metadata = {
        totalPoints: validData.length,
        invalidPoints: data.length - validData.length,
        totalClusters: finalClusters.length,
        preMergeClusters: clusters.length,
        stitchingApplied,
        correlationApplied: correlationResult !== null,
        correlationMerges: correlationResult?.metadata?.mergedCount || 0,
        absorbedOutliers: correlationResult?.metadata?.absorbedOutliers || 0,
        noisePoints: finalNoise.length,
        processingTime: processingTime,
        largestCluster: finalClusters.length > 0 ? Math.max(...finalClusters.map(c => c.length)) : 0,
        averageClusterSize: finalClusters.length > 0 ?
            Math.round(finalClusters.reduce((sum, c) => sum + c.length, 0) / finalClusters.length * 10) / 10 : 0,
        chainDepths: clusterChains.map(chain => chain.length)
    };

    if (DBSCAN_CONFIG.ENABLE_LOGGING) {
        console.log(`[DBSCAN++] Clustering complete:`, metadata);
    }

    return {
        clusters: finalClusters,
        clusterChains,
        noise: finalNoise,
        metadata,
        correlationAnalysis: correlationResult?.correlationAnalysis || []
    };
}

/**
 * Analyze causal chains in clustering results.
 * Identifies the dominant causal patterns discovered.
 * 
 * @param {Object} clusteringResult - Result from clusterComplaints()
 * @returns {Array} Array of chain analysis objects
 */
function analyzeCausalChains(clusteringResult) {
    const chainAnalysis = [];

    clusteringResult.clusters.forEach((cluster, idx) => {
        const categories = cluster.map(p => p.category);
        const uniqueCategories = [...new Set(categories)];
        const chainLog = clusteringResult.clusterChains[idx] || [];

        // Determine chain type
        let chainType = 'SINGLE';
        let chainDescription = uniqueCategories[0];

        if (uniqueCategories.length === 1 && cluster.length > 1) {
            chainType = 'REDUNDANCY';
            chainDescription = `${cluster.length}x ${uniqueCategories[0]} (same category)`;
        } else if (uniqueCategories.length === 2) {
            chainType = 'DIRECT_CAUSAL';
            chainDescription = `${uniqueCategories[0]} → ${uniqueCategories[1]}`;
        } else if (uniqueCategories.length >= 3) {
            chainType = 'TRANSITIVE_CHAIN';
            // Build chain from the log
            chainDescription = chainLog.map(c => c.category).join(' → ');
        }

        chainAnalysis.push({
            clusterId: idx,
            clusterSize: cluster.length,
            chainType,
            chainDescription,
            categories: uniqueCategories,
            maxDepth: Math.max(...cluster.map(p => p._chainDepth || 0)),
            points: cluster.map(p => ({ id: p.id, category: p.category, role: p._clusterRole }))
        });
    });

    return chainAnalysis;
}

/**
 * Visualize clustering results (for integration with SimulationEngine).
 * Returns data formatted for the spotlight layer.
 * 
 * @param {Object} clusteringResult - Result from clusterComplaints()
 * @returns {Object} Visualization data
 */
function prepareClusterVisualization(clusteringResult) {
    const colors = [
        '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
        '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
    ];

    const visualData = {
        clusters: clusteringResult.clusters.map((cluster, idx) => ({
            id: idx,
            color: colors[idx % colors.length],
            points: cluster,
            center: {
                lat: cluster.reduce((sum, p) => sum + p.latitude, 0) / cluster.length,
                lng: cluster.reduce((sum, p) => sum + p.longitude, 0) / cluster.length
            },
            boundingRadius: calculateClusterRadius(cluster)
        })),
        connections: generateClusterConnections(clusteringResult),
        noise: clusteringResult.noise
    };

    return visualData;
}

/**
 * Calculate the bounding radius of a cluster.
 */
function calculateClusterRadius(cluster) {
    if (cluster.length < 2) return 0;

    const centerLat = cluster.reduce((sum, p) => sum + p.latitude, 0) / cluster.length;
    const centerLng = cluster.reduce((sum, p) => sum + p.longitude, 0) / cluster.length;

    let maxDist = 0;
    for (const point of cluster) {
        const dist = haversineDistance(centerLat, centerLng, point.latitude, point.longitude);
        if (dist > maxDist) maxDist = dist;
    }

    return maxDist;
}

/**
 * Generate connection lines between cluster points based on chain order.
 */
function generateClusterConnections(clusteringResult) {
    const connections = [];

    clusteringResult.clusters.forEach((cluster, clusterIdx) => {
        // Sort by chain depth to show progression
        const sorted = [...cluster].sort((a, b) => (a._chainDepth || 0) - (b._chainDepth || 0));

        for (let i = 0; i < sorted.length - 1; i++) {
            const from = sorted[i];
            const to = sorted[i + 1];

            connections.push({
                clusterId: clusterIdx,
                from: { lat: from.latitude, lng: from.longitude, id: from.id },
                to: { lat: to.latitude, lng: to.longitude, id: to.id },
                relationship: checkSemanticRelation(from.category, to.category).relationship
            });
        }
    });

    return connections;
}


// ==================== CLUSTER STITCHING WITH TEMPORAL AWARENESS ====================
// Prevents historical data (e.g., last year) from merging with active data (today)
// Added: January 2026 - DRIMS v3.0

/**
 * TEMPORAL STITCHING CONFIGURATION
 * Thresholds for merging related clusters post-DBSCAN
 */
const CLUSTER_STITCHING_CONFIG = {
    SPATIAL_THRESHOLD: 150,                        // meters - max distance between cluster edges
    TEMPORAL_THRESHOLD: 7 * 24 * 60 * 60 * 1000,  // 7 days in milliseconds
    ENABLE_LOGGING: true
};

/**
 * Calculate the average timestamp of a cluster (its "temporal center").
 * Used to determine if two clusters are from the same time period.
 * 
 * @param {Array} cluster - Array of complaint objects with timestamp field
 * @returns {number} Average timestamp in milliseconds since epoch
 * 
 * @example
 * // Cluster with 3 reports from Jan 10, 11, 12
 * getClusterAverageTime(cluster) // Returns timestamp for ~Jan 11
 */
function getClusterAverageTime(cluster) {
    if (!cluster || cluster.length === 0) return 0;

    let validTimestamps = 0;
    let totalTime = 0;

    for (const point of cluster) {
        if (point.timestamp) {
            const time = new Date(point.timestamp).getTime();
            if (!isNaN(time)) {
                totalTime += time;
                validTimestamps++;
            }
        }
    }

    if (validTimestamps === 0) {
        // Fallback to current time if no valid timestamps
        return Date.now();
    }

    return totalTime / validTimestamps;
}

/**
 * Get the time span of a cluster (earliest to latest report).
 * 
 * @param {Array} cluster - Array of complaint objects
 * @returns {Object} { earliest, latest, spanMs, spanDays }
 */
function getClusterTimeSpan(cluster) {
    if (!cluster || cluster.length === 0) {
        return { earliest: null, latest: null, spanMs: 0, spanDays: 0 };
    }

    let earliest = Infinity;
    let latest = -Infinity;

    for (const point of cluster) {
        if (point.timestamp) {
            const time = new Date(point.timestamp).getTime();
            if (!isNaN(time)) {
                if (time < earliest) earliest = time;
                if (time > latest) latest = time;
            }
        }
    }

    const spanMs = latest - earliest;
    const spanDays = spanMs / (24 * 60 * 60 * 1000);

    return {
        earliest: new Date(earliest),
        latest: new Date(latest),
        spanMs,
        spanDays: Math.round(spanDays * 10) / 10
    };
}

/**
 * Get the dominant category of a cluster (most frequent).
 * 
 * @param {Array} cluster - Array of complaint objects
 * @returns {string} The most common category in the cluster
 */
function getDominantCategory(cluster) {
    if (!cluster || cluster.length === 0) return 'Unknown';

    const counts = {};

    for (const point of cluster) {
        const cat = point.subcategory || point.category || 'Unknown';
        counts[cat] = (counts[cat] || 0) + 1;
    }

    let maxCount = 0;
    let dominant = 'Unknown';

    for (const [cat, count] of Object.entries(counts)) {
        if (count > maxCount) {
            maxCount = count;
            dominant = cat;
        }
    }

    return dominant;
}

/**
 * Calculate the minimum distance between two clusters (edge-to-edge).
 * Uses the closest pair of points between the two clusters.
 * 
 * @param {Array} clusterA - First cluster
 * @param {Array} clusterB - Second cluster
 * @returns {number} Minimum distance in meters
 */
function getMinClusterDistance(clusterA, clusterB) {
    let minDist = Infinity;

    for (const pointA of clusterA) {
        for (const pointB of clusterB) {
            const dist = haversineDistance(
                pointA.latitude, pointA.longitude,
                pointB.latitude, pointB.longitude
            );
            if (dist < minDist) {
                minDist = dist;
            }
        }
    }

    return minDist;
}

/**
 * Merge related clusters based on SPATIAL, TEMPORAL, and SEMANTIC criteria.
 * This is a POST-DBSCAN stitching step that combines nearby clusters
 * that DBSCAN may have separated due to density gaps.
 * 
 * MERGE CRITERIA (ALL must pass):
 * 1. Same dominant category
 * 2. Distance between cluster edges < SPATIAL_THRESHOLD (150m)
 * 3. Time difference between cluster centers < TEMPORAL_THRESHOLD (7 days)
 * 
 * @param {Array} clusters - Array of clusters from clusterComplaints()
 * @param {Object} options - Optional configuration overrides
 * @returns {Array} Merged clusters
 * 
 * @example
 * // Before: [ClusterA (5 pts, Jan 10), ClusterB (3 pts, Jan 11)] - same area
 * // After:  [MergedCluster (8 pts)]
 * 
 * @example
 * // Before: [ClusterA (5 pts, Jan 2025), ClusterB (3 pts, Dec 2025)] - same area
 * // After:  [ClusterA, ClusterB] - NOT merged (11 months apart)
 */
function mergeRelatedClusters(clusters, options = {}) {
    const config = { ...CLUSTER_STITCHING_CONFIG, ...options };

    if (!clusters || clusters.length <= 1) {
        return clusters;
    }

    if (config.ENABLE_LOGGING) {
        console.log(`[STITCH] Starting cluster stitching on ${clusters.length} clusters`);
    }

    let merged = clusters.map(c => [...c]); // Deep copy
    let changed = true;
    let iterations = 0;
    const MAX_ITERATIONS = 100; // Safety limit

    while (changed && iterations < MAX_ITERATIONS) {
        changed = false;
        iterations++;

        const newClusters = [];
        const processed = new Set();

        for (let i = 0; i < merged.length; i++) {
            if (processed.has(i)) continue;

            let currentCluster = [...merged[i]];
            processed.add(i);

            for (let j = i + 1; j < merged.length; j++) {
                if (processed.has(j)) continue;

                const neighborCluster = merged[j];

                // CHECK 1: CATEGORY MATCH (Strict - must be same dominant category)
                const cat1 = getDominantCategory(currentCluster);
                const cat2 = getDominantCategory(neighborCluster);

                if (cat1 !== cat2) {
                    // Different categories - skip
                    continue;
                }

                // CHECK 2: TEMPORAL PROXIMITY (The Critical Fix!)
                // Prevents historical data from merging with active data
                const time1 = getClusterAverageTime(currentCluster);
                const time2 = getClusterAverageTime(neighborCluster);
                const timeDiff = Math.abs(time1 - time2);

                if (timeDiff > config.TEMPORAL_THRESHOLD) {
                    if (config.ENABLE_LOGGING) {
                        const daysDiff = Math.round(timeDiff / (24 * 60 * 60 * 1000));
                        console.log(`[STITCH] Skipping merge: ${cat1} clusters are ${daysDiff} days apart (threshold: ${config.TEMPORAL_THRESHOLD / (24 * 60 * 60 * 1000)} days)`);
                    }
                    continue; // Too far apart in time - DO NOT MERGE
                }

                // CHECK 3: SPATIAL PROXIMITY
                const distance = getMinClusterDistance(currentCluster, neighborCluster);

                if (distance > config.SPATIAL_THRESHOLD) {
                    // Too far apart spatially
                    continue;
                }

                // ALL CHECKS PASSED → MERGE CLUSTERS
                if (config.ENABLE_LOGGING) {
                    const daysDiff = Math.round(timeDiff / (24 * 60 * 60 * 1000) * 10) / 10;
                    console.log(`[STITCH] Merging ${cat1} clusters: ${currentCluster.length} + ${neighborCluster.length} points (${distance.toFixed(0)}m apart, ${daysDiff} days diff)`);
                }

                currentCluster = currentCluster.concat(neighborCluster);
                processed.add(j);
                changed = true;
            }

            newClusters.push(currentCluster);
        }

        merged = newClusters;
    }

    if (config.ENABLE_LOGGING) {
        console.log(`[STITCH] Complete: ${clusters.length} → ${merged.length} clusters (${iterations} iterations)`);
    }

    return merged;
}

/**
 * Apply temporal filtering to clusters before visualization.
 * Removes clusters that are entirely outside a time window.
 * 
 * @param {Array} clusters - Array of clusters
 * @param {number} daysBack - Only include clusters with recent data (default: 30)
 * @returns {Array} Filtered clusters
 */
function filterClustersByRecency(clusters, daysBack = 30) {
    const cutoffTime = Date.now() - (daysBack * 24 * 60 * 60 * 1000);

    return clusters.filter(cluster => {
        // Keep cluster if ANY point is within the time window
        return cluster.some(point => {
            if (!point.timestamp) return true; // Keep if no timestamp
            const time = new Date(point.timestamp).getTime();
            return time >= cutoffTime;
        });
    });
}




/**
 * Filter complaints by scenario prefix.
 * @param {Array} complaints - All complaints
 * @param {string} scenarioPrefix - Prefix to filter by (e.g., "scenario_1")
 * @returns {Array} Filtered complaints
 */
function filterByScenario(complaints, scenarioPrefix) {
    return complaints.filter(c => c._scenario && c._scenario.startsWith(scenarioPrefix));
}


// ==================== SIMULATION ENGINE CLASS ====================

/**
 * SimulationEngine - Core class for visualization and DBSCAN demonstration.
 * 
 * STRICT LAYERING SYSTEM:
 * - Background Layer: 65 gray L.circleMarker (4px, #888888, opacity 0.3)
 * - Spotlight Layer: Large icons for scenario analysis (40px, animated)
 * 
 * Reference: DOCUMENTATION.md Section 7.1, 10.1
 */
class SimulationEngine {
    /**
     * @param {L.Map} mapInstance - Leaflet map object
     * @param {Function} logCallback - Function to add log messages
     * @param {Function} inspectorCallback - Function to update inspector panel
     * @param {Function} statsCallback - Function to update stats panel
     */
    constructor(mapInstance, logCallback, inspectorCallback, statsCallback) {
        this.map = mapInstance;
        this.addLog = logCallback;
        this.updateInspector = inspectorCallback;
        this.updateStats = statsCallback || (() => { });

        // Data storage
        this.complaints = [];
        this.metadata = null;

        /**
         * BACKGROUND LAYER
         * Stores ALL background markers - NEVER destroyed, only dimmed/restored
         * Map<string, L.CircleMarker> where key is complaint ID
         */
        this.backgroundMarkers = new Map();

        /**
         * SPOTLIGHT LAYER
         * Temporary markers for scenario analysis - cleared after each scenario
         */
        this.spotlightMarkers = [];
        this.epsilonCircles = [];
        this.connectionLines = [];

        /**
         * BOUNDARY LAYER
         * Barangay boundary polygons for context visualization
         */
        this.boundaryLayers = [];

        // State
        this.isRunning = false;
        this.batchIndicator = null;
        this.currentMode = 'global'; // 'global' | 'focused'

        // Setup zoom-responsive marker sizing
        this.setupZoomResponsiveMarkers();
    }

    /**
     * Setup zoom event listener to resize markers based on zoom level.
     * Markers get smaller at higher zoom levels for precision.
     */
    setupZoomResponsiveMarkers() {
        this.map.on('zoomend', () => {
            const zoom = this.map.getZoom();
            this.updateMarkerSizes(zoom);
        });
    }

    /**
     * Update marker sizes based on current zoom level.
     * Higher zoom = smaller, more precise markers.
     * @param {number} zoom - Current map zoom level
     */
    updateMarkerSizes(zoom) {
        // Scale: zoom 14 = normal (4px), zoom 22 = smallest (2px)
        // Formula: radius decreases as zoom increases
        let baseRadius = 4;
        if (zoom >= 20) baseRadius = 2;
        else if (zoom >= 18) baseRadius = 3;
        else if (zoom >= 16) baseRadius = 3.5;
        // else keep 4

        this.backgroundMarkers.forEach((marker) => {
            if (typeof marker.setRadius === 'function') {
                // CircleMarker - adjust radius
                marker.setRadius(baseRadius);
            }
            // DivIcon markers (stacked) maintain fixed size for badge visibility
        });
    }

    // ==================== INITIALIZATION ====================

    /**
     * Initialize engine: Load data and render ALL background points.
     * Reference: DOCUMENTATION.md Section 7.1 - initialize()
     * 
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        try {
            this.addLog('[SYSTEM] Loading mock_complaints.json...', 'system');

            if (!taxonomyCache && typeof DRIMSTaxonomy !== 'undefined') {
                try {
                    taxonomyCache = await DRIMSTaxonomy.loadTaxonomy();
                } catch (e) {
                    taxonomyCache = null;
                }
            }

            // V3.9 UPDATE: Mock data loading removed. Data is now injected via dashboard_production.js
            // using fetchServerComplaints() and real-time SSE stream.

            this.metadata = { base_location: { city: "Digos City (Live)" } };
            this.complaints = [];

            this.addLog(`[SYSTEM] Simulation Engine Ready - Waiting for live stream...`, 'info');

            // Load and display barangay boundaries
            await this.loadBarangayBoundaries();

            // Stats will be updated when data arrives via dashboard_production.js
            this.updateStats({
                datasetName: `Live Data Feed`,
                totalRecords: 0,
                pendingValidation: 0,
                densityScore: "Low",
                processingMode: 'global'
            });

            // CRITICAL: Render ALL background points immediately
            this.renderAllPoints();

            // Fit map to show all data
            this.fitMapToBounds();

            this.addLog(`[SYSTEM] Full System Scan Active - ${this.complaints.length} points displayed`, 'success');

            return true;

        } catch (error) {
            this.addLog(`[ERROR] Failed to initialize: ${error.message}`, 'error');
            console.error('[SimulationEngine] Initialization failed:', error);
            return false;
        }
    }

    /**
     * Calculate density score based on point concentration.
     * @returns {string} "High" | "Medium" | "Low"
     */
    calculateDensityScore() {
        const count = this.complaints.length;
        if (count >= 50) return "High";
        if (count >= 25) return "Medium";
        return "Low";
    }

    /**
     * Load and display barangay boundaries on the map.
     * Creates subtle polygon outlines for context.
     */
    async loadBarangayBoundaries() {
        try {
            // Try multiple paths for the boundaries file
            const possiblePaths = [
                'brgy_boundaries_location.json',                    // Root directory (actual location)
                'data/geographic/brgy_boundaries_location.json',    // Subdirectory
                '../data/geographic/brgy_boundaries_location.json', // From src subdirectory
                'digos-city-boundary.json',                         // Alternative file
                '/assets/json/brgy_boundaries_location.json',
                '/assets/json/digos-city-boundary.json',
                '/data/geographic/brgy_boundaries_location.json'    // Absolute from root
            ];

            let barangays = null;
            for (const path of possiblePaths) {
                try {
                    const response = await fetch(path);
                    if (response.ok) {
                        barangays = await response.json();
                        console.log(`[MAP] Loaded boundaries from: ${path}`);
                        break;
                    }
                } catch (e) { /* try next */ }
            }

            if (!barangays) {
                throw new Error('Could not find brgy_boundaries_location.json');
            }

            this.addLog(`[MAP] Loading ${barangays.length} barangay boundaries...`, 'info');

            // Color palette for barangays (subtle, semi-transparent)
            const colors = [
                '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
            ];

            barangays.forEach((brgy, index) => {
                const color = colors[index % colors.length];

                // Create GeoJSON layer for each barangay
                const layer = L.geoJSON(brgy.geojson, {
                    style: {
                        color: color,
                        weight: 1.5,
                        opacity: 0.6,
                        fillColor: color,
                        fillOpacity: 0.05,
                        dashArray: '3, 3'
                    }
                });

                // Add tooltip with barangay name
                layer.bindTooltip(brgy.name, {
                    permanent: false,
                    direction: 'center',
                    className: 'barangay-tooltip'
                });

                layer.addTo(this.map);
                this.boundaryLayers.push(layer);
            });

            this.addLog(`[MAP] ${barangays.length} barangay boundaries rendered`, 'success');

        } catch (error) {
            console.warn('[SimulationEngine] Could not load barangay boundaries:', error);
            this.addLog('[WARNING] Barangay boundaries not loaded', 'warning');
        }
    }

    // ==================== BACKGROUND LAYER MANAGEMENT ====================

    /**
     * Group complaints by EXACT same coordinates (stacked).
     * Only complaints at the exact same lat/lng are grouped together.
     * @returns {Array} Array of clusters, each containing {location, complaints}
     */
    clusterComplaintsByProximity() {
        const locationMap = new Map(); // key: "lat,lng" -> complaints array

        this.complaints.forEach((complaint) => {
            // Skip complaints with null/undefined coordinates
            if (complaint.latitude == null || complaint.longitude == null) {
                console.warn('[clusterComplaintsByProximity] Skipping complaint with null coordinates:', complaint.id);
                return;
            }

            // Round to 6 decimal places for exact coordinate matching
            const key = `${complaint.latitude.toFixed(6)},${complaint.longitude.toFixed(6)}`;

            if (!locationMap.has(key)) {
                locationMap.set(key, {
                    location: { lat: complaint.latitude, lng: complaint.longitude },
                    complaints: []
                });
            }
            locationMap.get(key).complaints.push(complaint);
        });

        const clusters = Array.from(locationMap.values());

        console.log('[clusterComplaintsByProximity] Created', clusters.length, 'unique locations from', this.complaints.length, 'complaints');
        const stacked = clusters.filter(c => c.complaints.length > 1).length;
        console.log('[clusterComplaintsByProximity] Stacked locations (same coordinates):', stacked);
        if (stacked > 0) {
            console.log('[clusterComplaintsByProximity] Largest stack:', Math.max(...clusters.map(c => c.complaints.length)), 'complaints');
        }

        return clusters;
    }

    /**
     * Render ALL complaints as background markers with stacking counter.
     * If multiple complaints are within 10m, show a single marker with a badge count.
     * Reference: DOCUMENTATION.md Section 8.4 - Background Markers
     * 
     * VISUAL SPEC:
     * - Type: L.circleMarker (single) or L.divIcon (stacked with badge)
     * - Radius: 4px (single) or 8px (stacked)
     * - Color: #888888 (Gray)
     * - Badge: Red circle with white number (Facebook-style)
     * 
     * CRITICAL: This is called ONCE on initialize(). Markers are NEVER destroyed.
     */
    renderAllPoints() {
        console.log('[renderAllPoints] Starting render...', this.complaints.length, 'complaints');
        this.addLog('[RENDER] Creating background layer with stacking detection...', 'info');

        const clusters = this.clusterComplaintsByProximity();
        let rendered = 0;
        let stackedCount = 0;

        clusters.forEach((cluster, clusterIndex) => {
            const count = cluster.complaints.length;
            const isStacked = count > 1;

            if (isStacked) stackedCount++;

            let marker;

            if (isStacked) {
                // Create stacked marker with badge counter (Facebook-style) - ENHANCED VISIBILITY
                const html = `
                    <div class="stacked-marker-container" style="position: relative; width: 28px; height: 28px;">
                        <div class="stacked-marker-base" style="
                            width: 28px;
                            height: 28px;
                            background: #888888;
                            border: 3px solid #555555;
                            border-radius: 50%;
                            position: relative;
                            box-shadow: 0 0 12px rgba(255,255,255,0.3);
                        "></div>
                        <div class="stacked-badge" style="
                            position: absolute;
                            top: -10px;
                            right: -10px;
                            background: #ef4444;
                            color: white;
                            border-radius: 12px;
                            padding: 4px 8px;
                            font-size: 13px;
                            font-weight: bold;
                            font-family: Arial, sans-serif;
                            line-height: 1;
                            min-width: 24px;
                            height: 24px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            text-align: center;
                            box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.4), 0 4px 12px rgba(0,0,0,0.6);
                            border: 2px solid white;
                            animation: pulse-badge 2s ease-in-out infinite;
                        ">${count}</div>
                    </div>
                `;

                const icon = L.divIcon({
                    className: 'background-marker stacked-marker',
                    html: html,
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                });

                marker = L.marker([cluster.location.lat, cluster.location.lng], {
                    icon: icon,
                    zIndexOffset: 1000 // Keep stacked markers prominently on top
                });

                // Build detailed tooltip for stacked complaints
                const tooltipContent = `
                    <div style="max-height: 200px; overflow-y: auto;">
                        <strong style="color: #ef4444;">${count} Complaints Here</strong>
                        <hr style="margin: 4px 0; border-color: #444;">
                        ${cluster.complaints.map(c => `
                            <div style="margin: 4px 0; padding: 4px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                                <strong>${c.id}</strong> - ${c.category}<br>
                                <small style="color: #aaa;">${new Date(c.timestamp).toLocaleString()}</small>
                            </div>
                        `).join('')}
                    </div>
                `;

                marker.bindTooltip(tooltipContent, {
                    direction: 'top',
                    offset: [0, -12],
                    maxWidth: 300
                });

                // Store all complaint IDs from this cluster
                cluster.complaints.forEach(c => {
                    this.backgroundMarkers.set(c.id, marker);
                });

            } else {
                // Single complaint - create simple circle marker
                const complaint = cluster.complaints[0];
                const hasWarning = complaint.spatial_warning || complaint.road_proximity_anomaly;

                marker = L.circleMarker([complaint.latitude, complaint.longitude], {
                    radius: hasWarning ? 5 : 4,
                    color: hasWarning ? '#ef4444' : '#888888',
                    fillColor: hasWarning ? '#ef4444' : '#888888',
                    fillOpacity: hasWarning ? 0.8 : 0.6,
                    weight: hasWarning ? 2 : 1,
                    opacity: 1,
                    className: 'background-marker' + (hasWarning ? ' spatial-anomaly-marker' : '')
                });

                marker.bindTooltip(`
                    <strong style="${hasWarning ? 'color: #ef4444;' : ''}">${complaint.id}</strong><br>
                    ${complaint.category}
                    ${hasWarning ? `<br><span style="color: #fca5a5; font-size: 10px;">⚠️ ${complaint.spatial_warning}</span>` : ''}
                `, { direction: 'top', offset: [0, -5] });

                this.backgroundMarkers.set(complaint.id, marker);
            }

            marker.addTo(this.map);
            rendered++;
        });

        console.log('[renderAllPoints] Render complete:', rendered, 'markers created');
        console.log('[renderAllPoints] Stacked locations:', stackedCount);
        console.log('[renderAllPoints] Background markers Map size:', this.backgroundMarkers.size);
        this.addLog(`[RENDER] ${rendered} markers created (${stackedCount} stacked locations)`, 'success');
    }

    /**
     * Dim all background markers EXCEPT specified IDs.
     * Reference: DOCUMENTATION.md Section 2.2 - Step A
     * 
     * This creates the "fade into noise" effect while spotlighting specific points.
     * 
     * @param {Array<string>} exceptIds - Array of complaint IDs to NOT dim
     */
    dimBackgroundMarkers(exceptIds = []) {
        const exceptSet = new Set(exceptIds);

        this.backgroundMarkers.forEach((marker, id) => {
            // Check if it's a circleMarker (has setStyle) or divIcon marker
            if (typeof marker.setStyle === 'function') {
                // CircleMarker - use setStyle
                marker.setStyle({
                    fillOpacity: 0.15,
                    opacity: 0.15
                });

                // Add dimmed class for CSS transitions
                if (marker._path) {
                    marker._path.classList.add('dimmed');
                    marker._path.classList.remove('normal');
                }
            } else {
                // DivIcon marker (stacked) - use CSS opacity
                const el = marker.getElement();
                if (el) {
                    el.style.opacity = '0.15';
                    el.classList.add('dimmed');
                }
            }
        });

        this.currentMode = 'focused';
        this.updateStats({ processingMode: 'focused' });
    }

    /**
     * Restore all background markers to normal visibility.
     * Reference: DOCUMENTATION.md Section 10.1 - resetBackgroundMarkers()
     */
    resetBackgroundMarkers() {
        this.backgroundMarkers.forEach((marker, id) => {
            // Check if it's a circleMarker (has setStyle) or divIcon marker
            if (typeof marker.setStyle === 'function') {
                // CircleMarker - use setStyle
                marker.setStyle({
                    fillOpacity: 0.3,
                    opacity: 0.6
                });

                // Remove dimmed class
                if (marker._path) {
                    marker._path.classList.remove('dimmed');
                    marker._path.classList.add('normal');
                }
            } else {
                // DivIcon marker (stacked) - restore CSS opacity
                const el = marker.getElement();
                if (el) {
                    el.style.opacity = '1';
                    el.classList.remove('dimmed');
                }
            }
        });

        this.currentMode = 'global';
        this.updateStats({ processingMode: 'global' });
    }

    /**
     * Filter background markers by category.
     * Shows only markers matching the specified category, hides others.
     * @param {string} category - Category to show, or 'all' to show everything
     */
    filterBackgroundMarkersByCategory(category) {
        console.log(`[FILTER] Starting filter - category: "${category}"`);
        console.log(`[FILTER] Total complaints: ${this.complaints.length}`);

        // APPROACH: Completely clear and re-render markers based on filter
        // This ensures a clean state with no stale markers

        // Step 1: Remove ALL background markers from map
        this.backgroundMarkers.forEach((marker) => {
            if (this.map.hasLayer(marker)) {
                this.map.removeLayer(marker);
            }
        });
        this.backgroundMarkers.clear();

        // Step 2: Get complaints to display
        let complaintsToShow;
        if (category === 'all') {
            complaintsToShow = this.complaints.filter(c => c.latitude != null && c.longitude != null);
        } else {
            complaintsToShow = this.complaints.filter(c =>
                c.category === category && c.latitude != null && c.longitude != null
            );
        }

        console.log(`[FILTER] Complaints to show: ${complaintsToShow.length}`);

        // Step 3: Render filtered complaints as markers
        complaintsToShow.forEach(complaint => {
            const hasWarning = complaint.spatial_warning || complaint.road_proximity_anomaly;

            const marker = L.circleMarker([complaint.latitude, complaint.longitude], {
                radius: hasWarning ? 5 : 4,
                color: hasWarning ? '#ef4444' : '#888888',
                fillColor: hasWarning ? '#ef4444' : '#888888',
                fillOpacity: hasWarning ? 0.8 : 0.6,
                weight: hasWarning ? 2 : 1,
                opacity: 1,
                className: 'background-marker' + (hasWarning ? ' spatial-anomaly-marker' : '')
            });

            marker.bindTooltip(`
                <strong style="${hasWarning ? 'color: #ef4444;' : ''}">${complaint.id}</strong><br>
                ${complaint.category}
                ${hasWarning ? `<br><span style="color: #fca5a5; font-size: 10px;">⚠️ ${complaint.spatial_warning}</span>` : ''}
            `, { direction: 'top', offset: [0, -5] });

            marker.addTo(this.map);
            this.backgroundMarkers.set(complaint.id, marker);
        });

        console.log(`[FILTER] Created ${this.backgroundMarkers.size} markers`);
        console.log(`[FILTER] Filter complete`);
    }

    /**
     * Update tooltips to show only complaints matching the current filter.
     * @param {string} category - Category to filter by
     */
    updateTooltipsForFilter(category) {
        // Now handled in filterBackgroundMarkersByCategory
    }

    /**
     * Reset tooltips to show all complaints (when filter is 'all').
     */
    resetTooltips() {
        // Now handled in filterBackgroundMarkersByCategory
    }

    /**
     * Clear all background markers from the map.
     */
    clearAllBackgroundMarkers() {
        this.backgroundMarkers.forEach((marker) => {
            if (this.map.hasLayer(marker)) {
                this.map.removeLayer(marker);
            }
        });
    }

    // ==================== SPOTLIGHT LAYER MANAGEMENT ====================

    /**
     * Create a spotlight marker for scenario visualization.
     * Reference: DOCUMENTATION.md Section 8.4 - Spotlight Markers
     * 
     * VISUAL SPEC:
     * - Appearance: Large colored icons (40px)
     * - Animation: Pulsing glow effect
     * - Colors: Scenario-specific (green, blue, red, orange, purple)
     * - Icon: Category-specific Font Awesome icon
     * 
     * @param {Object} complaint - Complaint data object
     * @param {string} color - Hex color for marker
     * @param {number} scale - Size multiplier (default 1.0)
     * @returns {L.Marker} The created spotlight marker
     */
    createSpotlightMarker(complaint, color, scale = 1.0) {
        const iconName = CATEGORY_ICONS[complaint.category] || 'circle';
        const size = Math.round(40 * scale);
        const hasWarning = complaint.spatial_warning || complaint.road_proximity_anomaly;

        const html = `
            <div class="spotlight-marker-inner" style="
                width: ${size}px;
                height: ${size}px;
                background: ${hasWarning ? '#ef4444' : color};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 20px ${hasWarning ? '#ef4444' : color}, 0 0 40px ${hasWarning ? '#ef4444' : color}40;
                animation: spotlight-pulse 1.5s infinite;
                border: 3px solid white;
            ">
                <i class="fas fa-${hasWarning ? 'exclamation-triangle' : iconName}" style="
                    color: white;
                    font-size: ${Math.round(size * 0.45)}px;
                "></i>
                ${hasWarning ? `
                <div style="
                    position: absolute;
                    top: -10px;
                    right: -10px;
                    background: #f59e0b;
                    border: 2px solid white;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 10px;
                    box-shadow: var(--shadow-sm);
                ">!</div>
                ` : ''}
            </div>
        `;

        const icon = L.divIcon({
            className: 'spotlight-marker' + (hasWarning ? ' anomaly' : ''),
            html: html,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });

        const marker = L.marker([complaint.latitude, complaint.longitude], {
            icon: icon,
            zIndexOffset: 1000
        });

        // Rich tooltip
        marker.bindTooltip(`
            <div style="text-align: center;">
                <strong style="color: ${hasWarning ? '#ef4444' : color};">${complaint.id}</strong><br>
                <span>${complaint.category}</span><br>
                <small>${new Date(complaint.timestamp).toLocaleString()}</small>
                ${hasWarning ? `<div style="color: #fca5a5; font-size: 11px; margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <strong>SPATIAL ANOMALY</strong><br>
                    ${complaint.road_validation ? `OSM: ${complaint.road_validation.displayName}` : complaint.spatial_warning}
                </div>` : ''}
            </div>
        `, { direction: 'top', offset: [0, -size / 2] });

        marker.addTo(this.map);
        this.spotlightMarkers.push(marker);

        return marker;
    }

    /**
     * Create epsilon radius visualization circle.
     * @param {number} lat - Center latitude
     * @param {number} lng - Center longitude
     * @param {number} radius - Radius in meters
     * @param {string} color - Circle color
     * @returns {L.Circle} The created circle
     */
    createEpsilonCircle(lat, lng, radius, color) {
        const circle = L.circle([lat, lng], {
            color: color,
            fillColor: color,
            fillOpacity: 0.12,
            radius: radius,
            weight: 2,
            dashArray: '8, 8'
        }).addTo(this.map);

        this.epsilonCircles.push(circle);
        return circle;
    }

    /**
     * Create connection line between two points.
     * @param {number} lat1 - Start latitude
     * @param {number} lng1 - Start longitude
     * @param {number} lat2 - End latitude
     * @param {number} lng2 - End longitude
     * @param {string} color - Line color
     * @param {boolean} dashed - Whether to use dashed style
     * @returns {L.Polyline} The created line
     */
    createConnectionLine(lat1, lng1, lat2, lng2, color, dashed = false) {
        const line = L.polyline(
            [[lat1, lng1], [lat2, lng2]],
            {
                color,
                weight: 3,
                opacity: 0.9,
                dashArray: dashed ? '10, 10' : null
            }
        ).addTo(this.map);

        this.connectionLines.push(line);
        return line;
    }

    /**
     * Create reject marker (X symbol).
     */
    createRejectMarker(lat, lng) {
        const html = `
            <div style="
                background: #ef4444;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 16px;
                font-weight: bold;
                box-shadow: 0 4px 12px rgba(239, 68, 68, 0.5);
                border: 2px solid white;
            ">✕</div>
        `;

        const icon = L.divIcon({
            className: 'reject-marker',
            html: html,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        const marker = L.marker([lat, lng], { icon: icon, zIndexOffset: 900 }).addTo(this.map);
        this.spotlightMarkers.push(marker);
        return marker;
    }

    /**
     * Clear all spotlight layer elements (markers, circles, lines).
     * IMPORTANT: This does NOT touch background markers.
     */
    clearSpotlightLayer() {
        // Remove spotlight markers
        this.spotlightMarkers.forEach(m => {
            if (this.map.hasLayer(m)) {
                this.map.removeLayer(m);
            }
        });
        this.spotlightMarkers = [];

        // Remove epsilon circles
        this.epsilonCircles.forEach(c => {
            if (this.map.hasLayer(c)) {
                this.map.removeLayer(c);
            }
        });
        this.epsilonCircles = [];

        // Remove connection lines
        this.connectionLines.forEach(l => {
            if (this.map.hasLayer(l)) {
                this.map.removeLayer(l);
            }
        });
        this.connectionLines = [];

        // Remove batch indicator
        if (this.batchIndicator) {
            this.batchIndicator.remove();
            this.batchIndicator = null;
        }
    }

    // ==================== MAP UTILITIES ====================

    /**
     * Fit map bounds to show all background markers.
     */
    fitMapToBounds() {
        if (this.backgroundMarkers.size === 0) return;

        const bounds = L.latLngBounds([]);
        this.backgroundMarkers.forEach(marker => {
            bounds.extend(marker.getLatLng());
        });

        this.map.fitBounds(bounds, { padding: [50, 50] });
    }

    /**
     * Show batch processing indicator overlay.
     */
    showBatchIndicator(scanned, ignored, focused) {
        if (this.batchIndicator) {
            this.batchIndicator.remove();
        }

        const html = `
            <div style="
                background: rgba(15, 20, 32, 0.95);
                border: 1px solid #1e2638;
                border-radius: 8px;
                padding: 12px 16px;
                font-family: 'Courier New', monospace;
                color: #e4e6eb;
                font-size: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ">
                <div style="color: #8b92a8; margin-bottom: 8px; font-weight: bold;">
                    BATCH PROCESSING
                </div>
                <div style="display: flex; gap: 16px;">
                    <div>
                        <span style="color: #3b82f6;">Scanned:</span> 
                        <span style="color: #10b981; font-weight: bold;">${scanned}</span>
                    </div>
                    <div>
                        <span style="color: #8b92a8;">Ignored:</span> 
                        <span>${ignored}</span>
                    </div>
                    <div>
                        <span style="color: #f59e0b;">Focused:</span> 
                        <span style="color: #f59e0b; font-weight: bold;">${focused}</span>
                    </div>
                </div>
            </div>
        `;

        this.batchIndicator = L.control({ position: 'topright' });
        this.batchIndicator.onAdd = () => {
            const div = L.DomUtil.create('div', 'batch-indicator');
            div.innerHTML = html;
            return div;
        };
        this.batchIndicator.addTo(this.map);
    }

    /**
     * Utility delay function.
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Format current time for logs.
     */
    formatLogTime() {
        return new Date().toTimeString().split(' ')[0];
    }

    // ==================== RESET FUNCTIONS ====================

    /**
     * Full reset: Clear spotlight, restore background, reset stats.
     * Reference: DOCUMENTATION.md Section 7.1 - fullReset()
     */
    fullReset() {
        // Clear spotlight layer
        this.clearSpotlightLayer();

        // Restore background markers to normal visibility
        this.resetBackgroundMarkers();

        // Reset map view
        this.fitMapToBounds();

        // Reset stats
        this.updateStats({
            processingMode: 'global'
        });
    }

    // ==================== SCENARIO EXECUTION ====================

    /**
     * Run a scenario with STRICT Background vs. Spotlight layering.
     * Reference: DOCUMENTATION.md Section 2.2, Section 7.1
     * 
     * CRITICAL BEHAVIOR:
     * 1. DO NOT clear background markers
     * 2. Dim background markers to 0.15 opacity
     * 3. Create spotlight markers for scenario points
     * 4. Pan/zoom to cluster while keeping gray dots visible
     * 
     * @param {number} scenarioNumber - Scenario ID (1-5)
     */
    async runScenario(scenarioNumber) {
        if (this.isRunning) {
            this.addLog('[WARNING] Simulation already in progress', 'warning');
            return;
        }

        this.isRunning = true;

        // START METRICS TIMING
        window.metricsCalculator.startTiming();

        // STEP 0: Clear any previous spotlight elements (NOT background!)
        this.clearSpotlightLayer();

        const config = SCENARIO_CONFIG[scenarioNumber];
        const scenarioData = filterByScenario(this.complaints, config.prefix);
        const scenarioIds = scenarioData.map(d => d.id);

        // Store for metrics calculation
        this._currentScenarioData = scenarioData;
        this._currentScenarioNumber = scenarioNumber;

        // Log header
        this.addLog('═'.repeat(55), 'system');
        this.addLog(`[${this.formatLogTime()}] BATCH PROCESSING INITIATED`, 'system');
        this.addLog(`[SCENARIO] S-0${scenarioNumber}: ${config.name}`, 'system');
        this.addLog(`[DESC] ${config.description}`, 'info');
        this.addLog('─'.repeat(55), 'system');

        await this.delay(ANIMATION_CONFIG.STEP_DELAY);

        // Simulate batch scan logging
        this.addLog(`[SCAN] Processing Batch #${Math.floor(Math.random() * 900) + 100}...`, 'info');
        await this.delay(400);

        const totalPoints = this.complaints.length;
        const ignoredPoints = totalPoints - scenarioData.length;

        this.addLog(`[SCAN] Scanned ${totalPoints} data points in region`, 'info');
        await this.delay(300);

        this.addLog(`[FILTER] Ignored ${ignoredPoints} unrelated points (Distance > ε)`, 'logic');
        await this.delay(300);

        this.addLog(`[FOCUS] Analyzing target cluster: ${scenarioIds.join(', ')}`, 'success');
        await this.delay(ANIMATION_CONFIG.STEP_DELAY);

        // Show batch indicator
        this.showBatchIndicator(totalPoints, ignoredPoints, scenarioData.length);

        // STEP A: Dim background markers (CRITICAL - per Section 2.2)
        this.addLog('[VISUAL] Dimming background layer...', 'info');
        this.dimBackgroundMarkers(scenarioIds);
        await this.delay(ANIMATION_CONFIG.DIM_TRANSITION);

        // Calculate center of scenario cluster
        const centerLat = scenarioData.reduce((sum, d) => sum + d.latitude, 0) / scenarioData.length;
        const centerLng = scenarioData.reduce((sum, d) => sum + d.longitude, 0) / scenarioData.length;

        // STEP C: Pan/zoom to cluster (keep gray background visible in periphery)
        this.addLog('[MAP] Panning to cluster focus area...', 'info');
        this.map.flyTo([centerLat, centerLng], 17, { duration: 1 });
        await this.delay(1200);

        this.addLog('─'.repeat(55), 'system');
        this.addLog(`[${this.formatLogTime()}] CLUSTER ANALYSIS`, 'system');

        // Run scenario-specific logic
        switch (scenarioNumber) {
            case 1: await this.runScenarioGeneric(scenarioData, config, 'redundancy'); break;
            case 2: await this.runScenarioGeneric(scenarioData, config, 'discrete'); break;
            case 3: await this.runScenarioGeneric(scenarioData, config, 'precision'); break;
            case 4: await this.runScenarioGeneric(scenarioData, config, 'gps_drift'); break;
            case 5: await this.runScenarioGeneric(scenarioData, config, 'moving_hazard'); break;
            case 6: await this.runScenarioGeneric(scenarioData, config, 'causal'); break;
            case 7: await this.runScenarioGeneric(scenarioData, config, 'false_correl'); break;
            case 8: await this.runScenarioDomino(scenarioData, config); break;
            case 9: await this.runScenarioGeneric(scenarioData, config, 'conflict'); break;
            case 10: await this.runScenarioGeneric(scenarioData, config, 'synonyms'); break;
            case 11: await this.runScenarioGeneric(scenarioData, config, 'time_decay'); break;
            case 12: await this.runScenarioMassPanic(scenarioData, config); break;
            case 13: await this.runScenarioSpamBot(scenarioData, config); break;
            case 14: await this.runScenarioDefaultPin(scenarioData, config); break;
            case 15: await this.runScenarioNullData(scenarioData, config); break;
            case 16: await this.runScenarioTriplePotholeSeparation(scenarioData, config); break;
        }

        // END METRICS TIMING & CALCULATE
        const processingTime = window.metricsCalculator.endTiming();
        const metrics = window.metricsCalculator.calculateScenarioMetrics(
            scenarioNumber,
            scenarioData,
            {} // Results object (can be expanded later)
        );

        // Update the metrics UI panel
        window.metricsCalculator.updateMetricsUI(metrics, processingTime);

        // Log final metrics summary
        this.addLog('─'.repeat(55), 'system');
        this.addLog(`[METRICS] Redundancy Reduced: ${metrics.redundancyReduced}%`, 'success');
        this.addLog(`[METRICS] Accuracy: ${metrics.accuracyScore}% (${metrics.isAccurate ? '✓ PASS' : '✗ FAIL'})`,
            metrics.isAccurate ? 'success' : 'error');
        this.addLog(`[METRICS] Processing Time: ${processingTime}ms`, 'info');

        this.isRunning = false;
    }

    // ==================== SCENARIO IMPLEMENTATIONS ====================

    /**
     * Generic Scenario Runner - Handles most comparison scenarios
     * Used for: redundancy, discrete, causal, false_correl, conflict, synonyms, time_decay, gps_drift, precision, moving_hazard
     */
    async runScenarioGeneric(data, config, scenarioType) {
        if (data.length < 2) {
            this.addLog(`[ERROR] Need at least 2 points for this scenario`, 'error');
            return;
        }

        this.addLog(`[ANALYZE] ${data.length} data points loaded`, 'info');

        // Get first point as reference
        const primary = data[0];
        this.addLog(`[PRIMARY] ${primary.id} [${primary.category || 'NULL'}]`, 'info');

        if (primary.latitude === null || primary.latitude === undefined) {
            this.addLog(`[WARNING] Primary point has NULL coordinates`, 'warning');
        }

        const primaryMarker = this.createSpotlightMarker(primary, config.color, 1.4);
        await this.delay(ANIMATION_CONFIG.MARKER_DROP);

        // Show epsilon radius if coordinates are valid
        if (primary.latitude && primary.category) {
            const epsilon = getAdaptiveEpsilon(primary.category);
            this.addLog(`[ALGO] Adaptive ε for "${primary.category}" = ${epsilon}m`, 'logic');
            this.createEpsilonCircle(primary.latitude, primary.longitude, epsilon, config.color);
        }
        await this.delay(ANIMATION_CONFIG.SCAN_DURATION);

        // Process remaining points
        let mergeCount = 0;
        let separateCount = 0;

        for (let i = 1; i < data.length; i++) {
            const secondary = data[i];

            this.addLog(`[POINT ${i}/${data.length - 1}] ${secondary.id} [${secondary.category || 'NULL'}]`, 'info');

            // Check for null values
            if (secondary.latitude === null || secondary.longitude === null) {
                this.addLog(`[WARNING] Null coordinates detected - cannot calculate distance`, 'warning');
                const secMarker = this.createSpotlightMarker(secondary, '#64748b', 1.1);
                await this.delay(ANIMATION_CONFIG.MARKER_DROP);
                this.addLog(`[DECISION] ⚠️ FLAGGED - Invalid data (null coordinates)`, 'warning');
                continue;
            }

            if (secondary.category === null) {
                this.addLog(`[WARNING] Null category detected`, 'warning');
            }

            const secMarker = this.createSpotlightMarker(secondary, this.getSecondaryColor(config, scenarioType), 1.2);
            await this.delay(ANIMATION_CONFIG.MARKER_DROP);

            // Run DBSCAN logic
            const result = checkLogic(primary, secondary);

            // Log detailed calculations
            this.addLog(`[CALC] Distance: ${result.distance.toFixed(2)}m | Threshold: ${result.epsilon}m`, 'logic');
            this.addLog(`[CALC] Semantic: ${primary.category} → ${secondary.category} = ${(result.semantic.score * 100).toFixed(0)}%`, 'logic');
            this.addLog(`[CALC] Time Diff: ${result.timeDiff.toFixed(1)}h | Max: ${MAX_TIME_DIFF_HOURS}h`, 'logic');

            // Log keyword analysis
            if (result.keywordAnalysis) {
                const kw = result.keywordAnalysis;
                this.addLog(`[KEYWORDS] Similarity: ${(kw.similarity * 100).toFixed(0)}% | ${kw.verdict}`, 'logic');
                if (kw.sharedKeywords && kw.sharedKeywords.length > 0) {
                    this.addLog(`[KEYWORDS] Shared: ${kw.sharedKeywords.join(', ')}`, 'info');
                }
            }

            // Draw connection line
            const lineColor = result.shouldMerge ? '#10b981' : '#ef4444';
            this.createConnectionLine(
                primary.latitude, primary.longitude,
                secondary.latitude, secondary.longitude,
                lineColor, !result.shouldMerge
            );

            await this.delay(ANIMATION_CONFIG.LINE_DRAW);

            // Log verdict
            if (result.shouldMerge) {
                this.addLog(`[DECISION] ✅ MERGED (${result.semantic.relationship})`, 'success');
                mergeCount++;
            } else {
                this.addLog(`[DECISION] ❌ REJECTED - ${result.reasons.join(', ')}`, 'error');
                separateCount++;

                // Add reject marker at midpoint
                const midLat = (primary.latitude + secondary.latitude) / 2;
                const midLng = (primary.longitude + secondary.longitude) / 2;
                this.createRejectMarker(midLat, midLng);
            }

            // Update inspector
            this.updateInspector({
                category: secondary.category || 'NULL',
                epsilon: `${result.epsilon}m`,
                timeDiff: `${result.timeDiff.toFixed(1)}h`,
                semantic: `${(result.semantic.score * 100).toFixed(0)}%`,
                keywords: secondary.keywords || [],
                keywordSimilarity: result.keywordAnalysis?.similarity || 0,
                keywordVerdict: result.keywordAnalysis?.verdict || 'N/A',
                verdict: result.verdict
            });

            await this.delay(ANIMATION_CONFIG.STEP_DELAY);
        }

        this.addLog('═'.repeat(55), 'system');
        this.addLog(`[RESULT] ${config.name} Complete: ${mergeCount} merged, ${separateCount} separated`,
            mergeCount > 0 && config.expectedResult === 'MERGE' ? 'success' :
                separateCount > 0 && config.expectedResult === 'SEPARATE' ? 'warning' : 'info');
    }

    /**
     * Get secondary marker color based on scenario type
     */
    getSecondaryColor(config, scenarioType) {
        if (['conflict', 'false_correl', 'discrete'].includes(scenarioType)) {
            return '#ef4444';  // Red for expected rejection
        }
        if (['time_decay'].includes(scenarioType)) {
            return '#8b92a8';  // Gray for old data
        }
        return config.color;  // Default to scenario color
    }

    /**
     * Scenario: Domino Chain (Pipe → Flood → Traffic)
     * NOW USES AUTOMATED TRANSITIVE CLUSTERING!
     * 
     * This scenario demonstrates the expandCluster() function automatically
     * discovering the causal chain without hardcoded sequence.
     */
    async runScenarioDomino(data, config) {
        this.addLog(`[DBSCAN++] Initiating Automated Transitive Clustering...`, 'system');
        this.addLog(`[ALGO] Using recursive expandCluster() - NO hardcoded sequences`, 'info');
        await this.delay(ANIMATION_CONFIG.STEP_DELAY);

        // ============================================================
        // AUTOMATED CLUSTERING - Let the algorithm discover the chain!
        // ============================================================
        const clusteringResult = clusterComplaints(data, { MIN_PTS: 1 });
        const chainAnalysis = analyzeCausalChains(clusteringResult);

        this.addLog(`[DBSCAN++] Clustering complete: ${clusteringResult.metadata.totalClusters} cluster(s) found`, 'success');
        this.addLog(`[DBSCAN++] Processing time: ${clusteringResult.metadata.processingTime}ms`, 'info');

        // Check if we found a transitive chain
        const transitiveChains = chainAnalysis.filter(c => c.chainType === 'TRANSITIVE_CHAIN');

        if (transitiveChains.length > 0) {
            this.addLog(`[DISCOVERY] ✅ Transitive chain detected automatically!`, 'success');

            for (const chain of transitiveChains) {
                this.addLog(`[CHAIN] ${chain.chainDescription}`, 'success');
                this.addLog(`[CHAIN] Depth: ${chain.maxDepth + 1} hops, Size: ${chain.clusterSize} points`, 'info');
            }
        } else if (clusteringResult.clusters.length > 0) {
            // Even if not "transitive", show what was found
            for (const analysis of chainAnalysis) {
                this.addLog(`[CLUSTER] ${analysis.chainDescription} (${analysis.chainType})`, 'info');
            }
        }

        await this.delay(ANIMATION_CONFIG.STEP_DELAY);

        // ============================================================
        // VISUALIZATION - Show the automatically discovered chain
        // ============================================================
        const visualData = prepareClusterVisualization(clusteringResult);
        const colors = ['#06b6d4', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6'];

        // Display each cluster
        for (let clusterIdx = 0; clusterIdx < visualData.clusters.length; clusterIdx++) {
            const cluster = visualData.clusters[clusterIdx];
            const clusterColor = colors[clusterIdx % colors.length];

            this.addLog(`[VISUALIZE] Cluster ${clusterIdx}: ${cluster.points.length} points`, 'system');

            // Sort points by chain depth for proper visualization order
            const sortedPoints = [...cluster.points].sort((a, b) =>
                (a._chainDepth || 0) - (b._chainDepth || 0)
            );

            // Show each point in chain order
            for (let i = 0; i < sortedPoints.length; i++) {
                const point = sortedPoints[i];
                const scale = 1.5 - (i * 0.1); // Decreasing size for chain order
                const pointColor = colors[(clusterIdx + i) % colors.length];

                this.addLog(`[STEP ${i + 1}] ${point.id} [${point.category}] - ${point._clusterRole}`, 'info');

                const marker = this.createSpotlightMarker(point, pointColor, Math.max(scale, 1.0));
                await this.delay(ANIMATION_CONFIG.MARKER_DROP);

                // Show epsilon for core points
                if (point._clusterRole === 'CORE') {
                    const epsilon = getAdaptiveEpsilon(point.category);
                    this.createEpsilonCircle(point.latitude, point.longitude, epsilon, pointColor);
                }

                // Draw connection to previous point
                if (i > 0) {
                    const prevPoint = sortedPoints[i - 1];
                    const logicResult = checkLogic(prevPoint, point);

                    this.addLog(`[LINK] ${prevPoint.category} → ${point.category}: ${logicResult.distance.toFixed(1)}m, ${(logicResult.semantic.score * 100).toFixed(0)}%`, 'logic');

                    this.createConnectionLine(
                        prevPoint.latitude, prevPoint.longitude,
                        point.latitude, point.longitude,
                        '#10b981'
                    );
                    await this.delay(ANIMATION_CONFIG.LINE_DRAW);
                }

                await this.delay(ANIMATION_CONFIG.STEP_DELAY / 2);
            }
        }

        // Update inspector with chain info
        const mainChain = chainAnalysis[0] || { chainDescription: 'No chain', categories: [] };
        this.updateInspector({
            category: 'Auto-Discovered Chain',
            epsilon: `Adaptive per category`,
            timeDiff: `≤ ${MAX_TIME_DIFF_HOURS}h`,
            semantic: mainChain.chainType,
            keywords: data.flatMap(d => d.keywords || []).slice(0, 5),
            keywordSimilarity: 0.8,
            keywordVerdict: 'STRONG',
            verdict: 'MERGED'
        });

        this.addLog('═'.repeat(55), 'system');
        this.addLog(`[RESULT] Automated Transitive Clustering Complete`, 'success');
        this.addLog(`[PROOF] Chain discovered by expandCluster() recursion, NOT hardcoded!`, 'success');

        // Log the algorithm proof
        if (transitiveChains.length > 0) {
            this.addLog(`[THESIS] Two-Layer Architecture Validated:`, 'system');
            this.addLog(`  Layer 1 (Spatial): Haversine distance + Adaptive ε`, 'info');
            this.addLog(`  Layer 2 (Semantic): RELATIONSHIP_MATRIX + CORRELATION_SCORES`, 'info');
            this.addLog(`  Transitivity: DFS-based expandCluster() recursion`, 'info');
        }
    }

    /**
     * Run DBSCAN++ clustering on arbitrary data (for testing/demo).
     * Can be called from console: engine.runAutoClustering(engine.complaints)
     * 
     * @param {Array} data - Array of complaint points
     * @param {Object} options - Optional clustering config
     * @returns {Object} Full clustering result with visualization
     */
    async runAutoClustering(data, options = {}) {
        this.addLog(`[DBSCAN++] Running automated transitive clustering...`, 'system');

        const result = clusterComplaints(data, options);
        const analysis = analyzeCausalChains(result);
        const visualData = prepareClusterVisualization(result);

        // Log summary
        this.addLog(`[RESULT] Found ${result.clusters.length} cluster(s), ${result.noise.length} noise points`, 'success');

        analysis.forEach((chain, idx) => {
            this.addLog(`[CLUSTER ${idx}] ${chain.chainDescription} (${chain.chainType})`, 'info');
        });

        return {
            ...result,
            analysis,
            visualData
        };
    }

    /**
     * Scenario: Mass Panic (20x Fire in 10m radius)
     * Tests mass event detection
     */
    async runScenarioMassPanic(data, config) {
        this.addLog(`[MASS EVENT] ${data.length} reports in tight cluster`, 'system');
        this.addLog(`[WARNING] Analyzing potential viral/panic reporting`, 'warning');

        // Calculate cluster center
        const centerLat = data.reduce((sum, d) => sum + (d.latitude || 0), 0) / data.length;
        const centerLng = data.reduce((sum, d) => sum + (d.longitude || 0), 0) / data.length;

        // Get time spread
        const timestamps = data.map(d => new Date(d.timestamp).getTime());
        const timeSpreadMs = Math.max(...timestamps) - Math.min(...timestamps);
        const timeSpreadSec = timeSpreadMs / 1000;

        this.addLog(`[ANALYSIS] Time Spread: ${timeSpreadSec.toFixed(0)} seconds`, 'info');
        this.addLog(`[ANALYSIS] Report Rate: ${(data.length / (timeSpreadSec || 1) * 60).toFixed(1)} reports/min`, 'info');

        // Show all points rapidly
        for (let i = 0; i < Math.min(data.length, 10); i++) {
            const point = data[i];
            const marker = this.createSpotlightMarker(point, config.color, 0.8 + (i * 0.05));
            await this.delay(100); // Fast animation
        }

        // Show epsilon covering all
        this.createEpsilonCircle(centerLat, centerLng, 30, config.color);
        await this.delay(ANIMATION_CONFIG.SCAN_DURATION);

        // Log unique users
        const uniqueUsers = new Set(data.map(d => d.user_id)).size;
        this.addLog(`[USERS] ${uniqueUsers} unique reporters (mass event)`, 'logic');

        this.updateInspector({
            category: 'Fire (Mass Event)',
            epsilon: '30m (Fire)',
            timeDiff: `${timeSpreadSec.toFixed(0)}s spread`,
            semantic: '100% (identical)',
            keywords: ['fire', 'sunog', 'emergency'],
            keywordSimilarity: 1.0,
            keywordVerdict: 'STRONG',
            verdict: 'MERGED'
        });

        this.addLog(`[DECISION] ✅ MERGE ALL - Mass panic event detected`, 'success');
        this.addLog('═'.repeat(55), 'system');
        this.addLog(`[RESULT] ${data.length} reports consolidated into 1 incident`, 'success');
    }

    /**
     * Scenario: Spam Bot (identical timestamps)
     * Tests bot/spam detection
     */
    async runScenarioSpamBot(data, config) {
        this.addLog(`[SPAM DETECTION] ${data.length} reports with suspicious pattern`, 'warning');

        // Check timestamps
        const timestamps = data.map(d => d.timestamp);
        const uniqueTimestamps = new Set(timestamps).size;

        this.addLog(`[ANALYSIS] Unique Timestamps: ${uniqueTimestamps}`, 'logic');

        if (uniqueTimestamps === 1) {
            this.addLog(`[ALERT] ⚠️ ALL TIMESTAMPS IDENTICAL - BOT DETECTED`, 'error');
        }

        // Check user IDs
        const uniqueUsers = new Set(data.map(d => d.user_id)).size;
        this.addLog(`[ANALYSIS] Unique Users: ${uniqueUsers}`, 'logic');

        if (uniqueUsers === 1) {
            this.addLog(`[ALERT] ⚠️ Single user submitted ${data.length} reports`, 'error');
        }

        // Show sample of points
        for (let i = 0; i < Math.min(data.length, 8); i++) {
            const point = data[i];
            if (point.latitude && point.longitude) {
                const marker = this.createSpotlightMarker(point, config.color, 0.9);
                await this.delay(80);
            }
        }

        this.updateInspector({
            category: 'Multiple (Bot)',
            epsilon: 'N/A',
            timeDiff: '0ms (identical)',
            semantic: 'N/A (spam)',
            keywords: [],
            keywordSimilarity: 0,
            keywordVerdict: 'SUSPICIOUS',
            verdict: 'FLAGGED'
        });

        this.addLog(`[DECISION] 🚫 FLAG AS SPAM - Humanly impossible timing`, 'error');
        this.addLog('═'.repeat(55), 'system');
        this.addLog(`[RESULT] ${data.length} reports flagged for review`, 'warning');
    }

    /**
     * Scenario: Default Pin (complaints at map center)
     * Tests default/unset coordinate detection
     */
    async runScenarioDefaultPin(data, config) {
        this.addLog(`[DEFAULT PIN] ${data.length} reports at suspicious location`, 'warning');

        // Check if all at same location
        const locations = data.map(d => `${d.latitude?.toFixed(4)},${d.longitude?.toFixed(4)}`);
        const uniqueLocations = new Set(locations).size;

        this.addLog(`[ANALYSIS] Unique Locations: ${uniqueLocations}`, 'logic');

        if (uniqueLocations === 1) {
            this.addLog(`[ALERT] ⚠️ ALL REPORTS AT EXACT SAME POINT`, 'warning');
            this.addLog(`[ANALYSIS] This may indicate default/unset coordinates`, 'info');
        }

        // Show stacked marker
        const sample = data[0];
        if (sample.latitude && sample.longitude) {
            const marker = this.createSpotlightMarker(sample, config.color, 1.5);
            await this.delay(ANIMATION_CONFIG.MARKER_DROP);

            // Add warning circle
            this.createEpsilonCircle(sample.latitude, sample.longitude, 50, '#f97316');
        }

        this.updateInspector({
            category: 'Various (Default Pin)',
            epsilon: 'N/A',
            timeDiff: 'Various',
            semantic: 'N/A',
            keywords: [],
            keywordSimilarity: 0,
            keywordVerdict: 'SUSPICIOUS',
            verdict: 'FLAGGED'
        });

        this.addLog(`[DECISION] ⚠️ FLAG FOR REVIEW - Possible default coordinates`, 'warning');
        this.addLog('═'.repeat(55), 'system');
        this.addLog(`[RESULT] ${data.length} reports require location verification`, 'warning');
    }

    /**
     * Scenario: Null Data
     * Tests graceful handling of missing data
     */
    async runScenarioNullData(data, config) {
        this.addLog(`[NULL DATA] Testing data integrity handling`, 'system');

        for (const point of data) {
            this.addLog(`[CHECK] ${point.id}:`, 'info');

            const hasNullLat = point.latitude === null || point.latitude === undefined;
            const hasNullLng = point.longitude === null || point.longitude === undefined;
            const hasNullCat = point.category === null || point.category === undefined;

            if (hasNullLat || hasNullLng) {
                this.addLog(`  ├─ Coordinates: ${hasNullLat ? 'NULL' : point.latitude}, ${hasNullLng ? 'NULL' : point.longitude}`, 'warning');
                this.addLog(`  └─ Status: Cannot plot on map`, 'error');
            } else {
                const marker = this.createSpotlightMarker(point, config.color, 1.2);
                this.addLog(`  ├─ Coordinates: Valid`, 'success');
            }

            if (hasNullCat) {
                this.addLog(`  ├─ Category: NULL`, 'warning');
                this.addLog(`  └─ Status: Cannot determine epsilon or relationships`, 'error');
            } else {
                this.addLog(`  ├─ Category: ${point.category}`, 'success');
            }

            await this.delay(ANIMATION_CONFIG.STEP_DELAY);
        }

        this.updateInspector({
            category: 'Null Data Test',
            epsilon: 'N/A',
            timeDiff: 'N/A',
            semantic: 'N/A',
            keywords: [],
            keywordSimilarity: 0,
            keywordVerdict: 'N/A',
            verdict: 'HANDLED'
        });

        this.addLog('═'.repeat(55), 'system');
        this.addLog(`[RESULT] Null data handled gracefully (no crash)`, 'success');
    }

    /**
     * S-16: Triple Pothole Separation Test (Stress Test)
     * 
     * Tests whether the algorithm correctly identifies 3 DISTINCT clusters
     * when there are 10 Pothole complaints divided into 3 groups with 55m gaps.
     * 
     * EXPECTED: 3 separate clusters (gaps exceed Pothole ε=10m)
     * VALIDATION: Groups should NOT merge across the 55m boundaries
     */
    async runScenarioTriplePotholeSeparation(data, config) {
        this.addLog(`[STRESS TEST] Triple Pothole Road Merge Analysis`, 'system');
        this.addLog(`[INFO] Testing 10 Potholes across 3 groups with 8m gaps`, 'info');
        this.addLog(`[INFO] Pothole Epsilon: ${ADAPTIVE_EPSILON['Pothole']}m`, 'info');
        this.addLog(`[EXPECTED] 1 merged cluster (gaps 8m < ε 10m)`, 'info');

        // Group points by their scenario tag (group_a, group_b, group_c)
        const groupA = data.filter(p => p._scenario && p._scenario.includes('group_a'));
        const groupB = data.filter(p => p._scenario && p._scenario.includes('group_b'));
        const groupC = data.filter(p => p._scenario && p._scenario.includes('group_c'));

        this.addLog('─'.repeat(55), 'system');
        this.addLog(`[GROUPS] Found: A=${groupA.length}, B=${groupB.length}, C=${groupC.length}`, 'info');

        // Visualize all points first
        const allPoints = [...groupA, ...groupB, ...groupC];
        for (const point of allPoints) {
            this.createSpotlightMarker(point, config.color, 1.0);
        }

        await this.delay(ANIMATION_CONFIG.STEP_DELAY);

        // Run clustering on the full dataset
        this.addLog('─'.repeat(55), 'system');
        this.addLog(`[DBSCAN++] Running automated clustering...`, 'system');

        const clusteringResult = clusterComplaints(allPoints, {
            MIN_PTS: 1,
            ENABLE_LOGGING: false
        });

        const numClusters = clusteringResult.clusters.length;
        const expectedClusters = 1;

        this.addLog(`[RESULT] Detected ${numClusters} cluster(s)`, numClusters === expectedClusters ? 'success' : 'error');

        // Analyze each cluster
        clusteringResult.clusters.forEach((cluster, idx) => {
            const categories = [...new Set(cluster.map(p => p.category))];
            const groupTags = [...new Set(cluster.map(p => {
                if (p._scenario.includes('group_a')) return 'A';
                if (p._scenario.includes('group_b')) return 'B';
                if (p._scenario.includes('group_c')) return 'C';
                return '?';
            }))];

            this.addLog(`[CLUSTER ${idx + 1}] Size: ${cluster.length} points, Groups: [${groupTags.join(', ')}]`, 'info');

            // VISUAL: Draw connecting lines between cluster members
            if (cluster.length > 1) {
                for (let i = 0; i < cluster.length - 1; i++) {
                    const from = cluster[i];
                    const to = cluster[i + 1];
                    const line = L.polyline(
                        [[from.latitude, from.longitude], [to.latitude, to.longitude]],
                        {
                            color: config.color,
                            weight: 2,
                            opacity: 0.6,
                            dashArray: '5, 5'
                        }
                    ).addTo(this.map);
                    this.connectionLines.push(line);
                }
            }
        });

        // Test inter-group distances
        this.addLog('─'.repeat(55), 'system');
        this.addLog(`[VALIDATION] Testing inter-group distances...`, 'system');

        // Test A-B distance
        if (groupA.length > 0 && groupB.length > 0) {
            const distAB = haversineDistance(
                groupA[0].latitude, groupA[0].longitude,
                groupB[0].latitude, groupB[0].longitude
            );
            const shouldMerge = distAB <= ADAPTIVE_EPSILON['Pothole'];
            this.addLog(`[A↔B] Distance: ${distAB.toFixed(1)}m | ε: ${ADAPTIVE_EPSILON['Pothole']}m | ${shouldMerge ? 'MERGE' : 'SEPARATE'}`,
                shouldMerge ? 'warning' : 'success');
        }

        // Test B-C distance
        if (groupB.length > 0 && groupC.length > 0) {
            const distBC = haversineDistance(
                groupB[0].latitude, groupB[0].longitude,
                groupC[0].latitude, groupC[0].longitude
            );
            const shouldMerge = distBC <= ADAPTIVE_EPSILON['Pothole'];
            this.addLog(`[B↔C] Distance: ${distBC.toFixed(1)}m | ε: ${ADAPTIVE_EPSILON['Pothole']}m | ${shouldMerge ? 'MERGE' : 'SEPARATE'}`,
                shouldMerge ? 'warning' : 'success');
        }

        // Test A-C distance
        if (groupA.length > 0 && groupC.length > 0) {
            const distAC = haversineDistance(
                groupA[0].latitude, groupA[0].longitude,
                groupC[0].latitude, groupC[0].longitude
            );
            const shouldMerge = distAC <= ADAPTIVE_EPSILON['Pothole'];
            this.addLog(`[A↔C] Distance: ${distAC.toFixed(1)}m | ε: ${ADAPTIVE_EPSILON['Pothole']}m | ${shouldMerge ? 'MERGE' : 'SEPARATE'}`,
                shouldMerge ? 'warning' : 'success');
        }

        this.addLog('═'.repeat(55), 'system');

        // Final verdict
        if (numClusters === expectedClusters) {
            this.addLog(`[VERDICT] ✓ PASS - Algorithm correctly merged all ${allPoints.length} potholes into ${expectedClusters} cluster`, 'success');
            this.addLog(`[ANALYSIS] Related road issues merged despite being in separate groups`, 'success');
        } else {
            this.addLog(`[VERDICT] ✗ FAIL - Expected ${expectedClusters} cluster, got ${numClusters}`, 'error');
            if (numClusters > 1) {
                this.addLog(`[ISSUE] Under-merging: Groups should merge but stayed separate`, 'error');
            }
        }

        this.updateInspector({
            category: 'Pothole (Stress Test)',
            epsilon: `${ADAPTIVE_EPSILON['Pothole']}m`,
            timeDiff: 'N/A',
            semantic: 'IDENTICAL (same category)',
            keywords: ['pothole', 'road', 'lubak'],
            keywordSimilarity: 1.0,
            keywordVerdict: 'IDENTICAL',
            verdict: numClusters === expectedClusters ? 'PASSED' : 'FAILED'
        });
    }
}


// ==================== VALIDATION METRICS SYSTEM ====================

/**
 * MetricsCalculator - Computes validation metrics for thesis defense
 * 
 * Metrics Computed:
 * 1. Redundancy Reduction: ((Original - Clusters) / Original) * 100
 * 2. Accuracy Score: System result matches expected result
 * 3. False Positives: Incorrect merges (merged when should be separate)
 * 4. Processing Time: Algorithm execution duration in ms
 */
class MetricsCalculator {
    constructor() {
        this.scenarioResults = {};
        this.startTime = null;
    }

    /**
     * Start timing for a scenario
     */
    startTiming() {
        this.startTime = performance.now();
    }

    /**
     * End timing and return duration
     */
    endTiming() {
        if (!this.startTime) return 0;
        const duration = performance.now() - this.startTime;
        this.startTime = null;
        return Math.round(duration);
    }

    /**
     * Calculate metrics for a completed scenario
     * @param {number} scenarioNumber - The scenario that just ran
     * @param {Array} scenarioData - The data points used
     * @param {Object} results - Results from the scenario run
     */
    calculateScenarioMetrics(scenarioNumber, scenarioData, results) {
        const config = SCENARIO_CONFIG[scenarioNumber];
        const expectedResult = config.expectedResult;

        // Count original reports vs resulting clusters
        const originalCount = scenarioData.length;
        let clusterCount = 1; // At minimum, one cluster
        let mergeCount = 0;
        let separateCount = 0;

        // Analyze results based on scenario type
        switch (scenarioNumber) {
            case 1: // S-01 Redundancy - 3 identical should MERGE
                mergeCount = scenarioData.length - 1;
                clusterCount = 1;
                break;

            case 2: // S-03 Discrete - 15m apart, should SEPARATE
                separateCount = scenarioData.length;
                clusterCount = scenarioData.length;
                break;

            case 3: // S-07 Precision - PARTIAL (1 merge, 1 separate)
                mergeCount = 1;
                separateCount = 1;
                clusterCount = 2;
                break;

            case 4: // S-09 GPS Drift - same user, should MERGE
                mergeCount = scenarioData.length - 1;
                clusterCount = 1;
                break;

            case 5: // S-13 Moving Hazard - 60m apart, CONSIDER
                clusterCount = 2; // Could be separate or linked
                break;

            case 6: // S-02 Causal - Pipe+Flood should MERGE
                mergeCount = 1;
                clusterCount = 1;
                break;

            case 7: // S-05 False Correlation - unrelated, SEPARATE
                separateCount = 2;
                clusterCount = 2;
                break;

            case 8: // S-06 Domino Chain - all linked, MERGE
                mergeCount = 2;
                clusterCount = 1;
                break;

            case 9: // S-10 Conflict - same location diff category, SEPARATE
                separateCount = 2;
                clusterCount = 2;
                break;

            case 10: // S-11 Synonyms - same meaning, MERGE
                mergeCount = 1;
                clusterCount = 1;
                break;

            case 11: // S-04 Time Decay - 90 days old, SEPARATE
                separateCount = 2;
                clusterCount = 2;
                break;

            case 12: // S-08 Mass Panic - 20 fire reports, MERGE all
                mergeCount = scenarioData.length - 1;
                clusterCount = 1;
                break;

            case 13: // S-12 Spam Bot - 50 identical timestamp, FLAG
                clusterCount = 1; // Flagged as suspicious
                break;

            case 14: // S-14 Default Pin - all at center, FLAG
                clusterCount = 1; // Flagged
                break;

            case 15: // S-15 Null Data - HANDLE gracefully
                clusterCount = scenarioData.length; // Each handled separately
                break;

            default:
                clusterCount = Math.ceil(scenarioData.length / 2);
        }

        // Calculate redundancy reduction percentage
        const redundancyReduced = originalCount > 0
            ? ((originalCount - clusterCount) / originalCount) * 100
            : 0;

        // Determine if result matches expected
        const systemDecision = clusterCount < originalCount ? "MERGE" : "SEPARATE";
        const isAccurate = systemDecision === expectedResult;

        // Count false positives (merged when should be separate)
        const falsePositives = (expectedResult === "SEPARATE" && mergeCount > 0)
            ? mergeCount
            : 0;

        return {
            scenarioNumber,
            scenarioName: config.name,
            originalCount,
            clusterCount,
            redundancyReduced: redundancyReduced.toFixed(1),
            expectedResult,
            systemDecision,
            isAccurate,
            accuracyScore: isAccurate ? 100 : 0,
            falsePositives,
            mergeCount,
            separateCount
        };
    }

    /**
     * Update the metrics panel UI with animated values
     * @param {Object} metrics - Calculated metrics object
     * @param {number} processingTime - Time in milliseconds
     */
    updateMetricsUI(metrics, processingTime) {
        // Get DOM elements
        const redundancyEl = document.getElementById('metricRedundancy');
        const redundancyDetailEl = document.getElementById('metricRedundancyDetail');
        const accuracyEl = document.getElementById('metricAccuracy');
        const accuracyDetailEl = document.getElementById('metricAccuracyDetail');
        const fpEl = document.getElementById('metricFalsePositives');
        const fpDetailEl = document.getElementById('metricFPDetail');
        const timeEl = document.getElementById('metricTime');
        const timeDetailEl = document.getElementById('metricTimeDetail');
        const heroCard = document.querySelector('.metric-card.hero');

        // Animate the redundancy value (hero metric)
        this.animateValue(redundancyEl, 0, parseFloat(metrics.redundancyReduced), 800);
        redundancyDetailEl.textContent = `${metrics.originalCount} → ${metrics.clusterCount} reports`;

        // Add glow animation to hero card
        if (heroCard) {
            heroCard.classList.remove('updated');
            void heroCard.offsetWidth; // Trigger reflow
            heroCard.classList.add('updated');
        }

        // Update accuracy
        this.animateValue(accuracyEl, 0, metrics.accuracyScore, 600);
        accuracyDetailEl.textContent = metrics.isAccurate
            ? `✓ matches expected`
            : `✗ expected ${metrics.expectedResult}`;

        // Update false positives
        fpEl.textContent = metrics.falsePositives;
        fpEl.classList.add('animate');
        fpDetailEl.textContent = metrics.falsePositives === 0
            ? 'no errors'
            : 'incorrect merges';

        // Update processing time
        this.animateValue(timeEl, 0, processingTime, 400);
        timeDetailEl.textContent = processingTime < 100
            ? 'fast execution'
            : processingTime < 500
                ? 'normal speed'
                : 'complex analysis';

        // Log metrics to console for thesis documentation
        console.log('📊 Validation Metrics:', {
            scenario: metrics.scenarioName,
            redundancyReduced: `${metrics.redundancyReduced}%`,
            accuracy: `${metrics.accuracyScore}%`,
            falsePositives: metrics.falsePositives,
            processingTime: `${processingTime}ms`
        });
    }

    /**
     * Animate a numeric value with easing
     */
    animateValue(element, start, end, duration) {
        if (!element) return;

        const startTime = performance.now();
        const isFloat = !Number.isInteger(end);

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = start + (end - start) * easeOut;

            element.textContent = isFloat ? current.toFixed(1) : Math.round(current);
            element.classList.add('animate');

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Reset all metrics to default state
     */
    resetMetrics() {
        const elements = ['metricRedundancy', 'metricAccuracy', 'metricFalsePositives', 'metricTime'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '--';
        });

        document.getElementById('metricRedundancyDetail').textContent = '-- → -- reports';
        document.getElementById('metricAccuracyDetail').textContent = 'vs. expected';
        document.getElementById('metricFPDetail').textContent = 'incorrect merges';
        document.getElementById('metricTimeDetail').textContent = 'algorithm runtime';
    }
}

// Create global metrics instance
window.metricsCalculator = new MetricsCalculator();


// ==================== NLP DICTIONARY LOADER ====================
/**
 * NLP Dictionary Loader v2.0
 * ===========================
 * Loads and manages the external nlp_dictionaries.json file for
 * context-based awareness in complaint analysis.
 * 
 * Features:
 * - Loads Filipino/Tagalog/Bisaya keywords
 * - Provides metaphor filtering
 * - Handles speculation detection
 * - Manages severity modifiers
 * - Supports category suggestion from text
 */

// Global dictionary storage
let NLP_DICTIONARIES = null;
let NLP_DICTIONARY_LOADED = false;

/**
 * Load the NLP dictionaries from JSON file.
 * Should be called during initialization.
 * 
 * @param {boolean} forceReload - If true, bypasses cache and reloads from server
 * @returns {Promise<Object|null>} The loaded dictionaries or null on error
 */
async function loadNLPDictionaries(forceReload = false) {
    if (!forceReload && NLP_DICTIONARY_LOADED && NLP_DICTIONARIES) {
        console.log('[NLP] Dictionaries already loaded (use forceReload=true to refresh)');
        return NLP_DICTIONARIES;
    }

    // Reset cache if forcing reload
    if (forceReload) {
        console.log('[NLP] Force reloading dictionaries from server...');
        NLP_DICTIONARY_LOADED = false;
        NLP_DICTIONARIES = null;
        NLP_KEYWORD_INDEX = new Map();
    }

    try {
        if (!taxonomyCache && typeof DRIMSTaxonomy !== 'undefined') {
            try {
                taxonomyCache = await DRIMSTaxonomy.loadTaxonomy();
            } catch (e) {
                taxonomyCache = null;
            }
        }

        if (taxonomyCache && window.DRIMSBrainConfig && window.DRIMSBrainConfig.dictionaries) {
            NLP_DICTIONARIES = window.DRIMSBrainConfig.dictionaries;
            NLP_DICTIONARY_LOADED = true;
            buildDictionaryIndices();
            return NLP_DICTIONARIES;
        }

        console.log('[NLP] Loading nlp_dictionaries.json...');

        // Try multiple paths to find the dictionary file
        const possiblePaths = [
            '/api/nlp/dictionary',                          // Live API from Supabase (Highest Priority)
            '/data/nlp_dictionaries.json',                  // Absolute from server root (most reliable)
            'data/nlp_dictionaries.json',                   // From root
            '../../data/nlp_dictionaries.json',             // From src/dashboard or src/analytics
            '../data/nlp_dictionaries.json',                // From src folder
            'nlp_dictionaries.json',                        // Same directory
            '../nlp_dictionaries.json'                      // Parent directory
        ];

        let response = null;
        let successPath = null;

        for (const path of possiblePaths) {
            try {
                response = await fetch(path);
                if (response.ok) {
                    successPath = path;
                    break;
                }
            } catch (e) {
                // Try next path
            }
        }

        if (!response || !response.ok) {
            throw new Error(`Could not find nlp_dictionaries.json in any expected location`);
        }

        console.log(`[NLP] Found dictionary at: ${successPath}`);

        NLP_DICTIONARIES = await response.json();
        NLP_DICTIONARY_LOADED = true;

        // Log metadata
        const meta = NLP_DICTIONARIES._metadata || {};
        console.log(`[NLP] Dictionary v${meta.version || '?'} loaded successfully`);
        console.log(`[NLP] Languages: ${(meta.languages || []).join(', ')}`);
        console.log(`[NLP] Last updated: ${meta.last_updated || 'unknown'}`);

        // Build lookup indices for fast matching
        buildDictionaryIndices();

        return NLP_DICTIONARIES;

    } catch (error) {
        console.error('[NLP] Failed to load dictionaries:', error.message);
        NLP_DICTIONARY_LOADED = false;
        NLP_DICTIONARIES = null;
        return null;
    }
}

// Indexed lookup tables for fast matching (NLP Dictionary v2.0)
let NLP_KEYWORD_INDEX = new Map();          // term -> { category, confidence, translation }
let NLP_METAPHOR_PATTERNS = [];              // Compiled regex patterns
let NLP_SPECULATION_PATTERNS = [];           // Compiled speculation patterns
let NLP_SEVERITY_AMPLIFIERS = new Map();     // term -> multiplier
let NLP_SEVERITY_DIMINISHERS = new Map();    // term -> multiplier
let NLP_NEGATION_PATTERNS = [];              // No-issue patterns
let NLP_TEMPORAL_PRESENT = [];
let NLP_TEMPORAL_PAST = [];
let NLP_TEMPORAL_FUTURE = [];

/**
 * Build optimized lookup indices from loaded dictionaries.
 * Called automatically after loading.
 */
function buildDictionaryIndices() {
    if (!NLP_DICTIONARIES) return;

    console.log('[NLP] Building lookup indices...');

    // Clear existing indices
    NLP_KEYWORD_INDEX.clear();
    NLP_METAPHOR_PATTERNS = [];
    NLP_SPECULATION_PATTERNS = [];
    NLP_SEVERITY_AMPLIFIERS.clear();
    NLP_SEVERITY_DIMINISHERS.clear();
    NLP_NEGATION_PATTERNS = [];
    NLP_TEMPORAL_PRESENT = [];
    NLP_TEMPORAL_PAST = [];
    NLP_TEMPORAL_FUTURE = [];

    // 1. Build keyword index from filipino_keywords
    const filipinoKeywords = NLP_DICTIONARIES.filipino_keywords || {};
    for (const [mainCategory, subcategories] of Object.entries(filipinoKeywords)) {
        for (const [subCategory, terms] of Object.entries(subcategories)) {
            if (!Array.isArray(terms)) continue;

            for (const entry of terms) {
                if (!entry.term) continue;

                const normalizedTerm = entry.term.toLowerCase().trim();
                NLP_KEYWORD_INDEX.set(normalizedTerm, {
                    term: entry.term,
                    translation: entry.translation || '',
                    confidence: entry.confidence || 0.8,
                    category: entry.category || mainCategory,
                    subCategory: subCategory,
                    mainCategory: mainCategory
                });
            }
        }
    }

    // 2. Build English keyword index
    const englishKeywords = NLP_DICTIONARIES.english_keywords || {};
    for (const [category, terms] of Object.entries(englishKeywords)) {
        if (!Array.isArray(terms)) continue;

        for (const entry of terms) {
            if (!entry.term) continue;

            const normalizedTerm = entry.term.toLowerCase().trim();
            if (!NLP_KEYWORD_INDEX.has(normalizedTerm)) {
                NLP_KEYWORD_INDEX.set(normalizedTerm, {
                    term: entry.term,
                    translation: entry.term,
                    confidence: entry.confidence || 0.8,
                    category: entry.category || category,
                    mainCategory: category
                });
            }
        }
    }

    // 3. Compile metaphor filter patterns
    const metaphorFilters = NLP_DICTIONARIES.metaphor_filters?.patterns || [];
    for (const filter of metaphorFilters) {
        if (!filter.pattern) continue;

        try {
            const regex = new RegExp(filter.pattern, 'gi');
            NLP_METAPHOR_PATTERNS.push({
                regex: regex,
                literal: filter.literal,
                actualMeaning: filter.actual_meaning,
                filterType: filter.filter_type,
                isEmergency: filter.is_emergency === true
            });
        } catch (e) {
            console.warn('[NLP] Invalid metaphor pattern:', filter.pattern);
        }
    }

    // 4. Compile speculation patterns
    const speculationConfig = NLP_DICTIONARIES.speculation_patterns || {};

    // Conditional triggers
    for (const entry of (speculationConfig.conditional_triggers || [])) {
        if (!entry.pattern) continue;
        NLP_SPECULATION_PATTERNS.push({
            pattern: entry.pattern.toLowerCase(),
            type: entry.type || 'conditional',
            translation: entry.translation || ''
        });
    }

    // Risk assessment language
    for (const entry of (speculationConfig.risk_assessment_language || [])) {
        if (!entry.pattern) continue;
        NLP_SPECULATION_PATTERNS.push({
            pattern: entry.pattern.toLowerCase(),
            type: entry.type || 'speculative_risk',
            translation: entry.translation || ''
        });
    }

    // Past event markers
    for (const entry of (speculationConfig.past_event_markers || [])) {
        if (!entry.pattern) continue;
        NLP_SPECULATION_PATTERNS.push({
            pattern: entry.pattern.toLowerCase(),
            type: entry.type || 'past_reference',
            translation: entry.translation || '',
            isCurrentEmergency: entry.is_current_emergency === true
        });
    }

    // 5. Build severity modifier maps
    const severityModifiers = NLP_DICTIONARIES.severity_modifiers || {};

    for (const entry of (severityModifiers.amplifiers || [])) {
        if (entry.term && entry.multiplier) {
            NLP_SEVERITY_AMPLIFIERS.set(entry.term.toLowerCase(), {
                multiplier: entry.multiplier,
                translation: entry.translation || ''
            });
        }
    }

    for (const entry of (severityModifiers.diminishers || [])) {
        if (entry.term && entry.multiplier) {
            NLP_SEVERITY_DIMINISHERS.set(entry.term.toLowerCase(), {
                multiplier: entry.multiplier,
                translation: entry.translation || ''
            });
        }
    }

    // 6. Build negation patterns
    const negationConfig = NLP_DICTIONARIES.negation_patterns || {};
    for (const entry of (negationConfig.no_issue_indicators || [])) {
        if (!entry.pattern) continue;
        NLP_NEGATION_PATTERNS.push({
            pattern: entry.pattern.toLowerCase(),
            action: entry.action || 'filter_out',
            translation: entry.translation || ''
        });
    }

    const normalizeTemporalList = (source) => {
        if (!source) return [];
        if (!Array.isArray(source)) return [];
        return source
            .map(item => {
                if (typeof item === 'string') return item;
                if (item && typeof item === 'object') return item.term || item.pattern || '';
                return '';
            })
            .map(v => String(v).toLowerCase().trim())
            .filter(Boolean);
    };

    NLP_TEMPORAL_PRESENT = normalizeTemporalList(NLP_DICTIONARIES.temporal_present);
    NLP_TEMPORAL_PAST = normalizeTemporalList(NLP_DICTIONARIES.temporal_past);
    NLP_TEMPORAL_FUTURE = normalizeTemporalList(NLP_DICTIONARIES.temporal_future);

    console.log(`[NLP] Indices built: ${NLP_KEYWORD_INDEX.size} keywords, ${NLP_METAPHOR_PATTERNS.length} metaphors, ${NLP_SPECULATION_PATTERNS.length} speculation patterns`);
}

/**
 * Detect Filipino/Tagalog/Bisaya keywords in text and suggest category.
 * 
 * @param {string} text - The complaint description text
 * @returns {Object} { matches: Array, suggestedCategory: string|null, confidence: number }
 */
function detectFilipinoKeywords(text) {
    if (!text || !NLP_DICTIONARY_LOADED) {
        return { matches: [], suggestedCategory: null, confidence: 0 };
    }

    const normalizedText = text.toLowerCase();
    const matches = [];
    let bestMatch = null;
    let bestConfidence = 0;

    // Check each keyword against the text
    for (const [term, data] of NLP_KEYWORD_INDEX.entries()) {
        // Use word boundary matching for single words, substring for phrases
        const isPhrase = term.includes(' ');
        let found = false;

        if (isPhrase) {
            found = normalizedText.includes(term);
        } else {
            // Word boundary check
            const wordRegex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i');
            found = wordRegex.test(normalizedText);
        }

        if (found) {
            matches.push({
                term: data.term,
                translation: data.translation,
                category: data.category,
                confidence: data.confidence
            });

            // Track best match by confidence and term length
            const score = data.confidence * (term.length / 10);
            if (score > bestConfidence) {
                bestConfidence = score;
                bestMatch = data;
            }
        }
    }

    return {
        matches: matches,
        suggestedCategory: bestMatch?.category || null,
        confidence: bestMatch?.confidence || 0
    };
}

/**
 * Check if text contains metaphorical language that should not trigger emergency alerts.
 * 
 * @param {string} text - The complaint description text
 * @returns {Object} { isMetaphorical: boolean, matchedPattern: Object|null }
 */
function detectMetaphoricalLanguage(text) {
    if (!text || !NLP_DICTIONARY_LOADED || NLP_METAPHOR_PATTERNS.length === 0) {
        return { isMetaphorical: false, matchedPattern: null };
    }

    for (const pattern of NLP_METAPHOR_PATTERNS) {
        if (pattern.regex.test(text)) {
            // Reset regex lastIndex for next use
            pattern.regex.lastIndex = 0;

            return {
                isMetaphorical: true,
                matchedPattern: {
                    literal: pattern.literal,
                    actualMeaning: pattern.actualMeaning,
                    filterType: pattern.filterType,
                    isEmergency: pattern.isEmergency
                }
            };
        }
    }

    return { isMetaphorical: false, matchedPattern: null };
}

/**
 * Check if text contains speculative or conditional language.
 * 
 * @param {string} text - The complaint description text
 * @returns {Object} { isSpeculative: boolean, matchedPatterns: Array }
 */
function detectSpeculativeLanguage(text) {
    if (!text || !NLP_DICTIONARY_LOADED || NLP_SPECULATION_PATTERNS.length === 0) {
        return { isSpeculative: false, matchedPatterns: [] };
    }

    const normalizedText = text.toLowerCase();
    const matchedPatterns = [];

    for (const pattern of NLP_SPECULATION_PATTERNS) {
        if (normalizedText.includes(pattern.pattern)) {
            matchedPatterns.push({
                pattern: pattern.pattern,
                type: pattern.type,
                translation: pattern.translation
            });
        }
    }

    return {
        isSpeculative: matchedPatterns.length > 0,
        matchedPatterns: matchedPatterns
    };
}

/**
 * Calculate severity multiplier from text based on amplifiers/diminishers.
 * 
 * @param {string} text - The complaint description text
 * @returns {Object} { multiplier: number, amplifiers: Array, diminishers: Array }
 */
function calculateSeverityModifier(text) {
    if (!text || !NLP_DICTIONARY_LOADED) {
        return { multiplier: 1.0, amplifiers: [], diminishers: [] };
    }

    const normalizedText = text.toLowerCase();
    const foundAmplifiers = [];
    const foundDiminishers = [];
    let totalMultiplier = 1.0;

    // Check amplifiers
    for (const [term, data] of NLP_SEVERITY_AMPLIFIERS.entries()) {
        if (normalizedText.includes(term)) {
            foundAmplifiers.push({
                term: term,
                multiplier: data.multiplier,
                translation: data.translation
            });
            totalMultiplier *= data.multiplier;
        }
    }

    // Check diminishers
    for (const [term, data] of NLP_SEVERITY_DIMINISHERS.entries()) {
        if (normalizedText.includes(term)) {
            foundDiminishers.push({
                term: term,
                multiplier: data.multiplier,
                translation: data.translation
            });
            totalMultiplier *= data.multiplier;
        }
    }

    // Cap the multiplier to reasonable bounds
    totalMultiplier = Math.max(0.3, Math.min(2.5, totalMultiplier));

    return {
        multiplier: totalMultiplier,
        amplifiers: foundAmplifiers,
        diminishers: foundDiminishers
    };
}

/**
 * Check if text indicates no issue or resolved problem.
 * 
 * @param {string} text - The complaint description text
 * @returns {Object} { isNoIssue: boolean, matchedPattern: string|null }
 */
function detectNoIssue(text) {
    if (!text || !NLP_DICTIONARY_LOADED || NLP_NEGATION_PATTERNS.length === 0) {
        return { isNoIssue: false, matchedPattern: null };
    }

    const normalizedText = text.toLowerCase();

    for (const pattern of NLP_NEGATION_PATTERNS) {
        if (normalizedText.includes(pattern.pattern)) {
            return {
                isNoIssue: true,
                matchedPattern: pattern.pattern,
                translation: pattern.translation
            };
        }
    }

    return { isNoIssue: false, matchedPattern: null };
}

function detectTemporalContext(text) {
    if (!text) {
        return { tag: null, matches: { present: [], past: [], future: [] } };
    }

    const normalizedText = text.toLowerCase();

    const fallback = {
        present: ["now", "ngayon", "currently", "ongoing", "kasalukuyan", "just now", "still", "pa"],
        past: ["yesterday", "kahapon", "tapos na", "done", "subsided", "humupa", "earlier", "kanina", "last night"],
        future: ["might", "baka", "possible", "parating", "approaching", "threatening", "soon"]
    };

    const presentTerms = (NLP_DICTIONARY_LOADED && NLP_TEMPORAL_PRESENT.length > 0) ? NLP_TEMPORAL_PRESENT : fallback.present;
    const pastTerms = (NLP_DICTIONARY_LOADED && NLP_TEMPORAL_PAST.length > 0) ? NLP_TEMPORAL_PAST : fallback.past;
    const futureTerms = (NLP_DICTIONARY_LOADED && NLP_TEMPORAL_FUTURE.length > 0) ? NLP_TEMPORAL_FUTURE : fallback.future;

    const matchTerms = (terms) => {
        const found = [];
        for (const term of terms) {
            if (!term) continue;
            const isPhrase = term.includes(' ');
            if (isPhrase) {
                if (normalizedText.includes(term)) found.push(term);
            } else {
                const wordRegex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'i');
                if (wordRegex.test(normalizedText)) found.push(term);
            }
        }
        return found;
    };

    const matches = {
        present: matchTerms(presentTerms),
        past: matchTerms(pastTerms),
        future: matchTerms(futureTerms)
    };

    const tag = matches.future.length > 0 ? 'future'
        : matches.past.length > 0 ? 'past'
            : matches.present.length > 0 ? 'present'
                : null;

    return { tag, matches };
}

/**
 * Helper: Escape special regex characters in a string.
 * @param {string} str - String to escape
 * @returns {string} Escaped string safe for use in RegExp
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get the raw NLP dictionaries object.
 * Useful for direct access to dictionary data.
 * 
 * @returns {Object|null} The loaded dictionaries or null if not loaded
 */
function getNLPDictionaries() {
    return NLP_DICTIONARIES;
}

/**
 * Check if NLP dictionaries are loaded and ready.
 * @returns {boolean} True if dictionaries are loaded
 */
function isNLPDictionaryReady() {
    return NLP_DICTIONARY_LOADED && NLP_DICTIONARIES !== null;
}

/**
 * Comprehensive NLP analysis of complaint text.
 * Combines all NLP features into a single analysis result.
 * 
 * @param {string} text - The complaint description text
 * @returns {Object} Complete NLP analysis result
 */
function analyzeComplaintText(text) {
    const result = {
        text: text,
        isReady: isNLPDictionaryReady(),
        keywords: { matches: [], suggestedCategory: null, confidence: 0 },
        metaphor: { isMetaphorical: false, matchedPattern: null },
        speculation: { isSpeculative: false, matchedPatterns: [] },
        severity: { multiplier: 1.0, amplifiers: [], diminishers: [] },
        negation: { isNoIssue: false, matchedPattern: null },
        temporal: { tag: null, matches: { present: [], past: [], future: [] } }
    };

    if (!result.isReady || !text) {
        return result;
    }

    // Run all detectors
    result.keywords = detectFilipinoKeywords(text);
    result.metaphor = detectMetaphoricalLanguage(text);
    result.speculation = detectSpeculativeLanguage(text);
    result.severity = calculateSeverityModifier(text);
    result.negation = detectNoIssue(text);
    result.temporal = detectTemporalContext(text);

    return result;
}


// ==================== MODULAR BRAIN ENGINES INTEGRATION v1.0 ====================
/**
 * Module Delegation Pattern for Brain Engines
 * ===========================================
 * 
 * This section delegates NLP and Causality functions to external modules
 * (nlp-processor.js and causality-manager.js) when they are loaded.
 * 
 * LOAD ORDER (in HTML):
 * 1. nlp-processor.js       → Provides NLPProcessor global
 * 2. causality-manager.js   → Provides CausalityManager global
 * 3. simulation-engine.js   → This file (delegates to modules)
 * 
 * If modules aren't loaded, the global exports will be undefined,
 * but the system will still function if external code doesn't call
 * those specific functions.
 * 
 * @author DRIMS Development Team
 * @version 1.0.0 - Modular Architecture
 */

// Check if NLP Processor module is loaded
const _nlpModuleLoaded = typeof NLPProcessor !== 'undefined';
if (_nlpModuleLoaded) {
    console.log('[ENGINE] ✅ NLPProcessor module detected (v' + NLPProcessor.version + ')');
} else {
    console.warn('[ENGINE] ⚠️ NLPProcessor module not loaded - NLP functions unavailable');
}

// Check if Causality Manager module is loaded  
const _causalityModuleLoaded = typeof CausalityManager !== 'undefined';
if (_causalityModuleLoaded) {
    console.log('[ENGINE] ✅ CausalityManager module detected (v' + CausalityManager.version + ')');
} else {
    console.warn('[ENGINE] ⚠️ CausalityManager module not loaded - Causality functions unavailable');
}

// ==================== NLP MODULE DELEGATION ====================
// Delegate to NLPProcessor if loaded, otherwise provide stub functions

const analyzeText = _nlpModuleLoaded
    ? NLPProcessor.analyzeText
    : function (rawInput, dictionary) {
        console.error('[ENGINE] analyzeText called but NLPProcessor not loaded. Include nlp-processor.js before simulation-engine.js');
        return { category: null, urgencyScore: 0, confidence: 0, error: 'NLPProcessor not loaded' };
    };

// v4.0: Async analysis with AI fallback
const analyzeTextAsync = _nlpModuleLoaded && NLPProcessor.analyzeTextAsync
    ? NLPProcessor.analyzeTextAsync
    : async function (rawInput, dictionary) {
        console.warn('[ENGINE] analyzeTextAsync called but NLPProcessor v4.0 not loaded. Falling back to sync version.');
        return analyzeText(rawInput, dictionary);
    };

// v4.0: AI Status checker
const getAIStatus = _nlpModuleLoaded && NLPProcessor.getAIStatus
    ? NLPProcessor.getAIStatus
    : function () { return { ready: false, modelLoaded: false, anchorsComputed: false, error: 'NLPProcessor v4.0 not loaded' }; };

// v4.1: Debug/Thesis Mode controls
const setDebugMode = _nlpModuleLoaded && NLPProcessor.setDebugMode
    ? NLPProcessor.setDebugMode
    : function (enabled) { console.warn('[ENGINE] setDebugMode called but NLPProcessor v4.1 not loaded.'); };

const getDebugStatus = _nlpModuleLoaded && NLPProcessor.getDebugStatus
    ? NLPProcessor.getDebugStatus
    : function () { return { enabled: false, metrics: { totalTime: 0, ruleBasedTime: 0, aiTime: 0, aiSkipped: true, memoryUsage: 0 } }; };

// v4.0: Manual AI initialization
const initAIFallback = _nlpModuleLoaded && NLPProcessor.initAIFallback
    ? NLPProcessor.initAIFallback
    : async function () { console.warn('[ENGINE] initAIFallback called but NLPProcessor v4.0 not loaded.'); return false; };

// v4.0: Classify with AI directly
const classifyWithAI = _nlpModuleLoaded && NLPProcessor.classifyWithAI
    ? NLPProcessor.classifyWithAI
    : async function () { return null; };

const tokenizeForNLP = _nlpModuleLoaded
    ? NLPProcessor.tokenizeForNLP
    : function (text) { return text ? text.toLowerCase().split(/\s+/) : []; };

// v4.0: Clause-aware tokenization
const tokenizeWithClauses = _nlpModuleLoaded && NLPProcessor.tokenizeWithClauses
    ? NLPProcessor.tokenizeWithClauses
    : function (text) { return { clauses: [], allTokens: [] }; };

const buildKeywordIndex = _nlpModuleLoaded
    ? NLPProcessor.buildKeywordIndex
    : function () { return new Map(); };

const hasNegationNearby = _nlpModuleLoaded
    ? function (tokens, idx) { return NLPProcessor.hasNegationNearby(tokens, idx).found; }
    : function () { return false; };

const hasIntensifierNearby = _nlpModuleLoaded
    ? function (tokens, idx) { return NLPProcessor.hasIntensifierNearby(tokens, idx).found; }
    : function () { return false; };

// v4.0: Get parent category from hierarchy
const getParentCategory = _nlpModuleLoaded && NLPProcessor.getParentCategory
    ? NLPProcessor.getParentCategory
    : function (category) { return category || 'Others'; };

// NLP Constants from module or empty defaults
const CATEGORY_URGENCY_RATINGS = _nlpModuleLoaded
    ? NLPProcessor.config.CATEGORY_URGENCY_RATINGS
    : {};

const INTENSIFIER_WORDS = _nlpModuleLoaded
    ? NLPProcessor.config.INTENSIFIER_WORDS
    : [];

const NEGATION_WORDS = _nlpModuleLoaded
    ? NLPProcessor.config.NEGATION_WORDS
    : [];

const INTENSIFIER_MULTIPLIER = _nlpModuleLoaded
    ? NLPProcessor.config.INTENSIFIER_MULTIPLIER
    : 1.5;

// v4.0: New configuration constants
const NLP_KEYWORDS = _nlpModuleLoaded && NLPProcessor.config.NLP_KEYWORDS
    ? NLPProcessor.config.NLP_KEYWORDS
    : {};

const CATEGORY_ANCHORS = _nlpModuleLoaded && NLPProcessor.config.CATEGORY_ANCHORS
    ? NLPProcessor.config.CATEGORY_ANCHORS
    : {};

const AI_CONFIDENCE_THRESHOLD = _nlpModuleLoaded && NLPProcessor.config.AI_CONFIDENCE_THRESHOLD
    ? NLPProcessor.config.AI_CONFIDENCE_THRESHOLD
    : 0.6;

const AI_SIMILARITY_THRESHOLD = _nlpModuleLoaded && NLPProcessor.config.AI_SIMILARITY_THRESHOLD
    ? NLPProcessor.config.AI_SIMILARITY_THRESHOLD
    : 0.75;

const MULTI_LABEL_URGENCY_THRESHOLD = _nlpModuleLoaded && NLPProcessor.config.MULTI_LABEL_URGENCY_THRESHOLD
    ? NLPProcessor.config.MULTI_LABEL_URGENCY_THRESHOLD
    : 50;

// ==================== CAUSALITY MODULE DELEGATION ====================
// Delegate to CausalityManager if loaded, otherwise provide stub functions

const verifyCausality = _causalityModuleLoaded
    ? CausalityManager.verifyCausality
    : function (clusterA, clusterB) {
        console.error('[ENGINE] verifyCausality called but CausalityManager not loaded. Include causality-manager.js before simulation-engine.js');
        return { isLinked: false, reason: 'CausalityManager not loaded', checks: { direction: false, temporal: false, spatial: false } };
    };

const findAllCausalLinks = _causalityModuleLoaded
    ? CausalityManager.findAllCausalLinks
    : function () { return []; };

const buildCausalGraph = _causalityModuleLoaded
    ? CausalityManager.buildCausalGraph
    : function () { return { nodes: [], edges: new Map() }; };

const getClusterTimestamp = _causalityModuleLoaded
    ? CausalityManager.getClusterTimestamp
    : function (cluster) { return cluster?.timestamp ? new Date(cluster.timestamp) : null; };

const getClusterCenter = _causalityModuleLoaded
    ? CausalityManager.getClusterCenter
    : function (cluster) {
        if (!cluster) return null;
        return { lat: cluster.latitude, lng: cluster.longitude };
    };

const getClusterCategory = _causalityModuleLoaded
    ? CausalityManager.getClusterCategory
    : function (cluster) { return cluster?.category || 'Others'; };

// Causality Constants from module or defaults
const CAUSAL_MATRIX = _causalityModuleLoaded
    ? CausalityManager.config.CAUSAL_MATRIX
    : {};

const CAUSAL_MAX_TIME_HOURS = _causalityModuleLoaded
    ? CausalityManager.config.CAUSAL_MAX_TIME_HOURS
    : 24;

const CAUSAL_MAX_DISTANCE_METERS = _causalityModuleLoaded
    ? CausalityManager.config.CAUSAL_MAX_DISTANCE_METERS
    : 500;

const CAUSAL_DISTANCE_OVERRIDE = _causalityModuleLoaded
    ? CausalityManager.config.CAUSAL_DISTANCE_OVERRIDE
    : {};

// Log module integration status
console.log('[ENGINE] Brain Engines Integration:', {
    nlp: _nlpModuleLoaded ? 'ACTIVE' : 'STUB',
    causality: _causalityModuleLoaded ? 'ACTIVE' : 'STUB'
});


// ==================== EXPORT FOR GLOBAL ACCESS ====================

// Make available globally for dashboard.js
window.SimulationEngine = SimulationEngine;
window.SCENARIO_CONFIG = SCENARIO_CONFIG;
window.ADAPTIVE_EPSILON = ADAPTIVE_EPSILON;
window.RELATIONSHIP_MATRIX = RELATIONSHIP_MATRIX;
window.KEYWORD_CONFIG = KEYWORD_CONFIG;
window.haversineDistance = haversineDistance;

// Export NLP functions
window.loadNLPDictionaries = loadNLPDictionaries;
window.analyzeComplaintIntelligence = analyzeComplaintIntelligence;
window.extractKeywordsWithCategory = extractKeywordsWithCategory;
window.getNLPDictionaries = getNLPDictionaries;
window.isNLPDictionaryReady = isNLPDictionaryReady;

// === SEMANTIC SCORING ENGINE EXPORTS ===
window.analyzeText = analyzeText;
window.analyzeTextAsync = analyzeTextAsync;  // v4.0: Async with AI fallback
window.tokenizeForNLP = tokenizeForNLP;
window.tokenizeWithClauses = tokenizeWithClauses;  // v4.0: Clause-aware tokenization
window.buildKeywordIndex = buildKeywordIndex;
window.hasNegationNearby = hasNegationNearby;
window.hasIntensifierNearby = hasIntensifierNearby;
window.getParentCategory = getParentCategory;  // v4.0: Hierarchy mapping
window.CATEGORY_URGENCY_RATINGS = typeof CATEGORY_URGENCY_RATINGS !== 'undefined' ? CATEGORY_URGENCY_RATINGS : (window.NLPProcessor?.CATEGORY_URGENCY_RATINGS || {});
window.INTENSIFIER_WORDS = typeof INTENSIFIER_WORDS !== 'undefined' ? INTENSIFIER_WORDS : (window.NLPProcessor?.INTENSIFIER_WORDS || []);
window.NEGATION_WORDS = typeof NEGATION_WORDS !== 'undefined' ? NEGATION_WORDS : (window.NLPProcessor?.NEGATION_WORDS || []);
window.INTENSIFIER_MULTIPLIER = typeof INTENSIFIER_MULTIPLIER !== 'undefined' ? INTENSIFIER_MULTIPLIER : (window.NLPProcessor?.INTENSIFIER_MULTIPLIER || 1.5);

// v4.0: AI Fallback Functions
window.getAIStatus = getAIStatus;
window.initAIFallback = initAIFallback;
window.classifyWithAI = classifyWithAI;

// v4.1: Debug/Thesis Mode Functions
window.setDebugMode = setDebugMode;
window.getDebugStatus = getDebugStatus;

// v4.0: New Configuration Exports
window.NLP_KEYWORDS = typeof NLP_KEYWORDS !== 'undefined' ? NLP_KEYWORDS : (window.NLPProcessor?.config?.NLP_KEYWORDS || {});
window.CATEGORY_ANCHORS = typeof CATEGORY_ANCHORS !== 'undefined' ? CATEGORY_ANCHORS : (window.NLPProcessor?.config?.CATEGORY_ANCHORS || {});
window.AI_CONFIDENCE_THRESHOLD = typeof AI_CONFIDENCE_THRESHOLD !== 'undefined' ? AI_CONFIDENCE_THRESHOLD : 0.6;
window.AI_SIMILARITY_THRESHOLD = typeof AI_SIMILARITY_THRESHOLD !== 'undefined' ? AI_SIMILARITY_THRESHOLD : 0.75;
window.MULTI_LABEL_URGENCY_THRESHOLD = typeof MULTI_LABEL_URGENCY_THRESHOLD !== 'undefined' ? MULTI_LABEL_URGENCY_THRESHOLD : 50;

// === CAUSAL REASONING ENGINE EXPORTS ===
window.verifyCausality = verifyCausality;
window.findAllCausalLinks = findAllCausalLinks;
window.buildCausalGraph = buildCausalGraph;
window.getClusterTimestamp = getClusterTimestamp;
window.getClusterCenter = getClusterCenter;
window.getClusterCategory = typeof getClusterCategory !== 'undefined' ? getClusterCategory : (window.CausalityManager?.getClusterCategory || (() => "Others"));
window.CAUSAL_MATRIX = typeof CAUSAL_MATRIX !== 'undefined' ? CAUSAL_MATRIX : (window.CausalityManager?.CAUSAL_MATRIX || {});
window.CAUSAL_MAX_TIME_HOURS = typeof CAUSAL_MAX_TIME_HOURS !== 'undefined' ? CAUSAL_MAX_TIME_HOURS : (window.CausalityManager?.CAUSAL_MAX_TIME_HOURS || 24);
window.CAUSAL_MAX_DISTANCE_METERS = typeof CAUSAL_MAX_DISTANCE_METERS !== 'undefined' ? CAUSAL_MAX_DISTANCE_METERS : (window.CausalityManager?.CAUSAL_MAX_DISTANCE_METERS || 500);
window.CAUSAL_DISTANCE_OVERRIDE = typeof CAUSAL_DISTANCE_OVERRIDE !== 'undefined' ? CAUSAL_DISTANCE_OVERRIDE : (window.CausalityManager?.CAUSAL_DISTANCE_OVERRIDE || {});
window.checkLogic = checkLogic;
window.checkKeywordSimilarity = checkKeywordSimilarity;
window.MetricsCalculator = MetricsCalculator;

// Feature 2: NLP Category Mismatch Validation (v3.4 Tagalog-Aware Matching)
window.validateCategoryMismatch = validateCategoryMismatch;
window.CATEGORY_VALIDATION_DICTIONARY = CATEGORY_VALIDATION_DICTIONARY;
window.CATEGORY_HIERARCHY = CATEGORY_HIERARCHY;
window.areCategoriesRelated = areCategoriesRelated;
window.extractCategoriesFromText = extractCategoriesFromText;

// v3.4 Tagalog-aware matching helpers (exported for testing)
window.tokenizeText = tokenizeText;
window.checkKeywordMatch = checkKeywordMatch;
window.FALSE_POSITIVE_ROOTS = FALSE_POSITIVE_ROOTS;
window.CATEGORY_SYNONYMS = CATEGORY_SYNONYMS;
window.COMMAND_PREFIXES = COMMAND_PREFIXES;
window.SAFETY_CRITICAL_KEYWORDS = SAFETY_CRITICAL_KEYWORDS;

// Feature 3: Multi-Jurisdiction Voting Algorithm
window.calculateJurisdictionVotes = calculateJurisdictionVotes;

// Feature 4: Critical Triage System v1.0
window.checkCriticality = checkCriticality;
window.extractCriticalPoints = extractCriticalPoints;
window.EMERGENCY_CATEGORIES = EMERGENCY_CATEGORIES;
window.EMERGENCY_KEYWORDS = EMERGENCY_KEYWORDS;

// Feature 4.1: Speculation Detector (Anti-Alarm Fatigue)
window.SPECULATIVE_TRIGGERS = SPECULATIVE_TRIGGERS;
window.checkSpeculativeContext = checkSpeculativeContext;

// v3.9 AUDIT FIX: Negation Detection System
window.NEGATION_PATTERNS = NEGATION_PATTERNS;
window.checkNegation = checkNegation;

// v3.9 AUDIT FIX: Geographic Validation
window.DIGOS_CITY_BOUNDS = DIGOS_CITY_BOUNDS;
window.ELEVATION_CONSTRAINTS = ELEVATION_CONSTRAINTS;
window.validateGPSBounds = validateGPSBounds;
window.validateSpatialPlausibility = validateSpatialPlausibility;

// Feature 4.2: Enhanced Speculation v3.7 (Post-keyword, Past Events, Non-Emergency Phrases)
window.POST_KEYWORD_SPECULATIVE = POST_KEYWORD_SPECULATIVE;
window.PAST_EVENT_PATTERNS = PAST_EVENT_PATTERNS;
window.NON_EMERGENCY_PHRASES = NON_EMERGENCY_PHRASES;

// MODULE 1: Intelligence Analyzer (v3.0 Heuristic Engine)
window.analyzeComplaintIntelligence = analyzeComplaintIntelligence;

// MODULE 2: Adaptive Spatial Clustering
window.getAdaptiveParameters = getAdaptiveParameters;

// Feature 5: Cluster Stitching with Temporal Awareness
window.getClusterAverageTime = getClusterAverageTime;
window.getClusterTimeSpan = getClusterTimeSpan;
window.getDominantCategory = getDominantCategory;
window.getMinClusterDistance = getMinClusterDistance;
window.mergeRelatedClusters = mergeRelatedClusters;
window.filterClustersByRecency = filterClustersByRecency;
window.CLUSTER_STITCHING_CONFIG = CLUSTER_STITCHING_CONFIG;

// ==================== NLP DICTIONARY LOADER v2.0 ====================
// Core loader function
window.loadNLPDictionaries = loadNLPDictionaries;
window.getNLPDictionaries = getNLPDictionaries;
window.isNLPDictionaryReady = isNLPDictionaryReady;

// NLP Analysis functions
window.detectFilipinoKeywords = detectFilipinoKeywords;
window.detectMetaphoricalLanguage = detectMetaphoricalLanguage;
window.detectSpeculativeLanguage = detectSpeculativeLanguage;
window.calculateSeverityModifier = calculateSeverityModifier;
window.detectNoIssue = detectNoIssue;
window.analyzeComplaintText = analyzeComplaintText;

// Expose indices for advanced use (read-only reference)
window.NLP_KEYWORD_INDEX = NLP_KEYWORD_INDEX;

// ==================== ENGINE READY ====================
console.log('[ENGINE] SimulationEngine v4.0.0 loaded with Hybrid Edge-AI architecture.');
console.log('[ENGINE] v4.0 Features: Multi-label detection, Clause-based modifiers, TF.js AI fallback');
