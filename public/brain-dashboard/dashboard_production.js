/**
 * CitizenLink Production Dashboard Controller
 * ============================================
 * Production-grade city analytics system with dynamic insights generation.
 * 
 * @version 3.9.0 (Production - Security Hardened)
 * @author CitizenLink Development Team
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
 * - Complaint popups include barangay + street address
 * - Intelligent caching to respect Nominatim rate limits (1 req/sec)
 * - Async loading with spinner animation
 */

// ==================== GLOBAL STATE ====================

let map;
let simulationEngine;
let heatmapLayer = null;
let currentClusters = [];
let currentNoisePoints = [];
let currentFilterCategory = 'all';
let clustersVisible = true; // Track cluster visibility state
let causalAnalysisEnabled = false; // Phase 2: Only show causal chains after user triggers analysis

// Performance: Use requestAnimationFrame for smooth animations
let rafId = null;

// Barangay boundary data for offline zone detection
let barangayGeoJSON = null;

// Search feature state
let searchHighlightMarker = null;

// ==================== v3.9 AUDIT FIX: XSS SANITIZATION ====================

/**
 * Sanitize user input to prevent XSS attacks.
 * Encodes HTML entities and removes dangerous patterns.
 * 
 * @param {string} input - Raw user input
 * @returns {string} Sanitized safe string
 */
function sanitizeHTML(input) {
    if (input == null) return '';
    if (typeof input !== 'string') return String(input);

    // HTML entity encoding
    const entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
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
function sanitizeComplaintObject(obj, fields = ['description', 'address', 'name', 'user_id']) {
    if (!obj || typeof obj !== 'object') return obj;

    for (const field of fields) {
        if (obj[field] && typeof obj[field] === 'string') {
            obj[field] = sanitizeHTML(obj[field]);
        }
    }

    return obj;
}

// Export sanitization functions globally
window.sanitizeHTML = sanitizeHTML;
window.sanitizeComplaintObject = sanitizeComplaintObject;

// ==================== LIVE SYNC (DEFENSE DEMO) ====================

/**
 * Initialize Live Sync module for real-time complaint reception.
 * Used during thesis defense demonstration.
 * Panelists submit complaints via mobile interface → appears here in real-time.
 */
let liveSyncInitialized = false;
let liveComplaintMarkers = [];

// v4.2: Live marker registry to prevent duplicate markers
// Maps complaint ID -> marker instance for O(1) duplicate checking
let liveMarkerRegistry = new Map();

function initLiveSync() {
    if (typeof window.LiveSync === 'undefined') {
        console.log('[LIVE-SYNC] Module not loaded, using server-based sync');
    }

    if (liveSyncInitialized) {
        console.log('[LIVE-SYNC] Already initialized');
        return;
    }

    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║           🔴 LIVE SYNC INITIALIZATION                  ║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log('║ Using: Server-Side Sync (Node.js + SSE)               ║');
    console.log('║ Server: http://localhost:3000                          ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    // Connect to Server-Sent Events for real-time updates
    initServerSync();

    liveSyncInitialized = true;
    console.log('[LIVE-SYNC] ✅ Initialized - Ready to receive live complaints from panelists');

    // Add live sync indicator to header
    addLiveSyncIndicator();
}

/**
 * Clear all pulsing live markers from the map.
 * v4.0.1: Added to prevent duplicate markers when simulation reloads.
 * v4.2: Now also clears the liveMarkerRegistry
 */
function clearLiveMarkers() {
    if (liveComplaintMarkers.length > 0 || liveMarkerRegistry.size > 0) {
        console.log(`[LIVE-SYNC] Clearing ${liveMarkerRegistry.size} tracked live markers`);
        liveComplaintMarkers.forEach(marker => {
            if (map && map.hasLayer(marker)) {
                map.removeLayer(marker);
            }
        });
        liveComplaintMarkers = [];
        liveMarkerRegistry.clear();
        console.log('[LIVE-SYNC] ✅ Registry cleared - ready for fresh markers');
    }
}

/**
 * Initialize server-side sync with Server-Sent Events
 */
function initServerSync() {
    const SSE_ENDPOINT = `/api/brain/stream`;
    const API_ENDPOINT = `/api/brain/complaints`;

    // Fetch existing complaints on load
    fetchServerComplaints(API_ENDPOINT);

    // Connect to SSE for real-time updates
    try {
        const eventSource = new EventSource(SSE_ENDPOINT);

        eventSource.onopen = () => {
            console.log('[SSE] ✅ Connected to live complaint stream');
        };

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'CONNECTED') {
                    console.log('[SSE] Client ID:', data.clientId);
                } else if (data.type === 'NEW_COMPLAINT') {
                    handleNewServerComplaint(data.complaint);
                }
            } catch (error) {
                console.error('[SSE] Parse error:', error);
            }
        };

        eventSource.onerror = (error) => {
            console.error('[SSE] Connection error, will retry...', error);
            // EventSource auto-reconnects
        };

    } catch (error) {
        console.error('[SSE] Not supported, falling back to polling');
        // Fallback: Poll every 5 seconds
        setInterval(() => fetchServerComplaints(API_ENDPOINT), 5000);
    }
}

/**
 * Fetch complaints from server
 */
async function fetchServerComplaints(apiEndpoint) {
    try {
        const response = await fetch(apiEndpoint);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const result = await response.json();

        if (result.success && result.complaints.length > 0) {
            const newComplaints = result.complaints.filter(serverComplaint => {
                return !simulationEngine.complaints.some(c => c.id === serverComplaint.id);
            });

            if (newComplaints.length > 0) {
                console.log(`[SERVER] Found ${newComplaints.length} new complaints`);
                newComplaints.forEach(c => handleNewServerComplaint(c));
            }
        }
    } catch (error) {
        console.warn('[SERVER] Fetch failed:', error.message);
    }
}

/**
 * Handle new complaint from server
 * v3.9.2: Now auto-triggers loadFullSimulation to update clustering
 */
let autoReloadTimer = null;
const AUTO_RELOAD_DELAY = 2000; // 2 seconds debounce

function handleNewServerComplaint(complaint) {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log(`║  🎉 NEW COMPLAINT RECEIVED (server)`.padEnd(57), '║');
    console.log('╠════════════════════════════════════════════════════════╣');
    console.log('║ ID:', complaint.id.padEnd(44), '║');
    console.log('║ Category:', complaint.category.padEnd(38), '║');
    console.log('║ Description:', complaint.description.substring(0, 35).padEnd(35), '║');
    console.log('╚════════════════════════════════════════════════════════╝');

    // Sanitize the complaint
    sanitizeComplaintObject(complaint);

    // ================================================================
    // v4.0: PROCESS NLP INTELLIGENCE BEFORE ADDING TO ARRAY
    // This ensures live complaints have nlp_result for emergency detection
    // ================================================================
    if (typeof window.analyzeComplaintIntelligence === 'function') {
        const intelligence = window.analyzeComplaintIntelligence(complaint);
        complaint.nlp_result = intelligence;
        console.log('[LIVE-SYNC] ✅ NLP processed:', intelligence.category, 'urgency:', intelligence.urgencyScore);
    } else {
        console.warn('[LIVE-SYNC] ⚠️ analyzeComplaintIntelligence not available - emergency detection may fail');
    }

    // Add to simulation engine's complaint array
    if (simulationEngine && simulationEngine.complaints) {
        // Check for duplicates
        const exists = simulationEngine.complaints.some(c => c.id === complaint.id);
        if (!exists) {
            simulationEngine.complaints.push(complaint);
            console.log('[LIVE-SYNC] ✅ Added to complaints array, total:', simulationEngine.complaints.length);

            // v4.0: ROAD PROXIMITY VALIDATION (ASYNC)
            // We validate BEFORE adding the marker
            if (window.RoadValidator) {
                window.RoadValidator.validate(complaint).then(res => {
                    complaint.road_validation = res;
                    if (!res.isValid && !res.fallback) {
                        complaint.spatial_warning = "Road Proximity Warning: No physical road detected.";
                        complaint.road_proximity_anomaly = true;
                    }

                    // Add visual marker for the new complaint (now with validation results)
                    addLiveComplaintMarker(complaint);
                }).catch(err => {
                    console.error('[LIVE-SYNC] Road validation error:', err);
                    addLiveComplaintMarker(complaint);
                });
            } else {
                addLiveComplaintMarker(complaint);
            }

            // Show notification toast
            showLiveSyncNotification(complaint);

            // v3.9.2: AUTO-RELOAD - Debounced to prevent rapid reloads
            if (autoReloadTimer) {
                clearTimeout(autoReloadTimer);
            }
            autoReloadTimer = setTimeout(() => {
                console.log('[AUTO-RELOAD] 🔄 Triggering automatic data processing...');
                loadFullSimulation().then(() => {
                    console.log('[AUTO-RELOAD] ✅ City data automatically reloaded!');
                }).catch(err => {
                    console.error('[AUTO-RELOAD] ❌ Error:', err);
                });
            }, AUTO_RELOAD_DELAY);

        } else {
            console.log('[LIVE-SYNC] ⚠️ Duplicate complaint, skipped:', complaint.id);
        }
    }
}

/**
 * Add a pulsing marker for newly received live complaints.
 * v4.2: Uses liveMarkerRegistry to prevent duplicate markers.
 * If marker already exists, updates its position instead of creating new.
 */
function addLiveComplaintMarker(complaint) {
    if (!map || !complaint.latitude || !complaint.longitude) return;

    // v4.2: DUPLICATE CHECK - Prevent double markers on same complaint
    if (liveMarkerRegistry.has(complaint.id)) {
        console.log(`[LIVE-SYNC] Marker already exists for ${complaint.id}, updating position`);
        const existingMarker = liveMarkerRegistry.get(complaint.id);
        // Update marker position if it moved
        existingMarker.setLatLng([complaint.latitude, complaint.longitude]);
        return; // Don't create a new marker
    }

    // Category colors
    const categoryColors = {
        'Fire': '#ef4444',
        'Flood': '#3b82f6',
        'Accident': '#f97316',
        'Crime': '#a855f7',
        'Medical': '#ec4899',
        'Traffic': '#eab308',
        'Pothole': '#6b7280',
        'Trash': '#84cc16',
        'Others': '#64748b'
    };

    const color = categoryColors[complaint.category] || '#00d4ff';
    const hasAnomaly = complaint.road_proximity_anomaly || complaint.spatial_warning;

    // Create pulsing marker
    const marker = L.marker([complaint.latitude, complaint.longitude], {
        icon: L.divIcon({
            html: `
                <div class="live-complaint-marker ${hasAnomaly ? 'anomaly' : ''}" style="--marker-color: ${hasAnomaly ? '#ef4444' : color};">
                    <div class="live-pulse"></div>
                    <div class="live-dot"></div>
                    <span class="live-label">${hasAnomaly ? '<i class="fas fa-exclamation-triangle"></i> ANOMALY' : 'LIVE'}</span>
                </div>
            `,
            className: 'live-marker-container',
            iconSize: [60, 60],
            iconAnchor: [30, 30]
        }),
        zIndexOffset: 2000
    }).addTo(map);

    // v4.0: Unified Popup Card (Feature 3 Support)
    // Uses the same high-fidelity Intelligence card as regular complaints
    const popupContent = generateComplaintPopupHTML(
        complaint,
        null,      // Not part of a cluster yet
        color,     // Visual consistency
        null       // No dominant category context needed
    );

    marker.bindPopup(popupContent, {
        maxWidth: 350,
        className: 'complaint-audit-popup-container'
    });

    // v4.0: Street-level location loader (Nomimatim)
    // Synchronized with clustered markers for consistent user experience
    marker.on('popupopen', async function () {
        const streetElements = document.querySelectorAll('.complaint-street-location');
        for (const element of streetElements) {
            const streetValue = element.querySelector('.street-value');
            if (streetValue && streetValue.textContent.includes('Loading')) {
                const lat = parseFloat(element.dataset.lat);
                const lng = parseFloat(element.dataset.lng);
                if (!isNaN(lat) && !isNaN(lng)) {
                    try {
                        const address = await reverseGeocode(lat, lng);
                        if (address && address.street) {
                            streetValue.innerHTML = `<strong>${address.street}</strong> <span class="street-barangay">(${address.suburb || getJurisdiction(lat, lng)})</span>`;
                        } else if (address && address.suburb) {
                            streetValue.innerHTML = `<span class="street-barangay">${address.suburb}</span> <span class="no-street">(no street name)</span>`;
                        } else {
                            streetValue.innerHTML = '<span class="no-street">Street name unavailable</span>';
                        }
                    } catch (error) {
                        streetValue.innerHTML = '<span class="no-street">Geocoding failed</span>';
                    }
                }
            }
        }
    });

    liveComplaintMarkers.push(marker);

    // v4.2: Register in the map for duplicate detection
    liveMarkerRegistry.set(complaint.id, marker);
    console.log(`[LIVE-SYNC] Registered marker: ${complaint.id} (Registry size: ${liveMarkerRegistry.size})`);

    // Pan to the new complaint
    map.panTo([complaint.latitude, complaint.longitude], { animate: true });
}

/**
 * Show a notification toast for new live complaints.
 */
function showLiveSyncNotification(complaint) {
    // Remove existing notification if any
    const existing = document.querySelector('.live-sync-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'live-sync-toast';
    toast.innerHTML = `
        <div class="toast-icon">📍</div>
        <div class="toast-content">
            <div class="toast-title">New Live Report</div>
            <div class="toast-message">${sanitizeHTML(complaint.category)}: ${sanitizeHTML(complaint.description).substring(0, 50)}...</div>
        </div>
    `;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);

    // Remove after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

/**
 * Add live sync status indicator to the dashboard header.
 */
function addLiveSyncIndicator() {
    const controlPanel = document.querySelector('.control-panel');
    if (!controlPanel) return;

    // Check if already exists
    if (document.querySelector('.live-sync-indicator')) return;

    const indicator = document.createElement('div');
    indicator.className = 'live-sync-indicator';
    indicator.innerHTML = `
        <div class="sync-dot"></div>
        <span>LIVE MODE</span>
    `;
    indicator.title = 'Receiving live complaints from panelists';

    controlPanel.insertBefore(indicator, controlPanel.firstChild);
}

// Add CSS for live sync features
const liveSyncStyles = document.createElement('style');
liveSyncStyles.textContent = `
    /* Live Complaint Marker */
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
    
    /* Live Sync Toast Notification */
    .live-sync-toast {
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
    
    .live-sync-toast.show {
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
    
    /* Live Sync Indicator */
    .live-sync-indicator {
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
document.head.appendChild(liveSyncStyles);

// ==================== v4.0 AI STATUS INDICATOR ====================

/**
 * v4.0: Add AI Status indicator to the dashboard header.
 * Shows whether TensorFlow.js + USE model is loaded and ready.
 * v4.1: Moved to footer (bottom right) with hover tooltip
 */
function addAIStatusIndicator() {
    // v4.1: Create footer container if it doesn't exist
    let footerContainer = document.querySelector('.ai-footer-container');
    if (!footerContainer) {
        footerContainer = document.createElement('div');
        footerContainer.className = 'ai-footer-container';
        document.body.appendChild(footerContainer);
    }

    // Check if already exists
    if (document.querySelector('.ai-status-indicator')) return;

    const indicator = document.createElement('div');
    indicator.className = 'ai-status-indicator loading';
    indicator.id = 'aiStatusIndicator';
    indicator.innerHTML = `
        <div class="ai-status-dot"></div>
        <div class="ai-status-tooltip">
            <div class="tooltip-title">AI Status: Loading...</div>
            <div class="tooltip-detail">TensorFlow.js + Universal Sentence Encoder</div>
            <div class="tooltip-model">Model: USE Lite (cached in IndexedDB)</div>
        </div>
    `;
    indicator.title = '';  // Disable default title, using custom tooltip

    footerContainer.appendChild(indicator);

    // Start polling for AI status
    checkAndUpdateAIStatus();
}

/**
 * Check AI status and update the indicator
 * v4.1: Updated to use tooltip instead of text
 */
function checkAndUpdateAIStatus() {
    const indicator = document.getElementById('aiStatusIndicator');
    if (!indicator) return;

    const tooltipTitle = indicator.querySelector('.tooltip-title');
    const tooltipDetail = indicator.querySelector('.tooltip-detail');

    if (typeof window.getAIStatus === 'function') {
        const status = window.getAIStatus();

        if (status.ready) {
            indicator.className = 'ai-status-indicator ready';
            if (tooltipTitle) tooltipTitle.textContent = 'AI Status: Ready ✓';
            if (tooltipDetail) tooltipDetail.textContent = 'Hybrid classification active';
            console.log('[DASHBOARD] ✅ AI Fallback is ready for inference');
        } else if (status.error) {
            indicator.className = 'ai-status-indicator error';
            if (tooltipTitle) tooltipTitle.textContent = 'AI Status: Error';
            if (tooltipDetail) tooltipDetail.textContent = status.error;
            console.warn('[DASHBOARD] ⚠️ AI Fallback error:', status.error);
        } else {
            indicator.className = 'ai-status-indicator loading';
            if (tooltipTitle) tooltipTitle.textContent = 'AI Status: Loading...';
            if (tooltipDetail) tooltipDetail.textContent = 'Downloading model from CDN';
            // Check again in 2 seconds
            setTimeout(checkAndUpdateAIStatus, 2000);
        }
    } else {
        indicator.className = 'ai-status-indicator offline';
        if (tooltipTitle) tooltipTitle.textContent = 'AI Status: Offline';
        if (tooltipDetail) tooltipDetail.textContent = 'Rule-based mode only';
    }
}

// AI Status indicator CSS - v4.1: Footer-based with tooltip
const aiStatusStyles = document.createElement('style');
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
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addAIStatusIndicator);
} else {
    addAIStatusIndicator();
}

// ==================== v4.1 DEBUG/THESIS MODE ====================

let debugModeActive = false;
let debugPanelUpdateInterval = null;

/**
 * v4.1: Add Debug/Thesis Mode toggle and floating performance panel
 * Shows real-time performance metrics for thesis demonstration
 */
function addDebugModeToggle() {
    const footerContainer = document.querySelector('.ai-footer-container');
    if (!footerContainer) return;

    // Check if already exists
    if (document.querySelector('.debug-mode-toggle')) return;

    // Create toggle button
    const toggle = document.createElement('button');
    toggle.className = 'debug-mode-toggle';
    toggle.id = 'debugModeToggle';
    toggle.innerHTML = '<i class="fas fa-bug"></i>';
    toggle.title = 'Toggle Debug/Thesis Mode';
    toggle.onclick = toggleDebugMode;

    // Insert before the AI status dot
    const aiIndicator = document.querySelector('.ai-status-indicator');
    if (aiIndicator) {
        footerContainer.insertBefore(toggle, aiIndicator);
    } else {
        footerContainer.appendChild(toggle);
    }

    // Create floating performance panel (hidden by default)
    const panel = document.createElement('div');
    panel.className = 'debug-performance-panel';
    panel.id = 'debugPerformancePanel';
    panel.innerHTML = `
        <div class="debug-panel-header">
            <i class="fas fa-tachometer-alt"></i>
            <span>THESIS MODE: Performance Metrics</span>
            <button class="debug-panel-close" onclick="toggleDebugMode()">×</button>
        </div>
        <div class="debug-panel-content">
            <div class="debug-metric">
                <span class="metric-label">Total Processing</span>
                <span class="metric-value" id="metricTotalTime">--</span>
            </div>
            <div class="debug-metric">
                <span class="metric-label">Rule-Based</span>
                <span class="metric-value" id="metricRuleTime">--</span>
            </div>
            <div class="debug-metric ai-metric">
                <span class="metric-label">AI Fallback</span>
                <span class="metric-value" id="metricAITime">--</span>
            </div>
            <div class="debug-metric">
                <span class="metric-label">Memory Usage</span>
                <span class="metric-value" id="metricMemory">--</span>
            </div>
            <div class="debug-status">
                <span class="status-label">Debug Logging:</span>
                <span class="status-value" id="debugLoggingStatus">OFF</span>
            </div>
        </div>
        <div class="debug-panel-footer">
            <small>📋 Open Console (F12) for detailed reasoning traces</small>
        </div>
    `;
    document.body.appendChild(panel);
}

/**
 * Toggle Debug/Thesis Mode
 */
function toggleDebugMode() {
    debugModeActive = !debugModeActive;

    const toggle = document.getElementById('debugModeToggle');
    const panel = document.getElementById('debugPerformancePanel');
    const loggingStatus = document.getElementById('debugLoggingStatus');

    if (debugModeActive) {
        toggle.classList.add('active');
        panel.classList.add('visible');
        loggingStatus.textContent = 'ON';
        loggingStatus.className = 'status-value active';

        // Enable NLP debug mode
        if (typeof window.setDebugMode === 'function') {
            window.setDebugMode(true);
        }

        // Start updating metrics
        updateDebugMetrics();
        debugPanelUpdateInterval = setInterval(updateDebugMetrics, 500);

        console.log('[DASHBOARD] 🔬 Debug/Thesis Mode ENABLED - Detailed traces will appear here');
    } else {
        toggle.classList.remove('active');
        panel.classList.remove('visible');
        loggingStatus.textContent = 'OFF';
        loggingStatus.className = 'status-value';

        // Disable NLP debug mode
        if (typeof window.setDebugMode === 'function') {
            window.setDebugMode(false);
        }

        // Stop updating metrics
        if (debugPanelUpdateInterval) {
            clearInterval(debugPanelUpdateInterval);
            debugPanelUpdateInterval = null;
        }

        console.log('[DASHBOARD] 🔬 Debug/Thesis Mode DISABLED');
    }
}

/**
 * Update the debug metrics panel with latest values
 */
function updateDebugMetrics() {
    if (!debugModeActive) return;

    const status = typeof window.getDebugStatus === 'function' ? window.getDebugStatus() : null;

    if (status && status.metrics) {
        const m = status.metrics;
        document.getElementById('metricTotalTime').textContent = `${m.totalTime.toFixed(1)} ms`;
        document.getElementById('metricRuleTime').textContent = `${m.ruleBasedTime.toFixed(1)} ms`;

        const aiTimeEl = document.getElementById('metricAITime');
        if (m.aiSkipped) {
            aiTimeEl.textContent = 'Skipped';
            aiTimeEl.parentElement.classList.remove('used');
        } else {
            aiTimeEl.textContent = `${m.aiTime.toFixed(1)} ms`;
            aiTimeEl.parentElement.classList.add('used');
        }

        document.getElementById('metricMemory').textContent = m.memoryUsage ? `${m.memoryUsage} MB` : 'N/A';
    }
}

// Debug Mode Toggle CSS
const debugModeStyles = document.createElement('style');
debugModeStyles.textContent = `
    /* Debug Mode Toggle Button */
    .debug-mode-toggle {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        background: rgba(15, 23, 42, 0.9);
        color: #64748b;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .debug-mode-toggle:hover {
        background: rgba(30, 41, 59, 0.95);
        color: #94a3b8;
        transform: scale(1.05);
    }
    
    .debug-mode-toggle.active {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: white;
        box-shadow: 0 0 15px rgba(99, 102, 241, 0.5);
    }
    
    /* Debug Performance Panel */
    .debug-performance-panel {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 280px;
        background: rgba(15, 23, 42, 0.97);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(99, 102, 241, 0.3);
        opacity: 0;
        visibility: hidden;
        transform: translateY(10px) scale(0.95);
        transition: all 0.3s ease;
        z-index: 9998;
        overflow: hidden;
    }
    
    .debug-performance-panel.visible {
        opacity: 1;
        visibility: visible;
        transform: translateY(0) scale(1);
    }
    
    .debug-panel-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 14px;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
        color: white;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
    }
    
    .debug-panel-header i {
        font-size: 12px;
    }
    
    .debug-panel-close {
        margin-left: auto;
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
        line-height: 1;
    }
    
    .debug-panel-close:hover {
        opacity: 1;
    }
    
    .debug-panel-content {
        padding: 14px;
    }
    
    .debug-metric {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 10px;
        margin-bottom: 6px;
        background: rgba(30, 41, 59, 0.6);
        border-radius: 6px;
        border-left: 3px solid #3b82f6;
    }
    
    .debug-metric.ai-metric {
        border-left-color: #8b5cf6;
    }
    
    .debug-metric.ai-metric.used {
        background: rgba(139, 92, 246, 0.15);
        border-left-color: #a78bfa;
    }
    
    .metric-label {
        font-size: 11px;
        color: #94a3b8;
        font-weight: 500;
    }
    
    .metric-value {
        font-size: 13px;
        font-weight: 700;
        color: #f1f5f9;
        font-family: 'Monaco', 'Consolas', monospace;
    }
    
    .debug-status {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        margin-top: 8px;
        background: rgba(34, 197, 94, 0.1);
        border-radius: 6px;
        border: 1px dashed rgba(34, 197, 94, 0.3);
    }
    
    .status-label {
        font-size: 11px;
        color: #64748b;
    }
    
    .status-value {
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
    }
    
    .status-value.active {
        color: #22c55e;
    }
    
    .debug-panel-footer {
        padding: 10px 14px;
        background: rgba(30, 41, 59, 0.5);
        border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    .debug-panel-footer small {
        font-size: 10px;
        color: #64748b;
    }
`;
document.head.appendChild(debugModeStyles);

// Initialize Debug Mode toggle when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addDebugModeToggle);
} else {
    setTimeout(addDebugModeToggle, 100);  // Small delay to ensure footer container exists
}

// ==================== OFFLINE ZONE DETECTION (Turf.js) ====================

/**
 * Load barangay boundary GeoJSON for offline zone detection.
 * Gracefully degrades if file is unavailable.
 */
async function loadBarangayBoundaries() {
    try {
        const response = await fetch('/api/boundaries');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();

        // Convert to proper GeoJSON FeatureCollection
        // The file is an array of { name, geojson } objects
        barangayGeoJSON = {
            type: 'FeatureCollection',
            features: data.map(brgy => ({
                type: 'Feature',
                properties: { name: brgy.name },
                geometry: brgy.geojson
            }))
        };

        console.log('[ZONE] Barangay boundaries loaded:', barangayGeoJSON.features.length, 'zones');
        return true;
    } catch (error) {
        console.warn('[ZONE] Failed to load barangay boundaries:', error.message);
        console.warn('[ZONE] Zone detection will use fallback coordinates');
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
        return 'Unmapped Zone';
    }

    // Validate coordinates
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
        return 'Invalid Coordinates';
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
                return name || 'Unknown Barangay';
            }
        }

        // No match found - point is outside all defined zones
        return 'Unmapped Zone';
    } catch (error) {
        console.error('[ZONE] Detection error:', error.message);
        return 'Detection Error';
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

        // Nominatim API call
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'CitizenLink-Dashboard/3.7 (thesis project; contact: citizenlink@example.com)',
                'Accept-Language': 'en'
            }
        });

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
        address.fullAddress = parts.join(', ') || data.display_name || 'Unknown Location';

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
            fullAddress: 'Location unavailable',
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
 * @param {Object} point - Complaint object with latitude/longitude
 * @returns {Promise<string>} Formatted location string
 * 
 * @example
 * const location = await getDetailedLocation(complaint);
 * // Returns: "Dona Aurora Street, Zone II"
 */
async function getDetailedLocation(point) {
    if (!point.latitude || !point.longitude) {
        return 'Unknown Location';
    }

    // Get barangay from Turf.js (fast, offline)
    const barangay = getJurisdiction(point.latitude, point.longitude);

    // Get street from Nominatim (async, online)
    try {
        const address = await reverseGeocode(point.latitude, point.longitude);

        if (address.street) {
            // Combine: "Dona Aurora Street, Zone II"
            return `${address.street}, ${barangay}`;
        } else {
            // Fallback to barangay only
            return barangay;
        }
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
        return 'Unknown Location';
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
 * @param {Object} point - Complaint object with latitude/longitude
 * @returns {Object} The same point with geocodedAddress attached (if cached)
 */
function attachCachedGeocode(point) {
    if (!point.latitude || !point.longitude) {
        return point;
    }

    const cacheKey = `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`;

    if (geocodeCache.has(cacheKey)) {
        point.geocodedAddress = geocodeCache.get(cacheKey);
        console.log(`[GEOCODE] ✅ Attached cached address to point: ${point.geocodedAddress?.street || 'no street'}`);
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
    map = L.map('map', {
        zoomControl: true,
        attributionControl: false,
        maxZoom: 22,
        // Performance optimizations
        preferCanvas: true,
        fadeAnimation: true,
        zoomAnimation: true,
        markerZoomAnimation: true
    }).setView([6.7490, 125.3572], 13);

    // Dark tile layer with performance settings
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 22,
        maxNativeZoom: 19,
        subdomains: 'abcd',
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 2
    }).addTo(map);

    // Custom attribution
    L.control.attribution({
        position: 'bottomright',
        prefix: '<a href="https://leafletjs.com">Leaflet</a> | CitizenLink Production v3.4.1'
    }).addTo(map);

    // Scale control
    L.control.scale({
        position: 'bottomleft',
        metric: true,
        imperial: false
    }).addTo(map);
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
        'Pothole': 'Road Maintenance Team',
        'Road Damage': 'Road Maintenance Team',
        'Infrastructure': 'Road Maintenance Team',

        // Sanitation
        'Trash': 'Sanitation Truck',
        'Illegal Dumping': 'Sanitation Truck',
        'Overflowing Trash': 'Sanitation Truck',
        'Bad Odor': 'Sanitation Truck',
        'Sanitation': 'Sanitation Truck',

        // Water/Utilities - Emergency Response
        'Flooding': 'Emergency Response Unit',
        'Flood': 'Emergency Response Unit',
        'No Water': 'Water Utilities Team',
        'Pipe Leak': 'Water Utilities Team',
        'Utilities': 'Water Utilities Team',
        'Environment': 'Emergency Response Unit',
        'Blackout': 'Electrical Response Team',

        // Public Safety
        'Fire': 'Fire Department (Priority)',
        'Accident': 'Emergency Medical Services',
        'Crime': 'Police Response Unit',
        'Public Safety': 'Emergency Response Unit',
        'Stray Dog': 'Animal Control Unit',
        'Noise Complaint': 'Community Affairs Officer',

        // Traffic
        'Traffic': 'Traffic Management Office',
        'Road Obstruction': 'Traffic Management Office',

        // Others
        'Broken Streetlight': 'Electrical Maintenance',
        'Streetlight': 'Electrical Maintenance'
    };
    return units[category] || 'Inspection Officer';
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
    if (barangayName && barangayName !== 'Unmapped Zone' && barangayName !== 'Detection Error') {
        return `Vicinity of ${barangayName}, Digos City`;
    }

    // Fallback for unmapped areas (still avoid raw coords)
    return 'Unmapped Area, Digos City';
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
        return 'Unknown Location';
    }

    const center = getClusterCenterFromPoints(cluster);
    const count = cluster.length;

    try {
        const address = await reverseGeocode(center.lat, center.lng);
        const barangay = getJurisdiction(center.lat, center.lng);

        if (address && address.street) {
            // "3 pothole reports within Dona Aurora Street, Zone II"
            return `${count} ${category.toLowerCase()} report${count > 1 ? 's' : ''} within ${address.street}, ${barangay}`;
        } else {
            // Fallback: "3 pothole reports in Zone II"
            return `${count} ${category.toLowerCase()} report${count > 1 ? 's' : ''} in ${barangay}`;
        }
    } catch (error) {
        console.error('[GEOCODE] Error getting cluster description:', error);
        return `${count} ${category.toLowerCase()} report${count > 1 ? 's' : ''} in ${getJurisdiction(center.lat, center.lng)}`;
    }
}

/**
 * Determine severity level based on count and category.
 */
function determineSeverity(count, category) {
    const criticalCategories = ['Fire', 'Flood', 'Flooding', 'Accident', 'Crime', 'Public Safety'];

    if (count > 8 || criticalCategories.includes(category)) {
        return 'CRITICAL';
    }
    return 'WARNING';
}

// ==================== CRITICAL TRIAGE SYSTEM UI ====================
// Renders the Emergency Panel and pulsing map markers for critical reports

// Track critical points globally for panel interactions
let currentCriticalPoints = [];
let criticalMarkersLayer = null;

/**
 * Render the Emergency Panel with critical dispatch tickets.
 * Called after extractCriticalPoints separates emergencies from standard data.
 * 
 * @param {Array} criticalPoints - Array of critical complaint objects with _criticality metadata
 */
function renderEmergencyPanel(criticalPoints) {
    const panel = document.getElementById('emergencyPanel');
    const content = document.getElementById('emergencyContent');
    const countBadge = document.getElementById('emergencyCount');

    if (!panel || !content) {
        console.warn('[TRIAGE] Emergency panel elements not found in DOM');
        return;
    }

    // Store for global access
    currentCriticalPoints = criticalPoints;

    // Update count badges (main panel + control bar mini badge)
    countBadge.textContent = criticalPoints.length;
    updateEmergencyBadge(criticalPoints.length);

    // Show/hide panel based on emergencies
    if (criticalPoints.length === 0) {
        panel.classList.remove('active');
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
    if (!panel.classList.contains('hidden')) {
        panel.classList.add('active');
    };

    // Generate emergency cards
    const cardsHTML = criticalPoints.map((point, idx) => {
        const criticality = point._criticality;
        const typeClass = criticality.type.toLowerCase();
        const barangay = getJurisdiction(point.latitude, point.longitude);
        const timeAgo = getRelativeTime(point.timestamp);

        // Icon mapping
        const iconMap = {
            'FIRE': 'fire',
            'FLOOD': 'water',
            'CRIME': 'user-shield',
            'ACCIDENT': 'car-crash',
            'MEDICAL': 'heartbeat',
            'CASUALTY': 'skull-crossbones',
            'EMERGENCY': 'exclamation-triangle'
        };
        const icon = iconMap[criticality.type] || 'exclamation-triangle';

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
                        "${sanitizeHTML(point.description) || 'No description'}"
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
                        ` : ''}
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
    }).join('');

    content.innerHTML = cardsHTML;

    // Add click handlers for card navigation
    content.querySelectorAll('.emergency-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't navigate if clicking a button
            if (e.target.closest('.emergency-btn')) return;

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

    if (diffMins < 1) return 'Just now';
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
        card.classList.add('acknowledged');
        const btn = card.querySelector('.emergency-btn.acknowledge');
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
    const type = point._criticality.type;

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
            'FIRE': 'fire',
            'FLOOD': 'water',
            'CRIME': 'user-shield',
            'ACCIDENT': 'car-crash',
            'MEDICAL': 'heartbeat',
            'CASUALTY': 'skull-crossbones',
            'EMERGENCY': 'exclamation-triangle'
        };
        const icon = iconMap[criticality.type] || 'exclamation-triangle';

        // Create custom pulsing icon
        const pulsingIcon = L.divIcon({
            className: 'leaflet-critical-icon',
            html: `
                <div class="critical-pulse-marker ${typeClass}">
                    <div class="critical-marker-inner ${typeClass}">
                        <i class="fas fa-${icon}"></i>
                    </div>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -20]
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
                        "${sanitizeHTML(point.description) || 'No description'}"
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; font-size: 12px;">
                    <div>
                        <span style="color: #666;">Location:</span><br>
                        <strong>${barangay}</strong>
                    </div>
                    <div>
                        <span style="color: #666;">Detection:</span><br>
                        <strong>${criticality.source === 'keyword' ? `Keyword: "${criticality.matchedKeyword}"` : 'Category'}</strong>
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

    criticalMarkersLayer.addTo(map);
    console.log(`[TRIAGE] Rendered ${criticalPoints.length} pulsing markers on map`);
}

/**
 * Initialize emergency panel event handlers including drag functionality
 */
function initEmergencyPanel() {
    const panel = document.getElementById('emergencyPanel');
    const header = document.querySelector('.emergency-header');
    const minimizeBtn = document.getElementById('emergencyMinimize');
    const toggleBtn = document.getElementById('toggleEmergencyPanel');

    if (!panel) return;

    // Track panel visibility state
    let isPanelVisible = true;

    // Minimize button
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();  // Don't trigger drag
            panel.classList.toggle('minimized');
        });
    }

    // Toggle button in control panel
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            isPanelVisible = !isPanelVisible;
            panel.classList.toggle('hidden', !isPanelVisible);
            toggleBtn.classList.toggle('active', isPanelVisible);

            // Update button text
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.className = isPanelVisible
                    ? 'fas fa-exclamation-triangle'
                    : 'fas fa-eye-slash';
            }
        });
    }

    // ==================== DRAGGABLE FUNCTIONALITY ====================
    if (header) {
        let isDragging = false;
        let startX, startY;
        let initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            // Don't drag if clicking on buttons
            if (e.target.closest('button')) return;

            isDragging = true;
            panel.classList.add('dragging');

            // Get current position
            const rect = panel.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            // Record mouse start position
            startX = e.clientX;
            startY = e.clientY;

            // Remove the centering transform for accurate positioning
            panel.style.transform = 'none';
            panel.style.left = initialLeft + 'px';
            panel.style.top = initialTop + 'px';

            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            let newLeft = initialLeft + deltaX;
            let newTop = initialTop + deltaY;

            // Boundary constraints (keep panel on screen)
            const panelRect = panel.getBoundingClientRect();
            const maxLeft = window.innerWidth - panelRect.width;
            const maxTop = window.innerHeight - 50;  // Keep at least header visible

            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));

            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                panel.classList.remove('dragging');
            }
        });

        // Touch support for mobile
        header.addEventListener('touchstart', (e) => {
            if (e.target.closest('button')) return;

            isDragging = true;
            panel.classList.add('dragging');

            const touch = e.touches[0];
            const rect = panel.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            startX = touch.clientX;
            startY = touch.clientY;

            panel.style.transform = 'none';
            panel.style.left = initialLeft + 'px';
            panel.style.top = initialTop + 'px';
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
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

            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
        }, { passive: true });

        document.addEventListener('touchend', () => {
            if (isDragging) {
                isDragging = false;
                panel.classList.remove('dragging');
            }
        });
    }

    console.log('[TRIAGE] Emergency panel initialized with drag support');
}

/**
 * Update the mini badge in the control panel and dropdown
 * v4.1: Now also updates the Map Layers dropdown badge
 */
function updateEmergencyBadge(count) {
    const badge = document.getElementById('emergencyBadgeMini');
    const toggleBtn = document.getElementById('toggleEmergencyPanel');

    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }

    if (toggleBtn) {
        toggleBtn.classList.toggle('has-emergencies', count > 0);
    }

    // v4.1: Update dropdown badge as well
    if (typeof updateEmergencyDropdownBadge === 'function') {
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
            totalComplaints: allData.length,
            totalClusters: clusters.length,
            criticalHotspots: 0,
            efficiencyScore: 0,
            activeIncidents: 0,
            historyLogs: 0,
            advisories: 0
        },
        cards: []
    };

    if (Array.isArray(allData) && typeof window.detectTemporalContext === 'function') {
        for (const point of allData) {
            const info = window.detectTemporalContext(point?.description || '');
            if (info?.tag === 'present') insights.stats.activeIncidents++;
            if (info?.tag === 'past') insights.stats.historyLogs++;
            if (info?.tag === 'future') insights.stats.advisories++;
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
            ['Fire', 'Flooding', 'Flood', 'Pipe Leak', 'Accident', 'Public Safety'].includes(p.subcategory || p.category)
        );

        const hasSpatialAnomaly = cluster.some(p => p.road_proximity_anomaly || p.spatial_warning);
        const anomalyReport = cluster.find(p => p.road_proximity_anomaly || p.spatial_warning);

        // Track critical hotspots (Priority Zones)
        if (severity === 'CRITICAL' || (size > 5 && hasCriticalCategory)) {
            insights.stats.criticalHotspots++;
        }

        // LOGIC 0: Spatial Anomaly Alert (New in v3.9.5)
        if (hasSpatialAnomaly) {
            insights.cards.push({
                type: 'warning',
                badge: '🎯 SPATIAL ANOMALY',
                title: `LOCATION VERIFICATION: ${dominantCategory.toUpperCase()}`,
                zoneBadge: detectedBarangay,
                description: `System detected <span class="report-count">geospatial inconsistencies</span> in reported location. Road-related complaint found outside typical road coordinates. <strong>Verification required before dispatch.</strong>`,
                action: `GEO-VERIFY LOCATION`,
                dispatchUnit: 'GIS VALIDATION TEAM',
                icon: 'map-marker-slash',
                location: { lat: location.lat, lng: location.lng, zoom: zoom + 1 },
                clusterId: idx,
                rawData: { count: size, category: dominantCategory, zoneName, barangay: detectedBarangay, anomaly: true }
            });
        }

        // LOGIC 1: Critical Alert - High Priority Zones
        if (size > 8 || (size > 5 && hasCriticalCategory)) {
            insights.cards.push({
                type: 'critical',
                badge: '🔴 CRITICAL ALERT',
                title: `${dominantCategory.toUpperCase()}`,
                zoneBadge: detectedBarangay,
                description: `<span class="report-count">${size} citizen reports</span> merged near <span class="location-text">${detectedBarangay}</span>. System suggests this is a priority incident.`,
                action: `REVIEW & DISPATCH`,
                dispatchUnit: dispatchUnit,
                icon: 'exclamation-circle',
                location: { lat: location.lat, lng: location.lng, zoom: zoom },
                clusterId: idx,
                rawData: { count: size, category: dominantCategory, zoneName, barangay: detectedBarangay }
            });
        }
        // LOGIC 2: Warning - Standard Zones
        else if (size >= 3) {
            insights.cards.push({
                type: 'warning',
                badge: '⚠️ ZONE WARNING',
                title: `${dominantCategory.toUpperCase()}`,
                zoneBadge: detectedBarangay,
                description: `<span class="report-count">${size} citizen reports</span> merged near <span class="location-text">${detectedBarangay}</span>. System suggests this is a developing incident.`,
                action: `REVIEW & DISPATCH`,
                dispatchUnit: dispatchUnit,
                icon: 'exclamation-triangle',
                location: { lat: location.lat, lng: location.lng, zoom: zoom },
                clusterId: idx,
                rawData: { count: size, category: dominantCategory, zoneName, barangay: detectedBarangay }
            });
        }

        // ================================================================
        // LOGIC 3: Multi-Cascade Failures - MOVED TO PHASE 2 (User-Triggered)
        // Causal chain detection is now handled by runCausalAnalysis()
        // Trigger via the "Causal Analysis" button in the control panel
        // ================================================================
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
            type: 'info',
            badge: '📊 SYSTEM STATUS',
            title: `RESOURCE OPTIMIZATION`,
            description: `<span class="report-count">${originalCount} citizen inputs</span> compressed to <span class="report-count">${reducedCount} verified incidents</span>. ${noiseCount} isolated reports filtered as noise. City workload reduced by <span class="location-text">${efficiency}%</span>.`,
            action: `Review ${reducedCount} incidents for resource allocation`,
            icon: 'tasks',
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
            type: 'info',
            badge: '📈 TRENDING',
            title: `PRIMARY CONCERN: ${mostCommon.category.toUpperCase()}`,
            description: `<span class="report-count">${mostCommon.count} reports (${percentage}%)</span> of total. This is the highest volume issue citywide.`,
            action: `PRIORITIZE: <span class="unit-type">${dispatchUnit}</span> deployment`,
            icon: 'chart-line',
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
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b, 'Unknown');
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

// ==================== PHASE 2: CAUSAL ANALYSIS (USER-TRIGGERED) ====================

/**
 * State for causal link visualization on the map
 */
let causalLinkLines = [];
let causalAnalysisRunning = false;

/**
 * PHASE 2: Run Causal Chain Analysis
 * ==================================
 * This function is triggered manually by the user via the "Causal Analysis" button.
 * It performs two types of causal detection:
 * 
 * 1. INTRA-CLUSTER: Detects causal chains WITHIN a single cluster (e.g., a cluster
 *    containing both "Flood" and "Traffic" reports → Flood caused Traffic)
 * 
 * 2. INTER-CLUSTER: Detects causal chains BETWEEN clusters using the CausalityManager
 *    module (e.g., Cluster A = Flood, Cluster B = Traffic 50m away → linked)
 * 
 * Results are displayed as insight cards in the Command Center panel and
 * visualized as dashed lines on the map connecting related clusters.
 * 
 * @returns {Promise<void>}
 */
async function runCausalAnalysis() {
    if (causalAnalysisRunning) {
        console.log('[CAUSAL] Analysis already in progress...');
        return;
    }

    if (!currentClusters || currentClusters.length === 0) {
        alert('Please load city data and run clustering first (Phase 1).');
        return;
    }

    causalAnalysisRunning = true;

    // ================================================================
    // PHASE 2 ACTIVATION: Enable cross-category causal clustering
    // This flag is checked by simulation-engine.js to allow RELATIONSHIP_MATRIX
    // merging and cross-category cluster correlation
    // ================================================================
    causalAnalysisEnabled = true;
    console.log('[CAUSAL] Phase 2 activated - cross-category clustering now enabled');

    const causalBtn = document.getElementById('runCausalAnalysis');
    const statusIndicator = document.getElementById('statusIndicator');

    // Update UI to show processing
    if (causalBtn) {
        causalBtn.disabled = true;
        causalBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Re-clustering...</span>';
    }
    if (statusIndicator) {
        statusIndicator.classList.add('processing');
        statusIndicator.querySelector('span').textContent = 'Causal Re-clustering...';
    }

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║           🔗 PHASE 2: CAUSAL CHAIN ANALYSIS                ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Re-running clustering with causal links enabled...        ║`);
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Clear previous causal link visualizations
    clearCausalLinks();

    const causalInsights = [];
    let intraClusterLinks = 0;
    let interClusterLinks = 0;

    try {
        // ================================================================
        // STEP 0: RE-RUN CLUSTERING WITH CAUSAL ANALYSIS ENABLED
        // Now that causalAnalysisEnabled=true, the RELATIONSHIP_MATRIX
        // cross-category merging will be active in simulation-engine.js
        // ================================================================
        console.log('[CAUSAL] Step 0: Re-running DBSCAN++ with cross-category clustering enabled...');

        // Get the current data (filtered by category if applicable)
        const allData = simulationEngine.complaints;
        let filteredData = allData;
        if (currentFilterCategory !== 'all') {
            filteredData = allData.filter(p => p.category === currentFilterCategory);
        }

        // Extract critical points (they bypass clustering)
        const { criticalPoints, standardPoints } = window.extractCriticalPoints
            ? window.extractCriticalPoints(filteredData)
            : { criticalPoints: [], standardPoints: filteredData };

        // Re-run clustering with causal analysis now enabled
        const clusteringResult = clusterComplaints(standardPoints, {
            MIN_PTS: 1,
            ENABLE_LOGGING: true
        });

        // Update global state with new clusters
        currentClusters = clusteringResult.clusters;
        currentNoisePoints = clusteringResult.noise;

        console.log(`[CAUSAL] Step 0 complete: ${currentClusters.length} clusters after causal merging`);

        // Re-visualize clusters with new causal-merged data
        visualizeClusters(currentClusters);
        visualizeNoisePoints(currentNoisePoints);

        // ================================================================
        // STEP 1: INTRA-CLUSTER CAUSAL DETECTION
        // Detect causal chains WITHIN each cluster (multi-category clusters)
        // ================================================================
        console.log('[CAUSAL] Step 1: Analyzing intra-cluster relationships...');

        currentClusters.forEach((cluster, idx) => {
            const categories = [...new Set(cluster.map(p => p.subcategory || p.category))];

            if (categories.length >= 2) {
                const chainResult = detectCausalChain(categories);

                if (chainResult && chainResult.detected) {
                    intraClusterLinks++;

                    const location = getClusterCenterFromPoints(cluster);
                    const zoom = calculateOptimalZoom(cluster);
                    const detectedBarangay = getJurisdiction(location.lat, location.lng);

                    let cardType, badgeText;
                    if (chainResult.alertLevel === 'CRITICAL') {
                        cardType = 'cascade-critical';
                        badgeText = `${chainResult.icon} CRITICAL CHAIN`;
                    } else if (chainResult.alertLevel === 'WARNING') {
                        cardType = 'cascade-warning';
                        badgeText = `${chainResult.icon} WARNING CHAIN`;
                    } else {
                        cardType = 'cascade-info';
                        badgeText = `${chainResult.icon} MONITOR`;
                    }

                    causalInsights.push({
                        type: cardType,
                        badge: badgeText,
                        title: chainResult.displayTitle,
                        zoneBadge: detectedBarangay,
                        description: `<span class="report-count">${chainResult.chain.join(' → ')}</span> detected within cluster. ${chainResult.alertLevel === 'CRITICAL' ? 'Life-safety threat requiring immediate response.' : 'Coordinate response for operational efficiency.'}`,
                        action: `<span class="coordinator-action">${chainResult.suggestedAction}</span>`,
                        icon: chainResult.alertLevel === 'CRITICAL' ? 'exclamation-circle' : 'project-diagram',
                        location: { lat: location.lat, lng: location.lng, zoom: zoom },
                        clusterId: idx,
                        chainData: chainResult,
                        coordinatorAction: chainResult.suggestedAction,
                        linkType: 'intra-cluster'
                    });
                }
            }
        });

        console.log(`[CAUSAL] Step 1 complete: ${intraClusterLinks} intra-cluster chains detected`);

        // ================================================================
        // STEP 2: INTER-CLUSTER CAUSAL DETECTION
        // Detect causal chains BETWEEN clusters using CausalityManager
        // ================================================================
        console.log('[CAUSAL] Step 2: Analyzing inter-cluster relationships...');

        // Build cluster objects with required metadata for CausalityManager
        const clusterObjects = currentClusters.map((cluster, idx) => {
            const center = getClusterCenterFromPoints(cluster);
            const dominantCategory = getMostCommonCategory(cluster);
            const avgTimestamp = getClusterAverageTime ? getClusterAverageTime(cluster) : Date.now();

            return {
                id: idx,
                points: cluster,
                center: center,
                category: dominantCategory,
                timestamp: avgTimestamp,
                latitude: center.lat,
                longitude: center.lng
            };
        });

        // Use CausalityManager to find links between clusters
        if (typeof window.findAllCausalLinks === 'function' && clusterObjects.length >= 2) {
            const interLinks = window.findAllCausalLinks(clusterObjects);

            interLinks.forEach(link => {
                interClusterLinks++;

                const causeCluster = clusterObjects[link.causeIndex];
                const effectCluster = clusterObjects[link.effectIndex];

                // Draw visual link on map
                drawCausalLink(causeCluster.center, effectCluster.center, link.verification);

                const detectedBarangay = getJurisdiction(effectCluster.center.lat, effectCluster.center.lng);

                causalInsights.push({
                    type: 'cascade-warning',
                    badge: '🔗 CROSS-CLUSTER LINK',
                    title: `${causeCluster.category} → ${effectCluster.category}`,
                    zoneBadge: detectedBarangay,
                    description: `<span class="report-count">Cluster #${link.causeIndex + 1}</span> (${causeCluster.category}) likely caused <span class="report-count">Cluster #${link.effectIndex + 1}</span> (${effectCluster.category}). Distance: ${Math.round(link.verification.distance || 0)}m.`,
                    action: `<span class="coordinator-action">🔍 INVESTIGATE AS LINKED INCIDENT</span>`,
                    icon: 'link',
                    location: { lat: effectCluster.center.lat, lng: effectCluster.center.lng, zoom: 16 },
                    clusterId: link.effectIndex,
                    linkData: link,
                    coordinatorAction: 'Investigate as linked incident',
                    linkType: 'inter-cluster'
                });
            });

            console.log(`[CAUSAL] Step 2 complete: ${interClusterLinks} inter-cluster links detected`);
        } else {
            console.log('[CAUSAL] Step 2 skipped: CausalityManager not loaded or insufficient clusters');
        }

        // ================================================================
        // STEP 3: UPDATE UI WITH CAUSAL INSIGHTS
        // ================================================================
        console.log('[CAUSAL] Step 3: Updating Command Center...');

        // Re-visualize clusters so popups now show causal chain data
        console.log('[CAUSAL] Re-rendering cluster popups with causal chain data...');
        visualizeClusters(currentClusters);

        // ================================================================
        // STEP 4: REGENERATE INSIGHTS WITH NEW CLUSTER DATA
        // ================================================================
        console.log('[CAUSAL] Step 4: Regenerating insights with causal-merged clusters...');

        // Reuse filteredData from Step 0 (allData already declared there)
        const insights = generateSmartInsights(currentClusters, currentNoisePoints, filteredData);
        updateStatsDisplay(insights);
        renderInsightsCards(insights);

        if (causalInsights.length > 0) {
            // Sort: Critical first, then Warning, then Info
            const order = { 'cascade-critical': 0, 'cascade-warning': 1, 'cascade-info': 2 };
            causalInsights.sort((a, b) => (order[a.type] || 3) - (order[b.type] || 3));

            // Render causal insight cards (append to existing insights)
            renderCausalInsightCards(causalInsights);

            // Show success toast
            showCausalToast(`Re-clustered! Found ${intraClusterLinks + interClusterLinks} causal chains.`, 'success');
        } else {
            showCausalToast('Re-clustering complete. No causal chains detected.', 'info');
        }

        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║           ✅ CAUSAL ANALYSIS COMPLETE                      ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║  Clusters after causal merge: ${currentClusters.length.toString().padEnd(26)} ║`);
        console.log(`║  Intra-cluster chains: ${intraClusterLinks.toString().padEnd(33)} ║`);
        console.log(`║  Inter-cluster links:  ${interClusterLinks.toString().padEnd(33)} ║`);
        console.log(`║  Total causal links:   ${(intraClusterLinks + interClusterLinks).toString().padEnd(33)} ║`);
        console.log('╚════════════════════════════════════════════════════════════╝');

    } catch (error) {
        console.error('[CAUSAL] Analysis failed:', error);
        showCausalToast('Causal analysis failed: ' + error.message, 'error');
    } finally {
        // Reset UI state
        causalAnalysisRunning = false;

        if (causalBtn) {
            causalBtn.disabled = false;
            causalBtn.innerHTML = '<i class="fas fa-link"></i> <span>Causal Analysis</span>';
        }
        if (statusIndicator) {
            statusIndicator.classList.remove('processing');
            statusIndicator.querySelector('span').textContent = 'Causal Analysis Done';
        }
    }
}

/**
 * Draw a dashed line on the map connecting two causally-linked clusters.
 * 
 * @param {Object} causeCenter - { lat, lng } of cause cluster
 * @param {Object} effectCenter - { lat, lng } of effect cluster
 * @param {Object} verification - Verification result from CausalityManager
 */
function drawCausalLink(causeCenter, effectCenter, verification) {
    if (!map || !causeCenter || !effectCenter) return;

    const color = verification?.checks?.direction ? '#a855f7' : '#64748b'; // Purple for verified, gray otherwise

    const polyline = L.polyline(
        [[causeCenter.lat, causeCenter.lng], [effectCenter.lat, effectCenter.lng]],
        {
            color: color,
            weight: 3,
            opacity: 0.8,
            dashArray: '10, 10',
            className: 'causal-link-line'
        }
    ).addTo(map);

    // Add arrow marker at midpoint
    const midLat = (causeCenter.lat + effectCenter.lat) / 2;
    const midLng = (causeCenter.lng + effectCenter.lng) / 2;

    const arrowMarker = L.marker([midLat, midLng], {
        icon: L.divIcon({
            html: '<div class="causal-arrow-icon">→</div>',
            className: 'causal-arrow-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        })
    }).addTo(map);

    // Popup on the line
    polyline.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; padding: 8px;">
            <strong style="color: #a855f7;">🔗 Causal Link</strong><br>
            <span style="font-size: 12px; color: #64748b;">
                Direction: ${verification?.checks?.direction ? '✅ Verified' : '⚠️ Unverified'}<br>
                Temporal: ${verification?.checks?.temporal ? '✅ Valid' : '⚠️ Unknown'}<br>
                Spatial: ${verification?.checks?.spatial ? '✅ Within range' : '⚠️ Far'}
            </span>
        </div>
    `, { className: 'causal-link-popup' });

    causalLinkLines.push(polyline, arrowMarker);
}

/**
 * Clear all causal link visualizations from the map.
 */
function clearCausalLinks() {
    causalLinkLines.forEach(layer => {
        if (map && layer) {
            map.removeLayer(layer);
        }
    });
    causalLinkLines = [];
    console.log('[CAUSAL] Cleared previous link visualizations');
}

/**
 * Render causal insight cards in the Command Center panel.
 * Appends to existing insights rather than replacing.
 * 
 * @param {Array} causalInsights - Array of causal insight card objects
 */
function renderCausalInsightCards(causalInsights) {
    const insightsContent = document.getElementById('insightsContent');
    if (!insightsContent) return;

    // Create a separator for causal insights
    const separator = document.createElement('div');
    separator.className = 'causal-section-separator';
    separator.innerHTML = `
        <div class="separator-line"></div>
        <span class="separator-label">🔗 CAUSAL CHAIN ANALYSIS (Phase 2)</span>
        <div class="separator-line"></div>
    `;
    insightsContent.appendChild(separator);

    // Render each causal insight card
    causalInsights.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = `insight-card ${card.type}`;
        cardElement.innerHTML = `
            <div class="card-header">
                <span class="card-badge ${card.type}">${card.badge}</span>
                ${card.zoneBadge ? `<span class="zone-badge">${sanitizeHTML(card.zoneBadge)}</span>` : ''}
            </div>
            <h3 class="card-title">
                <i class="fas fa-${card.icon}"></i>
                ${sanitizeHTML(card.title)}
            </h3>
            <p class="card-description">${card.description}</p>
            <div class="card-action">${card.action}</div>
            ${card.linkType ? `<div class="link-type-badge">${card.linkType === 'inter-cluster' ? '🔗 Cross-Cluster' : '📍 Within Cluster'}</div>` : ''}
        `;

        // Click to navigate to location
        if (card.location) {
            cardElement.style.cursor = 'pointer';
            cardElement.addEventListener('click', () => {
                map.flyTo([card.location.lat, card.location.lng], card.location.zoom || 16, {
                    duration: 1.5
                });
            });
        }

        insightsContent.appendChild(cardElement);
    });
}

/**
 * Show a toast notification for causal analysis results.
 * 
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'info', or 'error'
 */
function showCausalToast(message, type = 'success') {
    const existing = document.querySelector('.causal-toast');
    if (existing) existing.remove();

    const iconMap = {
        success: 'check-circle',
        info: 'info-circle',
        error: 'exclamation-circle'
    };

    const toast = document.createElement('div');
    toast.className = `causal-toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${iconMap[type] || 'info-circle'}"></i>
        <span>${sanitizeHTML(message)}</span>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('active'));

    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// ==================== MODULE 3: DETERMINISTIC CAUSAL CHAINS ====================
/**
 * Detect and classify causal chains with COORDINATOR-CENTRIC actions.
 * 
 * Instead of just flagging severity, this now suggests specific Command Center actions.
 * - CRITICAL: Life-safety threats requiring immediate multi-agency response
 * - WARNING: Operational disruptions requiring traffic/utility coordination  
 * - INFO: Linked events for monitoring
 * 
 * SPATIAL REQUIREMENT: Clusters must be within 100m for chain detection.
 * 
 * @param {Array} categories - Array of category strings in cluster
 * @param {Object} clusterA - First cluster with center coordinates (optional)
 * @param {Object} clusterB - Second cluster with center coordinates (optional)
 * @returns {Object|null} Coordinator action object or null if no chain detected
 * 
 * @example
 * // Flood + Traffic cluster within 100m
 * detectCausalChain(['Flood', 'Traffic'], clusterA, clusterB)
 * // Returns: { 
 * //   detected: true, 
 * //   alertLevel: 'WARNING',
 * //   suggestedAction: '⚠️ DEPLOY TRAFFIC CONTROL',
 * //   displayTitle: 'CONGESTION DUE TO FLOOD'
 * // }
 */
function detectCausalChain(categories, clusterA = null, clusterB = null) {
    // ==================== SPATIAL VALIDATION (100m requirement) ====================
    // If two clusters are provided, check if they're within 100m
    if (clusterA && clusterB && clusterA.center && clusterB.center) {
        const distance = window.haversineDistance ?
            window.haversineDistance(
                clusterA.center.lat, clusterA.center.lng,
                clusterB.center.lat, clusterB.center.lng
            ) : 0;

        if (distance > 100) {
            console.log(`[CAUSAL] Clusters too far apart: ${distance.toFixed(0)}m > 100m threshold`);
            return null; // No chain if too far apart
        }
    }

    // ==================== COORDINATOR ACTION MAP ====================
    // Maps "Cause|Effect" pairs to specific Command Center actions.
    // This is the single source of truth for causal chain responses.

    const ACTION_MAP = {
        // ============ CRITICAL: LIFE SAFETY (Red Panel) ============
        // These require immediate multi-agency emergency response

        'Fire|Accident': {
            action: '🚨 DISPATCH AMBULANCE & FIRE TRUCK',
            level: 'CRITICAL',
            title: 'FIRE WITH CASUALTIES',
            icon: '🔥',
            priority: 1
        },
        'Fire|Medical': {
            action: '🚨 DISPATCH AMBULANCE & FIRE TRUCK',
            level: 'CRITICAL',
            title: 'FIRE WITH INJURIES',
            icon: '🔥',
            priority: 1
        },
        'Fire|Collapse': {
            action: '🚨 EVACUATE AREA IMMEDIATELY',
            level: 'CRITICAL',
            title: 'STRUCTURAL COLLAPSE RISK',
            icon: '🔥',
            priority: 1
        },
        'Fire|Road Damage': {
            action: '🚨 CLOSE ROAD & DISPATCH FIRE',
            level: 'CRITICAL',
            title: 'FIRE DAMAGE TO INFRASTRUCTURE',
            icon: '🔥',
            priority: 1
        },
        'Explosion|Fire': {
            action: '🚨 EVACUATE & DISPATCH ALL UNITS',
            level: 'CRITICAL',
            title: 'EXPLOSION FIRE',
            icon: '💥',
            priority: 1
        },
        'Flooding|Accident': {
            action: '🚨 DISPATCH RESCUE TEAM',
            level: 'CRITICAL',
            title: 'FLOOD RESCUE NEEDED',
            icon: '🌊',
            priority: 1
        },
        'Flood|Accident': {
            action: '🚨 DISPATCH RESCUE TEAM',
            level: 'CRITICAL',
            title: 'FLOOD RESCUE NEEDED',
            icon: '🌊',
            priority: 1
        },
        'Crime|Accident': {
            action: '🚨 DISPATCH POLICE & AMBULANCE',
            level: 'CRITICAL',
            title: 'VIOLENT INCIDENT',
            icon: '🚨',
            priority: 1
        },
        'Crime|Medical': {
            action: '🚨 DISPATCH POLICE & AMBULANCE',
            level: 'CRITICAL',
            title: 'ASSAULT WITH INJURIES',
            icon: '🚨',
            priority: 1
        },
        'Collapse|Accident': {
            action: '🚨 SEARCH & RESCUE TEAM',
            level: 'CRITICAL',
            title: 'STRUCTURAL COLLAPSE',
            icon: '🏚️',
            priority: 1
        },

        // ============ WARNING: OPERATIONAL (Yellow Panel) ============
        // These require coordination but are not life-threatening

        // Traffic/Congestion Management
        'Flooding|Traffic': {
            action: '⚠️ DEPLOY TRAFFIC CONTROL',
            level: 'WARNING',
            title: 'CONGESTION DUE TO FLOOD',
            icon: '🚦',
            priority: 2
        },
        'Flood|Traffic': {
            action: '⚠️ DEPLOY TRAFFIC CONTROL',
            level: 'WARNING',
            title: 'CONGESTION DUE TO FLOOD',
            icon: '🚦',
            priority: 2
        },
        'Road Damage|Traffic': {
            action: '⚠️ REROUTE VEHICLES',
            level: 'WARNING',
            title: 'BOTTLENECK DETECTED',
            icon: '🚧',
            priority: 2
        },
        'Infrastructure|Traffic': {
            action: '⚠️ MANAGE CONGESTION',
            level: 'WARNING',
            title: 'INFRASTRUCTURE IMPACT',
            icon: '🚧',
            priority: 2
        },
        'Environment|Traffic': {
            action: '⚠️ COORDINATE RESPONSE',
            level: 'WARNING',
            title: 'ENVIRONMENTAL TRAFFIC IMPACT',
            icon: '🌿',
            priority: 2
        },

        // Water/Utility Issues
        'Pipe Leak|Flooding': {
            action: '🔧 NOTIFY WATER DISTRICT',
            level: 'WARNING',
            title: 'PIPE LEAK CAUSING FLOOD',
            icon: '💧',
            priority: 2
        },
        'Pipe Leak|Flood': {
            action: '🔧 NOTIFY WATER DISTRICT',
            level: 'WARNING',
            title: 'PIPE LEAK CAUSING FLOOD',
            icon: '💧',
            priority: 2
        },
        'No Water|Pipe Leak': {
            action: '🔧 DISPATCH WATER REPAIR CREW',
            level: 'WARNING',
            title: 'WATER OUTAGE SOURCE FOUND',
            icon: '💧',
            priority: 2
        },
        'Utilities|No Water': {
            action: '🔧 INVESTIGATE UTILITY ISSUE',
            level: 'WARNING',
            title: 'UTILITY SERVICE DISRUPTION',
            icon: '⚡',
            priority: 2
        },

        // Road/Infrastructure Degradation
        'Flooding|Road Damage': {
            action: '🔧 SCHEDULE ROAD ASSESSMENT',
            level: 'WARNING',
            title: 'FLOOD DAMAGE TO ROAD',
            icon: '🛣️',
            priority: 2
        },
        'Flood|Road Damage': {
            action: '🔧 SCHEDULE ROAD ASSESSMENT',
            level: 'WARNING',
            title: 'FLOOD DAMAGE TO ROAD',
            icon: '🛣️',
            priority: 2
        },
        'Road Damage|Pothole': {
            action: '🔧 PRIORITIZE ROAD REPAIR',
            level: 'WARNING',
            title: 'ROAD DEGRADATION CASCADE',
            icon: '🛣️',
            priority: 3
        },
        'Pothole|Road Damage': {
            action: '🔧 ASSESS ROAD CONDITION',
            level: 'WARNING',
            title: 'ROAD DETERIORATION',
            icon: '🛣️',
            priority: 3
        },

        // Sanitation Chains
        'Trash|Bad Odor': {
            action: '🧹 PRIORITIZE GARBAGE COLLECTION',
            level: 'WARNING',
            title: 'SANITATION ISSUE',
            icon: '🗑️',
            priority: 3
        },
        'Trash|Overflowing Trash': {
            action: '🧹 EMERGENCY GARBAGE PICKUP',
            level: 'WARNING',
            title: 'WASTE OVERFLOW',
            icon: '🗑️',
            priority: 3
        },
        'Sanitation|Bad Odor': {
            action: '🧹 DISPATCH SANITATION TEAM',
            level: 'WARNING',
            title: 'HEALTH HAZARD',
            icon: '🏥',
            priority: 2
        },

        // Environmental
        'Environment|Flooding': {
            action: '🌿 COORDINATE DRRMO + ENRO',
            level: 'WARNING',
            title: 'ENVIRONMENTAL FLOOD EVENT',
            icon: '🌿',
            priority: 2
        },

        // ============ INFO: SAFETY HAZARDS (Speculative) ============
        // These are preventive alerts, not active emergencies

        'Streetlight|Accident': {
            action: '👀 VERIFY LIGHTING CONDITION',
            level: 'INFO',
            title: 'POOR VISIBILITY RISK',
            icon: '💡',
            priority: 3
        },
        'Broken Streetlight|Accident': {
            action: '👀 VERIFY LIGHTING CONDITION',
            level: 'INFO',
            title: 'POOR VISIBILITY RISK',
            icon: '💡',
            priority: 3
        },
        'Road Damage|Accident': {
            action: '👀 INSTALL WARNING SIGNS',
            level: 'INFO',
            title: 'ROAD HAZARD RISK',
            icon: '⚠️',
            priority: 3
        },
        'Pothole|Accident': {
            action: '👀 MARK HAZARD AREA',
            level: 'INFO',
            title: 'POTHOLE HAZARD',
            icon: '⚠️',
            priority: 3
        }
    };

    // ==================== CHAIN DETECTION LOGIC ====================
    // Check all category pairs against the ACTION_MAP

    let bestMatch = null;

    for (let i = 0; i < categories.length; i++) {
        for (let j = 0; j < categories.length; j++) {
            if (i === j) continue;

            const cause = categories[i];
            const effect = categories[j];
            const pairKey = `${cause}|${effect}`;

            if (ACTION_MAP[pairKey]) {
                const mapping = ACTION_MAP[pairKey];

                // Keep the highest priority (lowest number) match
                if (!bestMatch || mapping.priority < bestMatch.priority) {
                    bestMatch = {
                        detected: true,
                        chain: [cause, effect],
                        pairKey: pairKey,

                        // NEW: Coordinator-Centric fields
                        suggestedAction: mapping.action,
                        alertLevel: mapping.level,
                        displayTitle: mapping.title,
                        icon: mapping.icon,
                        priority: mapping.priority,

                        // LEGACY: Keep for backward compatibility
                        severity: mapping.level,
                        label: mapping.title,
                        dispatchHint: mapping.action.replace(/^[^\s]+\s/, '') // Remove emoji prefix
                    };
                }
            }
        }
    }

    return bestMatch; // null if no chain detected
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



// ==================== UI UPDATE FUNCTIONS ====================

function updateStatsDisplay(insights) {
    document.getElementById('totalComplaints').textContent = insights.stats.totalComplaints.toLocaleString();
    document.getElementById('totalClusters').textContent = insights.stats.totalClusters;
    document.getElementById('criticalHotspots').textContent = insights.stats.criticalHotspots;
    document.getElementById('efficiencyScore').textContent = `${insights.stats.efficiencyScore}%`;
    const activeEl = document.getElementById('activeIncidentsCount');
    const historyEl = document.getElementById('historyLogsCount');
    const advEl = document.getElementById('advisoriesCount');
    if (activeEl) activeEl.textContent = insights.stats.activeIncidents ?? '--';
    if (historyEl) historyEl.textContent = insights.stats.historyLogs ?? '--';
    if (advEl) advEl.textContent = insights.stats.advisories ?? '--';
}

function renderInsightsCards(insights) {
    const container = document.getElementById('insightsContent');

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

    container.innerHTML = insights.cards.map((card, index) => `
        <div class="insight-card ${card.type}" 
             data-card-index="${index}" 
             ${card.location ? `data-has-location="true" data-lat="${card.location.lat}" data-lng="${card.location.lng}" data-zoom="${card.location.zoom}"` : ''}>
            
            <!-- Zone Badge Header -->
            ${card.zoneBadge ? `
            <div class="card-zone-header">
                <span class="zone-badge">
                    <i class="fas fa-map-marker-alt"></i> ${card.zoneBadge}
                </span>
                ${card.location ? `<i class="fas fa-crosshairs card-location-icon" title="Navigate to location"></i>` : ''}
            </div>
            ` : ''}
            
            <!-- Alert Type & Category -->
            <div class="insight-header-row">
                <span class="insight-badge ${card.type}">${card.badge}</span>
                <span class="insight-title">${card.title}</span>
                ${!card.zoneBadge && card.location ? `<i class="fas fa-crosshairs card-location-icon" title="Navigate to location"></i>` : ''}
            </div>
            
            <!-- Description -->
            <p class="insight-description">${card.description}</p>
            
            <!-- Dispatch Action Button (Human Authority Emphasized) -->
            ${card.action ? `
                ${card.dispatchUnit ? `
                <div class="dispatch-section">
                    <div class="dispatch-unit-info">
                        <i class="fas fa-truck"></i>
                        <span>Suggested: <strong>${card.dispatchUnit}</strong></span>
                    </div>
                    <button class="dispatch-btn" data-zone="${card.zoneBadge || 'Unknown'}">
                        <i class="fas fa-clipboard-check"></i>
                        REVIEW & DISPATCH
                    </button>
                </div>
                ` : `
                <div class="insight-action">
                    <i class="fas fa-arrow-right"></i>
                    ${card.action}
                </div>
                `}
            ` : ''}
        </div>
    `).join('');

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
            cardElement.style.cursor = 'pointer';

            cardElement.addEventListener('click', () => {
                console.log('[NAV] Flying to:', lat, lng, 'zoom:', zoom);

                // Animate map to location
                map.flyTo([lat, lng], zoom, {
                    duration: 1.5,
                    easeLinearity: 0.25
                });

                // Add visual feedback
                cardElement.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    cardElement.style.transform = '';
                }, 200);

                // Show notification
                showLocationNotification();
            });

            // Add hover effect
            cardElement.addEventListener('mouseenter', () => {
                cardElement.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.3)';
            });

            cardElement.addEventListener('mouseleave', () => {
                cardElement.style.boxShadow = '';
            });
        }
    });
}

/**
 * Show brief notification when navigating to location
 */
function showLocationNotification() {
    const notification = document.createElement('div');
    notification.className = 'location-notification';
    notification.innerHTML = `
        <i class="fas fa-location-arrow"></i>
        <span>Navigating to location...</span>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

function renderCategoryDistribution(data) {
    const distribution = analyzeCategoryDistribution(data);
    const container = document.getElementById('categoryBars');

    const maxCount = distribution[0]?.count || 1;

    container.innerHTML = distribution.slice(0, 6).map(item => {
        const percentage = (item.count / maxCount) * 100;
        return `
            <div class="category-bar-item">
                <div class="category-bar-label">
                    <span class="category-bar-name">${item.category}</span>
                    <span class="category-bar-count">${item.count}</span>
                </div>
                <div class="category-bar-track">
                    <div class="category-bar-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

// ==================== HEATMAP FUNCTIONS ====================

function createHeatmap(data) {
    if (!window.L.heatLayer) {
        console.error('[HEATMAP] Leaflet.heat plugin not loaded');
        return;
    }

    // Destroy existing heatmap
    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
    }

    // Build heatmap data with intensity weighting
    const heatData = data
        .filter(p => p.latitude && p.longitude)
        .map(p => {
            // Critical categories get higher intensity
            let intensity = 0.5;
            if (['Fire', 'Flooding'].includes(p.category)) {
                intensity = 1.0;
            } else if (['Pipe Leak', 'Road Damage'].includes(p.category)) {
                intensity = 0.7;
            }
            return [p.latitude, p.longitude, intensity];
        });

    heatmapLayer = L.heatLayer(heatData, {
        radius: 25,
        blur: 35,
        maxZoom: 17,
        max: 1.0,
        gradient: {
            0.0: '#0000ff',
            0.3: '#00ffff',
            0.5: '#00ff00',
            0.7: '#ffff00',
            1.0: '#ff0000'
        }
    }).addTo(map);

    console.log('[HEATMAP] Created with', heatData.length, 'points');
}

function toggleHeatmap() {
    const button = document.getElementById('toggleHeatmap');

    if (heatmapLayer) {
        if (map.hasLayer(heatmapLayer)) {
            map.removeLayer(heatmapLayer);
            button.classList.remove('active');
            console.log('[HEATMAP] Hidden');
        } else {
            map.addLayer(heatmapLayer);
            button.classList.add('active');
            console.log('[HEATMAP] Shown');
        }
    }
}

/**
 * Toggle visibility of cluster markers, connection lines, and noise points.
 * When hidden, background markers become interactive to show complaint details.
 * Useful for decluttering the map or focusing on heatmap data.
 */
function toggleClusters() {
    const button = document.getElementById('toggleClusters');

    if (!simulationEngine) {
        console.warn('[CLUSTERS] Simulation engine not initialized');
        return;
    }

    clustersVisible = !clustersVisible;

    if (clustersVisible) {
        // Show clusters - hide background markers, show spotlight markers
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

        // Hide background markers when clusters are visible
        if (simulationEngine.backgroundMarkers) {
            simulationEngine.backgroundMarkers.forEach((marker) => {
                if (marker && map.hasLayer(marker)) {
                    map.removeLayer(marker);
                }
            });
        }

        button.classList.add('active');
        console.log('[CLUSTERS] Shown - Background markers hidden');
    } else {
        // Hide clusters - show background markers, hide spotlight markers
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

        // Show and enhance background markers when clusters are hidden
        if (simulationEngine.backgroundMarkers) {
            simulationEngine.backgroundMarkers.forEach((marker, id) => {
                if (marker) {
                    // Add to map
                    marker.addTo(map);

                    // Find the complaint data for this marker
                    const complaint = simulationEngine.complaints.find(c => c.id === id);

                    if (complaint && !marker.getPopup()) {
                        // Add popup with complaint details if it doesn't have one
                        const popupContent = createSimpleComplaintPopup(complaint);
                        marker.bindPopup(popupContent, {
                            maxWidth: 300,
                            className: 'background-marker-popup-container'
                        });

                        // v3.7: Load street-level location when popup opens
                        marker.on('popupopen', async function () {
                            const streetElements = document.querySelectorAll('.complaint-street-location');
                            for (const element of streetElements) {
                                const streetValue = element.querySelector('.street-value');
                                if (streetValue && streetValue.textContent.includes('Loading')) {
                                    const lat = parseFloat(element.dataset.lat);
                                    const lng = parseFloat(element.dataset.lng);
                                    if (!isNaN(lat) && !isNaN(lng)) {
                                        try {
                                            const address = await reverseGeocode(lat, lng);
                                            if (address && address.street) {
                                                streetValue.innerHTML = `<strong>${address.street}</strong> <span class="street-barangay">(${address.suburb || getJurisdiction(lat, lng)})</span>`;
                                            } else if (address && address.suburb) {
                                                streetValue.innerHTML = `<span class="street-barangay">${address.suburb}</span> <span class="no-street">(no street name)</span>`;
                                            } else {
                                                streetValue.innerHTML = '<span class="no-street">Street name unavailable</span>';
                                            }
                                        } catch (error) {
                                            streetValue.innerHTML = '<span class="no-street">Geocoding failed</span>';
                                        }
                                    }
                                }
                            }
                        });
                    }
                }
            });
        }

        button.classList.remove('active');
        console.log('[CLUSTERS] Hidden - Background markers shown with popups');
    }
}

/**
 * v4.1: Initialize Map Layers Dropdown
 * Consolidates visualization toggles into a single dropdown for cleaner header.
 * Handles: Heatmap toggle, Clusters toggle, Causal Analysis, Emergency Panel
 */
function initMapLayersDropdown() {
    const dropdownBtn = document.getElementById('mapLayersToggle');
    const dropdownMenu = document.getElementById('layersDropdownMenu');
    const heatmapSwitch = document.getElementById('heatmapSwitch');
    const clustersSwitch = document.getElementById('clustersSwitch');
    const causalItem = document.getElementById('causalAnalysisItem');
    const emergencyItem = document.getElementById('emergencyPanelItem');

    if (!dropdownBtn || !dropdownMenu) {
        console.warn('[MAP LAYERS] Dropdown elements not found');
        return;
    }

    console.log('[MAP LAYERS v4.1] Initializing consolidated dropdown');

    // Toggle dropdown visibility
    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdownMenu.classList.contains('show');

        if (isOpen) {
            dropdownMenu.classList.remove('show');
            dropdownBtn.classList.remove('active');
        } else {
            dropdownMenu.classList.add('show');
            dropdownBtn.classList.add('active');
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.map-layers-dropdown')) {
            dropdownMenu.classList.remove('show');
            dropdownBtn.classList.remove('active');
        }
    });

    // Heatmap toggle via switch
    if (heatmapSwitch) {
        heatmapSwitch.addEventListener('change', () => {
            toggleHeatmapFromDropdown(heatmapSwitch.checked);
        });

        // Also allow clicking anywhere on the item row
        document.getElementById('toggleHeatmapItem').addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
                heatmapSwitch.checked = !heatmapSwitch.checked;
                toggleHeatmapFromDropdown(heatmapSwitch.checked);
            }
        });
    }

    // Clusters toggle via switch
    if (clustersSwitch) {
        clustersSwitch.addEventListener('change', () => {
            toggleClustersFromDropdown(clustersSwitch.checked);
        });

        // Also allow clicking anywhere on the item row
        document.getElementById('toggleClustersItem').addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
                clustersSwitch.checked = !clustersSwitch.checked;
                toggleClustersFromDropdown(clustersSwitch.checked);
            }
        });
    }

    // Causal Analysis action
    if (causalItem) {
        causalItem.addEventListener('click', () => {
            // Check if data is loaded
            if (!simulationEngine || !simulationEngine.complaints || simulationEngine.complaints.length === 0) {
                console.warn('[CAUSAL] No data loaded - cannot run analysis');
                showToast('Load city data first to run causal analysis', 'warning');
                return;
            }

            // Close dropdown and run analysis
            dropdownMenu.classList.remove('show');
            dropdownBtn.classList.remove('active');
            runCausalAnalysis();
        });
    }

    // Emergency Panel toggle
    if (emergencyItem) {
        emergencyItem.addEventListener('click', () => {
            // Close dropdown
            dropdownMenu.classList.remove('show');
            dropdownBtn.classList.remove('active');

            // Toggle emergency panel visibility
            toggleEmergencyPanel();
        });
    }

    console.log('[MAP LAYERS v4.1] Dropdown initialized successfully');
}

/**
 * Toggle heatmap from dropdown switch
 * @param {boolean} show - Whether to show heatmap
 */
function toggleHeatmapFromDropdown(show) {
    if (heatmapLayer) {
        if (show && !map.hasLayer(heatmapLayer)) {
            map.addLayer(heatmapLayer);
            console.log('[HEATMAP] Shown via dropdown');
        } else if (!show && map.hasLayer(heatmapLayer)) {
            map.removeLayer(heatmapLayer);
            console.log('[HEATMAP] Hidden via dropdown');
        }
    } else if (show) {
        console.warn('[HEATMAP] Layer not yet created - load data first');
        // Reset switch
        const heatmapSwitch = document.getElementById('heatmapSwitch');
        if (heatmapSwitch) heatmapSwitch.checked = false;
    }
}

/**
 * Toggle clusters from dropdown switch
 * @param {boolean} show - Whether to show clusters
 */
function toggleClustersFromDropdown(show) {
    if (!simulationEngine) {
        console.warn('[CLUSTERS] Simulation engine not initialized');
        const clustersSwitch = document.getElementById('clustersSwitch');
        if (clustersSwitch) clustersSwitch.checked = true; // Reset to default
        return;
    }

    clustersVisible = show;

    if (clustersVisible) {
        // Show clusters - hide background markers, show spotlight markers
        simulationEngine.spotlightMarkers.forEach(marker => {
            if (marker && map) marker.addTo(map);
        });

        simulationEngine.connectionLines.forEach(line => {
            if (line && map) line.addTo(map);
        });

        // Hide background markers
        if (simulationEngine.backgroundMarkers) {
            simulationEngine.backgroundMarkers.forEach(marker => {
                if (marker && map.hasLayer(marker)) map.removeLayer(marker);
            });
        }

        console.log('[CLUSTERS] Shown via dropdown');
    } else {
        // Hide clusters - show background markers
        simulationEngine.spotlightMarkers.forEach(marker => {
            if (marker && map.hasLayer(marker)) map.removeLayer(marker);
        });

        simulationEngine.connectionLines.forEach(line => {
            if (line && map.hasLayer(line)) map.removeLayer(line);
        });

        // Show background markers
        if (simulationEngine.backgroundMarkers) {
            simulationEngine.backgroundMarkers.forEach((marker, id) => {
                if (marker) {
                    marker.addTo(map);

                    // Bind popup if needed
                    const complaint = simulationEngine.complaints.find(c => c.id === id);
                    if (complaint && !marker.getPopup()) {
                        const popupContent = createSimpleComplaintPopup(complaint);
                        marker.bindPopup(popupContent, {
                            maxWidth: 300,
                            className: 'background-marker-popup-container'
                        });
                    }
                }
            });
        }

        console.log('[CLUSTERS] Hidden via dropdown - Background markers shown');
    }
}

/**
 * Toggle Emergency Panel visibility
 */
function toggleEmergencyPanel() {
    const panel = document.getElementById('emergencyPanel');
    if (!panel) {
        console.warn('[EMERGENCY] Panel element not found');
        return;
    }

    const isVisible = panel.classList.contains('visible');

    if (isVisible) {
        panel.classList.remove('visible');
        console.log('[EMERGENCY] Panel hidden');
    } else {
        panel.classList.add('visible');
        console.log('[EMERGENCY] Panel shown');
    }
}

/**
 * Update emergency count badge in dropdown
 * Called when emergency complaints change
 * @param {number} count - Number of emergencies
 */
function updateEmergencyDropdownBadge(count) {
    const badge = document.getElementById('emergencyCountDropdown');
    if (badge) {
        badge.textContent = count;
        if (count > 0) {
            badge.classList.add('has-emergencies');
        } else {
            badge.classList.remove('has-emergencies');
        }
    }
}

// Export for use by emergency panel
window.updateEmergencyDropdownBadge = updateEmergencyDropdownBadge;

/**
 * Create a simple popup for background markers when clusters are hidden.
 * Uses the unified generateComplaintPopupHTML for consistency.
 * @param {Object} complaint - The complaint object
 * @returns {string} HTML popup content
 */
function createSimpleComplaintPopup(complaint) {
    // Use the unified popup generator without cluster context
    // This ensures individual complaint data is always shown correctly
    return generateComplaintPopupHTML(complaint, null, '#6b7280', null);
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
    'Pothole': 'road segment',
    'Road Damage': 'road segment',
    'Road Obstruction': 'road stretch',
    'Infrastructure': 'infrastructure zone',
    'Bridge Collapse': 'structural hazard zone',

    // Traffic & Transport
    'Traffic': 'congestion zone',
    'Accident': 'incident radius',

    // Water & Flooding
    'Flood': 'inundation zone',
    'Flooding': 'inundation zone',
    'Pipe Leak': 'water supply segment',
    'No Water': 'service outage zone',

    // Fire & Safety
    'Fire': 'hazard radius',
    'Crime': 'incident zone',
    'Public Safety': 'safety concern zone',

    // Sanitation & Environment
    'Garbage': 'dumping area',
    'Trash': 'waste accumulation zone',
    'Illegal Dumping': 'dumping ground',
    'Bad Odor': 'affected perimeter',

    // Utilities
    'Blackout': 'power outage zone',
    'Streetlight': 'dark zone',
    'Broken Streetlight': 'unlit stretch',

    // Noise & Disturbance
    'Noise': 'disturbance radius',
    'Noise Complaint': 'noise zone',

    // Default
    'Default': 'affected area'
};

/**
 * Detect cluster type and generate human-readable explanation.
 * This is the "Glass Box" feature that explains WHY the AI grouped complaints.
 * 
 * v3.7.2 UPGRADE: Now includes physical span measurement and semantic context.
 * 
 * @param {Array} cluster - Array of complaints in this cluster
 * @returns {Object} { type, emoji, title, explanation, causalPair, span, contextNoun }
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
        sizeDescription = 'localized spot (~' + spanRounded + 'm)';
    } else if (spanMeters < 50) {
        sizeDescription = 'small cluster (~' + spanRounded + 'm span)';
    } else if (spanMeters < 150) {
        sizeDescription = 'medium zone (~' + spanRounded + 'm span)';
    } else {
        sizeDescription = 'large area (~' + spanRounded + 'm span)';
    }

    // Get dominant category
    const allCategories = cluster.map(p => p.subcategory || p.category);
    const dominantCategory = getMode(allCategories) || 'Unknown';

    // Get semantic context noun
    const contextNoun = CATEGORY_CONTEXT_NOUNS[dominantCategory] || CATEGORY_CONTEXT_NOUNS['Default'];

    // Get street names from geocoded data (if available)
    const streetNames = cluster
        .map(p => p.geocodedAddress?.street)
        .filter(s => s);
    const dominantStreet = getMode(streetNames);
    const locationPhrase = dominantStreet
        ? `along ${dominantStreet}`
        : `in ${getJurisdiction(cluster[0]?.latitude, cluster[0]?.longitude) || 'the mapped sector'}`;

    // Density adjective
    const densityAdjective = cluster.length > 8 ? 'Critical density of' :
        cluster.length > 5 ? 'High concentration of' :
            'Cluster of';

    // Check for causal chain (multi-category incident)
    // v3.9.1: Only detect causal chains if Phase 2 analysis has been triggered
    if (categories.length >= 2 && causalAnalysisEnabled) {
        // Use the RELATIONSHIP_MATRIX to find causal connections
        const causalPairs = findCausalPairs(categories);

        if (causalPairs.length > 0) {
            const primaryPair = causalPairs[0];

            // v3.7.2: Build multi-chain explanation if multiple pairs detected
            let chainExplanation;
            if (causalPairs.length > 1) {
                // Multiple chains: "Illegal Dumping → Overflowing Trash → Bad Odor"
                const chainParts = causalPairs.slice(0, 3).map(p => `"${p.cause}" → "${p.effect}"`);
                chainExplanation = `${densityAdjective} linked reports ${locationPhrase} covering a ${contextNoun} of ~${spanRounded}m. ${causalPairs.length} causal links detected: ${chainParts.join(', ')}. System suggests a cascading incident.`;
            } else {
                chainExplanation = `${densityAdjective} linked reports ${locationPhrase} covering a ${contextNoun} of ~${spanRounded}m. "${primaryPair.cause}" → "${primaryPair.effect}" pattern detected (${Math.round(primaryPair.correlation * 100)}% correlation). System suggests a single cascading incident.`;
            }

            return {
                type: 'causal-chain',
                emoji: '🔗',
                title: 'CAUSAL CHAIN DETECTED',
                explanation: chainExplanation,
                causalPair: primaryPair,
                allCausalPairs: causalPairs,  // v3.7.2: Include ALL detected pairs
                allCategories: categories,
                span: spanRounded,
                sizeDescription: sizeDescription,
                contextNoun: contextNoun,
                street: dominantStreet
            };
        }

        // Multiple categories but no known causal link
        return {
            type: 'multi-issue',
            emoji: '📋',
            title: 'MULTI-ISSUE ZONE',
            explanation: `${densityAdjective} ${categories.length} issue types ${locationPhrase} covering ~${spanRounded}m (${categories.join(', ')}). Multi-department coordination may be required.`,
            causalPair: null,
            allCausalPairs: [],
            allCategories: categories,
            span: spanRounded,
            sizeDescription: sizeDescription,
            contextNoun: contextNoun,
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
        type: 'spatial-hotspot',
        emoji: '📍',
        title: 'SPATIAL HOTSPOT',
        explanation: explanation,
        causalPair: null,
        allCategories: categories,
        span: spanRounded,
        sizeDescription: sizeDescription,
        contextNoun: contextNoun,
        street: dominantStreet
    };
}

// Export for global access
window.calculateClusterSpan = calculateClusterSpan;
window.getMode = getMode;
window.CATEGORY_CONTEXT_NOUNS = CATEGORY_CONTEXT_NOUNS;

/**
 * Find causal pairs between categories using RELATIONSHIP_MATRIX
 * v3.7.3: Comprehensive causal link database covering all category relationships
 */
function findCausalPairs(categories) {
    const knownCausalLinks = (window.CitizenLinkBrainConfig && window.CitizenLinkBrainConfig.correlations && window.CitizenLinkBrainConfig.correlations.knownCausalLinks)
        ? window.CitizenLinkBrainConfig.correlations.knownCausalLinks
        : [
        // ================================================================
        // WATER & FLOODING CHAIN
        // ================================================================
        { cause: 'Pipe Leak', effect: 'Flooding', correlation: 0.92 },
        { cause: 'Pipe Leak', effect: 'Flood', correlation: 0.92 },
        { cause: 'Pipe Leak', effect: 'No Water', correlation: 0.85 },
        { cause: 'Pipe Leak', effect: 'Low Pressure', correlation: 0.80 },
        { cause: 'Pipe Leak', effect: 'Road Damage', correlation: 0.55 },
        { cause: 'Flooding', effect: 'Traffic', correlation: 0.85 },
        { cause: 'Flood', effect: 'Traffic', correlation: 0.85 },
        { cause: 'Flooding', effect: 'Traffic Congestion', correlation: 0.88 },
        { cause: 'Flood', effect: 'Traffic Congestion', correlation: 0.88 },
        { cause: 'Flooding', effect: 'Road Obstruction', correlation: 0.90 },
        { cause: 'Flood', effect: 'Road Obstruction', correlation: 0.90 },
        { cause: 'Flooding', effect: 'Traffic Light Issue', correlation: 0.60 },
        { cause: 'Flood', effect: 'Traffic Light Issue', correlation: 0.60 },
        { cause: 'Flooding', effect: 'Road Damage', correlation: 0.65 },
        { cause: 'Flood', effect: 'Road Damage', correlation: 0.65 },
        { cause: 'Flooding', effect: 'Accident', correlation: 0.60 },
        { cause: 'Flood', effect: 'Accident', correlation: 0.60 },
        { cause: 'Flooding', effect: 'Stranded', correlation: 0.75 },
        { cause: 'Flood', effect: 'Stranded', correlation: 0.75 },
        { cause: 'Flooding', effect: 'Evacuation', correlation: 0.70 },
        { cause: 'Flood', effect: 'Evacuation', correlation: 0.70 },
        { cause: 'Heavy Rain', effect: 'Flooding', correlation: 0.90 },
        { cause: 'Heavy Rain', effect: 'Flood', correlation: 0.90 },
        { cause: 'Heavy Rain', effect: 'Traffic', correlation: 0.75 },
        { cause: 'Heavy Rain', effect: 'Accident', correlation: 0.70 },
        { cause: 'Clogged Drainage', effect: 'Flooding', correlation: 0.88 },
        { cause: 'Clogged Drainage', effect: 'Flood', correlation: 0.88 },
        { cause: 'Clogged Canal', effect: 'Flooding', correlation: 0.85 },
        { cause: 'Clogged Canal', effect: 'Flood', correlation: 0.85 },

        // ================================================================
        // INFRASTRUCTURE & ROAD CHAIN
        // ================================================================
        { cause: 'Pothole', effect: 'Road Damage', correlation: 0.75 },
        { cause: 'Pothole', effect: 'Accident', correlation: 0.65 },
        { cause: 'Pothole', effect: 'Traffic', correlation: 0.55 },
        { cause: 'Road Damage', effect: 'Traffic', correlation: 0.70 },
        { cause: 'Road Damage', effect: 'Accident', correlation: 0.65 },
        { cause: 'Road Obstruction', effect: 'Traffic', correlation: 0.85 },
        { cause: 'Road Obstruction', effect: 'Traffic Congestion', correlation: 0.90 },
        { cause: 'Road Obstruction', effect: 'Accident', correlation: 0.60 },
        { cause: 'Fallen Tree', effect: 'Road Obstruction', correlation: 0.90 },
        { cause: 'Fallen Tree', effect: 'Traffic', correlation: 0.80 },
        { cause: 'Fallen Tree', effect: 'Blackout', correlation: 0.70 },
        { cause: 'Landslide', effect: 'Road Obstruction', correlation: 0.95 },
        { cause: 'Landslide', effect: 'Traffic', correlation: 0.85 },
        { cause: 'Landslide', effect: 'Evacuation', correlation: 0.80 },
        { cause: 'Bridge Collapse', effect: 'Traffic', correlation: 0.95 },
        { cause: 'Bridge Collapse', effect: 'Stranded', correlation: 0.85 },
        { cause: 'Construction', effect: 'Traffic', correlation: 0.75 },
        { cause: 'Construction', effect: 'Noise', correlation: 0.80 },
        { cause: 'Construction', effect: 'Road Obstruction', correlation: 0.70 },

        // ================================================================
        // SANITATION & WASTE CHAIN
        // ================================================================
        { cause: 'Trash', effect: 'Bad Odor', correlation: 0.80 },
        { cause: 'Overflowing Trash', effect: 'Bad Odor', correlation: 0.85 },
        { cause: 'Garbage', effect: 'Bad Odor', correlation: 0.78 },
        { cause: 'Illegal Dumping', effect: 'Bad Odor', correlation: 0.75 },
        { cause: 'Illegal Dumping', effect: 'Overflowing Trash', correlation: 0.70 },
        { cause: 'Illegal Dumping', effect: 'Clogged Drainage', correlation: 0.65 },
        { cause: 'Trash', effect: 'Stray Dog', correlation: 0.65 },
        { cause: 'Overflowing Trash', effect: 'Stray Dog', correlation: 0.60 },
        { cause: 'Garbage', effect: 'Stray Dog', correlation: 0.60 },
        { cause: 'Trash', effect: 'Pest Infestation', correlation: 0.75 },
        { cause: 'Garbage', effect: 'Pest Infestation', correlation: 0.75 },
        { cause: 'Trash', effect: 'Clogged Drainage', correlation: 0.60 },
        { cause: 'Dead Animal', effect: 'Bad Odor', correlation: 0.90 },
        { cause: 'Dead Animal', effect: 'Health Hazard', correlation: 0.85 },
        { cause: 'Sewage Leak', effect: 'Bad Odor', correlation: 0.92 },
        { cause: 'Sewage Leak', effect: 'Health Hazard', correlation: 0.85 },
        { cause: 'Sewage Leak', effect: 'Flooding', correlation: 0.60 },

        // ================================================================
        // FIRE & EMERGENCY CHAIN
        // ================================================================
        { cause: 'Fire', effect: 'Traffic', correlation: 0.80 },
        { cause: 'Fire', effect: 'Smoke', correlation: 0.95 },
        { cause: 'Fire', effect: 'Evacuation', correlation: 0.90 },
        { cause: 'Fire', effect: 'Road Obstruction', correlation: 0.70 },
        { cause: 'Fire', effect: 'Blackout', correlation: 0.55 },
        { cause: 'Fire', effect: 'Public Safety', correlation: 0.85 },
        { cause: 'Smoke', effect: 'Health Hazard', correlation: 0.80 },
        { cause: 'Smoke', effect: 'Traffic', correlation: 0.60 },
        { cause: 'Explosion', effect: 'Fire', correlation: 0.85 },
        { cause: 'Explosion', effect: 'Evacuation', correlation: 0.90 },
        { cause: 'Explosion', effect: 'Public Safety', correlation: 0.95 },
        { cause: 'Gas Leak', effect: 'Fire', correlation: 0.75 },
        { cause: 'Gas Leak', effect: 'Explosion', correlation: 0.70 },
        { cause: 'Gas Leak', effect: 'Evacuation', correlation: 0.80 },

        // ================================================================
        // ACCIDENT & TRAFFIC CHAIN
        // ================================================================
        { cause: 'Accident', effect: 'Traffic', correlation: 0.90 },
        { cause: 'Accident', effect: 'Road Obstruction', correlation: 0.75 },
        { cause: 'Accident', effect: 'Medical', correlation: 0.70 },
        { cause: 'Accident', effect: 'Public Safety', correlation: 0.65 },
        { cause: 'Vehicle Breakdown', effect: 'Traffic', correlation: 0.70 },
        { cause: 'Vehicle Breakdown', effect: 'Road Obstruction', correlation: 0.65 },
        { cause: 'Reckless Driving', effect: 'Accident', correlation: 0.80 },
        { cause: 'Reckless Driving', effect: 'Public Safety', correlation: 0.70 },
        { cause: 'Drunk Driving', effect: 'Accident', correlation: 0.85 },
        { cause: 'Traffic', effect: 'Air Pollution', correlation: 0.65 },
        { cause: 'Traffic', effect: 'Noise', correlation: 0.60 },

        // ================================================================
        // UTILITIES & POWER CHAIN
        // ================================================================
        { cause: 'Blackout', effect: 'Crime', correlation: 0.65 },
        { cause: 'Blackout', effect: 'Accident', correlation: 0.55 },
        { cause: 'Blackout', effect: 'Traffic', correlation: 0.60 },
        { cause: 'Blackout', effect: 'Public Safety', correlation: 0.70 },
        { cause: 'Broken Streetlight', effect: 'Crime', correlation: 0.60 },
        { cause: 'Broken Streetlight', effect: 'Accident', correlation: 0.55 },
        { cause: 'Broken Streetlight', effect: 'Public Safety', correlation: 0.65 },
        { cause: 'Streetlight', effect: 'Crime', correlation: 0.55 },
        { cause: 'Streetlight', effect: 'Accident', correlation: 0.50 },
        { cause: 'Power Line Down', effect: 'Blackout', correlation: 0.90 },
        { cause: 'Power Line Down', effect: 'Fire', correlation: 0.60 },
        { cause: 'Power Line Down', effect: 'Public Safety', correlation: 0.85 },
        { cause: 'Transformer Explosion', effect: 'Blackout', correlation: 0.95 },
        { cause: 'Transformer Explosion', effect: 'Fire', correlation: 0.70 },
        { cause: 'No Water', effect: 'Fire', correlation: 0.40 },
        { cause: 'No Water', effect: 'Health Hazard', correlation: 0.55 },

        // ================================================================
        // CRIME & SAFETY CHAIN
        // ================================================================
        { cause: 'Crime', effect: 'Public Safety', correlation: 0.85 },
        { cause: 'Robbery', effect: 'Crime', correlation: 0.95 },
        { cause: 'Robbery', effect: 'Public Safety', correlation: 0.80 },
        { cause: 'Theft', effect: 'Crime', correlation: 0.90 },
        { cause: 'Vandalism', effect: 'Crime', correlation: 0.75 },
        { cause: 'Vandalism', effect: 'Broken Streetlight', correlation: 0.60 },
        { cause: 'Drug Activity', effect: 'Crime', correlation: 0.85 },
        { cause: 'Drug Activity', effect: 'Public Safety', correlation: 0.80 },
        { cause: 'Gunshot', effect: 'Crime', correlation: 0.90 },
        { cause: 'Gunshot', effect: 'Public Safety', correlation: 0.95 },
        { cause: 'Assault', effect: 'Crime', correlation: 0.90 },
        { cause: 'Assault', effect: 'Medical', correlation: 0.70 },
        { cause: 'Trespassing', effect: 'Crime', correlation: 0.70 },
        { cause: 'Loitering', effect: 'Public Safety', correlation: 0.50 },
        { cause: 'Gang Activity', effect: 'Crime', correlation: 0.90 },
        { cause: 'Gang Activity', effect: 'Public Safety', correlation: 0.85 },

        // ================================================================
        // NOISE & DISTURBANCE CHAIN
        // ================================================================
        { cause: 'Noise', effect: 'Public Safety', correlation: 0.45 },
        { cause: 'Noise Complaint', effect: 'Public Safety', correlation: 0.45 },
        { cause: 'Loud Music', effect: 'Noise', correlation: 0.90 },
        { cause: 'Loud Party', effect: 'Noise', correlation: 0.90 },
        { cause: 'Karaoke', effect: 'Noise', correlation: 0.85 },
        { cause: 'Barking Dog', effect: 'Noise', correlation: 0.75 },
        { cause: 'Construction', effect: 'Noise', correlation: 0.80 },

        // ================================================================
        // ANIMAL & HEALTH CHAIN
        // ================================================================
        { cause: 'Stray Dog', effect: 'Public Safety', correlation: 0.60 },
        { cause: 'Stray Dog', effect: 'Noise', correlation: 0.55 },
        { cause: 'Stray Animal', effect: 'Public Safety', correlation: 0.55 },
        { cause: 'Snake Sighting', effect: 'Public Safety', correlation: 0.75 },
        { cause: 'Pest Infestation', effect: 'Health Hazard', correlation: 0.80 },
        { cause: 'Mosquito Breeding', effect: 'Health Hazard', correlation: 0.85 },
        { cause: 'Dengue', effect: 'Health Hazard', correlation: 0.95 },
        { cause: 'Stagnant Water', effect: 'Mosquito Breeding', correlation: 0.85 },
        { cause: 'Stagnant Water', effect: 'Bad Odor', correlation: 0.65 },

        // ================================================================
        // STRUCTURAL & BUILDING CHAIN
        // ================================================================
        { cause: 'Building Collapse', effect: 'Evacuation', correlation: 0.95 },
        { cause: 'Building Collapse', effect: 'Road Obstruction', correlation: 0.80 },
        { cause: 'Building Collapse', effect: 'Rescue', correlation: 0.90 },
        { cause: 'Earthquake', effect: 'Building Collapse', correlation: 0.75 },
        { cause: 'Earthquake', effect: 'Evacuation', correlation: 0.85 },
        { cause: 'Earthquake', effect: 'Fire', correlation: 0.55 },
        { cause: 'Illegal Construction', effect: 'Building Collapse', correlation: 0.60 },
        { cause: 'Illegal Construction', effect: 'Public Safety', correlation: 0.65 },

        // ================================================================
        // ENVIRONMENTAL CHAIN
        // ================================================================
        { cause: 'Air Pollution', effect: 'Health Hazard', correlation: 0.75 },
        { cause: 'Water Pollution', effect: 'Health Hazard', correlation: 0.80 },
        { cause: 'Burning Trash', effect: 'Smoke', correlation: 0.90 },
        { cause: 'Burning Trash', effect: 'Air Pollution', correlation: 0.85 },
        { cause: 'Burning Trash', effect: 'Fire', correlation: 0.55 },
        { cause: 'Open Burning', effect: 'Smoke', correlation: 0.90 },
        { cause: 'Open Burning', effect: 'Air Pollution', correlation: 0.85 }
    ];

    const foundPairs = [];

    for (const link of knownCausalLinks) {
        if (categories.includes(link.cause) && categories.includes(link.effect)) {
            foundPairs.push(link);
        }
    }

    // Sort by correlation score (strongest first)
    return foundPairs.sort((a, b) => b.correlation - a.correlation);
}

/**
 * Get adaptive epsilon for a category (used in explanations)
 */
function getAdaptiveEpsilonForCategory(category) {
    const epsilonMap = {
        'Pipe Leak': 25, 'Flooding': 40, 'Flood': 40, 'No Water': 40,
        'Pothole': 30, 'Road Damage': 40, 'Infrastructure': 40,
        'Trash': 35, 'Illegal Dumping': 35, 'Sanitation': 35,
        'Fire': 60, 'Public Safety': 50, 'Traffic': 60
    };
    return epsilonMap[category] || 40;
}

/**
 * v3.9: Generate tooltip HTML explaining how Triage Score was calculated.
 * Provides detailed breakdown with explanations for each component.
 * 
 * @param {Object} intelligence - Intelligence result from analyzeComplaintIntelligence()
 * @returns {string} HTML string for the tooltip content
 */
function generateTriageTooltip(intelligence) {
    if (!intelligence || !intelligence.breakdown) {
        return '<div class="triage-tooltip">No intelligence data available.</div>';
    }

    const bd = intelligence.breakdown;
    const finalScore = intelligence.urgencyScore;

    // Determine tier explanation based on base score
    let tierExplanation = '';
    if (bd.base === 50) {
        tierExplanation = 'Tier 1 (Life-threatening): Fire, Accident, Crime';
    } else if (bd.base === 30) {
        tierExplanation = 'Tier 2 (Urgent): Flood, Medical, Public Safety';
    } else if (bd.base === 10) {
        tierExplanation = 'Tier 3 (Routine): Pothole, Garbage, Traffic';
    } else {
        tierExplanation = `Category-based score`;
    }

    // Build panic explanation
    let panicExplanation = '';
    if (bd.panic > 0) {
        const panicDetails = [];
        if (bd.panic >= 10) panicDetails.push('CAPS LOCK detected (+10)');
        if (bd.panic >= 5 && bd.panic < 10) panicDetails.push('Multiple !!! detected (+5)');
        if (bd.panic > 0 && bd.panic < 5) panicDetails.push('Fear keywords detected (+2)');
        panicExplanation = panicDetails.join(', ') || 'Panic signals detected';
    }

    // Build veracity explanation
    let veracityExplanation = '';
    if (bd.veracity < 0) {
        veracityExplanation = 'Short description (&lt;3 words) = UNVERIFIED';
    } else if (bd.veracity > 0) {
        veracityExplanation = 'Detailed description (≥5 words) = HIGH CONFIDENCE';
    } else {
        veracityExplanation = 'Standard length description';
    }

    // Build cap explanation
    let capExplanation = '';
    if (bd.isCapped) {
        if (bd.overrideType === 'TRAFFIC_CONTEXT') {
            capExplanation = 'Traffic-related context detected → Max 35 pts';
        } else if (bd.overrideType === 'MAINTENANCE_CONTEXT') {
            capExplanation = 'Infrastructure/maintenance context detected → Max 30 pts';
        } else {
            capExplanation = 'Context suppression applied → Score capped';
        }
    }

    // Build the calculation string
    let calculationParts = [`${bd.base}`];
    if (bd.panic > 0) calculationParts.push(`+${bd.panic}`);
    if (bd.veracity !== 0) calculationParts.push(`${bd.veracity > 0 ? '+' : ''}${bd.veracity}`);
    if (bd.emergencyBoost) calculationParts.push(`+${bd.emergencyBoost.amount}`);
    if (bd.geospatialBoost) calculationParts.push(`+${bd.geospatialBoost.boost}`);

    const rawScore = bd.originalScore || finalScore;
    const calculationStr = calculationParts.join(' ') + ` = ${rawScore}`;

    return `
        <div class="triage-tooltip">
            <div class="tooltip-title">
                <i class="fas fa-calculator"></i> Score Calculation Explained
            </div>
            
            <div class="tooltip-formula">
                ${calculationStr}${bd.isCapped ? ` → CAPPED to ${finalScore}` : ''}
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
                ` : ''}
                
                ${bd.veracity !== 0 ? `
                <div class="tooltip-item">
                    <span class="tooltip-item-label">✓ Veracity</span>
                    <span class="tooltip-item-value ${bd.veracity < 0 ? 'penalty' : ''}">${bd.veracity > 0 ? '+' : ''}${bd.veracity}</span>
                </div>
                <div class="tooltip-item" style="padding-left: 12px; font-size: 9px; color: #94a3b8;">
                    ${veracityExplanation}
                </div>
                ` : ''}
                
                ${bd.emergencyBoost ? `
                <div class="tooltip-item">
                    <span class="tooltip-item-label">🔥 Emergency Boost</span>
                    <span class="tooltip-item-value">+${bd.emergencyBoost.amount}</span>
                </div>
                <div class="tooltip-item" style="padding-left: 12px; font-size: 9px; color: #94a3b8;">
                    ${bd.emergencyBoost.reason || 'Critical category detected'}
                </div>
                ` : ''}
                
                ${bd.geospatialBoost ? `
                <div class="tooltip-item">
                    <span class="tooltip-item-label">${bd.geospatialBoost.type === 'HIGHWAY_PRIORITY' ? '🛣️' : '🌊'} Geo Boost</span>
                    <span class="tooltip-item-value">+${bd.geospatialBoost.boost}</span>
                </div>
                <div class="tooltip-item" style="padding-left: 12px; font-size: 9px; color: #94a3b8;">
                    ${bd.geospatialBoost.type === 'HIGHWAY_PRIORITY' ? 'Highway/major road location' : 'Near water feature (flood risk)'}
                </div>
                ` : ''}
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
                    ${capExplanation}${bd.matchedContext ? ` (matched: "${bd.matchedContext}")` : ''}
                </div>
            </div>
            ` : ''}
            
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
function generateComplaintPopupHTML(point, clusterId = null, clusterColor = '#6b7280', dominantCategory = null) {
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
    const intelligence = window.analyzeComplaintIntelligence ?
        window.analyzeComplaintIntelligence(point) : null;

    // DEBUG: Log to console to verify score-based coloring is working
    console.log('[POPUP v3.7] Category:', point.category, '| Description:', point.description?.substring(0, 50) + '...');
    console.log('[POPUP v3.7] Intelligence:', intelligence ? `Score=${intelligence.urgencyScore}, GeoBoost=${intelligence.breakdown.geospatialBoost?.type || 'none'}` : 'NULL!');

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
    const timestamp = new Date(point.timestamp).toLocaleString('en-PH', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // ================================================================
    // SCORE-BASED COLORING [cite: 14]
    // ================================================================
    let headerColor = '#3b82f6'; // Default: Blue (Routine)
    let headerClass = 'header-routine';
    let urgencyLevel = 'ROUTINE';

    if (intelligence) {
        if (intelligence.urgencyScore >= 70) {
            headerColor = '#ef4444'; // Red (Emergency)
            headerClass = 'header-emergency';
            urgencyLevel = 'EMERGENCY';
        } else if (intelligence.urgencyScore >= 40) {
            headerColor = '#f59e0b'; // Yellow (Priority)
            headerClass = 'header-warning';
            urgencyLevel = 'PRIORITY';
        } else {
            headerColor = '#3b82f6'; // Blue (Routine)
            headerClass = 'header-routine';
            urgencyLevel = 'ROUTINE';
        }
    }

    // ================================================================
    // BUILD UI COMPONENTS
    // ================================================================

    // Veracity Badge (for header)
    let veracityBadgeHTML = '';
    if (intelligence) {
        const badgeClass = intelligence.veracityLabel === 'UNVERIFIED' ? 'badge-warning' :
            intelligence.veracityLabel === 'HIGH CONFIDENCE' ? 'badge-success' :
                intelligence.veracityLabel === 'MAINTENANCE' ? 'badge-maintenance' : 'badge-moderate';
        const badgeIcon = intelligence.veracityLabel === 'UNVERIFIED' ? 'exclamation-circle' :
            intelligence.veracityLabel === 'HIGH CONFIDENCE' ? 'check-circle' :
                intelligence.veracityLabel === 'MAINTENANCE' ? 'wrench' : 'info-circle';

        veracityBadgeHTML = `
            <span class="veracity-badge ${badgeClass}">
                <i class="fas fa-${badgeIcon}"></i> ${intelligence.veracityLabel}
            </span>
        `;
    }

    // Cluster Banner (LEFT COLUMN - Part A)
    let clusterBannerHTML = '';
    if (clusterId) {
        clusterBannerHTML = `
            <div class="popup-cluster-banner">
                <i class="fas fa-chart-pie"></i> Part of Cluster #${clusterId}
            </div>
        `;
    }

    // Urgency Score Panel (RIGHT COLUMN - Part A)
    let urgencyScoreHTML = '';
    if (intelligence) {
        const isCapped = intelligence.breakdown.isCapped;
        const urgencyClass = intelligence.urgencyScore >= 70 ? 'urgency-high' :
            intelligence.urgencyScore >= 40 ? 'urgency-medium' : 'urgency-low';
        const displayClass = isCapped ? 'urgency-capped' : urgencyClass;
        const originalScoreHTML = isCapped && intelligence.breakdown.originalScore > intelligence.urgencyScore ?
            `<span class="original-score">(was ${intelligence.breakdown.originalScore})</span>` : '';

        // v3.6.1: Build emergency boost display if present
        const boostHTML = intelligence.breakdown.emergencyBoost
            ? `<span class="breakdown-item boost">+${intelligence.breakdown.emergencyBoost.amount} 🔥</span>`
            : '';

        // v3.7: Build geospatial boost display if present
        const geoBoostHTML = intelligence.breakdown.geospatialBoost
            ? `<span class="breakdown-item geo-boost">+${intelligence.breakdown.geospatialBoost.boost} ${intelligence.breakdown.geospatialBoost.type === 'HIGHWAY_PRIORITY' ? '🛣️' : '🌊'}</span>`
            : '';

        // v3.9: Build tooltip explanation for triage score
        const tooltipExplanation = generateTriageTooltip(intelligence);

        urgencyScoreHTML = `
            <div class="triage-score-panel">
                <div class="triage-header">
                    <span class="tooltip-trigger">
                        <i class="fas fa-tachometer-alt"></i> TRIAGE SCORE
                        <i class="fas fa-question-circle" style="font-size: 10px; opacity: 0.7;"></i>
                    </span>
                    ${tooltipExplanation}
                </div>
                <div class="triage-display ${displayClass}">
                    <span class="triage-value">${intelligence.urgencyScore}</span>
                    <span class="triage-max">/100</span>
                    ${originalScoreHTML}
                </div>
                <div class="triage-breakdown">
                    <span class="breakdown-item">Base: ${intelligence.breakdown.base}</span>
                    ${intelligence.breakdown.panic > 0 ? `<span class="breakdown-item panic">+${intelligence.breakdown.panic} Panic</span>` : ''}
                    ${intelligence.breakdown.veracity !== 0 ? `<span class="breakdown-item ${intelligence.breakdown.veracity > 0 ? 'bonus' : 'penalty'}">${intelligence.breakdown.veracity > 0 ? '+' : ''}${intelligence.breakdown.veracity} Veracity</span>` : ''}
                    ${intelligence.breakdown.complexity > 0 ? `<span class="breakdown-item bonus">+${intelligence.breakdown.complexity} Complexity</span>` : ''}
                    ${intelligence.breakdown.negation ? `<span class="breakdown-item penalty">🚫 NEGATED ("${intelligence.breakdown.negation}")</span>` : ''}
                    ${boostHTML}
                    ${geoBoostHTML}
                    ${isCapped ? `<span class="breakdown-item capped">CAPPED</span>` : ''}
                </div>
            </div>
        `;
    }

    // Action Box (RIGHT COLUMN - Part B)
    let actionHTML = '';
    if (intelligence) {
        let actionLabel;
        let actionClass;

        if (intelligence.suggestedAction) {
            actionLabel = intelligence.suggestedAction;
            if (intelligence.breakdown.overrideType === 'MAINTENANCE_CONTEXT') {
                actionClass = 'action-engineering';
            } else if (intelligence.breakdown.overrideType === 'TRAFFIC_CONTEXT') {
                actionClass = 'action-traffic';
            } else if (intelligence.breakdown.overrideType === 'NEGATION_OVERRIDE') {
                actionClass = 'action-standard';
            } else {
                actionClass = 'action-standard';
            }
        } else {
            if (intelligence.urgencyScore >= 70) {
                actionLabel = '🚨 PRIORITIZE DISPATCH';
                actionClass = 'action-critical';
            } else if (intelligence.urgencyScore >= 40) {
                actionLabel = '⚡ EXPEDITE RESPONSE';
                actionClass = 'action-warning';
            } else {
                actionLabel = '📋 QUEUE FOR REVIEW';
                actionClass = 'action-standard';
            }
        }

        const contextNote = intelligence.breakdown.isCapped && intelligence.breakdown.matchedContext ?
            `<div class="action-context">📌 Matched: "${intelligence.breakdown.matchedContext}"</div>` : '';

        actionHTML = `
            <div class="action-box ${actionClass}">
                <div class="action-label">RECOMMENDED ACTION</div>
                <div class="action-value">${actionLabel}</div>
                ${contextNote}
            </div>
        `;
    }

    // Merged Warning (RIGHT COLUMN - Part C)
    let mergedWarningHTML = '';
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
    let contextSuppressionWarningHTML = '';
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
    let mismatchAlertHTML = '';
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
                    ${otherDetected.length > 0 ? `<div class="warning-meta">Also detected: ${otherDetected.join(", ")}</div>` : ''}
                </div>
            </div>
        `;
    }

    // ================================================================
    // v4.2: SPATIAL ANOMALY WARNING (Feature 2)
    // Shows specific reason why a complaint is flagged as anomaly
    // ================================================================
    let anomalyWarningHTML = '';
    if (point.road_proximity_anomaly || point.spatial_warning) {
        // Determine specific anomaly reason
        let anomalyReason = '';
        let anomalyIcon = 'exclamation-triangle';

        if (point.road_validation && !point.road_validation.isValid) {
            const distance = point.road_validation.distance;
            if (distance) {
                anomalyReason = `Location is ${Math.round(distance)}m from nearest road (Potential GPS Error)`;
            } else {
                anomalyReason = 'No physical road detected within validation radius';
            }
            anomalyIcon = 'map-marker-alt';
        } else if (point.spatial_warning) {
            anomalyReason = point.spatial_warning;
            anomalyIcon = 'globe-americas';
        } else {
            // Default fallback reason
            anomalyReason = 'Isolated incident location (requires manual verification)';
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
    let aiReasoningHTML = '';
    if (intelligence && intelligence.nlpResult) {
        const nlp = intelligence.nlpResult;
        const matchedKeywords = nlp.matchedKeywords || [];
        const intensifiers = nlp.intensifiers || [];
        const confidence = Math.round((nlp.confidence || intelligence.urgencyScore / 100) * 100);
        const detectedCategory = nlp.category || pointCategory;

        // Build dynamic reasoning sentence
        let reasoningParts = [];

        // Part 1: Classification reason
        if (matchedKeywords.length > 0) {
            const keywordStr = matchedKeywords.slice(0, 3).map(k => `'${k}'`).join(', ');
            reasoningParts.push(`Classified as <strong>${detectedCategory}</strong> (Confidence: ${confidence}%) because text contained ${keywordStr}`);
        } else {
            reasoningParts.push(`Classified as <strong>${detectedCategory}</strong> (Confidence: ${confidence}%)`);
        }

        // Part 2: Urgency modifiers
        if (intensifiers.length > 0) {
            const intensifierStr = intensifiers.slice(0, 2).map(i => `'${i}'`).join(', ');
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
            const geoType = intelligence.breakdown.geospatialBoost.type === 'HIGHWAY_PRIORITY' ? 'highway proximity' : 'flood-prone zone';
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
                    ${reasoningParts.map(part => `<p class="reasoning-line">${part}</p>`).join('')}
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
    ` : '';

    // v4.0: Build Multi-Label Categories display (if multiple categories detected)
    // v4.1: Updated to use horizontal progress bars for relative urgency visualization
    let multiLabelHTML = '';
    if (intelligence && intelligence.nlpResult && intelligence.nlpResult.detectedCategories && intelligence.nlpResult.detectedCategories.length > 1) {
        const detectedCats = intelligence.nlpResult.detectedCategories;
        const maxUrgency = Math.max(...detectedCats.map(dc => dc.urgency || 0));

        const additionalCats = detectedCats.slice(1).map(dc => {
            const urgencyPercent = Math.round((dc.urgency / 100) * 100);
            const relativeWidth = Math.round((dc.urgency / maxUrgency) * 100);
            const urgencyClass = dc.urgency >= 70 ? 'high' : dc.urgency >= 50 ? 'medium' : 'low';

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
        }).join('');

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
    let aiUsedBadge = '';
    if (intelligence && intelligence.nlpResult && intelligence.nlpResult.aiUsed) {
        aiUsedBadge = `
            <span class="ai-fallback-badge" title="TensorFlow.js AI was used for classification">
                <i class="fas fa-brain"></i> AI Enhanced
            </span>
        `;
    }

    return `
        <div class="complaint-popup-v2">
            <!-- ===== HEADER (Full Width - Col-span-12) ===== -->
            <div class="popup-header-v2 ${headerClass}" style="background: ${headerColor};">
                <div class="header-left">
                    <i class="fas fa-clipboard-list"></i>
                    <span class="header-category">${pointCategory}</span>
                    ${reclassifiedBadge}
                    ${aiUsedBadge}
                </div>
                <div class="header-right">
                    ${veracityBadgeHTML}
                </div>
            </div>
            
            <!-- ===== 2-COLUMN GRID CONTAINER ===== -->
            <div class="popup-grid">
                
                <!-- ===== LEFT COLUMN (Col-span-7) - THE CITIZEN REPORT ===== -->
                <div class="popup-col-left">
                    <div class="column-header">
                        <i class="fas fa-user-circle"></i> THE CITIZEN REPORT
                    </div>
                    
                    ${clusterBannerHTML}
                    
                    <!-- What the User Said -->
                    <div class="user-quote-section">
                        <div class="section-label">
                            <i class="fas fa-quote-left"></i> WHAT THE USER SAID
                        </div>
                        <blockquote class="user-quote">
                            "${sanitizeHTML(point.description) || 'No description provided'}"
                        </blockquote>
                    </div>
                    
                    <!-- Metadata Grid -->
                    <div class="metadata-grid">
                        <div class="meta-cell">
                            <span class="meta-label">REPORT ID</span>
                            <span class="meta-value mono">${point.id ? sanitizeHTML(point.id.substring(0, 12)) : 'N/A'}</span>
                        </div>
                        <div class="meta-cell">
                            <span class="meta-label">USER ID</span>
                            <span class="meta-value">${sanitizeHTML(point.user_id) || 'Anonymous'}</span>
                        </div>
                        <div class="meta-cell">
                            <span class="meta-label">DATE/TIME</span>
                            <span class="meta-value">${timestamp}</span>
                        </div>
                        <div class="meta-cell">
                            <span class="meta-label">BARANGAY</span>
                            <span class="meta-value">${getJurisdiction(point.latitude, point.longitude)}</span>
                        </div>
                    </div>
                    
                    <!-- Street-Level Location (v3.7 - Nominatim) -->
                    <div class="complaint-street-location" 
                         data-lat="${point.latitude}" 
                         data-lng="${point.longitude}"
                         id="complaint-street-${point.id ? point.id.substring(0, 8) : Math.random().toString(36).substring(7)}">
                        <i class="fas fa-road"></i>
                        <span class="street-value">
                            <i class="fas fa-spinner fa-spin"></i> Loading street address...
                        </span>
                    </div>
                    
                    <!-- Footer Warning -->
                    <div class="citizen-footer">
                        <i class="fas fa-info-circle"></i> 
                        This is <strong>raw citizen input</strong>. Verify accuracy before dispatching.
                    </div>
                </div>
                
                <!-- ===== RIGHT COLUMN (Col-span-5) - SYSTEM INTELLIGENCE ===== -->
                <div class="popup-col-right">
                    <div class="column-header">
                        <i class="fas fa-brain"></i> SYSTEM INTELLIGENCE
                    </div>
                    
                    ${urgencyScoreHTML}
                    ${actionHTML}
                    ${multiLabelHTML}
                    
                    <!-- v4.2: AI Reasoning Section -->
                    ${aiReasoningHTML}
                    
                    <!-- Warnings Stack -->
                    <div class="warnings-stack">
                        ${anomalyWarningHTML}
                        ${mergedWarningHTML}
                        ${contextSuppressionWarningHTML}
                        ${mismatchAlertHTML}
                    </div>
                </div>
                
            </div>
        </div>
    `;
}

/**
 * Create Glass Box cluster popup explaining AI reasoning.
 * Uses Multi-Jurisdiction Voting for accurate location (Feature 3).
 * v3.8: Now includes correlated neighboring clusters analysis.
 */
function createGlassBoxPopup(cluster, idx, color, rationale, allClusters = null) {
    // ================================================================
    // GLASS BOX CLUSTER POPUP v3.5 - 2-COLUMN GRID LAYOUT
    // Matches the new complaint popup design system
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
    }).join('');

    // Determine header color based on cluster severity
    // Use the dominant category's urgency or cluster size
    let headerColor = color;
    let headerClass = 'header-routine';
    let severityLevel = 'ROUTINE';

    // Calculate average urgency score for the cluster
    let totalUrgency = 0;
    let urgencyCount = 0;
    cluster.forEach(p => {
        const intelligence = window.analyzeComplaintIntelligence ?
            window.analyzeComplaintIntelligence(p) : null;
        if (intelligence) {
            totalUrgency += intelligence.urgencyScore;
            urgencyCount++;
        }
    });
    const avgUrgency = urgencyCount > 0 ? Math.round(totalUrgency / urgencyCount) : 0;

    if (avgUrgency >= 70 || cluster.length >= 10) {
        headerColor = '#ef4444';
        headerClass = 'header-emergency';
        severityLevel = 'CRITICAL';
    } else if (avgUrgency >= 40 || cluster.length >= 5) {
        headerColor = '#f59e0b';
        headerClass = 'header-warning';
        severityLevel = 'ELEVATED';
    } else {
        headerColor = '#3b82f6';
        headerClass = 'header-routine';
        severityLevel = 'ROUTINE';
    }

    // Causal chain visualization (RIGHT COLUMN)
    // v3.7.2: Now shows ALL detected causal pairs, not just the primary one
    let causalChainHTML = '';
    if (rationale.type === 'causal-chain' && rationale.allCausalPairs && rationale.allCausalPairs.length > 0) {
        // Build chain flow showing all linked categories
        const allCategories = rationale.allCategories || [];
        const pairs = rationale.allCausalPairs;

        // Create flow items for each pair
        const pairFlowsHTML = pairs.slice(0, 3).map((pair, idx) => `
            <div class="causal-flow-item">
                <span class="causal-cause">${pair.cause}</span>
                <span class="causal-arrow">→</span>
                <span class="causal-effect">${pair.effect}</span>
                <span class="causal-pct">${Math.round(pair.correlation * 100)}%</span>
            </div>
        `).join('');

        // Calculate average correlation
        const avgCorrelation = Math.round(
            pairs.reduce((sum, p) => sum + p.correlation, 0) / pairs.length * 100
        );

        causalChainHTML = `
            <div class="causal-chain-box">
                <div class="causal-header">
                    <i class="fas fa-link"></i> CAUSAL LINKS DETECTED (${pairs.length})
                </div>
                <div class="causal-flows">
                    ${pairFlowsHTML}
                </div>
                <div class="causal-correlation">
                    <i class="fas fa-chart-line"></i> Avg ${avgCorrelation}% Correlation
                </div>
            </div>
        `;
    } else if (rationale.type === 'causal-chain' && rationale.causalPair) {
        // Fallback for single pair
        const pair = rationale.causalPair;
        causalChainHTML = `
            <div class="causal-chain-box">
                <div class="causal-header">
                    <i class="fas fa-link"></i> CAUSAL LINK DETECTED
                </div>
                <div class="causal-flow">
                    <span class="causal-cause">${pair.cause}</span>
                    <span class="causal-arrow">→</span>
                    <span class="causal-effect">${pair.effect}</span>
                </div>
                <div class="causal-correlation">
                    <i class="fas fa-chart-line"></i> ${Math.round(pair.correlation * 100)}% Correlation
                </div>
            </div>
        `;
    }

    // Jurisdiction voting visualization (LEFT COLUMN - under location)
    let votingResultHTML = '';
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
        }).join('');

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
    const dominantCategory = sortedCategories.length > 0 ? sortedCategories[0][0] : 'Mixed Reports';

    // v3.8: Generate correlated clusters HTML if clusters data available
    const correlatedClustersHTML = allClusters ?
        generateCorrelatedClustersHTML(idx, allClusters, color) : '';

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
                            <span class="location-name">${jurisdictionVotes.label || 'Unknown Location'}</span>
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
                    
                    <!-- Causal Chain (if applicable) -->
                    ${causalChainHTML}
                    
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
                            <div class="span-context">${rationale.sizeDescription || 'calculating...'}</div>
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
        return '';
    }

    const targetCluster = allClusters[clusterIdx];
    const correlationInfo = window.getClusterCorrelationInfo(targetCluster, clusterIdx, allClusters);

    if (!correlationInfo.hasCorrelatedNeighbors) {
        return '';
    }

    // Build neighbor items HTML
    const neighborItemsHTML = correlationInfo.neighbors.slice(0, 3).map(neighbor => {
        const correlationPct = Math.round(neighbor.correlationScore * 100);
        const distanceLabel = neighbor.distance < 100 ? `${neighbor.distance}m` : `${(neighbor.distance / 1000).toFixed(1)}km`;

        // Get causal link labels
        const causalLabels = neighbor.causalLinks.slice(0, 2).map(link =>
            `${link.cause} → ${link.effect}`
        ).join(', ');

        // Determine correlation strength class
        let strengthClass = 'weak';
        if (correlationPct >= 70) strengthClass = 'strong';
        else if (correlationPct >= 50) strengthClass = 'moderate';

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
                ${neighbor.causalLinks.length > 0 ? `
                    <div class="neighbor-causal">
                        <i class="fas fa-link"></i> ${causalLabels}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    // Build suggestion badge
    let suggestionBadge = '';
    let suggestionText = '';

    if (correlationInfo.suggestionLevel === 'MERGE_RECOMMENDED') {
        suggestionBadge = '<span class="suggestion-badge merge">MERGE RECOMMENDED</span>';
        suggestionText = `Combined would cover ~${correlationInfo.combinedSpan}m with ${correlationInfo.combinedReportCount} total reports.`;
    } else if (correlationInfo.suggestionLevel === 'REVIEW_SUGGESTED') {
        suggestionBadge = '<span class="suggestion-badge review">REVIEW CONNECTIONS</span>';
        suggestionText = 'Related incidents nearby may require coordinated response.';
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
                ${suggestionText || 'These clusters share causal patterns and may be part of a larger incident.'}
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

    console.log('[ANOMALY] 🔍 Re-running spatial anomaly detection on', points.length, 'points...');

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
        '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
        '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
    ];

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
        cluster.forEach(point => {
            // 1. Create marker at POINT's coordinates (NOT cluster center)
            const marker = simulationEngine.createSpotlightMarker(point, color, 0.8);

            // 2. Generate popup using POINT's individual data
            //    Pass cluster context for transparency
            const complaintPopup = generateComplaintPopupHTML(
                point,                    // POINT data (NOT cluster data)
                idx + 1,                  // Cluster ID for context
                color,                    // Visual consistency
                dominantCategory          // For merged warning
            );

            // 3. Bind popup to marker
            marker.bindPopup(complaintPopup, {
                maxWidth: 350,
                className: 'complaint-audit-popup-container'
            });

            // v3.7: Load street-level location when popup opens
            marker.on('popupopen', async function () {
                const streetElements = document.querySelectorAll('.complaint-street-location');
                for (const element of streetElements) {
                    const streetValue = element.querySelector('.street-value');
                    if (streetValue && streetValue.textContent.includes('Loading')) {
                        const lat = parseFloat(element.dataset.lat);
                        const lng = parseFloat(element.dataset.lng);
                        if (!isNaN(lat) && !isNaN(lng)) {
                            try {
                                const address = await reverseGeocode(lat, lng);
                                if (address && address.street) {
                                    streetValue.innerHTML = `<strong>${address.street}</strong> <span class="street-barangay">(${address.suburb || getJurisdiction(lat, lng)})</span>`;
                                } else if (address && address.suburb) {
                                    streetValue.innerHTML = `<span class="street-barangay">${address.suburb}</span> <span class="no-street">(no street name)</span>`;
                                } else {
                                    streetValue.innerHTML = '<span class="no-street">Street name unavailable</span>';
                                }
                            } catch (error) {
                                streetValue.innerHTML = '<span class="no-street">Geocoding failed</span>';
                            }
                        }
                    }
                }
            });
        });

        // Draw distance-limited connecting lines (MST-style)
        // Only connect points < 50m apart to avoid "spaghetti" visuals
        if (cluster.length > 1) {
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
                    const connectionKey = [Math.min(i, nearestIdx), Math.max(i, nearestIdx)].join('-');
                    if (!drawnConnections.has(connectionKey)) {
                        drawnConnections.add(connectionKey);
                        const to = cluster[nearestIdx];
                        const line = L.polyline(
                            [[from.latitude, from.longitude], [to.latitude, to.longitude]],
                            {
                                color: color,
                                weight: 1,        // Subtle
                                opacity: 0.3,     // Low opacity
                                dashArray: '5, 5' // Dashed
                            }
                        ).addTo(map);
                        simulationEngine.connectionLines.push(line);
                    }
                }
            }
        }

        // v4.1: CONVEX HULL POLYGON - Wraps cluster points to show "Area of Effect"
        if (cluster.length >= 3) {
            // Get all points as [lat, lng] pairs
            const points = cluster.map(p => [p.latitude, p.longitude]);

            // Compute convex hull
            const hullPoints = computeConvexHull(points);

            if (hullPoints && hullPoints.length >= 3) {
                const hullPolygon = L.polygon(hullPoints, {
                    color: color,
                    weight: 2,
                    opacity: 0.7,
                    fillColor: color,
                    fillOpacity: 0.12,
                    dashArray: '4, 4',
                    className: 'cluster-convex-hull'
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
        const labelText = rationale.type === 'causal-chain' ? 'CHAIN' :
            rationale.type === 'multi-issue' ? 'MULTI' : 'HOTSPOT';

        const marker = L.marker([center.lat, center.lng], {
            icon: L.divIcon({
                className: 'cluster-label',
                html: `
                    <div style="
                        background: ${color};
                        color: white;
                        padding: 8px 12px;
                        border-radius: 8px;
                        font-size: 11px;
                        font-weight: 600;
                        white-space: nowrap;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
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
                className: 'glass-box-popup-container'
            })
            .addTo(map);

        // v3.7: Load street-level location when popup opens
        marker.on('popupopen', async function () {
            const streetLocationElement = document.getElementById(`street-location-${idx}`);
            if (streetLocationElement && streetLocationElement.textContent.includes('Loading')) {
                try {
                    const address = await reverseGeocode(center.lat, center.lng);
                    if (address && address.street) {
                        streetLocationElement.innerHTML = `
                            <strong>${address.street}</strong>
                            ${address.suburb ? `<span class="street-suburb">(${address.suburb})</span>` : ''}
                        `;
                    } else if (address && address.suburb) {
                        streetLocationElement.innerHTML = `<span class="street-suburb">${address.suburb}</span> <span class="no-street">(no street name)</span>`;
                    } else {
                        streetLocationElement.innerHTML = '<span class="no-street">Street name unavailable</span>';
                    }
                } catch (error) {
                    console.error('[GEOCODE] Popup load error:', error);
                    streetLocationElement.innerHTML = '<span class="no-street">Geocoding failed</span>';
                }
            }
        });

        simulationEngine.spotlightMarkers.push(marker);
    });

    console.log('[GLASS-BOX] Cluster visualization complete with transparency features');
}

// ==================== NOISE POINT VISUALIZATION ====================
// Feature 1: Make isolated/unclustered points clickable and transparent

/**
 * Create popup for NOISE (unclustered) points.
 * Shows that this is an isolated report not part of any incident cluster.
 * Uses the unified generateComplaintPopupHTML for consistency.
 * 
 * @param {Object} complaint - The noise point complaint object
 * @param {Object} mismatchResult - Result from validateCategoryMismatch() (not used, kept for compatibility)
 * @returns {string} HTML popup content
 */
function createNoisePointPopup(complaint, mismatchResult) {
    // Use the unified popup generator with gray color for noise points
    return generateComplaintPopupHTML(complaint, null, '#9ca3af', null);
}

/**
 * Visualize NOISE points (unclustered complaints) on the map.
 * Makes them clickable with detailed popups for transparency.
 * 
 * @param {Array} noisePoints - Array of noise complaint objects from DBSCAN
 */
function visualizeNoisePoints(noisePoints) {
    if (!noisePoints || noisePoints.length === 0) {
        console.log('[NOISE] No noise points to visualize');
        return;
    }

    // v4.1: Re-run anomaly detection on noise points too
    rerunAnomalyDetection(noisePoints);

    const noiseColor = '#9ca3af'; // Gray color for noise points

    noisePoints.forEach(point => {
        // Validate coordinates
        if (typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
            return;
        }

        // Run NLP Category Mismatch validation (Feature 2)
        const mismatchResult = window.validateCategoryMismatch ?
            window.validateCategoryMismatch(point) : null;

        // Create smaller, semi-transparent marker for noise points
        const iconName = 'circle'; // Simple circle for noise
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
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
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
            className: 'noise-marker',
            html: html,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
        });

        const marker = L.marker([point.latitude, point.longitude], {
            icon: icon,
            zIndexOffset: 500, // Below cluster markers but above base layer
            className: 'noise-marker-container' + (point.spatial_warning || point.road_proximity_anomaly ? ' spatial-anomaly-marker' : '')
        });

        // CRITICAL: Bind detailed popup for noise point transparency
        const noisePopup = createNoisePointPopup(point, mismatchResult);
        marker.bindPopup(noisePopup, {
            maxWidth: 320,
            className: 'noise-point-popup-container'
        });

        // v3.7: Load street-level location when popup opens
        marker.on('popupopen', async function () {
            const streetElements = document.querySelectorAll('.complaint-street-location');
            for (const element of streetElements) {
                const streetValue = element.querySelector('.street-value');
                if (streetValue && streetValue.textContent.includes('Loading')) {
                    const lat = parseFloat(element.dataset.lat);
                    const lng = parseFloat(element.dataset.lng);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        try {
                            const address = await reverseGeocode(lat, lng);
                            if (address && address.street) {
                                streetValue.innerHTML = `<strong>${address.street}</strong> <span class="street-barangay">(${address.suburb || getJurisdiction(lat, lng)})</span>`;
                            } else if (address && address.suburb) {
                                streetValue.innerHTML = `<span class="street-barangay">${address.suburb}</span> <span class="no-street">(no street name)</span>`;
                            } else {
                                streetValue.innerHTML = '<span class="no-street">Street name unavailable</span>';
                            }
                        } catch (error) {
                            streetValue.innerHTML = '<span class="no-street">Geocoding failed</span>';
                        }
                    }
                }
            }
        });

        // Add hover effect
        marker.on('mouseover', function () {
            this._icon.querySelector('.noise-marker-inner').style.opacity = '1';
            this._icon.querySelector('.noise-marker-inner').style.transform = 'scale(1.2)';
        });

        marker.on('mouseout', function () {
            this._icon.querySelector('.noise-marker-inner').style.opacity = '0.7';
            this._icon.querySelector('.noise-marker-inner').style.transform = 'scale(1)';
        });

        marker.addTo(map);
        simulationEngine.spotlightMarkers.push(marker);
    });

    console.log(`[NOISE] Visualized ${noisePoints.length} isolated points with clickable popups`);
}

// ==================== MAIN LOAD FUNCTION ====================

async function loadFullSimulation() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const statusIndicator = document.getElementById('statusIndicator');
    const loadButton = document.getElementById('loadCityData');

    // ================================================================
    // RESET PHASE 2: Disable causal analysis when reloading data
    // User must trigger Phase 2 again after new clustering
    // ================================================================
    causalAnalysisEnabled = false;
    clearCausalLinks();

    // v4.0.1: Clear any temporary live markers before re-rendering
    clearLiveMarkers();

    console.log('[CAUSAL] Phase 2 reset - causal chains hidden until re-triggered');

    try {
        // Show loading state
        loadingOverlay.classList.add('active');
        statusIndicator.classList.add('processing');
        statusIndicator.querySelector('span').textContent = 'Processing...';
        loadButton.disabled = true;

        console.log('[PRODUCTION] Starting full city analysis...');

        // Get all complaints
        const allData = simulationEngine.complaints;

        if (!allData || allData.length === 0) {
            throw new Error('No data loaded');
        }

        // Apply category filter
        let filteredData = allData;
        if (currentFilterCategory !== 'all') {
            filteredData = allData.filter(p => p.category === currentFilterCategory);
        }

        // Filter background markers to show only selected category
        simulationEngine.filterBackgroundMarkersByCategory(currentFilterCategory);

        // Update progress
        document.getElementById('loadingProgress').textContent =
            `Analyzing ${filteredData.length} complaints...`;

        // ================================================================
        // CRITICAL TRIAGE SYSTEM: Extract emergencies BEFORE clustering
        // ================================================================
        console.log('[TRIAGE] Extracting critical emergencies...');
        const { criticalPoints, standardPoints } = window.extractCriticalPoints
            ? window.extractCriticalPoints(filteredData)
            : { criticalPoints: [], standardPoints: filteredData };

        // Render Emergency Panel with critical points
        renderEmergencyPanel(criticalPoints);

        // Render pulsing markers for critical points on map
        renderCriticalMarkers(criticalPoints);

        console.log(`[TRIAGE] ${criticalPoints.length} emergencies extracted, ${standardPoints.length} standard points remain`);

        // ================================================================
        // Run DBSCAN++ clustering ONLY on standard (non-critical) points
        // This prevents emergencies from being merged into Pothole clusters!
        // ================================================================
        console.log('[DBSCAN++] Running automated clustering on standard points...');
        const clusteringResult = clusterComplaints(standardPoints, {
            MIN_PTS: 1,
            ENABLE_LOGGING: true
        });

        currentClusters = clusteringResult.clusters;
        currentNoisePoints = clusteringResult.noise;

        console.log('[RESULT]', currentClusters.length, 'clusters detected');
        console.log('[RESULT]', currentNoisePoints.length, 'noise points');

        // Generate smart insights (pass original filteredData for accurate stats)
        const insights = generateSmartInsights(
            currentClusters,
            currentNoisePoints,
            filteredData  // Use full data for stats
        );

        // Add emergency count to insights stats
        insights.stats.activeEmergencies = criticalPoints.length;

        // Update UI
        updateStatsDisplay(insights);
        renderInsightsCards(insights);
        renderCategoryDistribution(filteredData);

        // Visualize clusters
        visualizeClusters(currentClusters);

        // FEATURE 1: Visualize noise points (unclustered) with clickable popups
        visualizeNoisePoints(currentNoisePoints);

        // Create heatmap
        createHeatmap(filteredData);

        // Success state
        statusIndicator.classList.remove('processing');
        statusIndicator.classList.remove('error');
        statusIndicator.querySelector('span').textContent = 'Analysis Complete';

        // ================================================================
        // PHASE 2: Enable Causal Analysis button now that clustering is done
        // ================================================================
        const causalBtn = document.getElementById('runCausalAnalysis');
        if (causalBtn) {
            causalBtn.disabled = false;
            causalBtn.title = 'Run Causal Chain Analysis on ' + currentClusters.length + ' clusters';
            console.log('[CAUSAL] Phase 2 button enabled - ready for user trigger');
        }

        // ================================================================
        // SHARED STATE: Export data for Analytics Dashboard inheritance
        // This allows the Analytics tab to use the exact same processed data
        // ================================================================
        try {
            const transferPackage = {
                timestamp: Date.now(),
                source: 'dashboard_production',
                complaints: simulationEngine.complaints, // Includes all NLP tags and live data
                stats: insights.stats,
                generated_at: new Date().toISOString()
            };

            // Use localStorage for cross-tab communication
            localStorage.setItem('citizenlink_analytics_handover', JSON.stringify(transferPackage));
            console.log(`[HANDOVER] 📤 Data exported for Analytics inheritance (${simulationEngine.complaints.length} records)`);
        } catch (storageError) {
            console.warn('[HANDOVER] Failed to export data to Analytics (likely QuotaExceeded):', storageError);
        }

        console.log('[PRODUCTION] Analysis complete!');

    } catch (error) {
        console.error('[ERROR]', error);
        statusIndicator.classList.add('error');
        statusIndicator.querySelector('span').textContent = 'Error';
        alert('Failed to load city data: ' + error.message);
    } finally {
        loadingOverlay.classList.remove('active');
        loadButton.disabled = false;
    }
}

// ==================== COMPLAINT SEARCH FEATURE ====================

/**
 * Initialize the complaint search functionality.
 * Allows searching by complaint ID and locates them on the map.
 */
function initializeComplaintSearch() {
    const searchInput = document.getElementById('complaintSearch');
    const searchBtn = document.getElementById('searchBtn');
    const clearBtn = document.getElementById('searchClearBtn');
    const dropdown = document.getElementById('searchResultsDropdown');

    if (!searchInput || !searchBtn || !dropdown) {
        console.warn('[SEARCH] Search elements not found');
        return;
    }

    let searchTimeout = null;
    let selectedIndex = -1;

    // Live search as user types
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        if (searchTimeout) clearTimeout(searchTimeout);

        if (query.length < 2) {
            hideSearchDropdown();
            return;
        }

        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 200);
    });

    // Search button click
    searchBtn.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
            const results = searchComplaints(query);
            if (results.length === 1) {
                locateComplaint(results[0]);
            } else if (results.length > 1) {
                performSearch(query);
            } else {
                showSearchToast('No complaint found with that ID', 'error');
            }
        }
    });

    // Enter key to search
    searchInput.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.search-result-item');

        if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && items[selectedIndex]) {
                items[selectedIndex].click();
            } else {
                searchBtn.click();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateSelectedItem(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            updateSelectedItem(items);
        } else if (e.key === 'Escape') {
            hideSearchDropdown();
            searchInput.blur();
        }
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        hideSearchDropdown();
        clearSearchHighlight();
        searchInput.focus();
    });

    // Click outside to close dropdown
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            hideSearchDropdown();
        }
    });

    // Focus shows dropdown if there are results
    searchInput.addEventListener('focus', () => {
        const query = searchInput.value.trim();
        if (query.length >= 2) {
            performSearch(query);
        }
    });

    console.log('[SEARCH] Complaint search initialized');
}

/**
 * Search complaints by ID (partial match).
 */
function searchComplaints(query) {
    if (!simulationEngine || !simulationEngine.complaints) {
        return [];
    }

    const normalizedQuery = query.toLowerCase();

    return simulationEngine.complaints.filter(complaint => {
        const id = (complaint.id || '').toLowerCase();
        const userId = (complaint.user_id || '').toLowerCase();
        return id.includes(normalizedQuery) || userId.includes(normalizedQuery);
    });
}

/**
 * Perform search and show dropdown results.
 */
function performSearch(query) {
    const dropdown = document.getElementById('searchResultsDropdown');
    const results = searchComplaints(query);

    if (results.length === 0) {
        dropdown.innerHTML = `
            <div class="search-no-results">
                <i class="fas fa-search"></i>
                <p>No complaints found matching "${sanitizeHTML(query)}"</p>
            </div>
        `;
        showSearchDropdown();
        return;
    }

    // Limit to 10 results for performance
    const limitedResults = results.slice(0, 10);

    dropdown.innerHTML = limitedResults.map((complaint, index) => {
        const barangay = getJurisdiction(complaint.latitude, complaint.longitude);
        const timeAgo = getRelativeTime(complaint.timestamp);

        return `
            <div class="search-result-item" data-id="${sanitizeHTML(complaint.id)}" data-index="${index}">
                <div class="search-result-id">
                    <i class="fas fa-fingerprint"></i> ${sanitizeHTML(complaint.id)}
                </div>
                <div class="search-result-desc">${sanitizeHTML(complaint.description || 'No description')}</div>
                <div class="search-result-meta">
                    <span><i class="fas fa-tag"></i> ${sanitizeHTML(complaint.category)}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${barangay}</span>
                    <span><i class="fas fa-clock"></i> ${timeAgo}</span>
                </div>
            </div>
        `;
    }).join('');

    if (results.length > 10) {
        dropdown.innerHTML += `
            <div class="search-no-results" style="padding: 10px; font-size: 11px;">
                <i class="fas fa-info-circle"></i> Showing 10 of ${results.length} results. Type more to narrow down.
            </div>
        `;
    }

    // Add click handlers to results
    dropdown.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.id;
            const complaint = simulationEngine.complaints.find(c => c.id === id);
            if (complaint) {
                locateComplaint(complaint);
            }
        });
    });

    showSearchDropdown();
}

/**
 * Locate a complaint on the map.
 */
function locateComplaint(complaint) {
    if (!complaint || !map) return;

    const { latitude, longitude, id, description, category } = complaint;

    // Clear previous highlight
    clearSearchHighlight();

    // Hide dropdown
    hideSearchDropdown();

    // Update search input with found ID
    document.getElementById('complaintSearch').value = id;

    // Fly to location
    map.flyTo([latitude, longitude], 18, {
        duration: 1.2,
        easeLinearity: 0.25
    });

    // Create highlight marker
    const highlightIcon = L.divIcon({
        className: 'search-highlight-icon',
        html: `
            <div class="search-highlight-marker">
                <div style="
                    width: 50px; 
                    height: 50px; 
                    background: rgba(6, 182, 212, 0.3); 
                    border: 3px solid #06b6d4; 
                    border-radius: 50%; 
                    animation: search-pulse 1s ease-out infinite;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">
                    <i class="fas fa-crosshairs" style="color: #06b6d4; font-size: 20px;"></i>
                </div>
            </div>
        `,
        iconSize: [50, 50],
        iconAnchor: [25, 25]
    });

    searchHighlightMarker = L.marker([latitude, longitude], {
        icon: highlightIcon,
        zIndexOffset: 2000
    }).addTo(map);

    // Create popup with complaint details
    const barangay = getJurisdiction(latitude, longitude);
    const popupContent = `
        <div style="min-width: 280px; max-width: 350px;">
            <div style="background: linear-gradient(135deg, #06b6d4, #0891b2); color: white; padding: 12px 16px; margin: -13px -20px 12px -20px; border-radius: 4px 4px 0 0;">
                <div style="font-size: 14px; font-weight: 700;">
                    <i class="fas fa-search"></i> SEARCH RESULT
                </div>
            </div>
            
            <div style="margin-bottom: 12px;">
                <div style="color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                    Complaint ID
                </div>
                <div style="font-family: 'Courier New', monospace; color: #06b6d4; font-weight: 600; font-size: 11px; word-break: break-all;">
                    ${sanitizeHTML(id)}
                </div>
            </div>
            
            <div style="margin-bottom: 12px;">
                <div style="color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                    Description
                </div>
                <div style="background: #f3f4f6; padding: 10px; border-radius: 6px; border-left: 3px solid #06b6d4; font-style: italic; color: #374151; line-height: 1.4; font-size: 13px;">
                    "${sanitizeHTML(description) || 'No description provided'}"
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px;">
                <div>
                    <span style="color: #666;">Category:</span><br>
                    <strong style="color: #374151;">${sanitizeHTML(category)}</strong>
                </div>
                <div>
                    <span style="color: #666;">Location:</span><br>
                    <strong style="color: #374151;">${barangay}</strong>
                </div>
                <div>
                    <span style="color: #666;">User ID:</span><br>
                    <strong style="color: #374151; font-size: 11px;">${sanitizeHTML(complaint.user_id || 'Anonymous')}</strong>
                </div>
                <div>
                    <span style="color: #666;">Status:</span><br>
                    <strong style="color: #374151;">${sanitizeHTML(complaint.status || 'Pending')}</strong>
                </div>
            </div>
            
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #666;">
                <i class="fas fa-map-pin"></i> ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
            </div>
        </div>
    `;

    searchHighlightMarker.bindPopup(popupContent, {
        maxWidth: 350,
        className: 'search-result-popup'
    });

    // Open popup after flying
    setTimeout(() => {
        searchHighlightMarker.openPopup();
    }, 1200);

    // Show success toast
    showSearchToast(`Located: ${category} complaint in ${barangay}`, 'success');

    console.log(`[SEARCH] Located complaint: ${id}`);
}

/**
 * Clear the search highlight marker.
 */
function clearSearchHighlight() {
    if (searchHighlightMarker && map) {
        map.removeLayer(searchHighlightMarker);
        searchHighlightMarker = null;
    }
}

/**
 * Show the search dropdown.
 */
function showSearchDropdown() {
    const dropdown = document.getElementById('searchResultsDropdown');
    if (dropdown) {
        dropdown.classList.add('active');
    }
}

/**
 * Hide the search dropdown.
 */
function hideSearchDropdown() {
    const dropdown = document.getElementById('searchResultsDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

/**
 * Update selected item in dropdown for keyboard navigation.
 */
function updateSelectedItem(items) {
    items.forEach((item, index) => {
        item.classList.toggle('selected', index === selectedIndex);
        if (index === selectedIndex) {
            item.scrollIntoView({ block: 'nearest' });
        }
    });
}

// Track selected index for keyboard navigation
let selectedIndex = -1;

/**
 * Show a toast notification for search results.
 */
function showSearchToast(message, type = 'success') {
    // Remove existing toast
    const existingToast = document.querySelector('.search-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `search-toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${sanitizeHTML(message)}</span>
    `;

    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('active');
    });

    // Auto-hide after 3 seconds
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[PRODUCTION] Initializing City Analytics Dashboard...');

    // Initialize map
    initMap();
    console.log('[MAP] Initialized');

    // Load barangay boundaries for offline zone detection (Turf.js)
    await loadBarangayBoundaries();

    if (typeof loadNLPDictionaries === 'function') {
        await loadNLPDictionaries();
    }

    // Initialize simulation engine
    simulationEngine = new SimulationEngine(map, () => { }, () => { }, () => { });
    console.log('[ENGINE] Created');

    // Load mock data
    const success = await simulationEngine.initialize();

    if (success) {
        console.log('[DATA] Loaded successfully:', simulationEngine.complaints.length, 'records');

        // Enable Excel export button
        const exportBtn = document.getElementById('exportExcelBtn');
        if (exportBtn) {
            exportBtn.disabled = false;
            console.log('[EXPORT] Excel export button enabled');
        }

        // Dispatch dataLoaded event for other modules
        window.dispatchEvent(new CustomEvent('dataLoaded', {
            detail: { count: simulationEngine.complaints.length }
        }));
    } else {
        console.error('[DATA] Failed to load');
        return;
    }

    // ==================== LIVE SYNC INTEGRATION (DEFENSE DEMO) ====================
    initLiveSync();

    // Initialize Emergency Panel (Critical Triage System)
    initEmergencyPanel();
    console.log('[TRIAGE] Emergency panel initialized');

    // Load City Data button
    document.getElementById('loadCityData').addEventListener('click', loadFullSimulation);

    // ==================== v4.1: MAP LAYERS DROPDOWN ====================
    initMapLayersDropdown();

    // ================================================================
    // PHASE 2: Causal Analysis Button (Now in dropdown)
    // ================================================================
    // Causal analysis is handled via dropdown click in initMapLayersDropdown()

    // Category Filter dropdown
    document.getElementById('categoryFilter').addEventListener('change', (e) => {
        currentFilterCategory = e.target.value;
        console.log('[FILTER] Category:', currentFilterCategory);

        // Re-run analysis with new filter if data is loaded
        if (simulationEngine && simulationEngine.complaints && simulationEngine.complaints.length > 0) {
            loadFullSimulation();
        }
    });

    // Refresh Insights button with debounce
    let refreshTimeout = null;
    document.getElementById('refreshInsights').addEventListener('click', () => {
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

    // ==================== COMPLAINT SEARCH FEATURE ====================
    initializeComplaintSearch();

    if (typeof loadNLPDictionaries === 'function') {
        setInterval(() => {
            loadNLPDictionaries(true).catch(() => { });
        }, 60000);
    }

    console.log('[PRODUCTION] Dashboard v3.4.1 ready! (UI Optimized)');
});
