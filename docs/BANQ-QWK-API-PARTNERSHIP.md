# BANQ-QWK API Partnership Spec

> **ID:** BANQ-014
> **Status:** RESOLVED -- open items answered via QwkBrowser codebase research. Ready for implementation.
> **Created:** 2026-08-26
> **Location:** docs/BANQ-QWK-API-PARTNERSHIP.md
> **Dependencies:** BANQ-006 (auth system), BANQ-008 (doc rebranding)

---

## 1. Overview

BANQ (www.newquanthoms.com, port 3002) is a standalone billboard advertising
platform. It displays ad banners and video adverts, lets users earn rewards
by engaging with content, and provides advertising packages.

BANQ uses QwkBrowser (port 3001) as its ad and identity service. Users sign
in with their existing QwkBrowser account -- no new account needed. BANQ
proxies ad and profile API calls to QwkBrowser, passing the QwkBrowser token
through. BANQ's admin handles everything else (billboards, packages,
dashboard, contact form, QAP integration).

### Design Principles

1. **One account per user.** Users sign in with QwkBrowser credentials.
   BANQ never creates separate user accounts.
2. **BANQ admin is separate.** BANQ keeps its own admin account
   (banqadmin) for BANQ-specific controls. This is a forward-looking
   decision -- BANQ admin may manage things QwkBrowser admin does not.
3. **QwkBrowser owns identity and rewards.** User identity, token
   issuance, ad banner data, reward ledger, and balance tracking all
   live in QwkBrowser's backend.
4. **BANQ owns presentation and BANQ-specific features.** Page layout,
   styling, billboard declarations, contact form, packages, dashboard,
   QAP integration, placeholder content -- all BANQ.
5. **Proxy, not direct.** BANQ's server proxies API calls to QwkBrowser.
   The browser never makes cross-origin calls directly. No CORS issues.

---

## 2. Auth Flow

### 2.1 Login Flow

```
1. User visits BANQ (http://localhost:3002)
2. No token in localStorage -> "Sign In" link visible in header
3. User clicks "Sign In" -> redirected to login.html
4. User enters QwkBrowser username + password
5. BANQ server receives POST /api/auth/login
6. BANQ server forwards credentials to QwkBrowser:
     POST http://localhost:3001/api/auth/login
     Body: { username, password }
7. QwkBrowser validates -> returns { success, token, user: { id, username, email, quanthom_credit, quanthom_unit, tier, referral_code, location, created_at, is_marketing_account } }
   NOTE: QwkBrowser does NOT return is_admin. Admin is determined by
   the QWK_ADMIN_USERNAMES env var on QwkBrowser's server. BANQ must
   check admin status separately (see Section 2.5).
8. BANQ server passes response back to frontend
9. Frontend stores:
     localStorage('banq_token') = token  (this IS a QwkBrowser token)
     localStorage('banq_user') = user object
10. All subsequent API calls include:
     Authorization: Bearer <token>
```

### 2.2 Token Verification

```
1. Frontend calls BANQ endpoint that requires auth
2. BANQ server checks Authorization header
3. BANQ server forwards GET http://localhost:3001/api/auth/me
   with the same Bearer token
4. QwkBrowser validates token -> returns user info
5. BANQ server trusts QwkBrowser's response
6. If 401 -> BANQ server returns 401 to frontend
7. Frontend clears localStorage, redirects to /login.html
```

### 2.3 Logout Flow

```
1. User clicks "Sign Out"
2. Frontend calls POST /api/auth/logout on BANQ server
3. BANQ server forwards POST http://localhost:3001/api/auth/logout
   with Bearer token
4. QwkBrowser invalidates the session
5. Frontend clears localStorage('banq_token') and localStorage('banq_user')
6. Redirect to /login.html
```

### 2.4 Token Storage

| Key | Value | Set By | Read By |
|-----|-------|--------|---------|
| banq_token | QwkBrowser token (string) | login.html JS | js/app.js (BANQ.fetchJson) |
| banq_user | User object (JSON string) | login.html JS | js/app.js (UI display) |

Note: banq_token IS a QwkBrowser token. The key name is banq_token to
keep BANQ's namespace clean, but the value is issued by QwkBrowser.

### 2.5 BANQ Admin Account

BANQ keeps its own admin account (banqadmin) seeded in backend/db.js.

Why both?
- QwkBrowser admin accounts control QwkBrowser features (ad CRUD,
  campaign management, reward settings).
- BANQ admin account controls BANQ features (billboard declarations,
  contact form messages, package management, dashboard access).

The banqadmin account is separate from QwkBrowser's user system. It is
used for BANQ-specific backend operations only (e.g., viewing contact
form submissions, managing billboard declarations). It does NOT
participate in the QwkBrowser auth flow.

For ad-related admin actions (banner CRUD, campaign stats), the user
must be a QwkBrowser admin. QwkBrowser does NOT have an is_admin database
column. Admin status is determined by the QWK_ADMIN_USERNAMES env var
on QwkBrowser's server (comma-separated list of usernames). The default
admin account is: qwkadmin (qwkadmin@qwkbrowser.local / typetype450).

BANQ cannot read QWK_ADMIN_USERNAMES directly. To check if a user is a
QWK admin, BANQ has two options:
  a. Call a QWK endpoint that requires requireAdmin middleware. If it
     returns 200, the user is an admin. If 403, they are not.
  b. Maintain a local allowlist in BANQ's .env (BANQ_QWK_ADMINS) that
     mirrors QWK_ADMIN_USERNAMES. Simpler, but requires manual sync.

Recommended: Option (b) for now. Add to BANQ's .env:
  BANQ_QWK_ADMINS=qwkadmin,iloveqwkbrowser,qwkbrowser,quanthomoffice

### 2.6 Auth State in Frontend

```js
// js/app.js -- BANQ namespace

BANQ.signedIn = function() {
  return !!localStorage.getItem('banq_token');
};

BANQ.user = function() {
  const u = localStorage.getItem('banq_user');
  return u ? JSON.parse(u) : null;
};

BANQ.isAdmin = function() {
  // QwkBrowser has no is_admin field. Check against local allowlist.
  const u = BANQ.user();
  if (!u || !u.username) return false;
  const admins = (process.env.BANQ_QWK_ADMINS || 'qwkadmin').split(',');
  return admins.includes(u.username);
};

BANQ.token = function() {
  return localStorage.getItem('banq_token');
};
```

---

## 3. API Proxy Architecture

### 3.1 What BANQ Proxies to QwkBrowser

| BANQ Route | Proxied To | Auth | Purpose |
|------------|-----------|------|---------|
| /api/auth/login | POST localhost:3001/api/auth/login | None (credentials in body) | User sign-in (accepts username or email + password) |
| /api/auth/me | GET localhost:3001/api/auth/me | Bearer token (optionalAuth) | Token verification + balance check |
| /api/auth/logout | POST localhost:3001/api/auth/logout | Bearer token (requireAuth) | Sign out (deletes session + revokes device tracking) |
| /api/ads/public | GET localhost:3001/api/ads/public | None (public) | Fetch active banners for feed display (no auth needed) |
| /api/ads/eligible | GET localhost:3001/api/ads/eligible | Bearer token + checkFlag(ads_new_panel) | Fetch eligible banners for signed-in user |
| /api/ads/click | POST localhost:3001/api/ads/click | Bearer token + checkFlag | Click to earn QU (body: { banner_id }) |
| /api/ads/impression | POST localhost:3001/api/ads/impression | Bearer token + checkFlag | Dwell to earn QU (body: { banner_id }) -- only for source='google' banners |
| /api/ads/clicks/history | GET localhost:3001/api/ads/clicks/history | Bearer token + checkFlag | User click history |
| /api/ads/admin/banners | GET/POST localhost:3001/api/ads/admin/banners | Bearer token (must be ad partner) | List/create banners |
| /api/ads/admin/banners/:id | PUT/DELETE localhost:3001/api/ads/admin/banners/:id | Bearer token (must be ad partner) | Update/delete banners |
| /api/ads/admin/stats | GET localhost:3001/api/ads/admin/stats | Bearer token (must be ad partner) | Click stats |
| /api/ads/admin/partner | POST localhost:3001/api/ads/admin/partner | Bearer token | Become an ad partner (self-service) |
| /api/profile/me | GET localhost:3001/api/profile/me | Bearer token | Full profile (includes quanthom_unit, quanthom_credit) |
| /api/profile/token-summary | GET localhost:3001/api/profile/token-summary | Bearer token | Today/yesterday QU+QC earnings |
| /api/ad-profile/qap/:qap | GET localhost:3001/api/ad-profile/qap/:qap | None (public) | Fetch ad materials by QAP number (partner-facing) |

Note: /api/ads/eligible, /api/ads/click, /api/ads/impression, and
/api/ads/clicks/history are gated by checkFlag(ads_new_panel). If the
flag is off on QwkBrowser, these return 503. The public feed endpoint
(/api/ads/public) is NOT flag-gated and always works.

BANQ should use /api/ads/public for feed display (no auth, no flag).
BANQ should use /api/ads/eligible only when the user is signed in and
wants to see which banners they can still earn from.

### 3.2 What BANQ Handles Locally (NOT proxied)

| BANQ Route | Handler | Auth | Purpose |
|------------|---------|------|---------|
| /api/billboards/declare | BANQ backend | Bearer token (QWK) | Billboard declaration form |
| /api/billboards/interest | BANQ backend | None (public) | City-level interest data |
| /api/billboards/demand | BANQ backend | Bearer token (QWK admin) | All declarations (admin view) |
| /api/contact | BANQ backend | None (public) | Contact form submission |
| /api/contact/messages | BANQ backend | Bearer token (banqadmin) | View contact messages (admin) |
| /api/ads/launch-with-qap | BANQ backend | Bearer token (QWK) | QAP validation + ad launch |

### 3.3 Proxy Configuration (server.js)

```js
const { createProxyMiddleware } = require('http-proxy-middleware');
const QWK_API_URL = process.env.QWK_API_URL || 'http://localhost:3001';

// Auth proxy -- forward credentials to QwkBrowser, pass response back
app.use('/api/auth', createProxyMiddleware({
  target: QWK_API_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '/api/auth' }
}));

// Ad data proxy
app.use('/api/ads', createProxyMiddleware({
  target: QWK_API_URL,
  changeOrigin: true
}));

// Profile proxy
app.use('/api/profile', createProxyMiddleware({
  target: QWK_API_URL,
  changeOrigin: true
}));
```

Note: /api/billboards/* and /api/contact/* are NOT proxied. They are
handled by BANQ's own backend routes (to be built -- see BANQ-009,
BANQ-010 in BANQ-MASTER-PIPELINE.md).

### 3.4 Error Handling

| Scenario | BANQ Behavior |
|----------|---------------|
| QwkBrowser server down | Proxy returns 502 Bad Gateway. Frontend shows "Service temporarily unavailable." Feed falls back to placeholder banners. |
| QwkBrowser returns 401 | BANQ passes 401 through. Frontend clears token, redirects to login. |
| QwkBrowser returns 429 (rate limit) | BANQ passes 429 through. Frontend shows "Cooling down..." message. |
| QwkBrowser returns 500 | BANQ passes 500 through. Frontend shows generic error toast. |
| Proxy timeout (QWK slow) | BANQ returns 504 Gateway Timeout after 10s. |

---

## 4. Data Flow Diagram

### 4.1 Display Feed (No Auth)

```
Browser                    BANQ Server (3002)           QwkBrowser (3001)
   |                            |                             |
   | GET /api/ads/public        |                             |
   |--------------------------->|                             |
   |                            | GET /api/ads/public         |
   |                            |---------------------------->|
   |                            |                             |
   |                            |  { banners: [...], count }  |
   |                            |  (id, title, image_url,     |
   |                            |   target_url, units_reward)  |
   |                            |<----------------------------|
   |   { banners, count }       |                             |
   |<---------------------------|                             |
   |                            |                             |
   | Render feed (or merge      |                             |
   |  with placeholder banners)  |                             |
```

### 4.2 Click to Earn (Auth Required)

```
Browser                    BANQ Server (3002)           QwkBrowser (3001)
   |                            |                             |
   | POST /api/ads/click        |                             |
   | Authorization: Bearer xxx  |                             |
   | Body: { banner_id: 42 }    |                             |
   |--------------------------->|                             |
   |                            | POST /api/ads/click         |
   |                            | Authorization: Bearer xxx    |
   |                            | Body: { banner_id: 42 }     |
   |                            |---------------------------->|
   |                            |                             |
   |                            |  { units_earned: 10,        |
   |                            |    eligible_again_at: "...",|
   |                            |    daily_clicks: 5,          |
   |                            |    daily_bonus_earned: false,|
   |                            |    new_eligible_count: 12 } |
   |                            |<----------------------------|
   |   { units_earned, ... }   |                             |
   |<---------------------------|                             |
   |                            |                             |
   | Update UI: dim banner,     |                             |
   | show cooldown, update QU   |                             |
```

### 4.3 Billboard Declaration (BANQ Local)

```
Browser                    BANQ Server (3002)           QwkBrowser (3001)
   |                            |                             |
   | POST /api/billboards/declare                             |
   | Authorization: Bearer xxx  |                             |
   | Body: { city, country,     |                             |
   |   type, message }           |                             |
   |--------------------------->|                             |
   |                            |                             |
   |                            | Verify token:               |
   |                            | GET /api/auth/me            |
   |                            |---------------------------->|
   |                            |  { id, username,            |
   |                            |    quanthom_unit, ... }     |
   |                            |<----------------------------|
   |                            |                             |
   |                            | Save to BANQ DB             |
   |                            | (billboard_declarations)     |
   |                            |                             |
   |   { success: true }        |                             |
   |<---------------------------|                             |
```

---

## 5. BANQ Backend Changes Required

### 5.1 Auth System Simplification

Current state: BANQ has its own users + sessions tables in data/banq.db
with bcrypt password hashing and UUIDv4 tokens.

New state: BANQ's auth routes proxy to QwkBrowser. BANQ still keeps
the banqadmin account and a minimal local table for BANQ-specific admin
operations.

Changes to backend/auth.js:
- POST /api/auth/login: forward credentials to QwkBrowser, return QWK
  token + user object. Do NOT create local user or session.
- GET /api/auth/me: forward to QwkBrowser, return QWK user object.
- POST /api/auth/logout: forward to QwkBrowser, invalidate QWK session.
- Keep banqadmin auth for BANQ admin endpoints only (contact messages,
  billboard declarations admin view).

Changes to backend/db.js:
- Keep users table (for banqadmin only).
- Remove sessions table (no local sessions -- QwkBrowser handles sessions).
- Add billboard_declarations table (BANQ-009).
- Add contact_messages table (BANQ-010).

### 5.2 New BANQ-Only Endpoints

These endpoints are handled by BANQ's own backend, NOT proxied:

POST /api/billboards/declare
  Auth: Bearer token (verified against QwkBrowser)
  Body: { city, country, billboard_type, message }
  Saves to: billboard_declarations table in data/banq.db
  Returns: { success, declaration_id }

GET /api/billboards/interest
  Auth: None (public)
  Returns: Top cities by declaration count (last 7 days)
  Reads from: billboard_declarations table

GET /api/billboards/demand
  Auth: Bearer token + is_admin (QwkBrowser admin or banqadmin)
  Returns: All declarations (admin view)
  Reads from: billboard_declarations table

POST /api/contact
  Auth: None (public, rate limited 1/30s per IP)
  Body: { name, email, subject, message }
  Saves to: contact_messages table in data/banq.db
  Returns: { success }

GET /api/contact/messages
  Auth: banqadmin only (local BANQ auth)
  Returns: All contact form submissions
  Reads from: contact_messages table

POST /api/ads/launch-with-qap
  Auth: Bearer token (verified against QwkBrowser)
  Body: { qap, package_type }
  QAP validation: QwkBrowser-owned. BANQ calls QWK API to fetch profile:
    GET http://localhost:3001/api/ad-profile/qap/:qap
    Returns: { qap_number, cta_message, keywords, regional_target,
              media_type, filename, image_url, title, description,
              target_url, site_name, favicon_url }
    If 404 -> "QAP number not found"
    If 200 -> BANQ has all ad materials to create the banner
  Creates ad banner via QwkBrowser API (POST /api/ads/admin/banners)
    -- requires user to be an ad partner first (POST /api/ads/admin/partner)
    -- banner fields populated from QAP profile data (title, image_url,
       target_url from profile; units_reward from package_type)
  Returns: { success, banner_id }

### 5.3 BANQ Database Schema (data/banq.db)

```sql
-- Kept from current schema (for banqadmin only)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- NEW: Billboard declarations (BANQ-009)
CREATE TABLE IF NOT EXISTS billboard_declarations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,          -- QwkBrowser user ID (from token)
  username TEXT NOT NULL,            -- QwkBrowser username (denormalized)
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  billboard_type TEXT NOT NULL,      -- 'image', 'video', 'digital'
  message TEXT,
  status TEXT DEFAULT 'pending',     -- 'pending', 'approved', 'rejected'
  created_at TEXT DEFAULT (datetime('now'))
);

-- NEW: Contact form messages (BANQ-010)
CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  ip_address TEXT,                   -- For rate limiting
  created_at TEXT DEFAULT (datetime('now'))
);
```

Note: sessions table is REMOVED. QwkBrowser handles sessions.

---

## 6. QwkBrowser Backend Changes Required

### 6.1 Minimal -- Confirmed None Required

Research confirmed: QwkBrowser already has everything BANQ needs.

- Auth: POST /api/auth/login (accepts username or email + password,
  returns token + user object with balances)
- Token check: GET /api/auth/me (optionalAuth, returns full user object
  including quanthom_unit and quanthom_credit)
- Public feed: GET /api/ads/public (no auth, no flag, returns active
  banners with id, title, image_url, target_url, units_reward,
  targeting_type, targeting_value)
- Eligible feed: GET /api/ads/eligible (requires auth + ads_new_panel flag)
- Click to earn: POST /api/ads/click (body: { banner_id }, returns
  units_earned, eligible_again_at, daily_clicks, daily_bonus_earned,
  new_eligible_count)
- Impression: POST /api/ads/impression (body: { banner_id }, only works
  for source='google' banners)
- Click history: GET /api/ads/clicks/history (returns array with id,
  user_id, banner_id, units_earned, clicked_at, eligible_again_at, title,
  image_url, target_url)
- Ad partner: POST /api/ads/admin/partner (self-service signup)
- Banner CRUD: POST/GET/PUT/DELETE /api/ads/admin/banners[/:id]
  (requires ad partner status, body for create: title, image_url,
  target_url, units_reward [min 10], targeting_type, targeting_value,
  cooldown_hours, daily_budget, expires_at)
- Balance: GET /api/auth/me returns quanthom_unit (QU) and
  quanthom_credit (QC) directly in the user object
- Today's earnings: GET /api/profile/token-summary returns
  { today: { qu, qc }, yesterday: { qu, qc } }

No new endpoints needed on QwkBrowser. No new tables needed.
No CORS needed (proxy is server-side).

### 6.2 Flag Dependency

BANQ's click-to-earn and impression endpoints depend on QwkBrowser's
ads_new_panel flag being ON. If the flag is OFF, these return 503.

The public feed (/api/ads/public) is NOT flag-gated and always works.

BANQ should handle 503 gracefully: show banners (from /api/ads/public)
but display "Sign in to earn rewards" instead of click-to-earn buttons.

### 6.2 CORS

Not needed. BANQ proxies through its own server. The browser never
makes direct cross-origin calls to QwkBrowser.

---

## 7. Frontend Changes

### 7.1 js/app.js

Update BANQ namespace:
- BANQ.token() returns localStorage('banq_token') (which IS a QWK token)
- BANQ.signedIn() checks for banq_token existence
- BANQ.user() parses localStorage('banq_user')
- BANQ.isAdmin() checks username against BANQ_QWK_ADMINS allowlist
  (QwkBrowser has no is_admin field -- admin is env-based)
- BANQ.fetchJson() sends Authorization: Bearer <banq_token> on all calls
- BANQ.qwkFetch() alias kept for compatibility
- 401 handler: clear banq_token + banq_user, redirect to /login.html

### 7.1.1 QWK API Response Field Reference

Banner object (from /api/ads/public or /api/ads/eligible):
  id, partner_id, source ('partner'|'google'), title, image_url,
  target_url, units_reward (integer, default 10), targeting_type
  ('worldwide'|'country'|'keyword'), targeting_value, cooldown_hours
  (default 24), daily_budget, status, created_at, expires_at

Click response (from POST /api/ads/click):
  units_earned (integer), eligible_again_at (ISO string),
  daily_clicks (integer), daily_bonus_earned (boolean),
  new_eligible_count (integer)

User object (from /api/auth/login or /api/auth/me):
  id, username, email, is_guest, quanthom_credit (QC balance),
  quanthom_unit (QU balance), fiat_balance, tier, referral_code,
  location, created_at, verification_badge, avatar_url,
  is_marketing_account, marketing_balance

Token summary (from /api/profile/token-summary):
  today: { qu, qc }, yesterday: { qu, qc }

### 7.2 login.html

Update login form handler:
- POST to /api/auth/login (BANQ server proxies to QwkBrowser)
- On success: store token as banq_token, store user as banq_user
- On failure: show error message (invalid credentials, server down)
- No local account creation -- purely a pass-through to QwkBrowser

### 7.3 index.html

No auth changes needed. Feed display is public. Click-to-earn already
sends Bearer token via BANQ.fetchJson(). The token IS a QwkBrowser token,
so proxied calls to QwkBrowser will authenticate correctly.

### 7.4 dashboard.html

- QAP integration: POST /api/ads/launch-with-qap (BANQ backend validates
  QAP format locally, then creates banner via POST /api/ads/admin/banners)
  -- user must be an ad partner first (POST /api/ads/admin/partner)
- Banner CRUD: proxied to QwkBrowser's /api/ads/admin/banners endpoints
  (requires ad partner status, not just admin)
- Admin check: BANQ.isAdmin() (checks username against BANQ_QWK_ADMINS)

---

## 8. Environment Configuration

### .env

```
QWK_API_URL=http://localhost:3001
PORT=3002
NODE_ENV=development
BANQ_ADMIN_USERNAME=banqadmin
BANQ_ADMIN_PASSWORD=typetype450
BANQ_QWK_ADMINS=qwkadmin,iloveqwkbrowser,qwkbrowser,quanthomoffice
```

### server.js Proxy Config

```js
const QWK_API_URL = process.env.QWK_API_URL || 'http://localhost:3001';

// Auth proxy
app.use('/api/auth', createProxyMiddleware({
  target: QWK_API_URL,
  changeOrigin: true
}));

// Ad data proxy
app.use('/api/ads', createProxyMiddleware({
  target: QWK_API_URL,
  changeOrigin: true
}));

// Profile proxy
app.use('/api/profile', createProxyMiddleware({
  target: QWK_API_URL,
  changeOrigin: true
}));

// BANQ local routes (NOT proxied)
// app.use('/api/billboards', billboardRoutes);
// app.use('/api/contact', contactRoutes);
```

---

## 9. Security Considerations

1. **Token is a QwkBrowser token.** BANQ never creates or validates
   tokens. It forwards credentials to QwkBrowser and passes the returned
   token through. Token security is QwkBrowser's responsibility.

2. **BANQ admin is local only.** banqadmin account exists only in BANQ's
   database. It is used for BANQ-specific admin endpoints (contact messages,
   billboard declarations admin view). It does NOT have access to
   QwkBrowser's admin features.

3. **QwkBrowser admin is checked via QWK user object.** When a BANQ
   endpoint needs to verify the user is a QwkBrowser admin, it calls
   GET /api/auth/me (proxied to QWK) and checks is_admin on the response.

4. **Rate limiting.** Contact form: 1 submission per 30s per IP (BANQ
   local). Ad clicks: 1 per 5s per user (QwkBrowser's existing limit).

5. **No credentials stored on BANQ server.** BANQ's server does not
   store QwkBrowser passwords. It forwards them to QwkBrowser's login
   endpoint and discards them. Only the returned token is passed to the
   frontend, which stores it in localStorage.

6. **Proxy is server-side only.** The browser never makes direct calls
   to QwkBrowser. All cross-server communication goes through BANQ's
   proxy. No CORS exposure.

---

## 10. Implementation Order

1. **Simplify backend/auth.js** -- proxy login/me/logout to QwkBrowser.
   Remove local session creation. Keep banqadmin auth for BANQ endpoints.
2. **Simplify backend/db.js** -- remove sessions table, add
   billboard_declarations + contact_messages tables. Keep users table
   for banqadmin.
3. **Update server.js** -- ensure proxy config matches Section 8.
4. **Update js/app.js** -- token management (banq_token IS QWK token).
5. **Update login.html** -- login form posts to /api/auth/login (proxied).
6. **Build BANQ-009** -- billboard declaration backend (local).
7. **Build BANQ-010** -- contact form backend (local).
8. **Build BANQ-011** -- QAP validation backend (calls QWK API).
9. **Test end-to-end** -- sign in with QWK account, view feed, click to
   earn, check balance, declare billboard, submit contact form.

---

## 11. Resolved Items (Research Completed 2026-08-26)

All open items have been answered by reading the QwkBrowser codebase.

### 11.1 Balance Endpoint -- RESOLVED

No dedicated /api/profile/balance endpoint exists. Use:
- GET /api/auth/me -> returns quanthom_unit (QU) and quanthom_credit (QC)
  directly in the user object. This is the simplest way to get balances.
- GET /api/profile/token-summary -> returns today's and yesterday's
  earnings broken down by QU and QC. Use for the "today's earnings" display.

### 11.2 Ads Feed Response Format -- RESOLVED

GET /api/ads/public (no auth, no flag) returns:
  { banners: [...], count: N }
Each banner: id, title, image_url, target_url, units_reward,
  targeting_type, targeting_value

GET /api/ads/eligible (auth + ads_new_panel flag) returns:
  { banners: [...], count: N }
Each banner: id, partner_id, source, title, image_url, target_url,
  units_reward, targeting_type, targeting_value, cooldown_hours,
  daily_budget, status, created_at, expires_at

Field name mapping for BANQ frontend:
  banner ID = id (not banner_id)
  reward amount = units_reward (not reward_amount)
  reward currency = always QU (not a field)
  banner type = source ('partner' or 'google') (not banner_type)
  advertiser name = not returned (only partner_id FK)
  target URL = target_url
  cooldown = cooldown_hours

### 11.3 QAP Validation -- RESOLVED (UPDATED 2026-08-26)

QAP (Quanthom Advertising Profile) is a QwkBrowser core feature, NOT
a BANQ-only concept. QAP does not exist in the codebase yet but MUST
be built on QwkBrowser's backend.

Current state:
- Table bmf_ad_profiles exists (db.js line 4159) but has no QAP column
- POST /api/bmf/ad-profile/upgrade is a stub (does nothing)
- mybmf.html has the Advertising Profile tab with an Upgrade button
- QAP format (QAP-[A-Z0-9]{6,}) exists only in newquanthoms.html frontend

What needs to be built on QwkBrowser:
- Rename bmf_ad_profiles -> quanthom_ad_profiles (platform, not BMF)
- Add columns: qap_number, media_type, filename, cta_message, keywords,
  regional_target, upgraded_at, status
- Move routes from bmf.js to new ad-profile.js (/api/ad-profile/*)
- Implement POST /api/ad-profile/upgrade (generate QAP, store materials)
- Implement GET /api/ad-profile/qap/:qap (public, partner-facing)
- Update mybmf.html upgrade form (CTA, keywords, regional, media upload)

What BANQ does:
- Proxies GET /api/ad-profile/qap/:qap to QwkBrowser
- Uses returned materials to create banner via POST /api/ads/admin/banners
- BANQ does NOT own QAP validation -- it calls QwkBrowser's API

See docs/QAP-RELATED-TASK.md for full task breakdown.

### 11.4 Admin Detection -- RESOLVED

QwkBrowser has NO is_admin database column. Admin status is determined
by the QWK_ADMIN_USERNAMES env var on QwkBrowser's server.

BANQ handles admin detection via a local allowlist in .env:
  BANQ_QWK_ADMINS=qwkadmin,iloveqwkbrowser,qwkbrowser,quanthomoffice

The BANQ.isAdmin() function checks the user's username against this list.
This must be kept in sync with QwkBrowser's QWK_ADMIN_USERNAMES manually.

### 11.5 Reward Display -- RESOLVED

BANQ should update balances after actions (not real-time polling):
- On login: store quanthom_unit and quanthom_credit from /api/auth/me
- After click: update from click response (units_earned) or re-fetch /api/auth/me
- After dwell: update from impression response (units_earned) or re-fetch /api/auth/me
- Optional: poll /api/auth/me every 60s for balance refresh (if user is active)

Real-time polling is not necessary. Action-triggered updates are sufficient
and reduce API load.

### 11.6 Video Banner Content -- DEFERRED

QwkBrowser's ad_banners table has no video-specific fields (no video_url,
no video_duration). The impression endpoint only works for source='google'
banners. Video banner support is a Phase 2 feature that may require:
- Adding video_url to QwkBrowser's ad_banners table, OR
- BANQ managing video content separately in its own database, OR
- Using image_url for video thumbnails and linking to external video

This is not blocking for Phase 1 (image banner feed + click-to-earn).

### 11.7 Production Deployment -- DEFERRED

BANQ's .env QWK_API_URL is currently http://localhost:3001.
For production, this needs to point to QwkBrowser's production URL.
QwkBrowser's production URL is not yet determined.
This is a deployment-time configuration change, not a code change.

---

## 12. Change Log

| Date | Change |
|------|--------|
| 2026-08-26 | Initial spec created. Auth model: QwkBrowser credentials, token pass-through. BANQ admin kept for BANQ-specific features. |
| 2026-08-26 | Researched QwkBrowser codebase (ads.js, auth.js, profile.js, db.js). Resolved all 6 open items. Updated field names to match actual QWK API responses. Discovered: no is_admin field (env-based), no QAP endpoint, GET /api/ads/public exists for BANQ, impression only works for google-sourced banners, ad partner self-service endpoint exists. |
| 2026-08-26 | QAP architecture revised: QAP is a QwkBrowser core feature, NOT BANQ-only. Table bmf_ad_profiles to be renamed quanthom_ad_profiles. QwkBrowser will own QAP generation and the partner-facing GET /api/ad-profile/qap/:qap endpoint. BANQ proxies to it. Created docs/QAP-RELATED-TASK.md with full task breakdown. |

---

## END OF API PARTNERSHIP SPEC
