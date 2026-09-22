# BANQ -- Master Pipeline & Task Tracker

> Last updated: 2026-09-22
> This is the single source of truth for all features, tasks, and ideas.
> Update status as things change. Do not delete items -- mark them DONE, DEFERRED, or BLOCKED.

---

## How to Read This Document

Each item has:
- **ID** -- stable reference (BANQ-001, BANQ-002, etc.)
- **Status** -- PLANNED / IN-PROGRESS / DONE / BLOCKED / DEFERRED
- **Spec** -- where the detailed design lives (or "NEEDED" if not yet written)
- **Dependencies** -- what must happen first
- **Notes** -- brief context

---

## Section 1: DONE

### BANQ-001: Initial Site Build
- **Status:** DONE
- **Spec:** `docs/NEW-QUANTHOMS-BILLBOARD-AGENCY.md`
- **Dependencies:** None
- **Notes:** 5 HTML pages (index, login, dashboard, billboards, about), server.js with API proxy to QWK:3001, CSS, JS helpers, placeholder content. Committed as 5c3be7d.

### BANQ-002: Packages Page
- **Status:** DONE
- **Spec:** Inline (packages.html)
- **Dependencies:** BANQ-001
- **Notes:** 3 ad tiers (Starter $50/7d, Premium $200/14d, Sponsored $500/30d) with QAP number input. Redirects to dashboard with ?qap= and &pkg= URL params.

### BANQ-003: Billboard Interest Sidebar
- **Status:** DONE
- **Spec:** Inline (billboards.html + index.html)
- **Dependencies:** BANQ-001
- **Notes:** City-level interest tracking (top 10 by last 7 days: Lagos 165, New York 143, Tokyo 96, etc.). "Show More" popup with all 18 cities. Currently uses placeholder data.

### BANQ-004: AD-Packages Popup
- **Status:** DONE
- **Spec:** Inline (index.html)
- **Dependencies:** BANQ-001
- **Notes:** QAP format validation (QAP-[A-Z0-9]{6,}), launches ads via dashboard redirect.

### BANQ-005: Dashboard QAP Integration
- **Status:** DONE
- **Spec:** Inline (dashboard.html)
- **Dependencies:** BANQ-002, BANQ-004
- **Notes:** QAP banner on redirect with ?qap= and &pkg= URL params. Banner CRUD UI.

### BANQ-006: Independent Auth System
- **Status:** DONE
- **Spec:** `backend/auth.js` + `backend/db.js`
- **Dependencies:** BANQ-001
- **Notes:** BANQ owns its own auth. backend/auth.js (login, me, logout, requireAuth middleware). backend/db.js (users + sessions tables, banqadmin seeding). Token-based using UUIDv4, SHA-256 hashed, 7-day sessions. banq_token in localStorage (NOT qwk_token). Completely separate from QwkBrowser. Committed as 98b498c.

### BANQ-007: Seed Banner Script
- **Status:** CORRECTED 2026-09-21 -- EXISTS IN THE WRONG REPO, deliberately not
  copied. The script is real and matches this description exactly, but it lives
  at `qwkbrowser/backend/seed-banners.js` (where the `ad_banners` table is)
  -- not at a BANQ-local `backend/seed-banners.js`, which is the path this row
  used to claim and which has never existed.
- **Decision:** DEFER. Seeding QWK's table from BANQ would cross the ownership
  boundary the API-partnership design keeps clean, so the seed is a QWK-side
  step and BANQ reads the result through `/api/ads/*`. This row is no longer a
  BANQ task; it is a QWK task that BANQ depends on for demo data.
- **Spec:** `qwkbrowser/backend/seed-banners.js`
- **Dependencies:** BANQ-001
- **Notes:** 8 placeholder banner rows with [DEMO] prefix. Idempotent. Script needs to be run: `node backend/seed-banners.js`. Without running, feed shows mock banners from frontend JS.

---

## Section 2: IN PROGRESS

### BANQ-008: Doc Rebranding
- **Status:** IN-PROGRESS
- **Spec:** This file + all docs in docs/
- **Dependencies:** BANQ-006
- **Notes:** Re-editing all 8 copied docs from qwkbrowser to BANQ standalone. AGENTS.md, BANQ-JS.md, COMMIT-CHECKPOINTS.md, RESPONSIVE-BREAKPOINTS.md, PRE-DEPLOY.md done. BANQ-MASTER-PIPELINE.md (this file), BUFF-DELEGATION-GUIDE.md, NEW-QUANTHOMS-BILLBOARD-AGENCY.md in progress.

---

## Section 3: PLANNED / DEFERRED

### BANQ-009: Billboard Declaration Backend
- **Status:** DONE (2026-09-22) -- `backend/billboards.js`, table `billboard_declarations`, mounted at `/api/billboards/*`. Verified live: declare, update-without-double-counting, interest, demand, withdraw, admin view.
- **Spec:** `NEEDED BACKEND FOR BANQ WEBSITE.md` Section 1
- **Dependencies:** BANQ-006
- **Notes:** POST /declare, GET /interest, GET /demand, DELETE /declare, GET /admin/all. THE DESIGN DECISION THAT MATTERS: demand is ranked by **DISTINCT advertisers**, never by row count -- one advertiser declaring a billboard ten times is interest, ten advertisers declaring once is demand. "Declaring again" updates the existing row instead of stacking, so a repeated click cannot inflate demand. The endpoint answers with an explicit empty-state sentence when there are no declarations, so an empty table is never mistaken for measured zero demand.

### BANQ-010: Contact Form Backend
- **Status:** DONE (2026-09-21) -- `backend/banq.js` (`POST /api/banq/contact`), tables `contact_messages` + `contact_notifications`, honeypot, 30s/IP rate limit, admin routes (`/api/banq/contact/messages|stats`, PATCH status, DELETE), `admin-console.html`. The form no longer claims success unless a row was written. NOTE: the endpoint is `/api/banq/contact`, not the `/api/contact` this row originally specified -- the `/api/banq/*` namespace is where BANQ's own routes live.
- **Spec:** `NEEDED BACKEND FOR BANQ WEBSITE.md` Section 2
- **Dependencies:** BANQ-006
- **Notes:** POST /api/contact (name, email, subject, message). New table: contact_messages. Rate limiting (1 per 30s per IP). No auth required (public form). Without this, contact form submissions are lost (toast shows success but nothing is sent).

### BANQ-011: QAP Validation Backend
- **Status:** DEFERRED
- **Spec:** `NEEDED BACKEND FOR BANQ WEBSITE.md` Section 3
- **Dependencies:** BANQ-006, QwkBrowser API partnership (BANQ-014)
- **Notes:** POST /api/ads/launch-with-qap (qap, package_type). Validate QAP number against QwkBrowser API (bmf_advertising_profiles table). Create ad_banners row linked to QAP owner. Apply package defaults. Return created banner ID. Without this, QAP input is cosmetic.

### BANQ-012: Video Banner Dwell Tracking
- **Status:** PLANNED
- **Spec:** NEEDED
- **Dependencies:** BANQ-001, QwkBrowser /api/ads/impression endpoint
- **Notes:** HTML5 video player with 3-second dwell detection. On 3s visible: POST /api/ads/impression (proxied to QwkBrowser). Award QC. Dwell timer UI: "0s / 3s" -> "Earned!" on completion. Video banner cards in feed.

### BANQ-013: Advertiser Portal
- **Status:** PLANNED
- **Spec:** NEEDED
- **Dependencies:** BANQ-005, BANQ-011
- **Notes:** Lightweight advertiser dashboard on BANQ site (redirects to QwkBrowser for full CRUD). Per-campaign impressions, clicks, CTR, spend. Billboard booking for physical locations (Phase 3).

### BANQ-014: QwkBrowser API Partnership Design
- **Status:** PLANNED
- **Spec:** NEEDED (to be discussed with Chris)
- **Dependencies:** BANQ-006
- **Notes:** Design the API partnership between BANQ and QwkBrowser. What endpoints BANQ calls, what data flows between the two apps, auth boundary (BANQ owns auth, QWK provides ads/profile), CORS/proxy configuration, reward earning flow, QAP validation path, profile/balance sync. This is the second task Chris requested -- must be discussed before implementation.

### BANQ-015: Category Filters
- **Status:** PLANNED
- **Spec:** NEEDED
- **Dependencies:** BANQ-001
- **Notes:** Filter feed by: All, Image Banners, Video Banners, Sponsored, Trending. Filter chips above feed on index.html.

### BANQ-016: Banner Search
- **Status:** PLANNED
- **Spec:** NEEDED
- **Dependencies:** BANQ-001
- **Notes:** Search banners by title, advertiser, keyword. Search bar in header or above feed.

### BANQ-017: User Profile Bar
- **Status:** PLANNED
- **Spec:** NEEDED
- **Dependencies:** BANQ-006
- **Notes:** Shows signed-in user's QU balance, QC balance, today's earnings. Pulled from proxied /api/profile/* (QwkBrowser). Display in header or sidebar.

### BANQ-018: Click History
- **Status:** PLANNED
- **Spec:** NEEDED
- **Dependencies:** BANQ-006, QwkBrowser /api/ads/clicks/history
- **Notes:** User can see which banners they have already clicked and when they reset. Timeline or list view on dashboard.html.

### BANQ-019: Feature Flag System
- **Status:** DONE (2026-09-22) -- `backend/flags.js`, table `banq_feature_flags`, `GET /api/banq/flags` (staff) and `/api/banq/flags/public`, `PUT /api/banq/flags/:name` (staff).
- **Spec:** NEEDED
- **Dependencies:** None
- **Notes:** Off by default, per the ecosystem convention that unfinished work is invisible. Resolution order: `BANQ_FLAGS` env override (+name / -name) -> the table -> the default, so an operator can overrule the database for one boot without a migration. A flag is deliberately NOT a banq_config value: config holds numbers the engines read, a flag holds whether a surface exists at all. An unknown flag resolves to false rather than throwing, so a typo hides work instead of breaking a page. `banq_service_purchase` stays OFF until a payment rail is connected, so a checkout that does not exist cannot hand out a paid month.

### BANQ-020: Verification Scripts
- **Status:** DONE (2026-09-22) -- four suites, all green, with one entry point: `scripts/verify-all.ps1`.
  - `verify-v1-smoke.cjs` **55 PASS / 0 FAIL** (read-only; needs no credentials)
  - `verify-unified-ad-page.cjs` **18 PASS / 0 FAIL**
  - `verify-banq-identity-bridge.cjs` **55 PASS / 0 FAIL / 1 SKIP**
  - `verify-banq-intelligence.cjs` **129 PASS / 0 FAIL** (proven re-runnable)
- **Spec:** NEEDED
- **Dependencies:** None
- **Notes:** The smoke test's real value is that it asserts CONTENT TYPE and BODY SHAPE, not status codes. Both partner-proxy bugs found on 2026-09-22 returned 200 with a body that was a web page instead of JSON, so a status-only check passed while the feed was empty. Section 3 of the smoke test exists to make that class of failure loud.
- **Spec:** NEEDED
- **Dependencies:** None
- **Notes:** The intelligence verifier is not a file-existence check: it proves the no-hardcoded-threshold rule by changing a weight in banq_config and asserting the health score MOVES, proves the gate over HTTP (402 unpaid / 200 paid / 403 ahead of 402 for a campaign that is not theirs), proves an internal note is never returned to an advertiser request, and asserts the honesty rules (INSUFFICIENT_DATA, observed-vs-factors, cautious prediction language, the word "winner" absent). It creates and resets its own probe accounts, so it can be run repeatedly -- the first version could not, because it mutated the seeded demo advertisers and then depended on their state.

### BANQ-021: Unified Advertising Page Structure
- **Status:** DONE (BANQ standalone half, 2026-09-21) -- built and verified 18 PASS / 0 FAIL; the qwkbrowser half (quanthomnetwork.html + newquanthoms.html popup) remains its own item
- **Spec:** `docs/BANQ-021-IMPLEMENTATION-DESIGN.md` (authoritative) + `docs/BANQ-AD-MONITORING-PARTNERSHIP.md` Section 23
- **Stale warning:** `docs/UNIFIED-AD-PAGE-RESTRUCTURE-TASK.md` (2026-08-29) predates the 2026-09-03 decisions. Its package prices, day durations and QAP-box placement are superseded -- see the design doc Section 1.
- **Dependencies:** BANQ-001, BANQ-004
- **Notes:** Unify all ad placements and packages into one advertising page. Two ways to buy: (1) Build Your Own (Banner, Video, Network Banner, Network Video) and (2) Campaign Packages (Launch, Full Reach). Remove old tier names (Starter/Premium/Sponsored). Popup on newquanthoms.html + BANQ index.html shows partial preview; quanthomnetwork.html shows full details. BANQ Campaign Management opt-in at bottom. Publisher application form on quanthomnetwork.html stays as-is.

---

### BANQ-022: BANQ Intelligence System (4 phases, 37 steps)
- **Status:** DONE (2026-09-22) -- all 37 steps built across `backend/intelligence/` (schema, core, phase1-4, service) plus `backend/banq-intelligence.js`, `js/monitor.js`, `monitor.html`. **129 PASS / 0 FAIL.** Seeded for demo, flags enabled, the purchase path deliberately OFF.
- **Spec:** `docs/BANQ-INTELLIGENCE-IMPLEMENTATION-PLAN.md` (BUILD AUTHORITY -- 37 steps: 4 pre-build + 8 + 8 + 9 + 8) and `docs/BANQ-INTELLIGENCE-SYSTEM.md` (system overview)
- **Dependencies:** BANQ-006 (auth, done). Pre-build step E0.1 requires a DB backup + commit checkpoint per Rule 16.
- **Notes:** Phase 1 MONITOR, Phase 2 UNDERSTAND, Phase 3 LEARN, Phase 4 PLAN. No campaign tables, no creative/journey/experiment tables, no `banq_config` and no `/api/banq/*` namespace exist yet. Full step-by-step inventory in `docs/BANQ-REMAINING-WORK.md` section E.

---

### BANQ-023: BANQ AD SERVICE -- the $15/month monitoring gate (G3 + G4)
- **Status:** DONE (2026-09-22) -- `backend/intelligence/service.js`, table `banq_service_subscriptions` (advertiser-scoped), `banq_revenue_ledger`, `js/monitor.js` + `monitor.html`.
- **Spec:** `docs/BANQ-AD-MONITORING-PARTNERSHIP.md` Section 23.11 (locked decision) + the founder's rule of 2026-09-22.
- **Dependencies:** BANQ-006 (auth, done)
- **Notes:** THE RULE: however much an advertiser is charged on qwkbrowser, access to the BANQ MONITORING tools requires $15 per month in credits or fiat. They may run as many ads as they like; the monitoring fee is one $15 month. So the two financial facts are kept apart -- ad spend is QWK's, the monitoring fee is BANQ's, and it is written to its own ledger with its own settlement status. A second purchase inside an already-paid month is NOT charged again. An unconfirmed payment leaves the gate CLOSED (status OPTED_IN, not ACTIVE), so an unpaid subscription can never open a paid gate and there is no free unlock. Staff bypass the gate, because they deliver the service. Reconciled with the implementation plan's Pre-Step 0.3 reading of `banq_service_subscriptions` (which keyed it per campaign) by adding `advertiser_id` NOT NULL and making `campaign_id` nullable, so one table serves both readings rather than two competing ones.

---

### BANQ-024: QwkBrowser Identity Bridge -- sign in with your QwkBrowser account
- **Status:** DONE (2026-09-22) -- `backend/qwk-identity.js`, `backend/load-env.js`, schema link columns on `users`, the QWK-side `POST /api/auth/verify-credentials`, and `POST /api/auth/sso` on the BANQ side. **55 PASS / 0 FAIL** (`scripts/verify-banq-identity-bridge.cjs`).
- **Spec:** `docs/BANQ-QWK-API-PARTNERSHIP.md` Section 2 (identity model) + `docs/BANQ-REMAINING-WORK.md` Section F.
- **Dependencies:** BANQ-006 (auth, done), QWK-053..058 intact (this is additive on the QWK side).
- **Notes:** THE REPORTED BUG: about.html, dashboard.html and the sign-in card all say "sign in with your QwkBrowser account", and the login only ever compared against BANQ's own `users` table, which holds `banqadmin` and nobody else -- so a real QwkBrowser account came back "Invalid credentials". Now QwkBrowser is the identity authority and BANQ keeps its OWN sessions: two paths in (a signed HMAC handoff token, verified locally with the shared secret, and a server-to-server credential check for the typed form), one mirror row per person (`auth_source='qwk'`, `qwk_user_id`), and the QWK token is never stored -- the verify endpoint deliberately returns no token at all, because a partner login should not leave a QWK session behind. A local account is never shadowed: if a local BANQ row owns the username, there is no bridge fallback. Failures are named (invalid credentials / rate limited / identity_error / identity_unreachable / not configured) instead of being flattened into "login failed".

---

### BANQ-025: Partner Proxy Correctness -- the bugs that made every 200 a lie
- **Status:** DONE (2026-09-22) -- `server.js` (one `pathFilter` proxy registered before `express.json()`, an `/api/*` JSON 404 guard), `js/app.js` (`qwkFetch`), `index.html` (balance + honest earn messages).
- **Spec:** `docs/BANQ-QWK-API-PARTNERSHIP.md` Section 3 (proxy architecture) -- the section was right about intent and silent about the v3 semantics.
- **Dependencies:** BANQ-024 (the sign-in that made this reachable).
- **Notes:** Proven by probe, not by reading. THREE defects, each invisible to a status-code check:
  1. **Prefix stripping.** In http-proxy-middleware v3, mounting at a path strips that path from `req.url` before the proxy runs, so the old `pathRewrite '^/api/ads' -> '/api/ads'` rewrote a prefix that was gone. `/api/ads/public` reached QwkBrowser as `/public?limit=1`; QwkBrowser's SPA fallback answered with ITS HOMEPAGE, status 200. The feed had never received a banner from the proxy -- it received a web page and fell back to mocks.
  2. **Body-parser ordering.** `express.json()` was registered before the proxy. It consumes the request body, so the proxy forwarded headers (including Content-Length) with no body and the upstream waited forever: every GET worked, every POST hung with no error on either side.
  3. **The SPA fallback swallowed the API.** An unknown `/api/*` path returned index.html with a 200. A retired or misspelled endpoint would look like a success and fail while parsing. Now `/api/*` answers JSON 404 (or the upstream's own JSON 404 for proxied prefixes).
  Plus one UI consequence: `BANQ.qwkFetch` was aliased to `BANQ.fetchJson`, which clears the session on any 401. A QwkBrowser 401 therefore signed the person OUT of BANQ on a banner click -- indistinguishable, from the outside, from "the login doesn't work". qwkFetch never clears a BANQ session.

---

## Section 4: Status Summary

| ID | Feature | Status | Spec |
|----|---------|--------|------|
| BANQ-001 | Initial Site Build | DONE | docs/NEW-QUANTHOMS-BILLBOARD-AGENCY.md |
| BANQ-002 | Packages Page | DONE | Inline (packages.html) |
| BANQ-003 | Billboard Interest Sidebar | DONE | Inline |
| BANQ-004 | AD-Packages Popup | DONE | Inline |
| BANQ-005 | Dashboard QAP Integration | DONE | Inline |
| BANQ-006 | Independent Auth System | DONE | backend/auth.js + db.js |
| BANQ-007 | Seed Banner Script | EXISTS IN QWK REPO, NOT RUN (BANQ copy intentionally not created) | qwkbrowser/backend/seed-banners.js |
| BANQ-008 | Doc Rebranding | IN-PROGRESS | All docs in docs/ |
| BANQ-009 | Billboard Declaration Backend | DONE (2026-09-22) | backend/billboards.js |
| BANQ-010 | Contact Form Backend | DONE | backend/banq.js |
| BANQ-011 | QAP Validation Backend | DEFERRED | NEEDED BACKEND Section 3 |
| BANQ-012 | Video Banner Dwell Tracking | PLANNED | NEEDED |
| BANQ-013 | Advertiser Portal | PLANNED | NEEDED |
| BANQ-014 | QwkBrowser API Partnership Design | PLANNED | NEEDED |
| BANQ-015 | Category Filters | DONE (2026-09-22, flag-gated) | backend/banq-intelligence.js `/ads/search` |
| BANQ-016 | Banner Search | DONE (2026-09-22, flag-gated) | backend/banq-intelligence.js `/ads/search` |
| BANQ-017 | User Profile Bar | PARTIAL -- balance displays (verified: 58050 QU / 1 QC); live QWK read waits on F3 | backend/qwk-identity.js (mirror balances) |
| BANQ-018 | Click History | PARTIAL -- frontend wired; the QWK read now REACHES the server but returns 401 for a BANQ token (F3) | index.html + js/app.js qwkFetch |
| BANQ-019 | Feature Flag System | DONE (2026-09-22) | backend/flags.js |
| BANQ-020 | Verification Scripts | **DONE (4 suites, 257 PASS)** | scripts/verify-all.ps1 |
| BANQ-021 | Unified Advertising Page Structure | DONE (BANQ half) | docs/BANQ-021-IMPLEMENTATION-DESIGN.md |
| BANQ-022 | BANQ Intelligence System | **DONE (2026-09-22, 37 steps, 129 PASS)** | docs/BANQ-INTELLIGENCE-IMPLEMENTATION-PLAN.md |
| BANQ-023 | BANQ AD SERVICE $15/month gate (G3+G4) | DONE (2026-09-22) | backend/intelligence/service.js |
| BANQ-024 | QwkBrowser Identity Bridge (sign-in with a QwkBrowser account) | **DONE (2026-09-22, 55 PASS)** | backend/qwk-identity.js + docs/BANQ-QWK-API-PARTNERSHIP.md S2 |
| BANQ-025 | Partner Proxy Correctness (prefix strip, body-parser order, API 404) | **DONE (2026-09-22)** | server.js + js/app.js |

---

## Section 5: Dependency Map

```
BANQ-001 (Initial Build) -----> BANQ-002 (Packages)
BANQ-001 (Initial Build) -----> BANQ-003 (Billboard Interest)
BANQ-001 (Initial Build) -----> BANQ-004 (AD-Packages Popup)
BANQ-002 (Packages) + BANQ-004 (Popup) -> BANQ-005 (Dashboard QAP)
BANQ-001 (Initial Build) -----> BANQ-006 (Independent Auth)
BANQ-001 (Initial Build) -----> BANQ-007 (Seed Banners)
BANQ-006 (Auth) ---------------> BANQ-008 (Doc Rebranding)
BANQ-006 (Auth) ---------------> BANQ-009 (Billboard Declaration)
BANQ-006 (Auth) ---------------> BANQ-010 (Contact Form)
BANQ-006 (Auth) + BANQ-014 (API Partnership) -> BANQ-011 (QAP Validation)
BANQ-001 (Initial Build) ------> BANQ-012 (Video Dwell)
BANQ-005 (Dashboard) + BANQ-011 (QAP) -> BANQ-013 (Advertiser Portal)
BANQ-006 (Auth) ---------------> BANQ-014 (API Partnership Design)
BANQ-001 (Initial Build) -----> BANQ-015 (Category Filters)
BANQ-001 (Initial Build) -----> BANQ-016 (Banner Search)
BANQ-006 (Auth) ---------------> BANQ-017 (User Profile Bar)
BANQ-006 (Auth) ---------------> BANQ-018 (Click History)
BANQ-001 (Initial Build) + BANQ-004 (AD-Packages Popup) -> BANQ-021 (Unified Ad Page)
```

---

## Section 6: Recommended Build Order

DONE since the last revision: BANQ-009, BANQ-015, BANQ-016, BANQ-019, BANQ-022,
BANQ-023 (the $15 gate). What is genuinely left:

1. **F3 -- the reward-token decision (needs the founder).** Everything else in the
   reward path now works: the proxy forwards correctly, the read reaches QWK,
   and the tests prove it. What does NOT work is earning with a BANQ session,
   for a reason that is a design choice and not a bug: QWK answers 401 for a
   BANQ token, and answers 403 `CSRF_MISSING` even for a valid QWK token sent
   from another origin, because its cookie double-submit pattern cannot be
   satisfied off-origin. So either QWK exposes a CSRF-exempt, secret-guarded
   reward path for partners, or BANQ trades its session for a short-lived QWK
   token server-side. Both are decisions about the trust boundary.
2. BANQ-008: Complete doc rebranding (still in progress)
3. G1/G2 (qwkbrowser side): Stripe and R2 -- until they land, every priced
   package stays "SERVICE IS DELAYED FOR TECHNICAL REVIEW" and the media
   requirement check cannot pass for a real creative
4. BANQ-014: QwkBrowser API partnership open items (F1-F4 in
   docs/BANQ-REMAINING-WORK.md)
5. BANQ-011: QAP validation backend (needs the API partnership first)
6. BANQ-017 + BANQ-018: profile bar + click history -- the proxied reads are now
   CONFIRMED live (F1 answered 2026-09-22, and two proxy defects fixed to get
   there). What remains is the F3 token decision in item 1 above.
7. BANQ-012: Video banner dwell tracking (reconcile with decision 23.9 V2
   in-app video cards first -- the two overlap)
8. BANQ-013: Advertiser portal
9. BANQ-007: run the QWK-side banner seed (a QWK task BANQ depends on)
10. The qwkbrowser half of BANQ-021 (quanthomnetwork.html + newquanthoms.html)
11. G5/G6: pre-deploy checklist + responsive audit of the new pages

---

## Section 7: Backend JS Inventory Reference

`docs/BANQ-JS.md` is the plain-English inventory of every .js file.
Each file has a one-line description of what it does.

**Maintenance rule (AGENTS.md Rule 13):**
- When a new .js file is created under `backend/` or `js/`, add it to the
  inventory immediately.
- When a .js file is removed or renamed, update the inventory.
- When a file's purpose changes, update its description.

The inventory is the builder's reference for reviewing and modifying
backend files using natural language. It must always match what is on disk.
