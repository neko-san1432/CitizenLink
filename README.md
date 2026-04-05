# DRIMS 2.0

**Intelligent Citizen complaint Management System with Advanced Geospatial Analytics & AI-Powered NLP**

---

## 📖 About the Program

### Introduction

DRIMS 2.0 (Disaster Risk Information Management System) is a comprehensive web-based complaint management system designed for Local Government Units (LGUs) in the Philippines. The system's primary innovations are:

1. **Adaptive DBSCAN Clustering** - Category-specific geospatial analysis for complaint hotspot detection
2. **Hybrid Edge-AI NLP Engine** - Multi-layer natural language processing with Tagalog/Bisaya/English (Bislish) support
3. **Human-in-the-Loop (HITL) Learning** - Continuous improvement through supervised keyword training

Built for Digos City, Davao del Sur, the system enables data-driven decision-making for resource allocation, policy development, and urban planning.

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Adaptive DBSCAN Clustering** | Thesis-validated, category-specific epsilon/minPts parameters (3-tier: Infrastructure 125m, Public Safety 50m, Sanitation 16m) synchronized with DRIMS_Simulated_System |
| **Hybrid NLP Processor** | 5-layer classification pipeline with bilingual keyword registry (Filipino/English), negation detection, false-positive filtering, and TensorFlow.js AI fallback |
| **Bislish Typo Tolerance** | Levenshtein-distance fuzzy matching for common Bisaya-English misspellings |
| **Duplication Detection** | Multi-modal similarity scoring (text, location, temporal) |
| **Statistical Analysis** | Client-side statistical validation with local analysis server for thesis-ready reporting |
| **Real-time Notifications** | Comprehensive notification system with priority levels and deduplication |
| **Interactive Heatmap** | Live complaint visualization with cluster overlays and filtering |
| **5-Phase Workflow** | complaint lifecycle: Submitted → Verified → Under Review → Action Taken → Resolved (migrated from original 6-status; application constants still reference original values) |
| **settings Management** | Role-protected system settings with category-based organization and public/private scoping |
| **Security Scanning** | Automated 3-phase pipeline: npm audit, ESLint security plugins, and pattern-based secret scanning |

---

## 📦 Installation & Dependencies

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **PostgreSQL** 13+ or **Supabase** account
- **npm** or **yarn** package manager

### Installation Steps

```bash
# Clone the repository
git clone <repository-url>
cd DRIMS

# Install Node.js dependencies
npm install

# Create environment file
cp .env .env.backup  # if needed
# Edit .env with your Supabase URL, keys, and other config

# Apply database migrations
# Run the SQL files in database/migrations/ in your Supabase SQL Editor

# Start development server
npm run dev
```

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **@supabase/supabase-js** | ^2.57.4 | PostgreSQL database client with real-time capabilities |
| **@tensorflow/tfjs-node** | ^4.x | Server-side AI inference with native C++ bindings |
| **@tensorflow-models/universal-sentence-encoder** | ^1.x | Sentence embedding model for NLP classification |
| **chart.js** | ^4.5.0 | Data visualization for analytics dashboards |
| **compression** | ^1.x | HTTP response compression middleware |
| **express** | ^4.21.2 | Core HTTP server framework |
| **helmet** | ^8.1.0 | Security middleware with CSP |
| **joi** | ^18.0.2 | Schema validation for API payloads |
| **multer** | ^2.0.2 | File upload handling for evidence attachments |
| **xss** / **isomorphic-dompurify** | latest | XSS sanitization for user inputs |
| **sentiment** | latest | Sentiment analysis for complaint text |
| **node-cron** | latest | Scheduled task execution (clustering, reminders) |

> **Note:** A `tar` → `^7.5.8` override is applied to patch a transitive vulnerability from `tfjs-node`.

---

## 🏗️ Architecture

### Directory Structure

```
DRIMS/
├── 📁 config/                    # Configuration management
├── 📁 public/
│   ├── 📁 brain-analytics/       # Analytics dashboard UI
│   │   ├── analytics.js          # Core analytics logic
│   │   ├── dictionary-manager.js # NLP dictionary training UI
│   │   └── train-system.js       # HITL training interface
│   ├── 📁 brain-dashboard/       # Simulation & Intelligence Engine
│   │   ├── simulation-engine.js  # Adaptive DBSCAN (9,400+ lines)
│   │   ├── nlp-processor.js      # Hybrid NLP Engine (2,200+ lines)
│   │   ├── map-intelligence-panel.js  # Slide-in complaint detail panel
│   │   ├── statistical-analysis.js
│   │   └── statistical-excel-export.js
│   ├── 📁 css/                   # Stylesheets
│   └── 📁 js/                    # Client-side components
│       └── 📁 components/
│           └── 📁 map/           # Map & heatmap components
├── 📁 src/
│   ├── 📁 server/
│   │   ├── 📁 controllers/       # Request handlers (17 controllers)
│   │   ├── 📁 services/          # Business logic (34 services)
│   │   │   ├── advancedDecisionEngine.js   # Hybrid AI + HITL
│   │   │   ├── 📁 brain/                   # Intelligence services
│   │   │   │   ├── clusteringService.js    # DBSCAN++ with Haversine
│   │   │   │   └── nLPService.js           # Bilingual NLP engine
│   │   │   ├── clusteringScheduler.js      # Scheduled clustering
│   │   │   ├── duplicationDetectionService.js
│   │   │   ├── nlpManagementService.js     # Dictionary management
│   │   │   ├── notificationService.js      # Real-time alerts
│   │   │   ├── similarityCalculatorService.js
│   │   │   └── tensorFlowService.js        # AI model management (cached)
│   │   ├── 📁 repositories/      # Data access layer
│   │   ├── 📁 models/            # Data models & validation
│   │   ├── 📁 middleware/        # Express middleware
│   │   ├── 📁 routes/            # Route definitions (26 route files)
│   │   └── 📁 utils/
│   │       └── similarityUtils.js # Thesis-validated DBSCAN params (v5.0)
│   └── 📁 client/                # Frontend components
├── 📁 legacy/                    # Deprecated code (HR, old LGU routes)
│   ├── 📁 controllers/           # HRController, LguAdminController
│   ├── 📁 routes/                # Old analytics, coordinator, HR, LGU routes
│   ├── 📁 views/                 # Old auth, coordinator, HR views
│   ├── 📁 client-hr/             # Old HR dashboard client code
│   └── 📁 js/                    # Old HR dashboard scripts
├── 📁 views/
│   └── 📁 pages/                 # HTML templates
│       ├── 📁 admin/
│       ├── 📁 auth/
│       ├── 📁 citizen/
│       ├── 📁 coordinator/
│       ├── 📁 hr/
│       ├── 📁 lgu/
│       ├── 📁 lgu-admin/
│       ├── 📁 lgu-officer/
│       ├── 📁 shared/
│       └── 📁 super-admin/
├── 📁 docs/                      # Documentation & audit reports
│   └── 📁 performance/           # Benchmark reports
├── 📁 database/                  # Migration scripts
│   ├── 📁 migrations/            # Schema migrations (18 files)
│   └── 📁 seeds/                 # Sample data
├── 📁 scripts/                   # Utility & diagnostic scripts
├── 📁 storage/
│   └── 📁 aiCache/              # TF model & anchor embedding cache
└── 📁 tests/                     # Test suites (25 suites, 211 tests)
```

### Architectural Pattern

DRIMS follows a **layered MVC + Service architecture** with intelligent processing layers:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
│  Brain Dashboard • Analytics UI • Map Visualizations • NLP (Client)     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                         CONTROLLER LAYER                                 │
│  • Request/Response handling • Input validation • Rate limiting          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                     INTELLIGENCE LAYER (New in v2.0)                     │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐    │
│  │AdvancedDecision │ │  Clustering     │ │  Duplication            │    │
│  │Engine (HITL)    │ │  Service        │ │  Detection              │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────────────┘    │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐    │
│  │ NLP Management  │ │  TensorFlow     │ │  Similarity             │    │
│  │ Service         │ │  Service        │ │  Calculator             │    │
│  └─────────────────┘ └─────────────────┘ └─────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                         SERVICE LAYER                                    │
│  • complaint workflows • Notifications • User management • Reports       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                       REPOSITORY LAYER                                   │
│  • CRUD operations • Geospatial queries • RLS-protected access           │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                       DATABASE LAYER                                     │
│  PostgreSQL/Supabase                                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🧠 Core Feature 1: Adaptive DBSCAN Clustering

### Overview

DRIMS implements **Adaptive DBSCAN** (Density-Based Spatial Clustering of Applications with Noise) with thesis-validated, category-specific parameters derived from the **Sorted K-Distance (Elbow) Method**. Parameters are synchronized with the DRIMS_Simulated_System.

### Why Adaptive DBSCAN?

| Comparison | Standard DBSCAN | Adaptive DBSCAN (Ours) |
|------------|-----------------|------------------------|
| **Epsilon (ε)** | Fixed for all data | 3-tier adaptive (Infrastructure/Public Safety/Sanitation) |
| **MinPts** | Fixed threshold | Life-threat aware (Fire=2, Crime=3, Trash=4, Infrastructure=5) |
| **Semantic Awareness** | None | Relationship matrix validation |
| **Use Case** | Generic clustering | Domain-optimized complaint analysis |
| **Distance** | Euclidean | Haversine (geospatial) |

### Category-Specific Parameters (v5.0 — Thesis-Validated)

These parameters were derived using the **Sorted K-Distance Graph (Elbow Method)** on field-collected complaint data and are organized into 3 adaptive tiers:

| Tier | Category | Epsilon (ε) | MinPts | Rationale |
|------|----------|-------------|--------|-----------|
| **Infrastructure** | Infrastructure | 125m (0.001125°) | 5 | Large-scale road damage patterns |
| **Public Safety** | Flooding | 50m (0.00045°) | 3 | Emergency events need moderate radius |
| **Public Safety** | Utilities | 50m (0.00045°) | 3 | Localized outage reports (falls to default minPts) |
| **Public Safety** | Fire | 50m (0.00045°) | 2 | Critical — even 2 reports demand attention |
| **Public Safety** | Accident | 50m (0.00045°) | 3 | Traffic accidents are localized |
| **Public Safety** | Crime | 50m (0.00045°) | 3 | Public safety concern |
| **Infrastructure** | Pothole | 125m (0.001125°) | 5 | Road issues span larger stretches |
| **Sanitation** | Trash/Garbage | 16m (0.000144°) | 4 | Sanitation issues are hyper-local |

**Implementation Files:**
- `src/server/utils/similarityUtils.js` - Centralized parameter definitions (v5.0)
- `src/server/services/brain/clusteringService.js` - Backend DBSCAN++ with Haversine distance, 45-minute temporal window, and "Lone Wolf" critical-incident handling
- `public/brain-dashboard/simulation-engine.js` - Frontend visualization engine

### Mathematical Foundation

#### 1. Haversine Formula (Distance Calculation)

```
a = sin²(Δφ/2) + cos(φ₁) × cos(φ₂) × sin²(Δλ/2)
c = 2 × atan2(√a, √(1-a))
d = R × c
```

Where:
- **φ₁, φ₂** = latitudes (in radians)
- **Δφ, Δλ** = differences in latitude/longitude
- **R** = Earth's radius (6,371 km)

#### 2. Epsilon to Degrees Conversion

```javascript
// Convert meters to degrees for GPS coordinates
// At Digos City latitude (~7°N), this is approximately:
// 1 degree ≈ 111,000 meters
epsilonDegrees = epsilonMeters / 111000;
```

#### 3. Semantic Relationship Validation

Before clustering, points are validated against the **Relationship Matrix**:

```javascript
const RELATIONSHIP_MATRIX = {
    "Flooding": ["Pipe Leak", "Road Damage", "Trash", "Traffic", "Environment", "Flood", 
                 "Accident", "Stranded", "Evacuation", "Heavy Rain", "Clogged Drainage", "Clogged Canal"],
    "Fire": ["Traffic", "Public Safety", "Smoke", "Evacuation", "Road Obstruction", 
             "Blackout", "Explosion", "Gas Leak", "Burning Trash"],
    "Pothole": ["Road Damage", "Infrastructure", "Accident", "Traffic"],
    // ... 30+ defined relationships
};
```

Two complaints can only cluster if:
1. They are within ε distance, AND
2. Their categories are in each other's relationship list OR same category

---

## 🗣️ Core Feature 2: Hybrid NLP Processor

### Architecture Overview

The NLP Processor uses a **5-layer classification pipeline** that prioritizes speed while maintaining accuracy. The system supports a **bilingual keyword registry** (Filipino/English) with negation detection, false-positive filtering (e.g., "baha" vs "bahay"), and hierarchy/synonym matching.

> **Note:** NLP subtypes/subcategories have been removed from the taxonomy. The system now classifies into top-level categories only.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: TOKENIZATION + CLAUSE SEGMENTATION                            │
│  - Pre-processes input using Bislish dialect map                        │
│  - "basora" → "basura", "lubac" → "lubak"                               │
│  - Levenshtein distance for fuzzy matching                              │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ Cleaned Tokens
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: DICTIONARY MATCHING (FAST PATH) ~1-5ms                        │
│  - Single token + N-gram matching                                       │
│  - Hierarchy mapping (specific → parent category)                       │
│  - Returns if confidence ≥ 60% (AI_CONFIDENCE_THRESHOLD)                │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ No match or low confidence
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: TensorFlow.js AI FALLBACK ~50-100ms                           │
│  - Universal Sentence Encoder embeddings                                │
│  - Cosine similarity against category anchors                           │
│  - Accepted if similarity ≥ 0.75 (AI_SIMILARITY_THRESHOLD)              │
│  - GPU-accelerated with WebGL shaders                                   │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ Classification result
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: CLAUSE-BASED MODIFIER DETECTION                               │
│  - Negation detection and false-positive filtering                      │
│  - Context-aware clause analysis                                        │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ Refined result
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 5: MULTI-LABEL RESOLUTION                                        │
│  - Safety multiplier weighting (Fire=1.3x, Noise=0.8x)                  │
│  - Returns primary + secondary categories                               │
│  - Queues low-confidence results for HITL review                        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Bislish Typo Tolerance (v4.3)

Common misspellings from Digos City's Bisaya-English dialect are automatically corrected:

```javascript
const BISLISH_TYPO_MAP = {
    // Water/Drainage
    "tubog": "tubig",
    "bahag": "baha",
    
    // Utilities
    "way kuryente": "brownout",
    "walay kuryente": "brownout",
    
    // Sanitation
    "basora": "basura",
    "mabao": "mabaho",
    
    // Infrastructure
    "lubac": "lubak",
    "lubaq": "lubak"
};
```

### Safety Multipliers (Ontology-Based Weighting)

To ensure safety hazards mathematically outrank aesthetic issues:

| Category | Multiplier | Rationale |
|----------|------------|-----------|
| Public Safety / Emergency / Fire | 1.30 | Immediate life threat |
| Environment / Flood / Flooding / Landslide | 1.20 | Environmental hazard |
| Utilities | 1.10 | Service disruption |
| Infrastructure | 1.05 | Structural concern |
| Sanitation / Health Hazard / Pest Infestation | 1.00 | Baseline |
| Traffic / Traffic Congestion | 0.90 | Moderate impact |
| Stray Animals | 0.85 | Animal control |
| Noise complaint / Noise | 0.80 | Quality of life |
| Others | 0.70 | Lowest priority |

### Performance Optimizations

1. **Shader Warmup**: Pre-compiles WebGL shaders on page load to prevent first-click freeze
2. **Vectorized Classification**: GPU-accelerated `tf.matMul` instead of CPU loops
3. **Local Model Caching**: 100MB USE model cached in `storage/aiCache/`
4. **Anchor Caching**: SHA-256 hash-based category embedding cache

**Files:**
- `public/brain-dashboard/nlp-processor.js` - Client-side NLP engine
- `src/server/services/brain/nLPService.js` - Server-side bilingual NLP with false-positive filtering
- `src/server/services/advancedDecisionEngine.js` - Server-side with HITL
- `src/server/services/tensorFlowService.js` - Model management (cached)

---

##  Core Feature 3: Duplication Detection

### Multi-Modal Similarity Scoring

The system detects duplicate complaints using three dimensions:

| Dimension | Algorithm | Weight |
|-----------|-----------|--------|
| **Text Similarity** | Levenshtein distance + Keyword overlap | 40% |
| **Location Similarity** | Haversine distance within radius | 40% |
| **Temporal Similarity** | Time window matching | 20% |

### Algorithm Details

```javascript
// Final duplication score
finalScore = (textScore * 0.4) + (locationScore * 0.4) + (temporalScore * 0.2);

// Thresholds
if (finalScore >= 0.85) → "Very High Confidence Duplicate"
if (finalScore >= 0.75) → "High Confidence Duplicate"
if (finalScore >= 0.60) → "Medium Confidence Duplicate"
```

**File:** `src/server/services/duplicationDetectionService.js`

---

## 🎓 Core Feature 4: Human-in-the-Loop (HITL) Learning

### Overview

The advancedDecisionEngine implements supervised learning through human feedback:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LOW CONFIDENCE DETECTION                                                │
│  - AI classifies with confidence < 70%                                   │
│  - Result queued in pending_reviews table                               │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  ADMIN REVIEW (Brain Analytics Dashboard)                               │
│  - Admin sees unconfident classifications                               │
│  - Options: Approve, Correct, or Dismiss                                │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ If corrected
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  KEYWORD TRAINING                                                        │
│  - New keyword added to nlp_keywords table                              │
│  - Future complaints with this keyword → correct category               │
│  - Model improves over time                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Features

- **Batch Review**: Process multiple low-confidence items efficiently
- **Auto-Cleanup**: Matches pending reviews against newly trained keywords
- **Audit Trail**: All training actions logged with user ID and timestamp

**Files:**
- `src/server/services/advancedDecisionEngine.js`
- `public/brain-analytics/dictionary-manager.js`
- `public/brain-analytics/train-system.js`

---

## 📊 Core Feature 5: Statistical Analysis

### Integration

The system includes a client-side statistical analysis module that communicates with a local statistical server (part of the DRIMS_Simulated_System, running on the same host at port 3456). The analysis computes thesis-ready metrics from the dashboard data.

### Generated Metrics

| Metric | Formula | Purpose |
|--------|---------|---------|
| **Silhouette Score** | (b - a) / max(a, b) | Cluster cohesion/separation quality |
| **Precision** | TP / (TP + FP) | Classification accuracy |
| **Recall** | TP / (TP + FN) | Coverage of true positives |
| **F1 Score** | 2 × (P × R) / (P + R) | Harmonic mean of P and R |
| **Chi-Square (χ²)** | Σ((O - E)² / E) | Category independence test |
| **T-Test** | (x̄₁ - x̄₂) / SE | Response time comparison |

### Thesis Export

One-click generation of:
- Auto-generated thesis paragraphs with statistical backing
- Full analysis report in JSON/PDF
- Confusion matrices
- Clustering validation metrics

**Files:**
- `public/brain-dashboard/statistical-analysis.js`
- `public/brain-dashboard/statistical-excel-export.js`

---

## 🔔 Notification System

### Notification Types

| Type | Icon | Priority | Use Case |
|------|------|----------|----------|
| `COMPLAINT_SUBMITTED` | ✅ | Normal | Citizen confirmation |
| `COMPLAINT_STATUS_CHANGED` | 🔄 | Normal | Status updates |
| `COMPLAINT_DUPLICATE` | 🔗 | Normal | Duplicate detected |
| `COMPLAINT_ASSIGNED` | 👷 | Normal | Assigned to staff |
| `COMPLAINT_RESOLVED` | ✔️ | Normal | Resolution confirmed |
| `TASK_ASSIGNED` | 📋 | High | Officer assignment |
| `TASK_DEADLINE_APPROACHING` | ⏰ | High | 24h warning |
| `TASK_OVERDUE` | 🚨 | Critical | Missed deadline |
| `ASSIGNMENT_COMPLETED` | ✅ | Normal | Assignment done |
| `NEW_COMPLAINT_REVIEW` | 🔍 | High | New review needed |
| `APPROVAL_REQUIRED` | 🔐 | High | Needs approval |
| `OFFICER_REMINDER` | 💬 | Normal | Officer nudge |
| `ADMIN_REMINDER` | 🔔 | High | Admin nudge |
| `PENDING_TASK_REMINDER` | ⏰ | Normal | Pending task alert |
| `WORKFLOW_STEP_COMPLETED` | 📈 | Normal | Step advanced |
| `LGU_WORK_COMPLETED` | 🎯 | Normal | LGU work done |
| `RESOLUTION_REVIEW_NEEDED` | 🔍 | High | Review resolution |

> **Note:** The codebase defines 25 notification types in `src/shared/constants.js`. This table shows the 17 most commonly triggered types. Additional types include `COMPLAINT_REJECTED`, `OFFICER_UPDATE`, `TASK_PRIORITY_CHANGED`, `COORDINATOR_NOTE`, `DUPLICATE_DETECTED`, `SIMILAR_COMPLAINTS`, `RESOLUTION_PENDING_APPROVAL`, and `COMPLAINT_ESCALATED`.

### Features

- **Deduplication**: Prevents notification spam
- **Priority Levels**: Normal → High → Critical
- **Bulk Notifications**: Efficient batch creation
- **Real-time**: Instant delivery via Supabase Realtime

**File:** `src/server/services/notificationService.js`

---

## 🗄️ Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| **complaints** | Main complaint records with geospatial coordinates |
| **complaint_clusters** | DBSCAN clustering results |
| **complaint_similarities** | Duplication detection results |
| **categories** | Top-level complaint categories |
| **subcategories** | Specific complaint types |
| **departments** | Government departments |
| **department_subcategory_mapping** | Many-to-many dept↔subcategory mapping with response priority |
| **nlp_keywords** | HITL-trained keyword mappings |
| **nlp_pending_reviews** | Low-confidence classifications queue |
| **notification** | User notification inbox |
| **audit_logs** | System-wide action logging |
| **settings** | System configuration key-value store with categories |

### complaints Schema

```sql
CREATE TABLE public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  descriptive_su TEXT NOT NULL,
  location_text TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  category TEXT,
  department_r TEXT[] DEFAULT '{}',
  workflow_status TEXT DEFAULT 'submitted'
    CHECK (workflow_status IN ('submitted', 'verified', 'under_review', 'action_taken', 'resolved')),
  -- Note: Migrated from original 6-status system by 20260205UpdateWorkflowConstraint.
  priority TEXT DEFAULT 'low'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_coordinator_id UUID,
  phase_comments JSONB DEFAULT '{}',  -- Structured comments per workflow phase
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔧 API Endpoints

### Intelligence & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/brain/complaints` | Get complaints with coordinates for brain dashboard |
| GET | `/api/superadmin/clustering/status` | Get DBSCAN clustering scheduler status |
| POST | `/api/superadmin/clustering/trigger` | Manually trigger DBSCAN clustering |
| GET | `/api/nlp/pending-reviews` | Get HITL pending queue |
| POST | `/api/nlp/pending-reviews/:id/resolve` | Resolve a pending review (train keyword) |
| GET | `/api/nlp/dictionary` | Get complete NLP dictionary |
| GET | `/api/nlp/keywords` | Get all trained keywords |
| POST | `/api/nlp/keywords` | Add a new keyword |

### settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get all settings (authenticated) |
| GET | `/api/settings/public` | Get public-scoped settings |
| GET | `/api/settings/category/:category` | Get settings by category |
| POST | `/api/settings` | Create setting (lgu/super-admin) |
| PUT | `/api/settings/:key` | Update setting (lgu/super-admin) |
| DELETE | `/api/settings/:key` | Delete setting (super-admin only) |

### complaints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/complaints` | Submit new Complaint |
| GET | `/api/complaints/my` | Get user's complaints |
| GET | `/api/complaints/:id` | Get complaint details |
| PATCH | `/api/complaints/:id/status` | Update status |
| POST | `/api/complaints/:id/remind` | Send follow-up reminder |
| POST | `/api/complaints/:id/confirm-resolution` | Citizen confirms resolution |
| POST | `/api/complaints/:id/mark-complete` | Officer marks assignment complete |
| PATCH | `/api/complaints/:id/transition` | Human confirmation workflow transition |
| GET | `/api/complaints/check-duplicates` | Check for duplicate complaints |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get all notifications |
| GET | `/api/notifications/unread` | Get unread notifications |
| GET | `/api/notifications/count` | Get notification count |
| POST | `/api/notifications/:id/mark-read` | Mark as read |
| POST | `/api/notifications/mark-all-read` | Mark all as read |
| GET | `/api/notifications/stream` | SSE notification stream |

---

## 👥 User Roles & RBAC

DRIMS operates in **Simple Workflow Mode** with 3 core roles. Legacy sub-roles (`lgu-admin`, `lgu-hr`, `lgu-officer`, `complaint-coordinator`) are automatically normalized to `lgu` by the auth middleware.

| Role | Key Permissions |
|------|-----------------|
| **Citizen** | Submit complaints, track status, send reminders, confirm resolution |
| **LGU** | Review/verify complaints, manage assignments, access heatmap & analytics, NLP training, department management |
| **Super Admin** | Full system access, HITL training, user management, system settings, clustering triggers |

> **Note:** LGU staff can switch to citizen mode to file complaints. Legacy role-specific controllers and routes are preserved in the `legacy/` directory for reference.

---

## 🛠️ NPM Scripts

```bash
# Development
npm run dev              # Start with auto-reload (nodemon)

# Production
npm start                # Start production server

# Code Quality
npm run lint:fix         # Auto-fix linting issues with ESLint

# Testing
npm test                 # Run test suite
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
npm run test:security    # Run security-focused tests
npm run test:functional  # Run functional tests

# Security
npm run security-audit   # Run npm audit
npm run security-fix     # Run npm audit fix
npm run security-scan    # Run custom 3-phase security scanner
```

---

## 🛡️ Security Features

| Feature | Implementation |
|---------|----------------|
| **Input Validation** | Joi schemas for all API payloads |
| **GPS Bounds Validation** | Reject coordinates outside Digos City |
| **SQL Injection Protection** | Parameterized queries via Supabase client |
| **XSS Prevention** | Helmet CSP, `xss` + `isomorphic-dompurify` sanitization |
| **Rate Limiting** | Per-route request throttling |
| **RBAC** | Row Level Security policies with security DEFINER functions |
| **Session Management** | Secure cookie handling |
| **RLS Recursion Protection** | `check_is_admin_safe()` and `check_is_lgu_staff()` security DEFINER functions to prevent infinite RLS policy loops |
| **Automated Security Scanning** | 3-phase pipeline: `npm audit`, ESLint security plugins (`eslint-plugin-security`, `eslint-plugin-no-unsanitized`), pattern-based secret scanning |
| **Secret Scanning** | Regex-based detection of API keys, AWS keys, and hardcoded credentials in source |
| **Dependency Auditing** | 0 npm vulnerabilities enforced; `tar` override for transitive tfjs-node dependency |

### Security Audit (2026-02-28)

| Metric | Result |
|--------|--------|
| Test suites | 25 passing |
| Tests | 211 passing, 0 failures |
| npm vulnerabilities | 0 |
| ESLint errors | 0 (538 non-blocking warnings) |
| Secret scan findings | 0 |
| CodeQL alerts | 0 |

Full report: [docs/AUDIT_REPORT_2026-02-28.md](docs/AUDIT_REPORT_2026-02-28.md)

---

## 📈 Performance Optimizations

### TensorFlow Inference (Server-Side)

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Model loading | ~5,000 ms | 300–500 ms | **~93%** |
| Anchor embedding | ~3,000 ms | 1–2 ms | **~99.9%** |

- **Local model caching**: Model weights saved to `storage/aiCache/tfModelCache/` on first download, then loaded from disk
- **Anchor embedding caching**: Pre-computed anchor vectors saved to `storage/aiCache/tfAnchorCache.json` with SHA-256 fingerprinting — recomputed only when config changes
- **Vectorized classification**: Matrix multiplication (`anchorMatrix.matMul()`) for single-pass cosine similarity instead of per-category loops
- **Native backend**: Prefers `@tensorflow/tfjs-node` (C++ bindings) with graceful fallback to vanilla `@tensorflow/tfjs`
- **Server pre-loading**: AI engine pre-initialized at startup to prevent first-request delay

### Heatmap Rendering (~93% Reduction)

| Metric | Before | After |
|--------|--------|-------|
| Render cycle | ~7.1 ms | ~0.5 ms |

Key optimizations:
1. **Singleton Supabase client** — Eliminated per-request `createClient()` calls (−99.0%)
2. **Layer reuse** — `setLatLngs()` instead of full canvas recreation on filter changes
3. **AABB bounding-box pre-check** — 4-comparison rejection before ray-casting (−99.2% for out-of-bounds points)
4. **Loop over spread** — Replaced `Math.max(...spread)` with manual loop (−93.5%, eliminates stack overflow at n=1000+)
5. **O(n) marker updates** — Pre-built Map + requestAnimationFrame gating instead of O(n²) scans
6. **CSS visibility toggle** — DOM class toggling instead of element insertion/removal

Full report: [docs/performance/heatmap-optimization-report.md](docs/performance/heatmap-optimization-report.md)

### Client-Side
- **Shader Warmup**: Pre-compile WebGL on page load
- **Lazy Loading**: AI model loads asynchronously
- **GPU Acceleration**: `tf.matMul` for vectorized operations

### Server-Side
- **Model Caching**: USE model stored in `storage/aiCache/`
- **Anchor Caching**: SHA-256 hash-based category embedding cache
- **Connection Pooling**: Supabase singleton client management
- **HTTP Compression**: `compression` middleware for response payloads

---

## 🚀 Scalability & Future-Proofing

### Handling 100,000+ Complaints

As the database grows beyond 25,000+ records, the "Download Everything" strategy for the heatmap will reach its limit. The following architectural shifts are recommended for long-term scalability:

1. **Viewport Filtering (Bounding Box)**: Instead of fetching the entire city's data, the client should send the map's current coordinates (Bounding Box) to the API. Supabase/PostGIS can then return only the records visible on the user's screen.
2. **Server-Side Clustering**: For zoomed-out views, the server should pre-calculate clusters and send a single "summary" point instead of thousands of individual records. This prevents browser memory exhaustion.
3. **Spatial Indexing (PostGIS)**: Utilize PostgreSQL's `SP-GiST` or `GiST` indexes on the coordinate columns to keep spatial queries (like "find all points in this box") performing in milliseconds, even with millions of rows.
4. **Current "Safety Valve"**: The system currently implements a **25,000-row limit** in `ComplaintRepository.js` and a matching `max_rows` setting in Supabase to ensure stable performance for the current dataset (~20k rows).

---

## 👨‍💻 Development Team

> **Note**: For a chronological history of changes, see [docs/implementationLog.md](docs/implementationLog.md).

**Pyrrhus Go** - _Backend Developer_
- Server architecture and API design
- DBSCAN algorithm implementation
- Database schema and spatial queries

**John Dave Maca** - _Frontend Developer_
- User interface design
- Map visualization and clustering UI
- Interactive heatmap dashboard

**Josh Andre Timosan** - _Data Surveyor_
- Database design and optimization
- Geospatial data modeling
- Analytics and reporting requirements

---

## 📚 References

### Theoretical Foundations

1. **Ester, M., Kriegel, H. P., Sander, J., & Xu, X. (1996)**. "A density-based algorithm for discovering clusters in large spatial databases with noise." _KDD-96_, pp. 226-231.

2. **Sinnott, R. W. (1984)**. "Virtues of the Haversine." _Sky and Telescope_, 68(2), 159.

3. **Schubert, E., et al. (2017)**. "DBSCAN Revisited, Revisited: Why and How You Should (Still) Use DBSCAN." _ACM TODS_, 42(3), 1-21.

4. **Cer, D., et al. (2018)**. "Universal Sentence Encoder." _arXiv:1803.11175_.

### Implementation Resources

- **TensorFlow.js** - Client/Server-side ML inference
- **Leaflet.js** - Interactive maps library
- **Supabase** - PostgreSQL database with real-time and auth

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🗄️ Database Migrations

Recent schema changes (`database/migrations/`):

| Migration | Description |
|-----------|-------------|
| `20260205AddPhaseComments` | Added `phase_comments` JSONB column for structured per-phase comments |
| `20260205CreatedepartmentMapping` | department↔subcategory many-to-many junction table with response priority |
| `20260205UpdateWorkflowConstraint` | Migration script to transition from 6-status to 5-phase workflow (`submitted` → `verified` → `under_review` → `action_taken` → `resolved`). Application constants still reference original statuses. |
| `20260212SecureUnrestrictedTables` | Enabled RLS on 6 previously unprotected NLP/mapping tables |
| `20260214RemoveNlpSubtypes` | Dropped subcategory columns from NLP tables (taxonomy simplification) |
| `20260214RemoveSubtypeColumn` | Dropped `subcategory` column from `complaints` table |
| `20260219EmergencyFixRecursion` | Created `check_is_admin_safe()` security DEFINER to fix infinite RLS recursion on `user_profiles` |
| `20260224FixcomplaintsRecursion` | Created `check_is_lgu_staff()` security DEFINER to fix infinite RLS recursion on `complaints` |

---

## 🔧 Utility Scripts

| Script | Purpose |
|--------|---------|
| `security-scan.js` | Automated 3-phase security scanning (npm audit, ESLint, secret detection) |
| `benchmarkHeatmap.js` / `benchmarkTf.js` | Performance benchmarks for heatmap and TensorFlow |
| `check_legacy_roles.js` / `cleanup_legacy_accounts.js` | Legacy account auditing and cleanup |
| `checkNlpData.js` / `nlpSupabaseDiagnostics.js` | NLP data validation and diagnostics |
| `recalculatePriority.js` | Recalculate complaint priorities |
| `validateTaxonomyAlignment.js` | Verify brain config ↔ database taxonomy alignment |
| `seedRunner.js` / `generateRemainingSeeds.js` | Database seeding utilities |
| `debug_rls.js` / `print_rls_fix.js` | RLS policy debugging and fix generation |
| `exportBrainConfig.js` | Export brain configuration to JSON |

---

**DRIMS** - Intelligent complaint Management with Geospatial Analytics & AI 🗺️🧠
