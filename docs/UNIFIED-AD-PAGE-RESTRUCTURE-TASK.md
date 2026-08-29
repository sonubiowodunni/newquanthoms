# Unified Advertising Page -- Restructure Task

> **ID:** BANQ-021
> **Status:** READY TO START -- no implementation done yet
> **Created:** 2026-08-29
> **Spec:** `docs/BANQ-AD-MONITORING-PARTNERSHIP.md` Section 23
> **Pipeline:** `docs/BANQ-MASTER-PIPELINE.md` (BANQ-021)
> **Dependencies:** BANQ-001 (done), BANQ-004 (done)

---

## What This Is

Restructure the advertising pages into **one unified marketplace** with two ways
to buy, replacing the current split between old tier names and placement
descriptions.

The customer sees **one BANQ/QWK Browser advertising marketplace**, organized
by **format + distribution + campaign level**. Old tier names ("Starter",
"Premium", "Sponsored") are removed.

---

## Two Ways to Buy

**1. Build Your Own Campaign** (individual placements)
- Banner Ad Placement ($ / 7 days)
- Video Ad Placement ($ / 7 days)
- Banner on Publishers Network ($ / 7 days)
- Video on Publishers Network ($ / 7 days)

**2. Choose a Campaign Package** (pre-built bundles)
- Launch Package ($ / 14 days)
- Full Reach Package ($ / 30 days)

**Bottom:** BANQ Campaign Management opt-in CTA.

---

## Files to Change

### 1. `packages.html` (BANQ standalone site)

**Current state:**
- 3 cards in a 3-column grid: Starter Banner ($50/7d), Premium Banner ($200/14d),
  Sponsored Feed ($500/30d)
- QAP entry section below the cards
- Old tier names: "Starter", "Premium", "Sponsored"
- Title: "New Quanthoms AD-Packages"

**Target state:**
- Hero: "QWK Browser Advertising" with subtext about reaching customers across
  QWK Browser and the Publisher Network
- Section 1: Individual Placements (4 cards)
  - 🖼️ Banner Ad Placement ($ / 7 days)
  - 🎥 Video Ad Placement ($ / 7 days)
  - 🌐 Banner on Publishers Network ($ / 7 days)
  - 🌐🎥 Video on Publishers Network ($ / 7 days)
- Section 2: ⭐ Campaign Packages (2 cards)
  - Launch Package ($ / 14 days) -- 2,500 clicks, 25 QU/click, 48h cooldown
  - Full Reach Package ($ / 30 days) -- 6,000 clicks, 50 QU/click, 72h cooldown, dedicated BANQ manager
- Section 3: BANQ Campaign Management CTA at bottom
  - "Want someone to monitor your campaign?" + [ Add BANQ Management ] button
- QAP entry section stays (move below the packages or integrate into each launch button)
- Each package card gets a launch button: [ Launch Banner ], [ Launch Video ], etc.
- Title: "AD Packages -- BANQ"

**Key changes:**
- Remove "Starter", "Premium", "Sponsored" names entirely
- Add 4 individual placement cards (Banner, Video, Network Banner, Network Video)
- Add 2 campaign package cards (Launch, Full Reach)
- Add BANQ Campaign Management CTA section
- Update hero title and subtitle
- Update `<title>` tag

### 2. `quanthomnetwork.html` (QWK Browser site)

**Location:** `C:\Users\lenovo\Documents\qwkbrowser\frontend\quanthomnetwork.html`

**Current state:**
- Hero: "Quanthom Network" with QWK Browser Direct Ad Service badge
- 3 stat cards (placeholder: 12K+ users, 45K+ impressions, 3.2% CTR)
- Exclusion notice about BANQ-reserved surfaces
- 4 ad package cards (Banner, Video, Network Banner, Network Video) -- already
  has the individual placements but NO campaign packages, NO launch buttons,
  NO BANQ management CTA
- CTA section: "Ready to Start Advertising?" with link to newquanthoms.html
- **No publisher application form exists yet** -- the user mentioned there is
  one but it is NOT in the current file. This needs to be added.

**Target state:**
- Hero: "QWK Browser Advertising" (unified title, not "Quanthom Network")
- Stats section stays (placeholder per Rules 33/35)
- Exclusion notice: reword per BANQ-AD-MONITORING Section 19.1 item T7
  (surfaces show BANQ-monitored campaigns, not "exclusively reserved for BANQ")
- Section 1: Individual Placements (4 cards) -- already exists, ADD launch buttons
  - [ Launch Banner ], [ Launch Video ], [ Launch Network Banner ], [ Launch Network Video ]
- Section 2: ⭐ Campaign Packages (2 cards) -- NEW
  - Launch Package ($ / 14 days) with full feature list
  - Full Reach Package ($ / 30 days) with full feature list
  - [ Launch Campaign ], [ Launch Full Campaign ] buttons
- Section 3: BANQ Campaign Management CTA -- NEW
  - "Want someone to monitor your campaign?" + [ Add BANQ Management ] button
- Publisher Application Form at the bottom -- NEW (small form, as user described)
  - Fields: website name, URL, contact email, traffic estimate, content type
  - Submit button
  - This is a simple intake form for publishers wanting to join the network
- CTA section stays but update link/text if needed

**Key changes:**
- Add launch buttons to existing 4 placement cards
- Add 2 campaign package cards (Launch, Full Reach)
- Add BANQ Campaign Management CTA
- Add publisher application form at bottom
- Reword exclusion notice
- Update hero title to "QWK Browser Advertising"

### 3. Popup on `newquanthoms.html` (QWK Browser) and `index.html` (BANQ)

**Current state:**
- "View AD Packages" popup shows old 3-tier packages
- Title: "New Quanthoms AD-Packages"

**Target state:**
- Popup shows a **partial preview** of the unified structure
- Summary of the 6 packages (4 placements + 2 campaign packages)
- Not full details -- just enough to see what's available
- "See full details on Quanthom Network" link to quanthomnetwork.html
- Title: "AD Packages"
- Some packages show QAP entry in the popup; full details on quanthomnetwork.html

**Key changes:**
- Replace old 3-tier cards with summary of unified packages
- Add "See full details" link to quanthomnetwork.html
- Update modal title to "AD Packages"

---

## Package Specs (from Section 23)

### Individual Placements

| Package | Duration | Click Cap | QU/click | Cooldown | Targeting |
|---------|----------|-----------|----------|----------|-----------|
| Banner Ad Placement | 7 days | 500 | 10 QU | 24h | Worldwide, country, audience, keyword |
| Video Ad Placement | 7 days | -- | -- | -- | Worldwide, country, audience, keyword |
| Banner on Publishers Network | 7 days | -- | -- | -- | Country, audience, keyword |
| Video on Publishers Network | 7 days | -- | -- | -- | Country, audience, keyword |

### Campaign Packages

| Package | Duration | Click Cap | QU/click | Cooldown | Targeting | Extra |
|---------|----------|-----------|----------|----------|-----------|-------|
| Launch Package | 14 days | 2,500 | 25 QU | 48h | Country or keyword | Priority placement |
| Full Reach Package | 30 days | 6,000 | 50 QU | 72h | Full targeting | Top placement + dedicated BANQ manager |

### BANQ Campaign Management

- Dedicated campaign monitoring
- Campaign activity analysis
- Additional reporting or summaries
- Human/customer relationship support
- Campaign observations and recommendations
- Fee visible before confirmation
- Opt-in only (see BANQ-AD-MONITORING Sections 4-5)

---

## Implementation Order

1. **packages.html** -- restructure to unified page (4 placements + 2 packages + BANQ CTA)
2. **quanthomnetwork.html** -- add launch buttons, campaign packages, BANQ CTA, publisher form
3. **newquanthoms.html popup** (QWK) -- update to partial preview of unified structure
4. **index.html popup** (BANQ) -- update to partial preview of unified structure
5. Remove all old tier names from every surface
6. Commit checkpoint

---

## What Exists vs What Needs Building

| Item | packages.html | quanthomnetwork.html | Popups |
|------|---------------|----------------------|--------|
| 4 individual placements | MISSING | EXISTS (no buttons) | MISSING |
| 2 campaign packages | MISSING | MISSING | MISSING |
| BANQ Management CTA | MISSING | MISSING | MISSING |
| Launch buttons | MISSING | MISSING | MISSING |
| Publisher form | N/A | MISSING (needs adding) | N/A |
| Old tier names | EXISTS (remove) | N/A | EXISTS (remove) |
| QAP entry | EXISTS (keep) | MISSING (add) | EXISTS (keep) |

---

## When We Come Back

**Start here:**
1. Open `packages.html` -- restructure from 3 old tiers to 6 unified packages + BANQ CTA
2. Open `quanthomnetwork.html` (in qwkbrowser/frontend/) -- add launch buttons, campaign packages, BANQ CTA, publisher form
3. Update both popups to show partial preview
4. Remove old tier names everywhere
5. Commit

**Spec reference:** `docs/BANQ-AD-MONITORING-PARTNERSHIP.md` Section 23
**Pipeline reference:** `docs/BANQ-MASTER-PIPELINE.md` BANQ-021

---

## Change Log

| Date | Change |
|------|--------|
| 2026-08-29 | Task doc created. Next step: restructure packages.html and quanthomnetwork.html per Section 23 spec. |

---

## END OF UNIFIED AD PAGE RESTRUCTURE TASK DOC
