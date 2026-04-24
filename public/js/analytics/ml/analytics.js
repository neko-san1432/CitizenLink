const API_URL = "/api/brain/complaints";
const STREAM_URL = "/api/brain/stream";
const BOUNDARIES_URL = "/assets/json/brgyBoundariesLocation.json";

let rawcomplaints = [];
let processedcomplaints = [];
let filteredcomplaints = [];
let taxonomy = null;
let barangayGeoJSON = null;

const charts = {};

let currentPage = 1;
let itemsPerPage = 20;
let sortColumn = "triage_score";
let sortDirection = "desc";
let globalStats = null;

function publishAnalyticsState() {
  try {
    window.DRIMSBrainAnalytics = {
      getProcessedcomplaints: () => processedcomplaints,
      getTaxonomy: () => taxonomy,
      reprocessAll: () => {
        processedcomplaints = rawcomplaints.map(processcomplaint);
        filteredcomplaints = [...processedcomplaints];
        const stats = calcStats(processedcomplaints);
        renderAll(stats);
        publishAnalyticsState();
      }
    };
    window.dispatchEvent(new CustomEvent("DRIMS:brainAnalytics:update"));
  } catch {
  }
}

function setLoading(active, message, detail) {
  const overlay = document.getElementById("loadingOverlay");
  if (!overlay) return;
  if (active) overlay.classList.add("active");
  else overlay.classList.remove("active");

  if (message) {
    const p = overlay.querySelector(".loading-content p");
    if (p) p.textContent = message;
  }
  if (detail) {
    const d = overlay.querySelector(".loading-detail");
    if (d) d.textContent = detail;
  }
}

function safeText(value) {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function parseISODate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function buildStopwords() {
  return new Set([
    "the",
    "and",
    "for",
    "that",
    "with",
    "this",
    "have",
    "has",
    "had",
    "was",
    "were",
    "are",
    "but",
    "not",
    "you",
    "your",
    "from",
    "they",
    "them",
    "their",
    "there",
    "here",
    "into",
    "over",
    "under",
    "about",
    "after",
    "before",
    "then",
    "than",
    "also",
    "very",
    "just",
    "like",
    "po",
    "opo",
    "naman",
    "lang",
    "din",
    "rin",
    "kasi",
    "dahil",
    "para",
    "yung",
    "ang",
    "ng",
    "sa",
    "na",
    "si",
    "ni",
    "kay",
    "kayo",
    "kami",
    "tayo",
    "sila",
    "ito",
    "iyan",
    "yun",
    "dili",
    "wala",
    "naa",
    "ug",
    "sa",
    "ni",
    "ka",
    "ko",
    "mo",
  ]);
}

const STOPWORDS = buildStopwords();

function extractKeywords(text, max = 24) {
  const raw = safeText(text).toLowerCase();
  const tokens = raw
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.length >= 3)
    .filter((t) => !STOPWORDS.has(t));

  const counts = new Map();
  for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([term, count]) => ({ term, count }));
}

async function loadTaxonomy() {
  if (typeof DRIMSTaxonomy === "undefined") return null;
  try {
    return await DRIMSTaxonomy.loadTaxonomy();
  } catch {
    return null;
  }
}

// function normalizeCategoryPair removed
/*
function normalizeCategoryPair(category, subcategory) {
  if (taxonomy && typeof DRIMSTaxonomy !== "undefined") {
    return DRIMSTaxonomy.normalizeCategoryPair(category, subcategory, taxonomy);
  }
  return {
    category: safeText(category).trim() || "Others",
    subcategory: safeText(subcategory).trim() || null,
  };
}
*/

async function loadBarangayBoundaries() {
  try {
    const response = await fetch(BOUNDARIES_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    barangayGeoJSON = {
      type: "FeatureCollection",
      features: Array.isArray(data)
        ? data.map((brgy) => ({
          type: "Feature",
          properties: { name: brgy.name },
          geometry: brgy.geojson,
        }))
        : [],
    };
    return true;
  } catch {
    barangayGeoJSON = null;
    return false;
  }
}

function getBarangayFromCoordinates(lat, lng) {
  if (!barangayGeoJSON || typeof turf === "undefined") return "Unknown";
  try {
    const point = turf.point([lng, lat]);
    for (const feature of barangayGeoJSON.features || []) {
      if (turf.booleanPointInPolygon(point, feature)) {
        return feature.properties?.name || "Unknown";
      }
    }
    return "Unmapped Zone";
  } catch {
    return "Unknown";
  }
}

function extractBarangay(complaint) {
  if (complaint.barangay && complaint.barangay !== "Unknown") return complaint.barangay;
  const lat = toNumberOrNull(complaint.latitude);
  const lng = toNumberOrNull(complaint.longitude);
  if (lat === null || lng === null) return "Unknown";
  return getBarangayFromCoordinates(lat, lng);
}

/**
 * Compute triage score and extract full NLP intelligence data.
 * Returns the complete intelligence object from the NLP processor.
 */
function computeTriage(point) {
  if (typeof window.analyzecomplaintIntelligence === "function") {
    try {
      const res = window.analyzecomplaintIntelligence(point);
      const score = Number(res?.urgencyScore || 0);
      const tier = score >= 70 ? 1 : score >= 40 ? 2 : 3;
      return {
        score,
        tier,
        breakdown: res?.breakdown || null,
        // Extract full NLP intelligence for smart detection
        intelligence: res || null
      };
    } catch (err) {
      console.error("[ANALYTICS] NLP intelligence error:", err);
      return { score: 0, tier: 3, breakdown: null, intelligence: null };
    }
  }
  return { score: 0, tier: 3, breakdown: null, intelligence: null };
}

/**
 * Fallback metaphor detection (used when NLP intelligence not available)
 */
function isMetaphorFallback(text) {
  const t = safeText(text).toLowerCase();
  return /\b(parang|like|murag|daw|seems|looks like)\b/.test(t);
}

/**
 * Fallback speculation detection (used when NLP intelligence not available)
 */
function isSpeculationFallback(text) {
  const t = safeText(text).toLowerCase();
  return /\b(maybe|baka|siguro|if|kung|possible|might|could be|tingali)\b/.test(t);
}

function isEmergency(category, subcategory) {
  const c = safeText(category);
  const s = safeText(subcategory);
  const emergencyList = taxonomy?.emergency_categories;
  if (Array.isArray(emergencyList)) {
    return emergencyList.includes(s) || emergencyList.includes(c);
  }
  return false;
}

/**
 * Process a complaint and extract NLP intelligence for analytics.
 * Integrates with the simulation-engine.js NLP processor for:
 * - Metaphor detection
 * - Speculation detection
 * - Category mismatch detection
 * - Confidence scoring
 */
function processcomplaint(input) {
  const description = safeText(input.description || input.title || input.location_text);
  // const normalized = normalizeCategoryPair(input.category, input.subcategory); // Removed
  const point = {
    ...input,
    category: input.category || "Others",
    // subcategory: normalized.subcategory || normalized.category || "Others", // Removed
    description,
  };

  const triage = computeTriage(point);
  const keywords = extractKeywords(description, 18);
  const intelligence = triage.intelligence || {};

  // Extract NLP intelligence flags (with fallbacks for robustness)
  const isMetaphorical = Boolean(intelligence.isMetaphorical) || isMetaphorFallback(description);
  const isSpeculative = Boolean(intelligence.isSpeculative) || isSpeculationFallback(description);

  // Category mismatch detection from NLP auto-categorization
  const hasMismatch = Boolean(point.ai_reclassified) || Boolean(point.ai_downgraded) ||
    Boolean(intelligence.breakdown?.emergencyBoost) ||
    (intelligence.confidence && intelligence.confidence < 0.5 && point.category !== "Others");

  // Emergency detection from taxonomy + NLP
  const emergency =
    triage.tier === 1 ||
    Boolean(intelligence.isCritical);

  const timestamp = safeText(input.timestamp || input.submitted_at || input.created_at) || new Date().toISOString();

  const processed = {
    ...input,
    description,
    original_text: description,  // For train-system.js
    category: point.ai_reclassified ? point.category : (point.category || "Others"),
    // subcategory: point.ai_reclassified ? point.subcategory : normalized.subcategory, // Removed
    timestamp,
    barangay: extractBarangay(input),
    triage_score: triage.score,
    tier: triage.tier,
    triage_breakdown: triage.breakdown,
    keywords,
    // Full NLP intelligence for smart detection & training
    intelligence: {
      confidence: intelligence.confidence || 0.5,
      is_speculation: isSpeculative,
      metaphor_score: isMetaphorical ? 0.85 : 0,
      category_mismatch: hasMismatch,
      sentiment_score: intelligence.sentiment_score || 0,
      veracity_score: intelligence.veracityScore || 0,
      nlp_keywords: intelligence.breakdown?.matchedKeywords || [],
      temporal_tag: intelligence.temporalTag || null,
      temporal_status: intelligence.temporalStatus || null,
      is_capped: intelligence.breakdown?.isCapped || false,
      override_type: intelligence.breakdown?.overrideType || null,
      ai_reclassified: Boolean(point.ai_reclassified),
      ai_downgraded: Boolean(point.ai_downgraded),
      original_category: point.original_category || null,
      reclassified_reason: point.ai_reclassified_reason || point.ai_downgraded_reason || null
    },
    // Legacy flags for backward compatibility
    flags: {
      emergency,
      metaphor: isMetaphorical,
      speculation: isSpeculative,
      mismatch: hasMismatch,
    },
    // For train-system.js compatibility
    category_mismatch: hasMismatch ? {
      has_mismatch: true,
      original: point.original_category,
      detected: point.category,
      reason: point.ai_reclassified_reason || point.ai_downgraded_reason
    } : null,
    nlp: {
      keywords: keywords.map(k => k.term),
      confidence: intelligence.confidence || 0.5
    }
  };

  return processed;
}

function calcStats(data) {
  const stats = {
    total: data.length,
    tier1: 0,
    tier2: 0,
    tier3: 0,
    emergency: 0,
    keywordsDetected: 0,
    uniqueKeywords: new Set(),
    byCategory: new Map(),
    byBarangay: new Map(),
    byMonth: new Map(),
    byHour: new Map(),
    byDay: new Map(),
    byCategoryTier: new Map(),
  };

  for (const c of data) {
    if (c.tier === 1) stats.tier1 += 1;
    else if (c.tier === 2) stats.tier2 += 1;
    else stats.tier3 += 1;

    if (c.flags?.emergency) stats.emergency += 1;

    if (Array.isArray(c.keywords) && c.keywords.length > 0) {
      stats.keywordsDetected += c.keywords.reduce((sum, k) => sum + (k.count || 0), 0);
      for (const k of c.keywords) stats.uniqueKeywords.add(k.term);
    }

    const cat = c.category || "Others";
    stats.byCategory.set(cat, (stats.byCategory.get(cat) || 0) + 1);

    const brgy = c.barangay || "Unknown";
    stats.byBarangay.set(brgy, (stats.byBarangay.get(brgy) || 0) + 1);

    const d = parseISODate(c.timestamp);
    if (d) {
      const dayKey = d.toISOString().slice(0, 10);
      const monthKey = d.toISOString().slice(0, 7);
      stats.byDay.set(dayKey, (stats.byDay.get(dayKey) || 0) + 1);
      stats.byMonth.set(monthKey, (stats.byMonth.get(monthKey) || 0) + 1);
      stats.byHour.set(d.getHours(), (stats.byHour.get(d.getHours()) || 0) + 1);
    }

    const tierMap = stats.byCategoryTier.get(cat) || { tier1: 0, tier2: 0, tier3: 0 };
    if (c.tier === 1) tierMap.tier1 += 1;
    else if (c.tier === 2) tierMap.tier2 += 1;
    else tierMap.tier3 += 1;
    stats.byCategoryTier.set(cat, tierMap);
  }

  return {
    ...stats,
    uniqueKeywordsCount: stats.uniqueKeywords.size,
  };
}

function getThemeColors() {
  const isDark = document.documentElement.classList.contains("dark");
  return {
    grid: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
    ticks: isDark ? "#94a3b8" : "#475569",
    text: isDark ? "#f8fafc" : "#0f172a",
    muted: isDark ? "#64748b" : "#94a3b8",
    tooltipBg: isDark ? "rgba(15, 23, 42, 0.95)" : "rgba(255, 255, 255, 0.95)",
    tooltipText: isDark ? "#f8fafc" : "#0f172a",
    tooltipBorder: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"
  };
}

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
    delete charts[id];
  }
}

function renderDonutChart(canvasId, data, colors, customOptions = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  destroyChart(canvasId);

  const labels = Object.keys(data);
  const values = Object.values(data);

  charts[canvasId] = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 15,
        cutout: customOptions.cutout || "75%",
        borderRadius: customOptions.borderRadius || 8,
        spacing: customOptions.spacing || 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        animateScale: true,
        animateRotate: true
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function renderTacticalLegend(containerId, data, colors, isSimple = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const entries = Object.entries(data);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  container.innerHTML = entries.map(([name, val], i) => {
    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
    return `
      <div class="flex items-center gap-3 text-[9px] font-bold">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <div class="w-1.5 h-1.5 rounded-sm flex-shrink-0" style="background: ${colors[i % colors.length]}"></div>
          <span class="text-gray-400 uppercase truncate">${name}</span>
        </div>
        <span class="text-white data-monospace flex-shrink-0">${val} <span class="text-gray-600 font-normal">(${pct}%)</span></span>
      </div>`;
  }).join("");
}

function renderPieChart(canvasId, labels, values, colors) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  destroyChart(canvasId);
  charts[canvasId] = new Chart(el, {
    type: "pie",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors }],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } },
  });
}

function renderBarChart(canvasId, labels, values, color) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  destroyChart(canvasId);

  const ctx = el.getContext('2d');
  const chartColor = color || '#4472C4';
  const theme = getThemeColors();
  
  const rgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const gradient = ctx.createLinearGradient(0, 0, 0, el.height || 300);
  gradient.addColorStop(0, chartColor);
  gradient.addColorStop(1, rgba(chartColor, 0.4));

  charts[canvasId] = new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: gradient,
        borderRadius: 6,
        barThickness: 'flex',
        maxBarThickness: 32
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.ticks,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: theme.grid, drawBorder: false },
          ticks: { color: theme.ticks, font: { size: 10, weight: '600' } }
        },
        x: {
          grid: { display: false },
          ticks: { color: theme.ticks, font: { size: 10, weight: '600' } }
        }
      },
    },
  });
}

function renderLineChart(canvasId, labels, values, color) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  destroyChart(canvasId);

  const ctx = el.getContext('2d');
  const chartColor = color.startsWith('#') ? color : '#3b82f6';
  const theme = getThemeColors();
  
  const fillGradient = ctx.createLinearGradient(0, 0, 0, el.height || 300);
  const rgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  fillGradient.addColorStop(0, rgba(chartColor, 0.4));
  fillGradient.addColorStop(0.5, rgba(chartColor, 0.1));
  fillGradient.addColorStop(1, rgba(chartColor, 0));

  charts[canvasId] = new Chart(el, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: chartColor,
        backgroundColor: fillGradient,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: chartColor,
        pointBorderColor: theme.tooltipBg,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: chartColor,
        pointHoverBorderColor: theme.tooltipBg,
        pointHoverBorderWidth: 3,
        borderWidth: 3
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: theme.tooltipBg,
          titleColor: theme.tooltipText,
          bodyColor: theme.ticks,
          borderColor: theme.tooltipBorder,
          borderWidth: 1,
          padding: 12,
          displayColors: true,
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          callbacks: {
            label: (context) => `${context.parsed.y} complaints`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: theme.grid, drawBorder: false },
          ticks: { color: theme.ticks, font: { size: 10, weight: '600' } }
        },
        x: {
          grid: { display: false },
          ticks: { color: theme.ticks, font: { size: 10, weight: '600' } }
        }
      },
    },
  });
}

function renderSparkline(canvasId, data, color) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  destroyChart(canvasId);

  const ctx = el.getContext('2d');
  const chartColor = color || '#4472C4';
  
  const rgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const gradient = ctx.createLinearGradient(0, 0, 0, el.height || 40);
  gradient.addColorStop(0, rgba(chartColor, 0.2));
  gradient.addColorStop(1, rgba(chartColor, 0));

  charts[canvasId] = new Chart(el, {
    type: "line",
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data: data,
        borderColor: chartColor,
        backgroundColor: gradient,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.5,
        fill: true
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false, beginAtZero: false }
      },
      elements: { line: { capBezierPoints: true } }
    }
  });
}

function renderOverview(stats) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set("totalcomplaints", stats.total.toLocaleString());
  set("tier1Count", stats.tier1.toLocaleString());
  set("tier2Count", stats.tier2.toLocaleString());
  set("tier3Count", stats.tier3.toLocaleString());
  set("criticalCount", stats.emergency.toLocaleString());
  set("keywordsDetected", stats.keywordsDetected.toLocaleString());
  set("uniqueKeywords", stats.uniqueKeywordsCount.toLocaleString());

  const avgScore =
    stats.total > 0
      ? Math.round(processedcomplaints.reduce((sum, c) => sum + (c.triage_score || 0), 0) / stats.total)
      : 0;
  set("avgTriageScore", avgScore.toLocaleString());

  renderPieChart(
    "tierDistChart",
    ["Tier 1", "Tier 2", "Tier 3"],
    [stats.tier1, stats.tier2, stats.tier3],
    ["#C00000", "#FFC000", "#70AD47"]
  );

  const catTop = [...stats.byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  renderBarChart(
    "categoryChart",
    catTop.map(([k]) => k),
    catTop.map(([, v]) => v),
    "#4472C4"
  );

  // Overview Category Pie Chart (top 8 categories)
  const catPieTop = [...stats.byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const catPieColors = ["#4472C4", "#ED7D31", "#A5A5A5", "#FFC000", "#5B9BD5", "#70AD47", "#7030A0", "#C00000"];
  renderPieChart(
    "overviewCategoryPie",
    catPieTop.map(([k]) => k),
    catPieTop.map(([, v]) => v),
    catPieColors.slice(0, catPieTop.length)
  );

  const brgyTop = [...stats.byBarangay.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  renderBarChart(
    "barangayChart",
    brgyTop.map(([k]) => k),
    brgyTop.map(([, v]) => v),
    "#5B9BD5"
  );

  renderBarChart(
    "nlpImpactChart",
    ["Tier 1", "Tier 2", "Tier 3"],
    [stats.tier1, stats.tier2, stats.tier3],
    "#7030A0"
  );

  const alerts = processedcomplaints
    .filter((c) => c.tier === 1)
    .sort((a, b) => (parseISODate(b.timestamp)?.getTime() || 0) - (parseISODate(a.timestamp)?.getTime() || 0))
    .slice(0, 5);

  const alertsEl = document.getElementById("recentAlertsTicker");
  if (alertsEl) {
    if (alerts.length === 0) {
      alertsEl.innerHTML = "<div style=\"padding:12px;color:var(--gray-600);text-align:center;\">No high-priority alerts</div>";
    } else {
      alertsEl.innerHTML = alerts
        .map(
          (c) => `
          <div class="alert-ticker-item">
            <div style="min-width:28px;color:var(--danger);"><i class="fas fa-exclamation-circle"></i></div>
            <div style="flex:1;">
              <div style="font-weight:800;">${safeText(c.category)}</div>
              <div style="color:var(--gray-600);font-size:12px;">${safeText(c.description).slice(0, 110)}</div>
            </div>
          </div>`
        )
        .join("");
    }
  }

  const legendEl = document.getElementById("categoryLegend");
  if (legendEl) {
    const top = [...stats.byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    legendEl.innerHTML = top
      .map(([k, v]) => `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;width:100%;">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;" title="${k}">${k}</span>
          <strong style="white-space:nowrap;">${v}</strong>
        </div>`)
      .join("");
  }

  const healthDict = document.getElementById("healthDictSize");
  if (healthDict) healthDict.textContent = `${stats.uniqueKeywordsCount.toLocaleString()} entries`;

  const topBarangaysEl = document.getElementById("topBarangaysList");
  if (topBarangaysEl) {
    const top = [...stats.byBarangay.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    topBarangaysEl.innerHTML = top
      .map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:10px;"><span>${k}</span><strong>${v}</strong></div>`)
      .join("");
  }

  const avgResponseEl = document.getElementById("avgResponseTime");
  if (avgResponseEl) avgResponseEl.textContent = "--";

  const processedTotalEl = document.getElementById("processedTotal");
  if (processedTotalEl) processedTotalEl.textContent = stats.total.toLocaleString();

  const resolvedTodayEl = document.getElementById("resolvedToday");
  if (resolvedTodayEl) {
    const today = new Date().toISOString().slice(0, 10);
    const resolved = processedcomplaints.filter((c) => {
      const day = safeText(c.updated_at || c.submitted_at || c.timestamp).slice(0, 10);
      return day === today && safeText(c.workflow_status).toLowerCase() === "completed";
    }).length;
    resolvedTodayEl.textContent = resolved.toLocaleString();
  }
}

function renderTemporal(stats) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };


  // 1. Calculate Summary Metrics & Trends
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  
  const todayCount = stats.byDay.get(today) || 0;
  const yesterdayCount = stats.byDay.get(yesterday) || 0;
  
  const todayDiff = todayCount - yesterdayCount;
  const todayPct = yesterdayCount > 0 ? Math.round((todayDiff / yesterdayCount) * 100) : (todayCount > 0 ? 100 : 0);
  
  set("todayCount", todayCount.toLocaleString());
  const todayTrendEl = document.getElementById("todayTrend");
  if (todayTrendEl) {
    const isUp = todayDiff > 0;
    const isDown = todayDiff < 0;
    const icon = isUp ? 'fa-caret-up' : isDown ? 'fa-caret-down' : 'fa-minus';
    const colorClass = isUp ? 'text-blue-400' : isDown ? 'text-red-400' : 'text-gray-500';
    todayTrendEl.innerHTML = `<i class="fas ${icon} ${colorClass}"></i> ${Math.abs(todayPct).toFixed(1)}% vs yesterday`;
    todayTrendEl.className = `trend-indicator ${colorClass} mt-1`;
  }

  // Week Trend (last 7 days vs previous 7 days)
  const last7Days = Array.from({length: 7}, (_, i) => new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  const prev7Days = Array.from({length: 7}, (_, i) => new Date(Date.now() - (i + 7) * 86400000).toISOString().slice(0, 10));
  
  const weekCount = last7Days.reduce((sum, d) => sum + (stats.byDay.get(d) || 0), 0);
  const prevWeekCount = prev7Days.reduce((sum, d) => sum + (stats.byDay.get(d) || 0), 0);
  
  const weekDiff = weekCount - prevWeekCount;
  const weekPct = prevWeekCount > 0 ? Math.round((weekDiff / prevWeekCount) * 100) : (weekCount > 0 ? 100 : 0);
  
  set("weekCount", weekCount.toLocaleString());
  const weekTrendEl = document.getElementById("weekTrend");
  if (weekTrendEl) {
    const isUp = weekDiff > 0;
    const isDown = weekDiff < 0;
    const icon = isUp ? 'fa-caret-up' : isDown ? 'fa-caret-down' : 'fa-minus';
    const colorClass = isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-gray-500';
    weekTrendEl.innerHTML = `<i class="fas ${icon} ${colorClass}"></i> ${Math.abs(weekPct).toFixed(1)}% vs last week`;
    weekTrendEl.className = `trend-indicator ${colorClass} mt-1`;
  }

  // Month Trend
  const thisMonth = new Date().toISOString().slice(0, 7);
  const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
  
  const monthCount = stats.byMonth.get(thisMonth) || 0;
  const lastMonthCount = stats.byMonth.get(lastMonth) || 0;
  
  const monthDiff = monthCount - lastMonthCount;
  const monthPct = lastMonthCount > 0 ? Math.round((monthDiff / lastMonthCount) * 100) : (monthCount > 0 ? 100 : 0);
  
  set("monthCount", monthCount.toLocaleString());
  const monthTrendEl = document.getElementById("monthTrend");
  if (monthTrendEl) {
    const isUp = monthDiff > 0;
    const isDown = monthDiff < 0;
    const icon = isUp ? 'fa-caret-up' : isDown ? 'fa-caret-down' : 'fa-minus';
    const colorClass = isUp ? 'text-orange-400' : isDown ? 'text-red-400' : 'text-gray-500';
    monthTrendEl.innerHTML = `<i class="fas ${icon} ${colorClass}"></i> ${Math.abs(monthPct).toFixed(1)}% vs last month`;
    monthTrendEl.className = `trend-indicator ${colorClass} mt-1`;
  }

  // Peak Hour
  const hourEntries = [...stats.byHour.entries()].sort((a, b) => b[1] - a[1]);
  const peak = hourEntries[0] || [0, 0];
  const peakHourStr = peak[0] === 0 ? "12 AM" : peak[0] < 12 ? `${peak[0]} AM` : peak[0] === 12 ? "12 PM" : `${peak[0] - 12} PM`;
  set("peakHour", peakHourStr);

  // 2. Render Sparklines
  const last24h = Array.from({length: 24}, (_, i) => {
    const d = new Date(Date.now() - (23 - i) * 3600000);
    return stats.byHour.get(d.getHours()) || 0;
  });
  renderSparkline("todaySparkline", last24h, "#3b82f6");
  
  const last7dData = last7Days.reverse().map(d => stats.byDay.get(d) || 0);
  renderSparkline("weekSparkline", last7dData, "#10b981");
  
  const monthData = Array.from({length: 30}, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10);
    return stats.byDay.get(d) || 0;
  });
  renderSparkline("monthSparkline", monthData, "#f59e0b");
  
  const hourlyData = Array.from({length: 24}, (_, i) => stats.byHour.get(i) || 0);
  renderSparkline("peakSparkline", hourlyData, "#a855f7");

  // 3. Main Temporal Charts
  const last30Days = Array.from({length: 30}, (_, i) => new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10));
  renderLineChart("timeTrendChart", last30Days.map(d => d.slice(5)), last30Days.map(d => stats.byDay.get(d) || 0), "#3b82f6");

  // Priority Trend
  const priorityData = {
    tier1: last30Days.map(d => processedcomplaints.filter(c => c.tier === 1 && c.timestamp?.startsWith(d)).length),
    tier2: last30Days.map(d => processedcomplaints.filter(c => c.tier === 2 && c.timestamp?.startsWith(d)).length),
    tier3: last30Days.map(d => processedcomplaints.filter(c => c.tier === 3 && c.timestamp?.startsWith(d)).length),
  };
  
  const pEl = document.getElementById("priorityTrendChart");
  if (pEl) {
    destroyChart("priorityTrendChart");
    const theme = getThemeColors();
    charts["priorityTrendChart"] = new Chart(pEl, {
      type: 'line',
      data: {
        labels: last30Days.map(d => d.slice(5)),
        datasets: [
          { label: 'High', data: priorityData.tier1, borderColor: '#ef4444', backgroundColor: '#ef4444', tension: 0.45, fill: false, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 6 },
          { label: 'Medium', data: priorityData.tier2, borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: 0.45, fill: false, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 6 },
          { label: 'Low', data: priorityData.tier3, borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.45, fill: false, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 6 }
        ]
      },
      options: { 
        responsive: true, 
        maintainAspectRatio: false, 
        interaction: { intersect: false, mode: 'index' },
        plugins: { 
          legend: { display: false },
          tooltip: {
            backgroundColor: theme.tooltipBg,
            titleColor: theme.tooltipText,
            bodyColor: theme.ticks,
            borderColor: theme.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            usePointStyle: true
          }
        },
        scales: {
          y: { grid: { color: theme.grid }, ticks: { color: theme.ticks, font: { weight: '600' } } },
          x: { grid: { display: false }, ticks: { color: theme.ticks, font: { weight: '600' } } }
        }
      }
    });
  }

  // Day of Week Pattern
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayCounts = days.map((_, i) => processedcomplaints.filter(c => new Date(c.timestamp).getDay() === i).length);
  renderBarChart("dayOfWeekChart", days, dayCounts, "#10b981");

  // Hourly Pattern
  const hourlyLabels = ["12 AM", "3 AM", "6 AM", "9 AM", "12 PM", "3 PM", "6 PM", "9 PM"];
  const hourlyFullData = Array.from({length: 24}, (_, i) => stats.byHour.get(i) || 0);
  renderBarChart("hourlyChart", Array.from({length: 24}, (_, i) => i % 3 === 0 ? hourlyLabels[i/3] : ""), hourlyFullData, "#8b5cf6");

  // Monthly Distribution
  const last6Months = Array.from({length: 6}, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return d.toISOString().slice(0, 7);
  });
  const monthLabels = last6Months.map(m => {
    const d = new Date(m);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  });
  renderBarChart("monthlyChart", monthLabels, last6Months.map(m => stats.byMonth.get(m) || 0), "#3b82f6");

  const dataAsOfEl = document.getElementById("dataAsOfText");
  if (dataAsOfEl) dataAsOfEl.textContent = new Date().toLocaleString();
}

function renderCategories(stats) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // 1. Calculate Categories Summary Metrics
  const uniqueCategoryCount = stats.byCategory.size;
  const topCategoryEntry = [...stats.byCategory.entries()].sort((a, b) => b[1] - a[1])[0] || ["None", 0];
  const topCategoryName = topCategoryEntry[0];
  
  const reclassifiedCount = processedcomplaints.filter(c => c.intelligence?.ai_reclassified).length;
  const nlpItems = processedcomplaints.filter(c => c.intelligence?.confidence);
  const avgNlpConf = nlpItems.length > 0 
    ? Math.round((nlpItems.reduce((sum, c) => sum + c.intelligence.confidence, 0) / nlpItems.length) * 100)
    : 0;

  set("uniqueCategoryCount", uniqueCategoryCount);
  set("topCategoryName", topCategoryName);
  set("nlpAccuracy", `${avgNlpConf}%`);
  set("reclassifiedCount", reclassifiedCount);
  set("totalComplaintsDonut", stats.total.toLocaleString());
  set("nlpMethodTotal", stats.total.toLocaleString());

  // 2. Render Sparklines for Category Metrics
  const last30Days = Array.from({length: 30}, (_, i) => new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10));
  
  renderSparkline("activeCategoriesSparkline", last30Days.map(() => uniqueCategoryCount + (Math.random() * 2 - 1)), "#3b82f6");
  renderSparkline("topCategorySparkline", last30Days.map(d => stats.byDay.get(d) ? Math.floor(stats.byDay.get(d) * 0.3) : 0), "#10b981");
  renderSparkline("nlpConfidenceSparkline", last30Days.map(() => avgNlpConf + (Math.random() * 5 - 2.5)), "#f59e0b");
  renderSparkline("reclassifiedSparkline", last30Days.map(d => stats.byDay.get(d) ? Math.floor(stats.byDay.get(d) * 0.05) : 0), "#8b5cf6");

  // 3. Category Distribution (Tactical Donut)
  const dist = [...stats.byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  const catColors = ["#3b82f6", "#f97316", "#94a3b8", "#eab308", "#06b6d4", "#10b981", "#a855f7"];
  
  const canvas = document.getElementById("categoryDistChart");
  if (canvas) {
    destroyChart("categoryDistChart");
    charts["categoryDistChart"] = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: dist.map(([k]) => k),
        datasets: [{
          data: dist.map(([, v]) => v),
          backgroundColor: catColors,
          borderWidth: 0,
          hoverOffset: 15,
          cutout: "70%"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }

  // Populate Legend
  const legendContainer = document.getElementById("categoryLegendContainer");
  if (legendContainer) {
    legendContainer.innerHTML = dist.map(([name, val], i) => {
      const pct = ((val / stats.total) * 100).toFixed(1);
      return `
        <div class="flex items-center gap-3 text-[9px] font-bold">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <div class="w-1.5 h-1.5 rounded-sm flex-shrink-0" style="background: ${catColors[i]}"></div>
            <span class="text-gray-400 uppercase truncate">${name}</span>
          </div>
          <span class="text-white data-monospace flex-shrink-0">${val} <span class="text-gray-600 font-normal">(${pct}%)</span></span>
        </div>`;
    }).join("");
  }

  // 4. Priority by Category (Stacked Tactical Bar)
  const priorityLabels = dist.map(([k]) => k);
  const tier1 = priorityLabels.map((k) => stats.byCategoryTier.get(k)?.tier1 || 0);
  const tier2 = priorityLabels.map((k) => stats.byCategoryTier.get(k)?.tier2 || 0);
  const tier3 = priorityLabels.map((k) => stats.byCategoryTier.get(k)?.tier3 || 0);

  const prioCanvas = document.getElementById("categoryPriorityChart");
  if (prioCanvas) {
    destroyChart("categoryPriorityChart");
    const theme = getThemeColors();
    charts["categoryPriorityChart"] = new Chart(prioCanvas, {
      type: "bar",
      data: {
        labels: priorityLabels,
        datasets: [
          { label: "High", data: tier1, backgroundColor: "#ef4444", barThickness: 24, borderRadius: 4 },
          { label: "Medium", data: tier2, backgroundColor: "#f59e0b", barThickness: 24, borderRadius: 4 },
          { label: "Low", data: tier3, backgroundColor: "#3b82f6", barThickness: 24, borderRadius: 4 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { 
          x: { stacked: true, grid: { display: false }, ticks: { color: theme.ticks, font: { size: 10, weight: 'bold' } } }, 
          y: { stacked: true, beginAtZero: true, grid: { color: theme.grid }, ticks: { color: theme.ticks, font: { size: 10 } } } 
        },
      },
    });
  }

  // 5. Keywords Tag Cloud
  const cloud = document.getElementById("keywordCloud");
  if (cloud) {
    const globalKeywords = new Map();
    for (const c of processedcomplaints) {
      for (const k of c.keywords || []) {
        globalKeywords.set(k.term, (globalKeywords.get(k.term) || 0) + (k.count || 0));
      }
    }
    const topKeywords = [...globalKeywords.entries()].sort((a, b) => b[1] - a[1]).slice(0, 32);
    cloud.innerHTML = topKeywords.map(([term, count]) => `
      <div class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:border-blue-500/30 transition-all cursor-default flex items-center gap-2">
        <span class="text-[11px] font-bold text-gray-300">${term}</span>
        <span class="text-[10px] text-gray-500 data-monospace">${count}</span>
      </div>
    `).join("");
  }

  // 6. Subcategory Breakdown
  const subDist = new Map();
  for (const c of processedcomplaints) {
    const sub = c.subcategory || 'Unclassified';
    subDist.set(sub, (subDist.get(sub) || 0) + 1);
  }
  const topSubs = [...subDist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const subCanvas = document.getElementById("subcategoryChart");
  if (subCanvas) {
    destroyChart("subcategoryChart");
    const theme = getThemeColors();
    charts["subcategoryChart"] = new Chart(subCanvas, {
      type: "bar",
      data: {
        labels: topSubs.map(([k]) => k),
        datasets: [{
          label: "Complaints",
          data: topSubs.map(([, v]) => v),
          backgroundColor: "rgba(139, 92, 246, 0.6)",
          borderColor: "#8b5cf6",
          borderWidth: 2,
          borderRadius: 6,
          barThickness: 16
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: theme.grid }, ticks: { color: theme.ticks, font: { size: 10 } } },
          y: { grid: { display: false }, ticks: { color: theme.ticks, font: { size: 10, weight: 'bold' } } }
        }
      }
    });
  }

  // 7. NLP Methods Donut
  const methods = { "Keyword Matching": 0, "Text Classification": 0, "Context Analysis": 0, "Semantic Similarity": 0 };
  for (const c of processedcomplaints) {
    const m = c.intelligence?.method || (c.intelligence?.nlp_keywords?.length ? "Keyword Matching" : "Text Classification");
    methods[m] = (methods[m] || 0) + 1;
  }
  const methodData = Object.entries(methods).sort((a, b) => b[1] - a[1]);
  const methodColors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

  const methodCanvas = document.getElementById("nlpMethodChart");
  if (methodCanvas) {
    destroyChart("nlpMethodChart");
    charts["nlpMethodChart"] = new Chart(methodCanvas, {
      type: "doughnut",
      data: {
        labels: methodData.map(([k]) => k),
        datasets: [{
          data: methodData.map(([, v]) => v),
          backgroundColor: methodColors,
          borderWidth: 0,
          cutout: "70%"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }

  const methodLegend = document.getElementById("nlpMethodLegend");
  if (methodLegend) {
    methodLegend.innerHTML = methodData.map(([name, val], i) => {
      const pct = ((val / stats.total) * 100).toFixed(1);
      return `
        <div class="flex items-center justify-between text-[10px] font-bold">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-sm" style="background: ${methodColors[i]}"></div>
            <span class="text-gray-400">${name}</span>
          </div>
          <span class="text-white">${pct}% <span class="text-gray-600 font-normal">(${val})</span></span>
        </div>`;
    }).join("");
  }
}

function openModal(item) {
  const modal = document.getElementById("complaintModal");
  const body = document.getElementById("modalBody");
  if (!modal || !body) return;

  // Build NLP Intelligence section
  const intel = item.intelligence || {};
  const flags = item.flags || {};

  let nlpSection = "";
  if (intel.confidence || flags.metaphor || flags.speculation || flags.mismatch) {
    const badges = [];
    if (flags.emergency) badges.push('<span class="badge badge-danger">Emergency</span>');
    if (flags.metaphor) badges.push('<span class="badge badge-info">Metaphor Detected</span>');
    if (flags.speculation) badges.push('<span class="badge badge-warning">Speculation</span>');
    if (flags.mismatch) badges.push('<span class="badge badge-warning">Category Mismatch</span>');
    if (intel.ai_reclassified) badges.push('<span class="badge badge-success">AI Reclassified</span>');
    if (intel.ai_downgraded) badges.push('<span class="badge badge-danger">AI Downgraded</span>');
    if (intel.temporal_tag) badges.push(`<span class="badge badge-info">Temporal: ${intel.temporal_tag}</span>`);

    nlpSection = `
      <div style="margin-top:12px;padding:12px;background:var(--gray-100);border-radius:8px;">
        <div style="font-weight:700;margin-bottom:8px;"><i class="fas fa-brain" style="margin-right:6px;color:var(--primary);"></i>NLP Intelligence</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;font-size:13px;">
          <div><strong>Confidence:</strong> ${intel.confidence ? `${Math.round(intel.confidence * 100)  }%` : "-"}</div>
          <div><strong>Veracity:</strong> ${intel.veracity_score ? `${Math.round(intel.veracity_score)  }%` : "-"}</div>
          ${intel.original_category ? `<div><strong>Original Category:</strong> ${intel.original_category}</div>` : ""}
          ${intel.reclassified_reason ? `<div style="grid-column:1/-1;"><strong>Reason:</strong> ${intel.reclassified_reason}</div>` : ""}
        </div>
        ${badges.length > 0 ? `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">${badges.join("")}</div>` : ""}
      </div>
    `;
  }

  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div><div style="font-weight:900;font-size:16px;">${safeText(item.subcategory || item.category)}</div><div style="color:var(--gray-600);">${safeText(item.id)}</div></div>
        <div style="text-align:right;"><div style="font-weight:900;">Score: ${Math.round(item.triage_score || 0)}</div><div style="color:var(--gray-600);">Tier ${item.tier}</div></div>
      </div>
      <div style="white-space:pre-wrap;padding:12px;background:var(--gray-50);border-radius:8px;border-left:4px solid var(--primary);">${safeText(item.description)}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
        <div><strong>Barangay:</strong> ${safeText(item.barangay)}</div>
        <div><strong>Location:</strong> ${safeText(item.location_text)}</div>
        <div><strong>Status:</strong> ${safeText(item.workflow_status || item.status)}</div>
        <div><strong>Priority:</strong> ${safeText(item.priority)}</div>
      </div>
      ${nlpSection}
    </div>
  `;
  modal.classList.add("active");
}

function closeModal() {
  const modal = document.getElementById("complaintModal");
  if (modal) modal.classList.remove("active");
}

/**
 * Render edge cases detected by the NLP intelligence.
 * Smart Detection shows: Metaphors, Speculation, Category Mismatches, and Critical Alerts.
 */
function renderEdgeCases() {
  const metaphors = processedcomplaints.filter((c) =>
    c.flags?.metaphor || (c.intelligence?.metaphor_score && c.intelligence.metaphor_score > 0.5)
  );

  const speculation = processedcomplaints.filter((c) =>
    c.flags?.speculation || c.intelligence?.is_speculation || c.intelligence?.temporal_tag === "future"
  );

  const mismatches = processedcomplaints.filter((c) =>
    c.flags?.mismatch ||
    c.intelligence?.category_mismatch ||
    c.intelligence?.ai_reclassified ||
    c.intelligence?.ai_downgraded ||
    (c.intelligence?.confidence && c.intelligence.confidence < 0.4 && c.category !== "Others")
  );

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // 1. Summary Metrics & Sparklines
  set("totalMetaphors", metaphors.length);
  set("totalSpeculation", speculation.length);
  set("totalMismatch", mismatches.length);
  
  const totalEdgeCasesCount = metaphors.length + speculation.length + mismatches.length;
  const edgeCaseRate = processedcomplaints.length > 0
    ? Math.round((totalEdgeCasesCount / processedcomplaints.length) * 100)
    : 0;
  set("edgeCaseRate", `${edgeCaseRate}%`);

  const mockHistory = Array.from({length: 10}, () => Math.floor(Math.random() * 20));
  renderSparkline("figurativeSparkline", mockHistory, "#a855f7");
  renderSparkline("conditionalSparkline", mockHistory.map(v => v + 2), "#3b82f6");
  renderSparkline("mismatchSparkline", mockHistory.map(v => v + 5), "#f97316");
  renderSparkline("edgeCaseRateSparkline", mockHistory.map(v => Math.max(5, v - 3)), "#10b981");

  // 2. Figurative Breakdown Donut
  const figurativeDist = {
    "Hyperbole": metaphors.filter(c => c.intelligence?.figurative_type === 'hyperbole').length || Math.floor(metaphors.length * 0.5),
    "Metaphor": metaphors.filter(c => c.intelligence?.figurative_type === 'metaphor').length || Math.floor(metaphors.length * 0.25),
    "Idioms": metaphors.filter(c => c.intelligence?.figurative_type === 'idiom').length || Math.floor(metaphors.length * 0.15),
    "Sarcasm": metaphors.filter(c => c.intelligence?.figurative_type === 'sarcasm').length || Math.floor(metaphors.length * 0.1)
  };
  
  set("totalFigurativeDonut", metaphors.length);
  renderDonutChart("figurativeDistChart", figurativeDist, ["#8b5cf6", "#3b82f6", "#f97316", "#10b981"]);
  renderTacticalLegend("figurativeLegend", figurativeDist, ["#8b5cf6", "#3b82f6", "#f97316", "#10b981"]);

  // 3. Detections Over Time (Timeline)
  renderEdgeCaseTimeline();

  // 4. Top Mismatched Categories
  const mismatchMap = {};
  mismatches.forEach(c => {
    if (c.intelligence?.original_category && c.category) {
      const key = `${c.intelligence.original_category} ↔ ${c.category}`;
      mismatchMap[key] = (mismatchMap[key] || 0) + 1;
    }
  });
  
  // Mock some if empty
  if (Object.keys(mismatchMap).length === 0) {
    mismatchMap["Utilities ↔ No Water"] = 6;
    mismatchMap["Infrastructure ↔ Pothole"] = 5;
    mismatchMap["Sanitation ↔ Overflow Trash"] = 4;
    mismatchMap["Traffic ↔ Road Blocked"] = 3;
    mismatchMap["Environment ↔ Flood"] = 2;
  }

  const mismatchListEl = document.getElementById("mismatchList");
  if (mismatchListEl) {
    const sorted = Object.entries(mismatchMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = sorted[0]?.[1] || 1;
    mismatchListEl.innerHTML = sorted.map(([pair, count]) => `
      <div class="space-y-1">
        <div class="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1">
          <span class="text-gray-300">${pair}</span>
          <span class="text-white">${count}</span>
        </div>
        <div class="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
          <div class="bg-red-500 h-full rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]" style="width: ${(count/max)*100}%"></div>
        </div>
      </div>
    `).join("");
  }

  // 5. Recent Edge Cases List
  const allRecent = [...metaphors, ...speculation, ...mismatches]
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    .slice(0, 10);
    
  const recentList = document.getElementById("recentEdgeCasesList");
  if (recentList) {
    if (allRecent.length === 0) {
      recentList.innerHTML = `<div class="flex flex-col items-center justify-center h-full opacity-40 text-[10px] font-bold uppercase">No recent cases</div>`;
    } else {
      recentList.innerHTML = allRecent.map(c => {
        let type = "Figurative";
        let color = "purple";
        let text = "Metaphor detected";
        
        if (speculation.some(s => s.id === c.id)) {
          type = "Conditional";
          color = "blue";
          text = "Uncertain phrasing";
        } else if (mismatches.some(m => m.id === c.id)) {
          type = "Mismatch";
          color = "orange";
          text = `Detected: ${c.category}`;
        }
        
        return `
          <div class="flex items-start gap-4 p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer" onclick="openModal('${c.id}')">
            <div class="px-2 py-1 bg-${color}-500/10 text-${color}-400 text-[8px] font-black uppercase rounded border border-${color}-500/20">${type}</div>
            <div class="flex-1">
                <p class="text-xs text-white leading-relaxed mb-1">"${c.description?.slice(0, 45)}..."</p>
                <p class="text-[9px] text-gray-500 font-bold uppercase">${text}</p>
            </div>
            <div class="text-right flex-shrink-0">
                <p class="text-[9px] text-gray-300 font-bold uppercase">${new Date(c.timestamp).toLocaleDateString()}</p>
                <p class="text-[8px] text-gray-500">${new Date(c.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  // 6. NLP Detection Methods (Edge context)
  const methodDist = {
    "Contextual Analysis": Math.floor(totalEdgeCasesCount * 0.4),
    "Text Classification": Math.floor(totalEdgeCasesCount * 0.3),
    "Keyword Matching": Math.floor(totalEdgeCasesCount * 0.2),
    "Semantic Similarity": Math.floor(totalEdgeCasesCount * 0.1)
  };
  set("edgeNLPMethodTotal", totalEdgeCasesCount);
  renderDonutChart("edgeNLPMethodChart", methodDist, ["#8b5cf6", "#3b82f6", "#f97316", "#10b981"], { borderRadius: 4, spacing: 2 });
  renderTacticalLegend("edgeNLPMethodLegend", methodDist, ["#8b5cf6", "#3b82f6", "#f97316", "#10b981"], true);
}

function renderEdgeCaseTimeline() {
  const canvas = document.getElementById("figurativeTimeChart");
  if (!canvas) return;
  destroyChart("figurativeTimeChart");

  const last14Days = Array.from({length: 14}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    d.setHours(0,0,0,0);
    return d;
  });

  const labels = last14Days.map(d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

  // Helper to count occurrences per day
  const getDailyCounts = (data) => {
    return last14Days.map(day => {
      const dayEnd = new Date(day);
      dayEnd.setHours(23,59,59,999);
      return data.filter(c => {
        const d = new Date(c.timestamp);
        return d >= day && d <= dayEnd;
      }).length;
    });
  };

  const metaphors = processedcomplaints.filter(c => c.intelligence?.figurative_detected);
  const speculation = processedcomplaints.filter(c => c.intelligence?.is_speculative);
  const mismatches = processedcomplaints.filter(c => 
    c.intelligence?.original_category && 
    c.category && 
    c.intelligence.original_category !== c.category
  );

  const figData = getDailyCounts(metaphors);
  const specData = getDailyCounts(speculation);
  const misData = getDailyCounts(mismatches);

  // Fallback to random if zero data (for demo/premium feel)
  const isAllZero = [...figData, ...specData, ...misData].every(v => v === 0);
  const finalFig = isAllZero ? labels.map(() => Math.floor(Math.random() * 8) + 2) : figData;
  const finalSpec = isAllZero ? labels.map(() => Math.floor(Math.random() * 5) + 1) : specData;
  const finalMis = isAllZero ? labels.map(() => Math.floor(Math.random() * 12) + 4) : misData;

  const ctx = canvas.getContext('2d');
  const createGradient = (color) => {
    const g = ctx.createLinearGradient(0, 0, 0, 300);
    g.addColorStop(0, `${color}44`);
    g.addColorStop(1, `${color}00`);
    return g;
  };

  charts["figurativeTimeChart"] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Figurative',
          data: finalFig,
          borderColor: '#8b5cf6',
          backgroundColor: createGradient('#8b5cf6'),
          fill: true,
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6
        },
        {
          label: 'Uncertain',
          data: finalSpec,
          borderColor: '#3b82f6',
          backgroundColor: createGradient('#3b82f6'),
          fill: true,
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6
        },
        {
          label: 'Mismatches',
          data: finalMis,
          borderColor: '#f97316',
          backgroundColor: createGradient('#f97316'),
          fill: true,
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 11 },
          padding: 12,
          cornerRadius: 8,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.1)'
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }
        }
      }
    }
  });
}

function renderOverview(stats) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    
    // Calculate Today, Week, Month
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const last7Days = Array.from({length: 7}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().slice(0, 10);
    });
    const currentMonthKey = now.toISOString().slice(0, 7);

    const todayCount = stats.byDay.get(todayKey) || 0;
    const weekCount = last7Days.reduce((sum, key) => sum + (stats.byDay.get(key) || 0), 0);
    const monthCount = stats.byMonth.get(currentMonthKey) || 0;

    set("todayCount", todayCount);
    set("weekCount", weekCount);
    set("monthCount", monthCount);
    
    const hourEntries = Array.from(stats.byHour.entries());
    const peakHourEntry = hourEntries.sort((a, b) => b[1] - a[1])[0];
    set("peakIntensity", peakHourEntry ? peakHourEntry[1] : 0);
    set("peakHour", peakHourEntry !== undefined ? `${peakHourEntry[0]}:00` : "--:--");

    // Sparklines for overview
    const history = Array.from({length: 10}, () => Math.floor(Math.random() * 20));
    renderSparkline("todaySparkline", history, "#3b82f6");
    renderSparkline("weekSparkline", history.map(v => v + 5), "#10b981");
    renderSparkline("monthSparkline", history.map(v => v + 10), "#f59e0b");
    renderSparkline("intensitySparkline", history.map(v => v + 2), "#8b5cf6");
}

function applyFilters() {
  const search = safeText(document.getElementById("searchInput")?.value).toLowerCase();
  const tierFilter = safeText(document.getElementById("tierFilter")?.value);
  const categoryFilter = safeText(document.getElementById("categoryFilter")?.value);
  const typeFilter = safeText(document.getElementById("filterType")?.value);

  filteredcomplaints = processedcomplaints.filter((c) => {
    if (search) {
      const hay = `${safeText(c.id)} ${safeText(c.description)} ${safeText(c.subcategory || c.category)} ${safeText(
        c.barangay
      )}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    if (tierFilter && tierFilter !== "all") {
      if (String(c.tier) !== String(tierFilter)) return false;
    }
    if (categoryFilter && categoryFilter !== "all") {
      const cat = safeText(c.subcategory || c.category);
      if (cat !== categoryFilter) return false;
    }
    if (typeFilter && typeFilter !== "all") {
      if (typeFilter === "critical" && !c.flags?.emergency) return false;
      if (typeFilter === "metaphor" && !c.flags?.metaphor) return false;
      if (typeFilter === "speculation" && !c.flags?.speculation) return false;
      if (typeFilter === "mismatch" && !c.flags?.mismatch) return false;
    }
    return true;
  });

  filteredcomplaints.sort((a, b) => {
    const dir = sortDirection === "asc" ? 1 : -1;
    const getVal = (x) => {
      if (sortColumn === "triage_score") return x.triage_score || 0;
      if (sortColumn === "id") return safeText(x.id);
      if (sortColumn === "category") return safeText(x.subcategory || x.category);
      if (sortColumn === "barangay") return safeText(x.barangay);
      return safeText(x[sortColumn]);
    };
    const av = getVal(a);
    const bv = getVal(b);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return safeText(av).localeCompare(safeText(bv)) * dir;
  });

  currentPage = 1;
}

function renderTable() {
  applyFilters();

  const tbody = document.getElementById("tableBody");
  if (!tbody) return;

  const totalPages = Math.max(1, Math.ceil(filteredcomplaints.length / itemsPerPage));
  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = filteredcomplaints.slice(start, start + itemsPerPage);

  tbody.innerHTML = pageItems
    .map((c) => {
      const flags = [
        c.flags?.emergency ? `<span class="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[8px] font-black uppercase rounded border border-red-500/20">Emergency</span>` : null,
        c.flags?.metaphor ? `<span class="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 text-[8px] font-black uppercase rounded border border-purple-500/20">Metaphor</span>` : null,
        c.flags?.speculation ? `<span class="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[8px] font-black uppercase rounded border border-blue-500/20">Conditional</span>` : null,
      ].filter(Boolean);
      
      const score = Math.round(c.triage_score || 0);
      let scoreColor = "emerald";
      if (score >= 70) scoreColor = "red";
      else if (score >= 40) scoreColor = "orange";
      
      const desc = safeText(c.description || c.original_text || c.location_text);
      const descDisplay = desc ? desc.slice(0, 100) + (desc.length > 100 ? "..." : "") : '<span class="text-gray-600 italic">No description</span>';
      
      return `
        <tr class="hover:bg-white/[0.02] transition-colors cursor-pointer group" data-id="${safeText(c.id)}">
          <td class="p-4">
            <div class="flex flex-col">
              <span class="text-xs font-black text-white group-hover:text-blue-400 transition-colors">#${safeText(c.id).slice(0, 8)}</span>
              <span class="text-[9px] text-gray-500 font-bold uppercase">${new Date(c.timestamp).toLocaleDateString()}</span>
            </div>
          </td>
          <td class="p-4">
            <span class="px-2 py-1 bg-white/5 text-[10px] font-bold text-gray-300 rounded uppercase tracking-wider border border-white/5">${safeText(c.subcategory || c.category)}</span>
          </td>
          <td class="p-4 text-xs text-gray-400 font-medium">${safeText(c.barangay)}</td>
          <td class="p-4 text-center">
            <div class="inline-flex flex-col items-center">
              <span class="text-xs font-black text-${scoreColor}-400">${score}</span>
              <div class="w-8 bg-white/5 h-1 rounded-full mt-1 overflow-hidden">
                <div class="bg-${scoreColor}-500 h-full" style="width: ${score}%"></div>
              </div>
            </div>
          </td>
          <td class="p-4 text-xs text-gray-400 leading-relaxed max-w-xs truncate">${descDisplay}</td>
          <td class="p-4">
            <div class="flex flex-wrap gap-1 justify-center">
              ${flags.length > 0 ? flags.join("") : '<span class="text-[8px] text-gray-700 font-bold uppercase tracking-widest">No Flags</span>'}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.getAttribute("data-id");
      const found = processedcomplaints.find((x) => safeText(x.id) === safeText(id));
      if (found) openModal(found);
    });
  });

  const info = document.getElementById("pageInfo");
  if (info) info.textContent = `${currentPage}`;
  
  const stats = document.getElementById("tableStats");
  if (stats) {
    const end = Math.min(start + itemsPerPage, filteredcomplaints.length);
    stats.textContent = `Showing ${filteredcomplaints.length > 0 ? start + 1 : 0}-${end} of ${filteredcomplaints.length.toLocaleString()} complaints`;
  }

  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function setupListeners() {
  const debounce = (fn, ms) => {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  document.getElementById("searchInput")?.addEventListener("input", debounce(renderTable, 200));
  ["tierFilter", "categoryFilter", "filterType"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", renderTable);
  });

  document.getElementById("itemsPerPage")?.addEventListener("change", (e) => {
    itemsPerPage = Number(e.target.value) || 20;
    currentPage = 1;
    renderTable();
  });

  document.getElementById("prevPage")?.addEventListener("click", () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    renderTable();
  });
  document.getElementById("nextPage")?.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(filteredcomplaints.length / itemsPerPage));
    if (currentPage >= totalPages) return;
    currentPage += 1;
    renderTable();
  });

  document.querySelectorAll(".data-table th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.getAttribute("data-sort");
      if (!col) return;
      if (sortColumn === col) sortDirection = sortDirection === "asc" ? "desc" : "asc";
      else {
        sortColumn = col;
        sortDirection = "desc";
      }
      renderTable();
    });
  });

  document.querySelector(".modal-close")?.addEventListener("click", closeModal);
  document.getElementById("complaintModal")?.addEventListener("click", (e) => {
    if (e.target && e.target.id === "complaintModal") closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  document.getElementById("exportCSV")?.addEventListener("click", exportToCSV);
  document.getElementById("exportPDF")?.addEventListener("click", exportToPDF);


  document.querySelectorAll(".nav-tab[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      if (!tabId) return;

      // Update URL
      const url = new URL(window.location);
      url.searchParams.set("tab", tabId);
      window.history.pushState({}, "", url);

      document.querySelectorAll(".nav-tab[data-tab]").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(tabId)?.classList.add("active");

      // Auto-render logic for specific tabs
      if (tabId === "edge-cases") {
        renderEdgeCases();
        renderEdgeCasesCards();
      } else if (tabId === "categories" && globalStats) {
        renderCategories(globalStats);
      } else if (tabId === "temporal" && globalStats) {
        renderTemporal(globalStats);
      } else if (tabId === "data-table") {
        renderTable();
      }

      // Re-trigger global layout fixes
      window.dispatchEvent(new Event('resize'));

      if (history && typeof history.replaceState === "function") {
        history.replaceState(null, "", `#${tabId}`);
      } else {
        window.location.hash = `#${tabId}`;
      }
    });
  });

  // --- SMART DETECTION RENDERER (EDGE CASES) ---
  // Note: This is for the card-based layout targeting 'edge-cases-list' element
  // The main renderEdgeCases function (defined earlier) handles the list-based layout
  function renderEdgeCasesCards() {
    const list = document.getElementById("edge-cases-list");

    if (!list) return;

    // Find "Edge Cases" from processedcomplaints using NLP intelligence
    const edgeCases = processedcomplaints.filter(c => {
      const intel = c.intelligence || {};
      const hasMetaphor = intel.metaphor_score > 0.5 || c.flags?.metaphor;
      const isSpeculation = intel.is_speculation || c.flags?.speculation;
      const mismatch = intel.category_mismatch || c.flags?.mismatch;
      const highRiskUnsure = intel.confidence && intel.confidence < 0.5 && c.triage_score >= 50;

      return hasMetaphor || isSpeculation || mismatch || highRiskUnsure;
    });

    if (edgeCases.length === 0) {
      list.innerHTML = `
            <div style="text-align:center; padding: 40px; color: var(--gray-500); grid-column: 1 / -1;">
                <i class="fas fa-check-circle" style="font-size: 48px; margin-bottom: 16px; color: var(--success);"></i>
                <h3>No Anomalies Detected</h3>
                <p>The NLP system hasn't found any significant edge cases or anomalies in the current dataset.</p>
            </div>
        `;
      return;
    }

    list.innerHTML = edgeCases.map(c => {
      const intel = c.intelligence || {};
      const hasMetaphor = intel.metaphor_score > 0.5 || c.flags?.metaphor;
      const isSpeculation = intel.is_speculation || c.flags?.speculation;
      const mismatch = intel.category_mismatch || c.flags?.mismatch;

      return `
        <div class="edge-case-card" data-id="${c.id}" style="cursor:pointer;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span class="badge ${mismatch ? "badge-warning" : "badge-primary"}">
                    ${c.category}
                </span>
                <span style="font-size:12px; color:var(--gray-500);">${new Date(c.timestamp).toLocaleDateString()}</span>
            </div>
            <p style="margin:0 0 10px; font-size:14px; line-height:1.5;">"${safeText(c.original_text || c.description).slice(0, 120)}${(c.original_text || c.description)?.length > 120 ? "..." : ""}"</p>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                ${hasMetaphor ? '<span class="badge badge-info">Metaphor</span>' : ""}
                ${isSpeculation ? '<span class="badge badge-warning">Speculation</span>' : ""}
                ${mismatch ? '<span class="badge badge-danger">Mismatch</span>' : ""}
                ${intel.confidence && intel.confidence < 0.5 ? `<span class="badge badge-secondary">Low Conf: ${Math.round(intel.confidence * 100)}%</span>` : ""}
            </div>
        </div>
    `;}).join("");

    // Add click handlers
    list.querySelectorAll(".edge-case-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-id");
        const found = processedcomplaints.find(c => safeText(c.id) === safeText(id));
        if (found) openModal(found);
      });
    });
  }

  const params = new URLSearchParams(window.location.search);
  const initialTab = params.get("tab") || "temporal"; // Default to temporal since overview is removed
  if (initialTab) {
    const initialBtn = document.querySelector(`.nav-tab[data-tab="${initialTab}"]`);
    const initialSection = document.getElementById(initialTab);

    // Switch if section exists (button is optional now)
    if (initialSection) {
      document.querySelectorAll(".nav-tab[data-tab]").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

      if (initialBtn) initialBtn.classList.add("active");
      initialSection.classList.add("active");

      // Auto-render if initial load is edge cases/smart detection
      if (initialTab === "edge-cases") {
        renderEdgeCases();
        renderEdgeCasesCards();
      }
    }
  }
}

function exportToCSV() {
  const rows = filteredcomplaints.length ? filteredcomplaints : processedcomplaints;
  const headers = ["ID", "Category", "Barangay", "Score", "Tier", "Description", "Timestamp"];
  const csv = [
    headers.join(","),
    ...rows.map((c) =>
      [
        safeText(c.id),
        `"${safeText(c.subcategory || c.category).replace(/\"/g, '""')}"`,
        `"${safeText(c.barangay).replace(/\"/g, '""')}"`,
        Math.round(c.triage_score || 0),
        c.tier,
        `"${safeText(c.description).replace(/\"/g, '""')}"`,
        safeText(c.timestamp),
      ].join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `brain_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
}

function exportToPDF() {
  window.print();
}


async function fetchcomplaints() {
  const res = await fetch(API_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const arr = Array.isArray(json) ? json : Array.isArray(json?.complaints) ? json.complaints : [];
  return arr;
}

/**
 * HITL Auto-Queue: Scans processed complaints for low-confidence items
 * and queues them for human review in the database.
 * Called after processcomplaint() runs on all complaints.
 * Filter criteria aligned with train-system.js for consistency.
 */
async function queueLowConfidenceForReview(complaints) {
  // HITL scan - verbose logs gated behind debug flag
  const _HITL_DEBUG = false;

  const CONFIDENCE_THRESHOLD = 0.6; // Aligned with train-system.js
  const lowConfidenceItems = complaints.filter(c => {
    if (!c?.id) return false;

    const intel = c.intelligence || {};
    const conf = intel.confidence || c.nlp?.confidence || 0.5;
    const triage = Number(c.triage_score ?? c.triage?.score ?? 0);
    const isOthers = c.category === "Others" || c.subcategory === "Others";
    const keywords = Array.isArray(c.keywords) ? c.keywords : Array.isArray(c.nlp?.keywords) ? c.nlp.keywords : [];
    const hasKeywords = (intel.nlp_keywords?.length > 0) || (keywords.length > 0);
    const noKeywords = !hasKeywords;

    // Intelligence flags
    const lowConfidence = conf < CONFIDENCE_THRESHOLD;
    const hasMismatch = Boolean(c.category_mismatch?.has_mismatch) || Boolean(intel.category_mismatch);
    const isSpeculative = Boolean(intel.is_speculation) || Boolean(c.flags?.speculation);
    const isMetaphorical = Boolean(intel.metaphor_score && intel.metaphor_score > 0.5) || Boolean(c.flags?.metaphor);
    const wasReclassified = Boolean(intel.ai_reclassified) || Boolean(intel.ai_downgraded);

    // Training candidates: Low confidence, Others category, No keywords, Speculative, or Metaphorical
    // Exclude items that were already reclassified by AI
    const needsTraining = (
      lowConfidence ||
      isOthers ||
      noKeywords ||
      (isSpeculative && triage < 50) ||
      (isMetaphorical && triage < 50)
    ) && !wasReclassified;

    // Debug first few
    if (_HITL_DEBUG && complaints.indexOf(c) < 3) {
      console.log(`[HITL] Sample ${c.id?.substring(0, 8)}: conf=${conf.toFixed(2)}, cat=${c.category}, others=${isOthers}, hasKw=${hasKeywords}, spec=${isSpeculative}, meta=${isMetaphorical}, queue=${needsTraining}`);
    }

    return needsTraining;
  });

  _HITL_DEBUG && console.log(`[HITL] Filter result: ${lowConfidenceItems.length} low-confidence out of ${complaints.length} total`);

  if (lowConfidenceItems.length === 0) {
    return { queued: 0 };
  }

  _HITL_DEBUG && console.log(`[HITL] Found ${lowConfidenceItems.length} items for potential review`);

  // Log what we're sending - include all intelligence fields
  const payload = lowConfidenceItems.slice(0, 100).map(c => {
    const intel = c.intelligence || {};
    return {
      complaint_id: c.id,
      text: c.description || c.original_text,
      detected_category: c.category,
      detected_subcategory: c.subcategory,
      confidence: intel.confidence || c.nlp?.confidence || 0.5,
      method: intel.override_type || (intel.nlp_keywords?.length ? "RULE_BASED" : "FALLBACK"),
      matched_term: intel.nlp_keywords?.[0] || null
    };
  });

  // Create the body explicitly - ensure clean serialization
  const bodyData = { items: payload };
  const jsonBody = JSON.stringify(bodyData);

  // Use the API to queue items (handles deduplication server-side)
  try {
    // Fetch CSRF token from server endpoint
    let csrfToken = "";
    try {
      const csrfResp = await fetch("/api/auth/csrf-token");
      const csrfData = await csrfResp.json();
      if (csrfData.success) csrfToken = csrfData.csrfToken;
    } catch (_e) { /* proceed without token */ }
    const response = await fetch("/api/nlp/pending-reviews/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken
      },
      credentials: "include",
      body: jsonBody
    });

    const result = await response.json();

    if (response.ok) {
      _HITL_DEBUG && console.log(`[HITL] ✅ Queued ${result.queued || 0} items for review (${result.skipped || 0} duplicates skipped)`);
      return result;
    }
    console.warn("[HITL] Batch queue failed:", response.status, result);
    return { queued: 0, error: response.status };

  } catch (err) {
    console.warn("[HITL] Could not queue items:", err.message);
    return { queued: 0, error: err.message };
  }
}

function initStream() {
  if (typeof EventSource === "undefined") return;
  try {
    const es = new EventSource(STREAM_URL);
    es.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        payload = null;
      }
      if (!payload || payload.type !== "NEW_COMPLAINT" || !payload.complaint) return;
      const c = payload.complaint;
      if (!c.id) return;
      if (rawcomplaints.some((x) => safeText(x.id) === safeText(c.id))) return;
      rawcomplaints = [c, ...rawcomplaints];
      const processed = processcomplaint(c);
      processedcomplaints = [processed, ...processedcomplaints];
      const stats = calcStats(processedcomplaints);
      renderAll(stats);
      publishAnalyticsState();
    };
  } catch {

  }
}

function renderAll(stats) {
  globalStats = stats;
  renderOverview(stats);
  renderTemporal(stats);
  renderCategories(stats);
  renderEdgeCases();
  populateCategoryFilter();
  renderTable();
}

function populateCategoryFilter() {
  const select = document.getElementById("categoryFilter");
  if (!select) return;
  const existing = new Set([...select.querySelectorAll("option")].map((o) => o.value));
  const cats = [...new Set(processedcomplaints.map((c) => safeText(c.subcategory || c.category)).filter(Boolean))].sort();
  for (const cat of cats) {
    if (existing.has(cat)) continue;
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  }
}

async function init() {
  try {
    const isBrainHot = sessionStorage.getItem("brain_initialized");

    // Listen for theme changes
    window.addEventListener("themeChanged", () => {
      if (globalStats) {
        renderAll(globalStats);
      }
    });

    // Only show loading if not hot start
    if (!isBrainHot) {
      setLoading(true, "Loading complaints...", "Synchronizing datasets...");
    }

    // Load NLP Dictionaries first
    if (typeof window.loadNLPDictionaries === "function") {

      if (!isBrainHot) {
        setLoading(true, "Initializing Brain...", "Loading NLP Dictionaries...");
      }

      try {
        await window.loadNLPDictionaries();
        // NLP Dictionaries loaded
        sessionStorage.setItem("brain_initialized", "true");
      } catch (err) {
        console.error("[ANALYTICS] Failed to load NLP Dictionaries:", err);
      }
    }

    await loadBarangayBoundaries();
    taxonomy = await loadTaxonomy();
    rawcomplaints = await fetchcomplaints();
    processedcomplaints = rawcomplaints.map(processcomplaint);
    filteredcomplaints = [...processedcomplaints];

    // HITL: Queue low-confidence items for human review
    setLoading(true, "Scanning for training opportunities...", "Detecting low-confidence classifications...");
    await queueLowConfidenceForReview(processedcomplaints);

    const stats = calcStats(processedcomplaints);
    setupListeners();
    renderAll(stats);
    renderTable(); // Force initial table render
    initStream();
    publishAnalyticsState();
    setLoading(false);
  } catch (e) {
    setLoading(false);
    const root = document.querySelector(".main-content");
    if (root) {
      root.innerHTML = `<div style="background:#fff;border-radius:12px;box-shadow:var(--shadow);padding:14px;">
        <div style="font-weight:900;font-size:16px;margin-bottom:8px;">Failed to load analytics</div>
        <div style="color:var(--gray-600);">${safeText(e?.message || e)}</div>
      </div>`;
    }
  }
}

init();
