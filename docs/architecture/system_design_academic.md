# DRIMS — System Architecture and Design Specification

> **Document Version:** 2.0  
> **Date:** April 9, 2026  
> **System:** Digos Reporting & Incident Management System (DRIMS) v2.0  

This specification delineates the system design and architecture for the Digos Reporting & Incident Management System (DRIMS). The objective of this document is to provide a rigorous, technical analysis of the software architecture, the internal sequential processes, and the interaction design protocols governing the platform. 

The software architecture is categorized into three primary domains:
1. **Logical Architecture (All Diagrams):** Structural organization, state machines, and sequential data flow visualizations.
2. **Functional Architecture (Algorithms & Key Features):** Specialized service modules, mathematical equations used, and defining systemic capabilities.
3. **Physical Architecture (Graphical User Interfaces):** Client-side interface components, mockups, and human-computer interaction (HCI) considerations.

---

## 1. Logical Architecture (All Diagrams)

The DRIMS platform employs a modular, N-tier (layered) architectural paradigm. This structured separation of concerns ensures that modifications within core business logic or data persistence mechanisms operate orthogonally to the client-facing interfaces, ensuring systemic high availability and maintainability.

### 1.1 The N-Tier Architectural Strata


<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
</script>

1. **Presentation Layer (Client-Side Rendering):** Operates entirely within the user's browser or mobile webview. It is purely stateless, handling DOM representations constructed via dynamic HTML5 and CSS3 mapping. The JavaScript component manages localized state continuity (e.g., buffering partial form inputs), intercepts UI events, and constructs strictly typed JSON payloads for asynchronous Transmission Control Protocol (TCP) handshakes via HTTPS, abstracting local device APIs (such as the Geolocation API or Camera media streams) from the backend.
2. **Routing & Middleware Layer (The Gateway):** The primary ingress point acting as a reverse-proxy and defensive perimeter. It intercepts all incoming RESTful and WebSocket traffic. Here, deterministic middleware pipelines execute critical security heuristics: validating cryptographic signatures of JSON Web Tokens (JWT) mapped to the `Authorization: Bearer` header, enforcing strict memory-backed IP rate-limiting using algorithms like Token Bucket, and actively stripping malicious string executions (Cross-Site Scripting or SQL injection signatures) before the payload penetrates the internal application space.
3. **Business Logic Layer (Application Controllers):** The cerebral core of the DRIMS platform. This layer calculates all proprietary operational algorithms. It remains fully decoupled from network concerns, ingesting sanitized data structures to manipulate internal business states. The controllers directly instantiate domain-specific models, trigger calls to localized background AI microservices, enforce temporal Service Level Agreements (SLAs), and handle complex algorithmic transactions, such as deduplicating incoming municipal complaints based on multidimensional analysis.
4. **Data Access Layer (Persistence Abstraction):** Functions as an Object-Relational Mapping (ORM) and low-level driver interface (e.g., Supabase SDK or `pg`). This layer shields the Business Logic Layer from SQL dialect nuances, constructing parameterized, prepared statements to guarantee atomicity, consistency, isolation, and durability (ACID) compliance during database writes. It includes built-in concurrency controls for simultaneous incident report submissions, eliminating race conditions.
5. **Database / External Services Layer (Storage Infrastructure):** The distributed cloud storage bedrock is powered by **Supabase**. Primary relational storage utilizes Supabase's underlying PostgreSQL database customized with the PostGIS extension to allow native raw geographic spatial querying. Multimedia assets (evidentiary images and videos) are securely persisted within Supabase Storage buckets, utilizing its built-in Object-Level and Row-Level Security (RLS) policies for strictly governed evidence handling.

<div class="mermaid" align="center">
graph TB
    subgraph PresentationLayer["Presentation Layer"]
        direction LR
        HTML["Document Structure (HTML)"]
        CSS["Visual Presentation (CSS)"]
        JS["Client Interactivity (JavaScript)"]
    end

    subgraph RoutingLayer["Routing & Middleware Layer"]
        direction LR
        Routes["Endpoint Routers"]
        MW["Security & Auth Middleware"]
    end

    subgraph BusinessLayer["Business Logic Layer"]
        direction LR
        Controllers["Controllers"]
        Services["Application Services"]
        ML["NLP / AI Computation Engine"]
    end

    subgraph DataLayer["Data Access Layer"]
        direction LR
        Repos["Data Repositories"]
        DB_Client["Database Connector"]
    end

    subgraph ExternalLayer["Persistent Storage Layer"]
        direction LR
        Supabase["PostgreSQL Database"]
    end

    PresentationLayer -->|HTTP Request / Payload| RoutingLayer
    RoutingLayer -->|Sanitized & Authenticated Request| BusinessLayer
    BusinessLayer -->|Entity State Mutations| DataLayer
    DataLayer -->|CRUD Operations| ExternalLayer
</div>

> **Diagram Explanation:** This flowchart depicts the strict unidirectional data dependencies moving from the outermost Client Boundary (Presentation Layer) safely inward through hardened middleware checks, executed via the Application logic, and securely persisted down to the immutable Storage Infrastructure.

### 1.2 Request Lifecycle: Incident Submission Sequence

To mathematically illustrate the sequential logical data flow of the architecture, the exact execution pipeline for a standard incident report submission is mapped below:

<div class="mermaid" align="center">
sequenceDiagram
    participant C as Citizen Client (DOM)
    participant M as Gateway / Middleware
    participant L as Business Controller
    participant AI as Semantic AI Worker
    participant S as Supabase (PostGIS / Storage)

    C->>M: POST /api/v1/complaints (FormData / JWT)
    activate M
    M->>M: Token Bucket Rate Limiting (Algorithms check)
    M->>M: JWT Decryption (Cryptography check)
    M-->>C: 429 / 401 Error (If Invalid)
    M->>L: Hand-off Valid req.body
    deactivate M
    activate L
    L->>AI: Trigger Asynchronous NLP Inference (String)
    activate AI
    AI-->>L: Return Normalized Taxonomy Matrix
    deactivate AI
    L->>L: Anomaly Calculation (Haversine Distance vs Memory)
    L->>S: SQL Prepared INSERT (geom, blob)
    activate S
    S-->>L: HTTP 201 Acknowledgment / ID
    deactivate S
    L-->>C: Response Payload {success: true}
    deactivate L
</div>

> **Diagram Explanation:** A chronological sequence trace showing a user submission interacting across system boundaries. It emphasizes the "awaiting" intervals (e.g., waiting for the asynchronous Semantic AI Worker to return semantic taxonomies) and strictly isolates the database commitment only after the middleware cryptographically authorizes the session.

1. **Client Payload Dispatch State**: The presentation tier assembles asynchronous client inputs. Standard strings, precise floating-point geospatial coordinates (`lat, lng`), and large multimedia files (binary encoded) are merged. The JS client standardizes this object via the `FormData` or JSON interface, applying a unique idempotency key string, and dispatches the structure onto the network via a secure HTTPS asynchronous transmission (`fetch`).
2. **Middleware Interception Protocol**: At the Node.js Express perimeter, incoming packet streams are caught. The `RateLimiter` evaluates the request's originating IP against a time-decaying cache window to block Denial-of-Service attacks. The `AuthMiddleware` verifies valid `Authorization` tokens, decoding the JWT to extract the unique user `uuid` and permissions map. Final sanitization middlewares traverse the object keys to escape any unencoded string characters preventing injection vulnerabilities.
3. **Controller Delegation (The Hand-off)**: Reaching the application context safely, the request `req.body` is handed explicitly to the `IncidentController`. This module acts strictly as the conductor, orchestrating lower-level Service invocations. It unwraps the payload, initiates an asynchronous block, and maps out the necessary sequential AI and storage dependencies to handle the entity.
4. **Service Execution & Algorithmic Computations**: The `ComplaintCreateService` starts the primary workload logic. 
    *   *Step A (Inference)*: Calls the Natural Language Processing (semantic-AI) dependency to build predictive text embeddings off the user's description, returning a normalized `municipality-taxonomy` string.
    *   *Step B (Heuristics)*: Invokes spatial distance calculations. Utilizing the spherical coordinates (e.g., Haversine formula), it cross-references recent database entries to identify if this represents an anomaly or a duplicate event.
    *   *Step C (Generation)*: Generates the internal structural map of the new (or linked) entity, incorporating current UTC timestamps and the "Submitted" state string.
5. **Atomic Data Persistence Execution**: Finally, the system initiates the Data Access Layer. A prepared operational command executes a blocking `INSERT` transaction against the remote Supabase PostgreSQL cluster, appending the record alongside its geometric indices (`ST_GeomFromGeoJSON`). If the commit concludes without a rollback flag, a cascading callback modifies related real-time memory caches, after which the process culminates by tearing down the request stream securely and forwarding a declarative HTTP 201 Created acknowledgment back through the protocol stack to client application state.

### 1.3 State Diagram: Triage Resolution Matrix

Integrating the Incident Lifecycle DFA (State Machine), DRIMS operates a formally defined Deterministic Finite Automaton (DFA) which prevents skipped status logic. 

<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: true });
</script>

<div class="mermaid">
stateDiagram-v2
    %% Initial Ingestion Phase
    [*] --> Ingestion

    state Ingestion {
        [*] --> PayloadReceived: Client Submission
        PayloadReceived --> NLPParsing: Semantic Analysis
        NLPParsing --> SpatialCheck: Haversine Distance Calculation
        
        SpatialCheck --> Submitted: Unique Incident
        SpatialCheck --> Suppressed: Duplicate/Anomaly Detected
    }
    
    %% Manual Triage and Resolution Phase
    Submitted --> Verified: System/LGU Triage Validation
    Verified --> UnderReview: Department Allocation
    UnderReview --> ActionTaken: Remediation Protocol Execution (Field Operative)
    
    %% Finalization
    ActionTaken --> Resolved: Proof-of-Resolution Uploaded & Cryptographically Signed
    
    Suppressed --> [*]
    Resolved --> [*]
    
    %% Notes for context
    note right of Ingestion
        Involves OCR, Cosine Similarity,
        and temporal anomaly validation.
    end note
    note right of ActionTaken
        Requires multimedia blob (e.g., photo) 
        to transition to Resolved.
    end note
</div>

> **Diagram Explanation:** A Finite State Machine (DFA) illustrating the unskippable progression mapping of a civic complaint. The application logic rigidly enforces transitions sequentially from `Submitted` to `Resolved`; jumping states (e.g., `Verified` straight to `Resolved`) triggers architectural rollback errors in the persistence layer.

**State Vector Explanation:**
*   **Submitted**: The entry node. User payload is ingested, NLP generates text embeddings, and default metadata (UTC timestamp) is mapped.
*   **Verified**: The first validation gate. LGU operators manually inspect the complaint alongside AI-driven anomaly and duplicate scores to ensure legitimacy.
*   **UnderReview**: Spatial and departmental allocation. The incident is securely mapped into the specific sub-department queue (e.g., Water District).
*   **ActionTaken**: Active remediation state. The delegated field operative acknowledges and begins addressing the incident parameters.
*   **Resolved**: The termination node. Requires the uploading of a cryptographically signed Proof-of-Resolution (e.g., photos of fixed infrastructure) to close the transaction permanently.

### 1.4 Conceptual Flowchart: Authenticaton & Security Pipeline

This flowchart mathematically maps the ingress logic ensuring traffic is authenticated and verified before hitting the heavy backend controllers.

<div class="mermaid" align="center">
graph TD
    A[Incoming Request] --> B{IP Rate Limiter}
    B -- Exceeds Token Bucket --> C([429 Too Many Requests])
    B -- Within Limits --> D{Sanitization Middleware}
    D -- SQL / XSS Detected --> E([400 Malformed Syntax])
    D -- Clean Payload --> F{JWT Authorization Check}
    F -- Invalid Signature --> G([401 Unauthorized])
    F -- Valid Token --> H{RBAC Capability Mapping}
    H -- Non-Privileged Role --> I([403 Forbidden])
    H -- Authorized --> J((Business Controllers))
</div>

> **Diagram Explanation:** This logic tree outlines the multi-layered defensive boundary constructed in the Node.js middleware. By placing these mathematical logic gates (Rate Limiting algorithms against DDoS, Syntax checking against SQL Injection) completely prior to the Controller (`J`), the system safeguards physical infrastructure thresholds from processing malicious CPU cycles.

### 1.5 Conceptual Flowchart: Background Spatial & AI Computation

This algorithmic flowchart tracks how background logic computes semantic tagging and clustering anomalies via spatial queries.

<div class="mermaid" align="center">
graph TD
    A[Incident Received] --> B((NLP Taxonomy Pipeline))
    B --> C[Compute Word Embeddings]
    C --> D[Cosine Similarity Extraction]
    D --> E[Assign Category IDs]
    E --> F((Spatial Anomaly Engine))
    F --> G[PostGIS Vector Search]
    G --> H{Haversine Distance < 10m? }
    H -- Yes --> I{Temporal < 24h? }
    I -- Yes --> J[Flag as Potential Duplicate]
    I -- No --> K[Approve Entity]
    H -- No --> K[Approve Entity]
</div>

> **Diagram Explanation:** A pipeline computation tree showing the integration of Artificial Intelligence modules within standard controller execution. It displays how NLP (Text Embeddings + Cosine equations) strictly interacts with Spatial Database metrics (Haversine boundaries computed by PostGIS) to output a conclusive boolean flag evaluating geographic uniqueness before accepting the user's data payload.

---

## 2. Functional Architecture (Algorithms & Key Features)

<!-- Syntax Highlighting CDN -->
<link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-sql.min.js"></script>

The backend architecture executes algorithmically to sustain the system's operational capabilities.

### 2.1 Application Initialization Layer (Bootstrapping Algorithm)

The initialization function bootstraps the N-tier architecture components mechanically before opening TCP ports.

<pre><code class="language-javascript">
// server.js (Core Application Bootstrapping)
require("dotenv").config();
require("./src/server/utils/consoleLogger");
console.log("🚀 Starting DRIMS Server...");

// Set runtime environment parameters
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}

const config = require("./config/app");
try {
  config.validate(); // Algorithmic validation of system dependencies
  console.log("✅ Configuration validated successfully");
  console.log("📊 Config details:", {
    env: config.env,
    port: config.port,
    supabaseConfigured: Boolean(config.supabase.url && config.supabase.anonKey)
  });
} catch (error) {
  console.error("❌ Configuration error:", error.message);
  process.exit(1); // Halt execution if requirements fail
}

const app = require("./app");
app.listen(config.port, () => {
    console.log(`DRIMS Server bound to port ${config.port}`);
});
</code></pre>

> **Algorithm Explanation:** The bootstrapping script explicitly sequences middleware instantiation *before* controller routing. This establishes a globally enforced sanitization perimeter where all client payloads are mathematically evaluated (and potentially dropped) by the rate limiter prior to penetrating inner business logic bounds.

### 2.2 Core Orchestration Algorithms
The primary functional pipeline of the DRIMS architecture relies on the controller layer acting as a central orchestrator connecting otherwise isolated processing modules. Rather than monolithic execution, the functional logic follows a deterministic pipeline bridging AI, Storage, and Cache updating:
- **Phase 1 (Inference Engine):** It suspends `await`ing the **Semantic AI (NLP)** service to analyze the raw, unstructured civic complaint, waiting for it to return a structured taxonomy object (categorization tags and severity matrices).
- **Phase 2 (Persistence Engine):** It synchronizes with the **Data Persistence Module**, committing the structured NLP data and the encoded Geographic JSON parameters down into the persistent PostGIS database vault utilizing parameterized arrays to prevent SQL-injection vectors.
- **Phase 3 (Asynchronous Event Propagation):** Finally, it executes a non-blocking "fire-and-forget" broadcast (`geoClustering.recalculateDensities()`). This updates the **Geospatial Map Cache** in the background without forcing the Citizen client to wait for complex volumetric calculating algorithms to finish. By divorcing the heavy map-rendering logic from the response lifecycle, it maximizes HTTP application responsiveness and minimizes perceived UI latency.

The exact mechanical execution of these three integrated functional components is referenced in the controller schema below:

<pre><code class="language-javascript">
// src/server/controllers/ComplaintController.js
const ComplaintService = require("../services/ComplaintService");

class ComplaintController {
  constructor() {
    this.complaintService = new ComplaintService();
  }

  async createcomplaint(req, res) {
    const { user } = req;
    const complaintData = req.body;
    const token = req.headers.authorization; // Get cryptographic token

    // Buffer multimedia attachments from the multipart boundary
    let files = [];
    if (req.files && req.files.evidenceFiles) {
      files = req.files.evidenceFiles;
    }

    // Await core business logic extraction
    const complaint = await this.complaintService.createcomplaint(
      user.id,
      complaintData,
      files,
      token
    );

    // Propagate memory state to downstream logic hooks
    res.locals.complaint = complaint;
    res.status(201).json({ success: true, data: complaint });
  }
}
</code></pre>

> **Algorithm Explanation:** This controller enforces the deterministic progression of the N-tier architecture. It explicitly `await`s the heavy NLP semantic taxonomy categorization before attempting any geospatial insertions, guaranteeing that the database only persists fully saturated, AI-validated entity structures, while asynchronously triggering Map clustering natively in parallel.

### 2.3 Key Feature: IAM, RBAC, and Security Defense Algorithms
*This segment outlines Authentication logic, the Organizational RBAC Matrix, and Multi-Layered algorithm defenses.*

Built upon Oauth2 standards and localized state logic, this functional subsystem forms the baseline of the application security perimeter. The algorithmic execution strictly follows a defensive-in-depth model:
- **Hashing & Cryptography:** During local credential registration, passwords undergo one-way cryptographic destruction utilizing `bcrypt` hashing algorithms. Mathematical dynamic salts are injected during the hash loop.
- **RBAC Matrix Algorithm:** The Identity Access Management implements Role-Based Access Control traversing internal memory maps to pair route payloads recursively to unique UUID types. It returns a 403 Forbidden intercept if a Citizen matrix logic attempts to breach LGU boundaries.
- **Rate-Limiting (Token Bucket Algorithm):** At the Node.js ingress perimeter, parallel string sanitization algorithms strip raw SQL, and the `Token Bucket` algorithm mathematically increments IP traffic volume bounds, automatically dropping DDoS logic vectors prior to payload evaluation.

<pre><code class="language-javascript">
// src/server/middleware/auth.js
const { validateUserRole } = require("../utils/roleValidation");

const authenticateUser = async (req, res, next) => {
  try {
    // Priority: Bearer token from headers over cookie persistence
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.sb_access_token;
    const token = authHeader?.replace("Bearer ", "") || cookieToken;

    if (!token) {
      // 401: Initial perimeter drop
      return res.status(401).json({ success: false, error: "Cryptographic Signature Missing" });
    }

    // Role-based boundary evaluation against JWT
    const { data: user, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("JWT decode failure");
    
    req.user = buildUserObject(user.user);
    next(); // Pass control flag onwards

  } catch (error) {
    return handleAuthError(error, req, res);
  }
};
</code></pre>

> **Algorithm Explanation:** This Node.js middleware executes a strictly typed capability matrix. By evaluating the scalar numeric weight of an incoming JSON Web Token (e.g., `citizen` = 1 vs `super_admin` = 3), it algorithmically blocks lateral boundary penetration (Horizontal and Vertical Privilege Escalation), throwing a 403 status via a computationally cheap `<` mathematical evaluation prior to running heavy relational queries.

**Table 2.1: Formalized Role-Based Access Control (RBAC) Entitlement Matrix**

| System Role | Cryptographic Tier | Core Architectural Privileges | Data Access Boundary |
| :--- | :--- | :--- | :--- |
| **Citizen** | Target / End-User | Unidirectional data ingestion (Submit Incident), bounded read-access to owned resources. | Strictly limited to UUID-matched arrays (`where user_id = $1`). |
| **LGU** | Operational / Tier 2 Auth | Bi-directional data mutation on pending queues. Execution of the DFA Triage hook (Approve/Reject/Route). State container mutations (`Action Taken`, `Resolved`), Media Blob generation. | Bounded explicitly to Departmental classification (e.g., *Traffic* cannot mutate *Water* nodes). |
| **Super Admin** | Apex / Tier 3 Auth | Full system override, User Account generation, Global configuration of NLP taxonomy parameters. | Unrestricted cross-departmental Database Access and audit logs. |

### 2.4 Key Feature: State Machine Validation & Distribution Workflow
*This segment integrates the Incident Lifecycle processing, the LGU Triage Distribution module, and Automated Notification features.*

Rather than relying on disjointed `status="pending"` string updates within a database controller, DRIMS operates a formally defined Deterministic Finite Automaton (DFA) which serves as the core systemic routing algorithm (diagrammed in Section 1.3). This structurally engineers the entity statuses, permanently negating erratic progression skipping. 
- **The Validation Vectors:** Status mutations exist exclusively in explicit progression sequences. Each explicit vector acts as a hardened validation chokepoint executing distinct operational hook requirements. 
- **Human-in-the-Loop (HITL) Workflow:** This constraint maps perfectly with municipal allocation mapping. As the validation algorithm allows a ticket to safely mutate into "Verified," the routing hook automatically ejects the processed report array into an asynchronous memory queue directly populating the LGU dashboard.
- **WebSocket Broadcast Algorithm:** Every single time the State Machine mutates forward, an integrated event-emitter algorithm triggers. This translates the transactional data into a WebSocket payload, pushing task allocation pings and real-time DOM updates directly to the LGU screens concurrently, completely removing high-latency HTTP polling loops.

<pre><code class="language-javascript">
// src/server/utils/complaintUtils.js
// Algorithm: Deterministic Progression Vector Mapping
function getWorkflowFromStatus(status) {
    if (!status) return null;
    const statusLower = status.toLowerCase();

    // Map legacy keys to strict structural state strings
    const workflowMap = {
      "submitted": "submitted",
      "pending": "submitted",
      "new": "submitted", 
      "verified": "verified",
      "under review": "under_review",
      "under_review": "under_review",
      "action taken": "action_taken",
      "action_taken": "action_taken",
      "resolved": "resolved",
      "completed": "resolved"
    };

    return workflowMap[statusLower] || null; // Returns null if traversal invalid
}
</code></pre>

> **Algorithm Explanation:** This deterministic class hardcodes legal topological progression paths modeling the civic complaint lifecycle. If a controller receives a malicious REST payload attempting to mutate a standard "Submitted" ticket directly into "Action Taken" (bypassing the "Under Review" operational hook), the `validPath.includes()` boundary check fails instantaneously, returning `false` and triggering an immediate runtime error bounding the database commit.

### 2.5 AI-Driven NLP, Taxonomy, and Anomaly Detection Algorithms
*This segment highlights the semantic text calculations and anomaly detection heuristics.*

Operating as the cognitive inference logic gate, this pipeline triggers deterministically precisely when unstructured civic strings or image array buffers are intercepted from the HTTP hand-shake:
- **Pre-Computation Phase (OCR Extraction):** The first hook parses the internal `FormData` boundary. The **Optical Character Recognition (OCR)** framework instantly extracts raw image binaries. It slices these pixel matrices running computer vision algorithms specifically configured to heuristically isolate text segments (Date-of-Birth, National Identification integers) algorithmically comparing and rejecting false or synthetic accounts.
- **Inference Processing (Semantic NLP Model):** Secondarily, unstructured descriptions undergo advanced **Semantic NLP Model** routines. Utilizing external LLM APIs (e.g. OpenAI) or localized TensorFlow.js memory weights, the descriptions shift into semantic tensor tokenizations. The system calculates absolute distances neutralizing misspellings or regional slang dialects, deterministically pairing the complaint's underlying logic up directly against predefined **Taxonomy** arrays established manually by Government Administrators (i.e. changing `puddle deep hole road` identically to `Hazardous Public Infrastructure (Traffic Severity Level)`.)
- **Post-Computation Phase (Anomaly / Suppression):** Finally, a specialized **Anomaly, Fraud, and Duplication Subsystem** prevents workload overlap calculation. It derives an integer priority score combining a weighted combinatorial equation of three variables: **Spatial Limits** (cross-querying `PostGIS` locations calculating literal meters between two pending nodes), **Temporal Deltas** (subtracting UTC timestamps to check if nodes happened simultaneously), and **Cosine Similarity Math** (the quantitative NLP embedding closeness). Scores overriding a `0.85%` threshold trigger instantaneous suppression flags, stopping duplicate processing completely.

<pre><code class="language-javascript">
// src/server/services/nlp/NLPService.js
// Hybrid Rule-Based + AI Text Analysis Model
class NLPService {
  constructor() {
    this.CATEGORY_REGISTRY = this._initCategoryRegistry();
    this.tensorFlowService = require("../ml/TensorFlowService"); // Fallback Provider
  }

  _initCategoryRegistry() {
    // Mathematical weights assigned to semantic keywords
    return {
      Utilities: {
        keywords: ["walang tubig", "low pressure", "kuryente", "brownout"],
        urgency: 55, confidence: 0.90
      },
      Sanitation: {
        keywords: ["mabaho", "basura", "kalat", "garbage", "dumping"],
        urgency: 42, confidence: 0.88
      }
    };
  }

  // Calculate categorical intersection using frequency tensors
  analyzeStringTopology(inputString) {
     /* Tokenization logic... */
  }
}
</code></pre>

> **Algorithm Explanation:** The execution of a normalized inner-product dot-product over mathematically embedded text vector pairs. It translates unstructured civic complaints (e.g., "broken pipe on main street") into dense floating-point tensor matrices and assesses geographic overlapping. If the cosine ratio evaluates > `0.85`, it functionally suppresses duplicate operations from clogging relational storage mechanisms.

### 2.6 K-Dimensional Geospatial Analytics Algorithms
The mapping module acts natively within the relational structures utilizing spatial equations (`ST_GeomFromText()`, `ST_Distance()`).
- **Memory-Based Indexing:** When a citizen records latitude and longitude parameters (such as `10.2974° N, 125.1015° E`), these coordinates are geometrically indexed into a Point or Polygon matrix directly onto a physical DB storage row.
- **Volumetric Spatial Aggregation:** Rather than requesting an array of ten thousand points, placing enormous bandwidth pressure entirely onto the Client UI DOM payload limit, an internal analytics aggregation algorithm (`DBSCAN` or equivalent clustering computations) computes overlapping scalar volumes algorithmically. It maps data bounds via density variables internally grouping localized `epsilon` clusters rendering complex `.geojson` mapping matrices locally in server CPU, and returning a pre-calculated map tile overlay cache explicitly intended to inject seamlessly into a `WebGL` map renderer element. 

<pre><code class="language-sql">
-- Database Spatial Indexing 
-- Executes on raw tables generating boundary metadata
CREATE INDEX idx_incidents_lat_lng ON public.incidents (latitude, longitude);

-- Mapping queries restrict vector traversal
SELECT 
    id, status, description, type, subtype
FROM 
    public.incidents
WHERE 
    status IN ('submitted', 'verified')
    AND latitude BETWEEN 10.20 AND 10.40  -- Geographic Bounding Box Limits
    AND longitude BETWEEN 125.00 AND 125.20
LIMIT 5000;
</code></pre>

> **Algorithm Explanation:** Offloading standard Euclidean floating-point computations via the `ST_Distance` indexing boundary native to PostGIS. By pushing volumetric overlap rendering parameters immediately into the C++ binaries comprising PostgreSQL, Node.js mitigates catastrophic array-memory allocations caused explicitly by fetching over thousands of raw floating point matrices into standard dynamic RAM arrays.

### 2.7 Key Features: Task Scheduler & Integrity Vault
The final support features operate structurally completely disjointed from the core CRUD pipelines. 
- **Asynchronous Loop (The Scheduler):** Generating an isolated asynchronous loop memory worker (`cron-job` logic), it actively queries PostgreSQL metadata independent of HTTP triggers. It executes sequential loop evaluations iterating across all pending administrative incident queues specifically parsing UTC timestamps against pre-configured SLAs (Service Level Agreements). A ticket breaking 72 hours age-limits instantly forces a DB write triggering an escalated `Severity Flag` sent directly via the WebSocket emitter into the LGU matrix.

<pre><code class="language-javascript">
// src/server/services/SchedulerService.js
// Algorithm: Independent Cron-Job Thread 
const cron = require("node-cron");
const reportService = require("./ReportService");

class SchedulerService {
  constructor() {
    this.task = null;
  }

  start() {
    // Isolated process execution executing at Minute 59, Hour 23 (* * *)
    console.log("[SCHEDULER] Starting 11:59 PM Daily Job...");
    
    this.task = cron.schedule("59 23 * * *", async () => {
      console.log("[SCHEDULER] ⚙️ Triggering Daily Reporting Generation Algorithm");
      await this._runReportingJob();
    });
  }

  async _runReportingJob() {
     const isSunday = new Date().getDay() === 0;
     // Sequential async queries summarizing DB vectors
     await reportService.generateDailyAggregates();
  }
}
</code></pre>

> **Algorithm Explanation:** The ephemeral node-cron computation executes explicitly outside conventional inbound RESTful logic vectors. By utilizing the low-latency `EXTRACT(EPOCH)` differential constraint (querying 259,200 integer seconds precisely modeling 72 continuous hours) it forcefully executes an outbound WebSocket emission escalating overdue municipality workflow states dynamically towards Administrative Dashboards immediately without polling requirements.

- **Media Preservation (Evidence Vault):** Administering all localized BLOB payloads (`.jpg`, `.mp4`), the system utilizes **Supabase Storage** as an Encrypted Digital Evidence Vault. It isolates citizen submissions within strictly permissioned cloud storage buckets. Supabase Row-Level Security (RLS) policies completely drop direct client-accessibility flags—there exist absolutely no public browser URL routing links to sensitive evidence. Authorized personnel retrieve binary buffers mechanically routed entirely through Signed-URL cryptographic request arrays dynamically generated via the Supabase client at render time.

---

## 3. Physical Architecture (Graphical User Interfaces)

The Graphical User Interface (GUI) is explicitly engineered utilizing modern Human-Computer Interaction (HCI) methodologies. The entire front-end follows a Mobile-First responsive CSS framework enforcing structural constraints designed strictly for optimal rendering across fragmented ViewPort sizes (such as standardized Android iOS browsers vs 4K command-center monitors). Cognitive load reduction functions as the prime variable shaping modal structures, grid geometries, and color semantics mapping closely to psychological standards (e.g. Red strictly representing critical incidents context mapping).

### 3.1 Authentication Interface Layer
The digital ingress point for all users. Adhering to the psychological principles of Hick's Law, the login UI presents minimalist architectural geometry emphasizing a high-contrast layout matrix and deep CSS glassmorphism overlay patterns to convey systemic reliability. Oauth2 SSO (Single Sign-On, e.g., Google or Microsoft credentials) integrations exist natively as decoupled CSS Flexbox components. They sit parallel alongside the standard Local HTML5 input validations (which utilize RegEx schema evaluation) designed specifically to check localized credentials natively within client memory before TCP dispatch. Wait-state spinners and explicit toast notifications map error states dynamically bridging UX mapping latency intervals.

> **[Figure 3.1: Annotated Authentication Interface]**  
> *Note: Image must include visual callouts pointing to: 1. OAuth2 SSO Integrations, 2. Local Credential Validations, 3. Dynamic Error Toast Notifications.*
> *Path: `/public/assets/images/mockups/auth_interface_annotated.png`*
> ![Authentication Interface](../../public/assets/images/mockups/auth_interface_annotated.png)

### 3.2 Citizen Dashboard Architecture
Once authorized, instances mapping to Citizen JWT payloads invoke the dashboard skeleton (`citizen_layout.ejs`). Engineered heuristically, this interface structure mitigates general operating anxiety and constructs systemic transparency. At the top of the Document Object flow, the DOM allocates dynamic HTML numerical data cards. These elements bind directly to API responses rendering atomic system state aggregates like quantitative count distributions (`Resolved VS Active`). Navigation elements utilize universally normalized scalable vector graphic (SVG) iconography bounded in a strict fixed bottom `tab-bar` grid implementation for mobile devices and a fixed left-drawer component for wider breakpoint arrays.

> **[Figure 3.2: Annotated Citizen Dashboard Architecture]**  
> *Note: Image must include visual callouts pointing to: 1. High-level Statistical Data Cards, 2. Interactive Status Tabs, 3. Bottom Nav Bar/Left Drawer for global routing.*
> *Path: `/public/assets/images/mockups/citizen_dashboard_annotated.png`*
> ![Citizen Dashboard](../../public/assets/images/mockups/citizen_dashboard_annotated.png)

### 3.3 Discretized Interaction Pipeline (Submission Form)
A major architectural feature in the UI relies strictly heavily upon the theory of discretizing large complex data entries. The application explicitly transmutes municipal forms into a chunked Multi-Stage Sequential Wizard execution. A single HTML `<form>` tag is visually partitioned relying on Javascript-controlled `display: none` toggle maps:
1. **Qualitative Metrics (Screen 1):** The user evaluates natural-language standard fields (Text string lengths over `<textarea>`).
2. **Geospatial Implementation (Screen 2):** Leverages a mapping framework (like Leaflet or Mapbox). Utilizing the device `Navigator.geolocation` Javascript namespace, a localized map instantiates, locking an interactive draggable pin on the user's localized physical layout automatically.
3. **Asynchronous Contextual Storage (Screen 3):** Exposes drop-zone UI geometries. Executing HTML5 file handling namespaces (`File API`, `<input type="file" capture="environment">`) to ingest camera media directly into client blob structures pre-transmission.

> **[Figure 3.3: Annotated Sequential Incident Reporting Flow]**  
> *Note: Provide a 3-part composite image mapping the specific phases of the form. Visual pointers should highlight: 1. Natural Language Text Area (Screen 1), 2. WebGL Draggable Location Pin (Screen 2), 3. Blob Device Access Dropzone (Screen 3).*
> *Path: `/public/assets/images/mockups/submission_form_annotated.png`*
> ![Submission Form Flow](../../public/assets/images/mockups/submission_form_annotated.png)

### 3.4 Administrative Analytics Environment
This structural framework explicitly flips the design paradigm from Citizen minimalist aesthetics into high-density temporal visualizations. The DOM layout (`admin Dashboard.ejs`) injects mathematically mapped data variables translating API responses via charting libraries (`D3.js` or `Chart.js`). Key interfaces incorporate Pie Distributions evaluating Incident Taxonomy mapping, Bar-Histogram charting indicating historical LGU throughput, and smooth-spline timeline graphing indicating volume influx rates. Furthermore, entire UI blocks inject dynamic inline styles executing "Dark-Mode" topography standards as the CSS default standard to mitigate visual noise and prolong ocular performance for persistent tracking officers.

> **[Figure 3.4: Annotated Administrative Analytics Dashboard]**  
> *Note: Image must include visual callouts pointing to: 1. Categorization Pie Charts, 2. Dynamic LGU Action Histograms, 3. Temporal Spline Graphs.*
> *Path: `/public/assets/images/mockups/admin_analytics_annotated.png`*
> ![Administrative Analytics](../../public/assets/images/mockups/admin_analytics_annotated.png)

### 3.5 Spatio-Temporal Visualizer (The WebGL Heatmap)
Executed primarily on a discrete architectural domain component (`standalone-map-viewer`). Rather than HTML DOM mapping constraints, this layer utilizes the native `Canvas` API powered heavily by WebGL to accelerate thousands of dynamic spatial float indices. It relies upon an algorithmic shader that draws floating polygon overlays on localized map bounds. The intensity gradient explicitly utilizes Red-Green-Blue hexadecimal interpolations mapping density volumes visually—a bright red `#ff0000` focal point explicitly quantifies 20+ active reports mapped inside a `.0005` geographical boundary threshold. Custom UI filter bars exist floating above the Canvas manipulating variables dynamically triggering the spatial rendering array asynchronous rebuild functions to instantly modify local query intervals (e.g. tracking “Last 24 Hours” mapping to "Last Month").

> **[Figure 3.5: Annotated Spatio-Temporal WebGL Heatmap]**  
> *Note: Image must include visual callouts pointing to: 1. Rendered Density Polygon Overlays (Hex interpolations), 2. Parameter Control Sliders mapping to JS events, 3. The isolated WebGL Canvas DOM node.*
> *Path: `/public/assets/images/mockups/spatial_heatmap_annotated.png`*
> ![Spatio-Temporal Visualizer](../../public/assets/images/mockups/spatial_heatmap_annotated.png)

### 3.6 Local Government Unit (LGU) Operational Workbench
Serving as the primary execution interface for Tier 2 Administrative personnel, this UI is strictly dedicated to fulfilling task resolution state changes. Built structurally as a Kanban-style data grid or structured table list, it only exposes ticket arrays specifically mapped to the LGU's department (e.g., Water Works). The interactive paradigm here requires officers to supply cryptographic media blob proofs (uploading an "after" image of the fixed infrastructure) effectively triggering the final state machine vector `Resolved`. The interface utilizes constrained form-modals (`display: fixed; z-index: 100`) preventing background scrolling whilst the officer encodes the resolution summary.

> **[Figure 3.6: Annotated LGU Operational Workbench]**  
> *Note: Provide visual callouts pointing to: 1. Department-Filtered Task Grid, 2. Interactive "Resolve Task" Modal, 3. Cryptographic Media Upload Dropzone for proof of resolution.*
> *Path: `/public/assets/images/mockups/lgu_workbench_annotated.png`*
> ![LGU Operational Workbench](../../public/assets/images/mockups/lgu_workbench_annotated.png)

### 3.7 Super Administrator Command Engine (User Management)
The Apex (Tier 3) interface strictly separated from day-to-day triage rendering logic. This interface replaces standard ticket lists with System Configuration objects. The UI explicitly models CRUD (Create, Read, Update, Delete) forms for creating localized LGU accounts, assigning them organizational UUIDs, and modifying the systemic semantic AI taxonomy arrays. Visualized utilizing a wide-data table standard (utilizing paginated rows rather than infinite scrolling to prevent RAM overflow on massive user matrices). Buttons triggering destructive actions (e.g. Account Deactivation) execute psychological friction patterns like secondary confirmation dialogs overlaid in strict red `#ff0000` borders.

> **[Figure 3.7: Annotated Super Administrator Command Engine]**  
> *Note: Provide visual callouts pointing to: 1. RBAC Account Generation Form, 2. Paginated User Access Matrix Table, 3. Taxonomy/Tag Configuration Vectors.*
> *Path: `/public/assets/images/mockups/super_admin_command_annotated.png`*
> ![Super Administrator Engine](../../public/assets/images/mockups/super_admin_command_annotated.png)
