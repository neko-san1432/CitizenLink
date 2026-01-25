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

  updateHITLStats();
}

function setupEventListeners() {
    $("refreshPendingBtn")?.addEventListener("click", loadLowConfidenceItems);
    $("fetchLowConfidenceBtn")?.addEventListener("click", loadLowConfidenceItems);
    $("btnSaveTrain")?.addEventListener("click", saveTrainingResult);
    $("btnSkipTrain")?.addEventListener("click", skipCurrentItem);
    $("selectTrainCategory")?.addEventListener("change", updateSubcategories);
}

// =============================================================================
// TAXONOMY LOADING
// =============================================================================

async function ensureHITLTaxonomyLoaded() {
  if (HITL_CATEGORIES.length > 0) return;
  
  let taxonomy = null;
  if (typeof CitizenLinkTaxonomy !== "undefined") {
    try {
      taxonomy = await CitizenLinkTaxonomy.loadTaxonomy();
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
      }
    } catch (e) {
      console.error("[TRAIN] Fallback taxonomy fetch failed:", e);
    }
  }

  if (!taxonomy?.categories) {
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
  
  // Build Pending List
  pendingReviews = processed.filter((item) => {
    if (!item?.id) return false;
    if (trainedComplaintIds.has(item.id)) return false;
    const triage = Number(item?.triage_score ?? item?.triage?.score ?? 0);
    const isOthers = safeText(item?.category) === "Others" || safeText(item?.subcategory) === "Others";
    const keywords = Array.isArray(item?.keywords) ? item.keywords : Array.isArray(item?.nlp?.keywords) ? item.nlp.keywords : [];
    const noKeywords = keywords.length === 0;
    const mismatch = Boolean(item?.category_mismatch?.has_mismatch);
    
    // Logic: Low triage score (low confidence usually correlates), or Others, or No Keywords
    return (triage < 30 || isOthers || noKeywords) && !mismatch;
  }).slice(0, 50).map(item => ({
      id: item.id,
      text: safeText(item.original_text || item.description),
      ai_suggestion: safeText(item.category || "Others"),
      subcategory: safeText(item.subcategory),
      confidence: (item.intelligence?.confidence || 0.5),
      created_at: item.timestamp,
      status: 'pending'
  }));

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
            </div>
        `;
        resetForm();
        return;
    }

    listContainer.innerHTML = pendingReviews.map(c => `
        <div class="train-item" onclick="window.selectTrainingItem('${c.id}')" id="train-item-${c.id}">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span style="font-weight:600; font-size:13px;">${c.id.substring(0,8)}...</span>
                <span class="badge ${getConfidenceBadge(c.confidence)}">${Math.round(c.confidence * 100)}%</span>
            </div>
            <div style="font-size:12px; color:var(--gray-600); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${c.text}
            </div>
        </div>
    `).join('');
    
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
    
    const catSelect = document.getElementById('selectTrainCategory');
    catSelect.disabled = false;
    catSelect.innerHTML = '<option value="">-- Select Category --</option>';
    
    // Populate Categories
    Object.keys(CATEGORY_TAXONOMY).sort().forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        if (cat === item.ai_suggestion) opt.selected = true;
        catSelect.appendChild(opt);
    });

    updateSubcategories(); 
    
    // Enable Buttons
    document.getElementById('btnSaveTrain').disabled = false;
    document.getElementById('btnSkipTrain').disabled = false;
};

function updateSubcategories() {
    const catSelect = document.getElementById('selectTrainCategory');
    const subSelect = document.getElementById('selectTrainSubcategory');
    const selectedCat = catSelect.value;
    
    subSelect.innerHTML = '<option value="">-- Select Subcategory --</option>';
    subSelect.disabled = true;

    if (selectedCat && CATEGORY_TAXONOMY[selectedCat]) {
        const subs = CATEGORY_TAXONOMY[selectedCat].subcategories || [];
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
  const pendingEl = $("pendingReviewCount");
  const trainedEl = $("trainedCount");
  if (pendingEl) pendingEl.textContent = String(pendingReviews.length);
  if (trainedEl) trainedEl.textContent = String(trainedToday);
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

