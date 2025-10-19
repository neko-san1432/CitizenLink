const DepartmentRepository = require('../repositories/DepartmentRepository');
const ComplaintRepository = require('../repositories/ComplaintRepository');

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
      .join(' ')
      .toLowerCase();

    // Base rules: type → default dept list
    const typeRules = {
      'infrastructure': ['engineering', 'public-works'],
      'public-safety': ['police', 'fire', 'emergency'],
      'environmental': ['environment', 'health'],
      'health': ['health', 'environment'],
      'traffic': ['traffic', 'engineering'],
      'utilities': ['utilities', 'engineering'],
      'noise': ['police', 'environment'],
      'services': ['general', 'public-works']
    };

    const keywordRules = [
      { re: /(pothole|road|bridge|sidewalk|asphalt|concrete)/, depts: ['engineering', 'public-works'], reason: 'infrastructure keywords' },
      { re: /(water outage|electric|utility|pipe|power)/, depts: ['utilities', 'engineering'], reason: 'utilities keywords' },
      { re: /(garbage|trash|waste|sewage|pollution|smell)/, depts: ['environment', 'health'], reason: 'environment/health keywords' },
      { re: /(noise|loud music|karaoke)/, depts: ['police', 'environment'], reason: 'noise keywords' },
      { re: /(accident|theft|crime|assault|robbery)/, depts: ['police', 'emergency'], reason: 'public-safety keywords' },
      { re: /(fire|smoke|burning)/, depts: ['fire', 'emergency'], reason: 'fire keywords' },
      { re: /(traffic|congestion|gridlock)/, depts: ['traffic', 'engineering'], reason: 'traffic keywords' },
      { re: /(clinic|hospital|fever|sick|disease)/, depts: ['health'], reason: 'health keywords' },
    ];

    // Seed scores from type
    const scores = new Map(); // dept -> { score, reasons: [] }
    const seed = typeRules[complaint.type] || [];
    for (const d of seed) scores.set(d, { score: 2.0, reasons: ['type match'] });

    // Apply keyword rules
    for (const rule of keywordRules) {
      if (rule.re.test(text)) {
        for (const d of rule.depts) {
          if (!scores.has(d)) scores.set(d, { score: 0, reasons: [] });
          const entry = scores.get(d);
          entry.score += 1.0;
          entry.reasons.push(rule.reason);
        }
      }
    }

    // Light location hinting (barangay/barangay hall → general or police)
    if (/barangay/i.test(text)) {
      for (const d of ['general', 'police']) {
        if (!scores.has(d)) scores.set(d, { score: 0, reasons: [] });
        const entry = scores.get(d);
        entry.score += 0.5;
        entry.reasons.push('location hint');
      }
    }

    // Convert to sorted list
    const deptSuggestions = Array.from(scores.entries())
      .map(([code, v]) => ({ code, score: Number(v.score.toFixed(2)), reason: v.reasons.join('; ') }))
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
      disclaimer: 'Suggestions are rule-based and require human confirmation.'
    };
  }
}

module.exports = RuleBasedSuggestionService;
