# QAP Related Tasks

> **ID:** QAP-SYSTEM
> **Status:** PLANNING -- spec agreed, implementation not started
> **Created:** 2026-08-26
> **Location:** docs/QAP-RELATED-TASK.md
> **Depends on:** BANQ-QWK-API-PARTNERSHIP.md (updated), QWK-031 Feature 6
> **Owner:** Chris (design decisions) + Agent (implementation)

---

## 1. What QAP Is

QAP (Quanthom Advertising Profile) is a QwkBrowser core feature. A user
builds an advertising profile on mybmf.html (Advertising Profile tab).
When they click "Upgrade Profile (Advertising)", they fill out a form
with CTA message, up to 10 keywords, regional target, and media upload
(banner, audio, video). QwkBrowser generates a QAP number
(QAP-[A-Z0-9]{6,}).

That QAP number is portable. The user can give it to anyone -- friends,
partners like BANQ, future publishers in the Quanthom Advertising
Network. Whoever has the QAP number enters it on a partner site, the
partner calls QwkBrowser's API, gets back all the ad materials, and
activates the ad. One profile, many publishers.

---

## 2. Naming Decision (Agreed 2026-08-26)

**Table:** `quanthom_ad_profiles` (was `bmf_ad_profiles`)

Rationale:
- QAP is platform infrastructure, not a BMF QLUB community feature
- The `quanthom_` prefix matches existing convention (quanthom_ledger,
  quanthom_credit, quanthom_unit)
- mybmf.html remains the UX entry point, but the table and routes live
  in the platform namespace
- When BMF QLUB becomes a standalone mobile app, ad profiles stay with
  QwkBrowser core, not coupled to BMF

**Routes:** `/api/ad-profile/*` (was `/api/bmf/ad-profile/*`)

---

## 3. Current State (What Exists)

### 3.1 Database (qwkbrowser/backend/db.js, line 4159)

Table: `bmf_ad_profiles`
Columns: id, user_id, url, title, description, image_url, site_name,
favicon_url, saved_at

Missing: qap_number, media_type, filename, cta_message, keywords,
regional_target

### 3.2 API Routes (qwkbrowser/backend/routes/bmf.js, lines 1162-1379)

- GET /api/bmf/ad-profile -- list saved profiles
- POST /api/bmf/ad-profile/save -- save a profile
- DELETE /api/bmf/ad-profile/:id -- delete a profile
- POST /api/bmf/ad-profile/upgrade -- STUB (deferred, does nothing)

### 3.3 Frontend (qwkbrowser/frontend/mybmf.html)

- Advertising Profile tab (line 923)
- adUpgradeProfile() button (line 2034) -- calls stub endpoint
- renderAdProfileTab() (lines 2013-2164) -- URL input, saved list
- No QAP generation, no media upload, no keyword/CTA/regional fields

### 3.4 BANQ Frontend (www.newquanthoms.com/frontend/newquanthoms.html)

- QAP input UI with regex validation (lines 706-789)
- Three package inputs: starter, premium, sponsored
- Client-side only -- no backend QAP validation
- Text: "QAP = Quanthom Advertising Profile Number. Get yours on
  QwkBrowser mybmf.html."

### 3.5 What Does NOT Exist

- QAP number generation on QwkBrowser backend
- QAP column on any table
- GET endpoint to fetch profile data by QAP number
- The upgrade form (CTA, keywords, regional target, media upload)
- Quanthom Advertising Network publisher system
- BANQ backend calling QWK to validate QAP

---

## 4. Task Breakdown

### Phase 1: QwkBrowser Backend -- Table + API

#### Task 1.1: Rename table bmf_ad_profiles -> quanthom_ad_profiles
- **Where:** qwkbrowser/backend/db.js (line 4159)
- **What:** Rename CREATE TABLE statement + index
- **Migration:** ALTER TABLE bmf_ad_profiles RENAME TO quanthom_ad_profiles
- **Risk:** HIGH -- schema change. Follow QWK AGENTS.md Rule 16 (commit
  checkpoint before high-risk changes). Back up DB first.
- **Also update:** All references in bmf.js routes (lines 1317-1379)

#### Task 1.2: Add new columns to quanthom_ad_profiles
- **Columns to add:**
  - qap_number TEXT UNIQUE -- the QAP identifier (QAP-[A-Z0-9]{6,})
  - media_type TEXT DEFAULT 'url' -- 'url', 'image', 'audio', 'video'
  - filename TEXT -- uploaded media file path
  - cta_message TEXT -- call-to-action message
  - keywords TEXT -- comma-separated, max 10
  - regional_target TEXT DEFAULT 'worldwide' -- country or region
  - upgraded_at DATETIME -- when profile was upgraded (QAP generated)
  - status TEXT DEFAULT 'active' -- 'active', 'paused', 'expired'
- **Migration:** ALTER TABLE quanthom_ad_profiles ADD COLUMN ...
- **Where:** qwkbrowser/backend/db.js

#### Task 1.3: Move routes from bmf.js to new ad-profile.js
- **New file:** qwkbrowser/backend/routes/ad-profile.js
- **Move:** Lines 1162-1379 from bmf.js
- **New route prefix:** /api/ad-profile (was /api/bmf/ad-profile)
- **Update server.js:** Mount new route
- **Update QWKBROWSER-JS.md:** Add ad-profile.js entry (QWK Rule 39)
- **Keep bmf.js:** Remove the ad-profile section, leave a comment
  pointing to the new file

#### Task 1.4: Implement POST /api/ad-profile/upgrade
- **What:** The real upgrade endpoint (replaces the stub)
- **Flow:**
  1. User must be signed in (requireAuth)
  2. Accept: profile_id, cta_message, keywords (max 10), regional_target,
     media_type, filename (optional)
  3. Generate QAP number: QAP- + 6+ random alphanumeric chars
  4. Check uniqueness (retry if collision)
  5. UPDATE quanthom_ad_profiles SET qap_number, cta_message, keywords,
     regional_target, media_type, filename, upgraded_at, status='active'
  6. Return: { success, qap_number, profile }
- **Where:** qwkbrowser/backend/routes/ad-profile.js

#### Task 1.5: Implement GET /api/ad-profile/qap/:qap
- **What:** Public endpoint for partners (BANQ, future publishers) to
  fetch ad materials by QAP number
- **Auth:** None (public) -- this is the partner-facing endpoint
- **Flow:**
  1. Validate QAP format (QAP-[A-Z0-9]{6,})
  2. SELECT from quanthom_ad_profiles WHERE qap_number = ?
  3. If not found or not upgraded -> 404
  4. Return: { qap_number, cta_message, keywords (array), regional_target,
     media_type, filename, image_url, title, description, target_url,
     site_name, favicon_url }
  5. Do NOT return: user_id, internal id, or any private user data
- **Where:** qwkbrowser/backend/routes/ad-profile.js

#### Task 1.6: Update mybmf.html upgrade form
- **Where:** qwkbrowser/frontend/mybmf.html
- **What:** Replace the stub adUpgradeProfile() with a real form:
  - CTA message input
  - Keywords input (comma-separated, max 10, show count)
  - Regional target dropdown (worldwide + country list)
  - Media type selector (url, image, audio, video)
  - Media upload (file input for image/audio/video)
  - Submit button -> POST /api/ad-profile/upgrade
  - On success: show QAP number prominently with copy button
- **Follow QWK AGENTS.md rules:**
  - Rule 42: Check for function name collisions before adding
  - Rule 43: No state.user guards on form open, only on submit
  - Rule 41: Verify changes are in the served file
  - Rule 44: Tell user to hard-refresh

### Phase 2: BANQ Backend -- QAP Integration

#### Task 2.1: Add QAP proxy route to BANQ server.js
- **Where:** www.newquanthoms.com/server.js
- **What:** Proxy /api/ad-profile/qap/:qap to QwkBrowser
  GET http://localhost:3001/api/ad-profile/qap/:qap
- **Auth:** None (public endpoint on QWK side)

#### Task 2.2: Update BANQ dashboard QAP activation
- **Where:** www.newquanthoms.com/dashboard.html (and/or newquanthoms.html)
- **What:** When user enters QAP number and clicks Launch:
  1. Call BANQ /api/ad-profile/qap/:qap (proxied to QWK)
  2. If 404 -> "QAP number not found. Check the number and try again."
  3. If 200 -> show ad materials (CTA, image, targeting info)
  4. Confirm activation -> create banner via POST /api/ads/admin/banners
     (user must be ad partner first)
  5. Show success with banner details

#### Task 2.3: Update BANQ-QWK-API-PARTNERSHIP.md
- **Where:** www.newquanthoms.com/docs/BANQ-QWK-API-PARTNERSHIP.md
- **What:** Update QAP sections to reflect that QwkBrowser owns QAP,
  BANQ calls QWK API to validate and fetch profile data
- **Status:** DONE (updated in this session)

### Phase 3: Documentation Updates

#### Task 3.1: Update QWK-031 MULTI-FEATURE-BATCH doc
- **Where:** qwkbrowser/docs/QWK-031-MULTI-FEATURE-BATCH.md
- **What:** Feature 6 references bmf_ad_profiles -> update to
  quanthom_ad_profiles. Update endpoint paths from /api/bmf/ad-profile
  to /api/ad-profile. Note QAP number addition.

#### Task 3.2: Update QWK AGENTS.md
- **Where:** qwkbrowser/docs/AGENTS.md
- **What:** If ad-profile.js is a new route file, add it to the
  directory map. Update any references to bmf_ad_profiles.

#### Task 3.3: Update QWKBROWSER-JS.md
- **Where:** qwkbrowser/docs/QWKBROWSER-JS.md
- **What:** Add entry for backend/routes/ad-profile.js (QWK Rule 39)

#### Task 3.4: Update BANQ AGENTS.md
- **Where:** www.newquanthoms.com/docs/AGENTS.md
- **What:** Update Section 2 (LAST PROMPT RESIDUE) with current state.
  Add QAP-RELATED-TASK.md to docs directory map.

#### Task 3.5: Update BANQ-MASTER-PIPELINE.md
- **Where:** www.newquanthoms.com/docs/BANQ-MASTER-PIPELINE.md
- **What:** Add QAP integration tasks to pipeline

#### Task 3.6: Update BANQ-JS.md
- **Where:** www.newquanthoms.com/docs/BANQ-JS.md
- **What:** If new JS files created in BANQ for QAP, add entries

---

## 5. Implementation Order

1. Task 1.1 -- Rename table (QWK side, with DB backup)
2. Task 1.2 -- Add columns (QWK side)
3. Task 1.3 -- Move routes to ad-profile.js (QWK side)
4. Task 1.4 -- Implement upgrade endpoint (QWK side)
5. Task 1.5 -- Implement QAP fetch endpoint (QWK side)
6. Task 1.6 -- Update mybmf.html form (QWK side)
7. Task 2.1 -- Add QAP proxy to BANQ (BANQ side)
8. Task 2.2 -- Update BANQ dashboard (BANQ side)
9. Task 3.1-3.6 -- Documentation updates (both sides)

---

## 6. Schema: quanthom_ad_profiles (Target)

```sql
CREATE TABLE IF NOT EXISTS quanthom_ad_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  image_url TEXT,
  site_name TEXT,
  favicon_url TEXT,
  saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- QAP upgrade fields (added 2026-08-26)
  qap_number TEXT UNIQUE,
  media_type TEXT DEFAULT 'url',
  filename TEXT,
  cta_message TEXT,
  keywords TEXT,
  regional_target TEXT DEFAULT 'worldwide',
  upgraded_at DATETIME,
  status TEXT DEFAULT 'active',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 7. API Endpoints (Target)

### QwkBrowser side (port 3001):

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/ad-profile | Bearer token | List user's saved profiles |
| POST | /api/ad-profile/save | Bearer token | Save a new profile (URL fetch) |
| DELETE | /api/ad-profile/:id | Bearer token | Delete a profile |
| POST | /api/ad-profile/upgrade | Bearer token | Upgrade profile: generate QAP, store CTA/keywords/media |
| GET | /api/ad-profile/qap/:qap | None (public) | Fetch ad materials by QAP number (partner-facing) |

### BANQ side (port 3002):

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /api/ad-profile/qap/:qap | None (proxied) | Proxy to QWK, fetch ad materials by QAP |

---

## 8. QAP Number Format

- Pattern: QAP-[A-Z0-9]{6,}
- Example: QAP-26384J3
- Generated by QwkBrowser backend on upgrade
- Unique constraint on quanthom_ad_profiles.qap_number
- Regex validation on both client and server side

---

## 9. Quanthom Advertising Network (Future Vision)

QAP is the foundation of the Quanthom Advertising Network:
- QwkBrowser users create ad profiles and get QAP numbers
- Partners (BANQ, future publishers) integrate via the QAP API
- One profile, many publishers
- Users control their ad materials, partners display them
- Revenue model: partners earn from ad engagement, QwkBrowser handles
  reward distribution (QU/QC)

Future phases:
- Publisher registration and API keys
- Analytics dashboard for QAP holders
- Multi-publisher distribution tracking
- Revenue sharing between QwkBrowser and publishers
- QAP transfer/assignment between users

---

## 10. Change Log

| Date | Change |
|------|--------|
| 2026-08-26 | Doc created. Naming agreed: quanthom_ad_profiles. Full task breakdown defined. |

---

## END OF QAP RELATED TASK DOC
