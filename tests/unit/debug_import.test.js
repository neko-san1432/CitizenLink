async function run() {
  const modules = [
    "../../src/server/repositories/CoordinatorRepository",
    "../../src/server/services/DuplicationDetectionService",
    "../../src/server/services/SimilarityCalculatorService",
    "../../src/server/services/RuleBasedSuggestionService",
    "../../src/server/utils/barangayClassifier",
    "../../src/server/services/CoordinatorService",
  ];

  modules.forEach((mod) => {
    try {
      console.log(`Loading ${mod}...`);
      // eslint-disable-next-line
      require(mod);
      console.log(`✅ Loaded ${mod}`);
    } catch (e) {
      console.error(`❌ Failed to load ${mod}:`, e);
    }
  });
}

run();
