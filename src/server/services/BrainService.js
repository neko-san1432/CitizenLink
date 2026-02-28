/**
 * BRAIN SERVICE (The Core Intelligence)
 * =====================================
 * Orchestrates the advanced features:
 * 1. NLP Analysis (Text -> Category)
 * 2. Clustering (Incidents -> Clusters)
 * 3. Causality (Cluster A -> Cluster B)
 */

const NLPService = require("./brain/NLPService");
const ClusteringService = require("./brain/ClusteringService");
const CausalityService = require("./brain/CausalityService");
const TensorFlowService = require("./TensorFlowService"); // Direct access if needed

class BrainService {
  constructor() {
    this.services = {
      nlp: NLPService,
      clustering: ClusteringService,
      causality: CausalityService,
      tf: TensorFlowService
    };
  }

  /**
     * Analyze a new incoming report
     * @param {string} text - The complaint description
     * @param {string} userCategory - The category selected by user
     * @returns {Object} Analysis result including suggested category and mismatch warning
     */
  async analyzeReport(text, userCategory) {
    console.log(`[Brain] Analyzing report: "${text.substring(0, 30)}..." [${userCategory}]`);

    // 1. NLP Analysis
    const analysis = await this.services.nlp.analyze(text);

    // 2. Mismatch Check
    const validation = this.services.nlp.validateCategoryMismatch(userCategory, text);

    return {
      analysis,
      validation,
      suggestedCategory: analysis.category,
      confidence: analysis.confidence
    };
  }

  /**
     * Run the full intelligence cycle on a list of incidents
     * @param {Array} incidents - List of active incidents
     * @returns {Object} Clusters and Causal Links
     */
  runIntelligenceCycle(incidents) {
    console.log(`[Brain] Running Intelligence Cycle on ${incidents.length} incidents...`);

    // 1. Clustering (DBSCAN++)
    const clusters = this.services.clustering.clusterIncidents(incidents);
    console.log(`[Brain] Formed ${clusters.length} clusters.`);

    // 2. Causal Analysis (Spatio-Temporal)
    const causalLinks = this.services.causality.findAllCausalLinks(clusters);
    console.log(`[Brain] Detected ${causalLinks.length} causal links.`);

    return {
      timestamp: new Date(),
      stats: {
        incidentCount: incidents.length,
        clusterCount: clusters.length,
        linkCount: causalLinks.length
      },
      clusters,
      causalLinks
    };
  }
}

module.exports = new BrainService();
