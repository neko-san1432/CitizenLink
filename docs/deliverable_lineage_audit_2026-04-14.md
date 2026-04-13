# Deliverable Data Lineage & Parity Audit — 2026-04-14

**Scope:** Academic thesis defense readiness for deliverables under `deliverable_files_v2/`.

**Code-freeze constraints observed (as requested during audits):**
- **Core clustering engine was not modified:** `src/server/services/nlp/ClusteringService.js` (read-only audit only)
- **For the performance benchmarking audit specifically:** no changes were made to the frozen core engines (`src/server/services/nlp/NLPService.js`, `src/server/services/ml/AdvancedDecisionEngine.js`, `src/server/services/ml/TensorFlowService.js`).
- **Other earlier correctness fixes in this session did include core-engine edits** (e.g., keyword boundary matching + METAPHOR_FILTER confidence) because those were explicitly requested to repair deliverable parity.

This document captures what changed, why, how it was validated, and how to reproduce the generated artifacts.

---

## 1) Deliverable Outputs Affected

Updated/generated deliverables:
- `deliverable_files_v2/json/semantic_ai_logs.json`
- `deliverable_files_v2/json/spatial_clustering_logs.json`
- `deliverable_files_v2/json/edge_ai_performance_logs.json`
- `deliverable_files_v2/excel/*.xlsx` (per-log Excel exports)

Supporting scripts:
- `scripts/generate_authentic_logs.js` (deliverable generator)
- `scripts/json_folder_to_excel.js` (folder batch JSON → separated Excel)

---

## 2) JSON → Separate Excel Conversion (Folder Batch Export)

### What was added
- `scripts/json_folder_to_excel.js`
  - Converts **each JSON file in a folder** into **its own Excel file**.
  - Handles:
    - Top-level arrays → one sheet
    - Top-level object containing arrays → one sheet per array + meta sheet for scalar fields
    - Safe sheet naming (length limits, invalid char removal)

### How to run
- Default deliverable conversion:
  - `npm run logs:json-to-excel`

### Notes (environment)
- On Windows + Node 22, native `@tensorflow/tfjs-node` build may fail.
- The Excel conversion does not require the native TF bindings.

---

## 3) Semantic AI Logs — Correctness & Parity Fixes

### 3.1 System_Action thresholds (deliverable parity)

Requirement: `System_Action` must mirror thesis thresholds:
- `>= 70%` → `Forwarded to Map & Sub-Nodes`
- `>= 60%` and `< 70%` → `Forwarded (Low Confidence)`
- `< 60%` → `Flagged for Manual Verification (HITL)`

Status:
- Implemented in `scripts/generate_authentic_logs.js`.
- Validated across the entire deliverable set (288 rows) using a script that checks `Confidence_Score → System_Action` mapping (0 mismatches).

### 3.2 Classification parity: generator now uses production engine behavior

Problem observed:
- “Obvious” flood complaints (e.g., containing `baha/bumaha`) were misclassified in deliverable semantic logs.

Root cause:
- Earlier deliverable generation paths could diverge from the real complaint pipeline.

Fix:
- `scripts/generate_authentic_logs.js` uses `advancedDecisionEngine.classify(text, complaintId)` for semantic classification, which is the same engine used in the backend pipeline.

Validation:
- Re-ran generation and confirmed flood cases classify as `Environment` with rule-based method when appropriate.

### 3.3 Keyword matching correctness (substring false positives)

Issue:
- Text like `trabaho` was incorrectly triggering the Sanitation keyword `baho` due to naive substring checks.

Fix:
- `src/server/services/ml/AdvancedDecisionEngine.js`
  - Replaced substring `includes()` keyword matching with **token/phrase boundary regex matching**.

Impact:
- “Nawalan ng tubig” reports now correctly classify as `Utilities`.

### 3.4 Matched_Keywords lineage

Issue:
- `Matched_Keywords` was previously set to the first few tokens, which can look arbitrary and not defensible.

Fix:
- `scripts/generate_authentic_logs.js`
  - For rule-based classifications: `Matched_Keywords` records the **actual matched rule term** (`aiResult.matched_term`).
  - For other methods: empty string.

---

## 4) METAPHOR_FILTER Paradox Fix (Unclassified ≠ Forwarded)

Observed paradox:
- `METAPHOR_FILTER` returned `confidence: 1.0` for slang/metaphor text.
- Those rows become `Unclassified Syntax` but were being forwarded due to the threshold routing.

Requirement:
- If metaphor-filtered and unclassified, confidence must be **forced** to `0.00%` so `System_Action` routes to HITL.

Fix:
- `src/server/services/ml/AdvancedDecisionEngine.js`
  - `METAPHOR_FILTER` now returns `confidence: 0.0`.

Validation:
- Ensured all `Method_Used === METAPHOR_FILTER` rows have:
  - `Confidence_Score === 0.00%`
  - `System_Action === Flagged for Manual Verification (HITL)`

---

## 5) Linguistic Noise / Spam Routing (Too short → not forwarded)

Definition used by generator:
- `Linguistic Noise / Spam` when:
  - `tokens.length < 3` AND `text.length < 20`

Requirement (deliverable defensibility):
- Noise/spam rows must never be forwarded to spatial mapping.

Fix:
- `scripts/generate_authentic_logs.js`
  - Noise/spam rows force `Confidence_Score = 0.00%`.
  - `Method_Used = NOISE_FILTER`.

Validation:
- Checked all noise/spam rows are HITL-flagged and have `0.00%`.

---

## 6) Spatial Clustering Logs — Parity Audit (Core Engine Frozen)

Core engine reviewed (no changes applied):
- `src/server/services/nlp/ClusteringService.js`

### Audit area 1: DBSCAN parameter parity (minPts & epsilon)
- Engine uses adaptive parameters from:
  - `src/server/utils/similarityUtils.js`
- Generator calls:
  - `clusteringService.clusterIncidents(pointsForClustering)`
- Therefore the generator does not reimplement DBSCAN or distance math; it delegates to the engine.

### Audit area 2: centroid math
- Engine centroid is computed as the average of all cluster points.
- Generator uses engine outputs (`cluster.latitude`, `cluster.longitude`).

### Audit area 3: temporal & category pruning
- Engine enforces:
  - strict category match
  - 45-minute time window
  - before spatial distance acceptance
- Generator seeds `pointsForClustering` with `category` and `timestamp` fields so engine pruning is active.

### Audit area 4: metric truthfulness
- Generator uses engine outputs for:
  - `Core_Point_Count` (from `cluster.count` or `cluster.reports.length`)
  - `Urgency_Score` (from `cluster.urgency_score`)
- Generator does not generate random metrics.

### Audit area 5: Formation_Time_ms accuracy

Requirement:
- Use `performance.now()` around the actual `clusterIncidents()` execution.

Fix (generator-only):
- `scripts/generate_authentic_logs.js`
  - Uses `performance.now()` to measure `clusterIncidents()` block.
  - Outputs per-cluster average formation time for that run.

---

## 7) Edge AI Performance Logs — Empirical Benchmarking (Core Engines Frozen)

Frozen engines (audited only):
- `src/server/services/nlp/NLPService.js`
- `src/server/services/ml/AdvancedDecisionEngine.js`
- `src/server/services/ml/TensorFlowService.js`

### Prior generator weakness (not academically defensible)
- Tokenization and inference times were derived by splitting a single total time (e.g., 10%/90%), not measuring the real calls.

### Fix (generator-only): real timings, real memory
- `scripts/generate_authentic_logs.js` now measures:
  - `Model_Load_Time_ms`: wraps `await tensorFlowService.initialize()` once using `performance.now()`
    - First row stores measured time; subsequent rows store `0.00` (cache semantics)
  - `Tokenization_Time_ms`: wraps `nlpService.tokenizeText(text)`
  - `Inference_Time_ms`: wraps `await advancedDecisionEngine.classify(text, id)`
  - `Total_Pipeline_Time_ms`: sum of the two measured values
  - `Memory_Usage_MB`: real `process.memoryUsage().heapUsed` after classification
  - `Tokens_Processed`: `tokens.length`

### Device_Profile authenticity
- Device profile changed from simulated LGU machines to the actual local device:
  - HP Victus by HP Gaming Laptop 15-fb0xxx
  - AMD Ryzen 5 5600H (6C/12T)
  - GPU: NVIDIA GeForce RTX 3050 Ti Laptop GPU + AMD Radeon(TM) Graphics
  - OS: Windows 11 Home Single Language (64-bit)

---

## 8) Reproducibility Checklist (Defense)

### Generate JSON deliverables (semantic/spatial/performance)
- `node scripts/generate_authentic_logs.js`

### Convert JSON logs to separate Excel files
- `npm run logs:json-to-excel`

### Suggested validators (quick)
- `System_Action` parity validation:
  - Ensure mapping matches thresholds for all rows in `semantic_ai_logs.json`.
- `METAPHOR_FILTER` and `Linguistic Noise / Spam` routing:
  - Ensure no unclassified/noise rows are forwarded.
- Performance logs:
  - Ensure `Model_Load_Time_ms` is nonzero only once.
  - Ensure `Inference_Time_ms` has variance (fast rule-based vs slow TF fallback).

---

## 9) Known Environment Constraints

- Native TF binding (`@tensorflow/tfjs-node`) may not load on Node 22 Windows without rebuild.
- The generator can still run using pure `@tensorflow/tfjs` fallback (slower), which is acceptable for producing academic logs.

---

## 10) Files Changed (high-level)

- `scripts/generate_authentic_logs.js`
  - Semantic correctness: routing, matched keywords, noise behavior
  - Spatial: formation timing instrumentation
  - Performance: empirical benchmarking instrumentation + real device profile
- `src/server/services/ml/AdvancedDecisionEngine.js`
  - Safer keyword match (whole word/phrase boundaries)
  - METAPHOR_FILTER confidence forced to 0.0
- `scripts/json_folder_to_excel.js` (new)
- `package.json`, `README.md` (conversion usage)
- Deliverable artifacts regenerated under `deliverable_files_v2/json` and `deliverable_files_v2/excel`
