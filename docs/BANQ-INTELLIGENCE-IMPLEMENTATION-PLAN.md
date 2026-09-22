# BANQ Intelligence System -- Implementation Execution Plan

> **ID:** BANQ-INTEL-IMPL
> **Status:** SPEC -- ready for execution (NOTHING BUILT -- see "How to Read")
> **Created:** 2026-08-29
> **Source:** Chris (2026-08-29) -- full 4-phase specification
> **Location:** docs/BANQ-INTELLIGENCE-IMPLEMENTATION-PLAN.md
> **BUILD AUTHORITY:** THIS document. The counts it carries are the ones to plan
> against: **4 phases, 37 build steps** (4 pre-build foundation steps + 33 product
> steps: Phase 1 = 8, Phase 2 = 8, Phase 3 = 9, Phase 4 = 8), across 8 modules.
> Earlier headers in this doc and in the system doc carried "16 tools" and "20
> tools" respectively; both were wrong and both are corrected. Count STEPS here,
> never a prose number.
> **System overview:** docs/BANQ-INTELLIGENCE-SYSTEM.md (describes what the
> system IS and the rules it obeys; it does not enumerate the build)
> **Depends on:** BANQ-AD-MONITORING-PARTNERSHIP.md, BANQ-QWK-API-PARTNERSHIP.md, QAP-RELATED-TASK.md
> **AGENTS.md rules:** Rule 5 (ASCII), Rule 8 (PowerShell), Rule 9/10 (placeholders), Rule 13 (JS inventory), Rule 16 (commit checkpoints), Rule 18 (nav updates)

---

## How to Read This Document

**STATUS: none of this is built.** Verified 2026-09-21 against the repo: no
campaign tables, no creative/journey/experiment tables, no `banq_config`, and
no `/api/banq/*` route namespace (the only local namespace is `/api/auth/*`).
Everything below is a plan.

This is the **actionable execution plan** for coding agents. Each step tells you:
- What to build
- What tables to create
- What files to create or modify
- What APIs to expose
- What the acceptance check is
- Risk level and dependencies

**Build order is strictly sequential within each phase.** Do not skip ahead.
Each step builds on the ones before it. Commit after each step (Rule 16).

---

## Current State of the BANQ Codebase

```
server.js          -- Express on port 3002, proxies /api/ads/* and /api/profile/* to QWK:3001
backend/db.js      -- SQLite (data/banq.db). 2 tables: users, sessions. Seeds banqadmin.
backend/auth.js    -- Local auth (login, me, logout). Token-based, UUIDv4, SHA-256.
js/app.js          -- BANQ namespace. fetchJson, token management, toast, utils.
HTML pages         -- index.html, login.html, dashboard.html, billboards.html, packages.html, about.html
CSS                -- css/styles.css (dark theme, gold accent, banq- prefix)
Database           -- data/banq.db (SQLite, file-based, gitignored)
```

**What does NOT exist yet:**
- No campaign tables
- No BANQ service subscription tables
- No health scoring, alerts, timeline, notes, goals, budget pacer
- No creative tracking, recommendations, action center
- No journey mapping, experiments, benchmarking, enterprise
- No forecasting, planning, GTM workspace
- No /api/banq/* route namespace (only /api/auth/* is local)

---

## Pre-Build: Database Foundation

Before any Phase 1 step, create the BANQ Intelligence schema namespace
in backend/db.js. This is a HIGH RISK change (Rule 16: backup DB, commit
checkpoint before and after).

### Pre-Step 0.1: Backup Database

```
Copy data/banq.db to data/banq.db.backup-YYYYMMDD
Commit checkpoint to docs/COMMIT-CHECKPOINTS.md
```

### Pre-Step 0.2: Create banq_config Table

All configurable thresholds, weights, and rules live in one table.
No hardcoded scoring weights or alert thresholds anywhere in code.

```sql
CREATE TABLE IF NOT EXISTS banq_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  config_type TEXT DEFAULT 'string',
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

Seed with defaults:
- health_score_weights: JSON (budget_pacing:25, goal_progress:25, delivery:20, performance_trend:20, technical_status:10)
- health_score_ranges: JSON (healthy:80, watch:60, needs_attention:40, critical:0)
- alert_cooldown_minutes: 60
- alert_dedup_window_minutes: 120
- fatigue_min_active_days: 5
- fatigue_min_impressions: 1000
- fatigue_decline_threshold: 15
- fatigue_consecutive_decline_periods: 3
- creative_min_impressions: 500
- creative_min_clicks: 50
- creative_min_runtime_hours: 24
- experiment_min_runtime_days: 3
- experiment_min_impressions: 2000
- experiment_min_conversions: 10
- benchmark_min_campaign_count: 5
- benchmark_freshness_days: 90
- notification_cooldown_minutes: 30
- banq_service_plans: JSON (monitor, insight, managed, enterprise)

### Pre-Step 0.3: Create Core Campaign Tables

```sql
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qwk_banner_id INTEGER,
  advertiser_id INTEGER NOT NULL,
  campaign_name TEXT NOT NULL,
  campaign_source TEXT DEFAULT 'direct',
  status TEXT DEFAULT 'active',
  total_budget INTEGER DEFAULT 0,
  spent_budget INTEGER DEFAULT 0,
  start_date DATETIME,
  end_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (advertiser_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS banq_service_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  banq_service_plan TEXT NOT NULL,
  banq_service_fee INTEGER DEFAULT 0,
  banq_service_currency TEXT DEFAULT 'QC',
  banq_service_status TEXT DEFAULT 'NOT_SELECTED',
  banq_service_start DATETIME,
  banq_service_end DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE TABLE IF NOT EXISTS banq_analyst_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  analyst_id INTEGER NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active',
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (analyst_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS campaign_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  source TEXT DEFAULT 'system',
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE TABLE IF NOT EXISTS banq_activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER,
  actor_id INTEGER,
  action_type TEXT NOT NULL,
  metadata TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Pre-Step 0.4: Create /api/banq Route Namespace

In server.js, add:
```js
const banqRouter = require('./backend/banq-routes');
app.use('/api/banq', banqRouter);
```

Create backend/banq-routes.js as a master router that mounts
individual module routers as they are built.

**Commit checkpoint after Pre-Build is complete.**

---

## PHASE 1 -- MONITOR: "How is my campaign doing?"

**Goal:** Make the initial paid monitoring service real.
**Rule:** Every card, score, alert, and timeline entry must connect to real
campaign data or clearly identified placeholder data. No static dashboard cards.

### Phase 1 Steps (Easiest to Heaviest)

---

### Step 1.1: Campaign Notes (EASIEST -- 1 table, basic CRUD)

**Module:** BANQ Human Service
**Risk:** LOW (new table, new file, no existing code touched)
**Depends on:** Pre-Build

**Table:**
```sql
CREATE TABLE IF NOT EXISTS banq_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  author_role TEXT NOT NULL,
  message TEXT NOT NULL,
  visibility TEXT DEFAULT 'ADVERTISER_VISIBLE',
  parent_note_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (parent_note_id) REFERENCES banq_notes(id)
);
```

**API:**
- GET /api/banq/notes/:campaign_id -- list notes (ADVERTISER_VISIBLE only for advertisers)
- POST /api/banq/notes -- create note (body: campaign_id, message, visibility, author_role)
- POST /api/banq/notes/:id/reply -- reply to note (body: message)

**Rules:**
- INTERNAL_BANQ notes are NEVER returned to advertiser-role requests
- author_role: ADVERTISER, BANQ_ANALYST, BANQ_MANAGER, QWK_ADMIN
- Log activity: NOTE_CREATED in banq_activity_log

**Files:**
- backend/banq-notes.js (route file)
- backend/banq-routes.js (mount: router.use('/notes', banqNotesRouter))
- dashboard.html (notes section)
- docs/BANQ-JS.md (add entry -- Rule 13)

**Acceptance:**
- BANQ analyst can create a note visible to advertiser
- BANQ analyst can create an internal note NOT visible to advertiser
- Advertiser can read and reply to visible notes
- Activity log records each note creation

**Placeholder content:** Seed 2-3 sample notes on a demo campaign so the
UI renders with content on first load.

---

### Step 1.2: Campaign Timeline (append-only event log)

**Module:** Campaign Data Foundation
**Risk:** LOW (new table, new file, no existing code touched)
**Depends on:** Pre-Build

**Table:**
```sql
CREATE TABLE IF NOT EXISTS campaign_timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id INTEGER,
  metadata TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

**Event types:**
CAMPAIGN_CREATED, CAMPAIGN_LAUNCHED, BANQ_ACTIVATED, BUDGET_CHANGED,
GOAL_UPDATED, CAMPAIGN_PAUSED, ALERT_GENERATED, NOTE_ADDED,
CAMPAIGN_RESUMED, CAMPAIGN_COMPLETED, CREATIVE_ADDED, CREATIVE_PAUSED

**Actor types:** ADVERTISER, BANQ, QWK_ADMIN, SYSTEM

**API:**
- GET /api/banq/timeline/:campaign_id -- list events (newest first)
- POST /api/banq/timeline -- internal: add event (body: campaign_id, event_type, actor_type, metadata)

**Rules:**
- IMMUTABLE. Corrections create new events, never modify existing ones.
- The POST endpoint is internal-only (called by other BANQ modules, not exposed to advertisers)
- Log activity: TIMELINE_VIEWED in banq_activity_log

**Files:**
- backend/banq-timeline.js (route file)
- backend/banq-routes.js (mount)
- dashboard.html (timeline section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Timeline shows events in reverse chronological order
- Events cannot be edited or deleted
- Other modules can add events via the internal POST endpoint
- Placeholder: seed 5-6 timeline events on demo campaign

---

### Step 1.3: Campaign Goals (simple UI + basic calculation)

**Module:** Goals & Budget
**Risk:** LOW (new table, new file)
**Depends on:** Pre-Build

**Table:**
```sql
CREATE TABLE IF NOT EXISTS campaign_goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  goal_type TEXT NOT NULL,
  target_value INTEGER,
  current_value INTEGER DEFAULT 0,
  target_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

**Goal types:**
WEBSITE_VISITS, SALES, BOOKINGS, LEADS, APP_DOWNLOADS, BRAND_AWARENESS,
FOLLOWERS, CUSTOM

**API:**
- GET /api/banq/goals/:campaign_id -- list goals
- POST /api/banq/goals -- create goal (body: campaign_id, goal_type, target_value, target_date)
- PUT /api/banq/goals/:id -- update goal (body: current_value, target_value, target_date)
- DELETE /api/banq/goals/:id -- remove goal

**Rules:**
- If a goal cannot be directly measured: display "External tracking or manual updates may be required."
- DO NOT FABRICATE CONVERSIONS. If current_value is unknown, show 0 with a note.
- Goal changes add a GOAL_UPDATED event to timeline.
- Log activity: GOAL_CREATED, GOAL_UPDATED in banq_activity_log

**Files:**
- backend/banq-goals.js (route file)
- backend/banq-routes.js (mount)
- dashboard.html (goal section)
- packages.html (goal selection during campaign setup)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Advertiser can select a goal type during campaign setup
- Dashboard shows progress: current / target + percentage
- If unmeasurable, clearly indicated
- Placeholder: seed 1-2 goals on demo campaign

---

### Step 1.4: Budget Pacer (calculation logic)

**Module:** Goals & Budget
**Risk:** LOW-MEDIUM (new table, calculation logic, depends on campaigns table)
**Depends on:** Pre-Build, Step 1.2 (timeline for budget change events)

**Logic (no new table needed -- calculated from campaigns table):**

```
Expected Spend = (elapsed_time / total_duration) x total_budget
  - elapsed_time excludes paused periods
  - recalculated from point of budget change if budget changed

Actual Spend = spent_budget (from campaigns table)

Pacing State:
  ON_TRACK      -- actual within +/- 10% of expected
  SPENDING_FAST -- actual > 110% of expected
  SPENDING_SLOW -- actual < 90% of expected
  AT_RISK       -- actual > 130% of expected or projected to exhaust before end
```

**Intelligence output:**
- "Your campaign is spending faster than planned and may exhaust its budget before the scheduled end date."
- "Your campaign is under-spending. Consider increasing visibility or adjusting targeting."
- "Your campaign budget is on track."

**API:**
- GET /api/banq/budget-pacer/:campaign_id -- returns { state, expected_spend, actual_spend, remaining, projected_end_date, message }

**Rules:**
- Account for paused periods (exclude from elapsed time)
- Account for budget changes (recalculate expected from change point)
- If no budget set: return { state: 'NO_BUDGET', message: 'No budget configured.' }
- Log activity: BUDGET_PACER_VIEWED in banq_activity_log

**Files:**
- backend/banq-budget.js (route file + calculation logic)
- backend/banq-routes.js (mount)
- dashboard.html (budget pacer section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Returns correct pacing state based on budget, time, and spend
- Intelligence message displays alongside the numbers
- Handles edge cases: no budget, campaign not started, campaign ended
- Placeholder: seed demo campaign with budget 10000, spent 6200, 10-day duration, day 5

---

### Step 1.5: Campaign Dashboard (pulls together 1.1-1.4)

**Module:** Campaign Data Foundation
**Risk:** MEDIUM (new HTML page, nav update on ALL pages -- Rule 18, touches many files)
**Depends on:** Steps 1.1, 1.2, 1.3, 1.4

**New page:** campaign.html

**Display sections:**
1. Overview -- Campaign Name, Status, Health (placeholder until 1.7), Budget summary, Time Remaining, Latest BANQ Update
2. Health -- (placeholder until Step 1.7)
3. Performance -- (placeholder until Phase 2)
4. Budget -- Budget Pacer from Step 1.4
5. Goal -- Goal progress from Step 1.3
6. Timeline -- Events from Step 1.2
7. BANQ Notes -- Notes from Step 1.1

**API:**
- GET /api/banq/campaign/:campaign_id -- aggregated dashboard data (calls notes, timeline, goals, budget pacer internally)

**Rules:**
- Responsive layout (follow RESPONSIVE-BREAKPOINTS.md)
- Rule 18: Add "Campaign" to nav in ALL HTML files (index, login, dashboard, billboards, packages, about, campaign)
- Rule 9/10: Placeholder content for sections not yet built (Health, Performance)
- Update AGENTS.md Section 1 directory map with campaign.html
- Update BANQ-MASTER-PIPELINE.md

**Files:**
- campaign.html (new page)
- backend/banq-dashboard.js (aggregation route)
- backend/banq-routes.js (mount)
- ALL HTML files (nav update -- Rule 18)
- docs/AGENTS.md (directory map update)
- docs/BANQ-JS.md (add entry)
- docs/BANQ-MASTER-PIPELINE.md (add task)

**Acceptance:**
- Campaign page loads with all sections visible
- Notes, Timeline, Goals, Budget sections show real data from APIs
- Health and Performance sections show clearly labelled placeholder content
- Nav link appears on all pages
- Page works on mobile (responsive)

---

### Step 1.6: BANQ Watch -- Alert System (evaluation logic, lifecycle, cooldown)

**Module:** Monitoring & Health
**Risk:** MEDIUM-HIGH (alert engine logic, cooldown, deduplication)
**Depends on:** Pre-Build, Step 1.2 (timeline), Step 1.4 (budget pacer for budget alerts)

**Table:**
```sql
CREATE TABLE IF NOT EXISTS banq_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'MEDIUM',
  message TEXT NOT NULL,
  supporting_data TEXT,
  status TEXT DEFAULT 'NEW',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at DATETIME,
  resolved_at DATETIME,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

**Alert types:**
BUDGET_SPENDING_TOO_FAST, BUDGET_SPENDING_TOO_SLOW, CAMPAIGN_INACTIVE,
PERFORMANCE_DROP, GOAL_AT_RISK, CAMPAIGN_ENDING, GOAL_REACHED,
UNUSUAL_ACTIVITY

**Severity:** INFO, LOW, MEDIUM, HIGH, CRITICAL

**Status lifecycle:** NEW -> ACKNOWLEDGED -> RESOLVED (or DISMISSED)

**API:**
- GET /api/banq/alerts/:campaign_id -- list alerts (filterable by status, severity)
- GET /api/banq/alerts -- staff: all alerts across campaigns (filterable)
- PUT /api/banq/alerts/:id -- update status (body: status)
- POST /api/banq/alerts/check -- internal: trigger alert evaluation for a campaign

**Alert engine (backend/banq-alert-engine.js):**
- Runs evaluation on demand (POST /api/banq/alerts/check)
- Checks each alert type against campaign data
- Cooldown: do not re-alert for same alert_type within cooldown window (config from banq_config)
- Deduplication: if unresolved alert of same type exists, do not create new one
- When alert fires: add ALERT_GENERATED event to timeline, log activity

**Rules:**
- Cooldown and dedup logic MUST use banq_config values, never hardcoded
- Alert messages must be human-readable: "Campaign spending faster than planned"
- Log activity: ALERT_CREATED, ALERT_ACKNOWLEDGED, ALERT_RESOLVED in banq_activity_log

**Files:**
- backend/banq-watch.js (route file)
- backend/banq-alert-engine.js (evaluation logic)
- backend/banq-routes.js (mount)
- dashboard.html or campaign.html (alert display)
- docs/BANQ-JS.md (add 2 entries)

**Acceptance:**
- Alert engine correctly identifies budget spending too fast/slow
- Cooldown prevents duplicate alerts within configured window
- Dedup prevents new alert when unresolved same-type alert exists
- Alerts appear in dashboard
- Alert status transitions work (NEW -> ACKNOWLEDGED -> RESOLVED)
- Placeholder: seed 2-3 alerts on demo campaign (1 CRITICAL, 1 MEDIUM, 1 INFO)

---

### Step 1.7: Campaign Health Score (weighted scoring algorithm)

**Module:** Monitoring & Health
**Risk:** MEDIUM-HIGH (scoring algorithm, depends on pacer, goals, watch, metrics)
**Depends on:** Steps 1.3, 1.4, 1.6

**Table:**
```sql
CREATE TABLE IF NOT EXISTS campaign_health_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  status TEXT NOT NULL,
  factor_breakdown TEXT,
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

**Scoring (0-100):**
- Ranges (from banq_config): 80-100 Healthy, 60-79 Watch, 40-59 Needs Attention, 0-39 Critical
- Weights (from banq_config, JSON):
  - budget_pacing: 25 -- from Budget Pacer state
  - goal_progress: 25 -- from Campaign Goals (current/target ratio)
  - delivery: 20 -- is campaign delivering impressions/clicks?
  - performance_trend: 20 -- recent metric change vs previous period
  - technical_status: 10 -- any delivery issues, tracking failures

**Intelligence output:**
- "Your campaign is healthy, but Banner B has declined by 18% over the last three days."
- "Your campaign needs attention. Budget is pacing too fast and goal progress is behind schedule."

**API:**
- GET /api/banq/health/:campaign_id -- current score + status + breakdown
- POST /api/banq/health/:campaign_id/calculate -- internal: recalculate score
- GET /api/banq/health/:campaign_id/history -- historical scores for graphing

**Rules:**
- Weights MUST come from banq_config, never hardcoded
- Store every calculation in campaign_health_scores for historical graphing
- If insufficient data: score = null, status = "INSUFFICIENT_DATA", message explains why
- Log activity: HEALTH_CALCULATED in banq_activity_log

**Files:**
- backend/banq-health.js (route file + scoring logic)
- backend/banq-config.js (config read helper -- reads banq_config table)
- backend/banq-routes.js (mount)
- campaign.html (replace health placeholder with real data)
- docs/BANQ-JS.md (add 2 entries)

**Acceptance:**
- Health score calculates correctly from budget pacer, goal progress, delivery, trend, technical
- Weights are configurable via banq_config (change a weight, recalculate, see different score)
- Historical scores stored and retrievable
- Insufficient data handled gracefully
- Placeholder: seed 5 days of historical scores on demo campaign (82, 78, 85, 80, 82)

---

### Step 1.8: BANQ Report Card (HEAVIEST -- depends on ALL Phase 1 modules)

**Module:** Reporting
**Risk:** MEDIUM (aggregation logic, depends on everything)
**Depends on:** Steps 1.1-1.7

**Table:**
```sql
CREATE TABLE IF NOT EXISTS banq_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  report_type TEXT NOT NULL,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  period_start DATETIME,
  period_end DATETIME,
  data_snapshot TEXT NOT NULL,
  generated_by INTEGER,
  status TEXT DEFAULT 'generated',
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (generated_by) REFERENCES users(id)
);
```

**Report content:**
- Campaign name, goal, overall result (Strong/Watch/Needs Attention)
- Best creative (placeholder until Phase 2)
- Best day (from metrics)
- Key finding (from health score + alerts)
- BANQ recommendation (from health + budget + goals)
- Items requiring attention count

**API:**
- GET /api/banq/report/:campaign_id -- latest report
- POST /api/banq/report/generate -- generate report (body: campaign_id, report_type, period_start, period_end)
- GET /api/banq/report/:campaign_id/history -- list all reports for campaign

**Rules:**
- Once generated, preserves data snapshot. Later metric corrections do NOT rewrite history.
- Report must be understandable without an advertising degree.
- Log activity: REPORT_GENERATED, REPORT_VIEWED in banq_activity_log

**Files:**
- backend/banq-reports.js (route file + report generation logic)
- backend/banq-routes.js (mount)
- campaign.html (report section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Report generates with real data from health, budget, goals, alerts, timeline
- Data snapshot preserved (changing metrics later does not alter the report)
- Report reads in plain English
- Placeholder: generate 1 sample report on demo campaign

---

### Phase 1 Additional Infrastructure (build alongside steps)

**BANQ Work Queue** (alongside 1.6-1.7):
- Staff workspace view: CRITICAL / NEEDS_ATTENTION / WATCH / HEALTHY counts
- Filter by: analyst, campaign status, alert severity, service plan, date, client
- Default sort: CRITICAL > HIGH > MEDIUM > RECENTLY_CHANGED
- API: GET /api/banq/work-queue
- Files: backend/banq-work-queue.js, campaign.html or dashboard.html

**Notifications** (alongside 1.6):
- In-App only initially. Architecture for future Email/Push/SMS.
- Types: campaign launched, BANQ activated, important alert, goal reached, campaign ending, BANQ note received, campaign completed
- Cooldown from banq_config
- Table: banq_notifications (id, user_id, campaign_id, type, message, read, created_at)
- API: GET /api/banq/notifications, PUT /api/banq/notifications/:id/read

**BANQ Service Lifecycle** (alongside Pre-Build):
- States: NOT_SELECTED -> OFFERED -> OPTED_IN -> PAYMENT_CONFIRMED -> ACTIVE -> MONITORING -> COMPLETED
- Additional: PAUSED, CANCELLED, EXPIRED, SUSPENDED
- Only ACTIVE/MONITORING subscriptions appear in work queue
- Implemented in banq_service_subscriptions table (Pre-Step 0.3)

**Revenue Records** (alongside Pre-Build):
- Table: banq_revenue_ledger (id, campaign_id, advertiser_id, banq_plan, advertising_budget, banq_service_fee, payment_status, refund_amount, settlement_status, created_at)
- BANQ revenue SEPARATE from advertising budget
- Settlement: PENDING, APPROVED, SETTLED, ON_HOLD, ADJUSTED
- API: GET /api/banq/revenue (staff), GET /api/banq/revenue/:campaign_id

**Admin Configuration UI** (alongside 1.7):
- Read/update banq_config table
- API: GET /api/banq/config, PUT /api/banq/config/:key
- Only banqadmin can access

**Security Rules:**
- BANQ staff access ONLY: opted-in advertisers, assigned campaigns, service-required data
- NO access to: non-BANQ advertisers, QWK admin systems, Publisher Network admin, private platform data
- Every sensitive action logged in banq_activity_log

**Phase 1 Commit Checkpoint:** Commit all Phase 1 work. Update AGENTS.md Section 2. Update BANQ-MASTER-PIPELINE.md.

---

## PHASE 2 -- UNDERSTAND: "What changed and what should I consider?"

**Goal:** Transform from monitoring into intelligence and action.
**Phase 1 answers:** "What is happening?"
**Phase 2 answers:** "What is performing best? What changed? What should I do next?"

### Phase 2 Steps (Easiest to Heaviest)

---

### Step 2.1: Creative Intelligence (EASIEST -- foundational data structure)

**Module:** Creative Intelligence
**Risk:** LOW (new tables, new file)
**Depends on:** Phase 1 complete

**Tables:**
```sql
CREATE TABLE IF NOT EXISTS ad_creatives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  creative_name TEXT NOT NULL,
  creative_type TEXT NOT NULL DEFAULT 'IMAGE',
  creative_status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  activated_at DATETIME,
  deactivated_at DATETIME,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE TABLE IF NOT EXISTS creative_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creative_id INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  source TEXT DEFAULT 'system',
  FOREIGN KEY (creative_id) REFERENCES ad_creatives(id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE TABLE IF NOT EXISTS creative_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creative_id INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  actor_id INTEGER,
  actor_type TEXT,
  reason TEXT,
  metadata TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creative_id) REFERENCES ad_creatives(id)
);
```

**Creative types:** IMAGE, BANNER, VIDEO, TEXT, OTHER
**Creative status:** active, paused, deactivated, replaced
**Status history actions:** ADDED, PAUSED, RESUMED, REMOVED, REPLACED, BUDGET_CHANGED

**API:**
- GET /api/banq/creatives/:campaign_id -- list creatives
- POST /api/banq/creatives -- create creative
- PUT /api/banq/creatives/:id -- update creative status
- GET /api/banq/creatives/:id/metrics -- creative metrics
- POST /api/banq/creatives/:id/status -- record status change (adds to status_history + timeline)

**Rules:**
- Every creative status change adds CREATIVE_ADDED/PAUSED/RESUMED event to timeline
- Every status change logged in creative_status_history
- This data feeds What Changed? (Step 2.3) and Creative Battle (Step 2.5)
- Log activity: CREATIVE_CREATED, CREATIVE_STATUS_CHANGED in banq_activity_log

**Files:**
- backend/banq-creatives.js (route file)
- backend/banq-routes.js (mount)
- campaign.html (creative section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Creatives can be created, listed, paused, resumed
- Each creative has its own metrics
- Status changes recorded in history and timeline
- Placeholder: seed 3 creatives on demo campaign (Banner A, Banner B, Video A) with metrics

---

### Step 2.2: Creative Performance Score

**Module:** Creative Intelligence
**Risk:** MEDIUM (scoring algorithm, configurable weights)
**Depends on:** Step 2.1

**Table:**
```sql
CREATE TABLE IF NOT EXISTS creative_performance_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creative_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  status TEXT NOT NULL,
  factor_breakdown TEXT,
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creative_id) REFERENCES ad_creatives(id)
);
```

**Score (0-100) with configurable weights from banq_config:**
- engagement_weight, click_weight, conversion_weight, cost_efficiency_weight, goal_contribution_weight, trend_weight
- Different campaign goals need different weighting (awareness vs conversion)

**Status:** STRONG, STABLE, WATCH, DECLINING, INSUFFICIENT_DATA

**API:**
- GET /api/banq/creatives/:id/score -- current score + breakdown
- POST /api/banq/creatives/:id/score/calculate -- internal: recalculate
- GET /api/banq/creatives/:id/score/history -- historical scores

**Rules:**
- Weights from banq_config, never hardcoded
- If insufficient data: INSUFFICIENT_DATA, no score
- Different weighting for different campaign goals (configurable)
- Log activity: CREATIVE_SCORE_CALCULATED

**Files:**
- backend/banq-creative-score.js (route + scoring logic)
- backend/banq-config.js (add creative score weight configs)
- backend/banq-routes.js (mount)
- campaign.html (creative score display)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Score calculates from creative metrics with configurable weights
- Status correctly reflects performance level
- Insufficient data handled
- Placeholder: seed scores for demo creatives (91, 74, 52)

---

### Step 2.3: What Changed? (comparison analysis)

**Module:** Recommendations & Actions
**Risk:** MEDIUM (comparison logic, period selection)
**Depends on:** Steps 2.1, 1.2 (timeline), 1.4 (budget)

**Logic (no new table -- calculated from existing data):**

Comparison periods:
- Last 24h vs Previous 24h
- Last 7d vs Previous 7d
- Last 30d vs Previous 30d
- Custom range

**Identifies observable changes:**
- Spend increased/decreased
- Impressions changed
- Click activity changed
- Engagement changed
- Creative added/paused
- Budget changed
- Campaign paused/resumed
- Goal changed

**CRITICAL RULE: Separate OBSERVED FACTS from POSSIBLE FACTORS.**
- OBSERVED: "Clicks decreased by 18%"
- POSSIBLE CONTRIBUTING FACTORS: "Banner A also showed declining engagement during the same period"
- NEVER claim causation. Labels: OBSERVED, POSSIBLE CONTRIBUTING FACTORS, REQUIRES FURTHER REVIEW

**API:**
- GET /api/banq/what-changed/:campaign_id?period=24h -- comparison analysis
- Auto-selects relevant default when launched from an alert

**Files:**
- backend/banq-what-changed.js (route + comparison logic)
- backend/banq-routes.js (mount)
- campaign.html (what changed section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Correctly identifies metric changes between periods
- Clearly separates observed facts from possible factors
- Never claims causation
- Works when launched from alert (auto-selects period)
- Placeholder: seed demo data showing a 22% performance drop with contributing factors

---

### Step 2.4: Ad Fatigue Detector

**Module:** Monitoring & Health
**Risk:** MEDIUM (rule-based detection, depends on creative metrics)
**Depends on:** Step 2.1

**Table:**
```sql
CREATE TABLE IF NOT EXISTS creative_fatigue_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  creative_id INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'POSSIBLE_FATIGUE',
  detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  metadata TEXT,
  FOREIGN KEY (creative_id) REFERENCES ad_creatives(id),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

**Indicators:**
- Sustained engagement decline
- Sustained click decline
- Sustained conversion decline
- High exposure + declining response
- Long active duration + weakening performance

**States:** NO_FATIGUE_DETECTED, POSSIBLE_FATIGUE, FATIGUE_UNDER_REVIEW, ACTION_TAKEN

**Admin-configurable (from banq_config):**
- fatigue_detection_enabled, minimum_active_days, minimum_impressions, decline_threshold, consecutive_decline_periods, comparison_window

**API:**
- GET /api/banq/fatigue/:campaign_id -- list fatigue events
- POST /api/banq/fatigue/check -- internal: run fatigue detection
- PUT /api/banq/fatigue/:id -- update state (resolve, mark under review, action taken)

**Rules:**
- Use "Possible Creative Fatigue" unless confidence meets threshold
- When action taken: add CREATIVE_PAUSED event to timeline with reason
- Log activity: FATIGUE_DETECTED, FATIGUE_RESOLVED in banq_activity_log

**Files:**
- backend/banq-fatigue.js (route + detection logic)
- backend/banq-config.js (add fatigue configs)
- backend/banq-routes.js (mount)
- campaign.html (fatigue section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Detects sustained decline in creative metrics
- Uses configurable thresholds from banq_config
- "Possible Creative Fatigue" language used
- Actions recorded in timeline
- Placeholder: seed 1 fatigue event on demo creative (Banner A, 6-day decline)

---

### Step 2.5: Creative Battle (comparison UI + logic)

**Module:** Creative Intelligence
**Risk:** MEDIUM (comparison UI, depends on creative scores + data rules)
**Depends on:** Steps 2.1, 2.2

**Logic (no new table -- calculated from creative scores and metrics):**

- Compares 2+ creatives running within a campaign
- Displays: performance score, key metrics, trend, time active, goal contribution
- Ranking with medals (1st, 2nd, 3rd)
- Advertiser selects: Compare All or Select Creatives (A vs B)
- Minimum data (configurable from banq_config): min_impressions, min_clicks, min_runtime, min_conversions
- If insufficient: INSUFFICIENT_DATA or EARLY_RESULT. Do NOT call winner prematurely.

**API:**
- GET /api/banq/creative-battle/:campaign_id -- all creatives ranked
- POST /api/banq/creative-battle -- compare selected (body: creative_ids[])

**Files:**
- backend/banq-creative-battle.js (route + comparison logic)
- backend/banq-routes.js (mount)
- campaign.html (creative battle section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Compares creatives with scores, metrics, trends
- Ranking displays correctly
- Insufficient data shown when thresholds not met
- Advertiser can select specific creatives to compare
- Placeholder: seed battle data for 3 demo creatives with rankings

---

### Step 2.6: BANQ Recommends (recommendation engine)

**Module:** Recommendations & Actions
**Risk:** MEDIUM-HIGH (recommendation generation logic, confidence levels)
**Depends on:** Steps 2.1, 2.2, 2.4 (fatigue), 1.6 (alerts)

**Table:**
```sql
CREATE TABLE IF NOT EXISTS banq_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  recommendation_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reason TEXT,
  supporting_data TEXT,
  confidence_level TEXT DEFAULT 'MODERATE',
  source TEXT DEFAULT 'SYSTEM',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  status TEXT DEFAULT 'NEW',
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

**Recommendation types:**
CREATIVE_REVIEW, CREATIVE_PAUSE, CREATIVE_TEST, BUDGET_REVIEW,
BUDGET_REALLOCATION, CAMPAIGN_EXTENSION, GOAL_REVIEW,
PERFORMANCE_INVESTIGATION, MONITORING_ONLY

**Confidence:** HIGH, MODERATE, EARLY_SIGNAL

**Rules:**
- Every recommendation has "WHY AM I SEEING THIS?" with supporting data
- Language: "BANQ recommends considering..." NOT "This will improve..."
- Manual: "RECOMMENDED BY BANQ". System: "GENERATED BY BANQ INTELLIGENCE"
- No campaign-changing action silently. Advertiser must confirm.
- Log activity: RECOMMENDATION_CREATED, RECOMMENDATION_UPDATED in banq_activity_log

**API:**
- GET /api/banq/recommendations/:campaign_id -- list recommendations
- POST /api/banq/recommendations -- create (system or manual)
- GET /api/banq/recommendations/:id -- single recommendation with why

**Files:**
- backend/banq-recommendations.js (route + generation logic)
- backend/banq-routes.js (mount)
- campaign.html (recommendations section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- System generates recommendations from detected patterns (fatigue, budget, performance)
- Each recommendation shows why it was generated
- Confidence levels display correctly
- Manual vs system source visible
- Placeholder: seed 2-3 recommendations on demo campaign

---

### Step 2.7: Recommendation Approval Flow

**Module:** Recommendations & Actions
**Risk:** MEDIUM (workflow logic, state transitions)
**Depends on:** Step 2.6

**Tables:**
```sql
CREATE TABLE IF NOT EXISTS recommendation_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recommendation_id INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  actor_id INTEGER,
  metadata TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recommendation_id) REFERENCES banq_recommendations(id)
);

CREATE TABLE IF NOT EXISTS recommendation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recommendation_id INTEGER NOT NULL,
  status_from TEXT,
  status_to TEXT,
  changed_by INTEGER,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recommendation_id) REFERENCES banq_recommendations(id)
);
```

**Flow:**
PATTERN_DETECTED -> Recommendation Generated -> Optional BANQ Review ->
Advertiser Views -> Accept / Review / Dismiss -> Confirm -> Action Applied ->
Timeline Updated

**Status:** NEW, VIEWED, ACCEPTED, DECLINED, DISMISSED, EXPIRED, COMPLETED

**API:**
- POST /api/banq/recommendations/:id/accept -- accept recommendation
- POST /api/banq/recommendations/:id/dismiss -- dismiss recommendation
- POST /api/banq/recommendations/:id/review -- mark as reviewed
- GET /api/banq/recommendations/:id/history -- decision history

**Rules:**
- Every decision recorded in recommendation_history
- Accepted campaign-changing actions add event to timeline
- Expired recommendations require revalidation before action
- Log activity: RECOMMENDATION_ACCEPTED, RECOMMENDATION_DISMISSED in banq_activity_log

**Files:**
- backend/banq-recommendation-flow.js (route + flow logic)
- backend/banq-routes.js (mount)
- campaign.html (recommendation action buttons)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Accept/Dismiss/Review flows work
- Every decision recorded in history
- Accepted actions update timeline
- Expired recommendations cannot be acted on without revalidation
- Placeholder: seed 1 accepted, 1 dismissed recommendation on demo campaign

---

### Step 2.8: BANQ Action Center (HEAVIEST -- unified workspace)

**Module:** Recommendations & Actions
**Risk:** MEDIUM-HIGH (aggregation, priority logic, filtering)
**Depends on:** Steps 2.3, 2.4, 2.6, 2.7, 1.6 (alerts)

**Logic (no new table -- aggregates from alerts, recommendations, fatigue, health):**

**Priority levels:**
CRITICAL, REQUIRES_ATTENTION, RECOMMENDED, MONITOR, INFORMATION

**Action card structure:**
- Status icon, title, short description, why?, suggested action
- [Primary Action], [View Details]

**Filters:**
All, Critical, Recommendations, Creative, Budget, Goals, Monitoring, Completed

**BANQ staff filters:**
System Recommendations, Pending Review, Client Action Required,
Accepted, Dismissed, Completed

**BANQ manager view:**
Most Common Recommendation, Most Accepted, Most Dismissed,
Campaigns Requiring Human Review

**Rules:**
- Do not overwhelm advertiser with every data point
- Dismissed items remain in history
- Avoid generating 5 recommendations for same problem -- group related ones
- Log activity: ACTION_CENTER_VIEWED in banq_activity_log

**API:**
- GET /api/banq/action-center/:campaign_id -- advertiser view
- GET /api/banq/action-center -- staff view (all campaigns)
- POST /api/banq/action-center/:id/dismiss -- dismiss action item

**Files:**
- backend/banq-action-center.js (route + aggregation logic)
- backend/banq-routes.js (mount)
- campaign.html (action center section -- becomes home for BANQ-monitored campaigns)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Action center aggregates alerts, recommendations, fatigue events
- Priority sorting correct (CRITICAL first)
- Filters work
- Advertiser can dismiss items (remain in history)
- BANQ staff view shows all campaigns
- BANQ manager view shows analytics
- Placeholder: seed 4 action items (1 critical, 2 recommended, 1 monitor)

---

### Phase 2 Rules

**Creative Action History** (alongside 2.1): Track Added, Paused, Resumed, Removed, Replaced, Budget Changed. Feeds What Changed?

**Alerts vs Recommendations:** ALERT = awareness. RECOMMENDATION = suggested action. Alert may generate recommendation, but not every alert needs one. NEVER combine these concepts.

**Edge Cases:**
- New creative: don't compare unfairly with one that has months of data
- Paused creative: stop evaluation, preserve history
- Insufficient data: show INSUFFICIENT_DATA, no strong recommendations
- Conflicting signals: explain both, don't auto-label
- Multiple recommendations for same problem: group them
- Expired recommendation: revalidate before action

**Phase 2 Commit Checkpoint:** Commit all Phase 2 work. Update AGENTS.md Section 2. Update BANQ-MASTER-PIPELINE.md.

---

## PHASE 3 -- LEARN: "What happens across the journey, what can we test?"

**Goal:** Look beyond the advertisement. Follow the journey from exposure to
action, test ideas, learn across campaigns, manage multiple brands.

### Phase 3 Steps (Easiest to Heaviest)

---

### Step 3.1: Journey Event Types and Tracking (EASIEST -- data structure only)

**Module:** Journey Intelligence
**Risk:** LOW (new tables, no UI, no analysis)
**Depends on:** Phase 2 complete

**Tables:**
```sql
CREATE TABLE IF NOT EXISTS journey_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  advertiser_id INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  event_description TEXT,
  event_value REAL,
  event_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  source TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
  FOREIGN KEY (advertiser_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS journey_event_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  quality_status TEXT DEFAULT 'TRACKED',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Standard event types:**
IMPRESSION, CLICK, ENGAGEMENT, VIDEO_VIEW, LANDING_PAGE_VISIT,
SIGN_UP, LEAD, CONTACT, DOWNLOAD, BOOKING, PURCHASE, CUSTOM_EVENT

**Custom events:** advertiser-defined names (e.g., HOTEL_ROOM_SEARCHED, PROPERTY_VIEWED)

**Quality status:** VERIFIED, TRACKED, ESTIMATED, DELAYED, UNAVAILABLE

**Rules:**
- Do not combine estimated with verified without clear labelling
- If tracking fails: display "TRACKING DATA UNAVAILABLE" not zero
- Log activity: JOURNEY_EVENT_RECORDED in banq_activity_log

**API:**
- POST /api/banq/journey/events -- record event
- GET /api/banq/journey/events/:campaign_id -- list events

**Files:**
- backend/banq-journey.js (route file)
- backend/banq-routes.js (mount)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Events can be recorded and retrieved
- Custom event names supported
- Source quality tracked
- Placeholder: seed 5-6 journey events on demo campaign (impression -> click -> landing -> signup -> purchase)

---

### Step 3.2: Journey Configuration (setup UI for journey paths)

**Module:** Journey Intelligence
**Risk:** LOW (new table, setup UI)
**Depends on:** Step 3.1

**Table:**
```sql
CREATE TABLE IF NOT EXISTS journey_configurations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  primary_goal TEXT,
  secondary_goals TEXT,
  journey_steps TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

**Rules:**
- Advertiser defines: PRIMARY GOAL, SECONDARY GOALS, JOURNEY EVENTS (ordered)
- Do not assume linear journey. Support different paths.
- Log activity: JOURNEY_CONFIGURED in banq_activity_log

**API:**
- GET /api/banq/journey/configure/:campaign_id -- get configuration
- POST /api/banq/journey/configure -- create/update configuration

**Files:**
- backend/banq-journey.js (extend)
- campaign.html (journey configuration section)
- docs/BANQ-JS.md (update entry)

**Acceptance:**
- Advertiser can define journey steps
- Non-linear paths supported
- Placeholder: seed 1 journey config on demo campaign (Hotel: Ad View -> Website -> Room Search -> Booking)

---

### Step 3.3: Journey Drop-Off Analysis (analysis logic)

**Module:** Journey Intelligence
**Risk:** MEDIUM (analysis logic, comparison support)
**Depends on:** Steps 3.1, 3.2

**Logic (no new table -- calculated from journey_events):**

- Identifies largest drop-off: "LARGEST DROP-OFF: Landing Page -> Sign-Up: 72% decrease"
- Describe as observed, NOT why. "Further investigation may be required."
- Journey comparison: This Week vs Last Week, Campaign A vs B, Creative A vs B, Mobile vs Desktop, Custom

**Rules:**
- Must describe as observed drop-off, NOT claim why
- If tracking data unavailable for a stage: show "TRACKING DATA UNAVAILABLE"
- Log activity: JOURNEY_ANALYSIS_VIEWED in banq_activity_log

**API:**
- GET /api/banq/journey/dropoff/:campaign_id -- drop-off analysis
- GET /api/banq/journey/compare -- compare journeys (body: campaign_ids[], or periods)

**Files:**
- backend/banq-journey.js (extend)
- campaign.html (drop-off visualization)
- docs/BANQ-JS.md (update entry)

**Acceptance:**
- Correctly identifies drop-off points between journey stages
- Comparison between periods/campaigns/creatives works
- Never claims causation for drop-offs
- Placeholder: seed demo data showing 100K impressions -> 8.5K clicks -> 6.9K landing -> 820 signups -> 143 purchases

---

### Step 3.4: Experiment Lab (experiment creation + management)

**Module:** Journey Intelligence
**Risk:** MEDIUM (experiment lifecycle, variant management)
**Depends on:** Steps 2.1 (creatives), 3.1

**Tables:**
```sql
CREATE TABLE IF NOT EXISTS experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  experiment_type TEXT NOT NULL,
  name TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  primary_metric TEXT NOT NULL,
  secondary_metrics TEXT,
  start_date DATETIME,
  end_date DATETIME,
  status TEXT DEFAULT 'DRAFT',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE TABLE IF NOT EXISTS experiment_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id INTEGER NOT NULL,
  creative_id INTEGER,
  variant_name TEXT NOT NULL,
  configuration TEXT,
  traffic_allocation TEXT DEFAULT '50/50',
  status TEXT DEFAULT 'control',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id),
  FOREIGN KEY (creative_id) REFERENCES ad_creatives(id)
);
```

**Experiment types:** CREATIVE, HEADLINE, CTA, LANDING_PAGE, AUDIENCE, PLACEMENT, BUDGET
**Traffic allocation:** 50/50, 60/40, 70/30, Custom
**Status:** DRAFT, READY, RUNNING, PAUSED, COMPLETED, CANCELLED, INVALID

**Rules:**
- Hypothesis REQUIRED (not just "A vs B")
- Log activity: EXPERIMENT_CREATED, EXPERIMENT_STARTED in banq_activity_log

**API:**
- POST /api/banq/experiments -- create experiment
- GET /api/banq/experiments/:campaign_id -- list experiments
- PUT /api/banq/experiments/:id -- update (start, pause, complete, cancel)
- POST /api/banq/experiments/:id/variants -- add variant

**Files:**
- backend/banq-experiments.js (route + lifecycle logic)
- backend/banq-routes.js (mount)
- campaign.html (experiment section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Experiment with hypothesis can be created
- Variants with traffic allocation can be added
- Lifecycle transitions work (DRAFT -> READY -> RUNNING -> COMPLETED)
- Placeholder: seed 1 experiment on demo campaign (Video vs Banner, hypothesis: "Video generates more booking activity")

---

### Step 3.5: Experiment Results (result analysis with minimum data rules)

**Module:** Journey Intelligence
**Risk:** MEDIUM (statistical analysis, cautious labelling)
**Depends on:** Step 3.4

**Table:**
```sql
CREATE TABLE IF NOT EXISTS experiment_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  experiment_id INTEGER NOT NULL,
  variant_id INTEGER NOT NULL,
  primary_metric_value REAL,
  secondary_metrics TEXT,
  confidence_level TEXT,
  result_status TEXT,
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (experiment_id) REFERENCES experiments(id),
  FOREIGN KEY (variant_id) REFERENCES experiment_variants(id)
);
```

**Minimum data (configurable from banq_config):**
- min_runtime, min_impressions, min_conversions, min_sample_size

**Before requirements met:**
"EXPERIMENT IN PROGRESS -- More data is required before drawing a reliable conclusion."

**Result labels (cautious):**
EARLY_SIGNAL, POSITIVE_SIGNAL, NO_MEANINGFUL_DIFFERENCE, NEGATIVE_SIGNAL, INCONCLUSIVE

**Decisions:** Keep Control, Adopt Variant, Run Another Test, Ask BANQ, Archive

**Rules:**
- Do NOT display "Winner" prematurely
- All decisions added to Experiment History, Campaign Timeline, Activity Log
- Log activity: EXPERIMENT_RESULT_CALCULATED, EXPERIMENT_DECISION in banq_activity_log

**API:**
- GET /api/banq/experiments/:id/results -- current results
- POST /api/banq/experiments/:id/decision -- record decision

**Files:**
- backend/banq-experiments.js (extend)
- campaign.html (experiment results section)
- docs/BANQ-JS.md (update entry)

**Acceptance:**
- Results show "IN PROGRESS" when minimum data not met
- Cautious labels used (never "Winner" prematurely)
- Decisions recorded in history and timeline
- Placeholder: seed 1 completed experiment result (Variant B, +18.4%, POSITIVE_SIGNAL)

---

### Step 3.6: Campaign Benchmarking (aggregated comparison, privacy-critical)

**Module:** Enterprise & Future Intelligence
**Risk:** MEDIUM-HIGH (aggregation logic, privacy rules)
**Depends on:** Phase 1 metrics, multiple campaigns exist

**Tables:**
```sql
CREATE TABLE IF NOT EXISTS benchmark_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_type TEXT NOT NULL,
  criteria TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS benchmark_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sample_count INTEGER,
  FOREIGN KEY (group_id) REFERENCES benchmark_groups(id)
);
```

**Group by:** INDUSTRY, CAMPAIGN_GOAL, CAMPAIGN_TYPE, AD_FORMAT, BUDGET_RANGE, REGION, TIME_PERIOD

**PRIVACY RULE:**
- NEVER expose another advertiser's name, campaign, individual metrics, or confidential data
- Aggregated data ONLY
- If insufficient data: "BENCHMARK NOT AVAILABLE". Do not create fake averages.

**Configurable (from banq_config):**
- min_campaign_count, min_data_volume, min_recency, min_group_similarity
- Freshness: Last 30 Days, Last 90 Days, Last 12 Months

**API:**
- GET /api/banq/benchmark/:campaign_id -- benchmark comparison

**Files:**
- backend/banq-benchmark.js (route + aggregation logic)
- backend/banq-routes.js (mount)
- campaign.html (benchmark section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Benchmark shows aggregated range for similar campaigns
- Privacy rules enforced (no individual data exposed)
- "BENCHMARK NOT AVAILABLE" when insufficient data
- Placeholder: seed 1 benchmark group (Hotel campaigns, avg score 71, demo campaign at 82)

---

### Step 3.7: Cross-Campaign Intelligence (pattern detection)

**Module:** Enterprise & Future Intelligence
**Risk:** MEDIUM (pattern detection across campaigns)
**Depends on:** Multiple campaigns exist, Phase 2 creatives

**Table:**
```sql
CREATE TABLE IF NOT EXISTS cross_campaign_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  advertiser_id INTEGER NOT NULL,
  insight_type TEXT NOT NULL,
  description TEXT NOT NULL,
  supporting_campaigns TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (advertiser_id) REFERENCES users(id)
);
```

**Insight types:**
BEST_PERFORMING_CREATIVE_TYPE, BEST_PERFORMING_TIME_PERIOD,
STRONGEST_CAMPAIGN, WEAKEST_TREND, RECURRING_ALERT,
COMMON_GOAL_PROBLEM, TOP_JOURNEY_PATH

**Rules:**
- Labelled as observed pattern, NOT guaranteed strategy
- Advertiser can click "VIEW SUPPORTING CAMPAIGNS"
- Log activity: CROSS_CAMPAIGN_INSIGHT_VIEWED in banq_activity_log

**API:**
- GET /api/banq/cross-campaign/:advertiser_id -- all insights

**Files:**
- backend/banq-cross-campaign.js (route + pattern detection)
- backend/banq-routes.js (mount)
- campaign.html or dashboard.html (cross-campaign section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Detects patterns across advertiser's campaigns
- Insights labelled as observed, not guaranteed
- Supporting campaigns viewable
- Placeholder: seed 1 insight ("Video creatives produce highest average engagement across last 5 campaigns")

---

### Step 3.8: Enterprise Multi-Brand Dashboard (complex permissions)

**Module:** Enterprise & Future Intelligence
**Risk:** HIGH (new page, complex role permissions, nav update -- Rule 18)
**Depends on:** Phase 1-2 complete

**Tables:**
```sql
CREATE TABLE IF NOT EXISTS enterprise_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enterprise_brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enterprise_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  qap_number TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enterprise_id) REFERENCES enterprise_accounts(id)
);

CREATE TABLE IF NOT EXISTS enterprise_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  enterprise_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  brand_scope TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (enterprise_id) REFERENCES enterprise_accounts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Roles:** ENTERPRISE_OWNER, ENTERPRISE_ADMIN, BRAND_MANAGER, CAMPAIGN_MANAGER, ANALYST, VIEWER

**Rules:**
- Brand Manager should NOT automatically see all brands
- Drill-down: Enterprise -> Brand -> Campaign -> Creative -> Journey
- Cross-brand comparison (enterprise-level permission only)
- Log activity: ENTERPRISE_VIEWED in banq_activity_log

**API:**
- GET /api/banq/enterprise/:enterprise_id -- enterprise overview
- GET /api/banq/enterprise/:id/brands -- brands list
- POST /api/banq/enterprise -- create enterprise account
- POST /api/banq/enterprise/:id/brands -- add brand
- POST /api/banq/enterprise/:id/members -- add member

**Files:**
- backend/banq-enterprise.js (route + permission logic)
- backend/banq-routes.js (mount)
- enterprise.html (new page -- Rule 18 nav update on ALL pages)
- ALL HTML files (nav update)
- docs/AGENTS.md (directory map)
- docs/BANQ-JS.md (add entry)
- docs/BANQ-MASTER-PIPELINE.md (add task)

**Acceptance:**
- Enterprise account with multiple brands can be created
- Role-based access enforced (Brand Manager sees only assigned brands)
- Drill-down navigation works
- Cross-brand comparison available to enterprise-level roles only
- Placeholder: seed 1 enterprise account with 3 brands

---

### Step 3.9: BANQ Team Workspace (HEAVIEST -- depends on everything)

**Module:** BANQ Human Service
**Risk:** HIGH (new page, operational workspace, depends on all Phase 1-3)
**Depends on:** All Phase 1-3 steps

**Table:**
```sql
CREATE TABLE IF NOT EXISTS banq_client_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  advertiser_id INTEGER NOT NULL,
  campaign_id INTEGER,
  assigned_to INTEGER,
  priority TEXT DEFAULT 'NORMAL',
  status TEXT DEFAULT 'NEW',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (advertiser_id) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id)
);
```

**Request statuses:** NEW, ASSIGNED, IN_REVIEW, AWAITING_CLIENT, COMPLETED, CLOSED

**Staff workspace:**
My Clients, My Campaigns, Unassigned Campaigns, Critical Alerts,
Pending Questions, Pending Recommendations, Experiments Running

**Client workspace:**
Company, Brands, Active Campaigns, Requiring Attention, Open Requests, Active Experiments

**BANQ internal collaboration:**
Internal notes, mentions, assignments, status changes (invisible to advertisers)

**Navigation:** Client -> Brand -> Campaign -> Creative -> Experiment

**API:**
- GET /api/banq/workspace -- staff workspace overview
- GET /api/banq/workspace/client/:client_id -- client workspace
- POST /api/banq/workspace/requests -- create client request
- PUT /api/banq/workspace/requests/:id -- update request status

**Files:**
- backend/banq-workspace.js (route + workspace logic)
- backend/banq-routes.js (mount)
- workspace.html (new page -- Rule 18 nav update on ALL pages)
- ALL HTML files (nav update)
- docs/AGENTS.md (directory map)
- docs/BANQ-JS.md (add entry)
- docs/BANQ-MASTER-PIPELINE.md (add task)

**Acceptance:**
- Staff can see all monitored campaigns with priority sorting
- Client workspace shows per-client overview
- Requests can be created, assigned, updated
- Internal collaboration invisible to advertisers
- Placeholder: seed 1 client with 2 campaigns, 1 open request

---

### Phase 3 Edge Cases

- No conversion tracking: Journey Map shows only available events
- Multiple campaigns contribute to one conversion: do not auto-assign full credit. Mark attribution limitations.
- Experiment interrupted: mark PAUSED, CANCELLED, or INVALID. Do not treat incomplete as conclusive.
- Enterprise brand removed: preserve historical data and audit history.
- Benchmark group too small: remove or disable, do not expose unreliable results.

**Phase 3 Commit Checkpoint:** Commit all Phase 3 work. Update AGENTS.md Section 2. Update BANQ-MASTER-PIPELINE.md.

---

## PHASE 4 -- PLAN: "What could happen, what should we prepare?"

**Goal:** Move from analysing existing campaigns to helping advertisers plan
before launch. Predictions and simulations must NEVER be presented as guarantees.

### Phase 4 Steps (Easiest to Heaviest)

---

### Step 4.1: Campaign Readiness Check (EASIEST -- checklist + scoring)

**Module:** Predictive Planning
**Risk:** LOW (new table, checklist logic)
**Depends on:** Phase 1 complete

**Table:**
```sql
CREATE TABLE IF NOT EXISTS campaign_readiness_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  score INTEGER,
  checks TEXT NOT NULL,
  state TEXT DEFAULT 'NOT_READY',
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

**Checks:**
Objective selected, budget configured, duration configured, creative attached,
goal configured, destination available, tracking configured, BANQ monitoring
selected, experiment configured, required approvals completed.

**States:** READY, READY_WITH_OBSERVATIONS, NEEDS_ATTENTION, NOT_READY

**Rules:**
- BANQ should not silently block campaigns unless true technical/policy requirement
- Advertiser controls whether to proceed where platform allows
- Log activity: READINESS_CHECKED in banq_activity_log

**API:**
- GET /api/banq/readiness/:campaign_id -- current readiness
- POST /api/banq/readiness/:campaign_id/check -- recalculate

**Files:**
- backend/banq-readiness.js (route + checklist logic)
- backend/banq-routes.js (mount)
- campaign.html or dashboard.html (readiness section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Readiness score calculates from campaign configuration
- States correctly reflect readiness level
- Specific missing items identified (e.g., "Website tracking not configured")
- Placeholder: seed 1 readiness check on demo campaign (87/100, READY_WITH_OBSERVATIONS)

---

### Step 4.2: Campaign Planner (planning workspace)

**Module:** Predictive Planning
**Risk:** LOW-MEDIUM (new table, plan generation)
**Depends on:** Step 4.1

**Table:**
```sql
CREATE TABLE IF NOT EXISTS campaign_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  advertiser_id INTEGER NOT NULL,
  campaign_name TEXT NOT NULL,
  objective TEXT NOT NULL,
  duration INTEGER,
  budget INTEGER,
  creative_type TEXT,
  target_audience TEXT,
  region TEXT,
  primary_goal TEXT,
  secondary_goals TEXT,
  recommended_structure TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (advertiser_id) REFERENCES users(id)
);
```

**Plan output:**
- Recommended number of creatives, primary video, supporting banners
- Weekly performance review schedule
- Journey tracking enabled
- Distinguish: SYSTEM_SUGGESTION, BANQ_RECOMMENDATION, ADVERTISER_DECISION

**API:**
- POST /api/banq/plans -- create plan
- GET /api/banq/plans/:advertiser_id -- list plans
- GET /api/banq/plans/:id -- single plan

**Files:**
- backend/banq-planner.js (route + plan generation)
- backend/banq-routes.js (mount)
- campaign.html or dashboard.html (planner section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Plan generates from advertiser inputs
- Recommendations clearly labelled (system vs BANQ vs advertiser)
- Placeholder: seed 1 plan on demo advertiser (Hotel Bookings, 30 days, 10K QC, 3 creatives)

---

### Step 4.3: Automated Reporting (report generation with scheduling)

**Module:** Reporting
**Risk:** MEDIUM (builds on Phase 1 Report Card, scheduling logic)
**Depends on:** Step 1.8

**Tables:**
```sql
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_type TEXT NOT NULL,
  campaign_id INTEGER,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  period_start DATETIME,
  period_end DATETIME,
  data_snapshot_reference TEXT,
  generated_by INTEGER,
  status TEXT DEFAULT 'generated',
  FOREIGN KEY (generated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS report_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id)
);
```

**Report types:** Campaign Summary, Weekly, Monthly, Campaign Completion, Enterprise Summary

**Generation modes:** GENERATE_NOW, SCHEDULED, AUTOMATIC_AT_CAMPAIGN_END

**Rules:**
- Once generated, preserves data snapshot. Later corrections do NOT rewrite.
- Future delivery: In-App, Download, Email (start with in-app)
- Log activity: REPORT_GENERATED, REPORT_VIEWED in banq_activity_log

**API:**
- POST /api/banq/reports/generate -- generate report
- GET /api/banq/reports/:campaign_id -- list reports
- GET /api/banq/reports/:id -- single report with snapshot

**Files:**
- backend/banq-reports.js (extend from Phase 1)
- campaign.html (report section)
- docs/BANQ-JS.md (update entry)

**Acceptance:**
- Reports generate on demand and scheduled
- Data snapshot preserved
- Multiple report types supported
- Placeholder: seed 1 weekly report on demo campaign

---

### Step 4.4: Placement Intelligence (placement profiles + comparison)

**Module:** Predictive Planning
**Risk:** MEDIUM (placement data, QWK controls inventory)
**Depends on:** Phase 1

**Tables:**
```sql
CREATE TABLE IF NOT EXISTS placement_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  publisher_category TEXT,
  placement_type TEXT,
  creative_format TEXT,
  region TEXT,
  device_type TEXT,
  historical_delivery_data TEXT,
  availability_status TEXT DEFAULT 'available',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS placement_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  placement_id INTEGER NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (placement_id) REFERENCES placement_profiles(id)
);
```

**Rules:**
- QWK Browser controls Publisher Network. BANQ analyses authorised data only.
- Do not expose confidential publisher-level information unless authorised.
- Log activity: PLACEMENT_VIEWED in banq_activity_log

**API:**
- GET /api/banq/placements -- list placements
- GET /api/banq/placements/compare -- compare placements (body: placement_ids[])

**Files:**
- backend/banq-placements.js (route + comparison logic)
- backend/banq-routes.js (mount)
- campaign.html or dashboard.html (placement section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Placement profiles display with available data
- Comparison between placements works
- No confidential publisher data exposed
- Placeholder: seed 3 placement profiles (Entertainment/Video, News/Banner, Sports/Mixed)

---

### Step 4.5: Predictive Alerts (predictive, different from Phase 1 alerts)

**Module:** Monitoring & Health
**Risk:** MEDIUM-HIGH (predictive logic, confidence levels)
**Depends on:** Steps 1.4, 1.6, 1.7

**Table:**
```sql
CREATE TABLE IF NOT EXISTS predictive_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  prediction_type TEXT NOT NULL,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  prediction_window TEXT,
  confidence_level TEXT,
  supporting_data TEXT,
  recommended_action TEXT,
  status TEXT DEFAULT 'ACTIVE',
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

**Types:**
POSSIBLE_BUDGET_EXHAUSTION, POSSIBLE_GOAL_SHORTFALL,
POSSIBLE_UNDERDELIVERY, POSSIBLE_CREATIVE_DECLINE,
POSSIBLE_TRACKING_ISSUE

**Status:** ACTIVE, UPDATED, RESOLVED, EXPIRED, DISMISSED

**Difference from Phase 1 alerts:**
- Phase 1: "Your campaign is spending faster than expected."
- Phase 4: "Based on the current spending pattern, the campaign may exhaust its budget before the scheduled end date."

**Rules:**
- Cautious language. Predictions, not guarantees.
- Recalculated as new campaign data arrives.
- Log activity: PREDICTIVE_ALERT_GENERATED in banq_activity_log

**API:**
- GET /api/banq/predictive-alerts/:campaign_id -- list predictive alerts
- POST /api/banq/predictive-alerts/check -- internal: run prediction evaluation

**Files:**
- backend/banq-predictive.js (route + prediction logic)
- backend/banq-routes.js (mount)
- campaign.html (predictive alerts section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Predictive alerts use cautious language
- Alerts update as new data arrives
- Different from Phase 1 reactive alerts
- Placeholder: seed 1 predictive alert (POSSIBLE_BUDGET_EXHAUSTION, MODERATE confidence)

---

### Step 4.6: Scenario Simulator (what-if analysis)

**Module:** Predictive Planning
**Risk:** HIGH (simulation logic, comparison, forecast ranges)
**Depends on:** Steps 4.2, 4.4

**Tables:**
```sql
CREATE TABLE IF NOT EXISTS campaign_scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  variables TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES campaign_plans(id)
);

CREATE TABLE IF NOT EXISTS scenario_simulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL,
  results TEXT NOT NULL,
  confidence_level TEXT,
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (scenario_id) REFERENCES campaign_scenarios(id)
);
```

**Variables:** budget, duration, creative_count, creative_mix, campaign_goal, placement_type, target_region

**Comparison:** A (10K/30d) vs B (15K/30d) vs C (10K/45d)

**Rules:**
- Focus on relative outcomes. Do not fabricate exact numbers.
- If sufficient data: show FORECAST RANGE (e.g., "8,000-12,000 Visits")
- Never display single forecast number as certainty
- Confidence: HIGH_DATA_SUPPORT, MODERATE, LIMITED, INSUFFICIENT
- "What If?" interaction: "What if I increase budget by 20%?" -> possible effects

**API:**
- POST /api/banq/scenarios -- create scenario
- GET /api/banq/scenarios/:plan_id -- list scenarios
- POST /api/banq/scenarios/:id/simulate -- run simulation

**Files:**
- backend/banq-simulator.js (route + simulation logic)
- backend/banq-routes.js (mount)
- campaign.html or dashboard.html (simulator section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Scenarios can be created with different variables
- Simulation produces relative comparison
- Forecast ranges shown with confidence levels
- Never shows single number as certainty
- Placeholder: seed 3 scenarios (A: 10K/30d, B: 15K/30d, C: 10K/45d) with results

---

### Step 4.7: Forecast Engine (forecasting with confidence, versioned)

**Module:** Predictive Planning
**Risk:** HIGH (forecasting models, versioning, historical reproducibility)
**Depends on:** Steps 4.5, 4.6

**Tables:**
```sql
CREATE TABLE IF NOT EXISTS forecasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER NOT NULL,
  forecast_type TEXT NOT NULL,
  forecast_range TEXT NOT NULL,
  confidence_level TEXT NOT NULL,
  model_version TEXT NOT NULL,
  generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  inputs TEXT,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

CREATE TABLE IF NOT EXISTS forecast_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  forecast_id INTEGER NOT NULL,
  recalculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  new_range TEXT,
  new_confidence TEXT,
  FOREIGN KEY (forecast_id) REFERENCES forecasts(id)
);
```

**Categories:**
Estimated Delivery Range, Estimated Budget Consumption Range,
Estimated Engagement Range, Estimated Goal Progress Range

**Rules:**
- Forecast rules account for: Campaign Goal, Duration, Budget, Creative Type, Historical Data, Placement Availability, Region, Seasonality
- Missing factors reduce confidence, never silently ignored
- Historical forecasts remain reproducible
- Log activity: FORECAST_GENERATED in banq_activity_log

**API:**
- GET /api/banq/forecast/:campaign_id -- current forecast
- POST /api/banq/forecast/:campaign_id/calculate -- recalculate
- GET /api/banq/forecast/:campaign_id/history -- historical forecasts

**Files:**
- backend/banq-forecast.js (route + forecast logic)
- backend/banq-routes.js (mount)
- campaign.html (forecast section)
- docs/BANQ-JS.md (add entry)

**Acceptance:**
- Forecast produces ranges with confidence levels
- Missing data reduces confidence (not ignored)
- Historical forecasts stored and retrievable
- Model version tracked
- Placeholder: seed 1 forecast on demo campaign (delivery: 8K-12K visits, MODERATE confidence)

---

### Step 4.8: BANQ Go-To-Market Workspace (HEAVIEST -- strategic layer)

**Module:** Enterprise & Future Intelligence
**Risk:** HIGH (new page, connects everything, nav update -- Rule 18)
**Depends on:** All Phase 1-4 steps

**Tables:**
```sql
CREATE TABLE IF NOT EXISTS gtm_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  advertiser_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  objective TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (advertiser_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS gtm_objectives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  primary_objective TEXT,
  secondary_objectives TEXT,
  success_metrics TEXT,
  target_dates TEXT,
  responsible_teams TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES gtm_projects(id)
);

CREATE TABLE IF NOT EXISTS gtm_timelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  stage TEXT NOT NULL,
  tasks TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES gtm_projects(id)
);

CREATE TABLE IF NOT EXISTS gtm_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  assigned_to INTEGER,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES gtm_projects(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS learning_archive (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  advertiser_id INTEGER NOT NULL,
  observation TEXT NOT NULL,
  evidence TEXT,
  status TEXT DEFAULT 'OBSERVED',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (advertiser_id) REFERENCES users(id)
);
```

**GTM stages:**
PLANNING -> CREATIVE_PREPARATION -> CAMPAIGN_LAUNCH -> OPTIMISATION ->
EXPERIMENTATION -> CAMPAIGN_REVIEW -> LEARNING_ARCHIVE

**Learning status:** OBSERVED -> TESTED -> REPEATED -> INCONCLUSIVE -> SUPERSEDED

**A GTM project can contain multiple campaigns.**

**Connects:**
BUSINESS_OBJECTIVE -> CAMPAIGN_STRATEGY -> CAMPAIGN_PLAN -> CREATIVE ->
AD_DELIVERY -> CUSTOMER_JOURNEY -> MEASUREMENT -> LEARNING

**Rules:**
- Learning is NOT a universal recommendation. It is a documented pattern within that advertiser's own history.
- Learning status prevents treating one successful campaign as permanent truth.
- Log activity: GTM_PROJECT_CREATED, LEARNING_RECORDED in banq_activity_log

**API:**
- POST /api/banq/gtm -- create GTM project
- GET /api/banq/gtm/:advertiser_id -- list projects
- GET /api/banq/gtm/:id -- single project with objectives, timeline, tasks
- POST /api/banq/gtm/:id/objectives -- set objectives
- POST /api/banq/gtm/:id/timeline -- set timeline
- POST /api/banq/gtm/:id/tasks -- create task
- GET /api/banq/learning/:advertiser_id -- learning archive
- POST /api/banq/learning -- add learning entry

**Files:**
- backend/banq-gtm.js (route + GTM logic)
- backend/banq-routes.js (mount)
- gtm.html (new page -- Rule 18 nav update on ALL pages)
- ALL HTML files (nav update)
- docs/AGENTS.md (directory map)
- docs/BANQ-JS.md (add entry)
- docs/BANQ-MASTER-PIPELINE.md (add task)

**Acceptance:**
- GTM project with multiple campaigns can be created
- Objectives, timeline, tasks managed
- Learning archive records observations with status progression
- Learning is advertiser-specific, not universal
- Placeholder: seed 1 GTM project (New Hotel Opening, 4 campaigns, 1 learning entry)

---

### Phase 4 AI / Intelligence Architecture Rule

Do not make the entire system dependent on an AI model. BANQ intelligence
supports multiple layers:

```
LAYER 1: Deterministic Rules (if budget > 110% expected -> SPENDING_FAST)
LAYER 2: Statistical Analysis (clicks decreased 18% vs previous period)
LAYER 3: Forecast Models (estimated delivery range: 8K-12K visits)
LAYER 4: AI-Generated Explanations (translate data into plain English)
```

AI must not invent metrics or causes. AI-generated explanations must only
use approved structured data.

### Phase 4 Human Override

BANQ analysts and authorised administrators can override or annotate:
recommendations, forecast interpretations, readiness observations, report
commentary. Original system output remains preserved. Both records visible.

**Phase 4 Commit Checkpoint:** Commit all Phase 4 work. Update AGENTS.md Section 2. Update BANQ-MASTER-PIPELINE.md.

---

## Summary: Full Build Order (All 4 Phases, Easiest to Heaviest)

### Phase 1 (8 steps + infrastructure)
1. Pre-Build: DB backup, banq_config, core tables, /api/banq route namespace
2. Step 1.1: Campaign Notes (EASIEST)
3. Step 1.2: Campaign Timeline
4. Step 1.3: Campaign Goals
5. Step 1.4: Budget Pacer
6. Step 1.5: Campaign Dashboard (new page + nav update)
7. Step 1.6: BANQ Watch (alert system)
8. Step 1.7: Campaign Health Score
9. Step 1.8: BANQ Report Card (HEAVIEST)
+ Infrastructure: Work Queue, Notifications, Revenue Ledger, Admin Config, Security

### Phase 2 (8 steps)
10. Step 2.1: Creative Intelligence (EASIEST)
11. Step 2.2: Creative Performance Score
12. Step 2.3: What Changed?
13. Step 2.4: Ad Fatigue Detector
14. Step 2.5: Creative Battle
15. Step 2.6: BANQ Recommends
16. Step 2.7: Recommendation Approval Flow
17. Step 2.8: BANQ Action Center (HEAVIEST)

### Phase 3 (9 steps)
18. Step 3.1: Journey Event Tracking (EASIEST)
19. Step 3.2: Journey Configuration
20. Step 3.3: Journey Drop-Off Analysis
21. Step 3.4: Experiment Lab
22. Step 3.5: Experiment Results
23. Step 3.6: Campaign Benchmarking
24. Step 3.7: Cross-Campaign Intelligence
25. Step 3.8: Enterprise Multi-Brand Dashboard (new page)
26. Step 3.9: BANQ Team Workspace (HEAVIEST, new page)

### Phase 4 (8 steps)
27. Step 4.1: Campaign Readiness Check (EASIEST)
28. Step 4.2: Campaign Planner
29. Step 4.3: Automated Reporting
30. Step 4.4: Placement Intelligence
31. Step 4.5: Predictive Alerts
32. Step 4.6: Scenario Simulator
33. Step 4.7: Forecast Engine
34. Step 4.8: BANQ Go-To-Market Workspace (HEAVIEST, new page)

**Total: 34 build steps across 4 phases.**
**New pages: campaign.html, enterprise.html, workspace.html, gtm.html.**
**New backend files: ~25 route/logic files under backend/banq-*.js.**
**New tables: ~40 tables across all phases.**

---

## Full Evolution

```
PHASE 1 -- MONITOR    "How is my campaign doing?"
PHASE 2 -- UNDERSTAND "What changed and what should I consider?"
PHASE 3 -- LEARN      "What happens across the journey, what can I test?"
PHASE 4 -- PLAN       "What could happen, what should we prepare?"
```

At the end of Phase 4, BANQ is no longer simply an advertising analytics
service. It becomes a campaign intelligence, planning and go-to-market
operating layer built around the advertising ecosystem, while QWK Browser
remains the owner and operator of its underlying advertising and publisher
infrastructure.

---

## Change Log

| Date | Change |
|------|--------|
| 2026-08-29 | Doc created. Owned the 4-phase implementation execution plan, organized easiest-to-heaviest within each phase. Includes table schemas, API specs, file lists, acceptance criteria, and placeholder seeding instructions for each step. References AGENTS.md rules throughout. **A count was stated here as "34 steps"; it is removed rather than corrected.** This document IS the authority, so a count restated inside it can only ever disagree with the steps below it -- and it did, twice in its own history (20 in the system overview, 34 here, 37 in the body). The steps are the count. |
| 2026-09-22 | **STATUS: BUILT.** All 37 steps (E0 pre-build + 8 + 8 + 9 + 8) implemented in `backend/intelligence/`: `schema.js` (51 tables + 32 config keys, idempotent), `core.js` (config / audit / timeline / access), `phase1.js`, `phase2.js`, `phase3.js`, `phase4.js`, `service.js` (the $15 gate). Surfaces: `backend/banq-intelligence.js` (the `/api/banq/*` namespace), `backend/billboards.js`, `backend/flags.js`, `js/monitor.js`, `monitor.html`. Proof: `scripts/verify-banq-intelligence.cjs` 129 PASS / 0 FAIL, run twice with identical results. Demo data: `scripts/seed-banq-intelligence.js` (one advertiser with a paid month, two without, so both the open and locked states are visible in one environment). The plan's own rules were treated as acceptance criteria and are asserted in the verifier: no hardcoded thresholds (changing a weight must MOVE the score), observed facts separated from possible factors, cautious prediction language, a range instead of a certain number, the human override on readiness and predictions, and no premature "winner". |
| 2026-09-22 | **Five defects found and fixed during the build**, all in the analysis the plan specifies, none of them cosmetic: (1) the creative score used efficiency rates only, so a creative losing 55% of its delivery per day reported 95 STRONG -- a sustained volume decline now overrules the band; (2) the trend compared raw sums across windows of different lengths, so a FALLING metric was reported as +22% RISING -- now a per-day rate, with a window that has no rows reporting null rather than zero; (3) a fatigue streak was reset by a period whose earlier window had no data, which silently hid fatigue on exactly the young creatives most exposed to it -- such a period is now skipped, not treated as a break; (4) `journey_event_sources` had no unique name, so `INSERT OR IGNORE` duplicated it on every run and the LEFT JOIN in drop-off multiplied a 42,000-impression funnel into 126,000 -- a UNIQUE index after a dedupe pass; (5) INSUFFICIENT_DATA stored a score row of 0, which reads later as a real score of zero in history and in any average built from it -- nothing is written when there is nothing to score. |

---

## END OF BANQ INTELLIGENCE IMPLEMENTATION PLAN
