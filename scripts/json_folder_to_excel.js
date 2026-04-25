const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

function getArgValue(args, name, alias) {
  const idx = args.findIndex(a => a === name || (alias && a === alias));
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeCell(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map(v => {
        if (v === null || v === undefined) return "";
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
        return JSON.stringify(v);
      })
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function normalizeRecords(records) {
  return records.map(record => {
    if (!isPlainObject(record)) return { value: normalizeCell(record) };
    const out = {};
    for (const [key, value] of Object.entries(record)) {
      out[key] = normalizeCell(value);
    }
    return out;
  });
}

function sanitizeSheetName(name, usedNames) {
  const raw = String(name || "Sheet");
  const cleaned = raw.replace(/[\\/?*\[\]:]/g, "_").slice(0, 31) || "Sheet";

  let finalName = cleaned;
  let counter = 2;
  while (usedNames.has(finalName)) {
    const suffix = `_${counter}`;
    finalName = cleaned.slice(0, Math.max(0, 31 - suffix.length)) + suffix;
    counter++;
  }
  usedNames.add(finalName);
  return finalName;
}

function isPrimitive(value) {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function collectArraysDeep(value, pathParts = [], out = []) {
  if (Array.isArray(value)) {
    out.push({ pathParts, value });
    return out;
  }

  if (!isPlainObject(value)) return out;

  for (const [key, child] of Object.entries(value)) {
    collectArraysDeep(child, [...pathParts, key], out);
  }
  return out;
}

function flattenToKeyValueRows(value, prefixParts = [], rows = []) {
  if (Array.isArray(value)) {
    const key = prefixParts.join(".");
    rows.push({ Key: key || "data", Value: "(see sheet)" });
    return rows;
  }

  if (isPrimitive(value)) {
    const key = prefixParts.join(".");
    rows.push({ Key: key || "data", Value: normalizeCell(value) });
    return rows;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      const key = prefixParts.join(".");
      rows.push({ Key: key || "data", Value: "{}" });
      return rows;
    }

    for (const [key, child] of entries) {
      flattenToKeyValueRows(child, [...prefixParts, key], rows);
    }
    return rows;
  }

  const key = prefixParts.join(".");
  rows.push({ Key: key || "data", Value: normalizeCell(value) });
  return rows;
}

function appendDataAsSheets(workbook, data) {
  const usedNames = new Set();

  if (Array.isArray(data)) {
    const rows = normalizeRecords(data);
    const sheet = xlsx.utils.json_to_sheet(rows);
    xlsx.utils.book_append_sheet(workbook, sheet, sanitizeSheetName("data", usedNames));
    return;
  }

  if (isPlainObject(data)) {
    // 1) Append any arrays found anywhere in the object tree as their own sheets
    const arrays = collectArraysDeep(data);
    for (const arr of arrays) {
      const name = arr.pathParts.length ? arr.pathParts.join(".") : "data";
      const rows = normalizeRecords(arr.value);
      const sheet = xlsx.utils.json_to_sheet(rows);
      xlsx.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(name, usedNames));
    }

    // 1.5) If the top-level object has named sections (common in benchmark summaries),
    // export them as separate tables for readability.
    // Example: { adaptive: {...}, fixed: {...} }
    const sectionKeys = ["adaptive", "fixed", "dataset", "delta", "interpretation"];
    for (const key of sectionKeys) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      const section = data[key];
      if (!isPlainObject(section)) continue;
      const kvRows = flattenToKeyValueRows(section);
      const sheet = xlsx.utils.json_to_sheet(kvRows);
      xlsx.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(key, usedNames));
    }

    // 2) Append a key/value summary sheet for all non-array content
    const kvRows = flattenToKeyValueRows(data);
    const sheet = xlsx.utils.json_to_sheet(kvRows);
    xlsx.utils.book_append_sheet(workbook, sheet, sanitizeSheetName("summary", usedNames));
    return;
  }

  // Primitive top-level JSON
  const sheet = xlsx.utils.json_to_sheet([{ value: normalizeCell(data) }]);
  xlsx.utils.book_append_sheet(workbook, sheet, sanitizeSheetName("data", usedNames));
}

function convertJsonFileToXlsx(jsonPath, outputDir) {
  const raw = fs.readFileSync(jsonPath, "utf8");
  const data = JSON.parse(raw);

  const workbook = xlsx.utils.book_new();
  appendDataAsSheets(workbook, data);

  const baseName = path.basename(jsonPath, path.extname(jsonPath));
  const outPath = path.join(outputDir, `${baseName}.xlsx`);

  xlsx.writeFile(workbook, outPath);
  return outPath;
}

function main() {
  const args = process.argv.slice(2);
  const inputDirArg = getArgValue(args, "--input", "-i");
  const outputDirArg = getArgValue(args, "--output", "-o");

  const inputDir = inputDirArg
    ? path.resolve(process.cwd(), inputDirArg)
    : path.join(__dirname, "..", "deliverable_files_v2", "json");

  const outputDir = outputDirArg
    ? path.resolve(process.cwd(), outputDirArg)
    : path.join(__dirname, "..", "deliverable_files_v2", "excel");

  if (!fs.existsSync(inputDir)) {
    console.error(`Input folder not found: ${inputDir}`);
    process.exitCode = 1;
    return;
  }

  ensureDir(outputDir);

  const jsonFiles = fs
    .readdirSync(inputDir)
    .filter(f => f.toLowerCase().endsWith(".json"))
    .map(f => path.join(inputDir, f));

  if (jsonFiles.length === 0) {
    console.log(`No .json files found in: ${inputDir}`);
    return;
  }

  let errorCount = 0;
  for (const jsonPath of jsonFiles) {
    try {
      const outPath = convertJsonFileToXlsx(jsonPath, outputDir);
      console.log(`✓ ${path.basename(jsonPath)} -> ${outPath}`);
    } catch (err) {
      errorCount++;
      console.error(`✗ Failed converting ${jsonPath}`);
      console.error(err && err.stack ? err.stack : err);
    }
  }

  if (errorCount > 0) process.exitCode = 1;
}

main();
