const API_URL = "/api/brain/complaints";
const STREAM_URL = "/api/brain/stream";
const BOUNDARIES_URL = "/assets/json/brgy_boundaries_location.json";

let rawComplaints = [];
let processedComplaints = [];
let filteredComplaints = [];
let taxonomy = null;
let barangayGeoJSON = null;

let charts = {};

let currentPage = 1;
let itemsPerPage = 20;
let sortColumn = "triage_score";
let sortDirection = "desc";

function publishAnalyticsState() {
  try {
    window.CitizenLinkBrainAnalytics = {
      getProcessedComplaints: () => processedComplaints,
      getTaxonomy: () => taxonomy,
      reprocessAll: () => {
        processedComplaints = rawComplaints.map(processComplaint);
        filteredComplaints = [...processedComplaints];
        const stats = calcStats(processedComplaints);
        renderAll(stats);
        publishAnalyticsState();
      }
    };
    window.dispatchEvent(new CustomEvent("citizenlink:brain-analytics:update"));
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
  if (typeof CitizenLinkTaxonomy === "undefined") return null;
  try {
    return await CitizenLinkTaxonomy.loadTaxonomy();
  } catch {
    return null;
  }
}

function normalizeCategoryPair(category, subcategory) {
  if (taxonomy && typeof CitizenLinkTaxonomy !== "undefined") {
    return CitizenLinkTaxonomy.normalizeCategoryPair(category, subcategory, taxonomy);
  }
  return {
    category: safeText(category).trim() || "Others",
    subcategory: safeText(subcategory).trim() || null,
  };
}

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

function computeTriage(point) {
  if (typeof window.analyzeComplaintIntelligence === "function") {
    try {
      const res = window.analyzeComplaintIntelligence(point);
      const score = Number(res?.urgencyScore || 0);
      const tier = score >= 70 ? 1 : score >= 40 ? 2 : 3;
      return { score, tier, breakdown: res?.breakdown || null };
    } catch {
      return { score: 0, tier: 3, breakdown: null };
    }
  }
  return { score: 0, tier: 3, breakdown: null };
}

function isMetaphor(text) {
  const t = safeText(text).toLowerCase();
  return /\b(parang|like)\b/.test(t);
}

function isSpeculation(text) {
  const t = safeText(text).toLowerCase();
  return /\b(maybe|baka|siguro|if|kung)\b/.test(t);
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

function processComplaint(input) {
  const description = safeText(input.description || input.descriptive_su || input.title || input.location_text);
  const normalized = normalizeCategoryPair(input.category, input.subcategory);
  const point = {
    ...input,
    category: normalized.category || "Others",
    subcategory: normalized.subcategory || normalized.category || "Others",
    description,
  };

  const triage = computeTriage(point);
  const keywords = extractKeywords(description, 18);
  const emergency = isEmergency(point.category, point.subcategory) || triage.tier === 1;
  const timestamp =
    safeText(input.timestamp || input.submitted_at || input.created_at) || new Date().toISOString();

  const processed = {
    ...input,
    description,
    category: point.category,
    subcategory: normalized.subcategory,
    timestamp,
    barangay: extractBarangay(input),
    triage_score: triage.score,
    tier: triage.tier,
    triage_breakdown: triage.breakdown,
    keywords,
    flags: {
      emergency,
      metaphor: isMetaphor(description),
      speculation: isSpeculation(description),
      mismatch: false,
    },
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

    const cat = c.subcategory || c.category || "Others";
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

function destroyChart(id) {
  const chart = charts[id];
  if (chart && typeof chart.destroy === "function") chart.destroy();
  delete charts[id];
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
  charts[canvasId] = new Chart(el, {
    type: "bar",
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: color }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function renderLineChart(canvasId, labels, values, color) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  destroyChart(canvasId);
  charts[canvasId] = new Chart(el, {
    type: "line",
    data: {
      labels,
      datasets: [{ data: values, borderColor: color, backgroundColor: "transparent", tension: 0.25 }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function renderOverview(stats) {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  set("totalComplaints", stats.total.toLocaleString());
  set("tier1Count", stats.tier1.toLocaleString());
  set("tier2Count", stats.tier2.toLocaleString());
  set("tier3Count", stats.tier3.toLocaleString());
  set("criticalCount", stats.emergency.toLocaleString());
  set("keywordsDetected", stats.keywordsDetected.toLocaleString());
  set("uniqueKeywords", stats.uniqueKeywordsCount.toLocaleString());

  const avgScore =
    stats.total > 0
      ? Math.round(processedComplaints.reduce((sum, c) => sum + (c.triage_score || 0), 0) / stats.total)
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

  const alerts = processedComplaints
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
              <div style="font-weight:800;">${safeText(c.subcategory || c.category)}</div>
              <div style="color:var(--gray-600);font-size:12px;">${safeText(c.description).slice(0, 110)}</div>
            </div>
          </div>`
        )
        .join("");
    }
  }

  const legendEl = document.getElementById("categoryLegend");
  if (legendEl) {
    const top = [...stats.byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    legendEl.innerHTML = top
      .map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:4px 0;"><span>${k}</span><strong>${v}</strong></div>`)
      .join("");
  }

  const healthDict = document.getElementById("healthDictSize");
  if (healthDict) healthDict.textContent = `${stats.uniqueKeywordsCount.toLocaleString()} tokens`;

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
    const resolved = processedComplaints.filter((c) => {
      const day = safeText(c.updated_at || c.submitted_at || c.timestamp).slice(0, 10);
      return day === today && safeText(c.workflow_status).toLowerCase() === "completed";
    }).length;
    resolvedTodayEl.textContent = resolved.toLocaleString();
  }
}

function renderTemporal(stats) {
  const byDay = [...stats.byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  renderLineChart(
    "timeTrendChart",
    byDay.map(([k]) => k),
    byDay.map(([, v]) => v),
    "#4472C4"
  );

  const byMonth = [...stats.byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  renderBarChart(
    "monthlyChart",
    byMonth.map(([k]) => k),
    byMonth.map(([, v]) => v),
    "#5B9BD5"
  );

  const byHour = [...stats.byHour.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  renderBarChart(
    "hourlyChart",
    byHour.map(([k]) => String(k)),
    byHour.map(([, v]) => v),
    "#7030A0"
  );
}

function renderCategories(stats) {
  const dist = [...stats.byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16);
  renderBarChart(
    "categoryDistChart",
    dist.map(([k]) => k),
    dist.map(([, v]) => v),
    "#4472C4"
  );

  const priorityLabels = dist.map(([k]) => k);
  const tier1 = priorityLabels.map((k) => stats.byCategoryTier.get(k)?.tier1 || 0);
  const tier2 = priorityLabels.map((k) => stats.byCategoryTier.get(k)?.tier2 || 0);
  const tier3 = priorityLabels.map((k) => stats.byCategoryTier.get(k)?.tier3 || 0);

  const el = document.getElementById("categoryPriorityChart");
  if (el) {
    destroyChart("categoryPriorityChart");
    charts["categoryPriorityChart"] = new Chart(el, {
      type: "bar",
      data: {
        labels: priorityLabels,
        datasets: [
          { label: "Tier 1", data: tier1, backgroundColor: "#C00000" },
          { label: "Tier 2", data: tier2, backgroundColor: "#FFC000" },
          { label: "Tier 3", data: tier3, backgroundColor: "#70AD47" },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      },
    });
  }

  const cloud = document.getElementById("keywordCloud");
  if (cloud) {
    const globalKeywords = new Map();
    for (const c of processedComplaints) {
      for (const k of c.keywords || []) {
        globalKeywords.set(k.term, (globalKeywords.get(k.term) || 0) + (k.count || 0));
      }
    }
    const top = [...globalKeywords.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
    cloud.innerHTML = top
      .map(
        ([term, count]) =>
          `<span style="display:inline-block;margin:6px 8px;padding:6px 10px;border-radius:999px;background:rgba(68,114,196,.1);color:var(--primary);font-weight:800;font-size:12px;">${term} <span style="opacity:.7;">${count}</span></span>`
      )
      .join("");
  }
}

function openModal(item) {
  const modal = document.getElementById("complaintModal");
  const body = document.getElementById("modalBody");
  if (!modal || !body) return;
  body.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div><div style="font-weight:900;font-size:16px;">${safeText(item.subcategory || item.category)}</div><div style="color:var(--gray-600);">${safeText(item.id)}</div></div>
        <div style="text-align:right;"><div style="font-weight:900;">Score: ${Math.round(item.triage_score || 0)}</div><div style="color:var(--gray-600);">Tier ${item.tier}</div></div>
      </div>
      <div style="white-space:pre-wrap;">${safeText(item.description)}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
        <div><strong>Barangay:</strong> ${safeText(item.barangay)}</div>
        <div><strong>Location:</strong> ${safeText(item.location_text)}</div>
        <div><strong>Status:</strong> ${safeText(item.workflow_status || item.status)}</div>
        <div><strong>Priority:</strong> ${safeText(item.priority)}</div>
      </div>
    </div>
  `;
  modal.classList.add("active");
}

function closeModal() {
  const modal = document.getElementById("complaintModal");
  if (modal) modal.classList.remove("active");
}

function renderEdgeCases() {
  const metaphors = processedComplaints.filter((c) => c.flags?.metaphor).slice(0, 25);
  const speculation = processedComplaints.filter((c) => c.flags?.speculation).slice(0, 25);
  const mismatches = processedComplaints.filter((c) => c.flags?.mismatch).slice(0, 25);
  const alerts = processedComplaints.filter((c) => c.flags?.emergency).slice(0, 25);

  const setCount = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };
  setCount("metaphorCount", metaphors.length);
  setCount("speculationCount", speculation.length);
  setCount("mismatchCount", mismatches.length);
  setCount("alertCount", alerts.length);

  const renderList = (id, items) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (items.length === 0) {
      el.innerHTML = `<div style="color:var(--gray-600);padding:10px;">No results</div>`;
      return;
    }
    el.innerHTML = items
      .map(
        (c) => `<div class="edge-case-item" data-id="${safeText(c.id)}">
          <div style="font-weight:900;">${safeText(c.subcategory || c.category)}</div>
          <div style="color:var(--gray-600);font-size:12px;">${safeText(c.description).slice(0, 90)}</div>
        </div>`
      )
      .join("");

    el.querySelectorAll(".edge-case-item").forEach((node) => {
      node.addEventListener("click", () => {
        const id = node.getAttribute("data-id");
        const found = processedComplaints.find((x) => safeText(x.id) === safeText(id));
        if (found) openModal(found);
      });
    });
  };

  renderList("metaphorList", metaphors);
  renderList("speculationList", speculation);
  renderList("mismatchList", mismatches);
  renderList("alertList", alerts);
}

function applyFilters() {
  const search = safeText(document.getElementById("searchInput")?.value).toLowerCase();
  const tierFilter = safeText(document.getElementById("tierFilter")?.value);
  const categoryFilter = safeText(document.getElementById("categoryFilter")?.value);
  const typeFilter = safeText(document.getElementById("filterType")?.value);

  filteredComplaints = processedComplaints.filter((c) => {
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

  filteredComplaints.sort((a, b) => {
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

  const totalPages = Math.max(1, Math.ceil(filteredComplaints.length / itemsPerPage));
  const start = (currentPage - 1) * itemsPerPage;
  const pageItems = filteredComplaints.slice(start, start + itemsPerPage);

  tbody.innerHTML = pageItems
    .map((c) => {
      const flags = [
        c.flags?.emergency ? "Emergency" : null,
        c.flags?.metaphor ? "Metaphor" : null,
        c.flags?.speculation ? "Conditional" : null,
      ].filter(Boolean);
      return `<tr data-id="${safeText(c.id)}">
        <td>${safeText(c.id).slice(0, 8)}</td>
        <td>${safeText(c.subcategory || c.category)}</td>
        <td>${safeText(c.barangay)}</td>
        <td><strong>${Math.round(c.triage_score || 0)}</strong></td>
        <td>${safeText(c.description).slice(0, 120)}</td>
        <td style="color:var(--gray-600);">${flags.join(", ")}</td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.getAttribute("data-id");
      const found = processedComplaints.find((x) => safeText(x.id) === safeText(id));
      if (found) openModal(found);
    });
  });

  const info = document.getElementById("pageInfo");
  if (info) info.textContent = `Page ${currentPage} / ${totalPages} (${filteredComplaints.length} records)`;
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
    const totalPages = Math.max(1, Math.ceil(filteredComplaints.length / itemsPerPage));
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

  document.getElementById("presentBtn")?.addEventListener("click", startPresentation);
  document.getElementById("prevSlide")?.addEventListener("click", prevSlide);
  document.getElementById("nextSlide")?.addEventListener("click", nextSlide);
  document.getElementById("exitPresentation")?.addEventListener("click", exitPresentation);

  document.querySelectorAll(".nav-tab[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      if (!tabId) return;
      document.querySelectorAll(".nav-tab[data-tab]").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(tabId)?.classList.add("active");
      
      // Auto-render logic for specific tabs
      if (tabId === 'tab-smart-detection') {
        renderEdgeCases();
      }
      
      if (history && typeof history.replaceState === "function") {
        history.replaceState(null, "", `#${tabId}`);
      } else {
        window.location.hash = `#${tabId}`;
      }
    });
  });

  // --- SMART DETECTION RENDERER (EDGE CASES) ---
  function renderEdgeCases() {
    const list = document.getElementById('edge-cases-list');
    
    if (!list) return;
    
    // Find "Edge Cases" from processedComplaints
    const edgeCases = processedComplaints.filter(c => {
        const hasMetaphor = c.intelligence && c.intelligence.metaphor_score > 0.7;
        const isSpeculation = c.intelligence && c.intelligence.is_speculation;
        const mismatch = c.intelligence && c.intelligence.category_mismatch;
        const highRiskUnsure = c.intelligence && c.intelligence.sentiment_score < -0.7 && c.intelligence.confidence < 0.6;
        
        return hasMetaphor || isSpeculation || mismatch || highRiskUnsure;
    });

    if (edgeCases.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding: 40px; color: var(--gray-500); grid-column: 1 / -1;">
                <i class="fas fa-check-circle" style="font-size: 48px; margin-bottom: 16px; color: var(--success);"></i>
                <h3>No Anomalies Detected</h3>
                <p>The system hasn't found any significant edge cases or anomalies in the current dataset.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = edgeCases.map(c => `
        <div class="edge-case-card" onclick="openComplaintModal('${c.id}')">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <span class="badge ${c.intelligence.category_mismatch ? 'badge-mismatch' : 'badge-keyword'}">
                    ${c.category}
                </span>
                <span style="font-size:12px; color:var(--gray-500);">${new Date(c.timestamp).toLocaleDateString()}</span>
            </div>
            <p style="margin:0 0 10px; font-size:14px; line-height:1.5;">"${c.original_text}"</p>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                ${c.intelligence.metaphor_score > 0.7 ? '<span class="badge badge-metaphor">Metaphor</span>' : ''}
                ${c.intelligence.is_speculation ? '<span class="badge badge-speculation">Speculation</span>' : ''}
                ${c.intelligence.category_mismatch ? '<span class="badge badge-warning">Mismatch</span>' : ''}
            </div>
        </div>
    `).join('');
  }

  const initialHash = (window.location.hash || "").replace("#", "").trim();
  if (initialHash) {
    const initialBtn = document.querySelector(`.nav-tab[data-tab="${initialHash}"]`);
    const initialSection = document.getElementById(initialHash);
    if (initialBtn && initialSection) {
      document.querySelectorAll(".nav-tab[data-tab]").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      initialBtn.classList.add("active");
      initialSection.classList.add("active");
      // Auto-render if initial load is edge cases
      if (initialHash === 'tab-smart-detection') renderEdgeCases();
    }
  }
}

function exportToCSV() {
  const rows = filteredComplaints.length ? filteredComplaints : processedComplaints;
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

let currentSlide = 0;
const slides = [
  "overview",
  "temporal",
  "categories",
  "edge-cases",
  "data-table",
  "system-training",
  "dictionary-manager",
];

function showSlide(idx) {
  const overlay = document.getElementById("presentationOverlay");
  const content = document.getElementById("presentationContent");
  if (!overlay || !content) return;
  const indicator = document.getElementById("slideIndicator");
  if (indicator) indicator.textContent = `${idx + 1} / ${slides.length}`;
  const id = slides[idx] || "overview";
  const section = document.getElementById(id);
  if (!section) return;
  content.innerHTML = "";
  const clone = section.cloneNode(true);
  clone.classList.add("active");
  clone.style.display = "block";
  clone.style.background = "transparent";
  content.appendChild(clone);
}

function startPresentation() {
  currentSlide = 0;
  document.getElementById("presentationOverlay")?.classList.add("active");
  showSlide(currentSlide);
}

function exitPresentation() {
  document.getElementById("presentationOverlay")?.classList.remove("active");
}

function prevSlide() {
  if (currentSlide <= 0) return;
  currentSlide -= 1;
  showSlide(currentSlide);
}

function nextSlide() {
  if (currentSlide >= slides.length - 1) return;
  currentSlide += 1;
  showSlide(currentSlide);
}

async function fetchComplaints() {
  const res = await fetch(API_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const arr = Array.isArray(json) ? json : Array.isArray(json?.complaints) ? json.complaints : [];
  return arr;
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
      if (rawComplaints.some((x) => safeText(x.id) === safeText(c.id))) return;
      rawComplaints = [c, ...rawComplaints];
      const processed = processComplaint(c);
      processedComplaints = [processed, ...processedComplaints];
      const stats = calcStats(processedComplaints);
      renderAll(stats);
      publishAnalyticsState();
    };
  } catch {
    return;
  }
}

function renderAll(stats) {
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
  const cats = [...new Set(processedComplaints.map((c) => safeText(c.subcategory || c.category)).filter(Boolean))].sort();
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
    setLoading(true, "Loading Complaints...", "Synchronizing datasets...");
    
    // Load NLP Dictionaries first
    if (typeof window.loadNLPDictionaries === 'function') {
      setLoading(true, "Initializing Brain...", "Loading NLP Dictionaries...");
      try {
        await window.loadNLPDictionaries();
        console.log('[ANALYTICS] NLP Dictionaries loaded successfully');
      } catch (err) {
        console.error('[ANALYTICS] Failed to load NLP Dictionaries:', err);
      }
    }

    await loadBarangayBoundaries();
    taxonomy = await loadTaxonomy();
    rawComplaints = await fetchComplaints();
    processedComplaints = rawComplaints.map(processComplaint);
    filteredComplaints = [...processedComplaints];
    const stats = calcStats(processedComplaints);
    setupListeners();
    renderAll(stats);
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
