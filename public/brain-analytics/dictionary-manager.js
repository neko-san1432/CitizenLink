import apiClient from "/js/config/apiClient.js";
import showMessage from "/js/components/toast.js";

let dictionaryData = null;
let dictionarySearchFilter = "";
let dictionaryCategoryFilter = "all";
let currentRole = null;

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

function canEditModifiers() {
  return currentRole === "super-admin";
}

function canAddKeyword() {
  return currentRole === "super-admin" || currentRole === "complaint-coordinator" || currentRole === "lgu-admin" || currentRole === "lgu-coordinator";
}

async function fetchAllKeywords() {
  const res = await apiClient.get("/api/nlp/keywords");
  if (!res?.success) throw new Error(res?.error || "Failed to load keywords");
  return Array.isArray(res.data) ? res.data : [];
}

async function fetchAllRules() {
  const res = await apiClient.get("/api/nlp/dictionary-rules");
  if (!res?.success) throw new Error(res?.error || "Failed to load dictionary rules");
  return Array.isArray(res.data) ? res.data : [];
}

async function loadTaxonomy() {
  if (typeof CitizenLinkTaxonomy === "undefined") return null;
  try {
    return await CitizenLinkTaxonomy.loadTaxonomy();
  } catch {
    return null;
  }
}

function computeMetadata({ keywords, taxonomy, rules }) {
  const languages = new Set();
  const lastUpdated = [];
  for (const k of keywords) {
    if (k?.language) languages.add(k.language);
    if (k?.updated_at) lastUpdated.push(k.updated_at);
    else if (k?.created_at) lastUpdated.push(k.created_at);
  }
  for (const r of rules) {
    if (r?.updated_at) lastUpdated.push(r.updated_at);
    else if (r?.created_at) lastUpdated.push(r.created_at);
  }
  const max = lastUpdated
    .map((x) => new Date(x))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    languages: [...languages],
    last_updated: max ? max.toISOString().slice(0, 10) : "-",
    taxonomyLoaded: Boolean(taxonomy?.categories),
  };
}

function buildHierarchyFromKeywords({ keywords, taxonomy }) {
  const hierarchy = {};

  const add = (parent, sub, row) => {
    const p = safeText(parent).trim() || "Others";
    const s = safeText(sub).trim() || "General";
    if (!hierarchy[p]) hierarchy[p] = { totalCount: 0, subcategories: {} };
    if (!hierarchy[p].subcategories[s]) hierarchy[p].subcategories[s] = [];
    hierarchy[p].subcategories[s].push(row);
    hierarchy[p].totalCount += 1;
  };

  for (const k of keywords) {
    add(k.category, k.subcategory, {
      id: k.id,
      term: safeText(k.term),
      translation: k.translation ? safeText(k.translation) : "",
      confidence: k.confidence,
      language: k.language || "all",
      category: k.category,
      subcategory: k.subcategory,
    });
  }

  if (taxonomy?.categories) {
    for (const [parentName, data] of Object.entries(taxonomy.categories)) {
      if (!hierarchy[parentName]) hierarchy[parentName] = { totalCount: 0, subcategories: {} };
      const subs = Array.isArray(data?.subcategories) ? data.subcategories : [];
      for (const subName of subs) {
        if (!hierarchy[parentName].subcategories[subName]) hierarchy[parentName].subcategories[subName] = [];
      }
    }
  }

  return hierarchy;
}

function groupModifiersFromRules(rules) {
  const modifiers = {
    amplifiers: [],
    diminishers: [],
    metaphors: [],
    speculation: [],
    negation: [],
    temporal_present: [],
    temporal_past: [],
    temporal_future: [],
  };

  for (const r of rules) {
    const rt = safeText(r.rule_type);
    const item = {
      id: r.id,
      term: safeText(r.pattern),
      translation: r.translation ? safeText(r.translation) : "",
      multiplier: r.multiplier,
      action: r.action,
      is_current_emergency: Boolean(r.is_current_emergency),
    };

    if (rt === "severity_amplifier") modifiers.amplifiers.push(item);
    else if (rt === "severity_diminisher") modifiers.diminishers.push(item);
    else if (rt === "speculation_conditional" || rt === "speculation_risk" || rt === "speculation_past") modifiers.speculation.push(item);
    else if (rt === "negation_no_issue") modifiers.negation.push(item);
    else if (rt === "temporal_present") modifiers.temporal_present.push(item);
    else if (rt === "temporal_past") modifiers.temporal_past.push(item);
    else if (rt === "temporal_future") modifiers.temporal_future.push(item);
    else modifiers.metaphors.push(item);
  }
  return modifiers;
}

async function loadDictionary() {
  const container = $("dictionary-container");
  if (container) {
    container.innerHTML = `
      <p style="color: var(--gray-500); padding: 40px; text-align: center;">
        <i class="fas fa-spinner fa-spin" style="font-size: 2em; margin-bottom: 10px; display: block;"></i>
        Loading dictionary...
      </p>
    `;
  }

  try {
    const [keywords, rules, taxonomy] = await Promise.all([fetchAllKeywords(), fetchAllRules(), loadTaxonomy()]);
    dictionaryData = {
      success: true,
      totalKeywords: keywords.length,
      hierarchy: buildHierarchyFromKeywords({ keywords, taxonomy }),
      modifiers: groupModifiersFromRules(rules),
      taxonomy: taxonomy?.categories || {},
      metadata: computeMetadata({ keywords, taxonomy, rules }),
    };
    populateDictionaryCategoryFilter();
    updateDictionaryStats();
    renderDictionaryManager();
  } catch (error) {
    if (container) {
      container.innerHTML = `
        <div style="color: var(--danger); padding: 40px; text-align: center;">
          <i class="fas fa-exclamation-circle" style="font-size: 2em; margin-bottom: 10px; display: block;"></i>
          Failed to load dictionary.<br>
          <small>${escapeHtml(error?.message || String(error))}</small>
        </div>
      `;
    }
  }
}

function populateDictionaryCategoryFilter() {
  const select = $("dict-category-filter");
  if (!select || !dictionaryData?.hierarchy) return;

  select.innerHTML = '<option value="all">All Categories</option>';
  select.innerHTML += '<option value="modifiers">── Modifiers ──</option>';
  for (const parentName of Object.keys(dictionaryData.hierarchy || {}).sort()) {
    select.innerHTML += `<option value="${escapeHtml(parentName)}">${escapeHtml(parentName)}</option>`;
  }
}

function updateDictionaryStats() {
  if (!dictionaryData) return;
  const meta = dictionaryData.metadata || {};
  $("dictTotalKeywords").textContent = dictionaryData.totalKeywords || "-";
  $("dictLanguages").textContent = (meta.languages?.length ?? "-").toString();
  $("dictCategories").textContent = Object.keys(dictionaryData.hierarchy || {}).length.toString();
  $("dictLastUpdated").textContent = meta.last_updated || "-";
}

function renderSubcategories(parentName, subcategories) {
  if (!subcategories) return '<p style="padding: 15px; color: var(--gray-500);">No subcategories</p>';
  let html = "";

  for (const [subName, keywords] of Object.entries(subcategories)) {
    let filtered = keywords;
    if (dictionarySearchFilter) {
      filtered = keywords.filter((kw) => safeText(kw.term).toLowerCase().includes(dictionarySearchFilter));
    }
    if (dictionarySearchFilter && filtered.length === 0) continue;

    html += `
      <div class="dictionary-accordion sub-accordion" data-subcategory="${escapeHtml(subName)}" data-parent="${escapeHtml(parentName)}" style="margin-left: 20px; border-left: 3px solid var(--primary-light);">
        <div class="accordion-header sub-header" onclick="toggleDictAccordion(this)" style="background: var(--gray-100);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-chevron-right accordion-icon" style="color: var(--primary);"></i>
            <i class="fas fa-tag" style="color: var(--primary);"></i>
            <span>${escapeHtml(subName)}</span>
            <span class="badge badge-keyword" style="font-size: 0.75em;">${filtered.length}</span>
          </div>
        </div>
        <div class="accordion-content" style="display: none; padding: 15px; background: white;" 
             ondragover="allowDrop(event)" 
             ondragleave="onDragLeave(event)"
             ondrop="dropKeyword(event, '${escapeHtml(parentName)}', '${escapeHtml(subName)}')">
          <div class="keyword-chips">
            ${filtered.length > 0
        ? filtered
          .sort((a, b) => safeText(a.term).localeCompare(safeText(b.term)))
          .map(
            (kw) => `
                        <span class="keyword-chip" draggable="true" ondragstart="dragKeyword(event, '${escapeHtml(kw.id)}')" ondragend="dragEndKeyword(event)"
                              title="${escapeHtml(kw.translation || "")} | ${Math.round((kw.confidence || 0.8) * 100)}% | ${escapeHtml(kw.language || "Unknown")}">
                          ${escapeHtml(kw.term)}
                          <button class="chip-delete" data-keyword-id="${escapeHtml(kw.id)}" onclick="onDeleteKeywordClick(event, this)" title="Delete keyword">
                            <i class="fas fa-times"></i>
                          </button>
                        </span>
                      `
          )
          .join("")
        : '<span style="color: var(--gray-500); font-style: italic;">No keywords yet (Drag items here)</span>'
      }
          </div>
          <div class="add-keyword-form" style="display:flex; gap:8px; align-items:center;">
            <input type="text" class="new-keyword-input" placeholder="Add keyword to ${escapeHtml(subName)}...">
            <button class="btn btn-sm" style="background: var(--success); color: white;" onclick="addKeywordToSubcategory(this, '${escapeHtml(parentName)}', '${escapeHtml(subName)}')">
              <i class="fas fa-plus"></i> Add
            </button>
          </div>
        </div>
      </div>
    `;
  }

  return html || '<p style="padding: 15px; color: var(--gray-500);">No subcategories</p>';
}

function renderModifiersSection(modifiers) {
  const sections = [
    { key: "amplifiers", title: "Severity Amplifiers", icon: "fa-arrow-up", color: "var(--danger)", desc: 'Words that INCREASE severity (e.g., "grabe", "emergency")', hasMultiplier: true, rule_type: "severity_amplifier" },
    { key: "diminishers", title: "Severity Diminishers", icon: "fa-arrow-down", color: "var(--success)", desc: 'Words that DECREASE severity (e.g., "konti", "slight")', hasMultiplier: true, rule_type: "severity_diminisher" },
    { key: "speculation", title: "Speculation Indicators", icon: "fa-question-circle", color: "var(--info)", desc: "Words indicating uncertainty (e.g., baka, maybe)", hasMultiplier: false, rule_type: "speculation_conditional" },
    { key: "negation", title: "Negation Patterns", icon: "fa-ban", color: "var(--gray-600)", desc: 'Patterns indicating "no problem" (e.g., wala naman, hindi totoo)', hasMultiplier: false, rule_type: "negation_no_issue" },
    { key: "temporal_present", title: "Temporal Present", icon: "fa-bolt", color: "var(--danger)", desc: "Marks incidents as currently active (×2.0 urgency)", hasMultiplier: false, rule_type: "temporal_present" },
    { key: "temporal_past", title: "Temporal Past", icon: "fa-clock", color: "var(--gray-600)", desc: "Marks incidents as past/resolved (×0.1 urgency)", hasMultiplier: false, rule_type: "temporal_past" },
    { key: "temporal_future", title: "Temporal Future", icon: "fa-forward", color: "var(--info)", desc: "Marks incidents as advisory/future (score = 0)", hasMultiplier: false, rule_type: "temporal_future" },
  ];

  let html = "";
  for (const section of sections) {
    const items = Array.isArray(modifiers?.[section.key]) ? modifiers[section.key] : [];
    let filtered = items;
    if (dictionarySearchFilter) {
      filtered = items.filter((m) => safeText(m.term).toLowerCase().includes(dictionarySearchFilter));
    }
    if (dictionarySearchFilter && filtered.length === 0) continue;

    const addDisabled = !canAddKeyword();
    const multiplierDisabled = section.hasMultiplier && !canEditModifiers();
    html += `
      <div class="dictionary-accordion modifier-accordion" data-modifier="${escapeHtml(section.key)}">
        <div class="accordion-header" onclick="toggleDictAccordion(this)" style="background: ${section.color}; color: white;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-chevron-right accordion-icon"></i>
            <i class="fas ${section.icon}"></i>
            <strong>${section.title}</strong>
            <span class="badge" style="background: rgba(255,255,255,0.3); font-size: 0.8em;">${filtered.length}</span>
          </div>
        </div>
        <div class="accordion-content" style="display: none; padding: 15px;">
          <p style="color: var(--gray-600); font-size: 0.9em; margin-bottom: 10px;">${section.desc}</p>
          <div class="keyword-chips">
            ${filtered.length > 0
        ? filtered
          .sort((a, b) => safeText(a.term).localeCompare(safeText(b.term)))
          .map((m) => {
            const mult = m.multiplier === null || m.multiplier === undefined ? "" : ` <small style="color: ${section.color}; font-weight: bold;">×${escapeHtml(m.multiplier)}</small>`;
            return `<span class="keyword-chip" title="${escapeHtml(m.translation || "")}">
                        ${escapeHtml(m.term)}${mult}
                      </span>`;
          })
          .join("")
        : '<span style="color: var(--gray-500); font-style: italic;">No items</span>'
      }
          </div>
          <div class="add-modifier-form" style="margin-top: 15px; display: flex; gap: 8px; align-items: center; padding-top: 10px; border-top: 1px solid var(--gray-200);">
            <input type="text" class="new-modifier-term" placeholder="New item..." style="flex: 1; padding: 8px 12px; border-radius: 4px; border: 1px solid var(--gray-300);" ${addDisabled ? "disabled" : ""}>
            ${section.hasMultiplier
        ? `<input type="number" class="new-modifier-multiplier" placeholder="×" value="${section.key === "amplifiers" ? "1.3" : "0.7"}" step="0.1" min="0" max="5"
                    style="width: 70px; padding: 8px; border-radius: 4px; border: 1px solid var(--gray-300); text-align: center;" ${multiplierDisabled ? "disabled" : ""}>`
        : ""
      }
            <button class="btn btn-sm" style="background: ${section.color}; color: white;" onclick="addModifier(this, '${escapeHtml(section.rule_type)}')" ${addDisabled ? "disabled" : ""}>
              <i class="fas fa-plus"></i> Add
            </button>
          </div>
          ${section.hasMultiplier && !canEditModifiers()
        ? `<div style="margin-top: 8px; color: var(--gray-600); font-size: 12px;">
                  Multiplier is set by Super Admin during verification.
                </div>`
        : ""
      }
        </div>
      </div>
    `;
  }
  return html;
}

function renderDictionaryManager() {
  const container = $("dictionary-container");
  if (!container || !dictionaryData?.hierarchy) {
    if (container) container.innerHTML = `<p style="color: var(--gray-500); text-align: center; padding: 40px;">No dictionary data loaded.</p>`;
    return;
  }

  const hierarchy = dictionaryData.hierarchy;
  const modifiers = dictionaryData.modifiers || {};

  const showModifiers = dictionaryCategoryFilter === "all" || dictionaryCategoryFilter === "modifiers";
  const showCategories = dictionaryCategoryFilter === "all" || (dictionaryCategoryFilter !== "modifiers" && hierarchy[dictionaryCategoryFilter]);

  let html = "";

  if (showCategories) {
    const categoriesToRender = dictionaryCategoryFilter === "all" ? Object.keys(hierarchy).sort() : [dictionaryCategoryFilter];
    for (const parentName of categoriesToRender) {
      const parentData = hierarchy[parentName];
      if (!parentData) continue;
      html += `
        <div class="dictionary-accordion parent-accordion" data-parent="${escapeHtml(parentName)}">
          <div class="accordion-header parent-header" onclick="toggleDictAccordion(this)" style="background: var(--primary); color: white;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i class="fas fa-chevron-right accordion-icon"></i>
              <i class="fas fa-folder"></i>
              <strong>${escapeHtml(parentName)}</strong>
              <span class="badge" style="background: rgba(255,255,255,0.3); font-size: 0.8em;">${parentData.totalCount || 0} keywords</span>
            </div>
          </div>
          <div class="accordion-content" style="display: none; padding: 0;">
            ${renderSubcategories(parentName, parentData.subcategories)}
          </div>
        </div>
      `;
    }
  }

  if (showModifiers && dictionaryCategoryFilter !== "modifiers") {
    html += `<h3 style="margin-top: 30px; margin-bottom: 15px; color: var(--gray-700);"><i class="fas fa-sliders-h"></i> NLP Modifiers</h3>`;
  }
  if (showModifiers || dictionaryCategoryFilter === "modifiers") {
    html += renderModifiersSection(modifiers);
  }

  if (!html) {
    html = `<p style="color: var(--gray-500); text-align: center; padding: 40px;">No matching items found.</p>`;
  }

  container.innerHTML = html;
}

window.toggleDictAccordion = (headerEl) => {
  const accordion = headerEl.closest(".dictionary-accordion");
  const content = accordion?.querySelector(".accordion-content");
  const icon = accordion?.querySelector(".accordion-icon");
  if (!content) return;
  if (content.style.display === "none" || content.style.display === "") {
    content.style.display = "block";
    icon?.classList?.remove("fa-chevron-right");
    icon?.classList?.add("fa-chevron-down");
  } else {
    content.style.display = "none";
    icon?.classList?.remove("fa-chevron-down");
    icon?.classList?.add("fa-chevron-right");
  }
};

window.onDeleteKeywordClick = async (event, btnEl) => {
  try {
    event?.stopPropagation?.();
    const id = btnEl?.dataset?.keywordId;
    if (!id) return;
    const ok = window.confirm("Delete this keyword?");
    if (!ok) return;
    const res = await apiClient.delete(`/api/nlp/keywords/${encodeURIComponent(id)}`);
    if (!res?.success) throw new Error(res?.error || "Failed to delete keyword");
    showMessage("success", "Keyword deleted");
    await loadDictionary();
  } catch (e) {
    showMessage("error", e?.message || String(e));
  }
};

window.addKeywordToSubcategory = async (buttonEl, parentCategory, subcategory) => {
  try {
    const form = buttonEl.closest(".add-keyword-form");
    const input = form?.querySelector(".new-keyword-input");
    const keyword = input?.value?.trim() || "";
    if (!keyword) {
      showMessage("warning", "Please enter a keyword");
      input?.focus?.();
      return;
    }

    buttonEl.disabled = true;
    const res = await apiClient.post("/api/nlp/keywords", {
      term: keyword,
      category: parentCategory,
      subcategory: subcategory === "General" ? null : subcategory,
      language: "all",
      confidence: 0.8,
    });
    buttonEl.disabled = false;

    if (!res?.success) throw new Error(res?.error || "Failed to add keyword");
    showMessage("success", `Added "${keyword}"`);
    if (input) input.value = "";
    await loadDictionary();
  } catch (e) {
    buttonEl.disabled = false;
    showMessage("error", e?.message || String(e));
  }
};

window.addModifier = async (buttonEl, ruleType) => {
  try {
    const form = buttonEl.closest(".add-modifier-form");
    const term = form?.querySelector(".new-modifier-term")?.value?.trim() || "";
    const multiplierRaw = form?.querySelector(".new-modifier-multiplier")?.value;
    const multiplier = multiplierRaw === "" || multiplierRaw === undefined ? null : Number(multiplierRaw);

    if (!term) {
      showMessage("warning", "Enter a term/pattern");
      return;
    }

    buttonEl.disabled = true;
    if (currentRole === "super-admin") {
      const payload = { rule_type: ruleType, pattern: term };
      if (ruleType === "severity_amplifier" || ruleType === "severity_diminisher") {
        if (!multiplier || !Number.isFinite(multiplier)) {
          buttonEl.disabled = false;
          showMessage("error", "Multiplier is required.");
          return;
        }
        payload.multiplier = multiplier;
      }
      const res = await apiClient.post("/api/nlp/dictionary-rules", payload);
      buttonEl.disabled = false;
      if (!res?.success) throw new Error(res?.error || "Failed to add rule");
      showMessage("success", "Rule added");
    } else {
      const res = await apiClient.post("/api/nlp/proposals", {
        type: "dictionary_rule",
        data: { rule_type: ruleType, pattern: term },
      });
      buttonEl.disabled = false;
      if (!res?.success) throw new Error(res?.error || "Failed to submit proposal");
      showMessage("success", "Submitted for verification");
    }

    await loadDictionary();
  } catch (e) {
    buttonEl.disabled = false;
    showMessage("error", e?.message || String(e));
  }
};

// =============================================================================
// DRAG AND DROP HANDLERS (OPTIMIZED)
// =============================================================================

window.allowDrop = (event) => {
  event.preventDefault();
  const container = event.target.closest('.accordion-content');
  if (container) {
    container.style.background = "var(--primary-light-alpha, rgba(68, 114, 196, 0.1))";
  }
};

window.onDragLeave = (event) => {
  const container = event.target.closest('.accordion-content');
  if (container) {
    container.style.background = "white";
  }
};

window.dragKeyword = (event, id) => {
  event.dataTransfer.setData("text/plain", id);
  event.dataTransfer.effectAllowed = "move";
  // Visual touch
  event.target.style.opacity = "0.5";
};

window.dragEndKeyword = (event) => {
  event.target.style.opacity = "1";
};

window.dropKeyword = async (event, newParent, newSub) => {
  event.preventDefault();
  const id = event.dataTransfer.getData("text/plain");
  const container = event.target.closest('.accordion-content');
  if (container) container.style.background = "white";

  if (!id) return;

  // Find the original element
  const draggedEl = document.querySelector(`.keyword-chip button[data-keyword-id="${id}"]`)?.closest('.keyword-chip');
  if (!draggedEl) return;

  // Optimistic UI Update
  const oldContainer = draggedEl.closest('.keyword-chips');
  const newContainer = container.querySelector('.keyword-chips');

  // Don't do anything if dropped in same place
  if (oldContainer === newContainer) return;

  // Move element
  newContainer.appendChild(draggedEl);

  // Remove "No keywords yet" message if exists
  const noKeysMsg = newContainer.querySelector('span[style*="italic"]');
  if (noKeysMsg) noKeysMsg.remove();

  // Update State & Backend
  try {
    // 1. Update Local State (dictionaryData)
    // We need to find the keyword in hierarchy and move it
    let keywordObj = null;
    let oldParent = null;
    let oldSub = null;

    // Search in hierarchy
    outerLoop:
    for (const parent of Object.keys(dictionaryData.hierarchy)) {
      const cats = dictionaryData.hierarchy[parent].subcategories;
      for (const sub of Object.keys(cats)) {
        const idx = cats[sub].findIndex(k => k.id === id);
        if (idx !== -1) {
          keywordObj = cats[sub][idx];
          oldParent = parent;
          oldSub = sub;
          // Remove from old
          cats[sub].splice(idx, 1);
          break outerLoop;
        }
      }
    }

    if (keywordObj) {
      // Update object
      keywordObj.category = newParent;
      keywordObj.subcategory = newSub;

      // Add to new
      if (!dictionaryData.hierarchy[newParent]) {
        dictionaryData.hierarchy[newParent] = { totalCount: 0, subcategories: {} };
      }
      if (!dictionaryData.hierarchy[newParent].subcategories[newSub]) {
        dictionaryData.hierarchy[newParent].subcategories[newSub] = [];
      }
      dictionaryData.hierarchy[newParent].subcategories[newSub].push(keywordObj);

      // Update counts visually
      updateCountsUI(oldParent, oldSub, newParent, newSub);
    }

    // 2. Call API
    const res = await apiClient.put(`/api/nlp/keywords/${id}`, {
      category: newParent,
      subcategory: newSub === "General" ? null : newSub
    });

    if (!res.success) throw new Error(res.error || "Failed to move keyword");

    showMessage("success", `Moved to ${newSub}`);

  } catch (err) {
    console.error(err);
    showMessage("error", "Failed to move: " + err.message);
    // Revert UI (reload)
    await loadDictionary();
  }
};

function updateCountsUI(oldParent, oldSub, newParent, newSub) {
  try {
    // Update Old
    if (oldParent && oldSub) {
      const oldAccordion = document.querySelector(`.sub-accordion[data-parent="${CSS.escape(oldParent)}"][data-subcategory="${CSS.escape(oldSub)}"]`);
      const oldBadge = oldAccordion?.querySelector('.badge-keyword');
      if (oldBadge) {
        const current = parseInt(oldBadge.textContent) || 0;
        oldBadge.textContent = Math.max(0, current - 1);
      }
      // Also update parent count if needed (though parent count is sum of all, might be complex if structure is different)
    }

    // Update New
    if (newParent && newSub) {
      const newAccordion = document.querySelector(`.sub-accordion[data-parent="${CSS.escape(newParent)}"][data-subcategory="${CSS.escape(newSub)}"]`);
      const newBadge = newAccordion?.querySelector('.badge-keyword');
      if (newBadge) {
        const current = parseInt(newBadge.textContent) || 0;
        newBadge.textContent = current + 1;
      }
    }
  } catch (e) {
    console.warn("Failed to update counts UI", e);
  }
}

function exportDictionary() {
  if (!dictionaryData) return;
  const dataStr = JSON.stringify(dictionaryData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `citizenlink_dictionary_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function initDictionaryManager() {
  $("dict-search")?.addEventListener(
    "input",
    debounce((e) => {
      dictionarySearchFilter = e.target.value.toLowerCase().trim();
      renderDictionaryManager();
    }, 300)
  );

  $("dict-category-filter")?.addEventListener("change", (e) => {
    dictionaryCategoryFilter = e.target.value;
    renderDictionaryManager();
  });

  $("refreshDictionaryBtn")?.addEventListener("click", loadDictionary);
  $("exportDictionaryBtn")?.addEventListener("click", exportDictionary);

  // Check if we're on the standalone dictionary-manager page
  const isStandalonePage = window.location.pathname === "/dictionary-manager" || 
                           window.location.pathname.includes("dictionary-manager");
  
  if (isStandalonePage) {
    // Auto-load dictionary on standalone page
    loadDictionary();
  } else {
    // On brain-analytics page, load when tab is clicked
    document.querySelector('[data-tab="dictionary-manager"]')?.addEventListener("click", () => {
      if (!dictionaryData) loadDictionary();
    });

    // Handle direct navigation via hash
    if (window.location.hash === "#dictionary-manager") {
      setTimeout(() => {
        if (!dictionaryData) loadDictionary();
      }, 100);
    }

    // Handle in-page navigation (Sidebar clicks while already on page)
    window.addEventListener("hashchange", () => {
      if (window.location.hash === "#dictionary-manager") {
        if (!dictionaryData) loadDictionary();
      }
    });
  }
}

async function init() {
  const profile = await apiClient.getUserProfile();
  if (!profile?.success) {
    window.location.href = "/login";
    return;
  }
  currentRole = profile.data?.role || null;
  initDictionaryManager();
}

document.addEventListener("DOMContentLoaded", init);

