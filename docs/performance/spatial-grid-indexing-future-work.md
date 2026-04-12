# Future Work — Spatial Grid Indexing for DBSCAN (Scalability)

**Status:** Documentation-only (code freeze).

## Why this matters

The current server-side clustering used by the deliverable generator performs neighbor discovery by scanning all candidate points and applying filters (category, time window, then Haversine distance). This is simple and correct for the prototype, but it can become expensive as the dataset grows.

At larger scales (e.g., thousands to tens of thousands of reports), the dominant cost is repeatedly evaluating distance comparisons during neighborhood queries (worst-case behavior trends toward $O(n^2)$).

## Current implementation (deliverables)

- **Generator path:** `scripts/generate_authentic_logs.js`
- **Clustering engine used:** `src/server/services/nlp/ClusteringService.js` via `clusterIncidents()`
- **How `Formation_Time_ms` is computed:**
  - The generator measures total wall-clock time for a full `clusterIncidents(points)` run.
  - It then stores an **average-per-cluster** value:
    - `Formation_Time_ms = totalClusterTimeMs / clusterCount`
  - This means the value is sensitive to clustering runtime, not cluster geometry.

### Prototype-scale note (288 records)

For the 288-record thesis prototype, clustering time is already very small (e.g., ~1.21 ms average-per-cluster in the current deliverable output). At this scale, a spatial index would likely produce only marginal improvements because:

- the dataset is small, and
- the server logic already prunes candidates heavily (category match + 45-minute time window) before running Haversine.

## Recommended optimization (future work)

Introduce a **grid / spatial-hash index** to reduce neighbor search candidates.

### Concept

1. Choose a grid cell size based on $\varepsilon$ (DBSCAN neighborhood radius).
2. Assign each point to a grid cell key (e.g., `floor(lat / cellSize)`, `floor(lng / cellSize)`).
3. For neighbor queries, only check points in the same cell and the 8 adjacent cells (3×3 neighborhood).
4. Run precise distance checks (Haversine) only on these candidates.

This changes the practical cost from “check almost everyone” to “check nearby buckets”.

### Evidence already in the codebase (client-side)

A grid-indexed DBSCAN already exists for the map UI:

- `public/js/components/map/dbscan.js`
  - `SpatialGrid` buckets points by cell key.
  - `getNearbyCandidates()` searches a 3×3 cell neighborhood.
  - DBSCAN uses the grid path for optimized neighbor discovery.

This is a validated pattern within the project and can be used as the reference implementation for a server-side port.

## Expected impact on deliverable metrics

- **Primary effect:** reduced clustering runtime → reduced `Formation_Time_ms` (since that field is derived from measured clustering time).
- **Secondary effect:** lower CPU usage and improved responsiveness for live clustering/scheduling when scaling up.
- **No expected change in cluster results** if the grid search is only used as a candidate pre-filter and the final inclusion decision is still Haversine + threshold.

## Implementation guidance (post-defense)

If implemented later, consider:

- Category + time-window constraints already reduce candidate sets; the grid index is most valuable when those constraints still leave many candidates.
- The grid cell size must be derived carefully from $\varepsilon$ (meters) and local latitude (meters-per-degree varies slightly with latitude).
- A hybrid index can be considered:
  - per-category grids, and/or
  - per-time-slice grids (e.g., 5–10 minute buckets) to further reduce candidate checks.

## Thesis framing

For Chapter 5 (Future Work / Scalability), the recommended narrative is:

- Prototype scale (288 records) already meets performance goals with the current straightforward neighbor scanning.
- For production scale, adopt the proven grid-based spatial indexing approach (already implemented client-side) to prevent $O(n^2)$ growth in clustering runtime.
