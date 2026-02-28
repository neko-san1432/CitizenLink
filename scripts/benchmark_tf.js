const TensorFlowService = require("../src/server/services/TensorFlowService");
const { performance } = require("perf_hooks");

// Suppress console logs during benchmark to keep output clean
const originalLog = console.log;
const originalWarn = console.warn;
// console.log = () => {};
// console.warn = () => {};

async function runBenchmark() {
  originalLog("\n=============================================");
  originalLog("🤖 DRIMS AI BENCHMARK");
  originalLog("=============================================");

  // 1. Measure Initialization
  originalLog("\n[1] Initializing Model...");
  const startInit = performance.now();
  await TensorFlowService.initialize();
  const endInit = performance.now();
  const initTime = endInit - startInit;
  originalLog(`✅ Initialization complete: ${initTime.toFixed(2)}ms`);

  // 2. Inject Mock Data (Benchmark-specific)
  if (!TensorFlowService.anchorMatrix) {
    originalLog("\n[2] Pre-computing Mock Anchors...");
    const mockAnchors = {
      "Infrastructure": ["pothole damage", "broken street light", "bridge collapse"],
      "Sanitation": ["garbage collection", "trash piling up", "dirty smell"],
      "Utilities": ["no water supply", "power outage brownout", "leaking pipe"],
      "Traffic": ["traffic jam congestion", "illegal parking", "accident collision"],
      "Safety": ["theft robbery", "suspicious person", "fire hazard"]
    };
    await TensorFlowService.precomputeAnchors(mockAnchors);
  }

  // 3. Measure Classification Throughput
  originalLog("\n[3] Running Classification Loop (1000 iter)...");

  const testSentences = [
    "There is a huge pothole on Rizal Street causing traffic.",
    "Garbage hasn't been collected for 3 weeks.",
    "My neighbors house is on fire help needed.",
    "Water pipe burst near the school.",
    "Random gibberish that basically means nothing at all."
  ];

  const iterations = 1000;
  const startLoop = performance.now();

  // Run sequentially to measure latency
  for (let i = 0; i < iterations; i++) {
    const text = testSentences[i % testSentences.length];
    await TensorFlowService.classify(text);
  }

  const endLoop = performance.now();
  const totalTime = endLoop - startLoop;
  const avgLatency = totalTime / iterations;
  const throughput = 1000 / avgLatency;

  originalLog("\n---------------------------------------------");
  originalLog("📊 RESULTS");
  originalLog("---------------------------------------------");
  originalLog(`Total Time (1000 req):  ${totalTime.toFixed(2)} ms`);
  originalLog(`Avg Latency:            ${avgLatency.toFixed(2)} ms/req`);
  originalLog(`Throughput:             ${throughput.toFixed(2)} req/sec`);
  originalLog("---------------------------------------------\n");
}

runBenchmark().catch(err => {
  console.error("Benchmark failed:", err);
});
