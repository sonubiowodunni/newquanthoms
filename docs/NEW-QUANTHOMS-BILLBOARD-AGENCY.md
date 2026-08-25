# NEW QUANTHOMS BILLBOARD AGENCY
## www.newquanthoms.com -- Implementation Plan

Created: 2026-08-24
Author: Owodunni (Oryade)
Status: PLANNED
Parent Project: QWK Browser (C:\Users\lenovo\Documents\qwkbrowser)
Parent Spec: docs/QWK-030-NEW-QUANTHOMS.md (QWK-030)

---

## 1. WHAT THIS IS

www.newquanthoms.com is a standalone blog-style website that showcases
image banners and video adverts. QWK Browser users sign in with their
existing qwkbrowser account to earn Quanthom Units (QU) and Quanthom
Credits (QC) by engaging with billboard content.

This is the public-facing billboard site. The partner dashboard (banner
CRUD, stats, campaign management) lives inside qwkbrowser at
frontend/newquanthoms.html. This site is where the banners and videos
are DISPLAYED and where users EARN.

### Relationship to QWK Browser

```
qwkbrowser (port 3001)              www.newquanthoms.com (separate project)
+--------------------------+        +----------------------------------+
| backend/routes/ads.js     |        | Blog feed of banners + videos    |
|   /api/ads/eligible       |<------>|   Fetches eligible banners       |
|   /api/ads/click          |        |   Click to earn QU               |
|   /api/ads/impression     |        |   Dwell to earn QC (video)       |
|   /api/ads/admin/*        |        |   (partner CRUD stays in QWK)    |
| backend/routes/auth.js    |        |                                  |
|   /api/auth/login         |<------>|   Sign in with QWK account       |
|   /api/auth/me            |        |   Token-based session sharing    |
| backend/db.js             |        |                                  |
|   ad_partners             |        |   Reads from same DB or API      |
|   ad_banners              |        |                                  |
|   ad_banner_clicks        |        |                                  |
|   quanthom_ledger         |        |                                  |
|   reward_ledger           |        |                                  |
+--------------------------+        +----------------------------------+
```

### Two Connection Models (choose one during implementation)

**Model A: API-Only (Recommended for Phase 1)**
- www.newquanthoms.com runs its own lightweight server (Node/Express)
- It makes API calls to qwkbrowser's backend (port 3001) for auth + ads
- No direct DB access -- everything goes through QWK's REST API
- Pros: Clean separation, no DB lock contention, can deploy independently
- Cons: Requires qwkbrowser server to be running

**Model B: Shared Database**
- www.newquanthoms.com connects directly to data/qwkbrowser.db
- Reads banners, writes clicks/rewards directly
- Pros: No API dependency, faster reads
- Cons: DB lock contention risk, tight coupling, harder to deploy separately

**Recommendation:** Start with Model A (API-only). The existing ads.js
endpoints already provide everything needed. Add new endpoints only
if the blog needs data the current API does not expose.

---

## 2. FEATURE SCOPE

### Phase 1: Core Billboard Blog (MVP)

| # | Feature | Description |
|---|---------|-------------|
| 1 | QWK Sign-In | Users sign in with their qwkbrowser username/password. Token stored in localStorage (same pattern as QWK frontend). |
| 2 | Banner Feed | Blog-style vertical feed of image banners. Each banner card shows: image, title, advertiser name, reward badge (+10 QU), "Click to Earn" button. |
| 3 | Video Feed | Video banners embedded in the same feed. Video banners reward on 3-second dwell (not click) to comply with AdSense-style policies. |
| 4 | Click-to-Earn | Clicking a partner banner awards QU via /api/ads/click. Cooldown timer shows when the banner is eligible again. |
| 5 | Dwell-to-Earn | Watching a video for 3+ seconds awards QC via /api/ads/impression. |
| 6 | Daily Bonus Progress | Progress bar: "Today: X/20 unique clicks -> 40 QC bonus" (matches QWK-030 spec). |
| 7 | Responsive Design | 375px / 768px / 1024px / >1024px breakpoints (per AGENTS.md Rule 28). |
| 8 | Placeholder Content | Mock banners and videos on first load so the site is never empty (per AGENTS.md Rules 33/35). |

### Phase 2: Enhanced Billboard

| # | Feature | Description |
|---|---------|-------------|
| 9 | Category Filters | Filter by: All, Image Banners, Video Banners, Sponsored, Trending |
| 10 | Search | Search banners by title, advertiser, keyword |
| 11 | User Profile Bar | Shows signed-in user's QU balance, QC balance, today's earnings |
| 12 | Click History | User can see which banners they have already clicked and when they reset |
| 13 | Billboard Locations | Physical billboard partner locations on a map (Phase 2 -- mentioned in QWK-030 spec) |

### Phase 3: Advertiser Portal

| # | Feature | Description |
|---|---------|-------------|
| 14 | Advertiser Dashboard | Lightweight version of the partner dashboard on this site (redirects to QWK for full CRUD) |
| 15 | Campaign Analytics | Per-campaign impressions, clicks, CTR, spend |
| 16 | Billboard Booking | Advertisers can book physical billboard locations (Phase 3) |

---

## 3. TECH STACK

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | Vanilla HTML/CSS/JS | Matches QWK Browser pattern. No build step, no framework. |
| Server | Node.js + Express | Matches QWK backend. Can proxy API calls to QWK if needed (CORS). |
| Auth | QWK Browser API | POST /api/auth/login -> token. Token in localStorage. Bearer header on every fetch. |
| Ad Data | QWK Browser API | GET /api/ads/eligible, POST /api/ads/click, POST /api/ads/impression |
| Styling | CSS custom properties | Same theming approach as QWK (Neon/Dark/Light). Share the design system. |
| Database | None (API-only) | Phase 1. If Phase 3 needs local data, add SQLite then. |

### CORS Consideration
If www.newquanthoms.com runs on a different port (e.g. 3002), QWK's
backend needs CORS headers for the ad/auth endpoints. Two options:
1. Add CORS middleware to qwkbrowser backend (allow localhost:3002)
2. Run a proxy on the newquanthoms server that forwards API calls

Option 2 (proxy) is cleaner -- the newquanthoms server forwards /api/*
to http://localhost:3001/api/* and the browser never sees CORS issues.

---

## 4. DIRECTORY STRUCTURE

```
www.newquanthoms.com/
|
|-- index.html              Blog feed (main page)
|-- video.html             Video-only feed view
|-- signin.html            Sign-in page (QWK account)
|-- profile.html           User profile (QU/QC balance, history)
|-- advertisers.html       Advertiser info / become-a-partner landing
|
|-- css/
|   |-- styles.css         Global styles, CSS variables, theming
|   |-- feed.css           Blog feed card styles
|   |-- video.css          Video player styles
|
|-- js/
|   |-- app.js             API helpers, auth, API_BASE config
|   |-- feed.js            Banner + video feed rendering
|   |-- video.js           Video dwell tracking, reward logic
|   |-- auth.js            Sign-in flow, token management
|
|-- assets/
|   |-- logo.svg           New Quanthoms Billboard logo
|   |-- placeholder/       Placeholder banner images + videos
|
|-- server.js              Express server (static + API proxy)
|-- package.json
|-- .env                   QWK_API_URL=http://localhost:3001
|-- .gitignore
|
|-- docs/
|   |-- NEW-QUANTHOMS-BILLBOARD-AGENCY.md   (this file)
|   |-- BILLBOARD-PIPELINE.md               (task tracker, created later)
|
|-- scripts/
|   |-- start-server.ps1   PowerShell launcher
|   |-- verify.ps1          Smoke test script
```

---

## 5. AUTH FLOW (QWK Account Sign-In)

```
1. User visits www.newquanthoms.com
2. If no token in localStorage -> redirect to signin.html
3. User enters qwkbrowser username + password
4. POST to QWK API: /api/auth/login
   -> Returns { token, user: { id, username, ... } }
5. Store token in localStorage('qwk_token')
6. All subsequent API calls include:
   Authorization: Bearer <token>
7. On token expiry (401) -> redirect to signin.html
```

### API_BASE Configuration
```js
// js/app.js
const QWK_API = window.location.origin + '/api';  // proxied to QWK backend
// OR direct: 'http://localhost:3001/api' (requires CORS)
```

### Proxy Approach (Recommended)
```js
// server.js -- proxy /api/* to QWK backend
const { createProxyMiddleware } = require('http-proxy-middleware');
app.use('/api', createProxyMiddleware({ target: 'http://localhost:3001', changeOrigin: true }));
```

---

## 6. BANNER FEED DESIGN

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
- Infinite scroll or "Load More" button
- Banners fetched from GET /api/ads/eligible
- Clicked banners dimmed with cooldown overlay
- Daily bonus progress bar pinned to top of feed
- Empty state: "No new banners right now -- check back tomorrow!"

---

## 7. REWARD LOGIC (matches QWK-030 spec)

| Action | Reward | Currency | Endpoint |
|--------|--------|----------|----------|
| Click partner banner | banner.units_reward (default 10) | QU | POST /api/ads/click |
| Watch video 3 seconds | 5 (configurable) | QC | POST /api/ads/impression |
| 20 unique clicks in a day | 40 bonus | QC | Auto-awarded by backend (dedup via reward_ledger) |

### Cooldown
- After clicking, banner is ineligible for banner.cooldown_hours (default 24h)
- Dimmed card shows "Come back in Xh Ym"
- Timer counts down in real-time on the frontend

### Rate Limiting
- 1 click per 5 seconds per user (enforced in ads.js)
- Frontend should show a brief "Cooling down..." state after each click

---

## 8. PLACEHOLDER CONTENT (per AGENTS.md Rules 33/35)

Since this is a new site, we need placeholder banners and videos from
day one. These are NOT disposable -- they show how the feed looks with
real data.

### Placeholder Banners (8-10 mock entries)
| # | Title | Advertiser | Image | Reward | Type |
|---|-------|-----------|-------|--------|------|
| 1 | "Summer Tech Sale" | TechMart | gradient-bg-1.svg | +10 QU | image |
| 2 | "New Music Drop" | SoundWave | gradient-bg-2.svg | +15 QU | image |
| 3 | "Crypto Trading Tips" | BlockChain Academy | gradient-bg-3.svg | +12 QU | video |
| 4 | "Fashion Week Preview" | StyleHub | gradient-bg-4.svg | +10 QU | image |
| 5 | "Game Launch Trailer" | PixelForge | gradient-bg-5.svg | +20 QU | video |
| 6 | "Travel Deals" | Wanderlust | gradient-bg-6.svg | +10 QU | image |
| 7 | "Food Delivery Promo" | QuickBite | gradient-bg-7.svg | +10 QU | image |
| 8 | "Fitness Challenge" | FitLife | gradient-bg-8.svg | +15 QU | video |

### Placeholder Videos
Use sample video URLs (e.g. from Google's sample video library) or
generate gradient-background SVG placeholders with play button overlays.

---

## 9. RESPONSIVE BREAKPOINTS (per AGENTS.md Rule 28)

| Breakpoint | Layout |
|------------|--------|
| 375px (mobile) | Single column, full-width cards, stacked nav |
| 768px (tablet) | Single column, wider cards, condensed nav |
| 1024px (desktop) | Two-column feed (main + sidebar with profile/bonus) |
| >1024px (wide) | Two-column, max-width 1200px centered, sidebar visible |

---

## 10. IMPLEMENTATION PHASES (8-Step Pipeline per AGENTS.md)

Following the QWK 8-step pipeline: spec -> pipeline -> flags -> DB -> routes -> UI -> page -> verify

### Phase 1: Foundation (Steps 1-3)

| Step | Task | Status |
|------|------|--------|
| 1 | Spec document (this file) | DONE |
| 2 | Create project folder + directory structure | DONE |
| 3 | Initialize package.json, server.js, .env, .gitignore | TODO |

### Phase 2: Auth + API Proxy (Steps 4-5)

| Step | Task | Status |
|------|------|--------|
| 4 | Set up Express server with API proxy to QWK backend | TODO |
| 5 | Build signin.html with QWK auth flow | TODO |
| 6 | Build js/app.js with API helpers (fetchJson, token management) | TODO |
| 7 | Test: sign in with a QWK account, verify token works | TODO |

### Phase 3: Banner Feed (Steps 6-7)

| Step | Task | Status |
|------|------|--------|
| 8 | Build index.html with blog feed layout | TODO |
| 9 | Build js/feed.js -- fetch eligible banners, render cards | TODO |
| 10 | Implement click-to-earn (POST /api/ads/click) | TODO |
| 11 | Implement cooldown display + real-time timer | TODO |
| 12 | Implement daily bonus progress bar | TODO |
| 13 | Add placeholder banners (8-10 mock entries) | TODO |
| 14 | Add responsive CSS for all breakpoints | TODO |

### Phase 4: Video Feed (Step 7 continued)

| Step | Task | Status |
|------|------|--------|
| 15 | Build video card component with HTML5 video player | TODO |
| 16 | Implement dwell tracking (3s visible -> POST /api/ads/impression) | TODO |
| 17 | Add placeholder videos | TODO |

### Phase 5: Polish + Test (Step 8)

| Step | Task | Status |
|------|------|--------|
| 18 | Build profile.html (QU/QC balance, click history) | TODO |
| 19 | Build advertisers.html (become-a-partner landing) | TODO |
| 20 | Add theming (Dark/Light/Neon -- match QWK design system) | TODO |
| 21 | Write verify.ps1 smoke test script | TODO |
| 22 | Physical UI test steps (per AGENTS.md Rule 32) | TODO |
| 23 | Update QWK-MASTER-PIPELINE.md with new task entry | TODO |

---

## 11. DEPENDENCIES

| Dependency | Purpose | Required |
|------------|---------|----------|
| express | Web server | Yes |
| http-proxy-middleware | Proxy /api/* to QWK backend | Yes (Model A) |
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

### package.json (minimal)
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
    "http-proxy-middleware": "^3.0.0"
  }
}
```

---

## 13. QWK BACKEND CHANGES NEEDED

The existing ads.js endpoints cover most of what we need. Potential
additions:

| Endpoint | Purpose | Priority |
|----------|---------|----------|
| GET /api/ads/feed | Public feed of banners (no auth required for display, auth for rewards) | Phase 2 |
| GET /api/ads/video/:id | Stream video banner content | Phase 2 |
| GET /api/profile/balance | Lightweight balance check (QU + QC only) | Phase 1 |

The existing endpoints that work as-is:
- POST /api/auth/login (sign in with QWK account)
- GET /api/auth/me (verify token)
- GET /api/ads/eligible (get eligible banners)
- POST /api/ads/click (click to earn QU)
- POST /api/ads/impression (dwell to earn QC)
- GET /api/ads/clicks/history (click history)

---

## 14. SECURITY NOTES

- Token stored in localStorage (same as QWK Browser pattern)
- Bearer auth header on every API call
- No credentials stored on the newquanthoms server (API-only model)
- Rate limiting inherited from QWK backend (1 click per 5s)
- CORS handled by proxy (no direct cross-origin calls from browser)
- Production accounts (qwkbrowser, iloveqwkbrowser, quanthomoffice,
  qwkadmin) are always exempt from gating (per AGENTS.md Rule 37)

---

## 15. PHYSICAL TEST STEPS (per AGENTS.md Rule 32)

### Testing the Billboard Site

1. PREREQ: Start QWK Browser server
   - Run: scripts\restart-server-silent.ps1 (in qwkbrowser folder)
   - Verify: http://localhost:3001/api/health returns OK

2. PREREQ: Start New Quanthoms server
   - Run: cd C:\Users\lenovo\Documents\www.newquanthoms.com; npm start
   - Verify: http://localhost:3002 loads the blog feed

3. OPEN: http://localhost:3002
   - You should see the blog feed with placeholder banners
   - If you see "Sign in to earn rewards" prompt, the auth gate is working

4. SIGN IN:
   - Click "Sign In" in the top bar
   - Enter your qwkbrowser username and password
   - You should be redirected back to the feed
   - Top bar should show your username + QU balance

5. CLICK A BANNER:
   - Find a banner card with "+10 QU" badge
   - Click "Click to Earn" button
   - Banner should dim, show "Come back in 23h 59m"
   - Your QU balance should increase by 10

6. WATCH A VIDEO:
   - Find a video card with "+5 QC" badge
   - Press play, watch for 3 seconds
   - Dwell timer should show "3s / 3s -- Earned!"
   - Your QC balance should increase by 5

7. DAILY BONUS:
   - Click 20 unique banners in one session
   - Progress bar should fill to 20/20
   - You should receive 40 QC bonus
   - Progress bar should reset the next day

---

## 16. OPEN QUESTIONS FOR OWODUNNI

Before implementation starts, I need answers to these:

1. **Connection model**: API-only (Model A) or shared database (Model B)?
   Recommendation: Model A (API-only).

2. **Port**: Should the newquanthoms server run on port 3002?
   (QWK is on 3001.)

3. **Video content**: Where do video banners come from?
   - Uploaded by advertisers via the QWK partner dashboard?
   - Embedded from YouTube/Vimeo?
   - Hosted on the newquanthoms server?

4. **Theming**: Should the site share QWK's exact design system
   (colors, fonts, CSS variables) or have its own brand identity?

5. **Git repo**: Should www.newquanthoms.com have its own git repo,
   or be a subfolder tracked in the qwkbrowser repo?

6. **Billboard locations (Phase 2/3)**: Do you already have physical
   billboard partners, or is this a future plan? This affects whether
   we build the map feature now or later.

---

## 17. NAMING CONVENTIONS (per AGENTS.md)

- Project folder: www.newquanthoms.com
- Server file: server.js (matches QWK pattern)
- API proxy: /api/* -> QWK backend
- CSS variables: same names as QWK (--bg, --surface, --card, --accent, etc.)
- JS helpers: same names as QWK (qwk.fetchJson, qwk.escapeHtml, qwk.signedIn)
- Feature flags: if needed, follow QWK pattern (flag_name, default false)

---

## END OF IMPLEMENTATION PLAN

Next step: Answer the open questions in Section 16, then I will
initialize the project (package.json, server.js, directory structure)
and start building Phase 2 (auth + API proxy).
