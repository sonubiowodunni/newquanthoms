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

---

## 24. Change Log

| Date | Change |
|------|--------|
| 2026-08-29 | Doc created from pre-spec provided by Chris + review agent. Full file change inventory and implementation order defined. Opt-in must appear on every ad launch surface including quanthomnetwork.html. |
| 2026-08-29 | Added Section 23: Unified Advertising Page Structure (BANQ-AD-PAGE-UNIFY). One marketplace, two ways to buy: build-your-own placements + pre-built campaign packages. Popup shows summary, quanthomnetwork.html shows full details. |

---

## END OF BANQ AD MONITORING PARTNERSHIP DOC
