import apiClient from "/js/config/apiClient.js";
import showMessage from "/js/components/toast.js";

let CATEGORY_TAXONOMY = {};
let HITL_CATEGORIES = [];
let SUBCATEGORY_TO_PARENT = {};

let pendingReviews = [];
let trainedToday = 0;
let trainingHistory = [];

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

function escapeHtml(text) {
  return safeText(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function debounce(fn, wait) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

async function ensureHITLTaxonomyLoaded() {
  if (HITL_CATEGORIES.length > 0) return;
  let taxonomy = null;
  if (typeof CitizenLinkTaxonomy !== "undefined") {
    try {
      taxonomy = await CitizenLinkTaxonomy.loadTaxonomy();
    } catch {
      taxonomy = null;
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

function getProcessedComplaints() {
  const api = window.CitizenLinkBrainAnalytics;
  const items = api?.getProcessedComplaints ? api.getProcessedComplaints() : null;
  return Array.isArray(items) ? items : [];
}

function extractSuggestedKeyword(text) {
  if (!text) return "";
  const stopWords = [
    "ang",
    "mga",
    "dito",
    "yung",
    "nang",
    "lang",
    "nung",
    "para",
    "kasi",
    "pero",
    "kung",
    "sana",
    "paki",
    "pong",
    "yun",
    "din",
    "rin",
    "na",
    "sa",
    "ng",
    "ni",
    "si",
    "the",
    "this",
    "that",
    "here",
    "there",
    "with",
    "from",
    "have",
    "been",
    "would",
    "could",
    "should",
    "about",
    "please",
    "help",
    "need",
    "want",
    "very",
    "just",
    "also",
    "some",
    "when",
    "what",
    "where",
    "which",
  ];
  const words = safeText(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/);
  const keyword = words.find((w) => w.length > 3 && !stopWords.includes(w));
  return keyword || "";
}

function buildPendingFromProcessed(processed, limit = 200) {
  const lowConfidenceItems = processed.filter((item) => {
    if (!item?.id) return false;
    if (trainedComplaintIds.has(item.id)) return false;
    const triage = Number(item?.triage_score ?? item?.triage?.score ?? 0);
    const isOthers =
      safeText(item?.category) === "Others" || safeText(item?.subcategory) === "Others";
    const keywords = Array.isArray(item?.keywords) ? item.keywords : Array.isArray(item?.nlp?.keywords) ? item.nlp.keywords : [];
    const noKeywords = keywords.length === 0;
    const mismatch = Boolean(item?.category_mismatch?.has_mismatch);
    return (triage < 30 || isOthers || noKeywords) && !mismatch;
  });

  lowConfidenceItems.sort((a, b) => {
    const ta = new Date(a?.timestamp || a?.created_at || 0).getTime();
    const tb = new Date(b?.timestamp || b?.created_at || 0).getTime();
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });

  return lowConfidenceItems.slice(0, limit).map((item) => {
    const keywords = Array.isArray(item?.keywords) ? item.keywords : Array.isArray(item?.nlp?.keywords) ? item.nlp.keywords : [];
    const keywordTerms = keywords.map((k) => (typeof k === "string" ? k : k?.term)).filter(Boolean);
    const triage = Number(item?.triage_score ?? item?.triage?.score ?? 0);
    return {
      id: `LOCAL-${item.id}`,
      complaint_id: item.id,
      text: safeText(item.description),
      ai_suggestion: safeText(item?.nlp?.category_detected || item.subcategory || item.category || "Others"),
      confidence: triage / 100,
      created_at: item.timestamp || item.created_at || new Date().toISOString(),
      status: "pending",
      keywords_found: keywordTerms,
    };
  });
}

async function loadDictionaryStats() {
  try {
    const response = await apiClient.get("/api/nlp/management/stats");
    if (response?.success) {
      const sizeEl = $("dictionarySize");
      if (sizeEl) sizeEl.textContent = Number(response.data?.keywords ?? 0).toLocaleString();
      return;
    }
  } catch {}
  const sizeEl = $("dictionarySize");
  if (sizeEl) sizeEl.textContent = "-";
}

function updateHITLStats() {
  const pendingEl = $("pendingReviewCount");
  const trainedEl = $("trainedCount");
  if (pendingEl) pendingEl.textContent = String(pendingReviews.length);
  if (trainedEl) trainedEl.textContent = String(trainedToday);
}

function renderTrainingHistory() {
  const root = $("trainingHistoryList");
  if (!root) return;
  if (!trainingHistory.length) {
    root.innerHTML = `<p style="color: var(--gray-500); padding: 20px; text-align: center;">No training actions yet.</p>`;
    return;
  }

  root.innerHTML = trainingHistory
    .slice(0, 12)
    .map((item) => {
      return `<div class="alert-ticker-item">
        <div style="flex:1;">
          <div style="font-weight:700;">${escapeHtml(item.title)}</div>
          <div style="color: var(--gray-600); font-size: 12px;">${escapeHtml(item.detail)}</div>
        </div>
        <div style="color: var(--gray-500); font-size: 12px;">${escapeHtml(item.date)}</div>
      </div>`;
    })
    .join("");
}

function renderTrainingTable() {
  const tbody = $("trainingTableBody");
  if (!tbody) return;

  const searchQuery = $("trainingSearchInput")?.value?.toLowerCase() || "";
  let displayItems = pendingReviews.filter((item) => item.status === "pending" || !item.status);

  if (searchQuery) {
    displayItems = displayItems.filter(
      (item) =>
        safeText(item.text).toLowerCase().includes(searchQuery) ||
        safeText(item.ai_suggestion).toLowerCase().includes(searchQuery)
    );
  }

  if (displayItems.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: var(--gray-500);">
          <i class="fas fa-check-circle" style="font-size: 2em; margin-bottom: 10px; display: block; color: var(--success);"></i>
          ${searchQuery ? "No items match your search" : "No pending reviews! All items have been processed."}
        </td>
      </tr>
    `;
    return;
  }

  const categoryOptions = (suggestion) =>
    Object.entries(CATEGORY_TAXONOMY)
      .map(([parent, data]) => {
        const isParentSelected = parent === suggestion;
        const subOptions = (data.subcategories || [])
          .map(
            (sub) =>
              `<option value="${escapeHtml(sub)}" ${sub === suggestion ? "selected" : ""}>${escapeHtml(sub)}</option>`
          )
          .join("");
        return `
          <optgroup label="${escapeHtml(parent)}">
            <option value="${escapeHtml(parent)}" ${isParentSelected ? "selected" : ""}>${escapeHtml(parent)} (General)</option>
            ${subOptions}
          </optgroup>
        `;
      })
      .join("");

  tbody.innerHTML = displayItems
    .map((item) => {
      const confidencePercent = Math.round((Number(item.confidence || 0) || 0) * 100);
      const confidenceClass = item.confidence < 0.3 ? "danger" : item.confidence < 0.6 ? "warning" : "success";
      const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : "Unknown";
      const suggestedKeyword = extractSuggestedKeyword(item.text);
      const found = Array.isArray(item.keywords_found) ? item.keywords_found : [];
      return `
        <tr data-review-id="${escapeHtml(item.id)}" data-complaint-id="${escapeHtml(item.complaint_id)}">
          <td><code style="font-size: 0.8em;">${escapeHtml(safeText(item.complaint_id).substring(0, 10))}...</code></td>
          <td class="description-cell" title="${escapeHtml(item.text)}" style="max-width: 180px;">
            <div style="font-size: 0.9em; color: var(--gray-700);">${escapeHtml(safeText(item.text).substring(0, 50))}${safeText(item.text).length > 50 ? "..." : ""}</div>
            ${found.length ? `<small style="color: var(--gray-500);">Found: ${escapeHtml(found.slice(0, 2).join(", "))}</small>` : ""}
          </td>
          <td style="font-size: 0.85em;">${escapeHtml(dateStr)}</td>
          <td><span class="badge badge-keyword">${escapeHtml(item.ai_suggestion || "Unknown")}</span></td>
          <td><span class="badge badge-tier${confidenceClass === "danger" ? "1" : confidenceClass === "warning" ? "2" : "3"}">${confidencePercent}%</span></td>
          <td>
            <input type="text" class="hitl-keyword-input" placeholder="e.g., baha, sunog..." value="${escapeHtml(suggestedKeyword)}"
              style="width: 100px; padding: 5px 6px; border-radius: 4px; border: 1px solid var(--gray-300); font-size: 0.85em;">
          </td>
          <td>
            <select class="hitl-category-select" style="padding: 5px 6px; border-radius: 4px; border: 1px solid var(--gray-300); font-size: 0.85em; max-width: 130px;">
              ${categoryOptions(item.ai_suggestion)}
            </select>
          </td>
          <td>
            <button class="btn btn-sm hitl-save-btn" style="background: var(--success); color: white; padding: 4px 8px;" onclick="trainKeyword(event, '${escapeHtml(item.id)}', '${escapeHtml(item.complaint_id)}', this)">
              <i class="fas fa-graduation-cap"></i> Train
            </button>
            <button class="btn btn-sm" style="background: var(--gray-400); color: white; margin-left: 2px; padding: 4px 6px;" onclick="dismissReview('${escapeHtml(item.id)}', '${escapeHtml(item.complaint_id)}')" title="Skip this item">
              <i class="fas fa-times"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

async function loadLowConfidenceItems() {
  const processed = getProcessedComplaints();
  pendingReviews = buildPendingFromProcessed(processed, 200);
  updateHITLStats();
  renderTrainingTable();
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
  trainedToday = trainingHistory.filter((x) => x?.date === today && safeText(x?.title).toLowerCase().includes("trained")).length;
}

async function trainKeywordInternal(reviewId, complaintId, rowEl) {
  const keywordInput = rowEl?.querySelector(".hitl-keyword-input");
  const categorySelect = rowEl?.querySelector(".hitl-category-select");
  const keyword = keywordInput?.value?.trim() || "";
  const selected = categorySelect?.value || "";

  if (!keyword) {
    showMessage("error", "Enter a keyword to train.");
    return;
  }
  if (!selected) {
    showMessage("error", "Select a category.");
    return;
  }

  const isParent = HITL_CATEGORIES.includes(selected);
  const category = isParent ? selected : SUBCATEGORY_TO_PARENT[selected] || "Others";
  const subcategory = isParent ? null : selected;

  const res = await apiClient.post("/api/nlp/keywords", {
    term: keyword,
    category,
    subcategory,
    language: "all",
    confidence: 1.0,
  });
  if (!res?.success) {
    showMessage("error", res?.error || "Failed to train keyword.");
    return;
  }

  trainedComplaintIds.add(complaintId);
  saveTrainedIds();

  pendingReviews = pendingReviews.map((r) => (r.id === reviewId ? { ...r, status: "trained" } : r));
  pendingReviews = pendingReviews.filter((r) => r.status === "pending" || !r.status);

  addTrainingHistory("Trained keyword", `"${keyword}" → ${category}${subcategory ? ` / ${subcategory}` : ""}`);
  updateHITLStats();
  renderTrainingHistory();
  await loadDictionaryStats();

  // Reload NLP Engine and Reprocess to match Simulated System behavior
  if (typeof window.loadNLPDictionaries === 'function') {
    await window.loadNLPDictionaries(true);
    if (window.CitizenLinkBrainAnalytics?.reprocessAll) {
      window.CitizenLinkBrainAnalytics.reprocessAll();
    }
    // Refresh pending items list as some might be auto-resolved now
    await loadLowConfidenceItems();
  } else {
    renderTrainingTable();
  }
  
  showMessage("success", "Training saved.");
}

function dismissReviewInternal(reviewId, complaintId) {
  trainedComplaintIds.add(complaintId);
  saveTrainedIds();
  pendingReviews = pendingReviews.filter((r) => r.id !== reviewId);
  updateHITLStats();
  addTrainingHistory("Dismissed review", `Complaint ${complaintId}`);
  renderTrainingHistory();
  renderTrainingTable();
}

window.trainKeyword = async (event, reviewId, complaintId, btnEl) => {
  try {
    event?.preventDefault?.();
    const row = btnEl?.closest("tr") || document.querySelector(`tr[data-review-id="${CSS.escape(reviewId)}"]`);
    await trainKeywordInternal(reviewId, complaintId, row);
  } catch (e) {
    showMessage("error", e?.message || String(e));
  }
};

window.dismissReview = (reviewId, complaintId) => {
  dismissReviewInternal(reviewId, complaintId);
};

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

  $("refreshPendingBtn")?.addEventListener("click", async () => {
    await loadLowConfidenceItems();
  });

  $("fetchLowConfidenceBtn")?.addEventListener("click", async () => {
    await loadLowConfidenceItems();
  });

  $("trainingSearchInput")?.addEventListener(
    "input",
    debounce(() => {
      renderTrainingTable();
    }, 300)
  );

  updateHITLStats();
}

document.addEventListener("DOMContentLoaded", init);

