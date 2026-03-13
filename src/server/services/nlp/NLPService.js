/**
 * NLP SERVICE
 * ===========
 * Ported from nlp-processor.js
 * Hybrid Rule-Based + AI Text Analysis
 */

const tensorFlowService = require("../TensorFlowService"); // AI Fallback Provider

class NLPService {
  constructor() {
    this.CATEGORY_REGISTRY = this._initCategoryRegistry();
    this.HIERARCHY = this._initHierarchy();
    this.SYNONYMS = this._initSynonyms();
    this.NEGATION_PATTERNS = this._initNegationPatterns();
    this.FALSE_POSITIVE_ROOTS = this._initFalsePositiveRoots();
  }

  // ==================== DICTIONARIES ====================

  _initCategoryRegistry() {
    return {
      Utilities: {
        keywords: ["tubig", "walang tubig", "low pressure", "kuryente", "brownout", "blackout", "no water", "no power"],
        urgency: 55, confidence: 0.90
      },
      Sanitation: {
        keywords: ["baho", "mabaho", "basura", "kalat", "garbage", "trash", "dumping", "smelly"],
        urgency: 42, confidence: 0.88
      },
      Infrastructure: {
        keywords: ["lubak", "pothole", "sira", "daan", "kalsada", "crack", "bridge", "tulay", "road damage"],
        urgency: 50, confidence: 0.90
      },
      Environment: {
        keywords: ["baha", "flooding", "flood", "landslide", "erosion", "apaw", "lunop"],
        urgency: 75, confidence: 0.92
      },
      "Public Safety": {
        keywords: ["sunog", "fire", "smoke", "aksidente", "accident", "crime", "krimen", "robbery", "patay", "dead", "explosion"],
        urgency: 88, confidence: 0.95
      },
      "Traffic Congestion": {
        keywords: ["trapik", "traffic", "congestion", "gridlock", "siksikan"],
        urgency: 45, confidence: 0.85
      },
      "Stray Animals": {
        keywords: ["aso", "dog", "stray", "hayop", "snake", "ahas", "rabid"],
        urgency: 45, confidence: 0.85
      },
      "Pest Infestation": {
        keywords: ["lamok", "dengue", "daga", "rat", "cockroach", "ipis", "pest"],
        urgency: 40, confidence: 0.82
      },
      "Noise complaint": {
        keywords: ["ingay", "noise", "karaoke", "videoke", "loud", "tahol"],
        urgency: 30, confidence: 0.80
      }
    };
  }

  _initHierarchy() {
    return {
      "Pothole": "Infrastructure",
      "Road Damage": "Infrastructure",
      "Broken Streetlight": "Infrastructure",
      "No Water": "Utilities",
      "Blackout": "Utilities",
      "Pipe Leak": "Utilities",
      "Trash": "Sanitation",
      "Illegal Dumping": "Sanitation",
      "Bad Odor": "Sanitation",
      "Flood": "Environment",
      "Flooding": "Environment",
      "Landslide": "Environment",
      "Fire": "Public Safety",
      "Accident": "Public Safety",
      "Crime": "Public Safety",
      "Stray Dog": "Stray Animals",
      "Traffic": "Traffic Congestion"
    };
  }

  _initSynonyms() {
    return {
      "Garbage Collection": ["Trash", "Sanitation"],
      "Streetlight": ["Infrastructure", "Broken Streetlight"],
      "Road Repair": ["Pothole", "Road Damage"],
      "Water Supply": ["No Water", "Utilities"],
      "Power Outage": ["Blackout", "Utilities"],
      "Fire Incident": ["Fire", "Public Safety"]
    };
  }

  _initNegationPatterns() {
    return [
      "no", "not", "never", "none", "without", "don't", "fake", "false",
      "wala", "walang", "hindi", "di", "huwag", "ayaw",
      "walay", "dili", "way"
    ];
  }

  _initFalsePositiveRoots() {
    return {
      "baha": ["bahay", "kabahayan", "mabuhay", "bahagi", "kapitbahay"],
      "tubig": ["patubig"],
      "sunog": ["pakisunog", "ipasunog", "magpasunog", "sunog-baga"], // paki- filter
      "aso": ["asoge", "asosiasyon"],
      "pusa": ["pusang", "ipusa"]
    };
  }

  // ==================== CORE LOGIC ====================

  tokenizeText(text) {
    if (!text || typeof text !== "string") return [];
    return text.toLowerCase()
      .replace(/[.,!?;:'"()\-\/&@#$%^*+=<>[\]{}|\\~`]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(w => w.length > 0);
  }

  checkKeywordMatch(text, keyword) {
    if (!text || !keyword) return false;
    const normalizedText = text.toLowerCase();
    const cleanKeyword = keyword.toLowerCase().trim();

    // Phrase match
    if (cleanKeyword.includes(" ")) {
      const escaped = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // eslint-disable-next-line security/detect-non-literal-regexp
      const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$|[.,!?])`, "i");
      return regex.test(normalizedText);
    }

    // Token match with hygiene
    const tokens = this.tokenizeText(text);
    const blocklist = this.FALSE_POSITIVE_ROOTS[cleanKeyword] || [];

    for (const token of tokens) {
      if (token.includes(cleanKeyword)) {
        // False positive check
        const isBlocked = blocklist.some(root => token.includes(root.toLowerCase()));
        if (!isBlocked) return true;
      }
    }
    return false;
  }

  /**
   * Main Analysis Function
   * @param {string} text - The complaint description
   * @returns {Promise<Object>} Analysis result { category, confidence, ... }
   */
  async analyze(text) {
    if (!text) return { category: "Others", confidence: 0, method: "none" };

    // 1. Rule-Based Extraction
    const detected = [];
    for (const [cat, data] of Object.entries(this.CATEGORY_REGISTRY)) {
      const matchCount = data.keywords.filter(kw => this.checkKeywordMatch(text, kw)).length;
      if (matchCount > 0) {
        detected.push({ category: cat, matchCount, baseConfidence: data.confidence });
      }
    }

    detected.sort((a, b) => b.matchCount - a.matchCount);

    // 2. Decision Logic
    let result = { category: "Others", confidence: 0, method: "rule-based" };

    if (detected.length > 0) {
      const top = detected[0];
      // Start with base confidence
      let confidence = top.baseConfidence;

      // Boost if multiple keywords found
      if (top.matchCount > 1) confidence = Math.min(0.99, confidence + 0.05);

      result = {
        category: top.category,
        confidence: confidence.toFixed(2),
        matchCount: top.matchCount,
        method: "rule-based-keyword"
      };
    } else {
      // 3. AI Fallback (if no keywords found)
      try {
        // Call tensorFlowService for semantic analysis
        // We'll assume tensorFlowService has a method classifyWithNLP or similar
        // For now, we use classify() if available
        if (tensorFlowService.classify) {
          const aiResult = await tensorFlowService.classify(text);
          if (aiResult && aiResult.confidence > 0.6) {
            result = {
              category: aiResult.category,
              confidence: aiResult.confidence.toFixed(2),
              method: "ai-fallback-use"
            };
          }
        }
      } catch (e) {
        console.warn("[nLPService] AI Fallback failed:", e.message);
      }
    }

    return result;
  }

  /**
   * Check for mismatch between user selected category and text
   */
  validateCategoryMismatch(selectedCategory, description) {
    if (!description) return { mismatch: false };

    const detectedList = [];
    for (const [cat, data] of Object.entries(this.CATEGORY_REGISTRY)) {
      if (data.keywords.some(kw => this.checkKeywordMatch(description, kw))) {
        detectedList.push(cat);
      }
    }

    if (detectedList.length === 0) return { mismatch: false, reason: "No keywords" };

    // Direct Match
    if (detectedList.includes(selectedCategory)) return { mismatch: false, reason: "Direct match" };

    // Hierarchy Match
    const parent = this.HIERARCHY[selectedCategory];
    if (parent && detectedList.includes(parent)) return { mismatch: false, reason: "Parent match" };

    // Reverse Hierarchy (Selected is Parent)
    // Check if any detected category has selectedCategory as parent
    const isParentOfDetected = detectedList.some(det => this.HIERARCHY[det] === selectedCategory);
    if (isParentOfDetected) return { mismatch: false, reason: "Child match" };

    // Synonym Match
    const synonyms = this.SYNONYMS[selectedCategory] || [];
    if (detectedList.some(det => synonyms.includes(det))) return { mismatch: false, reason: "Synonym match" };

    // Real Mismatch
    return {
      mismatch: true,
      selected: selectedCategory,
      detected: detectedList[0], // Best guess
      allDetected: detectedList,
      reason: `Keywords indicate ${detectedList.join(", ")}`
    };
  }
}

module.exports = new NLPService();
