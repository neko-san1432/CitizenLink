const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

async function convertLogToExcel() {
  const rootDir = __dirname;
  // Get original json from workspace root
  const originalJsonPath = path.join(rootDir, "..", "deliverable_logs.json");

  if (!fs.existsSync(originalJsonPath)) {
    console.error(`Cannot find ${originalJsonPath}`);
    return;
  }

  // Create folder structure
  const baseFolder = path.join(rootDir, "..", "deliverable_files");
  const jsonFolder = path.join(baseFolder, "json");
  const excelFolder = path.join(baseFolder, "excel");

  if (!fs.existsSync(baseFolder)) fs.mkdirSync(baseFolder);
  if (!fs.existsSync(jsonFolder)) fs.mkdirSync(jsonFolder);
  if (!fs.existsSync(excelFolder)) fs.mkdirSync(excelFolder);

  // Move the source JSON to the json folder
  const newJsonPath = path.join(jsonFolder, "logs_288.json");
  fs.copyFileSync(originalJsonPath, newJsonPath);
  console.log(`Copied JSON to ${newJsonPath}`);

  // Parse the JSON
  const rawData = fs.readFileSync(newJsonPath, "utf8");
  const jsonData = JSON.parse(rawData);

  // Start creating the Excel workbook
  const workbook = xlsx.utils.book_new();

  // Create Worksheet 1: Semantic AI Logs
  if (jsonData.deliverable_1_semantic_ai_logs) {
    const ws1Data = jsonData.deliverable_1_semantic_ai_logs.map(log => ({
      ...log,
      NLP_Tokens: Array.isArray(log.NLP_Tokens) ? log.NLP_Tokens.join(", ") : log.NLP_Tokens,
      Matched_Keywords: Array.isArray(log.Matched_Keywords) ? log.Matched_Keywords.join(", ") : log.Matched_Keywords
    }));
    const worksheet1 = xlsx.utils.json_to_sheet(ws1Data);
    xlsx.utils.book_append_sheet(workbook, worksheet1, "Semantic_AI_Logs");
  }

  // Create Worksheet 2: Spatial Clustering
  if (jsonData.deliverable_2_spatial_clustering_logs) {
    const worksheet2 = xlsx.utils.json_to_sheet(jsonData.deliverable_2_spatial_clustering_logs);
    xlsx.utils.book_append_sheet(workbook, worksheet2, "Spatial_Clustering");
  }

  // Create Worksheet 3: Edge AI Performance
  if (jsonData.deliverable_3_edge_ai_performance_logs) {
    const worksheet3 = xlsx.utils.json_to_sheet(jsonData.deliverable_3_edge_ai_performance_logs);
    xlsx.utils.book_append_sheet(workbook, worksheet3, "Edge_AI_Performance");
  }

  // Save the Excel file
  const excelPath = path.join(excelFolder, "deliverable_logs.xlsx");
  xlsx.writeFile(workbook, excelPath);

  console.log(`Excel file successfully created at: ${excelPath}`);

  // Optionally remove the original JSON file if the user wanted it entirely moved
  fs.unlinkSync(originalJsonPath);
  console.log(`Removed duplicate JSON from workspace root.`);
}

convertLogToExcel().catch(console.error);
