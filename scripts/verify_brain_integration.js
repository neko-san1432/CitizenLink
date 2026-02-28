const BrainService = require("../src/server/services/BrainService");

async function testBrain() {
  console.log("Testing BrainService Integration...");

  // Mock Data
  const incidents = [
    { id: "1", category: "Fire", latitude: 10.00, longitude: 125.00, timestamp: Date.now() },
    { id: "2", category: "Fire", latitude: 10.0001, longitude: 125.0001, timestamp: Date.now() }, // Near 1
    { id: "3", category: "Smoke", latitude: 10.0002, longitude: 125.0002, timestamp: Date.now() }, // Cause: Fire -> Smoke
    { id: "4", category: "Flooding", latitude: 10.05, longitude: 125.05, timestamp: Date.now() } // Far away
  ];

  try {
    // 1. Test NLP
    const text = "may sunog sa palengke";
    const nlpResult = await BrainService.analyzeReport(text, "Others");
    console.log("NLP Result:", nlpResult);

    // 2. Test Intelligence Cycle (Clustering + Causality)
    const cycleResult = BrainService.runIntelligenceCycle(incidents);
    console.log("Cycle Result Stats:", cycleResult.stats);

    if (cycleResult.clusters.length > 0) {
      console.log("Clusters:", cycleResult.clusters.length);
      console.log("First Cluster Category:", cycleResult.clusters[0].category);
    }

    if (cycleResult.causalLinks.length > 0) {
      console.log("Causal Links:", cycleResult.causalLinks.length);
      console.log("Link:", `${cycleResult.causalLinks[0].cause.category} -> ${cycleResult.causalLinks[0].effect.category}`);
    }

  } catch (e) {
    console.error("Test Failed:", e);
  }
}

testBrain();
