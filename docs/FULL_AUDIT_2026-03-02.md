# DRIMS 2.0 — Full Codebase Audit Report

**Date:** 2026-03-02  
**Version:** 2.0.0  
**Auditor:** GitHub Copilot (Claude Opus 4.6)

---

## Executive Summary

| Area | Critical | High | Medium | Low | Total |
|------|----------|------|--------|-----|-------|
| **Security** | 5 | 10 | 10 | 7 | 32 |
| **Backend** | 2 | 3 | 5 | 4 | 14 |
| **UI / Client** | 0 | 9 | 6 | 5 | 20 |
| **Feature Correctness** | 2 | 3 | 5 | 4 | 14 |
| **Grand Total** | **9** | **25** | **26** | **20** | **80** |

### Test Results & Lint Metrics

| Metric | Value |
|--------|-------|
| Test suites | 25 passed / 25 total |
| Tests | 206 passed, 1 skipped / 207 total |
| ESLint errors | 0 |
| ESLint warnings | 227 |
| Core features untested | NLP, DBSCAN, workflow transitions, duplicate detection, uploads, OCR, scheduling |

---

## Table of Contents

1. [Security Analysis](#1-security-analysis)
2. [Backend Analysis](#2-backend-analysis)
3. [UI / Client-Side Analysis](#3-ui--client-side-analysis)
4. [Feature Correctness Analysis](#4-feature-correctness-analysis)
5. [Recommendations by Priority](#5-recommendations-by-priority)

---

## 1. Security Analysis

### CRITICAL

#### SEC-01: Unauthenticated File Upload via OCR Endpoints
- **File:** `src/server/routes/ocrRoutes.js` (lines 10-25)
- **Detail:** `POST /api/identity/ocr` and `POST /api/identity/ocr/verify-residency` have **no `authenticateUser` middleware** and **no file type filtering** on the multer config. Any anonymous user can upload arbitrary files to the server's `uploads/ocr/` directory.
- **Impact:** Disk exhaustion, potential arbitrary file upload leading to code execution.
- **Fix:** Add `authenticateUser` middleware and a multer `fileFilter` restricting to image types.

#### SEC-02: Unauthenticated Rate-Limit Reset
- **File:** `src/server/routes/rateLimitRoutes.js` (lines 46-63)
- **Detail:** `POST /api/rate-limit/reset` has **no authentication or authorization**. Anyone can reset all rate-limit counters, enabling brute-force attacks.
- **Fix:** Add `authenticateUser` + `requireRole(["super-admin"])`, or remove the endpoint.

#### SEC-03: `node_modules` Served as Static Files
- **File:** `src/server/config/middleware.js` (line ~122)
- **Detail:** `app.use("/node_modules", express.static(...))` exposes the entire dependency tree over HTTP. Attackers can fingerprint exact versions of all packages and read source code.
- **Fix:** Remove this static mount. Bundle required client-side libraries instead.

#### SEC-04: All Database Queries Bypass RLS (Service Role Key)
- **File:** `src/server/config/database.js` (lines 55-62)
- **Detail:** The singleton `Database` client uses the **Supabase service role key**, which bypasses all Row Level Security policies. Every query from every route runs with full admin privileges. The elaborate RLS migrations provide no protection at the application layer.
- **Fix:** Use the anon key + user JWT for per-request Supabase calls; reserve service role for admin-only operations.

#### SEC-05: Debug Authentication Cookie Accepted in Production
- **File:** `src/server/middleware/auth.js` (line 25)
- **Detail:** `req.cookies?.sb_access_token_debug` is accepted as a valid auth token with no environment check. A debug cookie in production is a backdoor.
- **Fix:** Remove the `sb_access_token_debug` fallback entirely.

### HIGH

#### SEC-06: Unvalidated Session Token Storage
- **File:** `src/server/routes/sessionRoutes.js` (lines 10-21)
- **Detail:** `POST /auth/session` accepts any string as `access_token` and stores it as the session cookie **without Supabase validation**. An attacker can set an arbitrary token.
- **Fix:** Validate the token with `supabase.auth.getUser(token)` before setting the cookie.

#### SEC-07: NLP Dictionary Endpoint Has No Auth
- **File:** `src/server/routes/nlpRoutes.js` (lines 103-107)
- **Detail:** `GET /api/nlp/dictionary` exposes the complete keyword dictionary publicly, allowing attackers to learn classification logic and craft evasive inputs.

#### SEC-08: Department Categories Endpoint Has No Auth
- **File:** `src/server/routes/departmentStructureRoutes.js` (line 9)
- **Detail:** Full organizational hierarchy (categories, subcategories, departments) exposed without authentication.

#### SEC-09: ID Number Enumeration Without Auth
- **File:** `src/server/routes/verificationRoutes.js` (lines 117-143)
- **Detail:** `POST /api/verification/check-id` has no `authenticateUser`, allowing PII enumeration.

#### SEC-10: CORS Fully Open (All Origins Allowed)
- **File:** `src/server/config/middleware.js` (line 37)
- **Detail:** `app.use(cors())` with no origin restriction. Any website can make cross-origin API requests.
- **Fix:** `cors({ origin: ['https://yourdomain.com'], credentials: true })`.

#### SEC-11: CSP Allows `'unsafe-inline'` and `'unsafe-eval'`
- **File:** `src/server/middleware/security.js` (lines 13-18)
- **Detail:** Both `scriptSrc` and `styleSrc` include `'unsafe-inline'` and `'unsafe-eval'`, negating XSS protection from CSP.

#### SEC-12: CAPTCHA Verification Never Runs (Commented Out in Production)
- **File:** `src/server/routes/captchaRoutes.js` (lines 56-65)
- **Detail:** In development mode, any token is accepted. The production verification code is commented out — so CAPTCHA is **always** bypassed.

#### SEC-13: Token Comparison Vulnerable to Timing Attacks
- **File:** `src/server/utils/token.js` (line 51)
- **Detail:** Verification token uses `!==` instead of `crypto.timingSafeEqual`. The CSRF module correctly uses timing-safe comparison, but the verification token does not.

#### SEC-14: "Remember Me" Cookie Valid for 10 Years
- **File:** `src/server/utils/authUtils.js` (lines 129-131)
- **Detail:** Stolen session cookies remain valid for a decade.
- **Fix:** Reduce to 30 days max with token rotation.

#### SEC-15: `secrets-found.txt` Committed to Repository
- **File:** `secrets-found.txt`
- **Detail:** Contains: `"Potential Secret Found: Hardcoded Password in src\server\routes\authRoutes.js"`. This file should be in `.gitignore`.

### MEDIUM

#### SEC-16: CSRF Protection Missing on Most Mutating Endpoints
- Applied only on: auth password routes, complaint creation.
- **Missing on:** `superAdminRoutes`, `settingRoutes`, `departmentRoutes`, `nlpRoutes`, `officeConfirmationRoutes`, `lguOfficerRoutes`, `coordinatorRoutes`, `notificationRoutes`, `complianceRoutes`, `contentRoutes`, `verificationRoutes`.
- An attacker's page can auto-submit forms to ban users, swap roles, modify NLP config, etc.

#### SEC-17: Environment Variable Can Disable All Rate Limiting
- **File:** `src/server/middleware/rateLimiting.js` (line 174)
- `DISABLE_RATE_LIMITING=true` completely removes all rate limits.

#### SEC-18: Uploads Directory Served Publicly Without Access Control
- **File:** `src/server/config/middleware.js` (line ~110)
- Files in `uploads/` (including OCR scans of government IDs) are publicly accessible.

#### SEC-19: Super Admin Routes Missing Input Validation
- **File:** `src/server/routes/superAdminRoutes.js`
- None of the `POST` routes (`/role-swap`, `/ban-user`, `/unban-user`, `/transfer-department`, `/assign-citizen`) use `validate()` middleware.

#### SEC-20: Bulk Merge / Duplicate Endpoints Missing Role Check
- **File:** `src/server/routes/complaintRoutes.js` (lines 218-226)
- `GET /:id/potential-duplicates` and `POST /:id/bulk-merge` require auth but no `requireRole` — any citizen can merge complaints.

#### SEC-21: Role Escalation Risk via `app_mode` Cookie
- **File:** `src/server/middleware/auth.js` (lines 112-117)
- Client-controllable cookie drives role switching. If `SWITCHABLE_ROLES` is expanded, privilege escalation is possible.

#### SEC-22: Session Health Endpoint Leaks PII
- **File:** `src/server/routes/sessionRoutes.js` (lines 80-120)
- `GET /auth/session/health` returns `userId`, `email`, `role`, `name` without full `authenticateUser` middleware.

#### SEC-23: 50MB Body Parser Limit
- **File:** `src/server/config/middleware.js` (lines 38-39)
- Enables DoS via large JSON payloads. Should be 1MB for standard API routes.

#### SEC-24: Security Headers Disabled in Development
- **File:** `src/server/config/middleware.js` (lines 31-36)
- No CSP, HSTS, X-Frame-Options in dev mode.

#### SEC-25: CSRF Secret Regenerates on Each Server Restart
- **File:** `src/server/middleware/csrf.js` (line 5)
- If `CSRF_SECRET` env var is unset, all existing CSRF tokens are invalidated on restart.

### LOW

#### SEC-26: Health Endpoint Leaks Uptime, Memory, Version
- **File:** `src/server/routes/healthRoutes.js`

#### SEC-27: Supabase Config Endpoint Exposes Anon Key + URL
- **File:** `src/server/routes/supabaseRoutes.js` (lines 8-15)

#### SEC-28: `cross-origin-embedder-policy` Disabled
- **File:** `src/server/middleware/security.js` (line 71)

#### SEC-29: Storage Route — No Ownership Validation
- **File:** `src/server/routes/storageRoutes.js` (lines 12-13)
- Any authenticated user can generate signed URLs for any complaint's evidence.

#### SEC-30: Log File (`log.txt`) Contains Internal Data and Is Version-Controlled
- **File:** `log.txt` (6591 lines)
- Contains complaint IDs, timestamps, operational data. Should be in `.gitignore`.

#### SEC-31: Password Minimum Length Is 4 Characters
- **File:** `src/shared/passwordValidation.js` (line 3), `src/server/routes/authRoutes.js` (line 198)
- While complexity rules make 4-char passwords impractical, the stated minimum contradicts SECURITY.md ("Minimum 8 characters") and NIST guidelines.

#### SEC-32: Dev Mode Rate Limits 5x Higher
- **File:** `src/server/middleware/rateLimiting.js` (lines 102-103)
- Login limiter becomes 250 attempts/15min in development.

---

## 2. Backend Analysis

### Architecture Overview

The application follows a layered MVC pattern: **Routes → Controllers → Services → Repositories → Supabase (DB)**.

- **25+ API route files** mounted under `/api`
- **Session routes** at `/auth`
- **~50+ page routes** serving EJS-rendered HTML
- **Middleware stack:** trust proxy → HTTPS enforcement → Helmet → CORS → body parser → cookie parser → rate limiter → input sanitizer → static files

### CRITICAL

#### BE-01: `createAssignment` Passes Invalid Status — Always Throws
- **File:** `src/server/services/ComplaintService.js` (line ~1930)
- `await this.updateComplaintStatus(complaintId, "assigned to officer")` — the string `"assigned to officer"` is not in the `validStatuses` array, so the officer assignment flow **always fails**.

#### BE-02: Wrong Import Path in `auditMiddleware.js`
- **File:** `src/server/middleware/auditMiddleware.js` (line 7)
- `require("../../config/database")` resolves to `src/config/database` which **does not exist**. Should be `require("../config/database")`. This will crash when the middleware runs.

### HIGH

#### BE-03: Singleton Pattern Bypassed in ~15+ Files
- **File:** `src/server/routes/storageRoutes.js` (line 6) and many others
- `const db = new Database()` creates new instances instead of using `Database.getInstance()`, bypassing the singleton pattern and creating unnecessary Supabase clients.

#### BE-04: Two Conflicting `constants.js` Files
- `shared/constants.js` (root) and `src/shared/constants.js` define overlapping exports (`NOTIFICATION_TYPES`, `NOTIFICATION_ICONS`) with **different values**.
- E.g., `NOTIFICATION_TYPES.COMPLAINT_ASSIGNED`: root = `"complaint_assigned"`, src = `"complaint_assigned_to_officer"`.
- Different modules import from different paths, creating silent type mismatches in stored notifications.

#### BE-05: Two Conflicting `config/app.js` Files
- `config/app.js` (root) — class-based `AppConfig` singleton
- `src/server/config/app.js` — plain object export
- Overlapping settings (features, uploads) with different structures. Routes/middleware import from both.

### MEDIUM

#### BE-06: Typo: `uploadsDir` Points to `"uplaoads"`
- **File:** `config/app.js` (line 12)
- `this.uploadsDir = join(this.rootDir, "uplaoads")` — any code using `config.uploadsDir` points to a non-existent directory.

#### BE-07: `ComplaintService` is a God Object (2,148 Lines)
- Handles creation, NLP classification, assignment, status transitions, duplicate detection, reminders, statistics, and evidence management. Should be decomposed.

#### BE-08: `AuthController` is a God Object (1,466 Lines)
- Covers signup, login, OAuth, password change/reset, email change, profile management, and session invalidation.

#### BE-09: Inconsistent Error Handling Patterns
- Some controllers use `ErrorHandler.asyncWrapper()`.
- Others use manual try/catch with `console.error`.
- Some inline route handlers have no error wrapping at all.

#### BE-10: Duplicate `requireRole` Calls on Routes
- **File:** `src/server/routes/complaintRoutes.js` (lines 156-168)
- `/:id/remind` and `/:id/confirm-resolution` both have `requireRole(["citizen"])` applied **twice**.

### LOW

#### BE-11: Inline Route Handlers Instead of Controllers
- `contentRoutes.js`, `brainDashboardRoutes.js`, `departmentStructureRoutes.js`, `superAdminRoutes.js` (user listing) contain business logic inline.

#### BE-12: Five Different Supabase Client Creation Patterns
- `Database.getClient()` (static singleton), `Database.getInstance().getClient()` (OOP singleton), `new Database().getClient()` (breaks singleton), `Database.getServiceClient()` (factory), and `createClient()` called directly in routes.

#### BE-13: Session Refresh Endpoint Is Broken
- **File:** `src/server/routes/sessionRoutes.js` (lines 154-158)
- `supabase.auth.getSession()` called on the server-side service-role client which has no user session context.

#### BE-14: `isBrowser` Variable Unused, Multiple Unused Imports
- `authRoutes.js` line 72: `isBrowser` assigned but never referenced.
- `ComplaintController.js` line 3: `fs` imported but unused.
- `supabaseRoutes.js` line 3: `_Database` imported but unused.

---

## 3. UI / Client-Side Analysis

### HIGH — DOM-Based XSS Vulnerabilities

#### UI-01: Error Messages Injected via `innerHTML` Without Sanitization
| File | Line(s) |
|------|---------|
| `public/js/components/sliding-panel.js` | ~262 |
| `public/js/pages/complaint-details.js` | ~1644 |
| `public/js/pages/admin/nlp-training.js` | 120, 322, 586 |

Pattern: `` innerHTML = `...Error: ${error.message}...` `` — if a server API response contains crafted HTML in the error message, it executes in the DOM.

**Fix:** Replace `innerHTML` with `textContent` for error messages.

#### UI-02: Server Data Rendered via `innerHTML` Without Escaping
| File | Data Field | 
|------|-----------|
| `public/js/analytics/analytics-client.js` (line 37) | `data.narrative` injected raw |
| `public/js/analytics/analytics-client.js` (lines 144-152) | Cluster `id`, `category` in innerHTML |
| `public/js/coordinator/review.js` (lines 247-256) | `first_name`, `last_name`, `email`, `mobile_number` |
| `public/js/coordinator/review.js` (lines 316-347) | Timeline `comment` data |
| `public/js/pages/admin/nlp-training.js` (lines 132-171) | `item.text`, `item.matched_term`, `item.method` |
| `public/js/pages/admin/nlp-training.js` (lines 350-400) | `d.term`, `d.pattern`, `d.anchor_text` |

**Note:** Some modules **do** properly escape (e.g., `complaint-details.js` uses `escapeHtml()`, `user-manager.js` uses `escapeHtml()`, `brain-dashboard` has `sanitizeHTML()`). The inconsistency is the issue.

#### UI-03: Missing CSRF Tokens on Most State-Changing API Calls
| File | API Call |
|------|----------|
| `public/js/coordinator/review.js` | `PATCH /api/complaints/:id/status` |
| `public/js/coordinator/review.js` | `POST /api/complaints/:id/mark-false` |
| `public/js/lgu-admin/department-queue.js` | Multiple POST/PATCH calls |
| `public/js/super-admin/user-manager.js` | Role changes, bans, deletions |
| `public/js/pages/complaint-details.js` | `POST /api/complaints/:id/bulk-merge` |

Only `apiClient.submitComplaint()` properly fetches and attaches CSRF tokens. The `ApiClient.post/put/delete` methods do **not** include CSRF headers automatically.

### MEDIUM

#### UI-04: CDN Resources Without Subresource Integrity (SRI)
- Leaflet CSS/JS (unpkg.com) in `views/pages/citizen/fileComplaint.html`
- Chart.js (jsdelivr.net) in `lgu-officer/dashboard.html`, `lgu-admin/reports.html`, `citizen/dashboard.html`
- `@turf/turf`, `leaflet.heat`, `sheetjs` in `lgu-admin/heatmap.html`
- Font Awesome in multiple pages

**Good:** `citizen/digosMap.html` and `complaint-details.html` do include SRI hashes for Leaflet.

#### UI-05: Tailwind CSS CDN Used in Production Pages
- `lgu-admin/appointMembers.html`, `department-queue.html`, `publish.html`
- `cdn.tailwindcss.com` is the development-only CDN (~3MB, not for production).

#### UI-06: Duplicated Codebase — `src/client/` vs `public/js/`
- Many files exist in both locations with near-identical content: `auth.js`, `signupWithCode.js`, `csrf.js`, `validation.js`, `apiClient.js`, `config.js`, `authChecker.js`.
- Bug fixes in one location may be missed in the other. No build step consolidates them.

#### UI-07: Missing `<!DOCTYPE html>` Declarations
- `citizen/fileComplaint.html`, `citizen/dashboard.html`, `lgu-admin/reports.html`, `reset-password.html` — triggers quirks mode.

#### UI-08: Inline `onclick` Handlers (Requires `unsafe-inline` CSP)
- `public/js/pages/admin/nlp-training.js` — dynamically generated buttons with `onclick="resolveAutoQueueItem('${item.id}')"`
- `public/js/super-admin/user-manager.js` — `onclick="openPromotionModal(...)"`, `onclick="openBanModal(...)"`

#### UI-09: `brain-config.json` Publicly Served (7816 Lines)
- Contains the complete NLP taxonomy/dictionary, publicly accessible at `/brain-config.json`.

### LOW

#### UI-10: `alert()` Used Instead of Toast System
- `analytics-client.js`, `coordinator/review.js`, `complaint-details.js`, `progressiveForm.js` — all use native `alert()` despite a proper toast notification system existing.

#### UI-11: Client-Side Role Stored in `localStorage`
- `public/js/auth/authChecker.js` — `cl_user_meta` stored in localStorage. While only for UI rendering, could leak conditional UI data.

#### UI-12: Missing `aria-pressed` on Dynamic Buttons
- `nlp-training.js` inline onclick buttons lack accessible roles and labels.

#### UI-13: CAPTCHA Bypassed on `localhost`
- `public/js/auth/auth.js` — CAPTCHA skipped when `hostname === "localhost"`.

#### UI-14: No Loading/Error States in Several Modules
- `coordinator/review.js` — no loading spinner during status PATCH.
- `analytics-client.js` — uses `alert()` on init failure.
- `complaint-details.js` — duplicate check silently fails with `console.error` only.

---

## 4. Feature Correctness Analysis

### CRITICAL

#### FC-01: No Workflow Transition Validation
- **File:** `src/server/services/ComplaintService.js` (line ~912)
- `updateComplaintStatus` validates that the target status exists in a flat list of 12 values, but does **not** enforce valid transition ordering. Any status can jump to any other status (e.g., "submitted" → "resolved" directly).
- The README describes 5 phases (Submitted → Verified → Under Review → Action Taken → Resolved), but the code allows 12 statuses with no transition map.

#### FC-02: `createAssignment` Uses Invalid Status String
- **File:** `src/server/services/ComplaintService.js` (line ~1930)
- `updateComplaintStatus(complaintId, "assigned to officer")` — this string is not in `validStatuses`, so officer assignment **always throws an error**.

### HIGH

#### FC-03: Two Separate NLP Implementations With Inconsistent Logic
- `AdvancedDecisionEngine.js` (used by `ComplaintService.createComplaint()`) — database-driven keywords, simple substring match, TF fallback.
- `brain/NLPService.js` (used via `BrainService`) — hardcoded dictionaries, negation detection, false-positive roots.
- These produce **different classifications for the same text**.

#### FC-04: Production Scheduler Uses Non-Thesis-Validated Clustering Parameters
- `brain/ClusteringService.js` uses a fixed 300m radius, minPts=2.
- `src/server/services/ClusteringService.js` uses thesis-validated adaptive parameters (125m/50m/16m).
- The `ClusteringScheduler` uses `BrainService` → `brain/ClusteringService.js` — the **non-thesis version** runs in production.

#### FC-05: README Claims 5-Layer NLP Pipeline, Server Has Only 3
- README describes: Tokenization → Dictionary Matching → TensorFlow AI → Clause Modifier Detection → Multi-Label Resolution.
- `AdvancedDecisionEngine` only implements: Metaphor Filter → Rule-Based Matching → TF Fallback → Default "Others".
- Missing layers (tokenization, negation detection, multi-label) exist only in the client-side brain, not in the server-side classification path used during complaint creation.

### MEDIUM

#### FC-06: Duplicate Text Similarity — Copy-Paste Bug
- **File:** `src/server/services/DuplicationDetectionService.js` (lines 78-88)
- `textScore1` and `textScore2` compare **identical strings** (`descriptive_su` vs `descriptive_su`). Likely intended to compare different fields. Effectively weights text at 0.8 instead of 0.4.

#### FC-07: NLP Classification Does Not Auto-Assign Departments
- **File:** `src/server/services/ComplaintService.js` (line ~118)
- `department_r` is always `[]`. The `department_subcategory_mapping` table exists but is never queried during complaint creation. `departmentMapping.js` utility functions exist but are never called.

#### FC-08: Coordinator Notifications Query Legacy Role
- **File:** `src/server/services/NotificationService.js` (line ~739)
- `notifyAllCoordinators` queries for `p_role: "complaint-coordinator"`, but the 3-role system only has `citizen`, `lgu`, `super-admin`. No coordinators will ever be found.

#### FC-09: Notification Status Messages Incomplete
- **File:** `src/server/services/NotificationService.js` (lines 506-513)
- Only 4 statuses mapped (`in progress`, `resolved`, `rejected`, `closed`). The 5-phase workflow statuses produce awkward messages like `"status changed to under_review"`.

#### FC-10: ClusteringService Queries Non-Existent Columns
- **File:** `src/server/services/ClusteringService.js` (line ~88)
- Selects `title` and `created_at` which don't exist in the schema (should be `descriptive_su` and `submitted_at`).

### LOW

#### FC-11: `COMPLAINT_STATUS` and `WORKFLOW_STATUS` Constants Are Dead Code
- **File:** `src/shared/constants.js` (lines 37-50)
- Two status enums defined but never used by `ComplaintService` — it uses its own inline array.

#### FC-12: `getTimelineStepKey` Collapses Distinct Statuses
- **File:** `src/server/utils/complaintUtils.js` (lines 342-356)
- `assigned`, `verified`, `under_review` all map to `"verified"`. `pending_approval`, `action_taken`, `in_progress` all map to `"action_taken"`. Timeline comments lose status distinction.

#### FC-13: `brain/ClusteringService.js` `calculateRadius` Returns Placeholder
- **File:** `src/server/services/brain/ClusteringService.js` (line ~201)
- `return 100; // placeholder for visualization` — always returns 100 instead of computing actual cluster radius.

#### FC-14: Test Coverage Missing for All Core Business Features
- **0 tests** for: NLP classification, DBSCAN clustering, workflow transitions, department assignment, duplicate detection, file uploads, OCR, scheduling, settings, reminders, TensorFlow inference.
- Existing 207 tests cover only: auth flows, input validation, session management, notification formatting, and utility functions.

---

## 5. Recommendations by Priority

### P0 — Fix Immediately (Security Critical)

| # | Action | Effort |
|---|--------|--------|
| 1 | Add `authenticateUser` to OCR, rate-limit-reset, NLP dictionary, department structure, verification routes | Low |
| 2 | Remove `node_modules` static serving | Low |
| 3 | Remove `sb_access_token_debug` cookie fallback | Low |
| 4 | Validate token in `POST /auth/session` before setting cookie | Low |
| 5 | Configure CORS with explicit allowed origins | Low |
| 6 | Implement actual CAPTCHA verification (uncomment + configure) | Medium |
| 7 | Add role checks to bulk-merge and super-admin endpoints | Low |

### P1 — Fix Soon (High Severity)

| # | Action | Effort |
|---|--------|--------|
| 8 | Implement workflow transition validation map (enforce valid status paths) | Medium |
| 9 | Fix `createAssignment` invalid status string (`"assigned to officer"` → valid status) | Low |
| 10 | Remove `'unsafe-inline'` and `'unsafe-eval'` from CSP; use nonces | High |
| 11 | Add CSRF protection to all state-changing API routes | Medium |
| 12 | Replace `innerHTML` with `textContent` for error messages (5 locations) | Low |
| 13 | Escape server data in `innerHTML` calls (analytics, coordinator, NLP training) | Medium |
| 14 | Reduce "Remember Me" to 30 days max | Low |
| 15 | Increase minimum password length to 8 | Low |
| 16 | Fix the `auditMiddleware.js` import path | Low |
| 17 | Consolidate the two `constants.js` files into one | Medium |

### P2 — Fix in Next Sprint

| # | Action | Effort |
|---|--------|--------|
| 18 | Use per-request Supabase clients with user JWT instead of service role | High |
| 19 | Fix uploads directory typo (`"uplaoads"` → `"uploads"`) | Low |
| 20 | Serve uploads through authenticated routes instead of static | Medium |
| 21 | Reduce body parser limit to 1MB (increase per-route for uploads) | Low |
| 22 | Add SRI hashes to all CDN resources | Medium |
| 23 | Replace Tailwind CDN with production build | Medium |
| 24 | Fix duplicate text similarity copy-paste bug | Low |
| 25 | Connect `departmentMapping.js` to complaint creation for auto-assignment | Medium |
| 26 | Fix `ClusteringService.js` column name mismatches | Low |
| 27 | Use thesis-validated DBSCAN parameters in the scheduler path | Medium |
| 28 | Add Joi validation schemas to super-admin routes | Medium |

### P3 — Improve Over Time

| # | Action | Effort |
|---|--------|--------|
| 29 | Decompose `ComplaintService` (2,148 lines) into focused services | High |
| 30 | Decompose `AuthController` (1,466 lines) into focused controllers | High |
| 31 | Consolidate `src/client/` and `public/js/` with a build step | High |
| 32 | Standardize Supabase client usage (eliminate `new Database()` calls) | Medium |
| 33 | Add tests for core features (NLP, DBSCAN, workflow, scheduling) | High |
| 34 | Standardize error handling (use `asyncWrapper` everywhere) | Medium |
| 35 | Replace `alert()` calls with toast system | Low |
| 36 | Add `<!DOCTYPE html>` to pages missing it | Low |
| 37 | Replace inline `onclick` handlers with `addEventListener` | Medium |
| 38 | Add `.env.example` for developer onboarding | Low |
| 39 | Add `log.txt` and `secrets-found.txt` to `.gitignore` | Low |
| 40 | Implement notification messages for all workflow phases | Low |

---

*End of report. Generated by automated static analysis and code review.*
