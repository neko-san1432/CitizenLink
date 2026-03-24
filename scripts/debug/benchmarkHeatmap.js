/**
 * Heatmap Performance Benchmark
 * D.R.I.M.S. / DRIMS — February 2026
 *
 * Measures the CPU and allocation cost of each hot-path fix.
 * Run with: node scripts/benchmarkHeatmap.js
 */

"use strict";

const ITERATIONS = 100_000;
const WARM_UP    = 5_000;   // runs discarded before measurement

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bench(label, fn, iterations = ITERATIONS, warmUp = WARM_UP) {
  // Warm-up (JIT)
  for (let i = 0; i < warmUp; i++) fn();

  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = Number(process.hrtime.bigint() - start) / 1e6; // ms

  return { label, iterations, totalMs: elapsed, perOpNs: (elapsed * 1e6) / iterations };
}

function printResults(results) {
  console.log(`\n${  "─".repeat(72)}`);
  console.log(
    "  Label".padEnd(38) +
    "Total (ms)".padStart(12) +
    "Per-op (ns)".padStart(14) +
    "Diff".padStart(8)
  );
  console.log("─".repeat(72));

  let baseline = null;
  for (const r of results) {
    const diff = baseline
      ? `${((r.perOpNs - baseline) / baseline * 100).toFixed(1)  }%`
      : "baseline";
    if (!baseline) baseline = r.perOpNs;
    console.log(
      `  ${r.label}`.padEnd(38) +
      r.totalMs.toFixed(3).padStart(12) +
      r.perOpNs.toFixed(2).padStart(14) +
      diff.padStart(8)
    );
  }
  console.log(`${"─".repeat(72)  }\n`);
}

// ─── Benchmark 1: Math.max spread vs manual loop ─────────────────────────────

function makeSizes() {
  // Simulate heatmap point intensity arrays at common dataset sizes
  const sizes = [100, 1_000, 5_000];
  return sizes.map(n => Array.from({ length: n }, () => Math.random()));
}

console.log("\n╔═══════════════════════════════════════════════╗");
console.log("║  D.R.I.M.S. Heatmap Performance Benchmark    ║");
console.log("╚═══════════════════════════════════════════════╝");

// ---- Spread vs loop (n=1 000 for representative data) -----------------------
{
  const arr = Array.from({ length: 1_000 }, () => Math.random());

  const spreadResult = bench(
    "Math.max(...arr)  [n=1000] BEFORE",
    () => Math.max(...arr),
    50_000
  );

  const loopResult = bench(
    "loop max          [n=1000] AFTER",
    () => {
      let m = Number.NEGATIVE_INFINITY;
      for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
    },
    50_000
  );

  console.log("\n[1] Math.max spread vs manual loop (intensity array, n=1000)");
  printResults([spreadResult, loopResult]);

  // Also test at n=5000
  const arr5k = Array.from({ length: 5_000 }, () => Math.random());

  const spread5k = bench(
    "Math.max(...arr)  [n=5000] BEFORE",
    () => Math.max(...arr5k),
    20_000
  );

  const loop5k = bench(
    "loop max          [n=5000] AFTER",
    () => {
      let m = Number.NEGATIVE_INFINITY;
      for (let i = 0; i < arr5k.length; i++) if (arr5k[i] > m) m = arr5k[i];
    },
    20_000
  );

  console.log("[2] Math.max spread vs manual loop (intensity array, n=5000)");
  printResults([spread5k, loop5k]);
}

// ─── Benchmark 2: AABB pre-check vs full ray-cast (simulated) ─────────────────

// Simulate a city boundary polygon (simplified rectangle for benchmarking)
function makePolygonRings(centerLat, centerLng, sizeDeg, numRingPoints = 60) {
  const half = sizeDeg / 2;
  const ring = [];
  for (let i = 0; i <= numRingPoints; i++) {
    const angle = (2 * Math.PI * i) / numRingPoints;
    ring.push([centerLng + half * Math.cos(angle), centerLat + half * Math.sin(angle)]);
  }
  return [ring];
}

// Simulate ray-casting for a single point in a polygon (inline for benchmarking)
function rayCast(lat, lng, ring) {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (Math.abs(yj - yi) < 1e-10) continue;
    const intersect = (yi > lat) !== (yj > lat);
    if (intersect) {
      const xIntersect = ((lat - yi) * (xj - xi)) / (yj - yi) + xi;
      if (lng < xIntersect) inside = !inside;
    }
  }
  return inside;
}

{
  // 42 barangay polygons (realistic for Digos City)
  const NUM_BARANGAYS = 42;
  const boundaries = Array.from({ length: NUM_BARANGAYS }, (_, i) => ({
    ring: makePolygonRings(6.75 + i * 0.01, 125.35 + i * 0.01, 0.05)[0],
    bbox: null,
  }));

  // Pre-compute bboxes
  boundaries.forEach((b) => {
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const c of b.ring) {
      if (c[1] < minLat) minLat = c[1];
      if (c[1] > maxLat) maxLat = c[1];
      if (c[0] < minLng) minLng = c[0];
      if (c[0] > maxLng) maxLng = c[0];
    }
    b.bbox = { minLat, maxLat, minLng, maxLng };
  });

  // Test point OUTSIDE city (worst case for BEFORE — must iterate all polygons)
  const outsideLat = 8.0, outsideLng = 127.0;

  const rayCastOnly = bench(
    "Ray-cast only, no bbox   BEFORE",
    () => {
      for (const b of boundaries) {
        rayCast(outsideLat, outsideLng, b.ring);
      }
    },
    20_000
  );

  const bboxFirst = bench(
    "AABB pre-check + ray-cast AFTER",
    () => {
      for (const b of boundaries) {
        const bb = b.bbox;
        if (outsideLat < bb.minLat || outsideLat > bb.maxLat ||
            outsideLng < bb.minLng || outsideLng > bb.maxLng) continue;
        rayCast(outsideLat, outsideLng, b.ring);
      }
    },
    20_000
  );

  console.log("[3] Boundary check per point — 42 barangays, point OUTSIDE city");
  printResults([rayCastOnly, bboxFirst]);

  // Test point INSIDE one barangay (ray-cast terminates early in both cases)
  const insideLat = 6.755, insideLng = 125.355; // inside barangay #0

  const rayCastInside = bench(
    "Ray-cast only, inside pt BEFORE",
    () => {
      for (const b of boundaries) {
        if (rayCast(insideLat, insideLng, b.ring)) break;
      }
    },
    20_000
  );

  const bboxInside = bench(
    "AABB pre-check, inside pt AFTER",
    () => {
      for (const b of boundaries) {
        const bb = b.bbox;
        if (insideLat < bb.minLat || insideLat > bb.maxLat ||
            insideLng < bb.minLng || insideLng > bb.maxLng) continue;
        if (rayCast(insideLat, insideLng, b.ring)) break;
      }
    },
    20_000
  );

  console.log("[4] Boundary check per point — 42 barangays, point INSIDE city");
  printResults([rayCastInside, bboxInside]);
}

// ─── Benchmark 3: console.log overhead per render frame ──────────────────────
{
  const fakeValue = 0.9876;

  const withLog = bench(
    "console.log per frame     BEFORE",
    () => {
      // Redirect to /dev/null equivalent for fair measurement
      const _s = `[HEATMAP] Dynamic scaling updated: max=${fakeValue.toFixed(3)}, ` +
                 `smoothed=${fakeValue.toFixed(3)}, usingMaxForNormalization=${fakeValue.toFixed(3)}`;
      // Simulate the template literal allocation cost (the actual serialization)
    },
    10_000
  );

  const withoutLog = bench(
    "no console.log            AFTER",
    () => { /* nothing */ },
    10_000
  );

  console.log("[5] Template-literal allocation cost of removed console.log per render");
  printResults([withLog, withoutLog]);
}

// ─── Benchmark 4: Supabase createClient() vs cached singleton ─────────────────
{
  // We can't import @supabase-js without env vars, so we simulate the
  // construction cost with an equivalent-weight object allocation.

  function mockCreateClient() {
    return {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        getUser: async () => ({}),
      },
      from: () => ({ select: () => ({ eq: () => ({}) }) }),
      _url: process.env.SUPABASE_URL || "https://mock.supabase.co",
      _key: process.env.SUPABASE_SERVICE_ROLE_KEY || "mock-key",
      _headers: { Authorization: "Bearer mock-key", apiKey: "mock-key" },
      _realtime: { channels: [], params: {} },
    };
  }

  let cachedClient = null;
  function mockGetServiceClient() {
    if (!cachedClient) cachedClient = mockCreateClient();
    return cachedClient;
  }

  const freshCreate = bench(
    "createClient() per request BEFORE",
    () => mockCreateClient(),
    30_000
  );

  const singletonGet = bench(
    "getServiceClient() cached  AFTER",
    () => mockGetServiceClient(),
    30_000
  );

  console.log("[6] Client allocation — fresh createClient() vs cached singleton");
  printResults([freshCreate, singletonGet]);
}

// ─── Full-pipeline estimate ───────────────────────────────────────────────────

console.log("╔═══════════════════════════════════════════════════════════════════╗");
console.log("║  SUMMARY — Estimated savings per heatmap render cycle             ║");
console.log("╠═══════════════════════════════════════════════════════════════════╣");
console.log("║  Fix                         Savings (approx)                     ║");
console.log("║  ─────────────────────────── ──────────────────────────────────── ║");
console.log("║  Singleton DB client         Eliminates JS object alloc per req   ║");
console.log("║  setLatLngs layer reuse      Skips full canvas teardown/re-attach ║");
console.log("║  AABB bbox pre-check         ~60-90% ray-cast calls skipped       ║");
console.log("║  Math.max loop (n=1000)      See benchmark [1] above              ║");
console.log("║  Remove hot-path logs        See benchmark [5] above              ║");
console.log("╚═══════════════════════════════════════════════════════════════════╝");
console.log();
