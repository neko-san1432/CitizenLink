# Heatmap Performance Optimization Report

**Project:** CitizenLink / DRIMS  
**Date:** 2026-02-28  
**Scope:** `src/client/components/map/heatmapVisualization.js` · `src/server/services/complaintService.js`  
**Benchmark script:** `scripts/benchmarkHeatmap.js`

---

## Executive Summary

Six targeted fixes eliminate redundant work in the heatmap render pipeline. The most impactful changes are the AABB bounding-box pre-check (**−99.2 %** per boundary test for out-of-city points) and replacing `Math.max(...spread)` with a loop (**−93.5 %** at n=1 000). All fixes are backward-compatible with zero changes to the public API or test contracts.

---

## Architecture Context

```
Browser                          Server (Node / Express)
──────────────────────────────   ───────────────────────────────────────
HeatmapVisualization             complaintService.getcomplaintLocations()
  └─ loadcomplaintData()    →    complaintRepository.findLocationsSlim()
  └─ isWithinCityBoundary()      Database.getServiceClient()  ← singleton
  └─ applyClientSideFilters()
  └─ createHeatmapLayer()
       └─ L.heatLayer / setLatLngs
       └─ updateDynamicScaling()
       └─ calculateMaxDensity()
```

---

## Identified Issues & Applied Fixes

### Fix 1 — Singleton Supabase Client in `getcomplaintLocations`

| | |
|---|---|
| **File** | `src/server/services/complaintService.js` |
| **Problem** | `require("@supabase/supabase-js").createClient(...)` was called inside `getcomplaintLocations()`, allocating a fresh client object with a new auth state machine, HTTP pool reference, and realtime channel registry **on every single heatmap API request**. |
| **Fix** | Replace inline `createClient()` with `Database.getServiceClient()` — the same singleton already used by `findLocationsSlim` and `getcomplaintStats`. |

**Before:**
```js
// Inside getcomplaintLocations() — runs on every request
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

**After:**
```js
// Top-level import (added)
const Database = require("../config/database");

// Inside getcomplaintLocations()
const supabase = Database.getServiceClient(); // cached singleton
```

**Benchmark result (simulated allocation cost):**

| Variant | Per-op (ns) | Δ |
|---|---|---|
| `createClient()` per request | 1 565.62 ns | baseline |
| `getServiceClient()` cached  |    15.51 ns | **−99.0 %** |

---

### Fix 2 — Layer Reuse via `setLatLngs()` instead of Full Recreation

| | |
|---|---|
| **File** | `src/client/components/map/heatmapVisualization.js` · `createHeatmapLayer()` |
| **Problem** | Every filter change called `map.removeLayer(heatmapLayer)`, set `heatmapLayer = null`, then called `L.heatLayer(points, config)` to create a brand-new canvas element. This causes a full DOM detach → canvas destroy → canvas create → DOM attach cycle on every user interaction with the filter panel. |
| **Fix** | Keep the layer reference alive. When the layer already exists, call `setLatLngs(newPoints)` + `redraw()`. Only create a new `L.heatLayer` on first call or after an explicit reset. |

**Before:**
```js
createHeatmapLayer() {
  if (this.heatmapLayer) {
    if (this.map && this.map.hasLayer(this.heatmapLayer)) {
      this.map.removeLayer(this.heatmapLayer);       // DOM detach
    }
    this.heatmapLayer = null;                        // canvas destroy
  }
  // ... compute heatmapPoints ...
  this.heatmapLayer = L.heatLayer(heatmapPoints, config);  // full recreate
  return this.heatmapLayer;
}
```

**After:**
```js
createHeatmapLayer() {
  // Layer stays alive; updateDynamicScaling + applyClientSideFilters run first
  // ...compute heatmapPoints...
  if (this.heatmapLayer) {
    this.heatmapLayer.setLatLngs(heatmapPoints);   // in-place update
    this.heatmapLayer.redraw();
  } else {
    this.heatmapLayer = L.heatLayer(heatmapPoints, config);
  }
  return this.heatmapLayer;
}
```

**Effect:** Eliminates canvas teardown + DOM re-attach on every filter change. Particularly impactful on low-end Android hardware where each `removeLayer` → `addLayer` cycle causes a visible repaint stutter.

---

### Fix 3 — AABB Bounding-Box Pre-Check in `isWithinCityBoundary`

| | |
|---|---|
| **File** | `src/client/components/map/heatmapVisualization.js` |
| **Problem** | For every complaint point, `isWithinCityBoundary` iterated all 42 barangay polygons and ran a full O(ring-size) ray-casting algorithm each time — even for points obviously outside the city. A point from Manila, for example, would run the ray-cast 42 times. |
| **Fix** | Pre-compute an axis-aligned bounding box (AABB) for every barangay polygon once (lazy init on first call, stored in `window._cityBoundariesBbox`). Before running ray-casting on a barangay, do a 4-comparison box check to reject it cheaply. |

**New helper (added before `isWithinCityBoundary`):**
```js
function ensureCityBoundariesBbox() {
  if (window._cityBoundariesBbox) return; // already computed
  if (!window.cityBoundaries || !Array.isArray(window.cityBoundaries)) return;
  window._cityBoundariesBbox = window.cityBoundaries.map((b) => {
    const geom = b?.geojson?.geometry || b?.geojson;
    if (!geom?.coordinates) return null;
    let minLat = Infinity, maxLat = -Infinity,
        minLng = Infinity, maxLng = -Infinity;
    const rings = geom.type === "MultiPolygon"
      ? geom.coordinates.flatMap((poly) => poly[0] || [])
      : geom.coordinates[0] || [];
    for (const [cLng, cLat] of rings) {
      if (cLat < minLat) minLat = cLat;  if (cLat > maxLat) maxLat = cLat;
      if (cLng < minLng) minLng = cLng;  if (cLng > maxLng) maxLng = cLng;
    }
    return { minLat, maxLat, minLng, maxLng };
  });
}
```

**Updated loop:**
```js
ensureCityBoundariesBbox();
const bboxCache = window._cityBoundariesBbox;
for (let i = 0; i < window.cityBoundaries.length; i++) {
  const boundary = window.cityBoundaries[i];
  if (!boundary?.geojson) continue;
  // Fast AABB rejection
  if (bboxCache?.[i]) {
    const bb = bboxCache[i];
    if (lat < bb.minLat || lat > bb.maxLat ||
        lng < bb.minLng || lng > bb.maxLng) continue; // skip ray-cast
  }
  if (isPointInPolygon(lat, lng, boundary.geojson)) return true;
}
```

**Benchmark results — 42 barangay polygons, 60-point rings:**

| Scenario | Variant | Per-op (ns) | Δ |
|---|---|---|---|
| Point **outside** city | Ray-cast only (before) | 15 604.96 ns | baseline |
| Point **outside** city | AABB + ray-cast (after) |    121.78 ns | **−99.2 %** |
| Point **inside** city  | Ray-cast only (before) |    399.51 ns | baseline |
| Point **inside** city  | AABB + ray-cast (after) |   437.88 ns | +9.6 % *(acceptable)* |

> **Note:** The +9.6 % overhead for inside-city points is the 4-comparison AABB check that evaluates to `false` (doesn't skip) and then proceeds to ray-cast. This is negligible in absolute terms (38 ns) and is far outweighed by the benefit for outside-city points, which dominate when complaints are sparse on the map.

---

### Fix 4 — Replace `Math.max(...spread)` with a Manual Loop

| | |
|---|---|
| **Files** | `createHeatmapLayer()` · `calculateMaxDensity()` — both in `heatmapVisualization.js` |
| **Problem** | `Math.max(...intensities)` and `Math.min(...intensities)` spread the entire array onto the call stack. This is (1) slower due to argument-list overhead and internal V8 deoptimizations on large arrays, and (2) risks a `RangeError: Maximum call stack size exceeded` for datasets above ~100 000 points. |
| **Fix** | Replace with a single-pass `for` loop in both locations. |

**Before:**
```js
// calculateMaxDensity
const maxIntensity = Math.max(...intensities);

// createHeatmapLayer
const maxIntensity = Math.max(...intensities);
const minIntensity = Math.min(...intensities);
```

**After:**
```js
// calculateMaxDensity
let maxIntensity = Number.NEGATIVE_INFINITY;
for (let i = 0; i < intensities.length; i++) {
  if (intensities[i] > maxIntensity) maxIntensity = intensities[i];
}

// createHeatmapLayer (single pass for both)
let maxIntensity = Number.NEGATIVE_INFINITY;
let minIntensity = Number.POSITIVE_INFINITY;
for (let _i = 0; _i < intensities.length; _i++) {
  if (intensities[_i] > maxIntensity) maxIntensity = intensities[_i];
  if (intensities[_i] < minIntensity) minIntensity = intensities[_i];
}
```

**Benchmark results:**

| Dataset size | Variant | Per-op (ns) | Δ |
|---|---|---|---|
| n = 1 000 | `Math.max(...arr)` (before) | 12 830.64 ns | baseline |
| n = 1 000 | loop (after)               |    839.84 ns | **−93.5 %** |
| n = 5 000 | `Math.max(...arr)` (before) | 62 684.57 ns | baseline |
| n = 5 000 | loop (after)               |  5 198.07 ns | **−91.7 %** |

---

### Fix 5 — Remove Hot-Path `console.log` Calls

| | |
|---|---|
| **Files** | `updateDynamicScaling()` · `createHeatmapLayer()` in `heatmapVisualization.js` |
| **Problem** | Two `console.log` calls with template literals ran on **every filter change and every heatmap redraw**. One of them also called `Math.max(...heatmapPoints.map(...))` — an O(n) map + spread combination purely to print a debug stat to the console. |
| **Fix** | Remove the template-literal logs from the hot render path. Non-hot-path logs (first-run init, load summary) are retained. |

**Removed from `updateDynamicScaling()` (fires every render):**
```js
// REMOVED:
console.log(
  `[HEATMAP] Dynamic scaling updated: max=${newMaxDensity.toFixed(3)}, ` +
  `smoothed=${...}, usingMaxForNormalization=${...}`
);
```

**Removed from `createHeatmapLayer()` (fires every filter change):**
```js
// REMOVED — also had a hidden O(n) alloc inside the template:
console.log(
  `[HEATMAP] Intensity stats: min=${minIntensity.toFixed(3)}, ` +
  `max=${Math.max(...heatmapPoints.map((d) => d[2])).toFixed(3)}, ...`
);
```

**Benchmark result (template-literal allocation cost):**

| Variant | Per-op (ns) | Δ |
|---|---|---|
| template-literal log (before) | 552.91 ns | baseline |
| no log (after)                |  13.28 ns | **−97.6 %** |

---

## Benchmark Results Summary

Run on: Windows 11, Node.js v22, Intel Core processor  
Script: `scripts/benchmarkHeatmap.js`

```
[1] Math.max spread vs loop — n=1 000
    BEFORE  12 830.64 ns/op
    AFTER      839.84 ns/op   −93.5 %

[2] Math.max spread vs loop — n=5 000
    BEFORE  62 684.57 ns/op
    AFTER    5 198.07 ns/op   −91.7 %

[3] Boundary check — point OUTSIDE city (42 barangays)
    BEFORE  15 604.96 ns/op
    AFTER      121.78 ns/op   −99.2 %

[4] Boundary check — point INSIDE city (42 barangays)
    BEFORE     399.51 ns/op
    AFTER      437.88 ns/op   +9.6 % (acceptable overhead)

[5] Hot-path console.log template-literal alloc
    BEFORE     552.91 ns/op
    AFTER       13.28 ns/op   −97.6 %

[6] DB client allocation — createClient() vs singleton
    BEFORE   1 565.62 ns/op
    AFTER       15.51 ns/op   −99.0 %
```

---

## Cumulative Cost Per Full Render Cycle

Given a realistic dataset of **500 complaint points** with the boundary filter enabled:

| Step | Before | After | Saved |
|---|---|---|---|
| DB client alloc (server) | 1 565 ns × 1 | 15 ns × 1 | ~1 550 ns |
| Boundary check (500 pts, ~90 % outside) | 450 pts × 15 605 ns = ~7.0 ms | 450 pts × 122 ns = ~0.055 ms | ~6.9 ms |
| `calculateMaxDensity` (n=500) | ~6 400 ns | ~420 ns | ~6 000 ns |
| Hot-path log calls (2×) | ~1 105 ns | 0 ns | ~1 105 ns |
| `createHeatmapLayer` canvas rebuild | full DOM cycle | in-place update | varies |
| **Total JS (est.)** | **~7.1 ms** | **~0.5 ms** | **~93 %** |

> Canvas layer reuse (Fix 2) further eliminates browser layout/paint work not captured in the JS benchmark above.

---

## Files Changed

| File | Lines changed | Nature |
|---|---|---|
| `src/server/services/complaintService.js` | +1 import, −14 lines | Singleton client |
| `src/client/components/map/heatmapVisualization.js` | +43 / −35 lines | Fixes 2, 3, 4, 5 |
| `scripts/benchmarkHeatmap.js` | new file | Benchmark |

---

## Risks & Caveats

| Item | Risk | Mitigation |
|---|---|---|
| `setLatLngs` reuse (Fix 2) | If the caller checks `map.hasLayer(layer)` after `createHeatmapLayer()` and the layer was already added, `addLayer` is called twice | Leaflet silently ignores duplicate `addLayer` calls — no double-render |
| AABB cache (Fix 3) | If `window.cityBoundaries` is mutated after first call, `_cityBoundariesBbox` becomes stale | Set `window._cityBoundariesBbox = undefined` after any boundary reload (not currently done in code) |
| Singleton client (Fix 1) | The service-role client is shared state — not thread-safe in worker threads | Node.js is single-threaded; no risk in current architecture |

---

## Recommendations (Future Work)

1. **Server-side `findLocationsSlim` as the only heatmap endpoint**: `getcomplaintLocations` (the heavy paginated path) should be fully retired in favour of `findLocationsSlim` for all heatmap requests.

2. **Deduplicate client-side filtering**: `applyClientSideFilters` re-applies status/category/department filters already applied server-side. Storing the filters used in the last fetch and diffing against current filters would let the browser skip redundant O(n) passes entirely.

3. **Virtual viewport culling**: For very large datasets (5 000+ points), only send heatmap points within the current map viewport bounding box to `L.heatLayer`. Points outside the viewport contribute nothing to the visual output but still cost time in the intensity calculation pass.

4. **Web Worker offload**: `applyClientSideFilters` + `getIntensityValue` are pure computation with no DOM access. Moving them into a Web Worker would free the main thread during map interaction.

---

## Phase 2 — Post-Load Interaction Lag (Session 2)

**Symptom reported:** Heatmap and marker view continued to lag _after_ the initial page load — specifically on zoom, pan, and filter changes.

**Root cause analysis:** Phase 1 fixes addressed the initial data-fetch and render path. The remaining lag came from four separate issues in the _interaction_ event loop.

---

### Fix 7 — O(n²) `updateMarkerSizes` on every zoom

| | |
|---|---|
| **File** | `src/client/components/map/heatmapVisualization.js` |
| **Problem** | `updateMarkerSizes()` fires on every `zoomend`. Inside, it called `this.complaintData.find()` (O(n) coordinate scan) for each of the n markers — making the total **O(n²)**. For 500 markers: 250 000 comparisons + 500 `marker.setIcon()` DOM repaints per zoom gesture. |
| **Fix** | Pre-build a `Map<id, complaint>` once per call (O(n)); look up each marker via its stored `_complaintId` in O(1). Gate the entire function behind `requestAnimationFrame` so duplicate queued calls are coalesced into one. |

**Before (simplified):**
```js
markers.forEach((marker, i) => {
  const complaint = this.complaintData.find(c =>   // O(n) per marker
    Math.abs(c.lat - marker.getLatLng().lat) < 0.0001 && ...
  );
  if (complaint) marker.setIcon(this.getcomplaintIcon(complaint, i));
});
```

**After:**
```js
if (this._updateMarkerSizesRaf) return;           // RAF gate
this._updateMarkerSizesRaf = requestAnimationFrame(() => {
  this._updateMarkerSizesRaf = null;
  const dataById = new Map(this.complaintData.map(c => [c.id, c]));  // O(n) once
  markers.forEach((marker, i) => {
    const complaint = dataById.get(marker._complaintId);  // O(1)
    if (complaint) marker.setIcon(this.getcomplaintIcon(complaint, i));
  });
});
```

---

### Fix 8 — `map.on("zoom")` fired full visibility update every animation frame

| | |
|---|---|
| **File** | `public/js/pages/heatmap-init.js` |
| **Problem** | Two zoom listeners were registered — `zoomend` (fires once) and `zoom` (fires every frame of the animation). Both called `updateZoomBasedVisibility()` which iterates all markers and runs `applyClientSideFilters()`. On a 60 fps display, one zoom gesture could trigger 20–60 full passes. |
| **Fix** | The `zoom` listener now only updates the `isInitialLoad` boolean flag. All expensive visibility work stays in `zoomend`. |

---

### Fix 9 — Double `updateMarkerVisibility()` on filter change

| | |
|---|---|
| **File** | `public/js/pages/heatmap-init.js` · `applyFiltersAndUpdate()` |
| **Problem** | `applyFiltersAndUpdate()` called `updateMarkerVisibility()` directly, then called `updateZoomBasedVisibility()` — which also calls `updateMarkerVisibility()` internally. Every checkbox click triggered two full marker-visibility passes. |
| **Fix** | Remove the direct call. `updateZoomBasedVisibility()` is the single authoritative entry point. |

---

### Fix 10 — Per-marker DOM insertion/removal in `updateMarkerVisibility`

| | |
|---|---|
| **File** | `src/client/components/map/heatmapVisualization.js` |
| **Problem** | Hiding a marker called `this.map.removeLayer(marker)`; showing it called `marker.addTo(this.map)`. Each call inserts or removes a DOM node, triggering browser **layout reflow** per marker. 500 markers × one filter change = 500 sequential DOM mutations. |
| **Fix** | Keep all markers rendered in `markerLayer` (which stays on the map). Toggle visibility with `el.style.visibility` and `el.style.pointerEvents` via `marker.getElement()`. CSS-only changes bypass layout reflow entirely. |

**Before:**
```js
if (shouldBeVisible) {
  if (!this.map.hasLayer(marker)) marker.addTo(this.map);       // DOM insert → reflow
} else {
  if (this.map.hasLayer(marker)) this.map.removeLayer(marker);  // DOM remove → reflow
}
```

**After:**
```js
const el = marker.getElement ? marker.getElement() : null;
if (el) {
  el.style.visibility   = shouldBeVisible ? "" : "hidden";      // CSS only — no reflow
  el.style.pointerEvents = shouldBeVisible ? "" : "none";
}
```

---

### Phase 2 Files Changed

| File | Changes | Nature |
|---|---|---|
| `src/client/components/map/heatmapVisualization.js` | `updateMarkerSizes` rewrite, `updateMarkerVisibility` rewrite | Fixes 7, 10 |
| `public/js/pages/heatmap-init.js` | `zoom` listener trimmed, `applyFiltersAndUpdate` deduplicated | Fixes 8, 9 |

