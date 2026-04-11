const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

async function fixExcel() {
  const v2Base = path.join(__dirname, '..', 'deliverable_files_v2');
  const jsonFolder = path.join(v2Base, 'json');
  
  if (!fs.existsSync(jsonFolder)) {
    console.error('Cannot find JSON files');
    return;
  }

  // Read the JSON data
  const semanticData = JSON.parse(fs.readFileSync(path.join(jsonFolder, 'semantic_ai_logs.json'), 'utf8'));
  const spatialData = JSON.parse(fs.readFileSync(path.join(jsonFolder, 'spatial_clustering_logs.json'), 'utf8'));
  const performanceData = JSON.parse(fs.readFileSync(path.join(jsonFolder, 'edge_ai_performance_logs.json'), 'utf8'));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Log Generator';
  workbook.created = new Date();

  // Helper to add data to sheets properly
  function addDataToSheet(sheetName, dataArray) {
    if (!dataArray || dataArray.length === 0) return;
    const worksheet = workbook.addWorksheet(sheetName);
    
    // Extract headers
    const headers = Object.keys(dataArray[0]);
    worksheet.columns = headers.map(header => ({
      header: header,
      key: header,
      width: 25
    }));

    // Add rows
    dataArray.forEach(row => {
      worksheet.addRow(row);
    });

    // Make header bold
    worksheet.getRow(1).font = { bold: true };
  }

  addDataToSheet('Semantic_AI_Logs', semanticData);
  addDataToSheet('Spatial_Clustering', spatialData);
  addDataToSheet('Edge_AI_Performance', performanceData);

  const excelFolder = path.join(v2Base, 'excel');
  if (!fs.existsSync(excelFolder)) fs.mkdirSync(excelFolder);

  // Write a guaranteed-valid Excel file
  const excelPath = path.join(excelFolder, 'deliverable_logs_fixed.xlsx');
  await workbook.xlsx.writeFile(excelPath);
  console.log(`Excel file successfully recreated at: ${excelPath}`);
}

fixExcel().catch(console.error);
