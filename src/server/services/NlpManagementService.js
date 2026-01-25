/**
 * NLP Management Service
 * Direct management of NLP data (keywords, categories, anchors) for Super Admin
 */

const Database = require('../config/database');

class NlpManagementService {
    get supabase() {
        return Database.getClient();
    }

    /**
     * Get all keywords with optional filtering
     */
    async getKeywords(filters = {}) {
        let query = this.supabase
            .from('nlp_keywords')
            .select('*')
            .order('category', { ascending: true })
            .order('term', { ascending: true });

        if (filters.category) {
            query = query.eq('category', filters.category);
        }

        if (filters.search) {
            query = query.ilike('term', `%${filters.search}%`);
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
            throw new Error('Term and category are required');
        }

        const { data, error } = await this.supabase
            .from('nlp_keywords')
            .insert({
                term: term.toLowerCase().trim(),
                category,
                subcategory: subcategory || null,
                language: language || 'all',
                confidence: parseFloat(confidence) || 0.8
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error(`Keyword "${term}" already exists`);
            }
            throw new Error(`Failed to add keyword: ${error.message}`);
        }

        return data;
    }

    /**
     * Delete a keyword by ID
     */
    async deleteKeyword(id) {
        const { data, error } = await this.supabase
            .from('nlp_keywords')
            .delete()
            .eq('id', id)
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
            .from('nlp_category_config')
            .select('*')
            .order('category', { ascending: true });

        if (error) throw new Error(`Failed to fetch categories: ${error.message}`);
        return data;
    }

    /**
     * Add a new category
     */
    async addCategory(categoryData) {
        const { category, parent_category, urgency_rating, description } = categoryData;

        if (!category) {
            throw new Error('Category name is required');
        }

        const { data, error } = await this.supabase
            .from('nlp_category_config')
            .insert({
                category,
                parent_category: parent_category || null,
                urgency_rating: urgency_rating || 30,
                description: description || null
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
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
            .from('nlp_keywords')
            .select('id')
            .eq('category', categoryName)
            .limit(1);

        if (checkError) throw new Error(`Failed to check linked keywords: ${checkError.message}`);

        if (linkedKeywords && linkedKeywords.length > 0) {
            throw new Error(`Cannot delete category "${categoryName}" - it has linked keywords. Delete keywords first.`);
        }

        // Check if anchors are linked
        const { data: linkedAnchors, error: anchorCheckError } = await this.supabase
            .from('nlp_anchors')
            .select('id')
            .eq('category', categoryName)
            .limit(1);

        if (anchorCheckError) throw new Error(`Failed to check linked anchors: ${anchorCheckError.message}`);

        if (linkedAnchors && linkedAnchors.length > 0) {
            throw new Error(`Cannot delete category "${categoryName}" - it has linked anchors. Delete anchors first.`);
        }

        const { data, error } = await this.supabase
            .from('nlp_category_config')
            .delete()
            .eq('category', categoryName)
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
            .from('nlp_anchors')
            .select('*')
            .order('category', { ascending: true });

        if (filters.category) {
            query = query.eq('category', filters.category);
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
            throw new Error('Category and anchor text are required');
        }

        const { data, error } = await this.supabase
            .from('nlp_anchors')
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
            .from('nlp_anchors')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(`Failed to delete anchor: ${error.message}`);
        return data;
    }

    async getMetaphors(filters = {}) {
        let query = this.supabase
            .from('nlp_metaphors')
            .select('*')
            .order('created_at', { ascending: false });

        if (filters.search) {
            query = query.ilike('pattern', `%${filters.search}%`);
        }

        const { data, error } = await query;
        if (error) throw new Error(`Failed to fetch metaphors: ${error.message}`);
        return data;
    }

    async addMetaphor(metaphorData) {
        const { pattern, literal_meaning, actual_meaning, filter_type, is_emergency } = metaphorData;

        if (!pattern) {
            throw new Error('Pattern is required');
        }

        const payload = {
            pattern: String(pattern).trim(),
            literal_meaning: literal_meaning || null,
            actual_meaning: actual_meaning || null,
            filter_type: filter_type || null,
            is_emergency: is_emergency === true
        };

        const { data, error } = await this.supabase
            .from('nlp_metaphors')
            .insert(payload)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error(`Metaphor "${pattern}" already exists`);
            }
            throw new Error(`Failed to add metaphor: ${error.message}`);
        }

        return data;
    }

    async deleteMetaphor(id) {
        const { data, error } = await this.supabase
            .from('nlp_metaphors')
            .delete()
            .eq('id', id)
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
            this.supabase.from('nlp_keywords').select('*', { count: 'exact', head: true }),
            this.supabase.from('nlp_category_config').select('*', { count: 'exact', head: true }),
            this.supabase.from('nlp_anchors').select('*', { count: 'exact', head: true })
        ]);

        return {
            keywords: keywords.count || 0,
            categories: categories.count || 0,
            anchors: anchors.count || 0
        };
    }

    async getDictionaryRules(filters = {}) {
        let query = this.supabase
            .from('nlp_dictionary_rules')
            .select('*')
            .order('rule_type', { ascending: true })
            .order('pattern', { ascending: true });

        if (filters.rule_type) {
            query = query.eq('rule_type', filters.rule_type);
        }
        if (filters.search) {
            query = query.ilike('pattern', `%${filters.search}%`);
        }

        const { data, error } = await query;
        if (error) {
            const msg = error.message || '';
            if (msg.includes("schema cache") || msg.includes("Could not find the table")) {
                throw new Error('Dictionary rules table is not available. Apply the nlp_dictionary_rules migration in Supabase.');
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
            throw new Error('rule_type and pattern are required');
        }

        const isModifierRule = rule_type === 'severity_amplifier' || rule_type === 'severity_diminisher';
        if (isModifierRule && userRole !== 'super-admin') {
            throw new Error('Modifier rules require Super Admin verification. Submit a proposal instead.');
        }
        if (isModifierRule && (multiplier === undefined || multiplier === null || multiplier === '')) {
            throw new Error('Multiplier is required for modifier rules');
        }

        const payload = {
            rule_type,
            pattern: String(pattern).trim(),
            translation: translation || null,
            multiplier: multiplier !== undefined && multiplier !== null && multiplier !== '' ? multiplier : null,
            action: action || null,
            is_current_emergency: is_current_emergency === true,
            created_by: userId || null,
            updated_at: new Date().toISOString()
        };

        const { data, error } = await this.supabase
            .from('nlp_dictionary_rules')
            .insert(payload)
            .select()
            .single();

        if (error) {
            const msg = error.message || '';
            if (msg.includes("schema cache") || msg.includes("Could not find the table")) {
                throw new Error('Dictionary rules table is not available. Apply the nlp_dictionary_rules migration in Supabase.');
            }
            if (error.code === '23505') {
                throw new Error(`Rule "${rule_type}:${pattern}" already exists`);
            }
            throw new Error(`Failed to add dictionary rule: ${error.message}`);
        }

        return data;
    }

    async deleteDictionaryRule(id, userRole) {
        if (userRole !== 'super-admin') {
            const { data: existing, error: existingError } = await this.supabase
                .from('nlp_dictionary_rules')
                .select('rule_type')
                .eq('id', id)
                .single();
            if (existingError) throw new Error(`Failed to delete dictionary rule: ${existingError.message}`);
            const ruleType = existing?.rule_type;
            if (ruleType === 'severity_amplifier' || ruleType === 'severity_diminisher') {
                throw new Error('Only Super Admin can delete modifier rules');
            }
        }

        const { data, error } = await this.supabase
            .from('nlp_dictionary_rules')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) {
            const msg = error.message || '';
            if (msg.includes("schema cache") || msg.includes("Could not find the table")) {
                throw new Error('Dictionary rules table is not available. Apply the nlp_dictionary_rules migration in Supabase.');
            }
            throw new Error(`Failed to delete dictionary rule: ${error.message}`);
        }
        return data;
    }

    /**
     * Get complete dictionary for NLP engine (Client Consumption)
     */
    async getCompleteDictionary() {
        const keywords = await this.getKeywords();
        
        const dictionary = {
            _metadata: {
                version: '1.0.0',
                generated_at: new Date().toISOString(),
                total_entries: keywords.length
            },
            filipino_keywords: {},
            english_keywords: {}
        };

        // Helper to add to nested structure
        const addToDict = (langObj, category, keywordObj) => {
            if (!langObj[category]) langObj[category] = [];
            langObj[category].push({
                term: keywordObj.term,
                category: keywordObj.category,
                subcategory: keywordObj.subcategory,
                confidence: keywordObj.confidence
            });
        };

        for (const k of keywords) {
            // Map 'all', 'cebuano', 'tagalog' to filipino_keywords for now as per legacy structure
            // or put them in english if language is english
            if (k.language === 'english') {
                addToDict(dictionary.english_keywords, k.category, k);
            } else {
                // Default to filipino bucket for tagalog, cebuano, and all
                addToDict(dictionary.filipino_keywords, k.category, k);
            }
        }

        return dictionary;
    }
}


module.exports = new NlpManagementService();
