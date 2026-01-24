const express = require('express');
const router = express.Router();
const AdvancedDecisionEngine = require('../services/AdvancedDecisionEngine');
const Database = require('../config/database');

// Middleware to check for Super Admin role (Simplified for now)
const requireSuperAdmin = async (req, res, next) => {
    // TODO: Integrate with actual Auth middleware
    // For now, proceed if authenticated
    next();
};

// GET /api/nlp/keywords
router.get('/keywords', requireSuperAdmin, async (req, res) => {
    try {
        const supabase = Database.getClient();
        const { data, error } = await supabase.from('nlp_keywords').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/nlp/keywords
router.post('/keywords', requireSuperAdmin, async (req, res) => {
    try {
        const supabase = Database.getClient();
        const { term, category, subcategory, confidence } = req.body;
        const { data, error } = await supabase
            .from('nlp_keywords')
            .insert({ term, category, subcategory, confidence })
            .select()
            .single();

        if (error) throw error;

        // Reload engine to apply changes
        await AdvancedDecisionEngine.initialize();

        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/nlp/classify-test (For testing/debugging)
router.post('/classify-test', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Text required' });

        const result = await AdvancedDecisionEngine.classify(text);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
