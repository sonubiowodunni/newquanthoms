# QwkBrowser -- Master Pipeline & Task Tracker

> Last updated: 2026-08-23
> This is the single source of truth for all features, tasks, and ideas.
> Update status as things change. Do not delete items -- mark them DONE, DEFERRED, or BLOCKED.

---

## How to Read This Document

Each item has:
- **ID** -- stable reference (QWK-001, QWK-002, etc.)
- **Status** -- PLANNED / SPEC-READY / IN-PROGRESS / DONE / BLOCKED / DEFERRED
- **Spec** -- where the detailed design lives (or "NEEDED" if not yet written)
- **Dependencies** -- what must happen first
- **Notes** -- brief context

---

## Section 1: DONE

### QWK-002: Webcode Promotions
- **Status:** DONE
- **Spec:** `docs/WEBCODES-PROMOTIONS.md`
- **Dependencies:** None
- **Notes:** Raffle-backed promoted webcode banners on webcodes.html + factory.html. Fully built and verified.

### QWK-007: Display Mode Feed Restructure
- **Status:** DONE (confirmed in factory.html codebase 2026-08-19)
- **Spec:** `docs/DISPLAY-MODE.md` (exists)
- **Dependencies:** None
- **Notes:** Four display modes built in factory.html: List Feed (data-mode="list"), Voters Feed (data-mode="voters"), Mobile Feed (data-mode="mobile"), Activity Feed (data-mode="activity"). Display mode bar with 4 icon buttons at bottom of right sidebar. Activity Feed has round avatar cards with 24h activity (posts + stories). Upload layer replaced: Add To Story, Broadcast Studio, Go Live buttons in hero actions. Factory Guide removed. "More" renamed to "Mobile". "Card" renamed to "Voters". "Short Video" renamed to "Reels". "Long Video" renamed to "Features". Verified via factory.html lines 7226-7239 (display mode bar), 7137-7145 (activity feed panel), 7072-7074 (Broadcast Studio + Story + Go Live buttons), 12747 (setDisplayMode function).

### QWK-019: BMF QLUB (Broadcast Membership Framework) -- Phase 1
- **Status:** IN-PROGRESS (Phase 1 DONE, Phase 1.5 Channel Model IN-PROGRESS)
- **Spec:** `docs/BMF-QLUB-SPEC.md`
- **Dependencies:** None (foundational)
- **Notes:** Private AI-powered social club system inside QWKBrowser. Combines Instagram Broadcast Channels, Close Friends, Patreon subscriptions, and Discord private communities. Activation model: every QwkBrowser user already has a dormant BMF account -- users ACTIVATE to bring it online (produces QLUB-XXXXXXXXX reference), can DEACTIVATE (returns to dormant, QLUB ID retained). No "create BMF" action -- only activate/deactivate. Frontend: mybmf.html (private BMF dashboard with activation/deactivation toggle, 5 tabs: Feed/Journal/Moodboards/Members/Chat, quick links to bmfqlub.html and bmfelevathor.html). Phase 2 engagement (chat, comments, likes, stickers, gifts) remains in spec. Phase 2 audio discovery is QWK-020. **NEW (Section 22):** Activated BMF account is a private asset; broadcast channels are the public entities on bmfqlub.html. On activation, user names a default channel (e.g. "ADIDAS STORE"). Verified accounts can create up to 7 channels; unverified limited to 1. Directory now lists channels, not raw BMF profiles.

---

## Section 2: OTHERS (PLANNED / SPEC-READY / IN-PROGRESS / BLOCKED / DEFERRED)

### QWK-001: IP Provenance & Creator Proof System
- **Status:** SPEC-READY
- **Spec:** `docs/QWK-PROVENANCE-SYSTEM.md`
- **Dependencies:** None (foundational)
- **Notes:** Full provenance layer -- private registration, versioning, development evidence, certificates, perceptual matching roadmap. 6 DB tables designed. Certificate posts will flow through factory.html feed (data-filter="certificate"). Four-tier claim language locked. Legal framework: platform-level proof, not legal registration. Cost model: free registration, QC-funded perceptual matching.

### QWK-003: Factory Filter Chips (New Additions)
- **Status:** IN-PROGRESS (chips added, backend wiring pending)
- **Spec:** This document
- **Dependencies:** Per-feature (see below)
- **Notes:** Four new chips added to factory.html #feedFilters:
  - **GIFs** (data-filter="gif") -- needs backend wiring for GIF content type
  - **Story** (data-filter="story") -- needs expiring content backend (QWK-009)
  - **Emojis** (data-filter="emoji") -- needs emoji asset system (QWK-010)
  - **Certificates** (data-filter="certificate") -- needs provenance system (QWK-001)
  - **Reels** (renamed from "Short Video", data-filter="short") -- DONE, backend stays generic "short"
- **Architecture decision:** Frontend uses recognizable names (Reels, Story). Backend uses generic names (short_video, temporary_content). QWK owns the future, not Instagram's brand.

### QWK-004: WhatsApp Premium Plan Features
- **Status:** PLANNED
- **Spec:** NEEDED
- **Dependencies:** Define which features apply to QWK vs are WhatsApp-specific
- **Notes:** Features to extract/adapt for QWK premium:
  - Exclusive stickers (maps to QWK emoji/sticker system)
  - Custom app icon
  - App theme customization (maps to QWK-008)
  - Exclusive ringtones (notification sounds?)
  - Upgraded chat list
  - Pinning extra chats
- **Question:** Which of these make sense for QWK's ecosystem? Custom app icon and themes are straightforward. Stickers map to emoji system. Ringtones could be notification sounds. Chat list and pinning need a QWK messaging layer first.

### QWK-005: QWK Connector Architecture + Stationhead Connector #001
- **Status:** SPEC-READY (revised by review-agent consensus)
- **Spec:** `docs/QWK-CONNECTOR-STATIONHEAD.md`
- **Replaces:** `docs/QWK-STATIONHEAD-INTEGRATION.md` (absorbed and superseded)
- **Dependencies:** None for Phase 0 (architecture scaffolding). Phase 1 needs Stationhead connector investigation.
- **Notes:** Build generic QWK Connector Architecture now, expose only Stationhead in Phase 1. Stationhead = Connector #001, not a special-case integration. QWK Smart Link pipeline (URL -> normalize -> detect -> match connector -> resolve -> QWK Entity -> Experience Card) is foundational. Experience Card is a platform (card renderer + connector data), not hardcoded. Three link levels: Universal (any URL), Smart (recognized platform), Connected (authorized). Connector due-diligence process (8 steps) for every future connector. Phased roadmap: Phase 0 architecture, Phase 1 Stationhead launch, Phase 1.5 smart links, Phase 2 connector #2, Phase 3 universal identity, Phase 4 communities, Phase 5 engagement, Phase 6 campaigns, Phase 7 connector marketplace, Phase 8 developer platform. SQLite minimal tables for start. Token storage encrypted at rest. Connects to existing QC economy, amplification/marketing, Protected Identity (QWK-015), webcodes, retail marketplace.

### QWK-006: Mobile Feed Multi-Layered Rails
- **Status:** PLANNED
- **Spec:** NEEDED
- **Dependencies:** Mobile feed view exists (currently "More" -- rename to "Mobile")
- **Notes:** Mobile feed has multi-layered rail format with high potential. Rails to build:
  - More Amplifications
  - More Books
  - More Games
  - More Emojis
  - More GIFs
  - Customized rails: More Adidas, More Tesla Motors, etc. (brand-specific rails)
- **Architecture:** Rails are filterable content streams within the mobile feed view. Each rail pulls content by type or tag. Brand rails pull content tagged with that brand.

### QWK-008: Theme Personalization Restructure
- **Status:** PLANNED
- **Spec:** `docs/THEME-PERSONALIZATION.md` (exists, needs restructure)
- **Dependencies:** None
- **Notes:** Restructuring from existing theme work:
  - Remove PROFILE tab (users double-click username chip to go to userprofile.html)
  - Base modes only: LIGHT MODE / DARK MODE / SYSTEM DEFAULT (neon blue/purple)
  - Wire with verification scripts
  - Read AGENTS.md before implementation

### QWK-009: Story System (Expiring Content)
- **Status:** PLANNED
- **Spec:** NEEDED
- **Dependencies:** QWK-007 (display mode restructure) -- DONE
- **Notes:** Story architecture:
  - Fields: id, creator_id, media_url, type:"story", created_at, expires_at (24h), visibility, viewers
  - Background worker: every 15 min, find stories where expires_at < now(), set status = archived (NOT deleted)
  - Archive (not delete) for future features: Story Memories, Creator Analytics, "On This Day", User Archives
  - Story modal in upload layer: image & video only, with story graphic design tools
  - Story tray: rich text controls (fonts, bold, styling, emojis, stickers, audio)
  - Filter chip: data-filter="story" (already added)

### QWK-010: Emoji Asset System
- **Status:** PLANNED
- **Spec:** `docs/EMOJI-DIGITAL-ASSETS.md` (exists, needs extension)
- **Dependencies:** None
- **Notes:** New page: assets.html (My Assets)
  - All emojis hosted on QwkBrowser platform
  - Emojis eligible for use by signed-in user (automatic or by consent)
  - Categories: Personal Emoji, Creator Emoji, Brand Emoji
  - NEW: High Priority Emojis -- significant to cultural groups, social political communities & programs
  - High Priority Emojis require: reported or applied for, via substantial documented materials
  - Emoji License Function must include High Priority Emojis category
  - Filter chip: data-filter="emoji" (already added)
  - Comment trays for emojis & GIFs (QWK-014)

### QWK-011: New Pages (My Games, My Rewards, My Contents, My Frontdesk, My BMF)
- **Status:** DONE (revised Aug 21, 2026 -- dropdown restructured)
- **Spec:** `docs/USERNAME-PAGES.md`
- **Dependencies:** Varies per page
- **Notes:** Six pages built and verified. Dropdown revised: removed Profile and My Factory (accessible elsewhere), rearranged to My BMF / My Emojis / My Games / My Content / My Rewards / My Frontdesk. Theme system fixed to 3 options only: Neon Blue (default) / Dark / Light. Old themes (midnight, aurora, ocean) removed from CSS. Verification script updated with order checks, removed-item checks, and theme system checks. Pages:

  **11a. My Games (games.html)**
  - All Games / My Games
  - Web games hosted from partnering game studios
  - Playable on website or future game consoles
  - Design: study ecosystem, design new page

  **11b. My Rewards (rewards.html)**
  - All units, credits, badges earned on platform
  - Day-to-day elaborative display
  - Study ecosystem, design new page

  **11c. My Contents (contents.html)**
  - All original factory contents displayed here
  - Content types: QUOTES / PHOTOS / AUDIOS / VIDEOS / ARTICLES
  - Study factory.html to make design perfect

  **11d. My Frontdesk (frontdesk.html)**
  - All subpages previously at last section of left sidebar (topbar-chips.js) on userprofile.html
  - Removed but findable in git history
  - Sections: Business Profile, Retail Board, QU Generator, Raffle, Account Snapshot, Translation Rights, Referral Code, Active Sessions, Cancel Campaigns, Location Activity, Tracked URLs, Milestones, Badges
  - Design inspiration: marketing-admins.html page

  **11e. My BMF (mybmf.html)**
  - Private BMF dashboard -- already built in Phase 1 (QWK-019)
  - Activation/deactivation toggle, 5 tabs: Feed/Journal/Moodboards/Members/Chat
  - Quick links to bmfqlub.html and bmfelevathor.html
  - Must be added to the username chip dropdown in topbar-chips.js alongside existing items (Profile, My Factory, My Content, My Rewards, theme personalization, etc.)
  - Dropdown item: "My BMF" linking to mybmf.html, with users icon

  **11f. My Emojis (emojis.html)**
  - User's owned/created emoji digital identity assets
  - Marketplace browsing, AI emoji creator entry point
  - Ties to QWK-010 Emoji Asset System (docs/EMOJI-DIGITAL-ASSETS.md)
  - Additional concept TBD (per user)

### QWK-012: Quote Feature (Quick Quote Modal)
- **Status:** PLANNED
- **Spec:** NEEDED (design proposal exists in conversation, needs formal MD)
- **Dependencies:** None
- **Notes:** Text selection quote feature:
  - Highlight any text in any post (video, url, audio, photos, emojis, etc.)
  - Tiny "Quote" button appears on all post content
  - Quick Quote Post Modal opens with selected text as portrait card
  - Quote post = feedback system (no comments, no likes)
  - 5-star rating system (1-5 stars)
  - Thumbdown requires mandatory comment
  - Comment section access costs lifetime payment of 5 units
  - Quote posts appear in main feed (kind: 'quote') and "More Quotes" rail in simple view
  - Filter chip: already exists (data-filter="quote")
  - Need: formal spec MD, backend wiring, verification script

### QWK-013: Blue Checkmark Verification Requirements
- **Status:** PLANNED
- **Spec:** NEEDED
- **Dependencies:** Profile verification HTML page exists
- **Notes:** New rules for blue checkmark:
  - NOT applicable to three marketing accounts
  - User must submit: real-time WEBCAM CAPTURE (first identity verification)
  - User must connect one social account to QwkBrowser (X/Twitter, or any available)
  - Cash withdrawal still requires: webcam capture + drivers license/national ID/passport/police affidavit + bank details
  - Wire and update all relevant verification scripts
  - Read AGENTS.md first

### QWK-014: Comment & Story Trays
- **Status:** PLANNED
- **Spec:** NEEDED
- **Dependencies:** QWK-009 (Story system), QWK-010 (Emoji system)
- **Notes:**
  - Comment trays for emojis & GIFs
  - Story trays for rich text controls: fonts, bold, styling, emojis, stickers, audio
  - Soundtrack embedding for posts (stories, reels, etc.)

### QWK-015: Protected Identity Username System
- **Status:** PLANNED
- **Spec:** NEEDED (detailed brief exists in conversation)
- **Dependencies:** Instagram API access for automated detection (Phase 2)
- **Notes:** Comprehensive username protection system:
  - Protected Identity Registry -- valuable usernames flagged publicly
  - Status system: Available / Protected / Claimed / Disputed
  - Protection criteria: Instagram followers >= 5,000 + active account
  - Verification methods: Instagram OAuth, Social Proof, Domain Verification
  - Public page: qwkbrowser.com/protected-usernames (marketing + transparency)
  - Reverse marketing psychology: public list creates urgency -> drives adoption
  - Self-claim flow at qwkbrowser.com/claim
  - Database: username table, identity evidence table, claim requests table
  - Automated detection: daily background worker, identity score calculation
  - Abuse prevention: squatting prevention, fake claim detection
  - Phase 1: manual protected list (10,000 usernames)
  - Phase 2: automated detection via Instagram signals
  - Phase 3: full identity ecosystem (QWK username = universal internet identity)
  - Principle: "QWK username is not just a handle. It is a verified digital identity layer for the internet."

### QWK-016: Retail.html Bug Fixes
- **Status:** PLANNED
- **Spec:** This document
- **Dependencies:** None
- **Notes:**
  - Bug 1: Cannot remove items from cart individually (only clear all). Users must be able to remove items one by one.
  - Bug 2: Item banner/thumbnail not visible. Thumbnail is the major selling point (like Temu, Amazon, Alibaba). Ask Chris for screenshot sample when ready.

### QWK-017: Hotkeys & Special Features (settings.html)
- **Status:** PLANNED
- **Spec:** NEEDED
- **Dependencies:** InBrowser built on QwkBrowser website, OR mobile browser app, OR standalone extension
- **Notes:** settings.html will house all hotkeys and special features:

  **Quick Scroll:**
  - User activates hotkey -> scrolls through browsing page
  - Detects deferred links / embedded weblinks not visible to the eye
  - Detected links can be auto-translated to webcodes for 1 credit reward + translation rights
  - Activation via hotkey or button depending on app type

  **Quick Shot:**
  - Screenshot function

### QWK-018: Vote & Boost System
- **Status:** IN-PROGRESS (Phase 3-4 backend + frontend rename + display mode bar + hero buttons complete)
- **Spec:** `docs/QWK-VOTE-BOOST-SPEC.md`
- **Dependencies:** QWK-007 (Display Mode Restructure) -- DONE
- **Notes:** Replaces the "repost" system with a Vote & Boost system. Voting is always available on every post. Voting automatically reposts the content to the voter's timeline. TopUp generates a new URL for every batch of voting. Terminology shift: Repost -> Vote, Ranking Score -> Vote Score, Repost Post -> Vote Post, factory_post_reposts -> factory_post_votes, etc. Display mode "Card" renamed to "Voters". Upload dropdown "Short Videos" removed, "Long Videos" renamed to "Features". Phases 3-4 (backend + frontend rename + display mode bar + hero buttons) complete. Remaining phases need implementation.

### QWK-020: BMF Phase 2 Audio Discovery & Quanthom Access
- **Status:** SPEC-READY
- **Spec:** `docs/BMF-PHASE2-AUDIO-QLUB-SPEC.md`
- **Dependencies:** QWK-019 (BMF QLUB Phase 1) -- DONE
- **Notes:** Phase 2 of the BMF QLUB + Elevathor audio ecosystem. Two tracks: Track A (Engagement -- chat, comments, likes, stickers, gifts) remains in main BMF-QLUB-SPEC.md. Track B (Audio Discovery & Quanthom Access -- THIS DOCUMENT): Trending Voices, Trending Moodboards, Quanthom Audio Access, expanded QLUB access controls. Prerequisite: BMF-QLUB-SPEC.md Phase 1 complete (138/138 checks passed). Specification written, awaiting implementation.

### QWK-021: BMF QLUB Developer Platform (BMF Community OS)
- **Status:** SPEC-READY
- **Spec:** `docs/BMF-QLUB-DEVELOPER-PLATFORM-SPEC.md`
- **Dependencies:** QWK-019 (BMF QLUB Phase 1) -- DONE
- **Notes:** Portable, identity-based private community infrastructure layer that external consumer applications integrate via API, SDK, and connectors. Positioning: "The portable private community identity layer for consumer applications." Internal product name: BMF Community OS. External developer product name: BMF QLUB API. Developer platform ecosystem: API (communication layer), SDK (developer adoption layer), Connector (external platform bridge), QwkBrowser ID (identity foundation). Specification written, awaiting implementation.

### QWK-022: Universal Search Expansion (16 Tables + Topics/Tags + Retail Fix)
- **Status:** PLANNED
- **Spec:** `docs/FEATURE-EXPANSION.md` (items P6, P6.1)
- **Dependencies:** None
- **Notes:** searchUniversal in db.js returns only 6 categories (users, amplified_urls, notes, jobs, business_profiles, retail_items). 3 of 4 frontend renderers silently drop retail_items (BUG). 0 topic/tag coverage. 16 searchable tables missing from search entirely. Fix retail renderer first (quick win), then expand to 16 tables + topic/tag category. Verify script: v80-universal-search-expansion.ps1.

### QWK-023: Interactive Articles Upload Type
- **Status:** PLANNED
- **Spec:** `docs/FEATURE-EXPANSION.md` (item P7)
- **Dependencies:** None
- **Notes:** Add Interactive Articles as a new upload type in factory.html. Article content type with interactive elements. Needs backend wiring for article content type, frontend upload modal, and feed rendering.

### QWK-024: Article Digest Page (articledigest.html)
- **Status:** PLANNED
- **Spec:** `docs/FEATURE-EXPANSION.md` (item P8)
- **Dependencies:** QWK-023 (Interactive Articles upload type)
- **Notes:** New page articledigest.html for article digest/summary view. Study ecosystem and design page.

### QWK-025: PWA + InBrowser Engine (Unified Desktop Installer with Module Switching)
- **Status:** PLANNED (FUTURE-CHECK)
- **Spec:** `docs/FEATURE-EXPANSION.md` (item P9), `docs/QWKBROWSER-INSTALLER-MODULES.md` (module breakdown)
- **Dependencies:** None
- **Notes:** QwkBrowser will be distributed as a SINGLE unified desktop installer — "Install — QWKBROWSER". One install, one icon, one app. Inside the app, users switch between four modules. Each module loads only its own pages, sidebar, and topbar chips — keeping the app lightweight. Common Core (auth, profile, settings, search) is always accessible.
  - **Module 1: FACTORY** — Content creation, amplification, broadcasting, URL tools (18 pages)
  - **Module 2: QLUBSTARS** — BMF community, channels, elevathor, competition, raffles (10 pages)
  - **Module 3: MAGAZINE** — Jobs, notes, articles, knowledge base, calendar, productivity (12 pages)
  - **Module 4: RETAILERS** — Retail marketplace, app store, payments, business, purchasing (8 pages)
  - **Common Core** — 11 pages shared across all four modules
  - **Total unique pages:** 56
  - **Locked installer name:** "Install — QWKBROWSER" (single unified installer)
  - **Locked module names:** FACTORY / QLUBSTARS / MAGAZINE / RETAILERS (switchable in-app)
  - **Locked InBrowser name:** "QWK InBrowser" (shared via Common Core)
  - Module switching is instant — app shell stays mounted, only content/sidebar/chips swap.
  - Cross-module navigation: clicking a link to another module's page switches modules automatically.
  - Full page-by-page categorization in `docs/QWKBROWSER-INSTALLER-MODULES.md`.
  - Enables QWK-017 (Hotkeys) on web. Future-check status — needs feasibility assessment before spec.
  - Open decisions: module switcher UI design, default module on first launch, module icons.

### QWK-026: Research Tool (Intellectual Material Discovery, Provenance & Authentication)
- **Status:** SPEC-READY
- **Spec:** `docs/QWK-PROVENANCE-SYSTEM.md` (Section 16)
- **Dependencies:** QWK-001 (provenance architecture), QWK-023 (articles as first material type), QWK-022 (search for material discovery)
- **Notes:** Unified system for identifying, investigating, tracing, documenting, and authenticating intellectual materials (articles, books, papers, podcasts, documents, etc.). NOT a feed or newsreader. Core object is an Intellectual Material with Work/Edition/Version/Manifestation/Source hierarchy. Distinguishes identification, provenance, evidence, and authentication as separate concepts (no single "verified" field). Supports ISBN, DOI, QR, barcode, URL, title/author/publisher identification. Evidence confidence levels: observed, reported, inferred, corroborated, conflicting, unknown. Article is first implementation target. AI research assistance supported but AI conclusions stay distinguishable from source-derived facts. Research Record saves investigation findings. General Feed can hand off content to Research Tool. Architecture is content-type agnostic and extensible. Complements creator-side provenance (Sections 1-15) with user-side material investigation.

### QWK-028: QLUBSTARS Sidebar Integration & Topbar Unification
- **Status:** DONE
- **Spec:** `docs/QLUBSTARS.md`
- **Dependencies:** QWK-019 (BMF QLUB Phase 1) -- DONE, QWK-027 (Qollaborator) -- SPEC-READY
- **Notes:** Restructures signed-in left sidebar in topbar-chips.js: renames "Discover Articles" to "Digest Articles", renames "Verify Webcodes" to "Promote Webcodes", adds "View Calendar" link, removes Calendar section block, adds QLUBSTARS block (MY BMF / BMF CHANNELS / BMF ELEVATHOR) as 2nd section. Unifies QwkBrowser topbar (amplify, translate, search, notifications, raffle, user chip) on all 3 BMF pages by replacing their custom topbars with standard topbar-chips.js include. CREATE MORE CHANNELS button moves from mybmf.html topbar to a card under QLUB Sound section.

### QWK-030: BMF Phase 3 Audio Missions Engine (AME)
- **Status:** SPEC-READY
- **Spec:** `docs/BMF-PHASE3-AUDIO-MISSIONS-SPEC.md`
- **Dependencies:** QWK-019 (BMF QLUB Phase 1) -- DONE, QWK-020 (BMF Phase 2 Audio) -- SPEC-READY
- **Notes:** Phase 3 of the BMF audio ecosystem. Social engagement layer that transforms passive listening into missions, campaigns, squad competition, and verified achievements. Introduces AP (Audio Points) as a new engagement currency (separate from QC/QU). Core modules: Audio Missions System, Fan Campaign Engine, Verified Listening Engine, AP Economy Engine, Squad Challenge System, Leaderboard Service, Fraud Detection Engine. 13 new DB tables (ame_*). 4-phase build: MVP -> Social Gamification -> Artist Ecosystem -> AI Scale. Specification written, awaiting implementation.

### QWK-031: QLUBSTARS MACHINES -- Game Platform & Game Engine

- **Status:** SPEC-READY
- **Spec:** `docs/QLUBSTARS-MACHINES.md`
- **Dependencies:** QWK-010 (Emoji Asset System) -- PLANNED, QWK-029 (Quanthom Exchange / Currency Hub) -- DONE
- **Notes:** Modular game platform inside games.html with three initial games (Emoji Reels, Symbol Storm, Color Rush). Dual currency support: QUANTHOM UNITS (enabled), QUANTHOM CREDITS (locked at 4 layers until legal authorization). Server-authoritative outcomes, secure RNG (no Math.random), versioned game/probability/paytable configs, immutable round records, idempotent requests, ledger-based balance. 121-section specification covering RNG architecture, game versioning, payout mathematics, volatility classifications, emoji asset integration, all three game specs, credit license gate, game session/round/record models, ledger rules, anti-abuse, testing requirements, network failure handling, animation interruption, game history/audit, admin status states, deployment configuration, jurisdiction model, event engine, reward types, collectibles, player progression, game design language, visual identity, audio layer, music release integration, creator promotion, URL advertising, analytics, responsible system design, and 15 non-negotiable rules. Specification written, awaiting implementation.

### QWK-032: Gating Tiers System (Red Padlock + Access Locks)

- **Status:** SPEC-READY
- **Spec:** `docs/PRE-DEPLOY.md` Section 2A
- **Dependencies:** None (builds on existing feature flag system in Section 2)
- **Notes:** Three-tier gating system for controlling feature visibility and access. Tier 1: Feature Flag (already exists -- complete invisibility). Tier 2: Red Padlock (page visible/navigable but content replaced by red padlock overlay -- "This page is locked. Coming soon."). Tier 3A: Per-User Access Lock (page loads fully, action buttons locked based on user role/tier -- "You don't have access to this yet."). Tier 3B: Per-Feature Access Lock (page loads fully, action buttons locked globally because feature not ready -- "This action isn't available yet."). Implementation needs: padlock overlay CSS class (.qwk-padlock-overlay), padlock JS function (showPadlockOverlay), data-locked attribute system for action buttons, backend role enforcement for Tier 3A, flag-based button locking for Tier 3B. Tier column to be added to flag state table (PRE-DEPLOY.md Section 10). Rules for switching between tiers documented in Section 2A.3. AGENTS.md Rule 30 (confirmation popups) and Rule 31 (implementation summaries) added alongside this spec.

---

## C. Status Summary

| ID | Feature | Status | Spec |
|----|---------|--------|------|
| QWK-002 | Webcode Promotions | DONE | docs/WEBCODES-PROMOTIONS.md |
| QWK-007 | Display Mode Feed Restructure | DONE | docs/DISPLAY-MODE.md |
| QWK-019 | BMF QLUB Phase 1 | DONE | docs/BMF-QLUB-SPEC.md |
| QWK-001 | IP Provenance System | SPEC-READY | docs/QWK-PROVENANCE-SYSTEM.md |
| QWK-003 | Factory Filter Chips | IN-PROGRESS | This document |
| QWK-004 | WhatsApp Premium Features | PLANNED | NEEDED |
| QWK-005 | Connector Arch + Stationhead #001 | SPEC-READY | docs/QWK-CONNECTOR-STATIONHEAD.md |
| QWK-006 | Mobile Feed Multi-Rails | PLANNED | NEEDED |
| QWK-008 | Theme Personalization Restructure | PLANNED | docs/THEME-PERSONALIZATION.md (update) |
| QWK-009 | Story System (Expiring Content) | PLANNED | NEEDED |
| QWK-010 | Emoji Asset System | PLANNED | docs/EMOJI-DIGITAL-ASSETS.md (extend) |
| QWK-011 | New Pages (Games/Rewards/Contents/Frontdesk/BMF) | DONE | docs/USERNAME-PAGES.md |
| QWK-012 | Quote Feature | PLANNED | NEEDED |
| QWK-013 | Blue Checkmark Verification | PLANNED | NEEDED |
| QWK-014 | Comment & Story Trays | PLANNED | NEEDED |
| QWK-015 | Protected Identity Username System | PLANNED | NEEDED (brief exists) |
| QWK-016 | Retail.html Bug Fixes | PLANNED | This document |
| QWK-017 | Hotkeys & Special Features | PLANNED | NEEDED |
| QWK-018 | Vote & Boost System | IN-PROGRESS | docs/QWK-VOTE-BOOST-SPEC.md |
| QWK-020 | BMF Phase 2 Audio Discovery | SPEC-READY | docs/BMF-PHASE2-AUDIO-QLUB-SPEC.md |
| QWK-021 | BMF QLUB Developer Platform | SPEC-READY | docs/BMF-QLUB-DEVELOPER-PLATFORM-SPEC.md |
| QWK-022 | Universal Search Expansion | PLANNED | docs/FEATURE-EXPANSION.md |
| QWK-023 | Interactive Articles Upload | PLANNED | docs/FEATURE-EXPANSION.md |
| QWK-024 | Article Digest Page | PLANNED | docs/FEATURE-EXPANSION.md |
| QWK-025 | PWA + InBrowser Engine (Unified Installer + Module Switching) | PLANNED | docs/FEATURE-EXPANSION.md + docs/QWKBROWSER-INSTALLER-MODULES.md |
| QWK-026 | Research Tool (Intellectual Material Provenance) | SPEC-READY | docs/QWK-PROVENANCE-SYSTEM.md (Section 16) |
| QWK-028 | QLUBSTARS Sidebar & Topbar Unification | DONE | docs/QLUBSTARS.md |
| QWK-030 | BMF Phase 3 Audio Missions Engine (AME) | SPEC-READY | docs/BMF-PHASE3-AUDIO-MISSIONS-SPEC.md |
| QWK-030 | Get New Quanthoms -- Ad Banner Slideout Panel | DONE | docs/QWK-030-get-new-quanthoms.md |
| QWK-031 | QLUBSTARS MACHINES -- Game Platform & Engine | SPEC-READY | docs/QLUBSTARS-MACHINES.md |
| QWK-032 | Gating Tiers System (Red Padlock + Access Locks) | SPEC-READY | docs/PRE-DEPLOY.md Section 2A |
| QWK-033 | BMF Feed Record + Go Live Buttons + Factory BMF Contents Chip | DONE | (no separate spec -- inline in mybmf.html + factory.html) |

---

## D. Dependency Map

```
QWK-001 (Provenance) -----> QWK-003 (Certificate chip wiring)
QWK-007 (Display Modes) ---> QWK-009 (Story System) -- DONE
QWK-007 (Display Modes) ---> QWK-018 (Vote & Boost) -- DONE
QWK-009 (Story System) ----> QWK-014 (Story trays)
QWK-010 (Emoji System) ---> QWK-014 (Comment trays for emojis)
QWK-005 (Stationhead) -----> Research needed before spec
QWK-015 (Username System) -> Phase 1 manual, Phase 2 needs Instagram API
QWK-017 (Hotkeys) ---------> Needs InBrowser or mobile app or extension
QWK-019 (BMF QLUB Phase 1) -> QWK-020 (BMF Phase 2 Audio) -- DONE
QWK-019 (BMF QLUB Phase 1) -> QWK-021 (BMF Developer Platform) -- DONE
QWK-020 (BMF Phase 2 Audio) -> QWK-030 (BMF Phase 3 Audio Missions Engine) -- SPEC-READY
QWK-010 (Emoji System) ---> QWK-031 (QLUBSTARS MACHINES -- game symbols)
QWK-029 (Quanthom Exchange) -> QWK-031 (QLUBSTARS MACHINES -- currency integration) -- DONE
QWK-023 (Articles Upload) --> QWK-024 (Article Digest Page)
QWK-001 (Provenance) ------> QWK-026 (Research Tool -- shared provenance architecture)
QWK-023 (Articles Upload) --> QWK-026 (Research Tool -- article is first material type)
QWK-022 (Universal Search) -> QWK-026 (Research Tool -- material discovery via search)
```

---

## E. Recommended Build Order

BMF TRACK (build first):
1. QWK-019 Phase 1.5: BMF Broadcast Channel model (Section 22 of BMF-QLUB-SPEC.md) -- activation asset model, channel directory, channel creation limits
2. QWK-020: BMF Phase 2 Audio Discovery & Quanthom Access (spec ready, Phase 1 done)
3. QWK-030: BMF Phase 3 Audio Missions Engine (spec ready, depends on Phase 2)
4. QWK-031: QLUBSTARS MACHINES (spec ready, depends on QWK-010 Emoji System + QWK-029 Currency Hub)
5. QWK-021: BMF QLUB Developer Platform -- DEFERRED until Phase 1 production launch

NON-BMF (easiest to hardest):
4. QWK-016: Retail.html bug fixes (quick wins, unblocks retail feature)
5. QWK-008: Theme Personalization restructure (affects all pages)
6. QWK-013: Blue Checkmark verification (security foundation)
7. QWK-001: IP Provenance System (spec ready, can start building)
8. QWK-012: Quote Feature (standalone, no hard dependencies)
9. QWK-009: Story System (enables Story chip + Story trays)
10. QWK-010: Emoji Asset System (enables Emoji chip + assets.html)
11. QWK-011: New Pages (Games, Rewards, Contents, Frontdesk, BMF)
12. QWK-014: Comment & Story Trays (needs Story + Emoji systems)
13. QWK-006: Mobile Feed Multi-Rails (needs mobile feed rename first)
14. QWK-015: Protected Identity Username System (Phase 1 manual list)
15. QWK-004: WhatsApp Premium Features (needs messaging layer assessment)
16. QWK-005: Stationhead API Integration (needs research first)
17. QWK-026: Research Tool (needs QWK-001 provenance architecture + QWK-023 articles as first material type)
17. QWK-018: Vote & Boost System (finish remaining phases)
18. QWK-022: Universal Search Expansion (16 tables + retail fix)
19. QWK-023: Interactive Articles Upload
20. QWK-024: Article Digest Page (needs articles upload first)
21. QWK-017: Hotkeys & Special Features (needs InBrowser or extension)
22. QWK-025: PWA + InBrowser Engine — Unified Installer with Module Switching (future-check)

---

## F. Specs To Write (Priority Order)

1. QWK-012: Quote Feature spec (design proposal exists, needs formalization)
2. QWK-009: Story System spec (expiring content architecture)
3. QWK-011: New Pages spec (5 pages, can be one combined spec or 5 separate)
4. QWK-013: Blue Checkmark Verification spec
5. QWK-015: Protected Identity Username System spec (brief exists, needs formalization)
6. QWK-006: Mobile Feed Multi-Rails spec
7. QWK-004: WhatsApp Premium Features spec
8. QWK-014: Comment & Story Trays spec
9. QWK-017: Hotkeys & Special Features spec
10. QWK-022: Universal Search Expansion spec
11. QWK-023: Interactive Articles Upload spec
12. QWK-024: Article Digest Page spec

NOTE: QWK-005 (QWK Connector Architecture + Stationhead Connector #001) is SPEC-READY at docs/QWK-CONNECTOR-STATIONHEAD.md.
NOTE: QWK-018 (Vote & Boost System) is IN-PROGRESS at docs/QWK-VOTE-BOOST-SPEC.md.
NOTE: QWK-020 (BMF Phase 2 Audio) is SPEC-READY at docs/BMF-PHASE2-AUDIO-QLUB-SPEC.md.
NOTE: QWK-021 (BMF QLUB Developer Platform) is SPEC-READY at docs/BMF-QLUB-DEVELOPER-PLATFORM-SPEC.md.
NOTE: QWK-027 (Qollaborator -- Collaborator Share Management Service) is SPEC-READY at docs/qollaborator.md.
NOTE: QWK-028 (QLUBSTARS Sidebar Integration & Topbar Unification) is DONE at docs/QLUBSTARS.md.
NOTE: QWK-029 (Quanthom Exchange -- Currency Hub) is DONE at docs/quanthom-exchange.md. Merges purchase-units.html + purchase-quanthom.html + 3 new features (Deposit Cash, Auto Purchase, Exchange Tracker) into one page (currency-hub.html) with switch tabs. Embedded into 4 module pages (auditorium, mybmf, calendar, retail) via shared currency-hub-embed.css/js. Old purchase pages deleted. UNIFIED DELIVERY CODE SYSTEM: delivery-code endpoint now handles both invoices and retail orders via source param. pending-deliveries returns both. retail.html renderTransactionHistory fetches from pending-deliveries. invoice.html payInvoice fixed with CSRF token. Verification script: verify-v87-currency-hub-delivery-code.ps1.

### QWK-030: Get New Quanthoms -- Ad Banner Slideout Panel
- **Status:** DONE
- **Spec:** `docs/QWK-030-get-new-quanthoms.md`
- **Dependencies:** None (uses existing ledger + dock + slideout patterns)
- **Notes:** New floating dock icon "Get New Quanthoms (N)" below Messages. Slideout panel shows eligible ad banners. Users earn QU per click (10+ min), 20 unique clicks/day = 40 QC bonus. Per-banner cooldown (24h+). Two ad sources: partner banners (reward on click) + Google AdSense placeholders (reward on 3s dwell). Partner management page: newquanthoms.html. 3 new DB tables: ad_partners, ad_banners, ad_banner_clicks. 10 API endpoints in backend/routes/ads.js. Feature flags: ads_new_panel, page_newquanthoms (both default false). Verified via verify-v88-get-new-quanthoms.ps1 (84/84 PASS).

### QWK-033: BMF Feed Record + Go Live Buttons + Factory BMF Contents Chip
- **Status:** DONE
- **Spec:** No separate spec doc (inline implementation in mybmf.html + factory.html)
- **Dependencies:** None (uses existing BMF post API, existing factory feed system)
- **Notes:** Two tasks: (1) mybmf.html FEED tab now has 3-button row: Post | Record | Go Live. Record uses MediaRecorder API for real-time voice/video capture with Start/Stop, timer, and preview. Go Live creates a post_type:'live' BMF post with stream title + channel selector. Both gated by feature flags bmf_record=false, bmf_go_live=false (in both frontend/js/flags.js and backend/flags.js). (2) factory.html has new "BMF Contents" filter chip after "Audio Collections" with bmf-content kind, emoji, badge class, type mapping, kindFilter, and 2 mock data entries. No schema changes, no new tables, no new API endpoints. Verified via verify-v89-bmf-feed-buttons-and-factory-chip.ps1 (66/66 PASS).

---

## G. Backend JS Inventory Reference

`docs/QWKBROWSER-JS.md` is the plain-English inventory of every backend .js file. Each file has a one-line description of what it does.

**Maintenance rule (AGENTS.md Rule 39):**
- When a new .js file is created under `backend/`, add it to the inventory immediately.
- When a .js file is removed or renamed, update the inventory.
- When a file's purpose changes, update its description.

The inventory is the builder's reference for reviewing and modifying backend files using natural language. It must always match what is on disk.
