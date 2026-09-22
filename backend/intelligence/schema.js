/*
 * New Quanthoms Billboard Agency (BANQ)
 * backend/intelligence/schema.js -- Pre-Build: the database foundation
 *
 * WHY IT EXISTS: docs/BANQ-INTELLIGENCE-IMPLEMENTATION-PLAN.md defines 37
 * steps across four phases, and every one of them declares tables the repo
 * has never had. This file is Pre-Build (E0.2 + E0.3): one idempotent
 * migration that creates the whole namespace, plus the banq_config seed.
 *
 * TWO RULES THAT SHAPE THIS FILE:
 *
 * 1. No hardcoded thresholds anywhere in code. Every weight, cooldown and
 *    minimum lives in `banq_config` and is seeded here (Pre-Step 0.2). The
 *    engines read config; they never carry a magic number.
 *
 * 2. One authority per field. Where the implementation plan and the locked
 *    decision 23.11 (BANQ AD SERVICE = $15/month for ALL ads, not per ad)
 *    disagree, the reconciliation is recorded in the `banq_service_subscriptions`
 *    comment below rather than by keeping two competing tables.
 *
 * Idempotent: CREATE TABLE IF NOT EXISTS only, so it runs on every boot.
 */

const { db } = require('../db');

// ------------------------------------------------------------------
// E0.3 -- CORE CAMPAIGN TABLES (Pre-Step 0.3)
// ------------------------------------------------------------------
const CORE_TABLES = [
  // E0.2 -- the config table must exist BEFORE the seed below writes to it.
  `CREATE TABLE IF NOT EXISTS banq_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    config_type TEXT DEFAULT 'string',
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS campaigns (
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
  )`,

  // RECONCILIATION (recorded, not assumed): the implementation plan keys this
  // per campaign; locked decision 23.11 defines the BANQ service as $15/month
  // for ALL ads a user runs that month, so one row can be advertiser-wide
  // (campaign_id NULL) or campaign-scoped. advertiser_id is therefore NOT NULL
  // and campaign_id is nullable. Both readings resolve to one table, so there
  // is never a second competing subscription record.
  `CREATE TABLE IF NOT EXISTS banq_service_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    advertiser_id INTEGER NOT NULL,
    campaign_id INTEGER,
    banq_service_plan TEXT NOT NULL,
    banq_service_fee INTEGER DEFAULT 0,
    banq_service_currency TEXT DEFAULT 'QC',
    banq_service_status TEXT DEFAULT 'NOT_SELECTED',
    period_start DATETIME,
    period_end DATETIME,
    banq_service_start DATETIME,
    banq_service_end DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (advertiser_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS banq_analyst_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    analyst_id INTEGER NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active',
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (analyst_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS campaign_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    source TEXT DEFAULT 'system',
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  )`,

  `CREATE TABLE IF NOT EXISTS banq_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    actor_id INTEGER,
    action_type TEXT NOT NULL,
    metadata TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )`
];

// ------------------------------------------------------------------
// PHASE 1 -- MONITOR
// ------------------------------------------------------------------
const PHASE1_TABLES = [
  `CREATE TABLE IF NOT EXISTS banq_notes (
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
  )`,

  // APPEND-ONLY. Corrections create new events; nothing here is ever updated
  // or deleted, so the log can be trusted as a record of what happened.
  `CREATE TABLE IF NOT EXISTS campaign_timeline (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_id INTEGER,
    metadata TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  )`,

  `CREATE TABLE IF NOT EXISTS campaign_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    goal_type TEXT NOT NULL,
    target_value INTEGER,
    current_value INTEGER DEFAULT 0,
    target_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  )`,

  `CREATE TABLE IF NOT EXISTS banq_alerts (
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
  )`,

  `CREATE TABLE IF NOT EXISTS campaign_health_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    status TEXT NOT NULL,
    factor_breakdown TEXT,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  )`,

  `CREATE TABLE IF NOT EXISTS banq_reports (
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
  )`
];

// Phase 1 additional infrastructure (work queue reads existing tables;
// notifications, revenue ledger and config UI are tables).
const PHASE1_INFRA_TABLES = [
  `CREATE TABLE IF NOT EXISTS banq_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    campaign_id INTEGER,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,

  // BANQ revenue is SEPARATE from the advertising budget (Section 9 of the
  // monitoring partnership doc): the fee does not reduce the ad spend unless a
  // package says so, so it gets its own ledger and its own settlement status.
  `CREATE TABLE IF NOT EXISTS banq_revenue_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    advertiser_id INTEGER NOT NULL,
    banq_plan TEXT NOT NULL,
    advertising_budget INTEGER DEFAULT 0,
    banq_service_fee INTEGER NOT NULL,
    payment_status TEXT DEFAULT 'pending',
    refund_amount INTEGER DEFAULT 0,
    settlement_status TEXT DEFAULT 'PENDING',
    qap_number TEXT,
    settlement_period TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    settled_at DATETIME,
    FOREIGN KEY (advertiser_id) REFERENCES users(id)
  )`
];

// ------------------------------------------------------------------
// PHASE 2 -- UNDERSTAND
// ------------------------------------------------------------------
const PHASE2_TABLES = [
  `CREATE TABLE IF NOT EXISTS ad_creatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    creative_name TEXT NOT NULL,
    creative_type TEXT NOT NULL DEFAULT 'IMAGE',
    creative_status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    activated_at DATETIME,
    deactivated_at DATETIME,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  )`,

  `CREATE TABLE IF NOT EXISTS creative_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creative_id INTEGER NOT NULL,
    campaign_id INTEGER NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    source TEXT DEFAULT 'system',
    FOREIGN KEY (creative_id) REFERENCES ad_creatives(id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  )`,

  `CREATE TABLE IF NOT EXISTS creative_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creative_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    actor_id INTEGER,
    actor_type TEXT,
    reason TEXT,
    metadata TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creative_id) REFERENCES ad_creatives(id)
  )`,

  `CREATE TABLE IF NOT EXISTS creative_performance_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creative_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    status TEXT NOT NULL,
    factor_breakdown TEXT,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creative_id) REFERENCES ad_creatives(id)
  )`,

  `CREATE TABLE IF NOT EXISTS creative_fatigue_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creative_id INTEGER NOT NULL,
    campaign_id INTEGER NOT NULL,
    state TEXT NOT NULL DEFAULT 'POSSIBLE_FATIGUE',
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    metadata TEXT,
    FOREIGN KEY (creative_id) REFERENCES ad_creatives(id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  )`,

  `CREATE TABLE IF NOT EXISTS banq_recommendations (
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
  )`,

  `CREATE TABLE IF NOT EXISTS recommendation_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recommendation_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    actor_id INTEGER,
    metadata TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recommendation_id) REFERENCES banq_recommendations(id)
  )`,

  `CREATE TABLE IF NOT EXISTS recommendation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recommendation_id INTEGER NOT NULL,
    status_from TEXT,
    status_to TEXT,
    changed_by INTEGER,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recommendation_id) REFERENCES banq_recommendations(id)
  )`
];

// ------------------------------------------------------------------
// PHASE 3 -- LEARN
// ------------------------------------------------------------------
const PHASE3_TABLES = [
  `CREATE TABLE IF NOT EXISTS journey_events (
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
  )`,

  // Quality status matters: estimated data is never silently mixed with
  // verified data, because a blended number would look precise and be wrong.
  //
  // AND THE NAME MUST BE UNIQUE: journey events reference their source by name,
  // and it was not unique. `INSERT OR IGNORE` therefore had nothing to conflict
  // with, so every seed run added another copy, and the LEFT JOIN in the
  // drop-off analysis fanned one event out into three. A funnel of 42,000
  // impressions read as 126,000. The unique index created in migrate() is what
  // makes one event count once.
  `CREATE TABLE IF NOT EXISTS journey_event_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    quality_status TEXT DEFAULT 'TRACKED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS journey_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    primary_goal TEXT,
    secondary_goals TEXT,
    journey_steps TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  )`,

  `CREATE TABLE IF NOT EXISTS experiments (
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
  )`,

  `CREATE TABLE IF NOT EXISTS experiment_variants (
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
  )`,

  `CREATE TABLE IF NOT EXISTS experiment_results (
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
  )`,

  `CREATE TABLE IF NOT EXISTS benchmark_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_type TEXT NOT NULL,
    criteria TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS benchmark_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sample_count INTEGER,
    FOREIGN KEY (group_id) REFERENCES benchmark_groups(id)
  )`,

  `CREATE TABLE IF NOT EXISTS cross_campaign_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    advertiser_id INTEGER NOT NULL,
    insight_type TEXT NOT NULL,
    description TEXT NOT NULL,
    supporting_campaigns TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (advertiser_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS enterprise_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS enterprise_brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    enterprise_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    qap_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (enterprise_id) REFERENCES enterprise_accounts(id)
  )`,

  `CREATE TABLE IF NOT EXISTS enterprise_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    enterprise_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    brand_scope TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (enterprise_id) REFERENCES enterprise_accounts(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS banq_client_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    advertiser_id INTEGER NOT NULL,
    campaign_id INTEGER,
    assigned_to INTEGER,
    priority TEXT DEFAULT 'NORMAL',
    status TEXT DEFAULT 'NEW',
    subject TEXT,
    body TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (advertiser_id) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
  )`
];

// ------------------------------------------------------------------
// PHASE 4 -- PLAN
// ------------------------------------------------------------------
const PHASE4_TABLES = [
  `CREATE TABLE IF NOT EXISTS campaign_readiness_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    score INTEGER,
    checks TEXT NOT NULL,
    state TEXT DEFAULT 'NOT_READY',
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  )`,

  `CREATE TABLE IF NOT EXISTS campaign_plans (
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
  )`,

  `CREATE TABLE IF NOT EXISTS reports (
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
  )`,

  `CREATE TABLE IF NOT EXISTS report_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id)
  )`,

  `CREATE TABLE IF NOT EXISTS placement_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    publisher_category TEXT,
    placement_type TEXT,
    creative_format TEXT,
    region TEXT,
    device_type TEXT,
    historical_delivery_data TEXT,
    availability_status TEXT DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS placement_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    placement_id INTEGER NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (placement_id) REFERENCES placement_profiles(id)
  )`,

  `CREATE TABLE IF NOT EXISTS predictive_alerts (
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
  )`,

  `CREATE TABLE IF NOT EXISTS campaign_scenarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    variables TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES campaign_plans(id)
  )`,

  `CREATE TABLE IF NOT EXISTS scenario_simulations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scenario_id INTEGER NOT NULL,
    results TEXT NOT NULL,
    confidence_level TEXT,
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scenario_id) REFERENCES campaign_scenarios(id)
  )`,

  `CREATE TABLE IF NOT EXISTS forecasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    forecast_type TEXT NOT NULL,
    forecast_range TEXT NOT NULL,
    confidence_level TEXT NOT NULL,
    model_version TEXT NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    inputs TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  )`,

  `CREATE TABLE IF NOT EXISTS forecast_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    forecast_id INTEGER NOT NULL,
    snapshot TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (forecast_id) REFERENCES forecasts(id)
  )`,

  `CREATE TABLE IF NOT EXISTS gtm_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    advertiser_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    objective TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (advertiser_id) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS gtm_objectives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    primary_objective TEXT,
    secondary_objectives TEXT,
    success_metrics TEXT,
    target_dates TEXT,
    responsible_teams TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES gtm_projects(id)
  )`,

  `CREATE TABLE IF NOT EXISTS gtm_timelines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    stage TEXT NOT NULL,
    tasks TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES gtm_projects(id)
  )`,

  `CREATE TABLE IF NOT EXISTS gtm_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    assigned_to INTEGER,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES gtm_projects(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
  )`,

  `CREATE TABLE IF NOT EXISTS learning_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    advertiser_id INTEGER NOT NULL,
    observation TEXT NOT NULL,
    evidence TEXT,
    status TEXT DEFAULT 'OBSERVED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (advertiser_id) REFERENCES users(id)
  )`
];

const ALL_TABLES = CORE_TABLES
  .concat(PHASE1_TABLES)
  .concat(PHASE1_INFRA_TABLES)
  .concat(PHASE2_TABLES)
  .concat(PHASE3_TABLES)
  .concat(PHASE4_TABLES);

// ------------------------------------------------------------------
// E0.2 -- banq_config defaults
//
// Every value the engines read. An engine that hardcodes one of these is a
// defect: the admin UI exists so the founder can change any of them at runtime
// and see the score move.
// ------------------------------------------------------------------
const CONFIG_DEFAULTS = [
  ['health_score_weights', JSON.stringify({
    budget_pacing: 25, goal_progress: 25, delivery: 20, performance_trend: 20, technical_status: 10
  }), 'json', 'Campaign health score weights (must sum to 100)'],
  ['health_score_ranges', JSON.stringify({
    healthy: 80, watch: 60, needs_attention: 40, critical: 0
  }), 'json', 'Health band floors: healthy >= 80, watch >= 60, needs_attention >= 40, critical below'],

  ['alert_cooldown_minutes', '60', 'int', 'Do not raise the same alert type again inside this window'],
  ['alert_dedup_window_minutes', '120', 'int', 'Window in which an unresolved alert of the same type blocks a duplicate'],

  ['pacer_on_track_band_pct', '10', 'int', 'Pacing is ON_TRACK within +/- this percent of expected spend'],
  ['pacer_at_risk_pct', '130', 'int', 'Pacing is AT_RISK above this percent of expected spend'],

  ['fatigue_min_active_days', '5', 'int', 'Earliest day a creative can be called fatigued'],
  ['fatigue_min_impressions', '1000', 'int', 'Impressions a creative needs before fatigue is judged'],
  ['fatigue_decline_threshold', '15', 'int', 'Percent decline that counts as a sustained fall'],
  ['fatigue_consecutive_decline_periods', '3', 'int', 'Consecutive declining periods required'],

  ['creative_min_impressions', '500', 'int', 'Minimum impressions before a creative score is issued'],
  ['creative_min_clicks', '50', 'int', 'Minimum clicks before a creative score is issued'],
  ['creative_min_runtime_hours', '24', 'int', 'Minimum hours live before a creative score is issued'],

  ['creative_score_weights', JSON.stringify({
    engagement: 20, click: 25, conversion: 25, cost_efficiency: 15, goal_contribution: 10, trend: 5
  }), 'json', 'Creative performance score weights'],

  // Goal-aware scoring: an awareness campaign and a conversion campaign cannot
  // be judged by the same weights, so the weights are selectable per goal.
  ['creative_score_weights_by_goal', JSON.stringify({
    BRAND_AWARENESS: { engagement: 40, click: 25, conversion: 5, cost_efficiency: 15, goal_contribution: 10, trend: 5 },
    FOLLOWERS: { engagement: 35, click: 25, conversion: 10, cost_efficiency: 15, goal_contribution: 10, trend: 5 },
    WEBSITE_VISITS: { engagement: 15, click: 35, conversion: 20, cost_efficiency: 15, goal_contribution: 10, trend: 5 },
    SALES: { engagement: 10, click: 20, conversion: 40, cost_efficiency: 15, goal_contribution: 10, trend: 5 },
    BOOKINGS: { engagement: 10, click: 20, conversion: 40, cost_efficiency: 15, goal_contribution: 10, trend: 5 },
    LEADS: { engagement: 10, click: 20, conversion: 40, cost_efficiency: 15, goal_contribution: 10, trend: 5 },
    APP_DOWNLOADS: { engagement: 10, click: 20, conversion: 40, cost_efficiency: 15, goal_contribution: 10, trend: 5 },
    CUSTOM: { engagement: 20, click: 25, conversion: 25, cost_efficiency: 15, goal_contribution: 10, trend: 5 }
  }), 'json', 'Creative score weights by campaign goal type'],

  ['experiment_min_runtime_days', '3', 'int', 'Minimum experiment runtime before results are read'],
  ['experiment_min_impressions', '2000', 'int', 'Minimum experiment impressions'],
  ['experiment_min_conversions', '10', 'int', 'Minimum experiment conversions'],
  ['experiment_min_sample_size', '1000', 'int', 'Minimum visitors per variant'],

  ['benchmark_min_campaign_count', '5', 'int', 'Campaigns required before a benchmark group is published'],
  ['benchmark_freshness_days', '90', 'int', 'How old benchmark data may be'],
  ['benchmark_min_data_volume', '10000', 'int', 'Impressions a benchmark group must aggregate'],
  ['benchmark_min_recency_days', '30', 'int', 'Newest data must be no older than this'],
  ['benchmark_min_group_similarity', '70', 'int', 'Percent similarity required to place a campaign in a group'],

  ['notification_cooldown_minutes', '30', 'int', 'Cooldown between notifications of the same type'],
  ['report_default_period_days', '7', 'int', 'Default reporting period length'],

  ['forecast_model_version', 'v1', 'string', 'Model version stamped on every forecast, so history stays reproducible'],

  // Locked decision 23.11 + the founder's rule: the $15/month BANQ AD SERVICE
  // is what unlocks the monitoring tools. Advertisers may run as many ads as
  // they like; the monitoring fee is one $15 month. Extra plans are bought on
  // newquanthoms.com only.
  ['banq_monitor_fee_usd', '15', 'int', 'BANQ AD SERVICE: the monthly fee that unlocks monitoring tools'],
  ['banq_monitor_fee_credits', '1500', 'int', 'Same fee expressed in credits for credit payment'],

  ['banq_service_plans', JSON.stringify({
    monitor: { name: 'BANQ Monitor', fee_usd: 15, fee_credits: 1500, unlocks: 'monitoring' },
    insight: { name: 'BANQ Insight', fee_usd: 45, fee_credits: 4500, unlocks: 'monitoring+analysis' },
    managed: { name: 'BANQ Managed', fee_usd: 150, fee_credits: 15000, unlocks: 'monitoring+analysis+human' },
    enterprise: { name: 'BANQ Enterprise', fee_usd: 400, fee_credits: 40000, unlocks: 'all+multi-brand' }
  }), 'json', 'BANQ service tiers and what each unlocks'],

  ['intelligence_plan_authority', 'docs/BANQ-INTELLIGENCE-IMPLEMENTATION-PLAN.md', 'string', 'The single build authority for the intelligence scope'],
  ['intelligence_step_count', '37', 'int', 'Number of build steps in the authority document']
];

async function migrate() {
  for (const sql of ALL_TABLES) {
    await db.execute(sql);
  }

  // Dedupe pass BEFORE the unique index can be created. Existing duplicate
  // source rows are collapsed to the earliest, because journey events reference
  // the source by name and the name is all that matters.
  await db.execute(`
    DELETE FROM journey_event_sources
    WHERE id NOT IN (SELECT MIN(id) FROM journey_event_sources GROUP BY source_name)
  `);
  // Indexes that the engines lean on. Kept separate so the table list above
  // stays readable next to the spec's own schema blocks.
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_metrics_campaign ON campaign_metrics(campaign_id, metric_name, timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_creative_metrics ON creative_metrics(creative_id, metric_name, timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_timeline_campaign ON campaign_timeline(campaign_id, timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_notes_campaign ON banq_notes(campaign_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_alerts_campaign ON banq_alerts(campaign_id, status, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_health_campaign ON campaign_health_scores(campaign_id, calculated_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_journey_events ON journey_events(campaign_id, event_name, event_timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_activity_campaign ON banq_activity_log(campaign_id, timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_subs_advertiser ON banq_service_subscriptions(advertiser_id, banq_service_status, period_end DESC)',
    'CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser ON campaigns(advertiser_id, status)',
    // The one-event-counts-once guarantee. Without this the drop-off funnel
    // multiplies by however many copies of a source name exist.
    'CREATE UNIQUE INDEX IF NOT EXISTS uniq_journey_event_source ON journey_event_sources(source_name)'
  ];
  for (const sql of indexes) {
    await db.execute(sql);
  }

  // Seed config. INSERT OR IGNORE so a value an admin has changed is never
  // reset by a restart -- the seed fills gaps, it does not overwrite choices.
  for (const [key, value, type, description] of CONFIG_DEFAULTS) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO banq_config (config_key, config_value, config_type, description)
            VALUES (?, ?, ?, ?)`,
      args: [key, value, type, description]
    });
  }

  return { tables: ALL_TABLES.length, config_keys: CONFIG_DEFAULTS.length };
}

module.exports = { migrate, ALL_TABLES, CONFIG_DEFAULTS };
