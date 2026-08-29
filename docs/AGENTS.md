==============================================================================
  /  \  MANDATORY MEMORY GUIDE BEFORE RUNNING PROVIDED PROMPT
  \  /  ----------------------------------------------------------
  \  /   File: AGENTS.md
       Location: project root (C:\Users\lenovo\Documents\www.newquanthoms.com)
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
  4. Follow the development workflow in Section 3 for all work.
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
  See Rule 5 for the full mojibake prevention and recovery protocol.
- Server port: 3002. Start/restart via:
    cd C:\Users\lenovo\Documents\www.newquanthoms.com; npm start
  Health check:
    Invoke-WebRequest 'http://localhost:3002/api/auth/me' -UseBasicParsing -TimeoutSec 3

- BANQ proxies /api/ads/* and /api/profile/* to QwkBrowser backend on port 3001.
  QwkBrowser must be running for ad feed and reward earning to work.
  QwkBrowser health check:
    Invoke-WebRequest 'http://localhost:3001/api/health' -UseBasicParsing -TimeoutSec 3

TOOL SUBSTITUTION TABLE (Windows/PowerShell) -- See Rule 8 for MANDATORY compliance
The following Unix/bash tools do NOT exist or fail on this Windows environment.
Agents MUST use the PowerShell alternative instead. NEVER attempt the Unix tool.
This is a MANDATORY RULE (Rule 8). Violating it causes stuck states.

  BROKEN TOOL          | USE INSTEAD
  ---------------------|----------------------------------------------------------
  grep                 | Select-String -Path <file> -Pattern <regex>
                       | For recursive: Get-ChildItem -Recurse -Filter "*.js" |
                       | Select-String -Pattern <regex>
  find                 | Get-ChildItem -Path <dir> -Filter <pattern> -Recurse
  cat                  | Read tool (preferred) or Get-Content <file>
  head/tail            | Get-Content <file> -TotalCount N  (head)
                       | Get-Content <file> -Tail N  (tail)
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
  which/where           | Get-Command
  Read tool (offset)   | Get-Content <file> | Select-Object -Skip N -First M
  Write tool (desync)  | Set-Content -Path <file> -Value $content -Encoding UTF8
  Edit tool (desync)   | (Get-Content <file> -Raw) -replace 'old','new' | Set-Content <file>
  Any built-in tool    | If a built-in tool (Read, Write, Edit, Grep, Glob) fails
  (stale desync)        with "stale pending tool call" or similar harness state
                       error, IMMEDIATELY substitute the PowerShell equivalent
                       from this table. Do NOT retry the same tool. One attempt,
                       one substitute, move on.

ALSO: The Letta Code Read tool and Grep tool (if available) should be
preferred over any shell command for file reading and content search.
Use Select-String only when the built-in tools are insufficient.

COMMON GOTCHAS:
  - `cd path && grep` fails (no && in PowerShell). Use `;` or absolute paths.
  - `grep` is not recognized at all in PowerShell. Use Select-String.
  - Heredocs (`<<EOF`) do not work. Use single-quoted multiline strings.
  - `find . -name "*.js"` fails. Use `Get-ChildItem -Recurse -Filter "*.js"`.
  - HTML files are at project root, NOT in a `frontend/` subdirectory.
    Example: index.html is at `./index.html`, not `./frontend/index.html`.
  - JavaScript files with `\n` literal escape sequences in strings (where they
    should be actual newlines) break the JS parser. Fix by replacing `\n`
    literals with actual line breaks.

==============================================================================
SECTION 1 -- DIRECTORY MAP
==============================================================================

Root: C:\Users\lenovo\Documents\www.newquanthoms.com

----------------------------------------------------------------------------
1. ROOT (C:\Users\lenovo\Documents\www.newquanthoms.com)
----------------------------------------------------------------------------
   Contains the server, all HTML pages, CSS, JS, and the git repo.

   Key files:
   - AGENTS.md          (this file -- mandatory read for all agents)
   - server.js          Express entry point. Static serving, auth routes,
                        API proxy to QwkBrowser, SPA fallback.
   - package.json       Dependencies: express, @libsql/client, bcryptjs,
                        http-proxy-middleware, uuid.
   - .env               Environment variables (DO NOT COMMIT).
                        QWK_API_URL=http://localhost:3001
                        PORT=3002
   - .gitignore         Excludes node_modules, .env, data/*.db
   - NEEDED BACKEND FOR BANQ WEBSITE.md  (deferred backend items doc)

   HTML pages (all at project root):
   - index.html         Blog feed (main page). Banner cards, video cards,
                        click-to-earn, daily bonus progress, billboard interest
                        sidebar, AD-Packages popup.
   - billboards.html    Billboard page. Declaration form (city, country, type,
                        message), demand stats table, billboard interest sidebar.
   - packages.html      Ad packages page. 3 tiers (Starter $50/7d, Premium
                        $200/14d, Sponsored $500/30d), QAP number input,
                        redirects to dashboard.
   - dashboard.html     Advertiser dashboard. Banner CRUD, QAP banner on
                        redirect with ?qap= and &pkg= URL params.
   - about.html         About page. Contact form (name, email, subject, message).
   - login.html         Sign-in page. BANQ account auth (not QwkBrowser).

   Key dirs:
   - backend/   (auth.js + db.js -- BANQ's own auth and database)
   - css/       (styles.css -- global styles, CSS variables, theming)
   - js/        (app.js -- BANQ API helpers, token management, toast, utils)
   - assets/    (logo.svg, placeholder images)
   - data/      (banq.db -- SQLite database)
   - docs/      (this file and other documentation)
   - scripts/   (empty -- future verification scripts)

----------------------------------------------------------------------------
2. BACKEND (C:\Users\lenovo\Documents\www.newquanthoms.com\backend)
----------------------------------------------------------------------------
   Node.js + Express + @libsql/client. Port 3002.

   Structure:
   - auth.js            Auth routes (login, me, logout). Token-based using
                        UUIDv4, stored as SHA-256(token) in sessions table.
                        requireAuth middleware. Completely independent of
                        QwkBrowser's auth system.
   - db.js              Database setup. 2 tables: users, sessions. Seeds
                        admin account (banqadmin) on every boot. Idempotent.
                        Uses @libsql/client (SQLite, file-based at data/banq.db).

   Database: data/banq.db (SQLite, file-based).
   2 tables: users, sessions.
   - users: id, username, email, password_hash, is_admin, quanthom_unit,
            quanthom_credit, created_at
   - sessions: id, user_id, token_hash, created_at, expires_at

   Auth model:
   - BANQ owns its own auth. Users create BANQ accounts (not QwkBrowser accounts).
   - Token stored in localStorage as `banq_token` (NOT `qwk_token`).
   - Bearer auth header on every API call.
   - Session duration: 7 days.

   API proxy:
   - /api/ads/* proxied to QwkBrowser backend (port 3001) for banner data
     and reward earning (click-to-earn, dwell-to-earn).
   - /api/profile/* proxied to QwkBrowser for user profile/balance data.
   - /api/auth/* is local (NOT proxied) -- BANQ's own auth system.

----------------------------------------------------------------------------
3. CSS (C:\Users\lenovo\Documents\www.newquanthoms.com\css)
----------------------------------------------------------------------------
   - styles.css         Global styles, CSS custom properties for theming.
                        All classes prefixed with `banq-` (e.g. .banq-header,
                        .banq-card, .banq-btn, .banq-toast). Dark theme with
                        gold accent elements.

----------------------------------------------------------------------------
4. JS (C:\Users\lenovo\Documents\www.newquanthoms.com\js)
----------------------------------------------------------------------------
   - app.js             BANQ API helpers. Exposes `window.BANQ` namespace.
                        Token management (banq_token / banq_user in localStorage).
                        fetchJson, qwkFetch (alias), login, checkAuth, logout,
                        escapeHtml, formatTime, toast.

   Key patterns:
   - BANQ.API_BASE = window.location.origin + '/api'
   - Token in localStorage('banq_token'), Bearer header on every fetch.
   - 401 response -> clear token, redirect to /login.html.
   - Content feed is PUBLIC (no auth needed to view).
   - Auth required only for earning rewards (click/dwell).

----------------------------------------------------------------------------
5. DATA (C:\Users\lenovo\Documents\www.newquanthoms.com\data)
----------------------------------------------------------------------------
   - banq.db           Active database (SQLite, file-based).

   DO NOT commit database files to git. They are in .gitignore.
   Back up the DB before any schema change.

----------------------------------------------------------------------------
6. DOCS (C:\Users\lenovo\Documents\www.newquanthoms.com\docs)
----------------------------------------------------------------------------
   - AGENTS.md                       (this file)
   - BANQ-JS.md                      (backend JS inventory)
   - BANQ-MASTER-PIPELINE.md         (task tracker)
   - BANQ-QWK-API-PARTNERSHIP.md     (API partnership spec -- resolved)
   - BUFF-DELEGATION-GUIDE.md        (read-only delegation templates)
   - COMMIT-CHECKPOINTS.md           (commit log)
   - NEW-QUANTHOMS-BILLBOARD-AGENCY.md (implementation plan)
   - PRE-DEPLOY.md                   (pre-launch checklist)
   - QAP-RELATED-TASK.md             (QAP system task breakdown)
   - RESPONSIVE-BREAKPOINTS.md       (responsive standard)

----------------------------------------------------------------------------
7. ASSETS (C:\Users\lenovo\Documents\www.newquanthoms.com\assets)
----------------------------------------------------------------------------
   - logo.svg          BANQ logo.
   - placeholder/      Placeholder banner images and videos for demo content.

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

LAST RUN: 2026-08-26 (QAP ARCHITECTURE + API PARTNERSHIP)

Current state: All 8 docs rebranded from qwkbrowser to BANQ standalone.
BANQ-QWK-API-PARTNERSHIP.md created and fully resolved -- all 6 open
items answered via QwkBrowser codebase research (ads.js, auth.js,
profile.js, db.js). QAP architecture revised: QAP is a QwkBrowser core
feature (not BANQ-only). Table bmf_ad_profiles to be renamed
quanthom_ad_profiles with new columns (qap_number, cta_message,
keywords, regional_target, media_type, filename). QwkBrowser will own
QAP generation and the partner-facing GET /api/ad-profile/qap/:qap
endpoint. BANQ proxies to it. Created docs/QAP-RELATED-TASK.md with
full task breakdown (9 tasks across 3 phases).

What remains: Implement QAP system on QwkBrowser side first (rename
table, add columns, move routes, implement upgrade + QAP fetch
endpoints, update mybmf.html form). Then BANQ side (add QAP proxy,
update dashboard activation). Then documentation updates across both
repos. See docs/QAP-RELATED-TASK.md for the full implementation order.

Previous state: Independent auth system built (backend/auth.js + db.js,
banqadmin seeded, banq_token in localStorage). 6 HTML pages live (index,
billboards, packages, dashboard, about, login). API proxy to QwkBrowser
for /api/ads/* and /api/profile/*. Deferred backend items documented in
NEEDED BACKEND FOR BANQ WEBSITE.md (billboard declaration, contact form,
QAP validation, seed banner runner).

==============================================================================
SECTION 3 -- DEVELOPMENT WORKFLOW
==============================================================================

This section defines the complete development workflow. Every coding agent
working on this project should follow these steps in order.

----------------------------------------------------------------------------
3.1 GUARDRAILS / SPECS
----------------------------------------------------------------------------
Before writing any code:
- Read this file (AGENTS.md) in full.
- Confirm the project root is C:\Users\lenovo\Documents\www.newquanthoms.com.
- Check that the BANQ server is running (health check on port 3002).
- If the feature involves ad data or rewards, verify QwkBrowser backend is
  running (health check on port 3001).
- Understand the auth model: BANQ owns auth, QwkBrowser is an external API
  service for ads and profile data only.
- Know the 2 DB tables (users, sessions). Re-read db.js on resume.
- Follow the idempotent schema migration pattern (CREATE TABLE IF NOT EXISTS).
- Never commit .env, database files, or .letta/ to git.
- Use ASCII-only characters in all file edits (Windows encoding safety).
- EXECUTION POLICY: Before writing or modifying any code, respond with a
  plain-language explanation of what the user wants done. Wait for the user
  to approve or correct before touching any files. See Rule 3.

----------------------------------------------------------------------------
3.2 ORCHESTRATING / PLAN
----------------------------------------------------------------------------
- Work one task at a time. Do not batch multiple features.
- After each code change, do file-only verification first (Read, Grep).
- Then restart the server (npm start from project root).
- Then run the relevant verification (if a script exists).
- If verification fails: PAUSE. TRACE the root cause. FIX the defect.
  RE-RUN. Do NOT patch symptoms. Report to user with: what broke / where /
  fix / verify / next move. Wait for explicit permission to resume.
- Update the LAST PROMPT RESIDUE (Section 2) after every session.

----------------------------------------------------------------------------
3.3 BUILDING / DESIGNING
----------------------------------------------------------------------------
- Backend: Node.js + Express + @libsql/client. Raw SQL (no ORM).
  Use prepared statements. Use CREATE TABLE IF NOT EXISTS for idempotent
  schema. All schema changes must be safe to run on every boot.
- Frontend: Vanilla ES6+. No build step. No framework. CSS custom
  properties for theming. Fetch API for all HTTP. localStorage for token
  persistence. All CSS classes prefixed with `banq-`.
- Database: SQLite (file-based at data/banq.db). Back up before schema changes.
- API: Auth routes under /api/auth/* (local). Ad and profile routes proxied
  to QwkBrowser under /api/ads/* and /api/profile/*.
- BANQ namespace: window.BANQ (defined in js/app.js). All API calls go
  through BANQ.fetchJson() or BANQ.qwkFetch() (alias).
- When adding new routes: add to server.js, add to BANQ-JS.md inventory.
- When adding new frontend pages: add to this file's inventory, add to
  the navigation in HTML headers.

----------------------------------------------------------------------------
3.4 SERVER STARTUP
----------------------------------------------------------------------------
- Start: cd C:\Users\lenovo\Documents\www.newquanthoms.com; npm start
- Server runs on port 3002 (configurable via PORT env var).
- HTML file changes do NOT need a restart (served from disk by express.static).
- ANY .js file change needs a restart.
- After restart, verify:
  Invoke-WebRequest 'http://localhost:3002' -UseBasicParsing -TimeoutSec 3

----------------------------------------------------------------------------
3.5 API PARTNERSHIP BOUNDARY
----------------------------------------------------------------------------
BANQ owns:
  - User accounts (registration, login, logout, sessions)
  - User database (users, sessions tables in data/banq.db)
  - Billboard declaration data (future: billboard_declarations table)
  - Contact form data (future: contact_messages table)
  - QAP validation (future: validate QAP numbers against QwkBrowser API)
  - All frontend HTML/CSS/JS
  - All placeholder/demo banner content

QwkBrowser provides (via API proxy):
  - Ad banner data (GET /api/ads/eligible, GET /api/ads/public)
  - Click-to-earn rewards (POST /api/ads/click)
  - Dwell-to-earn rewards (POST /api/ads/impression)
  - Click history (GET /api/ads/clicks/history)
  - User profile/balance data (GET /api/profile/*)

The proxy is configured in server.js:
  /api/ads/*     -> http://localhost:3001/api/ads/*
  /api/profile/* -> http://localhost:3001/api/profile/*

Auth is NEVER proxied. BANQ users do NOT need QwkBrowser accounts.

----------------------------------------------------------------------------
3.6 PLACEHOLDER CONTENT
----------------------------------------------------------------------------
- Every page that displays feeds, lists, or content MUST have placeholder/
  demo/mock content that renders immediately on page load.
- Placeholder banners (8-10 mock entries) should be present in index.html
  so the feed is never empty.
- If the API returns empty data, placeholder content MUST remain visible.
- If the API returns real data, prepend or merge it with placeholders.
- Placeholder content must use the same CSS classes, colors, and card
  layouts as real content. Do NOT invent new designs for placeholders.
- NEVER remove placeholder content without explicit approval from the user.

----------------------------------------------------------------------------
3.7 STATIC CONTEXT
----------------------------------------------------------------------------
- Project docs that define the "what" and "why":
  AGENTS.md (this file), BANQ-MASTER-PIPELINE.md, PRE-DEPLOY.md,
  NEW-QUANTHOMS-BILLBOARD-AGENCY.md, NEEDED BACKEND FOR BANQ WEBSITE.md,
  BANQ-JS.md, RESPONSIVE-BREAKPOINTS.md, BUFF-DELEGATION-GUIDE.md.
- These are the source of truth. Code is the implementation.
- When in doubt about the schema, read backend/db.js.
- When in doubt about the API proxy, read server.js.

----------------------------------------------------------------------------
3.8 DYNAMIC CONTEXT
----------------------------------------------------------------------------
- The LAST PROMPT RESIDUE (Section 2) is the dynamic context.
- It changes after every session to reflect current state.
- Git status and recent commits also provide dynamic context.
- The database state (data/banq.db) is the runtime truth.

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
- If the SQLite DB grows large, suggest Turso (managed libSQL, free tier).
- If static file serving is slow, suggest Cloudflare CDN (free) in front.
- If the frontend grows complex, suggest a build step (Vite) -- but only
  when the complexity justifies it.

4.2 SECURITY
- Suggest rate limiting (express-rate-limit) if not yet implemented.
- Suggest Helmet.js for security headers (free, 1-line middleware).
- Suggest CSRF protection if missing.
- Suggest Secrets management (Doppler free tier, AWS Secrets Manager).
- Suggest automated dependency scanning (Dependabot free, Snyk free tier).

4.3 MONITORING
- Suggest UptimeRobot (free) or BetterUptime for uptime monitoring.
- Suggest Sentry (free tier) for error tracking.
- Suggest PM2 or systemd for process management in production.

4.4 CI/CD
- Suggest GitHub Actions (free for public repos) for automated testing.
- Suggest GitHub Pages auto-deploy on push to main (already deployed there).
- Suggest Husky + lint-staged for pre-commit hooks.

4.5 DEVELOPER EXPERIENCE
- Suggest ESLint + Prettier if not configured (free, 5-min setup).
- Suggest Vitest or Jest for unit testing.
- Suggest Playwright for E2E testing (free, cross-browser).

4.6 DEPLOYMENT / INFRASTRUCTURE
- Suggest Docker containerization for reproducible deploys.
- Suggest Cloudflare Pages as an alternative to GitHub Pages (free).
- Suggest Fly.io or Railway for backend hosting (free tier).

4.7 COST OPTIMIZATION
- Always cite free tier options alongside paid alternatives.
- Suggest Cloudflare (free) for DNS + CDN + DDoS protection.
- Suggest Turso (free tier: 500 DBs, 9 GB) for managed SQLite.
- Suggest GitHub Pages (free) for static site hosting.

4.8 AI / AGENT-SPECIFIC
- Suggest using Letta Code subagents for parallel task execution.
- Suggest using forked agents for code review before merge.
- Suggest memory initialization (/init) in any new working directory.

==============================================================================
SECTION 5 -- QUICK ACCELERATION COMMANDS
==============================================================================

5.1 AGENTS.md AUTO-READ
----------------------------------------------------------------------------
Most modern coding agents (Claude Code, Codex, Aider, Cursor, etc.)
automatically look for and read an AGENTS.md file in the project root
before doing anything. This file IS that AGENTS.md.

For agents that do NOT auto-read AGENTS.md, include this line at the top
of your prompt:
  "Read AGENTS.md in the project root before doing anything else."

5.2 QUICK ACCELERATION COMMANDS
----------------------------------------------------------------------------
For fast task handoff, use these prompt prefixes with any coding agent:

- "Read AGENTS.md, then: [task]" -- universal prefix for any agent.
- "Check BANQ-MASTER-PIPELINE.md, then: [task]" -- for pipeline work.
- "Read NEEDED BACKEND FOR BANQ WEBSITE.md, then: [task]" -- for deferred items.

5.3 LETTA CODE SPECIFIC SHORTCUTS
----------------------------------------------------------------------------
- /init -- initialize agent memory in the current working directory.
- /doctor -- check system prompt health and memory size.
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

==============================================================================
RULE 3: EXECUTION POLICY -- ANTI-HALLUCINATION AND SCOPE DISCIPLINE
==============================================================================

3.1 EXPLAIN BEFORE YOU ACT
Before modifying or creating any code, the agent MUST respond with a
plain-language explanation of what it understands the task to be: what
the user wants done, which files or functions are involved, and what the
end result should look like. The agent must then WAIT for the user to
review and approve or correct. The agent must NOT write, edit, or create
any code until the user explicitly approves.

3.2 DO EXACTLY WHAT IS ASKED -- NOTHING MORE, NOTHING LESS
The agent must execute the exact scope of the request. It must not add
features, files, functions, refactors, or "improvements" the user did
not ask for. If the agent thinks something else should be changed, it
must SUGGEST it in plain text and wait for approval -- not do it silently.

3.3 DO NOT EDIT OUTSIDE THE SCOPE
The agent must not rename, restructure, reorder, reformat, or "clean up"
any code outside the exact scope of the task. Dead code removal is allowed
only when the user explicitly asked for it or when it directly blocks the
requested change.

3.4 READ BEFORE YOU WRITE -- NEVER GUESS AT CODE
The agent must Read the actual file before editing it. It must not work
from memory, assumptions, or prior context about what the code "probably
looks like." If the agent cannot see the current state of the code, it
must say so and read it first.

3.5 IF IT DOES NOT EXIST, SAY SO
If a route, function, variable, file, or endpoint the agent assumes
exists does not actually exist, the agent must state clearly: "This does
not exist." The agent must never hallucinate the existence of code,
APIs, database tables, or file paths. When unsure, the agent must verify
by reading the relevant file or searching the codebase.

3.6 WHEN UNSURE, ASK -- DO NOT GUESS
If the agent is uncertain about the user's intent, the correct approach,
or the expected result, it must ask a direct question and wait for the
answer. It must not pick a direction and hope it is right.

3.7 NO SILENT SIDE EFFECTS
The agent must not run background tasks, start servers, install packages,
modify configs, or take any action the user did not request. Every
action must be visible and accounted for in the conversation.

These rules apply to ALL codebase changes -- new functions, modifications
to existing code, new files, schema changes, and configuration edits.
They do NOT apply to read-only operations (reading files, searching
code, answering questions, running verification scripts).

==============================================================================
RULE 5: ENCODING INTEGRITY -- PREVENT DOUBLE-UTF-8 CORRUPTION (MOJIBAKE)
==============================================================================

5.1 WHAT HAPPENS
On Windows, files can be corrupted by double-UTF-8 encoding (mojibake).
Every em-dash (--), emoji, box-drawing character, and other non-ASCII
characters get re-encoded, producing garbage. This breaks HTML structure,
JS template literals, and CSS comments. The corruption is invisible
until you open the pages in a browser and see garbled text.

5.2 ROOT CAUSE
A tool, editor, or agent saves files with the wrong encoding -- reading
UTF-8 bytes as Latin-1 (ISO-8859-1) and then re-encoding as UTF-8. This
doubles the encoding and destroys every non-ASCII character.

5.3 MANDATORY RULES
a. ALL file reads and writes MUST use UTF-8 encoding.
   - In PowerShell: use -Encoding UTF8 on Get-Content/Set-Content.
   - In Node.js: use fs.readFile/writeFile with 'utf8' encoding.
   - Never read or write files without specifying encoding.

b. NEVER save files as UTF-8 with BOM unless the file already has a BOM.

c. NEVER use an external editor that defaults to Windows-1252 or Latin-1
   to edit files in this repository.

d. BEFORE committing, scan for mojibake:
   git diff HEAD -- <file> | findstr /C:"A-cents" /C:"A-deg"
   If any line matches, the file is corrupted. Restore from the last
   clean commit: git checkout HEAD -- <corrupted-file>

e. If mojibake is detected, DO NOT try to "fix" it by editing the
   corrupted characters. Restore the file from the last clean git commit.

f. Em-dashes and special Unicode already cause issues on Windows. Agents
   should AVOID using em-dashes and special Unicode in NEW code.

5.4 RECOVERY PROCEDURE
If mojibake is discovered:
  1. Identify all corrupted files (scan with the findstr command above).
  2. Check whether the corrupted files have any REAL new work mixed in.
  3. If no real work in the diff: restore from HEAD.
     git checkout HEAD -- <file1> <file2> ...
  4. If real work is mixed in: carefully extract the real changes from
     the diff, restore the file from HEAD, then re-apply only the real
     changes manually.
  5. Verify the restored files are clean.
  6. Commit the restored files with a message noting the recovery.

==============================================================================
RULE 6: COMMIT DISCIPLINE -- SAVE BEFORE YOU BREAK
==============================================================================

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

==============================================================================
RULE 7: SUGGEST ENHANCEMENTS -- PROFESSIONAL, UNIQUE, BREAKTHROUGH
==============================================================================

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

==============================================================================
RULE 8: TOOL SUBSTITUTION -- NEVER USE BROKEN UNIX TOOLS ON WINDOWS
==============================================================================

The tool substitution table in the PLATFORM NOTES section above is
MANDATORY. Agents MUST NEVER attempt to use grep, find, cat, sed, awk,
curl, or other Unix-only tools on this Windows environment. Use the
PowerShell alternative instead.

8.1 IF A BUILT-IN TOOL FAILS (STALE DESYNC)
If any built-in tool (Read, Write, Edit, Grep, Glob) fails with a
"stale pending tool call" or similar harness state error, IMMEDIATELY
substitute the PowerShell equivalent from the table. Do NOT retry the
same tool. One attempt, one substitute, move on.

8.2 IF POWERSHELL HANGS
If PowerShell itself hangs (even `echo hello` times out), do NOT retry
with more PowerShell variations. Switch to the Read tool for file reading
or ask the user to restart the session. Never retry a dead approach more
than once -- find an alternative workaround immediately.

==============================================================================
RULE 9: PLACEHOLDER CONTENT PRESERVATION -- NEVER REMOVE WITHOUT APPROVAL
==============================================================================

Placeholder/demo/mock content is essential in local development. It
shows the builder how interactions will look before production, and
allows the builder and agents to brainstorm tweaks and modifications.

9.1 CORE RULE
Whenever we build or already build something, the agent MUST always
suggest placeholder content or data. This placeholder content is
permitted by the user (Chris) with any extra details needed.

9.2 NEVER REMOVE EXISTING PLACEHOLDERS
Existing placeholder content, mock data, demo entries, and fallback
content MUST NEVER be removed, overwritten, or replaced with empty
data without explicit approval from the user. This includes:
  - Mock banner entries in index.html
  - Billboard interest sidebar data
  - Demand stats table placeholder data
  - Any hardcoded demo content that renders on page load
  - Any fallback content shown when API returns empty results

9.3 WHY THIS MATTERS
When placeholder content disappears, the builder cannot see how the UI
will look in production. The page appears broken or empty. This causes
confusion about whether the code is broken or the data is just missing.
Placeholder content is the scaffolding that lets us design and iterate
before real data exists.

9.4 IF AN AGENT ACCIDENTALLY REMOVES PLACEHOLDERS
The agent MUST restore them immediately from the last clean commit.
Do not try to recreate placeholders from memory -- restore from git
history where the real design intent is preserved.

==============================================================================
RULE 10: PLACEHOLDER DATA AS DESIGN TOOL -- ALWAYS ADDRESS IT
==============================================================================

10.1 WHAT THIS MEANS
Every time an agent works on a file, page, or feature that contains
placeholder content (mock data, demo entries, sample text, fallback
content), the agent MUST:
  1. Acknowledge the placeholder content exists in that area.
  2. Suggest to the builder what could be modified, removed, or added
     based on what the placeholder is representing.
  3. Never silently skip over or ignore placeholder content as if it
     does not matter. It always matters.

10.2 WHY THIS IS A STANDING REQUIREMENT
Placeholder content is not filler. It is the builder's way of saying
"this is where real content will go, help me shape it." When an agent
ignores placeholders, the builder loses the ability to see what the
agent thinks should change, stay, or be expanded.

10.3 RELATIONSHIP TO RULE 9
Rule 9 says do not remove placeholders without approval. This rule
goes further: the agent must actively engage with placeholder content
in every task, using it as a basis for suggestions about what to
modify, remove, or add.

==============================================================================
RULE 11: PRODUCTION ACCOUNTS -- ALWAYS EXEMPT FROM GATING
==============================================================================

The following account is seeded in backend/db.js on every server boot.
It must NEVER be gated, blocked, or restricted by feature flags or
access controls:

  Admin account:
    - banqadmin (banqadmin@newquanthoms.local / typetype450)

When implementing any gating, access control, or feature flag:
  1. This account is ALWAYS exempt -- it sees everything.
  2. The exemption must be enforced in BOTH frontend and backend.
  3. In the backend, check is_admin BEFORE applying any restriction.
  4. In the frontend, check the user's role/account before hiding
     any UI element.

==============================================================================
RULE 12: SERVER CONSISTENCY -- SAME DATA EVERY WAY YOU START IT
==============================================================================

The server must produce the same content and data regardless of how
it is started:

  1. PowerShell manual:  npm start
  2. Agent-run:  via Bash tool (background process)

Both methods must:
  - Read the same .env file
  - Connect to the same database (data/banq.db)
  - Serve the same HTML files (project root)
  - Mount the same routes (backend/auth.js)
  - Apply the same proxy rules (server.js)

If the user reports that content "disappears" or is different depending
on how they start the server, the problem is one of:
  a. Different working directory (server started from wrong folder)
  b. Different .env file being read
  c. Different database file being used
  d. Stale node_modules or cached requires
  e. File not saved before server restart

Always verify the working directory and .env path when debugging
"missing content" reports.

==============================================================================
RULE 13: BACKEND JS INVENTORY -- KEEP BANQ-JS.MD IN SYNC
==============================================================================

docs/BANQ-JS.md is the plain-English inventory of every backend .js file.
Each file has a one-line description of what it does.

13.1 WHEN A NEW .JS FILE IS CREATED
Whenever a new .js file is created anywhere under backend/ or js/, the
agent MUST add it to docs/BANQ-JS.md immediately -- in the same task
that created the file. The entry must include:
  - The file path
  - A one-line plain-English description of what it does
  - The correct section (ROOT, BACKEND, or FRONTEND)

13.2 WHEN A .JS FILE IS REMOVED OR RENAMED
Update docs/BANQ-JS.md to remove or rename the entry. The inventory
must always match what is on disk.

13.3 WHEN A .JS FILE'S PURPOSE CHANGES
If a file's role changes significantly, update its one-line description.

13.4 WHY THIS EXISTS
The builder reviews and modifies backend files using natural language.
The inventory lets them find the right file by reading descriptions
instead of opening every file. An out-of-date inventory is a bug.

==============================================================================
RULE 14: STUCK FEEDBACK -- REPORT WHEN BLOCKED FOR 5+ MINUTES
==============================================================================

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
or send a follow-up message asking for status.

"Stuck" means any of:
  - The same error repeating after 2+ attempts to fix it
  - A tool call failing repeatedly with no path forward
  - The agent cannot determine the next concrete action

==============================================================================
RULE 15: PHYSICAL TEST STEPS -- TELL THE USER EXACTLY WHAT TO CLICK
==============================================================================

When a feature is completed, the agent MUST provide physical test steps
that tell the user exactly:
  1. Which URL to open
  2. What to click or type
  3. What they should see if it works
  4. What to look for if it is broken

This rule exists because the user tests with their eyes and mouse, not
with curl commands. They need to know exactly where to go, what to click,
and what to look for. Never leave them guessing.

Format example:

  PHYSICAL TEST STEPS for BANQ-0XX: Feature Name

  1. PREREQ: Start BANQ server
     - cd C:\Users\lenovo\Documents\www.newquanthoms.com; npm start
     - Verify: http://localhost:3002 loads the feed

  2. OPEN: http://localhost:3002
     - You should see the blog feed with placeholder banners

  3. SIGN IN: Click "Sign In" in the top bar
     - Enter: banqadmin / typetype450
     - Top bar should show your username + balance

  4. CLICK A BANNER:
     - Find a banner card with "+10 QU" badge
     - Click "Click to Earn" button
     - Banner should dim, show cooldown timer

==============================================================================
RULE 16: COMMIT CHECKPOINT -- SAVE BEFORE HIGH-RISK CHANGES
==============================================================================

If a new task reaches a 50% or higher risk capacity of breaking the
existing codebase, the agent MUST:
  1. Commit the current working state immediately.
  2. Save the commit reference (hash) to the commit checkpoint log
     at docs/COMMIT-CHECKPOINTS.md.
  3. Record: commit hash, date/time, and a brief description of the
     latest breakthrough or stable state before the commit.
  4. Only then proceed with the high-risk changes.

"50% high risk capacity" means any of:
  - Schema changes (new tables, altered columns, migrations)
  - Changes to more than 3 existing files simultaneously
  - Changes to core files (db.js, server.js, auth.js, app.js)
  - Changes that affect authentication, payments, or data integrity
  - Changes that modify existing API endpoints
  - Any change the agent believes could break existing functionality

==============================================================================
RULE 17: CONTINUITY -- HALF-DONE OR INTERRUPTED TASKS
==============================================================================

17.1 CORE PRINCIPLE
If an agent is deleted mistakenly, or if a project was left half-done by
a previous task/agent, the agent MUST suggest creating a STANDALONE
MARKDOWN DOCUMENT for that task.

17.2 WHEN TO SUGGEST IT
  - The user mentions an agent was deleted or reset before work finished.
  - The codebase contains partial, broken, or clearly unfinished work.
  - The task spans multiple sessions and there is no existing standalone
    spec, checkpoint, or handoff document.

17.3 WHAT THE DOCUMENT MUST CONTAIN
  1. Task name and one-sentence goal.
  2. Files touched and their current state.
  3. What was completed in the previous attempt.
  4. What remains to be done.
  5. Known blockers, defects, or decisions the user must make.
  6. The next concrete action the next agent should take.

17.4 WHERE TO PUT IT
Create the document in the docs/ directory, named after the task
(e.g., docs/TASK-NAME-HANDOFF.md).

==============================================================================
RULE 18: NEW PAGE NAVIGATION -- HEADER NAV MUST BE UPDATED
==============================================================================

Every new page created for BANQ MUST be registered in the navigation
header that appears on all pages. The header nav is hardcoded in each
HTML file's <header> section.

Current nav items: Feed (index.html), Billboards (billboards.html),
Packages (packages.html), About (about.html).

When adding a new page:
  1. Add the HTML file at project root.
  2. Add a nav link in the header section of ALL existing pages.
  3. Add the page to the AGENTS.md Section 1 directory map.
  4. Add the page to BANQ-MASTER-PIPELINE.md if it is a pipeline item.

A page that exists as an HTML file but is not in the nav is INVISIBLE
to the user. They cannot navigate to it. This is a bug, not a feature.

When renaming a page:
  1. Rename the HTML file.
  2. Update the nav link in ALL existing pages.
  3. Update any references in other docs.

==============================================================================
RULE 19: WORKTREE DISCIPLINE -- MERGE BEFORE SAYING "DONE"
==============================================================================

If you work in a git worktree, you MUST:
  1. Commit your changes in the worktree.
  2. Merge the changes to the main branch.
  3. Verify the changes are live on main (not just in the worktree).
  4. Only then say "done."

Never leave changes stranded in a worktree. The user must never discover
that work they thought was complete is actually invisible because it was
never merged. If you cannot merge for any reason, say so explicitly and
explain the situation.

==============================================================================
END OF MANDATORY MEMORY GUIDE
==============================================================================
