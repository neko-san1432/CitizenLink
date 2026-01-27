require("dotenv").config();
// Initialize console logger early to capture all logs
require("./src/server/utils/consoleLogger");
console.log("🚀 Starting DRIMS Server...");
// Set development mode if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
  console.log("📝 NODE_ENV set to development");
}
console.log("🔧 Loading configuration...");
const config = require("./config/app");

console.log("✅ Configuration loaded");
// Validate configuration
console.log("🔍 Validating configuration...");
try {
  config.validate();
  console.log("✅ Configuration validated successfully");
  console.log("📊 Config details:", {
    env: config.env,
    port: config.port,
    supabaseConfigured: Boolean(config.supabase.url && config.supabase.anonKey)
  });
} catch (error) {
  console.error("❌ Configuration error:", error.message);
  console.error("🔧 Required environment variables:", [
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY"
  ]);
  process.exit(1);
}
console.log("🏗️  Initializing DRIMS application...");
const DRIMSApp = require("./src/server/app");

const app = new DRIMSApp();
console.log("🔄 Starting server on port", config.port);
app.start(config.port).then(() => {
  // Start the automated reporting scheduler
  const SchedulerService = require('./src/server/services/SchedulerService');
  SchedulerService.start();

  // [OPTIMIZATION] Pre-load AI Engine to prevent delay on first complaint submission
  const AdvancedDecisionEngine = require('./src/server/services/AdvancedDecisionEngine');
  AdvancedDecisionEngine.initialize().catch(err => {
    console.error("⚠️ AI Engine failed to preload (will retry on demand):", err.message);
  });
}).catch(error => {
  console.error("💥 Failed to start server:", error);
  process.exit(1);
});
