/**
 * NLP Management Service
 * Direct management of NLP data (keywords, categories, anchors) for Super Admin
 */

const Database = require("../config/database");

function normalizeConfidence(raw, defaultValue = 0.8) {
  if (raw === null || raw === undefined || raw === "") return defaultValue;

  if (typeof raw === "string") {
    const s = raw.trim();
    if (/^0\d$/.test(s)) {
      const v = Number(s[1]) / 10;
      if (Number.isFinite(v)) return Math.max(0, Math.min(1, v));
    }
  }

  const n = Number(raw);
  if (!Number.isFinite(n)) return defaultValue;

  if (n >= 0 && n <= 1) return n;
  if (n > 1 && n <= 100) return n / 100;
  return 1;
}

class NlpManagementService {
  get supabase() {
    return Database.getClient();
  }

  /**
     * Get all keywords with optional filtering
     */
  async getKeywords(filters = {}) {
    let query = this.supabase
      .from("nlp_keywords")
      .select("*")
      .order("category", { ascending: true })
      .order("term", { ascending: true });

    if (filters.category) {
      query = query.eq("category", filters.category);
    }

    if (filters.search) {
      query = query.ilike("term", `%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch keywords: ${error.message}`);
    return data;
  }

  /**
     * Add a new keyword directly
     */
  async addKeyword(keywordData) {
    const { term, category, subcategory, language, confidence } = keywordData;

    if (!term || !category) {
      throw new Error("Term and category are required");
    }

    const { data, error } = await this.supabase
      .from("nlp_keywords")
      .insert({
        term: term.toLowerCase().trim(),
        category,
        subcategory: subcategory || null,
        language: language || "all",
        confidence: normalizeConfidence(confidence, 0.8)
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(`Keyword "${term}" already exists`);
      }
      throw new Error(`Failed to add keyword: ${error.message}`);
    }

    return data;
  }

  /**
     * Update a keyword by ID
     */
  async updateKeyword(id, updates) {
    const allowedUpdates = ["term", "category", "subcategory", "language", "confidence", "translation"];
    const payload = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        if (key === "confidence") payload[key] = normalizeConfidence(updates[key], 0.8);
        else payload[key] = updates[key];
      }
    }

    if (Object.keys(payload).length === 0) {
      throw new Error("No valid updates provided");
    }

    const { data, error } = await this.supabase
      .from("nlp_keywords")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(`Keyword already exists`);
      }
      throw new Error(`Failed to update keyword: ${error.message}`);
    }

    return data;
  }

  /**
     * Delete a keyword by ID
     */
  async deleteKeyword(id) {
    const { data, error } = await this.supabase
      .from("nlp_keywords")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(`Failed to delete keyword: ${error.message}`);
    return data;
  }

  /**
     * Get all categories
     */
  async getCategories() {
    const { data, error } = await this.supabase
      .from("nlp_category_config")
      .select("*")
      .order("category", { ascending: true });

    if (error) throw new Error(`Failed to fetch categories: ${error.message}`);
    return data;
  }

  /**
     * Add a new category
     */
  async addCategory(categoryData) {
    const { category, parent_category, urgency_rating, description } = categoryData;

    if (!category) {
      throw new Error("Category name is required");
    }

    const { data, error } = await this.supabase
      .from("nlp_category_config")
      .insert({
        category,
        parent_category: parent_category || null,
        urgency_rating: urgency_rating || 30,
        description: description || null
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(`Category "${category}" already exists`);
      }
      throw new Error(`Failed to add category: ${error.message}`);
    }

    return data;
  }

  /**
     * Delete a category (checks for linked keywords first)
     */
  async deleteCategory(categoryName) {
    // Check if keywords are linked
    const { data: linkedKeywords, error: checkError } = await this.supabase
      .from("nlp_keywords")
      .select("id")
      .eq("category", categoryName)
      .limit(1);

    if (checkError) throw new Error(`Failed to check linked keywords: ${checkError.message}`);

    if (linkedKeywords && linkedKeywords.length > 0) {
      throw new Error(`Cannot delete category "${categoryName}" - it has linked keywords. Delete keywords first.`);
    }

    // Check if anchors are linked
    const { data: linkedAnchors, error: anchorCheckError } = await this.supabase
      .from("nlp_anchors")
      .select("id")
      .eq("category", categoryName)
      .limit(1);

    if (anchorCheckError) throw new Error(`Failed to check linked anchors: ${anchorCheckError.message}`);

    if (linkedAnchors && linkedAnchors.length > 0) {
      throw new Error(`Cannot delete category "${categoryName}" - it has linked anchors. Delete anchors first.`);
    }

    const { data, error } = await this.supabase
      .from("nlp_category_config")
      .delete()
      .eq("category", categoryName)
      .select()
      .single();

    if (error) throw new Error(`Failed to delete category: ${error.message}`);
    return data;
  }

  /**
     * Get all anchors
     */
  async getAnchors(filters = {}) {
    let query = this.supabase
      .from("nlp_anchors")
      .select("*")
      .order("category", { ascending: true });

    if (filters.category) {
      query = query.eq("category", filters.category);
    }

    const { data, error } = await query;

    if (error) throw new Error(`Failed to fetch anchors: ${error.message}`);
    return data;
  }

  /**
     * Add a new anchor
     */
  async addAnchor(anchorData) {
    const { category, anchor_text } = anchorData;

    if (!category || !anchor_text) {
      throw new Error("Category and anchor text are required");
    }

    const { data, error } = await this.supabase
      .from("nlp_anchors")
      .insert({
        category,
        anchor_text
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add anchor: ${error.message}`);
    return data;
  }

  /**
     * Delete an anchor by ID
     */
  async deleteAnchor(id) {
    const { data, error } = await this.supabase
      .from("nlp_anchors")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(`Failed to delete anchor: ${error.message}`);
    return data;
  }

  async getMetaphors(filters = {}) {
    let query = this.supabase
      .from("nlp_metaphors")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters.search) {
      query = query.ilike("pattern", `%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch metaphors: ${error.message}`);
    return data;
  }

  async addMetaphor(metaphorData) {
    const { pattern, literal_meaning, actual_meaning, filter_type, is_emergency } = metaphorData;

    if (!pattern) {
      throw new Error("Pattern is required");
    }

    const payload = {
      pattern: String(pattern).trim(),
      literal_meaning: literal_meaning || null,
      actual_meaning: actual_meaning || null,
      filter_type: filter_type || null,
      is_emergency: is_emergency === true
    };

    const { data, error } = await this.supabase
      .from("nlp_metaphors")
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(`Metaphor "${pattern}" already exists`);
      }
      throw new Error(`Failed to add metaphor: ${error.message}`);
    }

    return data;
  }

  async deleteMetaphor(id) {
    const { data, error } = await this.supabase
      .from("nlp_metaphors")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(`Failed to delete metaphor: ${error.message}`);
    return data;
  }

  /**
     * Get summary stats for management view
     */
  async getManagementStats() {
    const [keywords, categories, anchors] = await Promise.all([
      this.supabase.from("nlp_keywords").select("*", { count: "exact", head: true }),
      this.supabase.from("nlp_category_config").select("*", { count: "exact", head: true }),
      this.supabase.from("nlp_anchors").select("*", { count: "exact", head: true })
    ]);

    return {
      keywords: keywords.count || 0,
      categories: categories.count || 0,
      anchors: anchors.count || 0
    };
  }

  async getDictionaryRules(filters = {}) {
    let query = this.supabase
      .from("nlp_dictionary_rules")
      .select("*")
      .order("rule_type", { ascending: true })
      .order("pattern", { ascending: true });

    if (filters.rule_type) {
      query = query.eq("rule_type", filters.rule_type);
    }
    if (filters.search) {
      query = query.ilike("pattern", `%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) {
      const msg = error.message || "";
      if (msg.includes("schema cache") || msg.includes("Could not find the table")) {
        throw new Error("Dictionary rules table is not available. Apply the nlp_dictionary_rules migration in Supabase.");
      }
      throw new Error(`Failed to fetch dictionary rules: ${error.message}`);
    }
    return data;
  }

  async addDictionaryRule(ruleData, userRole, userId) {
    const {
      rule_type,
      pattern,
      translation,
      multiplier,
      action,
      is_current_emergency
    } = ruleData;

    if (!rule_type || !pattern) {
      throw new Error("rule_type and pattern are required");
    }

    const isModifierRule = rule_type === "severity_amplifier" || rule_type === "severity_diminisher";
    if (isModifierRule && userRole !== "super-admin") {
      throw new Error("Modifier rules require Super Admin verification. Submit a proposal instead.");
    }
    if (isModifierRule && (multiplier === undefined || multiplier === null || multiplier === "")) {
      throw new Error("Multiplier is required for modifier rules");
    }

    const payload = {
      rule_type,
      pattern: String(pattern).trim(),
      translation: translation || null,
      multiplier: multiplier !== undefined && multiplier !== null && multiplier !== "" ? multiplier : null,
      action: action || null,
      is_current_emergency: is_current_emergency === true,
      created_by: userId || null,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from("nlp_dictionary_rules")
      .insert(payload)
      .select()
      .single();

    if (error) {
      const msg = error.message || "";
      if (msg.includes("schema cache") || msg.includes("Could not find the table")) {
        throw new Error("Dictionary rules table is not available. Apply the nlp_dictionary_rules migration in Supabase.");
      }
      if (error.code === "23505") {
        throw new Error(`Rule "${rule_type}:${pattern}" already exists`);
      }
      throw new Error(`Failed to add dictionary rule: ${error.message}`);
    }

    return data;
  }

  async deleteDictionaryRule(id, userRole) {
    if (userRole !== "super-admin") {
      const { data: existing, error: existingError } = await this.supabase
        .from("nlp_dictionary_rules")
        .select("rule_type")
        .eq("id", id)
        .single();
      if (existingError) throw new Error(`Failed to delete dictionary rule: ${existingError.message}`);
      const ruleType = existing?.rule_type;
      if (ruleType === "severity_amplifier" || ruleType === "severity_diminisher") {
        throw new Error("Only Super Admin can delete modifier rules");
      }
    }

    const { data, error } = await this.supabase
      .from("nlp_dictionary_rules")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) {
      const msg = error.message || "";
      if (msg.includes("schema cache") || msg.includes("Could not find the table")) {
        throw new Error("Dictionary rules table is not available. Apply the nlp_dictionary_rules migration in Supabase.");
      }
      throw new Error(`Failed to delete dictionary rule: ${error.message}`);
    }
    return data;
  }

  /**
     * Get complete dictionary for NLP engine (Client Consumption)
     */
  async getCompleteDictionary() {
    const _fetchSafe = async (tableName) => {
      try {
        const { data, error } = await this.supabase.from(tableName).select("*");
        if (error) {
          console.warn(`[NlpManagementService] Error fetching ${tableName}: ${error.message}`);
          return [];
        }
        return data || [];
      } catch (e) {
        console.warn(`[NlpManagementService] Exception fetching ${tableName}: ${e.message}`);
        return [];
      }
    };

    const [keywords, metaphors, rules] = await Promise.all([
      this.getKeywords(),
      _fetchSafe("nlp_metaphors"),
      _fetchSafe("nlp_dictionary_rules")
    ]);

    const dictionary = {
      _metadata: {
        version: "2.0.0",
        generated_at: new Date().toISOString(),
        total_entries: keywords.length,
        languages: ["filipino", "tagalog", "cebuano", "english"]
      },
      filipino_keywords: {},
      english_keywords: {},
      metaphor_filters: { patterns: [] },
      speculation_patterns: {
        conditional_triggers: [],
        risk_assessment_language: [],
        past_event_markers: []
      },
      severity_modifiers: {
        amplifiers: [],
        diminishers: []
      },
      negation_patterns: { no_issue_indicators: [] },
      temporal_present: ["ngayon", "karon", "currently", "happening now", "ongoing"],
      temporal_past: ["kanina", "ganina", "kahapon", "kagahapon", "yesterday", "earlier"],
      temporal_future: ["bukas", "ugma", "later", "soon", "mamaya"]
    };

    // Populate keywords
    for (const k of keywords) {
      if (k.language === "english") {
        if (!dictionary.english_keywords[k.category]) {
          dictionary.english_keywords[k.category] = [];
        }
        dictionary.english_keywords[k.category].push({
          term: k.term,
          category: k.category,
          confidence: k.confidence
        });
      } else {
        if (!dictionary.filipino_keywords[k.category]) {
          dictionary.filipino_keywords[k.category] = {};
        }
        const subCat = k.subcategory || k.category;
        if (!dictionary.filipino_keywords[k.category][subCat]) {
          dictionary.filipino_keywords[k.category][subCat] = [];
        }
        dictionary.filipino_keywords[k.category][subCat].push({
          term: k.term,
          translation: k.translation || "",
          category: k.category,
          subcategory: k.subcategory,
          confidence: k.confidence
        });
      }
    }

    // Populate Metaphors
    for (const m of metaphors) {
      dictionary.metaphor_filters.patterns.push({
        pattern: m.pattern,
        literal: m.literal_meaning || "",
        actual_meaning: m.actual_meaning || "",
        filter_type: m.filter_type || "METAPHOR",
        is_emergency: m.is_emergency || false
      });
    }

    // Populate Rules
    for (const r of rules) {
      const patternObj = {
        pattern: r.pattern,
        translation: r.translation || ""
      };

      if (r.rule_type === "conditional" || r.rule_type === "conditional_trigger") {
        patternObj.type = r.rule_type;
        dictionary.speculation_patterns.conditional_triggers.push(patternObj);
      } else if (r.rule_type === "speculative_risk" || r.rule_type === "risk_assessment_language") {
        patternObj.type = r.rule_type;
        dictionary.speculation_patterns.risk_assessment_language.push(patternObj);
      } else if (r.rule_type === "past_reference" || r.rule_type === "past_event_marker") {
        patternObj.type = r.rule_type;
        patternObj.is_current_emergency = r.is_current_emergency || false;
        dictionary.speculation_patterns.past_event_markers.push(patternObj);
      } else if (r.rule_type === "severity_amplifier") {
        patternObj.multiplier = r.multiplier || 1.5;
        patternObj.term = r.pattern;
        dictionary.severity_modifiers.amplifiers.push(patternObj);
      } else if (r.rule_type === "severity_diminisher") {
        patternObj.multiplier = r.multiplier || 0.5;
        patternObj.term = r.pattern;
        dictionary.severity_modifiers.diminishers.push(patternObj);
      } else if (r.rule_type === "negation" || r.rule_type === "no_issue_indicator") {
        patternObj.action = r.action || "filter_out";
        dictionary.negation_patterns.no_issue_indicators.push(patternObj);
      }
    }

    return dictionary;
  }
}


module.exports = new NlpManagementService();
