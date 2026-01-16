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
        console.log('[ADVANCED] Features initialized');
    },

    /**
     * Load barangay boundary GeoJSON for offline zone detection.
     */
    loadBoundaries: async () => {
        await loadBarangayBoundaries();
    },

    /**
     * Detect jurisdiction (Barangay) for a point
     */
    getJurisdiction: (lat, lng) => {
        return getJurisdiction(lat, lng);
    },

    /**
     * Get street-level location (Async)
     */
    getDetailedLocation: async (point) => {
        return await getDetailedLocation(point);
    },

    /**
     * Render critical markers on the map
     */
    renderCriticalMarkers: (criticalPoints) => {
        renderCriticalMarkers(criticalPoints);
    },

    /**
     * Render the emergency panel sidebar
     */
    renderEmergencyPanel: (criticalPoints) => {
        renderEmergencyPanel(criticalPoints);
    },

    /**
     * Dispatch an emergency (Simulated for visualization)
     */
    dispatchEmergency: (idx) => {
        dispatchEmergency(idx);
    }
};

// ==================== INTERNAL LOGIC (Ported) ====================

async function loadBarangayBoundaries() {
    try {
        // Adjust path if needed based on where this is served
        const response = await fetch('/data/brgy_boundaries_location.json');
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

    // Critical Icon CSS must be present in stylesheet
    criticalPoints.forEach((point, idx) => {
        // Use logic to determine criticality type if not present
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

    // Use passed points or global
    currentCriticalPoints = criticalPoints || [];
    countBadge.textContent = currentCriticalPoints.length;

    if (currentCriticalPoints.length > 0 && panel) {
        panel.classList.remove('hidden');
        panel.classList.add('active'); // Ensure visibility if emergencies exist
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

// Global helper for onclick
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
