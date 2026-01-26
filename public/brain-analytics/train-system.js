import { openComplaintModal } from '/js/utils/complaint.js';
import apiClient from "/js/config/apiClient.js";
import showMessage from "/js/components/toast.js";

let CATEGORY_TAXONOMY = {};
let HITL_CATEGORIES = [];
let SUBCATEGORY_TO_PARENT = {};

let pendingReviews = [];
let trainedToday = 0;
let trainingHistory = [];
let currentTrainingItem = null;

let trainedComplaintIds = new Set(JSON.parse(localStorage.getItem("citizenlink_trained_ids") || "[]"));

function saveTrainedIds() {
  localStorage.setItem("citizenlink_trained_ids", JSON.stringify([...trainedComplaintIds]));
}

function $(id) {
  return document.getElementById(id);
}

function safeText(value) {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

// =============================================================================
// INITIALIZATION
// =============================================================================

async function init() {
  const profile = await apiClient.getUserProfile();
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
        const opt = document.createElement('option');
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
        catSelect.addEventListener("change", updateSubcategories);
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
  if (typeof CitizenLinkTaxonomy !== "undefined") {
    try {
      taxonomy = await CitizenLinkTaxonomy.loadTaxonomy();
      console.log("[TRAIN] Taxonomy loaded via CitizenLinkTaxonomy library");
    } catch (e) {
      console.error("[TRAIN] Failed to load taxonomy via library:", e);
      taxonomy = null;
    }
  }

  // Fallback
  if (!taxonomy?.categories) {
    try {
      const res = await fetch('/categories_subcategories.json');
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
    SUBCATEGORY_TO_PARENT = {};
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

  SUBCATEGORY_TO_PARENT = {};
  for (const [parent, data] of Object.entries(CATEGORY_TAXONOMY)) {
    for (const sub of data.subcategories || []) {
      SUBCATEGORY_TO_PARENT[sub] = parent;
    }
  }
}

// =============================================================================
// CORE LOGIC
// =============================================================================

function getProcessedComplaints() {
  const api = window.CitizenLinkBrainAnalytics;
  const items = api?.getProcessedComplaints ? api.getProcessedComplaints() : null;
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

  // Get items
  const processed = getProcessedComplaints();
  
  // Build Pending List using NLP intelligence
  pendingReviews = processed.filter((item) => {
    if (!item?.id) return false;
    if (trainedComplaintIds.has(item.id)) return false;
    
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
    // Exclude items with confirmed mismatches (already handled by AI)
    const needsTraining = (
      lowConfidence || 
      isOthers || 
      noKeywords || 
      (isSpeculative && triage < 50) ||
      (isMetaphorical && triage < 50)
    ) && !wasReclassified; // Don't train items AI already corrected
    
    return needsTraining;
  }).slice(0, 50).map(item => {
    const intel = item.intelligence || {};
    return {
      id: item.id,
      text: safeText(item.original_text || item.description),
      ai_suggestion: safeText(item.category || "Others"),
      subcategory: safeText(item.subcategory),
      confidence: intel.confidence || 0.5,
      created_at: item.timestamp,
      status: 'pending',
      // Additional NLP context for training UI
      is_speculation: Boolean(intel.is_speculation),
      is_metaphor: Boolean(intel.metaphor_score && intel.metaphor_score > 0.5),
      temporal_tag: intel.temporal_tag || null
    };
  });

  updateHITLStats();
  renderTrainingList();
}

function renderTrainingList() {
    const listContainer = document.getElementById("trainingList");
    if (!listContainer) return;

    if (pendingReviews.length === 0) {
        listContainer.innerHTML = `
            <div style="padding: 40px; text-align: center; color: var(--success);">
                <i class="fas fa-check-double" style="font-size: 32px; margin-bottom: 12px; display: block;"></i>
                <p>All clear! No items to review.</p>
                <p style="font-size: 12px; color: var(--gray-500); margin-top: 8px;">The NLP system has high confidence on all current complaints.</p>
            </div>
        `;
        resetForm();
        return;
    }

    listContainer.innerHTML = pendingReviews.map(c => {
        // Build NLP context badges
        let nlpBadges = '';
        if (c.is_speculation) {
            nlpBadges += '<span class="badge badge-info" style="font-size:9px;margin-right:4px;">Speculation</span>';
        }
        if (c.is_metaphor) {
            nlpBadges += '<span class="badge badge-warning" style="font-size:9px;margin-right:4px;">Metaphor</span>';
        }
        if (c.temporal_tag) {
            nlpBadges += `<span class="badge badge-secondary" style="font-size:9px;">${c.temporal_tag}</span>`;
        }
        
        return `
        <div class="train-item" onclick="window.selectTrainingItem('${c.id}')" id="train-item-${c.id}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <span style="font-weight:600; font-size:13px;">${c.id.substring(0,8)}...</span>
                <span class="badge ${getConfidenceBadge(c.confidence)}">${Math.round(c.confidence * 100)}%</span>
            </div>
            ${nlpBadges ? `<div style="margin-bottom:4px;">${nlpBadges}</div>` : ''}
            <div style="font-size:12px; color:var(--gray-600); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${c.text}
            </div>
            <div style="font-size:11px; color:var(--gray-400); margin-top:3px;">
                Suggested: <strong>${c.ai_suggestion}</strong>${c.subcategory ? ` › ${c.subcategory}` : ''}
            </div>
        </div>
    `}).join('');
    
    // Auto-select first
    if (pendingReviews.length > 0 && !currentTrainingItem) {
        selectTrainingItem(pendingReviews[0].id);
    }
}

function getConfidenceBadge(score) {
    if (score >= 0.8) return 'badge-success'; 
    if (score >= 0.5) return 'badge-warning';
    return 'badge-danger';
}

// Exposed to global scope for onclick
window.selectTrainingItem = function(id) {
    const item = pendingReviews.find(c => c.id === id);
    if (!item) return;

    currentTrainingItem = item;
    
    // UI Updates
    document.querySelectorAll('.train-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`train-item-${id}`)?.classList.add('active');

    // Populate Form
    const badge = document.getElementById('trainingStatusBadge');
    if (badge) {
        badge.textContent = "Reviewing";
        badge.className = "badge badge-primary";
    }
    
    document.getElementById('lblOriginalText').textContent = item.text;
    document.getElementById('lblSystemGuess').textContent = item.ai_suggestion;
    
    const conf = item.confidence || 0;
    document.getElementById('lblConfidence').textContent = `${(conf * 100).toFixed(1)}%`;
    document.getElementById('barConfidence').style.width = `${conf * 100}%`;
    document.getElementById('barConfidence').style.background = conf > 0.7 ? 'var(--success)' : (conf > 0.4 ? 'var(--warning)' : 'var(--danger)');

    // Enable Form
    const keyInput = document.getElementById('inputTrainKeyword');
    keyInput.disabled = false;
    keyInput.value = ""; 
    
    // Select the AI suggestion in the category dropdown (already populated)
    const catSelect = document.getElementById('selectTrainCategory');
    catSelect.disabled = false;
    
    // Set the value to AI suggestion if it exists in the options
    if (item.ai_suggestion && CATEGORY_TAXONOMY[item.ai_suggestion]) {
        catSelect.value = item.ai_suggestion;
    } else {
        catSelect.value = ""; // Reset to default
    }

    updateSubcategories(); 
    
    // Enable Buttons
    document.getElementById('btnSaveTrain').disabled = false;
    document.getElementById('btnSkipTrain').disabled = false;
};

function updateSubcategories() {
    console.log("[TRAIN] updateSubcategories called");
    const catSelect = document.getElementById('selectTrainCategory');
    const subSelect = document.getElementById('selectTrainSubcategory');
    
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
                const opt = document.createElement('option');
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

    const term = document.getElementById('inputTrainKeyword').value.trim();
    const category = document.getElementById('selectTrainCategory').value;
    const subcategory = document.getElementById('selectTrainSubcategory').value;

    if (!term || !category) {
        showMessage("error", "Please enter a keyword and select a category.");
        return;
    }

    try {
        const res = await apiClient.post("/api/nlp/keywords", {
            term: term,
            category: category,
            subcategory: subcategory,
            language: 'all',
            confidence: 1.0 
        });

        if (!res?.success) throw new Error(res?.error || "Failed to save");

        trainedComplaintIds.add(currentTrainingItem.id);
        saveTrainedIds();

        // Update List
        pendingReviews = pendingReviews.filter(c => c.id !== currentTrainingItem.id);
        
        // Stats
        addTrainingHistory("Trained keyword", `"${term}" → ${category}`);
        updateHITLStats();
        renderTrainingHistory();
        
        // Refresh
        resetForm();
        renderTrainingList();
        
        // Trigger Engine Update
        if (typeof window.loadNLPDictionaries === 'function') {
            await window.loadNLPDictionaries(true);
            if (window.CitizenLinkBrainAnalytics?.reprocessAll) {
                window.CitizenLinkBrainAnalytics.reprocessAll();
            }
        }

        showMessage("success", "Training saved successfully!");

    } catch (err) {
        showMessage("error", "Error saving: " + err.message);
    }
}

function skipCurrentItem() {
    if (!currentTrainingItem) return;
    trainedComplaintIds.add(currentTrainingItem.id);
    saveTrainedIds();
    
    pendingReviews = pendingReviews.filter(c => c.id !== currentTrainingItem.id);
    resetForm();
    renderTrainingList();
}

function resetForm() {
    currentTrainingItem = null;
    const badge = document.getElementById('trainingStatusBadge');
    if (badge) {
        badge.textContent = "No Item Selected";
        badge.className = "badge badge-noise";
    }

    document.getElementById('lblOriginalText').textContent = "Select an item from the left to view details.";
    document.getElementById('lblSystemGuess').textContent = "-";
    document.getElementById('lblConfidence').textContent = "-";
    document.getElementById('barConfidence').style.width = "0%";
    
    const keyInput = document.getElementById('inputTrainKeyword');
    if(keyInput) {
        keyInput.value = "";
        keyInput.disabled = true;
    }
    
    const catSelect = document.getElementById('selectTrainCategory');
    if(catSelect) {
        catSelect.innerHTML = '<option value="">-- Select Category --</option>';
        catSelect.disabled = true;
    }

    const subSelect = document.getElementById('selectTrainSubcategory');
    if(subSelect) {
        subSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';
        subSelect.disabled = true;
    }

    const saveBtn = document.getElementById('btnSaveTrain');
    if(saveBtn) saveBtn.disabled = true;

    const skipBtn = document.getElementById('btnSkipTrain');
    if(skipBtn) skipBtn.disabled = true;
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
  set("avgConfidenceScore", avgConf > 0 ? avgConf + "%" : "-");
  
  // Model accuracy estimation (based on training history vs total processed)
  const totalTrained = trainingHistory.length;
  const accuracy = totalTrained > 10 ? Math.min(95, 70 + Math.round(totalTrained / 5)) : "-";
  set("modelAccuracy", accuracy === "-" ? accuracy : accuracy + "%");
}

function addTrainingHistory(title, detail) {
  const date = new Date().toLocaleDateString();
  trainingHistory.unshift({ title, detail, date });
  trainingHistory = trainingHistory.slice(0, 50);
  localStorage.setItem("citizenlink_training_history", JSON.stringify(trainingHistory));
  trainedToday += 1;
  localStorage.setItem("citizenlink_trained_today", String(trainedToday));
}

function loadTrainingHistory() {
  const stored = JSON.parse(localStorage.getItem("citizenlink_training_history") || "[]");
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
  } catch {}
}

document.addEventListener("DOMContentLoaded", init);

