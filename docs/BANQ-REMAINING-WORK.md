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
| `server.js` | ~150 | Express on 3002, local auth, ONE `pathFilter` proxy for `/api/ads`, `/api/profile`, `/api/ad-profile` (registered BEFORE `express.json()`), `/api/*` JSON 404, SPA fallback for pages |
| `backend/db.js` | ~150 | SQLite `data/banq.db`, users + sessions + contact tables, `ensureColumn()` migrations, QwkBrowser link columns, seeds `banqadmin` |
| `backend/auth.js` | ~250 | login (local, then the QwkBrowser bridge) / sso / me / logout, 32-byte token, SHA-256, 7-day sessions |
| `backend/qwk-identity.js` | NEW | the QwkBrowser identity bridge (BANQ-024) |
| `backend/load-env.js` | NEW | dependency-free `.env` loader (the .env previously did nothing) |
| `backend/intelligence/*` | NEW | the four-phase system (BANQ-022) |
| `js/app.js` | ~200 | `window.BANQ` -- token, `fetchJson`, `qwkFetch` (no session clearing), `sso`, toast, utils |
| `js/ad-catalog.js` | NEW | the advertising catalog (BANQ-021) |
| `js/ad-page.js` | NEW | the two renderers (BANQ-021) |
| `js/monitor.js` | NEW | the monitor dashboard (BANQ-023) |
| Pages | 8 | index, login, dashboard, billboards, packages, about, monitor, admin-console |
| `css/styles.css` | ~765 | dark theme, gold accent, `banq-` prefix, `<=480px` phone tier |
| `scripts/` | 7 | 4 verifiers + `verify-all.ps1` + 2 seed/helper scripts |

**Built since the first version of this list:** the whole `/api/banq/*`
namespace and all 51 intelligence tables (section E is historical). What is
still absent is not a table or a route -- it is the F3 token decision below.

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
| A7 | **QwkBrowser sign-in actually works (BANQ-024)** | `backend/qwk-identity.js` + QWK `POST /api/auth/verify-credentials` + BANQ `POST /api/auth/sso`. Live: the founder's own account signs in on 3002 and `/auth/me` returns it with balances (58050 QU / 1 QC). 55 PASS / 0 FAIL. |
| A8 | **The partner proxy tells the truth (BANQ-025)** | Three defects found by probing bodies, not statuses: hpm v3 mount-path stripping sent `/api/ads/public` to QWK as `/public?limit=1` and got QWK's HOMEPAGE with a 200; `express.json()` before the proxy made every POST hang forever; the SPA fallback swallowed unknown `/api/*` paths. All three fixed and now asserted by the smoke test. |
| A9 | **Verification has one entry point (BANQ-020)** | `scripts/verify-all.ps1` runs four suites: smoke 55, unified ad page 18, identity bridge 55, intelligence 129 -- **257 PASS / 0 FAIL**. |
| A10 | **Responsive audit done (G6)** | Every page overflowed horizontally at phone width (document 728px on a 373px viewport). Fixed with a `<=480px` tier per BANQ-RB-001; verified at 373/390 and 768 on six pages. |

---

## B. BANQ-021 -- REMAINING (the qwkbrowser half)

| # | Item | Where | Blocked by |
|---|---|---|---|
| B1 | `quanthomnetwork.html` -> full unified ad page (hero rename, launch buttons on the 4 placements, the 2 campaign packages, BANQ CTA, publisher intake form, reworded exclusion notice) | `qwkbrowser/frontend/` | nothing -- ready |
| B2 | `newquanthoms.html` popup -> partial preview of the same six entries | `qwkbrowser/frontend/` | B1 (share the copy) |
| B3 | App chrome on `quanthomnetwork.html` (header + `topbar-chips.js` -- currently loads none) | `qwkbrowser/frontend/` | nothing |
| B4 | The six-step launch flow on the QWK side (QAP entry -> profile summary -> media check -> BANQ opt-in -> order preview -> technical-review notice) | `qwkbrowser/frontend/js/qap-launch.js` | nothing to build, but ends at the delayed state until R2/Stripe (G1/G2) |
| B5 | The drift alarm, QWK side: assert `quanthomnetwork.html` copy matches `PACKAGE_TIERS` | qwkbrowser verify scripts | B1 |

**Note:** B1-B5 are all in the **qwkbrowser** repo, not this one. Nothing in
this section can be done from `www.newquanthoms.com`.

---

## C. DEFERRED BACKENDS (pipeline BANQ-007, 009, 010, 011)

| # | Item | Spec | Notes |
|---|---|---|---|
| C1 | Banner seed data (BANQ-007) | `NEEDED BACKEND...` S4 | RESOLVED AS A DOC BUG, NOT A BANQ TASK. The script is real (85 lines, 8 `[DEMO]` banners, idempotent) but lives at `qwkbrowser/backend/seed-banners.js` -- the BANQ-local path the docs claimed has never existed. It is therefore a QWK-side step to run, NOT a BANQ file to create: seeding `ad_banners` from BANQ would cross the ownership boundary between the two apps. BANQ reads the result through `/api/ads/*`. Until it is run, the feed shows demo mocks. |
| C2 | Billboard declaration backend (BANQ-009): `POST /api/billboards/declare`, `GET /interest`, `GET /demand` + `billboard_declarations` table | `NEEDED BACKEND...` S1 | **DONE 2026-09-22** (`backend/billboards.js`). Demand is ranked by DISTINCT advertisers, never row count, so one advertiser clicking repeatedly cannot manufacture demand. |
| C3 | ~~Contact form backend (BANQ-010)~~ | `NEEDED BACKEND...` S2 | **DONE 2026-09-21.** `POST /api/banq/contact` + `contact_messages` + `contact_notifications`, honeypot, 30s/IP rate limit, admin list/stats/status/delete/retry at `/api/banq/contact/*`, `admin-console.html`. The form no longer claims success without a stored row. Verified live: 8/8 checks. |
| C4 | QAP launch backend (BANQ-011): `POST /api/ads/launch-with-qap` reachable via BANQ proxy | `NEEDED BACKEND...` S3 | the QWK endpoint EXISTS and the proxy now reaches it; what is missing is the client sending a valid catalog key (B4) |

---

## D. PIPELINE ITEMS NOT YET STARTED (BANQ-012..020)

| # | Item | Notes |
|---|---|---|
| D1 | BANQ-012 video banner dwell tracking (3s dwell -> impression -> QC) | superseded in part by 23.9 V2 in-app video cards with server-validated watch sessions -- reconcile before building |
| D2 | BANQ-013 advertiser portal (per-campaign impressions, clicks, CTR, spend) | MADE LARGELY REDUNDANT by BANQ-023: the monitor dashboard now shows per-campaign health, pacing, creative performance and reporting. What is left of this item is only the QWK-side data pull, and it depends on C4 + G1. |
| D3 | BANQ-014 QwkBrowser API partnership design | partially answered by `BANQ-QWK-API-PARTNERSHIP.md`; the open parts are in Section F |
| D4 | BANQ-015 category filters on the feed | **DONE 2026-09-22** -- `GET /api/banq/ads/search`, flag `ads_feed_filters` (OFF by default). Reads the QWK feed and filters it; when the feed is unreachable it says `FEED_UNAVAILABLE` instead of returning an empty list that would read as "no ads match". |
| D5 | BANQ-016 banner search | **DONE 2026-09-22** -- same endpoint (`q=` + `category=`), which is why D4 and D5 share one implementation rather than two filter paths. |
| D6 | BANQ-017 user profile bar (QU/QC balance) | **PARTIAL 2026-09-22** -- the bar is live and shows REAL balances, read from BANQ's own mirrored account (synced from QwkBrowser at sign-in) because the live QWK read needs a QWK token (F3). Confirmed on screen: 58050 QU / 1 QC. |
| D7 | BANQ-018 click history (proxied `/api/ads/clicks/history`) | **PARTIAL 2026-09-22** -- frontend wired and the call now reaches QwkBrowser correctly (F1 answered), but QWK answers 401 for a BANQ token (F3). Same single blocker as D6. |
| D8 | BANQ-019 feature flag system (`js/flags.js` + `backend/flags.js`) | **DONE 2026-09-22** -- `backend/flags.js` + `banq_feature_flags`. OFF by default; env override -> table -> default. Deliberately separate from `banq_config`: config holds numbers, a flag holds whether a surface exists. |
| D9 | BANQ-020 verification scripts | **DONE 2026-09-22** -- four suites and one entry point: `verify-v1-smoke.cjs` (55) + `verify-unified-ad-page.cjs` (18) + `verify-banq-identity-bridge.cjs` (55) + `verify-banq-intelligence.cjs` (129) = **257 PASS / 0 FAIL**, all four reachable through `scripts/verify-all.ps1` (exits non-zero if any suite fails). |

---

## E. THE INTELLIGENCE SYSTEM -- BUILT 2026-09-22 (all 37 steps)

> **STATUS CHANGED: the rest of this section is historical.** All 37 steps were
> built on 2026-09-22 and `scripts/verify-banq-intelligence.cjs` proves it (129
> PASS / 0 FAIL). The step list is kept because it is still the map of what
> exists, but nothing below is outstanding.

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
| F1 | Confirm the proxied reads the frontend depends on (`/api/profile/*` balance, `/api/ads/*` feed and click) are actually live on 3001 | **ANSWERED 2026-09-22 -- and the answer was no.** They LOOKED live (every path returned 200) but the bodies were wrong: the proxy had rewritten the path and QwkBrowser's SPA fallback was answering with its homepage HTML. See A8 and BANQ-025. After the fix `/api/ads/public` returns real JSON banners through the proxy. |
| F2 | `11.6 Video Banner Content` | still overlaps 23.9 V2 video cards -- reconcile before building (unchanged) |
| F3 | Reward flow end to end (click -> units -> balance visible on BANQ) | **BLOCKED -- NEEDS A FOUNDER DECISION.** Proven by probe: (a) a BANQ token gets `401 Session expired or invalid` from QWK -- BANQ sessions are not QWK sessions; (b) even a VALID QWK token gets `403 CSRF_MISSING`, because QWK's click endpoint requires the cookie double-submit pair and a cross-origin page can never hold the `qwk_csrf` cookie. So no BANQ page can award its own rewards today, and this is a trust-boundary choice, not a bug to patch quietly. Two options: **A** -- QWK exposes a CSRF-exempt, secret-guarded reward path for partners (BANQ's server proxies the click, identity proven by the shared secret); **B** -- BANQ trades its session for a short-lived QWK token server-side and injects it on the proxied earn calls (the QWK token is then held by BANQ's server, not the browser). Recommendation: **A**, because it keeps the QWK token out of both the browser and BANQ's storage, and because the secret already exists for the sign-in bridge. Until this is answered, the earn button says "Earning not live yet" and never claims a reward it did not pay. |
| F4 | CORS / proxy boundary re-check now that `/api/ad-profile` was added | **ANSWERED 2026-09-22** -- no CORS is involved and none is needed: the browser calls BANQ's own origin and BANQ's SERVER proxies onward, so there is never a cross-origin browser request. What the re-check DID find is that `pathFilter` (not a mounted path) is what makes v3 forward the full path, and that the proxy must sit before the body parser. |

---

## G. GATES AND INFRASTRUCTURE (nothing on the site activates until these land)

> **Where these gates are actually asked for:** every item below that needs a
> decision, a key or an approval from the founder is queued in
> **`qwkbrowser/docs/FOUNDERS-ACTIONS.md`** under the Mandated Founder Actions
> rule (Rule 74). The queue is the request; this table is the map. Do not ask in
> chat only -- an ask that lives only in a transcript is an ask nobody acts on.

| # | Gate | Consequence if missing |
|---|---|---|
| G1 | **Stripe** (checkout for the 5 ad products + the $15/mo BANQ service) | every priced package stays "SERVICE IS DELAYED FOR TECHNICAL REVIEW" |
| G2 | **R2 / object storage** (image + video creative upload) | the media requirement check cannot pass for a real creative; profiles stay url-only and correctly fail |
| G3 | BANQ service subscription record (one per advertiser per month, `credits` or `fiat`) | **DONE 2026-09-22** -- `banq_service_subscriptions` (advertiser-scoped) + `banq_revenue_ledger`. Payment is recorded ONLY on confirmation, so an unpaid row cannot open the gate. |
| G4 | BANQ monitoring dashboard (the tools the $15 buys) + locked state | **DONE 2026-09-22** -- `monitor.html` + `js/monitor.js`, five tabs across all four phases, with a locked state that explains what the fee buys instead of showing an error. |
| G5 | Pre-deploy checklist (`docs/PRE-DEPLOY.md`) | no release discipline |
| G6 | Responsive audit of the new ad page against `docs/RESPONSIVE-BREAKPOINTS.md` | **DONE 2026-09-22.** Measured, not eyeballed: at 390px the document was 728px wide on a 373px viewport, so EVERY page scrolled sideways. Cause was the shared header (a no-wrap flex row) plus the nav being hidden only at <=375px -- the entire 376-480 band had no phone rules. A `<=480px` tier now exists per the standard (container padding 12px, titles 20px, stat values 18px, wide tables scroll inside their own box, funnel rows stack) and it is placed BEFORE the 375px block so the tighter rule still wins. Verified at 373/390/768 on index, packages, monitor (unlocked, with a wide table), billboards, dashboard, about. **Second pass caught a trap in the first fix:** monitor.html and dashboard.html define their classes in their OWN `<style>` blocks, which the browser applies AFTER the linked stylesheet, so an equally specific override written in `css/styles.css` LOSES and is dead. The monitor's stat value measured 22px at 390px with the override in place. The page-specific rules were moved into the page that owns them; stat value is now 18px, label 9px, tabs 9px/11px, and a funnel row collapses to one column (measured: a single 373px track). |
| G7 | Commit checkpoints (`docs/COMMIT-CHECKPOINTS.md`) | log kept current through 2026-09-22, including the pre-change checkpoint for the schema work and a bug table. **Everything from the intelligence build onward is still UNCOMMITTED.** |
| G8 | **The reward token model (F3)** | the single founder decision blocking D6/D7 and the site's "earn" promise |

---

## H. RECOMMENDED ORDER (revised 2026-09-22)

**Done since this list was written:** C1 (doc bug corrected), C2, C3, D4, D5, D8,
E0, E1, E2, E3, E4, G3, G4, and most of G7.

**Done since this list was written:** C1 (doc bug corrected), C2, C3, D4, D5, D8,
E0, E1, E2, E3, E4, G3, G4, and most of G7.

**Also done 2026-09-22 (this session):** A7 (QwkBrowser sign-in), A8 (partner
proxy correctness), A9 (one verification entry point, 257 PASS), A10 (G6
responsive audit), D6/D7 partial, D9, F1, F4.

What is genuinely left, in order:

1. **F3 / G8 -- THE ONE DECISION THAT UNBLOCKS THE REST (founder).** The
   identity bridge works and the proxy is correct, so the only thing between
   the site and its own "earn rewards" promise is how a BANQ session is allowed
   to earn: a CSRF-exempt secret-guarded partner reward path on the QWK side
   (recommended), or a server-side token exchange. Details and the raw evidence
   are in section F, row F3.
2. **G7** -- commit. Everything from the intelligence build onward is verified
   and uncommitted; the log in `docs/COMMIT-CHECKPOINTS.md` is the rollback map.
3. **G1 + G2** -- Stripe and R2. These are the two gates holding the entire ad
   marketplace in its "delayed for technical review" state, and they are the
   reason `banq_service_purchase` is still OFF.
4. **B1 + B2 + B3 + B4 + B5** -- the qwkbrowser half of BANQ-021. None of it is
   this repo, and all of it is still untouched.
5. **C4 / BANQ-011** -- QAP launch backend, which needs the API partnership and
   the same decision as F3 for the earn-half of the flow.
6. **D1** -- reconcile video dwell tracking with decision 23.9 V2 before building.
7. **D2** -- now largely covered by the monitor dashboard; scope it down before
   starting anything.
8. **F2** -- the remaining API-partnership item (video banner content overlap).

---

## I. CHANGE LOG

| Date | Change |
|---|---|
| 2026-09-22 | **F3 UNBLOCKED AND BUILT: the reward half of the identity bridge.** New: QWK `POST /api/ads/partner/reward` (CSRF-exempt by prefix, secret-guarded, IP-allowlisted, per-wing-user and per-recipient limits, idempotent on `(partner, external_user_id, reward_id)` via a unique index, one audit row before the payout is claimed, self-reward blocked) and BANQ `backend/earn.js` (`POST /api/earn/click`, `GET /api/earn/status`, `GET /api/earn/history`). The payout is not reimplemented -- it calls `db.clickBanner`, so banner cooldown, daily budget, kill-switch and reward economics stay in one place. `scripts/verify-banq-partner-reward.cjs` 29 PASS / 0 FAIL, stable on repeat runs, and `verify-all.ps1` now 5/5 suites. **A real earn was proven end-to-end** on the live account and a live campaign, and the balance moved by exactly what the door reported. Two residues recorded: **FA-10** (`QWK_PARTNER_REWARD_IPS` must name the production egress IPs -- it defaults to loopback on purpose, so a deployed wing is refused until it does), and the local ledger defect found live: `INSERT OR IGNORE` let a failed first attempt permanently hide a later SUCCESSFUL grant, and the person's history showed a failure for a reward they had been paid; it is now an upsert where a grant is never downgraded and a later grant repairs an earlier failure. **Registry duplicates -- one known, unfixable by design:** diagnosis `BANQ-08` and `BANQ-10` are the SAME finding (the inline `<style>` dead-rule trap) because the first submission's exit code was ignored and the script was re-run after a later validation fix. The registry has no update or delete route (append-only, correctly), so `BANQ-08` is the keeper and `BANQ-10` must be read as a duplicate. The lesson is now a pre-flight rule: a multi-entry submit script must check each entry's own result and must not be re-run blindly. |
| 2026-09-22 | **Sign-in fixed, the partner proxy made honest, verification unified, responsive audit done, D9 closed.** New: `backend/qwk-identity.js`, `backend/load-env.js`, QWK `POST /api/auth/verify-credentials` (secret-guarded, mints no session), BANQ `POST /api/auth/sso`, 4 new `users` columns, `scripts/verify-v1-smoke.cjs` + `scripts/verify-all.ps1`, a `<=480px` CSS tier, and `js/app.js` `qwkFetch`/`qwkReason`. **The reported bug -- a real QwkBrowser account rejected on login -- is fixed and proven live.** Eight defects found and fixed, each listed in `docs/COMMIT-CHECKPOINTS.md`. Three of them returned HTTP 200 while being wrong. Verified 257 PASS / 0 FAIL across four suites. F1 answered (the proxied reads were NOT live, they only looked it), F4 answered, F3 narrowed to one founder decision. Not committed. |
| 2026-09-22 | **The 37-step Intelligence System built (E0 -> E4), plus C2, D4, D5, D8 and the G3/G4 money gate.** New: `backend/intelligence/` (schema, core, phase1-4, service), `backend/banq-intelligence.js`, `backend/billboards.js`, `backend/flags.js`, `js/monitor.js`, `monitor.html`, two scripts. 51 tables, 32 config keys, 129 PASS / 0 FAIL. Five real defects were found and fixed while building (listed in the intelligence plan's change log): a collapsing creative scoring STRONG, a trend comparing unequal windows, a fatigue streak reset by missing history, a funnel multiplied by duplicate source rows, and a stored score of 0 for INSUFFICIENT_DATA. Not committed. |
| 2026-09-21 | Phases 1-3 of the four-problem plan executed: contact form made honest then given a real backend (C3 DONE), phantom seed-script claim corrected in the source docs, intelligence scope reconciled to one build authority, and the two wing rules added to AGENTS.md. All pushed. |
| 2026-09-21 | File created. Full remaining-work inventory: BANQ-021 QWK half, 4 deferred backends, 9 pipeline items, the 37-step four-phase Intelligence System (none built), open API-partnership items, and the seven infrastructure gates. Nothing built by this document; it is an index. |

---

## END OF BANQ REMAINING WORK
