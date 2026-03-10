require("dotenv").config();
const advancedDecisionEngine = require("../src/server/services/advancedDecisionEngine");

async function testNLP() {
  console.log("🚀 Starting NLP System Verification...");

  // 1. Initialize Engine
  await advancedDecisionEngine.initialize();

  const testCases = [
    { text: "May malaking lubak sa kalsada", expected: "Infrastructure", type: "Rule-Based (Tagalog)" },
    { text: "My phone died yesterday", expected: "Others", type: "Metaphor Filter (False Positive)" },
    { text: "The river is overflowing rapidly", expected: "Environment", type: "AI/Keyword (English)" },
    { text: "Sobrang baho ng basura dito", expected: "Sanitation", type: "Rule-Based (Tagalog)" },
    { text: "Ground is shaking violently", expected: "Environment", type: "AI Fallback (Earthquake)" }
  ];

  console.log("\n🧪 Running Test Cases:");
  console.log("---------------------------------------------------");

  for (const test of testCases) {
    console.log(`\nInput: "${test.text}"`);
    const start = Date.now();
    const result = await advancedDecisionEngine.classify(test.text);
    const duration = Date.now() - start;

    const isMatch = result.category === test.expected || (test.expected === "Others" && result.category === "Others");
    const icon = isMatch ? "✅" : "⚠️";

    console.log(`${icon} Result: ${result.category} / ${result.method}`);
    console.log(`   Confidence: ${result.confidence}`);
    console.log(`   Time: ${duration}ms`);
    if (!isMatch) {
      console.log(`   EXPECTED: ${test.expected} (${test.type})`);
    }
  }

  console.log("\n---------------------------------------------------");
  console.log("✅ Verification Complete");
  process.exit(0);
}

testNLP().catch(err => {
  console.error("❌ Test Failed:", err);
  process.exit(1);
});
