# DRIMS Frontend Interface Audit (Desktop + Mobile)

Date: 2026-03-30  
Scope: Static review of HTML templates in `views/pages/**`, CSS in `public/css/**`, and client JS in `public/js/**`.  
Goal: Identify UX/responsiveness issues (desktop/mobile), missing/buggy behaviors, accessibility gaps, and high-risk frontend security/performance issues.

## Executive summary

The frontend has a strong component foundation (header/sidebar/toast, utility classes, theme variables), but it currently suffers from **conflicting layout strategies**, **inconsistent styling systems (custom CSS vs Tailwind CDN vs ad-hoc inline styles)**, and several **mobile breakpoints that will overflow or trap scrolling** (fixed panels, fixed heights, global `overflow: hidden`). There are also repeated patterns of **unsafe HTML rendering** via `innerHTML` with interpolated complaint/user data.

Top priorities:
- Fix **scroll/viewport trapping** caused by global `overflow: hidden` + nested scroll containers (especially `complaintDetails` and dashboard layouts).
- Fix **toast container mismatch** and address toast sizing for small screens.
- Standardize **layout CSS ownership** (`viewportFix.css` vs `dashboardCommon.css` vs page overrides) to avoid unpredictable behavior.
- Address **XSS risk**: stop interpolating untrusted fields into `innerHTML`.
- Remove / replace **Tailwind CDN usage** (performance) and fix pages that assume Tailwind but don’t include it.

---

## Findings (Critical / High)

### C1 — Unsafe `innerHTML` rendering (XSS risk)
**Impact:** User-provided fields (e.g., complaint title/description/location) are inserted into HTML strings without escaping in multiple admin/queue pages. This enables XSS if the backend ever stores/render untrusted HTML content.

**Evidence (examples):**
- `public/js/lguAdmin/departmentQueue.js`: complaint fields injected into `complaintsList.innerHTML`.
- `public/js/components/toast.js`: `toast.innerHTML = ... ${message} ...` (message may include server/user content).
- Many other occurrences found by searching `innerHTML =` across `public/js/**`.

**Recommendation:**
- Prefer `textContent` for plain text (titles/descriptions/locations).
- If rich formatting is required, sanitize using a vetted sanitizer and a strict allowlist.

---

### C2 — Conflicting global layout rules create unpredictable scroll behavior
**Impact:** Multiple CSS files take ownership of `#app`, `.app-container`, and dashboard wrappers in different ways (some set `overflow: hidden`, others set `overflow-y: auto`, others force `height: 100vh`). This increases the chance of:
- content being inaccessible (no scroll),
- double-scroll areas,
- fixed headers overlapping content,
- iOS/Android soft keyboard causing clipped views.

**Evidence (examples):**
- `public/css/layouts/viewportFix.css`: `.app-container { overflow: hidden }`, `#app { overflow-y: auto }`.
- `public/css/pages/dashboardCommon.css`: `#app { overflow: hidden; height: 100vh; }` and pushes scroll into `.dashboard-main-wrapper`.
- `public/css/pages/complaintDetails.css`: `html, body { overflow: hidden !important; height: 100vh; }` and uses multiple internal scrollers.

**Recommendation:**
- Choose a single “scroll owner” pattern for the app shell (recommended: keep `body` scrollable OR keep `#app` scrollable — but not both across different pages).
- Document and enforce it; page-specific CSS should not override `html/body/#app` fundamentals unless absolutely required.

---

### H1 — Toast container mismatch + small-screen overflow
**Impact:** Many pages include `<div id="toast-container" class="toast-container"></div>`, but the toast implementation uses `#toast` as the container id and will create a second container at runtime. On narrow screens, `.toast { min-width: 300px; right: 20px }` can overflow.

**Evidence:**
- `public/js/components/toast.js`: container id is `toast`.
- `views/pages/profile.html` and other pages: includes `id="toast-container"`.
- `public/css/components/toast.css`: `.toast { min-width: 300px; max-width: 420px }`.

**Recommendation:**
- Unify on one container id (either update pages to `id="toast"` or update JS to reuse `toast-container`).
- Add a mobile rule like: `max-width: calc(100vw - 32px); min-width: 0; right: 16px; left: 16px;` for phones.

---

### H2 — Fixed-position panels and fixed widths overflow on mobile
**Impact:** Several pages use fixed panels with desktop-first widths (e.g., 340px controls) that will overflow on small devices, especially at 320px widths.

**Evidence:**
- `public/css/heatmapRedesign.css`: `.map-controls { position: fixed; width: 340px; right: 20px; }`.
- Heatmap pages also use many fixed `100vh` containers and `overflow: hidden` patterns.

**Recommendation:**
- Add responsive breakpoints: on small screens, make controls full-width (or bottom sheet) and allow `max-width: calc(100vw - 32px)`.

---

## Findings (Medium)

### M1 — Tailwind usage is inconsistent (some pages rely on it but don’t include it)
**Impact:** Pages use Tailwind-style utility classes (`text-gray-500`, `dark:bg-gray-800`, `min-w-[1000px]`, etc.). Some pages load Tailwind via CDN, some don’t. Pages that don’t include Tailwind will render with missing styles and broken layouts.

**Evidence:**
- `views/pages/lguAdmin/heatmap.html`: includes `https://cdn.tailwindcss.com`.
- `views/pages/lguAdmin/assignments.html`: uses Tailwind-like classes but has no Tailwind CDN include.
- Other LGU admin pages explicitly comment about the Tailwind CDN not being production-ready.

**Recommendation:**
- Standardize on one approach:
  - either ship a built Tailwind CSS bundle (preferred) and remove the CDN, or
  - remove Tailwind utility usage where the project relies on custom CSS utilities.

---

### M2 — Inline styles and hard-coded colors reduce theme consistency
**Impact:** Many templates include inline `style="..."` and hard-coded hex colors. This makes dark mode and future design updates brittle.

**Evidence (examples):**
- `views/pages/settings.html`: embedded `<style>` uses `#4f46e5` and other hard-coded colors.
- `views/pages/complaintDetails.html`: numerous inline styles.
- `public/css/pages/complaintDetails.css` and `public/css/heatmapRedesign.css`: many hard-coded colors/gradients.

**Recommendation:**
- Move these into component/page CSS and use theme variables from `public/css/base/theme.css` where possible.

---

### M3 — Multiple fixed-height map/layout components
**Impact:** Fixed heights (e.g., 350px/400px maps) can become too large on short devices and too small on large screens; also interacts poorly with fixed headers/footers and soft keyboards.

**Evidence:**
- `public/css/complaintForm.css`: `.premium-map { height: 350px }` under mobile breakpoint; desktop uses 400px.

**Recommendation:**
- Use responsive sizing (e.g., `clamp()` or viewport-based `min()`/`max()`), and ensure the map container participates in the chosen scroll model.

---

## Findings (Accessibility)

### A1 — Inline `onclick` handlers and click-to-dismiss patterns
**Impact:** Inline handlers complicate CSP hardening and make behavior harder to audit. Toast click-to-dismiss anywhere can conflict with selecting/copying text and is harder for keyboard/screen reader users.

**Evidence:**
- `views/pages/complaintDetails.html`: `<button ... onclick="location.reload()">`.
- Multiple admin pages include `onclick="..."` handlers.
- `public/js/components/toast.js`: clicking anywhere removes toast.

**Recommendation:**
- Prefer `addEventListener` in module JS.
- For toasts, restrict dismiss to the close button and ensure it’s focusable and labeled.

---

## Findings (Performance / Maintainability)

### P1 — Tailwind CDN is heavy and non-deterministic for production
**Impact:** `https://cdn.tailwindcss.com` is large and generates CSS at runtime. This harms initial load, caching, and offline behavior.

**Evidence:**
- `views/pages/lguAdmin/heatmap.html`: Tailwind CDN usage.

**Recommendation:**
- Replace with a built CSS file committed into `public/css/` (or build pipeline output).

---

## “Missing features” / UX gaps (observed patterns)

These are not necessarily bugs, but common gaps given the current UI patterns:
- No consistent responsive table strategy (column collapse, card view, or sticky key columns). Tables are generally wrapped in `overflow-x-auto`, but readability on phones is still poor.
- No consistent “safe area” handling for iOS (notably for fixed headers, fixed toasts, and fixed footers).
- Inconsistent shell structure: some pages use `.app-container` and `viewportFix.css`, others (e.g., `complaintDetails.html`) bypass it entirely.

---

## Recommended remediation order

1) Security: remove unescaped `innerHTML` for untrusted data paths (queues/lists/toasts).
2) Layout: standardize one app-shell scroll strategy; remove page-level overrides of `html/body/#app` where possible.
3) Mobile: fix fixed-width/fixed-position panels (heatmap controls, dropdown min-widths, toast sizing).
4) Styling: eliminate Tailwind CDN and unify style system.
5) Cleanup: migrate inline styles into CSS using theme variables.

---

## Files reviewed (representative)

- Templates: `views/pages/login.html`, `views/pages/signup.html`, `views/pages/profile.html`, `views/pages/settings.html`, `views/pages/complaintDetails.html`, `views/pages/lguAdmin/assignments.html`, `views/pages/lguAdmin/heatmap.html`, `views/pages/coordinator/reviewQueue.html`, `views/pages/lguAdmin/brainAnalytics.html`
- CSS: `public/css/layouts/viewportFix.css`, `public/css/pages/dashboardCommon.css`, `public/css/components/toast.css`, `public/css/components/headerDropdowns.css`, `public/css/complaintForm.css`, `public/css/pages/complaintDetails.css`, `public/css/heatmapRedesign.css`
- JS: `public/js/components/toast.js`, `public/js/pages/complaintDetails.js`, `public/js/lguAdmin/departmentQueue.js`
