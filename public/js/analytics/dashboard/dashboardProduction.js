/**
 * DRIMS Production Dashboard Controller
 * ============================================
 * Production-grade city analytics system with dynamic insights generation.
 *
 * @version 3.9.0 (Production - Security Hardened)
 * @author DRIMS Development Team
 *
 * v3.9.0 Changes (AUDIT FIXES):
 * - Added XSS sanitization for all user inputs
 * - Added GPS bounds validation (Digos City only)
 * - Added negation detection ("no fire" → not flagged)
 * - Fixed Lone Wolf clustering (Fire minPts=1)
 * - Added Auto-Cat downgrade (prevent gaming)
 * - Added spatial plausibility checks
 *
 * v3.7.0 Changes:
 * - Added Nominatim reverse geocoding for street-level address detection
 * - Cluster popups now show precise street names (e.g., "Dona Aurora Street")
 * - complaint popups include barangay + street address
 * - Intelligent caching to respect Nominatim rate limits (1 req/sec)
 * - Async loading with spinner animation
 */

// ==================== GLOBAL STATE ====================

let map;
let simulationEngine;
const heatmapLayer = null;
let currentClusters = [];
let currentNoisePoints = [];
let currentFilterCategory = "all";
let currentFilterSubcategory = "all";
let currentFilterOffice = "all";
let currentFilterStartDate = null;
let currentFilterEndDate = null;
let clustersVisible = true; // Track cluster visibility state
let currentVisualizationMode = "clusters";

// Category colors for heatmap
let categoryColors = {};

// ==================== v3.9 AUDIT FIX: XSS SANITIZATION ====================

/**
 * Load category colors from taxonomy JSON
 */
async function loadCategoryColors() {
  try {
    const response = await fetch("/assets/json/categoriesSubcategories.json");
    const data = await response.json();

    // Extract colors from categories
    categoryColors = {};
    for (const [category, info] of Object.entries(data.categories)) {
      if (info.color) {
        categoryColors[category] = info.color;
      }
    }

    console.log("[CATEGORY_COLORS] Loaded:", Object.keys(categoryColors).length, "categories");
    return categoryColors;
  } catch (error) {
    console.error("[CATEGORY_COLORS] Failed to load:", error);
    return {};
  }
}

/**
 * Sanitize user input to prevent XSS attacks.
 * Encodes HTML entities and removes dangerous patterns.
 *
 * @param {string} input - Raw user input
 * @returns {string} Sanitized safe string
 */
function sanitizeHTML(input) {
  if (input == null) return "";
  if (typeof input !== "string") return String(input);

  // HTML entity encoding
  const entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
    "`": "&#x60;",
    "=": "&#x3D;"
  };

  return input.replace(/[&<>"'`=\/]/g, char => entityMap[char]);
}

/**
 * Sanitize object with user inputs.
 * Recursively sanitizes string values in complaint objects.
 *
 * @param {Object} obj - Object with potential unsafe strings
 * @param {Array} fields - Array of field names to sanitize
 * @returns {Object} Same object with sanitized fields
 */
function sanitizecomplaintObject(obj, fields = ["description", "address", "name", "user_id"]) {
  if (!obj || typeof obj !== "object") return obj;

  for (const field of fields) {
    if (obj[field] && typeof obj[field] === "string") {
      obj[field] = sanitizeHTML(obj[field]);
    }
  }

  return obj;
}

// Export sanitization functions globally
window.sanitizeHTML = sanitizeHTML;
window.sanitizecomplaintObject = sanitizecomplaintObject;

let realtimeInitialized = false;
let livecomplaintMarkers = [];
const liveMarkerRegistry = new Map();

function initRealtimeStream() {
  if (realtimeInitialized) return;

  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║        REAL-TIME STREAM INITIALIZATION (SSE)          ║");
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log("║ Using: /api/brain/stream (Server-Sent Events)         ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  initServerSync();
  realtimeInitialized = true;
  addRealtimeIndicator();
}

/**
 * Clear all pulsing live markers from the map.
 * v4.0.1: Added to prevent duplicate markers when simulation reloads.
 * v4.2: Now also clears the liveMarkerRegistry
 */
function clearLiveMarkers() {
  if (livecomplaintMarkers.length > 0 || liveMarkerRegistry.size > 0) {
    console.log(`[REALTIME] Clearing ${liveMarkerRegistry.size} tracked live markers`);
    livecomplaintMarkers.forEach(marker => {
      if (map && map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    });
    livecomplaintMarkers = [];
    liveMarkerRegistry.clear();
    console.log("[REALTIME] ✅ Registry cleared - ready for fresh markers");
  }
}

/**
 * Initialize server-side sync with Server-Sent Events
 */
let pollingInterval = null;
const API_ENDPOINT = `/api/brain/complaints`;

function initServerSync() {
  const SSE_ENDPOINT = `/api/brain/stream`;

  // Fetch existing complaints on load and trigger analysis
  fetchServercomplaints(API_ENDPOINT, { silent: true }).then(() => {
    console.log("[INIT] Initial sync complete. Triggering first analysis...");
    loadFullSimulation();
  });

  // Start polling fallback (will be used if SSE fails)
  startPolling();

  // Try SSE for real-time updates (will fail due to auth, so polling will be used)
  try {
    const eventSource = new EventSource(SSE_ENDPOINT);

    eventSource.onopen = () => {
      console.log("[SSE] ✅ Connected to live complaint stream");
      // Stop polling if SSE works
      stopPolling();
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "CONNECTED") {
          console.log("[SSE] Client ID:", data.clientId);
        } else if (data.type === "NEW_COMPLAINT") {
          handleNewServercomplaint(data.complaint);
        }
      } catch (error) {
        console.error("[SSE] Parse error:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.log("[SSE] Connection failed (auth required), using polling...");
      eventSource.close();
      startPolling();
    };
  } catch (error) {
    console.log("[SSE] Not supported, using polling...");
    startPolling();
  }
}

function startPolling() {
  if (pollingInterval) return;
  console.log("[POLL] Starting 30s polling interval...");
  pollingInterval = setInterval(() => fetchServercomplaints(API_ENDPOINT), 30000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log("[POLL] Polling stopped (SSE active)");
  }
}

/**
 * Fetch complaints from server
 */
async function fetchServercomplaints(apiEndpoint, options = {}) {
  try {
    // Build query parameters for data filtering
    const url = new URL(apiEndpoint, window.location.origin);
    // v5.3: Prioritize filters passed in options, fallback to global state
    const startDate = options.startDate || currentFilterStartDate;
    const endDate = options.endDate || currentFilterEndDate;
    const category = options.category || currentFilterCategory;
    const subcategory = options.subcategory || currentFilterSubcategory;
    const office = options.office || currentFilterOffice;

    if (startDate) url.searchParams.append("startDate", startDate);
    if (endDate) url.searchParams.append("endDate", endDate);
    if (office && office !== "all") {
      url.searchParams.append("department", office);
    }

    // Support multi-category filtering
    if (category && category !== "all") {
      if (Array.isArray(category)) {
        category.forEach(cat => url.searchParams.append("category", cat));
      } else {
        url.searchParams.append("category", category);
      }
    }

    // Support multi-subcategory filtering
    if (subcategory && subcategory !== "all") {
      if (Array.isArray(subcategory)) {
        subcategory.forEach(sub => url.searchParams.append("subcategory", sub));
      } else {
        url.searchParams.append("subcategory", subcategory);
      }
    }

    console.log(`[SERVER] Syncing with filters:`, url.searchParams.toString());

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();

    if (result.success) {
      const count = result.complaints?.length || 0;
      console.log(`%c[DATA SYNC] Retrieved ${count} records from server.`, "color: #00ff00; font-weight: bold;");
      console.log(`[FILTERS] Active:`, {
        startDate: currentFilterStartDate,
        endDate: currentFilterEndDate,
        categories: currentFilterCategory,
        office: currentFilterOffice
      });

      // DEBUG: Log the first and last record dates
      if (result.complaints.length > 0) {
        const first = result.complaints[0];
        console.log(`[FETCH] First record date:`, first.submitted_at || first.timestamp);
      }

      // If we got 0 results (e.g. date filter has no data), clear and reload
      if (count === 0) {
        console.log("[SERVER] No complaints found for current filters.");
        if (simulationEngine) simulationEngine.complaints = [];

        // v4.8: Only auto-trigger refresh if NOT a manual silent sync (like filter apply)
        if (!options.silent) {
          if (autoReloadTimer) clearTimeout(autoReloadTimer);
          autoReloadTimer = setTimeout(() => {
            loadFullSimulation().catch(() => { });
          }, AUTO_RELOAD_DELAY);
        }
        return;
      }

      // Optimize O(N^2) lookups by using a Set (O(1) lookup)
      const existingIds = new Set(simulationEngine.complaints.map(c => c.id));
      const newcomplaints = result.complaints.filter(c => !existingIds.has(c.id));

      if (newcomplaints.length > 0) {
        console.log(`[SERVER] Found ${newcomplaints.length} new unique complaints`);
        if (options.silent) {
          // Bulk ingest optimization: bypass the O(N) array search in ingestServercomplaint
          const analyzeFn = typeof window.analyzecomplaintIntelligence === "function" ? window.analyzecomplaintIntelligence : null;

          for (const c of newcomplaints) {
            sanitizecomplaintObject(c);
            if (analyzeFn) {
              try { c.nlp_result = analyzeFn(c); } catch {}
            }
            simulationEngine.complaints.push(c);
          }

          // v4.8: Caller handles the loadFullSimulation trigger in silent mode
        } else {
          newcomplaints.forEach(c => handleNewServercomplaint(c));
        }
      } else {
        // All records already loaded
        console.log("[SERVER] No new records to ingest.");
      }
      console.log(`[SERVER] Sync complete. Filtered result: ${count} total.`);

      // v4.8: Trigger refresh if NOT silent (regular polling/refresh)
      // to ensure UI is in sync with the fetched server state
      if (!options.silent) {
        if (autoReloadTimer) clearTimeout(autoReloadTimer);
        autoReloadTimer = setTimeout(() => {
          loadFullSimulation().catch(() => { });
        }, AUTO_RELOAD_DELAY);
      }
    }
  } catch (error) {
    console.warn("[SERVER] Fetch failed:", error.message);
  }
}

/**
 * Handle new Complaint from server
 * v3.9.2: Now auto-triggers loadFullSimulation to update clustering
 */
let autoReloadTimer = null;
const AUTO_RELOAD_DELAY = 2000; // 2 seconds debounce

function ingestServercomplaint(complaint, options = {}) {
  if (!complaint) return false;
  sanitizecomplaintObject(complaint);

  if (typeof window.analyzecomplaintIntelligence === "function") {
    try {
      const intelligence = window.analyzecomplaintIntelligence(complaint);
      complaint.nlp_result = intelligence;
    } catch { }
  }

  if (!simulationEngine || !simulationEngine.complaints) return false;
  const exists = simulationEngine.complaints.some(c => c.id === complaint.id);
  if (exists) return false;
  simulationEngine.complaints.push(complaint);

  if (options.showUI) {
    if (window.RoadValidator) {
      window.RoadValidator.validate(complaint).then(res => {
        complaint.road_validation = res;
        if (!res.isValid && !res.fallback) {
          complaint.spatial_warning = "Road Proximity Warning: No physical road detected.";
          complaint.road_proximity_anomaly = true;
        }
        addLivecomplaintMarker(complaint);
      }).catch(() => addLivecomplaintMarker(complaint));
    } else {
      addLivecomplaintMarker(complaint);
    }
    showRealtimeNotification(complaint);
  }

  return true;
}

function handleNewServercomplaint(complaint) {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log(`║  🎉 NEW COMPLAINT RECEIVED (server)`.padEnd(57), "║");
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log("║ ID:", complaint.id.padEnd(44), "║");
  console.log("║ Category:", complaint.category.padEnd(38), "║");
  console.log("║ Description:", complaint.description.substring(0, 35).padEnd(35), "║");
  console.log("╚════════════════════════════════════════════════════════╝");

  const added = ingestServercomplaint(complaint, { showUI: true });
  if (!added) {
    console.log("[REALTIME] ⚠️ Duplicate complaint, skipped:", complaint.id);
    return;
  }
  console.log("[REALTIME] ✅ Added to complaints array, total:", simulationEngine.complaints.length);

  if (autoReloadTimer) clearTimeout(autoReloadTimer);
  autoReloadTimer = setTimeout(() => {
    console.log("[AUTO-RELOAD] 🔄 Triggering automatic data processing...");
    loadFullSimulation().then(() => {
      console.log("[AUTO-RELOAD] ✅ City data automatically reloaded!");
    }).catch(() => { });
  }, AUTO_RELOAD_DELAY);
}

/**
 * Add a pulsing marker for newly received live complaints.
 * v4.2: Uses liveMarkerRegistry to prevent duplicate markers.
 * If marker already exists, updates its position instead of creating new.
 */
function addLivecomplaintMarker(complaint) {
  if (!map || !complaint.latitude || !complaint.longitude) return;

  // v4.2: DUPLICATE CHECK - Prevent double markers on same complaint
  if (liveMarkerRegistry.has(complaint.id)) {
    console.log(`[REALTIME] Marker already exists for ${complaint.id}, updating position`);
    const existingMarker = liveMarkerRegistry.get(complaint.id);
    // Update marker position if it moved
    existingMarker.setLatLng([complaint.latitude, complaint.longitude]);
    return; // Don't create a new marker
  }

  // Category colors
  const categoryColors = {
    "Fire": "#ef4444",
    "Flood": "#3b82f6",
    "Accident": "#f97316",
    "Crime": "#a855f7",
    "Medical": "#ec4899",
    "Traffic": "#eab308",
    "Pothole": "#6b7280",
    "Trash": "#84cc16",
    "Others": "#64748b"
  };

  const color = categoryColors[complaint.category] || "#00d4ff";
  const hasAnomaly = complaint.road_proximity_anomaly || complaint.spatial_warning;

  // Create priority marker (not emergency)
  const marker = L.marker([complaint.latitude, complaint.longitude], {
    icon: L.divIcon({
      html: `
                <div class="priority-complaint-marker ${hasAnomaly ? "anomaly" : ""}" style="--marker-color: ${hasAnomaly ? "#ef4444" : color};">
                    <div class="priority-dot"></div>
                    <span class="priority-label">${hasAnomaly ? '<i class="fas fa-exclamation-triangle"></i> ALERT' : "PRIORITY"}</span>
                </div>
            `,
      className: "priority-marker-container",
      iconSize: [50, 50],
      iconAnchor: [25, 25]
    }),
    zIndexOffset: 1500
  }).addTo(map);

  // Open intelligence panel on click (lazy — no upfront HTML generation)
  marker.on("click", () => {
    if (window.mapIntelligencePanel) {
      window.mapIntelligencePanel.show(complaint, null, color, null);
    }
  });

  livecomplaintMarkers.push(marker);

  // v4.2: Register in the map for duplicate detection
  liveMarkerRegistry.set(complaint.id, marker);
  console.log(`[REALTIME] Registered marker: ${complaint.id} (Registry size: ${liveMarkerRegistry.size})`);

  // Pan to the new Complaint
  map.panTo([complaint.latitude, complaint.longitude], { animate: true });
}

/**
 * Show a notification toast for new live complaints.
 */
function showRealtimeNotification(complaint) {
  // Remove existing notification if any
  const existing = document.querySelector(".realtime-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "realtime-toast";
  toast.innerHTML = `
        <div class="toast-icon">📍</div>
        <div class="toast-content">
            <div class="toast-title">New Real-Time Report</div>
            <div class="toast-message">${sanitizeHTML(complaint.category)}: ${sanitizeHTML(complaint.description).substring(0, 50)}...</div>
        </div>
    `;

  document.body.appendChild(toast);

  // Animate in
  setTimeout(() => toast.classList.add("show"), 10);

  // Remove after 5 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/**
 * Add live sync status indicator to the dashboard header.
 */
function addRealtimeIndicator() {
  const hudBottom = document.getElementById("hud-bottom");
  if (!hudBottom) return;

  // Check if already exists
  if (document.querySelector(".realtime-indicator")) return;

  const indicator = document.createElement("div");
  indicator.className = "realtime-indicator tactical-realtime";
  indicator.innerHTML = `
        <div class="sync-dot"></div>
        <span>LIVE SYNC</span>
    `;
  indicator.title = "Receiving real-time field intelligence from the server";

  // Append to hud-bottom instead of control-panel
  hudBottom.appendChild(indicator);
}

const realtimeStyles = document.createElement("style");
realtimeStyles.textContent = `
    /* Live complaint Marker */
    .live-marker-container {
        background: transparent !important;
        border: none !important;
    }
    
    .live-complaint-marker {
        position: relative;
        width: 40px;
        height: 40px;
    }
    
    .live-pulse {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 40px;
        height: 40px;
        background: var(--marker-color);
        border-radius: 50%;
        transform: translate(-50%, -50%);
        animation: livePulse 2s ease-out infinite;
        opacity: 0.4;
    }
    
    .live-dot {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 16px;
        height: 16px;
        background: var(--marker-color);
        border: 3px solid white;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    
    .live-label {
        position: absolute;
        top: -20px;
        left: 50%;
        transform: translateX(-50%);
        background: #ef4444;
        color: white;
        font-size: 9px;
        font-weight: 700;
        white-space: nowrap;
        padding: 2px 6px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    
    .live-complaint-marker.anomaly {
        z-index: 3000;
    }
    
    .live-complaint-marker.anomaly .live-dot {
        background: #ef4444;
        box-shadow: 0 0 10px #ef4444;
    }
    
    .live-complaint-marker.anomaly .live-label {
        background: #ef4444;
        border: 1px solid white;
    }
    
    @keyframes livePulse {
        0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0.6;
        }
        100% {
            transform: translate(-50%, -50%) scale(2);
            opacity: 0;
        }
    }
    
    .realtime-toast {
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: linear-gradient(135deg, #1e3a5f 0%, #0f2942 100%);
        color: white;
        padding: 15px 20px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 15px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.4);
        border: 1px solid rgba(0, 212, 255, 0.3);
        transform: translateX(120%);
        transition: transform 0.3s ease;
        z-index: 10000;
        max-width: 350px;
    }
    
    .realtime-toast.show {
        transform: translateX(0);
    }
    
    .toast-icon {
        font-size: 24px;
        animation: bounce 0.5s ease;
    }
    
    .toast-title {
        font-weight: 600;
        font-size: 14px;
        color: #00d4ff;
    }
    
    .toast-message {
        font-size: 12px;
        color: #94a3b8;
        margin-top: 4px;
    }
    
    @keyframes bounce {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
    }
    
    .realtime-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid rgba(239, 68, 68, 0.4);
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 600;
        color: #ef4444;
        letter-spacing: 1px;
        margin-bottom: 15px;
    }
    
    .sync-dot {
        width: 8px;
        height: 8px;
        background: #ef4444;
        border-radius: 50%;
        animation: syncPulse 1.5s ease-in-out infinite;
    }
    
    @keyframes syncPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
    }
`;
document.head.appendChild(realtimeStyles);

// ==================== v4.0 AI STATUS INDICATOR ====================

/**
 * v4.0: Add AI Status indicator to the dashboard header.
 * Shows whether TensorFlow.js + USE model is loaded and ready.
 * v4.1: Moved to footer (bottom right) with hover tooltip
 */
function addAIStatusIndicator() {
  // v4.1: Create footer container if it doesn't exist
  let footerContainer = document.querySelector(".ai-footer-container");
  if (!footerContainer) {
    footerContainer = document.createElement("div");
    footerContainer.className = "ai-footer-container tactical-ai-footer";
    document.body.appendChild(footerContainer);
  }

  // Check if already exists
  if (document.querySelector(".ai-status-indicator")) return;

  const indicator = document.createElement("div");
  indicator.className = "ai-status-indicator loading";
  indicator.id = "aiStatusIndicator";
  indicator.innerHTML = `
        <div class="ai-status-dot"></div>
        <div class="ai-status-tooltip">
            <div class="tooltip-title">AI Status: Loading...</div>
            <div class="tooltip-detail">TensorFlow.js + Universal Sentence Encoder</div>
            <div class="tooltip-model">Model: USE Lite (cached in IndexedDB)</div>
        </div>
    `;
  indicator.title = "";  // Disable default title, using custom tooltip

  footerContainer.appendChild(indicator);

  // Start polling for AI status
  checkAndUpdateAIStatus();
}

/**
 * Check AI status and update the indicator
 * v4.1: Updated to use tooltip instead of text
 */
function checkAndUpdateAIStatus() {
  const indicator = document.getElementById("aiStatusIndicator");
  if (!indicator) return;

  const tooltipTitle = indicator.querySelector(".tooltip-title");
  const tooltipDetail = indicator.querySelector(".tooltip-detail");

  if (typeof window.getAIStatus === "function") {
    const status = window.getAIStatus();

    if (status.ready) {
      indicator.className = "ai-status-indicator ready";
      if (tooltipTitle) tooltipTitle.textContent = "AI Status: Ready ✓";
      if (tooltipDetail) tooltipDetail.textContent = "Hybrid classification active";
      console.log("[DASHBOARD] ✅ AI Fallback is ready for inference");
    } else if (status.error) {
      indicator.className = "ai-status-indicator error";
      if (tooltipTitle) tooltipTitle.textContent = "AI Status: Error";
      if (tooltipDetail) tooltipDetail.textContent = status.error;
      console.warn("[DASHBOARD] ⚠️ AI Fallback error:", status.error);
    } else {
      indicator.className = "ai-status-indicator loading";
      if (tooltipTitle) tooltipTitle.textContent = "AI Status: Loading...";
      if (tooltipDetail) tooltipDetail.textContent = "Downloading model from CDN";
      // Check again in 2 seconds
      setTimeout(checkAndUpdateAIStatus, 2000);
    }
  } else {
    indicator.className = "ai-status-indicator offline";
    if (tooltipTitle) tooltipTitle.textContent = "AI Status: Offline";
    if (tooltipDetail) tooltipDetail.textContent = "Rule-based mode only";
  }
}

// AI Status indicator CSS - v4.1: Footer-based with tooltip
const aiStatusStyles = document.createElement("style");
aiStatusStyles.textContent = `
    /* v4.1 AI Footer Container */
    .ai-footer-container {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 10px;
    }
    
    /* v4.1 AI Status Indicator - Subtle dot in footer */
    .ai-status-indicator {
        position: relative;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }
    
    .ai-status-indicator .ai-status-dot {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: currentColor;
    }
    
    .ai-status-indicator.loading {
        background: #eab308;
        color: #eab308;
        animation: aiDotPulse 1.5s ease-in-out infinite;
    }
    
    .ai-status-indicator.ready {
        background: #22c55e;
        color: #22c55e;
        box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
    }
    
    .ai-status-indicator.error {
        background: #ef4444;
        color: #ef4444;
    }
    .ai-status-indicator.offline {
        background: #6b7280;
        color: #6b7280;
    }
    
    @keyframes aiDotPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.85); }
    }
    
    /* v4.1 Hover Tooltip */
    .ai-status-tooltip {
        position: absolute;
        bottom: 100%;
        right: 0;
        margin-bottom: 8px;
        padding: 10px 14px;
        background: rgba(15, 23, 42, 0.95);
        border-radius: 8px;
        min-width: 200px;
        opacity: 0;
        visibility: hidden;
        transform: translateY(5px);
        transition: all 0.2s ease;
        pointer-events: none;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    .ai-status-indicator:hover .ai-status-tooltip {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
    }
    
    .ai-status-tooltip .tooltip-title {
        font-size: 12px;
        font-weight: 600;
        color: #f1f5f9;
        margin-bottom: 4px;
    }
    
    .ai-status-tooltip .tooltip-detail {
        font-size: 11px;
        color: #94a3b8;
        margin-bottom: 2px;
    }
    
    .ai-status-tooltip .tooltip-model {
        font-size: 10px;
        color: #64748b;
        font-style: italic;
    }
`;
document.head.appendChild(aiStatusStyles);

// Initialize AI status indicator when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", addAIStatusIndicator);
} else {
  addAIStatusIndicator();
}

// Removed Debug Mode Logic per User Request (v4.6)

// ==================== OFFLINE ZONE DETECTION (Turf.js) ====================

/**
 * Load barangay boundary GeoJSON for offline zone detection.
 * Gracefully degrades if file is unavailable.
 */
async function loadBarangayBoundaries() {
  try {
    const response = await fetch("/api/boundaries");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    // Convert to proper GeoJSON FeatureCollection
    // The file is an array of { name, geojson } objects
    barangayGeoJSON = {
      type: "FeatureCollection",
      features: data.map(brgy => ({
        type: "Feature",
        properties: { name: brgy.name },
        geometry: brgy.geojson
      }))
    };

    console.log("[ZONE] Barangay boundaries loaded:", barangayGeoJSON.features.length, "zones");
    return true;
  } catch (error) {
    console.warn("[ZONE] Failed to load barangay boundaries:", error.message);
    console.warn("[ZONE] Zone detection will use fallback coordinates");
    return false;
  }
}

/**
 * Detect which barangay (administrative zone) contains a given coordinate.
 * Uses Turf.js Point-in-Polygon algorithm for offline detection.
 *
 * @param {number} lat - Latitude of the point
 * @param {number} lng - Longitude of the point
 * @returns {string} Name of the barangay or "Unmapped Zone"
 */
function getJurisdiction(lat, lng) {
  // Check if boundary data is loaded
  if (!barangayGeoJSON || !barangayGeoJSON.features) {
    return "Unmapped Zone";
  }

  // Validate coordinates
  if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) {
    return "Invalid Coordinates";
  }

  try {
    // Create Turf.js point (Note: GeoJSON uses [longitude, latitude] order)
    const point = turf.point([lng, lat]);

    // Loop through all barangay boundaries
    for (const feature of barangayGeoJSON.features) {
      // Check if point is inside this polygon/multipolygon
      if (turf.booleanPointInPolygon(point, feature)) {
        // Return the barangay name from properties
        const name = feature.properties.name ||
                    feature.properties.NAME ||
                    feature.properties.BRGY_NAME ||
                    feature.properties.barangay;
        return name || "Unknown Barangay";
      }
    }

    // No match found - point is outside all defined zones
    return "Unmapped Zone";
  } catch (error) {
    console.error("[ZONE] Detection error:", error.message);
    return "Detection Error";
  }
}

// ==================== REVERSE GEOCODING (Nominatim) v3.7 ====================

/**
 * Cache for reverse geocoding results to avoid redundant API calls.
 * Key format: "lat,lng" (rounded to 5 decimal places)
 */
const geocodeCache = new Map();

/**
 * Rate limiter for Nominatim API (max 1 request per second)
 */
let lastGeocodeTime = 0;
const GEOCODE_RATE_LIMIT_MS = 1100; // 1.1 seconds between requests

/**
 * Reverse geocode coordinates to get street-level address using Nominatim.
 * Results are cached to avoid hitting rate limits.
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<Object>} Address object with street, barangay, city, etc.
 *
 * @example
 * const address = await reverseGeocode(7.0458, 125.5940);
 * // Returns: { street: "Dona Aurora Street", suburb: "Zone II", city: "Digos", ... }
 */
async function reverseGeocode(lat, lng) {
  // Round coordinates for cache key (5 decimal places ≈ 1 meter precision)
  const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;

  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    console.log(`[GEOCODE] Cache hit: ${cacheKey}`);
    return geocodeCache.get(cacheKey);
  }

  // Rate limiting - wait if needed
  const now = Date.now();
  const timeSinceLastRequest = now - lastGeocodeTime;
  if (timeSinceLastRequest < GEOCODE_RATE_LIMIT_MS) {
    const waitTime = GEOCODE_RATE_LIMIT_MS - timeSinceLastRequest;
    console.log(`[GEOCODE] Rate limiting: waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  try {
    lastGeocodeTime = Date.now();

    // Backend proxy implementation
    const url = `/api/reverse-geocode?lat=${lat}&lng=${lng}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Extract relevant address components
    const address = {
      raw: data.display_name || null,
      street: data.address?.road || data.address?.street || null,
      houseNumber: data.address?.house_number || null,
      suburb: data.address?.suburb || data.address?.neighbourhood || data.address?.quarter || null,
      barangay: data.address?.village || data.address?.suburb || null,
      city: data.address?.city || data.address?.town || data.address?.municipality || null,
      province: data.address?.state || data.address?.province || null,
      postcode: data.address?.postcode || null,
      // Formatted display strings
      shortAddress: null,
      fullAddress: null
    };

    // Build short address (street + house number if available)
    if (address.street) {
      address.shortAddress = address.houseNumber
        ? `${address.houseNumber} ${address.street}`
        : address.street;
    }

    // Build full address
    const parts = [address.shortAddress, address.suburb, address.barangay, address.city].filter(Boolean);
    address.fullAddress = parts.join(", ") || data.display_name || "Unknown Location";

    console.log(`[GEOCODE] Resolved: ${cacheKey} → ${address.shortAddress || address.fullAddress}`);

    // Cache the result
    geocodeCache.set(cacheKey, address);

    return address;

  } catch (error) {
    console.error(`[GEOCODE] Error for ${cacheKey}:`, error.message);

    // Return fallback object
    const fallback = {
      raw: null,
      street: null,
      suburb: null,
      barangay: null,
      city: null,
      shortAddress: null,
      fullAddress: "Location unavailable",
      error: error.message
    };

    // Cache the error result too (to avoid repeated failed requests)
    geocodeCache.set(cacheKey, fallback);

    return fallback;
  }
}

/**
 * Get street-level location for a complaint point.
 * Combines Nominatim street name with Turf.js barangay detection.
 *
 * @param {Object} point - complaint object with latitude/longitude
 * @returns {Promise<string>} Formatted location string
 *
 * @example
 * const location = await getDetailedLocation(complaint);
 * // Returns: "Dona Aurora Street, Zone II"
 */
async function getDetailedLocation(point) {
  if (!point.latitude || !point.longitude) {
    return "Unknown Location";
  }

  // Get barangay from Turf.js (fast, offline)
  const barangay = getJurisdiction(point.latitude, point.longitude);

  // Get street from Nominatim (async, online)
  try {
    const address = await reverseGeocode(point.latitude, point.longitude);

    if (address.street) {
      // Combine: "Dona Aurora Street, Zone II"
      return `${address.street}, ${barangay}`;
    }
    // Fallback to barangay only
    return barangay;

  } catch (error) {
    // Fallback to barangay only
    return barangay;
  }
}

/**
 * Get street-level location for a cluster (uses center point).
 *
 * @param {Array} clusterPoints - Array of complaint objects in the cluster
 * @returns {Promise<string>} Formatted location string
 */
async function getDetailedClusterLocation(clusterPoints) {
  if (!clusterPoints || clusterPoints.length === 0) {
    return "Unknown Location";
  }

  // Calculate cluster center
  const center = getClusterCenterFromPoints(clusterPoints);

  // Get detailed location for center point
  return getDetailedLocation({ latitude: center.lat, longitude: center.lng });
}

/**
 * Attach cached geocode data to a point synchronously.
 * v3.7: Used by scoring engine for geospatial verification.
 * Only attaches data if already cached (no async call).
 *
 * @param {Object} point - complaint object with latitude/longitude
 * @returns {Object} The same point with geocodedAddress attached (if cached)
 */
function attachCachedGeocode(point) {
  if (!point.latitude || !point.longitude) {
    return point;
  }

  const cacheKey = `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;

  if (geocodeCache.has(cacheKey)) {
    point.geocodedAddress = geocodeCache.get(cacheKey);
    console.log(`[GEOCODE] ✅ Attached cached address to point: ${point.geocodedAddress?.street || "no street"}`);
  }

  return point;
}

// Export for global access
window.reverseGeocode = reverseGeocode;
window.getDetailedLocation = getDetailedLocation;
window.getDetailedClusterLocation = getDetailedClusterLocation;
window.geocodeCache = geocodeCache;
window.attachCachedGeocode = attachCachedGeocode;

// ==================== MAP INITIALIZATION ====================

function initMap() {
  map = L.map("map", {
    zoomControl: true,
    attributionControl: false,
    maxZoom: 22,
    // Performance optimizations
    preferCanvas: true,
    fadeAnimation: true,
    zoomAnimation: true,
    markerZoomAnimation: true
  }).setView([6.7490, 125.3572], 13);


  // v4.5: Add Tile Layer Toggle (User Request)
  const baseLayers = {
    "Dark Mode": L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 22, maxNativeZoom: 19, subdomains: "abcd"
    }),
    "Light Mode": L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 22, maxNativeZoom: 19, subdomains: "abcd"
    }),
    "Satellite": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 22, maxNativeZoom: 19, attribution: "Esri"
    })
  };

  // Determine initial theme
  const isDark = document.documentElement.classList.contains("dark");
  const defaultLayer = isDark ? baseLayers["Dark Mode"] : baseLayers["Light Mode"];
  // v4.6 Custom Tile Switcher Logic
  let currentLayerIndex = isDark ? 0 : 1;
  const layerKeys = Object.keys(baseLayers);
  let currentBaseLayer = baseLayers[layerKeys[currentLayerIndex]];
  currentBaseLayer.addTo(map);

  window.cycleMapTiles = function() {
    map.removeLayer(currentBaseLayer);
    currentLayerIndex = (currentLayerIndex + 1) % layerKeys.length;
    currentBaseLayer = baseLayers[layerKeys[currentLayerIndex]];
    currentBaseLayer.addTo(map);
    currentBaseLayer.bringToBack();

    // Update HUD tooltip if needed
    const tooltip = document.querySelector("#btn-cycle-tiles .layer-tooltip");
    if (tooltip) tooltip.textContent = `Mode: ${layerKeys[currentLayerIndex]}`;

    console.log(`[MAP] Switched to ${layerKeys[currentLayerIndex]}`);
    return layerKeys[currentLayerIndex];
  };

  // Listen for theme changes from ThemeManager
  window.addEventListener("themeChanged", (e) => {
    const newTheme = e.detail.theme;
    map.removeLayer(currentBaseLayer);
    currentLayerIndex = newTheme === "dark" ? 0 : 1;
    currentBaseLayer = baseLayers[layerKeys[currentLayerIndex]];
    currentBaseLayer.addTo(map);
    currentBaseLayer.bringToBack();
  });
}

// ==================== SMART INSIGHTS GENERATION ====================
// Human-Centric Tactical Dashboard for City Dispatchers & Mayors

/**
 * Get dispatch unit type based on category.
 * Returns human-readable team names for tactical display.
 */
function getDispatchUnit(category) {
  const units = {
    // Infrastructure - Road Maintenance
    "Pothole": "Road Maintenance Team",
    "Road Damage": "Road Maintenance Team",
    "Infrastructure": "Road Maintenance Team",

    // Sanitation
    "Trash": "Sanitation Truck",
    "Illegal Dumping": "Sanitation Truck",
    "Overflowing Trash": "Sanitation Truck",
    "Bad Odor": "Sanitation Truck",
    "Sanitation": "Sanitation Truck",

    // Water/Utilities - Emergency Response
    "Flooding": "Emergency Response Unit",
    "Flood": "Emergency Response Unit",
    "No Water": "Water Utilities Team",
    "Pipe Leak": "Water Utilities Team",
    "Utilities": "Water Utilities Team",
    "Environment": "Emergency Response Unit",
    "Blackout": "Electrical Response Team",

    // Public Safety
    "Fire": "Fire department (Priority)",
    "Accident": "Emergency Medical Services",
    "Crime": "Police Response Unit",
    "Public Safety": "Emergency Response Unit",
    "Stray Dog": "Animal Control Unit",
    "Noise complaint": "Community Affairs Officer",

    // Traffic
    "Traffic": "Traffic Management Office",
    "Road Obstruction": "Traffic Management Office",

    // Others
    "Broken Streetlight": "Electrical Maintenance",
    "Streetlight": "Electrical Maintenance"
  };
  return units[category] || "Inspection Officer";
}

/**
 * Get zone/location name from cluster data.
 * Generates human-readable "Vicinity of Barangay" string using GIS detection.
 * v3.7: Now enhanced with optional street-level precision via Nominatim.
 * NO MORE RAW COORDINATES - Decision Support Tool UX.
 */
function getZoneLocation(cluster) {
  const firstPoint = cluster[0];

  // Check for user-provided location (fallback)
  if (firstPoint.location) return firstPoint.location;

  // Get cluster center for GIS detection
  const center = getClusterCenterFromPoints(cluster);

  // Use Turf.js point-in-polygon to detect barangay
  const barangayName = getJurisdiction(center.lat, center.lng);

  // Generate human-readable vicinity string
  if (barangayName && barangayName !== "Unmapped Zone" && barangayName !== "Detection Error") {
    return `Vicinity of ${barangayName}, Digos City`;
  }

  // Fallback for unmapped areas (still avoid raw coords)
  return "Unmapped Area, Digos City";
}

/**
 * Generate street-level description for a cluster using Nominatim.
 * v3.7: Uses reverse geocoding to get precise street names.
 *
 * @param {Array} cluster - Array of complaint points
 * @param {string} category - Dominant category (e.g., "Pothole")
 * @returns {Promise<string>} Street-level description
 *
 * @example
 * const description = await getStreetLevelClusterDescription(cluster, 'Pothole');
 * // Returns: "3 pothole reports within Dona Aurora Street, Zone II"
 */
async function getStreetLevelClusterDescription(cluster, category) {
  if (!cluster || cluster.length === 0) {
    return "Unknown Location";
  }

  const center = getClusterCenterFromPoints(cluster);
  const count = cluster.length;

  try {
    const address = await reverseGeocode(center.lat, center.lng);
    const barangay = getJurisdiction(center.lat, center.lng);

    if (address && address.street) {
      // "3 pothole reports within Dona Aurora Street, Zone II"
      return `${count} ${category.toLowerCase()} report${count > 1 ? "s" : ""} within ${address.street}, ${barangay}`;
    }
    // Fallback: "3 pothole reports in Zone II"
    return `${count} ${category.toLowerCase()} report${count > 1 ? "s" : ""} in ${barangay}`;

  } catch (error) {
    console.error("[GEOCODE] Error getting cluster description:", error);
    return `${count} ${category.toLowerCase()} report${count > 1 ? "s" : ""} in ${getJurisdiction(center.lat, center.lng)}`;
  }
}

/**
 * Determine severity level based on count and category.
 */
function determineSeverity(count, category) {
  const criticalCategories = ["Fire", "Flood", "Flooding", "Accident", "Crime", "Public Safety"];

  if (count > 8 || criticalCategories.includes(category)) {
    return "CRITICAL";
  }
  return "WARNING";
}

// ==================== CRITICAL TRIAGE SYSTEM UI ====================
// Renders the Emergency Panel and pulsing map markers for critical reports

// Track critical points globally for panel interactions
let currentCriticalPoints = [];
let criticalMarkersLayer = null;
let criticalMarkersVisible = true;

window.setCriticalMarkersVisible = function (show) {
  criticalMarkersVisible = Boolean(show);
  if (!window.map || !criticalMarkersLayer) return;
  if (criticalMarkersVisible) {
    if (!window.map.hasLayer(criticalMarkersLayer)) {
      criticalMarkersLayer.addTo(window.map);
    }
  } else if (window.map.hasLayer(criticalMarkersLayer)) {
    window.map.removeLayer(criticalMarkersLayer);
  }
};

window.getCriticalMarkersVisible = function () {
  return criticalMarkersVisible;
};

/**
 * Render the Emergency Panel with critical dispatch tickets.
 * Called after extractCriticalPoints separates emergencies from standard data.
 *
 * @param {Array} criticalPoints - Array of critical complaint objects with _criticality metadata
 */
function renderEmergencyPanel(criticalPoints) {
  const panel = document.getElementById("emergencyPanel");
  const content = document.getElementById("emergencyContent");
  const countBadge = document.getElementById("emergencyCount");

  if (!panel || !content) {
    console.warn("[TRIAGE] Emergency panel elements not found in DOM");
    return;
  }

  // Store for global access
  currentCriticalPoints = criticalPoints;

  // Update count badges (main panel + control bar mini badge)
  countBadge.textContent = criticalPoints.length;
  updateEmergencyBadge(criticalPoints.length);

  // Show/hide panel based on emergencies
  if (criticalPoints.length === 0) {
    panel.classList.remove("active");
    content.innerHTML = `
            <div class="emergency-placeholder">
                <i class="fas fa-shield-alt"></i>
                <p>No active emergencies</p>
                <span>Critical reports will appear here</span>
            </div>
        `;
    return;
  }

  // Show panel (unless user manually hid it)
  if (!panel.classList.contains("hidden")) {
    panel.classList.add("active");
  }

  // Generate emergency cards
  const cardsHTML = criticalPoints.map((point, idx) => {
    const criticality = point._criticality;
    const typeClass = criticality.type.toLowerCase();
    const barangay = getJurisdiction(point.latitude, point.longitude);
    const timeAgo = getRelativeTime(point.timestamp);

    // Icon mapping
    const iconMap = {
      "FIRE": "fire",
      "FLOOD": "water",
      "CRIME": "user-shield",
      "ACCIDENT": "car-crash",
      "MEDICAL": "heartbeat",
      "CASUALTY": "skull-crossbones",
      "EMERGENCY": "exclamation-triangle"
    };
    const icon = iconMap[criticality.type] || "exclamation-triangle";

    return `
            <div class="emergency-card" data-idx="${idx}" data-lat="${point.latitude}" data-lng="${point.longitude}">
                <div class="emergency-card-header">
                    <span class="emergency-type-badge ${typeClass}">
                        <i class="fas fa-${icon}"></i>
                        ${criticality.type}
                    </span>
                    <span class="emergency-time">
                        <i class="fas fa-clock"></i> ${timeAgo}
                    </span>
                </div>
                <div class="emergency-card-body">
                    <div class="emergency-description">
                        "${sanitizeHTML(point.description) || "No description"}"
                    </div>
                    <div class="emergency-meta">
                        <span class="emergency-meta-item">
                            <i class="fas fa-map-marker-alt"></i> ${barangay}
                        </span>
                        <span class="emergency-meta-item">
                            <i class="fas fa-tag"></i> ${point.subcategory || point.category}
                        </span>
                        ${criticality.matchedKeyword ? `
                            <span class="emergency-meta-item">
                                <i class="fas fa-search"></i> "${criticality.matchedKeyword}"
                            </span>
                        ` : ""}
                    </div>
                    <div class="emergency-actions">
                        <button class="emergency-btn acknowledge" onclick="acknowledgeEmergency(${idx})">
                            <i class="fas fa-check"></i> Acknowledge
                        </button>
                        <button class="emergency-btn dispatch" onclick="dispatchEmergency(${idx})">
                            <i class="fas fa-truck"></i> Dispatch
                        </button>
                    </div>
                </div>
            </div>
        `;
  }).join("");

  content.innerHTML = cardsHTML;

  // Add click handlers for card navigation
  content.querySelectorAll(".emergency-card").forEach(card => {
    card.addEventListener("click", (e) => {
      // Don't navigate if clicking a button
      if (e.target.closest(".emergency-btn")) return;

      const lat = parseFloat(card.dataset.lat);
      const lng = parseFloat(card.dataset.lng);
      map.flyTo([lat, lng], 18, { duration: 1 });
    });
  });

  console.log(`[TRIAGE] Rendered ${criticalPoints.length} emergency cards`);
}

/**
 * Get relative time string (e.g., "5 min ago")
 */
function getRelativeTime(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Acknowledge an emergency (stops flashing, dims card)
 */
function acknowledgeEmergency(idx) {
  const card = document.querySelector(`.emergency-card[data-idx="${idx}"]`);
  if (card) {
    card.classList.add("acknowledged");
    const btn = card.querySelector(".emergency-btn.acknowledge");
    if (btn) {
      btn.innerHTML = '<i class="fas fa-check-double"></i> Acknowledged';
      btn.disabled = true;
    }
  }
  console.log(`[TRIAGE] Emergency #${idx} acknowledged`);
}

/**
 * Dispatch response to emergency (placeholder - integrate with your dispatch system)
 */
function dispatchEmergency(idx) {
  const point = currentCriticalPoints[idx];
  if (!point) return;

  const barangay = getJurisdiction(point.latitude, point.longitude);
  const {type} = point._criticality;

  // Show confirmation (replace with actual dispatch logic)
  alert(`🚨 DISPATCHING ${type} RESPONSE\n\nLocation: ${barangay}\nCoordinates: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}\n\nUnit notified!`);

  // Auto-acknowledge after dispatch
  acknowledgeEmergency(idx);

  console.log(`[TRIAGE] Dispatched response for emergency #${idx}`);
}

/**
 * Render pulsing markers for critical points on the map.
 * These markers sit ABOVE all other layers and demand attention.
 *
 * @param {Array} criticalPoints - Array of critical complaint objects
 */
function renderCriticalMarkers(criticalPoints) {
  // Clear existing critical markers
  if (criticalMarkersLayer) {
    map.removeLayer(criticalMarkersLayer);
  }

  criticalMarkersLayer = L.layerGroup();

  criticalPoints.forEach((point, idx) => {
    const criticality = point._criticality;
    const typeClass = criticality.type.toLowerCase();

    // Icon mapping
    const iconMap = {
      "FIRE": "fire",
      "FLOOD": "water",
      "CRIME": "user-shield",
      "ACCIDENT": "car-crash",
      "MEDICAL": "heartbeat",
      "CASUALTY": "skull-crossbones",
      "EMERGENCY": "exclamation-triangle"
    };
    const icon = iconMap[criticality.type] || "exclamation-triangle";

    // Create high-intensity pulsing emergency icon
    const pulsingIcon = L.divIcon({
      className: "leaflet-emergency-icon",
      html: `
                <div class="emergency-pulse-marker ${typeClass}">
                    <div class="emergency-marker-inner ${typeClass}">
                        <div class="emergency-core"></div>
                        <i class="fas fa-${icon}"></i>
                    </div>
                </div>
            `,
      iconSize: [50, 50],
      iconAnchor: [25, 25],
      popupAnchor: [0, -25]
    });

    const marker = L.marker([point.latitude, point.longitude], {
      icon: pulsingIcon,
      zIndexOffset: 1000  // Ensure on top
    });

    // Create popup with critical styling
    const barangay = getJurisdiction(point.latitude, point.longitude);
    const popupContent = `
            <div class="critical-popup" style="min-width: 280px;">
                <div style="background: linear-gradient(135deg, #dc2626, #991b1b); color: white; padding: 12px 16px; margin: -13px -20px 12px -20px; border-radius: 4px 4px 0 0;">
                    <div style="font-size: 14px; font-weight: 800; letter-spacing: 1px;">
                        🚨 ${criticality.type} EMERGENCY
                    </div>
                    <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">
                        Urgency Level: ${criticality.urgencyLevel}/5
                    </div>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <div style="color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                        Citizen Report
                    </div>
                    <div style="background: #fef2f2; padding: 12px; border-radius: 6px; border-left: 3px solid #ef4444; font-style: italic; color: #374151; line-height: 1.5;">
                        "${sanitizeHTML(point.description) || "No description"}"
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; font-size: 12px;">
                    <div>
                        <span style="color: #666;">Location:</span><br>
                        <strong>${barangay}</strong>
                    </div>
                    <div>
                        <span style="color: #666;">Detection:</span><br>
                        <strong>${criticality.source === "keyword" ? `Keyword: "${criticality.matchedKeyword}"` : "Category"}</strong>
                    </div>
                </div>
                
                <button onclick="dispatchEmergency(${idx})" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #dc2626, #991b1b); color: white; border: none; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 12px;">
                    <i class="fas fa-truck"></i> DISPATCH RESPONSE
                </button>
            </div>
        `;

    marker.bindPopup(popupContent, { maxWidth: 350 });
    criticalMarkersLayer.addLayer(marker);
  });

  if (criticalMarkersVisible) {
    criticalMarkersLayer.addTo(map);
    console.log(`[TRIAGE] Rendered ${criticalPoints.length} pulsing markers on map`);
  } else {
    console.log(`[TRIAGE] Built ${criticalPoints.length} pulsing markers (hidden by toggle)`);
  }
}

/**
 * Initialize emergency panel event handlers
 */
/**
 * Initialize emergency panel event handlers
 */
function initEmergencyPanel() {
  const panel = document.getElementById("emergencyPanel");
  const toggleBar = document.getElementById("emergencyToggleBar");
  const arrow = document.getElementById("emergencyArrow");
  const header = document.querySelector(".emergency-header");
  const toggleBtn = document.getElementById("toggleEmergencyPanel");

  if (!panel || !toggleBar) return;

  // Track panel visibility state
  let isPanelVisible = true;

  toggleBar.addEventListener("click", () => {
    const isHidden = panel.classList.toggle("hidden");
    if (arrow) {
      arrow.style.transform = isHidden ? "" : "rotate(180deg)";
    }
    console.log(`[TRIAGE] Emergency radar ${isHidden ? "collapsed" : "expanded"}`);
  });

  // Toggle button in control panel
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isPanelVisible = !isPanelVisible;
      panel.classList.toggle("hidden", !isPanelVisible);
      toggleBtn.classList.toggle("active", isPanelVisible);

      // Update button text
      const icon = toggleBtn.querySelector("i");
      if (icon) {
        icon.className = isPanelVisible
          ? "fas fa-exclamation-triangle"
          : "fas fa-eye-slash";
      }
    });
  }


  // ==================== DRAGGABLE FUNCTIONALITY ====================
  if (header) {
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;

    header.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      isDragging = true;
      panel.classList.add("dragging");
      const rect = panel.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;
      panel.style.transform = "none";
      panel.style.left = `${initialLeft}px`;
      panel.style.top = `${initialTop}px`;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      let newLeft = initialLeft + deltaX;
      let newTop = initialTop + deltaY;
      const panelRect = panel.getBoundingClientRect();
      const maxLeft = window.innerWidth - panelRect.width;
      const maxTop = window.innerHeight - 50;
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));
      panel.style.left = `${newLeft}px`;
      panel.style.top = `${newTop}px`;
    });

    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        panel.classList.remove("dragging");
      }
    });

    // Touch support for mobile
    header.addEventListener("touchstart", (e) => {
      if (e.target.closest("button")) return;
      isDragging = true;
      panel.classList.add("dragging");
      const touch = e.touches[0];
      const rect = panel.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      startX = touch.clientX;
      startY = touch.clientY;
      panel.style.transform = "none";
      panel.style.left = `${initialLeft}px`;
      panel.style.top = `${initialTop}px`;
    }, { passive: true });

    document.addEventListener("touchmove", (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      let newLeft = initialLeft + deltaX;
      let newTop = initialTop + deltaY;
      const panelRect = panel.getBoundingClientRect();
      const maxLeft = window.innerWidth - panelRect.width;
      const maxTop = window.innerHeight - 50;
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));
      panel.style.left = `${newLeft}px`;
      panel.style.top = `${newTop}px`;
    }, { passive: true });

    document.addEventListener("touchend", () => {
      if (isDragging) {
        isDragging = false;
        panel.classList.remove("dragging");
      }
    });
  }

  console.log("[TRIAGE] Emergency panel initialized with drag support");
}

/**
 * Update the mini badge in the control panel and dropdown
 * v4.1: Now also updates the Map Layers dropdown badge
 */
function updateEmergencyBadge(count) {
  const badge = document.getElementById("emergencyBadgeMini");
  const toggleBtn = document.getElementById("toggleEmergencyPanel");

  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? "flex" : "none";
  }

  if (toggleBtn) {
    toggleBtn.classList.toggle("has-emergencies", count > 0);
  }

  // v4.1: Update dropdown badge as well
  if (typeof updateEmergencyDropdownBadge === "function") {
    updateEmergencyDropdownBadge(count);
  }
}

// Make functions globally available
window.acknowledgeEmergency = acknowledgeEmergency;
window.dispatchEmergency = dispatchEmergency;

/**
 * Generate dynamic insights from clustering results.
 * Produces human-centric, tactical intelligence for city dispatchers.
 *
 * @param {Array} clusters - Array of cluster objects from DBSCAN++
 * @param {Array} noise - Array of noise points
 * @param {Array} allData - All complaint records
 * @returns {Object} Insights object with stats and tactical cards
 */
function generateSmartInsights(clusters, noise, allData) {
  const insights = {
    stats: {
      totalcomplaints: allData.length,
      totalClusters: clusters.length,
      criticalHotspots: 0,
      efficiencyScore: 0,
      activeIncidents: 0,
      historyLogs: 0,
      advisories: 0
    },
    cards: []
  };

  if (Array.isArray(allData) && typeof window.detectTemporalContext === "function") {
    for (const point of allData) {
      const info = window.detectTemporalContext(point?.description || "");
      if (info?.tag === "present") insights.stats.activeIncidents++;
      if (info?.tag === "past") insights.stats.historyLogs++;
      if (info?.tag === "future") insights.stats.advisories++;
    }
  }

  // Calculate noise reduction (efficiency) - proves we're saving city work
  if (allData.length > 0) {
    const reduction = ((allData.length - clusters.length) / allData.length) * 100;
    insights.stats.efficiencyScore = Math.round(reduction);
  }

  // Analyze each cluster and generate tactical cards
  clusters.forEach((cluster, idx) => {
    const size = cluster.length;
    const categories = [...new Set(cluster.map(p => p.subcategory || p.category))];
    const dominantCategory = getMostCommonCategory(cluster);
    const severity = determineSeverity(size, dominantCategory);
    const location = getClusterCenterFromPoints(cluster);
    const zoom = calculateOptimalZoom(cluster);
    const zoneName = getZoneLocation(cluster);
    const dispatchUnit = getDispatchUnit(dominantCategory);

    // OFFLINE ZONE DETECTION: Get administrative barangay from coordinates
    const detectedBarangay = getJurisdiction(location.lat, location.lng);

    const hasCriticalCategory = cluster.some(p =>
      ["Fire", "Flooding", "Flood", "Pipe Leak", "Accident", "Public Safety"].includes(p.subcategory || p.category)
    );

    const hasSpatialAnomaly = cluster.some(p => p.road_proximity_anomaly || p.spatial_warning);
    const anomalyReport = cluster.find(p => p.road_proximity_anomaly || p.spatial_warning);

    // Track critical hotspots (Priority Zones)
    if (severity === "CRITICAL" || (size > 5 && hasCriticalCategory)) {
      insights.stats.criticalHotspots++;
    }

    // LOGIC 0: Spatial Anomaly Alert (New in v3.9.5)
    if (hasSpatialAnomaly) {
      insights.cards.push({
        type: "warning",
        badge: "🎯 SPATIAL ANOMALY",
        title: `LOCATION VERIFICATION: ${dominantCategory.toUpperCase()}`,
        zoneBadge: detectedBarangay,
        description: `System detected <span class="report-count">geospatial inconsistencies</span> in reported location. Road-related complaint found outside typical road coordinates. <strong>Verification required before dispatch.</strong>`,
        action: `GEO-VERIFY LOCATION`,
        dispatchUnit: "GIS VALIDATION TEAM",
        icon: "map-marker-slash",
        location: { lat: location.lat, lng: location.lng, zoom: zoom + 1 },
        clusterId: idx,
        rawData: { count: size, category: dominantCategory, zoneName, barangay: detectedBarangay, anomaly: true, complaintIds: cluster.map(p => p.id).filter(Boolean), complaints: cluster.map(p => ({ id: p.id, title: p.title || p.description?.substring(0, 60) || "Untitled", category: p.subcategory || p.category, status: p.workflow_status || p.status || "submitted", submitted_at: p.submitted_at || p.created_at })).filter(p => p.id) }
      });
    }

    // LOGIC 1: Critical Alert - High Priority Zones
    if (size > 8 || (size > 5 && hasCriticalCategory)) {
      insights.cards.push({
        type: "critical",
        badge: "🔴 CRITICAL ALERT",
        title: `${dominantCategory.toUpperCase()}`,
        zoneBadge: detectedBarangay,
        description: `<span class="report-count">${size} citizen reports</span> merged near <span class="location-text">${detectedBarangay}</span>. System suggests this is a priority incident.`,
        action: `REVIEW & DISPATCH`,
        dispatchUnit,
        icon: "exclamation-circle",
        location: { lat: location.lat, lng: location.lng, zoom },
        clusterId: idx,
        rawData: { count: size, category: dominantCategory, zoneName, barangay: detectedBarangay, complaintIds: cluster.map(p => p.id).filter(Boolean), complaints: cluster.map(p => ({ id: p.id, title: p.title || p.description?.substring(0, 60) || "Untitled", category: p.subcategory || p.category, status: p.workflow_status || p.status || "submitted", submitted_at: p.submitted_at || p.created_at })).filter(p => p.id) }
      });
    }
    // LOGIC 2: Warning - Standard Zones
    else if (size >= 3) {
      insights.cards.push({
        type: "warning",
        badge: "⚠️ ZONE WARNING",
        title: `${dominantCategory.toUpperCase()}`,
        zoneBadge: detectedBarangay,
        description: `<span class="report-count">${size} citizen reports</span> merged near <span class="location-text">${detectedBarangay}</span>. System suggests this is a developing incident.`,
        action: `REVIEW & DISPATCH`,
        dispatchUnit,
        icon: "exclamation-triangle",
        location: { lat: location.lat, lng: location.lng, zoom },
        clusterId: idx,
        rawData: { count: size, category: dominantCategory, zoneName, barangay: detectedBarangay, complaintIds: cluster.map(p => p.id).filter(Boolean), complaints: cluster.map(p => ({ id: p.id, title: p.title || p.description?.substring(0, 60) || "Untitled", category: p.subcategory || p.category, status: p.workflow_status || p.status || "submitted", submitted_at: p.submitted_at || p.created_at })).filter(p => p.id) }
      });
    }

  });

  // SUMMARY CARD: System Performance Report
  if (allData.length > 0 && clusters.length > 0) {
    const originalCount = allData.length;
    const reducedCount = clusters.length;
    const noiseCount = noise.length;
    const efficiency = insights.stats.efficiencyScore;

    // Find largest cluster for navigation
    let largestCluster = clusters[0] || [];
    clusters.forEach(c => {
      if (c.length > largestCluster.length) largestCluster = c;
    });

    const largestCenter = largestCluster.length > 0 ?
      getClusterCenterFromPoints(largestCluster) : { lat: 6.7490, lng: 125.3572 };
    const largestZoom = calculateOptimalZoom(largestCluster);

    insights.cards.push({
      type: "info",
      badge: "📊 SYSTEM STATUS",
      title: `RESOURCE OPTIMIZATION`,
      description: `<span class="report-count">${originalCount} citizen inputs</span> compressed to <span class="report-count">${reducedCount} verified incidents</span>. ${noiseCount} isolated reports filtered as noise. City workload reduced by <span class="location-text">${efficiency}%</span>.`,
      action: `Review ${reducedCount} incidents for resource allocation`,
      icon: "tasks",
      location: { lat: largestCenter.lat, lng: largestCenter.lng, zoom: largestZoom }
    });
  }

  // TREND CARD: Dominant Issue Analysis
  const categoryStats = analyzeCategoryDistribution(allData);
  const mostCommon = categoryStats[0];

  if (mostCommon) {
    const percentage = Math.round((mostCommon.count / allData.length) * 100);
    const dispatchUnit = getDispatchUnit(mostCommon.category);

    // Find best cluster for this category
    let bestCluster = null;
    let bestCount = 0;

    clusters.forEach(cluster => {
      const categoryCount = cluster.filter(p =>
        (p.category === mostCommon.category) || (p.subcategory === mostCommon.category)
      ).length;
      if (categoryCount > bestCount) {
        bestCount = categoryCount;
        bestCluster = cluster;
      }
    });

    let trendCenter, trendZoom;

    if (bestCluster && bestCluster.length > 0) {
      trendCenter = getClusterCenterFromPoints(bestCluster);
      trendZoom = calculateOptimalZoom(bestCluster);
    } else {
      const firstMatch = allData.find(p =>
        (p.category === mostCommon.category || p.subcategory === mostCommon.category) &&
                p.latitude && p.longitude
      );
      trendCenter = firstMatch ?
        { lat: firstMatch.latitude, lng: firstMatch.longitude } :
        { lat: 6.7490, lng: 125.3572 };
      trendZoom = 16;
    }

    insights.cards.push({
      type: "info",
      badge: "📈 TRENDING",
      title: `PRIMARY CONCERN: ${mostCommon.category.toUpperCase()}`,
      description: `<span class="report-count">${mostCommon.count} reports (${percentage}%)</span> of total. This is the highest volume issue citywide.`,
      action: `PRIORITIZE: <span class="unit-type">${dispatchUnit}</span> deployment`,
      icon: "chart-line",
      location: { lat: trendCenter.lat, lng: trendCenter.lng, zoom: trendZoom }
    });
  }

  // Sort cards: Critical first, then Warning, Cascade, Info
  const order = { critical: 0, warning: 1, cascade: 2, info: 3 };
  insights.cards.sort((a, b) => order[a.type] - order[b.type]);

  return insights;
}

// ==================== HELPER FUNCTIONS ====================

function getMostCommonCategory(cluster) {
  const counts = {};
  cluster.forEach(p => {
    // Use subcategory if available, otherwise category
    const cat = p.subcategory || p.category;
    if (cat) {
      counts[cat] = (counts[cat] || 0) + 1;
    }
  });
  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, "Unknown");
}

/**
 * Calculate the geographic center of a cluster (array of points).
 * NOTE: This is different from window.getClusterCenter which works with cluster objects.
 */
function getClusterCenterFromPoints(cluster) {
  const points = Array.isArray(cluster)
    ? cluster.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    : [];
  if (points.length === 0) return { lat: 6.7490, lng: 125.3572 };
  const lat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length;
  const lng = points.reduce((sum, p) => sum + p.longitude, 0) / points.length;
  return { lat, lng };
}

/**
 * Calculate optimal zoom level based on geographic spread of complaints
 * @param {Array} points - Array of complaint objects with latitude/longitude
 * @returns {number} Optimal zoom level (10-18)
 */
function calculateOptimalZoom(points) {
  const validPoints = Array.isArray(points)
    ? points.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    : [];
  if (validPoints.length === 0) return 13;
  if (validPoints.length === 1) return 17;

  // Calculate bounding box
  const lats = validPoints.map(p => p.latitude);
  const lngs = validPoints.map(p => p.longitude);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Calculate span in degrees
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  const maxSpan = Math.max(latSpan, lngSpan);

  // Convert span to zoom level
  // Smaller span = higher zoom (more zoomed in)
  // Larger span = lower zoom (more zoomed out)
  if (maxSpan < 0.001) return 18;      // ~100m or less - street level
  if (maxSpan < 0.005) return 16;      // ~500m - neighborhood
  if (maxSpan < 0.01) return 15;       // ~1km - district
  if (maxSpan < 0.02) return 14;       // ~2km - multiple districts
  if (maxSpan < 0.05) return 13;       // ~5km - city section
  if (maxSpan < 0.1) return 12;        // ~10km - whole city
  return 11;                           // ~15km+ - city and surroundings
}


function analyzeCategoryDistribution(data) {
  const counts = {};
  data.forEach(p => {
    // Use subcategory if available, otherwise category
    const cat = p.subcategory || p.category;
    if (cat) {
      counts[cat] = (counts[cat] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

function buildApproximateClusters(points, cellSize = 0.01, minGroupSize = 3) {
  const groups = new Map();

  (points || []).forEach((point) => {
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
      return;
    }

    const latCell = Math.floor(point.latitude / cellSize);
    const lngCell = Math.floor(point.longitude / cellSize);
    const key = `${latCell}:${lngCell}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(point);
  });

  const clustered = [];
  const noise = [];

  groups.forEach((bucket) => {
    if (bucket.length >= minGroupSize) {
      clustered.push(bucket);
    } else {
      noise.push(...bucket);
    }
  });

  clustered.sort((a, b) => b.length - a.length);

  return {
    clusters: clustered,
    noise,
  };
}


// ==================== UI UPDATE FUNCTIONS ====================

function updateStatsDisplay(insights) {
  if (!insights || !insights.stats) return;

  const totalEl = document.getElementById("totalcomplaints");
  const clustersEl = document.getElementById("totalClusters");
  const hotspotsEl = document.getElementById("criticalHotspots");
  const efficiencyEl = document.getElementById("efficiencyScore");

  if (totalEl) totalEl.textContent = (insights.stats.totalcomplaints || 0).toLocaleString();
  if (clustersEl) clustersEl.textContent = insights.stats.totalClusters || 0;
  if (efficiencyEl) efficiencyEl.textContent = `${insights.stats.efficiencyScore || 0}%`;

  const activeEl = document.getElementById("activeIncidentsCount");
  const historyEl = document.getElementById("historyLogsCount");
  const advEl = document.getElementById("advisoriesCount");

  if (activeEl) activeEl.textContent = insights.stats.activeIncidents ?? "--";
  if (historyEl) historyEl.textContent = insights.stats.historyLogs ?? "--";
  if (advEl) advEl.textContent = insights.stats.advisories ?? "--";
}

window.applyGlobalFilters = async function() {
  if (isSimulationLoading) {
    console.warn("[HUD] Filter apply blocked: Engine is currently busy.");
    return;
  }

  // Clear existing state immediately to provide feedback
  clearDashboardUI();

  const catSelect = document.getElementById("filter-category");
  const selectedOptions = Array.from(catSelect.selectedOptions);

  // v5.5: Optimization - If all are selected, just send "all"
  const totalOptions = Array.from(catSelect.options).length;
  const isAllSelected = selectedOptions.length === totalOptions || selectedOptions.length === 0;

  // Separate parent categories and granular subcategories
  const selectedCategories = isAllSelected ? "all" : selectedOptions
    .filter(o => o.dataset.level === "parent")
    .map(o => o.value);

  const selectedSubcategories = isAllSelected ? undefined : selectedOptions
    .filter(o => o.dataset.level === "child")
    .map(o => o.value);

  const filters = {
    category: selectedCategories,
    subcategory: selectedSubcategories,
    startDate: document.getElementById("filter-start-date").value,
    endDate: document.getElementById("filter-end-date").value
  };

  console.log("[HUD] Applying filters (optimized):", filters);

  try {
    // 1. Fetch new data based on filters
    await fetchServercomplaints(API_ENDPOINT, { ...filters, silent: true });

    // 2. Perform Analysis
    await loadFullSimulation();

    // 3. HUD UI Synchronization
    const applyBtn = document.getElementById("apply-filters-btn");
    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.classList.remove("pulse-glow");
    }

    console.log("[HUD] Global filters applied successfully.");
  } catch (err) {
    console.error("[HUD] Filter application failed:", err);
  }
};

/**
 * v5.1: Layer Switcher exclusivity implementation
 * Refactors the HUD buttons to act as Radio-style alternatives.
 */
function initializeExclusiveToggles() {
  const toggles = {
    clusters: {
      btn: document.getElementById("btn-toggle-clusters"),
      check: document.getElementById("clustersSwitch"),
      action: (val) => {
        if (!val) return;
        setVisualizationMode("clusters");
      }
    },
    heatmap: {
      btn: document.getElementById("btn-toggle-heatmap"),
      check: document.getElementById("heatmapSwitch"),
      action: (val) => {
        if (!val) return;
        setVisualizationMode("heatmap");
      }
    },
    markers: {
      btn: document.getElementById("btn-toggle-markers"),
      check: document.getElementById("markersToggle"),
      action: (val) => {
        if (!val) return;
        setVisualizationMode("markers");
      }
    }
  };

  const switchMode = (selectedKey) => {
    Object.entries(toggles).forEach(([key, cfg]) => {
      const isActive = key === selectedKey;

      // Update UI
      if (cfg.btn) {
        if (isActive) {
          cfg.btn.classList.add("active");
          console.log(`[HUD] Setting ${key} button to ACTIVE`, cfg.btn);
        } else {
          cfg.btn.classList.remove("active");
        }
      }

      if (cfg.check) cfg.check.checked = isActive;

      // Trigger logic for the active mode only
      if (isActive) cfg.action(true);
    });
  };

  // Attach event listeners to hud buttons
  Object.keys(toggles).forEach(key => {
    const {btn} = toggles[key];
    if (btn) {
      btn.addEventListener("click", (e) => {
        console.log(`[HUD] ${key} button clicked`);
        switchMode(key);
      });
    } else {
      console.warn(`[HUD] Button for ${key} NOT FOUND in DOM`);
    }
  });

  // 4. Set Default State (AI Clusters)
  switchMode("clusters");

  console.log("[HUD] Exclusive toggles initialized.");
}

// v5.1: Expose globally for initialization
window.initializeExclusiveToggles = initializeExclusiveToggles;

/**
 * Atomic clear of all dashboard UI components to prevent stale data.
 * Resets metrics, trends, and intelligence panels to an initial/loading state.
 */
function clearDashboardUI() {
  console.log("[HUD] Atomic UI Clear triggered");

  // 1. Reset Metric Cards
  const metricIds = ["totalcomplaints", "totalClusters", "criticalHotspots", "efficiencyScore"];
  metricIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = "--";
  });

  // 2. Clear Category Bars
  const catBars = document.getElementById("categoryBars");
  if (catBars) catBars.innerHTML = '<div class="text-[10px] text-white/20 p-4 text-center">AWAITING STREAM...</div>';

  // 3. Clear Intelligence Panel
  const insightsContent = document.getElementById("insightsContent");
  if (insightsContent) {
    insightsContent.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center opacity-50 py-10">
        <i class="fas fa-microchip text-3xl mb-3 fa-spin"></i>
        <p class="text-xs font-semibold">ANALYZING STREAM...</p>
      </div>
    `;
  }

  // 4. Reset Emergency Bar
  const emCount = document.getElementById("emergencyCount");
  if (emCount) emCount.textContent = "0";

  const emContent = document.getElementById("emergencyContent");
  if (emContent) emContent.innerHTML = "";
}

/**
 * v4.7: Show Dispatch Modal with list of complaints in a cluster
 * Opens a dark-themed modal listing all complaints so the user can pick one to review/update.
 */
function showDispatchModal(zone, clusterTitle, complaintIds, cardIndex) {
  // Remove any existing modal first
  const existingModal = document.getElementById("dispatch-modal");
  if (existingModal) existingModal.remove();

  // Build complaint items HTML
  const itemsHtml = complaintIds.map((id, i) => `
    <div class="dispatch-item" style="
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px; background: rgba(255,255,255,0.03);
      transition: all 0.2s ease; cursor: pointer;
    " onmouseenter="this.style.background='rgba(59,130,246,0.1)';this.style.borderColor='rgba(59,130,246,0.3)'"
       onmouseleave="this.style.background='rgba(255,255,255,0.03)';this.style.borderColor='rgba(255,255,255,0.08)'"
       onclick="window.open('/complaint-details/${id}', '_blank')">
      <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
        <div style="
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(59,130,246,0.15); display: flex;
          align-items: center; justify-content: center;
          font-size: 11px; font-weight: 800; color: #60a5fa; flex-shrink: 0;
        ">${i + 1}</div>
        <div style="min-width: 0; flex: 1;">
          <div style="font-size: 11px; font-weight: 700; color: #e2e8f0; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            COMPLAINT #${id.substring(0, 8).toUpperCase()}
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
            Click to view details & update status
          </div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
        <button style="
          background: linear-gradient(135deg, #2563eb, #1d4ed8);
          color: white; border: none; padding: 6px 14px;
          border-radius: 6px; font-size: 10px; font-weight: 700;
          cursor: pointer; text-transform: uppercase; letter-spacing: 0.05em;
        " onclick="event.stopPropagation(); window.open('/complaint-details/${id}', '_blank')">
          <i class="fas fa-external-link-alt" style="margin-right: 4px;"></i>View & Update
        </button>
      </div>
    </div>
  `).join("");

  // Create modal
  const modal = document.createElement("div");
  modal.id = "dispatch-modal";
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px);
    animation: fadeIn 0.2s ease;
  `;

  modal.innerHTML = `
    <div style="
      background: linear-gradient(145deg, #0f172a, #1e293b);
      width: 520px; max-height: 80vh; border-radius: 16px;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06);
      animation: slideUp 0.25s ease;
    ">
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      </style>

      <!-- Header -->
      <div style="padding: 20px 24px 16px; border-bottom: 1px solid rgba(255,255,255,0.06);">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; animation: pulse 2s infinite;"></span>
              <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #3b82f6;">
                DISPATCH QUEUE
              </span>
            </div>
            <h3 style="margin: 0; color: #f1f5f9; font-size: 16px; font-weight: 700;">
              ${clusterTitle}
            </h3>
            <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">
              <i class="fas fa-map-marker-alt" style="margin-right: 4px;"></i>${zone} &bull; ${complaintIds.length} complaints in cluster
            </p>
          </div>
          <button id="dispatch-modal-close" style="
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            color: #94a3b8; width: 32px; height: 32px; border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; font-size: 14px; transition: all 0.2s;
          " onmouseenter="this.style.background='rgba(239,68,68,0.15)';this.style.color='#ef4444'"
             onmouseleave="this.style.background='rgba(255,255,255,0.05)';this.style.color='#94a3b8'">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>

      <!-- Complaint List -->
      <div style="padding: 16px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; flex: 1;">
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin-bottom: 4px;">
          Select a complaint to review & update status
        </div>
        ${itemsHtml}
      </div>

      <!-- Footer -->
      <div style="padding: 12px 24px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: flex-end;">
        <button id="dispatch-modal-cancel" style="
          padding: 8px 20px; border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05); color: #94a3b8;
          border-radius: 8px; cursor: pointer; font-size: 11px;
          font-weight: 600; transition: all 0.2s;
        " onmouseenter="this.style.background='rgba(255,255,255,0.1)'"
           onmouseleave="this.style.background='rgba(255,255,255,0.05)'">
          Close
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  const closeModal = () => modal.remove();
  document.getElementById("dispatch-modal-close").addEventListener("click", closeModal);
  document.getElementById("dispatch-modal-cancel").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", function escHandler(e) {
    if (e.key === "Escape") {
      closeModal();
      document.removeEventListener("keydown", escHandler);
    }
  });
}

function renderInsightsCards(insights) {
  const container = document.getElementById("insightsContent");

  if (insights.cards.length === 0) {
    container.innerHTML = `
            <div class="insight-placeholder">
                <i class="fas fa-satellite-dish"></i>
                <p>No significant patterns detected</p>
                <span class="placeholder-hint">Increase data sample or adjust filters</span>
            </div>
        `;
    return;
  }

  container.innerHTML = insights.cards.map((card, index) => {
    const isCritical = card.type.includes("critical") || card.badge?.includes("CRITICAL");
    const priorityColor = isCritical ? "#ef4444" : "#3b82f6";

    return `
        <div class="insight-card ${card.type}" 
             data-card-index="${index}" 
             ${card.rawData?.complaintIds ? `data-complaint-ids="${card.rawData.complaintIds.join(",")}"` : ""}
             ${card.location ? `data-has-location="true" data-lat="${card.location.lat}" data-lng="${card.location.lng}" data-zoom="${card.location.zoom}"` : ""}>
            
            <div class="tactical-line-top"></div>
            
            <div class="insight-status-strip" style="background: ${priorityColor}"></div>

            <!-- Header: Zone & Location -->
            <div class="insight-header-main">
                <div class="insight-zone-row">
                    <span class="tactical-label">SECTOR:</span>
                    <span class="tactical-value">${card.zoneBadge || "GLOBAL"}</span>
                    ${card.location ? `<i class="fas fa-crosshairs pulse-slow" title="Navigate"></i>` : ""}
                </div>
                <div class="insight-alert-row">
                     <span class="priority-led ${isCritical ? "led-red" : "led-blue"}"></span>
                     <span class="insight-badge ${card.type}">${card.badge}</span>
                </div>
            </div>

            <h3 class="insight-main-title">${card.title}</h3>
            
            <p class="insight-description">${card.description}</p>
            
            <!-- Metadata Grid -->
            <div class="tactical-meta-grid">
                 ${card.dispatchUnit ? `
                 <div class="meta-item-box">
                    <span class="box-label">RECOM_UNIT</span>
                    <span class="box-value">${card.dispatchUnit}</span>
                 </div>
                 ` : ""}
                 <div class="meta-item-box">
                    <span class="box-label">STATUS</span>
                    <span class="box-value">ANALYZED</span>
                 </div>
            </div>

            <!-- Action Area -->
            <div class="insight-action-area">
                <button class="dispatch-btn tactical-button-glow" data-zone="${card.zoneBadge || "Unknown"}">
                    <span class="btn-scan-line"></span>
                    <i class="fas fa-satellite-dish"></i>
                    AUTHENTICATE & DISPATCH
                </button>
            </div>
        </div>
    `;}).join("");

  // Add click handlers to cards with location data
  attachCardClickHandlers();
}

/**
 * Attach click handlers to insight cards for map navigation
 */
function attachCardClickHandlers() {
  const cardElements = document.querySelectorAll('.insight-card[data-has-location="true"]');

  cardElements.forEach((cardElement) => {
    // Read location data directly from the element's data attributes
    const lat = parseFloat(cardElement.dataset.lat);
    const lng = parseFloat(cardElement.dataset.lng);
    const zoom = parseInt(cardElement.dataset.zoom);

    if (!isNaN(lat) && !isNaN(lng) && !isNaN(zoom)) {
      cardElement.style.cursor = "pointer";

      cardElement.addEventListener("click", () => {
        console.log("[NAV] Flying to:", lat, lng, "zoom:", zoom);

        // Collapse command center when clicking a complaint card
        collapseCommandCenter();

        // Animate map to location
        map.flyTo([lat, lng], zoom, {
          duration: 1.5,
          easeLinearity: 0.25
        });

        // Add visual feedback
        cardElement.style.transform = "scale(0.98)";
        setTimeout(() => {
          cardElement.style.transform = "";
        }, 200);

        // Show notification
        showLocationNotification();
      });

      // Add hover effect
      cardElement.addEventListener("mouseenter", () => {
        cardElement.style.boxShadow = "0 8px 24px rgba(59, 130, 246, 0.3)";
      });

      cardElement.addEventListener("mouseleave", () => {
        cardElement.style.boxShadow = "";
      });
    }
  });
}

/**
 * Show brief notification when navigating to location
 */
function showLocationNotification() {
  const notification = document.createElement("div");
  notification.className = "location-notification";
  notification.innerHTML = `
        <i class="fas fa-location-arrow"></i>
        <span>Navigating to location...</span>
    `;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = "0";
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

function renderCategoryDistribution(data) {
  const distribution = analyzeCategoryDistribution(data);
  const container = document.getElementById("categoryBars");
  if (!container) return;

  // v5.0: Calculate "OTHERS" to ensure mathematical total matches (117 vs 20k fix)
  const TOP_COUNT = 10;
  const topCategories = distribution.slice(0, TOP_COUNT);
  const totalInTop = topCategories.reduce((sum, item) => sum + item.count, 0);
  const totalCount = data.length;
  const othersCount = totalCount - totalInTop;

  const displayList = [...topCategories];
  if (othersCount > 0) {
    displayList.push({ category: "OTHERS", count: othersCount });
  }

  const maxCount = distribution[0]?.count || 1;

  container.innerHTML = displayList.map(item => {
    const percentage = (item.count / maxCount) * 100;
    const isOthers = item.category === "OTHERS";

    return `
            <div class="category-bar-item" style="${isOthers ? "opacity: 0.6; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 4px; padding-top: 8px;" : ""}">
                <div class="category-bar-label">
                    <span class="category-bar-name" style="${isOthers ? "font-style: italic; font-size: 9px;" : ""}">${item.category}</span>
                    <span class="category-bar-count">${item.count.toLocaleString()}</span>
                </div>
                <div class="category-bar-track">
                    <div class="category-bar-fill" style="width: ${percentage}%; background: ${isOthers ? "#475569" : "var(--accent-blue)"}"></div>
                </div>
            </div>
        `;
  }).join("");
}

// ==================== HEATMAP FUNCTIONS ====================

// Store category heat layers for toggling
let categoryHeatLayers = {};

function createHeatmap(data) {
  if (!window.L.heatLayer) {
    console.error("[HEATMAP] Leaflet.heat plugin not loaded");
    return;
  }

  // Destroy existing heatmap layers
  Object.values(categoryHeatLayers).forEach(layer => {
    if (layer && map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  });
  categoryHeatLayers = {};

  // Build heatmap data grouped by category
  const categoryData = {};

  data.filter(p => p.latitude && p.longitude).forEach(p => {
    const category = p.category || "Others";
    if (!categoryData[category]) {
      categoryData[category] = [];
    }

    // Intensity based on priority
    let intensity = 0.5;
    const upperCat = category.toUpperCase();
    if (upperCat.includes("EMERGENCY") || upperCat.includes("FIRE")) {
      intensity = 1.0;
    } else if (upperCat.includes("FLOOD") || upperCat.includes("ACCIDENT") || upperCat.includes("CRIME")) {
      intensity = 0.8;
    } else if (upperCat.includes("HEALTH") || upperCat.includes("UTILITY")) {
      intensity = 0.6;
    }

    categoryData[category].push([p.latitude, p.longitude, intensity]);
  });

  // Create a separate heat layer for each category
  Object.entries(categoryData).forEach(([category, points]) => {
    if (points.length === 0) return;

    const color = categoryColors[category] || "#3b82f6"; // Default blue

    // Convert category color to heatmap gradient
    const gradient = {
      0.0: `${color  }00`, // Transparent
      0.3: `${color  }40`, // 25% opacity
      0.5: `${color  }80`, // 50% opacity
      0.7: `${color  }cc`, // 80% opacity
      1.0: color         // Full color
    };

    const heatLayer = L.heatLayer(points, {
      radius: 25,
      blur: 0,
      maxZoom: 17,
      max: 1.0,
      gradient
    });

    categoryHeatLayers[category] = heatLayer;
  });

  console.log("[HEATMAP] Created", Object.keys(categoryHeatLayers).length, "category layers");
}

function toggleHeatmap() {
  const button = document.getElementById("toggleHeatmap");

  // Toggle all category heat layers
  const anyShown = Object.values(categoryHeatLayers).some(layer => layer && map.hasLayer(layer));

  Object.values(categoryHeatLayers).forEach(layer => {
    if (!layer) return;

    if (anyShown) {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    } else if (!map.hasLayer(layer)) map.addLayer(layer);
  });

  if (anyShown) {
    if (button) button.classList.remove("active");
    console.log("[HEATMAP] Hidden");
  } else {
    if (button) button.classList.add("active");
    console.log("[HEATMAP] Shown");
  }
}

/**
 * Toggle visibility of cluster markers, connection lines, and noise points.
 * When hidden, background markers become interactive to show complaint details.
 * Useful for decluttering the map or focusing on heatmap data.
 */
function toggleClusters() {
  const button = document.getElementById("toggleClusters");

  if (!simulationEngine) {
    console.warn("[CLUSTERS] Simulation engine not initialized");
    return;
  }

  clustersVisible = !clustersVisible;

  if (clustersVisible) {
    // Show clusters - show spotlight markers
    simulationEngine.spotlightMarkers.forEach(marker => {
      if (marker && map.hasLayer) {
        marker.addTo(map);
      }
    });

    simulationEngine.connectionLines.forEach(line => {
      if (line && map.hasLayer) {
        line.addTo(map);
      }
    });

    // Show convex hulls if any
    if (simulationEngine.convexHullLayers) {
      simulationEngine.convexHullLayers.forEach(hull => {
        if (hull && map) hull.addTo(map);
      });
    }

    button.classList.add("active");
    console.log("[CLUSTERS] Shown - Background markers remain independent");
  } else {
    // Hide clusters - hide spotlight markers
    simulationEngine.spotlightMarkers.forEach(marker => {
      if (marker && map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    });

    simulationEngine.connectionLines.forEach(line => {
      if (line && map.hasLayer(line)) {
        map.removeLayer(line);
      }
    });

    // Hide convex hulls
    if (simulationEngine.convexHullLayers) {
      simulationEngine.convexHullLayers.forEach(hull => {
        if (hull && map.hasLayer(hull)) map.removeLayer(hull);
      });
    }

    // Note: We no longer touch background markers here
    // They are controlled independently by the markers toggle
    button.classList.remove("active");
    console.log("[CLUSTERS] Hidden - Background markers remain independent");
  }
}

/**
 * v4.1: Initialize Map Layers Dropdown
 * Consolidates visualization toggles into a single dropdown for cleaner header.
 * Handles: Heatmap toggle, Clusters toggle, Emergency Panel
 */
function initMapLayersDropdown() {
  const heatmapSwitch = document.getElementById("heatmapSwitch");
  const clustersSwitch = document.getElementById("clustersSwitch");
  const markersToggle = document.getElementById("markersToggle");
  const emergencyMarkersToggle = document.getElementById("emergencyMarkersToggle");
  const btnCycleTiles = document.getElementById("btn-cycle-tiles");

  console.log("[MAP LAYERS] Initializing tactical HUD listeners");

  // Heatmap toggle via switch
  if (heatmapSwitch) {
    heatmapSwitch.addEventListener("change", () => {
      if (heatmapSwitch.checked) {
        setVisualizationMode("heatmap");
      } else if (currentVisualizationMode === "heatmap") {
        setVisualizationMode("clusters");
      }
    });
  }

  // Clusters toggle via switch
  if (clustersSwitch) {
    clustersSwitch.addEventListener("change", () => {
      if (clustersSwitch.checked) {
        setVisualizationMode("clusters");
      } else if (currentVisualizationMode === "clusters") {
        setVisualizationMode("markers");
      }
    });
  }

  // Individual Markers toggle
  if (markersToggle) {
    markersToggle.addEventListener("change", () => {
      if (markersToggle.checked) {
        setVisualizationMode("markers");
      } else if (currentVisualizationMode === "markers") {
        setVisualizationMode("clusters");
      }
    });
  }

  // Emergency Markers toggle
  if (emergencyMarkersToggle) {
    emergencyMarkersToggle.addEventListener("change", () => {
      console.log("[HUD] Toggle emergencies:", emergencyMarkersToggle.checked);
      const emMarkers = document.querySelectorAll(".emergency-marker-container");
      emMarkers.forEach(m => m.style.display = emergencyMarkersToggle.checked ? "block" : "none");
    });
  }

  // v4.6 Tile Switcher Listener
  if (btnCycleTiles) {
    btnCycleTiles.addEventListener("click", () => {
      if (typeof window.cycleMapTiles === "function") {
        window.cycleMapTiles();
      }
    });
  }
}

function getNormalizedCategoryFilter() {
  if (Array.isArray(currentFilterCategory)) return currentFilterCategory;
  if (
    typeof currentFilterCategory === "string" &&
    currentFilterCategory !== "all"
  ) {
    return [currentFilterCategory];
  }
  return "all";
}

function getNormalizedSubcategoryFilter() {
  if (Array.isArray(currentFilterSubcategory)) return currentFilterSubcategory;
  if (
    typeof currentFilterSubcategory === "string" &&
    currentFilterSubcategory !== "all"
  ) {
    return [currentFilterSubcategory];
  }
  return undefined;
}

function setVisualizationMode(mode) {
  if (!simulationEngine || !map) return;

  const resolvedMode = ["clusters", "heatmap", "markers"].includes(mode)
    ? mode
    : "clusters";
  currentVisualizationMode = resolvedMode;

  const clustersSwitch = document.getElementById("clustersSwitch");
  const heatmapSwitch = document.getElementById("heatmapSwitch");
  const markersToggle = document.getElementById("markersToggle");
  const clusterBtn = document.getElementById("btn-toggle-clusters");
  const heatmapBtn = document.getElementById("btn-toggle-heatmap");
  const markersBtn = document.getElementById("btn-toggle-markers");

  if (clustersSwitch) clustersSwitch.checked = resolvedMode === "clusters";
  if (heatmapSwitch) heatmapSwitch.checked = resolvedMode === "heatmap";
  if (markersToggle) markersToggle.checked = resolvedMode === "markers";

  if (clusterBtn) clusterBtn.classList.toggle("active", resolvedMode === "clusters");
  if (heatmapBtn) heatmapBtn.classList.toggle("active", resolvedMode === "heatmap");
  if (markersBtn) markersBtn.classList.toggle("active", resolvedMode === "markers");

  toggleHeatmapFromDropdown(resolvedMode === "heatmap");
  toggleClustersFromDropdown(resolvedMode === "clusters");

  if (resolvedMode === "markers") {
    simulationEngine.filterBackgroundMarkersByCategory(getNormalizedCategoryFilter(), {
      startDate: currentFilterStartDate,
      endDate: currentFilterEndDate,
      subcategory: getNormalizedSubcategoryFilter(),
    });
    simulationEngine.showBackgroundMarkers();
  } else {
    simulationEngine.hideBackgroundMarkers();
  }
}

/**
 * Toggle heatmap from dropdown switch
 * @param {boolean} show - Whether to show heatmap
 */
function toggleHeatmapFromDropdown(show) {
  // Toggle all category heat layers
  Object.entries(categoryHeatLayers).forEach(([category, layer]) => {
    if (!layer) return;

    if (show && !map.hasLayer(layer)) {
      map.addLayer(layer);
    } else if (!show && map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  });

  if (show && Object.keys(categoryHeatLayers).length > 0) {
    console.log("[HEATMAP] Shown via dropdown");
  } else if (!show) {
    console.log("[HEATMAP] Hidden via dropdown");
  } else {
    console.warn("[HEATMAP] Layers not yet created - load data first");
    // Reset switch
    const heatmapSwitch = document.getElementById("heatmapSwitch");
    if (heatmapSwitch) heatmapSwitch.checked = false;
  }
}

/**
 * Toggle clusters from dropdown switch
 * @param {boolean} show - Whether to show clusters
 */
function toggleClustersFromDropdown(show) {
  if (!simulationEngine) {
    console.warn("[CLUSTERS] Simulation engine not initialized");
    return;
  }

  clustersVisible = show;

  // Get noise markers (those with noise-marker-container class)
  const noiseMarkers = simulationEngine.spotlightMarkers.filter(m =>
    m.options?.className?.includes("noise-marker-container")
  );
  const clusterMarkers = simulationEngine.spotlightMarkers.filter(m =>
    !m.options?.className?.includes("noise-marker-container")
  );

  if (clustersVisible) {
    // Show clusters - hide noise markers
    clusterMarkers.forEach(marker => {
      if (marker && map) marker.addTo(map);
    });

    simulationEngine.connectionLines.forEach(line => {
      if (line && map) line.addTo(map);
    });

    // Show convex hulls if any
    if (simulationEngine.convexHullLayers) {
      simulationEngine.convexHullLayers.forEach(hull => {
        if (hull && map) hull.addTo(map);
      });
    }

    console.log("[CLUSTERS] Shown via independent toggle");
  } else {
    // Hide clusters and associated artifacts
    clusterMarkers.forEach(marker => {
      if (marker && map.hasLayer(marker)) map.removeLayer(marker);
    });

    simulationEngine.connectionLines.forEach(line => {
      if (line && map.hasLayer(line)) map.removeLayer(line);
    });

    // Hide convex hulls
    if (simulationEngine.convexHullLayers) {
      simulationEngine.convexHullLayers.forEach(hull => {
        if (hull && map.hasLayer(hull)) map.removeLayer(hull);
      });
    }

    console.log("[CLUSTERS] Hidden via independent toggle");
  }
}

/**
 * Toggle Emergency Panel visibility
 */
function toggleEmergencyPanel() {
  const panel = document.getElementById("emergencyPanel");
  if (!panel) {
    console.warn("[EMERGENCY] Panel element not found");
    return;
  }

  const show = arguments.length > 0 ? arguments[0] : undefined;
  if (typeof show === "boolean") {
    if (show) panel.classList.remove("hidden");
    else panel.classList.add("hidden");
  } else {
    panel.classList.toggle("hidden");
  }

  if (!panel.classList.contains("hidden") && currentCriticalPoints && currentCriticalPoints.length > 0) {
    panel.classList.add("active");
  } else {
    panel.classList.remove("active");
  }

  // Send message to parent/consumer if needed
  if (panel.classList.contains("hidden")) {
    console.log("[EMERGENCY] Panel hidden");
  } else {
    console.log("[EMERGENCY] Panel shown");
  }
}

/**
 * Update emergency count badge in dropdown
 * Called when emergency complaints change
 * @param {number} count - Number of emergencies
 */
function updateEmergencyDropdownBadge(count) {
  const badge = document.getElementById("emergencyCountDropdown");
  if (badge) {
    badge.textContent = count;
    if (count > 0) {
      badge.classList.add("has-emergencies");
    } else {
      badge.classList.remove("has-emergencies");
    }
  }
}

// Export for use by emergency panel
window.updateEmergencyDropdownBadge = updateEmergencyDropdownBadge;

/**
 * Create a simple popup for background markers when clusters are hidden.
 * Uses the unified generatecomplaintPopupHTML for consistency.
 * @param {Object} complaint - The complaint object
 * @returns {string} HTML popup content
 */
function createSimplecomplaintPopup(complaint) {
  // Use the unified popup generator without cluster context
  // This ensures individual complaint data is always shown correctly
  return generatecomplaintPopupHTML(complaint, null, "#6b7280", null);
}

// ==================== CLUSTER VISUALIZATION ====================
// "Glass Box" Decision Support System - Explain the AI's Reasoning

// ================================================================
// UNIVERSAL INSIGHT ENGINE v3.7.2
// ================================================================
// Generates quantitative, context-aware insights for clusters.
// Includes: Physical Span (meters), Semantic Context, Street Location
// ================================================================

/**
 * Calculate the physical span (diagonal distance) of a cluster in meters.
 * Uses bounding box + Haversine formula for accurate measurement.
 *
 * @param {Array} clusterPoints - Array of complaint objects with latitude/longitude
 * @returns {number} Span in meters
 */
function calculateClusterSpan(clusterPoints) {
  if (!clusterPoints || clusterPoints.length < 2) return 0;

  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

  clusterPoints.forEach(p => {
    const lat = p.latitude;
    const lng = p.longitude;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  });

  // Use global haversineDistance (defined in simulation-engine.js)
  if (window.haversineDistance) {
    return window.haversineDistance(minLat, minLng, maxLat, maxLng);
  }

  // Fallback calculation if haversineDistance not available
  const R = 6371000; // Earth radius in meters
  const φ1 = minLat * Math.PI / 180;
  const φ2 = maxLat * Math.PI / 180;
  const Δφ = (maxLat - minLat) * Math.PI / 180;
  const Δλ = (maxLng - minLng) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get the most common element in an array (mode).
 * @param {Array} arr - Array of values
 * @returns {*} Most frequent value or null
 */
function getMode(arr) {
  if (!arr || arr.length === 0) return null;

  const frequency = {};
  let maxFreq = 0;
  let mode = null;

  arr.forEach(item => {
    if (item) {
      frequency[item] = (frequency[item] || 0) + 1;
      if (frequency[item] > maxFreq) {
        maxFreq = frequency[item];
        mode = item;
      }
    }
  });

  return mode;
}

/**
 * CATEGORY CONTEXT DICTIONARY
 * Maps categories to semantically appropriate nouns for insights.
 */
const CATEGORY_CONTEXT_NOUNS = {
  // Infrastructure
  "Pothole": "road segment",
  "Road Damage": "road segment",
  "Road Obstruction": "road stretch",
  "Infrastructure": "infrastructure zone",
  "Bridge Collapse": "structural hazard zone",

  // Traffic & Transport
  "Traffic": "congestion zone",
  "Accident": "incident radius",

  // Water & Flooding
  "Flood": "inundation zone",
  "Flooding": "inundation zone",
  "Pipe Leak": "water supply segment",
  "No Water": "service outage zone",

  // Fire & Safety
  "Fire": "hazard radius",
  "Crime": "incident zone",
  "Public Safety": "safety concern zone",

  // Sanitation & Environment
  "Garbage": "dumping area",
  "Trash": "waste accumulation zone",
  "Illegal Dumping": "dumping ground",
  "Bad Odor": "affected perimeter",

  // Utilities
  "Blackout": "power outage zone",
  "Streetlight": "dark zone",
  "Broken Streetlight": "unlit stretch",

  // Noise & Disturbance
  "Noise": "disturbance radius",
  "Noise complaint": "noise zone",

  // Default
  "Default": "affected area"
};

/**
 * Detect cluster type and generate human-readable explanation.
 * This is the "Glass Box" feature that explains WHY the AI grouped complaints.
 *
 * v3.7.2 UPGRADE: Now includes physical span measurement and semantic context.
 *
 * @param {Array} cluster - Array of complaints in this cluster
 * @returns {Object} { type, emoji, title, explanation, span, contextNoun }
 */
function analyzeClusterRationale(cluster) {
  const categories = [...new Set(cluster.map(p => p.subcategory || p.category))];

  // ================================================================
  // v3.7.2: PHYSICAL SPAN CALCULATION
  // ================================================================
  const spanMeters = calculateClusterSpan(cluster);
  const spanRounded = Math.round(spanMeters);

  // Size classification
  let sizeDescription;
  if (spanMeters < 15) {
    sizeDescription = `localized spot (~${  spanRounded  }m)`;
  } else if (spanMeters < 50) {
    sizeDescription = `small cluster (~${  spanRounded  }m span)`;
  } else if (spanMeters < 150) {
    sizeDescription = `medium zone (~${  spanRounded  }m span)`;
  } else {
    sizeDescription = `large area (~${  spanRounded  }m span)`;
  }

  // Get dominant category
  const allCategories = cluster.map(p => p.subcategory || p.category);
  const dominantCategory = getMode(allCategories) || "Unknown";

  // Get semantic context noun
  const contextNoun = CATEGORY_CONTEXT_NOUNS[dominantCategory] || CATEGORY_CONTEXT_NOUNS["Default"];

  // Get street names from geocoded data (if available)
  const streetNames = cluster
    .map(p => p.geocodedAddress?.street)
    .filter(s => s);
  const dominantStreet = getMode(streetNames);
  const locationPhrase = dominantStreet
    ? `along ${dominantStreet}`
    : `in ${getJurisdiction(cluster[0]?.latitude, cluster[0]?.longitude) || "the mapped sector"}`;

  // Density adjective
  const densityAdjective = cluster.length > 8 ? "Critical density of" :
    cluster.length > 5 ? "High concentration of" :
      "Cluster of";

  // Multiple categories detected
  if (categories.length >= 2) {
    return {
      type: "multi-issue",
      emoji: "📋",
      title: "MULTI-ISSUE ZONE",
      explanation: `${densityAdjective} ${categories.length} issue types ${locationPhrase} covering ~${spanRounded}m (${categories.join(", ")}). Multi-department coordination may be required.`,
      allCategories: categories,
      span: spanRounded,
      sizeDescription,
      contextNoun,
      street: dominantStreet
    };
  }

  // Single category - spatial hotspot
  const epsilon = getAdaptiveEpsilonForCategory(dominantCategory);

  // Build quantitative explanation
  let explanation;
  if (spanMeters > 20) {
    // Large area: emphasize span
    explanation = `${densityAdjective} similar "${dominantCategory}" reports ${locationPhrase} covering a ${contextNoun} of approximately ${spanRounded} meters. System suggests a continuous underlying issue across this stretch.`;
  } else {
    // Localized spot: emphasize concentration
    explanation = `${densityAdjective} similar "${dominantCategory}" reports concentrated at a ${sizeDescription} ${locationPhrase}. System suggests a single point-source issue.`;
  }

  return {
    type: "spatial-hotspot",
    emoji: "📍",
    title: "SPATIAL HOTSPOT",
    explanation,
    allCategories: categories,
    span: spanRounded,
    sizeDescription,
    contextNoun,
    street: dominantStreet
  };
}

// Export for global access
window.calculateClusterSpan = calculateClusterSpan;
window.getMode = getMode;
window.CATEGORY_CONTEXT_NOUNS = CATEGORY_CONTEXT_NOUNS;

/**
 * Get adaptive epsilon for a category (used in explanations)
 */
function getAdaptiveEpsilonForCategory(category) {
  const epsilonMap = {
    "Pipe Leak": 25, "Flooding": 40, "Flood": 40, "No Water": 40,
    "Pothole": 30, "Road Damage": 40, "Infrastructure": 40,
    "Trash": 35, "Illegal Dumping": 35, "Sanitation": 35,
    "Fire": 60, "Public Safety": 50, "Traffic": 60
  };
  return epsilonMap[category] || 40;
}

/**
 * v3.9: Generate tooltip HTML explaining how Triage Score was calculated.
 * Provides detailed breakdown with explanations for each component.
 *
 * @param {Object} intelligence - Intelligence result from analyzecomplaintIntelligence()
 * @returns {string} HTML string for the tooltip content
 */
function generateTriageTooltip(intelligence) {
  if (!intelligence || !intelligence.breakdown) {
    return '<div class="triage-tooltip">No intelligence data available.</div>';
  }

  const bd = intelligence.breakdown;
  const finalScore = intelligence.urgencyScore;

  // Determine tier explanation based on base score
  let tierExplanation = "";
  if (bd.base === 50) {
    tierExplanation = "Tier 1 (Life-threatening): Fire, Accident, Crime";
  } else if (bd.base === 30) {
    tierExplanation = "Tier 2 (Urgent): Flood, Medical, Public Safety";
  } else if (bd.base === 10) {
    tierExplanation = "Tier 3 (Routine): Pothole, Garbage, Traffic";
  } else {
    tierExplanation = `Category-based score`;
  }

  // Build panic explanation
  let panicExplanation = "";
  if (bd.panic > 0) {
    const panicDetails = [];
    if (bd.panic >= 10) panicDetails.push("CAPS LOCK detected (+10)");
    if (bd.panic >= 5 && bd.panic < 10) panicDetails.push("Multiple !!! detected (+5)");
    if (bd.panic > 0 && bd.panic < 5) panicDetails.push("Fear keywords detected (+2)");
    panicExplanation = panicDetails.join(", ") || "Panic signals detected";
  }

  // Build veracity explanation
  let veracityExplanation = "";
  if (bd.veracity < 0) {
    veracityExplanation = "Short description (&lt;3 words) = UNVERIFIED";
  } else if (bd.veracity > 0) {
    veracityExplanation = "Detailed description (≥5 words) = HIGH CONFIDENCE";
  } else {
    veracityExplanation = "Standard length description";
  }

  // Build cap explanation
  let capExplanation = "";
  if (bd.isCapped) {
    if (bd.overrideType === "TRAFFIC_CONTEXT") {
      capExplanation = "Traffic-related context detected → Max 35 pts";
    } else if (bd.overrideType === "MAINTENANCE_CONTEXT") {
      capExplanation = "Infrastructure/maintenance context detected → Max 30 pts";
    } else {
      capExplanation = "Context suppression applied → Score capped";
    }
  }

  // Build the calculation string
  const calculationParts = [`${bd.base}`];
  if (bd.panic > 0) calculationParts.push(`+${bd.panic}`);
  if (bd.veracity !== 0) calculationParts.push(`${bd.veracity > 0 ? "+" : ""}${bd.veracity}`);
  if (bd.emergencyBoost) calculationParts.push(`+${bd.emergencyBoost.amount}`);
  if (bd.geospatialBoost) calculationParts.push(`+${bd.geospatialBoost.boost}`);

  const rawScore = bd.originalScore || finalScore;
  const calculationStr = `${calculationParts.join(" ")  } = ${rawScore}`;

  return `
        <div class="triage-tooltip">
            <div class="tooltip-title">
                <i class="fas fa-calculator"></i> Score Calculation Explained
            </div>
            
            <div class="tooltip-formula">
                ${calculationStr}${bd.isCapped ? ` → CAPPED to ${finalScore}` : ""}
            </div>
            
            <div class="tooltip-section">
                <div class="tooltip-section-title">Score Components</div>
                
                <div class="tooltip-item">
                    <span class="tooltip-item-label">📊 Base Score</span>
                    <span class="tooltip-item-value">${bd.base}</span>
                </div>
                <div class="tooltip-item" style="padding-left: 12px; font-size: 9px; color: #94a3b8;">
                    ${tierExplanation}
                </div>
                
                ${bd.panic > 0 ? `
                <div class="tooltip-item">
                    <span class="tooltip-item-label">🚨 Panic Signals</span>
                    <span class="tooltip-item-value">+${bd.panic}</span>
                </div>
                <div class="tooltip-item" style="padding-left: 12px; font-size: 9px; color: #94a3b8;">
                    ${panicExplanation}
                </div>
                ` : ""}
                
                ${bd.veracity !== 0 ? `
                <div class="tooltip-item">
                    <span class="tooltip-item-label">✓ Veracity</span>
                    <span class="tooltip-item-value ${bd.veracity < 0 ? "penalty" : ""}">${bd.veracity > 0 ? "+" : ""}${bd.veracity}</span>
                </div>
                <div class="tooltip-item" style="padding-left: 12px; font-size: 9px; color: #94a3b8;">
                    ${veracityExplanation}
                </div>
                ` : ""}
                
                ${bd.emergencyBoost ? `
                <div class="tooltip-item">
                    <span class="tooltip-item-label">🔥 Emergency Boost</span>
                    <span class="tooltip-item-value">+${bd.emergencyBoost.amount}</span>
                </div>
                <div class="tooltip-item" style="padding-left: 12px; font-size: 9px; color: #94a3b8;">
                    ${bd.emergencyBoost.reason || "Critical category detected"}
                </div>
                ` : ""}
                
                ${bd.geospatialBoost ? `
                <div class="tooltip-item">
                    <span class="tooltip-item-label">${bd.geospatialBoost.type === "HIGHWAY_PRIORITY" ? "🛣️" : "🌊"} Geo Boost</span>
                    <span class="tooltip-item-value">+${bd.geospatialBoost.boost}</span>
                </div>
                <div class="tooltip-item" style="padding-left: 12px; font-size: 9px; color: #94a3b8;">
                    ${bd.geospatialBoost.type === "HIGHWAY_PRIORITY" ? "Highway/major road location" : "Near water feature (flood risk)"}
                </div>
                ` : ""}
            </div>
            
            ${bd.isCapped ? `
            <div class="tooltip-section">
                <div class="tooltip-section-title">⚠️ Score Cap Applied</div>
                <div class="tooltip-item">
                    <span class="tooltip-item-label">Original Score</span>
                    <span class="tooltip-item-value capped">${bd.originalScore || rawScore}</span>
                </div>
                <div class="tooltip-item">
                    <span class="tooltip-item-label">Capped To</span>
                    <span class="tooltip-item-value capped">${finalScore}</span>
                </div>
                <div class="tooltip-item" style="padding-left: 0; font-size: 9px; color: #f59e0b;">
                    ${capExplanation}${bd.matchedContext ? ` (matched: "${bd.matchedContext}")` : ""}
                </div>
            </div>
            ` : ""}
            
            <div class="tooltip-note">
                <i class="fas fa-info-circle"></i>
                Scores ≥70 = Emergency (Red), 40-69 = Priority (Yellow), &lt;40 = Routine (Blue)
            </div>
        </div>
    `;
}

// Export for global access
window.generateTriageTooltip = generateTriageTooltip;

/**
 * Generate individual complaint popup HTML with full transparency.
 * CRITICAL: Always uses POINT data, never CLUSTER aggregate data.
 * Includes NLP Category Mismatch detection (Feature 2).
 * Shows "merged warning" if point category differs from cluster dominant category.
 *
 * @param {Object} point - Individual complaint object with raw data
 * @param {string} clusterId - ID of the cluster (or null for noise points)
 * @param {string} clusterColor - Cluster color for visual consistency
 * @param {string} dominantCategory - Cluster's dominant category (optional)
 * @returns {string} HTML string for popup content
 */
function generatecomplaintPopupHTML(point, clusterId = null, clusterColor = "#6b7280", dominantCategory = null) {
  // ================================================================
  // DUAL STATE UI v3.5 - 2-COLUMN GRID LAYOUT REFACTOR
  // ================================================================
  // CRITICAL FIX: Header color is determined by urgencyScore, NOT category.
  // This ensures "Traffic caused by flood" (Score 35) shows BLUE, not RED.
  // Reference: [AI Suggestion.txt] cite: 14
  // ================================================================

  // v3.7: Attach cached geocode data for geospatial verification
  if (window.attachCachedGeocode) {
    window.attachCachedGeocode(point);
  }

  // 1. Get Intelligence from Engine (STOP SELF-CALCULATING)
  const intelligence = window.analyzecomplaintIntelligence ?
    window.analyzecomplaintIntelligence(point) : null;

  // DEBUG: Log to console to verify score-based coloring is working
  console.log("[POPUP v3.7] Category:", point.category, "| Description:", `${point.description?.substring(0, 50)  }...`);
  console.log("[POPUP v3.7] Intelligence:", intelligence ? `Score=${intelligence.urgencyScore}, GeoBoost=${intelligence.breakdown.geospatialBoost?.type || "none"}` : "NULL!");

  // 2. Analyze NLP Mismatch
  const mismatchResult = window.validateCategoryMismatch ?
    window.validateCategoryMismatch(point) : null;

  const isMismatch = mismatchResult && mismatchResult.mismatch;
  const suggestedCategory = mismatchResult?.suggestedCategory || "Unknown";
  const detectedKeywords = mismatchResult?.matchedKeywords || [];

  // Get point's actual category (after potential AI reclassification)
  const pointCategory = point.subcategory || point.category;

  // v3.6.1: Check if AI reclassified the category
  const wasReclassified = point.ai_reclassified === true;
  const originalCategory = point.original_category || null;

  // Format timestamp
  const timestamp = new Date(point.timestamp).toLocaleString("en-PH", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  // ================================================================
  // SCORE-BASED COLORING [cite: 14]
  // ================================================================
  let headerColor = "#3b82f6"; // Default: Blue (Routine)
  let headerClass = "header-routine";
  let urgencyLevel = "ROUTINE";

  if (intelligence) {
    if (intelligence.urgencyScore >= 70) {
      headerColor = "#ef4444"; // Red (Emergency)
      headerClass = "header-emergency";
      urgencyLevel = "EMERGENCY";
    } else if (intelligence.urgencyScore >= 40) {
      headerColor = "#f59e0b"; // Yellow (Priority)
      headerClass = "header-warning";
      urgencyLevel = "PRIORITY";
    } else {
      headerColor = "#3b82f6"; // Blue (Routine)
      headerClass = "header-routine";
      urgencyLevel = "ROUTINE";
    }
  }

  // ================================================================
  // BUILD UI COMPONENTS
  // ================================================================

  // Veracity Badge (for header)
  let veracityBadgeHTML = "";
  if (intelligence) {
    const badgeClass = intelligence.veracityLabel === "UNVERIFIED" ? "badge-warning" :
      intelligence.veracityLabel === "HIGH CONFIDENCE" ? "badge-success" :
        intelligence.veracityLabel === "MAINTENANCE" ? "badge-maintenance" : "badge-moderate";
    const badgeIcon = intelligence.veracityLabel === "UNVERIFIED" ? "exclamation-circle" :
      intelligence.veracityLabel === "HIGH CONFIDENCE" ? "check-circle" :
        intelligence.veracityLabel === "MAINTENANCE" ? "wrench" : "info-circle";

    veracityBadgeHTML = `
            <span class="veracity-badge ${badgeClass}">
                <i class="fas fa-${badgeIcon}"></i> ${intelligence.veracityLabel}
            </span>
        `;
  }

  // Cluster Banner (LEFT COLUMN - Part A)
  let clusterBannerHTML = "";
  if (clusterId) {
    clusterBannerHTML = `
            <div class="popup-cluster-banner">
                <i class="fas fa-chart-pie"></i> Part of Cluster #${clusterId}
            </div>
        `;
  }

  // Urgency Score Panel (RIGHT COLUMN - Part A)
  let urgencyScoreHTML = "";
  if (intelligence) {
    const {isCapped} = intelligence.breakdown;
    const urgencyClass = intelligence.urgencyScore >= 70 ? "urgency-high" :
      intelligence.urgencyScore >= 40 ? "urgency-medium" : "urgency-low";
    const displayClass = isCapped ? "urgency-capped" : urgencyClass;
    const originalScoreHTML = isCapped && intelligence.breakdown.originalScore > intelligence.urgencyScore ?
      `<span class="original-score">(was ${intelligence.breakdown.originalScore})</span>` : "";

    // v3.6.1: Build emergency boost display if present
    const boostHTML = intelligence.breakdown.emergencyBoost
      ? `<span class="breakdown-item boost">+${intelligence.breakdown.emergencyBoost.amount} 🔥</span>`
      : "";

    // v3.7: Build geospatial boost display if present
    const geoBoostHTML = intelligence.breakdown.geospatialBoost
      ? `<span class="breakdown-item geo-boost">+${intelligence.breakdown.geospatialBoost.boost} ${intelligence.breakdown.geospatialBoost.type === "HIGHWAY_PRIORITY" ? "🛣️" : "🌊"}</span>`
      : "";

    // v3.9: Build tooltip explanation for triage score
    const tooltipExplanation = generateTriageTooltip(intelligence);

    urgencyScoreHTML = `
            <div class="triage-score-panel">
                <div class="popup-label">
                    <i class="fas fa-microchip"></i> System Triage Analysis
                </div>
                <div class="triage-display ${displayClass}">
                    <span class="triage-value">${intelligence.urgencyScore}</span>
                    <span class="triage-max">/ 100</span>
                    ${originalScoreHTML}
                </div>
                <div class="popup-progress-container">
                    <div class="popup-progress-bar" style="width: ${intelligence.urgencyScore}%; background: ${headerColor}; box-shadow: 0 0 10px ${headerColor}88;"></div>
                </div>
                <div class="popup-meta-grid" style="margin-top: 1rem;">
                    <div class="popup-meta-box">
                        <span class="popup-label" style="font-size: 8px;">Base Score</span>
                        <span class="popup-value">${intelligence.breakdown.base}</span>
                    </div>
                    <div class="popup-meta-box">
                        <span class="popup-label" style="font-size: 8px;">Breakdown</span>
                        <div class="triage-mini-tags" style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px;">
                            ${intelligence.breakdown.panic > 0 ? `<span style="font-size: 8px; color: #f43f5e;">+${intelligence.breakdown.panic}P</span>` : ""}
                            ${intelligence.breakdown.veracity !== 0 ? `<span style="font-size: 8px; color: ${intelligence.breakdown.veracity > 0 ? "#22c55e" : "#f43f5e"};">${intelligence.breakdown.veracity > 0 ? "+" : ""}${intelligence.breakdown.veracity}V</span>` : ""}
                            ${boostHTML}
                            ${geoBoostHTML}
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  // Action Box (RIGHT COLUMN - Part B)
  let actionHTML = "";
  if (intelligence) {
    let actionLabel;
    let actionClass;

    if (intelligence.suggestedAction) {
      actionLabel = intelligence.suggestedAction;
      if (intelligence.breakdown.overrideType === "MAINTENANCE_CONTEXT") {
        actionClass = "action-engineering";
      } else if (intelligence.breakdown.overrideType === "TRAFFIC_CONTEXT") {
        actionClass = "action-traffic";
      } else if (intelligence.breakdown.overrideType === "NEGATION_OVERRIDE") {
        actionClass = "action-standard";
      } else {
        actionClass = "action-standard";
      }
    } else if (intelligence.urgencyScore >= 70) {
      actionLabel = "🚨 PRIORITIZE DISPATCH";
      actionClass = "action-critical";
    } else if (intelligence.urgencyScore >= 40) {
      actionLabel = "⚡ EXPEDITE RESPONSE";
      actionClass = "action-warning";
    } else {
      actionLabel = "📋 QUEUE FOR REVIEW";
      actionClass = "action-standard";
    }

    const contextNote = intelligence.breakdown.isCapped && intelligence.breakdown.matchedContext ?
      `<div class="action-context">📌 Matched: "${intelligence.breakdown.matchedContext}"</div>` : "";

    actionHTML = `
            <div class="tactical-popup-card recommended-action" style="margin-top: 1rem; padding: 0.75rem;">
                <div class="popup-label" style="margin-bottom: 0.25rem;">Recommended Response</div>
                <div class="dispatch-btn">
                    <div class="btn-scan-line"></div>
                    <i class="fas fa-bolt"></i> ${actionLabel}
                </div>
                ${contextNote}
            </div>
        `;
  }

  // Merged Warning (RIGHT COLUMN - Part C)
  let mergedWarningHTML = "";
  if (clusterId && dominantCategory && pointCategory !== dominantCategory) {
    mergedWarningHTML = `
            <div class="warning-box warning-merged">
                <div class="warning-header">
                    <i class="fas fa-random"></i> MERGED
                </div>
                <div class="warning-body">
                    This <strong>${pointCategory}</strong> report was merged into a 
                    <strong>${dominantCategory}</strong> cluster.
                </div>
            </div>
        `;
  }

  // Context Suppression Warning (RIGHT COLUMN - Part C)
  let contextSuppressionWarningHTML = "";
  if (intelligence && intelligence.breakdown.isCapped) {
    contextSuppressionWarningHTML = `
            <div class="warning-box warning-suppression">
                <div class="warning-header">
                    <i class="fas fa-shield-alt"></i> CONTEXT SUPPRESSION
                </div>
                <div class="warning-body">
                    System has downgraded this alert based on contextual analysis.
                </div>
            </div>
        `;
  }

  // NLP Mismatch Alert (RIGHT COLUMN - Part C)
  let mismatchAlertHTML = "";
  if (isMismatch) {
    // v3.9.5: Support for multiple detected categories (Mitigation for multi-keyword reports)
    const otherDetected = (mismatchResult.allDetected || [])
      .filter(cat => cat !== suggestedCategory);

    const suggestedHTML = otherDetected.length > 0
      ? `<strong class="text-success">${suggestedCategory}</strong> <span style="font-size: 9px; opacity: 0.7;">(+${otherDetected.length} others)</span>`
      : `<strong class="text-success">${suggestedCategory}</strong>`;

    mismatchAlertHTML = `
            <div class="warning-box warning-mismatch">
                <div class="warning-header">
                    <i class="fas fa-exclamation-triangle"></i> NLP MISMATCH
                </div>
                <div class="warning-body">
                    <div class="mismatch-row">
                        <span>User:</span> <strong class="text-danger">${pointCategory}</strong>
                    </div>
                    <div class="mismatch-row">
                        <span>NLP:</span> ${suggestedHTML}
                    </div>
                    <div class="warning-meta">Keywords: ${detectedKeywords.join(", ") || "N/A"}</div>
                    ${otherDetected.length > 0 ? `<div class="warning-meta">Also detected: ${otherDetected.join(", ")}</div>` : ""}
                </div>
            </div>
        `;
  }

  // ================================================================
  // v4.2: SPATIAL ANOMALY WARNING (Feature 2)
  // Shows specific reason why a complaint is flagged as anomaly
  // ================================================================
  let anomalyWarningHTML = "";
  if (point.road_proximity_anomaly || point.spatial_warning) {
    // Determine specific anomaly reason
    let anomalyReason = "";
    let anomalyIcon = "exclamation-triangle";

    if (point.road_validation && !point.road_validation.isValid) {
      const {distance} = point.road_validation;
      if (distance) {
        anomalyReason = `Location is ${Math.round(distance)}m from nearest road (Potential GPS Error)`;
      } else {
        anomalyReason = "No physical road detected within validation radius";
      }
      anomalyIcon = "map-marker-alt";
    } else if (point.spatial_warning) {
      anomalyReason = point.spatial_warning;
      anomalyIcon = "globe-americas";
    } else {
      // Default fallback reason
      anomalyReason = "Isolated incident location (requires manual verification)";
    }

    anomalyWarningHTML = `
            <div class="warning-box warning-anomaly">
                <div class="warning-header">
                    <i class="fas fa-${anomalyIcon}" style="color: #ef4444;"></i> SPATIAL ANOMALY
                </div>
                <div class="warning-body">
                    <div class="anomaly-reason">
                        ⚠️ <strong>Anomaly Detected:</strong> ${anomalyReason}
                    </div>
                    <div class="warning-meta">
                        <i class="fas fa-info-circle"></i> Verify coordinates before dispatching
                    </div>
                </div>
            </div>
        `;
  }

  // ================================================================
  // v4.2: DYNAMIC AI REASONING (Feature 3)
  // Shows real-time calculated values from NLP analysis
  // ================================================================
  let aiReasoningHTML = "";
  if (intelligence && intelligence.nlpResult) {
    const nlp = intelligence.nlpResult;
    const matchedKeywords = nlp.matchedKeywords || [];
    const intensifiers = nlp.intensifiers || [];
    const confidence = Math.round((nlp.confidence || intelligence.urgencyScore / 100) * 100);
    const detectedCategory = nlp.category || pointCategory;

    // Build dynamic reasoning sentence
    const reasoningParts = [];

    // Part 1: Classification reason
    if (matchedKeywords.length > 0) {
      const keywordStr = matchedKeywords.slice(0, 3).map(k => `'${k}'`).join(", ");
      reasoningParts.push(`Classified as <strong>${detectedCategory}</strong> (Confidence: ${confidence}%) because text contained ${keywordStr}`);
    } else {
      reasoningParts.push(`Classified as <strong>${detectedCategory}</strong> (Confidence: ${confidence}%)`);
    }

    // Part 2: Urgency modifiers
    if (intensifiers.length > 0) {
      const intensifierStr = intensifiers.slice(0, 2).map(i => `'${i}'`).join(", ");
      const boostAmount = intelligence.breakdown.panic || 0;
      if (boostAmount > 0) {
        reasoningParts.push(`Urgency boosted by +${boostAmount} due to modifier ${intensifierStr}`);
      }
    }

    // Part 3: Emergency boost
    if (intelligence.breakdown.emergencyBoost) {
      reasoningParts.push(`Emergency keywords detected (+${intelligence.breakdown.emergencyBoost.amount} boost)`);
    }

    // Part 4: Geospatial context
    if (intelligence.breakdown.geospatialBoost) {
      const geoType = intelligence.breakdown.geospatialBoost.type === "HIGHWAY_PRIORITY" ? "highway proximity" : "flood-prone zone";
      reasoningParts.push(`Location context: ${geoType} (+${intelligence.breakdown.geospatialBoost.boost})`);
    }

    // Part 5: Negation detected
    if (intelligence.breakdown.negation) {
      reasoningParts.push(`Negation detected: "${intelligence.breakdown.negation}" (reduced urgency)`);
    }

    aiReasoningHTML = `
            <div class="ai-reasoning-section">
                <div class="reasoning-header">
                    <i class="fas fa-robot"></i> AI REASONING
                </div>
                <div class="reasoning-content">
                    ${reasoningParts.map(part => `<p class="reasoning-line">${part}</p>`).join("")}
                </div>
            </div>
        `;
  }

  // ================================================================
  // FINAL HTML OUTPUT - 2-COLUMN GRID LAYOUT
  // ================================================================
  // v3.6.1: Build AI Reclassified Badge (shows when category was auto-corrected)
  const reclassifiedBadge = wasReclassified ? `
        <span class="ai-reclassified-badge" title="AI auto-corrected from: ${originalCategory}">
            <i class="fas fa-robot"></i> Auto-Detected
        </span>
    ` : "";

  // v4.0: Build Multi-Label Categories display (if multiple categories detected)
  // v4.1: Updated to use horizontal progress bars for relative urgency visualization
  let multiLabelHTML = "";
  if (intelligence && intelligence.nlpResult && intelligence.nlpResult.detectedCategories && intelligence.nlpResult.detectedCategories.length > 1) {
    const detectedCats = intelligence.nlpResult.detectedCategories;
    const maxUrgency = Math.max(...detectedCats.map(dc => dc.urgency || 0));

    const additionalCats = detectedCats.slice(1).map(dc => {
      const urgencyPercent = Math.round((dc.urgency / 100) * 100);
      const relativeWidth = Math.round((dc.urgency / maxUrgency) * 100);
      const urgencyClass = dc.urgency >= 70 ? "high" : dc.urgency >= 50 ? "medium" : "low";

      return `
                <div class="multi-label-bar-item">
                    <div class="bar-label">
                        <span class="bar-category">${dc.category}</span>
                        <span class="bar-percent">${urgencyPercent}%</span>
                    </div>
                    <div class="bar-track">
                        <div class="bar-fill ${urgencyClass}" style="width: ${relativeWidth}%"></div>
                    </div>
                </div>
            `;
    }).join("");

    multiLabelHTML = `
            <div class="multi-label-section">
                <div class="multi-label-header">
                    <i class="fas fa-layer-group"></i> COMPOUND INCIDENT (Related Categories)
                </div>
                <div class="multi-label-bars">
                    ${additionalCats}
                </div>
            </div>
        `;
  }

  // v4.0: Build AI-Used Badge (shows when TF.js fallback was triggered)
  let aiUsedBadge = "";
  if (intelligence && intelligence.nlpResult && intelligence.nlpResult.aiUsed) {
    aiUsedBadge = `
            <span class="ai-fallback-badge" title="TensorFlow.js AI was used for classification">
                <i class="fas fa-brain"></i> AI Enhanced
            </span>
        `;
  }

  return `
        <div class="tactical-popup-container">
            <!-- ===== TACTICAL HEADER ===== -->
            <div class="tactical-popup-header">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="header-led-active pulse-fast" style="background: ${headerColor}; box-shadow: 0 0 10px ${headerColor};"></span>
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-family: 'JetBrains Mono', monospace; font-size: 8px; color: ${headerColor}; letter-spacing: 2px; font-weight: 800;">SYS_INTEL_STREAM [${urgencyLevel}]</span>
                        <h3 style="font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 1.1rem; color: #fff; margin: 0; text-transform: uppercase;">${pointCategory}</h3>
                    </div>
                </div>
                <div style="display: flex; gap: 6px;">
                    ${reclassifiedBadge}
                    ${veracityBadgeHTML}
                </div>
            </div>
            
            <div class="tactical-popup-body">
                
                <!-- ===== CITIZEN REPORT CARD ===== -->
                <div class="tactical-popup-card citizen-report">
                    <div class="popup-label">
                        <i class="fas fa-user-shield"></i> Tactical Feed: Citizen Input
                    </div>
                    
                    ${clusterBannerHTML}
                    
                    <blockquote class="popup-quote">
                        "${sanitizeHTML(point.description) || "No technical description provided by reporter"}"
                    </blockquote>
                    
                    <div class="popup-meta-grid">
                        <div class="popup-meta-box">
                            <span class="popup-label" style="font-size: 8px;">Network ID</span>
                            <span class="popup-value" style="font-family: 'JetBrains Mono', monospace; font-size: 10px;">${point.id ? sanitizeHTML(point.id.substring(0, 12)).toUpperCase() : "N/A"}</span>
                        </div>
                        <div class="popup-meta-box">
                            <span class="popup-label" style="font-size: 8px;">Sourcing</span>
                            <span class="popup-value" style="font-size: 10px;">${getJurisdiction(point.latitude, point.longitude)}</span>
                        </div>
                    </div>

                    <!-- v3.7: Location Bridge -->
                    <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 8px; font-size: 10px; color: #94a3b8;"
                         data-lat="${point.latitude}" 
                         data-lng="${point.longitude}"
                         id="complaint-street-${point.id ? point.id.substring(0, 8) : Math.random().toString(36).substring(7)}">
                        <i class="fas fa-crosshairs shadow-pulse" style="color: ${headerColor};"></i>
                        <span class="street-value">VERIFYING GEOSPATIAL COORDINATES...</span>
                    </div>
                </div>
                
                <!-- ===== SYSTEM INTELLIGENCE CARD ===== -->
                <div class="tactical-popup-card system-intel">
                    ${urgencyScoreHTML}
                    ${aiReasoningHTML}
                    ${multiLabelHTML}
                    
                    <!-- Integrated Warnings -->
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 12px;">
                        ${anomalyWarningHTML}
                        ${mergedWarningHTML}
                        ${mismatchAlertHTML}
                    </div>
                </div>

                ${actionHTML}

                <div style="text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 7px; color: #475569; letter-spacing: 1px; margin-top: 0.5rem; text-transform: uppercase;">
                    Security Clearance: Tactical Admin | End of Stream
                </div>
            </div>
        </div>
    `;
}

// Expose for map-intelligence-panel.js (lazy rendering)
window.generatecomplaintPopupHTML = generatecomplaintPopupHTML;

/**
 * Create Glass Box cluster popup explaining AI reasoning.
 * Uses Multi-Jurisdiction Voting for accurate location (Feature 3).
 * v3.8: Now includes correlated neighboring clusters analysis.
 */
function createGlassBoxPopup(cluster, idx, color, rationale, allClusters = null) {
  // ================================================================
  // GLASS BOX CLUSTER POPUP v3.5 - 2-COLUMN GRID LAYOUT
  // Matches the new Complaint popup design system
  // ================================================================

  const center = getClusterCenterFromPoints(cluster);

  // Feature 3: Use voting algorithm instead of center-point detection
  const jurisdictionVotes = window.calculateJurisdictionVotes ?
    window.calculateJurisdictionVotes(cluster) :
    { label: getJurisdiction(center.lat, center.lng), isBoundaryZone: false, votes: {} };

  // Category breakdown with counts
  const categoryCount = {};
  cluster.forEach(p => {
    const cat = p.subcategory || p.category;
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });

  // Sort by count descending
  const sortedCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1]);

  // Get max count for bar visualization
  const maxCount = sortedCategories.length > 0 ? sortedCategories[0][1] : 1;

  // Build category breakdown with bar visualization
  const categoryBreakdownHTML = sortedCategories.map(([cat, count]) => {
    const barWidth = Math.round((count / maxCount) * 100);
    return `
            <div class="category-row">
                <div class="category-count">${count}×</div>
                <div class="category-info">
                    <div class="category-name">${cat}</div>
                    <div class="category-bar">
                        <div class="category-bar-fill" style="width: ${barWidth}%; background: ${color};"></div>
                    </div>
                </div>
            </div>
        `;
  }).join("");

  // Determine header color based on cluster severity
  // Use the dominant category's urgency or cluster size
  let headerColor = color;
  let headerClass = "header-routine";
  let severityLevel = "ROUTINE";

  // Calculate average urgency score for the cluster
  let totalUrgency = 0;
  let urgencyCount = 0;
  cluster.forEach(p => {
    const intelligence = window.analyzecomplaintIntelligence ?
      window.analyzecomplaintIntelligence(p) : null;
    if (intelligence) {
      totalUrgency += intelligence.urgencyScore;
      urgencyCount++;
    }
  });
  const avgUrgency = urgencyCount > 0 ? Math.round(totalUrgency / urgencyCount) : 0;

  if (avgUrgency >= 70 || cluster.length >= 10) {
    headerColor = "#ef4444";
    headerClass = "header-emergency";
    severityLevel = "CRITICAL";
  } else if (avgUrgency >= 40 || cluster.length >= 5) {
    headerColor = "#f59e0b";
    headerClass = "header-warning";
    severityLevel = "ELEVATED";
  } else {
    headerColor = "#3b82f6";
    headerClass = "header-routine";
    severityLevel = "ROUTINE";
  }

  // Jurisdiction voting visualization (LEFT COLUMN - under location)
  let votingResultHTML = "";
  if (jurisdictionVotes.isBoundaryZone) {
    const voteEntries = Object.entries(jurisdictionVotes.votes || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const voteBars = voteEntries.map(([brgy, count]) => {
      const pct = Math.round((count / jurisdictionVotes.totalVotes) * 100);
      return `
                <div class="vote-row">
                    <div class="vote-info">
                        <span class="vote-name">${brgy}</span>
                        <span class="vote-pct">${pct}%</span>
                    </div>
                    <div class="vote-bar">
                        <div class="vote-bar-fill" style="width: ${pct}%; background: ${color};"></div>
                    </div>
                </div>
            `;
    }).join("");

    votingResultHTML = `
            <div class="boundary-zone-box">
                <div class="boundary-header">
                    <i class="fas fa-vote-yea"></i> BOUNDARY ZONE
                </div>
                <div class="boundary-desc">Cluster spans multiple barangays:</div>
                <div class="boundary-votes">${voteBars}</div>
            </div>
        `;
  }

  // Get dominant category name
  const dominantCategory = sortedCategories.length > 0 ? sortedCategories[0][0] : "Mixed Reports";

  // v3.8: Generate correlated clusters HTML if clusters data available
  const correlatedClustersHTML = allClusters ?
    generateCorrelatedClustersHTML(idx, allClusters, color) : "";

  // ================================================================
  // FINAL HTML OUTPUT - 2-COLUMN GRID LAYOUT
  // ================================================================
  return `
        <div class="cluster-popup-v2">
            <!-- ===== HEADER (Full Width) ===== -->
            <div class="cluster-header-v2 ${headerClass}" style="background: ${headerColor};">
                <div class="header-left">
                    <span class="header-emoji">${rationale.emoji}</span>
                    <div class="header-text">
                        <span class="header-title">CLUSTER #${idx + 1}</span>
                        <span class="header-category">${dominantCategory}</span>
                    </div>
                </div>
                <div class="header-right">
                    <span class="reports-badge">${cluster.length} Reports</span>
                </div>
            </div>
            
            <!-- ===== 2-COLUMN GRID CONTAINER ===== -->
            <div class="cluster-grid">
                
                <!-- ===== LEFT COLUMN (Col-span-7) - THE DATA ===== -->
                <div class="cluster-col-left">
                    <div class="column-header">
                        <i class="fas fa-database"></i> THE DATA
                    </div>
                    
                    <!-- Location Header -->
                    <div class="location-section">
                        <div class="location-icon" style="color: ${color};">
                            <i class="fas fa-map-marker-alt"></i>
                        </div>
                        <div class="location-text">
                            <span class="location-label">VICINITY OF</span>
                            <span class="location-name">${jurisdictionVotes.label || "Unknown Location"}</span>
                        </div>
                    </div>
                    
                    <!-- Street-Level Location (v3.7 - Nominatim) -->
                    <div class="street-location-section" 
                         data-cluster-center="${center.lat.toFixed(6)},${center.lng.toFixed(6)}"
                         data-cluster-category="${dominantCategory}">
                        <div class="street-location-row">
                            <i class="fas fa-road"></i>
                            <span class="street-location-value" id="street-location-${idx}">
                                <i class="fas fa-spinner fa-spin"></i> Loading street...
                            </span>
                        </div>
                    </div>
                    
                    ${votingResultHTML}
                    
                    <!-- Report Breakdown Table -->
                    <div class="breakdown-section">
                        <div class="section-label">
                            <i class="fas fa-list-ul"></i> REPORT BREAKDOWN
                        </div>
                        <div class="category-list">
                            ${categoryBreakdownHTML}
                        </div>
                    </div>
                </div>
                
                <!-- ===== RIGHT COLUMN (Col-span-5) - THE INTELLIGENCE ===== -->
                <div class="cluster-col-right">
                    <div class="column-header">
                        <i class="fas fa-brain"></i> THE INTELLIGENCE
                    </div>
                    
                    <!-- AI Reasoning Box -->
                    <div class="ai-reasoning-box">
                        <div class="ai-header">
                            <i class="fas fa-robot"></i> SYSTEM REASONING
                        </div>
                        <div class="ai-explanation">
                            ${rationale.explanation}
                        </div>
                    </div>
                    
                    <!-- v3.7.3: Compact Metrics Row (Span + Type side by side) -->
                    <div class="cluster-metrics-row">
                        <div class="cluster-span-box">
                            <div class="span-header">
                                <i class="fas fa-ruler-combined"></i> PHYSICAL SPAN
                            </div>
                            <div class="span-value">~${rationale.span || 0}m</div>
                            <div class="span-context">${rationale.sizeDescription || "calculating..."}</div>
                        </div>
                        <div class="cluster-type-box" style="border-color: ${color};">
                            <div class="type-label">CLUSTER TYPE</div>
                            <div class="type-value" style="color: ${color};">${rationale.title}</div>
                        </div>
                    </div>
                    
                    <!-- v3.8: Correlated Neighboring Clusters -->
                    ${correlatedClustersHTML}
                    
                    <!-- Decision Support (Compact) -->
                    <div class="decision-support-box compact">
                        <i class="fas fa-info-circle"></i>
                        <span>System suggestion. Audit source reports before dispatching.</span>
                    </div>
                </div>
                
            </div>
        </div>
    `;
}

/**
 * Generate HTML for correlated neighboring clusters section.
 * Shows clusters that may be related and should potentially be merged.
 *
 * @param {number} clusterIdx - Current cluster index
 * @param {Array} allClusters - All clusters from the current analysis
 * @param {string} color - Current cluster color
 * @returns {string} HTML for the correlated clusters section
 */
function generateCorrelatedClustersHTML(clusterIdx, allClusters, color) {
  // Check if correlation analysis is available
  if (!window.getClusterCorrelationInfo || !allClusters || clusterIdx >= allClusters.length) {
    return "";
  }

  const targetCluster = allClusters[clusterIdx];
  const correlationInfo = window.getClusterCorrelationInfo(targetCluster, clusterIdx, allClusters);

  if (!correlationInfo.hasCorrelatedNeighbors) {
    return "";
  }

  // Build neighbor items HTML
  const neighborItemsHTML = correlationInfo.neighbors.slice(0, 3).map(neighbor => {
    const correlationPct = Math.round(neighbor.correlationScore * 100);
    const distanceLabel = neighbor.distance < 100 ? `${neighbor.distance}m` : `${(neighbor.distance / 1000).toFixed(1)}km`;

    // Determine correlation strength class
    let strengthClass = "weak";
    if (correlationPct >= 70) strengthClass = "strong";
    else if (correlationPct >= 50) strengthClass = "moderate";

    return `
            <div class="correlated-neighbor-item ${strengthClass}">
                <div class="neighbor-header">
                    <span class="neighbor-category">${neighbor.category}</span>
                    <span class="neighbor-reports">${neighbor.reportCount} reports</span>
                </div>
                <div class="neighbor-meta">
                    <span class="neighbor-distance"><i class="fas fa-ruler"></i> ${distanceLabel}</span>
                    <span class="neighbor-correlation">${correlationPct}% correlated</span>
                </div>
            </div>
        `;
  }).join("");

  // Build suggestion badge
  let suggestionBadge = "";
  let suggestionText = "";

  if (correlationInfo.suggestionLevel === "MERGE_RECOMMENDED") {
    suggestionBadge = '<span class="suggestion-badge merge">MERGE RECOMMENDED</span>';
    suggestionText = `Combined would cover ~${correlationInfo.combinedSpan}m with ${correlationInfo.combinedReportCount} total reports.`;
  } else if (correlationInfo.suggestionLevel === "REVIEW_SUGGESTED") {
    suggestionBadge = '<span class="suggestion-badge review">REVIEW CONNECTIONS</span>';
    suggestionText = "Related incidents nearby may require coordinated response.";
  }

  return `
        <div class="correlated-clusters-box">
            <div class="correlated-header">
                <i class="fas fa-project-diagram"></i> 
                RELATED CLUSTERS NEARBY (${correlationInfo.neighborCount})
                ${suggestionBadge}
            </div>
            <div class="correlated-neighbors">
                ${neighborItemsHTML}
            </div>
            <div class="correlated-insight">
                <i class="fas fa-lightbulb"></i>
                ${suggestionText || "These clusters share patterns and may be part of a larger incident."}
            </div>
        </div>
    `;
}

// Export for global access
window.generateCorrelatedClustersHTML = generateCorrelatedClustersHTML;

// ==================== v4.1 CONVEX HULL COMPUTATION ====================

/**
 * Compute the convex hull of a set of points using Graham Scan algorithm.
 * Used to draw "Area of Effect" polygons around DBSCAN clusters.
 *
 * @param {Array} points - Array of [lat, lng] pairs
 * @returns {Array} Array of [lat, lng] pairs forming the convex hull (clockwise)
 */
function computeConvexHull(points) {
  if (!points || points.length < 3) return points;

  // Find the point with lowest y-coordinate (and leftmost if tie)
  let pivot = points[0];
  let pivotIdx = 0;

  for (let i = 1; i < points.length; i++) {
    if (points[i][0] < pivot[0] ||
            (points[i][0] === pivot[0] && points[i][1] < pivot[1])) {
      pivot = points[i];
      pivotIdx = i;
    }
  }

  // Swap pivot to first position
  [points[0], points[pivotIdx]] = [points[pivotIdx], points[0]];
  pivot = points[0];

  // Sort points by polar angle with respect to pivot
  const sorted = points.slice(1).sort((a, b) => {
    const angleA = Math.atan2(a[0] - pivot[0], a[1] - pivot[1]);
    const angleB = Math.atan2(b[0] - pivot[0], b[1] - pivot[1]);

    if (angleA !== angleB) return angleA - angleB;

    // If same angle, keep the farther point
    const distA = Math.pow(a[0] - pivot[0], 2) + Math.pow(a[1] - pivot[1], 2);
    const distB = Math.pow(b[0] - pivot[0], 2) + Math.pow(b[1] - pivot[1], 2);
    return distA - distB;
  });

  // Build hull using stack
  const hull = [pivot];

  for (const point of sorted) {
    // Remove points that make clockwise turn
    while (hull.length >= 2 &&
            crossProduct(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
      hull.pop();
    }
    hull.push(point);
  }

  return hull;
}

/**
 * Calculate cross product of vectors OA and OB
 * Positive = counterclockwise, Negative = clockwise, Zero = collinear
 */
function crossProduct(O, A, B) {
  return (A[1] - O[1]) * (B[0] - O[0]) - (A[0] - O[0]) * (B[1] - O[1]);
}

// Export for global access
window.computeConvexHull = computeConvexHull;

// ==================== v4.1 ANOMALY RE-DETECTION ====================

/**
 * v4.1: Re-run spatial anomaly detection on all points during visualization.
 * This ensures anomaly flags persist across data reloads and filter changes.
 *
 * Categories that require road proximity:
 * - Pothole, Road Damage, Traffic, Road Obstruction, Streetlight
 *
 * A point is flagged as anomaly if:
 * - It's a road-related category AND
 * - The RoadValidator determined no physical road exists at that location
 *
 * @param {Array} points - Array of complaint points to check
 * @returns {Promise<void>} Resolves when all checks complete
 */
async function rerunAnomalyDetection(points) {
  if (!points || points.length === 0) return;

  const ROAD_RELATED_CATEGORIES = [
    "Pothole", "Road Damage", "Traffic", "Road Obstruction",
    "Traffic Jam", "Streetlight", "Broken Streetlight", "Infrastructure"
  ];

  console.log("[ANOMALY] 🔍 Re-running spatial anomaly detection on", points.length, "points...");

  let anomalyCount = 0;

  for (const point of points) {
    const category = point.subcategory || point.category;

    // Reset flags first
    // Note: We preserve existing validation results if present

    // Check if this is a road-related category
    if (ROAD_RELATED_CATEGORIES.includes(category)) {
      // Check if we already have validation data
      if (point.road_validation) {
        // Re-apply anomaly flag based on stored validation
        if (!point.road_validation.isValid && !point.road_validation.fallback) {
          point.road_proximity_anomaly = true;
          point.spatial_warning = "Road Proximity Warning: No physical road detected.";
          anomalyCount++;
        } else {
          point.road_proximity_anomaly = false;
          point.spatial_warning = null;
        }
      } else if (window.RoadValidator) {
        // No cached validation - run async check
        // This is fire-and-forget since we can't await in visualization loop
        window.RoadValidator.validate(point).then(res => {
          point.road_validation = res;
          if (!res.isValid && !res.fallback) {
            point.road_proximity_anomaly = true;
            point.spatial_warning = "Road Proximity Warning: No physical road detected.";
          }
        }).catch(() => {
          // Silently fail - don't block visualization
        });
      }
    } else {
      // Non-road category - clear any road anomaly flags but preserve other spatial warnings
      point.road_proximity_anomaly = false;
    }
  }

  console.log(`[ANOMALY] ✅ Detection complete: ${anomalyCount} anomalies identified from cached data`);
}

// Export for global access
window.rerunAnomalyDetection = rerunAnomalyDetection;

function visualizeClusters(clusters) {
  // Clear existing cluster markers
  simulationEngine.clearSpotlightLayer();

  // v4.1: Re-run anomaly detection on all cluster points
  const allClusterPoints = clusters.flat();
  rerunAnomalyDetection(allClusterPoints);

  // v4.1: Clear existing convex hull layers
  if (simulationEngine.convexHullLayers) {
    simulationEngine.convexHullLayers.forEach(layer => {
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
  }
  simulationEngine.convexHullLayers = [];

  const colors = [
    "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
    "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1"
  ];
  const largeClusterMode = clusters.length > 150;

  clusters.forEach((cluster, idx) => {
    const color = colors[idx % colors.length];
    const center = getClusterCenterFromPoints(cluster);

    // Analyze cluster for Glass Box explanation
    const rationale = analyzeClusterRationale(cluster);

    // Calculate dominant category for merged warning detection
    const categoryCount = {};
    cluster.forEach(p => {
      const cat = p.subcategory || p.category;
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });
    const dominantCategory = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])[0][0];

    // ================================================================
    // CRITICAL FIX: Render individual points with THEIR OWN DATA
    // Each marker must show the POINT's data, NOT the cluster's data
    // ================================================================
    if (!largeClusterMode) {
      cluster.forEach(point => {
        // 1. Create marker at POINT's coordinates (NOT cluster center)
        const marker = simulationEngine.createSpotlightMarker(point, color, 0.8);

        // 2. Open intelligence panel on click — content generated lazily
        const capturedIdx = idx + 1;
        marker.on("click", () => {
          if (window.mapIntelligencePanel) {
            window.mapIntelligencePanel.show(point, capturedIdx, color, dominantCategory);
          }
        });
      });
    }

    // Draw distance-limited connecting lines (MST-style)
    // Only connect points < 50m apart to avoid "spaghetti" visuals
    if (!largeClusterMode && cluster.length > 1) {
      const MAX_LINE_DISTANCE = 50; // meters
      const drawnConnections = new Set(); // Prevent duplicate lines

      // For each point, find its nearest neighbor within threshold
      for (let i = 0; i < cluster.length; i++) {
        const from = cluster[i];
        let nearestDist = Infinity;
        let nearestIdx = -1;

        // Find nearest neighbor
        for (let j = 0; j < cluster.length; j++) {
          if (i === j) continue;
          const to = cluster[j];
          const dist = haversineDistance(
            from.latitude, from.longitude,
            to.latitude, to.longitude
          );
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestIdx = j;
          }
        }

        // Only draw if within threshold and not already drawn
        if (nearestIdx !== -1 && nearestDist <= MAX_LINE_DISTANCE) {
          const connectionKey = [Math.min(i, nearestIdx), Math.max(i, nearestIdx)].join("-");
          if (!drawnConnections.has(connectionKey)) {
            drawnConnections.add(connectionKey);
            const to = cluster[nearestIdx];
            const line = L.polyline(
              [[from.latitude, from.longitude], [to.latitude, to.longitude]],
              {
                color,
                weight: 1,        // Subtle
                opacity: 0.3,     // Low opacity
                dashArray: "5, 5" // Dashed
              }
            ).addTo(map);
            simulationEngine.connectionLines.push(line);
          }
        }
      }
    }

    // v4.1: CONVEX HULL POLYGON - Wraps cluster points to show "Area of Effect"
    if (!largeClusterMode && cluster.length >= 3) {
      // Get all points as [lat, lng] pairs
      const points = cluster.map(p => [p.latitude, p.longitude]);

      // Compute convex hull
      const hullPoints = computeConvexHull(points);

      if (hullPoints && hullPoints.length >= 3) {
        const hullPolygon = L.polygon(hullPoints, {
          color,
          weight: 2,
          opacity: 0.7,
          fillColor: color,
          fillOpacity: 0.12,
          dashArray: "4, 4",
          className: "cluster-convex-hull"
        }).addTo(map);

        // Store for cleanup
        if (!simulationEngine.convexHullLayers) {
          simulationEngine.convexHullLayers = [];
        }
        simulationEngine.convexHullLayers.push(hullPolygon);
      }
    }

    // FEATURE 2: Glass Box cluster label with detailed explanation popup
    const size = cluster.length;
    const glassBoxPopup = createGlassBoxPopup(cluster, idx, color, rationale, clusters);

    // Dynamic label based on cluster type
    const labelEmoji = rationale.emoji;
    const labelText = rationale.type === "multi-issue" ? "MULTI" : "HOTSPOT";

    const marker = L.marker([center.lat, center.lng], {
      icon: L.divIcon({
        className: "cluster-label",
        html: `
                    <div style="
                        background: ${color};
                        color: white;
                        padding: 8px 12px;
                        border-radius: 8px;
                        font-size: 11px;
                        font-weight: 600;
                        white-space: nowrap;
                        cursor: pointer;
                        text-align: center;
                    ">
                        <div>${labelEmoji} ${labelText}</div>
                        <div style="font-size: 10px; opacity: 0.9;">${size} reports</div>
                    </div>
                `,
        iconSize: [80, 45],
        iconAnchor: [40, 22]
      })
    })
      .bindPopup(glassBoxPopup, {
        maxWidth: 380,
        className: "glass-box-popup-container"
      });

    if (clustersVisible) {
      marker.addTo(map);
    }

    // v3.7: Load street-level location when popup opens
    marker.on("popupopen", async () => {
      // Collapse command center sidebar when complaint is clicked
      collapseCommandCenter();

      const streetLocationElement = document.getElementById(`street-location-${idx}`);
      if (streetLocationElement && streetLocationElement.textContent.includes("Loading")) {
        try {
          const address = await reverseGeocode(center.lat, center.lng);
          if (address && address.street) {
            streetLocationElement.innerHTML = `
                            <strong>${address.street}</strong>
                            ${address.suburb ? `<span class="street-suburb">(${address.suburb})</span>` : ""}
                        `;
          } else if (address && address.suburb) {
            streetLocationElement.innerHTML = `<span class="street-suburb">${address.suburb}</span> <span class="no-street">(no street name)</span>`;
          } else {
            streetLocationElement.innerHTML = '<span class="no-street">Street name unavailable</span>';
          }
        } catch (error) {
          console.error("[GEOCODE] Popup load error:", error);
          streetLocationElement.innerHTML = '<span class="no-street">Geocoding failed</span>';
        }
      }
    });

    simulationEngine.spotlightMarkers.push(marker);
  });

  console.log("[GLASS-BOX] Cluster visualization complete with transparency features");
}

// ==================== NOISE POINT VISUALIZATION ====================
// Feature 1: Make isolated/unclustered points clickable and transparent

/**
 * Create popup for NOISE (unclustered) points.
 * Shows that this is an isolated report not part of any incident cluster.
 * Uses the unified generatecomplaintPopupHTML for consistency.
 *
 * @param {Object} complaint - The noise point complaint object
 * @param {Object} mismatchResult - Result from validateCategoryMismatch() (not used, kept for compatibility)
 * @returns {string} HTML popup content
 */
function createNoisePointPopup(complaint, mismatchResult) {
  // Use the unified popup generator with gray color for noise points
  return generatecomplaintPopupHTML(complaint, null, "#9ca3af", null);
}

/**
 * Visualize NOISE points (unclustered complaints) on the map.
 * Makes them clickable with detailed popups for transparency.
 *
 * @param {Array} noisePoints - Array of noise complaint objects from DBSCAN
 */
function visualizeNoisePoints(noisePoints) {
  if (!noisePoints || noisePoints.length === 0) {
    console.log("[NOISE] No noise points to visualize");
    return;
  }

  if (noisePoints.length > 3000) {
    console.log(`[PERFORMANCE] Bypassing ${noisePoints.length} individual noise markers to prevent DOM locking. Heatmap will visualize density.`);
    return;
  }

  // v4.1: Re-run anomaly detection on noise points too
  rerunAnomalyDetection(noisePoints);

  const noiseColor = "#9ca3af"; // Gray color for noise points

  noisePoints.forEach(point => {
    // Validate coordinates
    if (typeof point.latitude !== "number" || typeof point.longitude !== "number") {
      return;
    }

    // Run NLP Category Mismatch validation (Feature 2)
    const mismatchResult = window.validateCategoryMismatch ?
      window.validateCategoryMismatch(point) : null;

    // Create smaller, semi-transparent marker for noise points
    const iconName = "circle"; // Simple circle for noise
    const size = 24; // Smaller than cluster points

    const html = `
            <div class="noise-marker-inner" style="
                width: ${size}px;
                height: ${size}px;
                background: ${noiseColor};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 2px solid rgba(255,255,255,0.6);
                opacity: 0.7;
                cursor: pointer;
                transition: opacity 0.2s, transform 0.2s;
            ">
                <i class="fas fa-${iconName}" style="
                    color: white;
                    font-size: ${Math.round(size * 0.4)}px;
                "></i>
            </div>
        `;

    const icon = L.divIcon({
      className: "noise-marker",
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });

    const marker = L.marker([point.latitude, point.longitude], {
      icon,
      zIndexOffset: 500, // Below cluster markers but above base layer
      className: `noise-marker-container${  point.spatial_warning || point.road_proximity_anomaly ? " spatial-anomaly-marker" : ""}`
    });

    // Open intelligence panel on click — lazy, cached
    marker.on("click", () => {
      if (window.mapIntelligencePanel) {
        window.mapIntelligencePanel.show(point, null, noiseColor, null);
      }
    });

    // Add hover effect
    marker.on("mouseover", function () {
      this._icon.querySelector(".noise-marker-inner").style.opacity = "1";
      this._icon.querySelector(".noise-marker-inner").style.transform = "scale(1.2)";
    });

    marker.on("mouseout", function () {
      this._icon.querySelector(".noise-marker-inner").style.opacity = "0.7";
      this._icon.querySelector(".noise-marker-inner").style.transform = "scale(1)";
    });

    // Only add to map if clusters are visible or requested
    if (clustersVisible) {
      marker.addTo(map);
    }
    simulationEngine.spotlightMarkers.push(marker);
  });

  console.log(`[NOISE] Visualized ${noisePoints.length} isolated points with clickable popups`);
}

// ==================== MAIN LOAD FUNCTION ====================

let isSimulationLoading = false;

async function loadFullSimulation() {
  if (isSimulationLoading) {
    console.warn("[PRODUCTION] Analysis engine busy. Task queued or skipped.");
    // Auto-recovery: if it's been loading for more than 30s, force reset
    if (!window._lastSimulationLoadTime || (Date.now() - window._lastSimulationLoadTime > 30000)) {
      console.warn("[PRODUCTION] Emergency analysis engine reset triggered.");
      isSimulationLoading = false;
    } else {
      return;
    }
  }

  window._lastSimulationLoadTime = Date.now();

  const loadingOverlay = document.getElementById("loadingOverlay");
  const statusIndicator = document.getElementById("statusIndicator");
  const loadButton = document.getElementById("loadCityData");

  // Always clear UI at start to prevent stale data display during analysis
  clearDashboardUI();
  window.mapIntelligencePanel?.invalidateCache();
  clearLiveMarkers();

  try {
    isSimulationLoading = true;
    if (loadingOverlay) loadingOverlay.classList.add("active");
    if (statusIndicator) {
      statusIndicator.classList.add("processing");
      const statusSpan = statusIndicator.querySelector("span");
      if (statusSpan) statusSpan.textContent = "Analyzing...";
    }
    if (loadButton) loadButton.disabled = true;

    console.log("[PRODUCTION] Starting full city analysis...");

    const allData = (simulationEngine && simulationEngine.complaints) ? simulationEngine.complaints : [];
    console.log("[DEBUG] allData count:", allData.length);

    if (!allData || allData.length === 0) {
      console.warn("[PRODUCTION] Analysis aborted: Zero records in simulationEngine.complaints");
      // Ensure UI reflects the empty state even if we return early
      updateStatsDisplay({
        stats: { totalcomplaints: 0, totalClusters: 0, criticalHotspots: 0, efficiencyScore: 0, activeIncidents: 0, historyLogs: 0, advisories: 0 }
      });
      renderInsightsCards({ cards: [] });
      renderCategoryDistribution([]);
      return;
    }

    // 1. Filtering Logic
    let filteredData = allData;

    // A. Category Filter
    if (Array.isArray(currentFilterCategory) && !currentFilterCategory.includes("all")) {
      filteredData = filteredData.filter(
        p =>
          currentFilterCategory.includes(p.category) ||
          (p.subcategory && currentFilterCategory.includes(p.subcategory))
      );
    } else if (typeof currentFilterCategory === "string" && currentFilterCategory !== "all") {
      filteredData = filteredData.filter(
        p => p.category === currentFilterCategory || p.subcategory === currentFilterCategory
      );
    }

    // A2. Subcategory Filter
    if (Array.isArray(currentFilterSubcategory) && !currentFilterSubcategory.includes("all")) {
      filteredData = filteredData.filter(p => currentFilterSubcategory.includes(p.subcategory));
    } else if (
      typeof currentFilterSubcategory === "string" &&
      currentFilterSubcategory !== "all"
    ) {
      filteredData = filteredData.filter(p => p.subcategory === currentFilterSubcategory);
    }

    // B. Office/Department Filter
    if (Array.isArray(currentFilterOffice) && !currentFilterOffice.includes("all")) {
      filteredData = filteredData.filter(p => {
        const dept = p.department || "";
        const depts = Array.isArray(p.departments) ? p.departments : [];
        return currentFilterOffice.includes(dept) || depts.some(d => currentFilterOffice.includes(d));
      });
    }

    // C. Date Range Filter (Numerical Robustness)
    if (currentFilterStartDate || currentFilterEndDate) {
      const filterStartTs = currentFilterStartDate ? new Date(`${currentFilterStartDate  }T00:00:00`).getTime() : 0;
      const filterEndTs = currentFilterEndDate ? new Date(`${currentFilterEndDate  }T23:59:59`).getTime() : Infinity;

      filteredData = filteredData.filter(p => {
        const rawDate = p.timestamp || p.submittedAt || p.submitted_at || p.created_at || p.createdAt;
        if (!rawDate) return false;
        const recordTs = new Date(rawDate).getTime();
        return recordTs >= filterStartTs && recordTs <= filterEndTs;
      });
      console.log(`[FILTER] Date range applied. Remaining records: ${filteredData.length}`);
    }

    // 2. Synchronize Layers
    // Show background points for the filtered set
    simulationEngine.filterBackgroundMarkersByCategory(currentFilterCategory, {
      startDate: currentFilterStartDate,
      endDate: currentFilterEndDate,
      subcategory: currentFilterSubcategory,
    });

    const loadingProgressEl = document.getElementById("loadingProgress");
    if (loadingProgressEl) loadingProgressEl.textContent = `Analyzing ${filteredData.length} complaints...`;

    // 3. Extraction & Triage
    const { criticalPoints, standardPoints } = window.extractCriticalPoints
      ? window.extractCriticalPoints(filteredData)
      : { criticalPoints: [], standardPoints: filteredData };

    renderEmergencyPanel(criticalPoints);
    renderCriticalMarkers(criticalPoints);

    // 4. Clustering
    // Use grid-based fallback clustering for large datasets to keep AI-cluster mode visible.
    let clusteringResult = { clusters: [], noise: [] };

    if (standardPoints.length > 3000) {
      console.log(`[PERFORMANCE] Using approximate clustering fallback for ${standardPoints.length} points to prevent UI freeze.`);
      clusteringResult = buildApproximateClusters(standardPoints, 0.006, 3);
    } else {
      clusteringResult = clustercomplaints(standardPoints, {
        MIN_PTS: 1,
        USE_ADAPTIVE_MINPTS: false,
        ENABLE_LOGGING: true
      });
    }

    currentClusters = clusteringResult.clusters;
    currentNoisePoints = clusteringResult.noise;

    // 5. Analytics & UI
    const insights = generateSmartInsights(currentClusters, currentNoisePoints, filteredData);
    insights.stats.activeEmergencies = criticalPoints.length;

    updateStatsDisplay(insights);
    renderInsightsCards(insights);
    renderCategoryDistribution(filteredData);

    // Visualization
    visualizeClusters(currentClusters);
    visualizeNoisePoints(currentNoisePoints);
    createHeatmap(filteredData);

    // Keep the selected marker mode active after every filter/data refresh.
    setVisualizationMode(currentVisualizationMode || "clusters");

    // Handover to Analytics
    try {
      const transferPackage = {
        timestamp: Date.now(),
        source: "dashboardProduction",
        complaints: simulationEngine.complaints,
        stats: insights.stats,
        generated_at: new Date().toISOString()
      };
      localStorage.setItem("DRIMS_analytics_handover", JSON.stringify(transferPackage));
    } catch (e) { console.warn("Analytics handover failed", e); }

    if (statusIndicator) {
      statusIndicator.classList.remove("processing");
      const statusSpan = statusIndicator.querySelector("span");
      if (statusSpan) statusSpan.textContent = "Analysis Complete";
    }
  } catch (error) {
    console.error("[PRODUCTION] Analysis failed:", error);
    if (statusIndicator) {
      statusIndicator.classList.add("error");
      const statusSpan = statusIndicator.querySelector("span");
      if (statusSpan) statusSpan.textContent = "Analysis Failed";
    }
  } finally {
    isSimulationLoading = false;
    if (loadingOverlay) loadingOverlay.classList.remove("active");
    if (loadButton) loadButton.disabled = false;
  }
}


// Track selected index for keyboard navigation
const selectedIndex = -1;

/**
 * Show a toast notification for search results.
 */
function showSearchToast(message, type = "success") {
  // Remove existing toast
  const existingToast = document.querySelector(".search-toast");
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement("div");
  toast.className = `search-toast ${type}`;
  toast.innerHTML = `
        <i class="fas fa-${type === "success" ? "check-circle" : "exclamation-circle"}"></i>
        <span>${sanitizeHTML(message)}</span>
    `;

  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add("active");
  });

  // Auto-hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove("active");
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

/**
 * Minimal command center collapse logic
 * v4.0: Standardized for tactical HUD
 */
function collapseCommandCenter() {
  const panel = document.getElementById("hud-left");
  if (panel && panel.classList.contains("collapsed") === false) {
    const toggleBtn = document.querySelector(".hud-toggle-btn");
    if (toggleBtn) toggleBtn.click(); // Trigger the existing logic if available
    else panel.classList.add("collapsed");
  }
}

// ==================== EVENT LISTENERS ====================

window.addEventListener("load", async () => {
  console.log("[PRODUCTION] Initializing City Analytics Dashboard...");

  // Sync HUD inputs if present, respecting browser-restored soft-refresh states
  const startInput = document.getElementById("filter-start-date");
  const endInput = document.getElementById("filter-end-date");
  const catInput = document.getElementById("filter-category");

  const today = new Date().toLocaleDateString("en-CA");

  if (startInput && startInput.value) {
    currentFilterStartDate = startInput.value;
  } else {
    currentFilterStartDate = today;
    if (startInput) startInput.value = today;
  }

  if (endInput && endInput.value) {
    currentFilterEndDate = endInput.value;
  } else {
    currentFilterEndDate = today;
    if (endInput) endInput.value = today;
  }

  if (catInput && catInput.options) {
    const selected = Array.from(catInput.options).filter(o => o.selected).map(o => o.value);
    if (selected.length > 0 && !selected.includes("all")) {
      currentFilterCategory = selected.length === 1 ? selected[0] : selected;
    }
  }

  console.log(`[FILTER] Date range restored/initialized: ${currentFilterStartDate} to ${currentFilterEndDate}`);

  // Load category colors for heatmap
  await loadCategoryColors();

  // Initialize map
  initMap();
  window.map = map; // Expose globally for heatmap.html
  console.log("[MAP] Initialized");

  // Load barangay boundaries for offline zone detection (Turf.js)
  await loadBarangayBoundaries();

  if (typeof loadNLPDictionaries === "function") {
    await loadNLPDictionaries();
  }

  // Initialize simulation engine
  simulationEngine = new SimulationEngine(map, () => { }, () => { }, () => { });
  window.simulationEngine = simulationEngine; // Expose globally for heatmap.html
  console.log("[ENGINE] Created");

  // Initialize Layer Toggles after engine is ready
  if (typeof initializeExclusiveToggles === "function") {
    initializeExclusiveToggles();
  }

  // Load mock data
  const success = await simulationEngine.initialize();

  if (success) {
    console.log("[DATA] Loaded successfully:", simulationEngine.complaints.length, "records");

    // Enable Excel export button
    const exportBtn = document.getElementById("exportExcelBtn");
    if (exportBtn) {
      exportBtn.disabled = false;
      console.log("[EXPORT] Excel export button enabled");
    }

    // Dispatch dataLoaded event for other modules
    window.dispatchEvent(new CustomEvent("dataLoaded", {
      detail: { count: simulationEngine.complaints.length }
    }));
  } else {
    console.error("[DATA] Failed to load");
    return;
  }

  initRealtimeStream();

  // Initialize Emergency Panel (Critical Triage System)
  initEmergencyPanel();
  console.log("[TRIAGE] Emergency panel initialized");

  const loadCityDataBtn = document.getElementById("loadCityData");
  if (loadCityDataBtn) {
    loadCityDataBtn.addEventListener("click", loadFullSimulation);
  }

  // ==================== v4.1: MAP LAYERS DROPDOWN ====================
  initMapLayersDropdown();

  const categoryFilterEl = document.getElementById("categoryFilter");
  if (categoryFilterEl) {
    categoryFilterEl.addEventListener("change", (e) => {
      currentFilterCategory = e.target.value;
      console.log("[FILTER] Category:", currentFilterCategory);

      if (simulationEngine && simulationEngine.complaints && simulationEngine.complaints.length > 0) {
        loadFullSimulation();
      }
    });
  }

  // Refresh Insights button with debounce
  let refreshTimeout = null;
  document.getElementById("refreshInsights").addEventListener("click", () => {
    if (refreshTimeout) clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(() => {
      if (currentClusters.length > 0) {
        const insights = generateSmartInsights(
          currentClusters,
          currentNoisePoints,
          simulationEngine.complaints
        );
        updateStatsDisplay(insights);
        renderInsightsCards(insights);
      }
    }, 100);
  });

  // v4.7: Tactical Authenticate & Dispatch → Complaint Details Navigation
  document.getElementById("insightsContent").addEventListener("click", (e) => {
    const btn = e.target.closest(".dispatch-btn");
    if (btn) {
      e.stopPropagation(); // Prevent card click from also firing
      const card = btn.closest(".insight-card");
      if (!card) return;

      const cardIndex = parseInt(card.dataset.cardIndex);
      const complaintIdsStr = card.dataset.complaintIds || "";
      const complaintIds = complaintIdsStr ? complaintIdsStr.split(",").filter(Boolean) : [];
      const zone = card.querySelector(".tactical-value")?.textContent || "Unknown Sector";
      const title = card.querySelector(".insight-main-title")?.textContent || "Cluster";

      console.log(`[DISPATCH] Opening complaint list for zone: ${zone}, ${complaintIds.length} complaints`);

      if (complaintIds.length === 0) {
        if (typeof window.showToast === "function") {
          window.showToast("No complaint IDs available for this cluster", "warning");
        } else {
          alert("No complaint IDs available for this cluster.");
        }
        return;
      }

      // Single complaint → navigate directly
      if (complaintIds.length === 1) {
        window.open(`/complaint-details/${complaintIds[0]}`, "_blank");
        return;
      }

      // Multiple complaints → show list modal
      showDispatchModal(zone, title, complaintIds, cardIndex);
    }
  });

  if (typeof loadNLPDictionaries === "function") {
    setInterval(() => {
      loadNLPDictionaries(true).catch(() => { });
    }, 60000);
  }

  // ==================== TACTICAL CLOCK (v4.6) ====================
  function updateTacticalClock() {
    const clockEl = document.getElementById("dashboard-clock");
    if (!clockEl) return;

    const now = new Date();
    const timeString = now.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    clockEl.textContent = `SYSTEM_TIME: [${timeString}]`;
  }

  updateTacticalClock();
  setInterval(updateTacticalClock, 1000);

  // v3.9.5: Initial Data Load with tactical delay to ensure engine stability
  setTimeout(() => {
    console.log("[PRODUCTION] Loading initial tactical stream...");
    loadFullSimulation().catch(e => console.error("[INIT] Load failed:", e));
  }, 500);

  console.log("[PRODUCTION] Dashboard v3.4.1 ready! (UI Optimized)");
});

// ==================== GLOBAL FILTER BRIDGE ====================
// Bridge function to allow external modules (like heatmap.html) to trigger filters
window.applyGlobalFilters = async function (filters) {
  console.log("[FILTER] Applying global filters:", filters);

  if (filters.start_date !== undefined) currentFilterStartDate = filters.start_date;
  if (filters.end_date !== undefined) currentFilterEndDate = filters.end_date;
  if (filters.office !== undefined) currentFilterOffice = filters.office;
  if (filters.category !== undefined) currentFilterCategory = filters.category;
  if (filters.subcategory !== undefined) currentFilterSubcategory = filters.subcategory;

  // v3.9.5: Clear local state and UI immediately to show the user we are working
  if (window.simulationEngine) {
    console.log("[FILTER] Resetting engine for fresh sync...");
    window.simulationEngine.complaints = [];

    // Clear markers via the engine helper
    if (typeof window.simulationEngine.clearAllBackgroundMarkers === "function") {
      window.simulationEngine.clearAllBackgroundMarkers();
    }
  }

  // Clear the UI metrics and trends immediately
  clearDashboardUI();

  // v4.5.7: Re-fetch data from server with new filters
  const API_ENDPOINT = `/api/brain/complaints`;
  console.log("[FILTER] Re-fetching data from server...");

  await fetchServercomplaints(API_ENDPOINT, { silent: true });

  console.log("[FILTER] Sync complete. Triggering analysis...");

  // Force an atomic UI update
  if (autoReloadTimer) clearTimeout(autoReloadTimer);
  await loadFullSimulation();
};

// Sidebars handled by heatmap.html inline script or other page-specific scripts to avoid conflicts.
