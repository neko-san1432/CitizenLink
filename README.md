# CitizenLink (DRIMS 2.0)

**Intelligent Citizen Complaint Management System with Advanced Geospatial Analytics & AI-Powered NLP**

---

## 📖 About the Program

### Introduction

CitizenLink (formerly DRIMS 2.0) is a comprehensive web-based complaint management system designed for Local Government Units (LGUs) in the Philippines. The system's primary innovations are:

1. **Adaptive DBSCAN Clustering** - Category-specific geospatial analysis for complaint hotspot detection
2. **Hybrid Edge-AI NLP Engine** - Multi-layer natural language processing with Tagalog/Bisaya/English (Bislish) support
3. **Causality Analysis** - Physics-based disaster chain detection and correlation mapping
4. **Human-in-the-Loop (HITL) Learning** - Continuous improvement through supervised keyword training

Built for Digos City, Davao del Sur, the system enables data-driven decision-making for resource allocation, policy development, and urban planning.

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Adaptive DBSCAN Clustering** | Category-specific epsilon/minPts parameters (Fire=25m, Sanitation=16m) with semantic relationship awareness |
| **Hybrid NLP Processor** | 5-layer classification pipeline with rule-based fast path and TensorFlow.js AI fallback |
| **Bislish Typo Tolerance** | Levenshtein-distance fuzzy matching for common Bisaya-English misspellings |
| **Causality Manager** | Physics-based disaster chain detection (Flood→Traffic, Fire→Evacuation) |
| **Duplication Detection** | Multi-modal similarity scoring (text, location, temporal) |
| **Statistical Analysis** | Integrated Python-powered statistical validation with thesis-ready reporting |
| **Real-time Notifications** | Comprehensive notification system with priority levels and deduplication |
| **Interactive Heatmap** | Live complaint visualization with cluster overlays and filtering |

---

## 📦 Installation & Dependencies

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **PostgreSQL** 13+ or **Supabase** account
- **Python** 3.10+ (for statistical analysis)
- **npm** or **yarn** package manager

### Installation Steps

```bash
# Clone the repository
git clone <repository-url>
cd CitizenLink

# Install Node.js dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate

# Apply Row Level Security (RLS) policies
# Run the SQL script in your Supabase SQL Editor:
# scripts/setup_rls.sql

# Start development server
npm run dev
```

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| **@supabase/supabase-js** | ^2.57.4 | PostgreSQL database client with real-time capabilities |
| **@tensorflow/tfjs-node** | ^4.x | Server-side AI inference (Universal Sentence Encoder) |
| **chart.js** | ^4.5.0 | Data visualization for analytics dashboards |
| **express** | ^4.21.2 | Core HTTP server framework |
| **helmet** | ^8.1.0 | Security middleware with CSP |
| **joi** | ^18.0.2 | Schema validation for API payloads |
| **multer** | ^2.0.2 | File upload handling for evidence attachments |

---

## 🏗️ Architecture

### Directory Structure

```
CitizenLink/
├── 📁 config/                    # Configuration management
├── 📁 public/
│   ├── 📁 brain-analytics/       # Analytics dashboard UI
│   │   ├── analytics.js          # Core analytics logic
│   │   ├── dictionary-manager.js # NLP dictionary training UI
│   │   └── train-system.js       # HITL training interface
│   ├── 📁 brain-dashboard/       # Simulation & Intelligence Engine
│   │   ├── simulation-engine.js  # Adaptive DBSCAN (9,400+ lines)
│   │   ├── nlp-processor.js      # Hybrid NLP Engine (2,200+ lines)
│   │   ├── causality-manager.js  # Disaster chain reasoning
│   │   ├── statistical-analysis.js
│   │   └── statistical-excel-export.js
│   ├── 📁 css/                   # Stylesheets
│   └── 📁 js/                    # Client-side components
│       └── 📁 components/
│           └── 📁 map/           # Map & heatmap components
├── 📁 src/
│   ├── 📁 server/
│   │   ├── 📁 controllers/       # Request handlers (19 controllers)
│   │   ├── 📁 services/          # Business logic (32 services)
│   │   │   ├── AdvancedDecisionEngine.js   # Hybrid AI + HITL
│   │   │   ├── ClusteringService.js        # Backend DBSCAN
│   │   │   ├── ClusteringScheduler.js      # Scheduled clustering
│   │   │   ├── DuplicationDetectionService.js
│   │   │   ├── NlpManagementService.js     # Dictionary management
│   │   │   ├── NotificationService.js      # Real-time alerts
│   │   │   ├── SimilarityCalculatorService.js
│   │   │   └── TensorFlowService.js        # AI model management
│   │   ├── 📁 repositories/      # Data access layer
│   │   ├── 📁 models/            # Data models & validation
│   │   ├── 📁 middleware/        # Express middleware
│   │   ├── 📁 routes/            # Route definitions (29 route files)
│   │   └── 📁 utils/
│   │       └── similarityUtils.js # Centralized DBSCAN parameters
│   └── 📁 client/                # Frontend components
├── 📁 views/
│   └── 📁 pages/                 # HTML templates (51 pages)
│       ├── 📁 admin/
│       ├── 📁 coordinator/
│       ├── 📁 lgu-admin/
│       └── 📁 citizen/
├── 📁 database/                  # Migration scripts
├── 📁 scripts/                   # Utility scripts
└── 📁 tests/                     # Test suites
```

### Architectural Pattern

CitizenLink follows a **layered MVC + Service architecture** with intelligent processing layers:

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
│  • Complaint workflows • Notifications • User management • Reports       │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                       REPOSITORY LAYER                                   │
│  • CRUD operations • Geospatial queries • RLS-protected access           │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────────┐
│                       DATABASE LAYER                                     │
│  PostgreSQL/Supabase with PostGIS Extension                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🧠 Core Feature 1: Adaptive DBSCAN Clustering

### Overview

CitizenLink implements **Adaptive DBSCAN** (Density-Based Spatial Clustering of Applications with Noise) with category-specific parameters derived from the **Sorted K-Distance (Elbow) Method**.

### Why Adaptive DBSCAN?

| Comparison | Standard DBSCAN | Adaptive DBSCAN (Ours) |
|------------|-----------------|------------------------|
| **Epsilon (ε)** | Fixed for all data | Per-category tuning |
| **MinPts** | Fixed threshold | Life-threat aware (Fire=1, Trash=4) |
| **Semantic Awareness** | None | Relationship matrix validation |
| **Use Case** | Generic clustering | Domain-optimized complaint analysis |

### Category-Specific Parameters

These parameters were derived using the **Sorted K-Distance Graph (Elbow Method)** on field-collected complaint data:

| Category | Epsilon (ε) | MinPts | Rationale |
|----------|-------------|--------|-----------|
| **Fire** | 25m (0.000225°) | 1 | Single fire report = immediate attention |
| **Accident** | 25m | 1 | Traffic accidents are localized |
| **Crime** | 25m | 1 | Single crime = valid cluster |
| **Pothole** | 50m (0.00045°) | 3 | Infrastructure issues cluster at intersections |
| **Trash/Garbage** | 16m (0.000144°) | 4 | Sanitation issues are hyper-local |
| **Infrastructure** | 125m (0.001125°) | 3 | Large-scale road damage patterns |
| **Flooding** | 200m (0.0018°) | 5 | Area-wide water events |
| **Utilities** | 200m | 5 | Power/water outages affect zones |

**Implementation Files:**
- `src/server/utils/similarityUtils.js` - Centralized parameter definitions
- `src/server/services/ClusteringService.js` - Backend DBSCAN implementation
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
// 1 degree ≈ 111,320 meters
epsilonDegrees = epsilonMeters / 111320;
```

#### 3. Semantic Relationship Validation

Before clustering, points are validated against the **Relationship Matrix**:

```javascript
const RELATIONSHIP_MATRIX = {
    "Flooding": ["Traffic", "Clogged Drainage", "Road Damage", "Stranded"],
    "Fire": ["Smoke", "Evacuation", "Traffic", "Power Outage"],
    "Pothole": ["Road Damage", "Accident", "Traffic"],
    // ... 30+ defined relationships
};
```

Two complaints can only cluster if:
1. They are within ε distance, AND
2. Their categories are in each other's relationship list OR same category

---

## 🗣️ Core Feature 2: Hybrid NLP Processor

### Architecture Overview

The NLP Processor uses a **5-layer classification pipeline** that prioritizes speed while maintaining accuracy:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: BISLISH TYPO CORRECTION                                       │
│  - Pre-processes input using dialect map                                │
│  - "basora" → "basura", "lubang" → "lubak"                              │
│  - Levenshtein distance for fuzzy matching                              │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ Cleaned Text
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: DICTIONARY MATCHING (FAST PATH) ~1-5ms                        │
│  - Single token + N-gram matching                                       │
│  - Hierarchy mapping (specific → parent category)                       │
│  - Returns if confidence > 75%                                          │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ No match or low confidence
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: DATABASE KEYWORDS                                             │
│  - Dynamically loaded from nlp_keywords table                           │
│  - Supports HITL-trained entries                                        │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ No match
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: TensorFlow.js AI FALLBACK ~50-100ms                           │
│  - Universal Sentence Encoder embeddings                                │
│  - Cosine similarity against category anchors                           │
│  - GPU-accelerated with WebGL shaders                                   │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ Classification result
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
    // Water issues
    "walay tubig": "walang tubig",
    "way kuryente": "brownout",
    
    // Sanitation
    "basora": "basura",
    "mabao": "mabaho",
    
    // Infrastructure
    "lubang": "lubak",
    "butas sa daan": "pothole"
};
```

### Safety Multipliers (Ontology-Based Weighting)

To ensure safety hazards mathematically outrank aesthetic issues:

| Category | Multiplier | Rationale |
|----------|------------|-----------|
| Fire | 1.30 | Immediate life threat |
| Accident | 1.25 | Medical emergency |
| Crime | 1.20 | Public safety |
| Flooding | 1.15 | Displacement risk |
| Noise Complaint | 0.80 | Quality of life |
| Others | 0.70 | Lowest priority |

### Performance Optimizations

1. **Shader Warmup**: Pre-compiles WebGL shaders on page load to prevent first-click freeze
2. **Vectorized Classification**: GPU-accelerated `tf.matMul` instead of CPU loops
3. **Local Model Caching**: 100MB USE model cached in `storage/ai_cache/`
4. **Anchor Caching**: SHA-256 hash-based category embedding cache

**Files:**
- `public/brain-dashboard/nlp-processor.js` - Client-side NLP engine
- `src/server/services/AdvancedDecisionEngine.js` - Server-side with HITL
- `src/server/services/TensorFlowService.js` - Model management

---

## 🔗 Core Feature 3: Causality Manager

### Overview

The Causality Manager implements **physics-based disaster chain detection** to identify causal relationships between complaint clusters.

### Causal Matrix

Defines which categories can cause other categories (direction matters):

```javascript
const CAUSAL_MATRIX = {
    // FLOOD CHAIN
    "Flooding": ["Traffic", "Stranded", "Blackout", "Road Damage", 
                 "Accident", "Evacuation", "Health Hazard"],
    "Heavy Rain": ["Flooding", "Landslide", "Traffic"],
    "Clogged Drainage": ["Flooding", "Bad Odor"],
    
    // FIRE CHAIN
    "Fire": ["Smoke", "Panic", "Evacuation", "Traffic", "Power Outage"],
    
    // ACCIDENT CHAIN
    "Accident": ["Traffic", "Injury", "Fight"],
    
    // INFRASTRUCTURE CHAIN
    "Landslide": ["Road Obstruction", "Traffic", "Stranded", "Evacuation"],
    
    // IMPORTANT: Traffic CANNOT cause Flooding (physics constraint)
    "Traffic": ["Noise", "Air Pollution"],  // Limited downstream effects
};
```

### Validation Checks

For a causal link to be valid, it must pass **4 checks**:

1. **DIRECTION CHECK**: Does physics allow A to cause B?
   - ✅ Flood → Traffic
   - ❌ Traffic → Flood

2. **TEMPORAL CHECK**: Is cause earlier than effect?
   - Effect must occur within 24 hours of cause

3. **SPATIAL CHECK**: Within propagation distance?
   - Distances vary by category (Flood=500m, Fire=300m, Earthquake=1000m)

4. **STRENGTH SCORING**: How strong is the causal link?
   - Flood→Traffic: 0.85
   - Fire→Smoke: 0.95
   - Blackout→Crime: 0.65

**Files:**
- `public/brain-dashboard/causality-manager.js` - Core causal reasoning
- `public/brain-dashboard/simulation-engine.js` - Integration point

---

## 🔍 Core Feature 4: Duplication Detection

### Multi-Modal Similarity Scoring

The system detects duplicate complaints using three dimensions:

| Dimension | Algorithm | Weight |
|-----------|-----------|--------|
| **Text Similarity** | Levenshtein distance + Keyword overlap | 40% |
| **Location Similarity** | Haversine distance within radius | 35% |
| **Temporal Similarity** | Time window matching | 25% |

### Algorithm Details

```javascript
// Final duplication score
finalScore = (textScore * 0.4) + (locationScore * 0.35) + (temporalScore * 0.25);

// Thresholds
if (finalScore > 0.80) → "High Confidence Duplicate"
if (finalScore > 0.60) → "Probable Duplicate"
if (finalScore > 0.40) → "Similar Complaint"
```

**File:** `src/server/services/DuplicationDetectionService.js`

---

## 🎓 Core Feature 5: Human-in-the-Loop (HITL) Learning

### Overview

The AdvancedDecisionEngine implements supervised learning through human feedback:

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
- `src/server/services/AdvancedDecisionEngine.js`
- `public/brain-analytics/dictionary-manager.js`
- `public/brain-analytics/train-system.js`

---

## 📊 Core Feature 6: Statistical Analysis

### Integration

The system includes a Python-powered statistical analysis server for thesis-ready reporting:

```javascript
// Statistical Analysis Server
const STAT_CONFIG = {
    serverUrl: 'http://localhost:3456',
    timeout: 60000
};
```

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
| `COMPLAINT_SUBMITTED` | 📝 | Normal | Citizen confirmation |
| `COMPLAINT_STATUS_CHANGED` | 🔄 | Normal | Status updates |
| `COMPLAINT_UPDATE` | 💬 | Normal | Notes/comments added |
| `TASK_ASSIGNED` | 📋 | High | Officer assignment |
| `DEADLINE_APPROACHING` | ⏰ | High | 24h warning |
| `TASK_OVERDUE` | 🚨 | Critical | Missed deadline |
| `SYSTEM_ALERT` | ⚠️ | Critical | System-wide issues |

### Features

- **Deduplication**: Prevents notification spam
- **Priority Levels**: Normal → High → Critical
- **Bulk Notifications**: Efficient batch creation
- **Real-time**: Instant delivery via Supabase Realtime

**File:** `src/server/services/NotificationService.js` (786 lines)

---

## 🗄️ Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| **complaints** | Main complaint records with geospatial coordinates |
| **complaint_clusters** | DBSCAN clustering results |
| **complaint_similarity** | Duplication detection results |
| **categories** | Top-level complaint categories |
| **subcategories** | Specific complaint types |
| **departments** | Government departments |
| **nlp_keywords** | HITL-trained keyword mappings |
| **pending_reviews** | Low-confidence classifications queue |
| **notifications** | User notification inbox |
| **audit_logs** | System-wide action logging |

### Geospatial Schema

```sql
-- Complaints table with geospatial data
CREATE TABLE complaints (
  id UUID PRIMARY KEY,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  location_point GEOGRAPHY(POINT, 4326),
  description TEXT,
  category_id UUID REFERENCES categories(id),
  subcategory_id UUID REFERENCES subcategories(id),
  status VARCHAR(50) DEFAULT 'submitted',
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Geospatial constraint for Digos City bounds
  CONSTRAINT valid_coordinates CHECK (
    latitude BETWEEN 6.65 AND 7.20 AND
    longitude BETWEEN 125.25 AND 125.80
  )
);

-- Spatial index for performance
CREATE INDEX idx_complaints_location 
ON complaints USING GIST(location_point);
```

---

## 🔧 API Endpoints

### Intelligence & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/complaints/geospatial` | Get complaints with coordinates |
| GET | `/api/complaints/clusters` | Get DBSCAN cluster results |
| POST | `/api/nlp/classify` | Classify text using hybrid engine |
| GET | `/api/nlp/pending-reviews` | Get HITL pending queue |
| POST | `/api/nlp/train-keyword` | Train new keyword |
| GET | `/api/analytics/heatmap` | Get heatmap visualization data |

### Complaints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/complaints` | Submit new complaint |
| GET | `/api/complaints/my` | Get user's complaints |
| GET | `/api/complaints/:id` | Get complaint details |
| PATCH | `/api/complaints/:id/status` | Update status |
| POST | `/api/complaints/:id/reminder` | Send follow-up reminder |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get user notifications |
| GET | `/api/notifications/unread-count` | Get unread count |
| PATCH | `/api/notifications/:id/read` | Mark as read |
| PATCH | `/api/notifications/mark-all-read` | Mark all as read |

---

## 👥 User Roles & RBAC

| Role | Key Permissions |
|------|-----------------|
| **Citizen** | Submit complaints, track status, send reminders |
| **LGU Coordinator** | Review submissions, verify complaints, forward to departments |
| **LGU Officer** | Process assigned complaints, add updates |
| **LGU Admin** | Access heatmap, analytics, manage department |
| **Super Admin** | Full system access, HITL training, user management |

---

## 🛠️ NPM Scripts

```bash
# Development
npm run dev          # Start with auto-reload (nodemon)
npm run check        # Run comprehensive health checks

# Production
npm start            # Start production server

# Database
npm run migrate      # Run database migrations
npm run seed         # Seed with sample data

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Auto-fix linting issues

# Testing
npm test             # Run test suite
```

---

## 🛡️ Security Features

| Feature | Implementation |
|---------|----------------|
| **Input Validation** | Joi schemas for all API payloads |
| **GPS Bounds Validation** | Reject coordinates outside Digos City |
| **SQL Injection Protection** | Parameterized queries |
| **XSS Prevention** | Helmet CSP, output sanitization |
| **Rate Limiting** | Per-route request throttling |
| **RBAC** | Row Level Security policies |
| **Session Management** | Secure cookie handling |

---

## 📈 Performance Optimizations

### Client-Side
- **Shader Warmup**: Pre-compile WebGL on page load
- **Lazy Loading**: AI model loads asynchronously
- **GPU Acceleration**: `tf.matMul` for vectorized operations

### Server-Side
- **Model Caching**: 100MB USE model stored in `storage/ai_cache/`
- **Anchor Caching**: Hash-based category embedding cache
- **Connection Pooling**: Supabase connection management
- **Spatial Indexes**: GIST indexes for geospatial queries

---

## 👨‍💻 Development Team

> **Note**: For a chronological history of changes, see [IMPLEMENTATION_LOG.md](IMPLEMENTATION_LOG.md).

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

- **PostGIS Documentation** - Geospatial data types and functions
- **TensorFlow.js** - Client/Server-side ML inference
- **Leaflet.js** - Interactive maps library

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

**CitizenLink** - Intelligent Complaint Management with Geospatial Analytics & AI 🗺️🧠
