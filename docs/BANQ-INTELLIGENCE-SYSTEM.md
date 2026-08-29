# BANQ Intelligence System -- Master Implementation Plan

> **ID:** BANQ-INTELLIGENCE
> **Status:** SPEC -- ready for implementation
> **Created:** 2026-08-29
> **Source:** Chris (2026-08-29) -- full 4-phase specification
> **Location:** docs/BANQ-INTELLIGENCE-SYSTEM.md
> **Pipeline:** docs/BANQ-MASTER-PIPELINE.md (BANQ-022)
> **Depends on:** BANQ-AD-MONITORING-PARTNERSHIP.md, BANQ-QWK-API-PARTNERSHIP.md, QAP-RELATED-TASK.md
> **AGENTS.md rules:** Rule 5 (ASCII), Rule 8 (PowerShell), Rule 9/10 (placeholders), Rule 13 (JS inventory), Rule 16 (commit checkpoints), Rule 18 (nav updates)

---

## What This Is

The BANQ Intelligence System is the core value for advertisers who opt into BANQ campaign monitoring. NOT a dashboard that shows numbers. A system that tells the customer what is happening, what changed, what may need attention, and what they can do next.

Four pillars: **Launch, Monitor, Learn, Act.** ACT is what makes BANQ different.

```
              BANQ INTELLIGENCE
                      |
    +-----------------+------------------+
    |                 |                  |
    v                 v                  v
  LAUNCH            MONITOR             LEARN
    |                 |                  |
    +-----------------+------------------+
                      v
                    ACT
```

## Architecture: 8 Modules

```
BANQ INTELLIGENCE SYSTEM
+-- MODULE 1: Campaign Data Foundation
+-- MODULE 2: Monitoring & Health
+-- MODULE 3: Goals & Budget
+-- MODULE 4: Creative Intelligence
+-- MODULE 5: Recommendations & Actions
+-- MODULE 6: BANQ Human Service
+-- MODULE 7: Reporting
+-- MODULE 8: Enterprise & Future Intelligence
```

## Core Principle

QWK Browser owns advertising infrastructure. BANQ is an optional monitoring, analytics and customer relationship service. Available regardless of where the advertiser begins.

## Progression

```
PHASE 1 -- MONITOR    "How is my campaign doing?"
PHASE 2 -- UNDERSTAND "What changed and what should I consider?"
PHASE 3 -- LEARN      "What happens across the journey, what can I test?"
PHASE 4 -- PLAN       "What could happen, what should we prepare?"
```

---

## PHASE 1 -- Campaign Monitoring, Analytics and Advertiser Service

**Goal:** Make the initial paid monitoring service real.
**Rule:** Every card, score, alert and timeline entry must connect to real campaign data or clearly identified placeholder data.

### Phase 1 Data Foundation (BUILD FIRST)

| Entity | Purpose |
|--------|---------|
| ADVERTISERS | Advertiser accounts (reference QWK) |
| QAP_PROFILES | QAP profile references |
| CAMPAIGNS | Campaign records (reference QWK ad_banners) |
| CAMPAIGN_METRICS | Time-series metrics |
| BANQ_SERVICE_SUBSCRIPTIONS | Opt-in records, plan, fee, status |
| BANQ_ANALYST_ASSIGNMENTS | Analyst-to-campaign mapping |
| CAMPAIGN_HEALTH_SCORES | Historical health scores |
| BANQ_ALERTS | Watch system alerts |
| CAMPAIGN_GOALS | Goal type, target, current, progress |
| CAMPAIGN_TIMELINE | Immutable event log |
| BANQ_NOTES | Analyst/advertiser communication |
| BANQ_ACTIVITY_LOG | Every BANQ action recorded |

**Rule 16:** Back up data/banq.db before any table creation. Commit checkpoint before and after.

### Phase 1 Steps (Easiest to Heaviest)

#### Step 1.1: Campaign Notes (EASIEST)
**Module:** BANQ Human Service -- simplest data model, one table, basic CRUD

- `banq_notes` table: note_id, campaign_id, author_id, author_role, message, created_at, visibility, parent_note_id
- Visibility: INTERNAL_BANQ vs ADVERTISER_VISIBLE (internal never shown to advertisers)
- API: POST/GET /api/banq/notes, POST /api/banq/notes/:id/reply
- Files: backend/banq-notes.js, dashboard.html, BANQ-JS.md (Rule 13)

#### Step 1.2: Campaign Timeline
**Module:** Campaign Data Foundation -- append-only event log, no complex logic

- `campaign_timeline` table: event_id, campaign_id, event_type, actor_type, actor_id, timestamp, metadata
- Events: Created, Launched, BANQ Activated, Budget Changed, Goal Updated, Paused, Alert Generated, Note Added, Resumed, Completed
- Actors: ADVERTISER, BANQ, QWK_ADMIN, SYSTEM
- IMMUTABLE -- corrections create new events
- API: GET /api/banq/timeline/:campaign_id
- Files: backend/banq-timeline.js, dashboard.html, BANQ-JS.md

#### Step 1.3: Campaign Goals
**Module:** Goals & Budget -- simple UI + basic calculation (current / target)

- `campaign_goals` table: goal_id, campaign_id, goal_type, target_value, current_value, target_date
- Types: Website Visits, Sales, Bookings, Leads, App Downloads, Brand Awareness, Followers, Custom
- If unmeasurable: clearly indicate external tracking needed. DO NOT FABRICATE CONVERSIONS.
- API: POST/GET/PUT /api/banq/goals
- Files: backend/banq-goals.js, dashboard.html, packages.html, BANQ-JS.md

#### Step 1.4: Budget Pacer
**Module:** Goals & Budget -- calculation logic (expected vs actual spend)

- Compares TOTAL BUDGET vs ACTUAL SPEND vs EXPECTED SPEND
- Expected = (elapsed / duration) x budget, adjusted for pauses and changes
- States: ON_TRACK, SPENDING_FAST, SPENDING_SLOW, AT_RISK
- Intelligence: "Your campaign is spending faster than planned and may exhaust its budget before the scheduled end date."
- API: GET /api/banq/budget-pacer/:campaign_id
- Files: backend/banq-budget.js, dashboard.html, BANQ-JS.md

#### Step 1.5: Campaign Dashboard
**Module:** Campaign Data Foundation -- pulls together Notes, Timeline, Goals, Budget

- Display: Campaign Name, Status, Health, Budget, Time Remaining, Goal, Latest BANQ Update
- Sections: Overview, Health, Performance, Budget, Goal, Timeline, BANQ Notes
- Responsive (RESPONSIVE-BREAKPOINTS.md)
- New page: campaign.html (Rule 18: add nav to ALL pages)
- API: GET /api/banq/campaign/:campaign_id
- Files: campaign.html, backend/banq-dashboard.js, ALL HTML files (nav), AGENTS.md, BANQ-JS.md

#### Step 1.6: BANQ Watch (Alert System)
**Module:** Monitoring & Health -- evaluation logic, alert lifecycle, cooldown, deduplication

- `banq_alerts` table: alert_id, campaign_id, alert_type, severity, created_at, status, message, supporting_data
- Types: BUDGET_SPENDING_TOO_FAST/SLOW, CAMPAIGN_INACTIVE, PERFORMANCE_DROP, GOAL_AT_RISK, CAMPAIGN_ENDING, GOAL_REACHED, UNUSUAL_ACTIVITY
- Severity: INFO, LOW, MEDIUM, HIGH, CRITICAL
- Status: NEW, ACKNOWLEDGED, RESOLVED, DISMISSED
- Cooldown + deduplication logic
- API: GET/PUT /api/banq/alerts
- Files: backend/banq-watch.js, backend/banq-alert-engine.js, dashboard.html, BANQ-JS.md

#### Step 1.7: Campaign Health Score
**Module:** Monitoring & Health -- weighted scoring algorithm, depends on Pacer, Goals, Watch, metrics

- `campaign_health_scores` table: score_id, campaign_id, score, calculated_at, factor_breakdown
- Range: 0-100. Ranges: 80-100 Healthy, 60-79 Watch, 40-59 Needs Attention, 0-39 Critical
- Configurable weights (NOT hardcoded): budget_pacing, goal_progress, delivery, performance_trend, technical_status
- Store historical scores for future graphs
- Intelligence: "Your campaign is healthy, but Banner B has declined by 18% over the last three days."
- API: GET /api/banq/health/:campaign_id
- Files: backend/banq-health.js, backend/banq-config.js, dashboard.html, BANQ-JS.md

#### Step 1.8: BANQ Report Card (HEAVIEST)
**Module:** Reporting -- depends on ALL Phase 1 modules, end-of-campaign summary

- Report: Campaign name, goal, overall result, best creative, best day, key finding, BANQ recommendation
- Understandable without an advertising degree
- `banq_reports` table: report_id, campaign_id, report_type, generated_at, period_start, period_end, data_snapshot, generated_by, status
- Once generated, preserves data snapshot. Later corrections do not rewrite history.
- API: GET /api/banq/report/:campaign_id, POST /api/banq/report/generate
- Files: backend/banq-reports.js, dashboard.html, BANQ-JS.md

### Phase 1 Additional Infrastructure

**BANQ Work Queue** (alongside 1.6-1.7): Staff workspace. CRITICAL/NEEDS ATTENTION/WATCH/HEALTHY counts. Filter by analyst, status, severity, plan, date, client. Sort: CRITICAL > HIGH > MEDIUM > RECENTLY_CHANGED.

**BANQ Activity Log** (alongside 1.1): Every BANQ action recorded. activity_id, campaign_id, actor_id, action_type, timestamp, metadata.

**Notifications** (alongside 1.6): In-App initially. Architecture for future Email/Push/SMS. Configurable cooldown.

**Admin Configuration** (alongside 1.7): Plans, prices, currency, health weights, ranges, alert thresholds, cooldowns, notification settings, goal types, staff roles. No code changes needed.

**BANQ Service Lifecycle:** NOT_SELECTED -> OFFERED -> OPTED_IN -> PAYMENT_CONFIRMED -> ACTIVE -> MONITORING -> COMPLETED. Additional: PAUSED, CANCELLED, EXPIRED, SUSPENDED.

**Revenue Records:** transaction_id, campaign_id, advertiser_id, banq_plan, advertising_budget, banq_service_fee, payment_status, refund_amount, settlement_status. BANQ revenue SEPARATE from advertising budget. Settlement: PENDING, APPROVED, SETTLED, ON_HOLD, ADJUSTED.

**Security:** BANQ staff access ONLY opted-in advertisers, assigned campaigns, service-required data. NO access to non-BANQ advertisers, QWK admin systems, Publisher Network admin, private platform data. Every sensitive action logged.

**Edge Cases:** Cancel BANQ -> access ends per terms. Campaign ends before service -> mark completed, preserve history. Paused -> exclude from pacing. Budget change -> recalculate from change point. Goal change -> store old/new in timeline. Analyst removed -> reassign, preserve history. Metrics fail -> display "DATA DELAY", not failed.

### Phase 1 Acceptance

**Advertiser:** opt in, see pricing, view health, view budget pacing, track goals, view alerts, view timeline, read/reply to notes.
**BANQ staff:** see monitored campaigns, receive alerts, add notes, assign campaigns, track activity.
**QWK Browser:** retains infrastructure control, Publisher Network control, configures BANQ services, tracks revenue, generates settlements.

---

## PHASE 2 -- Creative Intelligence, Recommendations and Action Center

**Goal:** Transform from monitoring into intelligence and action.
**Phase 1:** "What is happening?" **Phase 2:** "What is performing best? What changed? What should I do next?"

### Phase 2 Data Foundation

| Entity | Purpose |
|--------|---------|
| AD_CREATIVES | Individual creative records |
| CREATIVE_METRICS | Per-creative time-series metrics |
| CREATIVE_PERFORMANCE_SCORES | Historical creative scores |
| CREATIVE_STATUS_HISTORY | Status changes |
| CREATIVE_FATIGUE_EVENTS | Fatigue detection |
| BANQ_RECOMMENDATIONS | Generated recommendations |
| RECOMMENDATION_ACTIONS | Advertiser responses |
| RECOMMENDATION_HISTORY | Decision history |

### Phase 2 Steps (Easiest to Heaviest)

#### Step 2.1: Creative Intelligence (EASIEST)
**Module:** Creative Intelligence -- foundational data structure, every Phase 2 tool depends on it

- `ad_creatives` table: creative_id, campaign_id, creative_name, creative_type, creative_status, created_at, activated_at, deactivated_at
- Types: IMAGE, BANNER, VIDEO, TEXT, OTHER
- `creative_metrics` table: creative_id, metric_name, metric_value, timestamp, campaign_id, source
- Each creative has own metrics (impressions, clicks, engagements, conversions, spend, video_views, landing_page_visits)
- API: GET /api/banq/creatives/:campaign_id, GET /api/banq/creatives/:id/metrics
- Files: backend/banq-creatives.js, dashboard.html, BANQ-JS.md

#### Step 2.2: Creative Performance Score
**Module:** Creative Intelligence -- scoring algorithm for individual creatives

- `creative_performance_scores` table: score_id, creative_id, score, calculated_at, factor_breakdown
- Configurable weights: engagement, click, conversion, cost_efficiency, goal_contribution, trend
- Different campaign goals need different weighting (awareness vs conversion)
- Status: STRONG, STABLE, WATCH, DECLINING, INSUFFICIENT_DATA
- API: GET /api/banq/creatives/:id/score
- Files: backend/banq-creative-score.js, banq-config.js, dashboard.html, BANQ-JS.md

#### Step 2.3: What Changed?
**Module:** Recommendations & Actions -- comparison analysis, no scoring, no prediction

- Compares current vs previous period (24h, 7d, 30d, custom)
- Identifies: spend, impressions, clicks, engagement changes, creative added/paused, budget changed, campaign paused/resumed, goal changed
- CRITICAL RULE: Separate OBSERVED FACTS from POSSIBLE FACTORS. NEVER claim causation.
- Labels: OBSERVED, POSSIBLE CONTRIBUTING FACTORS, REQUIRES FURTHER REVIEW
- Auto-selects comparison when launched from alert
- API: GET /api/banq/what-changed/:campaign_id?period=24h
- Files: backend/banq-what-changed.js, dashboard.html, BANQ-JS.md

#### Step 2.4: Ad Fatigue Detector
**Module:** Monitoring & Health -- rule-based detection using creative metrics

- `creative_fatigue_events` table: fatigue_id, creative_id, campaign_id, state, detected_at, resolved_at, metadata
- Indicators: sustained engagement/click/conversion decline, high exposure + declining response, long duration + weakening
- States: NO_FATIGUE_DETECTED, POSSIBLE_FATIGUE, FATIGUE_UNDER_REVIEW, ACTION_TAKEN
- Use "Possible Creative Fatigue" unless confidence meets threshold
- Admin-configurable: enabled, min_active_days, min_impressions, decline_threshold, consecutive_decline_periods, comparison_window
- Actions recorded in Campaign Timeline
- API: GET /api/banq/fatigue/:campaign_id
- Files: backend/banq-fatigue.js, banq-config.js, dashboard.html, BANQ-JS.md

#### Step 2.5: Creative Battle
**Module:** Creative Intelligence -- comparison UI + logic, depends on creative scores + data rules

- Compares 2+ creatives, displays score, metrics, trend, time active, goal contribution
- Ranking with medals (1st, 2nd, 3rd)
- Advertiser selects: Compare All or Select Creatives (A vs B)
- Minimum data (configurable): min_impressions, min_clicks, min_runtime, min_conversions
- If insufficient: INSUFFICIENT_DATA or EARLY_RESULT. Do NOT call winner prematurely.
- API: GET /api/banq/creative-battle/:campaign_id
- Files: backend/banq-creative-battle.js, dashboard.html, BANQ-JS.md

#### Step 2.6: BANQ Recommends
**Module:** Recommendations & Actions -- recommendation engine, converts patterns into possible actions

- `banq_recommendations` table: recommendation_id, campaign_id, type, title, description, reason, supporting_data, confidence_level, created_at, expires_at, status
- Types: CREATIVE_REVIEW, CREATIVE_PAUSE, CREATIVE_TEST, BUDGET_REVIEW, BUDGET_REALLOCATION, CAMPAIGN_EXTENSION, GOAL_REVIEW, PERFORMANCE_INVESTIGATION, MONITORING_ONLY
- Confidence: HIGH, MODERATE, EARLY SIGNAL
- Every recommendation has "WHY AM I SEEING THIS?" with supporting data
- Language: "BANQ recommends considering..." NOT "This will improve..."
- Actions: ACCEPT, REVIEW, DISMISS, ASK BANQ
- No campaign-changing action silently. Advertiser must confirm.
- Manual: "RECOMMENDED BY BANQ". System: "GENERATED BY BANQ INTELLIGENCE"
- API: GET /api/banq/recommendations/:campaign_id, POST /api/banq/recommendations/:id/action
- Files: backend/banq-recommendations.js, dashboard.html, BANQ-JS.md

#### Step 2.7: Recommendation Approval Flow
**Module:** Recommendations & Actions -- workflow connecting recommendations to actions

- Flow: PATTERN -> Recommendation -> Optional BANQ Review -> Advertiser Views -> Accept/Review/Dismiss -> Confirm -> Action Applied -> Timeline Updated
- Every decision recorded
- `recommendation_actions` table: action_id, recommendation_id, action_type, actor_id, timestamp, metadata
- `recommendation_history` table: history_id, recommendation_id, status_from, status_to, changed_by, changed_at
- API: POST /api/banq/recommendations/:id/accept, POST /api/banq/recommendations/:id/dismiss
- Files: backend/banq-recommendation-flow.js, dashboard.html, BANQ-JS.md

#### Step 2.8: BANQ Action Center (HEAVIEST)
**Module:** Recommendations & Actions -- unified workspace, home screen for BANQ-monitored campaigns

- Priority: CRITICAL, REQUIRES ATTENTION, RECOMMENDED, MONITOR, INFORMATION
- Action card: status icon, title, description, why?, suggested action, [Primary Action], [View Details]
- Filters: All, Critical, Recommendations, Creative, Budget, Goals, Monitoring, Completed
- Dismissed items remain in history
- BANQ staff filters: System Recommendations, Pending Review, Client Action Required, Accepted, Dismissed, Completed
- BANQ manager: Most Common, Most Accepted, Most Dismissed, Campaigns Needing Human Review
- API: GET /api/banq/action-center/:campaign_id, GET /api/banq/action-center (staff)
- Files: backend/banq-action-center.js, dashboard.html, BANQ-JS.md

### Phase 2 Rules

**Creative Action History** (alongside 2.1): Track Added, Paused, Resumed, Removed, Replaced, Budget Changed. Feeds What Changed?

**Alerts vs Recommendations:** ALERT = awareness. RECOMMENDATION = suggested action. Alert may generate recommendation, but not every alert needs one. NEVER combine these concepts.

**Edge Cases:** New creative -- don't compare unfairly. Paused -- stop evaluation, preserve history. Insufficient data -- show INSUFFICIENT_DATA, no strong recommendations. Conflicting signals -- explain both, don't auto-label. Multiple recommendations for same problem -- group them. Expired recommendation -- revalidate before action.

---

## PHASE 3 -- Journey Intelligence, Experimentation, Benchmarking and Enterprise

**Goal:** Look beyond the advertisement. Follow the journey from exposure to action, test ideas, learn across campaigns, manage multiple brands.

### Phase 3 Data Foundation

| Entity | Purpose |
|--------|---------|
| JOURNEY_CONFIGURATIONS | Per-campaign journey definitions |
| JOURNEY_EVENTS | Individual journey events |
| JOURNEY_EVENT_SOURCES | Event source tracking |
| JOURNEY_METRICS | Journey-level metrics |
| EXPERIMENTS | Experiment records |
| EXPERIMENT_VARIANTS | A/B test variants |
| EXPERIMENT_RESULTS | Experiment outcomes |
| BENCHMARK_GROUPS | Anonymised benchmark groups |
| BENCHMARK_METRICS | Aggregated benchmark data |
| CROSS_CAMPAIGN_INSIGHTS | Pattern detection |
| ENTERPRISE_ACCOUNTS | Multi-brand organisations |
| ENTERPRISE_BRANDS | Brand records |
| ENTERPRISE_MEMBERS | Role assignments |
| BANQ_CLIENT_REQUESTS | Advertiser-to-BANQ requests |

### Phase 3 Steps (Easiest to Heaviest)

#### Step 3.1: Journey Event Types and Tracking (EASIEST)
**Module:** Journey Intelligence -- data structure only, no UI, no analysis

- `journey_events` table: event_id, campaign_id, advertiser_id, event_name, event_description, event_value, event_timestamp, source
- Standard: IMPRESSION, CLICK, ENGAGEMENT, VIDEO_VIEW, LANDING_PAGE_VISIT, SIGN_UP, LEAD, CONTACT, DOWNLOAD, BOOKING, PURCHASE, CUSTOM_EVENT
- Custom events: advertiser-defined names
- `journey_event_sources` table: source_id, source_name, source_type, quality_status
- Quality: VERIFIED, TRACKED, ESTIMATED, DELAYED, UNAVAILABLE
- Do not combine estimated with verified without clear labelling
- If tracking fails: "TRACKING DATA UNAVAILABLE" not zero
- API: POST/GET /api/banq/journey/events
- Files: backend/banq-journey.js, BANQ-JS.md

#### Step 3.2: Journey Configuration
**Module:** Journey Intelligence -- setup UI for journey paths

- `journey_configurations` table: config_id, campaign_id, primary_goal, secondary_goals (JSON), journey_steps (JSON)
- Advertiser defines: PRIMARY GOAL, SECONDARY GOALS, JOURNEY EVENTS (ordered)
- Do not assume linear journey. Support different paths.
- API: POST/GET /api/banq/journey/configure
- Files: backend/banq-journey.js (extend), dashboard.html, BANQ-JS.md

#### Step 3.3: Journey Drop-Off Analysis
**Module:** Journey Intelligence -- analysis logic, identifies drop-offs, no scoring

- Identifies largest drop-off: "LARGEST DROP-OFF: Landing Page -> Sign-Up: 72% decrease"
- Describe as observed, NOT why. "Further investigation may be required."
- Journey comparison: This Week vs Last Week, Campaign A vs B, Creative A vs B, Mobile vs Desktop, Custom
- API: GET /api/banq/journey/dropoff/:campaign_id
- Files: backend/banq-journey.js (extend), dashboard.html, BANQ-JS.md

#### Step 3.4: Experiment Lab
**Module:** Journey Intelligence -- experiment creation + management, data structure + lifecycle

- `experiments` table: experiment_id, campaign_id, experiment_type, name, hypothesis, primary_metric, secondary_metrics, start_date, end_date, status
- Types: CREATIVE, HEADLINE, CTA, LANDING PAGE, AUDIENCE, PLACEMENT, BUDGET test
- `experiment_variants` table: variant_id, experiment_id, creative_id, configuration, traffic_allocation, status
- Traffic: 50/50, 60/40, 70/30, Custom
- Status: DRAFT, READY, RUNNING, PAUSED, COMPLETED, CANCELLED, INVALID
- Hypothesis REQUIRED (not just "A vs B")
- API: POST/GET/PUT /api/banq/experiments
- Files: backend/banq-experiments.js, dashboard.html, BANQ-JS.md

#### Step 3.5: Experiment Results
**Module:** Journey Intelligence -- result analysis with minimum data rules and cautious labelling

- `experiment_results` table: result_id, experiment_id, variant_id, primary_metric_value, secondary_metrics, confidence_level, result_status, calculated_at
- Minimum data (configurable): min_runtime, min_impressions, min_conversions, min_sample_size
- Before requirements: "EXPERIMENT IN PROGRESS -- More data required."
- Do NOT display "Winner" prematurely
- Labels: EARLY SIGNAL, POSITIVE SIGNAL, NO MEANINGFUL DIFFERENCE, NEGATIVE SIGNAL, INCONCLUSIVE
- Decisions: Keep Control, Adopt Variant, Run Another Test, Ask BANQ, Archive
- All decisions added to Experiment History, Campaign Timeline, Activity Log
- API: GET /api/banq/experiments/:id/results
- Files: backend/banq-experiments.js (extend), dashboard.html, BANQ-JS.md

#### Step 3.6: Campaign Benchmarking
**Module:** Enterprise & Future Intelligence -- aggregated comparison, privacy-critical

- `benchmark_groups` table: group_id, group_type, criteria (JSON), created_at, updated_at
- `benchmark_metrics` table: metric_id, group_id, metric_name, metric_value, calculated_at, sample_count
- Groups by: INDUSTRY, CAMPAIGN_GOAL, CAMPAIGN_TYPE, AD_FORMAT, BUDGET_RANGE, REGION, TIME_PERIOD
- PRIVACY RULE: Never expose another advertiser's name, campaign, individual metrics, or confidential data. Aggregated only.
- If insufficient data: "BENCHMARK NOT AVAILABLE". Do not create fake averages.
- Configurable: min_campaign_count, min_data_volume, min_recency, min_group_similarity
- Freshness: Last 30 Days, Last 90 Days, Last 12 Months
- API: GET /api/banq/benchmark/:campaign_id
- Files: backend/banq-benchmark.js, dashboard.html, BANQ-JS.md

#### Step 3.7: Cross-Campaign Intelligence
**Module:** Enterprise & Future Intelligence -- pattern detection across multiple campaigns

- `cross_campaign_insights` table: insight_id, advertiser_id, insight_type, description, supporting_campaigns (JSON), created_at
- Types: BEST_PERFORMING_CREATIVE_TYPE, BEST_PERFORMING_TIME_PERIOD, STRONGEST_CAMPAIGN, WEAKEST_TREND, RECURRING_ALERT, COMMON_GOAL_PROBLEM, TOP_JOURNEY_PATH
- Labelled as observed pattern, NOT guaranteed strategy
- Advertiser can click "VIEW SUPPORTING CAMPAIGNS"
- API: GET /api/banq/cross-campaign/:advertiser_id
- Files: backend/banq-cross-campaign.js, dashboard.html, BANQ-JS.md

#### Step 3.8: Enterprise Multi-Brand Dashboard
**Module:** Enterprise & Future Intelligence -- multi-brand management, complex permissions

- `enterprise_accounts` table: enterprise_id, name, created_at
- `enterprise_brands` table: brand_id, enterprise_id, name, qap_number, created_at
- `enterprise_members` table: member_id, enterprise_id, user_id, role, brand_scope (JSON)
- Roles: ENTERPRISE_OWNER, ENTERPRISE_ADMIN, BRAND_MANAGER, CAMPAIGN_MANAGER, ANALYST, VIEWER
- Brand Manager should NOT automatically see all brands
- Drill-down: Enterprise -> Brand -> Campaign -> Creative -> Journey
- Cross-brand comparison (enterprise-level permission only)
- API: GET /api/banq/enterprise/:enterprise_id, GET /api/banq/enterprise/:id/brands
- Files: backend/banq-enterprise.js, enterprise.html (new page, Rule 18 nav), BANQ-JS.md

#### Step 3.9: BANQ Team Workspace (HEAVIEST)
**Module:** BANQ Human Service -- operational workspace, depends on everything above

- Staff workspace: My Clients, My Campaigns, Unassigned, Critical Alerts, Pending Questions, Pending Recommendations, Experiments Running
- Client workspace: Company, Brands, Active Campaigns, Requiring Attention, Open Requests, Active Experiments
- `banq_client_requests` table: request_id, advertiser_id, campaign_id, assigned_to, priority, status, created_at, updated_at
- Request statuses: NEW, ASSIGNED, IN_REVIEW, AWAITING_CLIENT, COMPLETED, CLOSED
- BANQ internal collaboration: internal notes, mentions, assignments, status changes (invisible to advertisers)
- Navigation: Client -> Brand -> Campaign -> Creative -> Experiment
- API: GET /api/banq/workspace, GET /api/banq/workspace/client/:client_id
- Files: backend/banq-workspace.js, workspace.html (new page, Rule 18 nav), BANQ-JS.md

### Phase 3 Edge Cases

- No conversion tracking: Journey Map shows only available events
- Multiple campaigns contribute to one conversion: do not auto-assign full credit. Mark attribution limitations.
- Experiment interrupted: mark PAUSED, CANCELLED, or INVALID. Do not treat incomplete as conclusive.
- Enterprise brand removed: preserve historical data and audit history.
- Benchmark group too small: remove or disable, do not expose unreliable results.

### Phase 3 Acceptance

**Advertisers:** define journey, view stages, identify drop-offs, create/monitor experiments, compare variants, view benchmarks, analyse cross-campaign patterns.
**Enterprise:** organise brands, manage QAPs, view cross-brand intelligence, control role access.
**BANQ teams:** manage clients/campaigns, handle requests, collaborate internally, monitor experiments, work across enterprise accounts.

---

## PHASE 4 -- Predictive Planning, Scenario Simulation and Go-To-Market Intelligence

**Goal:** Move from analysing existing campaigns to helping advertisers plan before launch. Predictions and simulations must NEVER be presented as guarantees.

### Phase 4 Data Foundation

| Entity | Purpose |
|--------|---------|
| CAMPAIGN_PLANS | Pre-launch campaign plans |
| CAMPAIGN_SCENARIOS | Scenario configurations |
| SCENARIO_SIMULATIONS | Simulation results |
| CAMPAIGN_READINESS_CHECKS | Pre-launch readiness scores |
| PLACEMENT_PROFILES | Placement intelligence |
| PLACEMENT_INSIGHTS | Placement comparison data |
| FORECASTS | Forecast ranges |
| FORECAST_HISTORY | Historical forecast records |
| PREDICTIVE_ALERTS | Predictive alert records |
| REPORTS | Generated reports |
| REPORT_SNAPSHOTS | Report data snapshots |
| GTM_PROJECTS | Go-to-market projects |
| GTM_OBJECTIVES | Project objectives |
| GTM_TIMELINES | Project timelines |
| GTM_TASKS | Project tasks |
| LEARNING_ARCHIVE | Advertiser learning history |

### Phase 4 Steps (Easiest to Heaviest)

#### Step 4.1: Campaign Readiness Check (EASIEST)
**Module:** Predictive Planning -- checklist + scoring, simplest logic in Phase 4

- `campaign_readiness_checks` table: check_id, campaign_id, score, checks (JSON), calculated_at
- Checks: objective selected, budget configured, duration configured, creative attached, goal configured, destination available, tracking configured, BANQ monitoring selected, experiment configured, approvals completed
- States: READY, READY_WITH_OBSERVATIONS, NEEDS_ATTENTION, NOT_READY
- BANQ should not silently block campaigns unless true technical/policy requirement
- API: GET /api/banq/readiness/:campaign_id
- Files: backend/banq-readiness.js, dashboard.html, BANQ-JS.md

#### Step 4.2: Campaign Planner
**Module:** Predictive Planning -- planning workspace, collects inputs, generates plan structure

- `campaign_plans` table: plan_id, advertiser_id, campaign_name, objective, duration, budget, creative_type, target_audience, region, primary_goal, secondary_goals, recommended_structure (JSON), created_at
- Plan output: recommended number of creatives, primary video, supporting banners, review schedule, journey tracking
- Distinguish: SYSTEM SUGGESTION, BANQ RECOMMENDATION, ADVERTISER DECISION
- API: POST/GET /api/banq/plans
- Files: backend/banq-planner.js, dashboard.html, BANQ-JS.md

#### Step 4.3: Automated Reporting
**Module:** Reporting -- report generation with scheduling, builds on Phase 1 Report Card

- `reports` table: report_id, report_type, campaign_id, generated_at, period_start, period_end, data_snapshot_reference, generated_by, status
- `report_snapshots` table: snapshot_id, report_id, data (JSON)
- Types: Campaign Summary, Weekly, Monthly, Campaign Completion, Enterprise Summary
- Generation: GENERATE NOW, SCHEDULED, AUTOMATIC AT CAMPAIGN END
- Once generated, preserves data snapshot. Later corrections do not rewrite.
- Future delivery: In-App, Download, Email (start with in-app)
- API: POST /api/banq/reports/generate, GET /api/banq/reports/:campaign_id
- Files: backend/banq-reports.js (extend), dashboard.html, BANQ-JS.md

#### Step 4.4: Placement Intelligence
**Module:** Predictive Planning -- placement profiles + comparison, QWK controls inventory

- `placement_profiles` table: placement_id, publisher_category, placement_type, creative_format, region, device_type, historical_delivery_data, availability_status
- `placement_insights` table: insight_id, placement_id, metric_name, metric_value, calculated_at
- QWK Browser controls Publisher Network. BANQ analyses authorised data only.
- Do not expose confidential publisher-level information unless authorised.
- API: GET /api/banq/placements, GET /api/banq/placements/compare
- Files: backend/banq-placements.js, dashboard.html, BANQ-JS.md

#### Step 4.5: Predictive Alerts
**Module:** Monitoring & Health -- predictive alert system, different from Phase 1 alerts

- `predictive_alerts` table: prediction_id, campaign_id, prediction_type, generated_at, prediction_window, confidence_level, supporting_data, recommended_action, status
- Types: POSSIBLE_BUDGET_EXHAUSTION, POSSIBLE_GOAL_SHORTFALL, POSSIBLE_UNDERDELIVERY, POSSIBLE_CREATIVE_DECLINE, POSSIBLE_TRACKING_ISSUE
- Phase 1: "Your campaign is spending faster than expected."
- Phase 4: "Based on current spending pattern, the campaign may exhaust its budget before the scheduled end date."
- Cautious language. Recalculated as new data arrives.
- Status: ACTIVE, UPDATED, RESOLVED, EXPIRED, DISMISSED
- API: GET /api/banq/predictive-alerts/:campaign_id
- Files: backend/banq-predictive.js, dashboard.html, BANQ-JS.md

#### Step 4.6: Scenario Simulator
**Module:** Predictive Planning -- what-if analysis, complex comparison logic

- `campaign_scenarios` table: scenario_id, plan_id, variables (JSON), created_at
- `scenario_simulations` table: simulation_id, scenario_id, results (JSON), confidence_level, calculated_at
- Variables: budget, duration, creative_count, creative_mix, campaign_goal, placement_type, target_region
- Compare scenarios: A (10K/30d) vs B (15K/30d) vs C (10K/45d)
- Focus on relative outcomes. Do not fabricate exact numbers.
- If sufficient data: show FORECAST RANGE (e.g., "8,000-12,000 Visits")
- Never display single forecast number as certainty
- Confidence: HIGH DATA SUPPORT, MODERATE, LIMITED, INSUFFICIENT
- "What If?" interaction: "What if I increase budget by 20%?" -> possible effects
- API: POST/GET /api/banq/scenarios
- Files: backend/banq-simulator.js, dashboard.html, BANQ-JS.md

#### Step 4.7: Forecast Engine
**Module:** Predictive Planning -- forecasting with confidence, versioned calculations

- `forecasts` table: forecast_id, campaign_id, forecast_type, forecast_range (JSON), confidence_level, model_version, generated_at, inputs (JSON)
- `forecast_history` table: history_id, forecast_id, recalculated_at, new_range (JSON), new_confidence
- Categories: Estimated Delivery Range, Estimated Budget Consumption Range, Estimated Engagement Range, Estimated Goal Progress Range
- Forecast rules account for: Campaign Goal, Duration, Budget, Creative Type, Historical Data, Placement Availability, Region, Seasonality
- Missing factors reduce confidence, never silently ignored
- Historical forecasts remain reproducible
- API: GET /api/banq/forecast/:campaign_id
- Files: backend/banq-forecast.js, dashboard.html, BANQ-JS.md

#### Step 4.8: BANQ Go-To-Market Workspace (HEAVIEST)
**Module:** Enterprise & Future Intelligence -- strategic layer, connects everything

- `gtm_projects` table: project_id, advertiser_id, name, objective, created_at
- `gtm_objectives` table: objective_id, project_id, primary_objective, secondary_objectives (JSON), success_metrics (JSON), target_dates, responsible_teams (JSON)
- `gtm_timelines` table: timeline_id, project_id, stage, tasks (JSON), created_at
- `gtm_tasks` table: task_id, project_id, assigned_to, status, created_at, updated_at
- `learning_archive` table: learning_id, advertiser_id, observation, evidence (JSON), status, created_at
- GTM stages: PLANNING -> CREATIVE PREPARATION -> CAMPAIGN LAUNCH -> OPTIMISATION -> EXPERIMENTATION -> CAMPAIGN REVIEW -> LEARNING ARCHIVE
- Learning status: OBSERVED -> TESTED -> REPEATED -> INCONCLUSIVE -> SUPERSEDED
- A GTM project can contain multiple campaigns
- Connects: BUSINESS OBJECTIVE -> CAMPAIGN STRATEGY -> CAMPAIGN PLAN -> CREATIVE -> AD DELIVERY -> CUSTOMER JOURNEY -> MEASUREMENT -> LEARNING
- API: GET/POST /api/banq/gtm
- Files: backend/banq-gtm.js, gtm.html (new page, Rule 18 nav), BANQ-JS.md

### Phase 4 AI / Intelligence Architecture Rule

Do not make the entire system dependent on an AI model. BANQ intelligence supports multiple layers:

```
LAYER 1: Deterministic Rules
LAYER 2: Statistical Analysis
LAYER 3: Forecast Models
LAYER 4: AI-Generated Explanations
```

AI must not invent metrics or causes. AI-generated explanations must only use approved structured data.

### Phase 4 Human Override

BANQ analysts and authorised administrators can override or annotate: recommendations, forecast interpretations, readiness observations, report commentary. Original system output remains preserved. Both records visible in history.

### Phase 4 Acceptance

**Advertisers can:** plan campaigns before launch, check readiness, compare scenarios, ask "What If?" questions, view forecast ranges, receive predictive alerts, generate reports, manage multi-campaign GTM projects, preserve learnings.
**BANQ can:** assist clients before launch, provide strategic planning tools, monitor projected risks, connect multiple campaigns to one business objective, build evidence-based learning history.
**QWK Browser remains protected:** retains infrastructure control, Publisher Network control, BANQ analyses authorised data, BANQ services remain separate intelligence and client-service layer.

---

## Summary: Full Evolution

```
PHASE 1 -- MONITOR    "How is my campaign doing?"
PHASE 2 -- UNDERSTAND "What changed and what should I consider?"
PHASE 3 -- LEARN      "What happens across the journey, what can I test?"
PHASE 4 -- PLAN       "What could happen, what should we prepare?"
```

At the end of Phase 4, BANQ is no longer simply an advertising analytics service. It becomes a campaign intelligence, planning and go-to-market operating layer built around the advertising ecosystem, while QWK Browser remains the owner and operator of its underlying advertising and publisher infrastructure.

---

## Change Log

| Date | Change |
|------|--------|
| 2026-08-29 | Doc created. Full 4-phase implementation plan organized from easiest to heaviest within each phase. 20 tools across 4 phases. References AGENTS.md rules throughout. |

---

## END OF BANQ INTELLIGENCE SYSTEM DOC
