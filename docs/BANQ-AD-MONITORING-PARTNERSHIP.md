# BANQ Ad Monitoring & Revenue Partnership

> **ID:** BANQ-AD-MONITORING
> **Status:** SPEC -- awaiting Chris approval to implement
> **Created:** 2026-08-29
> **Location:** docs/BANQ-AD-MONITORING-PARTNERSHIP.md
> **Depends on:** QAP-RELATED-TASK.md, BANQ-QWK-API-PARTNERSHIP.md
> **Pre-spec by:** Chris + review agent (provided 2026-08-29)
> **Spec source:** QWK BROWSER x BANQ Ad Monitoring & Revenue Partnership Specification (Sections 1-24) + BANQ Overview/Mission/Vision

---

## 1. What This Is

A re-evaluation of the BANQ-QWK relationship. The old model was
"BANQ is a separate ad platform that proxies QWK." The new model is:

**QWK Browser owns all advertising infrastructure. BANQ is an optional
campaign monitoring service layer that advertisers can opt into at any
ad launch entry point.**

Key principles:
- QWK owns: ad infrastructure, QAP system, ad inventory, campaign
  delivery, billing, publisher network, advertiser accounts
- BANQ provides: campaign monitoring, customer relationship, analysis,
  dedicated support, strategic recommendations
- BANQ does NOT own ad inventory or receive revenue simply because an
  ad launched through a BANQ page
- BANQ earns when an advertiser explicitly opts into BANQ monitoring
- The opt-in must be visible on EVERY ad launch surface in QwkBrowser

---

## 2. Terminology

| Term | Meaning |
|------|---------|
| Campaign Manager | BANQ, from the customer's POV |
| Campaign Manager Assistant(s) | Individual(s) or team assigned to a customer from the BANQ office |
| BANQ Service | Optional monitoring/analysis/support layer on top of QWK ads |
| BANQ Opt-In | Advertiser explicitly chooses BANQ monitoring for a campaign |
| AD Packages | Unified name for ad tier packages (was "New Quanthoms AD-Packages") |

---

## 3. Ad Launch Entry Points

All entry points use the same QWK advertising infrastructure. The BANQ
opt-in offer must appear on EVERY surface where an advertiser can launch
a campaign.

### 3.1 Entry Point A: QWK Browser Automated Advertising Page
```
Advertiser -> QWK Browser Ads -> Enter QAP -> Retrieve Profile
-> Configure Campaign -> "Would you like BANQ to monitor your campaign?"
-> YES/NO -> Launch
```

### 3.2 Entry Point B: BANQ Page Inside QWK Browser (newquanthoms.html)
```
Advertiser -> BANQ Floating Dock / newquanthoms.html -> Enter QAP
-> Retrieve Profile -> BANQ Service Option presented
-> Configure Campaign -> YES/NO -> Launch
```

### 3.3 Entry Point C: Quanthom Network Page (quanthomnetwork.html)
```
Advertiser -> quanthomnetwork.html -> Enter QAP -> Retrieve Profile
-> Configure Campaign -> "Would you like BANQ to monitor your campaign?"
-> YES/NO -> Launch
```

### 3.4 Entry Point D: BANQ Standalone Site (newquanthoms.com)
```
Advertiser -> newquanthoms.com/index.html -> AD Packages popup
-> Enter QAP -> BANQ Service Option presented -> YES/NO -> Launch
```

### 3.5 Rule: Opt-In Everywhere
The BANQ service offer must appear on every ad launch surface. An
advertiser should never have to go looking for BANQ -- if they want
monitoring, the option is visible right where they are launching.

The difference between entry points is presentation, not eligibility.

---

## 4. BANQ Service Offer UI

Suggested flow after QAP validation:

```
BANQ CAMPAIGN MONITORING

Would you like BANQ to monitor and provide
additional support for this campaign?

BANQ can provide:
- Dedicated campaign monitoring
- Campaign activity analysis
- Additional reporting or summaries
- Human/customer relationship support
- Campaign observations and recommendations

[ ] Yes -- Add BANQ Monitoring    [ ] No -- Continue without

BANQ Monitoring: + [X] Credits (or + $[X])
[ Continue ]
```

The fee must be clearly visible before the user confirms.

---

## 5. Opt-In / Opt-Out

The advertiser must be able to choose freely:
- YES: creates a BANQ service record, charges the fee, assigns to BANQ
- NO: continues with automated QWK advertising only, no BANQ involvement
- The user can see the cost before confirming
- The user can stop or modify the service later

---

## 6. Source Tracking

The system must record where the advertiser started:

| campaign_source | Meaning |
|-----------------|---------|
| qwkbrowser_ads | QWK Browser automated ads page |
| banq_page | BANQ page inside QWK (newquanthoms.html, dock slideout) |
| quanthomnetwork | quanthomnetwork.html |
| banq_standalone | newquanthoms.com (BANQ standalone site) |
| direct_link | Direct URL |
| partner_link | Partner referral |
| other | Other |

**Source alone does NOT determine BANQ revenue.** An advertiser can:
- Enter through BANQ page but decline monitoring
- Enter through QWK ads but opt into BANQ monitoring

The revenue trigger is: `banq_service_status = opted_in`

---

## 7. Campaign Attribution Fields

When BANQ monitoring is selected, the campaign record gets:

| Field | Type | Purpose |
|-------|------|---------|
| campaign_source | TEXT | Where the advertiser started |
| banq_service_opt_in | INTEGER (0/1) | Did they opt in? |
| banq_service_plan | TEXT | Monitor, Insight, Managed, Enterprise |
| banq_service_fee | INTEGER | Fee in QC or cents |
| banq_service_status | TEXT | Lifecycle status (see Section 8) |
| banq_assigned_team | TEXT | Team or assistant assigned |
| banq_monitoring_start | DATETIME | When monitoring begins |
| banq_monitoring_end | DATETIME | When monitoring ends |

---

## 8. Service Status Lifecycle

```
NOT_SELECTED
  -> OFFERED
  -> OPTED_IN
  -> PAYMENT_CONFIRMED
  -> ACTIVE
  -> MONITORING
  -> CAMPAIGN_COMPLETED
  -> SERVICE_COMPLETED
```

Additional statuses: PAUSED, CANCELLED, EXPIRED, REFUNDED, SUSPENDED

---

## 9. Revenue Model

Advertising spend and BANQ service fee are separate financial components.

```
TOTAL CUSTOMER PAYMENT:
  Advertising Budget: 10,000 Credits  ->  QWK Browser
  BANQ Monitoring:     1,000 Credits   ->  BANQ Revenue Ledger
  Total:              11,000 Credits
```

The BANQ fee does NOT reduce the advertising budget unless the advertiser
explicitly selects a package where that is intended.

QWK Browser collects all payment. BANQ's earned amount accumulates in a
ledger and is settled periodically.

---

## 10. BANQ Revenue Ledger (New Table on QWK)

```sql
CREATE TABLE IF NOT EXISTS banq_revenue_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  qap_number TEXT,
  banq_service_plan TEXT NOT NULL,
  banq_service_fee INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  settled_at DATETIME,
  settlement_period TEXT
);
```

---

## 11. BANQ Settlement

- Initial model: monthly settlement with detailed statement
- Statement shows: campaign ID, QAP/masked reference, date, service
  selected, plan, fee charged, refunds, adjustments, final amount due
- Schedule is configurable (weekly, monthly, quarterly, custom)

---

## 12. Service Tiers

| Tier | Name | Description |
|------|------|-------------|
| 1 | BANQ Monitor | Basic campaign monitoring |
| 2 | BANQ Insight | Monitoring + periodic analysis |
| 3 | BANQ Managed | Dedicated relationship support + deeper campaign management |
| 4 | BANQ Enterprise | Dedicated team for multi-brand companies |

Plans are admin-configurable. Launch with one tier, expand later.

---

## 13. Enterprise / Multi-Company

A large business group can have multiple QAPs (one per brand). BANQ
monitors them under a shared enterprise relationship.

```
BANQ ENTERPRISE ACCOUNT
  Client Group
    -> QAP A (Hotel Brand)
    -> QAP B (Restaurant Brand)
    -> QAP C (Retail Brand)
```

---

## 14. Publisher Network Rule

The QWK Browser Publisher Network is exclusively owned, controlled, and
operated by QWK Browser. BANQ cannot:
- Add or remove publishers
- Sell publisher inventory outside authorized QWK systems
- Change publisher rules
- Access restricted publisher data

If QWK creates an approved package that includes Publisher Network
distribution, BANQ may offer that package only through QWK's permissions
and pricing.

---

## 15. Advertiser Privacy & Consent

When a user selects BANQ monitoring, the system records explicit consent:
- What BANQ can access
- What BANQ will monitor
- Whether the service costs money
- How long BANQ has access
- How to stop or modify the service

---

## 16. BANQ Dashboard Access

BANQ dashboard shows ONLY:
- Active clients
- Active monitored campaigns
- Campaigns requiring attention
- Monitoring periods
- Client communication
- Analysis notes
- Service revenue
- Pending settlement

BANQ does NOT have access to:
- QWK Publisher Network controls
- Non-BANQ advertisers
- QWK internal financial data
- Platform-wide private data

Access is role-based.

---

## 17. QWK Back-Office Dashboard

QWK administrators see:
- Total advertising revenue
- Total BANQ service revenue
- Active BANQ-monitored campaigns
- BANQ revenue payable
- Paid settlements
- Pending settlements

QWK can audit every BANQ-related transaction.

---

## 18. BANQ Surfaces Show Only BANQ-Opted Ads

The following surfaces show ONLY ads where the advertiser opted into
BANQ monitoring (banq_service_status = opted_in or active or monitoring):

1. **QWK newquanthoms.html** (the slideout panel page)
2. **QWK floating dock slideout** (the "New QU" dock in homepage)
3. **BANQ standalone site** (newquanthoms.com/index.html)

Ads without BANQ monitoring do NOT appear on these surfaces. They appear
on the regular QWK feed and Quanthom Network surfaces.

---

## 19. File Changes Required

### 19.1 Text-Only Changes (LOW RISK)

| # | File | Line(s) | Change |
|---|------|---------|--------|
| T1 | BANQ index.html | 69 | "Check New Quanthoms AD-Packages" -> "Check AD Packages" |
| T2 | BANQ index.html | 340 | Modal title "New Quanthoms AD-Packages" -> "AD Packages" |
| T3 | BANQ packages.html | 7 | `<title>AD-Packages -- New Quanthoms</title>` -> `<title>AD Packages -- BANQ</title>` |
| T4 | BANQ packages.html | 98 | Hero title "New Quanthoms AD-Packages" -> "AD Packages" |
| T5 | QWK newquanthoms.html | 401 | "Check New Quanthoms AD-Packages" -> "Check AD Packages" |
| T6 | QWK newquanthoms.html | 778 | Modal title "New Quanthoms AD-Packages" -> "AD Packages" |
| T7 | QWK quanthomnetwork.html | 146-148 | Reword exclusion notice: surfaces show BANQ-monitored campaigns, not "exclusively reserved for BANQ" |
| T8 | BANQ index.html | 366 | "dedicated manager" -> "dedicated campaign manager" |
| T9 | BANQ packages.html | 149 | "dedicated manager" -> "dedicated campaign manager" |
| T10 | BANQ about.html | 198 | Update: only BANQ-monitored campaigns appear on BANQ surfaces |
| T11 | QWK topbar-chips.js | 45 | Optional: update dock label if needed |

### 19.2 Backend Schema Changes (HIGH RISK -- backup DB first per QWK Rule 16)

| # | File | Change |
|---|------|--------|
| B1 | QWK db.js | Add banq_service columns to ad_banners table (or new banner_banq_service table) |
| B2 | QWK db.js | Add banq_revenue_ledger table (see Section 10) |
| B3 | QWK ads.js | Update POST /api/ads/admin/banners (or launch-with-qap) to accept banq_service_* fields |
| B4 | QWK ads.js | Add filter to GET /api/ads/public: support ?banq_only=true to return only BANQ-opted ads |

### 19.3 UI Flow Changes (MEDIUM RISK)

| # | File | Change |
|---|------|--------|
| U1 | QWK newquanthoms.html | Insert BANQ opt-in step between QAP fetch and banner creation (lines 706-729) |
| U2 | QWK quanthomnetwork.html | Add BANQ opt-in step to ad package launch flow |
| U3 | QWK QWK ads page | Add BANQ opt-in step to the standard QWK ad launch flow (if separate page exists) |
| U4 | BANQ index.html | Add BANQ opt-in step to AD-Packages popup (lines 485-494) |
| U5 | BANQ packages.html | Add BANQ opt-in step to QAP submit flow (lines 234-246) |
| U6 | BANQ dashboard.html | Restrict to BANQ-relevant data only (active clients, monitored campaigns, service revenue, settlements) |

### 19.4 Feed Filter Changes (MEDIUM RISK)

| # | File | Change |
|---|------|--------|
| F1 | QWK newquanthoms.html | Fetch only BANQ-opted banners (add banq_only=true to API call) |
| F2 | BANQ index.html | Fetch only BANQ-opted banners (add banq_only=true to API call, line 292) |

### 19.5 Documentation Updates

| # | File | Change |
|---|------|--------|
| D1 | BANQ-QWK-API-PARTNERSHIP.md | Update to reflect new relationship model |
| D2 | QAP-RELATED-TASK.md | Add banq_service fields to quanthom_ad_profiles schema |
| D3 | BANQ AGENTS.md | Update last prompt residue |
| D4 | QWK AGENTS.md | Update last prompt residue if working on QWK side |
| D5 | BANQ-MASTER-PIPELINE.md | Add BANQ monitoring tasks to pipeline |
| D6 | QWK QWKBROWSER-JS.md | Add new route file if created |

---

## 20. Implementation Order

### Phase 1: Text-Only Changes (zero risk)
1. T1-T11 -- all text renames and rewording
2. Commit checkpoint

### Phase 2: Backend Schema (high risk -- backup first)
3. B1 -- add banq_service columns to ad_banners (or new table)
4. B2 -- add banq_revenue_ledger table
5. B3 -- update ads.js to accept banq_service fields
6. B4 -- add banq_only filter to ads/public
7. Commit checkpoint

### Phase 3: Feed Filters (depends on Phase 2)
8. F1 -- newquanthoms.html fetches only BANQ-opted ads
9. F2 -- BANQ index.html fetches only BANQ-opted ads
10. Commit checkpoint

### Phase 4: UI Flow (depends on Phase 2 + 3)
11. U1 -- BANQ opt-in on newquanthoms.html
12. U2 -- BANQ opt-in on quanthomnetwork.html
13. U3 -- BANQ opt-in on QWK ads page
14. U4 -- BANQ opt-in on BANQ index.html popup
15. U5 -- BANQ opt-in on BANQ packages.html
16. U6 -- BANQ dashboard restricted to BANQ data
17. Commit checkpoint

### Phase 5: Documentation
18. D1-D6 -- update all docs
19. Final commit

---

## 21. Final Architecture

```
                    ADVERTISER
                        |
            +-----------+-----------+
            |                       |
            v                       v
     QWK BROWSER ADS         BANQ PAGE / DOCK
     quanthomnetwork.html    newquanthoms.html
            |                       |
            +-----------+-----------+
                        |
                        v
                 ENTER QAP NUMBER
                        |
                        v
              RETRIEVE AD PROFILE
                        |
                        v
          OFFER BANQ MONITORING SERVICE
                        |
                 +------+------+
                 |             |
                YES            NO
                 |             |
                 v             v
          BANQ ASSIGNED     AUTOMATED
          SERVICE RECORD    CAMPAIGN
                 |             |
                 +------+------+
                        |
                        v
                 AD CAMPAIGN LAUNCH
                        |
                        v
                QWK AD INFRASTRUCTURE
                        |
                        +-- QWK Browser surfaces
                        |
                        +-- Approved QWK Publisher
                            Network Packages
                            (QWK Controlled)
                        |
                        +-- BANQ surfaces (only BANQ-opted ads)
                            - newquanthoms.html slideout
                            - newquanthoms.com/index.html
```

---

## 22. Business Positioning

> QWK Browser operates the advertising infrastructure. BANQ provides an
> optional dedicated service layer for advertisers who want their
> campaigns monitored, analysed, or supported beyond the automated
> experience.

BANQ earns when a customer explicitly says: "Yes, I want BANQ to manage
or monitor this advertising relationship."

This gives BANQ room to become a large independent agency while remaining
a reliable commercial partner built around a service QWK's automated
advertising system does not have to provide itself.

---

## 23. Unified Advertising Page Structure

> **ID:** BANQ-AD-PAGE-UNIFY
> **Status:** SPEC -- awaiting implementation
> **Added:** 2026-08-29
> **Source:** Chris (2026-08-29)

### 23.1 Principle

Unify all ad placements and packages into **one advertising page**, not two
separate systems. The customer sees **one BANQ/QWK Browser advertising
marketplace** with packages organized by **format + distribution + campaign
level**.

Remove terms like "Starter," "Premium," and "Sponsored Feed" -- the actual
inventory is broader than a feed. The customer first chooses **what they want
to advertise**, then where they want it distributed.

### 23.2 Two Ways to Buy

**1. Build Your Own Campaign** (individual placements)
- Banner Ad Placement
- Video Ad Placement
- Banner on Publishers Network
- Video on Publishers Network

**2. Choose a Campaign Package** (pre-built bundles)
- Launch Package
- Full Reach Package

### 23.3 Page Layout

#### QWK Browser Advertising
> Reach customers across QWK Browser and the QwkBrowser Publisher Network.
> Choose your advertising format, campaign duration, targeting and
> distribution. Every campaign provides measurable impressions, clicks and
> engagement data.

---

##### 🖼️ Banner Ad Placement
**$ / 7 days**

Display your banner across supported QWK Browser advertising surfaces.

- Image banner creative
- 7-day campaign
- Impression tracking
- Click-through tracking
- Worldwide, country, audience or keyword targeting
- Custom image, logo and call-to-action
- Up to **500 clicks**
- **10 QU per click**
- **24-hour click cooldown**

**[ Launch Banner ]**

---

##### 🎥 Video Ad Placement
**$ / 7 days**

High-impact video advertising across supported QWK Browser surfaces.

- Video creative
- 7-day campaign
- Video impression tracking
- Engagement and click-through tracking
- Worldwide, country, audience or keyword targeting
- Custom video and destination URL
- Campaign performance analytics

**[ Launch Video ]**

---

##### 🌐 Banner on Publishers Network
**$ / 7 days**

Extend your campaign beyond QWK Browser through participating websites and
platforms in the QwkBrowser Publishers Network.

- Banner distribution across participating publishers
- 7-day campaign
- Publisher Network reach
- Impression and click tracking
- Country, audience or keyword targeting
- Custom banner creative and call-to-action
- Publisher-level campaign analytics where available

**[ Launch Network Banner ]**

---

##### 🌐🎥 Video on Publishers Network
**$ / 7 days**

Take your video campaign beyond QWK Browser and reach audiences across
participating Publisher Network locations.

- Video distribution across participating publishers
- 7-day campaign
- Video impression and engagement tracking
- Click-through destination support
- Country, audience or keyword targeting
- Custom promotional videos
- Brand storytelling support
- Network campaign analytics

**[ Launch Network Video ]**

---

### ⭐ Campaign Packages

Packaged options for advertisers who don't want to build a campaign
themselves.

#### Launch Package
**$ / 14 days**

A broader campaign combining selected QWK Browser advertising placements.

- Image or video
- Up to **2,500 clicks**
- Country or keyword targeting
- **25 QU per click**
- 48-hour click cooldown
- Priority placement
- Campaign analytics

**[ Launch Campaign ]**

---

#### Full Reach Package
**$ / 30 days**

A comprehensive campaign designed for brands seeking extended exposure across
QWK Browser and participating Publisher Network locations.

- Image or video
- Up to **6,000 clicks**
- Full targeting options
- **50 QU per click**
- 72-hour click cooldown
- Top placement
- Dedicated BANQ manager
- Campaign analytics and monitoring

**[ Launch Full Campaign ]**

---

### BANQ Campaign Management

> **Want someone to monitor your campaign?**
> Add **BANQ Campaign Monitoring & Analytics** to receive dedicated campaign
> analysis, performance observations, alerts and customer support throughout
> your campaign.

**[ Add BANQ Management ]**

---

### 23.4 Popup vs Full Page

- **newquanthoms.html "View AD Packages" popup**: Shows a **partial preview**
  of the packages above. Even if some packages ask for QAP, the popup shows
  only a summary -- enough for the customer to see what's available.
- **quanthomnetwork.html full page**: Shows the **complete details** of all
  packages, with full descriptions, pricing, targeting options, and launch
  buttons.
- The **publisher application form** at the bottom of quanthomnetwork.html
  stays as-is.

### 23.5 Architecture Fit

This structure fits the BANQ system:

- **QWK Browser** provides the advertising infrastructure and inventory.
- **BANQ** sits on top as the optional intelligence/management layer.
- Individual placements = build-your-own.
- Campaign packages = pre-built bundles (can include BANQ management).
- BANQ Campaign Management = the opt-in monitoring service (see Sections 4-5).

### 23.6 Files Affected

| # | File | Change |
|----|------|--------|
| AU1 | BANQ packages.html | Restructure to unified page: individual placements + campaign packages + BANQ management CTA |
| AU2 | BANQ index.html | Update AD-Packages popup to show partial preview of unified structure |
| AU3 | QWK quanthomnetwork.html | Full unified advertising page with all package details + publisher form (already exists at bottom) |
| AU4 | QWK newquanthoms.html | Update "View AD Packages" popup to show partial preview |

### 23.7 Implementation Notes

- Remove old tier names ("Starter", "Premium", "Sponsored") from all surfaces.
- The popup on newquanthoms.html / BANQ index.html shows a **summary view** --
  enough to understand what's available, not the full spec.
- The full page on quanthomnetwork.html shows **everything** -- all formats,
  all packages, all targeting options, all pricing.
- BANQ opt-in (Sections 4-5) appears at every launch button across both views.
- Publisher application form at bottom of quanthomnetwork.html remains
  unchanged.

### 23.8 PRICING + POPUP DECISIONS (Chris, 2026-09-03) -- RESUME HERE

Status: TASK RECORDED. No HTML changes made yet. Next session resumes
from this subsection + UNIFIED-AD-PAGE-RESTRUCTURE-TASK.md (BANQ-021).

Scope for the qwkbrowser-side work (files inside the qwkbrowser folder):
- quanthomnetwork.html = FULL unified ad page (complete details).
- newquanthoms.html = "View AD Packages" popup = PARTIAL preview only.
- BANQ standalone site (packages.html / index.html popup) is a SEPARATE
  folder (www.newquanthoms.com) -- handled later, not in this scope.

PUBLIC PRICES (placed by Chris -- display these):

| Surface | Price | Key numbers |
|---------|-------|-------------|
| Banner Ad Placement | $50 / 7 days | Up to 500 clicks, 10 QU/click, 24h click cooldown |
| Video Ad Placement | $150 / 7 days | (no click cap listed) |
| Launch Package | $200 | Up to 2,500 clicks, 25 QU/click, 48h cooldown, priority placement |
| Full Reach Package | $450 | Up to 6,000 clicks / 30 days, 50 QU/click, 72h cooldown, top placement, dedicated BANQ manager |

PRICES NOT ANNOUNCED YET (show NO number -- display as "$" only):
- Banner on Publishers Network (bullet: Up to 5,000 clicks)
- Video on Publishers Network ($ / 7 days placeholder)

POPUP BEHAVIOR (newquanthoms.html):
- Users click the AD-Packages link -> popup opens.
- Popup shows only PART of the package details (summary preview), even for
  packages that ask for a QAP number. Never the full bullet list.
- Full details live on quanthomnetwork.html only.
- Some packages ask for QAP inside the popup; the popup still stays partial.

PAGE BEHAVIOR (quanthomnetwork.html):
- Shows the COMPLETE unified marketplace (full descriptions, full pricing
  where announced, targeting options, launch buttons).
- Old tier names ("Starter", "Premium", "Sponsored") removed everywhere.
- Publisher application form at the bottom: keep as-is; may reposition
  only if the layout needs it.

CANONICAL FULL COPY for the page body is in Section 23.3 above (with the
prices from this subsection filled in where announced).

BUTTON BEHAVIOR (Chris, 2026-09-03) -- ALL packages show their Launch
buttons now. No package is hidden. What happens on click:
- Priced packages (Banner $50, Video $150, Launch $200, Full Reach $450):
  clicking Launch shows "SERVICE IS DELAYED FOR TECHNICAL REVIEW".
  Reason: image/video creatives need R2 object storage, which is not
  connected yet. The service is activated but delayed until R2 lands.
- Unpriced packages (Publisher Network banner + video): clicking shows
  "AD PACKAGE WILL BE ANNOUNCE SOON".
- When R2 + Stripe are connected later, the same buttons go live for
  real launch (QAP + launch-with-qap flow).

VIDEO AD BILLING MODEL (Chris, 2026-09-03) -- finalize with YouTube
strategy before wiring video billing:
- Viewer watches over 15 seconds -> charged HALF the click rate.
- Viewer watches over 30 seconds -> charged the FULL click rate.
- 1 click rate = 6 credits (QC).
- Video placement pricing remains $150 / 7 days.

PUBLISHER APPLICATION FORM (decision 2026-09-03):
- The form does NOT exist in the current quanthomnetwork.html file
  (verified 2026-09-03 -- no publisher form anywhere in qwkbrowser).
- Decision: ADD the small intake form at the bottom of quanthomnetwork.html.
  Fields: website name, URL, contact email, traffic estimate, content type
  + submit. Placeholder/local confirmation until a backend endpoint is
  built for publisher applications.

PAGE CHROME (decision 2026-09-03): quanthomnetwork.html currently loads
NO topbar/sidebar (missing js/topbar-chips.js). Decision: add the standard
app chrome (header#topbar + topbar-chips.js) so the ad page matches every
other QwkBrowser page.

### 23.9 FOUR NEW DECISIONS (Chris, 2026-09-03) -- RESUME HERE

Status: PLAN APPROVED. Decisions locked via Q&A. Implementation follows
this subsection + UNIFIED-AD-PAGE-RESTRUCTURE-TASK.md (BANQ-021).

Scope (qwkbrowser side): backend (routes/ads.js, routes/ad-profile.js,
db.js) + quanthomnetwork.html + newquanthoms.html + assets/qwk.js dock.

DECISION V1 -- VIDEO BILLING MODEL (SUPERSEDED AGAIN by Chris on the
same day -- the 10 QU viewer reward below was REVOKED; see V1.1):
- Viewer reward: watch 30+ seconds = 10 QU flat credited to the user.
  Watch under 30 seconds (including 15s) = NO reward, no unit.   [REVOKED]

DECISION V1.1 -- VIDEO = NO AUDIENCE PAYOUT (Chris, 2026-09-03) was
SUPERSEDED the same day by V1.2 below (Chris clarified that QU unit
rewards ARE wanted on the FIRST watch only -- only QC credits are banned).

DECISION V1.2 -- VIDEO WATCH REWARD (Chris, 2026-09-03, FINAL):
- A viewer earns QU (hard units) on their FIRST watch of a particular
  video ad per cooldown -- NEVER QC credits.
- Reward: from 10 QU upward, matching the unit amount indicated on the
  ad (minimum 10 QU), earned only when they watch MORE THAN 30 SECONDS
  of the video. Under 30s = no reward.
- Video ads carry the same per-ad cooldown model as image banner clicks
  (24h default) -- one reward per video ad per cooldown window; repeat
  watches inside the window still unlock the click-through but pay 0.
- Rationale: paying QC credits for watching is bad business; the QU
  first-watch reward (with cooldown) is the sanctioned incentive.
- ADVERTISER-SIDE billing (3 QC / 6 QC live here only):
  * 15s+ watch = HALF click credit = 3 QC consumed from the
    advertiser's package budget.
  * 30s+ watch = FULL click credit = 1 click rate = 6 QC consumed.
  * Sub-15s = no credit. These appear in campaign analytics ONLY
    and are never paid to any user.
- These terms appear EVERYWHERE video is mentioned: quanthomnetwork.html
  Video Ad Placement + Video on Publishers Network cards, the
  newquanthoms.html AD Packages popup rows, dock video cards, docs.
- Video placement pricing stays $150 (click-rate based -- NO day duration, see 23.10).

DECISION V2 -- WHERE VIDEO ADS PLAY (updated for V1.2):
- Build IN-APP VIDEO CARDS (no dwell-timer model). Video ads render as
  playable cards in the same surfaces as banners (Get New Quanthoms dock
  + newquanthoms.html feed). Watching 30s+ unlocks the click-through
  and, on the FIRST watch per cooldown, pays the indicated QU (>=10).
- New backend endpoints: video watch session start + complete
  (server-validated elapsed time; first 30s+ watch = unlock + QU reward
  + full advertiser credit; 15-29s = half advertiser credit recorded in
  analytics; watch rows logged with watched_seconds for billing).

DECISION V3 -- BANQ AD SERVICE ($15/mo) OPT-IN + SURFACE GATING:
- Every package launch flow: after QAP entry + media requirement check,
  show opt-in: "Do you want to add BANQ AD SERVICE?" YES / NO.
- YES = $15 per month, added as a recurring line item on the SAME Stripe
  checkout session as the package (wired during the Stripe integration
  step). QwkBrowser collects it; BANQ is paid out directly (settlement
  recorded in a ledger/subscription row). Campaign flagged banq_service=1
  when active.
- SURFACES: campaigns with banq_service=1 may appear anywhere on the
  app. The "GET NEW QUANTHOMS" floating dock slideout panel AND the
  newquanthoms.html page feed show ONLY banq_service=1 campaigns.
  Non-BANQ campaigns appear on regular QWK feed/homepage surfaces, never
  in that dock or page. Enforcement = /api/ads/eligible filter.
- Placeholder mocks stay (Rules 33/35) until real BANQ-service inventory
  exists.

DECISION V4 -- CREATIVE REQUIREMENT CHECK (QAP + media type):
- Whenever a customer clicks an AD PACKAGE they enter their QAP number
  (QAP-xxxxx, generated on mybmf.html advertising profile section).
- Server-side check maps package format to profile media_type
  (quanthom_ad_profiles.media_type + filename = primary file):
  * Banner AD -> image required (image must detect image)
  * Video AD -> video required (video must detect video)
  * Audio-based packages -> audio required (audio must detect audio)
  * Launch / Full Reach -> image OR video accepted
- If the profile's primary media does not match, the flow returns the
  clear message: "Ad requirement not complete -- [format] AD requires
  a [format] (selected as primary file) in your advertising profile.
  Yours is [url/image/audio/video]."
- Pre-R2 reality: media upload is locked, so profiles are url-only and
  image/video launches correctly fail this check -- exact message path
  is testable now.

BUILD ORDER (approved):
1. Record docs (this subsection + change log).
2. Backend schema: ad_banners media_type + banq_service columns,
   banq_service_subscriptions table.
3. Backend: launch-with-qap rewrite (new tiers banner/video/launch/
   full_reach, media requirement check, BANQ opt-in quote, hold
   campaign creation until payment is wired).
4. Backend: /api/ads/eligible filters banq_service=1 only.
5. Backend: video watch session start/complete -- first 30s+ watch per
   cooldown = click-through unlock + QU reward (from 10, as indicated)
   + full advertiser credit (6 QC); 15-29s = half credit (3 QC)
   recorded in analytics; never QC to the viewer.
6. Frontend: shared QAP launch flow on quanthomnetwork.html +
   newquanthoms.html (QAP entry -> profile summary -> media check ->
   BANQ opt-in -> order preview -> existing technical-review notice
   until Stripe/R2).
7. Frontend: video billing copy on all video mentions + in-app video
   player cards in dock + newquanthoms feed.
8. Verify on live server; report hard-refresh.

### 23.10 NO DAY-BASED DURATIONS ON AD PACKAGES (Chris, 2026-09-03) -- RESUME HERE

Status: IMPLEMENTED (backend + both pages + shared launch flow).

RULE: All ad packages are fulfillment/click driven, NOT time driven.
Remove every "7 days / 30 days / up to 30 days" campaign duration from
all ad packages and from the launch flow. Advertisers buy a click
budget, not a time window.

- BANNER (and image ads) = calculated by CLICKS.
  * $50 Banner = up to 500 clicks.
  * Express ADS $200 = up to 2,500 clicks.
  * Full Reach $450 = up to 6,000 clicks (no "or 30 days" wording).
- VIDEO / AUDIO = calculated by 15s / 30s CLICK RATE with a
  skip/swipe control:
  * 15s+ watch = half click (3 QC from package budget).
  * 30s+ watch = full click (6 QC from package budget).
  * Viewer side unchanged (V1.2): first 30s+ watch per cooldown earns
    QU from 10 as indicated; watching never pays QC.
- Where applied:
  * backend/routes/ads.js PACKAGE_TIERS: removed all duration_days
    (banner/video were 7d, launch 14d, full_reach 30d); notes updated
    to click/click-rate wording; quote no longer returns duration_days.
  * quanthomnetwork.html: removed "7-day campaign" / "30-day campaign"
    bullets, "$150 / 7 days" price note, and "campaign duration" from
    the hero. Added click-based / 15s-30s click-rate bullets on each
    placement card.
  * newquanthoms.html popup: "$150 / 7 days" -> "$150".
  * js/qap-launch.js: duration fields replaced with scope ("Up to 500
    clicks", "15s / 30s click rate", "Up to 2,500 clicks", "Up to
    6,000 clicks"); quote row relabelled Duration -> Scope.
- Cooldowns stay (24h/48h/72h click cooldowns are anti-abuse, not
  campaign durations) and remain on every package.

### 23.11 BANQ AD SERVICE = $15/MONTH ALL-ADS SUBSCRIPTION (Chris, 2026-09-03) -- RESUME HERE

Status: IMPLEMENTED (backend + launch flow + quanthomnetwork.html CTA).
Supersedes the per-ad reading of V3 (one subscription row per launch).

MODEL:
- BANQ AD SERVICE is $15 per MONTH for ALL ads a user runs in that month.
  ONE subscription, not per-ad. All monitoring + analytics show up in the
  user's newquanthoms.com dashboard.
- Same user activates another ad within the same month -> NO second monthly
  BANQ charge (the month is already paid).
- When the month runs out, the user pays another month to keep getting
  further analytics.
- Additional BANQ plans, tools and services exist and will grow, but those
  EXTRA plans/services are purchased via newquanthoms.com (not the app
  checkout).

IMPLEMENTATION (qwkbrowser side):
- backend/routes/ads.js launch-with-qap: checks for an active/paid BANQ
  subscription covering the current period for the user
  (status IN active/paid AND period_start <= now AND period_end >= now).
  * Covered -> quote banq_covered=true, banq_price_usd=0, total unchanged.
  * Not covered -> creates ONE pending row (user_id, qap_number,
    amount_usd=15, status='pending', period_start=now, period_end=now+30d).
  * banq_service_subscriptions is keyed by user_id (banner_id stays NULL
    for user-wide subscriptions).
- frontend/js/qap-launch.js: opt-in copy states the all-ads-month rule + the
  newquanthoms.com dashboard + no-extra-charge-if-covered; quote shows
  "Covered -- active this month ($0)" vs "$15/mo -- all ads this month";
  success note adapts to covered state.
- quanthomnetwork.html Section 3 CTA: NO announce-soon. BANQ AD SERVICE is
  ACTIVE and visible after QAP verification (YES/NO opt-in in the launch
  flow). Button scrolls to the placements and explains it is chosen with any
  package after QAP verification. Note added: extra BANQ plans/tools/services
  are purchased via newquanthoms.com.
- TIMING (Chris): the moment TECHNICAL REVIEW is removed, the AD PACKAGE and
  BANQ SERVICE activate AT THE SAME TIME (single checkout, pending row flips
  to active on payment). Never staggered.

---

## 24. Change Log

| Date | Change |
|------|--------|
| 2026-08-29 | Doc created from pre-spec provided by Chris + review agent. Full file change inventory and implementation order defined. Opt-in must appear on every ad launch surface including quanthomnetwork.html. |
| 2026-08-29 | Added Section 23: Unified Advertising Page Structure (BANQ-AD-PAGE-UNIFY). One marketplace, two ways to buy: build-your-own placements + pre-built campaign packages. Popup shows summary, quanthomnetwork.html shows full details. |
| 2026-09-03 | Chris set prices ($50 banner, $150 video, $200 Launch, $450 Full Reach) and held Publisher Network prices unannounced. Added Section 23.8: popup = partial preview only (QAP asked for some packages), full details only on quanthomnetwork.html, publisher form stays. Task recorded for resume. |
| 2026-09-03 | Button behavior set: priced packages show "SERVICE IS DELAYED FOR TECHNICAL REVIEW" until R2/Stripe are connected; unpriced network packages show "AD PACKAGE WILL BE ANNOUNCE SOON". Video billing model sketched (15s=half click rate, 30s=full, 1 click rate = 6 QC) -- finalize with YouTube strategy. Publisher form + app chrome additions approved. |
| 2026-09-03 | Section 23.9 added: FOUR new decisions locked (Q&A). V1: video reward corrected -- 30s+ watch = 10 QU flat to viewer, <30s = nothing; 3 QC/6 QC are advertiser-side budget credits only (replaces old 15s/30s note). V2: in-app video player cards with server-validated watch sessions. V3: BANQ AD SERVICE opt-in YES/NO at $15/mo on same Stripe checkout; banq_service=1 campaigns only in Get New Quanthoms dock + newquanthoms.html feed. V4: QAP entry on every package click with server-side media-type requirement check (image/image, video/video, audio/audio, launch accepts image or video). Approved build order recorded. |
| 2026-09-03 | V1 REVOKED by Chris (same day): audience earns NOTHING for watching video ads -- bad business; enough credits already flow via factory raffles + amplification. V1.1: 30s+ watch only unlocks the click-through. 3 QC (15s+ half click) / 6 QC (30s+ full click) are advertiser-side package budget credits for analytics only, never user payout. All db.js / routes / frontend video work uses V1.1. |
| 2026-09-03 | V1.2 FINAL (Chris clarification): viewers DO earn QU (hard units, never QC) on the FIRST watch of a video ad per cooldown -- from 10 QU upward as indicated on the ad, when watching more than 30 seconds. Same per-ad cooldown model as image clicks (24h). Repeat watches inside the cooldown unlock click-through but pay 0. V1.1 is superseded; code + copy use V1.2. |
| 2026-09-03 | Section 23.10: ALL day-based durations removed from ad packages (IMPLEMENTED). Banner = click-based (500/2,500/6,000 clicks); video/audio = 15s/30s click rate (15s+ half click 3 QC, 30s+ full click 6 QC) with skip/swipe control; no "7 days" / "30 days" anywhere in packages or launch flow. Applied in ads.js PACKAGE_TIERS (duration_days removed, quote field dropped), quanthomnetwork.html cards + hero, newquanthoms.html popup, qap-launch.js scope fields (Duration row -> Scope). Cooldowns (24h/48h/72h) kept as anti-abuse, not durations. |
| 2026-09-03 | Section 23.11 (IMPLEMENTED): BANQ AD SERVICE redefined as $15/month ALL-ADS subscription per user (supersedes per-ad V3 reading). One subscription covers every ad the user runs that month; no second charge for more ads in the same month; pay again when the month ends to keep analytics. All monitoring/analytics appear on the user's newquanthoms.com dashboard. Extra BANQ plans/tools/services are purchased via newquanthoms.com only. Backend launch-with-qap now checks for an active BANQ month (banq_covered) and only creates a pending row when uncovered; quote + frontend copy updated; quanthomnetwork.html BANQ CTA is ACTIVE (no announce-soon) and reachable after QAP verification; ad package + BANQ service go live together the moment technical review is removed. |
| 2026-09-03 | docs/AD-SLOT-STUDY.md created: catalog of every ad slot across factory/homepage/dock/search/commerce/gamified/content pages mapped to YouTube/Instagram/Twitter/Facebook precedents, with the phased post-review implementation plan. Slot coordinates for individual pages are provisional and will be refined later. |
| 2026-09-03 | AD-SLOT implementation plan REFINED + documented (doc-only; Chris approved documentation, build starts next session). All ad-slot code will be feature-flag gated (flags.ads_new_panel=false default) so users see nothing until technical review is removed; no fake ads live (Rules 33/35). Build order recorded in docs/AD-SLOT-STUDY.md: shared js/ad-slots.js + flag → factory feed every-6th-post + sidebar → homepage feed/sidebar → backend /api/ads/slots + rewarded/complete → search/retail/elist/raffle. Step 4 (Stripe checkout per package → campaign active → slots serve) locked until technical review + R2/Stripe ready. INTEGRATION-SETUP-ROADMAP.md launch table updated: Stripe = AWAITING KEY (code 100% ready incl. all 5 ad products in the 14-product seed script). |
| 2026-09-03 | Section 23.12: Advertising products added to the Stripe catalog spec. Stripe currently has ZERO ad linkage (ads.js launch-with-qap deliberately holds: "Payment checkout opens once Stripe is connected (technical review)"). The 9-product roadmap list was currency/subscriptions only and MISSED advertising. Now 14 products total: 9 original + Banner Ad Placement $50 (one-time), Video Ad Placement $150 (one-time), Express ADS $200 (one-time), Full Reach Package $450 (one-time), BANQ AD SERVICE $15/mo (recurring). backend/scripts/seed-stripe-products.js extended to create all 14 idempotently; prices mirror PACKAGE_TIERS in routes/ads.js (keep in sync). docs/INTEGRATION-SETUP-ROADMAP.md §3.3A + §3.6 updated (premium price env vars). On technical-review removal: launch-with-qap opens a real Stripe checkout (package + optional BANQ month in one payment); webhook activates the campaign + BANQ month together. |

---

## END OF BANQ AD MONITORING PARTNERSHIP DOC
