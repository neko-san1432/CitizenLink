/**
 * BRAIN SERVICE (The Core Intelligence)
 * =====================================
 * Orchestrates the advanced features:
 * 1. NLP Analysis (Text -> Category)
 * 2. Clustering (Incidents -> Clusters)
 */

const NLPService = require("./brain/NLPService");
const ClusteringService = require("./brain/ClusteringService");
const TensorFlowService = require("./TensorFlowService"); // Direct access if needed

class BrainService {
  constructor() {
    this.services = {
      nlp: NLPService,
      clustering: ClusteringService,
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
     * @returns {Object} Clusters
     */
  runIntelligenceCycle(incidents) {
    console.log(`[Brain] Running Intelligence Cycle on ${incidents.length} incidents...`);

    // 1. Clustering (DBSCAN++)
    const clusters = this.services.clustering.clusterIncidents(incidents);
    console.log(`[Brain] Formed ${clusters.length} clusters.`);

    return {
      timestamp: new Date(),
      stats: {
        incidentCount: incidents.length,
        clusterCount: clusters.length
      },
      clusters
    };
  }
}

module.exports = new BrainService();
