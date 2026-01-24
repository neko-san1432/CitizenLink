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
                confidence: confidence || 0.8
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
}

module.exports = new NlpManagementService();
