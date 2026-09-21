# BANQ -- WHAT REMAINS (complete inventory)

> **Created:** 2026-09-21
> **Purpose:** one numbered place to see everything still to do on
> www.newquanthoms.com, and how much of it is done. Every item names the doc and
> section that owns it, so nothing here is a second spec.
> **Rule:** this file is an INDEX, not an authority. Where it disagrees with a
> spec, the spec wins and this file gets corrected.
> **Why it exists:** the BANQ-021 work was completed in isolation. This is the
> rest of the project, including the four-phase Intelligence System that has a
> full build plan and no code.

---

## 0. WHAT IS ACTUALLY ON DISK TODAY

Verified by reading the repo, not from notes:

| File | Lines | Does |
|---|---|---|
| `server.js` | ~70 | Express on 3002, local auth, proxies `/api/ads`, `/api/profile`, now `/api/ad-profile` |
| `backend/db.js` | 78 | SQLite `data/banq.db`, 2 tables (`users`, `sessions`), seeds `banqadmin` |
| `backend/auth.js` | 123 | login / me / logout, UUIDv4 token, SHA-256, 7-day sessions |
| `js/app.js` | 137 | `window.BANQ` -- token, fetchJson, toast, utils |
| `js/ad-catalog.js` | NEW | the advertising catalog (BANQ-021) |
| `js/ad-page.js` | NEW | the two renderers (BANQ-021) |
| Pages | 6 | index, login, dashboard, billboards, packages, about |
| `css/styles.css` | ~730 | dark theme, gold accent, `banq-` prefix |

**Tables that do NOT exist:** campaign tables, BANQ service subscription tables,
creative tables, journey tables, experiment tables, benchmark tables, forecast
tables, `banq_config`. **Routes that do NOT exist:** the whole `/api/banq/*`
namespace.

---

## A. DONE (with evidence)

| # | Item | Evidence |
|---|---|---|
| A1 | Initial site build (BANQ-001) | committed 5c3be7d, 6 pages serving |
| A2 | Independent auth (BANQ-006) | `backend/auth.js` + `db.js`, separate from QWK |
| A3 | Packages page, billboard sidebar, AD-Packages popup, dashboard QAP banner (BANQ-002..005) | inline, working |
| A4 | **BANQ-021 unified ad page -- BANQ standalone half** | `js/ad-catalog.js` + `js/ad-page.js` + rebuilt `packages.html` + popup + `verify-unified-ad-page.cjs` **18 PASS / 0 FAIL**, live on 3002. Committed db854a4, pushed. |
| A5 | **Contact path is honest and real (C3)** | `backend/banq.js` + two tables + `admin-console.html`; the form only claims success on a stored row. Verified live 8/8: store, 429 rate limit, honeypot-as-spam, 401 without admin token, list, stats, status update, honest notification retry. |
| A6 | **Doc truth pass** | Phantom seed-script claim corrected in both source docs; intelligence scope reconciled to one authority (37 steps); repo AGENTS.md gained wing rules WR-1/WR-2. Commits 67c3716, d9c41aa. |

---

## B. BANQ-021 -- REMAINING (the qwkbrowser half)

| # | Item | Where | Blocked by |
|---|---|---|---|
| B1 | `quanthomnetwork.html` -> full unified ad page (hero rename, launch buttons on the 4 placements, the 2 campaign packages, BANQ CTA, publisher intake form, reworded exclusion notice) | `qwkbrowser/frontend/` | nothing -- ready |
| B2 | `newquanthoms.html` popup -> partial preview of the same six entries | `qwkbrowser/frontend/` | B1 (share the copy) |
| B3 | App chrome on `quanthomnetwork.html` (header + `topbar-chips.js` -- currently loads none) | `qwkbrowser/frontend/` | nothing |
| B4 | The six-step launch flow on the QWK side (QAP entry -> profile summary -> media check -> BANQ opt-in -> order preview -> technical-review notice) | `qwkbrowser/frontend/js/qap-launch.js` | nothing to build, but ends at the delayed state until R2/Stripe (G1/G2) |
| B5 | The drift alarm, QWK side: assert `quanthomnetwork.html` copy matches `PACKAGE_TIERS` | qwkbrowser verify scripts | B1 |

---

## C. DEFERRED BACKENDS (pipeline BANQ-007, 009, 010, 011)

| # | Item | Spec | Notes |
|---|---|---|---|
| C1 | Banner seed data (BANQ-007) | `NEEDED BACKEND...` S4 | RESOLVED AS A DOC BUG, NOT A BANQ TASK. The script is real (85 lines, 8 `[DEMO]` banners, idempotent) but lives at `qwkbrowser/backend/seed-banners.js` -- the BANQ-local path the docs claimed has never existed. It is therefore a QWK-side step to run, NOT a BANQ file to create: seeding `ad_banners` from BANQ would cross the ownership boundary between the two apps. BANQ reads the result through `/api/ads/*`. Until it is run, the feed shows demo mocks. |
| C2 | Billboard declaration backend (BANQ-009): `POST /api/billboards/declare`, `GET /interest`, `GET /demand` + `billboard_declarations` table | `NEEDED BACKEND...` S1 | sidebar + demand table are placeholder until this lands |
| C3 | ~~Contact form backend (BANQ-010)~~ | `NEEDED BACKEND...` S2 | **DONE 2026-09-21.** `POST /api/banq/contact` + `contact_messages` + `contact_notifications`, honeypot, 30s/IP rate limit, admin list/stats/status/delete/retry at `/api/banq/contact/*`, `admin-console.html`. The form no longer claims success without a stored row. Verified live: 8/8 checks. |
| C4 | QAP launch backend (BANQ-011): `POST /api/ads/launch-with-qap` reachable via BANQ proxy | `NEEDED BACKEND...` S3 | the QWK endpoint EXISTS and the proxy now reaches it; what is missing is the client sending a valid catalog key (B4) |

---

## D. PIPELINE ITEMS NOT YET STARTED (BANQ-012..020)

| # | Item | Notes |
|---|---|---|
| D1 | BANQ-012 video banner dwell tracking (3s dwell -> impression -> QC) | superseded in part by 23.9 V2 in-app video cards with server-validated watch sessions -- reconcile before building |
| D2 | BANQ-013 advertiser portal (per-campaign impressions, clicks, CTR, spend) | depends on C4 + G1 |
| D3 | BANQ-014 QwkBrowser API partnership design | partially answered by `BANQ-QWK-API-PARTNERSHIP.md`; the open parts are in Section F |
| D4 | BANQ-015 category filters on the feed | small |
| D5 | BANQ-016 banner search | small |
| D6 | BANQ-017 user profile bar (QU/QC balance from proxied `/api/profile/*`) | needs F1 |
| D7 | BANQ-018 click history (proxied `/api/ads/clicks/history`) | needs F1 |
| D8 | BANQ-019 feature flag system (`js/flags.js` + `backend/flags.js`) | the ecosystem convention is flags OFF by default so unfinished work is invisible |
| D9 | BANQ-020 verification scripts | STARTED: `verify-v1-unified-ad-page.ps1` exists; the smoke test (`verify-v1-smoke`) and the rest do not |

---

## E. THE INTELLIGENCE SYSTEM -- THE FOUR PHASES (nothing built)

Authority: `docs/BANQ-INTELLIGENCE-IMPLEMENTATION-PLAN.md` (2232 lines, 37 steps)
and `docs/BANQ-INTELLIGENCE-SYSTEM.md` (the overview). The four phases are the
"four sections":

```
PHASE 1 -- MONITOR     "How is my campaign doing?"
PHASE 2 -- UNDERSTAND  "What changed and what should I consider?"
PHASE 3 -- LEARN       "What happens across the journey, what can we test?"
PHASE 4 -- PLAN        "What could happen, what should we prepare?"
```

Status of every step: **NOT STARTED.** The plan's own "Current State of the BANQ
Codebase" confirms it -- no campaign tables, no `/api/banq/*`.

### E0. Pre-build (HIGH RISK -- Rule 16: back up DB, commit checkpoint before and after)

| # | Step | Status |
|---|---|---|
| E0.1 | Backup database | TODO |
| E0.2 | `banq_config` table | TODO |
| E0.3 | Core campaign tables | TODO |
| E0.4 | `/api/banq/*` route namespace | TODO |

### E1. Phase 1 -- MONITOR (8 steps + infrastructure)

| # | Step | Weight |
|---|---|---|
| E1.1 | Campaign Notes (1 table, CRUD) | EASIEST |
| E1.2 | Campaign Timeline (append-only event log) | |
| E1.3 | Campaign Goals (UI + calculation) | |
| E1.4 | Budget Pacer | |
| E1.5 | Campaign Dashboard (pulls 1.1-1.4 together) | |
| E1.6 | BANQ Watch -- alert system (evaluation, lifecycle, cooldown) | |
| E1.7 | Campaign Health Score (weighted scoring) | |
| E1.8 | BANQ Report Card | HEAVIEST (depends on all of Phase 1) |

### E2. Phase 2 -- UNDERSTAND (8 steps)

| # | Step | Weight |
|---|---|---|
| E2.1 | Creative Intelligence (foundational data) | EASIEST |
| E2.2 | Creative Performance Score | |
| E2.3 | What Changed? (comparison analysis) | |
| E2.4 | Ad Fatigue Detector | |
| E2.5 | Creative Battle (comparison UI + logic) | |
| E2.6 | BANQ Recommends (recommendation engine) | |
| E2.7 | Recommendation Approval Flow | |
| E2.8 | BANQ Action Center (unified workspace) | HEAVIEST |

### E3. Phase 3 -- LEARN (9 steps)

| # | Step | Weight |
|---|---|---|
| E3.1 | Journey Event Types and Tracking (data only) | EASIEST |
| E3.2 | Journey Configuration (setup UI) | |
| E3.3 | Journey Drop-Off Analysis | |
| E3.4 | Experiment Lab (creation + management) | |
| E3.5 | Experiment Results (min-data rules) | |
| E3.6 | Campaign Benchmarking (privacy-critical aggregation) | |
| E3.7 | Cross-Campaign Intelligence (pattern detection) | |
| E3.8 | Enterprise Multi-Brand Dashboard (permissions) | |
| E3.9 | BANQ Team Workspace | HEAVIEST |

### E4. Phase 4 -- PLAN (8 steps)

| # | Step | Weight |
|---|---|---|
| E4.1 | Campaign Readiness Check (checklist + scoring) | EASIEST |
| E4.2 | Campaign Planner (planning workspace) | |
| E4.3 | Automated Reporting (generation + scheduling) | |
| E4.4 | Placement Intelligence (profiles + comparison) | |
| E4.5 | Predictive Alerts | |
| E4.6 | Scenario Simulator (what-if) | |
| E4.7 | Forecast Engine (confidence, versioned) | |
| E4.8 | BANQ Go-To-Market Workspace | HEAVIEST |

**Two rules that apply to every step in E**: the Phase 4 AI architecture rule and
the human-override rule (`BANQ-INTELLIGENCE-IMPLEMENTATION-PLAN.md` Phase 4) --
an intelligence layer that cannot be overridden by a human is not shippable.

**Discrepancy to resolve:** `BANQ-INTELLIGENCE-SYSTEM.md`'s change log says "20
tools across 4 phases"; the implementation plan contains 37 steps. Same phases,
different counting. The plan is the build authority; the overview needs its count
corrected so nobody plans against the smaller number.

---

## F. API PARTNERSHIP -- OPEN ITEMS

Authority: `docs/BANQ-QWK-API-PARTNERSHIP.md`.

| # | Item | Status |
|---|---|---|
| F1 | Confirm the proxied reads the frontend depends on (`/api/profile/*` balance, `/api/ads/*` feed and click) are actually live on 3001 | UNVERIFIED since the partnership doc was written |
| F2 | `11.6 Video Banner Content` | explicitly DEFERRED in the doc; now overlaps 23.9 V2 video cards -- reconcile |
| F3 | Reward flow end to end (click -> units -> balance visible on BANQ) | designed, not proven live |
| F4 | CORS / proxy boundary re-check now that `/api/ad-profile` was added | new this session; the proxy works, CORS was never needed for server-side proxying but confirm |

---

## G. GATES AND INFRASTRUCTURE (nothing on the site activates until these land)

| # | Gate | Consequence if missing |
|---|---|---|
| G1 | **Stripe** (checkout for the 5 ad products + the $15/mo BANQ service) | every priced package stays "SERVICE IS DELAYED FOR TECHNICAL REVIEW" |
| G2 | **R2 / object storage** (image + video creative upload) | the media requirement check cannot pass for a real creative; profiles stay url-only and correctly fail |
| G3 | BANQ service subscription record (one per advertiser per month, `credits` or `fiat`) | the $15 gate on monitoring tools has nowhere to live |
| G4 | BANQ monitoring dashboard (the tools the $15 buys) + locked state | the subscription would gate nothing |
| G5 | Pre-deploy checklist (`docs/PRE-DEPLOY.md`) | no release discipline |
| G6 | Responsive audit of the new ad page against `docs/RESPONSIVE-BREAKPOINTS.md` | the new grid has a 2-column and 1-column rule added but never checked on a phone |
| G7 | Commit checkpoints (`docs/COMMIT-CHECKPOINTS.md`) | the log exists and is stale/empty. Phase 1-3 work is committed and pushed (db854a4, 67c3716, d9c41aa); the log itself should be updated per change from now on |

---

## H. RECOMMENDED ORDER

1. **C1** -- run the seed script (one command, makes the feed real).
2. **G7** -- commit the BANQ-021 work; it is the only finished, verified thing on disk.
3. **B1 + B2 + B3** -- finish BANQ-021 by building the qwkbrowser half, so the marketplace is consistent on both sides.
4. **C3** -- contact form backend: the site currently claims success and discards the message.
5. **C2** -- billboard declaration backend: turns placeholder interest data into real demand.
6. **G5 + D8 + G6** -- release discipline, feature flags, responsive pass.
7. **E0 -> E1** -- start the Intelligence System with the database foundation, then Phase 1's easiest step (campaign notes), because every later phase depends on campaign data existing.
8. **G1 + G2 + G3 + G4** -- the money rail and the monitoring tools it pays for.
9. **E2 -> E4** -- the remaining intelligence phases, in order.
10. **D1-D9** -- the smaller pipeline items, D1 reconciled with 23.9 V2 first.

---

## I. CHANGE LOG

| Date | Change |
|---|---|
| 2026-09-21 | Phases 1-3 of the four-problem plan executed: contact form made honest then given a real backend (C3 DONE), phantom seed-script claim corrected in the source docs, intelligence scope reconciled to one build authority, and the two wing rules added to AGENTS.md. All pushed. |
| 2026-09-21 | File created. Full remaining-work inventory: BANQ-021 QWK half, 4 deferred backends, 9 pipeline items, the 37-step four-phase Intelligence System (none built), open API-partnership items, and the seven infrastructure gates. Nothing built by this document; it is an index. |

---

## END OF BANQ REMAINING WORK
