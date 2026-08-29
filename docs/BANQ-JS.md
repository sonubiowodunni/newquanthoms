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
INVENTORY -- LAST UPDATED: 2026-08-26
==============================================================================

--- ROOT LEVEL ---

1. server.js
   Main entry point. Starts the Express server on port 3002, serves static
   HTML files, mounts local auth routes (/api/auth/*), proxies /api/ads/*
   and /api/profile/* to QwkBrowser backend (port 3001), SPA fallback to
   index.html for unknown routes.

--- BACKEND (backend/) ---

2. backend/db.js
   Database layer. Creates 2 tables (users, sessions) using @libsql/client
   (SQLite at data/banq.db). Seeds admin account (banqadmin) on every boot.
   Exports db client, init function, tokenHash (SHA-256), and bcrypt.

3. backend/auth.js
   Auth routes. POST /login (username+password -> token), GET /me (verify
   token via requireAuth middleware), POST /logout (delete session).
   Token-based using UUIDv4, stored as SHA-256(token) in sessions table.
   7-day session duration. Completely independent of QwkBrowser auth.

--- FRONTEND (js/) ---

4. js/app.js
   Frontend API helpers. Exposes window.BANQ namespace. Token management
   (banq_token / banq_user in localStorage). fetchJson, qwkFetch (alias),
   login, checkAuth, logout, escapeHtml, formatTime, toast. API_BASE
   auto-detected from window.location.origin + '/api'. 401 -> clear token,
   redirect to /login.html.

==============================================================================
END OF JAVASCRIPT FILE INVENTORY
==============================================================================
