# BANQ -- Master Pipeline & Task Tracker

> Last updated: 2026-08-26
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
- **Status:** DEFERRED
- **Spec:** `NEEDED BACKEND FOR BANQ WEBSITE.md` Section 1
- **Dependencies:** BANQ-006
- **Notes:** POST /api/billboards/declare (city, country, billboard_type, message). New table: billboard_declarations. GET /api/billboards/interest (top cities by count, last 7 days). GET /api/billboards/demand (all declarations for admin). Auth required. Without this, Billboard Interest sidebar uses placeholder data and demand stats table is static.

### BANQ-010: Contact Form Backend
- **Status:** DEFERRED
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
- **Status:** PLANNED
- **Spec:** NEEDED
- **Dependencies:** None
- **Notes:** Formal flag system (js/flags.js + backend/flags.js) when project grows. See PRE-DEPLOY.md Section 2 for current state.

### BANQ-020: Verification Scripts
- **Status:** PLANNED
- **Spec:** NEEDED
- **Dependencies:** None
- **Notes:** PowerShell verification scripts in scripts/ following naming convention: verify-v{number}-{feature}.ps1. Start with smoke test: verify-v1-smoke.ps1 (all pages load, auth works, proxy reaches QWK).

### BANQ-021: Unified Advertising Page Structure
- **Status:** DONE (BANQ standalone half, 2026-09-21) -- built and verified 18 PASS / 0 FAIL; the qwkbrowser half (quanthomnetwork.html + newquanthoms.html popup) remains its own item
- **Spec:** `docs/BANQ-021-IMPLEMENTATION-DESIGN.md` (authoritative) + `docs/BANQ-AD-MONITORING-PARTNERSHIP.md` Section 23
- **Stale warning:** `docs/UNIFIED-AD-PAGE-RESTRUCTURE-TASK.md` (2026-08-29) predates the 2026-09-03 decisions. Its package prices, day durations and QAP-box placement are superseded -- see the design doc Section 1.
- **Dependencies:** BANQ-001, BANQ-004
- **Notes:** Unify all ad placements and packages into one advertising page. Two ways to buy: (1) Build Your Own (Banner, Video, Network Banner, Network Video) and (2) Campaign Packages (Launch, Full Reach). Remove old tier names (Starter/Premium/Sponsored). Popup on newquanthoms.html + BANQ index.html shows partial preview; quanthomnetwork.html shows full details. BANQ Campaign Management opt-in at bottom. Publisher application form on quanthomnetwork.html stays as-is.

---

### BANQ-022: BANQ Intelligence System (4 phases, 37 steps)
- **Status:** NOT STARTED (verified 2026-09-21). Both intelligence docs referenced this row; it did not exist until now.
- **Spec:** `docs/BANQ-INTELLIGENCE-IMPLEMENTATION-PLAN.md` (BUILD AUTHORITY -- 37 steps: 4 pre-build + 8 + 8 + 9 + 8) and `docs/BANQ-INTELLIGENCE-SYSTEM.md` (system overview)
- **Dependencies:** BANQ-006 (auth, done). Pre-build step E0.1 requires a DB backup + commit checkpoint per Rule 16.
- **Notes:** Phase 1 MONITOR, Phase 2 UNDERSTAND, Phase 3 LEARN, Phase 4 PLAN. No campaign tables, no creative/journey/experiment tables, no `banq_config` and no `/api/banq/*` namespace exist yet. Full step-by-step inventory in `docs/BANQ-REMAINING-WORK.md` section E.

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
| BANQ-009 | Billboard Declaration Backend | DEFERRED | NEEDED BACKEND Section 1 |
| BANQ-010 | Contact Form Backend | DEFERRED | NEEDED BACKEND Section 2 |
| BANQ-011 | QAP Validation Backend | DEFERRED | NEEDED BACKEND Section 3 |
| BANQ-012 | Video Banner Dwell Tracking | PLANNED | NEEDED |
| BANQ-013 | Advertiser Portal | PLANNED | NEEDED |
| BANQ-014 | QwkBrowser API Partnership Design | PLANNED | NEEDED |
| BANQ-015 | Category Filters | PLANNED | NEEDED |
| BANQ-016 | Banner Search | PLANNED | NEEDED |
| BANQ-017 | User Profile Bar | PLANNED | NEEDED |
| BANQ-018 | Click History | PLANNED | NEEDED |
| BANQ-019 | Feature Flag System | PLANNED | NEEDED |
| BANQ-020 | Verification Scripts | PLANNED | NEEDED |
| BANQ-021 | Unified Advertising Page Structure | DONE (BANQ half) | docs/BANQ-021-IMPLEMENTATION-DESIGN.md |
| BANQ-022 | BANQ Intelligence System | NOT STARTED (37 steps) | docs/BANQ-INTELLIGENCE-IMPLEMENTATION-PLAN.md |

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

1. BANQ-008: Complete doc rebranding (in progress)
2. BANQ-014: QwkBrowser API partnership design (discuss with Chris)
3. BANQ-007: Run seed banner script (quick win)
4. BANQ-009: Billboard declaration backend (unblocks real interest data)
5. BANQ-010: Contact form backend (quick win)
6. BANQ-011: QAP validation backend (needs API partnership first)
7. BANQ-012: Video banner dwell tracking
8. BANQ-017: User profile bar (needs proxy to QWK profile)
9. BANQ-018: Click history (needs proxy to QWK ads history)
10. BANQ-015: Category filters
11. BANQ-016: Banner search
12. BANQ-020: Verification scripts
13. BANQ-019: Feature flag system (when needed)
14. BANQ-021: Unified advertising page structure (restructure packages.html + quanthomnetwork.html)
15. BANQ-013: Advertiser portal (Phase 3)

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
