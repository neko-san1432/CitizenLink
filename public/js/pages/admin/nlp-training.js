import { initializeSidebar } from "/js/components/sidebar.js";
import apiClient from "/js/config/apiClient.js";
import showMessage from "/js/components/toast.js";

console.log('[NLP-Training] Module loaded');
document.addEventListener("DOMContentLoaded", async () => {
    initializeSidebar();

    const user = await apiClient.getUserProfile();
    if (!user.success) {
        window.location.href = "/login.html";
        return;
    }

    // Set role attribute on body for CSS visibility rules
    document.body.setAttribute("data-role", user.data.role);

    initForm();
    loadStats();

    // Initial Load based on role default view
    if (user.data.role === 'coordinator') {
        loadProposals('pending_coordinator');
    } else if (user.data.role === 'super-admin') {
        loadProposals('pending_super_admin');
        // Initialize Super Admin NLP Management section
        setTimeout(() => initManagement(), 100);
    } else {
        loadProposals('pending_coordinator'); // View status
    }
});

// --- STATS ---
// --- STATS ---
async function loadStats() {
    try {
        const res = await apiClient.get("/api/nlp/stats");
        if (res.success && res.data) {
            const stats = res.data;

            const pendingCoord = document.getElementById("count-pending-coord");
            if (pendingCoord) pendingCoord.textContent = stats.pending_coordinator || 0;

            const pendingAdmin = document.getElementById("count-pending-admin");
            if (pendingAdmin) pendingAdmin.textContent = stats.pending_super_admin || 0;

            const approved = document.getElementById("count-approved");
            if (approved) approved.textContent = stats.approved || 0;

            // Accuracy is mocked in backend for now, but we can display it if returned
            // Or leave it as static if not in response
        }
        
        // Load auto-queue count
        await loadAutoQueueCount();
    } catch (err) {
        console.error("Failed to load stats:", err);
    }
}

// --- AUTO-QUEUE (HITL) ---
async function loadAutoQueueCount() {
    try {
        const res = await apiClient.get("/api/nlp/pending-reviews/count");
        if (res.success) {
            const countEl = document.getElementById("count-auto-queue");
            if (countEl) countEl.textContent = res.count || 0;
        }
    } catch (err) {
        console.error("Failed to load auto-queue count:", err);
        const countEl = document.getElementById("count-auto-queue");
        if (countEl) countEl.textContent = "0";
    }
}

window.showAutoQueueSection = async function() {
    const section = document.getElementById("auto-queue-section");
    if (section) {
        section.classList.remove("hidden");
        await loadAutoQueueItems();
    }
};

window.hideAutoQueueSection = function() {
    const section = document.getElementById("auto-queue-section");
    if (section) section.classList.add("hidden");
};

async function loadAutoQueueItems() {
    const list = document.getElementById("auto-queue-list");
    if (!list) return;
    
    list.innerHTML = '<div class="text-center py-8 text-gray-400">Loading...</div>';
    
    try {
        const res = await apiClient.get("/api/nlp/pending-reviews");
        if (!res.success) throw new Error(res.error);
        
        const items = res.data || [];
        
        if (items.length === 0) {
            list.innerHTML = `
                <div class="text-center py-12">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                        <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                        </svg>
                    </div>
                    <p class="text-gray-500 font-medium">All caught up!</p>
                    <p class="text-gray-400 text-sm">No low-confidence classifications need training.</p>
                </div>
            `;
            return;
        }
        
        list.innerHTML = '';
        items.forEach(item => renderAutoQueueItem(item, list));
        
    } catch (err) {
        list.innerHTML = `<div class="text-center py-8 text-red-500">Error: ${err.message}</div>`;
    }
}

function renderAutoQueueItem(item, container) {
    const card = document.createElement("div");
    card.className = "card-premium p-4 flex flex-col md:flex-row gap-4 items-start";
    card.id = `aq-item-${item.id}`;
    
    const confidenceColor = item.confidence < 0.3 ? 'red' : item.confidence < 0.6 ? 'yellow' : 'orange';
    const confidencePct = ((item.confidence || 0) * 100).toFixed(0);
    
    card.innerHTML = `
        <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
                <span class="bg-${confidenceColor}-100 text-${confidenceColor}-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    ${confidencePct}% confidence
                </span>
                <span class="text-gray-400 text-xs">${item.method}</span>
                ${item.matched_term ? `<span class="text-gray-500 text-xs">• matched: "${item.matched_term}"</span>` : ''}
            </div>
            <p class="text-gray-800 dark:text-gray-200 font-medium mb-2">"${item.text}"</p>
            <div class="text-sm text-gray-500">
                <span>Detected: <span class="font-medium text-gray-700 dark:text-gray-300">${item.detected_category || 'Unknown'}</span></span>
                ${item.detected_subcategory ? ` → ${item.detected_subcategory}` : ''}
            </div>
        </div>
        <div class="flex flex-col gap-2 min-w-[200px]">
            <div class="flex gap-2">
                <input type="text" placeholder="Keyword to train" 
                    class="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-600 p-2 dark:bg-gray-700 dark:text-white"
                    id="aq-keyword-${item.id}" value="${extractKeyword(item.text)}">
            </div>
            <div class="flex gap-2">
                <select id="aq-category-${item.id}" 
                    class="flex-1 text-sm rounded-lg border border-gray-200 dark:border-gray-600 p-2 dark:bg-gray-700 dark:text-white">
                    <option value="">Category...</option>
                    ${allCategories.map(c => `<option value="${c.category}" ${c.category === item.detected_category ? 'selected' : ''}>${c.category}</option>`).join('')}
                </select>
            </div>
            <div class="flex gap-2">
                <button onclick="resolveAutoQueueItem('${item.id}')" 
                    class="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm py-2 px-3 rounded-lg transition-colors">
                    Train
                </button>
                <button onclick="dismissAutoQueueItem('${item.id}')" 
                    class="bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-sm py-2 px-3 rounded-lg transition-colors">
                    Dismiss
                </button>
            </div>
        </div>
    `;
    
    container.appendChild(card);
}

function extractKeyword(text) {
    // Simple extraction: get first 2-3 significant words
    const words = text.toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !['ang', 'yung', 'the', 'dito', 'may', 'ito', 'pero'].includes(w));
    return words.slice(0, 3).join(' ');
}

window.resolveAutoQueueItem = async function(id) {
    const keyword = document.getElementById(`aq-keyword-${id}`)?.value?.trim();
    const category = document.getElementById(`aq-category-${id}`)?.value;
    
    if (!keyword || !category) {
        showMessage("error", "Please enter a keyword and select a category");
        return;
    }
    
    try {
        const res = await apiClient.post(`/api/nlp/pending-reviews/${id}/resolve`, {
            keyword,
            category
        });
        
        if (res.success) {
            showMessage("success", `Trained: "${keyword}" → ${category}`);
            document.getElementById(`aq-item-${id}`)?.remove();
            await loadAutoQueueCount();
            await loadStats();
        } else {
            showMessage("error", res.error || "Failed to train");
        }
    } catch (err) {
        showMessage("error", err.message);
    }
};

window.dismissAutoQueueItem = async function(id) {
    try {
        const res = await apiClient.post(`/api/nlp/pending-reviews/${id}/dismiss`);
        
        if (res.success) {
            showMessage("success", "Dismissed");
            document.getElementById(`aq-item-${id}`)?.remove();
            await loadAutoQueueCount();
        } else {
            showMessage("error", res.error || "Failed to dismiss");
        }
    } catch (err) {
        showMessage("error", err.message);
    }
};

// --- FORM HANDLING ---
async function initForm() {
    const categorySelect = document.getElementById("propCategory");
    const subcategorySelect = document.getElementById("propSubcategory");
    const typeSelect = document.getElementById("propType");

    // Load Categories
    try {
        const res = await apiClient.get("/api/department-structure/categories");
        if (res.success) {
            res.data.forEach(cat => {
                const opt = document.createElement("option");
                opt.value = cat.name; // NLP uses Names, not IDs currently (based on AdvancedDecisionEngine)
                opt.textContent = cat.name;
                opt.dataset.id = cat.id;
                categorySelect.appendChild(opt);
            });
        }
    } catch (err) {
        console.error("Failed to load categories", err);
    }

    // Handle Subcategory Loading
    categorySelect.addEventListener("change", async (e) => {
        const catName = e.target.value;
        const catId = e.target.selectedOptions[0]?.dataset.id;
        subcategorySelect.innerHTML = '<option value="">Select Subcategory...</option>';

        if (catId) {
            const res = await apiClient.get(`/api/department-structure/categories/${catId}/subcategories`);
            if (res.success) {
                res.data.forEach(sub => {
                    const opt = document.createElement("option");
                    opt.value = sub.name;
                    opt.textContent = sub.name;
                    subcategorySelect.appendChild(opt);
                });
            }
        }
    });

    // Handle Form Submit
    const form = document.getElementById("proposalForm");
    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const type = typeSelect.value;
            const term = document.getElementById("propTerm").value;
            const category = categorySelect.value;
            const subcategory = subcategorySelect.value;

            if (!term || (type !== 'metaphor' && !category)) {
                showMessage("error", "Please fill in all required fields");
                return;
            }

            // Build Payload based on Type
            let dataPayload = {};
            if (type === 'keyword') {
                dataPayload = { term, category, subcategory, confidence: 1.0 };
            } else if (type === 'metaphor') {
                dataPayload = { pattern: term }; // Using term input as pattern
            } else if (type === 'anchor') {
                dataPayload = { anchor_text: term, category };
            }

            try {
                const result = await apiClient.post("/api/nlp/proposals", {
                    type,
                    data: dataPayload
                });

                if (result.success) {
                    showMessage("success", "Proposal submitted successfully!");
                    form.reset();
                    loadProposals('pending_coordinator'); // Refresh list
                }
            } catch (err) {
                showMessage("error", err.message || "Failed to submit proposal");
            }
        });
    }
}

// --- QUEUE LIST ---
window.loadProposals = async function (status) {
    const list = document.getElementById("proposals-list");
    list.innerHTML = '<div class="text-center py-8 text-gray-500">Loading...</div>';

    try {
        const res = await apiClient.get(`/api/nlp/proposals?status=${status}`);
        if (!res.success) throw new Error(res.error);

        const proposals = res.data;
        if (proposals.length === 0) {
            list.innerHTML = '<div class="text-center py-8 text-gray-400">No proposals in this queue</div>';
            return;
        }

        list.innerHTML = '';
        proposals.forEach(p => renderProposalCard(p, list));

    } catch (err) {
        list.innerHTML = `<div class="text-center py-8 text-red-500">Error loading proposals: ${err.message}</div>`;
    }
};

function renderProposalCard(proposal, container) {
    const card = document.createElement("div");
    card.className = "group card-premium p-6 relative overflow-hidden flex flex-col md:flex-row justify-between items-start gap-4 hover:shadow-md";

    let contentHtml = '';
    const d = proposal.data;

    if (proposal.type === 'keyword') {
        contentHtml = `
            <div class="flex items-start gap-4">
                <div class="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>
                </div>
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">Keyword</span>
                        <span class="text-gray-400 text-xs">•</span>
                        <span class="text-gray-500 text-xs font-medium">Confidence: ${(d.confidence || 1.0) * 100}%</span>
                    </div>
                    <h4 class="font-bold text-gray-900 text-lg">"${d.term}"</h4>
                    <div class="text-sm text-gray-600 mt-2 flex items-center gap-2">
                        <span class="text-gray-400">Maps to:</span>
                        <div class="flex items-center gap-1 font-medium text-gray-800 bg-gray-100 px-2 py-0.5 rounded text-xs">
                            ${d.category} 
                            ${d.subcategory ? `<svg class="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg> ${d.subcategory}` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (proposal.type === 'metaphor') {
        contentHtml = `
             <div class="flex items-start gap-4">
                <div class="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <div>
                     <div class="flex items-center gap-2 mb-1">
                        <span class="bg-purple-100 text-purple-700 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">False Positive</span>
                    </div>
                     <code class="block bg-gray-50 border border-gray-200 text-gray-800 p-2 rounded-lg mt-2 text-sm font-mono text-center">"${d.pattern}"</code>
                     <p class="text-xs text-gray-500 mt-2">Patterns matching this rule will be ignored.</p>
                </div>
            </div>
        `;
    } else {
        contentHtml = `
             <div class="flex items-start gap-4">
                <div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                </div>
                <div>
                     <div class="flex items-center gap-2 mb-1">
                        <span class="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">Anchor</span>
                    </div>
                     <p class="text-gray-900 italic font-medium">"${d.anchor_text}"</p>
                     <div class="text-sm text-gray-600 mt-2">Trains category: <span class="font-bold text-indigo-700">${d.category}</span></div>
                </div>
            </div>
        `;
    }

    // Actions Section
    let actionsHtml = '';
    const userRole = document.body.getAttribute("data-role");

    if (proposal.status === 'pending_coordinator' && userRole === 'coordinator') {
        actionsHtml = `
            <div class="flex items-center gap-3 mt-4 md:mt-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button onclick="approveProposal('${proposal.id}', 'coordinator')" class="bg-white border border-gray-200 text-green-600 hover:bg-green-50 hover:border-green-200 hover:text-green-700 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                    Approve
                </button>
                <button onclick="rejectProposal('${proposal.id}')" class="bg-white border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-200 hover:text-red-700 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    Reject
                </button>
            </div>
        `;
    } else if (proposal.status === 'pending_super_admin' && userRole === 'super-admin') {
        actionsHtml = `
             <div class="flex items-center gap-3 mt-4 md:mt-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button onclick="approveProposal('${proposal.id}', 'admin')" class="bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-md hover:shadow-lg flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    Verify & Publish
                </button>
                <button onclick="rejectProposal('${proposal.id}')" class="bg-white border text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm">
                    Reject
                </button>
            </div>
        `;
    } else {
        // Status Badge
        let badgeClass = 'bg-gray-100 text-gray-600';
        let statusIcon = '';

        if (proposal.status === 'pending_super_admin') {
            badgeClass = 'bg-blue-50 text-blue-700 border border-blue-100';
            statusIcon = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
        }
        if (proposal.status === 'pending_coordinator') {
            badgeClass = 'bg-yellow-50 text-yellow-700 border border-yellow-100';
            statusIcon = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
        }
        if (proposal.status === 'approved') {
            badgeClass = 'bg-green-50 text-green-700 border border-green-100';
            statusIcon = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
        }
        if (proposal.status === 'rejected') {
            badgeClass = 'bg-red-50 text-red-700 border border-red-100';
            statusIcon = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
        }

        actionsHtml = `<div class="mt-4 md:mt-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide ${badgeClass}">
            ${statusIcon}
            ${proposal.status.replace(/_/g, ' ')}
        </div>`;
    }

    card.innerHTML = contentHtml + actionsHtml;
    container.appendChild(card);
}

// --- ACTIONS ---
window.approveProposal = async (id, level) => {
    if (!confirm("Are you sure you want to approve this proposal?")) return;

    try {
        const endpoint = level === 'admin' ?
            `/api/nlp/proposals/${id}/approve-admin` :
            `/api/nlp/proposals/${id}/approve-coordinator`;

        const res = await apiClient.post(endpoint);
        if (res.success) {
            showMessage("success", "Proposal approved");
            // Reload current view
            const currentRole = document.body.getAttribute("data-role");
            const view = currentRole === 'coordinator' ? 'pending_coordinator' : 'pending_super_admin';
            loadProposals(view);
        }
    } catch (err) {
        showMessage("error", err.message);
    }
};

window.rejectProposal = async (id) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    try {
        const res = await apiClient.post(`/api/nlp/proposals/${id}/reject`, { reason });
        if (res.success) {
            showMessage("success", "Proposal rejected");
            // Reload list
            const currentRole = document.body.getAttribute("data-role");
            const view = currentRole === 'coordinator' ? 'pending_coordinator' : 'pending_super_admin';
            loadProposals(view);
        }
    } catch (err) {
        showMessage("error", err.message);
    }
};

// ============================================================
// SUPER ADMIN DIRECT MANAGEMENT FUNCTIONS
// ============================================================

let currentManagementTab = 'keywords';
let allCategories = []; // Cache for category filter dropdown

// Initialize management section for super-admin
async function initManagement() {
    const userRole = document.body.getAttribute("data-role");
    if (userRole !== 'super-admin') return;

    // Load categories for filter dropdown
    try {
        const res = await apiClient.get('/api/nlp/categories');
        if (res.success) {
            allCategories = res.data;
            populateCategoryFilter();
        }
    } catch (err) {
        console.error('Failed to load categories for filter:', err);
    }

    // Load initial tab
    loadManagementData('keywords');
}

function populateCategoryFilter() {
    const filter = document.getElementById('mgmt-category-filter');
    if (!filter) return;

    filter.innerHTML = '<option value="">All Categories</option>';
    allCategories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.category;
        opt.textContent = cat.category;
        filter.appendChild(opt);
    });
}

// Tab switching
window.switchManagementTab = function (tab) {
    currentManagementTab = tab;

    // Update tab button styles
    document.querySelectorAll('.mgmt-tab-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'shadow-sm', 'text-gray-800');
        btn.classList.add('text-gray-600');
    });
    const activeBtn = document.getElementById(`mgmt-tab-${tab}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-white', 'shadow-sm', 'text-gray-800');
        activeBtn.classList.remove('text-gray-600');
    }

    // Show filter only for anchors tab (keywords uses hierarchy, categories don't need filter)
    const filterWrapper = document.getElementById('mgmt-filter-wrapper');
    if (filterWrapper) {
        filterWrapper.style.display = tab === 'anchors' ? 'flex' : 'none';
    }

    loadManagementData(tab);
};

// Load data based on tab
async function loadManagementData(tab, categoryFilter = '') {
    const container = document.getElementById('mgmt-data-list');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-8 text-gray-500">Loading...</div>';

    try {
        if (tab === 'keywords' || tab === 'hierarchy') {
            // Load hierarchical view
            await loadHierarchicalView(container);
        } else if (tab === 'categories') {
            const res = await apiClient.get('/api/nlp/categories');
            if (!res.success) throw new Error(res.error);
            if (res.data.length === 0) {
                container.innerHTML = '<div class="text-center py-8 text-gray-400">No categories found</div>';
                return;
            }
            container.innerHTML = '';
            renderCategoriesTable(res.data, container);
        } else if (tab === 'anchors') {
            let endpoint = '/api/nlp/anchors';
            if (categoryFilter) endpoint += `?category=${encodeURIComponent(categoryFilter)}`;
            const res = await apiClient.get(endpoint);
            if (!res.success) throw new Error(res.error);
            if (res.data.length === 0) {
                container.innerHTML = '<div class="text-center py-8 text-gray-400">No anchors found</div>';
                return;
            }
            container.innerHTML = '';
            renderAnchorsTable(res.data, container);
        }
    } catch (err) {
        container.innerHTML = `<div class="text-center py-8 text-red-500">Error: ${err.message}</div>`;
    }
}

// ============ HIERARCHICAL ACCORDION VIEW ============

async function loadHierarchicalView(container) {
    // Fetch all keywords and group them
    const res = await apiClient.get('/api/nlp/keywords');
    if (!res.success) throw new Error(res.error);

    const keywords = res.data;
    if (keywords.length === 0) {
        container.innerHTML = `
            <div class="text-center py-16">
                <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
                    </svg>
                </div>
                <p class="text-gray-500 text-lg font-medium">No keywords found</p>
                <p class="text-gray-400 text-sm">Start by adding some keywords to train the AI</p>
            </div>
        `;
        return;
    }

    // Group by category, then by subcategory
    const hierarchy = {};
    keywords.forEach(kw => {
        const cat = kw.category || 'Uncategorized';
        const subcat = kw.subcategory || '(General)';

        if (!hierarchy[cat]) hierarchy[cat] = {};
        if (!hierarchy[cat][subcat]) hierarchy[cat][subcat] = [];
        hierarchy[cat][subcat].push(kw);
    });

    container.innerHTML = '';

    // Summary stats bar
    const totalCategories = Object.keys(hierarchy).length;
    const totalKeywords = keywords.length;
    const statsBar = document.createElement('div');
    statsBar.className = 'mb-6 p-4 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-xl border border-indigo-100 dark:border-indigo-900/50';
    statsBar.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-4">
            <div class="flex items-center gap-6">
                <div class="flex items-center gap-2">
                    <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                        </svg>
                    </div>
                    <div>
                        <p class="text-2xl font-bold text-gray-800 dark:text-white">${totalCategories}</p>
                        <p class="text-xs text-gray-500 uppercase tracking-wide">Categories</p>
                    </div>
                </div>
                <div class="w-px h-10 bg-gray-200 dark:bg-gray-700"></div>
                <div class="flex items-center gap-2">
                    <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/>
                        </svg>
                    </div>
                    <div>
                        <p class="text-2xl font-bold text-gray-800 dark:text-white">${totalKeywords}</p>
                        <p class="text-xs text-gray-500 uppercase tracking-wide">Keywords</p>
                    </div>
                </div>
            </div>
            <div class="text-sm text-gray-500">
                <span class="inline-flex items-center gap-1 px-3 py-1.5 bg-white/80 dark:bg-gray-800/80 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
                    <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    AI Model Active
                </span>
            </div>
        </div>
    `;
    container.appendChild(statsBar);

    // Create accordion
    const accordion = document.createElement('div');
    accordion.className = 'space-y-3';

    // Color palette for categories
    const colorPalettes = [
        { bg: 'from-blue-500 to-indigo-600', light: 'from-blue-50 to-indigo-50', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700', shadow: 'shadow-blue-500/20' },
        { bg: 'from-purple-500 to-pink-600', light: 'from-purple-50 to-pink-50', text: 'text-purple-600', badge: 'bg-purple-100 text-purple-700', shadow: 'shadow-purple-500/20' },
        { bg: 'from-emerald-500 to-teal-600', light: 'from-emerald-50 to-teal-50', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', shadow: 'shadow-emerald-500/20' },
        { bg: 'from-orange-500 to-red-600', light: 'from-orange-50 to-red-50', text: 'text-orange-600', badge: 'bg-orange-100 text-orange-700', shadow: 'shadow-orange-500/20' },
        { bg: 'from-cyan-500 to-blue-600', light: 'from-cyan-50 to-blue-50', text: 'text-cyan-600', badge: 'bg-cyan-100 text-cyan-700', shadow: 'shadow-cyan-500/20' },
        { bg: 'from-rose-500 to-pink-600', light: 'from-rose-50 to-pink-50', text: 'text-rose-600', badge: 'bg-rose-100 text-rose-700', shadow: 'shadow-rose-500/20' },
    ];

    Object.keys(hierarchy).sort().forEach((catName, catIndex) => {
        const catData = hierarchy[catName];
        const subcatCount = Object.keys(catData).length;
        const keywordCount = Object.values(catData).flat().length;
        const colors = colorPalettes[catIndex % colorPalettes.length];

        // Category Accordion Item
        const catItem = document.createElement('div');
        catItem.className = `group rounded-xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg ${colors.shadow} transition-all duration-300`;
        catItem.innerHTML = `
            <button onclick="toggleAccordion('cat-${catIndex}')" 
                class="w-full px-5 py-4 flex items-center justify-between bg-gradient-to-r ${colors.light} dark:from-gray-800 dark:to-gray-800 hover:brightness-95 transition-all duration-200 group-hover:brightness-95">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${colors.bg} flex items-center justify-center shadow-lg ${colors.shadow} transform group-hover:scale-110 transition-transform duration-200">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                        </svg>
                    </div>
                    <div class="text-left">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-gray-800 dark:text-white text-lg">${catName}</span>
                            <svg id="cat-icon-${catIndex}" class="w-4 h-4 ${colors.text} transform transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                        </div>
                        <div class="flex items-center gap-2 mt-1">
                            <span class="text-xs ${colors.badge} px-2 py-0.5 rounded-full font-medium">${subcatCount} subcategories</span>
                            <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium dark:bg-gray-700 dark:text-gray-300">${keywordCount} keywords</span>
                        </div>
                    </div>
                </div>
                <button onclick="event.stopPropagation(); showAddKeywordModal('${catName}')" 
                    class="opacity-0 group-hover:opacity-100 bg-white dark:bg-gray-700 ${colors.text} hover:bg-gray-50 dark:hover:bg-gray-600 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-md transition-all duration-200 hover:scale-105 border border-gray-200 dark:border-gray-600">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    Add Keyword
                </button>
            </button>
            <div id="cat-${catIndex}" class="hidden animate-slideDown">
                <div class="p-4 space-y-2 bg-gradient-to-b from-gray-50/80 to-white dark:from-gray-900/50 dark:to-gray-800 border-t border-gray-100 dark:border-gray-700" id="subcats-${catIndex}">
                </div>
            </div>
        `;
        accordion.appendChild(catItem);

        // Render subcategories inside
        const subcatsContainer = catItem.querySelector(`#subcats-${catIndex}`);
        Object.keys(catData).sort().forEach((subcatName, subcatIndex) => {
            const kwList = catData[subcatName];
            const subcatId = `subcat-${catIndex}-${subcatIndex}`;

            const subcatItem = document.createElement('div');
            subcatItem.className = 'group/sub rounded-lg overflow-hidden bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200';
            subcatItem.innerHTML = `
                <button onclick="toggleAccordion('${subcatId}')" 
                    class="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center shadow-md shadow-purple-500/20">
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                            </svg>
                        </div>
                        <div>
                            <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">${subcatName}</span>
                            <span class="ml-2 text-xs bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 px-2 py-0.5 rounded-full font-medium dark:from-purple-900/50 dark:to-indigo-900/50 dark:text-purple-300">${kwList.length} words</span>
                        </div>
                        <svg id="icon-${subcatId}" class="w-4 h-4 text-gray-400 transform transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </div>
                    <button onclick="event.stopPropagation(); showAddKeywordModal('${catName}', '${subcatName === '(General)' ? '' : subcatName}')" 
                        class="opacity-0 group-hover/sub:opacity-100 text-purple-600 hover:text-purple-800 text-xs font-semibold flex items-center gap-1 bg-purple-50 dark:bg-purple-900/30 px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-105">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                        Add
                    </button>
                </button>
                <div id="${subcatId}" class="hidden animate-slideDown">
                    <div class="px-4 py-3 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900/30 dark:to-gray-800 border-t border-gray-100 dark:border-gray-700">
                        <div class="flex flex-wrap gap-2">
                            ${kwList.map((kw, kwIndex) => `
                                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-sm text-gray-700 dark:text-gray-300 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 dark:hover:border-red-500/50 transition-all duration-200 group/kw shadow-sm hover:shadow-md cursor-default" style="animation: fadeInUp 0.3s ease-out ${kwIndex * 0.05}s both">
                                    <span class="w-1.5 h-1.5 rounded-full bg-gradient-to-r ${colors.bg}"></span>
                                    "${kw.term}"
                                    <button onclick="deleteKeyword('${kw.id}')" class="ml-1 text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 opacity-0 group-hover/kw:opacity-100 transition-all duration-200 hover:scale-125" title="Delete keyword">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                    </button>
                                </span>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
            subcatsContainer.appendChild(subcatItem);
        });
    });

    container.appendChild(accordion);

    // Add animation styles if not already present
    if (!document.getElementById('nlp-accordion-styles')) {
        const style = document.createElement('style');
        style.id = 'nlp-accordion-styles';
        style.textContent = `
            @keyframes fadeInUp {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes slideDown {
                from { opacity: 0; max-height: 0; }
                to { opacity: 1; max-height: 2000px; }
            }
            .animate-slideDown {
                animation: slideDown 0.3s ease-out forwards;
            }
        `;
        document.head.appendChild(style);
    }
}

// Toggle accordion sections
window.toggleAccordion = function (id) {
    const content = document.getElementById(id);
    const icon = document.getElementById(`icon-${id}`) || document.getElementById(`cat-icon-${id.replace('cat-', '')}`);

    if (content) {
        content.classList.toggle('hidden');
        if (icon) {
            icon.classList.toggle('rotate-180');
        }
    }
};


// Show add keyword modal with pre-filled category/subcategory
window.showAddKeywordModal = function (category, subcategory = '') {
    const modal = document.getElementById('add-nlp-modal');
    const title = document.getElementById('add-modal-title');
    const form = document.getElementById('add-nlp-form');

    if (!modal || !form) return;

    title.textContent = 'Add New Keyword';
    form.dataset.type = 'keyword';

    document.getElementById('add-form-fields').innerHTML = `
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Term *</label>
            <input type="text" name="term" required class="w-full rounded-lg border-gray-200 p-2 border text-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="e.g. broken pipe">
        </div>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <input type="text" name="category" value="${category}" required class="w-full rounded-lg border-gray-200 p-2 border text-gray-800 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white" readonly>
        </div>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
            <input type="text" name="subcategory" value="${subcategory}" class="w-full rounded-lg border-gray-200 p-2 border text-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Optional">
        </div>
        <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Confidence (0-1)</label>
            <input type="number" name="confidence" step="0.1" min="0" max="1" value="0.8" class="w-full rounded-lg border-gray-200 p-2 border text-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
        </div>
    `;
    modal.classList.remove('hidden');
};

// Render Categories Table (unchanged but simplified)
function renderCategoriesTable(categories, container) {
    const table = document.createElement('div');
    table.className = 'overflow-x-auto';
    table.innerHTML = `
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Parent</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Urgency</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-100 dark:bg-gray-900 dark:divide-gray-700" id="categories-tbody">
            </tbody>
        </table>
    `;
    container.appendChild(table);

    const tbody = document.getElementById('categories-tbody');
    categories.forEach(cat => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors dark:hover:bg-gray-800';
        row.innerHTML = `
            <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">${cat.category}</td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">${cat.parent_category || '-'}</td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${getUrgencyClass(cat.urgency_rating)}">${cat.urgency_rating}</span>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500 max-w-xs truncate dark:text-gray-400">${cat.description || '-'}</td>
            <td class="px-4 py-3 text-right">
                <!-- Delete Removed for Safety -->
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Render Anchors Table
function renderAnchorsTable(anchors, container) {
    const table = document.createElement('div');
    table.className = 'overflow-x-auto';
    table.innerHTML = `
        <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
                <tr>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Anchor Text</th>
                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-100" id="anchors-tbody">
            </tbody>
        </table>
    `;
    container.appendChild(table);

    const tbody = document.getElementById('anchors-tbody');
    anchors.forEach(anchor => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';
        row.innerHTML = `
            <td class="px-4 py-3 text-sm font-medium text-gray-900 italic">"${anchor.anchor_text}"</td>
            <td class="px-4 py-3 text-sm text-gray-600">${anchor.category}</td>
            <td class="px-4 py-3 text-right">
                <button onclick="deleteAnchor('${anchor.id}')" class="text-red-600 hover:text-red-800 text-sm font-medium">
                    Delete
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function getUrgencyClass(urgency) {
    if (urgency >= 70) return 'bg-red-100 text-red-700';
    if (urgency >= 50) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
}

// Filter by category
window.filterByCategory = function () {
    const filter = document.getElementById('mgmt-category-filter');
    const category = filter ? filter.value : '';
    loadManagementData(currentManagementTab, category);
};

// Delete operations
window.deleteKeyword = async function (id) {
    if (!confirm('Are you sure you want to delete this keyword?')) return;

    try {
        const res = await apiClient.delete(`/api/nlp/keywords/${id}`);
        if (res.success) {
            showMessage('success', 'Keyword deleted');
            loadManagementData('keywords');
        }
    } catch (err) {
        showMessage('error', err.message);
    }
};

window.deleteCategory = async function (category) {
    if (!confirm(`Are you sure you want to delete category "${category}"? This may fail if keywords are linked.`)) return;

    try {
        const res = await apiClient.delete(`/api/nlp/categories/${encodeURIComponent(category)}`);
        if (res.success) {
            showMessage('success', 'Category deleted');
            loadManagementData('categories');
        }
    } catch (err) {
        showMessage('error', err.message);
    }
};

window.deleteAnchor = async function (id) {
    if (!confirm('Are you sure you want to delete this anchor?')) return;

    try {
        const res = await apiClient.delete(`/api/nlp/anchors/${id}`);
        if (res.success) {
            showMessage('success', 'Anchor deleted');
            loadManagementData('anchors');
        }
    } catch (err) {
        showMessage('error', err.message);
    }
};

// Add dropdown toggle
window.toggleAddDropdown = function () {
    const menu = document.getElementById('add-dropdown-menu');
    const icon = document.getElementById('add-dropdown-icon');

    if (menu) {
        menu.classList.toggle('hidden');
        if (icon) {
            icon.classList.toggle('rotate-180');
        }
    }

    // Close on click outside
    if (!menu.classList.contains('hidden')) {
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!document.getElementById('add-dropdown-wrapper')?.contains(e.target)) {
                    menu.classList.add('hidden');
                    if (icon) icon.classList.remove('rotate-180');
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    }
};

// Add operations
window.showAddModal = function (type) {
    const modal = document.getElementById('add-nlp-modal');
    const title = document.getElementById('add-modal-title');
    const form = document.getElementById('add-nlp-form');

    if (!modal || !form) return;

    // Set modal content based on type
    const typeLabels = {
        keyword: 'Keyword',
        category: 'Category',
        subcategory: 'Subcategory',
        anchor: 'Anchor'
    };
    title.textContent = `Add New ${typeLabels[type] || type}`;
    form.dataset.type = type;

    let formHtml = '';

    if (type === 'keyword') {
        formHtml = `
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Term *</label>
                <input type="text" name="term" required 
                    class="w-full rounded-xl border-gray-200 dark:border-gray-600 p-3 border text-gray-800 dark:text-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                    placeholder="e.g. butas sa kalsada, sirang tubo">
                <p class="text-xs text-gray-400 mt-1">The word or phrase to train the AI</p>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category *</label>
                <select name="category" required 
                    class="w-full rounded-xl border-gray-200 dark:border-gray-600 p-3 border text-gray-800 dark:text-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500">
                    <option value="">Select Category...</option>
                    ${allCategories.map(c => `<option value="${c.category}">${c.category}</option>`).join('')}
                </select>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subcategory</label>
                <input type="text" name="subcategory" 
                    class="w-full rounded-xl border-gray-200 dark:border-gray-600 p-3 border text-gray-800 dark:text-white dark:bg-gray-700 focus:ring-2 focus:ring-blue-500" 
                    placeholder="Optional - e.g. Water Pipes, Drainage">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confidence</label>
                <div class="flex items-center gap-4">
                    <input type="range" name="confidence" min="0" max="1" step="0.1" value="0.8" 
                        class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        oninput="this.nextElementSibling.textContent = Math.round(this.value * 100) + '%'">
                    <span class="text-sm font-semibold text-gray-700 dark:text-gray-300 w-12 text-right">80%</span>
                </div>
            </div>
        `;
    } else if (type === 'category') {
        formHtml = `
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category Name *</label>
                <input type="text" name="category" required 
                    class="w-full rounded-xl border-gray-200 dark:border-gray-600 p-3 border text-gray-800 dark:text-white dark:bg-gray-700 focus:ring-2 focus:ring-emerald-500" 
                    placeholder="e.g. Water Supply, Roads, Electricity">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Parent Category</label>
                <select name="parent_category" 
                    class="w-full rounded-xl border-gray-200 dark:border-gray-600 p-3 border text-gray-800 dark:text-white dark:bg-gray-700 focus:ring-2 focus:ring-emerald-500">
                    <option value="">None (Top Level)</option>
                    ${allCategories.map(c => `<option value="${c.category}">${c.category}</option>`).join('')}
                </select>
                <p class="text-xs text-gray-400 mt-1">Leave empty for a main category</p>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Urgency Rating</label>
                <div class="flex items-center gap-4">
                    <input type="range" name="urgency_rating" min="0" max="100" step="10" value="30" 
                        class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                        oninput="this.nextElementSibling.textContent = this.value; this.nextElementSibling.className = this.value >= 70 ? 'text-sm font-semibold w-12 text-right text-red-600' : this.value >= 50 ? 'text-sm font-semibold w-12 text-right text-yellow-600' : 'text-sm font-semibold w-12 text-right text-green-600'">
                    <span class="text-sm font-semibold w-12 text-right text-green-600">30</span>
                </div>
                <p class="text-xs text-gray-400 mt-1">0-30: Low, 40-60: Medium, 70-100: High Priority</p>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea name="description" rows="2" 
                    class="w-full rounded-xl border-gray-200 dark:border-gray-600 p-3 border text-gray-800 dark:text-white dark:bg-gray-700 focus:ring-2 focus:ring-emerald-500" 
                    placeholder="Optional description of this category"></textarea>
            </div>
        `;
    } else if (type === 'subcategory') {
        formHtml = `
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Parent Category *</label>
                <select name="parent_category" required 
                    class="w-full rounded-xl border-gray-200 dark:border-gray-600 p-3 border text-gray-800 dark:text-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500">
                    <option value="">Select Parent Category...</option>
                    ${allCategories.map(c => `<option value="${c.category}">${c.category}</option>`).join('')}
                </select>
                <p class="text-xs text-gray-400 mt-1">The main category this subcategory belongs to</p>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subcategory Name *</label>
                <input type="text" name="category" required 
                    class="w-full rounded-xl border-gray-200 dark:border-gray-600 p-3 border text-gray-800 dark:text-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500" 
                    placeholder="e.g. Leaking Pipes, Broken Meter">
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Urgency Rating</label>
                <div class="flex items-center gap-4">
                    <input type="range" name="urgency_rating" min="0" max="100" step="10" value="30" 
                        class="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                        oninput="this.nextElementSibling.textContent = this.value; this.nextElementSibling.className = this.value >= 70 ? 'text-sm font-semibold w-12 text-right text-red-600' : this.value >= 50 ? 'text-sm font-semibold w-12 text-right text-yellow-600' : 'text-sm font-semibold w-12 text-right text-green-600'">
                    <span class="text-sm font-semibold w-12 text-right text-green-600">30</span>
                </div>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea name="description" rows="2" 
                    class="w-full rounded-xl border-gray-200 dark:border-gray-600 p-3 border text-gray-800 dark:text-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500" 
                    placeholder="Optional description"></textarea>
            </div>
        `;
    } else if (type === 'anchor') {
        formHtml = `
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Anchor Text *</label>
                <input type="text" name="anchor_text" required 
                    class="w-full rounded-xl border-gray-200 dark:border-gray-600 p-3 border text-gray-800 dark:text-white dark:bg-gray-700 focus:ring-2 focus:ring-orange-500" 
                    placeholder="e.g. ang kalsada dito sobrang lubak">
                <p class="text-xs text-gray-400 mt-1">Example sentence that maps to a category</p>
            </div>
            <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category *</label>
                <select name="category" required 
                    class="w-full rounded-xl border-gray-200 dark:border-gray-600 p-3 border text-gray-800 dark:text-white dark:bg-gray-700 focus:ring-2 focus:ring-orange-500">
                    <option value="">Select Category...</option>
                    ${allCategories.map(c => `<option value="${c.category}">${c.category}</option>`).join('')}
                </select>
            </div>
        `;
    }

    document.getElementById('add-form-fields').innerHTML = formHtml;
    modal.classList.remove('hidden');
};


window.closeAddModal = function () {
    const modal = document.getElementById('add-nlp-modal');
    if (modal) modal.classList.add('hidden');
};

window.submitAddForm = async function (e) {
    e.preventDefault();
    const form = document.getElementById('add-nlp-form');
    const type = form.dataset.type;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Clean up empty values
    Object.keys(data).forEach(key => {
        if (data[key] === '') delete data[key];
    });

    try {
        let endpoint = '';
        let actualType = type;

        if (type === 'keyword') {
            endpoint = '/api/nlp/keywords';
        } else if (type === 'category') {
            endpoint = '/api/nlp/categories';
        } else if (type === 'subcategory') {
            // Subcategory is just a category with a parent_category
            endpoint = '/api/nlp/categories';
            actualType = 'subcategory';
        } else if (type === 'anchor') {
            endpoint = '/api/nlp/anchors';
        }

        const res = await apiClient.post(endpoint, data);
        if (res.success) {
            const typeLabel = actualType.charAt(0).toUpperCase() + actualType.slice(1);
            showMessage('success', `${typeLabel} added successfully!`);
            closeAddModal();

            // Refresh the current view
            loadManagementData(currentManagementTab);

            // Refresh categories cache if we added a category or subcategory
            if (type === 'category' || type === 'subcategory') {
                const catRes = await apiClient.get('/api/nlp/categories');
                if (catRes.success) {
                    allCategories = catRes.data;
                    populateCategoryFilter();
                }
            }
        }
    } catch (err) {
        showMessage('error', err.message);
    }
};



// Export for initialization
window.initManagement = initManagement;

console.log('[NLP-Training] All window functions exported:', {
    showAddModal: !!window.showAddModal,
    toggleAddDropdown: !!window.toggleAddDropdown,
    showAddKeywordModal: !!window.showAddKeywordModal,
    closeAddModal: !!window.closeAddModal,
    submitAddForm: !!window.submitAddForm
});
