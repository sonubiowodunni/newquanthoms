==============================================================================
 BUFF DELEGATION GUIDE
 ==============================================================================
 Purpose: Rules and templates for delegating read-only work to BUFF.
          BUFF reads and reports. We decide and build.
 Location: C:\Users\lenovo\Documents\qwkbrowser\BUFF-DELEGATION-GUIDE.md
 ----------------------------------------------------------------------------

 THE ONE RULE
 ----------------------------------------------------------------------------
 BUFF never writes code on this project. BUFF reads files, searches the
 codebase, runs scripts, and reports findings. Every delegation prompt
 must use words like "find", "list", "report", "verify", or "check".
 Never "fix", "implement", "build", "create", "refactor", or "update".

 If BUFF outputs code suggestions, they go in the report as text blocks
 with file name and line number. We review them. We decide if they get
 written. Not BUFF.

 ----------------------------------------------------------------------------
 HOW TO USE THIS DOCUMENT
 ----------------------------------------------------------------------------
 When you want to delegate work to BUFF, come to me (Tutor) with:

   "Hey, I want you to delegate a task to BUFF but read the
    BUFF-DELEGATION-GUIDE.md document first."

 I will read this file, pick the right task template, customize it for
 the specific job, and hand you a clean copy-paste prompt to send to BUFF.

 ----------------------------------------------------------------------------
 TASK CATALOG
 ----------------------------------------------------------------------------
 Each task below has:
   - What it does
   - Why it is useful
   - Risk level (always LOW because BUFF only reads)
   - Prompt template to copy-paste

 ==============================================================================
 TASK 1: DEAD-END AUDIT
 ==============================================================================
 What: Find every placeholder, stub, and dead-end in the frontend.
 Why:  Surfaces buttons that look real but do nothing. Prevents the
       "coming soon" trust problem without anyone writing code blind.
 Risk: LOW. Read-only grep and report.

 Prompt template:
 --------------------------------------------------------------------------

 Read AGENTS.md Rules 11, 12, 13, and 14 before starting. Do not write
 any code. Do not edit any files. This is a read-only audit.

 Search every HTML file in frontend/ and every JS file in frontend/js/
 and frontend/assets/ for the following patterns:

   1. alert('  -- any alert call that is a placeholder or "coming soon"
   2. coming soon  -- any string containing this phrase
   3. TODO  -- any TODO comment
   4. not implemented  -- any string or comment containing this
   5. 501  -- any HTTP 501 response or "not implemented" status
   6. placeholder  -- any comment or string mentioning placeholder data

 For each match, report:
   - File name (relative path)
   - Line number
   - The full line of code
   - The function name it appears inside (if any)

 Format the output as a table. Do not suggest fixes. Do not write code.
 Just report what you find.

 --------------------------------------------------------------------------
 End template.

 ==============================================================================
 TASK 2: API COVERAGE MAP
 ==============================================================================
 What: List every backend route and whether the frontend calls it.
 Why:  Finds orphan endpoints (backend has it, nobody calls it) and
       ghost calls (frontend calls it, backend doesn't have it).
 Risk: LOW. Read-only grep and report.

 Prompt template:
 --------------------------------------------------------------------------

 Read AGENTS.md Rules 11, 12, 13, and 14 before starting. Do not write
 any code. Do not edit any files. This is a read-only audit.

 Step 1: Read every file in backend/routes/ and list every route
 registration. For each route, report:
   - HTTP method (GET, POST, PUT, DELETE, PATCH)
   - Full path (including the router mount prefix from server.js)
   - Whether it uses requireAuth or optionalAuth
   - The DB helper function it calls (if any)
   - File name and line number

 Step 2: Search every HTML file in frontend/ and every JS file in
 frontend/js/ and frontend/assets/ for fetch('  or fetch(" calls.
 For each fetch call, report:
   - The API path being called
   - HTTP method
   - File name and line number
   - The function it appears inside

 Step 3: Cross-reference the two lists. Report:
   - Routes that exist in backend but are never called from frontend
   - Fetch calls in frontend that have no matching backend route

 Format as three tables: Backend Routes, Frontend Fetch Calls, Mismatches.
 Do not suggest fixes. Do not write code. Just report what you find.

 --------------------------------------------------------------------------
 End template.

 ==============================================================================
 TASK 3: DB SCHEMA INVENTORY
 ==============================================================================
 What: List every table, column, index, and constraint in the database.
 Why:  Prevents duplicate table creation. 72+ tables is hard to track
       mentally. Having a written inventory means any agent can check
       before proposing a new table.
 Risk: LOW. Read-only.

 Prompt template:
 --------------------------------------------------------------------------

 Read AGENTS.md Rules 11, 12, 13, and 14 before starting. Do not write
 any code. Do not edit any files. This is a read-only audit.

 Read backend/db.js in full. Find every CREATE TABLE statement and
 every CREATE INDEX statement. For each table, report:
   - Table name
   - Line number where it is defined
   - Every column with its type and constraints (NOT NULL, DEFAULT,
     UNIQUE, PRIMARY KEY, etc.)
   - Every index on the table (name, columns, line number)
   - Any UNIQUE constraints or FOREIGN KEY references

 Also list every db.helper function (functions exported as properties
 of the db object or module.exports). For each, report:
   - Function name
   - Line number
   - What table(s) it reads or writes
   - Brief description of what it does (one sentence)

 Format as two tables: Schema (tables + columns + indexes) and
 Helpers (function name, line, table, description).
 Do not suggest fixes. Do not write code. Just report what you find.

 --------------------------------------------------------------------------
 End template.

 ==============================================================================
 TASK 4: VERIFICATION RUNNER
 ==============================================================================
 What: Run all 50+ PowerShell verification scripts and report pass/fail.
 Why:  Gives a snapshot of what is currently working and what is broken
       without anyone guessing.
 Risk: LOW. Runs existing scripts, does not modify code.

 Prompt template:
 --------------------------------------------------------------------------

 Read AGENTS.md Rules 11, 12, 13, and 14 before starting. Do not write
 any code. Do not edit any files.

 Run the following command from the project root:

   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-all.ps1

 If verify-all.ps1 does not exist or fails, run each verification script
 individually. For each verify-v*.ps1 script in scripts/:
   - Script name
   - Pass or Fail
   - If fail, the error message or failed assertion

 If the server is not running, start it first with:

   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\restart-server-silent.ps1

 Then wait 3 seconds and verify with:

   Invoke-WebRequest 'http://localhost:3001/api/health' -UseBasicParsing -TimeoutSec 3

 Format the results as a table: Script Name, Status, Error (if any).
 Do not suggest fixes. Do not write code. Just report what you find.

 --------------------------------------------------------------------------
 End template.

 ==============================================================================
 TASK 5: FRONTEND-TO-BACKEND CROSS-REFERENCE
 ==============================================================================
 What: Map every frontend fetch call to its backend route.
 Why:  Catches the exact problem we just hit -- frontend calling an
       endpoint that doesn't exist, or backend having an endpoint
       nothing uses. More thorough than Task 2 because it includes
       inline JS inside HTML files.
 Risk: LOW. Read-only.

 Prompt template:
 --------------------------------------------------------------------------

 Read AGENTS.md Rules 11, 12, 13, and 14 before starting. Do not write
 any code. Do not edit any files. This is a read-only audit.

 Search every file in frontend/ (including subdirectories) for any
 of these patterns:
   - fetch('/api
   - fetch("/api
   - fetch(window.location.origin
   - API_BASE + '
   - API_BASE + "
   - .then(function(r) { return r.json()
   - XMLHttpRequest

 For each match, report:
   - File name
   - Line number
   - The API path being called
   - HTTP method (from the fetch options or default GET)
   - The function name it appears inside

 Then read backend/server.js to find all router.use() mount points and
 list the prefix for each router file.

 Cross-reference: for each frontend fetch call, state whether a
 matching backend route exists. If it does not exist, flag it as
 GHOST CALL. If a backend route exists but no frontend calls it,
 flag it as ORPHAN ROUTE.

 Format as a table: File, Line, API Path, Method, Function, Status
 (Matched / Ghost Call / Orphan Route).
 Do not suggest fixes. Do not write code. Just report what you find.

 --------------------------------------------------------------------------
 End template.

 ==============================================================================
 TASK 6: DOCUMENTATION GENERATION
 ==============================================================================
 What: Generate or update project documentation from the codebase.
 Why:  Keeps BACKEND-INVENTORY.md, PROJECT_STATUS.md, and HANDOFF.md
       current without anyone manually maintaining them.
 Risk: LOW. Read-only research, output is a markdown report for review.

 Prompt template:
 --------------------------------------------------------------------------

 Read AGENTS.md Rules 11, 12, 13, 14, and Section 1 (Directory Map)
 before starting. Do not write any code. Do not edit any project files.

 Read the following files and generate an updated inventory:

   1. Read backend/server.js -- list every middleware, every router
      mount point, and the port. Report the order of middleware.
   2. Read every file in backend/routes/ -- for each, list the route
      prefix, number of endpoints, and which DB helpers they use.
   3. Read backend/db.js -- count total tables, list table names
      alphabetically, and note the last migration line number.
   4. Read frontend/ -- list every HTML file with its approximate line
      count and a one-sentence description of what the page does.

 Output a single markdown document with four sections:
   - Server Configuration
   - Route Inventory
   - Database Tables
   - Frontend Pages

 Do not write this to any file. Output it as text in your response.
 I will review it and decide where it goes.
 Do not suggest fixes. Do not write code. Just report what you find.

 --------------------------------------------------------------------------
 End template.

 ==============================================================================
TASK 7: BUTTON FUNCTION AUDIT
==============================================================================
What: Trace every interactive button on a page to its function, classify
      whether it actually works or is a stub/no-op/mock/phase-gated,
      and verify the backend route exists.
Why:  Surfaces buttons that look real but do nothing. Static code
      analysis is more thorough than clicking buttons manually because
      a button can show a toast (looks like it works) while making no
      backend call at all.
Risk: LOW. Read-only grep, function-body reading, and route checking.

Prompt template:
--------------------------------------------------------------------------

Read AGENTS.md Rules 11, 12, 13, and 14 before starting. Do not write
any code. Do not edit any files. This is a read-only audit.

TARGET FILE: frontend/[PAGE].html

GOAL: Produce a Function Inventory table showing which interactive
buttons on [PAGE].html have real working backends and which are
stubs, no-ops, mock-only, or dead ends.

STEP 1 — BUTTON-TO-FUNCTION MAP
Search [PAGE].html for every onclick="..." handler. For each,
report:
  - The button label or visible text (if findable nearby)
  - The function name called
  - The line number of the onclick

STEP 2 — FUNCTION ANALYSIS
For each unique function found in Step 1, read its full function
body. Classify it as one of:

  WORKING      — Has a real backend fetch/qwkFetch/fetchJson call
                  to a backend route that exists in backend/routes/
  MOCK-ONLY    — Uses makeMockFeed(), generateMockNewPost(), or
                  hardcoded demo data instead of a real API call
  STUB         — Empty body, /* stub */ comment, or no real logic
  NO-OP        — Only shows a toast/alert but makes no API call
  PHASE-GATED  — Checks checkPhase3Gate() or marketing access and
                  blocks non-marketing users (report whether the
                  gate works or just silently fails)
  DELEGATES    — Calls another function that may itself be broken
                  (trace one level deep and report what it delegates
                  to and whether that target is WORKING or not)

STEP 3 — BACKEND ROUTE CHECK
For every function classified as WORKING, verify the backend route
it calls actually exists. Read backend/server.js for router mount
prefixes, then check the corresponding route file. Report:
  - The API path called from the frontend
  - Whether a matching route exists (YES/NO)
  - The backend route file and line number if YES

STEP 4 — OUTPUT TABLE
Format the final output as a single table with these columns:

  | Button/Label | Function | Line | Classification | Backend Route | Route Exists? | Notes |

Sort the table by Classification in this order:
  STUB, NO-OP, MOCK-ONLY, PHASE-GATED, DELEGATES, WORKING

For STUB/NO-OP/MOCK-ONLY entries, add a Notes column explaining
what the button appears to do vs what it actually does.

Do not suggest fixes. Do not write code. Just report what you find.

--------------------------------------------------------------------------
End template.

==============================================================================
 TASK 8: UNIVERSAL SEARCH TABLE MAP
 ==============================================================================
 What: Map EVERY table in the database against the app-wide universal search
       function (/api/search/universal) so no content is left unsearchable.
       The current search only covers users, amplified_urls, notes, jobs,
       business_profiles, and retail_items. Topics, tags, factory posts,
       broadcasts, elist listings, studio projects, knowledgebase articles,
       crowdfund campaigns, calendar events, apps, and many more tables are
       NOT searched yet.
 Why:  The user wants the app search to catch everything: retail items,
       topics users enter when creating content, tags, and "other random
       things". Before anyone wires new categories into searchUniversal,
       we need a complete inventory of what could be searched and which
       columns to LIKE-match on. This map is the input for the build.
 Risk: LOW. Read-only.

 Prompt template:
 --------------------------------------------------------------------------

 Read AGENTS.md Rules 11, 12, 13, and 14 before starting. Do not write
 any code. Do not edit any files. This is a read-only audit.

 CONTEXT
 The app-wide universal search lives in backend/db.js in the
 searchUniversal function (around line 4577), served by
 GET /api/search/universal (backend/routes/profile.js around line 1252).
 It currently returns these categories: users, urls, notes, jobs,
 businesses, retail. The frontend renders them in the floating dock
 slideout (frontend/assets/qwk.js), the topbar dropdown
 (frontend/js/topbar-chips.js), and the full results page
 (frontend/appresult.html). The goal is to eventually search EVERY
 table that holds user-facing content, including topics and tags.

 STEP 1 - FULL TABLE INVENTORY
 Read backend/db.js in full. Find every CREATE TABLE statement. For
 each table report:
   - Table name
   - Line number where it is defined
   - One-sentence purpose (what content it holds)

 STEP 2 - SEARCHABILITY CLASSIFICATION
 For every table found in Step 1, classify it as one of:

   SEARCHABLE   - Holds user-facing content that should appear in app
                  search results (e.g. factory_posts, broadcasts,
                  knowledgebase_articles, elist_listings, apps,
                  studio_projects, crowdfund_campaigns, calendar_events,
                  reminders, recommendations, url_tracking, campaigns,
                  direct_marketing_batches, clinic_* if public)
   TOPIC/TAG    - Holds topics or tags users create or follow (e.g.
                  followed_tags, supporter_tags, amplified_urls.topic,
                  broadcasts.tags, factory post content_json tags,
                  recommendations.tag). Report how the topic/tag text is
                  stored (column name, JSON shape, CSV, etc.) so it can
                  be indexed for search.
   LOOKUP       - Reference/enum data that may be useful as filter facets
                  but is not a result category itself (e.g. campaigns,
                  apps categories, knowledgebase categories)
   INFRA        - Internal bookkeeping, ledger, session, token, rate-limit,
                  or relationship tables that should NEVER be searched
                  (e.g. sessions, guest_sessions, x_rate_limits,
                  quanthom_ledger, reward_ledger, password_reset_tokens,
                  user_follows, user_blocks, retail_audit_log)

 STEP 3 - SEARCHABLE COLUMN MAP
 For every table classified SEARCHABLE or TOPIC/TAG, report:
   - The exact columns whose text should be matched with LIKE (e.g.
     title, description, body, caption, name, url, topic, tags)
   - Any status/visibility filter that should gate the row from search
     (e.g. only status='active', visibility='public', is_published=1)
   - Which existing category the result could map to, or a proposed new
     category name (e.g. Posts, Broadcasts, Articles, Listings, Apps,
     Projects, Campaigns, Events)
   - Which frontend page the result card should link to when clicked
     (read the frontend/*.html files to find the target page)

 STEP 4 - GAP REPORT
 Read the searchUniversal function in backend/db.js (around line 4577)
 and list every SEARCHABLE/TOPIC-TAG table that is currently MISSING
 from it. Also read frontend/appresult.html and frontend/assets/qwk.js
 renderers and list every result category the frontend currently knows
 how to display, so we know which renderers also need extending.

 OUTPUT FORMAT
 Produce one markdown report with four tables:
   1. All Tables - name, line number, purpose, classification
   2. SEARCHABLE - table, columns to match, status filter, proposed
      category, target page
   3. TOPIC/TAG  - table, where the topic/tag text lives, how it is
      stored (plain column, JSON, CSV), proposed category
   4. GAP REPORT - tables missing from searchUniversal today, and
      frontend categories missing from appresult.html/qwk.js today

 Do not suggest fixes. Do not write code. Just report what you find.

 --------------------------------------------------------------------------
 End template.

==============================================================================
 DELEGATION CHECKLIST
 ==============================================================================
 Before sending any prompt to BUFF, verify:

   [ ] The prompt contains no words like "fix", "implement", "build",
       "create", "refactor", or "update"
   [ ] The prompt says "Do not write any code. Do not edit any files."
   [ ] The prompt says "Read AGENTS.md Rules 11, 12, 13, and 14 first"
   [ ] The prompt asks for a report, not a deliverable
   [ ] The output format is specified (table, list, markdown)
   [ ] BUFF is told to report line numbers and file names for everything

 If any of these are missing, the prompt is not ready to send.

 ==============================================================================
 END OF GUIDE
 ==============================================================================
