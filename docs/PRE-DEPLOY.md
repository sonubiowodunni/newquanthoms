==============================================================================
PRE-DEPLOY PROTOCOL -- SHIPPING WITHOUT BREAKING THINGS
==============================================================================
Created: 2026-08-26
Location: docs/PRE-DEPLOY.md
Purpose: Defines the rules, feature flag system, and pre-launch checklist
         that allow BANQ to ship to production safely. Every agent MUST
         read this document before any deploy or feature rollout.

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
it on or off.

BANQ is a simpler project than QwkBrowser. Most features are either
built and working, or not yet built. A formal flag system may be added
when the project grows. For now, the following rules apply:

2.1 WHEN TO USE FLAGS
If a feature is built but not verified end-to-end, it should be gated.
For BANQ, gating can be as simple as:
  - Commenting out the nav link (so the page is unreachable)
  - Adding a check in app.js: if (!window.BANQ_FLAGS || !window.BANQ_FLAGS.featureName) return;
  - Backend route check: if (!flags.featureName) return res.status(503).json({ error: 'Feature not available' });

2.2 CURRENT FLAG STATE
BANQ does not currently use a formal flag file. All built features are
considered active. When the project grows, create:
  - js/flags.js (frontend flags)
  - backend/flags.js (backend flags)

2.3 RULES FOR FLAGS (WHEN IMPLEMENTED)
  1. Every feature that is not 100% verified MUST have a flag set to false.
  2. Flags default to false. You opt IN to a feature, never opt out.
  3. When a feature passes full verification, flip its flag to true,
     commit, and deploy.
  4. If a feature breaks in production, flip its flag back to false.
  5. Never delete a flag entry. Once a flag exists, it stays.
  6. Core features (auth, feed display, static pages) are always on.

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

  5. ALWAYS back up the database before any schema change:
     Copy data/banq.db to data/banq.db.backup-YYYY-MM-DD

  6. Schema changes count as "high risk" per AGENTS.md Rule 16.
     Commit before the change. Log in COMMIT-CHECKPOINTS.md.

==============================================================================
SECTION 4: ROUTE ISOLATION
==============================================================================

New features get new route files or new endpoints. Never modify an
existing route's endpoint behavior in place. If you need to change
behavior:

  1. Add a new endpoint (e.g., /api/v2/...) OR
  2. Add a new route file OR
  3. Add a new endpoint within the same file but with a different path

Old endpoints keep working. New endpoints are additive. No existing
user breaks.

==============================================================================
SECTION 5: GRADUAL ROLLOUT
==============================================================================

When flipping a flag from false to true for the first time:

  1. Flip it on for your own test account only.
  2. Test in production as a real user. Verify the feature works.
  3. If it works, flip it on for everyone.
  4. Watch server logs for 15 minutes after flipping.
  5. If errors appear, flip it back off immediately.

For BANQ's current scale (pre-launch), steps 1-3 can be collapsed into
a single flip since you control all accounts.

==============================================================================
SECTION 6: THE DEPLOY DISCIPLINE
==============================================================================

Every deploy must have three properties:

  1. SMALL -- One feature or one fix at a time.
  2. OBSERVABLE -- You can see what is happening. Check server logs,
     browser console, database state.
  3. REVERSIBLE -- If something goes wrong, you can undo it in seconds.

==============================================================================
SECTION 7: PRE-LAUNCH CHECKLIST
==============================================================================

Before deploying BANQ to production, run this checklist. Do not skip steps.

  [ ] 7.1 DATABASE
      [ ] Backup taken: data/banq.db copied to backup file
      [ ] All schema migrations applied (check db.js for new CREATE TABLE
          or ALTER TABLE that has not been run)
      [ ] Server starts without errors: npm start
      [ ] Health check: Invoke-WebRequest 'http://localhost:3002'
          -UseBasicParsing -TimeoutSec 3

  [ ] 7.2 CORE PAGES LOAD
      [ ] index.html loads without console errors (blog feed with banners)
      [ ] billboards.html loads without console errors
      [ ] packages.html loads without console errors
      [ ] dashboard.html loads without console errors
      [ ] about.html loads without console errors
      [ ] login.html loads without console errors

  [ ] 7.3 CORE API ENDPOINTS
      [ ] POST /api/auth/login works (returns token)
      [ ] GET /api/auth/me works (returns user with valid token)
      [ ] POST /api/auth/logout works (deletes session)
      [ ] GET /api/ads/eligible works (returns banners -- requires
          QwkBrowser backend running on port 3001)
      [ ] POST /api/ads/click works (awards QU -- requires QwkBrowser)

  [ ] 7.4 QWKBROWSER PROXY VERIFICATION
      [ ] QwkBrowser backend running on port 3001
      [ ] QwkBrowser health: Invoke-WebRequest 'http://localhost:3001/api/health'
          -UseBasicParsing -TimeoutSec 3
      [ ] BANQ proxy /api/ads/* reaches QwkBrowser successfully
      [ ] BANQ proxy /api/profile/* reaches QwkBrowser successfully

  [ ] 7.5 AUTH FLOW
      [ ] Login page: enter banqadmin / typetype450
      [ ] Token stored in localStorage as banq_token
      [ ] User info stored in localStorage as banq_user
      [ ] Refresh page: user stays signed in (token persists)
      [ ] Logout: token cleared, redirect to /login.html

  [ ] 7.6 PLACEHOLDER CONTENT
      [ ] index.html shows placeholder banners on first load (before API)
      [ ] billboards.html shows placeholder demand stats
      [ ] No page appears empty on first load

  [ ] 7.7 RESPONSIVE DESIGN
      [ ] Test at 375px (iPhone SE) -- no horizontal scroll
      [ ] Test at 768px (iPad) -- layout collapses correctly
      [ ] Test at 1440px (laptop) -- two-column layout works

  [ ] 7.8 ROLLBACK PLAN
      [ ] Know which commit to revert to if something breaks
      [ ] Database backup location confirmed

  [ ] 7.9 POST-DEPLOY MONITORING
      [ ] Watch server logs for 15 minutes after deploy
      [ ] Check for 500 errors, unhandled exceptions, or new warnings
      [ ] If any appear, investigate and fix or roll back

==============================================================================
SECTION 8: THE LAUNCH SEQUENCE
==============================================================================

  PHASE 0: AUDIT
  ---------
  Verify all pages load, all buttons work, all forms submit.
  Classify every feature: WORKING, STUB, NO-OP, MOCK-ONLY, MISSING.

  PHASE 1: COMMIT THE SAFE STATE
  ---------
  Commit all current code. This is the "safe state" commit.
  Everything visible is working. Everything not working is invisible.

  PHASE 2: VERIFY THE SAFE STATE
  ---------
  Run the full pre-launch checklist (Section 7).
  All core pages load. All core APIs respond. The app is deployable.

  PHASE 3: DEPLOY
  ---------
  Deploy to GitHub Pages (or Vercel/Cloudflare Pages).
  Run the post-deploy monitoring checklist (Section 7.9).

  PHASE 4: ROLL OUT FEATURES
  ---------
  As each unfinished feature reaches 100%:
    a. Test it
    b. Flip the flag (or uncomment the nav link)
    c. Commit and deploy
    d. Watch logs for 15 minutes

==============================================================================
SECTION 9: AGENT INSTRUCTIONS
==============================================================================

Any agent working on this project MUST:

  1. Read docs/PRE-DEPLOY.md before any deploy or feature rollout.
  2. When building a new feature, add its flag entry (set to false)
     BEFORE writing the feature code.
  3. When a feature is verified and ready, flip the flag to true,
     commit, and update this document's flag state (Section 2.2).
  4. Never flip a flag to true without running the pre-launch
     checklist (Section 7) for that specific feature.
  5. If a user reports a broken feature, first check if its flag
     is true. If it is, flip it to false immediately, then investigate.

==============================================================================
SECTION 10: PRODUCTION ACCOUNTS
==============================================================================

This account is seeded in backend/db.js on every server boot.
It must NEVER be deleted, renamed, or have its password changed
without explicit user approval. All gating/flag restrictions are
exempt for this account -- it always has full access.

------------------------------------------------------------------------------
10.1 ADMIN ACCOUNT (BANQ)
------------------------------------------------------------------------------

  | Username  | Email                        | Password     |
  |-----------|------------------------------|--------------|
  | banqadmin | banqadmin@newquanthoms.local | typetype450  |

  Properties:
  - is_admin = 1
  - Seeded in backend/db.js on every boot (idempotent)
  - Always exempt from any gating or access controls

==============================================================================
SECTION 11: BACKEND JS INVENTORY REFERENCE
==============================================================================

docs/BANQ-JS.md contains a plain-English inventory of every .js file
with a one-line description of what each file does.

Before any deploy:
  1. Verify the inventory is up to date -- every .js file on disk
     has an entry in the inventory.
  2. If new .js files were added during this work cycle, confirm they
     are in the inventory (AGENTS.md Rule 13 requires this).
  3. If any .js files were removed or renamed, confirm the inventory
     reflects the change.

The inventory is the builder's reference for reviewing and modifying
backend files using natural language. An out-of-date inventory during
deploy is a pre-deploy failure.

==============================================================================
SECTION 12: DEPLOYMENT TARGET
==============================================================================

BANQ is currently deployed to GitHub Pages at the repository's GitHub
Pages URL. The deployment is static (HTML/CSS/JS) with a Node.js server
component for local development.

For production:
  - Static files (HTML/CSS/JS/assets): GitHub Pages (free) or Vercel
  - Server (server.js): Render, Railway, or Fly.io (free tier)
  - Database (banq.db): SQLite file on server, or Turso (free tier)
  - QwkBrowser proxy: Server must be able to reach QwkBrowser backend
    (port 3001 locally, or QwkBrowser's production URL)

Environment variables (.env):
  QWK_API_URL=http://localhost:3001  (or production QwkBrowser URL)
  PORT=3002
  NODE_ENV=development

==============================================================================
END OF PRE-DEPLOY PROTOCOL
==============================================================================
