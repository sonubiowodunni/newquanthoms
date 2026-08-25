==============================================================================
PRE-DEPLOY PROTOCOL -- SHIPPING WITHOUT BREAKING THINGS
==============================================================================
Created: 2026-08-18
Location: docs/PRE-DEPLOY.md
Purpose: Defines the rules, feature flag system, and pre-launch checklist
         that allow QwkBrowser to ship to production safely. Every agent
         MUST read this document before any deploy or feature rollout.

==============================================================================
SECTION 1: THE CORE PRINCIPLE
==============================================================================

"Done" does not mean "every feature is built."
Done means: "Every feature that is VISIBLE is WORKING, and every
feature that is NOT working is INVISIBLE."

The fear of launching comes from feeling like unfinished features are
loose cannons. The solution is not "finish everything first." The
solution is a discipline that makes unfinished features unreachable by
users until they are ready.

This document defines that discipline.

==============================================================================
SECTION 2: FEATURE FLAGS
==============================================================================

Feature flags are runtime switches that control whether a feature is
visible and active. Code can be deployed while dormant. One line flips
it on or off. No redeploy needed for the flag change itself (just
restart the server for backend flags, hard-refresh for frontend flags).

------------------------------------------------------------------------------
2.1 FLAG FILE LOCATIONS
------------------------------------------------------------------------------

Frontend flags:  frontend/js/flags.js
Backend flags:   backend/flags.js

Both files export a single object. Every feature in the app that is
not 100% verified working MUST have an entry set to false.

------------------------------------------------------------------------------
2.2 FLAG OBJECT STRUCTURE
------------------------------------------------------------------------------

  // frontend/js/flags.js
  window.QWK_FLAGS = {
    // === CORE (always on, never flag off) ===
    auth: true,
    factoryFeed: true,
    amplifications: true,
    raffleSystem: true,
    search: true,
    notes: true,
    jobs: true,
    knowledgebase: true,

    // === BUILT BUT NOT VERIFIED END-TO-END ===
    promotionalAds: false,
    businessPage: false,
    webcodes: false,

    // === BUILT BUT INCOMPLETE (phases remaining) ===
    bmfQlub: false,
    voteBoost: false,
    journalScripts: false,

    // === NOT BUILT ===
    interactiveArticles: false,
    articleDigest: false,
    pwa: false,
    inBrowser: false,
  };

  // backend/flags.js
  module.exports = {
    promotionalAds: false,
    bmfQlub: false,
    voteBoost: false,
    journalScripts: false,
    interactiveArticles: false,
    articleDigest: false,
    pwa: false,
    inBrowser: false,
  };

------------------------------------------------------------------------------
2.3 HOW TO USE FLAGS IN FRONTEND CODE
------------------------------------------------------------------------------

  // In any HTML page, before rendering a feature's UI:
  if (window.QWK_FLAGS && window.QWK_FLAGS.promotionalAds) {
    // render the badge, button, modal, etc.
  }
  // else: do not render it at all. No placeholder. No "coming soon."

  // Before calling a flagged API endpoint:
  if (window.QWK_FLAGS && window.QWK_FLAGS.promotionalAds) {
    const res = await fetch('/api/promotional/...');
  }
  // else: do not call the API. The route may not be mounted.

------------------------------------------------------------------------------
2.4 HOW TO USE FLAGS IN BACKEND CODE
------------------------------------------------------------------------------

  // In server.js, when mounting routes:
  const flags = require('./flags');
  if (flags.promotionalAds) {
    app.use('/api/promotional', promotionalRoutes);
  }
  // else: route is not mounted. 404 if anyone hits it.

  // In route files, double-check at the endpoint level:
  if (!flags.promotionalAds) {
    return res.status(503).json({ error: 'Feature not available' });
  }

------------------------------------------------------------------------------
2.5 RULES FOR FLAGS
------------------------------------------------------------------------------

  1. Every feature that is not 100% verified MUST have a flag set to false.
  2. Flags default to false. You opt IN to a feature, never opt out.
  3. When a feature passes full verification (verify script + manual browser
     check), flip its flag to true, commit, and deploy.
  4. If a feature breaks in production, flip its flag back to false.
     This is faster than a git revert and does not touch other features.
  5. Never delete a flag entry. Once a flag exists, it stays. This
     prevents accidental un-gating of a feature that was meant to be off.
  6. Core features (auth, factory feed, amplifications, raffle, search,
     notes, jobs, knowledgebase) are always on. They do not get flags
     unless you specifically need to disable one.
  7. FEATURE FLAG EXEMPTIONS. A feature does NOT need a flag entry if
     ALL of the following are true:
       (a) It does not require VIDEO, AUDIO, or IMAGE processing.
       (b) It does not require a capability the platform does not
           already have (e.g., Stripe webhooks, external API
           integrations not yet built).
       (c) It uses only existing DB tables, existing API patterns,
           and existing frontend conventions (vanilla JS, fetch API,
           CSS custom properties).
     Features meeting all three criteria are CORE -- always on, no
     flag needed. The flag system gates features that depend on
     unverified infrastructure or unbuilt media processing. A
     feature built entirely with existing primitives is the same
     surface that already works.

==============================================================================
SECTION 2A: GATING TIERS
==============================================================================

Feature flags (Section 2) are Tier 1 of a three-tier gating system.
This section defines the full system. Every page or feature in QwkBrowser
exists at exactly one tier at any given time. Agents MUST know which
tier a page is at before working on it.

------------------------------------------------------------------------------
2A.1 THE THREE TIERS
------------------------------------------------------------------------------

  TIER 1: FEATURE FLAG (Invisible)
  ------------------------------------------------------------------
  The feature is completely invisible. No UI, no route, no trace.
  Code is dormant. The user never knows it exists.

  Implementation: Section 2 (feature flags in flags.js).
  When to use: Feature not built yet, or built but not verified
  end-to-end.

  TIER 2: RED PADLOCK (Visible but Locked)
  ------------------------------------------------------------------
  The page path is visible and navigable. The user can click to the
  page. But the page content is replaced by a red padlock overlay.
  The user sees that the page exists and is coming -- they just
  cannot access the content yet.

  Implementation:
    - The page route exists in topbar-chips.js or sidebar navigation.
    - The page HTML file exists and loads, but a full-screen overlay
      covers the content area.
    - The overlay shows a red padlock icon and a short message:
      "This page is locked. Coming soon."
    - The overlay is controlled by a flag in flags.js:
      if (window.QWK_FLAGS && !window.QWK_FLAGS.someFeature) {
        showPadlockOverlay();
      }
    - When the flag flips to true, the overlay disappears and the
      page content is revealed. No code change needed beyond the flag.
    - The padlock overlay CSS class: .qwk-padlock-overlay
    - The padlock overlay JS function: showPadlockOverlay(message)

  When to use: Page is built but not ready for use. You want users
  to know it is coming. Good for marketing -- visibility creates
  anticipation.

  TIER 3A: PER-USER ACCESS LOCK (Page Loads, Actions Locked per User)
  ------------------------------------------------------------------
  The page loads fully. The user can browse, read, and see everything.
  But action buttons (Upload Content, Go Live, Create Channel, etc.)
  are locked based on the USER'S role or tier. Clicking a locked
  button shows a message explaining why.

  Implementation:
    - The page renders normally. No overlay.
    - Action buttons have a data-locked attribute when the user's
      role does not permit that action:
        <button data-locked="true" data-lock-reason="user-tier">
          Upload Content
        </button>
    - Locked buttons are visually distinct: dimmed, with a small
      lock icon.
    - Clicking a locked button shows a toast or modal:
      "You don't have access to this yet."
    - The lock check is role-based, determined server-side:
      GET /api/auth/me returns user.role (e.g., "verified",
      "subscriber", "standard", "guest")
    - Frontend checks user role before enabling actions:
      if (user.role === 'verified') { enableAction(button); }
      else { lockAction(button, 'user-tier'); }
    - Backend ALSO enforces the lock. Never trust the frontend alone.
      The API endpoint checks the user's role and returns 403 if
      the role is insufficient.

  When to use: Page is usable for viewing, but core actions are
  restricted to certain user tiers (e.g., only verified accounts
  can Upload Content, only subscribers can Go Live).

  TIER 3B: PER-FEATURE ACCESS LOCK (Page Loads, Actions Locked Globally)
  ------------------------------------------------------------------
  The page loads fully. The user can browse everything. But action
  buttons are locked GLOBALLY -- no user can use them yet because
  the feature is not ready. This is different from Tier 3A: the
  lock is not about who the user is, but about whether the feature
  is finished.

  Implementation:
    - The page renders normally. No overlay.
    - Action buttons have a data-locked attribute when the feature
      is not yet enabled:
        <button data-locked="true" data-lock-reason="feature-off">
          Go Live
        </button>
    - Locked buttons are visually distinct: dimmed, with a small
      lock icon.
    - Clicking a locked button shows a toast or modal:
      "This action isn't available yet."
    - The lock is controlled by a flag in flags.js:
      if (!window.QWK_FLAGS.goLive) { lockAction(button, 'feature-off'); }
      else { enableAction(button); }
    - Backend ALSO enforces the lock. The API endpoint checks the
      feature flag and returns 503 if the flag is false.

  When to use: Page is usable for viewing, but the feature behind
  the action buttons is not finished or not wired to the backend
  yet. You want users to see the buttons (so they know what is
  coming) but not be able to use them.

------------------------------------------------------------------------------
2A.2 THE "NO ACCESS" MESSAGES
------------------------------------------------------------------------------

  Two different messages for two different reasons. The user should
  never feel blamed for a feature that is not built.

  Per-feature lock (Tier 3B):
    "This action isn't available yet."
    -- The feature is not ready. It is the platform's status, not
       the user's. No blame, no "you."

  Per-user lock (Tier 3A):
    "You don't have access to this yet."
    -- The user's tier is the blocker. Still gentle -- "yet" implies
       it can change. But it is honest about who the blocker is.

  Red padlock (Tier 2):
    "This page is locked. Coming soon."
    -- The page exists but is not ready. Short, clear, forward-looking.

------------------------------------------------------------------------------
2A.3 RULES FOR SWITCHING BETWEEN TIERS
------------------------------------------------------------------------------

  1. A page or feature can move UP in tiers (more visible) only when
     it passes the verification for that tier:
       Tier 1 -> Tier 2: Page HTML exists and loads without errors.
       Tier 2 -> Tier 3A/3B: Page content is built and renders correctly.
       Tier 3A/3B -> Tier 1 (flag true): Full end-to-end verification
         passes (verify script + manual browser test).

  2. A page or feature can move DOWN in tiers (less visible) at any
     time without verification. If something breaks, drop it back to
     a lower tier. This is the rollback path:
       Tier 1 (flag true) -> Tier 3B: Flip flag to false. Actions
         lock but page stays visible.
       Tier 3A/3B -> Tier 2: Add padlock overlay. Page visible but
         content hidden.
       Tier 2 -> Tier 1: Remove from navigation. Feature fully
         invisible.

  3. The tier for each page/feature MUST be documented in the flag
     state table (Section 10). Add a "Tier" column:
       | Flag | Frontend | Backend | Status | Tier |

  4. When building a new page, start at Tier 1 (flag false). Move up
     only as described in Rule 1 above. Never launch at a higher tier
     than the page is ready for.

  5. Tier 2 (Red Padlock) and Tier 3B (Per-Feature Lock) both use
     flags.js. The difference is what the flag controls:
       Tier 2: flag=false -> padlock overlay covers entire page.
       Tier 3B: flag=false -> action buttons locked, page visible.
     A page can use different tiers for different features on the
     same page. Example: mybmf.html could be Tier 3B for "Go Live"
     but Tier 3A for "Create Channel" (per-user role).

  6. Tier 3A (Per-User Lock) is role-based, not flag-based. It uses
     the user's role from the auth system. The backend MUST enforce
     it independently of the frontend.

==============================================================================
SECTION 3: BACKWARD-COMPATIBLE DATABASE CHANGES
==============================================================================

The database schema should always be AHEAD of the code that uses it.
A column that exists but is not read is harmless. Code that expects a
column that does not exist crashes.

RULES:
  1. ADD columns with safe defaults:
     ALTER TABLE x ADD COLUMN y TEXT DEFAULT NULL;
     Old code ignores it. New code uses it. No break.

  2. ADD new tables freely. Old code never knows they exist.

  3. NEVER rename a column in one step. To rename:
     a. Add the new column (ALTER TABLE x ADD COLUMN new_name ...)
     b. Dual-write to both old and new columns
     c. Migrate all readers to the new column
     d. Remove the old column in a later deploy (or just leave it)

  4. NEVER delete a column that existing code might reference.
     If you must remove it, first verify no code reads it, then remove
     in a separate commit after the code change is deployed.

  5. ALWAYS back up the database before any schema change:
     Copy data/qwkbrowser.db to data/qwkbrowser.db.backup-YYYY-MM-DD

  6. Schema changes count as "high risk" per AGENTS.md Rule 21.
     Commit before the change. Log in COMMIT-CHECKPOINTS.md.

==============================================================================
SECTION 4: ROUTE ISOLATION
==============================================================================

New features get new route files. Never modify an existing route file's
endpoint behavior in place. If you need to change behavior:

  1. Add a new endpoint (e.g., /api/v2/...) OR
  2. Add a new route file (e.g., routes/promotional.js alongside
     routes/campaign.js) OR
  3. Add a new endpoint within the same file but with a different path

Old endpoints keep working. New endpoints are additive. No existing
user breaks.

If you MUST modify an existing endpoint's behavior, gate the new
behavior behind a flag so old clients get the old response until you
flip the flag.

==============================================================================
SECTION 5: GRADUAL ROLLOUT
==============================================================================

When flipping a flag from false to true for the first time:

  1. Flip it on for your own test account only:
     if (user.id === 'YOUR_TEST_USER_ID') { flag = true }

  2. Test in production as a real user. Verify the feature works.

  3. If it works, flip it on for everyone.

  4. Watch server logs for 15 minutes after flipping.

  5. If errors appear, flip it back off immediately.

For your current scale (pre-launch or early launch), steps 1-3 can be
collapsed into a single flip since you control all accounts. The
discipline matters more once you have real users you do not control.

==============================================================================
SECTION 6: THE DEPLOY DISCIPLINE
==============================================================================

Every deploy must have three properties:

  1. SMALL -- One feature or one fix at a time. Not "launch everything."
     If something breaks, you know exactly what caused it.

  2. OBSERVABLE -- You can see what is happening. Check server logs,
     browser console, database state. If you deploy and do not watch
     what happens, you are flying blind.

  3. REVERSIBLE -- If something goes wrong, you can undo it in seconds.
     Feature flags make this trivial: flip true back to false.
     No git revert. No rollback. No panic.

==============================================================================
SECTION 7: PRE-LAUNCH CHECKLIST
==============================================================================

Before flipping any feature flag to true for public users, run this
checklist. Do not skip steps. Do not "eyeball it."

  [ ] 7.1 DATABASE
      [ ] Backup taken: data/qwkbrowser.db copied to backup file
      [ ] All schema migrations applied (check db.js for any new
          CREATE TABLE or ALTER TABLE that has not been run)
      [ ] Server starts without errors: restart-server-silent.ps1
      [ ] Health check passes: Invoke-WebRequest
          'http://localhost:3001/api/health' -UseBasicParsing -TimeoutSec 3

  [ ] 7.2 VERIFICATION SCRIPTS
      [ ] Run: powershell -NoProfile -ExecutionPolicy Bypass -File
          scripts\verify-all.ps1
      [ ] All scripts PASS (or known FAILs are documented and accepted)
      [ ] Any new verify scripts for the feature being deployed also PASS

  [ ] 7.3 CORE PAGES LOAD
      [ ] Homepage / factory.html loads without console errors
      [ ] Amplifications.html loads without console errors
      [ ] Userprofile.html loads without console errors
      [ ] Search.html loads without console errors
      [ ] Marketing-admin.html loads without console errors
      [ ] Every other frontend/*.html page loads (HTTP 200)

  [ ] 7.4 CORE API ENDPOINTS
      [ ] POST /api/auth/login works (returns token)
      [ ] GET /api/factory/feed works (returns posts)
      [ ] GET /api/search/universal works (returns results)
      [ ] GET /api/amplify/feed works (returns amplified URLs)
      [ ] GET /api/raffle/status works (returns ticket count)

  [ ] 7.5 FEATURE BEING DEPLOYED
      [ ] Flag is set to true in frontend/js/flags.js
      [ ] Flag is set to true in backend/flags.js
      [ ] Feature's verify script passes
      [ ] Manual browser test: click every button, fill every form,
          submit, verify response, check no console errors
      [ ] Server logs show no new errors after feature is used

  [ ] 7.6 ROLLBACK PLAN
      [ ] Know which flag to flip back to false if it breaks
      [ ] Know which commit to revert to if the flag is not enough
      [ ] Database backup location confirmed

  [ ] 7.7 POST-DEPLOY MONITORING
      [ ] Watch server logs for 15 minutes after deploy
      [ ] Check for 500 errors, unhandled exceptions, or new warnings
      [ ] If any appear, flip the feature flag back to false
      [ ] Document the issue in TASK-BREAKDOWN.md or PIPELINE.md

==============================================================================
SECTION 8: THE LAUNCH SEQUENCE
==============================================================================

The actual process of going from "everything is built locally" to
"public users can use the app" follows this order:

  PHASE 0: AUDIT
  ---------
  Run BUFF verification runner + button function audit on every page.
  Classify every feature: WORKING, STUB, NO-OP, MOCK-ONLY, MISSING.
  Build the triage table (Phase 1 ship vs. delay).

  PHASE 1: FLAG AND COMMIT
  ---------
  Create frontend/js/flags.js and backend/flags.js.
  Set every non-verified feature to false.
  Commit the flag files and all current code.
  This is the "safe state" commit. Everything visible is working.
  Everything not working is invisible.

  PHASE 2: VERIFY THE SAFE STATE
  ---------
  Run the full pre-launch checklist (Section 7).
  All core pages load. All core APIs respond. All verify scripts pass.
  The app is now deployable. The public sees only working features.

  PHASE 3: DEPLOY
  ---------
  Deploy the safe state to production.
  Run the post-deploy monitoring checklist (Section 7.7).
  The app is live. Users can use everything that is flagged on.

  PHASE 4: ROLL OUT FEATURES ONE AT A TIME
  ---------
  As each unfinished feature reaches 100%:
    a. Run its verify script
    b. Manual browser test
    c. Flip the flag to true
    d. Commit and deploy
    e. Watch logs for 15 minutes
    f. If it breaks, flip back to false

  This is an ongoing process. You never "finish" -- you continuously
  ship features as they become ready, without ever risking the stable
  surface your users already have.

==============================================================================
SECTION 9: AGENT INSTRUCTIONS
==============================================================================

Any agent working on this project MUST:

  1. Read docs/PRE-DEPLOY.md before any deploy or feature rollout.
  2. Check frontend/js/flags.js and backend/flags.js before assuming
     a feature is active. A feature with flag=false is NOT active,
     even if the code exists in the repo.
  3. When building a new feature, add its flag entry to both flag
     files (set to false) BEFORE writing the feature code. This
     ensures the feature is dormant from the moment it exists.
  4. When a feature is verified and ready, flip the flag to true,
     commit, and update this document's flag table (Section 2.2).
  5. Never flip a flag to true without running the pre-launch
     checklist (Section 7) for that specific feature.
  6. If a user reports a broken feature, first check if its flag
     is true. If it is, flip it to false immediately, then
     investigate. Stabilize first, debug second.

==============================================================================
SECTION 10: CURRENT FLAG STATE
==============================================================================

Last updated: 2026-08-24

  | Flag               | Frontend | Backend | Status                          |
  |--------------------|----------|---------|---------------------------------|
  | auth               | n/a      | n/a     | CORE - always on               |
  | factoryFeed        | n/a      | n/a     | CORE - always on               |
  | amplifications     | n/a      | n/a     | CORE - always on               |
  | raffleSystem       | n/a      | n/a     | CORE - always on               |
  | search             | n/a      | n/a     | CORE - always on               |
  | notes              | n/a      | n/a     | CORE - always on               |
  | jobs               | n/a      | n/a     | CORE - always on               |
  | knowledgebase      | n/a      | n/a     | CORE - always on               |
  | promotionalAds     | true     | true    | All flags flipped true         |
  | businessPage       | true     | true    | All flags flipped true         |
  | webcodes           | true     | true    | All flags flipped true         |
  | bmfQlub            | true     | true    | All flags flipped true         |
  | voteBoost          | true     | true    | All flags flipped true         |
  | journalScripts     | true     | true    | All flags flipped true         |
  | interactiveArticles| true     | true    | All flags flipped true         |
  | articleDigest      | true     | true    | All flags flipped true         |
  | pwa                | true     | true    | All flags flipped true         |
  | inBrowser          | true     | true    | All flags flipped true         |
  | ads_new_panel      | true     | true    | QWK-030 -- all flags flipped true |
  | page_newquanthoms  | true     | true    | QWK-030 -- all flags flipped true |
  | bmf_record         | true     | true    | QWK-031 -- all flags flipped true |
  | bmf_go_live        | true     | true    | QWK-031 -- all flags flipped true |

NOTE: Flag files (frontend/js/flags.js, backend/flags.js) were created
2026-08-23. All flags flipped to true 2026-08-24 per user request.
Marketing and admin accounts are always exempt from gating.

==============================================================================
SECTION 11: PRODUCTION ACCOUNTS
==============================================================================

These accounts are seeded in backend/db.js on every server boot.
They must NEVER be deleted, renamed, or have their passwords changed
without explicit user approval. All gating/flag restrictions are
exempt for these accounts -- they always have full access.

------------------------------------------------------------------------------
11.1 MARKETING ACCOUNTS
------------------------------------------------------------------------------

  | Username          | Email                        | Password     |
  |-------------------|------------------------------|--------------|
  | quanthomoffice    | thisisareaone@gmail.com      | typetype450  |
  | qwkbrowser        | nctgraphicsonline@gmail.com  | typetype450  |
  | iloveqwkbrowser   | logobozzstudios@gmail.com    | typetype450  |

  Properties:
  - is_marketing_account = 1
  - marketing_balance = 1,000,000,000 (1 Billion QU)
  - marketing_cap_per_24h = 15,000,000 (15 Million QU/day)
  - Auto-reset to 1 Billion every 60 days
  - Seeded in db.js lines ~2727-2749

------------------------------------------------------------------------------
11.2 ADMIN ACCOUNT
------------------------------------------------------------------------------

  | Username   | Email                      | Password     |
  |-----------|----------------------------|--------------|
  | qwkadmin  | qwkadmin@qwkbrowser.local  | typetype450  |

  Properties:
  - is_marketing_account = 0
  - Admin access controlled by QWK_ADMIN_USERNAMES env var in auth.js
    requireAdmin middleware
  - Seeded in db.js lines ~2754-2762

==============================================================================
SECTION 12: BACKEND JS INVENTORY REFERENCE
==============================================================================

docs/QWKBROWSER-JS.md contains a plain-English inventory of every backend
.js file with a one-line description of what each file does.

Before any deploy:
  1. Verify the inventory is up to date -- every backend .js file on disk
     has an entry in the inventory.
  2. If new .js files were added during this work cycle, confirm they are
     in the inventory (AGENTS.md Rule 39 requires this).
  3. If any .js files were removed or renamed, confirm the inventory
     reflects the change.

The inventory is the builder's reference for reviewing and modifying
backend files using natural language. An out-of-date inventory during
deploy is a pre-deploy failure.

==============================================================================
END OF PRE-DEPLOY PROTOCOL
==============================================================================
