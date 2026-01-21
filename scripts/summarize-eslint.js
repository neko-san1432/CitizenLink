const fs = require("fs");
const report = JSON.parse(fs.readFileSync("eslint-report.json", "utf8"));

const ruleCounts = {};
const fileCounts = {};
let totalErrors = 0;
let totalWarnings = 0;

report.forEach((file) => {
  if (file.errorCount > 0 || file.warningCount > 0) {
    fileCounts[file.filePath] = file.errorCount + file.warningCount;
    totalErrors += file.errorCount;
    totalWarnings += file.warningCount;

    file.messages.forEach((msg) => {
      const ruleId = msg.ruleId || "syntax-error";
      if (!ruleCounts[ruleId]) {
        ruleCounts[ruleId] = { error: 0, warning: 0 };
      }
      if (msg.severity === 2) ruleCounts[ruleId].error++;
      else ruleCounts[ruleId].warning++;
    });
  }
});

console.log(`Total Errors: ${totalErrors}`);
console.log(`Total Warnings: ${totalWarnings}`);
console.log("\nTop 15 Rules:");
Object.entries(ruleCounts)
  .sort((a, b) => b[1].error + b[1].warning - (a[1].error + a[1].warning))
  .slice(0, 15)
  .forEach(([rule, counts]) => {
    console.log(`${rule}: ${counts.error} errors, ${counts.warning} warnings`);
  });

console.log("\nTop 5 Files:");
Object.entries(fileCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .forEach(([path, count]) => {
    console.log(`${path}: ${count} issues`);
  });
