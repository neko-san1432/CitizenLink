import apiClient from "/js/config/apiClient.js";
import showMessage from "/js/components/toast.js";

let CATEGORY_TAXONOMY = {};
let HITL_CATEGORIES = [];
// let SUBCATEGORY_TO_PARENT = {}; // Removed

let pendingReviews = [];
let trainedToday = 0;
let trainingHistory = [];
let currentTrainingItem = null;

const trainedcomplaintIds = new Set(JSON.parse(localStorage.getItem("DRIMS_trained_ids") || "[]"));

function saveTrainedIds() {
  localStorage.setItem("DRIMS_trained_ids", JSON.stringify([...trainedcomplaintIds]));
}

function $(id) {
  return document.getElementById(id);
}

// Global charts registry for training tab
const trainingCharts = {};

function destroyTrainingChart(id) {
  if (trainingCharts[id]) {
    trainingCharts[id].destroy();
    delete trainingCharts[id];
  }
}

function renderTrainingSparkline(canvasId, data, color) {
  const canvas = $(canvasId);
  if (!canvas) return;
  destroyTrainingChart(canvasId);

  trainingCharts[canvasId] = new Chart(canvas, {
    type: "line",
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data,
        borderColor: color,
        borderWidth: 2,
        tension: 0.5,
        pointRadius: 0,
        fill: true,
        backgroundColor: (context) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
          gradient.addColorStop(1, color.replace("1)", "0.1)"));
          return gradient;
        },
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } }
    }
  });
}

function safeText(value) {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

// =============================================================================
// INITIALIZATION
// =============================================================================

async function init() {
  const profile = await apiClient.getUserprofile();
  if (!profile?.success) {
    window.location.href = "/login";
    return;
  }

  await ensureHITLTaxonomyLoaded();
  loadTrainingHistory();
  renderTrainingHistory();
  await loadDictionaryStats();

  // Setup Event Listeners
  setupEventListeners();

  // Pre-populate category dropdown so it's ready even without items
  populateCategoryDropdown();

  updateHITLStats();
  renderImpactCharts();
}

function renderImpactCharts() {
  const mockHistory = Array.from({length: 12}, (_, i) => 50 + Math.sin(i * 0.5) * 10 + Math.random() * 5);
  renderTrainingSparkline("trainingConfidenceTrend", mockHistory, "#8b5cf6");
  renderTrainingSparkline("trainingAccuracyTrend", mockHistory.map(x => x + 5), "#10b981");

  const trainedCanvas = $("itemsTrainedChart");
  if (trainedCanvas) {
    destroyTrainingChart("itemsTrainedChart");
    trainingCharts["itemsTrainedChart"] = new Chart(trainedCanvas, {
      type: "doughnut",
      data: {
        labels: ["Trained", "Remaining"],
        datasets: [{
          data: [trainedToday, Math.max(1, pendingReviews.length)],
          backgroundColor: ["#8b5cf6", "rgba(255, 255, 255, 0.05)"],
          borderWidth: 0,
          cutout: "85%"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }
}

// Pre-populate category dropdown on page load
function populateCategoryDropdown() {
  const catSelect = $("selectTrainCategory");
  if (!catSelect) {
    console.warn("[TRAIN] Category select element not found for pre-population");
    return;
  }

  // Clear and add default option
  catSelect.innerHTML = '<option value="">-- Select Category --</option>';

  // Add all categories from taxonomy
  const categories = Object.keys(CATEGORY_TAXONOMY).sort();
  console.log("[TRAIN] Pre-populating categories:", categories);

  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    catSelect.appendChild(opt);
  });

  // Enable the dropdown (but keep it at default selection)
  catSelect.disabled = false;
}

function setupEventListeners() {
  $("refreshPendingBtn")?.addEventListener("click", loadLowConfidenceItems);
  $("fetchLowConfidenceBtn")?.addEventListener("click", loadLowConfidenceItems);
  $("btnSaveTrain")?.addEventListener("click", saveTrainingResult);
  $("btnSkipTrain")?.addEventListener("click", skipCurrentItem);

  // Category selection event - add robust handling
  const catSelect = $("selectTrainCategory");
  if (catSelect) {
    // catSelect.addEventListener("change", updateSubcategories); // Removed
    console.log("[TRAIN] Category select event listener attached");
  } else {
    console.warn("[TRAIN] selectTrainCategory element not found");
  }
}

// =============================================================================
// TAXONOMY LOADING
// =============================================================================

async function ensureHITLTaxonomyLoaded() {
  if (HITL_CATEGORIES.length > 0) {
    console.log("[TRAIN] Taxonomy already loaded:", HITL_CATEGORIES.length, "categories");
    return;
  }

  let taxonomy = null;
  if (typeof DRIMSTaxonomy !== "undefined") {
    try {
      taxonomy = await DRIMSTaxonomy.loadTaxonomy();
      console.log("[TRAIN] Taxonomy loaded via DRIMSTaxonomy library");
    } catch (e) {
      console.error("[TRAIN] Failed to load taxonomy via library:", e);
      taxonomy = null;
    }
  }

  // Fallback
  if (!taxonomy?.categories) {
    try {
      const res = await fetch("/assets/json/categoriesSubcategories.json");
      if (res.ok) {
        taxonomy = await res.json();
        console.log("[TRAIN] Taxonomy loaded via fallback fetch");
      }
    } catch (e) {
      console.error("[TRAIN] Fallback taxonomy fetch failed:", e);
    }
  }

  if (!taxonomy?.categories) {
    console.warn("[TRAIN] No taxonomy available, using default");
    CATEGORY_TAXONOMY = { Others: { subcategories: [] } };
    HITL_CATEGORIES = ["Others"];
    // SUBCATEGORY_TO_PARENT = {}; // Removed
    return;
  }

  CATEGORY_TAXONOMY = Object.fromEntries(
    Object.entries(taxonomy.categories).map(([parent, data]) => [
      parent,
      { subcategories: Array.isArray(data.subcategories) ? data.subcategories.slice() : [] },
    ])
  );
  HITL_CATEGORIES = Object.keys(CATEGORY_TAXONOMY);
  console.log("[TRAIN] Taxonomy loaded successfully:", HITL_CATEGORIES.length, "categories:", HITL_CATEGORIES);

  // SUBCATEGORY_TO_PARENT = {}; // Removed
  // Loop removed
  /*
  for (const [parent, data] of Object.entries(CATEGORY_TAXONOMY)) {
    for (const sub of data.subcategories || []) {
      SUBCATEGORY_TO_PARENT[sub] = parent;
    }
  }
  */
}

// =============================================================================
// CORE LOGIC
// =============================================================================

function getProcessedcomplaints() {
  const api = window.DRIMSBrainAnalytics;
  const items = api?.getProcessedcomplaints ? api.getProcessedcomplaints() : null;
  return Array.isArray(items) ? items : [];
}

async function loadLowConfidenceItems() {
  const listContainer = document.getElementById("trainingList");
  if (!listContainer) return;

  listContainer.innerHTML = `
    <div style="padding: 40px; text-align: center; color: var(--gray-500);">
        <i class="fas fa-spinner fa-spin" style="font-size: 24px; margin-bottom: 12px; display: block;"></i>
        <p>Scanning for low-confidence items...</p>
    </div>
  `;

  // HYBRID APPROACH: Fetch from both database queue AND in-memory processed complaints
  pendingReviews = [];

  // 1. First, try to fetch from database (HITL Auto-Queue)
  try {
    console.log("[TRAIN] Fetching from /api/nlp/pending-reviews...");
    const dbRes = await apiClient.get("/api/nlp/pending-reviews");
    console.log("[TRAIN] API Response:", dbRes);

    if (dbRes?.success && Array.isArray(dbRes.data)) {
      const dbItems = dbRes.data.map(item => ({
        id: item.id,
        complaint_id: item.complaint_id,
        text: safeText(item.text),
        ai_suggestion: safeText(item.detected_category || "Others"),
        // subcategory: safeText(item.detected_subcategory), // Removed
        confidence: item.confidence || 0,
        created_at: item.created_at,
        status: item.status || "pending",
        method: item.method || "UNKNOWN",
        matched_term: item.matched_term,
        source: "database" // Track source for UI differentiation
      })).filter(item => !trainedcomplaintIds.has(item.id));

      pendingReviews.push(...dbItems);
      console.log(`[TRAIN] ✅ Fetched ${dbItems.length} items from database queue`);
    } else {
      console.log("[TRAIN] Database queue returned empty or error:", dbRes?.error || "No data");
    }
  } catch (err) {
    console.error("[TRAIN] ❌ Could not fetch from database queue:", err);
  }

  // 2. Also scan in-memory processed complaints (legacy behavior)
  const processed = getProcessedcomplaints();
  console.log(`[TRAIN] In-memory processed complaints available: ${processed.length}`);

  const memoryItems = processed.filter((item) => {
    if (!item?.id) return false;
    if (trainedcomplaintIds.has(item.id)) return false;
    // Don't duplicate items already in database queue
    if (pendingReviews.some(p => p.complaint_id === item.id)) return false;

    const triage = Number(item?.triage_score ?? item?.triage?.score ?? 0);
    const isOthers = safeText(item?.category) === "Others" || safeText(item?.subcategory) === "Others";
    const keywords = Array.isArray(item?.keywords) ? item.keywords : Array.isArray(item?.nlp?.keywords) ? item.nlp.keywords : [];
    const noKeywords = keywords.length === 0;

    // Use NLP intelligence for better detection
    const intel = item.intelligence || {};
    const lowConfidence = intel.confidence && intel.confidence < 0.6;
    const hasMismatch = Boolean(item?.category_mismatch?.has_mismatch) || Boolean(intel.category_mismatch);
    const isSpeculative = Boolean(intel.is_speculation) || Boolean(item?.flags?.speculation);
    const isMetaphorical = Boolean(intel.metaphor_score && intel.metaphor_score > 0.5) || Boolean(item?.flags?.metaphor);
    const wasReclassified = Boolean(intel.ai_reclassified) || Boolean(intel.ai_downgraded);

    // Training candidates: Low confidence, Others category, No keywords, Speculative, or Reclassified
    const needsTraining = (
      lowConfidence ||
      isOthers ||
      noKeywords ||
      (isSpeculative && triage < 50) ||
      (isMetaphorical && triage < 50)
    ) && !wasReclassified;

    return needsTraining;
  }).slice(0, 30).map(item => {
    const intel = item.intelligence || {};
    return {
      id: item.id,
      text: safeText(item.original_text || item.description),
      ai_suggestion: safeText(item.category || "Others"),
      // subcategory: safeText(item.subcategory), // Removed
      confidence: intel.confidence || 0.5,
      created_at: item.timestamp,
      status: "pending",
      is_speculation: Boolean(intel.is_speculation),
      is_metaphor: Boolean(intel.metaphor_score && intel.metaphor_score > 0.5),
      temporal_tag: intel.temporal_tag || null,
      source: "memory" // Track source
    };
  });

  pendingReviews.push(...memoryItems);
  console.log(`[TRAIN] Total pending reviews: ${pendingReviews.length} (${pendingReviews.filter(p => p.source === "database").length} from DB, ${pendingReviews.filter(p => p.source === "memory").length} from memory)`);

  updateHITLStats();
  renderTrainingList();
}

function renderTrainingList() {
  const listContainer = document.getElementById("trainingList");
  if (!listContainer) return;

  if (pendingReviews.length === 0) {
    listContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center p-8 opacity-60">
                <div class="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/5">
                    <i class="fas fa-inbox-full text-3xl text-gray-500"></i>
                </div>
                <h4 class="text-lg font-bold text-white mb-1">All caught up! 🎉</h4>
                <p class="text-xs text-gray-500">There are no complaints pending review.</p>
            </div>
        `;
    resetForm();
    return;
  }

  listContainer.innerHTML = pendingReviews.map(c => {
    return `
        <div class="glass-card p-4 rounded-xl cursor-pointer hover:bg-white/5 transition-all border border-white/5 group ${currentTrainingItem?.id === c.id ? 'bg-white/10 border-purple-500/50' : ''}" 
             onclick="window.selectTrainingItem('${c.id}')" id="train-item-${c.id}">
            <div class="flex justify-between items-center mb-2">
                <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">${c.id.substring(0, 8)}</span>
                <span class="text-[9px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20 font-bold uppercase">${c.method || 'NLP'}</span>
            </div>
            <div class="text-xs text-gray-300 line-clamp-2 mb-3 leading-relaxed">
                ${c.text}
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-white/5">
                <span class="text-[9px] text-gray-500 font-bold uppercase">Predicted</span>
                <span class="text-[10px] text-purple-400 font-black">${c.ai_suggestion}</span>
            </div>
        </div>
    `;}).join("");

  // Auto-select first
  if (pendingReviews.length > 0 && !currentTrainingItem) {
    selectTrainingItem(pendingReviews[0].id);
  }
}

function getConfidenceBadge(score) {
  if (score >= 0.8) return "badge-success";
  if (score >= 0.5) return "badge-warning";
  return "badge-danger";
}

// Exposed to global scope for onclick
window.selectTrainingItem = function (id) {
  const item = pendingReviews.find(c => c.id === id);
  if (!item) return;

  currentTrainingItem = item;

  // UI Updates
  document.querySelectorAll("[id^='train-item-']").forEach(el => {
    el.classList.remove("bg-white/10", "border-purple-500/50");
    el.classList.add("border-white/5");
  });
  const activeEl = document.getElementById(`train-item-${id}`);
  if (activeEl) {
    activeEl.classList.remove("border-white/5");
    activeEl.classList.add("bg-white/10", "border-purple-500/50");
  }

  // Update step indicators
  updateTrainingSteps(2);

  document.getElementById("lblOriginalText").classList.remove("italic", "text-gray-400");
  document.getElementById("lblOriginalText").classList.add("text-white", "font-medium");
  document.getElementById("lblOriginalText").textContent = item.text;

  // Enable Form
  const keyInput = document.getElementById("inputTrainKeyword");
  keyInput.disabled = false;
  keyInput.value = "";
  keyInput.focus();
  
  keyInput.addEventListener('input', () => {
    if (keyInput.value.trim().length > 2) updateTrainingSteps(3);
  });

  // Populate and select the AI suggestion in the category dropdown
  const catSelect = document.getElementById("selectTrainCategory");
  catSelect.innerHTML = '<option value="">-- Select Category --</option>';

  // Add all categories from taxonomy
  const categories = Object.keys(CATEGORY_TAXONOMY).sort();
  categories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    catSelect.appendChild(opt);
  });

  catSelect.disabled = false;
  catSelect.addEventListener('change', () => {
    if (catSelect.value) updateTrainingSteps(4);
  });

  // Set the value to AI suggestion if it exists in the options
  if (item.ai_suggestion && CATEGORY_TAXONOMY[item.ai_suggestion]) {
    catSelect.value = item.ai_suggestion;
  } else {
    catSelect.value = ""; // Reset to default
  }

  // Enable Buttons
  document.getElementById("btnSaveTrain").disabled = false;
  document.getElementById("btnSaveTrain").classList.remove("bg-purple-600/20", "text-purple-400");
  document.getElementById("btnSaveTrain").classList.add("bg-purple-600", "text-white");
  document.getElementById("btnSkipTrain").disabled = false;
};

function updateTrainingSteps(activeStep) {
  const steps = document.querySelectorAll("#system-training .bg-white\/\\[0\\.02\\] > div");
  steps.forEach((step, i) => {
    const stepNum = i + 1;
    const circle = step.querySelector("div:first-child");
    if (stepNum < activeStep) {
      // Completed
      step.classList.remove("opacity-40");
      step.classList.add("opacity-100");
      circle.classList.remove("bg-purple-600", "bg-white/10", "shadow-[0_0_15px_rgba(147,51,234,0.5)]");
      circle.classList.add("bg-emerald-500");
      circle.innerHTML = '<i class="fas fa-check"></i>';
    } else if (stepNum === activeStep) {
      // Active
      step.classList.remove("opacity-40");
      step.classList.add("opacity-100");
      circle.classList.remove("bg-white/10", "bg-emerald-500");
      circle.classList.add("bg-purple-600", "shadow-[0_0_15px_rgba(147,51,234,0.5)]");
      circle.innerHTML = stepNum;
    } else {
      // Future
      step.classList.add("opacity-40");
      step.classList.remove("opacity-100");
      circle.classList.remove("bg-purple-600", "bg-emerald-500", "shadow-[0_0_15px_rgba(147,51,234,0.5)]");
      circle.classList.add("bg-white/10");
      circle.innerHTML = stepNum;
    }
  });
}

function updateSubcategories() {
  console.log("[TRAIN] updateSubcategories called");
  const catSelect = document.getElementById("selectTrainCategory");
  const subSelect = document.getElementById("selectTrainSubcategory");

  if (!catSelect || !subSelect) {
    console.warn("[TRAIN] Select elements not found");
    return;
  }

  const selectedCat = catSelect.value;
  console.log("[TRAIN] Selected category:", selectedCat, "| Available:", Object.keys(CATEGORY_TAXONOMY));

  subSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';
  subSelect.disabled = true;

  if (selectedCat && CATEGORY_TAXONOMY[selectedCat]) {
    const subs = CATEGORY_TAXONOMY[selectedCat].subcategories || [];
    console.log("[TRAIN] Subcategories for", selectedCat, ":", subs);
    if (subs.length > 0) {
      subSelect.disabled = false;
      subs.forEach(sub => {
        const opt = document.createElement("option");
        opt.value = sub;
        opt.textContent = sub;
        if (currentTrainingItem && sub === currentTrainingItem.subcategory) {
          opt.selected = true;
        }
        subSelect.appendChild(opt);
      });
    }
  }
}

async function saveTrainingResult() {
  if (!currentTrainingItem) return;

  const term = document.getElementById("inputTrainKeyword").value.trim();
  const category = document.getElementById("selectTrainCategory").value;
  // const subcategory = document.getElementById('selectTrainSubcategory').value; // Removed

  if (!term || !category) {
    showMessage("error", "Please enter a keyword and select a category.");
    return;
  }

  try {
    let autoResolved = 0;

    // If item is from database queue, use the resolve endpoint
    if (currentTrainingItem.source === "database") {
      const res = await apiClient.post(`/api/nlp/pending-reviews/${currentTrainingItem.id}/resolve`, {
        keyword: term,
        category,
        // subcategory: subcategory // Removed
      });

      if (!res?.success) throw new Error(res?.error || "Failed to resolve");
      autoResolved = res.autoResolved || 0;
      console.log("[TRAIN] Resolved database queue item:", currentTrainingItem.id, autoResolved > 0 ? `(+${autoResolved} auto-resolved)` : "");
    } else {
      // Legacy behavior: direct keyword add for memory items
      const res = await apiClient.post("/api/nlp/keywords", {
        term,
        category,
        // subcategory: subcategory, // Removed
        language: "all",
        confidence: 1.0
      });

      if (!res?.success) throw new Error(res?.error || "Failed to save");
    }

    trainedcomplaintIds.add(currentTrainingItem.id);
    saveTrainedIds();

    // If auto-resolved others, also add their IDs and remove from list
    if (autoResolved > 0) {
      // Reload the list to reflect auto-resolved items
      await loadLowConfidenceItems();
      showMessage("success", `Trained "${term}" → ${category}. Also auto-resolved ${autoResolved} similar complaints!`);
    } else {
      // Update List
      pendingReviews = pendingReviews.filter(c => c.id !== currentTrainingItem.id);
      showMessage("success", "Training saved successfully!");
    }

    // Stats
    addTrainingHistory("Trained keyword", `"${term}" → ${category}${autoResolved > 0 ? ` (+${autoResolved} auto)` : ""}`);
    updateHITLStats();
    renderTrainingHistory();

    // Refresh
    resetForm();
    renderTrainingList();

    // Trigger Engine Update
    if (typeof window.loadNLPDictionaries === "function") {
      await window.loadNLPDictionaries(true);
      if (window.DRIMSBrainAnalytics?.reprocessAll) {
        window.DRIMSBrainAnalytics.reprocessAll();
      }
    }

    showMessage("success", "Training saved successfully!");

  } catch (err) {
    showMessage("error", `Error saving: ${  err.message}`);
  }
}

async function skipCurrentItem() {
  if (!currentTrainingItem) return;

  // If item is from database queue, use dismiss endpoint
  if (currentTrainingItem.source === "database") {
    try {
      await apiClient.post(`/api/nlp/pending-reviews/${currentTrainingItem.id}/dismiss`);
      console.log("[TRAIN] Dismissed database queue item:", currentTrainingItem.id);
    } catch (err) {
      console.warn("[TRAIN] Failed to dismiss from database:", err.message);
    }
  }

  trainedcomplaintIds.add(currentTrainingItem.id);
  saveTrainedIds();

  pendingReviews = pendingReviews.filter(c => c.id !== currentTrainingItem.id);
  resetForm();
  renderTrainingList();
}

function resetForm() {
  currentTrainingItem = null;
  updateTrainingSteps(1);

  const lbl = document.getElementById("lblOriginalText");
  if (lbl) {
    lbl.textContent = "Select an item from the left to view details";
    lbl.classList.add("italic", "text-gray-400");
    lbl.classList.remove("text-white", "font-medium");
  }

  const keyInput = document.getElementById("inputTrainKeyword");
  if (keyInput) {
    keyInput.value = "";
    keyInput.disabled = true;
  }

  const catSelect = document.getElementById("selectTrainCategory");
  if (catSelect) {
    catSelect.value = "";
    catSelect.disabled = true;
  }

  const subSelect = document.getElementById("selectTrainSubcategory");
  if (subSelect) {
    subSelect.disabled = true;
  }

  const saveBtn = document.getElementById("btnSaveTrain");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.classList.add("bg-purple-600/20", "text-purple-400");
    saveBtn.classList.remove("bg-purple-600", "text-white");
  }

  const skipBtn = document.getElementById("btnSkipTrain");
  if (skipBtn) skipBtn.disabled = true;
}

// Stats & History Helpers
function updateHITLStats() {
  const set = (id, val) => {
    const el = $(id);
    if (el) el.textContent = val;
  };

  // Update pending review counts (both legacy and new element IDs)
  set("pendingReviewCount", String(pendingReviews.length));
  set("pendingTrainCount", String(pendingReviews.length));

  // Update trained today counts
  set("trainedCount", String(trainedToday));
  set("trainedTodayCount", String(trainedToday));

  // Calculate average confidence from pending items
  let totalConf = 0;
  let confCount = 0;
  for (const item of pendingReviews) {
    const conf = item.intelligence?.confidence || item.nlp_result?.confidence || 0;
    if (conf > 0) {
      totalConf += conf;
      confCount++;
    }
  }
  const avgConf = confCount > 0 ? Math.round((totalConf / confCount) * 100) : 0;
  set("avgConfidenceScore", avgConf > 0 ? `${avgConf  }%` : "-");

  // Model accuracy estimation
  const totalTrained = trainingHistory.length;
  const accuracy = totalTrained > 10 ? Math.min(95, 70 + Math.round(totalTrained / 5)) : "--";
  set("modelAccuracy", accuracy === "--" ? accuracy : `${accuracy}%`);

  // Progress Bar
  const progress = Math.min(100, Math.round((trainedToday / 20) * 100)); // Target 20 a day
  const progressBar = document.querySelector("#system-training .bg-purple-500.h-full");
  if (progressBar) progressBar.style.width = `${progress}%`;
  const progressText = progressBar?.parentElement?.previousElementSibling;
  if (progressText) progressText.textContent = `${progress}%`;

  renderImpactCharts();
}

function addTrainingHistory(title, detail) {
  const date = new Date().toLocaleDateString();
  trainingHistory.unshift({ title, detail, date });
  trainingHistory = trainingHistory.slice(0, 50);
  localStorage.setItem("DRIMS_training_history", JSON.stringify(trainingHistory));
  trainedToday += 1;
  localStorage.setItem("DRIMS_trained_today", String(trainedToday));
}

function loadTrainingHistory() {
  const stored = JSON.parse(localStorage.getItem("DRIMS_training_history") || "[]");
  trainingHistory = Array.isArray(stored) ? stored : [];
  const today = new Date().toLocaleDateString();
  // Simple check for today's count
  trainedToday = trainingHistory.filter((x) => x?.date === today).length;
}

function renderTrainingHistory() {
  const root = $("trainingHistoryList");
  if (!root) return;
  if (!trainingHistory.length) {
    root.innerHTML = `<p style="color: var(--gray-500); padding: 20px; text-align: center;">No training actions yet.</p>`;
    return;
  }
  root.innerHTML = trainingHistory.slice(0, 10).map(item => `
      <div style="padding: 10px; border-bottom: 1px solid var(--gray-200);">
        <div style="font-weight: 600; font-size: 13px;">${item.title}</div>
        <div style="color: var(--gray-600); font-size: 12px;">${item.detail}</div>
        <div style="color: var(--gray-400); font-size: 11px; margin-top: 2px;">${item.date}</div>
      </div>
  `).join("");
}

async function loadDictionaryStats() {
  try {
    const response = await apiClient.get("/api/nlp/management/stats");
    if (response?.success) {
      const sizeEl = $("dictionarySize");
      if (sizeEl) sizeEl.textContent = Number(response.data?.keywords ?? 0).toLocaleString();
    }
  } catch { }
}

document.addEventListener("DOMContentLoaded", init);

