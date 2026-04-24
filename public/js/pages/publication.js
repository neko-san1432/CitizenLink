/**
 * Communications Hub - Intelligence Variant
 * Handles multi-content broadcasting and previewing.
 */
import showMessage from "../components/toast.js";

let currentType = "news";
let currentList = [];
let filters = {
    search: "",
    startDate: "",
    endDate: "",
    category: "",
    sort: "newest"
};

document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    initFilters();
    initModal();
    initListInteractions();
    updateBranding();
    loadContent("news");
    checkPermissions();
});

function updateBranding() {
    const titleEl = document.querySelector(".dashboard-header-section h1");
    const subEl = document.querySelector(".dashboard-header-section p");
    const path = window.location.pathname;

    if (path.includes("/publish")) {
        if (titleEl) titleEl.innerHTML = "📑 Public Bulletins";
        if (subEl) subEl.innerHTML = "Broadcast alerts, news, and events to the community.";
        document.title = "Public Bulletins | DRIMS Intelligence";
    } else {
        if (titleEl) titleEl.innerHTML = "📑 Public Bulletins";
        if (subEl) subEl.innerHTML = "Browse official community announcements and upcoming events.";
        document.title = "Public Bulletins | DRIMS Intelligence";
    }
}

function initListInteractions() {
    const list = document.getElementById("pub-list");
    if (!list) return;

    list.addEventListener("click", (e) => {
        const card = e.target.closest(".pub-card");
        if (!card) return;

        list.querySelectorAll(".pub-card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        
        const index = card.dataset.idx;
        if (currentList[index]) {
            renderDetail(currentList[index]);
        }
    });
}

function initTabs() {
    document.querySelectorAll(".pub-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".pub-tab").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const type = btn.dataset.type;
            currentType = type;
            loadContent(type);
        });
    });
}

function initFilters() {
    const searchInput = document.getElementById("search-input");
    const startDate = document.getElementById("filter-start-date");
    const endDate = document.getElementById("filter-end-date");
    const category = document.getElementById("filter-category");
    const sort = document.getElementById("filter-sort");
    const clearBtn = document.getElementById("btn-clear-filters");

    let debounceTimer;
    searchInput?.addEventListener("input", (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            filters.search = e.target.value;
            loadContent(currentType);
        }, 300);
    });

    [startDate, endDate, category, sort].forEach(el => {
        el?.addEventListener("change", () => {
            filters.startDate = startDate.value;
            filters.endDate = endDate.value;
            filters.category = category.value;
            filters.sort = sort.value;
            loadContent(currentType);
        });
    });

    clearBtn?.addEventListener("click", () => {
        searchInput.value = "";
        startDate.value = "";
        endDate.value = "";
        category.value = "";
        sort.value = "newest";
        filters = { search: "", startDate: "", endDate: "", category: "", sort: "newest" };
        loadContent(currentType);
    });
}

function initModal() {
    const modal = document.getElementById("modal-create");
    const btnCreate = document.getElementById("btn-create");
    const btnCancel = document.getElementById("btn-cancel");
    const typeSelect = document.getElementById("pub-type");
    const eventGroup = document.getElementById("event-date-group");
    const form = document.getElementById("form-publish");

    btnCreate?.addEventListener("click", () => modal.style.display = "flex");
    btnCancel?.addEventListener("click", () => modal.style.display = "none");

    typeSelect?.addEventListener("change", (e) => {
        eventGroup.style.display = e.target.value === "events" ? "block" : "none";
    });

    form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        await handlePublish();
    });
}

async function handlePublish() {
    const type = document.getElementById("pub-type").value;
    const title = document.getElementById("pub-title").value;
    const content = document.getElementById("pub-content").value;
    const date = document.getElementById("pub-event-date").value;

    const payload = {
        title,
        content,
        status: "published"
    };

    if (type === "events") {
        payload.event_date = date || new Date().toISOString();
        payload.description = content;
    }

    if (type === "notices") payload.status = "active";

    try {
        const res = await fetch(`/api/content/${type}`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "X-CSRF-Token": getCsrfToken() 
            },
            body: JSON.stringify(payload),
            credentials: "include"
        });

        const result = await res.json();
        if (result.success) {
            showMessage("success", "Bulletin published successfully!");
            document.getElementById("modal-create").style.display = "none";
            document.getElementById("form-publish").reset();
            loadContent(type);
        } else {
            showMessage("error", result.error || "Failed to publish");
        }
    } catch (err) {
        showMessage("error", "Network intelligence error");
    }
}

async function loadContent(type) {
    const list = document.getElementById("pub-list");
    const detail = document.getElementById("pub-detail");
    
    list.innerHTML = `<div style="padding: 20px; text-align: center; color: #64748b;">Syncing content...</div>`;

    try {
        const params = new URLSearchParams(filters);
        const base = type === "events" ? "/api/content/events" : `/api/content/${type}`;
        const res = await fetch(`${base}?status=${type === "notices" ? "active" : "published"}&${params.toString()}`);
        const json = await res.json();
        
        currentList = json.data || [];
        
        if (currentList.length === 0) {
            list.innerHTML = `<div style="padding: 40px; text-align: center; color: #64748b;">No ${type} found matching filters.</div>`;
            renderEmptyDetail();
            return;
        }

        const iconMap = {
            "Infrastructure": { icon: "A", bg: "#2563eb", prefix: "INFRA" }, 
            "Public Safety": { icon: "S", bg: "#eab308", prefix: "SAFE" }, 
            "Utilities": { icon: "U", bg: "#eab308", prefix: "UTIL" }, 
            "Health": { icon: "H", bg: "#16a34a", prefix: "HLTH" }, 
            "Environment": { icon: "E", bg: "#9333ea", prefix: "ENV" }, 
            "Technology": { icon: "T", bg: "#0d9488", prefix: "TECH" }, 
            "General": { icon: "G", bg: "#64748b", prefix: "GEN" }
        };

        const priorityColors = {
            "Low": { color: "#60a5fa", border: "rgba(96, 165, 250, 0.4)", led: "led-blue" },
            "Medium": { color: "#fbbf24", border: "rgba(251, 191, 36, 0.4)", led: "led-yellow" },
            "High": { color: "#ef4444", border: "rgba(239, 68, 68, 0.4)", led: "led-red" },
            "default": { color: "#94a3b8", border: "rgba(148, 163, 184, 0.4)", led: "led-gray" }
        };

        list.innerHTML = `
            <div class="pub-list-container" style="display: flex; flex-direction: column; height: 100%; position: relative;">
                <div class="pub-cards-scroll" style="flex: 1; overflow-y: auto; padding-right: 8px; padding-bottom: 70px;">
                    ${currentList.map((item, idx) => {
                        const catInfo = iconMap[item.category] || iconMap[item.organizer] || iconMap["General"];
                        const priority = item.priority || "Low";
                        const pColor = priorityColors[priority] || priorityColors["default"];
                        
                        return `
                            <div class="pub-card" data-idx="${idx}" style="display: flex; gap: 16px; align-items: center; padding: 16px; margin-bottom: 12px;">
                                <div style="width: 44px; height: 44px; background: ${catInfo.bg}; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.3em; font-weight: 900; color: #fff; flex-shrink: 0; box-shadow: 0 0 15px ${catInfo.bg}44;">
                                    ${catInfo.icon}
                                </div>
                                <div style="flex: 1; min-width: 0; pointer-events: none;">
                                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; color: ${pColor.color}; margin-bottom: 2px; opacity: 0.8; letter-spacing: 0.05em;">
                                        ${catInfo.prefix} // PRTY: ${priority.toUpperCase()}
                                    </div>
                                    <div style="font-weight: 700; font-size: 0.95rem; color: #fff; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.title}</div>
                                    <div style="font-size: 0.75rem; color: #94a3b8; display: flex; gap: 6px; align-items: center; font-family: 'JetBrains Mono', monospace;">
                                        <span>${new Date(item.published_at || item.created_at || item.event_date).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</span>
                                    </div>
                                </div>
                                <div style="flex-shrink: 0; padding: 3px 8px; border: 1px solid ${pColor.border}; border-radius: 4px; color: ${pColor.color}; font-size: 0.7rem; font-weight: 800; font-family: 'JetBrains Mono', monospace; text-transform: uppercase;">
                                    ${priority}
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
                <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 12px 0 0 0; background: #020617; pointer-events: none;">
                    <button style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.75rem; pointer-events: auto; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); padding: 12px; color: #3b82f6; border-radius: 8px; cursor: pointer; font-family: 'JetBrains Mono', monospace; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;">
                        <svg style="width: 14px; height: 14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                        View all bulletins
                        <svg style="width: 14px; height: 14px; margin-left: auto;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
                    </button>
                </div>
            </div>
        `;
    } catch (err) {
        list.innerHTML = `<div style="color: #ef4444; padding: 20px;">Connection failure.</div>`;
    }
}

function renderDetail(item) {
    const detail = document.getElementById("pub-detail");
    const date = new Date(item.published_at || item.created_at || item.event_date).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
    
    detail.innerHTML = `
        <div style="animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; height: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div style="display: flex; gap: 12px; align-items: center;">
                    <span class="tactical-badge" style="border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; background: rgba(255,255,255,0.03);">${currentType}</span>
                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: #64748b; letter-spacing: 0.05em;">
                        REF_ID: ${item.id || 'N/A'} // PUB_DATE: ${date.toUpperCase()}
                    </div>
                </div>
                <div class="tactical-badge" style="border: 1px solid rgba(96, 165, 250, 0.4); color: #60a5fa; background: rgba(59, 130, 246, 0.1); padding: 6px 16px;">
                    ${item.priority || "Low"} Priority
                </div>
            </div>
            
            <h2 style="font-size: 2.2em; font-weight: 800; color: #fff; margin: 0 0 16px 0; line-height: 1.2; letter-spacing: -0.02em;">${item.title}</h2>
            
            <div style="display: flex; gap: 32px; align-items: center; color: #94a3b8; font-size: 0.85rem; margin-bottom: 32px; font-family: 'JetBrains Mono', monospace;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <svg style="width: 16px; height: 16px; color: #3b82f6;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    DIGOS_CITY.SYS
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <svg style="width: 16px; height: 16px; color: #cbd5e1;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                    ${item.category || item.organizer || "GENERAL_COMM"}
                </div>
            </div>

            <div style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; padding: 20px; display: flex; gap: 16px; margin-bottom: 40px; align-items: flex-start; box-shadow: 0 0 20px rgba(59, 130, 246, 0.05);">
                <svg style="width: 24px; height: 24px; color: #60a5fa; flex-shrink: 0;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <div style="font-size: 1rem; color: #cbd5e1; line-height: 1.7;">
                    ${item.content || item.description || "No detailed mission data provided."}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px;">
                <div style="background: rgba(255,255,255,0.02); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03);">
                    <div style="display: flex; align-items: center; gap: 6px; color: #64748b; font-size: 0.7rem; margin-bottom: 6px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase;">
                        Start Date
                    </div>
                    <div style="color: #fff; font-weight: 700; font-size: 0.95rem;">${new Date(item.created_at).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</div>
                </div>
                <div style="background: rgba(255,255,255,0.02); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03);">
                    <div style="display: flex; align-items: center; gap: 6px; color: #64748b; font-size: 0.7rem; margin-bottom: 6px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase;">
                        End Date
                    </div>
                    <div style="color: #fff; font-weight: 700; font-size: 0.95rem;">${item.event_date ? new Date(item.event_date).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}) : "PERMANENT"}</div>
                </div>
                <div style="background: rgba(255,255,255,0.02); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03);">
                    <div style="display: flex; align-items: center; gap: 6px; color: #64748b; font-size: 0.7rem; margin-bottom: 6px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase;">
                        Status
                    </div>
                    <div style="color: #4ade80; font-weight: 700; font-size: 0.95rem;">ACTIVE_SYS</div>
                </div>
                <div style="background: rgba(255,255,255,0.02); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03);">
                    <div style="display: flex; align-items: center; gap: 6px; color: #64748b; font-size: 0.7rem; margin-bottom: 6px; font-family: 'JetBrains Mono', monospace; text-transform: uppercase;">
                        Target
                    </div>
                    <div style="color: #fff; font-weight: 700; font-size: 0.95rem;">PUBLIC_ALL</div>
                </div>
            </div>

            <div style="margin-bottom: 40px;">
                <div style="font-family: 'JetBrains Mono', monospace; color: #f8fafc; font-size: 0.75rem; font-weight: 700; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6;">Attachments // Link_Count: 02</div>
                <div style="display: flex; gap: 20px;">
                    <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.05); padding: 16px; border-radius: 12px; display: flex; align-items: center; gap: 16px; min-width: 240px; cursor: pointer; transition: all 0.2s;">
                        <div style="background: #ef4444; color: #fff; border-radius: 6px; padding: 8px; font-size: 0.75rem; font-weight: 900; font-family: 'JetBrains Mono', monospace;">PDF</div>
                        <div style="flex: 1;">
                            <div style="color: #fff; font-size: 0.9rem; font-weight: 600;">MISSION_PARAM.PDF</div>
                            <div style="color: #64748b; font-size: 0.75rem; font-family: 'JetBrains Mono', monospace;">DATA_PKG // 1.2 MB</div>
                        </div>
                        <svg style="width: 18px; height: 18px; color: #64748b;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    </div>
                    <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.05); padding: 16px; border-radius: 12px; display: flex; align-items: center; gap: 16px; min-width: 240px; cursor: pointer; transition: all 0.2s;">
                        <div style="background: #3b82f6; color: #fff; border-radius: 6px; padding: 8px; font-size: 0.75rem; font-weight: 900; font-family: 'JetBrains Mono', monospace;">IMG</div>
                        <div style="flex: 1;">
                            <div style="color: #fff; font-size: 0.9rem; font-weight: 600;">VISUAL_RECON.JPG</div>
                            <div style="color: #64748b; font-size: 0.75rem; font-family: 'JetBrains Mono', monospace;">DATA_PKG // 845 KB</div>
                        </div>
                        <svg style="width: 18px; height: 18px; color: #64748b;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; gap: 16px; margin-top: auto; justify-content: flex-end; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.05);">
                <button style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #f8fafc; padding: 10px 20px; border-radius: 8px; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; font-family: 'JetBrains Mono', monospace; text-transform: uppercase;">
                    <svg style="width: 14px; height: 14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    Modify
                </button>
                <button style="background: #2563eb; border: none; color: #fff; padding: 10px 24px; border-radius: 8px; font-size: 0.85rem; font-weight: 800; display: flex; align-items: center; gap: 8px; cursor: pointer; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; box-shadow: 0 0 20px rgba(37, 99, 235, 0.4);">
                    <svg style="width: 14px; height: 14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                    Deploy_Now
                </button>
                <button style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #ef4444; padding: 10px 20px; border-radius: 8px; font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer; font-family: 'JetBrains Mono', monospace; text-transform: uppercase;">
                    <svg style="width: 14px; height: 14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    Purge
                </button>
            </div>
        </div>
    `;
}

function renderEmptyDetail() {
    document.getElementById("pub-detail").innerHTML = `
        <div style="text-align: center; margin-top: 100px; color: #64748b;">
            <div style="font-size: 3em; margin-bottom: 20px;">📄</div>
            <h3>Select a bulletin to preview</h3>
            <p>Select an item from the sidebar to view full details.</p>
        </div>
    `;
}

function getCsrfToken() {
    return document.cookie.split("; ").find(r => r.startsWith("XSRF-TOKEN="))?.split("=")[1] || "";
}

async function checkPermissions() {
    try {
        const res = await fetch("/api/user/role", { credentials: "include" });
        const json = await res.json();
        const role = String(json?.data?.role || "").toLowerCase();
        const path = window.location.pathname;
        
        const btn = document.getElementById("btn-create");
        // Only hide create button for citizens; allow LGU to see it on the unified Bulletins page
        if (role === "citizen") {
            if (btn) btn.style.display = "none";
        }
    } catch (e) {}
}

