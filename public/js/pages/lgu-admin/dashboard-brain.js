/**
 * CitizenLink Brain Analytics - Dashboard Integration
 * Bridges the NLP prediction engine with the LGU Admin Dashboard
 */

import { showToast } from "../../components/toast.js";

// Global state for brain analytics
const BrainState = {
    rawComplaints: [],
    processedComplaints: [],
    taxonomy: null,
    isLoaded: false
};

const API_URL = "/api/brain/complaints?status=new,pending,inprogress,unassigned"; // Only active complaints for dashboard

/**
 * Initialize Brain Analytics widget
 */
export async function initBrainAnalytics() {
    const container = document.getElementById("brain-analytics-section");
    if (!container) return; // Feature not enabled in HTML

    console.log("[BRAIN] Initializing dashboard intelligence...");
    renderLoadingState();

    try {
        // 1. Load Taxonomy (needed for category normalization)
        if (typeof CitizenLinkTaxonomy !== "undefined") {
            BrainState.taxonomy = await CitizenLinkTaxonomy.loadTaxonomy();
        }

        // 2. Fetch Data
        await fetchComplaints();

        // 3. Process Data (using simulation-engine if available)
        processData();

        // 4. Render UI
        renderBrainWidgets();

        BrainState.isLoaded = true;
        console.log("[BRAIN] Intelligence widgets loaded.");
    } catch (error) {
        console.error("[BRAIN] Failed to init:", error);
        renderErrorState();
    }
}

/**
 * Fetch latest complaints for analysis
 */
async function fetchComplaints() {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error("Failed to fetch brain data");

    const result = await response.json();
    BrainState.rawComplaints = result.complaints || [];
}

/**
 * Process raw data using NLP engine
 */
function processData() {
    const { rawComplaints, taxonomy } = BrainState;

    BrainState.processedComplaints = rawComplaints.map(c => {
        // Basic normalization
        const description = c.description || c.descriptive_su || c.title || "";
        let category = c.category || "Others";
        let subcategory = c.subcategory || null;

        // Use Taxonomy for normalization if available
        if (taxonomy && typeof CitizenLinkTaxonomy !== "undefined") {
            const norm = CitizenLinkTaxonomy.normalizeCategoryPair(category, subcategory, taxonomy);
            category = norm.category;
            subcategory = norm.subcategory;
        }

        // Run NLP Analysis if engine is loaded
        let intelligence = { confidence: 0.5 };
        let tier = c.priority === 'Urgent' ? 1 : c.priority === 'High' ? 2 : 3;
        let score = 0;

        if (typeof window.analyzeComplaintIntelligence === "function") {
            try {
                const point = { ...c, description, category, subcategory };
                const res = window.analyzeComplaintIntelligence(point);
                intelligence = res || {};
                score = res?.urgencyScore || 0;
                tier = score >= 70 ? 1 : score >= 40 ? 2 : 3;
            } catch (e) {
                console.warn("[BRAIN] NLP Error:", e);
            }
        }

        // Detect Keywords
        const keywords = extractKeywords(description);

        return {
            ...c,
            description,
            category,
            subcategory,
            tier,
            score,
            keywords,
            intelligence
        };
    });
}

/**
 * Calculate Aggregate Stats
 */
function calculateStats() {
    const data = BrainState.processedComplaints;
    const stats = {
        total: data.length,
        emergency: 0,
        keywordsFound: 0,
        uniqueKeywords: new Set(),
        totalConfidence: 0,
        confidenceCount: 0,
        byCategory: {},
        highPriorityParams: []
    };

    data.forEach(c => {
        // Emergency / Critical
        if (c.tier === 1 || c.intelligence?.isCritical) {
            stats.emergency++;
            stats.highPriorityParams.push(c);
        }

        // Keywords
        if (c.keywords && c.keywords.length) {
            stats.keywordsFound += c.keywords.length;
            c.keywords.forEach(k => stats.uniqueKeywords.add(k));
        }

        // Confidence
        if (c.intelligence?.confidence) {
            stats.totalConfidence += c.intelligence.confidence;
            stats.confidenceCount++;
        }

        // Category
        const cat = c.category || "Unclassified";
        stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
    });

    return {
        ...stats,
        avgConfidence: stats.confidenceCount ? Math.round((stats.totalConfidence / stats.confidenceCount) * 100) : 0,
        uniqueKeywordsCount: stats.uniqueKeywords.size
    };
}

/**
 * Render the Dashboard Widgets (Dark Mode / Coordinator Style)
 */
function renderBrainWidgets() {
    const stats = calculateStats();

    // 1. Metric Cards
    updateMetric("brain-emergencies", stats.emergency);
    updateMetric("brain-keywords", stats.keywordsFound);
    updateMetric("brain-confidence", stats.avgConfidence + "%");
    updateMetric("brain-unique", stats.uniqueKeywordsCount);

    // 2. High Priority Ticker
    renderAlertTicker(stats.highPriorityParams);

    // 3. Category Pie Chart
    renderCategoryMiniChart(stats.byCategory);

    // 4. System Health
    renderSystemHealth(stats);
}

function updateMetric(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value.toLocaleString();
        // Styling is handled in HTML structure now
    }
}

function renderAlertTicker(alerts) {
    const container = document.getElementById("brain-alerts-list");
    if (!container) return;

    const validAlerts = alerts.slice(0, 5); // Show top 5

    if (validAlerts.length === 0) {
        container.innerHTML = `
      <div class="flex flex-col items-center justify-center h-48 text-gray-500">
        <svg class="w-12 h-12 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <p class="text-sm">No critical alerts detected</p>
      </div>
    `;
        return;
    }

    container.innerHTML = validAlerts.map(alert => `
    <div class="p-3 bg-[#1e293b] rounded-lg border border-gray-700/50 mb-2 last:mb-0 hover:bg-[#253045] transition-colors cursor-pointer group">
      <div class="flex justify-between items-start mb-1">
        <span class="text-[10px] font-bold text-red-400 uppercase tracking-wide bg-red-900/20 px-2 py-0.5 rounded border border-red-900/30">${alert.subcategory || alert.category}</span>
        <span class="text-[10px] text-gray-500 font-mono">${new Date(alert.timestamp || alert.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <p class="text-sm text-gray-300 font-medium line-clamp-2 leading-snug group-hover:text-white transition-colors">"${alert.description}"</p>
      <div class="mt-2 flex items-center gap-2">
         <span class="text-[10px] text-gray-500"><i class="fas fa-map-marker-alt text-gray-600"></i> ${alert.barangay || 'Unknown Loc'}</span>
      </div>
    </div>
  `).join('');
}

function renderCategoryMiniChart(categoryData) {
    const canvas = document.getElementById("brain-category-chart");
    if (!canvas) return;

    const sorted = Object.entries(categoryData).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const labels = sorted.map(s => s[0]);
    const data = sorted.map(s => s[1]);

    if (window.BrainCategoryChart instanceof Chart) {
        window.BrainCategoryChart.destroy();
    }

    // Dark Mode colors per screenshot aesthetic
    const colors = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#6366F1'];

    window.BrainCategoryChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: '#1f2937', // Match card bg
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 10,
                        font: { size: 10, family: "'Inter', sans-serif" },
                        color: '#9ca3af' // gray-400
                    }
                }
            },
            cutout: '75%'
        }
    });
}

function renderSystemHealth(stats) {
    const healthEl = document.getElementById("brain-system-status");
    if (!healthEl) return;

    const isHealthy = stats.total > 0;

    healthEl.innerHTML = isHealthy
        ? `<div class="flex items-center gap-2 text-emerald-400 bg-emerald-900/10 px-3 py-1 rounded-full text-xs font-bold border border-emerald-900/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]">
             <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> SYSTEM ONLINE
           </div>`
        : `<div class="flex items-center gap-2 text-amber-400 bg-amber-900/10 px-3 py-1 rounded-full text-xs font-bold border border-amber-900/20">
             <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> INITIALIZING
           </div>`;
}

function renderLoadingState() {
    // Optional: add loading skeletons
}

function renderErrorState() {
    const container = document.getElementById("brain-analytics-section");
    if (container) container.classList.add("opacity-50", "pointer-events-none");
}

/* --- Helpers --- */
function extractKeywords(text) {
    if (!text) return [];
    // Simple keyword extraction (can be improved or just rely on backend if needed)
    return text.toLowerCase().match(/\b\w{4,}\b/g) || [];
}
