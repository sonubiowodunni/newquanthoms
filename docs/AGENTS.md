 ============================================================================
 /  \  MANDATORY MEMORY GUIDE BEFORE RUNNING PROVIDED PROMPT
 \  /  ----------------------------------------------------------
  \/   File: AGENTS.md
       Location: project root (C:\Users\lenovo\Documents\qwkbrowser)
       Purpose: ANY coding agent (Claude Code, Codex, Aider, Letta Code,
                or any other) MUST read this file in full BEFORE executing
                any task, prompt, or instruction in this repository.

 ==============================================================================
 >> STOP. READ THIS FIRST. DO NOT SKIP TO THE PROMPT. <<
 ==============================================================================

If you are an AI coding agent and you have been given a task that touches any
file in this repository, you are REQUIRED to:

  1. Read this entire file before writing, editing, or running anything.
  2. Follow the directory map in Section 1 so you know where things live.
  3. Read the LAST PROMPT RESIDUE in Section 2 to understand current state.
  4. Follow the AGENTIC FACTORY workflow in Section 3 for all development.
  5. Honor the SUGGESTION ARC in Section 4 -- always suggest improvements.
  6. After completing your work, UPDATE Section 2 (LAST PROMPT RESIDUE)
     with a summary of what you did, what remains, and the current goal.

This is not optional. This is not a suggestion. If you skip this file, you
will work with stale context, duplicate effort, and break things that are
already fixed.

 ----------------------------------------------------------------------------

 PLATFORM NOTES
 - Windows + PowerShell. Do NOT use `&&` for chaining. Use `;` or sep calls.
 - Do NOT use bash heredocs. Use simple quoted strings for multiline content.
 - Em-dashes and special Unicode cause encoding issues in files on Windows.
   Use ASCII-only characters in all generated scripts and file edits.
   See Rule 16 for the full mojibake prevention and recovery protocol.
 - Server port: 3001. Start/restart via:
     powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\restart-server-silent.ps1"
   Health check:
     Invoke-WebRequest 'http://localhost:3001/api/health' -UseBasicParsing -TimeoutSec 3

 TOOL SUBSTITUTION TABLE (Windows/PowerShell) -- See Rule 25 for MANDATORY compliance
 The following Unix/bash tools do NOT exist or fail on this Windows environment.
 Agents MUST use the PowerShell alternative instead. NEVER attempt the Unix tool.
 This is a MANDATORY RULE (Rule 25, Section 6). Violating it causes stuck states.

   BROKEN TOOL          | USE INSTEAD
   ---------------------|----------------------------------------------------------
   grep                 | Select-String -Path <file> -Pattern <regex>
                         For recursive: Get-ChildItem -Recurse -Filter "*.js" |
                         Select-String -Pattern <regex>
   find                 | Get-ChildItem -Path <dir> -Filter <pattern> -Recurse
   cat                  | Read tool (preferred) or Get-Content <file>
   head/tail            | Get-Content <file> -TotalCount N  (head)
                         Get-Content <file> -Tail N  (tail)
   sed                  | Edit tool (preferred) or -replace operator in PowerShell
   awk                  | Parse with ForEach-Object or custom PowerShell
   echo                 | Write-Output or just type the string
   curl                 | Invoke-WebRequest or Invoke-RestMethod
   wc -l                | (Get-Content <file>).Count
   touch                | New-Item -ItemType File
   rm                   | Remove-Item
   cp                   | Copy-Item
   mv                   | Move-Item
   ls                   | Get-ChildItem (or just use the Read/Glob tools)
   mkdir                | New-Item -ItemType Directory
   chmod                | Not needed on Windows (use ACLs if truly required)
   which/where          | Get-Command
   Read tool (offset)   | Get-Content <file> | Select-Object -Skip N -First M
                         Use when Read tool ignores offset parameter and returns
                         first N lines repeatedly.
   Write tool (desync)  | Set-Content -Path <file> -Value $content -Encoding UTF8
                         Or use PowerShell single-quoted here-string:
                           @' ...literal content... '@ | Set-Content -Path <file> -Encoding UTF8
                         Use when Write tool returns "stale pending tool call"
                         desync error. Per Rule 25.4, substitute IMMEDIATELY --
                         do NOT retry the Write tool. One attempt, one substitute.
   Edit tool (desync)   | (Get-Content <file> -Raw) -replace 'old','new' | Set-Content <file>
                         Use when Edit tool returns "stale pending tool call"
                         desync error. Same rule: substitute, do not retry.
   Any built-in tool    | If a built-in tool (Read, Write, Edit, Grep, Glob) fails
   (stale desync)        with "stale pending tool call" or similar harness state
                         error, IMMEDIATELY substitute the PowerShell equivalent
                         from this table. Do NOT retry the same tool. This is
                         Rule 25.4 -- one attempt, one substitute, move on.
   Node -e (inline DB)  | Create proper test script file, or use API endpoints
                         The db module does not expose `db` directly; inline
                         node -e scripts fail with "Cannot read properties of
                         undefined (reading 'execute')".

 ALSO: The Letta Code Read tool and Grep tool (if available) should be
 preferred over any shell command for file reading and content search.
 Use Select-String only when the built-in tools are insufficient.

 COMMON GOTCHAS:
   - `cd path && grep` fails (no && in PowerShell). Use `;` or absolute paths.
   - `grep` is not recognized at all in PowerShell. Use Select-String.
   - Heredocs (`<<EOF`) do not work. Use single-quoted multiline strings.
   - `find . -name "*.js"` fails. Use `Get-ChildItem -Recurse -Filter "*.js"`.
   - Frontend files are in `frontend/` subdirectory, NOT project root.
     Example: factory.html is at `frontend/factory.html`, not `./factory.html`.
   - Read tool offset parameter may be ignored by harness (returns first N lines
     repeatedly). If this happens, substitute: Get-Content <file> | Select-Object
     -Skip N -First M
   - Invoke-WebRequest can desync if harness state is stale (returns error about
     "stale pending tool call"). If this happens, restart the approach rather
     than retrying the same call.
   - JavaScript files with `\n` literal escape sequences in strings (where they
     should be actual newlines) break the JS parser. This is the "leak coding
     error" pattern. Fix by replacing `\n` literals with actual line breaks.

 ==============================================================================
 SECTION 1 -- DIRECTORY MAP
 ==============================================================================

Root: C:\Users\lenovo\Documents\qwkbrowser

 ----------------------------------------------------------------------------
 1. ROOT (C:\Users\lenovo\Documents\qwkbrowser)
 ----------------------------------------------------------------------------
    Contains project-level docs, config, and the git repo.

    Key files:
    - AGENTS.md          (this file -- mandatory read for all agents)
    - HANDOFF.md         (comprehensive handoff doc -- read after this file)
    - PROJECT_STATUS.md  (42 KB status history + glossary + API reference)
    - PHASE-1-LINEUP-CURRENT.md  (78-sprint table with status -- use for resume)
    - PHASE-1-SPRINT-PLAN.md     (master long-form sprint plan, 60+ sprints)
    - docs/PRE-DEPLOY.md  (feature flags + pre-launch checklist -- read before any deploy)
    - TRUST_MODEL.md    (trust/security architecture doc)
    - DEPLOYMENT-GUIDE.md       (deployment instructions)
    - BACKEND-INVENTORY.md       (backend file inventory)
    - docs/QWKBROWSER-JS.md      (plain-English inventory of every backend .js file -- see Rule 39)
    - README.md          (project overview -- partially stale)
    - .gitignore        (excludes node_modules, .env, dist, .aider*, .letta)
    - verify.log        (verification log output)

    Key dirs:
    - backend/   (Node.js + Express API server)
    - frontend/ (static HTML/CSS/JS -- no build step, no framework)
    - data/     (SQLite database + logs)
    - scripts/  (PowerShell scripts for server lifecycle + verification)
    - docs/     (additional documentation)
    - .letta/   (Letta Code agent workspace -- do not commit)

 ----------------------------------------------------------------------------
 2. BACKEND (C:\Users\lenovo\Documents\qwkbrowser\backend)
 ----------------------------------------------------------------------------
    Node.js + Express + @libsql/client. Port 3001.

    Structure:
    - server.js          Express entry point. Mounts all routes, applies
                         middleware, 404 catch-all, static file serving.
    - db.js              (~86 KB) Database setup, all CRUD helpers, schema
                         migrations. 72 tables. MUST be re-read on resume to
                         see latest schema state.
    - x-oauth.js         OAuth 1.0a flow for X (Twitter).
    - x-token-store.js   X OAuth token persistence.
    - .env               Environment variables (DO NOT COMMIT).
    - .env.example       Template for env vars.

    routes/ (mounted in server.js):
    - auth.js            register, login, guest, claim, logout
    - indx.js            home page data (stats, sources)
    - earn.js            quiz game (quests, answers, stats)
    - x.js               X connect, share, stats, tweet
    - campaign.js        URL promotion / amplification
    - webcodes.js        webcode promotions (create, list, verify, draw)
    - referral.js        /r/:code redirect, attribution, social stats
    - social-platforms.js  Multi-platform OAuth stubs (FB, LinkedIn, Reddit, etc.)
    - profile.js         19 profile endpoints (the big one)
    - jobs.js            job board
    - knowledgebase.js   KB articles + categories
    - leaderboard.js     quiz rankings
    - recommendations.js  shared URLs
    - updates.js         version feed
    - billing/           billing-related routes
    - services/           referral service (atomic ledger writes)
    - lib/                env validator
    - middleware/         CSRF, cookie signing, rate limiting, guest session

    Database: @libsql/client (Turso-compatible), single file at data/qwkbrowser.db (WAL mode).
    72 tables including: users, user_settings, sessions, guest_sessions,
    apps, versions, quanthom_ledger, reward_ledger, campaigns, jobs, etc.

    Two-currency economy:
    - QC (Quanthom Credit) = soft currency, earned via quizzes/shares/referrals.
    - QU (Quanthom Unit) = hard currency, granted on signup (50 QU) + jobs.

 ----------------------------------------------------------------------------
 3. FRONTEND (C:\Users\lenovo\Documents\qwkbrowser\frontend)
 ----------------------------------------------------------------------------
    Vanilla ES6+. No build step. No transpiler. No framework.
    Served by Express static middleware from the backend.

    Structure:
    - qwkbrowser-homepage.html  (446 KB) Main app shell + sidebar + nav.
    - marketing.html            Manifesto/landing page.
    - userprofile.html          Profile panel + avatar.
    - qwkbrowser-arena.html     Arena page.
    - Many feature pages: earn.html, elist.html, faq.html, jobs.html,
      knowledgebase.html, notes.html, quiz-scoreboard.html, supporters.html,
      top-100-earners.html, top-100-winners.html, updates.html, urlfeed.html,
      auditorium.html, clinic.html, map.html, premium-pro.html,
      purchase-quanthom.html, purchase-units.html, reminder.html,
      reset-counter.html, retail.html, studio.html, app-store.html,
      support.html (if exists).

    Sub-dirs:
    - css/    styles.css (global styles, CSS custom properties for theming)
    - js/     app.js (API helpers, escapeHtml), profile.js, qwk.js, topbar.css
    - assets/ static assets
    - pages/  (intended for sub-page routing -- currently sparse)
    - _unused/ deprecated files

    Key patterns:
    - Single-page app with section toggling (qwkbrowser-homepage.html).
    - Panel-based UI (slide-in profile panel).
    - Token in localStorage, Bearer auth header on every fetch.
    - API_BASE constant points to window.location.origin + '/api'.
    - qwk.js may need API_BASE auto-detection for production (see Section 3).

 ----------------------------------------------------------------------------
 4. DATA (C:\Users\lenovo\Documents\qwkbrowser\data)
 ----------------------------------------------------------------------------
    SQLite database files + server logs.

    - qwkbrowser.db         Active database (SQLite, WAL mode).
    - qwkbrowser.db-wal     Write-Ahead Log (can be larger than the DB).
    - qwkbrowser.db-shm     Shared memory file.
    - qwkbrowser.db.backup-sprint-a   Backup from Sprint A.
    - qwkbrowser.db.backup-sprint-b   Backup from Sprint B.
    - server.log / server.err         Server log output.

    DO NOT commit database files to git. They are in .gitignore.
    Back up the DB before any schema change.

 ----------------------------------------------------------------------------
 5. SCRIPTS (C:\Users\lenovo\Documents\qwkbrowser\scripts)
 ----------------------------------------------------------------------------
    PowerShell + batch scripts for server lifecycle and verification.

    Server lifecycle:
    - start-server-silent.ps1     Launch node backend detached, hidden.
    - restart-server-silent.ps1   Kill + relaunch silent (PREFERRED).
    - start-server-confirm.ps1    Popup-gated launch (legacy).
    - restart-server-confirm.ps1  Popup-gated restart (legacy).
    - start-server.bat / stop-server.bat / server-status.bat  Desktop shortcuts.
    - make-server-shortcut.ps1    Re-creates Desktop .lnk icons.
    - debug-server.ps1 / debug-v2.ps1  Debug launchers.

    Verification scripts (50 verify-*.ps1 files):
    - verify-all.ps1             Run all verification scripts.
    - verify-v1-auth.ps1 through verify-v50-retail-board.ps1
      Each tests a specific feature: auth, amplify, ledger, supporters,
      profile, x-twitter, billing, reset-counter, AI events, platform,
      leaderboard exclusion, social, frontend integration, notes, crowdfund,
      auditorium, retail, clinic, studio, reminder, appstore, map, quanthom,
      arena, top-earners, top-winners, faq, new-pages-frontend, verification,
      live-updates, radar, url-button, inline-amplify, job-high-visibility,
      avatar-backcover, elist, premium-purchase-pages, quiz-scoreboard,
      url-tracking, marketing-avatar-bypass, urlfeed-open-modal, favicon-rebrand,
      homepage-button-swap, tracked-urls-dashboard, tracking-analytics,
      tracked-urls-backend, retail-marketplace, retail-board.

    Test scripts:
    - test-func.ps1, test-inline.ps1, test-pattern.ps1, test-pattern2.ps1
    - test-v2-a.ps1 through test-v2-trace.ps1

    Sub-dirs:
    - v1-v19/, v1-v31/, v20-v31/   Verification log archives (V1-V31).
    - verify-logs/                  Verification output logs (V32+).

 ==============================================================================
 SECTION 2 -- LAST PROMPT RESIDUE (UPDATE AFTER EVERY PROMPT RUN)
 ==============================================================================

 >> INSTRUCTIONS FOR AGENTS: After you complete your work, replace the entire
 >> paragraph below with a new one summarizing:
 >>   - What was worked on in this session
 >>   - What is yet to be completed
 >>   - What the current goal is
 >> This ensures any new workspace agent has immediate context if the
 >> previous workspace environment was changed or the session was lost.
 >> The paragraph should be concise (3-6 sentences) and factual.

 ----------------------------------------------------------------------------

 LAST RUN: 2026-08-24 (RENAME + UNGATE + NAVIGATION WIRING)

Current state: Renamed qwkpap/luck/try-your-luck to newquanthoms/new/
Get New Quanthoms across all files (QWK-030 system). Flipped ALL feature
flags to true in both frontend/js/flags.js and backend/flags.js.
Renamed qwkpromos.html to newquanthoms.html. Added newquanthoms.html
to the sidebar PAGES array in topbar-chips.js (Port of Commerce category,
clover icon, "New QU" label). The floating dock icon "Get New Quanthoms"
now shows because ads_new_panel flag is true. Added Rules 36 (new page
must be in sidebar + topbar), 37 (marketing/admin accounts always exempt
from gating), 38 (server consistency) to AGENTS.md. Added Section 11
(production accounts) to PRE-DEPLOY.md with full marketing and admin
account details.

What remains: Restart server to pick up flag changes (flags.js changed).
Hard refresh browser to see the dock icon and sidebar chip. Verify the
newquanthoms.html page loads with the advertising partner dashboard.
The QWK-030-TRY-YOUR-LUCK.md doc was deleted in git status -- it was
replaced by QWK-030-NEW-QUANTHOMS.md. The old doc filename reference
in QWK-MASTER-PIPELINE.md still needs updating.

Previous state: Factory.html mojibake recovered (2026-08-23). QWK-030
Get New Quanthoms complete (84/84 verify pass). QWK-029 delivery code
complete (155/155). QWK-011 complete. BMF QLUB Phase 1 verified (138 PASS).

RULES FOR AGENTS:
  - Read TASK-BREAKDOWN.md PRIORITY section for full details on each bug.
  - Read AGENTS.md Section 1 for directory map.
  - Follow Rule 16 (mojibake prevention) -- use ASCII-only in scripts.
  - After fixing, update TASK-BREAKDOWN.md status for your item.
  - When a bug is fully fixed, mark it [DONE] and SCRAP its detail block
    from TASK-BREAKDOWN.md (remove the section, keep only the STATUS MAP
    line). This keeps the document clean and reusable.
  - Update AGENTS.md Section 2 when done.

 ----------------------------------------------------------------------------

 ==============================================================================
 SECTION 3 -- DEVELOPER'S SKILLS / AGENTIC FACTORY
 ==============================================================================

 This section defines the complete development workflow. Every coding agent
 working on this project should follow these steps in order. Be detailed
 with instruction and harness skills to achieve maximum efficiency.

 ----------------------------------------------------------------------------

 3.1 GUARDRAILS / SPECS
 ----------------------------------------------------------------------------
 Before writing any code:
 - Read HANDOFF.md for current state.
 - Read PHASE-1-LINEUP-CURRENT.md for the sprint table.
 - Read the specific sprint spec in PHASE-1-SPRINT-PLAN.md.
 - Confirm the project root is C:\Users\lenovo\Documents\qwkbrowser.
 - Check that the server is running (health check on port 3001).
 - Understand the two-currency economy (QC soft, QU hard).
 - Know the 72 DB tables (re-read db.js on resume).
 - Follow the privacy-first defaults and idempotent schema migration pattern.
 - Never commit .env, database files, or .letta/ to git.
 - Use ASCII-only characters in all file edits (Windows encoding safety).
 - EXECUTION POLICY: Before writing or modifying any code, respond with a
   plain-language explanation of what the user wants done. Wait for the user
   to approve or correct before touching any files. See Section 6, Rule 11.

 3.2 ORCHESTRATING / PLAN
 ----------------------------------------------------------------------------
 - Work one sprint at a time. Do not batch multiple sprints.
 - After each code change, do file-only verification first (Read, Grep).
 - Then restart the server (scripts\restart-server-silent.ps1).
 - Then run the relevant verification bit.
 - If a bit fails: PAUSE. TRACE the root cause. FIX the defect. RE-RUN.
   Do NOT patch symptoms. Report to user with: what broke / where / fix /
   verify / next move. Wait for explicit permission to resume.
 - Track progress by updating PHASE-1-LINEUP-CURRENT.md checkboxes.
 - Update the LAST PROMPT RESIDUE (Section 2) after every session.

 3.3 BUILDING / DESIGNING
 ----------------------------------------------------------------------------
 - Backend: Node.js + Express + @libsql/client. Raw SQL (no ORM).
   Use prepared statements. Use CREATE TABLE IF NOT EXISTS + PRAGMA
   table_info for migrations. All schema changes must be idempotent.
 - Frontend: Vanilla ES6+. No build step. No framework. CSS custom
   properties for theming. IntersectionObserver for scroll animations.
   Fetch API for all HTTP. localStorage for token persistence.
 - Database: SQLite (WAL mode). Back up before schema changes.
 - API: All routes prefixed with /api. Bearer token auth. UUID v4 sessions.
 - When adding new routes: mount in server.js, add to this file's inventory.
 - When adding new frontend pages: add to this file's inventory, update
   the static file serving in server.js if needed.

 3.4 DESKTOP SERVER ICON
 ----------------------------------------------------------------------------
 - Desktop has 3 shortcuts: Start, Stop, Status (created by
   scripts\make-server-shortcut.ps1).
 - If shortcuts are missing, re-run that script.
 - Server starts detached and hidden (no console window).

 3.5 TEST SCRIPT
 ----------------------------------------------------------------------------
 - Verification scripts live in scripts/ (verify-v1 through verify-v50).
 - Each script tests a specific feature in 5-90 seconds.
 - Run individual bits after phase completion, not after every change.
 - New test scripts should follow the naming convention:
   scripts\\verify-v{number}-{feature-name}.ps1
 - For JS-based verification: scripts\\verify-v{number}-{feature}.js
 - All test scripts must output clear PASS/FAIL with diagnostic info.
 - IMPORTANT: The USER runs verification scripts, NOT the agent. The agent
   must NEVER run smoke tests or verification scripts directly. The agent
   should tell the user which scripts to run and how, then wait for the
   user to paste the results. This prevents the agent from getting stuck in
   test-debug loops that waste the user's time.

 3.6 VERIFIED LOG OUTPUT
 ----------------------------------------------------------------------------
 - Verification output is logged to scripts/verify-logs/ and data/ logs.
 - The verify.log file at project root captures the last verification run.
 - After verification, append results to verify.log with timestamp.
 - Format: [PASS/FAIL] [timestamp] [bit-name] [details]

 3.7 STARTUP SCRIPT
 ----------------------------------------------------------------------------
 - Preferred: scripts\restart-server-silent.ps1 (kills old, starts new).
 - Legacy: scripts\start-server-confirm.ps1 (popup-gated).
 - Desktop: Start/Stop/Status .bat files.
 - After restart, always run health check:
     Invoke-WebRequest 'http://localhost:3001/api/health' -UseBasicParsing -TimeoutSec 3
 - HTML file changes do NOT need a restart (served from disk).
 - ANY .js file change needs a restart.

 3.8 STATIC CONTEXT
 ----------------------------------------------------------------------------
 - Project docs that define the "what" and "why":
   HANDOFF.md, PROJECT_STATUS.md, PHASE-1-LINEUP-CURRENT.md,
   PHASE-1-SPRINT-PLAN.md, PRE-DEPLOY.md, TRUST_MODEL.md,
   DEPLOYMENT-GUIDE.md, BACKEND-INVENTORY.md, this AGENTS.md.
 - These are the source of truth. Code is the implementation.
 - When in doubt about a feature's spec, read the sprint plan.
 - When in doubt about the schema, read db.js.

 3.9 DYNAMIC CONTEXT
 ----------------------------------------------------------------------------
 - The LAST PROMPT RESIDUE (Section 2) is the dynamic context.
 - It changes after every session to reflect current state.
 - Git status and recent commits also provide dynamic context.
 - The database state (data/qwkbrowser.db) is the runtime truth.
 - Server logs (data/server.log, data/server.err) show recent behavior.

 3.10 FIXING API_BASE IN qwk.js (auto-detect production)
 ----------------------------------------------------------------------------
 - Frontend qwk.js currently uses a hardcoded or relative API_BASE.
 - For production: auto-detect if running on a production domain.
   If window.location.hostname is not localhost/127.0.0.1,
   point API_BASE to the Render backend URL (e.g. https://api.qwkbrowser.com/api).
   Otherwise use the local development URL (http://localhost:3001/api).
 - This must be done before deployment. Add to the pre-deploy sprint.

 3.11 FIXING CORS IN THE BACKEND (allow Vercel domain)
 ----------------------------------------------------------------------------
 - backend/server.js has a CORS configuration that uses FRONTEND_URL env var.
 - For production: set FRONTEND_URL to the Vercel frontend domain
   (e.g. https://qwkbrowser.vercel.app).
 - Verify: Access-Control-Allow-Origin is exactly the frontend origin (not *).
 - Verify: Access-Control-Allow-Credentials: true is present.
 - Test from the Vercel domain after deploy.

 3.12 TIGHTENING .gitignore
 ----------------------------------------------------------------------------
 Current .gitignore:
   .aider*
   node_modules/
   backend/node_modules/
   frontend/node_modules/
   .env
   dist/
   build/

 ADD these entries (they are currently missing):
   # Databases
   data/*.db
   data/*.db-wal
   data/*.db-shm
   data/*.db.backup-*
   # Logs
   data/server.log
   data/server.err
   data/*.log
   scripts/server-stdout.log
   scripts/server-stderr.log
   scripts/verify-logs/
   # Letta workspace
   .letta/
   # Temp files
   *.tmp
   _tmp_*
   _debug_*
   _inspect_*
   _fix_*
   _convert_*
   _remove_*
   _wire_*
   _check_*
   _phase1_*
   _sprint_*
   _server.*

 3.13 PUSHING REPOS WHEN READY
 ----------------------------------------------------------------------------
 - Ensure .gitignore is tight (see 3.12) before first push.
 - Ensure no secrets in .env are committed.
 - Use conventional commit messages.
 - Push backend and frontend as a single repo (monorepo) or split if needed.
 - Backend deployment target: Render (or Railway, Fly.io).
 - Frontend deployment target: Vercel (or Netlify).

 3.14 SETTING UP ALL HOSTING ACCOUNTS
 ----------------------------------------------------------------------------
 Required accounts for deployment:
 - GitHub (already have) -- source control.
 - Render (free tier available) -- backend hosting (Node.js web service).
 - Vercel (free tier available) -- frontend hosting (static files).
 - Domain registrar (Namecheap, Cloudflare, etc.) -- for custom domain.
 - Cloudflare (free) -- DNS management + CDN + DDoS protection.
 - Stripe (when ready for real payments) -- payment processing.
 - SendGrid or Resend (free tier) -- email verification + notifications.
 - Turso (free tier) -- managed SQLite if needed for production DB.

 3.15 PRE-DEPLOYMENT SUCCESSFUL REPORT
 ----------------------------------------------------------------------------
 Before deploying, generate a report covering:
 - All verification bits pass (1-50).
 - Environment variables validated (run envValidator).
 - CORS configured for the Vercel domain.
 - API_BASE auto-detection working in qwk.js.
 - .gitignore tight (no secrets, no DBs, no logs committed).
 - Database backed up.
 - All HTML pages load 200 with no console errors.
 - Health endpoint returns 200.
 - Referral redirect works (302 with cookie).
 - Save report as PRE-DEPLOY-REPORT.md in project root.

 3.16 SAVING FUTURE DOCUMENTATION TO MANAGE CODE PROJECT
 ----------------------------------------------------------------------------
 - Keep HANDOFF.md updated after every major session.
 - Keep PHASE-1-LINEUP-CURRENT.md checkboxes updated.
 - Keep this AGENTS.md Section 2 (LAST PROMPT RESIDUE) updated.
 - Save new architectural decisions to docs/ directory.
 - Maintain a CHANGELOG.md for user-facing changes.
 - Keep PROJECT_STATUS.md as the long-form reference (update quarterly).

 3.17 CONFIGURING WEBHOOKS THAT MATTER BEFORE DEPLOYMENT
 ----------------------------------------------------------------------------
 - Stripe webhook: POST endpoint for payment events (checkout.session.completed).
   Must be idempotent (check event ID before processing).
 - GitHub webhook: push events to trigger CI/CD (if using GitHub Actions).
 - Render deploy hook: auto-deploy on push to main branch.
 - Vercel deploy hook: auto-deploy on push to main branch.
 - X API webhook (if used): for real-time mentions or DMs.
 - Health check ping: UptimeRobot or BetterUptime (free) to monitor
   the /api/health endpoint every 5 minutes.

 3.18 RUNNING SMOKE TEST AGAINST PRODUCTION
 ----------------------------------------------------------------------------
 After deployment, run these checks from OUTSIDE the production server:
 1. curl https://api.yourdomain.com/api/health
    Expected: 200 OK with CSRF cookie.
 2. curl -i https://api.yourdomain.com/r/QWKDEMO
    Expected: 302 redirect with Set-Cookie: qwk_ref=<signed-value>.
 3. Open frontend in browser, check console for errors.
 4. Test signup + login flow end-to-end.
 5. Test quiz answer + QC award.
 6. Test profile panel load + update.
 7. Test referral link click + cookie set.
 8. Check CORS headers in DevTools Network tab.
 9. Verify no .env or database files are publicly accessible.
 10. Run verify-all.ps1 equivalent against production URLs.

 ==============================================================================
 SECTION 4 -- SUGGESTION ARC
 ==============================================================================

 >> INSTRUCTIONS FOR AGENTS: By logical default, ALWAYS suggest actions and
 >> tools that may not be known to the developer in order to achieve workarounds
 >> 1000% better and faster than the present situation. Cite free and paid
 >> options for executive considerations. Do this at the end of every response.

 ----------------------------------------------------------------------------

 When working on this project, proactively suggest improvements in these
 categories:

 4.1 PERFORMANCE
 - If the SQLite DB grows large, suggest Turso (managed libSQL, free tier)
   or PostgreSQL migration.
 - If static file serving is slow, suggest Cloudflare CDN (free) in front
   of the backend.
 - If the frontend grows complex, suggest a build step (Vite) for tree-
   shaking and minification -- but only when the complexity justifies it.

 4.2 SECURITY
 - Suggest rate limiting (express-rate-limit) if not yet implemented.
 - Suggest Helmet.js for security headers (free, 1-line middleware).
 - Suggest CSRF protection (csurf or double-submit cookie) if missing.
 - Suggest Secrets management (Doppler free tier, AWS Secrets Manager).
 - Suggest automated dependency scanning (Dependabot free, Snyk free tier).

 4.3 MONITORING
 - Suggest UptimeRobot (free) or BetterUptime for uptime monitoring.
 - Suggest Sentry (free tier) for error tracking.
 - Suggest Logflare or Logtail for structured log management.
 - Suggest PM2 or systemd for process management in production.

 4.4 CI/CD
 - Suggest GitHub Actions (free for public repos) for automated testing.
 - Suggest Vercel preview deployments for PR review.
 - Suggest Render auto-deploy on push to main.
 - Suggest Husky + lint-staged for pre-commit hooks.

 4.5 DEVELOPER EXPERIENCE
 - Suggest ESLint + Prettier if not configured (free, 5-min setup).
 - Suggest TypeScript migration (incremental, file-by-file) if the codebase
   grows past maintainability threshold.
 - Suggest Vitest or Jest for unit testing.
 - Suggest Playwright for E2E testing (free, cross-browser).

 4.6 DEPLOYMENT / INFRASTRUCTURE
 - Suggest Docker containerization for reproducible deploys.
 - Suggest Cloudflare Pages as an alternative to Vercel (free, unlimited
   bandwidth for static sites).
 - Suggest Fly.io as an alternative to Render (free tier, Docker-based).
 - Suggest Railway for backend hosting (free tier, simple deploys).

 4.7 COST OPTIMIZATION
 - Always cite free tier options alongside paid alternatives.
 - Suggest Cloudflare (free) for DNS + CDN + DDoS protection.
 - Suggest Turso (free tier: 500 DBs, 9 GB) for managed SQLite.
 - Suggest GitHub Actions (free for public repos) for CI/CD.
 - Suggest Vercel (free hobby tier) for frontend hosting.
 - Suggest Render (free tier) for backend hosting (with caveats: cold starts).

 4.8 AI / AGENT-SPECIFIC
 - Suggest using Letta Code subagents for parallel sprint execution.
 - Suggest using forked agents for code review before merge.
 - Suggest using the verification-bug-protocol skill for all testing.
 - Suggest using the fast-approach-protocol skill for rapid prototyping.
 - Suggest memory initialization (/init) in any new working directory.

 ==============================================================================
 SECTION 5 -- HOW TO ALERT AGENTS (SLASH COMMANDS + QUICK ACCELERATION)
 ==============================================================================

 5.1 AGENTS.md AUTO-READ
 ----------------------------------------------------------------------------
 Most modern coding agents (Claude Code, Codex, Aider, Cursor, etc.)
 automatically look for and read an AGENTS.md file in the project root
 before doing anything. This file IS that AGENTS.md. As long as this file
 exists, compatible agents will read it automatically.

 For agents that do NOT auto-read AGENTS.md, include this line at the top
 of your prompt:
   "Read AGENTS.md in the project root before doing anything else."

 5.2 LETTA CODE SLASH COMMAND (CUSTOM MOD)
 ----------------------------------------------------------------------------
 For Letta Code specifically, you can create a custom slash command that
 forces the agent to read this guide. The slash command is implemented as
 a mod in the ~/.letta/mods directory.

 To create the /guide slash command:

 1. Create the directory if it does not exist:
    New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.letta\mods"

 2. Create a file at:
    $env:USERPROFILE\.letta\mods\guide-command.js

 3. Contents (see the companion file created alongside this guide):
    The mod registers a /guide slash command that injects a system message
    telling the agent to read AGENTS.md before proceeding.

 4. Reload mods in Letta Code with /reload.

 5.3 QUICK ACCELERATION COMMANDS
 ----------------------------------------------------------------------------
 For fast task handoff, use these prompt prefixes with any coding agent:

 - "/guide" (Letta Code only) -- forces read of this file.
 - "Read AGENTS.md, then: [task]" -- universal prefix for any agent.
 - "Resume from HANDOFF.md, then: [task]" -- for continuation work.
 - "Sprint [name]: Read PHASE-1-LINEUP-CURRENT.md for context, then: [task]"
   -- for sprint-specific work.

 5.4 LETTA CODE SPECIFIC SHORTCUTS
 ----------------------------------------------------------------------------
 - /init -- initialize agent memory in the current working directory.
 - /doctor -- check system prompt health and memory size.
 - /reload -- reload mods after adding/editing slash commands.
 - /rename -- change the agent's name.
 - /description -- change the agent's description.
 - Subagent dispatch: use the Agent tool to fork parallel workers.
 - Cron scheduling: use "letta cron add" for recurring tasks.

 ==============================================================================
 SECTION 6 -- CRITICAL RULES (NON-NEGOTIABLE)
 ==============================================================================

 1. NEVER commit .env, database files, or .letta/ to git.
 2. NEVER use em-dashes or special Unicode in file edits (Windows safety).
 3. NEVER use bash heredocs on Windows (use quoted strings).
 4. NEVER use && for command chaining in PowerShell (use ; or separate calls).
 5. ALWAYS read this file before starting work.
 6. ALWAYS restart the server after any .js file change.
 7. ALWAYS back up the database before schema changes.
 8. ALWAYS update Section 2 (LAST PROMPT RESIDUE) after completing work.
 9. ALWAYS run verification after completing a phase.
 10. ALWAYS suggest improvements per the SUGGESTION ARC (Section 4).
 11. EXECUTION POLICY -- ANTI-HALLUCINATION AND SCOPE DISCIPLINE

     11.1 EXPLAIN BEFORE YOU ACT
     Before modifying or creating any code, the agent MUST respond with a
     plain-language explanation of what it understands the task to be: what
     the user wants done, which files or functions are involved, and what the
     end result should look like. The agent must then WAIT for the user to
     review and approve or correct. The agent must NOT write, edit, or create
     any code until the user explicitly approves.

     11.2 DO EXACTLY WHAT IS ASKED -- NOTHING MORE, NOTHING LESS
     The agent must execute the exact scope of the request. It must not add
     features, files, functions, refactors, or "improvements" the user did
     not ask for. If the agent thinks something else should be changed, it
     must SUGGEST it in plain text and wait for approval -- not do it silently.

     11.3 DO NOT EDIT OUTSIDE THE SCOPE
     The agent must not rename, restructure, reorder, reformat, or "clean up"
     any code outside the exact scope of the task. Dead code removal is allowed
     only when the user explicitly asked for it or when it directly blocks the
     requested change.

     11.4 READ BEFORE YOU WRITE -- NEVER GUESS AT CODE
     The agent must Read the actual file before editing it. It must not work
     from memory, assumptions, or prior context about what the code "probably
     looks like." If the agent cannot see the current state of the code, it
     must say so and read it first.

     11.5 IF IT DOES NOT EXIST, SAY SO
     If a route, function, variable, file, or endpoint the agent assumes
     exists does not actually exist, the agent must state clearly: "This does
     not exist." The agent must never hallucinate the existence of code,
     APIs, database tables, or file paths. When unsure, the agent must verify
     by reading the relevant file or searching the codebase.

     11.6 WHEN UNSURE, ASK -- DO NOT GUESS
     If the agent is uncertain about the user's intent, the correct approach,
     or the expected result, it must ask a direct question and wait for the
     answer. It must not pick a direction and hope it is right.

     11.7 NO SILENT SIDE EFFECTS
     The agent must not run background tasks, start servers, install packages,
     modify configs, or take any action the user did not request. Every
     action must be visible and accounted for in the conversation.

     These rules apply to ALL codebase changes -- new functions, modifications
     to existing code, new files, schema changes, and configuration edits.
     They do NOT apply to read-only operations (reading files, searching
     code, answering questions, running verification scripts).

 ==============================================================================
12. COMMIT DISCIPLINE -- SAVE BEFORE YOU BREAK
     Commit your work BEFORE doing anything that could break or overwrite it.
     Specifically, commit before:
       - Pulling new changes or merging branches
       - Running destructive or schema-changing scripts
       - Starting a major refactor or renaming pass
       - Asking an agent to make changes across many files
       - Any operation where "if this goes wrong, I'd lose work"
     Commit when you have something working that you would be unhappy to lose.
     Do not commit after every function -- commit after every meaningful unit
     of work that represents a stable, working state. Use checkpoint commit
     messages (e.g. "checkpoint: <summary of what's stable>") for batch saves.

 13. SUGGEST ENHANCEMENTS -- PROFESSIONAL, UNIQUE, BREAKTHROUGH

     When the user asks the agent to write code for a function, design a
     feature, or build anything, the agent MUST -- in addition to doing the
     work -- suggest what other things could be added to that task to make
     it look professional, unique, or a breakthrough concept. These
     suggestions should be:
       - Concrete and specific to the thing being built (not generic).
       - Forward-looking: features, patterns, or ideas that elevate the
         work beyond a basic implementation.
       - Categorized as: Professional (industry-standard polish),
         Unique (differentiators from competitors), or Breakthrough
         (novel concepts that could redefine the space).
     The agent presents these suggestions after completing the requested
     work, clearly separated from the deliverable, and waits for the user
     to decide which (if any) to pursue.

 14. CROSS-DEVICE BACKEND INFRASTRUCTURE -- ALL DATA IS BACKEND-BACKED

     14.1 CORE PRINCIPLE
     Everything in this app is cross-device backend infrastructure.
     Placeholder content/data, real content/data, and static data are
     ALL served from the backend or rendered with backend-backed
     fallbacks. No page should ever appear empty because a localStorage
     migration is incomplete or an API endpoint is missing.

     14.2 PLACEHOLDER / DEMO / MOCK CONTENT RULES
     - Every page that displays lists, feeds, stats, or content MUST
       have placeholder/demo/mock content that renders immediately on
       page load -- BEFORE any API call completes.
     - If the API returns empty data (empty array, not an error), the
       placeholder content MUST remain visible. Do NOT clear placeholders
       when the API returns an empty result.
     - If the API returns real data, prepend or merge it with the
       placeholders. Real data on top, placeholders as filler below.
     - If the API call fails (network error, 500, timeout), the
       placeholder content MUST remain visible.
     - When restoring or adding placeholder content, the agent MUST
       follow the existing design system: same CSS classes, same color
       palette, same card layouts, same typography. Do NOT invent new
       designs, new component styles, or new visual patterns for
       placeholder content. Copy the style of existing placeholders
       on the homepage sidebar and factory feed.

     14.3 LOCALSTORAGE POLICY
     - localStorage is ONLY for:
       (a) Auth token (qwk_token) -- session credential, sent as
           Bearer header on every API call. MUST stay in localStorage.
       (b) User cache (qwk_user) -- profile snapshot for instant UI
           render. MUST stay in localStorage.
       (c) UI state -- theme preference, nav flyout collapse state,
           factory draft (unsaved post composer). Local-only is fine.
     - localStorage is NOT a data store. It is a cache and a session
       holder. All real data (notes, reminders, calendar events,
       translations, amplifications, raffle entries, notifications,
       messages) MUST be fetched from the backend API.
     - When migrating a feature from localStorage to backend:
       1. Add the backend endpoint first.
       2. Add the API fetch call.
       3. Keep localStorage as a FALLBACK for guests and as a one-time
          migration source (lift legacy data into the backend, then
          remove the localStorage key).
       4. Do NOT remove localStorage fallback until the backend
          endpoint is confirmed working.
       5. Do NOT clear localStorage data until the one-time migration
          lift has successfully copied it to the backend.

     14.4 RAFFLE COUNTDOWN (TOPBAR)
     - The raffle countdown chip in the topbar must eventually fetch
       the real next-draw time from the backend (e.g.
       /api/factory/raffle/status) and count down to that timestamp.
     - Until the backend endpoint exists, the hardcoded countdown
       (13:32:00) is acceptable as a placeholder, but the flyout values
       (prize pool, picks, yesterday results) should also be fetched
       from the API, not hardcoded in the HTML string.
     - The raffle ticket count is already API-driven
       (fetchRaffleTickets -> /factory/raffle/status). Follow that
       pattern for the rest of the flyout data.

     14.5 GENERATOR (TOPBAR)
     - The generator flyout is already API-driven
       (/profile/generator, /profile/generator/reset). This is the
       correct pattern. Do not change it to localStorage.

     14.6 DESIGN INTEGRITY
     - When any agent restores or adds placeholder content, it MUST
       match the existing visual design. Read the current page's CSS
       and the homepage sidebar styles before writing placeholder HTML.
       Use the same classes, colors, spacing, and component structure.
       Do NOT introduce new CSS frameworks, new color values, or new
       layout patterns. If the existing design uses CSS custom
       properties (--accent, --card, --border, etc.), use those.
       Do NOT hardcode hex colors in placeholder content.

 15. VERIFICATION TEST JUDGMENT -- TEST WHAT MATTERS, SKIP WHAT DOESN'T

     15.1 CORE PRINCIPLE
     A function can work without a verification test. Manual testing
     catches plenty. Verification tests are not required for code to
     function -- they are required for code to KEEP functioning correctly
     over time as the codebase changes around them.

     15.2 WHAT A VERIFICATION TEST BUYS YOU
     - Regression protection: You change something unrelated weeks later,
       the test fails, and you know immediately. Manual testing only
       catches it if you happen to re-test that exact path -- which you
       won't, because you'll forget it existed.
     - Executable documentation: The test shows what the function is
       supposed to do. Someone reading the code (including future you)
       doesn't have to guess the expected behavior.
     - Design pressure: If a function is hard to test, it's usually
       because it's doing too much, has hidden dependencies, or mixes
       concerns. The test forces you to see that.

     15.3 WHAT DESERVES A VERIFICATION TEST
     - Core logic with branching behavior: calculations, transformations,
       state transitions, validation rules, anything where wrong output
       causes a real problem.
     - If there are multiple paths through the code (if/else, edge cases,
       error states), each path is a test.
     - If getting this function wrong would silently corrupt data, break
       something downstream, or be hard to notice until it's too late --
       test it.
     - Examples in this codebase: raffle verification logic, auth flows,
       block/mute/report systems, ledger operations, referral attribution.

     15.4 WHAT DOES NOT DESERVE A VERIFICATION TEST
     - Pure wiring: connecting a button to a handler, routing, layout,
       visual styling.
     - If the only way it can break is visible on screen, manual testing
       is faster and more honest than a test.
     - If it would be immediately obvious from clicking around -- skip it,
       or test it only when it's already broken and you want to lock the
       fix.

     15.5 DECISION RULE
     Before writing a verification test, ask:
       1. If this function silently broke, would I notice before a user did?
       2. Are there multiple code paths that could diverge?
       3. Would a future change elsewhere in the codebase plausibly break this?
     If YES to any of these -- write the test.
     If NO to all -- manual testing is sufficient.

 16. ENCODING INTEGRITY -- PREVENT DOUBLE-UTF-8 CORRUPTION (MOJIBAKE)

     16.1 WHAT HAPPENED
     On 2026-08-04, six files were corrupted by double-UTF-8 encoding
     (mojibake). Every em-dash (--), emoji, box-drawing character,
     multiplication sign (x), and other non-ASCII characters were
     re-encoded, producing garbage like:
       --  became  A-cents-a--a (visual: AAa)
       x   became  A-currency-a (visual: A)
       emoji became  A-deg-A--a (visual: AA)
     This broke HTML structure, JS template literals, and CSS comments
     across factory.html, homepage.html, userprofile.html, _check.js,
     db.js, and routes/factory.js. The corruption was invisible to the
     user until they opened the pages in a browser and saw missing
     sections, broken sidebars, and garbled text.

     16.2 ROOT CAUSE
     A tool, editor, or agent saved files with the wrong encoding --
     reading UTF-8 bytes as Latin-1 (ISO-8859-1) and then re-encoding
     as UTF-8. This doubles the encoding and destroys every non-ASCII
     character. On Windows, this happens when:
       - An editor defaults to Latin-1 or Windows-1252 instead of UTF-8
       - A script reads a file without specifying UTF-8 encoding
       - A tool pipes content through a codepage that is not UTF-8
       - Multiple agents edit the same file with different encoding
         assumptions

     16.3 MANDATORY RULES
     a. ALL file reads and writes MUST use UTF-8 encoding.
        - In PowerShell: use -Encoding UTF8 on Get-Content/Set-Content
          or [System.IO.File]::ReadAllText/WriteAllText with UTF8.
        - In Node.js: use fs.readFile/writeFile with 'utf8' encoding.
        - Never read or write files without specifying encoding.

     b. NEVER save files as UTF-8 with BOM unless the file already has
        a BOM. BOM bytes (EF BB BF) at the start of HTML/JS/CSS files
        can break things silently.

     c. NEVER use an external editor that defaults to Windows-1252 or
        Latin-1 to edit files in this repository. If you open a file in
        VS Code, Notepad++, or any editor, verify the encoding is
        UTF-8 (without BOM) before saving.

     d. BEFORE committing, scan for mojibake. Run:
          git diff HEAD -- <file> | findstr /C:"A-cents" /C:"A-deg"
        If any line matches, the file is corrupted. Restore from the
        last clean commit:
          git checkout HEAD -- <corrupted-file>

     e. If mojibake is detected, DO NOT try to "fix" it by editing the
        corrupted characters. Restore the file from the last clean git
        commit instead. Editing corrupted files bakes the garbage in
        deeper and risks losing real work mixed into the corruption.

     f. If you are an agent using the Edit or Write tool, the tool
        handles encoding correctly. The corruption comes from external
        tools, not from the agent's own edit operations. Do not
        compound the problem by running external scripts that re-encode
        files.

     g. Em-dashes and special Unicode already cause issues on Windows
        (see Rule 2). This rule extends that: not only should agents
        AVOID using em-dashes and special Unicode in NEW code, but they
        must also PROTECT existing Unicode in files they edit by
        ensuring encoding is never changed during read/write cycles.

     16.4 RECOVERY PROCEDURE
     If mojibake is discovered:
       1. Identify all corrupted files (scan with the findstr command
          above or check git diff for non-ASCII garbage).
       2. Check whether the corrupted files have any REAL new work
          mixed in with the encoding damage (rare but possible).
       3. If no real work in the diff: restore from HEAD.
            git checkout HEAD -- <file1> <file2> ...
       4. If real work is mixed in: carefully extract the real changes
          from the diff, restore the file from HEAD, then re-apply
          only the real changes manually.
       5. Verify the restored files are clean:
            Get-Content <file> -Raw -Encoding UTF8 | findstr "A-cents"
          (should return nothing)
       6. Commit the restored files with a message noting the recovery.

17. TASK STATUS TRACKING -- NO DUPLICATE WORK

     17.1 CORE PRINCIPLE
     Before starting any task listed in TASK-BREAKDOWN.md, the agent MUST
     check the STATUS MAP at the top of that file. The status markers are:
       [DONE]      -- backend + frontend + verification script all present.
                      Do NOT re-do this task. If a fix is needed, state what
                      is broken and wait for user approval.
       [NO-VERIFY] -- backend + frontend done, no verification script.
                      The task itself is complete. Only write a verification
                      script if the user asks for one.
       [WIRED]     -- backend + frontend done (visual-only or config-pending).
                      Do NOT re-do the implementation. Only act if the user
                      asks for a verification script or config change.
       [STUB]      -- frontend element exists but is a stub, no-op, mock, or
                      partial implementation. The agent MAY complete the
                      remaining wiring, but MUST state which parts are done
                      and which parts are stubs before touching anything.
       [MISSING]   -- neither backend nor frontend exists. The agent may
                      implement this task from scratch.

     17.2 WHAT TO DO BEFORE STARTING WORK
     1. Read TASK-BREAKDOWN.md, specifically the STATUS MAP.
     2. Find the task you are about to work on.
     3. Check its status marker.
     4. If [DONE] or [WIRED]: tell the user it is already done and ask if
        they want something specific changed. Do NOT re-implement.
     5. If [NO-VERIFY]: tell the user the task is done but has no
        verification script. Ask if they want one. Do NOT re-implement.
     6. If [STUB]: tell the user which parts are done and which are stubs.
        Only implement the stub parts. Do NOT touch the working parts.
     7. If [MISSING]: proceed with implementation.

     17.3 WHAT TO DO AFTER COMPLETING WORK
     1. Update the STATUS MAP in TASK-BREAKDOWN.md with the new status.
     2. If the task now has backend + frontend + verification script, mark
        it [DONE].
     3. If backend + frontend are done but no verification script was
        written, mark it [NO-VERIFY] (or [WIRED] for visual-only tasks).
     4. If the task is partially done, mark it [STUB] and note what remains.
     5. Update the KNOWN DEFECTS section if new defects were discovered.

     17.4 VERIFICATION SCRIPT STALENESS
     If a verification script asserts table names, file names, or endpoint
     paths that no longer exist (due to renames or deletions), the script is
     STALE. Mark it as stale in the STATUS MAP. Do NOT delete the script.
     Report the staleness to the user and let them decide whether to update
     or remove it.

     17.5 BUFF AUDIT CADENCE
     The STATUS MAP should be re-verified by BUFF (or equivalent read-only
     audit) whenever significant work has been completed across multiple
     tasks. The audit prompt is in the BUFF DELEGATION GUIDE. Run it,
     update the STATUS MAP, then resume work. Do NOT guess at status --
     verify it.

18. CONTINUITY -- HALF-DONE OR INTERRUPTED TASKS

     18.1 CORE PRINCIPLE
     If an agent is deleted mistakenly, or if a project the current agent is
     instructed to work on was left half-done by a previous task/agent, the
     agent MUST suggest creating a STANDALONE MARKDOWN DOCUMENT for that task.

     18.2 WHEN TO SUGGEST IT
     - The user mentions an agent was deleted or reset before work finished.
     - The codebase contains partial, broken, or clearly unfinished work that
       the user expects the current agent to continue.
     - The task spans multiple sessions and there is no existing standalone
       spec, checkpoint, or handoff document.

     18.3 WHAT THE DOCUMENT MUST CONTAIN
     1. Task name and one-sentence goal.
     2. Files touched and their current state.
     3. What was completed in the previous attempt.
     4. What remains to be done.
     5. Known blockers, defects, or decisions the user must make.
     6. The next concrete action the next agent should take.

     18.4 WHERE TO PUT IT
     Create the document in the docs/ directory at the repository root, named
     after the task (e.g., docs/TASK-NAME-HANDOFF.md). Update the STATUS MAP
     in TASK-BREAKDOWN.md to reference it.

END OF MANDATORY MEMORY GUIDE
 ==============================================================================

 =============================================================================
 SECTION 19 -- POST SYSTEM TAGS (3 UNIFORM TAGS PER POST)
 =============================================================================

 Every post in the factory feed renders 3 system tags before any user tags.
 These are derived from post properties -- never manually added. The source
 of truth is the POST_SYSTEM_TAGS config object in factory.html.

 19.1 THE 3 TAG CATEGORIES
   1. Content Type  -- derived from post.kind (Photo, Video, AI Studio, Platform)
   2. Browser       -- always present; opens in-app browser viewport (pending)
   3. Action         -- OPEN-ENDED. Each post type has a slot in POST_ACTIONS.
      The user dictates the action phrase for each type as we build it.
      Until set, the tag shows "Set Action" at 50% opacity as a placeholder.

 19.2 THE ACTION LINEUP (POST_ACTIONS)
   Each key matches a data-filter value from the feed filter chips.
   null = not yet dictated. To set one:
   POST_ACTIONS['job'] = { label: 'Apply Now', icon: 'briefcase', onclick: 'applyJob' };

   Content types:
     - photo              : null
     - short              : null
     - long               : null
     - article            : null
     - ai                 : null

   Platform post types:
     - webcode            : null
     - amp-unit           : null
     - amp-credit         : null
     - note               : null
     - job                : null
     - reminder           : null
     - elist              : null
     - crowdfund          : null
     - direct-marketing   : null
     - retail             : null
     - raffle-content     : null
     - broadcast-schedule : null

   Special filters (may not need action phrases):
     - gated              : null
     - live               : null
     - replay             : null
     - following          : null
     - factory            : null

 19.3 WHERE TO ADD NEW TYPES
   - New content type: add to POST_SYSTEM_TAGS.contentType
   - New action: add a key to POST_ACTIONS with { label, icon, onclick }
   - New browser behavior: modify POST_SYSTEM_TAGS.browser and implement
     openBrowserViewport()

 19.4 RULES
   - System tags are ALWAYS rendered first, before user tags.
   - System tags use the .sys-tag CSS class with data-cat attribute for styling.
   - User tags (post.tags) remain unchanged and render after the system tags
     via renderTags().
   - Never push system tags into post.tags -- they are separate.
   - getSystemTags(post) always returns exactly 3 tags.
   - The divider (.sys-tag-divider) separates system tags from user tags.
   - Action phrases are NEVER hardcoded in getSystemTags() -- they come from
     POST_ACTIONS lookup. The user sets them one at a time.

 ==============================================================================
 20. REVIEW AGENT SUMMARY RULE -- SPEC BEFORE BUILD
 ==============================================================================

     Before building any new feature or modifying existing code, the agent
     MUST provide a plain-language summary of what is needed, based on what
     the user has shared. This summary is written so the user can forward it
     to their review agent (external AI) who will provide formal specs,
     well-researched concept approaches, and architecture recommendations.

     The summary must include:
       - What the feature does (one paragraph)
       - What the user has described or provided
       - What is known vs what needs research
       - Key design questions the review agent should answer
       - Any dependencies on other QWK features

     The agent does NOT start coding until:
       1. The summary has been delivered to the user
       2. The user has sent it to the review agent
       3. The user has returned with the review agent's response
       4. The user has approved the final approach

     Exception: if the user explicitly says "just build it" or "start now",
     the agent may proceed without the review agent cycle. But the summary
     must still be written first so the user has the option to send it.

 ==============================================================================
 21. COMMIT CHECKPOINT RULE -- SAVE BEFORE HIGH-RISK CHANGES
 ==============================================================================

     If a new task reaches a 50% or higher risk capacity of breaking the
     existing codebase, the agent MUST:
       1. Commit the current working state immediately
       2. Save the commit reference (hash) to the commit checkpoint log
          at docs/COMMIT-CHECKPOINTS.md
       3. Record: commit hash, date/time, and a brief description of the
          latest breakthrough or stable state before the commit
       4. Only then proceed with the high-risk changes

     The commit checkpoint log is a standalone MD document with a table:

       | Commit # | Date/Time | Latest Breakthrough Before Commit |
       |----------|-----------|-----------------------------------|
       | abc1234  | 2026-08-15 14:30 | Description of stable state |

     "50% high risk capacity" means any of:
       - Schema changes (new tables, altered columns, migrations)
       - Changes to more than 3 existing files simultaneously
       - Changes to core files (db.js, server.js, factory.html, auth.js)
       - Changes that affect authentication, payments, or data integrity
       - Changes that modify existing API endpoints (not just adding new ones)
       - Any change the agent believes could break existing functionality

     This rule ensures the user can always roll back to a known stable state
     and never loses work because an agent broke something mid-task.

=============================================================================
22. SPEC TRACKING -- ALWAYS REPORT POSITION IN SPEC MD
=============================================================================

     When working from a standalone specification document (e.g.,
     docs/BMF-QLUB-SPEC.md), the agent MUST provide an implementation
     summary at the start of every response. This summary includes:

       1. Which step(s) of the spec were just completed
       2. Which step(s) are currently in progress
       3. Which step(s) remain to be done
       4. The current phase and overall progress percentage

     Format (concise, no fluff):

       SPEC: docs/EXAMPLE-SPEC.md
       Phase 1 -- Step 1.3 done, Step 1.4 in progress, Steps 1.5-1.7 remain
       Overall: 3 of 7 steps complete (43%)

     This rule exists so the user never has to ask "where are we?" when
     following a multi-session spec. The agent tracks position proactively
     and reports it every turn, not just when asked.

     If the spec document is updated mid-build (new sections added, steps
     revised), the agent MUST re-read the spec, update its tracking, and
     report the new position before continuing work.

=============================================================================
23. STUCK FEEDBACK -- REPORT WHEN BLOCKED FOR 5+ MINUTES
=============================================================================

     If the agent is stuck in one place for more than 5 minutes -- whether
     waiting on a tool, unable to resolve an error, circling on a decision,
     or blocked by missing context -- the agent MUST immediately write a
     feedback message to the user explaining:

       1. What it is stuck on (the specific problem, not vague language)
       2. What it has tried so far
       3. What it thinks the issue is
       4. What it needs from the user (if anything) to proceed

     This rule exists because an agent going silent for extended periods
     erodes trust. The user should never have to wonder "what is going on?"
     or send a follow-up message asking for status. The agent communicates
     proactively when it hits a wall.

     "Stuck" means any of:
       - The same error repeating after 2+ attempts to fix it
       - A tool call failing repeatedly with no path forward
       - The agent cannot determine the next concrete action
       - The agent is deliberating between approaches without committing
       - More than 5 minutes of wall-clock time on a single sub-problem

     If the agent cannot resolve the issue after reporting, it must:
       1. State what it will do next (try a different approach, ask the
          user for input, or stop and wait for direction)
       2. NOT continue spinning silently

     This is a hard timeout on silent stuck states. Communicate first,
     then act.

=============================================================================
23. STUCK FEEDBACK RULE -- REPORT WHEN BLOCKED
=============================================================================

     If the agent is stuck in one place for more than 5 minutes (unable to
     make progress on the current task, spinning on the same problem, or
     blocked by an unresolved issue), the agent MUST:

       1. Stop and write a feedback message to the user explaining:
          - What the current blocker is
          - What has been tried so far
          - What the agent thinks the issue is
          - What options or next steps are available
       2. Do NOT continue silently spinning. Do NOT keep retrying the same
          approach hoping it works on the next attempt.
       3. The user should never have to guess that the agent is stuck.
          Silence is not acceptable when progress has halted.

     This rule exists because the user's time matters. An agent that is
     stuck for 30 minutes without saying anything has wasted half an hour
     of the user's day. Early feedback lets the user redirect, provide
     missing context, or unblock the agent -- often in seconds.

=============================================================================
24. PRE-DEPLOY PROTOCOL -- READ BEFORE ANY DEPLOY OR FEATURE ROLLOUT
=============================================================================

    Before any deploy, feature rollout, or production change, the agent
    MUST read docs/PRE-DEPLOY.md in full. This document defines:

      - The feature flag system (frontend/js/flags.js + backend/flags.js)
      - Backward-compatible database change rules
      - Route isolation rules
      - Gradual rollout procedure
      - The pre-launch checklist (7 sections, all must pass)
      - The launch sequence (Phase 0 through Phase 4)

    Key rules from PRE-DEPLOY.md that apply at all times:

    24.1 Every feature that is not 100% verified MUST have a flag entry
         set to false in both flag files. A feature with no flag is
         assumed to be CORE (always on). If you are not sure it is
         core, add a flag and set it to false.

    24.2 When building a new feature, add its flag entry (set to false)
         BEFORE writing the feature code. The feature is dormant from
         the moment it exists in the repo.

    24.3 Never flip a flag to true without running the pre-launch
         checklist (PRE-DEPLOY.md Section 7) for that specific feature.

    24.4 If a user reports a broken feature and its flag is true, flip
         it to false immediately. Stabilize first, debug second.

    24.5 The flag state table in PRE-DEPLOY.md Section 10 must be
         updated whenever a flag changes. This is the source of truth
         for what is live.

    24.6 Schema changes are high-risk (Rule 21). Always back up the
         database, commit, and log in COMMIT-CHECKPOINTS.md before any
         ALTER TABLE or CREATE TABLE.

    24.7 FEATURE FLAG EXEMPTIONS. A feature does NOT need a flag entry if
         it meets ALL of the following criteria:
           (a) It does not require VIDEO, AUDIO, or IMAGE processing.
           (b) It does not require a capability the platform does not
               already have (e.g., Stripe webhooks, external API
               integrations that are not yet built).
           (c) It uses only existing DB tables, existing API patterns,
               and existing frontend conventions (vanilla JS, fetch API,
               CSS custom properties).
         Features that meet these criteria are CORE and are always on.
         They do not get flag entries. The flag system exists to gate
         features that depend on infrastructure we have not verified or
         media processing we have not built. A feature built entirely
         with existing primitives (DB reads/writes, ledger entries,
         fetch calls, HTML/CSS/JS) is not a risk -- it is the same
         surface that already works.

=============================================================================
25. TOOL SUBSTITUTION -- MANDATORY WINDOWS/POWERSHELL COMPLIANCE
=============================================================================

     This rule is NON-NEGOTIABLE. It applies to EVERY agent, EVERY tool call,
     EVERY session. Violating this rule causes stuck states, silent failures,
     and wasted time. There are NO exceptions.

     25.1 THE RULE
     This is a Windows + PowerShell environment. Unix/bash tools DO NOT EXIST
     here. Any attempt to use grep, find, cat, sed, awk, head, tail, curl, wc,
     touch, rm, cp, mv, ls, mkdir, chmod, or which/where WILL FAIL and get
     the agent stuck. Agents MUST use the PowerShell or built-in tool
     alternative instead. See the TOOL SUBSTITUTION TABLE at the top of this
     file (lines 42-71) for the complete mapping.

     25.2 BUILT-IN TOOLS COME FIRST
     When the agent has access to Letta Code built-in tools (Read, Grep,
     Glob, Edit, Write), those MUST be used INSTEAD of any shell command:
       - Reading a file: Use the Read tool. NEVER use Get-Content or cat.
       - Searching file contents: Use the Grep tool. NEVER use Select-String
         or grep.
       - Finding files: Use the Glob tool. NEVER use Get-ChildItem or find.
       - Editing a file: Use the Edit tool. NEVER use sed or -replace.
       - Writing a file: Use the Write tool. NEVER use echo or Set-Content.
     Shell commands (PowerShell) are the FALLBACK, used only when the
     built-in tools are insufficient for the task.

     25.3 NO UNIX COMMAND CHAINING
     NEVER use && to chain commands. PowerShell uses ; (semicolon) or
     separate command calls. NEVER use heredoc syntax (<<EOF). Use
     single-quoted multiline strings instead.

     25.4 IF ANYTHING FAILS, SUBSTITUTE -- DO NOT RETRY, DO NOT LOOP
     This applies to ALL commands, tools, and operations -- not just Unix
     tool failures. If ANY command, script, or tool call fails or gets stuck:

       1. STOP. Do not retry the same approach. Do not retry a variation of
          the same approach hoping it works the second time.
       2. SUBSTITUTE. Immediately switch to the alternative:
          - Unix tool failed? Use the PowerShell equivalent from the table.
          - PowerShell command failed? Use the built-in Read/Grep/Glob/Edit
            tool instead.
          - Built-in tool failed? Try the PowerShell equivalent.
          - Server won't start? Check the error log, fix the root cause,
            then restart. Do NOT just keep restarting.
          - Script hangs or times out? Kill it, report to the user, and
            try a different approach.
       3. MOVE ON. After substituting, continue the task. Do not stop and
          explain at length what happened -- one line is enough. The user
          cares about progress, not the failure history.
       4. NEVER LOOP. If the substitute also fails, do NOT try a third
          variation of the same thing. Report to the user with: what
          failed, what was tried, what is needed. Then wait.

     The principle: ONE attempt, ONE substitute, then MOVE ON or ASK.
     Never retry the same failing approach. Never loop on failures.
     This rule exists because stuck loops waste the user's time and
     erode trust. Progress over perfection. Substitute and move on.

     25.5 THIS RULE OVERRIDES MUSCLE MEMORY
     Many agents default to Unix commands from training data. This rule
     exists to override that default. When in doubt, check the table. When
     still in doubt, use the built-in Read/Grep/Glob tools. When STILL in
     doubt, ask the user instead of guessing and getting stuck.

26. MASTER PIPELINE TRACKING -- STANDALONE TASK CREATION
     When the user asks you to create a standalone task (a new feature,
     bug fix, or any work item that would get a QWK-XXX ID), you MUST:
       1. Read AGENTS.md (you are already here).
       2. Add a highlight entry to docs/QWK-MASTER-PIPELINE.md using the
          standard format (ID, Status, Spec, Dependencies, Notes).
       3. Include the spec MD reference (or "NEEDED" if no spec exists yet).
       4. Set the initial status (usually PLANNED or SPEC-READY).
     Never create a standalone task without adding it to the master pipeline
     first. The pipeline is the single source of truth -- if it is not in
     the pipeline, it does not exist.

27. MASTER PIPELINE UPDATE BEFORE ANY TASK
     Whenever you read AGENTS.md before starting a task, you MUST FIRST
     update docs/QWK-MASTER-PIPELINE.md:
       1. Find the task's QWK-XXX entry in the pipeline.
       2. Update its status to reflect current reality (IN-PROGRESS, DONE,
          BLOCKED, DEFERRED, etc.).
       3. Update the spec MD reference if a new spec was created.
       4. Add any new dependencies or notes discovered.
     This ensures the pipeline is always current before work begins. The
     user should be able to look at the pipeline at any time and see the
     real state of every task. Do not skip this step -- it is mandatory
     even for small tasks or quick fixes.

28. RESPONSIVE DESIGN -- MANDATORY BREAKPOINTS
     Every page in QwkBrowser MUST work on phones, tablets, and desktops.
     Social platforms are used on phones first. If you build or modify any
     page layout, you MUST include responsive breakpoints using the standard
     values defined in docs/RESPONSIVE-BREAKPOINTS.md.
       - Phone: <= 480px (tighter padding, scrollable tabs, smaller avatars)
       - Tablet: <= 1024px (single-column collapse for multi-column grids)
       - Desktop: > 1024px (full multi-column layout)
     Do NOT invent custom breakpoints. Do NOT build desktop-only pages.
     Before declaring a page done, mentally test it at 375px (iPhone SE).
     See docs/RESPONSIVE-BREAKPOINTS.md for the full standard.

29. FUNCTION WIRING -- VERIFY ALL FUNCTIONS ARE CALLED
     When you define a function in JavaScript (e.g., qwkSetTheme, qwkSetAccent,
     qwkToggleThemeColor), you MUST verify that every function is actually
     called from a click handler, event listener, or invocation point. A
     function that is defined but never called is a silent failure -- the UI
     element exists but does nothing when clicked.
       - After writing any function, search for its name across the codebase
         to confirm it has at least one call site (addEventListener, onclick,
         inline call, etc.).
       - If a function renders HTML buttons with data-* attributes (e.g.,
         data-theme, data-accent), those buttons MUST have click event
         listeners attached that call the function.
       - The verification script MUST include a check that each interactive
         function has a corresponding addEventListener or onclick wiring.
       - Common pattern: render buttons in a .map() loop, then wire up
         click handlers in wireUp() using querySelectorAll + forEach.
       - NEVER assume that rendering a button with a data-* attribute is
         enough. The browser does not auto-wire data attributes to functions.

30. CONFIRMATION POPUPS -- HIGHLIGHT DESTRUCTIVE ACTIONS
     Many user actions in QwkBrowser are destructive or irreversible:
     permission grants, deletes, stops, hides, removes, deactivations,
     data resets, and similar operations. These actions MUST have
     confirmation popups (dialog boxes) before executing.

     Whenever you are reviewing code OR building new functions, you MUST:
       1. Identify every action that modifies, deletes, hides, removes,
          stops, deactivates, or changes permissions/state.
       2. Explicitly list which actions need confirmation popups.
       3. Verify that each destructive action has a confirmation dialog
          wired to it. If it does not, flag it as a required addition.
       4. When building a new function that performs any destructive or
          irreversible operation, include the confirmation popup as part
          of the implementation -- not as a follow-up.

     Actions that ALWAYS need confirmation popups:
       - Delete (any kind: post, account, channel, file, comment)
       - Remove (from list, from group, from role)
       - Hide (content, user, channel)
       - Stop (campaign, stream, process)
       - Deactivate (BMF account, channel, subscription)
       - Permission changes (grant, revoke, transfer)
       - Data resets (counter, stats, history)
       - Logout from all sessions / force logout
       - Any action with "Are you sure?" semantics

     This rule applies to code review AND new feature development.
     When reviewing, highlight missing confirmation popups. When
     building, include them from the start. Never ship a destructive
     action without a confirmation dialog.

31. IMPLEMENTATION SUMMARY AT EVERY STEP
     Whenever you are working on a task with multiple steps, you MUST
     provide an implementation summary to the user at every step you
     complete. This is not optional. The user should never have to ask
     "where are we?" or "what did you just do?"

     After completing each discrete step:
       1. State which step was just completed (by name/number).
       2. State what was done (brief -- one to three sentences).
       3. State what the next step is.
       4. State overall progress (e.g., "Step 3 of 7 complete").

     Format (concise, no fluff):

       STEP 3 COMPLETE: Added Gating Tiers section to PRE-DEPLOY.md
       Done: Inserted Section 2A with all 4 tiers (1, 2, 3A, 3B),
       implementation details, messages, and switching rules.
       Next: Add Rules 30 and 31 to AGENTS.md.
       Progress: 1 of 3 steps complete (33%).

     This rule exists so the user can track progress in real time
     without asking. Every completed step gets reported. If a step
     fails or gets blocked, report that too (see Rule 23).

     If the task is a single step with no sub-steps, one summary at
     the end is sufficient. This rule applies to multi-step tasks.

31. FEATURE COMPLETION TESTING (PROVE IT WORKS)
     When completing any feature, API, backend route, database change, or
     user-facing functionality, the agent MUST provide a simple testing path.
     "Code exists" is not the same as "feature works."

     The agent MUST include:

     1. WHAT WAS BUILT
        - Explain in one sentence what changed.
        - List the main files changed.

     2. HOW TO TEST IT
        Provide the easiest way to verify the feature works.

        Testing order:
        a. VERIFY -- Confirm required files, routes, and config exist.
        b. START SERVER -- Give the command to start/restart the system.
        c. TEST API (if applicable) -- Provide the exact HTTP endpoint,
           the exact request needed, and the expected result.
        d. TEST USER FLOW -- Explain what a human should click/do and
           what success looks like.

     3. SUCCESS CHECK
        The agent must clearly state what proves the feature works.
        Example: "Success means: API returns 200, DB records the action,
        user sees the expected result."

     4. IF SOMETHING IS DISABLED
        If a feature flag, permission, or setting blocks testing, the agent
        must say: what is blocking it, where the switch is, how to temporarily
        enable it, and how to disable it again.

     5. NEVER CLAIM COMPLETE WITHOUT A TEST PATH
        A feature is only considered complete when another person can follow
        the testing instructions and verify the result. "84 checks passed"
        is not sufficient -- provide the command to start it, the API to
        test, the expected response, and the user action that confirms success.

     REFERENCE -- Available testing tools (mention the ones used):
        - Verification scripts: scripts\verify-v*.ps1 (run one or
          powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\verify-all.ps1")
        - Server start: powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\restart-server-silent.ps1"
        - Health check: Invoke-WebRequest 'http://localhost:3001/api/health' -UseBasicParsing -TimeoutSec 3
        - Manual API: Invoke-RestMethod -Uri 'http://localhost:3001/api/auth/login' -Method Post -Body '{"username":"X","password":"Y"}' -ContentType 'application/json'
        - Authenticated req: add -Headers @{Authorization="Bearer TOKEN"} (POST/PUT/DELETE also need "X-CSRF-Token":"CSRF_TOKEN")
        - Server logs: data\server.log, data\server.err (Get-Content "data\server.log" -Tail 50)
        - Port: 3001 (always)

32. PHYSICAL UI TESTING -- ALWAYS TELL THE USER WHERE TO CLICK
     After completing any feature with a user-facing UI, the agent MUST tell
     the user the exact physical steps to test it in the browser. Not just
     "go to the page" -- the exact URL, the exact button location, what to
     click, what to look for, and what should happen when they do.

     The agent MUST report:

     A. WHICH PAGE TO OPEN:
        - The exact URL (e.g. http://localhost:3001/frontend/homepage.html)
        - Which page in the sidebar/topbar to navigate to if it is not a
          direct URL (e.g. "click My BMF in the username dropdown")

     B. WHERE ON THE PAGE:
        - Which section, which tab, which panel, which button
        - Describe the location visually (e.g. "bottom-right floating dock,
          5th icon from top, gold clover shape")
        - If it is behind a flag, say so explicitly and tell the user which
          flag to flip and which file to edit

     C. WHAT TO CLICK / DO:
        - Step-by-step: "click X, then click Y, then enter Z in the input
          field labeled W"
        - Include what the UI should look like before and after each click
        - If a form is involved, list the exact fields and what to type

     D. WHAT TO EXPECT:
        - What the correct result looks like (e.g. "panel slides in from
          the right showing banner cards with +10 QU badges")
        - What failure looks like (e.g. "if you see 'Feature not available'
          the flag is still off")
        - Any error states and what they mean

     E. FLAG GATING:
        - If the feature is behind a flag (default false), the agent MUST:
          1. State which flag controls it
          2. State which file to edit (frontend/js/flags.js and/or
             backend/flags.js)
          3. State the exact line to change
          4. State that the server must be restarted after flipping
          5. Warn that PRE-DEPLOY.md checklist must pass before going live

     Format example:

       PHYSICAL TEST STEPS for QWK-0XX: Feature Name

       1. PREREQ: Flip the flag
          - Open backend\flags.js, change feature_flag: false to true
          - Open frontend\js\flags.js, change feature_flag: false to true
          - Restart server: scripts\restart-server-silent.ps1

       2. OPEN: http://localhost:3001/frontend/homepage.html
          - Sign in with your test account

       3. LOCATE: Bottom-right floating dock, 5th icon (gold clover)
          - If you do not see it, the flag is still off

       4. CLICK: The gold clover icon
          - Panel slides in from the right
          - You should see banner cards with +10 QU badges
          - Progress bar at bottom shows "X/20 unique clicks"

       5. CLICK: A banner card's "Click to Earn" button
          - Units credited, card dims, cooldown timer appears
          - Badge count on dock icon decreases by 1

       6. CHECK: Go to http://localhost:3001/frontend/newquanthoms.html
          - Partner signup form if not a partner
          - Dashboard with banner CRUD if already a partner

     This rule exists because the user tests with their eyes and mouse,
    not with curl commands. They need to know exactly where to go, what
    to click, and what to look for. Never leave them guessing.

=============================================================================
33. PLACEHOLDER CONTENT PRESERVATION -- NEVER REMOVE WITHOUT APPROVAL
=============================================================================

     Placeholder/demo/mock content is essential in local development. It
     shows the builder how interactions will look before production, and
     allows the builder and agents to brainstorm tweaks and modifications
     necessary for the developed app.

     33.1 CORE RULE
     Whenever we build or already build something, the agent MUST always
     suggest placeholder content or data. This placeholder content is
     permitted by the user (Chris) with any extra details needed.

     33.2 NEVER REMOVE EXISTING PLACEHOLDERS
     Existing placeholder content, mock data, demo entries, and fallback
     content MUST NEVER be removed, overwritten, or replaced with empty
     data without explicit approval from the user. This includes:
       - makeMockFeed() entries in factory.html
       - Sidebar topic lists, who-to-follow panels, activity feed items
       - Any hardcoded demo content that renders on page load
       - Any fallback content shown when API returns empty results

     33.3 WHY THIS MATTERS
     When placeholder content disappears, the builder cannot see how the
     UI will look in production. The page appears broken or empty. This
     causes confusion about whether the code is broken or the data is
     just missing. Placeholder content is the scaffolding that lets us
     design and iterate before real data exists.

     33.4 IF AN AGENT ACCIDENTALLY REMOVES PLACEHOLDERS
     The agent MUST restore them immediately from the last clean commit
     (per Rule 16 recovery procedure). Do not try to recreate placeholders
     from memory -- restore from git history where the real design intent
     is preserved.

     This rule exists because a previous agent corrupted factory.html
     with mojibake, and the placeholder feed content, sidebar content,
     and mock data all disappeared. The user could not tell if the code
     was broken or the data was gone. Placeholder content is not
     disposable -- it is part of the design process.

=============================================================================
34. CONTINUATION READING -- "READ AGENTS MD AND CONTINUE"
=============================================================================

     When the user says "read agents md and continue" (or any variation
     of that phrase), the agent MUST only read these three specific
     sections of AGENTS.md -- nothing else:

       1. Rule 27 -- Master Pipeline Update Before Any Task
          (Update docs/QWK-MASTER-PIPELINE.md for the current task)

       2. Rule 16 -- Encoding Integrity / ASCII Error Guide
          (Check for mojibake before doing any file edits)

       3. Rule 12 / Rule 21 -- Commit Discipline / Commit Checkpoint
          (Commit before high-risk changes, save stable states)

     The agent does NOT need to re-read the entire AGENTS.md file for
     a continuation. These three rules are the minimum needed to resume
     work safely: know what task to update, check for encoding issues,
     and commit before breaking anything.

     All other rules remain in effect at all times -- but they do not
     need to be re-read for a continuation. The agent is expected to
     already know them from the initial read.

=============================================================================
35. PLACEHOLDER DATA AS DESIGN TOOL -- ALWAYS ADDRESS IT
=============================================================================

     Placeholder contents and data are very important because they allow
     the builder to suggest areas to be modified, removed, and added. This
     must always be addressed at all times.

     35.1 WHAT THIS MEANS
     Every time an agent works on a file, page, or feature that contains
     placeholder content (mock data, demo entries, sample text, fallback
     content, Lorem Ipsum, hardcoded UI examples), the agent MUST:
       1. Acknowledge the placeholder content exists in that area.
       2. Suggest to the builder what could be modified, removed, or added
          based on what the placeholder is representing.
       3. Never silently skip over or ignore placeholder content as if it
          does not matter. It always matters.

     35.2 WHY THIS IS A STANDING REQUIREMENT
     Placeholder content is not filler. It is the builder's way of saying
     "this is where real content will go, help me shape it." When an agent
     ignores placeholders, the builder loses the ability to see what the
     agent thinks should change, stay, or be expanded. The placeholder is
     the conversation starter between builder and agent about what the
     final product should look like.

     35.3 RELATIONSHIP TO RULE 33
     Rule 33 says do not remove placeholders without approval. This rule
     goes further: the agent must actively engage with placeholder content
     in every task, using it as a basis for suggestions about what to
     modify, remove, or add. Rule 33 is about preservation. Rule 35 is
     about active engagement.

     35.4 EXAMPLE
     If an agent is editing factory.html and sees makeMockFeed() entries,
     the agent should note: "I see placeholder feed content in
     makeMockFeed(). Based on this, I suggest: (1) modify the feed card
     layout to include a timestamp, (2) remove the hardcoded avatar URLs
     and replace with a profile image API call, (3) add a 'sponsored'
     badge field to the feed item schema." The builder can then approve,
     reject, or redirect.

     This rule must be addressed at all times, on every task, regardless
     of whether the task directly involves placeholder content. If
     placeholder content exists in the area being worked on, it must be
     addressed.

=============================================================================
36. NEW PAGE NAVIGATION RULE -- SIDEBAR + TOPBAR MATCH
=============================================================================

     Every new page created on QWKBrowser MUST be registered in BOTH
     navigation systems:

       1. LEFT SIDEBAR: frontend/js/topbar-chips.js
          - Add an entry to the PAGES array with url, icon, label, category
          - Choose the appropriate category: frontdesk, reports, commerce,
            backoffice, discovery, advance, profile

       2. TOPBAR: frontend/assets/qwk.js
          - If the page has a floating dock icon, ensure the dock button
            HTML, event listener, and visibility function are all present
          - If the page does not have a dock icon, ensure it is reachable
            via the sidebar chips

     A page that exists as an HTML file but is not in the PAGES array
     is INVISIBLE to the user. They cannot navigate to it. This is a
     bug, not a feature. Every page must be reachable.

     When renaming a page:
       1. Rename the HTML file
       2. Update the url in the PAGES array in topbar-chips.js
       3. Update any references in qwk.js (dock icons, panel links)
       4. Update any references in verification scripts
       5. Update any references in docs (AGENTS.md, PRE-DEPLOY.md, pipeline)

     This rule exists because the newquanthoms.html page (formerly
     qwkpromos.html) was created but never added to the sidebar or
     topbar navigation. The user could not find it. A page the user
     cannot navigate to does not exist from their perspective.

=============================================================================
37. PRODUCTION ACCOUNTS -- ALWAYS EXEMPT FROM GATING
=============================================================================

     The following accounts are seeded in backend/db.js and must NEVER
     be gated, blocked, or restricted by feature flags or access controls:

       Marketing accounts:
         - iloveqwkbrowser
         - qwkbrowser
         - quanthomoffice

       Admin account:
         - qwkadmin

     When implementing any gating, access control, or feature flag:
       1. These accounts are ALWAYS exempt -- they see everything
       2. The exemption must be enforced in BOTH frontend and backend
       3. In the backend, check is_marketing_account or admin role
          BEFORE applying any flag check
       4. In the frontend, check the user's role/account before hiding
          any UI element behind a flag

     The full account details (emails, passwords, properties) are
     documented in docs/PRE-DEPLOY.md Section 11.

     This rule exists because gating was applied uniformly without
     considering that marketing and admin accounts need full access
     to all features for testing, content creation, and management.

=============================================================================
38. SERVER CONSISTENCY -- SAME DATA EVERY WAY YOU START IT
=============================================================================

     The server must produce the same content and data regardless of
     how it is started:

       1. PowerShell manual:  cd backend; npm start
       2. Agent-run:  via Bash tool (background process)
       3. Desktop shortcut:  scripts/start-server-silent.ps1 or .bat

     All three methods must:
       - Read the same .env file (backend/.env)
       - Connect to the same database (data/qwkbrowser.db)
       - Serve the same frontend files (frontend/)
       - Mount the same routes (backend/routes/)
       - Apply the same flags (backend/flags.js, frontend/js/flags.js)

     If the user reports that content "disappears" or is different
     depending on how they start the server, the problem is one of:
       a. Different working directory (server started from wrong folder)
       b. Different .env file being read
       c. Different database file being used
       d. Stale node_modules or cached requires
       e. File not saved before server restart

     Always verify the working directory and .env path when debugging
     "missing content" reports.

=============================================================================
39. BACKEND JS INVENTORY -- KEEP QWKBROWSER-JS.MD IN SYNC
=============================================================================

     docs/QWKBROWSER-JS.md is the plain-English inventory of every backend
     .js file. Each file has a one-line description of what it does.

     39.1 WHEN A NEW .JS FILE IS CREATED
     Whenever a new .js file is created anywhere under backend/, the agent
     MUST add it to docs/QWKBROWSER-JS.md immediately -- in the same task
     that created the file. The entry must include:
       - The file path (e.g., backend/routes/newfeature.js)
       - A one-line plain-English description of what it does
       - The correct section (ROOT, BILLING, LIB, MIDDLEWARE, ROUTES,
         SERVICES, or a new section if a new directory is created)

     39.2 WHEN A .JS FILE IS REMOVED OR RENAMED
     Update docs/QWKBROWSER-JS.md to remove or rename the entry. The
     inventory must always match what is on disk.

     39.3 WHEN A .JS FILE'S PURPOSE CHANGES
     If a file's role changes significantly (new major endpoints, different
     responsibility), update its one-line description in the inventory.

     39.4 WHY THIS EXISTS
     The builder reviews and modifies backend files using natural language.
     The inventory lets them find the right file by reading descriptions
     instead of opening every file. An out-of-date inventory is a bug.

     39.5 CROSS-REFERENCES
     This document is referenced in:
       - docs/PRE-DEPLOY.md (Section 12)
       - docs/QWK-MASTER-PIPELINE.md (Section G)

=============================================================================
END OF MANDATORY MEMORY GUIDE
=============================================================================
