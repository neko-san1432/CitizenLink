/**
 * NLP Management Controller
 * API handlers for Super Admin direct NLP data management
 */

const NlpManagementService = require('../services/NlpManagementService');

class NlpManagementController {
    // =========== KEYWORDS ===========

    async getKeywords(req, res) {
        try {
            const filters = {
                category: req.query.category,
                search: req.query.search
            };
            const keywords = await NlpManagementService.getKeywords(filters);
            res.json({ success: true, data: keywords });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async addKeyword(req, res) {
        try {
            console.log('[NlpController] Adding keyword:', req.body);
            const keyword = await NlpManagementService.addKeyword(req.body);
            res.status(201).json({ success: true, data: keyword });
        } catch (error) {
            console.error('[NlpController] Error adding keyword:', error);
            const msg = String(error.message || "");
            const status = msg.includes("already exists")
                ? 409
                : msg.includes("required")
                    ? 400
                    : 500;
            res.status(status).json({ success: false, error: error.message, stack: process.env.NODE_ENV === 'development' ? error.stack : undefined });
        }
    }

    async updateKeyword(req, res) {
        try {
            const { id } = req.params;
            console.log('[NlpController] Updating keyword:', id, req.body);
            const keyword = await NlpManagementService.updateKeyword(id, req.body);
            res.json({ success: true, data: keyword });
        } catch (error) {
            console.error('[NlpController] Error updating keyword:', error);
            const msg = String(error.message || "");
            const status = msg.includes("already exists") ? 409 : 500;
            res.status(status).json({ success: false, error: error.message });
        }
    }

    async deleteKeyword(req, res) {
        try {
            const { id } = req.params;
            const deleted = await NlpManagementService.deleteKeyword(id);
            res.json({ success: true, data: deleted });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // =========== CATEGORIES ===========

    async getCategories(req, res) {
        try {
            const categories = await NlpManagementService.getCategories();
            res.json({ success: true, data: categories });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async addCategory(req, res) {
        try {
            const category = await NlpManagementService.addCategory(req.body);
            res.status(201).json({ success: true, data: category });
        } catch (error) {
            const status = error.message.includes('already exists') ? 409 : 500;
            res.status(status).json({ success: false, error: error.message });
        }
    }

    async deleteCategory(req, res) {
        try {
            const { category } = req.params;
            const deleted = await NlpManagementService.deleteCategory(category);
            res.json({ success: true, data: deleted });
        } catch (error) {
            const status = error.message.includes('Cannot delete') ? 400 : 500;
            res.status(status).json({ success: false, error: error.message });
        }
    }

    // =========== ANCHORS ===========

    async getAnchors(req, res) {
        try {
            const filters = {
                category: req.query.category
            };
            const anchors = await NlpManagementService.getAnchors(filters);
            res.json({ success: true, data: anchors });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async addAnchor(req, res) {
        try {
            const anchor = await NlpManagementService.addAnchor(req.body);
            res.status(201).json({ success: true, data: anchor });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async deleteAnchor(req, res) {
        try {
            const { id } = req.params;
            const deleted = await NlpManagementService.deleteAnchor(id);
            res.json({ success: true, data: deleted });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // =========== METAPHORS ===========

    async getMetaphors(req, res) {
        try {
            const filters = {
                search: req.query.search
            };
            const metaphors = await NlpManagementService.getMetaphors(filters);
            res.json({ success: true, data: metaphors });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async addMetaphor(req, res) {
        try {
            const metaphor = await NlpManagementService.addMetaphor(req.body);
            res.status(201).json({ success: true, data: metaphor });
        } catch (error) {
            const status = error.message.includes('already exists') ? 409 : 500;
            res.status(status).json({ success: false, error: error.message });
        }
    }

    async deleteMetaphor(req, res) {
        try {
            const { id } = req.params;
            const deleted = await NlpManagementService.deleteMetaphor(id);
            res.json({ success: true, data: deleted });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // =========== STATS ===========

    async getManagementStats(req, res) {
        try {
            const stats = await NlpManagementService.getManagementStats();
            res.json({ success: true, data: stats });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getCompleteDictionary(req, res) {
        try {
            const dictionary = await NlpManagementService.getCompleteDictionary();
            res.json(dictionary);
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    // =========== DICTIONARY RULES ===========

    async getDictionaryRules(req, res) {
        try {
            const filters = {
                rule_type: req.query.rule_type,
                search: req.query.search
            };
            const rules = await NlpManagementService.getDictionaryRules(filters);
            res.json({ success: true, data: rules });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async addDictionaryRule(req, res) {
        try {
            const rule = await NlpManagementService.addDictionaryRule(req.body, req.user.role, req.user.id);
            res.status(201).json({ success: true, data: rule });
        } catch (error) {
            const status = error.message.includes('already exists') ? 409 : 500;
            res.status(status).json({ success: false, error: error.message });
        }
    }

    async deleteDictionaryRule(req, res) {
        try {
            const { id } = req.params;
            const deleted = await NlpManagementService.deleteDictionaryRule(id, req.user.role);
            res.json({ success: true, data: deleted });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new NlpManagementController();
