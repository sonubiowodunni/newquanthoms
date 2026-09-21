# BANQ-021 -- UNIFIED ADVERTISING PAGE: IMPLEMENTATION DESIGN

> **ID:** BANQ-021
> **Status:** DESIGN COMPLETE -- Section 12 answered 2026-09-21, ready to build
> **Created:** 2026-09-21
> **Folder:** www.newquanthoms.com (BANQ standalone)
> **Authority:** `docs/BANQ-AD-MONITORING-PARTNERSHIP.md` Section 23 (23.3 canonical copy, 23.8-23.11 frozen decisions)
> **Supersedes the stale parts of:** `docs/UNIFIED-AD-PAGE-RESTRUCTURE-TASK.md` (written 2026-08-29, BEFORE the 2026-09-03 decisions)
> **Pipeline row:** `docs/BANQ-MASTER-PIPELINE.md` BANQ-021

---

## 0. SCOPE -- WHICH HALF IS THIS

Section 23 names four files across two repositories. This design covers ONLY the
two that live in this folder, because a design that spans both repos cannot be
verified in one pass:

| File | Repo | In this design? |
|---|---|---|
| `packages.html` | www.newquanthoms.com | YES |
| `index.html` AD-Packages popup | www.newquanthoms.com | YES |
| `quanthomnetwork.html` | qwkbrowser | NO -- separate folder, separate design |
| `newquanthoms.html` popup | qwkbrowser | NO -- qwkbrowser side |

Section 23.8 states it directly: "BANQ standalone site (packages.html /
index.html popup) is a SEPARATE folder (www.newquanthoms.com) -- handled later,
not in this scope." This document is that later.

---

## 1. WHY THE OLD TASK DOC CANNOT BE FOLLOWED AS WRITTEN

`UNIFIED-AD-PAGE-RESTRUCTURE-TASK.md` is the resume point the last session left,
but it was written 2026-08-29 and the founder froze nine decisions on
2026-09-03 that contradict it. Following the old doc would ship copy the founder
has already rejected. The conflicts, so nobody re-introduces them:

| Old task doc says | Frozen decision says | Source |
|---|---|---|
| "Banner Ad Placement ($ / 7 days)" | $50, click-based, NO day duration | 23.8, 23.10 |
| "Video Ad Placement ($ / 7 days)" | $150, no day duration | 23.8, 23.10 |
| "Launch Package ($ / 14 days)" | $200, up to 2,500 clicks, no days | 23.8, 23.10 |
| "Full Reach Package ($ / 30 days)" | $450, up to 6,000 clicks, no days | 23.8, 23.10 |
| Keep the QAP entry section | QAP is asked at LAUNCH, per package, with a media check | 23.9 V4 |
| Launch buttons unspecified | Priced -> "SERVICE IS DELAYED FOR TECHNICAL REVIEW"; unpriced -> "AD PACKAGE WILL BE ANNOUNCE SOON" | 23.8 |
| BANQ management CTA only | BANQ AD SERVICE is $15/MONTH ALL ADS, not per ad | 23.11 |

The one-line summary the design must obey: **advertisers buy a click budget,
never a time window; every price and every string is already decided; nothing
invents a number.**

---

## 2. THE RULE THAT PREVENTS THIS DRIFT RECURRING

The present site already disagrees with itself: `packages.html` sells
"Starter / Premium / Sponsored" at $50 / $200 / $500 while the QWK side sells
"Banner / Express ADS / Full Reach" at $50 / $200 / $450. Two hand-written card
sets drifted apart the moment one changed.

**Design decision:** the copy lives in exactly ONE file and both surfaces render
from it. New file `js/ad-catalog.js` holds the whole marketplace as data; the
packages page and the popup are both render functions over it. Changing a price
becomes a one-line edit in one place, and a surface that has not been updated
cannot exist, because no surface holds its own strings.

This mirrors, and must stay in sync with, `PACKAGE_TIERS` in
`qwkbrowser/backend/routes/ads.js` -- that file is the billing truth and this
catalog is its display truth. Section 2.3 names the exact join key.

---

## 3. THE CATALOG -- CANONICAL CONTENT

### 3.1 Schema of one entry

```
{
  key:            string   // MUST equal the PACKAGE_TIERS key used by billing
  label:          string   // the customer-facing name
  group:          'placement' | 'package'
  format:         'image' | 'video' | 'audio' | 'image_or_video'
  price_usd:      number | null    // null = not announced yet
  price_display:  string   // '$50' or '$' -- never '$50 / 7 days'
  scope:          string   // the click/click-rate budget line
  unit_reward:    number | null    // QU per qualifying view/click, as indicated
  cooldown_hours: number | null    // anti-abuse, NOT a campaign duration
  bullets:        [string]         // full detail, packages.html only
  popup_bullets:  [string]         // SHORT summary, popup only (max 2)
  button_label:   string   // 'Launch Banner' etc.
  state:          'delayed' | 'announced_soon'
  targeting:      string
}
```

### 3.2 The six entries (frozen)

| key | label | group | price | scope | QU | cooldown | state |
|---|---|---|---|---|---|---|---|
| `banner` | Banner Ad Placement | placement | $50 | up to 500 clicks | 10 | 24h | delayed |
| `video` | Video Ad Placement | placement | $150 | 15s / 30s click rate | 10 first watch | 24h | delayed |
| `network_banner` | Banner on Publishers Network | placement | NOT ANNOUNCED (`$`) | up to 5,000 clicks | -- | -- | announced_soon |
| `network_video` | Video on Publishers Network | placement | NOT ANNOUNCED (`$`) | -- | -- | -- | announced_soon |
| `launch` | Express ADS OR "Launch Package" (SEE 12/Q1) | package | $200 | up to 2,500 clicks | 25 | 48h | delayed |
| `full_reach` | Full Reach Package | package | $450 | up to 6,000 clicks | 50 | 72h | delayed |

Price display rules, from 23.8:

- Announced -> `$50`, `$150`, `$200`, `$450`. Never with a period suffix.
- Not announced -> the string `$` alone and no number anywhere in the card.
- Network banner carries the bullet "Up to 5,000 clicks" (23.8) but no price.

### 3.3 The join key

`catalog.key` MUST equal the `package_key` that
`qwkbrowser/backend/routes/ads.js` accepts in
`POST /api/ads/launch-with-qap`. Today that endpoint accepts exactly
`banner, video, launch, full_reach`. The two network entries are display-only
until a billing key exists for them, which is why they are the two
`announced_soon` entries -- the catalog states the truth instead of a button
that would fail server-side.

---

## 4. SURFACE 1 -- packages.html

**Target title:** `AD Packages -- BANQ` (replaces "New Quanthoms AD-Packages").

**Layout, top to bottom:**

1. **Hero** -- "QWK Browser Advertising" with the Section 23.3 subtext: reach
   customers across QWK Browser and the QwkBrowser Publisher Network; choose
   format, targeting and distribution; every campaign provides measurable
   impressions, clicks and engagement data.
2. **Section: individual placements** -- the four `group: 'placement'` cards.
   The two network cards render with `$` and the `announced_soon` button state;
   they are visually present but honestly unpriced, exactly as 23.8 requires.
3. **Section: campaign packages** -- the two `group: 'package'` cards, Full
   Reach marked featured. The FULL `bullets` list renders here; this is the
   surface that is allowed to show everything.
4. **BANQ Campaign Management** -- "Want someone to monitor your campaign?" plus
   the all-ads rule stated plainly: **BANQ AD SERVICE is $15 per month for ALL
   ads a user runs that month** (23.11), one subscription not one per ad,
   monitoring and analytics appearing on the user's newquanthoms.com dashboard,
   and extra BANQ plans/tools/services bought through newquanthoms.com. Payable
   in **credits or fiat** (founder, 2026-09-21). Button
   `[ Add BANQ Management ]`.

   The page must never read as though BANQ is charging for the ads themselves.
   See Section 4.1.
5. **QAP section** -- keeps its place at the bottom, reworded so it no longer
   implies you pick a package first: a QAP number identifies your advertising
   profile, and the launch flow asks for it when you choose a package.

### 4.1 BANQ'S ECONOMIC ROLE -- THE PAGE MUST NOT CONFUSE IT

Founder clarification, 2026-09-21: "no matter how much the advertiser is charged
on qwkbrowser... in order for the advertiser to have access to BANQ MONITORING
tools, they have to pay $15 per month in credits or fiat... they can do as many
adverts as they want but the premium monitoring fee is $15."

That is a two-layer model and the page has to say so plainly:

| Layer | What it is | Who charges |
|---|---|---|
| Ad spend | The ad package itself (Banner, Video, Express ADS, Full Reach, network) | QWK Browser -- the prices on the cards are QWK's |
| Monitoring | BANQ AD SERVICE, $15/month, unlimited adverts, credits or fiat | BANQ -- this is the only thing BANQ charges |

Consequences for the build:

1. The package cards state a price because the advertiser needs to see the
   marketplace, but the page must not imply BANQ collects it. One line above the
   sections: ad packages are QWK Browser advertising; BANQ adds monitoring.
2. `$15/mo` is the page's only own price, so it is the only price rendered as a
   BANQ price.
3. One subscription covers every advert that month (23.11). A second advert in
   the same month adds nothing.
4. Opting in on the QWK side is fine and expected -- the dashboard must show a
   BANQ month that was activated there identically to one activated here.
5. Because it is credits OR fiat, the subscription record needs a
   payment-method field; the page's CTA copy says "credits or fiat" rather than
   naming a card.
6. BANQ is also the upsell surface: additional BANQ plans, tools and services
   are sold through this site (23.11), so `[ Add BANQ Management ]` is the first
   rung, not the whole ladder.

### 4.2 THE SUBSCRIPTION -- WHAT IT IS, WHERE IT LIVES, WHAT IT GATES

Rules, from the founder's clarification:

- **$15 per month, per advertiser.** Credits OR fiat.
- **Unlimited adverts inside the month.** More adverts do not cost more BANQ
  money. Paying again at month end keeps the monitoring running.
- **It gates the MONITORING TOOLS, not the advertising.** An advertiser can run
  adverts on QWK Browser without BANQ at all. The $15 is what opens BANQ's
  monitoring, analysis and support.
- **Opting in on QWK Browser counts.** "If they opt for it on qwkbrowser, then
  good" -- one month purchased on the QWK side must light up the same tools here.
- **Only the $15 is BANQ's own price.** Everything else on the page is QWK
  Browser's inventory.

**Design consequences:**

| # | Consequence |
|---|---|
| S1 | A subscription is keyed by ADVERTISER (one row per account per period), never per advert. Two adverts in one month = one row. |
| S2 | It carries a `payment_method` of `credits` or `fiat`, because both are sanctioned and the record must be able to say which. |
| S3 | The credits path needs the BANQ account linked to a QWK account -- the QAP link is the natural join, since that is already the identity bridge between the two apps. A BANQ account with no linked QAP cannot pay in credits and must be offered fiat. |
| S4 | An active period is `payment_method` agnostic: the dashboard checks `status IN (active, paid) AND period_start <= now AND period_end >= now` exactly as the QWK side does (23.11), so a month bought in either app reads the same here. |
| S5 | Monitoring tools render LOCKED, with the $15 CTA, when no period is active. Never hidden, never faked -- the advertiser sees what they are not yet paying for. |
| S6 | The CTA is the first rung of an upsell ladder. Extra BANQ plans, tools and services are sold through newquanthoms.com only (23.11), so the locked state is the natural place to surface them once they exist. |

**What this design does NOT build:** the payment rail itself. Credits spending and
fiat collection both wait on the Stripe/R2 step, so this build ships the
subscription's SHAPE -- the record, the gate, the copy, the locked state -- and
leaves the charge where 23.8 already put it: delayed for technical review,
stated to the customer rather than hidden.

**Card anatomy** (identical for all six, no bespoke markup per card):

- label, price display, scope line
- the full `bullets` list
- one launch button whose label comes from `button_label`

**Button behaviour** -- there are exactly three states and no fourth:

| state | click result |
|---|---|
| `delayed` (all priced packages) | a notice: **SERVICE IS DELAYED FOR TECHNICAL REVIEW** -- the campaign is real and the price is real; activation waits on R2 object storage plus Stripe checkout. Reason stated to the customer, not hidden. |
| `announced_soon` (network placements) | **AD PACKAGE WILL BE ANNOUNCE SOON** |
| live (nothing yet) | reserved for the Stripe/R2 build; not reachable from this design |

Both notices are honest placeholders, which is what Rules 33/35 require: no fake
ads, no fake checkout, and no button that silently does nothing.

---

## 5. SURFACE 2 -- index.html popup (partial preview)

The popup is a PREVIEW, not a shop. Section 23.8: "Popup shows only PART of the
package details (summary preview), even for packages that ask for a QAP number.
Never the full bullet list."

- Title changes to **AD Packages**.
- Renders the same six entries, each as one summary row: label, price display,
  scope, and `popup_bullets` capped at two. The full list is deliberately not
  reachable here.
- One link: **See full details on Quanthom Network** -> `quanthomnetwork.html`.
- The two network rows keep `$` and the announce-soon state; a preview that
  invents a price for an unannounced package is the exact failure this section
  prevents.

The popup and the page share `js/ad-catalog.js` and differ only in which bullet
array they read. That is the whole mechanism that keeps a preview and a page
from disagreeing.

---

## 6. SURFACE 3 -- navigation and dashboard

- The header link text "Packages" stays (it is what users already click); the
  page it opens becomes the unified marketplace. Renaming the nav item is an
  optional follow-up, not a requirement.
- `packages.html`'s fast-path buttons currently redirect to
  `dashboard.html?qap=...&pkg=starter|premium|sponsored`. Those three keys are
  DEAD after this change. The redirect must carry a catalog key (`banner`,
  `video`, `launch`, `full_reach`) or `dashboard.html` will receive a package
  name that no billing endpoint accepts.
- `dashboard.html` reads `pkg` from the URL. It must be checked against
  `js/ad-catalog.js` and render the label from the catalog rather than printing
  the raw key, so a deep link cannot display "starter" again.

---

## 7. THE LAUNCH FLOW (shared shape, honest end state)

Per 23.9 V4 and the build order, every package launch follows the same six
steps. This design specifies the shape so the BANQ side can be built now even
while Stripe and R2 are not connected:

1. **QAP entry** -- `QAP-[A-Z0-9]{6,}`, validated client-side and again
   server-side. A QAP is generated on QwkBrowser `mybmf.html`.
2. **Profile fetch** -- BANQ calls its proxy, which forwards to QWK
   `GET /api/ad-profile/<QAP>`. Confirmed present and public on the QWK side;
   note the real path has no `/qap/` segment.
3. **Media requirement check** -- the package's `format` must match the
   profile's `media_type`: banner needs image, video needs video, audio packages
   need audio, and the two campaign packages accept image or video. On mismatch
   the exact message is the 23.9 V4 text naming what was required and what the
   profile actually carries.
4. **BANQ AD SERVICE opt-in** -- YES / NO, $15/month all-ads, with the
   covered-this-month case reading `Covered -- active this month ($0)`.
5. **Order preview** -- package, price, scope, BANQ line, total. No payment
   sheet exists yet.
6. **Technical review notice** -- the flow ends at the same
   SERVICE IS DELAYED FOR TECHNICAL REVIEW state as the button. It does not
   pretend to charge, and it does not create a campaign that cannot run.

Because media upload is locked pre-R2, step 3 is not a formality: an
url-only profile that tries a banner launch must fail the check with the exact
message, and that path is testable today.

---

## 8. BACKEND NEEDED IN THIS FOLDER

`server.js` already proxies `/api/ads/*` and `/api/profile/*` to QWK:3001.
Two additions, both thin:

1. **QAP read-through** -- `GET /api/ad-profile/:qap` -> QWK
   `http://localhost:3001/api/ad-profile/:qap`. Public on both sides, no auth.
   Without it the popup and the launch flow can only validate the QAP's shape,
   not the QAP itself.
2. **Launch hand-off** -- `POST /api/ads/launch-with-qap` already reaches QWK
   through the existing `/api/ads` proxy, so this design needs no new code for
   it. What it needs is the catalog key mapping in Section 3.3 so the client
   sends a key the endpoint accepts.

No new tables, no schema change in this folder.

---

## 9. REMOVAL CHECKLIST (exhaustive)

Old tier names and day-based durations must be impossible to find afterwards:

- `packages.html`: "Starter", "Premium", "Sponsored", "per campaign / 7 days",
  "per campaign / 14 days", "per campaign / 30 days", "$500".
- `index.html`: the three popup cards (Starter Banner / Premium Banner /
  Sponsored Feed) and their prices.
- Redirect targets: `pkg=starter`, `pkg=premium`, `pkg=sponsored` as literals.
- Any `data-price` attribute that duplicates a price the catalog owns.

Rule for the pull request: after this change, the strings `Starter`, `Premium`,
`Sponsored` and `/ 7 days` appear ZERO times in the four BANQ standalone files.

---

## 10. VERIFICATION

The repo's own convention is PowerShell scripts named
`verify-v{number}-{feature}.ps1` (pipeline BANQ-020). This change ships one:
`scripts/verify-v1-unified-ad-page.ps1`, checking at minimum:

1. `js/ad-catalog.js` loads and exposes six entries with unique keys.
2. Every catalog key that is not `announced_soon` exists in the QWK
   `PACKAGE_TIERS` key set; this is the drift alarm from Section 3.3.
3. No catalog entry contains a day-based duration (`/ 7 days`, `30 days`).
4. Priced entries show a number; unpriced entries show `$` and no number.
5. `packages.html` renders six cards and four buttons in `delayed` state plus
   two in `announced_soon`.
6. The popup renders six summary rows and never the full bullet list.
7. The strings `Starter`, `Premium`, `Sponsored` are absent from both files.
8. `dashboard.html` maps a catalog key to a label and cannot print a raw key.
9. The QAP proxy answers 404 for a junk QAP and a real profile shape for a real
   one (integration, run against a live 3001 + 3002).

Exit 0 with a printed count, matching the convention used across the ecosystem.

---

## 11. BUILD ORDER

1. `js/ad-catalog.js` -- the single source of truth (Section 3).
2. `js/ad-page.js` -- two render functions over the catalog: full (page) and
   summary (popup). One renderer per surface, no inline card markup left.
3. `packages.html` -- hero, sections, BANQ CTA, QAP section, buttons.
4. `index.html` -- popup rebuilt from the summary renderer.
5. `server.js` -- the QAP read-through proxy.
6. `dashboard.html` -- catalog lookup for the `pkg` param.
7. `scripts/verify-v1-unified-ad-page.ps1` -- the checks above.
8. `docs/BANQ-JS.md` -- add both new JS files (repo Rule 13 makes this
   mandatory, not optional).
9. `docs/BANQ-MASTER-PIPELINE.md` -- flip BANQ-021 from PLANNED to DONE with
   the BANQ-standalone half noted, and mark the qwkbrowser half as its own item.

---

## 12. DECISIONS -- ANSWERED 2026-09-21

**Q1. `Express ADS` vs `Launch Package` -> the clarification replaced the
question.** The founder's answer was that the tension is not about a name: the
ad is a QWK Browser product and its price is QWK's business, while BANQ sells
only the $15/month monitoring subscription. So the ad tier keeps the name the
billing config publishes (`Express ADS`) and BANQ's own product is the
subscription. Section 4.1 records the two-layer model this implies, including
that the fee is payable in credits or fiat and that "if they opt for it on
qwkbrowser, then good" -- an opt-in taken on the QWK side must appear on this
site's dashboard exactly like one taken here.

**Q2. Network placement prices -> SHOW `$` ONLY.** Confirmed. Banner and Video
on the Publishers Network stay unpriced with the announce-soon button state; no
number is invented anywhere.

**Q3. packages.html depth -> FULL DETAILS.** Confirmed. The standalone page is
the full marketplace (every bullet, every targeting option); only the popup
stays a partial preview.

**Q4. QAP timing -> LAUNCH-TIME ONLY (unchanged).** Nothing in the answers asks
for a second QAP path, and the founder is content for the opt-in to happen on
the QWK side, so the launch flow's single QAP ask stands and the old dedicated
QAP box is not rebuilt.

---

## 13. CHANGE LOG

| Date | Change |
|---|---|
| 2026-09-21 | Design created. Scope fixed to the two BANQ-standalone files; the old 2026-08-29 task doc marked stale where the 2026-09-03 decisions supersede it; single-source catalog proposed; four questions recorded for the founder. No code changed yet. |
| 2026-09-21 | BUILT (BANQ standalone half). New js/ad-catalog.js (single source of truth) + js/ad-page.js (full page renderer + partial popup renderer); packages.html and the index.html popup rebuilt to render from the catalog; stale starter/premium/sponsored keys removed from the dashboard deep link (it now resolves a catalog key to a label); server.js gained the /api/ad-profile QAP read-through; new scripts/verify-unified-ad-page.cjs + verify-v1-unified-ad-page.ps1. Verified 18 PASS / 0 FAIL and confirmed live on 3002: 6 cards, $50 / $150 / $ / $ / $200 / $450, BANQ AD SERVICE $15 per month, and both button notices render (delayed vs announce-soon). docs/BANQ-JS.md updated per Rule 13; pipeline BANQ-021 flipped to DONE (BANQ half). Nothing committed. |
| 2026-09-21 | Section 12 answered. Q1 was answered by reframing: BANQ charges only the $15/month monitoring subscription (all adverts, credits or fiat) while ad spend belongs to QWK Browser, so Section 4.1 was added to keep the page from implying BANQ collects the package price, and the ad tier keeps the billing config's name. Q2 confirmed `$`-only for the network placements; Q3 confirmed full details on packages.html. Registry highlight BAP-01 filed through the shared writer path. |

---

## END OF BANQ-021 IMPLEMENTATION DESIGN
