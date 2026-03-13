const { execSync } = require("child_process");
const fs = require("fs");
try {
  console.log("Running node server.js...");
  const output = execSync("node server.js", { stdio: "pipe" });
  fs.writeFileSync("startup_log.txt", output.toString());
} catch (error) {
  let logStr = "Error starting server:\n";
  if (error.stdout) logStr += `STDOUT:\n${  error.stdout.toString()  }\n`;
  if (error.stderr) logStr += `STDERR:\n${  error.stderr.toString()  }\n`;
  fs.writeFileSync("startup_log.txt", logStr);
}
