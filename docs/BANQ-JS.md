==============================================================================
BANQ JS MD -- JAVASCRIPT FILE INVENTORY
==============================================================================
Created: 2026-08-26
Location: docs/BANQ-JS.md
Purpose: Plain-English inventory of every .js file in this project.
         Each file gets a one-line description of what it does so that anyone
         (builder or agent) can review and modify with natural language.

MAINTENANCE RULE:
  Whenever a NEW .js file is created anywhere under backend/ or js/, the
  agent MUST add it to this document immediately. See AGENTS.md Rule 13.

  Whenever an existing .js file is REMOVED or RENAMED, update this document
  to reflect the change.

  The inventory should always match what is on disk. An out-of-date
  inventory is a bug, not a convenience.

==============================================================================
HOW TO USE THIS DOCUMENT
==============================================================================

  1. Find the file you want to understand by its path.
  2. Read the one-line description to know what it does.
  3. If you need to modify it, tell the agent in natural language what you
     want changed, referencing the file by name or path.
  4. The agent will read the actual file, make the change, and update this
     inventory if the file's purpose has changed.

==============================================================================
INVENTORY -- LAST UPDATED: 2026-09-22 (identity bridge + proxy correctness)
==============================================================================

NOTE ON NUMBERING: two entries were both numbered "5" before 2026-09-22. The
list is now sequential so a reference to an entry number is unambiguous.

--- ROOT LEVEL ---

1. server.js
   Main entry point. Starts the Express server on port 3002, serves static
   HTML files, mounts local auth routes (/api/auth/*), the /api/banq/*
   namespace (contact + four-phase intelligence), /api/billboards/*, and
   proxies /api/ads/*, /api/profile/* and /api/ad-profile/* to QwkBrowser
   (port 3001) as ONE pathFilter middleware, SPA fallback to index.html for
   unknown PAGE routes and a JSON 404 for unknown /api/* routes.
   On boot it also runs the intelligence schema migration and seeds the
   feature-flag table. PORT is coerced with Number() because a string port
   makes app.listen() take its named-pipe branch and never answer HTTP.
   ORDER MATTERS TWICE HOUSE: the proxy must register BEFORE express.json()
   (the parser consumes the body and a later proxy forwards a POST with no
   body, so the upstream waits forever), and it must use pathFilter rather
   than a mounted path (v3 strips the mount path and the request lands on the
   wrong upstream route). Both of those were real bugs, not theory.

--- BACKEND (backend/) ---

2. backend/db.js
   Database layer. Creates users + sessions using @libsql/client (SQLite at
   data/banq.db), plus contact_messages and contact_notifications. Seeds the
   admin account (banqadmin) on every boot. ensureColumn() adds new columns to
   an EXISTING table (SQLite has no ADD COLUMN IF NOT EXISTS, and CREATE TABLE
   IF NOT EXISTS does not alter an existing table -- without it an old banq.db
   would silently keep the old shape). The QwkBrowser identity link lives here:
   qwk_user_id, qwk_username, auth_source ('local' | 'qwk'), last_sso_at.
   Exports db client, init function, tokenHash (SHA-256), and bcrypt.

2b. backend/load-env.js
   A dependency-free .env loader (this project has no dotenv). Real environment
   variables win; the file only fills gaps. It exists because the repo shipped a
   .env that NOTHING read -- so both QWK_API_URL and the identity secret were
   silently ignored and the code fell back to defaults that looked healthy.
   Values are never logged; only the count of keys loaded.

2c. backend/qwk-identity.js
   The QwkBrowser identity bridge (BANQ-024). Three jobs: verify a signed HMAC
   handoff token locally (no network call, so it works while QWK is down),
   verify a typed username+password server-to-server via
   POST /api/auth/verify-credentials (secret-guarded, returns NO token), and
   create/refresh the local mirror row for a QwkBrowser identity. A missing
   balance means "keep what is stored", never "zero it" -- a signature-only
   handoff carries no balances. Every failure is a distinct named reason so a
   throttle is never reported as an outage.

3. backend/auth.js
   Auth routes. POST /login (username+password -> token, LOCAL account first
   and then the QwkBrowser bridge), POST /sso (redeem a signed handoff token),
   GET /me (verify token via requireAuth middleware), POST /logout (delete
   session). Tokens are 32 random bytes stored as SHA-256(token) in sessions,
   7-day duration, issued in ONE place so the local path and the bridged path
   cannot drift. A local account is never shadowed by a QwkBrowser identity:
   if a local row owns the username there is no bridge fallback. BANQ keeps its
   own sessions; the QWK token is never stored or forwarded.

4. backend/banq.js
   The /api/banq/* namespace (local, NOT proxied). First resident is the contact
   form: POST /contact (public, honeypot + 30s/IP rate limit, stores into
   contact_messages and queues a contact_notifications row BEFORE answering ok)
   plus admin routes (list, stats, status update, delete, notification retry).
   Requires is_admin on the admin routes. Reason it exists: about.html used to
   claim success and discard the message.

3b. scripts/verify-v1-smoke.cjs
   The read-only smoke test (BANQ-020). Proves the running site answers as a
   SITE for pages and as an API for /api/*, asserting CONTENT TYPE and BODY
   SHAPE rather than status codes -- because the two proxy bugs of 2026-09-22
   both returned 200 with a web page where JSON belonged. Needs no credentials
   and never mutates data, so it can be run on a hunch.

3c. scripts/verify-banq-identity-bridge.cjs
   Proves the sign-in path end to end: the founder's real QwkBrowser account is
   accepted, a wrong password is still 401, an outage is not blamed on the
   person, no QWK session is created, the mirror is reused rather than
   duplicated, balances survive a handoff, local accounts stay unshadowable,
   and stale/tampered/expired handoff tokens are all rejected by name.

3d. scripts/verify-all.ps1
   One entry point that runs all four suites and exits non-zero if ANY failed,
   so a partial pass cannot look like a pass.

--- BACKEND INTELLIGENCE (backend/intelligence/) ---

5. backend/intelligence/schema.js
   PRE-BUILD (E0.2 + E0.3): the whole intelligence schema in one idempotent
   migration -- 51 tables across all four phases plus banq_config, the Phase 1
   infrastructure (notifications, revenue ledger), the unique index that makes
   one journey event count once, and the banq_config seed (32 keys). One
   authority for every table, so a step cannot invent its own.

6. backend/intelligence/core.js
   The four things all 37 steps share: config reads (cfg/cfgAll/setCfg/listCfg,
   so no threshold is ever hardcoded), the activity audit log, the append-only
   timeline writer, and the campaign access guard (staff see assigned work,
   advertisers see only their own). Also the date/pct helpers the engines use.

7. backend/intelligence/phase1.js
   PHASE 1 MONITOR. Steps 1.1-1.8 plus the Phase 1 infrastructure:
   notes (internal never returned to an advertiser), timeline, goals (an
   unmeasurable goal says so), budget pacer (walks pause and budget-change
   segments, then projects exhaustion), dashboard aggregation, BANQ Watch
   (alert evaluation with config-driven cooldown + dedup), health score
   (config-weighted, INSUFFICIENT_DATA instead of a fabricated score), report
   card (freezes a snapshot), work queue, notifications, revenue ledger.

8. backend/intelligence/phase2.js
   PHASE 2 UNDERSTAND. Creatives, the goal-weighted creative performance
   score (per-day trend basis, and a sustained volume decline overrules a
   STRONG band), what-changed (OBSERVED facts kept in a separate field from
   POSSIBLE CONTRIBUTING FACTORS, no causation), ad fatigue (streak survives a
   period with no earlier data instead of resetting), creative battle (no
   leader without two rankable creatives), recommendation engine + approval
   flow, action centre.

9. backend/intelligence/phase3.js
   PHASE 3 LEARN. Journey sources (name is unique -- duplicates used to
   multiply every funnel figure), journey events, journey configuration,
   drop-off analysis (uses an event total when rows carry one, reports the
   basis and flags a mixed basis), experiments (a hypothesis is required),
   experiment results (withheld until the minimum-data rules are met, never
   the word "winner"), benchmarking (aggregates only, withholds below the
   minimum campaign count), cross-campaign patterns, enterprise brand scoping,
   BANQ team workspace.

10. backend/intelligence/phase4.js
    PHASE 4 PLAN. Readiness check (blocking vs observation, states the human
    override), campaign planner (labels SYSTEM_SUGGESTION vs
    BANQ_RECOMMENDATION), versioned reporting with frozen snapshots,
    placement intelligence (QWK owns the inventory; reports unavailable data
    honestly), predictive alerts ("may", never "will"; dismissible), scenario
    simulator (relative outcomes when history is thin), versioned forecast
    engine, GTM workspace + learning archive.

11. backend/intelligence/service.js
    BANQ AD SERVICE, the $15/month gate (G3 + G4). One paid month covers every
    ad the advertiser runs that month. activeSubscription checks BOTH period
    bounds; monitorAccess is the single gate every monitoring route consults and
    returns the reason when it closes; subscribe records revenue to
    banq_revenue_ledger only when payment is confirmed, so an unpaid
    subscription never opens a paid gate. requireMonitorAccess is the Express
    middleware; staff bypass it.

12. backend/banq-intelligence.js
    The /api/banq/* intelligence namespace (mounted alongside backend/banq.js).
    Every route resolves its campaign through core.campaignFor, gates monitoring
    tools on the paid month, gates each phase on its feature flag, and keeps the
    ownership check BEFORE the payment check so a 403 never leaks a campaign's
    existence. Also owns /flags, /ads/search (D4+D5) and the /overview call the
    monitor dashboard loads.

13. backend/billboards.js
    BILLBOARD DECLARATIONS (C2 / BANQ-009). POST /declare, GET /interest,
    GET /demand, plus withdraw and an admin view. Demand is ranked by DISTINCT
    advertisers, never row count: one advertiser declaring ten times is
    interest, ten advertisers declaring once is demand.

14. backend/flags.js
    FEATURE FLAGS (D8 / BANQ-019). Off by default. `BANQ_FLAGS` env overrides
    (+name / -name), then the banq_feature_flags table, then the default, so an
    operator can overrule the database for one boot. An unknown flag resolves to
    false rather than throwing, so a typo hides work instead of breaking a page.

--- FRONTEND (js/) ---

15. js/app.js
   Frontend API helpers. Exposes window.BANQ namespace. Token management
   (banq_token / banq_user in localStorage). fetchJson, qwkFetch, qwkReason,
   sso, login, checkAuth, logout, escapeHtml, formatTime, toast. API_BASE
   auto-detected from window.location.origin + '/api'. fetchJson: 401 ->
   clear token, redirect to /login.html (correct for a BANQ route).
   qwkFetch: NO session clearing -- it is for the proxied QwkBrowser calls,
   where a 401 means "QwkBrowser does not accept a BANQ token", not "your
   session ended". Aliasing the two (as it was before 2026-09-22) signed a
   person out of BANQ on a banner click. qwkReason turns an upstream status
   into one plain sentence the UI can show.

16. js/ad-catalog.js
   THE ADVERTISING CATALOG (BANQ-021). Single source of truth for the whole
   marketplace: the six packages (banner, video, network_banner, network_video,
   launch, full_reach), their prices, click budgets, bullet lists, button states
   and the BANQ AD SERVICE subscription. Also owns QAP format validation and the
   package-vs-profile media requirement check. Exposes window.BANQ_AD_CATALOG.
   No surface holds its own package copy -- see docs/BANQ-021-IMPLEMENTATION-
   DESIGN.md Section 2 for why (two hand-written card sets drifted apart).

17. js/ad-page.js
   THE TWO RENDERERS (BANQ-021). mountPage() writes the FULL marketplace into
   packages.html; mountPopup() writes the PARTIAL preview into the index.html
   AD-Packages popup (two bullets per row, per Section 23.8). Both read
   js/ad-catalog.js, so a preview and a page cannot describe different products.
   Also owns the launch-button notice behaviour ("SERVICE IS DELAYED FOR
   TECHNICAL REVIEW" / "AD PACKAGE WILL BE ANNOUNCE SOON"). Exposes
   window.BANQ_AD_PAGE.

18. js/monitor.js
    THE CAMPAIGN MONITOR (G4). Renders the tools the $15 month buys: overview,
    campaign detail (health, pacing, goals, alerts, recommendations, notes,
    timeline, report), creatives (battle, fatigue, what-changed), journey
    (drop-off, experiment, benchmark), and plan (readiness, predictions,
    forecast). It never invents a number -- INSUFFICIENT_DATA and BENCHMARK NOT
    AVAILABLE are displayed as the server phrased them -- and it renders a 402
    as a real panel explaining the fee, not as an error.

==============================================================================
HTML PAGES (root)
==============================================================================

monitor.html
  The campaign monitor page. Same header/nav convention as every other page
  (script scripts/add-monitor-nav.js keeps the Monitor link present everywhere).

==============================================================================
SCRIPTS (scripts/)
==============================================================================

19. scripts/verify-unified-ad-page.cjs
   BANQ-021 verifier. 18 checks including the DRIFT ALARM: the catalog's billing
   key set must equal the PACKAGE_TIERS key set in qwkbrowser/backend/routes/
   ads.js, so a package can never be advertised without a billing key behind it.
   Also proves no day-durations and no old tier names survive on any surface.

20. scripts/verify-v1-unified-ad-page.ps1
   PowerShell wrapper for #19 (ecosystem convention verify-v{n}-{feature}.ps1).
   Propagates the checker's exit code so it can gate a build.

21. scripts/seed-banq-intelligence.js
   Demo content for all four phases. Creates three advertisers -- ONE with a
   paid BANQ month so the open dashboard can be seen, and two without, so the
   locked state is visible in the same environment. Idempotent: re-running
   updates in place. Recommendations are GENERATED by the phase 2 engine rather
   than hand-written, so a seeded recommendation can never claim more than the
   seeded data supports.

22. scripts/verify-banq-intelligence.cjs
   The Rule 57 verifier for the whole intelligence system: 129 checks covering
   the schema, the no-hardcoded-threshold rule (change a weight and the health
   score must MOVE), the gate (402 for an unpaid advertiser, 200 for a paid one,
   403 ahead of 402 for a campaign that is not theirs), the honesty rules
   (INSUFFICIENT_DATA, observed-vs-factors, cautious prediction language, no
   "winner"), and the two bugs this work fixed (per-day trend basis, one
   journey event counting once). Creates and resets its own probe accounts so it
   is re-runnable.

23. scripts/add-monitor-nav.js
   Rule 18 nav updater. Adds the Monitor link to every page that has the nav,
   idempotently, and reports which pages it skipped and why.

==============================================================================
END OF JAVASCRIPT FILE INVENTORY
==============================================================================
