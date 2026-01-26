/**
 * NLP Pending Reviews Controller
 * Handles HITL (Human-in-the-Loop) training queue for low-confidence classifications
 */

const AdvancedDecisionEngine = require("../services/AdvancedDecisionEngine");

class NlpPendingReviewsController {
    /**
     * Get count of pending reviews
     */
    async getCount(req, res) {
        try {
            const count = await AdvancedDecisionEngine.getPendingReviewsCount();
            res.json({ success: true, count });
        } catch (error) {
            console.error("[NLP-HITL] Error getting count:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Get all pending reviews
     */
    async getAll(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const reviews = await AdvancedDecisionEngine.getPendingReviews(limit);
            res.json({ 
                success: true, 
                count: reviews.length,
                data: reviews 
            });
        } catch (error) {
            console.error("[NLP-HITL] Error getting reviews:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Resolve a pending review by training a keyword
     */
    async resolve(req, res) {
        try {
            const { id } = req.params;
            const { keyword, category, subcategory } = req.body;
            const userId = req.user?.id;

            if (!keyword || !category) {
                return res.status(400).json({
                    success: false,
                    error: "Keyword and category are required"
                });
            }

            const result = await AdvancedDecisionEngine.resolvePendingReview(
                id,
                keyword,
                category,
                subcategory || null,
                userId
            );

            if (result.success) {
                res.json({ 
                    success: true, 
                    message: `Trained "${keyword}" as ${category}${subcategory ? '/' + subcategory : ''}`,
                    autoResolved: result.autoResolved || 0
                });
            } else {
                res.status(400).json({ success: false, error: result.error });
            }
        } catch (error) {
            console.error("[NLP-HITL] Error resolving review:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Dismiss a pending review without training
     */
    async dismiss(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            const result = await AdvancedDecisionEngine.dismissPendingReview(id, userId);

            if (result.success) {
                res.json({ success: true, message: "Review dismissed" });
            } else {
                res.status(400).json({ success: false, error: result.error });
            }
        } catch (error) {
            console.error("[NLP-HITL] Error dismissing review:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Batch queue multiple items for review (used by analytics scan)
     */
    async batchQueue(req, res) {
        try {
            console.log('[NLP-HITL] batchQueue endpoint called');
            console.log('[NLP-HITL] Full req.body:', JSON.stringify(req.body).substring(0, 500));
            
            let { items } = req.body;

            console.log(`[NLP-HITL] items type: ${typeof items}, isArray: ${Array.isArray(items)}, length: ${items?.length || 0}`);
            
            // Handle case where items is a string (double-stringified JSON)
            if (typeof items === 'string') {
                try {
                    items = JSON.parse(items);
                    console.log(`[NLP-HITL] Parsed string items, now isArray: ${Array.isArray(items)}, length: ${items?.length || 0}`);
                } catch (parseErr) {
                    console.error('[NLP-HITL] Failed to parse items string:', parseErr.message);
                }
            }

            if (!Array.isArray(items) || items.length === 0) {
                console.log('[NLP-HITL] Empty or invalid items array');
                return res.json({ success: true, queued: 0, skipped: 0 });
            }
            
            console.log('[NLP-HITL] First item sample:', JSON.stringify(items[0], null, 2));

            const result = await AdvancedDecisionEngine.batchQueueForReview(items);
            console.log(`[NLP-HITL] batchQueueForReview result:`, result);
            res.json({ 
                success: true, 
                queued: result.queued,
                skipped: result.skipped,
                errors: result.errors
            });
        } catch (error) {
            console.error("[NLP-HITL] Error batch queueing:", error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new NlpPendingReviewsController();
