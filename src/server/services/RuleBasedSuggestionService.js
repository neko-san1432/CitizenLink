const DepartmentRepository = require("../repositories/DepartmentRepository");
const ComplaintRepository = require("../repositories/ComplaintRepository");
const { getCategoryToDepartmentMapping, getKeywordBasedSuggestions } = require("../utils/departmentMapping");

/**
* RuleBasedSuggestionService
* Lightweight, explainable suggestions (no ML) for routing
*/
class RuleBasedSuggestionService {

  constructor() {
    this.departmentRepo = new DepartmentRepository();
    this.complaintRepo = new ComplaintRepository();
  }
  /**
  * Compute department and coordinator suggestions for a complaint
  * @param {object} complaint - complaint record (title, descriptive_su, type, location_text)
  * @returns {object} suggestions
  */
  async computeSuggestions(complaint) {
    const text = [complaint.title, complaint.descriptive_su, complaint.location_text]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    // Get dynamic department mappings
    const typeRules = await getCategoryToDepartmentMapping();
    const keywordRules = await getKeywordBasedSuggestions();
    // Seed scores from type
    const scores = new Map(); // dept -> { score, reasons: [] }
    const seed = typeRules[complaint.category] || [];
    for (const d of seed) scores.set(d, { score: 2.0, reasons: ["type match"] });
    // Apply keyword rules
    for (const rule of keywordRules) {
      // Check if rule has pattern property and it's a valid RegExp
      if (rule.pattern && typeof rule.pattern.test === "function" && rule.pattern.test(text)) {
        const departments = rule.departments || rule.depts || [];
        for (const d of departments) {
          if (!scores.has(d)) scores.set(d, { score: 0, reasons: [] });
          const entry = scores.get(d);
          entry.score += 1.0;
          entry.reasons.push(rule.reason || "keyword match");
        }
      }
    }
    // Light location hinting (barangay/barangay hall → general or police)
    if (/barangay/i.test(text)) {
      for (const d of ["general", "police"]) {
        if (!scores.has(d)) scores.set(d, { score: 0, reasons: [] });
        const entry = scores.get(d);
        entry.score += 0.5;
        entry.reasons.push("location hint");
      }
    }
    // Convert to sorted list
    const deptSuggestions = Array.from(scores.entries())
      .map(([code, v]) => ({ code, score: Number(v.score.toFixed(2)), reason: v.reasons.join("; ") }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    // Optional coordinator suggestion: pick active coordinator for top dept (if any)
    let coordinator = null;
    if (deptSuggestions.length > 0) {
      try {
        const top = deptSuggestions[0].code;
        const active = await this.complaintRepo.findActiveCoordinator(top);
        if (active && active.user_id) coordinator = { user_id: active.user_id, department: top };
      } catch {}
    }
    return {
      departments: deptSuggestions,
      coordinator,
      disclaimer: "Suggestions are rule-based and require human confirmation."
    };
  }
}

module.exports = RuleBasedSuggestionService;
