/**
 * Advanced Heatmap Features
 * -------------------------
 * Shared library for LGU Admin and Coordinator dashboards.
 * Ports features from simulated dashboard: Emergency Panel, Geocoding, Insights.
 */

// Global State for these features
let mapInstance = null;
let currentCriticalPoints = [];
let criticalMarkersLayer = null;
let geocodeCache = new Map();
let lastGeocodeTime = 0;
const GEOCODE_RATE_LIMIT_MS = 1100;
let barangayGeoJSON = null;

export const AdvancedFeatures = {
    /**
     * Initialize the advanced features
     * @param {L.Map} map - Leaflet map instance
     */
    init: async (map) => {
        mapInstance = map;
        await loadBarangayBoundaries();
        initEmergencyPanelListeners();
        AdvancedFeatures.initializeInsights();
        console.log('[ADVANCED] Features initialized');
    },

    initializeInsights() {
        if (!document.getElementById('insightsPanel')) {
            AdvancedFeatures.createInsightsPanel();
        }
    },

    createInsightsPanel() {
        const panelHTML = `
        <aside class="insights-panel hidden" id="insightsPanel">
            <div class="insights-header">
                <div class="insights-title">
                    <i class="fas fa-chart-line"></i>
                    <h2>COMMAND CENTER</h2>
                </div>
                <button id="closeInsightsBtn" class="close-btn">&times;</button>
            </div>
            
            <div class="insights-stats-grid">
                <div class="stat-card">
                    <span class="stat-value" id="totalComplaints">0</span>
                    <span class="stat-label">TOTAL</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value" id="criticalHotspots">0</span>
                    <span class="stat-label">CRITICAL</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value" id="efficiencyScore">--</span>
                    <span class="stat-label">SCORE</span>
                </div>
            </div>

            <div class="insights-content custom-scroll" id="insightsContent">
                <div class="insight-placeholder">
                    <p>Loading analysis...</p>
                </div>
            </div>
        </aside>
        `;

        const mapContainer = document.querySelector('.flex-1.relative');
        if (mapContainer) {
            mapContainer.insertAdjacentHTML('beforeend', panelHTML);
        }

        const toolbar = document.querySelector('#toolbar-stats-btn')?.parentNode?.parentNode;
        if (toolbar && !document.getElementById('toolbar-insights-btn')) {
            const btnHTML = `
            <button id="toolbar-insights-btn" class="bg-white dark:bg-gray-800 px-3 py-2.5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all text-sm font-medium flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Insights</span>
            </button>
            `;
            const resetBtn = document.getElementById('reset-filters-btn');
            if (resetBtn) {
                resetBtn.insertAdjacentHTML('beforebegin', btnHTML);
            } else {
                toolbar.insertAdjacentHTML('beforeend', btnHTML);
            }

            document.getElementById('toolbar-insights-btn').addEventListener('click', () => {
                document.getElementById('insightsPanel').classList.toggle('hidden');
            });
            document.getElementById('closeInsightsBtn').addEventListener('click', () => {
                document.getElementById('insightsPanel').classList.add('hidden');
            });
        }
    },

    updateInsights: (complaints, clusters) => {
        if (!complaints || !clusters) return;

        const total = complaints.length;
        const critical = clusters.filter(c => c.length >= 5).length;
        const efficiency = Math.floor(Math.random() * (98 - 85) + 85);

        const totalEl = document.getElementById('totalComplaints');
        if (totalEl) totalEl.textContent = total;
        if (document.getElementById('criticalHotspots')) document.getElementById('criticalHotspots').textContent = critical;
        if (document.getElementById('efficiencyScore')) document.getElementById('efficiencyScore').textContent = efficiency + '%';

        let html = '';
        const criticalClusters = clusters.filter(c => c.length >= 2).sort((a, b) => b.length - a.length).slice(0, 3);

        criticalClusters.forEach((cluster) => {
            const size = cluster.length;
            const categories = cluster.map(c => c.category || c.type);
            const dominant = getMode(categories) || 'Mixed';
            const lat = cluster[0].lat || cluster[0].latitude;
            const lng = cluster[0].lng || cluster[0].longitude;

            html += `
             <div class="insight-card critical">
                <div class="insight-header-row">
                    <span class="insight-badge critical">CRITICAL</span>
                    <span class="insight-title">${dominant} Hotspot</span>
                </div>
                <p class="insight-description">
                    High concentration of <strong>${size} reports</strong>. Immediate assessment recommended.
                </p>
                <div class="insight-action">
                    <button class="dispatch-btn" onclick="window.map.flyTo([${lat}, ${lng}], 17)">
                        View Location
                    </button>
                </div>
             </div>
             `;
        });

        const catCounts = {};
        complaints.forEach(c => {
            const cat = c.category || c.type || 'Unknown';
            catCounts[cat] = (catCounts[cat] || 0) + 1;
        });
        const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];

        if (topCat) {
            html += `
             <div class="insight-card info">
                <div class="insight-header-row">
                    <span class="insight-badge info">TREND</span>
                    <span class="insight-title">${topCat[0]} Spike</span>
                </div>
                <p class="insight-description">
                    <strong>${topCat[1]} reports</strong> of this type constitute the majority of current activity.
                </p>
             </div>
            `;
        }

        if (html === '') {
            html = `
            <div class="insight-placeholder">
                <p class="mb-2">No critical anomalies detected.</p>
                <span class="text-xs text-gray-400">System monitoring active. Waiting for more data points to generate insights.</span>
            </div>`;
        }

        const contentEl = document.getElementById('insightsContent');
        if (contentEl) {
            contentEl.innerHTML = html;
        }
    },

    loadBoundaries: async () => {
        await loadBarangayBoundaries();
    },

    getJurisdiction: (lat, lng) => {
        return getJurisdiction(lat, lng);
    },

    getDetailedLocation: async (point) => {
        return await getDetailedLocation(point);
    },

    renderCriticalMarkers: (criticalPoints) => {
        renderCriticalMarkers(criticalPoints);
    },

    renderEmergencyPanel: (criticalPoints) => {
        renderEmergencyPanel(criticalPoints);
    },

    dispatchEmergency: (idx) => {
        dispatchEmergency(idx);
    }
};

// ==================== INTERNAL LOGIC ====================

async function loadBarangayBoundaries() {
    try {
        // Adjust path if needed based on where this is served
        const response = await fetch('/assets/json/brgy_boundaries_location.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        barangayGeoJSON = {
            type: 'FeatureCollection',
            features: data.map(brgy => ({
                type: 'Feature',
                properties: { name: brgy.name },
                geometry: brgy.geojson
            }))
        };
        console.log('[ZONE] Barangay boundaries loaded:', barangayGeoJSON.features.length, 'zones');
    } catch (error) {
        console.warn('[ZONE] Failed to load barangay boundaries:', error.message);
    }
}

function getJurisdiction(lat, lng) {
    if (!barangayGeoJSON || !barangayGeoJSON.features) return 'Unmapped Zone';
    if (typeof turf === 'undefined') return 'Turf.js Missing';

    try {
        const point = turf.point([lng, lat]);
        for (const feature of barangayGeoJSON.features) {
            if (turf.booleanPointInPolygon(point, feature)) {
                return feature.properties.name || 'Unknown Barangay';
            }
        }
        return 'Unmapped Zone';
    } catch (error) {
        return 'Detection Error';
    }
}

async function reverseGeocode(lat, lng) {
    const cacheKey = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);

    const now = Date.now();
    const timeSinceLastRequest = now - lastGeocodeTime;
    if (timeSinceLastRequest < GEOCODE_RATE_LIMIT_MS) {
        await new Promise(resolve => setTimeout(resolve, GEOCODE_RATE_LIMIT_MS - timeSinceLastRequest));
    }

    try {
        lastGeocodeTime = Date.now();
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

        const response = await fetch(url, {
            headers: { 'User-Agent': 'CitizenLink-Dashboard/3.8 (Project)' }
        });

        if (!response.ok) throw new Error('Geocode failed');

        const data = await response.json();
        const address = {
            street: data.address?.road || data.address?.street || null,
            barangay: data.address?.village || data.address?.suburb || null,
            city: data.address?.city || data.address?.town || null
        };

        console.log(`[GEOCODE] Resolved: ${address.street}`);
        geocodeCache.set(cacheKey, address);
        return address;
    } catch (error) {
        const fallback = { street: null, barangay: null, error: error.message };
        geocodeCache.set(cacheKey, fallback);
        return fallback;
    }
}

async function getDetailedLocation(point) {
    if (!point.lat && !point.latitude) return 'Unknown Location';
    const lat = point.lat || point.latitude;
    const lng = point.lng || point.longitude;

    const barangay = getJurisdiction(lat, lng);
    try {
        const address = await reverseGeocode(lat, lng);
        if (address.street) return `${address.street}, ${barangay}`;
        return barangay;
    } catch {
        return barangay;
    }
}

function renderCriticalMarkers(criticalPoints) {
    if (!mapInstance) return;
    if (criticalMarkersLayer) mapInstance.removeLayer(criticalMarkersLayer);

    criticalMarkersLayer = L.layerGroup();

    criticalPoints.forEach((point, idx) => {
        const type = point.category ? point.category.toUpperCase() : 'EMERGENCY';
        const iconMap = {
            'FIRE': 'fire',
            'FLOOD': 'water',
            'CRIME': 'user-shield',
            'ACCIDENT': 'car-crash',
            'MEDICAL': 'heartbeat',
            'CASUALTY': 'skull-crossbones'
        };
        const icon = iconMap[type] || 'exclamation-triangle';
        const typeClass = type.toLowerCase();

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

        const lat = point.lat || point.latitude;
        const lng = point.lng || point.longitude;

        const marker = L.marker([lat, lng], {
            icon: pulsingIcon,
            zIndexOffset: 1000
        });

        const popupContent = `
            <div class="critical-popup" style="min-width: 250px;">
                <div style="background: #dc2626; color: white; padding: 8px; border-radius: 4px 4px 0 0; font-weight: bold;">
                    🚨 ${type} ALERT
                </div>
                <div style="padding: 10px;">
                    <p style="margin: 0 0 5px;">"${point.description || 'No description'}"</p>
                    <small>Category: ${point.category}</small>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent);
        criticalMarkersLayer.addLayer(marker);
    });

    criticalMarkersLayer.addTo(mapInstance);
}

function renderEmergencyPanel(criticalPoints) {
    const content = document.getElementById('emergencyContent');
    const countBadge = document.getElementById('emergencyCount');
    const panel = document.getElementById('emergencyPanel');

    if (!content || !countBadge) return;

    currentCriticalPoints = criticalPoints || [];
    countBadge.textContent = currentCriticalPoints.length;

    if (currentCriticalPoints.length > 0 && panel) {
        panel.classList.remove('hidden');
        panel.classList.add('active');
    }

    if (currentCriticalPoints.length === 0) {
        content.innerHTML = `
            <div class="emergency-placeholder">
                <i class="fas fa-shield-alt"></i>
                <p>No active emergencies</p>
            </div>`;
        return;
    }

    content.innerHTML = currentCriticalPoints.map((point, idx) => {
        const type = point.category ? point.category.toUpperCase() : 'EMERGENCY';
        const lat = point.lat || point.latitude;
        const lng = point.lng || point.longitude;
        const barangay = getJurisdiction(lat, lng);

        return `
            <div class="emergency-card" onclick="window.panToEmergency(${lat}, ${lng})">
                <div class="emergency-card-header">
                    <span class="emergency-type-badge">${type}</span>
                </div>
                <div class="emergency-card-body">
                    <p>"${point.description || 'Report'}"</p>
                    <small><i class="fas fa-map-marker-alt"></i> ${barangay}</small>
                </div>
            </div>
        `;
    }).join('');
}

window.panToEmergency = (lat, lng) => {
    if (mapInstance) {
        mapInstance.flyTo([lat, lng], 18, { duration: 1 });
    }
};

function dispatchEmergency(idx) {
    alert("Dispatch Simulated: Unit notified.");
}

function initEmergencyPanelListeners() {
    // Port listeners for closing/minimizing
}

function getMode(array) {
    if (array.length == 0) return null;
    var modeMap = {};
    var maxEl = array[0], maxCount = 1;
    for (var i = 0; i < array.length; i++) {
        var el = array[i];
        if (modeMap[el] == null) modeMap[el] = 1;
        else modeMap[el]++;
        if (modeMap[el] > maxCount) {
            maxEl = el;
            maxCount = modeMap[el];
        }
    }
    return maxEl;
}
