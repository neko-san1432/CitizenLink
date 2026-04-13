#!/usr/bin/env node
/*
  Comparative DBSCAN Benchmark (Adaptive vs Fixed)
  ------------------------------------------------
  READ-ONLY script for thesis defense.

  Run 1 (Adaptive / Control): Uses the real core engine:
    - src/server/services/nlp/ClusteringService.js
    - Adaptive epsilon/minPts per category
    - Strict category match + 45-minute time window

  Run 2 (Fixed / Experimental): Implements a simple DBSCAN here:
    - Epsilon fixed to 50 meters (Haversine)
    - MinPts fixed to 4
    - Ignores category/time constraints

  Dataset:
    - Loads the same 288 complaints used by scripts/generate_authentic_logs.js
    - Builds clustering points from complaints that have latitude+longitude

  Output:
    - Prints a JSON summary comparing both runs, including mixed-category merges for Fixed DBSCAN.
*/

require('dotenv').config();

const Database = require('../src/server/config/database');
const clusteringService = require('../src/server/services/nlp/ClusteringService');

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

// Haversine (meters) — matches core engine math
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const dPhi = toRadians(lat2 - lat1);
  const dLam = toRadians(lon2 - lon1);

  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) * Math.sin(dLam / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getTimestampMs(point) {
  if (point.timestamp) return new Date(point.timestamp).getTime();
  if (point.created_at) return new Date(point.created_at).getTime();
  return Date.now();
}

function regionQueryFixed(points, corePoint, epsMeters) {
  const out = [];
  for (const other of points) {
    // include self
    if (other.id === corePoint.id) {
      out.push(other);
      continue;
    }
    const d = haversineMeters(
      corePoint.latitude,
      corePoint.longitude,
      other.latitude,
      other.longitude
    );
    if (d <= epsMeters) out.push(other);
  }
  return out;
}

function dbscanFixed(points, epsMeters, minPts) {
  const visited = new Set();
  const assigned = new Set();
  const noise = new Set();
  const clusters = [];

  // Sort by time (newest first) for determinism (mirrors engine ordering style)
  const sorted = [...points].sort((a, b) => getTimestampMs(b) - getTimestampMs(a));

  for (const p of sorted) {
    if (visited.has(p.id)) continue;
    visited.add(p.id);

    const neighbors = regionQueryFixed(sorted, p, epsMeters);
    if (neighbors.length < minPts) {
      noise.add(p.id);
      continue;
    }

    // Expand cluster
    const clusterPoints = [];
    const queue = [...neighbors];

    while (queue.length) {
      const q = queue.shift();

      if (!visited.has(q.id)) {
        visited.add(q.id);
        const qNeighbors = regionQueryFixed(sorted, q, epsMeters);
        if (qNeighbors.length >= minPts) {
          for (const n of qNeighbors) {
            if (!visited.has(n.id)) queue.push(n);
          }
        }
      }

      if (!assigned.has(q.id)) {
        assigned.add(q.id);
        clusterPoints.push(q);
      }
    }

    clusters.push({
      id: `fixed_cluster_${clusters.length + 1}`,
      points: clusterPoints,
    });
  }

  // Any point never assigned to a cluster is noise/unclustered
  for (const p of sorted) {
    if (!assigned.has(p.id)) noise.add(p.id);
  }

  return { clusters, noiseIds: Array.from(noise) };
}

function summarizeAdaptive(points, clusters) {
  const clusteredIds = new Set();
  for (const c of clusters) {
    if (Array.isArray(c.reports)) {
      for (const r of c.reports) clusteredIds.add(r.id);
    }
  }

  const total = points.length;
  const clustered = clusteredIds.size;
  const noise = total - clustered;

  // Category mix should be impossible due to strict check, but verify.
  let mixedCategoryClusters = 0;
  for (const c of clusters) {
    const cats = new Set((c.reports || []).map(r => r.category));
    if (cats.size > 1) mixedCategoryClusters += 1;
  }

  return {
    totalPoints: total,
    clusterCount: clusters.length,
    clusteredPoints: clustered,
    noisePoints: noise,
    mixedCategoryClusters,
  };
}

function summarizeFixed(points, fixedResult) {
  const clusters = fixedResult.clusters;
  const noiseIds = new Set(fixedResult.noiseIds);

  const clusterSizes = clusters.map(c => c.points.length);
  const totalClustered = clusterSizes.reduce((a, b) => a + b, 0);

  const mixed = [];
  for (const c of clusters) {
    const cats = new Set(c.points.map(p => p.category));
    if (cats.size > 1) {
      mixed.push({
        clusterId: c.id,
        size: c.points.length,
        categories: Array.from(cats),
      });
    }
  }

  return {
    totalPoints: points.length,
    clusterCount: clusters.length,
    clusteredPoints: totalClustered,
    noisePoints: noiseIds.size,
    clusterSize: {
      min: clusterSizes.length ? Math.min(...clusterSizes) : 0,
      max: clusterSizes.length ? Math.max(...clusterSizes) : 0,
      avg: clusterSizes.length ? +(totalClustered / clusterSizes.length).toFixed(2) : 0,
    },
    mixedCategoryClusters: mixed.length,
    mixedCategoryExamples: mixed.slice(0, 5),
  };
}

async function loadDatasetPoints288() {
  const supabase = Database.getServiceClient();

  // Mirror scripts/generate_authentic_logs.js: fetch last 300, then process 288 limit.
  const { data: complaints, error } = await supabase
    .from('complaints')
    .select('*')
    .order('submitted_at', { ascending: false })
    .limit(300);

  if (error) throw error;

  // Mirror generator: it processes N complaints returned; in this environment it is 288.
  const slice = (complaints || []).slice(0, 288);

  // Fetch categories for name mapping (category_id -> name)
  const { data: categories, error: catErr } = await supabase
    .from('categories')
    .select('id, name');
  if (catErr) throw catErr;

  const catMap = {};
  (categories || []).forEach(c => {
    catMap[c.id] = c.name;
  });

  const points = [];
  for (const c of slice) {
    if (c.latitude == null || c.longitude == null) continue;

    const lat = Number.parseFloat(c.latitude);
    const lon = Number.parseFloat(c.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    points.push({
      id: c.id,
      latitude: lat,
      longitude: lon,
      category: catMap[c.category_id] || 'Undetermined',
      timestamp: c.submitted_at || c.created_at || new Date().toISOString(),
      // Keep raw priority value (DB stores lowercase: low/medium/high)
      priority: c.priority || 'medium',
    });
  }

  return {
    complaintsFetched: (complaints || []).length,
    complaintsUsed: slice.length,
    pointsWithCoords: points.length,
    points,
  };
}

async function main() {
  const dataset = await loadDatasetPoints288();
  const points = dataset.points;

  // Run 1: Adaptive
  const adaptiveClusters = clusteringService.clusterIncidents(points);
  const adaptiveSummary = summarizeAdaptive(points, adaptiveClusters);

  // Run 2: Fixed
  const EPS_METERS = 50;
  const MIN_PTS = 4;
  const fixed = dbscanFixed(points, EPS_METERS, MIN_PTS);
  const fixedSummary = summarizeFixed(points, fixed);

  // Additional: fragmentation/merge signals
  const comparison = {
    dataset: {
      complaintsFetched: dataset.complaintsFetched,
      complaintsUsed: dataset.complaintsUsed,
      pointsWithCoords: dataset.pointsWithCoords,
    },
    adaptive: {
      ...adaptiveSummary,
      expectedClusterCount: 18,
    },
    fixed: {
      params: { epsilonMeters: EPS_METERS, minPts: MIN_PTS, ignoresCategory: true, ignoresTimeWindow: true },
      ...fixedSummary,
    },
    delta: {
      clusterCountDiff: fixedSummary.clusterCount - adaptiveSummary.clusterCount,
      noisePointDiff: fixedSummary.noisePoints - adaptiveSummary.noisePoints,
      mixedCategoryClustersFixed: fixedSummary.mixedCategoryClusters,
    },
    interpretation: {
      fragmentationSignal: fixedSummary.clusterCount > adaptiveSummary.clusterCount,
      unclusteredSignal: fixedSummary.noisePoints > adaptiveSummary.noisePoints,
      incorrectMergeSignal: fixedSummary.mixedCategoryClusters > 0,
    },
  };

  console.log(JSON.stringify(comparison, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
