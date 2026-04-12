const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

class DeliverablesLogger {
  constructor() {
    this.baseDir = path.resolve(__dirname, '../../../../deliverable_files_v2');
    this.jsonDir = path.join(this.baseDir, 'json');
    this.excelFile = path.join(this.baseDir, 'excel', 'deliverable_logs_v2.xlsx');
  }

  async _appendToJson(filename, data) {
    try {
      const filePath = path.join(this.jsonDir, filename);
      let logs = [];
      if (fs.existsSync(filePath)) {
        logs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
      logs.push(data);
      fs.writeFileSync(filePath, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error(`Failed to append to JSON file ${filename}:`, error);
    }
  }

  async _appendToExcel(sheetName, data) {
    try {
      const workbook = new ExcelJS.Workbook();
      if (fs.existsSync(this.excelFile)) {
        await workbook.xlsx.readFile(this.excelFile);
      }
      
      let worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) {
        worksheet = workbook.addWorksheet(sheetName);
        const headers = Object.keys(data);
        worksheet.columns = headers.map(h => ({ header: h, key: h, width: 25 }));
        worksheet.getRow(1).font = { bold: true };
      }

      worksheet.addRow(data);
      await workbook.xlsx.writeFile(this.excelFile);
    } catch (error) {
      console.error(`Failed to append to Excel sheet ${sheetName}:`, error);
    await this._appendToJson('semantic_ai_logs.json', data);
    await this._appendToExcel('Semantic AI', data);
  }

  async logSemanticAI(data) {
    await this._appendToJson('semantic_ai_logs.json', data);
    await this._appendToExcel('Semantic_AI_Logs', data);
  }

  async logSpatialClustering(data) {
    await this._appendToJson('spatial_clustering_logs.json', data);
    await this._appendToExcel('Spatial_Clustering', data);
  }

  async logPerformance(data) {
    await this._appendToJson('edge_ai_performance_logs.json', data);
    await this._appendToExcel('Edge_AI_Performance', data);
  }
}

module.exports = new DeliverablesLogger();
