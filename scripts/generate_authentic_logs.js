require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
let ExcelJS;
try {
  // Optional: Excel export. JSON generation should still work without it.
  // eslint-disable-next-line global-require
  ExcelJS = require('exceljs');
} catch (e) {
  console.warn('[deliverables] exceljs not installed; skipping Excel export.');
}
const Database = require('../src/server/config/database');

// Require the actual DRIMS Engine Services
const nlpService = require('../src/server/services/nlp/NLPService');
const advancedDecisionEngine = require('../src/server/services/ml/AdvancedDecisionEngine');
const tensorFlowService = require('../src/server/services/ml/TensorFlowService');
const clusteringService = require('../src/server/services/nlp/ClusteringService');

async function run() {
  const supabase = Database.getServiceClient();

  // PERFORMANCE LINEAGE (Academic): Measure real model boot time.
  // We time the actual async initialize() call once, then reuse/cached for all rows.
  const modelLoadStartMs = performance.now();
  await tensorFlowService.initialize();
  const modelLoadTimeMs = performance.now() - modelLoadStartMs;

  // Initialize the real backend engine used by complaint creation.
  // This loads DB keywords/metaphors/anchors and preps TF fallback as needed.
  await advancedDecisionEngine.initialize();

  // Fetch Categories strictly for reference
  const { data: catData } = await supabase.from('categories').select('id, name');
  const catMap = {};
  if (catData) catData.forEach(c => catMap[c.id] = c.name);

  // Fetch Complaints
  const { data: complaints, error } = await supabase
    .from('complaints')
    .select('*')
    .order('submitted_at', { ascending: false })
    .limit(300);

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  const semanticLogs = [];
  const spatialLogs = [];
  const performanceLogs = [];

  const deviceProfiles = [
    'HP Victus by HP Gaming Laptop 15-fb0xxx | AMD Ryzen 5 5600H (6C/12T) | RAM 8GB | GPU NVIDIA GeForce RTX 3050 Ti Laptop GPU + AMD Radeon(TM) Graphics | Windows 11 Home Single Language (64-bit)'
  ];

  const pointsForClustering = [];

  console.log(`Processing ${complaints.length} complaints through the live engine...`);

  for (let i = 0; i < complaints.length; i++) {
    const c = complaints[i];
    const originalCategory = catMap[c.category_id] || 'Undetermined';
    const text = c.description || c.location_text || '';
    const timestamp = c.submitted_at || c.created_at || new Date().toISOString();
    
    // ================= PERFORMANCE LINEAGE (Real Timings) =================
    // 1) Tokenization timing: wrap the actual tokenizer
    const tokStartMs = performance.now();
    const tokens = nlpService.tokenizeText(text);
    const tokenizationTimeMs = performance.now() - tokStartMs;

    // 2) Inference timing: wrap the actual classification call
    const infStartMs = performance.now();
    const aiResult = await advancedDecisionEngine.classify(text, c.id);
    const inferenceTimeMs = performance.now() - infStartMs;

    const totalPipelineTimeMs = tokenizationTimeMs + inferenceTimeMs;

    let confidenceScore = (Number(aiResult.confidence) * 100).toFixed(2) + '%';
    let confidencePct = Number.parseFloat(confidenceScore);
    const hasMatch = aiResult && aiResult.category !== 'Others';

    // Edge AI Classification & Noise Logic
    const isNoise = tokens.length < 3 && text.length < 20;

    let classificationStr;
    let actionStr;

    if (isNoise) {
      classificationStr = 'Linguistic Noise / Spam';
      // Noise/spam rows must never be forwarded.
      // Force confidence to 0 so System_Action routes to HITL.
      confidenceScore = '0.00%';
      confidencePct = 0;
    } else if (hasMatch) {
      classificationStr = `Valid Hazard (${aiResult.category})`;
    } else {
      classificationStr = 'Unclassified Syntax';
    }

    // IMPORTANT (thesis/deliverables): Mirror backend decision thresholds.
    // - >= 70%: Forwarded
    // - >= 60% and < 70%: Forwarded, but low confidence (still subject to HITL)
    // - < 60%: Flag for manual verification (HITL)
    if (confidencePct >= 70) {
      actionStr = 'Forwarded to Map & Sub-Nodes';
    } else if (confidencePct >= 60) {
      actionStr = 'Forwarded (Low Confidence)';
    } else {
      actionStr = 'Flagged for Manual Verification (HITL)';
    }

    const methodUsed = isNoise ? 'NOISE_FILTER' : aiResult.method;
    const matchedKeywords = isNoise
      ? ''
      : aiResult && aiResult.matched_term
        ? String(aiResult.matched_term)
        : '';

    semanticLogs.push({
      Report_ID: c.id,
      Timestamp: timestamp,
      Raw_Text_Input: text,
      NLP_Tokens: `[${tokens.join(', ')}]`,
      AI_Classification: classificationStr,
      Confidence_Score: confidenceScore,
      Method_Used: methodUsed, // RULE_BASED | AI_TENSORFLOW | FALLBACK | METAPHOR_FILTER | NOISE_FILTER
      System_Action: actionStr,
      Matched_Keywords: matchedKeywords
    });

    // Device memory (real Node/V8 heap usage) captured immediately after classification
    const memUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
    const memoryUsage = memUsageMB.toFixed(2);

    performanceLogs.push({
      Execution_ID: `EXEC-${Date.now()}-${i}`,
      Report_ID: c.id,
      Device_Profile: deviceProfiles[i % deviceProfiles.length],
      // Record model load time once; subsequent rows show cached (0.00)
      Model_Load_Time_ms: i === 0 ? modelLoadTimeMs.toFixed(2) : '0.00',
      Tokenization_Time_ms: tokenizationTimeMs.toFixed(2),
      Inference_Time_ms: inferenceTimeMs.toFixed(2),
      Total_Pipeline_Time_ms: totalPipelineTimeMs.toFixed(2),
      Memory_Usage_MB: memoryUsage,
      Tokens_Processed: tokens.length
    });

    // Formatting for actual Spatial Clustering engine
    if (c.latitude && c.longitude) {
      pointsForClustering.push({
        id: c.id,
        latitude: parseFloat(c.latitude), 
        longitude: parseFloat(c.longitude), 
        category: originalCategory, 
        timestamp: c.submitted_at || c.created_at || new Date(),
        priority: c.priority || 'Medium'
      });
    }
  }

  console.log("Running Live spatial clustering via DBSCAN...");
  // Group identically to thesis (DBSCAN over spatial points)
  const clusterStartMs = performance.now();
  const clusters = clusteringService.clusterIncidents(pointsForClustering);
  const clusterEndMs = performance.now();
  const clusterTimeMs = clusterEndMs - clusterStartMs;
  const avgFormationTimeMs = clusters.length > 0 ? (clusterTimeMs / clusters.length) : 0;
  
  clusters.forEach((cluster, index) => {
      const lat = typeof cluster.latitude === 'number' ? cluster.latitude : Number.parseFloat(cluster.latitude);
      const lon = typeof cluster.longitude === 'number' ? cluster.longitude : Number.parseFloat(cluster.longitude);
      const coreCount = Number.isFinite(cluster.count)
        ? cluster.count
        : Array.isArray(cluster.reports)
          ? cluster.reports.length
          : 0;

      spatialLogs.push({
        Cluster_ID: cluster.id || `CLST-${cluster.category.substring(0, 3).toUpperCase().replace(/\s/g,'-')}-${String(index + 1).padStart(4, '0')}`,
        Category: cluster.category,
        Status: cluster.status || (coreCount > 0 ? 'active' : 'inactive'),
        Core_Point_Count: coreCount,
        Urgency_Score: cluster.urgency_score || 0,
        Center_Latitude: Number.isFinite(lat) ? lat.toFixed(6) : '0.000000',
        Center_Longitude: Number.isFinite(lon) ? lon.toFixed(6) : '0.000000',
        Formation_Time_ms: avgFormationTimeMs.toFixed(2) // avg per-cluster time over this run
      });
  });

  console.log("Writing authenticated logs to Deliverable V2 Folder...");
  const rootDir = __dirname;
  const baseFolder = path.join(rootDir, '..', 'deliverable_files_v2');
  const jsonFolder = path.join(baseFolder, 'json');
  const excelFolder = path.join(baseFolder, 'excel');

  if (!fs.existsSync(baseFolder)) fs.mkdirSync(baseFolder);
  if (!fs.existsSync(jsonFolder)) fs.mkdirSync(jsonFolder);
  if (!fs.existsSync(excelFolder)) fs.mkdirSync(excelFolder);

  // Write JSON
  fs.writeFileSync(path.join(jsonFolder, 'semantic_ai_logs.json'), JSON.stringify(semanticLogs, null, 2));
  fs.writeFileSync(path.join(jsonFolder, 'spatial_clustering_logs.json'), JSON.stringify(spatialLogs, null, 2));
  fs.writeFileSync(path.join(jsonFolder, 'edge_ai_performance_logs.json'), JSON.stringify(performanceLogs, null, 2));

  // Write Excel
  if (ExcelJS) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'DRIMS Live Engine Generater';
    workbook.created = new Date();

    function addDataToSheet(sheetName, dataArray) {
      if (!dataArray || dataArray.length === 0) return;
      const worksheet = workbook.addWorksheet(sheetName);

      const headers = Object.keys(dataArray[0]);
      worksheet.columns = headers.map(header => ({
        header: header,
        key: header,
        width: 25
      }));

      dataArray.forEach(row => {
        worksheet.addRow(row);
      });

      worksheet.getRow(1).font = { bold: true };
    }

    addDataToSheet('Semantic_AI_Logs', semanticLogs);
    addDataToSheet('Spatial_Clustering', spatialLogs);
    addDataToSheet('Edge_AI_Performance', performanceLogs);

    await workbook.xlsx.writeFile(path.join(excelFolder, 'deliverable_logs_v2.xlsx'));
  }
  console.log('Done! 100% Authentic Logs generated.');
}

run().catch(console.error);