const fs = require("fs");
const report = JSON.parse(fs.readFileSync("eslint-report.json", "utf8"));

console.log("--- ERROR REPORT ---");
report.forEach((file) => {
  const errors = file.messages.filter((m) => m.severity === 2);
  if (errors.length > 0) {
    console.log(`\nFILE: ${file.filePath}`);
    errors.forEach((err) => {
      console.log(`  Line ${err.line}: [${err.ruleId}] ${err.message}`);
    });
  }
});
