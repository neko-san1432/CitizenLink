/**
 * CitizenLink Statistical Analysis Excel Export Module
 * =====================================================
 * Generates comprehensive Excel reports with all statistical breakdowns
 * using the same data source as statistical_analysis.py
 * 
 * @version 1.2.0
 * @requires SheetJS (xlsx.full.min.js)
 */

// ==================== MAIN EXPORT FUNCTION ====================

/**
 * Export comprehensive statistical analysis to Excel
 * Called when clicking "Download Full Report" button
 */
async function exportStatisticalExcel() {
    const btn = document.querySelector('.stats-modal-footer .secondary');
    const originalContent = btn ? btn.innerHTML : '';
    
    try {
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Excel...';
            btn.disabled = true;
        }
        
        // Get stored results from the analysis
        if (!window.lastStatsResults) {
            throw new Error('No statistical analysis results available. Please run analysis first.');
        }
        
        const statsResults = window.lastStatsResults.results || {};
        
        // Get raw dashboard data directly from simulation engine
        const rawData = getDashboardDataForExcel();
        
        console.log('[STATS-EXCEL] Creating workbook...');
        console.log('[STATS-EXCEL] Complaints:', rawData.complaints.length);
        console.log('[STATS-EXCEL] Clusters:', rawData.clusters.length);
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Sheet 1: Executive Summary
        console.log('[STATS-EXCEL] Creating Summary sheet...');
        const summarySheet = createStatsSummarySheet(statsResults, rawData);
        XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');
        
        // Sheet 2: All Complaints Data (MOST IMPORTANT)
        console.log('[STATS-EXCEL] Creating All Complaints sheet...');
        const complaintsSheet = createComplaintsDataSheet(rawData);
        XLSX.utils.book_append_sheet(wb, complaintsSheet, 'All Complaints');
        
        // Sheet 3: NLP Mismatches
        console.log('[STATS-EXCEL] Creating NLP Mismatches sheet...');
        const mismatchSheet = createMismatchSheet(rawData);
        XLSX.utils.book_append_sheet(wb, mismatchSheet, 'NLP Mismatches');
        
        // Sheet 4: Confusion Matrix (calculated locally)
        console.log('[STATS-EXCEL] Creating Confusion Matrix sheet...');
        const confusionSheet = createConfusionMatrixSheet(rawData);
        XLSX.utils.book_append_sheet(wb, confusionSheet, 'Confusion Matrix');
        
        // Sheet 5: Per-Category Performance
        console.log('[STATS-EXCEL] Creating Category Performance sheet...');
        const categorySheet = createCategoryPerformanceSheet(rawData);
        XLSX.utils.book_append_sheet(wb, categorySheet, 'Category Performance');
        
        // Sheet 6: Cluster Analysis
        console.log('[STATS-EXCEL] Creating Cluster Analysis sheet...');
        const clusterSheet = createClusterAnalysisSheet(rawData);
        XLSX.utils.book_append_sheet(wb, clusterSheet, 'Cluster Analysis');
        
        // Sheet 7: Statistical Tests
        console.log('[STATS-EXCEL] Creating Statistical Tests sheet...');
        const testsSheet = createStatisticalTestsSheet(statsResults);
        XLSX.utils.book_append_sheet(wb, testsSheet, 'Statistical Tests');
        
        // Sheet 8: Category Distribution
        console.log('[STATS-EXCEL] Creating Category Distribution sheet...');
        const distSheet = createCategoryDistributionSheet(rawData);
        XLSX.utils.book_append_sheet(wb, distSheet, 'Category Distribution');
        
        // Generate filename with timestamp
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `CitizenLink_Statistical_Report_${timestamp}.xlsx`;
        
        // Download
        console.log('[STATS-EXCEL] Downloading:', filename);
        XLSX.writeFile(wb, filename);
        
        console.log('[STATS-EXCEL] Export complete!');
        
    } catch (error) {
        console.error('[STATS-EXCEL] Export failed:', error);
        alert('Failed to export Excel: ' + error.message);
    } finally {
        if (btn) {
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    }
}

// ==================== DATA COLLECTION ====================

/**
 * Get dashboard data directly from simulation engine and global state
 */
function getDashboardDataForExcel() {
    let complaints = [];
    let clusters = [];
    let noisePoints = [];
    
    // Get complaints from simulation engine
    if (typeof simulationEngine !== 'undefined' && simulationEngine.complaints) {
        complaints = simulationEngine.complaints;
    } else if (typeof window.simulationEngine !== 'undefined' && window.simulationEngine.complaints) {
        complaints = window.simulationEngine.complaints;
    }
    
    // Get clusters from global state
    if (typeof currentClusters !== 'undefined') {
        clusters = currentClusters || [];
    } else if (typeof window.currentClusters !== 'undefined') {
        clusters = window.currentClusters || [];
    }
    
    // Get noise points
    if (typeof currentNoisePoints !== 'undefined') {
        noisePoints = currentNoisePoints || [];
    } else if (typeof window.currentNoisePoints !== 'undefined') {
        noisePoints = window.currentNoisePoints || [];
    }
    
    console.log('[STATS-EXCEL] Raw data collected:', {
        complaints: complaints.length,
        clusters: clusters.length,
        noisePoints: noisePoints.length
    });
    
    return {
        complaints: complaints,
        clusters: clusters,
        noisePoints: noisePoints
    };
}

// ==================== SHEET CREATION FUNCTIONS ====================

/**
 * Sheet 1: Executive Summary
 */
function createStatsSummarySheet(stats, rawData) {
    const data = [
        ['CITIZENLINK STATISTICAL ANALYSIS REPORT'],
        ['Generated: ' + new Date().toISOString()],
        [''],
        ['DATA OVERVIEW'],
        ['Total Complaints', rawData.complaints.length],
        ['Total Clusters', rawData.clusters.length],
        ['Noise Points', rawData.noisePoints.length],
        [''],
        ['═══════════════════════════════════════════════════════════════'],
        ['STATISTICAL METRICS'],
        ['═══════════════════════════════════════════════════════════════'],
        [''],
        ['METRIC', 'VALUE', 'INTERPRETATION'],
        [''],
        ['CLUSTERING QUALITY'],
        ['Silhouette Coefficient', formatNum(stats.silhouette?.mean, 2), getSilhouetteInterpretation(stats.silhouette?.mean)],
        [''],
        ['CLASSIFICATION PERFORMANCE'],
        ['Accuracy', formatPct(stats.classification?.accuracy), getAccuracyInterpretation(stats.classification?.accuracy)],
        ['Precision', formatPct(stats.classification?.precision), 'How often predictions are correct'],
        ['Recall', formatPct(stats.classification?.recall), 'How many emergencies caught (critical!)'],
        ['F1-Score', formatPct(stats.classification?.f1_score), 'Balanced accuracy metric'],
        [''],
        ['SCENARIO TESTING'],
        ['Pass Rate', formatPct(stats.scenario_metrics?.pass_rate), getPassRateInterpretation(stats.scenario_metrics?.pass_rate)],
        [''],
        ['STATISTICAL SIGNIFICANCE'],
        ['t-test (t-value)', formatNum(stats.ttest?.t_statistic, 2), getTTestInterpretation(stats.ttest?.p_value)],
        ['t-test (p-value)', formatNum(stats.ttest?.p_value, 4), 'p < 0.05 = significant'],
        ["Cohen's d", formatNum(stats.ttest?.cohens_d, 2), getEffectSizeInterpretation(stats.ttest?.cohens_d)],
        ['Chi-Square', formatNum(stats.chi_square?.chi_square, 2), getChiSquareInterpretation(stats.chi_square?.p_value)],
        ["Cramer's V", formatNum(stats.chi_square?.cramers_v, 2), getCramersVInterpretation(stats.chi_square?.cramers_v)]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 50 }];
    return ws;
}

/**
 * Sheet 2: All Complaints Data
 */
function createComplaintsDataSheet(rawData) {
    const complaints = rawData.complaints || [];
    
    const data = [
        ['ALL COMPLAINTS DATA - Complete Dataset'],
        ['Total Records: ' + complaints.length],
        [''],
        ['#', 'ID', 'User Category', 'NLP Category', 'Match?', 'Urgency', 'Triage', 'Barangay', 'Latitude', 'Longitude', 'Timestamp', 'Description']
    ];
    
    complaints.forEach((c, idx) => {
        const userCat = c.category || 'Unknown';
        const nlpCat = c.nlp_result?.category || c.analyzed_category || userCat;
        const urgency = c.urgency_score || c.nlp_result?.urgencyScore || 0;
        const triage = getTierLabel(urgency);
        const isMatch = userCat === nlpCat ? 'Yes' : 'No';
        const desc = (c.description || c.text || '').substring(0, 150);
        
        data.push([
            idx + 1,
            c.id || 'COMP-' + (idx + 1),
            userCat,
            nlpCat,
            isMatch,
            urgency,
            triage,
            c.barangay || 'Unknown',
            c.latitude || c.lat || 0,
            c.longitude || c.lng || 0,
            c.timestamp || '',
            desc
        ]);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
        { wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 8 },
        { wch: 8 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
        { wch: 20 }, { wch: 80 }
    ];
    return ws;
}

/**
 * Sheet 3: NLP Mismatches
 */
function createMismatchSheet(rawData) {
    const complaints = rawData.complaints || [];
    
    const data = [
        ['NLP CLASSIFICATION MISMATCHES'],
        ['Cases where NLP-detected category differs from user-reported category'],
        [''],
        ['#', 'ID', 'User Category', 'NLP Category', 'Urgency', 'Description']
    ];
    
    let mismatchCount = 0;
    
    complaints.forEach((c, idx) => {
        const userCat = c.category || 'Unknown';
        const nlpCat = c.nlp_result?.category || c.analyzed_category || userCat;
        
        if (userCat !== nlpCat) {
            mismatchCount++;
            const urgency = c.urgency_score || c.nlp_result?.urgencyScore || 0;
            const desc = (c.description || c.text || '').substring(0, 120);
            
            data.push([
                mismatchCount,
                c.id || 'COMP-' + (idx + 1),
                userCat,
                nlpCat,
                urgency,
                desc
            ]);
        }
    });
    
    // Summary
    data.push(['']);
    data.push(['SUMMARY']);
    data.push(['Total Complaints', complaints.length]);
    data.push(['Mismatches', mismatchCount]);
    data.push(['Match Rate', ((complaints.length - mismatchCount) / complaints.length * 100).toFixed(1) + '%']);
    data.push(['']);
    data.push(['NOTE: Mismatches can indicate:']);
    data.push(['- User miscategorized their complaint']);
    data.push(['- NLP detected more accurate category from description']);
    data.push(['- Ambiguous or multi-category complaint']);
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 70 }];
    return ws;
}

/**
 * Sheet 4: Confusion Matrix (calculated locally)
 */
function createConfusionMatrixSheet(rawData) {
    const complaints = rawData.complaints || [];
    
    // Build confusion matrix locally
    const categories = new Set();
    const pairs = [];
    
    complaints.forEach(c => {
        const actual = c.category || 'Unknown';
        const predicted = c.nlp_result?.category || c.analyzed_category || actual;
        categories.add(actual);
        categories.add(predicted);
        pairs.push({ actual: actual, predicted: predicted });
    });
    
    const catList = Array.from(categories).sort();
    const matrix = {};
    catList.forEach(a => {
        matrix[a] = {};
        catList.forEach(p => { matrix[a][p] = 0; });
    });
    
    pairs.forEach(pair => {
        matrix[pair.actual][pair.predicted]++;
    });
    
    // Build sheet data
    const data = [
        ['CONFUSION MATRIX'],
        ['Actual (rows) vs Predicted (columns)'],
        [''],
        ['Actual \\ Predicted'].concat(catList).concat(['TOTAL', 'RECALL'])
    ];
    
    catList.forEach(actual => {
        const row = catList.map(pred => matrix[actual][pred]);
        const total = row.reduce((s, v) => s + v, 0);
        const tp = matrix[actual][actual];
        const recall = total > 0 ? (tp / total * 100).toFixed(1) + '%' : '-';
        data.push([actual].concat(row).concat([total, recall]));
    });
    
    // Add totals and precision row
    const colTotals = catList.map(pred => 
        catList.reduce((sum, actual) => sum + matrix[actual][pred], 0)
    );
    const grandTotal = colTotals.reduce((s, v) => s + v, 0);
    data.push(['TOTAL'].concat(colTotals).concat([grandTotal, '']));
    
    const precisions = catList.map((pred, i) => {
        const tp = matrix[pred][pred];
        return colTotals[i] > 0 ? (tp / colTotals[i] * 100).toFixed(1) + '%' : '-';
    });
    data.push(['PRECISION'].concat(precisions).concat(['', '']));
    
    // Overall accuracy
    const correct = catList.reduce((sum, cat) => sum + matrix[cat][cat], 0);
    data.push(['']);
    data.push(['Overall Accuracy', (correct / complaints.length * 100).toFixed(1) + '%']);
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    const colWidths = [{ wch: 20 }];
    catList.forEach(() => colWidths.push({ wch: 10 }));
    colWidths.push({ wch: 8 }, { wch: 10 });
    ws['!cols'] = colWidths;
    return ws;
}

/**
 * Sheet 5: Per-Category Performance
 */
function createCategoryPerformanceSheet(rawData) {
    const complaints = rawData.complaints || [];
    
    // Calculate per-category metrics
    const categories = new Set();
    complaints.forEach(c => {
        categories.add(c.category || 'Unknown');
        const nlpCat = c.nlp_result?.category || c.analyzed_category;
        if (nlpCat) categories.add(nlpCat);
    });
    
    const catList = Array.from(categories).sort();
    const metrics = {};
    
    catList.forEach(cat => {
        var tp = 0, fp = 0, fn = 0, tn = 0;
        
        complaints.forEach(c => {
            const actual = c.category || 'Unknown';
            const predicted = c.nlp_result?.category || c.analyzed_category || actual;
            
            if (actual === cat && predicted === cat) tp++;
            else if (actual !== cat && predicted === cat) fp++;
            else if (actual === cat && predicted !== cat) fn++;
            else tn++;
        });
        
        const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
        const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
        const f1 = (precision + recall) > 0 ? 2 * precision * recall / (precision + recall) : 0;
        
        metrics[cat] = { tp: tp, fp: fp, fn: fn, tn: tn, precision: precision, recall: recall, f1: f1 };
    });
    
    // Build sheet
    const data = [
        ['PER-CATEGORY PERFORMANCE'],
        ['Classification metrics for each category'],
        [''],
        ['Category', 'TP', 'FP', 'FN', 'TN', 'Precision', 'Recall', 'F1-Score', 'Grade']
    ];
    
    catList.forEach(cat => {
        const m = metrics[cat];
        var grade = 'Poor';
        if (m.f1 >= 0.95) grade = 'Excellent';
        else if (m.f1 >= 0.85) grade = 'Good';
        else if (m.f1 >= 0.70) grade = 'Fair';
        
        data.push([
            cat,
            m.tp,
            m.fp,
            m.fn,
            m.tn,
            (m.precision * 100).toFixed(1) + '%',
            (m.recall * 100).toFixed(1) + '%',
            (m.f1 * 100).toFixed(1) + '%',
            grade
        ]);
    });
    
    // Legend
    data.push(['']);
    data.push(['LEGEND']);
    data.push(['TP = True Positive (correctly identified)']);
    data.push(['FP = False Positive (false alarm)']);
    data.push(['FN = False Negative (missed)']);
    data.push(['TN = True Negative (correctly rejected)']);
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
        { wch: 20 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }
    ];
    return ws;
}

/**
 * Sheet 6: Cluster Analysis
 */
function createClusterAnalysisSheet(rawData) {
    const clusters = rawData.clusters || [];
    
    const data = [
        ['CLUSTER ANALYSIS'],
        ['DBSCAN++ clustering results'],
        [''],
        ['Cluster #', 'Complaints', 'Dominant Category', 'Avg Lat', 'Avg Lng', 'Max Urgency', 'Triage']
    ];
    
    clusters.forEach((cluster, idx) => {
        const points = Array.isArray(cluster) ? cluster : (cluster.complaints || cluster.points || []);
        
        if (points.length === 0) {
            data.push([idx + 1, 0, 'Empty', '-', '-', 0, '-']);
            return;
        }
        
        // Get dominant category
        const catCounts = {};
        points.forEach(p => {
            const cat = p.category || 'Unknown';
            catCounts[cat] = (catCounts[cat] || 0) + 1;
        });
        const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
        const dominant = sortedCats.length > 0 ? sortedCats[0][0] : 'Unknown';
        
        // Calculate center
        const avgLat = points.reduce((s, p) => s + (p.lat || p.latitude || 0), 0) / points.length;
        const avgLng = points.reduce((s, p) => s + (p.lng || p.longitude || 0), 0) / points.length;
        
        // Max urgency
        const urgencies = points.map(p => p.urgency_score || (p.nlp_result ? p.nlp_result.urgencyScore : 0) || 0);
        const maxUrg = Math.max.apply(null, urgencies.concat([0]));
        
        data.push([
            idx + 1,
            points.length,
            dominant,
            avgLat.toFixed(6),
            avgLng.toFixed(6),
            maxUrg,
            getTierLabel(maxUrg)
        ]);
    });
    
    // Summary
    var totalInClusters = 0;
    clusters.forEach(c => {
        const pts = Array.isArray(c) ? c : (c.complaints || c.points || []);
        totalInClusters += pts.length;
    });
    
    data.push(['']);
    data.push(['SUMMARY']);
    data.push(['Total Clusters', clusters.length]);
    data.push(['Clustered Complaints', totalInClusters]);
    data.push(['Noise Points', rawData.noisePoints ? rawData.noisePoints.length : 0]);
    const totalComplaints = rawData.complaints ? rawData.complaints.length : 1;
    data.push(['Clustering Rate', (totalInClusters / totalComplaints * 100).toFixed(1) + '%']);
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [
        { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 15 }
    ];
    return ws;
}

/**
 * Sheet 7: Statistical Tests
 */
function createStatisticalTestsSheet(stats) {
    var tStat = formatNum(stats.ttest ? stats.ttest.t_statistic : null, 4);
    var pVal = formatNum(stats.ttest ? stats.ttest.p_value : null, 6);
    var cohenD = formatNum(stats.ttest ? stats.ttest.cohens_d : null, 4);
    var chiSq = formatNum(stats.chi_square ? stats.chi_square.chi_square : null, 4);
    var chiP = formatNum(stats.chi_square ? stats.chi_square.p_value : null, 6);
    var cramerV = formatNum(stats.chi_square ? stats.chi_square.cramers_v : null, 4);
    
    var tDecision = (stats.ttest && stats.ttest.p_value < 0.05) ? 'SIGNIFICANT (p < 0.05) - Reject null hypothesis' : 'Not significant';
    var chiDecision = (stats.chi_square && stats.chi_square.p_value < 0.05) ? 'SIGNIFICANT - Categories are correlated' : 'Not significant';
    
    const data = [
        ['STATISTICAL TESTS - DETAILED'],
        [''],
        ['═══════════════════════════════════════════════════════════════'],
        ['1. SILHOUETTE COEFFICIENT (Clustering Quality)'],
        ['═══════════════════════════════════════════════════════════════'],
        ['What it measures:', 'How well-separated clusters are (-1 to +1)'],
        [''],
        ['Mean Score', formatNum(stats.silhouette ? stats.silhouette.mean : null, 4)],
        ['Min Score', formatNum(stats.silhouette ? stats.silhouette.min : null, 4)],
        ['Max Score', formatNum(stats.silhouette ? stats.silhouette.max : null, 4)],
        [''],
        ['Interpretation Scale:'],
        ['> 0.7', 'Excellent clustering'],
        ['0.5 - 0.7', 'Good clustering'],
        ['0.25 - 0.5', 'Fair clustering'],
        ['< 0.25', 'Poor clustering'],
        [''],
        ['═══════════════════════════════════════════════════════════════'],
        ['2. PAIRED T-TEST (Adaptive vs Fixed Parameters)'],
        ['═══════════════════════════════════════════════════════════════'],
        ['Purpose:', 'Test if adaptive epsilon outperforms fixed epsilon'],
        [''],
        ['t-statistic', tStat],
        ['p-value', pVal],
        ["Cohen's d", cohenD],
        [''],
        ['Decision:', tDecision],
        [''],
        ['═══════════════════════════════════════════════════════════════'],
        ['3. CHI-SQUARE TEST (Correlation Validation)'],
        ['═══════════════════════════════════════════════════════════════'],
        ['Purpose:', 'Test if category correlations are significant'],
        [''],
        ['Chi-Square', chiSq],
        ['p-value', chiP],
        ["Cramer's V", cramerV],
        [''],
        ['Decision:', chiDecision]
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 25 }, { wch: 60 }];
    return ws;
}

/**
 * Sheet 8: Category Distribution
 */
function createCategoryDistributionSheet(rawData) {
    const complaints = rawData.complaints || [];
    
    // Count categories
    const userCats = {};
    const nlpCats = {};
    
    complaints.forEach(c => {
        const userCat = c.category || 'Unknown';
        const nlpCat = (c.nlp_result ? c.nlp_result.category : null) || c.analyzed_category || userCat;
        
        userCats[userCat] = (userCats[userCat] || 0) + 1;
        nlpCats[nlpCat] = (nlpCats[nlpCat] || 0) + 1;
    });
    
    const data = [
        ['CATEGORY DISTRIBUTION'],
        ['Comparison of user-reported vs NLP-detected categories'],
        [''],
        ['USER-REPORTED CATEGORIES'],
        ['Category', 'Count', 'Percentage']
    ];
    
    var userEntries = [];
    for (var cat in userCats) {
        userEntries.push([cat, userCats[cat]]);
    }
    userEntries.sort((a, b) => b[1] - a[1]);
    userEntries.forEach(entry => {
        data.push([entry[0], entry[1], (entry[1] / complaints.length * 100).toFixed(1) + '%']);
    });
    
    data.push(['TOTAL', complaints.length, '100%']);
    data.push(['']);
    data.push(['NLP-DETECTED CATEGORIES']);
    data.push(['Category', 'Count', 'Percentage']);
    
    var nlpEntries = [];
    for (var cat2 in nlpCats) {
        nlpEntries.push([cat2, nlpCats[cat2]]);
    }
    nlpEntries.sort((a, b) => b[1] - a[1]);
    nlpEntries.forEach(entry => {
        data.push([entry[0], entry[1], (entry[1] / complaints.length * 100).toFixed(1) + '%']);
    });
    
    data.push(['TOTAL', complaints.length, '100%']);
    
    // Triage distribution
    data.push(['']);
    data.push(['TRIAGE DISTRIBUTION']);
    data.push(['Level', 'Count', 'Percentage']);
    
    var tiers = { 'Tier 1 - CRITICAL': 0, 'Tier 2 - MODERATE': 0, 'Tier 3 - LOW': 0 };
    complaints.forEach(c => {
        const urgency = c.urgency_score || (c.nlp_result ? c.nlp_result.urgencyScore : 0) || 0;
        const tier = getTierLabel(urgency);
        tiers[tier]++;
    });
    
    for (var tier in tiers) {
        data.push([tier, tiers[tier], (tiers[tier] / complaints.length * 100).toFixed(1) + '%']);
    }
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 12 }];
    return ws;
}

// ==================== HELPER FUNCTIONS ====================

function formatNum(value, decimals) {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    return Number(value).toFixed(decimals);
}

function formatPct(value) {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    return (value * 100).toFixed(1) + '%';
}

function getTierLabel(urgency) {
    if (urgency >= 70) return 'Tier 1 - CRITICAL';
    if (urgency >= 40) return 'Tier 2 - MODERATE';
    return 'Tier 3 - LOW';
}

function getSilhouetteInterpretation(value) {
    if (!value && value !== 0) return 'N/A';
    if (value >= 0.7) return 'Excellent cluster separation';
    if (value >= 0.5) return 'Good cluster separation';
    if (value >= 0.25) return 'Fair cluster separation';
    return 'Poor - may indicate noise';
}

function getAccuracyInterpretation(value) {
    if (!value && value !== 0) return 'N/A';
    if (value >= 0.95) return 'Excellent - highly reliable';
    if (value >= 0.90) return 'Good - production ready';
    if (value >= 0.80) return 'Fair - needs tuning';
    return 'Poor - requires improvement';
}

function getPassRateInterpretation(value) {
    if (!value && value !== 0) return 'N/A';
    if (value >= 0.95) return 'Excellent - all scenarios pass';
    if (value >= 0.90) return 'Good - minor issues';
    if (value >= 0.80) return 'Fair - some scenarios fail';
    return 'Poor - significant failures';
}

function getTTestInterpretation(pValue) {
    if (!pValue && pValue !== 0) return 'N/A';
    return pValue < 0.05 ? 'Significant - adaptive outperforms fixed' : 'Not significant';
}

function getEffectSizeInterpretation(d) {
    if (!d && d !== 0) return 'N/A';
    var absD = Math.abs(d);
    if (absD >= 0.8) return 'Large effect';
    if (absD >= 0.5) return 'Medium effect';
    if (absD >= 0.2) return 'Small effect';
    return 'Negligible effect';
}

function getChiSquareInterpretation(pValue) {
    if (!pValue && pValue !== 0) return 'N/A';
    return pValue < 0.05 ? 'Significant - categories correlated' : 'Not significant';
}

function getCramersVInterpretation(v) {
    if (!v && v !== 0) return 'N/A';
    if (v >= 0.3) return 'Strong association';
    if (v >= 0.1) return 'Moderate association';
    return 'Weak association';
}

// ==================== INTEGRATION ====================

/**
 * Override the downloadFullReport function to use Excel export
 */
function initializeStatisticalExcelExport() {
    // Override downloadFullReport with Excel export
    window.downloadFullReport = function() {
        exportStatisticalExcel();
    };
    
    console.log('[STATS-EXCEL] Statistical Excel Export initialized');
}

// Auto-initialize when script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeStatisticalExcelExport);
} else {
    initializeStatisticalExcelExport();
}

// Export for external use
if (typeof window !== 'undefined') {
    window.exportStatisticalExcel = exportStatisticalExcel;
}
