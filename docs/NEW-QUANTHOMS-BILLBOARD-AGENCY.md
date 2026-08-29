# NEW QUANTHOMS BILLBOARD AGENCY
## www.newquanthoms.com -- Implementation Plan

Created: 2026-08-24
Last Updated: 2026-08-26
Author: Owodunni (Oryade)
Status: PARTIALLY BUILT

---

## 1. WHAT THIS IS

www.newquanthoms.com (BANQ) is a standalone billboard advertising platform
that showcases image banners and video adverts. Users create BANQ accounts
to earn Quanthom Units (QU) and Quanthom Credits (QC) by engaging with
billboard content.

BANQ is an independent project with its own auth system, own database, and
own server. It proxies ad and profile data to QwkBrowser's backend API.

### Relationship to QwkBrowser

```
QwkBrowser (port 3001)               BANQ (port 3002)
+--------------------------+        +----------------------------------+
| backend/routes/ads.js    |        | Own auth (backend/auth.js)       |
|   /api/ads/eligible      |<-------|   POST /api/auth/login (local)   |
|   /api/ads/click         |        |   GET  /api/auth/me (local)      |
|   /api/ads/impression    |        |   POST /api/auth/logout (local) |
| backend/db.js            |        |                                  |
|   ad_banners             |        | Own database (data/banq.db)      |
|   ad_banner_clicks       |        |   users table                    |
|   quanthom_ledger        |        |   sessions table                 |
|   reward_ledger          |        |                                  |
+--------------------------+        | API proxy (server.js)            |
                                    |   /api/ads/*    -> QWK:3001      |
                                    |   /api/profile/* -> QWK:3001     |
                                    |                                  |
                                    | Frontend (6 HTML pages)          |
                                    |   index.html (feed)              |
                                    |   billboards.html (declaration)  |
                                    |   packages.html (ad tiers)       |
                                    |   dashboard.html (QAP + CRUD)    |
                                    |   about.html (contact form)       |
                                    |   login.html (BANQ auth)          |
                                    +----------------------------------+
```

### Connection Model: API Proxy (DECIDED)

BANQ runs its own lightweight Node/Express server on port 3002.
- Auth is LOCAL (BANQ owns its own user accounts, separate from QwkBrowser).
- Ad data and profile/balance data are PROXIED to QwkBrowser (port 3001).
- No direct DB access to QwkBrowser's database.
- Clean separation, no DB lock contention, can deploy independently.

---

## 2. CURRENT STATE (as of 2026-08-26)

### Built and Working
- 6 HTML pages: index, billboards, packages, dashboard, about, login
- Independent auth system (backend/auth.js + backend/db.js)
  - POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout
  - Token-based: UUIDv4, SHA-256 hashed, 7-day sessions
  - Admin account seeded: banqadmin / banqadmin@newquanthoms.local / typetype450
  - Token stored as banq_token in localStorage (NOT qwk_token)
- API proxy to QwkBrowser: /api/ads/* and /api/profile/*
- Frontend JS helper: window.BANQ namespace (js/app.js)
- CSS: banq- prefixed classes, dark theme with gold accents
- Packages page: 3 ad tiers (Starter $50/7d, Premium $200/14d, Sponsored $500/30d)
- Billboard Interest sidebar: city-level tracking (placeholder data)
- AD-Packages popup: QAP format validation (QAP-[A-Z0-9]{6,})
- Dashboard QAP integration: ?qap= and &pkg= URL params
- Seed banner script: backend/seed-banners.js (8 demo banners, idempotent, needs running)

### Deferred (documented in NEEDED BACKEND FOR BANQ WEBSITE.md)
1. Billboard Declaration Backend (POST /api/billboards/declare)
2. Contact Form Backend (POST /api/contact)
3. QAP Validation Backend (POST /api/ads/launch-with-qap)
4. Seed banner script needs to be run

### Not Yet Started
- Video banner dwell tracking (3s visible -> reward)
- Category filters
- Banner search
- User profile bar (QU/QC balance display)
- Click history
- Advertiser portal
- Feature flag system
- Verification scripts

---

## 3. FEATURE SCOPE

### Phase 1: Core Billboard Blog (MVP) -- PARTIALLY COMPLETE

| # | Feature | Status | Description |
|---|---------|--------|-------------|
| 1 | BANQ Sign-In | DONE | Users sign in with BANQ account (not QWK). Token in localStorage as banq_token. |
| 2 | Banner Feed | DONE | Blog-style vertical feed of image banners on index.html. Placeholder banners render on first load. |
| 3 | Video Feed | PLANNED | Video banners embedded in feed. Video banners reward on 3-second dwell. |
| 4 | Click-to-Earn | DONE (via proxy) | Clicking a partner banner awards QU via proxied POST /api/ads/click. |
| 5 | Dwell-to-Earn | PLANNED | Watching video for 3+ seconds awards QC via proxied POST /api/ads/impression. |
| 6 | Daily Bonus Progress | DONE (UI) | Progress bar on index.html. |
| 7 | Responsive Design | DONE | 375px / 768px / 1024px breakpoints (see RESPONSIVE-BREAKPOINTS.md). |
| 8 | Placeholder Content | DONE | Mock banners render on first load (per AGENTS.md Rule 9). |

### Phase 2: Enhanced Billboard

| # | Feature | Status | Description |
|---|---------|--------|-------------|
| 9 | Category Filters | PLANNED | Filter by: All, Image Banners, Video Banners, Sponsored, Trending |
| 10 | Banner Search | PLANNED | Search banners by title, advertiser, keyword |
| 11 | User Profile Bar | PLANNED | Shows signed-in user's QU balance, QC balance, today's earnings (via proxied /api/profile/*) |
| 12 | Click History | PLANNED | User can see which banners they have already clicked (via proxied /api/ads/clicks/history) |
| 13 | Billboard Locations | PLANNED | Physical billboard partner locations on a map (Phase 3) |

### Phase 3: Advertiser Portal

| # | Feature | Status | Description |
|---|---------|--------|-------------|
| 14 | Advertiser Dashboard | PLANNED | Lightweight dashboard on BANQ (redirects to QWK for full CRUD) |
| 15 | Campaign Analytics | PLANNED | Per-campaign impressions, clicks, CTR, spend |
| 16 | Billboard Booking | PLANNED | Advertisers can book physical billboard locations |

---

## 4. TECH STACK

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | Vanilla HTML/CSS/JS | No build step, no framework. Fast, simple. |
| Server | Node.js + Express | Matches QWK backend pattern. Proxies API calls to QWK. |
| Auth | BANQ-owned (backend/auth.js) | Independent from QwkBrowser. Own user accounts. |
| Ad Data | QwkBrowser API (proxied) | GET /api/ads/eligible, POST /api/ads/click, POST /api/ads/impression |
| Profile Data | QwkBrowser API (proxied) | GET /api/profile/* for balance and history |
| Database | SQLite (@libsql/client) | data/banq.db. 2 tables: users, sessions. |
| Styling | CSS custom properties | Dark theme with gold accents. banq- prefixed classes. |

---

## 5. DIRECTORY STRUCTURE (ACTUAL)

```
www.newquanthoms.com/
|
|-- index.html              Blog feed (main page)
|-- billboards.html         Billboard declaration + demand stats
|-- packages.html           Ad package tiers (Starter/Premium/Sponsored)
|-- dashboard.html          Advertiser dashboard (QAP + banner CRUD)
|-- about.html              About page + contact form
|-- login.html              BANQ sign-in page
|
|-- backend/
|   |-- auth.js             Auth routes (login, me, logout, requireAuth)
|   |-- db.js               Database setup (users, sessions, admin seed)
|   |-- seed-banners.js     Seed placeholder banner data (idempotent)
|
|-- css/
|   |-- styles.css          Global styles, CSS variables, theming
|
|-- js/
|   |-- app.js              BANQ API helpers, token management, utils
|
|-- assets/
|   |-- logo.svg            BANQ logo
|   |-- placeholder/        Placeholder banner images
|
|-- data/
|   |-- banq.db             SQLite database (gitignored)
|
|-- docs/
|   |-- AGENTS.md                       (mandatory agent guide)
|   |-- BANQ-JS.md                      (backend JS inventory)
|   |-- BANQ-MASTER-PIPELINE.md         (task tracker)
|   |-- BUFF-DELEGATION-GUIDE.md        (delegation templates)
|   |-- COMMIT-CHECKPOINTS.md           (commit log)
|   |-- NEW-QUANTHOMS-BILLBOARD-AGENCY.md (this file)
|   |-- PRE-DEPLOY.md                   (pre-launch checklist)
|   |-- RESPONSIVE-BREAKPOINTS.md       (responsive standard)
|
|-- server.js               Express entry point (static + auth + proxy)
|-- package.json            Dependencies: express, @libsql/client, bcryptjs,
|                           http-proxy-middleware, uuid
|-- .env                    QWK_API_URL, PORT, NODE_ENV
|-- .gitignore              node_modules, .env, data/*.db
|-- NEEDED BACKEND FOR BANQ WEBSITE.md  (deferred backend items)
```

---

## 6. AUTH FLOW (BANQ Account Sign-In)

```
1. User visits www.newquanthoms.com
2. If no token in localStorage -> "Sign In" link visible in header
3. User clicks "Sign In" -> redirected to login.html
4. User enters BANQ username + password
5. POST /api/auth/login (LOCAL -- not proxied to QWK)
   -> Returns { token, user: { id, username, is_admin, ... } }
6. Store token in localStorage('banq_token')
   Store user in localStorage('banq_user')
7. All subsequent API calls include:
   Authorization: Bearer <token>
8. On 401 -> clear banq_token, redirect to /login.html
9. POST /api/auth/logout -> delete session, clear localStorage
```

### API_BASE Configuration
```js
// js/app.js
BANQ.API_BASE = window.location.origin + '/api';
// Auth calls go to BANQ's own backend (/api/auth/*)
// Ad/profile calls are proxied to QwkBrowser (/api/ads/*, /api/profile/*)
```

### Proxy Configuration
```js
// server.js
const { createProxyMiddleware } = require('http-proxy-middleware');
app.use('/api/ads', createProxyMiddleware({ target: QWK_API_URL, changeOrigin: true }));
app.use('/api/profile', createProxyMiddleware({ target: QWK_API_URL, changeOrigin: true }));
// /api/auth/* is NOT proxied -- handled locally by backend/auth.js
```

---

## 7. BANNER FEED DESIGN

### Card Layout (Image Banner)
```
+--------------------------------------------------+
|  [ADVERTISER NAME]                    [+10 QU]   |
|                                                  |
|  +--------------------------------------------+  |
|  |                                            |  |
|  |          BANNER IMAGE (16:9 or 1:1)        |  |
|  |                                            |  |
|  +--------------------------------------------+  |
|                                                  |
|  Banner Title                                    |
|  Short description text...                        |
|                                                  |
|  [Click to Earn]    Come back in 23h 14m         |
+--------------------------------------------------+
```

### Card Layout (Video Banner)
```
+--------------------------------------------------+
|  [ADVERTISER NAME]                    [+5 QC]   |
|                                                  |
|  +--------------------------------------------+  |
|  |  [>]  VIDEO PLAYER (16:9)                  |  |
|  |                                            |  |
|  +--------------------------------------------+  |
|                                                  |
|  Video Title                                     |
|  Watch 3 seconds to earn credits                 |
|                                                  |
|  [Dwell timer: 0s / 3s]                          |
+--------------------------------------------------+
```

### Feed Behavior
- Banners fetched from proxied GET /api/ads/eligible
- Placeholder banners render immediately on first load
- Clicked banners dimmed with cooldown overlay
- Daily bonus progress bar pinned to top of feed
- Empty state: "No new banners right now -- check back tomorrow!"

---

## 8. REWARD LOGIC

| Action | Reward | Currency | Endpoint |
|--------|--------|----------|----------|
| Click partner banner | banner.units_reward (default 10) | QU | POST /api/ads/click (proxied) |
| Watch video 3 seconds | 5 (configurable) | QC | POST /api/ads/impression (proxied) |
| 20 unique clicks in a day | 40 bonus | QC | Auto-awarded by QWK backend |

### Cooldown
- After clicking, banner is ineligible for banner.cooldown_hours (default 24h)
- Dimmed card shows "Come back in Xh Ym"
- Timer counts down in real-time on the frontend

### Rate Limiting
- 1 click per 5 seconds per user (enforced by QWK backend)
- Frontend shows brief "Cooling down..." state after each click

---

## 9. PLACEHOLDER CONTENT (per AGENTS.md Rule 9)

Placeholder banners render on first load so the feed is never empty.

### Placeholder Banners (8 mock entries)
| # | Title | Advertiser | Reward | Type |
|---|-------|-----------|--------|------|
| 1 | [DEMO] Summer Tech Sale | TechMart | +10 QU | image |
| 2 | [DEMO] New Music Drop | SoundWave | +15 QU | image |
| 3 | [DEMO] Crypto Trading Tips | BlockChain Academy | +12 QU | video |
| 4 | [DEMO] Fashion Week Preview | StyleHub | +10 QU | image |
| 5 | [DEMO] Game Launch Trailer | PixelForge | +20 QU | video |
| 6 | [DEMO] Travel Deals | Wanderlust | +10 QU | image |
| 7 | [DEMO] Food Delivery Promo | QuickBite | +10 QU | image |
| 8 | [DEMO] Fitness Challenge | FitLife | +15 QU | video |

Seed script: `backend/seed-banners.js` (idempotent, safe to run multiple times).
Run with: `node backend/seed-banners.js`

---

## 10. RESPONSIVE BREAKPOINTS

See `docs/RESPONSIVE-BREAKPOINTS.md` for the full standard.

| Breakpoint | Layout |
|------------|--------|
| <= 480px (phone) | Single column, full-width cards, stacked nav, 12px padding |
| 481-1024px (tablet) | Single column, wider cards, condensed nav |
| > 1024px (desktop) | Two-column (feed + sidebar), max-width 1200px, 20px padding |

---

## 11. DEPENDENCIES

| Dependency | Purpose | Required |
|------------|---------|----------|
| express | Web server | Yes |
| @libsql/client | SQLite database driver | Yes |
| bcryptjs | Password hashing | Yes |
| uuid | Token generation (UUIDv4) | Yes |
| http-proxy-middleware | Proxy /api/ads/* and /api/profile/* to QWK | Yes |
| Node.js 18+ | Runtime | Yes |

No frontend dependencies. No build step. No framework. Pure vanilla.

---

## 12. CONFIGURATION

### .env
```
QWK_API_URL=http://localhost:3001
PORT=3002
NODE_ENV=development
```

### package.json
```json
{
  "name": "newquanthoms-billboard",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.0",
    "@libsql/client": "^0.6.0",
    "bcryptjs": "^2.4.3",
    "uuid": "^9.0.0",
    "http-proxy-middleware": "^3.0.0"
  }
}
```

---

## 13. QWKBROWSER API ENDPOINTS USED

BANQ proxies these endpoints to QwkBrowser's backend (port 3001):

| Endpoint | Purpose | Auth Required |
|----------|---------|---------------|
| GET /api/ads/eligible | Fetch eligible banners for feed | No (public display) |
| POST /api/ads/click | Click to earn QU | Yes (Bearer token) |
| POST /api/ads/impression | Dwell to earn QC (video) | Yes (Bearer token) |
| GET /api/ads/clicks/history | User's click history | Yes (Bearer token) |
| GET /api/profile/* | User profile and balance data | Yes (Bearer token) |

Note: BANQ sends its own Bearer token. The QwkBrowser backend must accept
BANQ tokens for proxied ad/profile endpoints, OR BANQ must map its tokens
to QWK tokens. This is part of the API partnership design (BANQ-014).

---

## 14. SECURITY NOTES

- BANQ token stored in localStorage as banq_token (NOT qwk_token)
- Bearer auth header on every API call
- Passwords hashed with bcryptjs
- Tokens are UUIDv4, stored as SHA-256(token) in sessions table
- No credentials stored on the server beyond password hashes
- Rate limiting inherited from QWK backend (1 click per 5s)
- CORS handled by proxy (no direct cross-origin calls from browser)
- Admin account (banqadmin) always exempt from any gating (AGENTS.md Rule 11)

---

## 15. PHYSICAL TEST STEPS

### Testing the Billboard Site

1. PREREQ: Start QwkBrowser server
   - In qwkbrowser folder: npm start
   - Verify: http://localhost:3001/api/health returns OK

2. PREREQ: Start BANQ server
   - cd C:\Users\lenovo\Documents\www.newquanthoms.com; npm start
   - Verify: http://localhost:3002 loads the blog feed

3. OPEN: http://localhost:3002
   - You should see the blog feed with placeholder banners
   - "Sign In" link should be visible in the header

4. SIGN IN:
   - Click "Sign In" in the header
   - Enter: banqadmin / typetype450
   - Top bar should show your username

5. CLICK A BANNER:
   - Find a banner card with "+10 QU" badge
   - Click "Click to Earn" button
   - Banner should dim, show cooldown timer

6. CHECK PACKAGES:
   - Navigate to packages.html
   - Three tiers should be visible (Starter, Premium, Sponsored)
   - Enter a QAP number (e.g., QAP-ABC123) and click a tier
   - Should redirect to dashboard.html with QAP banner

---

## 16. ANSWERED QUESTIONS (previously open)

1. **Connection model**: API Proxy (Model A) -- DECIDED. BANQ has own auth,
   proxies ads/profile to QWK.
2. **Port**: 3002 -- DECIDED. QWK is on 3001.
3. **Video content**: To be determined. Phase 2 feature.
4. **Theming**: BANQ has its own brand identity (dark + gold, banq- prefix).
   Shares design patterns with QWK but is visually distinct.
5. **Git repo**: Own repo at https://github.com/sonubiawodunni/newquanthoms.
6. **Billboard locations**: Future plan (Phase 3). Not blocking current work.

---

## 17. NAMING CONVENTIONS

- Project folder: www.newquanthoms.com
- Server file: server.js
- Auth: BANQ-owned (backend/auth.js), token as banq_token
- CSS prefix: banq- (e.g., .banq-header, .banq-card, .banq-btn)
- JS namespace: window.BANQ (defined in js/app.js)
- API proxy: /api/ads/* and /api/profile/* -> QWK backend
- Local API: /api/auth/* (BANQ's own auth)

---

## END OF IMPLEMENTATION PLAN

Current focus: Complete doc rebranding (BANQ-008), then design the
QwkBrowser API partnership (BANQ-014) with Chris.
