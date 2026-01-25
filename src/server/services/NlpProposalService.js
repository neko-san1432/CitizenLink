const Database = require("../config/database");

class NlpProposalService {
    constructor() {
        this.supabase = Database.getClient();
    }

    normalizeProposalType(type, data) {
        const normalized = String(type || "").trim();
        const allowed = new Set(["keyword", "metaphor", "anchor", "config"]);

        if (allowed.has(normalized)) {
            return { storedType: normalized, effectiveType: normalized, data: data || {} };
        }

        if (normalized === "dictionary_rule") {
            const safeData = data && typeof data === "object" ? { ...data } : {};
            safeData.__proposal_type = "dictionary_rule";
            return { storedType: "config", effectiveType: "dictionary_rule", data: safeData };
        }

        return { storedType: normalized, effectiveType: normalized, data: data || {} };
    }

    /**
     * Submit a new proposal (LGU Admin)
     */
    async createProposal(userId, userRole, type, data) {
        const normalized = this.normalizeProposalType(type, data);
        const payload = {
            type: normalized.storedType,
            data: normalized.data,
            submitted_by: userId,
            status: "pending_coordinator"
        };

        if (userRole === "complaint-coordinator") {
            payload.status = "pending_super_admin";
            payload.coordinator_approved_by = userId;
        } else if (userRole === "super-admin") {
            await this.applyToProduction(normalized.effectiveType, normalized.data);
            payload.status = "approved";
            payload.super_admin_approved_by = userId;
        }

        const { data: proposal, error } = await this.supabase
            .from("nlp_proposals")
            .insert(payload)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return proposal;
    }

    /**
     * Get proposals with filters
     */
    async getProposals(filters = {}) {
        let query = this.supabase
            .from("nlp_proposals")
            .select("*")
            .order("created_at", { ascending: false });

        if (filters.status) {
            query = query.eq("status", filters.status);
        }
        if (filters.type) {
            if (filters.type === "dictionary_rule") {
                query = query.eq("type", "config").contains("data", { __proposal_type: "dictionary_rule" });
            } else {
                query = query.eq("type", filters.type);
            }
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return data;
    }

    /**
     * Approve by Coordinator (Step 1)
     */
    async approveByCoordinator(proposalId, userId) {
        // 1. Verify current status
        const { data: current } = await this.supabase
            .from("nlp_proposals")
            .select("status")
            .eq("id", proposalId)
            .single();

        if (!current) throw new Error("Proposal not found");
        if (current.status !== "pending_coordinator") {
            throw new Error("Proposal is not waiting for coordinator approval");
        }

        // 2. Update to pending_super_admin
        const { data: updated, error } = await this.supabase
            .from("nlp_proposals")
            .update({
                status: "pending_super_admin",
                coordinator_approved_by: userId,
                updated_at: new Date().toISOString(),
            })
            .eq("id", proposalId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return updated;
    }

    /**
     * Approve by Super Admin (Final Step)
     * This applies the changes to the live NLP tables.
     */
    async approveBySuperAdmin(proposalId, userId, dataOverride) {
        const { data: proposal } = await this.supabase
            .from("nlp_proposals")
            .select("*")
            .eq("id", proposalId)
            .single();

        if (!proposal) throw new Error("Proposal not found");
        if (proposal.status !== "pending_super_admin") {
            throw new Error("Proposal is not waiting for super admin approval");
        }

        const mergedData = {
            ...(proposal.data || {}),
            ...(dataOverride && typeof dataOverride === "object" ? dataOverride : {}),
        };

        const normalized = this.normalizeProposalType(proposal.type, mergedData);

        // 1. Apply changes to Production Tables
        await this.applyToProduction(normalized.effectiveType, normalized.data);

        // 2. Mark proposal as approved
        const { data: updated, error } = await this.supabase
            .from("nlp_proposals")
            .update({
                status: "approved",
                data: normalized.data,
                super_admin_approved_by: userId,
                updated_at: new Date().toISOString(),
            })
            .eq("id", proposalId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return updated;
    }

    /**
     * Helper: Insert data into the actual NLP tables
     */
    async applyToProduction(type, payload) {
        let table = "";
        switch (type) {
            case "keyword":
                table = "nlp_keywords";
                break;
            case "metaphor":
                table = "nlp_metaphors";
                break;
            case "anchor":
                table = "nlp_anchors";
                break;
            case "config":
                table = "nlp_category_config";
                break;
            case "dictionary_rule":
                table = "nlp_dictionary_rules";
                if (
                    payload?.rule_type === "severity_amplifier" ||
                    payload?.rule_type === "severity_diminisher"
                ) {
                    const m = payload?.multiplier;
                    if (m === null || m === undefined || m === "" || Number.isNaN(Number(m))) {
                        throw new Error("Multiplier is required for modifier rules");
                    }
                }
                if (payload && typeof payload === "object") {
                    delete payload.__proposal_type;
                }
                break;
            default:
                throw new Error("Invalid proposal type");
        }

        const { error } = await this.supabase.from(table).insert(payload);
        if (error) throw new Error(`Failed to apply to production: ${error.message}`);
    }

    /**
     * Reject Proposal
     */
    async rejectProposal(proposalId, userId, reason) {
        const { data: updated, error } = await this.supabase
            .from("nlp_proposals")
            .update({
                status: "rejected",
                rejected_by: userId,
                rejection_reason: reason,
                updated_at: new Date().toISOString(),
            })
            .eq("id", proposalId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return updated;
    }
    /**
     * Get Proposal Statistics
     */
    async getStats() {
        const { data, error } = await this.supabase
            .from("nlp_proposals")
            .select("status");

        if (error) throw new Error(error.message);

        const stats = {
            pending_coordinator: 0,
            pending_super_admin: 0,
            approved: 0,
            rejected: 0,
            max_accuracy: 95.5 // Mock value for now until model evaluation pipeline is connected
        };

        if (data) {
            data.forEach(p => {
                if (stats[p.status] !== undefined) {
                    stats[p.status]++;
                }
            });
        }
        return stats;
    }
}

module.exports = new NlpProposalService();
