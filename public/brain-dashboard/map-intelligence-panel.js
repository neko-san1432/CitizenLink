/**
 * MapIntelligencePanel
 * ====================
 * Slide-in complaint intelligence panel for the DRIMS map.
 *
 * Design goals:
 *  - Show panel skeleton instantly on marker click (< 16 ms)
 *  - Compute heavy NLP/triage HTML lazily in a microtask
 *  - Client-side cache: once a complaint is analyzed the result is reused
 *    until the city data is reloaded (invalidateCache)
 *  - "Go to Review Queue" button wired to /review-queue?highlight=<id>
 */

(function () {
  "use strict";

  // ─────────────────────────── CSS ───────────────────────────────────
  const STYLE = `
    /* === Panel host — sits below the 70px site header === */
    #mip-root {
      position: fixed;
      top: 70px;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 9999;
      pointer-events: none;
    }

    /* === Dim overlay (content area only) === */
    #mip-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,.35);
      opacity: 0;
      transition: opacity .25s ease;
      pointer-events: none;
    }
    #mip-root.mip-open #mip-overlay {
      opacity: 1;
      pointer-events: auto;
    }

    /* === Slide-in drawer === */
    #mip-panel {
      position: absolute;
      top: 0;
      right: 0;
      width: min(680px, 100vw);
      height: 100%;
      background: #0f172a;
      color: #f1f5f9;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform .3s cubic-bezier(.4,0,.2,1);
      pointer-events: auto;
      box-shadow: -4px 0 32px rgba(0,0,0,.6);
      overflow: hidden;
    }
    #mip-root.mip-open #mip-panel {
      transform: translateX(0);
    }

    /* === Header === */
    .mip-header {
      flex-shrink: 0;
      background: #1e3a5f;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      border-bottom: 2px solid #3b82f6;
    }
    .mip-close-btn {
      background: none;
      border: none;
      color: #93c5fd;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      padding: 4px 8px;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .mip-close-btn:hover { background: rgba(255,255,255,.1); }

    .mip-complaint-id {
      font-family: monospace;
      font-size: 12px;
      color: #93c5fd;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .mip-veracity-badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 20px;
      flex-shrink: 0;
    }
    .mip-badge-unverified { background: #d97706; color: #fff; }
    .mip-badge-high       { background: #059669; color: #fff; }
    .mip-badge-moderate   { background: #2563eb; color: #fff; }
    .mip-badge-maintenance { background: #7c3aed; color: #fff; }

    .mip-review-btn {
      background: #2563eb;
      border: none;
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      padding: 5px 10px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
      flex-shrink: 0;
      text-decoration: none;
      transition: background .15s;
    }
    .mip-review-btn:hover { background: #1d4ed8; }

    /* === Scrollable body === */
    .mip-body {
      flex: 1;
      overflow-y: auto;
      padding: 0;
    }
    .mip-body::-webkit-scrollbar { width: 6px; }
    .mip-body::-webkit-scrollbar-track { background: #0f172a; }
    .mip-body::-webkit-scrollbar-thumb { background: #475569; border-radius: 3px; }

    /* === Skeleton loading state === */
    .mip-skeleton {
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .mip-sk-line {
      height: 14px;
      background: linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%);
      background-size: 200% 100%;
      border-radius: 4px;
      animation: mip-shimmer 1.2s infinite;
    }
    .mip-sk-line.wide  { width: 100%; }
    .mip-sk-line.half  { width: 60%; }
    .mip-sk-line.third { width: 35%; }
    .mip-sk-block {
      height: 90px;
      background: linear-gradient(90deg, #1f2937 25%, #374151 50%, #1f2937 75%);
      background-size: 200% 100%;
      border-radius: 6px;
      animation: mip-shimmer 1.2s infinite;
    }
    @keyframes mip-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* === Popup content wrapper inside panel === */
    .mip-body .complaint-popup-v2 {
      border-radius: 0;
      box-shadow: none;
      width: 100%;
      min-width: unset;
      max-width: unset;
    }
    .mip-body .popup-header-v2 {
      border-radius: 0;
    }
  `;

  // ─────────────────── DOM bootstrap ─────────────────────────────────
  function injectStyles() {
    if (document.getElementById("mip-css")) return;
    const el = document.createElement("style");
    el.id = "mip-css";
    el.textContent = STYLE;
    document.head.appendChild(el);
  }

  function buildDOM() {
    if (document.getElementById("mip-root")) return;
    const root = document.createElement("div");
    root.id = "mip-root";
    root.innerHTML = `
      <div id="mip-overlay"></div>
      <div id="mip-panel">
        <div class="mip-header">
          <button class="mip-close-btn" id="mip-close" title="Close">
            <i class="fas fa-times"></i>
          </button>
          <span class="mip-complaint-id" id="mip-id-label">&mdash;</span>
          <span class="mip-veracity-badge mip-badge-unverified" id="mip-veracity-badge" style="display:none"></span>
          <a class="mip-review-btn" id="mip-review-btn" href="/review-queue" target="_blank" rel="noopener">
            <i class="fas fa-clipboard-list"></i> Go to Review Queue
          </a>
        </div>
        <div class="mip-body" id="mip-body">
          <div class="mip-skeleton">
            <div class="mip-sk-line wide"></div>
            <div class="mip-sk-line half"></div>
            <div class="mip-sk-block"></div>
            <div class="mip-sk-line wide"></div>
            <div class="mip-sk-line third"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);
  }

  // ─────────────────── Panel class ────────────────────────────────────
  class MapIntelligencePanel {
    constructor() {
      this._cache = new Map();   // Map<complaintId, renderedHTML>
      this._currentId = null;
      this._root = null;
      this._body = null;

      injectStyles();
      buildDOM();

      this._root    = document.getElementById("mip-root");
      this._body    = document.getElementById("mip-body");

      document.getElementById("mip-close").addEventListener("click", () => this.close());
      document.getElementById("mip-overlay").addEventListener("click", () => this.close());

      // Close on Escape
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this._root.classList.contains("mip-open")) this.close();
      });
    }

    /** ----------------------------------------------------------------
     * show – open the panel for a complaint point
     * @param {Object}  point             – complaint data object
     * @param {number|null} clusterId     – 1-based cluster index (null for noise/live)
     * @param {string}  clusterColor      – hex colour used for the cluster
     * @param {string|null} dominantCat   – dominant category string for merged-warning
     */
    show(point, clusterId = null, clusterColor = "#6b7280", dominantCat = null) {
      this._currentId = point.id;

      // ── 1. Update header immediately (no async) ──────────────────
      document.getElementById("mip-id-label").textContent = point.id || "—";
      document.getElementById("mip-review-btn").href =
        `/review-queue?highlight=${encodeURIComponent(point.id || "")}`;

      this._updateVeracityBadge(point);

      // ── 2. Open panel (triggers CSS transition) ──────────────────
      this._root.classList.add("mip-open");

      // ── 3. Cache hit — render instantly, no skeleton needed ──────
      if (this._cache.has(point.id)) {
        this._setContent(this._cache.get(point.id), point);
        return;
      }

      // ── 4. Cache miss — show skeleton, then compute after browser paints
      this._showSkeleton();

      // Double-rAF: first rAF queues before paint, second fires after.
      // This guarantees the skeleton is visible before the heavy build runs.
      const capturedId = point.id;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Safety: user may have clicked a different marker while waiting
          if (this._currentId !== capturedId) return;

          const html = this._buildHTML(point, clusterId, clusterColor, dominantCat);

          // Cache before setting (handles very fast repeated clicks)
          this._cache.set(capturedId, html);

          if (this._currentId !== capturedId) return;
          this._setContent(html, point);
        });
      });
    }

    /** Close and reset */
    close() {
      if (!this._root) return;
      this._root.classList.remove("mip-open");
      this._currentId = null;
    }

    /**
     * Invalidate the cache — call when city data is reloaded so stale
     * intelligence results don't persist across dataset refreshes.
     */
    invalidateCache() {
      this._cache.clear();
    }

    // ── Private helpers ─────────────────────────────────────────────

    _showSkeleton() {
      this._body.innerHTML = `
        <div class="mip-skeleton">
          <div class="mip-sk-line wide"></div>
          <div class="mip-sk-line half"></div>
          <div class="mip-sk-block"></div>
          <div class="mip-sk-line wide"></div>
          <div class="mip-sk-line third"></div>
          <div class="mip-sk-block"></div>
        </div>
      `;
    }

    _setContent(html, point) {
      this._body.innerHTML = html;
      // Lazy geocoding — update street address element after DOM is ready
      requestAnimationFrame(() => this._loadStreetAddress(point));
    }

    _buildHTML(point, clusterId, clusterColor, dominantCat) {
      // Delegate to the existing dashboard function (exposed as global below)
      if (typeof window.generateComplaintPopupHTML === "function") {
        return window.generateComplaintPopupHTML(point, clusterId, clusterColor, dominantCat);
      }
      // Fallback if function not yet exposed
      return `<div style="padding:20px;color:#9ca3af;">Analysis engine not ready.</div>`;
    }

    _updateVeracityBadge(point) {
      const badge = document.getElementById("mip-veracity-badge");
      if (!badge) return;

      const intelligence = typeof window.analyzeComplaintIntelligence === "function"
        ? window.analyzeComplaintIntelligence(point)
        : null;

      if (!intelligence) { badge.style.display = "none"; return; }

      const label = intelligence.veracityLabel || "UNVERIFIED";
      badge.textContent = label;
      badge.className = "mip-veracity-badge";
      if (label === "HIGH CONFIDENCE") badge.classList.add("mip-badge-high");
      else if (label === "MAINTENANCE") badge.classList.add("mip-badge-maintenance");
      else if (label === "MODERATE")    badge.classList.add("mip-badge-moderate");
      else                               badge.classList.add("mip-badge-unverified");
      badge.style.display = "";
    }

    _loadStreetAddress(point) {
      const streetEl = this._body.querySelector(".complaint-street-location");
      if (!streetEl) return;
      const streetValue = streetEl.querySelector(".street-value");
      if (!streetValue || !streetValue.textContent.includes("Loading")) return;

      const lat = parseFloat(streetEl.dataset.lat);
      const lng = parseFloat(streetEl.dataset.lng);
      if (isNaN(lat) || isNaN(lng)) return;

      if (typeof window.reverseGeocode !== "function") return;

      window.reverseGeocode(lat, lng)
        .then((address) => {
          if (!address) { streetValue.innerHTML = '<span class="no-street">Address unavailable</span>'; return; }
          if (address.street) {
            streetValue.innerHTML = `<strong>${address.street}</strong> <span class="street-barangay">(${address.suburb || ""})</span>`;
          } else if (address.suburb) {
            streetValue.innerHTML = `<span class="street-barangay">${address.suburb}</span> <span class="no-street">(no street name)</span>`;
          } else {
            streetValue.innerHTML = '<span class="no-street">Address unavailable</span>';
          }
          // Update cache with resolved address (so next open is accurate)
          if (point.id && this._cache.has(point.id)) {
            this._cache.set(point.id, this._body.innerHTML);
          }
        })
        .catch(() => {
          streetValue.innerHTML = '<span class="no-street">Geocoding failed</span>';
        });
    }
  }

  // ─────────────────── Global singleton ──────────────────────────────
  // Guard against double-loading
  if (!window.mapIntelligencePanel) {
    window.mapIntelligencePanel = new MapIntelligencePanel();
  }
})();
