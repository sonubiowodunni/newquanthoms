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

4. backend/banq.js
   The /api/banq/* namespace (local, NOT proxied). First resident is the contact
   form: POST /contact (public, honeypot + 30s/IP rate limit, stores into
   contact_messages and queues a contact_notifications row BEFORE answering ok)
   plus admin routes (list, stats, status update, delete, notification retry).
   Requires is_admin on the admin routes. Reason it exists: about.html used to
   claim success and discard the message.

--- FRONTEND (js/) ---

5. js/app.js
   Frontend API helpers. Exposes window.BANQ namespace. Token management
   (banq_token / banq_user in localStorage). fetchJson, qwkFetch (alias),
   login, checkAuth, logout, escapeHtml, formatTime, toast. API_BASE
   auto-detected from window.location.origin + '/api'. 401 -> clear token,
   redirect to /login.html.

5. js/ad-catalog.js
   THE ADVERTISING CATALOG (BANQ-021). Single source of truth for the whole
   marketplace: the six packages (banner, video, network_banner, network_video,
   launch, full_reach), their prices, click budgets, bullet lists, button states
   and the BANQ AD SERVICE subscription. Also owns QAP format validation and the
   package-vs-profile media requirement check. Exposes window.BANQ_AD_CATALOG.
   No surface holds its own package copy -- see docs/BANQ-021-IMPLEMENTATION-
   DESIGN.md Section 2 for why (two hand-written card sets drifted apart).

6. js/ad-page.js
   THE TWO RENDERERS (BANQ-021). mountPage() writes the FULL marketplace into
   packages.html; mountPopup() writes the PARTIAL preview into the index.html
   AD-Packages popup (two bullets per row, per Section 23.8). Both read
   js/ad-catalog.js, so a preview and a page cannot describe different products.
   Also owns the launch-button notice behaviour ("SERVICE IS DELAYED FOR
   TECHNICAL REVIEW" / "AD PACKAGE WILL BE ANNOUNCE SOON"). Exposes
   window.BANQ_AD_PAGE.

==============================================================================
SCRIPTS (scripts/)
==============================================================================

7. scripts/verify-unified-ad-page.cjs
   BANQ-021 verifier. 18 checks including the DRIFT ALARM: the catalog's billing
   key set must equal the PACKAGE_TIERS key set in qwkbrowser/backend/routes/
   ads.js, so a package can never be advertised without a billing key behind it.
   Also proves no day-durations and no old tier names survive on any surface.

8. scripts/verify-v1-unified-ad-page.ps1
   PowerShell wrapper for #7 (ecosystem convention verify-v{n}-{feature}.ps1).
   Propagates the checker's exit code so it can gate a build.

==============================================================================
END OF JAVASCRIPT FILE INVENTORY
==============================================================================
