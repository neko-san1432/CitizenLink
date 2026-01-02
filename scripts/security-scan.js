/* eslint-disable security/detect-non-literal-fs-filename */
/* eslint-disable security/detect-child-process */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

console.log(
  "\x1b[36m%s\x1b[0m",
  "🛡️  Starting Comprehensive Security Scan & Fix..."
);

// Helper to run commands
const runCommand = (command, description) => {
  try {
    console.log(`\n\x1b[33m${description}...\x1b[0m`);
    execSync(command, { stdio: "inherit" });
    console.log(`\x1b[32m✔ ${description} completed successfully.\x1b[0m`);
    return true;
  } catch (error) {
    if (error.status === 1) {
      // ESLint returns 1 on errors, which is expected if it finds things it can't fix
      console.log(
        `\x1b[33m⚠ ${description} found issues (some may need manual review).\x1b[0m`
      );
    } else {
      console.error(`\x1b[31m✖ ${description} failed unexpectedly.\x1b[0m`);
    }
    return false;
  }
};

// 1. Dependency Security (NPM Audit)
console.log("\n\x1b[1m[1/3] Dependency Security Analysis\x1b[0m");
runCommand("npm audit fix", "Auto-fixing dependency vulnerabilities");

// 2. Static Code Analysis (ESLint + Security Plugins)
console.log("\n\x1b[1m[2/3] Static Code Analysis & Auto-Fix\x1b[0m");
runCommand(
  "npx eslint . --ext .js,.jsx,.ts,.tsx --fix",
  "Running ESLint with security plugins"
);

// 3. Custom Pattern Scanning
console.log("\n\x1b[1m[3/3] Pattern-Based Secret Scanning\x1b[0m");

const patterns = [
  {
    name: "Generic API Key",
    regex: /api_key\s*[:=]\s*['"][a-z0-9]{32,}['"]/i,
  },
  { name: "AWS Access Key", regex: /AKIA[0-9A-Z]{16}/ },
  { name: "Hardcoded Password", regex: /password\s*[:=]\s*['"][^'"]+['"]/i },
];

// Recursive file search
const getAllFiles = (dirPath, arrayOfFiles = []) => {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    if (fs.statSync(`${dirPath}/${file}`).isDirectory()) {
      if (
        !["node_modules", ".git", "dist", "build", "codeql-results"].includes(
          file
        )
      ) {
        getAllFiles(`${dirPath}/${file}`, arrayOfFiles);
      }
    } else if (/\.(js|jsx|ts|tsx|json|env)$/.exec(file)) {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });

  return arrayOfFiles;
};

try {
  const files = getAllFiles(process.cwd());
  let issuesFound = 0;

  const secretLog = [];
  files.forEach((file) => {
    try {
      const content = fs.readFileSync(file, "utf8");
      patterns.forEach((pattern) => {
        if (pattern.regex.test(content)) {
          const message = `Potential Secret Found: ${
            pattern.name
          } in ${path.relative(process.cwd(), file)}`;
          console.warn(`\x1b[31m  ${message}\x1b[0m`);
          secretLog.push(message);
          issuesFound++;
        }
      });
    } catch (err) {
      console.error(`Error reading file ${file}:`, err.message);
    }
  });

  if (secretLog.length > 0) {
    fs.writeFileSync("secrets-found.txt", secretLog.join("\n"));
  }

  if (issuesFound === 0) {
    console.log(
      "\x1b[32m✔ No obvious secrets or hardcoded credentials found.\x1b[0m"
    );
  } else {
    console.log(
      `\x1b[33m⚠ Found ${issuesFound} potential secret(s). Please review manually (see secrets-found.txt).\x1b[0m`
    );
  }
} catch (e) {
  console.error("Error during custom scan:", e);
}

console.log(
  "\n\x1b[36mScan completed. Please review any remaining warnings above.\x1b[0m"
);
