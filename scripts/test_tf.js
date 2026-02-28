try {
  console.log("Loading TensorFlowService...");
  const tfService = require("../src/server/services/TensorFlowService");
  console.log("Loaded successfully.");
} catch (e) {
  console.error("Failed to load:", e);
}
