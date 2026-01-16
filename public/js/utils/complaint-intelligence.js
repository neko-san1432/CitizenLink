/**
 * CitizenLink Complaint Intelligence v3.6
 * ========================================
 * Ported from Simulation Engine for Production Use
 * 
 * FEATURES:
 * - Metaphor Detection ("flood of students" != Flood)
 * - Urgency Scoring (0-100 based on context)
 * - Auto-Categorization (Detects "Fire" in "Others" category)
 * - Speculation Detection ("baka may accident" != Accident)
 * - Context Suppression (Traffic/Maintenance/Noise overrides)
 */

// ==================== CONFIGURATION & DICTIONARIES ====================

const EMERGENCY_CATEGORIES = [
    "Fire", "Flooding", "Flood", "Accident", "Crime",
    "Medical", "Public Safety", "Explosion", "Collapse"
];

const EMERGENCY_KEYWORDS = {
    "fire": "FIRE", "sunog": "FIRE", "nasusunog": "FIRE", "apoy": "FIRE", "burning": "FIRE",
    "dead": "CASUALTY", "patay": "CASUALTY", "namatay": "CASUALTY", "death": "CASUALTY", "killed": "CASUALTY",
    "blood": "MEDICAL", "dugo": "MEDICAL", "injured": "MEDICAL", "sugat": "MEDICAL",
    "accident": "ACCIDENT", "aksidente": "ACCIDENT", "nabangga": "ACCIDENT", "collision": "ACCIDENT",
    "flood": "FLOOD", "baha": "FLOOD", "bumabaha": "FLOOD", "flash flood": "FLOOD",
    "gun": "CRIME", "baril": "CRIME", "holdup": "CRIME", "robbery": "CRIME", "stabbed": "CRIME",
    "heart attack": "MEDICAL", "stroke": "MEDICAL", "unconscious": "MEDICAL"
};

const SPECULATIVE_TRIGGERS = [
    "might", "could", "may", "possible", "risk of", "prone to", "prevent", "avoid", "in case",
    "baka", "pwede", "posible", "siguro", "kasi", "para", "iwas", "maiwasan", "bago", "kung",
    "kapag", "ma-", "maka-", "maging", "delikado"
];

const METAPHOR_PATTERNS = {
    'flood': ['flood of', 'flooding with', 'flooded by'],
    'fire': ['fire sale', 'fired from', 'fire in the belly', 'spitting fire'],
    'dead': ['deadline', 'dead end', 'dead spot', 'dead heat', 'dead wrong'],
    'crash': ['crash course', 'market crash']
};

const HUMAN_SUBJECT_KEYWORDS = [
    'students', 'people', 'customers', 'emails', 'orders', 'notifications',
    'visitors', 'tourists', 'workers', 'employees', 'staff', 'team',
    'requests', 'messages', 'calls', 'complaints', 'questions', 'comments',
    'applications', 'submissions', 'likes', 'followers', 'tao', 'estudyante'
];

const INANIMATE_SUBJECTS = {
    technology: ['phone', 'cellphone', 'cp', 'mobile', 'battery', 'laptop', 'computer', 'wifi', 'internet', 'app', 'system', 'server', 'screen'],
    time: ['deadline', 'schedule', 'calendar', 'day', 'week', 'month', 'year', 'hour', 'minute', 'moment'],
    abstract: ['idea', 'plan', 'project', 'proposal', 'deal', 'agreement', 'market', 'stock', 'economy', 'silence', 'mood', 'fashion', 'game'],
    nature: ['sunset', 'sunrise', 'sky', 'autumn', 'leaves', 'passion', 'energy'],
    groups: ['students', 'people', 'customers', 'visitors', 'workers', 'staff', 'requests', 'emails', 'messages', 'orders', 'complaints', 'comments', 'data'],
    tagalog: ['telepono', 'cellphone', 'cp', 'tao', 'estudyante', 'trabaho', 'araw', 'gabi']
};

const IDIOMATIC_EXPRESSIONS = [
    "on fire", "fire in the belly", "play with fire", "add fuel to the fire",
    "flood of tears", "flood the market", "flood of emotions",
    "dead in the water", "dead end", "dead tired", "drop dead gorgeous",
    "killing it", "kill time", "dressed to kill",
    "crash course", "system crash", "jump the gun", "patay gutom", "patay malisya"
];

const FIGURATIVE_QUALIFIERS = [
    'literally', 'basically', 'totally', 'completely', 'absolutely', 'so', 'like', 'lowkey', 'highkey',
    'fr fr', 'no cap', 'im', 'i\'m', 'i am', 'sobrang', 'ang', 'grabe'
];

const AUTO_CAT_PRIORITIES = {
    'Fire': 100, 'Explosion': 100, 'Collapse': 95, 'Trapped': 95, 'Gunshot': 90, 'Crime': 85, 'Accident': 80,
    'Flood': 75, 'Medical': 70, 'Public Safety': 65, 'No Water': 60,
    'Traffic': 40, 'Pothole': 30, 'Garbage': 25, 'Noise': 20, 'Streetlight': 20,
    'Others': 10, 'Unsure': 5
};

const HIGHWAY_KEYWORDS = ['highway', 'national road', 'expressway', 'avenue', 'boulevard', 'national highway', 'maharlika', 'diversion road', 'bypass'];
const HYDRO_KEYWORDS = ['river', 'creek', 'bridge', 'estero', 'canal', 'ilog', 'sapa', 'crossing', 'riverside', 'waterway', 'stream', 'tulay'];

// ==================== HELPER FUNCTIONS ====================

function getCategoryPriority(category) {
    return AUTO_CAT_PRIORITIES[category] || 10;
}

function extractKeywordsWithCategory(description) {
    if (!description || typeof description !== 'string') return { category: null, priority: 0, matchedKeywords: [] };

    const text = description.toLowerCase();
    const matchedKeywords = [];
    const CATEGORY_PATTERNS = {
        'Fire': ['sunog', 'fire', 'nasusunog', 'apoy', 'burning'],
        'Explosion': ['explosion', 'explode', 'pumutok', 'sumabog'],
        'Collapse': ['collapse', 'gumuho', 'bumagsak'],
        'Trapped': ['trapped', 'nakulong', 'naiipit', 'stranded person'],
        'Gunshot': ['gunshot', 'baril', 'binaril', 'putok ng baril'],
        'Crime': ['crime', 'robbery', 'holdup', 'nakaw', 'snatcher'],
        'Accident': ['accident', 'aksidente', 'nabangga', 'collision'],
        'Flood': ['flood', 'baha', 'binabaha', 'tubig-baha'],
        'Medical': ['medical', 'emergency', 'injured', 'sugatan', 'ambulance', 'heart attack', 'stroke'],
        'Traffic': ['traffic', 'trapik', 'congestion'],
        'Pothole': ['pothole', 'butas', 'lubak'],
        'Garbage': ['garbage', 'basura', 'trash'],
        'Streetlight': ['streetlight', 'ilaw', 'no light', 'walang ilaw']
    };

    let highestCategory = null;
    let highestPriority = 0;

    for (const [category, keywords] of Object.entries(CATEGORY_PATTERNS)) {
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                matchedKeywords.push(keyword);
                const priority = getCategoryPriority(category);
                if (priority > highestPriority) {
                    highestPriority = priority;
                    highestCategory = category;
                }
            }
        }
    }

    return { category: highestCategory, priority: highestPriority, matchedKeywords };
}

function checkSpeculativeContext(text, keyword) {
    const keywordIndex = text.indexOf(keyword.toLowerCase());
    if (keywordIndex === -1) return { isSpeculative: false, trigger: null };

    const preContext = text.substring(Math.max(0, keywordIndex - 30), keywordIndex).toLowerCase();

    for (const trigger of SPECULATIVE_TRIGGERS) {
        if (trigger.endsWith('-')) {
            const prefix = trigger.slice(0, -1);
            const wordBeforeKeyword = preContext.trim().split(/\s+/).pop() || '';
            if (wordBeforeKeyword === prefix || preContext.endsWith(prefix)) {
                return { isSpeculative: true, trigger: trigger };
            }
        } else {
            if (preContext.includes(trigger)) {
                return { isSpeculative: true, trigger: trigger };
            }
        }
    }
    return { isSpeculative: false, trigger: null };
}

function isMetaphoricalUsage(text, keyword) {
    const lowerText = text.toLowerCase().trim();
    const lowerKeyword = keyword.toLowerCase().trim();

    // 1. Idioms
    for (const idiom of IDIOMATIC_EXPRESSIONS) {
        if (lowerText.includes(idiom)) {
            return { isMetaphorical: true, reason: `Idiom: "${idiom}"` };
        }
    }

    // 2. Patterns
    const patterns = METAPHOR_PATTERNS[lowerKeyword] || [];
    for (const pattern of patterns) {
        if (lowerText.includes(pattern)) {
            if (pattern === 'flood of' || pattern === 'baha ng') {
                const after = lowerText.substring(lowerText.indexOf(pattern) + pattern.length);
                const isGroup = HUMAN_SUBJECT_KEYWORDS.some(k => after.includes(k)) ||
                    INANIMATE_SUBJECTS.groups.some(k => after.includes(k));
                if (isGroup) return { isMetaphorical: true, reason: `Pattern: "${pattern}" + group` };
            } else {
                return { isMetaphorical: true, reason: `Pattern: "${pattern}"` };
            }
        }
    }

    // 3. Inanimate Subjects
    const allInanimates = Object.values(INANIMATE_SUBJECTS).flat();
    const keywordIndex = lowerText.indexOf(lowerKeyword);
    if (keywordIndex !== -1) {
        const before = lowerText.substring(Math.max(0, keywordIndex - 30), keywordIndex);
        const after = lowerText.substring(keywordIndex + lowerKeyword.length, keywordIndex + lowerKeyword.length + 30);

        for (const subj of allInanimates) {
            if (before.includes(subj) || after.includes(subj)) {
                // Exception for location markers in 'after'
                if (after.includes(subj) && (after.includes('at') || after.includes('sa'))) continue;
                return { isMetaphorical: true, reason: `Inanimate subject: "${subj}"` };
            }
        }
    }

    // 4. Qualifiers
    for (const qual of FIGURATIVE_QUALIFIERS) {
        if (lowerText.includes(`${qual} ${lowerKeyword}`)) {
            return { isMetaphorical: true, reason: `Qualifier: "${qual}"` };
        }
    }

    return { isMetaphorical: false, reason: "Literal usage" };
}

// ==================== MAIN INTELLIGENCE CLASS ====================

class ComplaintIntelligence {
    constructor() {
        this.version = "3.6";
        console.log("ComplaintIntelligence initialized");
    }

    /**
     * Analyze a complaint to determine urgency, verify category, and detect metaphors.
     */
    analyze(point) {
        const description = (point.description || '').toLowerCase();
        let effectiveCategory = point.subcategory || point.category || 'Others';

        // 1. AUTO-CATEGORIZATION
        const nlpResult = extractKeywordsWithCategory(description);
        const currentPriority = getCategoryPriority(effectiveCategory);
        let aiReclassified = false;

        if (effectiveCategory === 'Others' || (nlpResult.priority > currentPriority + 30)) {
            if (nlpResult.category && nlpResult.matchedKeywords.length > 0) {
                // Verify non-speculative
                const keyword = nlpResult.matchedKeywords[0];
                const specCheck = checkSpeculativeContext(description, keyword);

                if (!specCheck.isSpeculative) {
                    effectiveCategory = nlpResult.category;
                    aiReclassified = true;
                }
            }
        }

        // 2. CONTEXT SUPPRESSION
        const TRAFFIC_CONTEXT = ['traffic', 'congestion', 'jam', 'gridlock', 'bumabagal'];
        const MAINTENANCE_CONTEXT = ['maintenance', 'repair', 'ginagawa', 'ayos'];
        const NOISE_CONTEXT = ['ingay', 'noise', 'videoke', 'karaoke', 'loud'];

        let isContextSuppressed = false;
        let suppressionType = null;

        if (TRAFFIC_CONTEXT.some(k => description.includes(k))) { isContextSuppressed = true; suppressionType = 'Traffic'; }
        else if (MAINTENANCE_CONTEXT.some(k => description.includes(k))) { isContextSuppressed = true; suppressionType = 'Maintenance'; }
        else if (NOISE_CONTEXT.some(k => description.includes(k))) { isContextSuppressed = true; suppressionType = 'Noise'; }

        // 3. URGENCY SCORING
        let baseScore = 10;
        const TIER_1 = ['Fire', 'Accident', 'Crime', 'Explosion'];
        const TIER_2 = ['Flood', 'Medical', 'Public Safety'];

        if (TIER_1.some(t => effectiveCategory.includes(t))) baseScore = 50;
        else if (TIER_2.some(t => effectiveCategory.includes(t))) baseScore = 30;

        let panicScore = 0;
        if (description === description.toUpperCase() && description.length > 10) panicScore += 10;
        if (description.includes('!')) panicScore += 5;
        if (['help', 'tulong', 'emergency', 'saklolo'].some(k => description.includes(k))) panicScore += 2;

        let urgencyScore = baseScore + panicScore;

        // Apply suppression
        if (isContextSuppressed) {
            urgencyScore = Math.min(urgencyScore, 35);
        }

        // 3.5 GEOSPATIAL BOOSTS (v3.7)
        let geoBoost = 0;
        let geoReason = null;
        let veracityLabel = (description.split(' ').length > 5) ? 'High Confidence' : 'Moderate';
        const locationLower = (point.location || '').toLowerCase();

        // B1. Highway Priority Boost (+15)
        if (effectiveCategory === 'Pothole' || effectiveCategory === 'Accident' || effectiveCategory === 'Traffic') {
            if (HIGHWAY_KEYWORDS.some(k => locationLower.includes(k))) {
                geoBoost += 15;
                geoReason = 'Major Highway';
            }
        }

        // B2. Hydrological Validation Boost (+10)
        if (effectiveCategory === 'Flood' || effectiveCategory === 'Rescue') {
            if (HYDRO_KEYWORDS.some(k => locationLower.includes(k))) {
                geoBoost += 10;
                geoReason = 'Near Waterway';
                veracityLabel = 'GEO-VERIFIED';
            }
        }

        urgencyScore += geoBoost;

        // 4. CRITICAlITY CHECK (with Metaphor Filter)
        let isCritical = urgencyScore >= 50;
        let metaphorDetected = false;

        if (isCritical) {
            // Double check if it's metaphorical
            for (const [kw, type] of Object.entries(EMERGENCY_KEYWORDS)) {
                if (description.includes(kw)) {
                    const metaCheck = isMetaphoricalUsage(description, kw);
                    if (metaCheck.isMetaphorical) {
                        isCritical = false;
                        urgencyScore = Math.min(urgencyScore, 40);
                        metaphorDetected = true;
                        break;
                    }
                }
            }
        }

        return {
            urgencyScore,
            isCritical,
            effectiveCategory,
            aiReclassified,
            isContextSuppressed,
            suppressionType,
            metaphorDetected,
            geoBoost,
            geoReason,
            veracityLabel
        };
    }
}

// Expose to global scope
window.ComplaintIntelligence = ComplaintIntelligence;
