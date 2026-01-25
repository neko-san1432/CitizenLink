const NlpProposalService = require("../services/NlpProposalService");

class NlpProposalController {
    async createProposal(req, res) {
        try {
            const { type, data } = req.body;
            const userId = req.user.id;
            const userRole = req.user.role;

            if (!type || !data) {
                return res.status(400).json({ error: "Type and data are required" });
            }

            const proposal = await NlpProposalService.createProposal(userId, userRole, type, data);
            res.status(201).json({ success: true, data: proposal });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async getProposals(req, res) {
        try {
            const filters = {
                status: req.query.status,
                type: req.query.type
            };
            const proposals = await NlpProposalService.getProposals(filters);
            res.json({ success: true, data: proposals });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async approveByCoordinator(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const proposal = await NlpProposalService.approveByCoordinator(id, userId);
            res.json({ success: true, data: proposal });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async approveBySuperAdmin(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const { data_override } = req.body || {};
            const proposal = await NlpProposalService.approveBySuperAdmin(id, userId, data_override);
            res.json({ success: true, data: proposal });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }

    async rejectProposal(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const userId = req.user.id;
            const proposal = await NlpProposalService.rejectProposal(id, userId, reason);
            res.json({ success: true, data: proposal });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async getStats(req, res) {
        try {
            const stats = await NlpProposalService.getStats();
            res.json({ success: true, data: stats });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = new NlpProposalController();
