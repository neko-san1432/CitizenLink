/**
 * Complaint Map Component
 * Displays an interactive map showing the complaint location
 */
class ComplaintMap {

  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.map = null;
    this.marker = null;
    this.options = {
      zoom: 15,
      center: [14.5995, 120.9842], // Default to Manila
      ...options
    };
    if (this.container) {
      this.init();
    }
  }
  init() {
    this.loadLeaflet().then(() => {
      this.createMap();
    });
  }
  async loadLeaflet() {
    return new Promise((resolve, reject) => {
      // Check if Leaflet is already loaded
      if (window.L) {
        resolve();
        return;
      }
      // Load Leaflet CSS
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      css.onload = () => {
        // Load Leaflet JS
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load Leaflet"));
        document.head.appendChild(script);
      };
      css.onerror = () => reject(new Error("Failed to load Leaflet CSS"));
      document.head.appendChild(css);
    });
  }
  createMap() {

    if (!window.L) {
      console.error("[COMPLAINT_MAP] Leaflet not loaded");
      return;
    }

    // Ensure container has dimensions
    if (!this.container) {
      console.error("[COMPLAINT_MAP] Container not found");
      return;
    }

    // Wait for container to have dimensions
    const ensureDimensions = () => {
      return new Promise((resolve) => {
        if (this.container.offsetWidth > 0 && this.container.offsetHeight > 0) {
          resolve();
        } else {
          // Try setting explicit height if not set
          if (!this.container.style.height) {
            this.container.style.height = "300px";
          }
          if (!this.container.style.width) {
            this.container.style.width = "100%";
          }
          // Wait a bit and check again
          setTimeout(() => {
            if (this.container.offsetWidth > 0 && this.container.offsetHeight > 0) {
              resolve();
            } else {
              // Force dimensions
              this.container.style.height = "300px";
              this.container.style.width = "100%";
              setTimeout(resolve, 100);
            }
          }, 100);
        }
      });
    };

    ensureDimensions().then(() => {
      // Add container styling
      this.container.style.height = "300px";
      this.container.style.width = "100%";
      this.container.style.borderRadius = "8px";
      this.container.style.overflow = "hidden";
      this.container.style.position = "relative";

      // Create map
      this.map = L.map(this.containerId, {
        zoomControl: true,
        preferCanvas: false
      }).setView(this.options.center, this.options.zoom);

      // Add tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19
      }).addTo(this.map);

      // Invalidate size after a short delay to ensure proper rendering
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
        }
      }, 200);

      // Also invalidate on window resize
      const resizeHandler = () => {
        if (this.map) {
          this.map.invalidateSize();
        }
      };
      window.addEventListener("resize", resizeHandler);
      this.resizeHandler = resizeHandler;
    });
  }
  setLocation(latitude, longitude, title = "Complaint Location", description = "") {

    if (!this.map) {
      console.warn("[COMPLAINT_MAP] Map not initialized");
      return;
    }
    // Remove existing marker
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }
    // Validate coordinates
    if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
      console.warn("[COMPLAINT_MAP] Invalid coordinates provided:", { latitude, longitude });
      return;
    }
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    // Invalidate size before adding marker
    this.map.invalidateSize();

    // Create marker
    this.marker = L.marker([lat, lng]).addTo(this.map);
    // Create popup content
    const popupContent = `
      <div class="complaint-map-popup">
        <h4>${title}</h4>
        ${description ? `<p>${description}</p>` : ""}
        <p><strong>Coordinates:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
      </div>
    `;

    this.marker.bindPopup(popupContent);

    // Center map on location
    this.map.setView([lat, lng], this.options.zoom);

    // Invalidate size again after setting view
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 100);

    // Open popup
    this.marker.openPopup();
  }

  setMultipleLocations(locations) {
    if (!this.map || !Array.isArray(locations)) return;

    // Remove existing markers
    if (this.marker) {
      this.map.removeLayer(this.marker);
    }

    // Create marker group
    const markerGroup = L.layerGroup().addTo(this.map);

    const bounds = L.latLngBounds();

    locations.forEach((location, index) => {
      const { latitude, longitude, title, description } = location;

      if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
        return;
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      const marker = L.marker([lat, lng]);

      const popupContent = `
        <div class="complaint-map-popup">
          <h4>${title || `Location ${index + 1}`}</h4>
          ${description ? `<p>${description}</p>` : ""}
          <p><strong>Coordinates:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
        </div>
      `;

      marker.bindPopup(popupContent);
      markerGroup.addLayer(marker);
      bounds.extend([lat, lng]);
    });

    // Fit map to show all markers
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [20, 20] });
    }

    this.marker = markerGroup;
  }

  addCircle(center, radius, options = {}) {
    if (!this.map) return;

    const circleOptions = {
      color: "#3b82f6",
      fillColor: "#3b82f6",
      fillOpacity: 0.2,
      weight: 2,
      ...options
    };

    return L.circle(center, radius, circleOptions).addTo(this.map);
  }

  addPolygon(points, options = {}) {
    if (!this.map) return;

    const polygonOptions = {
      color: "#3b82f6",
      fillColor: "#3b82f6",
      fillOpacity: 0.2,
      weight: 2,
      ...options
    };

    return L.polygon(points, polygonOptions).addTo(this.map);
  }

  getCurrentView() {
    if (!this.map) return null;

    const center = this.map.getCenter();
    const zoom = this.map.getZoom();

    return {
      center: [center.lat, center.lng],
      zoom
    };
  }

  setView(center, zoom) {
    if (!this.map) return;

    this.map.setView(center, zoom);
  }

  destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.marker = null;
    // Remove resize handler if it exists
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
  }

  // Static method to create map with complaint data
  static createComplaintMap(containerId, complaintData) {
    const map = new ComplaintMap(containerId);

    if (complaintData.latitude && complaintData.longitude) {
      map.setLocation(
        complaintData.latitude,
        complaintData.longitude,
        complaintData.descriptive_su || "Complaint Location",
        complaintData.location_text || ""
      );
    }

    return map;
  }
}

// Export for use in other modules
window.ComplaintMap = ComplaintMap;

// Auto-initialize if DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    // Auto-initialize maps with data-complaint-map attribute
    document.querySelectorAll("[data-complaint-map]").forEach(element => {
      const complaintData = JSON.parse(element.dataset.complaintMap || "{}");
      ComplaintMap.createComplaintMap(element.id, complaintData);
    });
  });
} else {
  // Auto-initialize maps with data-complaint-map attribute
  document.querySelectorAll("[data-complaint-map]").forEach(element => {
    const complaintData = JSON.parse(element.dataset.complaintMap || "{}");
    ComplaintMap.createComplaintMap(element.id, complaintData);

  });
}
