const fs = require("fs");
const report = JSON.parse(fs.readFileSync("eslint-report.json", "utf8"));

let output = "--- ERROR REPORT ---\n";
report.forEach((file) => {
  const errors = file.messages.filter((m) => m.severity === 2);
  if (errors.length > 0) {
    output += `\nFILE: ${file.filePath}\n`;
    errors.forEach((err) => {
      output += `  Line ${err.line}: [${err.ruleId}] ${err.message}\n`;
    });
  }
});

fs.writeFileSync("errors-proper.txt", output, "utf8");
