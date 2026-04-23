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
            "Infrastructure": "🏛️",
            "Public Safety": "🛡️",
            "Utilities": "💡",
            "Health": "🏥",
            "Environment": "🌿",
            "Technology": "💻",
            "General": "📄"
        };

        list.innerHTML = `
            <div class="pub-list-container" style="display: flex; flex-direction: column; height: 100%; position: relative;">
                <div class="pub-cards-scroll" style="flex: 1; overflow-y: auto; padding: 12px; padding-bottom: 70px;">
                    ${currentList.map((item, idx) => {
                        const icon = iconMap[item.category] || iconMap[item.organizer] || "📄";
                        return `
                            <div class="pub-card" data-idx="${idx}" style="display: flex; gap: 16px; align-items: flex-start; padding: 12px; margin-bottom: 12px; transition: all 0.2s;">
                                <div style="width: 42px; height: 42px; background: rgba(59, 130, 246, 0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.25em; flex-shrink: 0; border: 1px solid rgba(59, 130, 246, 0.15);">
                                    ${icon}
                                </div>
                                <div style="flex: 1; min-width: 0; pointer-events: none;">
                                    <div style="font-weight: 600; font-size: 1rem; color: #fff; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.title}</div>
                                    <div style="font-size: 0.85em; color: #94a3b8; display: flex; gap: 8px; align-items: center;">
                                        <span>${new Date(item.published_at || item.created_at || item.event_date).toLocaleDateString()}</span>
                                        <span style="opacity: 0.3;">|</span>
                                        <span style="font-weight: 500;">${item.category || item.organizer || "General"}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join("")}
                </div>
                <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 16px; background: linear-gradient(transparent, rgba(15, 23, 42, 0.95) 20%); pointer-events: none;">
                    <button class="btn btn-secondary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.85em; pointer-events: auto; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.05);">
                        <svg style="width: 14px; height: 14px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h7"/></svg>
                        View all bulletins
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
        <div style="animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); max-width: 800px;">
            <div style="display: flex; gap: 8px; margin-bottom: 20px;">
                <span style="background: rgba(59, 130, 246, 0.1); color: #60a5fa; padding: 4px 12px; border-radius: 99px; font-size: 0.75em; font-weight: 700;">${currentType.toUpperCase()}</span>
                <span style="color: #64748b; font-size: 0.85em;">Published on ${date}</span>
            </div>
            
            <h2 style="font-size: 2.4em; font-weight: 800; color: #fff; margin: 0 0 12px 0; line-height: 1.2;">${item.title}</h2>
            
            <div style="display: flex; gap: 16px; align-items: center; color: #94a3b8; font-size: 0.9em; margin-bottom: 32px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="opacity: 0.7;">📍</span> Digos City, Davao del Sur
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="opacity: 0.7;">🏛️</span> ${item.category || item.organizer || "General"}
                </div>
            </div>

            <div style="background: rgba(59, 130, 246, 0.05); border: 1px solid rgba(59, 130, 246, 0.1); border-radius: 12px; padding: 20px; display: flex; gap: 16px; margin-bottom: 32px;">
                <div style="color: #60a5fa; font-size: 1.4em;">ℹ️</div>
                <div style="font-size: 0.95em; color: #cbd5e1; line-height: 1.6;">
                    Please be advised that this bulletin contains official information regarding ${item.title.toLowerCase()}. Follow any instructions provided below carefully.
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 32px;">
                <div style="background: rgba(30, 41, 59, 0.3); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03);">
                    <div style="color: #64748b; font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Start Date</div>
                    <div style="color: #fff; font-weight: 600;">${new Date(item.created_at).toLocaleDateString()}</div>
                </div>
                <div style="background: rgba(30, 41, 59, 0.3); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03);">
                    <div style="color: #64748b; font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">End Date</div>
                    <div style="color: #fff; font-weight: 600;">${item.event_date ? new Date(item.event_date).toLocaleDateString() : "Indefinite"}</div>
                </div>
                <div style="background: rgba(30, 41, 59, 0.3); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03);">
                    <div style="color: #64748b; font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Target Audience</div>
                    <div style="color: #fff; font-weight: 600;">All Residents</div>
                </div>
            </div>

            <div style="color: #cbd5e1; line-height: 1.8; font-size: 1.1em; white-space: pre-wrap; margin-bottom: 40px;">${item.content || item.description}</div>
            
            <div style="display: flex; gap: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 24px; margin-top: auto;">
                <button class="btn btn-secondary" style="display: flex; align-items: center; gap: 8px;">
                    <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    Edit
                </button>
                <button class="btn btn-primary" style="display: flex; align-items: center; gap: 8px;">
                    <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                    Publish Now
                </button>
                <button class="btn btn-danger" style="margin-left: auto; display: flex; align-items: center; gap: 8px;">
                    <svg style="width: 16px; height: 16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    Delete
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

