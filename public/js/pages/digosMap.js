// legacy block removed
(function() {
  const MAP_ID = "digos-map";
  const DEFAULT_CENTER = [6.7497, 125.3570]; // Approx Digos City
  const DEFAULT_ZOOM = 12;
  function ensureLeafletLoaded() {
    return new Promise((resolve, reject) => {
      if (window.L) return resolve();
      const check = setInterval(() => {
        if (window.L) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(check);
        if (!window.L) reject(new Error("Leaflet failed to load"));
      }, 5000);
    });
  }
  async function fetchBoundaries() {
    const res = await fetch("/api/boundaries", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load boundaries");
    return res.json();
  }
  function styleForBarangay(index) {
    // Generate pleasant distinct colors
    const hue = (index * 47) % 360;
    return {
      color: `hsl(${hue}, 70%, 40%)`,
      weight: 2,
      fillColor: `hsl(${hue}, 70%, 60%)`,
      fillOpacity: 0.25
    };
  }
  function addBarangayPolygons(map, boundaries) {
    const group = L.featureGroup();
    boundaries.forEach((item, idx) => {
      const gj = item.geojson;
      if (!gj) return;
      try {
        // Coordinates are [lng, lat]; Leaflet expects [lat, lng]
        const layer = L.geoJSON(gj, {
          style: styleForBarangay(idx),
          coordsToLatLng(coords) {
            return new L.LatLng(coords[1], coords[0]);
          }
        }).bindPopup(`<strong>${item.name || "Barangay"}</strong>`);
        group.addLayer(layer);
      } catch (e) {
        console.warn("Failed to render polygon for", item.name, e);
      }
    });
    group.addTo(map);
    try {
      const b = group.getBounds();
      if (b.isValid()) {
        map.fitBounds(b, { padding: [20, 20] });
      }
    } catch {}
  }
  async function init() {
    const container = document.getElementById(MAP_ID);
    if (!container) return;
    try {
      await ensureLeafletLoaded();
      const map = L.map(MAP_ID).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19
      }).addTo(map);
      const data = await fetchBoundaries();
      if (Array.isArray(data)) {
        addBarangayPolygons(map, data);
      }
    } catch (error) {
      console.error("[Digos Map] Initialization failed:", error);
      container.innerHTML = '<div style="padding:1rem;color:#e74c3c;">Failed to load map. Please try again later.</div>';
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
