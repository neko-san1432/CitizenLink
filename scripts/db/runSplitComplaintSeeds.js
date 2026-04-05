/* eslint-disable no-console */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function parseArgs() {
  const args = process.argv.slice(2);
  const cfg = {
    dir: path.resolve(process.cwd(), "src/db/seeds"),
    prefix: "seedBulkComplaints.20k.part",
    ext: ".sql",
    dbUrl: "",
    dryRun: false
  };

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--dir" && args[i + 1]) {
      cfg.dir = path.resolve(process.cwd(), args[i + 1]);
      i += 1;
    } else if (a === "--prefix" && args[i + 1]) {
      cfg.prefix = args[i + 1];
      i += 1;
    } else if (a === "--ext" && args[i + 1]) {
      cfg.ext = args[i + 1];
      i += 1;
    } else if (a === "--db-url" && args[i + 1]) {
      cfg.dbUrl = args[i + 1];
      i += 1;
    } else if (a === "--dry-run") {
      cfg.dryRun = true;
    }
  }

  return cfg;
}

function resolveDbUrl(explicitDbUrl) {
  if (explicitDbUrl) return explicitDbUrl;

  const candidates = [
    process.env.SUPABASE_DB_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.SUPABASE_POSTGRES_URL
  ].filter(Boolean);

  return candidates.length > 0 ? candidates[0] : "";
}

function listSqlParts(dir, prefix, ext) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Directory not found: ${dir}`);
  }

  const files = fs.readdirSync(dir)
    .filter(name => name.startsWith(prefix) && name.endsWith(ext))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(name => path.join(dir, name));

  if (files.length === 0) {
    throw new Error(`No SQL part files found in ${dir} with prefix ${prefix} and ext ${ext}`);
  }

  return files;
}

function runPsql(dbUrl, sqlFile) {
  const result = spawnSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlFile], {
    stdio: "inherit",
    shell: true
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`psql failed for file: ${sqlFile}`);
  }
}

function main() {
  const cfg = parseArgs();
  const dbUrl = resolveDbUrl(cfg.dbUrl);
  const files = listSqlParts(cfg.dir, cfg.prefix, cfg.ext);

  console.log(`[SEED-RUNNER] SQL parts found: ${files.length}`);
  files.forEach((f, idx) => console.log(`[SEED-RUNNER] ${idx + 1}/${files.length}: ${f}`));

  if (cfg.dryRun) {
    console.log("[SEED-RUNNER] Dry run mode. No SQL executed.");
    return;
  }

  if (!dbUrl) {
    throw new Error("No DB URL found. Set SUPABASE_DB_URL or DATABASE_URL in .env, or pass --db-url.");
  }

  files.forEach((f, idx) => {
    console.log(`[SEED-RUNNER] Running ${idx + 1}/${files.length}: ${f}`);
    runPsql(dbUrl, f);
  });

  console.log("[SEED-RUNNER] Completed successfully.");
}

try {
  main();
} catch (err) {
  console.error("[SEED-RUNNER] Failed:", err.message);
  process.exit(1);
}
