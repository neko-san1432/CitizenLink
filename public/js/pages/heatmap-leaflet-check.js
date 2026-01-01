// Check if Leaflet.heat is loaded
// Moved from inline script to comply with CSP
if (typeof L !== "undefined" && L.heatLayer) {
  console.log("✅ Leaflet.heat plugin loaded successfully");
} else {
  console.error("❌ Leaflet.heat plugin failed to load");
}

