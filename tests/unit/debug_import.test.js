const modules = [
  '../../src/server/repositories/CoordinatorRepository',
  '../../src/server/services/DuplicationDetectionService',
  '../../src/server/services/SimilarityCalculatorService',
  '../../src/server/services/RuleBasedSuggestionService',
  '../../src/server/utils/barangayClassifier',
  '../../src/server/services/CoordinatorService'
];

async function run() {
  for (const mod of modules) {
    try {
      console.log(`Loading ${mod}...`);
      require(mod);
      console.log(`✅ Loaded ${mod}`);
    } catch (e) {
      console.error(`❌ Failed to load ${mod}:`, e);
    }
  }
}

run();
