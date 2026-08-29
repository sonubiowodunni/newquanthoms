==============================================================================
BUFF-DELEGATION-GUIDE.md -- READ-ONLY TASK TEMPLATES FOR DELEGATED AGENTS
==============================================================================
Created: 2026-08-26
Location: docs/BUFF-DELEGATION-GUIDE.md
Purpose: Provides standardized, read-only task templates that any agent
         can be given directly. Each template is self-contained: it tells
         the agent exactly what to read, what to check, what to report,
         and what NOT to touch.

RULES FOR USE:
  1. These templates are READ-ONLY. Do not modify them.
  2. To use one, copy its text into the agent's prompt.
  3. The agent reads AGENTS.md first (mandatory), then executes the task.
  4. Each template includes scope boundaries: what to touch, what not to.
  5. Report format is specified in each template. Agents must follow it.

==============================================================================
HOW TO DELEGATE
==============================================================================

1. Choose the template that matches the task.
2. Copy the template text.
3. Paste it into the agent's prompt.
4. The agent reads AGENTS.md, then executes the template.
5. The agent reports back in the specified format.

Example prompt to an agent:
  "Read AGENTS.md in the project root, then execute TASK 1 from
  BUFF-DELEGATION-GUIDE.md."

==============================================================================
TASK 1: BANQ AUTH FLOW VERIFICATION
==============================================================================

SCOPE: Verify the BANQ authentication system works end-to-end.
DO NOT MODIFY any files. This is a read-and-test task only.

READ FIRST:
  - docs/AGENTS.md (mandatory)
  - backend/auth.js
  - backend/db.js
  - js/app.js
  - login.html

CHECK:
  1. POST /api/auth/login accepts username + password, returns token.
  2. Token is stored in localStorage as banq_token (NOT qwk_token).
  3. GET /api/auth/me with Bearer token returns user info.
  4. POST /api/auth/logout deletes the session.
  5. requireAuth middleware rejects requests without valid token.
  6. Admin account (banqadmin) is seeded in db.js on every boot.
  7. Passwords are hashed with bcrypt.
  8. Tokens are UUIDv4, stored as SHA-256(token) in sessions table.
  9. Sessions expire after 7 days.
  10. 401 response triggers token clear + redirect to /login.html in app.js.

REPORT FORMAT:
  For each check: PASS / FAIL / N/A + one-line explanation.
  If any FAIL: identify the file, line, and what is wrong.
  Do NOT fix anything. Report only.

==============================================================================
TASK 2: API PROXY VERIFICATION
==============================================================================

SCOPE: Verify the BANQ-to-QwkBrowser API proxy is correctly configured.
DO NOT MODIFY any files. This is a read-and-test task only.

READ FIRST:
  - docs/AGENTS.md (mandatory)
  - server.js
  - .env (if it exists)

CHECK:
  1. /api/ads/* is proxied to http://localhost:3001/api/ads/*
  2. /api/profile/* is proxied to http://localhost:3001/api/profile/*
  3. /api/auth/* is NOT proxied (local BANQ auth only).
  4. Proxy preserves request headers (Authorization, Content-Type).
  5. Proxy handles errors gracefully (QWK down -> 502 or timeout, not crash).
  6. Static files are served from project root (express.static).
  7. SPA fallback: unknown routes return index.html.
  8. CORS headers are present if needed for cross-origin requests.
  9. QWK_API_URL is read from .env (not hardcoded).
  10. Server starts without errors on port 3002.

REPORT FORMAT:
  For each check: PASS / FAIL / N/A + one-line explanation.
  If any FAIL: identify the file, line, and what is wrong.
  Do NOT fix anything. Report only.

==============================================================================
TASK 3: BILLBOARD FEED AUDIT
==============================================================================

SCOPE: Audit the index.html billboard feed for correctness and completeness.
DO NOT MODIFY any files. This is a read-and-test task only.

READ FIRST:
  - docs/AGENTS.md (mandatory)
  - index.html
  - js/app.js
  - css/styles.css

CHECK:
  1. Feed renders placeholder banner cards on first load (before API call).
  2. Banner cards have: image/video, title, advertiser name, QU reward badge.
  3. "Click to Earn" button is present on each banner.
  4. Clicking "Click to Earn" calls the API (or shows cooldown for demo).
  5. Daily bonus progress bar is visible and updates.
  6. Billboard Interest sidebar is present with city-level data.
  7. "Show More" popup works for billboard interest cities.
  8. AD-Packages popup is accessible and QAP input validates format.
  9. Feed is responsive (works at 375px, 768px, 1440px).
  10. No console errors on page load.
  11. No mojibake or encoding issues in any text.
  12. All CSS classes use banq- prefix.

REPORT FORMAT:
  For each check: PASS / FAIL / N/A + one-line explanation.
  If any FAIL: identify the file, section, and what is wrong.
  Do NOT fix anything. Report only.

==============================================================================
TASK 4: PACKAGES PAGE AUDIT
==============================================================================

SCOPE: Audit packages.html for correctness and completeness.
DO NOT MODIFY any files. This is a read-and-test task only.

READ FIRST:
  - docs/AGENTS.md (mandatory)
  - packages.html
  - js/app.js

CHECK:
  1. Three package tiers are displayed: Starter ($50/7d), Premium ($200/14d),
     Sponsored ($500/30d).
  2. Each tier shows: price, duration, features list.
  3. QAP number input field is present on each tier.
  4. QAP format validation (QAP-[A-Z0-9]{6,}) works.
  5. Invalid QAP shows error message, does not redirect.
  6. Valid QAP redirects to dashboard.html with ?qap= and &pkg= URL params.
  7. Page is responsive (cards stack on phone).
  8. No console errors.
  9. No mojibake.

REPORT FORMAT:
  For each check: PASS / FAIL / N/A + one-line explanation.
  Do NOT fix anything. Report only.

==============================================================================
TASK 5: DASHBOARD QAP INTEGRATION AUDIT
==============================================================================

SCOPE: Audit dashboard.html for QAP integration correctness.
DO NOT MODIFY any files. This is a read-and-test task only.

READ FIRST:
  - docs/AGENTS.md (mandatory)
  - dashboard.html
  - js/app.js

CHECK:
  1. QAP banner appears when URL has ?qap= parameter.
  2. Package info appears when URL has &pkg= parameter.
  3. Banner CRUD UI is present (create, edit, delete banners).
  4. Auth is required (redirect to login if not signed in).
  5. Banner form fields: title, image URL, target URL, duration.
  6. Created banners are saved (or show placeholder if backend not ready).
  7. Page is responsive.
  8. No console errors.
  9. No mojibake.

REPORT FORMAT:
  For each check: PASS / FAIL / N/A + one-line explanation.
  Do NOT fix anything. Report only.

==============================================================================
TASK 6: BILLBOARD DECLARATION FORM AUDIT
==============================================================================

SCOPE: Audit billboards.html for form correctness and data display.
DO NOT MODIFY any files. This is a read-and-test task only.

READ FIRST:
  - docs/AGENTS.md (mandatory)
  - billboards.html
  - js/app.js

CHECK:
  1. Declaration form has: city, country, billboard type, message fields.
  2. Form submission works (or shows placeholder if backend not ready).
  3. Demand stats table is present with placeholder data.
  4. Billboard Interest sidebar is present with city-level data.
  5. "Show More" popup shows all cities.
  6. Auth state is reflected in UI (signed in vs signed out).
  7. Page is responsive.
  8. No console errors.
  9. No mojibake.

REPORT FORMAT:
  For each check: PASS / FAIL / N/A + one-line explanation.
  Do NOT fix anything. Report only.

==============================================================================
TASK 7: CONTACT FORM AUDIT
==============================================================================

SCOPE: Audit about.html contact form for correctness.
DO NOT MODIFY any files. This is a read-and-test task only.

READ FIRST:
  - docs/AGENTS.md (mandatory)
  - about.html
  - js/app.js

CHECK:
  1. Contact form has: name, email, subject, message fields.
  2. All fields are required (HTML5 validation or JS validation).
  3. Submit button triggers API call (or shows toast if backend not ready).
  4. Success toast appears after submission.
  5. Form clears after successful submission.
  6. Page is responsive.
  7. No console errors.
  8. No mojibake.

REPORT FORMAT:
  For each check: PASS / FAIL / N/A + one-line explanation.
  Do NOT fix anything. Report only.

==============================================================================
TASK 8: PLACEHOLDER CONTENT AUDIT
==============================================================================

SCOPE: Verify placeholder/demo content is present on all pages.
DO NOT MODIFY any files. This is a read-and-test task only.

READ FIRST:
  - docs/AGENTS.md (mandatory, especially Rule 9)
  - index.html
  - billboards.html
  - packages.html
  - dashboard.html
  - about.html
  - login.html

CHECK:
  1. index.html: placeholder banner cards render on first load.
  2. billboards.html: placeholder demand stats and interest data render.
  3. packages.html: package tier cards render (not dependent on API).
  4. dashboard.html: placeholder banners or empty state message.
  5. about.html: about content and contact form render.
  6. login.html: login form renders.
  7. No page appears completely empty on first load.
  8. Placeholder content uses same CSS classes as real content would.
  9. Placeholder content is visually distinct from real content if needed
     (e.g., [DEMO] prefix on banner titles).

REPORT FORMAT:
  For each page: PASS / FAIL + what placeholder content is present.
  If any FAIL: identify what is missing and what should be there.
  Do NOT fix anything. Report only.

==============================================================================
TASK 9: ENCODING INTEGRITY CHECK
==============================================================================

SCOPE: Scan all HTML, CSS, and JS files for mojibake (double-UTF-8 corruption).
DO NOT MODIFY any files. This is a read-and-scan task only.

READ FIRST:
  - docs/AGENTS.md (mandatory, especially Rule 5)

SCAN:
  All .html, .css, and .js files in:
  - Project root (*.html, *.js)
  - backend/ (*.js)
  - css/ (*.css)
  - js/ (*.js)

CHECK FOR:
  1. Mojibake patterns: A-cents, A-deg, A-~, A-|, A(c), A~P, etc.
  2. Garbled UTF-8 sequences (multi-byte characters that look corrupted).
  3. BOM characters at the start of files (EF BB BF).
  4. Mixed encoding within a single file.
  5. Em-dashes that appear as "--" or garbage instead of proper dashes.
  6. Smart quotes that appear as garbage.

REPORT FORMAT:
  For each file: CLEAN / CORRUPTED + details if corrupted.
  If CORRUPTED: identify the file, the corrupted patterns, and suggest
  restoring from the last clean git commit.
  Do NOT fix anything. Report only.

==============================================================================
TASK 10: NAVIGATION CONSISTENCY CHECK
==============================================================================

SCOPE: Verify all pages have consistent navigation headers.
DO NOT MODIFY any files. This is a read-and-check task only.

READ FIRST:
  - docs/AGENTS.md (mandatory, especially Rule 18)

CHECK:
  1. All pages have a <header> with navigation links.
  2. Nav links are: Feed (index.html), Billboards (billboards.html),
     Packages (packages.html), About (about.html).
  3. All pages have a "Sign In" or user info display in the header.
  4. Nav links are consistent across all 6 pages (same items, same order).
  5. Active page is highlighted in nav (if implemented).
  6. Nav is responsive (collapses or scrolls on phone).

REPORT FORMAT:
  For each page: list nav items present. Note any inconsistencies.
  Do NOT fix anything. Report only.

==============================================================================
END OF BUFF-DELEGATION-GUIDE.md
==============================================================================
