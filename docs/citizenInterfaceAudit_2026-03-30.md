# Citizen-side Interface Audit — DRIMS 2.0

Date: 2026-03-30  
Branch reviewed: `working/maca`  
Reviewer: GitHub Copilot (static review)

## Scope
Citizen-facing pages + their client scripts:
- Citizen dashboard: `views/pages/citizen/dashboard.html`, `public/js/pages/citizenDashboard.js`
- File complaint wizard: `views/pages/citizen/fileComplaint.html`, `public/js/pages/citizenFileComplaintAccess.js`, `public/js/components/form/*`, `public/js/components/map/complaintLocationPicker.js`
- Government departments directory: `views/pages/citizen/departments.html`, `public/js/pages/departments.js`
- Digos map: `views/pages/citizen/digosMap.html`, `public/js/pages/digosMap.js`
- Shared UI used by citizen pages: `public/js/components/header.js`, `public/js/components/sidebar.js`, `public/js/components/toast.js`
- Server page routing / access control: `src/server/routes/pages.js`

Out of scope: deep backend business logic, LGU/admin dashboards, DB/Supabase config.

## Method
- Static review of templates + client JS for: navigation correctness, role/access enforcement, XSS/injection, CSP compatibility, a11y basics, and performance footguns.
- Quick automated signal: executed Jest functional suite `tests/functional/loginFlow.test.js` via `node node_modules/jest/bin/jest.js ...` (worked; repo’s `npm test` script didn’t locate `jest` due to missing `node_modules/.bin` in this environment).

## Executive summary
The citizen UI is generally well-structured and visually consistent, but there are several **high-impact issues**:
1) **Server-side access control gaps** for the file-complaint page (currently relies on a client-side redirect).
2) Multiple **XSS injection surfaces** via `innerHTML` (notably the global toast component and citizen dashboard feeds).
3) A **broken complaint-details navigation** and **CSP-hostile inline onclick** in the citizen dashboard.

These are fixable with small, targeted changes (mostly escaping/sanitization and route guards).

---

## Findings

### 1) Missing server-side authorization for `/filecomplaint` (High)
**What**: `GET /filecomplaint` is protected only by authentication. The comment says “citizen only or staff in citizen mode”, but no server-side role/mode enforcement is applied.

**Where**:
- `src/server/routes/pages.js` — route `router.get("/filecomplaint", authenticateUser, ...)`
- Client-side only gate: `public/js/pages/citizenFileComplaintAccess.js`

**Impact**:
- Any authenticated user (LGU/super-admin/etc.) can load the citizen complaint wizard HTML.
- Client-side redirect is not a security boundary; it’s also brittle if JS fails or is blocked.

**Recommendation**:
- Enforce role/mode on the server route.
  - Option A (strict): `requireRole(["citizen"])`.
  - Option B (mode-aware): add middleware that allows staff only when “activeRole/citizenMode” is set and validated server-side.

---

### 2) XSS risk: toast messages are inserted via `innerHTML` (High)
**What**: `public/js/components/toast.js` uses a template string and interpolates `message` directly into HTML.

**Where**:
- `public/js/components/toast.js` — `toast.innerHTML = ... <div class="toast-message">${message}</div> ...`

**Impact**:
- Any untrusted string passed to `showMessage()` can become executable HTML/JS.
- Example risk path: form submission error handling may surface server HTML error pages or unexpected strings to `showMessage()`.

**Recommendation**:
- Keep the icon/title template as HTML if needed, but set the message node using `textContent`.
- If rich HTML messages are truly required, sanitize with DOMPurify (already present in deps as `isomorphic-dompurify`) and explicitly allow only safe tags.

---

### 3) XSS risk: citizen dashboard feeds render API content with `innerHTML` and no escaping (High)
**What**: `loadNotices`, `loadNews`, `loadEvents` render `title/content/description/location` directly in template strings.

**Where**:
- `public/js/pages/citizenDashboard.js` — `container.innerHTML = result.data.map(... ${notice.title} ... ${notice.content} ...)`

**Impact**:
- If any content item contains HTML, it will be rendered as markup.
- If any content is user-editable or admin-editable, this becomes a stored XSS vector.

**Recommendation**:
- Either:
  - Escape all interpolated fields (use the existing `escapeHtml` helper pattern used elsewhere in the same file), or
  - Render with DOM APIs (`textContent`) instead of `innerHTML`.

---

### 4) Broken navigation: ongoing-resolution cards route to `/complaint/:id` (High)
**What**: Ongoing-resolution carousel cards navigate to `/complaint/${c.id}`.

**Where**:
- `public/js/pages/citizenDashboard.js` — inline onclick with `/complaint/${c.id}`

**Why it’s a bug**:
- Server page routes expose `GET /complaint-details/:id` and `GET /complaint-details?id=...`, not `/complaint/:id`.

**Recommendation**:
- Change the target to `/complaint-details/${c.id}` (or `/complaint-details?id=${c.id}` depending on the preferred URL scheme).

---

### 5) CSP compatibility issue: inline `onclick="..."` in generated HTML (Medium)
**What**: the dashboard carousel uses inline `onclick` handlers inside HTML strings.

**Where**:
- `public/js/pages/citizenDashboard.js` — `onclick="window.location.href=..."`

**Impact**:
- If Helmet CSP disallows `unsafe-inline` (common best practice), the click handler won’t execute.
- Inconsistent with the rest of the app which uses `data-href` + event listeners (see `public/js/components/header.js`).

**Recommendation**:
- Replace inline `onclick` with `data-href` attributes and a delegated click handler (or reuse the global `[data-href]` handler already added by header.js).

---

### 6) Case-sensitive deployment risk: script path casing mismatch (Medium)
**What**: file complaint page loads `/js/pages/citizenFilecomplaintAccess.js` but the actual filename is `citizenFileComplaintAccess.js`.

**Where**:
- `views/pages/citizen/fileComplaint.html` — script `src="/js/pages/citizenFilecomplaintAccess.js"`
- Actual file: `public/js/pages/citizenFileComplaintAccess.js`

**Impact**:
- Works on Windows (case-insensitive) but breaks on Linux/macOS deployments.

**Recommendation**:
- Update the script tag to match exact filename casing.

---

### 7) Dashboard timeframe selector appears wired but does nothing (Medium)
**What**: code registers a change listener on `#activityTimeframe`, but `loadDashboardData()` always filters with timeframe = `"all"`.

**Where**:
- `public/js/pages/citizenDashboard.js` — `filterActivityByTimeframe(..., "all")`

**Impact**:
- UI control likely does not affect results, confusing users.

**Recommendation**:
- Read the current value of `#activityTimeframe` and pass it into `filterActivityByTimeframe`.

---

### 8) Polling/race condition risk: `setInterval(loadDashboardData, 30000)` without overlap guard (Low/Medium)
**What**: A new refresh begins every 30 seconds regardless of whether the prior one is still in-flight.

**Where**:
- `public/js/pages/citizenDashboard.js`

**Impact**:
- Possible overlapping fetches, UI flicker, and unnecessary server load on slow networks.

**Recommendation**:
- Add a simple in-flight guard (`if (loading) return;`) and/or use `AbortController` to cancel previous requests.

---

### 9) Map popup content should be treated as untrusted (Low/Medium)
**What**: `digosMap.js` binds popup HTML using `${item.name}`.

**Where**:
- `public/js/pages/digosMap.js` — `.bindPopup(`<strong>${item.name || "Barangay"}</strong>`)`

**Impact**:
- If boundary data becomes editable or compromised, could become XSS.

**Recommendation**:
- Escape `item.name` or set popup content via DOM/text.

---

### 10) Accessibility observations (Low)
Not exhaustive, but notable:
- Microphone button in `fileComplaint.html` uses only an SVG; recommend adding `aria-label`.
- Drag-and-drop evidence upload relies on a hidden `<input type=file>`; ensure the drop zone is keyboard-focusable and triggers file dialog on Enter/Space.
- Wizard step indicators are purely visual; consider `aria-current` or `aria-selected` semantics.

---

## Automated test signal (informational)
- `tests/functional/loginFlow.test.js` passed (17/17).
- Jest reported open handles and forced exit, which suggests some tests leave resources open (worth cleaning up, but not necessarily citizen-UI blocking).

## Recommended remediation plan (prioritized)
1) Fix **server-side enforcement** for `/filecomplaint` in `src/server/routes/pages.js`.
2) Fix **XSS surfaces**:
   - Harden `public/js/components/toast.js` to render `message` safely.
   - Escape/sanitize citizen dashboard feed rendering in `public/js/pages/citizenDashboard.js`.
   - Escape popup values in `public/js/pages/digosMap.js`.
3) Fix **navigation + CSP** in citizen dashboard:
   - Replace inline `onclick` with `data-href`.
   - Correct complaint-details link target.
4) Fix **case mismatch** in `views/pages/citizen/fileComplaint.html`.
5) Wire up timeframe filter and add a polling overlap guard.

## Notes
If you want, I can implement the high-priority fixes directly (they’re relatively contained changes across ~3–5 files) and re-run a small relevant test subset.
