/**
 * Heatmap Visualization Component for Complaint Locations
 * Integrates with Leaflet maps and DBSCAN clustering
 */

// Helper function to check if a point is inside a GeoJSON polygon
function isPointInPolygon(lat, lng, geojson) {
  if (!geojson) return false;

  // Handle case where geojson is already a geometry object
  let geometry = geojson;
  if (geojson.geometry) {
    geometry = geojson.geometry;
  }

  if (!geometry || !geometry.coordinates) return false;

  if (geometry.type === "Polygon") {
    return isPointInPolygonCoords(lat, lng, geometry.coordinates);
  } else if (geometry.type === "MultiPolygon") {
    // MultiPolygon coordinates: [[[ring1], [ring2]], ...] where each outer element is a polygon
    // Check if point is in any of the polygons
    return geometry.coordinates.some((polygon) =>
      isPointInPolygonCoords(lat, lng, polygon)
    );
  }
  return false;
}

// Ray casting algorithm for point-in-polygon check
// coordinates can be:
// - Polygon: [outerRing, innerRing1, ...] where each ring is [[lng, lat], [lng, lat], ...]
// - MultiPolygon polygon: [[ring1], [ring2], ...] where each ring is [[lng, lat], [lng, lat], ...]
function isPointInPolygonCoords(lat, lng, coordinates) {
  if (!coordinates || coordinates.length === 0) return false;

  // Check if this is a MultiPolygon structure (nested deeper)
  // MultiPolygon coordinates structure: [[[ring1], [ring2]], ...]
  // If coordinates[0][0] is an array of arrays (not just numbers), it's a MultiPolygon polygon
  if (
    Array.isArray(coordinates[0]) &&
    Array.isArray(coordinates[0][0]) &&
    Array.isArray(coordinates[0][0][0])
  ) {
    // This is a MultiPolygon polygon: [[[ring1]], [[ring2]], ...]
    // Each element is a polygon with rings
    return coordinates.some((polygon) =>
      isPointInPolygonCoords(lat, lng, polygon)
    );
  }

  // Single polygon: coordinates is [outerRing, innerRing1, innerRing2, ...]
  // Each ring is [[lng, lat], [lng, lat], ...]
  const outerRing = coordinates[0];
  if (!outerRing || !Array.isArray(outerRing) || outerRing.length === 0)
    return false;

  let inside = false;

  // Ray casting algorithm: cast a horizontal ray from (lat, lng) going right (increasing longitude)
  // GeoJSON coordinates are [longitude, latitude]
  for (let i = 0, j = outerRing.length - 1; i < outerRing.length; j = i++) {
    const lng1 = outerRing[i][0]; // longitude of point i
    const lat1 = outerRing[i][1]; // latitude of point i
    const lng2 = outerRing[j][0]; // longitude of point j
    const lat2 = outerRing[j][1]; // latitude of point j

    // Skip horizontal edges (they don't contribute to the intersection count)
    if (Math.abs(lat2 - lat1) < 1e-10) continue;

    // Check if the horizontal ray from (lat, lng) intersects the edge from (lat1, lng1) to (lat2, lng2)
    // The ray intersects if:
    // 1. The point's latitude is between the edge's latitudes (or the edge crosses the point's latitude)
    // 2. The intersection longitude is to the right of the point's longitude
    const latBetween = lat1 > lat !== lat2 > lat;
    if (latBetween) {
      // Calculate the longitude where the edge crosses the point's latitude
      const intersectLng =
        ((lat - lat1) * (lng2 - lng1)) / (lat2 - lat1) + lng1;
      // If the intersection is to the right of the point, count it
      if (lng < intersectLng) {
        inside = !inside;
      }
    }
  }

  // Check if point is in any inner rings (holes)
  for (let ringIndex = 1; ringIndex < coordinates.length; ringIndex++) {
    const innerRing = coordinates[ringIndex];
    let inHole = false;

    for (let i = 0, j = innerRing.length - 1; i < innerRing.length; j = i++) {
      const lng1 = innerRing[i][0]; // longitude of point i
      const lat1 = innerRing[i][1]; // latitude of point i
      const lng2 = innerRing[j][0]; // longitude of point j
      const lat2 = innerRing[j][1]; // latitude of point j

      // Skip horizontal edges
      if (Math.abs(lat2 - lat1) < 1e-10) continue;

      const latBetween = lat1 > lat !== lat2 > lat;
      if (latBetween) {
        // Calculate the longitude where the edge crosses the point's latitude
        const intersectLng =
          ((lat - lat1) * (lng2 - lng1)) / (lat2 - lat1) + lng1;
        if (lng < intersectLng) {
          inHole = !inHole;
        }
      }
    }

    if (inHole) {
      inside = false; // Point is in a hole, so it's outside
      break;
    }
  }

  return inside;
}

// Check if coordinates are within any barangay boundary
function isWithinCityBoundary(lat, lng) {
  if (typeof lat !== "number" || typeof lng !== "number") return false;

  // Check if boundaries are loaded
  if (!window.cityBoundaries || !Array.isArray(window.cityBoundaries)) {
    // Fallback to bounding box if boundaries not loaded
    const minLat = 6.6;
    const maxLat = 7.0;
    const minLng = 125.0;
    const maxLng = 125.7;
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  }

  // Debug: Log boundary structure once
  if (!window._boundaryDebugged && window.cityBoundaries.length > 0) {
    window._boundaryDebugged = true;
    const _firstBoundary = window.cityBoundaries[0];

    // Test with a known point inside Digos City (approximate center)
    const testLat = 6.85;
    const testLng = 125.35;
    let _testResult = false;
    for (const boundary of window.cityBoundaries) {
      if (
        boundary &&
        boundary.geojson &&
        isPointInPolygon(testLat, testLng, boundary.geojson)
      ) {
        _testResult = true;
        break;
      }
    }
  }

  // Check if point is within any barangay boundary
  for (const boundary of window.cityBoundaries) {
    if (boundary && boundary.geojson) {
      if (isPointInPolygon(lat, lng, boundary.geojson)) {
        return true;
      }
    }
  }

  return false;
}

class HeatmapVisualization {
  constructor(map) {
    this.map = map;
    this.complaintData = [];
    this.allComplaintData = []; // Store all complaints for client-side filtering
    this.roleScopedCache = null; // Cache filtered complaints per role for this tick
    this.markerMap = new Map(); // Map complaint ID to marker for quick lookup
    this.clusters = [];
    this.heatmapLayer = null;
    this.markerLayer = null;
    this.clusterLayer = null;
    this.dbscan = new DBSCAN();
    this.isClusteringEnabled = false;
    this.currentFilters = {};
    this.filterByBoundary = true; // Enable boundary filtering by default
    this.userRole = null; // Will be set when role is determined
    this.userDepartment = null; // Will be set for LGU admins
    // Dynamic heatmap scaling configuration
    this.dynamicScaling = {
      enabled: true, // Enable dynamic scaling by default
      maxDensity: 1.0, // Current maximum density value
      smoothedMaxDensity: 1.0, // Smoothed maximum for preventing flickering
      smoothingFactor: 0.3, // Smoothing factor (0-1): lower = more smoothing, higher = more responsive
      minMaxDensity: 0.1, // Minimum max density to prevent division by zero
      densityHistory: [], // History for rolling average (optional)
      historySize: 5, // Number of previous max densities to keep for smoothing
    };
    // Heatmap configuration
    this.heatmapConfig = {
      radius: 30,
      blur: 15,
      maxZoom: 18,
      max: 1.0,
      intensity: 1.0,
      gradient: {
        0.0: "transparent",
        0.2: "blue",
        0.4: "cyan",
        0.6: "lime",
        0.7: "yellow",
        0.8: "orange",
        1.0: "red",
      },
    };
    // Cluster configuration
    this.clusterConfig = {
      eps: 0.1, // ~10km (increased from 0.01)
      minPts: 5,
      clusterColors: [
        "#FF6B6B",
        "#4ECDC4",
        "#45B7D1",
        "#96CEB4",
        "#FFEAA7",
        "#DDA0DD",
        "#98D8C8",
        "#F7DC6F",
        "#BB8FCE",
        "#85C1E9",
      ],
    };
    // Setup zoom listener for dynamic marker sizing
    if (this.map) {
      this.map.on("zoomend", () => {
        this.updateMarkerSizes();
      });
    }
  }

  /**
   * Normalize all department sources for a complaint into uppercase codes
   * @param {Object} complaint
   * @returns {string[]} department codes
   */
  getComplaintDepartments(complaint) {
    if (!complaint) return [];

    const rawEntries = [];
    const pushValue = (value) => {
      if (value === null || typeof value === "undefined") return;
      if (Array.isArray(value)) {
        value.forEach(pushValue);
        return;
      }
      rawEntries.push(value);
    };

    pushValue(complaint.departments);
    pushValue(complaint.department_r);
    pushValue(complaint.secondaryDepartments);
    pushValue(complaint.department);
    pushValue(complaint.departmentCode || complaint.department_code);

    const normalized = rawEntries
      .map((entry) => {
        if (!entry) return "";
        if (typeof entry === "string") return entry;
        if (typeof entry === "object") {
          return (
            entry.code ||
            entry.department_code ||
            entry.departmentCode ||
            entry.value ||
            entry.name ||
            ""
          );
        }
        return String(entry || "");
      })
      .flatMap((value) => value.split(","))
      .map((value) => value.toUpperCase().trim())
      .filter(Boolean);

    return [...new Set(normalized)];
  }

  /**
   * Scope visible complaints based on role
   * @returns {Array} complaints limited to current user's access
   */
  getRoleScopedComplaints() {
    if (!Array.isArray(this.allComplaintData)) return [];

    const cacheHit =
      this.roleScopedCache &&
      this.roleScopedCache.role === this.userRole &&
      this.roleScopedCache.department === this.userDepartment &&
      this.roleScopedCache.sourceSize === this.allComplaintData.length;

    if (cacheHit) {
      return this.roleScopedCache.data;
    }

    const scoped = this.filterComplaintsByRole(this.allComplaintData);
    this.roleScopedCache = {
      role: this.userRole,
      department: this.userDepartment,
      sourceSize: this.allComplaintData.length,
      data: scoped,
    };

    return scoped;
  }
  /**
   * Initialize user role and department for role-based filtering
   */
  async initializeUserRole() {
    try {
      const { getUserRole } = await import("../../auth/authChecker.js");
      this.userRole = await getUserRole();

      // Get department for LGU admins
      if (
        this.userRole &&
        ["lgu", "lgu-admin", "lgu-hr"].includes(this.userRole)
      ) {
        try {
          const { supabase } = await import("../../config/config.js");
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const metadata =
            session?.user?.raw_user_meta_data ||
            session?.user?.user_metadata ||
            {};
          this.userDepartment = metadata.dpt || metadata.department;
        } catch (error) {
          console.warn(
            "[HEATMAP] Failed to get department from metadata:",
            error
          );
        }
      }

      console.log("[HEATMAP] User role initialized:", {
        role: this.userRole,
        department: this.userDepartment,
      });
    } catch (error) {
      console.error("[HEATMAP] Failed to initialize user role:", error);
      this.userRole = "citizen"; // Default fallback
    }
    // Clear scoped cache so new role context takes effect immediately
    this.roleScopedCache = null;
  }

  /**
   * Filter complaints based on user role
   * @param {Array} complaints - Array of complaints to filter
   * @returns {Array} Filtered complaints based on role
   */
  filterComplaintsByRole(complaints) {
    if (!this.userRole) {
      // If role not initialized, return all (will be filtered later)
      return complaints;
    }

    // Citizens: Only see complaints within Digos City boundaries (already filtered)
    // Heatmap shows all, but markers are hidden for citizens
    if (this.userRole === "citizen") {
      return complaints; // All complaints for heatmap, but markers won't be shown
    }

    // Complaint coordinators: See all complaints
    if (
      this.userRole === "complaint-coordinator" ||
      this.userRole === "super-admin"
    ) {
      return complaints; // All complaints
    }

    // LGU Admins: See only complaints assigned to their department
    if (this.userRole === "lgu-admin" && this.userDepartment) {
      const targetDept = String(this.userDepartment || "")
        .toUpperCase()
        .trim();
      return complaints.filter((complaint) => {
        const complaintDepartments = this.getComplaintDepartments(complaint);
        return complaintDepartments.includes(targetDept);
      });
    }

    // Default: return all (fallback)
    return complaints;
  }

  /**
   * Load complaint data from API
   * @param {Object} filters - Filter options
   */
  async loadComplaintData(filters = {}) {
    try {
      // console.log removed for security
      this.currentFilters = filters;
      // Reset filtered count for this load
      this._filteredCount = 0;

      // CRITICAL: Role-based filter handling
      // - Coordinators and super-admins: Remove department filter (see all complaints)
      // - LGU Admins: Add department filter if not present (see only their office)
      const sanitizedFilters = { ...filters };
      if (
        this.userRole === "complaint-coordinator" ||
        this.userRole === "super-admin"
      ) {
        delete sanitizedFilters.department;
        console.log(
          "[HEATMAP] Coordinator/Super-admin detected - removing department filter from API request"
        );
      } else if (
        this.userRole === "lgu-admin" &&
        this.userDepartment &&
        !sanitizedFilters.department
      ) {
        // Automatically add department filter for LGU admins if not already present
        sanitizedFilters.department = this.userDepartment;
        console.log(
          "[HEATMAP] LGU Admin detected - adding department filter to API request:",
          this.userDepartment
        );
      }

      const queryParams = new URLSearchParams();
      // Explicitly include resolved complaints by default for heatmap
      queryParams.append(
        "includeResolved",
        sanitizedFilters.includeResolved !== false ? "true" : "false"
      );
      Object.entries(sanitizedFilters).forEach(([key, value]) => {
        // Skip includeResolved as we already set it above
        if (key === "includeResolved") return;
        if (value !== null && value !== void 0 && value !== "") {
          // Handle array values (multiple selections)
          if (Array.isArray(value) && value.length > 0) {
            value.forEach((v) => queryParams.append(key, v));
          } else if (!Array.isArray(value)) {
            queryParams.append(key, value);
          }
        }
      });

      console.log("[HEATMAP] Loading complaint data with filters:", {
        role: this.userRole,
        originalFilters: filters,
        sanitizedFilters,
        queryString: queryParams.toString(),
      });
      // console.log removed for security
      // Use apiClient for authenticated requests
      const apiClientModule = await import("../../config/apiClient.js");
      const apiClient = apiClientModule.default;
      // console.log removed for security
      const result = await apiClient.get(
        `/api/complaints/locations?${queryParams}`
      );
      // Backend service already returns data with lat/lng fields correctly formatted
      const raw = Array.isArray(result.data) ? result.data : [];
      // console.log removed for security
      // Log first item structure for debugging
      if (raw.length > 0) {
        // console.log removed for security
        // console.log removed for security
      }
      // Debug: Check if we're only getting one complaint
      if (raw.length === 1) {
        console.warn(
          "[HEATMAP] ⚠️ WARNING: Only 1 complaint received from API!"
        );
        console.warn("[HEATMAP] Filters applied:", filters);
        console.warn(
          "[HEATMAP] Check backend logs to see how many complaints exist in database."
        );
      }
      // Backend already provides lat/lng, so we just need to validate
      // Store all valid complaints (only filter by boundary, not by status/category/department)
      // Debug: Log sample complaint to check department fields
      if (raw.length > 0) {
        console.log("[HEATMAP] Sample complaint data structure:", {
          id: raw[0].id,
          title: raw[0].title,
          departments: raw[0].departments,
          department_r: raw[0].department_r,
          departments_type: typeof raw[0].departments,
          departments_isArray: Array.isArray(raw[0].departments),
          allKeys: Object.keys(raw[0]),
        });
      }

      const sanitizedData = raw
        .map((item) => {
          const lat =
            typeof item.lat === "number" ? item.lat : parseFloat(item.lat);
          const lng =
            typeof item.lng === "number" ? item.lng : parseFloat(item.lng);
          const isValid =
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180;

          if (!isValid) {
            console.warn(
              "[HEATMAP] Skipping complaint with invalid coordinates:",
              item.id,
              { lat: item.lat, lng: item.lng }
            );
            return null;
          }

          return {
            ...item,
            lat,
            lng,
            priority: item.priority || "medium",
            status: item.status || item.workflow_status || "new",
            workflow_status: item.workflow_status || item.status || "new",
            confirmation_status: item.confirmation_status || "pending",
            title: item.title || "Complaint",
            type: item.type || item.category || "General",
            category: item.category || item.type || "General",
            location: item.location || item.location_text || "",
            submittedAt:
              item.submittedAt || item.submitted_at || new Date().toISOString(),
          };
        })
        .filter(Boolean);

      this._filteredCount = 0;
      const filteredByBoundary = [];
      let withinBoundaryData = sanitizedData;

      if (this.filterByBoundary) {
        withinBoundaryData = sanitizedData.filter((item) => {
          const withinBoundary = isWithinCityBoundary(item.lat, item.lng);
          if (!withinBoundary) {
            if (filteredByBoundary.length < 3) {
              console.log(
                "[HEATMAP] Filtering out complaint outside city boundaries:",
                item.id,
                {
                  lat: item.lat,
                  lng: item.lng,
                }
              );
            }
            filteredByBoundary.push(item);
            this._filteredCount++;
            return false;
          }
          return true;
        });

        if (this._filteredCount > 0) {
          console.log(
            `[HEATMAP] Filtered out ${this._filteredCount} complaints outside city boundaries based on strict filtering.`
          );
        }
      }

      this.allComplaintData = withinBoundaryData;

      // Invalidate role cache when new data arrives
      this.roleScopedCache = null;

      // Initialize user role if not already done
      if (!this.userRole) {
        await this.initializeUserRole();
      }

      // Apply client-side filters to determine visible complaints
      this.applyClientSideFilters(filters);

      // Log summary of filtering
      console.log(`[HEATMAP] Data loading summary:`);
      console.log(`  - Raw data from API: ${raw.length} complaints`);
      console.log(
        `  - After coordinate validation: ${this.allComplaintData.length} complaints`
      );
      if (this.filterByBoundary && this._filteredCount > 0) {
        console.log(
          `  - Filtered out by boundary: ${this._filteredCount} complaint(s)`
        );
        console.log(
          `  - Remaining within boundaries: ${this.allComplaintData.length} complaint(s)`
        );
      }
      console.log(
        `  - After client-side filters: ${this.complaintData.length} complaint(s) visible`
      );
      console.log(
        `  - User role: ${this.userRole}, Department: ${
          this.userDepartment || "N/A"
        }`
      );

      // Debug: Check if we're missing complaints
      if (raw.length > this.allComplaintData.length) {
        const missing = raw.length - this.allComplaintData.length;
        console.warn(
          `[HEATMAP] ⚠️ WARNING: ${missing} complaint(s) were filtered out (invalid coordinates or outside boundaries)`
        );
      }

      // console.log removed for security
      // console.log removed for security
      // console.log removed for security
      return this.complaintData;
    } catch (error) {
      console.error("[HEATMAP] Error loading complaint data:", error);
      throw error;
    }
  }
  /**
   * Calculate maximum density value from current complaint data
   * @returns {number} Maximum intensity value
   */
  calculateMaxDensity() {
    if (!this.complaintData || this.complaintData.length === 0) {
      return this.dynamicScaling.minMaxDensity;
    }

    // Calculate raw intensity values for all complaints
    const intensities = this.complaintData.map((complaint) =>
      this.getIntensityValue(complaint)
    );

    // Find the maximum intensity
    const maxIntensity = Math.max(...intensities);

    // Ensure minimum value to prevent division by zero
    return Math.max(maxIntensity, this.dynamicScaling.minMaxDensity);
  }

  /**
   * Apply smoothing to maximum density to prevent flickering
   * Uses exponential moving average (EMA) for smooth transitions
   * Only applies smoothing when max increases (to prevent sudden jumps to red)
   * When max decreases, use the new value immediately to ensure red appears
   * @param {number} newMaxDensity - New maximum density value
   * @returns {number} Smoothed maximum density
   */
  smoothMaxDensity(newMaxDensity) {
    const { smoothedMaxDensity, smoothingFactor } = this.dynamicScaling;

    // If new max is higher, apply smoothing to prevent sudden jumps to red
    if (newMaxDensity > smoothedMaxDensity) {
      // Exponential moving average: smoothed = α * new + (1 - α) * old
      // Lower smoothingFactor = more smoothing (slower to change)
      // Higher smoothingFactor = more responsive (faster to change)
      const smoothed =
        smoothingFactor * newMaxDensity +
        (1 - smoothingFactor) * smoothedMaxDensity;
      return Math.max(smoothed, this.dynamicScaling.minMaxDensity);
    }
    // If new max is lower or equal, use it immediately
    // This ensures that when data changes, the highest point can still reach red
    return Math.max(newMaxDensity, this.dynamicScaling.minMaxDensity);
  }

  /**
   * Update dynamic scaling based on current data
   * This should be called whenever complaint data changes
   */
  updateDynamicScaling() {
    if (!this.dynamicScaling.enabled) {
      return;
    }

    // Calculate new maximum density
    const newMaxDensity = this.calculateMaxDensity();

    // If this is the first calculation (maxDensity is still at initial value of 1.0)
    // or if we have no history, reset to use the actual max immediately
    const isFirstRun =
      this.dynamicScaling.maxDensity === 1.0 &&
      this.dynamicScaling.densityHistory.length === 0;

    if (isFirstRun) {
      // First run: use actual max immediately (no smoothing)
      this.dynamicScaling.maxDensity = newMaxDensity;
      this.dynamicScaling.smoothedMaxDensity = newMaxDensity;
      console.log(
        `[HEATMAP] Dynamic scaling initialized: max=${newMaxDensity.toFixed(3)}`
      );
    } else {
      // Subsequent runs: store current max FIRST (this is what we use for normalization)
      this.dynamicScaling.maxDensity = newMaxDensity;

      // Update smoothed maximum density (only used for preventing flickering on increases)
      this.dynamicScaling.smoothedMaxDensity =
        this.smoothMaxDensity(newMaxDensity);
    }

    // Optional: Store in history for rolling average (alternative smoothing method)
    this.dynamicScaling.densityHistory.push(newMaxDensity);
    if (
      this.dynamicScaling.densityHistory.length >
      this.dynamicScaling.historySize
    ) {
      this.dynamicScaling.densityHistory.shift();
    }

    console.log(
      `[HEATMAP] Dynamic scaling updated: max=${newMaxDensity.toFixed(
        3
      )}, smoothed=${this.dynamicScaling.smoothedMaxDensity.toFixed(
        3
      )}, usingMaxForNormalization=${this.dynamicScaling.maxDensity.toFixed(3)}`
    );
  }

  /**
   * Normalize intensity value relative to current maximum density
   * Uses the actual maxDensity (not smoothed) to ensure highest point = red (1.0)
   * @param {number} intensity - Raw intensity value
   * @returns {number} Normalized intensity (0-1)
   */
  normalizeIntensity(intensity) {
    if (!this.dynamicScaling.enabled) {
      return Math.min(1.0, Math.max(0.0, intensity));
    }

    // Use actual maxDensity (not smoothed) for normalization
    // This ensures the highest point always maps to red (1.0)
    // Smoothing is only used to prevent flickering when max increases
    const { maxDensity } = this.dynamicScaling;

    // Prevent division by zero
    if (maxDensity <= 0) {
      return 0.0;
    }

    // Normalize: value / maxValue
    // The highest intensity will always be maxDensity / maxDensity = 1.0 (red)
    const normalized = intensity / maxDensity;

    // Clamp to [0, 1] range
    return Math.min(1.0, Math.max(0.0, normalized));
  }

  /**
   * Reset dynamic scaling smoothing (useful when data changes dramatically)
   * This will immediately use the new maximum density without smoothing
   */
  resetDynamicScaling() {
    const newMaxDensity = this.calculateMaxDensity();
    this.dynamicScaling.maxDensity = newMaxDensity;
    // Reset smoothed to match actual max so normalization works correctly
    this.dynamicScaling.smoothedMaxDensity = Math.max(
      newMaxDensity,
      this.dynamicScaling.minMaxDensity
    );
    this.dynamicScaling.densityHistory = [];
    console.log(
      `[HEATMAP] Dynamic scaling reset: max=${newMaxDensity.toFixed(
        3
      )}, smoothed=${this.dynamicScaling.smoothedMaxDensity.toFixed(3)}`
    );
  }

  /**
   * Enable or disable dynamic scaling
   * @param {boolean} enabled - Whether to enable dynamic scaling
   */
  setDynamicScalingEnabled(enabled) {
    this.dynamicScaling.enabled = enabled;
    console.log(
      `[HEATMAP] Dynamic scaling ${enabled ? "enabled" : "disabled"}`
    );
  }

  /**
   * Set smoothing factor for dynamic scaling
   * @param {number} factor - Smoothing factor (0-1): lower = more smoothing, higher = more responsive
   */
  setSmoothingFactor(factor) {
    this.dynamicScaling.smoothingFactor = Math.max(0, Math.min(1, factor));
    console.log(
      `[HEATMAP] Smoothing factor set to ${this.dynamicScaling.smoothingFactor}`
    );
  }

  /**
   * Create heatmap layer from complaint data
   * For heatmap: Citizens see all Digos City complaints, Coordinators see all, Admins see all (for visualization)
   * For markers: Role-based filtering applies
   */
  createHeatmapLayer() {
    // Clear old heatmap layer before creating new one
    if (this.heatmapLayer) {
      // Remove from map if it's still attached
      if (this.map && this.map.hasLayer(this.heatmapLayer)) {
        this.map.removeLayer(this.heatmapLayer);
      }
      // Remove reference
      this.heatmapLayer = null;
    }

    // Apply filters to determine which complaints should be visible
    this.applyClientSideFilters(this.currentFilters || {});

    // For heatmap visualization, use filtered complaintData
    // markers use the same filtered data
    const heatmapData = this.complaintData || [];

    if (heatmapData.length === 0) {
      console.warn("[HEATMAP] No complaint data available for heatmap");
      this.heatmapLayer = null;
      return null;
    }

    // Update dynamic scaling based on current data
    this.updateDynamicScaling();

    // Convert complaint data to heatmap format with normalized intensities
    const heatmapPoints = heatmapData.map((complaint) => {
      const rawIntensity = this.getIntensityValue(complaint);
      const normalizedIntensity = this.normalizeIntensity(rawIntensity);

      return [complaint.lat, complaint.lng, normalizedIntensity];
    });

    // Debug: Log intensity statistics
    const intensities = heatmapPoints.map((d) => d[2]);
    const maxIntensity = Math.max(...intensities);
    const minIntensity = Math.min(...intensities);
    const _intensitiesAt1 = intensities.filter((i) => i >= 0.99).length;

    // Ensure at least one point reaches 1.0 (red) by finding all max points and setting them to 1.0
    if (maxIntensity < 0.99 && intensities.length > 0) {
      console.warn(
        `[HEATMAP] ⚠️ Max intensity (${maxIntensity.toFixed(
          3
        )}) is less than 1.0. Forcing highest point(s) to 1.0.`
      );
      // Find all indices with maximum intensity and set them to 1.0
      let fixedCount = 0;
      heatmapPoints.forEach((point, _index) => {
        if (Math.abs(point[2] - maxIntensity) < 0.001) {
          point[2] = 1.0;
          fixedCount++;
        }
      });
      console.log(
        `[HEATMAP] ✓ Set ${fixedCount} point(s) with max intensity to 1.0 (red)`
      );
    }

    console.log(
      `[HEATMAP] Intensity stats: min=${minIntensity.toFixed(
        3
      )}, max=${Math.max(...heatmapPoints.map((d) => d[2])).toFixed(
        3
      )}, count at 1.0=${
        intensities.filter((i) => i >= 0.99).length
      }, maxDensity=${this.dynamicScaling.maxDensity.toFixed(3)}`
    );

    // Update heatmap config max value to ensure proper scaling
    // Leaflet.heat uses the 'max' config to scale the gradient
    const config = {
      ...this.heatmapConfig,
      max: 1.0, // Always use 1.0 since we're normalizing to [0, 1]
    };

    // console.log removed for security
    // Create heatmap layer using Leaflet.heat
    try {
      this.heatmapLayer = L.heatLayer(heatmapPoints, config);
      // console.log removed for security
      return this.heatmapLayer;
    } catch (error) {
      console.error("[HEATMAP] Error creating heatmap layer:", error);
      return null;
    }
  }
  /**
   * Calculate intensity value for heatmap based on complaint properties
   * @param {Object} complaint - Complaint data
   * @returns {number} Intensity value (0-1)
   */
  getIntensityValue(complaint) {
    let intensity = 0.5; // Base intensity
    // Adjust based on priority
    const priorityWeights = {
      low: 0.3,
      medium: 0.6,
      high: 0.9,
      urgent: 1.0,
    };
    intensity = priorityWeights[complaint.priority] || 0.5;
    // Adjust based on status
    const statusWeights = {
      "pending review": 1.0,
      "in progress": 0.8,
      resolved: 0.3,
      closed: 0.1,
      rejected: 0.2,
    };
    intensity *= statusWeights[complaint.status] || 0.5;
    // Adjust based on recency (more recent = higher intensity)
    const daysSinceSubmission =
      (Date.now() - new Date(complaint.submittedAt).getTime()) /
      (1000 * 60 * 60 * 24);
    const recencyFactor = Math.max(0.1, 1 - daysSinceSubmission / 30); // Decay over 30 days
    intensity *= recencyFactor;
    return Math.min(1.0, Math.max(0.1, intensity));
  }
  /**
   * Apply client-side filters to determine which complaints should be visible
   * @param {Object} filters - Filter criteria
   */
  applyClientSideFilters(filters = {}) {
    const baseData = this.getRoleScopedComplaints();

    if (!baseData || baseData.length === 0) {
      this.complaintData = [];
      return;
    }

    const effectiveFilters = { ...filters };
    if (this.userRole === "lgu-admin" && this.userDepartment) {
      effectiveFilters.department = this.userDepartment;
    }

    // Debug: Check sample complaints for department data

    this.complaintData = baseData.filter((complaint) => {
      // Filter by status
      if (effectiveFilters.status && effectiveFilters.status !== "") {
        const statusArray = Array.isArray(effectiveFilters.status)
          ? effectiveFilters.status
          : [effectiveFilters.status];
        const complaintStatus = (
          complaint.status ||
          complaint.workflow_status ||
          "new"
        ).toLowerCase();
        const complaintWorkflowStatus = (
          complaint.workflow_status || "new"
        ).toLowerCase();
        const complaintConfirmationStatus = (
          complaint.confirmation_status || "pending"
        ).toLowerCase();

        // Check if complaint matches any selected status
        const matchesStatus = statusArray.some((filterStatus) => {
          const filterLower = filterStatus.toLowerCase();
          // Map legacy status to workflow status
          const statusMap = {
            "pending review": "new",
            pending: "new",
            "in progress": "in_progress",
            resolved: "completed",
            completed: "completed",
            closed: "cancelled",
            rejected: "cancelled",
            cancelled: "cancelled",
          };

          const mappedStatus = statusMap[filterLower] || filterLower;

          // Check workflow_status
          if (mappedStatus === complaintWorkflowStatus) return true;
          // Check confirmation_status
          if (filterLower === complaintConfirmationStatus) return true;
          // Check legacy status field
          if (filterLower === complaintStatus) return true;

          return false;
        });

        if (!matchesStatus) return false;
      }

      // Filter by category (UUIDs from categories table)
      if (effectiveFilters.category && effectiveFilters.category !== "") {
        const categoryArray = Array.isArray(effectiveFilters.category)
          ? effectiveFilters.category
          : [effectiveFilters.category];
        // complaint.category should be a UUID that matches the filter UUIDs
        const complaintCategory = complaint.category || "";
        if (!complaintCategory || !categoryArray.includes(complaintCategory))
          return false;
      }

      // Filter by subcategory (UUIDs from subcategories table)
      if (effectiveFilters.subcategory && effectiveFilters.subcategory !== "") {
        const subcategoryArray = Array.isArray(effectiveFilters.subcategory)
          ? effectiveFilters.subcategory
          : [effectiveFilters.subcategory];
        // complaint.subcategory should be a UUID that matches the filter UUIDs
        const complaintSubcategory = complaint.subcategory || "";
        if (
          !complaintSubcategory ||
          !subcategoryArray.includes(complaintSubcategory)
        )
          return false;
      }

      // Filter by department - checks departments array (backend transforms department_r to departments)
      if (effectiveFilters.department && effectiveFilters.department !== "") {
        const departmentArray = Array.isArray(effectiveFilters.department)
          ? effectiveFilters.department
          : [effectiveFilters.department];
        // Get complaint's assigned departments - backend returns as 'departments' field (from department_r)
        // Fallback to department_r in case backend format changes
        const complaintDepartments = this.getComplaintDepartments(complaint);

        // Debug logging

        // If complaint has no departments assigned, exclude it from results
        if (complaintDepartments.length === 0) {
          return false;
        }

        // Check if any selected department code matches any department in departments array
        // Use case-insensitive comparison to handle any case variations
        const matchesDepartment = departmentArray.some((filterDept) => {
          const filterDeptUpper = String(filterDept || "")
            .toUpperCase()
            .trim();
          return complaintDepartments.some((complaintDept) => {
            const complaintDeptUpper = String(complaintDept || "")
              .toUpperCase()
              .trim();
            return complaintDeptUpper === filterDeptUpper;
          });
        });

        if (!matchesDepartment) {
          return false;
        }
      }

      // Filter by includeResolved
      if (effectiveFilters.includeResolved === false) {
        const workflowStatus = (
          complaint.workflow_status || "new"
        ).toLowerCase();
        if (workflowStatus === "completed" || workflowStatus === "cancelled") {
          return false;
        }
      }

      // Filter by date range
      if (effectiveFilters.startDate || effectiveFilters.endDate) {
        const complaintDate = new Date(
          complaint.submittedAt || complaint.submitted_at
        );
        if (isNaN(complaintDate.getTime())) {
          return false; // Invalid date, exclude
        }

        if (effectiveFilters.startDate) {
          const startDate = new Date(effectiveFilters.startDate);
          startDate.setHours(0, 0, 0, 0);
          if (complaintDate < startDate) {
            return false;
          }
        }

        if (effectiveFilters.endDate) {
          const endDate = new Date(effectiveFilters.endDate);
          endDate.setHours(23, 59, 59, 999);
          if (complaintDate > endDate) {
            return false;
          }
        }
      }

      return true;
    });

    // Debug logging after filtering
  }

  /**
   * Create individual complaint markers (only called once on initial load)
   * Role-based filtering: Citizens don't see markers, Coordinators see all, Admins see assigned only
   */
  createMarkerLayer() {
    // Only create markers if they don't exist yet
    if (this.markerLayer && this.markerLayer.getLayers().length > 0) {
      console.log("[HEATMAP] Markers already exist, skipping recreation");
      // Don't update visibility here - let the caller handle it based on zoom level
      return this.markerLayer;
    }

    if (!this.allComplaintData || this.allComplaintData.length === 0) {
      console.warn("[HEATMAP] No complaint data to create markers from");
      this.markerLayer = null;
      return null;
    }

    // Initialize user role if not already done
    if (!this.userRole) {
      // Synchronous fallback - role should be initialized in loadComplaintData
      console.warn(
        "[HEATMAP] User role not initialized, defaulting to citizen"
      );
      this.userRole = "citizen";
    }

    // Filter complaints for markers based on role
    let complaintsForMarkers = this.getRoleScopedComplaints();

    // Citizens: No markers (only heatmap)
    if (this.userRole === "citizen") {
      console.log(
        "[HEATMAP] Citizen role: Markers disabled, only heatmap shown"
      );
      this.markerLayer = L.layerGroup(); // Empty layer group
      this.markerMap.clear();
      return this.markerLayer;
    }

    // Complaint coordinators and super-admin: All markers
    if (
      this.userRole === "complaint-coordinator" ||
      this.userRole === "super-admin"
    ) {
      complaintsForMarkers = this.allComplaintData;
      console.log("[HEATMAP] Coordinator/Super-admin: Showing all markers");
    }
    // LGU Admins: Only complaints assigned to their office/department
    else if (this.userRole === "lgu-admin" && this.userDepartment) {
      complaintsForMarkers = this.getRoleScopedComplaints();
      console.log(
        `[HEATMAP] LGU Admin (${this.userDepartment}): Showing ${complaintsForMarkers.length} assigned complaints out of ${this.allComplaintData.length} total`
      );
    }
    // Default: No markers
    else {
      console.log(`[HEATMAP] Role ${this.userRole}: Markers disabled`);
      this.markerLayer = L.layerGroup(); // Empty layer group
      this.markerMap.clear();
      return this.markerLayer;
    }

    // Create marker layer and store all markers
    // IMPORTANT: Do NOT add layer to map during creation - caller will handle visibility
    this.markerLayer = L.layerGroup();
    this.markerMap.clear();

    complaintsForMarkers.forEach((complaint, index) => {
      try {
        const marker = this.createComplaintMarker(complaint, index);
        // Add marker to layer group (but NOT to map)
        this.markerLayer.addLayer(marker);
        // Store marker reference by complaint ID for quick lookup
        if (complaint.id) {
          this.markerMap.set(complaint.id, marker);
        }
        // Ensure marker is NOT on the map (safety check)
        if (this.map && this.map.hasLayer(marker)) {
          this.map.removeLayer(marker);
        }
      } catch (error) {
        console.error(
          `[HEATMAP] Failed to create marker ${index + 1}:`,
          error,
          complaint
        );
      }
    });

    console.log(
      `[HEATMAP] Created ${
        this.markerLayer.getLayers().length
      } marker(s) for all complaints`
    );

    // CRITICAL: Ensure marker layer is NOT on the map during creation
    // The caller will handle adding/removing based on zoom level and initial load state
    if (this.map && this.map.hasLayer(this.markerLayer)) {
      this.map.removeLayer(this.markerLayer);
    }

    // Don't apply visibility here - let the caller handle it based on zoom level
    // Markers will be shown/hidden by updateZoomBasedVisibility() in heatmap-init.js

    return this.markerLayer;
  }

  /**
   * Update marker visibility based on current filters (show/hide without removing)
   */
  updateMarkerVisibility() {
    if (!this.markerLayer || !this.map) return;

    // Check if we're in initial load mode (markers should stay hidden)
    // This is a safety check - the caller should prevent this during initial load
    if (window.isInitialLoad === true) {
      // During initial load, don't show markers - just ensure they're hidden
      this.markerLayer.eachLayer((marker) => {
        if (this.map.hasLayer(marker)) {
          this.map.removeLayer(marker);
        }
      });
      if (this.map.hasLayer(this.markerLayer)) {
        this.map.removeLayer(this.markerLayer);
      }
      return;
    }

    // Apply filters to determine which complaints should be visible
    this.applyClientSideFilters(this.currentFilters || {});

    const visibleComplaintIds = new Set(this.complaintData.map((c) => c.id));
    let visibleCount = 0;
    let hiddenCount = 0;

    // Ensure marker layer is on the map first (only if not initial load)
    if (!this.map.hasLayer(this.markerLayer)) {
      this.markerLayer.addTo(this.map);
    }

    // Update visibility of each marker
    this.markerLayer.eachLayer((marker) => {
      // Get complaint ID from marker (try multiple ways)
      const complaintId =
        marker._complaintId ||
        marker.options?.complaintId ||
        (this.markerMap &&
          Array.from(this.markerMap.entries()).find(
            ([_id, m]) => m === marker
          )?.[0]);

      // Determine if marker should be visible
      let shouldBeVisible = false;
      if (complaintId) {
        shouldBeVisible = visibleComplaintIds.has(complaintId);
      } else {
        // Fallback: check by coordinates (less reliable but works if ID is missing)
        const latLng = marker.getLatLng();
        shouldBeVisible = this.complaintData.some(
          (c) =>
            Math.abs(c.lat - latLng.lat) < 0.0001 &&
            Math.abs(c.lng - latLng.lng) < 0.0001
        );
      }

      // Show or hide marker based on filter match
      // Note: Markers are part of markerLayer, so we manage visibility by adding/removing from layer
      if (shouldBeVisible) {
        // Show marker - ensure it's in the layer (it should be, but check anyway)
        if (!this.markerLayer.hasLayer(marker)) {
          this.markerLayer.addLayer(marker);
        }
        // Also ensure it's visible on the map
        if (!this.map.hasLayer(marker)) {
          marker.addTo(this.map);
        }
        visibleCount++;
      } else {
        // Hide marker by removing from map (but keep in layer for later)
        if (this.map.hasLayer(marker)) {
          this.map.removeLayer(marker);
        }
        hiddenCount++;
      }
    });

    // Dispatch custom event for marker visibility update
    if (typeof window !== "undefined" && window.dispatchEvent) {
      const event = new CustomEvent("markerVisibilityUpdated", {
        detail: {
          visibleCount,
          hiddenCount,
          totalCount: this.markerLayer.getLayers().length,
        },
      });
      window.dispatchEvent(event);
    }
  }
  /**
   * Create clickable circles for complaints
   */
  createCircleLayer() {
    if (!this.complaintData || this.complaintData.length === 0) {
      return null;
    }
    this.circleLayer = L.layerGroup();
    // console.log removed for security
    this.complaintData.forEach((complaint, _index) => {
      // console.log removed for security
      const circle = this.createComplaintCircle(complaint);
      this.circleLayer.addLayer(circle);
    });
    // console.log removed for security
    return this.circleLayer;
  }
  /**
   * Create individual complaint marker
   * @param {Object} complaint - Complaint data
   * @param {number} index - Index of the complaint (for unique styling)
   * @returns {L.Marker} Leaflet marker
   */
  createComplaintMarker(complaint, index = 0) {
    const icon = this.getComplaintIcon(complaint, index);
    const marker = L.marker([complaint.lat, complaint.lng], {
      icon,
      // Add z-index offset to prevent stacking
      zIndexOffset: 1000 + index * 10,
      // Store complaint ID for filtering
      complaintId: complaint.id,
    });
    // Also store directly on marker for quick access
    marker._complaintId = complaint.id;
    // Create popup content
    const popupContent = this.createComplaintPopup(complaint);
    marker.bindPopup(popupContent, {
      maxWidth: 250,
      className: "complaint-popup",
    });
    return marker;
  }
  /**
   * Create clickable circle for complaint
   * @param {Object} complaint - Complaint data
   * @returns {L.Circle} Leaflet circle
   */
  createComplaintCircle(complaint) {
    const priorityColors = {
      low: "#28a745",
      medium: "#ffc107",
      high: "#fd7e14",
      urgent: "#dc3545",
    };
    const statusColors = {
      "pending review": "#6c757d",
      "in progress": "#17a2b8",
      resolved: "#28a745",
      closed: "#6c757d",
      rejected: "#dc3545",
    };
    // Use priority color for fill, status color for border
    const fillColor = priorityColors[complaint.priority] || "#6c757d";
    const borderColor = statusColors[complaint.status] || "#6c757d";
    // Circle size based on priority
    const radiusSizes = {
      low: 50,
      medium: 75,
      high: 100,
      urgent: 125,
    };
    const radius = radiusSizes[complaint.priority] || 75;
    const circle = L.circle([complaint.lat, complaint.lng], {
      radius,
      color: borderColor,
      weight: 3,
      opacity: 0.8,
      fillColor,
      fillOpacity: 0.4,
      className: "complaint-circle",
    });
    // Add hover effects
    circle.on("mouseover", function (_e) {
      this.setStyle({
        weight: 5,
        fillOpacity: 0.6,
      });
    });
    circle.on("mouseout", function (_e) {
      this.setStyle({
        weight: 3,
        fillOpacity: 0.4,
      });
    });
    // Create detailed popup content (async)
    circle.bindPopup(
      async () => {
        return await this.createDetailedComplaintPopup(complaint);
      },
      {
        maxWidth: 280,
        className: "complaint-circle-popup",
        closeButton: true,
        autoClose: false,
        keepInView: true,
      }
    );
    // Add click event for additional actions
    circle.on("click", (_e) => {
      // console.log removed for security
      // You can add additional click actions here
    });
    return circle;
  }
  /**
   * Get appropriate icon for complaint
   * @param {Object} complaint - Complaint data
   * @param {number} index - Index of the complaint (for unique styling)
   * @returns {L.Icon} Leaflet icon
   */
  getComplaintIcon(complaint, index = 0) {
    // Color based on complaint status
    // Handles both 'status' and 'workflow_status' fields
    const statusColors = {
      // Standard status values
      new: "#6B7280", // Gray
      pending: "#6B7280", // Gray
      "pending review": "#6B7280", // Gray
      assigned: "#FBBF24", // Yellow
      "in progress": "#3B82F6", // Blue
      in_progress: "#3B82F6", // Blue
      resolved: "#10B981", // Green
      completed: "#10B981", // Green
      closed: "#10B981", // Green
      rejected: "#EF4444", // Red (Use urgent/high color for rejected as alert) or keep gray? Legend doesn't explicitly have rejected. Keeping red or gray. Let's make it Gray to match "Completed" or similar? No, rejected is bad.
      // Wait, User only specified New/Pending, Assigned, In Progress, Completed.
      // I will map others to these core 4 or keep sensible defaults.
      // Rejected -> Gray or Red. Let's stick to Gray for now as it's not "active". Actually let's use the explicit ones first.

      // Workflow status values
      pending_approval: "#FBBF24", // Yellow (Assume similar to assigned/pending)

      // Confirmation status values - mapping to closest visual match
      waiting_for_responders: "#3B82F6", // Blue
      waiting_for_complainant: "#FBBF24", // Yellow
      confirmed: "#10B981", // Green
      disputed: "#EF4444", // Red
      cancelled: "#6B7280", // Gray
    };

    // Check both status and workflow_status fields
    let status = (
      complaint.status ||
      complaint.workflow_status ||
      "pending review"
    ).toLowerCase();

    // If status is not found, try confirmation_status
    if (!statusColors[status] && complaint.confirmation_status) {
      status = complaint.confirmation_status.toLowerCase();
    }

    const color = statusColors[status] || "#6c757d"; // Default to gray if status unknown

    // Dynamic sizing based on zoom level
    const currentZoom = this.map ? this.map.getZoom() : 12;
    const baseSize = 12; // Base size in pixels
    const zoomFactor = Math.max(0.7, Math.min(1.5, currentZoom / 12)); // Scale between 0.7x and 1.5x
    const size = Math.round(baseSize * zoomFactor);
    const borderWidth = Math.max(2, Math.round(2 * zoomFactor));

    // Add a small border color based on priority for additional visual distinction
    const priorityBorderColors = {
      low: "#10B981", // Green border
      medium: "#FBBF24", // Yellow border
      high: "#F97316", // Orange border
      urgent: "#EF4444", // Red border
    };
    const priority = (complaint.priority || "medium").toLowerCase();
    const borderColor = priorityBorderColors[priority] || "#ffffff";

    return L.divIcon({
      html: `<div style="
        background-color: ${color};
        color: white;
        border-radius: 50%;
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: ${borderWidth}px solid ${borderColor};
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        z-index: ${1000 + index};
        position: relative;
        cursor: pointer;
        transition: all 0.2s ease;
      "></div>`,
      className: "complaint-marker",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  }
  /**
   * Create popup content for complaint
   * @param {Object} complaint - Complaint data
   * @returns {string} HTML content
   */
  createComplaintPopup(complaint) {
    const submittedDate = new Date(complaint.submittedAt).toLocaleDateString();
    const priorityClass = complaint.priority.replace(" ", "-").toLowerCase();
    const assignedOffices =
      complaint.departments && complaint.departments.length > 0
        ? complaint.departments.join(", ")
        : complaint.department || "Not assigned";

    return `
      <div class="complaint-popup-content" style="padding: 8px; font-size: 12px; line-height: 1.3;">
        <h4 style="margin: 0 0 6px 0; font-size: 13px; font-weight: bold;">${
  complaint.title
}</h4>
        <div class="complaint-details" style="margin: 0; padding: 0;">
          <p style="margin: 2px 0; font-size: 11px;"><strong>Type:</strong> ${
  complaint.type
}</p>
          <p style="margin: 2px 0; font-size: 11px;"><strong>Status:</strong> <span class="status-${complaint.status.replace(
    " ",
    "-"
  )}">${complaint.status}</span></p>
          <p style="margin: 2px 0; font-size: 11px;"><strong>Priority:</strong> <span class="priority-${priorityClass}">${
  complaint.priority
}</span></p>
          <p style="margin: 2px 0; font-size: 11px;"><strong>Location:</strong> ${
  complaint.location
}</p>
          <p style="margin: 2px 0; font-size: 11px;"><strong>Submitted:</strong> ${submittedDate}</p>
          <p style="margin: 2px 0; font-size: 11px;"><strong>Assigned Offices:</strong> ${assignedOffices}</p>
        </div>
      </div>
    `;
  }

  /**
   * Create detailed popup content for complaint circles
   * @param {Object} complaint - Complaint data
   * @returns {string} HTML content
   */
  async createDetailedComplaintPopup(complaint) {
    const submittedDate = new Date(complaint.submittedAt).toLocaleDateString();
    const _submittedTime = new Date(complaint.submittedAt).toLocaleTimeString();
    const priorityClass = complaint.priority.replace(" ", "-").toLowerCase();
    const statusClass = complaint.status.replace(" ", "-").toLowerCase();
    const assignedOffices =
      complaint.departments && complaint.departments.length > 0
        ? complaint.departments.join(", ")
        : complaint.department || "Not assigned";

    // Calculate days since submission
    const daysSinceSubmission = Math.floor(
      (Date.now() - new Date(complaint.submittedAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    // Check if user has access to this complaint
    const hasAccess = await this.checkComplaintAccess(complaint);

    if (!hasAccess) {
      return `
        <div class="complaint-detail-popup" style="padding: 8px; font-size: 12px; line-height: 1.3; max-width: 280px;">
          <div class="popup-header" style="margin: 0 0 6px 0; padding: 0;">
            <h3 style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold;">${
  complaint.title
}</h3>
            <div class="complaint-badges" style="display: flex; gap: 4px; margin: 0;">
              <span class="badge priority-${priorityClass}" style="font-size: 9px; padding: 2px 4px;">${complaint.priority.toUpperCase()}</span>
              <span class="badge status-${statusClass}" style="font-size: 9px; padding: 2px 4px;">${complaint.status.toUpperCase()}</span>
            </div>
          </div>
          <div class="popup-content" style="margin: 0; padding: 0;">
            <div class="complaint-info" style="margin: 0; padding: 0;">
              <div class="info-row" style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
                <span class="label" style="font-weight: bold;">Type:</span>
                <span class="value">${complaint.type}</span>
              </div>
              <div class="info-row" style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
                <span class="label" style="font-weight: bold;">Location:</span>
                <span class="value" style="text-align: right; max-width: 60%;">${
  complaint.location
}</span>
              </div>
              <div class="info-row" style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
                <span class="label" style="font-weight: bold;">Assigned Offices:</span>
                <span class="value" style="text-align: right; max-width: 60%;">${assignedOffices}</span>
              </div>
              <div class="info-row" style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
                <span class="label" style="font-weight: bold;">Submitted:</span>
                <span class="value">${submittedDate}</span>
              </div>
              <div class="info-row" style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
                <span class="label" style="font-weight: bold;">Days Open:</span>
                <span class="value">${daysSinceSubmission} day${
  daysSinceSubmission !== 1 ? "s" : ""
}</span>
              </div>
            </div>
            <div class="popup-actions" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #ddd;">
              <div class="access-denied" style="font-size: 10px; color: #dc3545; text-align: center; padding: 4px;">
                <p style="margin: 0;">🔒 Access restricted to assigned office</p>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="complaint-detail-popup" style="padding: 8px; font-size: 12px; line-height: 1.3; max-width: 280px;">
        <div class="popup-header" style="margin: 0 0 6px 0; padding: 0;">
          <h3 style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold;">${
  complaint.title
}</h3>
          <div class="complaint-badges" style="display: flex; gap: 4px; margin: 0;">
            <span class="badge priority-${priorityClass}" style="font-size: 9px; padding: 2px 4px;">${complaint.priority.toUpperCase()}</span>
            <span class="badge status-${statusClass}" style="font-size: 9px; padding: 2px 4px;">${complaint.status.toUpperCase()}</span>
          </div>
        </div>
        <div class="popup-content" style="margin: 0; padding: 0;">
          <div class="complaint-info" style="margin: 0; padding: 0;">
            <div class="info-row" style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
              <span class="label" style="font-weight: bold;">Type:</span>
              <span class="value">${complaint.type}</span>
            </div>
            <div class="info-row" style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
              <span class="label" style="font-weight: bold;">Location:</span>
              <span class="value" style="text-align: right; max-width: 60%;">${
  complaint.location
}</span>
            </div>
            <div class="info-row" style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
              <span class="label" style="font-weight: bold;">Assigned Offices:</span>
              <span class="value" style="text-align: right; max-width: 60%;">${assignedOffices}</span>
            </div>
            <div class="info-row" style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
              <span class="label" style="font-weight: bold;">Submitted:</span>
              <span class="value">${submittedDate}</span>
            </div>
            <div class="info-row" style="margin: 2px 0; font-size: 11px; display: flex; justify-content: space-between;">
              <span class="label" style="font-weight: bold;">Days Open:</span>
              <span class="value">${daysSinceSubmission} day${
  daysSinceSubmission !== 1 ? "s" : ""
}</span>
            </div>
          </div>
          <div class="popup-actions" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #ddd; display: flex; gap: 4px;">
            <button class="btn-details" onclick="viewComplaintDetails('${
  complaint.id
}')" style="font-size: 10px; padding: 4px 8px; flex: 1;">
              📋 Details
            </button>
            <button class="btn-location" onclick="centerOnComplaint(${
  complaint.lat
}, ${
  complaint.lng
})" style="font-size: 10px; padding: 4px 8px; flex: 1;">
              📍 Center
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Check if user has access to view full details of a complaint
   * @param {Object} complaint - Complaint data
   * @returns {boolean} True if user has access
   */
  async checkComplaintAccess(complaint) {
    try {
      // Import getUserRole function
      const { getUserRole } = await import("../../auth/authChecker.js");
      const userRole = await getUserRole();

      // console.log removed for security
      // console.log removed for security
      // console.log removed for security

      // Super admin has access to everything
      if (userRole === "super-admin") {
        // console.log removed for security
        return true;
      }

      // Complaint coordinator has access to everything
      if (userRole === "complaint-coordinator") {
        // console.log removed for security
        return true;
      }

      // With simplified roles, department is stored separately in metadata
      let userDepartment = null;
      if (userRole && ["lgu", "lgu-admin", "lgu-hr"].includes(userRole)) {
        // Get department from user metadata
        try {
          const { supabase } = await import("../../config/config.js");
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const metadata =
            session?.user?.raw_user_meta_data ||
            session?.user?.user_metadata ||
            {};
          userDepartment = metadata.dpt || metadata.department;
        } catch (error) {
          console.warn("Failed to get department from metadata:", error);
        }
      }

      // console.log removed for security

      if (!userDepartment) {
        // console.log removed for security
        return false;
      }

      // Check if complaint is assigned to user's department
      const complaintDepartment = complaint.department?.toUpperCase();
      const complaintDepartments = complaint.departments || [];
      const secondaryDepartments = complaint.secondaryDepartments || [];

      // Check primary department
      if (complaintDepartment === userDepartment) {
        // console.log removed for security
        return true;
      }

      // Check if user's department is in the departments array
      if (complaintDepartments.includes(userDepartment)) {
        // console.log removed for security
        return true;
      }

      // Check if user's department is in secondary departments
      if (secondaryDepartments.includes(userDepartment)) {
        // console.log removed for security
        return true;
      }

      // Check if it's a joint/forced complaint (multiple departments)
      if (complaintDepartment && complaintDepartment.includes(",")) {
        const assignedDepartments = complaintDepartment
          .split(",")
          .map((dept) => dept.trim().toUpperCase());
        if (assignedDepartments.includes(userDepartment)) {
          // console.log removed for security
          return true;
        }
      }

      // console.log removed for security
      return false;
    } catch (error) {
      console.error("[HEATMAP] Error checking complaint access:", error);
      return false;
    }
  }

  /**
   * Perform DBSCAN clustering on complaint data
   */
  performClustering() {
    try {
      if (!this.complaintData || this.complaintData.length === 0) {
        console.warn("[HEATMAP] No complaint data available for clustering");
        return { clusters: [], noise: [] };
      }

      // Ensure DBSCAN is initialized
      if (!this.dbscan) {
        console.error("[HEATMAP] DBSCAN not initialized");
        return { clusters: [], noise: [] };
      }

      // Update DBSCAN parameters
      this.dbscan.eps = this.clusterConfig.eps;
      this.dbscan.minPts = this.clusterConfig.minPts;

      // Prepare points for clustering - filter out invalid coordinates
      const points = this.complaintData
        .filter((complaint) => {
          const lat = parseFloat(complaint.lat);
          const lng = parseFloat(complaint.lng);
          return (
            !isNaN(lat) &&
            !isNaN(lng) &&
            lat >= -90 &&
            lat <= 90 &&
            lng >= -180 &&
            lng <= 180
          );
        })
        .map((complaint) => ({
          lat: parseFloat(complaint.lat),
          lng: parseFloat(complaint.lng),
          data: complaint,
        }));

      if (points.length === 0) {
        console.warn("[HEATMAP] No valid coordinates for clustering");
        return { clusters: [], noise: [] };
      }

      // Perform clustering
      const clusteringResult = this.dbscan.cluster(points);
      this.clusters = clusteringResult.clusters || [];

      return clusteringResult;
    } catch (error) {
      console.error("[HEATMAP] Clustering failed:", error);
      return { clusters: [], noise: [] };
    }
  }

  /**
   * Create cluster visualization layer
   */
  createClusterLayer() {
    if (!this.clusters || this.clusters.length === 0) {
      return null;
    }

    this.clusterLayer = L.layerGroup();

    this.clusters.forEach((cluster, index) => {
      const clusterPoints = cluster.map((i) => this.complaintData[i]);
      const clusterCenter = this.calculateClusterCenter(clusterPoints);
      const clusterRadius = this.calculateClusterRadius(
        clusterPoints,
        clusterCenter
      );

      // Create cluster circle
      const clusterCircle = L.circle(clusterCenter, {
        radius: clusterRadius * 1000, // Convert km to meters
        color:
          this.clusterConfig.clusterColors[
            index % this.clusterConfig.clusterColors.length
          ],
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.2,
      });

      // Create cluster marker
      const clusterMarker = L.marker(clusterCenter, {
        icon: L.divIcon({
          html: `<div style="
            background-color: ${
  this.clusterConfig.clusterColors[
    index % this.clusterConfig.clusterColors.length
  ]
};
            color: white;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 16px;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          ">${cluster.length}</div>`,
          className: "cluster-marker",
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }),
      });

      // Create cluster popup
      const popupContent = this.createClusterPopup(clusterPoints, index);
      clusterMarker.bindPopup(popupContent, {
        maxWidth: 400,
        className: "cluster-popup",
      });

      this.clusterLayer.addLayer(clusterCircle);
      this.clusterLayer.addLayer(clusterMarker);
    });

    // console.log removed for security
    return this.clusterLayer;
  }

  /**
   * Calculate cluster center (centroid)
   * @param {Array} points - Array of complaint points
   * @returns {Object} Center coordinates
   */
  calculateClusterCenter(points) {
    const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
    return { lat, lng };
  }

  /**
   * Calculate cluster radius
   * @param {Array} points - Array of complaint points
   * @param {Object} center - Cluster center
   * @returns {number} Radius in kilometers
   */
  calculateClusterRadius(points, center) {
    let maxDistance = 0;
    points.forEach((point) => {
      const distance = this.dbscan.calculateDistance(center, point);
      maxDistance = Math.max(maxDistance, distance);
    });
    return maxDistance;
  }

  /**
   * Create cluster popup content
   * @param {Array} clusterPoints - Points in the cluster
   * @param {number} clusterIndex - Cluster index
   * @returns {string} HTML content
   */
  createClusterPopup(clusterPoints, clusterIndex) {
    const statusCounts = {};
    const typeCounts = {};
    const priorityCounts = {};

    clusterPoints.forEach((complaint) => {
      statusCounts[complaint.status] =
        (statusCounts[complaint.status] || 0) + 1;
      typeCounts[complaint.type] = (typeCounts[complaint.type] || 0) + 1;
      priorityCounts[complaint.priority] =
        (priorityCounts[complaint.priority] || 0) + 1;
    });

    return `
      <div class="cluster-popup-content">
        <h4>Cluster ${clusterIndex + 1} (${
  clusterPoints.length
} complaints)</h4>
        <div class="cluster-stats">
          <h5>Status Distribution:</h5>
          <ul>
            ${Object.entries(statusCounts)
    .map(([status, count]) => `<li>${status}: ${count}</li>`)
    .join("")}
          </ul>
          <h5>Type Distribution:</h5>
          <ul>
            ${Object.entries(typeCounts)
    .map(([type, count]) => `<li>${type}: ${count}</li>`)
    .join("")}
          </ul>
          <h5>Priority Distribution:</h5>
          <ul>
            ${Object.entries(priorityCounts)
    .map(([priority, count]) => `<li>${priority}: ${count}</li>`)
    .join("")}
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * Show heatmap on map
   */
  showHeatmap() {
    if (!this.heatmapLayer || !this.map) {
      console.warn("[HEATMAP] Cannot show heatmap: layer or map is null");
      return;
    }

    const container =
      typeof this.map.getContainer === "function"
        ? this.map.getContainer()
        : null;
    const width = container?.offsetWidth || 0;
    const height = container?.offsetHeight || 0;

    // If the map container hasn't been laid out yet, retry shortly
    if (width === 0 || height === 0) {
      setTimeout(() => this.showHeatmap(), 150);
      return;
    }

    try {
      // Ensure Leaflet recalculates sizes before drawing the heat canvas
      this.map.invalidateSize();
      this.heatmapLayer.addTo(this.map);
      // console.log removed for security

      // Verify it's actually on the map
      setTimeout(() => {
        const _hasLayer = this.map._hasLayer(this.heatmapLayer);
        // console.log removed for security
      }, 100);
    } catch (e) {
      console.error("[HEATMAP] Error showing heatmap:", e);
      // Fallback: retry once after a brief delay if canvas was still 0-sized
      setTimeout(() => {
        try {
          this.map.invalidateSize();
          this.heatmapLayer.addTo(this.map);
          // console.log removed for security
        } catch (error) {
          console.error("[HEATMAP] Failed to show heatmap on retry:", error);
        }
      }, 200);
    }
  }

  /**
   * Hide heatmap from map
   */
  hideHeatmap() {
    if (this.heatmapLayer && this.map.hasLayer(this.heatmapLayer)) {
      this.map.removeLayer(this.heatmapLayer);
    }
  }

  /**
   * Show markers on map
   */
  showMarkers() {
    if (!this.markerLayer) {
      console.warn("[HEATMAP] Cannot show markers: markerLayer is null");
      return;
    }

    if (!this.map) {
      console.warn("[HEATMAP] Cannot show markers: map is null");
      return;
    }

    // console.log removed for security
    this.markerLayer.addTo(this.map);

    // Verify markers are actually on the map
    setTimeout(() => {
      const hasLayer = this.map.hasLayer(this.markerLayer);
      const layerCount = this.markerLayer.getLayers().length;
      // console.log removed for security

      if (hasLayer && layerCount > 0) {
        // Get bounds of all markers to verify they're valid
        try {
          const layers = this.markerLayer.getLayers();
          if (layers.length > 0) {
            const firstMarker = layers[0];
            if (firstMarker && firstMarker.getLatLng) {
              const _latLng = firstMarker.getLatLng();
              // console.log removed for security
            }
          }
        } catch (error) {
          console.warn("[HEATMAP] Could not get marker bounds:", error);
        }
      }
    }, 100);
  }

  /**
   * Hide markers from map (but keep them in the layer for later use)
   */
  hideMarkers() {
    if (this.markerLayer && this.markerLayer.getLayers) {
      try {
        // Remove each marker individually from map (but keep in layer)
        const layers = this.markerLayer.getLayers();
        layers.forEach((layer) => {
          if (
            layer &&
            this.map &&
            this.map.hasLayer &&
            this.map.hasLayer(layer)
          ) {
            this.map.removeLayer(layer);
          }
        });
        // Remove the layer group from map if attached
        if (
          this.map &&
          this.map.hasLayer &&
          this.map.hasLayer(this.markerLayer)
        ) {
          this.map.removeLayer(this.markerLayer);
        }
        // DO NOT clear markers from the layer - we want to keep them for when zoom > 11
        // this.markerLayer.clearLayers(); // REMOVED - this was causing markers to disappear
      } catch (error) {
        console.warn("[HEATMAP] Error hiding markers:", error);
        // Fallback: just remove the layer from map
        if (this.map && this.map.removeLayer) {
          try {
            this.map.removeLayer(this.markerLayer);
          } catch (e) {
            // Ignore if already removed
          }
        }
      }
    }
  }

  /**
   * Update marker sizes and colors based on current zoom level and complaint data
   * This ensures markers reflect current status and priority
   */
  updateMarkerSizes() {
    if (!this.markerLayer || !this.map) return;

    const markers = this.markerLayer.getLayers();
    markers.forEach((marker, index) => {
      // Get the original complaint data from marker's lat/lng
      const latLng = marker.getLatLng();
      const complaint = this.complaintData.find(
        (c) =>
          Math.abs(c.lat - latLng.lat) < 0.0001 &&
          Math.abs(c.lng - latLng.lng) < 0.0001
      );

      if (complaint) {
        // Create new icon with updated size and color based on current zoom and complaint status
        const newIcon = this.getComplaintIcon(complaint, index);
        marker.setIcon(newIcon);
      }
    });
  }

  /**
   * Update a specific marker's appearance when complaint data changes
   * @param {string} complaintId - ID of the complaint to update
   */
  updateMarker(complaintId) {
    if (!this.markerLayer || !this.map) return;

    const complaint = this.complaintData.find((c) => c.id === complaintId);
    if (!complaint) return;

    const markers = this.markerLayer.getLayers();
    const marker = markers.find((m) => {
      const latLng = m.getLatLng();
      return (
        Math.abs(complaint.lat - latLng.lat) < 0.0001 &&
        Math.abs(complaint.lng - latLng.lng) < 0.0001
      );
    });

    if (marker) {
      const index = markers.indexOf(marker);
      const newIcon = this.getComplaintIcon(complaint, index);
      marker.setIcon(newIcon);
    }
  }

  /**
   * Refresh all markers to reflect current complaint data (status, priority, etc.)
   * Useful when complaint data is updated externally
   */
  refreshMarkers() {
    if (!this.markerLayer || !this.map) return;

    // Hide and recreate marker layer to ensure all markers reflect current data
    this.hideMarkers();
    this.createMarkerLayer();
    this.showMarkers();
  }

  /**
   * Show circles on map
   */
  showCircles() {
    if (this.circleLayer) {
      this.circleLayer.addTo(this.map);
    }
  }

  /**
   * Hide circles from map
   */
  hideCircles() {
    if (this.circleLayer && this.map.hasLayer(this.circleLayer)) {
      this.map.removeLayer(this.circleLayer);
    }
  }

  /**
   * Show clusters on map
   */
  showClusters() {
    if (this.clusterLayer) {
      this.clusterLayer.addTo(this.map);
    }
  }

  /**
   * Hide clusters from map
   */
  hideClusters() {
    if (this.clusterLayer && this.map.hasLayer(this.clusterLayer)) {
      this.map.removeLayer(this.clusterLayer);
    }
  }

  /**
   * Update clustering parameters
   * @param {number} eps - Epsilon parameter
   * @param {number} minPts - Minimum points parameter
   */
  updateClusteringParameters(eps, minPts) {
    this.clusterConfig.eps = eps;
    this.clusterConfig.minPts = minPts;

    // Re-cluster if clustering is enabled
    if (this.isClusteringEnabled) {
      this.performClustering();
      this.hideClusters();
      this.createClusterLayer();
      this.showClusters();
    }
  }

  /**
   * Toggle clustering on/off
   * @param {boolean} enabled - Whether clustering should be enabled
   */
  toggleClustering(enabled) {
    this.isClusteringEnabled = enabled;

    if (enabled) {
      this.performClustering();
      this.createClusterLayer();
      this.showClusters();
    } else {
      this.hideClusters();
    }
  }

  /**
   * Get clustering statistics
   * @returns {Object} Statistics about current clustering
   */
  getClusteringStatistics() {
    if (!this.clusters || this.clusters.length === 0) {
      return null;
    }

    return this.dbscan.calculateStatistics(
      this.complaintData.map((c) => ({ lat: c.lat, lng: c.lng })),
      { clusters: this.clusters, noise: [] }
    );
  }

  /**
   * Clear all layers from map
   */
  clearAllLayers() {
    this.hideHeatmap();
    this.hideMarkers();
    this.hideCircles();
    this.hideClusters();
  }

  /**
   * Refresh visualization with current data
   */
  refresh() {
    this.clearAllLayers();

    if (this.complaintData.length > 0) {
      this.createHeatmapLayer();
      this.createMarkerLayer();

      if (this.isClusteringEnabled) {
        this.performClustering();
        this.createClusterLayer();
        this.showClusters();
      }
    }
  }
}

// Export for use in other modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = HeatmapVisualization;
} else {
  window.HeatmapVisualization = HeatmapVisualization;
}
