try {
  console.log("Loading tensorFlowService...");
  const tfService = require("../src/server/services/TensorFlowService");
  console.log("Loaded successfully.");
} catch (e) {
  console.error("Failed to load:", e);
}
